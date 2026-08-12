<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SSE DCO Creative Editor — agent notes

Local Next.js tool for editing campaign creative JSON documents and exporting Studio-ready HTML (font) or fixed-copy SVG-outline packages.

## Key paths

| Path | Purpose |
|---|---|
| `src/server/paths.ts` | Resolves `campaign/`, `output/`, `outputs/` — always file-relative, not cwd |
| `src/server/campaign-registry.ts` | Registered campaigns (id → JSON file + export slug + optional static `clickTag`) |
| `src/server/creative-document.ts` | Read/write/validate creative JSON |
| `src/server/feed-schema.ts` | Feed field schema + row validation (incl. size-text overrides) |
| `campaign/feed-field-map.json` | Sidecar: Studio→canonical field remap + size-overridable field list |
| `src/lib/feed-size-text.ts` | Per-size text override helpers (`textFieldForSize`, blank → base) |
| `src/server/creative-exporter.ts` | HTML and ZIP export (`renderMode: font \| outline`, `delivery`, base/client packages, Sync Zips) |
| `src/server/text-outline.ts` | Museo → SVG path outlining for outline export |
| `src/server/outline-bake.ts` | Server-side outline metrics when no editor `presentationSnapshots` |
| `src/lib/outline-snapshot.ts` | Editor stage capture for WYSIWYG outline/static bake |
| `src/lib/text-fit.ts` + `src/lib/text-fit-rules.ts` | The one text-fit engine + rule derivation, shared by preview and font exports — see `docs/TEXT_FITTING.md` |
| `src/lib/offer-layout.ts` | Post-fit offer gap/plus placement (`campaign.offerPlusLayout`: `auto` \| `manual`) |
| `src/store/editor-store.ts` | Zustand state + dirty tracking + active campaign |
| `campaign/sse-dco-creative.json` | Default SSE DCO document (layers, motion, feed) |
| `campaign/*-creative.json` | Parallel campaigns: Hiker Keypad, Keepy Uppy Welcome Credit, Keepy Uppy Top Discount |
| `campaign/assets/` | Backgrounds, SVGs, images, fonts |
| `output/` | Local scratch HTML/ZIPs (gitignored) |
| `outputs/` | Tracked Sync Zips package for GitHub Pages (`/statics/` + DCO agency zip) |

## Conventions

- API route handlers: `export const runtime = 'nodejs'` (filesystem).
- Preview assets: `/assets/foo` → `campaign/assets/foo`.
- Creative/feed/export APIs take `?campaign=<id>` (default `sse-dco`).
- Exports: `output/{exportSlug}_{size}.html` (e.g. `SSE_DCO_300x250.html`, `SSE_Hiker_Welcome_300x250.html`).
- Brand font: Museo (`Museo700-Regular.otf`, the slab family) — never Museo Sans, never aliased. See `docs/TEXT_FITTING.md`.
- Outline export is fixed-copy only (bakes the active sample row); omit OTF from those packages. Prefer editor `presentationSnapshots`.
- Non-DCO static HTML uses per-campaign product `clickTag`s from the registry; SSE DCO falls back to `https://www.sseairtricity.com/uk`.
- App docs: `docs/` in this folder (ignore `docs/superpowers/` design/plan archives unless implementing from them).

## Commands

```bash
just editor           # from repo root → editor + live /qa at http://localhost:5174/qa
npm test              # from repo root
npm run build
npm run export:preview-site   # static client preview → site/
npm run qa:dco        # canonical-agency stress capture → qa-output/YYYYMMDD-HHMMSS/ (+ archive old, latest symlink)
```

## Tests

Run `npm test` after changes to `creative-document.ts`, `feed-schema.ts`, `creative-exporter.ts`, outline bake/snapshot, or API routes. API tests hit real files under `campaign/`.

DCO visual QA matrix: `docs/QA_DCO_MATRIX.md`, live agency hold review at `/qa` (same shell as capture), harness under `scripts/qa-dco/` (writes `hold-samples.json` from creative JSON plateaus), visual review skill `.cursor/skills/dco-qa-review`.
