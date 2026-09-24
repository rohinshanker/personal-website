# Sudoku Leaderboard Eligibility

- Purpose: Preserve Sudoku check limits, assistance classification, completion recording, and responsive control behavior.
- Scope: Sudoku controls, saved puzzle state, no-hints leaderboard events, completion-source integrity metadata, and rendered browser validation.
- Last verified: 2026-09-24

## Eligibility Contract

- A fresh puzzle starts with Errors off, zero of three checks used, no accepted Errors warning, and no assistance latch.
- Each non-winning Check consumes one allowance and may reveal current mistakes. A valid completed board is a submission, not a diagnostic check, so it remains submittable after all three allowances are used.
- Once three diagnostic checks are used, another non-winning Check clears stale markers and reports only `No checks remaining`; it must not mark cells or expose a mistake count.
- The Reveal control and its automatic-cell-fill path do not exist.
- Enabling Errors requires the puzzle-scoped confirmation alert. Cancel or Escape keeps Errors off and prompts again on the next attempt. Acceptance alone does not disqualify the puzzle.
- The irreversible assistance latch flips only when Errors mode visibly marks at least one incorrect value. Correcting the value, turning Errors off, undoing, or redoing cannot reverse it.
- Allowed checks remain eligible. Only completions without the assistance latch enter the existing `noHints` leaderboard bucket.
- Correct entries receive no live correctness coloring, and Errors-off edits do not expose the hidden mistake total.

The check count, accepted-warning state, assistance latch, and legacy reveal state persist with the puzzle. Undo history stores only board values, notes, and selection, so it cannot restore allowances or eligibility.

## Restored Puzzle Contract

- A puzzle restored from local storage keeps its elapsed time, entries, checks, and latches. If its completion latch is still open, resuming play requests a fresh verified session, so the completion publishes like a new puzzle. A restored puzzle whose completion is already recorded never starts a session and never re-records.
- Sessions are in-memory, so a reload always discards the previous one. Do not reintroduce a blanket quarantine: before 2026-09-24 every page load after the first restored a saved puzzle, which silently kept every real Sudoku completion local and left the global Sudoku totals at zero.
- The Worker still enforces its ten-second minimum from session issue, so a restored puzzle finished within ten seconds of pressing Play is rejected as too quick and stays local with the usual rejection status.
- Tabs share one saved puzzle. Completions are claimed in the append-only `personalSiteSudokuCompletionsV1` list (last 500 puzzles by `puzzleId` and puzzle string), which ordinary debounced saves never write, so a stale save from another tab cannot erase a claim. On completion a tab flips its latch, checks the claim list, appends its claim, flushes its save, and records only when no other tab had claimed the puzzle. Other tabs adopt the claim from the `storage` event's payload, and a restored puzzle honours an existing claim. Clearing local game data removes the list.
- Known limits, all requiring more than one tab and none deduplicated by the Worker: two tabs completing the same puzzle in the same instant can both publish; two tabs claiming different puzzles in the same instant can drop one claim (the read-append-write is not atomic), which lets an unsynchronised copy of that puzzle publish again; and a tab that missed the claim event and outlives 500 later completions can republish an evicted puzzle. Browser storage offers no cross-window locking, so strict once-per-puzzle behaviour would need Worker-side idempotency by puzzle identity.

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
  tests/ui/sudoku-publish-flow.spec.mjs
```

The publish-flow spec covers a fresh puzzle, a restored unsolved puzzle that resumes into a second session and publishes with the restored elapsed time, one puzzle open in two tabs publishing exactly once, and a restored recorded puzzle that stays quiet. The eligibility unit test runs the real completion path against a storage stub for the cross-tab cases.

The rendered checks cover 375×812, 768×1024, 1280×800, and 1440×900. Before deployment, the local hash check must pass. After deployment, run the release parity check and require the deployed HTML, completion sources, browser config, and Worker health hash to converge.
