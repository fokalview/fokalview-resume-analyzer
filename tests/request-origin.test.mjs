import {test} from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/api/_middleware.js';

test('candidate mutations reject foreign, sibling and opaque origins before handling', async () => {
  for (const path of ['applications','resume-records','analyze']) {
    for (const method of ['POST','PATCH','DELETE']) {
      for (const headers of [{Origin:'https://evil.test'},{Origin:'https://other.sagittaiq.com'},{Origin:'null'},{'Sec-Fetch-Site':'cross-site'},{'Sec-Fetch-Site':'same-site'}]) {
        let called=false;
        const response=await onRequest({request:new Request(`https://sagittaiq.com/api/${path}`,{method,headers}),next:()=>{called=true;return new Response('ok')}});
        assert.equal(response.status,403);assert.equal(called,false);
      }
    }
  }
});
test('same origin and non-browser clients reach existing authentication; safe requests continue', async () => {
  for (const options of [{method:'POST',headers:{Origin:'https://sagittaiq.com','Sec-Fetch-Site':'same-origin'}},{method:'POST'},{method:'GET',headers:{Origin:'https://evil.test'}},{method:'OPTIONS'}]) {
    const response=await onRequest({request:new Request('https://sagittaiq.com/api/applications',options),next:()=>new Response('auth still required',{status:401})});
    assert.equal(response.status,401);
  }
});
