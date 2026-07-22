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
import { findCreativeTarget } from '@/lib/creative-model';

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

test('unit-rate prices are canvas-absolute and share the T&Cs bottom-left', () => {
  const doc = loadPersistedCreative();
  const scopes = ['offers-3', 'tc-prices', 'frames-4'];
  const size = '300x250';
  const canvas = doc.sizes[size].canvas;
  const unitLayer = doc.sizes[size].layers.find((layer) => layer.id === 'unit-rate-prices');
  const termsLayer = doc.sizes[size].layers.find((layer) => layer.id === 'terms-prices');
  const unit = getTargetCanvasBounds(doc, size, 'unit-rate-prices', scopes);
  const terms = getTargetCanvasBounds(doc, size, 'terms-prices', scopes);
  assert.ok(unit, 'unit-rate bounds missing');
  assert.ok(terms, 'terms bounds missing');
  assert.equal(unit.coordinateScope, 'canvas');
  assert.equal(terms.coordinateScope, 'canvas');
  assert.equal(unit.wrapperClass, '');
  assert.equal(unit.left, unitLayer.base.left);
  assert.equal(unit.top, unitLayer.base.top);
  assert.equal(terms.left, unit.left, 'shared left edge');
  assertClose(
    terms.top + terms.height,
    unit.top + unit.height,
    2,
    'shared bottom edge',
  );
  // Left-column legal stack (not full-bleed); keep clear of the right offer column.
  assert.ok(unit.width < canvas.width / 2, 'unit-rate should stay a left column');
  assert.ok(unit.top > 150, `unit-rate selection should be near the bottom (got top=${unit.top})`);
  assert.equal(unitLayer.base.fontSize, termsLayer.base.fontSize);
  assert.equal(unitLayer.fit?.mode, 'shrink');
  assert.equal(unitLayer.fit?.maxLines, 2);
  assert.equal(
    unitLayer.fit?.minFontSize,
    Math.max(8, Math.round(Number(termsLayer.base.fontSize) * 0.75)),
  );
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

test('persisted 320x50 dual price row stays on-canvas with leaderboard layout', () => {
  const doc = loadPersistedCreative();
  const canvas = doc.sizes['320x50'].canvas;
  const scopes = ['offers-2', 'tc-prices'];

  for (const slotId of ['offer-slot-1', 'offer-slot-2']) {
    const targetSlot = getTargetCanvasBounds(doc, '320x50', slotId, scopes);
    const targetValue = getTargetCanvasBounds(doc, '320x50', `${slotId}::offer-value`, scopes);
    const targetSubline = getTargetCanvasBounds(doc, '320x50', `${slotId}::offer-subline`, scopes);
    const primitive = unionBounds([targetValue, targetSubline].filter(Boolean));

    assert.ok(targetSlot.left >= 0, `${slotId} slot exceeds canvas left`);
    assert.ok(targetSlot.left + targetSlot.width <= canvas.width, `${slotId} slot exceeds canvas right`);
    assert.ok(targetSlot.top >= 0, `${slotId} slot exceeds canvas top`);
    assert.ok(targetSlot.top + targetSlot.height <= canvas.height + 1, `${slotId} slot exceeds canvas bottom`);
    assert.ok(targetValue.left >= 0, `${slotId} value exceeds canvas left`);
    assert.ok(targetSubline.left >= 0, `${slotId} subline exceeds canvas left`);
    assert.ok(targetValue.left + targetValue.width <= canvas.width, `${slotId} value exceeds canvas right`);
    assert.ok(targetSubline.left + targetSubline.width <= canvas.width, `${slotId} subline exceeds canvas right`);
    assertClose(targetValue.width, targetSlot.width, 1, `${slotId} value width`);
    // Sublines are intentionally narrower than the slot on the leaderboard.
    assert.ok(
      targetSubline.width <= targetSlot.width,
      `${slotId} subline wider than slot (${targetSubline.width} > ${targetSlot.width})`,
    );
    assert.ok(targetSubline.width >= targetSlot.width * 0.75, `${slotId} subline too narrow`);
    assert.ok(primitive.left >= 0, `${slotId} primitive exceeds canvas left`);
    assert.ok(primitive.left + primitive.width <= canvas.width, `${slotId} primitive exceeds canvas right`);
    assert.ok(primitive.top >= 0, `${slotId} primitive exceeds canvas top`);
    assert.ok(
      primitive.top + primitive.height <= canvas.height + 8,
      `${slotId} primitive exceeds canvas bottom`,
    );
  }

  const targetPlus = getTargetCanvasBounds(doc, '320x50', 'plus-1', scopes);
  assert.ok(targetPlus.left >= 0, 'dual plus exceeds canvas left');
  assert.ok(targetPlus.left + targetPlus.width <= canvas.width, 'dual plus exceeds canvas right');
  assert.ok(targetPlus.top >= 0, 'dual plus exceeds canvas top');
  assert.ok(targetPlus.top + targetPlus.height <= canvas.height, 'dual plus exceeds canvas bottom');
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

      // Allow 1px contact with the headline column (triple-offer pack is tight).
      assert.ok(
        slot.left + 1 >= headline.left + headline.width,
        `${scopes[0]} ${slotId} overlaps narrowed headline`,
      );
      assert.ok(slot.top >= 0, `${scopes[0]} ${slotId} exceeds canvas top`);
      assert.ok(slot.top + slot.height <= sizeCreative.canvas.height, `${scopes[0]} ${slotId} exceeds canvas bottom`);
      if (scopes[0] !== 'offers-1') {
        const authoredSubline = findCreativeTarget(doc, '728x90', `${slotId}::offer-subline`, scopes);
        assert.equal(
          subline.localLeft,
          Number(authoredSubline?.values?.left) || 0,
          `${scopes[0]} ${slotId} subline chrome must match authored local left`,
        );
        assert.ok(value.left >= slot.left - 8, `${scopes[0]} ${slotId} value exceeds slot left`);
        assert.ok(value.left + value.width <= slot.left + slot.width + 8, `${scopes[0]} ${slotId} value exceeds slot right`);
        assert.ok(primitive.left >= slot.left - 8, `${scopes[0]} ${slotId} primitive exceeds slot left`);
        assert.ok(primitive.left + primitive.width <= slot.left + slot.width + 8, `${scopes[0]} ${slotId} primitive exceeds slot right`);
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

test('728x90 offers-3 subline chrome uses authored height, not maxLines budget', () => {
  const doc = loadPersistedCreative();
  const scopes = ['offers-3', 'tc-prices'];
  const subline = getTargetCanvasBounds(doc, '728x90', 'offer-slot-1::offer-subline', scopes);
  const authored = doc.sizes['728x90'].variantRules.find(
    (rule) => rule.scope === 'offers-3' && rule.cssClass === 'offer-subline',
  )?.props;

  assert.ok(subline, 'offers-3 subline target is missing');
  assert.equal(authored?.height, 11);
  assert.equal(authored?.top, 40);
  assert.equal(subline.height, 11, 'selection chrome must match authored height');
  assert.equal(subline.localTop, 40, 'selection chrome must not shift top for maxLines');
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
  assert.equal(value.localLeft, -79);
  assert.equal(subline.localLeft, 106);
  // Hit chrome is tighter than the slot; still wide enough to edit.
  assertClose(value.width, 180, 1, 'single value hit width');
  assertClose(subline.width, 173, 1, 'single subline hit width');
  assert.ok(value.width < slot.width, 'single value hit should be tighter than the slot');
  assert.ok(subline.width < slot.width, 'single subline hit should be tighter than the slot');
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

test('in-place logo crossfade sizes keep blue and white boxes matched under offers-3', () => {
  const doc = loadPersistedCreative();
  for (const size of ['300x250', '300x600', '970x250']) {
    for (const scopes of [['offers-1'], ['offers-3']]) {
      const blue = getTargetCanvasBounds(doc, size, 'logo-act1', scopes);
      const white = getTargetCanvasBounds(doc, size, 'logo-act3', scopes);
      assert.ok(blue && white, `${size} ${scopes[0]} logos missing`);
      assert.equal(blue.left, white.left, `${size} ${scopes[0]} logo left mismatch`);
      assert.equal(blue.top, white.top, `${size} ${scopes[0]} logo top mismatch`);
      assert.equal(blue.width, white.width, `${size} ${scopes[0]} logo width mismatch`);
      assert.equal(blue.height, white.height, `${size} ${scopes[0]} logo height mismatch`);
    }
    const blueOnlyGeom = (doc.sizes[size].variantRules || []).filter((rule) => (
      rule.layerId === 'logo-act1'
      && Object.keys(rule.props || {}).some((key) => ['left', 'top', 'width', 'height'].includes(key))
    ));
    assert.equal(blueOnlyGeom.length, 0, `${size} must not have blue-only logo geometry variants`);
  }
});
