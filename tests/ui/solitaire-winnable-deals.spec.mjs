import { readFile } from "node:fs/promises";

import { expect, test } from "./fixtures.mjs";

const API_BASE_URL = "https://personal-site-game-stats.rohinshankerme.workers.dev";
const TEST_SEED = 2;
const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "mobile-boundary", width: 640, height: 900 },
  { name: "desktop-boundary", width: 641, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
];

const mainSource = await readFile(
  new URL("../../scripts/home/main.js", import.meta.url),
  "utf8"
);
const sourceSection = (start, end) => {
  const startIndex = mainSource.indexOf(start);
  const endIndex = mainSource.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Missing ${start} source`);
  return mainSource.slice(startIndex, endIndex);
};
const findWinningMoves = new Function(`
  ${sourceSection("const solSuitOrder =", "const solRankNames =")}
  ${sourceSection("const solBuildDeck =", "const solCloneCards =")}
  return solFindWinningMoves;
`)();
const seededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};
const buildDomDeal = (tableauIds) => {
  const tableauIdSet = new Set(tableauIds.flat());
  const cards = ["spades", "clubs", "diamonds", "hearts"].flatMap((suit) =>
    Array.from({ length: 13 }, (_, index) => ({
      id: `${suit}-${index + 1}`,
      suit,
      rank: index + 1,
      faceUp: false,
    }))
  );
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const tableau = tableauIds.map((columnIds) => columnIds.map((id, index) => ({
    ...cardsById.get(id),
    faceUp: index === columnIds.length - 1,
  })));
  return { stock: cards.filter((card) => !tableauIdSet.has(card.id)), tableau };
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

const installGameStatsApi = async (page) => {
  const sessionRequests = [];
  const eventRequests = [];
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname === "/sessions") {
      sessionRequests.push(JSON.parse(request.postData() || "{}"));
      const sequence = sessionRequests.length;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers,
        body: JSON.stringify({
          id: `session-solitaire-winnable-${sequence}`,
          token: `session-solitaire-winnable-token-${sequence}`,
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        }),
      });
      return;
    }
    if (url.pathname === "/events") {
      eventRequests.push(JSON.parse(request.postData() || "{}"));
      await route.fulfill({ status: 201, contentType: "application/json", headers,
        body: JSON.stringify({ ok: true, applied: true }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: JSON.stringify({ generatedAt: new Date().toISOString(), totals: {},
        playerTotals: {}, leaderboards: {}, playerRanks: {}, playerRecords: {} }),
    });
  });
  return { eventRequests, sessionRequests };
};

const installSeed = async (page, includeProfile = false) => {
  await page.addInitScript(({ seed, profile }) => {
    let state = seed >>> 0;
    Math.random = () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    if (profile) {
      localStorage.setItem("personalSitePlayerProfileV1", JSON.stringify({
        id: "player-solitaire-winnable",
        name: "Deal Verifier",
        icon: "assets/app-icons/ico/user_card.ico",
        rerollCount: 0,
      }));
    }
  }, { seed: TEST_SEED, profile: includeProfile });
};

const openSolitaire = async (page, viewport) => {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const api = await installGameStatsApi(page);
  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page.locator('.desktop-icon[data-app="solitaire"]').evaluate((button) => button.click());
  await expect(page.locator('[data-app-window="solitaire"]')).toBeVisible();
  return api;
};

const expectStandardInitialBoard = async (page) => {
  const columns = page.locator("#sol-tableau .sol-tableau-col");
  await expect(columns).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    await expect(columns.nth(index).locator(".sol-card")).toHaveCount(index + 1);
    await expect(columns.nth(index).locator(".sol-card:not(.is-face-down)")).toHaveCount(1);
  }
  await expect(page.locator("#sol-tableau .sol-card.is-face-down")).toHaveCount(21);
  await expect(page.locator("#sol-stock")).toHaveAttribute("aria-label", "Stock, 24 cards");
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste");
  await expect(page.locator("[data-sol-foundation] .sol-card")).toHaveCount(0);
  await expect(page.locator("#sol-undo")).toBeDisabled();
};

for (const viewport of viewports) {
  test(`a solver-checked Solitaire deal renders correctly at ${viewport.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    const runtimeErrors = collectRuntimeErrors(page);
    await installSeed(page);
    await openSolitaire(page, viewport);
    await expectStandardInitialBoard(page);
    const geometry = await page.locator(".sol-app").evaluate((app) => {
      const rect = app.getBoundingClientRect();
      return { appOverflow: app.scrollWidth - app.clientWidth, left: rect.left,
        right: rect.right, viewportWidth: window.innerWidth };
    });
    expect(geometry.appOverflow).toBeLessThanOrEqual(1);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);

    await page.locator("#sol-help").click();
    const rulesWindow = page.locator('[data-app-window="solitaire-rules"]');
    await expect(rulesWindow).toBeVisible();
    await expect(rulesWindow.getByText("Every new deal is a random shuffle that a built-in solver has checked for at least one winning path with draw-one stock and unlimited redeals.")).toBeVisible();
    const rulesGeometry = await rulesWindow.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top,
        viewportHeight: window.innerHeight, viewportWidth: window.innerWidth };
    });
    expect(rulesGeometry.left).toBeGreaterThanOrEqual(0);
    expect(rulesGeometry.top).toBeGreaterThanOrEqual(0);
    expect(rulesGeometry.right).toBeLessThanOrEqual(rulesGeometry.viewportWidth + 1);
    expect(rulesGeometry.bottom).toBeLessThanOrEqual(rulesGeometry.viewportHeight + 1);
    expect(runtimeErrors).toEqual({ consoleErrors: [], pageErrors: [] });
  });
}

test("a generated Solitaire deal wins through the public controls", async ({ page }) => {
  test.setTimeout(60_000);
  const runtimeErrors = collectRuntimeErrors(page);
  await installSeed(page, true);
  const api = await openSolitaire(page, { width: 1280, height: 800 });
  await expectStandardInitialBoard(page);

  const stock = page.locator("#sol-stock");
  await expect(stock).toHaveAccessibleName("Stock, 24 cards");
  await expect(page.locator('[data-sol-foundation="spades"]')).toHaveAccessibleName("Spades foundation");
  await expect(page.locator("#sol-tableau .sol-tableau-col").first()).toHaveAccessibleName(/Tableau column 1, bottom card .+/);
  await expect(page.locator('#sol-tableau [data-sol-zone="tableau"]:not(.is-face-down)').first()).toHaveAccessibleName(/.+ of .+/);

  await stock.focus();
  await expect(stock).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => api.sessionRequests.length).toBe(1);
  expect(await page.locator("#sol-moves img").evaluateAll((images) => images.map((img) => img.alt))).toEqual(["0", "0", "1"]);
  await expect(page.locator("#sol-undo")).toBeEnabled();
  await page.locator('#sol-tableau [data-sol-zone="tableau"]:not(.is-face-down)').first().click();
  await expect(page.locator("#sol-tableau .sol-card.is-selected")).toHaveCount(1);

  // An exposed Ace swaps Reset for the auto-solve check; run it first so
  // Reset returns, then reset through the keyboard.
  const autoSolve = page.locator("#sol-auto-solve");
  if (await autoSolve.isVisible()) {
    await autoSolve.click();
    await expect(page.locator("#sol-reset")).toBeVisible({ timeout: 15_000 });
  }
  const reset = page.locator("#sol-reset");
  await reset.focus();
  await expect(reset).toBeFocused();
  await page.keyboard.press("Space");
  await expectStandardInitialBoard(page);
  expect(await page.locator("#sol-moves img").evaluateAll((images) => images.map((img) => img.alt))).toEqual(["0", "0", "0"]);
  await expect(page.locator("#sol-tableau .sol-card.is-selected")).toHaveCount(0);
  expect(api.sessionRequests).toHaveLength(1);

  await stock.focus();
  await page.keyboard.press("Space");
  await expect.poll(() => api.sessionRequests.length).toBe(2);
  expect(
    await page
      .locator("#sol-moves img")
      .evaluateAll((images) => images.map((img) => img.alt))
  ).toEqual(["0", "0", "1"]);
  const undo = page.locator("#sol-undo");
  await expect(undo).toBeEnabled();
  await undo.click();
  await expectStandardInitialBoard(page);

  const replayTableau = await page.locator("#sol-tableau .sol-tableau-col").evaluateAll((columns) =>
    columns.map((column) => [...column.querySelectorAll("[data-sol-card-id]")]
      .map((card) => card.dataset.solCardId))
  );
  const replayDeal = buildDomDeal(replayTableau);
  const replaySolution = findWinningMoves(replayDeal, 12_000);
  if (!replaySolution) throw new Error("Seeded browser deal did not verify");

  const result = await page.evaluate((solution) => {
    let stockActions = 0;
    let foundationMoves = 0;
    let solutionMoves = 0;
    const wasteCardId = () => document.querySelector("#sol-waste [data-sol-card-id]")?.dataset.solCardId;
    const reachStockCard = (cardId) => {
      let actions = 0;
      while (wasteCardId() !== cardId) {
        document.getElementById("sol-stock").click();
        stockActions += 1;
        actions += 1;
        if (actions > 49) throw new Error(`Stock card ${cardId} was not reachable`);
      }
    };
    solution.forEach((move) => {
      if (move.from === "stock") reachStockCard(move.cardId);
      const source = move.from === "stock"
        ? document.querySelector(`#sol-waste [data-sol-card-id="${move.cardId}"]`)
        : document.querySelector(`#sol-tableau [data-sol-pile="${move.column}"][data-sol-index="${move.index ?? ""}"]`) ||
          document.querySelector(`#sol-tableau [data-sol-pile="${move.column}"]:last-child`);
      if (!source) throw new Error(`Missing source for ${JSON.stringify(move)}`);
      source.click();
      const target = move.type === "toFoundation"
        ? document.querySelector(`[data-sol-foundation="${source.getAttribute("aria-label").split(" of ").at(-1).toLowerCase()}"]`)
        : document.querySelector(`[data-sol-col="${move.toColumn ?? move.column}"]`);
      if (!target) throw new Error(`Missing target for ${JSON.stringify(move)}`);
      target.click();
      solutionMoves += 1;
      if (move.type === "toFoundation") foundationMoves += 1;
    });
    return { foundationMoves, solutionMoves, stockActions };
  }, replaySolution);

  expect(result.foundationMoves).toBe(52);
  expect(result.stockActions).toBeGreaterThan(0);
  const totalMoves = result.solutionMoves + result.stockActions;
  expect(totalMoves).toBeLessThanOrEqual(375);
  const renderedMoves = Number(
    (await page.locator("#sol-moves img").evaluateAll((images) =>
      images.map((image) => image.alt).join("")
    ))
  );
  expect(renderedMoves).toBe(totalMoves);
  await expect(page.locator("[data-sol-foundation] [data-sol-card-id$='-13']")).toHaveCount(4);
  await expect(page.locator("#sol-victory-video-overlay")).toHaveAttribute("aria-hidden", "false");
  await expect.poll(() => api.eventRequests.length).toBe(1);
  expect(api.eventRequests[0].session).toEqual({ id: "session-solitaire-winnable-2",
    token: "session-solitaire-winnable-token-2" });
  await page.locator("#sol-reset").evaluate((button) => button.click());
  await expectStandardInitialBoard(page);
  await expect(page.locator("#sol-victory-video-overlay")).toHaveAttribute("aria-hidden", "true");
  expect(runtimeErrors).toEqual({ consoleErrors: [], pageErrors: [] });
});
