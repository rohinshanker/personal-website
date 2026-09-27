# O_small-media-format-fixes__20260924 — Open

- Scope: One-off media conversions and load-order fixes that keep every existing pixel and need no owner decision: HEVC videos, an oversized breadboard photo, opaque photographic PNGs, both-mode cursor preloading, eager icons inside hidden windows, and a case-existence test for asset references.
- Status: open
- Opened: 2026-09-24
- Updated: 2026-09-27
- Current State: Items 1, 2, 3, 4, and 6 shipped on 2026-09-27 (H.264 EKG videos, 1600 px WebP breadboard, WebP artwork with space-free names, active-mode-only cursor preload, `tests/asset-references.test.mjs`). Only item 5 remains. Tier: small. `assets/modeling/` originals stay at full quality by owner decision and are excluded. The 18 large GIFs and a scripted `<picture>` pipeline are `O_long-media-pipeline__20260924.md`.
- Verification: `npm test`; `npm run test:ui`; open each affected window in `/home.html` and confirm the media renders. Done 2026-09-27 for items 1–4 and 6: Node suite green, UI suite green, every converted file decodes in headless Chromium at its source dimensions, cursor preload requests at boot fell from 70 to 43 (light mode only), no baseline screenshot contains a converted image. Firefox and Safari checks remain manual.
- Cleanup: Conversion commands and the case-existence test are recorded in `docs/validation/site-quality-gates.md` ("Media formats and asset references"). Delete this ticket and its index row once item 5 ships.

## Items

1. **Done 2026-09-27.** EKG project videos are H.264 MP4 (`signal-closeup.mp4` 1,424 KB, `video-demo.mp4` 1,191 KB); the HEVC `.MOV` sources are removed.
2. **Done 2026-09-27.** `final-breadboard.webp` (1600×1200, 487 KB) replaces the 4,222 KB `.jpeg`, the `.HEIC`, and the unreferenced `.jpg`.
3. **Done 2026-09-27.** Every listed PNG is WebP q80 with a space-free name (transparency kept only for `magazine-cover.webp` and `lightning-bolt.webp`, the two files whose alpha channel was actually used). The creative-work gallery now weighs about 2.4 MB instead of 17 MB.
4. **Done 2026-09-27.** `preloadCustomCursorAssets(mode)` warms only the active mode; `setCursorDarkMode` warms the other mode when it is selected.
5. **Open.** Eager `<img src>` inside initially hidden windows: measured 2026-09-27 at 77 tags → 45 unique files across 14 app windows and 26 random-event windows, each opened by its own show function, almost all `.ico` icons and Minesweeper digits in windows that start hidden. Move them to `data-src` (the loader in `scripts/home/core/media.js` and `prewarmOpenedAppMedia` at `main.js:22262` already handle it). Only 11 of 301 `<img>` carry `width`+`height`; spot-check unframed images for layout shift while there.
6. **Done 2026-09-27.** `tests/asset-references.test.mjs` decodes every literal `assets/` reference in shipped sources plus the modeling shoot inventory and resolves each against exact-case directory listings.
