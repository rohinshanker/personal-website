import { expect, test } from "./fixtures.mjs";

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "below stacked breakpoint", width: 559, height: 900 },
  { name: "above stacked breakpoint", width: 561, height: 900 },
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
  test(`Death Note keeps writing within its visible lines at ${viewport.name}`, async ({ page }, testInfo) => {
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

    const notebook = page.locator("#death-note-window");
    await notebook.evaluate((windowElement) => {
      windowElement.classList.remove("is-hidden");
      windowElement.setAttribute("aria-hidden", "false");
    });
    const entry = notebook.getByRole("textbox", { name: "Write in the Death Note" });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(entry).toBeFocused();

    const metricsBefore = await entry.evaluate((element) => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
      return {
        visibleLineCount: Math.floor(element.clientHeight / lineHeight),
      };
    });
    const attemptedLines = Array.from(
      { length: metricsBefore.visibleLineCount + 4 },
      (_, index) => `Name ${index + 1}`
    );
    await entry.fill(attemptedLines.join("\n"));

    const metricsAfter = await entry.evaluate((element) => ({
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
      lineCount: element.value ? element.value.split("\n").length : 0,
      overflow: getComputedStyle(element).overflow,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
      scrollWidth: element.scrollWidth,
      value: element.value,
    }));
    expect(metricsAfter.lineCount).toBeLessThanOrEqual(metricsBefore.visibleLineCount);
    expect(metricsAfter.value).not.toBe(attemptedLines.join("\n"));
    expect(metricsAfter.scrollHeight).toBeLessThanOrEqual(metricsAfter.clientHeight);
    expect(metricsAfter.scrollWidth).toBeLessThanOrEqual(metricsAfter.clientWidth);
    expect(metricsAfter.scrollTop).toBe(0);
    expect(metricsAfter.overflow).toBe("hidden");
    expect(metricsAfter.documentOverflows).toBe(false);
    await page.screenshot({
      path: testInfo.outputPath(`death-note-visible-lines-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });

    await notebook.getByRole("button", { name: "Close Notebook" }).click();
    await expect(notebook).toHaveClass(/is-hidden/);
    expect(consoleErrors).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
}
