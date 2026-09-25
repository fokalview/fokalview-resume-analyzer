import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runReviewPipeline,validateStage} from '../functions/lib/review-pipeline.js';
const string={type:'string'};
const list={type:'array',items:string,maxItems:6};
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
const schemas={profile:object({currentTitle:string}),job:object({jobDetails:object({title:string}),jobQualifications:object({requiredSkills:list})}),analysis:object({score:{type:'integer',minimum:0,maximum:100},summary:string,strengths:list,improvements:{type:'array',items:object({title:string,detail:string,priority:{type:'string',enum:['High','Medium','Low']}}),maxItems:6}})};
const comparison={score:99,summary:'Original',strengths:['Built SQL reports'],improvements:[],sourceEvidence:[{claim:'SQL',resumeQuote:'Built SQL reports',jobQuote:'SQL required'},{claim:'Invented',resumeQuote:'Led a team of 50',jobQuote:'SQL required'}]};
async function review(writer={summary:'Edited',strengths:['Built SQL reports'],improvements:[]}) {
 const stages=[];
 const result=await runReviewPipeline({resumeText:'Built SQL reports',jobContext:'SQL required',targetRole:'Analyst',lockedJobQualifications:{requiredSkills:['SQL']},schemas,
 score:analysis=>({...analysis,score:42,scoringVersion:'test'}),
 run:async(name,prompt)=>{stages.push(name);assert.ok(prompt.includes('untrusted data'));
 if(name==='job-extraction')return {jobDetails:{title:'Analyst'},jobQualifications:{requiredSkills:['Python']}};
 if(name==='profile-extraction')return {currentTitle:'Analyst'};
 if(name==='opportunity-review'){assert.ok(prompt.includes('SQL required'));return structuredClone(comparison);}
 return writer;
 }});return {result,stages};
}
test('separate stages preserve locked rubric and score, discard fabricated quotes',async()=>{
 const {result,stages}=await review();assert.equal(stages.length,4);assert.equal(result.score,42);
 assert.equal(result.summary,'Edited');assert.deepEqual(result.jobQualifications.requiredSkills,['SQL']);assert.equal(result.sourceEvidence.length,1);
});
test('writer cannot mutate score or profile and malformed output falls back',async()=>{
 const {result}=await review({score:100,summary:'Rewrite',strengths:[],improvements:[]});
 assert.equal(result.score,42);assert.equal(result.summary,'Original');assert.ok(result.orchestration.stages.includes('report-writing-fallback'));
});
test('invalid stage data fails closed',()=>{
 for(const value of [null,[],{}, {currentTitle:42},{currentTitle:'A',extra:true}]) assert.throws(()=>validateStage(value,schemas.profile));
 assert.throws(()=>validateStage({score:Infinity},object({score:{type:'integer'}})));
 assert.throws(()=>validateStage(['a','b'],{type:'array',items:string,maxItems:1}));
});
