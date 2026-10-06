-- Historical events and sessions predate replay verification. Their default
-- provenance is deliberately legacy; no migration relabels an old row.
ALTER TABLE game_events
  ADD COLUMN provenance TEXT NOT NULL DEFAULT 'legacy'
  CHECK (provenance IN ('legacy', 'verified'));
ALTER TABLE game_events ADD COLUMN completion_id TEXT;

CREATE UNIQUE INDEX game_events_completion_idx
  ON game_events (completion_id)
  WHERE completion_id IS NOT NULL;

ALTER TABLE game_stat_sessions
  ADD COLUMN result_protocol INTEGER NOT NULL DEFAULT 1
  CHECK (result_protocol IN (1, 2));
ALTER TABLE game_stat_sessions ADD COLUMN rules_version INTEGER;
ALTER TABLE game_stat_sessions ADD COLUMN replay_version INTEGER;
ALTER TABLE game_stat_sessions ADD COLUMN generator_version INTEGER;
ALTER TABLE game_stat_sessions ADD COLUMN initial_json TEXT;
ALTER TABLE game_stat_sessions ADD COLUMN initial_commitment TEXT;
ALTER TABLE game_stat_sessions ADD COLUMN scope_digest TEXT;
ALTER TABLE game_stat_sessions
  ADD COLUMN timing_revision INTEGER NOT NULL DEFAULT 0
  CHECK (timing_revision >= 0);
ALTER TABLE game_stat_sessions
  ADD COLUMN timing_phase TEXT NOT NULL DEFAULT 'legacy'
  CHECK (timing_phase IN ('legacy', 'ready', 'running', 'paused', 'finished'));
ALTER TABLE game_stat_sessions
  ADD COLUMN timing_elapsed_ms INTEGER NOT NULL DEFAULT 0
  CHECK (timing_elapsed_ms >= 0);
ALTER TABLE game_stat_sessions ADD COLUMN timing_updated_at TEXT;
ALTER TABLE game_stat_sessions
  ADD COLUMN timing_input_count INTEGER NOT NULL DEFAULT 0
  CHECK (timing_input_count >= 0);
ALTER TABLE game_stat_sessions ADD COLUMN timing_input_hash TEXT;
ALTER TABLE game_stat_sessions ADD COLUMN timing_request_digest TEXT;
ALTER TABLE game_stat_sessions ADD COLUMN completion_id TEXT;

CREATE UNIQUE INDEX game_stat_sessions_completion_idx
  ON game_stat_sessions (completion_id)
  WHERE completion_id IS NOT NULL;

CREATE TABLE verified_timing_transitions (
  session_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  operation TEXT NOT NULL CHECK (operation IN ('pause', 'resume')),
  request_digest TEXT NOT NULL,
  input_count INTEGER NOT NULL CHECK (input_count >= 0),
  input_hash TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('running', 'paused')),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  observed_at TEXT NOT NULL,
  PRIMARY KEY (session_id, revision)
) STRICT;

CREATE TABLE verified_game_completions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL,
  receipt_token TEXT NOT NULL,
  game TEXT NOT NULL CHECK (game IN ('minesweeper', 'solitaire', 'snake', 'sudoku')),
  type TEXT NOT NULL CHECK (type IN ('win', 'gamePlayed')),
  difficulty TEXT,
  board_size TEXT,
  hint_bucket TEXT CHECK (hint_bucket IS NULL OR hint_bucket IN ('noHints', 'withHints')),
  metric INTEGER NOT NULL CHECK (metric >= 0),
  metric_kind TEXT NOT NULL,
  puzzle_key TEXT,
  initial_commitment TEXT NOT NULL,
  replay_digest TEXT NOT NULL,
  timing_revision INTEGER NOT NULL CHECK (timing_revision >= 0),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  finished_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  published_event_id TEXT UNIQUE,
  publication_digest TEXT
) STRICT;

CREATE INDEX verified_game_completions_finished_idx
  ON verified_game_completions (finished_at);

CREATE TRIGGER verified_completion_event_identity_guard
BEFORE INSERT ON verified_game_completions
WHEN EXISTS (SELECT 1 FROM game_events WHERE id = NEW.event_id)
BEGIN
  SELECT RAISE(ABORT, 'verified completion event id already exists');
END;

CREATE TRIGGER game_event_verified_identity_guard
BEFORE INSERT ON game_events
WHEN EXISTS (
  SELECT 1
  FROM verified_game_completions
  WHERE event_id = NEW.id
    AND (NEW.completion_id IS NULL OR id <> NEW.completion_id)
)
BEGIN
  SELECT RAISE(ABORT, 'game event id is reserved by a verified completion');
END;
