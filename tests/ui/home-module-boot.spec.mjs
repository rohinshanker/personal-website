import { expect, test } from "./deterministic.mjs";

import { REVIEW_VIEWPORTS } from "./helpers/rendered-site.mjs";

// This deliberately boots the shipped feature scripts. The shared fixture
// rewrites only the per-event debug flags, so a missing dependency or handler
// still surfaces here rather than being hidden behind a replacement script.
for (const viewport of REVIEW_VIEWPORTS) {
  test(`Home feature scripts boot and close windows at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/home.html");
    await expect(page.locator("#taskbar-clock")).not.toHaveText("--:--");
    expect(await page.evaluate(() => [
      "homeGameStats", "homeSnake", "homeMinesweeper", "homeSolitaire",
      "homeSudoku", "homeEventRuntime", "homeCalendar", "homeResources",
    ].every((key) => Boolean(window[key])))).toBe(true);
    expect(await page.evaluate(() => ({
      controller: Boolean(window.rohinAdminControlsController),
      orchestrator: Boolean(window.rohinAdminOrchestrator),
      onDemandRequests: performance.getEntriesByType("resource")
        .map((entry) => new URL(entry.name).pathname)
        .filter((path) => [
          "/styles/home/random-events.css",
          "/styles/home/admin-controls.css",
          "/scripts/home/admin/orchestrator.js",
          "/scripts/home/admin-controls.js",
        ].includes(path)),
    }))).toEqual({ controller: false, orchestrator: false, onDemandRequests: [] });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const about = page.locator('[data-app-window="about"]');
    await about.locator('[data-close="about"]').click();
    await expect(about).toHaveClass(/is-hidden/);
    await page.locator('[data-app="minesweeper"]').first().click();
    const minesweeper = page.locator('[data-app-window="minesweeper"]');
    await expect(minesweeper).not.toHaveClass(/is-hidden/);
    await minesweeper.locator('[data-close="minesweeper"]').click();
    await expect(minesweeper).toHaveClass(/is-hidden/);
  });
}

test("all project and writing PDF launcher bindings survive extraction", async ({ page }) => {
  await page.goto("/home.html");
  for (const [buttonId, appId] of [
    ["open-frontiers-pdf", "mec-pdf"],
    ["open-bioe190-presentation", "bioe190-presentation-pdf"],
    ["open-bioe190-proposal", "bioe190-proposal-pdf"],
    ["open-tcp-paper", "tcp-paper-pdf"],
    ["open-writing-tcp-paper", "tcp-paper-pdf"],
    ["open-tcp-presentation", "tcp-presentation-pdf"],
  ]) {
    // Each launcher belongs to a separate portfolio view. Dispatch its native
    // click to verify the binding without bypassing the window lifecycle.
    await page.locator(`#${buttonId}`).dispatchEvent("click");
    const win = page.locator(`[data-app-window="${appId}"]`);
    await expect(win).not.toHaveClass(/is-hidden/);
    await win.locator(`[data-close="${appId}"]`).click();
    await expect(win).toHaveClass(/is-hidden/);
  }
});
