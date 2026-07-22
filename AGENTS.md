<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SSE DCO Creative Editor — agent notes

Local Next.js tool for editing campaign creative JSON documents and exporting Studio-ready HTML (font) or fixed-copy SVG-outline packages.

## Key paths

| Path | Purpose |
|---|---|
| `src/server/paths.ts` | Resolves `campaign/`, `output/` — always file-relative, not cwd |
| `src/server/campaign-registry.ts` | Registered campaigns (id → JSON file + export slug) |
| `src/server/creative-document.ts` | Read/write/validate creative JSON |
| `src/server/creative-exporter.ts` | HTML and ZIP export (`renderMode: font \| outline`) |
| `src/server/text-outline.ts` | Museo → SVG path outlining for outline export |
| `src/lib/text-fit.ts` + `src/lib/text-fit-rules.ts` | The one text-fit engine + rule derivation, shared by preview and font exports — see `docs/TEXT_FITTING.md` |
| `src/store/editor-store.ts` | Zustand state + dirty tracking + active campaign |
| `campaign/sse-dco-creative.json` | Default SSE DCO document (layers, motion, feed) |
| `campaign/*-creative.json` | Parallel campaign documents (hiker / keepyuppy variants) |
| `campaign/assets/` | Backgrounds, SVGs, images, fonts |

## Conventions

- API route handlers: `export const runtime = 'nodejs'` (filesystem).
- Preview assets: `/assets/foo` → `campaign/assets/foo`.
- Creative/feed/export APIs take `?campaign=<id>` (default `sse-dco`).
- Exports: `output/{exportSlug}_{size}.html` (e.g. `SSE_DCO_300x250.html`, `SSE_Hiker_Welcome_300x250.html`).
- Brand font: Museo (`Museo700-Regular.otf`, the slab family) — never Museo Sans, never aliased. See `docs/TEXT_FITTING.md`.
- Outline export is fixed-copy only (bakes the active sample row); omit OTF from those packages.
- App docs: `docs/` in this folder.

## Commands

```bash
just editor           # from repo root
npm test              # from repo root
npm run build
```

## Tests

Run `npm test` after changes to `creative-document.ts`, `feed-schema.ts`, `creative-exporter.ts`, or API routes. API tests hit real files under `campaign/`.
