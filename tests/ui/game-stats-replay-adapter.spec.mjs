import { createHash } from "node:crypto";

import { expect, test } from "./deterministic.mjs";
import { installGameStatsBackend, REVIEW_VIEWPORTS } from "./helpers/rendered-site.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";

const API_BASE_URL = "https://game-stats-replay-adapter.test";
const BUILD_VERSION = `sha256-${"a".repeat(64)}`;
const initial = { seed: 17, values: [0, 1] };
const initialCommitment = createHash("sha256").update(JSON.stringify(initial)).digest("hex");

const installBridge = (page) => routeHomeScript(page, "gameStats", (source) =>
  source.replace(/\n\}\)\(\);\s*$/, `
const replayAdapterState = { statsSession: "" };
const replayAdapterHooks = createGameStatsHooks("sudoku", replayAdapterState);
const replayAdapterMetrics = [];
window.__gameStatsReplayAdapterTest = Object.freeze({
  issue: () => replayAdapterHooks.issueGame({difficulty:"easy"}),
  start: () => replayAdapterHooks.resumeGame(),
  input: () => replayAdapterHooks.recordInput({op:"edit",index:1,value:"2"}),
  record: () => replayAdapterHooks.recordEvent({
    type:"win",difficulty:"easy",hintBucket:"noHints",metric:18,metricKind:"seconds"
  }, {sudokuNoHintsSeconds:18,onCanonicalMetric:(metric)=>replayAdapterMetrics.push(metric)}),
  read: () => ({
    key: replayAdapterState.statsSession,
    wins:gameStatsLocalState.totals.sudoku.wins.easy.noHints,
    best:gameStatsLocalState.totals.sudoku.bestTimes.easy,
    metrics:replayAdapterMetrics,
  }),
});
})();`)
);

const installApi = async (page) => {
  const issued = [];
  const finishes = [];
  const published = [];
  let continuationRoute = null;
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    if (path === "/sessions") {
      const id = `session-adapter-${issued.length + 1}`;
      const descriptor = {
        id, gameId: id, token: `synthetic-session-proof-${issued.length + 1}`,
        game: "sudoku", config: { difficulty: "easy" }, resultProtocol: 2,
        rulesVersion: 1, replayVersion: 1, generatorVersion: 1,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        initial, initialCommitment, timing: { revision: 0, phase: "ready", elapsedMs: 0 },
        limits: { inputs: 16384, work: 2000000, ticks: 0, bytes: 262144, continuations: 4 },
      };
      issued.push(descriptor);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(descriptor) });
      return;
    }
    if (path.endsWith("/timing")) {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        ok: true, timing: { revision: body.expectedRevision + 1, phase: "running", elapsedMs: 0 },
      }) });
      return;
    }
    if (path.endsWith("/finish")) {
      finishes.push(body);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        progress: { id: "progress-adapter-001", token: "synthetic-progress-proof" },
      }) });
      return;
    }
    if (path.endsWith("/finish/continue")) {
      continuationRoute = route;
      return;
    }
    if (path === "/events") {
      published.push(body);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        ok: true, applied: true, eventId: body.event.id,
      }) });
      return;
    }
    if (path === "/stats") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        totals: { sudoku: { wins: { easy: { noHints: published.length, withHints: 0 } } } },
        leaderboards: {}, playerRanks: {}, playerRecords: {},
        acknowledgedEventIds: published.map((submission) => submission.event.id),
      }) });
      return;
    }
    throw new Error(`Unexpected adapter route ${path}`);
  });
  return {
    issued, finishes, published,
    hasContinuation: () => Boolean(continuationRoute),
    async finish() {
      const payload = finishes[0];
      await continuationRoute.fulfill({ contentType: "application/json", body: JSON.stringify({
        completion: {
          id: "completion-adapter-001", token: "synthetic-completion-proof",
          expiresAt: issued[0].expiresAt, elapsedMs: 32500,
          event: {
            id: payload.eventId, game: "sudoku", type: "win", difficulty: "easy",
            hintBucket: "noHints", metric: 32, metricKind: "seconds",
            occurredAt: new Date().toISOString(),
          },
        },
      }) });
    },
  };
};

for (const viewport of REVIEW_VIEWPORTS) {
  test(`replay completion starts before profile selection and stays local first at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => { localStorage.clear(); Math.random = () => 0.999999; });
    await installGameStatsBackend(page, { apiBaseUrl: API_BASE_URL, buildVersion: BUILD_VERSION });
    await installBridge(page);
    const api = await installApi(page);
    await page.goto("/home.html");
    await page.evaluate(() => window.__gameStatsReplayAdapterTest.issue());
    await page.evaluate(() => window.__gameStatsReplayAdapterTest.start());
    await page.evaluate(() => window.__gameStatsReplayAdapterTest.input());
    await page.evaluate(() => {
      window.__replayAdapterRecordPromise = window.__gameStatsReplayAdapterTest.record();
    });
    await expect(page.locator("#game-profile-prompt")).toBeVisible();
    await expect.poll(() => api.finishes.length).toBe(1);
    await expect.poll(api.hasContinuation).toBe(true);
    expect(api.published).toHaveLength(0);
    await page.screenshot({ path: testInfo.outputPath(`replay-profile-pending-${viewport.name}.png`) });
    expect(api.finishes[0].inputs).toEqual([{ index: 1, op: "edit", value: "2", seq: 1 }]);
    const firstKey = await page.evaluate(() => window.__gameStatsReplayAdapterTest.read().key);
    expect(firstKey).toBe("");
    await page.evaluate(() => window.__gameStatsReplayAdapterTest.issue());
    expect(api.issued).toHaveLength(2);
    await page.locator("#game-profile-cancel").click();
    await expect.poll(() => page.evaluate(() => window.__gameStatsReplayAdapterTest.read().wins)).toBe(1);
    const local = await page.evaluate(() => JSON.parse(localStorage.getItem("personalSiteGameStatsV1")));
    expect(local.totals.sudoku.wins.easy.noHints).toBe(1);
    expect(api.published).toHaveLength(0);
    await api.finish();
    await page.evaluate(() => window.__replayAdapterRecordPromise);
    await expect.poll(() => api.published.length).toBe(1);
    expect(api.published[0].session).toBeUndefined();
    expect(api.published[0].completion).toEqual({
      id: "completion-adapter-001", token: "synthetic-completion-proof",
    });
    expect(api.published[0].event.metric).toBe(32);
    const final = await page.evaluate(() => window.__gameStatsReplayAdapterTest.read());
    expect(final.wins).toBe(1);
    expect(final.best).toBe(32);
    expect(final.key).toBeTruthy();
    expect(final.metrics).toEqual([{ metric: 32, metricKind: "seconds", elapsedMs: 32500, updateLocalStats: true }]);
    await page.screenshot({ path: testInfo.outputPath(`replay-result-complete-${viewport.name}.png`) });
  });
}
