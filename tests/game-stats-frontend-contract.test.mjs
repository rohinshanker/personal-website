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
      "let queuedSubmission = null;",
      "let appliedEvent = null;",
      "let syncCalls = 0;",
      "const normalizeGameStatsEvent = (event) => event ? { ...event } : null;",
      "const isGameStatsFirstLocalWin = () => false;",
      "const gameStatsEventQualifiesForLeaderboard = () => false;",
      'const requestGameStatsProfile = async () => { throw new Error("saved profiles must not prompt"); };',
      "const applyGameStatsEventToData = (_data, event) => { appliedEvent = { ...event }; return true; };",
      "const updateGameStatsSudokuBestTime = () => {};",
      'const getGameStatsSession = async () => ({ id: "session-solitaire", token: "token-solitaire", expiresAt: new Date(Date.now() + 60_000).toISOString() });',
      "const queueGameStatsSubmission = (event, session) => { queuedSubmission = { event: { ...event }, session }; };",
      "const saveGameStatsLocalState = () => {};",
      'let gameStatsSyncMessage = "";',
      "const renderGameStatsWindows = () => {};",
      "const syncQueuedGameStats = async () => { syncCalls += 1; };",
      "const playFirstGameStatsTrophyHandoff = async () => {};",
      recordEventSource,
      "globalThis.recordGameStatsEventForTest = recordGameStatsEvent;",
      "globalThis.readRecordState = () => ({ appliedEvent, queuedSubmission, syncCalls });",
    ].join("\n"),
    context
  );

  await context.recordGameStatsEventForTest(
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

  const state = jsonClone(context.readRecordState());
  const expectedProfile = {
    id: "player-saved-profile",
    name: "Mira",
    icon: "assets/app-icons/ico/user_card.ico",
  };
  assert.deepEqual(state.appliedEvent.profile, expectedProfile);
  assert.deepEqual(state.queuedSubmission.event.profile, expectedProfile);
  assert.equal(state.queuedSubmission.event.profile.rerollCount, undefined);
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
      "let gameStatsSyncInProgress = false;",
      "let gameStatsSyncRequested = false;",
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
      syncSource,
      "globalThis.syncQueuedGameStatsForTest = syncQueuedGameStats;",
      "globalThis.readSyncState = () => ({ gameStatsSubmissionQueue, gameStatsGlobalState, gameStatsSyncMessage, gameStatsSyncInProgress, eventRequests, statsPaths, saveCalls, renderCalls });",
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
  assert.equal(
    state.gameStatsSyncMessage,
    "Local stats are saved. A result without a verified game session cannot be published."
  );
  assert.equal(state.saveCalls, 1);
  assert.equal(state.renderCalls, 1);
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
      "let gameStatsSyncInProgress = false;",
      "let gameStatsSyncRequested = false;",
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

  await context.syncQueuedGameStatsForTest();
  let state = jsonClone(context.readSyncState());
  assert.equal(state.gameStatsSyncInProgress, true);
  assert.equal(state.gameStatsSyncRequested, true);
  assert.deepEqual(state.statsPaths, ["/stats"]);

  context.resolveNextStatsResponse();
  await firstSync;
  await waitFor(
    () => context.readSyncState().statsPaths.length === 2,
    "the overlapping request should start one coalesced sync rerun"
  );

  state = jsonClone(context.readSyncState());
  assert.equal(state.gameStatsSyncInProgress, true);
  assert.equal(state.gameStatsSyncRequested, false);
  assert.equal(state.pendingResponseCount, 1);

  context.resolveNextStatsResponse();
  await waitFor(
    () => !context.readSyncState().gameStatsSyncInProgress,
    "the coalesced sync rerun should settle"
  );

  state = jsonClone(context.readSyncState());
  assert.deepEqual(state.statsPaths, ["/stats", "/stats"]);
  assert.equal(state.gameStatsSyncInProgress, false);
  assert.equal(state.gameStatsSyncRequested, false);
  assert.equal(state.pendingResponseCount, 0);
  assert.equal(state.saveCalls, 2);
  assert.equal(state.renderCalls, 2);
});
