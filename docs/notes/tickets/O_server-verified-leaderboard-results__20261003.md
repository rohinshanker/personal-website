# O_server-verified-leaderboard-results__20261003 — Open

- Scope: Verify Minesweeper, Solitaire, Snake, and Sudoku results on the server using issued initial state, bounded input replays, server-derived metrics, and explicit result provenance.
- Status: open
- Opened: 2026-10-03
- Updated: 2026-10-03
- Current State: Proposed design is recorded in [leaderboard-result-verification.md](../../validation/leaderboard-result-verification.md); implementation has not started. The current Worker validates signed sessions and bounded submissions but does not replay gameplay. Public build hashes remain release/cache metadata. Tier: long; resolve the ranking and hidden-information policy before implementation.
- Verification: Test shared engines in browser and Worker environments; legal and illegal transitions for all four games; altered state/configuration/version and fabricated metrics; bounded verification work; replay reuse, expiry, concurrency, idempotency and atomic failure; assistance, timing, offline/resume and legacy provenance. Run the full Node, Worker, browser/accessibility, integrity, and pinned-Colima visual gates; inspect publishing states at 375×812, 768×1024, 1280×800, and 1440×900.
- Cleanup: Distill the implemented rules/replay, timing, provenance, migration, and release contracts into indexed validation guides. Resolve and remove this ticket and its queue row after acceptance; retain no task history.

## Decisions required

1. **Timed rankings:** use server-observed start/finish for trusted elapsed time. Decide whether ranked timing includes pauses or requires server-observed pause/resume with enforced rules. Keep local display timing separate from verified ranking eligibility.
2. **Hidden information:** completion-only replay verification proves legal transitions but lets a modified client inspect a delivered mine map, deck, or solution. Decide whether ranked play requires server-owned hidden state and online reveals/assistance, accepting the additional requests and latency.
3. **Ranking migration:** choose how verified rankings and legacy/unverified results appear. Preserve existing records and their provenance; do not relabel old results or reset player data.

Neither replay validation nor online hidden-state enforcement proves a human played or excludes an external solver. Record this limitation in the product's verification claim.

## Implementation scope

1. Extract deterministic rule engines from `scripts/home/features/{minesweeper,solitaire,snake,sudoku}.js`, keeping DOM, animation, audio, timers, and storage in the feature controllers. Coordinate reusable engine/session work with [A_long-shared-game-layer__20260924.md](A_long-shared-game-layer__20260924.md); this ticket does not include its unrelated rendering or lazy-loading work.
2. Extend the existing Game Stats Worker and signed-session protocol to issue the game identity, rules version, initial state or seed, configuration, issue time, and expiry. Bind the replay to this stored state and signature. Define replay/rules versions independently from cosmetic frontend build hashes.
3. Record ordered inputs and verify every transition. Derive the terminal result and score/move/assistance metrics on the server. Bound request size, input count, ticks, and verifier work before execution.
4. Preserve authentication, Administrator authorization, rate limits, expiry, and duplicate idempotency. Consume a session and store its derived result atomically; never grant verified provenance to presentation-only Admin presets.
5. Implement the chosen timing and hidden-information policies. Retain offline play/local statistics; arbitrary offline saves cannot become verified by obtaining a new session only at completion. Resumed issued games must preserve their original identity and verification history.
6. Add versioned provenance and the chosen leaderboard presentation. Roll out compatible clients and Worker changes using the existing controlled release sequence, without resetting historical data.

## Acceptance checks

- Minesweeper: reveal/flag/chord legality, first-click safety, loss, and revelation of every safe cell.
- Solitaire: stock draws, pile transfers, undo, permitted auto-solve, card ownership, foundation completion, and derived move counts.
- Snake: direction changes at deterministic ticks, reproducible apples, collisions, score, tick limits, and sufficient server-observed elapsed time.
- Sudoku: givens, edits/undo, completed units, counted server assistance, and the permitted assistance category; never claim replay can detect unreported external solving.
- Reject altered issued state, mismatched configurations/rules versions, fabricated metrics, malformed/reordered/truncated/oversized replays, reused sessions, and invalid timing evidence.
- Real SQLite transaction tests cover concurrent duplicates and failure atomicity; Worker-runtime integration covers request and execution limits. Browser/server fixtures produce identical engine states and results.
- Render local-only, verified, rejected, expired, resumed, legacy, and offline publishing states. Verify ordinary gameplay, keyboard/focus behavior, and existing local statistics remain usable.
