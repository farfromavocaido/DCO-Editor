// @vitest-environment jsdom
// @ts-nocheck
import React,{act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,test} from 'vitest';
import {CreativeInspector} from './CreativeInspector';
import {useEditorStore} from '@/store/editor-store';

test('component inspector renders geometry and drills into an individual part',async()=>{
 globalThis.React=React;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const doc={campaign:{id:'test'},clock:{durationS:8,beats:{}},feed:{sampleRows:[{}]},variantModel:{dimensions:[]},componentDefinitions:[{id:'component:badge',name:'Badge',resize:'proportional',frameTargetId:'disc',parts:[{role:'frame',targetId:'disc'},{role:'copy',targetId:'copy'}]}],sizes:{square:{canvas:{width:200,height:200},layers:[{id:'disc',label:'Disc',kind:'shape',base:{left:10,top:20,width:100,height:100},clips:[]},{id:'copy',label:'Label',kind:'text',base:{left:20,top:40,width:80,height:20},clips:[]}]}}};
 useEditorStore.setState({creativeDocument:doc,size:'square',activeCampaignId:'test',selectedLayerId:'disc',selectedTargetId:'component:badge',selectedTargetIds:['component:badge'],selectedClipId:'',feedDraft:{rows:[{}],selectedIndex:0},layoutDiagnostics:[],layoutAreaEdit:null,layoutPreview:null});
 const host=document.body.appendChild(document.createElement('div')),root=createRoot(host);
 try{
  await act(async()=>root.render(createElement(CreativeInspector)));
  expect(host.querySelector('h2')?.textContent).toBe('Badge');
  const labelButton=[...host.querySelectorAll('button')].find(b=>b.textContent?.includes('Label'));
  expect(labelButton).toBeTruthy();await act(async()=>labelButton.click());
  expect(useEditorStore.getState().selectedTargetId).toBe('copy');expect(host.querySelector('h2')?.textContent).toBe('Label');
 }finally{await act(async()=>root.unmount());host.remove();}
});
