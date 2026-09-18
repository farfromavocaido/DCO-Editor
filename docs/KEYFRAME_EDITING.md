# Editing motion in the timeline

The default **Transitions** view shows changing spans as ranges (Move, Fade in, Fade out, Resize), leaving holds quiet. Click a range for **Starts at**, **Duration**, **From / To** and **Easing**. Drag its body to move it or its endpoints to change its interval. Edits use the existing keyframes and refuse to cross neighbouring frames. Adjacent transitions share their boundary keyframe; editing that value also changes the adjoining transition's endpoint. Use **Keyframes** for detailed or complex sequences.

The sticky scrub ruler has second and 5% ticks, with five-second and quarter-ad labels emphasised. Minor labels hide on narrow tracks. **Beats** shows/hides timing markers; click a marker to seek. **Edit beats…** renames a beat or adds one at a chosen time (initially the playhead). Names are display labels over stable IDs, preserving all animation and layout references. New beats are campaign-wide timing references and appear in the keyframe **Timing reference** picker. Save the campaign to retain beat edits; Undo restores them.

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
