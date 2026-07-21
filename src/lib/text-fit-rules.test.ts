import { test } from 'vitest';
import assert from 'node:assert/strict';

import { textFitRulesForSize } from './text-fit-rules';

const textLayer = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: 'text',
  base: { cssClass: id },
  clips: [],
  ...extra,
});

const headlineLayer = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  kind: 'text',
  base: { cssClass: 'sse-headline' },
  clips: [],
  ...extra,
});

const sizeCreative = (overrides: Record<string, unknown> = {}) => ({
  canvas: { width: 320, height: 50 },
  layers: [],
  classRules: [],
  variantRules: [],
  ...overrides,
});

const ruleFor = (rules: Array<Record<string, unknown>>, cssClass: string) => (
  rules.find((rule) => rule.cssClass === cssClass)
);

test('headline wrap fit keeps shared sizing, default maxLines and a real minimum', () => {
  const rules = textFitRulesForSize(sizeCreative({
    layers: [headlineLayer('headline-act1', { fit: { mode: 'wrap' } })],
    classRules: [{ cssClass: 'sse-headline', properties: { fontSize: 20 } }],
  }));

  const headline = ruleFor(rules, 'sse-headline');
  assert.ok(headline, 'headline rule missing');
  assert.equal(headline.shared, true, 'wrap fit must not disable shared equalized sizing');
  assert.equal(headline.wrap, true);
  assert.equal(headline.maxLines, 2);
  assert.equal(headline.minFontSize, 17); // 20 * 0.85 rounded
});

test('partial headline fit keeps the default minimum font size', () => {
  const rules = textFitRulesForSize(sizeCreative({
    layers: [headlineLayer('headline-act4', { fit: { maxLines: 4 } })],
    classRules: [{ cssClass: 'sse-headline', properties: { fontSize: 22 } }],
  }));

  const headline = ruleFor(rules, 'sse-headline');
  assert.equal(headline.maxLines, 4);
  assert.ok(Number(headline.minFontSize) >= 12, `minFontSize ${headline.minFontSize} must not collapse to 1px`);
});

test('only one headline rule is emitted for multiple headline layers', () => {
  const rules = textFitRulesForSize(sizeCreative({
    layers: [
      headlineLayer('headline-act1'),
      headlineLayer('headline-act2'),
      headlineLayer('headline-act3', { fit: { mode: 'wrap' } }),
    ],
  }));

  assert.equal(rules.filter((rule) => rule.cssClass === 'sse-headline').length, 1);
  assert.equal(ruleFor(rules, 'sse-headline').wrap, true, 'the layer carrying fit config wins');
});

test('offer values always get a shared, bottom-aligned group rule with tracking and a ratio floor', () => {
  const rules = textFitRulesForSize(sizeCreative({
    classRules: [{ cssClass: 'offer-value', properties: { fontSize: 41 } }],
  }));

  const value = ruleFor(rules, 'offer-value');
  assert.ok(value, 'offer-value rule must be synthesized even without explicit fit config');
  assert.equal(value.shared, true);
  assert.equal(value.align, 'bottom');
  assert.ok(value.tracking && Number(value.tracking.minEm) < 0, 'tracking squeeze must be enabled');
  assert.ok(Number(value.minFontSizeRatio) > 0, 'floor must scale with the variant base size');
  assert.equal(value.wrap, false);
});

test('offer sublines get a shared rule that merges authored fit config', () => {
  const rules = textFitRulesForSize(sizeCreative({
    classRules: [{
      cssClass: 'offer-subline',
      properties: { fontSize: 9 },
      fit: { mode: 'wrap', maxLines: 2, minFontSize: 6 },
    }],
  }));

  const subline = ruleFor(rules, 'offer-subline');
  assert.equal(subline.shared, true, 'authored wrap fit must not disable group equalization');
  assert.equal(subline.wrap, true);
  assert.equal(subline.allowShrink, false, 'wrap mode must keep the designed font size');
  assert.equal(subline.maxLines, 2);
  assert.equal(subline.minFontSize, 6);
});

test('shrink mode wraps only when maxLines is greater than 1', () => {
  const single = ruleFor(textFitRulesForSize(sizeCreative({
    classRules: [{
      cssClass: 'offer-subline',
      properties: { fontSize: 20 },
      fit: { mode: 'shrink', maxLines: 1 },
    }],
  })), 'offer-subline');
  const multi = ruleFor(textFitRulesForSize(sizeCreative({
    classRules: [{
      cssClass: 'offer-subline',
      properties: { fontSize: 20 },
      fit: { mode: 'shrink', maxLines: 2 },
    }],
  })), 'offer-subline');

  assert.equal(single.wrap, false);
  assert.equal(single.allowShrink, true);
  assert.equal(multi.wrap, true);
  assert.equal(multi.allowShrink, true);
  assert.equal(multi.maxLines, 2);
});

test('offer sublines without authored fit still get a shared shrink rule', () => {
  const rules = textFitRulesForSize(sizeCreative({
    classRules: [{ cssClass: 'offer-subline', properties: { fontSize: 24 } }],
  }));

  const subline = ruleFor(rules, 'offer-subline');
  assert.ok(subline, 'offer-subline rule must be synthesized');
  assert.equal(subline.shared, true);
  assert.equal(subline.wrap, false);
});

test('variant rules with fit config become scope overrides on the class rule', () => {
  const rules = textFitRulesForSize(sizeCreative({
    classRules: [{
      cssClass: 'offer-subline',
      properties: { fontSize: 24 },
      fit: { mode: 'wrap', maxLines: 2 },
    }],
    variantRules: [{
      scope: 'offers-3',
      cssClass: 'offer-subline',
      when: { offer_count_num: 3 },
      props: {},
      fit: { mode: 'shrink', maxLines: 1 },
    }],
  }));

  const subline = ruleFor(rules, 'offer-subline');
  assert.ok(subline.scopes, 'scope overrides missing');
  assert.equal(subline.scopes['offers-3'].wrap, false);
  assert.equal(subline.scopes['offers-3'].allowShrink, true);
  assert.equal(subline.scopes['offers-3'].maxLines, 1);
});

test('terms layers keep their shrink defaults', () => {
  const rules = textFitRulesForSize(sizeCreative({
    layers: [textLayer('terms-solo', { base: { cssClass: 'terms-solo', fontSize: 10 } })],
  }));

  const terms = ruleFor(rules, 'terms-solo');
  assert.equal(terms.wrap, false);
  assert.equal(terms.maxLines, 2);
  assert.ok(Number(terms.minFontSize) >= 6);
});

test('cta, images, shapes and groups are excluded', () => {
  const rules = textFitRulesForSize(sizeCreative({
    layers: [
      textLayer('cta'),
      { id: 'logo', kind: 'image', base: { cssClass: 'logo' }, clips: [] },
      { id: 'offer-slot-1', kind: 'group', base: { cssClass: 'offer-slot-1' }, clips: [] },
    ],
  }));

  assert.equal(ruleFor(rules, 'cta'), undefined);
  assert.equal(ruleFor(rules, 'logo'), undefined);
  assert.equal(ruleFor(rules, 'offer-slot-1'), undefined);
});

test('explicit class rule fit config still derives a minimum from its base size', () => {
  const rules = textFitRulesForSize(sizeCreative({
    classRules: [{ cssClass: 'roundel-value', properties: { fontSize: 17 }, fit: { minFontSize: 8 } }],
  }));

  const roundel = ruleFor(rules, 'roundel-value');
  assert.equal(roundel.minFontSize, 8, 'authored minFontSize wins');
  assert.equal(roundel.shared, false);
});
