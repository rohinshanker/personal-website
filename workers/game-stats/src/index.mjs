const GAME_STATS_DIFFICULTIES = Object.freeze(["beginner", "intermediate", "expert"]);
const GAME_STATS_SUDOKU_DIFFICULTIES = Object.freeze([
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
  "extreme",
]);
const GAME_STATS_SNAKE_BOARD_SIZES = Object.freeze(["10", "16", "20", "24"]);
const GAME_STATS_HINT_BUCKETS = Object.freeze(["noHints", "withHints"]);
const GAME_BUILD_VERSION_PATTERN = /^sha256-[a-f0-9]{64}$/;
const MAX_GAME_BUILD_COMPATIBILITY_VERSIONS = 32;
const GAME_STATS_COMMON_EVENT_KEYS = Object.freeze([
  "id",
  "game",
  "type",
  "occurredAt",
  "metric",
  "metricKind",
  "profile",
]);
const GAME_STATS_EVENT_KEYS = Object.freeze({
  minesweeper: Object.freeze([...GAME_STATS_COMMON_EVENT_KEYS, "difficulty"]),
  solitaire: GAME_STATS_COMMON_EVENT_KEYS,
  snake: Object.freeze([...GAME_STATS_COMMON_EVENT_KEYS, "boardSize"]),
  sudoku: Object.freeze([
    ...GAME_STATS_COMMON_EVENT_KEYS,
    "difficulty",
    "hintBucket",
  ]),
});
const GAME_STATS_HISTORICAL_EVENT_KEYS = Object.freeze([
  ...GAME_STATS_COMMON_EVENT_KEYS,
  "difficulty",
  "boardSize",
  "hintBucket",
]);
const MAX_EVENT_BODY_BYTES = 4096;
const MAX_SOLITAIRE_MOVES = 99999;
const MAX_MINESWEEPER_SECONDS = 999;
const MAX_SUDOKU_SECONDS = 6 * 60 * 60;
const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_EVENT_FUTURE_MS = 60 * 1000;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const SESSION_EVENT_START_GRACE_MS = 2 * 60 * 1000;
const MIN_SNAKE_SESSION_DURATION_MS = 5 * 1000;
// The browser aborts after eight seconds, leaving a nominal three-second transport/D1 budget.
const MAX_INLINE_SNAKE_ELIGIBILITY_WAIT_MS = 5 * 1000;
const MAX_RETRY_AFTER_MS = 60 * 1000;
const SNAKE_RESUME_COUNTDOWN_MS = 900;
const SNAKE_TICK_MS = 118;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_SESSIONS_PER_WINDOW = 24;
const MAX_EVENTS_PER_WINDOW = 24;
const ADMINISTRATOR_SESSION_TTL_MS = 60 * 60 * 1000;
const ADMINISTRATOR_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ADMINISTRATOR_SIGN_INS_PER_WINDOW = 5;
const ADMINISTRATOR_PROFILE_ID = "player-rohin-neko";
const ADMINISTRATOR_PROFILE_NAME = "rohin ^.^";
const INSERT_EVENT_FOR_SESSION_SQL = `
INSERT INTO game_events (
  id,
  game,
  type,
  difficulty,
  board_size,
  hint_bucket,
  metric,
  metric_kind,
  player_id,
  player_name,
  player_icon,
  occurred_at,
  schema_version
) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
FROM game_stat_sessions
WHERE id = ? AND consumed_at IS NULL AND expires_at > ?
`;
const SELECT_EVENTS_SQL = `
SELECT
  id,
  game,
  type,
  difficulty,
  board_size,
  hint_bucket,
  metric,
  metric_kind,
  player_id,
  player_name,
  player_icon,
  occurred_at
FROM game_events
`;
const SELECT_EVENT_SQL = `${SELECT_EVENTS_SQL.trim()}
WHERE id = ?`;
const INSERT_SESSION_SQL = `
INSERT INTO game_stat_sessions (
  id, game, config_json, build_version, ip_hash, issued_at, expires_at
) VALUES (?, ?, ?, ?, ?, ?, ?)
`;
const SELECT_SESSION_SQL = `
SELECT id, game, config_json, build_version, ip_hash, issued_at, expires_at, consumed_at
FROM game_stat_sessions
WHERE id = ?
`;
const CONSUME_SESSION_SQL = `
UPDATE game_stat_sessions
SET consumed_at = ?
WHERE id = ? AND consumed_at IS NULL AND expires_at > ?
`;
const UPSERT_RATE_LIMIT_SQL = `
INSERT INTO game_stats_rate_limits (
  bucket, request_count, window_started_at, expires_at
) VALUES (?, 1, ?, ?)
ON CONFLICT(bucket) DO UPDATE SET
  request_count = CASE
    WHEN game_stats_rate_limits.window_started_at <= ? THEN 1
    ELSE game_stats_rate_limits.request_count + 1
  END,
  window_started_at = CASE
    WHEN game_stats_rate_limits.window_started_at <= ? THEN excluded.window_started_at
    ELSE game_stats_rate_limits.window_started_at
  END,
  expires_at = excluded.expires_at
`;
const SELECT_RATE_LIMIT_SQL = `
SELECT request_count
FROM game_stats_rate_limits
WHERE bucket = ?
`;
const HEALTH_CHECK_SQL = `
SELECT COUNT(*) AS table_count
FROM sqlite_master
WHERE type = 'table'
  AND name IN ('game_events', 'game_stat_sessions', 'game_stats_rate_limits')
`;

class HttpError extends Error {
  constructor(status, message, { retryAfterMs = 0 } = {}) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertAllowedKeys = (value, allowedKeys, label) => {
  if (!isPlainObject(value)) throw new HttpError(400, `${label} must be an object`);
  const unknownKey = Object.keys(value).find((key) => !allowedKeys.includes(key));
  if (unknownKey) throw new HttpError(400, `Unknown ${label} field: ${unknownKey}`);
};

const normalizeEventString = (value, label, { allowHistorical = false } = {}) => {
  if (!allowHistorical && typeof value !== "string") {
    throw new HttpError(400, `${label} must be a string`);
  }
  return String(value ?? "").trim();
};

const createEmptyMinesweeperWins = () =>
  Object.fromEntries(GAME_STATS_DIFFICULTIES.map((difficulty) => [difficulty, 0]));

const createEmptyMinesweeperLeaderboards = () =>
  Object.fromEntries(GAME_STATS_DIFFICULTIES.map((difficulty) => [difficulty, []]));

const createEmptyMinesweeperPlayerRanks = () =>
  Object.fromEntries(
    GAME_STATS_DIFFICULTIES.map((difficulty) => [difficulty, { rank: null, totalPlayers: 0 }])
  );

const createEmptySnakePlayerRanks = () =>
  Object.fromEntries(
    GAME_STATS_SNAKE_BOARD_SIZES.map((size) => [size, { rank: null, totalPlayers: 0 }])
  );

const createEmptySudokuPlayerRanks = () =>
  Object.fromEntries(
    GAME_STATS_SUDOKU_DIFFICULTIES.map((difficulty) => [
      difficulty,
      { rank: null, totalPlayers: 0 },
    ])
  );

const createEmptyMinesweeperPlayerRecords = () =>
  Object.fromEntries(GAME_STATS_DIFFICULTIES.map((difficulty) => [difficulty, null]));

const createEmptySnakePlayerRecords = () =>
  Object.fromEntries(GAME_STATS_SNAKE_BOARD_SIZES.map((size) => [size, null]));

const createEmptySudokuPlayerRecords = () =>
  Object.fromEntries(GAME_STATS_SUDOKU_DIFFICULTIES.map((difficulty) => [difficulty, null]));

const createEmptySnakeGames = () =>
  Object.fromEntries(GAME_STATS_SNAKE_BOARD_SIZES.map((size) => [size, 0]));

const createEmptySnakeLeaderboards = () =>
  Object.fromEntries(GAME_STATS_SNAKE_BOARD_SIZES.map((size) => [size, []]));

const createEmptySudokuLeaderboards = () =>
  Object.fromEntries(GAME_STATS_SUDOKU_DIFFICULTIES.map((difficulty) => [difficulty, []]));

const createEmptySudokuWins = () =>
  Object.fromEntries(
    GAME_STATS_SUDOKU_DIFFICULTIES.map((difficulty) => [
      difficulty,
      { noHints: 0, withHints: 0 },
    ])
  );

export const createEmptyGameStatsData = () => ({
  version: 1,
  generatedAt: new Date(0).toISOString(),
  eventIds: [],
  totals: {
    minesweeper: { wins: createEmptyMinesweeperWins() },
    solitaire: { wins: 0 },
    snake: {
      totalGamesPlayed: 0,
      gamesPlayed: createEmptySnakeGames(),
    },
    sudoku: { wins: createEmptySudokuWins() },
  },
  leaderboards: {
    minesweeper: createEmptyMinesweeperLeaderboards(),
    solitaire: [],
    snake: createEmptySnakeLeaderboards(),
    sudoku: createEmptySudokuLeaderboards(),
  },
  playerRanks: {
    minesweeper: createEmptyMinesweeperPlayerRanks(),
    solitaire: { rank: null, totalPlayers: 0 },
    snake: createEmptySnakePlayerRanks(),
    sudoku: createEmptySudokuPlayerRanks(),
  },
  playerRecords: {
    minesweeper: createEmptyMinesweeperPlayerRecords(),
    solitaire: null,
    snake: createEmptySnakePlayerRecords(),
    sudoku: createEmptySudokuPlayerRecords(),
  },
});

const normalizeIsoDate = (value, { allowHistorical = false } = {}) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "Invalid event date");
  }
  const now = Date.now();
  if (
    (!allowHistorical && date.getTime() < now - MAX_EVENT_AGE_MS) ||
    date.getTime() > now + MAX_EVENT_FUTURE_MS
  ) {
    throw new HttpError(400, "Event date is outside the accepted window");
  }
  return date.toISOString();
};

const normalizeMetric = (
  value,
  label,
  { minValue = 0, maxValue = Number.MAX_SAFE_INTEGER } = {}
) => {
  if (!Number.isSafeInteger(value) || value < minValue) {
    throw new HttpError(400, `Invalid ${label}`);
  }
  if (value > maxValue) {
    throw new HttpError(400, `${label} is out of range`);
  }
  return value;
};

const ROHIN_NEKO_AVATAR_ICON = "assets/neko-assets/sprites/yawn1.png";
const ADMINISTRATOR_PROFILE = Object.freeze({
  id: ADMINISTRATOR_PROFILE_ID,
  name: ADMINISTRATOR_PROFILE_NAME,
  icon: ROHIN_NEKO_AVATAR_ICON,
});

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

const requireMetricKind = (rawEvent, expectedKind, { allowHistorical = false } = {}) => {
  if (rawEvent.metricKind === undefined) return expectedKind;
  const metricKind = normalizeEventString(rawEvent.metricKind, "Event metric kind", {
    allowHistorical,
  });
  if (metricKind !== expectedKind) {
    throw new HttpError(400, `Invalid metric kind for ${rawEvent.game}`);
  }
  return metricKind;
};

const normalizeGameStatsEventInternal = (rawEvent, { allowHistorical = false } = {}) => {
  if (!isPlainObject(rawEvent)) throw new HttpError(400, "event must be an object");
  const game = normalizeEventString(rawEvent.game, "Event game", { allowHistorical });
  const allowedKeys = allowHistorical
    ? GAME_STATS_HISTORICAL_EVENT_KEYS
    : Object.hasOwn(GAME_STATS_EVENT_KEYS, game)
      ? GAME_STATS_EVENT_KEYS[game]
      : null;
  if (!allowedKeys) throw new HttpError(400, `Unsupported game: ${game}`);
  assertAllowedKeys(rawEvent, allowedKeys, "event");

  const id = normalizeEventString(rawEvent.id, "Event id", { allowHistorical });
  const type = normalizeEventString(rawEvent.type, "Event type", { allowHistorical });
  if (!allowHistorical && typeof rawEvent.occurredAt !== "string") {
    throw new HttpError(400, "Event date must be a string");
  }
  const occurredAt = normalizeIsoDate(rawEvent.occurredAt, { allowHistorical });
  const profile = normalizeProfile(rawEvent.profile, { allowHistorical });

  if (!/^[a-z0-9-]{8,80}$/.test(id)) {
    throw new HttpError(400, "Invalid event id");
  }

  if (game === "minesweeper") {
    const difficulty = normalizeEventString(rawEvent.difficulty, "Minesweeper difficulty", {
      allowHistorical,
    });
    if (type !== "win" || !GAME_STATS_DIFFICULTIES.includes(difficulty)) {
      throw new HttpError(400, "Invalid Minesweeper event");
    }
    return {
      id,
      game,
      type,
      occurredAt,
      difficulty,
      metric: normalizeMetric(
        rawEvent.metric,
        "Minesweeper time",
        { minValue: 1, maxValue: MAX_MINESWEEPER_SECONDS }
      ),
      metricKind: requireMetricKind(rawEvent, "seconds", { allowHistorical }),
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
      metric: normalizeMetric(
        rawEvent.metric,
        "Solitaire moves",
        { minValue: 1, maxValue: MAX_SOLITAIRE_MOVES }
      ),
      metricKind: requireMetricKind(rawEvent, "moves", { allowHistorical }),
      profile,
    };
  }

  if (game === "snake") {
    const boardSize = normalizeEventString(rawEvent.boardSize, "Snake board size", {
      allowHistorical,
    });
    if (type !== "gamePlayed" || !GAME_STATS_SNAKE_BOARD_SIZES.includes(boardSize)) {
      throw new HttpError(400, "Invalid Snake event");
    }
    return {
      id,
      game,
      type,
      occurredAt,
      boardSize,
      metric: normalizeMetric(
        rawEvent.metric,
        "Snake score",
        { maxValue: Number(boardSize) * Number(boardSize) - 3 }
      ),
      metricKind: requireMetricKind(rawEvent, "score", { allowHistorical }),
      profile,
    };
  }

  if (game === "sudoku") {
    const difficulty = normalizeEventString(rawEvent.difficulty, "Sudoku difficulty", {
      allowHistorical,
    });
    const hintBucket = normalizeEventString(rawEvent.hintBucket, "Sudoku hint bucket", {
      allowHistorical,
    });
    if (
      type !== "win" ||
      !GAME_STATS_SUDOKU_DIFFICULTIES.includes(difficulty) ||
      !GAME_STATS_HINT_BUCKETS.includes(hintBucket)
    ) {
      throw new HttpError(400, "Invalid Sudoku event");
    }
    const metricSource = rawEvent.metric;
    if (metricSource === undefined || metricSource === null || metricSource === "") {
      if (!allowHistorical) {
        throw new HttpError(400, "Sudoku result requires a completion time");
      }
      return { id, game, type, occurredAt, difficulty, hintBucket, profile };
    }
    return {
      id,
      game,
      type,
      occurredAt,
      difficulty,
      hintBucket,
      metric: normalizeMetric(metricSource, "Sudoku time", {
        minValue: 1,
        maxValue: MAX_SUDOKU_SECONDS,
      }),
      metricKind: requireMetricKind(rawEvent, "seconds", { allowHistorical }),
      profile,
    };
  }

  throw new HttpError(400, `Unsupported game: ${game}`);
};

export const normalizeGameStatsEvent = (rawEvent) => normalizeGameStatsEventInternal(rawEvent);

export const compareLeaderboardEntries = (direction, first, second) => {
  if (first.metric !== second.metric) {
    return direction === "desc"
      ? second.metric - first.metric
      : first.metric - second.metric;
  }
  const firstTime = new Date(first.occurredAt).getTime();
  const secondTime = new Date(second.occurredAt).getTime();
  if (firstTime !== secondTime) return firstTime - secondTime;
  return String(first.eventId).localeCompare(String(second.eventId));
};

const createLeaderboardEntry = (event) => ({
  eventId: event.id,
  playerId: event.profile.id,
  name: event.profile.name,
  icon: event.profile.icon,
  metric: event.metric,
  metricKind: event.metricKind,
  occurredAt: event.occurredAt,
});

const upsertLeaderboardEntry = (leaderboard, event, limit, direction) => {
  if (!event.profile || !Number.isFinite(event.metric)) return leaderboard;
  const nextEntry = createLeaderboardEntry(event);
  const entries = Array.isArray(leaderboard) ? [...leaderboard] : [];
  const existingIndex = entries.findIndex((entry) => entry.playerId === nextEntry.playerId);

  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    if (compareLeaderboardEntries(direction, nextEntry, existing) < 0) {
      entries[existingIndex] = nextEntry;
    }
  } else {
    entries.push(nextEntry);
  }

  return entries
    .sort((first, second) => compareLeaderboardEntries(direction, first, second))
    .slice(0, limit);
};

const addSolitaireWinToLeaderboard = (winsByPlayer, event) => {
  if (!event.profile) return;
  const previous = winsByPlayer.get(event.profile.id);
  const previousTime = new Date(previous?.occurredAt || 0).getTime();
  const eventTime = new Date(event.occurredAt).getTime();
  const usesLatestIdentity =
    !previous ||
    eventTime > previousTime ||
    (eventTime === previousTime && String(event.id).localeCompare(previous.eventId) > 0);
  winsByPlayer.set(event.profile.id, {
    eventId: usesLatestIdentity ? event.id : previous.eventId,
    playerId: event.profile.id,
    name: usesLatestIdentity ? event.profile.name : previous.name,
    icon: usesLatestIdentity ? event.profile.icon : previous.icon,
    metric: (previous?.metric || 0) + 1,
    metricKind: "wins",
    occurredAt: usesLatestIdentity ? event.occurredAt : previous.occurredAt,
  });
};

export const createGameStatsDataFromEvents = (rawEvents, requestedPlayerId = "") => {
  const stats = createEmptyGameStatsData();
  const requestedPlayer = String(requestedPlayerId || "").trim();
  const playerRankings = {
    minesweeper: createEmptyMinesweeperLeaderboards(),
    solitaire: [],
    snake: createEmptySnakeLeaderboards(),
    sudoku: createEmptySudokuLeaderboards(),
  };
  const solitaireWinsByPlayer = new Map();
  stats.generatedAt = new Date().toISOString();

  for (const rawEvent of rawEvents) {
    let event;
    try {
      event = normalizeGameStatsEventInternal(rawEvent, { allowHistorical: true });
    } catch (error) {
      // A malformed legacy row must not take every public counter and
      // leaderboard offline. New writes still pass strict ingress validation.
      if (error instanceof HttpError) continue;
      throw error;
    }
    if (stats.eventIds.includes(event.id)) continue;
    stats.eventIds.push(event.id);

    if (event.game === "minesweeper") {
      stats.totals.minesweeper.wins[event.difficulty] += 1;
      playerRankings.minesweeper[event.difficulty] = upsertLeaderboardEntry(
        playerRankings.minesweeper[event.difficulty],
        event,
        Number.MAX_SAFE_INTEGER,
        "asc"
      );
    } else if (event.game === "solitaire") {
      stats.totals.solitaire.wins += 1;
      addSolitaireWinToLeaderboard(solitaireWinsByPlayer, event);
    } else if (event.game === "snake") {
      stats.totals.snake.totalGamesPlayed += 1;
      stats.totals.snake.gamesPlayed[event.boardSize] += 1;
      playerRankings.snake[event.boardSize] = upsertLeaderboardEntry(
        playerRankings.snake[event.boardSize],
        event,
        Number.MAX_SAFE_INTEGER,
        "desc"
      );
    } else if (event.game === "sudoku") {
      stats.totals.sudoku.wins[event.difficulty][event.hintBucket] += 1;
      if (event.hintBucket === "noHints" && Number.isFinite(event.metric)) {
        playerRankings.sudoku[event.difficulty] = upsertLeaderboardEntry(
          playerRankings.sudoku[event.difficulty],
          event,
          Number.MAX_SAFE_INTEGER,
          "asc"
        );
      }
    }
  }

  GAME_STATS_DIFFICULTIES.forEach((difficulty) => {
    const rankings = playerRankings.minesweeper[difficulty];
    const rankIndex = rankings.findIndex((entry) => entry.playerId === requestedPlayer);
    stats.leaderboards.minesweeper[difficulty] = rankings.slice(0, 3);
    stats.playerRanks.minesweeper[difficulty] = {
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      totalPlayers: rankings.length,
    };
    stats.playerRecords.minesweeper[difficulty] = rankIndex >= 0 ? rankings[rankIndex] : null;
  });

  playerRankings.solitaire = Array.from(solitaireWinsByPlayer.values()).sort((first, second) =>
    compareLeaderboardEntries("desc", first, second)
  );
  const solitaireRankIndex = playerRankings.solitaire.findIndex(
    (entry) => entry.playerId === requestedPlayer
  );
  stats.leaderboards.solitaire = playerRankings.solitaire.slice(0, 3);
  stats.playerRanks.solitaire = {
    rank: solitaireRankIndex >= 0 ? solitaireRankIndex + 1 : null,
    totalPlayers: playerRankings.solitaire.length,
  };
  stats.playerRecords.solitaire =
    solitaireRankIndex >= 0 ? playerRankings.solitaire[solitaireRankIndex] : null;

  GAME_STATS_SNAKE_BOARD_SIZES.forEach((size) => {
    const rankings = playerRankings.snake[size];
    const rankIndex = rankings.findIndex((entry) => entry.playerId === requestedPlayer);
    stats.leaderboards.snake[size] = rankings.slice(0, 3);
    stats.playerRanks.snake[size] = {
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      totalPlayers: rankings.length,
    };
    stats.playerRecords.snake[size] = rankIndex >= 0 ? rankings[rankIndex] : null;
  });

  GAME_STATS_SUDOKU_DIFFICULTIES.forEach((difficulty) => {
    const rankings = playerRankings.sudoku[difficulty];
    const rankIndex = rankings.findIndex((entry) => entry.playerId === requestedPlayer);
    stats.leaderboards.sudoku[difficulty] = rankings.slice(0, 3);
    stats.playerRanks.sudoku[difficulty] = {
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      totalPlayers: rankings.length,
    };
    stats.playerRecords.sudoku[difficulty] = rankIndex >= 0 ? rankings[rankIndex] : null;
  });

  return stats;
};

const eventToInsertParams = (event) => [
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
  profile: row.player_id
    ? {
        id: row.player_id,
        name: row.player_name,
        icon: row.player_icon,
      }
    : null,
});

const storedEventMatches = (storedEvent, event) =>
  JSON.stringify(eventToInsertParams(storedEvent)) ===
  JSON.stringify(eventToInsertParams(event));

const assertStoredEventMatches = (storedEvent, event) => {
  if (!storedEventMatches(storedEvent, event)) {
    throw new HttpError(409, "Event id already exists with a different result");
  }
};

const getGameStatsDatabase = (env) => env.personal_site_game_stats || env.DB;

const selectStoredEvents = async (env) => {
  const database = getGameStatsDatabase(env);
  const result = await database.prepare(SELECT_EVENTS_SQL).all();
  return (result.results || []).map(rowToEvent);
};

const normalizeOrigin = (origin) => {
  if (!origin) return "";
  try {
    return new URL(origin).origin;
  } catch {
    return "";
  }
};

const splitOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean);

const allowedOrigins = (env) =>
  new Set([
    ...splitOrigins(env.ALLOWED_ORIGIN),
    ...splitOrigins(env.LOCAL_ALLOWED_ORIGIN),
    ...splitOrigins(env.EXTRA_ALLOWED_ORIGINS),
  ]);

const allowedCorsOrigin = (request, env) => {
  const requestOrigin = normalizeOrigin(request.headers.get("Origin"));
  return requestOrigin && allowedOrigins(env).has(requestOrigin) ? requestOrigin : "";
};

const corsHeaders = (request, env) => {
  const origin = allowedCorsOrigin(request, env);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

const assertOriginAllowed = (request, env) => {
  if (request.headers.get("Origin") && !allowedCorsOrigin(request, env)) {
    throw new HttpError(403, "Origin is not allowed");
  }
};

const assertBrowserOriginAllowed = (request, env) => {
  if (!allowedCorsOrigin(request, env)) {
    throw new HttpError(403, "Origin is not allowed");
  }
};

const jsonResponse = (request, env, body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
      ...extraHeaders,
    },
  });

const readJsonBody = async (request) => {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_EVENT_BODY_BYTES) throw new HttpError(413, "Request body is too large");
  const text = await request.text();
  if (text.length > MAX_EVENT_BODY_BYTES) throw new HttpError(413, "Request body is too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
};

const textEncoder = new TextEncoder();
const toBase64Url = (value) => {
  const bytes = value instanceof Uint8Array ? value : textEncoder.encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (value) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new HttpError(400, "Invalid session token");
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new HttpError(400, "Invalid session token");
  }
};

const importHmacKey = (secret) =>
  crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

const signHmac = async (secret, value) => {
  const key = await importHmacKey(secret);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)));
};

const hmacDigest = async (secret, value) => toBase64Url(await signHmac(secret, value));

const constantTimeSecretEquals = async (comparisonSecret, expected, provided) => {
  const [expectedDigest, providedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(expected)),
    crypto.subtle.digest("SHA-256", textEncoder.encode(provided)),
  ]);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(expectedDigest, providedDigest);
  }

  // Node's Web Crypto lacks Workers' timingSafeEqual. Verify an HMAC over the
  // fixed-length digests so local tests retain a cryptographic comparison path.
  const comparisonKey = await importHmacKey(comparisonSecret);
  const expectedSignature = await crypto.subtle.sign("HMAC", comparisonKey, expectedDigest);
  return crypto.subtle.verify("HMAC", comparisonKey, expectedSignature, providedDigest);
};

const requireSecurityConfig = (env) => {
  const signingSecret = String(env.EVENT_SIGNING_SECRET || "");
  const ipHashSecret = String(env.IP_HASH_SECRET || "");
  const buildVersion = String(env.GAME_BUILD_VERSION || "").trim();
  const compatibilityVersions = String(
    env.GAME_BUILD_COMPATIBILITY_VERSIONS || ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const acceptedBuildVersions = [
    ...new Set([buildVersion, ...compatibilityVersions]),
  ];
  if (
    !signingSecret ||
    !ipHashSecret ||
    !GAME_BUILD_VERSION_PATTERN.test(buildVersion) ||
    compatibilityVersions.length > MAX_GAME_BUILD_COMPATIBILITY_VERSIONS ||
    compatibilityVersions.some(
      (value) => !GAME_BUILD_VERSION_PATTERN.test(value) || value === buildVersion
    ) ||
    acceptedBuildVersions.length !== compatibilityVersions.length + 1
  ) {
    throw new HttpError(500, "Game stats security configuration is incomplete");
  }
  return {
    signingSecret,
    ipHashSecret,
    buildVersion,
    acceptedBuildVersions,
  };
};

const requireAdministratorSecurityConfig = (env) => {
  const username = String(env.ADMIN_USERNAME || "");
  const password = String(env.ADMIN_PASSWORD || "");
  const sessionSigningSecret = String(env.ADMIN_SESSION_SIGNING_SECRET || "");
  const ipHashSecret = String(env.IP_HASH_SECRET || "");
  if (!username || !password || !sessionSigningSecret || !ipHashSecret) {
    throw new HttpError(500, "Administrator sign-in is unavailable");
  }
  return { username, password, sessionSigningSecret, ipHashSecret };
};

const getClientIp = (request) => String(request.headers.get("CF-Connecting-IP") || "local").trim();

const normalizeSessionConfig = (game, rawConfig) => {
  if (game === "minesweeper") {
    assertAllowedKeys(rawConfig, ["difficulty"], "Minesweeper session config");
    if (typeof rawConfig.difficulty !== "string") {
      throw new HttpError(400, "Minesweeper difficulty must be a string");
    }
    const difficulty = rawConfig.difficulty.trim();
    if (!GAME_STATS_DIFFICULTIES.includes(difficulty)) {
      throw new HttpError(400, "Invalid Minesweeper session config");
    }
    return { difficulty };
  }
  if (game === "solitaire") {
    assertAllowedKeys(rawConfig, [], "Solitaire session config");
    return {};
  }
  if (game === "snake") {
    assertAllowedKeys(rawConfig, ["boardSize"], "Snake session config");
    if (typeof rawConfig.boardSize !== "string") {
      throw new HttpError(400, "Snake board size must be a string");
    }
    const boardSize = rawConfig.boardSize.trim();
    if (!GAME_STATS_SNAKE_BOARD_SIZES.includes(boardSize)) {
      throw new HttpError(400, "Invalid Snake session config");
    }
    return { boardSize };
  }
  if (game === "sudoku") {
    assertAllowedKeys(rawConfig, ["difficulty"], "Sudoku session config");
    if (typeof rawConfig.difficulty !== "string") {
      throw new HttpError(400, "Sudoku difficulty must be a string");
    }
    const difficulty = rawConfig.difficulty.trim();
    if (!GAME_STATS_SUDOKU_DIFFICULTIES.includes(difficulty)) {
      throw new HttpError(400, "Invalid Sudoku session config");
    }
    return { difficulty };
  }
  throw new HttpError(400, "Unsupported game");
};

const sessionConfigMatchesEvent = (config, event) => {
  if (event.game === "minesweeper" || event.game === "sudoku") {
    return config.difficulty === event.difficulty;
  }
  if (event.game === "snake") return config.boardSize === event.boardSize;
  return event.game === "solitaire";
};

const minimumSessionDurationMs = (event) => {
  if (event.game === "minesweeper") return 3 * 1000;
  if (event.game === "solitaire") return 8 * 1000;
  if (event.game === "snake") {
    return Math.max(
      MIN_SNAKE_SESSION_DURATION_MS,
      SNAKE_RESUME_COUNTDOWN_MS + event.metric * SNAKE_TICK_MS
    );
  }
  return 10 * 1000;
};

const waitForSnakeEligibility = async (delayMs) => {
  if (
    !Number.isSafeInteger(delayMs) ||
    delayMs < 1 ||
    delayMs > MAX_INLINE_SNAKE_ELIGIBILITY_WAIT_MS
  ) {
    throw new HttpError(500, "Invalid Snake eligibility delay");
  }
  const schedulerApi = globalThis.scheduler;
  if (typeof schedulerApi?.wait === "function") {
    await schedulerApi.wait(delayMs);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const requireSessionEligibility = async (event, sessionIssuedAt) => {
  const minimumDurationMs = minimumSessionDurationMs(event);
  const eligibleAt = sessionIssuedAt + minimumDurationMs;
  const elapsedMs = Date.now() - sessionIssuedAt;
  if (elapsedMs >= minimumDurationMs) return;

  if (event.game !== "snake") {
    throw new HttpError(400, "Game result was completed too quickly");
  }

  const remainingMs = Math.ceil(minimumDurationMs - elapsedMs);
  if (remainingMs <= MAX_INLINE_SNAKE_ELIGIBILITY_WAIT_MS) {
    await waitForSnakeEligibility(remainingMs);
    const remainingAfterWaitMs = Math.ceil(eligibleAt - Date.now());
    if (remainingAfterWaitMs <= 0) return;
    throw new HttpError(425, "Snake result is not eligible yet", {
      retryAfterMs: Math.min(remainingAfterWaitMs, MAX_RETRY_AFTER_MS),
    });
  }

  throw new HttpError(425, "Snake result is not eligible yet", {
    retryAfterMs: Math.min(remainingMs, MAX_RETRY_AFTER_MS),
  });
};

const verifyTurnstileIfRequired = async (request, env, payload) => {
  const requireTurnstile = Boolean(env.TURNSTILE_SECRET_KEY) || env.REQUIRE_TURNSTILE === "true";
  if (!requireTurnstile) return;
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new HttpError(500, "Turnstile is required but is not configured");
  }
  const token = String(payload.turnstileToken || "").trim();
  if (!token || token.length > 2048) throw new HttpError(400, "Missing Turnstile token");

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: getClientIp(request),
      idempotency_key: crypto.randomUUID(),
    }),
  });
  const result = await response.json();
  if (
    !response.ok ||
    !result?.success ||
    (env.TURNSTILE_EXPECTED_HOSTNAME && result.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME) ||
    (env.TURNSTILE_EXPECTED_ACTION && result.action !== env.TURNSTILE_EXPECTED_ACTION)
  ) {
    throw new HttpError(403, "Turnstile verification failed");
  }
};

const getChanges = (result) => Number(result?.meta?.changes ?? result?.changes ?? 0);

const enforceRateLimit = async (
  env,
  ipHash,
  operation,
  limit,
  windowMs = RATE_LIMIT_WINDOW_MS
) => {
  const database = getGameStatsDatabase(env);
  const now = new Date();
  const windowStartedAt = now.toISOString();
  const resetThreshold = new Date(now.getTime() - windowMs).toISOString();
  const expiresAt = new Date(now.getTime() + windowMs).toISOString();
  const bucket = `${operation}:${ipHash}`;
  await database
    .prepare(UPSERT_RATE_LIMIT_SQL)
    .bind(bucket, windowStartedAt, expiresAt, resetThreshold, resetThreshold)
    .run();
  const row = await database.prepare(SELECT_RATE_LIMIT_SQL).bind(bucket).first();
  if (!row || Number(row.request_count) > limit) {
    throw new HttpError(429, "Too many game stats requests");
  }
};

const encodeSessionPayload = (payload) => toBase64Url(JSON.stringify(payload));

const createSessionToken = async (signingSecret, payload) => {
  const encodedPayload = encodeSessionPayload(payload);
  return `${encodedPayload}.${await hmacDigest(signingSecret, encodedPayload)}`;
};

const verifySessionToken = async (signingSecret, token) => {
  const [encodedPayload, encodedSignature, ...rest] = String(token || "").split(".");
  if (!encodedPayload || !encodedSignature || rest.length) throw new HttpError(400, "Invalid session token");
  const key = await importHmacKey(signingSecret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(encodedSignature),
    textEncoder.encode(encodedPayload)
  );
  if (!valid) throw new HttpError(403, "Invalid session token");
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload)));
    if (!isPlainObject(payload)) throw new Error("Not an object");
    return payload;
  } catch {
    throw new HttpError(400, "Invalid session token");
  }
};

const readAdministratorCredentials = (payload) => {
  assertAllowedKeys(payload, ["username", "password"], "administrator sign-in request");
  if (typeof payload.username !== "string" || typeof payload.password !== "string") {
    throw new HttpError(400, "Administrator sign-in credentials must be text");
  }
  if (
    !payload.username ||
    !payload.password ||
    payload.username.length > 128 ||
    payload.password.length > 1024
  ) {
    throw new HttpError(401, "Invalid administrator credentials");
  }
  return { username: payload.username, password: payload.password };
};

const createAdministratorProof = async (security, ipHash) => {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ADMINISTRATOR_SESSION_TTL_MS);
  const proof = {
    version: 1,
    scope: "administrator",
    profileId: ADMINISTRATOR_PROFILE_ID,
    ipHash,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  return {
    proof: await createSessionToken(security.sessionSigningSecret, proof),
    expiresAt: proof.expiresAt,
  };
};

const createAdministratorSignIn = async (request, env, payload) => {
  const credentials = readAdministratorCredentials(payload);
  const security = requireAdministratorSecurityConfig(env);
  const ipHash = await hmacDigest(security.ipHashSecret, getClientIp(request));
  await enforceRateLimit(
    env,
    ipHash,
    "administrator-sign-in",
    MAX_ADMINISTRATOR_SIGN_INS_PER_WINDOW,
    ADMINISTRATOR_RATE_LIMIT_WINDOW_MS
  );
  const [usernameMatches, passwordMatches] = await Promise.all([
    constantTimeSecretEquals(
      security.sessionSigningSecret,
      security.username,
      credentials.username
    ),
    constantTimeSecretEquals(
      security.sessionSigningSecret,
      security.password,
      credentials.password
    ),
  ]);
  if (!usernameMatches || !passwordMatches) {
    throw new HttpError(401, "Invalid administrator credentials");
  }
  return {
    ok: true,
    profile: ADMINISTRATOR_PROFILE,
    ...(await createAdministratorProof(security, ipHash)),
  };
};

const readAdministratorProof = (request) => {
  const authorization = String(request.headers.get("Authorization") || "");
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorization);
  if (!match) throw new HttpError(403, "Administrator authorization is invalid");
  return match[1];
};

const validateAdministratorEventProof = async (request, env, event) => {
  if (event.profile?.id !== ADMINISTRATOR_PROFILE_ID) return;
  if (
    event.profile.name !== ADMINISTRATOR_PROFILE.name ||
    event.profile.icon !== ADMINISTRATOR_PROFILE.icon
  ) {
    throw new HttpError(403, "Administrator profile is invalid");
  }

  const security = requireAdministratorSecurityConfig(env);
  const ipHash = await hmacDigest(security.ipHashSecret, getClientIp(request));
  let proof;
  try {
    proof = await verifySessionToken(security.sessionSigningSecret, readAdministratorProof(request));
  } catch {
    throw new HttpError(403, "Administrator authorization is invalid");
  }
  const expiresAt = Date.parse(String(proof.expiresAt || ""));
  if (
    proof.version !== 1 ||
    proof.scope !== "administrator" ||
    proof.profileId !== ADMINISTRATOR_PROFILE_ID ||
    proof.ipHash !== ipHash ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    throw new HttpError(403, "Administrator authorization is invalid");
  }
};

const selectExistingEvent = async (env, id) => {
  const row = await getGameStatsDatabase(env).prepare(SELECT_EVENT_SQL).bind(id).first();
  return row ? rowToEvent(row) : null;
};

const createSession = async (request, env, rawPayload) => {
  assertAllowedKeys(rawPayload, ["game", "config", "buildVersion", "turnstileToken"], "session request");
  const security = requireSecurityConfig(env);
  if (typeof rawPayload.game !== "string") {
    throw new HttpError(400, "Session game must be a string");
  }
  if (typeof rawPayload.buildVersion !== "string") {
    throw new HttpError(400, "Game build version must be a string");
  }
  const game = rawPayload.game.trim();
  const buildVersion = rawPayload.buildVersion.trim();
  if (!security.acceptedBuildVersions.includes(buildVersion)) {
    throw new HttpError(409, "Game build version is not compatible");
  }
  const config = normalizeSessionConfig(game, rawPayload.config);
  await verifyTurnstileIfRequired(request, env, rawPayload);
  const ipHash = await hmacDigest(security.ipHashSecret, getClientIp(request));
  await enforceRateLimit(env, ipHash, "sessions", MAX_SESSIONS_PER_WINDOW);

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_MS);
  const session = {
    id: crypto.randomUUID(),
    game,
    config,
    buildVersion,
    ipHash,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  await getGameStatsDatabase(env)
    .prepare(INSERT_SESSION_SQL)
    .bind(
      session.id,
      session.game,
      JSON.stringify(session.config),
      session.buildVersion,
      session.ipHash,
      session.issuedAt,
      session.expiresAt
    )
    .run();
  return {
    id: session.id,
    token: await createSessionToken(security.signingSecret, session),
    expiresAt: session.expiresAt,
  };
};

const validateSession = async (request, env, event, rawSession) => {
  assertAllowedKeys(rawSession, ["id", "token"], "session proof");
  const security = requireSecurityConfig(env);
  const sessionId = String(rawSession.id || "").trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(sessionId)) throw new HttpError(400, "Invalid session id");
  const tokenPayload = await verifySessionToken(security.signingSecret, rawSession.token);
  const ipHash = await hmacDigest(security.ipHashSecret, getClientIp(request));
  if (
    tokenPayload.id !== sessionId ||
    tokenPayload.game !== event.game ||
    tokenPayload.ipHash !== ipHash ||
    !isPlainObject(tokenPayload.config)
  ) {
    throw new HttpError(403, "Session proof does not match this result");
  }

  const session = await getGameStatsDatabase(env).prepare(SELECT_SESSION_SQL).bind(sessionId).first();
  if (!session) throw new HttpError(409, "Game session was already used");
  if (session.consumed_at) {
    const existing = await selectExistingEvent(env, event.id);
    if (existing) {
      assertStoredEventMatches(existing, event);
      return null;
    }
    throw new HttpError(409, "Game session was already used");
  }
  if (
    session.game !== event.game ||
    session.build_version !== tokenPayload.buildVersion ||
    session.ip_hash !== ipHash ||
    session.config_json !== JSON.stringify(tokenPayload.config) ||
    session.issued_at !== tokenPayload.issuedAt ||
    session.expires_at !== tokenPayload.expiresAt ||
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    throw new HttpError(403, "Stored game session does not match this result");
  }
  if (!sessionConfigMatchesEvent(tokenPayload.config, event)) {
    throw new HttpError(400, "Game result does not match the started game");
  }
  const eventTime = new Date(event.occurredAt).getTime();
  const sessionIssuedAt = new Date(session.issued_at).getTime();
  if (
    eventTime < sessionIssuedAt - SESSION_EVENT_START_GRACE_MS ||
    eventTime > Date.now() + MAX_EVENT_FUTURE_MS
  ) {
    throw new HttpError(400, "Game result is outside its session window");
  }
  await requireSessionEligibility(event, sessionIssuedAt);
  await enforceRateLimit(env, ipHash, "events", MAX_EVENTS_PER_WINDOW);
  return sessionId;
};

const consumeSessionAndStoreEvent = async (env, sessionId, event) => {
  const database = getGameStatsDatabase(env);
  const consumedAt = new Date().toISOString();
  let results;
  try {
    results = await database.batch([
      database
        .prepare(INSERT_EVENT_FOR_SESSION_SQL)
        .bind(...eventToInsertParams(event), sessionId, consumedAt),
      database
        .prepare(CONSUME_SESSION_SQL)
        .bind(consumedAt, sessionId, consumedAt),
    ]);
  } catch (error) {
    const existing = await selectExistingEvent(env, event.id);
    if (existing) {
      assertStoredEventMatches(existing, event);
      return false;
    }
    throw error;
  }

  const [inserted, consumed] = results;
  if (!getChanges(inserted) || !getChanges(consumed)) {
    const existing = await selectExistingEvent(env, event.id);
    if (existing) {
      assertStoredEventMatches(existing, event);
      return false;
    }
    throw new HttpError(409, "Game session was already used");
  }
  return true;
};

const handleOptions = (request, env) => {
  assertOriginAllowed(request, env);
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
};

const getStatsPlayerId = (request) => {
  const playerId = new URL(request.url).searchParams.get("playerId") || "";
  if (!playerId) return "";
  if (!/^[a-z0-9-]{8,80}$/.test(playerId)) {
    throw new HttpError(400, "Invalid stats player id");
  }
  return playerId;
};

const handleGetStats = async (request, env) => {
  const events = await selectStoredEvents(env);
  return jsonResponse(request, env, createGameStatsDataFromEvents(events, getStatsPlayerId(request)));
};

const handleGetHealth = async (request, env) => {
  const database = getGameStatsDatabase(env);
  const health = await database.prepare(HEALTH_CHECK_SQL).first();
  if (Number(health?.table_count) !== 3) {
    throw new HttpError(500, "D1 health check failed");
  }
  const { buildVersion, acceptedBuildVersions } = requireSecurityConfig(env);
  return jsonResponse(request, env, {
    ok: true,
    buildVersion,
    acceptedBuildVersions,
  });
};

const handlePostSession = async (request, env) => {
  assertBrowserOriginAllowed(request, env);
  const session = await createSession(request, env, await readJsonBody(request));
  return jsonResponse(request, env, { ok: true, ...session }, 201);
};

const handlePostAdministratorSignIn = async (request, env) => {
  assertBrowserOriginAllowed(request, env);
  const result = await createAdministratorSignIn(request, env, await readJsonBody(request));
  return jsonResponse(request, env, result);
};

const handlePostEvent = async (request, env) => {
  assertBrowserOriginAllowed(request, env);
  const payload = await readJsonBody(request);
  assertAllowedKeys(payload, ["event", "session"], "event request");
  const event = normalizeGameStatsEvent(payload.event);
  await validateAdministratorEventProof(request, env, event);
  const existing = await selectExistingEvent(env, event.id);
  if (existing) {
    assertStoredEventMatches(existing, event);
    return jsonResponse(request, env, { ok: true, applied: false, eventId: event.id });
  }
  const sessionId = await validateSession(request, env, event, payload.session);
  const applied = sessionId
    ? await consumeSessionAndStoreEvent(env, sessionId, event)
    : false;
  return jsonResponse(request, env, { ok: true, applied, eventId: event.id }, applied ? 201 : 200);
};

const errorResponse = (request, env, error) => {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : "Internal server error";
  const retryAfterMs =
    error instanceof HttpError && Number.isSafeInteger(error.retryAfterMs)
      ? Math.max(0, Math.min(error.retryAfterMs, MAX_RETRY_AFTER_MS))
      : 0;
  return jsonResponse(
    request,
    env,
    { ok: false, error: message, ...(retryAfterMs ? { retryAfterMs } : {}) },
    status,
    retryAfterMs
      ? {
          "Access-Control-Expose-Headers": "Retry-After",
          "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
        }
      : {}
  );
};

export const handleRequest = async (request, env) => {
  try {
    if (!getGameStatsDatabase(env)) throw new HttpError(500, "D1 database binding is not configured");
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return handleOptions(request, env);
    if (url.pathname === "/health" && request.method === "GET") {
      return await handleGetHealth(request, env);
    }
    if (url.pathname === "/stats" && request.method === "GET") return await handleGetStats(request, env);
    if (url.pathname === "/sessions" && request.method === "POST") {
      return await handlePostSession(request, env);
    }
    if (url.pathname === "/administrator/sign-in" && request.method === "POST") {
      return await handlePostAdministratorSignIn(request, env);
    }
    if (url.pathname === "/events" && request.method === "POST") {
      return await handlePostEvent(request, env);
    }
    if (["/stats", "/sessions", "/events", "/administrator/sign-in"].includes(url.pathname)) {
      throw new HttpError(405, "Method is not allowed");
    }
    throw new HttpError(404, "Route not found");
  } catch (error) {
    return errorResponse(request, env, error);
  }
};

export default { fetch: handleRequest };
