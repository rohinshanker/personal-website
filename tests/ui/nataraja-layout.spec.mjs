import { expect, test } from "./fixtures.mjs";

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "below-width-breakpoint", width: 453, height: 812 },
  { name: "above-width-breakpoint", width: 455, height: 812 },
  { name: "below-height-breakpoint", width: 768, height: 837 },
  { name: "above-height-breakpoint", width: 768, height: 840 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const preparePage = async (page, viewport) => {
  const diagnostics = {
    consoleErrors: [],
    runtimeErrors: [],
    requestFailures: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.runtimeErrors.push(error.message));
  page.on("requestfailed", (request) => {
    diagnostics.requestFailures.push(`${request.method()} ${request.url()}`);
  });
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => 0.999999;
  });
  await page.goto("/home.html", { waitUntil: "load" });
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  return diagnostics;
};

for (const [index, viewport] of viewports.entries()) {
  test(`Nataraja media is 25% smaller and its window follows at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const diagnostics = await preparePage(page, viewport);
    const result = await page.evaluate(() =>
      window.rohinAdminOrchestrator.runEvent("nataraja", {
        source: "nataraja-layout-test",
      })
    );
    expect(result).toEqual({ ok: true, message: "Triggered Nataraja." });

    const win = page.locator("#nataraja-window");
    const video = page.locator("#nataraja-video");
    const credit = win.locator(".nataraja-credit");
    const prompt = win.getByText("Leave an offering?", { exact: true });
    const yes = page.locator("#nataraja-yes");
    const no = page.locator("#nataraja-no");

    await expect(win).toBeVisible();
    await expect(win).toHaveAttribute("aria-hidden", "false");
    await expect(win).not.toHaveClass(/is-opening/);
    await expect(video).toHaveAttribute("aria-label", "Looping Nataraja animation");
    await expect(credit).toBeVisible();
    await expect(prompt).toBeVisible();
    await expect(yes).toBeVisible();
    await expect(no).toBeVisible();
    await expect.poll(() => video.evaluate((element) => element.readyState)).toBeGreaterThanOrEqual(1);
    await expect.poll(() => video.evaluate((element) => element.paused)).toBe(false);

    const metrics = await page.evaluate(() => {
      const bounds = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        };
      };
      const body = document.querySelector("#nataraja-window .window-body");
      const videoElement = document.querySelector("#nataraja-video");
      const bodyStyles = getComputedStyle(body);
      const videoStyles = getComputedStyle(videoElement);
      const winBounds = bounds("#nataraja-window");
      return {
        actions: bounds("#nataraja-window .nataraja-actions"),
        body: bounds("#nataraja-window .window-body"),
        bodyGap: Number.parseFloat(bodyStyles.gap),
        bodyPaddingBottom: Number.parseFloat(bodyStyles.paddingBottom),
        bodyPaddingLeft: Number.parseFloat(bodyStyles.paddingLeft),
        bodyPaddingRight: Number.parseFloat(bodyStyles.paddingRight),
        contained:
          winBounds.left >= 0 &&
          winBounds.top >= 0 &&
          winBounds.right <= window.innerWidth &&
          winBounds.bottom <= window.innerHeight,
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        maxVideoHeight: Number.parseFloat(videoStyles.maxHeight),
        no: bounds("#nataraja-no"),
        video: bounds("#nataraja-video"),
        videoLoop: videoElement.loop,
        videoMuted: videoElement.muted,
        videoNaturalHeight: videoElement.videoHeight,
        videoNaturalWidth: videoElement.videoWidth,
        win: winBounds,
        yes: bounds("#nataraja-yes"),
      };
    });

    const previousWindowWidth = Math.min(430, viewport.width - 24);
    const previousVideoWidth = previousWindowWidth - 26;
    const expectedWindowWidth = previousWindowWidth * 0.75;
    const expectedVideoWidth = previousVideoWidth * 0.75;
    const expectedMaxVideoHeight = Math.min(viewport.height * 0.465, 390);
    const previousVideoHeight = Math.min(
      previousVideoWidth * (metrics.videoNaturalHeight / metrics.videoNaturalWidth),
      viewport.height * 0.62,
      520
    );
    const expectedVideoHeight = previousVideoHeight * 0.75;

    expect(metrics.win.width).toBeCloseTo(expectedWindowWidth, 1);
    expect(metrics.video.width).toBeCloseTo(expectedVideoWidth, 1);
    expect(metrics.video.height).toBeCloseTo(expectedVideoHeight, 1);
    expect(metrics.maxVideoHeight).toBeCloseTo(expectedMaxVideoHeight, 1);
    expect(metrics.video.height).toBeLessThanOrEqual(expectedMaxVideoHeight + 1);
    expect(metrics.bodyPaddingLeft).toBeCloseTo(6.75, 2);
    expect(metrics.bodyPaddingRight).toBeCloseTo(6.75, 2);
    expect(metrics.bodyPaddingBottom).toBeCloseTo(10, 2);
    expect(metrics.bodyGap).toBeCloseTo(10, 2);
    expect(metrics.body.bottom - metrics.actions.bottom).toBeCloseTo(10, 1);
    expect(metrics.yes.width).toBeGreaterThanOrEqual(72);
    expect(metrics.no.width).toBeGreaterThanOrEqual(72);
    expect(metrics.yes.height).toBeGreaterThanOrEqual(23);
    expect(metrics.no.height).toBeGreaterThanOrEqual(23);
    expect(metrics.contained).toBe(true);
    expect(metrics.documentOverflows).toBe(false);
    expect(metrics.videoLoop).toBe(true);
    expect(metrics.videoMuted).toBe(true);

    await page.screenshot({
      path: testInfo.outputPath(`nataraja-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });

    const closeButton = index % 2 === 0 ? yes : no;
    await closeButton.focus();
    await expect(closeButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(win).toHaveAttribute("aria-hidden", "true");
    await expect(win).toBeHidden();
    await expect.poll(() => video.evaluate((element) => element.paused)).toBe(true);
    await expect.poll(() => video.evaluate((element) => element.currentTime)).toBe(0);

    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.runtimeErrors).toEqual([]);
    expect(diagnostics.requestFailures).toEqual([]);
  });
}
