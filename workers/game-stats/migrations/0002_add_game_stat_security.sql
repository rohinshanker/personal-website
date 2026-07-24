CREATE TABLE game_stat_sessions (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL CHECK (game IN ('minesweeper', 'solitaire', 'snake', 'sudoku')),
  config_json TEXT NOT NULL,
  build_version TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
) STRICT;

CREATE INDEX game_stat_sessions_expiry_idx ON game_stat_sessions (expires_at);

CREATE TABLE game_stats_rate_limits (
  bucket TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL CHECK (request_count >= 0),
  window_started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
) STRICT;

CREATE INDEX game_stats_rate_limits_expiry_idx ON game_stats_rate_limits (expires_at);
