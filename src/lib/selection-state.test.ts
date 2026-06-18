import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  defaultHitPathForDrillIn,
  nextSelectionForCanvasClick,
  nextSelectionForDrillIn,
  nextSelectionForEscape,
  normalizeSelectionState,
} from './selection-state';
import { OFFERS_BLOCK_ID } from './selection-groups';
import { targetIdForLayerChild } from './creative-model';

test('first click inside offers selects the top-level offer block', () => {
  const valueId = targetIdForLayerChild('offer-slot-2', 'offer-value');
  const next = nextSelectionForCanvasClick({
    currentTargetId: '',
    isolationPath: [],
    hitPath: [OFFERS_BLOCK_ID, 'offer-slot-2', valueId],
    modifier: false,
  });
  assert.equal(next.selectedTargetId, OFFERS_BLOCK_ID);
  assert.deepEqual(next.selectedTargetIds, [OFFERS_BLOCK_ID]);
  assert.deepEqual(next.isolationPath, []);
});

test('first click inside a single-offer slot selects the nested text target', () => {
  const valueId = targetIdForLayerChild('offer-slot-1', 'offer-value');
  const next = nextSelectionForCanvasClick({
    currentTargetId: '',
    isolationPath: [],
    hitPath: ['offer-slot-1', valueId],
    modifier: false,
  });
  assert.equal(next.selectedTargetId, valueId);
  assert.deepEqual(next.selectedTargetIds, [valueId]);
  assert.deepEqual(next.isolationPath, ['offer-slot-1']);
});

test('first click inside non-offer nested artwork selects the parent layer', () => {
  const valueId = targetIdForLayerChild('roundel-frame', 'roundel-value');
  const next = nextSelectionForCanvasClick({
    currentTargetId: '',
    isolationPath: [],
    hitPath: ['roundel-frame', valueId],
    modifier: false,
  });
  assert.equal(next.selectedTargetId, 'roundel-frame');
  assert.deepEqual(next.selectedTargetIds, ['roundel-frame']);
  assert.deepEqual(next.isolationPath, []);
});

test('clicking inside isolated non-offer artwork selects the nested target', () => {
  const valueId = targetIdForLayerChild('roundel-frame', 'roundel-value');
  const next = nextSelectionForCanvasClick({
    currentTargetId: 'roundel-frame',
    isolationPath: ['roundel-frame'],
    hitPath: ['roundel-frame', valueId],
    modifier: false,
  });
  assert.equal(next.selectedTargetId, valueId);
  assert.deepEqual(next.selectedTargetIds, [valueId]);
  assert.deepEqual(next.isolationPath, ['roundel-frame']);
});

test('clicking across offer parents updates isolation path to the clicked ancestry', () => {
  const valueId = targetIdForLayerChild('offer-slot-1', 'offer-value');
  const next = nextSelectionForCanvasClick({
    currentTargetId: targetIdForLayerChild('offer-slot-2', 'offer-value'),
    isolationPath: [OFFERS_BLOCK_ID, 'offer-slot-2'],
    hitPath: [OFFERS_BLOCK_ID, 'offer-slot-1', valueId],
    modifier: false,
  });
  assert.equal(next.selectedTargetId, valueId);
  assert.deepEqual(next.selectedTargetIds, [valueId]);
  assert.deepEqual(next.isolationPath, [OFFERS_BLOCK_ID, 'offer-slot-1']);
});

test('drill in from offer block selects the direct child under the pointer', () => {
  const valueId = targetIdForLayerChild('offer-slot-2', 'offer-value');
  const next = nextSelectionForDrillIn({
    currentTargetId: OFFERS_BLOCK_ID,
    isolationPath: [],
    hitPath: [OFFERS_BLOCK_ID, 'offer-slot-2', valueId],
  });
  assert.equal(next.selectedTargetId, 'offer-slot-2');
  assert.deepEqual(next.isolationPath, [OFFERS_BLOCK_ID]);
});

test('second drill in selects nested text inside the slot', () => {
  const valueId = targetIdForLayerChild('offer-slot-2', 'offer-value');
  const next = nextSelectionForDrillIn({
    currentTargetId: 'offer-slot-2',
    isolationPath: [OFFERS_BLOCK_ID],
    hitPath: [OFFERS_BLOCK_ID, 'offer-slot-2', valueId],
  });
  assert.equal(next.selectedTargetId, valueId);
  assert.deepEqual(next.isolationPath, [OFFERS_BLOCK_ID, 'offer-slot-2']);
});

test('Escape exits one isolation level at a time', () => {
  assert.deepEqual(nextSelectionForEscape({
    selectedTargetId: targetIdForLayerChild('offer-slot-2', 'offer-value'),
    isolationPath: [OFFERS_BLOCK_ID, 'offer-slot-2'],
  }), {
    selectedTargetId: 'offer-slot-2',
    selectedTargetIds: ['offer-slot-2'],
    isolationPath: [OFFERS_BLOCK_ID],
  });
});

test('default drill path from offer block targets the first active child', () => {
  const hitPath = defaultHitPathForDrillIn({
    currentTargetId: OFFERS_BLOCK_ID,
    isolationPath: [],
    defaultChildId: 'offer-slot-1',
  });
  const next = nextSelectionForDrillIn({
    currentTargetId: OFFERS_BLOCK_ID,
    isolationPath: [],
    hitPath,
  });

  assert.deepEqual(hitPath, [OFFERS_BLOCK_ID, 'offer-slot-1']);
  assert.equal(next.selectedTargetId, 'offer-slot-1');
  assert.deepEqual(next.isolationPath, [OFFERS_BLOCK_ID]);
});

test('default drill path from offer slot targets its first nested child', () => {
  const valueId = targetIdForLayerChild('offer-slot-1', 'offer-value');
  const hitPath = defaultHitPathForDrillIn({
    currentTargetId: 'offer-slot-1',
    isolationPath: [OFFERS_BLOCK_ID],
    defaultChildId: valueId,
  });
  const next = nextSelectionForDrillIn({
    currentTargetId: 'offer-slot-1',
    isolationPath: [OFFERS_BLOCK_ID],
    hitPath,
  });

  assert.deepEqual(hitPath, [OFFERS_BLOCK_ID, 'offer-slot-1', valueId]);
  assert.equal(next.selectedTargetId, valueId);
  assert.deepEqual(next.isolationPath, [OFFERS_BLOCK_ID, 'offer-slot-1']);
});

test('default drill path returns null when there is no child', () => {
  assert.equal(defaultHitPathForDrillIn({
    currentTargetId: targetIdForLayerChild('offer-slot-1', 'offer-value'),
    isolationPath: [OFFERS_BLOCK_ID, 'offer-slot-1'],
    defaultChildId: '',
  }), null);
});

test('normalizing an empty selection clears isolation and layer state', () => {
  assert.deepEqual(normalizeSelectionState({
    selectedTargetId: '',
    selectedTargetIds: [],
    selectedLayerId: 'offer-slot-2',
    selectedClipId: 'clip-1',
    isolationPath: [OFFERS_BLOCK_ID, 'offer-slot-2'],
  }), {
    selectedTargetId: '',
    selectedTargetIds: [],
    selectedLayerId: '',
    selectedClipId: '',
    isolationPath: [],
    isolatedGroupId: '',
  });
});

test('normalizing prunes inactive offer isolation path entries', () => {
  assert.deepEqual(normalizeSelectionState({
    selectedTargetId: 'offer-slot-1',
    selectedTargetIds: ['offer-slot-1'],
    selectedLayerId: 'offer-slot-1',
    selectedClipId: 'clip-1',
    isolationPath: [OFFERS_BLOCK_ID, 'offer-slot-3'],
    activePathIds: [OFFERS_BLOCK_ID, 'offer-slot-1', 'offer-slot-2'],
  }), {
    selectedTargetId: 'offer-slot-1',
    selectedTargetIds: ['offer-slot-1'],
    selectedLayerId: 'offer-slot-1',
    selectedClipId: 'clip-1',
    isolationPath: [OFFERS_BLOCK_ID],
    isolatedGroupId: OFFERS_BLOCK_ID,
  });
});
