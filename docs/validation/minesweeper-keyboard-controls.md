# Minesweeper Keyboard Controls

- Purpose: Preserve the physical-keyboard control contract without allowing one open game window to consume another game's input.
- Scope: Minesweeper control-mode selection; S, D, and F actions; hover-only targeting; active-window, modifier, repeat, rebuild, and game-over guards; Snake coexistence; compact help window; accessible cell state and focus styling; responsive rendering.
- Last verified: 2026-09-08

## Contract

- Keyboard actions run only while the visible Minesweeper window is active.
- The control menu defaults to `Keyboard Controls (S/D/F)`. `Mobile Controls` shows the flag and maybe buttons while disabling keyboard shortcuts. `Click/Rt Click Only` hides those buttons and also disables keyboard shortcuts.
- Keyboard actions require a current-grid square under the mouse pointer. A previously clicked or focused square is never a fallback target.
- `S` reuses the normal left-click path, including first-click safety, reveal, and chord behavior.
- `D` directly toggles a maybe mark and `F` directly toggles a flag. These actions remain mutually exclusive and do not use the right-click three-state cycle.
- Repeated, composing, Control, Meta, and Alt key events are ignored. No-target, disabled-mode, or game-over input is inert.
- Snake accepts global keyboard input only while its own window is active, so a visible background Snake window cannot consume Minesweeper's `S` or `D`.
- The main title-bar `?` opens a compact `Keyboard Controls` window. Its mouse, maybe, and flag icon rows describe S, D, and F; its own `?` opens the Minesweeper Wikipedia page.
- The instructions define the current square as the square under the mouse pointer. Focus enters the help window, Escape and Close dismiss it, and focus returns to the main `?` button.
- In keyboard mode the grid exposes `aria-keyshortcuts="S D F"`. Cells announce their row, column, and state, and focused cells retain a visible outline without becoming the action target.

## Verification

Run:

```sh
npm test
npm run game-stats:integrity:check
npx playwright test tests/ui/minesweeper-keyboard-controls.spec.mjs tests/ui/minesweeper-mobile-controls.spec.mjs tests/ui/minesweeper-number-preload.spec.mjs
```

Rendered inspection covers `/home.html` at 375 × 812, 768 × 1024, 1280 × 800, and 1440 × 900. Inspect keyboard, mobile, and click/right-click modes plus the compact help window, hovered versus focused targets, flag, maybe, reveal, rebuilt-grid, game-over, and Snake-behind-Minesweeper states. Confirm no document overflow, clipping, hidden-control interaction, unexpected console errors, or page exceptions.

Direct localhost inspection can log the known production Game Stats CORS failure and intentional unused-number-preload warnings. The hermetic Playwright fixture disables the backend and must remain free of console errors and page exceptions.
