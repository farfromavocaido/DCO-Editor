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

test('renders compound offers-0 CTA scopes as chained classes', () => {
  const css = structuredRuleCss({
    variantRules: [
      {
        scope: 'offers-0.cta-rect',
        cssClass: 'cta',
        props: { left: 18, width: 120, height: 36 },
      },
    ],
  });

  assert.match(css, /\.offers-0\.cta-rect \.cta/);
  assert.match(css, /left: 18px;/);
});

test('renders compound offers-0 roundel scopes as chained classes', () => {
  const css = structuredRuleCss({
    variantRules: [
      {
        scope: 'offers-0.roundel-split',
        cssClass: 'roundel-copy',
        props: { left: 48, top: 91 },
      },
    ],
  });

  assert.match(css, /\.offers-0\.roundel-split \.roundel-copy/);
  assert.match(css, /left: 48px;/);
});

test('colour-only ink scopes do not leak class height over offers-0 geometry', () => {
  const css = structuredRuleCss({
    classRules: [
      {
        cssClass: 'sse-headline',
        properties: { left: 17, top: 25, width: 255, fontSize: 18, height: 31 },
      },
    ],
    variantRules: [
      {
        id: 'offers-0|sse-headline',
        scope: 'offers-0',
        cssClass: 'sse-headline',
        props: {
          top: 13, left: 15, width: 267, height: 77, fontSize: 24,
        },
      },
      {
        id: 'white-headlines|sse-headline',
        scope: 'white-headlines',
        cssClass: 'sse-headline',
        props: { color: 'rgb(255, 255, 255)' },
      },
      {
        id: 'navy-headlines|sse-headline',
        scope: 'navy-headlines',
        cssClass: 'sse-headline',
        props: { color: 'rgb(0, 41, 117)' },
      },
    ],
  });

  assert.match(css, /\.offers-0 \.sse-headline(?::not\(#headline-act4\))? \{\n(?:.*\n)*?      height: 77px;/);
  assert.match(css, /\.white-headlines \.sse-headline(?::not\(#headline-act4\))? \{\n      color: rgb\(255, 255, 255\);\n    \}/);
  assert.match(css, /\.navy-headlines \.sse-headline(?::not\(#headline-act4\))? \{\n      color: rgb\(0, 41, 117\);\n    \}/);
  assert.doesNotMatch(css, /\.white-headlines[\s\S]*height: 31px/);
  assert.doesNotMatch(css, /\.navy-headlines[\s\S]*height: 31px/);
});
