# Scourge Nest Emergence Inspection Checklist

Date: 2026-07-06

## Static Validation

- `node --check scripts/home/core/dom.js`
- `node --check scripts/home/core/media.js`
- `node --check scripts/home/main.js`
- `node --test tests/gears-nest.test.mjs`
- `git diff --check`
- `node scripts/build-study-resources-manifest.mjs`

## Test Environment

- Local static server for normal source:
  `python3 -m http.server 49831 --bind 127.0.0.1`
- Focused browser tests: headless Google Chrome over Chrome DevTools Protocol.
- Deterministic projectile/reload tests used a temporary test server that served
  the current `scripts/home/main.js` with test hooks inserted before the closing
  IIFE. Source files were not modified by the test hooks.

## Ready Prompt and Naming

- Debug random-event path opens the nest event window.
- Visible window title is `Scourge Nest Emergence`.
- Combat layer is visible before `Yes` is clicked.
- Windows-style prompt is nested inside the battlefield.
- Prompt title is visible over the battlefield.
- HUD is visible before `Yes`: Lancer ammo and COG Gear health are present.
- Ammo initializes as `32 / 32`.
- Health initializes as `100`.
- Cover controls are visible but disabled before `Yes`.
- `No` closes the event window.

## Background and Attribution

- Battlefield background image source is assigned.
- Battlefield background uses the local pasted image asset:
  `assets/random events/scourge-nest-background.png`.
- Background image carries the requested ArtStation project URL in
  `data-source-url`: `https://stefvelzeboer.artstation.com/projects/9eg9QW`.
- The local background image is included in `GEARS_NEST_ASSETS` so the random
  event preload path can load it before the event displays.
- COG Gear, Locust Drone, Boomer/Scion, and Lancer images are local WebP assets
  under `assets/random events/gears-nest/`, avoiding localhost reliance on
  Fandom/Wikia-hosted transformed image responses.

## Prompt Window Behavior

- Nested prompt title-bar text is white against the blue title bar.
- Nested prompt body text remains black.
- Nested prompt has `data-no-drag`, so dragging its title bar does not move it
  separately from the battlefield.

## Enemy Layout and Cover

- Five enemies render before combat starts.
- Four drone enemies have their own persistent cover props.
- The Boomer/big enemy does not have cover.
- Enemy cover ownership is explicit in event data: drones have cover slots, the
  Boomer does not.
- Enemy positions render within the battlefield and align to the visible ground
  plane.
- Enemy cover props stay rendered after their original enemy dies.
- Surviving drones can move into open cover slots after another enemy dies.
- Three player cover props stay fixed in the battlefield while the COG Gear
  moves between them.
- Enemy health bars render above every enemy's head.
- Enemy health is 90% of the prior 3x-scaled values while preserving
  proportional health bars: `81`, `92`, `76`, `81`, and `157`.

## Combat Start

- The random-event registration for `gears-nest-clear` uses `debug: false`.
- `Yes` hides the prompt and enables cover controls.
- Combat status changes to hold-fire guidance.
- Event state becomes active.
- Enemy attack interval is armed after `Yes`.

## NPC Attacks and Projectiles

- Boomer rocket branch adds a rocket hazard.
- Rocket warning label renders as `ROCKET`.
- Rocket uses `gears-nest-rocket-shot` animation.
- Rocket metadata includes source and target positions.
- Boomer receives an NPC firing indicator when launching a rocket.
- Boomer/Scion is excluded from the regular enemy bullet fallback and only
  attacks through the rocket hazard branch.
- Drone grenade branch adds a grenade hazard.
- Grenade warning label renders as `FRAG`.
- Grenade uses `gears-nest-grenade-arc` animation with continuous source-to-cover
  X travel and a single up/down Y arc.
- Grenade metadata includes source and target positions.
- Drone receives an NPC firing indicator when throwing a grenade.
- Cover can switch while a projectile warning is active.
- FRAG and ROCKET warnings render directly above their target cover rather than
  near the middle of the battlefield.
- Warning flashes use the full projectile fuse as one countdown and the gaps
  between flashes get progressively shorter through impact.
- Both hit and avoided projectile impacts render the local pixel explosion GIF
  at the struck cover, with a unique URL per impact so the animation restarts.
- Impact explosions are removed after `1800ms`.

## Player Firing

- Enemy cursor overrides the site-wide cursor theme with a retro crosshair.
- Holding mouse down on an enemy sets window and player firing state.
- Held enemy is marked as targeted while alive.
- Ammo drains by multiple rounds during a held burst.
- Player damage is 10% higher than the prior tuning: `3.85` against drones and
  `4.4` against the Boomer.
- The player remains exposed briefly after releasing fire before ducking back
  behind cover.
- Releasing the mouse clears the firing state.
- Player firing screenshot captured after cursor specificity fix.

## Damage Feedback and Exposure Timing

- Bullet hits while the player is behind cover reduce health without adding the
  red damage flash class.
- Bullet hits while the player is firing/out of cover reduce health and add the
  red damage flash class.
- Projectile hits while the player is exposed use the higher damage branch and
  add the red damage flash class.
- Projectile hits while the player stays behind cover use the covered damage
  branch and do not add the red damage flash class.
- Cover switching now exposes the player for the shortened cover-change window.
- Switching from center cover to right cover moves the COG Gear sprite while
  the three player cover prop rectangles remain fixed in place.

## Reload and Completion

- Rapid fire can reach the reload state during normal combat.
- Reload cursor appears while reloading.
- Ammo label changes to `Reloading...`.
- Reload completes and refills to `32 / 32`.
- Continuing combat can clear the nest.
- Completion result text is `Scourge Nest cleared.`
- Result window receives the cleared state.
- Result `OK` closes the event window.
- Failed completion tips the COG Gear image sideways; cleared completion leaves
  the player image upright.

## Responsive Visuals

- Mobile ready prompt fits a 390x740 viewport.
- No horizontal overflow detected for the event window or nested prompt.

## Runtime Health

- No `Runtime.exceptionThrown` browser events were observed in the successful
  follow-up pass.
- No `console.error` calls were observed in the successful follow-up pass.

## Balance and Effects Follow-up

- `node --test tests/gears-nest.test.mjs`: 11 tests passed.
- `node --check scripts/home/main.js`: passed.
- `git diff --check`: passed.
- The in-app browser runtime exposed no available browser for this follow-up,
  so the new health-bar, cover-warning, explosion, and failed-player visuals
  were not re-screenshot in this pass. The prior browser results above remain
  historical evidence, not validation of these new visual changes.

## Screenshot Artifacts

- `/tmp/personal-website-gears-nest-tests/desktop-ready-prompt.png`
- `/tmp/personal-website-gears-nest-tests/desktop-combat-start.png`
- `/tmp/personal-website-gears-nest-tests/desktop-rocket-shot.png`
- `/tmp/personal-website-gears-nest-tests/desktop-grenade-arc.png`
- `/tmp/personal-website-gears-nest-tests/desktop-hold-fire.png`
- `/tmp/personal-website-gears-nest-tests/desktop-reload.png`
- `/tmp/personal-website-gears-nest-tests/desktop-cleared.png`
- `/tmp/personal-website-gears-nest-tests/mobile-ready-prompt.png`
- `/tmp/personal-website-gears-nest-tests/latest-nest-local-background-prompt.png`
- `/tmp/personal-website-gears-nest-tests/latest-nest-cover-layout-ready.png`
- `/tmp/personal-website-gears-nest-tests/latest-nest-cover-layout-combat.png`
- `/tmp/personal-website-gears-nest-tests/latest-nest-cover-layout-combat-clean.png`
- `/tmp/personal-website-gears-nest-tests/latest-nest-cover-layout-after-drone-death.png`
- `/tmp/personal-website-gears-nest-tests/latest-nest-player-cover-switch.png`

## Reports

- Follow-up JSON report:
  `/tmp/personal-website-gears-nest-tests/followup-report.json`
- Local background/prompt JSON report:
  `/tmp/personal-website-gears-nest-tests/latest-local-background-report.json`
- Cover layout/combat tuning JSON report:
  `/tmp/personal-website-gears-nest-tests/latest-cover-layout-report.json`
- Player cover switching JSON report:
  `/tmp/personal-website-gears-nest-tests/latest-player-cover-switch-report.json`
