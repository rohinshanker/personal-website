import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { plain, sourceBetween } from "./helpers/source-runtime.mjs";

const root = new URL("../", import.meta.url);

test("Game Stats keeps the Worker wiring and one independently managed window per game", async () => {
  const [homeSource, indexSource, gameStatsSource] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readHomeScript("gameStats"),
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
  assert.match(homeSource, /src="scripts\/home\/game-stats-backend\.js\?v=[^"]+"/);
  assert.doesNotMatch(homeSource, /game-stats-global\.js/);
  assert.doesNotMatch(homeSource, /game-stats-export|game-stats-pending-count/);
  assert.match(indexSource, /game-stats-backend\.js/);
  assert.doesNotMatch(indexSource, /game-stats-global\.js/);
  assert.ok(
    homeSource.indexOf("scripts/home/game-stats-backend.js") <
      homeSource.indexOf("scripts/home/main.js")
  );
  assert.match(
    gameStatsSource,
    /registerViewportObserver\(\{[\s\S]*?onFrame: \(\) => \{[\s\S]*?positionVisibleGameStatsWindows\(\);/
  );
});

test("the production viewport pass positions every visible Game Stats window", async () => {
  const source = await readHomeScript("gameStats");
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const calls = [];",
      "const makeWindow = (name, width, height, titleBarHeight, classes = []) => { const classNames = new Set(classes); return { name, offsetWidth: width, offsetHeight: height, classList: { contains: (value) => classNames.has(value), replace(values) { classNames.clear(); values.forEach((value) => classNames.add(value)); } }, querySelector: () => ({ offsetHeight: titleBarHeight }) }; };",
      "const windowsByGame = new Map([['minesweeper', makeWindow('minesweeper', 200, 100, 20)], ['solitaire', makeWindow('solitaire', 220, 110, 30)], ['snake', makeWindow('snake', 210, 120, 25, ['is-hidden'])], ['sudoku', makeWindow('sudoku', 190, 90, 22, ['is-closing'])]]);",
      "const GAME_STATS_SUPPORTED_GAMES = [...windowsByGame.keys()];",
      "const getGameStatsWindowParts = (game) => ({ windowElement: windowsByGame.get(game) });",
      "const clampWindowFullyIntoViewport = (windowElement) => calls.push(['clamp', windowElement.name]);",
      "const setWindowTitleBarClampedPosition = (windowElement, left, top) => calls.push(['position', windowElement.name, left, top]);",
      "const window = { innerWidth: 600 };",
      sourceBetween(
        source,
        "const positionVisibleGameStatsWindows =",
        "\n\nconst openGameStatsWindow"
      ),
      "globalThis.position = positionVisibleGameStatsWindows;",
      "globalThis.setWidth = (value) => { window.innerWidth = value; };",
      "globalThis.setClasses = (game, values) => windowsByGame.get(game).classList.replace(values);",
      "globalThis.clearCalls = () => { calls.length = 0; };",
      "globalThis.readCalls = () => calls;",
    ].join("\n"),
    context
  );

  context.position();
  assert.deepEqual(plain(context.readCalls()), [
    ["position", "minesweeper", 24, 24],
    ["position", "solitaire", 356, 24],
  ]);

  context.clearCalls();
  context.setWidth(400);
  context.position();
  assert.deepEqual(plain(context.readCalls()), [
    ["position", "minesweeper", 24, 24],
    ["position", "solitaire", 24, 58],
  ]);

  context.clearCalls();
  context.setClasses("solitaire", ["is-hidden"]);
  context.position();
  assert.deepEqual(plain(context.readCalls()), [["clamp", "minesweeper"]]);
});
