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
  CHECK (timing_revision BETWEEN 0 AND 900);
ALTER TABLE game_stat_sessions
  ADD COLUMN timing_phase TEXT NOT NULL DEFAULT 'legacy'
  CHECK (timing_phase IN ('legacy', 'ready', 'running', 'paused', 'finishing', 'finished'));
ALTER TABLE game_stat_sessions
  ADD COLUMN timing_elapsed_ms INTEGER NOT NULL DEFAULT 0
  CHECK (timing_elapsed_ms >= 0);
ALTER TABLE game_stat_sessions
  ADD COLUMN timing_countdown_ms INTEGER NOT NULL DEFAULT 0
  CHECK (timing_countdown_ms >= 0);
ALTER TABLE game_stat_sessions
  ADD COLUMN timing_resume_count INTEGER NOT NULL DEFAULT 0
  CHECK (timing_resume_count BETWEEN 0 AND 900);
ALTER TABLE game_stat_sessions ADD COLUMN timing_updated_at TEXT;
ALTER TABLE game_stat_sessions
  ADD COLUMN timing_input_count INTEGER NOT NULL DEFAULT 0
  CHECK (timing_input_count >= 0);
ALTER TABLE game_stat_sessions ADD COLUMN timing_input_hash TEXT;
ALTER TABLE game_stat_sessions ADD COLUMN timing_request_digest TEXT;
ALTER TABLE game_stat_sessions ADD COLUMN completion_id TEXT;
ALTER TABLE game_stat_sessions ADD COLUMN finish_job_id TEXT;

CREATE UNIQUE INDEX game_stat_sessions_completion_idx
  ON game_stat_sessions (completion_id)
  WHERE completion_id IS NOT NULL;

CREATE TABLE verified_timing_transitions (
  session_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 900),
  operation TEXT NOT NULL CHECK (operation IN ('pause', 'resume')),
  request_digest TEXT NOT NULL,
  input_count INTEGER NOT NULL CHECK (input_count >= 0),
  input_hash TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('running', 'paused')),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  countdown_ms INTEGER NOT NULL CHECK (countdown_ms >= 0),
  resume_count INTEGER NOT NULL CHECK (resume_count BETWEEN 0 AND 900),
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
  timing_revision INTEGER NOT NULL CHECK (timing_revision BETWEEN 0 AND 900),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  finished_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  published_event_id TEXT UNIQUE,
  publication_digest TEXT
) STRICT;

CREATE TABLE verified_completion_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL,
  transcript_digest TEXT NOT NULL,
  transcript_json TEXT NOT NULL,
  rules_version INTEGER NOT NULL,
  replay_version INTEGER NOT NULL,
  timing_revision INTEGER NOT NULL CHECK (timing_revision BETWEEN 0 AND 900),
  timing_verified_revision INTEGER NOT NULL DEFAULT 0
    CHECK (timing_verified_revision >= 0),
  terminal_tick INTEGER,
  input_count INTEGER NOT NULL CHECK (input_count >= 0),
  input_cursor INTEGER NOT NULL DEFAULT 0
    CHECK (input_cursor >= 0 AND input_cursor <= input_count),
  tick_cursor INTEGER NOT NULL DEFAULT 0 CHECK (tick_cursor >= 0),
  state_json TEXT,
  work_used INTEGER NOT NULL DEFAULT 0 CHECK (work_used >= 0),
  progress_revision INTEGER NOT NULL DEFAULT 0 CHECK (progress_revision >= 0),
  progress_token TEXT NOT NULL,
  checkpoint_digest TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  continuation_limit INTEGER NOT NULL
    CHECK (continuation_limit BETWEEN 1 AND 8192),
  resume_count INTEGER NOT NULL CHECK (resume_count > 0),
  countdown_ms INTEGER NOT NULL CHECK (countdown_ms >= 0),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
  finished_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'replay'
    CHECK (stage IN ('replay', 'finalize', 'completed', 'failed')),
  failure_code TEXT CHECK (failure_code IS NULL OR failure_code = 'replay-limit'),
  failure_message TEXT,
  failed_at TEXT,
  completion_id TEXT UNIQUE,
  updated_at TEXT NOT NULL,
  CHECK (json_valid(transcript_json)),
  CHECK (json_type(transcript_json, '$.inputs') = 'array'),
  CHECK (json_array_length(transcript_json, '$.inputs') = input_count),
  CHECK (timing_verified_revision <= timing_revision),
  CHECK (
    (stage = 'failed' AND failure_code IS NOT NULL AND
      failure_message IS NOT NULL AND failed_at IS NOT NULL)
    OR
    (stage <> 'failed' AND failure_code IS NULL AND
      failure_message IS NULL AND failed_at IS NULL)
  )
) STRICT;

CREATE TABLE verified_completion_progress (
  job_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  token TEXT NOT NULL UNIQUE,
  input_cursor INTEGER NOT NULL CHECK (input_cursor >= 0),
  tick_cursor INTEGER NOT NULL CHECK (tick_cursor >= 0),
  checkpoint_digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, revision)
) STRICT;

CREATE TABLE verified_completion_replay_chunks (
  job_id TEXT NOT NULL,
  start_cursor INTEGER NOT NULL CHECK (start_cursor >= 0),
  end_cursor INTEGER NOT NULL CHECK (end_cursor > start_cursor),
  canonical_inputs TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, start_cursor),
  UNIQUE (job_id, end_cursor)
) STRICT;

CREATE TRIGGER verified_replay_chunk_contiguity_guard
BEFORE INSERT ON verified_completion_replay_chunks
WHEN NEW.start_cursor <> COALESCE((
  SELECT MAX(end_cursor)
  FROM verified_completion_replay_chunks
  WHERE job_id = NEW.job_id
), 0)
BEGIN
  SELECT RAISE(ABORT, 'verified replay chunks must be contiguous');
END;

CREATE INDEX verified_completion_jobs_expiry_idx
  ON verified_completion_jobs (expires_at);

CREATE INDEX verified_game_completions_finished_idx
  ON verified_game_completions (finished_at);

CREATE TRIGGER verified_completion_event_identity_guard
BEFORE INSERT ON verified_game_completions
WHEN EXISTS (SELECT 1 FROM game_events WHERE id = NEW.event_id)
  OR EXISTS (
    SELECT 1 FROM verified_completion_jobs
    WHERE event_id = NEW.event_id AND session_id <> NEW.session_id
  )
BEGIN
  SELECT RAISE(ABORT, 'verified completion event id already exists');
END;

CREATE TRIGGER verified_job_event_identity_guard
BEFORE INSERT ON verified_completion_jobs
WHEN EXISTS (SELECT 1 FROM game_events WHERE id = NEW.event_id)
  OR EXISTS (SELECT 1 FROM verified_game_completions WHERE event_id = NEW.event_id)
BEGIN
  SELECT RAISE(ABORT, 'verified job event id already exists');
END;

CREATE TRIGGER game_event_verified_identity_guard
BEFORE INSERT ON game_events
WHEN EXISTS (
  SELECT 1
  FROM verified_game_completions
  WHERE event_id = NEW.id
    AND (NEW.completion_id IS NULL OR id <> NEW.completion_id)
)
OR EXISTS (
  SELECT 1
  FROM verified_completion_jobs
  WHERE event_id = NEW.id
    AND completion_id IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'game event id is reserved by a verified completion');
END;
