// @ts-nocheck
import {editableTargetsForLayer,findCreativeTarget,findMaterializedCreativeTarget} from './creative-model';
import {resetCreativeOwnershipField,setCreativeOwnershipField,materializeCreativeOwnership} from './creative-ownership';
const fields=['left','top'];
const sourceKey=s=>s?.kind==='classRule'?`class:${s.cssClass}`:s?.kind==='variantRule'?`rule:${s.ruleId}`:null;
// Documents are immutable editor snapshots. Compile once per version, not per frame/target.
const cache=new WeakMap();
export function inheritedPositionSharing(document,size,id,scopes){
 let versions=cache.get(document);if(!versions){versions=new Map();cache.set(document,versions);}
 const key=JSON.stringify([size,[...scopes].sort()]);let targets=versions.get(key);
 if(!targets){
  const creative=document.sizes[size];
  const baseline={...document,sizes:{...document.sizes,[size]:{...creative,localOverrides:(creative.localOverrides||[]).map(local=>{const {left,top,...values}=local.values||{};return {...local,values};})}}};
  const compiled=materializeCreativeOwnership(document),inherited=materializeCreativeOwnership(baseline);
  targets=creative.layers.flatMap(l=>[l.id,...editableTargetsForLayer(l).map(t=>t.id)]).map(targetId=>{
   const target=findMaterializedCreativeTarget(compiled,size,targetId,scopes);
   return target?{...target,inherited:findMaterializedCreativeTarget(inherited,size,targetId,scopes)}:null;
  }).filter(Boolean);
  versions.set(key,targets);
 }
 const current=targets.find(t=>t.id===id);if(!current)return [];
 return fields.flatMap(field=>{const source=current.inherited?.valueProvenance?.[field],key=sourceKey(source);if(!key)return [];
  const members=targets.filter(t=>t.id!==id&&sourceKey(t.inherited?.valueProvenance?.[field])===key);if(!members.length)return [];
  return [{field,source,members:members.map(t=>({id:t.id,label:t.label,independent:t.valueProvenance?.[field]?.kind==='localOverride'})),independent:current.valueProvenance?.[field]?.kind==='localOverride'}];
 });
}
export function setInheritedPositionIndependent(document,size,id,scopes,independent){
 const sharing=inheritedPositionSharing(document,size,id,scopes),target=findCreativeTarget(document,size,id,scopes);let next=document;
 if(independent){for(const {field} of sharing)next=setCreativeOwnershipField(next,size,id,scopes,'values',field,target.values[field],'local');}
 else {for(const {field} of sharing)for(let i=0;i<(document.sizes[size].localOverrides||[]).length;i++){if(findCreativeTarget(next,size,id,scopes)?.valueProvenance?.[field]?.kind!=='localOverride')break;next=resetCreativeOwnershipField(next,size,id,scopes,'values',field);}}
 return next;
}
