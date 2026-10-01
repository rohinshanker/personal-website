import {
  GAME_STATS_DIFFICULTIES,
  GAME_STATS_HINT_BUCKETS,
  GAME_STATS_SNAKE_BOARD_SIZES,
  GAME_STATS_SUDOKU_DIFFICULTIES,
  MAX_EVENT_AGE_MS,
  MAX_EVENT_FUTURE_MS,
  MAX_MINESWEEPER_SECONDS,
  MAX_SOLITAIRE_MOVES,
  MAX_SUDOKU_SECONDS,
  ROHIN_NEKO_AVATAR_ICON,
  getGameStatsDatabase,
} from "./constants.mjs";
import { HttpError } from "./http.mjs";

const COMMON_EVENT_KEYS = Object.freeze([
  "id",
  "game",
  "type",
  "occurredAt",
  "metric",
  "metricKind",
  "profile",
]);
const EVENT_KEYS = Object.freeze({
  minesweeper: Object.freeze([...COMMON_EVENT_KEYS, "difficulty"]),
  solitaire: COMMON_EVENT_KEYS,
  snake: Object.freeze([...COMMON_EVENT_KEYS, "boardSize"]),
  sudoku: Object.freeze([
    ...COMMON_EVENT_KEYS,
    "difficulty",
    "hintBucket",
    "puzzleId",
    "puzzle",
  ]),
});
const HISTORICAL_EVENT_KEYS = Object.freeze([
  ...COMMON_EVENT_KEYS,
  "difficulty",
  "boardSize",
  "hintBucket",
  "puzzleId",
  "puzzle",
]);
const SUDOKU_PUZZLE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{3,79}$/;
const SUDOKU_PUZZLE_PATTERN = /^[0-9]{81}$/;

export const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const assertAllowedKeys = (value, allowedKeys, label) => {
  if (!isPlainObject(value)) throw new HttpError(400, `${label} must be an object`);
  const unknownKey = Object.keys(value).find((key) => !allowedKeys.includes(key));
  if (unknownKey) throw new HttpError(400, `Unknown ${label} field: ${unknownKey}`);
};

const normalizeString = (value, label, { allowHistorical = false } = {}) => {
  if (!allowHistorical && typeof value !== "string") {
    throw new HttpError(400, `${label} must be a string`);
  }
  return String(value ?? "").trim();
};

const normalizeIsoDate = (value, { allowHistorical = false } = {}) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Invalid event date");
  const now = Date.now();
  if (
    (!allowHistorical && date.getTime() < now - MAX_EVENT_AGE_MS) ||
    date.getTime() > now + MAX_EVENT_FUTURE_MS
  ) {
    throw new HttpError(400, "Event date is outside the accepted window");
  }
  return date.toISOString();
};

const normalizeMetric = (value, label, { minValue = 0, maxValue = Number.MAX_SAFE_INTEGER } = {}) => {
  if (!Number.isSafeInteger(value) || value < minValue) {
    throw new HttpError(400, `Invalid ${label}`);
  }
  if (value > maxValue) throw new HttpError(400, `${label} is out of range`);
  return value;
};

const isAllowedProfileIcon = (icon) =>
  /^assets\/app-icons\/ico\/[^/]+\.ico$/.test(icon) || icon === ROHIN_NEKO_AVATAR_ICON;

const normalizeProfile = (profile, { allowHistorical = false } = {}) => {
  if (profile === null || profile === undefined) return null;
  try {
    assertAllowedKeys(profile, ["id", "name", "icon"], "profile");
  } catch (error) {
    if (allowHistorical && error instanceof HttpError) return null;
    throw error;
  }
  const nonStringField = ["id", "name", "icon"].find(
    (field) => typeof profile[field] !== "string"
  );
  if (nonStringField) {
    if (allowHistorical) return null;
    throw new HttpError(400, `Event profile ${nonStringField} must be a string`);
  }
  const id = profile.id.trim();
  const name = profile.name.trim().slice(0, 32);
  const icon = profile.icon.trim();
  if (!/^[a-z0-9-]{8,80}$/.test(id) || !name || !isAllowedProfileIcon(icon)) {
    if (allowHistorical) return null;
    throw new HttpError(400, "Invalid event profile");
  }
  return { id, name, icon };
};

const requireMetricKind = (rawEvent, expectedKind, options) => {
  if (rawEvent.metricKind === undefined) return expectedKind;
  const metricKind = normalizeString(rawEvent.metricKind, "Event metric kind", options);
  if (metricKind !== expectedKind) {
    throw new HttpError(400, `Invalid metric kind for ${rawEvent.game}`);
  }
  return metricKind;
};

const normalizeSudokuIdentity = (rawEvent, options) => {
  const hasPuzzleId = rawEvent.puzzleId !== undefined && rawEvent.puzzleId !== null;
  const hasPuzzle = rawEvent.puzzle !== undefined && rawEvent.puzzle !== null;
  if (!hasPuzzleId && !hasPuzzle) return {};
  const puzzleId = normalizeString(rawEvent.puzzleId, "Sudoku puzzle id", options);
  const puzzle = normalizeString(rawEvent.puzzle, "Sudoku puzzle", options);
  if (!SUDOKU_PUZZLE_ID_PATTERN.test(puzzleId) || !SUDOKU_PUZZLE_PATTERN.test(puzzle)) {
    if (options.allowHistorical) return {};
    throw new HttpError(400, "Invalid Sudoku puzzle identity");
  }
  return { puzzleId, puzzle };
};

const normalizeInternal = (rawEvent, { allowHistorical = false } = {}) => {
  if (!isPlainObject(rawEvent)) throw new HttpError(400, "event must be an object");
  const options = { allowHistorical };
  const game = normalizeString(rawEvent.game, "Event game", options);
  const allowedKeys = allowHistorical
    ? HISTORICAL_EVENT_KEYS
    : Object.hasOwn(EVENT_KEYS, game)
      ? EVENT_KEYS[game]
      : null;
  if (!allowedKeys) throw new HttpError(400, `Unsupported game: ${game}`);
  assertAllowedKeys(rawEvent, allowedKeys, "event");
  const id = normalizeString(rawEvent.id, "Event id", options);
  const type = normalizeString(rawEvent.type, "Event type", options);
  if (!allowHistorical && typeof rawEvent.occurredAt !== "string") {
    throw new HttpError(400, "Event date must be a string");
  }
  const occurredAt = normalizeIsoDate(rawEvent.occurredAt, options);
  const profile = normalizeProfile(rawEvent.profile, options);
  if (!/^[a-z0-9-]{8,80}$/.test(id)) throw new HttpError(400, "Invalid event id");

  if (game === "minesweeper") {
    const difficulty = normalizeString(rawEvent.difficulty, "Minesweeper difficulty", options);
    if (type !== "win" || !GAME_STATS_DIFFICULTIES.includes(difficulty)) {
      throw new HttpError(400, "Invalid Minesweeper event");
    }
    return {
      id,
      game,
      type,
      occurredAt,
      difficulty,
      metric: normalizeMetric(rawEvent.metric, "Minesweeper time", {
        minValue: 1,
        maxValue: MAX_MINESWEEPER_SECONDS,
      }),
      metricKind: requireMetricKind(rawEvent, "seconds", options),
      profile,
    };
  }
  if (game === "solitaire") {
    if (type !== "win") throw new HttpError(400, "Invalid Solitaire event");
    return {
      id,
      game,
      type,
      occurredAt,
      metric: normalizeMetric(rawEvent.metric, "Solitaire moves", {
        minValue: 1,
        maxValue: MAX_SOLITAIRE_MOVES,
      }),
      metricKind: requireMetricKind(rawEvent, "moves", options),
      profile,
    };
  }
  if (game === "snake") {
    const boardSize = normalizeString(rawEvent.boardSize, "Snake board size", options);
    if (type !== "gamePlayed" || !GAME_STATS_SNAKE_BOARD_SIZES.includes(boardSize)) {
      throw new HttpError(400, "Invalid Snake event");
    }
    return {
      id,
      game,
      type,
      occurredAt,
      boardSize,
      metric: normalizeMetric(rawEvent.metric, "Snake score", {
        maxValue: Number(boardSize) * Number(boardSize) - 3,
      }),
      metricKind: requireMetricKind(rawEvent, "score", options),
      profile,
    };
  }
  if (game === "sudoku") {
    const difficulty = normalizeString(rawEvent.difficulty, "Sudoku difficulty", options);
    const hintBucket = normalizeString(rawEvent.hintBucket, "Sudoku hint bucket", options);
    if (
      type !== "win" ||
      !GAME_STATS_SUDOKU_DIFFICULTIES.includes(difficulty) ||
      !GAME_STATS_HINT_BUCKETS.includes(hintBucket)
    ) {
      throw new HttpError(400, "Invalid Sudoku event");
    }
    const identity = normalizeSudokuIdentity(rawEvent, options);
    if (rawEvent.metric === undefined || rawEvent.metric === null || rawEvent.metric === "") {
      if (!allowHistorical) {
        throw new HttpError(400, "Sudoku result requires a completion time");
      }
      return { id, game, type, occurredAt, difficulty, hintBucket, ...identity, profile };
    }
    return {
      id,
      game,
      type,
      occurredAt,
      difficulty,
      hintBucket,
      ...identity,
      metric: normalizeMetric(rawEvent.metric, "Sudoku time", {
        minValue: 1,
        maxValue: MAX_SUDOKU_SECONDS,
      }),
      metricKind: requireMetricKind(rawEvent, "seconds", options),
      profile,
    };
  }
  throw new HttpError(400, `Unsupported game: ${game}`);
};

export const normalizeGameStatsEvent = (rawEvent) => normalizeInternal(rawEvent);

// Test-only parity code imports this historical normalizer directly. Production
// aggregation is SQL-only and does not retain the legacy in-memory algorithm.
export const normalizeHistoricalGameStatsEvent = (rawEvent) => {
  try {
    return normalizeInternal(rawEvent, { allowHistorical: true });
  } catch (error) {
    if (error instanceof HttpError) return null;
    throw error;
  }
};

const SELECT_EVENT_COLUMNS = `
  id, game, type, difficulty, board_size, hint_bucket, metric, metric_kind,
  player_id, player_name, player_icon, occurred_at, puzzle_key
`;
const SELECT_EVENT_SQL = `SELECT ${SELECT_EVENT_COLUMNS} FROM game_events WHERE id = ?`;
const SELECT_EVENT_BY_PUZZLE_SQL = `
  SELECT ${SELECT_EVENT_COLUMNS}
  FROM game_events
  WHERE player_id = ? AND puzzle_key = ?
  LIMIT 1
`;

export const INSERT_EVENT_FOR_SESSION_SQL = `
INSERT INTO game_events (
  id, game, type, difficulty, board_size, hint_bucket, metric, metric_kind,
  player_id, player_name, player_icon, occurred_at, puzzle_key, schema_version
) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
FROM game_stat_sessions
WHERE id = ? AND consumed_at IS NULL AND expires_at > ?
`;

export const puzzleKeyOf = (event) =>
  event.puzzleId && event.puzzle ? `${event.puzzleId}:${event.puzzle}` : null;

export const eventToResultParams = (event) => [
  event.id,
  event.game,
  event.type,
  event.difficulty || null,
  event.boardSize || null,
  event.hintBucket || null,
  Number.isFinite(event.metric) ? event.metric : null,
  event.metricKind || null,
  event.profile?.id || null,
  event.profile?.name || null,
  event.profile?.icon || null,
  event.occurredAt,
];

export const eventToInsertParams = (event) => [...eventToResultParams(event), puzzleKeyOf(event)];

const splitPuzzleKey = (value) => {
  const separator = String(value || "").lastIndexOf(":");
  return separator <= 0
    ? {}
    : { puzzleId: value.slice(0, separator), puzzle: value.slice(separator + 1) };
};

const rowToEvent = (row) => ({
  id: row.id,
  game: row.game,
  type: row.type,
  difficulty: row.difficulty || undefined,
  boardSize: row.board_size || undefined,
  hintBucket: row.hint_bucket || undefined,
  metric: row.metric === null || row.metric === undefined ? undefined : Number(row.metric),
  metricKind: row.metric_kind || undefined,
  occurredAt: row.occurred_at,
  ...splitPuzzleKey(row.puzzle_key),
  profile: row.player_id
    ? { id: row.player_id, name: row.player_name, icon: row.player_icon }
    : null,
});

export const storedEventMatches = (storedEvent, event) => {
  const storedKey = puzzleKeyOf(storedEvent);
  if (storedKey && storedKey !== puzzleKeyOf(event)) return false;
  return JSON.stringify(eventToResultParams(storedEvent)) === JSON.stringify(eventToResultParams(event));
};

export const assertStoredEventMatches = (storedEvent, event) => {
  if (!storedEventMatches(storedEvent, event)) {
    throw new HttpError(409, "Event id already exists with a different result");
  }
};

export const selectExistingEvent = async (env, id) => {
  const row = await getGameStatsDatabase(env).prepare(SELECT_EVENT_SQL).bind(id).first();
  return row ? rowToEvent(row) : null;
};

export const selectEventForPuzzle = async (env, event) => {
  const puzzleKey = puzzleKeyOf(event);
  const playerId = event.profile?.id;
  if (!puzzleKey || !playerId) return null;
  const row = await getGameStatsDatabase(env)
    .prepare(SELECT_EVENT_BY_PUZZLE_SQL)
    .bind(playerId, puzzleKey)
    .first();
  return row ? rowToEvent(row) : null;
};
