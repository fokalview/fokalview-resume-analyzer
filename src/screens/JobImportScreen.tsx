import {useState,type FormEvent} from 'react';
import {jobContext,type CapturedJob} from '../../chrome-extension/shared/job-capture.mjs';
import {saveApplicationRecord,type ApplicationRecord} from '../services/api';

export default function JobImportScreen({job,onSaved,onDiscard}:{job:CapturedJob;onSaved:(value:ApplicationRecord)=>void;onDiscard:()=>void}) {
  const [title,setTitle]=useState(job.title);
  const [company,setCompany]=useState(job.company);
  const [context,setContext]=useState(jobContext(job));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function save(event:FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try {
      if(!title.trim() || !company.trim() || context.trim().length<40) throw new Error('A title, company, and job description are required.');
      // Stable draft ID makes a retry idempotent; the server scopes it to this owner.
      const seed=JSON.stringify([job.url,title.trim(),company.trim()]);
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(seed));
      const id='capture_'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      const result=await saveApplicationRecord({id,title:title.trim(),company:company.trim(),location:job.location,salary:job.salary,
        status:'Interested',jobDescription:context,notes:'Captured with SagittaIQ Job Capture',url:job.url,source:job.source});
      onSaved(result);
    }catch(next){setError(next instanceof Error?next.message:'Could not save the opportunity.');}
    finally{setBusy(false);}
  }
  return <section className="upload-screen">
    <header className="page-header"><span className="eyebrow">Captured opportunity</span><h1>Review your job capture.</h1><p>Nothing has been saved to your account yet. Check the posting, then save it before comparing your resume.</p></header>
    <form onSubmit={save}>
      <div className="upload-grid">
        <label className="field">Job title<input required maxLength={160} value={title} onChange={event=>setTitle(event.target.value)}/></label>
        <label className="field">Company<input required maxLength={160} value={company} onChange={event=>setCompany(event.target.value)}/></label>
        <p>{[job.location,job.salary,job.workplaceType].filter(Boolean).join(' · ')}</p>
        {job.url&&<a href={job.url} target="_blank" rel="noopener noreferrer">View the original posting</a>}
        <label className="field textarea-field">Captured job details<textarea className="job-context" required minLength={40} maxLength={30000} rows={18} value={context} onChange={event=>setContext(event.target.value)}/></label>
      </div>
      <p>Saving stores these job details in your SagittaIQ account. Resume analysis is a separate step.</p>
      {error&&<p role="alert">{error}</p>}
      <div className="action-row"><button className="primary-button" type="submit" disabled={busy}>{busy?'Saving…':'Save & compare resume'}</button><button className="secondary-button" type="button" onClick={onDiscard} disabled={busy}>Discard capture</button></div>
    </form>
  </section>;
}
