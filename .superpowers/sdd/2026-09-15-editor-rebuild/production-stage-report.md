# Production stage implementation report

Task 1 implemented in `.worktrees/editor-rebuild` only.

## Behaviour

- PreviewPane now displays the production `renderStudioReadyHtml` output via POST `/api/creative/{size}/view` with the unsaved document and selected feed row. The old React creative markup, CSS construction and `frameAtPercent` motion interpreter have been removed.
- The iframe waits for its own fonts/images and production runtime `.motion-ready` (the fit/layout commit gate), surfaces render/asset/runtime timeout errors, and rejects stale render responses and stale load completions. The iframe is unavailable for interaction as soon as its document/row/size becomes obsolete, even before an effect runs.
- The browser animation objects are paused and assigned exact elapsed milliseconds. Selection rectangles and hit targets come from production DOM layout. Overflowing descendants cannot intercept a target outside their host rectangle. The external editor retains existing drag, resize, group, isolation, context menu, zoom, alignment and atomic history handlers.
- Browser font sizes, tracking, clipping and explicit fitting diagnostics feed inspector state without rerunning the text-fit engine.
- Hidden layers receive an explicitly marked editor-only visibility stylesheet, with `Hidden in editor: N` displayed. This view state is not production output. Rest snapshots temporarily clear that stylesheet.
- `waitForProductionStage(size)` and `getProductionStage()` expose the ready iframe stage to the store. `withProductionRestPose` temporarily removes CSS animations for fitted-layout snapshots and restores their exact previous times, even after a collector exception. The existing snapshot collector now uses the element's owning window for computed styles. Store integration is owned by the ownership agent.
- Preview GET and POST support campaign query IDs; malformed document/row object payloads return 400. Source compilation uses one resolved document, avoiding a second disk read.

## Verification

Behavioural tests were added and observed failing before implementation:

- Missing production bridge module / generation, ID mapping, browser seeking, group bounds.
- Malformed preview request incorrectly returned 500 instead of 400.
- Overflow hit-resolution regression helper missing.

Scoped final command:

`npx vitest run src/lib/production-stage.test.ts src/server/__tests__/render-creative-preview.test.ts src/lib/outline-snapshot.test.ts`

Result: 15 tests passed across three files. Server parity test asserts exact equality with production HTML plus the supplied row; no parallel renderer is involved. Rest snapshot test also verifies pose restoration after an exception. Filtered TypeScript output reports no errors in the new bridge, component, preview endpoint, or snapshot changes; the repository has pre-existing unrelated TypeScript errors. `git diff --check` passed for owned files.

Real Chromium checks ran against the worktree development server on port 5184:

- MPU headline drag changed x=17 to x=32 and y=25 to y=37; Undo restored the original geometry.
- Frame resize changed width=255 to 265 and height=31 to 41; Undo restored it.
- Scrubbing 37.5% gave all 21 animation objects currentTime=5625ms.
- Campaign switch to Hiker Keypad completed after accepting the existing unsaved-changes dialog; no page errors.
- Shift-click headline and logo produced `2 items selected`.
- 200% zoom gave the 300px iframe a 600px visible width.
- Changing the feed sample to row 3 gave the production stage `offers-0` with the corresponding zero-offer state classes.

Reproducible local scripts and screenshots are under gitignored `output/playwright/` (`verify-production-stage.mjs`, `verify-production-selection.mjs`, `production-stage-initial.png`, `production-stage-hiker.png`). The dev server is session 74687 and is intentionally left available for parent integration checks.

## Constraints and follow-up verification

- Each document edit recompiles and reloads the production iframe, coalesced by 50ms. The stage shows loading during compilation; this is correct but less fluid than a future incremental production-runtime document update.
- Selection/hit rectangles use browser geometry; existing snapping, alignment and group-scale write calculations still use authored geometry. This does not change creative paint but may warrant dedicated transformed-parent interaction refinement.
- Default parity requires the same asset inputs and editor-only hidden layers disabled. The preview includes packaged background fallback; canonical feed-only agency delivery differs when no feed background is supplied. Parent integration is checking packaged-output parity separately.
- Full-suite/build, all-format package comparison, persisted save/reload, and end-to-end outline package verification belong to parent Task 4. This report does not claim those have passed.

## Cross-review follow-up

The earlier reload-visibility constraint is superseded: the stage now keeps a ready production iframe mounted while a second iframe loads its replacement. It swaps only after the latest request's assets/runtime are ready. A small updating badge replaces the full-stage mask. A separate selection outline follows ongoing drag/resize while compilation is pending. New pointer/double/context interactions are blocked against an obsolete frame; already captured window gestures continue. Snapshot readiness is invalidated immediately, even though old paint remains visible. Consumers should wait for `[data-production-frame][data-ready="true"]`, not visibility alone.

Additional corrections:

- Gesture undo now captures the entire document before/after so inherited ownership is restored, rather than leaving local overrides after numeric undo. Virtual canvas groups resize their actual members instead of the offers group.
- Selection clipping diagnostics prefer target ID over the potentially overwritten family class entry.
- GET preview campaign IDs resolve with `readCreativeDocumentForCampaign`; a Hiker query regression was observed returning 500 before this fix.
- Solo T&Cs map to `terms-solo` even without an element ID. `hiddenTargets` records text hidden by computed CSS visibility or ancestor display, and hidden nested offers are no longer reinserted by the collector's second pass. Animation opacity does not suppress snapshots. Explicit visible descendants inside visibility-hidden ancestors remain measurable.

Cross-review findings sent to parent: missing solo terms silently entered the approximate outline fitter (fixed collector, parent adds strict snapshot completeness); original parity measurement omitted text line geometry and decoded image identity (parent upgrading its script). The local and CDN Museo hashes were verified identical by parent.

Additional real-browser checks passed: twelve continuous pointer moves retain visible production paint and a moving external selection outline; delaying a feed render preserves paint while blocking stale clicks, double-clicks and context menus; existing drag/resize/undo/seek/campaign and multiselect/zoom/feed checks passed after buffering. Local scripts `verify-production-buffering.mjs` and `verify-production-stale-input.mjs` record these checks. Scoped tests now include target-specific clipping, GET campaign mapping, solo T&Cs, nested visibility and visibility overrides. Standalone regression additions are in the parent's `production-snapshot.test.ts` integration file.

## Active-row fixed-copy export correction

Fixed-copy downloads now use `creativeDocumentForExport(state, 'outline')`, containing exactly the effective selected feed row marked `Default: true`; font downloads retain all feed rows. PreviewPane and standalone View HTML share the memoized `selectPreviewFeedRow` selector, including active layout controls while retaining every size-specific copy column. This applies to HTML, client ZIP, base ZIP and each non-DCO Sync Zips payload; the DCO font package keeps its full feed.

Capture records document, campaign, feed-array, selected-index and effective-row identity before walking formats and rejects changes. Internal size walking no longer calls `loadSize`, avoiding control resync and history clearing. Capture restores original size and selection in `finally` when the source is unchanged. Editing is temporarily disabled during capture; Sync Zips also covers quiet campaign-load intervals. Programmatic source changes are still detected rather than silently mixed into snapshots.

Validation: two new pure selector/source tests first failed with missing helpers, then passed. A store test verifies all three fixed-copy download methods POST one active triple row even when another row is default. `npx vitest run src/store/editor-store.test.ts src/lib/production-stage.test.ts`: 19 tests pass. Real Chromium selected the nondefault triple row and downloaded an actual six-format outline ZIP; every HTML had `offers-3` and `id="offer3"`, and the original 300x600 selection was restored. A deliberately failed 300x250 preview capture restored the original format, released editing and posted no export request. Scripts: `output/playwright/verify-active-outline-row.mjs`, `verify-outline-capture-failure.mjs`.
