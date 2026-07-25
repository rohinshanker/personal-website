import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Minesweeper stats use the reusable leaderboard template in three fixed columns", async () => {
  const [main, styles] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);
  const leaderboardTemplate = main.match(
    /const createGameStatsLeaderboardTemplate = \(\{([\s\S]*?)\n\};\n\n\/\*\*/
  );
  const leaderboardRow = main.match(
    /const createGameStatsLeaderboardRow = \(\{([\s\S]*?)\n\};\n\n\/\*\*/
  );
  const labeledSection = main.match(
    /const createGameStatsLeaderboardLabeledSection = \(\{([\s\S]*?)\n\};\n\nconst appendMinesweeperLeaderboardRows/
  );
  const leaderboardRows = main.match(
    /const appendMinesweeperLeaderboardRows = \(list, entries\) => \{([\s\S]*?)\n\};\n\nconst appendGameStatsLeaderboardMetric/
  );
  const renderMinesweeper = main.match(
    /const renderGameStatsMinesweeper = \(root\) => \{([\s\S]*?)\n\};\n\nconst renderGameStatsSolitaire/
  );
  const personalRecordMetric = main.match(
    /const gameStatsMinesweeperPersonalRecord = \(difficulty\) => \{([\s\S]*?)\n\};\n\nconst getGameStatsVerifiedPlayerRecord/
  );
  const personalRecord = main.match(
    /const appendMinesweeperPersonalRecord = \(container, difficulty\) => \{([\s\S]*?)\n\};\n\nconst renderGameStatsMinesweeper/
  );

  assert.ok(leaderboardTemplate, "A reusable leaderboard panel template should exist");
  assert.ok(leaderboardRow, "A reusable leaderboard row template should exist");
  assert.ok(labeledSection, "A reusable labeled leaderboard section should exist");
  assert.ok(leaderboardRows, "Minesweeper leaderboard rows should have a dedicated renderer");
  assert.ok(renderMinesweeper, "Minesweeper should have a dedicated stats renderer");
  assert.ok(
    personalRecordMetric,
    "Minesweeper should resolve the signed-in player's verified or local record"
  );
  assert.ok(personalRecord, "Minesweeper should render a dedicated personal record card");
  assert.match(leaderboardTemplate[1], /"game-stats-leaderboard-template"/);
  assert.match(leaderboardTemplate[1], /"game-stats-leaderboard-template-list"/);
  assert.match(leaderboardTemplate[1], /metricPresentation = "digits"/);
  assert.match(leaderboardTemplate[1], /metricFormatter = null/);
  assert.match(leaderboardTemplate[1], /if \(metricPresentation === "text"\)/);
  assert.match(leaderboardTemplate[1], /"game-stats-metric--text"/);
  assert.match(leaderboardTemplate[1], /appendGameStatsLeaderboardMetric\(container, value, options\)/);
  assert.match(leaderboardTemplate[1], /return \{ panel, list, appendMetric \}/);
  assert.match(leaderboardTemplate[1], /panel\.append\(heading, label, list\)/);
  assert.match(leaderboardRow[1], /"game-stats-leaderboard-template-row"/);
  assert.match(leaderboardRow[1], /row\.append\(rank, identity, metric\)/);
  assert.match(labeledSection[1], /"game-stats-leaderboard-template-section"/);
  assert.match(labeledSection[1], /"game-stats-leaderboard-template-subheading"/);
  assert.match(leaderboardRows[1], /Array\.from\(\{ length: 3 \}/);
  assert.match(leaderboardRows[1], /GAME_STATS_MEDAL_SOURCES\[index\]/);
  assert.match(leaderboardRows[1], /game-stats-minesweeper-medal/);
  assert.match(leaderboardRows[1], /medal\.alt = ""/);
  assert.match(leaderboardRows[1], /GAME_STATS_EMPTY_LEADERBOARD_ICON/);
  assert.match(leaderboardRows[1], /createMinesweeperLeaderboardPlayer\(/);
  assert.match(
    main,
    /const createGameStatsLeaderboardPlayer = \([\s\S]*?"game-stats-leaderboard-template-player"/
  );
  assert.match(
    main,
    /const createMinesweeperLeaderboardPlayer = \([\s\S]*?className: "game-stats-minesweeper-player",[\s\S]*?iconClassName: "game-stats-minesweeper-player-icon"/
  );
  assert.match(leaderboardRows[1], /entry\?\.name \|\| "N\/A"/);
  assert.match(leaderboardRows[1], /entry\?\.metric \?\? 999/);
  assert.match(
    leaderboardRows[1],
    /entry && gameStatsProfile && entry\.playerId === gameStatsProfile\.id/
  );
  assert.match(leaderboardRows[1], /currentPlayer: isCurrentPlayer/);
  assert.match(leaderboardRows[1], /your entry/);
  assert.match(leaderboardRows[1], /createGameStatsLeaderboardRow\(\{/);
  assert.match(leaderboardRows[1], /tagName: "li"/);
  assert.doesNotMatch(
    leaderboardRows[1],
    /createGameStatsNode\("li", "game-stats-minesweeper-row"\)/
  );

  assert.match(personalRecord[1], /game-stats-minesweeper-record/);
  assert.match(personalRecord[1], /playerRanks\.minesweeper\[difficulty\]/);
  assert.match(
    personalRecord[1],
    /getGameStatsVerifiedPlayerRecord\([\s\S]*?playerRecords\.minesweeper\[difficulty\]/
  );
  assert.match(personalRecord[1], /const profile = verifiedEntry \|\| gameStatsProfile/);
  assert.match(personalRecord[1], /const rankText = `#\$\{playerRank\.rank \?\? "—"\}`;/);
  assert.doesNotMatch(personalRecord[1], /["'`]#1["'`]/);
  assert.doesNotMatch(personalRecord[1], /of \$\{playerRank\.totalPlayers\}/);
  assert.match(personalRecord[1], /game-stats-minesweeper-record-row/);
  assert.match(personalRecord[1], /game-stats-minesweeper-rank/);
  assert.match(personalRecord[1], /createGameStatsLeaderboardLabeledSection\(\{/);
  assert.match(personalRecord[1], /label: "Your Record"/);
  assert.match(personalRecord[1], /createMinesweeperLeaderboardPlayer\(profile\.name, profile\.icon/);
  assert.match(personalRecord[1], /const personalRecord = gameStatsMinesweeperPersonalRecord\(difficulty\)/);
  assert.match(personalRecord[1], /appendGameStatsDigits\(metric, personalRecord, 3\)/);
  assert.match(personalRecord[1], /createGameStatsLeaderboardRow\(\{/);
  assert.match(
    personalRecordMetric[1],
    /gameStatsGlobalState\.playerRecords\.minesweeper\[difficulty\]/
  );
  assert.match(
    personalRecordMetric[1],
    /gameStatsProfile[\s\S]*?globalRecord\?\.playerId === gameStatsProfile\.id[\s\S]*?return globalRecord\.metric/
  );
  assert.match(
    personalRecordMetric[1],
    /gameStatsLocalState\.leaderboards\.minesweeper\[difficulty\]/
  );

  assert.match(renderMinesweeper[1], /"game-stats-minesweeper-columns"/);
  assert.match(renderMinesweeper[1], /createGameStatsLeaderboardTemplate\(\{/);
  assert.match(renderMinesweeper[1], /leaderboard\.list/);
  assert.match(renderMinesweeper[1], /leaderboard\.panel/);
  assert.match(renderMinesweeper[1], /gameStatsGlobalState\.leaderboards\.minesweeper\[difficulty\]/);
  assert.match(renderMinesweeper[1], /appendMinesweeperPersonalRecord\(leaderboard\.panel, difficulty\)/);
  assert.match(renderMinesweeper[1], /"Global Wins"/);
  assert.match(renderMinesweeper[1], /game-stats-minesweeper-global-wins/);
  assert.match(renderMinesweeper[1], /globalCounter: true/);
  assert.match(renderMinesweeper[1], /gameStatsGlobalState\.totals\.minesweeper\.wins\[difficulty\]/);
  assert.match(renderMinesweeper[1], /assets\/app-icons\/ico\/joystick_alt\.ico/);
  assert.match(renderMinesweeper[1], /View your personal stats in the Game Progress app/);
  assert.doesNotMatch(renderMinesweeper[1], /appendGameStatsSummary/);

  assert.match(
    styles,
    /\.game-stats-minesweeper-columns \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/
  );
  const currentPlayerStyle = styles.match(
    /\.game-stats-player-name\.is-current-player \{([\s\S]*?)\n\}/
  );
  assert.ok(currentPlayerStyle, "Current-player names should have a shared style rule");
  assert.match(currentPlayerStyle[1], /color: #008000;/);
  assert.doesNotMatch(currentPlayerStyle[1], /outline\s*:/);
  assert.match(
    styles,
    /\.game-stats-leaderboard-template-row,[\s\S]*?\.game-stats-minesweeper-row \{[\s\S]*?align-items: center;[\s\S]*?grid-template-areas: "medal player metric";[\s\S]*?grid-template-columns: 22px minmax\(0, 1fr\) auto;[\s\S]*?min-height: 28px;[\s\S]*?padding: 3px;/
  );
  assert.match(
    styles,
    /\.game-stats-minesweeper-row \.game-stats-metric \{[\s\S]*?grid-area: metric;[\s\S]*?justify-self: end;/
  );
  assert.match(
    styles,
    /\.game-stats-minesweeper-row \.game-stats-player-name \{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-width: 0;/
  );
  assert.match(
    styles,
    /\.game-stats-minesweeper-medal,[\s\S]*?\.game-stats-leaderboard-template-row \.game-stats-leaderboard-template-player-icon \{[\s\S]*?height: 22px;[\s\S]*?width: 22px;/
  );
  assert.match(styles, /#game-stats-window-minesweeper \{[\s\S]*?width: min\(94vw, 627\.2px\);/);
  assert.match(
    styles,
    /\.game-stats-minesweeper-row \.game-stats-digit-strip \{[\s\S]*?box-sizing: border-box;[\s\S]*?height: 22px;/
  );
  assert.match(
    styles,
    /\.game-stats-minesweeper-row \.game-stats-digit-strip img \{[\s\S]*?height: 18px;[\s\S]*?width: 11px;/
  );
  assert.match(
    styles,
    /\.game-stats-minesweeper-rank \{[\s\S]*?grid-area: medal;[\s\S]*?height: 22px;/
  );
  assert.match(main, /const appendMinesweeperStat = \([\s\S]*?labelClassName: "game-stats-minesweeper-subheading"/);
  const minesweeperStatRule = styles.match(
    /\.game-stats-leaderboard-template-section,[\s\S]*?\.game-stats-minesweeper-stat \{([\s\S]*?)\n\}/
  );
  assert.ok(minesweeperStatRule, "Minesweeper stat wrapper should have a dedicated style rule");
  assert.doesNotMatch(minesweeperStatRule[1], /background: #fff;/);
  assert.match(
    styles,
    /\.game-stats-minesweeper-stat-value \{[\s\S]*?background: #fff;[\s\S]*?box-shadow:[\s\S]*?min-height: 28px;/
  );
  assert.doesNotMatch(styles, /\.game-stats-minesweeper-record-player \{/);
  assert.match(styles, /\.game-stats-player-name\.is-overflowing \.game-stats-player-name-text \{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.game-stats-game-progress-handoff img \{/);

  await Promise.all([
    ...["gold-medal.png", "silver-medal.png", "bronze-medal.png"].map((filename) =>
      access(new URL(`assets/minesweeper_assets/${filename}`, root))
    ),
    access(new URL("assets/app-icons/ico/user_card.ico", root)),
    access(new URL("assets/app-icons/ico/address_book_user.ico", root)),
  ]);
});
