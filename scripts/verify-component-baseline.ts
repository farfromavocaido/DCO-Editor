/** Compare the new runtime with archived, approved SSE HTML. Never rewrites campaign files. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {renderStudioReadyHtml,renderWipHtml} from '../src/server/creative-exporter';
import {readCreativeDocument} from '../src/server/creative-document';
import {waitForProductionDocument,seekProductionAnimations} from '../src/lib/production-stage';
const origin=process.argv[2]||'http://localhost:5194';
const baseline=process.argv[3]||'/Users/aidancoughlan/.codex/backups/dco-campaign-versions-20260916';
const measure=()=>Array.from(document.querySelectorAll('.stage [id],.offer-value,.offer-subline,.terms-solo')).filter(el=>el.id!=='clickbox').map(el=>{
 const cs=getComputedStyle(el),b=el.getBoundingClientRect();
 return {id:el.id||`${el.parentElement?.id}:${el.className}`,text:el.textContent,font:cs.fontSize,lineHeight:cs.lineHeight,tracking:cs.letterSpacing,color:cs.color,visibility:cs.visibility,opacity:cs.opacity,display:cs.display,left:Math.round(b.left*100)/100,top:Math.round(b.top*100)/100,width:Math.round(b.width*100)/100,height:Math.round(b.height*100)/100,scrollHeight:el.scrollHeight,scrollWidth:el.scrollWidth};
});
async function main(){const doc:any=await readCreativeDocument(),browser=await chromium.launch({headless:true});let checks=0;
 try{for(const size of Object.keys(doc.sizes)){
  const old=await browser.newPage(),next=await browser.newPage();
  const initial=doc.feed.sampleRows[0];
  const oldHtml=renderWipHtml(await fs.readFile(`${baseline}/${size}.html`,'utf8'),initial);
  const nextHtml=renderWipHtml(await renderStudioReadyHtml(doc,size),initial);
  for(const [page,html,version] of [[old,oldHtml,'old'],[next,nextHtml,'next']] as const){await page.route(`${origin}/component-baseline-${version}.html`,route=>route.fulfill({contentType:'text/html',body:html}));await page.goto(`${origin}/component-baseline-${version}.html`);await page.evaluate(`(${waitForProductionDocument.toString()})(document)`);}
  for(const offers of [0,1,2,3]){
   const row={...(doc.feed.sampleRows.find((r:any)=>Number(r.offer_count_num)===offers)||initial),offer_count_num:offers};
   for(const p of [old,next]){await p.evaluate(row=>(window as any).applySseDcoRuntimeState(row),row);await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);}
   for(const percent of [0,19,37.5,60,83,99]){for(const p of [old,next])await p.evaluate(`(${seekProductionAnimations.toString()})(document,${percent},${doc.clock.durationS})`);assert.deepEqual(await next.evaluate(measure),await old.evaluate(measure),`${size} ${offers} offers at ${percent}%`);checks++;}
  }
  await old.close();await next.close();console.log(`PASS approved SSE baseline ${size}`);
 }
 console.log(`PASS ${checks} archived/new output geometry, fitting and visibility comparisons`);
 }finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;});
