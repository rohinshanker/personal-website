# Visual Baselines and Accessibility Scanning

- Purpose: Run and maintain browser screenshot baselines and WCAG scans.
- Scope: Browser test projects, isolated containers, fixtures, and known accessibility limitations.
- Last verified: 2026-09-09

## Playwright projects

| Project | Contents | Runs where |
| --- | --- | --- |
| `ui` | Every spec except the visual baselines, including `tests/ui/accessibility.spec.mjs`. | Any platform. |
| `visual` | `tests/ui/visual-baselines.spec.mjs` only. | The pinned container only. |

```bash
npm run test:ui                  # the ui project
npm run test:ui:accessibility    # only the axe matrix
npm run test:visual              # compare against committed baselines
npm run test:visual:update       # regenerate baselines, then inspect them
```

Scope work while iterating (`npx playwright test --project=ui <spec> -g "<title>"`),
then run the full `ui` project plus `npm run test:visual` before handing off.
`tests/ui/helpers/rendered-site.mjs` supplies the deterministic setup every new
spec should reuse: a fixed clock, an offline Game Stats backend, suppressed
random events, cleared storage, and a decoded-render wait.

## Server port and artifact directory

`playwright.config.mjs` resolves both from the environment through
`tests/ui/server-config.mjs`, so two worktrees can run browser suites at once:

| Variable | Default | Effect |
| --- | --- | --- |
| `UI_TEST_PORT` | `4173` | Port the suite serves this checkout on. |
| `UI_TEST_OUTPUT_DIR` | `test-results` | Traces and failure media. |
| `UI_TEST_SERVER_LOGS` | unset | `1` pipes the static server's stderr. |

**The suite always starts and owns its own server.** A responding URL does not
establish which checkout is behind it, and matching a couple of HTML files
would still not prove it for a CSS- or JS-only change — the exact case visual
baselines exist for. So `reuseExistingServer` is `false` with no opt-in: an
occupied port fails the run. Give each concurrent worktree its own
`UI_TEST_PORT` rather than sharing one.

To identify a listener manually on macOS:

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN -t
lsof -a -p <pid> -d cwd -Fn
```

`UI_TEST_OUTPUT_DIR` must be `test-results` or a directory beneath it, such as
`test-results/dem-123`. Paths are normalized and checked before Playwright
clears them. This keeps artifacts ignored and prevents a typo from targeting
source directories. The container writes these files back to the checkout.

## Visual baselines

Baselines live in
`tests/ui/__screenshots__/{platform}-{arch}/{project}/{name}.png` and only
`linux-arm64` is committed. `scripts/run-visual-tests.mjs` always renders inside
`mcr.microsoft.com/playwright:v<version>-noble`, reading `<version>` from
`package-lock.json` so the browser build can never drift from the lockfile, on
`linux/arm64`.

`linux/arm64` runs natively on Apple Silicon. CI runs the same container on
`ubuntu-24.04-arm`. Changing the platform means regenerating every baseline and
changing the CI runner in the same commit; the architecture is part of the
snapshot path, so a mismatch reports a missing baseline instead of an
unexplainable pixel diff.

Each invocation mounts a fresh anonymous volume over `/repo/node_modules` and
runs `npm ci` from the lockfile. The volume is removed with the container.
Parallel worktrees therefore share neither host dependencies nor a writable
installation cache.

Docker must be running. Set `UI_VISUAL_PLATFORM` only when deliberately
regenerating the whole set for a different platform.

`tests/visual-baseline-runner.test.mjs` covers the wrapper's failure paths —
image pinning, per-run isolation, rejected artifact directories, positional
passthrough — and parses the workflow to prove CI actually gates on the visual
project and runs it on a matching runner.

### Regenerating

1. Confirm the rendered change is intended: run the affected route in a real
   browser and inspect it, not just the diff.
2. `npm run test:visual:update`.
3. Open every regenerated PNG and confirm the whole image, not only the region
   you changed. Check the other viewports, the frozen clock and date, missing
   assets, clipping, and overflow.
4. Re-run `npm run test:visual` twice to prove the new baseline is stable.

Never regenerate a baseline as the first response to an unexplained failure.
On failure Playwright writes `-expected`, `-actual`, and `-diff` PNGs to the
artifact directory; read the diff before deciding anything.

### Non-deterministic regions

The Neko launcher swaps sprites on a `setInterval`; a fixed `Date` does not
pause that timer, so the Home desktop shots mask `[data-neko-sleeping-cat]`. A
mask still compares the element's position and size. Prefer masking a genuinely
animated element over loosening the pixel threshold; do not mask to hide a
defect.

## Accessibility scanning

`tests/ui/accessibility.spec.mjs` runs `@axe-core/playwright` against the whole
rendered document with the `wcag2a`, `wcag2aa`, `wcag21a`, and `wcag21aa` tags.
No rule is disabled and no selector is excluded. It covers the entry route
while loading and when ready at mobile and desktop, the entry alert dialog, the
About window, the Home desktop at mobile and desktop, and the Minesweeper,
Sudoku, Solitaire, Snake, Game Progress, Credits, Socials, and Projects
windows. Each scan writes its full violation report to
`<artifact dir>/<test>/axe-<state>.json`.

Each state asserts an **exact** violation list rather than "no new violations",
so both a new defect and a repaired one fail the suite until the record is
updated. Record a limitation only when repairing it is a real redesign, and
record the exact nodes.

Axe reaches only the states the spec drives to, so a window that boots through
a loading screen must be driven to its content state first —
`openSudokuBoard` exists because Sudoku renders its board only after Play.
Elements that are never in the DOM during a scan need their own assertion; the
progress-bar name checks cover the loading meters that axe would otherwise miss.

### Expected limitations

- **Solitaire nested interactive content.** `#sol-stock` and the seven
  `[data-sol-col]` tableau columns are keyboard controls that contain the
  individually clickable card buttons. Removing the nesting means redesigning
  Solitaire's keyboard model. Recorded exactly in the spec.
- Automated scanning is not an audit. It cannot judge whether an accessible
  name is *useful*, whether focus order is sensible, or whether a live region
  announces at the right moment. Keep the suite's existing focus and keyboard
  assertions.
- Windows behind authentication (Admin, Video Editor) are outside this matrix.

### Repairs this contract depends on

These are live behaviour, not lint fixes; changing them back reopens a
violation:

- `home.html` must not set `user-scalable=no` or `maximum-scale`, and
  `styles/home/base.css` must keep `touch-action: manipulation` on `html` and
  `body`. Restoring `pan-x pan-y` blocks pinch zoom again even with the meta
  tag fixed, which the meta-tag rule alone would not catch.
- Every `role="progressbar"` needs an `aria-label` or `aria-labelledby`.
- `role="grid"` containers expose their cells through `role="row"` wrappers.
  `.ms-row` and `.sudoku-row` are `display: contents`, which keeps a single CSS
  grid of cells; a row wrapper that generates a box would break both boards.
- `aria-label` is prohibited on a plain `span`. The About degree fields carry
  their text in the accessibility tree instead.

## Runtime diagnostics

`tests/ui/deterministic.mjs` is the fixture the new specs import. It attaches
console, `pageerror`, `requestfailed`, and response listeners once per page and
**fails the test afterwards** if anything was reported — collecting diagnostics
without asserting on them lets a silent page error pass a green suite.
`tests/ui/runtime-diagnostics.spec.mjs` proves the failure path for an injected
exception, console error, delivery failure, and 404, and proves listeners do
not stack when a spec navigates twice.

`net::ERR_ABORTED` is excluded: it is the page cancelling its own request, such
as an animated icon swapping `src` or a `<video>` torn down with its window.
Real delivery failures and any response of 400 or more are reported. A spec
that deliberately provokes a failure should clear the entries it expects.

## Rendered evidence

Everything under `test-results/` and `.playwright-cli/` is ephemeral and
gitignored. Committed baselines under `tests/ui/__screenshots__/` are the only
durable render evidence.

The deterministic fixture asserts console errors, page exceptions, failed
delivery and HTTP error responses during teardown. Browser cancellation
(`net::ERR_ABORTED`) is an understood exception. Four expected-failure probes
in `runtime-diagnostics.spec.mjs` verify the automatic gate: removing it causes
unexpected passes and fails the suite. Those probes do not represent
application failures.
