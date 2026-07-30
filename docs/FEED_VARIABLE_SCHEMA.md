# Feed variable schema

Reference for every dynamic field in the SSE DCO feed profile (`SSE_DCO_Offers`). Source of truth for field definitions: `src/server/feed-schema.ts` (`FEED_SCHEMA_FIELDS`). Embedded copy lives in `campaign/sse-dco-creative.json` under `feed.fields` and `feed.sampleRows`.

> **Campaign-specific vs generic.** The field *names* and *copy* below (offers, T&Cs, roundel) belong to the SSE campaign and are illustrative. The *mechanism* — how the field list is composed, how values are coerced, and how runtime scopes are derived — is generic and is what carries over to other campaigns. See [How the schema is composed](#how-the-schema-is-composed) for the reusable parts.

## How the schema is composed

`FEED_SCHEMA_FIELDS` in `feed-schema.ts` is a single array built from two sources:

1. **Static field definitions** — the literal entries (`heading1_text`, `offer1_value_text`, …).
2. **Generated field definitions** — entries spread in from helpers, currently `...backgroundImageFieldDefinitions()` from `src/lib/feed-background.ts`, which emits one field per canonical ad size.

Each field definition is `{ name, label, type, group, description, ...constraints }`. `type` drives coercion (see [Cross-cutting coercion](#cross-cutting-coercion)); `group` drives inspector grouping; `min`/`max`/`options` are per-type constraints. To add a campaign field, add a definition to the static list (or to a generator) — every consumer (validation, inspector, export) reads the same array, so no other wiring is required.

`CREATIVE_AD_SIZES` (in `feed-background.ts`) is the canonical size list (`160x600`, `300x250`, `300x600`, `320x50`, `728x90`, `970x250`). Generators that need to vary by size key off it.

## Profile

| Property | Value |
|---|---|
| Profile name | `SSE_DCO_Offers` |
| Row storage | `campaign/sse-dco-creative.json` → `feed.sampleRows[]` |
| Save validation | `validateFeedRows()` coerces every field on write |
| Studio handoff | Exported HTML reads rows from `window.dynamicContent` at serve time |

## Required vs optional

| Meaning | Behaviour |
|---|---|
| **Required for save** | All schema fields are always written back with coerced values. Missing keys are filled in during `validateFeedRows()`. The field count is whatever `FEED_SCHEMA_FIELDS` resolves to — currently 24 static fields plus 6 generated per-size background fields = **30**. |
| **Optional content** | Most copy/asset fields accept an empty string. Empty values hide or skip layers depending on runtime scope (see per-field notes). |
| **Studio-only meta** | `_id`, `Unique_ID`, `Reporting_label`, `Active`, `Default` are for DV360/Studio row management. They are not read by exported ad runtime JavaScript. |

## Cross-cutting coercion

Applied in `validateFeedRows()` (`feed-schema.ts`) unless noted.

| Type | Coercion | Invalid input |
|---|---|---|
| `string` | `String(value ?? '')` | Never throws |
| `multiline` | Same as string; `\n` preserved in storage | Never throws |
| `image` | Same as string (URL or asset path) | Never throws |
| `integer` | Parsed with `parseInt`; clamped to `min`/`max` when set | Out-of-range values clamp (no error) |
| `boolean` | `true` if boolean `true`, or string `"true"` (case-insensitive); otherwise `Boolean(value)` | Never throws |
| `enum` | Must match `options`; legacy aliases noted per field | Throws `must be one of …` |

**`_id` default:** If omitted from input, set to the row’s zero-based index.

**Editor UI coercion** (`feed-model.ts`) uses slightly looser boolean parsing (`yes`, `on`, `1`, etc.) and can auto-set `cta_type_enum` when `include_roundel_frame_bool` becomes `true`.

## Runtime defaults (export / preview)

When a field is missing or empty at render time, behaviour depends on context:

| Context | Defaults |
|---|---|
| **Production export** | `firstDynamicRow()` uses `window.dynamicContent`; empty/missing keys become `''` via `normalizeProfileRow()`. No hard-coded copy defaults in production HTML. |
| **Client preview / WIP** | `clientInitialRow()` seeds demo copy, then merges `feed.sampleRows[0]`. Key literals: H1–H4 energy / best plan / switch and save / energy; offers `15%` / `30%` / `€125`; `roundel_text_text` → `'Save up to'`, `roundel_value_text` → `'€1,080'`, `include_roundel_frame_bool` → `true`, `offer_count_num` → `1`, `cta_type_enum` → `'roundel'`, `cta_text` → `'Switch today'`, `tc_type_enum` → `'tcs_units'`. |
| **Variant row matching** | `rowForClientVariant()` merges sample rows by offer count / T&C / CTA shape, with the same string fallbacks as client preview for CTA, T&C, roundel, and background fields. |
| **Background image** | Empty per-size `background_image_url_{size}` → packaged size background from creative JSON (`previewBackgroundSrc()` / no `applyBackgroundImage()` call). |
| **Offer count at runtime** | `deriveOfferCount()`: uses `offer_count_num` if 1–3; else counts non-empty `offerN_value_text`; minimum `1`. |
| **T&C mode at runtime** | Any value other than `tcs_units` → `tc-solo` scope (terms-only). |
| **CTA shape at runtime** | `rectangle` or legacy `rect`, or `include_roundel_frame_bool` → `cta-rect`; otherwise `cta-roundel`. |
| **Headline 4 display** | When offer roundel frame is off and `heading4_text` is empty/whitespace → display `heading3_text` instead (`headlineAct4DisplayText()`). |
| **Roundel layout** | When roundel frame is on and `roundel_value_text` is non-empty → `roundel-split`; otherwise `roundel-copy-only`. |

## Client preview persistence

The downloadable client ZIP `preview-page.html` stores selected ad size, control values (including per-size backgrounds), and zoom under `localStorage` key `sse-dco-client-preview:{exportSlug}` so a refresh keeps the working session. **Restore defaults** removes that key and re-applies the baked-in `clientInitialRow()` sample values. (GitHub Pages root hosts the Canonical Agency Zip viewer instead — no live feed form.)

## Copy validation (client preview only)

Optional overflow checks run in the client preview package (toggle in localStorage). They apply to visible DOM targets per size, not at feed save time.

| Check | Severity |
|---|---|
| Text wider than box (`scrollWidth`) | Error |
| Text taller than box (except T&C / unit-rate legal copy) | Error |
| Text renders outside box bounds | Error |
| Word breaks mid-word across lines | Error |
| Browser scaled font below declared size by >25% | Error |
| Browser scaled font below declared size by ≤25% | Warning |

Validated fields: all headline, offer, CTA, roundel, and T&C copy fields listed in the Copy section below. Meta and creative-state fields are not validated for overflow.

---

## Field reference

### Meta

#### `_id`

| | |
|---|---|
| **Type** | `integer` |
| **Description** | Studio row index. |
| **Validation** | Parsed as integer. No min/max. |
| **Required** | Optional on input; defaults to row index if omitted. |
| **Fallback** | Row position in `sampleRows` array (0-based). |

#### `Unique_ID`

| | |
|---|---|
| **Type** | `string` |
| **Description** | Stable row identifier for Studio/DV360. |
| **Validation** | Any string. |
| **Required** | Optional (empty allowed). Recommended for production feeds. |
| **Fallback** | `''`. Editor list label falls back to `Row N`. |

#### `Reporting_label`

| | |
|---|---|
| **Type** | `string` |
| **Description** | Pipe-delimited reporting label for DV360 (e.g. `1offer\|15pc_electricity\|tc_solo\|cta_roundel`). |
| **Validation** | Any string. |
| **Required** | Optional. |
| **Fallback** | `''`. Not used by ad runtime. |

#### `Active`

| | |
|---|---|
| **Type** | `boolean` |
| **Description** | Whether this row is eligible to serve in Studio. |
| **Validation** | Coerced boolean (see cross-cutting rules). |
| **Required** | Optional. |
| **Fallback** | `false` if missing or non-`"true"` string. Not read by exported ad JS. |

#### `Default`

| | |
|---|---|
| **Type** | `boolean` |
| **Description** | Fallback row when targeting matches nothing. |
| **Validation** | Coerced boolean. |
| **Required** | Optional. |
| **Fallback** | `false` if missing. Not read by exported ad JS. |

---

### Copy — headlines

#### `heading1_text`

| | |
|---|---|
| **Type** | `multiline` |
| **Description** | Act 1 headline copy; line breaks are preserved when the layer wraps. |
| **Validation** | Any string. |
| **Required** | Optional (empty allowed). |
| **Fallback** | `''`. Layer may still animate with empty text. Client preview default: `'A different kind of energy'`. |
| **Copy validation** | `#headline-act1` when visible. |

#### `heading2_text`

| | |
|---|---|
| **Type** | `multiline` |
| **Description** | Act 2 headline copy (over offer blocks); line breaks are preserved when the layer wraps. |
| **Validation** | Any string. |
| **Required** | Optional. |
| **Fallback** | `''`. Client preview default: `'Our very best electricity plan'`. |
| **Copy validation** | `#headline-act2` when visible. |

#### `heading3_text`

| | |
|---|---|
| **Type** | `multiline` |
| **Description** | Act 3 headline copy over the offer roundel (when roundel frame is enabled); line breaks are preserved when the layer wraps. |
| **Validation** | Any string. |
| **Required** | Optional. |
| **Fallback** | `''`. Also used as **display fallback for heading 4** when roundel frame is off and `heading4_text` is empty. Client preview default: `'A different kind of energy'`. |
| **Copy validation** | `#headline-act3` when visible (frames-4 / roundel on). |

#### `heading4_text`

| | |
|---|---|
| **Type** | `multiline` |
| **Description** | Act 4 headline copy over the CTA/end frame; line breaks are preserved when the layer wraps. |
| **Validation** | Any string. |
| **Required** | Optional. |
| **Fallback** | When roundel frame is **off** and this field is empty → runtime shows `heading3_text`. When roundel frame is **on** → empty stays empty. Client preview default: `'Switch and save today'`. |
| **Copy validation** | `#headline-act4` when visible. |

---

### Creative state

#### `offer_count_num`

| | |
|---|---|
| **Type** | `integer` |
| **Description** | Number of visible offer slots (`0`–`3`). `0` is the brand / no-offers variant (SSE DCO only in the editor). |
| **Validation** | Integer clamped to **min 0, max 3**. Non-numeric → `1`. Values above 3 clamp to 3; values below 0 clamp to 0. Explicit `0` is preserved. |
| **Required** | Optional on input; always coerced to 0–3 (invalid → `1`). |
| **Fallback** | `1` if missing/invalid. Runtime also derives count from non-empty `offerN_value_text` if explicit count is outside 0–3. Controls `offers-0` / `offers-1` / `offers-2` / `offers-3` CSS scope. Under `offers-0`: all offer slots hidden, green wave hidden, blue wave enters at start with white logo only, T&Cs forced off, white headlines, and blank headline acts share screentime evenly before CTA. |

#### `tc_type_enum`

| | |
|---|---|
| **Type** | `enum` |
| **Description** | Terms display mode. |
| **Validation** | Must be one of: **`tcs_only`**, **`tcs_units`**. Legacy input aliases (normalized on save): `solo` → `tcs_only`, `prices` → `tcs_units`. |
| **Required** | Optional on input; invalid values throw on save. |
| **Fallback** | Runtime: anything other than `tcs_units` → **`tc-solo`** scope (terms line only). `tcs_units` → **`tc-prices`** scope (terms exit before unit-rate line appears). Client preview default: `tcs_only`. |

#### `cta_type_enum`

| | |
|---|---|
| **Type** | `enum` |
| **Description** | CTA button shape (circle or rectangle). |
| **Validation** | Must be one of: **`roundel`**, **`rectangle`**. (Export runtime also accepts legacy **`rect`** as rectangle; feed save does not.) |
| **Required** | Optional on input; invalid values throw on save. |
| **Fallback** | **`roundel`** when unset in preview helpers. Forced to **`rectangle`** in editor when `include_roundel_frame_bool` is set true. Runtime uses rectangle when roundel frame is on regardless of this field. |

#### `include_roundel_frame_bool`

| | |
|---|---|
| **Type** | `boolean` |
| **Description** | Whether the optional Act 3 offer roundel frame is shown (four-act timing). |
| **Validation** | Coerced boolean. |
| **Required** | Optional. |
| **Fallback** | **`false`** (three-act timing, roundel frame off). When `true`: enables `frames-4`, `roundel-frame-on`, shows heading 3 over roundel, and forces rectangular CTA. |

---

### Copy — offers

Offer slots 2 and 3 are hidden at runtime when `offer_count_num` is 1 or 2 respectively. `%`, `£`, and `€` in **value** fields get smaller symbol styling at runtime.

#### `offer1_value_text`

| | |
|---|---|
| **Type** | `string` |
| **Description** | Primary value in offer slot 1. |
| **Validation** | Any string. |
| **Required** | Optional; slot 1 is always in DOM for `offers-1+`. |
| **Fallback** | `''`. Client preview default: `'15%'`. |
| **Copy validation** | `#offer1 .offer-value` when slot visible. |

#### `offer1_sub_text`

| | |
|---|---|
| **Type** | `string` |
| **Description** | Subline in offer slot 1. |
| **Validation** | Any string. |
| **Required** | Optional. |
| **Fallback** | `''`. Client preview default: `'OFF ELECTRICITY*'`. Subline font sizes are equalised across visible slots at runtime. |
| **Copy validation** | `#offer1 .offer-subline` when slot visible. |

#### `offer2_value_text`

| | |
|---|---|
| **Type** | `string` |
| **Description** | Primary value in offer slot 2. |
| **Validation** | Any string. |
| **Required** | Optional; only shown when `offer_count_num ≥ 2`. |
| **Fallback** | `''`. Client preview default: `'30%'`. |
| **Copy validation** | `#offer2 .offer-value` when slot visible. |

#### `offer2_sub_text`

| | |
|---|---|
| **Type** | `string` |
| **Description** | Subline in offer slot 2. |
| **Validation** | Any string. |
| **Required** | Optional; only shown when `offer_count_num ≥ 2`. |
| **Fallback** | `''`. Client preview default: `'OFF GAS*'`. |
| **Copy validation** | `#offer2 .offer-subline` when slot visible. |

#### `offer3_value_text`

| | |
|---|---|
| **Type** | `string` |
| **Description** | Primary value in offer slot 3. |
| **Validation** | Any string. |
| **Required** | Optional; only shown when `offer_count_num ≥ 3`. |
| **Fallback** | `''`. Client preview default: `'100'` (sample row uses `'€125'`). |
| **Copy validation** | `#offer3 .offer-value` when slot visible. |

#### `offer3_sub_text`

| | |
|---|---|
| **Type** | `string` |
| **Description** | Subline in offer slot 3. |
| **Validation** | Any string. |
| **Required** | Optional; only shown when `offer_count_num ≥ 3`. |
| **Fallback** | `''`. Client preview / sample default: `'OFF YOUR FIRST BILL*'`. |
| **Copy validation** | `#offer3 .offer-subline` when slot visible. |

---

### Copy — terms, CTA, roundel

#### `tc_terms_text`

| | |
|---|---|
| **Type** | `multiline` |
| **Description** | Terms and conditions line (shown in both T&C modes); line breaks are preserved when the layer wraps. |
| **Validation** | Any string. |
| **Required** | Optional. |
| **Fallback** | `''`. Client preview / variant merge default: `'*T&Cs apply'`. In **`tcs_units`** mode, this line exits before unit prices appear. |
| **Copy validation** | `.terms-prices`, `.terms-solo` when visible. Height overflow is not flagged (legal copy). |

#### `tc_units_text`

| | |
|---|---|
| **Type** | `multiline` |
| **Description** | Unit-rate text; line breaks are preserved when the layer wraps. |
| **Validation** | Any string. |
| **Required** | Optional; only displayed when `tc_type_enum` is **`tcs_units`**. |
| **Fallback** | `''`. Client preview default includes a sample electricity rate line. |
| **Copy validation** | `.unit-rate-prices` when visible. Height overflow is not flagged. |

#### `cta_text`

| | |
|---|---|
| **Type** | `string` |
| **Description** | CTA label. |
| **Validation** | Any string. |
| **Required** | Optional. |
| **Fallback** | `''`. Client preview / variant merge default: **`'Switch today'`**. |
| **Copy validation** | `#cta` when visible. |

#### `roundel_text_text`

| | |
|---|---|
| **Type** | `string` |
| **Description** | Text shown inside the optional roundel frame (e.g. “Save up to”). |
| **Validation** | Any string. |
| **Required** | Optional; only relevant when `include_roundel_frame_bool` is **`true`**. |
| **Fallback** | `''`. Client preview / variant merge default: **`'Save up to'`**. |
| **Copy validation** | `.roundel-copy` when roundel frame visible. |

#### `roundel_value_text`

| | |
|---|---|
| **Type** | `string` |
| **Description** | Optional large value inside the roundel frame (e.g. `€1,080`). |
| **Validation** | Any string. |
| **Required** | Optional. Non-empty value switches layout to **`roundel-split`**. |
| **Fallback** | `''`. Client preview default: `'€1,080'`. |
| **Copy validation** | `.roundel-value` when roundel frame visible. |

---

### Assets — per-size background images

Background images are **per size**. `backgroundImageFieldDefinitions()` (in `src/lib/feed-background.ts`) generates one `image` field per entry in `CREATIVE_AD_SIZES`:

| Field | Size |
|---|---|
| `background_image_url_160x600` | 160×600 |
| `background_image_url_300x250` | 300×250 |
| `background_image_url_300x600` | 300×600 |
| `background_image_url_320x50` | 320×50 |
| `background_image_url_728x90` | 728×90 |
| `background_image_url_970x250` | 970×250 |

Each behaves identically:

| | |
|---|---|
| **Type** | `image` |
| **Description** | Optional image URL or asset path for that size's background. |
| **Validation** | Any string. Relative paths may use `assets/…` or `/assets/…`; absolute URLs supported. |
| **Required** | Optional. |
| **Fallback** | Empty → **packaged size background** from creative JSON (`sizes[size].assets.background`). Preview maps `assets/foo` → `/assets/foo`. Runtime only replaces `#bg-image` when the URL is non-empty. |

Resolution helper: `backgroundImageUrlForSize(row, size)` reads the per-size field for `size`. The exporter resolves `row['background_image_url_' + size] ?? row.background_image_url`.

> **Legacy `background_image_url`.** The old single, size-agnostic `background_image_url` field is no longer in `FEED_SCHEMA_FIELDS`. The export runtime still reads it as a **fallback** when the per-size field is absent, so older feed rows keep working, but new rows should set the per-size fields.

---

## Derived runtime scopes

These are not separate feed fields; they are computed from the fields above (`controlsFromFeedRow()` / `applyRuntimeState()`):

| Scope class | When applied |
|---|---|
| `offers-0` … `offers-3` | From `offer_count_num` (or derived offer values). `offers-0` also forces `tc-solo` and hides T&C layers. |
| `tc-solo` / `tc-prices` | From `tc_type_enum` (forced `tc-solo` when `offer_count_num` is `0`) |
| `cta-roundel` / `cta-rect` | From `cta_type_enum`, or always rect when roundel frame on |
| `frames-3` / `frames-4` | From `include_roundel_frame_bool` |
| `roundel-frame-off` / `roundel-frame-on` | From `include_roundel_frame_bool` |
| `roundel-copy-only` / `roundel-split` | Split when roundel frame on **and** `roundel_value_text` trimmed non-empty |

## Related files

| File | Role |
|---|---|
| `src/server/feed-schema.ts` | Canonical field list (`FEED_SCHEMA_FIELDS`) and save-time validation |
| `src/lib/feed-background.ts` | Canonical ad-size list and generated per-size background field definitions |
| `src/lib/feed-model.ts` | Editor coercion, variant selection, scope derivation |
| `src/server/creative-exporter.ts` | Export runtime, preview defaults, copy validation |
| `src/lib/headline-motion.ts` | Headline act skip plan and H4 display fallback |
| `src/lib/preview-utils.ts` | Background URL resolution for editor preview |
| `campaign/sse-dco-creative.json` | Embedded `feed.fields` and `feed.sampleRows` |

## Sample row

The default sample row in `campaign/sse-dco-creative.json` demonstrates triple offers, `tcs_units`, rectangular CTA, roundel frame off, and populated headline/roundel copy. Use it as a working example when authoring new rows.
