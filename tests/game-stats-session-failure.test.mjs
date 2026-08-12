import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

const readMainSource = () => readFile(new URL("scripts/home/main.js", root), "utf8");

const extractSource = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Unable to extract ${startMarker}`);
  return source.slice(start, end);
};

const plainObject = (value) => JSON.parse(JSON.stringify(value));

test("backend configuration accepts only an HTTP endpoint with a canonical SHA-256 build", async () => {
  const source = await readMainSource();
  const configSource = extractSource(
    source,
    "const normalizeGameStatsBackendConfig =",
    "\n\nconst gameStatsBackend ="
  );
  const context = vm.createContext({ URL });
  vm.runInContext(
    `${configSource}\nglobalThis.normalizeForTest = normalizeGameStatsBackendConfig;`,
    context
  );

  const validBuild = `sha256-${"a".repeat(64)}`;
  assert.deepEqual(
    plainObject(
      context.normalizeForTest({
        apiBaseUrl: " HTTPS://Stats.Example.Test:443/api/// ",
        buildVersion: ` ${validBuild} `,
      })
    ),
    { apiBaseUrl: "https://stats.example.test/api", buildVersion: validBuild }
  );
  assert.deepEqual(
    plainObject(
      context.normalizeForTest({
        apiBaseUrl: " https://stats.example.test/// ",
        buildVersion: validBuild,
      })
    ),
    { apiBaseUrl: "https://stats.example.test", buildVersion: validBuild }
  );

  for (const rawConfig of [
    null,
    {},
    { apiBaseUrl: "https://stats.example.test", buildVersion: "" },
    { apiBaseUrl: "https://stats.example.test", buildVersion: `sha256-${"a".repeat(63)}` },
    { apiBaseUrl: "https://stats.example.test", buildVersion: `sha256-${"A".repeat(64)}` },
    { apiBaseUrl: "https://stats.example.test", buildVersion: `sha1-${"a".repeat(64)}` },
    { apiBaseUrl: "ftp://stats.example.test", buildVersion: validBuild },
    { apiBaseUrl: "not a URL", buildVersion: validBuild },
    { apiBaseUrl: "https://user@stats.example.test", buildVersion: validBuild },
    { apiBaseUrl: "https://user:pass@stats.example.test", buildVersion: validBuild },
    { apiBaseUrl: "https://stats.example.test?region=global", buildVersion: validBuild },
    { apiBaseUrl: "https://stats.example.test#leaderboard", buildVersion: validBuild },
  ]) {
    assert.deepEqual(plainObject(context.normalizeForTest(rawConfig)), {
      apiBaseUrl: "",
      buildVersion: "",
    });
  }
});

const loadSessionHarness = async () => {
  const source = await readMainSource();
  const normalizerSource = extractSource(
    source,
    "const normalizeGameStatsSession =",
    "\n\nconst normalizeGameStatsSubmission ="
  );
  const sessionSource = extractSource(
    source,
    "const reportGameStatsSessionFailure =",
    "\n\nconst loadGameStatsProfile ="
  );
  const context = vm.createContext({});
  vm.runInContext(
    [
      "let gameStatsSessionSequence = 0;",
      "const gameStatsSessions = new Map();",
      "const GAME_STATS_SESSION_BUILD_RETRY_ATTEMPTS = 2;",
      "const GAME_STATS_SESSION_BUILD_RETRY_INTERVAL_MS = 1;",
      "const window = { setTimeout: (callback) => callback() };",
      "let configured = true;",
      "let behavior = { kind: 'success', status: 201, payload: null };",
      "const requests = [];",
      "const stateChanges = [];",
      "let gameStatsSyncState = 'initial';",
      "let gameStatsReleaseWaitCount = 0;",
      "const setGameStatsSyncState = (state, { message = '' } = {}) => { if (gameStatsReleaseWaitCount > 0 && state !== 'release-waiting' && state !== 'build-mismatch') return; gameStatsSyncState = state; stateChanges.push({ state, message }); };",
      "const isGameStatsBackendConfigured = () => configured;",
      "const gameStatsBackend = { buildVersion: 'sha256-test' };",
      "const fetchGameStatsApi = async (path, options) => {",
      "  requests.push({ path, body: JSON.parse(options.body) });",
      "  if (behavior.kind === 'network-error') throw new Error('offline');",
      "  if (behavior.kind === 'recover-after-mismatch' && behavior.failures > 0) {",
      "    behavior.failures -= 1;",
      "    return { kind: 'http-error', status: 409, payload: null };",
      "  }",
      "  return { ...behavior };",
      "};",
      "const readGameStatsApiJson = async (response) => {",
      "  if (response.kind === 'http-error') {",
      "    const error = new Error('request failed');",
      "    error.status = response.status;",
      "    throw error;",
      "  }",
      "  return response.payload;",
      "};",
      normalizerSource,
      sessionSource,
      "globalThis.startForTest = startGameStatsSession;",
      "globalThis.getForTest = getGameStatsSession;",
      "globalThis.setConfiguredForTest = (value) => { configured = value; };",
      "globalThis.setBehaviorForTest = (value) => { behavior = value; };",
      "globalThis.readRequestsForTest = () => requests.map((request) => ({ ...request }));",
      "globalThis.readStateChangesForTest = () => stateChanges.map((change) => ({ ...change }));",
    ].join("\n"),
    context
  );
  return context;
};

test("session creation returns a one-use session result without changing valid behavior", async () => {
  const context = await loadSessionHarness();
  const session = {
    id: "session-valid",
    token: "session-valid-token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  context.setBehaviorForTest({ kind: "success", status: 201, payload: session });

  const key = context.startForTest("solitaire", {});
  assert.match(key, /^solitaire-/);
  assert.deepEqual(plainObject(await context.getForTest(key)), {
    session,
    status: 201,
  });
  assert.deepEqual(plainObject(await context.getForTest(key)), {
    session: null,
    status: 0,
  });
  assert.deepEqual(plainObject(context.readRequestsForTest()), [
    {
      path: "/sessions",
      body: { game: "solitaire", config: {}, buildVersion: "sha256-test" },
    },
  ]);
  assert.deepEqual(plainObject(context.readStateChangesForTest()), []);
});

test("session creation exhausts build retries before reporting an unavailable session", async () => {
  const cases = [
    {
      name: "build mismatch",
      behavior: { kind: "http-error", status: 409, payload: null },
      expectedResult: { session: null, status: 409 },
      expectedChanges: [
        { state: "release-waiting", message: "" },
        { state: "release-waiting", message: "" },
        { state: "build-mismatch", message: "" },
      ],
    },
    {
      name: "upstream rejection",
      behavior: { kind: "http-error", status: 503, payload: null },
      expectedResult: { session: null, status: 503 },
      expectedChanges: [{
        state: "request-failed",
        message:
          "The verified game session request failed (HTTP 503). Start a new game and try again.",
      }],
    },
    {
      name: "network failure",
      behavior: { kind: "network-error", status: 0, payload: null },
      expectedResult: { session: null, status: 0 },
      expectedChanges: [{
        state: "request-failed",
        message:
          "The verified game session request failed. Start a new game and try again.",
      }],
    },
    {
      name: "invalid success response",
      behavior: { kind: "success", status: 201, payload: {} },
      expectedResult: { session: null, status: 0, reason: "invalid-response" },
      expectedChanges: [{
        state: "request-failed",
        message:
          "The game server returned an invalid session response. Start a new game and try again.",
      }],
    },
    {
      name: "session response missing its token",
      behavior: {
        kind: "success",
        status: 201,
        payload: {
          id: "session-missing-token",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
      expectedResult: { session: null, status: 0, reason: "invalid-response" },
      expectedChanges: [{
        state: "request-failed",
        message:
          "The game server returned an invalid session response. Start a new game and try again.",
      }],
    },
    {
      name: "already-expired session response",
      behavior: {
        kind: "success",
        status: 201,
        payload: {
          id: "session-already-expired",
          token: "session-already-expired-token",
          expiresAt: new Date(0).toISOString(),
        },
      },
      expectedResult: { session: null, status: 0, reason: "invalid-response" },
      expectedChanges: [{
        state: "request-failed",
        message:
          "The game server returned an invalid session response. Start a new game and try again.",
      }],
    },
  ];

  for (const sessionCase of cases) {
    const context = await loadSessionHarness();
    context.setBehaviorForTest(sessionCase.behavior);
    const result = await context.getForTest(context.startForTest("solitaire", {}));
    assert.deepEqual(plainObject(result), sessionCase.expectedResult, sessionCase.name);
    assert.deepEqual(
      plainObject(context.readStateChangesForTest()),
      sessionCase.expectedChanges,
      sessionCase.name
    );
  }

  const unconfiguredContext = await loadSessionHarness();
  unconfiguredContext.setConfiguredForTest(false);
  const result = await unconfiguredContext.getForTest(
    unconfiguredContext.startForTest("solitaire", {})
  );
  assert.deepEqual(plainObject(result), {
    session: null,
    status: 0,
    reason: "unconfigured",
  });
  assert.deepEqual(plainObject(unconfiguredContext.readRequestsForTest()), []);
  assert.deepEqual(plainObject(unconfiguredContext.readStateChangesForTest()), [
    { state: "unconfigured", message: "" },
  ]);
  assert.deepEqual(plainObject(await unconfiguredContext.getForTest("")), {
    session: null,
    status: 0,
  });
});

test("session creation recovers after a temporary build mismatch", async () => {
  const context = await loadSessionHarness();
  const session = {
    id: "session-after-release",
    token: "session-after-release-token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  context.setBehaviorForTest({
    kind: "recover-after-mismatch",
    status: 201,
    payload: session,
    failures: 1,
  });

  const result = await context.getForTest(context.startForTest("solitaire", {}));
  assert.deepEqual(plainObject(result), { session, status: 201 });
  assert.deepEqual(plainObject(context.readRequestsForTest()), [
    {
      path: "/sessions",
      body: { game: "solitaire", config: {}, buildVersion: "sha256-test" },
    },
    {
      path: "/sessions",
      body: { game: "solitaire", config: {}, buildVersion: "sha256-test" },
    },
  ]);
  assert.deepEqual(plainObject(context.readStateChangesForTest()), [
    { state: "release-waiting", message: "" },
    { state: "ready", message: "" },
  ]);
});

test("submission queue rejects null sessions and persists valid sessions", async () => {
  const source = await readMainSource();
  const queueSource = extractSource(
    source,
    "const queueGameStatsSubmission =",
    "\n\nconst waitForGameStatsTrophyState ="
  );
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const GAME_STATS_MAX_SYNC_QUEUE_LENGTH = 2;",
      "let gameStatsSubmissionQueue = [];",
      "let saveCalls = 0;",
      "const saveGameStatsSubmissionQueue = () => { saveCalls += 1; };",
      queueSource,
      "globalThis.queueForTest = queueGameStatsSubmission;",
      "globalThis.readForTest = () => ({ queue: gameStatsSubmissionQueue, saveCalls });",
    ].join("\n"),
    context
  );

  assert.equal(context.queueForTest({ id: "event-null" }, null), false);
  assert.deepEqual(plainObject(context.readForTest()), { queue: [], saveCalls: 0 });

  for (const index of [1, 2, 3]) {
    assert.equal(
      context.queueForTest({ id: `event-${index}` }, { id: `session-${index}` }),
      true
    );
  }
  assert.deepEqual(plainObject(context.readForTest()), {
    queue: [
      { event: { id: "event-2" }, session: { id: "session-2" } },
      { event: { id: "event-3" }, session: { id: "session-3" } },
    ],
    saveCalls: 3,
  });
});

test("build mismatch is sticky until its reload action replaces the page", async () => {
  const source = await readMainSource();
  const stateSource = extractSource(
    source,
    "const getGameStatsSyncStateDefinition =",
    "\n\nconst isGameStatsSyncBusy ="
  );
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const GAME_STATS_SYNC_STATES = { ready: { message: 'ready' }, 'build-mismatch': { message: 'reload' } };",
      "let gameStatsSyncState = 'ready';",
      "let gameStatsSyncMessage = '';",
      "let gameStatsReleaseWaitCount = 0;",
      "let renderCalls = 0;",
      "const renderGameStatsWindows = () => { renderCalls += 1; };",
      stateSource,
      "globalThis.setForTest = setGameStatsSyncState;",
      "globalThis.readForTest = () => ({ gameStatsSyncState, gameStatsSyncMessage, renderCalls });",
    ].join("\n"),
    context
  );

  context.setForTest("missing-state");
  assert.deepEqual(plainObject(context.readForTest()), {
    gameStatsSyncState: "ready",
    gameStatsSyncMessage: "",
    renderCalls: 0,
  });
  context.setForTest("build-mismatch");
  context.setForTest("ready");
  assert.deepEqual(plainObject(context.readForTest()), {
    gameStatsSyncState: "build-mismatch",
    gameStatsSyncMessage: "reload",
    renderCalls: 1,
  });
});
