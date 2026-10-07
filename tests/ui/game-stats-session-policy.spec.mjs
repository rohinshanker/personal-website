import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import {
  REVIEW_VIEWPORTS,
  installGameStatsBackend,
  openApp,
  settleRender,
} from "./helpers/rendered-site.mjs";

const API_BASE_URL = "https://game-stats-session-policy.test";
const BUILD_VERSION = `sha256-${"d".repeat(64)}`;
const EXPIRED_MESSAGE =
  "Saved on this device. This game's online session expired, so this result can't be published. Start a new game to publish a new result.";

const installSessionPolicyBridge = async (page) => {
  await routeHomeScript(page, "gameStats", (source) =>
    source.replace(
      /\n\}\)\(\);\s*$/,
      `
const sessionPolicyState = { statsSession: "" };
const sessionPolicyHooks = createGameStatsHooks("sudoku", sessionPolicyState);
const sessionPolicyDateNow = Date.now.bind(Date);
const sessionPolicyRequests = new Map();
const ensureSessionPolicySession = (difficulty) => {
  const sessionKey = sessionPolicyHooks.ensureSession({ difficulty });
  const entry = gameStatsSessions.get("sudoku");
  if (entry?.sessionKey === sessionKey) {
    sessionPolicyRequests.set(sessionKey, entry.sessionRequest);
  }
  return sessionKey;
};
window.__gameStatsSessionPolicyTest = Object.freeze({
  ensureSession: (difficulty = "easy") => ensureSessionPolicySession(difficulty),
  dropSession: () => sessionPolicyHooks.dropSession(),
  expireSessions: () => {
    Date.now = () => sessionPolicyDateNow() + 7 * 60 * 60 * 1000;
  },
  readState: () => ({
    sessionKey: sessionPolicyState.statsSession,
    wins: gameStatsLocalState.totals.sudoku.wins.easy.noHints,
  }),
  recordWin: () =>
    sessionPolicyHooks.recordEvent(
      {
        type: "win",
        difficulty: "easy",
        hintBucket: "noHints",
        metric: 90,
        metricKind: "seconds",
      },
      { sudokuNoHintsSeconds: 90 }
    ),
  sync: () => syncQueuedGameStats(),
  waitForSessions: async (sessionKeys) =>
    Promise.all(
      sessionKeys.map(async (sessionKey) => {
        const result = await sessionPolicyRequests.get(sessionKey);
        return result?.session?.id || "";
      })
    ),
});
})();`
    )
  );
};

const installApi = async (page) => {
  const eventRequests = [];
  const sessionRequests = [];
  const pendingSessionRoutes = [];
  const statsRequests = [];
  let statsReadFails = false;

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/sessions") {
      sessionRequests.push(JSON.parse(request.postData() || "{}"));
      pendingSessionRoutes.push(route);
      return;
    }
    if (url.pathname === "/events") {
      eventRequests.push(JSON.parse(request.postData() || "{}"));
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, applied: true }),
      });
      return;
    }
    if (url.pathname === "/stats") {
      statsRequests.push(url.pathname + url.search);
      await route.fulfill({
        contentType: "application/json",
        body: statsReadFails ? "{" : JSON.stringify({
          generatedAt: new Date().toISOString(),
          totals: {},
          leaderboards: {},
          playerRanks: {},
          playerRecords: {},
        }),
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Unexpected test route" }),
    });
  });

  return {
    eventRequests,
    sessionRequests,
    statsRequests,
    setStatsReadFailure: (fails) => { statsReadFails = fails; },
    async releaseSessions() {
      await Promise.all(
        pendingSessionRoutes.splice(0).map((route, index) =>
          route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              id: `session-policy-${index + 1}`,
              token: `session-policy-token-${index + 1}`,
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            }),
          })
        )
      );
    },
  };
};

for (const viewport of REVIEW_VIEWPORTS) {
  test(`reuses, claims, and explains an expired session at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      Math.random = () => 0.999999;
      localStorage.clear();
    });
    await installGameStatsBackend(page, {
      apiBaseUrl: API_BASE_URL,
      buildVersion: BUILD_VERSION,
    });
    await installSessionPolicyBridge(page);
    const api = await installApi(page);
    await page.goto("/home.html");

    const firstKey = await page.evaluate(() =>
      window.__gameStatsSessionPolicyTest.ensureSession("easy")
    );
    await expect.poll(() => api.sessionRequests.length).toBe(1);
    await page.evaluate(() => window.__gameStatsSessionPolicyTest.dropSession());
    const reusedKey = await page.evaluate(() =>
      window.__gameStatsSessionPolicyTest.ensureSession("easy")
    );
    expect(reusedKey).toBe(firstKey);
    expect(api.sessionRequests).toHaveLength(1);

    await page.evaluate(() => {
      window.__sessionPolicyRecordPromise =
        window.__gameStatsSessionPolicyTest.recordWin();
    });
    await expect(page.locator("#game-profile-prompt")).toBeVisible();
    const replacementKey = await page.evaluate(() =>
      window.__gameStatsSessionPolicyTest.ensureSession("easy")
    );
    expect(replacementKey).not.toBe(firstKey);
    await expect.poll(() => api.sessionRequests.length).toBe(2);

    await api.releaseSessions();
    const adoptedSessionIds = await page.evaluate(
      (sessionKeys) =>
        window.__gameStatsSessionPolicyTest.waitForSessions(sessionKeys),
      [firstKey, replacementKey]
    );
    expect(adoptedSessionIds).toEqual(["session-policy-1", "session-policy-2"]);
    await page.evaluate(() => window.__gameStatsSessionPolicyTest.expireSessions());
    const activeExpiredKey = await page.evaluate(() =>
      window.__gameStatsSessionPolicyTest.ensureSession("easy")
    );
    expect(activeExpiredKey).toBe(replacementKey);
    expect(api.sessionRequests).toHaveLength(2);

    await page.locator("#game-profile-cancel").click();
    await page.evaluate(() => window.__sessionPolicyRecordPromise);
    expect(api.eventRequests).toEqual([]);
    expect(await page.evaluate(() => window.__gameStatsSessionPolicyTest.readState())).toEqual({
      sessionKey: replacementKey,
      wins: 1,
    });

    await page.evaluate(() => window.__gameStatsSessionPolicyTest.sync());
    expect(api.statsRequests.length).toBeGreaterThan(0);

    const aboutClose = page.locator('#about-window [data-close="about"]');
    if (await aboutClose.isVisible()) await aboutClose.click();
    const gameProgress = await openApp(page, "game-progress");
    for (const game of ["minesweeper", "solitaire", "snake"]) {
      const label = `${game[0].toUpperCase()}${game.slice(1)}`;
      await gameProgress
        .getByRole("button", { name: `Open ${label} global leaderboard` })
        .click();
      const candidateWindow = page.locator(`#game-stats-window-${game}`);
      await expect(candidateWindow).toBeVisible();
      await expect(candidateWindow).not.toHaveClass(/\bis-opening\b/);
      await settleRender(page);
      await expect(candidateWindow.locator("[data-game-stats-sync-status]")).toHaveText(
        EXPIRED_MESSAGE
      );
      await expect(
        candidateWindow.locator(`[data-game-stats-refresh="${game}"]`)
      ).toHaveAttribute("data-game-stats-action", "refresh");
      const layout = await candidateWindow.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const status = element.querySelector("[data-game-stats-sync-status]");
        return {
          documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
          statusOverflows: status.scrollWidth > status.clientWidth,
          windowFits:
            bounds.top >= 0 && bounds.left >= 0 &&
            bounds.right <= window.innerWidth && bounds.bottom <= window.innerHeight,
        };
      });
      expect(layout).toEqual({
        documentOverflows: false,
        statusOverflows: false,
        windowFits: true,
      });
      await page.screenshot({
        path: testInfo.outputPath(`expired-session-${game}-${viewport.name}.png`),
        fullPage: true,
      });
      await candidateWindow.locator(`[data-close="game-stats-${game}"]`).click();
      await expect(candidateWindow).toBeHidden();
    }
    await gameProgress
      .getByRole("button", { name: "Open Sudoku global leaderboard" })
      .click();

    const statsWindow = page.locator("#game-stats-window-sudoku");
    const status = statsWindow.locator("[data-game-stats-sync-status]");
    const refresh = statsWindow.locator('[data-game-stats-refresh="sudoku"]');
    await expect(statsWindow).toBeVisible();
    await expect(status).toHaveText(EXPIRED_MESSAGE);
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "session-expired");
    await expect(refresh).toBeEnabled();
    await expect(refresh).toHaveAttribute("data-game-stats-action", "refresh");
    api.setStatsReadFailure(true);
    await page.evaluate(() => window.__gameStatsSessionPolicyTest.sync());
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "request-failed");
    api.setStatsReadFailure(false);
    await page.evaluate(() => window.__gameStatsSessionPolicyTest.sync());
    await expect(status).toHaveText(EXPIRED_MESSAGE);
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "session-expired");

    const layout = await statsWindow.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const statusElement = element.querySelector("[data-game-stats-sync-status]");
      return {
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        statusOverflows: statusElement.scrollWidth > statusElement.clientWidth,
        windowFits:
          bounds.top >= 0 &&
          bounds.left >= 0 &&
          bounds.right <= window.innerWidth &&
          bounds.bottom <= window.innerHeight,
      };
    });
    expect(layout).toEqual({
      documentOverflows: false,
      statusOverflows: false,
      windowFits: true,
    });

    const accessibility = await new AxeBuilder({ page })
      .include("#game-stats-window-sudoku")
      .analyze();
    const headingOrder = accessibility.violations.find(
      ({ id }) => id === "heading-order"
    );
    expect(headingOrder?.nodes.map(({ target }) => target)).toEqual([
      ["#game-stats-sudoku-easy"],
    ]);
    expect(
      accessibility.violations.filter(({ id }) => id !== "heading-order")
    ).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`expired-session-${viewport.name}.png`),
      fullPage: true,
    });
    await statsWindow.locator('[data-close="game-stats-sudoku"]').click();
    await expect(statsWindow).toBeHidden();
    await page.evaluate(() => window.__gameStatsSessionPolicyTest.sync());
    await gameProgress.locator("#game-progress-reset-local").click();
    expect(await page.evaluate(() => window.__gameStatsSessionPolicyTest.readState())).toEqual({
      sessionKey: replacementKey,
      wins: 0,
    });
    await gameProgress
      .getByRole("button", { name: "Open Sudoku global leaderboard" })
      .click();
    await expect(statsWindow).toBeVisible();
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
    await page.evaluate(() => window.__gameStatsSessionPolicyTest.sync());
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
    await refresh.click();
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
  });
}
