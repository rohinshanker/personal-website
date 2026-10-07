import { expect, test } from "./deterministic.mjs";
import {
  PRODUCTION_BUILD_VERSION,
  REVIEW_VIEWPORTS,
  consumeDiagnostics,
  installGameStatsBackend,
  settleRender,
} from "./helpers/rendered-site.mjs";
import { createIssuedGameResponder } from "./helpers/verified-game-session.mjs";
import { verifiedSnakeFixtures } from "../helpers/verified-ms-snake-fixtures.mjs";

const API_BASE_URL = "https://game-stats-snake-publish.test";
const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const GAME_STATS_SYNC_QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const SNAKE_HIGH_SCORE_KEY = "personalSiteSnakeHighScores";
const profile = Object.freeze({
  id: "player-snake-publish",
  name: "Snake Publisher",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});
const viewports = REVIEW_VIEWPORTS;
const scoringSnakeInitial = verifiedSnakeFixtures.scoringLoss.initial;

const isPlayerStatsPath = (path, playerId) => {
  const url = new URL(path, API_BASE_URL);
  return (
    url.pathname === "/stats" &&
    url.searchParams.get("protocol") === "2" &&
    url.searchParams.get("playerId") === playerId
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

const createStatsPayload = (publishedEvent, acknowledgedEventIds = []) => {
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
    version: 2,
    generatedAt: new Date().toISOString(),
    acknowledgedEventIds,
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
  {
    canonicalMetric = 0,
    eventDelayMs = 0,
    finishFailure = null,
    holdCompletion = false,
    initial = verifiedSnakeFixtures.validLoss.initial,
    rejectEvent = false,
    retryEventOnce = false,
  } = {}
) => {
  const eventRequests = [];
  const statsRequests = [];
  const requestSequence = [];
  let publishedEvent = null;
  let retryEligibleAt = 0;
  let retryRejected = false;
  let releaseCompletion = () => {};
  const completionGate = holdCompletion
    ? new Promise((resolve) => { releaseCompletion = resolve; })
    : Promise.resolve();
  const verified = createIssuedGameResponder({
    games: ["snake"],
    initials: { snake: initial },
    receipts: {
      snake: {
        type: "gamePlayed",
        boardSize: "10",
        metric: canonicalMetric,
        metricKind: "score",
      },
    },
    elapsedMs: 1_180,
    finishFailure,
    beforeCompletion: holdCompletion ? () => completionGate : null,
  });
  const corsHeaders = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  };

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === "/sessions") {
      requestSequence.push("session");
    }
    if (await verified.handle(route)) return;
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
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
      if (retryEventOnce && !retryRejected) {
        retryRejected = true;
        retryEligibleAt = Date.now() + 1_000;
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
      const acknowledgedEventIds =
        publishedEvent &&
        url.searchParams.getAll("pendingEventId").includes(publishedEvent.id)
          ? [publishedEvent.id]
          : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify(createStatsPayload(publishedEvent, acknowledgedEventIds)),
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
    releaseCompletion,
    statsRequests,
    verified,
  };
};

const preparePage = async (
  page,
  viewport,
  {
    canonicalMetric = 0,
    eventDelayMs = 0,
    exerciseTiming = true,
    expectedScore = 0,
    finishFailure = null,
    holdCompletion = false,
    initial = verifiedSnakeFixtures.validLoss.initial,
    rejectEvent = false,
    retryEventOnce = false,
    waitForEvent = true,
  } = {}
) => {
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
  await installGameStatsBackend(page, { apiBaseUrl: API_BASE_URL });
  const api = await installApi(page, {
    canonicalMetric,
    eventDelayMs,
    finishFailure,
    holdCompletion,
    initial,
    rejectEvent,
    retryEventOnce,
  });

  await page.goto("/home.html", { waitUntil: "load" });
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
  if (exerciseTiming) {
    await snakeWindow.locator("#snake-canvas").focus();
    await page.keyboard.press("ArrowUp");
  } else {
    await snakeWindow.locator("#snake-start").click();
  }
  await expect.poll(() => api.verified.issued.length).toBe(1);
  await expect.poll(() => api.verified.timing.length).toBe(1);
  if (exerciseTiming) {
    await snakeWindow.locator("#snake-start").click();
    await expect.poll(() => api.verified.timing.length).toBe(2);
    await snakeWindow.locator("#snake-canvas").focus();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => api.verified.timing.length).toBe(3);
  }
  await expect(snakeWindow.locator("#snake-status")).toHaveText("Signal lost", {
    timeout: 8_000,
  });
  await expect(snakeWindow.locator("#snake-score")).toHaveText(String(expectedScore));
  if (waitForEvent) {
    await expect.poll(() => api.eventRequests.length).toBeGreaterThanOrEqual(1);
  }

  return {
    api,
    snakeWindow,
    statsWindow: page.locator("#game-stats-window-snake"),
  };
};

const expectPublishedRequestContract = (api) => {
  const descriptor = api.verified.boardFor("snake");
  expect(Date.parse(descriptor.expiresAt) - Date.now()).toBeGreaterThan(5 * 60 * 60 * 1000);
  expect(Date.parse(descriptor.expiresAt) - Date.now()).toBeLessThanOrEqual(6 * 60 * 60 * 1000);
  expect(api.verified.issued).toEqual([
    {
      game: "snake",
      config: { boardSize: "10" },
      buildVersion: PRODUCTION_BUILD_VERSION,
      resultProtocol: 2,
      rulesVersion: 1,
      replayVersion: 1,
      generatorVersion: 1,
    },
  ]);
  expect(api.verified.timing.map(({ request }) => request)).toEqual([
    {
      session: { id: descriptor.id, token: descriptor.token },
      operation: "resume",
      expectedRevision: 0,
      inputCount: 0,
      inputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    },
    {
      session: { id: descriptor.id, token: descriptor.token },
      operation: "pause",
      expectedRevision: 1,
      inputCount: 1,
      inputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    },
    {
      session: { id: descriptor.id, token: descriptor.token },
      operation: "resume",
      expectedRevision: 2,
      inputCount: 1,
      inputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    },
  ]);
  expect(api.verified.timing[2].request.inputHash).toBe(api.verified.timing[1].request.inputHash);
  expect(api.verified.finishes).toHaveLength(1);
  expect(api.verified.finishes[0].request).toMatchObject({
    session: { id: descriptor.id, token: descriptor.token },
    gameId: descriptor.id,
    rulesVersion: 1,
    replayVersion: 1,
    inputs: [
      { seq: 1, op: "direction", tick: 0, direction: "up" },
      { seq: 2, op: "direction", tick: 0, direction: "left" },
    ],
    terminalTick: expect.any(Number),
    timingRevision: 3,
  });
  expect(api.verified.finishes[0].request.terminalTick).toBeGreaterThan(0);
  expect(api.verified.continuations.map(({ request }) => request)).toEqual([{
    session: { id: descriptor.id, token: descriptor.token },
    progress: { id: "progress-1", token: "synthetic-progress-proof" },
  }]);
  expect(api.eventRequests).toHaveLength(1);
  expect(api.eventRequests[0].event).toEqual({
    id: expect.stringMatching(/^local-[a-f0-9-]{36}$/),
    game: "snake",
    type: "gamePlayed",
    occurredAt: expect.any(String),
    boardSize: "10",
    metric: 0,
    metricKind: "score",
    profile: {
      id: profile.id,
      name: profile.name,
      icon: profile.icon,
    },
  });
  expect(api.eventRequests[0].completion).toEqual({
    id: `completion-${descriptor.id}`,
    token: "synthetic-completion-proof",
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
    metric: 0,
    metricKind: "score",
  });
  expect(stored.stats.playerRecords.snake[10]).toMatchObject({
    playerId: profile.id,
    metric: 0,
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
    const { api, statsWindow } = await preparePage(page, viewport);
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
      "Rank 3: Snake Publisher, 0 points, your entry"
    );
    await expect(currentRecord).toHaveAttribute(
      "aria-label",
      "Your record: #3, Snake Publisher, 0 points"
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
    expect(api.statsRequests.every(({ path }) => isPlayerStatsPath(path, profile.id))).toBe(true);
    expect(
      api.statsRequests.some(({ path }) => {
        const url = new URL(path, API_BASE_URL);
        return (
          url.searchParams.get("fresh") === "1" &&
          url.searchParams.getAll("pendingEventId").includes(api.eventRequests[0].event.id)
        );
      })
    ).toBe(true);
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
  });
}

test("a delayed eligible Snake result still completes inside the browser timeout", async ({
  page,
}) => {
  const { api, statsWindow } = await preparePage(
    page,
    { width: 1280, height: 800 },
    { eventDelayMs: 3_500 }
  );
  const status = statsWindow.locator("[data-game-stats-sync-status]");

  await expect(status).toHaveText("Global stats are up to date.", { timeout: 7_000 });
  await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
  expectPublishedRequestContract(api);
  expectLocalSnakeResult(await readStoredStats(page));
});

test("a 425 Snake result remains queued and publishes on manual retry", async ({
  diagnostics,
  page,
}) => {
  const { api, statsWindow } = await preparePage(
    page,
    { width: 1280, height: 800 },
    { retryEventOnce: true }
  );
  const status = statsWindow.locator("[data-game-stats-sync-status]");

  if (await status.getAttribute("data-game-stats-sync-state") === "request-failed") {
    const waiting = await readStoredStats(page);
    expect(waiting.queue).toHaveLength(1);
    expect(waiting.stats.totals.snake.gamesPlayed[10]).toBe(1);
    await expect.poll(() => Date.now() >= api.getRetryEligibleAt()).toBe(true);
    await statsWindow.locator('[data-game-stats-refresh="snake"]').click();
  }
  await expect.poll(() => api.eventRequests.length).toBeGreaterThanOrEqual(2);
  await expect(status).toHaveText("Global stats are up to date.");
  await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
  api.eventRequests.slice(1).forEach((request) => expect(request).toEqual(api.eventRequests[0]));
  expectLocalSnakeResult(await readStoredStats(page));
  expect(api.statsRequests.some(({ refreshed }) => refreshed)).toBe(true);
  // The 425 that forces the retry is the behaviour under test; the fixture
  // still fails on anything else the page reported.
  consumeDiagnostics(diagnostics, {
    consoleErrors: [/status of 425 \(Too Early\)/],
    errorResponses: [`425 ${API_BASE_URL}/events`],
  });
});

test("a rejected Snake result stays local and never fabricates global stats", async ({
  diagnostics,
  page,
}, testInfo) => {
  const { api, statsWindow } = await preparePage(
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
  await expect(status).toHaveText("Local stats are saved, but a result could not pass server verification.");
  await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
  await expect(globalRows10.nth(0)).toHaveAttribute("aria-label", "Rank 1: Aria, 8 points");
  await expect(globalRows10.nth(1)).toHaveAttribute("aria-label", "Rank 2: Nia, 4 points");
  await expect(globalRows10.nth(2)).toHaveAttribute("aria-label", "Rank 3: N/A, 0 points");
  await expect(
    panel10.locator('[aria-label="Global games played on 10×10: 2"]')
  ).toBeVisible();
  await expect(panel10.locator(".game-stats-snake-local-best-row")).toHaveAttribute(
    "aria-label",
    "Your record: #—, Snake Publisher, 0 points"
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
  // The server rejection is the behaviour under test; the fixture still fails
  // on anything else the page reported.
  consumeDiagnostics(diagnostics, {
    consoleErrors: [
      "Failed to load resource: the server responded with a status of 400 (Bad Request)",
    ],
    errorResponses: [`400 ${API_BASE_URL}/events`],
  });
});

for (const viewport of viewports) {
  test(`an expired Snake completion stays local at ${viewport.name}`, async ({
    diagnostics,
    page,
  }, testInfo) => {
    const { api, statsWindow } = await preparePage(
      page,
      viewport,
      {
        exerciseTiming: false,
        finishFailure: { status: 409, code: "session-expired" },
        waitForEvent: false,
      }
    );
    const status = statsWindow.locator("[data-game-stats-sync-status]");

    await expect(statsWindow).toBeVisible();
    await expect(status).toHaveAttribute("data-game-stats-sync-state", "session-expired");
    await expect(status).toHaveText(
      "Saved on this device. This game's online session expired, so this result can't be published. Start a new game to publish a new result."
    );
    expect(api.verified.issued).toHaveLength(1);
    expect(api.verified.timing).toHaveLength(1);
    expect(api.verified.finishes).toHaveLength(1);
    expect(api.verified.continuations).toHaveLength(0);
    expect(api.eventRequests).toHaveLength(0);
    expectLocalSnakeResult(await readStoredStats(page));
    await settleRender(page);
    await expectStatsWindowContained(page, statsWindow);

    const screenshotPath = testInfo.outputPath(
      `snake-expired-local-${viewport.width}x${viewport.height}.png`
    );
    await page.screenshot({ fullPage: true, path: screenshotPath });
    await testInfo.attach(`snake-expired-local-${viewport.name}`, {
      path: screenshotPath,
      contentType: "image/png",
    });
    consumeDiagnostics(diagnostics, {
      consoleErrors: [/status of 409 \(Conflict\)/],
      errorResponses: [new RegExp(`409 ${API_BASE_URL}/sessions/[^/]+/finish$`)],
    });
  });
}

test("a canonical Snake correction after Reset Local Stats updates only the finished display", async ({
  page,
}) => {
  const { api, snakeWindow } = await preparePage(
    page,
    { width: 1280, height: 800 },
    {
      canonicalMetric: 1,
      exerciseTiming: false,
      expectedScore: 1,
      holdCompletion: true,
      initial: scoringSnakeInitial,
      waitForEvent: false,
    }
  );
  await expect.poll(() => api.verified.continuations.length).toBe(1);
  expect(JSON.parse(await page.evaluate((key) => localStorage.getItem(key), SNAKE_HIGH_SCORE_KEY))).toEqual({
    10: 1,
  });

  await page.locator('.desktop-icon[data-app="game-progress"]').click();
  const progressWindow = page.locator('[data-app-window="game-progress"]');
  await expect(progressWindow).toBeVisible();
  await progressWindow.locator("#game-progress-reset-local").click();
  await expect.poll(() => page.evaluate(
    (key) => localStorage.getItem(key),
    SNAKE_HIGH_SCORE_KEY
  )).toBeNull();

  api.releaseCompletion();
  await expect.poll(() => api.eventRequests.length).toBe(1);
  await expect(snakeWindow.locator("#snake-score")).toHaveText("1");
  await expect(snakeWindow.locator("#snake-high-score")).toHaveText("0");
  expect(await page.evaluate((key) => localStorage.getItem(key), SNAKE_HIGH_SCORE_KEY)).toBeNull();
});

test("Snake close and reset discard an issued follow-up run without finishing it", async ({ page }) => {
  const { api, snakeWindow } = await preparePage(page, { width: 1280, height: 800 });
  expect(api.verified.issued).toHaveLength(1);
  expect(api.verified.finishes).toHaveLength(1);

  await snakeWindow.locator("#snake-reset").click();
  await snakeWindow.locator("#snake-start").click();
  await expect.poll(() => api.verified.issued.length).toBe(2);
  await expect.poll(() => api.verified.timing.length).toBe(4);
  await snakeWindow.getByRole("button", { name: "Close" }).click();
  await expect(snakeWindow).toBeHidden();
  await expect.poll(() => api.verified.timing.length).toBe(5);
  await page.locator('.desktop-icon[data-app="snake"]').click();
  await expect(snakeWindow).toBeVisible();
  await snakeWindow.locator("#snake-reset").click();
  await expect(snakeWindow.locator("#snake-status")).toHaveText("Ready");
  await expect(snakeWindow.locator("#snake-score")).toHaveText("0");
  expect(api.verified.finishes).toHaveLength(1);
  expect(api.eventRequests).toHaveLength(1);
});
