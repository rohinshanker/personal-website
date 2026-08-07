import { expect, test } from "./fixtures.mjs";

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "below Gears Nest layout breakpoint", width: 619, height: 900 },
  { name: "above Gears Nest layout breakpoint", width: 621, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
]);

const disableRemoteGameStats = async (page) => {
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
};

for (const viewport of viewports) {
  test(`Gears Nest renders the more frequent rocket warning at ${viewport.name}`, async ({ page }, testInfo) => {
    const consoleErrors = [];
    const runtimeErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      Math.random = () => 0.999999;
    });
    await disableRemoteGameStats(page);
    await page.goto("/home.html");

    const app = page.locator("#gears-nest-window");
    await app.evaluate((windowElement) => {
      windowElement.classList.remove("is-hidden");
      windowElement.setAttribute("aria-hidden", "false");
    });
    await expect(app.getByRole("heading", { name: "Nest emerging!" })).toBeVisible();
    await expect(app.getByRole("button", { name: "Yes" })).toBeVisible();

    await page.evaluate(() => {
      Math.random = () => 0.45;
    });
    await app.getByRole("button", { name: "Yes" }).click();
    await expect(app.locator(".gears-nest-enemy")).toHaveCount(5);
    await expect(app.getByText("ROCKET", { exact: true })).toBeVisible();

    const layout = await app.evaluate((windowElement) => {
      const rect = windowElement.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        left: rect.left,
        right: rect.right,
        top: rect.top,
      };
    });
    expect(layout.documentOverflows).toBe(false);
    expect(layout.left).toBeGreaterThanOrEqual(0);
    expect(layout.right).toBeLessThanOrEqual(viewport.width);
    expect(layout.top).toBeGreaterThanOrEqual(0);
    expect(layout.bottom).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({
      path: testInfo.outputPath(`gears-nest-hazard-cadence-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
    expect(consoleErrors).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
}
