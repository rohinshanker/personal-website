# Automated Test Suite

- Purpose: Define test coverage, isolation, timing, and release acceptance contracts.
- Scope: Node behavior and source contracts, browser UI, Game Stats and Clash Royale Workers, generated artifacts, security, and CI.
- Last verified: 2026-10-07

## Test tiers

| Tier | Command | Contract |
| --- | --- | --- |
| Fast Node | `npm test` | Root `tests/*.test.mjs`: executable behavior, Worker/security/deployment tests, and meaningful literal contracts. Target less than ten seconds locally; never import the statistical corpus. |
| Slow Node | `npm run test:slow` | Full 500-seed Solitaire corpus, independent winning-path replay, solver success thresholds, diversity, and shuffle-distribution checks. Required in CI before deployment. |
| Browser | `npm run test:ui` | Real routes, responsive geometry, public controls, focus, keyboard, publishing, lifecycle, and accessibility. Zero retries. |
| Visual | `npm run test:visual` | Curated committed snapshots compared in the pinned Linux/arm64 container. Inspect diffs; never generate passing baselines automatically in CI. |

`tests/helpers/solitaire-deals.mjs` loads the actual Solitaire deal/solver
functions and supplies an independent legal-move replay. The fast tier verifies
a representative complete deal, winning replay, determinism, and bounded
fallback. The slow tier retains the complete population and original success
thresholds; moving a corpus must not reduce it or silently skip it.

## Source and behavior coverage

Home tests locate the owning scripts through `tests/helpers/home-scripts.mjs`.
The boot entry is not a concatenated runtime. Contract tests verify ordered
script membership, exports, dependencies, game-build inputs, and generated
references. Behavior tests execute the actual production implementation through
a focused VM/function seam; browser tests drive the real UI.

Keep literal tests for wiring, required copy, forbidden secrets, generated
references, and compatibility limits. Exercise state transitions, side effects,
error mapping, timing, and DOM geometry through execution. A CSS or function-body
regex does not prove the browser behaves correctly. Cache-token consistency
belongs to `tests/entry-point-cache-tokens.test.mjs` and build-integrity checks;
feature tests check asset wiring without duplicating historical version strings.

| Area | Coverage contract |
| --- | --- |
| Game Stats client | Session creation, classification, record handoff, queue/persistence, protected publishing, refresh/authentication/status transitions, and browser publishing flows. |
| Workers and D1 | Origins, validation, proofs, expiry, idempotency, concurrent consumption, rollback/failure, SQL aggregation/ranking, freshness, rate limits, and deployment compatibility. |
| Core games | Legal controls, lifecycle, completion/loss, exact-once recording, publishing, timer/history, generation, and responsive presentation. Keep game-specific rules visible in tests. |
| Administrator sign-in | Credential submission, current/expired proof, deferred completion-dialog authentication, stacking/focus, profile reset, and protected queue retention. |
| Random events and media | Scheduling eligibility, weighted cooldowns, active-window contracts, registration/cleanup, decoded media, and hidden-window playback. |
| Routes and assets | Entry, Home, Modeling, Video Editor, exact-case asset existence, metadata, shared references, generated manifests, and packaging. |

A coverage percentage describes only loaded modules. Node does not cover
browser controllers merely because it reads their source or because they are
split into separate files. Add meaningful thresholds only for executable
production modules, with branch/error cases and explicit exclusions.

## Browser fixtures and timing

All specs import `tests/ui/deterministic.mjs`; shared support belongs in
`tests/ui/helpers/`. Use `REVIEW_VIEWPORTS` for 375×812, 768×1024, 1280×800, and
1440×900, plus meaningful breakpoint pairs. Keep unique sizes only when their
behavior is actually asserted. The source-import contract prevents new specs
from bypassing the shared diagnostics and isolation.

The fixture installs the generated Game Stats configuration with an empty API
base URL, pinned Sudoku worker randomness, production debug flags, and the
local Sky generator response on the browser context. Popup pages inherit these
routes. Backend scenarios opt in with
`installGameStatsBackend(target, { apiBaseUrl, buildVersion })`; its default
build version comes from the generated configuration. Do not duplicate the
configuration reader or hard-code a historical build hash in a scenario.

Preserve intentional backend-mock scenarios while preventing accidental
production calls. A test must supply its own local/mock publishing responses;
a configured production URL is not a test backend. Attach diagnostics to the browser context before any page navigates, then
assert console, runtime, delivery, and HTTP errors during teardown. This includes
a popup's first navigation; attaching listeners after its `page` event misses
those early network failures. Only exact `net::ERR_ABORTED` cancellation is
excluded. Expected synthetic failures need exact assertions and narrow cleanup
with `consumeDiagnostics`; every unconsumed entry still fails teardown.

Default local mocks use `servedFile(path)` and answer only on
`TEST_SERVER_ORIGIN`, derived from the same configuration as Playwright. A matching
path on another host or port must be blocked. `KNOWN_REMOTE_EMBEDS` lists exact
remote origins, paths, and request kinds; adding a URL to product source does not
automatically approve it. The Sky generator stand-in matches its exact endpoint
and generator query. A later explicit scenario route can supply its controlled
response. Do not filter a whole endpoint, origin, or error category to obtain
green tests.

Negative diagnostic probes assert the exact captured failure before calling
`test.fail()`. The expected failure must come from automatic teardown. If the
collector stops observing the error, the body assertion must remain an ordinary
failure; if enforcement is removed, the probe must become an unexpected pass.
Marking the whole probe as expected to fail can conceal either regression.

Advance controlled timer behavior with Playwright Clock. Use visibility,
classes, animation completion, request completion, or state polling for async
UI work. Avoid `waitForTimeout` and elapsed wall-clock cadence limits. A frozen
`Date` does not pause intervals or finish image decoding.

Before advancing time past a mocked session expiry, await and assert the browser's
normalized session state. Completing `route.fulfill()` confirms transport handling;
it does not establish that the application has consumed and validated the response.

For Node eligibility tests, advance the existing controlled clock from a mocked
timer callback and assert the scheduled delay. A real timer can wake before the
exact wall-clock deadline; sleeping for that delay does not establish eligibility.
Keep the production timing rules unchanged and restore timer mocks after each test.

Keep screenshots for reviewed visual baselines or documented review evidence.
Automatic failure screenshots and traces cover routine failure diagnosis.
Independent tests own their browser/storage/mocks and output paths so
`fullyParallel` remains safe; do not reuse a shared screenshot filename or a
production player profile across concurrent cases.

## CI and deployment

`game-stats-worker-release.yml` owns PR, main-push, and manual release runs.
Its `browser` job calls `ui-layout.yml` at the same commit. The latter has only
`workflow_call`, so a push or PR does not launch duplicate browser suites.

The UI job runs three shards, two workers per shard, with `fail-fast: false` and
`retries: 0`. Tests are individually parallelizable. Each shard uploads a
separate trace/failure-media/HTML-report artifact; the visual job runs in the
pinned ARM container. A failed shard remains a failure instead of being hidden
by a retry.

The first mutation, `deploy-worker`, requires `verify`, `slow`, and `browser`
to succeed, including every browser shard and the visual job. Pages packaging
then depends on the compatible Worker transition, and Pages deployment depends
on packaging. Preserve this ordering, main-only deployment, superseded-revision
checks, scoped permissions, and secret checks. Never add `always()` to a
mutation job to bypass a failed dependency.

Local workflow-contract tests verify configuration, not execution by GitHub.
Confirm the changed release graph and no-retry suite in real Actions runs;
three consecutive successful main runs provide the stability acceptance
signal. Do not manufacture unrelated pushes to create that signal.

## Repeatable validation

Use focused tests while editing, then run the final affected matrix:

```bash
npm test
npm run test:slow
npm run syntax:check
npm run test:ui
npm run test:visual
node scripts/check-no-secrets.mjs
npm run game-stats:integrity:check
npm run app-icons:check
npm run study-resources:check
npm run media:check
git diff --check
```

Run `npm --prefix workers/game-stats run deploy:check` for Worker/config changes.
Run `npm run game-stats:deployment:local-check` when checking build compatibility;
a deployed-build mismatch is release state, not a unit-test failure.

To reproduce an individual CI shard locally, assign a unique port/output path:

```bash
CI=1 UI_TEST_PORT=4281 UI_TEST_OUTPUT_DIR=test-results/shard-1 \
  PLAYWRIGHT_HTML_REPORT=test-results/shard-1/report \
  npm run test:ui -- --shard=1/3 --workers=2
```

Run shards 2/3 and 3/3 with their own ports, output paths, and HTML report directories when running concurrently.

Run the pinned visual container after the local UI shards finish. Concurrent
host browser shards can slow the container's local asset delivery enough to hit
navigation or image-settling timeouts. Preserve traces and rerun in isolation to
test resource contention before changing timeouts or baselines. CI jobs use
separate runners.
For UI changes, inspect screenshots and semantic state from the actual routes
at the four review sizes and relevant breakpoints. Check keyboard/focus,
overflow, hidden controls, console errors, exceptions, and failed requests.
Keep transient reports under ignored `test-results/`, `playwright-report/`, or
`.playwright-cli/`; the committed visual baselines are durable.

### Layout and lifecycle repair guidance

- Locate the unique visible control before reading its nearest frame. Hidden
  duplicates can make a generic descendant measure the wrong geometry.
- Wait for opening/closing animations to finish before exact rectangle checks.
  If production branches on `animationName`, use a matching `AnimationEvent`.
- Check computed opacity for elements that fade while staying in the layout.
  [Playwright visibility](https://playwright.dev/docs/actionability#visible)
  treats `opacity: 0` as visible; a bounding-box assertion does not prove that
  the visitor can see an element.
- Wait for non-zero decoded sprite dimensions before canvas sampling. Image
  completion alone does not guarantee a carousel's loading state has settled.
- The Python test server does not serve byte ranges. For a later video frame,
  wait for presented playback progress and pause it; do not assume assigning
  `currentTime` successfully seeks. Assert actual canvas pixels before keeping
  a decoded-media screenshot.
- Read timer-sensitive state atomically under a paused clock; polling followed
  by a separate read can race with a scheduled mutation.
- Classify failures as product, test, data, or environment problems. Preserve
  diagnostic evidence, repair the smallest cause, rerender, and retest. Never
  raise timeouts or update snapshots as the first response to a failure.

## Coverage limits

- Chromium is the automated browser target; resized desktop coverage is not
  real touch or Firefox/WebKit coverage.
- SQLite-backed D1 tests execute SQL, but the adapter does not prove the deployed
  Cloudflare runtime's scheduling or concurrency semantics.
- Behavior conversion is focused on Game Stats, Administrator sign-in,
  Minesweeper, and Solitaire victory. Other source-heavy controllers, including
  Gears and Video Editor, still need execution coverage for additional paths.
- Entry navigation/cancellation, generic app-window focus restoration, full
  client HTTP-status tables, updater mutation/error fixtures, and uncommon
  security/configuration branches need domain-specific coverage beyond general
  boot and source checks.
- Axe checks the driven states and retains the exact pre-existing Solitaire
  nested-interactive exception. It is not a complete accessibility audit; see
  [browser-visual-accessibility.md](browser-visual-accessibility.md).
