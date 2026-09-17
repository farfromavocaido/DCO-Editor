// @ts-nocheck
import {compileAnimationClips,frameAtPercent} from './creative-compiler';
import {clipsForProfile} from './headline-motion';
import {beatsForScopes,activeFrameScope} from './timing-profiles';
import {isGenericCampaign,campaignVariantModel} from './campaign-variants';
export function exitSegments(document,size,targetId,clipId,scopes){
 const layer=document.sizes[size].layers.find(l=>l.id===targetId.split('::')[0]);const clip=clipsForProfile(layer?.clips||[],activeFrameScope(scopes),scopes).find(c=>c.id===clipId);if(!clip)return [];
 const frames=compileAnimationClips([clip],beatsForScopes(document,scopes),{canvas:document.sizes[size].canvas,parent:document.sizes[size].canvas,durationS:document.clock.durationS}),out=[];
 for(let i=1;i<frames.length;i++)if(frames[i-1].opacity>0&&frames[i].opacity===0){let start=i-1;while(start>0&&frames[start-1].opacity>frames[start].opacity)start--;if(frames[i].at>frames[start].at)out.push({start:frames[start].at,end:frames[i].at});}
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
 const t=rule.transition;if(!t||t.enabled===false||!rule.enabled)return;
 if(rule.type!=='distribute'||!['with','after'].includes(t.start)||!['follow','custom'].includes(t.duration)||t.duration==='custom'&&(!Number.isFinite(t.durationS)||t.durationS<=0)||!Number.isInteger(t.exitIndex)||t.exitIndex<0||!['animate','hidden','none'].includes(t.return?.mode))throw new Error('Choose an exit, transition timing and return behaviour');
 if(document.clock.loop&&t.return.mode==='none')throw new Error('A looping ad needs an animated return or a hidden reset');
 for(const size of new Set(rule.targets.map(t=>t.size))){if(!rule.targets.some(m=>m.size===size&&m.targetId===t.subjectId))throw new Error('The exiting element must belong to this layout area');const layer=document.sizes[size].layers.find(l=>l.id===t.subjectId.split('::')[0]);if(!layer?.clips?.some(c=>c.id===t.clipId))throw new Error('Choose an animation on the exiting element');if(!transitionCases(document,size,rule).length)throw new Error('That animation has no active exit for this layout version');}
}
export const layoutAnimationSource=()=>`(function(win){return function(plans){
 var doc=win.document;doc.getAnimations().filter(a=>a.id.indexOf('dco-layout-')===0).forEach(a=>a.cancel());
 var created=plans.map(function(plan){var p=plan.targetId.split('::'),id=p[0]==='terms-solo'?'TC_Solo':p[0].replace(/^offer-slot-(\\d+)$/,'offer$1'),el=doc.getElementById(id);if(p[0]==='terms-solo')el=el&&el.querySelector('.terms-solo');else if(p[1])el=el&&el.querySelector('.'+p[1]);if(!el)return null;var animation=el.animate(plan.keyframes,{duration:plan.durationMs,iterations:plan.loop?Infinity:1,fill:'both',easing:'linear',composite:'add'});animation.id='dco-layout-'+plan.id+'-'+plan.targetId;animation.pause();animation.currentTime=0;return animation;}).filter(Boolean);
 win.requestAnimationFrame(function sync(){var root=doc.querySelector('.stage');if(root&&!root.classList.contains('motion-ready')){win.requestAnimationFrame(sync);return;}var clock=doc.getAnimations().find(a=>a.id.indexOf('dco-layout-')!==0&&a.animationName);created.forEach(function(animation){if(animation.playState==='idle')return;if(typeof win.__DCO_SEEK_TIME__==='number'){animation.currentTime=win.__DCO_SEEK_TIME__;animation.pause();return;}animation.currentTime=clock&&clock.currentTime!=null?clock.currentTime:0;if(!clock||clock.playState==='running'){animation.play();if(clock&&typeof clock.startTime==='number')animation.startTime=clock.startTime;}});});
 };})`;
