// @vitest-environment jsdom
// @ts-nocheck
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,test,vi} from 'vitest';
import {LayoutAreaPanel} from './LayoutAreaPanel';
import {LayoutAreaOverlay} from './LayoutAreaOverlay';
import {useEditorStore} from '@/store/editor-store';

test('draft survives deselection, outline hides, and validation waits for Apply',async()=>{
 globalThis.React=React;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.requestAnimationFrame=cb=>{cb();return 0;};HTMLElement.prototype.scrollIntoView=vi.fn();
 const rule={id:'area',name:'Area',type:'distribute',enabled:true,targets:[{size:'test',targetId:'logo'}],areas:{test:{left:0,top:0,width:100,height:100}},axis:'y',single:'center',crossAlign:'center',minGap:0,overflow:'authored',layoutAnimations:[]};
 const doc={campaign:{id:'test'},variantModel:{dimensions:[]},clock:{durationS:10,loop:true},sizes:{test:{canvas:{width:100,height:100},layers:[{id:'logo',label:'Logo',kind:'image',base:{left:0,top:0,width:10,height:10},clips:[]}]}},layoutRules:[rule],feed:{sampleRows:[{}]}};
 useEditorStore.setState({activeCampaignId:'test',creativeDocument:doc,size:'test',layoutAreaEdit:null,layoutAreaDraft:null,layoutPreview:null,feedDraft:{rows:[{}],selectedIndex:0},selectedLayoutRuleId:'area'});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn();
 const render=()=>React.createElement(React.Fragment,null,React.createElement(LayoutAreaPanel,{document:doc,size:'test',targetIds:['logo'],scopes:[],diagnostics:[],onChange:change}),React.createElement(LayoutAreaOverlay,{document:doc,size:'test',scale:1}));
 try{
  await act(async()=>root.render(render()));
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Edit area').click());
  expect(useEditorStore.getState().layoutPreview).toBeTruthy();
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='+ Add animation').click());
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(useEditorStore.getState().layoutAreaEdit.rule.layoutAnimations).toHaveLength(1);
  await act(async()=>{useEditorStore.setState({selectedLayoutRuleId:null});root.render(React.createElement(LayoutAreaOverlay,{document:doc,size:'test',scale:1}));});
  expect(host.querySelector('.layout-area-outline')).toBeNull();
  expect(useEditorStore.getState().layoutPreview).toBeTruthy();
  await act(async()=>root.render(render()));
  expect(host.querySelector('form')).toBeTruthy();expect(host.querySelector('[role="alert"]')).toBeNull();
  await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(host.querySelector('[role="alert"]').textContent).toContain('Cannot apply layout');expect(change).not.toHaveBeenCalled();
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Cancel').click());
  expect(useEditorStore.getState().layoutAreaEdit).toBeNull();expect(useEditorStore.getState().layoutPreview).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});
