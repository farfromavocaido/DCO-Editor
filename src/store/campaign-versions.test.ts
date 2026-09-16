// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {selectPreviewFeedRow,useEditorStore} from './editor-store';
const original=useEditorStore.getState();
afterEach(()=>{vi.unstubAllGlobals();useEditorStore.setState(original,true);});
const doc:any={campaign:{id:'product-demo'},variantModel:{dimensions:[{id:'language',label:'Language',field:'language',defaultValue:'en',options:[{value:'en',label:'English',scope:'lang-en'},{value:'ga',label:'Irish',scope:'lang-ga'}]}]},sizes:{'300x250':{layers:[]}},feed:{sampleRows:[]}};
it('generic preview rows remain arbitrary campaign data without injecting SSE fields',()=>{
 const row={language:'ga',title:'Dia duit'};
 const state:any={creativeDocument:doc,feedDraft:{rows:[row],selectedIndex:0},offerCount:3};
 expect(selectPreviewFeedRow(state)).toBe(row);
 expect(selectPreviewFeedRow(state)).not.toHaveProperty('offer_count_num');
});
it('campaign controls choose matching samples without altering saved documents or feed content',()=>{
 const rows=[{language:'en',title:'Hello'},{language:'ga',title:'Dia duit'}];
 useEditorStore.setState({creativeDocument:doc,feedDraft:{rows,selectedIndex:0},saveFeedDisabled:true});
 useEditorStore.getState().setVariantControl('language','ga');
 expect(useEditorStore.getState().feedDraft.selectedIndex).toBe(1);
 expect(useEditorStore.getState().feedDraft.rows).toBe(rows);
 expect(useEditorStore.getState().activeScopes()).toEqual(['lang-ga']);
 expect(useEditorStore.getState().saveFeedDisabled).toBe(true);
});
it('a previous campaign load cannot overwrite a newer switch, including A-B-A',async()=>{
 let resolve:any;
 vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));
 useEditorStore.setState({activeCampaignId:'sse-dco',campaignLoadGeneration:1,creativeDocument:doc});
 const pending=useEditorStore.getState().loadCreativeDocument();
 useEditorStore.setState({activeCampaignId:'sse-dco',campaignLoadGeneration:3});
 resolve({ok:true,json:async()=>({campaign:{id:'sse-dco'},sizes:{}})});
 await pending;
 expect(useEditorStore.getState().creativeDocument).toBe(doc);
});

it('selecting a missing generic version preserves the source and creates a separate draft row',()=>{
 const row={language:'en',title:'Original',Unique_ID:'original',Default:true};
 useEditorStore.setState({creativeDocument:doc,feedDraft:{rows:[row],selectedIndex:0},saveFeedDisabled:true});
 useEditorStore.getState().setVariantControl('language','ga');
 const draft=useEditorStore.getState().feedDraft;
 expect(draft.rows[0]).toBe(row);
 expect(draft.rows).toHaveLength(2);
 expect(draft.selectedIndex).toBe(1);
 expect(draft.rows[1]).toMatchObject({language:'ga',title:'Original',Default:false});
 expect(draft.rows[1].Unique_ID).not.toBe('original');
});
