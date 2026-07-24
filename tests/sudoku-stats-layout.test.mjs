import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Sudoku uses six shared leaderboard panels in three columns and two rows", async () => {
  const [main, styles] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);
  const globalRows = main.match(
    /const appendSudokuGlobalLeaderboardRows = \(list, entries, appendMetric\) => \{([\s\S]*?)\n\};\n\nconst appendSudokuLocalBest/
  );
  const localBest = main.match(
    /const appendSudokuLocalBest = \(panel, difficulty, appendMetric\) => \{([\s\S]*?)\n\};\n\nconst appendSudokuTotalGames/
  );
  const totalGames = main.match(
    /const appendSudokuTotalGames = \(panel, difficulty\) => \{([\s\S]*?)\n\};\n\nconst appendSolitaireGlobalLeaderboardRows/
  );
  const renderer = main.match(
    /const renderGameStatsSudoku = \(root\) => \{([\s\S]*?)\n\};\n\nconst getGameProgressContent/
  );

  assert.ok(globalRows, "Sudoku should render three fixed global leaderboard slots");
  assert.ok(localBest, "Sudoku should render one best local entry per difficulty");
  assert.ok(totalGames, "Sudoku should render one global completion total per difficulty");
  assert.ok(renderer, "Sudoku should have a dedicated leaderboard renderer");
  assert.match(globalRows[1], /Array\.from\(\{ length: 3 \}/);
  assert.match(globalRows[1], /GAME_STATS_MEDAL_SOURCES\[index\]/);
  assert.match(globalRows[1], /GAME_STATS_EMPTY_LEADERBOARD_ICON/);
  assert.match(globalRows[1], /entry\?\.metric \?\? 999/);
  assert.match(globalRows[1], /createGameStatsLeaderboardPlayer\(/);
  assert.match(globalRows[1], /appendMetric\(metric, seconds\)/);
  assert.doesNotMatch(globalRows[1], /appendGameStatsLeaderboardMetric|appendGameStatsDigits/);
  assert.match(globalRows[1], /game-stats-sudoku-row/);
  assert.match(localBest[1], /gameStatsLocalState\.leaderboards\.sudoku\[difficulty\]\[0\]/);
  assert.match(localBest[1], /appendMetric\(metric, seconds\)/);
  assert.doesNotMatch(localBest[1], /appendGameStatsLeaderboardMetric|appendGameStatsDigits/);
  assert.match(localBest[1], /label: "Best Local"/);
  assert.match(localBest[1], /hasEntry \? "#1" : "#—"/);
  assert.match(totalGames[1], /gameStatsSudokuTotalGames\(difficulty\)/);
  assert.match(totalGames[1], /label: "Total Games"/);
  assert.match(totalGames[1], /createGameStatsGlobalCounterValue\(/);
  assert.match(renderer[1], /"game-stats-sudoku-columns"/);
  assert.match(
    renderer[1],
    /const difficultiesPerColumn = Math\.ceil\(GAME_STATS_SUDOKU_DIFFICULTIES\.length \/ 3\);/
  );
  assert.match(renderer[1], /columnIndex < 3/);
  assert.match(renderer[1], /"game-stats-sudoku-column"/);
  assert.match(renderer[1], /GAME_STATS_SUDOKU_DIFFICULTIES\.slice\(/);
  assert.match(renderer[1], /sectionLabel: "No-Hints Top 3"/);
  assert.match(renderer[1], /metricPresentation: "text"/);
  assert.match(renderer[1], /metricFormatter: formatSudokuTime/);
  assert.match(renderer[1], /gameStatsGlobalState\.leaderboards\.sudoku\[difficulty\]/);
  assert.match(renderer[1], /leaderboard\.appendMetric/);
  assert.match(renderer[1], /appendSudokuLocalBest\(leaderboard\.panel, difficulty, leaderboard\.appendMetric\)/);
  assert.match(renderer[1], /appendSudokuTotalGames\(leaderboard\.panel, difficulty\)/);
  assert.doesNotMatch(renderer[1], /appendGameStatsSummary|game-stats-summary-grid/);
  assert.match(
    styles,
    /\.game-stats-sudoku-columns \{[\s\S]*?display: grid;[\s\S]*?gap: 6px;[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/
  );
  assert.match(
    styles,
    /\.game-stats-sudoku-column \{[\s\S]*?align-content: start;[\s\S]*?display: grid;[\s\S]*?gap: 6px;[\s\S]*?min-width: 0;/
  );
  assert.match(styles, /#game-stats-window-sudoku \{[\s\S]*?width: min\(94vw, 627\.2px\);/);
  assert.match(
    styles,
    /\.game-stats-leaderboard-template-row \.game-stats-metric--text \{[\s\S]*?font-family: "Pixelated MS Sans Serif"[\s\S]*?font-weight: bold;[\s\S]*?white-space: nowrap;/
  );
});
