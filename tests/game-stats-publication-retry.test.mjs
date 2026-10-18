import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";

const RETRY_DELAY_MS = 5000;
const RETRY_MAX_DELAY_MS = 60_000;
const QUEUE_LIMIT = 100;
const ADMINISTRATOR_PROFILE = Object.freeze({ id: "player-rohin-neko" });
const PLAYER_PROFILE = Object.freeze({ id: "player-retry", name: "Retry Tester" });

const extractSource = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end).trim();
};

const jsonClone = (value) => JSON.parse(JSON.stringify(value));

const futureSession = (id) => ({
  id,
  token: `${id}-token`,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});

const expiredSession = (id) => ({
  id,
  token: `${id}-token`,
  expiresAt: new Date(Date.now() - 60_000).toISOString(),
});

const createSubmission = (
  id,
  { profile = PLAYER_PROFILE, session = futureSession(`${id}-session`) } = {},
) => ({
  event: {
    id,
    game: "minesweeper",
    type: "win",
    occurredAt: new Date().toISOString(),
    difficulty: "beginner",
    metric: 42,
    metricKind: "seconds",
    profile,
  },
  session,
  proofRejections: 0,
});

const apiError = (status, extra = {}) => {
  const error = new Error(`Game stats request failed (${status})`);
  error.status = status;
  error.code = "";
  error.retryAfterMs = 0;
  return Object.assign(error, extra);
};

/**
 * Runs the real sync region against scripted `/events` answers and a fake
 * timer so every retry decision is observable: the state copy, the queue,
 * which timers were created or cleared, and how many requests went out.
 */
const loadSyncHarness = async ({
  queue = [],
  profile = PLAYER_PROFILE,
  withProof = false,
} = {}) => {
  const source = await readHomeScript("gameStats");
  const syncSource = extractSource(
    source,
    "const refreshGameStatsGlobalState =",
    "\n\nconst recordGameStatsEvent",
  );
  const timers = [];
  const window = {
    setTimeout(callback, delay) {
      const timer = { id: timers.length + 1, delay, callback, cleared: false, fired: false };
      timers.push(timer);
      return timer.id;
    },
    clearTimeout(id) {
      const timer = timers.find((candidate) => candidate.id === id);
      if (timer) timer.cleared = true;
    },
  };
  const eventAnswers = [];
  const eventRequests = [];
  const statsRequests = [];
  let statsAvailable = true;
  const authenticationRequests = [];
  let manualClears = 0;
  const context = vm.createContext({
    URLSearchParams,
    window,
    async __respondEvent(body) {
      eventRequests.push(body);
      const answer = eventAnswers.shift() ?? { status: 201 };
      if (answer.delayMs) await new Promise((resolve) => setTimeout(resolve, answer.delayMs));
      if (answer.status >= 400) throw apiError(answer.status, answer.extra);
      if (answer.status === 0) throw new Error("Failed to fetch");
      return { json: async () => ({ ok: true, eventId: body.event.id }) };
    },
    __respondStats(path) {
      statsRequests.push(path);
      if (!statsAvailable) throw new Error("Failed to fetch");
      return { json: async () => ({ totals: {} }) };
    },
    __requestAuthentication() {
      authenticationRequests.push(true);
    },
    __clearDropped() {
      manualClears += 1;
    },
  });

  vm.runInContext(
    [
      `let gameStatsProfile = ${JSON.stringify(profile)};`,
      "let gameStatsGlobalState = null;",
      "let gameStatsGlobalPlayerTotalsAvailable = false;",
      'let gameStatsSyncMessage = "";',
      'let gameStatsSyncState = "initial";',
      "let gameStatsSyncInProgress = false;",
      "let gameStatsSyncRequested = false;",
      "let gameStatsSyncPromise = null;",
      "let gameStatsManualRefreshInProgress = false;",
      'const GAME_STATS_API_PROTOCOL = "2";',
      "const GAME_STATS_MAX_PENDING_ACKNOWLEDGMENTS = 32;",
      `const GAME_STATS_PUBLICATION_RETRY_DELAY_MS = ${RETRY_DELAY_MS};`,
      `const GAME_STATS_PUBLICATION_RETRY_MAX_DELAY_MS = ${RETRY_MAX_DELAY_MS};`,
      'const GAME_STATS_ADMINISTRATOR_AUTHORIZATION_ERROR_CODE = "administrator-authorization";',
      "const GAME_STATS_MAX_ADMINISTRATOR_PROOF_RETRIES = 1;",
      `const GAME_STATS_ROHIN_NEKO_PROFILE = ${JSON.stringify(ADMINISTRATOR_PROFILE)};`,
      "const gameStatsConfirmedEvents = new Map();",
      `let gameStatsSubmissionQueue = ${JSON.stringify(queue)};`,
      "let saveCalls = 0;",
      "let renderCalls = 0;",
      "const states = [];",
      "const isGameStatsBackendConfigured = () => true;",
      "const fetchGameStatsApi = async (path, options) => {",
      '  if (path === "/events") return __respondEvent(JSON.parse(options.body));',
      "  return __respondStats(path);",
      "};",
      "const readGameStatsApiJson = async (response) => response.json();",
      "const normalizeGameStatsData = (payload) => ({ ...payload });",
      "const normalizeGameStatsEventProfile = (profile) => profile ? { id: profile.id } : null;",
      "const reconcileConfirmedGameStatsEvents = (data) => data;",
      "const markGameStatsEventConfirmed = () => {};",
      `const getAdministratorEventHeaders = () => (${withProof} ? { Authorization: "Bearer proof" } : {});`,
      "const isGameStatsAdministratorProfile = (profile) => profile?.id === GAME_STATS_ROHIN_NEKO_PROFILE.id;",
      "const clearGameStatsAdministratorProof = () => {};",
      "const isGameStatsSessionExpired = (session) => new Date(session?.expiresAt || '').getTime() <= Date.now();",
      "const requestGameStatsAdministratorAuthentication = () => __requestAuthentication();",
      "const clearGameStatsDroppedResults = () => __clearDropped();",
      "const saveGameStatsSubmissionQueue = () => { saveCalls += 1; };",
      "const renderGameStatsWindows = () => { renderCalls += 1; };",
      "const setGameStatsSyncState = (state, { message = '' } = {}) => {",
      "  gameStatsSyncState = state;",
      "  gameStatsSyncMessage = message || state;",
      "  states.push(state);",
      "  renderGameStatsWindows();",
      "};",
      syncSource,
      "globalThis.syncForTest = syncQueuedGameStats;",
      "globalThis.readForTest = () => ({ gameStatsSubmissionQueue, gameStatsSyncMessage, gameStatsSyncState, gameStatsSyncInProgress, gameStatsSyncPromise: Boolean(gameStatsSyncPromise), gameStatsPublicationRetryTimer, gameStatsPublicationRetryUsed, saveCalls, renderCalls, states });",
      "globalThis.cancelForTest = cancelGameStatsPublicationRetry;",
      "globalThis.restoreForTest = restoreGameStatsPublicationRetryBudget;",
      "globalThis.syncPromiseForTest = () => gameStatsSyncPromise;",
    ].join("\n"),
    context,
  );

  return {
    answerEvents(...answers) {
      eventAnswers.push(...answers);
    },
    authenticationRequests,
    eventRequests,
    statsRequests,
    setStatsAvailable(value) {
      statsAvailable = value;
    },
    get manualClears() {
      return manualClears;
    },
    sync: (options) => context.syncForTest(options),
    cancel: () => context.cancelForTest(),
    restore: () => context.restoreForTest(),
    read: () => jsonClone(context.readForTest()),
    timers,
    pendingTimers: () => timers.filter((timer) => !timer.cleared && !timer.fired),
    async fireTimer(timer) {
      assert.equal(timer.cleared, false, "a cleared timer never fires");
      timer.fired = true;
      timer.callback();
      await context.syncPromiseForTest();
    },
  };
};

test("a transient publication failure schedules exactly one delayed retry that then publishes", async () => {
  const harness = await loadSyncHarness({ queue: [createSubmission("event-transient")] });
  harness.answerEvents({ status: 503 });

  await harness.sync();

  let state = harness.read();
  assert.equal(state.gameStatsSyncState, "retry-scheduled");
  assert.equal(state.gameStatsSyncMessage, "retry-scheduled");
  assert.equal(state.gameStatsSubmissionQueue.length, 1);
  assert.equal(state.gameStatsPublicationRetryUsed, true);
  assert.equal(harness.eventRequests.length, 1);
  assert.deepEqual(state.states, ["publishing", "fetching", "retry-scheduled"]);
  assert.equal(harness.pendingTimers().length, 1);
  assert.equal(harness.pendingTimers()[0].delay, RETRY_DELAY_MS);

  await harness.fireTimer(harness.pendingTimers()[0]);

  state = harness.read();
  assert.equal(state.gameStatsSyncState, "ready");
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(state.gameStatsPublicationRetryTimer, null);
  assert.equal(state.gameStatsPublicationRetryUsed, false);
  assert.equal(harness.eventRequests.length, 2);
  assert.equal(harness.pendingTimers().length, 0);
  assert.equal(harness.timers.length, 1);
  // The retried read is a fresh one, like every read after an accepted publication.
  assert.match(harness.statsRequests.at(-1), /fresh=1/);
});

test("a second transient failure ends in the plain failed state with no further timer", async () => {
  const harness = await loadSyncHarness({ queue: [createSubmission("event-persistent")] });
  harness.answerEvents({ status: 503 }, { status: 0 }, { status: 502 }, { status: 504 });

  await harness.sync();
  await harness.fireTimer(harness.pendingTimers()[0]);

  let state = harness.read();
  assert.equal(state.gameStatsSyncState, "request-failed");
  assert.equal(state.gameStatsSubmissionQueue.length, 1);
  assert.equal(harness.eventRequests.length, 2);
  assert.equal(harness.timers.length, 1);

  // Automatic triggers (load, online, window open) do not earn another retry.
  await harness.sync();
  state = harness.read();
  assert.equal(state.gameStatsSyncState, "request-failed");
  assert.equal(harness.eventRequests.length, 3);
  assert.equal(harness.timers.length, 1);
  assert.equal(harness.manualClears, 0);

  // Manual Refresh is the visitor's own retry: it acknowledges dropped
  // results and restores the single automatic retry.
  await harness.sync({ manual: true });
  state = harness.read();
  assert.equal(harness.manualClears, 1);
  assert.equal(state.gameStatsSyncState, "retry-scheduled");
  assert.equal(harness.eventRequests.length, 4);
  assert.equal(harness.timers.length, 2);
  assert.equal(harness.pendingTimers().length, 1);
});

test("network errors, timeouts and rate limits are transient; the Worker's Retry-After stretches the delay up to the cap", async () => {
  const cases = [
    { answer: { status: 0 }, delay: RETRY_DELAY_MS },
    { answer: { status: 408 }, delay: RETRY_DELAY_MS },
    { answer: { status: 429 }, delay: RETRY_DELAY_MS },
    { answer: { status: 425, extra: { retryAfterMs: 1000 } }, delay: RETRY_DELAY_MS },
    { answer: { status: 425, extra: { retryAfterMs: 20_000 } }, delay: 20_000 },
    { answer: { status: 425, extra: { retryAfterMs: 600_000 } }, delay: RETRY_MAX_DELAY_MS },
    { answer: { status: 500 }, delay: RETRY_DELAY_MS },
  ];
  for (const { answer, delay } of cases) {
    const harness = await loadSyncHarness({ queue: [createSubmission("event-kind")] });
    harness.answerEvents(answer);
    await harness.sync();
    const state = harness.read();
    assert.equal(state.gameStatsSyncState, "retry-scheduled", `status ${answer.status}`);
    assert.equal(state.gameStatsSubmissionQueue.length, 1, `status ${answer.status}`);
    assert.equal(harness.pendingTimers().length, 1, `status ${answer.status}`);
    assert.equal(harness.pendingTimers()[0].delay, delay, `status ${answer.status}`);
  }
});

test("permanent rejections, missing credentials and expired proofs never schedule a retry", async () => {
  const rejected = await loadSyncHarness({ queue: [createSubmission("event-rejected")] });
  rejected.answerEvents({ status: 400 });
  await rejected.sync();
  let state = rejected.read();
  assert.equal(state.gameStatsSyncState, "ready");
  assert.equal(
    state.gameStatsSyncMessage,
    "Local stats are saved, but a result could not pass server verification.",
  );
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(rejected.timers.length, 0);

  const credentials = await loadSyncHarness({
    profile: ADMINISTRATOR_PROFILE,
    queue: [createSubmission("event-admin", { profile: ADMINISTRATOR_PROFILE })],
  });
  credentials.answerEvents({ status: 403 });
  await credentials.sync();
  state = credentials.read();
  assert.equal(state.gameStatsSyncState, "auth-required");
  assert.equal(state.gameStatsSubmissionQueue.length, 1);
  assert.equal(credentials.authenticationRequests.length, 1);
  assert.equal(credentials.timers.length, 0);

  const expired = await loadSyncHarness({
    queue: [createSubmission("event-expired", { session: expiredSession("expired-session") })],
  });
  await expired.sync();
  state = expired.read();
  assert.equal(state.gameStatsSyncState, "session-expired");
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(expired.eventRequests.length, 0);
  assert.equal(expired.timers.length, 0);

  // A proof that expires during its failed request is classified expired
  // before the transient branch can see it.
  const expiring = await loadSyncHarness({
    queue: [
      createSubmission("event-expiring", {
        session: {
          ...futureSession("expiring-session"),
          expiresAt: new Date(Date.now() + 15).toISOString(),
        },
      }),
    ],
  });
  expiring.answerEvents({ status: 503, delayMs: 40 });
  await expiring.sync();
  state = expiring.read();
  assert.equal(expiring.eventRequests.length, 1);
  assert.equal(state.gameStatsSyncState, "session-expired");
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(expiring.timers.length, 0);
});

test("a trigger during the wait cancels the timer, coalesces, and spends the retry", async () => {
  const harness = await loadSyncHarness({ queue: [createSubmission("event-duplicate")] });
  harness.answerEvents({ status: 503 }, { status: 503 }, { status: 503 });

  await harness.sync();
  const [timer] = harness.pendingTimers();
  assert.ok(timer);

  // Two overlapping triggers (online + window open) share one promise; the
  // second only asks for one follow-up pass, never a parallel publication.
  const first = harness.sync();
  const second = harness.sync();
  assert.equal(first, second);
  await first;

  const state = harness.read();
  assert.equal(timer.cleared, true);
  assert.equal(state.gameStatsSyncState, "request-failed");
  assert.equal(harness.eventRequests.length, 3);
  assert.equal(harness.timers.length, 1);
  assert.equal(state.gameStatsPublicationRetryTimer, null);
});

test("a published result restores the retry for the results that still fail", async () => {
  const harness = await loadSyncHarness({
    queue: [createSubmission("event-published"), createSubmission("event-stuck")],
  });
  harness.answerEvents(
    { status: 201 },
    { status: 503 },
    { status: 503 },
    { status: 201 },
    { status: 503 },
  );

  await harness.sync();
  let state = harness.read();
  assert.equal(state.gameStatsSyncState, "retry-scheduled");
  assert.deepEqual(
    state.gameStatsSubmissionQueue.map(({ event }) => event.id),
    ["event-stuck"],
  );

  await harness.fireTimer(harness.pendingTimers()[0]);
  state = harness.read();
  assert.equal(state.gameStatsSyncState, "request-failed");
  assert.equal(harness.timers.length, 1);

  // A later pass that publishes the stuck result restores the retry budget.
  await harness.sync();
  state = harness.read();
  assert.equal(state.gameStatsSyncState, "ready");
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(state.gameStatsPublicationRetryUsed, false);
  assert.equal(harness.timers.length, 1);
});

test("cancel and restore clear a pending timer without running it", async () => {
  const harness = await loadSyncHarness({ queue: [createSubmission("event-cancel")] });
  harness.answerEvents({ status: 503 });
  await harness.sync();
  const [timer] = harness.pendingTimers();

  harness.cancel();
  assert.equal(timer.cleared, true);
  assert.equal(harness.read().gameStatsPublicationRetryTimer, null);
  assert.equal(harness.read().gameStatsPublicationRetryUsed, true);
  // Cancelling twice is harmless.
  harness.cancel();

  harness.restore();
  assert.equal(harness.read().gameStatsPublicationRetryUsed, false);
  assert.equal(harness.eventRequests.length, 1);
});

test("a failed stats read after a transient publication failure still gets the retry, but an empty queue does not", async () => {
  const both = await loadSyncHarness({ queue: [createSubmission("event-offline")] });
  both.answerEvents({ status: 0 });
  both.setStatsAvailable(false);
  await both.sync();
  let state = both.read();
  assert.equal(state.gameStatsSyncState, "retry-scheduled");
  assert.equal(both.pendingTimers().length, 1);

  const readOnly = await loadSyncHarness();
  readOnly.setStatsAvailable(false);
  await readOnly.sync();
  state = readOnly.read();
  assert.equal(state.gameStatsSyncState, "request-failed");
  assert.equal(readOnly.timers.length, 0);
});

test("a higher-priority notice keeps the status row while the retry still runs underneath", async () => {
  const harness = await loadSyncHarness({
    queue: [
      createSubmission("event-expired", { session: expiredSession("expired") }),
      createSubmission("event-transient"),
    ],
  });
  harness.answerEvents({ status: 503 });
  await harness.sync();
  const state = harness.read();
  assert.equal(state.gameStatsSyncState, "session-expired");
  assert.deepEqual(
    state.gameStatsSubmissionQueue.map(({ event }) => event.id),
    ["event-transient"],
  );
  assert.equal(harness.pendingTimers().length, 1);

  // Sign-in owns the next attempt: a result waiting for credentials beside a
  // transient failure schedules nothing.
  const waiting = await loadSyncHarness({
    profile: ADMINISTRATOR_PROFILE,
    queue: [
      createSubmission("event-admin", { profile: ADMINISTRATOR_PROFILE }),
      createSubmission("event-transient", { profile: ADMINISTRATOR_PROFILE }),
    ],
  });
  waiting.answerEvents({ status: 403 }, { status: 503 });
  await waiting.sync();
  assert.equal(waiting.read().gameStatsSyncState, "auth-required");
  assert.equal(waiting.timers.length, 0);
  assert.equal(waiting.authenticationRequests.length, 1);
});

/** The dropped-result accounting region with the real storage helpers and a scripted localStorage. */
const loadDroppedHarness = async ({ stored = {}, failWrites = false, storedCount } = {}) => {
  const source = await readHomeScript("gameStats");
  const utilSource = await readHomeScript("util");
  const storageSource = extractSource(
    utilSource,
    "const resolveStorage =",
    "\n\nconst bannerAnimationCleanups",
  );
  const queueSource = extractSource(
    source,
    "const loadGameStatsSubmissionQueue =",
    "\n\nconst isGameStatsBackendConfigured",
  );
  const entries = new Map(Object.entries(stored));
  const writes = [];
  const removals = [];
  const localStorage = {
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem(key, value) {
      if (failWrites) throw new Error("QuotaExceededError");
      writes.push(key);
      entries.set(key, value);
    },
    removeItem(key) {
      removals.push(key);
      entries.delete(key);
    },
  };
  const context = vm.createContext({ localStorage });
  vm.runInContext(
    [
      storageSource,
      'const GAME_STATS_SYNC_QUEUE_STORAGE_KEY = "queue";',
      'const GAME_STATS_DROPPED_RESULTS_STORAGE_KEY = "dropped";',
      `const GAME_STATS_MAX_SYNC_QUEUE_LENGTH = ${QUEUE_LIMIT};`,
      "const normalizeGameStatsSubmission = (submission) => submission?.event ? submission : null;",
      "let gameStatsSubmissionQueue = [];",
      queueSource,
      `let gameStatsDroppedResultCount = ${storedCount === undefined ? "loadGameStatsDroppedResultCount()" : storedCount};`,
      "globalThis.loadQueueForTest = loadGameStatsSubmissionQueue;",
      "globalThis.recordForTest = recordGameStatsDroppedResults;",
      "globalThis.clearForTest = clearGameStatsDroppedResults;",
      "globalThis.describeForTest = describeGameStatsDroppedResults;",
      "globalThis.readForTest = () => gameStatsDroppedResultCount;",
    ].join("\n"),
    context,
  );
  return { context, entries, writes, removals };
};

test("loading an overlong stored queue keeps the newest results and counts the rest", async () => {
  const stored = Array.from({ length: QUEUE_LIMIT + 3 }, (_, index) => ({
    event: { id: `event-${index}` },
    session: null,
  }));
  const harness = await loadDroppedHarness({ stored: { queue: JSON.stringify(stored) } });
  const queue = harness.context.loadQueueForTest();
  assert.equal(queue.length, QUEUE_LIMIT);
  assert.equal(queue[0].event.id, "event-3");
  assert.equal(harness.context.readForTest(), 3);
  assert.equal(harness.entries.get("dropped"), "3");

  const exact = await loadDroppedHarness({
    stored: { queue: JSON.stringify(stored.slice(0, QUEUE_LIMIT)) },
  });
  assert.equal(exact.context.loadQueueForTest().length, QUEUE_LIMIT);
  assert.equal(exact.context.readForTest(), 0);
  assert.equal(exact.entries.has("dropped"), false);
});

test("the dropped count accumulates, survives a failed storage write, and clears with its storage", async () => {
  const harness = await loadDroppedHarness({ stored: { dropped: "2" } });
  assert.equal(harness.context.readForTest(), 2);
  assert.equal(
    harness.context.describeForTest(),
    "2 unpublished results were dropped because the publishing queue was full.",
  );

  harness.context.recordForTest(0);
  harness.context.recordForTest(-4);
  harness.context.recordForTest(Number.NaN);
  harness.context.recordForTest(1.5);
  assert.equal(harness.context.readForTest(), 2);
  assert.deepEqual(harness.writes, []);

  harness.context.recordForTest(5);
  assert.equal(harness.context.readForTest(), 7);
  assert.equal(harness.entries.get("dropped"), "7");

  harness.context.clearForTest();
  assert.equal(harness.context.readForTest(), 0);
  assert.equal(harness.entries.has("dropped"), false);
  assert.deepEqual(harness.removals, ["dropped"]);
  assert.equal(harness.context.describeForTest(), "");
  harness.context.clearForTest();
  assert.deepEqual(harness.removals, ["dropped"]);

  harness.context.recordForTest(1);
  assert.equal(
    harness.context.describeForTest(),
    "1 unpublished result was dropped because the publishing queue was full.",
  );

  const blocked = await loadDroppedHarness({ failWrites: true, storedCount: 0 });
  blocked.context.recordForTest(3);
  assert.equal(blocked.context.readForTest(), 3);
  assert.equal(blocked.entries.has("dropped"), false);
  assert.equal(
    blocked.context.describeForTest(),
    "3 unpublished results were dropped because the publishing queue was full.",
  );

  for (const stored of ["-2", '"7"', "1.5", "null", "{", "0"]) {
    const invalid = await loadDroppedHarness({ stored: { dropped: stored } });
    assert.equal(invalid.context.readForTest(), 0, `stored ${stored}`);
  }
});

test("the status row, refresh, reset and page exit wire the retry and dropped-result contract", async () => {
  const source = await readHomeScript("gameStats");

  assert.match(
    source,
    /"retry-scheduled": Object\.freeze\(\{\s*message: "Publishing failed\. Retrying once in a moment\.",\s*action: "refresh",\s*busy: false,\s*disabled: false,/,
  );
  assert.match(source, /window\.addEventListener\("pagehide", cancelGameStatsPublicationRetry\);/);
  assert.match(
    source,
    /if \(manual\) \{\s*gameStatsManualRefreshInProgress = true;[\s\S]*?clearGameStatsDroppedResults\(\);\s*restoreGameStatsPublicationRetryBudget\(\);\s*\}/,
  );
  assert.match(
    source,
    /const resetGameProgressLocalData = \(\) => \{[\s\S]*?clearGameStatsDroppedResults\(\);/,
  );
  assert.match(
    source,
    /const droppedNotice =\s*backendConfigured && !syncState\.busy \? describeGameStatsDroppedResults\(\) : "";\s*const syncMessage = droppedNotice \? `\$\{stateMessage\} \$\{droppedNotice\}` : stateMessage;/,
  );
  assert.match(source, /"data-game-stats-dropped-results",/);
  assert.match(
    source,
    /let gameStatsDroppedResultCount = loadGameStatsDroppedResultCount\(\);\s*let gameStatsSubmissionQueue = loadGameStatsSubmissionQueue\(\);/,
  );
  assert.match(
    source,
    /error\.retryAfterMs = Number\.isFinite\(retryAfterMs\) && retryAfterMs > 0 \? retryAfterMs : 0;/,
  );
});
