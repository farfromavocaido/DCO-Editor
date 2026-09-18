# Publish the client preview

Save your creative and sample values in the editor, then run from this repository:

```sh
just publish
```

The command runs, in order:

1. `npm test` — all engine and browser contracts.
2. Sync Zips — uses the same export-package builder as the editor, with fresh browser measurements for fixed-copy outlines.
3. A strict local Pages export — catches missing packages/export errors before pushing.
4. Your existing `gitup` shell function — stages all changes, creates its timestamped commit and pushes `origin main`.
5. Finds the push-triggered `pages.yml` workflow for that exact commit and watches it through build and deployment.

Only a successful completed workflow prints the live page:
https://farfromavocaido.github.io/DCO-Editor/

Failures stop the sequence with a nonzero exit status. A failed/cancelled workflow prints its GitHub link. There is no automatic retry loop that would hide a failure. If another push supersedes this deployment, cancellation is reported rather than claiming success.

## Requirements

- Run on `main`.
- Dependencies installed with `npm ci`.
- Test Chromium installed with `npm run setup:browser` (tooling only; not shipped in ads).
- GitHub CLI authenticated with `gh auth login`.
- Your `gitup` function available in interactive zsh.

## Saved data versus the open editor

This terminal command reads saved campaign JSON and saved default sample rows. It cannot see unsaved edits, provisional layout previews, or a different sample row selected only in a browser tab. Save those choices first. Dynamic ads retain their dynamic feed bindings; fixed-copy static ads bake the saved default row.

The terminal sync does not require the editor server to be running. It exports only the registered static-preview campaigns, plus the ROI/NI DCO agency packages; demo campaigns are excluded.

For package generation without a commit, push or deployment:

```sh
just sync-zips
```

Local tests/export reduce avoidable CI failures but do not guarantee GitHub's environment or deployment service will succeed. The final watch step remains the authority for whether this commit deployed.
