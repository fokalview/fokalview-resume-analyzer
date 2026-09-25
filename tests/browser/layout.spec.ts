import {test,expect} from '@playwright/test';
async function signedIn(page:any){
 await page.route('**/api/auth/session', (route:any)=>route.fulfill({json:{authenticated:true,user:{id:'test',email:'test@example.test',emailVerified:true},userId:'usr_test',candidateId:'C1'}}));
 await page.route('**/api/resume-records',(route:any)=>route.fulfill({json:{records:[]}}));
 await page.route('**/api/applications',(route:any)=>route.fulfill({json:{applications:[]}}));
}
for(const width of [320,390,768,1440]) test(`landing fits ${width}px and sign-in is immediately reachable`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');
 const signIn=page.getByRole('link',{name:'Sign in to SagittaIQ'});await expect(signIn).toBeVisible();
 const box=await signIn.boundingBox();expect(box!.y+box!.height).toBeLessThan(900);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('workspace supports refresh and browser Back; upload supports keyboard',async({page})=>{
 await signedIn(page);await page.goto('/');
 await page.getByRole('button',{name:'Resume review',exact:true}).click();await expect(page).toHaveURL(/view=upload/);
 await page.reload();await expect(page.getByRole('heading',{name:'Compare your career materials with one opportunity.'})).toBeVisible();
 const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload career materials',exact:true}).press('Enter');await picker;
 await page.getByRole('button',{name:'Opportunities',exact:true}).click();await expect(page).toHaveURL(/view=applications/);
 await page.goBack();await expect(page).toHaveURL(/view=upload/);
});
test('tracker filters records and only opens editor on request',async({page})=>{
 await signedIn(page);await page.route('**/api/applications',(route)=>route.fulfill({json:{applications:[{id:'1',title:'Engineer',company:'Alpha',status:'Applied',updatedAt:'2026-09-24',createdAt:'2026-09-24',notes:''},{id:'2',title:'Designer',company:'Beta',status:'Interviewing',updatedAt:'2026-09-23',createdAt:'2026-09-23',notes:''}]}}));
 await page.goto('/?view=applications');await expect(page.getByLabel('Search opportunities')).toBeVisible();await expect(page.locator('.application-form')).toHaveCount(0);
 await page.getByLabel('Search opportunities').fill('Alpha');await expect(page.locator('.application-list article')).toHaveCount(1);
 await page.getByLabel('Search opportunities').fill('No match');await expect(page.getByText('No opportunities match these filters.')).toBeVisible();
 await page.getByRole('button',{name:'Add opportunity',exact:true}).click();await expect(page.locator('.application-form')).toBeVisible();
});

test('latest saved report restores after reload',async({page})=>{
 await signedIn(page);await page.route('**/api/resume-records',route=>route.fulfill({json:{records:[{id:'review1',targetRole:'Engineer',analysis:{score:72,summary:'Test summary',strengths:[],improvements:[],sections:[],keywordAnalysis:{matched:[],missing:[]}}}]}}));
 await page.goto('/?view=results');await expect(page.getByRole('heading',{name:'72% alignment with Engineer'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'72% alignment with Engineer'})).toBeVisible();
});

test('expired beta admission explains the next step without weakening sign-in',async({page})=>{
 await page.goto('/api/auth/login');await expect(page).toHaveURL(/access=required/);await expect(page.getByRole('alert')).toContainText('confirm your beta code and PIN');
});

for (const theme of ['light','dark']) test(`landing explains the product and opens beta access with the keyboard in ${theme}`,async({page})=>{
 await page.goto('/');
 if(await page.getByRole('button',{name:theme==='dark'?'Dark mode':'Light mode',exact:true}).count()) await page.getByRole('button',{name:theme==='dark'?'Dark mode':'Light mode',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your next move, made clearer.'})).toBeVisible();
 await expect(page.locator('.landing-steps li')).toHaveCount(3);
 await expect(page.getByPlaceholder('Enter beta code')).toBeHidden();
 await page.getByRole('link',{name:'Start your resume review'}).press('Enter');
 await expect(page.getByLabel('Access code',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Start your resume review'})).toHaveAttribute('aria-expanded','true');
 for(const width of [320,768,1440,2560]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.reload();
 await expect(page.getByLabel('Access code',{exact:true})).toBeVisible();
});
