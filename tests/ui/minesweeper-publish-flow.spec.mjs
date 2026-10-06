import { readFile, writeFile } from "node:fs/promises";

import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import {
  FROZEN_INSTANT,
  installGameStatsBackend,
  PRODUCTION_BUILD_VERSION,
  REVIEW_VIEWPORTS,
  settleRender,
} from "./helpers/rendered-site.mjs";

const API_BASE_URL = "https://game-stats-minesweeper-publish.test";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";
const SESSION_ID = "session-minesweeper-publish-0001";
const SESSION_TOKEN = "session-minesweeper-publish-token";
const profile = Object.freeze({
  id: "player-minesweeper-publish",
  name: "Minesweeper Publisher",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

const buildVersion = PRODUCTION_BUILD_VERSION;
const minesweeperViewports = Object.freeze([
  ...REVIEW_VIEWPORTS,
  Object.freeze({ name: "below-480-breakpoint", width: 479, height: 812 }),
  Object.freeze({ name: "above-480-breakpoint", width: 481, height: 812 }),
]);
const minesweeperRulesSource = await readFile(
  new URL("../../scripts/home/games/minesweeper.js", import.meta.url),
  "utf8"
);
const snakeRulesSource = await readFile(
  new URL("../../scripts/home/games/snake.js", import.meta.url),
  "utf8"
);

const installSnakeRules = (page) =>
  routeHomeScript(page, "snake", (source) => `${snakeRulesSource}\n${source}`);

const installMinesweeperBridge = (page) =>
  routeHomeScript(page, "minesweeper", (source) =>
    // Keep the board shuffle varied without enabling unrelated random events
    // in other Home controllers. Only this controller gets a seeded Math.
    `${minesweeperRulesSource}\n${source.replace("(() => {", `(() => {
const Math = Object.create(window.Math);
let testRandomState = 0x2135f447;
Math.random = () => {
  testRandomState = (window.Math.imul(testRandomState, 1664525) + 1013904223) >>> 0;
  return testRandomState / 0x1_0000_0000;
};`).replace(
      /\n\}\)\(\);\s*$/,
      `
const prepareTestWin = () => {
  msStopTimer();
  const engine = msState.engineState;
  const finalCell = engine.cells.findIndex((cell) => !cell.mine);
  engine.cells.forEach((cell, index) => {
    cell.revealed = !cell.mine && index !== finalCell;
    cell.mark = "none";
    cell.blown = false;
    cell.misflagged = false;
  });
  engine.started = true;
  engine.terminal = false;
  engine.won = false;
  engine.lost = false;
  engine.revealedSafeCount = engine.cells.length - engine.configuration.mines - 1;
  engine.flagCount = 0;
  msState.completionHandled = false;
  msState.elapsedMs = 7_000;
  msState.elapsed = 7;
  msState.timerSync = null;
  msSyncEngineState();
  msRenderAll();
  msUpdateCounters();
  return finalCell;
};

window.__minesweeperPublishFlow = Object.freeze({
  prepareWin: prepareTestWin,
  readBoard: () => ({
    cells: msState.cells.map((cell) => ({
      adjacent: cell.adjacent,
      blown: cell.blown,
      flagged: cell.flagged,
      mine: cell.mine,
      question: cell.question,
      revealed: cell.revealed,
    })),
    cols: msState.cols,
    gameOver: msState.gameOver,
    rows: msState.rows,
    started: msState.started,
  }),
});
})();`
    )}`
  );

const emptyDifficultyMap = (factory) =>
  Object.fromEntries(["beginner", "intermediate", "expert"].map((difficulty) => [difficulty, factory()]));

const createStatsPayload = (publishedEvent, acknowledgedEventIds = []) => {
  const entry = publishedEvent
    ? {
        eventId: publishedEvent.id,
        icon: profile.icon,
        metric: publishedEvent.metric,
        metricKind: "seconds",
        name: profile.name,
        occurredAt: publishedEvent.occurredAt,
        playerId: profile.id,
      }
    : null;
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    acknowledgedEventIds,
    totals: {
      minesweeper: {
        wins: { beginner: publishedEvent ? 1 : 0, intermediate: 0, expert: 0 },
      },
    },
    playerTotals: {
      minesweeper: {
        wins: { beginner: publishedEvent ? 1 : 0, intermediate: 0, expert: 0 },
      },
    },
    leaderboards: {
      minesweeper: { ...emptyDifficultyMap(() => []), beginner: entry ? [entry] : [] },
    },
    playerRanks: {
      minesweeper: {
        ...emptyDifficultyMap(() => ({ rank: null, totalPlayers: 0 })),
        beginner: entry ? { rank: 1, totalPlayers: 1 } : { rank: null, totalPlayers: 0 },
      },
    },
    playerRecords: {
      minesweeper: { ...emptyDifficultyMap(() => null), beginner: entry },
    },
  };
};

const installApi = async (page) => {
  const sessions = [];
  const events = [];
  const statsRequests = [];
  let publishedEvent = null;
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
      sessions.push(JSON.parse(request.postData() || "{}"));
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
      events.push(body);
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
      statsRequests.push(url.pathname + url.search);
      const acknowledgedEventIds =
        publishedEvent && url.searchParams.getAll("pendingEventId").includes(publishedEvent.id)
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
      body: JSON.stringify({ ok: false }),
    });
  });
  return { events, sessions, statsRequests };
};

const preparePage = async (page, viewport) => {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(FROZEN_INSTANT);
  await page.addInitScript(
    ({ profileKey, queueKey, statsKey, savedProfile }) => {
      localStorage.clear();
      sessionStorage.clear();
      Math.random = () => 0.999999;
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
      localStorage.removeItem(queueKey);
      localStorage.removeItem(statsKey);
    },
    {
      profileKey: PROFILE_STORAGE_KEY,
      queueKey: QUEUE_STORAGE_KEY,
      savedProfile: profile,
      statsKey: STATS_STORAGE_KEY,
    }
  );
  await installGameStatsBackend(page, { apiBaseUrl: API_BASE_URL });
  await installSnakeRules(page);
  await installMinesweeperBridge(page);
  const api = await installApi(page);
  await page.goto("/home.html", { waitUntil: "load" });
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page.getByRole("toolbar", { name: "Taskbar" }).getByRole("button", { name: "Minesweeper" }).click();
  const minesweeper = page.locator('[data-app-window="minesweeper"]');
  await expect(minesweeper).toBeVisible();
  return { api, minesweeper };
};

for (const viewport of minesweeperViewports) {
  test(`Minesweeper executes safe play, win, publish, reset, and rule paths at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const { api, minesweeper } = await preparePage(page, viewport);
    const firstIndex = 40;
    await minesweeper.locator(`.ms-cell[data-index="${firstIndex}"]`).click();
    await expect.poll(() => api.sessions.length).toBe(1);
    const firstBoard = await page.evaluate(() => window.__minesweeperPublishFlow.readBoard());
    expect(firstBoard.gameOver).toBe(false);
    expect(api.events).toHaveLength(0);
    expect(firstBoard.cells[firstIndex].mine).toBe(false);
    const safeRow = Math.floor(firstIndex / firstBoard.cols);
    const safeColumn = firstIndex % firstBoard.cols;
    for (let row = safeRow - 1; row <= safeRow + 1; row += 1) {
      for (let column = safeColumn - 1; column <= safeColumn + 1; column += 1) {
        if (row < 0 || column < 0 || row >= firstBoard.rows || column >= firstBoard.cols) continue;
        expect(firstBoard.cells[row * firstBoard.cols + column].mine).toBe(false);
      }
    }

    const finalCell = await page.evaluate(() => window.__minesweeperPublishFlow.prepareWin());
    await minesweeper.locator(`.ms-cell[data-index="${finalCell}"]`).click();
    await expect.poll(() => api.events.length).toBe(1);
    expect(api.sessions).toEqual([
      { game: "minesweeper", config: { difficulty: "beginner" }, buildVersion },
    ]);
    expect(api.events[0]).toEqual({
      event: {
        id: expect.stringMatching(/^local-[a-f0-9-]{36}$/),
        game: "minesweeper",
        type: "win",
        occurredAt: expect.any(String),
        difficulty: "beginner",
        metric: 7,
        metricKind: "seconds",
        profile: { id: profile.id, name: profile.name, icon: profile.icon },
      },
      session: { id: SESSION_ID, token: SESSION_TOKEN },
    });
    const statsWindow = page.locator("#game-stats-window-minesweeper");
    await expect(statsWindow).toBeVisible();
    await expect(statsWindow).not.toHaveClass(/is-opening/);
    await expect(statsWindow.locator("[data-game-stats-sync-status]")).toHaveText(
      "Global stats are up to date."
    );
    expect(
      api.statsRequests.some((path) =>
        new URL(path, API_BASE_URL).searchParams.getAll("pendingEventId").includes(api.events[0].event.id)
      )
    ).toBe(true);

    await settleRender(page);
    const statsLayout = await statsWindow.evaluate((windowElement) => {
      const bounds = windowElement.getBoundingClientRect();
      const body = windowElement.querySelector(".window-body");
      return {
        bodyOverflows: body.scrollWidth > body.clientWidth,
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });
    expect(statsLayout.bodyOverflows).toBe(false);
    expect(statsLayout.left).toBeGreaterThanOrEqual(0);
    expect(statsLayout.right).toBeLessThanOrEqual(statsLayout.viewportWidth);
    expect(statsLayout.top).toBeGreaterThanOrEqual(0);
    expect(statsLayout.bottom).toBeLessThanOrEqual(statsLayout.viewportHeight);

    const columns = statsWindow.locator(".game-stats-minesweeper-columns > *");
    await expect(columns).toHaveCount(3);
    const columnBounds = await columns.evaluateAll((elements) => elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, width: bounds.width };
    }));
    columnBounds.forEach((bounds, index) => {
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.top).toBeCloseTo(columnBounds[0].top, 0);
      if (index) expect(columnBounds[index - 1].right).toBeLessThanOrEqual(bounds.left);
    });

    const publishedScreenshotPath = testInfo.outputPath(
      `minesweeper-published-stats-${viewport.width}x${viewport.height}.png`
    );
    await page.screenshot({ fullPage: true, path: publishedScreenshotPath });
    await testInfo.attach(`minesweeper-published-stats-${viewport.name}`, {
      contentType: "image/png",
      path: publishedScreenshotPath,
    });
    const semanticSnapshotPath = testInfo.outputPath(
      `minesweeper-published-semantics-${viewport.width}x${viewport.height}.yml`
    );
    await writeFile(semanticSnapshotPath, await page.locator("body").ariaSnapshot());
    await testInfo.attach(`minesweeper-published-semantics-${viewport.name}`, {
      contentType: "text/yaml",
      path: semanticSnapshotPath,
    });

    await statsWindow.getByRole("button", { name: "Close" }).click();
    await minesweeper.locator("#ms-reset").click();
    const resetBoard = await page.evaluate(() => window.__minesweeperPublishFlow.readBoard());
    expect(resetBoard.gameOver).toBe(false);
    expect(resetBoard.started).toBe(false);
    expect(api.events).toHaveLength(1);

    await minesweeper.getByRole("combobox", { name: "Control mode" }).selectOption("mobile");
    await minesweeper.locator("#ms-flag-mode").click();
    await minesweeper.locator('.ms-cell[data-index="0"]').click();
    await expect(minesweeper.locator('.ms-cell[data-index="0"]')).toHaveClass(/is-flagged/);
    await minesweeper.locator("#ms-question-mode").click();
    await minesweeper.locator('.ms-cell[data-index="0"]').click();
    await expect(minesweeper.locator('.ms-cell[data-index="0"]')).toHaveClass(/is-question/);

    expect(api.events).toHaveLength(1);
    await expect(minesweeper.locator("#ms-lose-banner")).not.toHaveClass(/is-visible/);
    await expect(minesweeper.locator("#ms-lose-banner")).toHaveCSS("opacity", "0");
    await expect(minesweeper.locator("#ms-reset")).toHaveAttribute("data-face", "smile");

    await settleRender(page);
    const layout = await minesweeper.evaluate((windowElement) => {
      const bounds = windowElement.getBoundingClientRect();
      return {
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        left: bounds.left,
        right: bounds.right,
        viewportWidth: window.innerWidth,
      };
    });
    expect(layout.documentOverflows).toBe(false);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);

    const screenshotPath = testInfo.outputPath(
      `minesweeper-rule-paths-${viewport.width}x${viewport.height}.png`
    );
    await page.screenshot({ fullPage: true, path: screenshotPath });
    await testInfo.attach(`minesweeper-rule-paths-${viewport.name}`, {
      contentType: "image/png",
      path: screenshotPath,
    });
    const ruleSemanticsPath = testInfo.outputPath(
      `minesweeper-rule-semantics-${viewport.width}x${viewport.height}.yml`
    );
    await writeFile(ruleSemanticsPath, await page.locator("body").ariaSnapshot());
    await testInfo.attach(`minesweeper-rule-semantics-${viewport.name}`, {
      contentType: "text/yaml",
      path: ruleSemanticsPath,
    });
  });
}
