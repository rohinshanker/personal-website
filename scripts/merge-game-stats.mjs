import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const GAME_STATS_GLOBAL_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "home/game-stats-global.js"
);

export const GAME_STATS_DIFFICULTIES = Object.freeze([
  "beginner",
  "intermediate",
  "expert",
]);
export const GAME_STATS_SUDOKU_DIFFICULTIES = Object.freeze([
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
  "extreme",
]);
export const GAME_STATS_SNAKE_BOARD_SIZES = Object.freeze(["10", "16", "20", "24"]);
export const GAME_STATS_HINT_BUCKETS = Object.freeze(["noHints", "withHints"]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const positiveInteger = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0;
};

const stableIsoDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid event date: ${value}`);
  }
  return date.toISOString();
};

const createEmptyMinesweeperWins = () =>
  Object.fromEntries(GAME_STATS_DIFFICULTIES.map((difficulty) => [difficulty, 0]));

const createEmptyMinesweeperLeaderboards = () =>
  Object.fromEntries(GAME_STATS_DIFFICULTIES.map((difficulty) => [difficulty, []]));

const createEmptySnakeGames = () =>
  Object.fromEntries(GAME_STATS_SNAKE_BOARD_SIZES.map((size) => [size, 0]));

const createEmptySnakeLeaderboards = () =>
  Object.fromEntries(GAME_STATS_SNAKE_BOARD_SIZES.map((size) => [size, []]));

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
    minesweeper: {
      wins: createEmptyMinesweeperWins(),
    },
    solitaire: {
      wins: 0,
    },
    snake: {
      totalGamesPlayed: 0,
      gamesPlayed: createEmptySnakeGames(),
    },
    sudoku: {
      wins: createEmptySudokuWins(),
    },
  },
  leaderboards: {
    minesweeper: createEmptyMinesweeperLeaderboards(),
    solitaire: [],
    snake: createEmptySnakeLeaderboards(),
  },
});

const normalizeProfile = (profile) => {
  if (!isPlainObject(profile)) return null;
  const playerId = String(profile.id || "").trim();
  const name = String(profile.name || "").trim().slice(0, 32);
  const icon = String(profile.icon || "").trim();
  if (!playerId || !name || !/^assets\/app-icons\/ico\/[^/]+\.ico$/.test(icon)) {
    return null;
  }
  return { id: playerId, name, icon };
};

const normalizeMetric = (value, label) => {
  const metric = Number(value);
  if (!Number.isFinite(metric) || metric < 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return Math.trunc(metric);
};

export const normalizeGameStatsEvent = (rawEvent) => {
  if (!isPlainObject(rawEvent)) throw new Error("Event must be an object");
  const id = String(rawEvent.id || "").trim();
  const game = String(rawEvent.game || "").trim();
  const type = String(rawEvent.type || "").trim();
  const occurredAt = stableIsoDate(rawEvent.occurredAt);
  const profile = normalizeProfile(rawEvent.profile);

  if (!/^[a-z0-9-]{8,80}$/.test(id)) {
    throw new Error(`Invalid event id: ${id}`);
  }

  if (game === "minesweeper") {
    const difficulty = String(rawEvent.difficulty || rawEvent.category || "").trim();
    if (type !== "win" || !GAME_STATS_DIFFICULTIES.includes(difficulty)) {
      throw new Error("Invalid Minesweeper event");
    }
    return {
      id,
      game,
      type,
      occurredAt,
      difficulty,
      metric: normalizeMetric(rawEvent.metric ?? rawEvent.seconds, "Minesweeper time"),
      metricKind: "seconds",
      profile,
    };
  }

  if (game === "solitaire") {
    if (type !== "win") throw new Error("Invalid Solitaire event");
    return {
      id,
      game,
      type,
      occurredAt,
      metric: normalizeMetric(rawEvent.metric ?? rawEvent.moves, "Solitaire moves"),
      metricKind: "moves",
      profile,
    };
  }

  if (game === "snake") {
    const boardSize = String(rawEvent.boardSize || rawEvent.category || "").trim();
    if (type !== "gamePlayed" || !GAME_STATS_SNAKE_BOARD_SIZES.includes(boardSize)) {
      throw new Error("Invalid Snake event");
    }
    return {
      id,
      game,
      type,
      occurredAt,
      boardSize,
      metric: normalizeMetric(rawEvent.metric ?? rawEvent.score, "Snake score"),
      metricKind: "score",
      profile,
    };
  }

  if (game === "sudoku") {
    const difficulty = String(rawEvent.difficulty || "").trim();
    const hintBucket = String(rawEvent.hintBucket || "").trim();
    if (
      type !== "win" ||
      !GAME_STATS_SUDOKU_DIFFICULTIES.includes(difficulty) ||
      !GAME_STATS_HINT_BUCKETS.includes(hintBucket)
    ) {
      throw new Error("Invalid Sudoku event");
    }
    return {
      id,
      game,
      type,
      occurredAt,
      difficulty,
      hintBucket,
      profile,
    };
  }

  throw new Error(`Unsupported game: ${game}`);
};

const compareEntryDates = (first, second) => {
  const firstTime = new Date(first.occurredAt).getTime();
  const secondTime = new Date(second.occurredAt).getTime();
  if (firstTime !== secondTime) return firstTime - secondTime;
  return first.eventId.localeCompare(second.eventId);
};

export const compareLeaderboardEntries = (direction, first, second) => {
  if (first.metric !== second.metric) {
    return direction === "desc"
      ? second.metric - first.metric
      : first.metric - second.metric;
  }
  return compareEntryDates(first, second);
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

export const upsertLeaderboardEntry = (leaderboard, event, limit, direction) => {
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

const normalizeLeaderboardEntries = (entries, direction, limit) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const normalizedProfile = normalizeProfile({
        id: entry.playerId,
        name: entry.name,
        icon: entry.icon,
      });
      if (!normalizedProfile) return null;
      const eventId = String(entry.eventId || "").trim();
      if (!eventId) return null;
      return {
        eventId,
        playerId: normalizedProfile.id,
        name: normalizedProfile.name,
        icon: normalizedProfile.icon,
        metric: positiveInteger(entry.metric),
        metricKind: String(entry.metricKind || ""),
        occurredAt: stableIsoDate(entry.occurredAt),
      };
    })
    .filter(Boolean)
    .sort((first, second) => compareLeaderboardEntries(direction, first, second))
    .slice(0, limit);

export const normalizeGameStatsData = (rawData) => {
  const empty = createEmptyGameStatsData();
  const data = isPlainObject(rawData) ? rawData : {};
  const totals = isPlainObject(data.totals) ? data.totals : {};
  const leaderboards = isPlainObject(data.leaderboards) ? data.leaderboards : {};

  GAME_STATS_DIFFICULTIES.forEach((difficulty) => {
    empty.totals.minesweeper.wins[difficulty] = positiveInteger(
      totals.minesweeper?.wins?.[difficulty]
    );
    empty.leaderboards.minesweeper[difficulty] = normalizeLeaderboardEntries(
      leaderboards.minesweeper?.[difficulty],
      "asc",
      3
    );
  });

  empty.totals.solitaire.wins = positiveInteger(totals.solitaire?.wins);
  empty.leaderboards.solitaire = normalizeLeaderboardEntries(
    leaderboards.solitaire,
    "asc",
    5
  );

  empty.totals.snake.totalGamesPlayed = positiveInteger(totals.snake?.totalGamesPlayed);
  GAME_STATS_SNAKE_BOARD_SIZES.forEach((size) => {
    empty.totals.snake.gamesPlayed[size] = positiveInteger(
      totals.snake?.gamesPlayed?.[size]
    );
    empty.leaderboards.snake[size] = normalizeLeaderboardEntries(
      leaderboards.snake?.[size],
      "desc",
      5
    );
  });

  GAME_STATS_SUDOKU_DIFFICULTIES.forEach((difficulty) => {
    GAME_STATS_HINT_BUCKETS.forEach((hintBucket) => {
      empty.totals.sudoku.wins[difficulty][hintBucket] = positiveInteger(
        totals.sudoku?.wins?.[difficulty]?.[hintBucket]
      );
    });
  });

  empty.generatedAt = data.generatedAt ? stableIsoDate(data.generatedAt) : empty.generatedAt;
  empty.eventIds = Array.from(
    new Set((Array.isArray(data.eventIds) ? data.eventIds : []).map((id) => String(id)))
  ).filter((id) => /^[a-z0-9-]{8,80}$/.test(id));

  return empty;
};

export const applyGameStatsEvent = (statsData, rawEvent) => {
  const stats = normalizeGameStatsData(statsData);
  const event = normalizeGameStatsEvent(rawEvent);
  if (stats.eventIds.includes(event.id)) return { stats, applied: false };
  stats.eventIds.push(event.id);

  if (event.game === "minesweeper") {
    stats.totals.minesweeper.wins[event.difficulty] += 1;
    stats.leaderboards.minesweeper[event.difficulty] = upsertLeaderboardEntry(
      stats.leaderboards.minesweeper[event.difficulty],
      event,
      3,
      "asc"
    );
  } else if (event.game === "solitaire") {
    stats.totals.solitaire.wins += 1;
    stats.leaderboards.solitaire = upsertLeaderboardEntry(
      stats.leaderboards.solitaire,
      event,
      5,
      "asc"
    );
  } else if (event.game === "snake") {
    stats.totals.snake.totalGamesPlayed += 1;
    stats.totals.snake.gamesPlayed[event.boardSize] += 1;
    stats.leaderboards.snake[event.boardSize] = upsertLeaderboardEntry(
      stats.leaderboards.snake[event.boardSize],
      event,
      5,
      "desc"
    );
  } else if (event.game === "sudoku") {
    stats.totals.sudoku.wins[event.difficulty][event.hintBucket] += 1;
  }

  return { stats, applied: true };
};

export const applyGameStatsEvents = (statsData, rawEvents) => {
  let stats = normalizeGameStatsData(statsData);
  let appliedCount = 0;
  for (const rawEvent of rawEvents) {
    const result = applyGameStatsEvent(stats, rawEvent);
    stats = result.stats;
    if (result.applied) appliedCount += 1;
  }
  return { stats, appliedCount };
};

export const parseGameStatsGlobalScript = (source) => {
  const sandbox = { window: {} };
  vm.runInNewContext(String(source), sandbox, { timeout: 1000 });
  return normalizeGameStatsData(sandbox.window.rohinGameStatsGlobal);
};

export const serializeGameStatsGlobalScript = (statsData) => {
  const stats = normalizeGameStatsData(statsData);
  return `window.rohinGameStatsGlobal = ${JSON.stringify(stats, null, 2)};\n`;
};

const loadPendingEvents = async (pendingPath) => {
  const source = await readFile(pendingPath, "utf8");
  const payload = JSON.parse(source);
  if (!isPlainObject(payload) || !Array.isArray(payload.events)) {
    throw new Error("Pending stats export must contain an events array");
  }
  return payload.events;
};

export const mergePendingStatsFile = async (
  pendingPath,
  globalPath = GAME_STATS_GLOBAL_PATH
) => {
  const [globalSource, pendingEvents] = await Promise.all([
    readFile(globalPath, "utf8"),
    loadPendingEvents(pendingPath),
  ]);
  const currentStats = parseGameStatsGlobalScript(globalSource);
  const { stats, appliedCount } = applyGameStatsEvents(currentStats, pendingEvents);
  stats.generatedAt = new Date().toISOString();
  await writeFile(globalPath, serializeGameStatsGlobalScript(stats), "utf8");
  return { appliedCount, eventCount: pendingEvents.length, globalPath };
};

const runCli = async () => {
  const pendingPath = process.argv[2];
  const globalPath = process.argv[3] ? resolve(process.argv[3]) : GAME_STATS_GLOBAL_PATH;
  if (!pendingPath) {
    throw new Error("Usage: node scripts/merge-game-stats.mjs <pending-json> [global-js]");
  }
  const result = await mergePendingStatsFile(resolve(pendingPath), globalPath);
  console.log(
    `Merged ${result.appliedCount}/${result.eventCount} pending game stat events into ${result.globalPath}`
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
