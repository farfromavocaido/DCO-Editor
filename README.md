# SSE DCO Creative Editor

Next.js app for authoring SSE DCO display banners from a single creative document. Campaign data lives in `campaign/`; exports go to `output/`.

**Repository:** [github.com/farfromavocaido/DCO-Editor](https://github.com/farfromavocaido/DCO-Editor)

**Client preview (GitHub Pages):** [farfromavocaido.github.io/DCO-Editor/](https://farfromavocaido.github.io/DCO-Editor/) — rebuilt automatically on every push to `main`. A lightweight password gate protects the hosted preview (default password: `ssedco`; override with `PREVIEW_SITE_PASSWORD` when exporting). The preview remembers size, form values, and zoom in the browser across refresh; **Restore defaults** clears that and reloads the baked-in sample row. Ad card bar shows `version: <gitSha>` (same `?v=` on iframe URLs) so you can confirm the deploy stamp. Also offers a **Canonical Agency Zip** download from tracked `outputs/` (static handoff — independent of preview field values).

**Statics preview:** [farfromavocaido.github.io/DCO-Editor/statics/](https://farfromavocaido.github.io/DCO-Editor/statics/) — same password gate; hosts the three non-DCO campaigns as Export-for-Static HTML (campaign + size picker, ZIP download). Populate via editor **Sync Zips**, commit `outputs/`, then push.

## Quick start

From the repo root:

```bash
just editor              # http://127.0.0.1:5174
just editor 5175         # alternate port
```

Or directly:

```bash
npm install
npm run dev -- -p 5174
```

Other commands:

```bash
npm test                 # Vitest
npm run build            # production build
npm run start            # production server on :5174
npm run export:preview-site   # static client preview → site/ (CDN Museo, inlined SVGs, agency zip download + /statics/)
```

## What it edits

| Layer | Location | Edited via |
|---|---|---|
| Creative document (layers, motion, variants) | `campaign/sse-dco-creative.json` | **Save creative** |
| Mock feed sample rows | embedded in creative document `feed` | Inspector feed tab + **Save sample values** |
| Campaign assets | `campaign/assets/` | Add files on disk; reference as `assets/...` |
| Generated HTML | `output/{exportSlug}_{size}.html` (+ WIP files) | **Export HTML (font)** / outlines |
| Studio ZIP packages | downloaded from toolbar | **Export Canonical Zip**, client/base ZIPs, etc. |

## Typical workflow

1. Open the editor, pick a **Campaign**, then an ad size.
2. Edit layers on the canvas, timeline clips, and inspector properties.
3. Switch offer count / T&C mode / CTA shape to preview variants.
4. Edit mock feed rows in the inspector when testing copy.
5. **Save creative** persists the document; **Save sample values** updates feed rows in the same file.
6. **Export HTML (font)** (or SVG outlines / Static) writes Studio-ready files to `output/` and downloads a ZIP.
7. Use the More menu for Canonical / client / agency ZIP handoffs.
8. **Sync Zips** writes non-DCO static HTML + the DCO Canonical Agency Zip into tracked `outputs/` (commit that folder to update `/statics/` and the DCO page’s agency ZIP download).
9. Push to `main` to publish the client preview to GitHub Pages (see `.github/workflows/pages.yml`).

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for detail.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — app structure, data flow, path resolution
- [docs/WORKFLOW.md](docs/WORKFLOW.md) — editor usage and export
- [docs/API.md](docs/API.md) — REST route reference
- [docs/TEXT_FITTING.md](docs/TEXT_FITTING.md) — shared text-fit engine, offer layout, outline bake
- [docs/FEED_VARIABLE_SCHEMA.md](docs/FEED_VARIABLE_SCHEMA.md) — full feed field reference + schema-extension mechanism
- [docs/FEED_DYNAMIC_FIELDS.md](docs/FEED_DYNAMIC_FIELDS.md) — feed send-over guide

## Project layout

```
├── campaign/
│   ├── sse-dco-creative.json
│   ├── sse-hiker-welcome-creative.json
│   ├── sse-keepyuppy-welcome-creative.json
│   ├── sse-keepyuppy-discount-creative.json
│   └── assets/
├── output/                 generated HTML + ZIPs (gitignored)
├── outputs/                tracked preview package (Sync Zips: statics + DCO agency zip)
├── site/                   static client preview build (gitignored)
├── scripts/                one-off data migrations + preview-site export
├── src/
│   ├── app/              Next.js routes (page + API + asset proxy)
│   ├── components/       TopBar, PreviewPane, LayerTree, TimelinePanel, etc.
│   ├── lib/              creative compiler/model/css, feed-model, text-fit, offer-layout, outline-snapshot
│   ├── server/           creative-document, feed-schema, creative-exporter, text-outline, outline-bake, paths
│   └── store/            Zustand editor state
├── docs/
└── vitest.config.ts
```

## Assets in preview

Preview serves files from `campaign/assets/` via `/assets/...` URLs (e.g. `/assets/SVG/greenwave.svg`).

ZIP export bundles assets referenced in the creative document. The brand face packaged for ads is **Museo** only (`Museo700-Regular.otf` under `campaign/assets/fonts/`, with a local-dev fallback to `~/Library/Fonts/`). Never alias or ship Museo Sans in ad packages — see [docs/TEXT_FITTING.md](docs/TEXT_FITTING.md). Ad HTML blocks external/local font matching so preview-page Typekit does not override packaged ad typography.
