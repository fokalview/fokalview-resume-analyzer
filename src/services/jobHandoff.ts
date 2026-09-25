import {decodeJob,HANDOFF_KEY,jobContext,normalizeJob,type CapturedJob} from '../../chrome-extension/shared/job-capture.mjs';
import type {JobHandoff} from '../types';

const STORAGE_KEY='sagittaiq_pending_job';
let cached:ReturnType<typeof parseJobHandoff> | undefined;
export function clearPendingJob(){cached=undefined;try{sessionStorage.removeItem(STORAGE_KEY);}catch{/* Storage may be disabled. */}}
// One import per document, including React StrictMode's repeated initialization.
export function readJobHandoff(){return cached ??= parseJobHandoff();}
function parseJobHandoff(): JobHandoff & {capturedJob?:CapturedJob;importError?:string} {
  const params=new URLSearchParams(window.location.search);
  const legacy={title:params.get('jobTitle') || '',company:params.get('company') || '',location:params.get('location') || '',
    salary:params.get('salary') || '',url:params.get('jobUrl') || '',notes:params.get('notes') || '',source:params.get('source') || ''};
  const fallback={...legacy,targetRole:legacy.title,jobContext:[legacy.title&&`Job title: ${legacy.title}`,legacy.company&&`Company: ${legacy.company}`,
    legacy.location&&`Location: ${legacy.location}`,legacy.salary&&`Salary: ${legacy.salary}`,legacy.url&&`Job URL: ${legacy.url}`,legacy.notes&&`Tracker notes: ${legacy.notes}`].filter(Boolean).join('\n')};
  const fragment=new URLSearchParams(window.location.hash.slice(1));
  let capturedJob:CapturedJob | undefined;
  try {
    if(fragment.has(HANDOFF_KEY)) {
      capturedJob=decodeJob(fragment.get(HANDOFF_KEY) || '');
      if(!capturedJob.title || !capturedJob.company || capturedJob.description.length<40) throw new Error('The capture needs a title, company, and job description. Complete it in the extension and send it again.');
      sessionStorage.setItem(STORAGE_KEY,JSON.stringify({savedAt:Date.now(),job:capturedJob}));
    } else {
      const stored=sessionStorage.getItem(STORAGE_KEY);
      if(stored){const draft=JSON.parse(stored);if(Number.isFinite(draft.savedAt) && Date.now()-draft.savedAt<86400000) capturedJob=normalizeJob(draft.job);else clearPendingJob();}
    }
  }catch(error){clearPendingJob();return {...fallback,importError:error instanceof Error?error.message:'Could not import this job.'};}
  finally {if(fragment.has(HANDOFF_KEY)) history.replaceState(null,'',window.location.pathname+window.location.search);}
  return capturedJob?{...capturedJob,notes:'',targetRole:capturedJob.title,jobContext:jobContext(capturedJob),capturedJob}:fallback;
}
