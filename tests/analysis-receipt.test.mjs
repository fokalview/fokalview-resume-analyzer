import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {issueAnalysisReceipt,verifyAnalysisReceipt} from '../functions/lib/analysis-receipt.js';
const env={ANALYSIS_SIGNING_SECRET:'a-test-secret-at-least-32-characters-long'};
const context={userId:'owner',resumeText:'Resume',jobContext:'Job',targetRole:'Teacher'};
test('receipt survives JSON transport and rejects changes to evidence, user, source or token',async()=>{
 const analysis={score:null,readiness:{level:'Promising',requirements:[{quote:'Resume'}]},optional:undefined};
 analysis.provenance=await issueAnalysisReceipt(analysis,context,env);
 const value=JSON.parse(JSON.stringify(analysis));
 assert.ok((await verifyAnalysisReceipt(value,context,env)).reviewId);
 for(const field of ['userId','resumeText','jobContext','targetRole'])await assert.rejects(verifyAnalysisReceipt(value,{...context,[field]:'changed'},env));
 await assert.rejects(verifyAnalysisReceipt({...value,readiness:{...value.readiness,level:'Strong'}},context,env));
 await assert.rejects(verifyAnalysisReceipt({...value,provenance:{...value.provenance,token:value.provenance.token+'a'}},context,env));
 await assert.rejects(verifyAnalysisReceipt({...value,provenance:undefined},context,env));
 await assert.rejects(verifyAnalysisReceipt(value,context,{}));
});
test('receipts expire after 24 hours and signing keys cannot be silently rotated',async()=>{
 const value={summary:'Review'};value.provenance=await issueAnalysisReceipt(value,context,env);
 await assert.rejects(verifyAnalysisReceipt(value,context,{ANALYSIS_SIGNING_SECRET:'different-test-secret-longer-than-32-characters'}));
 const now=Date.now();const clock=mock.method(Date,'now',()=>now+24*60*60*1000+1);
 try{await assert.rejects(verifyAnalysisReceipt(value,context,env));}finally{clock.mock.restore();}
});
