import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  handleRequest,
  purgeExpiredGameStatsRows,
} from "../workers/game-stats/src/router.mjs";
import {
  VERSION_FIELDS,
  digestCanonical,
  replayPrefixHash,
} from "../workers/game-stats/src/verified-results.mjs";
import { SqliteD1Database, applyGameStatsMigrations } from "./helpers/sqlite-d1.mjs";

const migrationPaths = [
  "0001_create_game_stats.sql",
  "0002_add_game_stat_security.sql",
  "0003_add_sudoku_puzzle_identity.sql",
  "0004_optimize_stats_aggregation.sql",
  "0005_add_verified_game_results.sql",
].map((name) => new URL(`../workers/game-stats/migrations/${name}`, import.meta.url).pathname);

const origin = "https://rohin.shanker.me";
const buildVersion = `sha256-${"a".repeat(64)}`;
const puzzle = "1".repeat(81);

const clone = (value) => JSON.parse(JSON.stringify(value));
const checkedAction = (input, expectedOperation = "advance") => {
  if (
    !input || input.op !== expectedOperation ||
    !Number.isSafeInteger(input.seq) || input.amount !== 1
  ) throw new Error("illegal fixture action");
};

const progressEngine = (game) => ({
  generate(config, { firstCell, budget }) {
    budget.spend();
    return { game, config, firstCell: firstCell ?? null, progress: 0, target: 2, moves: 0 };
  },
  initial(raw) {
    if (!raw || raw.game !== game || raw.target !== 2) throw new Error("invalid fixture initial");
    return clone(raw);
  },
  transition(state, input, budget) {
    budget.spend();
    checkedAction(input);
    state.progress += input.amount;
    state.moves += 1;
    return state;
  },
  result(state) {
    return {
      terminal: state.progress === state.target,
      won: state.progress === state.target,
      moves: state.moves,
      assistance: 0,
    };
  },
});

const snakeEngine = {
  initial(raw) { return clone(raw); },
  generate(config, { budget }) {
    budget.spend();
    return { game: "snake", config, steps: 0, target: 2 };
  },
  transition(state, input, budget) {
    budget.spend();
    if (input.op !== "direction") throw new Error("illegal fixture snake action");
    return state;
  },
  step(state, budget) {
    budget.spend();
    state.steps += 1;
    return state;
  },
  result(state) {
    return { terminal: state.steps === state.target, lost: true, score: state.steps };
  },
};

const gameEngines = Object.freeze({
  minesweeper: progressEngine("minesweeper"),
  solitaire: progressEngine("solitaire"),
  snake: snakeEngine,
  sudoku: progressEngine("sudoku"),
});

const generateIssuedInitial = (game, config) => ({
  game,
  config,
  progress: 0,
  target: 2,
  moves: 0,
  ...(game === "sudoku" ? { puzzleId: `fixture-${config.difficulty}`, puzzle } : {}),
});

const createEnv = (database, overrides = {}) => ({
  personal_site_game_stats: database,
  ALLOWED_ORIGIN: origin,
  EVENT_SIGNING_SECRET: "test-verified-result-signing-secret",
  IP_HASH_SECRET: "test-verified-result-ip-secret",
  GAME_BUILD_VERSION: buildVersion,
  ...overrides,
});

const request = (path, body, { ip = "203.0.113.41" } = {}) => new Request(
  `https://stats.example.test${path}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "CF-Connecting-IP": ip,
    },
    body: JSON.stringify(body),
  }
);

const versioned = (body) => ({ ...VERSION_FIELDS, ...body });

const createHarness = ({
  database = new SqliteD1Database(),
  env = null,
  migrate = true,
} = {}) => {
  if (migrate) applyGameStatsMigrations(database, migrationPaths);
  let now = Date.now();
  let id = 0;
  const dependencies = {
    gameEngines,
    generateIssuedInitial,
    now: () => now,
    randomUUID: () => `verified-id-${String(++id).padStart(4, "0")}`,
  };
  const workerEnv = env || createEnv(database);
  return {
    database,
    env: workerEnv,
    dependencies,
    advance(milliseconds) {
      now += milliseconds;
    },
    currentTime() {
      return now;
    },
    async purge() {
      const originalNow = Date.now;
      Date.now = () => now;
      try {
        return await purgeExpiredGameStatsRows(workerEnv);
      } finally {
        Date.now = originalNow;
      }
    },
    async dispatch(path, body, options) {
      const originalNow = Date.now;
      Date.now = () => now;
      try {
        return await handleRequest(
          request(path, body, options),
          workerEnv,
          undefined,
          { verification: dependencies }
        );
      } finally {
        Date.now = originalNow;
      }
    },
  };
};

const issue = async (harness, game = "minesweeper", config = { difficulty: "beginner" }) => {
  const response = await harness.dispatch("/sessions", versioned({
    game,
    config,
    buildVersion,
    ...(game === "minesweeper" ? { firstCell: 0 } : {}),
  }));
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
};

const finishBody = (session, overrides = {}) => ({
  eventId: "event-verified-0001",
  session: { id: session.id, token: session.token },
  gameId: session.id,
  rulesVersion: VERSION_FIELDS.rulesVersion,
  replayVersion: VERSION_FIELDS.replayVersion,
  timingRevision: 1,
  inputs: [
    { seq: 1, op: "advance", amount: 1 },
    { seq: 2, op: "advance", amount: 1 },
  ],
  ...overrides,
});

const resumeGame = async (harness, session, expectedRevision = 0, inputs = []) =>
  harness.dispatch(`/sessions/${session.id}/timing`, {
    session: { id: session.id, token: session.token },
    expectedRevision,
    operation: "resume",
    inputCount: inputs.length,
    inputHash: await replayPrefixHash(inputs, inputs.length),
  });

const finishGame = async (harness, session, body, maximumRequests = 1_100) => {
  let response = await harness.dispatch(`/sessions/${session.id}/finish`, body);
  for (let requestCount = 0; response.status === 202; requestCount += 1) {
    assert.ok(requestCount < maximumRequests, "finish continuation loop stayed bounded");
    const { progress } = await response.json();
    response = await harness.dispatch(`/sessions/${session.id}/finish/continue`, {
      session: { id: session.id, token: session.token },
      progress,
    });
  }
  return response;
};

const profile = {
  id: "player-verified-0001",
  name: "Verified Player",
  icon: "assets/app-icons/ico/user_card.ico",
};

test("protocol 2 issues a committed game, derives its result, and publishes by receipt", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const session = await issue(harness);

  assert.equal(session.resultProtocol, 2);
  assert.equal(session.gameId, session.id);
  assert.equal(session.initial.firstCell, 0);
  assert.equal(session.limits.continuations, 8192);
  assert.match(session.initialCommitment, /^[a-f0-9]{64}$/);
  assert.equal(session.initialCommitment, await digestCanonical(session.initial));
  assert.deepEqual(session.timing, { revision: 0, phase: "ready", elapsedMs: 0 });

  assert.equal((await resumeGame(harness, session)).status, 200);
  harness.advance(2_500);
  const body = finishBody(session);
  const initialFinish = await harness.dispatch(`/sessions/${session.id}/finish`, body);
  assert.equal(initialFinish.status, 202);
  const frozenJob = harness.database.sqlite.prepare(`
    SELECT finished_at, elapsed_ms, input_cursor, continuation_limit, stage
    FROM verified_completion_jobs WHERE session_id = ?
  `).get(session.id);
  assert.equal(frozenJob.finished_at, new Date(harness.currentTime()).toISOString());
  assert.equal(frozenJob.elapsed_ms, 2_500);
  assert.equal(frozenJob.input_cursor, 0);
  assert.equal(frozenJob.continuation_limit, 8192);
  assert.equal(frozenJob.stage, "replay");
  const timingAfterFinish = await harness.dispatch(`/sessions/${session.id}/timing`, {
    session: { id: session.id, token: session.token },
    expectedRevision: 1,
    operation: "pause",
    inputCount: 0,
    inputHash: await replayPrefixHash([], 0),
  });
  assert.equal(timingAfterFinish.status, 409);
  const finished = await finishGame(harness, session, body);
  assert.equal(finished.status, 200, await finished.clone().text());
  const result = await finished.json();
  const receipt = { id: result.completion.id, token: result.completion.token };
  assert.equal(result.completion.event.metric, 2);
  assert.equal(result.completion.event.metricKind, "seconds");
  assert.equal(result.completion.elapsedMs, 2_500);

  const fabricated = await harness.dispatch("/events", {
    event: {
      ...result.completion.event,
      metric: 1,
      profile,
    },
    completion: receipt,
  });
  assert.equal(fabricated.status, 400);
  assert.match((await fabricated.json()).error, /does not match/);

  const event = {
    ...result.completion.event,
    profile,
  };
  const published = await harness.dispatch("/events", {
    event,
    completion: receipt,
  });
  assert.equal(published.status, 201, await published.clone().text());
  assert.deepEqual(await published.json(), {
    ok: true,
    applied: true,
    eventId: event.id,
  });
  const stored = harness.database.sqlite.prepare(
    "SELECT provenance, completion_id, metric FROM game_events WHERE id = ?"
  ).get(event.id);
  assert.deepEqual({ ...stored }, {
    provenance: "verified",
    completion_id: result.completion.id,
    metric: 2,
  });

  harness.advance(7 * 60 * 60 * 1000);
  harness.database.sqlite.prepare(
    "UPDATE game_stat_sessions SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?"
  ).run(session.id);
  harness.database.sqlite.prepare(
    "UPDATE verified_completion_jobs SET expires_at = '2000-01-01T00:00:00.000Z' WHERE session_id = ?"
  ).run(session.id);
  await harness.purge();
  assert.equal(harness.database.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM game_stat_sessions WHERE id = ?"
  ).get(session.id).count, 0);
  assert.equal(harness.database.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM verified_completion_jobs WHERE session_id = ?"
  ).get(session.id).count, 0);
  assert.equal(harness.database.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM verified_completion_progress"
  ).get().count, 0);
  assert.equal(harness.database.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM verified_completion_replay_chunks"
  ).get().count, 0);
  assert.equal(harness.database.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM verified_game_completions WHERE session_id = ?"
  ).get(session.id).count, 1);
  const finishRetry = await finishGame(harness, session, body);
  assert.equal(finishRetry.status, 200);
  assert.deepEqual((await finishRetry.json()).completion, result.completion);
  const publishRetry = await harness.dispatch("/events", {
    event,
    completion: receipt,
  });
  assert.equal(publishRetry.status, 200);
  assert.equal((await publishRetry.json()).applied, false);

  const conflictingRetry = await finishGame(
    harness,
    session,
    finishBody(session, { inputs: [{ seq: 1, op: "advance", amount: 1 }] })
  );
  assert.equal(conflictingRetry.status, 409);
});

test("pause and resume bind every acknowledged replay prefix and exclude paused time", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const session = await issue(harness, "sudoku", { difficulty: "easy" });
  const inputs = [
    { seq: 1, op: "advance", amount: 1 },
    { seq: 2, op: "advance", amount: 1 },
  ];
  const started = await resumeGame(harness, session);
  assert.equal(started.status, 200);
  harness.advance(1_000);
  const prefixHash = await replayPrefixHash(inputs, 1);
  const pauseBody = {
    session: { id: session.id, token: session.token },
    expectedRevision: 1,
    operation: "pause",
    inputCount: 1,
    inputHash: prefixHash,
  };
  const pause = await harness.dispatch(`/sessions/${session.id}/timing`, pauseBody);
  assert.equal(pause.status, 200, await pause.clone().text());
  assert.deepEqual((await pause.json()).timing, {
    revision: 2,
    phase: "paused",
    elapsedMs: 1_000,
  });
  const pauseRetry = await harness.dispatch(`/sessions/${session.id}/timing`, pauseBody);
  assert.equal(pauseRetry.status, 200);
  assert.deepEqual((await pauseRetry.json()).timing, {
    revision: 2,
    phase: "paused",
    elapsedMs: 1_000,
  });
  const pauseConflict = await harness.dispatch(`/sessions/${session.id}/timing`, {
    ...pauseBody,
    inputHash: await replayPrefixHash([], 0),
  });
  assert.equal(pauseConflict.status, 409);

  harness.advance(5_000);
  const resume = await harness.dispatch(`/sessions/${session.id}/timing`, {
    session: { id: session.id, token: session.token },
    expectedRevision: 2,
    operation: "resume",
    inputCount: 1,
    inputHash: prefixHash,
  });
  assert.equal(resume.status, 200);
  assert.equal((await resume.json()).timing.elapsedMs, 1_000);

  harness.advance(2_000);
  const finished = await finishGame(
    harness,
    session,
    finishBody(session, { eventId: "event-sudoku-timing", inputs, timingRevision: 3 })
  );
  assert.equal(finished.status, 200, await finished.clone().text());
  const result = await finished.json();
  assert.equal(result.completion.elapsedMs, 3_000);
  assert.equal(result.completion.event.metric, 3);
  assert.equal(result.completion.event.puzzleId, "fixture-easy");
  assert.equal(result.completion.event.hintBucket, "noHints");
});

test("an acknowledged paused terminal prefix finishes at its frozen elapsed boundary", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const session = await issue(harness, "sudoku", { difficulty: "easy" });
  const inputs = [
    { seq: 1, op: "advance", amount: 1 },
    { seq: 2, op: "advance", amount: 1 },
  ];
  assert.equal((await resumeGame(harness, session)).status, 200);
  harness.advance(1_200);
  const pause = await harness.dispatch(`/sessions/${session.id}/timing`, {
    session: { id: session.id, token: session.token },
    expectedRevision: 1,
    operation: "pause",
    inputCount: inputs.length,
    inputHash: await replayPrefixHash(inputs, inputs.length),
  });
  assert.equal(pause.status, 200, await pause.clone().text());
  assert.deepEqual((await pause.json()).timing, {
    revision: 2,
    phase: "paused",
    elapsedMs: 1_200,
  });

  harness.advance(10_000);
  const body = finishBody(session, {
    eventId: "event-paused-terminal-prefix",
    inputs,
    timingRevision: 2,
  });
  const started = await harness.dispatch(`/sessions/${session.id}/finish`, body);
  assert.equal(started.status, 202, await started.clone().text());
  const resumeAfterFinish = await harness.dispatch(`/sessions/${session.id}/timing`, {
    session: { id: session.id, token: session.token },
    expectedRevision: 2,
    operation: "resume",
    inputCount: inputs.length,
    inputHash: await replayPrefixHash(inputs, inputs.length),
  });
  assert.equal(resumeAfterFinish.status, 409);
  const frozen = harness.database.sqlite.prepare(`
    SELECT elapsed_ms, finished_at, expires_at
    FROM verified_completion_jobs WHERE session_id = ?
  `).get(session.id);
  assert.equal(frozen.elapsed_ms, 1_200);
  assert.equal(frozen.finished_at, new Date(harness.currentTime()).toISOString());
  assert.equal(frozen.expires_at, session.expiresAt);

  const finished = await finishGame(harness, session, body);
  assert.equal(finished.status, 200, await finished.clone().text());
  const { completion } = await finished.json();
  assert.equal(completion.elapsedMs, 1_200);
  assert.equal(completion.expiresAt, session.expiresAt);
  assert.equal(completion.event.occurredAt, frozen.finished_at);
  assert.deepEqual({ ...harness.database.sqlite.prepare(`
    SELECT timing_verified_revision, stage FROM verified_completion_jobs WHERE session_id = ?
  `).get(session.id) }, { timing_verified_revision: 2, stage: "completed" });
});

test("paused finish rejects extra inputs and a mutated committed terminal prefix", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const inputs = [
    { seq: 1, op: "advance", amount: 1 },
    { seq: 2, op: "advance", amount: 1 },
  ];
  const pauseAtTerminal = async (session) => {
    assert.equal((await resumeGame(harness, session)).status, 200);
    harness.advance(1_000);
    const response = await harness.dispatch(`/sessions/${session.id}/timing`, {
      session: { id: session.id, token: session.token },
      expectedRevision: 1,
      operation: "pause",
      inputCount: inputs.length,
      inputHash: await replayPrefixHash(inputs, inputs.length),
    });
    assert.equal(response.status, 200, await response.clone().text());
  };

  const minesweeper = await issue(harness);
  assert.equal((await resumeGame(harness, minesweeper)).status, 200);
  const minesweeperPause = await harness.dispatch(`/sessions/${minesweeper.id}/timing`, {
    session: { id: minesweeper.id, token: minesweeper.token },
    expectedRevision: 1,
    operation: "pause",
    inputCount: 0,
    inputHash: await replayPrefixHash([], 0),
  });
  assert.equal(minesweeperPause.status, 409);

  const extraSession = await issue(harness, "sudoku", { difficulty: "easy" });
  await pauseAtTerminal(extraSession);
  const extra = await harness.dispatch(`/sessions/${extraSession.id}/finish`, finishBody(
    extraSession,
    {
      eventId: "event-paused-extra-input",
      inputs: [...inputs, { seq: 3, op: "advance", amount: 1 }],
      timingRevision: 2,
    }
  ));
  assert.equal(extra.status, 409);
  assert.equal(harness.database.sqlite.prepare(`
    SELECT COUNT(*) AS count FROM verified_completion_jobs WHERE session_id = ?
  `).get(extraSession.id).count, 0);
  assert.equal(harness.database.sqlite.prepare(`
    SELECT timing_phase FROM game_stat_sessions WHERE id = ?
  `).get(extraSession.id).timing_phase, "paused");

  const mutatedSession = await issue(harness, "sudoku", { difficulty: "easy" });
  await pauseAtTerminal(mutatedSession);
  const mutatedInputs = [inputs[0], { ...inputs[1], padding: "changed" }];
  const mutatedBody = finishBody(mutatedSession, {
    eventId: "event-paused-mutated-prefix",
    inputs: mutatedInputs,
    timingRevision: 2,
  });
  const mutated = await finishGame(harness, mutatedSession, mutatedBody);
  assert.equal(mutated.status, 400);
  assert.match((await mutated.json()).error, /acknowledged timing evidence/);
  assert.equal(harness.database.sqlite.prepare(`
    SELECT COUNT(*) AS count FROM verified_game_completions WHERE session_id = ?
  `).get(mutatedSession.id).count, 0);
});

test("paused finish and resume race to one atomic timing transition", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "verified-paused-finish-race-"));
  const databasePath = join(directory, "stats.sqlite");
  const firstDatabase = new SqliteD1Database(databasePath);
  applyGameStatsMigrations(firstDatabase, migrationPaths);
  const secondDatabase = new SqliteD1Database(databasePath);
  const first = createHarness({
    database: firstDatabase,
    env: createEnv(firstDatabase),
    migrate: false,
  });
  let sequence = 500;
  const second = {
    database: secondDatabase,
    env: createEnv(secondDatabase),
    dependencies: {
      gameEngines,
      generateIssuedInitial,
      now: () => first.currentTime(),
      randomUUID: () => `verified-id-${++sequence}`,
    },
  };
  t.after(() => {
    firstDatabase.close();
    secondDatabase.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const session = await issue(first, "sudoku", { difficulty: "easy" });
  const inputs = [
    { seq: 1, op: "advance", amount: 1 },
    { seq: 2, op: "advance", amount: 1 },
  ];
  const inputHash = await replayPrefixHash(inputs, inputs.length);
  assert.equal((await resumeGame(first, session)).status, 200);
  first.advance(1_000);
  assert.equal((await first.dispatch(`/sessions/${session.id}/timing`, {
    session: { id: session.id, token: session.token },
    expectedRevision: 1,
    operation: "pause",
    inputCount: inputs.length,
    inputHash,
  })).status, 200);

  const dispatchWith = async (harness, path, payload) => {
    const originalNow = Date.now;
    Date.now = () => first.currentTime();
    try {
      return await handleRequest(
        request(path, payload),
        harness.env,
        undefined,
        { verification: harness.dependencies }
      );
    } finally {
      Date.now = originalNow;
    }
  };
  const [resume, finish] = await Promise.all([
    dispatchWith(first, `/sessions/${session.id}/timing`, {
      session: { id: session.id, token: session.token },
      expectedRevision: 2,
      operation: "resume",
      inputCount: inputs.length,
      inputHash,
    }),
    dispatchWith(second, `/sessions/${session.id}/finish`, finishBody(session, {
      eventId: "event-paused-resume-race",
      inputs,
      timingRevision: 2,
    })),
  ]);
  const statuses = [resume.status, finish.status];
  assert.equal(statuses.filter((status) => status === 409).length, 1);
  assert.equal(statuses.filter((status) => status === 200 || status === 202).length, 1);

  const stored = firstDatabase.sqlite.prepare(`
    SELECT timing_revision, timing_phase, timing_input_count, finish_job_id, expires_at
    FROM game_stat_sessions WHERE id = ?
  `).get(session.id);
  assert.equal(stored.timing_input_count, inputs.length);
  assert.equal(stored.expires_at, session.expiresAt);
  const jobs = firstDatabase.sqlite.prepare(`
    SELECT COUNT(*) AS count FROM verified_completion_jobs WHERE session_id = ?
  `).get(session.id).count;
  if (finish.status === 202) {
    assert.equal(resume.status, 409);
    assert.equal(stored.timing_revision, 2);
    assert.equal(stored.timing_phase, "finishing");
    assert.ok(stored.finish_job_id);
    assert.equal(jobs, 1);
  } else {
    assert.equal(resume.status, 200);
    assert.equal(finish.status, 409);
    assert.equal(stored.timing_revision, 3);
    assert.equal(stored.timing_phase, "running");
    assert.equal(stored.finish_job_id, null);
    assert.equal(jobs, 0);
  }
});

test("restore returns the original issuance only for an acknowledged ready or paused prefix", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const session = await issue(harness, "sudoku", { difficulty: "medium" });
  const emptyHash = await replayPrefixHash([], 0);
  const ready = await harness.dispatch(`/sessions/${session.id}/restore`, {
    session: { id: session.id, token: session.token },
    inputCount: 0,
    inputHash: emptyHash,
  });
  assert.equal(ready.status, 200, await ready.clone().text());
  const readyDescriptor = await ready.json();
  assert.equal(readyDescriptor.id, session.id);
  assert.equal(readyDescriptor.expiresAt, session.expiresAt);
  assert.deepEqual(readyDescriptor.initial, session.initial);
  assert.deepEqual(readyDescriptor.timing, session.timing);
  assert.equal(readyDescriptor.limits.continuations, 8192);

  assert.equal((await resumeGame(harness, session)).status, 200);
  harness.advance(1_500);
  const inputs = [{ seq: 1, op: "advance", amount: 1 }];
  const inputHash = await replayPrefixHash(inputs, 1);
  const pause = await harness.dispatch(`/sessions/${session.id}/timing`, {
    session: { id: session.id, token: session.token },
    expectedRevision: 1,
    operation: "pause",
    inputCount: 1,
    inputHash,
  });
  assert.equal(pause.status, 200);

  const restored = await harness.dispatch(`/sessions/${session.id}/restore`, {
    session: { id: session.id, token: session.token },
    inputCount: 1,
    inputHash,
  });
  assert.equal(restored.status, 200, await restored.clone().text());
  assert.deepEqual((await restored.json()).timing, {
    revision: 2,
    phase: "paused",
    elapsedMs: 1_500,
  });

  const mismatched = await harness.dispatch(`/sessions/${session.id}/restore`, {
    session: { id: session.id, token: session.token },
    inputCount: 0,
    inputHash: emptyHash,
  });
  assert.equal(mismatched.status, 409);
});

test("finish rejects altered prefix evidence, issued state, and protocol downgrade", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const session = await issue(harness, "sudoku", { difficulty: "hard" });
  const inputs = [
    { seq: 1, op: "advance", amount: 1 },
    { seq: 2, op: "advance", amount: 1 },
  ];
  assert.equal((await resumeGame(harness, session)).status, 200);
  harness.advance(1_000);
  const falsePrefix = await replayPrefixHash([], 0);
  const paused = await harness.dispatch(`/sessions/${session.id}/timing`, {
    session: { id: session.id, token: session.token },
    expectedRevision: 1,
    operation: "pause",
    inputCount: 1,
    inputHash: falsePrefix,
  });
  assert.equal(paused.status, 200);
  const resumed = await harness.dispatch(`/sessions/${session.id}/timing`, {
    session: { id: session.id, token: session.token },
    expectedRevision: 2,
    operation: "resume",
    inputCount: 1,
    inputHash: falsePrefix,
  });
  assert.equal(resumed.status, 200);
  harness.advance(2_000);
  const mismatch = await finishGame(
    harness,
    session,
    finishBody(session, { eventId: "event-altered-prefix", inputs, timingRevision: 3 })
  );
  assert.equal(mismatch.status, 400);
  assert.match((await mismatch.json()).error, /timing evidence/);

  const alteredSession = await issue(harness, "sudoku", { difficulty: "hard" });
  assert.equal((await resumeGame(harness, alteredSession)).status, 200);
  harness.advance(2_000);
  harness.database.sqlite.prepare(
    "UPDATE game_stat_sessions SET initial_json = ? WHERE id = ?"
  ).run(JSON.stringify({ altered: true }), alteredSession.id);
  const altered = await finishGame(
    harness,
    alteredSession,
    finishBody(alteredSession, { eventId: "event-altered-state" })
  );
  assert.equal(altered.status, 403);

  const fresh = await issue(harness);
  const downgrade = await harness.dispatch("/events", {
    event: {
      id: "event-downgrade-0001",
      game: "minesweeper",
      type: "win",
      difficulty: "beginner",
      metric: 2,
      metricKind: "seconds",
      occurredAt: new Date().toISOString(),
      profile,
    },
    session: { id: fresh.id, token: fresh.token },
  });
  assert.equal(downgrade.status, 403);
  assert.match((await downgrade.json()).error, /does not match/);
});

test("replay validation rejects ordering, truncation, expiry, cross-session reuse, and bad versions", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const readySession = async () => {
    const session = await issue(harness);
    assert.equal((await resumeGame(harness, session)).status, 200);
    harness.advance(2_000);
    return session;
  };
  const session = await readySession();

  const reordered = await finishGame(
    harness,
    session,
    finishBody(session, {
      eventId: "event-reordered-0001",
      inputs: [
        { seq: 2, op: "advance", amount: 1 },
        { seq: 1, op: "advance", amount: 1 },
      ],
    })
  );
  assert.equal(reordered.status, 400);

  const truncatedSession = await readySession();
  const truncated = await finishGame(
    harness,
    truncatedSession,
    finishBody(truncatedSession, {
      eventId: "event-truncated-0001",
      inputs: [{ seq: 1, op: "advance", amount: 1 }],
    })
  );
  assert.equal(truncated.status, 400);
  assert.match((await truncated.json()).error, /terminal/);

  const badVersionSession = await readySession();
  const badVersion = await harness.dispatch(
    `/sessions/${badVersionSession.id}/finish`,
    finishBody(badVersionSession, { replayVersion: 99 })
  );
  assert.equal(badVersion.status, 409);

  const other = await readySession();
  const reused = await harness.dispatch(
    `/sessions/${other.id}/finish`,
    {
      ...finishBody(session, { gameId: other.id }),
      session: { id: other.id, token: session.token },
    }
  );
  assert.equal(reused.status, 403);

  const expiredSession = await readySession();
  harness.advance(7 * 60 * 60 * 1000);
  const expired = await harness.dispatch(
    `/sessions/${expiredSession.id}/finish`,
    finishBody(expiredSession, { eventId: "event-expired-0001" })
  );
  assert.equal(expired.status, 409);
  assert.match((await expired.json()).error, /expired/);
});

test("Snake terminal ticks require enough server-observed running time", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const session = await issue(harness, "snake", { boardSize: "10" });
  assert.equal((await resumeGame(harness, session)).status, 200);
  const body = finishBody(session, {
    eventId: "event-snake-timing-0001",
    inputs: [],
    terminalTick: 2,
  });
  const tooFast = await harness.dispatch(`/sessions/${session.id}/finish`, body);
  assert.equal(tooFast.status, 425);
  harness.advance(1_200);
  const finished = await finishGame(harness, session, body);
  assert.equal(finished.status, 200, await finished.clone().text());
  const completion = (await finished.json()).completion;
  assert.equal(completion.event.metric, 2);
  assert.equal(completion.event.metricKind, "score");

  const resumed = await issue(harness, "snake", { boardSize: "10" });
  const emptyHash = await replayPrefixHash([], 0);
  assert.equal((await resumeGame(harness, resumed)).status, 200);
  harness.advance(500);
  assert.equal((await harness.dispatch(`/sessions/${resumed.id}/timing`, {
    session: { id: resumed.id, token: resumed.token },
    expectedRevision: 1,
    operation: "pause",
    inputCount: 0,
    inputHash: emptyHash,
  })).status, 200);
  assert.equal((await resumeGame(harness, resumed, 2)).status, 200);
  harness.advance(1_500);
  const resumedBody = finishBody(resumed, {
    eventId: "event-snake-resume-countdown",
    inputs: [],
    terminalTick: 2,
    timingRevision: 3,
  });
  assert.equal((await harness.dispatch(
    `/sessions/${resumed.id}/finish`,
    resumedBody
  )).status, 425);
  harness.advance(36);
  assert.equal((await finishGame(harness, resumed, resumedBody)).status, 200);
});

test("progress is scoped, immutable, expiring, and exact-retry idempotent", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const session = await issue(harness);
  assert.equal((await resumeGame(harness, session)).status, 200);
  harness.advance(2_000);
  const body = finishBody(session, { eventId: "event-progress-scope" });
  const started = await harness.dispatch(`/sessions/${session.id}/finish`, body);
  assert.equal(started.status, 202);
  const firstProgress = (await started.json()).progress;

  const modified = await harness.dispatch(`/sessions/${session.id}/finish`, {
    ...body,
    inputs: [{ seq: 1, op: "advance", amount: 1 }],
  });
  assert.equal(modified.status, 409);

  const other = await issue(harness);
  assert.equal((await resumeGame(harness, other)).status, 200);
  harness.advance(2_000);
  const reservedEvent = await harness.dispatch(`/sessions/${other.id}/finish`,
    finishBody(other, { eventId: "event-progress-scope" })
  );
  assert.equal(reservedEvent.status, 409);
  const crossSession = await harness.dispatch(`/sessions/${other.id}/finish/continue`, {
    session: { id: other.id, token: other.token },
    progress: firstProgress,
  });
  assert.equal(crossSession.status, 409);

  const tampered = await harness.dispatch(`/sessions/${session.id}/finish/continue`, {
    session: { id: session.id, token: session.token },
    progress: { ...firstProgress, token: `${firstProgress.token}x` },
  });
  assert.equal(tampered.status, 403);

  const versionSession = await issue(harness);
  assert.equal((await resumeGame(harness, versionSession)).status, 200);
  harness.advance(2_000);
  const versionStart = await harness.dispatch(
    `/sessions/${versionSession.id}/finish`,
    finishBody(versionSession, { eventId: "event-progress-version" })
  );
  const versionProgress = (await versionStart.json()).progress;
  harness.database.sqlite.prepare(`
    UPDATE verified_completion_jobs SET replay_version = 99 WHERE session_id = ?
  `).run(versionSession.id);
  const changedVersion = await harness.dispatch(
    `/sessions/${versionSession.id}/finish/continue`,
    {
      session: { id: versionSession.id, token: versionSession.token },
      progress: versionProgress,
    }
  );
  assert.equal(changedVersion.status, 403);

  const continued = await harness.dispatch(`/sessions/${session.id}/finish/continue`, {
    session: { id: session.id, token: session.token },
    progress: firstProgress,
  });
  assert.equal(continued.status, 202);
  const nextProgress = (await continued.json()).progress;
  const exactRetry = await harness.dispatch(`/sessions/${session.id}/finish/continue`, {
    session: { id: session.id, token: session.token },
    progress: firstProgress,
  });
  assert.equal(exactRetry.status, 202);
  assert.deepEqual((await exactRetry.json()).progress, nextProgress);

  const expiring = await issue(harness);
  assert.equal((await resumeGame(harness, expiring)).status, 200);
  harness.advance(2_000);
  const expiringStart = await harness.dispatch(
    `/sessions/${expiring.id}/finish`,
    finishBody(expiring, { eventId: "event-progress-expiry" })
  );
  const expiringProgress = (await expiringStart.json()).progress;
  const originalExpiry = harness.database.sqlite.prepare(
    "SELECT expires_at FROM verified_completion_jobs WHERE session_id = ?"
  ).get(expiring.id).expires_at;
  harness.advance(7 * 60 * 60 * 1000);
  const expired = await harness.dispatch(`/sessions/${expiring.id}/finish/continue`, {
    session: { id: expiring.id, token: expiring.token },
    progress: expiringProgress,
  });
  assert.equal(expired.status, 409);
  assert.equal(harness.database.sqlite.prepare(
    "SELECT expires_at FROM verified_completion_jobs WHERE session_id = ?"
  ).get(expiring.id).expires_at, originalExpiry);
});

test("firstCell is flattened and continuation limits are stored, signed, and enforced", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const objectCell = await harness.dispatch("/sessions", versioned({
    game: "minesweeper",
    config: { difficulty: "beginner" },
    buildVersion,
    firstCell: { row: 0, column: 0 },
  }));
  assert.equal(objectCell.status, 400);

  const signed = await issue(harness);
  assert.equal((await resumeGame(harness, signed)).status, 200);
  harness.advance(2_000);
  const signedStart = await harness.dispatch(
    `/sessions/${signed.id}/finish`,
    finishBody(signed, { eventId: "event-signed-continuation-limit" })
  );
  const signedProgress = (await signedStart.json()).progress;
  harness.database.sqlite.prepare(`
    UPDATE verified_completion_jobs SET continuation_limit = 8191 WHERE session_id = ?
  `).run(signed.id);
  const changedLimit = await harness.dispatch(`/sessions/${signed.id}/finish/continue`, {
    session: { id: signed.id, token: signed.token },
    progress: signedProgress,
  });
  assert.equal(changedLimit.status, 403);

  const capped = await issue(harness);
  assert.equal((await resumeGame(harness, capped)).status, 200);
  harness.advance(2_000);
  const cappedStart = await harness.dispatch(
    `/sessions/${capped.id}/finish`,
    finishBody(capped, { eventId: "event-capped-continuations" })
  );
  const cappedProgress = (await cappedStart.json()).progress;
  harness.database.sqlite.prepare(`
    UPDATE verified_completion_jobs SET request_count = continuation_limit WHERE session_id = ?
  `).run(capped.id);
  const exhausted = await harness.dispatch(`/sessions/${capped.id}/finish/continue`, {
    session: { id: capped.id, token: capped.token },
    progress: cappedProgress,
  });
  assert.equal(exhausted.status, 413);
  assert.throws(() => harness.database.sqlite.prepare(`
    UPDATE verified_completion_jobs SET continuation_limit = 8193 WHERE session_id = ?
  `).run(capped.id), /CHECK constraint failed/);
});

test("job and checkpoint failures roll back without partial progress", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const session = await issue(harness);
  assert.equal((await resumeGame(harness, session)).status, 200);
  harness.advance(2_000);
  harness.database.sqlite.exec(`
    CREATE TRIGGER reject_test_job
    BEFORE INSERT ON verified_completion_jobs
    BEGIN
      SELECT RAISE(ABORT, 'simulated job failure');
    END;
  `);
  const body = finishBody(session, { eventId: "event-job-rollback" });
  assert.equal((await harness.dispatch(`/sessions/${session.id}/finish`, body)).status, 500);
  assert.deepEqual({ ...harness.database.sqlite.prepare(`
    SELECT timing_phase, finish_job_id FROM game_stat_sessions WHERE id = ?
  `).get(session.id) }, { timing_phase: "running", finish_job_id: null });
  harness.database.sqlite.exec("DROP TRIGGER reject_test_job");
  const started = await harness.dispatch(`/sessions/${session.id}/finish`, body);
  const progress = (await started.json()).progress;

  harness.database.sqlite.exec(`
    CREATE TRIGGER reject_test_checkpoint
    BEFORE UPDATE ON verified_completion_jobs
    WHEN NEW.progress_revision > OLD.progress_revision
    BEGIN
      SELECT RAISE(ABORT, 'simulated checkpoint failure');
    END;
  `);
  const failed = await harness.dispatch(`/sessions/${session.id}/finish/continue`, {
    session: { id: session.id, token: session.token },
    progress,
  });
  assert.equal(failed.status, 500);
  assert.deepEqual({ ...harness.database.sqlite.prepare(`
    SELECT progress_revision, input_cursor, state_json
    FROM verified_completion_jobs WHERE session_id = ?
  `).get(session.id) }, { progress_revision: 0, input_cursor: 0, state_json: null });
  harness.database.sqlite.exec("DROP TRIGGER reject_test_checkpoint");
  assert.equal((await finishGame(harness, session, body)).status, 200);
});

test("one action above a preparation or work envelope is rejected atomically", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const largeSession = await issue(harness);
  assert.equal((await resumeGame(harness, largeSession)).status, 200);
  harness.advance(2_000);
  const largeAction = await finishGame(harness, largeSession, finishBody(largeSession, {
    eventId: "event-large-action",
    inputs: [
      { seq: 1, op: "advance", amount: 1, padding: "x".repeat(17 * 1024) },
      { seq: 2, op: "advance", amount: 1 },
    ],
  }));
  assert.equal(largeAction.status, 413);
  assert.equal(harness.database.sqlite.prepare(`
    SELECT input_cursor FROM verified_completion_jobs WHERE session_id = ?
  `).get(largeSession.id).input_cursor, 0);

  const costlyEngine = progressEngine("minesweeper");
  harness.dependencies.gameEngines = {
    ...gameEngines,
    minesweeper: {
      ...costlyEngine,
      transition(state, input, budget) {
        budget.spend(20_001);
        return costlyEngine.transition(state, input, budget);
      },
    },
  };
  const costlySession = await issue(harness);
  assert.equal((await resumeGame(harness, costlySession)).status, 200);
  harness.advance(2_000);
  const costlyAction = await finishGame(
    harness,
    costlySession,
    finishBody(costlySession, { eventId: "event-costly-action" })
  );
  assert.equal(costlyAction.status, 413);
  assert.equal(harness.database.sqlite.prepare(`
    SELECT input_cursor FROM verified_completion_jobs WHERE session_id = ?
  `).get(costlySession.id).input_cursor, 0);
});

test("a failed completion insert rolls back session consumption in real SQLite", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const session = await issue(harness);
  assert.equal((await resumeGame(harness, session)).status, 200);
  harness.advance(2_000);
  harness.database.sqlite.exec(`
    CREATE TRIGGER reject_test_completion
    BEFORE INSERT ON verified_game_completions
    BEGIN
      SELECT RAISE(ABORT, 'simulated completion failure');
    END;
  `);
  const failed = await finishGame(harness, session, finishBody(session));
  assert.equal(failed.status, 500);
  assert.equal(harness.database.sqlite.prepare(
    "SELECT consumed_at FROM game_stat_sessions WHERE id = ?"
  ).get(session.id).consumed_at, null);
  assert.equal(harness.database.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM verified_game_completions"
  ).get().count, 0);

  harness.database.sqlite.exec("DROP TRIGGER reject_test_completion");
  const retried = await finishGame(harness, session, finishBody(session));
  assert.equal(retried.status, 200, await retried.clone().text());
});

test("independent SQLite connections converge on one immutable completion", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "verified-results-"));
  const databasePath = join(directory, "stats.sqlite");
  const firstDatabase = new SqliteD1Database(databasePath);
  applyGameStatsMigrations(firstDatabase, migrationPaths);
  const secondDatabase = new SqliteD1Database(databasePath);
  const first = createHarness({
    database: firstDatabase,
    env: createEnv(firstDatabase),
    migrate: false,
  });
  // createHarness normally migrates its database; build the second harness
  // manually because both connections share the already-migrated file.
  let now = Date.now();
  let sequence = 100;
  const second = {
    database: secondDatabase,
    env: createEnv(secondDatabase),
    dependencies: {
      gameEngines,
      generateIssuedInitial,
      now: () => now,
      randomUUID: () => `verified-id-${++sequence}`,
    },
  };
  t.after(() => {
    firstDatabase.close();
    secondDatabase.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const session = await issue(first);
  assert.equal((await resumeGame(first, session)).status, 200);
  first.advance(2_000);
  now += 2_000;
  const body = finishBody(session);
  const dispatchWith = async (harness, path, payload) => {
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      return await handleRequest(
        request(path, payload),
        harness.env,
        undefined,
        { verification: harness.dependencies }
      );
    } finally {
      Date.now = originalNow;
    }
  };
  const [one, two] = await Promise.all([
    dispatchWith(first, `/sessions/${session.id}/finish`, body),
    dispatchWith(second, `/sessions/${session.id}/finish`, body),
  ]);
  assert.deepEqual([one.status, two.status], [202, 202]);
  const [oneBody, twoBody] = await Promise.all([one.json(), two.json()]);
  assert.deepEqual(oneBody.progress, twoBody.progress);
  const continuation = {
    session: { id: session.id, token: session.token },
    progress: oneBody.progress,
  };
  const [continuedOne, continuedTwo] = await Promise.all([
    dispatchWith(first, `/sessions/${session.id}/finish/continue`, continuation),
    dispatchWith(second, `/sessions/${session.id}/finish/continue`, continuation),
  ]);
  assert.deepEqual([continuedOne.status, continuedTwo.status], [202, 202]);
  assert.deepEqual(
    (await continuedOne.json()).progress,
    (await continuedTwo.json()).progress
  );
  const completed = await finishGame(first, session, body);
  assert.equal(completed.status, 200, await completed.clone().text());
  assert.equal(firstDatabase.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM verified_game_completions"
  ).get().count, 1);

  const conflictingSession = await issue(first);
  assert.equal((await resumeGame(first, conflictingSession)).status, 200);
  first.advance(2_000);
  now += 2_000;
  const firstVariant = finishBody(conflictingSession, {
    eventId: "event-concurrent-variant-a",
  });
  const secondVariant = finishBody(conflictingSession, {
    eventId: "event-concurrent-variant-b",
  });
  const variants = await Promise.all([
    dispatchWith(first, `/sessions/${conflictingSession.id}/finish`, firstVariant),
    dispatchWith(second, `/sessions/${conflictingSession.id}/finish`, secondVariant),
  ]);
  assert.deepEqual(variants.map(({ status }) => status).sort(), [202, 409]);
  assert.equal((await finishGame(first, conflictingSession, firstVariant)).status, 200);
  assert.equal(firstDatabase.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM verified_game_completions"
  ).get().count, 2);
});

test("legacy issuance requires an explicit future server cutoff", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const body = { game: "solitaire", config: {}, buildVersion };
  const closed = await harness.dispatch("/sessions", body);
  assert.equal(closed.status, 409);
  assert.match((await closed.json()).error, /resultProtocol 2/);

  harness.env.LEGACY_RESULT_ISSUANCE_CUTOFF = new Date(Date.now() + 60_000).toISOString();
  const compatible = await harness.dispatch("/sessions", body);
  assert.equal(compatible.status, 201, await compatible.clone().text());
  assert.equal((await compatible.json()).resultProtocol, undefined);
});

test("finish bodies are rejected by byte count before JSON allocation", async (t) => {
  const harness = createHarness();
  t.after(() => harness.database.close());
  const oversized = JSON.stringify({ padding: "x".repeat(256 * 1024) });
  const response = await handleRequest(
    new Request("https://stats.example.test/sessions/verified-id-0001/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        "CF-Connecting-IP": "203.0.113.41",
      },
      body: new ReadableStream({
        start(controller) {
          const bytes = new TextEncoder().encode(oversized);
          controller.enqueue(bytes.subarray(0, 100_000));
          controller.enqueue(bytes.subarray(100_000));
          controller.close();
        },
      }),
      duplex: "half",
    }),
    harness.env,
    undefined,
    { verification: harness.dependencies }
  );
  assert.equal(response.status, 413);
});

test("migration leaves every historical event explicitly legacy", () => {
  const database = new SqliteD1Database();
  try {
    for (const path of migrationPaths.slice(0, 4)) {
      database.exec(readFileSync(path, "utf8"));
    }
    database.sqlite.prepare(`
      INSERT INTO game_events (
        id, game, type, metric, metric_kind, occurred_at
      ) VALUES ('historical-event', 'snake', 'gamePlayed', 4, 'score', ?)
    `).run(new Date().toISOString());
    database.exec(readFileSync(migrationPaths[4], "utf8"));
    assert.equal(database.sqlite.prepare(
      "SELECT provenance FROM game_events WHERE id = 'historical-event'"
    ).get().provenance, "legacy");
  } finally {
    database.close();
  }
});
