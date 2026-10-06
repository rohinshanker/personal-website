import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../scripts/home/features/game-stats.js", import.meta.url), "utf8");
const extract = (start, end) => {
  const first = source.indexOf(start); const last = source.indexOf(end, first);
  assert.equal(first >= 0 && last > first, true);
  return source.slice(first, last);
};
const plain = (value) => JSON.parse(JSON.stringify(value));
const profile = { id: "player-canonical-001", name: "Player", icon: "assets/app-icons/ico/user_card.ico" };
const event = (id, metric) => ({
  id, game: "sudoku", type: "win", difficulty: "easy", hintBucket: "noHints",
  metric, metricKind: "seconds", occurredAt: "2026-10-06T00:00:00.000Z", profile,
});
const prior = {
  eventId: "event-before-canonical", playerId: profile.id, name: profile.name, icon: profile.icon,
  metric: 30, metricKind: "seconds", occurredAt: "2026-10-05T00:00:00.000Z",
};
const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
};

const load = () => {
  const data = {
    eventIds: [], totals: { sudoku: { wins: { easy: { noHints: 0, withHints: 0 } }, bestTimes: { easy: 30 } } },
    leaderboards: { sudoku: { easy: [prior] } }, playerRecords: { sudoku: { easy: prior } },
  };
  const context = vm.createContext({});
  vm.runInContext([
    `let gameStatsProfile = ${JSON.stringify(profile)};`,
    `let gameStatsLocalState = ${JSON.stringify(data)};`,
    `const gameStatsGlobalState = ${JSON.stringify(data)};`,
    "let gameStatsLocalResetGeneration = 0;",
    "let saves = 0; let handoffs = 0; const submissions = []; const callbacks = [];",
    "let gameStatsSyncState = 'ready'; let gameStatsSyncMessage = '';",
    "const normalizeGameStatsEvent = (value) => value ? { ...value } : null;",
    "const normalizeGameStatsEventProfile = (value) => value ? { ...value } : null;",
    "const gameStatsOptionalPositiveInteger = (value) => Number.isFinite(value) ? value : null;",
    "const gameStatsEventQualifiesForLeaderboard = () => true;",
    "const saveGameStatsLocalState = () => { saves += 1; };",
    "const playGameStatsRecordHandoff = async () => { handoffs += 1; };",
    "const getGameStatsSession = () => { throw new Error('Verified results must not get a legacy proof'); };",
    "const queueGameStatsSubmission = (event, session, completion) => submissions.push({ event: { ...event }, session, completion });",
    "const isGameStatsSessionExpired = (proof) => Date.parse(proof.expiresAt) <= Date.now();",
    "const setGameStatsSyncState = (state, {message=''}={}) => { gameStatsSyncState=state; gameStatsSyncMessage=message; };",
    "const reportGameStatsSessionFailure = (result, {localSaved}={}) => setGameStatsSyncState(`http-${result.status}`, {message:localSaved ? 'Saved locally' : ''});",
    "const syncQueuedGameStats = () => {};",
    extract("function compareGameStatsLeaderboardEntries", "\n\nconst createGameStatsEventId"),
    extract("const createGameStatsLeaderboardEntry =", "\n\nconst applyConfirmedGameStatsEventToTotals"),
    extract("const updateGameStatsSudokuBestTime =", "\n\nconst gameStatsEventQualifiesForData"),
    extract("const gameStatsCanonicalMetricGroups =", "\n\nconst formatGameStatsCounter"),
    "globalThis.record = (event, completionPromise) => recordGameStatsEvent(event, '', { completionPromise, sudokuNoHintsSeconds:event?.metric, onCanonicalMetric: (result) => callbacks.push(result) });",
    "globalThis.read = () => ({data:gameStatsLocalState, saves, handoffs, submissions, callbacks, gameStatsSyncState, gameStatsSyncMessage, corrections:gameStatsCanonicalMetricGroups.size});",
    "globalThis.reset = () => { gameStatsLocalResetGeneration += 1; gameStatsLocalState.eventIds=[]; gameStatsLocalState.totals.sudoku.wins.easy.noHints=0; gameStatsLocalState.totals.sudoku.bestTimes.easy=null; gameStatsLocalState.leaderboards.sudoku.easy=[]; gameStatsLocalState.playerRecords.sudoku.easy=null; };",
  ].join("\n"), context);
  return context;
};
const completion = (raw, metric) => ({
  id: "completion-canonical-001", token: "synthetic-completion-proof",
  expiresAt: new Date(Date.now() + 60_000).toISOString(), elapsedMs: metric * 1000 + 500,
  event: { ...raw, metric, occurredAt: "2026-10-06T00:01:00.000Z" },
});

test("a canonical clock corrects local records without double-counting a win", async () => {
  const context = load(); const pending = deferred(); const raw = event("event-canonical-001", 18);
  const recorded = context.record(raw, pending.promise);
  assert.equal(context.read().data.totals.sudoku.wins.easy.noHints, 1);
  assert.equal(context.read().handoffs, 0);
  pending.resolve(completion(raw, 32)); await recorded;
  const result = plain(context.read());
  assert.equal(result.data.totals.sudoku.wins.easy.noHints, 1);
  assert.equal(result.data.totals.sudoku.bestTimes.easy, 30);
  assert.equal(result.data.leaderboards.sudoku.easy[0].metric, 30);
  assert.equal(result.data.playerRecords.sudoku.easy.metric, 30);
  assert.equal(result.submissions[0].event.metric, 32);
  assert.equal(result.submissions[0].session, null);
  assert.equal(result.submissions[0].completion.id, "completion-canonical-001");
  assert.equal(result.callbacks[0].metric, 32);
  assert.equal(result.callbacks[0].updateLocalStats, true);
  assert.equal(result.handoffs, 0);
  assert.equal(result.corrections, 0);
});

test("overlapping canonical corrections retain the original best in either response order", async () => {
  for (const reverse of [false, true]) {
    const context = load(); const first = deferred(); const second = deferred();
    const a = event("event-canonical-001", 18); const b = event("event-canonical-002", 25);
    const resultA = context.record(a, first.promise); const resultB = context.record(b, second.promise);
    if (reverse) { second.resolve(completion(b, 32)); await resultB; first.resolve(completion(a, 31)); }
    else { first.resolve(completion(a, 31)); await resultA; second.resolve(completion(b, 32)); }
    await Promise.all([resultA, resultB]);
    const state = context.read();
    assert.equal(state.data.totals.sudoku.bestTimes.easy, 30);
    assert.equal(state.data.playerRecords.sudoku.easy.metric, 30);
    assert.equal(state.data.totals.sudoku.wins.easy.noHints, 2);
    assert.equal(state.submissions.length, 2);
    assert.equal(state.corrections, 0);
  }
});

test("a canonical personal record triggers the handoff after the official metric arrives", async () => {
  const context = load(); const pending = deferred(); const raw = event("event-canonical-001", 18);
  const recorded = context.record(raw, pending.promise);
  pending.resolve(completion(raw, 20)); await recorded;
  assert.equal(context.read().data.totals.sudoku.bestTimes.easy, 20);
  assert.equal(context.read().handoffs, 1);
});

test("reset during verification clears local data without retracting the reserved publication", async () => {
  const context = load(); const pending = deferred(); const raw = event("event-canonical-001", 18);
  const recorded = context.record(raw, pending.promise);
  context.reset(); pending.resolve(completion(raw, 20)); await recorded;
  assert.equal(context.read().data.totals.sudoku.wins.easy.noHints, 0);
  assert.equal(context.read().data.totals.sudoku.bestTimes.easy, null);
  assert.equal(context.read().submissions.length, 1);
  assert.equal(context.read().callbacks[0].updateLocalStats, false);
  assert.equal(context.read().handoffs, 0);
  assert.equal(context.read().corrections, 0);
});

test("expiry and replay-limit failures remain local with specific feedback", async () => {
  for (const [code, expected] of [["session-expired", "session-expired"], ["replay-limit", "ready"], ["offline", "ready"]]) {
    const context = load(); const pending = deferred(); const raw = event("event-canonical-001", 18);
    const recorded = context.record(raw, pending.promise);
    pending.reject(Object.assign(new Error(code), { code })); await recorded;
    assert.equal(context.read().data.totals.sudoku.wins.easy.noHints, 1);
    assert.equal(context.read().submissions.length, 0);
    assert.equal(context.read().gameStatsSyncState, expected);
    assert.equal(context.read().corrections, 0);
  }
});

test("a receipt with different game assertions is not published", async () => {
  const context = load(); const raw = event("event-canonical-001", 18);
  const receipt = completion(raw, 20); receipt.event.difficulty = "hard";
  await context.record(raw, Promise.resolve(receipt));
  assert.equal(context.read().submissions.length, 0);
  assert.equal(context.read().data.totals.sudoku.wins.easy.noHints, 1);
  assert.match(context.read().gameStatsSyncMessage, /could not pass server verification/);
});

test("completion authentication and rate-limit errors retain specific local-save feedback", async () => {
  for (const status of [401, 403, 429]) {
    const context = load();
    await context.record(event("event-auth-rejected", 18), Promise.reject(Object.assign(new Error("Rejected"), { status })));
    assert.equal(context.read().data.totals.sudoku.wins.easy.noHints, 1);
    assert.equal(context.read().submissions.length, 0);
    assert.equal(context.read().gameStatsSyncState, `http-${status}`);
    assert.equal(context.read().gameStatsSyncMessage, "Saved locally");
  }
});

test("an invalid event still handles its already-started completion rejection", async () => {
  const context = load();
  const pending = deferred();
  await context.record(null, pending.promise);
  pending.reject(new Error("Completion failed after event validation"));
  await new Promise(setImmediate);
  assert.equal(context.read().saves, 0);
  assert.equal(context.read().submissions.length, 0);
});
