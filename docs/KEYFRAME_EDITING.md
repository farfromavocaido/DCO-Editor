# Editing motion in the timeline

The default **Transitions** view shows changing spans as ranges (Move, Fade in, Fade out, Resize), over a light grey presence strip. The strip remains through holds and disappears when the production element is transparent, hidden or entirely outside the canvas. Presence is sampled from the settled production DOM at 20 ms intervals in short batches; it is not an alternative animation renderer. Click a range for **Starts at**, **Duration**, **From / To** and **Easing**. Drag its body to move it or its endpoints to change its interval. Edits use the existing keyframes and refuse to cross neighbouring frames. Adjacent transitions share their boundary keyframe; editing that value also changes the adjoining transition's endpoint. Use **Keyframes** for detailed or complex sequences.

The sticky scrub ruler has second and 5% ticks, with five-second and quarter-ad labels emphasised. Minor labels hide on narrow tracks. **Beats** shows key moments; **All markers** reveals internal timing references. For older campaigns without a curated list, the editor suggests up to six spaced, commonly referenced beats without changing the document. Hover a marker for names and anchored layers; click to inspect timing and references. Overlapping markers stack. **Edit beats…** renames, adds or retimes a beat; **Show as key beat** authors the visible list. Retiming changes the current frame arrangement across formats and validates connected layout motion. Names are display labels over stable IDs, preserving all animation and layout references. New beats are campaign-wide timing references and appear in the keyframe **Timing reference** picker. Save the campaign to retain beat edits; Undo restores them.

**Animation sequence** selects one clip on the layer, which may contain several transitions. Its overall start and duration apply to the whole sequence. **Sequence settings & sharing** includes its editable name. Offset X/Y are movement from layout position; their **Units** selector controls pixels/ad%/parent%. Unanimated absolute layout fields show **Use layout**, not a fabricated zero. The final keyframe has no outgoing easing control.

Click a timeline diamond to select its keyframe. The Motion section opens and shows that frame's time, offsets, opacity, scale and easing together. Clips which animate absolute layout also expose X/Y/width/height. Use the keyframe buttons in the inspector to jump between frames.

- Drag a diamond to retime it between its neighbours. Its marker previews the new time during the drag; releasing commits one undoable change. Arrow keys nudge its time; Shift uses a larger nudge.
- Drag the body of an animation bar to move the whole animation. Drag its edge to resize its interval.
- Edit **Animation starts** or **Animation duration** in seconds. Custom clip retiming preserves its internal time proportions. Moving the start preserves its duration and refuses to extend beyond the ad.
- Numeric fields commit on blur or Enter, so partial typing is not treated as a complete value.
- **+ Keyframe here** samples the animation at the playhead. **Remove keyframe** (or Delete on a focused diamond) removes that frame, retaining at least start/end frames.
- **Offset X/Y** are movement relative to the layer's layout position. **Layout position and size** contains absolute layout channels. Relative offsets can be pixels, percent of the ad or percent of the parent.
- **Timing reference** exposes a named beat or percentage for advanced timing. Changing a frame's seconds detaches that frame from its beat; it does not change the shared beat itself.

Presets stay authored as presets until a keyframe is actually edited. Editing converts only that clip into equivalent custom keyframes; opening/selecting it does not change data. Preset timing/distance controls remain under **Preset settings & sharing**. Add-animation presets are collapsed so editing existing motion is the primary interface.

Clips with version-specific indexed geometry offsets keep those offsets. Their keyframe values are labelled as authored values with offsets applied by the renderer. Insertion/deletion is disabled for those clips rather than silently invalidating index-based overrides.

The scrubber, ruler, rows and full-height playhead use the same horizontal grid inside the timeline scroll area. Multiple independently selected items align to each other's selection bounds; a selected component/group remains a unit when aligned to the canvas/parent. Relative alignment creates local position edits and leaves other elements unchanged.

These changes are editor-only. The compiler, delivered runtime, agency click routing and export format are unchanged. Existing campaign JSON is not rewritten by opening the editor.

## Timeline organisation and relationships

Shift/⌘ click layer names and choose **Group…** to create a saved timeline folder. Folders organise rows without reparenting DOM elements, changing coordinates or linking motion. Existing canvas groups also appear as collapsible groups. Collapsed rows summarise child presence and motion. Ungroup retains all child data. Eye and **S** (solo) controls are preview-only; solo restores the previous hidden set when cleared.

Selecting a transition outlines explicitly linked copied sequences in pink and shared timing references in dashed gold. Similar presets alone are not links. **Edit linked** applies edited keyframe channels to explicit linked copies in the current format, preserving identities, other channels and timing offsets. It commits atomically and is undoable. Incompatible keyframe counts or invalid timing refuse the whole edit. **Make independent** removes that sequence from the motion relationship. **Detach timing** separately freezes its current beat references, without moving other sequences. A sequence shared across versions keeps those fixed times in each version.
