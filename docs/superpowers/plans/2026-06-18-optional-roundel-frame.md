# Optional Roundel Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MPU-first optional roundel frame that switches enabled rows to a four-act timing profile while preserving existing three-act rows.

**Architecture:** Extend the existing feed-row-driven state model with frame and roundel scopes, then let preview/export resolve properties and animation beats against those scopes. Keep the new visual layer MPU-only in the creative JSON, with exporter/runtime support generic enough to expand later.

**Tech Stack:** Next.js app, Zustand store, Vitest tests, structured creative JSON, custom HTML exporter.

## Global Constraints

- `include_roundel_frame_bool=false` must preserve the current three-act timing and layout.
- `include_roundel_frame_bool=true` selects `frames-4` and shows the extra Heading 3 plus roundel frame before CTA.
- First implementation is scoped to `300x250`.
- No browser or Playwright verification in this pass.
- Run targeted tests for changed model/export behaviour.

---

### Task 1: Feed Fields And Active Scopes

**Files:**
- Modify: `src/server/feed-schema.ts`
- Modify: `src/lib/feed-model.ts`
- Modify: `src/store/editor-store.ts`
- Modify: `src/components/CreativeInspector.tsx`
- Test: `src/server/__tests__/feed-schema.test.ts`
- Test: `src/lib/feed-model.test.ts`

**Interfaces:**
- Produces: `controlsFromFeedRow(row).frameCount`, `controlsFromFeedRow(row).includeRoundelFrame`, `controlsFromFeedRow(row).roundelMode`
- Produces: active scope arrays containing `frames-3` or `frames-4` plus roundel scopes

- [ ] Add failing tests for feed metadata, boolean coercion, and derived controls.
- [ ] Implement feed field definitions and coercion.
- [ ] Update editor active scope generation.
- [ ] Render boolean sample fields as checkboxes.
- [ ] Run targeted feed tests.

### Task 2: Timing Profile Resolution

**Files:**
- Create: `src/lib/timing-profiles.ts`
- Modify: `src/lib/creative-compiler.ts`
- Modify: `src/components/TimelinePanel.tsx`
- Modify: `src/components/CreativeInspector.tsx`
- Modify: `campaign/sse-dco-creative.json`
- Test: `src/lib/timing-profiles.test.ts`

**Interfaces:**
- Produces: `activeTimingProfile(document, scopesOrRow)`
- Produces: `beatsForScopes(document, activeScopes)`

- [ ] Add failing tests proving `frames-3` falls back to existing beats and `frames-4` resolves four-act beats.
- [ ] Implement timing profile helpers.
- [ ] Add `clock.profiles.frames-3` and `clock.profiles.frames-4` to the creative document.
- [ ] Wire preview timeline/readouts to active beats where practical.
- [ ] Run targeted timing tests.

### Task 3: Deterministic Variant Merging

**Files:**
- Modify: `src/lib/creative-model.ts`
- Test: `src/lib/creative-model.test.ts`

**Interfaces:**
- Produces: merged target values from all matching active variant rules in active-scope order
- Produces: write source using the highest-priority existing editable active rule

- [ ] Add failing tests for multi-scope merge ordering and scoped writes.
- [ ] Implement active variant collection and merge ordering.
- [ ] Preserve visibility-only behaviour for edit target selection.
- [ ] Run targeted creative model tests.

### Task 4: MPU Roundel Layer

**Files:**
- Modify: `src/lib/creative-model.ts`
- Modify: `src/components/PreviewPane.tsx`
- Modify: `campaign/sse-dco-creative.json`
- Test: `src/lib/creative-model.test.ts`

**Interfaces:**
- Produces nested editable targets `roundel-frame::roundel-copy` and `roundel-frame::roundel-value`

- [ ] Add failing model test for roundel nested targets.
- [ ] Add generic nested child definitions for roundel children.
- [ ] Add MPU roundel layer, class rules, and variant rules.
- [ ] Render roundel text in editor preview.
- [ ] Run targeted model test.

### Task 5: Export Runtime And Scoped Animation

**Files:**
- Modify: `src/server/creative-exporter.ts`
- Test: `src/server/__tests__/creative-exporter.test.ts`

**Interfaces:**
- Produces exported fields for `roundel_text_text` and `roundel_value_text`
- Produces runtime classes for frame and roundel modes
- Produces profile-scoped animation CSS

- [ ] Add failing exporter tests for new DCO fields, state classes, and scoped MPU animation.
- [ ] Update runtime normalization and state class derivation.
- [ ] Add roundel binding and text fitting rules.
- [ ] Emit scoped animation rules for timing profiles.
- [ ] Run targeted exporter tests.

### Task 6: Lightweight Verification

**Files:**
- Check changed files with `git diff`

- [ ] Run targeted tests touched above.
- [ ] Run `npm test -- --run` only if targeted tests are quick and stable.
- [ ] Report any skipped heavy/browser testing.
