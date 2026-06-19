import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  alignmentGuidesForMode,
  computeAlignPosition,
  computeGroupAlignDelta,
  computeHorizontalDistribute,
  computeSnap,
  getTargetCanvasBounds,
  logicalOfferBlockBounds,
  unionBounds,
} from '@/lib/canvas-alignment';

const loadPersistedCreative = () => JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), 'campaign/sse-dco-creative.json'),
  'utf8',
));

const assertClose = (actual: number, expected: number, tolerance: number, message: string) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${actual} to be within ${tolerance}px of ${expected}`,
  );
};

const scaleAxes = (
  doc: Record<string, any>,
  referenceSize: string,
  targetSize: string,
) => ({
  x: doc.sizes[targetSize].canvas.width / doc.sizes[referenceSize].canvas.width,
  y: doc.sizes[targetSize].canvas.height / doc.sizes[referenceSize].canvas.height,
});

const classProps = (doc: Record<string, any>, size: string, cssClass: string) => (
  doc.sizes[size].classRules.find((rule: Record<string, any>) => rule.cssClass === cssClass)?.properties || {}
);

const headlineBoxFields = new Set(['left', 'top', 'right', 'bottom', 'width', 'height', 'fontSize']);

test('computeSnap snaps to canvas centre and edges', () => {
  const canvas = { width: 300, height: 250 };
  const snap = computeSnap(148, 10, 40, 20, [], canvas, 5);
  assert.equal(snap.left, 150);
  assert.deepEqual(snap.verticalGuides, [150]);

  const leftSnap = computeSnap(2, 10, 40, 20, [], canvas, 5);
  assert.equal(leftSnap.left, 0);
  assert.deepEqual(leftSnap.verticalGuides, [0]);
});

test('computeSnap snaps to another element edge', () => {
  const canvas = { width: 300, height: 250 };
  const others = [{ left: 100, top: 50, width: 80, height: 24 }];
  const snap = computeSnap(59, 50, 40, 20, others, canvas, 5);
  assert.equal(snap.left, 60);
  assert.ok(snap.verticalGuides.includes(100));
});

test('computeAlignPosition centres within canvas reference', () => {
  const bounds = { left: 10, top: 20, width: 40, height: 20, coordinateScope: 'canvas' };
  const reference = { left: 0, top: 0, width: 300, height: 250 };
  const aligned = computeAlignPosition(bounds, reference, 'center-h');
  assert.equal(aligned.left, 130);
  assert.equal(aligned.top, 20);
});

test('computeAlignPosition aligns within group reference', () => {
  const bounds = {
    left: 120,
    top: 80,
    width: 40,
    height: 20,
    localLeft: 12,
    localTop: 8,
    coordinateScope: 'group',
  };
  const reference = { left: 0, top: 0, width: 160, height: 90 };
  const aligned = computeAlignPosition(bounds, reference, 'right');
  assert.equal(aligned.left, 120);
  assert.equal(aligned.top, 8);
});

test('alignmentGuidesForMode returns canvas centre line for horizontal centering', () => {
  const reference = { left: 0, top: 0, width: 300, height: 600 };
  assert.deepEqual(alignmentGuidesForMode('center-h', reference), { vertical: [150], horizontal: [] });
  assert.deepEqual(alignmentGuidesForMode('center-v', reference), { vertical: [], horizontal: [300] });
});

test('computeGroupAlignDelta moves group bounds to canvas centre', () => {
  const groupBounds = { left: 40, top: 100, width: 120, height: 80 };
  const reference = { left: 0, top: 0, width: 300, height: 600 };
  const delta = computeGroupAlignDelta(groupBounds, reference, 'center-h');
  assert.equal(delta.dx, 50);
  assert.equal(delta.dy, 0);
});

test('computeHorizontalDistribute keeps outer span and equalises gaps', () => {
  const updates = computeHorizontalDistribute([
    { targetId: 'a', left: 10, width: 20 },
    { targetId: 'b', left: 50, width: 20 },
    { targetId: 'c', left: 90, width: 20 },
  ]);
  assert.deepEqual(updates, [
    { targetId: 'a', left: 10 },
    { targetId: 'b', left: 50 },
    { targetId: 'c', left: 90 },
  ]);
});

test('logicalOfferBlockBounds uses only visible offer members', () => {
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

  assert.deepEqual(logicalOfferBlockBounds(doc, '300x250', ['offers-3']), {
    left: 0,
    top: 0,
    width: 230,
    height: 40,
  });
});

test('persisted triple top-row offer primitives fit their structural slots when centred', () => {
  const doc = loadPersistedCreative();
  const scopes = ['offers-3'];

  for (const size of ['300x250']) {
    const canvas = doc.sizes[size].canvas;
    const blockBounds = logicalOfferBlockBounds(doc, size, scopes);
    const { dx } = computeGroupAlignDelta(
      blockBounds,
      { left: 0, top: 0, width: canvas.width, height: canvas.height },
      'center-h',
    );

    for (const slotId of ['offer-slot-1', 'offer-slot-2']) {
      const slotBounds = getTargetCanvasBounds(doc, size, slotId, scopes);
      const primitiveBounds = unionBounds([
        getTargetCanvasBounds(doc, size, `${slotId}::offer-value`, scopes),
        getTargetCanvasBounds(doc, size, `${slotId}::offer-subline`, scopes),
      ].filter(Boolean));

      assert.ok(primitiveBounds.width <= slotBounds.width, `${size} ${slotId} primitive exceeds slot width`);
      assert.ok(primitiveBounds.left + dx >= 0, `${size} ${slotId} primitive exceeds canvas left after centring`);
      assert.ok(
        primitiveBounds.left + dx + primitiveBounds.width <= canvas.width,
        `${size} ${slotId} primitive exceeds canvas right after centring`,
      );
    }
  }
});

test('persisted 320x50 single offer stays on-canvas with leaderboard layout', () => {
  const doc = loadPersistedCreative();
  const canvas = doc.sizes['320x50'].canvas;
  const scopes = ['offers-1', 'tc-solo'];
  const targetSlot = getTargetCanvasBounds(doc, '320x50', 'offer-slot-1', scopes);
  const targetValue = getTargetCanvasBounds(doc, '320x50', 'offer-slot-1::offer-value', scopes);
  const targetSubline = getTargetCanvasBounds(doc, '320x50', 'offer-slot-1::offer-subline', scopes);
  const primitive = unionBounds([targetValue, targetSubline].filter(Boolean));
  const valueProps = classProps(doc, '320x50', 'offer-value');

  assert.ok(targetSlot.left >= 0, 'single slot exceeds canvas left');
  assert.ok(targetSlot.left + targetSlot.width <= canvas.width, 'single slot exceeds canvas right');
  assert.ok(targetSlot.top >= 0, 'single slot exceeds canvas top');
  assert.ok(targetSlot.top + targetSlot.height <= canvas.height + 1, 'single slot exceeds canvas bottom');
  assert.notEqual(valueProps.lineHeight, 4, 'single value must not use the old huge unitless line-height');
  assert.ok(primitive.top >= 0, 'single offer primitive exceeds canvas top');
  assert.ok(primitive.top + primitive.height <= canvas.height + 8, 'single offer primitive exceeds canvas bottom');
});

test('persisted 320x50 dual price row is scaled from the 970x250 reference', () => {
  const doc = loadPersistedCreative();
  const scale = scaleAxes(doc, '970x250', '320x50');
  const scopes = ['offers-2', 'tc-prices'];

  for (const slotId of ['offer-slot-1', 'offer-slot-2']) {
    const referenceSlot = getTargetCanvasBounds(doc, '970x250', slotId, scopes);
    const targetSlot = getTargetCanvasBounds(doc, '320x50', slotId, scopes);
    const targetValue = getTargetCanvasBounds(doc, '320x50', `${slotId}::offer-value`, scopes);
    const targetSubline = getTargetCanvasBounds(doc, '320x50', `${slotId}::offer-subline`, scopes);
    const primitive = unionBounds([targetValue, targetSubline].filter(Boolean));

    assertClose(targetSlot.left, Math.round(referenceSlot.left * scale.x), 2, `${slotId} left`);
    assertClose(targetSlot.top, Math.round(referenceSlot.top * scale.y), 2, `${slotId} top`);
    assertClose(targetSlot.width, Math.round(referenceSlot.width * scale.x), 2, `${slotId} width`);
    assert.equal(targetValue.localLeft, 0, `${slotId} value must anchor to the slot left`);
    assert.equal(targetSubline.localLeft, 0, `${slotId} subline must anchor to the slot left`);
    assertClose(targetValue.width, targetSlot.width, 1, `${slotId} value width`);
    assertClose(targetSubline.width, targetSlot.width, 1, `${slotId} subline width`);
    assert.ok(primitive.left >= targetSlot.left - 1, `${slotId} primitive exceeds slot left`);
    assert.ok(primitive.left + primitive.width <= targetSlot.left + targetSlot.width + 1, `${slotId} primitive exceeds slot right`);
    assert.ok(primitive.top >= 0, `${slotId} primitive exceeds canvas top`);
    assert.ok(
      primitive.top + primitive.height <= doc.sizes['320x50'].canvas.height + 8,
      `${slotId} primitive exceeds canvas bottom`,
    );
  }

  const referencePlus = getTargetCanvasBounds(doc, '970x250', 'plus-1', scopes);
  const targetPlus = getTargetCanvasBounds(doc, '320x50', 'plus-1', scopes);
  assertClose(targetPlus.left, Math.round(referencePlus.left * scale.x), 2, 'dual plus left');
  assertClose(targetPlus.top, Math.round(referencePlus.top * scale.y), 2, 'dual plus top');
  assertClose(targetPlus.width, Math.round(referencePlus.width * scale.x), 2, 'dual plus width');
  assertClose(targetPlus.height, Math.round(referencePlus.height * scale.y), 2, 'dual plus height');
});

test('persisted 728x90 banner keeps offers on-canvas with the cropped bluewave treatment', () => {
  const doc = loadPersistedCreative();
  const sizeCreative = doc.sizes['728x90'];

  assert.ok(sizeCreative, '728x90 size is missing');
  assert.equal(sizeCreative.canvas.width, 728);
  assert.equal(sizeCreative.canvas.height, 90);
  assert.equal(sizeCreative.assets.background, 'assets/bg_728x90.jpg');
  assert.equal(sizeCreative.assets.bluewave, 'assets/SVG/bluewave.svg');

  const headline = doc.sizes['728x90'].classRules.find((rule) => rule.cssClass === 'sse-headline')?.properties;
  const logo = sizeCreative.layers.find((layer) => layer.id === 'logo-act1').base;
  const bluewave = sizeCreative.layers.find((layer) => layer.id === 'bluewave').base;
  assert.ok(headline.width <= 230, '728x90 headline should be narrow enough for two-line copy');
  assert.ok(headline.height >= 48, '728x90 headline should allow two-line copy');
  assert.ok(bluewave.left >= 400 && bluewave.left <= 440, '728x90 bluewave should enter as a right-side crop');
  assert.ok(bluewave.width >= sizeCreative.canvas.width, '728x90 bluewave is intentionally oversized and clipped by the stage');

  for (const scopes of [['offers-1', 'tc-solo'], ['offers-2', 'tc-prices'], ['offers-3', 'tc-prices']]) {
    const activeSlots = scopes[0] === 'offers-1'
      ? ['offer-slot-1']
      : scopes[0] === 'offers-2'
        ? ['offer-slot-1', 'offer-slot-2']
        : ['offer-slot-1', 'offer-slot-2', 'offer-slot-3'];

    for (const slotId of activeSlots) {
      const slot = getTargetCanvasBounds(doc, '728x90', slotId, scopes);
      const value = getTargetCanvasBounds(doc, '728x90', `${slotId}::offer-value`, scopes);
      const subline = getTargetCanvasBounds(doc, '728x90', `${slotId}::offer-subline`, scopes);
      const primitive = unionBounds([value, subline].filter(Boolean));

      assert.ok(slot.left >= headline.left + headline.width, `${scopes[0]} ${slotId} overlaps narrowed headline`);
      assert.ok(slot.top >= 0, `${scopes[0]} ${slotId} exceeds canvas top`);
      assert.ok(slot.top + slot.height <= sizeCreative.canvas.height, `${scopes[0]} ${slotId} exceeds canvas bottom`);
      if (scopes[0] !== 'offers-1') {
        assert.equal(subline.localLeft, 0, `${scopes[0]} ${slotId} subline must anchor to slot left`);
        assert.ok(value.left >= slot.left - 1, `${scopes[0]} ${slotId} value exceeds slot left`);
        assert.ok(value.left + value.width <= slot.left + slot.width + 1, `${scopes[0]} ${slotId} value exceeds slot right`);
        assert.ok(primitive.left >= slot.left - 1, `${scopes[0]} ${slotId} primitive exceeds slot left`);
        assert.ok(primitive.left + primitive.width <= slot.left + slot.width + 1, `${scopes[0]} ${slotId} primitive exceeds slot right`);
      }
      if (scopes[0] === 'offers-1') {
        assert.ok(value.left >= 0, `${scopes[0]} ${slotId} value hit area exceeds canvas left`);
        assert.ok(value.left + value.width <= sizeCreative.canvas.width, `${scopes[0]} ${slotId} value hit area exceeds canvas right`);
      } else {
        assert.ok(primitive.left >= 0, `${scopes[0]} ${slotId} primitive exceeds canvas left`);
        assert.ok(primitive.left + primitive.width <= sizeCreative.canvas.width, `${scopes[0]} ${slotId} primitive exceeds canvas right`);
      }
      assert.ok(primitive.top >= 0, `${scopes[0]} ${slotId} primitive exceeds canvas top`);
      assert.ok(primitive.top + primitive.height <= sizeCreative.canvas.height, `${scopes[0]} ${slotId} primitive exceeds canvas bottom`);
    }
  }

  const tripleBlock = logicalOfferBlockBounds(doc, '728x90', ['offers-3', 'tc-prices']);
  assert.ok(tripleBlock.left + tripleBlock.width <= sizeCreative.canvas.width, '728x90 triple offer block exceeds canvas right');
  assert.ok(tripleBlock.left + tripleBlock.width <= logo.left + logo.width, '728x90 triple offer block exceeds logo column allowance');
});

test('persisted 728x90 single offer keeps oversized centered value editable on-canvas', () => {
  const doc = loadPersistedCreative();
  const scopes = ['offers-1', 'tc-solo'];
  const slot = getTargetCanvasBounds(doc, '728x90', 'offer-slot-1', scopes);
  const value = getTargetCanvasBounds(doc, '728x90', 'offer-slot-1::offer-value', scopes);
  const subline = getTargetCanvasBounds(doc, '728x90', 'offer-slot-1::offer-subline', scopes);

  assert.ok(slot, '728x90 single slot is missing');
  assert.ok(value, '728x90 single value target is missing');
  assert.ok(subline, '728x90 single subline target is missing');
  assert.equal(value.localLeft, -145);
  assert.equal(subline.localLeft, 107);
  assertClose(value.width, slot.width, 1, 'single value hit width');
  assertClose(subline.width, slot.width, 1, 'single subline hit width');
  assert.ok(value.left >= 0, 'single value hit area exceeds canvas left');
  assert.ok(value.left + value.width <= doc.sizes['728x90'].canvas.width, 'single value hit area exceeds canvas right');
  assert.ok(value.height >= 40, 'single value hit height is too small to click');
  assert.ok(subline.height >= 10, 'single subline hit height is too small to click');
});

test('headline geometry lives on shared sse-headline class, not per-act layers', () => {
  const doc = loadPersistedCreative();

  for (const [size, sizeCreative] of Object.entries<Record<string, any>>(doc.sizes)) {
    const shared = sizeCreative.classRules.find((rule) => rule.cssClass === 'sse-headline');
    assert.ok(shared?.properties?.left !== undefined, `${size} sse-headline missing left`);
    assert.ok(shared?.properties?.top !== undefined, `${size} sse-headline missing top`);
    assert.ok(shared?.properties?.width !== undefined, `${size} sse-headline missing width`);
    assert.ok(shared?.properties?.height !== undefined, `${size} sse-headline missing height`);
    assert.ok(shared?.properties?.fontSize !== undefined, `${size} sse-headline missing fontSize`);

    for (const layer of sizeCreative.layers.filter((item) => item.id.startsWith('headline-act'))) {
      assert.equal(layer.base.cssClass, 'sse-headline', `${size} ${layer.id} should use shared class`);
      const boxProps = Object.keys(layer.base || {}).filter((key) => headlineBoxFields.has(key));
      assert.deepEqual(boxProps, [], `${size} ${layer.id} should not own box geometry`);
    }

    const perActVariants = (sizeCreative.variantRules || []).filter((rule) => (
      String(rule.layerId || '').startsWith('headline-act')
      || String(rule.cssClass || '').startsWith('headline-act')
    ));
    assert.equal(perActVariants.length, 0, `${size} should not have per-act headline variant rules`);
  }
});
