// @ts-nocheck
import { test } from 'vitest';
import assert from 'node:assert/strict';
import demo from '../../campaign/product-demo-creative.json';
import sse from '../../campaign/sse-dco-creative.json';
import { campaignScopes, campaignConditionFamilies, campaignHeaderDimensions, campaignHeaderOrder, campaignRowForScopes, campaignVersionLabel, validateCampaignVariantModel, resolveCampaignRow, evaluateConditions, campaignStateRuntimeSource, validateCampaignStateEdit } from './campaign-variants';
import { controlsFromFeedRow, activeScopesFromControls } from './feed-model';
import { validateFeedRows } from '../server/feed-schema';
import { materializeCreativeOwnership } from './creative-ownership';

test('SSE adapter preserves every existing sample scope exactly', () => {
 for (const row of sse.feed.sampleRows) assert.deepEqual(campaignScopes(sse,row),activeScopesFromControls(controlsFromFeedRow(row)));
 assert.deepEqual(campaignHeaderDimensions(sse,{offer_count_num:0}).map(d=>d.id),['offerCount','tcMode','navyHeadlines','ctaShape','includeRoundelFrame']);
});
test('arbitrary campaign models derive conditions, defaults, labels and authored row fields',()=>{
 assert.deepEqual(campaignScopes(demo,{}),['product-lamp','language-en','theme-light']);
 assert.equal(campaignVersionLabel(demo,{product:'chair',language:'ga',theme:'dark'}),'Chair · Gaeilge · Dark');
 const other={variantModel:{dimensions:[{id:'audience',label:'Audience',field:'segment',defaultValue:4,options:[{value:4,label:'New',scope:'new-customer'},{value:9,label:'Returning',scope:'returning-customer'}]}]},feed:{fields:[],sampleRows:[]}};
 validateCampaignVariantModel(other);
 assert.deepEqual(campaignRowForScopes(other,{copy:'Keep this'},['returning-customer']),{copy:'Keep this',segment:9});
 assert.deepEqual(campaignConditionFamilies(other),[['new-customer','returning-customer']]);
 assert.deepEqual(validateFeedRows([{segment:9,copy:'Unlisted arbitrary copy'}],other),[{segment:9,copy:'Unlisted arbitrary copy'}]);
 assert.throws(()=>validateFeedRows([{segment:6}],other),/Invalid value/);
});
test('declarative valid conditions reject unavailable combinations; empty models work',()=>{
 const doc=structuredClone(demo);doc.variantModel.validConditions=[['product-lamp','language-en'],['product-chair']];doc.feed.sampleRows=[];
 validateCampaignVariantModel(doc);
 assert.throws(()=>campaignRowForScopes(doc,{product:'lamp',language:'en',theme:'dark'},['language-ga']),/not allowed/);
 assert.doesNotThrow(()=>validateCampaignVariantModel({variantModel:{dimensions:[]}}));
});
test('campaign conditions permit separate ownership for exclusive custom options',()=>{
 const doc=structuredClone(demo);
 doc.sharedDefinitions=['theme-light','theme-dark'].map((scope,i)=>({id:`theme${i}`,name:scope,values:{color:i?'white':'black'},members:[{size:'300x250',targetId:'title',scope}]}));
 assert.doesNotThrow(()=>materializeCreativeOwnership(doc));
});
test('header presentation can show a campaign-hidden dimension and set order',()=>{
 const doc=structuredClone(demo);doc.variantModel.dimensions[0].header=false;
 assert.equal(campaignHeaderDimensions(doc).length,2);
 doc.variantPresentation={hidden:[],order:['theme','product','language']};
 assert.deepEqual(campaignHeaderDimensions(doc).map(d=>d.id),['theme','product','language']);
});


test('legacy header availability and hidden-order persistence remain compatible',()=>{
 assert.deepEqual(campaignHeaderOrder(sse),['offerCount','tcMode','navyHeadlines','ctaShape','includeRoundelFrame']);
 const hiker={campaign:{id:'sse-hiker-welcome'}};
 assert.deepEqual(campaignHeaderDimensions(hiker).find(d=>d.id==='offerCount').options.map(o=>o.value),[1,2,3]);
 assert.deepEqual(campaignHeaderDimensions({...sse,variantPresentation:{hidden:['tcMode']}},{offer_count_num:0}).map(d=>d.id),['offerCount','navyHeadlines','ctaShape','includeRoundelFrame']);
});

test('generic models reject unsupported derived dimensions and legacy synthetic identities',()=>{
 const derived=structuredClone(demo);derived.variantModel.dimensions[0].derived=true;
 assert.throws(()=>validateCampaignVariantModel(derived),/derived dimensions require declarative rules/);
 for(const id of ['terms-solo','headline-act1','offer-slot-1','bg-image','cta']) {
  const doc=structuredClone(demo);doc.sizes['300x250'].layers[0].id=id;
  assert.throws(()=>validateCampaignVariantModel(doc),/reserved legacy/);
 }
});

test('derived states resolve dependencies, presence and browser parity',()=>{
 const doc={variantModel:{dimensions:[
  {id:'result',label:'Result',field:'result',derived:true,defaultValue:'no',options:[{value:'no',label:'No',scope:'result-no'},{value:'yes',label:'Yes',scope:'result-yes'}],rules:[{when:[{field:'copy',operator:'present'}],value:'yes'}]},
 ]}};
 validateCampaignVariantModel(doc);
 assert.equal(resolveCampaignRow(doc,{copy:' Hello '}).result,'yes');
 assert.deepEqual(campaignScopes(doc,{copy:'  '}),['result-no']);
 const browser=new Function('model','row',campaignStateRuntimeSource()+';return resolveCampaignState(model,row)');
 assert.deepEqual(browser(doc.variantModel,{copy:'Hello'}),resolveCampaignRow(doc,{copy:'Hello'}));
 assert.equal(evaluateConditions({x:false},[{field:'x',operator:'present'}]),true);
 const cycle=structuredClone(doc);cycle.variantModel.dimensions[0].rules[0].when[0].field='result';
 assert.throws(()=>validateCampaignVariantModel(cycle),/cycle/);
});
test('SSE configuration retains serving adapter and supports labels and defaults',()=>{
 const doc=structuredClone(sse);doc.campaignState={dimensions:[{id:'offerCount',label:'Products',field:'offer_count_num',defaultValue:2,options:[0,1,2,3].map(n=>({value:n,label:`Products: ${n}`,scope:`offers-${n}`}))}]};
 validateCampaignVariantModel(doc);
 assert.ok(campaignScopes(doc,{}).includes('offers-2'));
 assert.equal(campaignHeaderDimensions(doc).find(d=>d.id==='offerCount').label,'Products');
 for(const row of sse.feed.sampleRows) assert.deepEqual(campaignScopes(doc,row),campaignScopes(sse,row));
 doc.campaignState.dimensions[0].field='other';assert.throws(()=>validateCampaignVariantModel(doc),/SSE state mappings/);
});
test('state edits protect used scopes and field references',()=>{
 const next=structuredClone(demo);next.feed.sampleRows=[];next.variantModel.dimensions=next.variantModel.dimensions.filter(d=>d.id!=='theme');
 assert.throws(()=>validateCampaignStateEdit(demo,next),/still used/);
});
test('constraints and availability operate on resolved derived state',()=>{
 const doc=structuredClone(demo);doc.feed.sampleRows=[];
 doc.variantModel.dimensions[2].enabledWhen=[{field:'language',operator:'eq',value:'ga'}];
 doc.variantModel.constraints=[{when:[{field:'product',operator:'eq',value:'chair'}],require:[{field:'language',operator:'eq',value:'ga'}],message:'Chairs need Gaeilge'}];
 assert.ok(!campaignScopes(doc,{language:'en'}).some(s=>s.startsWith('theme-')));
 assert.throws(()=>campaignRowForScopes(doc,{},['product-chair']),/Chairs need Gaeilge/);
});
