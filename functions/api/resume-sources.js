import { ensureUser } from './identity.js';
import { ResumeSourceError, sourceJson, sourceFailure, saveOriginal, saveSnapshot, readSourceJson, listSources, downloadSource } from '../lib/resume-sources.js';

async function identity(request,env) {
  const user=await ensureUser(request,env);
  if(!user)throw new ResumeSourceError('Sign in with a verified account.',401);
  return user;
}
export async function onRequestGet({request,env}) {
  try {const user=await identity(request,env);return new URL(request.url).searchParams.has('id')?await downloadSource(request,env,user.userId):sourceJson(await listSources(request,env,user.userId));}
  catch(error){return sourceFailure(error);}
}
export async function onRequestPost({request,env}) {
  try {
    const user=await identity(request,env); const type=request.headers.get('Content-Type')||''; let result;
    if(type.toLowerCase().startsWith('multipart/form-data;'))result=await saveOriginal(request,env,user);
    else if(type.toLowerCase().startsWith('application/json'))result=await saveSnapshot(await readSourceJson(request),env,user);
    else throw new ResumeSourceError('Send a JSON snapshot or multipart resume file.',415);
    return sourceJson({ok:true,...result.record,reused:result.reused},result.reused?200:201);
  } catch(error){return sourceFailure(error);}
}
export async function onRequestOptions() {return new Response(null,{status:204,headers:{Allow:'GET,POST,OPTIONS'}});}
