import { scanForViolations } from "./helpers/accessibility-contracts.mjs";
import {
  DETERMINISTIC_RANDOM_DRAW,
  FROZEN_INSTANT,
  settleRender,
} from "./helpers/rendered-site.mjs";
import { expect, test } from "./deterministic.mjs";

const API_BASE_URL = "https://clash-royale-ui.test";
const API_URL = `${API_BASE_URL}/clash-royale`;
const BUILD_VERSION =
  "sha256-781e9e3fe27f372dd47374c6a25a1012956d78dbfebd7c55067d2d06b6e9e1c6";
const REQUIRED_VIEWPORTS = Object.freeze([
  Object.freeze({ name: "mobile", width: 375, height: 812 }),
  Object.freeze({ name: "below-breakpoint", width: 639, height: 900 }),
  Object.freeze({ name: "above-breakpoint", width: 641, height: 900 }),
  Object.freeze({ name: "tablet", width: 768, height: 1024 }),
  Object.freeze({ name: "desktop", width: 1280, height: 800 }),
  Object.freeze({ name: "wide", width: 1440, height: 900 }),
]);

const card = (id, name, level = 14) => ({ id, level, maxLevel: 14, name });

const createPayload = ({
  battles,
  currentDeck,
  fetchedAt = "2026-10-01T12:34:56.000Z",
  name = "Rohin",
  player = {},
} = {}) => ({
  ok: true,
  fetchedAt,
  cacheTtlSeconds: 300,
  player: {
    tag: "#28CYYU08P",
    name,
    trophies: 8123,
    bestTrophies: 8301,
    wins: 1400,
    losses: 600,
    battleCount: 2380,
    threeCrownWins: 401,
    clan: { tag: "#CLAN", name: "Royal Friends", badgeId: 16000000 },
    arena: { id: 54000024, name: "Legendary Arena" },
    currentDeck:
      currentDeck ??
      [
        card(1, "Knight"),
        card(2, "Archers"),
        card(3, "Fireball"),
        card(4, "The Log"),
        card(5, "Hog Rider"),
        card(6, "Ice Spirit"),
        card(7, "Cannon"),
        card(8, "Skeletons"),
      ],
    ...player,
  },
  battles:
    battles ??
    [
      {
        battleTime: "20261001T121500.000Z",
        type: "PvP",
        gameMode: { id: 72000006, name: "Ladder" },
        team: [
          {
            tag: "#OTHER",
            name: "Other side",
            crowns: 1,
            trophyChange: -30,
            cards: [card(9, "Giant")],
          },
        ],
        opponent: [
          {
            tag: "#28CYYU08P",
            name: "Rohin",
            crowns: 2,
            trophyChange: 30,
            cards: [card(1, "Knight")],
          },
        ],
      },
      {
        battleTime: "2026-10-01T11:15:00.000Z",
        type: "challenge",
        team: [{ tag: "#28CYYU08P", name: "Rohin", cards: [card(1, "Knight")] }],
        opponent: [{ tag: "#RIVAL", name: "Rival without a reported crown total" }],
      },
    ],
});

const installBackendConfig = (page) =>
  page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "${API_BASE_URL}", buildVersion: "${BUILD_VERSION}" });`,
    })
  );

const openClashRoyale = async (page, viewport) => {
  await page.clock.setFixedTime(FROZEN_INSTANT);
  await page.setViewportSize(viewport);
  await page.addInitScript((draw) => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => draw;
  }, DETERMINISTIC_RANDOM_DRAW);
  await page.goto("/home.html", { waitUntil: "load" });
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) {
    await aboutClose.click();
    await page.locator("#about-window").waitFor({ state: "hidden" });
  }
  await page.locator('.taskbar-icon[data-app="clash-royale"]').click();
  const clashWindow = page.locator("#clash-royale-window");
  await expect(clashWindow).toBeVisible();
  return clashWindow;
};

const successResponse = (route, payload = createPayload()) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    json: payload,
  });

const consumeExpectedHttpFailure = (diagnostics, status) => {
  expect(diagnostics.runtimeErrors).toEqual([]);
  expect(diagnostics.requestFailures).toEqual([]);
  expect(diagnostics.consoleErrors).toHaveLength(1);
  expect(diagnostics.consoleErrors[0]).toMatch(
    new RegExp(`^Failed to load resource: the server responded with a status of ${status}`)
  );
  expect(diagnostics.errorResponses).toEqual([`${status} ${API_URL}`]);
  diagnostics.consoleErrors.pop();
  diagnostics.errorResponses.pop();
};

test.beforeEach(async ({ page }) => {
  await page.route(new RegExp(`^${API_BASE_URL}/stats(?:\\?.*)?$`), (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      json: {},
    })
  );
  await installBackendConfig(page);
});

test("renders success and long content across the viewport matrix without overflow", async ({
  page,
}) => {
  const longName = "Rohin with an unusually long Clash Royale player name";
  await page.route(API_URL, (route) =>
    successResponse(
      route,
      createPayload({
        name: longName,
        player: {
          arena: { id: 1, name: "An arena with a deliberately long descriptive name" },
          clan: {
            tag: "#VERYLONGCLANTAG",
            name: "A clan name long enough to wrap without clipping adjacent statistics",
          },
        },
      })
    )
  );

  for (const viewport of REQUIRED_VIEWPORTS) {
    const clashWindow = await openClashRoyale(page, viewport);
    await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");
    await expect(page.locator("#cr-player-name")).toHaveText(longName);
    await expect(page.locator("#cr-current-deck .cr-deck-card")).toHaveCount(8);
    await expect(page.locator("#cr-battle-log .cr-battle-item")).toHaveCount(2);
    await expect(page.locator("#cr-sample-summary")).toHaveText("1W–0L–0D · +1 crowns");
    await settleRender(page);

    const geometry = await clashWindow.evaluate((windowElement) => {
      const body = windowElement.querySelector(".clash-royale-window-body");
      const bounds = windowElement.getBoundingClientRect();
      return {
        bodyOverflows: body.scrollWidth > body.clientWidth,
        documentOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        insideViewport:
          bounds.left >= 0 &&
          bounds.right <= window.innerWidth &&
          bounds.top >= 0 &&
          bounds.bottom <= window.innerHeight,
      };
    });
    expect(geometry, viewport.name).toEqual({
      bodyOverflows: false,
      documentOverflows: false,
      insideViewport: true,
    });
  }
});

test("suppresses duplicate refreshes and reuses the snapshot after reopening", async ({ page }) => {
  let requestCount = 0;
  let delayNextResponse = false;
  await page.route(API_URL, async (route) => {
    requestCount += 1;
    if (delayNextResponse) await new Promise((resolve) => setTimeout(resolve, 1500));
    await successResponse(route);
  });

  const clashWindow = await openClashRoyale(page, { width: 1280, height: 800 });
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");
  expect(requestCount).toBe(1);

  await clashWindow.locator('[data-close="clash-royale"]').click();
  await clashWindow.waitFor({ state: "hidden" });
  await page.locator('.taskbar-icon[data-app="clash-royale"]').click();
  await expect(clashWindow).toBeVisible();
  expect(requestCount).toBe(1);

  requestCount = 0;
  delayNextResponse = true;
  await openClashRoyale(page, { width: 1280, height: 800 });
  await expect(page.locator("#cr-refresh")).toBeDisabled();
  await expect(page.locator("#cr-refresh")).toHaveText("Refreshing…");
  await page.evaluate(() => {
    window.ClashRoyaleApp.load(true);
    window.ClashRoyaleApp.load(true);
  });
  expect(requestCount).toBe(1);
  await clashWindow.locator('[data-close="clash-royale"]').click();
  await page.locator('.taskbar-icon[data-app="clash-royale"]').click();
  await expect(clashWindow).toBeVisible();
  await expect.poll(() => requestCount).toBe(2);
  await expect(page.locator("#cr-refresh")).toBeEnabled();
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");
  expect(requestCount).toBe(2);
});

test("retains a snapshot after an error and clears stale fields on an empty success", async ({
  diagnostics,
  page,
}) => {
  let responseNumber = 0;
  await page.route(API_URL, (route) => {
    responseNumber += 1;
    if (responseNumber === 1) return successResponse(route);
    if (responseNumber === 2) {
      return route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        json: { ok: false, error: "Rate limited", retryAfterMs: 2500 },
      });
    }
    return successResponse(
      route,
      createPayload({
        battles: [],
        currentDeck: [],
        name: "Fresh Empty Snapshot",
        player: {
          arena: undefined,
          battleCount: undefined,
          bestTrophies: undefined,
          clan: undefined,
          losses: undefined,
          threeCrownWins: undefined,
          trophies: undefined,
          wins: undefined,
        },
      })
    );
  });

  await openClashRoyale(page, { width: 768, height: 1024 });
  await expect(page.locator("#cr-player-name")).toHaveText("Rohin");
  await page.locator("#cr-refresh").click();
  await expect(page.locator("#cr-status")).toHaveText(
    "Too many refreshes. Try again in 3 seconds."
  );
  await expect(page.locator("#cr-player-name")).toHaveText("Rohin");
  await expect(page.locator("#cr-current-deck .cr-deck-card")).toHaveCount(8);
  consumeExpectedHttpFailure(diagnostics, 429);

  await page.locator("#cr-refresh").click();
  await expect(page.locator("#cr-player-name")).toHaveText("Fresh Empty Snapshot");
  await expect(page.locator("#cr-trophies")).toHaveText("—");
  await expect(page.locator("#cr-arena")).toHaveText("Unavailable");
  await expect(page.locator("#cr-current-deck .cr-empty")).toHaveText(
    "No current deck was returned."
  );
  await expect(page.locator("#cr-battle-log .cr-empty")).toHaveText(
    "No recent battles were returned."
  );
  await expect(page.locator("#cr-sample-summary")).toHaveText("No usable battles");
});

for (const { status, message } of [
  { status: 502, message: "Clash Royale returned an error. Try again later." },
  { status: 503, message: "Player data is temporarily unavailable. Try again later." },
  { status: 504, message: "The player data request timed out. Try again." },
]) {
  test(`shows a safe retry message for endpoint status ${status}`, async ({ diagnostics, page }) => {
    await page.route(API_URL, (route) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        json: { ok: false, error: "Upstream implementation detail" },
      })
    );
    await openClashRoyale(page, { width: 375, height: 812 });
    await expect(page.locator("#cr-status")).toHaveText(message);
    await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "error");
    await expect(page.locator("#cr-status")).not.toContainText("implementation detail");
    consumeExpectedHttpFailure(diagnostics, status);
  });
}

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
]) {
  test(`the success window is accessible at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.route(API_URL, (route) => successResponse(route));
    await openClashRoyale(page, viewport);
    await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");
    await settleRender(page);
    expect(await scanForViolations(page, testInfo, `clash-royale-${viewport.name}`)).toEqual([]);
  });
}
