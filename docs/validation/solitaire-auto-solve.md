# Solitaire Auto-Solve

Purpose: Finish a fully revealed Solitaire game with an animated card-by-card auto-solve, and stage that state from Admin Controls.

Scope: Solitaire toolbar swap, auto-solve availability rule, greedy foundation ordering, flight/flash/window-impact animation, victory playback, presentation-only Admin game-win preset, and browser interaction guards.

Last verified: 2026-09-21

## Contract

- **Preview gate.** `solAutoSolveOffered` only offers the control on boards
  staged by the Admin game-win preset (`solState.presentation` is set).
  Regular deals keep Reset even when fully revealed. Remove that condition to
  ship auto-solve to normal play once the live animation is approved.
- **Availability.** `solCanAutoSolve` is true when the game is not won, the
  stock is empty, every tableau card is face-up, fewer than 52 cards sit on the
  foundations, and `solPlanAutoSolve` returns a complete plan. Waste cards may
  remain; they are all face-up and reachable. Restocking the waste puts cards
  face-down again and hides the control until the player draws through them.
- **Toolbar.** While offered or running, `#sol-reset` is hidden and
  `#sol-auto-solve` (the `check.ico` button) takes its slot with the same
  70×34 frame and 22px pixelated icon as Reset and Undo. The button is disabled
  while a run is in progress. Reset returns once the game is won, so a new deal
  is always one click away.
- **Ordering.** Each step moves the lowest-ranked next-needed card among the
  four suits, taken from an exposed tableau top or from anywhere in the waste.
  This greedy order always completes a fully revealed board, so the plan is
  computed on the live state rather than stored.
- **Cadence.** `solAutoSolveTiming`: the first card leaves immediately, the
  next after 1000ms, and each interval shrinks by ×0.86 to a 120ms floor. Each
  card floats up for 55% of its interval (slow rise, slight scale) and snaps
  into its foundation over the next 30% with an ease-in curve. The next card
  leaves after the previous one lands.
- **Lift shadow.** The flying card animates a `drop-shadow` filter, never a
  `box-shadow`, so the shadow follows the sprite's transparent rounded corners
  instead of showing square corners over the board.
- **Impact.** On landing the state moves the card, `moves` increments, the
  board re-renders, `.sol-foundation-flash` appears as a solid white box with
  exactly the pile's rectangle and the card's corner radius
  (`--sol-card-w / 9`, 8px desktop and 6px mobile) so the flash edge sits on
  the card edge with the glow spreading outward (peak at 70ms, fade over the
  following 140ms). `assets/solitaire-cards/hero-parry.mp3` plays through a
  four-element `Audio` pool so rapid hits overlap; the Admin audio-off switch
  mutes it through its `HTMLMediaElement.play` hook. The Solitaire window is
  knocked 12px along the card's travel direction with a short rebound via the
  Web Animations API (`composite: "add"`, skipped under reduced motion).
- **Victory.** After the last card lands `solCheckWin` runs, so the Victory
  Royale video, fireworks, achievement, stats event, and gameWin random events
  fire exactly once and only at the end. Undo stays disabled while solving and
  after the win.
- **Guards.** Board clicks, keyboard activation, and pointer events are blocked
  during a run. Reset, a new deal, or closing the window calls
  `solCancelAutoSolve`, which removes flight layers, cancels the window
  animation, and re-renders with the check button re-enabled.
- **Admin game-win preset.** `runPreset("game-win")` opens Solitaire and calls
  `solStagePresentationWin({ visualEffects })`: four face-up King-to-Ace
  runs (spades/hearts, hearts/spades, clubs/diamonds, diamonds/clubs) in the
  first four columns, empty stock, waste, and foundations, zero moves, and no
  stats session. The check button is ready; nothing plays until it is pressed.
  Presentation boards never publish statistics or trigger random events, even
  when finished by hand; the visual-effects switch skips fireworks and the
  achievement but always plays the video.

## Verification

```bash
node --test tests/solitaire-auto-solve.test.mjs tests/admin-controls.test.mjs
npx playwright test --project=ui tests/ui/solitaire-auto-solve.spec.mjs tests/ui/admin-controls.spec.mjs
```

The Node suite proves the cadence shape, the presentation tableau, plan
completeness for the staged board and 300 random fully revealed boards with
loose waste cards, availability edge cases, markup, styles, and runtime wiring.

The browser suite runs real auto-solves (fast cadence via source
instrumentation, plus one production-cadence timing check), verifies the
preview gate on a regular revealed deal, the swap,
icon geometry, input blocking, the drop-shadow lift, 52 flashes sitting on
their piles with a window animation and an impact sound each (muted under
Admin audio-off), final foundations, move counter, victory overlay, cancellation on close, the
visual-effects switch, and the staged board at 375×812, 768×1024, 1280×800, and
1440×900 with no page overflow.

For rendered inspection without tests, serve the checkout, open Home, run
`window.rohinAdminOrchestrator.runPreset("game-win", { visualEffects: true })`
in the console, and press the check button.
