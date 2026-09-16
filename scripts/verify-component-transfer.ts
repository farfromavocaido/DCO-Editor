/** Whole-component browser workflow. Persistence is intercepted; approved files never change. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {componentBounds} from '../src/lib/creative-components';
import {findCreativeTarget} from '../src/lib/creative-model';
import {renderStudioReadyHtml,renderWipHtml} from '../src/server/creative-exporter';
import {waitForProductionDocument,seekProductionAnimations} from '../src/lib/production-stage';
import {campaignScopes} from '../src/lib/campaign-variants';
const origin=process.argv[2]||'http://localhost:5194';
async function main(){
 const file='campaign/sse-dco-creative.json',original=await fs.readFile(file,'utf8');let saved:any=JSON.parse(original);
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1650,height:1150}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(url=>url.pathname==='/api/creative',async route=>{if(route.request().method()==='POST')saved=route.request().postDataJSON();await route.fulfill({contentType:'application/json',body:JSON.stringify(saved)});});
  const ready=async()=>{await page.waitForTimeout(100);await page.locator('[data-production-frame][data-ready="true"]').waitFor({timeout:45000});};
  const previewReady=async()=>page.waitForFunction(()=>document.querySelectorAll('.visual-copy-tray figure').length>1&&[...document.querySelectorAll('.visual-copy-tray figure')].every(el=>el.getAttribute('data-preview-ready')==='true'),{},{timeout:45000});
  const save=async()=>{await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/creative'&&r.request().method()==='POST'),page.getByRole('button',{name:'Save creative',exact:true}).click()]);};
  await page.goto(origin);await ready();await page.getByLabel('Ad size',{exact:true}).selectOption('300x250');await page.getByRole('button',{name:'Single offer',exact:true}).click();await ready();
  if(!await page.getByRole('button',{name:'Roundel component',exact:true}).count())await page.locator('[data-section="layers"] .sidebar-section-toggle').click();
  await page.getByRole('button',{name:'Roundel component',exact:true}).click();
  const stage=await page.locator('[data-production-frame]').elementHandle().then(h=>h!.contentFrame());const row=await stage!.evaluate(()=>(window as any).__SSE_DCO_APPLIED_ROW__);const scopes=campaignScopes(saved,row);
  const sourceBox=componentBounds(saved,'300x250','component:roundel',scopes),destBox=componentBounds(saved,'300x600','component:roundel',scopes);
  assert.ok(sourceBox&&destBox);
  const tray=page.getByRole('dialog',{name:'Copy appearance'});
  const open=async()=>{await page.getByRole('button',{name:'Copy appearance…',exact:true}).click();await tray.waitFor();};
  const pickDouble=async()=>tray.locator('button.visual-copy-card-select[aria-label^="Select 300x600 "]').first().click();
  const destFrame=async()=>tray.locator('.visual-copy-card.is-picked iframe').elementHandle().then(h=>h!.contentFrame());
  const frameMetric=async()=>{const f=await destFrame();return f!.locator('#roundel-frame').evaluate(el=>{const s=getComputedStyle(el);return {left:parseFloat(s.left),top:parseFloat(s.top),width:parseFloat(s.width),height:parseFloat(s.height)};});};
  await open();await pickDouble();await previewReady();assert.match(await tray.innerText(),/Whole roundel/);
  let metric=await frameMetric();assert.equal(metric.width,destBox.width);assert.equal(metric.height,destBox.height);assert.equal(metric.left,destBox.left);
  await tray.getByLabel('Component sizing').selectOption('source');await previewReady();metric=await frameMetric();assert.equal(metric.width,sourceBox.width);assert.equal(metric.left,destBox.left+(destBox.width-sourceBox.width)/2);
  await tray.getByLabel('Component sizing').selectOption('destination');await tray.getByLabel('Preview Roundel copy').selectOption('roundel-copy-only');await previewReady();
  assert.equal(await (await destFrame())!.locator('#roundel-value').evaluate(el=>getComputedStyle(el).visibility),'hidden');
  await tray.getByLabel('Preview Roundel copy').selectOption('roundel-split');await previewReady();assert.equal(await (await destFrame())!.locator('#roundel-value').evaluate(el=>getComputedStyle(el).visibility),'visible');
  await tray.locator('.visual-copy-card.is-picked').getByRole('button',{name:/^Compare /}).click();await previewReady();
  await tray.getByLabel('Proposed left').fill(String(destBox.left+17));await previewReady();
  const ghost=tray.locator('[data-component-placement="true"]');const dragBox=await ghost.boundingBox();assert.ok(dragBox);
  await page.mouse.move(dragBox.x+5,dragBox.y+5);await page.mouse.down();await page.mouse.move(dragBox.x+11,dragBox.y+5,{steps:3});await page.mouse.up();await previewReady();
  const expectedLeft=destBox.left+27;assert.ok(Math.abs(Number(await tray.getByLabel('Proposed left').inputValue())-expectedLeft)<0.02,'drag adjusts destination component position');
  const handle=tray.getByRole('button',{name:'Resize proposed component'});const handleBox=await handle.boundingBox();assert.ok(handleBox);
  await page.mouse.move(handleBox.x+handleBox.width/2,handleBox.y+handleBox.height/2);await page.mouse.down();await page.mouse.move(handleBox.x+handleBox.width/2+6,handleBox.y+handleBox.height/2,{steps:3});await page.mouse.up();await previewReady();
  assert.ok(Math.abs(Number(await tray.getByLabel('Proposed width').inputValue())-destBox.width-10)<0.02,'handle scales whole roundel');
  assert.equal(await tray.getByLabel('Proposed width').inputValue(),await tray.getByLabel('Proposed height').inputValue(),'roundel stays circular');
  await page.screenshot({path:'output/versions/component-double-mpu.png'});
  await tray.getByRole('button',{name:'Done',exact:true}).click();await tray.getByRole('button',{name:'Copy roundel to 1 ad',exact:true}).click();await ready();await save();
  const split=[...scopes.filter((s:string)=>!s.startsWith('roundel-split')&&!s.startsWith('roundel-copy-only')),'roundel-split'];const copy=split.map((s:string)=>s==='roundel-split'?'roundel-copy-only':s);
  for(const states of [split,copy]){assert.equal(componentBounds(saved,'300x600','component:roundel',states)!.left,expectedLeft);for(const id of ['roundel-frame','roundel-copy','roundel-value'])assert.ok(saved.sizes['300x600'].localOverrides.some((v:any)=>v.targetId===id&&v.scope.includes(states.at(-1))),'all parts/arrangements authored');}
  assert.deepEqual(saved.sizes['300x250'],JSON.parse(original).sizes['300x250'],'copy preserves source');
  await open();await pickDouble();await tray.getByRole('button',{name:'Link instead…',exact:true}).click();await tray.getByLabel('Link name').fill('Roundel design');await tray.getByRole('button',{name:'Link roundel to 1 ad',exact:true}).click();await ready();await save();assert.equal(saved.componentLinks.length,1);
  await page.locator('[aria-label="Inspector"]').getByRole('button',{name:'Roundel Text',exact:true}).click();await page.getByRole('textbox',{name:'Font size',exact:true}).fill('21');await ready();await save();
  const ratio=componentBounds(saved,'300x600','component:roundel',split)!.width/sourceBox.width;assert.ok(Math.abs(findCreativeTarget(saved,'300x600','roundel-copy',split).values.fontSize-21*ratio)<0.001,'source design propagates with destination scale');
  await page.getByLabel('Ad size',{exact:true}).selectOption('300x600');await ready();await page.getByRole('button',{name:'Roundel component',exact:true}).click();
  const liveFrame=await page.locator('[data-production-frame]').elementHandle().then(h=>h!.contentFrame());
  const liveRow=await liveFrame!.evaluate(()=>(window as any).__SSE_DCO_APPLIED_ROW__);
  const exported=await browser.newPage();const exportedHtml=renderWipHtml(await renderStudioReadyHtml(saved,'300x600'),liveRow);
  await exported.route(`${origin}/component-export.html`,route=>route.fulfill({contentType:'text/html',body:exportedHtml}));await exported.goto(`${origin}/component-export.html`);await exported.evaluate(`(${waitForProductionDocument.toString()})(document)`);
  const componentMetrics=()=>['roundel-frame','roundel-copy','roundel-value'].map(id=>{const el=document.getElementById(id)!,s=getComputedStyle(el),b=el.getBoundingClientRect();return {id,text:el.textContent,font:s.fontSize,lineHeight:s.lineHeight,width:b.width,height:b.height,left:b.left,top:b.top,visibility:s.visibility};});
  for(const percent of [37.5,60,83]){await liveFrame!.evaluate(`(${seekProductionAnimations.toString()})(document,${percent},15)`);await exported.evaluate(`(${seekProductionAnimations.toString()})(document,${percent},15)`);assert.deepEqual(await liveFrame!.evaluate(componentMetrics),await exported.evaluate(componentMetrics),'linked editor/export parity');}
  await exported.close();
  const beforeMove=componentBounds(saved,'300x600','component:roundel',split);assert.ok(beforeMove);await page.getByRole('spinbutton',{name:'X',exact:true}).fill(String(beforeMove.left+10));await ready();await save();
  for(const states of [split,copy])assert.equal(componentBounds(saved,'300x600','component:roundel',states)!.left,beforeMove.left+10,'both arrangements move together');
  const linkedValue=findCreativeTarget(saved,'300x600','roundel-copy',split).values.fontSize;
  await page.getByRole('button',{name:'Unlink — keep appearance',exact:true}).click();await ready();await save();assert.equal(saved.componentLinks.length,0);assert.equal(findCreativeTarget(saved,'300x600','roundel-copy',split).values.fontSize,linkedValue);
  await page.getByLabel('Ad size',{exact:true}).selectOption('300x250');await ready();await page.getByRole('button',{name:'CTA component',exact:true}).click();await open();await pickDouble();await previewReady();await tray.getByRole('button',{name:'Copy cta to 1 ad',exact:true}).click();await ready();await save();
  assert.equal(findCreativeTarget(saved,'300x600','cta',scopes).values.fontSize,findCreativeTarget(saved,'300x250','cta',scopes).values.fontSize,'CTA frame policy retains source label size');
  assert.deepEqual(errors,[]);assert.equal(await fs.readFile(file,'utf8'),original);
  console.log('PASS component MPU→Double MPU: whole roundel, both arrangements, sizing, placement, live design link, hidden-state move, unlink, CTA, source/campaign preserved');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
