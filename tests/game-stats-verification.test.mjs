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
    return { game, config, firstCell: firstCell || null, progress: 0, target: 2, moves: 0 };
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
    if (input.op === "step") state.steps += 1;
    else if (input.op !== "direction") throw new Error("illegal fixture snake action");
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
    ...(game === "minesweeper" ? { firstCell: { row: 0, column: 0 } } : {}),
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
  assert.equal(session.initial.firstCell.row, 0);
  assert.match(session.initialCommitment, /^[a-f0-9]{64}$/);
  assert.equal(session.initialCommitment, await digestCanonical(session.initial));
  assert.deepEqual(session.timing, { revision: 0, phase: "ready", elapsedMs: 0 });

  assert.equal((await resumeGame(harness, session)).status, 200);
  harness.advance(2_500);
  const body = finishBody(session);
  const finished = await harness.dispatch(`/sessions/${session.id}/finish`, body);
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
  await harness.purge();
  assert.equal(harness.database.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM game_stat_sessions WHERE id = ?"
  ).get(session.id).count, 0);
  const finishRetry = await harness.dispatch(`/sessions/${session.id}/finish`, body);
  assert.equal(finishRetry.status, 200);
  assert.deepEqual((await finishRetry.json()).completion, result.completion);
  const publishRetry = await harness.dispatch("/events", {
    event,
    completion: receipt,
  });
  assert.equal(publishRetry.status, 200);
  assert.equal((await publishRetry.json()).applied, false);

  const conflictingRetry = await harness.dispatch(
    `/sessions/${session.id}/finish`,
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
  const finished = await harness.dispatch(
    `/sessions/${session.id}/finish`,
    finishBody(session, { eventId: "event-sudoku-timing", inputs, timingRevision: 3 })
  );
  assert.equal(finished.status, 200, await finished.clone().text());
  const result = await finished.json();
  assert.equal(result.completion.elapsedMs, 3_000);
  assert.equal(result.completion.event.metric, 3);
  assert.equal(result.completion.event.puzzleId, "fixture-easy");
  assert.equal(result.completion.event.hintBucket, "noHints");
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
  const mismatch = await harness.dispatch(
    `/sessions/${session.id}/finish`,
    finishBody(session, { eventId: "event-altered-prefix", inputs, timingRevision: 3 })
  );
  assert.equal(mismatch.status, 400);
  assert.match((await mismatch.json()).error, /timing evidence/);

  harness.database.sqlite.prepare(
    "UPDATE game_stat_sessions SET initial_json = ? WHERE id = ?"
  ).run(JSON.stringify({ altered: true }), session.id);
  const altered = await harness.dispatch(
    `/sessions/${session.id}/finish`,
    finishBody(session, { eventId: "event-altered-prefix", inputs, timingRevision: 3 })
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
  const session = await issue(harness);
  assert.equal((await resumeGame(harness, session)).status, 200);
  harness.advance(2_000);

  const reordered = await harness.dispatch(
    `/sessions/${session.id}/finish`,
    finishBody(session, {
      eventId: "event-reordered-0001",
      inputs: [
        { seq: 2, op: "advance", amount: 1 },
        { seq: 1, op: "advance", amount: 1 },
      ],
    })
  );
  assert.equal(reordered.status, 400);

  const truncated = await harness.dispatch(
    `/sessions/${session.id}/finish`,
    finishBody(session, {
      eventId: "event-truncated-0001",
      inputs: [{ seq: 1, op: "advance", amount: 1 }],
    })
  );
  assert.equal(truncated.status, 400);
  assert.match((await truncated.json()).error, /terminal/);

  const badVersion = await harness.dispatch(
    `/sessions/${session.id}/finish`,
    finishBody(session, { replayVersion: 99 })
  );
  assert.equal(badVersion.status, 409);

  const other = await issue(harness);
  const reused = await harness.dispatch(
    `/sessions/${other.id}/finish`,
    {
      ...finishBody(session, { gameId: other.id }),
      session: { id: other.id, token: session.token },
    }
  );
  assert.equal(reused.status, 403);

  harness.advance(7 * 60 * 60 * 1000);
  const expired = await harness.dispatch(
    `/sessions/${session.id}/finish`,
    finishBody(session, { eventId: "event-expired-0001" })
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
  const finished = await harness.dispatch(`/sessions/${session.id}/finish`, body);
  assert.equal(finished.status, 200, await finished.clone().text());
  const completion = (await finished.json()).completion;
  assert.equal(completion.event.metric, 2);
  assert.equal(completion.event.metricKind, "score");
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
  const failed = await harness.dispatch(
    `/sessions/${session.id}/finish`,
    finishBody(session)
  );
  assert.equal(failed.status, 500);
  assert.equal(harness.database.sqlite.prepare(
    "SELECT consumed_at FROM game_stat_sessions WHERE id = ?"
  ).get(session.id).consumed_at, null);
  assert.equal(harness.database.sqlite.prepare(
    "SELECT COUNT(*) AS count FROM verified_game_completions"
  ).get().count, 0);

  harness.database.sqlite.exec("DROP TRIGGER reject_test_completion");
  const retried = await harness.dispatch(
    `/sessions/${session.id}/finish`,
    finishBody(session)
  );
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
  const dispatchWith = async (harness, targetSession, payload) => {
    const originalNow = Date.now;
    Date.now = () => now;
    try {
      return await handleRequest(
        request(`/sessions/${targetSession.id}/finish`, payload),
        harness.env,
        undefined,
        { verification: harness.dependencies }
      );
    } finally {
      Date.now = originalNow;
    }
  };
  const [one, two] = await Promise.all([
    dispatchWith(first, session, body),
    dispatchWith(second, session, body),
  ]);
  assert.deepEqual([one.status, two.status], [200, 200]);
  const [oneBody, twoBody] = await Promise.all([one.json(), two.json()]);
  assert.deepEqual(oneBody.completion, twoBody.completion);
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
    dispatchWith(first, conflictingSession, firstVariant),
    dispatchWith(second, conflictingSession, secondVariant),
  ]);
  assert.deepEqual(variants.map(({ status }) => status).sort(), [200, 409]);
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
