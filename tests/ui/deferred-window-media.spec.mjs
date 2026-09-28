import { expect, test } from "./fixtures.mjs";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";

test.setTimeout(150_000);

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
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

// The Admin preview activates a clone. Trigger Now exercises the live windows,
// including the preloader; the cold-path test below isolates their show callbacks.
const realTriggerEventIds = Object.freeze([
  "annoying-system-alert",
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
  "red-tool",
  "john-pork",
  "lain-system-alert",
  "soot-sprites",
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

    const triggerNow = adminWindow.locator("#admin-trigger-now");
    for (const eventId of realTriggerEventIds) {
      await eventList.selectOption(eventId);
      const previewWindow = eventPreview.locator(
        `[data-admin-event-preview-window="${eventId}"]`
      );
      const windowId = await previewWindow.getAttribute("id");
      expect(windowId, `${eventId} preview carries the window id`).toBeTruthy();
      await triggerNow.click();
      const liveWindow = page.locator(`#${windowId}:not([data-admin-event-preview-window])`);
      await expectDecodedImages(liveWindow, `live event ${eventId}`);
      await liveWindow.evaluate((windowElement) => {
        windowElement.classList.remove("is-opening", "is-closing");
        windowElement.classList.add("is-hidden");
        windowElement.setAttribute("aria-hidden", "true");
      });
      await expect(liveWindow).toBeHidden();
    }

    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.runtimeErrors).toEqual([]);
  });
}

// Trigger Now preloads the live node before calling definition.run. Exercise the
// same callbacks without that warm-up too, so a missing show-path loader fails.
for (const viewport of viewports) {
  test(`event show callbacks decode cold media at ${viewport.name}`, async ({ page }, testInfo) => {
    const source = await readIsolatedMainSource();
    const instrumented = source.replace(/\n\}\)\(\);\s*$/, `
window.__deferredMediaTest = Object.freeze({
  windowId: (id) => getAdminRandomEventPreviewSource(
    randomEventDefinitions.find((definition) => definition.id === id)
  )?.id,
  show: (id) => randomEventDefinitions.find((definition) => definition.id === id).run({
    triggerName: "adminControls", detail: { source: "media-test" }, admin: true,
  }),
});
})();
`);
    expect(instrumented).not.toBe(source);
    await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
      route.fulfill({ contentType: "application/javascript", body: instrumented })
    );
    const diagnostics = await preparePage(page, viewport);
    for (const eventId of realTriggerEventIds) {
      const windowId = await page.evaluate((id) => window.__deferredMediaTest.windowId(id), eventId);
      expect(windowId).toBeTruthy();
      const liveWindow = page.locator(`#${windowId}:not([data-admin-event-preview-window])`);
      await expect(liveWindow).toBeHidden();
      expect(await liveWindow.locator("img[data-src]:not([src])").count(),
        `${eventId} starts with cold media`).toBeGreaterThan(0);
      await page.evaluate((id) => window.__deferredMediaTest.show(id), eventId);
      await expectDecodedImages(liveWindow, `cold event ${eventId}`);
      if (eventId === "rohin-os-note" || eventId === "lain-system-alert") {
        await testInfo.attach(`${eventId}-${viewport.name}`, {
          body: await page.screenshot(), contentType: "image/png",
        });
      }
      await liveWindow.evaluate((element) => {
        element.classList.remove("is-opening", "is-closing");
        element.classList.add("is-hidden");
        element.setAttribute("aria-hidden", "true");
      });
    }
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.runtimeErrors).toEqual([]);
  });
}
