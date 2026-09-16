# Editor rebuild: production rendering and explicit ownership

Status: implementation in progress on codex/editor-rebuild. Baseline: 3b4c2c7,
tag snapshot/editor-before-rebuild-2026-09-15. Original checkout is preserved.

## Binding product requirements

- The editor displays the production creative renderer. Same document, row,
  assets, runtime build and time must give the same geometry, text lines,
  visibility and motion in editor and exported HTML.
- Preserve existing campaigns and bindings. Migration need not be pixel-perfect
  against the old editor, but editor/output parity is non-negotiable.
- Shared values, local exceptions, canvas grouping, fit equalisation and motion
  linking are separate relationships. No roundel/offer-count special case may
  silently enforce creative ownership during load/save validation.
- Fields display their effective value and source. Editing the active value must
  update that value, including compound-state fit overrides. Base edits are
  deliberate; they must not be silently substituted for active edits.
- A fixed text frame remains fixed. Wrapping, shrink limits, line limits,
  alignment and overflow are separate authored decisions. Fitting evaluates all
  text after browser layout, not a character count or longest-word heuristic.
- Animation distance declares its reference (pixels, canvas or parent); timing
  units are separate. Existing pixel distances are preserved when importing.
- Tests assert engine and editing behaviour. Approved appearance is a separate,
  versioned review surface, never an implicit restriction on creative edits.

## Renderer boundary

Compile the document and active feed using the existing production exporter.
Host its HTML in an isolated iframe. Keep editor selection controls outside the
creative DOM; obtain hit targets and rectangles from the rendered DOM. Seek the
browser's production CSS animations rather than independently interpolating
editor styles. Generation IDs prevent stale responses replacing newer edits.
The frame must wait for its own font/assets/runtime readiness and expose errors.

The authoring surface retains selection, drag, resize, multi-select, timeline,
undo and campaign switching. Outline snapshots come from the iframe. Standalone
outline export must eventually capture with a browser, not silently use different
font measurements. Font and outline parity require packaged-output verification.

## Ownership model

Stable target IDs identify objects independently of CSS. Shared definitions name
property bundles and their members. Local overrides remain explicit. Selection
of an object never implies linking. Per-format geometry is legitimate. Separate
zero-offer and offer roundel families are document data, not application policy.
Resolve each property and fit field with provenance. CSS specificity must not
compete with document precedence. Import legacy defaults/conditions into explicit
rules; validation itself must be pure and reject invalid data without mutation.

Operations: edit active scope, edit shared source, detach preserving appearance,
link with an explicit source, reset one property, and copy once. Undo is atomic.
Conflict handling and affected-member reporting must be visible.

## Text and motion

Text presets compose independent policy: fixed/auto frame, single/multiline,
fixed/shrink size, optional max lines, alignment, overflow, optional tracking.
Fit the full shaped text in the browser at each candidate size. Shared fit sets
are stable across animation visibility. Report requested/rendered size and why a
constraint fails; never report clipped text as successfully fitted.

Relative motion resolves from the authored canvas or parent dimensions, not
CSS transform percentages on the animated element. Seconds and timeline percent
are distinct. Preserve existing per-child motion when forming canvas groups.

## Migration examples

MPU zero-offer terms: retain x=6,y=210,w=102,h=43 and binding; reveal effective
maxLines=2 versus base=4 and contradictory minimum 10 versus designed size 6.
Roundels: retain frame/copy/value coordinates and separate clips; translate zero
and offer memberships into named definitions with format layouts.
Headlines: retain 20px movement on MPU/skyscraper and 35px on billboard until a
user deliberately links a relative-distance preset.

## Verification and rollout

Start with a working renderer-backed MPU editing path, then generalise ownership,
text and motion across formats and campaigns. Use real-browser comparisons of
editor iframe and independently packaged HTML, including between animation holds,
short/long copy and reload. Isolate API tests from real campaign/output folders.
Separate engine tests, interaction tests, migration checks and approved creative
comparisons. Run full Vitest and Next build before reporting a milestone complete.

## Baseline evidence

2026-09-15: npm ci installed 523 packages. npm test: 402 passed, 2 failed.
Known failures: canvas-alignment test forbids current per-act headline variants;
client-preview test expects obsolete literal copy 'Book your consultation today'.
These are pre-existing creative assumptions; fix assertions against behaviour,
not the approved campaign data. Baseline test log: /tmp/sse-editor-rebuild-baseline.log.

## Test boundaries introduced during implementation

`npm test` now runs engine/interaction/API tests against per-suite temporary
campaign and export directories. `npm run test:creative` runs the extracted
campaign-specific geometry/colour/choreography comparisons. A creative comparison
failure requires reviewing the rendition; changing campaign copy or transition
duration is not by itself a broken editor. The old client-preview literal-copy
assertions now exercise the generated page: changing Offers applies the selected
fixture's text and clears an empty roundel value.

## Implemented worktree and verification (2026-09-15)

Source snapshot: `3b4c2c7`, tagged `snapshot/editor-before-rebuild-2026-09-15`.
Implementation branch: `codex/editor-rebuild`, worktree `.worktrees/editor-rebuild`.
Original campaign JSON, assets and tracked delivery packages are unchanged by the
implementation. The editor reads them directly; no ad recreation is required.

Implemented: production iframe stage and buffered updates; browser animation
seeking and DOM selection; active per-field provenance and edits; named scoped
cross-format sharing/local exceptions; deliberate detach/reset/copy; independent
canvas groups; exact document undo; explicit fitting policies and relative
motion/timing controls; pure validation; isolated test storage; standalone browser
outline capture with complete/current metrics; selected-row fixed-copy exports;
and shared font/outline headline motion and colour.

Verification observed:
- `npm test`: 473 tests passed across 63 files.
- `npm run test:creative`: 32 comparisons passed across 7 files.
- `npm run build`: passed with strict production typechecking. A pre-existing
  Turbopack dynamic filesystem tracing warning remains; broad legacy fixture
  TypeScript debt is excluded from the app build via `tsconfig.build.json`.
- `npm run test:parity -- http://localhost:5184`: 168 poses passed (six sizes,
  offers 0–3, seven timeline positions); exact geometry, wrapped line records,
  font styles, image bytes/decode, visibility and animation transforms.
- Same command with trailing `agency`: 168 canonical-agency poses passed with
  matching explicit feed background images and Studio font bytes.
- `npx tsx --tsconfig tsconfig.json scripts/verify-editor-ownership.ts http://localhost:5184`:
  active fit, undo, save/reload, modifier multiselect, group/ungroup with unchanged
  child motion, cross-format shared edits, local exception and detach passed.
  This check intercepts backend document storage in memory and verifies the
  actual campaign file did not change.
- Four Chromium font/outline motion cases passed across 13 timeline positions,
  covering duplicate size-specific copy and zero-offer early acts in 3/4 frames.
- Actual nondefault triple-offer outline download contained all six sizes with
  the correct state and third offer. Forced capture failure restored editing and
  original size without sending an export request.

Browser reports and screenshots are under `output/playwright/` (gitignored).
Use `npm run setup:browser` if Chromium is not installed on another machine.

## Decisions retained for review

- Legacy fitting remains available for existing campaigns; opting into explicit
  fixed/content-height policy is deliberate, preserving current approved paint.
- Named sharing is available but old campaigns are not silently assigned new
  relationships. The existing scopes remain visible and editable.
- Per-format geometry can remain independent while styles are shared. Virtual
  groups preserve child animation instead of introducing a new transform parent.
- The source snapshot excludes ignored dependency/build/QA caches; those remain
  in the original checkout. No merge or publishing was performed.
- App build checking is separated from pre-existing fixture type debt; this does
  not disable production TypeScript checks or runtime tests.
- Platform agent limits required reusing workers for independent cross-reviews
  of another worker's changes. Reproduced findings were fixed with regressions.


## Delivery rendition and automatic layout controls

The canvas offers **Live HTML** and **Fixed-copy outlines**. Export actions switch
to and await the requested rendition, then leave that delivered rendition visible.
Native font and SVG rasterizations have small baseline differences (up to about
1.5 px in sampled pairs); the outline preview renders the actual delivered SVG
rather than claiming those representations are pixel-identical. An actual
nondefault triple-offer download matched the outline preview's complete SVG
markup and geometry for all 16 text targets in the checked scene.

Offer-related selections expose **Active offer arrangement**. Choosing Manual
captures the current production rest positions before disabling automatic slot,
plus and subline positioning. It applies only in the full current preview state;
other offer counts and other CTA/T&C/roundel combinations remain unchanged.
Returning to Automatic restores the pre-manual geometry. Both changes undo as
whole-document transactions. Measurement requires the matching Live HTML source.

Motion copies are explicitly independent and copy-once; repeated copies replace
the prior copy, including after timing changes. Portable distance/time units are
implemented, but named live motion references are not implemented. The old inert
Linked/Unlink UI has been removed rather than promising nonexistent propagation.

Frame readiness matches exact document/row references, size and rendition, so
an old same-size frame cannot provide metrics for a newly edited document.


The fitting inspector also displays effective engine defaults, including the
percentage-based minimum font floor, so an unseen ratio cannot defeat an edited
pixel minimum. Fixed font sizing ignores dormant shrink limits. Explicit frame
policies use their independent controls instead of a contradictory legacy mode
selector.

## Inspector clarity and QA revisions (September 2026)

Ordinary single-item inspector values now author a local value for the current format and feed conditions. Copy & share properties provides explicit offer-count and format destinations. Copy snapshots selected fields; Share with creates a named live link. Selected destination overrides are replaced, while overrides outside the selected scope and unrelated fields remain intact. Advanced conditions narrow a destination and are optional. Property inheritance exposes effective values and explicit source/local/reset actions; field labels stay compact. Grouped edits retain their existing group semantics.

Preview renditions are called **Dynamic text** and **Fixed text as outlines**. Both are production HTML; the latter bakes the current fitted text as SVG paths and remains fixed-copy. Feed changes reuse the loaded font runtime without a render request. Compatible CSS/fitting changes use exporter-generated HTML as authority and retain the iframe. Structural/runtime/rendition changes replace it. A separate applied-source and settling gate prevents undo or superseded updates from publishing stale DOM as ready. Outline measurement reuses Chromium startup with fresh isolated contexts.

QA uses immutable shell revisions keyed by saved document and renderer fingerprints. Holds and served HTML refer to the same saved snapshot; refresh publishes a new pointer without removing readers' old revisions. The sheet displays its document/renderer revision and feed identity, and checks freshness on focus/every 15 seconds. Unsaved editor changes are explicitly excluded. The sheet stays pinned during review and prompts Refresh shell when saved inputs change. Runtime settlement includes font readiness and refitting; both live QA and capture wait for it before seeking, rather than forcing motion-ready.

Verification commands:

- `npx tsx --tsconfig tsconfig.json scripts/verify-preview-updates.ts http://localhost:5186` — retained iframe, feed requests, layout/undo (including pending fitting), rendition replacement.
- `npx tsx --tsconfig tsconfig.json scripts/verify-editor-ownership.ts http://localhost:5186` — local scope, copy/share, independence, undo/save, grouping, valid property selection.
- `npx tsx --tsconfig tsconfig.json scripts/verify-qa-parity.ts http://localhost:5186` — actual QA sheet versus independently built agency output, including delayed fonts.

These scripts leave campaign files unchanged. QA stress-copy clipping that also occurs in the exported ad remains an authored fitting concern; it is not corrected by changing campaign artwork to satisfy tests.
