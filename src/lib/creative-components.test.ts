import { describe,it,expect } from 'vitest';
import fs from 'node:fs';
import { componentBounds,materializeComponentLinks,updateComponentBounds,creativeComponents,transferCreativeComponent,createComponentLink,unlinkComponent,validateCreativeComponents } from './creative-components';
import { effectiveTextFitForTarget } from './text-fit-rules';
import { findCreativeTarget } from './creative-model';
const fixture=()=>({variantModel:{dimensions:[{id:'version',options:[{scope:'a'},{scope:'b'}]},{id:'arrangement',options:[{scope:'split'},{scope:'copy'}]}]},componentDefinitions:[{id:'component:badge',name:'Badge',frameTargetId:'disc',resize:'proportional',stateDimensions:['arrangement'],parts:[{role:'frame',targetId:'disc'},{role:'copy',targetId:'label'}]}],sizes:Object.fromEntries(['300x250','300x600'].map((size,index)=>[size,{canvas:{width:300,height:index?600:250},layers:[{id:'disc',kind:'shape',base:{left:index?50:10,top:index?100:20,width:index?200:100,height:index?200:100},clips:[]},{id:'label',kind:'text',base:{left:20,top:40,width:80,height:20,fontSize:16,lineHeight:1.2,padding:4,borderRadius:'50%'},fit:{mode:'shrink',minFontSize:8,maxLines:2},binding:{field:'copy'},clips:[]}],variantRules:[{id:'copylabel',layerId:'label',scope:'copy',props:{top:60,height:50},fit:{maxLines:4}}]}]))});
describe('reusable components',()=>{
 it('handles unloaded documents',()=>expect(creativeComponents(null,'300x250')).toEqual([]));
 it('copies all internal arrangements with proportional pixel fitting and preserves other versions',()=>{
  const doc=fixture(),before=structuredClone(doc);
  const next=transferCreativeComponent(doc,{componentId:'component:badge',sourceSize:'300x250',sourceScopes:['a','split'],destinations:[{size:'300x600',scope:'b.split'}],sizing:'destination'});
  expect(doc).toEqual(before);expect(next.sizes['300x250']).toEqual(doc.sizes['300x250']);
  const split=findCreativeTarget(next,'300x600','label',['b','split']);
  expect(split.values).toMatchObject({left:70,top:140,width:160,height:40,fontSize:32,padding:8,lineHeight:1.2,borderRadius:'50%'});expect(split.fit).toMatchObject({minFontSize:16,maxLines:2});
  expect(findCreativeTarget(next,'300x600','label',['b','copy']).fit.maxLines).toBe(4);
  expect(findCreativeTarget(next,'300x600','label',['a','split']).values).toEqual(findCreativeTarget(doc,'300x600','label',['a','split']).values);
 });
 it('replaces destination-only fit policies with source runtime values',()=>{
  const doc=fixture();doc.sizes['300x600'].layers[1].fit={mode:'truncate',frame:'fixed',minFontSize:70,maxLines:8,minFontSizeRatio:0.9,tracking:{minEm:-0.2}};
  const next=transferCreativeComponent(doc,{componentId:'component:badge',sourceSize:'300x250',sourceScopes:['a','split'],destinations:[{size:'300x600',scope:'b'}]});
  const fit=effectiveTextFitForTarget(next,'300x600','label',['b','split']);
  expect(fit).toMatchObject({allowShrink:true,static:false,frame:'',minFontSize:16,minFontSizeRatio:0,maxLines:2,tracking:{minEm:0}});
 });
 it('clears a destination fixed height when source uses content height',()=>{
  const doc=fixture();delete doc.sizes['300x250'].layers[1].base.height;
  doc.sizes['300x600'].layers[1].base.height=100;
  const next=transferCreativeComponent(doc,{componentId:'component:badge',sourceSize:'300x250',sourceScopes:['a','split'],destinations:[{size:'300x600',scope:'b'}],sizing:'source'});
  expect(findCreativeTarget(next,'300x600','label',['b','split']).values.height).toBe('auto');
 });
 it('stretches frame layout while retaining source label size, padding and fitting pixels',()=>{
  const doc=fixture();doc.componentDefinitions[0].resize='frame';
  doc.sizes['300x600'].layers[0].base.height=300;
  const next=transferCreativeComponent(doc,{componentId:'component:badge',sourceSize:'300x250',sourceScopes:['a','split'],destinations:[{size:'300x600',scope:'b'}]});
  const text=findCreativeTarget(next,'300x600','label',['b','split']);
  expect(text.values).toMatchObject({width:160,height:60,fontSize:16,padding:4});
  expect(text.fit.minFontSize).toBe(8);
 });
 it('source sizing centres the original dimensions inside the destination placement',()=>{
  const next=transferCreativeComponent(fixture(),{componentId:'component:badge',sourceSize:'300x250',sourceScopes:['a'],destinations:[{size:'300x600',scope:'b'}],sizing:'source'});
  expect(componentBounds(next,'300x600','component:badge',['b','split'])).toMatchObject({left:100,top:150,width:100,height:100});
 });
 it('inserts absent complete components and rejects partial instances',()=>{
  const doc=fixture();doc.sizes['300x600'].layers=[];
  const next=transferCreativeComponent(doc,{componentId:'component:badge',sourceSize:'300x250',sourceScopes:['a'],destinations:[{size:'300x600',scope:'b'}]});
  expect(next.sizes['300x600'].layers).toHaveLength(2);validateCreativeComponents(next);
  expect(findCreativeTarget(next,'300x600','label',['a','split']).values.display).toBe('none');
  expect(findCreativeTarget(next,'300x600','label',['b','split']).values.display).toBe('block');
  doc.sizes['300x600'].layers=[doc.sizes['300x250'].layers[0]];
  expect(()=>transferCreativeComponent(doc,{componentId:'component:badge',sourceSize:'300x250',destinations:[{size:'300x600',scope:'b'}]})).toThrow('incomplete');
 });
 it('moves and scales every internal arrangement without changing other versions',()=>{
  const doc=fixture();const next=updateComponentBounds(doc,'300x250','component:badge',['a','split'],{left:30,top:40,width:200,height:200});
  expect(findCreativeTarget(next,'300x250','label',['a','split']).values).toMatchObject({left:50,top:80,width:160,height:40});
  expect(findCreativeTarget(next,'300x250','label',['a','copy']).values).toMatchObject({left:50,top:120,width:160,height:100});
  expect(findCreativeTarget(next,'300x250','label',['b','copy']).values).toEqual(findCreativeTarget(doc,'300x250','label',['b','copy']).values);
 });
 it('keeps linked destination movement local while following later source design edits',()=>{
  const linked=createComponentLink(fixture(),{id:'l',name:'L',componentId:'component:badge',source:{size:'300x250',scope:'a'},destinations:[{size:'300x600',scope:'b'}],sizing:'destination'});
  const moved=updateComponentBounds(linked,'300x600','component:badge',['b','split'],{left:80,top:120,width:150,height:150});
  moved.sizes['300x250'].layers[1].base.fontSize=20;
  expect(componentBounds(moved,'300x600','component:badge',['b','copy'])).toMatchObject({left:80,top:120,width:150,height:150});
  expect(findCreativeTarget(moved,'300x600','label',['b','copy']).values.fontSize).toBe(30);
  expect(moved.componentLinks).toEqual(linked.componentLinks);
 });
 it('activates multiple inserted versions both in one transaction and sequentially',()=>{
  for(const sequential of [false,true]) {
    const doc=fixture();doc.sizes['300x600'].layers=[];doc.sizes['300x250'].variantRules[0].props.display='none';
    const args={componentId:'component:badge',sourceSize:'300x250',sourceScopes:['a'],destinations:[{size:'300x600',scope:'b'}]};
    const next=sequential?transferCreativeComponent(transferCreativeComponent(doc,args),{...args,destinations:[{size:'300x600',scope:'a'}]}):transferCreativeComponent(doc,{...args,destinations:[...args.destinations,{size:'300x600',scope:'a'}]});
    expect(findCreativeTarget(next,'300x600','label',['a','split']).values.display).toBe('block');
    expect(findCreativeTarget(next,'300x600','label',['b','split']).values.display).toBe('block');
    expect(findCreativeTarget(next,'300x600','label',['a','copy']).values.display).toBe('none');
    expect(findCreativeTarget(next,'300x600','label',['b','copy']).values.display).toBe('none');
  }
 });
 it('retains unitless numeric line-height even above four',()=>{
  const doc=fixture();doc.sizes['300x250'].layers[1].base.lineHeight=5;
  const next=transferCreativeComponent(doc,{componentId:'component:badge',sourceSize:'300x250',sourceScopes:['a'],destinations:[{size:'300x600',scope:'b'}]});
  expect(findCreativeTarget(next,'300x600','label',['b','split']).values.lineHeight).toBe(5);
 });
 it('resizes source-sized links locally and keeps following source design',()=>{
  const linked=createComponentLink(fixture(),{id:'l',name:'L',componentId:'component:badge',source:{size:'300x250',scope:'a'},destinations:[{size:'300x600',scope:'b'}],sizing:'source'});
  expect(componentBounds(linked,'300x600','component:badge',['b','split']).width).toBe(100);
  const resized=updateComponentBounds(linked,'300x600','component:badge',['b','split'],{left:70,top:90,width:200,height:200});
  resized.sizes['300x250'].layers[1].base.fontSize=30;
  expect(componentBounds(resized,'300x600','component:badge',['b','copy'])).toMatchObject({left:70,top:90,width:200,height:200});
  expect(findCreativeTarget(resized,'300x600','label',['b','copy']).values.fontSize).toBe(60);
 });
 it('transforms parent and nested parts independently of declaration order',()=>{
  const doc=JSON.parse(fs.readFileSync('src/test/fixtures/campaign/sse-dco-creative.json','utf8'));
  const parts=[{role:'value',targetId:'offer-slot-1::offer-value'},{role:'frame',targetId:'offer-slot-1'}];
  doc.componentDefinitions=[{id:'component:offer',name:'Offer',resize:'proportional',frameTargetId:'offer-slot-1',parts}];
  const args={componentId:'component:offer',sourceSize:'300x250',sourceScopes:['offers-1'],destinations:[{size:'300x600',scope:'offers-1'}],placements:{'300x600/offers-1':{left:60,top:100,width:180,height:90}}};
  const childFirst=transferCreativeComponent(doc,args);
  doc.componentDefinitions[0].parts=[...parts].reverse();
  const parentFirst=transferCreativeComponent(doc,args);
  expect(findCreativeTarget(childFirst,'300x600','offer-slot-1::offer-value',['offers-1']).values).toEqual(findCreativeTarget(parentFirst,'300x600','offer-slot-1::offer-value',['offers-1']).values);
 });
 it('links live source design and unlinks to an independent snapshot',()=>{
  const linked=createComponentLink(fixture(),{id:'badge-link',name:'Badge design',componentId:'component:badge',source:{size:'300x250',scope:'a.split'},destinations:[{size:'300x600',scope:'b.split'}],sizing:'destination'});
  expect(linked.componentLinks[0].source.scope).toBe('a');
  linked.sizes['300x250'].layers[1].base.fontSize=20;
  expect(findCreativeTarget(linked,'300x600','label',['b','copy']).values.fontSize).toBe(40);
  const detached=unlinkComponent(linked,'badge-link');detached.sizes['300x250'].layers[1].base.fontSize=10;
  expect(findCreativeTarget(detached,'300x600','label',['b','copy']).values.fontSize).toBe(40);
 });
 it('copying a linked version detaches only that intersection of a broad membership',()=>{
  const doc=createComponentLink(fixture(),{id:'l',name:'L',componentId:'component:badge',source:{size:'300x250',scope:'a'},destinations:[{size:'300x600',scope:''}],sizing:'destination'});
  const copied=transferCreativeComponent(doc,{componentId:'component:badge',sourceSize:'300x250',sourceScopes:['a'],destinations:[{size:'300x600',scope:'b'}]});
  copied.sizes['300x250'].layers[1].base.fontSize=30;
  expect(copied.componentLinks[0].destinations).toEqual([{size:'300x600',scope:'a'}]);
  expect(findCreativeTarget(copied,'300x600','label',['b','split']).values.fontSize).toBe(32);
  expect(findCreativeTarget(copied,'300x600','label',['a','split']).values.fontSize).toBe(60);
 });
 it('reuses materialized links and invalidates after in-place source changes',()=>{
  const doc=createComponentLink(fixture(),{id:'l',name:'L',componentId:'component:badge',source:{size:'300x250',scope:'a'},destinations:[{size:'300x600',scope:'b'}],sizing:'destination'});
  const first=materializeComponentLinks(doc);expect(materializeComponentLinks(doc)).toBe(first);
  doc.sizes['300x250'].layers[1].base.fontSize=21;
  expect(materializeComponentLinks(doc)).not.toBe(first);
  expect(findCreativeTarget(doc,'300x600','label',['b','split']).values.fontSize).toBe(42);
 });
 it('moves source-sized linked instances without changing their source dimensions',()=>{
  const doc=createComponentLink(fixture(),{id:'l',name:'L',componentId:'component:badge',source:{size:'300x250',scope:'a'},destinations:[{size:'300x600',scope:'b'}],sizing:'source'});
  const moved=updateComponentBounds(doc,'300x600','component:badge',['b','split'],{left:90,top:110,width:100,height:100});
  expect(componentBounds(moved,'300x600','component:badge',['b','copy'])).toMatchObject({left:90,top:110,width:100,height:100});
 });
 it('replaces destination links and rejects cycles',()=>{
  const link={id:'l',name:'L',componentId:'component:badge',source:{size:'300x250',scope:'a'},destinations:[{size:'300x600',scope:'b'}],sizing:'destination'};
  const doc=createComponentLink(fixture(),link);
  expect(createComponentLink(doc,{...link,id:'other'}).componentLinks.map(item=>item.id)).toEqual(['other']);
  expect(()=>createComponentLink(doc,{...link,id:'cycle',source:link.destinations[0],destinations:[link.source]})).toThrow();
 });
 it('keeps a component with no source text fitting inactive at the destination',()=>{
  const doc=JSON.parse(fs.readFileSync('src/test/fixtures/campaign/sse-dco-creative.json','utf8'));
  expect(effectiveTextFitForTarget(doc,'300x250','cta',['offers-1','cta-roundel'])).toEqual({});
  const next=transferCreativeComponent(doc,{componentId:'component:cta',sourceSize:'300x250',sourceScopes:['offers-1','cta-roundel'],destinations:[{size:'300x600',scope:'offers-1.cta-roundel'}]});
  expect(effectiveTextFitForTarget(next,'300x600','cta',['offers-1','cta-roundel']).disabled).toBe(true);
 });
 it('transfers SSE MPU split and copy-only without touching other offer counts or source JSON',()=>{
  const doc=JSON.parse(fs.readFileSync('src/test/fixtures/campaign/sse-dco-creative.json','utf8'));
  const next=transferCreativeComponent(doc,{componentId:'component:roundel',sourceSize:'300x250',sourceScopes:['offers-1','roundel-split','roundel-frame-on'],destinations:[{size:'300x600',scope:'offers-1.roundel-frame-on.roundel-split'}],sizing:'destination'});
  expect(next.sizes['300x250']).toEqual(doc.sizes['300x250']);
  for(const state of ['roundel-split','roundel-copy-only']) {
    const from=findCreativeTarget(doc,'300x250','roundel-copy',['offers-1','roundel-frame-on',state]);
    const to=findCreativeTarget(next,'300x600','roundel-copy',['offers-1','roundel-frame-on',state]);
    expect(to.fit.maxLines).toBe(from.fit.maxLines);
    expect(findCreativeTarget(next,'300x600','roundel-copy',['offers-2','roundel-frame-on',state])).toEqual(findCreativeTarget(doc,'300x600','roundel-copy',['offers-2','roundel-frame-on',state]));
  }
 });
});
