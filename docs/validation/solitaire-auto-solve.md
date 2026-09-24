# Solitaire Auto-Solve

- Purpose: Finish a fully revealed Solitaire game with an animated card-by-card auto-solve, and stage that state from Admin Controls.
- Scope: Solitaire toolbar swap, auto-solve availability rule, greedy foundation ordering, flight/flash/window-impact animation, victory playback, presentation-only Admin game-win preset, and browser interaction guards.
- Last verified: 2026-09-24

## Contract

- **Availability.** `solCanAutoSolve` is true when the game is not won and at
  least one visible card fits a foundation: an exposed tableau top or the top
  waste card whose rank is the next for its suit. Buried waste cards and
  face-down cards do not count until they surface. This applies to every deal.
- **Toolbar.** While offered or running, `#sol-reset` is hidden and
  `#sol-auto-solve` (the `check.ico` button) takes its slot with the same
  70×34 frame and 22px pixelated icon as Reset and Undo. The button is disabled
  while a run is in progress. When the planned run reaches all 52 cards the
  button carries `is-completing`: a gold pseudo-element glow that pulses
  opacity only, plus the label "Auto-solve and win the game". Reset returns
  whenever nothing visible fits, including after the win.
- **Ordering.** `solPlanAutoSolve` simulates the run on a clone: each step
  moves the lowest-ranked playable card, flips a face-down tableau card that
  surfaces, and stops when nothing visible fits. It returns the move list and
  a `completes` flag. The plan is recomputed on every render from live state.
- **Moves and undo.** Every landed card counts as one move. Starting a run
  pushes one undo snapshot, so Undo reverts the whole batch in a single step
  unless the run won the game.
- **Cadence.** `solAutoSolveTiming`: the first card leaves immediately, the
  next after 1000ms, and each interval shrinks by ×0.86 to a 120ms floor. Each
  card floats up for 55% of its interval (slow rise, slight scale) and snaps
  into its foundation over the next 30% with an ease-in curve. The next card
  leaves after the previous one lands.
- **Lift shadow.** The flying card animates a `drop-shadow` filter, never a
  `box-shadow`, so the shadow follows the sprite's transparent rounded corners
  instead of showing square corners over the board.
- **Impact.** On landing the state moves the card, `moves` increments, and
  `solRenderLanding` removes only the source card element and re-renders the
  destination pile, counter, and toolbar; a full board render happens only
  when the source was the waste, the column emptied, or a card flipped.
  `.sol-foundation-flash` appears as a solid white box with
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
  animation, and re-renders with the check button re-enabled. Cancelling
  mid-run leaves the landed cards in place; Undo reverts them.
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
legality and stopping rules over 300 random boards with face-down prefixes and
loose waste cards, the partial run that stops at a buried Ace, flips, the
completion flag, markup, styles, and runtime wiring.

The browser suite runs real auto-solves (fast cadence via source
instrumentation, plus one production-cadence timing check), verifies a partial
run from a drawn Ace with its single-step Undo, the gold glow on a completing
regular deal, the swap,
icon geometry, input blocking, the drop-shadow lift, 52 flashes sitting on
their piles with a window animation and an impact sound each (muted under
Admin audio-off), final foundations, move counter, victory overlay, cancellation on close, the
visual-effects switch, and the staged board at 375×812, 768×1024, 1280×800, and
1440×900 with no page overflow.

The lift probe and the landing timestamps are taken inside the page's own
mutation observer against the page's click timestamp. Reading them from the
test runner instead let a slow CI runner miss the 80 ms fast flight and skew
the cadence by half a second (six consecutive failures on 2026-09-24).

For rendered inspection without tests, serve the checkout, open Home, run
`window.rohinAdminOrchestrator.runPreset("game-win", { visualEffects: true })`
in the console, and press the check button.
