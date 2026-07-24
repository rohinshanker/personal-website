CREATE TABLE game_events (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL CHECK (game IN ('minesweeper', 'solitaire', 'snake', 'sudoku')),
  type TEXT NOT NULL CHECK (type IN ('win', 'gamePlayed')),
  difficulty TEXT,
  board_size TEXT,
  hint_bucket TEXT CHECK (hint_bucket IS NULL OR hint_bucket IN ('noHints', 'withHints')),
  metric INTEGER,
  metric_kind TEXT,
  player_id TEXT,
  player_name TEXT,
  player_icon TEXT,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  schema_version INTEGER NOT NULL DEFAULT 1
) STRICT;

CREATE INDEX game_events_game_type_idx ON game_events (game, type);
CREATE INDEX game_events_minesweeper_idx ON game_events (game, difficulty, metric, occurred_at);
CREATE INDEX game_events_solitaire_idx ON game_events (game, metric, occurred_at);
CREATE INDEX game_events_snake_idx ON game_events (game, board_size, metric, occurred_at);
CREATE INDEX game_events_sudoku_idx ON game_events (game, difficulty, hint_bucket);
CREATE INDEX game_events_player_idx ON game_events (player_id);
