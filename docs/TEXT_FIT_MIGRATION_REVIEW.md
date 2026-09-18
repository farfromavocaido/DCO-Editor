# Explicit text fitting — review checkpoint

Checkpoint: `checkpoint/before-text-fit-migration-20260917` (`f4225eb`).
Independent file backup: `/Users/aidancoughlan/.codex/backups/text-fit-migration-20260917-203710/campaign`.

**Current scope: promotional roundels only.** Offers, headlines, legal text and CTAs have been restored to the pre-migration checkpoint. The broader conversion below is retained as a future review plan, not the current state. The four SSE campaigns’ roundels were explicitly converted. Nothing is migrated on load or save; the product demo already used explicit frame settings. Existing exported packages were not regenerated or published.

## Roundels: edit the source first

Each campaign has two source versions in **300×250**:

| Source | Linked destinations | Arrangements to review |
|---|---|---|
| 1 offer | 1/2/3 offers across all six formats | Text only; number + copy |
| 0 offers | 0 offers across all six formats | Text only; number + copy |

Both groups start from the MPU offer-roundel internal design. Their subsequent edits are independent. Position, colour and overall size remain local. Internal geometry, typography and fitting follow the source proportionally. This is the Act 3 promotional roundel, not a circular CTA.

Select a linked roundel → **Edit source** to adjust its design, or **Unlink — keep appearance** to split off that version. At the source, the inspector identifies it as a shared component source. Source fitting changes apply to that source arrangement, rather than an incidental T&Cs/CTA feed choice.

Text-only roundels use a safe frame inset 15% from each side of the circle as the initial design, with multiline shrinking and a three-line limit. Two ordinary editable Layout rules centre the text's visible ink on the shape. They can be disabled/edited independently. These are reviewable starting choices, not a new hardcoded roundel policy.

Review the four source arrangements per campaign first. Then check the six format sizes, especially narrow banners where the local outer roundel size can make the scaled minimum too small. Detach an exception if the common proportions do not work for it.

## Deferred — other text (restored; no conversion currently applied)

| Text | Conversion | Review |
|---|---|---|
| Headlines 1–4 | Fixed frame; existing wrap/shrink and equalisation retained | Old box height now constrains fitting. Enlarge the box if copy is shrinking unnecessarily. |
| Offer values | Fixed single-line frame; shared size and tracking retained | Numeral baseline and long price/percentage strings. |
| Offer sublines | Fixed frame; wrap/shrink choice and maximum lines retained | Long labels and 2/3-offer layouts. |
| Legal copy / unit rates | Content height; existing wrapping retained; visible overflow | Bottom placement, empty copy, long copy. Existing layout rules and pins remain; unpinned bottom/centre-aligned text starts from its former box anchor. |
| CTA | Explicit fixed frame with its existing font behaviour | Long CTA labels. Circular CTA remains separate from the promotional roundel. |

Where the authored minimum exceeded the designed font size, the smaller is now the minimum and the larger the designed size. Correctly ordered low minimums, including 1–2px, were not replaced with an invented legibility threshold: review these.

Content-height text now clips to its line budget when **Clip** is chosen. **Visible** deliberately grows beyond that budget and reports the failed constraint. Multiline ellipsis is not offered as if it were reliable. Equalisation lists state-active family members; empty copy is omitted during actual runtime fitting.

## Rollback and application

Review using the editor, then Save normally. Do not restore the whole checkpoint over subsequent work: use the checkpoint/backup to compare or selectively restore the campaign files if abandoning this experiment. `scripts/migrate-text-fitting.ts` writes a dry run to `output/text-fit-migration/` by default; `--apply` explicitly writes roundel-only conversion; already-converted roundels are skipped. `--all-text` is a separate explicit opt-in for a future full conversion.

The old fitting runtime remains a compatibility reader for unmigrated documents and fixed test fixtures. The converted campaign controls offer Fixed frame and Content height; they cannot be switched back to legacy via the selector.
