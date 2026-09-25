export const FIELD_LIMITS = Object.freeze({
  title: 160, company: 160, location: 200, salary: 160,
  employmentType: 120, workplaceType: 120, experience: 1000, education: 1000,
  description: 15000, companyBio: 1500, responsibilities: 2000,
  requirements: 2000, preferred: 2000, benefits: 1500,
  postedAt: 80, deadline: 80, url: 1500, source: 200
});
export const HANDOFF_KEY = 'sagittaiq-job';
export function normalizeJob(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) {
    throw new Error('This job capture format is not supported. Capture the job again.');
  }
  const job = {version: 1};
  for (const [key, limit] of Object.entries(FIELD_LIMITS)) {
    job[key] = typeof value[key] === 'string' ? value[key].replace(/\u0000/g, '').trim().slice(0, limit) : '';
  }
  try {
    const url = new URL(job.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    url.username = ''; url.password = ''; url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|token$|access_token$|auth$)/i.test(key)) url.searchParams.delete(key);
    }
    job.url = url.href; job.source = url.hostname.replace(/^www\./, '');
  } catch { job.url = ''; job.source = ''; }
  return job;
}
export function jobContext(value) {
  const job = normalizeJob(value);
  const labels = {title:'Job title',company:'Company',location:'Location',salary:'Salary',employmentType:'Employment type',
    workplaceType:'Workplace',experience:'Experience',education:'Education',postedAt:'Date posted',deadline:'Application deadline',
    url:'Job URL',companyBio:'About the company',responsibilities:'Responsibilities',requirements:'Requirements',
    preferred:'Nice to have',benefits:'Benefits',description:'Full job description'};
  return Object.entries(labels).filter(([key])=>job[key]).map(([key,label])=>`${label}:\n${job[key]}`).join('\n\n');
}
export function encodeJob(value) {
  const job = normalizeJob(value);
  const bytes = new TextEncoder().encode(JSON.stringify(job));
  if (bytes.length > 90000) throw new Error('This capture is too long. Shorten the description before sending.');
  return btoa(Array.from(bytes, byte=>String.fromCharCode(byte)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/, '');
}
export function decodeJob(encoded) {
  if (!encoded || encoded.length > 120000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('The captured job is invalid or too large.');
  try {
    const bytes = Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')), char=>char.charCodeAt(0));
    return normalizeJob(JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)));
  } catch { throw new Error('The captured job could not be read. Capture it again.'); }
}
