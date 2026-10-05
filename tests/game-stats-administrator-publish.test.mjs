import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";

const root = new URL("../", import.meta.url);

const extractSource = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end).trim();
};

const jsonClone = (value) => JSON.parse(JSON.stringify(value));

const administratorProfile = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
});

const createSubmission = (id, proofRejections = 0) => ({
  event: {
    id,
    game: "solitaire",
    type: "win",
    occurredAt: new Date().toISOString(),
    metric: 80,
    metricKind: "moves",
    profile: { ...administratorProfile },
  },
  session: {
    id: `session-${id}`,
    token: `token-${id}`,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  },
  proofRejections,
});

/**
 * Loads the real sync pass with a scripted `/events` responder. Each entry in
 * `eventResponses` answers one `/events` request in order.
 */
const loadSyncHarness = async ({ submissions, eventResponses, proof }) => {
  const source = await readHomeScript("gameStats");
  const syncSource = extractSource(
    source,
    "const refreshGameStatsGlobalState =",
    "\n\nconst recordGameStatsEvent"
  );
  const context = vm.createContext({ URLSearchParams });
  vm.runInContext(
    [
      'const GAME_STATS_ADMINISTRATOR_AUTHORIZATION_ERROR_CODE = "administrator-authorization";',
      "const GAME_STATS_MAX_ADMINISTRATOR_PROOF_RETRIES = 1;",
      'const GAME_STATS_API_PROTOCOL = "2";',
      "const GAME_STATS_MAX_PENDING_ACKNOWLEDGMENTS = 32;",
      'const GAME_STATS_ROHIN_NEKO_PROFILE = { id: "player-rohin-neko" };',
      `let administratorProof = ${JSON.stringify(proof)};`,
      `let gameStatsProfile = ${JSON.stringify(administratorProfile)};`,
      "let gameStatsGlobalState = null;",
      "let gameStatsGlobalPlayerTotalsAvailable = false;",
      'let gameStatsSyncMessage = "";',
      'let gameStatsSyncState = "initial";',
      "let gameStatsSyncInProgress = false;",
      "let gameStatsSyncRequested = false;",
      "let gameStatsSyncPromise = null;",
      "let gameStatsManualRefreshInProgress = false;",
      `let gameStatsSubmissionQueue = ${JSON.stringify(submissions)};`,
      "const gameStatsConfirmedEvents = new Map();",
      `const eventResponses = ${JSON.stringify(eventResponses)};`,
      "const eventRequests = [];",
      "let authenticationRequests = 0;",
      "let proofClears = 0;",
      "let confirmedEvents = [];",
      "const isGameStatsBackendConfigured = () => true;",
      "const normalizeGameStatsEventProfile = (profile) => ({ id: profile.id, name: profile.name, icon: profile.icon });",
      'const isGameStatsAdministratorProfile = (profile) => profile?.id === "player-rohin-neko" && profile.name === "rohin ^.^" && profile.icon === "assets/neko-assets/sprites/yawn1.png";',
      "const getAdministratorEventHeaders = (profile) => isGameStatsAdministratorProfile(profile) && administratorProof ? { Authorization: `Bearer ${administratorProof}` } : {};",
      "const clearGameStatsAdministratorProof = () => { administratorProof = null; proofClears += 1; };",
      "const requestGameStatsAdministratorAuthentication = () => { authenticationRequests += 1; };",
      "const fetchGameStatsApi = async (path, options) => {",
      '  if (path === "/events") {',
      "    eventRequests.push({ authorization: options.headers.Authorization || '', body: JSON.parse(options.body) });",
      "    const scripted = eventResponses.shift() || { status: 201, body: { ok: true, applied: true } };",
      "    if (Number.isFinite(scripted.advanceTo)) Date.now = () => scripted.advanceTo;",
      "    return { ok: scripted.status < 400, status: scripted.status, json: async () => scripted.body };",
      "  }",
      "  return { ok: true, status: 200, json: async () => ({ totals: {} }) };",
      "};",
      extractSource(source, "const readGameStatsApiJson =", "\n\nlet gameStatsSessionSequence"),
      "const normalizeGameStatsData = (payload) => ({ ...payload });",
      "const reconcileConfirmedGameStatsEvents = (data) => data;",
      "const markGameStatsEventConfirmed = (event) => { confirmedEvents.push(event.id); };",
      "const saveGameStatsSubmissionQueue = () => {};",
      "const isGameStatsSessionExpired = (session) => new Date(session?.expiresAt || '').getTime() <= Date.now();",
      "const renderGameStatsWindows = () => {};",
      "const setGameStatsSyncState = (state, { message = '' } = {}) => {",
      "  gameStatsSyncState = state;",
      "  gameStatsSyncMessage = message || (state === 'ready' ? 'Global stats are up to date.' : state);",
      "};",
      syncSource,
      "globalThis.syncForTest = syncQueuedGameStats;",
      "globalThis.readForTest = () => ({ administratorProof, authenticationRequests, confirmedEvents, eventRequests, gameStatsSubmissionQueue, gameStatsSyncMessage, gameStatsSyncState, proofClears });",
    ].join("\n"),
    context
  );
  return context;
};

/**
 * The Worker acknowledges a duplicate with the event id that already stands,
 * which is not the one that was submitted. That submission stored nothing, so
 * confirming it would add a second win to the browser's totals that no later
 * refresh could ever take back: the reconciliation only drops a confirmed
 * event once its own id appears in the server's list, and a losing id never
 * does.
 */
test("a superseded duplicate is dropped from the queue without being counted", async () => {
  const context = await loadSyncHarness({
    submissions: [createSubmission("event-duplicate-loser")],
    eventResponses: [
      {
        status: 200,
        body: { ok: true, applied: false, eventId: "event-duplicate-winner" },
      },
    ],
    proof: "valid.proof",
  });

  await context.syncForTest();
  const state = jsonClone(context.readForTest());

  assert.equal(state.eventRequests.length, 1);
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.deepEqual(state.confirmedEvents, []);
  assert.equal(state.gameStatsSyncState, "ready");
  assert.equal(state.gameStatsSyncMessage, "Global stats are up to date.");
});

test("a result the Worker stored under its own id is still confirmed", async () => {
  const context = await loadSyncHarness({
    submissions: [createSubmission("event-duplicate-winner")],
    eventResponses: [
      {
        status: 201,
        body: { ok: true, applied: true, eventId: "event-duplicate-winner" },
      },
    ],
    proof: "valid.proof",
  });

  await context.syncForTest();
  const state = jsonClone(context.readForTest());

  assert.deepEqual(state.confirmedEvents, ["event-duplicate-winner"]);
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
});

test("an expired queued result is reported separately while valid queued work publishes", async () => {
  const expired = createSubmission("event-expired");
  expired.session.expiresAt = new Date(0).toISOString();
  const valid = createSubmission("event-valid");
  const context = await loadSyncHarness({
    submissions: [expired, valid],
    eventResponses: [
      { status: 201, body: { ok: true, applied: true, eventId: "event-valid" } },
    ],
    proof: "valid.proof",
  });

  await context.syncForTest();
  const state = jsonClone(context.readForTest());

  assert.deepEqual(state.eventRequests.map(({ body }) => body.event.id), ["event-valid"]);
  assert.deepEqual(state.confirmedEvents, ["event-valid"]);
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(state.gameStatsSyncState, "session-expired");
});

test("a session that expires during an event rejection reports expiry, not verification failure", async () => {
  const submission = createSubmission("event-expired-in-flight");
  const expiresAtMs = Date.parse(submission.session.expiresAt);
  const context = await loadSyncHarness({
    submissions: [submission],
    eventResponses: [
      {
        status: 403,
        body: { ok: false, error: "Stored game session does not match this result" },
        advanceTo: expiresAtMs,
      },
    ],
    proof: "valid.proof",
  });

  await context.syncForTest();
  const state = jsonClone(context.readForTest());
  assert.equal(state.eventRequests.length, 1);
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(state.gameStatsSyncState, "session-expired");
  assert.notEqual(state.gameStatsSyncMessage, REJECTED_MESSAGE);
});

test("an expired session clears a rejected Administrator proof without asking to renew it", async () => {
  const submission = createSubmission("event-expired-with-rejected-proof");
  const expiresAtMs = Date.parse(submission.session.expiresAt);
  const context = await loadSyncHarness({
    submissions: [submission],
    eventResponses: [
      {
        status: 403,
        body: { ok: false, code: "administrator-authorization", error: "Rejected proof" },
        advanceTo: expiresAtMs,
      },
    ],
    proof: "valid.proof",
  });

  await context.syncForTest();
  const state = jsonClone(context.readForTest());
  assert.equal(state.eventRequests.length, 1);
  assert.equal(state.administratorProof, null);
  assert.equal(state.proofClears, 1);
  assert.equal(state.authenticationRequests, 0);
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(state.gameStatsSyncState, "session-expired");
  assert.notEqual(state.gameStatsSyncMessage, REJECTED_MESSAGE);
});

const REJECTED_MESSAGE =
  "Local stats are saved, but a result could not pass server verification.";

test("a rejected game session keeps the Administrator proof and does not reopen sign-in", async () => {
  const context = await loadSyncHarness({
    submissions: [createSubmission("event-session-rejected")],
    eventResponses: [
      { status: 403, body: { ok: false, error: "Session proof does not match this result" } },
    ],
    proof: "valid.proof",
  });

  await context.syncForTest();
  const state = jsonClone(context.readForTest());

  assert.equal(state.eventRequests.length, 1);
  assert.equal(state.eventRequests[0].authorization, "Bearer valid.proof");
  assert.equal(state.administratorProof, "valid.proof");
  assert.equal(state.proofClears, 0);
  assert.equal(state.authenticationRequests, 0);
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.deepEqual(state.confirmedEvents, []);
  assert.equal(state.gameStatsSyncState, "ready");
  assert.equal(state.gameStatsSyncMessage, REJECTED_MESSAGE);
});

test("a missing Administrator proof keeps the result queued and requests sign-in", async () => {
  const context = await loadSyncHarness({
    submissions: [createSubmission("event-missing-proof")],
    eventResponses: [
      {
        status: 403,
        body: {
          ok: false,
          error: "Administrator authorization is invalid",
          code: "administrator-authorization",
        },
      },
    ],
    proof: null,
  });

  await context.syncForTest();
  const state = jsonClone(context.readForTest());

  assert.equal(state.eventRequests[0].authorization, "");
  assert.equal(state.authenticationRequests, 1);
  assert.equal(state.proofClears, 0);
  assert.equal(state.gameStatsSubmissionQueue.length, 1);
  assert.equal(state.gameStatsSubmissionQueue[0].proofRejections, 0);
  assert.equal(state.gameStatsSyncState, "auth-required");
});

test("a coded proof rejection clears the proof and renews sign-in exactly once", async () => {
  const rejection = {
    status: 403,
    body: {
      ok: false,
      error: "Administrator authorization is invalid",
      code: "administrator-authorization",
    },
  };
  const context = await loadSyncHarness({
    submissions: [createSubmission("event-proof-rejected")],
    eventResponses: [rejection, rejection],
    proof: "stale.proof",
  });

  await context.syncForTest();
  let state = jsonClone(context.readForTest());
  assert.equal(state.eventRequests.length, 1);
  assert.equal(state.administratorProof, null);
  assert.equal(state.proofClears, 1);
  assert.equal(state.authenticationRequests, 1);
  assert.equal(state.gameStatsSubmissionQueue.length, 1);
  assert.equal(state.gameStatsSubmissionQueue[0].proofRejections, 1);
  assert.equal(state.gameStatsSyncState, "auth-required");

  // A fresh sign-in installs a new proof, and the Worker rejects it again.
  vm.runInContext('administratorProof = "renewed.proof";', context);
  await context.syncForTest();
  state = jsonClone(context.readForTest());
  assert.equal(state.eventRequests.length, 2);
  assert.equal(state.eventRequests[1].authorization, "Bearer renewed.proof");
  assert.equal(state.administratorProof, null, "A rejected proof is never kept.");
  assert.equal(state.proofClears, 2);
  assert.equal(state.authenticationRequests, 1, "Sign-in must not reopen a second time.");
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(state.gameStatsSyncState, "ready");
  assert.equal(state.gameStatsSyncMessage, REJECTED_MESSAGE);
});

test("a queued result with a non-canonical protected identity is dropped without a request", async () => {
  const submission = createSubmission("event-non-canonical-identity");
  submission.event.profile.name = "not rohin";
  const context = await loadSyncHarness({
    submissions: [submission],
    eventResponses: [],
    proof: "valid.proof",
  });

  await context.syncForTest();
  const state = jsonClone(context.readForTest());

  assert.deepEqual(state.eventRequests, [], "No credentials can repair the identity.");
  assert.equal(state.authenticationRequests, 0);
  assert.equal(state.proofClears, 0);
  assert.equal(state.administratorProof, "valid.proof");
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(state.gameStatsSyncState, "ready");
  assert.equal(state.gameStatsSyncMessage, REJECTED_MESSAGE);
});

test("a renewed proof publishes the queued protected result", async () => {
  const context = await loadSyncHarness({
    submissions: [createSubmission("event-renewed-proof", 1)],
    eventResponses: [{ status: 201, body: { ok: true, applied: true } }],
    proof: "renewed.proof",
  });

  await context.syncForTest();
  const state = jsonClone(context.readForTest());

  assert.deepEqual(state.confirmedEvents, ["event-renewed-proof"]);
  assert.equal(state.administratorProof, "renewed.proof");
  assert.equal(state.authenticationRequests, 0);
  assert.deepEqual(state.gameStatsSubmissionQueue, []);
  assert.equal(state.gameStatsSyncState, "ready");
});

test("stored proof rejection counts survive queue normalization", async () => {
  const source = await readHomeScript("gameStats");
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const normalizeGameStatsEvent = (event) => event ? { ...event } : null;",
      "const normalizeGameStatsSession = (session) => session ? { ...session } : null;",
      extractSource(
        source,
        "const normalizeGameStatsSubmission =",
        "\n\nconst loadGameStatsSubmissionQueue"
      ),
      "globalThis.normalizeForTest = normalizeGameStatsSubmission;",
    ].join("\n"),
    context
  );

  const normalize = (rawSubmission) => jsonClone(context.normalizeForTest(rawSubmission));
  assert.equal(normalize(null), null);
  assert.equal(normalize({ event: null }), null);
  assert.deepEqual(normalize({ event: { id: "a" }, session: { id: "s" } }), {
    event: { id: "a" },
    session: { id: "s" },
    proofRejections: 0,
  });
  assert.deepEqual(normalize({ event: { id: "a" }, session: null, proofRejections: 2 }), {
    event: { id: "a" },
    session: null,
    proofRejections: 2,
  });
  for (const invalid of [-1, 1.5, "3", Number.NaN, Number.POSITIVE_INFINITY, {}]) {
    assert.equal(
      normalize({ event: { id: "a" }, session: null, proofRejections: invalid }).proofRejections,
      0
    );
  }
});
