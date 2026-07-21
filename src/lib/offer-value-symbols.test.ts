import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  alignOfferValueSymbolsRuntime,
  wrapOfferValueSymbolsHtml,
} from '@/lib/offer-value-symbols';
import { wrapOfferValueSymbols } from '@/lib/preview-utils';

test('wrapOfferValueSymbolsHtml scales trailing percent signs', () => {
  assert.equal(wrapOfferValueSymbolsHtml('15%'), '15<span class="sym-pct">%</span>');
});

test('wrapOfferValueSymbolsHtml scales leading pound and euro symbols', () => {
  assert.equal(wrapOfferValueSymbolsHtml('£50'), '<span class="sym-pct">£</span>50');
  assert.equal(wrapOfferValueSymbolsHtml('€1,080'), '<span class="sym-pct">€</span>1,080');
});

test('wrapOfferValueSymbolsHtml leaves other offer text unchanged', () => {
  assert.equal(wrapOfferValueSymbolsHtml('50'), '50');
  assert.equal(wrapOfferValueSymbolsHtml('SAVE'), 'SAVE');
});

test('wrapOfferValueSymbols trims feed values before wrapping', () => {
  assert.equal(wrapOfferValueSymbols('  £50 '), '<span class="sym-pct">£</span>50');
});

test('align runtime matches digit/symbol ink bottoms on the shared baseline', () => {
  assert.match(alignOfferValueSymbolsRuntime, /actualBoundingBoxDescent/);
  assert.match(alignOfferValueSymbolsRuntime, /measureText/);
  // Em/line-box bottoms overshoot Museo digit ink and drop %/£/€ too low.
  assert.doesNotMatch(alignOfferValueSymbolsRuntime, /getBoundingClientRect/);
});
