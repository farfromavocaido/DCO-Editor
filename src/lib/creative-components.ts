// @ts-nocheck
import { effectiveTextFitForTarget } from './text-fit-rules';
import {materializeCreativeOwnership} from './creative-ownership';
import { findCreativeTarget,findMaterializedCreativeTarget } from './creative-model';
import { getTargetCanvasBounds } from './canvas-alignment';
import { campaignVariantModel, campaignConditionIsValid } from './campaign-variants';

export type CreativeComponent = {
  id: string; name: string; parts: {role:string;targetId:string}[];
  frameTargetId?:string; resize:'proportional'|'frame'; stateDimensions?:string[];
  perSize?:Record<string, Partial<CreativeComponent>>;
};
// Read-only compatibility metadata. Transfer below has no campaign-specific rules.
const legacyDefinitions: CreativeComponent[] = [
  {id:'component:roundel',name:'Roundel',parts:[{role:'frame',targetId:'roundel-frame'},{role:'copy',targetId:'roundel-copy'},{role:'value',targetId:'roundel-value'}],frameTargetId:'roundel-frame',resize:'proportional',stateDimensions:['roundelMode']},
  {id:'component:cta',name:'CTA',parts:[{role:'button',targetId:'cta'}],frameTargetId:'cta',resize:'frame',stateDimensions:[]},
];
const definitions = document => document?.componentDefinitions ?? (document?.variantModel ? [] : legacyDefinitions);
export const creativeComponents = (document,size):CreativeComponent[] => definitions(document).map(def=>({...def,...def.perSize?.[size]})).filter(def=>def.parts.some(part=>findCreativeTarget(document,size,part.targetId)));
export const findCreativeComponent = (document,size,id) => creativeComponents(document,size).find(component=>component.id===id) || null;
export const componentForTarget = (document,size,targetId) => creativeComponents(document,size).find(component=>component.id===targetId || component.parts.some(part=>(part.targetId===targetId || String(targetId).startsWith(`${part.targetId}::`)))) || null;
export const componentBounds = (document,size,componentId,scopes:string[]=[]) => {
  const component=findCreativeComponent(document,size,componentId);
  if (!component) return null;
  if (component.frameTargetId) return getTargetCanvasBounds(document,size,component.frameTargetId,scopes);
  const boxes=component.parts.map(part=>getTargetCanvasBounds(document,size,part.targetId,scopes)).filter(Boolean);
  if (!boxes.length) return null;
  const left=Math.min(...boxes.map(box=>box.left)),top=Math.min(...boxes.map(box=>box.top));
  return {left,top,width:Math.max(...boxes.map(box=>box.left+box.width))-left,height:Math.max(...boxes.map(box=>box.top+box.height))-top};
};
export const validateCreativeComponents = document => {
  if (document.componentDefinitions!==undefined && !Array.isArray(document.componentDefinitions)) throw new Error('componentDefinitions must be an array');
  const ids=new Set();
  for (const component of document.componentDefinitions || []) {
    if (!/^component:[\w-]+$/.test(component.id) || ids.has(component.id) || !component.name) throw new Error('Components require unique component: IDs and names');
    ids.add(component.id);
    if (!['proportional','frame'].includes(component.resize)) throw new Error('Invalid component resize policy');
    if ((component.stateDimensions||[]).some(id=>!campaignVariantModel(document).dimensions.some(d=>d.id===id))) throw new Error('Unknown component state dimension');
    for (const size of Object.keys(document.sizes)) {
      const resolved={...component,...component.perSize?.[size]};
      if (!Array.isArray(resolved.parts)||!resolved.parts.length) throw new Error('Components require parts');
      const roles=new Set(),targets=new Set();
      for (const part of resolved.parts) {
        if (!part.role || roles.has(part.role)||targets.has(part.targetId)||!/^[\w-]+(?:::[\w-]+)?$/.test(part.targetId)) throw new Error('Component parts require unique roles and target IDs');
        roles.add(part.role);targets.add(part.targetId);
      }
      if (resolved.frameTargetId&&!targets.has(resolved.frameTargetId)) throw new Error('Component frame must be a part');
      const found=resolved.parts.filter(part=>findCreativeTarget(document,size,part.targetId));
      if(found.length && found.length!==resolved.parts.length) throw new Error(`Incomplete component ${component.id} in ${size}`);
    }
  }
};
const tokens = scope => String(scope||'').split('.').filter(Boolean);
const excluded = new Set(['cssClass','id','binding','visibility','opacity','animation','transform']);
const pixelFields = new Set(['fontSize','letterSpacing','padding','paddingLeft','paddingRight','paddingTop','paddingBottom','borderWidth','borderRadius','textIndent','gap']);
const scaledPixel = (value,scale) => typeof value==='number' ? value*scale : typeof value==='string' && /^-?\d+(\.\d+)?px$/.test(value) ? `${parseFloat(value)*scale}px` : value;
const cleanValues = values => Object.fromEntries(Object.entries(values).filter(([key])=>!excluded.has(key) && !(key==='display'&&values[key]==='none')));
const localWrite = (document,size,targetId,scopes,values,fit) => {
  const creative=document.sizes[size],scope=[...new Set(scopes)].sort().join('.');
  creative.localOverrides ||= [];
  // The new complete bundle should win over pre-existing, more-specific locals
  // only in this concrete destination state.
  creative.localOverrides=creative.localOverrides.filter(local=>!(local.targetId===targetId && local.scope===scope && !local.detached));
  creative.localOverrides.push({targetId,scope,values,fit});
};

/** Copy every declared internal arrangement into selected destination versions. */
export const transferCreativeComponent = (document,{componentId,sourceSize,sourceScopes=[],destinations=[],sizing='destination',placements={},preserveLinks=false,geometryOnly=false}) => {
  const source=findCreativeComponent(document,sourceSize,componentId);
  if (!source) throw new Error('Unknown source component');
  if (!['destination','source'].includes(sizing)) throw new Error('Invalid component sizing');
  const sourceMember=normalizedMember(document,componentId,{size:sourceSize,scope:sourceScopes.join('.')});
  destinations=destinations.filter(member=>placements[`${member.size}/${member.scope}`] || member.size!==sourceSize || normalizedMember(document,componentId,member).scope!==sourceMember.scope);
  const dimensions=campaignVariantModel(document).dimensions.filter(d=>(source.stateDimensions||[]).includes(d.id));
  const stateTokens=new Set(dimensions.flatMap(d=>d.options.map(o=>o.scope)));
  let states=[[]];
  for(const dimension of dimensions) states=states.flatMap(state=>dimension.options.map(option=>[...state,option.scope]));
  const next=structuredClone(document);
  const fast=geometryOnly&&source.frameTargetId&&source.parts.every(p=>!p.targetId.includes('::'))&&destinations.every(m=>source.parts.every(p=>document.sizes[m.size]?.layers.some(l=>l.id===p.targetId)));
  const compiled=fast?materializeCreativeOwnership(document):null;
  const read=(size,id,scopes)=>fast?findMaterializedCreativeTarget(compiled,size,id,scopes):findCreativeTarget(document,size,id,scopes);
  const bounds=(size,id,scopes)=>fast?getTargetCanvasBounds(compiled,size,id,scopes,findMaterializedCreativeTarget):getTargetCanvasBounds(document,size,id,scopes);
  if(!preserveLinks)replaceComponentDestinations(next,componentId,destinations);
  for(const destination of destinations) {
    if(!next.sizes[destination.size]) throw new Error(`Unknown destination size ${destination.size}`);
    const declared=definitions(document).find(def=>def.id===componentId);
    const target={...declared,...declared.perSize?.[destination.size]};
    const existing=target.parts.filter(part=>findCreativeTarget(next,destination.size,part.targetId));
    if(existing.length && existing.length!==target.parts.length) throw new Error('Cannot transfer into an incomplete component');
    if(!existing.length) {
      // A complete missing instance can be inserted without changing other layers.
      for(const part of target.parts) {
        const sourcePart=source.parts.find(item=>item.role===part.role);
        const layer=document.sizes[sourceSize].layers.find(layer=>layer.id===sourcePart?.targetId);
        if(!layer || part.targetId.includes('::')) throw new Error('Inserting nested component parts is unsupported');
        const copy=structuredClone(layer);copy.id=part.targetId;copy.base.display='none';copy.insertedComponentId=componentId;
        if(copy.base.cssClass===layer.id)copy.base.cssClass=part.targetId;
        next.sizes[destination.size].layers.push(copy);

      }
    }
    for(const state of states) {
      const from=[...sourceScopes.filter(scope=>!stateTokens.has(scope)),...state];
      const to=[...tokens(destination.scope).filter(scope=>!stateTokens.has(scope)),...state];
      if(!campaignConditionIsValid(document,from)||!campaignConditionIsValid(document,to))continue;
      if(sourceSize===destination.size && from.slice().sort().join('.')===to.slice().sort().join('.') && !placements[`${destination.size}/${destination.scope}`])continue;
      const sourceBox=fast?bounds(sourceSize,source.frameTargetId,from):componentBounds(document,sourceSize,componentId,from);
      const destinationBox=fast?bounds(destination.size,target.frameTargetId,to):existing.length?(componentBounds(document,destination.size,componentId,to)||componentBounds(next,destination.size,componentId,to)):sourceBox;
      const supplied=placements[`${destination.size}/${destination.scope}`];
      const frame=supplied||destinationBox;
      if(!sourceBox||!frame||!(frame.width>0&&frame.height>0))throw new Error('Component needs valid frame bounds');
      let sx=sizing==='source'?1:frame.width/sourceBox.width,sy=sizing==='source'?1:frame.height/sourceBox.height;
      if(source.resize==='proportional')sx=sy=Math.min(sx,sy);
      const uniform=source.resize==='frame'?1:Math.min(sx,sy);
      const left=frame.left+(frame.width-sourceBox.width*sx)/2,top=frame.top+(frame.height-sourceBox.height*sy)/2;
      for(const part of [...source.parts].sort((a,b)=>a.targetId.split('::').length-b.targetId.split('::').length)) {
        const destinationPart=target.parts.find(item=>item.role===part.role);
        if(!destinationPart)throw new Error(`Missing component role ${part.role}`);
        const original=read(sourceSize,part.targetId,from);
        const box=bounds(sourceSize,part.targetId,from);
        const destinationTarget=fast?read(destination.size,destinationPart.targetId,to):findCreativeTarget(next,destination.size,destinationPart.targetId,to);
        const destinationBounds=fast?bounds(destination.size,destinationPart.targetId,to):getTargetCanvasBounds(next,destination.size,destinationPart.targetId,to);
        const values=cleanValues(original.values);
        if(geometryOnly)for(const key of Object.keys(values))if(!['left','top','width','height','fontSize','fontFamily','fontWeight','fontStyle','textTransform','lineHeight','letterSpacing','textAlign','alignItems','justifyContent','display','whiteSpace',...pixelFields].includes(key))delete values[key];
        if(destinationTarget.values?.display==='none')delete values.display;
        if(!existing.length || destinationTarget.layer?.insertedComponentId===componentId) {
          values.display=original.values.display||'block';
          for(const field of ['visibility','opacity'])if(original.values[field]!==undefined)values[field]=original.values[field];
        }
        for(const key of pixelFields)if(values[key]!==undefined)values[key]=scaledPixel(values[key],uniform);
        if(typeof values.lineHeight==='string'&&values.lineHeight.endsWith('px'))values.lineHeight=scaledPixel(values.lineHeight,uniform);
        const originX=destinationTarget.coordinateScope==='group'?destinationBounds.left-destinationBounds.localLeft:0;
        const originY=destinationTarget.coordinateScope==='group'?destinationBounds.top-destinationBounds.localTop:0;
        values.left=left+(box.left-sourceBox.left)*sx-originX;
        // Preserve the authored top relative to fit-budget chrome's top.
        values.top=top+(box.top-sourceBox.top)*sy-originY + ((Number(original.values.top)||0)-(box.localTop??box.top))*sy;
        values.width=box.width*sx;
        values.height=original.values.height!==undefined&&original.values.height!==''&&original.values.height!==null&&original.values.height!=='auto'?box.height*sy:'auto';
        const effective=effectiveTextFitForTarget(compiled||document,sourceSize,part.targetId,from,Boolean(compiled));
        const fit={...structuredClone(original.fit||{}),
          disabled:effective.disabled===true || !Object.keys(effective).length,
          mode:original.fit?.mode || (effective.static || (effective.allowShrink===false?'wrap':'shrink')),
          wrap:effective.wrap??false,allowShrink:effective.allowShrink??(Object.keys(effective).length>0),shared:effective.shared??false,
          static:effective.static??false,maxLines:effective.maxLines??0,minFontSize:effective.minFontSize??0,
          maxFontSize:original.fit?.maxFontSize??0,minFontSizeRatio:effective.minFontSizeRatio??0,tracking:structuredClone(effective.tracking||{minEm:0}),
          align:effective.align||'normal',sharedGroup:effective.sharedGroup||'',frame:effective.frame||'',overflow:effective.overflow||'clip',
        };
        if(fit.anchor)fit.anchor={...fit.anchor,position:top+(fit.anchor.position-sourceBox.top)*sy,referenceHeight:document.sizes[destination.size].canvas.height};
        for(const key of ['minFontSize','maxFontSize'])if(fit[key]!==undefined)fit[key]=scaledPixel(fit[key],uniform);
        localWrite(next,destination.size,destinationPart.targetId,to,values,['shape','image','gradient','blur','group'].includes(original.kind)?{}:fit);
      }
    }
  }
  return next;
};

const normalizedMember = (document,componentId,member) => {
  const definition=definitions(document).find(def=>def.id===componentId);
  const stateTokens=new Set(campaignVariantModel(document).dimensions.filter(d=>definition?.stateDimensions?.includes(d.id)).flatMap(d=>d.options.map(o=>o.scope)));
  return {size:member.size,scope:tokens(member.scope).filter(scope=>!stateTokens.has(scope)).sort().join('.')};
};
const memberMatches = (member,size,scopes) => member.size===size && tokens(member.scope).every(token=>scopes.includes(token));
const overlaps = (document,a,b) => a.size===b.size && !campaignVariantModel(document).dimensions.some(d=>d.options.some(o=>tokens(a.scope).includes(o.scope)) && d.options.some(o=>tokens(b.scope).includes(o.scope)) && !d.options.some(o=>tokens(a.scope).includes(o.scope)&&tokens(b.scope).includes(o.scope)));
/** Subtract selected concrete versions, preserving the remainder of broad memberships. */
function replaceComponentDestinations(document,componentId,destinations) {
  if(!document.componentLinks?.length)return;
  const families=campaignVariantModel(document).dimensions.map(d=>d.options.map(option=>option.scope));
  for(const raw of destinations) {
    const destination=normalizedMember(document,componentId,raw);
    document.componentLinks=(document.componentLinks||[]).flatMap(link=>{
      if(link.componentId!==componentId)return [link];
      const members=link.destinations.flatMap(member=>{
        if(!overlaps(document,member,destination))return [member];
        const prefix=tokens(member.scope),residuals=[];
        for(const token of tokens(destination.scope)) {
          if(prefix.includes(token))continue;
          const family=families.find(family=>family.includes(token));
          if(!family)throw new Error(`Unknown component destination condition ${token}`);
          for(const other of family.filter(value=>value!==token))residuals.push({size:member.size,scope:[...prefix,other].sort().join('.')});
          prefix.push(token);
        }
        return residuals;
      });
      return members.length?[{...link,destinations:members}]:[];
    });
  }
}
export const validateComponentLinks = document => {
  const links=document.componentLinks||[],ids=new Set();
  if(!Array.isArray(links))throw new Error('componentLinks must be an array');
  for(const link of links) {
    if(!link.id||ids.has(link.id)||!link.name||!Array.isArray(link.destinations)||!link.destinations.length)throw new Error('Component links require unique IDs, names, and destinations');
    ids.add(link.id);
    if(!findCreativeComponent({...document,componentLinks:[]},link.source?.size,link.componentId))throw new Error('Unknown component link source');
    if(!['source','destination'].includes(link.sizing))throw new Error('Invalid component link sizing');
    for(const destination of link.destinations) {
      if(!document.sizes[destination.size])throw new Error('Unknown component link destination');
      if(overlaps(document,link.source,destination))throw new Error('A component cannot link to itself');
      for(const other of links)if(other.componentId===link.componentId) {
        if(other!==link && other.destinations.some(member=>overlaps(document,member,destination)))throw new Error('Component link destinations overlap');
        if(overlaps(document,other.source,destination))throw new Error('Component link chains and cycles are not supported');
      }
    }
    if(link.destinations.some((member,index)=>link.destinations.slice(index+1).some(other=>overlaps(document,member,other))))throw new Error('Component link destinations overlap');
  }
};
export const componentLinkForTarget = (document,size,targetId,scopes=[]) => {
  const component=componentForTarget({...document,componentLinks:[]},size,targetId);
  return component && (document.componentLinks||[]).find(link=>link.componentId===component.id && link.destinations.some(member=>memberMatches(member,size,scopes))) || null;
};
const componentMaterializations = new WeakMap();
export const materializeComponentLinks = document => {
  if(!document?.componentLinks?.length)return document;
  const signature=JSON.stringify(document);
  const cached=componentMaterializations.get(document);
  if(cached?.signature===signature)return cached.value;
  validateComponentLinks(document);
  let next={...document,componentLinks:[]};
  for(const link of document.componentLinks)next=transferCreativeComponent(next,{componentId:link.componentId,sourceSize:link.source.size,sourceScopes:tokens(link.source.scope),destinations:link.destinations,sizing:link.sizing,placements:link.placements||{},geometryOnly:link.geometryOnly===true});
  componentMaterializations.set(document,{signature,value:next});
  return next;
};
export const createComponentLink = (document,link) => {
  let next=structuredClone(document);
  const normalized={...structuredClone(link),source:normalizedMember(document,link.componentId,link.source),destinations:link.destinations.map(member=>normalizedMember(document,link.componentId,member))};
  if(link.placements)normalized.placements=Object.fromEntries(link.destinations.flatMap((member,index)=>link.placements[`${member.size}/${member.scope}`]?[[`${normalized.destinations[index].size}/${normalized.destinations[index].scope}`,link.placements[`${member.size}/${member.scope}`]]]:[]));
  if(link.sizing==='source' || (link.placements && Object.keys(link.placements).length) || link.destinations.some(member=>!findCreativeComponent({...next,componentLinks:[]},member.size,link.componentId))) {
    const previousLinks=next.componentLinks;
    next=transferCreativeComponent({...next,componentLinks:[]},{componentId:link.componentId,sourceSize:link.source.size,sourceScopes:tokens(link.source.scope),destinations:link.destinations,sizing:link.sizing,placements:link.placements,geometryOnly:link.geometryOnly===true});
    next.componentLinks=previousLinks;
  }
  // Source size is an initial placement choice; linked destination bounds remain editable.
  normalized.sizing='destination';
  delete normalized.placements;
  replaceComponentDestinations(next,link.componentId,normalized.destinations);
  next.componentLinks=[...(next.componentLinks||[]),normalized];
  validateComponentLinks(next);
  return next;
};
export const unlinkComponent = (document,linkId,destination) => {
  const link=document.componentLinks?.find(item=>item.id===linkId);
  if(!link)throw new Error('Unknown component link');
  const normalized=destination?normalizedMember(document,link.componentId,destination):null;
  const selected=link.destinations.filter(member=>!normalized||(member.size===normalized.size&&member.scope===normalized.scope));
  if(!selected.length)throw new Error('Unknown component link destination');
  const stripped={...document,componentLinks:[]};
  const next=transferCreativeComponent(stripped,{componentId:link.componentId,sourceSize:link.source.size,sourceScopes:tokens(link.source.scope),destinations:selected,sizing:link.sizing,placements:link.placements||{},geometryOnly:link.geometryOnly===true});
  next.componentLinks=document.componentLinks.flatMap(item=>item.id!==linkId?[structuredClone(item)]:item.destinations.length===selected.length?[]:[{...structuredClone(item),destinations:item.destinations.filter(member=>!selected.includes(member))}]);
  return next;
};

/** Transform the semantic unit, including every hidden internal arrangement. */
export const updateComponentBounds = (document,size,componentId,scopes,bounds) => {
  const scope=[...new Set(scopes)].sort().join('.');
  return transferCreativeComponent(document,{componentId,sourceSize:size,sourceScopes:scopes,destinations:[{size,scope}],sizing:'destination',preserveLinks:true,placements:{[`${size}/${scope}`]:bounds}});
};
export const moveCreativeComponent = updateComponentBounds;

/** Source edits belong to the shared design's scope, not an incidental feed row. */
export function componentSourceLinks(document,size,targetId,scopes=[]){
 if(!document?.componentLinks?.length)return [];
 const component=componentForTarget({...document,componentLinks:[]},size,targetId);
 return component?document.componentLinks.filter(link=>link.componentId===component.id&&memberMatches(link.source,size,scopes)):[];
}
export function editComponentSourceField(document,size,targetId,scopes,domain,field,value){
 const link=componentSourceLinks(document,size,targetId,scopes).find(l=>l.geometryOnly);if(!link)return null;
 if(domain==='values'&&!['left','top','width','height','fontSize','fontFamily','fontWeight','fontStyle','textTransform','lineHeight','letterSpacing','textAlign','alignItems','justifyContent','display','whiteSpace',...pixelFields].includes(field))return null;
 const component=findCreativeComponent({...document,componentLinks:[]},size,link.componentId),stateTokens=new Set(campaignVariantModel(document).dimensions.filter(d=>component.stateDimensions?.includes(d.id)).flatMap(d=>d.options.map(o=>o.scope)));
 const scope=[...new Set([...tokens(link.source.scope),...scopes.filter(s=>stateTokens.has(s))])].sort().join('.');
 const next=structuredClone(document),locals=next.sizes[size].localOverrides||=[];
 let entry=locals.find(l=>l.componentSource===link.id&&l.targetId===targetId&&l.scope===scope);
 if(!entry){entry={targetId,scope,detached:true,componentSource:link.id,values:{},fit:{}};locals.unshift(entry);}
 entry[domain][field]=value;return next;
}
