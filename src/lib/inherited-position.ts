// @ts-nocheck
import {editableTargetsForLayer,findCreativeTarget} from './creative-model';
import {resetCreativeOwnershipField,setCreativeOwnershipField} from './creative-ownership';
const fields=['left','top'];
const sourceKey=s=>s?.kind==='classRule'?`class:${s.cssClass}`:s?.kind==='variantRule'?`rule:${s.ruleId}`:null;
function withoutLocalPosition(document,size,id,scopes){
 let next=document;
 for(const field of fields)for(let i=0;i<(document.sizes[size].localOverrides||[]).length;i++){
  if(findCreativeTarget(next,size,id,scopes)?.valueProvenance?.[field]?.kind!=='localOverride')break;
  next=resetCreativeOwnershipField(next,size,id,scopes,'values',field);
 }
 return next;
}
export function inheritedPositionSharing(document,size,id,scopes){
 const current=findCreativeTarget(document,size,id,scopes);if(!current)return [];
 const baseline=withoutLocalPosition(document,size,id,scopes),inherited=findCreativeTarget(baseline,size,id,scopes);
 const candidates=document.sizes[size].layers.flatMap(l=>[l.id,...editableTargetsForLayer(l).map(t=>t.id)]).filter(other=>other!==id).map(other=>{const target=findCreativeTarget(document,size,other,scopes);return target?{...target,inherited:findCreativeTarget(withoutLocalPosition(document,size,other,scopes),size,other,scopes)}:null;}).filter(Boolean);
 return fields.flatMap(field=>{const source=inherited?.valueProvenance?.[field],key=sourceKey(source);if(!key)return [];
  const members=candidates.filter(t=>sourceKey(t.inherited?.valueProvenance?.[field])===key);if(!members.length)return [];
  return [{field,source,members:members.map(t=>({id:t.id,label:t.label,independent:t.valueProvenance?.[field]?.kind==='localOverride'})),independent:current.valueProvenance?.[field]?.kind==='localOverride'}];
 });
}
export function setInheritedPositionIndependent(document,size,id,scopes,independent){
 const sharing=inheritedPositionSharing(document,size,id,scopes),target=findCreativeTarget(document,size,id,scopes);let next=document;
 if(independent){for(const {field} of sharing)next=setCreativeOwnershipField(next,size,id,scopes,'values',field,target.values[field],'local');}
 else {for(const {field} of sharing)for(let i=0;i<(document.sizes[size].localOverrides||[]).length;i++){if(findCreativeTarget(next,size,id,scopes)?.valueProvenance?.[field]?.kind!=='localOverride')break;next=resetCreativeOwnershipField(next,size,id,scopes,'values',field);}}
 return next;
}
