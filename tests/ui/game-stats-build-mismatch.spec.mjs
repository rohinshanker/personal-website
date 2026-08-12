import { expect, test } from "@playwright/test";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";

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
const releaseWaitingMessage =
  "Game stats are finishing an update. This game's result will publish automatically when the update is ready.";

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const installMainBridge = async (page) => {
  const mainSource = (await readIsolatedMainSource())
    .replace(
      "const GAME_STATS_SESSION_BUILD_RETRY_ATTEMPTS = 60;",
      "const GAME_STATS_SESSION_BUILD_RETRY_ATTEMPTS = 3;"
    )
    .replace(
      "const GAME_STATS_SESSION_BUILD_RETRY_INTERVAL_MS = 2000;",
      "const GAME_STATS_SESSION_BUILD_RETRY_INTERVAL_MS = 100;"
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
  let releaseCompatibleSession;
  const compatibleSessionRelease = new Promise((resolve) => {
    releaseCompatibleSession = resolve;
  });

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/sessions") {
      sessionRequests.push(JSON.parse(request.postData() || "{}"));
      if (sessionRequests.length === 1) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            error: "Game build version is not compatible",
          }),
        });
        return;
      }
      await compatibleSessionRelease;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          id: "session-build-rollout",
          token: "session-build-rollout-token",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      });
      return;
    }
    if (url.pathname === "/events") {
      eventRequests.push(JSON.parse(request.postData() || "{}"));
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, applied: true, eventId: "accepted-rollout" }),
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

  return {
    eventRequests,
    sessionRequests,
    statsRequests,
    releaseCompatibleSession,
  };
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
  test(`a temporary Solitaire build mismatch retries and publishes at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await installBackendConfig(page);
    await installMainBridge(page);
    const api = await installApi(page);
    const { sessionKey, statsWindow } = await preparePage(page);
    const status = statsWindow.locator("[data-game-stats-sync-status]");
    const refreshButton = statsWindow.locator('[data-game-stats-refresh="solitaire"]');

    await expect(statsWindow).toBeVisible();
    await expect(statsWindow).not.toHaveClass(/is-opening/);
    await expect
      .poll(() =>
        statsWindow.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return (
            bounds.top >= 0 &&
            bounds.left >= 0 &&
            bounds.right <= window.innerWidth &&
            bounds.bottom <= window.innerHeight
          );
        })
      )
      .toBe(true);
    await expect(status).toHaveText(releaseWaitingMessage);
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "release-waiting");
    await expect(status).toHaveAttribute("role", "status");
    await expect(refreshButton).toBeDisabled();
    await expect(refreshButton).toHaveAttribute("data-game-stats-action", "none");
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`${viewport.name}-release-waiting.png`),
    });

    api.releaseCompatibleSession();
    await expect(status).toHaveText("Global stats are up to date.");
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
    await expect(refreshButton).toBeEnabled();
    await expect(refreshButton).toHaveAttribute("data-game-stats-action", "refresh");

    expect(api.sessionRequests[0]).toEqual({
      game: "solitaire",
      config: {},
      buildVersion: BUILD_VERSION,
    });
    expect(api.eventRequests).toEqual([]);
    expect(api.statsRequests.length).toBeGreaterThanOrEqual(1);
    const statsRequestsBeforeWin = api.statsRequests.length;
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
    await expect(status).toHaveText("Global stats are up to date.");
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
    expect(api.statsRequests.length).toBeGreaterThan(statsRequestsBeforeWin);
    expect(api.sessionRequests).toEqual([
      { game: "solitaire", config: {}, buildVersion: BUILD_VERSION },
      { game: "solitaire", config: {}, buildVersion: BUILD_VERSION },
    ]);
    expect(api.eventRequests).toHaveLength(1);
    expect(api.eventRequests[0].session).toEqual({
      id: "session-build-rollout",
      token: "session-build-rollout-token",
    });
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

    await expect
      .poll(() =>
        statsWindow.evaluate(
          (element) => element.getBoundingClientRect().right <= window.innerWidth
        )
      )
      .toBe(true);
    const layout = await statsWindow.evaluate((element) => ({
      documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
      statusOverflows:
        element.querySelector("[data-game-stats-sync-status]").scrollWidth >
        element.querySelector("[data-game-stats-sync-status]").clientWidth,
      windowBottom: element.getBoundingClientRect().bottom,
      windowLeft: element.getBoundingClientRect().left,
      windowRight: element.getBoundingClientRect().right,
      windowTop: element.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }));
    expect(layout.documentOverflows).toBe(false);
    expect(layout.statusOverflows).toBe(false);
    expect(layout.windowBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.windowLeft).toBeGreaterThanOrEqual(0);
    expect(layout.windowRight).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.windowTop).toBeGreaterThanOrEqual(0);

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`${viewport.name}-published.png`),
    });
    expect(runtimeErrors.consoleErrors).toEqual([
      "Failed to load resource: the server responded with a status of 409 (Conflict)",
    ]);
    expect(runtimeErrors.pageErrors).toEqual([]);

  });
}
