# Video Editor Validation

Purpose: Preserve the public Video Editor route's local-session, responsive,
interaction, and accessibility contracts.

Scope: Homepage Video Editor launchers and `/video-editor/` media import,
composed preview, timeline tiers and clips, effects lane, editor tabs, and
desktop-required boundary.

Last verified: 2026-08-15

## Product contract

- The homepage asks `Open video editor in new tab?`; Yes opens
  `/video-editor/`, while No, Escape, and the title-bar close control restore
  focus to the exact launcher. A blocked popup leaves the prompt open with an
  actionable error.
- The editor appears at widths of 1024 pixels and above. Narrower viewports
  expose only the labelled Desktop Required window.
- Desktop access starts behind a non-dismissible Administrator sign-in dialog.
  The editor is inert and hidden from assistive technology while a translucent
  overlay slightly dims the workspace; focus stays trapped in the dialog.
- Sign-in reuses the generated Game Stats backend configuration and stores only
  the existing `personalSiteAdministratorProofV1` proof in `sessionStorage`.
  The server-issued expiry is enforced and capped to one hour on this page.
- Proof expiry or removal pauses playback, clears drag state, and restores the
  blocking dialog without changing imported object URLs, media-bin items,
  timeline clips, effects, tabs, tiers, trims, or the playhead. Successful
  reauthentication restores the same live project and prior editor focus.
- Imported video and audio stay in the current browser tab through object
  URLs. Reloading starts an empty project, and unload revokes every object URL.
- Frame size defaults to `N/A`, which fills the available preview viewport
  without changing size as active media changes. Common portrait, widescreen,
  square, classic, cinematic, and photo ratios remain selectable; custom
  integer width and height values are bounded to 16–7680 pixels. Fixed frames
  are fitted and centered, and active video uses `object-fit: contain` so
  source media is never cropped.
- The workspace defaults to Standard, with the preview above the timeline.
  Side by side places the preview beside the timeline so portrait frames can
  use more vertical space. Explicitly selecting `Reel / TikTok (9:16)` while
  Standard is active switches to Side by side; a later manual layout choice is
  preserved, other presets do not auto-revert, and each layout remembers its
  own split value.
- The preview/timeline separator exposes `role="separator"`, live ARIA values,
  pointer resizing, Home/End bounds, and orientation-matched arrow keys:
  Up/Down in Standard and Left/Right in Side by side. Responsive bounds retain
  usable preview and timeline space, and paired fractional grid tracks keep
  the announced percentage aligned with the rendered flexible area.
- Vertical separators independently resize Project Media from 220–360 pixels
  and Effect Editor from 240–420 pixels. Pointer movement follows each panel's
  screen edge; Arrow Left/Right, Home, and End provide keyboard equivalents.
  Runtime maxima tighten at narrow desktop widths so the center editor retains
  at least 420 pixels without document overflow. All three separator rails are
  transparent and shadowless; only their centered hatched grips remain visible,
  with a dotted focus treatment for keyboard users.
- Video and audio clips occupy compatible typed tiers without same-tier
  overlap. Pointer and keyboard paths cover placement, movement, trimming,
  deletion, tier changes, playhead movement, and scaling.
- Editor range inputs use a 23-pixel hit area whose visible rail shares the
  native 11-pixel thumb's center-to-center travel. Pointer positions therefore
  match scrubber and scale values while native keyboard and step behavior stay
  intact.
- The scaled ruler renders one tick per second. Unlabelled ticks occupy the
  lower half; labelled major ticks span the full 28-pixel ruler. Labels begin
  to the right of their lines, and a 42-pixel terminal reserve keeps the final
  time label inside scrollable ruler content.
- The preview selects the active clip on the highest occupied video tier and
  schedules every active audio-tier clip into the local mix.
- Social UI guidelines are opt-in and render only for a fixed 9:16 frame.
  Instagram Reels and TikTok each expose labelled top, right-side, and bottom
  coverage zones plus a platform-specific safe-content outline. The selected
  platform and enabled state survive temporary switches to an unsupported
  frame, while the pointer-inert, assistive-technology-hidden overlay pauses
  until 9:16 returns. These approximate editing guides do not claim to replace
  each platform's current placement checker.
- Audio-Sync Cut analyzes an Audio timeline clip locally after an explicit
  action. A bounded worker pipeline downmixes the loudest channel, resamples
  analysis to at most 22,050 Hz, applies a 1,024-sample Hann-windowed Fourier
  transform, retains 64 logarithmic energy bands and a compact waveform, and
  rejects oversized or undecodable input without changing the project.
- Audio-Sync rules support editable frequency bounds, relative threshold, and
  rising, falling, or bidirectional crossings. Lows, Mids, Highs, and Beats
  recommendations create independent labelled color groups. Guideposts retain
  source-audio coordinates and map through timeline moves and trims; visual
  lines remain pointer-inert while an adjacent control list provides jump,
  nudge, and delete keyboard actions.
- A guidepost rule can split existing video clips, fill the first complete
  empty guide gap with selected local video, or materialize an existing effect
  at each marker. Batch operations reject overlaps and short source media
  atomically. Forward playback flashes the rule color for 110 ms only when it
  crosses an uncovered guidepost; a separate unrounded playback clock prevents
  display-time rounding from skipping boundary crossings.
- The Audio tool opens encoded searches on official YouTube in an isolated new
  tab for discovery only. It never scrapes, extracts, or downloads YouTube
  media. User-owned local audio can be previewed, bounded to a source range,
  and inserted on an Audio tier with its source trim preserved.
- Built-in Click and Typing sound effects are deterministic WAV files generated
  in the browser. Click is 0.12 seconds; Typing is 1.2 seconds by default and
  can loop for a bounded 1–30 second duration. Preview URLs and every inserted
  media URL are revoked during their normal cleanup paths.
- Closed Captions, Windows 98, and Transitions open one labelled editor tab
  each. The strip uses the repository's native 98.css
  `menu[role="tablist"] > li[role="tab"] > a` structure. Every tab keeps its
  icon, complete accessible title, and a flat close X that uses sunken chrome
  only while pressed. Measured title overflow scrolls on hover or keyboard
  focus, retains a tooltip, and becomes static under reduced motion. Tabs and
  three-second effect bars support pointer and keyboard reordering or movement,
  closing or deletion, reopening, and edge resizing. Effect editors remain
  explicit non-rendering placeholders.

## Automated gates

Run focused contracts before broader suites:

```bash
node --test tests/content-tool-placeholders.test.mjs tests/video-editor.test.mjs
npx playwright test tests/ui/content-tool-placeholders.spec.mjs tests/ui/video-editor.spec.mjs
```

The route spec covers 375 x 812, 768 x 1024, 1023 x 800, 1024 x 800,
1280 x 800, and 1440 x 900. It also covers real local video metadata,
generated WAV audio, compatible and incompatible drops, collision snapping,
typed tiers, preview and playback, pointer and keyboard editing, effects, long
filenames, a busy timeline, and all effect tabs. It also covers the flexible
N/A frame, every fixed preset, custom dimensions, contained imported video,
Standard and Side-by-side geometry, 9:16 automatic switching, manual layout
persistence, per-layout split retention, transparent hatched separators,
pointer and keyboard resizing in both axes, range clicks across multiple
values, and ruler geometry at minimum and maximum scale. Tab coverage verifies the semantic
98.css hierarchy, selection and focus, icon/title/close content, pressed-only
close treatment, measured marquee overflow, reduced motion, pointer and
keyboard reordering, close, and reopen behavior. Side-panel coverage exercises
both separators by pointer and keyboard at default and dynamic bounds while
asserting the center workspace remains usable. Authentication coverage
includes initial blocking, focus trapping, Escape, invalid credentials,
network failure, one-hour reuse across reload, timed expiry, proof removal,
project preservation, and repeated reauthentication. Every route test
collects console errors, uncaught page errors, and failed local resources.
Audio coverage uses a deterministic six-second 16 kHz WAV with separated low,
mid, and high bursts. It verifies decoded waveform/Fourier pixels, editable and
recommended rules, distinct guide groups, source-to-timeline mapping, marker
keyboard actions, uncovered playback flashes, bulk effect/cut/fill actions,
decode failure, safe YouTube discovery, local range insertion, Click/Typing
generation, loop duration, reset behavior, and object-URL cleanup. Pure Node
tests additionally cover FFT bounds, known-frequency directional crossings,
silence/onset behavior, and invalid analysis inputs.

Before release, run:

```bash
npm test
npm run test:ui
git diff --check
```

Changes to `scripts/home/main.js` or `scripts/home/core/dom.js` also require
regenerating and checking the repository's game-build integrity metadata:

```bash
node scripts/update-game-integrity.mjs
npm run game-stats:integrity:check
```

## Rendered inspection

Inspect both `/home.html` and `/video-editor/` with reduced motion enabled.
Confirm the responsive boundary, empty project, imported video and audio,
busy timeline, long filename, all open effect tabs, focused controls, closed
tabs, blocked-popup error, launcher focus restoration, unauthenticated modal,
invalid and network-error messages, authenticated workspace, expired project,
reauthenticated project, the flexible N/A frame, Reel / TikTok and custom
frames, extreme wide and tall custom ratios, Standard and Side-by-side layouts
at regular and short desktop heights, the focused horizontal and vertical
hatched grips, native effect tabs at minimum and maximum panel widths, long tab
titles, reduced motion, the
pressed close X, and ruler scale endpoints. Check screenshots and semantic snapshots,
document-level overflow, console output, page errors, and failed local
resources. For Audio-Sync, inspect empty, analyzed, multiple-rule, guidepost,
cut/fill/effect, flash, and decode-error states. For Audio, inspect local range,
Click, Typing, and loop states at 240-, 300-, and 420-pixel Effect Editor widths.
The repository does not currently install an automated
accessibility scanner, so do not claim an axe audit.

## Security boundary

The public route and its local editing code are static assets, so the dialog is
an interaction gate rather than a confidentiality boundary. The current
Administrator service has no standalone proof-validation or revocation
endpoint; this page can immediately detect the proof's one-hour expiry or local
removal, but not an early server-side signing-secret or IP invalidation. Any
future privileged network action must validate the bearer proof on the server.
