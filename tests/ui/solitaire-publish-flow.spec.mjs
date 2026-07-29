import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const API_BASE_URL = "https://game-stats-solitaire-publish.test";
const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const GAME_STATS_SYNC_QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const profile = Object.freeze({
  id: "player-solitaire-publish",
  name: "Solitaire Publisher",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

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
    throw new Error("Unable to install the Solitaire publish backend config.");
  }
  await page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: mockedBackendSource,
    })
  );
};

const installMainBridge = async (page) => {
  const mainSource = await readFile(
    new URL("../../scripts/home/main.js", import.meta.url),
    "utf8"
  );
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__solitairePublishFlowTest = Object.freeze({
  triggerWin: async () => {
    await syncQueuedGameStats();
    if (!solState.statsSession) {
      throw new Error("Solitaire gameplay did not start a verified stats session.");
    }
    solState.moves = 80;
    solState.won = false;
    solState.foundations = Object.fromEntries(
      solSuitOrder.map((suit) => [suit, Array.from({ length: 13 }, () => ({}))])
    );
    solCheckWin();
  },
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the Solitaire publish test bridge.");
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
  metricKind: "wins",
  occurredAt,
});

const installApi = async (page) => {
  const sessionRequests = [];
  const eventRequests = [];
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
      sessionRequests.push(JSON.parse(request.postData() || "{}"));
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          id: "session-solitaire-publish-0001",
          token: "session-solitaire-publish-token",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
      });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/events") {
      const body = JSON.parse(request.postData() || "{}");
      eventRequests.push(body);
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
      const currentPlayerEntry = refreshed
        ? createLeaderboardEntry({
            eventId: publishedEvent.id,
            playerId: profile.id,
            name: profile.name,
            metric: 1,
            occurredAt: publishedEvent.occurredAt,
          })
        : null;
      const leaderboards = [
        createLeaderboardEntry({
          eventId: "solitaire-global-aria-0001",
          playerId: "player-solitaire-aria",
          name: "Aria",
          metric: 2,
          occurredAt: "2026-07-01T00:00:00.000Z",
        }),
        ...(currentPlayerEntry ? [currentPlayerEntry] : []),
        createLeaderboardEntry({
          eventId: "solitaire-global-nia-0001",
          playerId: "player-solitaire-nia",
          name: "Nia",
          metric: 0,
          occurredAt: "2026-07-03T00:00:00.000Z",
        }),
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          generatedAt: new Date().toISOString(),
          totals: { solitaire: { wins: refreshed ? 3 : 2 } },
          leaderboards: { solitaire: leaderboards },
          playerRanks: {
            solitaire: refreshed
              ? { rank: 2, totalPlayers: 3 }
              : { rank: null, totalPlayers: 2 },
          },
          playerRecords: { solitaire: currentPlayerEntry },
        }),
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

test("a verified Solitaire win publishes and refreshes the global leaderboard", async ({
  page,
}, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ profileKey, queueKey, savedProfile, statsKey }) => {
      Math.random = () => 0.999999;
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
      localStorage.removeItem(queueKey);
      localStorage.removeItem(statsKey);
    },
    {
      profileKey: PROFILE_STORAGE_KEY,
      queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      savedProfile: profile,
      statsKey: GAME_STATS_STORAGE_KEY,
    }
  );
  await installBackendConfig(page);
  await installMainBridge(page);
  const api = await installApi(page);

  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page.locator('.desktop-icon[data-app="solitaire"]').click();
  const solitaireWindow = page.locator('[data-app-window="solitaire"]');
  await expect(solitaireWindow).toBeVisible();
  expect(api.sessionRequests).toEqual([]);
  expect(api.eventRequests).toEqual([]);

  await solitaireWindow.locator("#sol-stock").click();
  await expect.poll(() => api.sessionRequests.length).toBe(1);
  expect(api.eventRequests).toEqual([]);

  await page.evaluate(() => window.__solitairePublishFlowTest.triggerWin());
  await expect.poll(() => api.eventRequests.length).toBe(1);

  await page
    .locator('[data-app-window="solitaire"] [data-game-stats-open="solitaire"]')
    .click();

  const statsWindow = page.locator("#game-stats-window-solitaire");
  const leaderboard = statsWindow.locator(".game-stats-solitaire-column");
  const globalRows = leaderboard.locator(
    ".game-stats-solitaire-row:not(.game-stats-solitaire-local-wins-row)"
  );
  const currentRecord = leaderboard.locator(".game-stats-solitaire-local-wins-row");
  await expect(statsWindow).toBeVisible();
  await expect(statsWindow.locator("[data-game-stats-sync-status]")).toHaveText(
    "Global stats are up to date."
  );
  await expect(leaderboard.getByText("Global Top 3", { exact: true })).toBeVisible();
  await expect(globalRows).toHaveCount(3);
  await expect(globalRows.nth(0)).toHaveAttribute("aria-label", "Rank 1: Aria, 2 wins");
  await expect(globalRows.nth(1)).toHaveAttribute(
    "aria-label",
    "Rank 2: Solitaire Publisher, 1 win, your entry"
  );
  await expect(globalRows.nth(2)).toHaveAttribute("aria-label", "Rank 3: Nia, 0 wins");
  await expect(currentRecord).toHaveAttribute(
    "aria-label",
    "Your Solitaire record: #2, Solitaire Publisher, 1 win"
  );
  await expect(
    leaderboard.locator('.game-stats-solitaire-global-wins [aria-label="Global wins: 3"]')
  ).toBeVisible();

  expect(generatedBuildVersion).toMatch(/^sha256-[a-f0-9]{64}$/);
  expect(api.sessionRequests).toEqual([
    { game: "solitaire", config: {}, buildVersion: generatedBuildVersion },
  ]);
  expect(api.eventRequests).toHaveLength(1);
  expect(api.eventRequests[0].event).toMatchObject({
    game: "solitaire",
    type: "win",
    metric: 80,
    metricKind: "moves",
    profile: {
      id: profile.id,
      name: profile.name,
      icon: profile.icon,
    },
  });
  expect(api.eventRequests[0].session).toEqual({
    id: "session-solitaire-publish-0001",
    token: "session-solitaire-publish-token",
  });
  expect(api.statsRequests.some(({ refreshed }) => !refreshed)).toBe(true);
  expect(api.statsRequests.some(({ refreshed }) => refreshed)).toBe(true);
  expect(api.statsRequests.every(({ path }) => path === `/stats?playerId=${profile.id}`)).toBe(
    true
  );

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

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("desktop-solitaire-publish-success.png"),
  });
  expect(runtimeErrors.consoleErrors).toEqual([]);
  expect(runtimeErrors.pageErrors).toEqual([]);
});
