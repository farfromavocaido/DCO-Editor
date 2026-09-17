/** Exercises authored rules without writing the client campaign: persistence is intercepted. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium,type Frame} from 'playwright';
import {renderStudioReadyHtml,renderWipHtml} from '../src/server/creative-exporter';
import {waitForProductionDocument} from '../src/lib/production-stage';
const origin=process.argv[2]||'http://localhost:5198';
async function main(){
 const original=await fs.readFile('campaign/sse-dco-creative.json','utf8');let saved=JSON.parse(original),payload:any;
 const browser=await chromium.launch({headless:true});try{
  const page=await browser.newPage({viewport:{width:1650,height:1100}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(url=>url.pathname==='/api/creative',async route=>{if(route.request().method()==='POST')saved=route.request().postDataJSON();await route.fulfill({contentType:'application/json',body:JSON.stringify(saved)});});
  await page.route(url=>/\/api\/creative\/[^/]+\/view/.test(url.pathname),async route=>{payload=route.request().postDataJSON();await route.continue();});
  await page.goto(origin);
  const ready=async()=>{await page.waitForTimeout(100);await page.locator('[data-production-frame][data-ready="true"]').waitFor({timeout:45000});};await ready();
  const frame=async()=>await page.locator('[data-production-frame]').elementHandle().then(h=>h!.contentFrame()) as Frame;
  await page.getByLabel('Ad size',{exact:true}).selectOption('300x600');await ready();
  await page.locator('summary').filter({hasText:/^Fonts$/}).click();
  const fonts=page.getByRole('region',{name:'Campaign fonts'});
  await fonts.getByRole('button',{name:'Museo · 700 · normal',exact:true}).click();await fonts.getByRole('button',{name:'Save face',exact:true}).click();await fonts.getByRole('status').filter({hasText:'Font saved'}).waitFor();await ready();
  assert.equal(payload.document.fonts[0].weight,700);await page.locator('summary').filter({hasText:/^Fonts$/}).click();
  await page.locator('summary').filter({hasText:/^Campaign states$/}).click();
  const states=page.getByRole('region',{name:'Campaign state controller'});await states.locator('summary').filter({hasText:/^Offers$/}).click();
  await states.locator('details[open]').getByLabel('Name',{exact:true}).fill('Offer options');await states.getByRole('button',{name:'Apply states',exact:true}).click();await ready();assert.equal(payload.document.campaignState.dimensions.find((d:any)=>d.id==='offerCount').label,'Offer options');
  await page.locator('summary').filter({hasText:/^Campaign states$/}).click();
  const rules=page.locator('.selected-layout-rules');await rules.locator('summary').click();
  await rules.getByRole('button',{name:'+ Conditional placement',exact:true}).click();await rules.getByLabel('Condition source').selectOption('campaign');await rules.getByText('Limit to campaign versions',{exact:true}).click();
  await rules.getByLabel('Name',{exact:true}).fill('Photo width when single offer');await rules.getByLabel('Offer options',{exact:true}).selectOption('offers-1');await rules.getByLabel('Width (px)',{exact:true}).fill('240');await rules.getByRole('button',{name:'Apply rule',exact:true}).click();await ready();
  const article=rules.locator('article').filter({hasText:'Photo width when single offer'});await article.getByText('Active',{exact:true}).waitFor();
  assert.equal(await (await frame()).locator('#bg-image').evaluate(e=>getComputedStyle(e).width),'240px');
  await article.getByRole('button',{name:'Disable',exact:true}).click();await ready();assert.equal(await (await frame()).locator('#bg-image').evaluate(e=>getComputedStyle(e).width),'300px');
  await article.getByRole('button',{name:'Enable',exact:true}).click();await ready();
  await page.getByRole('button',{name:'Dual offers',exact:true}).click();await ready();await article.getByText('Enabled · inactive',{exact:true}).waitFor();assert.equal(await (await frame()).locator('#bg-image').evaluate(e=>getComputedStyle(e).width),'300px');
  await page.getByRole('button',{name:'Single offer',exact:true}).click();await ready();
  await rules.getByRole('button',{name:'+ Keep a gap',exact:true}).click();await rules.getByLabel('Name',{exact:true}).fill('Photo top spacing');await rules.getByLabel('Gap',{exact:true}).fill('10');await rules.getByRole('button',{name:'Apply rule',exact:true}).click();await ready();
  const spacing=rules.locator('article').filter({hasText:'Photo top spacing'});await spacing.getByText('Active',{exact:true}).waitFor();
  assert.equal(await (await frame()).locator('#bg-image').evaluate(e=>getComputedStyle(e).top),'10px');
  await page.getByRole('slider',{name:'bg-image gap',exact:true}).press('ArrowDown');await ready();assert.equal(await (await frame()).locator('#bg-image').evaluate(e=>getComputedStyle(e).top),'11px');
  const current=structuredClone(payload),exported=await browser.newPage();
  const html=renderWipHtml(await renderStudioReadyHtml(current.document,'300x600',{fontBasePath:'assets/fonts/'}),current.row);
  await exported.route(`${origin}/rules-export.html`,r=>r.fulfill({contentType:'text/html',body:html}));await exported.goto(`${origin}/rules-export.html`);await exported.evaluate(`(${waitForProductionDocument.toString()})(document)`);
  const geometry=()=>{const e=document.getElementById('bg-image')!,s=getComputedStyle(e);return {left:s.left,top:s.top,width:s.width,height:s.height};};assert.deepEqual(await exported.evaluate(geometry),await (await frame()).evaluate(geometry));
  await spacing.getByLabel('Copy destination for Photo top spacing').selectOption(JSON.stringify(['300x250','bg-image']));await spacing.getByRole('button',{name:'Link',exact:true}).click();await ready();assert.equal(payload.document.layoutRules.find((r:any)=>r.name==='Photo top spacing').targets.length,2);
  await spacing.getByRole('button',{name:'Unlink',exact:true}).click();await ready();
  const local=rules.locator('article').filter({hasText:'Photo top spacing · local'});await local.getByRole('button',{name:'Freeze position',exact:true}).click();await ready();assert.equal(await (await frame()).locator('#bg-image').evaluate(e=>getComputedStyle(e).top),'11px');assert.ok(!payload.document.layoutRules.some((r:any)=>r.name==='Photo top spacing · local'));
  await page.screenshot({path:'output/rules/editor-rules.png'});assert.deepEqual(errors,[]);assert.equal(await fs.readFile('campaign/sse-dco-creative.json','utf8'),original);
  console.log('PASS font editing, campaign labels, conditional active/inactive/disabled, responsive placement, independent export parity, cross-format linking, unlink and freeze; SSE source unchanged');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
