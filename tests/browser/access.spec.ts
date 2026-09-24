import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('real local Pages API rejects claimed identities without a session', async({request})=>{
  for(const path of ['/api/me','/api/applications','/api/resume-records','/api/auth/session']) {
    const response=await request.get(path,{headers:{'X-Beta-Access-Code':'forged','X-FokalView-User-Email':'victim@example.test'}});
    expect(response.status()).toBe(401);
  }
  const response=await request.post('/api/analyze',{data:{resumeText:'synthetic '.repeat(50)}});
  expect(response.status()).toBe(401);
});

for (const surface of ['popup','dashboard']) {
 test(`extension ${surface} retains local jobs and verified website handoff`,async({page})=>{
  await page.route('**/extension-fixture/*',async route=>{
   const file=new URL(route.request().url()).pathname.split('/').pop()!;
   if(!['popup.html','popup.js','dashboard.html','dashboard.js','config.js','styles.css'].includes(file)) return route.abort();
   const body=await readFile(new URL(`../../edge-extension/${file}`,import.meta.url));
   await route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript'});
  });
  await page.addInitScript(()=>{
   const data:Record<string,any>={applications:[{id:'old-job',title:'Engineer',company:'Example',status:'Interested',createdAt:new Date().toISOString()}],settings:{cloudSyncConsent:true,cloudAccessCode:'obsolete'}};
   (window as any).createdTabs=[];
   (window as any).extensionData=data;
   (window as any).chrome={storage:{local:{get:async()=>data,set:async(next:any)=>Object.assign(data,next)}},
    tabs:{query:async()=>[],create:(tab:any)=>(window as any).createdTabs.push(tab)},runtime:{getURL:(path:string)=>path}};
  });
  await page.goto(`/extension-fixture/${surface}.html`);
  await expect(page.getByText(/Direct extension cloud\s+sync is unavailable/)).toBeVisible();
  await expect(page.locator('#cloudAccessCode')).toHaveCount(0);
  if(surface==='popup') {
   await page.locator('#title').fill('Analyst');await page.locator('#company').fill('Synthetic');
   await page.getByRole('button',{name:'Save job',exact:true}).click();
   await expect(page.locator('#message')).toContainText('Saved locally');
   expect(await page.evaluate(()=>(window as any).extensionData.applications.length)).toBe(2);
   await page.getByRole('button',{name:'Open resume analyzer',exact:true}).click();
  } else {
   await expect(page.locator('#total')).toHaveText('1');
   await page.getByRole('button',{name:'Send to resume',exact:true}).click();
  }
  const tabs=await page.evaluate(()=>(window as any).createdTabs);
  expect(tabs).toHaveLength(1);expect(tabs[0].url).toContain('jobTitle=');
 });
}

test('old browser beta storage does not bypass sign-in',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('fokalview_beta_access_code','old-beta-code'));
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Enter beta',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Dashboard',exact:true})).toHaveCount(0);
});

test('invitation result is rendered and server failures are visible',async({page})=>{
  // Hosted email delivery is deliberately mocked; no real invitations are sent.
  await page.route('**/api/access',route=>route.fulfill({json:{ok:true,pinCreated:true,invitation:{status:'invitation_pending'}}}));
  await page.goto('/');
  await page.getByPlaceholder('Enter beta code').fill('synthetic');
  await page.getByPlaceholder('student@example.com').fill('test@example.test');
  await page.getByPlaceholder('Choose or enter 4 digits').fill('1234');
  await page.getByRole('button',{name:'Enter beta',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Beta access approved'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Continue to verified sign in'})).toHaveAttribute('href','/api/auth/login');
  await page.unroute('**/api/access');
  await page.route('**/api/access',route=>route.fulfill({status:503,json:{error:'Beta admission is not configured.'}}));
  await page.reload();
  await page.getByPlaceholder('Enter beta code').fill('synthetic');
  await page.getByPlaceholder('student@example.com').fill('test@example.test');
  await page.getByPlaceholder('Choose or enter 4 digits').fill('1234');
  await page.getByRole('button',{name:'Enter beta',exact:true}).click();
  await expect(page.getByText('Beta admission is not configured.',{exact:true})).toBeVisible();
});
