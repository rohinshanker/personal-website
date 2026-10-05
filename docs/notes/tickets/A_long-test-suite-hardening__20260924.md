# A_long-test-suite-hardening__20260924 — Active

- Scope: Cut the Node suite from 65 s to seconds, make the browser CI job fast and honest (sharded, no retries, no wall-clock cadence assertions), consolidate the helpers specs bypass, and convert the most textual source tests to behaviour tests; refresh the 2026-07-31 backlog in `docs/validation/test-suite.md` with today's status.
- Status: active
- Opened: 2026-09-24
- Updated: 2026-10-04
- Current State: Selected for the next long-form task. Preparation is active on canonical `main` at `08a5b00`; implementation has not started. Owner chose browser-test gating for both site and Worker deployment and the recommended behavior-test conversion group (Game Stats, Administrator sign-in, Minesweeper, Solitaire victory). The Home module split has landed, so use the actual owning scripts and current fixtures rather than the historical `main.js` locations below. PR triggers and Node 24 alignment are already fixed; the separate linter decision does not block this ticket.
- Verification: `npm test` under 10 s locally with the slow tier moved to `npm run test:slow`; Browser UI workflow green with `retries: 0` on three consecutive `main` pushes; `tests/game-stats-deployment.test.mjs` workflow assertions updated; a test that asserts every `tests/ui/*.spec.mjs` imports the shared fixture rather than `@playwright/test` directly.
- Cleanup: Rewrite the inventory, snapshot, and backlog sections of `docs/validation/test-suite.md` and the CI section of `docs/validation/browser-visual-accessibility.md`, then delete this ticket and its index row.

## Decisions and refreshed baseline

- Decision (2026-10-04): Gate both site and Worker deployments on successful browser tests after sharding; preserve Worker-before-Pages release ordering.
- Decision (2026-10-04): Convert Game Stats, Administrator sign-in, Minesweeper, and Solitaire victory behavior checks. Keep meaningful copy, asset, wiring, and generated-reference invariants as literal checks. The separate linter decision remains outside scope.
- Preserve the complete 500-deal corpus in `test:slow` and CI; keep bounded representative coverage in the fast suite.
- Baseline at `08a5b00`: `npm test` passed 569/569 in 67.872 seconds. Current inventory: 84 Node files, 64 browser specs; 18 direct Playwright imports, 29 base-fixture imports, 17 diagnostic-fixture imports, 25 explicit waits, and 144 screenshot calls. These supersede the historical counts below.
- Reassess the historical backlog against current code. The Home script split, script-owner fixture routing, cache-token parity guard, Node 24, and main-only push triggers already landed; do not repeat completed work.

## Backlog status as of 2026-09-24 (`docs/validation/test-suite.md` items)

| Item | Status | Evidence |
| --- | --- | --- |
| P1.1 entry-point (`index.html`) tests | Partially done | Only cursor, favicon, accessibility, visual specs touch `/`; no Proceed/cancel/fallback/focus-restoration flow. |
| P1.2 core-game behaviour, Minesweeper first | Partially done | Solitaire/Snake/Sudoku have `*-publish-flow.spec.mjs`; the three Minesweeper specs have no win/publish coverage. |
| P1.3 client publishing decision table | Partially done | `tests/game-stats-session-failure.test.mjs` executes 12 extracted functions in 6 tests; no full status-code table. |
| P1.4 administrator-proof security | Partially done | Worker tests cover issue/expiry (`game-stats-worker.test.mjs:1889,1949`); none for wrong scope/version/profileId or malformed Bearer. |
| P1.5 app-window contract + real touch | Open | `hasTouch` appears once; no touch project in `playwright.config.mjs`. |
| P1.6 Firefox/WebKit smoke | Open | Only `ui` and `visual` Chromium projects. |
| P2.1 Worker HTTP negative tables | Open | `handleOptions`, 404, 405, 413 paths untested. |
| P2.6 secret-detector branches | Open | 4 tests. |
| P2.7 integrity-updater modes | Open | 1 test, no fixture-isolated write/error modes. |
| Repair: hermetic Playwright fixture | Partially done | `deterministic.mjs` and `helpers/rendered-site.mjs` exist; 8/53 specs use `deterministic.mjs`; 24 specs define a local `disableRemoteGameStats`; `solitaire-winnable-deals.spec.mjs:5` still hard-codes the production Worker URL. |
| Repair: stop CI retries hiding flakes | Open | `playwright.config.mjs:19` `retries: CI ? 2 : 0`; run 36067439520 reported `1 flaky`. |
| Repair: neko/carousel parallel failures | New flake found | Run 36062202604 failed after retries on `solitaire-auto-solve.spec.mjs:427` (`1553 < 1500` wall-clock) and `:308` (`boxShadow "" vs "none"`). |
| Repair: real local D1 in tests | Open | `MockD1Database` (`game-stats-worker.test.mjs:146`) still implements batch rollback itself. |
| Repair: release automation proof | Partially done | Workflow YAML parsed with `yaml`; no `node --check` in CI; `deploy-worker` needs only `verify`. |
| Repair: replace unbounded source regex | Open | See item 6 below. |
| Repair: remove `waitForTimeout` | Regressed | 18 call sites across 13 specs (3,500 ms at `minesweeper-number-preload.spec.mjs:68`; 2,100 ms at `admin-controls.spec.mjs:786`, `debug-fixture.spec.mjs:11`). |
| Repair: split monolithic cases | Open | 23 `test.setTimeout` ≥ 60 s (2×300 s, 2×240 s, 5×180 s); `video-editor.spec.mjs` is 3,620 lines / 27 tests with no shared fixture. |
| Repair: reduce `main.js` rewrites | Open | `fixtures.mjs` serves a rewritten `main.js` to all 28 importing specs. |
| Repair: reduce screenshot call sites | Regressed | 131 `.screenshot(` sites (37 in `video-editor.spec.mjs`, 12 in `game-stats-refresh-control.spec.mjs`). |
| Repair: coverage thresholds | Open | No `--experimental-test-coverage` anywhere. |
| Repair: refresh-review artifact | Open | `game-stats-refresh-review.spec.mjs` (4 tests) still targets the docs asset. |
| Repair: align CI Node versions | Partially done | Node 22 in two workflows, 24 in the release workflow. |
| Retire refresh-review spec, brand-burns spec, neko-avatar real waits | Open | All still present; `rohin-neko-avatar.spec.mjs:44,71` uses 850/1,025 ms real waits. |

## New items

1. **One file is the whole 65 s Node suite**: `node --test tests/solitaire-winnable-deals.test.mjs` alone takes 66.5 s; every other file is ≤ 0.9 s. Module-level `Array.from({length: 500}, …buildDeal(seededRandom(seed)))` at `:184` solves 500 deals before any test, then `:199` re-solves 500 fresh shuffles (25 s). Move the corpus to `npm run test:slow` (or cut to ~100 seeds with scaled thresholds) and keep one smoke seed in the fast suite.
2. **Browser CI runs 339 tests on 2 workers in ~21.5 min against a 30-min timeout** (run 36067439520, `Running 339 tests using 2 workers`, 22:27:45→22:49:31). Shard the `ui` job (matrix of three), set `workers` explicitly, convert cadence tests to `page.clock`, set `retries: 0` with `--reporter=github,html`.
3. **34 hard-pinned cache-token assertions across 19 test files** (`grep -rnE '\?v=' tests | grep -vE 'game-build|\[\^"\]|\$\{' | wc -l`). Replace with the single parity test from `O_small-cache-token-parity__20260924.md`, then delete the literals.
4. **Specs bypass shared helpers**: `helpers/rendered-site.mjs` exports `installOfflineGameStats`, `collectRuntimeDiagnostics`, `REVIEW_VIEWPORTS`, yet 24 specs define a local `disableRemoteGameStats` (74 references), 6 define `collectRuntimeErrors`, 45 define a local viewport list; 23 distinct viewport matrices exist (17 specs use exactly the four standard sizes; the rest add 36 other sizes, including `0x0` in `brand-burns-local-assets.spec.mjs`). Make `deterministic.mjs` the default import, delete local copies, export a `BREAKPOINT_PAIRS` helper for the ±1 px pairs.
5. **Slow and brittle specs**: the 18 `waitForTimeout` sites, the 23 long `test.setTimeout`s, the 131 screenshot sites, and the neko-avatar real waits. Replace waits with state assertions; keep only screenshots that feed a baseline or a documented review asset.
6. **Source-text assertions**: 2,376 of 3,931 Node assertions (60.4%) are `match`/`doesNotMatch`/`includes` on file text; 44 files read `main.js`; 34 files execute no production code. 90%+ textual: `game-stats.test.mjs` 61/63, `video-editor.test.mjs` 375/413, `minesweeper-stats-layout.test.mjs` 78/87, `gears-nest.test.mjs` 573/652 (88%), and fully textual `administrator-sign-in`, `death-note-visible-lines`, `dont-starve-copy`, `life-counter-unlit-digits`, `media-priority`, `minesweeper-face-alignment`, `minesweeper-number-preload`, `solitaire-victory-layout`. Behaviour-heavy exemplars: `game-stats-worker` (8% text), `game-stats-record-handoff` (0%), `game-stats-frontend-contract` (0%), `random-event-cooldown` (27%, 21 vm extractions). Per file, decide literal-invariant (keep, consolidate) vs behaviour (extract via the existing `new Function` seam or an ESM export). Which files is the owner's call; the mechanics are this ticket.
7. **`.wrangler/` local state is untracked and the root lockfile is complete** (verified: 3 devDependencies, `yaml` used by two tests). No action beyond the `engines` field in the hygiene ticket.
