# O_decide-games-and-backend__20260924 — Open

- Scope: Remaining owner decisions about Snake's game-over animation and the Game Stats publication queue.
- Status: open
- Opened: 2026-09-24
- Updated: 2026-10-05
- Current State: Awaiting owner answers on the two choices below. Current session, timing and expiry contracts are documented in [game-stats-backend.md](../../validation/game-stats-backend.md).
- Verification: Record each answer and create an implementing ticket with behavior and rendered checks.
- Cleanup: Remove each decided item when its implementation is accepted; delete this ticket and its index row when no decisions remain.

## Decisions required

1. **Snake's game-over animation.** `scripts/home/features/snake.js` keeps the noise animation's requestAnimationFrame loop running while its window is visible and focused, bounded by blur, hidden-page and close guards. Confirm whether to keep the static-noise effect or stop after the last collection pulse. Recommendation: keep it if the continuous noise is intended.
2. **Publication queue retry.** `scripts/home/features/game-stats.js` retries transient failures on load, online, Game Progress open, manual Refresh or the next recorded result. The queue retains at most 100 results and silently drops the oldest on overflow. Options: preserve those triggers, add one backoff retry, or also show a dropped count. Recommendation: one backoff retry plus a visible dropped count.
