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
