# R_small-media-format-fixes__20260924 — Resolved

- Scope: One-off media conversions and load-order fixes that keep every existing pixel and need no owner decision: HEVC videos, an oversized breadboard photo, opaque photographic PNGs, both-mode cursor preloading, eager icons inside hidden windows, and a case-existence test for asset references.
- Status: resolved
- Opened: 2026-09-24
- Updated: 2026-09-28
- Current State: Resolved. Items 1–4 and 6 shipped on 2026-09-27. Item 5 shipped on 2026-09-28: 68 hidden-window images now use `data-src` with fixed intrinsic dimensions, and 14 event show paths plus the initially visible About window activate deferred media. Nine boot-rendered Minesweeper and Solitaire seven-segment counter images remain eager because their initialization writes `src`; the Minesweeper cell-number preload remains open-triggered. The static guaranteed first-paint estimate fell from 150 resources / 2,436 KB to 83 resources / 2,099 KB. `assets/modeling/` originals stay at full quality by owner decision and are excluded. The 18 large GIFs and a scripted `<picture>` pipeline are `O_long-media-pipeline__20260924.md`.
- Verification: `npm test` (377/377); `node scripts/check-no-secrets.mjs` (1,527 candidates); `npm run syntax:check`; `node scripts/update-game-integrity.mjs --check`; `git diff --check`; `npm run test:visual` (7/7); the browser UI matrix (331 passed, with all 10 load-time failures passing on focused reruns); 40 actual app/event window states rendered at 375×812 and 1440×900 with decoded images and no browser diagnostics. The pinned screenshots remained unchanged; before/after inspection found no geometry changes. Firefox and Safari remain manual.
- Cleanup: Conversion commands and the case-existence test are recorded in `docs/validation/site-quality-gates.md` ("Media formats and asset references"). Delete this ticket and its index row once item 5 ships.

## Items

1. **Done 2026-09-27.** EKG project videos are H.264 MP4 (`signal-closeup.mp4` 1,424 KB, `video-demo.mp4` 1,191 KB); the HEVC `.MOV` sources are removed.
2. **Done 2026-09-27.** `final-breadboard.webp` (1600×1200, 487 KB) replaces the 4,222 KB `.jpeg`, the `.HEIC`, and the unreferenced `.jpg`.
3. **Done 2026-09-27.** Every listed PNG is WebP q80 with a space-free name (transparency kept only for `magazine-cover.webp` and `lightning-bolt.webp`, the two files whose alpha channel was actually used). The creative-work gallery now weighs about 2.4 MB instead of 17 MB.
4. **Done 2026-09-27.** `preloadCustomCursorAssets(mode)` warms only the active mode; `setCursorDarkMode` warms the other mode when it is selected.
5. **Done 2026-09-28.** Deferred 68 hidden-window images through the existing media loader, added intrinsic dimensions, covered the markup and show-path contract with `tests/deferred-window-media.test.mjs`, and preserved the nine eager boot-rendered counter digits and the Minesweeper cell-number preload contract.
6. **Done 2026-09-27.** `tests/asset-references.test.mjs` decodes every literal `assets/` reference in shipped sources plus the modeling shoot inventory and resolves each against exact-case directory listings.
