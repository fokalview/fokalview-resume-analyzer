import {test,expect,chromium} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
// These modules are also shipped directly in the extension.
// @ts-ignore JS extractor runs in the fixture document.
import {extractJobPosting} from '../../chrome-extension/extract.mjs';
import {encodeJob,decodeJob} from '../../chrome-extension/shared/job-capture.mjs';

const description='<p>Build reliable tools for our customers and collaborate with the platform team.</p><h2>Requirements</h2><ul><li>Three years of TypeScript experience</li><li>SQL and API design</li></ul><h2>Nice to have</h2><ul><li>Go and Kubernetes</li></ul><h2>Responsibilities</h2><p>Design and maintain customer-facing services.</p><h2>Benefits</h2><p>Health coverage and paid leave.</p>';
const structured={ '@type':'JobPosting',title:'Platform Engineer',hiringOrganization:{name:'Northstar Demo',description:'A fictional company for testing.'},description,
 jobLocation:{address:{addressLocality:'Rochester',addressRegion:'NY',addressCountry:'US'}},jobLocationType:'TELECOMMUTE',employmentType:'FULL_TIME',
 baseSalary:{currency:'USD',value:{minValue:120000,maxValue:160000,unitText:'YEAR'}},datePosted:'2026-09-20',validThrough:'2026-10-20'};
const draft={version:1 as const,title:'Platform Engineer',company:'Northstar Demo',description:'Build reliable developer tools using TypeScript, SQL and Go. Work with our platform team to improve services.',requirements:'TypeScript\nSQL\nAPI design',preferred:'Go and Kubernetes',location:'Rochester, NY',salary:'USD 120,000–160,000 per year',workplaceType:'Remote',url:'https://jobs.example.test/42'};

test('JSON-LD graph captures job fields and distinct qualification sections',async({page})=>{
 await page.setContent(`<h1>Platform Engineer</h1><script type="application/ld+json">${JSON.stringify({'@graph':[structured]})}</script>`);
 const {job,warnings}=await page.evaluate(extractJobPosting);
 expect(job.title).toBe('Platform Engineer');expect(job.company).toBe('Northstar Demo');
 expect(job.salary).toBe('USD 120000–160000 per year');expect(job.location).toBe('Rochester, NY, US');
 expect(job.workplaceType).toBe('Remote');expect(job.requirements).toContain('SQL');expect(job.requirements).not.toContain('Kubernetes');
 expect(job.preferred).toContain('Kubernetes');expect(job.responsibilities).toContain('customer-facing');expect(warnings).toEqual([]);
});

for(const [name,html,location] of [
 ['Indeed','<h1 class="jobsearch-JobInfoHeader-title">Platform Engineer</h1><span data-testid="inlineHeader-companyName">Northstar Demo</span><span data-testid="inlineHeader-companyLocation">Rochester</span><div id="jobDescriptionText">'+description+'</div>','Rochester'],
 ['Workday','<h1 data-automation-id="jobPostingHeader">Platform Engineer</h1><span class="company-name">Northstar Demo</span><span data-automation-id="locations">New York</span><div data-automation-id="jobPostingDescription">'+description+'</div>','New York'],
 ['Lever','<div class="posting-headline"><h2>Platform Engineer</h2></div><span class="company-name">Northstar Demo</span><div class="posting-categories"><span class="location">Remote US</span></div><div class="posting-page">'+description+'</div>','Remote US'],
 ['LinkedIn','<h1 class="jobs-unified-top-card__job-title">Platform Engineer</h1><span class="jobs-unified-top-card__company-name">Northstar Demo</span><span class="jobs-unified-top-card__bullet">Rochester</span><div class="jobs-description__content">'+description+'</div>','Rochester'],
 ['Greenhouse','<h1>Platform Engineer</h1><span class="company-name">Northstar Demo</span><span itemprop="jobLocation">New York</span><div id="content"><div class="content">'+description+'</div></div>','New York']
]) {
 test(`${name} visible posting fallback preserves requirements without inventing salary`,async({page})=>{
  await page.setContent('<meta property="og:site_name" content="Job board">'+html);
  const {job}=await page.evaluate(extractJobPosting);
  expect(job.title).toBe('Platform Engineer');expect(job.company).toBe('Northstar Demo');expect(job.location).toBe(location);
  expect(job.salary).toBe('');expect(job.requirements).toContain('TypeScript');expect(job.preferred).toContain('Go');
 });
}

test('ambiguous multi-job pages and malformed data do not silently pick a job',async({page})=>{
 await page.setContent(`<h1>Open roles</h1><script type="application/ld+json">${JSON.stringify([structured,{...structured,title:'Designer'}])}</script><main>${description}</main>`);
 let result=await page.evaluate(extractJobPosting);expect(result.job.description).toBe('');expect(result.warnings.join(' ')).toContain('Multiple job');
 await page.setContent(`<h1>Platform Engineer</h1><meta property="og:site_name" content="LinkedIn"><script type="application/ld+json">broken</script><main>${description}<p>Our product processes $5 million in orders.</p></main>`);
 result=await page.evaluate(extractJobPosting);expect(result.job.company).toBe('');expect(result.job.salary).toBe('');
});

test('active job title selects matching structured data and ignores executable markup',async({page})=>{
 const bad={...structured,description:description+'<script>window.jobInjected=true</script><img src=x onerror="window.jobInjected=true">'};
 await page.setContent(`<h1>Platform Engineer</h1><script type="application/ld+json">${JSON.stringify([bad,{...structured,title:'Designer'}]).replaceAll('</script>','<\\/script>')}</script>`);
 const result=await page.evaluate(extractJobPosting);expect(result.job.title).toBe('Platform Engineer');
 expect(result.job.description).not.toContain('window.jobInjected');expect(await page.evaluate(()=>(window as any).jobInjected)).toBeUndefined();
});

test('capture survives sign-in navigation and saves only after explicit review',async({page})=>{
 let signedIn=false;const saves:any[]=[];
 await page.route('**/api/auth/session',route=>route.fulfill({status:signedIn?200:401,json:signedIn?{authenticated:true,user:{id:'test',email:'test@example.test',emailVerified:true},userId:'usr_test',candidateId:'C1'}:{authenticated:false}}));
 await page.route('**/api/applications',async route=>{
  if(route.request().method()==='POST'){saves.push(route.request().postDataJSON());await route.fulfill({json:{id:'app_canonical',applicationId:'A1',syncedAt:new Date().toISOString()}});}
  else await route.fulfill({json:{applications:[]}});
 });
 await page.goto('/#sagittaiq-job='+encodeJob(draft));
 await expect(page.getByText('Your captured job is ready. Sign in to review and save it.')).toBeVisible();
 expect(new URL(page.url()).hash).toBe('');expect(saves).toHaveLength(0);
 signedIn=true;await page.goto('/');
 await expect(page.getByRole('heading',{name:'Review your job capture.'})).toBeVisible();
 await expect(page.getByLabel('Captured job details')).toContainText('Kubernetes');expect(saves).toHaveLength(0);
 await page.getByRole('button',{name:'Save & compare resume'}).click();
 await expect(page.getByRole('heading',{name:'Upload a revised resume for Platform Engineer.'})).toBeVisible();
 expect(saves).toHaveLength(1);expect(saves[0].application.jobDescription).toContain('Nice to have:');
 expect(saves[0].application.title).toBe('Platform Engineer');
 expect(await page.evaluate(()=>sessionStorage.getItem('sagittaiq_pending_job'))).toBeNull();
});

test('malformed imports are visible and cannot create opportunities',async({page})=>{
 await page.goto('/#sagittaiq-job=bad!');
 await expect(page.getByRole('alert')).toContainText('invalid or too large');
 expect(new URL(page.url()).hash).toBe('');
});

test('unpacked Manifest V3 extension restores, edits, exports, and sends a draft',async()=>{
 const extension=resolve('chrome-extension');
 const channel=process.env.EXTENSION_BROWSER_CHANNEL || (process.platform==='win32'?'msedge':'chromium');
 const context=await chromium.launchPersistentContext('',{channel,headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],acceptDownloads:true});
 try{
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id=new URL(worker.url()).host;
  await worker.evaluate(async job=>{await (globalThis as any).chrome.storage.local.set({'sagittaiq-job-draft':{job,savedAt:Date.now()}});},draft);
  const page=await context.newPage();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`chrome-extension://${id}/popup.html`);
  await expect(page.getByLabel('Job title')).toHaveValue(draft.title);
  await page.getByLabel('Job title').fill('Senior Platform Engineer');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON'}).click();expect((await download).suggestedFilename()).toBe('sagittaiq-job.json');
  await context.route('https://sagittaiq.com/**',route=>route.fulfill({body:'Synthetic handoff target'}));
  await page.getByLabel(/Send these reviewed job details/).check();
  const opened=context.waitForEvent('page');await page.getByRole('button',{name:'Review in SagittaIQ'}).click();
  const target=await opened;await target.waitForURL('https://sagittaiq.com/**');
  const payload=new URLSearchParams(new URL(target.url()).hash.slice(1)).get('sagittaiq-job')!;
  expect(decodeJob(payload).title).toBe('Senior Platform Engineer');expect(errors).toEqual([]);
  await expect(page.getByRole('status')).toContainText('Opened SagittaIQ');
 }finally{await context.close();}
});

for(const denied of [false,true]) test(`capture button ${denied?'handles restricted pages':'fills the editable form and clears the draft'}`,async({page})=>{
 await page.setContent(`<script type="application/ld+json">${JSON.stringify(structured)}</script>`);
 const result=await page.evaluate(extractJobPosting);
 await page.route('**/chrome-fixture/**',async route=>{
  const file=new URL(route.request().url()).pathname.replace('/chrome-fixture/','');
  if(!/^(popup\.(html|css|mjs)|extract\.mjs|shared\/job-capture\.mjs|icons\/icon\d+\.png)$/.test(file)) return route.abort();
  await route.fulfill({body:await readFile(resolve('chrome-extension',file)),contentType:file.endsWith('html')?'text/html':file.endsWith('css')?'text/css':file.endsWith('png')?'image/png':'text/javascript'});
 });
 await page.addInitScript(({result,denied})=>{
  (window as any).chrome={tabs:{query:async()=>[{id:1,url:denied?'chrome://settings':'https://jobs.example.test/42'}]},
   scripting:{executeScript:async()=>[{result}]},storage:{local:{get:async()=>({}),set:async()=>{},remove:async()=>{}}}};
 },{result,denied});
 await page.goto('/chrome-fixture/popup.html');await page.getByRole('button',{name:'Capture this page'}).click();
 if(denied){await expect(page.getByRole('status')).toContainText('normal website');await expect(page.getByLabel('Job title')).toBeEditable();}
 else {
  await expect(page.getByLabel('Job title')).toHaveValue('Platform Engineer');await expect(page.getByLabel('Required qualifications')).toHaveValue(/SQL/);
  await expect(page.getByRole('status')).toContainText('Captured.');
  await page.getByRole('button',{name:'Clear draft'}).click();await expect(page.getByLabel('Job title')).toBeEmpty();await expect(page.getByRole('status')).toContainText('Draft cleared');
 }
});
