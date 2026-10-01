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

const card = (id, name, metadata = {}) => ({
  elixirCost: 3,
  id,
  iconUrl: `https://api-assets.clashroyale.com/cards/${id}.png`,
  level: 14,
  maxLevel: 14,
  name,
  rarity: "rare",
  ...metadata,
});

const createBattles = (count = 20) =>
  Array.from({ length: count }, (_, index) => {
    const playerCrowns = index % 3;
    const opponentCrowns = (index + 1) % 3;
    return {
      battleTime: new Date(Date.UTC(2026, 9, 1, 12, 15) - index * 60 * 60 * 1000).toISOString(),
      type: "pathOfLegend",
      gameMode: { id: 72000464, name: "Ranked1v1_NewArena2" },
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
        card(1, "Lumberjack", {
          elixirCost: 4,
          rarity: "legendary",
          variant: "evo",
          variantIconUrl: "https://api-assets.clashroyale.com/cardevolutions/300/lumberjack.png",
        }),
        card(2, "Tombstone", {
          elixirCost: 3,
          rarity: "rare",
          variant: "hero",
          variantIconUrl: "https://api-assets.clashroyale.com/cardheroes/300/tombstone.png",
        }),
        card(3, "Baby Dragon", { elixirCost: 4, rarity: "epic" }),
        card(4, "Minions", { elixirCost: 3, rarity: "common" }),
        card(5, "Lava Hound", { elixirCost: 7, rarity: "legendary" }),
        card(6, "Barbarian Barrel", { elixirCost: 2, rarity: "epic" }),
        card(7, "Poison", { elixirCost: 4, rarity: "epic" }),
        card(8, "Inferno Dragon", { elixirCost: 4, rarity: "legendary" }),
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
    await expect(clashWindow).toHaveAccessibleName("Clash Royale Stats");
    await expect(page.locator('.desktop-icon[data-app="clash-royale"]')).toHaveAccessibleName(
      "Clash Royale Stats"
    );
    await expect(page.locator('.taskbar-icon[data-app="clash-royale"]')).toHaveAccessibleName(
      "Clash Royale Stats"
    );
    await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");
    await expect(page.locator("#cr-status")).toBeHidden();
    await expect(page.locator("#cr-player-name")).toHaveText(longName);
    await expect(page.locator("#cr-current-deck .cr-deck-card")).toHaveCount(8);
    await expect(page.locator("#cr-battle-log .cr-battle-item")).toHaveCount(20);
    await expect(page.locator("#cr-battle-log")).toHaveJSProperty("tagName", "OL");
    await expect(page.locator("#cr-battle-scroll")).toHaveAccessibleName("Recent Battles");
    await expect(page.locator("#cr-battle-log time").first()).toHaveAttribute("datetime", "2026-10-01T12:15:00.000Z");
    await expect(page.locator("#cr-sample-summary")).toHaveText("6W–14L–0D · -2 crowns");
    await expect(page.locator("#cr-history-footer")).toHaveText(
      "Most recent 20 battles loaded. View Royale API for full list."
    );
    await expect(page.locator("#cr-deck-average")).toHaveText("Average elixir: 3.9");
    await expect(page.locator(".cr-player-footer #cr-refresh")).toBeVisible();
    await expect(page.locator(".cr-career-wins")).toHaveText("1,400 wins");
    await expect(page.locator(".cr-career-losses")).toHaveText("600 losses");
    await expect(page.locator("#cr-current-deck .cr-card-elixir")).toHaveCount(8);
    await expect(page.locator("#cr-current-deck .cr-card-rarity")).toHaveCount(8);
    await expect(page.locator("#cr-current-deck .cr-card-rarity").first()).toHaveClass(
      /visually-hidden/
    );
    await expect(page.locator("#cr-battle-log .cr-battle-mode").first()).toHaveText("Ranked");
    await expect(page.locator("#cr-battle-log .cr-battle-opponent").first()).toHaveText(
      "Rohin vs. Recent opponent 1"
    );
    await expect(page.locator("#clash-royale-window")).not.toContainText(
      "Updates at most every 5 minutes"
    );
    await settleRender(page);

    if (viewport.width <= 640) {
      const mobileTextStats = await clashWindow.evaluate((windowElement) => {
        const arena = windowElement.querySelector("#cr-arena");
        const clan = windowElement.querySelector("#cr-clan");
        const record = windowElement.querySelector("#cr-career-record");
        const separator = windowElement.querySelector(".cr-career-separator");
        return {
          arenaDisplay: getComputedStyle(arena).display,
          arenaTextOverflow: getComputedStyle(arena).textOverflow,
          clanDisplay: getComputedStyle(clan).display,
          clanTextOverflow: getComputedStyle(clan).textOverflow,
          recordDisplay: getComputedStyle(record).display,
          separatorText: separator.textContent,
          someTextIsClipped:
            arena.scrollWidth > arena.clientWidth || clan.scrollWidth > clan.clientWidth,
        };
      });
      expect(mobileTextStats, viewport.name).toEqual({
        arenaDisplay: "block",
        arenaTextOverflow: "ellipsis",
        clanDisplay: "block",
        clanTextOverflow: "ellipsis",
        recordDisplay: "block",
        separatorText: " · ",
        someTextIsClipped: true,
      });
    }

    const geometry = await clashWindow.evaluate((windowElement) => {
      const body = windowElement.querySelector(".clash-royale-window-body");
      const bounds = windowElement.getBoundingClientRect();
      const deck = windowElement.querySelector("#cr-current-deck");
      const battleScroll = windowElement.querySelector("#cr-battle-scroll");
      const footer = windowElement.querySelector("#cr-history-footer");
      return {
        battleScrollOverflows: battleScroll.scrollHeight > battleScroll.clientHeight,
        deckColumns: getComputedStyle(deck).gridTemplateColumns.split(" ").length,
        bodyOverflowX: body.scrollWidth > body.clientWidth,
        bodyOverflowY: body.scrollHeight > body.clientHeight,
        documentOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        documentOverflowY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        footerInsideScroll: footer.parentElement === battleScroll,
        footerStartsBelowScroll: footer.getBoundingClientRect().top >=
          battleScroll.getBoundingClientRect().bottom,
        insideViewport:
          bounds.left >= 0 &&
          bounds.right <= window.innerWidth &&
          bounds.top >= 0 &&
          bounds.bottom <= window.innerHeight,
      };
    });
    expect(geometry, viewport.name).toEqual({
      battleScrollOverflows: true,
      deckColumns: 4,
      bodyOverflowX: false,
      bodyOverflowY: true,
      documentOverflowX: false,
      documentOverflowY: false,
      footerInsideScroll: true,
      footerStartsBelowScroll: true,
      insideViewport: true,
    });
    const footerAtBottom = await page.locator("#cr-battle-scroll").evaluate((scroll) => {
      scroll.scrollTop = scroll.scrollHeight;
      const footer = scroll.querySelector("#cr-history-footer").getBoundingClientRect();
      const bounds = scroll.getBoundingClientRect();
      return footer.top >= bounds.top && footer.bottom <= bounds.bottom;
    });
    expect(footerAtBottom, viewport.name).toBe(true);
    await expect(page.locator("#cr-history-footer a")).toHaveAttribute(
      "href",
      "https://royaleapi.com/player/28CYYU08P"
    );
  }
});

test("keeps window and named battle scrolling independent and keyboard accessible", async ({ page }) => {
  await page.route(API_URL, (route) =>
    successResponse(route, createPayload({ battles: createBattles() }))
  );
  const clashWindow = await openClashRoyale(page, { width: 375, height: 812 });
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");
  await settleRender(page);
  await expect.poll(() => clashWindow.evaluate((element) => element.getAnimations().length)).toBe(0);

  const battleLog = page.locator("#cr-battle-log");
  const battleScroll = page.locator("#cr-battle-scroll");
  const windowBody = clashWindow.locator(".clash-royale-window-body");
  await expect(page.locator("#cr-refresh")).toBeInViewport();
  await battleScroll.scrollIntoViewIfNeeded();
  await expect.poll(() => windowBody.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(battleScroll).toHaveAttribute("tabindex", "0");
  await expect(battleScroll).toHaveAttribute("aria-labelledby", "cr-battles-heading");
  const fixedBefore = await clashWindow.evaluate((windowElement) => ({
    bodyScrollTop: windowElement.querySelector(".clash-royale-window-body").scrollTop,
    deckTop: windowElement.querySelector("#cr-current-deck").getBoundingClientRect().top,
    profileTop: windowElement.querySelector("#cr-player-card").getBoundingClientRect().top,
  }));
  const scrollGeometry = await battleScroll.evaluate((element) => ({
    clientHeight: element.clientHeight,
    firstRowHeight: element.querySelector(".cr-battle-item").getBoundingClientRect().height,
    scrollHeight: element.scrollHeight,
  }));
  expect(scrollGeometry.scrollHeight).toBeGreaterThan(scrollGeometry.clientHeight);
  expect(scrollGeometry.clientHeight).toBeGreaterThanOrEqual(scrollGeometry.firstRowHeight);

  await battleScroll.hover();
  await page.mouse.wheel(0, 260);
  await expect.poll(() => battleScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await battleScroll.evaluate((element) => { element.scrollTop = 0; });
  await battleScroll.focus();
  await page.keyboard.press("PageDown");
  await expect.poll(() => battleScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await battleScroll.evaluate((element) => { element.scrollTop = 0; });
  await battleLog.locator("summary").last().focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#cr-history-footer a")).toBeFocused();
  const footerVisibleInScroll = await battleScroll.evaluate((scroll) => {
    const footer = scroll.querySelector("#cr-history-footer").getBoundingClientRect();
    const bounds = scroll.getBoundingClientRect();
    return footer.top >= bounds.top && footer.bottom <= bounds.bottom;
  });
  expect(footerVisibleInScroll).toBe(true);

  const fixedAfter = await clashWindow.evaluate((windowElement) => ({
    bodyScrollTop: windowElement.querySelector(".clash-royale-window-body").scrollTop,
    deckTop: windowElement.querySelector("#cr-current-deck").getBoundingClientRect().top,
    profileTop: windowElement.querySelector("#cr-player-card").getBoundingClientRect().top,
  }));
  expect(fixedAfter).toEqual(fixedBefore);
  await windowBody.evaluate((element) => { element.scrollTop = 0; });
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
  const statIconPaths = await page.locator("#cr-player-card .cr-stat-icon").evaluateAll((images) =>
    images.map((image) => ({ alt: image.alt, path: new URL(image.src).pathname }))
  );
  expect(statIconPaths).toEqual(expect.arrayContaining([
    { alt: "", path: "/assets/app-icons/ico/users.ico" },
    { alt: "", path: "/assets/app-icons/ico/certificate_multiple.ico" },
    { alt: "", path: "/assets/app-icons/ico/calculator.ico" },
    { alt: "", path: "/assets/pixelarticons/sword.svg" },
  ]));
  await expect(page.locator("#cr-battle-log .cr-battle-metric .visually-hidden").first()).toHaveText(
    "2 to 1 crowns"
  );
  const partialDeckDisclosure = page.locator("#cr-battle-log details").nth(1);
  await partialDeckDisclosure.locator("summary").click();
  await expect(partialDeckDisclosure.locator(".cr-battle-side-title")).toHaveText(["Your team"]);
});

test("centers battle badges and reveals factual Other mode names on hover and focus", async ({
  page,
}, testInfo) => {
  const otherBattle = {
    battleTime: "2026-10-01T10:00:00.000Z",
    type: "unknown",
    gameMode: { id: 72000529, name: "RR_FourCard_Friendly" },
    team: [{ tag: "#28CYYU08P", name: "Rohin", crowns: 1, cards: [] }],
    opponent: [{ tag: "#RIVAL", name: "Long factual opponent name", crowns: 2, cards: [] }],
  };
  const ladderBattle = {
    battleTime: "2026-10-01T09:00:00.000Z",
    type: "PvP",
    gameMode: { id: 72000006, name: "Ladder" },
    team: [{ tag: "#28CYYU08P", name: "Rohin", crowns: 2, cards: [] }],
    opponent: [{ tag: "#RIVAL2", name: "Ladder rival", crowns: 1, cards: [] }],
  };
  await page.route(API_URL, (route) =>
    successResponse(route, createPayload({ battles: [otherBattle, ladderBattle] }))
  );
  await openClashRoyale(page, { width: 375, height: 812 });
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");

  const other = page.locator("#cr-battle-log .cr-battle-mode.is-other");
  const hint = other.locator(".cr-mode-hint");
  await expect(other).toHaveAttribute("tabindex", "0");
  await expect(other).toHaveAttribute("aria-label", "Other mode: RR_FourCard_Friendly");
  await expect(hint).toHaveText("RR_FourCard_Friendly");
  await expect(hint).toBeHidden();
  await other.hover();
  await expect(hint).toBeVisible();
  await page.mouse.move(0, 0);
  await page.locator("#cr-battle-scroll").focus();
  await page.keyboard.press("Tab");
  await expect(other).toBeFocused();
  await expect(hint).toBeVisible();
  expect(await scanForViolations(page, testInfo, "clash-other-mode-focus")).toEqual([]);

  const ladder = page.locator("#cr-battle-log .cr-battle-mode.is-ladder");
  const centeredStyles = await page.locator("#cr-battle-log .cr-battle-item").last().evaluate((row) => ({
    ladderBackground: getComputedStyle(row.querySelector(".cr-battle-mode")).backgroundColor,
    ladderColor: getComputedStyle(row.querySelector(".cr-battle-mode")).color,
    modePlaceSelf: getComputedStyle(row.querySelector(".cr-battle-mode")).placeSelf,
    resultAlignSelf: getComputedStyle(row.querySelector(".cr-result")).alignSelf,
    resultJustifySelf: getComputedStyle(row.querySelector(".cr-result")).justifySelf,
  }));
  await expect(ladder).toHaveText("Ladder");
  expect(centeredStyles).toEqual({
    ladderBackground: "rgb(73, 212, 214)",
    ladderColor: "rgb(17, 17, 17)",
    modePlaceSelf: "center",
    resultAlignSelf: "center",
    resultJustifySelf: "center",
  });
  const scrollHasNoHorizontalOverflow = await page.locator("#cr-battle-scroll").evaluate(
    (element) => element.scrollWidth <= element.clientWidth
  );
  expect(scrollHasNoHorizontalOverflow).toBe(true);
});

test("renders factual card metadata, safe variant artwork, and resilient image fallbacks", async ({ page }) => {
  const requestedCardImages = [];
  const trackedImages = [
    "https://api-assets.clashroyale.com/cards/broken.png",
    "https://api-assets.clashroyale.com/cards/safe.png",
    "https://api-assets.clashroyale.com/cards/evo-fallback.png",
    "https://api-assets.clashroyale.com/cardevolutions/300/evo-broken.png",
    "https://api-assets.clashroyale.com/cardheroes/300/hero.png",
  ];
  await page.route(trackedImages[0], (route) => {
    requestedCardImages.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/png", body: "not an image" });
  });
  await page.route("https://api-assets.clashroyale.com/cardevolutions/300/evo-broken.png", (route) => {
    requestedCardImages.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/png", body: "not an image" });
  });
  for (const url of [trackedImages[1], trackedImages[2], trackedImages[4]]) {
    await page.route(url, (route) => {
      requestedCardImages.push(route.request().url());
      return route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG });
    });
  }
  await page.route(API_URL, (route) =>
    successResponse(
      route,
      createPayload({
        currentDeck: [
          { id: 1, name: "Safe card", iconUrl: "https://api-assets.clashroyale.com/cards/safe.png", elixirCost: 2, rarity: "common" },
          { id: 2, name: "Broken card", iconUrl: "https://api-assets.clashroyale.com/cards/broken.png", elixirCost: 3, rarity: "epic" },
          { id: 3, name: "Unsafe card", iconUrl: "https://example.com/card.png" },
          { id: 4, name: "Insecure card", iconUrl: "http://api-assets.clashroyale.com/cards/insecure.png", variant: "hero" },
          {
            id: 5,
            name: "Evolution fallback",
            iconUrl: "https://api-assets.clashroyale.com/cards/evo-fallback.png",
            variant: "evo",
            variantIconUrl: "https://api-assets.clashroyale.com/cardevolutions/300/evo-broken.png",
          },
          {
            id: 6,
            name: "Hero artwork",
            iconUrl: "https://api-assets.clashroyale.com/cards/hero-fallback.png",
            variant: "hero",
            variantIconUrl: "https://api-assets.clashroyale.com/cardheroes/300/hero.png",
          },
          { id: 28000006, name: "Mirror", elixirCost: 1, rarity: "epic" },
          { id: 8, name: "Fractional", elixirCost: 3.5, rarity: "unknown", variant: "both" },
        ],
      })
    )
  );
  await openClashRoyale(page, { width: 768, height: 1024 });
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");

  const cards = page.locator("#cr-current-deck .cr-deck-card");
  await expect(cards).toHaveCount(8);
  await expect(cards.nth(0).locator("img")).toHaveAttribute("alt", "");
  await expect(cards.nth(1)).toHaveClass(/is-image-unavailable/);
  await expect(cards.nth(2)).toHaveClass(/is-image-unavailable/);
  await expect(cards.nth(3)).toHaveClass(/is-image-unavailable/);
  await expect(cards.nth(3).locator(".cr-deck-card-title .cr-card-variant")).toHaveText("HERO");
  await expect(cards.nth(4)).toHaveClass(/is-variant-evo/);
  await expect(cards.nth(4)).not.toHaveClass(/is-image-unavailable/);
  await expect(cards.nth(4).locator(".cr-card-variant")).toHaveText("EVO");
  await expect(cards.nth(5)).toHaveClass(/is-variant-hero/);
  await expect(cards.nth(5).locator(".cr-card-variant")).toHaveText("HERO");
  await expect(cards.nth(6).locator(".cr-card-elixir")).toHaveText("+1 variable elixir");
  await expect(cards.nth(7).locator(".cr-card-elixir")).toHaveText("Elixir unavailable");
  await expect(cards.nth(7).locator(".cr-card-variant")).toHaveCount(0);
  await expect(cards.nth(0)).toHaveClass(/is-rarity-common/);
  await expect(cards.nth(1)).toHaveClass(/is-rarity-epic/);
  expect(
    await cards.locator(".cr-card-rarity").evaluateAll((elements) =>
      elements.every((element) => element.classList.contains("visually-hidden"))
    )
  ).toBe(true);
  await expect(page.locator("#cr-deck-average")).toHaveText("Average elixir: unavailable");
  await expect(cards.locator(".cr-deck-card-name")).toHaveText([
    "Safe card",
    "Broken card",
    "Unsafe card",
    "Insecure card",
    "Evolution fallback",
    "Hero artwork",
    "Mirror",
    "Fractional",
  ]);
  expect(requestedCardImages.sort()).toEqual(trackedImages.sort());
  const mediaSizes = await cards.locator(".cr-deck-card-media").evaluateAll((elements) =>
    elements.map((element) => ({ height: element.offsetHeight, width: element.offsetWidth }))
  );
  expect(new Set(mediaSizes.map(({ height }) => height)).size).toBe(1);
  expect(mediaSizes.every(({ width }) => width > 0)).toBe(true);
  const cardOrder = await cards.first().evaluate((cardElement) =>
    [...cardElement.children].map((child) => child.className)
  );
  expect(cardOrder).toEqual([
    "cr-deck-card-title",
    "cr-deck-card-media",
    "cr-card-metadata",
  ]);

  const whiteInput = page.locator("#cr-deck-style-white");
  const raisedInput = page.locator("#cr-deck-style-raised");
  await expect(whiteInput).toBeChecked();
  await expect(page.getByText("White", { exact: true })).toBeVisible();
  await expect(page.getByText("Raised grey", { exact: true })).toBeVisible();
  expect(await cards.first().evaluate((cardElement) => getComputedStyle(cardElement).backgroundColor))
    .toBe("rgb(255, 255, 255)");
  await page.getByText("Raised grey", { exact: true }).click();
  await expect(raisedInput).toBeChecked();
  await expect(page.locator("#cr-current-deck")).toHaveClass(/is-raised/);
  const raisedStyle = await cards.first().evaluate((cardElement) => ({
    background: getComputedStyle(cardElement).backgroundColor,
    boxShadow: getComputedStyle(cardElement).boxShadow,
  }));
  expect(raisedStyle.background).toBe("rgb(192, 192, 192)");
  expect(raisedStyle.boxShadow).not.toBe("none");
  await page.getByText("White", { exact: true }).click();
  await expect(whiteInput).toBeChecked();
  await expect(page.locator("#cr-current-deck")).not.toHaveClass(/is-raised/);
  await raisedInput.focus();
  await expect(page.locator('label[for="cr-deck-style-raised"]')).toHaveCSS(
    "outline-style",
    "dotted"
  );
});

test("renders team context and loads participant deck images only after disclosure", async ({ page }) => {
  const participantImageRequests = [];
  await page.route(/^https:\/\/api-assets\.clashroyale\.com\/cards\/participant-.*\.png$/, (route) => {
    participantImageRequests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG });
  });
  const participantCard = (id, name, metadata = {}) => ({
    id,
    name,
    elixirCost: 3,
    rarity: "common",
    iconUrl: `https://api-assets.clashroyale.com/cards/participant-${id}.png`,
    ...metadata,
  });
  const teamBattle = {
    battleTime: "2026-10-01T10:30:00.000Z",
    type: "PvP",
    gameMode: { id: 72000014, name: "TeamVsTeam" },
    team: [
      {
        tag: "#28CYYU08P",
        name: "Rohin",
        crowns: 2,
        trophyChange: 0,
        cards: Array.from({ length: 12 }, (_, index) =>
          participantCard(
            101 + index,
            `Player card ${index + 1}`,
            index === 0 ? { variant: "hero" } : {}
          )
        ),
      },
      {
        tag: "#ALLY",
        name: "Trusted teammate",
        crowns: 2,
        cards: [participantCard(113, "Giant"), participantCard(114, "Arrows")],
      },
    ],
    opponent: [
      {
        tag: "#RIVAL1",
        name: "First rival",
        crowns: 1,
        cards: [participantCard(115, "Minions"), participantCard(116, "Zap")],
      },
      {
        tag: "#RIVAL2",
        name: "Second rival",
        crowns: 1,
        cards: [participantCard(117, "Cannon"), participantCard(118, "Fireball")],
      },
    ],
  };
  await page.route(API_URL, (route) =>
    successResponse(route, createPayload({ battles: [teamBattle] }))
  );
  await openClashRoyale(page, { width: 375, height: 812 });
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");

  const row = page.locator("#cr-battle-log .cr-battle-item");
  await expect(row.locator(".cr-battle-mode")).toHaveText("2v2");
  await expect(row.locator(".cr-battle-mode")).toHaveClass(/is-two-v-two/);
  await expect(row.locator(".cr-battle-opponent")).toHaveText(
    "Rohin & Trusted teammate vs. First rival & Second rival"
  );
  await expect(row.locator(".cr-battle-date")).toBeVisible();
  await expect(row.locator(".cr-battle-clock")).toBeVisible();
  await expect(page.locator("#cr-history-footer")).toHaveText(
    "Most recent 1 battle loaded. View Royale API for full list."
  );
  await expect(row.locator("details")).not.toHaveAttribute("open", "");
  expect(participantImageRequests).toEqual([]);
  const clashWindow = page.locator("#clash-royale-window");
  await clashWindow.locator('[data-close="clash-royale"]').click();
  await clashWindow.waitFor({ state: "hidden" });
  await page.locator('.taskbar-icon[data-app="clash-royale"]').click();
  await expect(clashWindow).toBeVisible();
  expect(participantImageRequests).toEqual([]);

  await row.locator("summary").click();
  await expect(row.locator("details")).toHaveAttribute("open", "");
  await expect(row.locator(".cr-battle-side-title")).toHaveText(["Your team", "Opponents"]);
  await expect(row.locator(".cr-participant-name")).toHaveText([
    "Rohin",
    "Trusted teammate",
    "First rival",
    "Second rival",
  ]);
  await expect.poll(() => participantImageRequests.length).toBe(18);
  await expect(row.locator(".cr-participant-deck").first().locator(".cr-deck-card")).toHaveCount(12);
  await expect(row.locator(".cr-participant-deck img")).toHaveCount(18);
  await expect(row.locator(".cr-participant-deck img").first()).not.toHaveAttribute("data-cr-card-src");
  const compactCardGeometry = await row.locator(".cr-deck-card--compact").first().evaluate((cardElement) => {
    const media = cardElement.querySelector(".cr-deck-card-media").getBoundingClientRect();
    const name = cardElement.querySelector(".cr-deck-card-name").getBoundingClientRect();
    return {
      background: getComputedStyle(cardElement).backgroundColor,
      boxShadow: getComputedStyle(cardElement).boxShadow,
      fontSize: getComputedStyle(cardElement).fontSize,
      mediaGridRow: getComputedStyle(cardElement).gridTemplateRows.split(" ")[1],
      nameToImageGap: Math.round(media.top - name.bottom),
      variantParentClass: cardElement.querySelector(".cr-card-variant").parentElement.className,
    };
  });
  expect(compactCardGeometry).toEqual({
    background: "rgb(192, 192, 192)",
    boxShadow: expect.not.stringMatching(/^none$/),
    fontSize: "8px",
    mediaGridRow: "46px",
    nameToImageGap: 0,
    variantParentClass: "cr-deck-card-media",
  });
  await row.locator("summary").click();
  await row.locator("summary").click();
  expect(participantImageRequests).toHaveLength(18);
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
  await expect(page.locator("#cr-status")).toBeVisible();
  await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "loading");
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
  await expect(page.locator("#cr-status")).toBeHidden();
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
    await expect(page.locator("#cr-history-footer a")).toHaveText("Royale API");
    await expect(page.locator("#cr-history-footer").locator("..")).toHaveAttribute(
      "id",
      "cr-battle-scroll"
    );
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
  await expect(page.locator("#cr-deck-average")).toHaveText("Average elixir: unavailable");
  await expect(page.locator("#cr-battle-log .cr-empty")).toHaveText(
    "No recent battles were returned."
  );
  await expect(page.locator("#cr-sample-summary")).toHaveText("No usable battles");
  await expect(page.locator("#cr-history-footer")).toHaveText(
    "No recent battles loaded. View Royale API for full list."
  );
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
