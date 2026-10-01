-- The four original category indexes were shaped for event-order scans. The
-- SQL aggregation ranks one record per player, so replace them with partial,
-- covering indexes whose leading columns match each category and player
-- partition. The old Worker never relies on these indexes for correctness.
DROP INDEX game_events_minesweeper_idx;
DROP INDEX game_events_solitaire_idx;
DROP INDEX game_events_snake_idx;
DROP INDEX game_events_sudoku_idx;

CREATE INDEX game_events_minesweeper_idx
  ON game_events (difficulty, player_id, metric, occurred_at, id)
  WHERE game = 'minesweeper' AND type = 'win';

CREATE INDEX game_events_solitaire_idx
  ON game_events (player_id, occurred_at DESC, id DESC)
  WHERE game = 'solitaire' AND type = 'win';

CREATE INDEX game_events_snake_idx
  ON game_events (board_size, player_id, metric DESC, occurred_at, id)
  WHERE game = 'snake' AND type = 'gamePlayed';

CREATE INDEX game_events_sudoku_idx
  ON game_events (difficulty, hint_bucket, player_id, metric, occurred_at, id)
  WHERE game = 'sudoku' AND type = 'win';

-- These two indexes are phased out by the final query set: event identity uses
-- the primary key, requested-player totals share the grouped global scan, and
-- every category predicate is covered by one of the partial indexes above.
DROP INDEX game_events_game_type_idx;
DROP INDEX game_events_player_idx;
