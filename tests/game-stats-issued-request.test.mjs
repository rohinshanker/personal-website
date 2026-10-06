import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../scripts/home/features/game-stats.js", import.meta.url), "utf8");
const start = source.indexOf("const requestIssuedGameStatsApi =");
const end = source.indexOf("\n\nconst createGameStatsHooks =", start);
assert.ok(start >= 0 && end > start);

const load = ({ statuses = [200], configured = true, delay = 1 } = {}) => {
  const requests = []; const changes = [];
  const context = vm.createContext({
    DOMException,
    window: { setTimeout, clearTimeout },
    isGameStatsBackendConfigured: () => configured,
    fetchGameStatsApi: async (path, options) => {
      requests.push({ path, options });
      return { status: statuses[Math.min(requests.length - 1, statuses.length - 1)] };
    },
    readGameStatsApiJson: async (response) => {
      if (response.status !== 200) throw Object.assign(new Error("Request rejected"), { status: response.status });
      return { ok: true };
    },
    GAME_STATS_SESSION_BUILD_RETRY_ATTEMPTS: 2,
    GAME_STATS_SESSION_BUILD_RETRY_INTERVAL_MS: delay,
    trackChange: (state) => changes.push(state),
  });
  vm.runInContext([
    "let gameStatsReleaseWaitCount = 0; let gameStatsSyncState = 'ready';",
    "const setGameStatsSyncState = (state) => { gameStatsSyncState = state; trackChange(state); };",
    source.slice(start, end),
    "globalThis.request = requestIssuedGameStatsApi;",
    "globalThis.waiters = () => gameStatsReleaseWaitCount;",
  ].join("\n"), context);
  return { context, requests, changes };
};

test("verified issuance retries a release mismatch and clears its waiting state", async () => {
  const { context, requests, changes } = load({ statuses: [409, 409, 200] });
  assert.equal((await context.request("/sessions", { game: "sudoku" })).ok, true);
  assert.equal(requests.length, 3);
  assert.equal(context.waiters(), 0);
  assert.deepEqual(changes, ["release-waiting", "release-waiting", "ready"]);
});

test("retry exhaustion, other errors and non-issuance conflicts preserve the actual error", async () => {
  for (const [path, status, count] of [
    ["/sessions", 409, 3], ["/sessions", 429, 1], ["/sessions/game/restore", 409, 1],
  ]) {
    const { context, requests } = load({ statuses: [status] });
    await assert.rejects(context.request(path, {}), (error) => error.status === status);
    assert.equal(requests.length, count);
    assert.equal(context.waiters(), 0);
  }
  const { context, requests } = load({ configured: false });
  await assert.rejects(context.request("/sessions", {}), (error) => error.code === "unconfigured");
  assert.equal(requests.length, 0);
});

test("canceling a controlled-release wait stops retries and releases its shared waiter", async () => {
  const { context, requests } = load({ statuses: [409], delay: 10_000 });
  const controller = new AbortController();
  const pending = context.request("/sessions", {}, { signal: controller.signal });
  await new Promise(setImmediate);
  assert.equal(context.waiters(), 1);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(context.waiters(), 0);
  assert.equal(requests.length, 1);
  await assert.rejects(context.request("/sessions", {}, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(requests.length, 1);
});
