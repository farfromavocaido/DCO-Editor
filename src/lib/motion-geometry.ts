// @ts-nocheck
import {compileAnimationClips,frameAtPercent,resolveTimeRef} from './creative-compiler';
import {clipsForProfile} from './headline-motion';
import {beatsForScopes,activeFrameScope} from './timing-profiles';
export function motionGeometry(document,size,targetId,scopes,percent){
 if(String(targetId).includes('::'))return null;
 const layer=document?.sizes?.[size]?.layers?.find(l=>l.id===targetId);if(!layer)return null;
 const clips=clipsForProfile(layer.clips||[],activeFrameScope(scopes),scopes),fields=['left','top','width','height'].filter(field=>clips.some(c=>c.keyframes?.some(k=>k[field]!==undefined)));if(!fields.length)return null;
 const beats=beatsForScopes(document,scopes),context={canvas:document.sizes[size].canvas,parent:document.sizes[size].canvas,durationS:(document.clock?.durationS||15)};
 const frame=frameAtPercent(compileAnimationClips(clips,beats,context),percent);
 return {fields,values:Object.fromEntries(fields.map(field=>[field,frame[field]])),clips,beats,context};
}
/** Move an active motion path without rewriting another campaign version. */
export function editMotionGeometry(document,size,targetId,scopes,percent,field,value,mode='path'){
 const owner=motionGeometry(document,size,targetId,scopes,percent);if(!owner?.fields.includes(field))return null;
 if(!Number.isFinite(Number(value))||(['width','height'].includes(field)&&Number(value)<=0))throw new Error('Enter a valid dimension');
 const delta=Number(value)-owner.values[field];if(Math.abs(delta)<.00001)return document;
 const next=structuredClone(document),layer=next.sizes[size].layers.find(l=>l.id===targetId),scope=[...scopes].sort().join('.');
 for(const clip of layer.clips.filter(c=>owner.clips.some(active=>active.id===c.id)&&c.keyframes?.some(k=>k[field]!==undefined))){
  let index=-1;if(mode==='keyframe'){index=clip.keyframes.findIndex(k=>k[field]!==undefined&&Math.abs(resolveTimeRef(k.at,owner.beats,(document.clock?.durationS||15))-percent)<.01);if(index<0)throw new Error('Select a position keyframe in Motion before editing this value');}
  clip.geometryEdits ||= [];let edit=clip.geometryEdits.find(e=>e.scope===scope);if(!edit){edit={scope,offset:{},frames:{}};clip.geometryEdits.push(edit);}
  const dest=mode==='keyframe'?(edit.frames[index]||={ }):edit.offset;dest[field]=(Number(dest[field])||0)+delta;
 }
 motionGeometry(next,size,targetId,scopes,percent);
 return next;
}

export function motionKeyframeAvailable(owner,field,percent){return owner?.clips.some(c=>c.keyframes?.some(k=>k[field]!==undefined&&Math.abs(resolveTimeRef(k.at,owner.beats,owner.context.durationS)-percent)<.01));}
