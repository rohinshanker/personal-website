import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("game stats use the Cloudflare backend instead of static export data", async () => {
  const [homeSource, indexSource, domSource, mainSource, cssSource] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);

  for (const game of ["minesweeper", "solitaire", "snake", "sudoku"]) {
    assert.match(homeSource, new RegExp(`data-game-stats-open="${game}"`));
    assert.match(homeSource, new RegExp(`id="game-stats-window-${game}"`));
    assert.match(homeSource, new RegExp(`data-app-window="game-stats-${game}"`));
    assert.match(homeSource, new RegExp(`data-game-stats-window="${game}"`));
    assert.match(homeSource, new RegExp(`data-close="game-stats-${game}"`));
  }

  assert.match(homeSource, /data-game-stats-sync-status/);
  assert.match(homeSource, /data-game-stats-content/);
  assert.match(homeSource, /scripts\/home\/game-stats-backend\.js/);
  assert.doesNotMatch(homeSource, /game-stats-global\.js/);
  assert.doesNotMatch(homeSource, /game-stats-export|game-stats-pending-count/);
  assert.match(indexSource, /game-stats-backend\.js/);
  assert.doesNotMatch(indexSource, /game-stats-global\.js/);
  assert.ok(
    homeSource.indexOf("scripts/home/game-stats-backend.js") <
      homeSource.indexOf("scripts/home/main.js")
  );
  assert.match(domSource, /gameStatsWindows: all\("\[data-game-stats-window\]"\)/);
  assert.doesNotMatch(domSource, /gameStatsExport|gameStatsPendingCount/);
  assert.match(cssSource, /\.game-stats-sync-status/);
  assert.doesNotMatch(cssSource, /\.game-stats-toolbar/);

  assert.match(mainSource, /fetchGameStatsApi\("\/sessions"/);
  assert.match(mainSource, /fetchGameStatsApi\("\/events"/);
  assert.match(
    mainSource,
    /const statsPath = playerId \? `\/stats\?playerId=\$\{encodeURIComponent\(playerId\)\}` : "\/stats";/
  );
  assert.match(mainSource, /fetchGameStatsApi\(statsPath/);
  assert.match(mainSource, /const createGameStatsPlayerName = \(value/);
  assert.match(mainSource, /const updateGameStatsPlayerNameMarquees/);
  assert.match(mainSource, /window\.addEventListener\("resize", scheduleGameStatsPlayerNameMarquees\)/);
  assert.match(mainSource, /const getGameStatsWindowParts = \(game\)/);
  assert.match(mainSource, /const renderGameStatsWindows = \(\)/);
  assert.match(mainSource, /setWindowOpen\(`game-stats-\$\{game\}`, true\)/);
  assert.doesNotMatch(mainSource, /\bgameStatsCurrentGame\b/);
  assert.match(mainSource, /buildVersion: gameStatsBackend\.buildVersion/);
  assert.match(mainSource, /session: \{[\s\S]*?id: submission\.session\.id/);
  assert.doesNotMatch(mainSource, /rohinGameStatsGlobal|exportPendingGameStats|GAME_STATS_EXPORT_SOURCE/);
});

test("Game Stats keeps one independently managed window for every game", async () => {
  const [homeSource, mainSource] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
  ]);

  for (const game of ["minesweeper", "solitaire", "snake", "sudoku"]) {
    assert.match(
      homeSource,
      new RegExp(
        `data-app-window="game-stats-${game}"[\\s\\S]*?data-game-stats-window="${game}"`
      )
    );
  }
  assert.match(
    mainSource,
    /GAME_STATS_SUPPORTED_GAMES\.forEach\(\(game\) => \{[\s\S]*?renderGameStatsWindow\(game\)/
  );
  assert.match(
    mainSource,
    /const openGameStatsWindow = \(game\) => \{[\s\S]*?setWindowOpen\(`game-stats-\$\{game\}`, true\)[\s\S]*?renderGameStatsWindow\(game\)/
  );
  assert.match(mainSource, /const scheduleGameStatsWindowViewportClamp = \(windowElement\)/);
  assert.match(
    mainSource,
    /const scheduleGameStatsWindowViewportClamp = \(windowElement\) => \{[\s\S]*?gameStatsViewportClampScheduled[\s\S]*?windowElement\.classList\.contains\("is-opening"\)[\s\S]*?event\.animationName !== "retro-window-open"[\s\S]*?addEventListener\("animationend", onAnimationEnd\)/
  );
  assert.match(mainSource, /const clampAfterOpening = \(\) => \{[\s\S]*?clampWindowFullyIntoViewport\(windowElement\);/);
  assert.match(
    mainSource,
    /const openGameStatsWindow = \(game\) => \{[\s\S]*?renderGameStatsWindow\(game\);[\s\S]*?scheduleGameStatsWindowViewportClamp\(windowParts\?\.windowElement\);/
  );
  assert.match(
    mainSource,
    /const openGameStatsWindow = \(game\) => \{[\s\S]*?renderGameStatsWindow\(game\);\s*if \(!wasVisible\) positionNewGameStatsWindow\(game, windowParts\?\.windowElement\);/
  );
  assert.match(mainSource, /const positionVisibleGameStatsWindows = \(\)/);
  assert.match(
    mainSource,
    /if \(visibleWindows\.length < 2\) \{[\s\S]*?clampWindowFullyIntoViewport\(windowElement\)/
  );
  assert.match(mainSource, /window\.addEventListener\("resize", \(\) => \{\s*requestAnimationFrame\(positionVisibleGameStatsWindows\)/);
  assert.match(mainSource, /if \(!wasVisible\) positionNewGameStatsWindow\(game, windowParts\?\.windowElement\)/);
});

test("each supported game opens a verified session before emitting a completion event", async () => {
  const mainSource = await readFile(new URL("scripts/home/main.js", root), "utf8");

  assert.match(
    mainSource,
    /const msStartTimer[\s\S]*?startGameStatsSession\("minesweeper", \{[\s\S]*?difficulty:/
  );
  assert.match(
    mainSource,
    /const ensureSolitaireStatsSession[\s\S]*?startGameStatsSession\("solitaire", \{\}\)/
  );
  assert.match(
    mainSource,
    /const startSnakeGame[\s\S]*?startGameStatsSession\("snake", \{[\s\S]*?boardSize:/
  );
  assert.match(
    mainSource,
    /const startSudokuTimer[\s\S]*?startGameStatsSession\("sudoku", \{[\s\S]*?difficulty:/
  );
  assert.match(
    mainSource,
    /const checkSudokuBoard[\s\S]*?const elapsedSeconds = currentSudokuElapsedSeconds\(\);[\s\S]*?metric: elapsedSeconds,[\s\S]*?metricKind: "seconds"/
  );

  for (const game of ["minesweeper", "solitaire", "snake", "sudoku"]) {
    assert.match(
      mainSource,
      new RegExp(`game: "${game}",[\\s\\S]{0,260}?statsSession`)
    );
  }
});

test("a player's first local win presses the matching trophy twice before opening stats", async () => {
  const [mainSource, styleSource] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("style.css", root), "utf8"),
  ]);

  assert.match(mainSource, /const GAME_STATS_FIRST_WIN_TROPHY_PRESS_COUNT = 2;/);
  assert.match(
    mainSource,
    /const isGameStatsFirstLocalWin = \(event\) =>\s*event\.type === "win" && gameStatsLocalWinCount\(gameStatsLocalState\) === 0;/
  );
  assert.match(
    mainSource,
    /const isFirstLocalWin = isGameStatsFirstLocalWin\(event\);[\s\S]*?const applied = applyGameStatsEventToData/
  );
  assert.match(
    mainSource,
    /Array\.from\(gameStatsOpenButtons\)\.find\([\s\S]*?data-game-stats-open"\) === game/
  );
  assert.match(
    mainSource,
    /for \(let press = 0; press < GAME_STATS_FIRST_WIN_TROPHY_PRESS_COUNT; press \+= 1\)[\s\S]*?classList\.add\("is-pressed"\)[\s\S]*?classList\.remove\("is-pressed"\)/
  );
  assert.match(
    mainSource,
    /if \(isFirstLocalWin\) await playFirstGameStatsTrophyHandoff\(event\.game\);/
  );
  assert.match(
    mainSource,
    /const playFirstGameStatsTrophyHandoff[\s\S]*?openGameStatsWindow\(game\);/
  );
  assert.match(
    styleSource,
    /\.title-bar-controls \.game-stats-title-control\.is-pressed \{[\s\S]*?var\(--border-sunken-outer\)/
  );
});
