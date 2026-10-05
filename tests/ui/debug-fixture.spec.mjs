import { expect, test } from "./deterministic.mjs";
import { DETERMINISTIC_RANDOM_DRAW, FROZEN_INSTANT } from "./helpers/rendered-site.mjs";

/**
 * Production ships a few per-event debug flags that pop their window open a
 * couple of seconds after boot. The shared fixture turns them off at the
 * source, and this is the proof: the clock runs past the whole window they
 * could fire in and nothing appears.
 */
const DEBUG_POPUP_WINDOW_MS = 3_000;

test("the shared UI fixture suppresses production debug popups", async ({ page }) => {
  await page.clock.install({ time: FROZEN_INSTANT });
  await page.addInitScript((draw) => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => draw;
  }, DETERMINISTIC_RANDOM_DRAW);
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.locator('.taskbar-icon[data-app="game-progress"]').click();
  await page.clock.runFor(DEBUG_POPUP_WINDOW_MS);

  await expect(page.locator("#lain-alert-window")).toBeHidden();
  await expect(page.locator("#red-tool-window")).toBeHidden();
  await expect(page.locator("#neko-stream-alert-window")).toBeHidden();
  await expect(page.locator("#debug-system-alert-window")).toBeHidden();
});
