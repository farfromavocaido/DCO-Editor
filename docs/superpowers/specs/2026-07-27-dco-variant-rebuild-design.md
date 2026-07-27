# SSE DCO variant rebuild — design

Rebuild Hiker Welcome Credit, Keepy Uppy Welcome Credit, and Keepy Uppy Top Discount as exact structural clones of the SSE DCO base template, differing only in campaign identity, sample-row feed values, and packaged background assets.

## Goal

The three parallel campaigns should behave as SSE DCO variants: same layout, motion, clock, presets, and feed field definitions; only dynamic content (including background images shipped in the classic packaged `assets/` folder) carries each brief’s current values.

## Non-goals

- No exporter, API, or campaign-registry changes
- No asset file moves or renames under `campaign/assets/`
- No ongoing “auto-sync from base” or runtime inheritance machinery

## Approach

**One-shot clone + patch** for each of:

| Campaign id | File | Background folder |
|---|---|---|
| `sse-hiker-welcome` | `campaign/sse-hiker-welcome-creative.json` | `assets/hiker/hiker_{size}.jpg` |
| `sse-keepyuppy-welcome` | `campaign/sse-keepyuppy-welcome-creative.json` | `assets/keepyuppy/keepyuppy_{size}.jpg` |
| `sse-keepyuppy-discount` | `campaign/sse-keepyuppy-discount-creative.json` | `assets/keepyuppy/keepyuppy_{size}.jpg` |

For each file:

1. Deep-copy `campaign/sse-dco-creative.json`.
2. Set `campaign.id` / `campaign.name` from the existing variant document.
3. Replace `feed.sampleRows[0]` with the existing variant’s sample row (preserve Unique_ID, Reporting_label, headlines, offers, CTA, T&Cs, etc.).
4. For every size, set `sizes[size].assets.background` and the `bg-image` layer `asset` to that campaign’s packaged background path.
5. Leave feed `background_image_url_*` empty (same as SSE DCO). Studio feed slots stay unused; local/export packaging uses size assets.

`320x50` background framing follows SSE DCO exactly (`top: 0`, `height: 50`, `objectFit: cover`) — do not retain the prior variant crop (`top: -10`, `height: 40`).

## Document ownership after rebuild

| Source | Fields |
|---|---|
| Existing variant | `campaign`, `feed.sampleRows[0]`, packaged bg paths |
| SSE DCO (wholesale) | `clock`, `presets`, `feed.fields`, all `sizes.*` structure (layers, clips, classRules, variantRules, manualCss, canvas), including DCO `320x50` bg classRule |

## Verification

- Deep-diff each rebuilt file against SSE DCO: only allowed diffs are `campaign`, `feed.sampleRows[0]`, and background asset paths (`assets.background` + `bg-image.asset` per size).
- Run `npm test`.
- Changelog (Unreleased): note the three campaigns were rebuilt as SSE DCO clones with preserved sample content and packaged backgrounds.

## Docs

- `CHANGELOG.md` entry under Unreleased.
- Optional one-line note in `docs/WORKFLOW.md` that parallel campaigns are DCO clones with distinct sample rows / backgrounds — only if the existing wording would otherwise mislead.
