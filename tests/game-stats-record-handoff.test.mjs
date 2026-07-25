import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

const createData = () => ({
  totals: {
    sudoku: {
      bestTimes: {
        easy: null,
        medium: null,
        hard: null,
        expert: null,
        master: null,
        extreme: null,
      },
    },
  },
  leaderboards: {
    minesweeper: { beginner: [], intermediate: [], expert: [] },
    snake: { 10: [], 16: [], 20: [], 24: [] },
    sudoku: { easy: [], medium: [], hard: [], expert: [], master: [], extreme: [] },
  },
  playerRecords: {
    minesweeper: { beginner: null, intermediate: null, expert: null },
    snake: { 10: null, 16: null, 20: null, 24: null },
    sudoku: {
      easy: null,
      medium: null,
      hard: null,
      expert: null,
      master: null,
      extreme: null,
    },
  },
});

const currentProfile = { id: "player-current" };

const createRecord = (metric, playerId = currentProfile.id) => ({
  playerId,
  metric,
});

const createEvent = (game, metric, category = "") => {
  if (game === "minesweeper") {
    return { game, metric, difficulty: category, profile: currentProfile };
  }
  if (game === "snake") {
    return { game, metric, boardSize: category, profile: currentProfile };
  }
  if (game === "sudoku") {
    return {
      game,
      metric,
      difficulty: category,
      hintBucket: "noHints",
      profile: currentProfile,
    };
  }
  return { game, metric, profile: currentProfile };
};

const loadRecordPredicate = async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const start = source.indexOf("const getGameStatsLeaderboardSpec =");
  const end = source.indexOf("\n\nconst gameStatsEventQualifiesForData", start);
  assert.ok(start >= 0 && end > start, "record predicate source must be extractable");
  const context = vm.createContext({});
  vm.runInContext(
    [
      source.slice(start, end),
      "globalThis.beatsPersonalRecord = gameStatsEventBeatsPersonalRecord;",
    ].join("\n"),
    context
  );
  return context.beatsPersonalRecord;
};

const loadRecordFlowHarness = async ({ savedProfile = true, applyResult = true } = {}) => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const start = source.indexOf("const recordGameStatsEvent =");
  const end = source.indexOf("\n\nconst formatGameStatsCounter", start);
  assert.ok(start >= 0 && end > start, "record flow source must be extractable");
  const context = vm.createContext({});
  vm.runInContext(
    [
      `let gameStatsProfile = ${
        savedProfile
          ? '{ id: "player-current", name: "Current", icon: "assets/app-icons/ico/user_card.ico" }'
          : "null"
      };`,
      "let gameStatsLocalResetGeneration = 0;",
      "const gameStatsLocalState = {};",
      "const gameStatsGlobalState = {};",
      `let applyResult = ${applyResult};`,
      "let applyCalls = 0;",
      "let saveCalls = 0;",
      "let handoffCalls = 0;",
      "let queueCalls = 0;",
      "let syncCalls = 0;",
      "let resolveSession;",
      "let resolveProfile;",
      "const pendingSession = new Promise((resolve) => { resolveSession = resolve; });",
      "const pendingProfile = new Promise((resolve) => { resolveProfile = resolve; });",
      "const normalizeGameStatsEvent = (event) => event ? { ...event } : null;",
      "const normalizeGameStatsEventProfile = (profile) => profile ? { ...profile } : null;",
      "const gameStatsEventBeatsPersonalRecord = () => true;",
      "const gameStatsEventQualifiesForLeaderboard = () => false;",
      "const requestGameStatsProfile = () => pendingProfile;",
      "const applyGameStatsEventToData = () => { applyCalls += 1; return applyResult; };",
      "const updateGameStatsSudokuBestTime = () => {};",
      "const saveGameStatsLocalState = () => { saveCalls += 1; };",
      "const playGameStatsRecordHandoff = async () => { handoffCalls += 1; };",
      "const getGameStatsSession = () => pendingSession;",
      "const queueGameStatsSubmission = () => { queueCalls += 1; };",
      'let gameStatsSyncState = "ready";',
      "const setGameStatsSyncState = () => {};",
      "const syncQueuedGameStats = () => { syncCalls += 1; };",
      source.slice(start, end),
      "globalThis.recordForTest = recordGameStatsEvent;",
      "globalThis.readFlowState = () => ({ applyCalls, saveCalls, handoffCalls, queueCalls, syncCalls });",
      "globalThis.resolveSessionForTest = () => resolveSession(null);",
      'globalThis.cancelProfileForTest = () => { gameStatsLocalResetGeneration += 1; resolveProfile({ id: "player-current", name: "Current", icon: "assets/app-icons/ico/user_card.ico" }); };',
    ].join("\n"),
    context
  );
  return context;
};

test("Minesweeper records are strict, per difficulty, and player-scoped", async () => {
  const beatsPersonalRecord = await loadRecordPredicate();
  const localData = createData();
  const globalData = createData();
  const event = createEvent("minesweeper", 42, "beginner");

  assert.equal(beatsPersonalRecord(localData, globalData, event), true);

  localData.playerRecords.minesweeper.beginner = createRecord(43);
  assert.equal(beatsPersonalRecord(localData, globalData, event), true);
  localData.playerRecords.minesweeper.beginner = createRecord(42);
  assert.equal(beatsPersonalRecord(localData, globalData, event), false);
  localData.playerRecords.minesweeper.beginner = createRecord(41);
  assert.equal(beatsPersonalRecord(localData, globalData, event), false);

  localData.playerRecords.minesweeper.beginner = null;
  localData.leaderboards.minesweeper.beginner = [createRecord(40)];
  globalData.playerRecords.minesweeper.beginner = createRecord(45);
  assert.equal(
    beatsPersonalRecord(localData, globalData, createEvent("minesweeper", 41, "beginner")),
    false,
    "a result must beat the best known local and global record"
  );

  localData.leaderboards.minesweeper.beginner = [];
  globalData.playerRecords.minesweeper.beginner = createRecord(1, "player-other");
  localData.playerRecords.minesweeper.expert = createRecord(1);
  assert.equal(
    beatsPersonalRecord(localData, globalData, createEvent("minesweeper", 999, "beginner")),
    true,
    "other players and other difficulties must not suppress an empty record"
  );
});

test("Snake records preserve the empty-score distinction and compare per board size", async () => {
  const beatsPersonalRecord = await loadRecordPredicate();
  const localData = createData();
  const globalData = createData();
  const emptyScore = createEvent("snake", 0, "10");

  assert.equal(
    beatsPersonalRecord(localData, globalData, emptyScore, {
      snakePreviousHighScore: null,
    }),
    true,
    "a first completed Snake game is a record even when its score is zero"
  );
  assert.equal(
    beatsPersonalRecord(localData, globalData, emptyScore, {
      snakePreviousHighScore: 0,
    }),
    false,
    "a stored zero is a real prior record, not an empty sentinel"
  );

  for (const [metric, expected] of [
    [8, false],
    [9, false],
    [10, true],
  ]) {
    assert.equal(
      beatsPersonalRecord(localData, globalData, createEvent("snake", metric, "10"), {
        snakePreviousHighScore: 9,
      }),
      expected
    );
  }

  localData.playerRecords.snake["10"] = createRecord(12);
  globalData.playerRecords.snake["10"] = createRecord(10);
  assert.equal(
    beatsPersonalRecord(localData, globalData, createEvent("snake", 11, "10"), {
      snakePreviousHighScore: 9,
    }),
    false
  );
  assert.equal(
    beatsPersonalRecord(localData, globalData, createEvent("snake", 13, "10"), {
      snakePreviousHighScore: 9,
    }),
    true
  );

  localData.playerRecords.snake["10"] = null;
  globalData.playerRecords.snake["10"] = null;
  localData.playerRecords.snake["16"] = createRecord(100);
  assert.equal(
    beatsPersonalRecord(localData, globalData, createEvent("snake", 1, "10"), {
      snakePreviousHighScore: null,
    }),
    true
  );
});

test("Sudoku records are strict, no-hints only, and per difficulty", async () => {
  const beatsPersonalRecord = await loadRecordPredicate();
  const localData = createData();
  const globalData = createData();
  const event = createEvent("sudoku", 120, "easy");

  assert.equal(beatsPersonalRecord(localData, globalData, event), true);

  localData.totals.sudoku.bestTimes.easy = 121;
  assert.equal(beatsPersonalRecord(localData, globalData, event), true);
  localData.totals.sudoku.bestTimes.easy = 120;
  assert.equal(beatsPersonalRecord(localData, globalData, event), false);
  localData.totals.sudoku.bestTimes.easy = 119;
  assert.equal(beatsPersonalRecord(localData, globalData, event), false);

  localData.totals.sudoku.bestTimes.easy = null;
  localData.playerRecords.sudoku.easy = createRecord(110);
  globalData.playerRecords.sudoku.easy = createRecord(130);
  assert.equal(
    beatsPersonalRecord(localData, globalData, createEvent("sudoku", 115, "easy")),
    false
  );
  assert.equal(
    beatsPersonalRecord(localData, globalData, createEvent("sudoku", 109, "easy")),
    true
  );

  localData.playerRecords.sudoku.easy = null;
  globalData.playerRecords.sudoku.easy = null;
  localData.totals.sudoku.bestTimes.hard = 10;
  assert.equal(beatsPersonalRecord(localData, globalData, event), true);
  assert.equal(
    beatsPersonalRecord(localData, globalData, {
      ...event,
      hintBucket: "withHints",
    }),
    false
  );
});

test("Solitaire and invalid metrics never trigger the record handoff", async () => {
  const beatsPersonalRecord = await loadRecordPredicate();
  const localData = createData();
  const globalData = createData();

  assert.equal(
    beatsPersonalRecord(localData, globalData, createEvent("solitaire", 1)),
    false
  );
  assert.equal(
    beatsPersonalRecord(
      localData,
      globalData,
      createEvent("minesweeper", Number.NaN, "beginner")
    ),
    false
  );
});

test("overlapping records serialize their leaderboard handoffs without dropping either", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const start = source.indexOf("const playGameStatsRecordHandoff =");
  const end = source.indexOf("\n\nconst getGameStatsSyncStateDefinition", start);
  assert.ok(start >= 0 && end > start, "handoff source must be extractable");
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const GAME_STATS_RECORD_TROPHY_PRESS_COUNT = 2;",
      "const GAME_STATS_RECORD_TROPHY_PRESS_MS = 120;",
      "const GAME_STATS_RECORD_TROPHY_RELEASE_MS = 100;",
      "const createButton = (game) => ({ getAttribute: () => game, classList: { add() {}, remove() {}, contains() { return false; } } });",
      'const gameStatsOpenButtons = [createButton("minesweeper"), createButton("snake")];',
      "const window = { matchMedia: () => ({ matches: false }) };",
      "const waitForGameStatsTrophyState = async () => { await Promise.resolve(); };",
      "const openedGames = [];",
      "const openGameStatsWindow = (game) => { openedGames.push(game); };",
      "let gameStatsRecordHandoffQueue = Promise.resolve();",
      source.slice(start, end),
      "globalThis.playForTest = playGameStatsRecordHandoff;",
      "globalThis.readOpenedGames = () => [...openedGames];",
    ].join("\n"),
    context
  );

  await Promise.all([
    context.playForTest("minesweeper"),
    context.playForTest("snake"),
  ]);
  assert.deepEqual(
    Array.from(context.readOpenedGames()),
    ["minesweeper", "snake"]
  );
});

test("a record handoff starts after local save without waiting for its session", async () => {
  const context = await loadRecordFlowHarness();
  const recordPromise = context.recordForTest({
    id: "event-pending-session",
    game: "minesweeper",
    type: "win",
    metric: 40,
  });

  assert.deepEqual(
    { ...context.readFlowState() },
    {
      applyCalls: 1,
      saveCalls: 1,
      handoffCalls: 1,
      queueCalls: 0,
      syncCalls: 0,
    }
  );

  context.resolveSessionForTest();
  await recordPromise;
  assert.deepEqual(
    { ...context.readFlowState() },
    {
      applyCalls: 1,
      saveCalls: 1,
      handoffCalls: 1,
      queueCalls: 1,
      syncCalls: 1,
    }
  );
});

test("duplicate and reset-cancelled records never open a leaderboard", async () => {
  const duplicateContext = await loadRecordFlowHarness({ applyResult: false });
  await duplicateContext.recordForTest({
    id: "event-duplicate",
    game: "minesweeper",
    type: "win",
    metric: 40,
  });
  assert.deepEqual(
    { ...duplicateContext.readFlowState() },
    {
      applyCalls: 1,
      saveCalls: 0,
      handoffCalls: 0,
      queueCalls: 0,
      syncCalls: 0,
    }
  );

  const cancelledContext = await loadRecordFlowHarness({ savedProfile: false });
  const cancelledPromise = cancelledContext.recordForTest({
    id: "event-reset-cancelled",
    game: "snake",
    type: "gamePlayed",
    metric: 1,
  });
  cancelledContext.cancelProfileForTest();
  await cancelledPromise;
  assert.deepEqual(
    { ...cancelledContext.readFlowState() },
    {
      applyCalls: 0,
      saveCalls: 0,
      handoffCalls: 0,
      queueCalls: 0,
      syncCalls: 0,
    }
  );
});
