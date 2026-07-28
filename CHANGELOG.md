# Changelog

## [Unreleased]

### Added

- **Manual line breaks in multiline feed copy** — headlines, T&Cs, and unit-rate accept authored `\n` in the editor and GitHub client preview (heading controls are textareas). Hard breaks only apply when fit wrap is allowed (`pre-line` / outline wrap); each hard-break line uses the same line-box height as soft wrap. Outline `wrapLines` + presentation snapshots preserve newlines so SVG outline export matches the live preview.
- **Statics preview (GitHub Pages `/statics/`)** — password-gated host for the three non-DCO campaigns’ Export-for-Static HTML; sidebar is campaign + size only; download link reads `outputs/latest.json`.
- **Export for Preview** (toolbar) — snapshots each non-DCO campaign on the live editor stage, writes tracked `outputs/campaigns/…`, a timestamped `outputs/downloads/SSE_Statics_*.zip`, and refreshes `outputs/latest.json` for commit/publish.
- **Static HTML clickTag** — Export for Static / preview packages open `https://www.sseairtricity.com/uk` via IAB `clickTag` (hardcoded default; customisable later).
- **Zero-offers DCO variant (`offers-0`)** on SSE DCO: TopBar Offers control gains `0` (sse-dco only). Hides offer slots, green wave, blue logo, and T&Cs; blue wave + white logo enter from the start; headlines render white with blank-aware equal screentime before CTA; per-size CTA repositioning via `offers-0|cta` rules. Existing `offers-1/2/3` unchanged.
- **offers-0 editable rest geometry**: `offers-0|bluewave` and `offers-0|logo-act3` variantRules so wave/logo rest can be tuned without affecting offers 1–3; editor variant merge/write now follows document order (CSS cascade) so `offers-0|cta` wins over `cta-rect` for drag/align.
- **Outline presentation snapshot**: editor outline/static exports capture the live preview after fit → symbol align → `layoutOffers` (all sizes) and bake those metrics into SVG paths — Animate-style “what you see is what you get.” Includes 0.6em `%`/`£`/`€`, final letter-spacing, bottom-align `translateY`, shared equalization, and plus/slot positions. API accepts optional `presentationSnapshots`; without them, `outline-bake` approximates via Museo metrics.
- **Export for Static** (`renderMode: 'outline'`, `delivery: 'static'`): lean fixed-copy ZIP (`{slug}_html_static.zip`) with outlined text, inlined logo/wave/plus SVGs, flat `assets/<basename>.jpg` backgrounds, no Enabler/DV360 shell, and inactive layers pruned for the baked sample row. Sits alongside Studio **Export HTML (SVG outlines)**.
- **Export Canonical Agency Zip** (`assetMode: 'canonical-agency'`): agency `ads/{size}/index.html` layout, Museo CDN, SVGs inlined, backgrounds feed-only (no packaged JPEGs, no hiker CDN sample).
- **Export Canonical Zip** (`assetMode: 'embed'`): root `{size}.html` + `assets/` backgrounds, SVGs inlined, Museo from CDN only (no wave/logo/hiker CDN links); highlighted primary action in the More menu.
- Client / GitHub preview page persists selected size, form values, per-size backgrounds, and zoom in `localStorage` across refresh; **Restore defaults** resets to the baked-in sample row.
- Parallel campaign documents beside the existing SSE DCO creative JSON (`sse-hiker-welcome`, `sse-keepyuppy-welcome`, `sse-keepyuppy-discount`), with a TopBar campaign switcher that isolates load/save/export per document.
- Campaign registry (`src/server/campaign-registry.ts`) and `GET /api/campaigns`; creative/feed/export APIs accept `?campaign=<id>`.
- Font vs SVG-outline export mode: outline bakes fixed-copy Museo glyph paths via `opentype.js` and omits the OTF from packages (`renderMode: 'outline'`).
- Hiker / Keepy Uppy background assets under `campaign/assets/hiker/` and `campaign/assets/keepyuppy/`.

### Fixed

- Offer plus Y parity: `layoutOffers` clears offer-slot motion for ink measure (editor scrub matches export rest); `300x600` offers-3 plus centres in the top→bottom gap (no digit-centred horizontal fallback); triangular detection allows slight bottom-slot slack; `glyphInk` unscales Range lines before applying canvas metrics so editor stage zoom no longer drifts plus Y vs HTML.
- Editor play/scrub now applies keyframe CSS timing functions (`ease-out`, `cubic-bezier(...)`, etc.) in `frameAtPercent`, matching export `animation-timing-function`.
- Dev server allows HMR when the editor is opened via `127.0.0.1` (`allowedDevOrigins` in `next.config.ts`).

### Changed

- **Keepy Uppy Welcome Credit timing (pilot):** `durationS` **12**; second-based spine (wave ~0.5–0.7s / ~1s sweep; H1+offers ~1.2s then ~2s hold; H2 ~2s hold; H4+CTA ~3s; fade to 12s). Enter/sweep percents scaled so transition absolute times stay ~0.5s / ~1s (not sped up by the shorter clock). Roundel off / frames-3 path. Green/blue `waveSweep` and CTA pop/pulse use a sharper ease-out (`cubic-bezier(0.12, 0.92, 0.2, 1)` / pulse `0.15, 0.95, 0.25, 1`) so motion dashes in then settles without shortening durations. H2→H4 handoff mirrors H1→H2 (`act4_in` = `offers_exit` at **54%**); CTA starts as H4 settles (`cta_in` **58.2%**). **728x90** offers/pluses now end on `offers_exit` with H2 (was `wave2_in+5`, clashing with bluewave). **320x50** white logo (`logo-act3`) enters on `bn_blue_in` with the bluewave (was a stale absolute %). Same clock + motion timing applied to **Hiker Welcome** and **Keepy Uppy Top Discount** (geometry/layout preserved per campaign).
- Hiker Welcome + Keepy Uppy Welcome/Discount: offer-slot enters now start with `act1_in` (stagger preserved), `enter_duration_pct` 5, and a softer ease-out (`cubic-bezier(0.25, 0.5, 0.35, 1)`). SSE DCO baseline unchanged.
- **Export HTML (SVG outlines)** (and other outline renders without an explicit asset map) inline logo/wave/plus SVGs as data URIs, matching canonical embed packages; outline client/base ZIPs no longer ship duplicate `assets/SVG/` files. Outline HTML ZIPs also ship background JPEGs under `assets/` so relative paths resolve when opened from the download.
- Outline text paths pre-quantize glyph coordinates before `opentype.js` `toSVG`, avoiding `d="…LNaN…"` from Museo float crumbs (e.g. `W`, `R`, `p`, `€`, `0`).
- Outline HTML runtime now adds `.motion-ready` (same animation gate as font exports), so the 15s CSS clock actually starts instead of staying paused forever.
- Outline fill color follows font-mode CSS: headlines/offers/legal default to brand navy (`rgb(0, 41, 117)`) when no color is authored; CTA/roundel keep their white fills. Outlined SVGs use content-tight height + `height: auto` so flex hosts (CTA) vertically center the label.
- Outline typography parity: bake authored unitless `lineHeight` (was hardcoded `1.05`); keep outlined SVG at intrinsic size (no `width:100%` shrink) and zero CTA padding so 15px CTA copy is not scaled to ~10.8px inside `padding: 0 18px`.
- Outline path bake uses the CSS line-box model (ascender + half-leading), so tight offer values (`lineHeight: 0.85`) no longer hang into absolutely positioned sublines; offer `.outlined-text` clips overflow like font-mode text.
- Hiker Welcome Credit, Keepy Uppy Welcome Credit, and Keepy Uppy Top Discount rebuilt as exact SSE DCO structural clones (clock, layout, motion, presets); only campaign identity, sample-row feed values, and packaged `assets/` backgrounds differ.
- Keepy Uppy Welcome Credit now shares Hiker Welcome Credit layout/positioning (variantRules + layer bases); Keepy Uppy sample copy and packaged backgrounds unchanged; Top Discount left as-is.
- MPU (`300x250`) offer enter mid-ground 48px / ~2.5–2.85%; headlines back to 4% enter (default ease-out); wave sweeps stay on CSS `ease-out`.
- Offer layout content edges use canvas glyph metrics (`actualBoundingBoxAscent` / `Descent`) so vertical pluses centre on true Museo ink (not Range line-boxes with half-leading); still after `fonts.ready` and before `.motion-ready`.
- SVG plus placement uses the CSS layout box (not transformed `getBoundingClientRect`), so fadeUp `enter_dy` cannot push pluses down in export/preview; keeps the `.motion-ready` font/layout clock gate for cold/warm timeline parity.
- Exported ads hold CSS animations until `document.fonts.ready` + offer layout settle (`.motion-ready`), so cold first paint matches warm Replay.
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
