import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";

const API_BASE_URL = "https://game-stats-snake-publish.test";
const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const GAME_STATS_SYNC_QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const SNAKE_HIGH_SCORE_KEY = "personalSiteSnakeHighScores";
const SESSION_ID = "session-snake-publish-0001";
const SESSION_TOKEN = "session-snake-publish-token";
const profile = Object.freeze({
  id: "player-snake-publish",
  name: "Snake Publisher",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});
const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const generatedBackendSource = await readFile(
  new URL("../../scripts/home/game-stats-backend.js", import.meta.url),
  "utf8"
);
const generatedBuildVersion = generatedBackendSource.match(
  /buildVersion:\s*"(sha256-[a-f0-9]{64})"/
)?.[1];
if (!generatedBuildVersion) {
  throw new Error("Unable to read the generated game build version.");
}

const installBackendConfig = async (page) => {
  const mockedBackendSource = generatedBackendSource.replace(
    /apiBaseUrl:\s*"[^"]*"/,
    `apiBaseUrl: ${JSON.stringify(API_BASE_URL)}`
  );
  if (mockedBackendSource === generatedBackendSource) {
    throw new Error("Unable to install the Snake publish backend config.");
  }
  await page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: mockedBackendSource,
    })
  );
};

const installMainBridge = async (page) => {
  const mainSource = await readIsolatedMainSource();
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__snakePublishFlowTest = Object.freeze({
  finishRun: () => {
    clearSnakeCountdown();
    clearSnakeTick();
    snakeState.running = true;
    snakeState.hasStarted = true;
    snakeState.direction = "right";
    snakeState.nextDirection = "right";
    snakeState.directionQueue = [];
    snakeState.snake = [
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ];
    snakeState.apples = [{ x: 5, y: 5, sweepOffset: 0 }];
    rebuildSnakeOccupiedCells();
    snakeStep();

    clearSnakeTick();
    snakeState.snake = [
      { x: 9, y: 5 },
      { x: 8, y: 5 },
      { x: 7, y: 5 },
      { x: 6, y: 5 },
    ];
    snakeState.apples = [{ x: 0, y: 0, sweepOffset: 0 }];
    snakeState.direction = "right";
    snakeState.nextDirection = "right";
    snakeState.directionQueue = [];
    rebuildSnakeOccupiedCells();
    snakeStep();

    return {
      boardSize: snakeState.gridSize,
      gameOver: snakeState.gameOver,
      hasStarted: snakeState.hasStarted,
      score: snakeState.score,
    };
  },
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the Snake publish test bridge.");
  }
  await page.route("**/scripts/home/main.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedSource,
    })
  );
};

const createLeaderboardEntry = ({
  eventId,
  playerId,
  name,
  icon = profile.icon,
  metric,
  occurredAt,
}) => ({
  eventId,
  playerId,
  name,
  icon,
  metric,
  metricKind: "score",
  occurredAt,
});

const emptySnakeMap = (valueFactory) =>
  Object.fromEntries(
    ["10", "16", "20", "24"].map((size) => [size, valueFactory(size)])
  );

const createStatsPayload = (publishedEvent) => {
  const refreshed = Boolean(publishedEvent);
  const currentPlayerEntry = refreshed
    ? createLeaderboardEntry({
        eventId: publishedEvent.id,
        playerId: profile.id,
        name: profile.name,
        metric: publishedEvent.metric,
        occurredAt: publishedEvent.occurredAt,
      })
    : null;
  const leaderboard10 = [
    createLeaderboardEntry({
      eventId: "snake-global-aria-0001",
      playerId: "player-snake-aria",
      name: "Aria",
      metric: 8,
      occurredAt: "2026-07-01T00:00:00.000Z",
    }),
    createLeaderboardEntry({
      eventId: "snake-global-nia-0001",
      playerId: "player-snake-nia",
      name: "Nia",
      metric: 4,
      occurredAt: "2026-07-02T00:00:00.000Z",
    }),
    ...(currentPlayerEntry ? [currentPlayerEntry] : []),
  ];
  return {
    generatedAt: new Date().toISOString(),
    eventIds: refreshed ? [publishedEvent.id] : [],
    totals: {
      snake: {
        totalGamesPlayed: refreshed ? 3 : 2,
        gamesPlayed: {
          10: refreshed ? 3 : 2,
          16: 0,
          20: 0,
          24: 0,
        },
      },
    },
    leaderboards: {
      snake: {
        ...emptySnakeMap(() => []),
        10: leaderboard10,
      },
    },
    playerRanks: {
      snake: {
        ...emptySnakeMap(() => ({ rank: null, totalPlayers: 0 })),
        10: refreshed
          ? { rank: 3, totalPlayers: 3 }
          : { rank: null, totalPlayers: 2 },
      },
    },
    playerRecords: {
      snake: {
        ...emptySnakeMap(() => null),
        10: currentPlayerEntry,
      },
    },
  };
};

const installApi = async (
  page,
  { eventDelayMs = 0, rejectEvent = false, retryEventOnce = false } = {}
) => {
  const sessionRequests = [];
  const eventRequests = [];
  const statsRequests = [];
  const requestSequence = [];
  let publishedEvent = null;
  let retryEligibleAt = 0;
  const corsHeaders = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  };

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/sessions") {
      const body = JSON.parse(request.postData() || "{}");
      sessionRequests.push(body);
      requestSequence.push("session");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          id: SESSION_ID,
          token: SESSION_TOKEN,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
      });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/events") {
      const body = JSON.parse(request.postData() || "{}");
      eventRequests.push(body);
      requestSequence.push("event");
      if (rejectEvent) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          headers: corsHeaders,
          body: JSON.stringify({
            ok: false,
            error: "Game result could not pass server verification",
          }),
        });
        return;
      }
      if (retryEventOnce && (!retryEligibleAt || Date.now() < retryEligibleAt)) {
        if (!retryEligibleAt) retryEligibleAt = Date.now() + 1_000;
        const retryAfterMs = Math.max(1, retryEligibleAt - Date.now());
        await route.fulfill({
          status: 425,
          contentType: "application/json",
          headers: {
            ...corsHeaders,
            "Access-Control-Expose-Headers": "Retry-After",
            "Retry-After": String(Math.ceil(retryAfterMs / 1_000)),
          },
          body: JSON.stringify({
            ok: false,
            error: "Snake result is not eligible yet",
            retryAfterMs,
          }),
        });
        return;
      }
      if (eventDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, eventDelayMs));
      }
      publishedEvent = body.event;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({ ok: true, applied: true }),
      });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/stats") {
      const refreshed = Boolean(publishedEvent);
      statsRequests.push({ path: url.pathname + url.search, refreshed });
      requestSequence.push(refreshed ? "stats-refreshed" : "stats-baseline");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify(createStatsPayload(publishedEvent)),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Unexpected test route" }),
    });
  });

  return {
    eventRequests,
    getRetryEligibleAt: () => retryEligibleAt,
    requestSequence,
    sessionRequests,
    statsRequests,
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

const preparePage = async (
  page,
  viewport,
  { eventDelayMs = 0, rejectEvent = false, retryEventOnce = false } = {}
) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ profileKey, queueKey, savedProfile, snakeHighScoreKey, statsKey }) => {
      Math.random = () => 0.999999;
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
      localStorage.removeItem(queueKey);
      localStorage.removeItem(snakeHighScoreKey);
      localStorage.removeItem(statsKey);
    },
    {
      profileKey: PROFILE_STORAGE_KEY,
      queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      savedProfile: profile,
      snakeHighScoreKey: SNAKE_HIGH_SCORE_KEY,
      statsKey: GAME_STATS_STORAGE_KEY,
    }
  );
  await installBackendConfig(page);
  await installMainBridge(page);
  const api = await installApi(page, { eventDelayMs, rejectEvent, retryEventOnce });

  await page.goto("/home.html");
  const aboutWindow = page.locator("#about-window");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) {
    await aboutClose.click();
    await expect(aboutWindow).toBeHidden();
  }
  await page.locator('.desktop-icon[data-app="snake"]').click();
  const snakeWindow = page.locator('[data-app-window="snake"]');
  await expect(snakeWindow).toBeVisible();
  await expect(page.locator("#snake-loading-panel")).toHaveAttribute("aria-hidden", "true", {
    timeout: 6_000,
  });
  await snakeWindow.locator('[data-snake-board-size="10"]').click();
  await expect(snakeWindow.locator('[data-snake-board-size="10"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await snakeWindow.locator("#snake-start").click();
  await expect.poll(() => api.sessionRequests.length).toBe(1);
  const finished = await page.evaluate(() => window.__snakePublishFlowTest.finishRun());
  expect(finished).toEqual({
    boardSize: 10,
    gameOver: true,
    hasStarted: true,
    score: 1,
  });
  await expect.poll(() => api.eventRequests.length).toBe(1);

  return {
    api,
    runtimeErrors,
    snakeWindow,
    statsWindow: page.locator("#game-stats-window-snake"),
  };
};

const expectPublishedRequestContract = (api) => {
  expect(generatedBuildVersion).toMatch(/^sha256-[a-f0-9]{64}$/);
  expect(api.sessionRequests).toEqual([
    {
      game: "snake",
      config: { boardSize: "10" },
      buildVersion: generatedBuildVersion,
    },
  ]);
  expect(api.eventRequests).toHaveLength(1);
  expect(api.eventRequests[0].event).toEqual({
    id: expect.stringMatching(/^local-[a-f0-9-]{36}$/),
    game: "snake",
    type: "gamePlayed",
    occurredAt: expect.any(String),
    boardSize: "10",
    metric: 1,
    metricKind: "score",
    profile: {
      id: profile.id,
      name: profile.name,
      icon: profile.icon,
    },
  });
  expect(api.eventRequests[0].session).toEqual({
    id: SESSION_ID,
    token: SESSION_TOKEN,
  });
  expect(api.requestSequence.indexOf("session")).toBeLessThan(
    api.requestSequence.indexOf("event")
  );
};

const readStoredStats = (page) =>
  page.evaluate(
    ({ queueKey, statsKey }) => ({
      queue: JSON.parse(localStorage.getItem(queueKey) || "[]"),
      stats: JSON.parse(localStorage.getItem(statsKey) || "null"),
    }),
    {
      queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      statsKey: GAME_STATS_STORAGE_KEY,
    }
  );

const expectLocalSnakeResult = (stored) => {
  expect(stored.queue).toEqual([]);
  expect(stored.stats.totals.snake.totalGamesPlayed).toBe(1);
  expect(stored.stats.totals.snake.gamesPlayed).toEqual({
    10: 1,
    16: 0,
    20: 0,
    24: 0,
  });
  expect(stored.stats.leaderboards.snake[10][0]).toMatchObject({
    playerId: profile.id,
    metric: 1,
    metricKind: "score",
  });
  expect(stored.stats.playerRecords.snake[10]).toMatchObject({
    playerId: profile.id,
    metric: 1,
    metricKind: "score",
  });
};

const expectStatsWindowContained = async (page, statsWindow) => {
  const layout = await statsWindow.evaluate((windowElement) => {
    const bounds = windowElement.getBoundingClientRect();
    const body = windowElement.querySelector(".window-body");
    return {
      bodyOverflows: body.scrollWidth > body.clientWidth,
      documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
      left: bounds.left,
      right: bounds.right,
      viewportWidth: window.innerWidth,
    };
  });
  expect(layout.bodyOverflows).toBe(false);
  expect(layout.documentOverflows).toBe(false);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
};

for (const viewport of viewports) {
  test(`a verified Snake run publishes and refreshes global stats at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const { api, runtimeErrors, statsWindow } = await preparePage(page, viewport);
    const status = statsWindow.locator("[data-game-stats-sync-status]");
    const panel10 = statsWindow.locator('[aria-labelledby="game-stats-snake-10"]');
    const globalRows10 = panel10.locator(
      ".game-stats-leaderboard-template-list > .game-stats-snake-row"
    );
    const currentRecord = panel10.locator(".game-stats-snake-local-best-row");

    await expect(statsWindow).toBeVisible();
    await expect(status).toHaveText("Global stats are up to date.");
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
    await expect(status).toHaveAttribute("role", "status");
    await expect(panel10.getByText("Global Top 3", { exact: true })).toBeVisible();
    await expect(globalRows10).toHaveCount(3);
    await expect(globalRows10.nth(0)).toHaveAttribute(
      "aria-label",
      "Rank 1: Aria, 8 points"
    );
    await expect(globalRows10.nth(1)).toHaveAttribute(
      "aria-label",
      "Rank 2: Nia, 4 points"
    );
    await expect(globalRows10.nth(2)).toHaveAttribute(
      "aria-label",
      "Rank 3: Snake Publisher, 1 points, your entry"
    );
    await expect(currentRecord).toHaveAttribute(
      "aria-label",
      "Your record: #3, Snake Publisher, 1 points"
    );
    await expect(
      panel10.locator('[aria-label="Global games played on 10×10: 3"]')
    ).toBeVisible();

    for (const size of ["16", "20", "24"]) {
      const panel = statsWindow.locator(`[aria-labelledby="game-stats-snake-${size}"]`);
      const rows = panel.locator(
        ".game-stats-leaderboard-template-list > .game-stats-snake-row"
      );
      await expect(
        panel.locator(`[aria-label="Global games played on ${size}×${size}: 0"]`)
      ).toBeVisible();
      await expect(rows).toHaveCount(3);
      for (let index = 0; index < 3; index += 1) {
        await expect(rows.nth(index)).toHaveAttribute(
          "aria-label",
          `Rank ${index + 1}: N/A, 0 points`
        );
      }
      await expect(panel.locator(".game-stats-snake-local-best-row")).toHaveAttribute(
        "aria-label",
        "Your record: #—, Snake Publisher, 0 points"
      );
    }

    expectPublishedRequestContract(api);
    expect(api.statsRequests.some(({ refreshed }) => !refreshed)).toBe(true);
    expect(api.statsRequests.some(({ refreshed }) => refreshed)).toBe(true);
    expect(api.statsRequests.every(({ path }) => path === `/stats?playerId=${profile.id}`)).toBe(
      true
    );
    expectLocalSnakeResult(await readStoredStats(page));

    const refreshButton = statsWindow.locator('[data-game-stats-refresh="snake"]');
    await expect(refreshButton).toHaveAttribute("aria-label", "Refresh Snake stats");
    await refreshButton.focus();
    await expect(refreshButton).toBeFocused();
    await expectStatsWindowContained(page, statsWindow);
    const screenshotPath = testInfo.outputPath(
      `snake-publish-success-${viewport.width}x${viewport.height}.png`
    );
    await page.screenshot({
      fullPage: true,
      path: screenshotPath,
    });
    await testInfo.attach(`snake-publish-success-${viewport.name}`, {
      path: screenshotPath,
      contentType: "image/png",
    });
    expect(runtimeErrors.consoleErrors).toEqual([]);
    expect(runtimeErrors.pageErrors).toEqual([]);
  });
}

test("a delayed eligible Snake result still completes inside the browser timeout", async ({
  page,
}, testInfo) => {
  const { api, runtimeErrors, statsWindow } = await preparePage(
    page,
    { width: 1280, height: 800 },
    { eventDelayMs: 3_500 }
  );
  const status = statsWindow.locator("[data-game-stats-sync-status]");

  await expect(status).toHaveText("Global stats are up to date.", { timeout: 7_000 });
  await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
  expectPublishedRequestContract(api);
  expectLocalSnakeResult(await readStoredStats(page));
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("desktop-snake-publish-delayed-success.png"),
  });
  expect(runtimeErrors.consoleErrors).toEqual([]);
  expect(runtimeErrors.pageErrors).toEqual([]);
});

test("a 425 Snake result remains queued and publishes on manual retry", async ({
  page,
}, testInfo) => {
  const { api, runtimeErrors, statsWindow } = await preparePage(
    page,
    { width: 1280, height: 800 },
    { retryEventOnce: true }
  );
  const status = statsWindow.locator("[data-game-stats-sync-status]");

  await expect(status).toHaveText("Request failed. Try again later.");
  await expect(status).toHaveAttribute("data-game-stats-sync-state", "request-failed");
  const waiting = await readStoredStats(page);
  expect(waiting.queue).toHaveLength(1);
  expect(waiting.stats.totals.snake.gamesPlayed[10]).toBe(1);
  expect(api.eventRequests).toHaveLength(1);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("desktop-snake-publish-425-waiting.png"),
  });
  await expect.poll(() => Date.now() >= api.getRetryEligibleAt()).toBe(true);
  await statsWindow.locator('[data-game-stats-refresh="snake"]').click();
  await expect.poll(() => api.eventRequests.length).toBe(2);
  await expect(status).toHaveText("Global stats are up to date.");
  await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
  expect(api.eventRequests[1]).toEqual(api.eventRequests[0]);
  expectLocalSnakeResult(await readStoredStats(page));
  expect(api.statsRequests.some(({ refreshed }) => refreshed)).toBe(true);
  expect(runtimeErrors.consoleErrors).toHaveLength(1);
  expect(runtimeErrors.consoleErrors[0]).toMatch(/status of 425/);
  expect(runtimeErrors.pageErrors).toEqual([]);
});

test("a rejected Snake result stays local and never fabricates global stats", async ({
  page,
}, testInfo) => {
  const { api, runtimeErrors, statsWindow } = await preparePage(
    page,
    { width: 1280, height: 800 },
    { rejectEvent: true }
  );
  const status = statsWindow.locator("[data-game-stats-sync-status]");
  const panel10 = statsWindow.locator('[aria-labelledby="game-stats-snake-10"]');
  const globalRows10 = panel10.locator(
    ".game-stats-leaderboard-template-list > .game-stats-snake-row"
  );

  await expect(statsWindow).toBeVisible();
  await expect(status).toHaveText(
    "Local stats are saved, but a result could not pass server verification."
  );
  await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
  await expect(globalRows10.nth(0)).toHaveAttribute("aria-label", "Rank 1: Aria, 8 points");
  await expect(globalRows10.nth(1)).toHaveAttribute("aria-label", "Rank 2: Nia, 4 points");
  await expect(globalRows10.nth(2)).toHaveAttribute("aria-label", "Rank 3: N/A, 0 points");
  await expect(
    panel10.locator('[aria-label="Global games played on 10×10: 2"]')
  ).toBeVisible();
  await expect(panel10.locator(".game-stats-snake-local-best-row")).toHaveAttribute(
    "aria-label",
    "Your record: #—, Snake Publisher, 1 points"
  );

  expectPublishedRequestContract(api);
  expect(api.statsRequests.every(({ refreshed }) => !refreshed)).toBe(true);
  expectLocalSnakeResult(await readStoredStats(page));
  await expectStatsWindowContained(page, statsWindow);
  const screenshotPath = testInfo.outputPath("desktop-snake-publish-rejected.png");
  await page.screenshot({
    fullPage: true,
    path: screenshotPath,
  });
  await testInfo.attach("snake-publish-rejected-desktop", {
    path: screenshotPath,
    contentType: "image/png",
  });
  expect(runtimeErrors.consoleErrors).toEqual([
    "Failed to load resource: the server responded with a status of 400 (Bad Request)",
  ]);
  expect(runtimeErrors.pageErrors).toEqual([]);
});
