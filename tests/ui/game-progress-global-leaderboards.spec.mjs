import { expect, test } from "@playwright/test";

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "narrow breakpoint", width: 639, height: 900 },
  { name: "wide breakpoint", width: 641, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
]);

const games = Object.freeze([
  {
    icon: "assets/app-icons/ico/minesweeper.ico",
    label: "Minesweeper",
    slug: "minesweeper",
  },
  {
    icon: "assets/app-icons/ico/game_freecell.ico",
    label: "Solitaire",
    slug: "solitaire",
  },
  { icon: "assets/snake-assets/snake-logo.png", label: "Snake", slug: "snake" },
  { icon: "assets/app-icons/ico/calendar2.ico", label: "Sudoku", slug: "sudoku" },
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
  test(`Game Progress global leaderboard launchers work at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
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
    await page.locator('.taskbar-icon[data-app="game-progress"]').click();

    const app = page.locator("#game-progress-window");
    const panel = app.locator(".game-progress-global-leaderboard-list");
    await expect(app.getByRole("heading", { name: "Global Leaderboards" })).toBeVisible();
    await expect(panel).toBeVisible();
    await expect(panel.locator("button")).toHaveCount(4);
    for (const game of games) {
      const launcher = app.getByRole("button", {
        name: `Open ${game.label} global leaderboard`,
      });
      await expect(launcher).toBeVisible();
      await expect(launcher).toBeEnabled();
      await expect(launcher.locator("img")).toHaveAttribute("src", game.icon);
    }

    const layout = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const buttons = Array.from(element.querySelectorAll("button"));
      return {
        backgroundColor: getComputedStyle(element).backgroundColor,
        buttonsFit:
          buttons.every((button) => {
            const buttonRect = button.getBoundingClientRect();
            return (
              buttonRect.left >= rect.left &&
              buttonRect.right <= rect.right &&
              buttonRect.top >= rect.top &&
              buttonRect.bottom <= rect.bottom
            );
          }),
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        panelOverflows: element.scrollWidth > element.clientWidth,
      };
    });
    expect(layout.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(layout.buttonsFit).toBe(true);
    expect(layout.documentOverflows).toBe(false);
    expect(layout.panelOverflows).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath(`global-leaderboards-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });

    for (const game of games) {
      const launcher = app.getByRole("button", {
        name: `Open ${game.label} global leaderboard`,
      });
      await expect(launcher).toBeVisible();
      await launcher.click();

      const leaderboard = page.locator(`#game-stats-window-${game.slug}`);
      await expect(leaderboard).toBeVisible();
      await expect(
        leaderboard.locator("[data-game-stats-title]")
      ).toContainText(`${game.label} Stats`);
      for (const otherGame of games.filter((candidate) => candidate.slug !== game.slug)) {
        await expect(page.locator(`#game-stats-window-${otherGame.slug}`)).toBeHidden();
      }
      await leaderboard.locator(`[data-close="game-stats-${game.slug}"]`).click();
      await expect(leaderboard).toBeHidden();
    }

    const minesweeperLauncher = app.getByRole("button", {
      name: "Open Minesweeper global leaderboard",
    });
    await minesweeperLauncher.focus();
    await expect(minesweeperLauncher).toBeFocused();
    await page.keyboard.press("Enter");
    const minesweeperLeaderboard = page.locator("#game-stats-window-minesweeper");
    await expect(minesweeperLeaderboard).toBeVisible();
    await minesweeperLeaderboard
      .locator('[data-close="game-stats-minesweeper"]')
      .click();
    await expect(minesweeperLeaderboard).toBeHidden();

    await app.locator('.selector-item[data-view="game-progress-minesweeper"]').click();
    await expect(panel).toBeHidden();
    expect(consoleErrors).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
}
