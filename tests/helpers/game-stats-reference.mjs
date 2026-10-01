/* Frozen test-side reference for the pre-SQL aggregation contract. */
import {
  GAME_STATS_DIFFICULTIES,
  GAME_STATS_SNAKE_BOARD_SIZES,
  GAME_STATS_SUDOKU_DIFFICULTIES,
} from "../../workers/game-stats/src/constants.mjs";
import {
  compareLeaderboardEntries,
  createEmptyGameStatsData,
} from "../../workers/game-stats/src/data.mjs";
import { normalizeHistoricalGameStatsEvent } from "../../workers/game-stats/src/events.mjs";

const createEntry = (event) => ({
  eventId: event.id,
  playerId: event.profile.id,
  name: event.profile.name,
  icon: event.profile.icon,
  metric: event.metric,
  metricKind: event.metricKind,
  occurredAt: event.occurredAt,
});

const upsertEntry = (leaderboard, event, direction) => {
  if (!event.profile || !Number.isFinite(event.metric)) return leaderboard;
  const next = createEntry(event);
  const entries = [...leaderboard];
  const existingIndex = entries.findIndex(({ playerId }) => playerId === next.playerId);
  if (existingIndex < 0) entries.push(next);
  else if (compareLeaderboardEntries(direction, next, entries[existingIndex]) < 0) {
    entries[existingIndex] = next;
  }
  return entries.sort((a, b) => compareLeaderboardEntries(direction, a, b));
};

export const createGameStatsDataFromEvents = (rawEvents, requestedPlayerId = "") => {
  const stats = createEmptyGameStatsData();
  const requestedPlayer = String(requestedPlayerId || "").trim();
  const rankings = {
    minesweeper: Object.fromEntries(GAME_STATS_DIFFICULTIES.map((key) => [key, []])),
    solitaire: new Map(),
    snake: Object.fromEntries(GAME_STATS_SNAKE_BOARD_SIZES.map((key) => [key, []])),
    sudoku: Object.fromEntries(GAME_STATS_SUDOKU_DIFFICULTIES.map((key) => [key, []])),
  };
  stats.generatedAt = new Date().toISOString();
  for (const rawEvent of rawEvents) {
    const event = normalizeHistoricalGameStatsEvent(rawEvent);
    if (!event || stats.eventIds.includes(event.id)) continue;
    stats.eventIds.push(event.id);
    const isRequested = event.profile?.id === requestedPlayer;
    if (event.game === "minesweeper") {
      stats.totals.minesweeper.wins[event.difficulty] += 1;
      if (isRequested) stats.playerTotals.minesweeper.wins[event.difficulty] += 1;
      rankings.minesweeper[event.difficulty] = upsertEntry(
        rankings.minesweeper[event.difficulty], event, "asc"
      );
    } else if (event.game === "solitaire") {
      stats.totals.solitaire.wins += 1;
      if (isRequested) stats.playerTotals.solitaire.wins += 1;
      if (event.profile) {
        const previous = rankings.solitaire.get(event.profile.id);
        const eventTime = new Date(event.occurredAt).getTime();
        const previousTime = new Date(previous?.occurredAt || 0).getTime();
        const latest =
          !previous || eventTime > previousTime ||
          (eventTime === previousTime && event.id.localeCompare(previous.eventId) > 0);
        rankings.solitaire.set(event.profile.id, {
          eventId: latest ? event.id : previous.eventId,
          playerId: event.profile.id,
          name: latest ? event.profile.name : previous.name,
          icon: latest ? event.profile.icon : previous.icon,
          metric: (previous?.metric || 0) + 1,
          metricKind: "wins",
          occurredAt: latest ? event.occurredAt : previous.occurredAt,
        });
      }
    } else if (event.game === "snake") {
      stats.totals.snake.totalGamesPlayed += 1;
      stats.totals.snake.gamesPlayed[event.boardSize] += 1;
      if (isRequested) {
        stats.playerTotals.snake.totalGamesPlayed += 1;
        stats.playerTotals.snake.gamesPlayed[event.boardSize] += 1;
      }
      rankings.snake[event.boardSize] = upsertEntry(
        rankings.snake[event.boardSize], event, "desc"
      );
    } else if (event.game === "sudoku") {
      stats.totals.sudoku.wins[event.difficulty][event.hintBucket] += 1;
      if (isRequested) {
        stats.playerTotals.sudoku.wins[event.difficulty][event.hintBucket] += 1;
      }
      if (event.hintBucket === "noHints" && Number.isFinite(event.metric)) {
        rankings.sudoku[event.difficulty] = upsertEntry(
          rankings.sudoku[event.difficulty], event, "asc"
        );
      }
    }
  }

  const finish = (entries, setLeaderboard, setRank, setRecord) => {
    const index = entries.findIndex(({ playerId }) => playerId === requestedPlayer);
    setLeaderboard(entries.slice(0, 3));
    setRank({ rank: index < 0 ? null : index + 1, totalPlayers: entries.length });
    setRecord(index < 0 ? null : entries[index]);
  };
  for (const difficulty of GAME_STATS_DIFFICULTIES) {
    finish(
      rankings.minesweeper[difficulty],
      (value) => { stats.leaderboards.minesweeper[difficulty] = value; },
      (value) => { stats.playerRanks.minesweeper[difficulty] = value; },
      (value) => { stats.playerRecords.minesweeper[difficulty] = value; }
    );
  }
  const solitaire = [...rankings.solitaire.values()].sort((first, second) =>
    compareLeaderboardEntries("desc", first, second)
  );
  finish(
    solitaire,
    (value) => { stats.leaderboards.solitaire = value; },
    (value) => { stats.playerRanks.solitaire = value; },
    (value) => { stats.playerRecords.solitaire = value; }
  );
  for (const size of GAME_STATS_SNAKE_BOARD_SIZES) {
    finish(
      rankings.snake[size],
      (value) => { stats.leaderboards.snake[size] = value; },
      (value) => { stats.playerRanks.snake[size] = value; },
      (value) => { stats.playerRecords.snake[size] = value; }
    );
  }
  for (const difficulty of GAME_STATS_SUDOKU_DIFFICULTIES) {
    finish(
      rankings.sudoku[difficulty],
      (value) => { stats.leaderboards.sudoku[difficulty] = value; },
      (value) => { stats.playerRanks.sudoku[difficulty] = value; },
      (value) => { stats.playerRecords.sudoku[difficulty] = value; }
    );
  }
  return stats;
};
