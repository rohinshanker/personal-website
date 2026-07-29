# Sudoku Leaderboard Eligibility

Purpose: Preserve Sudoku check limits, assistance classification, completion recording, and responsive control behavior.

Scope: Sudoku controls, saved puzzle state, no-hints leaderboard events, completion-source integrity metadata, and rendered browser validation.

Last verified: 2026-07-29

## Eligibility Contract

- A fresh puzzle starts with Errors off, zero of three checks used, no accepted Errors warning, and no assistance latch.
- Each non-winning Check consumes one allowance and may reveal current mistakes. A valid completed board is a submission, not a diagnostic check, so it remains submittable after all three allowances are used.
- Once three diagnostic checks are used, another non-winning Check clears stale markers and reports only `No checks remaining`; it must not mark cells or expose a mistake count.
- The Reveal control and its automatic-cell-fill path do not exist.
- Enabling Errors requires the puzzle-scoped confirmation alert. Cancel or Escape keeps Errors off and prompts again on the next attempt. Acceptance alone does not disqualify the puzzle.
- The irreversible assistance latch flips only when Errors mode visibly marks at least one incorrect value. Correcting the value, turning Errors off, undoing, or redoing cannot reverse it.
- Allowed checks remain eligible. Only completions without the assistance latch enter the existing `noHints` leaderboard bucket.
- Correct entries receive no live correctness coloring, and Errors-off edits do not expose the hidden mistake total.

The check count, accepted-warning state, assistance latch, and legacy reveal state persist with the puzzle. Restored puzzles remain quarantined from global publication. Undo history stores only board values, notes, and selection, so it cannot restore allowances or eligibility.

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
  tests/sudoku-desktop-layout.test.mjs \
  tests/game-stats-integrity.test.mjs \
  tests/game-stats-worker.test.mjs
npx playwright test tests/ui/sudoku-check-controls.spec.mjs \
  tests/ui/sudoku-publish-flow.spec.mjs
```

The rendered checks cover 375×812, 768×1024, 1280×800, and 1440×900. Before deployment, the local hash check must pass. After deployment, run the release parity check and require the deployed HTML, completion sources, browser config, and Worker health hash to converge.
