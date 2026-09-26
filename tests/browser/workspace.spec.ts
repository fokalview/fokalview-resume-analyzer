import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../fixtures/ui-audit.json',import.meta.url),'utf8'));
async function fixture(page:any) {
 await page.route('**/api/auth/session',(route:any)=>route.fulfill({json:{authenticated:true,user:{id:'fixture',email:'fixture@example.test',emailVerified:true},userId:'fixture',candidateId:'TEST'}}));
 await page.route('**/api/resume-records',(route:any)=>route.fulfill({json:{records:data.records}}));
 await page.route('**/api/applications',(route:any)=>route.fulfill({json:{applications:data.applications}}));
}
for(const width of [320,390,768,1440]) for(const theme of ['light','dark']) for(const view of ['dashboard','upload','results','applications']) test(`${view} ${theme} fits ${width}px`,async({page})=>{
 await fixture(page);await page.setViewportSize({width,height:900});await page.addInitScript(theme=>localStorage.setItem('sagittaiq_theme',theme),theme);
 await page.goto(`/?view=${view}`);await expect(page.locator('.workspace h1')).toBeVisible();
 const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('.workspace *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>e.className)}));
 expect(overflow.scroll,JSON.stringify(overflow)).toBeLessThanOrEqual(width);
});
test('specific report survives reload and opens its matching opportunity',async({page})=>{
 await fixture(page);await page.goto('/?view=results&report=report1');
 await expect(page.getByRole('heading',{name:/72% alignment/})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:/72% alignment/})).toBeVisible();
 await page.getByRole('button',{name:'Open this opportunity'}).click();await expect(page).toHaveURL(/opportunity=job1/);await expect(page.locator('#opportunity-job1')).toBeFocused();
 await page.goBack();await expect(page.getByRole('heading',{name:/72% alignment/})).toBeVisible();
});
test('unknown report never substitutes another saved report',async({page})=>{
 await fixture(page);await page.goto('/?view=results&report=unknown');await expect(page.getByRole('alert')).toContainText('unavailable');await expect(page.getByRole('heading',{name:/alignment with/})).toHaveCount(0);
});
test('opportunity picker retries without losing entered resume text',async({page})=>{
 await fixture(page);let fail=true;await page.route('**/api/applications',route=>route.fulfill(fail?{status:503,json:{error:'Unavailable'}}:{json:{applications:data.applications}}));
 await page.goto('/?view=upload');await page.getByLabel('Resume text').fill('Keep this draft');await expect(page.getByRole('alert')).toContainText('could not load');fail=false;
 await page.getByRole('button',{name:'Retry saved opportunities'}).click();await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByLabel('Resume text')).toHaveValue('Keep this draft');
});

test('analysis remains visible and downloadable when saving fails',async({page})=>{
 await fixture(page);
 await page.route('**/api/analyze',route=>route.fulfill({json:data.records[1].analysis}));
 await page.route('**/api/applications',route=>route.fulfill(route.request().method()==='POST'?{status:503,json:{error:'Save unavailable'}}:{json:{applications:[]}}));
 await page.goto('/?view=upload');await page.getByLabel('Target opportunity',{exact:true}).fill('Platform Engineer');
 await page.getByLabel('Job description',{exact:true}).fill('Build and maintain reliable data infrastructure with SQL and Python.');
 await page.getByLabel('Resume text').fill('I built reliable data services using SQL and Python and worked with product teams to improve reporting. '.repeat(4));
 await page.getByRole('button',{name:'Analyze career readiness'}).click();
 await expect(page.getByRole('heading',{name:'Historical review: 72% alignment with Platform Engineer'})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('saving did not finish');await expect(page.getByRole('button',{name:'Download report',exact:true})).toBeEnabled();
});
test('review history failures are visible while opportunities remain usable',async({page})=>{
 await fixture(page);await page.route('**/api/resume-records',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
 await page.goto('/?view=applications');await expect(page.getByRole('alert')).toContainText('Review history could not load');await expect(page.locator('#opportunity-job1')).toBeVisible();
});
test('dark tracker metrics have readable text contrast',async({page})=>{
 await fixture(page);await page.addInitScript(()=>localStorage.setItem('sagittaiq_theme','dark'));await page.goto('/?view=applications');await expect(page.locator('.application-stats')).toBeVisible();
 const ratios=await page.evaluate(()=>{
  const light=(color:string)=>{const rgb=color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722};
  return [...document.querySelectorAll('.application-stats span,.application-stats strong')].map(e=>{const a=light(getComputedStyle(e).color),b=light(getComputedStyle(e.closest('article')!).backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
 });expect(ratios.length).toBeGreaterThan(0);for(const ratio of ratios)expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('layout reflows continuously at intermediate widths and enlarged text',async({page})=>{
 await fixture(page);
 for(const view of ['dashboard','upload','results','applications']) {
  await page.goto(`/?view=${view}`);await expect(page.locator('.workspace h1')).toBeVisible();
  for(const width of [375,600,860,961,1024,1180,1280,1600,1920]) {
   await page.setViewportSize({width,height:900});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${view} at ${width}px`).toBeLessThanOrEqual(width);
  }
 }
 await page.setViewportSize({width:1024,height:900});
 await page.addStyleTag({content:'html { font-size: 200% !important; }'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth),'tracker at enlarged text').toBeLessThanOrEqual(1024);
 const controls=page.locator('.application-list article').first().locator('select,button,a');
 for(const control of await controls.all()) {
  const box=await control.boundingBox();if(box) expect(box.x+box.width).toBeLessThanOrEqual(1024);
 }
});

test('workspace uses the available horizontal space on wide screens',async({page})=>{
 await fixture(page);
 for(const width of [1440,1920,2560]) {
  await page.setViewportSize({width,height:1080});
  for(const view of ['dashboard','upload','results','applications']) {
   await page.goto(`/?view=${view}`);await expect(page.locator('.workspace h1')).toBeVisible();
   const sizes=await page.evaluate(()=>{const workspace=document.querySelector('.workspace')!;const screen=workspace.querySelector('.screen')!;const style=getComputedStyle(workspace);return {available:workspace.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),actual:screen.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth};});
   expect(Math.abs(sizes.available-sizes.actual)).toBeLessThan(2);expect(sizes.overflow).toBe(false);
  }
 }
});

test('large-screen dashboard keeps its heading and score summary compact',async({page})=>{
 await fixture(page);await page.setViewportSize({width:1920,height:1080});await page.goto('/?view=dashboard');await expect(page.locator('.dashboard-hero')).toBeVisible();
 const box=await page.locator('.dashboard-hero').boundingBox();expect(box!.height).toBeLessThan(320);
});

test('review groups inputs and report score stays inside its cell',async({page})=>{
 await fixture(page);await page.setViewportSize({width:1920,height:1080});await page.goto('/?view=upload');
 await expect(page.getByRole('region',{name:'1. Your resume'}).getByLabel('Resume text')).toBeVisible();
 await expect(page.getByRole('region',{name:'2. Target job'}).getByLabel('Job description',{exact:true})).toBeVisible();
 await page.goto('/?view=results');await expect(page.getByRole('heading',{name:'Your next improvements'})).toBeVisible();
 const cell=await page.locator('.report-score-cell').boundingBox();const ring=await page.locator('.report-score-cell .score-ring').boundingBox();
 expect(ring!.x).toBeGreaterThanOrEqual(cell!.x);expect(ring!.x+ring!.width).toBeLessThanOrEqual(cell!.x+cell!.width);
});
test('tracker counts final interviews and starts with compact details',async({page})=>{
 await fixture(page);await page.route('**/api/applications',route=>route.fulfill({json:{applications:[{...data.applications[0],status:'Final Interview'}]}}));
 await page.goto('/?view=applications');
 await expect(page.locator('.application-stats article').filter({hasText:'Interviewing'}).locator('strong')).toHaveText('1');
 await expect(page.locator('.opportunity-details')).not.toHaveAttribute('open');
 await page.getByText('Review details and history',{exact:true}).click();await expect(page.locator('.opportunity-details')).toHaveAttribute('open','');
});
