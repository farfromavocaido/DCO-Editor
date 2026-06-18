import { test } from 'vitest';
import assert from 'node:assert/strict';

import { structuredRuleCss } from './creative-css';

test('renders offer internals with selectors specific enough to override manual CSS', () => {
  const css = structuredRuleCss({
    classRules: [
      { cssClass: 'offer-subline', properties: { top: 114, fontSize: 26 } },
    ],
    variantRules: [
      {
        scope: 'offers-3',
        cssClass: 'offer-subline',
        props: { top: 56, fontSize: 15 },
      },
    ],
  });

  assert.match(css, /\[data-gwd-group="OfferSlot"\] \.offer-subline/);
  assert.match(css, /\.offers-3 \[data-gwd-group="OfferSlot"\] \.offer-subline/);
  assert.match(css, /top: 56px;/);
});

test('renders ordinary layer variants with scoped class selectors', () => {
  const css = structuredRuleCss({
    variantRules: [
      { scope: 'cta-rect', cssClass: 'cta', props: { left: 90, borderRadius: 4 } },
    ],
  });

  assert.match(css, /\.cta-rect \.cta/);
  assert.match(css, /left: 90px;/);
  assert.match(css, /border-radius: 4px;/);
});
