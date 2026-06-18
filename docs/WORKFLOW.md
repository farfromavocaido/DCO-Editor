# Editor workflow

## Daily editing

1. Start the editor: `just editor` or `npm run dev -- -p 5174`.
2. Pick a size from the toolbar.
3. Use the layer tree, canvas, timeline, and inspector to edit positions, styles, and motion clips.
4. Toggle offer count, T&C mode, and CTA shape to preview feed-driven variants.
5. **Save creative** writes `campaign/sse-dco-creative.json`.
6. Edit mock feed rows in the inspector; **Save sample values** persists them into the same document.

## Export

| Action | Output |
|---|---|
| **Build HTML** | `output/SSE_DCO_{size}.html` and WIP variant files for all sizes |
| **View HTML** | Opens a browser preview of the current size with baked feed row |
| **HTML source** | Formatted, syntax-highlighted export HTML in the inspector modal |
| **Client ZIP** | Downloadable preview package with validator |
| **Base ZIP** | Agency upload package with mapping and HTML shells |

## Adding assets

Place files under `campaign/assets/` and reference them as `assets/...` in the creative document layer `asset` fields or size `assets` map.

## Adding a new size

Add a new entry under `sizes` in `sse-dco-creative.json` with `canvas`, `layers`, `variantRules`, and optional `manualCss`. The editor will pick it up on reload.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Broken images in preview | Asset missing from `campaign/assets/` or wrong path in layer/size assets |
| Export ZIP missing font | `MuseoSans_700.otf` not installed at `~/Library/Fonts/` |
| Save fails validation | Creative document missing required feed, clock, or layer fields |
