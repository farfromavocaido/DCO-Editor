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
