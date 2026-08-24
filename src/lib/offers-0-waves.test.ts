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

test('offers-0 greenwave fades at settled rest; blue holds from start', () => {
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
    assert.equal(zeroGreen[0].preset, 'custom', `${size} green fade clip`);
    assert.equal(zeroGreen[0].start, 'green_in', `${size} green starts at green_in`);

    const beats = beatsForScopes(creative, ['offers-0', 'frames-3']);
    assert.ok(Number.isFinite(beats.green_in), `${size} green_in beat`);
    const restX = Number(multiGreen[0].params?.end_x ?? 0);
    const restY = Number(multiGreen[0].params?.end_y ?? multiGreen[0].params?.hold_y ?? 0);

    const greenFrames = compileAnimationClips(zeroGreen, beats);
    const blueFrames = compileAnimationClips(zeroBlue, beats);
    const midPhoto = frameAtPercent(blueFrames, 20);
    assert.equal(midPhoto.translate[0], Number(zeroBlue[0].params.end_x ?? 0), `${size} blue peek x`);
    assert.ok(midPhoto.opacity > 0.9, `${size} blue visible mid-photo`);

    const greenStart = resolveTimeRef('green_in', beats);
    const act4At = Number(beats.act4_in);
    assert.ok(Math.abs(act4At - greenStart - 3.3) < 0.05, `${size} ~0.5s fade window`);

    const before = frameAtPercent(greenFrames, Math.max(0, greenStart - 2));
    const midFade = frameAtPercent(greenFrames, (greenStart + act4At) / 2);
    const atAct4 = frameAtPercent(greenFrames, act4At);
    const nearEnd = frameAtPercent(greenFrames, 99.5);

    assert.ok(before.opacity < 0.05, `${size} green hidden before fade`);
    assert.ok(midFade.opacity > 0.2 && midFade.opacity < 0.9, `${size} green mid-fade`);
    assert.ok(atAct4.opacity > 0.95, `${size} green opaque at Act 4`);
    assert.ok(nearEnd.opacity < 0.3, `${size} green fades out at end`);
    assert.equal(before.translate[0], restX, `${size} rest x before`);
    assert.equal(atAct4.translate[0], restX, `${size} rest x at Act 4`);
    assert.equal(atAct4.translate[1], restY, `${size} rest y at Act 4`);
    assert.equal(before.translate[0], atAct4.translate[0], `${size} no green movement`);
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
    const roundelFrame = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|roundel-frame');
    const roundelCopy = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|roundel-copy');
    const roundelValue = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|roundel-value');
    assert.equal(roundelFrame?.props?.backgroundColor, NAVY, `${size} roundel navy fill`);
    assert.equal(roundelCopy?.props?.color, 'rgb(255, 255, 255)', `${size} roundel copy white`);
    assert.equal(roundelValue?.props?.color, 'rgb(255, 255, 255)', `${size} roundel value white`);
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
