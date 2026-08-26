// @ts-nocheck

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'vitest';

import { clipsForProfile } from '@/lib/headline-motion';
import { selectorForVariantRule } from '@/lib/creative-css';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const creative = JSON.parse(
  readFileSync(path.join(root, 'campaign/sse-dco-creative.json'), 'utf8'),
);

const MULTI = ['offers-1', 'offers-2', 'offers-3'];
const NAVY = 'rgb(0, 41, 117)';
const GREEN = 'rgb(0, 229, 165)';
const WHITE = 'rgb(255, 255, 255)';

/** Restored baseline (pre-navy/evergreen): banners L→R, portraits T→B. */
const SCRIM_DIRECTION = {
  '320x50': 'to-right',
  '728x90': 'to-right',
  '970x250': 'to-right',
  '300x250': 'to-bottom',
  '160x600': 'to-bottom',
  '300x600': 'to-bottom',
};

test('offers-0 hides greenwave; bluewave keeps shared waveSweep + stage geometry', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    const green = sizeCreative.layers.find((layer) => layer.id === 'greenwave');
    const blue = sizeCreative.layers.find((layer) => layer.id === 'bluewave');
    assert.ok(green && blue, size);

    const hideGreen = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|greenwave|visibility');
    assert.equal(hideGreen?.props?.visibility, 'hidden', `${size} greenwave hidden`);

    const multiGreen = clipsForProfile(green.clips, 'frames-3', MULTI);
    const zeroGreen = clipsForProfile(green.clips, 'frames-3', ['offers-0']);
    const multiBlue = clipsForProfile(blue.clips, 'frames-3', MULTI);
    const zeroBlue = clipsForProfile(blue.clips, 'frames-3', ['offers-0']);
    // Unscoped waveSweep clips apply to all offer counts (visibility gates green).
    assert.equal(multiGreen.length, 1, `${size} multi green`);
    assert.equal(zeroGreen.length, 1, `${size} zero green clip still present`);
    assert.equal(multiBlue.length, 1, `${size} multi blue`);
    assert.equal(zeroBlue.length, 1, `${size} zero blue`);
    assert.equal(zeroGreen[0].preset, 'waveSweep', `${size} green waveSweep`);
    assert.equal(zeroBlue[0].preset, 'waveSweep', `${size} blue waveSweep`);

    const stageRule = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|bluewave');
    assert.ok(stageRule?.props, `${size} offers-0 bluewave geometry`);
    for (const key of ['left', 'top', 'width', 'height']) {
      assert.equal(typeof stageRule.props[key], 'number', `${size} bluewave ${key}`);
    }
  }
});

test('offers-0 hides T&Cs; shared terms clip still ends at act1_out', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    const terms = sizeCreative.layers.find((layer) => layer.id === 'terms-prices');
    assert.ok(terms, size);

    for (const id of [
      'offers-0|terms-prices|visibility',
      'offers-0|terms-solo|visibility',
      'offers-0|unit-rate-prices|visibility',
      'offers-0|tc-solo-group|visibility',
      'offers-0|tc-prices-group|visibility',
    ]) {
      const rule = sizeCreative.variantRules.find((entry) => entry.id === id);
      assert.equal(rule?.props?.visibility, 'hidden', `${size} ${id}`);
    }

    const multi = clipsForProfile(terms.clips, 'frames-3', MULTI);
    const zero = clipsForProfile(terms.clips, 'frames-3', ['offers-0']);
    assert.equal(multi.length, 1, `${size} multi terms`);
    assert.equal(zero.length, 1, `${size} offers-0 terms clip`);
    assert.equal(zero[0].end, 'act1_out', `${size} terms end at act1_out`);
    assert.equal(multi[0].end, 'act1_out', `${size} multi terms unchanged`);
  }
});

test('offers-0 hides blue logo; white logo keeps shared fade-in', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    const blueLogo = sizeCreative.layers.find((layer) => layer.id === 'logo-act1');
    const whiteLogo = sizeCreative.layers.find((layer) => layer.id === 'logo-act3');
    assert.ok(blueLogo && whiteLogo, size);

    const hideBlue = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|logo-act1|visibility');
    assert.equal(hideBlue?.props?.visibility, 'hidden', `${size} blue logo hidden`);

    // Logo clips are unscoped — visibility hides blue; white still fades in.
    assert.equal(clipsForProfile(blueLogo.clips, 'frames-3', ['offers-0']).length, 1, `${size} blue clip present`);
    assert.equal(clipsForProfile(blueLogo.clips, 'frames-3', MULTI).length, 1, `${size} multi blue logo fade`);

    const zeroWhite = clipsForProfile(whiteLogo.clips, 'frames-3', ['offers-0']);
    const multiWhite = clipsForProfile(whiteLogo.clips, 'frames-3', MULTI);
    assert.equal(zeroWhite.length, 1, `${size} offers-0 white clip`);
    assert.equal(multiWhite.length, 1, `${size} multi white clip`);
    assert.equal(zeroWhite[0].preset, 'fade', `${size} white fade clip`);
    assert.ok(zeroWhite[0].start, `${size} white has start beat`);

    const whiteGeom = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|logo-act3');
    assert.ok(whiteGeom?.props, `${size} offers-0 white logo geometry`);
  }
});

test('offers-0 white headlines; CTA and roundel use green fill + navy text', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    const sse = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|sse-headline');
    assert.ok(sse, `${size} offers-0|sse-headline`);
    assert.equal(sse.props.color, WHITE, `${size} headlines white`);

    const ctaRect = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0.cta-rect|cta');
    const ctaRoundel = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0.cta-roundel|cta');
    assert.equal(ctaRect?.props?.backgroundColor, GREEN, `${size} CTA green fill`);
    assert.equal(ctaRect?.props?.color, NAVY, `${size} CTA navy text`);
    assert.equal(ctaRoundel?.props?.backgroundColor, GREEN, `${size} roundel CTA green fill`);
    assert.equal(ctaRoundel?.props?.color, NAVY, `${size} roundel CTA navy text`);

    const roundelFrame = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|roundel-frame');
    const roundelCopy = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|roundel-copy');
    const roundelValue = sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|roundel-value');
    assert.equal(roundelFrame?.props?.backgroundColor, GREEN, `${size} roundel green fill`);
    assert.equal(roundelCopy?.props?.color, NAVY, `${size} roundel copy navy`);
    assert.equal(roundelValue?.props?.color, NAVY, `${size} roundel value navy`);
  }
});

test('offers-0 headline scrim and bg-blur are visible under bluewave', () => {
  for (const size of Object.keys(creative.sizes)) {
    const sizeCreative = creative.sizes[size];
    const scrim = sizeCreative.layers.find((layer) => layer.id === 'headline-scrim');
    const blur = sizeCreative.layers.find((layer) => layer.id === 'bg-blur');
    const blue = sizeCreative.layers.find((layer) => layer.id === 'bluewave');
    assert.ok(scrim && blur && blue, size);
    assert.equal(scrim.gradient?.direction, SCRIM_DIRECTION[size], `${size} scrim direction`);
    assert.ok(scrim.zIndex < blue.zIndex, `${size} scrim behind bluewave`);
    assert.ok(blur.zIndex < scrim.zIndex, `${size} blur under scrim`);
    assert.equal(
      sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|headline-scrim|visibility')?.props?.visibility,
      'visible',
      `${size} scrim on offers-0`,
    );
    assert.equal(
      sizeCreative.variantRules.find((rule) => rule.id === 'offers-0|bg-blur|visibility')?.props?.visibility,
      'visible',
      `${size} blur on offers-0`,
    );
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
