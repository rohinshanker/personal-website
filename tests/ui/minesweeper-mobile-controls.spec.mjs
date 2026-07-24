import { expect, test } from "@playwright/test";

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
]);

const configureOfflineGameStats = async (page) => {
  await page.route("**/scripts/home/game-stats-backend.js*", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: 'window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "" });',
    });
  });
};

const openMinesweeper = async (page) => {
  await page.getByRole("toolbar", { name: "Taskbar" }).getByRole("button", { name: "Minesweeper" }).click();
  const app = page.locator('[data-app-window="minesweeper"]');
  await expect(app).toBeVisible();
  return app;
};

const expectTopPanelAlignment = async (app) => {
  const layout = await app.locator(".ms-top-panel").evaluate((panel) => {
    const getRect = (selector) => {
      const rect = panel.querySelector(selector).getBoundingClientRect();
      return { left: rect.left, right: rect.right, center: rect.left + rect.width / 2 };
    };
    const panelRect = panel.getBoundingClientRect();
    return {
      panelCenter: panelRect.left + panelRect.width / 2,
      mines: getRect("#ms-mines"),
      reset: getRect("#ms-reset"),
      time: getRect("#ms-time"),
    };
  });
  expect(Math.abs(layout.reset.center - layout.panelCenter)).toBeLessThanOrEqual(1);
  expect(layout.mines.right).toBeLessThan(layout.reset.left);
  expect(layout.reset.right).toBeLessThan(layout.time.left);
};

for (const viewport of viewports) {
  test(`Mobile controls remain opt-in at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await configureOfflineGameStats(page);
    await page.addInitScript(() => {
      Math.random = () => 0.999999;
    });
    await page.goto("/home.html");
    const aboutClose = page.locator('#about-window [data-close="about"]');
    if (await aboutClose.isVisible()) await aboutClose.click();

    const app = await openMinesweeper(page);
    const checkbox = app.getByRole("checkbox", { name: "Mobile controls?" });
    const flag = app.locator("#ms-flag-mode");
    const question = app.locator("#ms-question-mode");

    await expect(checkbox).not.toBeChecked();
    await expect(flag).toBeHidden();
    await expect(question).toBeHidden();
    await expectTopPanelAlignment(app);

    await checkbox.focus();
    await checkbox.press("Space");
    await expect(checkbox).toBeChecked();
    await expect(flag).toBeVisible();
    await expect(question).toBeVisible();
    await expectTopPanelAlignment(app);

    await flag.click();
    await expect(flag).toHaveAttribute("aria-pressed", "true");
    await question.click();
    await expect(flag).toHaveAttribute("aria-pressed", "false");
    await expect(question).toHaveAttribute("aria-pressed", "true");

    await checkbox.focus();
    await checkbox.press("Space");
    await expect(checkbox).not.toBeChecked();
    await expect(flag).toBeHidden();
    await expect(question).toBeHidden();
    await expect(flag).toHaveAttribute("aria-pressed", "false");
    await expect(question).toHaveAttribute("aria-pressed", "false");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    const reloadedApp = await openMinesweeper(page);
    await expect(reloadedApp.getByRole("checkbox", { name: "Mobile controls?" })).not.toBeChecked();
    await expect(reloadedApp.locator("#ms-flag-mode")).toBeHidden();
    await expect(reloadedApp.locator("#ms-question-mode")).toBeHidden();
  });
}
