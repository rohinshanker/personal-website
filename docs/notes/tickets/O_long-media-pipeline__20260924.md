# O_long-media-pipeline__20260924 — Open

- Scope: Replace the 18 animated GIFs over 1 MB (48.8 MB) with WebP or looping MP4/WebM, and add a small scripted conversion pipeline with `<picture>`/`<video>` fallbacks so future media lands optimized.
- Status: open
- Opened: 2026-09-24
- Updated: 2026-09-24
- Current State: Opened from the 2026-09-24 whole-site audit. Nothing started. Tier: long. `assets/modeling/` originals are excluded by owner decision. The one-off conversions that need no pipeline are `O_small-media-format-fixes__20260924.md`; the body-background quality trade-off is a decision item in `O_decide-content-and-assets__20260924.md`.
- Verification: `npm test` (random-event tests assert some media paths; update them); `npm run test:ui`; trigger each converted event through the Admin Controls event finder at 375×812 and 1440×900 in Chrome, Firefox, Safari, confirming autoplay, looping, and reduced-motion behaviour match the GIF; `npm run test:visual` re-baselined for any pinned frame.
- Cleanup: Record the conversion commands and the `<video>`-for-loops rule in `docs/validation/site-quality-gates.md` or a new `media-formats.md`, then delete this ticket and its index row.

## Findings

- 44 GIFs total 62.0 MB; 18 over 1 MB = 48.8 MB. All are lazy (`data-src` in `home.html`, e.g. `:4869`, `:5502`, `:5143`, or `image:` fields in the `main.js` holiday/event tables `:23370-23492`), swapped in by `scripts/home/core/media.js` when the window or event fires, so they stall the popup the moment it triggers and GIF decoding is CPU-heavy on mobile.
- Largest, with MP4 probe sizes (`ffmpeg -i x.gif -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -crf 28 x.mp4`): `assets/random events/servalpizza.gif` 9,488 KB → 433 KB; `campfire.gif` 5,944 KB → 121 KB; `evil-wizards-radar.gif` 3,894 KB → 114 KB; `birthday.gif` 3,187 KB → 533 KB. Then `ramadan` 2.9 MB, `buddha` 2.9 MB, `mothersday` 2.7 MB, `trans` 2.5 MB, `feliz-jueves` 2.1 MB, `radar` 2.1 MB, `fathersday` 1.9 MB, `4thofjuly` 1.8 MB, `lain` 1.8 MB, `holi` 1.6 MB, `halloween` 1.4 MB, `easter` 1.4 MB, `valentine` 1.2 MB, `shoebill` 1.1 MB, `nana-accept` 1.0 MB.

## Plan

1. `<img>`-only contexts (holiday calendar images, small alerts): `gif2webp -lossy -q 75` (installed at `/opt/homebrew/bin/gif2webp`), typically 3–8× smaller, keeps `<img>` semantics and the `data-src` loader.
2. Big loops (`servalpizza`, `campfire`, `evil-wizards-radar`, `radar`, `lain`): `<video autoplay muted loop playsinline>` with MP4 and WebM sources; the carousel-video pause contract in `docs/validation/carousel-video-playback.md` applies (pause when hidden).
3. Add `scripts/optimize-media.mjs` (input path → WebP/JPEG/MP4 derivative under `assets/optimized/`, idempotent, `--check` mode listing source files larger than a threshold without a derivative) and run `--check` in the `verify` job.
