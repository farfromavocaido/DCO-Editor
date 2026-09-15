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
