import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  isolateAllProductionDebug,
  isolateProductionPerEventDebug,
} from "./helpers/random-event-debug.mjs";

test.setTimeout(300_000);

const viewports = [
  { width: 320, height: 568, name: "short-mobile" },
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

const installDebugAlertTestBridge = async (
  page,
  { preserveSystemAlertDebugFlags = false } = {}
) => {
  const mainSource = await readFile(
    new URL("../../scripts/home/main.js", import.meta.url),
    "utf8"
  );
  const isolatedSource = preserveSystemAlertDebugFlags
    ? isolateProductionPerEventDebug(mainSource)
    : isolateAllProductionDebug(mainSource);
  const zeroDelaySource = isolatedSource.replace(
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
  triggerFelizJuevesFallback() {
    return maybeShowFelizJueves();
  },
  startCooldown() {
    recordRandomEventTrigger();
    return randomEventTriggerCooldownUntil;
  },
  cooldownUntil: () => randomEventTriggerCooldownUntil,
});
})();`
  );
  if (
    isolatedSource === mainSource ||
    zeroDelaySource === isolatedSource ||
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
      messageWhiteSpace: getComputedStyle(
        document.querySelector("#debug-system-alert-message")
      ).whiteSpace,
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

const expectAlertActionAlignment = async (page, metrics, alignment) => {
  const actions = page.locator("#debug-system-alert-actions");
  if (alignment === "center") {
    await expect(actions).toHaveClass(/\bis-centered\b/);
    expect(Math.abs(metrics.ok.centerX - metrics.actions.centerX)).toBeLessThan(1);
    return;
  }
  await expect(actions).not.toHaveClass(/\bis-centered\b/);
  expect(Math.abs(metrics.ok.right - metrics.actions.right)).toBeLessThan(1);
};

test("normal system alerts schedule and all alerts render responsively", async ({
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
  expect(alerts).toHaveLength(13);
  expect(alerts.filter(({ alignment }) => alignment === "right")).toHaveLength(6);
  expect(alerts.filter(({ alignment }) => alignment === "center")).toHaveLength(7);
  expect(alerts.filter(({ debug }) => debug).map(({ id }) => id)).toEqual([]);

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
        await expectAlertActionAlignment(page, metrics, alert.alignment);
        if (alert.id === "seneca-announcement") {
          expect(metrics.win.width).toBeCloseTo(
            Math.min(340, viewport.width - 32),
            1
          );
          expect(metrics.icon.width).toBeCloseTo(48, 1);
          expect(metrics.icon.height).toBeCloseTo(48, 1);
          expect(metrics.messageWhiteSpace).toBe("pre-line");
        }

        if (
          alert.id === "computer-nevermind" ||
          alert.id === "required-file" ||
          alert.id === "seneca-announcement" ||
          alert.id === "deodorant-reminder" ||
          alert.id === "power-cycle-reminder"
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

test("reminder alerts respect cooldown and remain directly Admin-triggerable", async ({
  page,
}) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.setFixedTime(new Date("2026-07-30T12:00:00Z"));
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
    localStorage.clear();
  });
  await disableRemoteGameStats(page);
  await installDebugAlertTestBridge(page, {
    preserveSystemAlertDebugFlags: true,
  });
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__debugSystemAlertsTest));

  const win = page.locator("#debug-system-alert-window");
  const sentinel = page.locator("#taskbar-clock-button");

  const seededCooldown = await page.evaluate(() => {
    return {
      now: Date.now(),
      until: window.__debugSystemAlertsTest.startCooldown(),
    };
  });
  expect(seededCooldown.until - seededCooldown.now).toBe(7500);

  await sentinel.focus();
  expect(
    await page.evaluate(() => window.__debugSystemAlertsTest.trigger("pageReload"))
  ).toBe(false);
  await expect(win).toBeHidden();
  expect(
    await page.evaluate(() => window.__debugSystemAlertsTest.cooldownUntil())
  ).toBe(seededCooldown.until);

  const reminders = [
    {
      eventId: "debug-system-alert-deodorant-reminder",
      alertId: "deodorant-reminder",
      resultMessage: "Triggered System Alert — Hygiene Reminder.",
      message:
        "Be sure to shower and wear deodorant! Or don't. I'm just a website, who am I to tell you?",
      icon: "assets/app-icons/ico/user_computer_pair.ico",
      alignment: "right",
      useEscape: false,
    },
    {
      eventId: "debug-system-alert-power-cycle-reminder",
      alertId: "power-cycle-reminder",
      resultMessage: "Triggered System Alert — Power-Cycle Reminder.",
      message:
        "It is important to turn off your computer periodically. Leaving it on for long amounts of time will make it stressed out and sad!",
      icon: "assets/app-icons/ico/shell_window1.ico",
      alignment: "center",
      useEscape: true,
    },
  ];

  for (const reminder of reminders) {
    await test.step(reminder.alertId, async () => {
      await sentinel.focus();
      expect(
        await page.evaluate(
          ({ eventId, alertId }) =>
            window.rohinAdminOrchestrator.runEvent(eventId, {
              source: `${alertId}-debug-off-ui-test`,
            }),
          reminder
        )
      ).toEqual({ ok: true, message: reminder.resultMessage });
      await expect(win).toBeVisible();
      await expect(win).toHaveAttribute("data-alert-id", reminder.alertId);
      await expect(page.locator("#debug-system-alert-title")).toHaveText("System Alert");
      await expect(page.locator("#debug-system-alert-message")).toHaveText(
        reminder.message
      );
      await expect(page.locator("#debug-system-alert-icon")).toHaveAttribute(
        "src",
        reminder.icon
      );
      await expect(page.locator("#debug-system-alert-ok")).toBeFocused();
      const metrics = await measureAlert(page);
      await expectAlertActionAlignment(page, metrics, reminder.alignment);
      expect(
        await page.evaluate(() => window.__debugSystemAlertsTest.cooldownUntil())
      ).toBe(seededCooldown.until);
      await dispatchAnimationEnd(win, "retro-window-open");
      await closeAlert(page, reminder.useEscape);
      await expect(sentinel).toBeFocused();
    });
  }

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
