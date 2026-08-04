# DCO visual QA matrix

Local Playwright pipeline that exports **canonical-agency** SSE DCO HTML, injects stress feed rows, captures the 15s timeline at **4 fps** (full-res frames every **250ms**), builds **one spritesheet per ad** at **1 fps**, and writes a cleaned DOM flag report.

## Why

Editor sample rows do not cover extreme short/long copy. This matrix exercises production-faithful agency HTML (Enabler, Museo CDN, inlined SVGs, `applySseDcoRuntimeState` + shared text-fit). The primary review surface is **what it looks like** — native full-res hold frames listed in `hold-samples.json` (spritesheets are for human timeline embeds). Not DOM approximation.

## Matrix

- **6 layout variants** × **2 copy sets** (`short`, `long`) = **12 feed rows**
- **6 sizes** → **72 capture sessions**
- **61 full-res frames** per session (`t=0…15000` ms every **250ms** / 4 fps)
- Spritesheets sample **16 frames** per session (`t=0…15000` every **1000ms** / 1 fps) — use denser full-res neighbours to judge timing gaps

Definition: [`scripts/qa-dco/copy-matrix.json`](../scripts/qa-dco/copy-matrix.json).

| Variant | Offers | Roundel | T&C | CTA |
|---|---|---|---|---|
| `o1_roundel_prices_rect` | 1 | on | `tcs_units` | rectangle |
| `o2_roundel_prices_rect` | 2 | on | `tcs_units` | rectangle |
| `o3_roundel_prices_rect` | 3 | on | `tcs_units` | rectangle |
| `o3_noroundel_solo_circ` | 3 | off | `tcs_only` | roundel |
| `o0_roundel_rect` | 0 | on | n/a | rectangle |
| `o0_noroundel_circ` | 0 | off | n/a | roundel |

## Live in-app review (`/qa`)

While the editor is running (`just editor`), open [http://localhost:5174/qa](http://localhost:5174/qa) (also linked from the TopBar **QA** control).

This loads the same **canonical-agency** shell as `npm run qa:dco` (via `/api/qa/shell` → `.qa-work/`, served at `/qa-shell/…`), lets you edit feed copy and multi-select matrix variants/sizes, then shows **all settled holds** for the active session as a spritesheet-style grid (each cell seeks the real agency CSS timeline). No Playwright or PNG writes.

- Top bar (editor-style): **Size**, **Offers** 0–3, **T&Cs**, **CTA**, **Frame** (3 Acts / Offer roundel), **Copy** Short/Long, hold focus, thumbnail zoom
- Left rail: feed copy first; collapsible monitor sizes for the size pool
- Keyboard: `←`/`→` focus a hold · `[`/`]` size · `-`/`=` sheet zoom
- **Refresh shell** re-exports from saved `campaign/sse-dco-creative.json`

SSE DCO only. For archived frame review / Cursor skill passes, still use the capture pipeline below.

## Commands

```bash
# Full matrix (needs network for Enabler + Museo CDN)
npm run qa:dco

# Filters
npm run qa:dco -- --size 300x250 --variant o3_roundel_prices_rect
npm run qa:dco -- --copy long
npm run qa:dco -- --skip-export   # reuse .qa-work/

# Parallel capture pages (default: 12; forced to 1 with --headed)
npm run qa:dco -- --concurrency 6
npm run qa:dco -- -j 8
```

Install browsers once after dependency install:

```bash
npx playwright install chromium
```

The HTML shell export is a single pass. Parallelism speeds up Playwright capture.

## Outputs

Each `npm run qa:dco` run writes a **new** timestamped folder (local wall clock, no TZ suffix):

`qa-output/YYYYMMDD-HHMMSS/` — e.g. `qa-output/20260731-170122/`

Older stamps are moved to `qa-output/archive/<stamp>/` so the newest run sits alone at the root (easy to spot). Relative links inside a run (`spritesheets/…`, embeds in `visual-review.md`) stay valid because the **whole folder** moves. `qa-output/latest` is a symlink to the current stamp. Override with `--output <dir>` to skip archive/latest management (that directory is wiped for the run).

Gitignored under `qa-output/<run>/` (or `qa-output/archive/<run>/`):

| Path | Contents |
|---|---|
| `hold-samples.json` | **Derived hold list** for review — settled midpoints from creative JSON clip plateaus, per session × size |
| `settled/{size}/{sessionId}.png` | **Human scan folder** — one spritesheet per ad with **only** settled hold frames, grouped by size |
| `{size}/{variant}__{copy}/` | Full-res 4 fps `t0000.png` / `t0250.png`… + `meta.json` (review reads the hold frames named in `hold-samples.json`) |
| `spritesheets/{variant}/{copy}/{size}.png` | Full 1 fps timeline sheet for humans / report embeds |
| `spritesheets/{variant}/index.json` | Sheets for that layout variant |
| `fit-metrics.jsonl` | Raw on-stage issue events |
| `qa-report.md` | Deduped DOM flags (secondary) |
| `visual-review.md` | Cursor skill write-up (after review) |

Hold times are **not** hardcoded. [`src/lib/hold-samples.ts`](../src/lib/hold-samples.ts) compiles the same animation clips as preview/export (`frames-3` / `frames-4`, offers-N, T&C scopes), finds opacity≈1 + scale≈1 plateaus on headlines / offers / legal / roundel / CTA, and snaps midpoints to the capture grid (`intervalMs`). Regenerate for an existing run without re-capturing:

```bash
npm run qa:dco:holds -- --output qa-output/latest
npm run qa:dco:settled -- --output qa-output/latest   # settled/ scan sheets from hold-samples.json
```

Each variant’s **1 fps** sheet frames stay on **one** sheet (no orphaned page splits). Layout may wrap to multiple rows. Cells scale down only as far as **75%** of native size to keep longest edge ≤ 2048px. Frames are separated by a **10px** gutter; each cell has a caption (`#01 t0000 (0.00s)`) so reading order and exact lookup times are unambiguous.

## Visual review (Cursor)

There is **no automated agent pass** in the pipeline. After capture, ask Cursor to review using the project skill (parallel triage → confirm → `visual-review.md`):

[`.cursor/skills/dco-qa-review/SKILL.md`](../.cursor/skills/dco-qa-review/SKILL.md)

Default review is a **junior-designer glance** on the **derived full-res holds** in `hold-samples.json`; only obvious clip / incorrect truncation / misalignment. No Warnings or timing deep-dives unless you ask for a deeper pass.

Example (also printed at the end of `npm run qa:dco`):

`Run the /dco-qa-review skill on 20260731-175756 (aliased via qa-output/latest)`

## Fidelity notes

- Shell is built with `buildBasePackageEntries(..., { assetMode: 'canonical-agency' })` — same path as **Export Canonical Agency Zip**. Does **not** wipe tracked `outputs/`.
- Reads **saved** `campaign/sse-dco-creative.json` (unsaved editor state is ignored until save).
- Copy is injected via `window.applySseDcoRuntimeState(row)` after Enabler/fonts bootstrap.
- Canonical-agency backgrounds are feed-only; the harness injects local `/assets/bg_*.jpg` URLs.
- Roundel-on always forces rectangular CTA at runtime.
