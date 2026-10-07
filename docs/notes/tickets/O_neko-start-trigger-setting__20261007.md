# O_neko-start-trigger-setting__20261007 — Open

- Scope: Rename the Neko alert's load-bearing production `debug` setting to describe its Start-triggered behavior, preserving scheduling and all visible behavior.
- Status: open
- Opened: 2026-10-07
- Updated: 2026-10-07
- Current State: Owner approved the rename after the behavior was explained. Queued as possible work between the current leaderboard ticket and the next long loading ticket; no source edits have started.
- Verification: Exercise forced Start scheduling, suppression on other natural triggers, cooldown/kind-capacity exceptions, per-event lockout, duplicate-pending/gameplay/visibility guards, delay and the manual stream launcher. Update and execute the debug-isolation helpers' behavioral tests, then render prompt/Yes/No/Escape/40-cat states at standard viewports and run affected Neko/event/browser/accessibility/integrity/context gates.
- Cleanup: Preserve the setting/scheduling contract in indexed event/Neko guidance, then resolve and delete this ticket/index row after acceptance.

## Preserve the full behavior

- Start force-selects the available `Trigger /nekostream?` alert; Yes starts the existing 40-cat taskbar wave.
- The old flag also bypasses global trigger cooldown and kind capacity; preserve those exceptions and the two-minute per-event selection lockout, zero-to-two-second delay, pending/visibility guards, reduced motion and gameplay locks.
- Keep real developer debug controls separate from the named production policy while preserving test-isolation behavior and manual Admin/menu launchers.
- Use current feature-local files, not the obsolete monolithic `main.js` pointers. Preserve published compatibility history when regenerating build tokens. No push/deployment is authorized.
