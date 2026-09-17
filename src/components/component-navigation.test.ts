// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
const {state}=vi.hoisted(()=>({state:{row:{roundel_value_text:'999',include_roundel_frame_bool:true},creativeDocument:{sizes:{'300x250':{layers:['roundel-frame','roundel-copy','roundel-value'].map(id=>({id,label:id,kind:id==='roundel-frame'?'shape':'text',base:{left:0,top:0,width:100,height:100},clips:[]}))}}},size:'300x250',selectedTargetId:'roundel-copy',isolationPath:['component:roundel'],activeCampaignId:'sse-dco',feedDraft:{selectedIndex:0},setCanvasSelection:vi.fn(),updateSelectedFeedField:vi.fn(),setVariantControl:vi.fn()}}));
vi.mock('@/store/editor-store',()=>({useEditorStore:(select:any)=>select(state),selectPreviewFeedRow:()=>state.row}));
import {ComponentNavigation} from './ComponentNavigation';
let root:Root,container:HTMLElement;
async function render(){(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(React.createElement(ComponentNavigation)));}
const button=(text:string)=>Array.from(container.querySelectorAll('button')).find(el=>el.textContent===text)!;
afterEach(async()=>{await act(async()=>root?.unmount());container?.remove();vi.clearAllMocks();state.row={roundel_value_text:'999',include_roundel_frame_bool:true};});
it('switches the actual feed field and restores the remembered number',async()=>{
 await render();await act(async()=>button('Text only').click());expect(state.updateSelectedFeedField).toHaveBeenLastCalledWith('roundel_value_text','');
 state.row={...state.row,roundel_value_text:''};await act(async()=>root.render(React.createElement(ComponentNavigation)));
 await act(async()=>button('Text + number').click());expect(state.updateSelectedFeedField).toHaveBeenLastCalledWith('roundel_value_text','999');
});
it('requests a real value when none is available instead of fabricating export copy',async()=>{
 state.row={...state.row,roundel_value_text:''};await render();await act(async()=>button('Text + number').click());
 expect(state.updateSelectedFeedField).not.toHaveBeenCalled();expect(container.querySelector('input[aria-label="Layout value"]')).toBe(document.activeElement);
});
it('offers parent navigation and a direct part picker',async()=>{
 await render();expect(container.querySelector('select[aria-label="Component part"]')).not.toBeNull();
 await act(async()=>button('Roundel').click());expect(state.setCanvasSelection).toHaveBeenCalledWith('component:roundel',['component:roundel'],[]);
});
