# Game Stats Multiplayer Rankings

Purpose: Preserve the public Top 3, requested-player rank/record, stress-test,
and scoped-cleanup contracts for the Game Stats backend.

Scope: Worker aggregation, D1 reads, frontend leaderboard rendering, and
production verification data.

Last verified: 2026-07-25

## Response Contract

`GET /stats?playerId=<id>` returns fixed global leaderboards plus the requested
player's rank and full record:

```text
playerRanks
  minesweeper.<difficulty> -> { rank, totalPlayers }
  solitaire               -> { rank, totalPlayers }
  snake.<boardSize>        -> { rank, totalPlayers }
  sudoku.<difficulty>      -> { rank, totalPlayers }

playerRecords
  minesweeper.<difficulty> -> leaderboard entry | null
  solitaire               -> leaderboard entry | null
  snake.<boardSize>        -> leaderboard entry | null
  sudoku.<difficulty>      -> leaderboard entry | null
```

Sudoku ranks only no-hints completions. Rankings are ordinal and deterministic:
metric first, earliest completion second, then event ID. Public leaderboards
are sliced to the global Top 3 before the requested player is considered; a
ranked player outside the Top 3 is never injected into those arrays.

The browser accepts a rank only alongside a matching `playerRecord` for the
current saved profile. A local-only/pending record displays its metric with
`#—`. Empty Sudoku times display `99:99`.

## Stress-Test Contract

Automated aggregation coverage must use at least 10 complete player profiles
and exercise every category:

- Minesweeper: beginner, intermediate, expert
- Solitaire
- Snake: 10, 16, 20, 24
- Sudoku no-hints: easy, medium, hard, expert, master, extreme

For every queried profile, reconcile the expected rank and full record while
asserting that the public Top 3 is byte-for-byte identical. Include a player
outside the Top 3, an unplayed player, tied metrics, and a trusted historical
stored event. Stale browser submissions must still be rejected.

Run:

```bash
node --test tests/game-stats-worker.test.mjs \
  tests/game-stats-frontend-contract.test.mjs
npx playwright test tests/ui/game-stats-multiplayer-ranks.spec.mjs
```

## Production Tagging And Cleanup

Production smoke data must use one unique lowercase run prefix no longer than
50 bytes, for example `gst-YYYYMMDD-<random-hex>`. Put the prefix in every fake
player ID and event ID. Capture every created session ID in a temporary,
untracked manifest.

Before writes:

1. Export D1 and record its checksum outside the repository.
2. Capture a D1 Time Travel bookmark.
3. Record baseline counts and the exact IDs of rows that must survive.
4. Confirm current session/event rate buckets leave enough capacity; abort
   rather than retrying unexpectedly.

Cleanup deletes only:

- event IDs matching the exact run prefix and expected fake/protected player;
- the exact session UUIDs captured in the run manifest; and
- run-created rate buckets only when they do not share a baseline IP hash.

Never restore the whole pre-test export merely to remove smoke data: that can
erase legitimate concurrent writes. After cleanup, require zero tagged
events/players/sessions, exact baseline-row preservation, `PRAGMA quick_check =
ok`, and public `/stats` responses containing no run prefix.
