import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const API_BASE_URL = "https://game-stats-build-mismatch.test";
const BUILD_VERSION = `sha256-${"c".repeat(64)}`;
const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const GAME_STATS_SYNC_QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const profile = Object.freeze({
  id: "player-build-mismatch",
  name: "Build Tester",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});
const mismatchMessage =
  "Results cannot be published while the game update is deploying. Reload this page after the update finishes, then start a new game.";

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const installMainBridge = async (page) => {
  const mainSource = await readFile(
    new URL("../../scripts/home/main.js", import.meta.url),
    "utf8"
  );
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__gameStatsBuildMismatchTest = Object.freeze({
  startSolitaireSession: () => startGameStatsSession("solitaire", {}),
  readSolitaireWins: () => gameStatsLocalState.totals.solitaire.wins,
  recordSolitaireWin: async (sessionKey) => {
    await recordGameStatsEvent(
      createGameStatsEvent({ game: "solitaire", type: "win", metric: 80 }),
      sessionKey
    );
  },
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the build-mismatch test bridge.");
  }
  await page.route("**/scripts/home/main.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedSource,
    })
  );
};

const installBackendConfig = (page) =>
  page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({
        apiBaseUrl: ${JSON.stringify(API_BASE_URL)},
        buildVersion: ${JSON.stringify(BUILD_VERSION)}
      });`,
    })
  );

const installApi = async (page) => {
  const sessionRequests = [];
  const eventRequests = [];
  const statsRequests = [];

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/sessions") {
      sessionRequests.push(JSON.parse(request.postData() || "{}"));
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Game build version is not current" }),
      });
      return;
    }
    if (url.pathname === "/events") {
      eventRequests.push(JSON.parse(request.postData() || "{}"));
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Unverifiable event reached the API" }),
      });
      return;
    }
    if (url.pathname === "/stats") {
      statsRequests.push(url.pathname + url.search);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
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

  return { eventRequests, sessionRequests, statsRequests };
};

const collectRuntimeErrors = (page) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
};

const preparePage = async (page) => {
  await page.addInitScript(
    ({ profileKey, savedProfile }) => {
      Math.random = () => 0.999999;
      if (!sessionStorage.getItem("gameStatsBuildMismatchTestReady")) {
        localStorage.clear();
        localStorage.setItem(profileKey, JSON.stringify(savedProfile));
        sessionStorage.setItem("gameStatsBuildMismatchTestReady", "true");
      }
    },
    { profileKey: PROFILE_STORAGE_KEY, savedProfile: profile }
  );
  await page.goto("/home.html");
  const sessionKey = await page.evaluate(() =>
    window.__gameStatsBuildMismatchTest.startSolitaireSession()
  );

  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page.locator('.desktop-icon[data-app="solitaire"]').evaluate((button) => button.click());
  await page
    .locator('[data-app-window="solitaire"] [data-game-stats-open="solitaire"]')
    .evaluate((button) => button.click());
  return { sessionKey, statsWindow: page.locator("#game-stats-window-solitaire") };
};

for (const viewport of viewports) {
  test(`a stale Solitaire build fails closed and offers reload at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await installBackendConfig(page);
    await installMainBridge(page);
    const api = await installApi(page);
    const { sessionKey, statsWindow } = await preparePage(page);
    const status = statsWindow.locator("[data-game-stats-sync-status]");
    const reloadButton = statsWindow.locator('[data-game-stats-refresh="solitaire"]');

    await expect(statsWindow).toBeVisible();
    await expect(status).toHaveText(mismatchMessage);
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "build-mismatch");
    await expect(status).toHaveAttribute("role", "status");
    await expect(reloadButton).toBeEnabled();
    await expect(reloadButton).toHaveAttribute("data-game-stats-action", "reload");
    await expect(reloadButton).toHaveAttribute(
      "aria-label",
      "Reload page to update Solitaire stats"
    );
    await reloadButton.focus();
    await expect(reloadButton).toBeFocused();

    expect(api.sessionRequests).toEqual([
      { game: "solitaire", config: {}, buildVersion: BUILD_VERSION },
    ]);
    expect(api.eventRequests).toEqual([]);
    expect(api.statsRequests).toHaveLength(1);
    const storedBeforeWin = await page.evaluate(
      ({ queueKey }) => ({
        queue: JSON.parse(localStorage.getItem(queueKey) || "[]"),
        wins: window.__gameStatsBuildMismatchTest.readSolitaireWins(),
      }),
      {
        queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      }
    );
    expect(storedBeforeWin.queue).toEqual([]);
    expect(storedBeforeWin.wins).toBe(0);

    await page.evaluate(
      (key) => window.__gameStatsBuildMismatchTest.recordSolitaireWin(key),
      sessionKey
    );
    await expect(status).toHaveText(mismatchMessage);
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "build-mismatch");
    expect(api.eventRequests).toEqual([]);
    const stored = await page.evaluate(
      ({ queueKey, statsKey }) => ({
        queue: JSON.parse(localStorage.getItem(queueKey) || "[]"),
        stats: JSON.parse(localStorage.getItem(statsKey) || "null"),
      }),
      {
        queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
        statsKey: GAME_STATS_STORAGE_KEY,
      }
    );
    expect(stored.queue).toEqual([]);
    expect(stored.stats.totals.solitaire.wins).toBe(1);

    const layout = await statsWindow.evaluate((element) => ({
      documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
      statusOverflows:
        element.querySelector("[data-game-stats-sync-status]").scrollWidth >
        element.querySelector("[data-game-stats-sync-status]").clientWidth,
      windowRight: element.getBoundingClientRect().right,
      viewportWidth: window.innerWidth,
    }));
    expect(layout.documentOverflows).toBe(false);
    expect(layout.statusOverflows).toBe(false);
    expect(layout.windowRight).toBeLessThanOrEqual(layout.viewportWidth);

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`${viewport.name}-build-mismatch.png`),
    });
    expect(runtimeErrors.consoleErrors).toEqual([
      "Failed to load resource: the server responded with a status of 409 (Conflict)",
    ]);
    expect(runtimeErrors.pageErrors).toEqual([]);

    if (viewport.name === "desktop") {
      await Promise.all([page.waitForNavigation(), reloadButton.click()]);
      await expect
        .poll(() =>
          page.evaluate(() => performance.getEntriesByType("navigation")[0]?.type)
        )
        .toBe("reload");
      const winsAfterReload = await page.evaluate(
        (statsKey) => JSON.parse(localStorage.getItem(statsKey)).totals.solitaire.wins,
        GAME_STATS_STORAGE_KEY
      );
      expect(winsAfterReload).toBe(1);
      expect(api.eventRequests).toEqual([]);
    }
  });
}
