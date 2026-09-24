# O_sudoku-followups__20260924 — Open

- Scope: Sudoku performance and quality-of-life follow-ups identified after the 2026-09-24 board-controls and restored-puzzle publication work.
- Status: open
- Opened: 2026-09-24
- Updated: 2026-09-24
- Current State: Backlog agreed; nothing started. Base is the pushed commit `Publish restored Sudoku puzzles and add board controls` on `main`.
- Verification: Each item ships with its own tests per `docs/validation/site-quality-gates.md`; items that change `scripts/home/main.js` or `scripts/home/core/dom.js` regenerate the build hash; items 4, 5, and 6 also need a rendered pass at 375×812, 768×1024, 1280×800, and 1440×900 plus manual review of any new control.
- Cleanup: Distill durable contracts into `docs/validation/sudoku-board-controls.md` or `docs/validation/sudoku-leaderboard-eligibility.md`, then delete this ticket and its index row.

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
