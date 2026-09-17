// @vitest-environment jsdom
// @ts-nocheck
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
const {apply}=vi.hoisted(()=>({apply:vi.fn()}));
vi.mock('@/store/editor-store',()=>({useEditorStore:{getState:()=>({applyCreativeOwnershipDocument:apply})}}));
import {CampaignStateController} from './CampaignStateController';
let root,host;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();vi.clearAllMocks();});
const click=async(text)=>act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent===text).click());
it('keeps draft edits local and applies configuration as one undo transaction',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const document={variantModel:{dimensions:[]},sizes:{},feed:{sampleRows:[]}};
 host=window.document.createElement('div');window.document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(React.createElement(CampaignStateController,{document})));
 await click('Add state');expect(apply).not.toHaveBeenCalled();
 await click('Apply states');expect(apply).toHaveBeenCalledOnce();
 expect(apply.mock.calls[0][0].variantModel.dimensions).toHaveLength(1);
 expect(document.variantModel.dimensions).toHaveLength(0);
});
it('legacy manager remains an adapter configuration and retains existing hidden controls',async()=>{
 const document={variantPresentation:{hidden:['tcMode']},sizes:{},feed:{sampleRows:[]}};
 host=window.document.createElement('div');window.document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(React.createElement(CampaignStateController,{document})));
 expect([...host.querySelectorAll('button')].some(b=>b.textContent==='Add state')).toBe(false);
 await click('Apply states');expect(apply).toHaveBeenCalledOnce();
 const next=apply.mock.calls[0][0];expect(next.variantModel).toBeUndefined();expect(next.campaignState.dimensions.length).toBe(7);expect(next.variantPresentation.hidden).toContain('tcMode');
});
