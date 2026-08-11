import { writeFile } from "node:fs/promises";
import { expect, test } from "./fixtures.mjs";

test.setTimeout(120_000);

const homeUrl = process.env.PLAYWRIGHT_HOME_URL || "/home.html";

const viewports = [
  { width: 320, height: 568, name: "compact-mobile" },
  { width: 371, height: 812, name: "below-alert-width-threshold" },
  { width: 373, height: 812, name: "above-alert-width-threshold" },
  { width: 375, height: 812, name: "mobile" },
  { width: 568, height: 320, name: "short-landscape" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1280, height: 800, name: "desktop" },
  { width: 1440, height: 900, name: "wide" },
];

const apps = [
  {
    appId: "video-editor",
    label: "Video Editor",
    description: "Open video editor in new tab?",
    icon: "assets/app-icons/ico/camera3_vid.ico",
    initialFocusSelector: "#video-editor-launch-yes",
    actionSelectors: ["#video-editor-launch-yes", "#video-editor-launch-no"],
  },
  {
    appId: "image-tools",
    label: "Image Tools",
    description: "Coming soon",
    icon: "assets/app-icons/ico/pcx_alt.ico",
    initialFocusSelector: "[data-coming-soon-ok]",
    actionSelectors: ["[data-coming-soon-ok]"],
  },
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

const collectRuntimeErrors = (page) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
};

const finishOpenAnimation = async (win) => {
  await win.dispatchEvent("animationend", { animationName: "retro-window-open" });
  await expect(win).not.toHaveClass(/is-opening/);
};

const finishCloseAnimation = async (win) => {
  await win.dispatchEvent("animationend", { animationName: "retro-window-close" });
  await expect(win).toBeHidden();
};

const settleViewport = async (page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
};

const getWindowMetrics = (win) =>
  win.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      taskbarTop,
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

const expectWindowContained = async (win, viewport) => {
  const metrics = await getWindowMetrics(win);
  expect(metrics.left).toBeGreaterThanOrEqual(11.5);
  expect(metrics.top).toBeGreaterThanOrEqual(11.5);
  expect(metrics.right).toBeLessThanOrEqual(viewport.width - 11.5);
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.taskbarTop - 11.5);
  expect(metrics.horizontalOverflow).toBe(false);
  return metrics;
};

const setRandomValue = async (page, value) => {
  await page.evaluate((nextValue) => {
    Math.random = () => nextValue;
  }, value);
};

const openApp = async (page, app, randomValue = 0.61, launcherKind = "taskbar") => {
  const launcher = page.locator(`.${launcherKind}-icon[data-app="${app.appId}"]`);
  const win = page.locator(`[data-app-window="${app.appId}"]`);
  await expect(win).toBeHidden();
  await launcher.scrollIntoViewIfNeeded();
  await launcher.focus();
  await setRandomValue(page, randomValue);
  await launcher.press("Enter");
  await expect(win).toBeVisible();
  await finishOpenAnimation(win);
  await expect(win.locator(app.initialFocusSelector)).toBeFocused();
  return { launcher, win };
};

const closeWithEscape = async ({ launcher, win, app }) => {
  await win.locator(app.initialFocusSelector).press("Escape");
  await expect(win).toHaveAttribute("aria-hidden", "true");
  await finishCloseAnimation(win);
  await expect(launcher).toBeFocused();
};

const closeAboutWindow = async (page) => {
  const aboutWindow = page.locator("#about-window");
  if (!(await aboutWindow.isVisible())) return;
  await aboutWindow.locator('[data-close="about"]').click();
  await finishCloseAnimation(aboutWindow);
};

const getNativeButtonStyle = (button) =>
  button.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      border: style.border,
      boxShadow: style.boxShadow,
      minHeight: style.minHeight,
      minWidth: style.minWidth,
      padding: style.padding,
    };
  });

const saveTextEvidence = async (testInfo, filename, body) => {
  await writeFile(testInfo.outputPath(filename), body, "utf8");
};

test("content-tool random placement is contained and accessible across the viewport matrix", async ({
  page,
}, testInfo) => {
  const runtime = collectRuntimeErrors(page);
  await loadHome(page);

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await settleViewport(page);

      for (const app of apps) {
        const launcher = page.locator(`.taskbar-icon[data-app="${app.appId}"]`);
        const desktopLauncher = page.locator(`.desktop-icon[data-app="${app.appId}"]`);
        await expect(launcher).toBeVisible();
        await expect(launcher).toHaveAccessibleName(app.label);
        await expect(launcher).toHaveAttribute("aria-haspopup", "dialog");
        await expect(launcher.locator("img")).toHaveAttribute("src", app.icon);
        await expect(desktopLauncher).toBeVisible();
        await expect(desktopLauncher).toHaveAccessibleName(app.label);
        await expect(desktopLauncher).toHaveAttribute("aria-haspopup", "dialog");
        await expect(desktopLauncher.locator("img")).toHaveAttribute("src", app.icon);

        const opened = await openApp(page, app, 0.999999);
        await expect(opened.win).not.toHaveClass(/app-window--center/);
        await expect(opened.win).toHaveAttribute("aria-hidden", "false");
        await expect(opened.win).toHaveAttribute("role", "alertdialog");
        await expect(opened.win).toHaveAttribute("aria-modal", "false");
        await expect(opened.win).toHaveAccessibleName(app.label);
        await expect(opened.win).toHaveAccessibleDescription(app.description);
        await expectWindowContained(opened.win, viewport);

        const ariaSnapshot = await opened.win.ariaSnapshot();
        expect(ariaSnapshot).toContain(`\"${app.label}\"`);
        expect(ariaSnapshot).toContain(app.description);
        await saveTextEvidence(
          testInfo,
          `${app.appId}-${viewport.name}-aria.yml`,
          ariaSnapshot
        );

        const nativeButtonStyles = await getNativeButtonStyle(
          page.locator(
            '#debug-system-alert-actions [data-system-alert-button-id="ok"]'
          )
        );
        for (const selector of app.actionSelectors) {
          const action = opened.win.locator(selector);
          expect(await action.getAttribute("class")).toBeNull();
          expect(await getNativeButtonStyle(action)).toEqual(nativeButtonStyles);
        }

        await page.screenshot({
          path: testInfo.outputPath(`${app.appId}-${viewport.name}.png`),
        });
        await closeWithEscape({ ...opened, app });
      }
    });
  }

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
});

test("each closed-to-open launch resamples a fresh bounded position", async ({ page }, testInfo) => {
  const runtime = collectRuntimeErrors(page);
  const viewport = { width: 1280, height: 800 };
  await loadHome(page);
  await page.setViewportSize(viewport);
  await closeAboutWindow(page);

  for (const app of apps) {
    const first = await openApp(page, app, 0.61);
    const firstPosition = await expectWindowContained(first.win, viewport);
    await page.screenshot({
      path: testInfo.outputPath(`${app.appId}-first-position.png`),
    });
    await closeWithEscape({ ...first, app });

    const second = await openApp(page, app, 0.999999);
    const secondPosition = await expectWindowContained(second.win, viewport);
    expect(secondPosition.left - firstPosition.left).toBeGreaterThan(100);
    expect(secondPosition.top - firstPosition.top).toBeGreaterThan(100);
    await page.screenshot({
      path: testInfo.outputPath(`${app.appId}-second-position.png`),
    });
    await saveTextEvidence(
      testInfo,
      `${app.appId}-resampled-position-metrics.json`,
      `${JSON.stringify({ firstPosition, secondPosition }, null, 2)}\n`
    );
    await closeWithEscape({ ...second, app });
  }

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
});

test("resize and drag release clamp each complete content-tool window above the taskbar", async ({
  page,
}, testInfo) => {
  const runtime = collectRuntimeErrors(page);
  await loadHome(page);
  await closeAboutWindow(page);

  for (const app of apps) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const opened = await openApp(page, app, 0.999999);

    const compactViewport = { width: 320, height: 568 };
    await page.setViewportSize(compactViewport);
    await settleViewport(page);
    await expectWindowContained(opened.win, compactViewport);
    await page.screenshot({
      path: testInfo.outputPath(`${app.appId}-compact-resize.png`),
    });

    const desktopViewport = { width: 1280, height: 800 };
    await page.setViewportSize(desktopViewport);
    await settleViewport(page);
    const titleBar = opened.win.locator(".title-bar");
    const titleBarBounds = await titleBar.boundingBox();
    expect(titleBarBounds).not.toBeNull();
    await page.mouse.move(titleBarBounds.x + 10, titleBarBounds.y + 10);
    await page.mouse.down();
    await page.mouse.move(desktopViewport.width + 180, desktopViewport.height + 180, {
      steps: 4,
    });
    await page.mouse.up();
    await expectWindowContained(opened.win, desktopViewport);
    await page.screenshot({
      path: testInfo.outputPath(`${app.appId}-drag-release.png`),
    });
    await closeWithEscape({ ...opened, app });
  }

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
});

test("simultaneous content-tool windows avoid overlap and dismiss in focus order", async ({
  page,
}, testInfo) => {
  const runtime = collectRuntimeErrors(page);
  const viewport = { width: 1280, height: 800 };
  await loadHome(page);
  await page.setViewportSize(viewport);
  await closeAboutWindow(page);

  const video = await openApp(page, apps[0], 0.61);
  const image = await openApp(page, apps[1], 0.61);
  await expectWindowContained(video.win, viewport);
  await expectWindowContained(image.win, viewport);
  await expect(image.win.locator(apps[1].initialFocusSelector)).toBeFocused();

  const overlapArea = await page.evaluate(() => {
    const videoRect = document
      .querySelector('[data-app-window="video-editor"]')
      .getBoundingClientRect();
    const imageRect = document
      .querySelector('[data-app-window="image-tools"]')
      .getBoundingClientRect();
    const width = Math.max(
      0,
      Math.min(videoRect.right, imageRect.right) - Math.max(videoRect.left, imageRect.left)
    );
    const height = Math.max(
      0,
      Math.min(videoRect.bottom, imageRect.bottom) - Math.max(videoRect.top, imageRect.top)
    );
    return width * height;
  });
  expect(overlapArea).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("simultaneous-non-overlap.png") });

  await closeWithEscape({ ...image, app: apps[1] });
  await expect(video.win).toBeVisible();
  await video.win.locator("#video-editor-launch-no").click();
  await finishCloseAnimation(video.win);
  await expect(video.launcher).toBeFocused();

  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
});

test("the unauthenticated Admin stand-in remains centered", async ({ page }, testInfo) => {
  const runtime = collectRuntimeErrors(page);
  const viewport = { width: 1280, height: 800 };
  await loadHome(page);
  await page.setViewportSize(viewport);
  const launcher = page.locator('.taskbar-icon[data-app="admin-controls"]');
  const win = page.locator('[data-app-window="admin-controls-stand-in"]');

  await launcher.scrollIntoViewIfNeeded();
  await launcher.focus();
  await launcher.press("Enter");
  await expect(win).toBeVisible();
  await finishOpenAnimation(win);
  await expect(win).toHaveClass(/app-window--center/);
  await expect(win).toHaveAccessibleName("Admin Controls");
  await expect(win).toHaveAccessibleDescription("nothing to see here...");
  await expect(win.locator("#admin-controls-stand-in-ok")).toBeFocused();
  const metrics = await getWindowMetrics(win);
  expect(Math.abs(metrics.centerX - viewport.width / 2)).toBeLessThan(1);
  await saveTextEvidence(testInfo, "admin-stand-in-aria.yml", await win.ariaSnapshot());
  await page.screenshot({ path: testInfo.outputPath("admin-stand-in-centered.png") });

  await win.locator("#admin-controls-stand-in-ok").press("Escape");
  await finishCloseAnimation(win);
  await expect(launcher).toBeFocused();
  expect(runtime.consoleErrors).toEqual([]);
  expect(runtime.pageErrors).toEqual([]);
});
