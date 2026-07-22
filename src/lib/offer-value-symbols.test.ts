import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  alignOfferValueSymbolsRuntime,
  wrapOfferValueSymbolRuntime,
  wrapOfferValueSymbolsHtml,
} from '@/lib/offer-value-symbols';
import { wrapOfferValueSymbols } from '@/lib/preview-utils';

test('wrapOfferValueSymbolsHtml scales trailing percent signs', () => {
  assert.equal(
    wrapOfferValueSymbolsHtml('15%'),
    '<span class="offer-value-run">15<span class="sym-pct">%</span></span>',
  );
});

test('wrapOfferValueSymbolsHtml scales leading pound and euro symbols', () => {
  assert.equal(
    wrapOfferValueSymbolsHtml('£50'),
    '<span class="offer-value-run"><span class="sym-pct">£</span>50</span>',
  );
  assert.equal(
    wrapOfferValueSymbolsHtml('€1,080'),
    '<span class="offer-value-run"><span class="sym-pct">€</span>1,080</span>',
  );
});

test('wrapOfferValueSymbolsHtml still wraps plain values in an inline run', () => {
  assert.equal(wrapOfferValueSymbolsHtml('50'), '<span class="offer-value-run">50</span>');
  assert.equal(wrapOfferValueSymbolsHtml('SAVE'), '<span class="offer-value-run">SAVE</span>');
});

test('wrapOfferValueSymbols trims feed values before wrapping', () => {
  assert.equal(
    wrapOfferValueSymbols('  £50 '),
    '<span class="offer-value-run"><span class="sym-pct">£</span>50</span>',
  );
});

test('align runtime measures against .offer-value even when symbol is nested in the run', () => {
  assert.match(alignOfferValueSymbolsRuntime, /closest\('\.offer-value'\)/);
  assert.match(wrapOfferValueSymbolRuntime, /offer-value-run/);
});

test('align runtime matches digit/symbol ink bottoms on the shared baseline', () => {
  assert.match(alignOfferValueSymbolsRuntime, /actualBoundingBoxDescent/);
  assert.match(alignOfferValueSymbolsRuntime, /measureText/);
  // Em/line-box bottoms overshoot Museo digit ink and drop %/£/€ too low.
  assert.doesNotMatch(alignOfferValueSymbolsRuntime, /getBoundingClientRect/);
});
