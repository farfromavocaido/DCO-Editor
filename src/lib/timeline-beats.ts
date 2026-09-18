// @ts-nocheck
import {clipBeatReferences} from './timeline-relationships';
import {beatsForScopes,activeFrameScope} from './timing-profiles';
import {clipsForProfile} from './headline-motion';
import {resolveTimeRef} from './creative-compiler';
import {validateLayoutTransition} from './layout-transitions';
/** Labels are separate from stable timing IDs, keeping existing clip and layout references intact. */
export const beatLabel = (document, id) => document.clock.beatLabels?.[id] || id.replaceAll('_', ' ');
export function keyTimelineBeats(document,beats){
 if(document.clock.timelineBeats)return document.clock.timelineBeats.filter(id=>beats[id]!==undefined);
 const usage={};for(const size of Object.values(document.sizes||{}))for(const layer of size.layers||[])for(const clip of layer.clips||[])for(const id of clipBeatReferences(clip,beats))usage[id]=(usage[id]||0)+1;
 const selected=[];for(const id of Object.keys(usage).sort((a,b)=>usage[b]-usage[a])){
  if(beats[id]<=0||beats[id]>=100||selected.some(other=>Math.abs(beats[other]-beats[id])<4))continue;
  selected.push(id);if(selected.length===6)break;
 }return selected.sort((a,b)=>beats[a]-beats[b]);
}
export function setKeyTimelineBeat(document,id,visible,beats){const list=new Set(keyTimelineBeats(document,beats));if(visible)list.add(id);else list.delete(id);return {...document,clock:{...document.clock,timelineBeats:[...list]}};}
export function moveTimelineBeat(document,id,seconds,scopes){
 const value=seconds/document.clock.durationS*100;if(!Number.isFinite(value)||value<0||value>100)throw new Error('Choose a time inside the ad');
 const profile=activeFrameScope(scopes),next={...document,clock:{...document.clock,profiles:{...document.clock.profiles,[profile]:{...document.clock.profiles?.[profile],[id]:value}}}};
 const beats=beatsForScopes(next,scopes);if(Math.abs(beats[id]-value)>.0001)throw new Error('This beat is calculated by the campaign. Edit its source timing instead.');
 for(const size of Object.values(next.sizes||{}))for(const layer of size.layers||[])for(const clip of clipsForProfile(layer.clips||[],profile,scopes)){
  for(const ref of [clip.start,clip.end,...(clip.keyframes||[]).map(f=>f.at)].filter(v=>v!==undefined))resolveTimeRef(ref,beats,next.clock.durationS);
  const times=(clip.keyframes||[]).map(f=>resolveTimeRef(f.at,beats,next.clock.durationS));
  if(times.some((t,i)=>i&&t<times[i-1])||(clip.start!==undefined&&clip.end!==undefined&&resolveTimeRef(clip.end,beats,next.clock.durationS)<resolveTimeRef(clip.start,beats,next.clock.durationS)))throw new Error('This would reverse an animation’s timing');
 }for(const rule of next.layoutRules||[])validateLayoutTransition(next,rule);return next;
}
export function renameTimelineBeat(document, id, label) {
  if (!label.trim()) throw new Error('Enter a beat name');
  const next = structuredClone(document);
  next.clock.beatLabels = { ...next.clock.beatLabels, [id]: label.trim() };
  return next;
}
export function addTimelineBeat(document, label, seconds) {
  if (!label.trim()) throw new Error('Enter a beat name');
  const duration = document.clock.durationS;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > duration) throw new Error('Choose a time inside the ad');
  const next = structuredClone(document);
  const used = new Set([...Object.keys(next.clock.beats), ...Object.values(next.clock.profiles || {}).flatMap(p => Object.keys(p))]);
  let n = 1; while (used.has(`custom_beat_${n}`)) n++;
  const id = `custom_beat_${n}`;
  next.clock.beats[id] = seconds / duration * 100;
  next.clock.beatLabels = { ...next.clock.beatLabels, [id]: label.trim() };
  next.clock.timelineBeats=[...keyTimelineBeats(document,{...document.clock.beats,...Object.assign({},...Object.values(document.clock.profiles||{}))}),id];
  return { document: next, id };
}
