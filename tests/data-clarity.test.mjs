import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { prepareMigrations } from '../scripts/migration-plan.mjs';
import { onRequestGet as summary } from '../functions/api/admin/summary.js';
import { onRequestPost as followup } from '../functions/api/follow-up.js';
import { onRequestPost as signup } from '../functions/api/waitlist.js';
import { csvForRecords } from '../src/lib/waitlistExport.js';

function setup() {
  const sql = new DatabaseSync(':memory:');
  const directory = new URL('../migrations/', import.meta.url);
  const files = readdirSync(directory).filter(name => name.endsWith('.sql')).sort().map(name => ({ name, sql: readFileSync(new URL(name, directory), 'utf8') }));
  for (const file of prepareMigrations(files, { application_captures: [], users: [] })) sql.exec(file.sql);
  const statement = (query, args = []) => ({
    bind(...values) { return statement(query, values); },
    async run() { return sql.prepare(query).run(...args); },
    async first() { return sql.prepare(query).get(...args) || null; },
    async all() { return { results: sql.prepare(query).all(...args) }; }
  });
  return { sql, env: { DB: { prepare: statement }, ADMIN_ACCESS_CODE: 'synthetic-admin', APPLICATION_SYNC_SALT: 'synthetic-only' } };
}
const post = body => new Request('https://example.test/api/form', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
async function read(env) {
  const response = await summary({env, request:new Request('https://example.test/api/admin/summary', {headers:{'X-Admin-Access-Code':'synthetic-admin'}})});
  assert.equal(response.status,200,await response.clone().text());
  return response.json();
}
function addSignup(sql, id, email, leadId=id) {
  sql.prepare('INSERT INTO waitlist_signups (id,name,email,email_hash,lead_id,interview_interest,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
    .run(id,id,email,`opaque-${email}`,leadId,'2026-10-01','2026-10-01');
}
const newSignup = overrides => ({ name:'Synthetic Person',email:'person@example.test',userType:'Student',country:'United States',state:'MA',biggestChallenge:'Interview preparation', ...overrides });

test('both public endpoints reject excessively nested or non-plain snapshots before any write', async () => {
  const {sql,env}=setup();
  try {
    const before=Object.fromEntries(['waitlist_signups','waitlist_followups','platform_id_counters'].map(table=>[table,sql.prepare(`SELECT * FROM ${table}`).all()]));
    const nested='{"email":"person@example.test","extra":'+ '{"value":'.repeat(4500) + 'null' + '}'.repeat(4500) + '}';
    assert.ok(nested.length<64000);
    for (const handler of [signup,followup]) {
      const response=await handler({env,request:new Request('https://example.test/api/form',{method:'POST',headers:{'Content-Type':'application/json'},body:nested})});
      assert.equal(response.status,400); assert.match((await response.json()).error,/too complex/);
      for(const invalid of [[], new Date(), {email:'person@example.test',extra:new Map()}, JSON.parse('{"email":"person@example.test","extra":{"__proto__":{"unsafe":true}}}')]) {
        const rejected=await handler({env,request:{json:async()=>invalid}});
        assert.equal(rejected.status,400);
      }
    }
    for(const [table,rows] of Object.entries(before)) assert.deepEqual(sql.prepare(`SELECT * FROM ${table}`).all(),rows);
  } finally {sql.close();}
});

test('neutral referral stays missing and full state names derive regions without rewriting the supplied location', async () => {
  const {sql,env}=setup();
  try {
    const states=[['Massachusetts','Northeast - MA'],['California','West - CA'],['District of Columbia','South - DC'],['NY','Northeast - NY']];
    for(const [state,region] of states) {
      const response=await signup({env,request:post(newSignup({state,referralSource:''}))});
      assert.equal(response.status,200,await response.clone().text());
      const {id}=await response.json();
      const row=sql.prepare('SELECT state,workforce_region,referral_source,intake_details_json FROM waitlist_signups WHERE id=?').get(id);
      assert.equal(row.state,state); assert.equal(row.workforce_region,region); assert.equal(row.referral_source,'');
      assert.equal(JSON.parse(row.intake_details_json).originalAnswers.state,state);
    }
    const data=await read(env);
    assert.deepEqual(data.waitlistReferralSources,[{label:'Not provided',count:4}]);
  } finally {sql.close();}
});

test('trusted signup hash aliases link historic and readable records without allowing responses to merge people', async () => {
  const {sql,env}=setup();
  try {
    addSignup(sql,'old',null,'L1'); addSignup(sql,'new','same@example.test','L2');
    sql.prepare('UPDATE waitlist_signups SET email_hash=?').run('shared-signup-hash');
    const response=await followup({env,request:post({email:'same@example.test',leadId:'L1',applicationCount:2})});
    assert.equal(response.status,200,await response.clone().text());
    const data=await read(env);
    assert.equal(data.totals.uniqueWaitlistContacts,1);
    assert.equal(data.totals.waitlistContactsWithFollowUp,1);
    assert.deepEqual(data.recentFollowUps[0].matchedSignupIds.sort(),['new','old']);
    assert.equal(sql.prepare('SELECT email FROM waitlist_signups WHERE id=?').get('old').email,null);
  } finally {sql.close();}
});

test('contradictory known emails sharing a saved signup hash stay separate and ambiguous references are rejected', async () => {
  const {sql,env}=setup();
  try {
    addSignup(sql,'lead-a','a@example.test'); addSignup(sql,'lead-b','b@example.test');
    sql.prepare('UPDATE waitlist_signups SET email_hash=?').run('contradictory-saved-hash');
    assert.equal((await read(env)).totals.uniqueWaitlistContacts,2);
    const response=await followup({env,request:post({email:'a@example.test',leadId:'lead-b'})});
    assert.equal(response.status,400);
    assert.equal(sql.prepare('SELECT count(*) n FROM waitlist_followups').get().n,0);
    assert.equal((await read(env)).totals.uniqueWaitlistContacts,2);
  } finally {sql.close();}
});

test('conflicting public references are rejected without leaking or merging saved contacts', async () => {
  const {sql,env}=setup();
  try {
    addSignup(sql,'lead-a','a@example.test'); addSignup(sql,'lead-b','b@example.test');
    for (const body of [{email:'a@example.test',leadId:'lead-b'}, {email:'unrecognized@example.test',leadId:'lead-a'}]) {
      const response=await followup({env,request:post(body)});
      assert.equal(response.status,400);
      const error=await response.text();
      assert.match(error,/references do not agree/); assert.ok(!error.includes('@example.test'));
    }
    assert.equal(sql.prepare('SELECT count(*) n FROM waitlist_followups').get().n,0);
    assert.equal((await read(env)).totals.uniqueWaitlistContacts,2);
  } finally {sql.close();}
});

test('historic conflicting responses stay visible for review without contaminating coverage or outcomes', async () => {
  const {sql,env}=setup();
  try {
    addSignup(sql,'lead-a','a@example.test'); addSignup(sql,'lead-b','b@example.test');
    sql.prepare('INSERT INTO waitlist_followups (id,email,lead_id,application_count,placement_status,submitted_at) VALUES (?,?,?,?,?,?)').run('conflict','a@example.test','lead-b',900,'Placed','2026-10-02');
    const data=await read(env);
    assert.equal(data.totals.uniqueWaitlistContacts,2);
    assert.equal(data.totals.waitlistContactsWithFollowUp,0);
    assert.equal(data.totals.followUpApplications,0);
    assert.equal(data.totals.followUpPlacements,0);
    assert.equal(data.meta.dataQuality.ambiguousFollowUpResponses,1);
    assert.equal(data.recentFollowUps[0].identityMatchStatus,'needs_review');
    assert.deepEqual(data.recentFollowUps[0].matchedSignupIds,[]);
    assert.equal(data.recentFollowUps[0].applicationCount,900);
    assert.ok(data.recentWaitlistSignups.every(item=>item.linkedFollowUps.length===0));
    assert.equal(sql.prepare('SELECT application_count FROM waitlist_followups').get().application_count,900);
  } finally {sql.close();}
});

test('public verification claims stay visible but cannot create an attested outcome', async () => {
  const {sql,env}=setup();
  try {
    const response=await followup({env,request:post({email:'person@example.test',verificationStatus:'Employer verified',dataSource:'Employer upload',salaryAmount:'25.75',salaryCurrency:'USD',salaryPeriod:'Hourly'})});
    assert.equal(response.status,200,await response.clone().text());
    const stored=sql.prepare('SELECT * FROM waitlist_followups').get();
    assert.equal(stored.verification_status,'Self-reported'); assert.equal(stored.salary_amount,25.75);
    const item=(await read(env)).recentFollowUps[0];
    assert.equal(item.salaryAmount,25.75); assert.equal(item.verificationClaim,'Employer verified');
    assert.equal(item.verificationEvidenceStatus,'Unverified self-report');
    assert.equal(item.responseDetails.originalAnswers.verificationStatus,'Employer verified');
    assert.equal(item.dataSource,'Employer upload');
  } finally {sql.close();}
});

test('strict numeric validation rejects malformed, fractional count, negative and infinite values', async () => {
  const {sql,env}=setup();
  try {
    for (const body of [{}, {applicationCount:'12junk'},{applicationCount:'1.5'},{interviewCount:-1},{offerCount:1000},{salaryAmount:'25.755'},{salaryAmount:'Infinity'},{salaryAmount:'0x10'},{salaryAmount:'1e5'},{salaryAmount:'$25'}]) {
      const payload=Object.keys(body).length?{email:'person@example.test',...body}:body;
      const response=await followup({env,request:post(payload)});
      assert.equal(response.status,400,JSON.stringify(payload));
    }
    assert.equal(sql.prepare('SELECT count(*) n FROM waitlist_followups').get().n,0);
  } finally {sql.close();}
});

test('new unknown counts and compensation units remain distinct from an explicitly reported zero', async () => {
  const {sql,env}=setup();
  try {
    for(const [email,body] of [['unknown@example.test',{applicationCount:'',salaryAmount:''}],['zero@example.test',{applicationCount:0,interviewCount:0,offerCount:0,salaryAmount:0}]]) {
      assert.equal((await followup({env,request:post({email,...body})})).status,200);
    }
    const data=await read(env);
    const unknown=data.recentFollowUps.find(item=>item.email==='unknown@example.test');
    const zero=data.recentFollowUps.find(item=>item.email==='zero@example.test');
    assert.equal(unknown.applicationCount,null); assert.equal(unknown.salaryAmount,null);
    assert.equal(zero.applicationCount,0); assert.equal(zero.salaryAmount,0); assert.equal(zero.salaryPeriod,'');
    assert.equal(data.meta.dataQuality.followUpsWithMissingCounts,1);
    assert.equal(data.salaryByPeriod[0].average,null);
  } finally {sql.close();}
});

test('inactive branch drafts are retained while employer and workforce reporting use the selected branch', async () => {
  const {sql,env}=setup();
  try {
    const employer=await signup({env,request:post(newSignup({userType:'Employer / Hiring Partner',organization:'Example Company',schoolName:'Old school',degreeProgram:'Old degree',gpa:'invalid inactive draft',hiringVolume:'1-10',branchDrafts:{Student:{gpa:'invalid inactive draft'}}}))});
    assert.equal(employer.status,200,await employer.clone().text());
    const workforce=await signup({env,request:post(newSignup({email:'workforce@example.test',userType:'Workforce / Gov / Nonprofit',organization:'Example Program',degreeProgram:'Old degree',programType:'Apprenticeship'}))});
    assert.equal(workforce.status,200,await workforce.clone().text());
    const data=await read(env);
    assert.deepEqual(data.waitlistSchools,[]);
    assert.equal(data.recentWaitlistSignups.find(item=>item.userType.startsWith('Workforce')).programName,'Apprenticeship');
    const item=data.recentWaitlistSignups.find(item=>item.userType.startsWith('Employer'));
    assert.equal(item.gpa,null); assert.equal(item.schoolName,'');
    assert.equal(item.intakeDetails.originalAnswers.schoolName,'Old school');
    assert.equal(item.intakeDetails.originalAnswers.branchDrafts.Student.gpa,'invalid inactive draft');
  } finally {sql.close();}
});

test('activity rates compare paired known counts and never mix different missing-data populations', async () => {
  const {sql,env}=setup();
  try {
    for(const body of [
      {email:'complete@example.test',applicationCount:10,interviewCount:2,offerCount:1},
      {email:'unknown-applications@example.test',applicationCount:'',interviewCount:20,offerCount:''}
    ]) assert.equal((await followup({env,request:post(body)})).status,200);
    const data=await read(env);
    const interviews=data.decisionSignals.find(item=>item.label==='Interview activity rate');
    const offers=data.decisionSignals.find(item=>item.label==='Offer activity rate');
    assert.equal(interviews.value,20); assert.equal(interviews.denominator,10);
    assert.equal(offers.value,50); assert.equal(offers.denominator,2);
    assert.match(interviews.detail,/1 incomplete reports excluded/);
  } finally {sql.close();}
});

test('all aggregate categories and original scoring factors remain available beyond prior caps', async () => {
  const {sql,env}=setup();
  try {
    for(let i=0;i<65;i++) {
      addSignup(sql,`lead-${i}`,`person${i}@example.test`);
      sql.prepare('UPDATE waitlist_signups SET school_name=?,user_type=?,score_breakdown_json=? WHERE id=?').run(`School ${i}`,'Student',JSON.stringify([{label:'Discovery',points:10},{label:'Pilot',points:20}]),`lead-${i}`);
    }
    const profile={skills:{technical:Array.from({length:65},(_,i)=>`Skill ${i}`),tools:Array.from({length:65},(_,i)=>`Tool ${i}`)},workHistory:[],education:[]};
    const analysis={score:80,keywordAnalysis:{missing:Array.from({length:65},(_,i)=>`Gap ${i}`),matched:[]}};
    sql.prepare('INSERT INTO resume_records (id,client_hash,profile_json,analysis_json,consent_version,captured_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('resume','opaque',JSON.stringify(profile),JSON.stringify(analysis),'test','2026-10-01','2026-10-01');
    const data=await read(env);
    assert.equal(data.waitlistSchools.length,65); assert.equal(data.topSkills.length,65); assert.equal(data.topTools.length,65);
    assert.equal(Object.values(data.commonSkillGaps).flat().length,65);
    assert.equal(data.recentWaitlistSignups[0].scoreBreakdown.length,2);
    assert.match(csvForRecords(data.recentWaitlistSignups),/Discovery/);
    assert.equal(data.meta.categoryScope,'All categories');
  } finally {sql.close();}
});

test('session denominators and empty decision states explain unavailable measurements', async () => {
  const {sql,env}=setup();
  try {
    const empty=await read(env);
    assert.ok(empty.decisionSignals.every(item=>item.dataStatus==='no-data'&&item.severity==='neutral'));
    for(const [id,duration] of [['empty',0],['measured',120]]) sql.prepare('INSERT INTO user_events (id,event_type,session_id,duration_seconds,created_at) VALUES (?,?,?,?,?)').run(id,'session_completed',id,duration,'2026-10-01');
    const data=await read(env);
    assert.equal(data.totals.sessions,2); assert.equal(data.totals.measuredSessions,1); assert.equal(data.totals.unmeasuredSessions,1);
    assert.equal(data.totals.averageSessionSeconds,120);
    assert.equal(data.meta.sessionMeasurement.measuredSessions,1);
    assert.match(data.decisionSignals.find(item=>item.label==='Observed engagement').detail,/1 of 2 sessions/);
  } finally {sql.close();}
});

test('all 32 observed production-only columns survive writes and protected detail/export without exposing auth fields', async () => {
  const {sql,env}=setup();
  try {
    const extras={
      application_captures:['applied_at','interview_at','offer_at','accepted_at','rejected_at','last_status_change_at','salary_range','offer_amount'],
      resume_records:['source_campaign','job_search_stage','readiness_band','report_downloaded_at'],
      users:['first_seen_at','last_active_at','source','campaign','pilot_cohort','activation_status','resume_analysis_count','opportunities_saved_count','applications_tracked_count','reports_downloaded_count'],
      waitlist_signups:['campaign','referral_channel','handshake_post_id','job_search_stage','urgency_level','intended_use','pilot_cohort','activation_status','first_analysis_completed_at','last_active_at']
    };
    assert.equal(Object.values(extras).flat().length,32);
    for(const [table,fields] of Object.entries(extras)) for(const field of fields) sql.exec(`ALTER TABLE ${table} ADD COLUMN ${field} ${field.endsWith('_count')?'INTEGER NOT NULL DEFAULT 0':'TEXT'}`);
    sql.prepare('INSERT INTO users (id,client_hash,created_at,last_seen_at) VALUES (?,?,?,?)').run('user','do-not-export-client-hash','2026-10-01','2026-10-01');
    sql.exec("ALTER TABLE users ADD COLUMN synthetic_auth_secret TEXT");
    sql.exec("UPDATE users SET synthetic_auth_secret='do-not-export-secret'");
    const profile={skills:{technical:[],tools:[]},workHistory:[],education:[]};
    sql.prepare('INSERT INTO resume_records (id,user_id,client_hash,profile_json,analysis_json,consent_version,captured_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run('resume','user','opaque',JSON.stringify(profile),JSON.stringify({score:80,keywordAnalysis:{missing:[]}}),'test','2026-10-01','2026-10-01');
    sql.prepare('INSERT INTO application_captures (id,user_id,client_hash,title,company,status,consent_version,captured_at,updated_at,synced_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run('app','user','opaque','Engineer','Example','Saved','test','2020-01-01','2026-11-04','2026-11-04');
    addSignup(sql,'historic','historic@example.test');
    for(const [table,fields] of Object.entries(extras)) for(const field of fields) sql.prepare(`UPDATE ${table} SET ${field}=?`).run(field.endsWith('_count')?7:`original-${field}`);
    const before=Object.fromEntries(Object.keys(extras).map(table=>[table,sql.prepare(`SELECT * FROM ${table}`).all()]));
    assert.equal((await signup({env,request:post(newSignup())})).status,200);
    assert.equal((await followup({env,request:post({email:'person@example.test',applicationCount:0})})).status,200);
    for(const [table,rows] of Object.entries(before)) for(const row of rows) assert.deepEqual(sql.prepare(`SELECT * FROM ${table} WHERE id=?`).get(row.id),row);
    const data=await read(env);
    const envelopes={users:data.recentResumeRecords[0].userRetainedFields,resume_records:data.recentResumeRecords[0].retainedFields,application_captures:data.applicationRecords[0].retainedFields,waitlist_signups:data.recentWaitlistSignups.find(item=>item.id==='historic').retainedFields};
    for(const [table,fields] of Object.entries(extras)) for(const field of fields) assert.equal(envelopes[table][field],field.endsWith('_count')?7:`original-${field}`);
    const serialized=JSON.stringify(data);
    assert.ok(!serialized.includes('do-not-export-secret')); assert.ok(!serialized.includes('do-not-export-client-hash'));
    assert.match(csvForRecords(data.applicationRecords),/original-offer_amount/);
    const momentum=data.decisionSignals.find(item=>item.label==='Application momentum');
    assert.equal(momentum.unit,'open over 14 days'); assert.match(momentum.action,/does not measure inactivity/);
  } finally {sql.close();}
});
