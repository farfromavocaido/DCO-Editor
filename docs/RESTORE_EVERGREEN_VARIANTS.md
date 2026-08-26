# Restore Evergreen Variants

Checkpoint of the SSE DCO **offers-0 / evergreen** creative work as of **24 Aug 2026** (after navy/white ink, stage1↔stage2 bluewave, always-white T&Cs, bottom-up scrim, etc.).

Created so the ad document can be restored even if local history is unclear.

## Checkpoint refs

| Ref | Points at |
|---|---|
| Branch `checkpoint/offers-0-evergreen-2026-08-24` | Full tree at that checkpoint |
| Tag `checkpoint/offers-0-evergreen-2026-08-24` | Same commit (`a970f06`) |

Pre-evergreen-ink baseline (state immediately before navy/white): commit `9d8b0a6` (18 Aug 2026).

## Restore the creative JSON (ads only)

From the repo root:

```bash
git checkout checkpoint/offers-0-evergreen-2026-08-24 -- campaign/sse-dco-creative.json
```

That puts the checkpointed `campaign/sse-dco-creative.json` into the working tree (staged). Review, then commit if you want it on `main`.

Equivalent via the tag:

```bash
git checkout checkpoint/offers-0-evergreen-2026-08-24 -- campaign/sse-dco-creative.json
```

(Branch and tag share the same name and commit.)

## Restore the full checkpoint tree

```bash
git switch checkpoint/offers-0-evergreen-2026-08-24
```

Or create a throwaway branch from the tag:

```bash
git switch -c restore/offers-0-evergreen checkpoint/offers-0-evergreen-2026-08-24
```

## Notes

- The checkpoint includes **code + creative**. Restoring only the JSON onto a newer codebase is usually fine; if behaviour looks wrong, switch to the full checkpoint branch.
- If the branch/tag are missing locally but exist on the remote: `git fetch --tags` then retry the checkout.
