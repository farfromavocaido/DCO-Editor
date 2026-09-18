// Approved-creative checks: run separately with npm run test:creative.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'vitest';

import { adPlumbingCss } from '@/lib/ad-plumbing-css';
import { structuredRuleCss } from '@/lib/creative-css';
import { offerValueSymbolCss } from '@/lib/offer-value-symbols';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const creative = JSON.parse(
  readFileSync(path.join(root, 'campaign/sse-dco-creative.json'), 'utf8'),
);

const NAVY = 'rgb(0, 41, 117)';
const MUSEO = 'Museo, Arial, sans-serif';
const CLASS_OWNERS = ['sse-headline', 'offer-value', 'offer-subline'];
const LAYER_OWNERS = ['terms-prices', 'unit-rate-prices', 'terms-solo'];

test('SSE DCO sizes keep type on owners and empty manualCss', () => {
  for (const [size, sizeCreative] of Object.entries(creative.sizes)) {
    assert.equal(sizeCreative.manualCss, '', `${size} manualCss`);
    for (const cssClass of CLASS_OWNERS) {
      const rule = sizeCreative.classRules.find((item) => item.cssClass === cssClass);
      assert.ok(rule, `${size} ${cssClass}`);
      assert.equal(rule.properties.fontFamily, MUSEO, `${size} ${cssClass} family`);
      assert.equal(rule.properties.fontWeight, 700, `${size} ${cssClass} weight`);
      assert.equal(rule.properties.color, NAVY, `${size} ${cssClass} color`);
    }
    for (const layerId of LAYER_OWNERS) {
      const layer = sizeCreative.layers.find((item) => item.id === layerId);
      assert.ok(layer, `${size} ${layerId}`);
      assert.equal(layer.base.fontFamily, MUSEO, `${size} ${layerId} family`);
      assert.equal(layer.base.fontWeight, 300, `${size} ${layerId} weight`);
      assert.equal(layer.base.color, NAVY, `${size} ${layerId} color`);
      assert.equal(layer.base.lineHeight, 1.3, `${size} ${layerId} line-height`);
    }
    for (const layerId of ['terms-prices', 'unit-rate-prices', 'terms-solo']) {
      const layer = sizeCreative.layers.find((item) => item.id === layerId);
      assert.equal(layer.base.whiteSpace, 'pre-line', `${size} ${layerId} white-space`);
    }
    const hide = sizeCreative.variantRules.find(
      (rule) => rule.id === 'roundel-frame-off|headline-act3|visibility',
    );
    assert.ok(hide, `${size} roundel-frame-off hides act3`);
    assert.equal(hide.layerId, 'headline-act3');
    assert.equal(hide.props.visibility, 'hidden');
  }
});

test('banner Act 4 extras from the old root sheet stay as unscoped variants', () => {
  const banner = creative.sizes['320x50'].variantRules.find(
    (rule) => rule.id === 'headline-act4|endframe',
  );
  const leader = creative.sizes['728x90'].variantRules.find(
    (rule) => rule.id === 'headline-act4|endframe-top',
  );
  assert.deepEqual(banner.props, { color: 'rgb(255, 255, 255)', top: 9 });
  assert.deepEqual(leader.props, { top: 14 });
  assert.match(structuredRuleCss(creative.sizes['320x50']), /#headline-act4 \{\n      color: rgb\(255, 255, 255\);\n      top: 9px;/);
});

test('MPU 0-offer T&C box matches the saved creative baseline', () => {
  const mpu = creative.sizes['300x250'];
  const css = structuredRuleCss(mpu);
  assert.match(css, /\.roundel-frame-off #headline-act3/);
  assert.match(css, /visibility: hidden;/);
  const solo = mpu.variantRules.find((rule) => rule.id === 'offers-0.tc-solo|terms-prices');
  assert.deepEqual(
    {
      left: solo.props.left,
      top: solo.props.top,
      width: solo.props.width,
      height: solo.props.height,
      fontSize: solo.props.fontSize,
    },
    { left: 6, top: 210, width: 103, height: 56, fontSize: 6 },
  );
});
