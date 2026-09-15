# Task 3 — explicit text frames and relative motion

Implemented in `.worktrees/editor-rebuild` only. No campaign JSON edited or automatically migrated.

## Text policy

`fit.frame` opts into `fixed` or `auto` (content height). Legacy rules without this field keep their fitting path. Fixed policy never changes position, height, max-height, or transform; wrapping, shrinking, max lines, overflow and tracking remain independent. Auto policy uses browser content height. The browser measures the complete Range and line fragments at each candidate size against width, fixed height, and optional max-lines constraints. Font-size minimum conflicts are reported rather than silently redefined.

Per-element diagnostics: `data-fit-status`, `data-fit-requested-size`, `data-fit-rendered-size`, `data-fit-clip-reason`, and the compatibility `data-fit-clipped`. Reasons include width, height, max-lines, minimum-size and unmeasurable. Engine results expose per-element diagnostics. Visible overflow remains a failed fit when constraints are unsatisfied. A font whose glyph ink exceeds its authored line box can honestly fail even at minimum size.

Explicit shared membership is independent of opacity/visibility and survives per-target policy overrides. Optional `fit.sharedGroup` names equalisation across text families; otherwise the current text family supplies membership. An explicit `shared:false` detaches fitting only. Runtime rules now include unscoped and compound fits in selector specificity order and exact named target selectors.

Authoring controls: `TextFitPolicyControls` integrated by ownership agent. Existing mode/min/max/alignment controls remain available; independent frame/wrap/size/overflow/shared controls require deliberate opt-in.

## Motion

Numeric distances remain pixels. Explicit `{ value, unit: 'px' | 'canvas' | 'parent' }` resolves canvas/parent values as percentages of that reference dimension (25 means 25%). X uses width, Y uses height. Missing reference dimensions throw instead of becoming element-relative CSS or zero.

`MotionContext` is compiler's optional third argument. Current animated production layers are direct children of page-content, so production passes canvas for both canvas and actual parent. Canvas selection groups do not change parent motion geometry. Compiler supports relative custom translate channels and preset parameters; intent creation retains authored units until each format is compiled.

Time values support `{ value, unit: 'seconds' | 'timeline-percent' }` independently from distance units. Timeline and inspector use duration context. `MotionDistanceControls` and `MotionTimingControls` expose authoring through existing clip updates. Ownership agent integrates inspector and typed timeline drag handling.

Production static/keyframe CSS consumes motion context. The separate live headline runtime also resolves typed inputs before serialization and preserves custom keyframes; a runtime-plan test caught its previous silent 320px fallback. Hold sampling and timeline compilation receive the same references.

## Verification

Tests were written and observed failing before the policy and motion implementations. Real Chromium tests cover fixed geometry, whole multiline fit, impossible constraints, minimum conflicts, hidden members, auto-height, target-specific edits, and shared membership across target rules.

Scoped command: `npm test -- src/lib/text-fit-policy.test.ts src/lib/text-fit.test.ts src/lib/text-fit-rules.test.ts src/lib/fit-box.test.ts src/lib/motion-units.test.ts src/lib/creative-compiler.test.ts src/lib/animation-intents.test.ts src/lib/headline-motion.test.ts src/lib/hold-samples.test.ts src/server/__tests__/motion-export.test.ts`.

Most recent initial full-suite integration run: 427 passed, one real-browser package-export API test exceeded its previous 5s timeout. Root is adjusting that specific timeout. No source errors for new motion/policy files in `tsc --noEmit`; repository has pre-existing type errors elsewhere. Root owns final suite/build/parity verification.

The separate creative comparison failure was diagnosed as offers-2 728x90 offer-subline: authored variant top55,height blank,font15,maxLines1; ownership inherited shared height39 while emitted legacy fit-budget CSS uses17.25. This yields a false selection bottom99 versus actual CSS bottom77.25. Ownership agent is fixing effective resolution; no campaign edits are appropriate.

## Integration / limits

`creative-exporter.ts` has concurrent root-owned outline and ownership integration; omitted from this task commit so root can commit combined changes. Task 2 owns inspector/store integrations. Public helpers for headline skip rendering now accept optional motion context; consumers of newly authored relative values must supply it.

This task does not claim a general replacement of the legacy headline skip choreography or a migration of every existing fit into explicit policy. Existing campaigns remain on their authored compatibility path. Final production-stage browser review and standalone outlined-export parity are root-owned.

## Task 3 follow-up — effective controls and active membership

Corrected the earlier visibility-membership statement: supported production motion animates opacity/transform/layout, not CSS visibility/display. Explicit fitting now excludes nodes whose authored CSS state (or ancestor state) is visibility:hidden/display:none, and never filters opacity. Inactive offer slots therefore do not constrain one-offer copy; opacity-zero active headline acts retain shared membership. This uses the actual CSS cascade rather than inferring an offer count or naming specific slots. Legacy fitting paint is unchanged.

TextFitPolicyControls now receives `effectiveTextFitForTarget`, including family defaults, scopes and named target rules. It delegates final resolution to the exact engine `resolveRule` function; raw fit/provenance remain separate in the inspector. A scoped legacy clip/truncate mode is converted into independent overflow/sizing decisions after all rule overrides merge, so explicitly enabling shrinking works and remains selected. Inspector minimum-size editing follows effective sizing policy.

Behavioral tests observed failing first for effective shared-default display, inactive member exclusion, and scoped clip/truncate shrink. Final scoped run: 70 tests passed in five files (`text-fit-policy-controls`, `text-fit-policy`, `text-fit`, `text-fit-rules`, `creative-ownership`), including mounted React change-handler → authored document → effective runtime rule checks and actual Chromium fitting after the same document write. `git diff --check` passed.

## Task 3 follow-up — remove prior-row fitting state

Expanded package parity exposed an empty/state-hidden 160x600 node retaining the previous row's inline font size. The engine now restores its captured original inline fitting properties (including priorities and authored title) for every rule candidate at the start of `applyRules`, before scoped eligibility, empty text and visibility checks. It clears every fitting diagnostic attribute at that boundary. Styles are captured only when a node is actually fitted, so untouched inactive nodes remain untouched.

Observed three failing Chromium regressions before the fix: legacy shrink, legacy truncate, and explicit fixed-frame populated→blank/hidden nodes differed from fresh nodes with identical final CSS/text. All now match, including authored tracking/transform/title and absence of clipping diagnostics. Scoped run: 56 passed across `text-fit-policy`, `text-fit`, `text-fit-rules`, and `text-fit-policy-controls`. Root owns rerunning the expanded all-format/all-offer package comparison.
