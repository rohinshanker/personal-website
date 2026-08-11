import { expect, test } from "./fixtures.mjs";

test.setTimeout(120_000);

const homeUrl = process.env.PLAYWRIGHT_HOME_URL || "/home.html";
const videoWindowSelector = '[data-app-window="video-editor"]';
const blockedMessage =
  "The new tab was blocked. Allow pop-ups for this site, then choose Yes again.";

const viewports = [
  { width: 375, height: 812, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1280, height: 800, name: "desktop" },
  { width: 1440, height: 900, name: "wide" },
];

const disableRemoteGameStats = async (page) => {
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
};

const loadHome = async (page) => {
  await page.addInitScript(() => {
    Math.random = () => 0.61;
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await disableRemoteGameStats(page);
  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
};

const finishOpenAnimation = async (win) => {
  await win.dispatchEvent("animationend", { animationName: "retro-window-open" });
  await expect(win).not.toHaveClass(/is-opening/);
};

const finishCloseAnimation = async (win) => {
  await win.dispatchEvent("animationend", { animationName: "retro-window-close" });
  await expect(win).toBeHidden();
};

const openVideoPrompt = async (page, launcherSelector) => {
  const launcher = page.locator(launcherSelector);
  const win = page.locator(videoWindowSelector);
  await launcher.scrollIntoViewIfNeeded();
  await launcher.focus();
  await launcher.press("Enter");
  await expect(win).toBeVisible();
  await finishOpenAnimation(win);
  await expect(win.locator("#video-editor-launch-yes")).toBeFocused();
  return { launcher, win };
};

const expectPromptInsideViewport = async (win, viewport) => {
  const metrics = await win.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      taskbarTop,
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(metrics.left).toBeGreaterThanOrEqual(11.5);
  expect(metrics.top).toBeGreaterThanOrEqual(11.5);
  expect(metrics.right).toBeLessThanOrEqual(viewport.width - 11.5);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.taskbarTop - 11.5);
  expect(metrics.horizontalOverflow).toBe(false);
};

test("Video Editor launcher renders a responsive, keyboard-friendly Yes/No prompt", async ({
  page,
}, testInfo) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await loadHome(page);

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      const { launcher, win } = await openVideoPrompt(
        page,
        '.taskbar-icon[data-app="video-editor"]'
      );
      const yes = win.locator("#video-editor-launch-yes");
      const no = win.locator("#video-editor-launch-no");
      const error = win.locator("#video-editor-launch-error");

      await expect(launcher).toHaveAccessibleName("Video Editor");
      await expect(launcher).toHaveAttribute("aria-haspopup", "dialog");
      await expect(launcher).toHaveAttribute(
        "aria-controls",
        "video-editor-launch-window"
      );
      await expect(win).toHaveAttribute("role", "alertdialog");
      await expect(win).toHaveAttribute("aria-modal", "false");
      await expect(win).toHaveAttribute("aria-hidden", "false");
      await expect(win).toHaveAccessibleName("Video Editor");
      await expect(win).toHaveAccessibleDescription("Open video editor in new tab?");
      await expect(yes).toHaveAccessibleName("Yes");
      await expect(no).toHaveAccessibleName("No");
      await expect(error).toBeHidden();
      await expectPromptInsideViewport(win, viewport);

      await page.screenshot({
        path: testInfo.outputPath(`video-editor-launch-${viewport.name}.png`),
      });

      await no.press("Enter");
      await expect(win).toHaveAttribute("aria-hidden", "true");
      await finishCloseAnimation(win);
      await expect(launcher).toBeFocused();
    });
  }

  expect(consoleErrors).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test("Video Editor Yes opens a secure new tab and restores the exact launcher", async ({
  page,
}) => {
  await loadHome(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const { launcher, win } = await openVideoPrompt(
    page,
    '.desktop-icon[data-app="video-editor"]'
  );

  const popupPromise = page.waitForEvent("popup");
  await win.locator("#video-editor-launch-yes").click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");

  expect(new URL(popup.url()).pathname).toBe("/video-editor/");
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await expect(win).toHaveAttribute("aria-hidden", "true");
  await popup.close();
  await finishCloseAnimation(win);
  await expect(launcher).toBeFocused();
});

test("Video Editor blocked and failed popups stay actionable", async ({ page }, testInfo) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await loadHome(page);
  const viewport = { width: 375, height: 812 };
  await page.setViewportSize(viewport);

  await page.evaluate(() => {
    window.open = () => null;
  });
  const first = await openVideoPrompt(page, '.taskbar-icon[data-app="video-editor"]');
  const firstYes = first.win.locator("#video-editor-launch-yes");
  const firstError = first.win.locator("#video-editor-launch-error");
  await firstYes.click();
  await expect(first.win).toBeVisible();
  await expect(first.win).toHaveAttribute("aria-hidden", "false");
  await expect(firstError).toBeVisible();
  await expect(firstError).toHaveText(blockedMessage);
  await expect(firstError).toHaveAttribute("role", "alert");
  await expect(firstYes).toBeFocused();
  await expectPromptInsideViewport(first.win, viewport);
  await page.screenshot({
    path: testInfo.outputPath("video-editor-launch-popup-blocked.png"),
  });
  await first.win.locator("#video-editor-launch-no").click();
  await finishCloseAnimation(first.win);
  await expect(first.launcher).toBeFocused();

  await page.evaluate(() => {
    window.open = () => {
      throw new Error("blocked by test browser");
    };
  });
  const second = await openVideoPrompt(page, '.desktop-icon[data-app="video-editor"]');
  await expect(second.win.locator("#video-editor-launch-error")).toBeHidden();
  await second.win.locator("#video-editor-launch-yes").click();
  await expect(second.win.locator("#video-editor-launch-error")).toHaveText(
    blockedMessage
  );
  await second.win.locator('[data-close="video-editor"]').first().click();
  await finishCloseAnimation(second.win);
  await expect(second.launcher).toBeFocused();

  await page.evaluate(() => {
    window.videoEditorRejectedPopupClosed = false;
    window.open = () => ({
      set opener(value) {
        throw new Error(`opener rejected ${value}`);
      },
      close() {
        window.videoEditorRejectedPopupClosed = true;
      },
    });
  });
  const third = await openVideoPrompt(page, '.taskbar-icon[data-app="video-editor"]');
  await third.win.locator("#video-editor-launch-yes").click();
  await expect(third.win.locator("#video-editor-launch-error")).toHaveText(
    blockedMessage
  );
  expect(await page.evaluate(() => window.videoEditorRejectedPopupClosed)).toBe(true);
  await third.win.locator("#video-editor-launch-no").click();
  await finishCloseAnimation(third.win);
  await expect(third.launcher).toBeFocused();

  expect(consoleErrors).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test("Video Editor Escape and title close dismiss to their exact launchers", async ({
  page,
}) => {
  await loadHome(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  const escaped = await openVideoPrompt(
    page,
    '.desktop-icon[data-app="video-editor"]'
  );
  await escaped.win.locator("#video-editor-launch-yes").press("Escape");
  await expect(escaped.win).toHaveAttribute("aria-hidden", "true");
  await finishCloseAnimation(escaped.win);
  await expect(escaped.launcher).toBeFocused();

  const titleClosed = await openVideoPrompt(
    page,
    '.taskbar-icon[data-app="video-editor"]'
  );
  await titleClosed.win.locator('[data-close="video-editor"]').first().click();
  await finishCloseAnimation(titleClosed.win);
  await expect(titleClosed.launcher).toBeFocused();
});

test("Image Tools keeps its Coming soon alert behavior", async ({ page }) => {
  await loadHome(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const launcher = page.locator('.taskbar-icon[data-app="image-tools"]');
  const win = page.locator('[data-app-window="image-tools"]');
  const ok = win.locator("[data-coming-soon-ok]");

  await launcher.scrollIntoViewIfNeeded();
  await launcher.focus();
  await launcher.press("Enter");
  await expect(win).toBeVisible();
  await finishOpenAnimation(win);
  await expect(win).toHaveAccessibleDescription("Coming soon");
  await expect(ok).toHaveText("OK");
  await expect(ok).toBeFocused();
  await ok.press("Escape");
  await finishCloseAnimation(win);
  await expect(launcher).toBeFocused();
});
