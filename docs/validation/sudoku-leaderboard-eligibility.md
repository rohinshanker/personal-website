# Sudoku Leaderboard Eligibility

- Purpose: Preserve Sudoku check limits, assistance classification, completion recording, and responsive control behavior.
- Scope: Sudoku controls, saved puzzle state, no-hints leaderboard events, completion-source integrity metadata, and rendered browser validation.
- Last verified: 2026-10-07

## Eligibility Contract

- A fresh puzzle starts with Errors off, zero of three checks used, no accepted Errors warning, and no assistance latch.
- A Check spends an allowance only when its diagnostic pass reveals at least one mistake. A Check that finds none is free: it clears stale markers, bursts, and reports `Ready`, however many allowances are already gone. A valid completed board is a submission, not a diagnostic check, so it remains submittable after all three allowances are used.
- The diagnostic pass therefore runs before the count, not after it. Counting first burned an allowance on a clean board.
- Once three mistake-revealing checks are used, another Check on a board with errors clears stale markers and reports only `No checks remaining`; it must not mark cells or expose a mistake count.
- The Reveal control and its automatic-cell-fill path do not exist.
- Conflicts is the third mode in the same Hints group, mutually exclusive with Off and Errors. It marks every cell whose value repeats inside its own row, column, or box, givens included. It consults the board and nothing else: it never reads the solution, so a wrong value that shares no unit with another is left unmarked, and a marked pair says only that both cannot stand, never which is wrong. Because it reveals nothing the player cannot already see, it spends no check, needs no confirmation, never sets the assistance latch, and leaves a run eligible for the `noHints` bucket. It also leaves the mistake count and the status text alone. A conflicting cell carries `is-conflict`, an amber tint layer, a corner wedge for anyone who cannot separate it from Errors by hue, and `Conflict.` at the end of its cell label. The mode persists with the puzzle like the others.
- Enabling Errors requires the puzzle-scoped confirmation alert. Cancel or Escape keeps Errors off and prompts again on the next attempt. Acceptance alone does not disqualify the puzzle.
- The irreversible assistance latch flips only when Errors mode visibly marks at least one incorrect value. Correcting the value, turning Errors off, undoing, or redoing cannot reverse it.
- Allowed checks remain eligible. Only completions without the assistance latch enter the existing `noHints` leaderboard bucket.
- Correct entries receive no live correctness coloring, and Errors-off edits do not expose the hidden mistake total.

The check count, accepted-warning state, assistance latch, and legacy reveal state persist with the puzzle. Undo history stores only board values, notes, and selection, so it cannot restore allowances or eligibility.

## Restored Puzzle Contract

- A puzzle restored from local storage keeps its elapsed time, entries, checks, and latches. If its completion latch is still open, restoring never requests a new session: it asks the Worker (`POST /sessions/:id/restore`) to reattach the *original* issued session, by its own id/token, at the local save's acknowledged input prefix. That only succeeds while the server still holds that session `ready` or `paused` at exactly that prefix; a running (unpaused) autosave or an offline save with no exported session has nothing to reattach, so it replays locally and stays fully playable, but any later completion for it has no issued session to claim and cannot publish as verified. See [leaderboard-result-verification.md](leaderboard-result-verification.md) for the restore contract and its timing-phase rules. A restored puzzle whose completion is already recorded never starts a session and never re-records.
- The verified descriptor and replay are exported with the save. Reloading reattaches only the original acknowledged proof; it does not mint a session for an arbitrary restored board. Legacy in-memory sessions do not survive reload.
- The legacy (`resultProtocol` 1) Worker path enforces a ten-second minimum from session issue, so a legacy session finished within ten seconds of pressing Play is rejected as too quick and stays local with the usual rejection status. The verified protocol instead requires server-acknowledged start/finish timing evidence; see [leaderboard-result-verification.md](leaderboard-result-verification.md).
- Tabs share one saved puzzle. Completions are claimed in the append-only `personalSiteSudokuCompletionsV1` list (last 500 puzzles by `puzzleId` and puzzle string), which ordinary debounced saves never write, so a stale save from another tab cannot erase a claim. On completion a tab flips its latch, checks the claim list, appends its claim, flushes its save, and records only when no other tab had claimed the puzzle. Other tabs adopt the claim from the `storage` event's payload, and a restored puzzle honours an existing claim. Clearing local game data removes the list.
- Browser storage offers no cross-window locking, so the claim list alone leaves three gaps, all requiring more than one tab: two tabs completing the same puzzle in the same instant can both publish; two tabs claiming different puzzles in the same instant can drop one claim (the read-append-write is not atomic), which lets an unsynchronised copy of that puzzle publish again; and a tab that missed the claim event and outlives 500 later completions can republish an evicted puzzle.
- The Worker closes all three. A Sudoku win carries `puzzleId` and the puzzle string, and the Worker records at most one win per player per puzzle, answering a duplicate with the result that already stands rather than an error. The claim list is now the fast local path, not the only guard. The identity contract, its rollout compatibility, and the D1 migration are in `game-stats-backend.md`.

## Interaction And Layout Contract

The Errors warning is a native modal `alertdialog` with the Sudoku sphere, exact disqualification copy, safe initial focus on Cancel, explicit focus wrapping, Escape cancellation, and focus restoration to Errors.

The bottom bar uses fixed mistake and timer tracks plus tabular numerals. Its geometry must remain unchanged for `Time: 00:00`, `Time: 99:59`, and `Time: 360:00`. The check allowance occupies its own full-width row.

## Integrity Contract

Changes to `scripts/home/main.js` or `scripts/home/core/dom.js` require regenerating the SHA-256 build version. The browser config, both HTML cache tokens, and both Wrangler configurations must share that version before release. Signed sessions, one-completion-per-puzzle latching, server-side event validation, and no-hints-only Sudoku aggregation remain mandatory.

Run:

```bash
node scripts/update-game-integrity.mjs
node scripts/update-game-integrity.mjs --check
node --test tests/sudoku-check-eligibility.test.mjs \
  tests/sudoku-completion-recording.test.mjs \
  tests/sudoku-stats-layout.test.mjs \
  tests/game-stats-integrity.test.mjs \
  tests/game-stats-worker.test.mjs
npx playwright test tests/ui/sudoku-check-controls.spec.mjs \
  tests/ui/sudoku-conflict-mode.spec.mjs \
  tests/ui/sudoku-publish-flow.spec.mjs
```

The check-controls spec covers the free clean check before and after the quota is spent, the three counted checks, and the refusal on a board with errors. The conflict-mode spec renders all four review viewports with a duplicate on the board and covers the marks, the unmarked wrong-but-unique value, the untouched counters and latches, both mode handovers, and the restore after a reload. The publish-flow spec covers a fresh puzzle, an acknowledged paused puzzle that restores its original session and publishes with the restored elapsed time, and a running/offline save that remains playable locally, one puzzle open in two tabs publishing exactly once, and a restored recorded puzzle that stays quiet. The eligibility unit test runs the real completion path against a storage stub for the cross-tab cases.

The rendered checks cover 375×812, 768×1024, 1280×800, and 1440×900. Before deployment, the local hash check must pass. After deployment, run the release parity check and require the deployed HTML, completion sources, browser config, and Worker health hash to converge.
