# Video Editor Validation

Purpose: Preserve the public Video Editor route's local-session, responsive,
interaction, and accessibility contracts.

Scope: Homepage Video Editor launchers and `/video-editor/` media import,
composed preview, timeline tiers and clips, effects lane, editor tabs, and
desktop-required boundary.

Last verified: 2026-08-27

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
- Pixelated MS Sans Serif microcopy stays at the font's native 11-pixel size
  with a 14-pixel integer line box. Nine- and ten-pixel rendering produces
  uneven glyph advances and risks clipping; the only smaller editor text is
  the 10-pixel timecode, which explicitly uses scalable Courier New.
- Password masks are an intentional exception to the pixel font. Both
  Administrator forms use smoothed 13-pixel Arial with normal line height and
  one pixel of tracking because the bundled pixel font lacks the browser's
  mask glyph; visual probes found 10 and 11 pixels too small and 12 pixels
  borderline. Keep the inputs at `type="password"` and test them with a
  populated synthetic value so screenshots exercise the actual mask.
- The preview selects the active clip on the highest occupied video tier and
  schedules every active audio-tier clip into the local mix.
- `UI Guidelines` is one compact selector whose first/default choice is
  `None`; Instagram Reels and TikTok render only for a fixed 9:16 frame. A
  keyboard-focusable information icon exposes a pointer-inert tooltip stating
  that the guides are rough, based on iPhone 15 Pro screenshots, updated in
  August 2026, and may vary by device, app state, captions, and add-ons.
- The screenshot-derived Reels guide reserves the top 13.5%, the rightmost 18%
  from 40–89% height, and the bottom 32%. TikTok reserves the top 13%, the
  rightmost 18% from 41–90% height, and the bottom 31%. Each uses a stepped
  safe-content polygon to preserve usable upper-right space before the action
  rail begins. These editing approximations do not replace current platform
  placement checkers, and screenshot-specific transient promotions are not
  encoded as permanent chrome. A selected platform survives temporary frame
  changes while the pointer-inert, assistive-technology-hidden overlay pauses
  until 9:16 returns.
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
- The Effects window begins directly with the repository's native 98.css
  `menu[role="tablist"] > li[role="tab"] > a` strip; it has no blue title bar,
  visible `Tabs` label, or reopen toolbar. Position one is a sticky, icon-only
  `Effect editor home` tab tied to the empty panel. It cannot close or reorder,
  remains visible while the dynamic strip scrolls, and receives focus when the
  last effect tab closes. Choosing an effect launcher opens or reopens its tab.
- Closed Captions, Windows 98, and Transitions retain labelled tabs with icons,
  complete accessible titles, and flat Pixelarticons close controls that use
  sunken chrome only while pressed. Measured title overflow scrolls on hover or
  keyboard focus, retains a tooltip, and becomes static under reduced motion.
  Tabs and three-second effect bars support pointer and keyboard reordering or
  movement, closing or deletion, launcher-based reopening, and edge resizing.
  Effect editors remain explicit non-rendering placeholders.
- Play, pause, local-file import, UI information, tab close, and timeline
  delete symbols use locally vendored Pixelarticons base-style SVGs. The assets
  are decorative inside controls with semantic names, load without a runtime
  dependency, and retain their adjacent MIT license and provenance note.
- The editor reuses the Home custom-cursor stylesheet, selectable-text
  behavior, and saved light/dark Cursor Settings value. An open editor follows
  same-origin preference changes live. Timeline placement, scaling, dragging,
  trimming, splitters, help, text, disabled controls, and busy authentication,
  import, or analysis states retain distinct semantic cursors; reduced motion
  keeps the working cursor static and pointer-operation cleanup prevents stuck
  drag or resize cursors.

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
values, and ruler geometry at minimum and maximum scale. Guideline coverage
verifies the None-first selector, tooltip hover/focus, screenshot-derived
Reels/TikTok geometry, frame pausing, pointer transparency, and auth/mobile
blocking. Icon coverage checks local SVG responses, decorative semantics, and
play/pause state swaps. Tab coverage verifies the semantic 98.css hierarchy,
the permanent sticky home tab, selection and focus, icon/title/close content,
pressed-only close treatment, measured marquee overflow, reduced motion,
pointer and keyboard reordering, close, and launcher-based reopening.
Side-panel coverage exercises both separators by pointer and keyboard at
default and dynamic bounds while
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
Cursor coverage verifies shared versioned resources, fresh and saved modes,
live cross-tab mode changes, light/dark assets, selectable text, fixed title
bars, help/select/text/unavailable/working/precision/move/pressed/resize
semantics, media-import and authentication busy states, reduced motion,
pointer-operation cleanup, mobile behavior, overflow, and local asset
responses.
Typography coverage waits for the bundled font, enforces the 11-pixel/14-pixel
microcopy floor, checks text-node bounds and scroll geometry, and captures the
empty editor plus social-guide labels at 1024 x 800, 1280 x 800, and
1440 x 900. Authentication coverage additionally asserts the scalable
13-pixel mask style and captures populated, still-masked password fields in
the homepage form at 375 x 812, 768 x 1024, 1280 x 800, and 1440 x 900, plus
the Video Editor dialog at and above its 1024-pixel boundary.

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
frames, each UI Guidelines platform, the information tooltip, extreme wide and
tall custom ratios, Standard and Side-by-side layouts
at regular and short desktop heights, the focused horizontal and vertical
hatched grips, the permanent Effects home tab, native effect tabs at minimum
and maximum panel widths, long tab titles, reduced motion, the pressed close
control, ruler scale endpoints, both custom-cursor color modes, active import
and authentication working cursors, and in-progress horizontal and vertical
resize cursors. Check screenshots and semantic snapshots,
document-level overflow, console output, page errors, and failed local
resources. Treat 11 pixels with a 14-pixel line box as the minimum for the
bundled pixel font; inspect preview status, tooltip, ruler, track, clip, graph,
preset, and social-guide labels for uneven spacing or clipped glyph bounds.
For Audio-Sync, inspect empty, analyzed, multiple-rule, guidepost,
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
