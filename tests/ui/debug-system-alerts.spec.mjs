import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { isolateProductionPerEventDebug } from "./helpers/random-event-debug.mjs";

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

const installDebugAlertTestBridge = async (page) => {
  const mainSource = await readFile(
    new URL("../../scripts/home/main.js", import.meta.url),
    "utf8"
  );
  const isolatedSource = isolateProductionPerEventDebug(mainSource);
  const zeroDelaySource = isolatedSource.replace(
    "const RANDOM_EVENT_DELAY_MAX_MS = 2000;",
    "const RANDOM_EVENT_DELAY_MAX_MS = 0;"
  );
  const instrumentedSource = zeroDelaySource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__debugSystemAlertsTest = Object.freeze({
  alerts: SYSTEM_ALERTS.map((alert) => ({
    ...alert,
    buttons: alert.buttons.map((button) => ({ ...button })),
  })),
  activeId: () => debugSystemAlertActiveId,
  open(id) {
    const alertIndex = SYSTEM_ALERTS.findIndex((alert) => alert.id === id);
    if (alertIndex < 0) return false;
    return showDebugSystemAlert(SYSTEM_ALERTS[alertIndex]);
  },
  normalize(input) {
    const alert = window.rohinSystemAlerts.normalizeDefinitions([input])[0];
    return {
      ...alert,
      buttons: alert.buttons.map((button) => ({ ...button })),
    };
  },
  openSynthetic(input) {
    const alert = window.rohinSystemAlerts.normalizeDefinitions([input])[0];
    return showDebugSystemAlert(alert);
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

const systemAlertButtons = (page) =>
  page.locator("#debug-system-alert-actions [data-system-alert-action]");

const closeAlert = async (
  page,
  { buttonId = null, key = "Enter", useEscape = false } = {}
) => {
  const win = page.locator("#debug-system-alert-window");
  const button = buttonId
    ? page.locator(
        `#debug-system-alert-actions [data-system-alert-button-id="${buttonId}"]`
      )
    : systemAlertButtons(page).first();
  if (useEscape) {
    await button.press("Escape");
  } else {
    await button.press(key);
  }
  await expect(win).toHaveAttribute("aria-hidden", "true");
  const reducedMotion = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  if (reducedMotion) {
    await expect(win).toBeHidden();
    await expect(win).not.toHaveClass(/is-closing/);
    return;
  }
  await dispatchAnimationEnd(win, "retro-window-close");
  await expect(win).toBeHidden();
};

const waitForSystemAlertIcon = async (page) => {
  const icon = page.locator("#debug-system-alert-icon");
  await expect.poll(
    () =>
      icon.evaluate(
        (image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
      ),
    { message: "system-alert icon should finish decoding" }
  ).toBe(true);
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
    const actions = document.querySelector("#debug-system-alert-actions");
    const actionButtons = Array.from(
      actions.querySelectorAll("[data-system-alert-action]")
    );
    return {
      win: bounds("#debug-system-alert-window"),
      body: bounds("#debug-system-alert-window .window-body"),
      icon: bounds("#debug-system-alert-icon"),
      message: bounds("#debug-system-alert-message"),
      actions: bounds("#debug-system-alert-actions"),
      actionButtons: actionButtons.map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          centerX: rect.left + rect.width / 2,
        };
      }),
      actionsJustifyContent: getComputedStyle(actions).justifyContent,
      imageLoaded:
        image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
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
  await expect(actions).toHaveAttribute("data-button-alignment", alignment);
  const firstButton = metrics.actionButtons[0];
  const lastButton = metrics.actionButtons.at(-1);
  const buttonGroupCenter = (firstButton.left + lastButton.right) / 2;
  if (alignment === "left") {
    expect(metrics.actionsJustifyContent).toBe("flex-start");
    expect(Math.abs(firstButton.left - metrics.actions.left)).toBeLessThan(1);
    return;
  }
  if (alignment === "center") {
    expect(metrics.actionsJustifyContent).toBe("center");
    expect(Math.abs(buttonGroupCenter - metrics.actions.centerX)).toBeLessThan(1);
    return;
  }
  expect(metrics.actionsJustifyContent).toBe("flex-end");
  expect(Math.abs(lastButton.right - metrics.actions.right)).toBeLessThan(1);
};

test("all production system alerts schedule and render through the shared shell", async ({
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
  expect(alerts).toHaveLength(30);
  expect(alerts.filter(({ buttonAlignment }) => buttonAlignment === "right")).toHaveLength(
    30
  );
  expect(alerts.every(({ buttons }) => buttons.length === 1)).toBe(true);
  expect(alerts.map(({ id }) => id)).toContain("substack-reminder");
  expect(alerts.map(({ id }) => id)).toContain("photos");

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
  await expect(systemAlertButtons(page).first()).toBeFocused();
  await expect(win).not.toHaveClass(/is-opening/);
  expect(await win.evaluate((element) => getComputedStyle(element).animationName)).toBe(
    "none"
  );
  await dispatchAnimationEnd(win, "retro-window-open");
  await closeAlert(page);
  await page.evaluate(() => {
    Math.random = () => 0.999999;
  });
  await expect(sentinel).toBeFocused();

  const productionViewports = [
    { width: 375, height: 812, name: "mobile" },
    { width: 1280, height: 800, name: "desktop" },
  ];
  for (const viewport of productionViewports) {
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
        await expect(win).toHaveAccessibleDescription(alert.body);
        await expect(page.locator("#debug-system-alert-title")).toHaveText(alert.title);
        await expect(page.locator("#debug-system-alert-message")).toHaveText(
          alert.body
        );
        await expect(page.locator("#debug-system-alert-icon")).toHaveAttribute(
          "src",
          alert.icon
        );
        const buttons = systemAlertButtons(page);
        await expect(buttons).toHaveCount(alert.buttons.length);
        await expect(buttons.first()).toBeFocused();
        await expect(buttons.first()).toHaveAttribute(
          "data-system-alert-button-id",
          alert.buttons[0].id
        );
        await expect(buttons.first()).toHaveText(alert.buttons[0].label);
        await waitForSystemAlertIcon(page);

        const metrics = await measureAlert(page);
        expect(metrics.imageLoaded).toBe(true);
        expect(metrics.documentOverflow).toBe(false);
        expect(metrics.win.left).toBeGreaterThanOrEqual(11.5);
        expect(metrics.win.top).toBeGreaterThanOrEqual(11.5);
        expect(metrics.win.right).toBeLessThanOrEqual(viewport.width - 11.5);
        expect(metrics.win.bottom).toBeLessThanOrEqual(viewport.height - 63.5);
        expectContained(metrics.icon, metrics.body);
        expectContained(metrics.message, metrics.body);
        for (const actionButton of await buttons.all()) {
          const box = await actionButton.boundingBox();
          expect(box).not.toBeNull();
          expectContained(
            {
              left: box.x,
              top: box.y,
              right: box.x + box.width,
              bottom: box.y + box.height,
            },
            metrics.body
          );
        }
        expect(Math.abs(metrics.icon.centerY - metrics.message.centerY)).toBeLessThan(1);
        await expectAlertActionAlignment(page, metrics, alert.buttonAlignment);
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
          alert.id === "power-cycle-reminder" ||
          alert.id === "social-media" ||
          alert.id === "photos"
        ) {
          await page.screenshot({
            path: testInfo.outputPath(
              `debug-system-alert-${viewport.name}-${alert.id}.png`
            ),
          });
        }

        await closeAlert(page, { useEscape: alert.id === "always-watching" });
        await expect(sentinel).toBeFocused();
      }
    });
  }

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("normalized alert configurations render every alignment and content stress case", async ({
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

  const rawCases = [
    {
      id: "synthetic-default",
      icon: "assets/app-icons/ico/msg_information.ico",
      body: "Defaults create one right-aligned OK button.",
    },
    {
      id: "synthetic-left",
      icon: "assets/app-icons/ico/circle_question.ico",
      body: "Left-aligned action.",
      buttons: [{ id: "continue", label: "Continue", action: "dismiss" }],
      buttonAlignment: "left",
    },
    {
      id: "synthetic-center",
      icon: "assets/app-icons/ico/keys.ico",
      body: "Two centered actions stay in their configured order.",
      buttons: [
        { id: "retry", label: "Retry", action: "dismiss" },
        { id: "cancel", label: "Cancel", action: "dismiss" },
      ],
      buttonAlignment: "center",
    },
    {
      id: "synthetic-long-content",
      title: "System Alert <not markup>",
      icon: "assets/app-icons/ico/pictures.ico",
      body:
        "First line with <strong>plain text</strong> & characters.\n" +
        "Second line contains a deliberately long uninterrupted value: " +
        "this-is-a-long-unbroken-string-that-must-wrap-without-overflowing-the-window-or-viewport.",
      buttons: [
        { id: "first", label: "First", action: "dismiss" },
        { id: "second", label: "Second", action: "dismiss" },
        { id: "third", label: "Third", action: "dismiss" },
      ],
      buttonAlignment: "right",
    },
  ];
  const cases = await page.evaluate((inputs) =>
    inputs.map((input) => window.__debugSystemAlertsTest.normalize(input)), rawCases
  );
  expect(cases[0]).toMatchObject({
    title: "System Alert",
    buttonAlignment: "right",
    buttons: [{ id: "ok", label: "OK", action: "dismiss" }],
  });

  const win = page.locator("#debug-system-alert-window");
  const sentinel = page.locator("#taskbar-clock-button");
  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      for (const [caseIndex, alert] of cases.entries()) {
        await sentinel.focus();
        expect(
          await page.evaluate(
            (input) => window.__debugSystemAlertsTest.openSynthetic(input),
            rawCases[caseIndex]
          )
        ).toBe(true);
        await expect(win).toBeVisible();
        await dispatchAnimationEnd(win, "retro-window-open");
        await expect(win).toHaveAccessibleName(alert.title);
        await expect(win).toHaveAccessibleDescription(alert.body);
        await expect(page.locator("#debug-system-alert-title")).toHaveText(alert.title);
        await expect(page.locator("#debug-system-alert-message")).toHaveText(alert.body);
        await expect(page.locator("#debug-system-alert-message strong")).toHaveCount(0);
        await expect(page.locator("#debug-system-alert-icon")).toHaveAttribute(
          "src",
          alert.icon
        );
        await waitForSystemAlertIcon(page);

        const buttons = systemAlertButtons(page);
        await expect(buttons).toHaveCount(alert.buttons.length);
        await expect(buttons).toHaveText(alert.buttons.map(({ label }) => label));
        await expect(buttons.first()).toBeFocused();
        expect(
          await buttons.evaluateAll((elements) =>
            elements.map((button) => button.dataset.systemAlertButtonId)
          )
        ).toEqual(alert.buttons.map(({ id }) => id));

        const metrics = await measureAlert(page);
        expect(metrics.imageLoaded).toBe(true);
        expect(metrics.documentOverflow).toBe(false);
        expect(metrics.win.left).toBeGreaterThanOrEqual(11.5);
        expect(metrics.win.top).toBeGreaterThanOrEqual(11.5);
        expect(metrics.win.right).toBeLessThanOrEqual(viewport.width - 11.5);
        expect(metrics.win.bottom).toBeLessThanOrEqual(viewport.height - 63.5);
        expect(metrics.messageWhiteSpace).toBe("pre-line");
        await expectAlertActionAlignment(page, metrics, alert.buttonAlignment);

        if (
          (viewport.name === "short-mobile" || viewport.name === "large-desktop") &&
          alert.id === "synthetic-long-content"
        ) {
          await page.screenshot({
            path: testInfo.outputPath(
              `system-alert-${viewport.name}-${alert.id}.png`
            ),
          });
        }

        const lastButtonId = alert.buttons.at(-1).id;
        await closeAlert(page, {
          buttonId: lastButtonId,
          key: alert.id === "synthetic-center" ? "Space" : "Enter",
        });
        await expect(sentinel).toBeFocused();
      }
    });
  }

  await sentinel.focus();
  expect(await page.evaluate(() => window.__debugSystemAlertsTest.open("ram-prices"))).toBe(
    true
  );
  await expect(systemAlertButtons(page).first()).toBeFocused();
  expect(await page.evaluate(() => window.__debugSystemAlertsTest.open("photos"))).toBe(
    false
  );
  await expect(win).toHaveAttribute("data-alert-id", "ram-prices");
  await dispatchAnimationEnd(win, "retro-window-open");
  await closeAlert(page, { useEscape: true });
  await expect(sentinel).toBeFocused();

  expect(await page.evaluate(() => window.__debugSystemAlertsTest.open("ram-prices"))).toBe(
    true
  );
  await expect(systemAlertButtons(page).first()).toBeFocused();
  await dispatchAnimationEnd(win, "retro-window-open");
  await closeAlert(page);
  await expect(sentinel).toBeFocused();

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
  await installDebugAlertTestBridge(page);
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
      buttonAlignment: "right",
      useEscape: false,
    },
    {
      eventId: "debug-system-alert-power-cycle-reminder",
      alertId: "power-cycle-reminder",
      resultMessage: "Triggered System Alert — Power-Cycle Reminder.",
      message:
        "It is important to turn off your computer periodically. Leaving it on for long amounts of time will make it stressed out and sad!",
      icon: "assets/app-icons/ico/shell_window1.ico",
      buttonAlignment: "right",
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
      await waitForSystemAlertIcon(page);
      await expect(systemAlertButtons(page).first()).toBeFocused();
      const metrics = await measureAlert(page);
      await expectAlertActionAlignment(page, metrics, reminder.buttonAlignment);
      expect(
        await page.evaluate(() => window.__debugSystemAlertsTest.cooldownUntil())
      ).toBe(seededCooldown.until);
      await dispatchAnimationEnd(win, "retro-window-open");
      await closeAlert(page, { useEscape: reminder.useEscape });
      await expect(sentinel).toBeFocused();
    });
  }

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
