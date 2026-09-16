// @ts-nocheck
import { test } from 'vitest';
import assert from 'node:assert/strict';
import demo from '../../campaign/product-demo-creative.json';
import sse from '../../campaign/sse-dco-creative.json';
import { campaignScopes, campaignConditionFamilies, campaignHeaderDimensions, campaignHeaderOrder, campaignRowForScopes, campaignVersionLabel, validateCampaignVariantModel } from './campaign-variants';
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
 assert.throws(()=>validateCampaignVariantModel(derived),/derived dimensions are not supported/);
 for(const id of ['terms-solo','headline-act1','offer-slot-1','bg-image','cta']) {
  const doc=structuredClone(demo);doc.sizes['300x250'].layers[0].id=id;
  assert.throws(()=>validateCampaignVariantModel(doc),/reserved legacy/);
 }
});
