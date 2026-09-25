import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..','chrome-extension');
const output=resolve(process.argv[2] || '.wrangler/store-assets');
await mkdir(output,{recursive:true});
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(!/^\/(?:popup\.(?:html|css|mjs)|extract\.mjs|shared\/job-capture\.mjs|icons\/icon\d+\.png)$/.test(path)){res.writeHead(404).end();return;}
  try{const data=await readFile(join(root,path.slice(1)));res.setHeader('Content-Type',path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.png')?'image/png':'text/javascript');res.end(data);}catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  await page.addInitScript(()=>{
    const job={version:1,title:'Platform Engineer',company:'Northstar Demo',location:'Rochester, NY · United States',salary:'$120,000–$160,000 per year',employmentType:'Full time',workplaceType:'Remote',requirements:'3+ years of software engineering experience\nTypeScript, SQL and API design\nClear written communication',preferred:'Go or Kubernetes experience\nExperience building developer tools',responsibilities:'Build reliable platform services.\nWork with product and engineering to improve developer experiences.',description:'Join a fictional platform team building tools that make developers more effective. Design reliable APIs, improve system performance, and collaborate across disciplines.\n\nRequirements\n3+ years of engineering experience, TypeScript, SQL, and API design.\n\nNice to have\nGo and Kubernetes.',url:'https://jobs.example.test/platform-engineer'};
    window.chrome={storage:{local:{get:async()=>({'sagittaiq-job-draft':{job,savedAt:Date.now()}}),set:async()=>{},remove:async()=>{}}}};
  });
  await page.goto(origin+'/popup.html');await page.locator('[name="title"]').waitFor();
  await page.waitForFunction(()=>document.querySelector('[name="title"]').value==='Platform Engineer');
  await page.evaluate(()=>{
    const frame=document.createElement('div');frame.className='extension-preview';
    while(document.body.firstChild) frame.append(document.body.firstChild);
    document.body.append(frame);
    const hero=document.createElement('section');hero.className='store-hero';
    hero.innerHTML='<div class="store-wordmark">SagittaIQ <span>JOB CAPTURE</span></div><p class="store-kicker">KEEP THE DETAILS THAT MATTER</p><h1>One posting.<br>Your next move.</h1><p class="store-description">Bring the role into focus before<br>you compare your resume.</p><ul><li>Capture job details in one click</li><li>Review requirements & nice to haves</li><li>Send your draft to SagittaIQ</li></ul><p class="demo-label">Demo posting · fictional company</p>';
    document.body.prepend(hero);
    const style=document.createElement('style');style.textContent='body{width:1280px;height:800px;background:#edf2ee}.extension-preview{position:absolute;top:30px;right:34px;width:540px;height:740px;overflow:auto;border-radius:16px;background:#f5f7f5;box-shadow:0 16px 50px #163e4824;border:1px solid #d2ded5;scrollbar-width:none}.store-hero{position:absolute;left:62px;top:55px;width:570px}.store-wordmark{font-size:28px;font-weight:750;letter-spacing:-1px}.store-wordmark span{display:block;font-size:10px;letter-spacing:3px;margin-top:6px;color:#397d6c}.store-kicker{font-size:11px;letter-spacing:2px;font-weight:700;margin-top:85px;color:#397d6c}.store-hero h1{font-size:64px;line-height:1.04;letter-spacing:-3px;margin:20px 0}.store-description{font-size:21px;line-height:1.55;color:#63796f}.store-hero ul{padding:0;list-style:none;font-size:15px;line-height:2.5;margin-top:30px}.store-hero li:before{content:"✓";color:#277d66;margin-right:12px}.demo-label{font-size:11px;color:#718079;margin-top:58px}';document.head.append(style);
  });
  await page.screenshot({path:join(output,'screenshot-1280x800.png')});
  await page.evaluate(()=>{document.querySelector('.extension-preview').scrollTop=650;document.querySelector('.store-hero h1').innerHTML='More context.<br>Better prepared.';document.querySelector('.store-description').textContent='Keep the requirements, preferences, and full description together.';});
  await page.screenshot({path:join(output,'details-1280x800.png')});
  await page.setViewportSize({width:440,height:280});
  await page.setContent(`<html><body style="margin:0;background:#163e48;color:#fff;font-family:system-ui;width:440px;height:280px;box-sizing:border-box;padding:30px"><div style="display:flex;align-items:center;gap:12px;font-size:24px;font-weight:750"><img src="${origin}/icons/icon48.png" width="42" height="42">Sagitta<span style="color:#91d6c3;margin-left:-12px">IQ</span></div><div style="font-size:10px;letter-spacing:2px;color:#a5d4c4;margin:24px 0 10px">JOB CAPTURE</div><div style="font-size:32px;line-height:1.15;font-weight:650;letter-spacing:-1px">Bring the whole role.</div><p style="font-size:14px;color:#d3e4df;line-height:1.5">Capture. Review. Compare your resume.</p></body></html>`);
  await page.screenshot({path:join(output,'promo-440x280.png')});
  console.log(output);
}finally{await browser.close();await new Promise(done=>server.close(done));}
