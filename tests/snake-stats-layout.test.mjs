import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Snake uses four shared leaderboard panels in two fixed columns", async () => {
  const [main, styles] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);
  const globalRows = main.match(
    /const appendSnakeGlobalLeaderboardRows = \(list, entries\) => \{([\s\S]*?)\n\};\n\nconst appendSnakePersonalRecord/
  );
  const personalRecord = main.match(
    /const appendSnakePersonalRecord = \(panel, size\) => \{([\s\S]*?)\n\};\n\nconst appendSnakeTotalGames/
  );
  const totalGames = main.match(
    /const appendSnakeTotalGames = \(panel, size\) => \{([\s\S]*?)\n\};\n\nconst appendMinesweeperStat/
  );
  const renderSnake = main.match(
    /const renderGameStatsSnake = \(root\) => \{([\s\S]*?)\n\};\n\nconst renderGameStatsSudoku/
  );

  assert.ok(globalRows, "Snake should render fixed global leaderboard slots");
  assert.ok(personalRecord, "Snake should render one player record per board size");
  assert.ok(totalGames, "Snake should render a global game total per board size");
  assert.ok(renderSnake, "Snake should have a dedicated stats renderer");
  assert.match(globalRows[1], /Array\.from\(\{ length: 3 \}/);
  assert.match(globalRows[1], /GAME_STATS_MEDAL_SOURCES\[index\]/);
  assert.match(globalRows[1], /game-stats-leaderboard-template-medal/);
  assert.match(globalRows[1], /entry\?\.name \|\| "N\/A"/);
  assert.match(globalRows[1], /entry\?\.metric \?\? 0/);
  assert.match(globalRows[1], /GAME_STATS_EMPTY_LEADERBOARD_ICON/);
  assert.match(globalRows[1], /createGameStatsLeaderboardRow\(\{/);
  assert.match(globalRows[1], /Rank \$\{index \+ 1\}:.*points/);
  assert.match(globalRows[1], /currentPlayer: isCurrentPlayer/);
  assert.match(
    personalRecord[1],
    /getGameStatsVerifiedPlayerRecord\([\s\S]*?gameStatsGlobalState\.playerRecords\.snake\[size\]/
  );
  assert.match(
    personalRecord[1],
    /getGameStatsLocalPlayerRecord\([\s\S]*?gameStatsLocalState\.leaderboards\.snake\[size\]\[0\]/
  );
  assert.match(personalRecord[1], /const entry = verifiedEntry \|\| localEntry/);
  assert.match(
    personalRecord[1],
    /const playerRank = verifiedEntry[\s\S]*?gameStatsGlobalState\.playerRanks\.snake\[size\][\s\S]*?createGameStatsEmptyPlayerRank/
  );
  assert.match(personalRecord[1], /const rankText = `#\$\{playerRank\.rank \?\? "—"\}`;/);
  assert.match(personalRecord[1], /label: "Your Record"/);
  assert.doesNotMatch(personalRecord[1], /["'`]#1["'`]|Best local/);
  assert.match(totalGames[1], /gameStatsGlobalState\.totals\.snake\.gamesPlayed\[size\]/);
  assert.match(totalGames[1], /label: "Total Games"/);
  assert.match(totalGames[1], /Global games played on \$\{size\}×\$\{size\}/);
  assert.match(totalGames[1], /createGameStatsGlobalCounterValue\(/);
  assert.match(renderSnake[1], /"game-stats-snake-columns"/);
  assert.match(renderSnake[1], /const boardSizesPerColumn = Math\.ceil\(GAME_STATS_SNAKE_BOARD_SIZES\.length \/ 2\);/);
  assert.match(renderSnake[1], /columnIndex < 2/);
  assert.match(renderSnake[1], /"game-stats-snake-column"/);
  assert.match(renderSnake[1], /GAME_STATS_SNAKE_BOARD_SIZES\.slice\(/);
  assert.match(renderSnake[1], /boardSizes\.forEach\(\(size\) => \{/);
  assert.match(renderSnake[1], /createGameStatsLeaderboardTemplate\(\{/);
  assert.match(renderSnake[1], /title: `\$\{size\}×\$\{size\} High Scores`/);
  assert.match(renderSnake[1], /sectionLabel: "Global Top 3"/);
  assert.match(renderSnake[1], /gameStatsGlobalState\.leaderboards\.snake\[size\]/);
  assert.match(renderSnake[1], /appendSnakePersonalRecord\(leaderboard\.panel, size\)/);
  assert.match(renderSnake[1], /appendSnakeTotalGames\(leaderboard\.panel, size\)/);
  assert.doesNotMatch(renderSnake[1], /appendGameStatsSummary|appendGameStatsLeaderboard/);
  assert.match(
    styles,
    /\.game-stats-snake-columns \{[\s\S]*?display: grid;[\s\S]*?gap: 8px;[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(
    styles,
    /\.game-stats-snake-column \{[\s\S]*?align-content: start;[\s\S]*?display: grid;[\s\S]*?gap: 8px;[\s\S]*?min-width: 0;/
  );
  assert.doesNotMatch(
    styles,
    /@media \(max-width: 560px\) \{[\s\S]*?\.game-stats-snake-columns/
  );
});
