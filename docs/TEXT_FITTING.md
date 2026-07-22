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

1. **White-space** — `pre-line` when wrapping is allowed (keeps authored `\n`),
   otherwise forced `nowrap` (CSS cannot override the mode).
2. **Tracking squeeze** — negative `letter-spacing` in small steps, bounded by
   `tracking.minEm` (offer values: −0.05em). Tried before any size change, and
   applied **per box**. A tight value does not force tracking onto a comfortable
   neighbour. The inspector Typography panel shows the tightest effective
   tracking for the class next to the auto-fitted font size.
3. **Shrink** — when allowed: 0.5px steps to a floor of
   `max(minFontSize, base × minFontSizeRatio)`, until width + line budget fit.
4. **Clip leftover** — if still overflowing at the floor, overflow is hidden and
   the element is marked `data-fit-clipped` (editor shows a small red dot;
   hover for width / max-lines reason).

When `maxLines` is set **and height is unset**, the edit/selection box height
is derived as `fontSize × lineHeight × maxLines`. An explicit authored height
always wins (maxLines stays a text-fit constraint only) so tight offer boxes
are not inflated for chrome. Vertical alignment keeps the anchor edge when the
budget does apply: top grows down, bottom grows up, centre grows both ways
(`src/lib/fit-box.ts`).

Bottom-aligned flex boxes (`align-items: flex-end`) keep that alignment when
copy wraps: the last line stays on the baseline and earlier lines stack
*upward*. Top-aligned boxes grow downward as usual.

Rules with `shared: true` (headlines, offer values, offer sublines) equalize
the final **font size** across all visible members — if one pricing block must
shrink, all of them do. Tracking stays independent per box (recomputed at the
shared size). Offer values also carry `align: "bottom"`: when the shared size
ends below the designed size, members are translated down so the numerals keep
sitting on the designed baseline.

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
`white-space: pre-line` when wrap is allowed.

## Font loading

Fitting measures the DOM, so it is only correct in the font that finally
renders. The runtime fits once at bootstrap (fast paint) and schedules **one**
refit when `document.fonts.ready` resolves (`scheduleFontRefit` → rAF). It does
**not** also listen for `loadingdone` (that re-ran layout mid fadeUp enter and
fought plus placement). The editor preview mirrors the same fonts.ready refit.
Fits are idempotent — every pass resets its inline styles first.

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

Offer-value copy is wrapped in `.offer-value-run` (one inline flex child) with
`%` / `£` / `€` in `.sym-pct` (0.6em). The run keeps digit+symbol on a shared
alphabetic baseline even when `.offer-value` uses `display:flex` +
`align-items:flex-end` (inspector bottom-align). After text-fit,
`alignOfferValueSymbols` (editor + export, same ES5 body) nudges each symbol so
its **glyph ink bottom** matches the digits’ ink bottom
(`canvas` `actualBoundingBoxDescent`). Do not align `getBoundingClientRect`
bottoms — digit line/em boxes hang below Museo ink and that approach drops the
symbol too low.

## Offer layout (post-fit)

`src/lib/offer-layout.ts` runs after symbol align (editor + export, same ES5
body). Pipeline: fit against **authored** boxes → symbol align → distribute
slots/pluses (and side-by-side re-anchor).

**Ink-first invariant:** every content measurement (value run, subline copy, `+`
glyph, cluster bounds for gaps) uses Range text ink — never the CSS/line box
(`offsetHeight` / element `getBoundingClientRect`). Authored boxes are often
shorter than wrapped copy, and Museo line-boxes hang below the visible mark;
both skew mid-gap placement. CSS boxes are only for authored envelopes, family
detection, and writing `left`/`top` (motion `transform` left alone after layout).

**Transform-neutral plus placement:** `placePlus` temporarily clears the plus’s
`animation` / `transform` while measuring glyph ink, then restores them. Durable
`left`/`top` must not bake fadeUp `enter_dy` (or the editor playhead enter pose).
This keeps Replay / cached-font loads aligned with cold first paint and with the
editor stage regardless of scrub percent.

**Authored subline width is the fit constraint** (pink text box in the
inspector). Value-ink × 1.10 is a design guide when authoring only — the
runtime must not overwrite subline width, or copy wraps to a narrower box than
you set.

| Family | How detected | Behaviour |
|---|---|---|
| stacked subline | subline mostly below value | leave authored width/left/top alone |
| side-by-side | subline to the right and starts above the value box bottom | keep authored width/**top** (baseline via flex-end in a real height box); runtime only re-anchors **left** to value-ink right so drag still works |
| horizontal | 2+ slots, wider Δx | equal ink-cluster gaps; plus at value-ink midpoint (glyph-centred) |
| vertical | 2+ slots, taller Δy | equal gaps; plus Y = upper **cluster ink** bottom → next value ink top |
| triangular | two top-row + one centred below | equalize top pair; centre bottom under top centroid; plus is SVG (`assets/SVG/sse-plus.svg`) filling a square box — top-aligned to max(top-row value bottoms) by default; on `300x250` / `970x250` plus top meets top-row subline caps (`300x600` unchanged); X in the gap between top value inks |

Plus anchors are named helpers (`plusAnchorHorizontal` / `Vertical` /
`Triangular`) so family rules stay explicit and shared through `placePlus`.

## Tests

- `src/lib/text-fit.test.ts` — engine behaviour (tracking, groups, wrap,
  grow-down, bottom alignment, scope overrides, refit idempotence).
- `src/lib/text-fit-rules.test.ts` — rule derivation from the creative JSON.
- `src/lib/offer-layout.test.ts` — ink-first plus placement (overflowing
  subline box, glyph vs line-box), side-by-side ink lock, runtime shape.
- `src/server/__tests__/creative-exporter.test.ts` — the exported runtime:
  engine inlined and executable, texts bound before fitting, font refit wired,
  Museo-only packaging in every export flavour.
