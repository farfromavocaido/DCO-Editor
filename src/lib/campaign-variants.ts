// @ts-nocheck
import { activeScopesFromControls, controlsFromFeedRow } from './feed-model';

export type CampaignDimension = { id: string; label: string; field: string; defaultValue: string | number | boolean; options: {value: string | number | boolean; label: string; scope: string; tip?: string}[]; header?: boolean; derived?: boolean };
const dimension = (id, label, field, defaultValue, options, extra = {}) => ({id, label, field, defaultValue, options: options.map(([value,label,scope]) => ({value,label,scope})), ...extra});
const legacy = { dimensions: [
  dimension('offerCount','Offers','offer_count_num',1,[0,1,2,3].map(n=>[n,String(n),`offers-${n}`])),
  dimension('tcMode','T&Cs','tc_type_enum','tcs_only',[['tcs_only','Solo','tc-solo'],['tcs_units','Prices','tc-prices']]),
  dimension('ctaShape','CTA','cta_type_enum','roundel',[['roundel','Round','cta-roundel'],['rectangle','Rect','cta-rect']]),
  dimension('includeRoundelFrame','Frame','include_roundel_frame_bool',false,[[false,'3 Acts','roundel-frame-off'],[true,'Offer roundel','roundel-frame-on']]),
  dimension('frameCount','Frames','include_roundel_frame_bool',false,[[false,'3 frames','frames-3'],[true,'4 frames','frames-4']],{derived:true,header:false}),
  dimension('roundelMode','Roundel copy','roundel_value_text','',[['','Copy only','roundel-copy-only'],['value','Split','roundel-split']],{derived:true,header:false}),
  dimension('navyHeadlines','Ink','navy_headlines_bool',false,[[false,'White','white-headlines'],[true,'Navy','navy-headlines']]),
] };
export const isGenericCampaign = document => Boolean(document?.variantModel);
export const campaignVariantModel = document => document?.variantModel || legacy;
export const campaignConditionFamilies = document => campaignVariantModel(document).dimensions.map(d=>d.options.map(o=>o.scope));
export const campaignScopes = (document, row = {}) => isGenericCampaign(document)
  ? campaignVariantModel(document).dimensions.map(d=>(d.options.find(o=>o.value === (row[d.field] ?? d.defaultValue)) || d.options.find(o=>o.value === d.defaultValue)).scope)
  : activeScopesFromControls(controlsFromFeedRow(row));
export const campaignVersionLabel = (document, row = {}) => {
  const scopes = campaignScopes(document,row);
  return campaignVariantModel(document).dimensions.filter(d=>!d.derived && d.header !== false).map(d=>d.options.find(o=>scopes.includes(o.scope))?.label).filter(Boolean).join(' · ');
};
export const campaignRowForScopes = (document, baseRow = {}, scopes = []) => {
  const row = isGenericCampaign(document)
    ? { ...Object.fromEntries(campaignVariantModel(document).dimensions.map(d=>[d.field,d.defaultValue])), ...baseRow }
    : {...baseRow};
  for (const d of campaignVariantModel(document).dimensions) {
    const option = d.options.find(o=>scopes.includes(o.scope));
    if (option) row[d.field] = option.value;
  }
  if (!isGenericCampaign(document) && scopes.includes('roundel-split')) row.roundel_value_text = baseRow.roundel_value_text || 'Value';
  if (!campaignConditionIsValid(document, campaignScopes(document, row))) throw new Error('This combination of campaign variables is not allowed');
  return row;
};
export const validateCampaignVariantModel = document => {
  if (!isGenericCampaign(document)) return;
  const model = document.variantModel;
  // These identifiers belong to the legacy renderer's synthetic DOM contract.
  // Reject collisions instead of silently changing a generic layer's meaning.
  const legacyIdentity = /^(?:headline-act.*|bg-image|offer-slot-.*|offer\d+|offer-value|offer-subline|terms-solo|terms-prices|unit-rate-prices|cta|roundel-frame|roundel-copy|roundel-value|TC_Solo|sse-headline|sse-text|sse-bottom-line)$/;
  for (const creative of Object.values(document.sizes || {})) {
    for (const layer of creative.layers || []) {
      if (legacyIdentity.test(String(layer.id)) || legacyIdentity.test(String(layer.base?.cssClass || ''))) throw new Error(`Generic layer ${layer.id} uses a reserved legacy layer ID or CSS class; choose a campaign-specific name`);
    }
  }

  if (!Array.isArray(model.dimensions)) throw new Error('variantModel requires dimensions');
  const ids = new Set(), fields = new Set(), scopes = new Set();
  for (const d of model.dimensions) {
    if (d.derived) throw new Error('Generic derived dimensions are not supported; derived is reserved for the legacy adapter');
    if (!/^[a-zA-Z][\w-]*$/.test(d.id) || ids.has(d.id)) throw new Error('Variant dimension id must be unique and valid');
    if (!d.label || typeof d.field !== 'string' || !d.field || fields.has(d.field)) throw new Error('Variant dimensions require a label and unique feed field');
    ids.add(d.id); fields.add(d.field);
    if (!Array.isArray(d.options) || !d.options.length) throw new Error(`Variant ${d.id} requires options`);
    const values = new Set();
    for (const o of d.options) {
      if (!['string','number','boolean'].includes(typeof o.value) || values.has(o.value) || !o.label || !/^[a-zA-Z][\w-]*$/.test(o.scope) || scopes.has(o.scope)) throw new Error(`Invalid option in variant ${d.id}`);
      values.add(o.value); scopes.add(o.scope);
    }
    if (!values.has(d.defaultValue)) throw new Error(`Variant ${d.id} default must name an option`);
    if (d.header !== undefined && typeof d.header !== 'boolean') throw new Error('Variant header must be boolean');
  }
  if (model.validConditions !== undefined) {
    if (!Array.isArray(model.validConditions)) throw new Error('validConditions must be an array');
    for (const condition of model.validConditions) {
      if (!Array.isArray(condition) || condition.some(s=>!scopes.has(s)) || campaignConditionFamilies(document).some(f=>condition.filter(s=>f.includes(s)).length > 1)) throw new Error('Invalid variant condition');
    }
  }
  for (const row of document.feed?.sampleRows || []) {
    if (!campaignConditionIsValid(document, campaignScopes(document, row))) throw new Error('Feed row uses an invalid campaign condition');
  }
  for (const row of document.feed?.sampleRows || []) for (const d of model.dimensions) {
    if (row[d.field] !== undefined && !d.options.some(o=>o.value === row[d.field])) throw new Error(`Invalid value for variant field ${d.field}`);
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
  return [...new Set(order)].map(id=>model.dimensions.find(d=>d.id===id)).filter(d=>d && !d.derived && (Object.hasOwn(presentation, 'hidden') ? !presentation.hidden.includes(d.id) : d.header!==false) && (isGenericCampaign(document)||d.id!=='navyHeadlines'||controlsFromFeedRow(row).offerCount===0)).map(d=>isGenericCampaign(document)?d:{...d,options:d.options.map((o,i)=>({...o,tip:tips[d.id]?.[i]})).filter(o=>d.id!=='offerCount'||o.value!==0||!document?.campaign?.id||document.campaign.id==='sse-dco')});
};
export const campaignConditionIsValid = (document, scopes) => {
  const conditions = document?.variantModel?.validConditions;
  return !conditions?.length || conditions.some(condition=>condition.every(scope=>scopes.includes(scope)));
};
