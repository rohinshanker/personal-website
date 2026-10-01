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
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const card = (id, name, level = 14) => ({
  id,
  iconUrl: `https://api-assets.clashroyale.com/cards/${id}.png`,
  level,
  maxLevel: 14,
  name,
});

const createBattles = (count = 10) =>
  Array.from({ length: count }, (_, index) => {
    const playerCrowns = index % 3;
    const opponentCrowns = (index + 1) % 3;
    return {
      battleTime: `20261001T${String(12 - index).padStart(2, "0")}1500.000Z`,
      type: "pathOfLegend",
      gameMode: { id: 72000006, name: "Ranked1v1_NewArena2" },
      team: [
        {
          tag: "#28CYYU08P",
          name: "Rohin",
          crowns: playerCrowns,
          trophyChange: playerCrowns > opponentCrowns ? 30 : -30,
          cards: [card(1, "Knight")],
        },
      ],
      opponent: [
        {
          tag: `#RIVAL${index}`,
          name: `Recent opponent ${index + 1}`,
          crowns: opponentCrowns,
          cards: [card(9, "Giant")],
        },
      ],
    };
  });

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
        card(1, "Lumberjack"),
        card(2, "Tombstone"),
        card(3, "Baby Dragon"),
        card(4, "Minions"),
        card(5, "Lava Hound"),
        card(6, "Barbarian Barrel"),
        card(7, "Poison"),
        card(8, "Inferno Dragon"),
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
  await page.route(/^https:\/\/api-assets\.clashroyale\.com\/.*\.png(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG })
  );
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
        battles: createBattles(),
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
    await expect(page.locator("#cr-battle-log .cr-battle-item")).toHaveCount(10);
    await expect(page.locator("#cr-battle-log time").first()).toHaveAttribute("datetime", "2026-10-01T12:15:00.000Z");
    await expect(page.locator("#cr-sample-summary")).toHaveText("3W–7L–0D · -1 crowns");
    await settleRender(page);

    const geometry = await clashWindow.evaluate((windowElement) => {
      const body = windowElement.querySelector(".clash-royale-window-body");
      const bounds = windowElement.getBoundingClientRect();
      return {
        battleListOverflows: windowElement.querySelector("#cr-battle-log").scrollHeight >
          windowElement.querySelector("#cr-battle-log").clientHeight,
        bodyOverflowX: body.scrollWidth > body.clientWidth,
        bodyOverflowY: body.scrollHeight > body.clientHeight,
        documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        documentOverflowY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        insideViewport:
          bounds.left >= 0 &&
          bounds.right <= window.innerWidth &&
          bounds.top >= 0 &&
          bounds.bottom <= window.innerHeight,
      };
    });
    expect(geometry, viewport.name).toEqual({
      battleListOverflows: true,
      bodyOverflowX: false,
      bodyOverflowY: false,
      documentOverflowX: false,
      documentOverflowY: false,
      insideViewport: true,
    });
  }
});

test("keeps the profile and deck fixed while the named battle log scrolls", async ({ page }) => {
  await page.route(API_URL, (route) =>
    successResponse(route, createPayload({ battles: createBattles() }))
  );
  const clashWindow = await openClashRoyale(page, { width: 375, height: 812 });
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");
  await settleRender(page);
  await expect.poll(() => clashWindow.evaluate((element) => element.getAnimations().length)).toBe(0);

  const battleLog = page.locator("#cr-battle-log");
  await expect(battleLog).toHaveAttribute("tabindex", "0");
  await expect(battleLog).toHaveAttribute("aria-labelledby", "cr-battles-heading");
  const fixedBefore = await clashWindow.evaluate((windowElement) => ({
    bodyScrollTop: windowElement.querySelector(".clash-royale-window-body").scrollTop,
    deckTop: windowElement.querySelector("#cr-current-deck").getBoundingClientRect().top,
    profileTop: windowElement.querySelector("#cr-player-card").getBoundingClientRect().top,
  }));
  const scrollGeometry = await battleLog.evaluate((element) => ({
    clientHeight: element.clientHeight,
    firstRowHeight: element.querySelector(".cr-battle-item").getBoundingClientRect().height,
    scrollHeight: element.scrollHeight,
  }));
  expect(scrollGeometry.scrollHeight).toBeGreaterThan(scrollGeometry.clientHeight);
  expect(scrollGeometry.clientHeight).toBeGreaterThanOrEqual(scrollGeometry.firstRowHeight);

  await battleLog.hover();
  await page.mouse.wheel(0, 260);
  await expect.poll(() => battleLog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await battleLog.evaluate((element) => { element.scrollTop = 0; });
  await battleLog.focus();
  await page.keyboard.press("PageDown");
  await expect.poll(() => battleLog.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const fixedAfter = await clashWindow.evaluate((windowElement) => ({
    bodyScrollTop: windowElement.querySelector(".clash-royale-window-body").scrollTop,
    deckTop: windowElement.querySelector("#cr-current-deck").getBoundingClientRect().top,
    profileTop: windowElement.querySelector("#cr-player-card").getBoundingClientRect().top,
  }));
  expect(fixedAfter).toEqual(fixedBefore);
  await expect(page.locator("#cr-refresh")).toBeInViewport();
  await expect(clashWindow.locator('[data-close="clash-royale"]')).toBeInViewport();
});

test("uses shared seven-segment sprites with accessible numeric values", async ({ page }) => {
  await page.route(API_URL, (route) => successResponse(route));
  await openClashRoyale(page, { width: 1280, height: 800 });
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");

  const trophies = page.locator("#cr-trophies");
  await expect(trophies.locator(".game-stats-digit-strip.cr-digit-strip")).toHaveCount(1);
  await expect(trophies.locator(".cr-digit-image")).toHaveCount(4);
  await expect(trophies.locator(".visually-hidden")).toHaveText("8,123");
  await expect(trophies.locator(".cr-digit-strip")).toHaveAttribute("aria-hidden", "true");
  const digitSources = await trophies.locator(".cr-digit-image").evaluateAll((images) =>
    images.map((image) => ({ alt: image.alt, path: new URL(image.src).pathname }))
  );
  expect(digitSources).toEqual([
    { alt: "", path: "/assets/minesweeper_assets/digital_digits/digital_8.png" },
    { alt: "", path: "/assets/minesweeper_assets/digital_digits/digital_1.png" },
    { alt: "", path: "/assets/minesweeper_assets/digital_digits/digital_2.png" },
    { alt: "", path: "/assets/minesweeper_assets/digital_digits/digital_3.png" },
  ]);
  await expect(page.locator("#cr-battle-log .cr-battle-metric .visually-hidden").first()).toHaveText(
    "2 to 1 crowns"
  );
});

test("loads only safe card images and preserves names after image failure", async ({ page }) => {
  const requestedCardImages = [];
  await page.route("https://api-assets.clashroyale.com/cards/broken.png", (route) => {
    requestedCardImages.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/png", body: "not an image" });
  });
  await page.route("https://api-assets.clashroyale.com/cards/safe.png", (route) => {
    requestedCardImages.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG });
  });
  await page.route(API_URL, (route) =>
    successResponse(
      route,
      createPayload({
        currentDeck: [
          { id: 1, name: "Safe card", iconUrl: "https://api-assets.clashroyale.com/cards/safe.png" },
          { id: 2, name: "Broken card", iconUrl: "https://api-assets.clashroyale.com/cards/broken.png" },
          { id: 3, name: "Unsafe card", iconUrl: "https://example.com/card.png" },
          { id: 4, name: "Insecure card", iconUrl: "http://api-assets.clashroyale.com/cards/insecure.png" },
        ],
      })
    )
  );
  await openClashRoyale(page, { width: 768, height: 1024 });
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");

  const cards = page.locator("#cr-current-deck .cr-deck-card");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0).locator("img")).toHaveAttribute("alt", "");
  await expect(cards.nth(1)).toHaveClass(/is-image-unavailable/);
  await expect(cards.nth(2)).toHaveClass(/is-image-unavailable/);
  await expect(cards.nth(3)).toHaveClass(/is-image-unavailable/);
  await expect(cards.locator(".cr-deck-card-name")).toHaveText([
    "Safe card",
    "Broken card",
    "Unsafe card",
    "Insecure card",
  ]);
  expect(requestedCardImages.sort()).toEqual([
    "https://api-assets.clashroyale.com/cards/broken.png",
    "https://api-assets.clashroyale.com/cards/safe.png",
  ]);
  const mediaSizes = await cards.locator(".cr-deck-card-media").evaluateAll((elements) =>
    elements.map((element) => ({ height: element.offsetHeight, width: element.offsetWidth }))
  );
  expect(new Set(mediaSizes.map(({ height }) => height)).size).toBe(1);
  expect(mediaSizes.every(({ width }) => width > 0)).toBe(true);
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
  await page.locator('.taskbar-icon[data-app="clash-royale"]').click();
  await expect(page.locator("#cr-refresh")).toBeEnabled();
  await expect(page.locator("#cr-status")).toHaveText("Refresh cancelled.");
  await page.locator('.taskbar-icon[data-app="clash-royale"]').click();
  await expect(clashWindow).toBeVisible();
  await expect.poll(() => requestCount).toBe(2);
  await expect(page.locator("#cr-refresh")).toBeEnabled();
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");
  expect(requestCount).toBe(2);
});

test("loads an app opened before its module finishes downloading", async ({ page }) => {
  let releaseModule;
  const moduleReady = new Promise((resolve) => { releaseModule = resolve; });
  await page.route(/\/scripts\/home\/clash-royale\.js(?:\?.*)?$/, async (route) => {
    await moduleReady;
    await route.continue();
  });
  await page.route(API_URL, (route) => successResponse(route));
  try {
    await page.goto("/home.html", { waitUntil: "commit" });
    await page.waitForFunction(() => Boolean(window.rohinAdminOrchestrator));
    await page.locator('#about-window [data-close="about"]').click({ noWaitAfter: true });
    await page.locator('.taskbar-icon[data-app="clash-royale"]').click({ noWaitAfter: true });
    await expect(page.locator("#clash-royale-window")).toBeVisible();
    releaseModule();
    await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");
  } finally {
    releaseModule();
  }
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
