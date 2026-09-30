# A_long-worker-stats-aggregation__20260924 — Active

- Scope: Move Game Stats aggregation from an unbounded full-table scan in Worker memory into SQL, stop shipping every event id to the browser, add a short cache, and split `workers/game-stats/src/index.mjs` into modules.
- Status: active
- Opened: 2026-09-24
- Updated: 2026-09-30
- Current State: Coordinator is agent-deck session `2f758d2d-1790569488`; read-only Multica scout DEM-178 is checking SQL and browser confirmation seams against baseline `178130c808481ad3c8ca32292f7a6eb1c2d750c3`. Owner decided five-second caching with fresh Refresh/publication reads, and index removal only after proving an index is phased out and unnecessary for the production build. Other-project agents retain priority. Migration 0003 already contains Sudoku puzzle identity; use 0004. Preserve confirmed-event UI convergence and cached-browser compatibility when removing the lifetime event-ID payload. Record the deployed Worker version ID and compare production totals/rank order before completion.
- Verification: `npm --prefix workers/game-stats test` keeping the current 95% line coverage; `npm --prefix workers/game-stats run deploy:check`; the release workflow's `game-stats:worker-transition:check` and `game-stats:release:check`; `tests/ui/game-stats-multiplayer-ranks.spec.mjs` and the 10+ player stress procedure in `docs/validation/game-stats-multiplayer.md`; compare `/stats` JSON before and after on production for identical totals and top-3 ordering.
- Cleanup: Update the aggregation and payload contract in `docs/validation/game-stats-backend.md` and `docs/validation/game-stats-multiplayer.md`, then delete this ticket and its index row.

## Findings

1. **`GET /stats` is a full-table scan with O(n²) aggregation, uncached and unthrottled**: `SELECT_EVENTS_SQL` (`src/index.mjs:80-95`) has no WHERE or LIMIT; `:553` `stats.eventIds.includes(event.id)` inside the loop; `:557-559` sorts the full list per event with a `Number.MAX_SAFE_INTEGER` limit; `:235` `eventIds: []` is serialized to the client; `:761` sets `Cache-Control: no-store`; `handleGetStats` (`:1374`) applies no origin check or rate limit. The browser (`main.js:1534`) only dedups the ids locally. Response size and CPU grow with lifetime events on a public endpoint.
2. **Six indexes are used by no query**: all SQL is PK lookup (`WHERE id = ?`, `WHERE bucket = ?`) or full scan, so `game_events_minesweeper_idx`, `_solitaire_idx`, `_snake_idx`, `_sudoku_idx`, `_player_idx`, `_game_type_idx` (`migrations/0001:18-23`) only add write amplification. After aggregation moves into SQL, keep exactly the indexes the new queries use.
3. **`src/index.mjs` is 1,426 lines** mixing constants, validation, aggregation, crypto, rate limiting, sessions, admin, and routing.
4. Not verified: whether Cloudflare rate limiting fronts the Worker, and current D1 row counts. The finding is structural.

## Plan

- Owner decision (2026-09-30): five-second cache for ordinary reads; manual Refresh and a successful publication bypass it. Remove an old index only after proving production and candidate queries do not need it; retain security and Sudoku identity indexes.

1. Aggregate in SQL: `GROUP BY game, difficulty` totals; window-ranked global top 3 and requested-player rank; drop `eventIds` from the payload (browser dedups locally already); use a `Set` where an in-memory pass remains.
2. Short `Cache-Control` or Cache API TTL on `/stats` (seconds, not minutes, so a fresh win still appears on the refresh control).
3. Split into `events.mjs`, `aggregate.mjs`, `security.mjs`, `sessions.mjs`, `http.mjs`, `router.mjs`; `deploy:check` bundle size stays under the current 50.71 KiB / 11.04 KiB gzip or the doc is updated.
4. Migration `0003`: drop unused indexes (pending the decision) and add any index the new aggregation needs.
