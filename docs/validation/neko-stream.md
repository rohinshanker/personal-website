# Neko Stream

Purpose: Preserve the Neko launcher and random-event entry points, bounded taskbar stream, shared sprite timing, and accessible interaction behavior.

Scope: Desktop and taskbar Neko launchers, random-event confirmation, focus, 40-cat planning and animation, sprite preloading, cleanup, and responsive taskbar geometry.

Last verified: 2026-07-29

## Behavior Contract

- Right-click, Shift+F10, or the Context Menu key on either Neko launcher opens one viewport-bounded menu item named `/nekostream`. Ordinary left-click behavior remains the independent mouse-following Neko.
- The interactive `System Alert` whose exact message is `Trigger /nekostream?` currently has its per-event debug flag enabled for inspection. Pressing Start force-selects it while debug is enabled; unrelated app interactions remain unobstructed. The debug run bypasses the global trigger cooldown and kind capacity but still respects the two-minute per-event selection lockdown, duplicate-pending guard, random zero-to-two-second delay, gameplay locks, and visibility guard.
- The random-event preloader warms the prompt plus both sleeping sprites before opening. The decorative icon alternates `sleep1` and `sleep2` every 850 milliseconds; reduced-motion users receive a static first frame and no shell opening or closing animation.
- Yes and No both close the alert and synchronously restore the prior focus target. Escape is equivalent to No. Only the first valid Yes response starts the stream; duplicate clicks during or after closing cannot replace or start another wave.
- One command schedules exactly 40 cats in forty consecutive 250-millisecond slots across ten seconds, with an independent random offset inside each slot. Each enters from a random side at 0.8–1.7 times the roaming Neko's canonical 10-pixel-per-100-millisecond speed.
- Each cat independently receives one 25% action opportunity at a fully visible point between 20% and 80% of its inbound crossing. The five action choices are equally weighted. Sit and scratch each last an independently sampled five to ten seconds. Clean has the same sampled duration and repeats an exact one-second awake pose followed by two seconds of washing. Yawn lasts exactly three seconds and stretches the canonical four-frame sequence across that interval. Sleep lasts exactly twenty seconds using the canonical 800-millisecond nap cadence.
- An action can run only once. After completion, the cat samples a new left/right direction and bounded speed. Cats without an action continue across the viewport.
- A cat is removed only after its center passes the viewport by the two-sprite safety margin. One shared animation frame owns all active cats and stops when none remain.
- Starting a new stream replaces the prior wave. Page exit clears pending timers, the shared frame, and every stream element. Sprite preloading completes before the ten-second cadence begins so loading cannot collapse elapsed slots into a burst.

## Interaction And Layout Contract

The menu is a real `role="menu"` with one `role="menuitem"`. Escape and command activation restore launcher focus; Tab and Shift+Tab move to the adjacent launcher control; resize and scroll dismiss the menu while retaining focus. Pointer or context-menu dismissal outside the menu leaves focus with the user's new target. Desktop keyboard focus remains visibly outlined.

The confirmation window is a non-modal `role="alertdialog"` named `System Alert` and described by its exact prompt. Its sleeping Neko icon is decorative, Yes receives initial focus, and focus leaves the dialog before it becomes `aria-hidden`.

The stream layer is decorative, clipped to the viewport, non-interactive, and stacked above the fixed taskbar. Every cat has empty alternative text, `aria-hidden="true"`, and `pointer-events: none`, so the taskbar remains operable. Live taskbar geometry plus per-sprite measured alpha baselines keep both running frames and every non-sleep action touching the taskbar exactly after activation and resize. Both sleeping frames sit one CSS pixel lower: only their bottom paw row overlaps the taskbar, while the main body remains above it.

## Validation

Run:

```bash
node --test tests/neko-stream.test.mjs tests/random-event-cooldown.test.mjs
npx playwright test tests/ui/neko-stream.spec.mjs --workers=1
node scripts/update-game-integrity.mjs --check
npm test
npm run test:ui -- --workers=1
```

The browser suite covers forced debug-event scheduling, the two-second maximum delay, preload completion, duplicate scheduling, accessible prompt semantics, icon cadence, reduced motion, No/Escape rejection, double-Yes protection, synchronous focus restoration, and exactly one 40-cat wave. It also covers the real menu command, one cumulative spawn per 250-millisecond slot, 0.8–1.7 speed bounds, the one-second/two-second clean cycle, fixed three-second yawn, five-, seven-and-a-half-, ten-, and twenty-second action boundaries, repeated action frames, one-action latching, mid-action page-exit cleanup, restart replacement, natural offscreen cleanup, sprite loading, per-frame pixel-alpha contact and sleep overlap, overflow, and taskbar layering at 375×812, 768×1024, 1280×800, and 1440×900. An active mobile stream is resized to 844×390 to recheck the live taskbar baseline.

Because the implementation and DOM references live in `scripts/home/main.js` and `scripts/home/core/dom.js`, changes require `node scripts/update-game-integrity.mjs` followed by its `--check` form. Commit the generated browser config, both HTML cache tokens, and both Wrangler build versions together.
