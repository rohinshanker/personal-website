# O_small-ci-and-worker-fixes__20260924 — Open

- Scope: Align the three GitHub workflows on one hardening standard, stop redundant CI work, gate generated artifacts in CI, and apply the small Worker and script correctness fixes that need no design decision.
- Status: open
- Opened: 2026-09-24
- Updated: 2026-09-24
- Current State: Opened from the 2026-09-24 whole-site audit. Nothing started. Tier: small. Worker changes that need a D1 migration or a schema decision, and deploy-gating policy, are in `O_long-worker-stats-aggregation__20260924.md` and `O_decide-architecture-and-testing__20260924.md`.
- Verification: `npm test`; `npm --prefix workers/game-stats test` and `npm --prefix workers/game-stats run deploy:check`; `tests/game-stats-deployment.test.mjs` YAML assertions extended to all three workflows and green; one green run of each workflow on `main`; for the scheduled purge, `docs/validation/game-stats-backend.md` release steps including the recorded Worker version ID.
- Cleanup: Record the workflow standard and the purge contract in `docs/validation/game-stats-backend.md` and `docs/validation/site-quality-gates.md`, then delete this ticket and its index row.

## CI

1. **Inconsistent hardening**: `game-stats-worker-release.yml` pins actions by SHA, Node 24, `persist-credentials: false`, npm cache, `concurrency`, `timeout-minutes`. `ui-layout.yml:20-23,43-46` and `secret-guard.yml:15-18,25,28` use `@v4`/`gitleaks-action@v2` tags, Node 22, no `persist-credentials: false`; `secret-guard.yml` has no `concurrency` and no `timeout-minutes`. Adopt the release workflow's standard everywhere and extend the pin test at `tests/game-stats-deployment.test.mjs:1349-1361` to all three files.
2. **Uncached browser install**: `npx playwright install --with-deps chromium` (`ui-layout.yml:26`) runs cold every run. Cache `~/.cache/ms-playwright` keyed on `package-lock.json`.
3. **Secret scanning runs four times per push**: `secret-guard.yml:19-20` runs the script and then `tests/no-secrets.test.mjs` (which re-scans the tree, ~1 s), `npm test` in the release workflow runs it a third time, gitleaks a fourth. Keep the script step plus gitleaks in the guard; keep the unit tests in `npm test` only.
4. **Missing gates in `verify`**: no `node --check` over `scripts/**/*.js` and `video-editor/*.js` in any workflow; `node scripts/build-app-icon-manifest.mjs --check` is run by no workflow; `scripts/build-study-resources-manifest.mjs` has no `--check` mode, uses `process.cwd()` as repo root (others use `import.meta.url`), and is run nowhere although `assets/study resources/manifest.json` is tracked. Add all three to `verify`.
5. **`wrangler.jsonc` is parsed with `JSON.parse`** (`scripts/update-game-integrity.mjs:79`), so any comment in the "jsonc" file breaks the integrity gate. Parse with a comment-stripping parser or rename the file to `.json` (update `wrangler.jsonc.example`, the deploy `--config` flag, and docs together).
6. **`secrets.required` in `wrangler.jsonc:24-32` is inert**: `wrangler deploy --dry-run --strict` prints nothing about it and the Worker returns 500 at runtime (`src/index.mjs:853,869`) when a secret is missing. Add a `deploy-worker` step that runs `npx wrangler secret list --config wrangler.jsonc` and asserts the five names before deploying.

## Worker and scripts

7. **No row expiry**: no `DELETE`, `scheduled`, or `triggers` anywhere; `game_stat_sessions` gains a row per game start forever, and the `*_expiry_idx` indexes from `migrations/0002` are used by nothing. Add a `scheduled` handler with `triggers.crons` deleting `expires_at < now` from sessions and rate-limit buckets. Record the Worker version ID per the backend runbook.
8. **`readJsonBody` (`src/index.mjs:766-771`) compares `text.length` (UTF-16 units) against a byte limit**; a 4,096-char non-ASCII body can be ~12 KB. Measure `arrayBuffer().byteLength`.
9. **Turnstile `fetch` (`:987`) has no timeout, and a non-JSON reply throws inside `response.json()`** into a generic 500 instead of a 403. `AbortSignal.timeout(5000)` and catch JSON errors as 403.
10. **`enforceRateLimit` does an upsert plus a separate select (`:1022-1026`)**; `RETURNING request_count` is one round trip.
11. **Missing session returns 409 "Game session was already used" (`:1239`)**; give the not-found case its own message.
12. **Dead and undocumented Worker code**: `createEmptyGameStatsData` (`:236-244`) repeats `createEmptyPlayerTotals` (`:222-230`); the `env.DB` fallback (`:696`) is used by no test, doc, or config; `LOCAL_ALLOWED_ORIGIN`/`EXTRA_ALLOWED_ORIGINS` (`:772-773`) exist only in tests, not in `.dev.vars.example` or docs. Delete the first two, document or remove the third.
13. **Script duplication**: the fetch/response guard block appears at `check-game-stats-deployment.mjs:118-148, 211-250, 271-308` and `check-game-stats-release-context.mjs:81-113`; `assertPositiveInteger` vs `requirePositiveInteger`; `GAME_BUILD_VERSION_PATTERN` defined three times (`src/index.mjs:12`, `update-game-integrity.mjs:14`, `check-game-stats-deployment.mjs:18`); `MAX_GAME_BUILD_COMPATIBILITY_VERSIONS` twice; the digest loop (`update-game-integrity.mjs:45-54` vs `check-game-stats-deployment.mjs:311-321`); cache-asset path lists (`update-game-integrity.mjs:27-31` vs `check-game-stats-deployment.mjs:21-25`); live URL hard-coded at `check-game-stats-deployment.mjs:11-13`. Add `scripts/lib/game-build.mjs` and `scripts/lib/http.mjs`; make the live URL an env override with the current default. The `tests/game-stats-deployment.test.mjs` coverage (100%) must be kept.

## Video Editor (small, same tier)

14. **Layout thrash in the preview/timeline separator drag**: `video-editor/script.js:638-656` calls `previewSplitBounds()` twice per `pointermove` (`getBoundingClientRect` + `getComputedStyle` each) then writes styles. Compute once per drag start. Frequency inputs re-render both canvases on every `input` event unthrottled (`:3313-3318`); rAF-coalesce.
15. **`beforeunload` cleanup (`:3483-3494`) should be `pagehide`** for bfcache correctness. `audioAnalysisCache` (`:2199`) is never cleared and there is no remove-media path, so object URLs and analyses only grow per session; bound the cache.
16. **Audio-analysis nits** (FFT verified as a real radix-2 O(n log n)): two `Float64Array(size)` allocated per frame (`audio-analysis.js:64-65`), `Math.hypot` per bin (`:97`), `lowBands.includes(band)` inside the inner loop of `createOnsetSeries` (`:266`). Hoist the buffers and use a Set.
