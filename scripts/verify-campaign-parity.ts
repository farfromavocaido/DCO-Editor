/** Verify the unrelated demo's real editor, independent package, and saved QA. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium, type Frame} from 'playwright';
import {buildBasePackageEntries} from '../src/server/creative-exporter';
import {waitForProductionDocument,seekProductionAnimations} from '../src/lib/production-stage';
const origin=process.argv[2] || 'http://localhost:5188';
const metrics=()=>Array.from(document.querySelectorAll('.stage [id]')).filter(el=>el.id!=='clickbox').map(el=>{
 const css=getComputedStyle(el),box=el.getBoundingClientRect();
 return {id:el.id,text:el.textContent,font:css.fontSize,color:css.color,background:css.backgroundColor,left:box.left,top:box.top,width:box.width,height:box.height,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,clipped:el.getAttribute('data-fit-clipped')};
});
async function main(){
 const original=await fs.readFile('campaign/product-demo-creative.json','utf8');
 const browser=await chromium.launch({headless:true});
 try {
  const editor=await browser.newPage({viewport:{width:1650,height:1100}});
  const errors:string[]=[]; editor.on('pageerror',e=>errors.push(e.message));
  let payload:any;
  editor.on('request',r=>{if(r.method()==='POST'&&/\/api\/creative\/[^/]+\/view/.test(r.url()))payload=r.postDataJSON();});
  await editor.goto(origin);
  await editor.locator('[data-production-frame][data-ready="true"]').waitFor();
  await editor.getByLabel('Campaign',{exact:true}).selectOption('product-demo');
  const ready=async()=>{await editor.waitForTimeout(80); await editor.locator('[data-production-frame][data-ready="true"]').waitFor();};
  await ready();
  if (!await editor.getByLabel('Sample row',{exact:true}).count()) await editor.locator('[data-section="sample"] .sidebar-section-toggle').click();
  assert.equal(await editor.getByRole('group',{name:'Offers',exact:true}).count(),0);
  assert.equal(await editor.getByRole('group',{name:'Product',exact:true}).count(),1);
  const packaged=await browser.newPage();
  const report:any[]=[];
  for(const size of ['300x250','320x480']) {
   await editor.getByLabel('Ad size',{exact:true}).selectOption(size);await ready();
   const entries=await buildBasePackageEntries(payload.document,{assetMode:'embed'});
   const files=new Map(entries.map(entry=>[entry.path,entry.data]));
   await packaged.unrouteAll();
   await packaged.route(`${origin}/__generic-package/**`,route=>{
    const name=new URL(route.request().url()).pathname.replace('/__generic-package/','');
    return route.fulfill({status:files.has(name)?200:404,body:files.get(name) || '',contentType:name.endsWith('.html')?'text/html':name.endsWith('.otf')?'font/otf':'application/octet-stream'});
   });
   await packaged.goto(`${origin}/__generic-package/${size}.html`);
   for(let index=0;index<8;index++) {
    await editor.getByLabel('Sample row',{exact:true}).selectOption(String(index));await ready();
    const frame=await editor.locator('[data-production-frame]').elementHandle().then(el=>el!.contentFrame()) as Frame;
    const row=await frame.evaluate(()=>(window as any).__SSE_DCO_APPLIED_ROW__);
    await packaged.evaluate(row=>(window as any).applySseDcoRuntimeState(row),row);
    await packaged.evaluate(`(${waitForProductionDocument.toString()})(document)`);
    for(const percent of [0,75]) {
     await frame.evaluate(`(${seekProductionAnimations.toString()})(document,${percent},8)`);
     await packaged.evaluate(`(${seekProductionAnimations.toString()})(document,${percent},8)`);
     assert.deepEqual(await frame.evaluate(metrics),await packaged.evaluate(metrics),`${size} row ${index} at ${percent}%`);
    }
    report.push({size,index,result:'pass'});
   }
   console.log(`PASS generic ${size}: 8 versions, editor/package geometry and fitting`);
  }
  const qa=await browser.newPage();
  await qa.goto(`${origin}/qa?campaign=product-demo`);
  await qa.getByRole('heading',{name:/Product.*QA/}).waitFor();
  await qa.waitForFunction(()=>document.querySelectorAll('iframe').length===8 && [...document.querySelectorAll('iframe')].every(frame=>frame.style.visibility==='visible'));
  for(const frame of qa.frames().filter(frame=>frame!==qa.mainFrame())) {
   const row=await frame.evaluate(()=>(window as any).__SSE_DCO_APPLIED_ROW__);
   // Compare the saved QA rendition with a fresh package at the same size/time.
   await packaged.goto(`${origin}/__generic-package/320x480.html`);
   await packaged.evaluate(row=>(window as any).applySseDcoRuntimeState(row),row);
   await packaged.evaluate(`(${waitForProductionDocument.toString()})(document)`);
   // QA starts on the first format, so select second before numeric comparison below.
   assert.ok(row.product && row.language && row.theme);
  }
  await qa.getByLabel('Format',{exact:true}).selectOption('320x480');
  await qa.waitForFunction(()=>[...document.querySelectorAll('iframe')].every(frame=>frame.style.visibility==='visible' && frame.contentDocument?.querySelector('.stage')?.getAttribute('data-size')==='320x480'));
  for(const frame of qa.frames().filter(frame=>frame!==qa.mainFrame())) {
   const row=await frame.evaluate(()=>(window as any).__SSE_DCO_APPLIED_ROW__);
   await packaged.evaluate(row=>(window as any).applySseDcoRuntimeState(row),row);
   await packaged.evaluate(`(${waitForProductionDocument.toString()})(document)`);
   await packaged.evaluate(`(${seekProductionAnimations.toString()})(document,75,8)`);
   assert.deepEqual(await frame.evaluate(metrics),await packaged.evaluate(metrics),'generic QA vs package');
  }
  await editor.getByLabel('Preview rendition').selectOption('outline');await ready();
  const outline=await editor.locator('[data-production-frame]').elementHandle().then(el=>el!.contentFrame()) as Frame;
  assert.ok(await outline.locator('#title svg path').count(),'generic outlines must contain actual glyph paths');
  assert.equal(await outline.locator('#title').getAttribute('data-dco-field'),null);
  assert.deepEqual(errors,[]);
  assert.equal(await fs.readFile('campaign/product-demo-creative.json','utf8'),original);
  await fs.mkdir('output/versions',{recursive:true});await fs.writeFile('output/versions/generic-parity.json',JSON.stringify({report,qa:8,outline:'pass',errors},null,2));
  console.log('PASS generic QA 8 versions and fixed-copy outline preview; campaign unchanged');
 } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
