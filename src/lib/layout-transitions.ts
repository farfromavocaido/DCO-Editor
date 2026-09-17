// @ts-nocheck
import {compileAnimationClips,frameAtPercent} from './creative-compiler';
import {clipsForProfile} from './headline-motion';
import {beatsForScopes,activeFrameScope} from './timing-profiles';
import {isGenericCampaign,campaignVariantModel} from './campaign-variants';
export function exitSegments(document,size,targetId,clipId,scopes,kind="exit"){
 const layer=document.sizes[size].layers.find(l=>l.id===targetId.split('::')[0]);const clip=clipsForProfile(layer?.clips||[],activeFrameScope(scopes),scopes).find(c=>c.id===clipId);if(!clip)return [];
 const frames=compileAnimationClips([clip],beatsForScopes(document,scopes),{canvas:document.sizes[size].canvas,parent:document.sizes[size].canvas,durationS:document.clock.durationS}),out=[];
 for(let i=1;i<frames.length;i++)if(kind==='enter'?frames[i-1].opacity<1&&frames[i].opacity===1:frames[i-1].opacity>0&&frames[i].opacity===0){let start=i-1;while(start>0&&(kind==='enter'?frames[start-1].opacity<frames[start].opacity:frames[start-1].opacity>frames[start].opacity))start--;if(frames[i].at>frames[start].at)out.push({start:frames[start].at,end:frames[i].at});}
 return out;
}
export function transitionCases(document,size,rule){
 const transition=rule.transition;if(!transition||transition.enabled===false||!rule.enabled)return [];
 const duration=Number(document.clock.durationS),configured=rule.when||[];
 const genericStates=()=>campaignVariantModel(document).dimensions.reduce((rows,d)=>{const chosen=d.options.filter(o=>configured.includes(o.scope)),options=chosen.length?chosen:d.options;const next=rows.flatMap(row=>options.map(o=>[...row,o.scope]));if(next.length>4096)throw new Error('Limit this layout to fewer campaign choices before linking motion');return next;},[[]]);
 const states=isGenericCampaign(document)?genericStates():['frames-3','frames-4'].flatMap(profile=>[0,1,2,3].map(n=>[profile,`offers-${n}`])).filter(scopes=>!configured.some(s=>s.startsWith('offers-')&&!scopes.includes(s)||s.startsWith('frames-')&&!scopes.includes(s))).map(s=>[...new Set([...configured,...s])]);
 return states.flatMap(scopes=>{
  const exits=exitSegments(document,size,transition.subjectId,transition.clipId,scopes);if(!exits.length)return [];
  const exit=exits[transition.exitIndex||0];if(!exit)throw new Error('The chosen exit segment no longer exists');
  const start=transition.start==='after'?exit.end:exit.start,end=start+(transition.duration==='follow'?exit.end-exit.start:Number(transition.durationS)/duration*100);
  if(end>100||end<=start)throw new Error('The layout transition must finish inside the ad');
  const back=transition.return||{},returnStart=Number(back.startS)/duration*100,returnEnd=back.mode==='hidden'?returnStart:Number(back.endS)/duration*100;
  if(back.mode!=='none'&&(!Number.isFinite(returnStart)||!Number.isFinite(returnEnd)||returnStart<end||returnEnd>100||returnEnd<returnStart||back.mode==='animate'&&returnEnd===returnStart))throw new Error('The return must follow the layout transition and finish by the end of the ad');
  if(back.mode==='hidden')for(const member of rule.targets.filter(t=>t.size===size&&t.targetId!==transition.subjectId)){
   const layer=document.sizes[size].layers.find(l=>l.id===member.targetId.split('::')[0]),clips=clipsForProfile(layer.clips||[],activeFrameScope(scopes),scopes),frames=compileAnimationClips(clips,beatsForScopes(document,scopes),{canvas:document.sizes[size].canvas,durationS:duration});
   if(!clips.length||frameAtPercent(frames,returnStart).opacity>.001||frames.some(f=>f.at>=returnStart&&f.opacity>.001))throw new Error(`${layer.label||layer.id} is visible during the reset. Choose an animated return or a later hidden reset.`);
  }
  return [{scopes,start,end,returnMode:back.mode,returnStart,returnEnd,durationMs:duration*1000,loop:document.clock.loop===true}];
 });
}
export function validateLayoutTransition(document,rule){
 if(rule.layoutAnimations!==undefined){validateLayoutSequence(document,rule);return;}
 const t=rule.transition;if(!t||t.enabled===false||!rule.enabled)return;
 if(rule.type!=='distribute'||!['with','after'].includes(t.start)||!['follow','custom'].includes(t.duration)||t.duration==='custom'&&(!Number.isFinite(t.durationS)||t.durationS<=0)||!Number.isInteger(t.exitIndex)||t.exitIndex<0||!['animate','hidden','none'].includes(t.return?.mode))throw new Error('Choose an exit, transition timing and return behaviour');
 for(const size of new Set(rule.targets.map(t=>t.size))){if(!rule.targets.some(m=>m.size===size&&m.targetId===t.subjectId))throw new Error('The exiting element must belong to this layout area');const layer=document.sizes[size].layers.find(l=>l.id===t.subjectId.split('::')[0]);if(!layer?.clips?.some(c=>c.id===t.clipId))throw new Error('Choose an animation on the exiting element');if(!transitionCases(document,size,rule).length)throw new Error('That animation has no active exit for this layout version');}
}
export const layoutAnimationSource=()=>`(function(win){return function(plans){
 var doc=win.document;doc.getAnimations().filter(a=>a.id.indexOf('dco-layout-')===0).forEach(a=>a.cancel());
 var created=plans.map(function(plan){var p=plan.targetId.split('::'),id=p[0]==='terms-solo'?'TC_Solo':p[0].replace(/^offer-slot-(\\d+)$/,'offer$1'),el=doc.getElementById(id);if(p[0]==='terms-solo')el=el&&el.querySelector('.terms-solo');else if(p[1])el=el&&el.querySelector('.'+p[1]);if(!el)return null;var animation=el.animate(plan.keyframes,{duration:plan.durationMs,iterations:plan.loop?Infinity:1,fill:'both',easing:'linear',composite:'add'});animation.id='dco-layout-'+plan.id+'-'+plan.targetId;animation.pause();animation.currentTime=0;return animation;}).filter(Boolean);
 win.requestAnimationFrame(function sync(){var root=doc.querySelector('.stage');if(root&&!root.classList.contains('motion-ready')){win.requestAnimationFrame(sync);return;}var clock=doc.getAnimations().find(a=>a.id.indexOf('dco-layout-')!==0&&a.animationName);created.forEach(function(animation){if(animation.playState==='idle')return;if(typeof win.__DCO_SEEK_TIME__==='number'){animation.currentTime=win.__DCO_SEEK_TIME__;animation.pause();return;}animation.currentTime=clock&&clock.currentTime!=null?clock.currentTime:0;if(!clock||clock.playState==='running'){animation.play();if(clock&&typeof clock.startTime==='number')animation.startTime=clock.startTime;}});});
 };})`;

// Legacy transitions are projected into the list, never migrated on load/save.
export function layoutAnimations(rule){
 if(Array.isArray(rule.layoutAnimations))return rule.layoutAnimations;
 const t=rule.transition;if(!t)return [];
 const entries=[{id:'legacy-exit',enabled:t.enabled!==false,kind:'exit',subjectId:t.subjectId,clipId:t.clipId,segmentIndex:t.exitIndex||0,start:t.start,duration:t.duration,durationS:t.durationS}];
 if(t.return?.mode!=='none')entries.push({id:'legacy-return',enabled:t.enabled!==false,kind:'return',startS:t.return.startS,endS:t.return.endS,hidden:t.return.mode==='hidden'});
 return entries;
}
function sequenceScopes(document,rule){
 const configured=rule.when||[];
 if(isGenericCampaign(document))return campaignVariantModel(document).dimensions.reduce((rows,d)=>{const chosen=d.options.filter(o=>configured.includes(o.scope)),options=chosen.length?chosen:d.options;const next=rows.flatMap(row=>options.map(o=>[...row,o.scope]));if(next.length>4096)throw new Error('Limit this layout to fewer campaign choices before linking motion');return next;},[[]]);
 return ['frames-3','frames-4'].flatMap(profile=>[0,1,2,3].map(n=>[profile,`offers-${n}`])).filter(scopes=>!configured.some(s=>s.startsWith('offers-')&&!scopes.includes(s)||s.startsWith('frames-')&&!scopes.includes(s))).map(s=>[...new Set([...configured,...s])]);
}
export function layoutSequenceCases(document,size,rule){
 if(!rule.enabled)return [];
 const duration=Number(document.clock.durationS),entries=layoutAnimations(rule).filter(a=>a.enabled!==false);
 return sequenceScopes(document,rule).map(scopes=>{
  const events=entries.flatMap(a=>{
   if(a.kind==='return')return [{...a,start:a.startS/duration*100,end:(a.hidden?a.startS:a.endS)/duration*100}];
   const segment=exitSegments(document,size,a.subjectId,a.clipId,scopes,a.kind)[a.segmentIndex||0];if(!segment)return [];
   const span=a.duration==='follow'?segment.end-segment.start:Number(a.durationS)/duration*100;
   const start=a.start==='after'?segment.end:a.start==='before'?segment.start-span:segment.start;
   return [{...a,start,end:start+span}];
  }).sort((a,b)=>a.start-b.start);
  for(let i=0;i<events.length;i++){const e=events[i];if(!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.start<0||e.end>100||e.end<e.start||!e.hidden&&e.end===e.start)throw new Error('Each layout animation must fit inside the ad');if(i&&e.start<events[i-1].end-1e-7)throw new Error('Layout animations overlap. Adjust their timing so each move finishes before the next begins');}
  const initialAbsent=rule.startingArrangement==='present'?[...new Set(events.filter(e=>e.kind!=='return').map(e=>e.subjectId))].filter(id=>events.find(e=>e.subjectId===id)?.kind==='enter'):[];
  for(const e of events.filter(e=>e.hidden))for(const member of rule.targets.filter(m=>m.size===size)){
   const layer=document.sizes[size].layers.find(l=>l.id===member.targetId.split('::')[0]),clips=clipsForProfile(layer?.clips||[],activeFrameScope(scopes),scopes),frames=compileAnimationClips(clips,beatsForScopes(document,scopes),{canvas:document.sizes[size].canvas,durationS:duration});
   const next=events.find(n=>n.start>e.start),until=next?.start??100;
   if(!clips.length||frameAtPercent(frames,e.start).opacity>.001||frames.some(f=>f.at>=e.start&&f.at<until&&f.opacity>.001))throw new Error(`${layer.label||layer.id} is visible during the reset. Use an animated return or a later reset.`);
  }
  return {scopes,events,initialAbsent,durationMs:duration*1000,loop:document.clock.loop===true};
 });
}
function validateLayoutSequence(document,rule){
 if(!Array.isArray(rule.layoutAnimations)||rule.startingArrangement!==undefined&&!['all','present'].includes(rule.startingArrangement))throw new Error('Choose a starting arrangement and animation list');
 if(!rule.enabled)return;
 const ids=new Set();for(const a of rule.layoutAnimations){if(!a.id||ids.has(a.id))throw new Error('Layout animations need unique IDs');ids.add(a.id);if(a.enabled===false)continue;
  if(rule.type!=='distribute'||!['enter','exit','return'].includes(a.kind))throw new Error('Choose entrance, exit or return');
  if(a.kind!=='return'&&(!['before','with','after'].includes(a.start)||!['follow','custom'].includes(a.duration)||a.duration==='custom'&&(!Number.isFinite(a.durationS)||a.durationS<=0)||!Number.isInteger(a.segmentIndex)||a.segmentIndex<0))throw new Error('Choose an animation segment and timing');
  for(const size of new Set(rule.targets.map(m=>m.size))){
   if(a.kind==='return')continue;
   if(!rule.targets.some(m=>m.size===size&&m.targetId===a.subjectId))throw new Error('The linked item must belong to this layout area');
   if(!sequenceScopes(document,rule).some(scopes=>exitSegments(document,size,a.subjectId,a.clipId,scopes,a.kind)[a.segmentIndex]))throw new Error(`Choose an active ${a.kind==='enter'?'entrance':'exit'} animation and segment`);
  }
 }
 for(const size of new Set(rule.targets.map(m=>m.size)))layoutSequenceCases(document,size,rule);
}

/** Pure ink-based sequence; serialized into the shared production runtime. */
export function layoutSequencePlans(rule, timing, members){
 const length=rule.axis==='x'?rule.area.width:rule.area.height;
 const positions=(absent,previous)=>{
  const present=members.filter(m=>!absent.has(m.id)),extent=present.reduce((n,m)=>n+m.extent,0);
  let gap=present.length>1?(length-extent)/(present.length-1):0;
  if(extent>length||present.length>1&&gap<rule.minGap){if(rule.overflow==='authored')throw new Error('Not enough room for a layout animation');gap=rule.minGap;}
  let cursor=present.length===1?(length-extent)*(rule.single==='end'?1:rule.single==='center'?.5:0):0;
  const result={...previous};present.forEach(m=>{result[m.id]=cursor-m.fullStart;cursor+=m.extent+gap;});return result;
 };
 const absent=new Set(timing.initialAbsent),zero=Object.fromEntries(members.map(m=>[m.id,0]));
 const initial=positions(absent,zero);let current={...initial};
 const frames=Object.fromEntries(members.map(m=>[m.id,[{offset:0,value:initial[m.id]}]]));
 for(const e of timing.events){
  if(e.kind!=='return'&&!members.some(m=>m.id===e.subjectId))continue;
  if(e.kind==='return'){absent.clear();timing.initialAbsent.forEach(id=>absent.add(id));}
  else if(e.kind==='enter')absent.delete(e.subjectId);else absent.add(e.subjectId);
  const next=e.kind==='return'?{...initial}:positions(absent,current);
  members.forEach(m=>{frames[m.id].push({offset:e.start/100,value:current[m.id],easing:e.hidden?'steps(1,end)':'ease-in-out'},{offset:e.end/100,value:next[m.id]});});current=next;
 }
 return members.flatMap(m=>{
  const values=frames[m.id];values.push({offset:1,value:current[m.id]});
  if(values.every(f=>Math.abs(f.value)<.001))return [];
  return [{id:rule.id,targetId:m.id,durationMs:timing.durationMs,loop:timing.loop,keyframes:values.map(f=>({offset:f.offset,translate:rule.axis==='x'?f.value+'px 0px':'0px '+f.value+'px',...(f.easing?{easing:f.easing}:{})}))}];
 });
}
