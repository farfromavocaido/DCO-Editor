import { test } from 'vitest';
import assert from 'node:assert/strict';

import { useEditorStore } from './editor-store';

const mpuTripleDoc = {
  version: 1,
  sizes: {
    '300x250': {
      canvas: { width: 300, height: 250 },
      layers: [
        { id: 'offer-slot-1', kind: 'group', base: { cssClass: 'offer-slot-1' }, clips: [{ id: 'slot-1-in', preset: 'fadeIn' }] },
        { id: 'plus-1', kind: 'text', base: { cssClass: 'plus-1' }, clips: [{ id: 'plus-1-in', preset: 'fadeIn' }] },
        { id: 'offer-slot-2', kind: 'group', base: { cssClass: 'offer-slot-2' }, clips: [{ id: 'slot-2-in', preset: 'fadeIn' }] },
        { id: 'plus-2', kind: 'text', base: { cssClass: 'plus-2' }, clips: [{ id: 'plus-2-in', preset: 'fadeIn' }] },
        { id: 'offer-slot-3', kind: 'group', base: { cssClass: 'offer-slot-3' }, clips: [{ id: 'slot-3-in', preset: 'fadeIn' }] },
      ],
      variantRules: [
        { id: 'offers-3|plus-2', scope: 'offers-3', layerId: 'plus-2', cssClass: 'plus-2', props: { visibility: 'hidden' }, editable: true },
      ],
    },
  },
};

test('selectTimelineLayer selects hidden offer members without entering offer block isolation', () => {
  useEditorStore.setState({
    creativeDocument: mpuTripleDoc,
    size: '300x250',
    offerCount: 3,
    tcMode: 'solo',
    ctaShape: 'roundel',
    selectedLayerId: '',
    selectedTargetId: '',
    selectedTargetIds: [],
    isolatedGroupId: '',
    isolationPath: [],
    selectedClipId: '',
  });

  useEditorStore.getState().selectTimelineLayer('plus-2');

  const state = useEditorStore.getState();
  assert.equal(state.selectedLayerId, 'plus-2');
  assert.equal(state.selectedTargetId, 'plus-2');
  assert.deepEqual(state.selectedTargetIds, ['plus-2']);
  assert.equal(state.isolatedGroupId, '');
  assert.deepEqual(state.isolationPath, []);
});

test('reconcileOfferSelection leaves non-offer layers selected after feed sync', () => {
  useEditorStore.setState({
    creativeDocument: {
      version: 1,
      sizes: {
        '970x250': {
          canvas: { width: 970, height: 250 },
          layers: [
            { id: 'roundel-value', kind: 'text', base: { cssClass: 'roundel-value' }, clips: [] },
            { id: 'offer-slot-1', kind: 'group', base: { cssClass: 'offer-slot-1' }, clips: [] },
            { id: 'offer-slot-2', kind: 'group', base: { cssClass: 'offer-slot-2' }, clips: [] },
            { id: 'offer-slot-3', kind: 'group', base: { cssClass: 'offer-slot-3' }, clips: [] },
          ],
          variantRules: [],
        },
      },
    },
    size: '970x250',
    offerCount: 3,
    tcMode: 'tcs_only',
    ctaShape: 'rectangle',
    includeRoundelFrame: true,
    frameCount: 4,
    roundelMode: 'split',
    selectedLayerId: 'roundel-value',
    selectedTargetId: 'roundel-value',
    selectedTargetIds: ['roundel-value'],
    isolatedGroupId: '',
    isolationPath: [],
    selectedClipId: '',
  });

  useEditorStore.getState().reconcileOfferSelection();

  const state = useEditorStore.getState();
  assert.equal(state.selectedLayerId, 'roundel-value');
  assert.equal(state.selectedTargetId, 'roundel-value');
  assert.deepEqual(state.selectedTargetIds, ['roundel-value']);
});

test('reconcileOfferSelection still drops inactive offer members when offer count shrinks', () => {
  useEditorStore.setState({
    creativeDocument: {
      ...mpuTripleDoc,
      sizes: {
        '300x250': {
          ...mpuTripleDoc.sizes['300x250'],
          variantRules: [
            {
              id: 'offers-2|offer-slot-3|visibility',
              scope: 'offers-2',
              layerId: 'offer-slot-3',
              cssClass: 'offer-slot-3',
              props: { visibility: 'hidden' },
            },
          ],
        },
      },
    },
    size: '300x250',
    offerCount: 2,
    tcMode: 'solo',
    ctaShape: 'roundel',
    includeRoundelFrame: false,
    frameCount: 3,
    roundelMode: 'copy-only',
    selectedLayerId: 'offer-slot-3',
    selectedTargetId: 'offer-slot-3',
    selectedTargetIds: ['offer-slot-1', 'offer-slot-2', 'offer-slot-3'],
    isolatedGroupId: '',
    isolationPath: [],
    selectedClipId: '',
  });

  useEditorStore.getState().reconcileOfferSelection();

  const state = useEditorStore.getState();
  assert.ok(!state.selectedTargetIds.includes('offer-slot-3'));
  assert.ok(state.selectedTargetIds.includes('offer-slot-1'));
  assert.ok(state.selectedTargetIds.includes('offer-slot-2'));
});

test('setResizeMode exposes explicit frame and scale handle modes', () => {
  useEditorStore.setState({ resizeMode: 'frame' });

  useEditorStore.getState().setResizeMode('scale');
  assert.equal(useEditorStore.getState().resizeMode, 'scale');

  useEditorStore.getState().setResizeMode('frame');
  assert.equal(useEditorStore.getState().resizeMode, 'frame');

  useEditorStore.getState().setResizeMode('unexpected');
  assert.equal(useEditorStore.getState().resizeMode, 'frame');
});

test('timeline edits to named clip boundaries update the active frame timing profile', () => {
  const doc = {
    version: 1,
    clock: {
      durationS: 15,
      beats: { swap: 65, end: 100 },
      profiles: {
        'frames-3': { swap: 65, end: 100 },
        'frames-4': { swap: 56.7, roundel_in: 56.7, end: 100 },
      },
    },
    sizes: {
      '300x250': {
        canvas: { width: 300, height: 250 },
        layers: [
          {
            id: 'headline-act3',
            kind: 'text',
            base: { cssClass: 'headline-act3' },
            clips: [{ id: 'headline-act3-slideInRight', preset: 'slideInRight', start: 'swap', end: 'end' }],
          },
        ],
      },
    },
  };

  useEditorStore.setState({
    creativeDocument: doc,
    size: '300x250',
    offerCount: 1,
    tcMode: 'tcs_only',
    ctaShape: 'roundel',
    includeRoundelFrame: true,
    frameCount: 4,
    roundelMode: 'split',
    history: [],
    historyIndex: -1,
  });

  useEditorStore.getState().updateCreativeLayerClipValue('headline-act3', 'headline-act3-slideInRight', 'start', 60);

  const next = useEditorStore.getState().creativeDocument;
  assert.equal(next.sizes['300x250'].layers[0].clips[0].start, 'swap');
  assert.equal(next.clock.profiles['frames-4'].swap, 60);
  assert.equal(next.clock.profiles['frames-3'].swap, 65);
});

test('active fit undo restores the exact document without leaving an inherited override', () => {
  const doc = {version:1,sizes:{'300x250':{canvas:{width:300,height:250},layers:[{id:'terms',kind:'text',base:{fontSize:6},fit:{maxLines:4},clips:[]}],variantRules:[{id:'zero',layerId:'terms',scope:'offers-0',props:{top:210},fit:{minFontSize:10}}]}}};
  useEditorStore.setState({creativeDocument:doc,size:'300x250',offerCount:0,history:[],historyIndex:-1});
  useEditorStore.getState().updateCreativeTargetFitValue('terms','maxLines',2);
  useEditorStore.getState().undo();
  assert.deepEqual(useEditorStore.getState().creativeDocument,doc);
  useEditorStore.getState().redo();
  assert.equal(useEditorStore.getState().creativeDocument.sizes['300x250'].variantRules[0].fit.maxLines,2);
});

test('named ownership membership edits undo and redo atomically', () => {
 const doc = {version:1,sizes:{'300x250':{canvas:{width:300,height:250},layers:[{id:'terms',kind:'text',base:{fontSize:6},fit:{maxLines:4},clips:[]}]}}};
 const next = {...doc,sharedDefinitions:[{id:'legal',name:'Legal',fit:{maxLines:2},members:[{size:'300x250',targetId:'terms'}]}]};
 useEditorStore.setState({creativeDocument:doc,size:'300x250',history:[],historyIndex:-1});
 useEditorStore.getState().applyCreativeOwnershipDocument(next);
 useEditorStore.getState().undo();
 assert.deepEqual(useEditorStore.getState().creativeDocument,doc);
 useEditorStore.getState().redo();
 assert.deepEqual(useEditorStore.getState().creativeDocument,next);
});

test('virtual group move edits local geometry, keeps clips, and undoes atomically', () => {
 const doc = {version:1,sizes:{'300x250':{canvas:{width:300,height:250},layers:[{id:'a',kind:'text',base:{left:5,top:10,width:20,height:20},clips:[{id:'a-in',preset:'fade'}]},{id:'b',kind:'text',base:{left:35,top:10,width:20,height:20},clips:[{id:'b-in',preset:'fadeUp',params:{enter_dy:20}}]}]}}};
 useEditorStore.setState({creativeDocument:doc,size:'300x250',offerCount:0,selectedTargetId:'a',selectedLayerId:'a',selectedTargetIds:['a','b'],history:[],historyIndex:-1});
 useEditorStore.getState().groupSelectedCanvasTargets('Copy group');
 const grouped = useEditorStore.getState().creativeDocument;
 const groupId = useEditorStore.getState().selectedTargetId;
 assert.ok(groupId.startsWith('canvas-group:'));
 assert.equal(useEditorStore.getState().selectedLayerId,'a');
 useEditorStore.getState().nudgeSelectedTarget(3,4);
 assert.deepEqual(useEditorStore.getState().creativeDocument.sizes['300x250'].layers,doc.sizes['300x250'].layers);
 useEditorStore.getState().undo();
 assert.deepEqual(useEditorStore.getState().creativeDocument,grouped);
 useEditorStore.getState().ungroupSelectedCanvasTargets();
 assert.deepEqual(useEditorStore.getState().creativeDocument.sizes['300x250'].canvasGroups,[]);
 useEditorStore.getState().undo();
 assert.deepEqual(useEditorStore.getState().creativeDocument,grouped);
});

test('virtual group alignment undo removes newly authored local coordinates', () => {
 const doc = {version:1,sizes:{'300x250':{canvas:{width:300,height:250},canvasGroups:[{id:'canvas-group:test',name:'Test',members:['a','b']}],layers:[{id:'a',kind:'shape',base:{left:10,top:10,width:20,height:20},clips:[]},{id:'b',kind:'shape',base:{left:40,top:10,width:20,height:20},clips:[]}]}}};
 useEditorStore.setState({creativeDocument:doc,size:'300x250',offerCount:0,selectedTargetId:'canvas-group:test',selectedLayerId:'a',selectedTargetIds:['canvas-group:test'],history:[],historyIndex:-1});
 useEditorStore.getState().alignSelectedTarget('left');
 assert.ok(useEditorStore.getState().creativeDocument.sizes['300x250'].localOverrides?.length);
 useEditorStore.getState().undo();
 assert.deepEqual(useEditorStore.getState().creativeDocument,doc);
});

test('fixed-copy export uses active effective row while font export preserves every row', async () => {
  const { selectPreviewFeedRow, creativeDocumentForExport } = await import('./editor-store');
  const rows = [
    {Unique_ID:'default',Default:true,offer_count_num:1,heading1_text:'Default headline'},
    {Unique_ID:'active',Default:false,offer_count_num:3,heading1_text:'Active headline',heading1_text_300x250:'MPU active'},
  ];
  const state = {creativeDocument:{feed:{sampleRows:rows},sizes:{}}, feedDraft:{rows,selectedIndex:1}, offerCount:3,tcMode:'tcs_units',ctaShape:'rectangle',includeRoundelFrame:true,frameCount:4,roundelMode:'split',navyHeadlines:false};
  const row = selectPreviewFeedRow(state);
  assert.equal(row.Unique_ID,'active');
  assert.equal(row.tc_type_enum,'tcs_units');
  assert.equal(row.include_roundel_frame_bool,true);
  assert.equal(selectPreviewFeedRow({...state,size:'970x250',percent:80}),row,'unrelated editor changes keep selector reference stable');
  const outlined = creativeDocumentForExport(state,'outline');
  assert.deepEqual(outlined.feed.sampleRows,[{...row,Default:true}]);
  assert.equal(outlined.feed.sampleRows[0].heading1_text_300x250,'MPU active');
  assert.deepEqual(creativeDocumentForExport(state,'font').feed.sampleRows,rows);
  assert.equal(rows[0].Default,true);assert.equal(rows[1].Default,false);
});

test('snapshot source identity rejects source changes but allows internal size walking', async () => {
  const { outlineSnapshotSource, assertOutlineSnapshotSource } = await import('./editor-store');
  const rows = [{Unique_ID:'a',offer_count_num:1}];
  const state = {activeCampaignId:'a',creativeDocument:{sizes:{}},feedDraft:{rows,selectedIndex:0},offerCount:1};
  const source = outlineSnapshotSource(state);
  assert.doesNotThrow(()=>assertOutlineSnapshotSource(source,{...state,size:'300x250',percent:55}));
  assert.throws(()=>assertOutlineSnapshotSource(source,{...state,creativeDocument:{sizes:{}}}),/changed during/);
  assert.throws(()=>assertOutlineSnapshotSource(source,{...state,offerCount:3}),/changed during/);
  assert.throws(()=>assertOutlineSnapshotSource(source,{...state,activeCampaignId:'b'}),/changed during/);
});

test('every fixed-copy download posts only the selected row', async () => {
  const original = useEditorStore.getState();
  const originalFetch = globalThis.fetch;
  const rows = [{Default:true,offer_count_num:1,heading1_text:'first'}, {Default:false,offer_count_num:3,heading1_text:'chosen'}];
  const payloads: Array<{document:{feed:{sampleRows:Array<Record<string, unknown>>}}}> = [];
  try {
    useEditorStore.setState({creativeDocument:{feed:{sampleRows:rows},sizes:{}},feedDraft:{rows,selectedIndex:1},offerCount:3,tcMode:'tcs_units',ctaShape:'rectangle',includeRoundelFrame:false,frameCount:3,
      prepareExportPreview:async(renderMode: string)=>{useEditorStore.setState({previewRenderMode:renderMode});return useEditorStore.getState();},
      captureOutlineSnapshotsForAllSizes:async()=>({})});
    globalThis.fetch = async (_url, options) => {
      payloads.push(JSON.parse(String(options?.body || '{}')));
      return new Response(JSON.stringify({error:'test stops before file download'}),{status:400,headers:{'content-type':'application/json'}});
    };
    for (const method of ['buildHtml','exportClientPackage','exportBasePackage']) {
      useEditorStore.setState({previewRenderMode:'font'});
      await assert.rejects(useEditorStore.getState()[method]({renderMode:'outline'}),/test stops/);
      assert.equal(useEditorStore.getState().previewRenderMode,'outline');
    }
    assert.equal(payloads.length,3);
    for (const payload of payloads) {
      assert.equal(payload.document.feed.sampleRows.length,1);
      assert.equal(payload.document.feed.sampleRows[0].heading1_text,'chosen');
      assert.equal(payload.document.feed.sampleRows[0].offer_count_num,3);
      assert.equal(payload.document.feed.sampleRows[0].Default,true);
    }
  } finally { globalThis.fetch=originalFetch;useEditorStore.setState(original,true); }
});

test('group creation undo and redo restore document and valid selection together', () => {
 const doc={version:1,sizes:{'300x250':{canvas:{width:300,height:250},layers:[
  {id:'a',kind:'shape',base:{left:5,top:10,width:20,height:20},clips:[{id:'a-in',preset:'fade'},{id:'a-out',preset:'fade'}]},
  {id:'b',kind:'shape',base:{left:35,top:10,width:20,height:20},clips:[]},
 ]}}};
 useEditorStore.setState({creativeDocument:doc,size:'300x250',offerCount:0,selectedTargetId:'a',selectedLayerId:'a',selectedTargetIds:['a','b'],selectedClipId:'a-out',isolationPath:[],isolatedGroupId:'',history:[],historyIndex:-1});
 useEditorStore.getState().groupSelectedCanvasTargets('Pair');
 const groupId=useEditorStore.getState().selectedTargetId;
 assert.equal(useEditorStore.getState().selectedTarget().kind,'group');
 useEditorStore.getState().undo();
 const undone=useEditorStore.getState();
 assert.deepEqual(undone.creativeDocument,doc);
 assert.equal(undone.selectedTargetId,'a');
 assert.deepEqual(undone.selectedTargetIds,['a','b']);
 assert.equal(undone.selectedLayerId,'a');
 assert.equal(undone.selectedClipId,'a-out');
 assert.equal(undone.selectedTarget().kind,'multi');
 useEditorStore.getState().redo();
 const redone=useEditorStore.getState();
 assert.equal(redone.selectedTargetId,groupId);
 assert.deepEqual(redone.selectedTargetIds,[groupId]);
 assert.equal(redone.selectedTarget().kind,'group');
 assert.deepEqual(redone.selectedTarget().members,['a','b']);
});

test('mixed selection ungroup retains other targets and restores all groups on undo', () => {
 const groups=[{id:'canvas-group:first',name:'First',members:['a','b']},{id:'canvas-group:second',name:'Second',members:['c','d']}];
 const doc={version:1,sizes:{'300x250':{canvas:{width:300,height:250},canvasGroups:groups,layers:['a','b','c','d','e'].map((id,index)=>({id,kind:'shape',base:{left:index*25,top:10,width:20,height:20},clips:[]}))}}};
 const ids=['canvas-group:first','e','canvas-group:second'];
 useEditorStore.setState({creativeDocument:doc,size:'300x250',offerCount:0,selectedTargetId:'e',selectedLayerId:'e',selectedTargetIds:ids,selectedClipId:'',isolationPath:[],isolatedGroupId:'',history:[],historyIndex:-1});
 useEditorStore.getState().ungroupSelectedCanvasTargets();
 const ungrouped=useEditorStore.getState();
 assert.deepEqual(ungrouped.creativeDocument.sizes['300x250'].canvasGroups,[]);
 assert.deepEqual(ungrouped.selectedTargetIds,['a','b','e','c','d']);
 assert.equal(ungrouped.selectedTargetId,'e');
 assert.deepEqual(ungrouped.selectedTarget().members,['a','b','e','c','d']);
 useEditorStore.getState().undo();
 const undone=useEditorStore.getState();
 assert.deepEqual(undone.creativeDocument,doc);
 assert.deepEqual(undone.selectedTargetIds,ids);
 assert.equal(undone.selectedTargetId,'e');
 assert.ok(undone.selectedTarget().bounds);
 useEditorStore.getState().redo();
 assert.deepEqual(useEditorStore.getState().selectedTargetIds,['a','b','e','c','d']);
 assert.deepEqual(useEditorStore.getState().creativeDocument.sizes['300x250'].canvasGroups,[]);
 assert.ok(useEditorStore.getState().selectedTarget().bounds);
});
