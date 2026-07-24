import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("global leaderboard aggregates fill their black digit strips without overflowing", async () => {
  const [main, styles] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);
  const digitRenderer = main.match(
    /const appendGameStatsDigits = \(([\s\S]*?)\n\};\n\nconst createGameStatsNode/
  );
  const globalCounter = main.match(
    /const createGameStatsGlobalCounterValue = \(value, ariaLabel, className\) => \{([\s\S]*?)\n\};\n\nconst appendSolitaireGlobalLeaderboardRows/
  );
  const minesweeperStat = main.match(
    /const appendMinesweeperStat = \(([\s\S]*?)\n\};\n\nconst appendMinesweeperPersonalRecord/
  );

  assert.ok(digitRenderer, "Digit rendering should support a shared accessible mode");
  assert.ok(globalCounter, "Global aggregates should share one digital counter renderer");
  assert.ok(minesweeperStat, "Minesweeper should support the shared global counter");
  assert.match(main, /String\(Math\.max\(0, Math\.trunc\(Number\(value\) \|\| 0\)\)\)\.padStart/);
  assert.doesNotMatch(main, /Math\.min\(99999, Math\.trunc\(Number\(value\) \|\| 0\)\)/);
  assert.match(digitRenderer[1], /\{ decorative = false, fillWidth = false \} = \{\}/);
  assert.match(digitRenderer[1], /strip\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(
    digitRenderer[1],
    /Math\.floor\(\s*Math\.max\(\s*0,\s*strip\.clientWidth - 4\s*\) \/ 11\s*\)/,
    "Fill mode should calculate the number of whole digit sprites that fit inside the padded strip"
  );
  assert.match(
    digitRenderer[1],
    /const availableDigitSlots = fillWidth[\s\S]*?Math\.floor\([\s\S]*?\)\s*:\s*0;/,
    "Fill mode should calculate extra leading-zero slots only when requested"
  );
  assert.match(
    digitRenderer[1],
    /Math\.max\(length, availableDigitSlots\)/,
    "Fill mode should retain every real digit while adding zero sprites only for available width"
  );
  assert.match(
    digitRenderer[1],
    /if \(fillWidth[\s\S]*?new ResizeObserver\(/,
    "Only fill-mode counters should observe width changes and re-fill after their window or panel changes size"
  );
  assert.match(digitRenderer[1], /strip\.style\.setProperty\("--game-stats-digit-count", String\(digits\.length\)\)/);
  assert.match(digitRenderer[1], /image\.alt = decorative \? "" : digit/);
  assert.match(globalCounter[1], /"game-stats-global-counter-value"/);
  assert.match(globalCounter[1], /displayValue\.setAttribute\("role", "img"\)/);
  assert.match(globalCounter[1], /displayValue\.setAttribute\("aria-label", ariaLabel\)/);
  assert.match(
    globalCounter[1],
    /appendGameStatsLeaderboardMetric\(displayValue, value, \{[\s\S]*?decorative: true,[\s\S]*?fillWidth: true,[\s\S]*?\}\);/,
    "Only shared global aggregate counters should opt into zero-fill mode"
  );
  assert.match(
    main,
    /const appendGameStatsLeaderboardMetric = \([\s\S]*?\{ decorative = false, fillWidth = false \} = \{\}[\s\S]*?\{ decorative, fillWidth \}/,
    "The shared metric helper should forward fill mode to the digit renderer"
  );
  assert.match(minesweeperStat[1], /globalCounter = false/);
  assert.match(minesweeperStat[1], /createGameStatsGlobalCounterValue\(/);
  assert.match(main, /const appendSolitaireGlobalWins = \([\s\S]*?createGameStatsGlobalCounterValue\(/);
  assert.match(main, /const appendSnakeTotalGames = \([\s\S]*?createGameStatsGlobalCounterValue\(/);
  assert.match(main, /const appendSudokuTotalGames = \([\s\S]*?createGameStatsGlobalCounterValue\(/);
  assert.match(
    styles,
    /\.game-stats-global-counter-value \.game-stats-digit-strip \{[\s\S]*?box-sizing: border-box;[\s\S]*?height: 22px;[\s\S]*?justify-content: center;[\s\S]*?min-width: 0;[\s\S]*?overflow: hidden;[\s\S]*?width: 100%;/
  );
  assert.match(
    styles,
    /\.game-stats-global-counter-value \{[\s\S]*?align-self: stretch;[\s\S]*?min-width: 0;[\s\S]*?width: 100%;/
  );
  assert.match(
    styles,
    /\.game-stats-global-counter-value \.game-stats-digit-strip img \{[\s\S]*?flex: 0 0 auto;[\s\S]*?height: 18px;[\s\S]*?width: min\([\s\S]*?var\(--game-stats-digit-count, 1\)/
  );
});
