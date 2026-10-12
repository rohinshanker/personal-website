# A_long-modeling-shoot-markup__20261006 — Active

- Scope: Generate Home's modeling shoot titles, dates, icons, viewer headers and credits from the shared shoot data rather than hand-maintained copies.
- Status: active
- Opened: 2026-10-06
- Updated: 2026-10-12
- Current State: Implemented on `codex/modeling-shoot-markup-20261012` (baseline `e815f0c`); awaiting independent review and the coordinator's integrated full UI suite. Keep active until then.
- Verification: Preserve shoot ordering, complete credits/links, accessible names and meaningful crawlable text. Test shared-data rendering and missing optional fields, navigate every shoot, and inspect Home and `/modeling/` at four standard viewports. Run affected behavior/browser/accessibility/visual, integrity and context checks and review the exact patch.
- Cleanup: Distill the single-source rendering contract into the indexed modeling validation guide, then resolve and remove this ticket/index row.

## Constraints

- Use `scripts/home/modeling-portfolio.js` as the existing source of truth. Preserve full-quality images and the independently committed Arthaus photo.
- Prefer the smallest rendering/build mechanism that preserves the current visible and crawlable content; measure net source reduction including the helper/data/configuration.
- Preserve existing carousel/viewer media lifetimes, focus, first-use initialization and route parity. The owner requested publication to main on 2026-10-12; the coordinator owns the release.

- Preserve full-quality modeling photos `fast-sonder-lb2-may2025/5.png` and `fast-reverie-rnwy-apr2024/05-runway-photo.png`; owner explicitly retained them.

## Implementation

- `scripts/build-modeling-markup.mjs` rewrites the two marker-bounded `home.html` regions (selector rows, viewer panels) from `scripts/home/modeling-portfolio.js`; `--check` backs `npm run modeling:check` in the release `verify` job. Regenerated output is byte-identical to the former hand-written markup; `home.html` gains only four marker lines.
- Delta versus `e815f0c`: tracked code +334/−15 lines (generator 133, generator tests 183, wiring, parity-loader reuse and decoder); validation docs +20/−7. Tracked `home.html` grows 321 bytes (four markers plus the cache token); its 385 modeling lines (selector 198, viewer 187) stay tracked as generated output, so the reduction is in hand-maintained source, not tracked size. No asset changed; `5.png`, `05-runway-photo.png` and `sproul-hall-group.jpg` keep their blob ids.
- Data script cache token is now `modeling-generated-home-20261012` in `home.html`, `index.html` and `modeling/index.html`.

## Verification (2026-10-12)

- `npm test`: 804/804 (final patch). `tests/build-modeling-markup.test.mjs` uses semantic assertions (data order, single active row/visible panel, surrounding HTML preserved, idempotence, escaping, optional/unpublished fields, malformed markers) and runs the CLI against a temporary copy: a stale `home.html` makes `--check` exit 1 without writing, and the build restores the tracked bytes. `npm run syntax:check`, `node scripts/check-no-secrets.mjs`, `git diff --check`, `npm run modeling:check`, `app-icons:check`, `study-resources:check`, `media:check`, `game-stats:integrity:check`, `game-stats:catalog:check`: pass.
- Probes: a hand-edited Home credit fails `modeling:check` and the independent parity test; unpublishing a shoot in the data, or adding `&`, `<`, `>` and quotes to a title or credit, fails the check until regenerated, then passes both. The parity oracle's entity decoder now handles `&lt;`/`&gt;` in one pass.
- `UI_TEST_PORT=4292 UI_TEST_OUTPUT_DIR=test-results/dem-377-ui npx playwright test --project=ui` over modeling-portfolio, modeling-launch-prompt, carousel-video-playback, modeling-custom-cursors, shared-carousel-spacing, media-loading-priority, deferred-window-media, window-dialog-semantics, runtime-diagnostics and about-me: 66/69 at default parallelism; the three failures were local `http.server` `ERR_CONNECTION_TIMED_OUT` and an Administrator alert timing, and passed 13/13 when rerun with `--workers=2` (`test-results/dem-377-ui-rerun`).
- `accessibility.spec.mjs` and `admin-controls.spec.mjs -g "odeling"`: 4/4. `DOCKER_CONTEXT=colima UI_TEST_PORT=4293 npm run test:visual`: 9/9 with unchanged baselines.
- Rendered (`playwright-cli -s=dem-377-modeling`, server on 4292, artifacts `.playwright-cli/dem-377/`): clicking every one of the 22 Home rows showed the row title/date/icon, heading, date, credits, link hrefs and first real media matching the data (`home-walk.json`); Arthaus slide 2 is `sproul-hall-group.jpg`. `/modeling/` parity matched for all 22 shoots. Screenshots `home-modeling-*.png`, `home-fresh-375x812-*.png`, `modeling-route-*.png` at 375x812, 768x1024, 899/900/901x900, 1280x800 and 1440x900 show no document overflow; the route stacks below 900 and splits columns from 900. The launch prompt No returns focus to the launcher. Console: only the known localhost Game Stats CORS rejection on Home; none on `/modeling/`.

## Review fix (DEM-379 P2)

- Finding: omitted `credits` passed the generator and `modeling:check` but failed `tests/modeling-portfolio.test.mjs` completeness (`not iterable`) and parity (`[]` vs `undefined`); omitted `links` shared the completeness gap. Runtime already accepts both omissions, so only the oracle changed.
- Fix: the completeness and parity checks are now reusable helpers; `links`/`credits` must be arrays when present and are read as `[]` when omitted. The canonical data, present-field and file assertions are unchanged.
- Regression: a temporary copy omits both lists from `modeling-garb-garbage-runway`; completeness passes, the old Home fails parity and `--check`, the build removes exactly the two credit lines, `--check` then passes, and parity accepts the result. Reverting either the parity or the loop normalization fails it.
- Validation: `node --test tests/modeling-portfolio.test.mjs tests/build-modeling-markup.test.mjs` 15/15. `npm test` 804/805 while the coordinator's full browser suite ran on the same Mac; the single failure was the unrelated 10 ms synchronous-stage budget in `tests/game-stats-verification-runtime.test.mjs` (43.0 ms), which passed 1/1 rerun alone. `syntax:check`, `modeling:check`, the secret scan and `git diff --check` pass. No runtime, markup or UI file changed, so no browser suite was rerun.

## Integration validation

Integrated as 0c1fe5d and ab5933a with both review findings resolved. The full browser suite passed 597/597 in one run at three workers; combined source tests passed 805/805, the slow corpus passed 4/4, and 26 focused integration checks passed. The generated markup and media remain unchanged by the companion Distress Signal release repair. Final release and ticket cleanup are pending.
