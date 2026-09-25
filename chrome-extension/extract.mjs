// Passed to chrome.scripting.executeScript: all dependencies must stay inside this function.
export function extractJobPosting() {
  const warnings = [];
  const clean = value => typeof value === 'string' ? value.replace(/\u0000/g,'').replace(/[\t ]+/g,' ').replace(/\n[ \t]+/g,'\n').trim() : '';
  const text = node => clean(node?.innerText || '');
  const first = (selectors, scope=document) => {
    for (const selector of selectors) {
      const node=scope.querySelector(selector);
      if (node && text(node)) return text(node);
    }
    return '';
  };
  const htmlText = value => {
    if (typeof value !== 'string') return '';
    const template=document.createElement('template'); template.innerHTML=value;
    template.content.querySelectorAll('script,style,iframe,form,noscript').forEach(node=>node.remove());
    template.content.querySelectorAll('br').forEach(node=>node.replaceWith('\n'));
    template.content.querySelectorAll('p,div,li,h1,h2,h3,h4,section').forEach(node=>node.append('\n'));
    return clean(template.content.textContent || '').replace(/\n{3,}/g,'\n\n');
  };
  const structured=[];
  const walk=(value, depth=0)=>{
    if (!value || typeof value!=='object' || depth>7 || structured.length>100) return;
    if (Array.isArray(value)) {value.slice(0,100).forEach(item=>walk(item,depth+1));return;}
    if ([value['@type']].flat().includes('JobPosting')) structured.push(value);
    if (value['@graph']) walk(value['@graph'],depth+1);
    if (value.itemListElement) walk(value.itemListElement,depth+1);
    if (value.item) walk(value.item,depth+1);
    if (value.mainEntity) walk(value.mainEntity,depth+1);
  };
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{
    if ((script.textContent?.length || 0)>500000) return;
    try {walk(JSON.parse(script.textContent));} catch { /* Fall back to visible details. */ }
  });
  const visibleTitle=first(['.job-details-jobs-unified-top-card__job-title h1','.jobs-unified-top-card__job-title','.jobsearch-JobInfoHeader-title','[data-automation-id="jobPostingHeader"]','.posting-headline h2','h1']);
  let schema=structured.length===1?structured[0]:null;
  if(structured.length>1) {
    const matches=structured.filter(job=>clean(job.title).toLowerCase()===visibleTitle.toLowerCase() || job.url===location.href);
    if(matches.length===1) schema=matches[0];
    else warnings.push('Multiple job postings detected. Open the individual job page and capture again; verify all fields.');
  }
  const rootSelectors=['#jobDescriptionText','[data-automation-id="jobPostingDescription"]','.jobs-description__content','.show-more-less-html__markup','.job__description','#content .content','.posting-page','.job-description','[itemprop="description"]','main article','article','main'];
  let root=null;
  for(const selector of rootSelectors) {const node=document.querySelector(selector);if(text(node).length>80){root=node;break;}}
  const description=structured.length>1 && !schema ? '' : htmlText(schema?.description) || text(root);
  if(!description) warnings.push('No readable job description found. Expand the posting or paste the description below.');
  if(description.length>15000) warnings.push('The description exceeds 15,000 characters and will be shortened. Review the captured sections.');
  if(root?.matches('main,article,main article') && !schema) warnings.push('Used the main page text. Remove navigation, other jobs, or unrelated content before sending.');
  const toText=value=>Array.isArray(value)?value.map(toText).filter(Boolean).join('\n'):typeof value==='string'?htmlText(value):value && typeof value==='object'?toText(value.name || value.value || value.description):typeof value==='number'?String(value):'';
  const address=value=>{
    if(!value) return '';
    if(typeof value==='string') return value;
    const a=value.address || value;
    return [a.addressLocality,a.addressRegion,toText(a.addressCountry)].filter(Boolean).join(', ') || toText(value.name);
  };
  const pay=schema?.baseSalary || schema?.estimatedSalary;
  const salaryFromSchema=()=>{
    if(!pay || Array.isArray(pay)) return '';
    const value=pay.value ?? pay;
    if(typeof value==='number' || typeof value==='string') return [pay.currency,value].filter(Boolean).join(' ');
    const amount=value.minValue!==undefined && value.maxValue!==undefined?`${value.minValue}–${value.maxValue}`:value.value ?? value.minValue ?? value.maxValue;
    return amount!==undefined?[pay.currency,amount,value.unitText && `per ${value.unitText.toLowerCase()}`].filter(Boolean).join(' '):'';
  };
  const salaryText=first(['[data-testid*="salary"]','[data-automation-id="compensation"]','[itemprop="baseSalary"]','.salary']);
  const payLines=description.split('\n').filter(line=>/\b(salary|pay|compensation|hourly|annually|per hour|per year)\b/i.test(line)).join('\n');
  const salaryMatch=(salaryText || payLines).match(/(?:[$£€]\s*[\d,.]+\s*[kK]?(?:\s*(?:-|–|—|to)\s*[$£€]?\s*[\d,.]+\s*[kK]?)?|(?:USD|CAD|GBP|EUR)\s*[\d,.]+(?:\s*(?:-|–|to)\s*[\d,.]+)?)\s*(?:(?:per|a|\/)\s*(?:year|annum|hour|month|week)|annually|hourly)?/i);
  const sections={requirements:[],preferred:[],responsibilities:[],benefits:[],companyBio:[],education:[],experience:[]};
  const headings=[
    ['preferred',/^(preferred (?:qualifications|skills|requirements)|nice[- ]to[- ]haves?|bonus(?: points)?|ideally|desirable(?: qualifications| skills)?)\b/i],
    ['requirements',/^(requirements|required (?:qualifications|skills)|minimum qualifications|qualifications|what you(?:'|’)ll (?:need|bring)|what we(?:'|’)re looking for|about you|must[- ]haves?)\b/i],
    ['responsibilities',/^(responsibilities|key responsibilities|what you(?:'|’)ll do|the role|your (?:role|impact)|duties|what you will do)\b/i],
    ['benefits',/^(benefits|perks|what we offer|compensation and benefits)\b/i],
    ['companyBio',/^(about (?:us|the company)|who we are|our company)\b/i],
    ['education',/^(education|educational requirements)\b/i],['experience',/^(experience required|experience requirements)\b/i]
  ];
  let section='';
  for(const line of description.split(/\n+/).map(clean).filter(Boolean)) {
    const heading=line.length<120?headings.find(([,pattern])=>pattern.test(line)):null;
    if(heading) {section=heading[0];const tail=line.includes(':')?line.slice(line.indexOf(':')+1).trim():'';if(tail) sections[section].push(tail);continue;}
    if(/^(apply(?: now)?|equal opportunity|privacy|how to apply|other jobs)\b/i.test(line)) section='';
    if(section) sections[section].push(line);
  }
  const organization=schema?.hiringOrganization;
  const company=toText(organization?.name) || first(['.job-details-jobs-unified-top-card__company-name','.jobs-unified-top-card__company-name','.topcard__org-name-link','[data-testid="inlineHeader-companyName"]','[data-testid="company-name"]','[itemprop="hiringOrganization"]','.company-name']);
  const job={version:1,
    title:toText(schema?.title) || visibleTitle,
    company,
    location:[schema?.jobLocation].flat().filter(Boolean).map(address).filter(Boolean).join('; ') || first(['[data-testid="job-location"]','[data-testid="inlineHeader-companyLocation"]','[data-automation-id="locations"]','.posting-categories .location','.jobs-unified-top-card__bullet','.topcard__flavor--bullet','[itemprop="jobLocation"]']),
    salary:salaryFromSchema() || clean(salaryMatch?.[0] || ''),
    employmentType:toText(schema?.employmentType) || first(['[data-automation-id="timeType"]','.posting-categories .commitment','[itemprop="employmentType"]']),
    workplaceType:schema?.jobLocationType==='TELECOMMUTE'?'Remote':first(['.posting-categories .workplaceTypes','[data-testid="workplace-type"]']),
    description,companyBio:toText(organization?.description) || sections.companyBio.join('\n'),
    requirements:toText(schema?.qualifications) || sections.requirements.join('\n'),
    preferred:sections.preferred.join('\n'),responsibilities:toText(schema?.responsibilities) || sections.responsibilities.join('\n'),
    education:toText(schema?.educationRequirements) || sections.education.join('\n'),experience:toText(schema?.experienceRequirements) || sections.experience.join('\n'),
    benefits:toText(schema?.jobBenefits) || sections.benefits.join('\n'),postedAt:toText(schema?.datePosted),deadline:toText(schema?.validThrough),url:location.href,
    source:location.hostname.replace(/^www\./,'')};
  if(!job.title) warnings.push('Job title was not found. Enter it before sending.');
  if(!company) warnings.push('Company was not found. The job board name is not used as the employer.');
  if(!job.salary) warnings.push('Salary was not found; leave it blank if the employer did not publish it.');
  return {job,warnings,method:schema?'Structured job data + page text':'Visible page text'};
}
