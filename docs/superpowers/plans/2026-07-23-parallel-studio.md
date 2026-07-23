# Parallel Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully interactive SSE-aware authoring workspace at `/studio` while leaving the existing `/` editor and its behaviour unchanged.

**Architecture:** The route and all new interface components live under `src/studio/**`. The existing Zustand editor store remains the campaign/document controller; a separate studio store owns only layout and display preferences. Pure projection and time helpers sit between the current creative document and the new object/timeline views, while the proven preview canvas and existing document actions remain authoritative.

**Tech Stack:** Next.js 16 App Router, React 19, Zustand 5, TypeScript, Vitest, existing creative model/compiler APIs, route-scoped global CSS rooted at `.studio-root`.

## Global Constraints

- Do not modify `src/app/page.tsx`, `src/components/EditorShell.tsx`, `src/app/editor.css`, or legacy component behaviour.
- Read relevant Next.js guidance in `node_modules/next/dist/docs/` before changing App Router files.
- Keep `/studio` additive and opt-in.
- Keep percentages canonical; seconds and frames are display/input projections only.
- Reuse current campaign JSON, feed, save, undo/redo, preview, text-fit, and animation actions.
- Omit export work from the new primary workspace.
- Root every new CSS rule under `.studio-root`.
- Follow test-first development for each task and run the complete suite after every independently testable deliverable.

---

## File map

### Route and shell

- `src/app/studio/page.tsx` — exposes `/studio` and imports the required legacy-stage and studio CSS.
- `src/studio/StudioShell.tsx` — initializes the editor controller, installs workspace keyboard handling, and lays out the four regions.
- `src/studio/studio.css` — namespaced visual system and responsive layout.

### Studio state and pure projections

- `src/studio/studio-store.ts` — studio-only preferences, persistence parsing, and layout actions.
- `src/studio/studio-time.ts` — percent/seconds/frame conversions and labels.
- `src/studio/studio-objects.ts` — structure/depth/focus projections and search/filter logic.
- `src/studio/studio-timeline.ts` — active rows, group/depth/focus projection, beat followers, and time ticks.
- `src/studio/studio-commands.ts` — command descriptors and availability derived from current selection.

### Interface components

- `src/studio/StudioContextBar.tsx` — campaign/format/content/state/timing and history/save status.
- `src/studio/StudioSidebar.tsx` — selection header, object/properties split, and splitter.
- `src/studio/StudioObjectTree.tsx` — searchable/filterable object projections.
- `src/studio/StudioProperties.tsx` — collapsible contextual property groups and provenance.
- `src/studio/StudioCanvas.tsx` — action strip, preview modes, warnings, and existing editable stage.
- `src/studio/StudioTimeline.tsx` — semantic timeline, ruler, beats, rows, clips, transport, and splitter/collapse.
- `src/studio/StudioMenu.tsx` — accessible shared context/action menu.
- `src/studio/StudioIcon.tsx` — small studio-only icon set so legacy icon code is unchanged.

### Tests

- `src/studio/studio-store.test.ts`
- `src/studio/studio-time.test.ts`
- `src/studio/studio-objects.test.ts`
- `src/studio/studio-timeline.test.ts`
- `src/studio/studio-commands.test.ts`
- `src/app/studio-layout.test.ts`

---

### Task 1: Studio preference store and time language

**Files:**
- Create: `src/studio/studio-store.ts`
- Create: `src/studio/studio-store.test.ts`
- Create: `src/studio/studio-time.ts`
- Create: `src/studio/studio-time.test.ts`

**Interfaces:**
- Produces: `useStudioStore`, `readStudioPreferences`, `STUDIO_SESSION_KEY`.
- Produces: `percentToSeconds`, `percentToFrame`, `valueToPercent`, `formatStudioTime`, `timelineTicks`.

- [ ] **Step 1: Write failing preference tests**

```ts
test('malformed persisted preferences fall back without leaking legacy state', () => {
  assert.deepEqual(readStudioPreferences('{not-json'), DEFAULT_STUDIO_PREFERENCES);
  assert.equal(STUDIO_SESSION_KEY, 'sse-dco-studio-session-v1');
});

test('preference parsing accepts only supported projections and bounded sizes', () => {
  const result = readStudioPreferences(JSON.stringify({
    objectView: 'depth', timeMode: 'frames', sidebarWidth: 9999,
  }));
  assert.equal(result.objectView, 'depth');
  assert.equal(result.timeMode, 'frames');
  assert.equal(result.sidebarWidth, 520);
});
```

- [ ] **Step 2: Run the preference tests and confirm the missing-module failure**

Run: `npm test -- src/studio/studio-store.test.ts`

Expected: FAIL because `studio-store.ts` does not exist.

- [ ] **Step 3: Implement validated defaults and actions**

```ts
export const STUDIO_SESSION_KEY = 'sse-dco-studio-session-v1';
export const DEFAULT_STUDIO_PREFERENCES = {
  sidebarWidth: 336,
  sidebarSplit: 46,
  timelineHeight: 300,
  timelineCollapsed: false,
  objectView: 'structure',
  timelineView: 'groups',
  timeMode: 'percent',
  chromeMode: 'edit',
  objectSearch: '',
  objectFilters: [],
  openPropertySections: ['position', 'appearance'],
};

export function readStudioPreferences(raw?: string | null) {
  // Parse, whitelist enum values, clamp sidebarWidth 260–520,
  // sidebarSplit 25–75, and timelineHeight 160–560.
}
```

Create a Zustand store whose setters update only the keys above and call a guarded `localStorage.setItem(STUDIO_SESSION_KEY, JSON.stringify(preferences))`.

- [ ] **Step 4: Write failing conversion tests**

```ts
test('percent, seconds, and frames round-trip through the canonical percentage', () => {
  assert.equal(percentToSeconds(28, 15), 4.2);
  assert.equal(percentToFrame(28, 15, 30), 126);
  assert.equal(valueToPercent(4.2, 'seconds', 15, 30), 28);
  assert.equal(valueToPercent(126, 'frames', 15, 30), 28);
});
```

- [ ] **Step 5: Implement conversion and labelling helpers**

```ts
export type StudioTimeMode = 'percent' | 'seconds' | 'frames';
export const percentToSeconds = (percent: number, durationS: number) => percent / 100 * durationS;
export const percentToFrame = (percent: number, durationS: number, fps: number) => Math.round(percentToSeconds(percent, durationS) * fps);
export function valueToPercent(value: number, mode: StudioTimeMode, durationS: number, fps: number): number;
export function formatStudioTime(percent: number, mode: StudioTimeMode, durationS: number, fps: number): string;
export function timelineTicks(mode: StudioTimeMode, durationS: number, fps: number): Array<{ percent: number; label: string }>;
```

- [ ] **Step 6: Run both suites and commit**

Run: `npm test -- src/studio/studio-store.test.ts src/studio/studio-time.test.ts`

Expected: both suites PASS.

Commit: `git commit -am "feat(studio): add isolated workspace preferences"` after staging the four files.

---

### Task 2: Route, isolated shell, and CSS contract

**Files:**
- Create: `src/app/studio/page.tsx`
- Create: `src/studio/StudioShell.tsx`
- Create: `src/studio/StudioIcon.tsx`
- Create: `src/studio/studio.css`
- Create: `src/app/studio-layout.test.ts`

**Interfaces:**
- Consumes: `useEditorStore.init`, `useStudioStore` preferences.
- Produces: public `/studio` route and `.studio-root` workspace.

- [ ] **Step 1: Write a failing route/isolation test**

Read the route, shell, legacy page, and new stylesheet as text. Assert:

```ts
assert.match(studioPage, /StudioShell/);
assert.match(studioShell, /className="studio-root"/);
assert.match(legacyPage, /<EditorShell\s*\/>/);
assert.doesNotMatch(legacyPage, /StudioShell/);
for (const selector of studioCss.matchAll(/(^|\})\s*([^@][^{]+)\{/gm)) {
  assert.match(selector[2], /\.studio-root/);
}
```

- [ ] **Step 2: Run the route test and confirm it fails because `/studio` is absent**

Run: `npm test -- src/app/studio-layout.test.ts`

Expected: FAIL reading the missing studio files.

- [ ] **Step 3: Add the route and shell**

`src/app/studio/page.tsx` imports `../editor.css`, `@/studio/studio.css`, and returns `<StudioShell />`. `StudioShell` is a client component that calls `init()` once, displays a loading empty state until `creativeDocument` exists, and renders landmarks for context bar, sidebar, canvas, and timeline.

- [ ] **Step 4: Add the namespaced visual foundation**

Define all colour, spacing, typography, and sizing custom properties on `.studio-root`. Use a fixed viewport shell, a 44px context bar, CSS grid columns driven by `--studio-sidebar-width`, and rows driven by `--studio-timeline-height`. Every selector must begin with `.studio-root`, including media queries and legacy-preview overrides.

- [ ] **Step 5: Run route test, full tests, and commit**

Run: `npm test -- src/app/studio-layout.test.ts && npm test`

Expected: all suites PASS.

Commit: `git commit -am "feat(studio): add isolated studio route and shell"` after staging new files.

---

### Task 3: Object and timeline projection models

**Files:**
- Create: `src/studio/studio-objects.ts`
- Create: `src/studio/studio-objects.test.ts`
- Create: `src/studio/studio-timeline.ts`
- Create: `src/studio/studio-timeline.test.ts`

**Interfaces:**
- Produces: `buildStudioObjectProjection`, `filterStudioObjects`, `StudioObjectNode`.
- Produces: `buildStudioTimelineProjection`, `beatFollowers`, `StudioTimelineRow`.

- [ ] **Step 1: Write failing object-projection tests**

Use three fixture layers with groups, kinds, z-indexes, hidden/locked sets, clips, and one nested offer layer. Assert structure groups semantically, depth sorts descending z-index, focus includes the selected group, and filters/search return only matches while preserving parent groups.

- [ ] **Step 2: Run the object tests and observe the missing implementation failure**

Run: `npm test -- src/studio/studio-objects.test.ts`

- [ ] **Step 3: Implement object projection**

```ts
export type StudioObjectView = 'structure' | 'depth' | 'focus';
export type StudioObjectFilter = 'text' | 'image' | 'shape' | 'hidden' | 'locked' | 'animated' | 'overridden';
export type StudioObjectNode = {
  id: string; label: string; kind: 'group' | 'layer' | 'target';
  layerId?: string; targetId?: string; group?: string; zIndex?: number;
  hidden?: boolean; locked?: boolean; animated?: boolean; overridden?: boolean;
  children?: StudioObjectNode[];
};
```

Nested targets come from `editableTargetsForLayer`; offer structure may use `offerInteractionTree`. Do not mutate document layers.

- [ ] **Step 4: Write failing timeline-projection tests**

Assert that groups/depth/focus produce different row order, inactive offer rows are marked rather than silently presented as active, the selected unanimated layer remains in focus mode, and `beatFollowers` counts `startBeat`/`endBeat` references.

- [ ] **Step 5: Implement timeline projection**

```ts
export type StudioTimelineView = 'groups' | 'depth' | 'focus';
export type StudioTimelineRow = {
  id: string; layerId: string; label: string; group: string;
  zIndex: number; active: boolean; hidden: boolean; locked: boolean;
  clips: Array<Record<string, unknown>>;
};
```

Resolve active offer membership with current selection-group helpers and profile-specific headline clips with `clipsForProfile`.

- [ ] **Step 6: Run projection suites and commit**

Run: `npm test -- src/studio/studio-objects.test.ts src/studio/studio-timeline.test.ts`

Expected: both PASS.

Commit: `git commit -am "feat(studio): project active objects and timeline rows"` after staging new files.

---

### Task 4: Context bar and unified sidebar

**Files:**
- Create: `src/studio/StudioContextBar.tsx`
- Create: `src/studio/StudioSidebar.tsx`
- Create: `src/studio/StudioObjectTree.tsx`
- Modify: `src/studio/StudioShell.tsx`
- Modify: `src/studio/studio.css`
- Modify: `src/app/studio-layout.test.ts`

**Interfaces:**
- Consumes editor actions: `switchCampaign`, `loadSize`, `setFeedRowIndex`, `setVariantControl`, `undo`, `redo`, `saveCreativeDocument`.
- Consumes studio actions: view/search/filter/split setters.
- Produces synchronized tree selection through `selectTarget`, `selectLayer`, lock/visibility, duplicate/delete, and z-order actions.

- [ ] **Step 1: Extend the layout test with required controls and accessible landmarks**

Assert source contains accessible labels for Campaign, Format, Content, Creative state, Timing, Search objects, Object view, and Resize objects and properties.

- [ ] **Step 2: Run the test and verify those controls are absent**

Run: `npm test -- src/app/studio-layout.test.ts`

- [ ] **Step 3: Implement the context bar**

Project current SSE controls into campaign-defined concepts. Content options use `feedDraft.rows`; Creative state contains offer count, T&Cs, CTA, and frame controls; Timing sets the current three/four-frame control. Keep undo/redo/save/dirty/status visible and omit export buttons.

- [ ] **Step 4: Implement the object browser**

Use `buildStudioObjectProjection` and `filterStudioObjects`. Render semantic/depth/focus segmented controls, search, filter chips, collapsible group rows, nested target rows, state badges, lock/visibility buttons, and keyboard ArrowUp/ArrowDown/Home/End navigation. Selecting a node calls the matching existing store action.

- [ ] **Step 5: Implement the selection header and resizable split**

Show breadcrumb, selection count, source badge, lock/visibility/isolation, duplicate/delete. The pointer splitter updates `sidebarSplit` and clamps it through the studio store. The lower region initially renders a properties placeholder for Task 5.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- src/app/studio-layout.test.ts src/studio/studio-objects.test.ts && npm test`

Commit: `git commit -am "feat(studio): add campaign context and unified object sidebar"` after staging modified/new files.

---

### Task 5: Contextual property sections and provenance

**Files:**
- Create: `src/studio/StudioProperties.tsx`
- Modify: `src/studio/StudioSidebar.tsx`
- Modify: `src/studio/studio.css`
- Modify: `src/app/studio-layout.test.ts`

**Interfaces:**
- Consumes: `findCreativeTarget`, `feedFieldForEditableTarget`, `selectedFeedRow`, fit maps, selected clip.
- Mutates through: `updateCreativeTargetValue`, `updateCreativeTargetFitValue`, `updateCreativeLayerMetadataValue`, `updateCreativeLayerClipValue`, `promoteCreativeTargetToSharedStyle`, `clearCreativeTargetOverrides`, alignment/distribution actions.

- [ ] **Step 1: Add failing source assertions for the seven property sections**

Assert `StudioProperties.tsx` contains Position & size, Content, Appearance, Text behaviour, Data, Animation, and Advanced headings and a visible `Source:` label.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- src/app/studio-layout.test.ts`

- [ ] **Step 3: Build typed property controls**

Create reusable number, text, select, colour, toggle, and mixed-value rows. Commit numeric values on blur/Enter and preserve raw strings while editing. The fields shown are derived from selected kind and available values, not hardcoded as always valid.

- [ ] **Step 4: Build the seven collapsible sections**

Position includes spatial fields and alignment. Content exposes label and current bound sample value. Appearance and Text behaviour edit supported base/fit fields. Data displays binding/source and opens the sample value editor. Animation edits the selected clip and can select/reveal it. Advanced shows ids/classes and opens the existing HTML inspector.

- [ ] **Step 5: Add provenance and override actions**

Map `writeSource.kind` to Shared class, Active variant, or Size layer. Show the active scope and only offer Promote/Clear when current store actions support the target/fields.

- [ ] **Step 6: Run all tests and commit**

Run: `npm test && npm run lint`

Commit: `git commit -am "feat(studio): add contextual properties and provenance"` after staging.

---

### Task 6: Interactive studio canvas

**Files:**
- Create: `src/studio/StudioCanvas.tsx`
- Modify: `src/studio/StudioShell.tsx`
- Modify: `src/studio/studio.css`
- Modify: `src/app/studio-layout.test.ts`

**Interfaces:**
- Wraps: existing `PreviewPane` as the authoritative editable stage.
- Consumes: selection, zoom, resize, alignment, distribute, lock/hide, duplicate/delete, fit and feed status actions.

- [ ] **Step 1: Add failing canvas-chrome assertions**

Assert source includes Edit/Preview/QA modes, Fit zoom, Frame/Scale resize, selection context, and QA warning region.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- src/app/studio-layout.test.ts`

- [ ] **Step 3: Add the contextual action strip**

Single selection: source, resize mode, alignment, lock, visibility, duplicate, delete. Multiple selection: alignment/distribution. No selection: preview mode and fit. All actions call existing store methods.

- [ ] **Step 4: Embed and restyle the proven stage**

Place `PreviewPane` inside `.studio-root .studio-canvas-stage`. Use namespaced overrides to suppress duplicate legacy panel framing while retaining its stage, pointer behaviour, guides, handles, and context menu. Centre the pasteboard and preserve the creative's own pixels.

- [ ] **Step 5: Add preview modes and QA status**

Preview mode hides editor chrome without disabling playback. QA mode shows clipped text, fitted size/tracking, empty binding, hidden/locked state, size/state/time summary. Edit restores selection chrome.

- [ ] **Step 6: Add keyboard zoom and preview toggle**

Handle Meta/Ctrl `+`, `-`, and `0` only when focus is outside inputs. Use existing zoom actions. Toggle preview chrome with `P` when not typing.

- [ ] **Step 7: Run tests and commit**

Run: `npm test && npm run lint`

Commit: `git commit -am "feat(studio): add coordinated interactive canvas"` after staging.

---

### Task 7: Semantic timeline and transport

**Files:**
- Create: `src/studio/StudioTimeline.tsx`
- Modify: `src/studio/StudioShell.tsx`
- Modify: `src/studio/studio.css`
- Modify: `src/app/studio-layout.test.ts`

**Interfaces:**
- Consumes: `buildStudioTimelineProjection`, `beatsForFrameScope`, `formatStudioTime`, `timelineTicks`.
- Mutates through: `setPercent`, `togglePlaying`, `selectTimelineLayer`, `selectClip`, `updateCreativeLayerClipValue`, `applyCreativeBeatValue`, `addAnimationIntent`.

- [ ] **Step 1: Add failing assertions for timeline controls**

Assert source includes Groups/Depth/Focus, Percent/Seconds/Frames, previous/next beat, Add motion at playhead, and Collapse timeline.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- src/app/studio-layout.test.ts`

- [ ] **Step 3: Build transport and ruler**

Render start, previous beat, play/pause, next beat, end, time-mode selector, exact readout, and collapse. The playhead and tick labels use percentage positions but mode-specific text.

- [ ] **Step 4: Build semantic beat layer**

Render named beat heads and vertical lines from the active frame scope. Show follower count and highlight followers on hover. Pointer dragging previews the percentage and calls `applyCreativeBeatValue(frameScope, beatName, percent)` once on release; Escape cancels.

- [ ] **Step 5: Build rows and clips**

Render the chosen projection with group headers, state/source badges, hidden/locked treatment, and selected row. Clip bars resolve start/end through beat references, select globally, drag as a unit, and resize local edges through `updateCreativeLayerClipValue` once per completed gesture.

- [ ] **Step 6: Add motion at playhead and resize/collapse**

The Add motion menu lists current animation intents and applies the selected intent to the selected layer. The timeline splitter persists height; collapse leaves compact transport visible.

- [ ] **Step 7: Run tests and commit**

Run: `npm test -- src/studio/studio-timeline.test.ts src/studio/studio-time.test.ts src/app/studio-layout.test.ts && npm test`

Commit: `git commit -am "feat(studio): add semantic timeline and transport"` after staging.

---

### Task 8: Shared commands, menus, and cross-surface keyboard behaviour

**Files:**
- Create: `src/studio/studio-commands.ts`
- Create: `src/studio/studio-commands.test.ts`
- Create: `src/studio/StudioMenu.tsx`
- Modify: `src/studio/StudioObjectTree.tsx`
- Modify: `src/studio/StudioProperties.tsx`
- Modify: `src/studio/StudioCanvas.tsx`
- Modify: `src/studio/StudioTimeline.tsx`
- Modify: `src/studio/StudioShell.tsx`
- Modify: `src/studio/studio.css`

**Interfaces:**
- Produces: `studioCommandsForContext(context, editorState)`; each returned descriptor owns its guarded `run` callback.
- Produces: one accessible `StudioMenu` used by tree, canvas chrome, and timeline.

- [ ] **Step 1: Write failing command-availability tests**

Assert destructive/arrange/motion commands are absent without a selection, lock toggles label correctly, multi-selection exposes distribute, and unsupported override actions are omitted.

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- src/studio/studio-commands.test.ts`

- [ ] **Step 3: Implement command descriptors**

```ts
export type StudioCommand = {
  id: string; label: string; group: 'selection' | 'edit' | 'arrange' | 'scope' | 'motion' | 'state';
  shortcut?: string; destructive?: boolean; run: () => void;
};
export function studioCommandsForContext(context: 'object' | 'canvas' | 'timeline', state: any): StudioCommand[];
```

Commands use existing editor actions and re-read `useEditorStore.getState()` inside `run`.

- [ ] **Step 4: Implement the accessible shared menu**

Use `role="menu"`, roving focus, ArrowUp/Down, Home/End, Enter/Space, Escape, outside press, grouped separators, shortcuts, and focus restoration.

- [ ] **Step 5: Connect menus and global keys**

Right-click first synchronizes selection, then opens context-appropriate commands. Add Delete/Backspace, Enter drill-in, Escape step-out/menu close, Space playback, Arrow frame-step, Shift+Arrow beat-step, and `\\` timeline fit while respecting inputs/contenteditable.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- src/studio/studio-commands.test.ts && npm test && npm run lint`

Commit: `git commit -am "feat(studio): unify commands and contextual menus"` after staging.

---

### Task 9: Browser verification, accessibility, and non-regression

**Files:**
- Modify only studio files where verification uncovers defects.
- Update: `docs/superpowers/specs/2026-07-23-parallel-studio-design.md` only if verified behaviour requires clarification; do not weaken requirements to match defects.

- [ ] **Step 1: Run full automated verification**

Run: `npm test`

Expected: zero failures.

Run: `npm run lint`

Expected: zero errors.

Run: `npm run build`

Expected: successful production build with both `/` and `/studio` routes.

- [ ] **Step 2: Launch the app and verify `/studio` interaction flows**

Run `npm run dev`, open `/studio`, and exercise all ten browser acceptance checks in the design spec. Record console output and screenshots for edit, preview, QA, structure/depth/focus, and all three time modes.

- [ ] **Step 3: Verify legacy non-regression in the same server session**

Open `/`, switch campaign/size/state, select and drag an object, scrub/play the timeline, edit a property, undo, and reload. Confirm the legacy layout is unchanged and the console has no uncaught errors.

- [ ] **Step 4: Audit accessibility and persistence**

Keyboard-walk context bar → object tree → property sections → canvas actions → timeline. Verify visible focus, menu focus trapping/return, splitter labels, screen-reader names, reduced-motion behaviour, and persisted studio-only preferences after reload. Confirm visiting `/studio` does not create or alter legacy UI preferences beyond the existing editor controller's own session data.

- [ ] **Step 5: Re-run verification after fixes**

Run: `npm test && npm run lint && npm run build`

Expected: all commands exit 0 after any browser-discovered changes.

- [ ] **Step 6: Commit the verified studio**

Stage only studio files, the `/studio` route/test, and intentional documentation. Review `git diff --cached --stat` and `git diff --cached`. Commit with `feat(studio): deliver parallel interactive authoring workspace`.

---

## Completion audit

Before claiming completion, map every bullet in `docs/superpowers/specs/2026-07-23-parallel-studio-design.md` to one of:

- an automated test;
- a browser interaction performed against the running app;
- a source/CSS inspection for isolation and accessibility.

Any missing, indirect, or contradictory evidence means the implementation remains incomplete. In particular, a successful build alone does not prove canvas/timeline interactivity or legacy non-regression.
