# Shared Game Layer

- Purpose: Keep compatible game mechanics in small shared helpers while preserving each game's policies.
- Scope: Home games, utility and window contracts, Game Stats hooks, and Solitaire rendering.
- Last verified: 2026-10-05

## Ownership

`homeUtil` owns `readJsonStorage`, `writeJsonStorage`, `removeStorage`,
`flashBanner`, `isPageActive`, and `createProgressLoader`. Storage callers pass
`() => localStorage` so blocked property access is caught inside the helper.
Reads return the supplied fallback; writes and removes return success booleans.
Game-specific normalization and Sudoku's cross-tab completion claims stay with
their owners. Banner restarts replace the previous listener and ignore bubbled
animation events from descendants.

The progress loader owns scheduling and cancellation. Games supply their
progress curve, cap, duration, readiness, continuation and UI callbacks. Snake
keeps its randomized 1–4 second duration and 96% intermediate cap. Sudoku holds
at 98% until a real worker-generated puzzle is ready and its 1.3 second floor
has elapsed. Successful completion reaches 100%; cancellation or restart must
invalidate every old callback, including reentrant callbacks.

`homeWindows.registerActiveWindowKeyHandler(appId, handler)` dispatches in
registration order only when the page is active and the matching window is
visible and active. An already-prevented event is ignored; handling or preventing
an event stops further handlers. Games keep their modifier, composition, repeat,
editable-target and gameplay guards. Sudoku's grid-local handlers and Solitaire's
button-local keyboard handling remain separate.

Minesweeper and Sudoku keep distinct stopwatch implementations. Minesweeper
counts real elapsed time through hidden tabs and sleep, settles before a win,
and resets on close. Snake and Sudoku retain their pause policies.

## Statistics hooks

`homeGameStats.createGameStatsHooks(game, stateOrGetter)` owns the mutable
`statsSession` string. `ensureSession(config)` requests or reuses an eligible
session; `dropSession()` detaches the abandoned attempt; `recordEvent(payload,
options)` clears the attempt's key and claims its proof synchronously before any
profile-selection wait. The shared Game Stats map retains at most one reusable
slot per game. Submitted or queued results never share that slot with a new
attempt.

Use a state getter when a controller replaces its state object; Sudoku must use
`() => sudokuState`. The hooks resolve the getter for every operation. Game
controllers still own eligibility, metrics, completion latches, presentation
suppression, and activity notifications. See [game-stats-backend.md](game-stats-backend.md)
for session limits and expiry, and [game-stats-refresh-control.md](game-stats-refresh-control.md)
for exact feedback.

## Solitaire board lifetime

Deal the first board in `beforeOpen`, before window placement measures its
height. Reopening keeps that board; reset creates a new deal. Stage Admin
presentation boards before opening so lazy initialization does not generate a
discarded deal. Presentation wins never publish or trigger gameplay events. A
completed board remains terminal until Reset; foundation clicks and undo cannot reopen that deal
or request another session, including while its profile choice is pending.

Render keyed cards and persistent slots, columns and tooltips incrementally.
Unchanged nodes retain identity and pointer listeners. Cache solve plans by
visible board content and pile depths; normal moves, undo, reset and staged
fixture boards must invalidate the signature when their state changes.

## Repeatable verification

```bash
node --test tests/shared-game-helpers.test.mjs \
  tests/game-stats-session-failure.test.mjs \
  tests/game-stats-record-handoff.test.mjs \
  tests/solitaire-board-lifecycle.test.mjs \
  tests/minesweeper-timer.test.mjs
UI_TEST_PORT=4314 UI_TEST_OUTPUT_DIR=test-results/shared-games \
  npm run test:ui -- --workers=2 tests/ui/game-stats-session-policy.spec.mjs \
  tests/ui/solitaire-lazy-board.spec.mjs tests/ui/solitaire-publish-flow.spec.mjs \
  tests/ui/minesweeper-publish-flow.spec.mjs tests/ui/snake-publish-flow.spec.mjs \
  tests/ui/sudoku-publish-flow.spec.mjs
npm run test:slow
```

Render loading/ready, keyboard and close/reopen states at 375×812, 768×1024,
1280×800 and 1440×900. Inspect Sudoku playing/paused, Solitaire stock/tableau,
undo/auto-solve, and actual expired completions with updated local totals.
Confirm no replacement session or event POST for an expired result. Keep review
screenshots outside the automated output directory, which Playwright clears
before each run. Run the full quality gates before shipping a shared change.
