import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { plain, sourceBetween } from "./helpers/source-runtime.mjs";

const root = new URL("../", import.meta.url);

test("Game Stats keeps the Worker wiring and one independently managed window per game", async () => {
  const [homeSource, indexSource] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
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
});

test("the production record flow saves locally before its verified session and queues once", async () => {
  const source = await readHomeScript("gameStats");
  const context = vm.createContext({});
  vm.runInContext(
    [
      'let gameStatsProfile = { id: "player-1", name: "Player", icon: "player.ico" };',
      "let gameStatsLocalResetGeneration = 0;",
      "const gameStatsLocalState = {};",
      "const gameStatsGlobalState = {};",
      'let gameStatsSyncState = "ready";',
      "const calls = [];",
      "let resolveSession;",
      "const sessionPromise = new Promise((resolve) => { resolveSession = resolve; });",
      "const normalizeGameStatsEvent = (event) => event ? { ...event } : null;",
      "const normalizeGameStatsEventProfile = (profile) => ({ ...profile });",
      "const gameStatsEventBeatsPersonalRecord = () => true;",
      "const gameStatsEventQualifiesForLeaderboard = () => true;",
      "const requestGameStatsProfile = async () => gameStatsProfile;",
      "const applyGameStatsEventToData = () => { calls.push('apply'); return true; };",
      "const updateGameStatsSudokuBestTime = () => calls.push('best-time');",
      "const saveGameStatsLocalState = () => calls.push('save');",
      "const playGameStatsRecordHandoff = async () => calls.push('handoff');",
      "const getGameStatsSession = () => sessionPromise;",
      "const queueGameStatsSubmission = (event, session) => calls.push(['queue', event.id, session.id]);",
      "const setGameStatsSyncState = (state) => { gameStatsSyncState = state; calls.push(['state', state]); };",
      "const syncQueuedGameStats = () => calls.push('sync');",
      "const reportGameStatsSessionFailure = () => calls.push('session-failure');",
      sourceBetween(
        source,
        "const recordGameStatsEvent =",
        "\n\nconst formatGameStatsCounter"
      ),
      "globalThis.record = recordGameStatsEvent;",
      "globalThis.finishSession = () => resolveSession({ session: { id: 'session-1' } });",
      "globalThis.read = () => ({ calls, gameStatsSyncState });",
    ].join("\n"),
    context
  );

  const pending = context.record({
    id: "event-1",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 7,
  }, "pending-session");
  await Promise.resolve();
  assert.deepEqual(plain(context.read().calls), ["apply", "save", "handoff"]);

  context.finishSession();
  await pending;
  assert.deepEqual(plain(context.read()), {
    calls: [
      "apply",
      "save",
      "handoff",
      ["queue", "event-1", "session-1"],
      ["state", "publishing"],
      "sync",
    ],
    gameStatsSyncState: "publishing",
  });
});
