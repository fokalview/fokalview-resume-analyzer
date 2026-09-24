import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// Only the external WorkOS service is replaced. Production auth and SQL run unchanged.
mock.module('@workos-inc/node', { namedExports: { WorkOS: class {
  userManagement = { loadSealedSession: ({sessionData}) => ({authenticate: async () => {
    if (sessionData === 'service-error') throw new Error('Unavailable');
    if (!['alice','bob'].includes(sessionData)) return {authenticated:false};
    return {authenticated:true,user:{id:sessionData,email:`${sessionData}@example.test`,emailVerified:true}};
  }}) };
}}});
const apps = await import('../functions/api/applications.js');
const resumes = await import('../functions/api/resume-records.js');
const me = await import('../functions/api/me.js');
const analyze = await import('../functions/api/analyze.js');
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
   for(const cookie of ['', 'invalid', 'service-error']) {
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
