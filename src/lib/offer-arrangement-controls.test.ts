// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,test} from 'vitest';
import {OfferArrangementControls} from '@/components/OfferArrangementControls';
import {selectPreviewFeedRow,useEditorStore} from '@/store/editor-store';
import {beginProductionStage,publishProductionStage} from './production-stage';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const roots:ReturnType<typeof createRoot>[]=[];
afterEach(()=>{for(const root of roots.splice(0))act(()=>root.unmount());document.body.innerHTML='';beginProductionStage('');});

test.each([false,true])('manual arrangement requires its exact ready source (stale=%s) and creates one undoable transaction',async stale=>{
 const size='300x250';const creative={sizes:{[size]:{canvas:{width:300,height:250},layers:[{id:'offer-slot-1',kind:'group',base:{left:5,top:10,width:200,height:60},clips:[]}],classRules:[{cssClass:'offer-subline',properties:{left:70,top:9,width:100,height:20}}]}}};
 useEditorStore.setState({creativeDocument:creative,size,previewRenderMode:'font',offerCount:1,tcMode:'tcs_units',history:[],historyIndex:-1,feedDraft:{rows:[{}],selectedIndex:0}});
 document.body.innerHTML='<main class="stage motion-ready" data-size="300x250" data-preview-render-mode="font"><div id="offer1" data-gwd-group="OfferSlot" style="position:absolute;left:18px;top:12px"><p class="offer-subline" style="position:absolute;left:61px;top:9px">OFF</p></div></main><div id="controls"></div>';
 Object.defineProperty(document,'getAnimations',{configurable:true,value:()=>[]});
 const stage=document.querySelector<HTMLElement>('.stage')!;const source={document:creative,row:selectPreviewFeedRow(useEditorStore.getState())};beginProductionStage(size);publishProductionStage(stage,stale?{document:{},row:{}}:source);
 const root=createRoot(document.querySelector('#controls')!);roots.push(root);
 act(()=>root.render(createElement(OfferArrangementControls,{document:creative,size,target:{id:'offer-slot-1::offer-subline'},scopes:useEditorStore.getState().activeScopes()})));
 await act(async()=>{const control=document.querySelector<HTMLSelectElement>('[aria-label="Active offer arrangement"]')!;control.value='manual';control.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,80));});
 if(stale){
  expect(useEditorStore.getState().history).toHaveLength(0);
  (stage.querySelector('.offer-subline') as HTMLElement).style.left='83px';
  await act(async()=>{publishProductionStage(stage,source);await new Promise(resolve=>setTimeout(resolve,80));});
 }
 const state=useEditorStore.getState();
 expect(document.querySelector('[role="alert"]')).toBeNull();
 expect(state.history).toHaveLength(1);
 const subline=state.creativeDocument.sizes[size].localOverrides.find(item=>item.targetId.endsWith('::offer-subline'));
 expect(subline.values).toMatchObject({left:stale?83:61,top:9});
 const slot=state.creativeDocument.sizes[size].localOverrides.find(item=>item.targetId==='offer-slot-1');
 expect(slot.values).toMatchObject({left:18,top:12,'--offer-layout-mode':'manual'});
 act(()=>state.undo());expect(useEditorStore.getState().creativeDocument).toEqual(creative);
});
