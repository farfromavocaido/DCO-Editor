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
| **Export for Static** | Same editor snapshot bake → `{exportSlug}_html_static.zip`; lean outlined HTML (no Enabler/DV360); inactive layers pruned; flat `assets/<basename>.jpg` backgrounds; IAB `clickTag` from `campaign-registry.ts` (Keypad → `…/keypad-electricity`, Welcome Credit → `…/electricity-welcome-credit`, Top Discount → `…/electricity-top-discount`; DCO → `https://www.sseairtricity.com/uk`) |
| **Sync Zips** | Snapshots all non-DCO campaigns → tracked `outputs/` for `/statics/`, and also bakes the SSE DCO **Canonical Agency Zip** into `outputs/downloads/` for the DCO Pages download button. Commit `outputs/` and push to publish |
| **Inspect HTML** | Formatted, syntax-highlighted export HTML in the inspector modal |
| **Export Canonical Zip** | Flat `{size}.html` + packaged backgrounds; SVGs inlined; Museo CDN |
| **Export Canonical Agency Zip** | Agency `ads/{size}/index.html`; SVGs inlined; Museo CDN; backgrounds feed-only (no hiker sample). Also available as a static download on the hosted DCO preview (preview form values do not affect it) |
| **Export base ZIP for agency** | Agency upload package (`assetMode: packaged`) with mapping and HTML shells |
| **Export agency ZIP with CDN assets** | Agency layout with Studio CDN Museo (+ CDN sample fallbacks where applicable) |
| **Export client ZIP with/without validation** | Downloadable preview package; validator optional (font mode) |
| **Export client ZIP (SVG outlines)** | Fixed-copy outline package without OTF; campaign SVGs inlined |

## Statics preview publish

1. In the editor, run **Sync Zips** (More menu).
2. Commit the updated `outputs/` tree (`campaigns/`, `downloads/SSE_Statics_*.zip`, `downloads/SSE_DCO_canonical_agency_*.zip`, `latest.json`).
3. Push to `main`. The Pages workflow rebuilds `site/` including gated `site/statics/` from the committed package, and attaches the DCO agency zip download on the root client preview.

Local check: `npm run export:preview-site` then serve `site/` (`just preview`). Statics URL path: `/statics/`.

GitHub Pages replaces the whole artifact on each deploy (old server files are gone). Browser caches are the remaining footgun: the statics shell cache-busts ad/ZIP URLs with `?v=<generatedAt>`, polls `latest.json`, and offers **Reload latest** (plus a banner when the open tab is behind the server package).

## Adding assets

Place files under `campaign/assets/` and reference them as `assets/...` in the creative document layer `asset` fields or size `assets` map.

## Adding a new size

Add a new entry under `sizes` in the active campaign’s `*-creative.json` (and keep parallel campaigns in sync if they share structure) with `canvas`, `layers`, `variantRules`, and optional `manualCss`. If the size is new to the feed schema, also add it to `CREATIVE_AD_SIZES` in `src/lib/feed-background.ts`. The editor will pick it up on reload.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Broken images in preview | Asset missing from `campaign/assets/` or wrong path in layer/size assets |
| Export ZIP missing font (font mode) | `Museo700-Regular.otf` missing from `campaign/assets/fonts/` |
| Outline export still references fonts | Used font mode instead of **Export HTML/ZIP (SVG outlines)** |
| Save fails validation | Creative document missing required feed, clock, or layer fields |
