import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { plain, sourceBetween } from "./helpers/source-runtime.mjs";

const root = new URL("../", import.meta.url);

test("Solitaire keeps the victory media wired to an accessible overlay", async () => {
  const home = await readFile(new URL("home.html", root), "utf8");
  assert.match(
    home,
    /id="sol-victory-video-overlay" aria-hidden="true">[\s\S]*?id="sol-victory-video"[\s\S]*?data-src="assets\/solitaire-cards\/victory-royale\.webm"[\s\S]*?id="sol-victory-canvas" aria-hidden="true"/
  );
  assert.match(home, /href="styles\/home\/apps\/solitaire\.css\?v=[^"]+"/);
  assert.match(home, /src="scripts\/home\/features\/solitaire\.js\?v=[^"]+"/);
  await access(new URL("assets/solitaire-cards/victory-royale.webm", root));
});

const createVictoryHarness = async ({
  foundationCount = 52,
  presentation = null,
  won = false,
} = {}) => {
  const source = await readHomeScript("solitaire");
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const calls = [];",
      "const solSuitOrder = ['spades', 'clubs', 'diamonds', 'hearts'];",
      `const foundationCards = Array.from({ length: ${foundationCount} }, () => ({}));`,
      `const solState = { won: ${won}, moves: 17, statsSession: 'session-1', presentation: ${JSON.stringify(presentation)}, foundations: Object.fromEntries(solSuitOrder.map((suit, index) => [suit, foundationCards.slice(index * 13, (index + 1) * 13)])) };`,
      "const solStartFireworks = () => calls.push('fireworks');",
      "const solShowAchievement = () => calls.push('achievement');",
      "const solPlayVictoryVideo = () => calls.push('video');",
      "const createGameStatsEvent = (event) => event;",
      "const recorded = [];",
      "const solStats = { recordEvent: (event, options) => { recorded.push(options); calls.push(['record', { ...event, game: 'solitaire' }, solState.statsSession]); } };",
      "const notifyActivity = (name, detail) => calls.push(['activity', name, detail]);",
      // The engine owns the move count now, so the harness supplies one.
      "let solGame = { moves: 17 };",
      "const solRules = { result: (game) => ({ moves: game.moves }) };",
      "const solMoves = { text: '' };",
      "const formatSevenSegmentCounter = (value) => String(value);",
      "const setSevenSegmentCounter = (element, text) => { element.text = text; };",
      "const solProjectEngineGame = () => { solState.moves = solGame.moves; };",
      sourceBetween(source, "/**\n * The server derives the move count", "\n\nconst solCreateSlotMark"),
      sourceBetween(source, "const solCheckWin =", "\n\nconst solPrefersReducedMotion"),
      "globalThis.checkWin = solCheckWin;",
      "globalThis.read = () => ({ calls, won: solState.won });",
      "globalThis.official = (metric) => { recorded.at(-1).onCanonicalMetric({ metric }); return { counter: solMoves.text, moves: solState.moves }; };",
      "globalThis.replaceBoard = () => { solGame = { moves: 99 }; };",
    ].join("\n"),
    context
  );
  return context;
};

const createPresentationStageHarness = async () => {
  const source = await readHomeScript("solitaire");
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const calls = [];",
      "const solState = {};",
      "const solStats = { dropSession: () => { solState.statsSession = ''; } };",
      "const solAdoptStagedBoard = () => calls.push('adopt');",
      "let solLastCardClick = {};",
      "let solBoardReady = false;",
      "const solCancelAutoSolve = () => calls.push('cancel');",
      "const solBuildPresentationTableau = () => ['staged'];",
      "const solHideVictoryVideo = () => calls.push('hide-video');",
      "const solRender = () => calls.push('render');",
      sourceBetween(
        source,
        "const solStagePresentationWin =",
        "\n\n/** Deals once before first open"
      ),
      "globalThis.stage = solStagePresentationWin;",
      "globalThis.read = () => ({ boardReady: solBoardReady, calls, lastCardClick: solLastCardClick, state: solState });",
    ].join("\n"),
    context
  );
  return context;
};

test("an incomplete 51-card foundation cannot trigger victory", async () => {
  const context = await createVictoryHarness({ foundationCount: 51 });
  context.checkWin();
  assert.deepEqual(plain(context.read()), { calls: [], won: false });
});

test("the production win transition records and presents a victory exactly once", async () => {
  const context = await createVictoryHarness();
  context.checkWin();
  context.checkWin();
  assert.deepEqual(plain(context.read()), {
    calls: [
      "fireworks",
      "achievement",
      "video",
      [
        "record",
        { game: "solitaire", type: "win", metric: 17 },
        "session-1",
      ],
      ["activity", "gameWin", { game: "solitaire" }],
    ],
    won: true,
  });
});

test("the server's move count replaces the finished board's own, and only that board's", async () => {
  const context = await createVictoryHarness();
  context.checkWin();
  assert.deepEqual(plain(context.official(23)), { counter: "23", moves: 23 });

  // A reset, a redeal or an undone win all leave a different board on screen.
  const stale = await createVictoryHarness();
  stale.checkWin();
  stale.replaceBoard();
  assert.deepEqual(plain(stale.official(23)), { counter: "", moves: 17 });
});

test("presentation victories never publish gameplay with either effects setting", async () => {
  for (const [visualEffects, expectedCalls] of [
    [true, ["fireworks", "achievement", "video"]],
    [false, ["video"]],
  ]) {
    const context = await createVictoryHarness({ presentation: { visualEffects } });
    context.checkWin();
    context.checkWin();
    assert.deepEqual(plain(context.read()), { calls: expectedCalls, won: true });
  }
});

test("presentation staging enables visual effects by default and accepts an explicit opt-out", async () => {
  const defaultContext = await createPresentationStageHarness();
  defaultContext.stage();
  assert.deepEqual(plain(defaultContext.read()), {
    boardReady: true,
    calls: ["cancel", "adopt", "hide-video", "render"],
    lastCardClick: null,
    state: {
      presentation: { visualEffects: true },
      stock: [],
      waste: [],
      foundations: { spades: [], clubs: [], diamonds: [], hearts: [] },
      tableau: ["staged"],
      selected: null,
      moves: 0,
      won: false,
      statsSession: "",
    },
  });

  const optOutContext = await createPresentationStageHarness();
  optOutContext.stage({ visualEffects: false });
  assert.equal(optOutContext.read().state.presentation.visualEffects, false);
});
