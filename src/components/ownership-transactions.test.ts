// @vitest-environment jsdom
// @ts-nocheck
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCreativeOwnershipDefinition } from '@/lib/creative-ownership';
import { findCreativeTarget } from '@/lib/creative-model';
const {state} = vi.hoisted(() => ({state:{percent:19,applyCreativeOwnershipDocument:vi.fn(),undo:vi.fn()}}));
vi.mock('@/store/editor-store', () => ({useEditorStore: selector => selector(state),selectPreviewFeedRow: () => ({audience:'home'})}));
vi.mock('./OwnershipProductionPreview', () => ({OwnershipProductionPreview: ({label}) => React.createElement('div',null,label)}));
import { CreativeOwnershipControls } from './CreativeOwnershipControls';
const fixture = () => ({variantModel:{dimensions:[{id:'audience',label:'Audience',field:'audience',defaultValue:'home',options:[{value:'home',label:'Home',scope:'audience-home'},{value:'business',label:'Business',scope:'audience-business'}]}]},feed:{sampleRows:[{audience:'home'}]},sizes:{'300x250':{layers:[{id:'title',kind:'text',base:{fontSize:20,left:10},fit:{maxLines:2},clips:[]}],variantRules:[]}}});
let root,container;
const button = label => [...document.querySelectorAll('button')].find(item => item.textContent === label);
const click = async element => act(async () => element.click());
afterEach(async () => {if(root)await act(async()=>root.unmount());container?.remove();vi.clearAllMocks();});
describe('relationship transactions', () => {
 it('closes after explicit apply, offers undo, and resets selections on reopening', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const doc=fixture();container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async () => root.render(React.createElement(CreativeOwnershipControls,{document:doc,size:'300x250',target:findCreativeTarget(doc,'300x250','title',['audience-home']),scopes:['audience-home']})));
  await click(button('Copy to…'));
  expect(document.querySelector('[role=dialog]')).not.toBeNull();
  expect(button('Apply copy to 1 versions').disabled).toBe(true);
  const font = [...document.querySelectorAll('label')].find(label => label.textContent.startsWith('Font size'));
  await click(font.querySelector('input'));
  expect(button('Apply copy to 1 versions').disabled).toBe(false);
  await click(button('Apply copy to 1 versions'));
  expect(state.applyCreativeOwnershipDocument).toHaveBeenCalledOnce();
  expect(document.querySelector('[role=dialog]')).toBeNull();
  expect(button('Undo')).toBeDefined();
  await click(button('Copy to…'));
  expect([...document.querySelectorAll('.relationship-property input')].every(input=>!input.checked)).toBe(true);
  expect(button('Apply copy to 1 versions').disabled).toBe(true);
  await click(button('Cancel'));
  await click(button('Undo'));
  expect(state.undo).toHaveBeenCalledOnce();
 });
 it('unlinks without changing the effective appearance or keeping a live relationship', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const member={size:'300x250',targetId:'title',scope:'audience-home'};
  const doc=createCreativeOwnershipDefinition(fixture(),{id:'type',name:'Typography',values:{fontSize:38},members:[member]});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async () => root.render(React.createElement(CreativeOwnershipControls,{document:doc,size:'300x250',target:findCreativeTarget(doc,'300x250','title',['audience-home']),scopes:['audience-home']})));
  expect(button('Edit shared…')).toBeDefined();
  await click(button('Unlink — keep appearance'));
  const next=state.applyCreativeOwnershipDocument.mock.calls[0][0];
  expect(findCreativeTarget(next,'300x250','title',['audience-home']).values.fontSize).toBe(38);
  expect(next.sharedDefinitions[0].members).toHaveLength(0);
 });
 it('cancel leaves document untouched and linked controls are separate', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const doc=fixture();container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async () => root.render(React.createElement(CreativeOwnershipControls,{document:doc,size:'300x250',target:findCreativeTarget(doc,'300x250','title',['audience-home']),scopes:['audience-home']})));
  expect(document.body.textContent).toContain('Linked properties');
  await click(button('Link properties…'));
  expect(button('Apply link to 1 versions').disabled).toBe(true);
  await click(button('Cancel'));
  expect(state.applyCreativeOwnershipDocument).not.toHaveBeenCalled();
 });
});
