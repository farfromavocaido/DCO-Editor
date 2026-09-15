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
