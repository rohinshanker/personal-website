-- Additive: the previous Worker never reads this table, so rolling back to it
-- is safe without reverting the schema. Rows are permanent; the scheduled
-- expiry purge does not touch them. token_hash is the SHA-256 digest of the
-- registration token, never the token itself; ip_hash is a keyed hash, never a
-- raw address. Lookups are by profile_id, so the primary key is the only index.
CREATE TABLE social_profiles (
  profile_id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  player_icon TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  blocked_at TEXT
) STRICT;
