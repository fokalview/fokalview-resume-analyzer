import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { prepareMigrations } from '../scripts/migration-plan.mjs';

mock.module('@workos-inc/node',{exports:{WorkOS:class {userManagement={loadSealedSession:({sessionData})=>({authenticate:async()=>({authenticated:['alice','bob'].includes(sessionData),user:{id:sessionData,email:`${sessionData}@example.test`,emailVerified:true}})})};}}});
const sources=await import('../functions/api/resume-sources.js');
const admin=await import('../functions/api/admin/resume-sources.js');
const reviews=await import('../functions/api/resume-records.js');
const analyze=await import('../functions/api/analyze.js');
const apps=await import('../functions/api/applications.js');
const {sourceHash,MAX_FILE_SIZE}=await import('../functions/lib/resume-sources.js');
const {onRequest:onMiddleware}=await import('../functions/api/_middleware.js');
const sourceText='  Synthetic Student\n\nEngineering experience, Python and SQL. Built accessible student services.\n'.repeat(4);
const jobContext='  Software Engineer\nCompany: Synthetic Company\n\nBuild Python and SQL services.  ';
const analysis={score:74,summary:'Synthetic review',profile:{currentTitle:'Engineer',careerLevel:'Early Career',skills:{technical:['Python'],tools:['SQL'],soft:[]},workHistory:[],education:[]},jobDetails:{title:'Engineer',company:'Synthetic Company'},jobQualifications:{requiredSkills:['Python']},strengths:['Python evidence'],improvements:[],keywordAnalysis:{matched:['Python'],missing:[]},sections:[{name:'Skills',score:74,note:'Evidence'}]};
function setup() {
  const sql=new DatabaseSync(':memory:');
  const directory=new URL('../migrations/',import.meta.url);
  const files=readdirSync(directory).filter(n=>n.endsWith('.sql')).sort().map(name=>({name,sql:readFileSync(new URL(name,directory),'utf8')}));
  for(const migration of prepareMigrations(files,{application_captures:[],users:[]}))sql.exec(migration.sql);
  const statement=(query,values=[])=>({bind(...args){return statement(query,args);},async run(){return sql.prepare(query).run(...values);},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};}});
  const objects=new Map(),deleted=[];
  const RESUME_FILES={async put(key,data){if(objects.has(key))return null;objects.set(key,new Uint8Array(data));return {key};},async get(key){const value=objects.get(key);return value?{body:new Blob([value]).stream()}:null;},async delete(key){deleted.push(key);objects.delete(key);}};
  return {sql,objects,deleted,env:{DB:{prepare:statement},RESUME_FILES,WORKOS_API_KEY:'synthetic',WORKOS_CLIENT_ID:'synthetic',WORKOS_COOKIE_PASSWORD:'synthetic',APPLICATION_SYNC_SALT:'synthetic',ADMIN_ACCESS_CODE:'synthetic-admin'}};
}
function request(method='GET',user='alice',body,path='/api/resume-sources') {
  return new Request(`https://example.test${path}`,{method,headers:{...(user?{Cookie:`wos-session=${user}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
function originalRequest(id='original-1',user='alice',content='%PDF-1.7\nSynthetic scanned resume bytes',fileName='Synthetic résumé.pdf',type='application/pdf') {
  const form=new FormData();form.set('requestId',id);form.set('consent','true');form.set('consentVersion','resume-source-v1');form.set('file',new File([content],fileName,{type}));
  return new Request('https://example.test/api/resume-sources',{method:'POST',headers:{Cookie:`wos-session=${user}`},body:form});
}
function document(text=sourceText) {return {schemaVersion:'sagittaiq-resume-v1',text,source:{format:'pasted',fileName:'',mimeType:'text/plain',size:new TextEncoder().encode(text).length,sha256:'',extractor:'synthetic',extractorVersion:'1',extractedAt:'2026-11-04T12:00:00Z',status:text?'ready':'needs_text',warnings:[]},pages:[],blocks:text?[{id:'block-1',page:null,text,readingOrder:0,geometry:null}]:[]};}
function snapshot(id='snapshot-1',extra={}) {return {requestId:id,consent:true,consentVersion:'resume-source-v1',resumeDocument:document(),resumeText:sourceText,targetRole:'Software Engineer',jobContext,position:{company:'Synthetic Company',title:'Software Engineer',url:'https://example.test/jobs/1'},resumeLabel:'Student résumé v1',...extra};}
async function save(env,body=snapshot(),user='alice') {const r=await sources.onRequestPost({env,request:request('POST',user,body)});assert.ok([200,201].includes(r.status),await r.clone().text());return r.json();}
async function saveOriginal(env,id='original-1',user='alice'){const r=await sources.onRequestPost({env,request:originalRequest(id,user)});assert.ok([200,201].includes(r.status),await r.clone().text());return r.json();}

test('source endpoints require verified owners; cross-site source writes are rejected',async()=>{
  const {sql,env}=setup();try {
    for(const user of ['', 'invalid'])for(const method of ['GET','POST']) {
      const r=await sources[method==='GET'?'onRequestGet':'onRequestPost']({env,request:request(method,user,method==='POST'?snapshot():undefined)});assert.equal(r.status,401);
    }
    let next=false;const r=await onMiddleware({request:new Request('https://example.test/api/resume-sources',{method:'POST',headers:{Origin:'https://attacker.test'}}),next:()=>{next=true;}});assert.equal(r.status,403);assert.equal(next,false);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM resume_sources').get().n,0);
  }finally{sql.close();}
});
test('scanned original bytes persist exactly, are idempotent, and download only to owner or admin',async()=>{
  const {sql,env,objects}=setup();try {
    const saved=await saveOriginal(env);assert.equal(saved.sourceKind,'original');assert.equal(saved.hasOriginal,true);assert.equal(saved.hasText,false);
    assert.equal(saved.sha256,await sourceHash('%PDF-1.7\nSynthetic scanned resume bytes'));
    const again=await saveOriginal(env);assert.equal(again.id,saved.id);assert.equal(again.sha256,saved.sha256);assert.equal(objects.size,1);
    const own=await sources.onRequestGet({env,request:request('GET','alice',undefined,`/api/resume-sources?id=${saved.id}&format=original`)});
    assert.equal(await own.text(),'%PDF-1.7\nSynthetic scanned resume bytes');assert.match(own.headers.get('Content-Disposition'),/^attachment/);assert.equal(own.headers.get('X-Content-Type-Options'),'nosniff');assert.match(own.headers.get('Cache-Control'),/no-store/);
    assert.equal((await sources.onRequestGet({env,request:request('GET','bob',undefined,`/api/resume-sources?id=${saved.id}&format=original`)})).status,404);
    assert.equal((await admin.onRequestGet({env,request:request('GET','alice',undefined,`/api/admin/resume-sources?id=${saved.id}&format=original`)})).status,401);
    const adminRequest=new Request(`https://example.test/api/admin/resume-sources?id=${saved.id}&format=original`,{headers:{'X-Admin-Access-Code':'synthetic-admin'}});
    assert.equal((await admin.onRequestGet({env,request:adminRequest})).status,200);
    const list=await (await sources.onRequestGet({env,request:request()})).json();assert.equal(list.records[0].userId,undefined);assert.equal(list.records[0].objectKey,undefined);
    const adminList=await (await admin.onRequestGet({env,request:new Request('https://example.test/api/admin/resume-sources',{headers:{'X-Admin-Access-Code':'synthetic-admin'}})})).json();assert.ok(adminList.records[0].userId);
  }finally{sql.close();}
});
test('original validation rejects oversized, mismatched and malformed file types before writes',async()=>{
  const {sql,env,objects}=setup();try {
    for(const [content,name,type,status]of [['not a PDF','resume.pdf','application/pdf',415],['%PDF-1.7','resume.pdf','text/plain',415],['anything','resume.exe','application/octet-stream',415],[new Uint8Array(MAX_FILE_SIZE+1),'resume.txt','text/plain',413]]) {
      const r=await sources.onRequestPost({env,request:originalRequest('invalid','alice',content,name,type)});assert.equal(r.status,status,await r.clone().text());
    }
    assert.equal(objects.size,0);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM resume_sources').get().n,0);
  }finally{sql.close();}
});
test('concurrent original retries retain one object and reject conflicting payload reuse',async()=>{
  const {sql,env,objects,deleted}=setup();try {
    const put=env.RESUME_FILES.put;let arrivals=0,release;const bothUploads=new Promise(resolve=>{release=resolve;});
    env.RESUME_FILES.put=async(...args)=>{const object=await put(...args);if(++arrivals===2)release();await bothUploads;return object;};
    const replies=await Promise.all([sources.onRequestPost({env,request:originalRequest('concurrent')}),sources.onRequestPost({env,request:originalRequest('concurrent')})]);
    assert.deepEqual(replies.map(r=>r.status).sort(),[200,201]);
    const saved=await Promise.all(replies.map(r=>r.json()));assert.equal(saved[0].id,saved[1].id);assert.equal(objects.size,1);assert.equal(deleted.length,1);
    const conflicting=await sources.onRequestPost({env,request:originalRequest('concurrent','alice','%PDF-1.7\nDifferent original')});assert.equal(conflicting.status,409);assert.equal(objects.size,1);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM resume_sources').get().n,1);
  }finally{sql.close();}
});
test('original storage failures never acknowledge success; cleanup touches only a new unreferenced object',async()=>{
  const {sql,env,objects,deleted}=setup();try {
    const existing=await saveOriginal(env,'kept');const keepKey=[...objects.keys()][0];
    const noBinding=await sources.onRequestPost({env:{...env,RESUME_FILES:undefined},request:originalRequest('no-binding')});assert.equal(noBinding.status,503);
    const r2Failure=await sources.onRequestPost({env:{...env,RESUME_FILES:{...env.RESUME_FILES,put:async()=>{throw new Error('synthetic R2 outage');}}},request:originalRequest('failed-r2')});assert.equal(r2Failure.status,503);
    const oldPrepare=env.DB.prepare;env.DB={prepare(query){if(query.startsWith('INSERT INTO resume_sources'))return {bind(){return {run:async()=>{throw new Error('synthetic D1 outage');}}}};return oldPrepare(query);}};
    const d1Failure=await sources.onRequestPost({env,request:originalRequest('failed-d1')});assert.equal(d1Failure.status,503);assert.equal(objects.size,1);assert.equal(objects.has(keepKey),true);assert.equal(deleted.includes(keepKey),false);assert.equal(deleted.length,1);
    env.DB={prepare:oldPrepare};const retry=await saveOriginal(env,'failed-d1');assert.notEqual(retry.id,existing.id);assert.equal(objects.size,2);
  }finally{sql.close();}
});
test('snapshot preserves exact text, layout and position independently of mutable opportunities',async()=>{
  const {sql,env}=setup();try {
    const original=await saveOriginal(env);const body=snapshot('snapshot',{originalSourceId:original.id});
    Object.assign(body.resumeDocument.source,{format:'pdf',fileName:original.fileName,mimeType:original.mimeType,size:original.fileSize,sha256:original.sha256});
    body.resumeDocument.pages=[{page:1,width:612,height:792,rotation:0,coordinateSystem:'normalized-top-left'}];Object.assign(body.resumeDocument.blocks[0],{page:1,geometry:{x:.1,y:.2,width:.6,height:.1},rawTransform:[1,0,0,12,35,400]});
    const saved=await save(env,body);assert.equal(saved.hasOriginal,true);assert.equal(saved.hasText,true);assert.equal(saved.fileSize,original.fileSize);
    const text=await sources.onRequestGet({env,request:request('GET','alice',undefined,`/api/resume-sources?id=${saved.id}&format=text`)});assert.equal(await text.text(),sourceText);
    const json=await (await sources.onRequestGet({env,request:request('GET','alice',undefined,`/api/resume-sources?id=${saved.id}&format=json`)})).json();assert.deepEqual(json.resumeDocument,body.resumeDocument);assert.equal(json.jobContext,jobContext);assert.deepEqual(json.position,body.position);assert.equal(json.object_key,undefined);assert.equal(json.provenance.payloadSha256,saved.sha256);
    const originalDownload=await sources.onRequestGet({env,request:request('GET','alice',undefined,`/api/resume-sources?id=${saved.id}&format=original`)});assert.equal(await originalDownload.text(),'%PDF-1.7\nSynthetic scanned resume bytes');
    const retry=await save(env,{...body,position:{url:body.position.url,title:body.position.title,company:body.position.company}});assert.equal(retry.id,saved.id);
    const conflict=await sources.onRequestPost({env,request:request('POST','alice',{...body,targetRole:'Different role'})});assert.equal(conflict.status,409);assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM resume_sources WHERE source_kind='snapshot'").get().n,1);
  }finally{sql.close();}
});
test('layout validation rejects schema drift, duplicate block ids, invalid geometry and silent truncation',async()=>{
  const {sql,env}=setup();try {
    const mutations=[body=>body.resumeDocument.schemaVersion='unknown',body=>body.resumeDocument.text='different',body=>body.resumeDocument.blocks.push({...body.resumeDocument.blocks[0]}),body=>body.resumeDocument.blocks[0].page=88,body=>body.resumeDocument.blocks[0].geometry={x:0,y:0,width:1,height:1},body=>body.resumeDocument.blocks[0].rawTransform=[1,0,0,1,null,0],body=>body.resumeDocument.source.size=-1,body=>body.resumeDocument.source.sha256='bad',body=>body.resumeDocument.source.extractedAt='invalid',body=>body.resumeDocument.blocks[0].runs=[{id:'r1',text:'one',sourcePath:'paragraph[1]/run[1]'},{id:'r1',text:'two',sourcePath:'paragraph[1]/run[2]'}],body=>body.resumeText='x'.repeat(50001),body=>body.jobContext='x'.repeat(30001),body=>body.position=JSON.parse('{"constructor":"bad"}')];
    for(const mutate of mutations) {const body=snapshot();mutate(body);const r=await sources.onRequestPost({env,request:request('POST','alice',body)});assert.equal(r.status,400,await r.clone().text());}
    const oversized=snapshot();oversized.resumeDocument.padding='x'.repeat(1024*1024);assert.equal((await sources.onRequestPost({env,request:request('POST','alice',oversized)})).status,413);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM resume_sources').get().n,0);
  }finally{sql.close();}
});
test('file-backed layout must match original bytes; edited text can explicitly replace its layout',async()=>{
  const {sql,env}=setup();try {
    const original=await saveOriginal(env);const body=snapshot('matched',{originalSourceId:original.id});
    Object.assign(body.resumeDocument.source,{format:'pdf',fileName:original.fileName,mimeType:original.mimeType,size:original.fileSize,sha256:'0'.repeat(64)});
    assert.equal((await sources.onRequestPost({env,request:request('POST','alice',body)})).status,409);
    body.resumeDocument.source.sha256=original.sha256;const matched=await save(env,body);assert.equal(matched.hasOriginal,true);
    const edited=await save(env,snapshot('edited',{originalSourceId:original.id}));assert.equal(edited.hasOriginal,true);
  }finally{sql.close();}
});
test('logical nested runs survive JSON downloads and unsafe Unicode filenames are sanitized',async()=>{
  const {sql,env}=setup();try {
    const body=snapshot('runs',{resumeLabel:`CON: resume / \"student\" ${'😀'.repeat(60)} end`});
    body.resumeDocument.blocks[0].runs=[{id:'paragraph-1-run-1',text:sourceText,sourcePath:'document/paragraph[1]/run[1]',fontName:'Aptos',fontSize:11,bold:true,italic:false}];
    const saved=await save(env,body);
    const response=await sources.onRequestGet({env,request:request('GET','alice',undefined,`/api/resume-sources?id=${saved.id}&format=json`)});
    assert.equal(response.status,200);const disposition=response.headers.get('Content-Disposition');assert.match(disposition,/\.json/);assert.doesNotMatch(disposition,/[\r\n]/);assert.ok(decodeURIComponent(disposition.split("filename*=UTF-8''")[1]).endsWith('.json'));
    assert.deepEqual((await response.json()).resumeDocument.blocks[0].runs,body.resumeDocument.blocks[0].runs);
  }finally{sql.close();}
});
test('source and opportunity ownership cannot be forged when saving a snapshot',async()=>{
  const {sql,env}=setup();try {
    const original=await saveOriginal(env);
    const crossSource=await sources.onRequestPost({env,request:request('POST','bob',snapshot('cross',{originalSourceId:original.id}))});assert.equal(crossSource.status,404);
    const app=await apps.onRequestPost({env,request:request('POST','alice',{consent:true,consentVersion:'ferpa-minimum-necessary-v1',application:{id:'synthetic-job',title:'Engineer',company:'Example'}},'/api/applications')});assert.equal(app.status,200);const {id}=await app.json();
    assert.equal((await sources.onRequestPost({env,request:request('POST','bob',snapshot('cross-app',{opportunityId:id}))})).status,404);
    const own=await save(env,snapshot('own-app',{opportunityId:id}));assert.equal(own.opportunityId,id);
    assert.equal((await sources.onRequestGet({env,request:request('GET','bob',undefined,`/api/resume-sources?opportunityId=${id}`)})).status,404);
  }finally{sql.close();}
});
test('metadata pagination is bounded and complete without original bytes or raw text',async()=>{
  const {sql,env}=setup();try {
    for(let i=0;i<5;i++)await save(env,snapshot(`page-${i}`));
    const ids=[];let cursor=null;
    do {const response=await sources.onRequestGet({env,request:request('GET','alice',undefined,`/api/resume-sources?limit=2${cursor?'&cursor='+encodeURIComponent(cursor):''}`)});const page=await response.json();assert.ok(page.records.length<=2);assert.equal(page.records[0].resumeText,undefined);ids.push(...page.records.map(r=>r.id));cursor=page.nextCursor;}while(cursor);
    assert.equal(ids.length,5);assert.equal(new Set(ids).size,5);
    assert.equal((await sources.onRequestGet({env,request:request('GET','alice',undefined,'/api/resume-sources?limit=101')})).status,400);
    assert.equal((await sources.onRequestGet({env,request:request('GET','alice',undefined,'/api/resume-sources?cursor=invalid')})).status,400);
  }finally{sql.close();}
});
test('new text snapshots work without R2, including a scanned original awaiting text',async()=>{
  const {sql,env}=setup();try {
    const original=await saveOriginal(env);
    delete env.RESUME_FILES;
    const text=await save(env);assert.equal(text.hasOriginal,false);
    const scanned=await save(env,snapshot('scanned',{originalSourceId:original.id,resumeText:'',resumeDocument:document('')}));assert.equal(scanned.hasOriginal,true);assert.equal(scanned.hasText,false);assert.equal(scanned.extractionStatus,'needs_text');
    const r=await sources.onRequestGet({env,request:request('GET','alice',undefined,`/api/resume-sources?id=${original.id}&format=original`)});assert.equal(r.status,503);
  }finally{sql.close();}
});
test('analysis retains valid legacy input before missing AI configuration and reuses an explicit retry id',async()=>{
  const {sql,env}=setup();try {
    const body={requestId:'legacy-saved',resumeText:sourceText,targetRole:'Engineer',jobContext};
    for(let i=0;i<2;i++) {const r=await analyze.onRequestPost({env,request:request('POST','alice',body,'/api/analyze')});assert.equal(r.status,503);assert.ok((await r.json()).sourceId);}
    const rows=sql.prepare('SELECT * FROM resume_sources').all();assert.equal(rows.length,1);assert.equal(rows[0].resume_text,sourceText);assert.equal(rows[0].job_context,jobContext);
  }finally{sql.close();}
});
test('analysis uses the owned immutable snapshot; mismatches fail before provider work and provider failures preserve it',async()=>{
  const {sql,env}=setup();let calls=0;env.ARTIFICIAL_INTELLIGENCE_API_KEY='synthetic';
  const provider=mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('synthetic provider outage');});
  try {
    const saved=await save(env);
    const invoke=(user,body)=>analyze.onRequestPost({env,request:request('POST',user,body,'/api/analyze')});
    assert.equal((await invoke('bob',{sourceId:saved.id})).status,404);assert.equal((await invoke('alice',{sourceId:saved.id,resumeText:'different'})).status,409);assert.equal(calls,0);
    const failed=await invoke('alice',{sourceId:saved.id});assert.equal(failed.status,500);assert.equal((await failed.json()).sourceId,saved.id);assert.ok(calls>0);assert.equal(sql.prepare('SELECT resume_text FROM resume_sources WHERE id=?').get(saved.id).resume_text,sourceText);
  }finally{provider.mock.restore();sql.close();}
});
test('quota rejection preserves the source copy and never calls AI again',async()=>{
  const {sql,env}=setup();let calls=0;Object.assign(env,{ARTIFICIAL_INTELLIGENCE_API_KEY:'synthetic',DAILY_ANALYSIS_LIMIT:'1'});
  const provider=mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({output_text:JSON.stringify(analysis)});});
  try {
    const first=await save(env,snapshot('first'));const second=await save(env,snapshot('second'));
    assert.equal((await analyze.onRequestPost({env,request:request('POST','alice',{sourceId:first.id},'/api/analyze')})).status,200);
    const limited=await analyze.onRequestPost({env,request:request('POST','alice',{sourceId:second.id},'/api/analyze')});assert.equal(limited.status,429);assert.equal((await limited.json()).sourceId,second.id);assert.equal(calls,1);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM resume_sources').get().n,2);
  }finally{provider.mock.restore();sql.close();}
});
test('source-linked reviews are idempotent, preserve exact accepted context and do not delete the archive',async()=>{
  const {sql,env}=setup();try {
    const saved=await save(env);const body={sourceId:saved.id,consent:true,consentVersion:'workforce-resume-profile-v1',analysis,resumeText:sourceText,targetRole:'Software Engineer',jobContext,retainRawResumeText:false};
    const post=()=>reviews.onRequestPost({env,request:request('POST','alice',body,'/api/resume-records')});
    const first=await post();assert.equal(first.status,200,await first.clone().text());const record=await first.json();
    const repeated=await post();assert.equal(repeated.status,200);assert.equal((await repeated.json()).id,record.id);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM resume_records').get().n,1);
    const stored=sql.prepare('SELECT * FROM resume_records').get();assert.equal(stored.raw_resume_text,sourceText);assert.equal(stored.job_context,jobContext);assert.equal(stored.raw_resume_retained,1);
    const listing=await (await reviews.onRequestGet({env,request:request('GET','alice',undefined,'/api/resume-records')})).json();assert.equal(listing.records[0].sourceId,saved.id);assert.equal(listing.records[0].position.company,'Synthetic Company');
    const changed=await reviews.onRequestPost({env,request:request('POST','alice',{...body,analysis:{...analysis,score:9}},'/api/resume-records')});assert.equal(changed.status,409);
    await reviews.onRequestDelete({env,request:request('DELETE','alice',undefined,`/api/resume-records?id=${record.id}`)});
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM resume_records').get().n,0);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM resume_sources').get().n,1);
    assert.equal((await sources.onRequestGet({env,request:request('GET','alice',undefined,`/api/resume-sources?id=${saved.id}&format=text`)})).status,200);
  }finally{sql.close();}
});
