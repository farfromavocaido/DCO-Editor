---
name: dco-qa-review
description: >-
  Review SSE DCO visual QA capture output (spritesheets and frame PNGs) and
  produce a findings report. Use when the user asks to review qa-output,
  DCO QA spritesheets, stress-copy captures, or visual fit/layout issues in
  production-faithful agency ads.
---

# DCO visual QA review

Review **what the ads actually look like** from a `npm run qa:dco` capture.

Default pass = **junior designer glance**: flag only things that are **obviously wrong**. Anyone looking at the frame should agree immediately. No measurement scripts, no glyph-bounding boxes, no DOM metrics as truth.

## Why full-res frames are primary (read this)

Spritesheets are **not** reliable as the sole vision input:

1. Sheets are capped at ~2048px longest edge with **16 cells** packed in.
2. When the Read tool / model vision pipeline ingests them, they are often **downscaled again**. A `320x50` cell can land at ~20px tall — clipping and truncation become invisible.
3. Parent agents often receive **auto-generated image captions** instead of usable pixels. Captions invent and miss defects. Prefer under-reporting over trusting captions.

**Primary surface = native full-res hold frames** at `{run}/{size}/{variantId}__{copy}/tXXXX.png` (actual ad pixel size: 160×600, 300×250, …).

**Spritesheets** = timeline map only (which moments exist) + embed in the written report for humans. Do **not** triage from sheets alone.

## Default scope (first pass)

**Only obvious defects.** Do **not** include Warnings, “could improve”, near-misses, cramped-but-readable, or timing analysis unless the user explicitly asks for a deeper pass.

For each settled hold frame:

1. Treat that frame **in isolation** — it is the ad a user sees at one moment in time.
2. Ask (and similar):
   - Does anything look **clipped** (cut by the ad edge, or spilling out of a container like the roundel)?
   - Does anything look **incorrectly truncated** (compare to expected copy — see Expected copy)?
   - Does anything look **misaligned** or obviously broken (hard overlaps, stacked/ghosted type, wrong content for the variant)?
3. If the answer is not an immediate “yes, that’s wrong”, **do not report it**.

Describe what you see in plain language (“the top of ‘Saving you up to’ is cut off by the circle”). Quote the **actual** expected string when naming copy — do not invent shorthand line names that do not match the feed.

## Context

- Campaign: SSE DCO only (`campaign/sse-dco-creative.json`).
- Artifact under test: **canonical-agency** HTML (Enabler + Museo CDN + shared text-fit), not the editor WIP preview.
- Matrix: **6 layout variants** × **2 copy sets** (`short`, `long`) × **6 sizes** = **72** sessions.
- Full-res frames: `{size}/{variantId}__{copy}/tXXXX.png` (4 fps capture).
- **Hold list:** `{run}/hold-samples.json` — derived from compiled clip plateaus in the creative JSON (not hardcoded times).
- Spritesheets: `spritesheets/{variantId}/{copy}/{size}.png` — human report embeds only.
- Run folder: `qa-output/<YYYYMMDD-HHMMSS>/`. Prefer `qa-output/latest`. Older runs: `qa-output/archive/<stamp>/`.
- `qa-report.md` — DOM flags only; ignore for aesthetics.

`sessionId` looks like `o2_roundel_prices_rect__long`.

### Hold samples (default pass)

Do **not** hardcode `t4000` / `t7000` / `t10000` / `t13000`. Holds move with `clock.profiles` and layer clips.

1. Read `{run}/hold-samples.json`.
2. For each session (`{variantId}__{copy}`) and size, use `bySession[sessionId].bySize[size].frames` (e.g. `t3500.png`, `t9500.png`, …).
3. Full-res path: `{run}/{size}/{sessionId}/{frame}`.

If `hold-samples.json` is missing (older run), regenerate before triage:

```bash
npx tsx --tsconfig tsconfig.json scripts/qa-dco/hold-samples.ts --output qa-output/<run>
```

Derivation (for context): `src/lib/hold-samples.ts` walks QA-relevant layers through `compileAnimationClips` / `frameAtPercent`, finds opacity≈1 + scale≈1 plateaus, snaps midpoints to the capture grid (`intervalMs`, usually 250). Roundel holds appear only for `frames-4`; offer/legal layers follow offer-count and T&C scopes.

Do **not** deep-dive other timestamps on the default pass unless a listed hold is mid-fade (then try ±`intervalMs` neighbours for a clearer settle — still not a timing investigation).

## Layout variants

| Prefix | Offers | Roundel | T&C | CTA |
|---|---|---|---|---|
| `o1_roundel_prices_rect` | 1 | on | prices | rect |
| `o2_roundel_prices_rect` | 2 | on | prices | rect |
| `o3_roundel_prices_rect` | 3 | on | prices | rect |
| `o3_noroundel_solo_circ` | 3 | off | solo | circular |
| `o0_roundel_rect` | 0 | on | n/a | rect |
| `o0_noroundel_circ` | 0 | off | n/a | circular |

## Expected copy

Source of truth: `scripts/qa-dco/copy-matrix.json` (and the variant’s offer/roundel/CTA flags above).

**Long (stress):** headlines include `A different kind of energy` / `This year's best electricity plan`; offer values `11%` / `£8,888` / `€1,080`; offer1+2 subs `OFF ELECTRICITY*`; offer3 sub `OFF YOUR FIRST BILL*` (3-offer only); roundel text `Saving you up to` + value `£8,888`; T&Cs `*T&Cs apply. See sseairtricity.com for full terms.`; CTA offers `Switch today`, brand `Find out more`.

**Short:** headlines `Save` / `Switch` / `Go`; offers `10.5%`/`OFF GAS*` + `1%`/`OFF ELECTRICITY*` (+ `€1`/`OFF BILL*` when 3 offers); roundel `Up to` / `€1`; short T&Cs as in the matrix.

Mixed £ / € in long stress copy is **intentional** — do not flag as a defect.

Use this to judge **incorrect truncation** (e.g. legal ending at “for” when it should continue; CTA showing only “Find out” when it should be “Find out more”). Do not flag intentional short-matrix copy as truncated.

## Canvas / containers

Judge only the creative rectangle (native ad bounds).

Roundel text belongs **inside the circle**. Copy cut by the circle or clearly sitting outside it is clipped. Fat values past the **ad** edge are canvas overflow. These are separate observations — only report what you actually see on that frame (circle clip ≠ canvas clip).

## Do not report on the default pass

Dismiss silently — do not put in `visual-review.md`:

1. Mid-crossfade / mid-transition (blur, half-faded type, empty headline between holds, ghosted outgoing copy).
2. Enter/exit motion unless the hold itself is broken.
3. Cramped-but-readable, tight margins, “near” collisions, polish preferences.
4. Warnings of any kind (default pass has **no Warning section**).
5. DOM / `qa-report.md` flags not obvious in the pixels.
6. Timing deep-dives (“check adjacent frames”, “may be mid-crossfade”) — only if the user asks for that deeper pass.
7. Intentional stress-data quirks (mixed currencies, absurd `£8,888`) that still render fully inside the canvas.

Vision captions lie. If a caption claims overflow/clip but **you cannot see it on the full-res frame**, drop it. Prefer under-reporting over inventing defects.

## What to flag (default pass = Findings only)

Obvious, settled-looking problems only:

- Clipped by the ad edge (offers, headlines, legal, CTA, logo, roundel)
- Clipped by / spilling out of the roundel circle
- Incorrect truncation vs expected copy
- Hard overlaps / illegible stacked type
- Clear misalignment that breaks the layout
- Wrong content for the variant (e.g. offers on offers-0)

**Bullets:** one issue per bullet. Never combine two defects with “;” / “also” / em-dashes.

## Efficient workflow (required)

Do **not** serially Read all 72 spritesheets in the parent. Use **full-res triage → confirm → write**.

### 0. Resolve run folder

Use the path the user named; else `qa-output/latest/`; else newest stamp with frame dirs or `spritesheets/`. Confirm at least one `{size}/…/t*.png` exists or ask for `npm run qa:dco`. Ensure `hold-samples.json` exists (regenerate command above if missing).

### 1. Parallel triage (subagents)

Launch **3** `generalPurpose` Task subagents **in one message**. Prefer model **`gpt-5.6-terra-medium`** for visual triage unless the user names another listed model.

Split:

| Agent | Variants |
|---|---|
| A | `o1_roundel_prices_rect`, `o2_roundel_prices_rect` |
| B | `o3_roundel_prices_rect`, `o3_noroundel_solo_circ` |
| C | `o0_roundel_rect`, `o0_noroundel_circ` |

Each subagent prompt must include the absolute run path, the `hold-samples.json` path, and these rules:

1. Load `hold-samples.json`. For each assigned variant × copy × size, Read **only** the listed full-res frames: `{run}/{size}/{variantId}__{copy}/{frame}` from `bySize[size].frames`.
2. Prefer **long** first; skim **short** faster.
3. Batch Read **3–4 PNGs** per tool round (small native ads — do not open spritesheets for triage).
4. Judge **each frame in isolation** — junior-designer obvious wrong only.
5. Compare visible strings to expected copy when truncation is suspected.
6. Do **not** chase blank/faded frames or neighbour timing on this pass.
7. Return only:

```
RUN: <path>
VARIANT: <id>
CLEAN: short|long — <sizes or "all">
OBVIOUS:
- <copy> <size> | <one-line plain-language reason>
```

Parent waits for all three before writing.

### 2. Confirm (parent)

From triage `OBVIOUS` only:

1. Re-Read the **same full-res hold frame(s)** that show the defect (not the spritesheet).
2. Drop anything that is not immediately obvious on those pixels.
3. Drop vision-caption claims you cannot see yourself on the full-res frame.
4. Ignore DOM.

### 3. Write report

Write **`qa-output/<run>/visual-review.md`** and summarise for the user.

## Output format

Group by layout variant. For each of the 6:

1. Variant id + short description (offers / roundel / T&C / CTA)
2. **Findings only** — omit clean sizes from the body
3. Per size with issues: heading + **Findings** (no Warning / Could-improve blocks on default pass)
4. **Clean** at the end

Embed the spritesheet above findings (human navigation), then an **Open** link:

```md
![sheet](spritesheets/{variant}/{copy}/{size}.png)

[Open](spritesheets/{variant}/{copy}/{size}.png)
```

Plain sentences. No per-timestamp breakdown. No “re-check next capture”.

```md
# DCO visual review

Reviewed: <ISO timestamp>
Source: [`qa-output/<run>/`](.)
Pass: obvious issues only (junior-designer glance; derived full-res holds)
Model: GPT-5.6 Terra

## `{variantId}`

{description}

### Long

#### 160x600

![sheet](spritesheets/{variantId}/long/160x600.png)

[Open](spritesheets/{variantId}/long/160x600.png)

**Findings**

- Second offer value `£8,888` is cut off by the left and right edges of the ad.
- Top of roundel text `Saving you up to` is cut off by the circle.

---

## Clean

- `{variantId}` — short (all sizes); long 728x90
```

## Deeper pass (only if asked)

If the user asks for warnings, polish, or timing (blank cells, crossfades, adjacent frames at 4 fps): expand scope for that request only. Do not mix that detail into the default report.
