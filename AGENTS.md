<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SSE DCO Creative Editor — agent notes

Local Next.js tool for editing `campaign/sse-dco-creative.json` and exporting Studio-ready HTML.

## Key paths

| Path | Purpose |
|---|---|
| `src/server/paths.ts` | Resolves `campaign/`, `output/` — always file-relative, not cwd |
| `src/server/creative-document.ts` | Read/write/validate creative JSON |
| `src/server/creative-exporter.ts` | HTML and ZIP export |
| `src/lib/text-fit.ts` + `src/lib/text-fit-rules.ts` | The one text-fit engine + rule derivation, shared by preview and exports — see `docs/TEXT_FITTING.md` |
| `src/store/editor-store.ts` | Zustand state + dirty tracking |
| `campaign/sse-dco-creative.json` | Source of truth for layers, motion, feed |
| `campaign/assets/` | Backgrounds, SVGs, images |

## Conventions

- API route handlers: `export const runtime = 'nodejs'` (filesystem).
- Preview assets: `/assets/foo` → `campaign/assets/foo`.
- Exports: `output/SSE_DCO_{size}.html`.
- Brand font: Museo (`Museo700-Regular.otf`, the slab family) — never Museo Sans, never aliased. See `docs/TEXT_FITTING.md`.
- App docs: `docs/` in this folder.

## Commands

```bash
just editor           # from repo root
npm test              # from repo root
npm run build
```

## Tests

Run `npm test` after changes to `creative-document.ts`, `feed-schema.ts`, `creative-exporter.ts`, or API routes. API tests hit real files under `campaign/`.
