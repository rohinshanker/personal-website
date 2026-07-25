import { expect, test } from "@playwright/test";

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
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

const digitSources = async (total) =>
  total.locator("img").evaluateAll((images) =>
    images.map((image) => new URL(image.src).pathname)
  );

const expectedSources = (digits) =>
  digits.split("").map(
    (digit) =>
      `/assets/minesweeper_assets/digital_digits/digital_${
        digit === " " ? "unlit" : digit === "-" ? "minus" : digit
      }.png`
  );

for (const viewport of viewports) {
  test(`Counter uses unlit leading digits at ${viewport.name}`, async ({ page }, testInfo) => {
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
    await page.locator('.taskbar-icon[data-app="life-counter"]').click();

    const app = page.locator('[data-app-window="life-counter"]');
    const total = app.locator(".life-counter-total");
    const valueInput = app.getByRole("spinbutton", { name: "Set value for Player 1" });
    const submit = app.getByRole("button", { name: "Submit value for Player 1" });
    await expect(app).toBeVisible();
    await expect(total).toHaveAttribute("aria-label", "20");
    await expect(total).toHaveAttribute("role", "img");
    await expect(digitSources(total)).resolves.toEqual(expectedSources("   20"));

    await valueInput.fill("-20");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(total).toHaveAttribute("aria-label", "-20");
    await expect(digitSources(total)).resolves.toEqual(expectedSources("-  20"));

    await valueInput.fill("99999");
    await submit.click();
    await expect(total).toHaveAttribute("aria-label", "99999");
    await expect(digitSources(total)).resolves.toEqual(expectedSources("99999"));

    const layout = await app.evaluate((appElement) => {
      const rect = appElement.getBoundingClientRect();
      return {
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        right: rect.right,
        visibleDigitCount: appElement.querySelectorAll(".life-counter-total img").length,
      };
    });
    expect(layout.documentOverflows).toBe(false);
    expect(layout.right).toBeLessThanOrEqual(viewport.width);
    expect(layout.visibleDigitCount).toBe(5);
    await page.screenshot({
      path: testInfo.outputPath(`life-counter-unlit-digits-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
    expect(consoleErrors).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
}
