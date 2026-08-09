import { expect, test } from "./fixtures.mjs";

test.setTimeout(120_000);

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
    icon: "assets/app-icons/ico/camera3_vid.ico",
    closeWith: "ok",
  },
  {
    appId: "image-tools",
    label: "Image Tools",
    icon: "assets/app-icons/ico/pcx_alt.ico",
    closeWith: "escape",
  },
];

const homeUrl = process.env.PLAYWRIGHT_HOME_URL || "/home.html";

const disableRemoteGameStats = async (page) => {
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
};

const finishCloseAnimation = async (win) => {
  await win.dispatchEvent("animationend", { animationName: "retro-window-close" });
  await expect(win).toBeHidden();
};

const finishOpenAnimation = async (win) => {
  await win.dispatchEvent("animationend", { animationName: "retro-window-open" });
  await expect(win).not.toHaveClass(/is-opening/);
};

test("content-tool desktop and dock apps open responsive, keyboard-friendly Coming soon alerts", async ({
  page,
}, testInfo) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.addInitScript(() => {
    Math.random = () => 0.999999;
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await disableRemoteGameStats(page);
  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);

      for (const app of apps) {
        const launcher = page.locator(`.taskbar-icon[data-app="${app.appId}"]`);
        const desktopLauncher = page.locator(`.desktop-icon[data-app="${app.appId}"]`);
        const launcherIcon = launcher.locator("img");
        const desktopLauncherIcon = desktopLauncher.locator("img");
        const win = page.locator(`[data-app-window="${app.appId}"]`);
        const message = win.locator(`#${app.appId}-coming-soon-message`);
        const ok = win.locator("[data-coming-soon-ok]");

        await expect(win).toBeHidden();
        await expect(win).toHaveAttribute("aria-hidden", "true");
        await launcher.scrollIntoViewIfNeeded();
        await expect(launcher).toBeVisible();
        await expect(launcher).toHaveAccessibleName(app.label);
        await expect(launcher).toHaveAttribute("aria-haspopup", "dialog");
        await expect(launcherIcon).toHaveAttribute("src", app.icon);
        await expect(desktopLauncher).toBeVisible();
        await expect(desktopLauncher).toHaveAccessibleName(app.label);
        await expect(desktopLauncher).toHaveAttribute("aria-haspopup", "dialog");
        await expect(desktopLauncherIcon).toHaveAttribute("src", app.icon);

        const launcherMetrics = await launcher.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const appStrip = element.closest(".taskbar-apps").getBoundingClientRect();
          const image = element.querySelector("img");
          return {
            left: rect.left,
            right: rect.right,
            stripLeft: appStrip.left,
            stripRight: appStrip.right,
            iconLoaded: image.complete && image.naturalWidth > 0,
          };
        });
        expect(launcherMetrics.iconLoaded).toBe(true);
        expect(launcherMetrics.left).toBeGreaterThanOrEqual(launcherMetrics.stripLeft - 0.6);
        expect(launcherMetrics.right).toBeLessThanOrEqual(launcherMetrics.stripRight + 0.6);

        const desktopLauncherMetrics = await desktopLauncher.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const desktop = element.closest(".desktop").getBoundingClientRect();
          const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
          const image = element.querySelector("img");
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            desktopLeft: desktop.left,
            desktopTop: desktop.top,
            desktopRight: desktop.right,
            desktopBottom: desktop.bottom,
            taskbarTop,
            iconLoaded: image.complete && image.naturalWidth > 0,
          };
        });
        expect(desktopLauncherMetrics.iconLoaded).toBe(true);
        expect(desktopLauncherMetrics.left).toBeGreaterThanOrEqual(
          desktopLauncherMetrics.desktopLeft - 0.6
        );
        expect(desktopLauncherMetrics.top).toBeGreaterThanOrEqual(
          desktopLauncherMetrics.desktopTop - 0.6
        );
        expect(desktopLauncherMetrics.right).toBeLessThanOrEqual(
          Math.min(desktopLauncherMetrics.desktopRight, viewport.width) + 0.6
        );
        expect(desktopLauncherMetrics.bottom).toBeLessThanOrEqual(
          Math.min(desktopLauncherMetrics.desktopBottom, desktopLauncherMetrics.taskbarTop) + 0.6
        );

        await launcher.focus();
        if (app.appId === "video-editor") {
          await launcher.click();
        } else {
          await launcher.press("Enter");
        }

        await expect(win).toBeVisible();
        await finishOpenAnimation(win);
        await expect(win).not.toHaveClass(/app-window--center/);
        await expect(win).toHaveAttribute("aria-hidden", "false");
        await expect(win).toHaveAttribute("role", "alertdialog");
        await expect(win).toHaveAccessibleName(app.label);
        await expect(win).toHaveAccessibleDescription("Coming soon");
        await expect(message).toHaveText("Coming soon");
        await expect(ok).toBeFocused();
        expect(await ok.getAttribute("class")).toBeNull();

        const nativeButtonStyles = await page.locator("#debug-system-alert-ok").evaluate((element) => {
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
        const okButtonStyles = await ok.evaluate((element) => {
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
        expect(okButtonStyles).toEqual(nativeButtonStyles);

        const metrics = await win.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const icon = element.querySelector(".random-alert-message img");
          const iconRect = icon.getBoundingClientRect();
          const body = element.querySelector(".window-body");
          const bodyRect = body.getBoundingClientRect();
          const okButton = element.querySelector("[data-coming-soon-ok]");
          const okRect = okButton.getBoundingClientRect();
          const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            centerX: rect.left + rect.width / 2,
            iconLeft: iconRect.left,
            iconRight: iconRect.right,
            iconTop: iconRect.top,
            iconBottom: iconRect.bottom,
            iconLoaded: icon.complete && icon.naturalWidth > 0,
            bodyMinHeight: getComputedStyle(body).minHeight,
            deadSpaceBelowButton: bodyRect.bottom - okRect.bottom,
            taskbarTop,
            horizontalOverflow:
              document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        });
        expect(metrics.iconLoaded).toBe(true);
        expect(metrics.bodyMinHeight).toBe("0px");
        expect(metrics.deadSpaceBelowButton).toBeLessThanOrEqual(0.6);
        expect(metrics.horizontalOverflow).toBe(false);
        expect(metrics.left).toBeGreaterThanOrEqual(11.5);
        expect(metrics.top).toBeGreaterThanOrEqual(11.5);
        expect(metrics.right).toBeLessThanOrEqual(viewport.width - 11.5);
        expect(metrics.bottom).toBeLessThanOrEqual(metrics.taskbarTop - 11.5);
        expect(Math.abs(metrics.centerX - viewport.width / 2)).toBeGreaterThan(2);
        expect(metrics.iconLeft).toBeGreaterThanOrEqual(metrics.left);
        expect(metrics.iconRight).toBeLessThanOrEqual(metrics.right);
        expect(metrics.iconTop).toBeGreaterThanOrEqual(metrics.top);
        expect(metrics.iconBottom).toBeLessThanOrEqual(metrics.bottom);

        if (app.appId === "image-tools") {
          await page.screenshot({
            path: testInfo.outputPath(`content-tools-${viewport.name}.png`),
          });
        }

        if (app.closeWith === "ok") {
          await ok.press("Enter");
        } else {
          await ok.press("Escape");
        }
        await expect(win).toHaveAttribute("aria-hidden", "true");
        await finishCloseAnimation(win);
        await expect(launcher).toBeFocused();
      }
    });
  }

  await test.step("desktop launchers open alerts and receive restored focus", async () => {
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const app of apps) {
      const launcher = page.locator(`.desktop-icon[data-app="${app.appId}"]`);
      const win = page.locator(`[data-app-window="${app.appId}"]`);
      const ok = win.locator("[data-coming-soon-ok]");

      await launcher.focus();
      if (app.appId === "video-editor") {
        await launcher.click();
      } else {
        await launcher.press("Enter");
      }
      await expect(win).toBeVisible();
      await finishOpenAnimation(win);
      await expect(ok).toBeFocused();

      if (app.closeWith === "ok") {
        await ok.press("Enter");
      } else {
        await ok.press("Escape");
      }
      await expect(win).toHaveAttribute("aria-hidden", "true");
      await finishCloseAnimation(win);
      await expect(launcher).toBeFocused();
    }
  });

  await test.step("each closed-to-open launch resamples a bounded position", async () => {
    const viewport = { width: 1280, height: 800 };
    await page.setViewportSize(viewport);

    const aboutWindow = page.locator("#about-window");
    await aboutWindow.locator('[data-close="about"]').click();
    await finishCloseAnimation(aboutWindow);

    const openWithRandomValue = async (launcher, win, randomValue) => {
      await launcher.scrollIntoViewIfNeeded();
      await launcher.focus();
      await launcher.evaluate((element, value) => {
        Math.random = () => value;
        element.click();
      }, randomValue);
      await expect(win).toBeVisible();
      await finishOpenAnimation(win);
      return win.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          taskbarTop,
        };
      });
    };

    for (const app of apps) {
      const launcher = page.locator(`.taskbar-icon[data-app="${app.appId}"]`);
      const win = page.locator(`[data-app-window="${app.appId}"]`);
      const ok = win.locator("[data-coming-soon-ok]");

      const firstPosition = await openWithRandomValue(launcher, win, 0.61);
      expect(firstPosition.left).toBeGreaterThanOrEqual(11.5);
      expect(firstPosition.top).toBeGreaterThanOrEqual(11.5);
      expect(firstPosition.right).toBeLessThanOrEqual(viewport.width - 11.5);
      expect(firstPosition.bottom).toBeLessThanOrEqual(
        firstPosition.taskbarTop - 11.5
      );
      await ok.click();
      await finishCloseAnimation(win);

      const bottomRight = await openWithRandomValue(launcher, win, 0.999999);
      expect(bottomRight.left - firstPosition.left).toBeGreaterThan(100);
      expect(bottomRight.top - firstPosition.top).toBeGreaterThan(100);
      expect(bottomRight.right).toBeLessThanOrEqual(viewport.width - 11.5);
      expect(bottomRight.bottom).toBeLessThanOrEqual(bottomRight.taskbarTop - 11.5);
      await ok.click();
      await finishCloseAnimation(win);
      await expect(launcher).toBeFocused();
    }
  });

  await test.step("open windows remain fully contained after a compact resize", async () => {
    for (const app of apps) {
      await page.setViewportSize({ width: 1440, height: 900 });
      const launcher = page.locator(`.taskbar-icon[data-app="${app.appId}"]`);
      const win = page.locator(`[data-app-window="${app.appId}"]`);
      const ok = win.locator("[data-coming-soon-ok]");

      await launcher.scrollIntoViewIfNeeded();
      await launcher.evaluate((element) => {
        Math.random = () => 0.999999;
        element.click();
      });
      await expect(win).toBeVisible();
      await finishOpenAnimation(win);
      await page.setViewportSize({ width: 320, height: 568 });
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
      );

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
      expect(metrics.right).toBeLessThanOrEqual(320 - 11.5);
      expect(metrics.bottom).toBeLessThanOrEqual(metrics.taskbarTop - 11.5);
      expect(metrics.horizontalOverflow).toBe(false);

      await ok.click();
      await finishCloseAnimation(win);
      await expect(launcher).toBeFocused();
    }
  });

  await test.step("the unmarked Admin stand-in keeps its centered placement", async () => {
    const viewport = { width: 1280, height: 800 };
    await page.setViewportSize(viewport);
    const launcher = page.locator('.taskbar-icon[data-app="admin-controls"]');
    const win = page.locator('[data-app-window="admin-controls-stand-in"]');

    await launcher.scrollIntoViewIfNeeded();
    await launcher.click();
    await expect(win).toBeVisible();
    await finishOpenAnimation(win);
    await expect(win).toHaveClass(/app-window--center/);
    const centerX = await win.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    expect(Math.abs(centerX - viewport.width / 2)).toBeLessThan(1);
    await win.locator("[data-coming-soon-ok]").click();
    await finishCloseAnimation(win);
    await expect(launcher).toBeFocused();
  });

  await test.step("drag release keeps the complete placeholder above the taskbar", async () => {
    const viewport = { width: 1280, height: 800 };
    await page.setViewportSize(viewport);
    const launcher = page.locator('.taskbar-icon[data-app="video-editor"]');
    const win = page.locator('[data-app-window="video-editor"]');

    await launcher.scrollIntoViewIfNeeded();
    await launcher.evaluate((element) => {
      Math.random = () => 0.61;
      element.click();
    });
    await expect(win).toBeVisible();
    await finishOpenAnimation(win);

    const titleBar = win.locator(".title-bar");
    const titleBarBounds = await titleBar.boundingBox();
    expect(titleBarBounds).not.toBeNull();
    await page.mouse.move(titleBarBounds.x + 10, titleBarBounds.y + 10);
    await page.mouse.down();
    await page.mouse.move(viewport.width + 180, viewport.height + 180, { steps: 4 });
    await page.mouse.up();

    const metrics = await win.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        taskbarTop,
      };
    });
    expect(metrics.left).toBeGreaterThanOrEqual(11.5);
    expect(metrics.top).toBeGreaterThanOrEqual(11.5);
    expect(metrics.right).toBeLessThanOrEqual(viewport.width - 11.5);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.taskbarTop - 11.5);

    await win.locator("[data-coming-soon-ok]").click();
    await finishCloseAnimation(win);
    await expect(launcher).toBeFocused();
  });

  await test.step("multiple alerts dismiss the focused window first", async () => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const videoLauncher = page.locator('.taskbar-icon[data-app="video-editor"]');
    const imageLauncher = page.locator('.taskbar-icon[data-app="image-tools"]');
    const videoWindow = page.locator('[data-app-window="video-editor"]');
    const imageWindow = page.locator('[data-app-window="image-tools"]');

    await videoLauncher.scrollIntoViewIfNeeded();
    await videoLauncher.click();
    await expect(videoWindow).toBeVisible();
    await finishOpenAnimation(videoWindow);
    await imageLauncher.click();
    await expect(imageWindow).toBeVisible();
    await finishOpenAnimation(imageWindow);
    await expect(imageWindow.locator("[data-coming-soon-ok]")).toBeFocused();

    const overlapArea = await page.evaluate(() => {
      const video = document
        .querySelector('[data-app-window="video-editor"]')
        .getBoundingClientRect();
      const image = document
        .querySelector('[data-app-window="image-tools"]')
        .getBoundingClientRect();
      const width = Math.max(
        0,
        Math.min(video.right, image.right) - Math.max(video.left, image.left)
      );
      const height = Math.max(
        0,
        Math.min(video.bottom, image.bottom) - Math.max(video.top, image.top)
      );
      return width * height;
    });
    expect(overlapArea).toBe(0);

    await page.keyboard.press("Escape");
    await expect(imageWindow).toHaveAttribute("aria-hidden", "true");
    await finishCloseAnimation(imageWindow);
    await expect(imageLauncher).toBeFocused();
    await expect(videoWindow).toBeVisible();

    await videoWindow.locator("[data-coming-soon-ok]").click();
    await finishCloseAnimation(videoWindow);
    await expect(videoLauncher).toBeFocused();
  });

  expect(consoleErrors).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
