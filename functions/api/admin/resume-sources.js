import { authorizeSourceAdmin, sourceJson, sourceFailure, listSources, downloadSource } from '../../lib/resume-sources.js';
export async function onRequestGet({request,env}) {
  try {await authorizeSourceAdmin(request,env);return new URL(request.url).searchParams.has('id')?await downloadSource(request,env,null,{admin:true}):sourceJson(await listSources(request,env,null,{admin:true}));}
  catch(error){return sourceFailure(error);}
}
