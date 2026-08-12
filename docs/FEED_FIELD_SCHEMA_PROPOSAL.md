# SSE DCO — Feed field schema (agency reference)

Profile: **`SSE_DCO_Offers`** (Studio dynamic content profile for the DCO HTML5 ads).

This document lists **every creative feed field** used by the ad, with **name**, **type**, and **description**. It includes **per-size text overrides** so headlines and unit-rate copy can differ by format (line breaks, wording, etc.).

**Implementation status:** wired to Studio profile **`10964545`** / **`SSE_DCO_ROI_Delivery`**. Size-override names match the live profile (no remap). Studio `<br>` line breaks normalize to `\n` on read. `include_heading4_enum` and `background_image_label` are stored for schema parity (Act 4 timing still follows `heading4_text` / roundel frame).

**Status key**

| Status | Meaning |
|---|---|
| Current | Unchanged live field |
| Shipping (provisional) | Per-size text override — in creative now; awaiting final Studio profile names |

---

## Supported ad sizes

`160x600` · `300x250` · `300x600` · `320x50` · `728x90` · `970x250`

---

## Proposed multi-format text rule

For headlines and unit-rate text only:

1. Keep a **base** field (used by all sizes by default).
2. Optionally fill a **per-size override** field (`{base}_{size}`).
3. If the override is **blank/empty**, that size uses the **base** value.
4. If the override is **filled**, that size uses the override instead.

Line breaks (`\n`) are supported on all `multiline` fields.

**Example**

| Field | Value |
|---|---|
| `heading1_text` | `A different kind of energy` |
| `heading1_text_160x600` | `A different`<br>`kind of energy` |
| `heading1_text_320x50` | `A different kind of energy` |
| `heading1_text_300x250` | *(blank)* |

Result: 160×600 and 320×50 use their overrides; 300×250 (and any other blank override) falls back to the base.

---

## Field catalogue

### Meta

| Name | Type | Description | Status |
|---|---|---|---|
| `_id` | integer | Studio row index. | Current |
| `Unique_ID` | string | Stable row identifier for Studio / DV360. | Current |
| `Reporting_label` | string | Pipe-delimited reporting label for DV360 (e.g. offer / T&C / CTA shape). | Current |
| `Active` | boolean | Whether this row is eligible to serve in Studio. | Current |
| `Default` | boolean | Fallback row when targeting matches nothing. | Current |

---

### Headlines (base)

| Name | Type | Description | Status |
|---|---|---|---|
| `heading1_text` | multiline | Act 1 opening headline. Default for all sizes unless a size override is set. Line breaks preserved. | Current |
| `heading2_text` | multiline | Act 2 headline (shown over offer blocks). Default for all sizes unless a size override is set. Line breaks preserved. | Current |
| `heading3_text` | multiline | Act 3 headline over the offer roundel frame (when roundel frame is enabled). Also used as Act 4 display fallback when roundel frame is off and `heading4_text` is empty. Default for all sizes unless a size override is set. Line breaks preserved. | Current |
| `heading4_text` | multiline | Act 4 headline over the CTA / end frame. Default for all sizes unless a size override is set. Line breaks preserved. | Current |

---

### Headlines (per-size overrides) — proposed

Blank override → use the matching base field above.

#### Act 1

| Name | Type | Description | Status |
|---|---|---|---|
| `heading1_text_160x600` | multiline | Optional Act 1 headline override for 160×600. | Shipping (provisional) |
| `heading1_text_300x250` | multiline | Optional Act 1 headline override for 300×250. | Shipping (provisional) |
| `heading1_text_300x600` | multiline | Optional Act 1 headline override for 300×600. | Shipping (provisional) |
| `heading1_text_320x50` | multiline | Optional Act 1 headline override for 320×50. | Shipping (provisional) |
| `heading1_text_728x90` | multiline | Optional Act 1 headline override for 728×90. | Shipping (provisional) |
| `heading1_text_970x250` | multiline | Optional Act 1 headline override for 970×250. | Shipping (provisional) |

#### Act 2

| Name | Type | Description | Status |
|---|---|---|---|
| `heading2_text_160x600` | multiline | Optional Act 2 headline override for 160×600. | Shipping (provisional) |
| `heading2_text_300x250` | multiline | Optional Act 2 headline override for 300×250. | Shipping (provisional) |
| `heading2_text_300x600` | multiline | Optional Act 2 headline override for 300×600. | Shipping (provisional) |
| `heading2_text_320x50` | multiline | Optional Act 2 headline override for 320×50. | Shipping (provisional) |
| `heading2_text_728x90` | multiline | Optional Act 2 headline override for 728×90. | Shipping (provisional) |
| `heading2_text_970x250` | multiline | Optional Act 2 headline override for 970×250. | Shipping (provisional) |

#### Act 3

| Name | Type | Description | Status |
|---|---|---|---|
| `heading3_text_160x600` | multiline | Optional Act 3 headline override for 160×600. | Shipping (provisional) |
| `heading3_text_300x250` | multiline | Optional Act 3 headline override for 300×250. | Shipping (provisional) |
| `heading3_text_300x600` | multiline | Optional Act 3 headline override for 300×600. | Shipping (provisional) |
| `heading3_text_320x50` | multiline | Optional Act 3 headline override for 320×50. | Shipping (provisional) |
| `heading3_text_728x90` | multiline | Optional Act 3 headline override for 728×90. | Shipping (provisional) |
| `heading3_text_970x250` | multiline | Optional Act 3 headline override for 970×250. | Shipping (provisional) |

#### Act 4

| Name | Type | Description | Status |
|---|---|---|---|
| `heading4_text_160x600` | multiline | Optional Act 4 headline override for 160×600. | Shipping (provisional) |
| `heading4_text_300x250` | multiline | Optional Act 4 headline override for 300×250. | Shipping (provisional) |
| `heading4_text_300x600` | multiline | Optional Act 4 headline override for 300×600. | Shipping (provisional) |
| `heading4_text_320x50` | multiline | Optional Act 4 headline override for 320×50. | Shipping (provisional) |
| `heading4_text_728x90` | multiline | Optional Act 4 headline override for 728×90. | Shipping (provisional) |
| `heading4_text_970x250` | multiline | Optional Act 4 headline override for 970×250. | Shipping (provisional) |

---

### Creative state

| Name | Type | Description | Status |
|---|---|---|---|
| `offer_count_num` | integer | Number of visible offer slots (`0`–`3`). `0` = brand / no-offers variant. | Current |
| `tc_type_enum` | enum (`tcs_only` \| `tcs_units`) | Terms display mode. `tcs_only` = terms line only; `tcs_units` = terms then unit-rate line. | Current |
| `cta_type_enum` | enum (`roundel` \| `rectangle`) | CTA button shape (circle / round vs rectangle). Rectangular CTA is forced when the offer roundel frame is on. | Current |
| `include_roundel_frame_bool` | boolean | Whether the optional Act 3 offer roundel frame is shown (enables four-act timing). | Current |
| `include_heading4_enum` | boolean | Studio Heading 4 flag (named `*_enum`, served as boolean). Schema parity — not used to gate Act 4 timing yet. | Current |

---

### Offers

Offer slots above `offer_count_num` are hidden. Same copy across all sizes (no per-size overrides in this proposal).

| Name | Type | Description | Status |
|---|---|---|---|
| `offer1_value_text` | string | Primary value in offer slot 1 (e.g. `15%`, `€125`). | Current |
| `offer1_sub_text` | string | Subline in offer slot 1 (e.g. `OFF ELECTRICITY*`). | Current |
| `offer2_value_text` | string | Primary value in offer slot 2. Shown when `offer_count_num` ≥ 2. | Current |
| `offer2_sub_text` | string | Subline in offer slot 2. Shown when `offer_count_num` ≥ 2. | Current |
| `offer3_value_text` | string | Primary value in offer slot 3. Shown when `offer_count_num` ≥ 3. | Current |
| `offer3_sub_text` | string | Subline in offer slot 3. Shown when `offer_count_num` ≥ 3. | Current |

---

### Terms, CTA, roundel

| Name | Type | Description | Status |
|---|---|---|---|
| `tc_terms_text` | multiline | Terms and conditions line (shown in both T&C modes). Same across all sizes. Line breaks preserved. | Current |
| `tc_units_text` | multiline | Unit-rate / unit-price legal line. Shown when `tc_type_enum` is `tcs_units`. Default for all sizes unless a size override is set. Line breaks preserved. | Current |
| `cta_text` | string | CTA button label (e.g. `Switch today`). Same across all sizes. | Current |
| `roundel_text_text` | string | Small copy inside the optional offer roundel frame (e.g. `Save up to`). Same across all sizes. | Current |
| `roundel_value_text` | string | Large value inside the optional offer roundel frame (e.g. `€1,080`). Same across all sizes. | Current |

---

### Unit-rate text (per-size overrides) — proposed

Blank override → use `tc_units_text`.

| Name | Type | Description | Status |
|---|---|---|---|
| `tc_units_text_160x600` | multiline | Optional unit-rate text override for 160×600. | Shipping (provisional) |
| `tc_units_text_300x250` | multiline | Optional unit-rate text override for 300×250. | Shipping (provisional) |
| `tc_units_text_300x600` | multiline | Optional unit-rate text override for 300×600. | Shipping (provisional) |
| `tc_units_text_320x50` | multiline | Optional unit-rate text override for 320×50. | Shipping (provisional) |
| `tc_units_text_728x90` | multiline | Optional unit-rate text override for 728×90. | Shipping (provisional) |
| `tc_units_text_970x250` | multiline | Optional unit-rate text override for 970×250. | Shipping (provisional) |

---

### Background images (per size) — current

Already size-specific. Blank URL → packaged default art for that size.

| Name | Type | Description | Status |
|---|---|---|---|
| `background_image_label` | string | Studio label for the background set (e.g. `diy`, `hiker`). Not used for rendering. | Current |
| `background_image_url_160x600` | image (URL) | Optional full-bleed background for 160×600. | Current |
| `background_image_url_300x250` | image (URL) | Optional full-bleed background for 300×250. | Current |
| `background_image_url_300x600` | image (URL) | Optional full-bleed background for 300×600. | Current |
| `background_image_url_320x50` | image (URL) | Optional full-bleed background for 320×50. | Current |
| `background_image_url_728x90` | image (URL) | Optional full-bleed background for 728×90. | Current |
| `background_image_url_970x250` | image (URL) | Optional full-bleed background for 970×250. | Current |

---

## What is intentionally size-agnostic (this proposal)

These remain one value for all formats:

- Offer values / sublines
- `tc_terms_text`
- `cta_text`
- Roundel text / value
- Creative-state enums and booleans

Only **headlines** and **unit-rate text** gain optional per-size overrides.

---

## Type legend

| Type | Meaning |
|---|---|
| `string` | Single-line text |
| `multiline` | Text that may include line breaks (`\n`) |
| `integer` | Whole number |
| `boolean` | `true` / `false` |
| `enum` | One of a fixed set of values |
| `image (URL)` | Image URL or asset path (Studio image field) |

---

## Sidecar remap (`campaign/feed-field-map.json`)

Tracks the provisional contract and any Studio naming drift:

```json
{
  "sizeOverridableTextFields": ["heading1_text", "heading2_text", "heading3_text", "heading4_text", "tc_units_text"],
  "sizes": ["160x600", "300x250", "300x600", "320x50", "728x90", "970x250"],
  "studioToCanonical": {
    "Studio_Heading_1_160x600": "heading1_text_160x600"
  }
}
```

- Leave `studioToCanonical` empty while names match.
- When Studio renames a column, add `{ "StudioName": "canonical_name" }` only for divergences.
- Remap runs in `validateFeedRows` (editor save) and in exported HTML `normalizeProfileRow`.

## Notes for Studio / feed setup

- Leave size-override cells **blank** unless that size needs different copy.
- Base headline and unit-rate fields remain the default source of truth.
- Override columns need to exist on the Studio dynamic profile before production use.
- Studio may also carry campaign targeting / scheduling / exit-URL columns outside this creative field list; those are feed/ops metadata, not rendered ad copy.
