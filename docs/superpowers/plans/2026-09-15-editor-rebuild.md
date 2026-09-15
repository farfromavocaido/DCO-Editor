# Production Renderer and Ownership Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Carry the current campaigns into an editor with production-renderer parity and explicit, editable ownership.
**Architecture:** Embed production HTML as the editor stage, resolve values and write sources consistently, and keep creative policies in documents. Preserve current assets and authored campaign layouts.
**Tech Stack:** Next 16, React 19, Zustand, TypeScript, Vitest, browser CSS animation, Playwright.
**Spec:** docs/EDITOR_REBUILD.md

## Global Constraints

- Work only in .worktrees/editor-rebuild; do not modify the original checkout.
- Same document/row/assets/time must produce the same editor/export rendition.
- Do not replace current client-approved campaign copy or geometry to satisfy tests.
- Preserve existing public store/model methods while migrating callers.
- No publishing or merging; commit reviewable changes on codex/editor-rebuild.
- Behavioural tests first, scoped verification after changes, whole-suite and browser verification at integration.

### Task 1: Production renderer editing surface

**Files:** src/components/PreviewPane.tsx; new src/components/ProductionCreativeStage.tsx; new src/lib/production-stage.ts; src/server/render-creative-preview.ts; src/app/api/creative/[size]/view/route.ts; relevant new tests.
**Interfaces:** Consume existing store document/row/selection/time and editing operations. Produce an iframe stage using POST /api/creative/{size}/view with `{document,row}`. Export read-only stage DOM access for existing snapshot consumers without duplicating creative markup.
- [x] Write tests for production HTML response, latest-request ownership, target ID mapping and exact CSS-animation seeking.
- [x] Run the tests and establish the missing behaviour.
- [x] Host exported HTML; map rendered targets to outer selection/drag/resize controls; preserve multi-selection and stage zoom. Handle readiness and errors without stale stage replacement.
- [x] Verify edits, feed state switching, seeking, undo and snapshot capture in a real browser.
- [x] Commit and report exact tests and remaining integration constraints.

### Task 2: Effective ownership and editable fit

**Files:** src/lib/creative-model.ts; new src/lib/creative-ownership.ts; src/components/CreativeInspector.tsx; src/store/editor-store.ts; src/server/creative-document.ts; associated tests.
**Interfaces:** Preserve findCreativeTarget and updateCreativeTargetValue/Fit signatures. Return per-field provenance alongside values and fit. Inspector fields consume resolved fit and call target-fit writes for ordinary and nested text. Pure validation must not seed or strip creative rules.
- [x] Write behavioural tests that edit MPU zero-offer maxLines while preserving baseline and unrelated variants, test compound scopes and unscoped rules, and assert validation does not mutate documents.
- [x] Run failing tests before changes.
- [x] Centralise property/fit resolution and source selection. Expose active/shared edit intent and per-field provenance; remove silent roundel deletion from validation and replace migration with an explicit operation.
- [x] Implement deliberate local reset, shared edit and detach semantics without relying on CSS class equality as ownership. Keep compatibility with existing campaigns.
- [x] Verify save/reload and undo preserve active values and relations; commit and report.

### Task 3: Explicit text frames and relative motion

**Files:** src/lib/text-fit.ts; src/lib/fit-box.ts; src/lib/creative-compiler.ts; src/lib/animation-intents.ts; new policy/unit helper modules and tests. Coordinate inspector additions with Task 2.
**Interfaces:** Preserve existing public fitting and compiler APIs. Add explicit opt-in frame-fit policy without silently changing legacy campaign paint; add motion distance units resolved using supplied canvas/parent dimensions. The production renderer remains the measurement authority.
- [x] Test fixed frame preservation, whole-text multiline fit, impossible-fit diagnostics, stable shared fitting and parameterised motion distances.
- [x] Observe failures, then implement policy-driven fitting and explicit relative-distance resolution while preserving legacy defaults for unmigrated documents.
- [x] Add authorable controls via a small component integrated with Task 2; avoid hardcoded per-format design decisions.
- [x] Verify short/long copy and relative distances across representative formats; commit and report.

### Task 4: Integration, test boundaries and migration evidence

**Files:** src/lib/canvas-alignment.test.ts; src/server/__tests__/creative-exporter.test.ts; docs/EDITOR_REBUILD.md; browser verification script under scripts/; package.json if needed.
**Interfaces:** Consume completed tasks and production stage. Check independently rendered export against editor state, not one screenshot copied twice.
- [x] Replace the two baseline creative-assumption failures with fixtures/assertions of supported behaviour.
- [x] Exercise editor/packaged parity, active fit editing, scope independence, drag, resize, undo, save/reload and campaign switching in the browser.
- [x] Run npm test, npm run build, git diff --check; record limitations and migration evidence honestly.
- [x] Review the complete diff and address regressions. Commit the verified milestone; preserve the worktree for user review.

## Scope tracking

The complete design includes general named sharing sets and standalone browser
outline capture. If an integration exposes a dependency that cannot safely fit
an initial vertical slice, record it explicitly as outstanding; never present
partial legacy compatibility as completion of the full architecture.


## Completion record

Completed as a compatible first rebuild in the isolated worktree. See
`docs/EDITOR_REBUILD.md` for verification and explicit retained limitations.
Actual output rendition preview, strict snapshot completeness/source guards,
manual current-state offer arrangement and test storage isolation are included.
Legacy fitting and current campaign data are preserved until explicit authoring
changes. Motion copying is deliberately described as independent; named live
motion references are not implemented.
