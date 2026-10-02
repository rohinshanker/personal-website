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
      type: index === 1 ? "unknown" : "pathOfLegend",
      gameMode: index === 1
        ? { id: 72000529, name: "RR_FourCard_Friendly" }
        : { id: 72000464, name: "Ranked1v1_NewArena2" },
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
  await expect.poll(() => clashWindow.evaluate((element) => element.getAnimations().length)).toBe(0);
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

const hoverOtherModeHint = async (page, row) => {
  await page.locator("#cr-battle-scroll").scrollIntoViewIfNeeded();
  await row.evaluate((element) => {
    const scrollport = element.closest("#cr-battle-scroll");
    scrollport.scrollTop +=
      element.getBoundingClientRect().top - scrollport.getBoundingClientRect().top - 2;
  });
  const badge = row.locator(".cr-battle-mode.is-other");
  const hint = page.locator("#cr-mode-hint");
  await badge.hover();
  await expect(hint).toBeVisible();
  const bounds = await badge.boundingBox();
  const before = await hint.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2 + 3, bounds.y + bounds.height / 2 + 2);
  const after = await hint.boundingBox();
  expect(after.x - before.x).toBeCloseTo(3, 0);
  expect(after.y - before.y).toBeCloseTo(2, 0);
  await expect(hint).toBeVisible();
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

for (const viewport of REQUIRED_VIEWPORTS) {
  test(`renders success and long content without overflow at ${viewport.name}`, async ({
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
    await expect(page.locator("#cr-deck-average")).toHaveText("Average Elixir: 3.9");
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

    const otherRow = page.locator("#cr-battle-log .cr-battle-item").nth(1);
    const otherHint = page.locator("#cr-mode-hint");
    const otherTitle = otherRow.locator(".cr-battle-opponent");
    const beforeHint = await otherRow.evaluate((row) => ({
      badgeWidth: row.querySelector(".cr-battle-mode").getBoundingClientRect().width,
      titleWidth: row.querySelector(".cr-battle-opponent").getBoundingClientRect().width,
    }));
    await hoverOtherModeHint(page, otherRow);
    const afterHint = await otherRow.evaluate((row) => ({
      badgeWidth: row.querySelector(".cr-battle-mode").getBoundingClientRect().width,
      titleWidth: row.querySelector(".cr-battle-opponent").getBoundingClientRect().width,
    }));
    expect(afterHint.badgeWidth, viewport.name).toBeCloseTo(beforeHint.badgeWidth, 4);
    expect(afterHint.titleWidth, viewport.name).toBeCloseTo(beforeHint.titleWidth, 1);
    await expect(otherTitle).toHaveText("Rohin vs. Recent opponent 2");
    await page.mouse.move(0, 0);
    await expect(otherHint).toBeHidden();
    await page.locator("#cr-battle-scroll").evaluate((element) => { element.scrollTop = 0; });

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

      const mobileDeckGeometry = await page.locator("#cr-current-deck").evaluate((deck) => {
        const cards = [...deck.querySelectorAll(".cr-deck-card")];
        const wordLineCounts = cards.flatMap((card) => {
          const name = card.querySelector(".cr-deck-card-name");
          const textNode = name.firstChild;
          return [...textNode.textContent.matchAll(/\S+/g)].map((match) => {
            const range = document.createRange();
            range.setStart(textNode, match.index);
            range.setEnd(textNode, match.index + match[0].length);
            return range.getClientRects().length;
          });
        });
        const mediaTops = cards.map((card) =>
          Math.round(card.querySelector(".cr-deck-card-media").getBoundingClientRect().top * 10)
        );
        return {
          allWordsStayOnOneLine: wordLineCounts.every((lineCount) => lineCount === 1),
          artworkAligned:
            new Set(mediaTops.slice(0, 4)).size === 1 &&
            new Set(mediaTops.slice(4, 8)).size === 1,
          titlesFit: cards.every((card) => {
            const title = card.querySelector(".cr-deck-card-title");
            return title.scrollWidth <= title.clientWidth && title.scrollHeight <= title.clientHeight;
          }),
        };
      });
      expect(mobileDeckGeometry, viewport.name).toEqual({
        allWordsStayOnOneLine: true,
        artworkAligned: true,
        titlesFit: true,
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
  });
}

for (const viewport of REQUIRED_VIEWPORTS) {
  test(`first title-bar press preserves the window position at ${viewport.name}`, async ({ page }) => {
    await page.route(API_URL, (route) => successResponse(route));
    const win = await openClashRoyale(page, viewport);
    const titleBar = win.locator(".title-bar");
    const centered = await win.boundingBox();
    for (let opening = 0; opening < 3; opening += 1) {
      if (opening > 0) {
        await win.locator('[data-close="clash-royale"]').click();
        await expect(win).toBeHidden();
        if (opening === 2) {
          // Freeze the real opening animation while the title bar is visible.
          await page.evaluate(() => {
            document.querySelector('.taskbar-icon[data-app="clash-royale"]').click();
            const animation = document.querySelector("#clash-royale-window")
              .getAnimations().find((entry) => entry.animationName === "retro-window-open");
            animation.pause();
            animation.currentTime = 210;
          });
          await expect(win).toHaveClass(/is-opening/);
        } else {
          await page.locator('.taskbar-icon[data-app="clash-royale"]').click();
          await expect(win).not.toHaveClass(/is-opening/);
        }
      }
      const before = opening === 2 ? centered : await win.boundingBox();
      const title = await titleBar.boundingBox();
      const pointer = { x: title.x + 100, y: title.y + title.height / 2 };
      await page.mouse.move(pointer.x, pointer.y);
      await page.mouse.down();
      expect(await win.boundingBox()).toEqual(before);
      // Holding the bar without moving must preserve the original position too.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      expect(await win.boundingBox()).toEqual(before);
      await page.mouse.move(pointer.x + 8, pointer.y + 20);
      await expect.poll(async () => (await win.boundingBox()).x).toBeCloseTo(before.x + 8, 0);
      await expect.poll(async () => (await win.boundingBox()).y).toBeCloseTo(before.y + 20, 0);
      await page.mouse.up();
      const released = await win.boundingBox();
      await page.mouse.down();
      expect(await win.boundingBox()).toEqual(released);
      await page.mouse.up();
      expect(await win.boundingBox()).toEqual(released);
    }
  });
}

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

const MATCH_MODES = [
  { type: "PvP", gameMode: { id: 72000006, name: "Ladder" }, label: "Ladder" },
  { type: "pathOfLegend", gameMode: { id: 72000464, name: "Ranked1v1_NewArena2" }, label: "Ranked" },
  { type: "riverRacePvP", gameMode: { id: 72000268, name: "CW_Battle_1v1" }, label: "Clan War" },
  { type: "riverRaceDuelColosseum", gameMode: { id: 72000267, name: "CW_Duel_1v1" }, label: "Clan War" },
  { type: "challenge", label: "Challenge" },
  { type: "friendly", gameMode: { id: 72000007, name: "Friendly" }, label: "Friendly" },
  { type: "casual2v2", gameMode: { id: 72000014, name: "2v2" }, label: "2v2" },
  { type: "unknown", gameMode: { id: 72000529, name: "RR_FourCard_Friendly" }, label: "Other" },
];

const createModeBattles = () => MATCH_MODES.map((mode, index) => ({
  ...createBattles(1)[0], ...mode,
  gameMode: mode.gameMode,
  team: [{ tag: "#28CYYU08P", name: "Rohin", crowns: index % 3, cards: [] }],
  opponent: [{ tag: `#RIVAL${index}`, name: "Opponent", crowns: 1, cards: [] }],
}));

for (const viewport of REQUIRED_VIEWPORTS) {
  test(`centers equal-height badges and floats every raw match hint at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.route(API_URL, (route) => successResponse(route, createPayload({ battles: createModeBattles() })));
    await openClashRoyale(page, viewport);
    await expect(page.locator("#cr-status")).toHaveAttribute("data-state", "success");
    const rows = page.locator("#cr-battle-log .cr-battle-item");
    const hint = page.locator("#cr-mode-hint");
    for (const [index, mode] of MATCH_MODES.entries()) {
      const row = rows.nth(index);
      const badge = row.locator(".cr-battle-mode");
      const raw = mode.gameMode?.name ?? mode.type;
      await expect(badge).toHaveText(mode.label);
      await expect(badge).not.toHaveAttribute("title", /.+/);
      await badge.scrollIntoViewIfNeeded();
      const before = await row.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        listHeight: element.parentElement.getBoundingClientRect().height,
        scrollHeight: element.closest("#cr-battle-scroll").scrollHeight,
        titleWidth: element.querySelector(".cr-battle-opponent").getBoundingClientRect().width,
        badges: [...element.querySelectorAll(".cr-result, .cr-battle-mode")].map((badge) => {
          const box = badge.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(badge);
          const text = range.getBoundingClientRect();
          return { height: box.height, dx: text.x + text.width / 2 - box.x - box.width / 2,
            dy: text.y + text.height / 2 - box.y - box.height / 2 };
        }),
      }));
      const gaps = await row.evaluate((element) => {
        const result = element.querySelector(".cr-result").getBoundingClientRect();
        const mode = element.querySelector(".cr-battle-mode").getBoundingClientRect();
        const title = element.querySelector(".cr-battle-opponent").getBoundingClientRect();
        return { badges: mode.left - result.right, text: title.left - mode.right };
      });
      expect(gaps.badges).toBeCloseTo(gaps.text, 4);
      expect(gaps.badges).toBe(viewport.width <= 640 ? 4 : 6);
      for (const geometry of before.badges) {
        expect(geometry.height).toBe(26);
        expect(Math.abs(geometry.dx)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry.dy)).toBeLessThanOrEqual(2);
      }
      await badge.hover();
      await expect(hint).toHaveText(raw);
      await expect(hint).toBeVisible();
      await expect(badge).toHaveAttribute("aria-describedby", "cr-mode-hint");
      const box = await badge.boundingBox();
      const firstHint = await hint.boundingBox();
      await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2 + 2);
      const secondHint = await hint.boundingBox();
      expect(secondHint.x - firstHint.x).toBeCloseTo(3, 0);
      expect(secondHint.y - firstHint.y).toBeCloseTo(2, 0);
      const after = await row.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        listHeight: element.parentElement.getBoundingClientRect().height,
        scrollHeight: element.closest("#cr-battle-scroll").scrollHeight,
        titleWidth: element.querySelector(".cr-battle-opponent").getBoundingClientRect().width,
      }));
      expect(after).toEqual({ height: before.height, listHeight: before.listHeight,
        scrollHeight: before.scrollHeight, titleWidth: before.titleWidth });
      expect(secondHint.x).toBeGreaterThanOrEqual(4);
      expect(secondHint.x + secondHint.width).toBeLessThanOrEqual(viewport.width - 4);
      expect(secondHint.y + secondHint.height).toBeLessThanOrEqual(viewport.height - 4);
      await page.keyboard.press("Escape");
      await expect(hint).toBeHidden();
      await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2 + 3);
      await expect(hint).toBeHidden();
      await page.mouse.move(0, 0);
      await badge.focus();
      await expect(hint).toBeVisible();
      await expect(hint).toHaveText(raw);
      await page.keyboard.press("Escape");
      await expect(hint).toBeHidden();
      await expect(badge).toBeFocused();
      await page.locator("#cr-battle-scroll").focus();
    }
    const warBadge = rows.nth(2).locator(".cr-battle-mode");
    await warBadge.hover();
    await page.screenshot({ path: testInfo.outputPath(`clash-match-hints-${viewport.name}.png`) });
    expect(await scanForViolations(page, testInfo, `clash-match-hints-${viewport.name}`)).toEqual([]);
    expect(await page.locator("#cr-battle-scroll").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

test("bounds long match hints and clears them on scroll, refresh, blur, resize and close", async ({ page }) => {
  const battles = createModeBattles();
  battles[0].gameMode.name = "Raw_<script>_" + "LongUnbrokenModeName".repeat(30);
  await page.route(API_URL, (route) => successResponse(route, createPayload({ battles })));
  const clashWindow = await openClashRoyale(page, { width: 375, height: 812 });
  const badge = () => page.locator(".cr-battle-mode").first();
  const hint = page.locator("#cr-mode-hint");
  await badge().hover();
  await expect(hint).toHaveText(battles[0].gameMode.name);
  await expect(hint.locator("script")).toHaveCount(0);
  const bounds = await hint.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(4);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(371);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(808);
  await page.locator("#cr-battle-scroll").evaluate((element) => { element.scrollTop += 20; });
  await expect(hint).toBeHidden();
  await badge().focus();
  await expect(hint).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(".cr-battle-mode").nth(1)).toBeFocused();
  await expect(hint).toHaveText("Ranked1v1_NewArena2");
  await page.locator("#cr-battle-scroll").focus();
  await expect(hint).toBeHidden();
  await badge().hover();
  await page.setViewportSize({ width: 376, height: 812 });
  await expect(hint).toBeHidden();
  await page.mouse.move(0, 0);
  await badge().hover();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(hint).toBeHidden();
  await page.mouse.move(0, 0);
  await badge().hover();
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(hint).toBeHidden();
  await page.mouse.move(0, 0);
  await badge().hover();
  await page.evaluate(() => window.ClashRoyaleApp.load(true));
  await expect(hint).toBeHidden();
  await expect(hint).toHaveCount(1);
  await page.mouse.move(0, 0);
  await badge().hover();
  await clashWindow.locator('[data-close="clash-royale"]').click();
  await expect(hint).toBeHidden();
  await page.locator('.taskbar-icon[data-app="clash-royale"]').click();
  await expect(hint).toBeHidden();
  await badge().dispatchEvent("pointerenter", { pointerType: "touch" });
  await expect(hint).toBeHidden();
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
  await expect(cards.nth(0).locator(".cr-deck-card-image")).toHaveAttribute("alt", "");
  await expect(cards.nth(1)).toHaveClass(/is-image-unavailable/);
  await expect(cards.nth(2)).toHaveClass(/is-image-unavailable/);
  await expect(cards.nth(3)).toHaveClass(/is-image-unavailable/);
  await expect(cards.nth(3).locator(".cr-deck-card-title .cr-card-variant")).toHaveText("HERO");
  await expect(cards.nth(4)).toHaveClass(/is-variant-evo/);
  await expect(cards.nth(4)).not.toHaveClass(/is-image-unavailable/);
  await expect(cards.nth(4).locator(".cr-card-variant")).toHaveText("EVO");
  await expect(cards.nth(5)).toHaveClass(/is-variant-hero/);
  await expect(cards.nth(5).locator(".cr-card-variant")).toHaveText("HERO");
  await expect(cards.nth(6).locator(".cr-card-elixir")).toHaveText("+1 variable");
  await expect(cards.nth(7).locator(".cr-card-elixir")).toHaveText("—");
  await expect(cards.nth(7).locator(".cr-card-variant")).toHaveCount(0);
  await expect(cards.nth(0)).toHaveClass(/is-rarity-common/);
  await expect(cards.nth(1)).toHaveClass(/is-rarity-epic/);
  expect(
    await cards.locator(".cr-card-rarity").evaluateAll((elements) =>
      elements.every((element) => element.classList.contains("visually-hidden"))
    )
  ).toBe(true);
  await expect(page.locator("#cr-deck-average")).toHaveText("Average Elixir: unavailable");
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

  await expect(cards.nth(6).locator(".cr-elixir-icon")).toHaveAccessibleName("elixir");
  await expect(cards.nth(7).locator(".cr-elixir-icon")).toHaveAccessibleName("Elixir unavailable");
  await expect(cards.first().locator(".cr-card-elixir")).toHaveText("2");
  await expect(cards.first().locator(".cr-elixir-icon")).toHaveAttribute(
    "src", "assets/pixelarticons/potion.svg"
  );
  await expect(page.locator("#cr-deck-average .cr-elixir-icon")).toHaveAttribute("alt", "");
  expect(await cards.locator(".cr-elixir-icon").evaluateAll((icons) =>
    icons.every((icon) => icon.complete && icon.naturalWidth > 0)
  )).toBe(true);

});

test("uses raised cards with stable pressed hover and nested player counter inlays", async ({ page }) => {
  await page.route(API_URL, (route) => successResponse(route));
  for (const viewport of [REQUIRED_VIEWPORTS[0], REQUIRED_VIEWPORTS[4]]) {
    await openClashRoyale(page, viewport);
    const cards = page.locator("#cr-current-deck .cr-deck-card");
    await expect(cards).toHaveCount(8);
    await expect(page.locator('input[name="cr-deck-style"]')).toHaveCount(0);
    await expect(page.locator("#cr-deck-average")).toHaveText("Average Elixir: 3.9");
    await cards.first().scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const geometry = () => cards.evaluateAll((items) => items.map((item) => {
      const bounds = item.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    }));
    const restGeometry = await geometry();
    const restShadow = await cards.first().evaluate((item) => getComputedStyle(item).boxShadow);
    const restGlow = await cards.first().locator(".cr-deck-card-media").evaluate(
      (item) => getComputedStyle(item).filter
    );
    await expect(cards.first()).toHaveCSS("background-color", "rgb(192, 192, 192)");
    const sunkenShadow = await page.locator(".cr-player-panel").evaluate(
      (item) => getComputedStyle(item).boxShadow
    );
    await cards.first().hover();
    await expect(cards.first()).toHaveCSS("box-shadow", sunkenShadow);
    expect(sunkenShadow).not.toBe(restShadow);
    expect(await geometry()).toEqual(restGeometry);
    await expect(cards.first().locator(".cr-deck-card-media")).toHaveCSS("filter", restGlow);
    await page.mouse.down();
    await expect(cards.first()).toHaveCSS("box-shadow", sunkenShadow);
    expect(await geometry()).toEqual(restGeometry);
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await expect(cards.first()).toHaveCSS("box-shadow", restShadow);
    await expect(page.locator(".cr-player-panel")).toHaveCSS("border-top-width", "2px");
    const counterFrames = page.locator(".cr-stat .cr-digit-value");
    await expect(counterFrames).toHaveCount(4);
    for (const frame of await counterFrames.all()) {
      await expect(frame).toHaveCSS("box-shadow", sunkenShadow);
      expect(await frame.evaluate((element) => {
        const frameBounds = element.getBoundingClientRect();
        const strip = element.querySelector(".cr-digit-strip").getBoundingClientRect();
        const value = element.closest("dd");
        return strip.left >= frameBounds.left + 3 && strip.top >= frameBounds.top + 3 &&
          strip.right <= frameBounds.right - 3 && strip.bottom <= frameBounds.bottom - 3 &&
          value.scrollWidth <= value.clientWidth;
      })).toBe(true);
    }
    await expect(page.locator(".cr-stat").first()).toHaveCSS("box-shadow", sunkenShadow);
  }
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
  await expect(row.locator(".cr-participant-deck .cr-deck-card-image")).toHaveCount(18);
  await expect(row.locator(".cr-participant-deck .cr-deck-card-image").first()).not.toHaveAttribute("data-cr-card-src");
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
  await expect(page.locator("#cr-deck-average")).toHaveText("Average Elixir: unavailable");
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
