import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyDeterministicScoring} from '../functions/api/scoring.js';
const score=(resumeText,term)=>applyDeterministicScoring({}, {resumeText,targetRole:'',jobContext:'',jobQualifications:{requiredSkills:[term]}}).sections[0].score;
for(const [term,resume,negative] of [['Go','Built services in Go.','Built Django services'],['R','Analytics in R.','Research engineer'],['C#','Developed C# applications.','Developed C++ applications'],['AI','Built AI systems.','Maintained systems'],['SQL','Used SQL, Python and R.','Used PostgreSQL'],['Python','Built Python APIs.','Built Ruby APIs']]) {
 test(`matches ${term} as a complete technology`,()=>{assert.equal(score(resume,term),100);assert.equal(score(negative,term),0)});
}
test('scoring is deterministic and bounded',()=>{
 const input={resumeText:'Experience education skills projects summary built Python APIs.',targetRole:'Engineer',jobContext:'Python Engineer'};
 const a=applyDeterministicScoring({},input);assert.deepEqual(a,applyDeterministicScoring({},input));assert.ok(a.score>=0 && a.score<=100);
});
