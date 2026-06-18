# SSE DCO Creative Editor

Next.js app for authoring SSE DCO display banners from a single creative document. Campaign data lives in `campaign/`; exports go to `output/`.

**Repository:** [github.com/farfromavocaido/DCO-Editor](https://github.com/farfromavocaido/DCO-Editor)

**Client preview (GitHub Pages):** [farfromavocaido.github.io/DCO-Editor/](https://farfromavocaido.github.io/DCO-Editor/) — rebuilt automatically on every push to `main`. A lightweight password gate protects the hosted preview (default password: `ssedco`; override with `PREVIEW_SITE_PASSWORD` when exporting). Client ZIP downloads from the editor are unchanged.

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
npm run export:preview-site   # static client preview → site/
```

## What it edits

| Layer | Location | Edited via |
|---|---|---|
| Creative document (layers, motion, variants) | `campaign/sse-dco-creative.json` | **Save creative** |
| Mock feed sample rows | embedded in creative document `feed` | Inspector feed tab + **Save sample values** |
| Campaign assets | `campaign/assets/` | Add files on disk; reference as `assets/...` |
| Generated HTML | `output/SSE_DCO_{size}.html` (+ WIP files) | **Build HTML** |
| Studio ZIP packages | downloaded from toolbar | **Client ZIP** / **Base ZIP** |

## Typical workflow

1. Open the editor and pick an ad size.
2. Edit layers on the canvas, timeline clips, and inspector properties.
3. Switch offer count / T&C mode / CTA shape to preview variants.
4. Edit mock feed rows in the inspector when testing copy.
5. **Save creative** persists the document; **Save sample values** updates feed rows in the same file.
6. **Build HTML** writes Studio-ready files to `output/`.
7. **Client ZIP** / **Base ZIP** for handoff packages.
8. Push to `main` to publish the client preview to GitHub Pages (see `.github/workflows/pages.yml`).

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for detail.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — app structure, data flow, path resolution
- [docs/WORKFLOW.md](docs/WORKFLOW.md) — editor usage and export
- [docs/API.md](docs/API.md) — REST route reference
- [CHANGELOG.md](CHANGELOG.md) — app changes

## Project layout

```
├── campaign/
│   ├── sse-dco-creative.json
│   └── assets/
├── output/                 generated HTML (gitignored)
├── src/
│   ├── app/              Next.js routes (page + API + asset proxy)
│   ├── components/       TopBar, PreviewPane, LayerTree, TimelinePanel, etc.
│   ├── lib/              creative compiler, model, alignment, text-fit
│   ├── server/           creative-document, feed-schema, creative-exporter
│   └── store/            Zustand editor state
├── docs/
└── vitest.config.ts
```

## Assets in preview

Preview serves files from `campaign/assets/` via `/assets/...` URLs (e.g. `/assets/SVG/greenwave.svg`).

ZIP export bundles assets referenced in the creative document. Packaged fonts: `Museo700-Regular.otf` for **Museo** and `MuseoSans_700.otf` for **Museo Sans** in `campaign/assets/fonts/` (with a fallback to `~/Library/Fonts/` for local dev). Ad HTML blocks external/local font matching so preview-page Typekit does not override packaged ad typography.
