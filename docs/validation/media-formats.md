# Animated Media Formats

- Purpose: Keep large animated artwork off the GIF path, and keep the looping-video replacements playing, pausing, and falling back the way the GIFs behaved.
- Scope: `scripts/optimize-media.mjs` and its manifest, `assets/optimized/random-events/`, the random-event media in `home.html` and the `scripts/home/main.js` holiday tables, and the deferred loader in `scripts/home/core/media.js`.
- Last verified: 2026-09-29

## Format rule

A source animation at or above 1 MB (1,000,000 bytes, decimal) under a covered
directory must ship a derivative; nothing shipped may request the source. The
threshold is decimal on purpose: `nana-accept.gif` is 1,029,362 bytes, over 1 MB
and under 1 MiB, and it belongs to this pipeline.

- **Animated WebP is the default.** It keeps `<img>`, `data-src`, the deferred
  loader, and reduced-motion behaviour exactly as they were.
- **A looping `<video>` replaces the largest loops**: `assets/random events/`
  `servalpizza.gif`, `campfire.gif`, `evil-wizards-radar.gif`, `radar.gif`, and
  `lain.gif`. Video is worth its extra markup only where the WebP is still
  hundreds of kilobytes; below that the image path is simpler and equally fast.
- **Every video also ships its animated WebP**, because a `<video>` that cannot
  autoplay must still animate.
- Sources stay where they are. Derivatives live under
  `assets/optimized/random-events/` and never replace the original file.

## Encoder flags

`scripts/optimize-media.mjs` owns the flags; the table below is what it runs.
Re-encode through `npm run media:optimize`, never by hand, so the generated
record stays truthful.

| Derivative | Encoder | Flags |
| --- | --- | --- |
| `<name>.webp` (default) | `gif2webp` | `-lossy -q 75 -m 6 -mixed` |
| `radar.webp` | `gif2webp` | `-q 75 -m 6` (gif2webp is lossless unless `-lossy`/`-mixed` is given) |
| `<name>.webm` | `ffmpeg` | `-c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -pix_fmt yuv420p -an -vf scale=trunc(iw/2)*2:trunc(ih/2)*2` |
| `<name>.mp4` | `ffmpeg` | `-c:v libx264 -crf 28 -preset slow -profile:v main -pix_fmt yuv420p -an -movflags +faststart -vf scale=trunc(iw/2)*2:trunc(ih/2)*2` |
| `<name>-poster.jpg` | `ffmpeg` | `-frames:v 1 -c:v mjpeg -q:v 4 -pix_fmt yuvj420p -vf scale=trunc(iw/2)*2:trunc(ih/2)*2` |

Quality was chosen by comparing each derivative with its source frame by frame
and at rendered size. Lossy WebP smooths the GIF's dithering, which reads as an
improvement rather than a loss, so structural similarity against the dithered
source understates quality: raising `servalpizza` from `-q 75` to `-q 85`
doubled the file for +0.03 mean SSIM and no visible difference. Two cases do
need a different setting:

- `radar.gif` is flat-palette line art. Lossy WebP encodes it *larger* than the
  GIF (2,687,760 bytes against 2,140,195), so it ships lossless. Lossless `-q`
  buys compression effort, not fidelity, so it stays at the default `-q 75`.
- The Homebrew `ffmpeg` build has no `libwebp` encoder, so poster frames are
  JPEG. They are opaque video stills, which JPEG serves well.

To re-measure a candidate against its source, extract both frame sequences with
`-fps_mode passthrough` first — comparing the two files directly lines up
mismatched frames and reports meaningless numbers:

```bash
ffmpeg -v error -i in.gif -fps_mode passthrough gif/%04d.png
ffmpeg -v error -i out.webp -fps_mode passthrough webp/%04d.png
ffmpeg -v error -framerate 25 -i webp/%04d.png -framerate 25 -i gif/%04d.png \
  -lavfi "[0:v]format=rgb24[a];[1:v]format=rgb24[b];[a][b]ssim=stats_file=-" -f null -
```

## Sizes

"Downloaded bytes" is what one browser actually fetches: WebM plus poster for a
video event, the animated WebP otherwise. A video event's WebP fallback is
fetched only when `play()` is refused, and only one of WebM/MP4 is ever chosen.

| Source | Ships as | GIF bytes | Derivative bytes | Downloaded bytes | Saved |
| --- | --- | ---: | --- | ---: | ---: |
| `servalpizza` | video | 9,716,372 | webm 658,603 · mp4 445,011 · poster 36,087 · webp fallback 1,922,078 | 694,690 | 93% |
| `campfire` | video | 6,087,120 | webm 176,756 · mp4 122,087 · poster 51,746 · webp fallback 748,214 | 228,502 | 96% |
| `evil-wizards-radar` | video | 3,987,487 | webm 143,475 · mp4 118,720 · poster 79,639 · webp fallback 681,520 | 223,114 | 94% |
| `birthday` | WebP | 3,264,097 | webp 1,075,952 | 1,075,952 | 67% |
| `ramadan` | WebP | 2,960,726 | webp 940,504 | 940,504 | 68% |
| `buddha` | WebP | 2,926,083 | webp 965,846 | 965,846 | 67% |
| `mothersday` | WebP | 2,781,317 | webp 776,736 | 776,736 | 72% |
| `trans` | WebP | 2,588,030 | webp 813,534 | 813,534 | 69% |
| `feliz-jueves` | WebP | 2,193,316 | webp 737,614 | 737,614 | 66% |
| `radar` | video | 2,140,195 | webm 306,415 · mp4 256,956 · poster 30,769 · webp fallback 1,887,922 | 337,184 | 84% |
| `fathersday` | WebP | 1,922,308 | webp 475,536 | 475,536 | 75% |
| `4thofjuly` | WebP | 1,884,834 | webp 993,550 | 993,550 | 47% |
| `lain` | video | 1,814,442 | webm 410,553 · mp4 228,387 · poster 51,296 · webp fallback 604,334 | 461,849 | 75% |
| `holi` | WebP | 1,612,380 | webp 763,544 | 763,544 | 53% |
| `halloween` | WebP | 1,473,960 | webp 626,256 | 626,256 | 58% |
| `easter` | WebP | 1,464,000 | webp 460,032 | 460,032 | 69% |
| `valentine` | WebP | 1,236,348 | webp 349,968 | 349,968 | 72% |
| `shoebill` | WebP | 1,101,796 | webp 770,366 | 770,366 | 30% |
| `nana-accept` | WebP | 1,029,362 | webp 273,110 | 273,110 | 73% |
| **Total** | | **52,184,173** | | **11,967,887** | **77%** |

`shoebill` saves the least because its 220x220 source renders in a 64x64 icon
box; resizing sources is a separate decision and is not part of this pipeline.
`4thofjuly` and `holi` are heavily dithered, which limits what lossy WebP can do
without visible banding.

## Looping-video contract

Markup, in `home.html` only:

```html
<video
  class="serval-pizza-art"
  data-loop-video="servalpizza"
  data-loop-fallback="assets/optimized/random-events/servalpizza.webp"
  data-poster="assets/optimized/random-events/servalpizza-poster.jpg"
  width="628" height="640"
  autoplay loop muted playsinline preload="auto"
>
  <source data-src="assets/optimized/random-events/servalpizza.webm" type="video/webm" />
  <source data-src="assets/optimized/random-events/servalpizza.mp4" type="video/mp4" />
</video>
```

`scripts/home/core/media.js` enforces the rest:

- `<source data-src>` defers exactly like a deferred image. Setting the last
  deferred source promotes `data-poster` to `poster` and calls `load()` once, so
  a two-format `<video>` starts a single fetch.
- A deferred `<source>` counts as loaded only at `readyState >= 2`, so a caller
  awaiting deferred media waits for a decoded frame, not just metadata.
- `video[data-loop-video]` plays only while its window and the page are visible.
  Hiding or closing the window pauses it, matching
  [carousel-video-playback.md](carousel-video-playback.md); `visibilitychange`
  pauses it with the tab. The window is watched through a `MutationObserver`
  scoped to the few windows that own a loop video.
- Bringing another window to the front does **not** pause a loop video: it
  replaced an animated GIF, which kept running. `pauseMediaPlayback` in
  `scripts/home/main.js` skips `video[data-loop-video]` for that reason.
- If `play()` is refused — iOS Low Power Mode, a stricter autoplay policy — the
  video is hidden and an `<img>` built from `data-loop-fallback` takes its place
  with the same classes, width, height, and `aria-hidden`. An `AbortError` from a
  pause that interrupted the request is not a refusal and never triggers it.
- The Admin Controls event preview clones the window and must stay inert:
  `[data-admin-event-preview-window]` is never an active loop video, so a preview
  shows the poster frame. `activateAdminRandomEventPreviewMedia` calls `load()`
  on the clone so the poster paints.
- Reduced motion is unchanged from the GIFs: they animated regardless of
  `prefers-reduced-motion`, and so do the WebP and video replacements. Only the
  window open/close animations respect the preference, as before.

Every `<video>` carries `width` and `height` matching its encoded derivative, so
loading shifts no layout; `tests/optimized-media-references.test.mjs` compares
those attributes against the generated record. Those attributes are also a
presentational hint for `width`, which a GIF's `<img>` never supplied: a rule that
caps `height` and leaves `width` at its default keeps the declared pixel width and
stretches the box. Every loop video's rule states `width` explicitly.

## Pipeline

```bash
npm run media:optimize   # encode anything stale
npm run media:check      # pure Node, no encoder, runs in CI
```

- The manifest in `scripts/optimize-media.mjs` is the single declaration of
  source, derivative paths, and flags. `assets/optimized/random-events/derivatives.json`
  is the generated record: byte sizes, dimensions, and the flags each derivative
  came from.
- A rerun skips a derivative that exists, was recorded from the same flags, and
  is not older than its source. The record is rewritten after each source, so a
  failed encoder loses only the source it was working on.
- `--check` resolves no encoder. It fails when a covered source at or above the
  threshold has no manifest entry, when a derivative is missing, when the record
  disagrees with the manifest or the files, or when the record still names a
  source the manifest dropped.
- Encoders resolve from `PATH`: `gif2webp` (from `webp`), `ffmpeg`, and
  `ffprobe`. A missing one fails with the install command rather than a spawn
  error.

## Verification

```bash
node --test tests/optimize-media.test.mjs tests/optimized-media-references.test.mjs \
  tests/deferred-window-media.test.mjs tests/lain-wired-chat.test.mjs
npm run media:check
npx playwright test --project=ui tests/ui/deferred-window-media.spec.mjs \
  tests/ui/lain-wired-chat.spec.mjs
```

`tests/optimize-media.test.mjs` drives the pipeline through a stubbed encoder
runner over temporary fixtures and never invokes a real encoder; the last case
runs the shipped `--check` with an empty `PATH` to prove it needs none.

For rendered validation, trigger each converted event through the Admin Controls
event finder at 375×812 and 1440×900 and confirm the box, the loop, and the
first paint. The five video events also need: pause on window hide, resume on
reopen, and the fallback image after `HTMLMediaElement.prototype.play` is
patched to reject.
