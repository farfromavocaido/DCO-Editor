import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  fitSizeStatus,
  fitTrackingStatus,
  formatTrackingEm,
  resizeHandlesForSelection,
  selectionChromeKind,
} from './selection-chrome';

test('nested text exposes box resize handles without implying group scaling', () => {
  const target = { kind: 'nested', coordinateScope: 'group' };

  assert.deepEqual(resizeHandlesForSelection(target, 'offer-slot-1::offer-value'), ['nw', 'ne', 'se', 'sw']);
  assert.equal(selectionChromeKind(target, ''), 'text-box');
});

test('logical offer groups use group scaling handles', () => {
  const target = { kind: 'group', boundsMode: 'logical' };

  assert.deepEqual(resizeHandlesForSelection(target, 'group:offers-block'), ['nw', 'ne', 'se', 'sw']);
  assert.equal(selectionChromeKind(target, 'logical'), 'logical-group');
});

test('fitSizeStatus flags automatic runtime font scaling', () => {
  assert.deepEqual(fitSizeStatus(66, 60), {
    fitted: 60,
    requested: 66,
    state: 'scaled',
  });

  assert.equal(fitSizeStatus(66, 66).state, 'stated');
  assert.deepEqual(fitSizeStatus(66, undefined), {
    fitted: 66,
    requested: 66,
    state: 'stated',
  });
});

test('fitTrackingStatus reports fit squeeze in em', () => {
  assert.equal(formatTrackingEm(-0.05), '-0.05em');
  assert.equal(formatTrackingEm(0), '0em');
  assert.equal(fitTrackingStatus(-0.05).state, 'squeezed');
  assert.equal(fitTrackingStatus(-0.05).label, '-0.05em');
  assert.equal(fitTrackingStatus(0).state, 'stated');
  assert.equal(fitTrackingStatus(undefined).state, 'unknown');
});
