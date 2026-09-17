# Campaign fonts, states and responsive layout

These controls are opt-in authored data. Opening, validating or saving a campaign does not create rules or migrate its artwork.

## Arrange selected items in an area

Select two or more elements, open **Layout rules → Arrange selected items**, or use **right-click → Arrange → Responsive layout**.

- Choose vertical or horizontal distribution, alignment and the item order. Alignment uses Left/Centre/Right or Top/Centre/Bottom; Keep existing positions is also available.
- Changes preview live before Apply. Drag the purple area label to move its boundary; drag its corner to resize it. Exact coordinates are available under Layout area.
- Choose where one remaining item sits; the default is the centre.
- Empty text and state-hidden artwork are left out. Text glyphs and image alpha supply the ink bounds.
- The area retains its dimensions when items disappear. Animation opacity does not change layout.
- Minimum spacing and behaviour when there is insufficient room are under Spacing limits & name. The default restores original positions and reports the problem; extending beyond the area is an explicit alternative.
- New areas default to the current campaign version. “All versions in this size” is an explicit choice. Existing version limits remain intact when editing from a different version.

Select an individual member to see its controlling area. **Detach selected** keeps its current position while freeing it from the layout. **Disable** or **Remove layout** reveals the underlying authored arrangement.

When entering layout editing, the timeline seeks a useful visible frame. If selected items never appear together, “Different animation times” explains that limitation rather than pretending their animations overlap.

## Conditional placements

Select an element, choose **Conditional placement**, and select what it responds to:

- Another element has text or is empty. Whitespace-only text is empty.
- Another element is shown or hidden. This checks visible artwork independently of an animation fade.
- Its fitted line count is equal to, above or below a threshold.
- Its rendered ink height exceeds a threshold.
- Existing campaign choices remain available as a separate condition source or version restriction.

Define placement A and its Otherwise placement B. Blank fields retain the original values. “Use current position” captures X/Y; “Preview & place on canvas” provides a draggable placement handle without committing those changes. Text-presence previews use temporary populated/empty copy. Other condition previews show the chosen placement; use real sample text to verify fitted-line thresholds.

The published rule reports its measured content/line count and active placement. Cyclic measurement dependencies and conflicting property owners are rejected. A condition cannot resize its own text based on the line count produced by that resize.

## Test copy without changing the campaign

**Try different content** previews arbitrary sample text or empty copy through the production renderer. **Restore actual copy** leaves the campaign and feed untouched. End these temporary previews before exporting; exports never silently capture test copy or draft placements.

## Keep a gap

The separate **Keep a gap** tool positions one element relative to another visible edge or canvas edge. It retains pixels, text-size multiples and percentages of the ad dimension. Choose an explicit fallback if the reference is absent. This is distinct from distributing several items inside an area.

## Rendering contract

Campaign-state conditions enter normal CSS resolution. Element conditions evaluate actual content and fitted browser measurements; changes to frame dimensions trigger fitting again before dependent conditions and distribution. Editor, QA and dynamic HTML share this production runtime. Fixed-copy outlines capture its resolved positions and dimensions, including backgrounds and legal wrappers. Rulers, editable boundaries and temporary text previews are editor-only controls.

Cross-origin images used for ink measurements request anonymous CORS. Same-origin, embedded or CORS-enabled image files are required for readable transparency. Measurement errors are shown rather than substituting a frame for actual ink.

## Fonts and campaign states

Fonts registers local OTF, TTF or WOFF faces and corresponding CDN URLs. Local files supply preview and outlines; CDN delivery verifies identical bytes before packaging. Internal metadata supplies defaults without overriding authored CSS mappings. WOFF2 outlining is not supported. Documents without a registry retain the existing Museo mapping.

Campaign states controls labels, choices, defaults, header visibility, availability and valid combinations. Generic campaigns support arbitrary and derived dimensions. SSE retains its established serving mappings. Removing states still referenced by artwork or feed data is rejected.

## Exit-linked layout motion

Edit an area and expand **Animate layout after an exit**. Choose the item leaving, its animation and the specific exit segment. The remaining items move to their fitted arrangement without that item. Timing can follow the exit or start after it, with either the exit duration or a custom duration.

Space is reserved before entrances. Animation opacity alone does not change membership. An initially empty or state-hidden subject produces no layout animation. Distances come from the two resolved ink layouts, rather than a stored pixel move.

Choose **Animate back before the end**, or **Reset while remaining items are hidden**. Hidden resets are validated against the remaining items’ animation opacity through the reset interval. Looping ads require a return; a one-shot ad may stay in the new arrangement. Disabling the link retains its settings.

The linked motion is a native timeline animation on a separate translation channel, so it composes with existing opacity/transform animation. Scrubbing, playback and looping use that same animation. Fixed-copy snapshots retain the measured motion plan and outlined exports replay it without remeasuring SVG text.

## Position ownership and text anchors

Absolute geometry in a motion path is shown as animation-controlled in the inspector. Position fields display the sampled animated values. **Move whole path · this version** shifts all its position keyframes for the current version; **Edit selected position keyframe** requires an existing geometry keyframe at the playhead. The original path and other versions are retained. Canvas dragging uses the same ownership path.

**Pin text** fixes a visible top edge, centre or bottom edge. A bottom pin exposes an inset from the ad’s bottom. Changing max lines, wrapping or frame policy on existing bottom-aligned text captures its current ink bottom first, preserving the approved placement while the box changes. Loading a campaign does not seed anchors. Height controlled by fitting is labelled rather than presented as an independently editable dimension.

Text fields retain native undo/redo while focused. Enter (ordinary inputs) or leaving the field commits one editor-history transaction. Canvas undo can then undo that completed field edit. Preview-only inputs do not create campaign history.
