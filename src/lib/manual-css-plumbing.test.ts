import assert from 'node:assert/strict';
import {test} from 'vitest';
import {adPlumbingCss} from './ad-plumbing-css';
import {offerValueSymbolCss} from './offer-value-symbols';

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
