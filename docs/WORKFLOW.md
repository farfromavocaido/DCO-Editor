# Editor workflow

## Daily editing

1. Start the editor: `just editor` or `npm run dev -- -p 5174`.
2. Pick a **Campaign** from the toolbar (default SSE DCO; parallel hiker / keepyuppy briefs are separate JSON files that clone the DCO template with their own sample rows and packaged backgrounds).
3. Pick a size from the toolbar.
4. Use the layer tree, canvas, timeline, and inspector to edit positions, styles, and motion clips.
5. Toggle offer count, T&C mode, and CTA shape to preview feed-driven variants.
6. **Save creative** writes the active campaign JSON under `campaign/`.
7. Edit mock feed rows in the inspector; **Save sample values** persists them into the same document.
8. Switching campaigns prompts if there are unsaved creative or sample-value changes.

## Export

| Action | Output |
|---|---|
| **Export HTML (font)** | Downloads `{exportSlug}_html.zip`; also writes `output/{exportSlug}_{size}.html` (+ WIP variants) |
| **Export HTML (SVG outlines)** | Snapshots the editor stage (all sizes) then downloads `{exportSlug}_html_outlines.zip`; Studio-shaped fixed-copy outline HTML (Enabler shell); SVGs inlined; nested `assets/…` backgrounds |
| **Export for Static** | Same editor snapshot bake → `{exportSlug}_html_static.zip`; lean outlined HTML (no Enabler/DV360); inactive layers pruned; flat `assets/<basename>.jpg` backgrounds; IAB `clickTag` is per campaign (Keypad / Welcome Credit / Top Discount product URLs; DCO falls back to `https://www.sseairtricity.com/uk`) |
| **Export for Preview** | Snapshots all non-DCO campaigns → tracked `outputs/` (per-campaign HTML + assets, timestamped zip, `latest.json`). Commit `outputs/` and push to publish `/statics/` on GitHub Pages |
| **View HTML** | Opens a browser preview of the current size with baked feed row |
| **HTML source** | Formatted, syntax-highlighted export HTML in the inspector modal |
| **Client ZIP** | Downloadable preview package with validator (font mode) |
| **Client ZIP (SVG outlines)** | Fixed-copy outline package without OTF; campaign SVGs inlined |
| **Canonical Zip** | Flat `{size}.html` + packaged backgrounds; SVGs inlined; Museo CDN |
| **Canonical Agency Zip** | Agency `ads/{size}/index.html`; SVGs inlined; Museo CDN; backgrounds feed-only (no hiker sample) |
| **Base ZIP** | Agency upload package with mapping and HTML shells |

## Statics preview publish

1. In the editor, run **Export for Preview** (More menu).
2. Commit the updated `outputs/` tree (`campaigns/`, `downloads/SSE_Statics_*.zip`, `latest.json`).
3. Push to `main`. The Pages workflow rebuilds `site/` including gated `site/statics/` from the committed package.

Local check: `npm run export:preview-site` then serve `site/` (`just preview`). Statics URL path: `/statics/`.

GitHub Pages replaces the whole artifact on each deploy (old server files are gone). Browser caches are the remaining footgun: the statics shell cache-busts ad/ZIP URLs with `?v=<generatedAt>`, polls `latest.json`, and offers **Reload latest** (plus a banner when the open tab is behind the server package).

## Adding assets

Place files under `campaign/assets/` and reference them as `assets/...` in the creative document layer `asset` fields or size `assets` map.

## Adding a new size

Add a new entry under `sizes` in `sse-dco-creative.json` with `canvas`, `layers`, `variantRules`, and optional `manualCss`. The editor will pick it up on reload.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Broken images in preview | Asset missing from `campaign/assets/` or wrong path in layer/size assets |
| Export ZIP missing font (font mode) | `Museo700-Regular.otf` missing from `campaign/assets/fonts/` |
| Outline export still references fonts | Used font mode instead of **Export HTML/ZIP (SVG outlines)** |
| Save fails validation | Creative document missing required feed, clock, or layer fields |
