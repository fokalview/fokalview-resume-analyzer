import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeJob,encodeJob,decodeJob,jobContext,FIELD_LIMITS} from '../chrome-extension/shared/job-capture.mjs';
const job={version:1,title:'Ingénieur C# / 日本語',company:'Example',description:'An explicit job description. '.repeat(10),requirements:'C#\nSQL',preferred:'Go',url:'https://example.test/jobs/42?utm_source=test&token=secret&job=42#apply'};
test('job capture round trips Unicode and strips tracking and unsafe source URLs',()=>{
 const result=decodeJob(encodeJob(job));assert.equal(result.title,job.title);assert.equal(result.requirements,job.requirements);
 assert.equal(result.url,'https://example.test/jobs/42?job=42');assert.equal(result.source,'example.test');
 assert.equal(normalizeJob({...job,url:'javascript:alert(1)'}).url,'');
 assert.equal(normalizeJob({...job,url:'https://user:password@example.test/job'}).url,'https://example.test/job');
});
test('captures reject unsupported, malformed and oversized payloads',()=>{
 for(const input of [null,[],{version:2}]) assert.throws(()=>normalizeJob(input));
 for(const input of ['?', 'eA','a'.repeat(120001),'']) assert.throws(()=>decodeJob(input));
 const bounded=normalizeJob({...job,title:'A'.repeat(500),description:'X'.repeat(50000),salary:{value:10}});
 assert.equal(bounded.title.length,160);assert.equal(bounded.description.length,15000);assert.equal(bounded.salary,'');
});
test('complete bounded capture fits opportunity storage and keeps explicit sections',()=>{
 const maximum={version:1};for(const [key,limit] of Object.entries(FIELD_LIMITS)) maximum[key]='A'.repeat(limit);
 assert.ok(jobContext(maximum).length<=30000);
 const context=jobContext(job);assert.match(context,/Requirements:\nC#\nSQL/);assert.match(context,/Nice to have:\nGo/);
 assert.match(context,/Full job description:/);assert.equal(normalizeJob(job).salary,'');
});
