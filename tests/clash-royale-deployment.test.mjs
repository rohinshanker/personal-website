import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

import {
  checkClashRoyaleDeployment,
  runClashRoyaleDeploymentCheck,
} from "../scripts/check-clash-royale-deployment.mjs";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const SOURCE = `window.rohinGameStatsBackend = {
  apiBaseUrl: "https://worker.example.test",
  buildVersion: "sha256-${"a".repeat(64)}"
};`;
const card = (overrides = {}) => ({ id: 26000000, name: "Knight", ...overrides });
const participant = (overrides = {}) => ({
  tag: "#28CYYU08P",
  name: "Player",
  cards: [card()],
  ...overrides,
});
const battle = (overrides = {}) => ({
  battleTime: "20261001T120000.000Z",
  team: [participant()],
  opponent: [participant({ tag: "#OPPONENT", name: "Opponent" })],
  ...overrides,
});
const snapshot = () => ({
  ok: true,
  player: { tag: "#28CYYU08P", name: "Player", currentDeck: [] },
  battles: [],
  fetchedAt: new Date(NOW).toISOString(),
  cacheTtlSeconds: 300,
});
const response = (payload = snapshot(), headers = {}) => Response.json(payload, {
  headers: { "Access-Control-Allow-Origin": "https://rohin.shanker.me", ...headers },
});
const options = (fetchImpl = async () => response()) => ({
  readFileImpl: async () => SOURCE,
  fetchImpl,
  now: () => NOW,
});

test("live gate uses configured endpoint, production CORS, and no credentials", async () => {
  let request;
  const result = await checkClashRoyaleDeployment(options(async (url, init) => {
    request = { url, init };
    return response();
  }));
  assert.deepEqual(result, { playerTag: "#28CYYU08P", battleCount: 0 });
  assert.equal(request.url, "https://worker.example.test/clash-royale");
  assert.equal(request.init.method, "GET");
  assert.equal(request.init.cache, "no-store");
  assert.equal(request.init.redirect, "error");
  assert.deepEqual(request.init.headers, {
    Accept: "application/json", Origin: "https://rohin.shanker.me",
  });
  assert.ok(request.init.signal instanceof AbortSignal);
});

test("live gate rejects request, CORS, HTTP, response, and JSON failures", async () => {
  const cases = [
    [async () => { throw new Error("network"); }, /request or production CORS/],
    [async () => response(snapshot(), { "Access-Control-Allow-Origin": "*" }), /CORS/],
    [async () => ({ ok: true, json: async () => snapshot() }), /CORS/],
    [async () => null, /invalid response/],
    [async () => new Response("private error detail", { status: 503 }), /HTTP 503/],
    [async () => new Response("not JSON", {
      headers: { "Access-Control-Allow-Origin": "https://rohin.shanker.me" },
    }), /valid JSON/],
  ];
  for (const [fetchImpl, expected] of cases) {
    await assert.rejects(checkClashRoyaleDeployment(options(fetchImpl)), expected);
  }
});

test("live gate rejects the wrong player and malformed snapshots", async () => {
  for (const payload of [
    null, [], {}, { ...snapshot(), ok: false },
    { ...snapshot(), player: null },
    { ...snapshot(), player: { tag: "#OTHER", name: "Player" } },
    { ...snapshot(), player: { tag: "#28CYYU08P", name: 1 } },
    { ...snapshot(), player: { tag: "#28CYYU08P", name: "  " } },
    { ...snapshot(), battles: {} },
    { ...snapshot(), battles: Array.from({ length: 21 }, () => battle()) },
    { ...snapshot(), cacheTtlSeconds: 999 },
  ]) {
    await assert.rejects(
      checkClashRoyaleDeployment(options(async () => response(payload))),
      /invalid player snapshot/
    );
  }
});

test("live gate accepts empty, short, and twenty-battle snapshots", async () => {
  for (const count of [0, 3, 20]) {
    const result = await checkClashRoyaleDeployment(options(async () => response({
      ...snapshot(),
      battles: Array.from({ length: count }, () => battle()),
    })));
    assert.equal(result.battleCount, count);
  }
});

test("live gate accepts normalized card metadata and artwork fallbacks", async () => {
  const currentDeck = [
    card({
      elixirCost: 0,
      rarity: "common",
      evolutionLevel: 1,
      variant: "evo",
      iconUrl: "https://api-assets.clashroyale.com/cards/300/knight.png",
      variantIconUrl:
        "https://api-assets.clashroyale.com/cardevolutions/300/knight.png",
    }),
    card({
      id: 26000001,
      rarity: "champion",
      evolutionLevel: 2,
      variant: "hero",
      variantIconUrl:
        "https://api-assets.clashroyale.com/cardheroes/300/hero.png",
    }),
    card({ id: 26000002, evolutionLevel: 3 }),
    card({ id: 28000006, name: "Mirror", rarity: "epic" }),
  ];
  await checkClashRoyaleDeployment(options(async () => response({
    ...snapshot(),
    player: { ...snapshot().player, currentDeck },
    battles: [battle({ team: [participant({ cards: currentDeck })] })],
  })));
});

test("live gate rejects malformed card and participant data", async () => {
  const withCard = (overrides) => ({
    ...snapshot(),
    player: {
      ...snapshot().player,
      currentDeck: [card(overrides)],
    },
  });
  const invalidSnapshots = [
    { ...snapshot(), player: { ...snapshot().player, currentDeck: undefined } },
    { ...snapshot(), player: { ...snapshot().player, currentDeck: {} } },
    { ...snapshot(), player: {
      ...snapshot().player,
      currentDeck: Array.from({ length: 9 }, () => card()),
    } },
    withCard({ id: -1 }),
    withCard({ name: " " }),
    withCard({ elixirCost: -1 }),
    withCard({ elixirCost: 2.5 }),
    withCard({ rarity: "Legendary" }),
    withCard({ rarity: "mythic" }),
    withCard({ evolutionLevel: 1 }),
    withCard({ evolutionLevel: 2, variant: "evo" }),
    withCard({ variant: "evo" }),
    withCard({ iconUrl: "https://example.test/cards/300/knight.png" }),
    withCard({ iconUrl: "https://api-assets.clashroyale.com/cards/300/knight.svg" }),
    withCard({
      evolutionLevel: 1,
      variant: "evo",
      variantIconUrl: "https://api-assets.clashroyale.com/cardheroes/300/wrong.png",
    }),
    withCard({ variantIconUrl:
      "https://api-assets.clashroyale.com/cardevolutions/300/unselected.png" }),
    withCard({ id: 28000006, name: "Mirror", elixirCost: 1 }),
    { ...snapshot(), battles: [battle({ team: [] })] },
    { ...snapshot(), battles: [battle({ opponent: Array.from(
      { length: 5 }, () => participant()
    ) })] },
    { ...snapshot(), battles: [battle({ team: [participant({ cards: {} })] })] },
    { ...snapshot(), battles: [battle({ team: [participant({
      cards: Array.from({ length: 17 }, () => card()),
    })] })] },
  ];
  for (const payload of invalidSnapshots) {
    await assert.rejects(
      checkClashRoyaleDeployment(options(async () => response(payload))),
      /invalid player snapshot/
    );
  }
});

test("live gate requires a fresh timestamp with bounded clock skew", async () => {
  for (const fetchedAt of [undefined, 123, "invalid", new Date(NOW - 330_001).toISOString(),
    new Date(NOW + 30_001).toISOString()]) {
    await assert.rejects(checkClashRoyaleDeployment(options(async () => response({
      ...snapshot(), fetchedAt,
    }))), /timestamp is invalid or stale/);
  }
  for (const age of [-30_000, 300_000, 330_000]) {
    await checkClashRoyaleDeployment(options(async () => response({
      ...snapshot(), fetchedAt: new Date(NOW - age).toISOString(),
    })));
  }
});

test("CLI returns failure and reports only the public error message", async () => {
  const outputs = [];
  const errors = [];
  const io = { writeOutput: (text) => outputs.push(text), writeError: (text) => errors.push(text) };
  assert.equal(await runClashRoyaleDeploymentCheck({
    ...io, checkImpl: async () => ({ playerTag: "#28CYYU08P", battleCount: 20 }),
  }), 0);
  assert.match(outputs[0], /#28CYYU08P, 20 recent battles/);
  assert.equal(await runClashRoyaleDeploymentCheck({
    ...io, checkImpl: async () => { throw new Error("HTTP 503", { cause: "private" }); },
  }), 1);
  assert.deepEqual(errors, ["Clash Royale deployment check failed: HTTP 503"]);
});

test("release checks Clash Royale after Worker deployment and before Pages publication", async () => {
  const workflow = parse(await readFile(new URL(
    "../.github/workflows/game-stats-worker-release.yml", import.meta.url
  ), "utf8"));
  const steps = workflow.jobs["deploy-worker"].steps;
  const deploy = steps.findIndex((step) => step.run?.startsWith("npm --prefix workers/game-stats run deploy --"));
  const gate = steps.findIndex((step) => step.run === "npm run clash-royale:deployment:check");
  assert.ok(deploy >= 0 && gate > deploy);
  assert.equal(workflow.jobs["package-pages"].needs, "deploy-worker");
  assert.ok(workflow.jobs["deploy-pages"].steps.some(
    (step) => step.run === "npm run clash-royale:deployment:check"
  ));
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.scripts["clash-royale:deployment:check"], "node scripts/check-clash-royale-deployment.mjs");
});
