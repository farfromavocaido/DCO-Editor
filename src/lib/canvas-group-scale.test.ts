import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  expandScaleTargetIds,
  frameResizeWritesFromHandle,
  groupResizeAnchor,
  scaleTargetIdsForOfferGroup,
  scaledResizeWritesFromHandle,
  uniformScaleFromHandle,
} from '@/lib/canvas-group-scale';
import { targetIdForLayerChild } from '@/lib/creative-model';

test('expandScaleTargetIds includes nested offer text targets', () => {
  assert.deepEqual(expandScaleTargetIds(['offer-slot-1']), [
    'offer-slot-1',
    targetIdForLayerChild('offer-slot-1', 'offer-value'),
    targetIdForLayerChild('offer-slot-1', 'offer-subline'),
  ]);
});

test('expandScaleTargetIds keeps optional roundel frame as a single shape target', () => {
  assert.deepEqual(expandScaleTargetIds(['roundel-frame']), [
    'roundel-frame',
  ]);
});

test('groupResizeAnchor uses opposite corner for se handle', () => {
  const anchor = groupResizeAnchor({ left: 10, top: 20, width: 100, height: 50 }, 'se');
  assert.deepEqual(anchor, { x: 10, y: 20 });
});

test('uniformScaleFromHandle scales proportionally from width on corner drag', () => {
  const scale = uniformScaleFromHandle({ width: 100, height: 50 }, 'se', 50, 0);
  assert.equal(scale, 1.5);
});

test('frame resize writes box fields without changing text size', () => {
  const result = frameResizeWritesFromHandle(
    { left: 10, top: 20, width: 100, height: 50 },
    'se',
    40,
    10,
  );

  assert.deepEqual(result.writes, [
    { field: 'width', value: 140 },
    { field: 'height', value: 60 },
  ]);
});

test('scale resize writes box fields and font size from the opposite corner', () => {
  const snapshot = {
    targetId: 'headline-act1',
    kind: 'text',
    bounds: { left: 10, top: 20, width: 100, height: 50 },
    raw: { left: 10, top: 20, width: 100, height: 50, fontSize: 20 },
    numeric: { left: 10, top: 20, width: 100, height: 50, fontSize: 20 },
  };

  const result = scaledResizeWritesFromHandle(snapshot, 'se', 50, 0);

  assert.equal(result.scale, 1.5);
  assert.deepEqual(result.writes, [
    { field: 'left', value: 10 },
    { field: 'top', value: 20 },
    { field: 'width', value: 150 },
    { field: 'height', value: 75 },
    { field: 'fontSize', value: 30 },
  ]);
});

test('scaleTargetIdsForOfferGroup excludes hidden members when document context is available', () => {
  const doc = {
    version: 1,
    sizes: {
      '300x250': {
        layers: [
          { id: 'offer-slot-1', kind: 'group', base: { cssClass: 'offer-slot-1' }, clips: [] },
          { id: 'plus-1', kind: 'text', base: { cssClass: 'plus-1' }, clips: [] },
          { id: 'offer-slot-2', kind: 'group', base: { cssClass: 'offer-slot-2' }, clips: [] },
          { id: 'plus-2', kind: 'text', base: { cssClass: 'plus-2' }, clips: [] },
        ],
        variantRules: [
          { id: 'offers-3|plus-2', scope: 'offers-3', layerId: 'plus-2', cssClass: 'plus-2', props: { visibility: 'hidden' } },
        ],
      },
    },
  };

  assert.deepEqual(scaleTargetIdsForOfferGroup(3, doc, '300x250', ['offers-3']), [
    'offer-slot-1',
    targetIdForLayerChild('offer-slot-1', 'offer-value'),
    targetIdForLayerChild('offer-slot-1', 'offer-subline'),
    'plus-1',
    'offer-slot-2',
    targetIdForLayerChild('offer-slot-2', 'offer-value'),
    targetIdForLayerChild('offer-slot-2', 'offer-subline'),
  ]);
});
