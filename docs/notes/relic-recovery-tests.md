# Relic Recovery Inspection Checklist

Date: 2026-07-07

## Static Validation

- `node --test tests/gears-nest.test.mjs`
- `node --check scripts/home/core/dom.js`
- `node --check scripts/home/core/media.js`
- `node --check scripts/home/main.js`
- `git diff --check`

## Sources and Assets

- Relic names, descriptions, and source images come from
  `https://madeinabyss.fandom.com/wiki/Relic_Material`.
- The page describes the requested relics as examples of relic material:
  Offering, Ugly Spinner, Ivy Badge, Pulled Teeth, Double-Bell Ball, Spiraling
  Heat Stone, Shatter Pot, and Tangled Fluid.
- Relic images are vendored locally under
  `assets/random events/relic-recovery/` to avoid runtime CDN dependency.
- The local `made-in-abyss-background.webp` image is used for the scene.
- The local `nanachi-icon.webp` image is used in the dialogue prompt.

## Event Flow

- `relic-recovery` is registered as an interactive random event with
  `debug: true`.
- Window uses standard title-bar/window-body chrome and the shared random-event
  open/close animations.
- Initial Nanachi dialog says `Let's collect some relics!`.
- Nanachi's dialog uses the same reusable Pokémon-style dialog classes,
  typewriter timing, arrow animation, and bold colored notable-text spans as
  the Pokémon starter selection event.
- Initial dialog actions are `Sounds good!` and `Maybe another time.`.
- `Maybe another time.` closes the whole event.
- `Sounds good!` hides the dialog and starts the collection scene.
- Eight relic buttons render on ground/ledge regions of the background.
- Relics use fixed coordinates and scale values, with smaller scale in the
  background and larger scale in the foreground.
- Relic coordinates stay within safe in-frame bounds and are distributed across
  far background, mid-ground, and foreground bands instead of clustering near
  the front.
- Offering and Double-Bell Ball sit in the upper-right scene area, away from
  the bottom hotbar.
- Clicking a relic opens a centered detail card with the relic image, name,
  wiki description, and `[Press anywhere to continue]`.
- Clicking while the detail card is open plays the standard close animation on
  the detail popup before the relic moves to the hotbar.
- Continuing keeps that relic visible at center screen, then flies it into its
  matching grey hotbar slot at the bottom.
- The hotbar has eight square slots and shows a greyed-out silhouette for each
  unretrieved relic.
- Retrieved hotbar relics become full-color and expose a hover/focus tooltip
  with the relic name and wiki description.
- Tooltip names are bold and colored per relic based on the corresponding
  image palette, and tooltips can overflow outside the event window without
  clipping.
- Hovering unretrieved relics in the landscape gives them a grey glow without
  scaling them larger.
- After all relics are collected, Nanachi says
  `Thanks for all the help. See you in Layer 2!`.
- Clicking `Continue` on the final dialog closes the whole event.
