# Changelog

## [Unreleased]

### Added
- **Feed variable schema docs:** `docs/FEED_VARIABLE_SCHEMA.md` (full reference) and `docs/FEED_DYNAMIC_FIELDS.md` (send-over guide: headings, act timing, sample values; `cta_type_enum` uses `roundel` not `circle`).
- **Offer value currency symbols:** £ and € in offer blocks are auto-wrapped with the same smaller `sym-pct` styling and runtime alignment used for `%` (editor preview and Studio export). Roundel, headings, and other text are unchanged.

### Fixed
- **320×50 T&C copy:** `terms-prices` and `terms-solo` now share the unit-rate text box (position, size, alignment, font). Clip timing unchanged; `settled_dy: -11` keeps copy in the visible band on the 50px canvas.
- **320×50 Headline 4:** white text and `top: 9px` via `#headline-act4` override in manualCss (shared headline class unchanged on other acts).
- **728×90 Headline 4:** `top: 17px` via `#headline-act4` override in manualCss (other headlines stay at 10px).
- **Offer subline fit in inspector:** Fit controls appear when selecting nested offer sublines; class-rule fit is persisted and exported. 320×50 sublines use bottom alignment, wrap, max 2 lines. `frames-3` `act4_in` now lands at swap (+0.1%) so heading 4 crossfades in as heading 2 exits, instead of waiting until `cta_in`. T&Cs still exit at the CTA frame. Matches the manual 300×600 fix across all MPU sizes.
- **728×90 T&C visibility:** removed erroneous `height: 1.3px` on `.sse-bottom-line` that clipped prices-mode legal copy to a single pixel row.
- **T&C Prices control:** selecting “Prices” in the top bar no longer throws when the embedded feed schema listed legacy `solo`/`prices` enum options instead of `tcs_only`/`tcs_units`.
- **GitHub Pages password gate:** hosted client preview at `/` requires password `ssedco` (session-based, client-side only; not applied to editor ZIP exports).
- Vendored `campaign/assets/fonts/MuseoSans_700.otf` for reproducible CI and ZIP exports.

### Changed
- **Brand palette:** standardised campaign colours to dark blue `rgb(0, 41, 117)`, green `rgb(0, 229, 165)`, and white `rgb(255, 255, 255)` across creative JSON, editor chrome, and export preview (SVG assets unchanged).
- **Flattened repo layout:** moved `editor-app/` contents to the repository root; `package.json`, `campaign/`, and `src/` now live at the top level.
- **Editor-only repo cleanup:** removed GWD/`gwd-tl` infrastructure. Campaign data lives in `campaign/`; exports go to `output/`. Feed rows are embedded in the creative document. Legacy layout API and sidebar removed.

### Added
- **Inspect HTML** button in the top bar opens a modal code viewer for the current size/variant: HTML is beautified (`js-beautify`), syntax-highlighted (`shiki` / GitHub Dark), and shown with a line-number gutter. Copy, refresh, and open live preview from the modal. API: `GET|POST /api/creative/[size]/source`.
- Renamed **View HTML** → **Preview** (opens the rendered ad in a new tab).
- Dark UI theme across the editor shell (panels, inputs, sidebars, preview chrome).
- Boys+Girls header logo (`public/BGlogo_SVG.svg`) in the top bar.

### Fixed
- Asset preview route now maps `/assets/...` to `WorkingFolder/assets/...` (was dropping the `assets/` directory segment, causing 500s on logos, waves, and backgrounds).
- Timeline scrubber restored to full toolbar width (`id="scrubber"` required by `editor.css` flex rule).
- Dev port no longer duplicated in npm script (`just editor -p {port}` owns port selection).

## [0.1.0] — 2026-06-12

### Added
- Initial Next.js migration from `WorkingFolder/gwd-tl/editor/`.
- React UI: `TopBar`, `LayoutPanel`, `SchemaPanel`, `PreviewPane` with Zustand store.
- Server modules: `layout-editor.ts`, `feed-schema.ts` reading/writing `WorkingFolder/`.
- API routes matching the old hand-rolled server (`/api/layouts`, `/api/feed-schema`, `/assets/*`).
- Vitest suite (36 tests) ported from former editor test files.
- `just editor` recipe pointing at this app (default port 5174).
