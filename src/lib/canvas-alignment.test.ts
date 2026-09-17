import { test } from 'vitest';
import assert from 'node:assert/strict';

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

for (const [height,top,maxLines] of [[11,40,2],[29,7,6],[18,-4,1]]) test(`subline chrome respects authored box (${height}, ${top}, ${maxLines})`,()=>{
 const doc={sizes:{'300x250':{canvas:{width:300,height:250},layers:[{id:'offer-slot-1',kind:'group',base:{left:0,top:0,width:200,height:100},clips:[]}],classRules:[{cssClass:'offer-subline',properties:{left:0,top,width:100,height},fit:{maxLines}}]}}};
 const bounds=getTargetCanvasBounds(doc,'300x250','offer-slot-1::offer-subline',[]);
 assert.equal(bounds.height,height);assert.equal(bounds.localTop,top);
});

test('headline bounds use shared geometry and permit a local act override', () => {
  const doc = { sizes: { '300x250': {
    canvas: { width: 300, height: 250 },
    layers: ['headline-act1', 'headline-act2'].map((id) => ({
      id, kind: 'text', base: { cssClass: 'sse-headline' }, clips: [],
    })),
    classRules: [{ cssClass: 'sse-headline', properties: {
      left: 10, top: 20, width: 200, height: 50, fontSize: 24,
    } }],
    variantRules: [{ id: 'offers-2|headline-act2', scope: 'offers-2',
      layerId: 'headline-act2', cssClass: 'sse-headline', props: { left: 35, width: 150 } }],
  } } };
  const first = getTargetCanvasBounds(doc, '300x250', 'headline-act1', ['offers-2']);
  const second = getTargetCanvasBounds(doc, '300x250', 'headline-act2', ['offers-2']);
  const baseline = getTargetCanvasBounds(doc, '300x250', 'headline-act2', ['offers-1']);
  assert.equal(first.left, 10);
  assert.equal(first.width, 200);
  assert.equal(second.left, 35);
  assert.equal(second.width, 150);
  assert.equal(second.height, 50);
  assert.equal(baseline.left, 10);
});
