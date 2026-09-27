# O_sudoku-check-prompt-and-clean-checks__20260927 — Open

- Scope: Two Sudoku Check-button behaviours: prompt the player when the board is full and only Check can resolve it (win or errors), and stop counting a check that finds no errors against the three-check leaderboard allowance.
- Status: open
- Opened: 2026-09-27
- Updated: 2026-09-27
- Current State: Requested by the owner on 2026-09-27. Nothing started. Touches the Sudoku region of `scripts/home/main.js` (`checkSudokuBoard` near the `recordSudokuCompletion` block, the board-update path, and saved-state restore), `styles/home/apps/sudoku.css`, and the Sudoku source and Playwright tests. Coordinate with any in-flight `main.js` stream before editing.
- Verification: `npm test` with `tests/sudoku-check-eligibility.test.mjs` extended for both rules; `node scripts/update-game-integrity.mjs` then `--check`; `npx playwright test --project=ui tests/ui/sudoku-check-controls.spec.mjs tests/ui/sudoku-board-controls.spec.mjs tests/ui/sudoku-publish-flow.spec.mjs`; rendered pass of the Sudoku window at 375×812 and 1440×900 showing the gold glow and the double press on a full board, with `prefers-reduced-motion` honoured; `npm run test:visual` re-baselined only if a pinned screenshot shows a full board.
- Cleanup: Fold both rules into `docs/validation/sudoku-leaderboard-eligibility.md` (check allowance contract) and `docs/validation/sudoku-board-controls.md` (button prompt), update `docs/validation/INDEX.md`, then delete this ticket and its index row.

## Requirements

1. **Full-board Check prompt.** When every cell holds a value and the game is not yet solved, the Check button is the only way forward: pressing it either declares the win or reveals errors. In that state the button glows gold and plays a press/unpress animation twice (the Windows 98 sunken-then-raised look, not a colour flash), then keeps glowing until the state ends. The prompt ends as soon as a cell is cleared, the puzzle is solved, or a new puzzle starts. It must replay when the board becomes full again. Under `prefers-reduced-motion: reduce` the glow shows without the press animation. The prompt is purely visual: it must not change focus, status text, or the keypad.
2. **Clean checks are free.** A Check that finds no errors on an incomplete board does not consume one of the three leaderboard checks; only a Check that reveals at least one mistake counts. Today `checkSudokuBoard` increments `checksUsed` before it diagnoses the board, so a clean check burns an allowance. After the three error-revealing checks are used, a further Check still validates silently: a clean board shows the existing "Ready" bubble burst and stays free; a board with errors reports only `No checks remaining` and marks nothing, exactly as now. The `0/3 allowed checks used` text, the saved-state `checksUsed` field, and the restored-puzzle path keep their current shape; a puzzle saved before this rule restores unchanged.

## Notes

- A full but wrong board is already the diagnostic path (`!result.valid`); the prompt does not distinguish correct from incorrect, so it reveals nothing and must not set the assistance latch.
- The current `.sudoku-play-button.animate` and `#sudoku-check` burst styles are the closest existing patterns for the button animation.
- Leaderboard eligibility is unchanged: the assistance latch and the Errors warning still govern the `noHints` bucket.
