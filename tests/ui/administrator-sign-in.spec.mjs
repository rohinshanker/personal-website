import { expect, test } from "@playwright/test";

const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const SNAKE_HIGH_SCORE_KEY = "personalSiteSnakeHighScores";
const ADMINISTRATOR_PROFILE = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
  rerollCount: 0,
});

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
]);

const API_BASE_URL = "https://game-stats.test";
const administratorProof = `${"a".repeat(32)}.${"b".repeat(32)}`;

const configureAdministratorApi = async (page, signInStatus) => {
  await page.route("**/scripts/home/game-stats-backend.js*", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "${API_BASE_URL}", buildVersion: "sha256-${"a".repeat(64)}" });`,
    });
  });
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/administrator/sign-in") {
      const credentials = JSON.parse(request.postData() || "{}");
      expect(credentials).toEqual({ username: "administrator", password: "password" });
      if (signInStatus === "success") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            profile: {
              id: ADMINISTRATOR_PROFILE.id,
              name: ADMINISTRATOR_PROFILE.name,
              icon: ADMINISTRATOR_PROFILE.icon,
            },
            proof: administratorProof,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          }),
        });
        return;
      }
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Invalid administrator credentials" }),
      });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
  });
};

const preparePage = async (page, signInStatus) => {
  await page.addInitScript(
    ({ profileStorageKey, gameStatsStorageKey, snakeHighScoreKey }) => {
      localStorage.setItem(
        profileStorageKey,
        JSON.stringify({
          id: "player-before-administrator",
          name: "Before Administrator",
          icon: "assets/app-icons/ico/user_card.ico",
          rerollCount: 0,
        })
      );
      localStorage.setItem(
        gameStatsStorageKey,
        JSON.stringify({ totals: { minesweeper: { wins: { beginner: 4 } } } })
      );
      localStorage.setItem(snakeHighScoreKey, JSON.stringify({ 16: 99 }));
    },
    {
      profileStorageKey: PROFILE_STORAGE_KEY,
      gameStatsStorageKey: GAME_STATS_STORAGE_KEY,
      snakeHighScoreKey: SNAKE_HIGH_SCORE_KEY,
    }
  );
  await configureAdministratorApi(page, signInStatus);
  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
};

const openAdministratorWindow = async (page) => {
  const cursorSettingsButton = page
    .getByRole("toolbar", { name: "Taskbar" })
    .getByRole("button", { name: "Cursor Settings" });
  await cursorSettingsButton.scrollIntoViewIfNeeded();
  await cursorSettingsButton.click();
  const cursorWindow = page.locator('[data-app-window="cursor"]');
  await expect(cursorWindow).toBeVisible();

  const administratorButton = cursorWindow.locator("#cursor-settings-administrator");
  await expect(administratorButton).toHaveAttribute("aria-label", "Administrator sign in");
  await administratorButton.click();
  const windowElement = page.locator("#administrator-window");
  await expect(windowElement).toBeVisible();
  await expect(page.locator("#administrator-username")).toBeFocused();
  return windowElement;
};

for (const viewport of viewports) {
  test(`Administrator sign-in succeeds without overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await preparePage(page, "success");
    const signInWindow = await openAdministratorWindow(page);

    await page.locator("#administrator-username").fill("administrator");
    await page.locator("#administrator-password").fill("password");
    await page.locator("#administrator-sign-in").click();

    await expect(signInWindow).toBeHidden();
    const alertWindow = page.locator("#administrator-alert-window");
    await expect(alertWindow).toBeVisible();
    await expect(alertWindow).toContainText("Administrator Access Granted");
    await expect(alertWindow).toContainText("Game Progress profile updated to rohin ^.^.");
    await expect(alertWindow).toHaveCSS("z-index", "1000000");
    await expect(page.locator("#administrator-alert-close")).toBeFocused();

    const state = await page.evaluate(
      ({ profileStorageKey, gameStatsStorageKey, snakeHighScoreKey }) => ({
        profile: JSON.parse(localStorage.getItem(profileStorageKey)),
        gameStats: JSON.parse(localStorage.getItem(gameStatsStorageKey)),
        snakeScores: localStorage.getItem(snakeHighScoreKey),
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
      }),
      {
        profileStorageKey: PROFILE_STORAGE_KEY,
        gameStatsStorageKey: GAME_STATS_STORAGE_KEY,
        snakeHighScoreKey: SNAKE_HIGH_SCORE_KEY,
      }
    );
    expect(state.profile).toEqual(ADMINISTRATOR_PROFILE);
    expect(state.gameStats.totals.minesweeper.wins.beginner).toBe(0);
    expect(state.snakeScores).toBeNull();
    expect(state.documentOverflows).toBe(false);
  });
}

test("Administrator failure closes the sign-in window and never grants access", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await preparePage(page, "failure");
  const signInWindow = await openAdministratorWindow(page);

  await page.locator("#administrator-username").fill("administrator");
  await page.locator("#administrator-password").fill("password");
  await page.locator("#administrator-sign-in").click();

  await expect(signInWindow).toBeHidden();
  await expect(page.locator("#administrator-alert-window")).toBeHidden();
  await expect(page.locator("#administrator-password")).toHaveValue("");
  await expect
    .poll(() =>
      page.evaluate((profileStorageKey) => JSON.parse(localStorage.getItem(profileStorageKey)).name, PROFILE_STORAGE_KEY)
    )
    .toBe("Before Administrator");
});
