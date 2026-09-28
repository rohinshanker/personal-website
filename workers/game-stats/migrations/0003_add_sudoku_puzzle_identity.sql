-- Additive: existing rows keep a NULL puzzle_key, and a Worker rolled out
-- before the browser that sends puzzle identity still writes NULL there.
ALTER TABLE game_events ADD COLUMN puzzle_key TEXT;

-- One win per player per puzzle. The index is partial so it constrains only
-- the identified Sudoku wins: rows without an identity, including every row
-- written before this migration, stay outside it.
CREATE UNIQUE INDEX game_events_puzzle_identity_idx
  ON game_events (player_id, puzzle_key)
  WHERE puzzle_key IS NOT NULL AND player_id IS NOT NULL;
