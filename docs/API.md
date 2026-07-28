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

Builds HTML for all sizes into `output/`. Optional body: `{ document, renderMode: 'font' | 'outline', delivery: 'studio' | 'static', download, presentationSnapshots }`.

- `renderMode: 'outline'` bakes fixed-copy SVG text paths, inlines logo/wave/plus SVGs as data URIs, stages background JPEGs, and skips Museo packaging.
- `presentationSnapshots` (outline): per-size editor capture after fit/symbol-align/layout (`fontSize`, `letterSpacingEm`, `alignOffsetY`, plus/slot positions). Editor exports always send this; without it the server approximates via Museo metrics.
- `delivery: 'static'` (outline only) strips Enabler/DV360 shell, prunes inactive layers for the baked sample row, and flattens backgrounds to `assets/<basename>.jpg`. Download filename: `{slug}_html_static.zip`.
- Default `delivery: 'studio'` keeps the Studio-shaped outline ZIP (`{slug}_html_outlines.zip`) with nested `assets/…` paths.

When `download: true`, returns a ZIP attachment of the HTML files plus staged backgrounds (outline modes).

### `POST /api/creative/export-preview`

Writes the tracked statics preview package under `outputs/` (not a browser download). Body:

```json
{
  "campaigns": [
    { "id": "sse-hiker-welcome", "document": {}, "presentationSnapshots": {} }
  ]
}
```

- Only non-DCO campaign ids are accepted (`sse-hiker-welcome`, `sse-keepyuppy-welcome`, `sse-keepyuppy-discount`).
- `document` optional (loaded from disk when omitted). Prefer editor-supplied `presentationSnapshots` for WYSIWYG outline bake.
- Renders Export-for-Static HTML per size, copies flat background assets, replaces `outputs/campaigns/`, writes one `outputs/downloads/SSE_Statics_<timestamp>.zip` (previous downloads removed), and updates `outputs/latest.json`.
- Returns `{ ok, latest, written, zipBytes }`.

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

`assetMode`:

| Value | Layout | Fonts | SVGs | Backgrounds |
|---|---|---|---|---|
| `packaged` (default) | `ads/{size}/index.html` | Local OTF in ZIP | Files in ZIP | Feed-only (not packaged) |
| `cdn` | `ads/{size}/index.html` | Studio CDN Museo | Studio CDN (+ plus data URI) | Feed-only (hiker CDN sample fallback) |
| `embed` (canonical) | `{size}.html` + `assets/` at zip root | Studio CDN Museo only | Inlined data URIs | Relative `assets/bg_*.jpg` (no asset CDNs) |
| `canonical-agency` | `ads/{size}/index.html` | Studio CDN Museo only | Inlined data URIs | Feed-only (empty; no packaged JPEGs, no hiker sample) |

Download filenames: `{slug}_canonical_zip.zip`, `{slug}_canonical_agency_zip.zip`, `{slug}_base_cdn_zip.zip`, `{slug}_base_zip.zip`.

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
