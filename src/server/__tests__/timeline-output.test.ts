// @ts-nocheck
import {beforeAll,afterAll,expect,test} from 'vitest';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {renderStudioReadyHtml,renderWipHtml} from '../creative-exporter';
import {projectRoot} from '../paths';
import {waitForProductionDocument,seekProductionAnimations,withProductionRestPose} from '@/lib/production-stage';
import {campaignFontFaces} from '@/lib/campaign-fonts';
import {campaignScopes} from '@/lib/campaign-variants';
import {readRenderedMotionFrames} from '@/lib/timeline-render-model';
import {makeMotionIndependent} from '@/lib/motion-overrides';
import sse from '../../test/fixtures/campaign/sse-dco-creative.json';
let browser,fontOptions;
beforeAll(async()=>{browser=await chromium.launch();const fontUrlMap={};for(const face of campaignFontFaces(sse)){const bytes=await fs.readFile(`${projectRoot}/assets/${face.asset}`);fontUrlMap[face.asset.split('/').pop()]=`data:font/otf;base64,${bytes.toString('base64')}`;}fontOptions={fontUrlMap};});
afterAll(async()=>browser?.close());
async function pageFor(html){const page=await browser.newPage();await page.route('https://s0.2mdn.net/**',r=>r.abort());await page.route('http://timeline.test/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/index.html')return route.fulfill({contentType:'text/html',body:html});try{return route.fulfill({contentType:path.endsWith('.svg')?'image/svg+xml':path.endsWith('.jpg')?'image/jpeg':'application/octet-stream',body:await fs.readFile(projectRoot+path)});}catch{return route.fulfill({status:404,body:''});}});await page.goto('http://timeline.test/index.html');await page.evaluate(`(${waitForProductionDocument.toString()})(document)`);return page;}
async function pose(page,id,at,duration=15){await page.evaluate(`(${seekProductionAnimations.toString()})(document,${at},${duration})`);return page.locator('#'+id).evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {x:r.x,y:r.y,opacity:Number(s.opacity),transform:s.transform};});}
test('timeline reads final headline keyframes; making timing independent retains the visible animation',async()=>{
 const d=structuredClone(sse);d.layoutRules=[];const row={...d.feed.sampleRows[0],offer_count_num:0,include_roundel_frame_bool:false,heading1_text:'First',heading2_text:'Second',heading4_text:'Last'};d.feed.sampleRows=[{...row,Default:true}];
 const page=await pageFor(renderWipHtml(await renderStudioReadyHtml(d,'300x250',fontOptions),row));
 let nextPage;try{
  const report=await page.evaluate(`(${readRenderedMotionFrames.toString()})(document.getElementById('headline-act2'),${d.clock.durationS})`);
  expect(report.name).toContain('-skip-');expect(report.frames.some(f=>f.opacity===1)).toBe(true);
  const next=makeMotionIndependent(d,'300x250','headline-act2',{preset:'custom',keyframes:report.frames},campaignScopes(d,row)).document;
  nextPage=await pageFor(renderWipHtml(await renderStudioReadyHtml(next,'300x250',fontOptions),row));
  for(const at of report.frames.filter(f=>(f.opacity??0)>0).map(f=>f.at)){
   const before=await pose(page,'headline-act2',at,d.clock.durationS),after=await pose(nextPage,'headline-act2',at,d.clock.durationS);
   expect(after.x).toBeCloseTo(before.x,2);expect(after.y).toBeCloseTo(before.y,2);expect(after.opacity).toBeCloseTo(before.opacity,4);
  }
  const at=report.frames.find(f=>f.opacity===1).at;await pose(nextPage,'headline-act2',at,d.clock.durationS);
  const rest=await nextPage.evaluate(`(${withProductionRestPose.toString()})(document.querySelector('.stage'),()=>getComputedStyle(document.getElementById('headline-act2')).transform)`);expect(rest).toBe('none');
  expect(await nextPage.locator('#headline-act2').evaluate(e=>getComputedStyle(e).animationName),await nextPage.locator('.stage').getAttribute('class')+' / '+JSON.stringify(next.sizes['300x250'].layers.find(l=>l.id==='headline-act2').motionOverrides[0].when)).toMatch(/^motion-override-/);
 const outlined=await pageFor(await renderStudioReadyHtml(next,'300x250',{...fontOptions,renderMode:'outline'}));try{for(const at of report.frames.filter(f=>(f.opacity??0)>0).map(f=>f.at)){const live=await pose(nextPage,'headline-act2',at,d.clock.durationS),fixed=await pose(outlined,'headline-act2',at,d.clock.durationS);expect(fixed.transform).toBe(live.transform);expect(fixed.opacity).toBeCloseTo(live.opacity,4);}}finally{await outlined.close();}
 }finally{await nextPage?.close();await page.close();}
});
test('shared stack placement and opacity survive both font and outlined output without double movement',async()=>{
 const asset='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>');
 const d={campaign:{id:'test',name:'Stack test'},clock:{durationS:10,beats:{},loop:false},variantModel:{dimensions:[]},feed:{sampleRows:[{Default:true}],fields:[]},sizes:{'300x250':{canvas:{width:300,height:250},classRules:[],variantRules:[],layers:[{id:'a',kind:'image',asset,base:{left:20,top:40,width:20,height:20},zIndex:0,clips:[]},{id:'b',kind:'image',asset,base:{left:80,top:50,width:20,height:20},zIndex:1,clips:[]}],timelineFolders:[{id:'stack',name:'Pair',members:['a','b'],effects:{enabled:true,x:17,y:11,opacity:.5}}]}}};
 for(const renderMode of ['font','outline']){
  const page=await pageFor(renderWipHtml(await renderStudioReadyHtml(d,'300x250',{...fontOptions,renderMode}),d.feed.sampleRows[0]));try{
   expect(await page.locator('[data-stack-root]').count()).toBe(1);
   const a=await pose(page,'a',50,10),b=await pose(page,'b',50,10);
   expect(a.x).toBeCloseTo(37,2);expect(a.y).toBeCloseTo(51,2);expect(b.x-a.x).toBeCloseTo(60,2);
   expect(await page.locator('[data-stack-root]').evaluate(e=>getComputedStyle(e).opacity)).toBe('0.5');
  }finally{await page.close();}
 }
});
