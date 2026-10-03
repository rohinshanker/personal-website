# A_long-main-js-module-split__20260924 — Active

- Scope: Split the 32,299-line `scripts/home/main.js` IIFE into per-feature classic scripts along its natural seams, shrink `core/dom.js` from a 525-entry eager lookup table to shared shell elements, and re-point the 44 source-text tests that read `main.js` by path.
- Status: active
- Opened: 2026-09-24
- Updated: 2026-10-03
- Current State: Active on owner instruction 2026-10-03: complete the feature-script split with feature-local DOM lookups. Tier: long. Depends on the decision "per-feature DOM lookups vs one table" in `O_decide-architecture-and-testing__20260924.md`; do `O_small-main-js-helper-dedupe__20260924.md` first so helpers land in one shared file.
- Verification: After each extracted region: `node --check` on every changed file; `npm test` with the affected test files' `readFileSync` paths updated; `node scripts/update-game-integrity.mjs` then `--check` (the build hash covers `main.js` and `core/dom.js`; decide whether extracted files join the hashed set); `npm run test:ui`; `npm run test:visual`; rendered pass of `/home.html` at 375×812, 768×1024, 1280×800, 1440×900 with no console errors and the extracted feature exercised end to end.
- Cleanup: Record the final file map and the "one region per commit" procedure in `docs/validation/site-quality-gates.md`, refresh the numbers in `docs/validation/test-suite.md` (it still says 36 files / 30,752 lines; today 44 files read the file and it is 32,299 lines), then delete this ticket and its index row.

## Facts

- One `(() => { ... })()` loaded as a classic `<script>` (`home.html:6860`, no `type="module"`), after `core/dom.js` and `core/media.js` which hand it `window.homeDom` / `window.homeMedia`.
- 2,448 top-level bindings (1,601 arrow consts, 561 data consts, 283 `let`s, 6 `function` declarations) and roughly 450 top-level wiring statements.
- Publishes 4 globals: `window.rohinHomePerf` (:35), `rohinHomePrerenderActivationStart` (:42), `homeGallery` (:21742), `rohinAdminOrchestrator` (:32285). Zero cross-file duplicate top-level names with the other five home scripts.
- 682 of the 2,448 top-level identifiers appear literally in test text, so renames break assertions; moving a region only requires changing the test's `readFileSync` path.
- Blockers: the ~520-name `const {…} = dom` destructure at `:160-682`; 283 top-level `let`s, 176 of them in `:4000-5999` (random-event timer handles and state shared across regions, e.g. `:4726-4795`, `:5358-5400`); `activateVisibleContent` is a `let` function reassigned at `:22283` as a forward reference (`:5025`).

## Section map (line ranges as of 2026-09-24)

1. `1-160` prerender/activation gate and media wrappers; `160-682` dom destructure; `684-1043` Snake/Sudoku/Life-Counter constants; `1044-4600` Game Stats client (backend 1189-1830, name generator 2292-2600, profile dialog 2400-2900, leaderboard renderers 3264-3974, Game Progress 4148-4560).
2. `4600-5130` shared window state (`topZ` :4613, `activeWindow` :4800), random-event timer handles, coming-soon dialogs, viewport-zoom lock, About degrees, media helpers, `restartWindowAnimation` :5122; `5129-5400` random-event flags and state.
3. `5400-16430` about 60 random-event implementations (positioning/managed-window core 5585-5818; Gears Nest 9363-9900; Fate 10385-10850; Soot Sprites 11087-11845; Lancer 12249-12760; Brand Burns 12767-14023; Pokemon 14279-14554; Relic Recovery 14604-15045; DST 15061-15340; Infinity Armory 15516-15777; Virus 15848-16263); `16430-17950` registry, scheduler, cooldown, preload, triggers, 62 `registerRandomEvent` calls.
4. `17952-18884` window-manager core (`bringWindowToFront`, title-bar clamp, portfolio resize :18100, launch prompts :18251, `setWindowOpen` :18316, Clash Royale comment 18534-18835, `closeAppWindow` :18856); `18884-20667` Sudoku; `20667-21241` Life Counter; `21241-21394` Sudoku/Life wiring; `21394-21634` unload, clocks, Credits; `21634-22487` Gallery (`window.homeGallery` :21742, Modeling :21826, carousel activation 22218-22480); `22487-23300` Study; `23300-23963` Calendar.
5. `23963-26317` flat wiring block (calendar plus 128 random-event button/animation blocks, 239 `addEventListener` calls); `26317-26633` Cursor; `26633-26815` Rohin Neko avatar; `26815-28302` Neko cat and stream; `28302-28888` admin sign-in, profile suggestions, Game Progress, Snake wiring; `28888-29598` Minesweeper; `29598-31240` Solitaire; `31240-31494` bootstrap listeners; `31494-31717` drag/title-bar clamp and media pause; `31717-32299` Admin orchestrator.

## Plan

1. Move each feature's DOM lookups next to the feature so `dom.js` shrinks to shared shell elements (76 raw `document.getElementById` calls in `main.js` for ids not in the table show the convention is already mixed; no other script uses `window.homeDom`; no test reads `core/dom.js`).
2. Extract self-contained regions first, one per commit, each exposing a `window.homeX` object like `homeMedia`: Study, Calendar, Cursor, Life Counter, Minesweeper, Solitaire, then Sudoku, Snake, Neko, Gallery, Game Stats client, Admin orchestrator. Random events last, after `O_long-random-event-boilerplate__20260924.md`.
3. Replace the `activateVisibleContent` forward reference with an explicit registration.
4. Each extraction updates: the `home.html` script tag list and cache tokens, `index.html` warm-up list, the integrity hashed-file set if the region determines game completion, and the affected tests' file paths (Minesweeper 87+58+4 assertions across `tests/minesweeper-*.test.mjs`, Solitaire 52+35+8+6, Sudoku 42+36+17; `tests/solitaire-winnable-deals.test.mjs:17-30` builds the solver with `new Function` from source slices between the sentinels `const solSuitOrder =`/`const solRankNames =` and `const solBuildDeck =`/`const solCloneCards =`, so keep those declarations adjacent).
5. Keep classic scripts; no bundler exists and `defer` preserves order if the load-order decision lands on deferring.

## Owner decisions (2026-10-03)

- Use feature-local DOM lookups; keep shared shell elements in `core/dom.js`.
- Complete the module split, update tests and release metadata, and preserve current behavior and ordered classic-script loading.
- Build hashes follow extracted completion code and its dependencies as release/cache compatibility metadata. They cannot attest to untampered gameplay.
- Keep this implementation focused on the module split. Record the proposed server-side replay and timing contract in `docs/validation/leaderboard-result-verification.md`; do not implement it in this change.
- Random-event consolidation has landed. Refresh stale line ranges and verify the earlier helper-deduplication dependency from current source before extracting.
