import { test } from 'vitest';
import assert from 'node:assert/strict';

import { nextZoomLevel, zoomLabel, zoomScale } from './canvas-zoom';

test('resolves auto and fixed zoom scales', () => {
  assert.equal(zoomScale('auto', 0.75), 0.75);
  assert.equal(zoomScale(2, 0.75), 2);
});

test('steps zoom levels without leaving the supported range', () => {
  assert.equal(nextZoomLevel('auto', 1), 1.25);
  assert.equal(nextZoomLevel(1, 1), 1.25);
  assert.equal(nextZoomLevel(2, 1), 2);
  assert.equal(nextZoomLevel(1, -1), 0.75);
  assert.equal(nextZoomLevel(0.25, -1), 0.25);
});

test('formats zoom labels', () => {
  assert.equal(zoomLabel('auto'), 'Auto');
  assert.equal(zoomLabel(1), '1x');
  assert.equal(zoomLabel(1.25), '125%');
});
