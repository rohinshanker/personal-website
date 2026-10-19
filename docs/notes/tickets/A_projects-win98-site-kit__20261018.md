# A_projects-win98-site-kit__20261018 — Active

- Scope: Add the win98-site-kit starter kit as a new item in the Projects window (`data-app-window="windows"`), describing the reusable desktop extracted from this site and linking to its repository and live showcase.
- Status: active
- Opened: 2026-10-18
- Updated: 2026-10-18
- Current State: Implemented on branch `claude/content-items-20261018` (2026-10-18). win98-site-kit is the second Projects item, directly after the Cyano visualizer, with "Open showcase" and "Open repository" links and a two-figure carousel captured from the live showcase. Awaiting the owner's look at the rendered item (see Owner Review) before closure.
- Verification: Render the Projects window at 375×812, 768×1024, 1280×800 and 1440×900 with the new selector item active and inactive; confirm the two links open in a new tab, the carousel (if any) loads, the deferred `data-src` thumbnails resolve, and the UI, accessibility and visual suites plus `node --test tests/context-system.test.mjs` pass. Review the exact patch.
- Cleanup: Resolve and delete this ticket and its index row after the owner sees the rendered item; distill nothing unless a reusable content rule emerges.

## Content

- Title: "win98-site-kit" (selector description: "Windows 98 desktop starter kit and CLI." with the season "Fall 2026").
- Summary: the reusable core of this site (window manager, dock, calendar, carousels, 98.css, the Windows icon library, downloadable games and apps) packaged as an ES-module starter with no build step and an `npx` CLI; games and apps are added from a registry; the Clash Royale app ships with an optional proxy.
- Links: "Open repository" → https://github.com/rohinshanker/win98-site-kit ; "Open showcase" → https://rohinshanker.github.io/win98-site-kit/ (gold-glow treatment on the showcase link, matching other project-website links).
- Media: screenshots of the showcase desktop and the Components window at 1280×800 can be captured from the live showcase; store them under `assets/projects/win98-site-kit/` as WebP and list them in `scripts/home/features/gallery.js` like the other project figures.
- Icon: `assets/app-icons/ico/windows.ico` (or another icon from the same library).

## Constraints

- Place the item below the Cyano gene visualizer item (see `O_projects-cyano-gene-visualizer__20261018.md`), which the owner wants as the most recent entry; keep the existing items in their current order.
- Follow the existing selector/viewer markup in `home.html` and the carousel helpers in `scripts/home/features/gallery.js`; update cache tokens for any changed stylesheet or script and run `npm run game-stats:integrity:check` if a game-build file changes.
- Do not touch the open tickets' files or other in-flight work.

## Owner Review

- `docs/validation/assets/content-items/win98-site-kit-wide.webp` — the kit item at 1440×900.

Verified with `tests/portfolio-content-items.test.mjs` and `tests/ui/portfolio-content-items.spec.mjs` (all four viewports, figures load, no overflow) plus the media, carousel, dialog and accessibility specs.
