import {test,expect} from 'vitest';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import demo from '../../../campaign/product-demo-creative.json';
import sse from '../../../campaign/sse-dco-creative.json';
import {renderStudioReadyHtml,renderWipHtml} from '../creative-exporter';
import {projectRoot} from '../paths';
import {captureProductionPresentation} from '../production-snapshot';
import {campaignFontFaces} from '../../lib/campaign-fonts';
import {waitForProductionDocument} from '../../lib/production-stage';
const fixture=()=>{
 const d:any=structuredClone(demo);d.feed.sampleRows=[{...d.feed.sampleRows[0],legal:'Terms apply.'}];
 const s=d.sizes['300x250'];s.layers.push({id:'legal',label:'Legal copy',kind:'text',binding:{field:'legal'},base:{left:20,top:160,width:220,height:70,fontFamily:'Museo',fontSize:16,lineHeight:1.2},fit:{frame:'fixed',mode:'shrink',maxLines:4,minFontSize:10},clips:[]});
 s.layers.push({id:'icon',kind:'image',asset:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="25" y="30" width="50" height="40" fill="red"/></svg>'),base:{left:40,top:50,width:100,height:100},clips:[]});
 const target=(targetId:string)=>[{size:'300x250',targetId}];
 d.layoutRules=[{id:'narrow',name:'Narrow legal',type:'conditional',enabled:true,targets:target('legal'),when:['theme-dark'],values:{width:120}},
 {id:'legal-bottom',name:'Legal bottom',type:'spacing',enabled:true,targets:target('legal'),axis:'y',targetEdge:'end',reference:{targetId:'canvas',edge:'end'},gap:-12,gapUnit:'px',onMissing:'authored'},
 {id:'icon-gap',name:'Icon above legal',type:'spacing',enabled:true,targets:target('icon'),axis:'y',targetEdge:'end',reference:{targetId:'legal',edge:'start'},gap:-8,gapUnit:'px',onMissing:'canvas',fallbackEdge:'end',fallbackGap:-24}];return d;
};
test('shared production rules measure multiline text and SVG alpha ink, react to missing copy, and reset after disabling',async()=>{
 const d=fixture(),font=await fs.readFile(`${projectRoot}/assets/fonts/Museo700-Regular.otf`);
 const html=renderWipHtml(await renderStudioReadyHtml(d,'300x250',{fontUrlMap:{'Museo700-Regular.otf':`data:font/otf;base64,${font.toString('base64')}`}}),d.feed.sampleRows[0]);
 const browser=await chromium.launch({headless:true});try{
  const p=await browser.newPage();await p.route('https://s0.2mdn.net/**',r=>r.abort());await p.setContent(html);
  await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);
  const diagnostics=()=>p.evaluate(()=>(window as any).__DCO_LAYOUT_DIAGNOSTICS__);
  let rows=await diagnostics(),gap=rows.find((r:any)=>r.id==='icon-gap');
  expect(gap.status).toBe('active');expect(gap.targetInk.height).toBeCloseTo(40,1);expect(gap.targetInk.bottom-gap.referenceInk.top).toBeCloseTo(-8,1);
  expect(rows.find((r:any)=>r.id==='legal-bottom').targetInk.bottom).toBeCloseTo(238,1);
  const before=gap.after.top;
  await p.evaluate(row=>(window as any).applySseDcoRuntimeState(row),{...d.feed.sampleRows[0],theme:'dark',legal:'These are longer terms that wrap into several lines and push the icon upwards.'});await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);
  rows=await diagnostics();gap=rows.find((r:any)=>r.id==='icon-gap');expect(gap.after.top).toBeLessThan(before);expect(gap.targetInk.bottom-gap.referenceInk.top).toBeCloseTo(-8,1);expect(rows.find((r:any)=>r.id==='narrow').after.width).toBe(120);
  await p.evaluate(row=>(window as any).applySseDcoRuntimeState(row),{...d.feed.sampleRows[0],legal:''});await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);
  gap=(await diagnostics()).find((r:any)=>r.id==='icon-gap');expect(gap.message).toContain('fallback');expect(gap.targetInk.bottom).toBeCloseTo(226,1);
  await p.evaluate(row=>{(window as any).updateSseDcoLayoutRules([]);(window as any).applySseDcoRuntimeState(row);},d.feed.sampleRows[0]);await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);
  expect(await p.locator('#icon').evaluate(e=>getComputedStyle(e).top)).toBe('50px');
 }finally{await browser.close();}
},30000);

test('percentage gaps use the canvas axis and fixed-copy exports preserve measured placements',async()=>{
 const d=fixture();d.fonts=campaignFontFaces(d);d.feed.sampleRows[0].theme='dark';
 const rule=d.layoutRules.find((r:any)=>r.id==='icon-gap');rule.gap=-4;rule.gapUnit='percent';
 const font=await fs.readFile(`${projectRoot}/assets/fonts/Museo700-Regular.otf`);
 const options={fontUrlMap:{'Museo700-Regular.otf':`data:font/otf;base64,${font.toString('base64')}`}};
 const html=renderWipHtml(await renderStudioReadyHtml(d,'300x250',options),d.feed.sampleRows[0]);
 const snapshot=await captureProductionPresentation(html,'300x250');
 const outline=await renderStudioReadyHtml(d,'300x250',{...options,renderMode:'outline',presentationSnapshot:snapshot});
 const browser=await chromium.launch({headless:true});try{
  const p=await browser.newPage();await p.route('https://s0.2mdn.net/**',r=>r.abort());await p.setContent(html);await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);
  const gap=await p.evaluate(()=>(window as any).__DCO_LAYOUT_DIAGNOSTICS__.find((r:any)=>r.id==='icon-gap'));
  expect(gap.status).toBe('active');expect(gap.gap).toBe(-10);expect(gap.targetInk.bottom-gap.referenceInk.top).toBeCloseTo(-10,1);
  const geometry=()=>['icon','legal'].map(id=>{const el=document.getElementById(id)!,s=getComputedStyle(el);return {id,left:s.left,top:s.top,width:s.width,height:s.height};});
  const expected=await p.evaluate(geometry);await p.setContent(outline);await p.evaluate(()=>document.fonts.ready);
  expect(await p.evaluate(geometry)).toEqual(expected);expect(await p.locator('#legal svg path').count()).toBeGreaterThan(0);
  await p.setContent(html);await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);
  await p.evaluate(row=>(window as any).applySseDcoRuntimeState(row),{...d.feed.sampleRows[0],legal:''});await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);
  const fallback=await p.evaluate(()=>(window as any).__DCO_LAYOUT_DIAGNOSTICS__.find((r:any)=>r.id==='icon-gap'));expect(fallback.usingFallback).toBe(true);expect(fallback.gap).toBe(-60);expect(fallback.targetInk.bottom).toBeCloseTo(190,1);
 }finally{await browser.close();}
},30000);

test('SSE background and legal-wrapper placements survive outline delivery',async()=>{
 const d:any=structuredClone(sse),size='300x600';d.feed.sampleRows=[{...d.feed.sampleRows[0],Default:true,offer_count_num:1,tc_type_enum:'tcs_only',tc_terms_text:'Terms apply to this offer.'}];
 const rule=(id:string,targetId:string,reference:string,edge:string,gap:number)=>({id,name:id,type:'spacing',enabled:true,targets:[{size,targetId}],axis:'y',targetEdge:edge,reference:{targetId:reference,edge:reference==='canvas'?'end':'start'},gap,gapUnit:'px',onMissing:'authored'});
 d.layoutRules=[rule('background','bg-image','canvas','end',-7),rule('legal','terms-solo','canvas','end',-12),rule('logo','logo-act3','terms-solo','end',-8)];
 const font=await fs.readFile(`${projectRoot}/assets/fonts/Museo700-Regular.otf`),options={fontUrlMap:{'Museo700-Regular.otf':`data:font/otf;base64,${font.toString('base64')}`}};
 const html=renderWipHtml(await renderStudioReadyHtml(d,size,options),d.feed.sampleRows[0]),snapshot=await captureProductionPresentation(html,size);
 expect(snapshot.positions['bg-image'].top).toBeCloseTo(-7,1);
 const outline=await renderStudioReadyHtml(d,size,{...options,renderMode:'outline',presentationSnapshot:snapshot});
 const browser=await chromium.launch();try{
  const page=await browser.newPage();await page.route('https://s0.2mdn.net/**',r=>r.abort());await page.setContent(outline);
  for(const [id,selector] of [['bg-image','#bg-image'],['terms-solo','.terms-solo'],['logo-act3','#logo-act3']]){
   expect(snapshot.positions[id],`${id}: ${JSON.stringify(snapshot.hiddenTargets)}`).toBeDefined();expect(parseFloat(await page.locator(selector).evaluate(e=>getComputedStyle(e).top))).toBeCloseTo(snapshot.positions[id].top,1);
  }
 }finally{await browser.close();}
},30000);

test('distribution uses persistent area edges, skips empty copy, centres one item and flags insufficient space',async()=>{
 const d=fixture();d.layoutRules=[{id:'area',name:'Layout area',type:'distribute',enabled:true,targets:[{size:'300x250',targetId:'icon'},{size:'300x250',targetId:'legal'}],areas:{'300x250':{left:20,top:80,width:220,height:150}},axis:'y',single:'center',crossAlign:'center',minGap:8,overflow:'authored'}];
 const font=await fs.readFile(`${projectRoot}/assets/fonts/Museo700-Regular.otf`),options={fontUrlMap:{'Museo700-Regular.otf':`data:font/otf;base64,${font.toString('base64')}`}};
 const html=renderWipHtml(await renderStudioReadyHtml(d,'300x250',options),d.feed.sampleRows[0]);
 const browser=await chromium.launch();try{const p=await browser.newPage();await p.route('https://s0.2mdn.net/**',r=>r.abort());await p.setContent(html);const settle=()=>p.evaluate(`(${waitForProductionDocument.toString()})(document)`);await settle();
 const diagnostics=()=>p.evaluate(()=>(window as any).__DCO_LAYOUT_DIAGNOSTICS__);
 let rows=await diagnostics();expect(rows.find((r:any)=>r.targetId==='icon').targetInk.top).toBeCloseTo(80,1);expect(rows.find((r:any)=>r.targetId==='icon').targetInk.left+rows.find((r:any)=>r.targetId==='icon').targetInk.width/2).toBeCloseTo(130,1);expect(rows.find((r:any)=>r.targetId==='legal').targetInk.bottom).toBeCloseTo(230,1);
 await p.evaluate(row=>(window as any).applySseDcoRuntimeState(row),{...d.feed.sampleRows[0],legal:''});await settle();rows=await diagnostics();expect(rows.find((r:any)=>r.targetId==='icon').targetInk.top).toBeCloseTo(135,1);expect(rows.find((r:any)=>r.targetId==='legal').status).toBe('inactive');
 await p.evaluate(()=>{const w=window as any;const rules=JSON.parse(document.getElementById('dco-layout-rules')!.textContent!);rules[0].area.height=10;w.updateSseDcoLayoutRules(rules);w.applySseDcoRuntimeState(w.__SSE_DCO_APPLIED_ROW__);});await settle();rows=await diagnostics();expect(rows.find((r:any)=>r.targetId==='icon').status).toBe('error');expect(await p.locator('#icon').evaluate(e=>getComputedStyle(e).top)).toBe('50px');
 }finally{await browser.close();}
 const snapshot=await captureProductionPresentation(html,'300x250');expect(snapshot.positions.icon.top).toBeCloseTo(50,1);const outline=await renderStudioReadyHtml(d,'300x250',{...options,renderMode:'outline',presentationSnapshot:snapshot});expect(outline).toContain('top:50px');
},30000);

test('element conditions use actual text and fitted lines, switch both ways, and preserve outline placement',async()=>{
 const d=fixture();d.layoutRules=[{id:'condition',name:'Follow legal content',type:'conditional',enabled:true,targets:[{size:'300x250',targetId:'icon'}],condition:{targetId:'legal',test:'lines-at-least',value:2},values:{top:30},otherwise:{top:110}}];
 const font=await fs.readFile(`${projectRoot}/assets/fonts/Museo700-Regular.otf`),options={fontUrlMap:{'Museo700-Regular.otf':`data:font/otf;base64,${font.toString('base64')}`}};
 const html=renderWipHtml(await renderStudioReadyHtml(d,'300x250',options),d.feed.sampleRows[0]);const browser=await chromium.launch();try{const p=await browser.newPage();await p.route('https://s0.2mdn.net/**',r=>r.abort());await p.setContent(html);const settle=()=>p.evaluate(`(${waitForProductionDocument.toString()})(document)`);await settle();expect(await p.locator('#icon').evaluate(e=>getComputedStyle(e).top)).toBe('110px');
 await p.evaluate(row=>(window as any).applySseDcoRuntimeState(row),{...d.feed.sampleRows[0],legal:'First line\nSecond line'});await settle();let diagnostic=await p.evaluate(()=>(window as any).__DCO_LAYOUT_DIAGNOSTICS__[0]);expect(diagnostic.facts.lines).toBe(2);expect(diagnostic.branch).toBe('when');expect(await p.locator('#icon').evaluate(e=>getComputedStyle(e).top)).toBe('30px');
 await p.evaluate(row=>(window as any).applySseDcoRuntimeState(row),{...d.feed.sampleRows[0],legal:''});await settle();expect(await p.locator('#icon').evaluate(e=>getComputedStyle(e).top)).toBe('110px');
 }finally{await browser.close();}
 const snapshot=await captureProductionPresentation(html,'300x250');expect(snapshot.positions.icon.top).toBe(110);const outline=await renderStudioReadyHtml(d,'300x250',{...options,renderMode:'outline',presentationSnapshot:snapshot});expect(outline).toContain('top:110px');
},30000);

test('content-dependent dimensions refit before downstream line-count conditions and area spacing',async()=>{
 const d=fixture();d.feed.sampleRows[0].legal='Longer legal copy wraps across several fitted lines.';
 const target=(targetId:string)=>[{size:'300x250',targetId}];
 d.layoutRules=[{id:'width',name:'Width',type:'conditional',enabled:true,targets:target('legal'),condition:{targetId:'icon',test:'shown'},values:{width:80},otherwise:{width:220}},
 {id:'height',name:'Height',type:'conditional',enabled:true,targets:target('legal'),condition:{targetId:'icon',test:'shown'},values:{height:90}},
 {id:'lines',name:'Lines',type:'conditional',enabled:true,targets:target('icon'),condition:{targetId:'legal',test:'lines-at-least',value:2},values:{left:100},otherwise:{left:40}},
 {id:'area',name:'Area',type:'distribute',enabled:true,targets:[...target('icon'),...target('legal')],areas:{'300x250':{left:0,top:20,width:300,height:220}},axis:'y',single:'center',minGap:0,overflow:'authored'}];
 const font=await fs.readFile(`${projectRoot}/assets/fonts/Museo700-Regular.otf`),options={fontUrlMap:{'Museo700-Regular.otf':`data:font/otf;base64,${font.toString('base64')}`}};
 const html=renderWipHtml(await renderStudioReadyHtml(d,'300x250',options),d.feed.sampleRows[0]),browser=await chromium.launch();try{const p=await browser.newPage();await p.route('https://s0.2mdn.net/**',r=>r.abort());await p.setContent(html);await p.evaluate(`(${waitForProductionDocument.toString()})(document)`);
 const measured=await p.locator('#legal').evaluate(e=>({width:getComputedStyle(e).width,height:getComputedStyle(e).height}));expect(measured).toEqual({width:'80px',height:'90px'});
 const diagnostics=await p.evaluate(()=>(window as any).__DCO_LAYOUT_DIAGNOSTICS__);expect(diagnostics.every((d:any)=>d.status==='active')).toBe(true);expect(diagnostics.find((d:any)=>d.id==='lines').facts.lines).toBeGreaterThanOrEqual(2);expect(await p.locator('#icon').evaluate(e=>getComputedStyle(e).left)).toBe('100px');expect(diagnostics.find((d:any)=>d.id==='area'&&d.targetId==='legal').targetInk.bottom).toBeCloseTo(240,1);
 }finally{await browser.close();}
 const snapshot=await captureProductionPresentation(html,'300x250');expect(snapshot.positions.legal.width).toBe(80);const outline=await renderStudioReadyHtml(d,'300x250',{...options,renderMode:'outline',presentationSnapshot:snapshot});expect(outline).toContain('width:80px');
},30000);
