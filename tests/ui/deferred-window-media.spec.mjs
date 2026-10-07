import { expect, test } from "./deterministic.mjs";
import { REVIEW_VIEWPORTS, installGameStatsBackend } from "./helpers/rendered-site.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import { isolateProductionRandomEventPolicies } from "./helpers/random-event-debug.mjs";

test.setTimeout(190_000);

const viewports = REVIEW_VIEWPORTS;

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
  "evil-wizards-advertisement",
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
  "lancer-battle",
  "human-instrumentality-project",
  "evil-wizards-advertisement",
]);

const chainedWindowIds = Object.freeze([
  "skill-check-result-window",
  "distress-upload-window",
  "stalker-result-window",
  "midnight-gospel-meditation-window",
  "noble-steed-result-window",
  "serval-pizza-window",
  "dst-survive-window",
]);

const configureAdministratorApi = async (page) => {
  await installGameStatsBackend(page, {
    apiBaseUrl,
    buildVersion: `sha256-${"a".repeat(64)}`,
  });
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

const preparePage = async (page, viewport) => {
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
};

const expectDecodedImages = async (root, label, { expectPlaying = false } = {}) => {
  await expect(root, `${label} is visible`).toBeVisible();
  const images = root.locator("img[src], img[data-src]");
  // Only the looping event artwork this contract owns; other videos in a window
  // (a manual result clip, say) load on their own schedule.
  const videos = root.locator("video[data-loop-video]");
  const imageCount = await images.count();
  const videoCount = await videos.count();
  expect(imageCount + videoCount, `${label} contains source-bearing media`).toBeGreaterThan(0);

  if (imageCount) {
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
  }

  if (!videoCount) return;
  // A <video> with deferred sources only counts as loaded at readyState >= 2.
  await expect
    .poll(
      () =>
        videos.evaluateAll((elements) =>
          elements
            .filter((video) => video.readyState < 2)
            .map((video) => video.currentSrc || video.dataset.loopVideo || "")
        ),
      { message: `${label} videos decode a frame`, timeout: 15_000 }
    )
    .toEqual([]);
  if (!expectPlaying) return;
  await expect
    .poll(
      () =>
        videos.evaluateAll((elements) =>
          elements.filter((video) => video.paused).map((video) => video.dataset.loopVideo || "")
        ),
      { message: `${label} loops play while visible`, timeout: 15_000 }
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
    await preparePage(page, viewport);

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
      await expectDecodedImages(liveWindow, `live event ${eventId}`, { expectPlaying: true });
      await liveWindow.evaluate((windowElement) => {
        windowElement.classList.remove("is-opening", "is-closing");
        windowElement.classList.add("is-hidden");
        windowElement.setAttribute("aria-hidden", "true");
      });
      await expect(liveWindow).toBeHidden();
    }

  });
}

// Trigger Now preloads the live node before calling definition.run. Exercise the
// same callbacks without that warm-up too, so a missing show-path loader fails.
for (const viewport of viewports) {
  test(`event show callbacks decode cold media at ${viewport.name}`, async ({ page }, testInfo) => {
    await routeHomeScript(page, "adminOrchestrator", (source) =>
      source.replace(/\n\}\)\(\);\s*$/, `
window.__deferredMediaAdminTest = Object.freeze({
  windowId: (id) => getAdminRandomEventPreviewSource(
    randomEventDefinitions.find((definition) => definition.id === id)
  )?.id,
});
})();`)
    );
    await routeHomeScript(page, "eventRuntime", (source) =>
      source.replace(/\n\}\)\(\);\s*$/, `
window.__deferredMediaRuntimeTest = Object.freeze({
  show: (id) => randomEventDefinitions.find((definition) => definition.id === id).run({
    triggerName: "adminControls", detail: { source: "media-test" }, admin: true,
  }),
});
})();`)
    );
    await routeHomeScript(page, "eventSkillCheck", (source) =>
      source.replace(/\n\}\)\(\);\s*$/, `
window.__deferredMediaSkillCheckTest = () => showSkillCheckResultWindow(20);
})();`)
    );
    await routeHomeScript(page, "eventDistressSignal", (source) =>
      source.replace(/\n\}\)\(\);\s*$/, `
window.__deferredMediaDistressTest = showDistressUploadWindow;
})();`)
    );
    await routeHomeScript(page, "eventCreatures", (source) =>
      source.replace(/\n\}\)\(\);\s*$/, `
window.__deferredMediaCreaturesTest = Object.freeze({
  showStalker: showStalkerResultWindow,
  showServal: showServalPizzaWindow,
});
})();`)
    );
    await routeHomeScript(page, "eventPrompts", (source) =>
      isolateProductionRandomEventPolicies(source).replace(/\n\}\)\(\);\s*$/, `
window.__deferredMediaPromptsTest = Object.freeze({
  showMeditation: showMidnightGospelMeditationWindow,
  showNobleSteed: showNobleSteedResultWindow,
});
})();`)
    );
    await routeHomeScript(page, "eventDstNight", (source) =>
      source.replace(/\n\}\)\(\);\s*$/, `
window.__deferredMediaDstTest = showDstSurviveWindow;
})();`)
    );
    await preparePage(page, viewport);
    for (const eventId of realTriggerEventIds) {
      const windowId = await page.evaluate((id) => window.__deferredMediaAdminTest.windowId(id), eventId);
      expect(windowId).toBeTruthy();
      const liveWindow = page.locator(`#${windowId}:not([data-admin-event-preview-window])`);
      await expect(liveWindow).toBeHidden();
      expect(await liveWindow.locator("[data-src]:not([src])").count(),
        `${eventId} starts with cold media`).toBeGreaterThan(0);
      await page.evaluate((id) => window.__deferredMediaRuntimeTest.show(id), eventId);
      await expectDecodedImages(liveWindow, `cold event ${eventId}`, { expectPlaying: true });
      if (eventId === "rohin-os-note" || eventId === "lain-system-alert") {
        const screenshotPath = testInfo.outputPath(`${eventId}-${viewport.name}.png`);
        await page.screenshot({ path: screenshotPath, animations: "disabled" });
        await testInfo.attach(`${eventId}-${viewport.name}`, {
          path: screenshotPath, contentType: "image/png",
        });
      }
      await liveWindow.evaluate((element) => {
        element.classList.remove("is-opening", "is-closing");
        element.classList.add("is-hidden");
        element.setAttribute("aria-hidden", "true");
      });
    }
    for (const windowId of chainedWindowIds) {
      const liveWindow = page.locator(`#${windowId}:not([data-admin-event-preview-window])`);
      await expect(liveWindow).toBeHidden();
      expect(await liveWindow.locator("[data-src]:not([src])").count(),
        `${windowId} starts with cold media`).toBeGreaterThan(0);
      await page.evaluate((id) => ({
        "skill-check-result-window": window.__deferredMediaSkillCheckTest,
        "distress-upload-window": window.__deferredMediaDistressTest,
        "stalker-result-window": window.__deferredMediaCreaturesTest.showStalker,
        "midnight-gospel-meditation-window": window.__deferredMediaPromptsTest.showMeditation,
        "noble-steed-result-window": window.__deferredMediaPromptsTest.showNobleSteed,
        "serval-pizza-window": window.__deferredMediaCreaturesTest.showServal,
        "dst-survive-window": window.__deferredMediaDstTest,
      })[id](), windowId);
      await expectDecodedImages(liveWindow, `cold chained window ${windowId}`, {
        expectPlaying: true,
      });
      await liveWindow.locator("video[data-loop-video]").evaluateAll((videos) => {
        videos.forEach((video) => {
          if (!video.loop) throw new Error(`${video.dataset.loopVideo} does not loop`);
        });
      });
      await liveWindow.evaluate((element) => {
        element.classList.remove("is-opening", "is-closing");
        element.classList.add("is-hidden");
        element.setAttribute("aria-hidden", "true");
      });
      // Hiding the window stops its loops, per the carousel playback contract.
      await expect
        .poll(() =>
          liveWindow
            .locator("video[data-loop-video]")
            .evaluateAll((videos) => videos.filter((video) => !video.paused).length)
        )
        .toBe(0);
    }
  });
}
