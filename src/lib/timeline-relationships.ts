// @ts-nocheck
import {keyframeClip} from './keyframe-editing';
import {resolveTimeRef} from './creative-compiler';

export function clipBeatReferences(clip,beats){
 const refs=new Set();
 const visit=(value,key='')=>{
  if(['id','label','preset','copiedFrom','motionLinkId','geometryEdits'].includes(key))return;
  if(typeof value==='string'){const match=value.match(/^([a-z_][a-z0-9_]*)(?:\s*[+-]\s*\d+(?:\.\d+)?)?$/i);if(match&&beats[match[1]]!==undefined)refs.add(match[1]);}
  else if(Array.isArray(value))value.forEach(v=>visit(v));else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>visit(v,k));
 };visit(clip);return [...refs];
}
export function detachClipTiming(clip,beats,durationS){
 const visit=(value,key='')=>{
  if(['id','label','preset','copiedFrom','motionLinkId','geometryEdits'].includes(key))return value;
  if(typeof value==='string'&&clipBeatReferences({value},beats).length)return resolveTimeRef(value,beats,durationS);
  if(Array.isArray(value))return value.map(v=>visit(v));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,visit(v,k)]));
  return value;
 };return visit(structuredClone(clip));
}
export function linkedMotionMembers(document,size,layerId,clipId){
 const all=(document?.sizes?.[size]?.layers||[]).flatMap(layer=>(layer.clips||[]).map(clip=>({layer,clip})));
 const source=all.find(m=>m.layer.id===layerId&&m.clip.id===clipId);if(!source||source.clip.linked===false)return [];
 const root=m=>m.clip.motionLinkId||`${m.clip.copiedFrom?.layerId||m.layer.id}/${m.clip.copiedFrom?.clipId||m.clip.id}`;
 return all.filter(m=>m.clip.linked!==false&&root(m)===root(source));
}
/** Update only edited channels; preserve each member's identity, local geometry and time offsets. */
export function replaceLinkedMotion(document,size,layerId,clipId,nextClip,beats,context){
 const members=linkedMotionMembers(document,size,layerId,clipId),source=members.find(m=>m.layer.id===layerId&&m.clip.id===clipId);
 if(!source||members.length<2)throw new Error('This sequence has no linked copies');
 const before=keyframeClip(source.clip,beats,context),after=keyframeClip(nextClip,beats,context);
 if(before.keyframes.length!==after.keyframes.length)throw new Error('Make independent before adding or removing keyframes');
 const replacements=members.map(m=>{
  if(m===source)return {...m,next:nextClip};
  const next=keyframeClip(m.clip,beats,context);
  if(next.keyframes.length!==before.keyframes.length)throw new Error('Linked copies have different keyframes. Make independent to edit this sequence.');
  for(let i=0;i<after.keyframes.length;i++)for(const key of new Set([...Object.keys(before.keyframes[i]),...Object.keys(after.keyframes[i])])){
   if(JSON.stringify(before.keyframes[i][key])===JSON.stringify(after.keyframes[i][key]))continue;
   if(key==='at')next.keyframes[i].at=resolveTimeRef(next.keyframes[i].at,beats,context.durationS)+resolveTimeRef(after.keyframes[i].at,beats,context.durationS)-resolveTimeRef(before.keyframes[i].at,beats,context.durationS);
   else if(after.keyframes[i][key]===undefined)delete next.keyframes[i][key];else next.keyframes[i][key]=structuredClone(after.keyframes[i][key]);
  }
  const times=next.keyframes.map(f=>resolveTimeRef(f.at,beats,context.durationS));
  if(times.some((t,i)=>!Number.isFinite(t)||t<0||t>100||(i&&t<times[i-1])))throw new Error('This edit would put a linked copy outside its valid timing');
  return {...m,next};
 });
 const result=structuredClone(document);
 for(const {layer,clip,next} of replacements){const target=result.sizes[size].layers.find(l=>l.id===layer.id);target.clips=target.clips.map(c=>c.id===clip.id?next:c);}
 return result;
}

export function timelineFolders(entries,creative){
 const folders=[...(creative?.timelineFolders||[]).map(g=>({...g,folder:true})),...(creative?.canvasGroups||[]).map(g=>({...g,canvas:true}))];
 const assigned=new Set(),out=[];
 for(const group of folders){const layers=entries.flatMap(e=>e.layer?[e.layer]:[...(e.layers||[]),...(e.hiddenLayers||[])]).filter(l=>group.members.includes(l.id)&&!assigned.has(l.id));
  if(!layers.length)continue;layers.forEach(l=>assigned.add(l.id));out.push({kind:'folder',...group,layers});
 }
 for(const entry of entries){if(entry.layer){if(!assigned.has(entry.layer.id))out.push(entry);}else{const layers=entry.layers.filter(l=>!assigned.has(l.id)),hiddenLayers=(entry.hiddenLayers||[]).filter(l=>!assigned.has(l.id));if(layers.length||hiddenLayers.length)out.push({...entry,layers,hiddenLayers});}}
 return out;
}
