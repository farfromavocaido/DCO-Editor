// @ts-nocheck
import {transitionCases,validateLayoutTransition,layoutSequenceCases} from './layout-transitions';
import {campaignConditionFamilies,campaignVariantModel} from './campaign-variants';
export type LayoutRule = {id:string;name:string;type:'conditional'|'spacing'|'distribute';enabled:boolean;targets:{size:string;targetId:string;scope?:string}[];when?:string[];condition?:{targetId:string;test:string;value?:number};otherwise?:Record<string,string|number>;areas?:Record<string,{left:number;top:number;width:number;height:number}>;single?:'start'|'center'|'end';crossAlign?:'keep'|'start'|'center'|'end';minGap?:number;overflow?:'authored'|'extend';transition?:any;layoutAnimations?:any[];startingArrangement?:'all'|'present';values?:Record<string,string|number>;axis?:'x'|'y';targetEdge?:'start'|'center'|'end';reference?:{targetId:string;edge:'start'|'center'|'end'};gap?:number;gapUnit?:'px'|'em'|'percent';onMissing?:'authored'|'canvas';fallbackEdge?:'start'|'center'|'end';fallbackGap?:number};
export const getLayoutRules=(document):LayoutRule[]=>document?.layoutRules||[];
const related=(a,b)=>a===b||a.startsWith(b+'::')||b.startsWith(a+'::');
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
  if(!rule.id||ids.has(rule.id)||!rule.name?.trim()||!['conditional','spacing','distribute'].includes(rule.type)||typeof rule.enabled!=='boolean'||!rule.targets?.length)throw new Error('Layout rule needs a unique ID, name, type, enabled flag and targets');ids.add(rule.id);
  if(rule.type==='conditional'){
   if(!Object.keys({...rule.values,...(rule.condition?rule.otherwise:{})}).length)throw new Error('Choose at least one conditional value');
   for(const [key,value] of [...Object.entries(rule.values||{}),...Object.entries(rule.otherwise||{})]){
    if(!properties.has(key))throw new Error(`Unsupported conditional property ${key}`);
    if(['left','top','width','height','fontSize'].includes(key) && (!Number.isFinite(Number(value))||(['width','height','fontSize'].includes(key)&&Number(value)<=0)))throw new Error(`${key} must be a valid pixel value`);
    if(['lineHeight','letterSpacing'].includes(key)&&!(/^-?\d+(?:\.\d+)?(?:px|em|%)?$/.test(String(value))||value==='normal'))throw new Error(`Invalid ${key}`);
    if(['textAlign','alignItems','visibility'].includes(key)&&!({textAlign:['left','center','right','start','end'],alignItems:['flex-start','center','flex-end','start','end'],visibility:['visible','hidden']}[key].includes(String(value))))throw new Error(`Invalid ${key}`);
   }
  }else if(rule.type==='distribute'){
   if((rule.crossAlign!==undefined&&!['keep','start','center','end'].includes(rule.crossAlign))||!['x','y'].includes(rule.axis)||!['start','center','end'].includes(rule.single)||!Number.isFinite(rule.minGap)||rule.minGap<0||!['authored','extend'].includes(rule.overflow))throw new Error('Choose direction, single-item placement, minimum gap and overflow behaviour');
   for(const size of new Set(rule.targets.map(t=>t.size))){const area=rule.areas?.[size];if(!area||!['left','top','width','height'].every(k=>Number.isFinite(area[k]))||area.width<=0||area.height<=0)throw new Error('The layout area needs a positive width and height');}
   for(const a of rule.targets)for(const b of rule.targets)if(a!==b&&a.size===b.size&&(a.targetId===b.targetId||a.targetId.startsWith(b.targetId+'::')))throw new Error('Select each element once; do not arrange a parent alongside its contents');
  }else{
   if(!['x','y'].includes(rule.axis)||!['start','center','end'].includes(rule.targetEdge)||!rule.reference||!['start','center','end'].includes(rule.reference.edge))throw new Error('Choose the spacing axis and both edges');
   if(!Number.isFinite(rule.gap)||!['px','em','percent'].includes(rule.gapUnit||'px'))throw new Error('Spacing gap must be finite with a supported unit');
   if(!['authored','canvas'].includes(rule.onMissing))throw new Error('Choose what happens when the reference is absent');
   if(rule.onMissing==='canvas'&&(!['start','center','end'].includes(rule.fallbackEdge)||!Number.isFinite(rule.fallbackGap)))throw new Error('Choose a canvas fallback edge and gap');
  }
  validateLayoutTransition(document,rule);
  for(const member of rule.targets){
   if(rule.type==='distribute'&&member.scope)throw new Error('Limit the whole layout area using campaign conditions, rather than individual member conditions');
   if(!targetExists(document,member.size,member.targetId))throw new Error(`Unknown rule target ${member.size}/${member.targetId}`);
   if(rule.condition){
    if(Object.keys({...rule.values,...rule.otherwise}).some(k=>['fontSize','lineHeight','letterSpacing','textAlign','alignItems'].includes(k)))throw new Error('Content conditions control frame placement and visibility; use the text controls for typography and alignment');
    const c=rule.condition;if(rule.type!=='conditional'||!targetExists(document,member.size,c.targetId)||!['has-text','empty','shown','hidden','lines-at-least','lines-at-most','lines-equal','height-at-least'].includes(c.test))throw new Error('Choose an element and a supported condition');
    if(['lines-at-least','lines-at-most','lines-equal','height-at-least'].includes(c.test)&&(!Number.isFinite(c.value)||c.value<0||(c.test.startsWith('lines')&&!Number.isInteger(c.value))))throw new Error('Enter a valid condition threshold');
   }
   const conditions=[...tokens(member.scope),...(rule.when||[])];
   if(conditions.some(s=>!known.has(s))||families.some(f=>conditions.filter(s=>f.includes(s)).filter((s,i,a)=>a.indexOf(s)===i).length>1))throw new Error('Rule uses an unknown or contradictory campaign condition');
   if(rule.type==='spacing'&&rule.reference.targetId!=='canvas'){
    const ref=rule.reference.targetId;
    if(!targetExists(document,member.size,ref))throw new Error(`Reference ${ref} is missing in ${member.size}`);
    if(ref===member.targetId||ref.startsWith(member.targetId+'::')||member.targetId.startsWith(ref+'::'))throw new Error('An element cannot space itself against its own ink');
   }
   if(rule.enabled){const fields=rule.type==='distribute'&&rule.crossAlign&&rule.crossAlign!=='keep'?['left','top']:rule.type!=='conditional'?[rule.axis==='x'?'left':'top']:Object.keys({...rule.values,...rule.otherwise});
    for(const prior of assignments)if(prior.size===member.size&&prior.targetId===member.targetId&&overlap(prior.conditions,conditions)&&prior.fields.some(f=>fields.includes(f)))throw new Error(`Conflicting rules: ${prior.name} and ${rule.name}`);
    assignments.push({...member,conditions,fields,name:rule.name,reference:rule.type==='spacing'?rule.reference.targetId:null,condition:rule.condition});
   }
  }
 }
 const measurementFields=['width','height','visibility','fontSize','lineHeight','letterSpacing'];
 for(const start of assignments.filter(a=>a.condition&&!['has-text','empty'].includes(a.condition.test))){
  const visit=(item,path)=>{if(['has-text','empty'].includes(item.condition?.test))return;if(path.has(item))throw new Error('Circular content condition: an element cannot change the measurement its placement depends on');const next=new Set([...path,item]);for(const dependency of assignments.filter(a=>a.size===item.size&&related(a.targetId,item.condition?.targetId||'')&&a.fields.some(f=>measurementFields.includes(f)))){if(dependency===item)throw new Error('A line-count or visibility condition cannot change its own measurement');if(dependency.condition)visit(dependency,next);}};visit(start,new Set());
 }
 for(const size of Object.keys(document.sizes||{})){
  const graph=new Map();for(const item of assignments.filter(a=>a.size===size&&a.reference&&a.reference!=='canvas'))graph.set(item.targetId,[...(graph.get(item.targetId)||[]),item]);
  const possible=conditions=>!families.some(f=>new Set(conditions.filter(s=>f.includes(s))).size>1);
  const visit=(id,conditions,path)=>{for(const item of graph.get(id)||[]){const next=[...conditions,...item.conditions];if(!possible(next))continue;if(path.has(item.reference))throw new Error('Circular responsive spacing references');visit(item.reference,next,new Set([...path,item.reference]));}};
  for(const id of graph.keys())visit(id,[],new Set([id]));
 }
}
/** Serialisable renderer contract. Includes disabled/inactive rules for provenance. */
export function layoutRulesForSize(document,size){validateLayoutRules(document);return getLayoutRules(document).flatMap(rule=>rule.type==='distribute'?(rule.targets.some(t=>t.size===size)?[{...rule,size,transitionCases:rule.layoutAnimations===undefined?transitionCases(document,size,rule):[],sequenceCases:rule.layoutAnimations!==undefined?layoutSequenceCases(document,size,rule):undefined,area:rule.areas[size],members:rule.targets.filter(t=>t.size===size).map(t=>t.targetId),textMembers:rule.targets.filter(t=>t.size===size&&(t.targetId.includes('::')||document.sizes[size].layers.find(l=>l.id===t.targetId)?.kind==='text')).map(t=>t.targetId),targetId:rule.targets.find(t=>t.size===size).targetId,scope:'',targets:undefined}]:[]):rule.targets.filter(t=>t.size===size).map(target=>({...rule,targetId:target.targetId,scope:target.scope||'',size,targets:undefined})));}
