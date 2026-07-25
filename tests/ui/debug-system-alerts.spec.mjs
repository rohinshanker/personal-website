import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.setTimeout(180_000);

const viewports = [
  { width: 371, height: 812, name: "below-width-threshold" },
  { width: 373, height: 812, name: "above-width-threshold" },
  { width: 375, height: 812, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1280, height: 800, name: "desktop" },
  { width: 1440, height: 900, name: "large-desktop" },
];

const disableRemoteGameStats = async (page) => {
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
};

const installDebugAlertTestBridge = async (page) => {
  const mainSource = await readFile(
    new URL("../../scripts/home/main.js", import.meta.url),
    "utf8"
  );
  const zeroDelaySource = mainSource.replace(
    "const RANDOM_EVENT_DELAY_MAX_MS = 2000;",
    "const RANDOM_EVENT_DELAY_MAX_MS = 0;"
  );
  const instrumentedSource = zeroDelaySource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__debugSystemAlertsTest = Object.freeze({
  alerts: DEBUG_SYSTEM_ALERTS.map((alert) => ({ ...alert })),
  activeId: () => debugSystemAlertActiveId,
  open(id) {
    const alertIndex = DEBUG_SYSTEM_ALERTS.findIndex((alert) => alert.id === id);
    if (alertIndex < 0) return false;
    return showDebugSystemAlert(DEBUG_SYSTEM_ALERTS[alertIndex]);
  },
  trigger(name = "startButton") {
    return triggerRandomEvents(name);
  },
});
})();`
  );
  if (
    zeroDelaySource === mainSource ||
    instrumentedSource === zeroDelaySource
  ) {
    throw new Error("Unable to install the debug system alert test bridge.");
  }
  await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedSource,
    })
  );
};

const dispatchAnimationEnd = async (locator, animationName) => {
  await locator.dispatchEvent("animationend", { animationName });
};

const closeAlert = async (page, useEscape = false) => {
  const win = page.locator("#debug-system-alert-window");
  const ok = page.locator("#debug-system-alert-ok");
  if (useEscape) {
    await ok.press("Escape");
  } else {
    await ok.press("Enter");
  }
  await expect(win).toHaveAttribute("aria-hidden", "true");
  await dispatchAnimationEnd(win, "retro-window-close");
  await expect(win).toBeHidden();
};

const measureAlert = (page) =>
  page.evaluate(() => {
    const bounds = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      };
    };
    const image = document.querySelector("#debug-system-alert-icon");
    return {
      win: bounds("#debug-system-alert-window"),
      body: bounds("#debug-system-alert-window .window-body"),
      icon: bounds("#debug-system-alert-icon"),
      message: bounds("#debug-system-alert-message"),
      actions: bounds("#debug-system-alert-actions"),
      ok: bounds("#debug-system-alert-ok"),
      imageLoaded: image.complete && image.naturalWidth > 0,
      documentOverflow:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.documentElement.scrollHeight > window.innerHeight,
    };
  });

const expectContained = (inner, outer, tolerance = 0.6) => {
  expect(inner.left).toBeGreaterThanOrEqual(outer.left - tolerance);
  expect(inner.top).toBeGreaterThanOrEqual(outer.top - tolerance);
  expect(inner.right).toBeLessThanOrEqual(outer.right + tolerance);
  expect(inner.bottom).toBeLessThanOrEqual(outer.bottom + tolerance);
};

test("all system alerts schedule normally and render responsively", async ({
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
    Math.random = () => 0.999999;
    localStorage.clear();
  });
  await disableRemoteGameStats(page);
  await installDebugAlertTestBridge(page);
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__debugSystemAlertsTest));

  const alerts = await page.evaluate(() => window.__debugSystemAlertsTest.alerts);
  expect(alerts).toHaveLength(10);
  expect(alerts.filter(({ alignment }) => alignment === "right")).toHaveLength(4);
  expect(alerts.filter(({ alignment }) => alignment === "center")).toHaveLength(6);

  const win = page.locator("#debug-system-alert-window");
  const sentinel = page.locator("#taskbar-clock-button");

  await sentinel.focus();
  expect(
    await page.evaluate(() => window.__debugSystemAlertsTest.trigger("startButton"))
  ).toBe(false);
  await expect(win).toBeHidden();

  const normallyScheduled = await page.evaluate(() => {
    Math.random = () => 0;
    return window.__debugSystemAlertsTest.trigger("startButton");
  });
  expect(normallyScheduled).toBe(true);
  await expect(win).toBeVisible();
  await expect(win).toHaveAttribute("data-alert-id", "ram-prices");
  await expect(page.locator("#debug-system-alert-ok")).toBeFocused();
  await dispatchAnimationEnd(win, "retro-window-open");
  await closeAlert(page);
  await page.evaluate(() => {
    Math.random = () => 0.999999;
  });
  await expect(sentinel).toBeFocused();

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      for (const alert of alerts) {
        await sentinel.focus();
        expect(
          await page.evaluate(
            (id) => window.__debugSystemAlertsTest.open(id),
            alert.id
          )
        ).toBe(true);
        await expect(win).toBeVisible();
        await dispatchAnimationEnd(win, "retro-window-open");
        await expect(win).not.toHaveClass(/is-opening/);
        await expect(win).toHaveAttribute("role", "alertdialog");
        await expect(win).toHaveAttribute("data-alert-id", alert.id);
        await expect(win).toHaveAccessibleName(alert.title);
        await expect(win).toHaveAccessibleDescription(alert.message);
        await expect(page.locator("#debug-system-alert-title")).toHaveText(alert.title);
        await expect(page.locator("#debug-system-alert-message")).toHaveText(
          alert.message
        );
        await expect(page.locator("#debug-system-alert-icon")).toHaveAttribute(
          "src",
          alert.icon
        );
        await expect(page.locator("#debug-system-alert-ok")).toBeFocused();

        const metrics = await measureAlert(page);
        expect(metrics.imageLoaded).toBe(true);
        expect(metrics.documentOverflow).toBe(false);
        expect(metrics.win.left).toBeGreaterThanOrEqual(11.5);
        expect(metrics.win.top).toBeGreaterThanOrEqual(11.5);
        expect(metrics.win.right).toBeLessThanOrEqual(viewport.width - 11.5);
        expect(metrics.win.bottom).toBeLessThanOrEqual(viewport.height - 63.5);
        expectContained(metrics.icon, metrics.body);
        expectContained(metrics.message, metrics.body);
        expectContained(metrics.ok, metrics.body);
        expect(Math.abs(metrics.icon.centerY - metrics.message.centerY)).toBeLessThan(1);
        if (alert.alignment === "center") {
          expect(Math.abs(metrics.ok.centerX - metrics.actions.centerX)).toBeLessThan(1);
        } else {
          expect(Math.abs(metrics.ok.right - metrics.actions.right)).toBeLessThan(1);
        }

        if (
          alert.id === "computer-nevermind" ||
          alert.id === "required-file"
        ) {
          await page.screenshot({
            path: testInfo.outputPath(
              `debug-system-alert-${viewport.name}-${alert.id}.png`
            ),
          });
        }

        await closeAlert(page, alert.id === "always-watching");
        await expect(sentinel).toBeFocused();
      }
    });
  }

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
