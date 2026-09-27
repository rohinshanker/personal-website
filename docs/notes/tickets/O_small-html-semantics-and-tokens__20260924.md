# O_small-html-semantics-and-tokens__20260924 — Open

- Scope: Add the missing page landmarks and heading to `home.html`, align head metadata across the four routes, de-duplicate the JSON-LD block, and replace 98.css palette literals with the existing custom properties.
- Status: open
- Opened: 2026-09-24
- Updated: 2026-09-24
- Current State: Opened from the 2026-09-24 whole-site audit. Nothing started. Tier: small. The dialog ARIA pattern choice is a decision item in `O_decide-architecture-and-testing__20260924.md`.
- Verification: `npm test` (check `tests/search-preview-favicon.test.mjs` before editing any head); `npm run test:ui:accessibility`; `npm run test:visual`; rendered pass of `/`, `/home.html`, `/modeling/`, `/video-editor/` at 375×812 and 1440×900 with a screen-reader landmark list showing one main and one h1.
- Cleanup: Fold the landmark and head-metadata contract into `docs/validation/search-preview-favicon.md`, then delete this ticket and its index row.

## Items

1. **`home.html` has no `<h1>`, no `<main>`, no skip link**: headings are h2=2, h3=47, h4=3 with the first at `home.html:267`; `index.html` has no headings at all. `modeling/index.html:38,52` and `video-editor/index.html:29` do this correctly and `.visually-hidden` exists only in `video-editor/style.css:60`. Add `<h1 class="visually-hidden">Rohin OS</h1>`, wrap `.window-stack` in `<main>`, move `.visually-hidden` to `styles/home/base.css`.
2. **Head metadata and JSON-LD duplicated verbatim** between `index.html:28-102` and `home.html:31-105` (75 lines, the only inline `<script>` in `home.html`); `home.html:16` canonicalises to `/`, so its copy is redundant for search. Keep JSON-LD on `index.html` only, or add a parity test. Neither route has `og:image`/`twitter:image` (`modeling/index.html:25` does); no route has `theme-color`; `index.html:5` viewport lacks the `viewport-fit=cover` that `home.html:5-8` has. `video-editor/index.html` uses an `.ico` favicon and no `apple-touch-icon`/`og:*`. Align all four.
3. **Sudoku errors prompt is a native `<dialog>` with a redundant `role="alertdialog"`** (`home.html:2275`). Remove the role.
4. **Hard-coded palette literals bypass existing tokens**: 1,190 colour literals / 584 distinct across the 15 CSS files. `var(--surface)` is used 68× yet `#c0c0c0` is literal 9× (sudoku.css 4, style.css 2, random-events 2, snake 1); `#000080` literal 7× vs `var(--dialog-blue)` 21×; `#62ff78` 15× (snake.css 12). Replace the 98.css palette literals with the tokens and add `--snake-green` plus a small neutral scale. Count command: `cat style.css styles/home/*.css styles/home/apps/*.css modeling/style.css video-editor/style.css | grep -oiE '#[0-9a-f]{3,8}\b|rgba?\([^)]*\)' | tr A-F a-f | sed 's/ //g' | sort | uniq -c | sort -rn | head`.
5. **Eight `pdf-window` blocks differ only by id, title, and src** (`home.html:1675-1819`, 6,157 bytes). Stamping them from an array or `<template>` is cheap, but whether the owner prefers crawlable static markup is a decision item; do it only if that decision lands on templating.
