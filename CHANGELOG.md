# Changelog

## [Unreleased]

### Added

- Agency base package `assetMode: 'embed'`: inlines SVGs as data URIs, loads Museo from the Studio CDN, and packages background JPEGs as relative file refs (`POST /api/creative/base-package`, TopBar **Export agency ZIP with embedded SVGs**).
- Client / GitHub preview page persists selected size, form values, per-size backgrounds, and zoom in `localStorage` across refresh; **Restore defaults** resets to the baked-in sample row.
- Parallel campaign documents beside the existing SSE DCO creative JSON (`sse-hiker-welcome`, `sse-keepyuppy-welcome`, `sse-keepyuppy-discount`), with a TopBar campaign switcher that isolates load/save/export per document.
- Campaign registry (`src/server/campaign-registry.ts`) and `GET /api/campaigns`; creative/feed/export APIs accept `?campaign=<id>`.
- Font vs SVG-outline export mode: outline bakes fixed-copy Museo glyph paths via `opentype.js` and omits the OTF from packages (`renderMode: 'outline'`).
- Hiker / Keepy Uppy background assets under `campaign/assets/hiker/` and `campaign/assets/keepyuppy/`.

### Fixed

- Dev server allows HMR when the editor is opened via `127.0.0.1` (`allowedDevOrigins` in `next.config.ts`).

### Changed

- Exported ads hold CSS animations until `document.fonts.ready` + offer layout settle (`.motion-ready`), so cold first paint matches warm Replay; `placePlus` pauses the playhead instead of `animation: none` (which restarted plus clips).
- CDN / GitHub Pages packages inline `sse-plus.svg` from the campaign file (data URI) so preview and Studio CDN never depend on a missing SVG path; font refit still runs once even without `document.fonts`.
- 728×90 legal lines now hand off like other sizes: unit rates enter at `act1_out` (was `bn_offers_in`, which left a gap after T&Cs on frames-4).
- Headline enter slowed to 4%; frames-4 `act1_in` delayed to 12.5 so copy starts after the green wave is mostly swept in; offer micro-stagger shifted to match; light hold rebalance (`act2_in` 32.5, `act4_in` 76).
- Offer pluses are SVG images (`campaign/assets/SVG/sse-plus.svg`) instead of Museo "+" text, so the mark fills its box with no font vertical offset. Triangular layout still top-aligns to value bottoms by default; MPU / `970x250` rise to top-row subline caps.
- T&C / unit-rate layers across all campaigns now use opacity-only `fade` (no enter/exit vertical travel); prior `settled_dy` offsets were baked into authored `top` so hold position stays the same. Enter window remains 2% with ease-out.
- Late legal exits (`terms-solo`, `unit-rate-prices`) use a 1% fade-out and end at `offers_exit-2`, so they are fully gone when offer blocks begin their exit fade.
- SSE logo handoff: on `300x250` / `300x600` / `970x250`, blue logo box matches white and the blue→white crossfade spans the blue wave sweep; on `320x50` blue fade-out is centered on blue-wave start; on `160x600` / `728x90` blue fade-out aligns with offer-block exit; white fade-in on those non-swap sizes is centered on blue-wave end.
- Removed `offers-3` blue-only logo geometry overrides (`970x250`, `160x600`) that pulled the blue logo off the white box during the crossfade.
- Headline acts share one `enter_duration_pct` across acts (now 4%) so frames-4 sequences no longer snap Act 1 in quickly then crawl later acts (which were falling back to the 7% `slideInRight` default).
- DCO layout commit: `placePlus` measures glyph ink at motion rest (ignores fadeUp `enter_dy` / editor playhead transforms), and export runtime refits once on `document.fonts.ready` only (no `loadingdone` mid-enter rewrite). Fixes Replay / cached-font plus drift vs cold load.
- Fit-budget chrome no longer overrides an explicit authored `height` when `maxLines` is set (fixes offers-3 value/subline canvas drag on tight boxes like 728×90).
- **Export HTML** downloads a ZIP of the built files (still writes to `output/` as well); pass `download: false` on the API for the previous JSON-only response.
- Text-fit `shared` groups equalize font size only; letter-spacing / tracking is independent per box (recomputed at the shared size).
- Text-fit wrap mode uses `white-space: pre-line` so authored line breaks in copy are preserved in preview and export.
- Sample panel uses textareas for copy/offer string fields; right-click a text layer → **Edit text** focuses that feed field.
- Hiker / Keepy Uppy `320x50` backgrounds size to ad width with natural aspect ratio and sit ~10px above the ad top (no stretch to 50px).
- Background is a real selectable/resizable layer (`bg-image` classRule + layer); uses `object-fit: cover` so frame edits do not distort the image.
- Outline export loads `opentype.js` via `createRequire` so Turbopack/Node dual-package imports resolve.
- New campaign `160x600` offers-2/3 offer slots and value/subline boxes clamped so widths stay within the 160px canvas.
- Editor remembers the active campaign and size across page refresh (`localStorage`).
