# A_long-shared-game-layer__20260924 — Active

- Scope: Extract compatible shared game helpers and lifecycle contracts, initialize Solitaire on first open, render its board incrementally, and implement owner-selected close/session/expiry policies.
- Status: active
- Opened: 2026-09-24
- Updated: 2026-10-05
- Current State: Current-source scoping completed (DEM-219); baseline fast suite passes 593/593. Independent implementation is underway: Solitaire initialization/rendering (DEM-220), reusable sessions and expiry feedback (DEM-221), and shared utilities/loaders/keyboard dispatch (DEM-222). Owner decisions are recorded below. Coordinator owns controller hook integration and final validation.
- Verification: Full fast and slow Node suites; syntax, secrets, generated assets, integrity and local deployment checks; full browser/accessibility and pinned visual gates; all four games' publishing flows with the offline Worker fixture; rendered Home/game states at 375×812, 768×1024, 1280×800 and 1440×900; independent review of the exact implementation patch.
- Cleanup: Preserve reusable helper, keyboard, rendering and session contracts in the applicable indexed validation guides. Resolve and delete this ticket and its queue row after acceptance; retain no task history or transient test output.

## Constraints

- Canonical checkout: `/Users/Rohin/Desktop/coding_stuff/personal-website`; integration branch `codex/shared-game-layer`; starting commit `0c67877852b97281857782194d69369083b70774`. Coordinator: agent-deck session `ac3d79cf-1791158960`.
- Use current `scripts/home/core/` and `scripts/home/features/` owners and explicit frozen `homeX` contracts. The old audit's `main.js` line numbers are obsolete.
- Already implemented: bounded Game Stats session map and Minesweeper's elapsed-time clock. Preserve the larger nonnegative advance of monotonic and wall clocks, the 999-second cap, and settlement before recording a win.
- Keep Snake's simulation clock separate. Share Minesweeper/Sudoku stopwatch mechanics only where their existing elapsed/pause/persistence semantics remain explicit.
- Keep Sudoku's worker generation, restored-puzzle identity/eligibility, assistance categories and publishing rules.
- Policy changes require the owner's answers recorded here and in the games/backend decision ticket. Do not silently relax Worker eligibility or turn an expired/offline result into verified play with an end-of-game replacement session. Server replay/ranking provenance belongs to the separate verification ticket.
- Keep first-open Solitaire deal generation, normal reset, staged Admin presentation, auto-solve cancellation/animation, undo and winnability intact. Stable columns/cards and cached solve availability must update after every real state change without leaking tooltip/listener nodes.
- Reuse the repository's actual browser fixture (`tests/ui/deterministic.mjs`), script-routing helpers and existing tooling. No new dependencies or broad snapshot updates.
- Writers use separate worktrees and disjoint paths. The coordinator owns ticket/index edits, generated integrity/cache metadata and integration. Workers do not push or reroute their assignments.

## Implementation streams

1. Current helper contracts and conservation risks: read-only scout DEM-219, complete.
2. Solitaire first-open initialization, incremental rendering and solve-plan caching: DEM-220; `/private/tmp/pw-shared-game-solitaire-20261005`, branch `codex/shared-game-solitaire`, baseline `1879cf5`.
3. Reusable sessions, explicit stats-hook factory, 120-per-hour budget and expired-result feedback: DEM-221; `/private/tmp/pw-shared-game-sessions-20261005`, branch `codex/shared-game-sessions`, baseline `03eedb8`. Shared utilities, loaders and active-window keyboard registry: DEM-222; `/private/tmp/pw-shared-game-helpers-20261005`, branch `codex/shared-game-helpers`, baseline `03eedb8`. Coordinator migrates the four game controllers to the new stats hooks after both streams land.
4. Integration, generated metadata, full validation, rendered inspection, exact-patch cross-provider review and documentation cleanup.

## Owner decisions (2026-10-05)

- Minesweeper: discard the game on close and start fresh on reopen; retain the existing real elapsed-time rule.
- Sessions: reuse unconsumed, unexpired sessions only for the same game/configuration across abandoned attempts or losses without submissions; raise new-session budget from 24 to 120 per IP per hour. A result awaiting profile selection, queueing or publication must reserve its session immediately so a newer attempt cannot reuse it. Submitted Snake results consume their sessions.
- Expiry: preserve the six-hour lifetime. Save expired results locally and explain expiry distinctly. Do not renew at completion, relax minimum-duration checks or falsely report a generic verification failure.
- Owner requested an explanation and later visual review of the expired-completion feedback. Use the existing Game Progress publishing-status row, preserving the win screen and local totals: “Saved on this device. This game’s online session expired, so this result can’t be published. Start a new game to publish a new result.” No extra modal or end-of-game renewal action. Capture the actual implemented message at the required viewport sizes for review.
