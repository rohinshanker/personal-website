import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { plain, sourceBetween } from "./helpers/source-runtime.mjs";

/**
 * Solitaire's startup cost and its toolbar both hang off state the production
 * code owns, so these run the production declarations themselves: the deal
 * happens on the first open rather than at load, and the auto-solve plan behind
 * the toolbar is reused only while the board it was planned for is unchanged.
 */

const SUITS = ["spades", "clubs", "diamonds", "hearts"];

const source = await readHomeScript("solitaire");

/** A toolbar control reduced to what `solRenderToolbar` actually touches. */
const createControl = () => {
  const attributes = new Map();
  const classes = new Set();
  return {
    hidden: false,
    disabled: false,
    attributes,
    classes,
    classList: {
      contains: (name) => classes.has(name),
      toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)),
    },
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    setAttribute: (name, value) => attributes.set(name, value),
  };
};

const emptyFoundations = () => Object.fromEntries(SUITS.map((suit) => [suit, []]));

const card = (suit, rank, faceUp = true) => ({ id: `${suit}-${rank}`, suit, rank, faceUp });

/**
 * Runs the real signature, plan cache, availability check and toolbar against a
 * counting planner, so "the plan was reused" is observed rather than read.
 */
const createToolbarHarness = () => {
  const reset = createControl();
  const autoSolve = createControl();
  const undo = createControl();
  const context = vm.createContext({ reset, autoSolve, undo, plans: 0 });
  vm.runInContext(
    [
      `const solSuitOrder = ${JSON.stringify(SUITS)};`,
      "const solReset = reset;",
      "const solAutoSolve = autoSolve;",
      "const solUndo = undo;",
      "let solAutoSolveRun = null;",
      "let plannedResult = { moves: [], completes: false };",
      "let solGame = { undo: [] };",
      'let solGameSignature = "";',
      "const SOLITAIRE_MOVE_WORK = 1024;",
      "const createBudget = () => ({ spend: () => {} });",
      "const solStats = { dropSession: () => {} };",
      `const solRules = {
         planAutoSolveBoard: () => { plans += 1; return plannedResult; },
         fromBoard: () => solGame,
         toBoard: () => solState,
       };`,
      `const solState = {
         stock: [],
         waste: [],
         tableau: Array.from({ length: 7 }, () => []),
         foundations: Object.fromEntries(solSuitOrder.map((suit) => [suit, []])),
         selected: null,
         moves: 0,
         won: false,
       };`,
      sourceBetween(source, "const solSetAttribute =", "\nconst solSetText"),
      sourceBetween(source, "const solAutoSolveSignature =", "\n\nconst solPresentationRunSuits"),
      sourceBetween(source, "const solRenderToolbar = () => {", "\n\n/**\n * Announces a victory"),
      `globalThis.harness = {
         state: solState,
         history: solGame.undo,
         plan: (plan) => { plannedResult = plan; },
         run: (run) => { solAutoSolveRun = run; },
         renderToolbar: () => solRenderToolbar(),
         canAutoSolve: () => solCanAutoSolve(solState),
         cachedPlan: () => solCachedAutoSolvePlan(solState),
         signature: () => solAutoSolveSignature(solState),
       };`,
    ].join("\n"),
    context
  );
  return {
    ...context.harness,
    reset,
    autoSolve,
    undo,
    plans: () => context.plans,
  };
};

/**
 * Runs the real New Game, presentation staging, first-open guard and lifecycle
 * registration together, so the startup contract is exercised end to end with
 * only the deal generator and the renderer stubbed out.
 */
const createOpenHarness = () => {
  const context = vm.createContext({
    deals: 0, renders: 0, calls: [], hooks: null, issued: [], issueCalls: [],
  });
  vm.runInContext(
    [
      `const solSuitOrder = ${JSON.stringify(SUITS)};`,
      "let solBoardReady = false;",
      "let solLastCardClick = { key: 'stale', time: 1 };",
      "let solAutoSolveRun = null;",
      "let solGame = null;",
      'let solGameSignature = "";',
      "const SOLITAIRE_MOVE_WORK = 1024;",
      "const createBudget = () => ({ spend: () => {} });",
      "const solState = { presentation: { visualEffects: true }, statsSession: 'stale-session' };",
      // The rules are stood in for here so the harness can deal one-card boards:
      // what this test watches is the order the controller does things in, and
      // tests/solitaire-rules.test.mjs holds the engine itself to account.
      `const solRules = {
         fromBoard: (board) => ({ board, moves: 0, undo: [] }),
         toBoard: (game) => game.board,
         initial: (raw) => { issued.push(raw); return { board: raw, moves: 0, undo: [] }; },
       };`,
      "const ensureSolitaireStatsSession = () => calls.push('ensure-session');",
      "const solCheckWin = () => {};",
      `const solBuildWinnableDeal = () => {
         deals += 1;
         return {
           stock: [{ id: 'dealt-stock-' + deals }],
           tableau: [[{ id: 'dealt-tableau-' + deals }]],
           solution: [{ type: 'toFoundation' }],
           verified: true,
         };
       };`,
      "const solBuildPresentationTableau = () => [['staged']];",
      `const solStats = {
         dropSession: () => { solState.statsSession = ''; },
         hasIssuedGame: () => Boolean(solState.statsSession) && issuedAlready,
         resumeGame: () => { calls.push('resume'); return Promise.resolve(null); },
         issueGame: (config) => {
           issueCalls.push(config);
           return new Promise((resolve) => { issueResolvers.push(resolve); });
         },
       };`,
      "let issuedAlready = false;",
      "const issueResolvers = [];",
      "const solCancelAutoSolve = () => calls.push('cancel');",
      "const solHideVictoryVideo = () => calls.push('hide-video');",
      "const solRender = () => { renders += 1; };",
      "const registerWindowLifecycle = (appId, lifecycle) => { hooks = { appId, lifecycle }; };",
      sourceBetween(source, "const solAutoSolveSignature =", "\n\nconst solPresentationRunSuits"),
      sourceBetween(source, "/** Invalidated by every new board", "\n\n/**\n * The double-click shortcut"),
      sourceBetween(
        source,
        'registerWindowLifecycle("solitaire", {',
        "\n\nwindow.homeSolitaire = Object.freeze({"
      ),
      `globalThis.harness = {
         state: solState,
         ensureBoard: () => solEnsureBoard(),
         stagePresentation: (options) => solStagePresentationWin(options),
         newGame: () => solNewGame(),
         ready: () => solBoardReady,
         undoDepth: () => solGame.undo.length,
         resolveIssued: (index, descriptor) => issueResolvers[index](descriptor),
         play: () => { solGame.moves += 1; },
       };`,
    ].join("\n"),
    context
  );
  return {
    ...context.harness,
    lifecycle: () => context.hooks,
    deals: () => context.deals,
    renders: () => context.renders,
    calls: () => context.calls,
    issued: () => context.issued,
    issueCalls: () => context.issueCalls,
  };
};

test("nothing deals the board while Home starts up", () => {
  assert.doesNotMatch(
    source,
    /^solNewGame\(\);$/m,
    "A top-level New Game would generate a solver-checked deal for every visitor."
  );
  assert.doesNotMatch(
    source,
    /^solBuildWinnableDeal\(\);$/m,
    "Deal generation belongs to New Game, which only the first open may call."
  );
  assert.doesNotMatch(
    source,
    /^startGameStatsSession\(/m,
    "A Game Stats session must wait for a real move."
  );
});

test("the window lifecycle deals before the open and tears a run down on close", () => {
  const harness = createOpenHarness();
  const { appId, lifecycle } = harness.lifecycle();

  assert.equal(appId, "solitaire");
  assert.equal(harness.deals(), 0, "Registering the lifecycle must not deal.");
  // The manager measures the window to place it, so the deal has to land in
  // `beforeOpen`; dealing after the window is shown would place Solitaire as
  // though its board were empty.
  assert.equal(typeof lifecycle.beforeOpen, "function");
  assert.equal(lifecycle.onOpen, undefined);

  lifecycle.beforeOpen();
  assert.equal(harness.deals(), 1);
  assert.equal(harness.ready(), true);

  const beforeClose = harness.calls().length;
  lifecycle.onClose();
  assert.deepEqual(
    harness.calls().slice(beforeClose),
    ["cancel", "hide-video"],
    "Closing cancels a run in flight and takes the victory video down with it."
  );

  lifecycle.beforeOpen();
  assert.equal(harness.deals(), 1, "Reopening keeps the board the player left.");
});

test("the first open deals once, later opens keep the board, and Reset redeals", () => {
  const harness = createOpenHarness();

  assert.equal(harness.ensureBoard(), true, "The first open owns the deal.");
  assert.equal(harness.deals(), 1);
  const firstStock = harness.state.stock;
  assert.deepEqual(plain(firstStock), [{ id: "dealt-stock-1" }]);
  assert.equal(harness.state.presentation, null, "A real deal clears any staged board.");
  assert.equal(harness.state.statsSession, "", "A fresh deal carries no stats session.");
  assert.equal(harness.undoDepth(), 0, "A fresh deal cannot be undone into the old one.");
  assert.equal(harness.renders(), 1);

  assert.equal(harness.ensureBoard(), false, "Reopening must not touch the board.");
  assert.equal(harness.ensureBoard(), false);
  assert.equal(harness.deals(), 1);
  assert.equal(harness.state.stock, firstStock, "The reopened board is the same board.");
  assert.equal(harness.renders(), 1, "Reopening does not even re-render.");

  harness.newGame();
  assert.equal(harness.deals(), 2, "Reset generates a new winnable board.");
  assert.deepEqual(plain(harness.state.stock), [{ id: "dealt-stock-2" }]);
  assert.equal(harness.renders(), 2);
});

test("a presentation staged before the first open survives that open", () => {
  const harness = createOpenHarness();

  harness.stagePresentation({ visualEffects: false });
  assert.deepEqual(plain(harness.state.presentation), { visualEffects: false });
  assert.deepEqual(plain(harness.state.tableau), [["staged"]]);
  assert.equal(harness.ready(), true);

  assert.equal(harness.ensureBoard(), false, "Opening must not deal over the staged board.");
  assert.equal(harness.deals(), 0, "Staging a presentation never generates a deal.");
  assert.deepEqual(plain(harness.state.tableau), [["staged"]]);
  assert.deepEqual(plain(harness.state.presentation), { visualEffects: false });
  assert.equal(harness.state.statsSession, "", "A staged board stays unpublishable.");
});

test("a new board asks for verified issuance and adopts it while untouched", async () => {
  const harness = createOpenHarness();

  harness.newGame();
  assert.deepEqual(plain(harness.issueCalls()), [{}], "Dealing is what asks for a board.");
  assert.deepEqual(plain(harness.state.stock), [{ id: "dealt-stock-1" }]);

  harness.resolveIssued(0, { initial: { stock: ["issued"], tableau: [] } });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(
    plain(harness.issued()),
    [{ stock: ["issued"], tableau: [] }],
    "The descriptor's initial state goes through the engine, not around it."
  );
  assert.deepEqual(plain(harness.state.stock), ["issued"], "The issued board takes over.");
  assert.equal(harness.state.selected, null, "Adopting a board drops the old selection.");
});

test("a board that has been played on keeps itself and stays local", async () => {
  const harness = createOpenHarness();

  harness.newGame();
  harness.play();
  harness.resolveIssued(0, { initial: { stock: ["issued"], tableau: [] } });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(plain(harness.issued()), [], "A played board is never replaced.");
  assert.deepEqual(plain(harness.state.stock), [{ id: "dealt-stock-1" }]);
});

test("an issuance overtaken by a later deal is discarded", async () => {
  const harness = createOpenHarness();

  harness.newGame();
  harness.newGame();
  harness.resolveIssued(0, { initial: { stock: ["stale"], tableau: [] } });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(plain(harness.issued()), [], "The superseded board cannot land.");
  assert.deepEqual(plain(harness.state.stock), [{ id: "dealt-stock-2" }]);
});

test("a staged presentation board never asks for a verified board", () => {
  const harness = createOpenHarness();

  harness.stagePresentation({ visualEffects: true });
  assert.deepEqual(plain(harness.issueCalls()), [], "A promotional board is not a game.");
  assert.equal(harness.state.statsSession, "");
});

test("the toolbar offers the run only while a visible card fits a foundation", () => {
  const harness = createToolbarHarness();

  harness.plan({ moves: [], completes: false });
  harness.renderToolbar();
  assert.equal(harness.reset.hidden, false);
  assert.equal(harness.autoSolve.hidden, true);
  assert.equal(harness.autoSolve.disabled, false);
  assert.equal(harness.autoSolve.classList.contains("is-completing"), false);
  assert.equal(harness.autoSolve.getAttribute("aria-label"), "Auto-solve visible cards");
  assert.equal(harness.undo.disabled, true, "An empty history cannot be undone.");

  harness.state.waste = [card("spades", 1)];
  harness.plan({ moves: [{ zone: "waste", suit: "spades", rank: 1 }], completes: false });
  harness.renderToolbar();
  assert.equal(harness.reset.hidden, true, "The check takes Reset's place.");
  assert.equal(harness.autoSolve.hidden, false);
  assert.equal(harness.autoSolve.classList.contains("is-completing"), false);
  assert.equal(harness.autoSolve.getAttribute("aria-label"), "Auto-solve visible cards");

  harness.history.push({ snapshot: true });
  harness.state.waste = [card("spades", 1), card("hearts", 1)];
  harness.plan({ moves: [{ zone: "waste", suit: "hearts", rank: 1 }], completes: true });
  harness.renderToolbar();
  assert.equal(harness.autoSolve.classList.contains("is-completing"), true);
  assert.equal(harness.autoSolve.getAttribute("aria-label"), "Auto-solve and win the game");
  assert.equal(harness.undo.disabled, false);
});

test("a finished game and a running solve both close the toolbar's offer", () => {
  const harness = createToolbarHarness();
  harness.state.waste = [card("spades", 1)];
  harness.plan({ moves: [{ zone: "waste", suit: "spades", rank: 1 }], completes: true });
  harness.history.push({ snapshot: true });

  harness.run({ completes: true });
  harness.renderToolbar();
  assert.equal(harness.autoSolve.hidden, false, "A run keeps its own button on screen.");
  assert.equal(harness.autoSolve.disabled, true, "A running solve cannot be restarted.");
  assert.equal(harness.autoSolve.classList.contains("is-completing"), true);
  assert.equal(harness.reset.hidden, true);
  assert.equal(harness.undo.disabled, true, "A run is undone as one step, after it ends.");

  harness.run(null);
  harness.state.won = true;
  harness.renderToolbar();
  assert.equal(harness.autoSolve.hidden, true);
  assert.equal(harness.reset.hidden, false, "A won board offers Reset again.");
  assert.equal(harness.undo.disabled, true, "A win is final.");
  assert.equal(harness.autoSolve.classList.contains("is-completing"), false);
});

test("the toolbar never plans while a run is in flight or the game is won", () => {
  const harness = createToolbarHarness();
  harness.state.waste = [card("spades", 1)];
  harness.plan({ moves: [{ zone: "waste", suit: "spades", rank: 1 }], completes: true });

  harness.run({ completes: true });
  harness.renderToolbar();
  harness.renderToolbar();
  assert.equal(harness.plans(), 0, "A run already knows what it will finish.");

  harness.run(null);
  harness.state.won = true;
  harness.renderToolbar();
  assert.equal(harness.plans(), 0, "A won board has nothing left to plan.");
});

test("the plan is computed once per board and reused by every later read", () => {
  const harness = createToolbarHarness();
  harness.state.waste = [card("spades", 1)];
  harness.plan({ moves: [{ zone: "waste", suit: "spades", rank: 1 }], completes: false });

  const plan = harness.cachedPlan();
  assert.equal(harness.plans(), 1);
  assert.equal(harness.cachedPlan(), plan, "The same board returns the same plan.");
  assert.equal(harness.canAutoSolve(), true);
  harness.renderToolbar();
  harness.renderToolbar();
  assert.equal(harness.plans(), 1, "Twelve renders of one board plan once.");
});

test("every change a move can make to the board invalidates the cached plan", () => {
  // Each case stages a board, lets the cache settle, then applies the one
  // change a real move would make and asserts the plan is recomputed.
  const changes = [
    ["a card drawn to the waste", () => {}, (state) => {
      state.waste.push(card("hearts", 5));
    }],
    ["the waste reordered by a redeal", (state) => {
      state.waste.push(card("hearts", 5));
    }, (state) => {
      state.waste.reverse();
    }],
    ["the stock refilled", () => {}, (state) => {
      state.stock.push(card("clubs", 7, false));
    }],
    ["a card landing on a foundation", () => {}, (state) => {
      state.foundations.spades.push(card("spades", 1));
    }],
    ["a card moving between columns", () => {}, (state) => {
      state.tableau[3].push(card("clubs", 9));
    }],
    ["a face-down card flipping", (state) => {
      state.tableau[2].push(card("diamonds", 4, false));
    }, (state) => {
      state.tableau[2][0].faceUp = true;
    }],
    ["the game being won", () => {}, (state) => {
      state.won = true;
    }],
  ];

  changes.forEach(([label, stage, change]) => {
    const harness = createToolbarHarness();
    harness.state.waste = [card("spades", 1)];
    harness.plan({ moves: [{ zone: "waste", suit: "spades", rank: 1 }], completes: false });

    stage(harness.state);
    harness.cachedPlan();
    const before = harness.plans();
    const signature = harness.signature();

    change(harness.state);
    assert.notEqual(harness.signature(), signature, `${label} must change the signature.`);
    harness.cachedPlan();
    assert.equal(harness.plans(), before + 1, `${label} must force a replan.`);
    harness.cachedPlan();
    assert.equal(harness.plans(), before + 1, `${label} must then settle into the cache.`);
  });
});

test("a selection or a move count alone never forces a replan", () => {
  const harness = createToolbarHarness();
  harness.state.waste = [card("spades", 1)];
  harness.plan({ moves: [{ zone: "waste", suit: "spades", rank: 1 }], completes: false });
  harness.cachedPlan();

  harness.state.selected = { zone: "waste", pile: "waste", index: 0, cards: [card("spades", 1)] };
  harness.state.moves += 1;
  harness.renderToolbar();
  assert.equal(harness.plans(), 1, "Neither selection nor the counter can change the plan.");
});

test("a bridge that replaces the board wholesale still gets a fresh plan", () => {
  const harness = createToolbarHarness();
  harness.state.waste = [card("spades", 1)];
  harness.plan({ moves: [{ zone: "waste", suit: "spades", rank: 1 }], completes: false });
  assert.equal(harness.canAutoSolve(), true);
  assert.equal(harness.plans(), 1);

  // The browser fixtures stage boards by assigning straight onto `solState`.
  harness.state.waste = [];
  harness.state.tableau = [[card("hearts", 1)], [], [], [], [], [], []];
  harness.state.foundations = emptyFoundations();
  harness.plan({ moves: [{ zone: "tableau", suit: "hearts", rank: 1 }], completes: true });

  assert.equal(harness.cachedPlan().completes, true, "The staged board is planned fresh.");
  assert.equal(harness.plans(), 2);
  harness.renderToolbar();
  assert.equal(harness.autoSolve.getAttribute("aria-label"), "Auto-solve and win the game");
  assert.equal(harness.plans(), 2);
});


test("completed boards ignore stock input until Reset, as do active auto-solves", async () => {
  const source = await readHomeScript("solitaire");
  let click;
  let draws = 0;
  const state = { won: true };
  const context = vm.createContext({
    solState: state,
    solAutoSolveRun: null,
    solLastCardClick: null,
    solDraw: () => { draws += 1; },
    solBoard: {
      contains: () => true,
      addEventListener: (type, handler) => { click = handler; },
    },
  });
  vm.runInContext(sourceBetween(
    source,
    '  solBoard.addEventListener("click", (event) => {',
    '  solBoard.addEventListener("keydown", (event) => {'
  ), context);
  const event = { target: { closest: () => ({}) } };
  click(event);
  assert.equal(draws, 0);
  state.won = false;
  context.solAutoSolveRun = {};
  click(event);
  assert.equal(draws, 0);
  context.solAutoSolveRun = null;
  click(event);
  assert.equal(draws, 1);
});
