# API reference

All routes run on the Node.js runtime (`export const runtime = 'nodejs'`).

Creative, feed, and export routes accept an optional `?campaign=<id>` query param (default `sse-dco`). Registered ids live in `src/server/campaign-registry.ts`.

## Campaigns

### `GET /api/campaigns`

Returns `{ id, name, file, exportSlug }[]` for every registered campaign document.

## Creative document

### `GET /api/creative`

Returns the full creative document for the selected campaign.

### `POST /api/creative`

Validates and writes the request body to the selected campaign JSON file. Campaign selection uses `?campaign=` (the body is the document itself; `body.campaign` is the document’s `{ id, name }` object).

### `POST /api/creative/export`

Builds HTML for all sizes into `output/`. Optional body: `{ document, renderMode: 'font' | 'outline', download }`. Outline mode bakes fixed-copy SVG text paths and skips Museo packaging. When `download: true`, also returns a ZIP attachment of those HTML files.

### `POST /api/creative/{size}/export`

Builds HTML for one size into `output/`. Optional body: `{ renderMode }`.

### `GET /api/creative/{size}/view`

Returns HTML preview for the saved document and default feed row.

### `POST /api/creative/{size}/view`

Accepts `{ document, row }` and returns HTML preview with the supplied feed row baked in.

### `GET /api/creative/{size}/source`

Returns formatted HTML source + Shiki-highlighted HTML for the saved document.

### `POST /api/creative/{size}/source`

Same as GET but accepts `{ document }` in the body.

### `POST /api/creative/client-package`

Returns a ZIP client preview package. Optional body: `{ document, includeValidator, renderMode }`. Outline packages omit the OTF and validator matrix.

### `POST /api/creative/base-package`

Returns the agency base upload ZIP. Optional body: `{ document, assetMode, renderMode }`.

## Feed schema

Feed data is stored inside the creative document. These routes read/write the embedded `feed` section.

### `GET /api/feed-schema`

Returns `{ profileName, fields, rows }` from the creative document.

### `POST /api/feed-schema/rows`

Validates and saves `{ rows }` into the creative document feed section.

## Assets

### `GET /assets/{...path}`

Serves files from `campaign/assets/`.

| URL | File |
|---|---|
| `/assets/SVG/greenwave.svg` | `campaign/assets/SVG/greenwave.svg` |
| `/assets/bg_300x600.jpg` | `campaign/assets/bg_300x600.jpg` |
