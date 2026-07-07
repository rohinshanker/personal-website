# Work Notes

## 2026-07-05 Gradescope Random Event Debug Mode

- The Gradescope curve random event is registered in `scripts/home/main.js` as
  `id: "gradescope-curve"`.
- Random events already support per-event debug through the `debug` field.
  Debug mode bypasses the normal probability and scheduling limits on most
  random-event triggers.
- Smallest change: set only the Gradescope curve registration to `debug: true`
  instead of enabling `RANDOM_EVENT_GLOBAL_DEBUG`.
- Because this is a static site with query-string cache busting, update the
  `scripts/home/main.js` version reference after editing the script.
- Applied the scoped debug flag and updated `home.html` plus `index.html`
  `main.js` cache keys to `gradescope-debug-20260705`.
- Verification: `node --check scripts/home/main.js` passes.

## 2026-07-06 Maintainability Refactor

- Project shape: static HTML/CSS/vanilla JS site. There is no local package
  manifest, formatter, linter, type checker, or bundled build step.
- Existing worktree is dirty, including recent edits to `home.html`,
  `index.html`, `scripts/home/main.js`, `scripts/home/core/dom.js`, portfolio
  CSS, random-events CSS, and project media assets. Refactor changes should
  preserve those edits and avoid unrelated cleanup.
- Safe scope: improve machine readability inside the existing script structure
  instead of changing routes, IDs, public filenames, load order, or app behavior.
- Chosen changes:
  - Add selector helper primitives to the DOM lookup module while preserving
    exported DOM property names.
  - Add JSDoc-like structured contracts for reusable gallery media data.
  - Extract repeated project gallery rendering and random-event window lifecycle
    patterns into small, named helpers.
  - Keep cache-busting query strings updated only for files changed by this pass.
- Avoided: splitting `main.js` into modules. The page currently depends on
  direct non-module script loading and shared globals, so module conversion would
  be a larger architectural change.
- Regression results are recorded in
  `docs/notes/maintainability-refactor-regression-tests.md`.

## 2026-07-06 Gears Nest Random Event

- Added a debug-enabled interactive random event with `id: "gears-nest-clear"`.
  It uses the existing managed random-event lifecycle instead of changing the
  scheduler.
- Gears Wiki terminology used in the prompt and UI: E-Hole, Drone Nest, Grubs,
  COG Gear, Lancer, Locust Drone, and Boomer.
- Wiki-hosted images are referenced with deferred loading in the HTML and
  preloaded through `GEARS_NEST_ASSETS` in `scripts/home/main.js`.
- Combat is event-local state: player health/ammo, three fixed player cover
  positions, enemy health, enemy cover slots, reload, peeking, cover switching,
  grenade hazards, and Boomer rocket hazards are all kept in a single
  `gearsNestState` object.
- Avoided adding a new game framework or dependency; the interaction is small
  enough to fit the existing random-event pattern.
- Follow-up request changes the nest event to start inside the combat scene:
  HUD, cover controls, Lancer, and health are visible immediately, with the
  Yes/No confirmation rendered as a smaller Windows-style alert over the
  battlefield.
- The requested ArtStation background is the Stef Velzeboer "Gears 5 - Swarm
  Pods" project. The text page is reachable for attribution, but direct media
  discovery may require browser-style loading because command-line ArtStation
  requests are Cloudflare-challenged.
- Implemented behavior changes: click-and-hold rapid fire on enemies, visible
  player and NPC muzzle/fire indicators, cover markers for smaller enemies,
  arcing grenade throws, Boomer rocket trails, enemy-hover crosshair cursor, and
  firing shake feedback.
- The event is visibly titled "Scourge Nest Emergence"; the existing internal
  random-event id remains `gears-nest-clear` so scheduler references do not
  churn.
- ArtStation direct image/API access remained blocked by Cloudflare from this
  environment, so the battlefield uses the reachable Gears nest image URL and
  retains the requested ArtStation project URL as `data-source-url` on the
  background image for attribution and future inspection.
- A follow-up retry against the ArtStation page, public JSON endpoint, and
  headless browser loading still returned Cloudflare challenge content rather
  than direct media URLs; the event must not use the project page URL as an
  image source because it would fail to render.
- Enemy health is scaled from structured base values at combat-state creation,
  so all enemies are tougher without changing render code or health-bar math.
- Damage feedback now distinguishes true out-of-cover hits from cover chip
  damage: the red screen flash only appears when the player is exposed by
  firing or switching cover.
- Cover switching exposure was shortened, while firing now keeps the player
  exposed for a brief recovery delay after releasing the mouse.
- Follow-up background change uses the user-provided pasted ArtStation image as
  a local asset at `assets/random events/scourge-nest-background.png` for the
  nest battlefield background and preload target.
- The nested Windows-style nest prompt now has `data-no-drag`, so the global
  title-bar drag handler leaves it fixed in the battlefield. Its blue title bar
  text is white while the prompt body text remains black.
- Focused validation and manual inspection categories are recorded in
  `docs/notes/gears-nest-emergence-tests.md`.
- Latest nest follow-up adds a fourth small drone, lines the enemy sprites up
  lower on the battlefield, triples enemy health, doubles the Lancer magazine
  to 32, halves player shot damage, separates the three player cover props from
  the moving COG Gear sprite, keeps enemy cover props on the map after deaths,
  and lets surviving drones reassign to open cover slots.
- Current nest follow-up reduces the scaled enemy-health pool by 10% and raises
  the player's Lancer damage by 10%. "Attack damage" is treated as player
  damage because the existing `GEARS_NEST_DRONE_DAMAGE` and
  `GEARS_NEST_BOOMER_DAMAGE` values are applied by the player's firing path;
  enemy outgoing damage remains unchanged.
- Enemy health meters move above the sprites. FRAG and ROCKET warnings sit just
  above their target cover and use a single accelerating countdown animation
  tied to the projectile fuse, so the final flashes converge on impact.
- Frag and Boomshot impacts render the existing local
  `assets/random events/pixel-explosion.gif` at the struck cover. Failed runs
  tip the COG Gear sprite sideways while successful runs leave it upright.
- The big Boomer/Scion enemy is no longer eligible for the enemy regular-gun
  fallback attack. It can still launch Boomshot rocket hazards; if no drone is
  available for bullets and the rocket branch is unavailable, that attack tick
  intentionally does nothing.
- Grenade throws now use one continuous linear X travel from enemy to target
  cover, with only the Y position rising to the peak and falling to impact, so
  the grenade no longer appears to snap back toward the thrower mid-flight.
- Nest character/weapon images are now vendored locally under
  `assets/random events/gears-nest/` because the prior Fandom/Wikia URLs return
  transformed WebP responses and are brittle when testing from localhost.
- The Nest random event registration is no longer in debug mode; it now uses
  normal random-event probability gating.

## 2026-07-06 Gears Lancer Battle Random Event

- Added a second Gears random event with `id: "lancer-battle"` and
  regular random-event probability gating.
- Reused the existing Resist Causality lightning-border renderer and XP window
  lifecycle instead of adding another animation system.
- The supplied clash media is an MP4 response from Imgix, so the event uses a
  deferred `<video>` element. This allows the last second to be manually
  boomeranged during the mash phase.
- Outcome media is shown in a timed result stage and then removed before
  showing the final close prompt, which prevents media from continuing behind
  the final state.
- Follow-up result-state change replaces both result GIFs with local MP4 clips
  under `assets/random events/lancer-battle/`. The win asset is the
  `29.5-36.5` section of `https://www.youtube.com/watch?v=Bic2bBf0LsY`; the
  loss asset is constrained to the `21.5-25.0` section of
  `https://www.youtube.com/watch?v=RiU1uezCjgQ`. Local `<video>` playback
  removes YouTube iframe controls entirely.
- The success final prompt now says exactly `Good job, Gear.` and relabels the
  final close button to `OK`; the loss path closes directly after its result
  clip.
- Follow-up ready-state change adds the user-provided pasted PNG as a local
  `assets/random events/lancer-battle-ready.png` image inside the same
  `.lancer-battle-media-frame` used by the clash and result stages so the
  Lancer battle window does not resize between the prompt and combat states.
- Follow-up color change adds an `is-ready` state class to the Lancer battle
  window so only the initial prompt uses the standard Windows surface
  background and black text; clash/result/final states keep the darker combat
  treatment. The initial prompt body copy is centered inside that standard
  Windows-style ready state.
- Latest Lancer follow-up removes the fixed body height so there is no dead
  space beneath the action buttons, renames the mash button to `Fight Back`,
  keeps that button disabled until the active clash begins, and extends the
  manual clash boomerang range to the end of the source media.
- The Lancer ready prompt now says exactly `Delta Squad, an enemy approaches.
  Hold the line!`.
- The Lancer clash meter now aliases the Berserk `Resist Causality` progress
  constants for starting value, click gain, drain interval, and drain amount.
- Latest Lancer tuning makes only the last 0.5 seconds of the clash media
  boomerang, slows the manual clash boomerang to 60% of its prior step rate,
  makes `Fight Back` clicks count toward the general random-event click counter
  with 40% probability, restores the Lancer window body to the standard Windows
  surface colors, and changes the loss result to title-only
  `You get Overwhelmed` before closing directly after the loss clip.
- Lancer battle lightning uses a yellow palette and only pulses with the window
  shake on valid `Fight Back` button or keyboard mash inputs, mirroring the
  Resist Causality input feedback instead of running continuously during the
  clash.
- The Lancer loss clip stays open for 3.45 seconds before closing, giving the
  video an extra 0.25 seconds of playback time after the title-only loss state.
- The Lancer win final prompt now uses `assets/app-icons/ico/gears.ico` and the
  shared one-icon alert layout for standard icon, text, button, width, and
  positioning.
- After the Lancer win clip finishes, the result video window now plays the
  normal close animation, then the compact `Good job, Gear.` prompt opens with
  the normal window open animation.
- Focused browser validation and the inspection checklist are recorded in
  `docs/notes/gears-lancer-battle-tests.md`.
