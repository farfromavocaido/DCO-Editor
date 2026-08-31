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

/** Exact offers-0 bluewave stage2 from last committed settle (box + translate). */
const BLUE_STAGE2_EXACT = {
  '320x50': { left: -80, top: -20, width: 584, height: 90, tx: 0, ty: 0 },
  '728x90': { left: 455, top: -99, width: 1000, height: 296, tx: 0, ty: 0 },
  '300x250': { left: -1, top: 0, width: 214, height: 253, tx: 88, ty: 0 },
  '160x600': { left: -49, top: 316, width: 240, height: 284, tx: 0, ty: 0 },
  '300x600': { left: -38, top: 232, width: 340, height: 400, tx: 0, ty: 0 },
  '970x250': { left: 662, top: -119, width: 330, height: 391, tx: 0, ty: 0 },
};

/** Sizes that keep stage1 for the whole ad (no stage2 move). */
const BLUE_STAGE1_ONLY = new Set(['320x50', '160x600']);

test('offers-0 greenwave fades; blue starts at stage1, stages with green, returns to stage1', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    const green = sizeCreative.layers.find((layer) => layer.id === 'greenwave');
    const blue = sizeCreative.layers.find((layer) => layer.id === 'bluewave');
    assert.ok(green && blue, size);

    const multiGreen = clipsForProfile(green.clips, 'frames-3', MULTI);
    const zeroGreen = clipsForProfile(green.clips, 'frames-3', ['offers-0']);
    const zeroBlue = clipsForProfile(blue.clips, 'frames-3', ['offers-0']);
    const stage1Rule = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|bluewave');

    assert.equal(zeroGreen.length, 1, `${size} zero green`);
    assert.equal(zeroBlue.length, 1, `${size} zero blue`);
    assert.equal(zeroGreen[0].preset, 'custom', `${size} green fade clip`);
    assert.equal(zeroBlue[0].preset, 'custom', `${size} blue custom stages`);
    assert.ok(stage1Rule?.props, `${size} stage1 rule`);

    const beats = beatsForScopes(creative, ['offers-0', 'frames-3']);
    assert.ok(Number.isFinite(beats.green_in), `${size} green_in beat`);
    const restX = Number(multiGreen[0].params?.end_x ?? 0);
    const restY = Number(multiGreen[0].params?.end_y ?? multiGreen[0].params?.hold_y ?? 0);
    const stage2Exact = BLUE_STAGE2_EXACT[size];
    const stage1Only = BLUE_STAGE1_ONLY.has(size);

    const kfs = zeroBlue[0].keyframes || [];
    const startKf = kfs.find((kf) => kf.at === 'start');
    assert.ok(startKf, `${size} start keyframe`);
    for (const key of ['left', 'top', 'width', 'height']) {
      assert.equal(startKf[key], stage1Rule.props[key], `${size} starts at stage1 ${key}`);
    }
    assert.equal(startKf.opacity, 1, `${size} opaque at start`);

    const greenFrames = compileAnimationClips(zeroGreen, beats);
    const blueFrames = compileAnimationClips(zeroBlue, beats);
    const atStart = frameAtPercent(blueFrames, 0);
    const atGreen = frameAtPercent(blueFrames, Number(beats.green_in));
    const atAct4 = frameAtPercent(blueFrames, Number(beats.act4_in));
    const atEnd = frameAtPercent(blueFrames, 100);

    assert.equal(atStart.left, stage1Rule.props.left, `${size} stage1 left at 0`);
    assert.equal(atStart.width, stage1Rule.props.width, `${size} stage1 width at 0`);
    assert.ok(atStart.opacity > 0.95, `${size} visible at start`);
    assert.equal(atGreen.left, stage1Rule.props.left, `${size} still stage1 at green_in`);
    assert.ok(atEnd.opacity > 0.95, `${size} no end fade — still visible`);
    assert.equal(atEnd.left, stage1Rule.props.left, `${size} back to stage1 left at end`);
    assert.equal(atEnd.top, stage1Rule.props.top, `${size} back to stage1 top at end`);
    assert.equal(atEnd.width, stage1Rule.props.width, `${size} back to stage1 width at end`);
    assert.equal(atEnd.height, stage1Rule.props.height, `${size} back to stage1 height at end`);

    if (stage1Only) {
      assert.equal(atAct4.left, stage1Rule.props.left, `${size} stays stage1 at act4`);
      assert.ok(!kfs.some((kf) => kf.at === 'act4_in'), `${size} no stage2 keyframe`);
    } else {
      assert.equal(atAct4.left, stage2Exact.left, `${size} stage2 left at act4`);
      assert.equal(atAct4.top, stage2Exact.top, `${size} stage2 top at act4`);
      assert.equal(atAct4.width, stage2Exact.width, `${size} stage2 width at act4`);
      assert.equal(atAct4.height, stage2Exact.height, `${size} stage2 height at act4`);
      assert.equal(atAct4.translate[0], stage2Exact.tx, `${size} stage2 tx at act4`);
      assert.equal(atAct4.translate[1], stage2Exact.ty, `${size} stage2 ty at act4`);
      assert.equal(atAct4.scale, 1, `${size} scale 1 at act4`);
      assert.ok(kfs.some((kf) => kf.at === 'end-3.3'), `${size} return window`);
    }

    const greenStart = resolveTimeRef('green_in', beats);
    const act4At = Number(beats.act4_in);
    assert.ok(Math.abs(act4At - greenStart - 3.3) < 0.05, `${size} ~0.5s fade window`);

    const before = frameAtPercent(greenFrames, Math.max(0, greenStart - 2));
    const midFade = frameAtPercent(greenFrames, (greenStart + act4At) / 2);
    const greenAtAct4 = frameAtPercent(greenFrames, act4At);
    const nearEnd = frameAtPercent(greenFrames, 99.5);

    assert.ok(before.opacity < 0.05, `${size} green hidden before fade`);
    assert.ok(midFade.opacity > 0.2 && midFade.opacity < 0.9, `${size} green mid-fade`);
    assert.ok(greenAtAct4.opacity > 0.95, `${size} green opaque at Act 4`);
    assert.ok(nearEnd.opacity < 0.3, `${size} green fades out at end`);
    assert.equal(before.translate[0], restX, `${size} rest x before`);
    assert.equal(greenAtAct4.translate[0], restX, `${size} rest x at Act 4`);
    assert.equal(greenAtAct4.translate[1], restY, `${size} rest y at Act 4`);
  }
});

test('offers-0 T&C fades out just before greenwave', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    const terms = sizeCreative.layers.find((layer) => layer.id === 'terms-prices');
    assert.ok(terms, size);
    const multi = clipsForProfile(terms.clips, 'frames-3', MULTI);
    const zero = clipsForProfile(terms.clips, 'frames-3', ['offers-0']);
    assert.equal(multi.length, 1, `${size} multi terms`);
    assert.equal(zero.length, 1, `${size} offers-0 terms`);
    assert.equal(zero[0].end, 'green_in', `${size} terms end at green_in`);
    assert.equal(multi[0].end, 'act1_out', `${size} multi terms unchanged`);

    const beats = beatsForScopes(creative, ['offers-0', 'frames-3']);
    const frames = compileAnimationClips(zero, beats);
    const greenIn = Number(beats.green_in);
    const midPhoto = frameAtPercent(frames, Math.max(25, greenIn / 2));
    const atGreen = frameAtPercent(frames, greenIn);
    assert.ok(midPhoto.opacity > 0.9, `${size} terms visible mid-photo`);
    assert.ok(atGreen.opacity < 0.05, `${size} terms gone at green_in`);
  }
});

test('offers-0 white logo from start; blue logo hidden with no multi fade', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    const blueLogo = sizeCreative.layers.find((layer) => layer.id === 'logo-act1');
    const whiteLogo = sizeCreative.layers.find((layer) => layer.id === 'logo-act3');
    assert.ok(blueLogo && whiteLogo, size);

    assert.equal(clipsForProfile(blueLogo.clips, 'frames-3', ['offers-0']).length, 0, `${size} no blue logo motion`);
    assert.equal(clipsForProfile(blueLogo.clips, 'frames-3', MULTI).length, 1, `${size} multi blue logo fade`);

    const zeroWhite = clipsForProfile(whiteLogo.clips, 'frames-3', ['offers-0']);
    const multiWhite = clipsForProfile(whiteLogo.clips, 'frames-3', MULTI);
    assert.equal(zeroWhite.length, 1, `${size} offers-0 white clip`);
    assert.equal(multiWhite.length, 1, `${size} multi white clip`);
    assert.equal(zeroWhite[0].preset, 'fade', `${size} white fade clip`);
    assert.equal(zeroWhite[0].start, 'start+5', `${size} white starts mid bluewave`);
    assert.equal(zeroWhite[0].params?.enter_duration_pct, 5, `${size} white enter 5%`);

    const hideBlue = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|logo-act1|visibility');
    assert.equal(hideBlue?.props?.visibility, 'hidden', `${size} blue logo hidden`);

    const beats = beatsForScopes(creative, ['offers-0', 'frames-3']);
    const frames = compileAnimationClips(zeroWhite, beats);
    const before = frameAtPercent(frames, 4);
    const midFade = frameAtPercent(frames, 7.5);
    const settled = frameAtPercent(frames, 10);
    const mid = frameAtPercent(frames, 50);
    assert.ok(before.opacity < 0.05, `${size} white logo hidden before mid-sweep`);
    assert.ok(midFade.opacity > 0.2 && midFade.opacity < 0.95, `${size} white logo mid-fade`);
    assert.ok(settled.opacity > 0.95, `${size} white logo opaque when blue settles`);
    assert.ok(mid.opacity > 0.95, `${size} white logo opaque mid`);
  }
});

test('offers-0 headlines restore shared geometry; Act 4 colour only; T&Cs always white', () => {
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
    if (size === '320x50') {
      assert.deepEqual(act4?.props, { color: 'rgb(255, 255, 255)' }, `${size} act4 white`);
    } else {
      assert.deepEqual(act4?.props, { color: NAVY }, `${size} act4 colour-only navy`);
    }
    const ctaRect = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0.cta-rect|cta');
    const ctaRoundel = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0.cta-roundel|cta');
    if (size === '320x50') {
      assert.equal(ctaRect?.props?.backgroundColor, 'rgb(0, 229, 165)', `${size} CTA green fill`);
      assert.equal(ctaRect?.props?.color, NAVY, `${size} CTA navy text`);
      assert.equal(ctaRoundel?.props?.backgroundColor, 'rgb(0, 229, 165)', `${size} roundel CTA green fill`);
      assert.equal(ctaRoundel?.props?.color, NAVY, `${size} roundel CTA navy text`);
    } else {
      assert.equal(ctaRect?.props?.backgroundColor, NAVY, `${size} CTA navy fill`);
      assert.equal(ctaRect?.props?.color, 'rgb(255, 255, 255)', `${size} CTA white text`);
    }
    const whiteTc = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|terms-prices|color');
    const navyTc = sizeCreative.variantRules.find((rule) => rule.id === 'navy-headlines|terms-prices');
    assert.equal(whiteTc?.props?.color, 'rgb(255, 255, 255)', `${size} offers-0 T&Cs always white`);
    assert.equal(navyTc, undefined, `${size} T&Cs detached from navy ink`);
    assert.ok(
      !sizeCreative.variantRules.some((rule) => rule.id === 'white-headlines|terms-prices'),
      `${size} no white-headlines T&C colour rule`,
    );
    const roundelFrame = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|roundel-frame');
    const roundelCopy = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|roundel-copy');
    const roundelValue = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|roundel-value');
    assert.equal(roundelFrame?.props?.backgroundColor, 'rgb(0, 229, 165)', `${size} roundel green fill`);
    assert.equal(roundelCopy?.props?.color, NAVY, `${size} roundel copy navy`);
    assert.equal(roundelValue?.props?.color, NAVY, `${size} roundel value navy`);
    assert.equal(
      sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|unit-rate-prices|visibility')?.props?.visibility,
      'hidden',
      `${size} unit-rate hidden on offers-0`,
    );
  }
});

test('offers-0 headline scrim is bottom-up and under the bluewave', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    const scrim = sizeCreative.layers.find((layer) => layer.id === 'headline-scrim');
    const blue = sizeCreative.layers.find((layer) => layer.id === 'bluewave');
    assert.ok(scrim && blue, size);
    assert.equal(scrim.gradient?.direction, 'to-top', `${size} scrim to-top`);
    assert.ok(scrim.zIndex < blue.zIndex, `${size} scrim behind bluewave`);
    assert.ok(
      sizeCreative.variantRules.some((rule) => rule.id === 'offers-0|headline-scrim|visibility'),
      `${size} scrim always on offers-0`,
    );
    assert.ok(
      !sizeCreative.variantRules.some((rule) => String(rule.id).includes('headlines|headline-scrim')),
      `${size} scrim not ink-gated`,
    );
  }
});

test('white/navy/offers-0 headline scopes exclude Act 4', () => {
  assert.equal(
    selectorForVariantRule({ scope: 'white-headlines', cssClass: 'sse-headline' }),
    '.white-headlines .sse-headline:not(#headline-act4)',
  );
  assert.equal(
    selectorForVariantRule({ scope: 'navy-headlines', cssClass: 'sse-headline' }),
    '.navy-headlines .sse-headline:not(#headline-act4)',
  );
  assert.equal(
    selectorForVariantRule({ scope: 'offers-0', cssClass: 'sse-headline' }),
    '.offers-0 .sse-headline:not(#headline-act4)',
  );
  assert.equal(
    selectorForVariantRule({ scope: 'offers-0', layerId: 'headline-act4', props: { color: NAVY } }),
    '.offers-0 #headline-act4',
  );
});
