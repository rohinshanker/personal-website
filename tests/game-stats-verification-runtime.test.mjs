import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const workerPackageUrl = new URL("../workers/game-stats/package.json", import.meta.url);
const workerRequire = createRequire(workerPackageUrl);
const { Miniflare, NoOpLog } = await import(
  pathToFileURL(workerRequire.resolve("miniflare")).href
);

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureEntrypoint = fileURLToPath(
  new URL("./fixtures/game-stats-verification-worker.mjs", import.meta.url)
);
const migrations = [
  "0001_create_game_stats.sql",
  "0002_add_game_stat_security.sql",
  "0003_add_sudoku_puzzle_identity.sql",
  "0004_optimize_stats_aggregation.sql",
  "0005_add_verified_game_results.sql",
].map((name) => new URL(`../workers/game-stats/migrations/${name}`, import.meta.url));
const origin = "https://rohin.shanker.me";
const buildVersion = `sha256-${"b".repeat(64)}`;
const versions = {
  resultProtocol: 2,
  rulesVersion: 1,
  replayVersion: 1,
  generatorVersion: 1,
};

const createRuntime = () => new Miniflare({
  modules: true,
  modulesRoot: repositoryRoot,
  scriptPath: fixtureEntrypoint,
  compatibilityDate: "2026-07-21",
  d1Databases: { personal_site_game_stats: "verified-results-runtime" },
  bindings: {
    ALLOWED_ORIGIN: origin,
    EVENT_SIGNING_SECRET: "test-runtime-verification-signing-secret",
    IP_HASH_SECRET: "test-runtime-verification-ip-secret",
    GAME_BUILD_VERSION: buildVersion,
  },
  log: new NoOpLog(),
});

const post = (runtime, path, body) => runtime.dispatchFetch(
  `https://stats.example.test${path}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "CF-Connecting-IP": "203.0.113.92",
    },
    body: JSON.stringify(body),
  }
);

test("workerd bounds and completes a near-limit replay with real D1", async (t) => {
  const runtime = createRuntime();
  t.after(() => runtime.dispose());
  const database = await runtime.getD1Database("personal_site_game_stats");
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

  const issuedResponse = await post(runtime, "/sessions", {
    ...versions,
    game: "minesweeper",
    config: { difficulty: "beginner" },
    buildVersion,
    firstCell: { row: 0, column: 0 },
  });
  assert.equal(issuedResponse.status, 201, await issuedResponse.clone().text());
  const issued = await issuedResponse.json();
  const emptyHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("[]")
  );
  const inputHash = Array.from(
    new Uint8Array(emptyHash),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
  const started = await post(runtime, `/sessions/${issued.id}/timing`, {
    session: { id: issued.id, token: issued.token },
    operation: "resume",
    expectedRevision: 0,
    inputCount: 0,
    inputHash,
  });
  assert.equal(started.status, 200, await started.clone().text());

  const inputs = Array.from({ length: 8_000 }, (_, index) => ({
    seq: index + 1,
    op: "a",
  }));
  const finishPayload = {
    eventId: "runtime-event-verified-0001",
    session: { id: issued.id, token: issued.token },
    gameId: issued.id,
    rulesVersion: 1,
    replayVersion: 1,
    inputs,
    timingRevision: 1,
  };
  const encodedBytes = new TextEncoder().encode(JSON.stringify(finishPayload)).byteLength;
  assert.ok(encodedBytes < 256 * 1024, `fixture body is ${encodedBytes} bytes`);
  const startedAt = performance.now();
  const finished = await post(runtime, `/sessions/${issued.id}/finish`, finishPayload);
  const elapsedMs = performance.now() - startedAt;
  assert.equal(finished.status, 200, await finished.clone().text());
  const result = await finished.json();
  assert.equal(result.completion.event.id, finishPayload.eventId);
  assert.equal(result.completion.event.metricKind, "seconds");
  assert.ok(elapsedMs < 5_000, `near-limit replay took ${elapsedMs.toFixed(1)} ms`);
  t.diagnostic(
    `verified ${inputs.length} inputs / 1,600,000 charged work / ` +
      `${encodedBytes} request bytes in ${elapsedMs.toFixed(1)} ms under workerd`
  );

  const completionCount = await database.prepare(
    "SELECT COUNT(*) AS count FROM verified_game_completions"
  ).first("count");
  assert.equal(Number(completionCount), 1);

  const oversized = await post(runtime, `/sessions/${issued.id}/finish`, {
    padding: "x".repeat(256 * 1024),
  });
  assert.equal(oversized.status, 413);
});
