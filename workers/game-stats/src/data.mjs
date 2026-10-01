import {
  GAME_STATS_DIFFICULTIES,
  GAME_STATS_HINT_BUCKETS,
  GAME_STATS_SNAKE_BOARD_SIZES,
  GAME_STATS_SUDOKU_DIFFICULTIES,
} from "./constants.mjs";

const keyed = (keys, valueOf) =>
  Object.fromEntries(keys.map((key) => [key, valueOf(key)]));

export const createEmptyPlayerTotals = () => ({
  minesweeper: { wins: keyed(GAME_STATS_DIFFICULTIES, () => 0) },
  solitaire: { wins: 0 },
  snake: {
    totalGamesPlayed: 0,
    gamesPlayed: keyed(GAME_STATS_SNAKE_BOARD_SIZES, () => 0),
  },
  sudoku: {
    wins: keyed(GAME_STATS_SUDOKU_DIFFICULTIES, () =>
      keyed(GAME_STATS_HINT_BUCKETS, () => 0)
    ),
  },
});

export const createEmptyGameStatsData = ({ legacy = true } = {}) => ({
  version: legacy ? 1 : 2,
  generatedAt: new Date(0).toISOString(),
  ...(legacy ? { eventIds: [] } : { acknowledgedEventIds: [] }),
  totals: createEmptyPlayerTotals(),
  playerTotals: createEmptyPlayerTotals(),
  leaderboards: {
    minesweeper: keyed(GAME_STATS_DIFFICULTIES, () => []),
    solitaire: [],
    snake: keyed(GAME_STATS_SNAKE_BOARD_SIZES, () => []),
    sudoku: keyed(GAME_STATS_SUDOKU_DIFFICULTIES, () => []),
  },
  playerRanks: {
    minesweeper: keyed(GAME_STATS_DIFFICULTIES, () => ({ rank: null, totalPlayers: 0 })),
    solitaire: { rank: null, totalPlayers: 0 },
    snake: keyed(GAME_STATS_SNAKE_BOARD_SIZES, () => ({ rank: null, totalPlayers: 0 })),
    sudoku: keyed(GAME_STATS_SUDOKU_DIFFICULTIES, () => ({ rank: null, totalPlayers: 0 })),
  },
  playerRecords: {
    minesweeper: keyed(GAME_STATS_DIFFICULTIES, () => null),
    solitaire: null,
    snake: keyed(GAME_STATS_SNAKE_BOARD_SIZES, () => null),
    sudoku: keyed(GAME_STATS_SUDOKU_DIFFICULTIES, () => null),
  },
});

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
