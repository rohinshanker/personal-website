# O_decide-games-and-backend__20260924 — Open

- Scope: Remaining owner decisions about Snake's game-over animation and the Game Stats publication queue.
- Status: open
- Opened: 2026-09-24
- Updated: 2026-10-06
- Current State: Owner chose both recommendations on 2026-10-06: keep Snake's noise effect, add one delayed publication retry and visible overflow feedback. The feedback implementation is assigned to a separate ticket requiring the owner's final visual approval before closure. Current session, timing and expiry contracts are documented in [game-stats-backend.md](../../validation/game-stats-backend.md).
- Verification: Record each answer and create an implementing ticket with behavior and rendered checks.
- Cleanup: Remove each decided item when its implementation is accepted; delete this ticket and its index row when no decisions remain.

## Decisions required

1. **Snake's game-over animation.** `scripts/home/features/snake.js` keeps the noise animation's requestAnimationFrame loop running while its window is visible and focused, bounded by blur, hidden-page and close guards. Confirm whether to keep the static-noise effect or stop after the last collection pulse. Recommendation: keep it if the continuous noise is intended.
   - Decision (2026-10-06): keep the existing continuous static-noise effect as recommended; preserve visibility/focus/lifecycle guards. No implementation is needed for this choice.
2. **Publication queue retry.** `scripts/home/features/game-stats.js` retries transient failures on load, online, Game Progress open, manual Refresh or the next recorded result. The queue retains at most 100 results and silently drops the oldest on overflow. Choose one delayed retry plus a visible dropped count, retry only, or the current triggers and silent overflow. Recommendation: one delayed retry plus a visible dropped count.
   - Decision (2026-10-06): one delayed retry plus visible overflow feedback as recommended. Implement under [O_game-publication-retry-feedback__20261006.md](O_game-publication-retry-feedback__20261006.md), which stays open until the owner visually approves the final UI.
