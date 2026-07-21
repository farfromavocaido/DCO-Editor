# Text fitting

One engine fits text everywhere. `src/lib/text-fit.ts` holds the engine as an
ES5 source string: exported Studio HTML inlines it verbatim, and the editor
preview evaluates the same string. `src/lib/text-fit-rules.ts` derives the fit
rules from the creative JSON for both consumers. There is deliberately no
second implementation anywhere — if the preview fits text one way, the served
ad fits it the same way.

## Pipeline

Authored **modes** (not a draggable op-order):

| Mode | Behaviour |
|---|---|
| **shrink** | Shrink type until copy fits. `maxLines` ≤ 1 (or unset) → single line, no wrap. `maxLines` ≥ 2 → wrap up to that many lines, then shrink. |
| **wrap** | Keep the designed font size; wrap to `maxLines`; never shrink. |
| **clip** / **truncate** | No wrap or shrink — hide overflow only. |

Pipeline per element:

1. **White-space** — `normal` when wrapping is allowed, otherwise forced `nowrap`
   (CSS cannot override the mode).
2. **Tracking squeeze** — negative `letter-spacing` in small steps, bounded by
   `tracking.minEm` (offer values: −0.02em). Tried before any size change.
3. **Shrink** — when allowed: 0.5px steps to a floor of
   `max(minFontSize, base × minFontSizeRatio)`, until width + line budget fit.
4. **Clip leftover** — if still overflowing at the floor, overflow is hidden and
   the element is marked `data-fit-clipped` (editor shows a small red dot;
   hover for width / max-lines reason).

When `maxLines` is set, the edit/selection box height is derived as
`fontSize × lineHeight × maxLines`. Vertical alignment keeps the anchor edge:
top grows down, bottom grows up, centre grows both ways (`src/lib/fit-box.ts`).

Bottom-aligned flex boxes (`align-items: flex-end`) keep that alignment when
copy wraps: the last line stays on the baseline and earlier lines stack
*upward*. Top-aligned boxes grow downward as usual.

Rules with `shared: true` (headlines, offer values, offer sublines) equalize
the final size *and* tracking across all visible members — if one pricing
block is squeezed or shrunk, all of them are. Offer values also carry
`align: "bottom"`: when the shared size ends below the designed size, members
are translated down so the numerals keep sitting on the designed baseline.

## Per-variant overrides

A `variantRules` entry may carry a `fit` object; it becomes a scope override
on the class rule, applied when the ad state carries that scope class. This is
how the same subline wraps to two lines in offers-1 but stays on one shrunk
line in offers-2 / offers-3:

```json
{ "scope": "offers-2", "cssClass": "offer-subline", "fit": { "mode": "shrink", "maxLines": 1 } }
```

`classRules[].fit` is the **offers-1 / shared baseline**. Editing Fit in the
inspector under offers-1 writes there; under offers-2 or offers-3 it writes
`variantRules[].fit` (same independence pattern as layout `props`). Do not
rely on CSS `whiteSpace: nowrap` alone to block wrapping — the engine sets
`white-space: normal` when wrap is allowed.

## Font loading

Fitting measures the DOM, so it is only correct in the font that finally
renders. The runtime fits once at bootstrap (fast paint) and refits when
`document.fonts.ready` resolves (`scheduleFontRefit`); the editor preview does
the same. Fits are idempotent — every pass resets its inline styles first.

**The brand font is Museo — `Museo700-Regular.otf`, the slab family — NOT
Museo Sans.** They are different typefaces with different widths; substituting
one for the other both renders the wrong brand font and invalidates every
measurement. The canonical live URL is the Studio CDN asset in
`src/lib/brand-font.ts` (`MUSEO_CDN_URL`). The editor layout, `/api/creative/{size}/view`,
CDN base zips, and the GitHub Pages preview site all load that same file
(`local("☺")` + `font-weight: 100 900`). Downloadable client ZIPs stay
packaged/self-contained with the OTF under `campaign/assets/fonts`. Never map
the Museo family to `MuseoSans_700.otf`. Ad stacks are
`Museo, Arial, sans-serif`.

Offer-value `%` / `£` / `€` are wrapped in `.sym-pct` (0.6em). After text-fit,
`alignOfferValueSymbols` (editor + export, same ES5 body) nudges each symbol so
its **glyph ink bottom** matches the digits’ ink bottom on the shared alphabetic
baseline (`canvas` `actualBoundingBoxDescent`). Do not align
`getBoundingClientRect` bottoms — digit line/em boxes hang below Museo ink and
that approach drops the symbol too low.

## Tests

- `src/lib/text-fit.test.ts` — engine behaviour (tracking, groups, wrap,
  grow-down, bottom alignment, scope overrides, refit idempotence).
- `src/lib/text-fit-rules.test.ts` — rule derivation from the creative JSON.
- `src/server/__tests__/creative-exporter.test.ts` — the exported runtime:
  engine inlined and executable, texts bound before fitting, font refit wired,
  Museo-only packaging in every export flavour.
