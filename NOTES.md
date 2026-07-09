# Work Notes

## 2026-07-08 Soot Sprites Random Event

- Added `soot-sprites` as an interactive random event using a System
  Alert prompt with the local `assets/app-icons/ico/hardware.ico` icon.
- `No` closes the alert. `Yes` captures the alert rectangle, waits while the
  swarm DOM is generated, then closes after the sprites, puffs, and candies are
  inserted.
- The swarm uses generated CSS/DOM shapes instead of image assets: fuzzy black
  bodies, irregular white eyes, randomized size/body radii, pastel konpeito-like
  star candies, and drifting soot puffs.
- Motion model: fewer sprites fountain out on computed parabolic paths, land on
  the taskbar line, and immediately scurry off the left or right edge.
- Sprites now release candy and soot continuously along the launch and run-off
  path. Soot puffs are darker, larger, more numerous, and linger longer before
  fading.
- Kept the design original while referencing susuwatari traits and konpeito
  candy color/shape notes from public references.
- Latest animation update makes each sprite start at its own
  parabolic peak, descend monotonically to the taskbar app strip, then switch to
  a linear left/right exit. The trail sampler now follows the same path contract
  as the visible sprite keyframes.
- Latest candy update doubles loose and trail candies, assigns each candy a
  random pastel green/pink/yellow/white/blue color, and makes every candy fall
  with gravity to the taskbar app strip where it rests before fading out.
- Latest tuning makes sprites hit the app strip sooner with a stronger fall
  acceleration curve and doubles the current candy emission again.
- Candy timing now keeps each piece parked on the taskbar app strip for an
  additional 4 seconds after its computed landing time before a separate fade
  animation begins. The swarm cleanup window is longer so late trail candies can
  finish that hold-and-fade cycle.
- Sprite motion no longer uses a steep exponent to fake acceleration. Each
  sprite now measures its parabolic fall distance and linear run-off distance,
  then uses distance-based keyframe offsets so the fall path travels at the same
  steady speed as the post-landing run.
- Candy landing now uses a separate toolbar-edge helper from sprite grounding:
  candy `landingY` is the toolbar top minus the candy size, so each piece rests
  on the top edge instead of hanging slightly below it.
- Each sprite now chooses an independent random run direction when it lands. It
  also gets a per-sprite 1-3s switch checkpoint; if it is still on screen at
  that checkpoint, a 55% roll can reverse its run direction, with the animation
  rebuilt as distance-measured run segments so speed stays steady.
- Sprite grounding now matches candy grounding: sprite `groundY` is the toolbar
  top minus the full sprite size, so soot sprites rest on top of the toolbar
  instead of sinking halfway into it.
- Soot puffs now use doubled size ranges, a 2:1 width-to-height cloud shape,
  and puff durations extended by 3 seconds.
- Smoke particle counts were reduced for performance: trail puffs now emit at
  1.4x sprite count and loose puffs at 0.48x sprite count, roughly one third of
  the previous larger-cloud release volume.
- When a soot sprite passes its delayed direction-switch roll, the reversed
  segment now gets a random 1-2x speed multiplier. Sprite keyframe offsets are
  computed from elapsed time so only the post-switch run accelerates.
- Soot Sprites now uses normal random-event probability gating instead of debug
  mode.

## 2026-07-08 Cursor Affordance Cleanup

- Root cause for inconsistent cursor behavior: `body *` assigns the normal
  cursor to every descendant, while many interactive cursor selectors only
  targeted the outer clickable element. Hovering over child text/images could
  therefore fall back to the normal cursor even when the parent control used the
  select cursor.
- Fixed the cursor rules by extending clickable, text, help, title-bar, and
  disabled cursor affordances to their descendants where appropriate.
- Kept `assets/cursor-assets/generated-png/` because those PNGs are the primary
  CSS cursor URLs and are preloaded by `scripts/home/main.js`; the `.cur` files
  are retained as fallbacks.
- Cleanup target: remove only unreferenced cursor-pack extras, not the active
  generated PNG cursor assets.
- Follow-up: clickable controls that sit inside draggable title bars now override
  the title-bar move cursor, including their child text/icons and pressed state,
  so close/minimize-style surfaces keep the select cursor.

## 2026-07-08 Spell on the Stack Random Event

- Added `spell-on-the-stack` as an interactive random event; it now uses normal
  probability gating instead of debug mode.
- The popup reuses the standard system-alert structure with the local
  `assets/random events/lightning-bolt.png` image.
- The Lightning Bolt art is rendered as a full-width spell image above the
  prompt instead of a 48px alert icon.
- The event now references the local PNG Lightning Bolt asset so the transparent
  corner cleanup is the displayed version.
- Added a 20px black inset inside the Lightning Bolt image frame so top and
  bottom spacing matches the side spacing treatment.
- Clicking `Yes` counters the spell: the screen flashes blue and the managed
  alert closes normally.
- Clicking `No` now briefly applies the existing red lightning border renderer
  plus a shake animation, then closes the managed alert normally.

## 2026-07-08 July 5 Calendar Event

- Added July 5 to the existing `calendarEvents` map with title `July 5th` and
  local image `assets/random events/jul5.png`.
- Reused the generic calendar event path, so the date receives the same
  `is-event-day` styling/effect and opens the standard random-event image
  window with the normal open/close animation.
- Only `scripts/home/main.js` changed for runtime behavior, so only the
  `main.js` query-string cache key needed to change.

## 2026-07-07 Wall Breach Random Event

- Added `wall-breach` as an interactive random event. It is now probability
  gated like the normal event pool rather than debug-forced.
- The requested Pinterest pin exposes a direct transparent RGBA PNG; vendored it
  as `assets/random events/wall-maria-logo.png` after confirming the outside
  pixels are fully transparent.
- The screen effect is event-local: three full-screen shakes are spaced 1.5
  seconds apart, followed by one final shake with a white flash. The popup opens
  only after the flash animation finishes.
- The popup now reuses the standard system-alert structure and sizing through
  `random-alert-window`, `random-alert-message`, and `random-alert-actions`.
- Chose a dedicated Wall Breach effect helper instead of generalizing the
  virus flash helper, because the sequence and duplicate-run guard are specific
  to this event.

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

## 2026-07-07 Relic Recovery Random Event

- Added `relic-recovery` as an interactive random event with the
  existing Windows-style window chrome.
- Reused the Pokémon event's dialog-card visual language for Nanachi's prompt
  and final message while keeping the Made in Abyss scene in a standard random
  event window.
- The event uses local `assets/random events/made-in-abyss-background.webp` as
  the landscape background and `assets/random events/nanachi-icon.webp` for the
  speaker icon.
- Vendored eight Fandom relic material images locally under
  `assets/random events/relic-recovery/`: Offering, Ugly Spinner, Ivy Badge,
  Pulled Teeth, Double-Bell Ball, Spiraling Heat Stone, Shatter Pot, and
  Tangled Fluid. The CDN returned WebP payloads, so the local filenames use
  `.webp`.
- Relic placements are deterministic and restricted to ground/ledge bands in
  the background. Lower foreground placements use larger scale values and
  higher z-index depths.
- Latest placement tuning spreads the eight relics across far background,
  mid-ground, and foreground bands while keeping all coordinates away from the
  scene edges so each scaled relic remains visible.
- Collection flow is prompt -> active scene -> centered relic detail card with
  wiki description -> hotbar slot fill -> final Nanachi dialog
  `Thanks for all the help. See you in Layer 2!` -> close.
- The Pokémon-style dialogue box is now reusable through shared
  `.pokemon-dialogue*` classes and shared typewriter helpers. The Pokémon
  starter event keeps its existing IDs/classes while Relic Recovery reuses the
  same border, text sizing, typewriter timing, arrow animation, and colored
  notable text treatment.
- Relic Recovery's hotbar now reserves square slots for every relic from the
  start, with greyed-out relic silhouettes before retrieval. Retrieved relic
  slots become full-color and show a name/description tooltip on hover/focus.
- Hovering unrecovered relics in the landscape now applies a grey glow without
  changing the relic's scale.
- Offering and Double-Bell Ball were moved to the upper-right background so
  they are no longer covered by the hotbar. Other relics keep foreground
  representation above the bar.
- Hotbar tooltips now use real DOM markup instead of pseudo-element text so the
  relic name can be bolded and colored per item while the description remains
  normal text. The Relic window/body/scene overflow is visible so these
  tooltips can spill over the event edge instead of being clipped.
- The centered relic detail popup now plays the standard `retro-window-close`
  animation before the relic is committed to the hotbar. A short timer fallback
  prevents the detail state from getting stuck if the animation event is missed.
- After the detail popup closes, the selected relic remains visibly centered as
  an event-local flyer and animates into its matching hotbar slot before the
  slot is marked retrieved.
- Unretrieved relics in the scene explicitly use the clickable/select cursor,
  while relic hotbar slots use the shared help/question-mark cursor so their
  tooltip affordance is visible.
- The detail popup is centered on the outer animated element with CSS
  `translate` instead of translating the inner panel. This keeps the
  `retro-window-open` clip/scale bounds aligned with the visible card and
  prevents only one corner from appearing during the first frames.
- The scene render now tracks a separate flying relic id so a relic cannot
  reappear at its original landscape position while its center-to-hotbar
  animation is running.
- The relic hotbar is layered above Nanachi's final dialog so collected-item
  tooltips can appear over the final text popup.
- The relic detail card overrides button `:active` styling, so clicking the
  info prompt starts the close/fly animation without showing a depressed
  Windows-button state.
- The relic detail card is no longer a native button. It keeps click plus
  Enter/Space close behavior, but pointer presses do not trigger browser button
  depression, blurred text, or inset border styling.
- Relic Recovery is no longer in debug mode; it uses normal random-event
  probability gating.

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

## 2026-07-07 Death Note Random Event

- Added a `death-note` random event using the shared managed random-event
  window lifecycle.
- The event opens a compact Windows-style window titled `Death Note` with a
  two-page notebook spread using inherited site fonts: a dark inside-cover page
  on the left with the `Death Note` title and three notebook rules, and a
  yellowed lined textarea page on the right that accepts typed multiline input.
- The lined page uses an I-beam cursor across the whole sheet; clicking anywhere
  on it focuses the writing area, with text aligned to the notebook ruling and
  no extra typing indent.
- The only control is `Close Notebook`, which closes the managed window with
  the normal close animation.

## 2026-07-07 Current Publicly Available Information Random Event

- Added `current-publicly-available-information` as a normal probability-gated
  random event.
- The window title is exactly `Current Publicly Available Information`, with
  the title-bar close button, a single image, and a bottom-right
  `Thanks for sharing...` button that closes the window.
- Vendored the first Current Publicly Available Information image from Season
  1, Season 2, Season 3, The Final Season, and OVA under
  `assets/random events/current-publicly-available-information/`.
- The Fandom CDN returned WebP payloads for these PNG source URLs, so local
  filenames use `.webp`.

## 2026-07-07 Spare a tRNA Random Event

- Added `spare-a-trna` as an interactive random event; it is now probability
  gated like the normal event pool rather than debug-forced.
- The event reuses the shared `random-alert-window`, `random-alert-message`,
  and `random-alert-actions` layout with a local clip-art ribosome SVG icon.
- Both `Yes` and `No` close the managed random-event window with the normal
  close animation.

## 2026-07-08 Cursor Refresh and Event Affordances

- The custom cursor sheet is cache-busted separately from random-event CSS so
  cursor asset/rule updates are not stuck behind older `cursors.css` cache
  entries.
- Startup/pageshow/activation now preloads the cursor assets without forcing a
  temporary native cursor. The earlier refresh class used
  `cursor: auto !important`, which could itself show the browser cursor during
  motion.
- The preload path fetches the light and dark PNG/`.cur`/`.ani` cursor assets
  with `fetch(..., { cache: "force-cache" })`. This avoids relying on the first
  hover/click to make the browser discover cursor image URLs.
- Added generated 32px PNG fallbacks for the static cursor states and placed
  them before the `.cur` URLs in `cursors.css`. The `.cur` files are retained
  as fallbacks, but the browser now has normal PNG cursor images to apply during
  initial page paint.
- Updated Death Note's clickable lined page to use `--cursor-text` instead of
  the browser-native `text` cursor. Buttons, title bars, relic selection, and
  relic hotbar help affordances already use the custom cursor variables.
- The global `html, body, body *` cursor rule is now `!important`, so moving
  over invisible overlays or older component rules cannot accidentally replace
  the custom default cursor. More specific custom affordance rules still
  override it for buttons, draggable title bars, help targets, and disabled
  controls.
- Removed the JS-rendered cursor image overlay after it proved visually
  distracting and less reliable than the browser cursor. `index.html` and
  `home.html` now keep the shared cursor stylesheet only, so cursor behavior is
  back to the normal CSS `cursor: url(...)` path.

## 2026-07-08 Nataraja Random Event

- Added an interactive random event with `id: "nataraja"`; it now uses normal
  probability gating instead of debug mode.
- The event opens a `Nataraja` window that plays local
  `assets/random events/nataraja.mp4` as a muted, autoplaying, looping video so
  it behaves like a GIF.
- Added the in-window art credit line `Art credit: u/sol_erides`.
- The bottom prompt says exactly `Leave an offering?`; both `Yes` and `No`
  close the managed random-event window and pause/rewind the video.

## 2026-07-08 Noble Steed Random Event

- Added `noble-steed` as an interactive random event using local
  `assets/random events/horse.jpeg` as the prompt icon.
- It uses normal probability gating rather than debug mode.
- The prompt title is `Noble Steed` and asks exactly
  `Bring your horse to water?`. `No` closes the prompt immediately.
- `Yes` closes the prompt, waits two seconds, then opens a same-position
  `System Alert` using `assets/app-icons/ico/globe_map.ico` with the message
  `The horse does not drink any water.` and a single `OK` button.

## 2026-07-08 Toxic Jungle Random Event

- Added `toxic-jungle` as an interactive random event that follows the Relic
  Recovery/Pokémon dialogue event shape. It now uses normal probability gating
  rather than debug mode.
- Local assets are `assets/random events/nausicaa.jpg` for the portrait and
  `assets/random events/toxic-jungle.webp` for the scene background.
- The start prompt says `Hey! Can you help me collect some spores?`; declining
  closes the window, while accepting starts floating blue, red, and white
  pastel spore collection.
- The top-right counter panel tracks each spore type to `10/10`; completing all
  three types shows `Thanks for the help! Watch your back out there.` with no
  button, and clicking anywhere in the completed window closes it.
- Spores start and finish their drift within the scene bounds so their circular
  clickable targets are not cropped by the jungle viewport.
- Spore visuals now use soft blurred halos/flecks for a fuzzy look. Counter
  panel icons reuse the fuzzy mark without outline frames and are centered in
  their rows.
- Floating spores now use a transparent square button with a separate circular
  visual core, avoiding the default Windows button minimum width that stretched
  the spore into an oval. Replacement spores start off-screen at the left with
  no negative animation delay.
- Hitting `10/10` for one color no longer removes every existing spore of that
  color; clicked spores past the cap disappear without respawning.
- Toxic Jungle, Relic Recovery, and Noble Steed all use normal probability
  gating now.

## 2026-07-09 Lancer Battle Close Controls

- Added a title-bar X to the `lancer-battle` event so the “enemy approaches”
  prompt can be dismissed before starting, and the same close control remains
  available during the rapid-click clash.
- The X uses the existing `closeLancerBattleWindow` path, preserving the
  established cleanup for timers, video playback, lightning effects, and stage
  reset behavior.
