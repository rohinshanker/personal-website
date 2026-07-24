# Site Quality Gates

Purpose: Repeatable repository quality gates and rendered UI validation.

Scope: Site JavaScript, generated artifacts, browser UI, and repository secrets.

Last verified: 2026-07-23

Use the smallest relevant set while developing, then run the full suite before
shipping changes that affect site behavior.

The site is static HTML, CSS, and vanilla JavaScript. It has a package manifest
for test scripts but no bundled build step.

## Baseline

```bash
node --test tests/*.test.mjs
node scripts/check-no-secrets.mjs
git diff --check
```

Run `node --check` for every changed JavaScript or MJS entry point. For
random-event changes, also run
`node --test tests/gears-nest.test.mjs tests/random-event-cooldown.test.mjs`.

After changing repository context, run:

```bash
node --test tests/context-system.test.mjs
```

## Generated artifacts

After changing files that determine game completion
(`scripts/home/main.js` or `scripts/home/core/dom.js`), regenerate and then
verify the public Game Stats build version:

```bash
node scripts/update-game-integrity.mjs
node scripts/update-game-integrity.mjs --check
node --test tests/game-stats-integrity.test.mjs tests/game-stats-worker.test.mjs
```

After changing `.ico` assets, regenerate and verify the app-icon manifest:

```bash
node scripts/build-app-icon-manifest.mjs
node scripts/build-app-icon-manifest.mjs --check
node --test tests/app-icon-manifest.test.mjs
```

## Rendered UI

For visible UI changes, serve the site locally and inspect the affected route,
interactive states, and responsive viewports. Confirm page boot has no console
errors, relevant controls remain keyboard accessible, and no overflow or
layout regression appears at compact and desktop widths. Keep task-specific
screenshots and observations in the active ticket; do not add them here unless
they change this reusable procedure.

When a referenced static script changes, update its cache-busting query string
in every HTML entry point that loads it and cover the reference with the
relevant source test.
