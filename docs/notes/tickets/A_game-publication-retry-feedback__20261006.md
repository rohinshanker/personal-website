# A_game-publication-retry-feedback__20261006 — Active

- Scope: Add one delayed retry for transient game-result publication failures and visible feedback for results dropped when the 100-result publication queue overflows.
- Status: active
- Opened: 2026-10-06
- Updated: 2026-10-17
- Current State: Implemented 2026-10-17 on branch `claude/retry-feedback-biome-20261017` (session pw-fable-ticket-closing-2): one automatic retry per transient publication failure (`retry-scheduled` state, Retry-After aware, cancelled by every other trigger and by `pagehide`) and a persisted dropped-result count appended to every settled status. Contract recorded in `docs/validation/game-stats-refresh-control.md`. Awaiting owner visual approval of the renders listed under Owner Review.
- Verification: Test transient/permanent/auth/expired-proof distinctions, one-retry bounds, duplicate triggers, success/reset/page-exit cleanup, queue overflow accounting and storage failures. Render retry/failure/dropped-result states at all four standard viewports with clean diagnostics and accessible status feedback. Run affected behavior/browser/accessibility/integrity/context checks and inspect the final renders.
- Owner Approval: Required before closing. Preserve a concrete final visual inspection page or screenshots showing retry/overflow feedback for the owner; passing automated checks and a committed patch do not close this ticket without explicit owner approval.
- Cleanup: After owner approval, retain only reusable retry/overflow/status contracts in indexed Game Stats guides, then resolve and delete this ticket/index row. Keep review artifacts while approval is pending.

## Owner Review

Open [the state review page](../../validation/assets/game-stats-refresh-review.html)
(cards `retry-scheduled`, `ready-dropped-results`, `request-failed-dropped-result`)
and the live renders captured by the browser suite under
`docs/validation/assets/game-stats-retry-feedback/`:

| File | What it shows |
| --- | --- |
| `retry-scheduled-desktop.png` | Minesweeper Stats at 1280×800 after a failed publish, Refresh enabled, one automatic retry pending. |
| `retry-scheduled-mobile.png` | The same state at 375×812. |
| `retry-spent-mobile.png` | 375×812 after the retry also failed: plain `Request failed. Try again later.`, no further timer. |
| `dropped-results-mobile.png`, `-tablet.png`, `-desktop.png`, `-wide.png` | Ready state with `3 unpublished results were dropped because the publishing queue was full.` at 375×812, 768×1024, 1280×800, 1440×900. |
| `review-page-mobile.png`, `-tablet.png`, `-desktop.png`, `-wide.png` | Full-page captures of the review page at the four viewports. |

Approve or request copy/placement changes; the count sentence, the retry
sentence and the one-retry/Refresh semantics are the decisions to confirm.

## Constraints

- Preserve local game statistics, the bounded queue, existing manual/online/open/new-result retry triggers, verified replay/proof ownership and session expiry. A retry cannot renew an expired proof or change a permanent verification failure into a success.
- Prevent parallel/duplicate publication, unbounded retry loops and orphaned timers. Use the existing status/action/loading-cursor design and an understandable dropped-result count.
- No push, deployment or rollout cutoff selection is authorized. Start canonical edits only after the active leaderboard ticket's resolved commit and coordinator release.
