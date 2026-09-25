import {chromium} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const svg=await readFile(resolve(root,'edge-extension/icon.svg'),'utf8');
await mkdir(resolve(root,'chrome-extension/icons'),{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage();
  for(const size of [16,32,48,128]){
    await page.setViewportSize({width:size,height:size});
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('viewBox=',`width="${size}" height="${size}" viewBox=`)}</body></html>`);
    await page.screenshot({path:resolve(root,`chrome-extension/icons/icon${size}.png`),omitBackground:true});
  }
}finally{await browser.close();}
