import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { findCreativeTarget, updateCreativeTargetFit, updateCreativeTargetValue } from './creative-model';
import { validateCreativeDocument } from '../server/creative-document';
const fixture = () => ({ version: 1, campaign: { id: 'sse-dco' }, clock: { durationS: 15, beats: {} }, feed: { profileName: 'test', sampleRows: [] }, sizes: { '300x250': { canvas: { width: 300, height: 250 }, layers: [{ id: 'terms', kind: 'text', base: { width: 102, fontSize: 6 }, fit: { mode: 'shrink', maxLines: 4, minFontSize: 10 }, clips: [] }], variantRules: [{ id: 'compound', layerId: 'terms', scope: 'offers-0.tc-standard', props: { width: 100 }, fit: { maxLines: 2 } }, { id: 'plain', layerId: 'terms', scope: 'offers-0', props: { height: 43 }, fit: { minFontSize: 8 } }] } } });
const scopes = ['offers-0', 'tc-standard'];
describe('effective ownership', () => {
 it('merges each effective fit field and writes its controlling source', () => {
  const doc = fixture();
  const target = findCreativeTarget(doc, '300x250', 'terms', scopes);
  expect(target.fit).toEqual({ mode: 'shrink', maxLines: 2, minFontSize: 8 });
  expect(target.fitProvenance.maxLines.ruleId).toBe('compound');
  const next = updateCreativeTargetFit(doc, '300x250', 'terms', scopes, 'maxLines', 3);
  expect(findCreativeTarget(next, '300x250', 'terms', scopes).fit.maxLines).toBe(3);
  expect(findCreativeTarget(next, '300x250', 'terms', ['offers-1']).fit.maxLines).toBe(4);
  expect(next.sizes['300x250'].layers[0].fit).toEqual(doc.sizes['300x250'].layers[0].fit);
  expect(findCreativeTarget(JSON.parse(JSON.stringify(next)), '300x250', 'terms', scopes).fit.maxLines).toBe(3);
 });
 it('uses browser specificity and unscoped rules for effective property edits', () => {
  const doc = fixture();
  doc.sizes['300x250'].variantRules.push({ id: 'global', layerId: 'terms', scope: '', props: { width: 120, left: 6 }, fit: { mode: 'wrap' } });
  const target = findCreativeTarget(doc, '300x250', 'terms', scopes);
  expect(target.values.width).toBe(100);
  expect(target.values.left).toBe(6);
  expect(target.fit.mode).toBe('wrap');
  const next = updateCreativeTargetValue(doc, '300x250', 'terms', scopes, 'width', 88);
  expect(findCreativeTarget(next, '300x250', 'terms', scopes).values.width).toBe(88);
 });
 it('validates without adding, removing, or changing authored rules', () => {
  const doc = JSON.parse(fs.readFileSync('src/test/fixtures/campaign/sse-dco-creative.json', 'utf8'));
  doc.sizes['300x250'].variantRules.push({id:'custom-roundel',scope:'offers-2',layerId:'roundel-copy',props:{left:27}});
  const before = structuredClone(doc);
  validateCreativeDocument(doc);
  expect(doc).toEqual(before);
 });
});

import { materializeCreativeOwnership, setCreativeOwnershipField, detachCreativeOwnership, resetCreativeOwnershipField } from './creative-ownership';
it('named sharing has explicit members, local exceptions, reset, and preserved detach', () => {
 const doc = fixture();
 doc.sharedDefinitions = [{id:'legal',name:'Legal fit',fit:{maxLines:3},members:[{size:'300x250',targetId:'terms',scope:'offers-0'}]}];
 const compiled = materializeCreativeOwnership(doc);
 expect(materializeCreativeOwnership(compiled)).toEqual(compiled);
 expect(findCreativeTarget(doc,'300x250','terms',scopes).fit.maxLines).toBe(3);
 const local = setCreativeOwnershipField(doc,'300x250','terms',scopes,'fit','maxLines',5,'local');
 expect(findCreativeTarget(local,'300x250','terms',scopes).fit.maxLines).toBe(5);
 expect(local.sharedDefinitions[0].fit.maxLines).toBe(3);
 const reset = resetCreativeOwnershipField(local,'300x250','terms',scopes,'fit','maxLines');
 expect(findCreativeTarget(reset,'300x250','terms',scopes).fit.maxLines).toBe(3);
 const detached = detachCreativeOwnership(doc,'legal',{size:'300x250',targetId:'terms',scope:'offers-0'});
 expect(findCreativeTarget(detached,'300x250','terms',scopes).fit.maxLines).toBe(3);
 expect(detached.sharedDefinitions[0].members).toEqual([]);
 expect(findCreativeTarget(doc,'300x250','terms',['offers-1']).fit.maxLines).toBe(4);
});
it('rejects missing targets and overlapping shared field ownership', () => {
 const doc = fixture();
 doc.sharedDefinitions = [{id:'a',name:'A',fit:{maxLines:2},members:[{size:'300x250',targetId:'missing'}]}];
 expect(() => materializeCreativeOwnership(doc)).toThrow(/target/i);
 doc.sharedDefinitions[0].members[0].targetId = 'terms';
 doc.sharedDefinitions.push({...structuredClone(doc.sharedDefinitions[0]),id:'b'});
 expect(() => materializeCreativeOwnership(doc)).toThrow(/conflict/i);
});

import { createCreativeOwnershipDefinition, linkCreativeOwnership, copyCreativeOwnership } from './creative-ownership';
import { selectorForVariantRule } from './creative-css';
it('shared edits affect only explicit members and honor per-size sources', () => {
 const doc = fixture();
 doc.sizes['300x600'] = structuredClone(doc.sizes['300x250']);
 doc.sharedDefinitions = [{id:'legal',name:'Legal',values:{fontSize:7},fit:{maxLines:3},perSize:{'300x600':{values:{fontSize:12}}},members:[{size:'300x250',targetId:'terms',scope:'offers-0'},{size:'300x600',targetId:'terms',scope:'offers-0'}]}];
 const next = setCreativeOwnershipField(doc,'300x250','terms',scopes,'fit','maxLines',6,'shared','legal');
 expect(findCreativeTarget(next,'300x600','terms',scopes).fit.maxLines).toBe(6);
 const format = setCreativeOwnershipField(next,'300x600','terms',scopes,'values','fontSize',15,'shared','legal');
 expect(findCreativeTarget(format,'300x250','terms',scopes).values.fontSize).toBe(7);
 expect(findCreativeTarget(format,'300x600','terms',scopes).values.fontSize).toBe(15);
 expect(findCreativeTarget(format,'300x600','terms',['offers-1']).values.fontSize).toBe(6);
});
it('field detach preserves that field while retaining independent shared fields', () => {
 const doc = fixture(); const member = {size:'300x250',targetId:'terms',scope:'offers-0'};
 doc.sharedDefinitions = [{id:'legal',name:'Legal',values:{fontSize:7},fit:{maxLines:3,minFontSize:5},members:[member]}];
 const detached = detachCreativeOwnership(doc,'legal',member,{fit:['maxLines']});
 const changed = setCreativeOwnershipField(detached,'300x250','terms',scopes,'fit','maxLines',8,'shared','legal');
 expect(findCreativeTarget(changed,'300x250','terms',scopes).fit.maxLines).toBe(3);
 expect(findCreativeTarget(changed,'300x250','terms',scopes).fitProvenance.minFontSize.kind).toBe('sharedDefinition');
});
it('copy once creates no member, and different states may own the same field', () => {
 const doc = fixture();
 doc.sharedDefinitions = [{id:'one',name:'One',fit:{maxLines:3},members:[{size:'300x250',targetId:'terms',scope:'offers-1'}]},{id:'two',name:'Two',fit:{maxLines:6},members:[{size:'300x250',targetId:'terms',scope:'offers-2'}]}];
 expect(() => materializeCreativeOwnership(doc)).not.toThrow();
 const next = copyCreativeOwnership(doc,'two',{size:'300x250',targetId:'terms',scope:'offers-0'});
 expect(next.sharedDefinitions).toEqual(doc.sharedDefinitions);
 expect(findCreativeTarget(next,'300x250','terms',scopes).fit.maxLines).toBe(6);
 const generated = materializeCreativeOwnership(next).sizes['300x250'].variantRules.at(-1);
 expect(selectorForVariantRule(generated)).toMatch(/\.offers-0 #terms#terms/);
});
it('validation rejects invalid named membership without mutating its input', () => {
 const doc = fixture();
 doc.sharedDefinitions = [{id:'missing',name:'Invalid member',members:[{size:'300x250',targetId:'absent'}]}];
 const before = structuredClone(doc);
 expect(() => validateCreativeDocument(doc)).toThrow(/target/i);
 expect(doc).toEqual(before);
});

import { resetCreativeTargetField } from './creative-model';
it('reset removes exactly the controlling field and exposes the inherited value', () => {
 const doc = fixture();
 const next = resetCreativeTargetField(doc,'300x250','terms',scopes,'fit','maxLines');
 expect(findCreativeTarget(next,'300x250','terms',scopes).fit.maxLines).toBe(4);
 expect(next.sizes['300x250'].variantRules[1]).toEqual(doc.sizes['300x250'].variantRules[1]);
 expect(next.sizes['300x250'].variantRules[0].props).toEqual(doc.sizes['300x250'].variantRules[0].props);
});

import { targetIdToSelector } from './creative-css';
it('targets the production DOM IDs for offer children and solo legal copy', () => {
 expect(targetIdToSelector('offer-slot-2::offer-subline')).toBe('#offer2 .offer-subline');
 expect(targetIdToSelector('offer-slot-1')).toBe('#offer1');
 expect(targetIdToSelector('terms-solo')).toBe('#TC_Solo .terms-solo');
 expect(targetIdToSelector('headline-act1')).toBe('#headline-act1');
});

import os from 'node:os';
import path from 'node:path';
import { writeCreativeDocument, readCreativeDocument } from '../server/creative-document';
it('save and reload preserve named members, overrides, and their effective fields', async () => {
 const doc = fixture();
 doc.sharedDefinitions = [{id:'legal',name:'Legal',fit:{maxLines:3},members:[{size:'300x250',targetId:'terms',scope:'offers-0'}]}];
 const next = setCreativeOwnershipField(doc,'300x250','terms',scopes,'fit','maxLines',5,'local');
 const directory = fs.mkdtempSync(path.join(os.tmpdir(),'creative-ownership-'));
 try {
  const file = path.join(directory,'creative.json');
  await writeCreativeDocument(next,file);
  const loaded = await readCreativeDocument(file);
  expect(loaded).toEqual(next);
  expect(findCreativeTarget(loaded,'300x250','terms',scopes).fit.maxLines).toBe(5);
  expect(findCreativeTarget(loaded,'300x250','terms',['offers-1']).fit.maxLines).toBe(4);
 } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});

import { variantRuleProps } from './creative-css';
it('named rules emit only their owned properties without deriving unrelated frame dimensions', () => {
 const doc = fixture();
 doc.sharedDefinitions = [{id:'type',name:'Type',values:{fontSize:10},fit:{maxLines:2},members:[{size:'300x250',targetId:'terms'}]}];
 const compiled = materializeCreativeOwnership(doc);
 const rule = compiled.sizes['300x250'].variantRules.at(-1);
 expect(variantRuleProps(compiled.sizes['300x250'],rule)).toEqual({fontSize:10});
});
it('roundel visibility and roundel copy mode are independent scope dimensions', () => {
 const doc = fixture();
 doc.sharedDefinitions = [{id:'a',name:'Visible',fit:{maxLines:2},members:[{size:'300x250',targetId:'terms',scope:'roundel-frame-on'}]},{id:'b',name:'Split',fit:{maxLines:3},members:[{size:'300x250',targetId:'terms',scope:'roundel-split'}]}];
 expect(()=>materializeCreativeOwnership(doc)).toThrow(/Visible and Split/);
});

it('detach preserves winning locals across overlapping scopes and domains', () => {
 const doc = fixture();
 const member = {size:'300x250',targetId:'terms',scope:'offers-0'};
 doc.sharedDefinitions = [{id:'shared',name:'Shared',values:{color:'red'},fit:{maxLines:3},members:[member]}];
 doc.sizes['300x250'].localOverrides = [
  {targetId:'terms',scope:'',values:{color:'blue'},fit:{maxLines:6}},
  {targetId:'terms',scope:'offers-0',values:{left:15}},
  {targetId:'terms',scope:'offers-0.cta-rect',values:{color:'green'}},
 ];
 const before = ['offers-0','offers-0.cta-rect','offers-1'].map((scope)=>findCreativeTarget(doc,'300x250','terms',scope.split('.')));
 const detached = detachCreativeOwnership(doc,'shared',member);
 const after = ['offers-0','offers-0.cta-rect','offers-1'].map((scope)=>findCreativeTarget(detached,'300x250','terms',scope.split('.')));
 expect(after.map((target)=>target.values)).toEqual(before.map((target)=>target.values));
 expect(after.map((target)=>target.fit)).toEqual(before.map((target)=>target.fit));
 const local = setCreativeOwnershipField(detached,'300x250','terms',['offers-0'],'values','color','yellow','local');
 expect(findCreativeTarget(local,'300x250','terms',['offers-0']).values.color).toBe('yellow');
});
it('hidden shared values retain provenance and can be explicitly unhidden locally', () => {
 const doc = fixture();
 doc.sizes['300x250'].layers[0].base.visibility = 'visible';
 doc.sharedDefinitions = [{id:'hidden',name:'Hidden',values:{visibility:'hidden'},fit:{maxLines:7},members:[{size:'300x250',targetId:'terms',scope:'offers-0'}]}];
 const hidden = findCreativeTarget(doc,'300x250','terms',['offers-0']);
 expect(hidden.values.visibility).toBe('hidden');
 expect(hidden.valueProvenance.visibility.kind).toBe('sharedDefinition');
 expect(hidden.fit.maxLines).toBe(7);
 const visible = updateCreativeTargetValue(doc,'300x250','terms',['offers-0'],'visibility','visible');
 expect(findCreativeTarget(visible,'300x250','terms',['offers-0']).values.visibility).toBe('visible');
 expect(visible.sharedDefinitions[0].values.visibility).toBe('hidden');
 const rules = materializeCreativeOwnership(visible).sizes['300x250'].variantRules;
 expect(variantRuleProps(visible.sizes['300x250'],rules.at(-1))).toEqual({visibility:'visible'});
 expect(selectorForVariantRule(rules.at(-1))).toContain('#terms');
});

it('a later detach preserves an earlier detached fallback across different scopes', () => {
 const doc = fixture();
 const globalMember = {size:'300x250',targetId:'terms',scope:''};
 doc.sharedDefinitions = [{id:'first',name:'First',values:{color:'blue'},members:[globalMember]}];
 const first = detachCreativeOwnership(doc,'first',globalMember);
 const scopedMember = {...globalMember,scope:'offers-0'};
 const linked = createCreativeOwnershipDefinition(first,{id:'second',name:'Second',values:{color:'red'},members:[scopedMember]});
 expect(findCreativeTarget(linked,'300x250','terms',['offers-0']).values.color).toBe('blue');
 const second = detachCreativeOwnership(linked,'second',scopedMember);
 expect(findCreativeTarget(second,'300x250','terms',['offers-0']).values.color).toBe('blue');
});

import { sharedCreativeFieldReach } from './creative-ownership';
it('shared provenance and edit reach distinguish format overrides from definition defaults', () => {
 const doc = fixture();
 doc.sizes['300x600']=structuredClone(doc.sizes['300x250']);
 doc.sizes['728x90']=structuredClone(doc.sizes['300x250']);
 doc.sharedDefinitions=[{id:'type',name:'Type',values:{fontSize:7},fit:{maxLines:3},perSize:{'300x600':{values:{fontSize:12}}},members:[
  {size:'300x250',targetId:'terms',scope:'offers-0'},
  {size:'300x600',targetId:'terms',scope:'offers-0'},
  {size:'728x90',targetId:'terms',scope:'offers-0'},
  {size:'728x90',targetId:'terms',scope:'offers-1',exclude:{values:['fontSize']}},
 ]}];
 doc.sizes['728x90'].localOverrides=[{targetId:'terms',scope:'offers-0.cta-rect',values:{fontSize:9}}];
 const formatSource=findCreativeTarget(doc,'300x600','terms',scopes).valueProvenance.fontSize;
 const rootSource=findCreativeTarget(doc,'300x250','terms',scopes).valueProvenance.fontSize;
 expect(formatSource).toMatchObject({kind:'sharedDefinition',sourceLevel:'format',format:'300x600',domain:'values',field:'fontSize'});
 expect(rootSource).toMatchObject({kind:'sharedDefinition',sourceLevel:'definition',domain:'values',field:'fontSize'});
 expect(findCreativeTarget(doc,'300x600','terms',scopes).fitProvenance.maxLines).toMatchObject({sourceLevel:'definition',domain:'fit',field:'maxLines'});
 const formatReach=sharedCreativeFieldReach(doc,formatSource);
 expect(formatReach.members.map(member=>member.size)).toEqual(['300x600']);
 const rootReach=sharedCreativeFieldReach(doc,rootSource);
 expect(rootReach.members.map(member=>`${member.size}:${member.scope}`)).toEqual(['300x250:offers-0','728x90:offers-0']);
 expect(rootReach.localExceptions).toMatchObject([{member:{size:'728x90',targetId:'terms'},scopes:['offers-0.cta-rect']}]);
 const formatEdit=setCreativeOwnershipField(doc,'300x600','terms',scopes,'values','fontSize',15,'shared','type');
 expect(findCreativeTarget(formatEdit,'300x250','terms',scopes).values.fontSize).toBe(7);
 expect(findCreativeTarget(formatEdit,'728x90','terms',scopes).values.fontSize).toBe(7);
 const rootEdit=setCreativeOwnershipField(formatEdit,'300x250','terms',scopes,'values','fontSize',8,'shared','type');
 expect(findCreativeTarget(rootEdit,'300x250','terms',scopes).values.fontSize).toBe(8);
 expect(findCreativeTarget(rootEdit,'728x90','terms',scopes).values.fontSize).toBe(8);
 expect(findCreativeTarget(rootEdit,'300x600','terms',scopes).values.fontSize).toBe(15);
 expect(findCreativeTarget(rootEdit,'728x90','terms',['offers-0','cta-rect']).values.fontSize).toBe(9);
 expect(findCreativeTarget(rootEdit,'728x90','terms',['offers-1']).values.fontSize).toBe(6);
});

it('T&Cs local writes omit ink so white and navy share the same override', () => {
 const doc = {
  version: 1,
  campaign: { id: 'sse-dco' },
  clock: { durationS: 15, beats: {} },
  feed: { profileName: 'test', sampleRows: [] },
  sizes: {
   '300x250': {
    canvas: { width: 300, height: 250 },
    layers: [{ id: 'terms-prices', kind: 'text', base: { cssClass: 'terms-prices', fontSize: 6 }, clips: [] }],
    localOverrides: [],
    variantRules: [],
   },
  },
 };
 const navyScopes = ['offers-0', 'navy-headlines', 'tc-solo', 'cta-rect'];
 const whiteScopes = ['offers-0', 'white-headlines', 'tc-solo', 'cta-rect'];
 const next = setCreativeOwnershipField(doc, '300x250', 'terms-prices', navyScopes, 'values', 'fontSize', 8, 'local');
 expect(next.sizes['300x250'].localOverrides).toEqual([
  { targetId: 'terms-prices', scope: 'cta-rect.offers-0.tc-solo', values: { fontSize: 8 }, fit: {} },
 ]);
 expect(findCreativeTarget(next, '300x250', 'terms-prices', navyScopes).values.fontSize).toBe(8);
 expect(findCreativeTarget(next, '300x250', 'terms-prices', whiteScopes).values.fontSize).toBe(8);
});
