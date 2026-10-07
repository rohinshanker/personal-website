import { expect, test } from "./deterministic.mjs";
import { REVIEW_VIEWPORT, breakpointPair } from "./helpers/rendered-site.mjs";

const viewports = Object.freeze([
  REVIEW_VIEWPORT.mobile,
  ...breakpointPair("the Gears Nest layout breakpoint", { below: 619, above: 621, height: 900 }),
  REVIEW_VIEWPORT.tablet,
  REVIEW_VIEWPORT.desktop,
  REVIEW_VIEWPORT.wide,
]);

for (const viewport of viewports) {
  test(`Gears Nest renders the more frequent rocket warning at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      Math.random = () => 0.999999;
    });
    await page.goto("/home.html");
    await page.evaluate(() => window.homeResources.loadRandomEventStyles());

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
  });
}
