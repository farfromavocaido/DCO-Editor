// @ts-nocheck
import { activeScopesFromControls, controlsFromFeedRow } from './feed-model';

export type CampaignDimension = { id: string; label: string; field: string; defaultValue: string | number | boolean; options: {value: string | number | boolean; label: string; scope: string; tip?: string}[]; header?: boolean; enabledWhen?: CampaignCondition[]; derived?: boolean; rules?: {when: CampaignCondition[]; value: string | number | boolean}[] };
export type CampaignCondition = {field: string; operator: 'eq' | 'neq' | 'present' | 'absent'; value?: string | number | boolean};
/** Declarative field tests are shared with the exported browser runtime. */
export function evaluateConditions(row, conditions = []) {
  return conditions.every(test => {
    const value = row[test.field];
    const present = value !== undefined && value !== null && String(value).trim() !== '';
    if (test.operator === 'present') return present;
    if (test.operator === 'absent') return !present;
    if (test.operator === 'eq') return value === test.value;
    if (test.operator === 'neq') return value !== test.value;
    return false;
  });
}
export function resolveCampaignState(model, source = {}) {
  const row = {...source};
  const done = new Set(), visiting = new Set();
  function resolve(d) {
    if (done.has(d.id)) return;
    if (visiting.has(d.id)) throw new Error('Derived campaign states contain a cycle');
    visiting.add(d.id);
    if (d.derived && d.rules) {
      for (const rule of d.rules) for (const test of rule.when) {
        const dependency = model.dimensions.find(other => other.field === test.field);
        if (dependency) resolve(dependency);
      }
      row[d.field] = d.rules.find(rule => evaluateConditions(row, rule.when))?.value ?? d.defaultValue;
    } else if (row[d.field] == null) row[d.field] = d.defaultValue;
    visiting.delete(d.id); done.add(d.id);
  }
  model.dimensions.forEach(resolve);
  for(const constraint of model.constraints||[])if(evaluateConditions(row,constraint.when)&&!evaluateConditions(row,constraint.require))throw new Error(constraint.message||'This campaign state is not allowed');
  return row;
}
export const evaluateCampaignConditions = (document, row, conditions) => evaluateConditions(resolveCampaignRow(document,row), conditions);
export const campaignStateRuntimeSource = () => `var evaluateConditions = ${evaluateConditions.toString()}; var resolveCampaignState = ${resolveCampaignState.toString()};`;
const dimension = (id, label, field, defaultValue, options, extra = {}) => ({id, label, field, defaultValue, options: options.map(([value,label,scope]) => ({value,label,scope})), ...extra});
const legacy = { dimensions: [
  dimension('offerCount','Offers','offer_count_num',1,[0,1,2,3].map(n=>[n,String(n),`offers-${n}`])),
  dimension('tcMode','T&Cs','tc_type_enum','tcs_only',[['tcs_only','Solo','tc-solo'],['tcs_units','Prices','tc-prices']]),
  dimension('ctaShape','CTA','cta_type_enum','roundel',[['roundel','Round','cta-roundel'],['rectangle','Rect','cta-rect']]),
  dimension('includeRoundelFrame','Frame','include_roundel_frame_bool',false,[[false,'3 Acts','roundel-frame-off'],[true,'Offer roundel','roundel-frame-on']]),
  dimension('frameCount','Frames','include_roundel_frame_bool',false,[[false,'3 frames','frames-3'],[true,'4 frames','frames-4']],{derived:true,header:false}),
  dimension('roundelMode','Roundel copy','roundel_value_text','',[['','Text only','roundel-copy-only'],['value','Text + number','roundel-split']],{derived:true,header:false}),
  dimension('navyHeadlines','Ink','navy_headlines_bool',false,[[false,'White','white-headlines'],[true,'Navy','navy-headlines']]),
] };
export const isGenericCampaign = document => Boolean(document?.variantModel);
export const campaignVariantModel = document => document?.variantModel || (document?.campaignState ? {...legacy,...document.campaignState,dimensions:legacy.dimensions.map(d=>({...d,...document.campaignState.dimensions?.find(config=>config.id===d.id)}))} : legacy);
export const resolveCampaignRow = (document, row = {}) => isGenericCampaign(document) ? resolveCampaignState(campaignVariantModel(document),row) : document?.campaignState ? {...Object.fromEntries(campaignVariantModel(document).dimensions.filter(d=>!d.derived).map(d=>[d.field,d.defaultValue])),...row} : row;
export const campaignConditionFamilies = document => campaignVariantModel(document).dimensions.map(d=>d.options.map(o=>o.scope));
export const campaignScopes = (document, row = {}) => isGenericCampaign(document)
  ? (()=>{const model=campaignVariantModel(document), resolved=resolveCampaignState(model,row);return model.dimensions.filter(d=>evaluateConditions(resolved,d.enabledWhen)).map(d=>(d.options.find(o=>o.value === resolved[d.field]) || d.options.find(o=>o.value === d.defaultValue)).scope);})()
  : activeScopesFromControls(controlsFromFeedRow(resolveCampaignRow(document,row)));
export const campaignVersionLabel = (document, row = {}) => {
  const scopes = campaignScopes(document,row);
  return campaignVariantModel(document).dimensions.filter(d=>!d.derived && d.header !== false).map(d=>d.options.find(o=>scopes.includes(o.scope))?.label).filter(Boolean).join(' · ');
};
export const campaignRowForScopes = (document, baseRow = {}, scopes = []) => {
  const row = {...resolveCampaignRow(document,baseRow)};
  for (const d of campaignVariantModel(document).dimensions) {
    const option = d.options.find(o=>scopes.includes(o.scope));
    if (option && (!isGenericCampaign(document) || !d.derived)) row[d.field] = option.value;
  }
  if (!isGenericCampaign(document) && scopes.includes('roundel-split')) row.roundel_value_text = baseRow.roundel_value_text || 'Value';
  if (!campaignConditionIsValid(document, campaignScopes(document, row))) throw new Error('This combination of campaign variables is not allowed');
  assertCampaignStateValid(document,row);
  return isGenericCampaign(document) ? resolveCampaignState(campaignVariantModel(document),row) : row;
};
export const validateCampaignVariantModel = document => {
  if (!isGenericCampaign(document) && !document.campaignState) return;
  const model = campaignVariantModel(document);
  // These identifiers belong to the legacy renderer's synthetic DOM contract.
  // Reject collisions instead of silently changing a generic layer's meaning.
  const legacyIdentity = /^(?:headline-act.*|bg-image|offer-slot-.*|offer\d+|offer-value|offer-subline|terms-solo|terms-prices|unit-rate-prices|cta|roundel-frame|roundel-copy|roundel-value|TC_Solo|sse-headline|sse-text|sse-bottom-line)$/;
  for (const creative of Object.values(document.sizes || {})) {
    for (const layer of creative.layers || []) {
      if (isGenericCampaign(document) && (legacyIdentity.test(String(layer.id)) || legacyIdentity.test(String(layer.base?.cssClass || '')))) throw new Error(`Generic layer ${layer.id} uses a reserved legacy layer ID or CSS class; choose a campaign-specific name`);
    }
  }

  if (!Array.isArray(model.dimensions)) throw new Error('variantModel requires dimensions');
  const ids = new Set(), fields = new Set(), scopes = new Set();
  for (const d of model.dimensions) {
    if (isGenericCampaign(document) && d.derived && !Array.isArray(d.rules)) throw new Error('Generic derived dimensions require declarative rules');
    if (!/^[a-zA-Z][\w-]*$/.test(d.id) || ids.has(d.id)) throw new Error('Variant dimension id must be unique and valid');
    if (!d.label || typeof d.field !== 'string' || !d.field || (isGenericCampaign(document) && fields.has(d.field))) throw new Error('Variant dimensions require a label and unique feed field');
    ids.add(d.id); fields.add(d.field);
    if (!Array.isArray(d.options) || !d.options.length) throw new Error(`Variant ${d.id} requires options`);
    const values = new Set();
    for (const o of d.options) {
      if (!['string','number','boolean'].includes(typeof o.value) || values.has(o.value) || !o.label || !/^[a-zA-Z][\w-]*$/.test(o.scope) || scopes.has(o.scope)) throw new Error(`Invalid option in variant ${d.id}`);
      values.add(o.value); scopes.add(o.scope);
    }
    if (!values.has(d.defaultValue)) throw new Error(`Variant ${d.id} default must name an option`);
    validateConditions(d.enabledWhen);
    for (const rule of d.rules || []) {validateConditions(rule.when); if (!values.has(rule.value)) throw new Error('Derived rule must select an existing option');}
    if (d.header !== undefined && typeof d.header !== 'boolean') throw new Error('Variant header must be boolean');
  }
  resolveCampaignState(isGenericCampaign(document)?model:{dimensions:[]},{});
  for(const constraint of model.constraints || []) {validateConditions(constraint.when);validateConditions(constraint.require);if(!constraint.message?.trim()) throw new Error('Constraint needs a message');}
  if (!isGenericCampaign(document)) {
    for(const config of document.campaignState.dimensions || []) {const original=legacy.dimensions.find(d=>d.id===config.id);if(!original || config.field!==original.field || Boolean(config.derived)!==Boolean(original.derived) || config.rules!==undefined || JSON.stringify(config.options.map(o=>[o.value,o.scope]))!==JSON.stringify(original.options.map(o=>[o.value,o.scope]))) throw new Error('SSE state mappings must retain their existing fields, values and scopes');}
  }
  if (model.validConditions !== undefined) {
    if (!Array.isArray(model.validConditions)) throw new Error('validConditions must be an array');
    for (const condition of model.validConditions) {
      if (!Array.isArray(condition) || condition.some(s=>!scopes.has(s)) || campaignConditionFamilies(document).some(f=>condition.filter(s=>f.includes(s)).length > 1)) throw new Error('Invalid variant condition');
    }
  }
  for (const row of document.feed?.sampleRows || []) {
    assertCampaignStateValid(document,row);
    if (!campaignConditionIsValid(document, campaignScopes(document, row))) throw new Error('Feed row uses an invalid campaign condition');
  }
  for (const row of document.feed?.sampleRows || []) for (const d of model.dimensions) {
    if (isGenericCampaign(document) && !d.derived && row[d.field] !== undefined && !d.options.some(o=>o.value === row[d.field])) throw new Error(`Invalid value for variant field ${d.field}`);
  }
};

/** Shared presentation order includes hidden dimensions so toggling visibility cannot reorder. */
export const campaignHeaderOrder = document => {
  const model = campaignVariantModel(document);
  const fallback = isGenericCampaign(document) ? model.dimensions.map(d=>d.id) : ['offerCount','tcMode','navyHeadlines','ctaShape','includeRoundelFrame'];
  return [...new Set([...(document?.variantPresentation?.order || fallback), ...model.dimensions.map(d=>d.id)])].filter(id=>model.dimensions.some(d=>d.id===id && !d.derived));
};
export const campaignHeaderDimensions = (document, row = {}) => {
  const model = campaignVariantModel(document);
  const presentation = document?.variantPresentation || {};
  const order = campaignHeaderOrder(document);
  const tips = {navyHeadlines:['White photo-act headlines (default); T&Cs stay white','Navy photo-act headlines; T&Cs stay white'],offerCount:['No offers (brand / awareness)','Single offer','Dual offers','Triple offers'],tcMode:['T&Cs only','T&Cs with unit rates'],ctaShape:['Round CTA button','Rectangular CTA button'],includeRoundelFrame:['No offer roundel (headlines 1, 2, and 4)','Four headline acts with offer roundel frame']};
  return [...new Set(order)].map(id=>model.dimensions.find(d=>d.id===id)).filter(d=>d && !d.derived && evaluateCampaignConditions(document,row,d.enabledWhen) && (Object.hasOwn(presentation, 'hidden') ? !presentation.hidden.includes(d.id) : d.header!==false) && (isGenericCampaign(document)||d.id!=='navyHeadlines'||controlsFromFeedRow(row).offerCount===0)).map(d=>isGenericCampaign(document)?d:{...d,options:d.options.map((o,i)=>({...o,tip:tips[d.id]?.[i]})).filter(o=>d.id!=='offerCount'||o.value!==0||!document?.campaign?.id||document.campaign.id==='sse-dco')});
};
export const campaignConditionIsValid = (document, scopes) => {
  const conditions = campaignVariantModel(document).validConditions;
  return !conditions?.length || conditions.some(condition=>condition.every(scope=>scopes.includes(scope)));
};

function validateConditions(conditions) {
  if (conditions === undefined) return;
  if (!Array.isArray(conditions) || conditions.some(c=>!c || typeof c.field!=='string' || !c.field.trim() || !['eq','neq','present','absent'].includes(c.operator) || (['eq','neq'].includes(c.operator) && !['string','number','boolean'].includes(typeof c.value)))) throw new Error('Invalid campaign field condition');
}
export function assertCampaignStateValid(document, row) {
  const resolved = isGenericCampaign(document) ? resolveCampaignState(campaignVariantModel(document),row) : row;
  for (const constraint of campaignVariantModel(document).constraints || []) if(evaluateConditions(resolved,constraint.when) && !evaluateConditions(resolved,constraint.require)) throw new Error(constraint.message || 'Campaign state is not allowed');
}
/** Refuse configuration edits that would strand authored scope or feed references. */
export function validateCampaignStateEdit(previous, next) {
  validateCampaignVariantModel(next);
  const oldModel=campaignVariantModel(previous), model=campaignVariantModel(next);
  const scopes=new Set(model.dimensions.flatMap(d=>d.options.map(o=>o.scope)));
  const fields=new Set(model.dimensions.map(d=>d.field));
  const removed=new Set(oldModel.dimensions.flatMap(d=>d.options.map(o=>o.scope)).filter(s=>!scopes.has(s)));
  const removedFields=new Set(oldModel.dimensions.map(d=>d.field).filter(f=>!fields.has(f)));
  const authored={sizes:next.sizes,sharedDefinitions:next.sharedDefinitions,canvasGroups:next.canvasGroups,componentDefinitions:next.componentDefinitions,componentLinks:next.componentLinks,layoutRules:next.layoutRules,feed:next.feed,constraints:model.constraints,rules:model.dimensions.flatMap(d=>[...(d.rules||[]),...(d.enabledWhen||[])])};
  function visit(value) {
    if(typeof value==='string' && (value.split('.').some(token=>removed.has(token))||removedFields.has(value))) throw new Error(`“${value}” is still used by campaign artwork or feed data`);
    if(value && typeof value==='object') for(const [key,item] of Object.entries(value)) {if(key.split('.').some(token=>removed.has(token))||removedFields.has(key)) throw new Error(`“${key}” is still used by campaign artwork or feed data`);visit(item);}
  }
  visit(authored);
}
