import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  activeOfferMemberIds,
  offerInteractionTree,
  selectionPathForTarget,
} from './offer-interaction-model';
import {
  OFFERS_BLOCK_ID,
  selectionHierarchy,
} from './selection-groups';
import { targetIdForLayerChild } from './creative-model';

const mpuTripleDoc = {
  version: 1,
  sizes: {
    '300x250': {
      canvas: { width: 300, height: 250 },
      layers: [
        { id: 'offer-slot-1', kind: 'group', base: { left: 15, top: 58, width: 240, height: 122, cssClass: 'offer-slot-1' }, clips: [] },
        { id: 'plus-1', kind: 'text', base: { left: 98, top: 78, width: 24, height: 40, cssClass: 'plus-1' }, clips: [] },
        { id: 'offer-slot-2', kind: 'group', base: { left: 118, top: 68, width: 120, height: 100, cssClass: 'offer-slot-2' }, clips: [] },
        { id: 'plus-2', kind: 'text', base: { left: 145, top: 128, width: 24, height: 40, cssClass: 'plus-2' }, clips: [] },
        { id: 'offer-slot-3', kind: 'group', base: { left: 15, top: 118, width: 120, height: 90, cssClass: 'offer-slot-3' }, clips: [] },
        { id: 'roundel-frame', kind: 'shape', base: { left: 32, top: 82, width: 118, height: 118, cssClass: 'roundel-frame' }, clips: [] },
      ],
      variantRules: [
        { id: 'offers-3|offer-slot-1', scope: 'offers-3', layerId: 'offer-slot-1', cssClass: 'offer-slot-1', props: { left: 26, top: 58, width: 110 }, editable: true },
        { id: 'offers-3|offer-slot-2', scope: 'offers-3', layerId: 'offer-slot-2', cssClass: 'offer-slot-2', props: { left: 164, top: 58, width: 110 }, editable: true },
        { id: 'offers-3|offer-slot-3', scope: 'offers-3', layerId: 'offer-slot-3', cssClass: 'offer-slot-3', props: { left: 80, top: 118, width: 140 }, editable: true },
        { id: 'offers-3|plus-1', scope: 'offers-3', layerId: 'plus-1', cssClass: 'plus-1', props: { left: 138, top: 72 }, editable: true },
        { id: 'offers-3|plus-2', scope: 'offers-3', layerId: 'plus-2', cssClass: 'plus-2', props: { visibility: 'hidden' }, editable: true },
      ],
      classRules: [
        { cssClass: 'offer-value', properties: { left: 0, top: 0, width: '100%', fontSize: 56 } },
        { cssClass: 'offer-subline', properties: { left: 0, top: 39, width: '100%', fontSize: 14 } },
        { cssClass: 'roundel-copy', properties: { left: 18, top: 32, width: 82, height: 24, fontSize: 20 } },
        { cssClass: 'roundel-value', properties: { left: 10, top: 56, width: 98, height: 44, fontSize: 38 } },
      ],
    },
  },
};

test('activeOfferMemberIds excludes hidden plus signs for MPU triple', () => {
  assert.deepEqual(activeOfferMemberIds(mpuTripleDoc, '300x250', ['offers-3']), [
    'offer-slot-1',
    'plus-1',
    'offer-slot-2',
    'offer-slot-3',
  ]);
});

test('offerInteractionTree exposes block, direct children, and slot internals', () => {
  const tree = offerInteractionTree(mpuTripleDoc, '300x250', ['offers-3']);
  assert.equal(tree.id, OFFERS_BLOCK_ID);
  assert.deepEqual(tree.children.map((child) => child.id), [
    'offer-slot-1',
    'plus-1',
    'offer-slot-2',
    'offer-slot-3',
  ]);
  assert.deepEqual(tree.children[0].children.map((child) => child.id), [
    targetIdForLayerChild('offer-slot-1', 'offer-value'),
    targetIdForLayerChild('offer-slot-1', 'offer-subline'),
  ]);
});

test('selectionPathForTarget starts at the offer block for nested text', () => {
  const valueId = targetIdForLayerChild('offer-slot-2', 'offer-value');
  assert.deepEqual(selectionPathForTarget(mpuTripleDoc, '300x250', valueId, ['offers-3']), [
    OFFERS_BLOCK_ID,
    'offer-slot-2',
    valueId,
  ]);
});

test('selectionHierarchy with document context omits offers block for single layouts', () => {
  const valueId = targetIdForLayerChild('offer-slot-1', 'offer-value');
  assert.deepEqual(selectionHierarchy(valueId, 1, mpuTripleDoc, '300x250', ['offers-1']), [
    'offer-slot-1',
    valueId,
  ]);
});

test('selectionHierarchy with document context rejects offers block for single layouts', () => {
  assert.deepEqual(selectionHierarchy(OFFERS_BLOCK_ID, 1, mpuTripleDoc, '300x250', ['offers-1']), []);
});

test('selectionHierarchy with document context keeps offers block for multi-offer layouts', () => {
  assert.deepEqual(selectionHierarchy(OFFERS_BLOCK_ID, 3, mpuTripleDoc, '300x250', ['offers-3']), [
    OFFERS_BLOCK_ID,
  ]);
});

test('selectionHierarchy with document context excludes hidden offer members', () => {
  assert.deepEqual(selectionHierarchy('plus-2', 3, mpuTripleDoc, '300x250', ['offers-3']), []);
});

test('selectionHierarchy with document context passes through non-offer targets', () => {
  assert.deepEqual(selectionHierarchy('headline', 3, mpuTripleDoc, '300x250', ['offers-3']), [
    'headline',
  ]);
});

test('selectionPathForTarget keeps non-offer nested targets under their parent layer', () => {
  const valueId = targetIdForLayerChild('roundel-frame', 'roundel-value');

  assert.deepEqual(selectionPathForTarget(mpuTripleDoc, '300x250', valueId, ['frames-4']), [
    'roundel-frame',
    valueId,
  ]);
});
