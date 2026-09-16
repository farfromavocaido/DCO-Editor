/** In-memory browser verification: never saves edits to campaign storage. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {findCreativeTarget} from '../src/lib/creative-model';
const origin=process.argv[2] || 'http://localhost:5188';
const output=path.resolve('output/playwright/relationships');
async function main(){
 await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const checks=[];
 try{
  for(const id of ['product-demo','sse-dco']){
   const filename=`campaign/${id}-creative.json`;const original=await fs.readFile(filename,'utf8');let saved=JSON.parse(original);let saves=0;
   const page=await browser.newPage({viewport:{width:1600,height:1100}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route(url=>url.pathname==='/api/creative',async route=>{if(route.request().method()==='POST'){saved=route.request().postDataJSON();saves++;}await route.fulfill({contentType:'application/json',body:JSON.stringify(saved)});});
   await page.goto(origin);
   assert.equal(await page.getByText('About text output',{exact:true}).count(),0);
   const ready=async()=>{await page.locator('[data-production-frame][data-ready="true"]').waitFor({timeout:45000});};await ready();
   await page.getByLabel('Campaign',{exact:true}).selectOption(id);await ready();
   await page.getByLabel('Ad size',{exact:true}).selectOption('300x250');await ready();
   if(id==='sse-dco'){await page.getByRole('button',{name:'No offers (brand / awareness)',exact:true}).click();await ready();}
   await page.locator('[data-section="layers"] .sidebar-section-toggle').click();
   await page.getByRole('button',{name:id==='sse-dco'?'Roundel Text layer':'title layer',exact:true}).click();
   const targetId=id==='sse-dco'?'roundel-copy':'title';
   const save=async()=>{const count=saves;await Promise.all([page.waitForResponse(response=>new URL(response.url()).pathname==='/api/creative' && response.request().method()==='POST'),page.getByRole('button',{name:'Save creative',exact:true}).click()]);assert.equal(saves,count+1);};
   const dialog=page.getByRole('dialog');const field=()=>dialog.locator('.copy-bundle label').filter({hasText:/^Font size/}).locator('input');
   const chooseFont=async()=>{await dialog.getByRole('button',{name:'Choose properties',exact:true}).click();await dialog.locator('.copy-bundle').filter({hasText:'Typography'}).locator('summary').click();await field().check();};
   const chooseIrish=async()=>{await dialog.locator('.copy-choice-row').filter({hasText:'Language'}).getByRole('button',{name:'Gaeilge',exact:true}).click();};
   await page.getByRole('button',{name:'Copy to…',exact:true}).click();await dialog.waitFor();
   if(id==='product-demo'){await chooseIrish();await dialog.locator('.copy-choice-row').filter({hasText:'Theme'}).getByRole('button',{name:'Dark',exact:true}).click();}
   await chooseFont();await dialog.getByRole('button',{name:'Review changes',exact:true}).click();
   if(id==='product-demo')assert.equal(await dialog.getByLabel('Review destination').locator('option').count(),4);
   await page.waitForFunction(()=>[...document.querySelectorAll('.relationship-dialog iframe')].length===2 && [...document.querySelectorAll('.relationship-dialog iframe')].every(frame=>getComputedStyle(frame).visibility==='visible'),{},{timeout:45000});
   if(id==='product-demo'){
    const option=await dialog.getByLabel('Review destination').locator('option').evaluateAll(options=>(options.find(option=>option.textContent?.includes('Language: Gaeilge') && option.textContent?.includes('Theme: Light')) as HTMLOptionElement | undefined)?.value);
    await dialog.getByLabel('Review destination').selectOption(option!);
    const expected=saved.feed.sampleRows.find((row:Record<string,unknown>)=>row.language==='ga' && row.product==='lamp' && row.theme==='light');
    await page.waitForFunction(title=>[...document.querySelectorAll('.copy-review-previews iframe')].length===2 && [...document.querySelectorAll('.copy-review-previews iframe')].every((frame:any)=>frame.contentDocument?.querySelector('#title')?.textContent===title && getComputedStyle(frame).visibility==='visible'),expected.title,{timeout:45000});
    const fit=await dialog.locator('.copy-review-previews iframe').first().evaluate((frame:any)=>{const title=frame.contentDocument.querySelector('#title');return {width:title.clientWidth,scrollWidth:title.scrollWidth};});
    assert.ok(fit.scrollWidth<=fit.width+1,'Irish destination title fits its production frame');
   }
   assert.equal(await dialog.locator('.copy-review-previews [aria-hidden="true"]').count(),2,'selected element is highlighted in both comparisons');
   await page.screenshot({path:path.join(output,`${id}-comparison.png`)});
   await dialog.getByRole('button',{name:/^Copy to \d+ versions?$/}).click();await dialog.waitFor({state:'detached'});await ready();
   await page.locator('.ownership-controls').getByRole('button',{name:'Undo',exact:true}).waitFor();await save();
   const copied=structuredClone(saved);assert.ok(saved.sizes['300x250'].localOverrides.some((rule:{targetId:string;values:Record<string,unknown>})=>rule.targetId===targetId && rule.values.fontSize!==undefined));
   await page.getByRole('button',{name:'Copy to…',exact:true}).click();await dialog.getByRole('button',{name:'Choose properties',exact:true}).click();assert.equal(await field().isChecked(),false);await dialog.getByRole('button',{name:'Close comparison',exact:true}).click();assert.deepEqual(saved,copied);
   await page.getByRole('button',{name:'Copy from…',exact:true}).click();await chooseFont();await dialog.getByRole('button',{name:'Review changes',exact:true}).click();await dialog.getByRole('button',{name:'Copy to 1 version',exact:true}).click();await dialog.waitFor({state:'detached'});await ready();
   await page.getByRole('button',{name:'Link properties…',exact:true}).click();await dialog.getByLabel('Link name',{exact:true}).fill('Browser typography');
   if(id==='product-demo')await chooseIrish();
   await chooseFont();await dialog.getByRole('button',{name:'Review changes',exact:true}).click();
   await dialog.getByRole('button',{name:/^Link to \d+ versions?$/}).click();await dialog.waitFor({state:'detached'});await ready();await save();
   let definition=saved.sharedDefinitions.find((item:{name:string})=>item.name==='Browser typography');assert.ok(definition);assert.equal(definition.members.length,id==='product-demo'?2:1);
   await page.getByRole('button',{name:'Edit shared…',exact:true}).click();await page.getByLabel('Shared property',{exact:true}).selectOption('values:fontSize');await page.getByLabel('Shared value',{exact:true}).fill('21');await page.getByRole('button',{name:'Apply shared edit',exact:true}).click();await ready();await save();
   definition=saved.sharedDefinitions.find((item:{name:string})=>item.name==='Browser typography');assert.equal(definition.values.fontSize,21);
   const scopes=definition.members[0].scope.split('.');const before=findCreativeTarget(saved,'300x250',targetId,scopes).values.fontSize;
   await page.getByRole('button',{name:'Unlink — keep appearance',exact:true}).click();await ready();await save();
   assert.equal(findCreativeTarget(saved,'300x250',targetId,scopes).values.fontSize,before);
   assert.equal(saved.sharedDefinitions.find((item:{name:string})=>item.name==='Browser typography').members.length,id==='product-demo'?1:0);
   const persisted=structuredClone(saved);await page.reload();await ready();assert.deepEqual(saved,persisted);
   assert.deepEqual(errors,[]);assert.equal(await fs.readFile(filename,'utf8'),original);
   checks.push({campaign:id,result:'pass',saves,checks:['production source/current/proposed thumbnails',...(id==='product-demo'?['matching destination language copy and frame fitting']:[]),'concrete destination count','copy applies and closes','fresh transaction resets fields','cancel keeps copied document','copy from','link creation','shared edit','unlink preserves effective appearance','in-memory save/reload','real campaign unchanged']});
   await page.close();
  }
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
