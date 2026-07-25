import { expect, test } from "@playwright/test";

const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const PROFILE = Object.freeze({
  id: "profile-long-name-01",
  name: "Sparrow Starlight Wayfinder Luna",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "narrow breakpoint", width: 639, height: 900 },
  { name: "wide breakpoint", width: 641, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
]);

for (const viewport of viewports) {
  test(`Game Progress shows a full saved profile name at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(
      ({ profile, storageKey }) => {
        Math.random = () => 0.999999;
        localStorage.setItem(storageKey, JSON.stringify(profile));
      },
      { profile: PROFILE, storageKey: PROFILE_STORAGE_KEY }
    );
    await page.goto("/home.html");
    await page.locator('.taskbar-icon[data-app="game-progress"]').click();

    const app = page.locator("#game-progress-window");
    const row = app.locator(".game-progress-profile-row");
    const icon = row.locator(".game-stats-player-icon");
    const name = row.locator(".game-progress-profile-name");
    const saved = row.locator(".game-progress-profile-saved");

    await expect(app.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(app.getByRole("list", { name: "Game Progress tabs" })).toBeVisible();
    await expect(name).toHaveText(PROFILE.name);
    await expect(saved).toHaveText("Saved");
    await expect(saved).toBeVisible();
    await expect(icon).toHaveAttribute("alt", "");

    const layout = await row.evaluate((rowElement) => {
      const getRect = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        };
      };
      const iconElement = rowElement.querySelector(".game-stats-player-icon");
      const nameElement = rowElement.querySelector(".game-progress-profile-name");
      const savedElement = rowElement.querySelector(".game-progress-profile-saved");
      const range = document.createRange();
      range.selectNodeContents(nameElement);
      return {
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
        icon: getRect(iconElement),
        name: {
          ...getRect(nameElement),
          clientHeight: nameElement.clientHeight,
          clientWidth: nameElement.clientWidth,
          lineCount: range.getClientRects().length,
          scrollHeight: nameElement.scrollHeight,
          scrollWidth: nameElement.scrollWidth,
        },
        row: getRect(rowElement),
        saved: getRect(savedElement),
      };
    });

    expect(layout.documentOverflows).toBe(false);
    expect(layout.name.left).toBeGreaterThan(layout.icon.right);
    expect(layout.name.right).toBeLessThanOrEqual(layout.row.right);
    expect(layout.name.width).toBeGreaterThanOrEqual(Math.max(120, layout.row.width * 0.5));
    expect(layout.name.lineCount).toBeLessThanOrEqual(2);
    expect(layout.name.scrollWidth).toBeLessThanOrEqual(layout.name.clientWidth);
    expect(layout.name.scrollHeight).toBeLessThanOrEqual(layout.name.clientHeight);
    expect(layout.saved.right).toBeLessThanOrEqual(layout.row.right);
    expect(layout.name.right).toBeLessThanOrEqual(layout.saved.left);
    expect(layout.saved.top).toBeLessThanOrEqual(layout.name.bottom);
    expect(layout.saved.bottom).toBeGreaterThanOrEqual(layout.name.top);
  });
}

const disableRemoteGameStats = async (page) => {
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
};

for (const viewport of viewports) {
  test(`Game Progress changes only the icon at ${viewport.name}`, async ({ page }, testInfo) => {
    const consoleErrors = [];
    const runtimeErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await page.setViewportSize(viewport);
    await page.addInitScript(
      ({ profile, storageKey }) => {
        Math.random = () => 0.999999;
        localStorage.setItem(storageKey, JSON.stringify(profile));
      },
      { profile: PROFILE, storageKey: PROFILE_STORAGE_KEY }
    );
    await disableRemoteGameStats(page);
    await page.goto("/home.html");
    await page.locator('.taskbar-icon[data-app="game-progress"]').click();

    const app = page.locator("#game-progress-window");
    const changeIcon = app.getByRole("button", { name: "Change Icon" });
    await expect(changeIcon).toBeVisible();
    await expect(app.getByRole("button", { name: "Create Profile" })).toHaveCount(0);

    await changeIcon.click();
    const dialog = page.getByRole("dialog", { name: "Change Profile Icon" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#game-profile-name-controls")).toBeHidden();
    await expect(dialog.locator("#game-profile-name-credit")).toBeHidden();
    await expect(dialog.locator("#game-profile-name")).toBeHidden();
    await expect(dialog.locator("#game-profile-reroll")).toBeHidden();
    await expect(dialog.locator("#game-profile-icon-search")).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(`game-progress-icon-picker-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(changeIcon).toBeFocused();

    await changeIcon.click();
    const iconOptions = dialog.locator(".game-profile-icon-option");
    const nextIconIndex = await iconOptions.evaluateAll((options) =>
      options.findIndex((option) => option.getAttribute("aria-selected") !== "true")
    );
    expect(nextIconIndex).toBeGreaterThanOrEqual(0);
    const nextIcon = await iconOptions.nth(nextIconIndex).locator("img").getAttribute("src");
    await iconOptions.nth(nextIconIndex).click();
    await expect(iconOptions.nth(nextIconIndex)).toHaveAttribute("aria-selected", "true");
    await dialog.getByRole("button", { name: "Save Icon" }).click();

    await expect(dialog).toBeHidden();
    await expect(app.locator(".game-progress-profile-name")).toHaveText(PROFILE.name);
    await expect(app.locator(".game-progress-profile-row .game-stats-player-icon")).toHaveAttribute(
      "src",
      nextIcon
    );
    const storedProfile = await page.evaluate((storageKey) =>
      JSON.parse(localStorage.getItem(storageKey) || "null"),
      PROFILE_STORAGE_KEY
    );
    expect(storedProfile).toMatchObject({ id: PROFILE.id, name: PROFILE.name, icon: nextIcon });
    expect(consoleErrors).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });
}
