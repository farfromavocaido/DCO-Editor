// @vitest-environment jsdom
// @ts-nocheck
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,test} from 'vitest';
import {KeyframeMotionEditor} from './KeyframeMotionEditor';
import {useEditorStore} from '@/store/editor-store';
test('selected frame exposes editable timing and appearance; typing commits on blur and undo restores it',async()=>{
 globalThis.React=React;globalThis.IS_REACT_ACT_ENVIRONMENT=true;HTMLElement.prototype.scrollIntoView=()=>{};
 const clip={id:'motion',preset:'custom',keyframes:[{at:0,translate:[0,0],opacity:0},{at:50,translate:[10,20],opacity:1},{at:100,translate:[30,40],opacity:0}]};
 const doc={campaign:{id:'test'},variantModel:{dimensions:[]},clock:{durationS:10,beats:{}},sizes:{square:{canvas:{width:200,height:200},layers:[{id:'a',kind:'shape',base:{left:0,top:0,width:20,height:20},clips:[clip]}]}}};
 useEditorStore.setState({motionView:'keyframes',selectedTransition:null,creativeDocument:doc,size:'square',selectedLayerId:'a',selectedTargetId:'a',selectedTargetIds:['a'],selectedClipId:'motion',selectedKeyframe:{layerId:'a',clipId:'motion',index:1},percent:50,fieldEdit:null,history:[],historyIndex:-1,feedDraft:{rows:[{}],selectedIndex:0}});
 function Harness(){const d=useEditorStore(s=>s.creativeDocument);return React.createElement(KeyframeMotionEditor,{layer:d.sizes.square.layers[0],clip:d.sizes.square.layers[0].clips[0],beats:{},canvas:{width:200,height:200},durationS:10});}
 const host=document.body.appendChild(document.createElement('div')),root=createRoot(host);
 try{await act(async()=>root.render(React.createElement(Harness)));const input=host.querySelector('[aria-label="Keyframe time (s)"]');
  await act(async()=>{input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'6.25');input.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(useEditorStore.getState().creativeDocument).toEqual(doc);
  expect(host.querySelector('[aria-label="Frame width"]').value).toBe('');
  expect(host.querySelector('[aria-label="Frame width"]').placeholder).toBe('Use layout');
  await act(async()=>input.blur());expect(useEditorStore.getState().creativeDocument.sizes.square.layers[0].clips[0].keyframes[1].at).toEqual({value:6.25,unit:'seconds'});
  await act(async()=>useEditorStore.getState().undo());expect(useEditorStore.getState().creativeDocument).toEqual(doc);
  await act(async()=>useEditorStore.getState().selectKeyframe('a','motion',2,100));
  expect(host.querySelector('[aria-label="Keyframe easing"]')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});
