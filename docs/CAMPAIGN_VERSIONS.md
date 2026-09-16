# Campaign versions and property relationships

The header chooses the version you are viewing. Normal single-item inspector changes author a local exception for that format/version. Canvas grouping is independent of property sharing.

## Copying and linking

Copy from / Copy to opens a transaction. Choose source and concrete destinations, select properties, and review current/proposed values and production-rendered thumbnails. Matching unsaved sample rows supply the copy; if no sample exists, the preview explicitly says it is using current copy as a fallback. No document change happens until Apply. Apply closes and resets the transaction; Undo reverses it.

Link properties uses the same review but creates a named persistent relationship. Existing ownership for the chosen fields is replaced only in those destinations. Linked properties lists members and explicit shared-edit / unlink actions. Unlink keeps current appearance; Use inherited value separately removes a local exception. Different formats can keep their own geometry within one named relationship.

The destination picker enumerates actual valid combinations: selecting Product=Lamp, Language=English/Gaeilge, Theme=Light/Dark selects four versions per format. Derived SSE conditions are not independent choices. Deselecting a destination affects only the pending transaction, never an earlier copy or link.

## Campaign definitions

A document with `variantModel` opts into campaign-defined variables and the generic production runtime. Each discrete dimension supplies an id, label, feed field, typed default, options with stable scope tokens, and optional header visibility. Array order controls the default header. `validConditions` can list allowed partial scope combinations. Empty dimensions support campaigns without variants.

`variantPresentation` stores header order and hidden controls. The Controls popover edits this presentation independently of rendering. New dimension definitions are currently authored in campaign JSON; this change does not include a campaign-creation wizard. See `campaign/product-demo-creative.json` and `docs/FEED_VARIABLE_SCHEMA.md` for the configuration and supported identifiers.

Content fields remain distinct from variant dimensions. Header navigation selects an existing matching sample row. If the campaign has no row for that combination, it creates a separate unsaved draft using the previous sample's copy rather than overwriting the source.

Generic dimensions currently represent explicit finite feed values. Derived dimensions remain supported by the legacy SSE adapter; authored `derived:true` is rejected until a declarative derivation model is implemented. Generic layer identifiers avoid the documented legacy internal DOM names. These restrictions fail explicitly during validation rather than changing output silently.

## SSE compatibility and protection

Existing SSE documents do not need a variantModel. A compatibility adapter supplies their dimensions/labels while the legacy production renderer remains active. Loading/saving does not migrate or seed new campaign values. The demo is excluded from the published SSE static-preview bundle.

Before implementation: annotated tag `snapshot/before-campaign-versions-20260916` at `a20091e`; campaign archive and six production HTML baselines in `~/.codex/backups/dco-campaign-versions-20260916`. Work is isolated on `codex/campaign-versions`; main and the prior preview worktree stay unchanged.

## Verification

- `npm test`, `npm run test:creative`, `npm run build`.
- `npx tsx --tsconfig tsconfig.json scripts/verify-sse-compatibility.ts <baseline-directory>` compares all six SSE production HTML files byte-for-byte.
- `scripts/verify-editor-relationships.ts <origin>` exercises both SSE and demo transactions, save/reload using intercepted memory storage, and checks real files are unchanged.
- `scripts/verify-campaign-parity.ts <origin>` compares all 16 demo format/version combinations with independently packaged HTML, saved QA and outline preview.
- Existing `test:parity` and `scripts/verify-qa-parity.ts` cover SSE production editor/export/QA.

Generic QA at `/qa?campaign=product-demo` reviews saved sample versions through the production renderer and labels its document revision. Refresh loads a new saved snapshot; unsaved editor changes are excluded. SSE retains its established stress-copy hold-sheet workflow.
