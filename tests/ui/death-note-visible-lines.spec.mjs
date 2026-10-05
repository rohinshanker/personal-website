import { expect, test } from "./deterministic.mjs";
import { REVIEW_VIEWPORT, breakpointPair } from "./helpers/rendered-site.mjs";

const viewports = Object.freeze([
  REVIEW_VIEWPORT.mobile,
  ...breakpointPair("the stacked breakpoint", { below: 559, above: 561, height: 900 }),
  REVIEW_VIEWPORT.tablet,
  REVIEW_VIEWPORT.desktop,
  REVIEW_VIEWPORT.wide,
]);

for (const viewport of viewports) {
  test(`Death Note keeps writing within its visible lines at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      Math.random = () => 0.999999;
    });
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

    await notebook.getByRole("button", { name: "Close Notebook" }).click();
    await expect(notebook).toHaveClass(/is-hidden/);
  });
}
