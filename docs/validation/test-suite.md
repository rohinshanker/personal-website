# Automated Test Suite

Purpose: Define the repository's automated-test coverage contract and the
prioritized hardening backlog.

Scope: Source and contract tests, browser UI tests, the Game Stats Worker and
D1 boundary, generated artifacts, repository security checks, and CI wiring.

Last verified: 2026-07-31

## Priority scale

- **P0:** A current release blocker, destructive false positive, or exploitable
  safety gap. No P0 issue was found in the 2026-07-31 review.
- **P1:** A high-confidence gap that can let important production behavior ship
  broken or make CI results unreliable. Address before broadening the feature
  surface.
- **P2:** Material hardening or maintainability work for the next test-quality
  pass.
- **P3:** Cleanup that should follow stronger replacement coverage.

## Current inventory

| Layer | Files | Collected cases | Assessment |
| --- | ---: | ---: | --- |
| Node source, contract, and integration tests | 46 | 223 | Fast and broad, but dominated by source-text assertions that do not execute the large browser controllers. |
| Playwright UI tests | 31 | 159 | Strong responsive, focus, keyboard, Game Stats state, and publishing coverage on Home; incomplete entry-point, isolation, accessibility, touch, and cross-browser coverage. |
| Total | 77 | 382 | No skipped, focused, or TODO tests were checked in at review time. |

The Node suite divides into these responsibilities:

| Responsibility | Files | Cases |
| --- | ---: | ---: |
| Game Stats | 12 | 109 |
| Random events, Gears, and Neko | 9 | 57 |
| Core games, gameplay contracts, and layout | 11 | 17 |
| Admin, media, profile, and Game Progress | 11 | 33 |
| Integrity and secret protection | 3 | 7 |

The Playwright suite divides into these responsibilities:

| Responsibility | Files | Cases |
| --- | ---: | ---: |
| Portfolio, alerts, and utilities | 13 | 39 |
| Admin, profile, and Game Progress | 5 | 35 |
| Stats, ranking, and synchronization | 7 | 48 |
| Game controls and publishing | 6 | 37 |

## What the suite does well

- The Worker suite exercises origins, Turnstile basics, administrator sessions,
  idempotency, concurrent requests, rollback, D1 failures, validation, ranking,
  rate limits, and health behavior. The Worker module measures 95.04% lines,
  84.98% branches, and 98.18% functions under Node instrumentation.
- The deployment checker has deterministic fetch, clock, and sleeper coverage
  and measures 100% lines, branches, and functions.
- Executable record classification and handoff, Sudoku completion eligibility,
  weighted random-event cooldown/gameplay locks, and the Neko stream planner
  provide meaningful behavior-level protection.
- Browser coverage is especially strong for Game Stats loading, publishing,
  ready, timeout, retry, authentication, stale-build, empty, unranked, success,
  and rejection states.
- Responsive browser matrices are extensive: 27 specs include 375 x 812, 24
  include 768 x 1024, 29 include 1280 x 800, and 24 include 1440 x 900. Several
  short, landscape, and breakpoint-adjacent sizes are also covered.
- Browser tests use stable `data-*` hooks, contain no `force: true`, and include
  at least 70 focus assertions and 40 keyboard actions.
- Secret scanning, generated icon checks, Game Stats integrity checks, JavaScript
  syntax checks, and the Worker dry-run bundle gate provide useful release
  defense in depth.

## Verification snapshot

The 2026-07-31 review produced these results:

| Gate | Result |
| --- | --- |
| `npm test` | 223 passed, 0 failed. |
| Node instrumented coverage | 223 passed; loaded-module aggregate 95.92% lines, 88.13% branches, and 97.59% functions, subject to the exclusions below. |
| `npm run test:ui` with five workers | 157 passed, 2 failed. Both failed cases passed immediately when isolated with one worker, indicating unresolved parallel timing/state flakiness rather than a consistently reproducible product failure. |
| Neko isolation | `one shared runtime...` passed 1/1 in 15.6 seconds after the full run observed a zero-width canvas during image sampling. |
| Carousel isolation | `shared carousel inset...` passed 1/1 in 3.4 seconds after the full run observed a loading indicator after the image-complete assertion. |
| Secret scan | Passed across 3,168 checked files. |
| JavaScript/MJS syntax | Passed for every repository `.js` and `.mjs` file. |
| Game Stats integrity and generated icon manifest | Passed. |
| Worker dry-run bundle | Passed; 48.77 KiB total and 10.66 KiB gzip at review time. |
| Browser/Worker deployed parity | Correctly failed because the local browser hash `10a97e48...` and deployed Worker hash `f6d3...` differ. Release synchronization is owned by the separate open release-automation ticket. |
| `git diff --check` | Passed. |

Rendered inspection covered `index.html` at 375 x 812 and 1440 x 900, and
`home.html` at 375 x 812, 768 x 1024, 1280 x 800, and 1440 x 900. The entry
window and Home's initial About window stayed contained without document-level
horizontal overflow. Semantic snapshots exposed labelled entry controls,
desktop launchers, the About dialog, headings, regions, navigation, taskbar,
and controls. The entry route logged no console errors. A direct local Home
load made the configured production Game Stats request and logged two expected
local-origin CORS/resource errors; this is direct evidence for the hermetic
fixture requirement below. Automated axe coverage is not installed, so this
review does not claim a complete accessibility audit.

Rendered evidence is ephemeral under `.playwright-cli/`, including
`test-suite-home-{mobile,tablet,desktop,wide}.png`. Playwright failure
screenshots and traces are ephemeral under `test-results/`. No visual baseline
was added or changed.

## Coverage interpretation

Do not report the Node coverage aggregate as repository-wide coverage. The
reviewed run reported 95.92% lines, 88.13% branches, and 97.59% functions only
for modules loaded by Node. It omitted the 30,752-line
`scripts/home/main.js`, `scripts/home/admin-controls.js`, and
`scripts/home/core/media.js`.

This omission matters because 36 source-test files and 162 cases read
`scripts/home/main.js` without attributing execution coverage to it. Across the
Node suite, 1,580 of 2,576 assertion call sites (61.3%) are `match` or
`doesNotMatch` checks. Static checks remain appropriate for wiring, generated
references, forbidden secrets, and other literal contracts; they are not proof
that a state machine or user flow executes correctly.

## Required additions

### P1

1. **Test the production entry point.** All 152 product Playwright cases enter
   through `/home.html`; the remaining seven test a documentation artifact.
   None visits `index.html`, which owns loading completion, asset warmup,
   Proceed navigation, cancellation, Escape, focus restoration, and title-bar
   controls. Add deterministic mobile and desktop tests for success, fallback,
   cancellation, navigation, focus, runtime errors, and overflow.

2. **Add behavior-level coverage for the four core games, starting with
   Minesweeper.** Minesweeper currently has mobile-control and number-preload
   browser coverage but no real win/publish flow. Test first-click safety,
   adjacency and flood reveal, chord and mark transitions, difficulty, loss,
   reset, timer, win, exact-once event recording, queue/retry, and leaderboard
   refresh. Add executable move/session lifecycle tests for Solitaire and
   Snake, plus generation validity, uniqueness, clue targets, normalization,
   fallback, and history for Sudoku. Relevant production regions are
   `scripts/home/main.js:7537`, `scripts/home/main.js:18533`,
   `scripts/home/main.js:28894`, and `scripts/home/main.js:29505`.

3. **Execute the real Game Stats client publishing decision table.** Existing
   failure harnesses replace the transport functions and therefore cannot
   prove timeout, abort, header, parser, or response-mapping behavior in
   `scripts/home/main.js:1632`, `scripts/home/main.js:1688`, and
   `scripts/home/main.js:2782`. Table-test corrupted storage, storage
   exceptions, queue limits, reload, timeout/external abort, malformed JSON,
   ordinary and protected 403, 400, 408, 425, 429, 5xx/network failures,
   expired sessions, refresh failures, and profile changes. Assert exact
   retain/drop/authentication/status/persistence outcomes.

4. **Complete administrator-proof security coverage.** The Worker tests cover
   missing, valid, and tampered proofs around
   `workers/game-stats/src/index.mjs:1075`, but not expired proof, wrong IP,
   scope, version or profile ID, malformed/missing Bearer tokens, wrong
   protected name/icon, or incomplete administrator configuration. Every
   rejection must assert zero event inserts and zero session consumption.

5. **Add a generic app-window contract and real touch smoke.** Exercise every
   desktop/taskbar launcher through public controls and verify open, close,
   Escape, focus placement/restoration, accessible naming, and responsive
   containment. Study Resources, Credits, and Clash Royale currently have no
   direct UI references. Add at least one `hasTouch` mobile project with real
   taps; resized desktop Chromium is not mobile-input coverage.

6. **Add automated accessibility scanning.** Keep the existing semantic and
   focus assertions, then add a small axe matrix for `index.html`, Home,
   dialogs, game windows, and representative loading, empty, failure, and
   success states. Add focused focus-trap checks and a small Firefox/WebKit
   smoke matrix.

### P2

1. Add Worker HTTP/config negative tables for preflight, OPTIONS, 404, malformed
   and oversized JSON, missing D1/security configuration, ingress validation,
   Turnstile network/HTTP/JSON/hostname/action failure, event rate limits, and
   exact window/session expiry boundaries. Include non-ASCII and chunked bodies
   when validating the intended 4,096-byte request limit.
2. Exercise the real Admin controller state machine in
   `scripts/home/admin-controls.js`, including storage failure, one-shot,
   repeat, random, and sequence bindings, target identity, countdown
   cancellation, take stop/reset, privacy/media restoration, observers, and
   cleanup. Complete the rendered Admin matrix for Clear Admin Data,
   search/filter and blocked explanations, random-eligible binding, cue
   Previous/Next, countdown completion, pause-natural-events, and toggle
   restoration.
3. Add the profile-name provider's timeout, non-OK, invalid, empty, insufficient
   data, loading, retry, and reroll-preservation states. Add carousel/media and
   Clash Royale loading, failure, and empty-state coverage.
4. Add rejection and callback-throw cases for deferred random-event preloading;
   verify `pending` cleanup and absence of unhandled rejections. Expand Gears
   executable coverage beyond source regex to active, completed, no-enemy,
   hazard, cooldown, fallback, and combat-completion states.
5. Execute `scripts/home/core/media.js` for ordering, cancellation, continuation
   after error, deduplication, caching, retry, and deferred events.
6. Complete secret-detector branch tests for AWS, GitLab, Slack, npm, Stripe,
   OpenAI, and Bearer formats, placeholder/boundary cases, binary files,
   traversal defense, and filesystem/Git failures.
7. Test the integrity updater's check, mutation, write, and error modes against
   isolated fixtures. Add injected-clock coverage for Feliz Jueves on and off
   Thursday, once per local day, and storage failure.

## Required repairs

### P1

1. **Create one hermetic Playwright fixture.** Fourteen Home cases can use the
   configured live Game Stats backend, three specs intercept a hard-coded
   production Worker URL, at least 49 of 159 cases lack complete console plus
   `pageerror` collection, and only three specs inspect `requestfailed`.
   Centralize offline Game Stats configuration, outbound-network denial with
   narrow allowlists, random-event suppression, clean storage, console/page/
   request diagnostics, and explicit allowlists for intentional failures.

2. **Make Playwright own and validate its server.** The fixed port and
   `reuseExistingServer: !CI` in `playwright.config.mjs` can reuse a stale or
   unrelated site and can invalidate a running suite if that process exits.
   Use an environment-selectable port, prefer a test-owned server, verify the
   served checkout, and expose server output on startup failure.

3. **Tighten CI subset and flake safety.** Add
   `forbidOnly: !!process.env.CI`. CI currently retries twice, which can hide
   intermittent failure; fail the build on flaky tests or report and gate them
   explicitly. Add workflow timeouts and cancellation of superseded runs.

4. **Stabilize the two observed parallel failures.** In
   `tests/ui/neko-stream.spec.mjs`, `readNekoPoseMetrics` can call
   `getImageData` with a zero-width source while forty animated sprites settle.
   Wait for non-zero decoded sprite dimensions before sampling. In
   `tests/ui/shared-carousel-spacing.spec.mjs`, the image-complete predicate can
   win a race with loading-indicator removal after viewport and carousel
   changes; poll the complete UI state rather than only image dimensions. Both
   cases pass alone, so validate the repairs with retries disabled and the full
   five-worker matrix.

5. **Run migrations against an actual local D1 runtime.** The bespoke MockD1
   serializes batches and implements rollback itself, so concurrency and
   atomicity cases can pass independently of production SQL or D1 semantics.
   Apply both files in `workers/game-stats/migrations/` to isolated local D1,
   then test schema, roundtrip, rollback at each statement, idempotent replay,
   concurrent single-session consumption, rate-window writes, and health.

6. **Make release automation prove deployment safety.** Parse or lint workflow
   YAML instead of regex-matching raw text. Add full-entry JavaScript syntax to
   the release gate, and require focused publishing UI/full UI success before
   production mutation or document and verify equivalent branch protection.
   The Worker workflow must also be tracked and proven by an actual Actions
   run before its source test is treated as production evidence.

7. **Replace critical unbounded source regex with executable behavior tests.**
   Highest-risk examples are `tests/game-stats.test.mjs`,
   `tests/administrator-sign-in.test.mjs`, and `tests/gears-nest.test.mjs`.
   Extract small importable state machines from browser controllers, test their
   public contracts, and reserve source checks for genuine literal invariants.

### P2

1. Replace all 14 `waitForTimeout` calls with Playwright Clock, deferred gates,
   animation events, or state polling. The highest-cost waits are 3.5 seconds
   in `minesweeper-number-preload.spec.mjs`, 2.1 seconds in
   `admin-controls.spec.mjs`, 850/1,025 ms animation waits in
   `rohin-neko-avatar.spec.mjs`, and resize waits in
   `relic-recovery-scaling.spec.mjs`.
2. Split 120-300 second monolithic UI cases so one late assertion does not
   rerun an entire viewport/state matrix. Consolidate repeated viewport lists,
   fourteen `disableRemoteGameStats` copies, seven runtime collectors, six
   backend installers, and duplicate API builders into shared support modules.
3. Reduce test-time rewrites of `scripts/home/main.js`, direct window unhiding,
   and programmatic `element.click()` calls. Keep narrow setup seams where
   necessary, but use public controls and Playwright actionability for usability
   claims.
4. Choose an intentional visual-artifact policy. There are 57 unconditional
   screenshot call sites, zero `toHaveScreenshot` assertions, and only seven
   explicit attachments. Retain a small reviewed evidence set or add reviewed
   visual baselines; rely on failure screenshots/traces for the rest.
5. Add meaningful production-module coverage thresholds after logic is
   extractable. Never gate on the current aggregate while the main browser
   controllers are absent.
6. Replace the 10 ms real-clock Snake fallback test with an injected clock and
   sleeper; assert the requested delay and post-wait eligibility recheck.
7. Generate or compare the refresh-review artifact from the production Game
   Stats state contract. Its separate hard-coded contract can drift together
   with its tests while Home regresses.
8. Centralize cache-version integrity around entry-point parity or content
   hashes rather than duplicating historical date tokens across feature tests.
9. Align CI Node versions and give workflows and artifacts names matching the
   full suite rather than the historical Game Progress-only label.

## Retire or consolidate after replacement coverage

1. **P1:** Replace the seven `game-stats-refresh-review.spec.mjs` cases that test
   only `docs/validation/assets/game-stats-refresh-review.html` with assertions
   driven through the real Home UI. Keep the page only as a manual review aid if
   it remains useful.
2. **P2:** Move `brand-burns-local-assets.spec.mjs` to a static asset-integrity
   test plus one real Brand Burns event UI check. It currently loads files but
   never proves they are wired into the event.
3. **P2:** Move the synthetic-body portion of `rohin-neko-avatar.spec.mjs` to a
   unit test and retain the real Game Progress avatar integration with fake
   time.
4. **P3:** Product tests must not assert the lifecycle filename/status of an
   unrelated planning ticket. `tests/context-system.test.mjs` owns ticket/index
   structure.
5. **P3:** Shrink duplicate static Game Stats handoff assertions after the
   stronger executable record-handoff suite owns the behavior.
6. **P3:** Retire implementation-history assertions, such as old Gears assets,
   old static-export absences, exact truncation syntax, and global literal
   counts, only after their intended behavior has executable protection.
7. **P3:** Consolidate repeated Solitaire/Sudoku leaderboard fixtures and
   assertions while retaining each unique rank, placeholder, digit, and
   containment edge case.

## Verification contract

Run the smallest affected tests while developing, then complete these gates
before release:

```bash
npm test
npm run test:ui
node scripts/check-no-secrets.mjs
node scripts/update-game-integrity.mjs --check
node scripts/build-app-icon-manifest.mjs --check
npm --prefix workers/game-stats run deploy:check
git diff --check
```

Run `node --check` against every JavaScript and MJS entry point. Run
`npm run game-stats:deployment:local-check` when browser and deployed Worker
build parity is expected; a mismatch is a release-state failure, not a unit-test
failure.

For UI changes, inspect the real route and applicable states at 375 x 812,
768 x 1024, 1280 x 800, and 1440 x 900, plus nearby meaningful breakpoints.
Check screenshots and semantic state, keyboard/focus behavior, overflow,
console errors, page exceptions, and unexpected failed requests. Current
Playwright screenshots and traces are ephemeral under `test-results/` and are
not visual baselines.
