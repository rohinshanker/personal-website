import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  loadRuleEngines, loadSolitaireSolver, proveWinnable,
} from "../scripts/build-issued-game-catalog.mjs";
import "../scripts/home/games/rules.js";
import "../scripts/home/games/minesweeper.js";
import "../scripts/home/games/sudoku.js";
import { digestCanonical, VERSION_FIELDS } from "../workers/game-stats/src/verified-results.mjs";

const migrations = [
  "0001_create_game_stats.sql", "0002_add_game_stat_security.sql",
  "0003_add_sudoku_puzzle_identity.sql", "0004_optimize_stats_aggregation.sql",
  "0005_add_verified_game_results.sql",
];

test("workerd verifies actual Minesweeper Solitaire and Sudoku replays with bounded stages", async (context) => {
  const requireWorker = createRequire(new URL("../workers/game-stats/package.json", import.meta.url));
  const { Miniflare, NoOpLog } = await import(pathToFileURL(requireWorker.resolve("miniflare")).href);
  const buildVersion = `sha256-${"c".repeat(64)}`;
  const runtime = new Miniflare({
    modules: true, modulesRoot: fileURLToPath(new URL("../", import.meta.url)),
    scriptPath: fileURLToPath(new URL("./fixtures/game-stats-issued-engines-worker.mjs", import.meta.url)),
    compatibilityDate: "2026-07-21", log: new NoOpLog(),
    d1Databases: { personal_site_game_stats: "issued-engines-runtime" },
    bindings: {
      ALLOWED_ORIGIN: "https://rohin.shanker.me", GAME_BUILD_VERSION: buildVersion,
      EVENT_SIGNING_SECRET: "test-issued-runtime-signing-secret",
      IP_HASH_SECRET: "test-issued-runtime-ip-secret",
    },
  });
  context.after(() => runtime.dispose());
  const database = await runtime.getD1Database("personal_site_game_stats");
  for (const name of migrations) {
    const sql = (await readFile(new URL(`../workers/game-stats/migrations/${name}`, import.meta.url), "utf8"))
      .replace(/^\s*--.*$/gm, "");
    const triggers = [...sql.matchAll(/CREATE TRIGGER[\s\S]*?\nEND;/gi)].map((match) => match[0]);
    const statements = sql.replace(/CREATE TRIGGER[\s\S]*?\nEND;/gi, "").split(";")
      .map((statement) => statement.trim()).filter(Boolean);
    for (const statement of [...statements, ...triggers]) await database.prepare(statement).run();
  }
  let now = Date.now();
  const dispatch = (path, body) => runtime.dispatchFetch(`https://stats.example.test${path}`, {
    method: "POST", body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json", Origin: "https://rohin.shanker.me",
      "CF-Connecting-IP": "203.0.113.89", "X-Test-Now": String(now),
    },
  });
  const offlineEngines = await loadRuleEngines();
  const solve = await loadSolitaireSolver();
  for (const [game, config] of [
    ["minesweeper", { difficulty: "expert" }], ["solitaire", {}],
    ["sudoku", { difficulty: "extreme" }],
  ]) {
    const issuing = await dispatch("/sessions", {
      ...VERSION_FIELDS, game, config, buildVersion,
      ...(game === "minesweeper" ? { firstCell: 0 } : {}),
    });
    assert.equal(issuing.status, 201, await issuing.clone().text());
    const issued = await issuing.json();
    const session = { id: issued.id, token: issued.token };
    const starting = await dispatch(`/sessions/${issued.id}/timing`, {
      session, operation: "resume", expectedRevision: 0, inputCount: 0, inputHash: await digestCanonical([]),
    });
    assert.equal(starting.status, 200, await starting.clone().text());
    let actions;
    if (game === "minesweeper") {
      const engine = globalThis.homeMinesweeperRules;
      const state = engine.initial(issued.initial);
      actions = [];
      while (!engine.result(state).terminal) {
        const cell = state.cells.findIndex((item) => !item.mine && !item.revealed);
        assert.ok(cell >= 0);
        const input = { op: "reveal", cell };
        actions.push(input);
        engine.transition(state, { ...input, seq: actions.length });
      }
      assert.equal(engine.result(state).won, true);
    } else if (game === "solitaire") {
      const face = (id, faceUp) => {
        const [suit, rank] = id.split("-");
        return { id, suit, rank: Number(rank), faceUp };
      };
      const moves = solve({
        stock: issued.initial.stock.map((id) => face(id, false)),
        tableau: issued.initial.tableau.map((pile) => [
          ...pile.down.map((id) => face(id, false)), ...pile.up.map((id) => face(id, true)),
        ]),
      });
      assert.ok(moves);
      actions = proveWinnable(offlineEngines, issued.initial, moves);
    } else {
      actions = Array.from(issued.initial.puzzle, (digit, index) => digit === "0"
        ? { op: "setValue", index, value: issued.initial.solution[index] } : null).filter(Boolean);
      actions.push({ op: "check" });
    }
    const inputs = actions.map((input, index) => ({ ...input, seq: index + 1 }));
    now += 3_000;
    const eventId = `event-issued-runtime-${game}`;
    let response = await dispatch(`/sessions/${issued.id}/finish`, {
      eventId, session, gameId: issued.id, rulesVersion: 1, replayVersion: 1, timingRevision: 1, inputs,
    });
    let reply = await response.json();
    const samples = []; let count = 0;
    while (reply.progress) {
      assert.ok(++count <= issued.limits.continuations);
      response = await dispatch(`/sessions/${issued.id}/finish/continue`, { session, progress: reply.progress });
      const observed = response.headers.get("X-Test-Synchronous-Stages-Wall-Ms");
      if (observed !== null) samples.push(Number(observed));
      reply = await response.json();
    }
    assert.equal(response.status, 200, JSON.stringify(reply));
    assert.equal(reply.completion.event.game, game);
    assert.equal(reply.completion.expiresAt, issued.expiresAt);
    assert.ok(samples.length);
    context.diagnostic(`${game}: ${inputs.length} real inputs, ${count} continuations; ` +
      `max instrumented synchronous-stage wall ${Math.max(...samples)}ms (not full request CPU)`);
    const publishing = await dispatch("/events", {
      event: { ...reply.completion.event, profile: null },
      completion: { id: reply.completion.id, token: reply.completion.token },
    });
    assert.equal(publishing.status, 201, await publishing.clone().text());
  }
});
