import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../fixtures/ui-audit.json',import.meta.url),'utf8'));
const readiness={version:'sagittaiq-evidence-v2',level:'Promising alignment',explanation:'Teaching experience is supported; clarify the required credential.',counts:{demonstrated:1,unclear:1},criticalUnresolved:1,assessed:1,total:2,extractionIncomplete:false,requirements:[
 {id:'1',requirement:'Teach lessons',jobQuote:'Teach lessons',importance:'core',category:'responsibility',status:'demonstrated',resumeQuote:'Taught lessons to a class of 20',reason:'Direct teaching experience.',nextAction:'Retain this example.'},
 {id:'2',requirement:'Required teaching credential',jobQuote:'Teaching credential required',importance:'critical',category:'qualification',status:'unclear',resumeQuote:'',reason:'Credential not established.',nextAction:'Confirm your current credential.'}
]};
async function fixture(page:any) {
 const records=structuredClone(data.records);records.forEach((record:any)=>{record.analysis={...record.analysis,score:null,readiness,sections:[]};});
 const applications=structuredClone(data.applications);applications.forEach((item:any)=>{item.latestReadinessScore=null;item.latestAnalysis=records[0].analysis;});
 await page.route('**/api/auth/session',(route:any)=>route.fulfill({json:{authenticated:true,user:{id:'fixture',email:'fixture@example.test',emailVerified:true},userId:'fixture',candidateId:'TEST'}}));
 await page.route('**/api/resume-records',(route:any)=>route.fulfill({json:{records}}));
 await page.route('**/api/applications',(route:any)=>route.fulfill({json:{applications}}));
}
for(const width of [320,768,1920]) for(const theme of ['light','dark']) test(`evidence screens fit ${width}px ${theme}`,async({page})=>{
 await fixture(page);await page.setViewportSize({width,height:900});await page.addInitScript(theme=>localStorage.setItem('sagittaiq_theme',theme),theme);
 for(const view of ['dashboard','results','applications']) {
  await page.goto(`/?view=${view}`);await expect(page.locator('.workspace h1')).toBeVisible();
  await expect(page.getByText('Promising alignment',{exact:true}).first()).toBeVisible();
  await expect(page.locator('.score-ring')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 await page.goto('/?view=results');await page.getByRole('button',{name:'Opportunity alignment',exact:true}).click();
 const row=page.locator('.requirement-card').filter({hasText:'Required teaching credential'});
 await row.locator('summary').focus();await page.keyboard.press('Enter');await expect(row.getByText('Confirm your current credential.')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
test('new report export includes evidence and excludes a readiness percentage',async({page})=>{
 await fixture(page);await page.goto('/?view=results&report=report1');
 await page.evaluate(()=>{(window as any).__report='';window.open=()=>({document:{write:(html:string)=>(window as any).__report=html,close(){}},focus(){},print(){}} as any);});
 await page.getByRole('button',{name:'Download report',exact:true}).click();
 const html=await page.evaluate(()=>(window as any).__report);
 expect(html).toContain('Promising alignment');expect(html).toContain('Taught lessons to a class of 20');expect(html).not.toContain('null%');expect(html).not.toContain('% career readiness');
});
