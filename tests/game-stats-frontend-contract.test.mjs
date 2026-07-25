import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

const extractSource = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end).trim();
};

const jsonClone = (value) => JSON.parse(JSON.stringify(value));

const waitFor = async (predicate, message) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(message);
};

test("empty and normalized stats cover every player rank, record, and global Top 3", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const dataSource = extractSource(
    source,
    "const createGameStatsEmptyMinesweeperWins =",
    "\n\nconst createGameStatsEventId"
  );
  const context = vm.createContext({});

  vm.runInContext(
    [
      'const GAME_STATS_ROHIN_NEKO_AVATAR_ICON = "assets/neko-assets/sprites/yawn1.png";',
      "const GAME_STATS_MAX_NAME_REROLLS = 10;",
      'const GAME_STATS_DIFFICULTIES = Object.freeze(["beginner", "intermediate", "expert"]);',
      'const GAME_STATS_SUDOKU_DIFFICULTIES = Object.freeze(["easy", "medium", "hard", "expert", "master", "extreme"]);',
      'const GAME_STATS_SNAKE_BOARD_SIZES = Object.freeze(["10", "16", "20", "24"]);',
      'const GAME_STATS_HINT_BUCKETS = Object.freeze(["noHints", "withHints"]);',
      dataSource,
      "globalThis.createEmptyGameStatsDataForTest = createEmptyGameStatsData;",
      "globalThis.normalizeGameStatsDataForTest = normalizeGameStatsData;",
    ].join("\n"),
    context
  );

  const minesweeperDifficulties = ["beginner", "intermediate", "expert"];
  const snakeBoardSizes = ["10", "16", "20", "24"];
  const sudokuDifficulties = ["easy", "medium", "hard", "expert", "master", "extreme"];
  const currentPlayerId = "player-current-record";
  const icon = "assets/app-icons/ico/user_card.ico";
  const createEntry = (category, index, metric, playerId = `player-public-${index}`) => ({
    eventId: `event-${category}-${index}`,
    playerId,
    name: playerId === currentPlayerId ? "Current Player" : `Public ${index}`,
    icon,
    metric,
    metricKind: category.startsWith("snake") ? "score" : "seconds",
    occurredAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  });
  const ascendingTopFive = (category) =>
    Array.from({ length: 5 }, (_, index) => createEntry(category, index + 1, index + 10));
  const descendingTopFive = (category) =>
    Array.from({ length: 5 }, (_, index) => createEntry(category, index + 1, 50 - index));
  const playerRank = { rank: 7, totalPlayers: 12 };

  const empty = jsonClone(context.createEmptyGameStatsDataForTest());
  const normalizedEmpty = jsonClone(context.normalizeGameStatsDataForTest({}));
  for (const data of [empty, normalizedEmpty]) {
    for (const difficulty of minesweeperDifficulties) {
      assert.deepEqual(data.playerRanks.minesweeper[difficulty], {
        rank: null,
        totalPlayers: 0,
      });
      assert.equal(data.playerRecords.minesweeper[difficulty], null);
    }
    assert.deepEqual(data.playerRanks.solitaire, { rank: null, totalPlayers: 0 });
    assert.equal(data.playerRecords.solitaire, null);
    for (const size of snakeBoardSizes) {
      assert.deepEqual(data.playerRanks.snake[size], { rank: null, totalPlayers: 0 });
      assert.equal(data.playerRecords.snake[size], null);
    }
    for (const difficulty of sudokuDifficulties) {
      assert.deepEqual(data.playerRanks.sudoku[difficulty], {
        rank: null,
        totalPlayers: 0,
      });
      assert.equal(data.playerRecords.sudoku[difficulty], null);
    }
  }

  const rawData = {
    generatedAt: "2026-07-25T00:00:00.000Z",
    leaderboards: {
      minesweeper: Object.fromEntries(
        minesweeperDifficulties.map((difficulty) => [
          difficulty,
          ascendingTopFive(`minesweeper-${difficulty}`),
        ])
      ),
      solitaire: descendingTopFive("solitaire"),
      snake: Object.fromEntries(
        snakeBoardSizes.map((size) => [size, descendingTopFive(`snake-${size}`)])
      ),
      sudoku: Object.fromEntries(
        sudokuDifficulties.map((difficulty) => [
          difficulty,
          ascendingTopFive(`sudoku-${difficulty}`),
        ])
      ),
    },
    playerRanks: {
      minesweeper: Object.fromEntries(
        minesweeperDifficulties.map((difficulty) => [difficulty, playerRank])
      ),
      solitaire: playerRank,
      snake: Object.fromEntries(snakeBoardSizes.map((size) => [size, playerRank])),
      sudoku: Object.fromEntries(
        sudokuDifficulties.map((difficulty) => [difficulty, playerRank])
      ),
    },
    playerRecords: {
      minesweeper: Object.fromEntries(
        minesweeperDifficulties.map((difficulty, index) => [
          difficulty,
          createEntry(`current-minesweeper-${difficulty}`, 1, 90 + index, currentPlayerId),
        ])
      ),
      solitaire: createEntry("current-solitaire", 1, 5, currentPlayerId),
      snake: Object.fromEntries(
        snakeBoardSizes.map((size, index) => [
          size,
          createEntry(`current-snake-${size}`, 1, 5 + index, currentPlayerId),
        ])
      ),
      sudoku: Object.fromEntries(
        sudokuDifficulties.map((difficulty, index) => [
          difficulty,
          createEntry(`current-sudoku-${difficulty}`, 1, 90 + index, currentPlayerId),
        ])
      ),
    },
  };
  const normalized = jsonClone(
    context.normalizeGameStatsDataForTest(rawData, {
      solitaireLeaderboardDirection: "desc",
    })
  );

  const assertIndependentTopThree = (entries) => {
    assert.equal(entries.length, 3);
    assert.equal(entries.some((entry) => entry.playerId === currentPlayerId), false);
  };
  for (const difficulty of minesweeperDifficulties) {
    assertIndependentTopThree(normalized.leaderboards.minesweeper[difficulty]);
    assert.deepEqual(normalized.playerRanks.minesweeper[difficulty], playerRank);
    assert.equal(
      normalized.playerRecords.minesweeper[difficulty].playerId,
      currentPlayerId
    );
  }
  assertIndependentTopThree(normalized.leaderboards.solitaire);
  assert.deepEqual(normalized.playerRanks.solitaire, playerRank);
  assert.equal(normalized.playerRecords.solitaire.playerId, currentPlayerId);
  assert.equal(normalized.playerRecords.solitaire.metric, 5);
  for (const size of snakeBoardSizes) {
    assertIndependentTopThree(normalized.leaderboards.snake[size]);
    assert.deepEqual(normalized.playerRanks.snake[size], playerRank);
    assert.equal(normalized.playerRecords.snake[size].playerId, currentPlayerId);
  }
  for (const difficulty of sudokuDifficulties) {
    assertIndependentTopThree(normalized.leaderboards.sudoku[difficulty]);
    assert.deepEqual(normalized.playerRanks.sudoku[difficulty], playerRank);
    assert.equal(normalized.playerRecords.sudoku[difficulty].playerId, currentPlayerId);
  }
});

test("a saved profile is attached to a non-leaderboard Solitaire win without client-only fields", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const eventProfileSource = extractSource(
    source,
    "const normalizeGameStatsEventProfile =",
    "\n\nconst normalizeAdministratorProof"
  );
  const recordEventSource = extractSource(
    source,
    "const recordGameStatsEvent =",
    "\n\nconst formatGameStatsCounter"
  );
  const context = vm.createContext({});

  vm.runInContext(
    [
      "const normalizeGameStatsProfile = (profile) => profile ? { ...profile } : null;",
      eventProfileSource,
      'let gameStatsProfile = { id: "player-saved-profile", name: "Mira", icon: "assets/app-icons/ico/user_card.ico", rerollCount: 7 };',
      "let gameStatsLocalResetGeneration = 0;",
      "const gameStatsLocalState = {};",
      "const gameStatsGlobalState = {};",
      "let queuedSubmission = null;",
      "let appliedEvent = null;",
      "let saveCalls = 0;",
      "let syncCalls = 0;",
      "let resolveSession;",
      "const pendingSession = new Promise((resolve) => { resolveSession = resolve; });",
      "const normalizeGameStatsEvent = (event) => event ? { ...event } : null;",
      "const gameStatsEventBeatsPersonalRecord = () => false;",
      "const gameStatsEventQualifiesForLeaderboard = () => false;",
      'const requestGameStatsProfile = async () => { throw new Error("saved profiles must not prompt"); };',
      "const applyGameStatsEventToData = (_data, event) => { appliedEvent = { ...event }; return true; };",
      "const updateGameStatsSudokuBestTime = () => {};",
      "const getGameStatsSession = async () => pendingSession;",
      "const queueGameStatsSubmission = (event, session) => { queuedSubmission = { event: { ...event }, session }; };",
      "const saveGameStatsLocalState = () => { saveCalls += 1; };",
      'let gameStatsSyncMessage = "";',
      'let gameStatsSyncState = "initial";',
      "const renderGameStatsWindows = () => {};",
      "const setGameStatsSyncState = (state, { message = '' } = {}) => { gameStatsSyncState = state; gameStatsSyncMessage = message; };",
      "const syncQueuedGameStats = async () => { syncCalls += 1; };",
      "const playGameStatsRecordHandoff = async () => {};",
      recordEventSource,
      "globalThis.recordGameStatsEventForTest = recordGameStatsEvent;",
      'globalThis.resolveSessionForTest = () => resolveSession({ id: "session-solitaire", token: "token-solitaire", expiresAt: new Date(Date.now() + 60_000).toISOString() });',
      "globalThis.readRecordState = () => ({ appliedEvent, queuedSubmission, saveCalls, syncCalls });",
    ].join("\n"),
    context
  );

  const recordPromise = context.recordGameStatsEventForTest(
    {
      id: "event-solitaire-saved-profile",
      game: "solitaire",
      type: "win",
      occurredAt: new Date().toISOString(),
      metric: 88,
      metricKind: "moves",
    },
    "solitaire-session"
  );

  const expectedProfile = {
    id: "player-saved-profile",
    name: "Mira",
    icon: "assets/app-icons/ico/user_card.ico",
  };
  const pendingState = jsonClone(context.readRecordState());
  assert.deepEqual(pendingState.appliedEvent.profile, expectedProfile);
  assert.equal(pendingState.saveCalls, 1);
  assert.equal(pendingState.queuedSubmission, null);

  context.resolveSessionForTest();
  await recordPromise;
  const state = jsonClone(context.readRecordState());

  assert.deepEqual(state.appliedEvent.profile, expectedProfile);
  assert.deepEqual(state.queuedSubmission.event.profile, expectedProfile);
  assert.equal(state.queuedSubmission.event.profile.rerollCount, undefined);
  assert.equal(state.saveCalls, 1);
  assert.equal(state.syncCalls, 1);
});

test("queue sync strips profile metadata, removes legacy entries, refreshes, and preserves warnings", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const eventProfileSource = extractSource(
    source,
    "const normalizeGameStatsEventProfile =",
    "\n\nconst normalizeAdministratorProof"
  );
  const syncSource = extractSource(
    source,
    "const refreshGameStatsGlobalState =",
    "\n\nconst recordGameStatsEvent"
  );
  const context = vm.createContext({});

  vm.runInContext(
    [
      "const normalizeGameStatsProfile = (profile) => profile ? { ...profile } : null;",
      eventProfileSource,
      'let gameStatsProfile = { id: "player-saved-profile", name: "Mira", icon: "assets/app-icons/ico/user_card.ico", rerollCount: 7 };',
      "let gameStatsGlobalState = null;",
      'let gameStatsSyncMessage = "";',
      'let gameStatsSyncState = "initial";',
      "let gameStatsSyncInProgress = false;",
      "let gameStatsSyncRequested = false;",
      "let gameStatsSyncPromise = null;",
      "let gameStatsManualRefreshInProgress = false;",
      `let gameStatsSubmissionQueue = ${JSON.stringify([
        {
          event: {
            id: "event-solitaire-publish",
            game: "solitaire",
            type: "win",
            occurredAt: new Date().toISOString(),
            metric: 88,
            metricKind: "moves",
            profile: {
              id: "player-saved-profile",
              name: "Mira",
              icon: "assets/app-icons/ico/user_card.ico",
              rerollCount: 7,
            },
          },
          session: {
            id: "session-solitaire-publish",
            token: "token-solitaire-publish",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        },
        {
          event: {
            id: "event-solitaire-legacy",
            game: "solitaire",
            type: "win",
            occurredAt: new Date().toISOString(),
            metric: 99,
            metricKind: "moves",
            profile: {
              id: "player-saved-profile",
              name: "Mira",
              icon: "assets/app-icons/ico/user_card.ico",
              rerollCount: 7,
            },
          },
          session: null,
        },
      ])};`,
      "const eventRequests = [];",
      "const statsPaths = [];",
      "let saveCalls = 0;",
      "let renderCalls = 0;",
      "const isGameStatsBackendConfigured = () => true;",
      "const fetchGameStatsApi = async (path, options) => {",
      '  if (path === "/events") {',
      "    eventRequests.push(JSON.parse(options.body));",
      '    return { ok: true, status: 201, json: async () => ({ ok: true, applied: true }) };',
      "  }",
      "  statsPaths.push(path);",
      '  return { ok: true, status: 200, json: async () => ({ marker: "fresh-global-stats" }) };',
      "};",
      "const readGameStatsApiJson = async (response) => response.json();",
      "const normalizeGameStatsData = (payload) => ({ ...payload });",
      "const getAdministratorEventHeaders = () => ({});",
      'const GAME_STATS_ROHIN_NEKO_PROFILE = { id: "player-rohin-neko" };',
      "const saveGameStatsSubmissionQueue = () => { saveCalls += 1; };",
      "const renderGameStatsWindows = () => { renderCalls += 1; };",
      "const setGameStatsSyncState = (state, { message = '' } = {}) => {",
      "  gameStatsSyncState = state;",
      "  gameStatsSyncMessage = message || (state === 'ready' ? 'Global stats are up to date.' : state);",
      "  renderGameStatsWindows();",
      "};",
      syncSource,
      "globalThis.syncQueuedGameStatsForTest = syncQueuedGameStats;",
      "globalThis.readSyncState = () => ({ gameStatsSubmissionQueue, gameStatsGlobalState, gameStatsSyncMessage, gameStatsSyncState, gameStatsSyncInProgress, eventRequests, statsPaths, saveCalls, renderCalls });",
    ].join("\n"),
    context
  );

  await context.syncQueuedGameStatsForTest();

  const state = jsonClone(context.readSyncState());
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(state.gameStatsSyncInProgress, false);
  assert.equal(state.eventRequests.length, 1);
  assert.deepEqual(state.eventRequests[0].event.profile, {
    id: "player-saved-profile",
    name: "Mira",
    icon: "assets/app-icons/ico/user_card.ico",
  });
  assert.equal(state.eventRequests[0].event.profile.rerollCount, undefined);
  assert.deepEqual(state.statsPaths, ["/stats?playerId=player-saved-profile"]);
  assert.deepEqual(state.gameStatsGlobalState, { marker: "fresh-global-stats" });
  assert.equal(state.gameStatsSyncState, "ready");
  assert.equal(
    state.gameStatsSyncMessage,
    "Local stats are saved. A result without a verified game session cannot be published."
  );
  assert.equal(state.saveCalls, 1);
  assert.equal(state.renderCalls, 4);
});

test("an overlapping queue sync is coalesced into one rerun after the active refresh", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const syncSource = extractSource(
    source,
    "const refreshGameStatsGlobalState =",
    "\n\nconst recordGameStatsEvent"
  );
  const context = vm.createContext({});

  vm.runInContext(
    [
      "let gameStatsProfile = null;",
      "let gameStatsGlobalState = null;",
      'let gameStatsSyncMessage = "";',
      'let gameStatsSyncState = "initial";',
      "let gameStatsSyncInProgress = false;",
      "let gameStatsSyncRequested = false;",
      "let gameStatsSyncPromise = null;",
      "let gameStatsManualRefreshInProgress = false;",
      "let gameStatsSubmissionQueue = [];",
      "const statsPaths = [];",
      "const pendingStatsResponses = [];",
      "let saveCalls = 0;",
      "let renderCalls = 0;",
      "const isGameStatsBackendConfigured = () => true;",
      "const fetchGameStatsApi = async (path) => {",
      "  statsPaths.push(path);",
      "  return new Promise((resolve) => {",
      "    pendingStatsResponses.push(() => resolve({",
      "      ok: true,",
      "      status: 200,",
      '      json: async () => ({ marker: `fresh-global-stats-${statsPaths.length}` }),',
      "    }));",
      "  });",
      "};",
      "const readGameStatsApiJson = async (response) => response.json();",
      "const normalizeGameStatsData = (payload) => ({ ...payload });",
      "const saveGameStatsSubmissionQueue = () => { saveCalls += 1; };",
      "const renderGameStatsWindows = () => { renderCalls += 1; };",
      "const setGameStatsSyncState = (state, { message = '' } = {}) => {",
      "  gameStatsSyncState = state;",
      "  gameStatsSyncMessage = message || state;",
      "  renderGameStatsWindows();",
      "};",
      syncSource,
      "globalThis.syncQueuedGameStatsForTest = syncQueuedGameStats;",
      "globalThis.resolveNextStatsResponse = () => pendingStatsResponses.shift()?.();",
      "globalThis.readSyncState = () => ({ gameStatsSyncInProgress, gameStatsSyncRequested, statsPaths, pendingResponseCount: pendingStatsResponses.length, saveCalls, renderCalls });",
    ].join("\n"),
    context
  );

  const firstSync = context.syncQueuedGameStatsForTest();
  await waitFor(
    () => context.readSyncState().pendingResponseCount === 1,
    "the first sync should wait for its global stats refresh"
  );

  const overlappingSync = context.syncQueuedGameStatsForTest();
  assert.equal(overlappingSync, firstSync);
  let state = jsonClone(context.readSyncState());
  assert.equal(state.gameStatsSyncInProgress, true);
  assert.equal(state.gameStatsSyncRequested, true);
  assert.deepEqual(state.statsPaths, ["/stats"]);

  context.resolveNextStatsResponse();
  await waitFor(
    () => context.readSyncState().statsPaths.length === 2,
    "the overlapping request should start one coalesced sync rerun"
  );

  state = jsonClone(context.readSyncState());
  assert.equal(state.gameStatsSyncInProgress, true);
  assert.equal(state.gameStatsSyncRequested, false);
  assert.equal(state.pendingResponseCount, 1);

  context.resolveNextStatsResponse();
  await Promise.all([firstSync, overlappingSync]);

  state = jsonClone(context.readSyncState());
  assert.deepEqual(state.statsPaths, ["/stats", "/stats"]);
  assert.equal(state.gameStatsSyncInProgress, false);
  assert.equal(state.gameStatsSyncRequested, false);
  assert.equal(state.pendingResponseCount, 0);
  assert.equal(state.saveCalls, 2);
  assert.equal(state.renderCalls, 7);
});
