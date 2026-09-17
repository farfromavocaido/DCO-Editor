# Campaign fonts, states and layout rules

These controls are opt-in authored data. Opening, validating or saving a campaign does not create rules or migrate its artwork.

## Fonts

The sidebar Fonts panel registers local OTF, TTF or WOFF faces and their CDN URLs. The local file supplies editor text and fixed-copy outlines. CDN delivery verifies that its hosted file has identical bytes before packaging. Upload metadata supplies defaults; authored CSS family/weight/style mappings remain configurable. Existing documents without a registry retain their existing Museo mapping. WOFF2 is not yet supported by the outliner.

## Campaign states

The sidebar Campaign states panel configures labels, choices, defaults, header visibility, availability and valid combinations. Generic campaigns can add dimensions and derive a value from other fields (first matching rule wins). Conditions combine with AND. Derived dependencies are resolved before scopes and text bindings, in the editor and dynamic runtime.

SSE retains its existing serving adapter: labels, defaults, visibility and availability are editable; its field mappings and derived equations remain intact. New campaigns use the declarative variant model. Removing a state referenced by artwork or feed data is rejected rather than silently stripping its styling.

## Layout rules

Select an element, then expand Layout rules in the inspector:

- **Conditional placement** supplies explicit geometry, alignment or visibility while chosen campaign states match. Blank fields retain their authored values.
- **Responsive spacing** keeps an element's ink edge a signed distance from another element's ink edge, or a canvas edge. This works for arbitrary concrete elements, including nested offer text. It does not require a predefined footer, logo or roundel component.

Pixels are absolute. `em` follows the target's computed font size. Percentages follow the canvas width for horizontal spacing, or height for vertical spacing. Fallback gaps use the same units. Text ink is measured after wrapping/fitting; bitmap and SVG image transparency is excluded. Cross-origin images need readable pixel data (same-origin, embedded, or CORS-enabled). Measurement failures appear on the rule; they do not silently substitute the image frame for its ink.

The designer chooses what happens when reference ink is absent: retain the authored placement or use a specified canvas edge. A feed/state-hidden element is absent; an animation fade does not change layout. Layout is measured in its resting state before animation.

An active rule owns its affected position fields. Their source badge opens the rule. Disabled rules and enabled-but-inactive conditions are distinguishable. Only the selected spacing rule displays an on-canvas ruler; drag its gap or use arrow keys (Shift: 10 px).

Copy creates an independent rule. Link adds an element/format to the same rule. Unlink retains a local rule. Freeze records the active measured position as an authored value and removes this element's membership. Disabling/deleting a rule reveals the underlying authored placement. Conflicting property owners and circular references are rejected.

## Rendering contract

Conditional values enter the normal CSS/fit resolution. The shared production runtime then fits text, performs existing offer layout, and applies ink spacing. Editor and QA use that renderer. Dynamic files include the same rule evaluator and recompute after feed changes. Fixed-copy outlines use current browser snapshots, including arbitrary element positions and the effective font face. The editor's rulers and controls never enter delivered artwork.

Existing campaigns with no rules keep their existing layout path. Creative approval checks remain separate from engine correctness tests.
