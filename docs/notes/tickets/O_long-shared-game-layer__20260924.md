# O_long-shared-game-layer__20260924 — Open

- Scope: Extract the behaviour the four games re-implement (storage, stopwatch, fake loading bar, achievement banner, Game Stats session hooks, window-active checks, keyboard routing), make Solitaire's deal lazy, and move Solitaire rendering to keyed updates.
- Status: open
- Opened: 2026-09-24
- Updated: 2026-09-24
- Current State: Opened from the 2026-09-24 whole-site audit. Nothing started. Tier: long. Overlaps `O_sudoku-followups__20260924.md` items 2 (generation off-thread) and 8 (batched refreshes); coordinate so the shared layer lands first. Timer semantics for Minesweeper and the close-behaviour choice are decision items in `O_decide-games-and-backend__20260924.md`.
- Verification: `npm test` including every `game-stats*`, `minesweeper-*`, `solitaire-*`, `sudoku-*`, `snake-*` file; `node scripts/update-game-integrity.mjs` then `--check`; the `tests/ui/*-publish-flow.spec.mjs` suites; a full win of each game published against the local offline Worker fixture; rendered pass at 375×812, 768×1024, 1280×800, 1440×900.
- Cleanup: Record the shared hook contract in `docs/validation/game-stats-refresh-control.md` (session lifecycle) and `docs/validation/site-quality-gates.md`, then delete this ticket and its index row.

## Verified duplicated blocks (`scripts/home/main.js`)

- Stats session start, four shapes: Snake guards on `!hasStarted` (:8215-8226); Sudoku on `statsSessionEligible && !statsSession` (:19354-19358); Minesweeper unconditionally in the timer starter (:29140); Solitaire `if (statsSession) return` (:29676-29679).
- Completion record plus random-event trigger: :8121-8135, :20489-20504, :29244-29253, :30519-30527 (same `recordGameStatsEvent(createGameStatsEvent({…}), session)` then `triggerRandomEvents("gameWin"/"gameLoss", {game})`).
- Achievement banner (remove class, `void el.offsetWidth`, add class) plus an `animationend` remover: :29042-29047/:29551-29555 (MS), :30285-30290/:31327-31331 (Sol), :20240-20245/:31333-31337 (Sudoku; its listener is registered inside the Solitaire wiring block).
- Window-visible / reduced-motion / page-active triplets with identical bodies: :7438-7454 (Snake) vs :19382-19404 (Sudoku).
- Fake loading bars: `tickSnakeLoadingSequence` (:7517-7566) and `tickSudokuLoadingSequence` (:19681-19728), same algorithm, different constants.
- `localStorage` JSON load with try/catch and fallback, hand-rolled 8 times: :1661, :1708, :1792, :1944, :7570, :7599, :19259, :20446.
- Undo stacks: `solHistory` cap 100 inline (:30153-30158) vs `sudokuState.undoStack` with `SUDOKU_MAX_UNDO_STATES` (:19178-19188).
- Four document-level keydown listeners each re-derive "is my window active" with different guards: Snake (:28789-28850), Minesweeper (:29450-29477), Sudoku window keys (:20387-20426) and undo/redo (:20318, registered :21296-21297).
- Timers differ materially and should NOT be unified: Minesweeper is an incrementing `setInterval` capped at 999 (:29138-29147); Sudoku is wall-clock `Date.now()` with persisted elapsed (:19197-19203, :19352-19380); Snake is a `setTimeout` tick chain (:8138-8192); Solitaire has no timer.

## Plan

1. `readJsonStorage(key, fallback)` / `writeJsonStorage`; `createStopwatch({onTick, cap})` for Minesweeper and Sudoku only; `createProgressLoader({minMs, maxMs, …})`; `flashBanner(el)`; `isWindowActive(win)`.
2. `createGameStatsHooks(game, buildConfig)` exposing `ensureSession()`, `dropSession()`, `recordWin(payload)`; this also fixes the unbounded `gameStatsSessions` map uniformly (item 14 of `O_small-main-js-helper-dedupe__20260924.md` is the quick version).
3. One keydown dispatcher keyed on `activeWindow.dataset.appWindow` applying the common guards (`document.hidden`, `hasFocus`, `repeat`, editable targets, open dialogs) once, then a per-game handler. Check `docs/validation/minesweeper-keyboard-controls.md` and `tests/minesweeper-mark-controls.test.mjs` for pinned guard text.
4. **Solitaire deal is synchronous at script initialisation**: `solNewGame()` is called at top level (:31373) and runs `solBuildWinnableDeal` (:30121-30138), a DFS with a 40,000-node budget over up to 12 shuffles (~80-90 ms mean, ~0.5 s worst case per the 2026-09-11 measurement), on every Home load whether or not Solitaire opens; everything after :31373 waits. Deal on first open (or `requestIdleCallback` with a synchronous fallback on open); consider the same Web Worker path as Sudoku item 2.
5. **Solitaire rebuilds the whole board DOM on every click** (`solRender` :30604-30696 clears and recreates stock, waste, foundations, all seven columns, one body-level tooltip and three pointer listeners per column), and `solRenderToolbar` re-runs `solPlanAutoSolve` on every render (:30709-30716). `solRenderLanding` (:30868-30881) shows an incremental path exists. Keyed column updates, tooltips owned by the column, plan cached per state change. Low urgency at 52 cards.
6. **Expired queued sessions**: Worker `SESSION_TTL_MS` is 6 h; the client treats `expiresAt <= now` as rejected (:2985-2988) and reports "could not pass server verification" (:3070-3074). At completion, if the awaited session is expired, request a fresh one before queueing and use a distinct message. Whether the Worker accepts a session younger than the metric is a decision item.
7. Text-assertion hazards: `tests/game-stats.test.mjs:113-135` anchors on `const msStartTimer`, `const ensureSolitaireStatsSession`, `const startSnakeGame`, `const startSudokuTimer`, `const recordSudokuCompletion`, `const checkSudokuBoard`; `tests/sudoku-check-eligibility.test.mjs:284-287` pins the order `pauseSudokuTimer`/`currentSudokuElapsedSeconds`/`recordGameStatsEvent`; `tests/solitaire-auto-solve.test.mjs:353-357` pins `solHistory`/`solPushUndo`; UI specs call `snakeStep`, `clearSnakeTick`, `rebuildSnakeOccupiedCells`, `ensureSolitaireStatsSession`, `solHistory` as page globals (`tests/ui/snake-publish-flow.spec.mjs:65-95`, `tests/ui/solitaire-auto-solve.spec.mjs:42-59`), so those stay top-level bindings with those names.
