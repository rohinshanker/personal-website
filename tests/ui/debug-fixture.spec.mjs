import { expect, test } from "./fixtures.mjs";

test("the shared UI fixture suppresses production debug popups", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => 0.999999;
  });
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.locator('.taskbar-icon[data-app="game-progress"]').click();
  await page.waitForTimeout(2_100);

  await expect(page.locator("#lain-alert-window")).toBeHidden();
  await expect(page.locator("#red-tool-window")).toBeHidden();
  await expect(page.locator("#neko-stream-alert-window")).toBeHidden();
  await expect(page.locator("#debug-system-alert-window")).toBeHidden();
});
