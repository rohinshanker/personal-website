import { expect, test } from "@playwright/test";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";

test.setTimeout(180_000);

const viewports = [
  { width: 375, height: 812, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 800, height: 360, name: "short" },
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

const installCurrentPublicInfoTestBridge = async (page) => {
  const mainSource = await readIsolatedMainSource();
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__currentPublicInfoTest = Object.freeze({
  open() {
    showCurrentPublicInfoWindow();
    currentPublicInfoWindow.classList.remove("is-opening");
  },
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the Current Public Information test bridge.");
  }
  await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedSource,
    })
  );
};

const measureCurrentPublicInfo = (page) =>
  page.evaluate(() => {
    const bounds = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
    };
    const image = document.querySelector("#current-public-info-image");
    const imageStyle = getComputedStyle(image);
    const body = document.querySelector("#current-public-info-window .window-body");
    const bodyStyle = getComputedStyle(body);
    const saulBodyStyle = getComputedStyle(
      document.querySelector("#saul-ad-window .window-body")
    );
    const saulImageStyle = getComputedStyle(document.querySelector("#saul-ad-image"));
    return {
      actions: bounds(".current-public-info-actions"),
      body: bounds("#current-public-info-window .window-body"),
      bodyPaddingBottom: Number.parseFloat(bodyStyle.paddingBottom),
      bodyPaddingLeft: Number.parseFloat(bodyStyle.paddingLeft),
      bodyPaddingRight: Number.parseFloat(bodyStyle.paddingRight),
      bodyPaddingTop: Number.parseFloat(bodyStyle.paddingTop),
      button: bounds("#current-public-info-thanks"),
      documentOverflow:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.documentElement.scrollHeight > window.innerHeight,
      image: bounds("#current-public-info-image"),
      imageBackground: imageStyle.backgroundColor,
      imageBoxShadow: imageStyle.boxShadow,
      imageBoxSizing: imageStyle.boxSizing,
      imageLoaded: image.complete && image.naturalWidth > 0,
      imageNaturalHeight: image.naturalHeight,
      imageNaturalWidth: image.naturalWidth,
      imageObjectFit: imageStyle.objectFit,
      saulBodyPaddingTop: Number.parseFloat(saulBodyStyle.paddingTop),
      saulImageBackground: saulImageStyle.backgroundColor,
      saulImageBoxShadow: saulImageStyle.boxShadow,
      saulImageBoxSizing: saulImageStyle.boxSizing,
      saulImageObjectFit: saulImageStyle.objectFit,
      taskbar: bounds(".taskbar"),
      titleBar: bounds("#current-public-info-window .title-bar"),
      win: bounds("#current-public-info-window"),
    };
  });

const closeAndFinishAnimation = async (page, button) => {
  const win = page.locator("#current-public-info-window");
  await button.click();
  await expect(win).toHaveAttribute("aria-hidden", "true");
  await win.dispatchEvent("animationend", { animationName: "retro-window-close" });
  await expect(win).toBeHidden();
  await expect(page.locator("#current-public-info-image")).not.toHaveAttribute("src");
};

test("Current Public Information uses the Saul advertisement image inset and keeps its button below", async ({
  page,
}, testInfo) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0;
    localStorage.clear();
  });
  await disableRemoteGameStats(page);
  await installCurrentPublicInfoTestBridge(page);
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__currentPublicInfoTest));

  const win = page.locator("#current-public-info-window");
  const image = page.locator("#current-public-info-image");
  const thanks = page.locator("#current-public-info-thanks");
  const titleClose = page.locator("#current-public-info-close");
  await expect(win).toBeHidden();
  await expect(thanks).toBeHidden();
  await expect(titleClose).toBeHidden();

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.__currentPublicInfoTest.open());
      await expect(win).toBeVisible();
      await expect(win).toHaveAttribute("aria-hidden", "false");
      await expect(
        win.locator(".title-bar-text")
      ).toHaveText("Current Publicly Available Information");
      await expect(thanks).toHaveText("Thanks for sharing...");
      await expect(titleClose).toHaveAccessibleName("Close");
      await expect(image).toHaveAttribute(
        "src",
        "assets/random%20events/current-publicly-available-information/season-1.webp"
      );
      await expect
        .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0))
        .toBe(true);

      const metrics = await measureCurrentPublicInfo(page);
      expect(metrics.imageLoaded).toBe(true);
      expect(metrics.imageNaturalWidth).toBe(1920);
      expect(metrics.imageNaturalHeight).toBe(1080);
      expect(metrics.documentOverflow).toBe(false);
      expect(metrics.bodyPaddingTop).toBeCloseTo(4, 1);
      expect(metrics.bodyPaddingRight).toBeCloseTo(4, 1);
      expect(metrics.bodyPaddingBottom).toBeCloseTo(4, 1);
      expect(metrics.bodyPaddingLeft).toBeCloseTo(4, 1);
      expect(metrics.image.top - metrics.body.top).toBeCloseTo(4, 1);
      expect(metrics.image.left - metrics.body.left).toBeCloseTo(4, 1);
      expect(metrics.body.right - metrics.image.right).toBeCloseTo(4, 1);
      expect(metrics.image.bottom).toBeLessThanOrEqual(metrics.actions.top + 0.6);
      expect(metrics.button.top).toBeGreaterThanOrEqual(metrics.image.bottom + 7.5);
      expect(metrics.actions.bottom).toBeLessThanOrEqual(
        metrics.body.bottom - metrics.bodyPaddingBottom + 0.6
      );
      expect(metrics.button.left).toBeGreaterThanOrEqual(metrics.actions.left - 0.6);
      expect(metrics.button.right).toBeLessThanOrEqual(metrics.actions.right + 0.6);
      expect(metrics.imageBackground).toBe("rgb(0, 0, 0)");
      expect(metrics.imageBoxShadow).not.toBe("none");
      expect(metrics.imageBoxSizing).toBe("border-box");
      expect(metrics.imageObjectFit).toBe("contain");
      expect(metrics.bodyPaddingTop).toBeCloseTo(metrics.saulBodyPaddingTop, 1);
      expect(metrics.imageBackground).toBe(metrics.saulImageBackground);
      expect(metrics.imageBoxShadow).toBe(metrics.saulImageBoxShadow);
      expect(metrics.imageBoxSizing).toBe(metrics.saulImageBoxSizing);
      expect(metrics.imageObjectFit).toBe(metrics.saulImageObjectFit);
      expect(metrics.win.left).toBeGreaterThanOrEqual(11.5);
      expect(metrics.win.top).toBeGreaterThanOrEqual(11.5);
      expect(metrics.win.right).toBeLessThanOrEqual(viewport.width - 11.5);
      expect(metrics.win.bottom).toBeLessThanOrEqual(metrics.taskbar.top - 7.5);

      await win.screenshot({
        path: testInfo.outputPath(`current-public-info-${viewport.name}.png`),
      });
      await closeAndFinishAnimation(page, thanks);
    });
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => window.__currentPublicInfoTest.open());
  await expect(win).toBeVisible();
  await closeAndFinishAnimation(page, titleClose);

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await page.close({ runBeforeUnload: false });
});
