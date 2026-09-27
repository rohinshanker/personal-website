# O_small-cache-token-parity__20260924 — Open

- Scope: Fix stale and drifted cache-busting tokens across the four HTML entry points and the `index.html` warm-up list, then add one parity test so it cannot drift again.
- Status: open
- Opened: 2026-09-24
- Updated: 2026-09-24
- Current State: Opened from the 2026-09-24 whole-site audit. Nothing started. Tier: small (each item is under an hour and low risk).
- Verification: `npm test`, `node scripts/update-game-integrity.mjs --check`, then load `/`, `/home.html`, `/modeling/`, `/video-editor/` locally and confirm the Network panel shows one URL per shared asset and no 404s. Update the pinned-token tests listed below in the same change.
- Cleanup: Fold the parity-test contract into `docs/validation/site-quality-gates.md` ("cache-busting" paragraph), then delete this ticket and its index row.

## Findings

1. **Three shipped files changed after their token was last bumped** (violates the site-quality gate).
   - `styles/home/cursors.css?v=text-selection-cursor-20260810`: token set 2026-08-11, file changed 2026-08-27. Loaded by `home.html:117`, `index.html:105`, `video-editor/index.html:16`.
   - `scripts/home/text-selection-cursor.js`: changed 2026-08-27; loaded as `?v=text-selection-cursor-20260810` (`home.html:120`, `index.html:107`) and as `?v=video-editor-cursor-guards-20260826` (`video-editor/index.html:21`). Same file, two cache entries, both stale.
   - `styles/home/apps/solitaire.css?v=solitaire-auto-solve-20260917` (`home.html:109`): file changed twice on 2026-09-21.
   - Re-run: `for f in styles/home/cursors.css styles/home/apps/solitaire.css scripts/home/text-selection-cursor.js; do cur=$(grep -oE "$f\?v=[^\"]+" home.html|head -1); echo "$f | token set: $(git log -1 --format=%cs -S"$cur" -- home.html) | file changed: $(git log -1 --format=%cs -- $f)"; done`
2. **`index.html` warm-up list (`homeWarmupResources`, `index.html:318-336`) has drifted from `home.html`**: `solitaire.css` prefetched with no token (`index.html:321`); `system-alerts.js` prefetched as `?v=bulk-system-alerts-20260811` while Home loads `?v=battery-copy-20260921` (`home.html:6856`); `admin-controls.css`, `admin-controls.js`, `modeling-portfolio.js`, `text-selection-cursor.js` are never warmed.
3. **`video-editor/index.html` ships unversioned shared assets**: `../style.css` (L13), `style.css` (L19), `../scripts/home/game-stats-backend.js` (L24), `audio-analysis.js` (L25), `script.js` (L26). `scripts/update-game-integrity.mjs:7-8` rewrites the `game-build-<hash>` token only in `home.html`/`index.html`, so the editor can run against a cached stale backend config after a rebuild. `cursor.js`, `game-stats-backend.js`, `audio-analysis.js` sit in `<head>` without `defer`.
4. **`sitemap.xml` lastmod for `/` is `2026-06-24`**; `index.html`/`home.html` last changed 2026-09-24. Do this before the recrawl in `O_google-search-console-refresh__20260827.md`.

## Plan

- Bump each stale token to one shared value in every entry point; token the five video-editor references and add `defer`.
- Add `tests/entry-point-cache-tokens.test.mjs`: every static asset referenced by any of the four entry points carries exactly one token across all of them, and every `homeWarmupResources` entry appears verbatim as a `home.html` tag (pattern exists in `tests/about-me.test.mjs:339-342`).
- Tests that pin the current literals and must be updated: `tests/custom-cursor-selection.test.mjs:17,20,25`, `tests/gears-nest.test.mjs:1313`, `tests/video-editor.test.mjs:106,110,124,819,835`, `tests/ui/video-editor.spec.mjs:742-744`, `tests/solitaire-victory-layout.test.mjs:20`, `tests/solitaire-auto-solve.test.mjs:309`.
- Longer-term replacement of the 34 hard-pinned token assertions across 19 test files is item 3 of `O_long-test-suite-hardening__20260924.md`.
