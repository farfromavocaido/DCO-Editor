import { describe, expect, it } from 'vitest';
import { ownershipDestinations, validOwnershipProperty, copyOwnershipSelection, editOwnershipVersion, replaceOwnershipDestinationLocals, suppliedOwnershipFields, campaignOwnershipDestinations, campaignConcreteDestinations, resolveOwnershipVersionRow, replaceOwnershipDestinationLinks } from './ownership-ui';
import { createCreativeOwnershipDefinition, setCreativeOwnershipField, detachCreativeOwnership } from './creative-ownership';
import { materializeCreativeOwnership, ownershipRuleSpecificity } from './creative-ownership';
import { selectorForVariantRule } from './creative-css';
import { findCreativeTarget } from './creative-model';
const fixture = (): any => ({ sizes: Object.fromEntries(['300x250','300x600'].map(size => [size, {layers:[{id:'title',kind:'text',base:{fontSize:20,left:size === '300x250' ? 10 : 30},fit:{maxLines:2},clips:[]}],variantRules:[]}])) });
describe('ownership destination controls', () => {
 it('adds alternative offer counts without narrowing existing destinations', () => {
  const one = ownershipDestinations('title',['300x250'],[1],['cta-rect']);
  const multiple = ownershipDestinations('title',['300x250','300x600'],[0,1,2,3],['cta-rect']);
  expect(multiple).toHaveLength(8);
  expect(multiple).toContainEqual(one[0]);
  expect(multiple.every(member => member.scope.match(/offers-/g)?.length === 1)).toBe(true);
 });
 it('replaces an unavailable selected property when target or domain changes', () => {
  expect(validOwnershipProperty({values:{left:12}},'values','fontSize')).toBe('left');
  expect(validOwnershipProperty({fit:{}},'fit','maxLines')).toBe('');
 });
 it('copies only selected current values to all destinations and keeps later edits independent', () => {
  const doc = fixture();
  const destinations = ownershipDestinations('title',['300x600'],[0,2]);
  const copied = copyOwnershipSelection(doc,'300x250','title',['offers-1'],['values:fontSize'],destinations);
  const changed = setCreativeOwnershipField(copied,'300x250','title',['offers-1'],'values','fontSize',40);
  for (const count of [0,2]) {
   const target = findCreativeTarget(changed,'300x600','title',[`offers-${count}`]);
   expect(target.values.fontSize).toBe(20); expect(target.values.left).toBe(30);
  }
  expect(copied.sharedDefinitions).toBeUndefined();
  expect(doc.sizes['300x600'].localOverrides).toBeUndefined();
 });
 it('links multiple offer counts live and detaches one without affecting other members', () => {
  const members = ownershipDestinations('title',['300x250'],[0,1,2]);
  const linked = createCreativeOwnershipDefinition(fixture(),{id:'type',name:'Typography',values:{fontSize:25},members});
  const detached = detachCreativeOwnership(linked,'type',members[1]);
  const edited = setCreativeOwnershipField(detached,'300x250','title',['offers-0'],'values','fontSize',32,'shared','type');
  expect([0,1,2,3].map(count => findCreativeTarget(edited,'300x250','title',[`offers-${count}`]).values.fontSize)).toEqual([32,25,32,20]);
 });
 it('copies over a linked destination without changing other linked counts', () => {
  const members = ownershipDestinations('title',['300x600'],[0,1]);
  const linked = createCreativeOwnershipDefinition(fixture(),{id:'type',name:'Typography',values:{fontSize:25},members});
  const copied = copyOwnershipSelection(linked,'300x250','title',['offers-2'],['values:fontSize'],[members[0]]);
  const edited = setCreativeOwnershipField(copied,'300x600','title',['offers-1'],'values','fontSize',32,'shared','type');
  expect(findCreativeTarget(edited,'300x600','title',['offers-0']).values.fontSize).toBe(20);
  expect(findCreativeTarget(edited,'300x600','title',['offers-1']).values.fontSize).toBe(32);
 });
 it('edits base geometry and text only in the current format and state, including atomic alignment', () => {
  const doc = fixture();
  const edited = editOwnershipVersion(doc,'300x250','title',['offers-1','cta-rect'],'values',{left:'40',fontSize:'18',textAlign:'center',justifyContent:'center'});
  const current = findCreativeTarget(edited,'300x250','title',['offers-1','cta-rect']);
  expect(current.values).toMatchObject({left:40,fontSize:18,textAlign:'center',justifyContent:'center'});
  expect(findCreativeTarget(edited,'300x250','title',['offers-2','cta-rect']).values).toMatchObject({left:10,fontSize:20});
  expect(findCreativeTarget(edited,'300x600','title',['offers-1','cta-rect']).values).toMatchObject({left:30,fontSize:20});
  expect(doc.sizes['300x250'].localOverrides).toBeUndefined();
  const fit = editOwnershipVersion(edited,'300x250','title',['offers-1','cta-rect'],'fit',{maxLines:'4'});
  expect(findCreativeTarget(fit,'300x250','title',['offers-1','cta-rect']).fit.maxLines).toBe(4);
  expect(findCreativeTarget(fit,'300x250','title',['offers-2','cta-rect']).fit.maxLines).toBe(2);
 });
 it('replaces narrower local copy fields while retaining unrelated properties', () => {
  const doc = fixture();
  doc.sizes['300x600'].localOverrides = [{targetId:'title',scope:'offers-2.cta-rect',values:{fontSize:55,left:19}}];
  const copied = copyOwnershipSelection(doc,'300x250','title',['offers-0'],['values:fontSize'],ownershipDestinations('title',['300x600'],[2]));
  expect(findCreativeTarget(copied,'300x600','title',['offers-2','cta-rect']).values).toMatchObject({fontSize:20,left:19});
 });
 it('partitions broader local values outside the destination and enables live sharing inside it', () => {
  const doc = fixture();
  doc.sizes['300x250'].localOverrides = [{targetId:'title',scope:'',values:{fontSize:55,left:19}}];
  const members = ownershipDestinations('title',['300x250'],[1,2],['cta-rect']);
  const cleaned = replaceOwnershipDestinationLocals(doc,members,{values:['fontSize']});
  const shared = createCreativeOwnershipDefinition(cleaned,{id:'type',name:'Type',values:{fontSize:25},members});
  const edited = setCreativeOwnershipField(shared,'300x250','title',['offers-1','cta-rect'],'values','fontSize',32,'shared','type');
  for (const count of [0,1,2,3]) for (const cta of ['cta-rect','cta-roundel']) {
   expect(findCreativeTarget(edited,'300x250','title',[`offers-${count}`,cta]).values).toMatchObject({fontSize:[1,2].includes(count) && cta==='cta-rect' ? 32 : 55,left:19});
  }
 });
 it('retains original cascade weight after repeated splitting, including CSS selectors', () => {
  const doc = fixture();
  doc.sizes['300x250'].localOverrides = [
   {targetId:'title',scope:'',values:{fontSize:55},fit:{maxLines:5}},
   {targetId:'title',scope:'offers-0',values:{fontSize:30},fit:{maxLines:3}},
  ];
  let replaced = replaceOwnershipDestinationLocals(doc,ownershipDestinations('title',['300x250'],[1],['cta-rect']),{values:['fontSize'],fit:['maxLines']});
  replaced = replaceOwnershipDestinationLocals(replaced,ownershipDestinations('title',['300x250'],[2],['cta-rect']),{values:['fontSize'],fit:['maxLines']});
  const target = findCreativeTarget(replaced,'300x250','title',['offers-0','cta-rect']);
  expect(target.values.fontSize).toBe(30); expect(target.fit.maxLines).toBe(3);
  const compiled = materializeCreativeOwnership(replaced);
  const residual = compiled.sizes['300x250'].variantRules.find((rule:any) => rule.ownershipScopeSpecificity === 0 && rule.scope.includes('offers-0'));
  const scoped = compiled.sizes['300x250'].variantRules.find((rule:any) => rule.scope==='offers-0' && rule.props.fontSize===30);
  expect(selectorForVariantRule(residual)).toContain(':where(');
  expect(ownershipRuleSpecificity(scoped)).toBe(ownershipRuleSpecificity(residual)+1);
 });
 it('only clears fields supplied by the shared definition in each destination format', () => {
  const doc = fixture();
  for (const size of Object.keys(doc.sizes)) doc.sizes[size].localOverrides=[{targetId:'title',scope:'offers-1',fit:{minFontSize:11,maxLines:4}}];
  const members = ownershipDestinations('title',Object.keys(doc.sizes),[1]);
  const definition = {id:'a',name:'Type',values:{fontSize:25},perSize:{'300x600':{fit:{minFontSize:8}}},members};
  const cleared = replaceOwnershipDestinationLocals(doc,members,(member:any)=>suppliedOwnershipFields(definition,member));
  expect(cleared.sizes['300x250'].localOverrides[0].fit).toEqual({minFontSize:11,maxLines:4});
  expect(cleared.sizes['300x600'].localOverrides[0].fit).toEqual({maxLines:4});
 });
 it('preserves no-ink offer states when replacing a zero-offer ink condition', () => {
  const doc = fixture(); doc.sizes['300x250'].localOverrides=[{targetId:'title',scope:'',values:{fontSize:55}}];
  const cleared = replaceOwnershipDestinationLocals(doc,ownershipDestinations('title',['300x250'],[0],['navy-headlines']),{values:['fontSize']});
  for (const count of [1,2,3]) expect(findCreativeTarget(cleared,'300x250','title',[`offers-${count}`]).values.fontSize).toBe(55);
  expect(() => replaceOwnershipDestinationLocals(doc,ownershipDestinations('title',['300x250'],[1],['navy-headlines']),{values:['fontSize']})).toThrow(/only to 0 offers/);
 });
 it('requires destinations and valid selected fields', () => {
  expect(() => copyOwnershipSelection(fixture(),'300x250','title',[],[],[])).toThrow(/destination version and format/);
  expect(() => copyOwnershipSelection(fixture(),'300x250','title',[],['values:missing'],ownershipDestinations('title',['300x600'],[1]))).toThrow(/property/);
 });
});

const genericFixture = () => ({...fixture(),variantModel:{dimensions:[
 {id:'audience',label:'Audience',field:'audience',defaultValue:'home',options:[{value:'home',label:'Home',scope:'audience-home'},{value:'business',label:'Business',scope:'audience-business'}]},
 {id:'tone',label:'Tone',field:'tone',defaultValue:'light',options:[{value:'light',label:'Light',scope:'tone-light'},{value:'dark',label:'Dark',scope:'tone-dark'}]},
]}});
describe('campaign relationship destinations', () => {
 it('uses campaign alternatives and combines independent dimensions', () => {
  expect(campaignOwnershipDestinations(genericFixture(),'title',['300x250','300x600'],{audience:['home','business'],tone:['dark']})).toEqual([
   {size:'300x250',targetId:'title',scope:'audience-home.tone-dark'}, {size:'300x250',targetId:'title',scope:'audience-business.tone-dark'},
   {size:'300x600',targetId:'title',scope:'audience-home.tone-dark'}, {size:'300x600',targetId:'title',scope:'audience-business.tone-dark'},
  ]);
 });
 it('partitions generic local values and copies without coupling versions', () => {
  const doc = genericFixture(); doc.sizes['300x600'].localOverrides = [{targetId:'title',scope:'',values:{fontSize:55}}];
  const members = campaignOwnershipDestinations(doc,'title',['300x600'],{audience:['home']});
  const copied = copyOwnershipSelection(doc,'300x250','title',['audience-business','tone-light'],['values:fontSize'],members);
  expect(findCreativeTarget(copied,'300x600','title',['audience-home','tone-dark']).values.fontSize).toBe(20);
  expect(findCreativeTarget(copied,'300x600','title',['audience-business','tone-dark']).values.fontSize).toBe(55);
 });
 it('replaces selected linked fields while preserving other members and fields', () => {
  const doc = createCreativeOwnershipDefinition(genericFixture(),{id:'old',name:'Old',values:{fontSize:30,left:12},members:[{size:'300x250',targetId:'title',scope:''}]});
  const members = campaignOwnershipDestinations(doc,'title',['300x250'],{audience:['home']});
  const replaced = replaceOwnershipDestinationLinks(doc,members,{values:['fontSize']});
  const next = createCreativeOwnershipDefinition(replaced,{id:'new',name:'New',values:{fontSize:40},members});
  expect(findCreativeTarget(next,'300x250','title',['audience-home','tone-light']).values).toMatchObject({fontSize:40,left:12});
  expect(findCreativeTarget(next,'300x250','title',['audience-business','tone-light']).values).toMatchObject({fontSize:30,left:12});
 });
 it('rejects invalid campaign combinations before changing a document', () => {
  const doc = genericFixture(); doc.variantModel.validConditions = [['audience-home','tone-light'],['audience-business','tone-dark']];
  expect(() => campaignOwnershipDestinations(doc,'title',['300x250'],{audience:['home'],tone:['dark']})).toThrow(/not allowed/);
  expect(campaignOwnershipDestinations(doc,'title',['300x250'],{audience:['home']})).toHaveLength(1);
 });
});

describe('concrete destination review', () => {
 it('counts and previews every actual version, with empty selections selecting nothing', () => {
  const doc=genericFixture();
  doc.variantModel.dimensions.push({id:'language',label:'Language',field:'language',defaultValue:'en',options:[{value:'en',label:'English',scope:'language-en'},{value:'ga',label:'Irish',scope:'language-ga'}]});
  const choices={audience:['home'],tone:['light','dark'],language:['en','ga']};
  const destinations=campaignConcreteDestinations(doc,'title',['300x250'],choices);
  expect(destinations).toHaveLength(4);
  expect(destinations.map(member=>member.scope)).toEqual(['audience-home.language-en.tone-light','audience-home.language-ga.tone-light','audience-home.language-en.tone-dark','audience-home.language-ga.tone-dark']);
  expect(campaignConcreteDestinations(doc,'title',['300x250'],{...choices,tone:[]})).toHaveLength(0);
 });
 it('excludes forbidden concrete campaign combinations', () => {
  const doc=genericFixture();doc.variantModel.validConditions=[['audience-home','tone-light'],['audience-business','tone-dark']];
  const destinations=campaignConcreteDestinations(doc,'title',['300x250'],{audience:['home','business'],tone:['light','dark']});
  expect(destinations).toHaveLength(2);
 });
});

describe('version-specific comparison content', () => {
 it('uses the matching unsaved feed row rather than retaining current source copy', () => {
  const doc=genericFixture();
  const current={audience:'home',tone:'light',title:'Home title'};
  doc.feed={sampleRows:[current,{audience:'business',tone:'dark',title:'Saved business'}]};
  const drafts=[current,{audience:'business',tone:'dark',title:'Unsaved business copy'}];
  const resolved=resolveOwnershipVersionRow(doc,current,['audience-business','tone-dark'],drafts);
  expect(resolved).toEqual({row:drafts[1],synthesized:false});
  expect(resolveOwnershipVersionRow(doc,current,['audience-home','tone-light'],drafts).row).toBe(current);
  expect(resolveOwnershipVersionRow(doc,current,['audience-business','tone-light'],drafts).synthesized).toBe(true);
 });
});
