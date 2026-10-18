# A_biome-quality-checks__20261007 — Active

- Scope: Add pinned Biome checks for authored code to local validation and CI, reporting formatting/import-order issues and code diagnostics.
- Status: active
- Opened: 2026-10-07
- Updated: 2026-10-18
- Current State: Baseline assessed 2026-10-17 on branch `claude/retry-feedback-biome-20261017`. `@biomejs/biome` 2.5.15 is pinned, `biome.json` scopes authored JS/CSS/JSON in the existing two-space double-quote style, and `npm run lint:biome` runs the check-only `biome ci .`. The gate is not wired into CI and the tree is not normalized: a Biome-clean tree needs a ~48,000-line formatting diff (see Baseline Assessment), so this stopped per the coordinator's instruction. The owner authorized the full pass on 2026-10-18 (formatting, import order, lint repairs, CI gate) on the condition that no code functionality is altered or lost; it runs in the main checkout as soon as the seeded-control ticket's branch is merged, before any other implementation starts.
- Verification: Retrieve current official configuration/CLI guidance, pin the development dependency, inspect the baseline, configure the existing code style and explicit vendor/generated exclusions, and resolve actual failures. Verify the real local/CI commands fail on a representative violation and pass on the final authored tree; run affected syntax/behavior/browser/visual/integrity/context gates for any code normalization and review the exact patch.
- Cleanup: Preserve only the reusable authored/generated/vendor scope and invocation contract in indexed quality-gate guidance, then resolve and delete this ticket/index row after acceptance.

## Baseline Assessment (2026-10-17, Biome 2.5.15)

Scope in `biome.json`: `**/*.{js,mjs,cjs,json,jsonc,css}` minus lockfiles,
`assets/**` (generated manifests), the vendored 98.css at `style.css` (its
custom-property arithmetic does not parse), the generated
`scripts/home/game-stats-backend.js` and
`workers/game-stats/src/issued-game-catalog.mjs`; HTML is left to the axe
suite. Formatter: two spaces, double quotes, line width 100 (default 80
reflows far more, 120 barely less). Recommended lint preset, import organizer
on, `.gitignore` honoured. 320 files are checked.

| Normalization needed for a clean `biome ci .` | Size | Shape |
| --- | --- | --- |
| Formatting, whole scope | 307 files, 48,201 insertions / 47,993 deletions | 62 Home, Video Editor and Modeling scripts (47,536 lines) are IIFEs whose body sits at column 0; Biome indents every line and has no option not to. |
| Formatting, excluding those IIFE files | 241 files, 11,218 / 10,314 | Tests 202 files / 9,400 lines (argument and chain wrapping, quoted keys), Workers 10 / 551, tooling scripts 16 / 330, CSS 11 / 662, docs scripts 2 / 275. |
| Import order | 78 files | Named-specifier sorting (`REVIEW_VIEWPORTS` before `installDelayed…`); side-effect imports keep their position, so runtime order is unaffected. |
| Lint errors in authored code | 146 | `useIterableCallbackReturn` 117 (forEach callbacks returning a value) in 46 files, `noAssignInExpressions` 16, CSS `noDuplicateProperties` 11 (including `styles/home/random-events.css` and `modeling/style.css`, owned by other in-flight work), `noUnsafeFinally` 1 (`game-stats.js` name reroll `finally` return), `noShadowRestrictedNames` 1. |
| Lint warnings | 576 | `noDescendingSpecificity` 246, `noUnusedVariables` 77, `noImportantStyles` 63, `noAdjacentSpacesInRegex` 58, `noUnusedFunctionParameters` 37, `useOptionalChain` 36, others; `biome ci` does not fail on warnings. |

Verified: `npm run lint:biome` fails on the current tree (every category
above is a real violation); the pass-on-clean-tree half of Verification is
unmet until the normalization lands. Plan for the dedicated pass: one commit
per shape (IIFE re-indent, test wrapping, import order, lint repairs) with
the full gate suite after each, then add `npm run lint:biome` to the release
workflow's verify job after `syntax:check`.

## Constraints

- Validation is check-only; a local explicit write action may fix issues during implementation. Do not let CI rewrite source, weaken existing tests or adopt a passing baseline that ignores authored-code failures.
- Preserve the established two-space/double-quote style, meaningful comments, runtime import order and upstream 98.css. Exclude genuine vendored/generated artifacts deliberately rather than reformatting or silently hand-editing them.
- Use current official [Biome guidance](https://biomejs.dev/installation/quick-start/). Owner approval covers this development dependency; inspection tooling needs no additional project dependencies.
- Keep measured performance/loading work separate if normalization is substantial. Preserve the unpublished verified-game work and published compatibility history. No push/deployment is authorized.
