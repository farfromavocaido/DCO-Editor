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

test('ad plumbing is group chrome only — no inherited type', () => {
  assert.match(adPlumbingCss, /\[data-gwd-group="OfferSlot"\]/);
  assert.match(adPlumbingCss, /\.tc-prices-group/);
  assert.match(adPlumbingCss, /\.tc-solo-group/);
  assert.doesNotMatch(adPlumbingCss, /font-family|font-weight|color\s*:/);
  assert.doesNotMatch(adPlumbingCss, /\.sse-text/);
});

test('offer-value symbol start size lives with the run CSS, not root CSS', () => {
  assert.match(offerValueSymbolCss, /\.offer-value \.sym-pct/);
  assert.match(offerValueSymbolCss, /font-size: 0\.6em/);
});
