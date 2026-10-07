import assert from "node:assert/strict";
import test from "node:test";

import worker from "../workers/game-stats/src/index.mjs";
import { digestCanonical, VERSION_FIELDS } from "../workers/game-stats/src/verified-results.mjs";
import { SqliteD1Database, applyGameStatsMigrations } from "./helpers/sqlite-d1.mjs";

const origin = "https://rohin.shanker.me";
const buildVersion = `sha256-${"a".repeat(64)}`;
const migrations = [
  "0001_create_game_stats.sql", "0002_add_game_stat_security.sql",
  "0003_add_sudoku_puzzle_identity.sql", "0004_optimize_stats_aggregation.sql",
  "0005_add_verified_game_results.sql",
].map((name) => new URL(`../workers/game-stats/migrations/${name}`, import.meta.url).pathname);

const harness = (context) => {
  const database = new SqliteD1Database();
  context.after(() => database.close());
  applyGameStatsMigrations(database, migrations);
  const env = {
    personal_site_game_stats: database, ALLOWED_ORIGIN: origin,
    EVENT_SIGNING_SECRET: "test-production-engine-signing-secret",
    IP_HASH_SECRET: "test-production-engine-ip-secret", GAME_BUILD_VERSION: buildVersion,
  };
  const dispatch = (path, body) => worker.fetch(new Request(`https://stats.example.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, "CF-Connecting-IP": "203.0.113.88" },
    body: JSON.stringify(body),
  }), env);
  const issue = async (game, config) => {
    const response = await dispatch("/sessions", {
      ...VERSION_FIELDS, game, config, buildVersion,
      ...(game === "minesweeper" ? { firstCell: 0 } : {}),
    });
    assert.equal(response.status, 201, await response.clone().text());
    return response.json();
  };
  return { database, dispatch, issue };
};

test("the production Worker issues every supported configuration using its real engine and catalog imports", async (context) => {
  const { issue } = harness(context);
  const cases = [
    ...Object.keys(globalThis.homeMinesweeperRules.CONFIGURATIONS).map((difficulty) => ["minesweeper", { difficulty }]),
    ["solitaire", {}],
    ...globalThis.homeSnakeRules.BOARD_SIZES.map((size) => ["snake", { boardSize: String(size) }]),
    ...globalThis.homeSudokuRules.DIFFICULTIES.map((difficulty) => ["sudoku", { difficulty }]),
  ];
  const ids = new Set();
  for (const [game, config] of cases) {
    const issued = await issue(game, config);
    assert.equal(issued.gameId, issued.id);
    assert.equal(issued.game, game);
    assert.deepEqual(issued.config, config);
    assert.equal(issued.initialCommitment, await digestCanonical(issued.initial));
    assert.deepEqual(issued.timing, { phase: "ready", revision: 0, elapsedMs: 0 });
    const engine = globalThis[{
      minesweeper: "homeMinesweeperRules", solitaire: "homeSolitaireRules",
      snake: "homeSnakeRules", sudoku: "homeSudokuRules",
    }[game]];
    assert.equal(engine.result(engine.initial(issued.initial)).terminal, false);
    ids.add(issued.id);
  }
  assert.equal(ids.size, cases.length);
});

test("the production Sudoku catalog and engine finish and publish an actual issued replay", async (context) => {
  const { dispatch, issue, database } = harness(context);
  const issued = await issue("sudoku", { difficulty: "easy" });
  const session = { id: issued.id, token: issued.token };
  const started = await dispatch(`/sessions/${issued.id}/timing`, {
    session, operation: "resume", expectedRevision: 0, inputCount: 0, inputHash: await digestCanonical([]),
  });
  assert.equal(started.status, 200, await started.clone().text());
  const inputs = Array.from(issued.initial.puzzle, (digit, index) => digit === "0"
    ? { op: "setValue", index, value: issued.initial.solution[index] } : null).filter(Boolean);
  inputs.push({ op: "check" });
  inputs.forEach((input, index) => { input.seq = index + 1; });
  const eventId = "event-production-sudoku-001";
  let response = await dispatch(`/sessions/${issued.id}/finish`, {
    eventId, session, gameId: issued.gameId, rulesVersion: 1, replayVersion: 1,
    timingRevision: 1, inputs,
  });
  let reply = await response.json();
  let continuations = 0;
  while (reply.progress) {
    assert.ok(++continuations <= issued.limits.continuations);
    response = await dispatch(`/sessions/${issued.id}/finish/continue`, { session, progress: reply.progress });
    reply = await response.json();
  }
  assert.equal(response.status, 200, JSON.stringify(reply));
  const completion = reply.completion;
  assert.equal(completion.event.hintBucket, "noHints");
  assert.equal(completion.event.puzzleId, issued.id);
  assert.equal(completion.event.puzzle, issued.initial.puzzle);
  assert.equal(completion.expiresAt, issued.expiresAt);
  const published = await dispatch("/events", {
    completion: { id: completion.id, token: completion.token },
    event: { ...completion.event, profile: null },
  });
  assert.equal(published.status, 201, await published.clone().text());
  assert.equal((await database.prepare("SELECT provenance FROM game_events WHERE id = ?").bind(eventId).first()).provenance, "verified");
});
