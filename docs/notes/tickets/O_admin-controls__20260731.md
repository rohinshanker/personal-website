# O_admin-controls__20260731 — Open

Scope: Gate the Admin Controls app behind the active Administrator session, then manually validate the promotional-content workflow and access behavior.

Status: open

Opened: 2026-07-31

Updated: 2026-08-03

Current State: The Admin Controls implementation and automated access-gate validation are complete. The ticket remains open for the requested manual acceptance pass: a current Administrator sign-in opens the full controls, while a missing, invalid, expired, or server-rejected sign-in proof opens the Program Manager “nothing to see here...” notice.

Verification: Automated on 2026-08-03: 225 source tests passed; the 7-test Admin Controls browser suite, 8-test Administrator sign-in browser suite, and shared content-tool popup regression passed. Authenticated and unauthenticated states were rendered at phone, tablet, laptop, and desktop sizes with no final console warnings or errors. Game integrity, icon-manifest, secret, and diff checks passed. Manual acceptance remains pending.

Cleanup: After manual acceptance, record only reusable guidance in `docs/validation/admin-controls.md`, then resolve and remove this ticket from the live queue.

## Mental Model

- **Run** starts prepared scenes or an automatically paced take.
- **Events** finds and immediately triggers an individual random event, advances a repeatable sequence, or adds an event to the shot list.
- **Bindings** attaches an event to an existing site button or link. The original click still happens; the seeded event is added to it.
- **Capture** makes takes repeatable and configures pacing, shot cues, framing, audio, effects, privacy fixtures, and natural-event behavior.

## Manual Acceptance Checklist

### 1. Launching and navigation

- [ ] Confirm `Admin` appears on both the desktop and dock with the Program Manager icon, and that the dock places it immediately before GitHub.
- [ ] Before signing in as Administrator, launch Admin from both locations. Confirm only a small `Admin Controls` notice appears with the Program Manager icon, the exact text `nothing to see here...`, and an `OK` button; the full controls must not flash or become visible.
- [ ] Dismiss the notice with `OK`, the title-bar Close button, and Escape in separate attempts. Confirm focus returns to the exact desktop or dock launcher used each time.
- [ ] Save or select the Administrator profile without completing a current Administrator sign-in (or remove `personalSiteAdministratorProofV1` from session storage). Confirm the saved profile by itself still opens the notice.
- [ ] Try an incorrect Administrator password, dismiss the error, and launch Admin. Confirm the failed attempt does not unlock the full controls.
- [ ] Complete a successful Administrator sign-in in Cursor Settings, then launch Admin from both locations. Confirm the full `Admin Controls` window opens, all four tabs are readable, the status bar is visible, and the window stays above the taskbar.
- [ ] Reload the same tab while the short-lived proof is still current and confirm Admin remains available. Remove the proof or retry after it expires and confirm the next launch returns to the notice. A server-rejected proof should also be cleared before the next launch.
- [ ] Confirm the gate is evaluated when Admin is opened: it does not interrupt a take already in progress or erase locally saved bindings/settings when the proof later expires. Use `Clear Admin Data` before leaving a shared browser if those local promotional settings should not remain active.
- [ ] When checking real sign-in locally, use a locally configured Worker origin; otherwise perform this step on the deployed site, whose origin is accepted by the production Worker.
- [ ] Resize to a narrow/mobile browser width and confirm the window remains usable through its own scrolling without horizontal page overflow.
- [ ] Launch Admin from each location. Use Left/Right arrow keys on the tab row, then press Escape. Confirm tabs change and focus returns to the launcher that opened it.

### 2. Quick scenes and take controls

- [ ] In **Run**, set `Delay` to `No delay` and turn off `Hide Admin before triggering` while learning the controls.
- [ ] Try `Dialog`, `Notification`, and `Desktop Activity`. Confirm each creates an obvious recordable scene and can be closed normally.
- [ ] Trigger `Dialog`, press Escape once, and confirm only the foreground dialog closes. Press Escape again and confirm Admin Controls closes.
- [ ] Try `Game Win`. Confirm Solitaire opens with its victory presentation, but no completed game or leaderboard result is published.
- [ ] Set a 3-second delay, enable the countdown overlay and `Hide Admin before triggering`, then run a quick scene. Confirm Admin hides before the scene and the countdown is visible.
- [ ] Generate a sequence in **Capture**, return to **Run**, start a take, and confirm events advance at the selected pacing. Confirm `Stop` immediately ends the take.
- [ ] Click `Reset Scene`. Confirm the page reloads to a clean visual state while the Admin settings and bindings remain available.

### 3. Direct events and shot cues

- [ ] In **Events**, search by part of an event name and switch among All, Interactive, and Non-interactive. Confirm the list updates predictably.
- [ ] Select a recognizable event and click `Trigger Now`. Confirm the chosen event opens and the status bar describes the result or explains why it was safely blocked.
- [ ] Click `Add Cue`, open **Capture**, and confirm the event appears in the shot list.
- [ ] Add several cues, use Previous/Next, and click `Show Cue`. Confirm the cue overlay is readable and advances as expected.

### 4. Seeded controls

- [ ] In **Bindings**, search for a target and confirm duplicate launchers are clearly distinguished as `(Desktop)` and `(Dock)`.
- [ ] Choose a harmless target, select a specific event, choose `Next click only`, and click `Seed Control`.
- [ ] While Admin is open, confirm the seed count increases, the binding appears in the list, and the target has a visible `SEED` badge without shifting or shrinking its icon.
- [ ] Close Admin and confirm the badge disappears. Click the target and confirm its normal action still occurs along with the event. Reopen Admin and confirm the one-time binding is gone.
- [ ] Repeat with `Every click`. Click the target twice and confirm the event remains seeded after both clicks.
- [ ] Seed another target with `Random eligible event`. Confirm each click requests an event, while any unsafe or conflicting event is rejected with a useful status message.
- [ ] Use `Pick on Screen...`. Confirm Admin temporarily closes, eligible controls are highlighted, clicking one reopens Admin with that target selected, and Escape cancels picking cleanly.
- [ ] Click `Clear Bindings` and confirm all badges, mappings, and the seed count clear without affecting unrelated site data.

### 5. Repeatable sequences

- [ ] In **Capture**, enter a memorable seed such as `promo-test-01` and click `Generate` twice. Confirm the sequence is identical both times.
- [ ] Change the seed and regenerate. Confirm the sequence changes, then use `Replay` and `Run Next Cue` to restart and step through it.
- [ ] Reload the page and confirm the seed, generated sequence, current bindings, and capture settings persist locally in this browser.

### 6. Recording and safety helpers

- [ ] Try Vertical 9:16, Square 1:1, and Landscape 16:9 frame guides. Confirm each is centered above the taskbar and `Show safe area` adds an inset guide.
- [ ] Turn off `Audio`, trigger a scene containing media, and confirm it remains muted. Turn Audio back on for subsequent media.
- [ ] Turn off `Extra visual effects`, trigger a visual scene, and confirm optional flourishes are reduced without making the UI unusable.
- [ ] Enable `Privacy fixtures`. Confirm personal/profile text is visually replaced for recording, then disable it and confirm the original values were not overwritten.
- [ ] Toggle `Pause natural random events`. Confirm enabled is the calm, controlled recording mode; disabled allows ordinary background random events again.

### 7. Local-data boundaries

- [ ] With a binding and custom settings saved, reload the page and confirm they persist in the same browser.
- [ ] If convenient, open the site in another browser or private window and confirm those Admin settings do not follow you there.
- [ ] Click `Clear Admin Data`. Confirm Admin returns to defaults and removes bindings, but site/game data remains unchanged.

## Feedback to Capture

- [ ] Note any label whose meaning was unclear before trying it.
- [ ] Note any target that was difficult to find or pick.
- [ ] Note any event that failed without a useful explanation.
- [ ] Note any seeded badge, guide, overlay, or window that obscured content you wanted to record.
- [ ] Note which two or three controls you expect to use most often so they can be made even faster to reach later.
