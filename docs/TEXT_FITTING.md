# Text fitting

One engine fits text everywhere. `src/lib/text-fit.ts` holds the engine as an
ES5 source string: exported Studio HTML inlines it verbatim, and the editor
preview evaluates the same string. `src/lib/text-fit-rules.ts` derives the fit
rules from the creative JSON for both consumers. There is deliberately no
second implementation anywhere — if the preview fits text one way, the served
ad fits it the same way.

## Pipeline

Each rule targets a css class and runs its members through, in order:

1. **Tracking squeeze** — negative `letter-spacing` in small steps, bounded by
   `tracking.minEm` (offer values: −0.02em). Tried before any size change.
2. **Wrap** — only when the rule allows it (`mode: "wrap"` in the JSON).
   `maxLines` is enforced: content that exceeds it falls through to shrink.
   Wrapped multi-line content in a bottom-anchored flex box is re-anchored to
   the top so the second line goes *down*, never pushing line one up.
3. **Shrink** — 0.5px steps to a floor of
   `max(minFontSize, base × minFontSizeRatio)`, so the floor scales with each
   variant's designed size instead of being a global constant.

Rules with `shared: true` (headlines, offer values, offer sublines) equalize
the final size *and* tracking across all visible members — if one pricing
block is squeezed or shrunk, all of them are. Offer values also carry
`align: "bottom"`: when the shared size ends below the designed size, members
are translated down so the numerals keep sitting on the designed baseline.

## Per-variant overrides

A `variantRules` entry may carry a `fit` object; it becomes a scope override
on the class rule, applied when the ad state carries that scope class. This is
how the same subline wraps to two lines in 300x250 but stays on one shrunk
line in the stacked 320x50 layouts:

```json
{ "scope": "offers-2", "cssClass": "offer-subline", "fit": { "mode": "shrink", "maxLines": 1 } }
```

## Font loading

Fitting measures the DOM, so it is only correct in the font that finally
renders. The runtime fits once at bootstrap (fast paint) and refits when
`document.fonts.ready` resolves (`scheduleFontRefit`); the editor preview does
the same. Fits are idempotent — every pass resets its inline styles first.

**The brand font is Museo — `Museo700-Regular.otf`, the slab family — NOT
Museo Sans.** They are different typefaces with different widths; substituting
one for the other both renders the wrong brand font and invalidates every
measurement. Every export flavour packages and `@font-face`s that exact file
(`local("☺")` in the src list stops installed fonts masking it), the editor
loads it through the `/assets` proxy, and no CDN mapping may point the Museo
family at any other file. Ad font stacks are `Museo, Arial, sans-serif` — no
Museo Sans fallback that could silently mask a load failure.

## Tests

- `src/lib/text-fit.test.ts` — engine behaviour (tracking, groups, wrap,
  grow-down, bottom alignment, scope overrides, refit idempotence).
- `src/lib/text-fit-rules.test.ts` — rule derivation from the creative JSON.
- `src/server/__tests__/creative-exporter.test.ts` — the exported runtime:
  engine inlined and executable, texts bound before fitting, font refit wired,
  Museo-only packaging in every export flavour.
