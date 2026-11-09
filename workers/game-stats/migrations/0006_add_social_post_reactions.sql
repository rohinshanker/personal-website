-- Additive: the previous Worker never reads this table, so rolling back to it
-- is safe without reverting the schema. Rows are permanent; the scheduled
-- expiry purge does not touch them. ip_hash is a keyed hash, never a raw
-- address.
CREATE TABLE social_post_reactions (
  post_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_icon TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (post_id, profile_id)
) STRICT;

CREATE INDEX social_post_reactions_post_idx
  ON social_post_reactions (post_id, reaction, created_at);
