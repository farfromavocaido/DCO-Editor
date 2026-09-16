# Editor clarity and QA trust

Approved direction: simplify editing/copying/sharing, retain production rendering, make QA fresh and equivalent, reduce preview reload costs. Campaign documents remain untouched.

1. QA: revision-pinned shell built from saved campaign + renderer fingerprint, safe publication, exact runtime settling before seek, visible source revision and row identity.
2. Inspector: action-based copy/share/independence with explicit variant destinations and optional conditions; compact fields with on-demand provenance; valid selection on target changes.
3. Preview: reuse the production iframe for compatible CSS/fitting/feed updates, reload for structure/runtime changes; preserve exact-source readiness; reuse browser process for outline measurement; clarify text rendition labels.
4. Verify: engine/creative tests, build, actual browser editor/package/QA parity and action workflows. No artistic baseline changes.

Decisions: implement in a new worktree, preserve main and existing campaign edits. Reuse generated production HTML as update authority; do not duplicate creative CSS rendering in JSX. Structural or runtime changes retain full reload fallback.

## Completion and verification

- Inspector action workflow and local-edit semantics implemented. Scope subtraction retains original cascade specificity and only replaces actual supplied fields; outside-state and browser CSS regressions covered.
- QA cache/readiness and production preview reuse implemented; generation, applied document/row, and fitting settlement jointly guard readiness. Undo while fitting and row reversal are browser-tested.
- Production build and strict build TypeScript check pass. 489 engine/API tests and 32 creative checks pass.
- Independent embed + agency parity: 24 scenarios × 7 timeline samples each (336 comparisons). QA live sheet: 24 scenarios / 223 holds, including delayed font loading.
- Browser ownership workflow passes with intercepted in-memory persistence; campaign files unchanged. Live typography/fitting updates match a fresh production render.
- Final review findings resolved: interrupted preview rollback/readiness, scope partition specificity, unavailable fields accidentally removed during linking, and absent ink conditions outside zero offers.
- Worktree branch: codex/editor-clarity. Preview uses built app on port 5186. Main remains unchanged for review.
