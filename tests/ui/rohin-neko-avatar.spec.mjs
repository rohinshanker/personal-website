import { expect, test } from "./fixtures.mjs";

const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const ROHIN_PROFILE = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
  rerollCount: 0,
});

const prepareRohinProfilePage = async (page) => {
  await page.route("**/scripts/home/game-stats-backend.js*", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: 'window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "" });',
    });
  });
  await page.addInitScript(
    ({ profileStorageKey, profile }) => {
      Math.random = () => 0.999999;
      localStorage.setItem(profileStorageKey, JSON.stringify(profile));
    },
    { profileStorageKey: PROFILE_STORAGE_KEY, profile: ROHIN_PROFILE }
  );
  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
};

test("Game Progress opens a sleeping Rohin Neko avatar at the roaming Neko nap cadence", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await prepareRohinProfilePage(page);

  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await page.getByRole("toolbar", { name: "Taskbar" }).getByRole("button", { name: "Game Progress" }).click();

  const avatar = page.locator("#game-progress-window img[data-rohin-neko-avatar]");
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveAttribute("src", /assets\/neko-assets\/sprites\/sleep1\.png$/);
  await page.waitForTimeout(850);
  await expect(avatar).toHaveAttribute("src", /assets\/neko-assets\/sprites\/sleep2\.png$/);
  expect(pageErrors).toEqual([]);
});

test("visible Rohin Neko icons animate independently with the canonical scratch frames", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await prepareRohinProfilePage(page);

  await page.evaluate(() => {
    const rolls = [0, 0.3, 0, 0];
    let rollIndex = 0;
    Math.random = () => rolls[Math.min(rollIndex++, rolls.length - 1)];
    for (const id of ["sleeping-rohin-neko", "awake-rohin-neko"]) {
      const image = document.createElement("img");
      image.id = id;
      image.dataset.rohinNekoAvatar = "true";
      image.alt = "";
      document.body.append(image);
    }
  });

  const sleepingAvatar = page.locator("#sleeping-rohin-neko");
  const awakeAvatar = page.locator("#awake-rohin-neko");
  await expect(sleepingAvatar).toHaveAttribute("src", /assets\/neko-assets\/sprites\/sleep1\.png$/);
  await expect(awakeAvatar).toHaveAttribute("src", /assets\/neko-assets\/sprites\/yawn1\.png$/);

  await page.waitForTimeout(1_025);
  await expect(sleepingAvatar).toHaveAttribute("src", /assets\/neko-assets\/sprites\/sleep2\.png$/);
  await expect(awakeAvatar).toHaveAttribute("src", /assets\/neko-assets\/sprites\/scratch1\.png$/);
});
