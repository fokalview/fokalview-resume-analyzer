import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessReadiness, normalizeReadiness} from '../functions/lib/readiness.js';
function review(statuses, options = {}) {
  const requirements = statuses.map((status,index) => ({id:String(index),requirement:`Requirement ${index}`,jobQuote:`Job expectation ${index}`,category:'responsibility',importance:index === 0 && options.critical ? 'critical' : 'core'}));
  const evaluations = statuses.map((status,index) => ({id:String(index),status,resumeQuote: ['not-evidenced','unclear'].includes(status) ? '' : `Evidence ${index}`,reason:'Explanation',nextAction:'Clarify scope'}));
  return assessReadiness(requirements,evaluations,evaluations.map(item=>item.resumeQuote).join('\n'),requirements.map(item=>item.jobQuote).join('\n'));
}
test('occupation-specific source excerpts pass through the same evidence rules',()=>{
 const examples = [
 ['Plan and teach lessons','Planned and taught lessons to a class of 20'],
 ['Install electrical wiring','Installed wiring under supervision'],
 ['Coordinate patient handovers','Coordinated patient handovers on a ward'],
 ['Manage customer accounts','Managed renewals for customer accounts'],
 ['Maintain production services','Maintained production services and resolved incidents'],
 ['Complete supervised workshop tasks','Completed supervised workshop tasks during training']
 ];
 for(const [job,resume] of examples){
  const requirement={id:'1',requirement:job,jobQuote:job,importance:'core',category:'responsibility'};
  const evaluation={id:'1',status:'demonstrated',resumeQuote:resume,reason:'Relevant example at the stated scope',nextAction:'Retain this example'};
  assert.equal(assessReadiness([requirement],[evaluation],resume,job).level,'Strong alignment');
 }
 assert.equal(review(['demonstrated','transferable']).level,'Promising alignment');
 assert.equal(review(['unmet','demonstrated'],{critical:true}).level,'Significant gaps');
 assert.equal(review(['not-evidenced','unclear']).level,'More information needed');
});
test('critical unknown cannot be outweighed by preferred matches',()=>{
 const result=review(['not-evidenced','demonstrated'],{critical:true});
 assert.notEqual(result.level,'Strong alignment');assert.equal(result.criticalUnresolved,1);
 const preferred=result.requirements.slice(1).map(item=>({...item,importance:'preferred'}));
 assert.equal(assessReadiness(preferred,preferred,'Evidence 1','Job expectation 1').level,'More information needed');
});
test('fabricated quotes, duplicate IDs and missing evaluations fail conservatively',()=>{
 const requirement={id:'1',requirement:'Teach lessons',jobQuote:'Teach lessons',importance:'core',category:'responsibility'};
 const evaluation={id:'1',status:'demonstrated',resumeQuote:'Invented experience',reason:'Claim',nextAction:'Check'};
 const result=assessReadiness([requirement],[evaluation],'Actual experience','Teach lessons');
 assert.equal(result.level,'More information needed');assert.equal(result.requirements[0].resumeQuote,'');
 assert.equal(assessReadiness([requirement],[],'','Teach lessons').requirements[0].status,'unclear');
 assert.equal(assessReadiness([requirement,requirement],[evaluation],'Invented experience','Teach lessons').extractionIncomplete,true);
 assert.equal(assessReadiness([requirement],[evaluation],'Invented experience','Other posting').extractionIncomplete,true);
});
test('empty and credentials-only postings do not imply strong readiness',()=>{
 assert.equal(assessReadiness([],[],'','').level,'More information needed');
 const row={id:'1',requirement:'License',jobQuote:'License',importance:'critical',category:'qualification',status:'demonstrated',resumeQuote:'License',reason:'Listed',nextAction:'Confirm validity'};
 assert.equal(assessReadiness([row],[row],'License','License').level,'More information needed');
});
test('saved assessment recomputes derived fields and preserves incomplete extraction',()=>{
 const original=review(['demonstrated','partial']);
 const saved=normalizeReadiness({...original,level:'Strong alignment',counts:{demonstrated:999}});
 assert.equal(saved.level,'Promising alignment');assert.equal(saved.counts.demonstrated,1);
 assert.equal(normalizeReadiness({...original,extractionIncomplete:true}).level,'More information needed');
 assert.equal(normalizeReadiness({version:'unknown'}),undefined);
});
test('keyword repetition and extra prose cannot change the derived assessment',()=>{
 const value=review(['demonstrated','partial']);
 const source=value.requirements.map(item=>item.resumeQuote).join('\n');
 const job=value.requirements.map(item=>item.jobQuote).join('\n');
 assert.deepEqual(assessReadiness(value.requirements,value.requirements,source,job),assessReadiness(value.requirements,value.requirements,source+' keywords '.repeat(500),job));
});
