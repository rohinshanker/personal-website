import { expect, test } from "./fixtures.mjs";
import { readFile } from "node:fs/promises";

const API_BASE_URL = "https://game-progress-overall-totals.test";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const PROFILE = Object.freeze({
  id: "player-overall-progress",
  name: "Overall Progress",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});
const VIEWPORTS = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const generatedBackendSource = await readFile(
  new URL("../../scripts/home/game-stats-backend.js", import.meta.url),
  "utf8"
);

const installBackend = async (page) => {
  const source = generatedBackendSource.replace(
    /apiBaseUrl:\s*"[^"]*"/,
    `apiBaseUrl: ${JSON.stringify(API_BASE_URL)}`
  );
  await page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({ contentType: "application/javascript", body: source })
  );
};

const installStatsApi = async (page) => {
  const requests = [];
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}${url.search}`);
    if (request.method() === "GET" && url.pathname === "/stats") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          totals: {},
          playerTotals: {
            minesweeper: { wins: { beginner: 7, intermediate: 3, expert: 2 } },
            solitaire: { wins: 11 },
            snake: {
              totalGamesPlayed: 15,
              gamesPlayed: { "10": 4, "16": 5, "20": 3, "24": 3 },
            },
            sudoku: {
              wins: {
                easy: { noHints: 6, withHints: 2 },
                medium: { noHints: 5, withHints: 1 },
                hard: { noHints: 4, withHints: 3 },
                expert: { noHints: 3, withHints: 2 },
                master: { noHints: 2, withHints: 1 },
                extreme: { noHints: 1, withHints: 1 },
              },
            },
          },
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
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: "Unexpected test route" }),
    });
  });
  return requests;
};

const readStat = (window, contentId, label) =>
  window
    .locator(`${contentId} .game-stats-inlay`)
    .filter({ hasText: label })
    .locator(".game-stats-value");

const createStatsPayload = (solitaireWins) => ({
  generatedAt: new Date().toISOString(),
  totals: {},
  playerTotals: {
    minesweeper: { wins: { beginner: 0, intermediate: 0, expert: 0 } },
    solitaire: { wins: solitaireWins },
    snake: {
      totalGamesPlayed: 0,
      gamesPlayed: { "10": 0, "16": 0, "20": 0, "24": 0 },
    },
    sudoku: { wins: {} },
  },
  leaderboards: {},
  playerRanks: {},
  playerRecords: {},
});

for (const viewport of VIEWPORTS) {
  test(`Game Progress shows lifetime totals and refreshes on open at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ profile, profileKey, statsKey }) => {
        Math.random = () => 0.999999;
        localStorage.setItem(profileKey, JSON.stringify(profile));
        localStorage.removeItem(statsKey);
      },
      { profile: PROFILE, profileKey: PROFILE_STORAGE_KEY, statsKey: GAME_STATS_STORAGE_KEY }
    );
    await installBackend(page);
    const requests = await installStatsApi(page);
    await page.goto("/home.html");
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    const initialRequestCount = requests.length;

    await page.locator('.taskbar-icon[data-app="game-progress"]').click();
    const app = page.locator("#game-progress-window");
    await expect(app).toBeVisible();
    await expect.poll(() => requests.length).toBeGreaterThan(initialRequestCount);
    expect(requests.every((request) => request === `GET /stats?playerId=${PROFILE.id}`)).toBe(
      true
    );

    const states = [
      {
        tab: "game-progress-minesweeper",
        assertions: [
          ["#game-progress-minesweeper-content", "Beginner wins", "7"],
          ["#game-progress-minesweeper-content", "Expert wins", "2"],
        ],
      },
      {
        tab: "game-progress-solitaire",
        assertions: [["#game-progress-solitaire-content", "Wins", "11"]],
      },
      {
        tab: "game-progress-snake",
        assertions: [
          ["#game-progress-snake-content", "Games played", "15"],
          ["#game-progress-snake-content", "16×16 games", "5"],
        ],
      },
      {
        tab: "game-progress-sudoku",
        assertions: [
          ["#game-progress-sudoku-content", "Easy (no hints)", "6 Wins"],
          ["#game-progress-sudoku-content", "Extreme (hints)", "1 Wins"],
        ],
      },
    ];

    for (const state of states) {
      await app.locator(`.selector-item[data-view="${state.tab}"]`).click();
      for (const [contentId, label, value] of state.assertions) {
        await expect(readStat(app, contentId, label)).toHaveText(value);
      }
      const layout = await app.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const body = element.querySelector(".window-body");
        return {
          bodyOverflows: body.scrollWidth > body.clientWidth,
          bottom: bounds.bottom,
          documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
        };
      });
      expect(layout.bodyOverflows).toBe(false);
      expect(layout.documentOverflows).toBe(false);
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.top).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight);
      await page.screenshot({
        path: testInfo.outputPath(`${state.tab}-${viewport.width}x${viewport.height}.png`),
        fullPage: true,
      });
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}

test("Game Progress retains confirmed totals through a failed refresh and later converges", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ profile, profileKey, statsKey }) => {
      localStorage.setItem(profileKey, JSON.stringify(profile));
      localStorage.removeItem(statsKey);
    },
    { profile: PROFILE, profileKey: PROFILE_STORAGE_KEY, statsKey: GAME_STATS_STORAGE_KEY }
  );
  await installBackend(page);

  let requestCount = 0;
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" || url.pathname !== "/stats") {
      await route.fulfill({ status: 404, body: "Not found" });
      return;
    }
    requestCount += 1;
    if (requestCount === 2) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Temporary outage" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createStatsPayload(requestCount >= 3 ? 12 : 11)),
    });
  });

  await page.goto("/home.html");
  await expect.poll(() => requestCount).toBe(1);

  const launcher = page.locator('.taskbar-icon[data-app="game-progress"]');
  const app = page.locator("#game-progress-window");
  await launcher.click();
  await expect.poll(() => requestCount).toBe(2);
  await app.locator('.selector-item[data-view="game-progress-solitaire"]').click();
  await expect(readStat(app, "#game-progress-solitaire-content", "Wins")).toHaveText("11");

  await app.locator('[data-close="game-progress"]').click();
  await expect(app).toBeHidden();
  await launcher.click();
  await expect.poll(() => requestCount).toBe(3);
  await app.locator('.selector-item[data-view="game-progress-solitaire"]').click();
  await expect(readStat(app, "#game-progress-solitaire-content", "Wins")).toHaveText("12");
});
