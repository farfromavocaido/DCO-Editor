// @ts-nocheck
import {getTargetCanvasBounds} from './canvas-alignment';
import {materializeCreativeOwnership} from './creative-ownership';
import {editableTargetsForLayer,findMaterializedCreativeTarget} from './creative-model';
import {textFitRulesForSize} from './text-fit-rules';
import {resolveTextFitRule} from './text-fit';
import {campaignVariantModel,campaignScopes,campaignConditionIsValid} from './campaign-variants';

/** Explicit one-time migration, never called during validation/load/save. */
export function migrateTextFitting(document){
 const next=structuredClone(document),source=materializeCreativeOwnership(document),model=campaignVariantModel(document),report=[];
 const dims=model.dimensions.filter(d=>!d.derived||d.id==='roundelMode');let rows=[{}];for(const dim of dims)rows=rows.flatMap(row=>dim.options.map(o=>({...row,[dim.field]:o.value})));
 const states=[...new Map(rows.map(row=>{const s=campaignScopes(document,row).sort();return [s.join('.'),s];})).values()].filter(s=>campaignConditionIsValid(document,s));
 const matches=(state,cube)=>cube.every(s=>state.includes(s));
 for(const [size,creative] of Object.entries(source.sizes)){
  const rules=textFitRulesForSize(creative,Boolean(document.variantModel)),targets=creative.layers.flatMap(l=>[...(l.kind==='text'?[l.id]:[]),...editableTargetsForLayer(l).map(p=>p.id)]);
  const output=next.sizes[size];
  // Snapshot effective settings first; explicit rules below replace all old fit
  // sources, while leaving geometry, copy, timing and property ownership intact.
  for(const collection of ['layers','classRules','variantRules','localOverrides'])for(const item of output[collection]||[])delete item.fit;
  for(const id of targets){const groups=new Map();
   for(const scopes of states){
    const target=findMaterializedCreativeTarget(source,size,id,scopes);if(!target)continue;
    const specific=rules.find(r=>r.targetId===id),base=rules.find(r=>!r.targetId&&r.cssClass===target.cssClass);
    const old=(specific&&resolveTextFitRule(specific,scopes))||(base&&resolveTextFitRule(base,scopes))||{};
    const isLegal=/^(terms-|unit-rate)/.test(id),isRoundel=/^roundel-(copy|value)$/.test(id),unfitted=!Object.keys(old).length;
    const fixed=old.allowShrink===false||Boolean(old.static)||unfitted;
    const wrap=unfitted?['normal','pre-line','pre-wrap'].includes(target.values.whiteSpace):Boolean(old.wrap);
    let design=Number(target.values.fontSize)||16,minimum=old.minFontSize!==undefined&&Number.isFinite(Number(old.minFontSize))?Number(old.minFontSize):Math.max(1,Math.round(design*.75));const values={};
    if(minimum>design){[minimum,design]=[design,minimum];values.fontSize=design;report.push({size,id,scope:scopes.join('.'),change:'Reversed font limits corrected',design,minimum});}
    const fit={frame:old.frame|| (isLegal?'auto':'fixed'),wrap,allowShrink:isRoundel?true:!fixed,overflow:isLegal?'visible':old.overflow||(old.static==='truncate'?'ellipsis':'clip'),shared:Boolean(old.shared),sharedGroup:old.sharedGroup||'',minFontSize:minimum,minFontSizeRatio:Number(old.minFontSizeRatio)||0,maxLines:Number(old.maxLines)||0,tracking:structuredClone(old.tracking||{minEm:0}),align:old.align||'normal',disabled:false};
    if(old.anchor)fit.anchor=structuredClone(old.anchor);
    const box=getTargetCanvasBounds(source,size,id,scopes,findMaterializedCreativeTarget);
    if(fit.frame==='fixed'&&!(Number(target.values.height)>0)&&box)values.height=box.height;
    if(id.endsWith('::offer-value')&&!fit.anchor&&box)fit.anchor={edge:'end',position:box.top+box.height,referenceHeight:creative.canvas.height};
    if(isRoundel){fit.shared=false;fit.sharedGroup='';if(id==='roundel-copy')fit.wrap=true;else {fit.wrap=false;fit.maxLines=1;}}
    // Content-height text must not silently crop legal copy. Preserve its old
    // frame's bottom/centre as an explicit initial anchor when no rule owns Y.
    const ownsY=(document.layoutRules||[]).some(r=>r.enabled&&(!r.when||matches(scopes,r.when))&&r.targets.some(t=>t.size===size&&t.targetId===id)&&(r.type==='distribute'||r.axis==='y'||r.values?.top!==undefined));
    if(isLegal&&!fit.anchor&&!ownsY&&Number.isFinite(Number(target.values.height))){const align=target.values.alignItems;if(['flex-end','end','center'].includes(align)){const fraction=align==='center'?.5:1;fit.anchor={edge:fraction===1?'end':'center',position:Number(target.values.top||0)+Number(target.values.height)*fraction,referenceHeight:creative.canvas.height};}}
    const key=JSON.stringify({fit,values});let g=groups.get(key);if(!g){g={fit,values,states:[]};groups.set(key,g);}g.states.push(scopes);
   }
   for(const g of groups.values()){
    const allowed=new Set(g.states.map(s=>s.join('.'))),cubes=[];
    for(const state of g.states){let cube=[...state];for(const token of state){const candidate=cube.filter(t=>t!==token);if(states.filter(s=>matches(s,candidate)).every(s=>allowed.has(s.join('.'))))cube=candidate;}if(!cubes.some(c=>matches(cube,c)))cubes.push(cube);}
    for(const cube of cubes.filter((c,i)=>!cubes.some((other,j)=>j!==i&&other.length<c.length&&matches(c,other)))){
     output.localOverrides ||= [];output.localOverrides.push({targetId:id,scope:cube.join('.'),values:g.values,fit:g.fit});
    }
   }
  }
 }
 for(const definition of next.sharedDefinitions||[]){delete definition.fit;for(const v of Object.values(definition.perSize||{}))delete v.fit;}
 next.campaign={...next.campaign,textFitVersion:2};return {document:next,report};
}
