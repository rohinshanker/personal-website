# A_sudoku-followups__20260924 — Active

- Scope: Sudoku performance and quality-of-life follow-ups identified after the 2026-09-24 board-controls and restored-puzzle publication work.
- Status: active
- Opened: 2026-09-24
- Updated: 2026-09-28
- Current State: Owner accepted the final mobile and wider renders and explicitly authorized push. Approved implementation is local main `4449239`; release, live verification and Worker version recording are in progress. Media is already shipped. Canonical repository: `/Users/Rohin/Desktop/coding_stuff/personal-website`.
- Verification: Latest mobile-only change passed 13 rendered layout/notes checks (all four viewports and 680/681px breakpoint), 15 targeted Node/cache/context checks, integrity and whitespace checks; screenshots inspected. Prior final action-row change: 389 Node tests, 21 focused layout/notes/pause browser tests and the Sudoku accessibility scan passed. Playing and paused reference images were inspected, updated for the intended button change, and compared again. Four viewport screenshots and 680/681px breakpoint geometry were inspected. The broader preceding repair passed 71 Sudoku UI tests, 19 accessibility checks and nine visual checks. Earlier full-site UI: 386 passed with one documented unrelated Neko parallel flake, passing twice alone. Current screenshots: `.playwright-cli/sudoku-resume/ACTIONS-*.png`.
- Cleanup: Durable contracts are already folded into `docs/validation/sudoku-board-controls.md`, `docs/validation/sudoku-leaderboard-eligibility.md`, `docs/validation/game-stats-backend.md`, and `docs/validation/browser-visual-accessibility.md`. Delete this ticket and its index row once the reviews and owner acceptance close; the Worker version ID is recorded by the coordinator after release.

## Items

1. **Worker-side idempotency by puzzle identity.** Carry the puzzle identity (`puzzleId` plus puzzle string, or a hash of it) in the Sudoku event and have the Worker reject a second win for the same identity and player. This closes the documented multi-tab races that the browser-side claim list cannot: same-instant completions, a dropped claim from concurrent writes, and eviction past 500 claims. Needs an additive D1 migration and the Worker version ID recorded per `docs/validation/game-stats-backend.md`.
2. **Puzzle generation off the main thread.** Generate puzzles in a Web Worker or keep a small precomputed pool per difficulty so the boot loader finishes on real work instead of the 1.3–2.8 s timed sequence, and so New Game never stalls the UI.
3. **Solved-dialog guard for the grid's own keys.** The window-level handler already ignores keys while the solved dialog or Errors prompt is open; the grid keydown path and the undo/redo shortcut still accept them. Apply the same guard and extend `tests/ui/sudoku-board-controls.spec.mjs`.
4. **Note-aware highlighting and auto-clear.** Highlight note digits matching the selected value, and after a placement clear that digit's notes from the row, column, and box. Requires manual UI review if a new button or other visible control is added (for example an auto-clear toggle).
5. **Remaining-count badges on keypad digits.** Show how many placements remain for each digit, not only the greyed state at nine. Requires manual UI review of the keypad rendering at every viewport.
6. **Pause.** Add a pause that stops the timer. While paused, hide every number and note and make the board and control panel mostly transparent so the aquarium shows through, with a single play button centred on the board to resume. Also pause automatically when the tab is hidden; visibility changes currently only pause the aquarium. Requires manual UI review of the paused state.
7. **Conflict highlight mode.** Mark duplicates within a row, column, or box without consulting the solution. Because it reveals nothing about correctness, it must not set the assistance latch or disqualify a leaderboard run; document that in the eligibility contract.
8. **Batch highlight and keypad refreshes.** `updateSudokuBoardHighlights` and `updateSudokuNumberButtons` now run on every keystroke across 81 cells; diff classes in one pass and skip unchanged cells.
9. **Regenerate visual baselines.** Add the greyed keypad and same-value tint to the pinned-container baselines per `docs/validation/browser-visual-accessibility.md`.

Item numbering matches the 2026-09-24 follow-up list minus its item 7 (per-puzzle mistake and check tracking), which was not adopted.
