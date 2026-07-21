# Editor architecture

The SSE DCO editor is a Next.js app that reads and writes `campaign/sse-dco-creative.json` and exports Studio-ready HTML from the in-app compiler.

## Boundary diagram

```
┌─────────────────────────────────────────────────────────────┐
│  SSE DCO Editor (Next.js)                                   │
│  ┌─────────────┐    fetch     ┌──────────────────────────┐  │
│  │ React UI    │ ──────────► │ API routes (Node runtime) │  │
│  │ + Zustand   │              │ creative-document.ts      │  │
│  └─────────────┘              │ feed-schema.ts            │  │
│         │                     │ creative-exporter.ts      │  │
│         │  /assets/* proxy    └────────────┬─────────────┘  │
└─────────┼──────────────────────────────────┼───────────────┘
          │                                  │ fs read/write
          │                     ┌────────────▼───────────────┐
          └────────────────────►│ campaign/                    │
                                │  sse-dco-creative.json       │
                                │  assets/                     │
                                │ output/ (generated HTML)     │
                                └──────────────────────────────┘
```

## Path resolution

All server paths resolve from `src/server/paths.ts` relative to the file location (not `process.cwd()`):

| Constant | Resolves to |
|---|---|
| `appRoot` | Repository root |
| `projectRoot` | `campaign/` |
| `outputRoot` | `output/` |
| `creativeDocumentPath` | `campaign/sse-dco-creative.json` |

## Server modules

### `creative-document.ts`

Reads, validates, and writes the version-1 creative JSON document.

### `feed-schema.ts`

Reads/writes feed profile data embedded in the creative document. Validates and coerces field types before save.

### `creative-exporter.ts`

Renders Studio-ready HTML, WIP preview variants, client preview ZIPs, and agency base ZIPs from the creative document.

### `http.ts`

Shared helpers: `serveAsset`, `jsonResponse`, `errorResponse`, path-escape guard for asset serving.

## Client architecture

### State (`store/editor-store.ts`)

Zustand store holds the loaded creative document, feed draft, canvas selection, timeline scrubber, undo/redo for creative edits, and export actions.

### Preview (`components/PreviewPane.tsx`)

DOM stage mirroring the ad structure with compiled CSS, timeline scrubbing, canvas manipulation, and client-side text fitting.

Preview asset URLs are `/assets/...` — served by the Next route, mapped to `campaign/assets/...`.

### Motion

- Clip → keyframe compilation lives in `src/lib/creative-compiler.ts`. Multi-clip
  layers merge raw frames, forward-fill missing channels, then pad to 0%/100%
  (so an opacity-only fadeOut cannot invent early translate motion).
- Offer slots micro-stagger via shared beats (`offer1_in` → `offer2_in` →
  `offer3_in`, ~1.1% apart) after `act1_in` so the first headline settles
  first. Pluses share one beat (`plus1_in` === `plus2_in`) just after the
  last price starts. Per-size enter durations/easings give a slight
  fly-apart on horizontal/triangular layouts; vertical sizes also stagger
  exit so the bottom slot leaves a fraction earlier.
- `terms-prices` + `unit-rate-prices` are canvas-absolute (not group-local).
  Shared bottom-left margin; unit-rate width = canvas − 2×left; shrink floor
  `max(8, 75% of T&Cs fontSize)`; `maxLines: 2`. `terms-solo` still uses
  `tc-solo-group`.
- Headline skip-hold (duplicate consecutive copy) lives in
  `src/lib/headline-motion.ts`: the previous act holds through the skipped act’s
  authored exit, then always fades out. If the skipped act has `base.color`
  (e.g. white endframe on 320x50), ink crossfades navy→white over the skipped
  act’s `enter_duration_pct` (2% ≈ 300ms, same beat as logo `bn_white_in`).
  Earlier frames stay navy so the green-wave window stays readable. Same
  planner drives editor preview and the exported runtime block.

### Brand font

Canonical Museo (slab) CDN URL: `src/lib/brand-font.ts`. Editor layout,
`/api/creative/{size}/view`, and CDN export packages all load that file so
text-fit and offer-value symbol alignment measure the same glyphs Studio serves.
Offline client ZIPs still package `campaign/assets/fonts/Museo700-Regular.otf`.

## API routes

All handlers use `export const runtime = 'nodejs'` because they touch the filesystem. See [API.md](API.md).

## Tests

Vitest runs in Node. Suites cover creative compiler/model libs, feed schema validation, exporter output, and live API handlers against `campaign/sse-dco-creative.json`.
