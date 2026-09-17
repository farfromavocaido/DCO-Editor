/** Real breadcrumb/layout control checks with independently generated dynamic HTML. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,type Frame} from 'playwright';
import {renderStudioReadyHtml,renderWipHtml} from '../src/server/creative-exporter';
import {waitForProductionDocument,seekProductionAnimations} from '../src/lib/production-stage';
const origin=process.argv[2]||'http://localhost:5196';
async function main(){
 const file='campaign/sse-dco-creative.json',original=await fs.readFile(file,'utf8');let saved:any=JSON.parse(original);
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1650,height:1100}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(url=>url.pathname==='/api/creative',async route=>{if(route.request().method()==='POST')saved=route.request().postDataJSON();await route.fulfill({contentType:'application/json',body:JSON.stringify(saved)});});
  await page.route(url=>url.pathname==='/api/feed-schema/rows',async route=>{saved.feed.sampleRows=route.request().postDataJSON().rows;await route.fulfill({contentType:'application/json',body:JSON.stringify({rows:saved.feed.sampleRows})});});
  await page.goto(origin);const ready=async()=>{await page.waitForTimeout(80);await page.locator('[data-production-frame][data-ready="true"]').waitFor({timeout:45000});};await ready();
  await page.getByLabel('Ad size',{exact:true}).selectOption('300x250');await page.getByRole('button',{name:'Single offer',exact:true}).click();await ready();
  if(!await page.getByRole('button',{name:'Roundel component',exact:true}).count())await page.locator('[data-section="layers"] .sidebar-section-toggle').click();
  await page.getByRole('button',{name:'Roundel component',exact:true}).click();
  await page.locator('[aria-label="Inspector"]').getByRole('button',{name:'Roundel Text',exact:true}).click();
  const nav=page.getByLabel('Component editing path');assert.equal(await nav.getByLabel('Component part').inputValue(),'roundel-copy');
  await nav.getByLabel('Component part').selectOption('roundel-value');assert.equal(await nav.getByLabel('Component part').inputValue(),'roundel-value');
  await nav.getByRole('button',{name:'Exit component',exact:true}).click();assert.equal(await nav.getByLabel('Component part').count(),0);
  await page.locator('[aria-label="Inspector"]').getByRole('button',{name:'Roundel Text',exact:true}).click();
  await nav.getByRole('button',{name:'Roundel',exact:true}).click();assert.equal(await nav.getByLabel('Component part').count(),0);
  await page.locator('[aria-label="Inspector"]').getByRole('button',{name:'Roundel Text',exact:true}).click();
  const getFrame=async()=>await page.locator('[data-production-frame]').elementHandle().then(h=>h!.contentFrame()) as Frame;
  const initialRow=await (await getFrame()).evaluate(()=>(window as any).__SSE_DCO_APPLIED_ROW__);
  const number=initialRow.roundel_value_text;assert.ok(String(number).length);
  const exported=await browser.newPage();
  const html=renderWipHtml(await renderStudioReadyHtml(saved,'300x250'),initialRow);
  await exported.route(`${origin}/navigation-dynamic.html`,route=>route.fulfill({contentType:'text/html',body:html}));await exported.goto(`${origin}/navigation-dynamic.html`);await exported.evaluate(`(${waitForProductionDocument.toString()})(document)`);
  const measure=()=>['roundel-copy','roundel-value'].map(id=>{const el=document.getElementById(id)!,s=getComputedStyle(el);return {id,text:el.textContent,width:s.width,height:s.height,left:s.left,top:s.top,font:s.fontSize,line:s.lineHeight,visibility:s.visibility,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight};});
  for(const label of ['Text only','Text + number']) {
   await nav.getByRole('button',{name:label,exact:true}).click();await ready();const frame=await getFrame();
   const row=await frame.evaluate(()=>(window as any).__SSE_DCO_APPLIED_ROW__);
   assert.equal(row.roundel_value_text,label==='Text only'?'':number);
   await exported.evaluate(row=>(window as any).applySseDcoRuntimeState(row),row);await exported.evaluate(`(${waitForProductionDocument.toString()})(document)`);
   await frame.evaluate(`(${seekProductionAnimations.toString()})(document,60,15)`);await exported.evaluate(`(${seekProductionAnimations.toString()})(document,60,15)`);
   assert.deepEqual(await frame.evaluate(measure),await exported.evaluate(measure),`${label} editor/dynamic file parity`);
  }
  await nav.getByRole('button',{name:'Text only',exact:true}).click();await ready();
  await page.getByRole('button',{name:'More actions',exact:true}).click();
  await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/feed-schema/rows'&&r.request().method()==='POST'),page.getByRole('menuitem',{name:'Save sample values',exact:true}).click()]);
  assert.ok(saved.feed.sampleRows.some((r:any)=>r.Unique_ID===initialRow.Unique_ID&&r.roundel_value_text===''),'saving preserves selected feed state');
  await page.locator('[aria-label="Inspector"]').getByRole('textbox',{name:'Font size',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await nav.getByLabel('Component part').inputValue(),'roundel-copy','Enter in a field does not unexpectedly navigate');
  await page.keyboard.press('Escape');assert.equal(await nav.getByLabel('Component part').count(),0);await nav.getByRole('button',{name:'Roundel',exact:true}).waitFor();
  assert.deepEqual(errors,[]);assert.equal(await fs.readFile(file,'utf8'),original);
  await page.screenshot({path:'output/versions/component-navigation.png'});
  console.log('PASS breadcrumbs, part switching, exit/Escape, preserved number, saved feed state, text-only/text+number dynamic HTML parity; campaign unchanged');
 }finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
