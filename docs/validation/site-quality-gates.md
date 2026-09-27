# Site Quality Gates

- Purpose: Repeatable repository quality gates and rendered UI validation.
- Scope: Site JavaScript, generated artifacts, browser UI, and repository secrets.
- Last verified: 2026-09-27

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

Production per-event debug flags are live site behavior. Ordinary Playwright
specs must import `tests/ui/fixtures.mjs`, which routes `scripts/home/main.js`
through the shared debug isolator. A spec that custom-routes `main.js` must use
`isolateAllProductionDebug` or `readIsolatedMainSource` from
`tests/ui/helpers/random-event-debug.mjs`. Focused debug-event coverage may
retain only the event IDs it explicitly exercises through the helper's
`except` option. Keep the helper's production-ID contract test aligned with
the real event registry whenever a debug flag changes.

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

For visible UI changes, run `npm run test:ui` and `npm run test:visual`, then
serve the site locally and inspect the affected route, interactive states, and
responsive viewports. Reference screenshots, WCAG scanning, and the container
that regenerates baselines are documented in
[browser-visual-accessibility.md](browser-visual-accessibility.md). Confirm page boot has no console
errors, relevant controls remain keyboard accessible, and no overflow or
layout regression appears at compact and desktop widths. Keep task-specific
screenshots and observations in the active ticket; do not add them here unless
they change this reusable procedure.

## Media formats and asset references

Ship photographs and opaque artwork as WebP (or JPEG), reserve PNG for pixel
art and images that need transparency, and ship video as H.264 `yuv420p` MP4
with `+faststart`, never HEVC. File names carry no spaces. Every literal
`assets/…` reference in shipped HTML, CSS, and JavaScript, and every modeling
shoot file, must resolve with exact case because GitHub Pages is case-sensitive
and macOS is not; `tests/asset-references.test.mjs` enforces it.

```bash
# Opaque artwork or photo (use -resize W 0 to cap the width)
cwebp -q 80 in.png -o out.webp
# HEVC or oversized video
ffmpeg -i in.mov -vf "scale='min(1920,iw)':-2" -c:v libx264 -crf 26 \
  -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart out.mp4
# Confirm a PNG really uses transparency before converting it (YMIN=255 means opaque)
ffmpeg -v error -i in.png -vf "alphaextract,signalstats,metadata=print:key=lavfi.signalstats.YMIN:file=-" -frames:v 1 -f null -
```

## Cache-busting tokens

Every local stylesheet and script tag in `index.html`, `home.html`,
`modeling/index.html`, and `video-editor/index.html` carries a `?v=` token, one
shared asset uses one token across all four routes, and the `index.html`
`homeWarmupResources` list mirrors the `home.html` tags exactly.
`tests/entry-point-cache-tokens.test.mjs` enforces all three.

When a referenced static script or stylesheet changes, update its token in every
entry point that loads it (and the warm-up list) in the same change, and repoint
any source test that pins the old literal. `scripts/update-game-integrity.mjs`
owns the `game-build-<hash>` token on `game-stats-backend.js`, `core/dom.js`,
and `main.js` in all three routes that load them; never edit those by hand.
Bump `sitemap.xml` `lastmod` for a route whose entry point changed.
