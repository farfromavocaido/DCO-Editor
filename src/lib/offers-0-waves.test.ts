// @ts-nocheck

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'vitest';

import { compileAnimationClips, frameAtPercent, resolveTimeRef } from '@/lib/creative-compiler';
import { clipsForProfile } from '@/lib/headline-motion';
import { beatsForScopes } from '@/lib/timing-profiles';
import { selectorForVariantRule } from '@/lib/creative-css';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const creative = JSON.parse(
  readFileSync(path.join(root, 'campaign/sse-dco-creative.json'), 'utf8'),
);

const MULTI = ['offers-1', 'offers-2', 'offers-3'];
const NAVY = 'rgb(0, 41, 117)';

test('offers-0 greenwave settles by Act 4; blue holds rest from start', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    const green = sizeCreative.layers.find((layer) => layer.id === 'greenwave');
    const blue = sizeCreative.layers.find((layer) => layer.id === 'bluewave');
    assert.ok(green && blue, size);

    const multiGreen = clipsForProfile(green.clips, 'frames-3', MULTI);
    const zeroGreen = clipsForProfile(green.clips, 'frames-3', ['offers-0']);
    const zeroBlue = clipsForProfile(blue.clips, 'frames-3', ['offers-0']);

    assert.equal(multiGreen.length, 1, `${size} multi green`);
    assert.equal(zeroGreen.length, 1, `${size} zero green`);
    assert.equal(zeroBlue.length, 1, `${size} zero blue`);
    assert.equal(zeroGreen[0].start, 'green_in', `${size} green starts at green_in`);
    assert.notEqual(multiGreen[0].start, zeroGreen[0].start, `${size} green timing differs`);

    const beats = beatsForScopes(creative, ['offers-0', 'frames-3']);
    assert.ok(Number.isFinite(beats.green_in), `${size} green_in beat`);
    const greenFrames = compileAnimationClips(zeroGreen, beats);
    const blueFrames = compileAnimationClips(zeroBlue, beats);
    const midPhoto = frameAtPercent(blueFrames, 20);
    const restX = Number(zeroBlue[0].params.end_x ?? 0);
    const restY = Number(
      zeroBlue[0].params.end_y
      ?? zeroBlue[0].params.hold_y
      ?? 0,
    );
    assert.equal(midPhoto.translate[0], restX, `${size} blue peek x at mid-photo`);
    assert.equal(midPhoto.translate[1], restY, `${size} blue peek y at mid-photo`);
    assert.ok(midPhoto.opacity > 0.9, `${size} blue visible mid-photo`);

    const sweep = Number(zeroGreen[0].params?.sweep_duration_pct ?? 7);
    const greenStart = resolveTimeRef(zeroGreen[0].start, beats);
    assert.equal(greenStart, beats.green_in, `${size} green_in resolves`);
    const settleAt = greenStart + sweep;
    const act4At = Number(beats.act4_in);
    assert.ok(
      settleAt <= act4At + 0.05,
      `${size} green should settle by Act 4 (${settleAt} > ${act4At})`,
    );

    const before = frameAtPercent(greenFrames, Math.max(0, greenStart - 5));
    const afterSweep = frameAtPercent(greenFrames, Math.min(99, settleAt + 1));
    assert.notEqual(before.translate[0], afterSweep.translate[0], `${size} green sweeps in`);
  }
});

test('offers-0 headlines restore shared geometry; Act 4 colour only; T&Cs follow ink', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    assert.ok(
      !sizeCreative.variantRules.some((rule) => rule.id === 'offers-0|greenwave|visibility'),
      `${size} greenwave visibility rule removed`,
    );
    const sse = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|sse-headline');
    assert.ok(sse, `${size} offers-0|sse-headline restored`);
    assert.equal(sse.props.color, undefined, `${size} geometry rule has no colour`);
    const act4 = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|headline-act4');
    assert.deepEqual(act4?.props, { color: NAVY }, `${size} act4 colour-only`);
    const ctaRect = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0.cta-rect|cta');
    assert.equal(ctaRect?.props?.backgroundColor, NAVY, `${size} CTA navy fill`);
    assert.equal(ctaRect?.props?.color, 'rgb(255, 255, 255)', `${size} CTA white text`);
    const whiteTc = sizeCreative.variantRules.find((rule) => rule.id === 'white-headlines|terms-prices');
    const navyTc = sizeCreative.variantRules.find((rule) => rule.id === 'navy-headlines|terms-prices');
    assert.equal(whiteTc?.props?.color, 'rgb(255, 255, 255)', `${size} white T&Cs`);
    assert.equal(navyTc?.props?.color, NAVY, `${size} navy T&Cs`);
  }
});

test('white/navy headline scopes exclude Act 4', () => {
  assert.equal(
    selectorForVariantRule({ scope: 'white-headlines', cssClass: 'sse-headline' }),
    '.white-headlines .sse-headline:not(#headline-act4)',
  );
  assert.equal(
    selectorForVariantRule({ scope: 'navy-headlines', cssClass: 'sse-headline' }),
    '.navy-headlines .sse-headline:not(#headline-act4)',
  );
});
