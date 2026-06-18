# Optional Roundel Frame Design

## Summary

The SSE DCO editor will support an optional extra frame between the current Act 2 and Act 3 for MPU first, using feed-driven fields. When the optional roundel frame is disabled, the creative remains a three-act ad with the current timings unchanged. When enabled, the creative becomes a four-act ad: Act 1, Act 2, Heading 3 with an offer roundel, then the CTA endframe with Heading 3 retained.

The primary implementation focus is the editor data model, preview, timeline editing, and Studio-ready export path. The broader client preview page mechanism can be adjusted after the MPU behaviour is proven.

## Goals

- Add feed fields for enabling the optional roundel frame and controlling its copy.
- Keep existing three-act timings intact when the optional frame is not enabled.
- Add a four-act timing profile only for rows where the optional frame is enabled.
- Allow MPU positioning and text fitting for the new roundel frame without disturbing existing headline, offer, terms, or CTA positioning.
- Introduce property branching in a structured way so active variant scopes can be edited without accidental writes to unrelated states.
- Keep the first implementation scoped to `300x250` while leaving the model ready for later sizes.

## Non-Goals

- Do not redesign all size formats in this pass.
- Do not change the client preview page workflow beyond what is needed for exported MPU HTML to receive and render the new fields.
- Do not replace the existing layer/timeline editor with a new animation system.
- Do not change current three-act timing or layout for rows where `include_roundel_frame_bool` is false.

## Feed Fields

Add these fields to the Studio profile metadata, sample rows, editor sample form, exported mapping, runtime normalization, and preview validation:

| Field | Type | Group | Meaning |
|---|---|---|---|
| `include_roundel_frame_bool` | boolean | Creative State | Enables the optional roundel frame and selects the four-act timing profile. |
| `roundel_text_text` | string | Copy | Roundel text copy. In split mode this is the smaller upper line. In copy-only mode this can occupy up to three lines. |
| `roundel_value_text` | string | Copy | Optional larger value copy, such as `€1,080`. Empty means copy-only mode. |

Boolean coercion must accept booleans and common string values from feed/sample editing. The editor sample form should render boolean fields as checkboxes, not text inputs.

## Active State Scopes

The editor already derives active scopes from feed state for offer count, terms mode, and CTA shape. Extend that pattern with frame and roundel content scopes:

| Condition | Scope |
|---|---|
| `include_roundel_frame_bool` is false | `frames-3`, `roundel-frame-off` |
| `include_roundel_frame_bool` is true | `frames-4`, `roundel-frame-on` |
| roundel enabled and `roundel_value_text` is empty | `roundel-copy-only` |
| roundel enabled and `roundel_value_text` has text | `roundel-split` |

The active scope list should be deterministic:

1. `offers-N`
2. `tc-solo` or `tc-prices`
3. `cta-roundel` or `cta-rect`
4. `frames-3` or `frames-4`
5. `roundel-frame-off` or `roundel-frame-on`
6. `roundel-copy-only` or `roundel-split`

## Variant Rule Resolution

Current variant resolution effectively picks the first matching non-visibility rule for a target. That is too fragile once frame-count and roundel-content scopes are introduced.

Change target resolution so it merges all active, matching variant rules in deterministic active-scope order:

1. Start with layer base values or shared class rule values.
2. Apply matching variant rule props in active-scope order.
3. Ignore visibility-only rules when deciding editable write targets, but still apply them in CSS and runtime output.
4. For editing, write to the highest-priority existing active variant rule for that target. If no active variant rule exists, keep the current shared/base write behaviour unless the UI is explicitly editing a scoped override.

The inspector should show which active rules contribute to the selected layer and label the active write source clearly. For this feature, it is acceptable for new frame-specific MPU rules to be pre-created in the document so dragging the roundel or frame-specific headline position writes to `frames-4` or a roundel-specific scope rather than the shared base.

## Timing Profiles

The creative duration remains 15 seconds. The existing `clock.beats` values represent the current three-act profile and must continue to serve rows where `include_roundel_frame_bool` is false.

Add a timing-profile model that lets preview/export resolve clip references against the active profile:

```json
{
  "clock": {
    "durationS": 15,
    "beats": { "...": "existing three-act beats" },
    "profiles": {
      "frames-3": { "...": "same as existing beats" },
      "frames-4": { "...": "four-act beats" }
    }
  }
}
```

If `clock.profiles.frames-3` is absent, the fallback is `clock.beats` for backward compatibility.

Initial MPU four-act beat targets:

| Beat | Percent | Seconds | Purpose |
|---|---:|---:|---|
| `start` | 0 | 0.00 | Start of ad. |
| `act1_begin` | 6 | 0.90 | Background/wave/logo entry begins earlier than current profile. |
| `act1_in` | 8 | 1.20 | Act 1 content enters. |
| `offer2_in` | 11 | 1.65 | Offer 2 enters for multi-offer rows. |
| `offer3_in` | 14 | 2.10 | Offer 3 enters for multi-offer rows. |
| `plus1_in` | 16 | 2.40 | First plus enters. |
| `plus2_in` | 19 | 2.85 | Second plus enters. |
| `terms_in` | 16 | 2.40 | Terms enter. |
| `act2_in` | 33.3 | 5.00 | Act 2 heading enters. |
| `act1_out` | 34.3 | 5.15 | Act 1 heading/price terms exit. |
| `wave2_in` | 54.7 | 8.20 | Endframe wave begins before the roundel frame. |
| `swap` | 56.7 | 8.50 | Heading 3 and optional roundel frame enter. |
| `roundel_in` | 56.7 | 8.50 | Alias for roundel frame entry. |
| `offers_exit` | 57.7 | 8.65 | Offer block exits. |
| `cta_in` | 80 | 12.00 | CTA endframe begins while Heading 3 stays visible. |
| `cta_pulse_start` | 91 | 13.65 | CTA pulse begins. |
| `cta_pulse_peak` | 93 | 13.95 | CTA pulse peak. |
| `cta_pulse_end` | 94 | 14.10 | CTA pulse settles. |
| `act3_exit` | 96 | 14.40 | Heading 3 and CTA fade out. |
| `end` | 100 | 15.00 | End of ad. |

The editor timeline should expose the active act-count profile. When a row is in `frames-3`, timing edits affect the three-act profile. When a row is in `frames-4`, timing edits affect the four-act profile. Clip-level edits can continue to work, but coordinated act timing should write beats/profile values instead of requiring manual edits across every affected layer.

## MPU Layer Design

Add MPU-only layers and class rules:

- `roundel-frame`: shape/group layer representing the roundel circle.
- `roundel-copy`: nested text target inside the roundel.
- `roundel-value`: nested text target inside the roundel.

The roundel should be hidden in `roundel-frame-off` and visible in `roundel-frame-on`.

The roundel text layout has two modes:

### Split Mode

Condition: `include_roundel_frame_bool` is true and `roundel_value_text` has text.

- `roundel-copy` binds to `roundel_text_text`.
- `roundel-value` binds to `roundel_value_text`.
- `roundel-copy` fits to one line.
- `roundel-value` occupies the larger lower slot and fits to one line.

Example:

```text
Save up to
€1,080
```

### Copy-Only Mode

Condition: `include_roundel_frame_bool` is true and `roundel_value_text` is empty.

- `roundel-copy` binds to `roundel_text_text`.
- `roundel-value` is hidden.
- `roundel-copy` expands to occupy the full usable text region.
- `roundel-copy` fits up to three lines.

Example:

```text
Last chance
to make
savings
```

## Preview and Export Rendering

The editor preview and exported HTML must bind these dynamic fields:

- `roundel_text_text`
- `roundel_value_text`

The exported runtime state must:

1. Normalize the new fields.
2. Add/remove frame state classes:
   - `frames-3`
   - `frames-4`
   - `roundel-frame-on`
   - `roundel-frame-off`
   - `roundel-split`
   - `roundel-copy-only`
3. Bind roundel text.
4. Re-run text fitting after binding.

The exported HTML must include scoped animation CSS so the same creative file can render either three-act or four-act rows:

```css
.frames-3 .headline-act3 {
  animation-name: headline-act3-frames-3;
}

.frames-4 .headline-act3 {
  animation-name: headline-act3-frames-4;
}
```

Existing unscoped animation output can remain as a fallback while the active scoped rules override it.

## Editor UX

The top-level toolbar can remain focused on offer count, terms, and CTA shape for the first pass. The sample inspector must expose the new frame fields in the existing Sample section:

- `include_roundel_frame_bool` as a checkbox.
- `roundel_text_text` as a text input.
- `roundel_value_text` as a text input.

When `include_roundel_frame_bool` is toggled, the editor preview should immediately update active scopes and timing profile. The timeline readout should make it clear whether the active timing profile is `3 acts` or `4 acts`.

When editing roundel positions in MPU, the active scoped overrides should prevent accidental changes to shared positions used by non-roundel rows.

## Testing

Add or update automated tests for:

- Feed metadata includes the three new fields.
- Feed validation coerces `include_roundel_frame_bool` correctly.
- Feed model derives `frames-3` and `frames-4` controls/scopes from selected rows.
- Variant target resolution merges multiple matching active scopes in order.
- Updating a pre-created frame-specific variant writes to that variant, not the base layer.
- Preview/export runtime includes the new state classes and dynamic field bindings.
- Exported MPU HTML includes roundel elements and scoped animation rules for the four-act profile.
- Rows without the roundel frame continue to use the existing three-act timing profile.

Run `npm test` after implementation. Because this affects rendered timing and layout, visually inspect the MPU in the editor at minimum at these playhead positions:

- 0.0s
- 5.0s
- 8.5s
- 12.0s
- 15.0s

## Rollout

1. Implement and validate the editor/model/export support for MPU.
2. Confirm MPU roundel positioning and timing with real copy.
3. Only after MPU approval, adapt the pattern to other formats.
