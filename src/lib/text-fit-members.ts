// @ts-nocheck
import {materializeCreativeOwnership} from './creative-ownership';
import {findMaterializedCreativeTarget,editableTargetsForLayer} from './creative-model';
import {textFitRulesForSize} from './text-fit-rules';
import {resolveTextFitRule} from './text-fit';
const cache=new WeakMap();
export function textFitMembers(document,size,id,scopes){
 if(!document)return [];
 let versions=cache.get(document);if(!versions){versions=new Map();cache.set(document,versions);}const key=JSON.stringify([size,[...scopes].sort()]);
 let members=versions.get(key);if(!members){const compiled=materializeCreativeOwnership(document),creative=compiled.sizes[size];if(!creative)return [];
 const rules=textFitRulesForSize(creative,Boolean(document.variantModel));
 members=creative.layers.flatMap(l=>[...(l.kind==='text'?[l.id]:[]),...editableTargetsForLayer(l).map(t=>t.id)]).flatMap(targetId=>{
  const t=findMaterializedCreativeTarget(compiled,size,targetId,scopes);if(!t||t.values.visibility==='hidden'||t.values.display==='none')return [];
  if(t.parentLayerId){const parent=findMaterializedCreativeTarget(compiled,size,t.parentLayerId,scopes);if(parent?.values.visibility==='hidden'||parent?.values.display==='none')return [];}
  const specific=rules.find(r=>r.targetId===targetId),base=rules.find(r=>!r.targetId&&r.cssClass===t.cssClass),fit=(specific&&resolveTextFitRule(specific,scopes))||(base&&resolveTextFitRule(base,scopes));
  return fit?.shared?[{id:targetId,label:t.label,group:fit.sharedGroup||fit.cssClass,explicit:Boolean(fit.frame)}]:[];
 });versions.set(key,members);}
 const target=members.find(t=>t.id===id);return target?members.filter(t=>t.group===target.group&&t.explicit===target.explicit):[];
}
