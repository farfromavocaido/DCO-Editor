// @ts-nocheck
import {timelineMotionClips,activeMotionOverride} from './motion-overrides';
import {compileAnimationClips,frameAtPercent} from './creative-compiler';
import {clipsForProfile} from './headline-motion';
import {campaignVariantModel,isGenericCampaign} from './campaign-variants';
import {activeFrameScope,beatsForScopes} from './timing-profiles';

export function renderedLayerElement(stage,id){return id==='terms-solo'?stage.querySelector('#TC_Solo [data-dco-field="tc_terms_text"], .terms-solo'):stage.ownerDocument.getElementById(id.replace(/^offer-slot-(\d+)$/,'offer$1'));}

export function conditionExplanation(stage,element,document){
 const win=stage.ownerDocument.defaultView,labels=new Map(campaignVariantModel(document).dimensions.flatMap(d=>d.options.map(o=>[o.scope,`${d.label}: ${o.label}`])));
 const matching=[];
 const scan=rules=>{for(const rule of rules){if(rule.cssRules)scan(rule.cssRules);if(!rule.selectorText||!rule.style)continue;
  if(!['none','hidden','collapse'].includes(rule.style.display)&&!['hidden','collapse'].includes(rule.style.visibility))continue;
  try{if(element.matches(rule.selectorText))matching.push(rule.selectorText);}catch{/* Non-element selectors. */}
 }};
 for(const sheet of stage.ownerDocument.styleSheets)try{scan(sheet.cssRules);}catch{/* External font styles may not be readable. */}
 const reasons=[...new Set(matching.flatMap(selector=>[...selector.matchAll(/\.([\w-]+)/g)].map(m=>labels.get(m[1])).filter(Boolean)))];
 if(reasons.length)return `Excluded by ${reasons.join(', ')}`;
 if(/^headline-act/.test(element.id)&&stage.ownerDocument.getElementById('sse-headline-skip-styles')?.textContent.includes('#'+element.id))return 'Skipped by headline scheduling';
 return 'Hidden by this version’s rules';
}

export function readRenderedMotionFrames(element,durationS){
 const doc=element.ownerDocument,win=doc.defaultView,animations=doc.getAnimations();
  const animation=animations.find(a=>a.effect?.target===element&&typeof a.animationName==='string');
  if(!animation)return null;
  const timing=animation.effect.getTiming(),duration=Number(timing.duration)||durationS*1000,delay=Number(timing.delay)||0;
  const frames=animation.effect.getKeyframes().map(f=>{
   const frame={at:((f.computedOffset??f.offset)*duration+delay)/(durationS*10),easing:f.easing||'linear'};
   if(f.transform&&f.transform!=='none'){const matrix=new win.DOMMatrixReadOnly(f.transform);frame.translate=[matrix.m41,matrix.m42];frame.scale=matrix.a===matrix.d?matrix.a:[matrix.a,matrix.d];}
   if(f.opacity!==undefined)frame.opacity=Number(f.opacity);
   for(const key of ['left','top','width','height'])if(f[key]!==undefined&&/^[-\d.]+px$/.test(f[key]))frame[key]=Number.parseFloat(f[key]);
   if(f.color)frame.color=f.color;
   return frame;
  }).filter(f=>f.at>=0&&f.at<=100);
 return {name:animation.animationName,frames};
}

export function framesMatchAuthored(frames,authored){
 return frames.every(f=>{
  const expected=frameAtPercent(authored,f.at);
  if(['opacity','left','top','width','height'].some(k=>f[k]!==undefined&&(expected[k]===undefined||Math.abs(f[k]-expected[k])>.01)))return false;
  if(f.translate?.some((n,i)=>Math.abs(n-(expected.translate?.[i]||0))>.05))return false;
  const a=f.scale??1,b=expected.scale??1;
  return !(Array.isArray(a)?a:[a,a]).some((n,i)=>Math.abs(n-(Array.isArray(b)?b[i]:b))>.00001);
 });
}

export function readProductionTimeline(stage,document,size,scopes,row={}){
 const doc=stage.ownerDocument,win=doc.defaultView,canvas=document.sizes[size].canvas,context={canvas,parent:canvas,durationS:document.clock.durationS};
 const beats=beatsForScopes(document,scopes),animations=doc.getAnimations(),result={};
 const hidden=doc.querySelector('style[data-editor-hidden-layers]'),rules=hidden?.textContent;
 try{if(hidden)hidden.textContent='';
 for(const layer of document.sizes[size].layers){
  const element=renderedLayerElement(stage,layer.id),entry={element,reason:null,motion:null};result[layer.id]=entry;
  if(!element){entry.reason='Not rendered in this version';continue;}
  if(layer.kind==='text'&&!element.textContent.trim()&&!element.querySelector('svg path, img')){entry.reason='Empty text';continue;}
  let node=element;
  while(node&&node!==stage){const style=win.getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'){entry.reason=conditionExplanation(stage,node,document);break;}node=node.parentElement;}
  const offer=layer.id.match(/^offer-slot-(\d+)$/);if(entry.reason&&!isGenericCampaign(document)&&offer&&Number(offer[1])>Number(row.offer_count_num))entry.reason=`Offer slot not used (${row.offer_count_num} offers)`;
  const rendered=readRenderedMotionFrames(element,context.durationS);if(!rendered)continue;const {frames}=rendered;
  const authored=compileAnimationClips(timelineMotionClips(layer,scopes),beats,context);
  const different=!framesMatchAuthored(frames,authored);
  const scheduled=rendered.name.includes('-skip-')&&!activeMotionOverride(layer,scopes);
  if(frames.length&& (scheduled||different))entry.motion={clip:{id:`resolved:${layer.id}`,label:'Rendered animation',preset:'custom',keyframes:frames},source:scheduled?(Number(row.offer_count_num)===0?'Distributed headline timing':'Campaign headline scheduling'):'Production motion overrides',scheduled,layerId:layer.id};
 }
 }finally{if(hidden)hidden.textContent=rules;}
 return result;
}
