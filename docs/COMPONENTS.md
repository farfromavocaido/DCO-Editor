# Reusable creative components

`componentDefinitions` declares semantic design units independently of virtual `canvasGroups` used for moving selections. Definitions are campaign data; legacy SSE receives read-only compatibility definitions at runtime. Nothing is seeded into SSE JSON.

```json
{
  "componentDefinitions": [{
    "id": "component:promotion",
    "name": "Promotion badge",
    "parts": [
      {"role": "frame", "targetId": "promotion-disc"},
      {"role": "copy", "targetId": "promotion-label"}
    ],
    "frameTargetId": "promotion-disc",
    "resize": "proportional",
    "stateDimensions": ["promotionArrangement"]
  }]
}
```

Parts have stable roles. Optional `perSize[size]` overrides `parts` and `frameTargetId` where layer IDs vary by format. IDs and roles must be unique within their component. A format may omit a complete instance, which transfer can insert by cloning source layers, bindings and clips; partial instances are rejected. Insertion of nested-only targets is unsupported. Existing target identity, bindings, animation and visibility conditions remain local. Inserted instances retain source visibility within the selected destination versions; they remain hidden in unrelated versions.

`stateDimensions` names campaign variant dimension IDs whose internal arrangements travel together. Every option is copied even if the source preview currently hides that arrangement. Other dimensions remain pinned to the chosen source/destination version, preventing edits leaking into other offers. The SSE roundel includes frame, copy and value and both split/copy-only arrangements. CTA includes its single combined shape, label, padding and fitting target.

Default transfer maps source design into the destination's existing frame. `proportional` uses a uniform scale centred inside those bounds; `frame` stretches layout to the frame while retaining source typography, padding and fitting pixels. Relative units and fit ratios retain their values. Source sizing preserves source dimensions and centres within the destination placement. Ad canvas dimensions never supply an implicit scale. Explicit placement bounds use keys `size/scope` and canvas coordinates.

All source engine-effective fitting fields travel with the design. Local overrides use explicit policy resets so destination-only fitting settings cannot survive a complete component copy. Source and unrelated versions are left untouched.

## Live links

`componentLinks` stores `{id,name,componentId,source:{size,scope},destinations:[{size,scope}],sizing}`. Scopes are dot-delimited campaign conditions with component-internal state tokens removed. Initial custom placement and source-size choices are baked into destination authored bounds; saved links subsequently use destination sizing so local resizing remains effective. Subsequent source design edits refresh the whole component while destination frame movement and sizing remain local.

Links compile into local presentation overrides before the ordinary ownership compiler; stored source values are never rewritten. Unlink snapshots the effective design into independent local overrides. Copying or relinking replaces only selected destination memberships, partitioning broader memberships to preserve unrelated versions. Stored overlapping destination links, self-links and link chains/cycles are rejected. A source should be edited through the explicit source navigation; destination internal parts are controlled by the link.

## Editing and transferring

Select **Roundel** or **CTA** in Layers (or select its assembly on the canvas). The component inspector exposes its outer position/size and its parts. Enter a part to edit internal design. Moving/scaling the whole component updates every internal arrangement, including hidden ones.

**Copy appearance** opens the visual tray across sizes. A component transfer always includes all parts and fitting. Choose **Fit destination component area** to retain the destination placement/size, or **Keep source size** to centre the original-sized design there. Switch the layout preview between text-only and text-plus-number; both are included regardless of which is shown. In **Compare larger**, move/resize the outlined After component or use its X/Y/Width/Height fields before applying. CTA frame resizing retains source type and padding; roundels stay proportional.

**Link instead** keeps internal design live from the source while placement remains local. Destination part editing directs you to **Edit source** or **Unlink — keep appearance**. The latter freezes the current resolved design. Components are currently declared by campaign metadata (with an SSE compatibility catalog), not automatically inferred from arbitrary canvas groups.

Verification: `scripts/verify-component-transfer.ts <origin>` exercises MPU → Double MPU through the real editor with in-memory persistence. `scripts/verify-component-baseline.ts <origin> <archive-directory>` compares archived SSE HTML with the current renderer across all sizes, offer counts and timeline samples. Neither script writes campaign files.

Verified implementation: 542 engine/API tests and 32 creative checks pass; production build and strict build TypeScript pass. Browser workflow covers MPU→Double MPU whole roundel, both arrangements, destination/source sizing, placement drag/resize, live design propagation, all-arrangement movement, unlink, CTA transfer, and linked editor/export comparison. 144 comparisons against archived SSE HTML preserve geometry, fitting and visibility across six sizes/four offer counts. All 34 original campaign files match the pre-change archive. Snapshot before component work: `snapshot/before-components-20260916`.

The preview toolbar shows a component breadcrumb with a direct part picker and a parent/exit action. Component internal layouts are selectable there too. For SSE roundels, Text only clears the active sample row's roundel value; Text + number restores the value remembered during that editing session. If none exists, the control asks for an actual value rather than inventing copy. These are real sample-feed changes, saved through Save sample values; exports receive the same effective feed row. Delivered dynamic ads still choose the arrangement from their served feed data. Breadcrumb controls are editor-only navigation and never enter ad HTML.
