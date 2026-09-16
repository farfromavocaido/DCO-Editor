# Campaign-defined versions and relationship transactions

Approved intent: designers choose a version, edit locally, copy through a reviewed one-off transaction, and manage persistent links separately. Campaigns declare dimensions and presentation; SSE stays compatible without rewriting its document.

Protection: snapshot tag snapshot/before-campaign-versions-20260916 at a20091e; campaign archive and six pre-change HTML outputs in ~/.codex/backups/dco-campaign-versions-20260916. Work in codex/campaign-versions only; existing port 5186 and main unchanged.

Implementation:
1. Data-defined campaign variant model, SSE compatibility adapter, generic feed/runtime path, unrelated demo with product/language/theme.
2. Header/feed/store/canvas consume campaign scopes; configure header visibility/order per campaign without changing runtime semantics.
3. Copy from/to and link transaction: destination choices, property diff, production before/after thumbnails, explicit apply closes; persistent link membership and unlink-preserve UI separate.
4. Verify: exact unchanged SSE HTML, campaign archive equality, engine/build checks, editor/QA/export parity, generic campaign and transaction browser flows. No artistic changes or automatic migration.

Decisions: a declared opt-in model separates generic runtime from SSE legacy paths. Original SSE definitions are provided by an adapter, so loading/saving approved ads does not migrate them. Custom campaign configuration is authored data; no executable user rules.

## Completed implementation

- Campaign-defined finite dimensions, defaults, allowed conditions and header order/visibility; adapter preserves existing SSE documents and renderer. Demo supports two formats and eight product/language/theme combinations, with arbitrary content bindings and outlined output.
- Header/sample editor/selection scopes consume the campaign model. Stale campaign requests are guarded by generation; selecting an absent version appends a draft rather than replacing source copy.
- Copy/link transaction provides exact destination counts, production before/after thumbnails with actual draft-row copy, and property differences. Applying closes/reset choices; persistent links support explicit shared edits and unlink preserving appearance.
- Generic saved QA uses production renderer with revision labeling; SSE QA remains on its established path.
- Snapshot verification: 34 original campaign files identical; all six SSE production HTML files byte-for-byte identical. No existing campaign JSON/assets changed.
- Validation: 517 engine/API tests, 32 creative checks, strict production TypeScript and production build pass. Both SSE package parity matrices pass (336 timeline comparisons). Generic editor/export: 16 format/version cases; saved QA: eight versions; font/outline/bound-image and JSON-content edge regressions pass. Transaction browser workflows pass for SSE and demo using memory-intercepted persistence.
- Review findings resolved: source-row overwrite in sparse campaigns, wrong sample copy in transaction previews, generic image outline bindings, reserved legacy DOM identifiers, unsupported derived definitions, initial/switch campaign races and header ordering.

Supported boundary: generic variable definitions are currently authored in JSON, not a campaign-creation wizard. Derived dimensions remain adapter-owned; generic derived flags and reserved internal DOM identifiers fail explicitly. Header presentation is editable in the UI. Work remains isolated on codex/campaign-versions; no merge or remote publication.
- Final built-app SSE QA comparison also passed: 24 scenarios / 223 holds, including delayed fonts.
