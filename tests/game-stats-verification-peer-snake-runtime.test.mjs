import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const snakeEngineUrl = new URL("../scripts/home/games/snake.js", import.meta.url);
const hasPeerSnakeEngine = existsSync(snakeEngineUrl);

test("real Snake engine completes a long replay beyond 256 bounded requests", {
  skip: hasPeerSnakeEngine ? false : "Stream A Snake engine is not integrated in this worktree",
}, async (t) => {
  await import("../scripts/home/games/rules.js");
  await import(snakeEngineUrl);
  const workerPackageUrl = new URL("../workers/game-stats/package.json", import.meta.url);
  const workerRequire = createRequire(workerPackageUrl);
  const { Miniflare, NoOpLog } = await import(
    pathToFileURL(workerRequire.resolve("miniflare")).href
  );
  const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
  const fixtureEntrypoint = fileURLToPath(
    new URL("./fixtures/game-stats-verification-peer-snake-worker.mjs", import.meta.url)
  );
  const runtime = new Miniflare({
    modules: true,
    modulesRoot: repositoryRoot,
    scriptPath: fixtureEntrypoint,
    compatibilityDate: "2026-07-21",
    d1Databases: { personal_site_game_stats: "verified-results-peer-snake-runtime" },
    bindings: {
      ALLOWED_ORIGIN: "https://rohin.shanker.me",
      EVENT_SIGNING_SECRET: "test-peer-snake-verification-signing-secret",
      IP_HASH_SECRET: "test-peer-snake-verification-ip-secret",
      GAME_BUILD_VERSION: `sha256-${"d".repeat(64)}`,
    },
    log: new NoOpLog(),
  });
  t.after(() => runtime.dispose());

  const database = await runtime.getD1Database("personal_site_game_stats");
  const migrations = [
    "0001_create_game_stats.sql",
    "0002_add_game_stat_security.sql",
    "0003_add_sudoku_puzzle_identity.sql",
    "0004_optimize_stats_aggregation.sql",
    "0005_add_verified_game_results.sql",
  ].map((name) => new URL(`../workers/game-stats/migrations/${name}`, import.meta.url));
  for (const migration of migrations) {
    const sql = readFileSync(migration, "utf8").replace(/^\s*--.*$/gm, "");
    const triggers = Array.from(
      sql.matchAll(/CREATE TRIGGER[\s\S]*?\nEND;/gi),
      (match) => match[0]
    );
    const statements = sql
      .replace(/CREATE TRIGGER[\s\S]*?\nEND;/gi, "")
      .split(";")
      .map((statement) => statement.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    for (const statement of [...statements, ...triggers]) {
      await database.prepare(statement).run();
    }
  }

  let now = Date.now();
  const buildVersion = `sha256-${"d".repeat(64)}`;
  const post = (path, body) => runtime.dispatchFetch(`https://stats.example.test${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://rohin.shanker.me",
      "CF-Connecting-IP": "203.0.113.94",
      "X-Test-Now": String(now),
    },
    body: JSON.stringify(body),
  });
  const issuedResponse = await post("/sessions", {
    resultProtocol: 2,
    rulesVersion: 1,
    replayVersion: 1,
    generatorVersion: 1,
    game: "snake",
    config: { boardSize: "24" },
    buildVersion,
  });
  assert.equal(issuedResponse.status, 201, await issuedResponse.clone().text());
  const issued = await issuedResponse.json();
  assert.equal(issued.limits.continuations, 8192);

  const emptyHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("[]"))),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
  const resumed = await post(`/sessions/${issued.id}/timing`, {
    session: { id: issued.id, token: issued.token },
    operation: "resume",
    expectedRevision: 0,
    inputCount: 0,
    inputHash: emptyHash,
  });
  assert.equal(resumed.status, 200, await resumed.clone().text());
  now += 100;
  const paused = await post(`/sessions/${issued.id}/timing`, {
    session: { id: issued.id, token: issued.token },
    operation: "pause",
    expectedRevision: 1,
    inputCount: 0,
    inputHash: emptyHash,
  });
  assert.equal(paused.status, 200, await paused.clone().text());
  const restarted = await post(`/sessions/${issued.id}/timing`, {
    session: { id: issued.id, token: issued.token },
    operation: "resume",
    expectedRevision: 2,
    inputCount: 0,
    inputHash: emptyHash,
  });
  assert.equal(restarted.status, 200, await restarted.clone().text());

  const state = globalThis.homeSnakeRules.initial(issued.initial);
  const inputs = [];
  const nextDirection = Object.freeze({ down: "left", left: "up", up: "right", right: "down" });
  const hitsWall = () => {
    const { x, y } = state.snake[0];
    const boardSize = Number(state.configuration.boardSize);
    return (state.direction === "down" && y === boardSize - 1) ||
      (state.direction === "left" && x === 0) ||
      (state.direction === "up" && y === 0) ||
      (state.direction === "right" && x === boardSize - 1);
  };
  const turn = (direction) => {
    const input = {
      seq: inputs.length + 1,
      op: "direction",
      tick: state.tick,
      direction,
    };
    globalThis.homeSnakeRules.transition(state, structuredClone(input));
    inputs.push(input);
  };
  turn("down");
  while (!state.terminal) {
    if (hitsWall()) {
      if (state.tick >= 10_000) {
        globalThis.homeSnakeRules.step(state);
        break;
      }
      turn(nextDirection[state.direction]);
    }
    globalThis.homeSnakeRules.step(state);
  }
  assert.equal(state.terminal, true);
  assert.ok(state.tick >= 10_000);

  now += 900 + state.tick * 118;
  const finishBody = {
    eventId: "peer-snake-long-replay",
    session: { id: issued.id, token: issued.token },
    gameId: issued.id,
    rulesVersion: 1,
    replayVersion: 1,
    timingRevision: 3,
    inputs,
    terminalTick: state.tick,
  };
  assert.ok(new TextEncoder().encode(JSON.stringify(finishBody)).byteLength < 256 * 1024);
  let response = await post(`/sessions/${issued.id}/finish`, finishBody);
  const frozen = await database.prepare(`
    SELECT elapsed_ms, countdown_ms, resume_count, finished_at
    FROM verified_completion_jobs WHERE session_id = ?
  `).bind(issued.id).first();
  assert.equal(Number(frozen.elapsed_ms), 100 + 900 + state.tick * 118);
  assert.equal(Number(frozen.countdown_ms), 1_000);
  assert.equal(Number(frozen.resume_count), 2);
  const wallSamples = [];
  let continuationCount = 0;
  while (response.status === 202) {
    const { progress } = await response.json();
    response = await post(`/sessions/${issued.id}/finish/continue`, {
      session: { id: issued.id, token: issued.token },
      progress,
    });
    const replayWallMs = Number(response.headers.get("X-Test-Replay-Wall-Ms"));
    if (Number.isFinite(replayWallMs) && replayWallMs > 0) wallSamples.push(replayWallMs);
    continuationCount += 1;
    assert.ok(continuationCount < 8192);
  }
  assert.equal(response.status, 200, await response.clone().text());
  assert.ok(continuationCount > 256);
  const completion = (await response.json()).completion;
  assert.equal(
    completion.elapsedMs,
    Number(frozen.elapsed_ms),
    "continuation wall delay must not change frozen game time"
  );
  assert.equal(completion.event.occurredAt, frozen.finished_at);
  assert.equal(Number((await database.prepare(`
    SELECT request_count FROM verified_completion_jobs WHERE session_id = ?
  `).bind(issued.id).first()).request_count), continuationCount);
  const maximumReplayWallMs = Math.max(...wallSamples);
  assert.ok(
    maximumReplayWallMs < 10,
    `real Snake synchronous replay segment took ${maximumReplayWallMs.toFixed(1)}ms`
  );
  t.diagnostic(
    `real Snake ${state.tick} ticks / ${inputs.length} directions over ` +
      `${continuationCount} continuations; max synchronous replay segment ` +
      `${maximumReplayWallMs.toFixed(1)}ms`
  );
});
