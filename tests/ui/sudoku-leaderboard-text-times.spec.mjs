import { expect, test } from "@playwright/test";

const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const workerStatsUrl =
  /https:\/\/personal-site-game-stats\.rohinshankerme\.workers\.dev\/stats(?:\?|$)/;

const profile = Object.freeze({
  id: "player-sudoku-test",
  name: "Sudoku Timekeeper",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

const localState = Object.freeze({
  generatedAt: "2026-07-24T00:00:00.000Z",
  totals: {
    sudoku: {
      wins: { easy: { noHints: 1, withHints: 0 } },
      bestTimes: { easy: 65 },
    },
  },
  leaderboards: {
    sudoku: {
      easy: [
        {
          eventId: "event-sudoku-local-01",
          playerId: profile.id,
          name: profile.name,
          icon: profile.icon,
          metric: 65,
          metricKind: "seconds",
          occurredAt: "2026-07-24T00:00:00.000Z",
        },
      ],
    },
  },
});

const globalState = Object.freeze({
  generatedAt: "2026-07-24T00:00:00.000Z",
  totals: {
    sudoku: {
      wins: { easy: { noHints: 1, withHints: 0 } },
    },
  },
  leaderboards: {
    sudoku: {
      easy: [
        {
          eventId: "sudoku-global-01",
          playerId: "player-sudoku-global",
          name: "Puzzle Ace",
          icon: "assets/app-icons/ico/user_card.ico",
          metric: 1004,
          metricKind: "seconds",
          occurredAt: "2026-07-24T00:00:01.000Z",
        },
      ],
    },
  },
});

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
]);

const openSudokuStats = async (page) => {
  await page.route(workerStatsUrl, (route) =>
    route.fulfill({ body: JSON.stringify(globalState), contentType: "application/json" })
  );
  await page.addInitScript(
    ({ state, statsKey, savedProfile, profileKey }) => {
      Math.random = () => 0.999999;
      localStorage.setItem(statsKey, JSON.stringify(state));
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
    },
    {
      state: localState,
      statsKey: GAME_STATS_STORAGE_KEY,
      savedProfile: profile,
      profileKey: PROFILE_STORAGE_KEY,
    }
  );
  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page.locator('.desktop-icon[data-app="sudoku"]').click();
  await page.locator('[data-game-stats-open="sudoku"]').click();

  const stats = page.locator("#game-stats-window-sudoku");
  await expect(stats).toBeVisible();
  return stats;
};

for (const viewport of viewports) {
  test(`Sudoku leaderboard uses bold text times at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const stats = await openSudokuStats(page);
    const easyLeaderboard = stats.locator(".game-stats-sudoku-leaderboard").first();
    const globalRows = easyLeaderboard.locator(
      ".game-stats-sudoku-row:not(.game-stats-sudoku-local-best-row)"
    );
    const globalMetric = globalRows.first().locator(".game-stats-metric--text");
    const localMetric = easyLeaderboard.locator(
      ".game-stats-sudoku-local-best-row .game-stats-metric--text"
    );

    await expect(globalRows).toHaveCount(3);
    await expect(globalRows.first()).toHaveAttribute("aria-label", "Rank 1: Puzzle Ace, 1004 seconds");
    await expect(globalRows.nth(1)).toHaveAttribute("aria-label", "Rank 2: N/A, 999 seconds");
    await expect(globalMetric).toHaveText("16:44");
    await expect(localMetric).toHaveText("01:05");
    await expect(stats.locator(".game-stats-sudoku-row .game-stats-digit-strip")).toHaveCount(0);
    await expect(
      stats.locator(".game-stats-sudoku-total-games .game-stats-digit-strip").first()
    ).toBeVisible();

    const layout = await easyLeaderboard.evaluate((panel) => {
      const row = panel.querySelector(".game-stats-sudoku-local-best-row");
      const metric = row.querySelector(".game-stats-metric--text");
      const rowRect = row.getBoundingClientRect();
      const metricRect = metric.getBoundingClientRect();
      return {
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        metricRight: metricRect.right,
        rowRight: rowRect.right,
      };
    });
    expect(layout.documentOverflows).toBe(false);
    expect(layout.metricRight).toBeLessThanOrEqual(layout.rowRight);
  });
}
