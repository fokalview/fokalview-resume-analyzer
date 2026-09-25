import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// Only the external WorkOS service is replaced. Production auth and SQL run unchanged.
mock.module('@workos-inc/node', { exports: { WorkOS: class {
  userManagement = { loadSealedSession: ({sessionData}) => ({authenticate: async () => {
    if (sessionData === 'service-error') throw new Error('Unavailable');
    if (!['alice','bob','unverified'].includes(sessionData)) return {authenticated:false};
    return {authenticated:true,user:{id:sessionData,email:`${sessionData}@example.test`,emailVerified:sessionData!=='unverified'}};
  }}) };
}}});
const apps = await import('../functions/api/applications.js');
const resumes = await import('../functions/api/resume-records.js');
const me = await import('../functions/api/me.js');
const analyze = await import('../functions/api/analyze.js');
const session = await import('../functions/api/auth/session.js');
const { readIdentity } = await import('../functions/api/identity.js');

function setup() {
 const sql=new DatabaseSync(':memory:');
 for(const f of readdirSync(new URL('../migrations/',import.meta.url)).sort()) {
  // Historical duplicate columns are covered separately by migration tests.
  if (f.startsWith('0003_') || f.startsWith('0004_')) continue;
  sql.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 }
 const DB={prepare(query){return {bind(...args){return {async run(){return sql.prepare(query).run(...args)},async first(){return sql.prepare(query).get(...args)},async all(){return {results:sql.prepare(query).all(...args)}}}},async all(){return {results:sql.prepare(query).all()}}}}};
 return {sql,env:{DB,BETA_ACCESS_CODE:'beta',APPLICATION_SYNC_SALT:'test-only',WORKOS_API_KEY:'test',WORKOS_CLIENT_ID:'test',WORKOS_COOKIE_PASSWORD:'test'}};
}
function request(method='GET', user='', body, extra={}) {
 return new Request('https://example.test/api/applications',{method,headers:{'Content-Type':'application/json',...(user?{Cookie:`wos-session=${user}`} : {}),...extra},...(body?{body:JSON.stringify(body)}:{})});
}
const job=(id='same-job',title='Engineer')=>({consent:true,consentVersion:'ferpa-minimum-necessary-v1',application:{id,title,company:'Example',notes:'private'}});

test('claimed email and shared beta code do not establish identity',async()=>{
 const {env,sql}=setup();
 try {assert.equal(await readIdentity(request('GET','',undefined,{'X-Beta-Access-Code':'beta','X-FokalView-User-Email':'alice@example.test'}),env),null)} finally {sql.close()}
});
for(const [name,handler,method] of [['apps GET',apps.onRequestGet,'GET'],['apps POST',apps.onRequestPost,'POST'],['apps PATCH',apps.onRequestPatch,'PATCH'],['apps DELETE',apps.onRequestDelete,'DELETE'],['resumes GET',resumes.onRequestGet,'GET'],['resumes POST',resumes.onRequestPost,'POST'],['resumes DELETE',resumes.onRequestDelete,'DELETE'],['me',me.onRequestGet,'GET'],['analysis',analyze.onRequestPost,'POST']]) {
 test(`${name} denies beta-only, missing-config, invalid and unavailable sessions`,async()=>{
  const {env,sql}=setup();
  try {
   for(const cookie of ['', 'invalid', 'service-error', 'unverified']) {
    const r=await handler({request:request(method,cookie,method==='POST'?job():undefined,{'X-Beta-Access-Code':'beta','X-FokalView-User-Email':'alice@example.test'}),env});
    assert.ok([401,503].includes(r.status),`${cookie}: ${r.status}`);
   }
   const r=await handler({request:request(method),env:{DB:env.DB}});
   assert.ok([401,503].includes(r.status));
  }finally{sql.close()}
 });
}
test('same job is independent per user; forged id cannot mutate another owner',async()=>{
 const {env,sql}=setup();
 try {
  const save=async(user,body)=>{const r=await apps.onRequestPost({request:request('POST',user,body),env});assert.equal(r.status,200,await r.clone().text());return r.json()};
  const a=await save('alice',job());const b=await save('bob',job());
  assert.notEqual(a.id,b.id);
  await save('bob',job(a.id,'Forged'));
  assert.equal(sql.prepare('SELECT title FROM application_captures WHERE id=?').get(a.id).title,'Engineer');
  const repeat=await save('alice',job());assert.equal(repeat.id,a.id);
  const update=await save('alice',job(a.id,'Updated'));assert.equal(update.id,a.id);
  const r=await apps.onRequestGet({request:request('GET','alice'),env});const data=await r.json();
  assert.equal(data.applications.length,1);assert.equal(data.applications[0].title,'Updated');
  const spoof=await apps.onRequestGet({request:request('GET','bob',undefined,{'X-FokalView-User-Email':'alice@example.test'}),env});
  assert.ok((await spoof.json()).applications.every(a=>a.id!==update.id));
 }finally{sql.close()}
});
test('legacy owned ids remain updatable and cross-user patch/delete do not modify them',async()=>{
 const {env,sql}=setup();
 try {
  const r=await apps.onRequestPost({request:request('POST','alice',job()),env});const saved=await r.json();
  sql.prepare('UPDATE application_captures SET id=? WHERE id=?').run('legacy-job',saved.id);
  const update=await apps.onRequestPost({request:request('POST','alice',job('legacy-job','Updated legacy')),env});assert.equal(update.status,200);
  assert.equal((await update.json()).id,'legacy-job');
  await apps.onRequestPatch({request:request('PATCH','bob',{id:'legacy-job',status:'Rejected'}),env});
  const del=new Request('https://example.test/api/applications?id=legacy-job',{method:'DELETE',headers:{Cookie:'wos-session=bob'}});
  await apps.onRequestDelete({request:del,env});
  assert.equal(sql.prepare('SELECT status FROM application_captures WHERE id=?').get('legacy-job').status,'Interested');
 }finally{sql.close()}
});

const analysisFixture = {
 score: 70, summary: 'Synthetic test review',
 profile: {currentTitle:'Engineer', skills:{technical:['Go','C#'],tools:['SQL'],soft:[]},
   workHistory:[{title:'Engineer',company:'Example',highlights:['Built services']}],
   education:[{institution:'Example',credential:'BS',field:'Computing'}]},
 jobDetails:{title:'Engineer',company:'Example',sourceUrl:'https://example.test/job'},
 jobQualifications:{requiredSkills:['Go','C#']},
 scoreAudit:{verdict:'reasonable',confidence:80,expectedMin:60,expectedMax:90,flags:[]},
 orchestration:{provider:'synthetic',stages:['test']},
 strengths:['Built services'],improvements:[{title:'Evidence',detail:'Add impact',priority:'High'}],
 keywordAnalysis:{matched:['Go'],missing:['C#']},sections:[{name:'Skills',score:70,note:'Evidence'}]
};

test('verified resume CRUD preserves consent and separates owners',async()=>{
 const {env,sql}=setup();
 try {
  const body={consent:true,consentVersion:'workforce-resume-profile-v1',analysis:analysisFixture,
   resumeText:'Private synthetic resume',retainRawResumeText:false,targetRole:'Engineer'};
  const denied=await resumes.onRequestPost({request:request('POST','alice',{...body,consent:false}),env});
  assert.equal(denied.status,400);
  const saved=await resumes.onRequestPost({request:request('POST','alice',body),env});
  assert.equal(saved.status,200,await saved.clone().text());const {id}=await saved.json();
  const list=async user=>(await (await resumes.onRequestGet({request:request('GET',user),env})).json()).records;
  const records=await list('alice');assert.equal(records.length,1);assert.equal(records[0].rawResumeRetained,false);
  assert.equal(records[0].profile.currentTitle,'Engineer');assert.equal((await list('bob')).length,0);
  assert.equal(sql.prepare('SELECT raw_resume_text FROM resume_records WHERE id=?').get(id).raw_resume_text,'');
  const remove=user=>resumes.onRequestDelete({request:new Request(`https://example.test/api/resume-records?id=${id}`,{method:'DELETE',headers:{Cookie:`wos-session=${user}`}}),env});
  await remove('bob');assert.equal((await list('alice')).length,1);
  await remove('alice');assert.equal((await list('alice')).length,0);
  const own=await me.onRequestGet({request:request('GET','alice'),env});
  assert.equal((await own.json()).verified,true);
 }finally{sql.close()}
});

test('opportunity analysis survives save, update and read with canonical id',async()=>{
 const {env,sql}=setup();
 try {
  const body=job();Object.assign(body.application,{latestAnalysis:analysisFixture,
   jobQualifications:analysisFixture.jobQualifications,url:'https://example.test/job#section'});
  const saved=await apps.onRequestPost({request:request('POST','alice',body),env});
  assert.equal(saved.status,200);const {id}=await saved.json();
  assert.equal((await apps.onRequestPatch({request:request('PATCH','alice',{id,status:'Applied'}),env})).status,200);
  const {applications}=await (await apps.onRequestGet({request:request('GET','alice'),env})).json();
  assert.equal(applications[0].latestAnalysis.score,70);assert.equal(applications[0].status,'Applied');
  assert.equal(applications[0].url,'https://example.test/job');
  assert.equal(applications[0].analysisCount,1);
 }finally{sql.close()}
});

function outputForSchema(schema) {
 if(schema.type==='object') return Object.fromEntries(Object.entries(schema.properties).map(([k,v])=>[k,outputForSchema(v)]));
 if(schema.type==='array') return Array.from({length:schema.minItems || 0},()=>outputForSchema(schema.items));
 if(schema.type==='string') return schema.enum?.[0] || '';
 return schema.minimum || 0;
}

test('staged analysis validates provider contracts and enforces quota per review',async()=>{
 const {env,sql}=setup();let calls=0;const names=[];
 const provider=mock.method(globalThis,'fetch',async(_url,options)=>{
  calls++;const input=JSON.parse(options.body);names.push(input.text.format.name);
  const value=outputForSchema(input.text.format.schema);
  if(input.text.format.name==='job_extraction')value.jobQualifications.requiredSkills=['Go'];
  return Response.json({output_text:JSON.stringify(value)});
 });
 Object.assign(env,{ARTIFICIAL_INTELLIGENCE_API_KEY:'synthetic',DAILY_ANALYSIS_LIMIT:'1'});
 try {
  const body={resumeText:'Built Go services and C# applications. '.repeat(12),targetRole:'Engineer',jobContext:'Go engineer'};
  const short=await analyze.onRequestPost({request:request('POST','alice',{resumeText:'short'}),env});assert.equal(short.status,400);assert.equal(calls,0);
  const success=await analyze.onRequestPost({request:request('POST','alice',body),env});
  assert.equal(success.status,200,await success.clone().text());const output=await success.json();
  assert.equal(output.sections[0].score,100);assert.equal(output.orchestration.provider,'openai');
  assert.deepEqual(names,['job_extraction','profile_extraction','opportunity_review','report_writing']);
  assert.equal(success.headers.get('X-RateLimit-Remaining'),'0');
  const limited=await analyze.onRequestPost({request:request('POST','alice',body),env});assert.equal(limited.status,429);assert.equal(calls,4);
 }finally{provider.mock.restore();sql.close()}
});

test('Workers AI staged review keeps score when the writer fails',async()=>{
 const {env,sql}=setup();let calls=0;
 env.AI={async run(_model,input){calls++;if(calls===4)throw new Error('Writer unavailable');
 const prompt=input.messages[1].content;const schema=JSON.parse(prompt.slice(prompt.lastIndexOf('JSON schema: ')+13));
 const value=outputForSchema(schema);if(calls===1)value.jobQualifications.requiredSkills=['Go'];return {response:value};}};
 try {
  const r=await analyze.onRequestPost({request:request('POST','alice',{resumeText:'Built Go services. '.repeat(20),jobContext:'Go engineer'}),env});
  assert.equal(r.status,200,await r.clone().text());const output=await r.json();assert.equal(output.sections[0].score,100);
  assert.ok(output.orchestration.stages.includes('report-writing-fallback'));
 }finally{sql.close()}
});

test('session links existing email-owned records without changing candidate identity',async()=>{
 const {env,sql}=setup();
 try {
  const saved=await apps.onRequestPost({request:request('POST','alice',job()),env});
  assert.equal(saved.status,200);
  const before=sql.prepare('SELECT id,candidate_id FROM users').get();
  sql.exec("UPDATE users SET workos_user_id=NULL, auth_provider=NULL, verified_at=NULL");
  const result=await session.onRequestGet({request:request('GET','alice'),env});
  assert.equal(result.status,200);const identity=await result.json();
  assert.equal(identity.userId,before.id);assert.equal(identity.candidateId,before.candidate_id);
  assert.equal((await (await apps.onRequestGet({request:request('GET','alice'),env})).json()).applications.length,1);
  assert.equal((await session.onRequestGet({request:request('GET','unverified'),env})).status,401);
  assert.equal((await session.onRequestGet({request:request('GET','alice'),env:{...env,DB:undefined}})).status,503);
 }finally{sql.close()}
});
