# SSE DCO — dynamic fields

Profile: **`SSE_DCO_Offers`**. These are the fields bound into exported HTML at serve time. Full reference (including Studio meta fields): [FEED_VARIABLE_SCHEMA.md](./FEED_VARIABLE_SCHEMA.md).

**Sample values** below come from `campaign/sse-dco-creative.json` → `feed.sampleRows[0]`, unless noted as client-preview defaults.

## Act structure (headlines)

The ad has up to four headline acts, timed to animation beats:

- **Act 1** (`heading1_text`) — opening headline.
- **Act 2** (`heading2_text`) — plays over the offer block(s).
- **Act 3** (`heading3_text`) — only when **`include_roundel_frame_bool` is `true`** (four-act / “offer roundel” mode). Sits over the optional roundel frame, not the CTA.
- **Act 4** (`heading4_text`) — always timed over the **CTA / end frame**, in both three-act and four-act modes. When roundel frame is **off** and this field is empty, the runtime displays **`heading3_text`** instead (legacy fallback for rows that only had three headline fields).

When roundel frame is **off**, the animation skips Act 3 and runs **1 → 2 → 4**. Duplicate copy between consecutive acts can be auto-skipped in motion (e.g. identical H1 and H2).

---

## Headlines

### `heading1_text`

- **Type:** string
- **Description:** Act 1 opening headline.
- **Validation:** any string
- **Required:** optional (empty allowed)
- **Default / fallback:** `''` in production
- **Sample:** `A different kind of energy`

### `heading2_text`

- **Type:** string
- **Description:** Act 2 headline, shown while offer block(s) are on screen.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`
- **Sample:** `Our very best electricity plan`

### `heading3_text`

- **Type:** string
- **Description:** Act 3 headline over the **offer roundel frame**. Only visible in the timeline when **`include_roundel_frame_bool` is `true`**. Also used as the **display fallback for Act 4** when roundel frame is off and `heading4_text` is empty.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`; may appear on `#headline-act4` when roundel off + H4 empty
- **Sample:** `A different kind of energy`

### `heading4_text`

- **Type:** string
- **Description:** Act 4 headline, always positioned over the **CTA / end frame** (not the offer roundel). Enters at the CTA beat in both 3-act and 4-act profiles.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** if roundel frame **off** and empty → show `heading3_text`; if roundel frame **on** → empty stays empty
- **Sample:** `Switch and save today`

---

## Offers

Controlled by **`offer_count_num`** (1–3). Slots above the count are hidden at runtime. Trailing **`%`**, **`£`**, and **`€`** in value fields get smaller symbol styling automatically.

### `offer_count_num`

- **Type:** integer
- **Description:** Number of visible offer slots.
- **Validation:** **1–3**; out-of-range values clamp (no error)
- **Required:** optional on input; always coerced to 1–3
- **Default / fallback:** `1` if missing/invalid; runtime can also infer from non-empty `offerN_value_text`
- **Sample:** `3`

### `offer1_value_text`

- **Type:** string
- **Description:** Primary value for offer slot 1 (always in scope when count ≥ 1).
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`
- **Sample:** `15%`

### `offer1_sub_text`

- **Type:** string
- **Description:** Subline for offer slot 1.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`; subline font sizes are equalised across visible slots at runtime
- **Sample:** `OFF ELECTRICITY*`

### `offer2_value_text`

- **Type:** string
- **Description:** Primary value for offer slot 2. Hidden when `offer_count_num` &lt; 2.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`
- **Sample:** `30%`

### `offer2_sub_text`

- **Type:** string
- **Description:** Subline for offer slot 2. Hidden when count &lt; 2.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`
- **Sample:** `OFF GAS*`

### `offer3_value_text`

- **Type:** string
- **Description:** Primary value for offer slot 3. Hidden when count &lt; 3.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`
- **Sample:** `€125` *(client preview seeds `100` before sample row merge)*

### `offer3_sub_text`

- **Type:** string
- **Description:** Subline for offer slot 3. Hidden when count &lt; 3.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`
- **Sample:** `OFF YOUR FIRST BILL*` *(client preview seeds `OFF BILL*`)*

---

## Terms & conditions

### `tc_type_enum`

- **Type:** enum
- **Description:** Which legal copy variant to show.
- **Validation:** must be **`tcs_only`** or **`tcs_units`**. Legacy aliases on save: `solo` → `tcs_only`, `prices` → `tcs_units`.
- **Required:** optional; invalid values throw on save
- **Default / fallback:** anything other than `tcs_units` → terms-only mode (`tc-solo`)
- **Sample:** `tcs_units` *(client preview default before merge: `tcs_only`)*

**Modes:**

- **`tcs_only`** — `tc_terms_text` only.
- **`tcs_units`** — `tc_terms_text` exits before **`tc_units_text`** (unit-rate line) appears.

### `tc_terms_text`

- **Type:** string
- **Description:** Main T&C line (both modes).
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`
- **Sample:** `*T&Cs apply`

### `tc_units_text`

- **Type:** multiline string
- **Description:** Unit-rate / price detail. Line breaks preserved. Only shown when **`tc_type_enum` is `tcs_units`**.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`
- **Sample:** `Electricity unit rate: 32.64 Inc. Vat 31.09 Ex. Vat`

---

## CTA

### `cta_type_enum`

- **Type:** enum
- **Description:** CTA button shape. The feed value for a circular CTA is **`roundel`** (not `circle`). UI labels this “Round”; rectangular CTA is **`rectangle`**.
- **Validation:** must be **`roundel`** or **`rectangle`**. Export runtime also accepts legacy **`rect`** as rectangle; feed save does not.
- **Required:** optional; invalid values throw on save
- **Default / fallback:** **`roundel`** when unset in preview helpers. Forced to **`rectangle`** when **`include_roundel_frame_bool` is `true`** (editor auto-sets this; runtime always uses rectangular CTA with roundel frame on).
- **Sample:** `rectangle` *(client preview default before merge: `roundel`)*

### `cta_text`

- **Type:** string
- **Description:** Label inside the CTA button (circle or rectangle).
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''` in production; preview merge default `'Switch today'`
- **Sample:** `Switch today`

---

## Offer roundel frame (Act 3)

Separate from the CTA shape. This is the optional **savings roundel** in Act 3, not the round CTA button.

### `include_roundel_frame_bool`

- **Type:** boolean
- **Description:** Enables the **four-act** timeline with the optional offer roundel frame and Act 3 headline. When **`false`**, uses **three-act** timing (headlines 1, 2, 4 only; Act 3 layer hidden).
- **Validation:** `true` | `false`
- **Required:** optional
- **Default / fallback:** **`false`**
- **Sample:** `false`

When **`true`**: `frames-4` timing, Act 3 headline visible, CTA becomes rectangular, and roundel copy fields apply.

### `roundel_text_text`

- **Type:** string
- **Description:** Small copy inside the roundel frame (e.g. “Save up to”). Only relevant when roundel frame is on.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`; preview merge default `'Save up to'`
- **Sample:** `Save up to`

### `roundel_value_text`

- **Type:** string
- **Description:** Large value inside the roundel frame (e.g. savings amount). Non-empty value switches layout to **split** (text + value); empty uses **copy-only** layout.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** `''`
- **Sample:** `€1,080`

---

## Background

### `background_image_url`

- **Type:** image (URL or asset path string)
- **Description:** Optional full-bleed background. Relative paths may use `assets/…` or `/assets/…`; absolute URLs supported.
- **Validation:** any string
- **Required:** optional
- **Default / fallback:** empty → **packaged per-size background** from the creative JSON (Studio convention: blank means default art)
- **Sample:** `""` (empty — uses packaged background)

---

## Production vs preview

- **Production export** reads `window.dynamicContent` and uses feed values as supplied; empty strings stay empty (no baked-in copy defaults).
- **Client preview / WIP** merges hard-coded demo defaults with `sampleRows[0]`, which is why some fields differ between preview seeds and the stored sample row (noted above).
