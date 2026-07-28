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
   otherwise forced `nowrap` (CSS cannot override the mode). Authored hard
   breaks use the same line-box height as soft-wrapped lines
   (`fontSize × lineHeight`). Outline export mirrors this: `wrapLines` splits
   on `\n` first, then soft-wraps each segment; presentation snapshots keep
   newlines so bake sees the same copy as the live preview.
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
renders. Exported ads **pause the CSS motion clock** until Museo is ready:

1. Stage starts without `.motion-ready` → `animation-play-state: paused` (t=0).
2. Bootstrap binds feed copy and runs an immediate fit/layout pass.
3. `document.fonts.ready` → one layout commit (`commitOfferLayout`) → rAF →
   add `.motion-ready` so keyframes run from a clean t=0.
4. A 3s timeout releases motion even if the Font Loading API hangs.

Cold first impression therefore matches warm Replay: pluses and offers share
one timeline after correct Museo metrics. The runtime does **not** listen for
`loadingdone` (that re-ran layout mid fadeUp). `placePlus` pauses the plus
playhead while measuring (never `animation: none`, which restarts clips).
The editor preview still refits on `fonts.ready`; `layoutOffers` clears offer
slot motion transforms for that measure pass so scrub pose matches export rest.
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

**Ink-first invariant:** content edges for offer layout use canvas
`actualBoundingBoxAscent` / `Descent` (true Museo glyph ink). The DOM Range
only locates the line so half-leading can be stripped from the alphabetic
baseline — raw Range rects are line-box-ish and bias vertical pluses upward.
Range lines are unscaled into ancestor-local CSS px *before* combining with
canvas metrics (editor stage `transform: scale` must not mix screen-px with
font-size px). Falls back to Range → CSS box when canvas metrics are missing.
CSS boxes are only for authored envelopes, family detection, and writing
`left`/`top`.

**Transform-neutral plus placement:** SVG plus *images* are placed from the CSS
layout box (never `getBoundingClientRect`) so CSS fadeUp `enter_dy` cannot bake
into durable `top` — animated transforms override plain inline `transform:none`.
Legacy text pluses still neutralize via temporary `animation:none` + Range ink.
Offer slots clear scrub/CSS motion for the whole `layoutOffers` pass so
`glyphInk` anchors match export’s pre-`.motion-ready` rest (fit `translateY` on
`.offer-value` is kept). Combined with the `.motion-ready` clock gate, cold
first paint matches warm Replay.

**Authored subline width is the fit constraint** (pink text box in the
inspector). Value-ink × 1.10 is a design guide when authoring only — the
runtime must not overwrite subline width, or copy wraps to a narrower box than
you set.

| Family | How detected | Behaviour |
|---|---|---|
| stacked subline | subline mostly below value | leave authored width/left/top alone |
| side-by-side | subline to the right and starts above the value box bottom | keep authored width/**top** (baseline via flex-end in a real height box); runtime only re-anchors **left** to value-ink right so drag still works |
| horizontal | 2+ slots, wider Δx | equal ink-cluster gaps; plus at value-ink midpoint (glyph-centred) |
| vertical | 2+ slots, taller Δy | equal gaps; plus Y = midpoint of upper **subline glyph-ink** bottom (else value glyph bottom) → next value glyph top; SVG box-centred; measured after fonts settle / before motion starts |
| triangular | two top-row + one centred below | equalize top pair; centre bottom under top centroid; plus is SVG (`assets/SVG/sse-plus.svg`) — on `300x250` / `970x250` top-aligned to top-row subline caps; on `300x600` centred in the gap below top-row sublines → bottom value top; else top-aligned to max(top-row value bottoms); X in the gap between top value inks |

Plus anchors are named helpers (`plusAnchorHorizontal` / `Vertical` /
`Triangular`) so family rules stay explicit and shared through `placePlus`.

### Manual pluses (non-DCO)

Fixed-copy campaigns set `campaign.offerPlusLayout: "manual"` (default for every
registered campaign except `sse-dco`). The stage carries
`data-offer-plus-layout="manual"`. `layoutOffers` still clears stale inline
slot/plus styles and runs side-by-side subline locking, but **skips** gap
equalization and `placePlus` so inspector-authored `left`/`top` stick in the
editor, font HTML, and outline/static exports.

Outline / static export is a **direct bake** of the editor stage: presentation
snapshots capture live boxes for slots, pluses, offer-value, and offer-subline
(inline after ink lock, else computed CSS) **plus** each text run’s content box
(`.offer-value-run` / Range) and glyph ink. Outline HTML writes host `left`/`top`
and absolutely places a content-sized SVG at the run box, with an ink-top nudge
so opentype paths match browser Museo metrics — including side-by-side subline
`left`. SSE DCO stays `offerPlusLayout: "auto"` (live feed lengths need ink-based
placement).

## Outline export (font → SVG paths)

Fixed-copy outline / static HTML is an **Adobe Animate-style snapshot**: what the
editor preview shows for the active sample row is what gets baked. Editor
exports walk every size, run fit → symbol align → `layoutOffers`, capture
presentation metrics (`src/lib/outline-snapshot.ts`), and POST them with the
export. The outliner then **locks** those numbers — it does not re-fit at serve
time.

When no snapshot is provided (API/tests/CLI), `src/server/outline-bake.ts`
approximates the same pipeline with Museo opentype metrics (shared size,
authored letter-spacing → tracking squeeze, bottom-align, 0.6em symbols).

Pipeline:

1. Prefer snapshot `fontSize` / `letterSpacingEm` / `alignOffsetY` / plus·slot
   positions; else resolve target metrics + metric fit (including shared
   equalization across visible offer values/sublines).
2. Offer values: bake `%` / `£` / `€` at **0.6em** with ink-bottom align
   (opentype glyph `yMin`, same intent as `alignOfferValueSymbols`).
3. Line box = `fontSize × lineHeight` (or raw px if `lineHeight > 4`).
4. **CSS half-leading baseline** for line `i`:
   `y = ascender + (lineBox − content) / 2 + i × lineBox`
   where `content = ascender − descender` at the fitted size.
5. Emit a content-tight SVG (`height = lines × lineBox`). Bottom-align uses an
   SVG group `translate(0, alignOffsetY)`. Offer hosts stay `overflow: visible`
   (same as font-mode) so tight `lineHeight: 0.85` boxes do not clip glyph ink.
   When a snapshot includes a content box, SVG **width/height** follow the live
   run/Range box (left-aligned paths), the exporter absolutely positions that
   SVG inside the host, and an extra ink-top translate closes browser↔opentype
   metric drift.
6. CTA: zero host padding; SVG at intrinsic size (no `width: 100%` scale-down).
7. Snapshot plus/slot/offer-host `left`/`top`/`height` write as inline styles
   over class CSS (value + subline hosts included — side-by-side ink lock must
   bake).

## Tests

- `src/lib/text-fit.test.ts` — engine behaviour (tracking, groups, wrap,
  grow-down, bottom alignment, scope overrides, refit idempotence).
- `src/lib/text-fit-rules.test.ts` — rule derivation from the creative JSON.
- `src/lib/offer-layout.test.ts` — ink-first plus placement (overflowing
  subline box, glyph vs line-box), side-by-side ink lock, runtime shape.
- `src/server/__tests__/text-outline.test.ts` — path bake, half-leading,
  authored lineHeight, static delivery shell.
- `src/server/__tests__/creative-exporter.test.ts` — the exported runtime:
  engine inlined and executable, texts bound before fitting, font refit wired,
  Museo-only packaging in every export flavour.
