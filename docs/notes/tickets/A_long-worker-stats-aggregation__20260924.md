# A_long-worker-stats-aggregation__20260924 — Active

- Scope: Move Game Stats aggregation from an unbounded full-table scan in Worker memory into SQL, stop shipping every event id to the browser, add a short cache, and split `workers/game-stats/src/index.mjs` into modules.
- Status: active
- Opened: 2026-09-24
- Updated: 2026-09-30
- Current State: Implemented locally on DEM-179 and awaiting review/integration. `/stats` now aggregates and ranks in SQL, protocol 2 uses bounded explicit acknowledgments and a five-second platform cache, Refresh/publication reads bypass it, the Worker is split into focused modules, and migration 0004 installs the proven category indexes while removing two obsolete broad indexes. The protocol-1 compatibility path remains for cached browsers. Production deployment, Worker version recording, and live before/after comparison remain coordinator-owned release work.
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
3. Split into `events.mjs`, `aggregate.mjs`, `security.mjs`, `sessions.mjs`, `http.mjs`, `router.mjs`; compare the candidate bundle with the verified production baseline of 55.18 KiB / 12.05 KiB gzip and record any justified growth.
4. Migration `0004`: replace the four category indexes with partial category indexes used by the new query plans; remove the broad game/type and player indexes after real SQLite `EXPLAIN QUERY PLAN` evidence; retain security-expiry and Sudoku identity indexes.

## Implementation Result

- Verified pre-change production identity from coordinator evidence: Worker
  version `0af44bec-ab1d-4cd9-a15e-942c8fe66be6`, build
  `sha256-1fca6649114c1d98e7c1ad88b733dab71a772e509d0df1118b93fb64f09b0d08`.
  The captured D1 snapshot matches the candidate totals, player totals,
  leaderboards, ranks, and records across all seven supplied player scopes.
- `src/index.mjs` is now a 10-line facade over constants/data, aggregation,
  events, HTTP/cache, routing, security, and session modules. The emitted bundle
  contains no in-memory legacy aggregation oracle; the frozen parity helper is
  under `tests/helpers/` only.
- SQL returns grouped totals plus window-ranked global Top 3 and the requested
  player's record/rank. A real SQLite fixture covers 12 players in all 14
  leaderboard categories, malformed history, tie behavior, cache isolation,
  failures, acknowledgments, and index plans.
- Protocol 2 caps pending acknowledgments at 32 and never returns lifetime IDs.
  The browser retains unacknowledged confirmed events, ignores stale-profile
  responses, and forces fresh reads after Refresh or publication.
- Local Wrangler applied migrations 0001-0004 in an isolated D1 state and
  listed all four category, two expiry, and Sudoku identity indexes. Wrangler
  local D1 rejects `PRAGMA integrity_check` with `SQLITE_AUTH`; the equivalent
  Node SQLite migration fixture and D1 index query passed.
- Focused source/Worker tests, strict Wrangler dry-run, 95%+ line coverage, and
  Game Stats/Game Progress Playwright checks pass at 375×812, 768×1024,
  1280×800, and 1440×900. The candidate dry-run is 62.32 KiB / 14.39 KiB
  gzip; the increase is the fixed SQL/window query set and cache/protocol path,
  not the removed event-table aggregation loop. Full final gate evidence is
  recorded in DEM-179.
