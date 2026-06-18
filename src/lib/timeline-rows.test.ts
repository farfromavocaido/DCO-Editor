import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  buildTimelineEntries,
  isOfferTimelineLayer,
  offerLayerVariantState,
} from '@/lib/timeline-rows';
import { OFFERS_BLOCK_ID } from '@/lib/selection-groups';

const offerLayers = [
  { id: 'offer-slot-1', label: 'Offer 1' },
  { id: 'plus-1', label: 'Plus 1' },
  { id: 'offer-slot-2', label: 'Offer 2' },
  { id: 'plus-2', label: 'Plus 2' },
  { id: 'offer-slot-3', label: 'Offer 3' },
];

test('buildTimelineEntries groups offer layers for dual and triple formats', () => {
  const layers = [{ id: 'headline-act1' }, ...offerLayers, { id: 'cta' }];
  const dual = buildTimelineEntries(layers, 2);
  assert.equal(dual.length, 3);
  assert.equal(dual[1].kind, 'offers-group');
  assert.equal(dual[1].id, OFFERS_BLOCK_ID);
  assert.deepEqual(dual[1].layers.map((layer) => layer.id), [
    'offer-slot-1',
    'plus-1',
    'offer-slot-2',
  ]);
  assert.deepEqual(dual[1].hiddenLayers.map((layer) => layer.id), [
    'plus-2',
    'offer-slot-3',
  ]);
});

test('buildTimelineEntries keeps single offers ungrouped', () => {
  const layers = [{ id: 'headline-act1' }, ...offerLayers];
  const single = buildTimelineEntries(layers, 1);
  assert.ok(single.every((entry) => entry.kind === 'layer'));
});

test('buildTimelineEntries can receive active offer members without hidden plus rows', () => {
  const layers = [
    { id: 'offer-slot-1' },
    { id: 'plus-1' },
    { id: 'offer-slot-2' },
    { id: 'plus-2' },
    { id: 'offer-slot-3' },
  ];
  const entries = buildTimelineEntries(layers, 3, {
    activeOfferMemberIds: ['offer-slot-1', 'plus-1', 'offer-slot-2', 'offer-slot-3'],
  });
  const group = entries.find((entry) => entry.kind === 'offers-group');
  assert.deepEqual(group.layers.map((layer) => layer.id), [
    'offer-slot-1',
    'plus-1',
    'offer-slot-2',
    'offer-slot-3',
  ]);
  assert.deepEqual(group.hiddenLayers.map((layer) => layer.id), ['plus-2']);
  assert.equal(group.hiddenLayers.filter((layer) => layer.id === 'plus-2').length, 1);
});

test('offerLayerVariantState marks inactive slots for the current format', () => {
  assert.equal(offerLayerVariantState('offer-slot-2', 2), 'active');
  assert.equal(offerLayerVariantState('offer-slot-3', 2), 'inactive');
  assert.equal(offerLayerVariantState('plus-2', 2), 'inactive');
  assert.equal(isOfferTimelineLayer('offer-slot-1'), true);
});
