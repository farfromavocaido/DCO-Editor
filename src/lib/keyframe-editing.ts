// @ts-nocheck
import {compileAnimationClips,resolveTimeRef,frameAtPercent} from './creative-compiler';

const presetFrames=(clip,beats,context)=>{const start=resolveTimeRef(clip.start??0,beats,context.durationS),end=resolveTimeRef(clip.end??100,beats,context.durationS);return compileAnimationClips([clip],beats,context).filter(f=>f.at>=start&&f.at<=end);};
/** Editor-only helpers. Merely viewing a preset never changes its authored data. */
export function editableKeyframes(clip,beats,context){
 const frames=clip.preset==='custom'?(clip.keyframes||[]):presetFrames(clip,beats,context);
 return frames.map((frame,index)=>({index,frame,at:resolveTimeRef(frame.at,beats,context.durationS)})).sort((a,b)=>a.at-b.at);
}
export function keyframeClip(clip,beats,context){
 if(clip.preset==='custom')return structuredClone(clip);
 const frames=presetFrames(clip,beats,context).map(frame=>{const f={...frame};if(clip.preset!=='popPulse')delete f.scale;if(clip.preset==='fade')delete f.translate;return f;});
 const next={...structuredClone(clip),preset:'custom',keyframes:frames};
 delete next.params;delete next.start;delete next.end;delete next.durationPct;
 return next;
}
export function editKeyframe(clip,index,patch,beats,context){
 const next=keyframeClip(clip,beats,context);if(!next.keyframes[index])throw new Error('Select a keyframe first');
 const frame={...next.keyframes[index],...patch};
 if(patch.at!==undefined){const at=resolveTimeRef(patch.at,beats,context.durationS);if(!Number.isFinite(at)||at<0||at>100)throw new Error('Time must be inside the ad');
  const order=editableKeyframes(next,beats,context),position=order.findIndex(f=>f.index===index);
  if(position>0&&at<=order[position-1].at||position<order.length-1&&at>=order[position+1].at)throw new Error('Keep this keyframe between its neighbours');
 }
 for(const field of ['left','top','width','height','opacity'])if(patch[field]!==undefined&&(!Number.isFinite(Number(patch[field]))||(['width','height'].includes(field)&&Number(patch[field])<=0)))throw new Error('Enter a valid '+field);
 if(patch.opacity!==undefined&&(patch.opacity<0||patch.opacity>1))throw new Error('Opacity must be between 0 and 100%');
 if(patch.scale!==undefined&&!(Array.isArray(patch.scale)?patch.scale.length===2&&patch.scale.every(v=>Number.isFinite(Number(v))&&Number(v)>0):Number.isFinite(Number(patch.scale))&&Number(patch.scale)>0))throw new Error('Scale must be positive');
 next.keyframes[index]=frame;return next;
}
export function retimeClip(clip,start,end,beats,context){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>100||end<=start)throw new Error('The animation needs a positive duration inside the ad');
 const frames=editableKeyframes(clip,beats,context),first=clip.preset==='custom'?frames[0]?.at:resolveTimeRef(clip.start,beats,context.durationS),last=clip.preset==='custom'?frames.at(-1)?.at:resolveTimeRef(clip.end??100,beats,context.durationS);
 const next=structuredClone(clip);
 if(clip.preset==='custom'){const span=last-first;if(!(span>0))throw new Error('Animation has no duration');next.keyframes=next.keyframes.map(f=>({...f,at:start+(resolveTimeRef(f.at,beats,context.durationS)-first)/span*(end-start)}));}
 else{next.start=start;next.end=end;}
 return next;
}
function splitEasing(easing,progress){
 if(!easing||easing==='linear')return ['linear','linear'];
 const named={'ease':[.25,.1,.25,1],'ease-in':[.42,0,1,1],'ease-out':[0,0,.58,1],'ease-in-out':[.42,0,.58,1]};
 const match=String(easing).match(/^cubic-bezier\(([^)]+)\)$/),points=named[easing]||(match?match[1].split(',').map(Number):null);
 if(!points||points.length!==4||!points.every(Number.isFinite))throw new Error('Use a linear or cubic easing before inserting between these keyframes');
 const [x1,y1,x2,y2]=points,coordinate=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
 let low=0,high=1;for(let i=0;i<40;i++){const t=(low+high)/2;if(coordinate(t,x1,x2)<progress)low=t;else high=t;}const t=(low+high)/2;
 const mix=(a,b)=>a.map((v,i)=>v+(b[i]-v)*t),a=mix([0,0],[x1,y1]),b=mix([x1,y1],[x2,y2]),c=mix([x2,y2],[1,1]),d=mix(a,b),e=mix(b,c),f=mix(d,e);
 if(Math.abs(f[1])<1e-8||Math.abs(1-f[1])<1e-8)throw new Error('This easing cannot be split here without changing its motion');
 const curve=v=>'cubic-bezier('+v.map(n=>Number(n.toFixed(8))).join(', ')+')';
 return [curve([a[0]/f[0],a[1]/f[1],d[0]/f[0],d[1]/f[1]]),curve([(e[0]-f[0])/(1-f[0]),(e[1]-f[1])/(1-f[1]),(c[0]-f[0])/(1-f[0]),(c[1]-f[1])/(1-f[1])])];
}
export function insertKeyframe(clip,at,beats,context){
 const next=keyframeClip(clip,beats,context);if(next.geometryEdits?.length)throw new Error('This animation has scoped position offsets; edit existing keyframes first');
 if(!Number.isFinite(at)||at<0||at>100)throw new Error('Time must be inside the ad');
 const existing=next.keyframes.findIndex(f=>Math.abs(resolveTimeRef(f.at,beats,context.durationS)-at)<.001);if(existing>=0)return {clip:next,index:existing};
 const sample=frameAtPercent(compileAnimationClips([next],beats,context),at),owned=new Set(next.keyframes.flatMap(f=>Object.keys(f))),frame={...Object.fromEntries(Object.entries(sample).filter(([key])=>owned.has(key))),at};
 const ordered=editableKeyframes(next,beats,context),previous=ordered.filter(f=>f.at<at).at(-1),following=ordered.find(f=>f.at>at);
 if(previous&&following){const [before,after]=splitEasing(next.keyframes[previous.index].easing,(at-previous.at)/(following.at-previous.at));next.keyframes[previous.index]={...next.keyframes[previous.index],easing:before};frame.easing=after;}
 next.keyframes.push(frame);next.keyframes.sort((a,b)=>resolveTimeRef(a.at,beats,context.durationS)-resolveTimeRef(b.at,beats,context.durationS));return {clip:next,index:next.keyframes.indexOf(frame)};
}
