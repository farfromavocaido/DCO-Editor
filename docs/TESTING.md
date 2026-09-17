# Tests protect behaviour, not art direction

The default suite must not fail because a designer changes campaign copy, a font weight, a box position, a maximum line count or an animation duration. It must fail when the editor changes the wrong element, loses data, fails to apply authored settings, or exports something different from the production preview.

## Commands and responsibilities

| Command | Responsibility | Browser needed? |
|---|---|---|
| `npm test` | All engine, compatibility, component and export contracts; the CI gate | Chromium for the rendering suites |
| `npm run test:unit` | Fast calculations, state/ownership, component interactions, filesystem/API contracts that do not launch a browser | No |
| `npm run test:browser` | Text fitting, measured layout, dynamic feeds, font/outline parity, delivery and snapshot contracts | Yes |
| `npm run test:creative` | Opt-in comparisons against the current campaign's art direction | Some checks |
| `npm run test:parity -- http://localhost:5174` | Independent exported embed versus the running editor | Yes |
| `npm run test:parity -- http://localhost:5174 agency` | The same check using canonical agency delivery | Yes |

`npm run setup:browser` installs the local test browser. CI installs Chromium and its Linux dependencies before running tests. This is a build/test dependency, not something shipped inside an ad. The default worker cap is two to avoid running many browser exports concurrently on small CI machines.

## Test inputs

1. **Small explicit fixtures** are preferred for new engine tests. Put the relevant values in the test so the relationship being tested is visible. Test several legal values when there is no single correct artistic choice.
2. **Fixed compatibility documents** live in `src/test/fixtures/campaign/`. They exercise older SSE conventions and real document complexity. They are test inputs, not approved art or a template for new campaigns. Do not regenerate them when editing an ad.
3. **Current campaign documents** belong only to `*.creative.test.ts`. These are outside the publishing gate. A changed art-direction expectation requires human review, not a production-code change just to make a test pass.

The default storage setup copies fixture JSON and required binary assets into a unique temporary directory for each suite. Save/export tests call the real implementations against those paths. No test may restore backups over the working `campaign/`, `output/` or `outputs/` directories. The storage-isolation test deliberately reads the working JSON only to verify it is unchanged after a test save.

Binary fonts and image/SVG resources are still copied from the repository assets. That is an explicit resource dependency; the tests no longer consume current campaign layout/copy/font-selection JSON. New fixture assets should be test-owned when they do not need to exercise legacy asset compatibility.

## Assertions to write

- “The edited element moved by the requested delta; peers and other versions stayed unchanged.”
- “The output uses the supplied font family, weight and asset URL.”
- “Bottom-aligned ink remains anchored when line count or copy changes.”
- “The linked transition derives its interval from the selected clip and offsets.”
- “Duration and looping follow authored values”, exercised with different durations and loop choices.
- “Undo restores the pre-edit document; exports do not mutate it.”
- “The delivered runtime and editor function produce the same measured layout.”

Numbers are useful in controlled fixtures. For example, an explicitly supplied 100px box should produce a 100px selection. What is inappropriate is reading today's approved campaign and declaring that its box must always remain 100px.

## Assertions to avoid

Do not match source-file text, helper names, declaration order or exact CSS whitespace to prove behaviour. Render a component, execute serialized runtime code, inspect the relevant output declaration, or compare measured results. Checking external protocol fields, package filenames, required metadata and safe URL handling remains appropriate.

Do not disable a failing behavioural test simply because the art changed. First remove its dependency on mutable campaign data. Preserve contracts around missing assets, invalid ownership, stale snapshots, asynchronous rendering and export validation.

## Cleanup record

- Isolated normal tests from editable campaign JSON, including API/export tests and direct imports.
- Kept the existing creative lane and moved remaining scrim, blur and pricing-art assertions into it.
- Replaced inspector source-order checks with component rendering and drill-in interaction.
- Replaced selector/source spelling checks with computed hit-testing and executable QA seeking.
- Removed the duplicate QA source-grep suite; actual shell caching and seek behaviour remain covered.
- Runs the offer-layout geometry contracts against both the editor function and serialized delivery function; removed helper-name/regex-spelling checks.
- Replaced fixed campaign box sizes and a fixed 15-second loop expectation with explicitly authored value variations.
- Font export assertions check declarations and asset selection, not CSS formatting or an obsolete local-font workaround.
- Outline test fixtures supply all their registered fonts, rather than depending on a particular weight remaining the only one.

This is not a Google Ads certification suite. Platform upload validation and a review of the actual published campaign remain separate release checks. The default suite does protect the rendering and export behaviour used to produce those files.
