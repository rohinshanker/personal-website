# O_long-worker-stats-aggregation__20260924 — Open

- Scope: Move Game Stats aggregation from an unbounded full-table scan in Worker memory into SQL, stop shipping every event id to the browser, add a short cache, and split `workers/game-stats/src/index.mjs` into modules.
- Status: open
- Opened: 2026-09-24
- Updated: 2026-09-24
- Current State: Opened from the 2026-09-24 whole-site audit. Nothing started. Tier: long. Requires an additive D1 migration and the Worker version ID recorded per `docs/validation/game-stats-backend.md`; the index-drop and the committed `database_id` are decision items in `O_decide-games-and-backend__20260924.md`. Related: `O_sudoku-followups__20260924.md` item 1 also needs a migration; batch them.
- Verification: `npm --prefix workers/game-stats test` keeping the current 95% line coverage; `npm --prefix workers/game-stats run deploy:check`; the release workflow's `game-stats:worker-transition:check` and `game-stats:release:check`; `tests/ui/game-stats-multiplayer-ranks.spec.mjs` and the 10+ player stress procedure in `docs/validation/game-stats-multiplayer.md`; compare `/stats` JSON before and after on production for identical totals and top-3 ordering.
- Cleanup: Update the aggregation and payload contract in `docs/validation/game-stats-backend.md` and `docs/validation/game-stats-multiplayer.md`, then delete this ticket and its index row.

## Findings

1. **`GET /stats` is a full-table scan with O(n²) aggregation, uncached and unthrottled**: `SELECT_EVENTS_SQL` (`src/index.mjs:80-95`) has no WHERE or LIMIT; `:553` `stats.eventIds.includes(event.id)` inside the loop; `:557-559` sorts the full list per event with a `Number.MAX_SAFE_INTEGER` limit; `:235` `eventIds: []` is serialized to the client; `:761` sets `Cache-Control: no-store`; `handleGetStats` (`:1374`) applies no origin check or rate limit. The browser (`main.js:1534`) only dedups the ids locally. Response size and CPU grow with lifetime events on a public endpoint.
2. **Six indexes are used by no query**: all SQL is PK lookup (`WHERE id = ?`, `WHERE bucket = ?`) or full scan, so `game_events_minesweeper_idx`, `_solitaire_idx`, `_snake_idx`, `_sudoku_idx`, `_player_idx`, `_game_type_idx` (`migrations/0001:18-23`) only add write amplification. After aggregation moves into SQL, keep exactly the indexes the new queries use.
3. **`src/index.mjs` is 1,426 lines** mixing constants, validation, aggregation, crypto, rate limiting, sessions, admin, and routing.
4. Not verified: whether Cloudflare rate limiting fronts the Worker, and current D1 row counts. The finding is structural.

## Plan

1. Aggregate in SQL: `GROUP BY game, difficulty` totals; window-ranked global top 3 and requested-player rank; drop `eventIds` from the payload (browser dedups locally already); use a `Set` where an in-memory pass remains.
2. Short `Cache-Control` or Cache API TTL on `/stats` (seconds, not minutes, so a fresh win still appears on the refresh control).
3. Split into `events.mjs`, `aggregate.mjs`, `security.mjs`, `sessions.mjs`, `http.mjs`, `router.mjs`; `deploy:check` bundle size stays under the current 50.71 KiB / 11.04 KiB gzip or the doc is updated.
4. Migration `0003`: drop unused indexes (pending the decision) and add any index the new aggregation needs.
