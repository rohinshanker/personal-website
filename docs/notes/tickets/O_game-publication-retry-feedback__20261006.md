# O_game-publication-retry-feedback__20261006 — Open

- Scope: Add one delayed retry for transient game-result publication failures and visible feedback for results dropped when the 100-result publication queue overflows.
- Status: open
- Opened: 2026-10-06
- Updated: 2026-10-06
- Current State: Owner approved the recommendation in games/backend item 2 and explicitly required final visual approval. Queued as possible between-ticket work after the leaderboard coordinator releases the checkout; implementation has not started.
- Verification: Test transient/permanent/auth/expired-proof distinctions, one-retry bounds, duplicate triggers, success/reset/page-exit cleanup, queue overflow accounting and storage failures. Render retry/failure/dropped-result states at all four standard viewports with clean diagnostics and accessible status feedback. Run affected behavior/browser/accessibility/integrity/context checks and inspect the final renders.
- Owner Approval: Required before closing. Preserve a concrete final visual inspection page or screenshots showing retry/overflow feedback for the owner; passing automated checks and a committed patch do not close this ticket without explicit owner approval.
- Cleanup: After owner approval, retain only reusable retry/overflow/status contracts in indexed Game Stats guides, then resolve and delete this ticket/index row. Keep review artifacts while approval is pending.

## Constraints

- Preserve local game statistics, the bounded queue, existing manual/online/open/new-result retry triggers, verified replay/proof ownership and session expiry. A retry cannot renew an expired proof or change a permanent verification failure into a success.
- Prevent parallel/duplicate publication, unbounded retry loops and orphaned timers. Use the existing status/action/loading-cursor design and an understandable dropped-result count.
- No push, deployment or rollout cutoff selection is authorized. Start canonical edits only after the active leaderboard ticket's resolved commit and coordinator release.
