import { expect, test } from "./deterministic.mjs";
import { REVIEW_VIEWPORTS, consumeDiagnostics, settleRender } from "./helpers/rendered-site.mjs";
import { readFile } from "node:fs/promises";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import {
  createIssuedGameResponder,
  nearWinSolitaireInitial,
} from "./helpers/verified-game-session.mjs";

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
const viewports = REVIEW_VIEWPORTS;
const victoryViewports = Object.freeze([
  viewports[0],
  { name: "compact-breakpoint", width: 640, height: 900 },
  { name: "expanded-breakpoint", width: 641, height: 900 },
  ...viewports.slice(1),
]);

const isPlayerStatsPath = (path, playerId) => {
  const url = new URL(path, API_BASE_URL);
  return (
    url.pathname === "/stats" &&
    url.searchParams.get("protocol") === "2" &&
    url.searchParams.get("playerId") === playerId
  );
};

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

const installSolitaireBridge = async (page) => {
  await routeHomeScript(page, "gameStats", (source) =>
    source.replace(
      /\n\}\)\(\);\s*$/,
      `
window.__solitairePublishGameStatsTest = Object.freeze({
  syncQueued: () => syncQueuedGameStats(),
});
})();`
    )
  );
  await routeHomeScript(page, "solitaire", (source) =>
    source.replace(
      /\n\}\)\(\);\s*$/,
      `
window.__solitairePublishFlowTest = Object.freeze({
  triggerWin: async () => {
    await window.__solitairePublishGameStatsTest.syncQueued();
    if (!solState.statsSession) {
      throw new Error("Solitaire gameplay did not start a verified stats session.");
    }
    // The issued board is one move from home, so the win is that move. A board
    // staged beneath the rules would carry no proof and could not publish.
    const column = solState.tableau.findIndex((cards) => cards.length === 1);
    if (column < 0) throw new Error("The issued board is not one move from a win.");
    solAutoMoveCardToFoundation("tableau", column, 0);
  },
});
})();`
    )
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

/**
 * The verified-session half of the protocol, answered accurately. Publishing a
 * Solitaire win now means the server verifies its replay and returns the metric
 * it derived, so the receipt carries the same move count the board reports.
 */
const verifiedSolitaireResponder = () =>
  createIssuedGameResponder({
    games: ["solitaire"],
    initials: { solitaire: nearWinSolitaireInitial() },
    receipts: { solitaire: { type: "win", metricKind: "moves", metric: 80 } },
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

  const verified = verifiedSolitaireResponder();
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    if (await verified.handle(route)) return;
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
          version: 2,
          generatedAt: new Date().toISOString(),
          acknowledgedEventIds:
            refreshed && url.searchParams.getAll("pendingEventId").includes(publishedEvent.id)
              ? [publishedEvent.id]
              : [],
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

  return { eventRequests, sessionRequests: verified.issued, statsRequests, verified };
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

  const verified = verifiedSolitaireResponder();
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    if (await verified.handle(route)) return;
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

  return { eventRequests, sessionRequests: verified.issued, signInRequests, verified };
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

  const verified = verifiedSolitaireResponder();
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    if (await verified.handle(route)) return;
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
      const acknowledgedEventIds = stats.eventIds.filter((eventId) =>
        url.searchParams.getAll("pendingEventId").includes(eventId)
      );
      delete stats.eventIds;
      stats.version = 2;
      stats.acknowledgedEventIds = acknowledgedEventIds;
      statsRequests.push({
        authoritative: authoritativeStats,
        acknowledgedEventIds: [...acknowledgedEventIds],
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
    sessionRequests: verified.issued,
    statsRequests,
    useAuthoritativeStats: () => {
      authoritativeStats = true;
    },
    verified,
  };
};

test("a verified Solitaire win publishes and refreshes the global leaderboard", async ({
  page,
}) => {
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
  await installSolitaireBridge(page);
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
  // The deal is issued when the board is dealt, because a verified result has
  // to bind the board the server chose.
  await expect.poll(() => api.sessionRequests.length).toBe(1);
  expect(api.eventRequests).toEqual([]);

  await solitaireWindow.locator("#sol-stock").click();
  expect(api.sessionRequests).toHaveLength(1);
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
  // One issuance, carrying the protocol and version fields the Worker binds the
  // replay to.
  expect(api.sessionRequests).toEqual([
    {
      game: "solitaire",
      config: {},
      buildVersion: generatedBuildVersion,
      resultProtocol: 2,
      rulesVersion: 1,
      replayVersion: 1,
      generatorVersion: 1,
    },
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
  // A verified result is published against the completion receipt the server
  // returned for its replay, not against a session proof alone.
  expect(api.eventRequests[0].completion).toMatchObject({
    id: `completion-${api.verified.finishes[0].id}`,
    token: "synthetic-completion-proof",
  });
  expect(api.verified.replayFor("solitaire").length).toBeGreaterThan(0);
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

});

test("an active Administrator win stays advanced through stale stats and exact-event reconciliation", async ({
  page,
}) => {
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
  await installSolitaireBridge(page);
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
  expect(
    api.statsRequests.some(({ acknowledgedEventIds }) =>
      acknowledgedEventIds.includes(publishedEvent.id)
    )
  ).toBe(false);

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

  api.useAuthoritativeStats();
  await expect(refreshButton).toBeEnabled();
  await refreshButton.click();
  await expect
    .poll(
      () =>
        api.statsRequests.filter(
          ({ authoritative, acknowledgedEventIds }) =>
            authoritative && acknowledgedEventIds.includes(publishedEvent.id)
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
    {
      game: "solitaire",
      config: {},
      buildVersion: generatedBuildVersion,
      resultProtocol: 2,
      rulesVersion: 1,
      replayVersion: 1,
      generatorVersion: 1,
    },
  ]);
  expect(
    api.statsRequests.every(({ path }) =>
      isPlayerStatsPath(path, administratorProfile.id)
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
});

for (const viewport of victoryViewports) {
  test(`Victory Royale animation is 40% smaller at the board top at ${viewport.name}`, async ({
    page,
  }) => {
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
    await installSolitaireBridge(page);
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
    // Measure the overlay only once its fonts, images, and layout have settled.
    await settleRender(page);

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
      await video.evaluate((element) =>
        element.classList.remove("is-visible-fallback")
      );
      await canvas.evaluate((element) => element.classList.remove("is-hidden"));
    }

    await solitaireWindow.locator("#sol-reset").click();
    await expect(overlay).toBeHidden();
    await expect(overlay).toHaveAttribute("aria-hidden", "true");
  });
}

for (const viewport of viewports) {
  test(`an expired Administrator session opens sign-in after a completed Solitaire game at ${viewport.name}`, async ({
    diagnostics,
    page,
  }) => {
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
    await installSolitaireBridge(page);
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

    // The rejected publish is the behaviour under test; the fixture still
    // fails on anything the page reported beyond these exact entries.
    consumeDiagnostics(diagnostics, {
      consoleErrors: [
        "status of 403 (Forbidden)",
      ],
      errorResponses: [
        `403 ${API_BASE_URL}/events`,
      ],
    });
  });
}

/**
 * Scripted `/events` responder for the protected profile. `respond` receives
 * the request count and the presented Authorization header and returns the
 * response body/status. Each sign-in issues a distinct proof so the browser's
 * retry can be observed.
 */
const installAdministratorRejectionApi = async (page, respond) => {
  const eventRequests = [];
  const signInRequests = [];
  const corsHeaders = {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  };

  const verified = verifiedSolitaireResponder();
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    if (await verified.handle(route)) return;
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/sessions") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          id: "session-solitaire-rejection-0001",
          token: "session-solitaire-rejection-token",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
      });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/events") {
      const authorization = request.headers().authorization || "";
      eventRequests.push({ authorization, body: JSON.parse(request.postData() || "{}") });
      const { status, body } = respond(eventRequests.length, authorization);
      await route.fulfill({
        status,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify(body),
      });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/administrator/sign-in") {
      signInRequests.push(JSON.parse(request.postData() || "{}"));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          ok: true,
          profile: administratorProfile,
          proof: `${"f".repeat(32)}.${String(signInRequests.length).padStart(32, "0")}`,
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

  return { eventRequests, signInRequests };
};

const prepareSignedInAdministrator = async (page, viewport) => {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ activeProof, felizJuevesKey, profileKey, proofKey, queueKey, savedProfile, statsKey }) => {
      Math.random = () => 0.999999;
      localStorage.clear();
      sessionStorage.clear();
      const now = new Date();
      localStorage.setItem(
        felizJuevesKey,
        [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-")
      );
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
      localStorage.removeItem(queueKey);
      localStorage.removeItem(statsKey);
      sessionStorage.setItem(proofKey, JSON.stringify(activeProof));
    },
    {
      activeProof: {
        proof: administratorProof,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      felizJuevesKey: FELIZ_JUEVES_SHOWN_KEY,
      profileKey: PROFILE_STORAGE_KEY,
      proofKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
      queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      savedProfile: administratorProfile,
      statsKey: GAME_STATS_STORAGE_KEY,
    }
  );
  await installBackendConfig(page);
  await installSolitaireBridge(page);
};

/**
 * Starts a verified Solitaire game with its stats window already open, so the
 * status row shows the publish outcome instead of a later refresh, then wins.
 */
const completeSolitaireGameWithStatsOpen = async (page) => {
  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page.locator('.desktop-icon[data-app="solitaire"]').click();
  const solitaireWindow = page.locator('[data-app-window="solitaire"]');
  await expect(solitaireWindow).toBeVisible();
  await expect(solitaireWindow).not.toHaveClass(/is-opening/);
  await solitaireWindow.locator("#sol-stock").click();
  await solitaireWindow.locator('[data-game-stats-open="solitaire"]').click();
  const statsWindow = page.locator("#game-stats-window-solitaire");
  await expect(statsWindow).toBeVisible();
  await expect(statsWindow).not.toHaveClass(/is-opening/);
  await page.evaluate(() => window.__solitairePublishFlowTest.triggerWin());
  return statsWindow;
};

const readStoredPublishState = (page) =>
  page.evaluate(
    ({ proofKey, queueKey, statsKey }) => ({
      proof: JSON.parse(sessionStorage.getItem(proofKey) || "null")?.proof || null,
      queue: JSON.parse(localStorage.getItem(queueKey) || "[]"),
      solitaireWins: JSON.parse(localStorage.getItem(statsKey) || "null")?.totals?.solitaire
        ?.wins,
    }),
    {
      proofKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
      queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      statsKey: GAME_STATS_STORAGE_KEY,
    }
  );

const rejectionViewports = Object.freeze([viewports[0], viewports[2]]);
const REJECTED_RESULT_STATUS =
  "Local stats are saved, but a result could not pass server verification.";

for (const viewport of rejectionViewports) {
  test(`a rejected Administrator game session keeps the proof and never reopens sign-in at ${viewport.name}`, async ({
    diagnostics,
    page,
  }) => {
    await prepareSignedInAdministrator(page, viewport);
    const api = await installAdministratorRejectionApi(page, () => ({
      status: 403,
      body: { ok: false, error: "Session proof does not match this result" },
    }));

    const statsWindow = await completeSolitaireGameWithStatsOpen(page);
    await expect.poll(() => api.eventRequests.length).toBe(1);
    expect(api.eventRequests[0].authorization).toBe(`Bearer ${administratorProof}`);

    await expect(statsWindow.locator("[data-game-stats-sync-status]")).toHaveText(
      REJECTED_RESULT_STATUS
    );
    await expect(page.locator("#administrator-window")).toBeHidden();
    expect(api.signInRequests).toEqual([]);
    expect(api.eventRequests).toHaveLength(1);

    const stored = await readStoredPublishState(page);
    expect(stored.proof).toBe(administratorProof);
    expect(stored.queue).toEqual([]);
    expect(stored.solitaireWins).toBe(1);

    await expect(statsWindow.locator("[data-game-stats-refresh]")).toBeEnabled();
    const layout = await statsWindow.evaluate((windowElement) => ({
      bodyOverflows:
        windowElement.querySelector(".window-body").scrollWidth >
        windowElement.querySelector(".window-body").clientWidth,
      documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
    }));
    expect(layout.bodyOverflows).toBe(false);
    expect(layout.documentOverflows).toBe(false);
    // The rejected publish is the behaviour under test; the fixture still
    // fails on anything the page reported beyond these exact entries.
    consumeDiagnostics(diagnostics, {
      consoleErrors: [
        "status of 403 (Forbidden)",
      ],
      errorResponses: [
        `403 ${API_BASE_URL}/events`,
      ],
    });
  });

  test(`a persistently rejected Administrator proof renews sign-in once and then stops at ${viewport.name}`, async ({
    diagnostics,
    page,
  }) => {
    await prepareSignedInAdministrator(page, viewport);
    const api = await installAdministratorRejectionApi(page, () => ({
      status: 403,
      body: {
        ok: false,
        error: "Administrator authorization is invalid",
        code: "administrator-authorization",
      },
    }));

    const statsWindow = await completeSolitaireGameWithStatsOpen(page);
    await expect.poll(() => api.eventRequests.length).toBe(1);
    expect(api.eventRequests[0].authorization).toBe(`Bearer ${administratorProof}`);

    const administratorWindow = page.locator("#administrator-window");
    await expect(administratorWindow).toBeVisible();
    await expect(administratorWindow).not.toHaveClass(/is-opening/);
    await expect(statsWindow.locator("[data-game-stats-sync-status]")).toHaveText(
      "Waiting for authentication..."
    );
    let stored = await readStoredPublishState(page);
    expect(stored.proof).toBeNull();
    expect(stored.queue).toHaveLength(1);
    expect(stored.queue[0].proofRejections).toBe(1);

    await page.locator("#administrator-username").fill("test-only-administrator");
    await page.locator("#administrator-password").fill("test-only-password");
    await page.locator("#administrator-sign-in").click();
    await expect(page.locator("#administrator-alert-window")).toBeVisible();
    await expect.poll(() => api.eventRequests.length).toBe(2);
    expect(api.eventRequests[1].authorization).toBe(
      `Bearer ${"f".repeat(32)}.${"1".padStart(32, "0")}`
    );
    await page.locator("#administrator-alert-close").click();
    await expect(page.locator("#administrator-alert-window")).toBeHidden();

    await expect
      .poll(async () => (await readStoredPublishState(page)).queue)
      .toEqual([]);
    await expect(administratorWindow).toBeHidden();
    expect(api.signInRequests).toHaveLength(1);
    expect(api.eventRequests).toHaveLength(2);
    stored = await readStoredPublishState(page);
    expect(stored.proof).toBeNull();
    expect(stored.solitaireWins).toBe(1);

    await expect(statsWindow.locator("[data-game-stats-sync-status]")).toHaveText(
      REJECTED_RESULT_STATUS
    );
    await expect(statsWindow.locator("[data-game-stats-refresh]")).toBeEnabled();
    await expect(administratorWindow).toBeHidden();
    // The rejected publish is the behaviour under test; the fixture still
    // fails on anything the page reported beyond these exact entries.
    consumeDiagnostics(diagnostics, {
      consoleErrors: [
        "status of 403 (Forbidden)",
        "status of 403 (Forbidden)",
      ],
      errorResponses: [
        `403 ${API_BASE_URL}/events`,
        `403 ${API_BASE_URL}/events`,
      ],
    });
  });
}
