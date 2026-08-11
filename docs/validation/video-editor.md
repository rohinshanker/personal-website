# Video Editor Validation

Purpose: Preserve the public Video Editor route's local-session, responsive,
interaction, and accessibility contracts.

Scope: Homepage Video Editor launchers and `/video-editor/` media import,
composed preview, timeline tiers and clips, effects lane, editor tabs, and
desktop-required boundary.

Last verified: 2026-08-09

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
- Video and audio clips occupy compatible typed tiers without same-tier
  overlap. Pointer and keyboard paths cover placement, movement, trimming,
  deletion, tier changes, playhead movement, and scaling.
- The preview selects the active clip on the highest occupied video tier and
  schedules every active audio-tier clip into the local mix.
- Closed Captions, Windows 98, and Transitions open one labelled editor tab
  each. Tabs and three-second effect bars support pointer and keyboard
  reordering or movement, closing or deletion, reopening, and edge resizing.
  Effect editors remain explicit non-rendering placeholders.

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
filenames, a busy timeline, and all effect tabs. Authentication coverage
includes initial blocking, focus trapping, Escape, invalid credentials,
network failure, one-hour reuse across reload, timed expiry, proof removal,
project preservation, and repeated reauthentication. Every route test
collects console errors, uncaught page errors, and failed local resources.

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
and reauthenticated project. Check screenshots and semantic snapshots,
document-level overflow, console output, page errors, and failed local
resources. The repository does not currently install an automated
accessibility scanner, so do not claim an axe audit.

## Security boundary

The public route and its local editing code are static assets, so the dialog is
an interaction gate rather than a confidentiality boundary. The current
Administrator service has no standalone proof-validation or revocation
endpoint; this page can immediately detect the proof's one-hour expiry or local
removal, but not an early server-side signing-secret or IP invalidation. Any
future privileged network action must validate the bearer proof on the server.
