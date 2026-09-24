import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {prepareMigrations} from '../scripts/migration-plan.mjs';
const files=readdirSync(new URL('../migrations/',import.meta.url)).sort().map(name=>({name,sql:readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')}));
for(const variant of ['fresh','legacy','current']) test(`migration plan upgrades ${variant} without data loss`,()=>{
 const db=new DatabaseSync(':memory:');
 try{
  if(variant!=='fresh') {
   for(const f of files.slice(0,2)) db.exec(variant==='legacy'?f.sql.replace('  salary TEXT,','').replace(/  (email_domain|email_domain_type|country) TEXT,\r?\n/g,'').replace(/CREATE INDEX IF NOT EXISTS idx_users_(email_domain_type|country)[\s\S]*?;/g,''):f.sql);
   db.exec("INSERT INTO users(id,client_hash,created_at,last_seen_at) VALUES('existing','hash','now','now')");
  }
  const schema={application_captures:db.prepare('PRAGMA table_info(application_captures)').all(),users:db.prepare('PRAGMA table_info(users)').all()};
  const plan=prepareMigrations(files,schema);
  for(const f of plan.slice(variant==='fresh'?0:2)) db.exec(f.sql);
  assert.ok(db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='workos_user_id'));
  assert.ok(db.prepare('PRAGMA table_info(application_captures)').all().some(c=>c.name==='salary'));
  assert.ok(db.prepare('PRAGMA table_info(resume_records)').all().some(c=>c.name==='resume_label'));
  if(variant!=='fresh') assert.equal(db.prepare('SELECT count(*) AS n FROM users WHERE id=?').get('existing').n,1);
  assert.deepEqual(plan.map(f=>f.name),files.map(f=>f.name));
  assert.equal(plan[0].sql,files[0].sql);assert.equal(plan[1].sql,files[1].sql);
 }finally{db.close()}
});
test('incompatible existing column aborts planning',()=>{
 assert.throws(()=>prepareMigrations(files,{application_captures:[{name:'salary',type:'INTEGER'}],users:[]}),/salary/);
});
