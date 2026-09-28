# Site Quality Gates

- Purpose: Repeatable repository quality gates and rendered UI validation.
- Scope: Site JavaScript, generated artifacts, browser UI, and repository secrets.
- Last verified: 2026-09-28

Use the smallest relevant set while developing, then run the full suite before
shipping changes that affect site behavior.

The site is static HTML, CSS, and vanilla JavaScript. It has a package manifest
for test scripts but no bundled build step.

## Baseline

```bash
node --test tests/*.test.mjs
node scripts/check-no-secrets.mjs
npm run syntax:check
git diff --check
```

`npm run syntax:check` runs `node --check` over every `scripts/` JavaScript and
MJS file and every top-level `video-editor/` one; the release workflow runs the
same script. For
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
npm run app-icons:check
node --test tests/app-icon-manifest.test.mjs
```

After adding or removing a Study Resources PDF, regenerate and verify its
manifest:

```bash
node scripts/build-study-resources-manifest.mjs
npm run study-resources:check
node --test tests/study-resources-manifest.test.mjs
```

Every generator resolves the repository root from `import.meta.url`, so each of
these commands behaves the same from any working directory.

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

## Workflow hardening standard

All three workflows in `.github/workflows/` hold to one standard, and
`tests/game-stats-deployment.test.mjs` fails the suite when a new or edited
workflow departs from it:

- Every `uses:` reference is pinned to a full 40-character commit SHA, with a
  comment directly above naming the action and its released version. All three
  files share one `actions/checkout` pin and one `actions/setup-node` pin.
- `permissions` defaults to `contents: read`; a job widens it only for itself.
- Every workflow declares a `concurrency` group keyed on `github.ref` with
  `cancel-in-progress: true`, and every job sets `timeout-minutes`.
- Every checkout sets `persist-credentials: false`, and every `setup-node` runs
  Node 24.
- `pull_request_target` appears nowhere.

Each gate runs once per push. The secret scan belongs to `secret-guard.yml` as
the script plus gitleaks; `tests/no-secrets.test.mjs` re-scans the same tree and
so stays in `npm test` alone. The Chromium download is cached on
`package-lock.json`, which pins the Playwright version; because that cache holds
only browser binaries, a cache hit still runs `playwright install-deps`.

To change a pinned action, resolve the tag to its SHA first:

```bash
gh api "repos/<owner>/<action>/tags?per_page=100" \
  --jq '.[] | select(.name|startswith("v4.")) | "\(.name) \(.commit.sha)"' | head -5
```

## Media formats and asset references

Ship photographs and opaque artwork as WebP (or JPEG), reserve PNG for pixel
art and images that need transparency, and ship video as H.264 `yuv420p` MP4
with `+faststart`, never HEVC. File names carry no spaces. Every literal
`assets/…` reference in shipped HTML, CSS, and JavaScript, and every modeling
shoot file, must resolve with exact case because GitHub Pages is case-sensitive
and macOS is not; `tests/asset-references.test.mjs` enforces it.

Images inside initially hidden windows use `data-src`, carry intrinsic `width`
and `height` when their rendered size is fixed, and are activated by the
window's show path through `loadDeferredMedia` or `activateVisibleContent`.
The initially visible About window remains eager. Two kinds of exception exist
inside hidden windows, and an audit must count them separately: markup-eager
tags (the six Minesweeper and three Solitaire seven-segment counter digits,
plus the Leaderboard Profile reroll icon, whose file is already eager on the
desktop) and images whose boot-time render writes `src` (the Study Resources
tree and Life Counter, six each), which carry `src` at runtime without a
markup change. Lazily created gallery loader chrome also sets `src` on demand
and should be counted separately from initial markup. The Minesweeper
cell-number preload still starts only when that
game window opens. `tests/ui/deferred-window-media.spec.mjs` opens the affected
app windows and triggers the affected events for real through Admin Controls;
the Admin preview activates its clone itself, so a preview render proves
nothing about a show path.

Re-measure the static first-paint estimate with
`node docs/validation/assets/initial-load.mjs "$PWD" home.html`. The script
counts every `data-src` tag as not loaded at first paint; it does not model a
script that activates deferred media later in the same page load. Pair it with
a cache-disabled browser network capture when reporting user-visible load cost.
The 2026-09-27 reference comparison at 1440×900, current `main` `e76dc76`
versus the hidden-window deferral tip, was:

| Measurement | `main` | Deferral tip |
| --- | ---: | ---: |
| Static guaranteed first-paint estimate | 150 resources / 2,439 KB | 94 resources / 2,221 KB |
| Chromium full load, encoded transfer bytes | 176 requests / 3,853,868 B | 154 requests / 3,777,048 B |
| `bio-pic-720.jpg` request start, Fast 3G and 4× CPU | 222–224 ms | 222–223 ms |

The browser figures were stable across three local-server runs with cache
disabled; the capture waited through `load`, portrait decode, and 500 ms of
settling. The portrait timing confirms the eager preload-scanner path remains
equivalent to `main`.

```bash
# Opaque artwork or photo (use -resize W 0 to cap the width)
cwebp -q 80 in.png -o out.webp
# HEVC or oversized video
ffmpeg -i in.mov -vf "scale='min(1920,iw)':-2" -c:v libx264 -crf 26 \
  -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart out.mp4
# Confirm a PNG really uses transparency before converting it (YMIN=255 means opaque)
ffmpeg -v error -i in.png -vf "alphaextract,signalstats,metadata=print:key=lavfi.signalstats.YMIN:file=-" -frames:v 1 -f null -
```

The deferred-media browser spec covers both the Admin Trigger Now path and cold
show callbacks. Trigger Now preloads the live DOM before invoking an event, so
it cannot alone detect a missing show-path loader. Keep the cold callback checks
and their assertion that source-less deferred images exist before each call.
Chained result callbacks are checked cold too; fixed-size markup counts remain a
separate Node contract. Screenshots are saved by path after finite animations
finish, so they survive the default reporter. A mutation removing the shared
managed-window loader must fail on Lain; removing
the Rohin Note loader must fail on that note. The Skill Check result instead
sets its icon `src` directly; its decode check does not depend on the redundant
loader call. Markup counts preserve the originally deferred fixed-size subset,
not a global intrinsic-size rule for responsive artwork. Restore mutations
before gates.

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
