// @ts-nocheck
import {campaignConditionFamilies,campaignVariantModel} from './campaign-variants';
export type LayoutRule = {id:string;name:string;type:'conditional'|'spacing';enabled:boolean;targets:{size:string;targetId:string;scope?:string}[];when?:string[];values?:Record<string,string|number>;axis?:'x'|'y';targetEdge?:'start'|'center'|'end';reference?:{targetId:string;edge:'start'|'center'|'end'};gap?:number;gapUnit?:'px'|'em'|'percent';onMissing?:'authored'|'canvas';fallbackEdge?:'start'|'center'|'end';fallbackGap?:number};
export const getLayoutRules=(document):LayoutRule[]=>document?.layoutRules||[];
const tokens=value=>String(value||'').split('.').filter(Boolean);
export const layoutRuleStatus=(rule,scopes)=>!rule.enabled?'disabled':(rule.when||[]).every(scope=>scopes.includes(scope))?'active':'inactive';
const properties=new Set(['left','top','width','height','textAlign','alignItems','visibility','fontSize','lineHeight','letterSpacing']);
const targetExists=(document,size,id)=>{
 const [parent,child]=String(id).split('::');const layer=document.sizes?.[size]?.layers?.find(l=>l.id===parent);
 return !!layer && (!child || (/^offer-slot-\d+$/.test(parent)&&['offer-value','offer-subline'].includes(child)));
};
export function validateLayoutRules(document){
 if(document.layoutRules!==undefined&&!Array.isArray(document.layoutRules))throw new Error('Layout rules must be an array');
 const ids=new Set(),assignments=[];const families=campaignConditionFamilies(document);
 const known=new Set(campaignVariantModel(document).dimensions.flatMap(d=>d.options.map(o=>o.scope)));
 const overlap=(a,b)=>!families.some(f=>a.some(s=>f.includes(s))&&b.some(s=>f.includes(s))&&!a.some(s=>b.includes(s)&&f.includes(s)));
 for(const rule of getLayoutRules(document)){
  if(!rule.id||ids.has(rule.id)||!rule.name?.trim()||!['conditional','spacing'].includes(rule.type)||typeof rule.enabled!=='boolean'||!rule.targets?.length)throw new Error('Layout rule needs a unique ID, name, type, enabled flag and targets');ids.add(rule.id);
  if(rule.type==='conditional'){
   if(!rule.values||!Object.keys(rule.values).length)throw new Error('Choose at least one conditional value');
   for(const [key,value] of Object.entries(rule.values)){
    if(!properties.has(key))throw new Error(`Unsupported conditional property ${key}`);
    if(['left','top','width','height','fontSize'].includes(key) && (!Number.isFinite(Number(value))||(['width','height','fontSize'].includes(key)&&Number(value)<=0)))throw new Error(`${key} must be a valid pixel value`);
    if(['lineHeight','letterSpacing'].includes(key)&&!(/^-?\d+(?:\.\d+)?(?:px|em|%)?$/.test(String(value))||value==='normal'))throw new Error(`Invalid ${key}`);
    if(['textAlign','alignItems','visibility'].includes(key)&&!({textAlign:['left','center','right','start','end'],alignItems:['flex-start','center','flex-end','start','end'],visibility:['visible','hidden']}[key].includes(String(value))))throw new Error(`Invalid ${key}`);
   }
  }else{
   if(!['x','y'].includes(rule.axis)||!['start','center','end'].includes(rule.targetEdge)||!rule.reference||!['start','center','end'].includes(rule.reference.edge))throw new Error('Choose the spacing axis and both edges');
   if(!Number.isFinite(rule.gap)||!['px','em','percent'].includes(rule.gapUnit||'px'))throw new Error('Spacing gap must be finite with a supported unit');
   if(!['authored','canvas'].includes(rule.onMissing))throw new Error('Choose what happens when the reference is absent');
   if(rule.onMissing==='canvas'&&(!['start','center','end'].includes(rule.fallbackEdge)||!Number.isFinite(rule.fallbackGap)))throw new Error('Choose a canvas fallback edge and gap');
  }
  for(const member of rule.targets){
   if(!targetExists(document,member.size,member.targetId))throw new Error(`Unknown rule target ${member.size}/${member.targetId}`);
   const conditions=[...tokens(member.scope),...(rule.when||[])];
   if(conditions.some(s=>!known.has(s))||families.some(f=>conditions.filter(s=>f.includes(s)).filter((s,i,a)=>a.indexOf(s)===i).length>1))throw new Error('Rule uses an unknown or contradictory campaign condition');
   if(rule.type==='spacing'&&rule.reference.targetId!=='canvas'){
    const ref=rule.reference.targetId;
    if(!targetExists(document,member.size,ref))throw new Error(`Reference ${ref} is missing in ${member.size}`);
    if(ref===member.targetId||ref.startsWith(member.targetId+'::')||member.targetId.startsWith(ref+'::'))throw new Error('An element cannot space itself against its own ink');
   }
   if(rule.enabled){const fields=rule.type==='spacing'?[rule.axis==='x'?'left':'top']:Object.keys(rule.values);
    for(const prior of assignments)if(prior.size===member.size&&prior.targetId===member.targetId&&overlap(prior.conditions,conditions)&&prior.fields.some(f=>fields.includes(f)))throw new Error(`Conflicting rules: ${prior.name} and ${rule.name}`);
    assignments.push({...member,conditions,fields,name:rule.name,reference:rule.type==='spacing'?rule.reference.targetId:null});
   }
  }
 }
 for(const size of Object.keys(document.sizes||{})){
  const graph=new Map();for(const item of assignments.filter(a=>a.size===size&&a.reference&&a.reference!=='canvas'))graph.set(item.targetId,[...(graph.get(item.targetId)||[]),item]);
  const possible=conditions=>!families.some(f=>new Set(conditions.filter(s=>f.includes(s))).size>1);
  const visit=(id,conditions,path)=>{for(const item of graph.get(id)||[]){const next=[...conditions,...item.conditions];if(!possible(next))continue;if(path.has(item.reference))throw new Error('Circular responsive spacing references');visit(item.reference,next,new Set([...path,item.reference]));}};
  for(const id of graph.keys())visit(id,[],new Set([id]));
 }
}
/** Serialisable renderer contract. Includes disabled/inactive rules for provenance. */
export function layoutRulesForSize(document,size){validateLayoutRules(document);return getLayoutRules(document).flatMap(rule=>rule.targets.filter(t=>t.size===size).map(target=>({...rule,targetId:target.targetId,scope:target.scope||'',size,targets:undefined})));}
