import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  OFFERS_BLOCK_ID,
  dragTargetIdsForSelection,
  filterManipulationTargetIds,
  getGroupCanvasBounds,
  isolatedDrillHierarchy,
  linkedTargetIdsForSelection,
  offerBlockLayerIds,
  resolveSelectionMeta,
  selectionHierarchy,
  targetMatchesSelection,
} from '@/lib/selection-groups';
import { targetIdForLayerChild } from '@/lib/creative-model';

test('selectionHierarchy drills from offers block to nested value in dual layouts', () => {
  const valueId = targetIdForLayerChild('offer-slot-2', 'offer-value');
  assert.deepEqual(selectionHierarchy(valueId, 2), [
    OFFERS_BLOCK_ID,
    'offer-slot-2',
    valueId,
  ]);
});

test('selectionHierarchy omits offers block for single layouts', () => {
  const valueId = targetIdForLayerChild('offer-slot-1', 'offer-value');
  assert.deepEqual(selectionHierarchy(valueId, 1), [
    'offer-slot-1',
    valueId,
  ]);
});

test('dragTargetIdsForSelection returns all offer block layers for group selection', () => {
  assert.deepEqual(dragTargetIdsForSelection(OFFERS_BLOCK_ID, [OFFERS_BLOCK_ID], 3), [
    'offer-slot-1',
    'offer-slot-2',
    'offer-slot-3',
    'plus-1',
    'plus-2',
  ]);
});

test('filterManipulationTargetIds removes hidden offer targets and preserves non-offer targets', () => {
  const doc = {
    version: 1,
    sizes: {
      '300x250': {
        layers: [
          { id: 'offer-slot-1', kind: 'group', base: { cssClass: 'offer-slot-1' }, clips: [] },
          { id: 'offer-slot-2', kind: 'group', base: { cssClass: 'offer-slot-2' }, clips: [] },
          { id: 'plus-2', kind: 'text', base: { cssClass: 'plus-2' }, clips: [] },
          { id: 'headline', kind: 'text', base: { cssClass: 'headline' }, clips: [] },
        ],
        variantRules: [
          { id: 'offers-3|offer-slot-2', scope: 'offers-3', layerId: 'offer-slot-2', cssClass: 'offer-slot-2', props: { visibility: 'hidden' } },
          { id: 'offers-3|plus-2', scope: 'offers-3', layerId: 'plus-2', cssClass: 'plus-2', props: { visibility: 'hidden' } },
        ],
      },
    },
  };

  assert.deepEqual(filterManipulationTargetIds([
    'headline',
    'plus-2',
    targetIdForLayerChild('offer-slot-2', 'offer-value'),
    targetIdForLayerChild('offer-slot-1', 'offer-value'),
  ], doc, '300x250', ['offers-3']), [
    'headline',
    targetIdForLayerChild('offer-slot-1', 'offer-value'),
  ]);
});

test('filtered manipulation targets keep hidden offer members out of group bounds', () => {
  const doc = {
    version: 1,
    sizes: {
      '300x250': {
        layers: [
          { id: 'offer-slot-1', kind: 'group', base: { left: 0, top: 0, width: 100, height: 40, cssClass: 'offer-slot-1' }, clips: [] },
          { id: 'plus-2', kind: 'text', base: { left: 1000, top: 0, width: 20, height: 40, cssClass: 'plus-2' }, clips: [] },
          { id: 'headline', kind: 'text', base: { left: 200, top: 10, width: 50, height: 20, cssClass: 'headline' }, clips: [] },
        ],
        variantRules: [
          { id: 'offers-3|plus-2', scope: 'offers-3', layerId: 'plus-2', cssClass: 'plus-2', props: { visibility: 'hidden' } },
        ],
      },
    },
  };
  const memberIds = filterManipulationTargetIds(
    ['offer-slot-1', 'plus-2', 'headline'],
    doc,
    '300x250',
    ['offers-3'],
  );

  assert.deepEqual(getGroupCanvasBounds(doc, '300x250', memberIds, ['offers-3']), {
    left: 0,
    top: 0,
    width: 250,
    height: 40,
  });
});

test('offerBlockLayerIds adapts to offer count', () => {
  assert.deepEqual(offerBlockLayerIds(1), ['offer-slot-1']);
  assert.deepEqual(offerBlockLayerIds(2), ['offer-slot-1', 'offer-slot-2', 'plus-1']);
  assert.deepEqual(offerBlockLayerIds(3), [
    'offer-slot-1',
    'offer-slot-2',
    'offer-slot-3',
    'plus-1',
    'plus-2',
  ]);
});

test('targetMatchesSelection keeps group members unselected until isolation', () => {
  assert.equal(
    targetMatchesSelection('offer-slot-1', OFFERS_BLOCK_ID, [OFFERS_BLOCK_ID], 2, ''),
    false,
  );
  assert.equal(
    targetMatchesSelection('offer-slot-1', OFFERS_BLOCK_ID, [OFFERS_BLOCK_ID], 2, OFFERS_BLOCK_ID),
    true,
  );
});

test('linkedTargetIdsForSelection hides member highlights until isolation', () => {
  assert.deepEqual(linkedTargetIdsForSelection(OFFERS_BLOCK_ID, [OFFERS_BLOCK_ID], 2, ''), []);
  assert.deepEqual(
    linkedTargetIdsForSelection(OFFERS_BLOCK_ID, [OFFERS_BLOCK_ID], 2, OFFERS_BLOCK_ID).length,
    3,
  );
});

test('isolatedDrillHierarchy removes offers block root', () => {
  assert.deepEqual(isolatedDrillHierarchy([
    OFFERS_BLOCK_ID,
    'offer-slot-1',
    targetIdForLayerChild('offer-slot-1', 'offer-value'),
  ]), [
    'offer-slot-1',
    targetIdForLayerChild('offer-slot-1', 'offer-value'),
  ]);
});

test('resolveSelectionMeta labels offer block bounds as logical', () => {
  const doc = {
    version: 1,
    sizes: {
      '300x250': {
        canvas: { width: 300, height: 250 },
        layers: [
          { id: 'offer-slot-1', kind: 'group', base: { left: 0, top: 0, width: 100, height: 40, cssClass: 'offer-slot-1' }, clips: [] },
          { id: 'plus-1', kind: 'text', base: { left: 105, top: 0, width: 20, height: 40, cssClass: 'plus-1' }, clips: [] },
          { id: 'offer-slot-2', kind: 'group', base: { left: 130, top: 0, width: 100, height: 40, cssClass: 'offer-slot-2' }, clips: [] },
          { id: 'plus-2', kind: 'text', base: { left: 260, top: 0, width: 20, height: 40, cssClass: 'plus-2' }, clips: [] },
        ],
        variantRules: [
          { id: 'offers-3|plus-2', scope: 'offers-3', layerId: 'plus-2', cssClass: 'plus-2', props: { visibility: 'hidden' }, editable: true },
        ],
      },
    },
  };

  const meta = resolveSelectionMeta(doc, '300x250', OFFERS_BLOCK_ID, [], 3, ['offers-3']);

  assert.equal(meta?.boundsMode, 'logical');
  assert.deepEqual(meta?.bounds, {
    left: 0,
    top: 0,
    width: 230,
    height: 40,
  });
});
