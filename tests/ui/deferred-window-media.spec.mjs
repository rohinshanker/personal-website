import { expect, test } from "./fixtures.mjs";

test.setTimeout(150_000);

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "wide", width: 1440, height: 900 },
]);

const apiBaseUrl = "https://game-stats.test";
const administratorProof = `${"a".repeat(32)}.${"b".repeat(32)}`;
const affectedAppLaunches = Object.freeze([
  { appId: "study-resources", windowId: "study-resources" },
  { appId: "solitaire", windowId: "solitaire" },
  { appId: "game-progress", windowId: "game-progress" },
  { appId: "life-counter", windowId: "life-counter" },
  { appId: "video-editor", windowId: "video-editor" },
  { appId: "image-tools", windowId: "image-tools" },
]);
const affectedEventIds = Object.freeze([
  "annoying-system-alert",
  "debug-system-alert-power-cycle-reminder",
  "neko-stream-system-alert",
  "vanishing-popup-alert",
  "dodging-popup-alert",
  "self-love-system-alert",
  "rohin-os-update",
  "rohin-os-note",
  "earth-proverb-note",
  "health-note",
  "love-note",
  "mana-flood",
  "mimic-warning",
  "sudden-skill-check",
  "distress-signal",
  "stalker-zone",
  "midnight-gospel",
  "john-pork",
  "lain-system-alert",
  "gears-nest-clear",
  "human-instrumentality-project",
  "red-tool",
  "soot-sprites",
  "noble-steed",
  "lancer-battle",
]);

const configureAdministratorApi = async (page) => {
  await page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "${apiBaseUrl}", buildVersion: "sha256-${"a".repeat(64)}" });`,
    })
  );
  await page.route(`${apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/administrator/sign-in") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          profile: {
            id: "player-rohin-neko",
            name: "rohin ^.^",
            icon: "assets/neko-assets/sprites/yawn1.png",
          },
          proof: administratorProof,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: "{}" });
  });
};

const collectDiagnostics = (page) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  return { consoleErrors, runtimeErrors };
};

const preparePage = async (page, viewport) => {
  const diagnostics = collectDiagnostics(page);
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => 0.999999;
  });
  await configureAdministratorApi(page);
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.locator("#about-window").evaluate((windowElement) => {
    windowElement.classList.remove("is-opening", "is-closing");
    windowElement.classList.add("is-hidden");
    windowElement.setAttribute("aria-hidden", "true");
  });
  return diagnostics;
};

const expectDecodedImages = async (root, label) => {
  await expect(root, `${label} is visible`).toBeVisible();
  const images = root.locator("img[src], img[data-src]");
  expect(await images.count(), `${label} contains source-bearing images`).toBeGreaterThan(0);
  await expect
    .poll(
      () =>
        images.evaluateAll((elements) =>
          elements
            .filter((image) => image.naturalWidth <= 0)
            .map((image) => image.currentSrc || image.getAttribute("src") || image.dataset.src || "")
        ),
      { message: `${label} images decode`, timeout: 10_000 }
    )
    .toEqual([]);
};

const openDesktopApp = async (page, { appId, windowId }) => {
  await page.locator(`.desktop-icon[data-app="${appId}"]`).evaluate((button) => button.click());
  const win = page.locator(`[data-app-window="${windowId}"]`);
  await expectDecodedImages(win, windowId);
  await win.locator(`[data-close="${windowId}"]`).first().click();
  await expect(win).toBeHidden();
};

for (const viewport of viewports) {
  test(`hidden-window images decode when opened at ${viewport.name}`, async ({ page }) => {
    const diagnostics = await preparePage(page, viewport);

    const adminLauncher = page.locator('.desktop-icon[data-app="admin-controls"]');
    await adminLauncher.evaluate((button) => button.click());
    const adminStandIn = page.locator('[data-app-window="admin-controls-stand-in"]');
    await expectDecodedImages(adminStandIn, "admin-controls-stand-in");
    await adminStandIn.getByRole("button", { name: "OK", exact: true }).click();
    await expect(adminStandIn).toBeHidden();

    for (const app of affectedAppLaunches) {
      await openDesktopApp(page, app);
    }

    await page.locator('.desktop-icon[data-app="minesweeper"]').evaluate((button) => button.click());
    const minesweeper = page.locator('[data-app-window="minesweeper"]');
    await expect(minesweeper).toBeVisible();
    await minesweeper.getByRole("button", { name: "Help" }).click();
    const minesweeperControls = page.locator('[data-app-window="minesweeper-controls"]');
    await expectDecodedImages(minesweeperControls, "minesweeper-controls");
    await minesweeperControls.locator('[data-close="minesweeper-controls"]').click();
    await minesweeper.locator('[data-close="minesweeper"]').click();

    await page.locator('.desktop-icon[data-app="modeling"]').evaluate((button) => button.click());
    const modelingPrompt = page.locator('[data-app-window="modeling-launch"]');
    await expectDecodedImages(modelingPrompt, "modeling-launch");
    await modelingPrompt.getByRole("button", { name: "No", exact: true }).click();
    await page.locator('[data-app-window="modeling"] [data-close="modeling"]').click();

    await page.locator('.desktop-icon[data-app="cursor"]').evaluate((button) => button.click());
    const cursorWindow = page.locator('[data-app-window="cursor"]');
    await expectDecodedImages(cursorWindow, "cursor");
    await cursorWindow.locator("#cursor-settings-administrator").click();
    await page.locator("#administrator-username").fill("test-only-administrator");
    await page.locator("#administrator-password").fill("test-only-password");
    await page.locator("#administrator-sign-in").click();
    const administratorAlert = page.locator('[data-app-window="administrator-alert"]');
    await expectDecodedImages(administratorAlert, "administrator-alert");
    await administratorAlert.locator("#administrator-alert-close").click();
    await cursorWindow.locator('[data-close="cursor"]').click();

    await adminLauncher.evaluate((button) => button.click());
    const adminWindow = page.locator('[data-app-window="admin-controls"]');
    await expectDecodedImages(adminWindow, "admin-controls");
    await adminWindow.locator('[data-admin-tab="events"]').click();
    const eventList = adminWindow.locator("#admin-event-list");
    const eventPreview = adminWindow.locator("#admin-event-preview");
    for (const eventId of affectedEventIds) {
      await eventList.selectOption(eventId);
      await expectDecodedImages(
        eventPreview.locator(`[data-admin-event-preview-window="${eventId}"]`),
        `event preview ${eventId}`
      );
    }

    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.runtimeErrors).toEqual([]);
  });
}
