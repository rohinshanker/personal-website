# Admin Controls

Purpose: Validate the local-only promotional event orchestrator and recording helpers.

Scope: The Admin desktop and dock launchers, Admin Controls window, random-event runtime, seeded controls, scene presets, and capture aids on `home.html`.

Last verified: 2026-08-03

## State and safety contract

- Opening the full Admin Controls window requires the current, unexpired
  Administrator proof issued by the game-stats Worker after a successful sign-in.
  The proof is held in `sessionStorage` under
  `personalSiteAdministratorProofV1`; a saved Administrator profile by itself
  never grants access.
- A missing, malformed, expired, or server-rejected proof routes both Admin
  launchers to a managed `Admin Controls` alert containing the Program Manager
  icon, `nothing to see here...`, and an `OK` button. Expired and rejected proofs
  are removed before the next launch decision.
- The launch check is a presentation boundary in browser code. Server-protected
  game-stat actions continue to require Worker verification of the proof; the
  presence or visibility of the client-side window is not server authorization.
- The proof is evaluated when the Admin window is opened. Expiration does not
  interrupt a take already in progress or erase locally stored bindings and
  capture settings; those behaviors intentionally continue outside the window
  for recording. Clear Admin Data before leaving a shared browser when that
  local orchestration should not persist.
- Admin configuration is stored only in versioned browser `localStorage` under
  `personalSiteAdminControlsV1`. The reset-reload handshake uses the transient
  `personalSiteAdminControlsResetPendingV1` session key; no Admin state is sent
  to a server.
- Stored bindings use stable semantic target keys (`id:`, `app:`, `start`, or a
  whitelisted action fingerprint), never saved CSS selectors.
- Direct Admin triggers bypass natural-event timing and probability but keep
  each event's gameplay, pending-state, and visible-window safety checks.
- Seeded controls perform their normal action and trigger the configured event
  once or repeatedly. One-shot bindings remove themselves immediately. Natural
  random events are suppressed for that browser task to prevent duplicate
  results.
- Seed badges and accessible descriptions appear only while Admin Controls is
  open. The target picker temporarily closes Admin Controls, pauses natural
  events, and reopens with the selected control populated.
- The game-win preset is presentation-only: it displays Solitaire's victory
  state without publishing a result or mutating game statistics.
- Privacy fixtures are visual replacements. They must not overwrite existing
  input values. Audio-off applies to current and subsequently played HTML media;
  the visual-effects switch applies through the Admin root state.
- Reset Scene reloads the page without deleting Admin configuration or unrelated
  session storage. Clear Admin Data removes only the Admin local-storage entry.

## Focus and keyboard contract

- Both launchers expose `aria-haspopup="dialog"`, use the Program Manager icon,
  and control both possible Admin window IDs. The dock launcher stays immediately
  before the final GitHub shortcut.
- An unauthorized launch focuses the notice's `OK` button. `OK`, title-bar Close,
  and Escape dismiss it and restore focus to the exact launcher that opened it.
- Tabs support click and arrow-key navigation. Escape cancels target picking or
  closes Admin Controls and restores focus to the launcher that opened it.
- When another managed dialog is above Admin Controls, the first Escape closes
  only that dialog; a subsequent Escape may close Admin Controls.
- Countdown, shot-cue, and framing overlays do not trap pointer input.

## Verification

Run the source and focused browser coverage:

```bash
node --test tests/admin-controls.test.mjs tests/administrator-sign-in.test.mjs tests/random-event-cooldown.test.mjs
npx playwright test tests/ui/admin-controls.spec.mjs --workers=1
npx playwright test tests/ui/administrator-sign-in.spec.mjs --workers=1
```

The browser suite checks 320x568, 375x812, 568x320, 768x1024, 1280x800, and
1440x900.
It covers valid, missing, malformed, and expired proof routing; the real mocked
sign-in handoff; the inaccessible notice and full-window states; all four tabs;
local persistence; deterministic sequences; direct and seeded events; the target
picker; scene reset; presets; capture controls; media; privacy fixtures; both
launcher paths and ordering; focus restoration; overflow; console errors; runtime
errors; and mutating network requests.

For a release, also run the full gates in [site-quality-gates.md](site-quality-gates.md).
