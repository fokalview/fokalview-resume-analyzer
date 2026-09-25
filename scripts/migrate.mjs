import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {prepareMigrations} from './migration-plan.mjs';

// Native Wrangler applies each staged migration and maintains d1_migrations.
// There is deliberately no remote write path in this repair utility.
if (process.argv.slice(2).some(arg => arg !== '--local')) throw new Error('Only --local is supported. See docs/MIGRATIONS.md for production preparation.');
const root=resolve(import.meta.dirname,'..');
const wrangler=resolve(root,'node_modules/wrangler/bin/wrangler.js');
const config=resolve(root,'wrangler.local.toml');
const persist=resolve(root,'.wrangler/state');
function run(args,json=false) {
 const r=spawnSync(process.execPath,[wrangler,...args],{cwd:root,encoding:'utf8',stdio:json?'pipe':'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 if(r.error) throw r.error;
 if(r.status!==0) throw new Error(json?r.stderr||r.stdout:'Wrangler migration failed');
 return json?JSON.parse(r.stdout):null;
}
const schema={};
for(const table of ['application_captures','users']) {
 const result=run(['d1','execute','DB','--local','--config',config,'--persist-to',persist,'--command',`PRAGMA table_info(${table})`,'--json'],true);
 schema[table]=result.flatMap(item=>item.results||[]);
}
const files=readdirSync(join(root,'migrations')).filter(name=>name.endsWith('.sql')).sort().map(name=>({name,sql:readFileSync(join(root,'migrations',name),'utf8')}));
const plan=prepareMigrations(files,schema);
const stage=mkdtempSync(join(tmpdir(),'sagittaiq-migrations-'));
try {
 for(const f of plan) writeFileSync(join(stage,f.name),f.sql);
 const stagingConfig=join(stage,'wrangler.toml');
 const base=readFileSync(config,'utf8').replace(/pages_build_output_dir\s*=.*\n/,'');
 writeFileSync(stagingConfig,base+`\nmigrations_dir = ${JSON.stringify(stage.replaceAll('\\','/'))}\n`);
 run(['d1','migrations','apply','DB','--local','--config',stagingConfig,'--persist-to',persist]);
}finally{rmSync(stage,{recursive:true,force:true})}
