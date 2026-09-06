import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Solitaire uses the shared leaderboard template for global most wins", async () => {
  const [main, styles] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);
  const globalRows = main.match(
    /const appendSolitaireGlobalLeaderboardRows = \(list, entries\) => \{([\s\S]*?)\n\};\n\nconst appendSolitairePersonalRecord/
  );
  const personalRecord = main.match(
    /const appendSolitairePersonalRecord = \(panel\) => \{([\s\S]*?)\n\};\n\nconst appendSolitaireGlobalWins/
  );
  const globalWins = main.match(
    /const appendSolitaireGlobalWins = \(panel\) => \{([\s\S]*?)\n\};\n\nconst appendSnakeGlobalLeaderboardRows/
  );
  const renderSolitaire = main.match(
    /const renderGameStatsSolitaire = \(root\) => \{([\s\S]*?)\n\};\n\nconst renderGameStatsSnake/
  );

  assert.ok(globalRows, "Solitaire should render fixed global leaderboard slots");
  assert.ok(personalRecord, "Solitaire should render the signed-in player's record");
  assert.ok(globalWins, "Solitaire should render global wins");
  assert.ok(renderSolitaire, "Solitaire should have a dedicated stats renderer");
  assert.match(globalRows[1], /Array\.from\(\{ length: 3 \}/);
  assert.match(globalRows[1], /GAME_STATS_MEDAL_SOURCES\[index\]/);
  assert.match(globalRows[1], /game-stats-leaderboard-template-medal/);
  assert.match(globalRows[1], /entry\?\.name \|\| "N\/A"/);
  assert.match(globalRows[1], /entry\?\.metric \?\? 0/);
  assert.match(globalRows[1], /GAME_STATS_EMPTY_LEADERBOARD_ICON/);
  assert.match(globalRows[1], /createGameStatsLeaderboardRow\(\{/);
  assert.match(globalRows[1], /Rank \$\{index \+ 1\}:.*wins/);
  assert.match(globalRows[1], /currentPlayer: isCurrentPlayer/);
  assert.match(
    personalRecord[1],
    /getGameStatsVerifiedPlayerRecord\([\s\S]*?gameStatsGlobalState\.playerRecords\.solitaire/
  );
  assert.match(
    personalRecord[1],
    /const wins = gameStatsGlobalPlayerTotalsAvailable[\s\S]*?gameStatsGlobalState\.playerTotals\.solitaire\.wins[\s\S]*?verifiedEntry\?\.metric \?\? gameStatsLocalState\.totals\.solitaire\.wins/
  );
  assert.match(
    personalRecord[1],
    /const playerRank = verifiedEntry[\s\S]*?gameStatsGlobalState\.playerRanks\.solitaire[\s\S]*?createGameStatsEmptyPlayerRank/
  );
  assert.match(personalRecord[1], /const rankText = `#\$\{playerRank\.rank \?\? "—"\}`;/);
  assert.match(personalRecord[1], /label: "Your Record"/);
  assert.doesNotMatch(personalRecord[1], /["'`]#1["'`]|Local Solitaire rank/);
  assert.doesNotMatch(personalRecord[1], /leaderboards\.solitaire/);
  assert.match(globalWins[1], /gameStatsGlobalState\.totals\.solitaire\.wins/);
  assert.match(globalWins[1], /label: "Global Wins"/);
  assert.match(globalWins[1], /createGameStatsGlobalCounterValue\(/);
  assert.match(renderSolitaire[1], /createGameStatsLeaderboardTemplate\(\{/);
  assert.match(renderSolitaire[1], /title: "Most Wins"/);
  assert.match(renderSolitaire[1], /sectionLabel: "Global Top 3"/);
  assert.match(renderSolitaire[1], /gameStatsGlobalState\.leaderboards\.solitaire/);
  assert.match(renderSolitaire[1], /appendSolitairePersonalRecord\(leaderboard\.panel\)/);
  assert.match(renderSolitaire[1], /appendSolitaireGlobalWins\(leaderboard\.panel\)/);
  assert.doesNotMatch(renderSolitaire[1], /appendGameStatsSummary|appendGameStatsLeaderboard/);
  assert.match(
    styles,
    /#game-stats-window-solitaire \{[\s\S]*?width: min\(94vw, 421\.47px\);/
  );
  assert.match(styles, /\.game-stats-leaderboard-template-medal,/);
  assert.match(styles, /\.game-stats-leaderboard-template-player \{/);
  assert.match(styles, /\.game-stats-leaderboard-template-rank \{/);
  assert.match(styles, /\.game-stats-leaderboard-template-stat-value \{/);
});
