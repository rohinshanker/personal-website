# Data-Driven System-Alert Random Events

- Purpose: Preserve the copy/paste authoring, validation, registration, preview, and interaction contract for basic system-alert random events.
- Scope: `scripts/home/system-alerts.js`, the shared Home alert shell and renderer, random-event registration, Administrator labels/previews, icon preloading, focus, responsive layout, and reduced motion.
- Last verified: 2026-10-18

## Authoring Contract

Add a basic alert by copying the marked object beside `SYSTEM_ALERT_INPUTS` in `scripts/home/system-alerts.js`. A unique lowercase kebab-case `id` of at most 96 characters, a manifest-backed `assets/app-icons/ico/*.ico` path, and nonempty plain-text `body` are required. `label` controls the Administrator-facing name; `title` defaults to `System Alert`.

Omitting `buttons` creates one `{ label: "OK", action: "dismiss" }` button. Omitting `buttonAlignment` selects `right`. Explicit buttons retain their configured order and may use `left`, `center`, or `right`; `dismiss` is the only supported action. Configuration cannot contain executable handlers.

Normalization fails synchronously for duplicate or malformed alert IDs, blank text, invalid or unlisted icons, unsupported alignment, missing or empty button arrays, malformed or duplicate button IDs, and unknown actions. The normalized list, entries, and buttons are recursively frozen. If a new icon is added to the repository, regenerate and verify the icon manifest before referencing it:

```sh
node scripts/build-app-icon-manifest.mjs
node scripts/build-app-icon-manifest.mjs --check
```

## Runtime Contract

- Every entry automatically registers as `debug-system-alert-<id>` for compatibility, but has `debug: false` and participates in normal probability gating, cooldown, per-event lockdown, gameplay locks, and the shared-shell visibility guard.
- Registration preloads the configured icon and stores normalized alert metadata for Administrator labels and previews. No entry needs separate HTML, DOM bindings, CSS, registration, or rendering code.
- The live alert and inert Administrator preview use the same renderer. Text uses `textContent`; long, multiline, and HTML-like strings remain plain text.
- Buttons are native controls with stable `data-system-alert-button-id` and `data-system-alert-action` attributes. The first button receives focus. Dismissal works through pointer, touch, Enter, Space, or Escape and restores the prior connected focus target.
- Left, center, and right action groups wrap without viewport overflow. Reduced-motion users receive no opening or closing animation, and close cleanup/focus restoration completes synchronously.

## Verification

Run:

```sh
node --test tests/debug-system-alerts.test.mjs tests/random-event-cooldown.test.mjs
npx playwright test tests/ui/debug-system-alerts.spec.mjs tests/ui/admin-controls.spec.mjs
node scripts/update-game-integrity.mjs --check
npm test
```

The focused browser suite renders every production alert at 375×812 and 1280×800. Synthetic default, left-, center-, right-, multi-button, long, multiline, unbroken, and HTML-like configurations run at 320×568, both sides of the compact-width breakpoint, 375×812, 768×1024, 1280×800, and 1440×900. It also verifies accessible name/description, initial focus, Enter, Space, Escape, shared-shell locking, repeated opening, focus restoration, reduced motion, viewport/taskbar containment, icon decoding, overflow, and console/runtime errors. Administrator coverage checks exact-once registration, preview fidelity, direct triggering, and dismissal.

Because the renderer lives in `scripts/home/main.js`, changes require `node scripts/update-game-integrity.mjs` followed by its `--check` form. Commit the generated browser config, both HTML cache tokens, and both Wrangler build versions together.

## Soot sprites

The `soot-sprites` alert in `scripts/home/events/soot-sprites.js` releases a swarm of pixel-art susuwatari (candidate I of the 2026 redesign). The look is a contract; `tests/soot-sprite-pixels.test.mjs` runs the production helpers against it and `tests/ui/soot-sprites.spec.mjs` checks the rendered swarm.

- Each sprite draws one of three looks on a cell grid of `round(size / unit)` cells per body (never fewer than 8): 2 px cells with a 0.10–0.22 D coat, 1.5 px cells with a sparser 0.14–0.30 D coat of bent hairs, or the first again. A black disc, single-cell hairs rooted one cell inside the edge, white eyes 0.36 D wide and 0.38 D apart with trimmed corners, and a whole-cell pupil kept inside the white in a random direction (the gaze is baked per sprite).
- A swarm shares one canvas sheet: every sprite's three frames (two coats, one blink with closed-eye slits) are drawn side by side, encoded once to a PNG data URL on the overlay's `--soot-sheet`, and shown through `background-position` on `.soot-sprite-frame` with `image-rendering: pixelated`. Candies and smoke use two sheets drawn once per page: the five candy colours in two 9-cell star shapes, and six 96×48-cell smoke blobs in three shades of black. No gradients, blurs, clip-paths or CSS-drawn eyes remain.
- Behaviour per sprite: the path animation on `.soot-sprite` (unchanged), a stepped boil on the frame every 160 ms with a blink every 2.4–4.8 s, and a tremble on the body added to the slow wobble: a whole-cell shift every 55–115 ms within 0.03 D while falling and 0.06 D on the ground, doubled for an 18% twitch, with a 6% chance per step of a 0.22 D hop after landing. Under `prefers-reduced-motion` the boil, tremble and wobble are off and only the path runs.
- The swarm is built across animation frames during the alert's one-second hold (8 sprites per frame, then the sheet encode, then 60 candies or puffs per frame); `overlay.sootSpritesReady` resolves when it is complete and the hold timer starts after that. A sprite created after an early release starts playing at once. Keep this chunking when adding work to the swarm: the budget is no main-thread task over 50 ms at 4× CPU throttling.
- Changing `random-events.css` or the event script bumps their cache tokens in `home.html`, `index.html`, `scripts/home/core/resources.js` and the Admin preview stylesheet list, and the game-build token is regenerated because `resources.js` is an integrity input.
