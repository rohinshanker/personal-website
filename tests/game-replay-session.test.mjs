import assert from "node:assert/strict";
import test from "node:test";

import "../scripts/home/games/rules.js";
import "../scripts/home/games/session.js";

const rules = globalThis.homeGameRules;
const { createGameSession, replayHash, normalizeIssuedGame, normalizeIssuedTiming } = globalThis.homeGameSession;
const config = { difficulty: "easy" };
const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
};

const makeDescriptor = async (overrides = {}) => {
  const initial = { values: [0, 1], seed: 17 };
  return {
    id: "session-replay-001", gameId: "session-replay-001", token: "synthetic-session-proof",
    game: "sudoku", config, resultProtocol: 2, rulesVersion: 1, replayVersion: 1,
    generatorVersion: 1, expiresAt: new Date(Date.now() + 60_000).toISOString(),
    initial, initialCommitment: await replayHash(initial),
    timing: { revision: 0, phase: "ready", elapsedMs: 0 },
    limits: { ...rules.GAME_RULE_LIMITS.sudoku }, ...overrides,
  };
};

const harness = async ({ descriptor = null, intercept } = {}) => {
  const issued = descriptor || await makeDescriptor();
  const state = { statsSession: "" };
  const requests = []; const errors = [];
  let timing = issued.timing;
  const request = async (path, payload, options = {}) => {
    requests.push({ path, payload: structuredClone(payload), options });
    const intercepted = intercept?.(path, payload, options);
    if (intercepted !== undefined) return intercepted;
    if (path === "/sessions") return structuredClone(issued);
    if (path.endsWith("/timing")) {
      timing = {
        revision: timing.revision + 1,
        phase: payload.operation === "pause" ? "paused" : "running", elapsedMs: 2500,
      };
      return { ok: true, timing };
    }
    if (path.endsWith("/restore")) return { ...structuredClone(issued), timing };
    if (path.endsWith("/finish")) return {
      ok: true,
      completion: {
        id: "completion-replay-001", token: "synthetic-completion-proof",
        expiresAt: issued.expiresAt, elapsedMs: 32000,
        event: {
          id: payload.eventId, game: "sudoku", type: "win", difficulty: "easy",
          hintBucket: "noHints", metric: 32, metricKind: "seconds",
          occurredAt: "2026-10-06T12:00:00.000Z",
        },
      },
    };
    throw new Error(`Unexpected route ${path}`);
  };
  const session = createGameSession({
    game: "sudoku", getState: () => state, request, buildVersion: `sha256-${"a".repeat(64)}`,
    reportFailure: (error) => errors.push(error),
  });
  return { session, state, requests, errors, issued };
};

test("issued session binds ordered inputs and immutable pause prefixes", async () => {
  const { session, state, requests } = await harness();
  const issued = await session.issueGame(config);
  assert.equal(state.statsSession, issued.sessionKey);
  assert.equal(session.hasIssuedGame(), true);
  session.recordInput({ op: "edit", index: 2, value: "3" });
  await session.resumeGame();
  session.recordInput({ op: "edit", index: 3, value: "4" });
  await session.pauseGame();
  const paused = session.exportGame();
  session.recordInput({ op: "edit", index: 4, value: "5" });
  await session.resumeGame();
  const calls = requests.filter(({ path }) => path.endsWith("/timing"));
  assert.equal(calls[0].payload.inputCount, 0);
  assert.equal(calls[0].payload.inputHash, await replayHash([]));
  assert.equal(calls[1].payload.inputCount, 2);
  assert.equal(calls[1].options.keepalive, true);
  assert.equal(calls[2].payload.inputHash, await replayHash(paused.inputs));
  assert.deepEqual(session.exportGame().inputs.map(({ seq }) => seq), [1, 2, 3]);
  paused.inputs[0].value = "9";
  assert.equal(session.exportGame().inputs[0].value, "3");
});

test("claiming is synchronous, survives reset and reserves one immutable finish", async () => {
  const pendingFinish = deferred();
  const { session, state, requests, issued } = await harness({
    intercept: (path) => path.endsWith("/finish") ? pendingFinish.promise : undefined,
  });
  await session.issueGame(config); await session.resumeGame();
  session.recordInput({ op: "edit", index: 1, value: "2" });
  const claim = session.claimCompletion();
  assert.equal(state.statsSession, "");
  assert.equal(session.claimCompletion(), null);
  const result = claim.finish("event-replay-001");
  assert.equal(claim.finish("event-replay-001"), result);
  assert.throws(() => claim.finish("event-replay-002"), /different result/);
  await session.issueGame(config);
  session.dropSession();
  pendingFinish.resolve({ completion: {
    id: "completion-replay-001", token: "synthetic-completion-proof", expiresAt: issued.expiresAt,
    elapsedMs: 32000, event: { id: "event-replay-001", game: "sudoku", metric: 32 },
  } });
  assert.equal((await result).event.metric, 32);
  assert.equal(requests.filter(({ path }) => path.endsWith("/finish")).length, 1);
});

test("replacing or dropping pending issuance aborts it and ignores its late response", async () => {
  const first = deferred(); let issues = 0;
  const { session, requests, errors } = await harness({
    intercept: (path) => path === "/sessions" && ++issues === 1 ? first.promise : undefined,
  });
  const older = session.issueGame(config);
  const newer = await session.issueGame(config, { firstCell: 3 });
  assert.equal(requests[0].options.signal.aborted, true);
  first.resolve(await makeDescriptor());
  assert.equal(await older, null);
  assert.equal(session.exportGame().descriptor.id, newer.id);
  assert.equal(requests[1].payload.firstCell, 3);
  assert.deepEqual(errors, []);
  session.dropSession();
  assert.equal(session.hasIssuedGame(), false);
  assert.equal(session.exportGame(), null);
  assert.equal(session.recordInput({ op: "edit" }), false);
  assert.equal(await session.pauseGame(), null);
  assert.equal(await session.resumeGame(), null);
});

test("timing transitions coalesce no-ops and reject unacknowledged or out-of-order timing", async () => {
  const { session, requests } = await harness();
  await session.issueGame(config);
  await session.pauseGame();
  await session.resumeGame(); await session.resumeGame();
  assert.equal(requests.filter(({ path }) => path.endsWith("/timing")).length, 1);
  const bad = await harness({ intercept: (path) => path.endsWith("/timing")
    ? { timing: { revision: 0, phase: "running", elapsedMs: 0 } } : undefined });
  await bad.session.issueGame(config);
  assert.equal(await bad.session.resumeGame(), null);
  assert.equal(bad.session.hasIssuedGame(), false);
  await assert.rejects(bad.session.claimCompletion().finish("event-bad-timing"), /out of order/);
  const neverStarted = await harness();
  await neverStarted.session.issueGame(config);
  await assert.rejects(neverStarted.session.claimCompletion().finish("event-not-started"), /not acknowledged/);
});

test("request failure keeps gameplay local and cannot later invent timing evidence", async () => {
  const unavailable = await harness({ intercept: (path) => path === "/sessions"
    ? Promise.reject(new Error("offline")) : undefined });
  assert.equal(await unavailable.session.issueGame(config), null);
  assert.equal(unavailable.errors[0].message, "offline");
  await assert.rejects(unavailable.session.claimCompletion().finish("event-offline-001"), /offline/);
  const pauseFailure = await harness({ intercept: (path, body) => path.endsWith("/timing") && body.operation === "pause"
    ? Promise.reject(new Error("lost pause")) : undefined });
  await pauseFailure.session.issueGame(config); await pauseFailure.session.resumeGame();
  assert.equal(await pauseFailure.session.pauseGame(), null);
  assert.equal(pauseFailure.session.exportGame(), null);
  await assert.rejects(pauseFailure.session.claimCompletion().finish("event-offline-002"), /lost pause/);
});

test("expired sessions and malformed issuance cannot acquire a replacement proof", async () => {
  for (const descriptor of [
    await makeDescriptor({ expiresAt: new Date(0).toISOString() }),
    await makeDescriptor({ initialCommitment: "b".repeat(64) }),
    await makeDescriptor({ game: "snake" }),
  ]) {
    const { session, requests } = await harness({ descriptor });
    assert.equal(await session.issueGame(config), null);
    await assert.rejects(session.claimCompletion().finish("event-invalid-001"));
    assert.equal(requests.length, 1);
  }
});

test("restoration retains original proof and validated paused transcript", async () => {
  const { session, requests, issued } = await harness();
  await session.issueGame(config); await session.resumeGame();
  session.recordInput({ op: "edit", index: 1, value: "2" });
  await session.pauseGame();
  const saved = session.exportGame();
  const restored = await session.restoreGame(saved);
  assert.equal(restored.id, issued.id);
  assert.deepEqual(restored.inputs, saved.inputs);
  const restores = requests.filter(({ path }) => path.endsWith("/restore"));
  assert.equal(restores[0].payload.inputCount, 1);
  assert.equal(requests.filter(({ path }) => path === "/sessions").length, 1);
  assert.equal(await session.restoreGame({ eligible: false }), null);
  assert.equal(await session.restoreGame({ ...saved, inputs: [{ seq: 2, op: "edit" }] }), null);
  const changed = await harness({ intercept: (path) => path.endsWith("/restore")
    ? { ...issued, timing: { revision: 2, phase: "paused", elapsedMs: 1000 }, id: "session-other-001", gameId: "session-other-001" } : undefined });
  assert.equal(await changed.session.restoreGame(saved), null);
});

test("input and byte bounds stop publication without truncating a transcript", async () => {
  const limited = await harness({ descriptor: await makeDescriptor({ limits: {
    ...rules.GAME_RULE_LIMITS.sudoku, inputs: 1,
  } }) });
  await limited.session.issueGame(config);
  assert.equal(limited.session.recordInput({ op: "edit" }), true);
  assert.equal(limited.session.recordInput({ op: "undo" }), false);
  assert.equal(limited.session.hasIssuedGame(), false);
  const bytes = await harness({ descriptor: await makeDescriptor({ limits: {
    ...rules.GAME_RULE_LIMITS.sudoku, bytes: 8,
  } }) });
  await bytes.session.issueGame(config); await bytes.session.resumeGame();
  await assert.rejects(bytes.session.claimCompletion().finish("event-too-large-001"), /body limit/);
  assert.equal(bytes.requests.some(({ path }) => path.endsWith("/finish")), false);
});

test("normalization and action guards reject incompatible descriptor fields", async () => {
  assert.throws(() => createGameSession({ game: "unknown", getState: () => ({}), request: () => {} }));
  assert.throws(() => normalizeIssuedTiming({ phase: "invalid", revision: 0, elapsedMs: 0 }));
  const descriptor = await makeDescriptor();
  for (const [field, value] of [
    ["id", "x"], ["gameId", "another-session"], ["token", ""],
    ["resultProtocol", 1], ["rulesVersion", 2], ["replayVersion", 2],
    ["generatorVersion", 2], ["initialCommitment", "x"], ["expiresAt", "x"],
    ["config", {}], ["initial", null], ["limits", {}],
  ]) assert.throws(() => normalizeIssuedGame({ ...descriptor, [field]: value }, "sudoku", config));
  const { session } = await harness(); await session.issueGame(config);
  for (const input of [null, [], {}, { seq: 1, op: "edit" }]) {
    assert.throws(() => session.recordInput(input));
  }
});

test("finishing rejects a substituted completion identity or expiry", async () => {
  const { session } = await harness({ intercept: (path) => path.endsWith("/finish")
    ? { completion: { id: "other", token: "x", expiresAt: new Date(0).toISOString(), event: { id: "other" } } } : undefined });
  await session.issueGame(config); await session.resumeGame();
  await assert.rejects(session.claimCompletion().finish("event-result-001"), /receipt/);
});

test("bounded completion continuations preserve the original proof and one final result", async () => {
  let chunks = 0;
  const pending = await harness({ intercept: (path, body) => {
    if (path.endsWith("/finish")) return { progress: { id: "progress-replay-001", token: "progress-synthetic-001" } };
    if (path.endsWith("/finish/continue")) {
      assert.deepEqual(body.session, { id: "session-replay-001", token: "synthetic-session-proof" });
      chunks += 1;
      if (chunks === 1) return { progress: { id: "progress-replay-001", token: "progress-synthetic-002" } };
      return { completion: {
        id: "completion-replay-001", token: "synthetic-completion-proof",
        expiresAt: pending.issued.expiresAt, elapsedMs: 32000,
        event: { id: "event-chunks-001", game: "sudoku", metric: 32 },
      } };
    }
    return undefined;
  } });
  await pending.session.issueGame(config); await pending.session.resumeGame();
  assert.equal((await pending.session.claimCompletion().finish("event-chunks-001")).event.metric, 32);
  assert.equal(chunks, 2);
  assert.equal(pending.requests.filter(({ path }) => path.endsWith("/finish")).length, 1);
});

test("malformed and nonterminating continuation receipts cannot run without bounds", async () => {
  for (const progress of [
    { id: "x", token: "x" }, { id: "progress-replay-001", token: "" },
    { id: "progress-replay-001", token: "x".repeat(2049) },
    { id: "progress-replay-001", token: "progress-synthetic" },
  ]) {
    const fixture = await harness({
      descriptor: await makeDescriptor({ limits: { ...rules.GAME_RULE_LIMITS.sudoku, continuations: 2 } }),
      intercept: (path) => path.includes("/finish") ? { progress } : undefined,
    });
    await fixture.session.issueGame(config); await fixture.session.resumeGame();
    await assert.rejects(fixture.session.claimCompletion().finish("event-never-finished"));
    assert.equal(fixture.requests.filter(({ path }) => path.endsWith("/finish/continue")).length <= 2, true);
  }
});
