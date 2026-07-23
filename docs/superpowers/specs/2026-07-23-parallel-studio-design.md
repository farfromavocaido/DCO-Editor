# Parallel Studio Design

## Purpose

Build a second, opt-in authoring experience for the existing SSE dynamic creative model. The current editor at `/` remains the control version: its route, shell, components, store behaviour, styling, APIs, saved documents, and exports must not change as a consequence of introducing the new workspace.

The new workspace lives at `/studio`. It is an animator-first environment whose sidebar, canvas, and timeline are coordinated views of the same selection, creative state, editing scope, and playhead.

Export work is outside this project. The studio continues to use the existing save and preview services.

## Product intent

The studio keeps the useful mental model of Animate—stage, library-like structure, symbols, direct manipulation, and timeline—while making the existing DCO system easier to understand and author. The interface must distinguish three things wherever the current document model provides the evidence:

1. what is authored on the selected layer or class;
2. what is inherited or supplied by an active variant;
3. what is finally resolved in the active size and feed state.

Percentages remain canonical for reusable campaign timing. The animator may view and enter time as percentage, seconds, or frames without changing the stored timing model.

## Isolation contract

- `/` continues to render `EditorShell` and import `editor.css` exactly as it does today.
- `/studio` is additive and renders only new `src/studio/**` components.
- Studio-only interface state lives in a separate store and separate local-storage key.
- The studio may consume the existing `useEditorStore` as a campaign-document controller. It must not require changes to legacy components or legacy layout CSS.
- Studio styles are rooted beneath `.studio-root`; selectors must not affect the current editor.
- Existing API routes, campaign JSON, preview compiler, text fitting, and save actions remain the authority for creative behaviour.
- Tests must prove that the legacy page still returns `EditorShell`, studio selectors are namespaced, and existing tests remain green.

## Workspace architecture

The workspace has four persistent regions:

1. **Context bar** — campaign, format, preview content, active creative-state dimensions, timing profile, undo/redo, save, preview mode, and global status.
2. **Unified authoring sidebar** — object navigation above and contextual properties below, separated by a remembered divider.
3. **Canvas workspace** — a contextual action strip, centered pasteboard, real creative stage, zoom/pan/navigation controls, selection status, and object warnings.
4. **Timeline** — transport, display-mode controls, semantic beats, resolved rows, clips, playhead, and contextual actions.

The existing right inspector disappears from the studio layout. Advanced HTML inspection may open as the existing modal/drawer action, but it is not treated as an object property.

## Shared interaction context

The existing editor store remains authoritative for:

- active campaign and size;
- feed row and SSE creative-state controls;
- selected target, selected layers, selected clip, and isolation path;
- playhead percentage and playback state;
- creative document, history, save state, fit results, hidden layers, and locked layers;
- document editing actions.

The studio store owns interface preferences that must not leak into the legacy editor:

- sidebar width and object/properties split;
- timeline height and collapsed state;
- object projection (`structure`, `depth`, or `focus`);
- object search and filters;
- timeline projection (`groups`, `depth`, or `focus`);
- time display (`percent`, `seconds`, or `frames`);
- property-section expansion;
- preview chrome mode (`edit`, `preview`, or `qa`);
- whether motion overlays, rulers, guides, and grid are visible;
- transient context-menu state.

Selection is bidirectional. Selecting an item, clip, or canvas object updates the same editor selection. Each surface scrolls or reveals the selected object when practical.

## Context bar

The permanent concepts are Campaign, Format, Content, State, and Timing. For the first SSE-aware fork, the latter three project the current feed row and SSE controls rather than attempting to generalise the schema.

- **Campaign** switches registered creative documents.
- **Format** switches the active size.
- **Content** selects the sample feed row and identifies it by a useful content value.
- **State** opens a compact panel for offer count, legal-copy mode, CTA treatment, and optional roundel frame. These are labelled as controls defined by this campaign, not permanent product concepts.
- **Timing** selects the current three-/four-frame timing profile through the existing feed-state controls.
- Undo, redo, save, and clean/dirty status remain visible.
- Export commands are omitted from the primary studio bar.

The bar collapses low-priority labels before hiding essential controls at narrow widths.

## Unified authoring sidebar

### Selection header

The sticky header shows a breadcrumb from creative to group to selected object, object type, lock/visibility state, and selection count. Buttons provide reveal, isolate/leave isolation, lock, visibility, duplicate, and delete using existing actions.

### Object region

The object browser supports:

- search by label or id;
- filters for text, image, shape, hidden, locked, animated, and overridden where detectable;
- `structure` view grouped by the document's semantic `group` values;
- `depth` view sorted by rendered `zIndex`;
- `focus` view containing the selected group/family and related layers;
- collapsible groups;
- active/inactive variant treatment;
- nested offer value and subline targets;
- visibility and lock controls;
- drag or explicit controls for z-order where supported;
- selection reveal and keyboard navigation.

### Scope and provenance

A sticky context strip above properties states the active editing destination supported by the existing model: shared class/base, current size, or active SSE variant rule. The initial fork does not pretend the model supports scenario-specific motion when it does not.

For each property, the UI shows the current source using the `writeSource` and active-rule information already resolved by `findCreativeTarget`. Available actions include promoting supported fields to the shared style and clearing active overrides.

### Property sections

Tabs are replaced by vertically stacked, collapsible sections:

- **Position & size** — left, top, width, height, and alignment/distribution actions.
- **Content** — object label and sample/feed value where the selected target has a binding.
- **Appearance** — colour, opacity, typography, alignment, and visual fields relevant to the selected kind.
- **Text behaviour** — font size, line height, tracking, wrapping, fitting, maximum lines, and minimum font size.
- **Data** — feed binding plus the active sample value; global feed-row editing remains a context-bar concern.
- **Animation** — selected clip, timing, beat links, easing, and “reveal in timeline”.
- **Advanced** — identifiers, CSS class, source summary, and access to the existing code inspector.

Multiple selection shows common spatial actions and mixed-value indicators instead of pretending there is one target value.

## Canvas workspace

The existing `PreviewPane` is functionally rich but visually tied to the legacy shell. The studio canvas reuses it as the actual editable stage in the first fork, contained by studio-specific chrome and semantic colour tokens. This preserves drag, resize, snapping, nested selection, fit, text fitting, context actions, guides, playback, and campaign fidelity.

Studio canvas behaviour includes:

- centered neutral pasteboard and clear stage edge;
- Fit, 50%, 75%, 100%, 150%, and 200% zoom controls using existing zoom actions;
- keyboard zoom shortcuts and the existing pointer-space behaviour where supported;
- edit, preview, and QA chrome modes;
- selection header showing object, size, and source scope;
- contextual actions for frame/scale resize, alignment, distribution, lock, visibility, duplicate, and more;
- consistent semantic colours: blue selection, cyan user guides, gold snapping, pink motion, red playhead/errors, grey inactive/locked structure, green successful fit;
- warnings for clipped text and missing/empty feed values when current evidence is available;
- click, modifier-click, Enter drill-in, and Escape step-out using existing shared selection actions;
- context menus that select their target first and invoke the same command definitions used by the sidebar and timeline.

The creative surface itself is not visually altered by studio chrome.

## Timeline

The timeline is a semantic projection of the current SSE composition, not a catalogue of every implementation detail.

### Projections

- **Groups** arranges relevant rows under semantic group labels.
- **Depth** arranges rows by rendered stacking order.
- **Focus** shows the selected group and related layers, including the selected object even if it has no clip.

Rows indicate hidden/locked/inactive state, local clip presence, and inherited or timing-profile motion where current helpers can resolve it.

### Time language

The ruler and readout toggle among percent, seconds, and frames. Conversion uses `document.clock.durationS` and `document.clock.fps`; stored and edited values remain percentages.

### Beats and clips

- Named beats have labels, times, vertical guide lines, follower counts, and hover highlighting.
- Three-/four-frame timing scopes use the existing timing-profile helpers.
- Clips remain draggable/resizable through existing editing actions.
- Linked edges identify their beat source. Direct beat movement remains the explicit operation that changes followers.
- Selecting a row or clip updates global selection; selecting a clip reveals the Animation property section.
- “Add motion at playhead” uses existing animation intents rather than a permanent preset strip.
- Transport includes play/pause, start/end, previous/next beat, current readout, timeline fit, and collapsed state.

## Commands and menus

A studio command registry provides one label and one execution path for actions shared across surfaces. The first implementation covers:

- select/reveal/isolate;
- lock/hide;
- duplicate/delete;
- arrange forward/back/front/back;
- align/distribute;
- add motion at playhead;
- reveal in timeline;
- promote supported values to shared style;
- clear supported active overrides;
- edit bound feed value;
- fit/zoom and preview mode.

Menus are keyboard-operable, close on Escape/outside press, restore focus, group destructive actions, and show shortcuts. Unsupported commands are omitted rather than displayed as inert promises.

## QA and status

QA mode presents the evidence already produced by the current system:

- fitted font size and tracking;
- clipped text warnings;
- which selected target is feed-bound and its current sample value;
- hidden/locked/variant-inactive state;
- dirty/saved state;
- active format, feed row, creative state, timing profile, and playhead.

The first fork does not invent a full matrix validator. It creates a clear surface onto which cross-size and cross-state validation can later be added.

## Persistence and failure handling

Studio layout preferences are stored under `sse-dco-studio-session-v1`. Malformed or unavailable local storage falls back to defaults without preventing the editor from loading.

Document and feed failures use the existing status action and remain visible in the context bar. A missing selection, unsupported target, or inactive layer produces an empty-state explanation rather than throwing. Commands re-check their target immediately before mutation.

## Accessibility

- All icon controls have accessible names and visible focus styles.
- Object tree, menus, property sections, splitters, and transport are keyboard-operable.
- Selection is represented by text/shape as well as colour.
- Pointer targets are at least 24 CSS pixels, with larger invisible hit regions for small visual handles.
- Motion in studio chrome respects `prefers-reduced-motion`.

## Testing and acceptance

### Automated

- `/` still imports and renders `EditorShell`.
- `/studio` renders the new `StudioShell`.
- Studio preference parsing, persistence, time conversion, object projection, timeline projection, filtering, and command availability have focused unit tests.
- Legacy store and model suites remain unchanged and green.
- The production build succeeds.

### Browser verification

Using the existing SSE campaign, verify:

1. campaign, size, feed row, SSE state, and timing changes update the stage;
2. selecting in tree, canvas, and timeline remains synchronized;
3. moving and resizing on canvas changes properties and survives save/reload;
4. property edits update the stage and undo/redo works;
5. lock/hide/duplicate/delete and z-order actions work from shared commands;
6. percent/seconds/frames show equivalent playhead positions;
7. moving a beat or clip updates animation timing using one undoable commit;
8. search, filters, projection modes, collapsible timeline, and layout persistence work;
9. `/` still loads and behaves as before after visiting `/studio`;
10. browser console contains no uncaught errors in either route.

## Delivery sequence

1. Route, isolated preference store, shell, semantic tokens, and legacy-route guard.
2. Context bar and unified sidebar with synchronized selection and working properties.
3. Studio canvas chrome around the proven editable preview.
4. Semantic timeline projections, time modes, transport, beats, and clip editing.
5. Shared commands, menus, keyboard behaviour, QA status, persistence, and accessibility.
6. Complete automated and browser non-regression verification.

Each sequence is usable in `/studio`; none replaces or migrates the legacy editor.
