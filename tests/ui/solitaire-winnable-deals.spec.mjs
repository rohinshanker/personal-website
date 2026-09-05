import { expect, test } from "./fixtures.mjs";

const API_BASE_URL = "https://personal-site-game-stats.rohinshankerme.workers.dev";
const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
];

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
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers,
        body: JSON.stringify({ ok: true, applied: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        totals: {},
        playerTotals: {},
        leaderboards: {},
        playerRanks: {},
        playerRecords: {},
      }),
    });
  });
  return { eventRequests, sessionRequests };
};

const openSolitaire = async (page, viewport) => {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const api = await installGameStatsApi(page);
  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page
    .locator('.desktop-icon[data-app="solitaire"]')
    .evaluate((button) => button.click());
  await expect(page.locator('[data-app-window="solitaire"]')).toBeVisible();
  return api;
};

const expectStandardInitialBoard = async (page) => {
  const columns = page.locator("#sol-tableau .sol-tableau-col");
  await expect(columns).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    await expect(columns.nth(index).locator(".sol-card")).toHaveCount(index + 1);
    await expect(
      columns.nth(index).locator(".sol-card:not(.is-face-down)")
    ).toHaveCount(1);
  }
  await expect(page.locator("#sol-tableau .sol-card.is-face-down")).toHaveCount(
    21
  );
  await expect(page.locator("#sol-stock")).toHaveAttribute(
    "aria-label",
    "Stock, 24 cards"
  );
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste");
  await expect(page.locator("[data-sol-foundation] .sol-card")).toHaveCount(0);
  await expect(page.locator("#sol-undo")).toBeDisabled();
};

for (const viewport of viewports) {
  test(`a guaranteed Solitaire deal renders correctly at ${viewport.name}`, async ({
    page,
  }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await openSolitaire(page, viewport);
    await expectStandardInitialBoard(page);

    const geometry = await page.locator(".sol-app").evaluate((app) => {
      const rect = app.getBoundingClientRect();
      return {
        appOverflow: app.scrollWidth - app.clientWidth,
        left: rect.left,
        right: rect.right,
        viewportWidth: window.innerWidth,
      };
    });
    expect(geometry.appOverflow).toBeLessThanOrEqual(1);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);

    await page.locator("#sol-help").click();
    const rulesWindow = page.locator('[data-app-window="solitaire-rules"]');
    await expect(rulesWindow).toBeVisible();
    await expect(
      rulesWindow.getByText(
        "Every new deal has at least one winning path with draw-one stock and unlimited redeals."
      )
    ).toBeVisible();
    const rulesGeometry = await rulesWindow.evaluate((windowElement) => {
      const rect = windowElement.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });
    expect(rulesGeometry.left).toBeGreaterThanOrEqual(0);
    expect(rulesGeometry.top).toBeGreaterThanOrEqual(0);
    expect(rulesGeometry.right).toBeLessThanOrEqual(rulesGeometry.viewportWidth + 1);
    expect(rulesGeometry.bottom).toBeLessThanOrEqual(rulesGeometry.viewportHeight + 1);
    expect(runtimeErrors).toEqual({ consoleErrors: [], pageErrors: [] });
  });
}

test("a generated Solitaire deal wins through the public controls", async ({
  page,
}) => {
  test.setTimeout(45_000);
  const runtimeErrors = collectRuntimeErrors(page);
  await page.addInitScript(() => {
    Math.random = () => 1 - Number.EPSILON;
    localStorage.setItem(
      "personalSitePlayerProfileV1",
      JSON.stringify({
        id: "player-solitaire-winnable",
        name: "Deal Verifier",
        icon: "assets/app-icons/ico/user_card.ico",
        rerollCount: 0,
      })
    );
  });
  const api = await openSolitaire(page, { width: 1280, height: 800 });
  await expectStandardInitialBoard(page);

  const stock = page.locator("#sol-stock");
  await expect(stock).toHaveAccessibleName("Stock, 24 cards");
  await expect(page.locator('[data-sol-foundation="spades"]')).toHaveAccessibleName(
    "Spades foundation"
  );
  await expect(page.locator("#sol-tableau .sol-tableau-col").first()).toHaveAccessibleName(
    /Tableau column 1, bottom card .+/
  );
  await expect(
    page.locator('#sol-tableau [data-sol-zone="tableau"]:not(.is-face-down)').first()
  ).toHaveAccessibleName(/.+ of .+/);

  await stock.focus();
  await expect(stock).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => api.sessionRequests.length).toBe(1);
  expect(
    await page
      .locator("#sol-moves img")
      .evaluateAll((images) => images.map((img) => img.alt))
  ).toEqual(["0", "0", "1"]);
  await expect(page.locator("#sol-undo")).toBeEnabled();

  await page
    .locator('#sol-tableau [data-sol-zone="tableau"]:not(.is-face-down)')
    .first()
    .click();
  await expect(page.locator("#sol-tableau .sol-card.is-selected")).toHaveCount(1);

  const reset = page.locator("#sol-reset");
  await reset.focus();
  await expect(reset).toBeFocused();
  await page.keyboard.press("Space");
  await expectStandardInitialBoard(page);
  expect(
    await page
      .locator("#sol-moves img")
      .evaluateAll((images) => images.map((img) => img.alt))
  ).toEqual(["0", "0", "0"]);
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
  await expect(page.locator("#sol-undo")).toBeEnabled();

  const result = await page.evaluate(() => {
    const suits = ["spades", "clubs", "diamonds", "hearts"];
    let stockActions = 0;
    let foundationMoves = 0;

    const visibleSourceCard = (id) =>
      [...document.querySelectorAll(`[data-sol-card-id="${id}"]`)].find(
        (card) =>
          !card.classList.contains("is-face-down") &&
          ["tableau", "waste"].includes(card.dataset.solZone)
      );

    const moveToFoundation = (id) => {
      const firstClickTarget = visibleSourceCard(id);
      if (!firstClickTarget) throw new Error(`No visible source card for ${id}`);
      firstClickTarget.click();
      const secondClickTarget = visibleSourceCard(id);
      if (!secondClickTarget) throw new Error(`Card ${id} vanished after selection`);
      secondClickTarget.click();
      foundationMoves += 1;
    };

    suits.forEach((suit) => {
      for (let rank = 1; rank <= 13; rank += 1) {
        const id = `${suit}-${rank}`;
        let card = visibleSourceCard(id);
        let targetStockActions = 0;
        while (!card) {
          document.getElementById("sol-stock").click();
          stockActions += 1;
          targetStockActions += 1;
          if (targetStockActions > 25) {
            throw new Error(`Card ${id} was not reachable in one stock pass`);
          }
          card = visibleSourceCard(id);
        }
        moveToFoundation(id);
        const foundationTop = document.querySelector(
          `[data-sol-foundation="${suit}"] [data-sol-card-id]`
        );
        if (foundationTop?.dataset.solCardId !== id) {
          throw new Error(`Card ${id} did not move to its foundation`);
        }
      }
    });

    return { foundationMoves, stockActions };
  });

  expect(result.foundationMoves).toBe(52);
  expect(result.foundationMoves + result.stockActions).toBeLessThanOrEqual(375);
  await expect(page.locator("[data-sol-foundation] [data-sol-card-id$='-13']")).toHaveCount(
    4
  );
  await expect(page.locator("#sol-victory-video-overlay")).toHaveAttribute(
    "aria-hidden",
    "false"
  );
  await expect.poll(() => api.eventRequests.length).toBe(1);
  expect(api.eventRequests[0].session).toEqual({
    id: "session-solitaire-winnable-2",
    token: "session-solitaire-winnable-token-2",
  });

  await page.locator("#sol-reset").evaluate((button) => button.click());
  await expectStandardInitialBoard(page);
  await expect(page.locator("#sol-victory-video-overlay")).toHaveAttribute(
    "aria-hidden",
    "true"
  );
  expect(runtimeErrors).toEqual({ consoleErrors: [], pageErrors: [] });
});
