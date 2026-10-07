import { expect, test } from "./deterministic.mjs";
import { DETERMINISTIC_RANDOM_DRAW, FROZEN_INSTANT } from "./helpers/rendered-site.mjs";

/**
 * Production ships a forced-Start event. The shared fixture isolates that
 * policy so a Start click in an unrelated test cannot open its prompt.
 */
const FORCED_START_WINDOW_MS = 3_000;

test("the shared UI fixture isolates the production forced-Start event", async ({ page }) => {
  await page.clock.install({ time: FROZEN_INSTANT });
  await page.addInitScript((draw) => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => draw;
  }, DETERMINISTIC_RANDOM_DRAW);
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.locator(".start-button").click();
  await page.clock.runFor(FORCED_START_WINDOW_MS);

  await expect(page.locator("#lain-alert-window")).toBeHidden();
  await expect(page.locator("#red-tool-window")).toBeHidden();
  await expect(page.locator("#neko-stream-alert-window")).toBeHidden();
  await expect(page.locator("#debug-system-alert-window")).toBeHidden();
});
