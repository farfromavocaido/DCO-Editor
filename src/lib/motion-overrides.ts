// @ts-nocheck
import {resolveClipGeometry} from './clip-geometry';
import {resolveTimeRef} from './creative-compiler';
import {beatsForScopes} from './timing-profiles';
import {clipsForProfile} from './headline-motion';
import {activeFrameScope} from './timing-profiles';
export function activeMotionOverride(layer,scopes=[]){return [...(layer.motionOverrides||[])].reverse().filter(o=>(o.when||[]).every(s=>scopes.includes(s))).sort((a,b)=>(b.when?.length||0)-(a.when?.length||0))[0]||null;}
export function timelineMotionClips(layer,scopes=[]){const override=activeMotionOverride(layer,scopes);return override?[resolveClipGeometry(override,scopes)]:clipsForProfile(layer.clips||[],activeFrameScope(scopes),scopes);}
export function makeMotionIndependent(document,size,layerId,clip,scopes){
 const next=structuredClone(document),layer=next.sizes[size].layers.find(l=>l.id===layerId);if(!layer)throw new Error('Layer not found');
 for(const rule of document.layoutRules||[])if(rule.enabled&&rule.targets?.some(t=>t.size===size)&&(rule.when||[]).every(s=>scopes.includes(s))&&[...(rule.layoutAnimations||[]),rule.transition].some(a=>a&&a.enabled!==false&&a.subjectId===layerId))throw new Error(`This layer drives ${rule.name||'linked layout motion'}. Detach that layout animation before making its timing independent.`);
 const id=`motion-override-${crypto.randomUUID()}`;
 // The browser includes transparent padding at 0/100. Keep the visible sequence
 // plus its entrance/exit endpoints; the compiler restores transparent padding.
 const frames=structuredClone(clip.keyframes),visible=frames.map((f,i)=>(f.opacity??1)>0?i:-1).filter(i=>i>=0);
 const keyframes=visible.length?frames.slice(Math.max(0,visible[0]-1),Math.min(frames.length,visible.at(-1)+2)):frames;
 layer.motionOverrides=[...(layer.motionOverrides||[]).filter(o=>JSON.stringify([...(o.when||[])].sort())!==JSON.stringify([...scopes].sort())),{...structuredClone(clip),id,label:'Independent timing',preset:'custom',keyframes,when:[...scopes]}];
 return {document:next,id};
}
export function validateMotionOverrides(document){
 for(const size of Object.values(document.sizes||{}))for(const layer of size.layers||[])for(const override of layer.motionOverrides||[]){
  if(!/^[a-z0-9_-]+$/i.test(override.id)||override.preset!=='custom'||!Array.isArray(override.when)||override.when.some(s=>!/^[-a-z0-9_]+$/i.test(s))||!Array.isArray(override.keyframes)||override.keyframes.length<2)throw new Error('Invalid independent animation');
  let last=-Infinity;for(const frame of override.keyframes){const at=resolveTimeRef(frame.at,beatsForScopes(document,override.when),document.clock.durationS);if(!Number.isFinite(at)||at<0||at>100||at<last)throw new Error('Independent keyframes need ordered times inside the ad');last=at;}
 }
}
