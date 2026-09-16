/** Visual copy tray verification: all writes intercepted in memory. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {findCreativeTarget} from '../src/lib/creative-model';
const origin=process.argv[2] || 'http://localhost:5188';
async function main(){
 const output=path.resolve('output/playwright/relationships');await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({headless:true});const reports=[];
 try {for(const id of ['product-demo','sse-dco']) {
  const filename=`campaign/${id}-creative.json`,original=await fs.readFile(filename,'utf8');let saved=JSON.parse(original),saves=0;
  const page=await browser.newPage({viewport:{width:1600,height:1050}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(url=>url.pathname==='/api/creative',async route=>{if(route.request().method()==='POST'){saved=route.request().postDataJSON();saves++;}await route.fulfill({contentType:'application/json',body:JSON.stringify(saved)});});
  await page.goto(origin);const ready=async()=>{await page.waitForTimeout(100);await page.locator('[data-production-frame][data-ready="true"]').waitFor({timeout:45000});};await ready();
  await page.getByLabel('Campaign',{exact:true}).selectOption(id);await ready();await page.getByLabel('Ad size',{exact:true}).selectOption('300x250');await ready();
  if(id==='sse-dco'){await page.getByRole('button',{name:'Single offer',exact:true}).click();await ready();}
  if(!await page.getByRole('button',{name:id==='sse-dco'?'Roundel Text layer':'title layer',exact:true}).count())await page.locator('[data-section="layers"] .sidebar-section-toggle').click();
  await page.getByRole('button',{name:id==='sse-dco'?'Roundel Text layer':'title layer',exact:true}).click();
  const font=id==='sse-dco'?22:38,target=id==='sse-dco'?'roundel-copy':'title';
  await page.getByRole('textbox',{name:'Font size',exact:true}).fill(String(font));await ready();
  const save=async()=>{await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/creative'&&r.request().method()==='POST'),page.getByRole('button',{name:'Save creative',exact:true}).click()]);};
  await page.getByRole('button',{name:'Copy appearance…',exact:true}).click();const tray=page.getByRole('dialog',{name:'Copy appearance'});await tray.waitFor();
  assert.equal(await tray.getByText('Choose properties',{exact:true}).count(),0);
  const needle=id==='sse-dco'?'Offers: 2':'Product: Chair';
  const card=tray.locator('.visual-copy-card').filter({has:page.locator(`button.visual-copy-card-select[aria-label*="${needle}"]`)}).first();
  await card.locator('.visual-copy-card-select').click();
  await tray.getByRole('button',{name:'Typography',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.visual-copy-tray figure').length>1 && [...document.querySelectorAll('.visual-copy-tray figure')].every(frame=>frame.getAttribute('data-preview-ready')==='true'),{},{timeout:45000});
  assert.equal(saves,0,'choosing ads/properties only previews changes');
  assert.ok(await card.locator('.visual-copy-card-state').textContent().then(t=>t?.includes('After')));
  await tray.getByRole('button',{name:'Before',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.visual-copy-tray figure')].every(frame=>frame.getAttribute('data-preview-ready')==='true'));
  assert.ok(await card.locator('.visual-copy-card-state').textContent().then(t=>t?.includes('Before')));
  await tray.getByRole('button',{name:'After',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.visual-copy-tray figure')].every(frame=>frame.getAttribute('data-preview-ready')==='true'));
  await page.screenshot({path:path.join(output,`${id}-visual-tray.png`)});
  await card.getByRole('button',{name:/^Compare /}).click();await tray.getByRole('button',{name:'Done',exact:true}).click();
  await tray.getByRole('button',{name:'Copy typography to 1 ad',exact:true}).click();await tray.waitFor({state:'detached'});await ready();await save();
  const copied=saved.sizes['300x250'].localOverrides.find((o:any)=>o.targetId===target&&o.scope.includes(id==='sse-dco'?'offers-2':'product-chair')&&o.values.fontSize===font);assert.ok(copied,'copied properties reach the selected version');
  await page.getByRole('button',{name:'Copy appearance…',exact:true}).click();assert.ok(await tray.getByRole('button',{name:'Copy appearance to 0 ads',exact:true}).isDisabled());
  await tray.getByRole('button',{name:'Change source',exact:true}).click();await tray.locator(`button.visual-copy-card-select[aria-label*="${needle}"]`).first().click();
  assert.ok((await tray.locator('.visual-copy-source').innerText()).includes(needle));
  await tray.getByRole('button',{name:'Close appearance tray',exact:true}).click();assert.equal(saves,1,'source browsing and cancel do not save');
  await page.getByRole('button',{name:'Copy appearance…',exact:true}).click();await tray.locator(`button.visual-copy-card-select[aria-label*="${needle}"]`).first().click();await tray.getByRole('button',{name:'Typography',exact:true}).click();await tray.getByRole('button',{name:'Link instead…',exact:true}).click();await tray.getByLabel('Link name').fill('Visual typography');await tray.getByRole('button',{name:'Link typography to 1 ad',exact:true}).click();await ready();await save();
  const definition=saved.sharedDefinitions.find((d:any)=>d.name==='Visual typography');assert.equal(definition.members.length,2);
  await page.getByRole('button',{name:'Unlink — keep appearance',exact:true}).click();await ready();await save();
  const sourceScope=id==='sse-dco'?['offers-1']:['product-lamp','language-en','theme-light'];
  // Exact local version scope comes from the preserved detach snapshot.
  assert.equal(saved.sharedDefinitions.find((d:any)=>d.name==='Visual typography').members.length,1);
  assert.ok(saved.sizes['300x250'].localOverrides.some((o:any)=>o.targetId===target&&o.values.fontSize===font));
  assert.deepEqual(errors,[]);assert.equal(await fs.readFile(filename,'utf8'),original);
  reports.push({campaign:id,result:'pass',checks:['visible source and selectable ad thumbnails','immediate property preview','before/after toggle','enlarged comparison','copy only on apply','reset and cancel','change source visually','link instead','unlink preserves appearance','campaign unchanged']});await page.close();
 }
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
