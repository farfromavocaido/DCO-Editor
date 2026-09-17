// @ts-nocheck
import {beforeAll,afterAll,expect,test} from 'vitest';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {renderStudioReadyHtml,renderWipHtml} from '../creative-exporter';
import {captureProductionPresentation} from '../production-snapshot';
import {projectRoot} from '../paths';
import {waitForProductionDocument,seekProductionAnimations} from '@/lib/production-stage';
import {createResponsiveLayoutRuntime,responsiveLayoutSource} from '@/lib/responsive-layout';
import {motionGeometry,editMotionGeometry} from '@/lib/motion-geometry';
import {campaignScopes} from '@/lib/campaign-variants';
import {validateLayoutRules} from '@/lib/layout-rules';
import sse from '../../../campaign/sse-dco-creative.json';
let browser,fontOptions;
beforeAll(async()=>{browser=await chromium.launch();const bytes=await fs.readFile(`${projectRoot}/assets/fonts/Museo700-Regular.otf`);fontOptions={fontUrlMap:{'Museo700-Regular.otf':`data:font/otf;base64,${bytes.toString('base64')}`}};});
afterAll(async()=>browser.close());
async function pageFor(html){const page=await browser.newPage();await page.route('https://s0.2mdn.net/**',r=>r.abort());await page.route('http://motion.test/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/index.html')return route.fulfill({contentType:'text/html',body:html});try{return route.fulfill({contentType:path.endsWith('.svg')?'image/svg+xml':path.endsWith('.jpg')?'image/jpeg':'application/octet-stream',body:await fs.readFile(projectRoot+path)});}catch{return route.fulfill({status:404,body:''});}});await page.goto('http://motion.test/index.html');await page.evaluate(`(${waitForProductionDocument.toString()})(document)`);return page;}
const fixture=()=>({campaign:{id:'test',name:'Test'},clock:{durationS:10,loop:true,beats:{start:0,end:100}},variantModel:{dimensions:[]},feed:{sampleRows:[{copy:'Terms apply',Default:true}],fields:[]},sizes:{'300x250':{canvas:{width:300,height:250},classRules:[],variantRules:[],layers:[{id:'mark',kind:'image',asset:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30"><rect width="80" height="30" fill="red"/></svg>'),base:{left:80,top:100,width:80,height:30},clips:[]},{id:'legal',kind:'text',binding:{field:'copy'},base:{left:20,top:180,width:260,height:50,fontFamily:'Museo',fontWeight:700,fontSize:16,lineHeight:1.2,display:'flex',alignItems:'flex-end'},fit:{frame:'auto',mode:'wrap',maxLines:6,wrap:true},clips:[{id:'exit',label:'Terms exit',preset:'fade',start:10,end:60,params:{enter_duration_pct:10,fade_pct:10}}]}]}}});
const area=()=>({id:'area',name:'Area',type:'distribute',enabled:true,targets:[{size:'300x250',targetId:'mark'},{size:'300x250',targetId:'legal'}],areas:{'300x250':{left:20,top:40,width:260,height:190}},axis:'y',single:'center',minGap:0,overflow:'authored',transition:{subjectId:'legal',clipId:'exit',exitIndex:0,start:'with',duration:'follow',return:{mode:'animate',startS:9,endS:10}}});
test('motion-owned position edits shift the whole scoped path and render the edited position',async()=>{
 const d=structuredClone(sse);d.layoutRules=[];const row={...d.feed.sampleRows[0],offer_count_num:0,tc_type_enum:'tcs_only',include_roundel_frame_bool:true,navy_headlines_bool:true};const scopes=campaignScopes(d,row),owner=motionGeometry(d,'160x600','bluewave',scopes,40);
 const next=editMotionGeometry(d,'160x600','bluewave',scopes,40,'top',owner.values.top-20);for(const pct of [0,25,75,100])expect(motionGeometry(next,'160x600','bluewave',scopes,pct).values.top).toBe(motionGeometry(d,'160x600','bluewave',scopes,pct).values.top-20);
 expect(next.sizes['160x600'].layers.find(l=>l.id==='bluewave').base).toEqual(d.sizes['160x600'].layers.find(l=>l.id==='bluewave').base);
 const p=await pageFor(renderWipHtml(await renderStudioReadyHtml(next,'160x600',fontOptions),row));await p.evaluate(`(${seekProductionAnimations.toString()})(document,40,15)`);expect(Number.parseFloat(await p.locator('#bluewave').evaluate(e=>getComputedStyle(e).top))).toBeCloseTo(owner.values.top-20,2);await p.close();
});
test('bottom ink anchor stays fixed across max-line, copy and frame-policy changes',async()=>{
 for(const frame of ['', 'fixed','auto'])for(const maxLines of [2,6]){
 const d=fixture(),text=d.sizes['300x250'].layers[1];text.fit={frame,mode:'shrink',maxLines,minFontSize:10,align:'bottom',anchor:{edge:'end',position:230}};d.feed.sampleRows[0].copy='First legal line\nSecond legal line\nThird legal line';
 const html=renderWipHtml(await renderStudioReadyHtml(d,'300x250',fontOptions),d.feed.sampleRows[0]),p=await pageFor(html);
 const bottom=()=>p.evaluate(source=>{const engine=new Function('return '+source)()(window);return engine.ink(document.getElementById('legal')).bottom;},responsiveLayoutSource());
 expect(await bottom()).toBeCloseTo(230,1);await p.evaluate(()=>window.applySseDcoRuntimeState({copy:'Short copy'}));await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);expect(await bottom()).toBeCloseTo(230,1);await p.close();
 }
},30000);
test('exit-linked layout motion reserves entrance space, seeks deterministically, returns cleanly and matches outlines',async()=>{
 const d=fixture();d.layoutRules=[area()];validateLayoutRules(d);const html=renderWipHtml(await renderStudioReadyHtml(d,'300x250',fontOptions),d.feed.sampleRows[0]),p=await pageFor(html);
 const seek=async(page,at)=>{await page.evaluate(`(${seekProductionAnimations.toString()})(document,${at},10)`);return page.locator('#mark').evaluate(e=>e.getBoundingClientRect().top);};
 for(const [at,y]of [[0,40],[5,40],[35,40],[50,40],[55,80],[65,120],[95,80],[100,40],[65,120],[35,40]])expect(await seek(p,at),`at ${at}`).toBeCloseTo(y,1);
 const snapshot=await captureProductionPresentation(html,'300x250');expect(snapshot.layoutTransitions).toHaveLength(1);const outlined=await pageFor(await renderStudioReadyHtml(d,'300x250',{...fontOptions,renderMode:'outline',presentationSnapshot:snapshot}));
 for(const at of [0,55,65,95,100])expect(await seek(outlined,at)).toBeCloseTo(await seek(p,at),1);
 await p.evaluate(()=>window.applySseDcoRuntimeState({copy:''}));await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);expect(await p.evaluate(()=>window.__DCO_LAYOUT_TRANSITIONS__)).toHaveLength(0);for(const at of [0,55,95])expect(await seek(p,at)).toBeCloseTo(120,1);
 await outlined.close();await p.close();
},30000);
test('a visible reset and a missing loop return are rejected',()=>{const d=fixture();d.layoutRules=[area()];d.layoutRules[0].transition.return={mode:'hidden',startS:8};expect(()=>validateLayoutRules(d)).toThrow(/visible/);d.layoutRules[0].transition.return={mode:'none'};expect(()=>validateLayoutRules(d)).toThrow(/looping/);});
test('a hidden end reset keeps the return invisible and the loop start pose stable',async()=>{
 const d=fixture();d.sizes['300x250'].layers[0].clips=[{id:'mark-exit',preset:'custom',keyframes:[{at:0,opacity:1},{at:90,opacity:1},{at:95,opacity:0},{at:100,opacity:0}]}];d.layoutRules=[area()];d.layoutRules[0].transition.return={mode:'hidden',startS:9.5};validateLayoutRules(d);
 const p=await pageFor(renderWipHtml(await renderStudioReadyHtml(d,'300x250',fontOptions),d.feed.sampleRows[0]));for(const [at,y]of [[65,120],[94,120],[95,40],[100,40],[0,40]]){await p.evaluate(`(${seekProductionAnimations.toString()})(document,${at},10)`);expect(await p.locator('#mark').evaluate(e=>e.getBoundingClientRect().top)).toBeCloseTo(y,1);if(at===95)expect(await p.locator('#mark').evaluate(e=>getComputedStyle(e).opacity)).toBe('0');}await p.close();
});
test('pinned text keeps its ink bottom in outlined output',async()=>{
 const d=fixture();d.sizes['300x250'].layers[1].fit={mode:'shrink',maxLines:6,minFontSize:10,align:'bottom',anchor:{edge:'end',position:230}};d.feed.sampleRows[0].copy='First legal line\nSecond legal line\nThird legal line';
 const html=renderWipHtml(await renderStudioReadyHtml(d,'300x250',fontOptions),d.feed.sampleRows[0]),snapshot=await captureProductionPresentation(html,'300x250'),p=await pageFor(await renderStudioReadyHtml(d,'300x250',{...fontOptions,renderMode:'outline',presentationSnapshot:snapshot}));
 await p.evaluate(`(${seekProductionAnimations.toString()})(document,35,10)`);const bottom=await p.evaluate(source=>new Function('return '+source)()(window).ink(document.getElementById('legal')).bottom,responsiveLayoutSource());expect(bottom).toBeCloseTo(230,0);await p.close();
});
test('playing layout motion shares the CSS animation clock',async()=>{
 const d=fixture();d.layoutRules=[area()];const p=await pageFor(renderWipHtml(await renderStudioReadyHtml(d,'300x250',fontOptions),d.feed.sampleRows[0]));await p.waitForTimeout(100);const clocks=await p.evaluate(()=>{const animations=document.getAnimations(),layout=animations.find(a=>a.id.startsWith('dco-layout-')),css=animations.find(a=>a.animationName);return {layout:layout?.startTime,css:css?.startTime};});expect(clocks.layout).toBeTypeOf('number');expect(clocks.layout).toBeCloseTo(clocks.css,1);await p.close();
});
