# Changelog

## [Unreleased]

### Added
- **Offer value currency symbols:** £ and € in offer blocks are auto-wrapped with the same smaller `sym-pct` styling and runtime alignment used for `%` (editor preview and Studio export). Roundel, headings, and other text are unchanged.

### Fixed
- **T&C Prices control:** selecting “Prices” in the top bar no longer throws when the embedded feed schema listed legacy `solo`/`prices` enum options instead of `tcs_only`/`tcs_units`.
- **GitHub Pages password gate:** hosted client preview at `/` requires password `ssedco` (session-based, client-side only; not applied to editor ZIP exports).
- Vendored `campaign/assets/fonts/MuseoSans_700.otf` for reproducible CI and ZIP exports.

### Changed
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
