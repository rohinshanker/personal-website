import { expect, test } from "@playwright/test";

const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const workerStatsUrl =
  /https:\/\/personal-site-game-stats\.rohinshankerme\.workers\.dev\/stats(?:\?|$)/;

const profile = Object.freeze({
  id: "player-solitaire-test",
  name: "Solitaire Winner",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

const localState = Object.freeze({
  generatedAt: "2026-07-24T00:00:00.000Z",
  totals: { solitaire: { wins: 4 } },
  leaderboards: {
    solitaire: [
      {
        eventId: "solitaire-local-moves-01",
        playerId: profile.id,
        name: profile.name,
        icon: profile.icon,
        metric: 73,
        metricKind: "moves",
        occurredAt: "2026-07-24T00:00:00.000Z",
      },
    ],
  },
});

const zeroWinsLocalState = Object.freeze({
  generatedAt: "2026-07-24T00:00:00.000Z",
  totals: { solitaire: { wins: 0 } },
  leaderboards: { solitaire: [] },
});

const globalState = Object.freeze({
  generatedAt: "2026-07-24T00:00:00.000Z",
  totals: { solitaire: { wins: 13 } },
  leaderboards: {
    solitaire: [
      {
        eventId: "solitaire-global-aria-01",
        playerId: "player-solitaire-aria",
        name: "Aria",
        icon: "assets/app-icons/ico/user_card.ico",
        metric: 7,
        metricKind: "wins",
        occurredAt: "2026-07-24T00:00:01.000Z",
      },
      {
        eventId: "solitaire-global-local-01",
        playerId: profile.id,
        name: profile.name,
        icon: profile.icon,
        metric: 4,
        metricKind: "wins",
        occurredAt: "2026-07-24T00:00:02.000Z",
      },
      {
        eventId: "solitaire-global-nia-01",
        playerId: "player-solitaire-nia",
        name: "Nia",
        icon: "assets/app-icons/ico/user_card.ico",
        metric: 2,
        metricKind: "wins",
        occurredAt: "2026-07-24T00:00:03.000Z",
      },
    ],
  },
  playerRanks: {
    solitaire: { rank: 2, totalPlayers: 3 },
  },
  playerRecords: {
    solitaire: {
      eventId: "solitaire-global-local-01",
      playerId: profile.id,
      name: profile.name,
      icon: profile.icon,
      metric: 4,
      metricKind: "wins",
      occurredAt: "2026-07-24T00:00:02.000Z",
    },
  },
});

const singlePlayerGlobalState = Object.freeze({
  generatedAt: "2026-07-24T00:00:00.000Z",
  totals: { solitaire: { wins: 1 } },
  leaderboards: {
    solitaire: [
      {
        eventId: "solitaire-global-local-01",
        playerId: profile.id,
        name: profile.name,
        icon: profile.icon,
        metric: 1,
        metricKind: "wins",
        occurredAt: "2026-07-24T00:00:00.000Z",
      },
    ],
  },
  playerRanks: {
    solitaire: { rank: 1, totalPlayers: 1 },
  },
  playerRecords: {
    solitaire: {
      eventId: "solitaire-global-local-01",
      playerId: profile.id,
      name: profile.name,
      icon: profile.icon,
      metric: 1,
      metricKind: "wins",
      occurredAt: "2026-07-24T00:00:00.000Z",
    },
  },
});

const emptyGlobalState = Object.freeze({
  generatedAt: "2026-07-24T00:00:00.000Z",
  totals: { solitaire: { wins: 0 } },
  leaderboards: { solitaire: [] },
  playerRanks: { solitaire: { rank: null, totalPlayers: 0 } },
  playerRecords: { solitaire: null },
});

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
]);

const openSolitaireStats = async (
  page,
  statsState = globalState,
  savedLocalState = localState,
  savedProfile = profile
) => {
  await page.route(workerStatsUrl, (route) =>
    route.fulfill({ body: JSON.stringify(statsState), contentType: "application/json" })
  );
  await page.addInitScript(
    ({ savedProfile, savedState, profileKey, statsKey }) => {
      Math.random = () => 0.999999;
      if (savedProfile) {
        localStorage.setItem(profileKey, JSON.stringify(savedProfile));
      } else {
        localStorage.removeItem(profileKey);
      }
      localStorage.setItem(statsKey, JSON.stringify(savedState));
    },
    {
      savedProfile,
      savedState: savedLocalState,
      profileKey: PROFILE_STORAGE_KEY,
      statsKey: GAME_STATS_STORAGE_KEY,
    }
  );
  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page.locator('.desktop-icon[data-app="solitaire"]').click();
  await page.locator('[data-game-stats-open="solitaire"]').click();
  const stats = page.locator("#game-stats-window-solitaire");
  await expect(stats).toBeVisible();
  return stats;
};

for (const viewport of viewports) {
  test(`Solitaire leaderboard ranks wins at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const stats = await openSolitaireStats(page);
    const leaderboard = stats.locator(".game-stats-solitaire-column");
    const globalRows = leaderboard.locator(
      ".game-stats-solitaire-row:not(.game-stats-solitaire-local-wins-row)"
    );
    const localRow = leaderboard.locator(".game-stats-solitaire-local-wins-row");

    await expect(leaderboard.getByRole("heading", { name: "Most Wins" })).toBeVisible();
    await expect(globalRows).toHaveCount(3);
    await expect(globalRows.nth(0)).toHaveAttribute("aria-label", "Rank 1: Aria, 7 wins");
    await expect(globalRows.nth(1)).toHaveAttribute(
      "aria-label",
      "Rank 2: Solitaire Winner, 4 wins, your entry"
    );
    await expect(globalRows.nth(2)).toHaveAttribute("aria-label", "Rank 3: Nia, 2 wins");
    expect((await globalRows.allTextContents()).join(" ")).not.toContain("N/A");
    await expect(globalRows.nth(1).locator(".game-stats-player-name")).toHaveCSS(
      "color",
      "rgb(0, 128, 0)"
    );
    await expect(leaderboard.getByText("Your Record", { exact: true })).toBeVisible();
    await expect(localRow).toHaveAttribute(
      "aria-label",
      "Your Solitaire record: #2, Solitaire Winner, 4 wins"
    );
    await expect(localRow.locator(".game-stats-leaderboard-template-rank")).toHaveText("#2");
    await expect(localRow.locator(".game-stats-leaderboard-template-rank")).toHaveAttribute(
      "aria-label",
      "Global rank 2"
    );
    await expect(localRow.locator(".game-stats-metric img")).toHaveCount(3);
    await expect(localRow.locator(".game-stats-metric img").first()).toHaveAttribute("alt", "0");
    await expect(localRow.locator(".game-stats-metric img").nth(2)).toHaveAttribute("alt", "4");
    await expect(leaderboard.getByText("Global Wins", { exact: true })).toBeVisible();

    const layout = await leaderboard.evaluate((element) => {
      const panel = element.getBoundingClientRect();
      const rows = Array.from(
        element.querySelectorAll(".game-stats-solitaire-row")
      ).map((row) => {
        const rect = row.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      });
      return {
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        panel: { left: panel.left, right: panel.right },
        rows,
      };
    });
    expect(layout.documentOverflows).toBe(false);
    layout.rows.forEach((row) => {
      expect(row.left).toBeGreaterThanOrEqual(layout.panel.left);
      expect(row.right).toBeLessThanOrEqual(layout.panel.right);
    });
  });

  test(`Solitaire leaves a zero-win player unranked at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const stats = await openSolitaireStats(page, emptyGlobalState, zeroWinsLocalState);
    const localRow = stats.locator(".game-stats-solitaire-local-wins-row");
    const rank = localRow.locator(".game-stats-leaderboard-template-rank");

    await expect(localRow).toHaveAttribute(
      "aria-label",
      "Your Solitaire record: #—, Solitaire Winner, 0 wins"
    );
    await expect(rank).toHaveText("#—");
    await expect(rank).toHaveAttribute("aria-label", "No global rank");
    await expect(localRow.locator(".game-stats-metric img")).toHaveCount(3);
    await expect(localRow.locator(".game-stats-metric img").nth(2)).toHaveAttribute("alt", "0");

    const layout = await localRow.evaluate((element) => ({
      documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
      rowRight: element.getBoundingClientRect().right,
      viewportWidth: window.innerWidth,
    }));
    expect(layout.documentOverflows).toBe(false);
    expect(layout.rowRight).toBeLessThanOrEqual(layout.viewportWidth);

    await page.screenshot({
      path: testInfo.outputPath("solitaire-zero-wins-unranked.png"),
      fullPage: true,
    });
  });
}

test("Solitaire replaces the first dummy slot with the verified current player", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const stats = await openSolitaireStats(page, singlePlayerGlobalState);
  const leaderboard = stats.locator(".game-stats-solitaire-column");
  const globalRows = leaderboard.locator(
    ".game-stats-solitaire-row:not(.game-stats-solitaire-local-wins-row)"
  );

  await expect(globalRows).toHaveCount(3);
  await expect(globalRows.nth(0)).toHaveAttribute(
    "aria-label",
    "Rank 1: Solitaire Winner, 1 win, your entry"
  );
  await expect(globalRows.nth(1)).toHaveAttribute("aria-label", "Rank 2: N/A, 0 wins");
  await expect(globalRows.nth(2)).toHaveAttribute("aria-label", "Rank 3: N/A, 0 wins");
});

test("Solitaire does not rank persisted wins without a local profile", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const stats = await openSolitaireStats(page, emptyGlobalState, localState, null);
  const localRow = stats.locator(".game-stats-solitaire-local-wins-row");
  const rank = localRow.locator(".game-stats-leaderboard-template-rank");

  await expect(localRow).toHaveAttribute(
    "aria-label",
    "Your Solitaire record: #—, N/A, 4 wins"
  );
  await expect(rank).toHaveText("#—");
  await expect(rank).toHaveAttribute("aria-label", "No global rank");
  await expect(localRow.locator(".game-stats-player-name")).toHaveText("N/A");
  await expect(localRow.locator(".game-stats-metric img").nth(2)).toHaveAttribute("alt", "4");
});
