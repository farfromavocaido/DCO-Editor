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

## API routes

All handlers use `export const runtime = 'nodejs'` because they touch the filesystem. See [API.md](API.md).

## Tests

Vitest runs in Node. Suites cover creative compiler/model libs, feed schema validation, exporter output, and live API handlers against `campaign/sse-dco-creative.json`.
