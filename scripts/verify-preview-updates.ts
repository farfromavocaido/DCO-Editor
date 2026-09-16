/** Browser regression for live production reuse. All authored writes stay in memory. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const origin=process.argv[2] || 'http://localhost:5186';
async function main() {
 const original=await fs.readFile('campaign/sse-dco-creative.json','utf8');
 let saved=JSON.parse(original);
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:1100}});
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.route(url=>url.pathname==='/api/creative',async route=>{
   if(route.request().method()==='POST') saved=route.request().postDataJSON();
   await route.fulfill({contentType:'application/json',body:JSON.stringify(saved)});
  });
  let requests=0, latestPayload:any;
  page.on('request',request=>{if(request.method()==='POST' && /\/creative\/[^/]+\/view/.test(request.url())) {requests++;latestPayload=request.postDataJSON();}});
  await page.goto(origin);
  const ready=async()=>{await page.waitForTimeout(100); await page.locator('[data-production-frame][data-ready="true"]').waitFor();};
  await ready();
  await page.getByLabel('Ad size',{exact:true}).selectOption('300x250');
  await page.getByRole('button',{name:'Single offer',exact:true}).click(); await ready();
  await page.locator('[data-production-frame]').evaluate(el=>{(el as any).__retained='yes';});
  const countBefore=requests;
  const feedStart=Date.now();
  await page.getByRole('button',{name:'Dual offers',exact:true}).click(); await ready();
  assert.equal(requests,countBefore,'feed change must not regenerate production HTML');
  assert.equal(await page.locator('[data-production-frame]').evaluate(el=>(el as any).__retained),'yes');
  const feedMs=Date.now()-feedStart;
  if(!await page.getByRole('button',{name:'Roundel Frame layer',exact:true}).count()) await page.locator('[data-section="layers"] .sidebar-section-toggle').click();
  await page.getByRole('button',{name:'Roundel Frame layer',exact:true}).click();
  const x=page.getByLabel('X',{exact:true});
  const before=Number(await x.inputValue());
  const layoutStart=Date.now();
  await x.fill(String(before+11)); await ready();
  assert.equal(await page.locator('[data-production-frame]').evaluate(el=>(el as any).__retained),'yes','layout update retains loaded production frame');
  const frame=await page.locator('[data-production-frame]').elementHandle().then(el=>el!.contentFrame());
  assert.equal(await frame!.locator('#roundel-frame').evaluate(el=>parseFloat(getComputedStyle(el).left)),before+11);
  const layoutMs=Date.now()-layoutStart;
  await page.getByRole('button',{name:'Undo',exact:true}).click(); await ready();
  assert.equal(Number(await x.inputValue()),before);
  assert.equal(await page.locator('[data-production-frame]').evaluate(el=>(el as any).__retained),'yes');
  await page.getByRole('button',{name:'Roundel Text layer',exact:true}).click();
  await page.getByRole('textbox',{name:'Font size',exact:true}).fill('19'); await ready();
  await page.getByRole('textbox',{name:'Max lines',exact:true}).fill('2'); await ready();
  assert.equal(await page.locator('[data-production-frame]').evaluate(el=>(el as any).__retained),'yes','typography and fitting edits retain runtime');
  const response=await page.request.post(`${origin}/api/creative/300x250/view`,{data:latestPayload});
  assert.ok(response.ok());
  const fresh=await browser.newPage();
  await fresh.route(`${origin}/__verify-fresh`,async route=>route.fulfill({contentType:'text/html',body:await response.text()}));
  await fresh.goto(`${origin}/__verify-fresh`);
  await fresh.waitForFunction(()=>Boolean(document.querySelector('.stage.motion-ready')) && document.fonts.status==='loaded');
  await fresh.evaluate(async()=>{await (window as any).__SSE_DCO_SETTLED__;});
  const metrics=(el:Element)=>{const cs=getComputedStyle(el);return {fontSize:cs.fontSize,lineHeight:cs.lineHeight,width:cs.width,height:cs.height,whiteSpace:cs.whiteSpace,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,text:el.textContent};};
  assert.deepEqual(await frame!.locator('#roundel-copy').evaluate(metrics),await fresh.locator('#roundel-copy').evaluate(metrics),'reused typography/fit matches a fresh production document');
  await fresh.close();
  await page.getByRole('button',{name:'Roundel Frame layer',exact:true}).click();
  // Exercise undo while the previous CSS has applied but fitting is still pending.
  await frame!.evaluate(() => {
    const runtime = window as any;
    const apply = runtime.applySseDcoRuntimeState;
    runtime.applySseDcoRuntimeState = (row: any) => {
      apply(row);
      runtime.__SSE_DCO_SETTLED__ = Promise.all([runtime.__SSE_DCO_SETTLED__,new Promise(resolve=>setTimeout(resolve,400))]);
    };
  });
  await x.fill(String(before+29));
  await frame!.waitForFunction(value=>parseFloat(getComputedStyle(document.querySelector('#roundel-frame')!).left)===value,before+29);
  await page.getByRole('button',{name:'Undo',exact:true}).click(); await ready();
  assert.equal(await frame!.locator('#roundel-frame').evaluate(el=>parseFloat(getComputedStyle(el).left)),before,'undo during settlement must restore actual CSS, not just publish an old document reference');
  await page.getByRole('button',{name:'Single offer',exact:true}).click();
  await frame!.waitForFunction(()=>(window as any).__SSE_DCO_APPLIED_ROW__?.offer_count_num===1);
  await page.getByRole('button',{name:'Dual offers',exact:true}).click();
  await frame!.waitForFunction(()=>(window as any).__SSE_DCO_APPLIED_ROW__?.offer_count_num===2);
  assert.equal(await page.locator('[data-production-frame]').getAttribute('data-ready'),'false','returning to a published row stays blocked until its new fit settles');
  await ready();
  assert.equal(await frame!.evaluate(()=>(window as any).__SSE_DCO_APPLIED_ROW__.offer_count_num),2);
  await page.getByLabel('Preview rendition').selectOption('outline'); await ready();
  assert.equal(await page.locator('[data-production-frame]').getAttribute('data-render-mode'),'outline');
  assert.equal(await page.locator('[data-production-frame]').evaluate(el=>(el as any).__retained),undefined,'rendition change replaces runtime');
  assert.deepEqual(errors,[]);
  assert.equal(await fs.readFile('campaign/sse-dco-creative.json','utf8'),original);
  await fs.mkdir('output/clarity',{recursive:true});
  await fs.writeFile('output/clarity/preview-updates.json',JSON.stringify({feedMs,layoutMs,checks:['feed change without HTML request','CSS update retains iframe','live typography and fit match fresh production render','undo retains iframe','undo during pending fit restores CSS','row reversal remains blocked until fit settles','rendition reloads','campaign unchanged']},null,2));
  console.log(`PASS production iframe reuse; feed ${feedMs}ms, layout ${layoutMs}ms (includes 100ms verification wait)`);
 } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
