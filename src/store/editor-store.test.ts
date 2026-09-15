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
