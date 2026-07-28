# Headline scrim gradient (offers-0)

**Date:** 2026-07-28  
**Status:** Approved for implementation planning  
**Scope:** Editor-controlled static dark gradient to improve white headline contrast under `offers-0`

## Problem

In the zero-offer (`offers-0`) state, headlines render white over the photographic background (green wave hidden; blue wave from start). There is no dedicated contrast treatment on the photo itself, so white copy can wash out depending on the image.

## Goals

- Add a dark, editor-tunable scrim above the background image and below the blue wave.
- Visible **only** under `offers-0` (hidden for offers 1–3).
- **Not** feed/Studio-dynamic — knobs live in the creative document and bake into exported HTML/CSS.
- Controllable: end extent, start opacity, midpoint position along the fade.
- Stay in situ for the full timeline (no motion clips).

## Non-goals

- Controllable color (fixed pure black).
- Controllable mid-stop opacity (always half of start opacity).
- Animation / fade of the scrim.
- New campaigns beyond seeding existing creative JSONs.

## Approach

**Dedicated `kind: "gradient"` layer** (Approach 1), one per size (`id: "headline-scrim"`), with typed `gradient` fields compiled to a static `linear-gradient` in preview and export.

## Data model

```ts
{
  id: "headline-scrim",
  kind: "gradient",
  label: "Headline scrim",
  group: "Waves / background",
  zIndex: 1,
  base: {
    left: 0,
    top: 0,
    width: /* canvas width */,
    height: /* canvas height */
  },
  gradient: {
    direction: "to-bottom" | "to-right",
    endPct: number,       // 0–100: how far the fade reaches along the canvas axis
    startOpacity: number, // 0–1: opacity at the leading edge
    midpoint: number      // 0–1: position of the half-opacity stop along the fade span
  },
  clips: []
}
```

### Gradient math

Three stops on a black → transparent fade:

| Stop | Position along canvas axis | Opacity |
|---|---|---|
| Start | `0%` | `startOpacity` |
| Mid | `endPct * midpoint` (%) | `startOpacity / 2` |
| End | `endPct` (%) | `0` |

CSS shape:

```css
background-image: linear-gradient(
  to bottom, /* or to right */
  rgba(0, 0, 0, startOpacity) 0%,
  rgba(0, 0, 0, startOpacity / 2) calc(endPct% * midpoint) /* emit as concrete % */,
  rgba(0, 0, 0, 0) endPct%
);
```

Emit concrete percentages (e.g. mid at `12.5%` when `endPct=25` and `midpoint=0.5`), not nested `calc`, for Studio/HTML simplicity.

**Example** (100px fade for intuition, `endPct` maps that span to a % of the canvas side):

- `startOpacity=0.15`, `midpoint=0.5` → stops at 0 / 50 / 100 of the fade: 0.15 → 0.075 → 0
- `midpoint=0.1` → sharp drop 0→10 of the fade (0.15→0.075), then long tail 10→100 (0.075→0)
- `startOpacity=0.40`, `midpoint=0.1` → 0.40 → 0.20 at 10% of fade → 0 at end

### Per-size defaults

| Sizes | Direction | endPct | startOpacity | midpoint |
|---|---|---|---|---|
| 300x250, 160x600, 300x600 | `to-bottom` | 25 | 0.15 | 0.5 |
| 970x250, 728x90, 320x50 | `to-right` | 30 | 0.15 | 0.5 |

### Visibility

- Layer seeded in **all** campaign creative documents that share the template:
  - `sse-dco-creative.json`
  - `sse-hiker-welcome-creative.json`
  - `sse-keepyuppy-welcome-creative.json`
  - `sse-keepyuppy-discount-creative.json`
- Shown only under `offers-0` via existing `variantRules` / scope class patterns (hidden otherwise).
- Static delivery / offers-0 package paths keep current scope-stripping behavior.

### Stacking

Bottom → top:

1. `bg-image` (`zIndex` 0)
2. **`headline-scrim`** (`zIndex` 1)
3. `greenwave` / `bluewave` (bumped if needed so they stay above the scrim)
4. UI (headlines, logos, CTA, offers, …)

No CSS `z-index` property required beyond existing paint-order conventions (preview sorts by `zIndex`; export relies on document layer order — keep JSON array order consistent with z-order when seeding).

## Editor

When a `kind: "gradient"` layer is selected, `CreativeInspector` shows a **Gradient** section:

| Control | Field | Range | Notes |
|---|---|---|---|
| End % | `gradient.endPct` | 0–100 | Extent along canvas axis |
| Start opacity | `gradient.startOpacity` | 0–1 | Decimal; mid opacity derived |
| Midpoint | `gradient.midpoint` | 0–1 | Decimal position along fade |
| Direction | `gradient.direction` | `to-bottom` \| `to-right` | Select; defaults per size |

- No Typography / Fit / Animation clip UI for this kind (empty `clips`).
- Layer tree: listed under Waves / background; lock/hide/z-drag as today.
- Writes via store helpers targeting `gradient.*` (mirror existing layer base update patterns).

## Preview & export

- Render as a full-canvas empty `div` with classes `stage-element headline-scrim` (and any shared stage classes).
- Preview and export share one compile helper that turns `gradient` fields into the `background-image` rule (plus full-bleed geometry from `base`).
- Font and outline / static packages both include the div + baked CSS.
- No asset file, no OTF impact, not feed-bound.
- No motion keyframes for this layer.

## Validation

`validateCreativeDocument` accepts `kind: "gradient"` and requires:

- `gradient.direction` ∈ `{ "to-bottom", "to-right" }`
- `gradient.endPct` number in `[0, 100]`
- `gradient.startOpacity` number in `[0, 1]`
- `gradient.midpoint` number in `[0, 1]`
- `base` geometry present (same as other layers)
- `clips` may be empty array

## Touch list (implementation)

| Area | Files (expected) |
|---|---|
| Schema / validation | `src/server/creative-document.ts` |
| Model helpers | `src/lib/creative-model.ts` (add/update gradient fields if needed) |
| CSS compile | `src/lib/creative-css.ts` and/or small helper used by preview + exporter |
| Preview | `src/components/PreviewPane.tsx` |
| Inspector | `src/components/CreativeInspector.tsx` |
| Export | `src/server/creative-exporter.ts` |
| Campaign JSON | all four `campaign/*-creative.json` (layer + variantRules + z-order) |
| Docs | `CHANGELOG.md`; brief note in relevant app docs if a layer-kinds section exists |
| Tests | validation, compile stop math, exporter offers-0 includes scrim / non-offers-0 hides |

## Testing

1. Unit: stop positions for top and left defaults (`endPct * midpoint`).
2. Validation: accepts gradient kind; rejects out-of-range knobs / missing `gradient`.
3. Export: offers-0 HTML contains `headline-scrim` + `linear-gradient` with expected stops; non-offers-0 hides or omits per existing scope rules.
4. Manual: editor knobs update preview live under offers-0 sample row; z-order under blue wave.

## Open decisions

None — resolved in design review:

- Visibility: offers-0 only
- Midpoint: position along fade (0–1); mid opacity = `startOpacity / 2`
- Color: pure black
- Approach: dedicated `gradient` kind
