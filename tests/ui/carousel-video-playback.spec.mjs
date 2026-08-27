import { readFile } from "node:fs/promises";

import { expect, test } from "./fixtures.mjs";

const TEST_VIDEO = await readFile(
  new URL(
    "../../assets/modeling/fast-reverie-rnwy-apr2024/01-runway-video.mp4",
    import.meta.url
  )
);
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+q0g9QAAAAABJRU5ErkJggg==",
  "base64"
);

const disableRandomEvents = () => {
  Math.random = () => 0.999999;
};

const stubCarouselMedia = async (page) => {
  await page.route(/\.(?:mov|mp4)(?:[?#].*)?$/i, (route) =>
    route.fulfill({ body: TEST_VIDEO, contentType: "video/mp4" })
  );
  await page.route(/\/assets\/modeling\/.*\.(?:jpe?g|png)(?:\?.*)?$/i, (route) =>
    route.fulfill({ body: ONE_PIXEL_PNG, contentType: "image/png" })
  );
};

const manuallyPlay = async (video) => {
  await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThan(0);
  await video.evaluate(async (element) => {
    element.loop = true;
    element.muted = true;
    await element.play();
  });
  await expect.poll(() => video.evaluate((element) => element.paused)).toBe(false);
};

const expectPausedFor = async (video, duration = 500) => {
  await expect.poll(() => video.evaluate((element) => element.paused)).toBe(true);
  const startTime = await video.evaluate((element) => element.currentTime);
  await video.page().waitForTimeout(duration);
  const endState = await video.evaluate((element) => ({
    currentTime: element.currentTime,
    paused: element.paused,
  }));
  expect(endState.paused).toBe(true);
  expect(Math.abs(endState.currentTime - startTime)).toBeLessThan(0.05);
};

const expectHiddenPrewarmToStayPaused = async (video) => {
  await expect
    .poll(() => video.evaluate((element) => element.getAttribute("src")), { timeout: 15_000 })
    .not.toBeNull();
  await expect.poll(() => video.evaluate((element) => element.autoplay)).toBe(false);
  await expectPausedFor(video);
};

const expectNoHiddenCarouselPlayback = async (page) => {
  await expect
    .poll(() =>
      page.locator(".gallery-scroll video, .gallery-scroll audio").evaluateAll((elements) =>
        elements
          .filter((element) => {
            const hiddenViewer = element.closest(".viewer-content.is-hidden");
            const hiddenWindow = element.closest(
              '.app-window.is-hidden, .home-window.is-hidden, .window[data-media-closing="true"]'
            );
            return (element.hidden || hiddenViewer || hiddenWindow) && !element.paused;
          })
          .map((element) => element.getAttribute("aria-label") || element.id || element.tagName)
      )
    )
    .toEqual([]);
};

const openApp = async (page, appId) => {
  await page.locator(`.desktop-icon[data-app="${appId}"]`).click();
  const app = page.locator(`[data-app-window="${appId}"]`);
  await expect(app).not.toHaveClass(/is-hidden/);
  return app;
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(disableRandomEvents);
  await stubCarouselMedia(page);
  await page.goto("/home.html");
});

test("Stand Still only autoplays while its carousel tab and video slide are visible", async ({
  page,
}) => {
  const app = await openApp(page, "modeling");
  const standStillPanel = app.locator(
    '.viewer-content[data-view="modeling-stand-still-drop"]'
  );
  const video = standStillPanel.locator("video");

  await expect(video).toHaveCount(1);
  await manuallyPlay(video);

  const firstVideo = await video.elementHandle();
  await standStillPanel.getByRole("button", { name: "Next item" }).click();
  await expect(standStillPanel.locator("video")).toHaveCount(0);
  await expect(
    standStillPanel.locator(".gallery-scroll > img:not(.gallery-loading-indicator__image)")
  ).toBeVisible();
  expect(
    await firstVideo.evaluate((element) => ({
      connected: element.isConnected,
      paused: element.paused,
      src: element.getAttribute("src"),
    }))
  ).toEqual({ connected: false, paused: true, src: null });

  await standStillPanel.getByRole("button", { name: "Previous item" }).click();
  const returnedVideo = standStillPanel.locator("video");
  await expect.poll(() => returnedVideo.evaluate((element) => element.paused)).toBe(false);

  await app
    .locator('.selector-item[data-view="modeling-garb-merch-promo-shoot"]')
    .click();
  await expect(standStillPanel).toHaveClass(/is-hidden/);
  await expectHiddenPrewarmToStayPaused(returnedVideo);
  await expectNoHiddenCarouselPlayback(page);

  await app.locator('.selector-item[data-view="modeling-stand-still-drop"]').click();
  await expect(standStillPanel).not.toHaveClass(/is-hidden/);
  await expect.poll(() => returnedVideo.evaluate((element) => element.paused)).toBe(false);
});

test("manual Modeling videos remain paused when hidden and when revisited", async ({ page }) => {
  const app = await openApp(page, "modeling");
  const runwayPanel = app.locator(
    '.viewer-content[data-view="modeling-fast-reverie-runway-show"]'
  );

  await app
    .locator('.selector-item[data-view="modeling-fast-reverie-runway-show"]')
    .click();
  const video = runwayPanel.locator("video");
  await expect(video).toHaveCount(1);
  await expectPausedFor(video, 100);
  await manuallyPlay(video);

  await app
    .locator('.selector-item[data-view="modeling-fast-reverie-lookbook-shoot"]')
    .click();
  await expect(runwayPanel).toHaveClass(/is-hidden/);
  await expectHiddenPrewarmToStayPaused(video);
  await expectNoHiddenCarouselPlayback(page);

  await app
    .locator('.selector-item[data-view="modeling-fast-reverie-runway-show"]')
    .click();
  await expect(runwayPanel).not.toHaveClass(/is-hidden/);
  await expectPausedFor(video);

  await manuallyPlay(video);
  await app.locator('[data-close="modeling"]').click();
  await expect(app).toHaveClass(/is-hidden/);
  await expectPausedFor(video);
  await expectNoHiddenCarouselPlayback(page);
});

test("Projects video carousels pause on slide, tab, and window changes", async ({ page }) => {
  const app = await openApp(page, "windows");
  const pulseTab = app.locator('.selector-item[data-view="projects-pulse-oximeter"]');
  const ekgPanel = app.locator('.viewer-content[data-view="projects-ekg"]');

  await app.locator('.selector-item[data-view="projects-ekg"]').click();
  await ekgPanel.getByRole("button", { name: "Next item" }).click();
  const ekgVideo = ekgPanel.locator("#ekg-project-video");
  await expect(ekgVideo).toBeVisible();
  await expectPausedFor(ekgVideo, 100);
  await manuallyPlay(ekgVideo);

  await ekgPanel.getByRole("button", { name: "Next item" }).click();
  await expectPausedFor(ekgVideo);
  await manuallyPlay(ekgVideo);
  await pulseTab.click();
  await expect(ekgPanel).toHaveClass(/is-hidden/);
  await expectHiddenPrewarmToStayPaused(ekgVideo);
  await expectNoHiddenCarouselPlayback(page);

  await app.locator('.selector-item[data-view="projects-ekg"]').click();
  await expectPausedFor(ekgVideo);

  const dronePanel = app.locator(
    '.viewer-content[data-view="projects-drone-navigation"]'
  );
  await app.locator('.selector-item[data-view="projects-drone-navigation"]').click();
  const droneVideo = dronePanel.locator("#drone-project-video");
  await expect(droneVideo).toBeVisible();
  await expectPausedFor(droneVideo, 100);
  await manuallyPlay(droneVideo);

  await dronePanel.getByRole("button", { name: "Next item" }).click();
  await expectPausedFor(droneVideo);
  await manuallyPlay(droneVideo);
  await app.locator('.selector-item[data-view="projects-ekg"]').click();
  await expect(dronePanel).toHaveClass(/is-hidden/);
  await expectHiddenPrewarmToStayPaused(droneVideo);
  await expectNoHiddenCarouselPlayback(page);

  await app.locator('.selector-item[data-view="projects-drone-navigation"]').click();
  await expectPausedFor(droneVideo);
  await manuallyPlay(droneVideo);
  await app.locator('[data-close="windows"]').click();
  await expect(app).toHaveClass(/is-hidden/);
  await expectPausedFor(droneVideo);
  await expectNoHiddenCarouselPlayback(page);
});
