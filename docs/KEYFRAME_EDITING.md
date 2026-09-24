# Timeline and motion editing

The timeline and Layers sidebar share a front-to-back layer tree. Frontmost layers appear at the top. Reordering changes the document’s stacking order; it is not a separate timeline sort. Existing components and contiguous canvas selection groups remain identifiable.

## Reading the timeline

- Teal, full-height presence bars show when an element is on canvas. Pink ranges show changes within that time.
- **Opacity** shades presence according to the element’s effective opacity, including ancestors. The outline stays readable.
- Presence is sampled from the settled production DOM at 20 ms intervals, in short batches. The actual browser animation supplies resolved motion keyframes. Invisible reset movements are omitted from the normal range view; detailed keyframes remain inspectable.
- **Excluded** reveals layers omitted from this version and explains empty text, conditions, unused offer slots, scheduling exclusions, transparency or off-canvas placement. Later entrances remain visible in the default timeline. Preview-hidden layers remain accessible.
- The sticky ruler shares its coordinate system with every track and the full-height playhead. It shows second and 5% ticks; minor labels thin out on narrow tracks.
- While a changed preview is being measured, the previous row layout stays in place and motion handles are disabled. This avoids controls jumping as excluded rows are temporarily reintroduced.

## Editing motion

Click a range to edit its timing, From/To values and easing. Drag its body to move it, or its endpoint to change its extent. **Timing anchor** distinguishes Start + duration, End − duration and independent keyframes. A solid larger endpoint is an anchor; a smaller endpoint is duration-derived. Both endpoints are solid when authored independently.

**Keyframes** exposes detailed time, offsets, opacity, scale, easing and animated layout coordinates. Numeric fields commit on blur/Enter. Offsets are relative to layout position; Units determines pixels/ad%/parent%. Unanimated layout fields say **Use layout**, not zero. Final frames have no outgoing easing control. Presets convert to custom frames only on an explicit edit.

Some campaign rules replace authored timing, particularly distributed zero-offer headlines and skipped duplicate acts. These show dashed calculated ranges and an inspector describing the actual production rule, with its timing anchors. They cannot be dragged as though they were authored frames.

**Make timing independent** captures the current resolved animation in a scoped motion override for this format and these conditions. It retains the visible entrance, holds and exit, while trimming invisible clock padding. The override is rendered through the production CSS in editor, HTML and outlined output. Other conditions retain their existing timing. **Use campaign timing** removes that override. Layers driving linked layout animations must detach those layout links first, so an independent schedule cannot silently leave dependent motion on the old clock.

Explicit linked copies are distinct from coincidentally matching presets. Pink outlines mark linked motion; dashed gold marks shared timing references. **Edit linked** changes linked copied sequences atomically in the current format. **Make independent** breaks that motion relationship; **Detach timing** separately removes beat references while preserving their current times.

## Key moments

Key moments are authored, not selected by frequency. Existing `clock.timelineBeats` lists are retained; campaigns without one start with no promoted moments. **All markers** exposes internal references. **Edit beats…** adds/renames/retimes a moment and **Show as key beat** controls its visibility. Names are labels over stable IDs, preserving references. Retiming uses the current frame arrangement across formats and validates connected layout motion. Calculated campaign beats direct the user to their source rather than accepting an ineffective write.

## Stacks

Choose **+ Stack**, then drag layer handles into its header or drop area. Both panels show the same membership. Drop relative to another layer to reorder, or into the outside drop area to remove membership. All drag changes are undoable. Collapsed stacks summarise child presence and resolved motion.

Grouping starts as organisation only. The stack’s `…` controls provide its name and opt-in shared X/Y offset and opacity. Enabled controls compose after child layout and motion; child placement remains relative to the stack. Membership must occupy consecutive layer depths before shared controls can be enabled. The exporter uses a full-canvas parent wrapper, and outline snapshots neutralise stack effects before baking so effects are applied exactly once. Moving a layer into/out of a stack adds/removes those shared controls. Reset non-default shared controls before ungrouping.

Eye and Solo controls are preview-only and never change exports. Their positions do not shift on hover. Solo restores the preceding hidden-layer set when cleared.

Existing campaign files are not migrated or rewritten by opening the editor. Independent motion and enabled stack effects are explicit authored choices. Font delivery, agency click routing and packaging contracts remain unchanged.
