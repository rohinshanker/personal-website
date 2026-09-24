# Sudoku Board Controls

- Purpose: Preserve the keypad, highlight, and keyboard contract for the Sudoku board.
- Scope: Keypad exhaustion, same-value highlighting, the N notes shortcut with its hover hint, window-level digit entry, and rendered browser validation.
- Last verified: 2026-09-24

## Contract

- A digit with nine placements on the board is exhausted: its keypad button gains `is-exhausted`, is disabled, and renders greyed. Placements count givens and entries alike, so a wrong ninth entry still exhausts the digit. Keyboard entry stays open so that entry can be overwritten; clearing any placement re-enables the button.
- Selecting a cell with a value adds `is-same-value` to every other cell holding that value. The selected cell keeps only `is-selected`; row and column cells keep `is-axis-highlight`. The value tint is the `--sudoku-value-highlight` layer, present on plain and given cells, and it refreshes after every value change, undo, redo, and selection.
- `N` toggles notes while the visible Sudoku window is the active window and the game is playing. It is ignored during the Errors prompt, with Control, Meta, or Alt held, while repeating, and inside text inputs. The Notes button exposes `aria-keyshortcuts="N"` and is described by the hint.
- Hovering the Notes button shows `Press N to toggle` in the Solitaire pile-hint style: black, white text, no transition, `position: fixed`, twelve pixels below and right of the pointer, pulled back four pixels from the viewport edge, hidden on pointer leave. The hint is a body-level `#sudoku-note-tooltip` with `role="tooltip"` so window transforms cannot displace it, and it ignores touch pointers.
- Digits, `0`, Backspace, and Delete edit the selected editable cell whenever the active Sudoku window is playing, even while a keypad, difficulty, hint, or action button holds focus. Notes mode is honoured. Events the grid already handled, modifier chords, text inputs, and given cells are left alone. While the solved dialog or the Errors prompt is open, window-level keys are inert, so a keypress on the focused OK button cannot edit a finished board.

## Verification

Run:

```bash
node --test tests/sudoku-check-eligibility.test.mjs tests/sudoku-completion-recording.test.mjs
node scripts/update-game-integrity.mjs --check
npx playwright test tests/ui/sudoku-board-controls.spec.mjs tests/ui/sudoku-desktop-layout.spec.mjs tests/ui/accessibility.spec.mjs
```

The spec renders 375×812, 768×1024, 1280×800, and 1440×900 with an exhausted digit and its highlighted placements, then verifies the greyed keypad color and opacity, the tint on exactly the eight matching cells, no document overflow, the hint's computed style and pointer tracking, typed entry from focused panel buttons, and that keys pressed on the solved dialog leave the board, notes mode, and status unchanged. Screenshots land under `test-results/` as `sudoku-board-controls-<w>x<h>.png` and `sudoku-note-hint-1280x800.png`. Changing `styles/home/apps/sudoku.css` requires a new cache token in both HTML entry points and the eligibility test.
