import {extractJobPosting} from './extract.mjs';
import {normalizeJob,encodeJob,FIELD_LIMITS,HANDOFF_KEY} from './shared/job-capture.mjs';

const form=document.querySelector('#job-form');
const status=document.querySelector('#status');
const button=document.querySelector('#capture');
const draftKey='sagittaiq-job-draft';
let timer;
let revision=0;
let storageWork=Promise.resolve();
function notify(message,error=false){status.textContent=message;status.className=error?'error':'';}
function readForm(){return normalizeJob({version:1,...Object.fromEntries(new FormData(form))});}
function populate(job){for(const key of Object.keys(FIELD_LIMITS)){const field=form.elements.namedItem(key);if(field)field.value=job[key] || '';}}
function showWarnings(messages){const list=document.querySelector('#warnings');list.replaceChildren(...messages.map(message=>{const li=document.createElement('li');li.textContent=message;return li;}));list.hidden=!messages.length;}
function persist(){const draft={job:readForm(),savedAt:Date.now()};storageWork=storageWork.catch(()=>{}).then(()=>chrome.storage.local.set({[draftKey]:draft}));return storageWork;}
function erase(){storageWork=storageWork.catch(()=>{}).then(()=>chrome.storage.local.remove(draftKey));return storageWork;}
async function hydrate(){
  const started=revision;
  try {
    const data=(await chrome.storage.local.get(draftKey))[draftKey];
    if(data && Date.now()-data.savedAt<24*60*60*1000 && started===revision){populate(normalizeJob(data.job));notify('Your previous draft is ready. Capture this page to replace it.');}
    else if(data && started===revision) await chrome.storage.local.remove(draftKey);
  }catch{notify('Could not restore the previous draft. You can capture again.',true);}
}
button.addEventListener('click',async()=>{
  const started=++revision;clearTimeout(timer);button.disabled=true;notify('Reading this job posting…');
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('Open a job posting on a normal website first. Chrome settings, the Web Store, and PDF viewers cannot be captured.');
    const [response]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:extractJobPosting});
    if(started!==revision) return;
    if(!response?.result?.job) throw new Error('This page could not be read. Copy the posting into the form instead.');
    populate(normalizeJob(response.result.job));form.querySelector('#consent').checked=false;
    const clipped=Object.entries(FIELD_LIMITS).filter(([key,limit])=>typeof response.result.job[key]==='string' && response.result.job[key].length>limit)
      .map(([key])=>`${form.elements.namedItem(key)?.closest('label')?.textContent?.trim() || 'A captured field'} was shortened. Review it before sending.`);
    showWarnings([...(response.result.warnings || []),...clipped]);document.querySelector('#method').textContent=response.result.method;
    await persist();notify('Captured. Review the fields before sending to SagittaIQ.');
  }catch(error){if(started!==revision) return;notify(error.message || 'Capture failed. You can paste the job details manually.',true);}
  finally{button.disabled=false;}
});
form.addEventListener('input',()=>{revision++;clearTimeout(timer);timer=setTimeout(()=>persist().catch(()=>notify('Draft storage is unavailable. Export JSON to keep a copy.',true)),300);});
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!form.reportValidity()) return;
  revision++;const send=document.querySelector('#send');button.disabled=true;send.disabled=true;form.inert=true;clearTimeout(timer);
  try {
    const job=readForm();if(!job.title || !job.company || job.description.length<40) throw new Error('Enter a title, company, and at least 40 characters of job description.');
    // The fragment is never sent in the HTTP request; the website removes it on import.
    const url=`https://sagittaiq.com/#${HANDOFF_KEY}=${encodeJob(job)}`;
    await chrome.tabs.create({url});
    await erase();
    notify('Opened SagittaIQ. Sign in there to review and save this opportunity.');
  }catch(error){notify(error.message || 'Could not open SagittaIQ.',true);}
  finally{button.disabled=false;send.disabled=false;form.inert=false;}
});
document.querySelector('#export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(readForm(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='sagittaiq-job.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('Exported the reviewed fields as JSON.');
});
document.querySelector('#clear').addEventListener('click',async()=>{
  revision++;clearTimeout(timer);form.reset();showWarnings([]);
  try{await erase();notify('Draft cleared.');}catch{notify('Form cleared, but saved storage could not be cleared. Try again.',true);}
});
void hydrate();
