# Admin Controls

Purpose: Validate the local-only promotional event orchestrator and recording helpers.

Scope: The Admin desktop and dock launchers, Admin Controls window, random-event runtime, seeded controls, scene presets, and capture aids on `home.html`.

Last verified: 2026-09-06

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
- Generated sequence names are normalized, deduplicated, limited to the 50 most
  recently used names, and exposed through the deletable saved-seed menu.
- Stored bindings use stable semantic target keys (`id:`, `app:`, `start`, or a
  whitelisted action fingerprint), never saved CSS selectors.
- Direct Admin triggers bypass natural-event timing and probability but keep
  each event's gameplay, pending-state, and visible-window safety checks.
- **Random** chooses uniformly from currently eligible registered events through
  the site's shared two-minute per-event selection lockdown. Fixed events and
  deterministic sequence cues remain directly repeatable.
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

The browser suite checks 320x568, 375x812, 560x800, 561x800, 568x320, 768x1024,
1280x800, and 1440x900.
It covers valid, missing, malformed, and expired proof routing; the real mocked
sign-in handoff; the inaccessible notice and full-window states; all four tabs;
local persistence; the saved-seed menu and deletion; deterministic sequences;
repeat-safe Random selection; direct and seeded events; the target picker; scene
reset; presets; capture controls; media; privacy fixtures; both launcher paths and
ordering; focus restoration; overflow; console errors; runtime errors; and
mutating network requests.

For a release, also run the full gates in [site-quality-gates.md](site-quality-gates.md).

## Repeatable promo-video takes

Use a named deterministic sequence when multiple takes must follow the same event order. Seed names, sequences, bindings, and capture settings are stored only in the current browser.

1. Open **Admin Controls**. If the desktop must begin clean, choose **Reset Scene**, wait for the reload, and reopen Admin Controls.
2. In **Capture**, type a durable name in **Sequence seed**, such as `home-intro-v1`, and choose **Generate**. Focusing or typing in the field opens the saved-seed menu. Choose a saved name to regenerate its sequence, or use its **Delete** button to remove only that name from the menu. The currently generated sequence remains active until another seed is generated or selected.
3. In **Bindings**, build the click path. Find each button or link with **Target** or **Pick on Screen...**, set **Event** to **Next deterministic sequence cue**, select **Every click**, and choose **Seed Control**. Repeat this for every target in the path. Use a specific event when one target must always launch that event.
4. Rehearse the same target order and the actions needed to finish or dismiss each event. A seeded target still performs its normal click, and every deterministic-sequence target advances the one shared sequence cursor. Allow time for each event to finish; safety checks can block an event that is already open or conflicts with active gameplay.
5. Optionally build an operator shot list in **Events** with **Add Cue**, then use **Previous**, **Next**, and **Show Cue** in **Capture**. The shot list is a prompt for the operator; it does not run events. **Run Next Cue** executes the next sequence event directly when a click target is not needed.
6. Configure the frame guide, safe area, audio, visual effects, privacy fixtures, countdown, and natural-event pause. For a click-driven take, do not use **Start Take**, because an automatic take advances the sequence independently.
7. Immediately before recording, choose the saved seed and select **Replay** to return to cue 1. Close Admin Controls, start recording, and perform the rehearsed clicks in the same order.
8. For every retake, use **Reset Scene**, reopen Admin Controls, choose the same seed, select **Replay**, start recording, and repeat the identical click path. The saved seed names, bindings, and capture settings survive the reset.

For an automatic take, choose **Replay**, set **Frequency**, **Duration**, and **Intensity**, then use **Run** > **Start Take**. Low, medium, and high intensity run one, two, and three sequence events per beat respectively. Rehearse the pacing so one event can finish before the next begins, and use **Stop** if the take needs to end early.

Choose **Random** only when variation is intentional. It chooses uniformly from events that are currently eligible and outside the website's recent-repeat window, so successive selections avoid recent events but are not deterministic. Use a named sequence or a specific event when every take must match.
