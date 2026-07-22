# Editor workflow

## Daily editing

1. Start the editor: `just editor` or `npm run dev -- -p 5174`.
2. Pick a **Campaign** from the toolbar (default SSE DCO; parallel hiker / keepyuppy briefs are separate JSON files).
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
| **Export HTML (SVG outlines)** | Downloads `{exportSlug}_html_outlines.zip`; same files with text baked to SVG paths (no Museo `@font-face`) |
| **View HTML** | Opens a browser preview of the current size with baked feed row |
| **HTML source** | Formatted, syntax-highlighted export HTML in the inspector modal |
| **Client ZIP** | Downloadable preview package with validator (font mode) |
| **Client ZIP (SVG outlines)** | Fixed-copy outline package without OTF |
| **Base ZIP** | Agency upload package with mapping and HTML shells |

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
