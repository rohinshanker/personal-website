import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";

const API_BASE_URL = "https://game-stats-solitaire-publish.test";
const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const GAME_STATS_SYNC_QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const ADMINISTRATOR_PROOF_STORAGE_KEY = "personalSiteAdministratorProofV1";
const FELIZ_JUEVES_SHOWN_KEY = "personalSiteFelizJuevesShownDate";
const profile = Object.freeze({
  id: "player-solitaire-publish",
  name: "Solitaire Publisher",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});
const administratorProfile = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
  rerollCount: 0,
});
const administratorProof = `${"d".repeat(32)}.${"e".repeat(32)}`;
const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);
const victoryViewports = Object.freeze([
  viewports[0],
  { name: "compact-breakpoint", width: 640, height: 900 },
  { name: "expanded-breakpoint", width: 641, height: 900 },
  ...viewports.slice(1),
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
  const mainSource = await readIsolatedMainSource();
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
      const currentPlayerEntry = createLeaderboardEntry({
        eventId: refreshed ? publishedEvent.id : "solitaire-player-history-0001",
        playerId: profile.id,
        name: profile.name,
        metric: refreshed ? 5 : 4,
        occurredAt: refreshed
          ? publishedEvent.occurredAt
          : "2026-06-30T00:00:00.000Z",
      });
      const leaderboards = [
        createLeaderboardEntry({
          eventId: "solitaire-global-aria-0001",
          playerId: "player-solitaire-aria",
          name: "Aria",
          metric: 2,
          occurredAt: "2026-07-01T00:00:00.000Z",
        }),
        currentPlayerEntry,
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
          eventIds: refreshed ? [publishedEvent.id] : [],
          totals: { solitaire: { wins: refreshed ? 7 : 6 } },
          playerTotals: { solitaire: { wins: refreshed ? 5 : 4 } },
          leaderboards: { solitaire: leaderboards },
          playerRanks: {
            solitaire: { rank: 1, totalPlayers: 3 },
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

const installAdministratorReauthenticationApi = async (page) => {
  const eventRequests = [];
  const sessionRequests = [];
  const signInRequests = [];
  const corsHeaders = {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
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
          id: "session-solitaire-administrator-0001",
          token: "session-solitaire-administrator-token",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
      });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/events") {
      const eventRequest = {
        authorization: request.headers().authorization || "",
        body: JSON.parse(request.postData() || "{}"),
      };
      eventRequests.push(eventRequest);
      const authorized = eventRequest.authorization === `Bearer ${administratorProof}`;
      await route.fulfill({
        status: authorized ? 201 : 403,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify(
          authorized
            ? { ok: true, applied: true }
            : { ok: false, error: "Administrator proof required" }
        ),
      });
      return;
    }

    if (
      request.method() === "POST" &&
      url.pathname === "/administrator/sign-in"
    ) {
      signInRequests.push(JSON.parse(request.postData() || "{}"));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          profile: administratorProfile,
          proof: administratorProof,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/stats") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
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
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Unexpected test route" }),
    });
  });

  return { eventRequests, sessionRequests, signInRequests };
};

const installAdministratorStaleStatsApi = async (page) => {
  const eventRequests = [];
  const sessionRequests = [];
  const statsRequests = [];
  const historicalAdministratorEventId = "solitaire-administrator-history-0001";
  let authoritativeStats = false;
  let publishedEvent = null;
  const corsHeaders = {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  };

  const createStats = () => {
    const includesPublishedEvent = authoritativeStats && Boolean(publishedEvent);
    const administratorWins = includesPublishedEvent ? 2 : 1;
    const administratorEntry = createLeaderboardEntry({
      eventId: includesPublishedEvent
        ? publishedEvent.id
        : historicalAdministratorEventId,
      playerId: administratorProfile.id,
      name: administratorProfile.name,
      icon: administratorProfile.icon,
      metric: administratorWins,
      occurredAt: includesPublishedEvent
        ? publishedEvent.occurredAt
        : "2026-07-01T00:00:00.000Z",
    });
    const eventIds = [
      "solitaire-global-aria-history-0001",
      historicalAdministratorEventId,
      ...(includesPublishedEvent ? [publishedEvent.id] : []),
    ];
    return {
      generatedAt: new Date().toISOString(),
      eventIds,
      totals: { solitaire: { wins: includesPublishedEvent ? 3 : 2 } },
      playerTotals: { solitaire: { wins: administratorWins } },
      leaderboards: {
        solitaire: [
          createLeaderboardEntry({
            eventId: "solitaire-global-aria-history-0001",
            playerId: "player-solitaire-aria",
            name: "Aria",
            metric: 1,
            occurredAt: "2026-06-30T00:00:00.000Z",
          }),
          administratorEntry,
        ],
      },
      playerRanks: {
        solitaire: { rank: includesPublishedEvent ? 1 : 2, totalPlayers: 2 },
      },
      playerRecords: { solitaire: administratorEntry },
    };
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
          id: "session-solitaire-administrator-stale-0001",
          token: "session-solitaire-administrator-stale-token",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
      });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/events") {
      const body = JSON.parse(request.postData() || "{}");
      const eventRequest = {
        authorization: request.headers().authorization || "",
        body,
      };
      eventRequests.push(eventRequest);
      publishedEvent = body.event;
      const authorized = eventRequest.authorization === `Bearer ${administratorProof}`;
      await route.fulfill({
        status: authorized ? 201 : 403,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify(
          authorized
            ? { ok: true, applied: true, eventId: publishedEvent.id }
            : { ok: false, error: "Administrator proof required" }
        ),
      });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/stats") {
      const stats = createStats();
      statsRequests.push({
        authoritative: authoritativeStats,
        eventIds: [...stats.eventIds],
        path: url.pathname + url.search,
        published: Boolean(publishedEvent),
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify(stats),
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
    sessionRequests,
    statsRequests,
    useAuthoritativeStats: () => {
      authoritativeStats = true;
    },
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
  await expect.poll(() => api.statsRequests.length).toBeGreaterThan(0);
  await page.locator('.taskbar-icon[data-app="game-progress"]').click();
  const gameProgressWindow = page.locator("#game-progress-window");
  await gameProgressWindow
    .locator('.selector-item[data-view="game-progress-solitaire"]')
    .click();
  await expect(
    gameProgressWindow
      .locator("#game-progress-solitaire-content .game-stats-inlay")
      .filter({ hasText: "Wins" })
      .locator(".game-stats-value")
  ).toHaveText("4");
  await gameProgressWindow.locator('[data-close="game-progress"]').click();
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
  await expect
    .poll(() => api.statsRequests.filter(({ refreshed }) => refreshed).length)
    .toBeGreaterThan(0);

  await page.locator('.taskbar-icon[data-app="game-progress"]').click();
  await gameProgressWindow
    .locator('.selector-item[data-view="game-progress-solitaire"]')
    .click();
  await expect(
    gameProgressWindow
      .locator("#game-progress-solitaire-content .game-stats-inlay")
      .filter({ hasText: "Wins" })
      .locator(".game-stats-value")
  ).toHaveText("5");
  await gameProgressWindow.locator('[data-close="game-progress"]').click();

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
  await expect(globalRows.nth(0)).toHaveAttribute(
    "aria-label",
    "Rank 1: Solitaire Publisher, 5 wins, your entry"
  );
  await expect(globalRows.nth(1)).toHaveAttribute("aria-label", "Rank 2: Aria, 2 wins");
  await expect(globalRows.nth(2)).toHaveAttribute("aria-label", "Rank 3: Nia, 0 wins");
  await expect(currentRecord).toHaveAttribute(
    "aria-label",
    "Your Solitaire record: #1, Solitaire Publisher, 5 wins"
  );
  await expect(
    leaderboard.locator('.game-stats-solitaire-global-wins [aria-label="Global wins: 7"]')
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

  await page.reload();
  await page.locator('.taskbar-icon[data-app="game-progress"]').click();
  await gameProgressWindow
    .locator('.selector-item[data-view="game-progress-solitaire"]')
    .click();
  await expect(
    gameProgressWindow
      .locator("#game-progress-solitaire-content .game-stats-inlay")
      .filter({ hasText: "Wins" })
      .locator(".game-stats-value")
  ).toHaveText("5");

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

test("an active Administrator win stays advanced through stale stats and exact-event reconciliation", async ({
  page,
}, testInfo) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ profileKey, proof, proofKey, queueKey, savedProfile, statsKey }) => {
      Math.random = () => 0.999999;
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
      localStorage.removeItem(queueKey);
      localStorage.removeItem(statsKey);
      sessionStorage.setItem(
        proofKey,
        JSON.stringify({
          proof,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
      );
    },
    {
      profileKey: PROFILE_STORAGE_KEY,
      proof: administratorProof,
      proofKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
      queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      savedProfile: administratorProfile,
      statsKey: GAME_STATS_STORAGE_KEY,
    }
  );
  await installBackendConfig(page);
  await installMainBridge(page);
  const api = await installAdministratorStaleStatsApi(page);

  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await expect.poll(() => api.statsRequests.length).toBeGreaterThan(0);

  const gameProgressWindow = page.locator("#game-progress-window");
  await page.locator('.taskbar-icon[data-app="game-progress"]').click();
  await gameProgressWindow
    .locator('.selector-item[data-view="game-progress-solitaire"]')
    .click();

  const solitaireWindow = page.locator('[data-app-window="solitaire"]');
  await page.locator('.desktop-icon[data-app="solitaire"]').click();
  await expect(solitaireWindow).toBeVisible();
  await solitaireWindow.locator('[data-game-stats-open="solitaire"]').click();

  const statsWindow = page.locator("#game-stats-window-solitaire");
  const leaderboard = statsWindow.locator(".game-stats-solitaire-column");
  const globalRows = leaderboard.locator(
    ".game-stats-solitaire-row:not(.game-stats-solitaire-local-wins-row)"
  );
  const administratorLeaderboardRow = globalRows.filter({
    hasText: administratorProfile.name,
  });
  const currentRecord = leaderboard.locator(".game-stats-solitaire-local-wins-row");
  const progressWins = gameProgressWindow
    .locator("#game-progress-solitaire-content .game-stats-inlay")
    .filter({ hasText: "Wins" })
    .locator(".game-stats-value");
  const refreshButton = statsWindow.locator('[data-game-stats-refresh="solitaire"]');

  await expect(gameProgressWindow).toBeVisible();
  await expect(statsWindow).toBeVisible();
  await expect(progressWins).toHaveText("1");
  await expect(currentRecord).toHaveAttribute(
    "aria-label",
    "Your Solitaire record: #2, rohin ^.^, 1 win"
  );
  await expect(administratorLeaderboardRow).toHaveAttribute(
    "aria-label",
    "Rank 2: rohin ^.^, 1 win, your entry"
  );
  await expect(
    leaderboard.locator('.game-stats-solitaire-global-wins [aria-label="Global wins: 2"]')
  ).toBeVisible();

  await solitaireWindow.locator("#sol-stock").evaluate((stock) => stock.click());
  await expect.poll(() => api.sessionRequests.length).toBe(1);
  await page.evaluate(() => window.__solitairePublishFlowTest.triggerWin());
  await expect.poll(() => api.eventRequests.length).toBe(1);
  await expect
    .poll(
      () =>
        api.statsRequests.filter(
          ({ authoritative, published }) => published && !authoritative
        ).length
    )
    .toBeGreaterThan(0);

  const publishedEvent = api.eventRequests[0].body.event;
  expect(api.eventRequests[0].authorization).toBe(`Bearer ${administratorProof}`);
  expect(publishedEvent).toMatchObject({
    game: "solitaire",
    type: "win",
    metric: 80,
    metricKind: "moves",
    profile: {
      id: administratorProfile.id,
      name: administratorProfile.name,
      icon: administratorProfile.icon,
    },
  });
  expect(api.statsRequests.some(({ eventIds }) => eventIds.includes(publishedEvent.id))).toBe(
    false
  );

  await expect(progressWins).toHaveText("2");
  await expect(currentRecord).toHaveAttribute(
    "aria-label",
    "Your Solitaire record: #1, rohin ^.^, 2 wins"
  );
  await expect(administratorLeaderboardRow).toHaveAttribute(
    "aria-label",
    "Rank 1: rohin ^.^, 2 wins, your entry"
  );
  await expect(
    leaderboard.locator('.game-stats-solitaire-global-wins [aria-label="Global wins: 3"]')
  ).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("administrator-win-stale-stats.png"),
  });

  api.useAuthoritativeStats();
  await expect(refreshButton).toBeEnabled();
  await refreshButton.click();
  await expect
    .poll(
      () =>
        api.statsRequests.filter(
          ({ authoritative, eventIds }) =>
            authoritative && eventIds.includes(publishedEvent.id)
        ).length
    )
    .toBeGreaterThan(0);

  await expect(progressWins).toHaveText("2");
  await expect(currentRecord).toHaveAttribute(
    "aria-label",
    "Your Solitaire record: #1, rohin ^.^, 2 wins"
  );
  await expect(administratorLeaderboardRow).toHaveAttribute(
    "aria-label",
    "Rank 1: rohin ^.^, 2 wins, your entry"
  );
  await expect(
    leaderboard.locator('.game-stats-solitaire-global-wins [aria-label="Global wins: 3"]')
  ).toBeVisible();
  expect(api.eventRequests).toHaveLength(1);
  expect(api.sessionRequests).toEqual([
    { game: "solitaire", config: {}, buildVersion: generatedBuildVersion },
  ]);
  expect(
    api.statsRequests.every(
      ({ path }) => path === `/stats?playerId=${administratorProfile.id}`
    )
  ).toBe(true);

  const stored = await page.evaluate(
    ({ proofKey, queueKey }) => ({
      proof: JSON.parse(sessionStorage.getItem(proofKey) || "null"),
      queue: JSON.parse(localStorage.getItem(queueKey) || "[]"),
    }),
    {
      proofKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
      queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
    }
  );
  expect(stored.proof.proof).toBe(administratorProof);
  expect(stored.queue).toEqual([]);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("administrator-win-authoritative-stats.png"),
  });
  expect(runtimeErrors.consoleErrors).toEqual([]);
  expect(runtimeErrors.pageErrors).toEqual([]);
});

for (const viewport of victoryViewports) {
  test(`Victory Royale animation is 40% smaller at the board top at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ felizJuevesKey, profileKey, queueKey, savedProfile, statsKey }) => {
        Math.random = () => 0.999999;
        localStorage.clear();
        sessionStorage.clear();
        const now = new Date();
        const localDateKey = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
        localStorage.setItem(felizJuevesKey, localDateKey);
        localStorage.setItem(profileKey, JSON.stringify(savedProfile));
        localStorage.removeItem(queueKey);
        localStorage.removeItem(statsKey);
      },
      {
        felizJuevesKey: FELIZ_JUEVES_SHOWN_KEY,
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
    const board = page.locator("#sol-board");
    const overlay = page.locator("#sol-victory-video-overlay");
    const canvas = page.locator("#sol-victory-canvas");
    const video = page.locator("#sol-victory-video");
    await expect(solitaireWindow).toBeVisible();
    const boardScrollWidthBefore = await board.evaluate(
      (element) => element.scrollWidth
    );

    await solitaireWindow.locator("#sol-stock").click();
    await expect.poll(() => api.sessionRequests.length).toBe(1);
    await page.evaluate(() => window.__solitairePublishFlowTest.triggerWin());
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute("aria-hidden", "false");
    await expect
      .poll(() => video.evaluate((element) => element.readyState))
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(() => canvas.evaluate((element) => element.width))
      .toBeGreaterThan(0);
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(500);

    const geometry = await page.evaluate(() => {
      const boardElement = document.querySelector("#sol-board");
      const overlayElement = document.querySelector("#sol-victory-video-overlay");
      const canvasElement = document.querySelector("#sol-victory-canvas");
      const boardBounds = boardElement.getBoundingClientRect();
      const overlayBounds = overlayElement.getBoundingClientRect();
      const canvasBounds = canvasElement.getBoundingClientRect();
      return {
        board: {
          bottom: boardBounds.bottom,
          centerX: boardBounds.left + boardBounds.width / 2,
          height: boardBounds.height,
          left: boardBounds.left,
          right: boardBounds.right,
          top: boardBounds.top,
          width: boardBounds.width,
        },
        canvas: {
          bottom: canvasBounds.bottom,
          centerX: canvasBounds.left + canvasBounds.width / 2,
          left: canvasBounds.left,
          right: canvasBounds.right,
          top: canvasBounds.top,
          width: canvasBounds.width,
        },
        documentOverflows:
          document.documentElement.scrollWidth > window.innerWidth,
        focusableOverlayChildren: overlayElement.querySelectorAll(
          "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
        ).length,
        overlay: {
          height: overlayBounds.height,
          left: overlayBounds.left,
          pointerEvents: getComputedStyle(overlayElement).pointerEvents,
          top: overlayBounds.top,
          width: overlayBounds.width,
        },
      };
    });
    const expectedWidth = Math.min(234, viewport.width * 0.288);
    expect(Math.abs(geometry.canvas.width - expectedWidth)).toBeLessThanOrEqual(
      1
    );
    expect(
      Math.abs(geometry.canvas.centerX - geometry.board.centerX)
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(geometry.canvas.top - geometry.board.top - 16)
    ).toBeLessThanOrEqual(1);
    expect(geometry.canvas.left).toBeGreaterThanOrEqual(geometry.board.left);
    expect(geometry.canvas.right).toBeLessThanOrEqual(geometry.board.right);
    expect(geometry.canvas.bottom).toBeLessThanOrEqual(geometry.board.bottom);
    expect(
      Math.abs(geometry.overlay.left - geometry.board.left)
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(geometry.overlay.top - geometry.board.top)
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(geometry.overlay.width - geometry.board.width)
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(geometry.overlay.height - geometry.board.height)
    ).toBeLessThanOrEqual(1);
    expect(geometry.overlay.pointerEvents).toBe("none");
    expect(geometry.focusableOverlayChildren).toBe(0);
    expect(geometry.documentOverflows).toBe(false);
    expect(await board.evaluate((element) => element.scrollWidth)).toBe(
      boardScrollWidthBefore
    );

    if (viewport.name === "desktop") {
      await canvas.evaluate((element) => element.classList.add("is-hidden"));
      await video.evaluate((element) =>
        element.classList.add("is-visible-fallback")
      );
      const fallback = await video.evaluate((element) => {
        const boardBounds = document
          .querySelector("#sol-board")
          .getBoundingClientRect();
        const bounds = element.getBoundingClientRect();
        return {
          centerDelta:
            bounds.left + bounds.width / 2 -
            (boardBounds.left + boardBounds.width / 2),
          topGap: bounds.top - boardBounds.top,
          width: bounds.width,
        };
      });
      expect(Math.abs(fallback.width - expectedWidth)).toBeLessThanOrEqual(1);
      expect(Math.abs(fallback.centerDelta)).toBeLessThanOrEqual(1);
      expect(Math.abs(fallback.topGap - 16)).toBeLessThanOrEqual(1);
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath("victory-royale-desktop-fallback.png"),
      });
      await video.evaluate((element) =>
        element.classList.remove("is-visible-fallback")
      );
      await canvas.evaluate((element) => element.classList.remove("is-hidden"));
    }

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`victory-royale-${viewport.name}.png`),
    });
    await solitaireWindow.locator("#sol-reset").click();
    await expect(overlay).toBeHidden();
    await expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(runtimeErrors.consoleErrors).toEqual([]);
    expect(runtimeErrors.pageErrors).toEqual([]);
  });
}

for (const viewport of viewports) {
  test(`an expired Administrator session opens sign-in after a completed Solitaire game at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ expiredProof, profileKey, proofKey, queueKey, savedProfile, statsKey }) => {
        Math.random = () => 0.999999;
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem(profileKey, JSON.stringify(savedProfile));
        localStorage.removeItem(queueKey);
        localStorage.removeItem(statsKey);
        sessionStorage.setItem(proofKey, JSON.stringify(expiredProof));
      },
      {
        expiredProof: {
          proof: `${"a".repeat(32)}.${"b".repeat(32)}`,
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
        profileKey: PROFILE_STORAGE_KEY,
        proofKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
        queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
        savedProfile: administratorProfile,
        statsKey: GAME_STATS_STORAGE_KEY,
      }
    );
    await installBackendConfig(page);
    await installMainBridge(page);
    const api = await installAdministratorReauthenticationApi(page);

    await page.goto("/home.html");
    const aboutClose = page.locator('#about-window [data-close="about"]');
    if (await aboutClose.isVisible()) await aboutClose.click();
    await page.locator('.desktop-icon[data-app="solitaire"]').click();
    const solitaireWindow = page.locator('[data-app-window="solitaire"]');
    await expect(solitaireWindow).toBeVisible();
    await expect(solitaireWindow).not.toHaveClass(/is-opening/);
    await solitaireWindow.locator("#sol-stock").click();
    await expect.poll(() => api.sessionRequests.length).toBe(1);

    await page.evaluate(() => window.__solitairePublishFlowTest.triggerWin());
    await expect.poll(() => api.eventRequests.length).toBe(1);
    expect(api.eventRequests[0].authorization).toBe("");

    const administratorWindow = page.locator("#administrator-window");
    await expect(administratorWindow).toBeVisible();
    await expect(administratorWindow).not.toHaveClass(/is-opening/);
    await expect(administratorWindow).toHaveCSS("z-index", "999999");
    await expect(page.locator(".window-stack")).toHaveCSS("z-index", "999999");
    await expect(page.locator("#administrator-username")).toBeFocused();
    const administratorBounds = await administratorWindow.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });
    expect(administratorBounds.left).toBeGreaterThanOrEqual(0);
    expect(administratorBounds.top).toBeGreaterThanOrEqual(0);
    expect(administratorBounds.right).toBeLessThanOrEqual(
      administratorBounds.viewportWidth
    );
    expect(administratorBounds.bottom).toBeLessThanOrEqual(
      administratorBounds.viewportHeight
    );
    const pendingState = await page.evaluate(
      ({ proofKey, queueKey }) => ({
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        proof: sessionStorage.getItem(proofKey),
        queue: JSON.parse(localStorage.getItem(queueKey) || "[]"),
      }),
      {
        proofKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
        queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      }
    );
    expect(pendingState.documentOverflows).toBe(false);
    expect(pendingState.proof).toBeNull();
    expect(pendingState.queue).toHaveLength(1);
    await page.screenshot({
      path: testInfo.outputPath(
        `administrator-reauth-after-solitaire-${viewport.name}.png`
      ),
      fullPage: true,
    });

    await page.locator("#administrator-username").fill("test-only-administrator");
    await page.locator("#administrator-password").fill("test-only-password");
    await page.locator("#administrator-sign-in").click();
    await expect(page.locator("#administrator-alert-window")).toBeVisible();
    await expect(page.locator("#administrator-alert-window")).toHaveCSS(
      "z-index",
      "1000000"
    );
    await expect
      .poll(
        () =>
          api.eventRequests.filter(
            ({ authorization }) => authorization === `Bearer ${administratorProof}`
          ).length
      )
      .toBe(1);
    expect(api.signInRequests).toEqual([
      { username: "test-only-administrator", password: "test-only-password" },
    ]);
    await expect
      .poll(() =>
        page.evaluate(
          (queueKey) => JSON.parse(localStorage.getItem(queueKey) || "[]"),
          GAME_STATS_SYNC_QUEUE_STORAGE_KEY
        )
      )
      .toEqual([]);
    await expect
      .poll(() =>
        page.evaluate(
          (statsKey) =>
            JSON.parse(localStorage.getItem(statsKey) || "null")?.totals?.solitaire
              ?.wins,
          GAME_STATS_STORAGE_KEY
        )
      )
      .toBe(1);
    await page.locator("#administrator-alert-close").click();
    await expect(page.locator("#administrator-alert-window")).toBeHidden();
    await expect(page.locator(".window-stack")).toHaveCSS("z-index", "2");

    expect(runtimeErrors.pageErrors).toEqual([]);
    expect(
      runtimeErrors.consoleErrors.filter(
        (message) => !/403 \(Forbidden\)/.test(message)
      )
    ).toEqual([]);
  });
}
