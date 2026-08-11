import { expect, test } from "./fixtures.mjs";

test.setTimeout(150_000);

const homeUrl = process.env.PLAYWRIGHT_HOME_URL || "/home.html";
const storageKey = "personalSiteAdminControlsV1";
const resetPendingKey = "personalSiteAdminControlsResetPendingV1";
const profileStorageKey = "personalSitePlayerProfileV1";
const administratorProofStorageKey = "personalSiteAdministratorProofV1";
const administratorProfile = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
  rerollCount: 0,
});
const administratorProof = `${"a".repeat(32)}.${"b".repeat(32)}`;
const viewports = [
  { name: "short-mobile", width: 320, height: 568 },
  { name: "mobile", width: 375, height: 812 },
  { name: "short-landscape", width: 568, height: 320 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
];

const disableRemoteGameStats = (page) =>
  page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });',
    })
  );

const preparePage = async (
  page,
  { administratorAccess = "valid", spyOnOrchestratedEvents = false } = {}
) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  const mutatingRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("request", (request) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      mutatingRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.addInitScript(({ access, profile, profileKey, proof, proofKey, spy }) => {
    const initializedKey = "admin-controls-playwright-initialized";
    const firstInitialization = sessionStorage.getItem(initializedKey) !== "true";
    if (firstInitialization) {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem(initializedKey, "true");
      if (access === "valid" || access === "expired") {
        localStorage.setItem(profileKey, JSON.stringify(profile));
        sessionStorage.setItem(
          proofKey,
          JSON.stringify({
            proof,
            expiresAt: new Date(
              Date.now() + (access === "expired" ? -60_000 : 60 * 60_000)
            ).toISOString(),
          })
        );
      }
    }
    Math.random = () => 0.999999;

    if (!spy) return;
    window.__adminOrchestratedEventCalls = [];
    let runtime;
    Object.defineProperty(window, "rohinAdminOrchestrator", {
      configurable: true,
      get: () => runtime,
      set: (value) => {
        runtime = Object.freeze({
          ...value,
          runEvent: async (eventId) => {
            window.__adminOrchestratedEventCalls.push(eventId);
            return { ok: true, message: `Triggered ${eventId}.` };
          },
        });
      },
    });
  }, {
    access: administratorAccess,
    profile: administratorProfile,
    profileKey: profileStorageKey,
    proof: administratorProof,
    proofKey: administratorProofStorageKey,
    spy: spyOnOrchestratedEvents,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await disableRemoteGameStats(page);
  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });

  return { consoleErrors, mutatingRequests, runtimeErrors };
};

const finishWindowAnimation = async (win, animationName) => {
  await win.dispatchEvent("animationend", { animationName });
};

const openAdmin = async (page) => {
  const launcher = page.locator('.taskbar-icon[data-app="admin-controls"]');
  const win = page.locator("#admin-controls-window");
  await launcher.scrollIntoViewIfNeeded();
  await launcher.click();
  await expect(win).toBeVisible();
  await finishWindowAnimation(win, "retro-window-open");
  await expect(win).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("body")).toHaveClass(/is-admin-controls-open/);
  return { launcher, win };
};

const closeAdmin = async (page) => {
  const launcher = page.locator('.taskbar-icon[data-app="admin-controls"]');
  const win = page.locator("#admin-controls-window");
  await win.getByRole("button", { name: "Close" }).click();
  await expect(win).toHaveAttribute("aria-hidden", "true");
  await finishWindowAnimation(win, "retro-window-close");
  await expect(win).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/is-admin-controls-open/);
  await expect(launcher).toBeFocused();
};

const selectAdminTab = async (page, tab) => {
  const button = page.locator(`[data-admin-tab="${tab}"]`);
  const panel = page.locator(`[data-admin-panel="${tab}"]`);
  await button.click();
  await expect(button).toHaveAttribute("aria-selected", "true");
  await expect(panel).toBeVisible();
  return panel;
};

const setLabeledToggle = async (page, id, checked) => {
  const control = page.locator(`#${id}`);
  if ((await control.isChecked()) !== checked) {
    await page.locator(`label[for="${id}"]`).click();
  }
  if (checked) {
    await expect(control).toBeChecked();
  } else {
    await expect(control).not.toBeChecked();
  }
};

const closeManagedWindow = async (win, button) => {
  await button.click();
  await expect(win).toHaveAttribute("aria-hidden", "true");
  await finishWindowAnimation(win, "retro-window-close");
  await expect(win).toBeHidden();
};

test("Admin launchers show only the stand-in without an active Administrator session", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const diagnostics = await preparePage(page, { administratorAccess: "none" });
  await page.locator("#about-window").evaluate((element) => {
    element.classList.remove("is-opening", "is-closing");
    element.classList.add("is-hidden");
    element.setAttribute("aria-hidden", "true");
  });

  const fullAdmin = page.locator("#admin-controls-window");
  const standIn = page.locator("#admin-controls-stand-in-window");
  const standInIcon = standIn.locator(
    'img[src="assets/app-icons/ico/program_manager.ico"]'
  );
  const ok = page.locator("#admin-controls-stand-in-ok");
  const launchers = {
    desktop: page.locator('.desktop-icon[data-app="admin-controls"]'),
    dock: page.locator('.taskbar-icon[data-app="admin-controls"]'),
  };

  for (const [index, viewport] of viewports.entries()) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      const launcher = index % 2 === 0 ? launchers.desktop : launchers.dock;
      await launcher.scrollIntoViewIfNeeded();
      await launcher.focus();
      await launcher.press(index % 2 === 0 ? "Enter" : "Space");

      await expect(standIn).toBeVisible();
      await finishWindowAnimation(standIn, "retro-window-open");
      await expect(standIn).toHaveAttribute("role", "alertdialog");
      await expect(standIn).toHaveAccessibleName("Admin Controls");
      await expect(standIn).toHaveAccessibleDescription("nothing to see here...");
      await expect(fullAdmin).toBeHidden();
      await expect(fullAdmin).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator("body")).not.toHaveClass(/is-admin-controls-open/);
      await expect(ok).toBeFocused();
      await expect(standInIcon).toBeVisible();
      await expect(standInIcon).toHaveCSS("width", "48px");
      await expect(standInIcon).toHaveCSS("height", "48px");
      expect(
        await standInIcon.evaluate((image) => image.complete && image.naturalWidth > 0)
      ).toBe(true);
      await expect(standIn.locator(".random-alert-actions")).toHaveCSS(
        "justify-content",
        "flex-end"
      );

      const metrics = await standIn.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const icon = element.querySelector("img").getBoundingClientRect();
        const action = element.querySelector("#admin-controls-stand-in-ok")
          .getBoundingClientRect();
        const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
        return {
          actionBottom: action.bottom,
          actionRight: action.right,
          bottom: rect.bottom,
          documentOverflow: document.documentElement.scrollWidth > window.innerWidth,
          iconHeight: icon.height,
          iconWidth: icon.width,
          left: rect.left,
          right: rect.right,
          taskbarTop,
          top: rect.top,
          viewportWidth: window.innerWidth,
        };
      });
      expect(metrics.left).toBeGreaterThanOrEqual(0);
      expect(metrics.top).toBeGreaterThanOrEqual(0);
      expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 0.6);
      expect(metrics.bottom).toBeLessThanOrEqual(metrics.taskbarTop + 0.6);
      expect(metrics.actionRight).toBeLessThanOrEqual(metrics.right);
      expect(metrics.actionBottom).toBeLessThanOrEqual(metrics.bottom);
      expect(metrics.iconWidth).toBeGreaterThanOrEqual(46);
      expect(metrics.iconWidth).toBeLessThanOrEqual(51);
      expect(metrics.iconHeight).toBeGreaterThanOrEqual(46);
      expect(metrics.iconHeight).toBeLessThanOrEqual(51);
      expect(metrics.documentOverflow).toBe(false);
      await expect(page.locator("#debug-system-alert-window")).toBeHidden();
      await expect(page.locator("#neko-stream-alert-window")).toBeHidden();

      await page.screenshot({
        path: testInfo.outputPath(`admin-stand-in-${viewport.name}.png`),
      });

      if (index % 2 === 0) {
        await ok.click();
      } else {
        await page.keyboard.press("Escape");
      }
      await expect(standIn).toHaveAttribute("aria-hidden", "true");
      await finishWindowAnimation(standIn, "retro-window-close");
      await expect(standIn).toBeHidden();
      await expect(launcher).toBeFocused();
    });
  }

  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.runtimeErrors).toEqual([]);
  expect(diagnostics.mutatingRequests).toEqual([]);
});

test("an expired Administrator proof is purged and cannot expose Admin Controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const diagnostics = await preparePage(page, { administratorAccess: "expired" });
  const launcher = page.locator('.taskbar-icon[data-app="admin-controls"]');
  await launcher.scrollIntoViewIfNeeded();
  await launcher.click();

  await expect(page.locator("#admin-controls-stand-in-window")).toBeVisible();
  await expect(page.locator("#admin-controls-window")).toBeHidden();
  expect(
    await page.evaluate((proofKey) => sessionStorage.getItem(proofKey),
      administratorProofStorageKey)
  ).toBeNull();
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.runtimeErrors).toEqual([]);
  expect(diagnostics.mutatingRequests).toEqual([]);
});

test("Admin Controls stays contained, scrollable, and keyboard accessible", async ({
  page,
}, testInfo) => {
  const diagnostics = await preparePage(page);
  const launcher = page.locator('.taskbar-icon[data-app="admin-controls"]');
  const desktopLauncher = page.locator('.desktop-icon[data-app="admin-controls"]');
  const launcherIcon = launcher.locator("img");
  const desktopLauncherIcon = desktopLauncher.locator("img");
  const dockGithub = page.locator('.taskbar-icon[data-github-shortcut]');
  const desktopGithub = page.locator('.desktop-icon[data-github-shortcut]');

  for (const candidate of [desktopLauncher, launcher]) {
    await expect(candidate).toHaveCount(1);
    await expect(candidate).toHaveAccessibleName("Admin");
    await expect(candidate).toHaveAttribute("aria-haspopup", "dialog");
    await expect(candidate).toHaveAttribute(
      "aria-controls",
      "admin-controls-window admin-controls-stand-in-window"
    );
  }
  for (const icon of [desktopLauncherIcon, launcherIcon]) {
    await expect(icon).toHaveAttribute("src", "assets/app-icons/ico/program_manager.ico");
    expect(await icon.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  }
  expect(
    await launcher.evaluate((element) =>
      element.nextElementSibling?.hasAttribute("data-github-shortcut")
    )
  ).toBe(true);
  expect(
    await desktopLauncher.evaluate((element) =>
      element.nextElementSibling?.hasAttribute("data-github-shortcut")
    )
  ).toBe(true);
  expect(await dockGithub.evaluate((element) => element.nextElementSibling === null)).toBe(true);
  expect(await desktopGithub.evaluate((element) => element.nextElementSibling === null)).toBe(true);

  await page.setViewportSize({ width: 1280, height: 800 });
  const aboutWindow = page.locator("#about-window");
  await aboutWindow.evaluate((element) => {
    element.classList.remove("is-opening", "is-closing");
    element.classList.add("is-hidden");
    element.setAttribute("aria-hidden", "true");
  });
  await expect(aboutWindow).toBeHidden();
  const adminWindow = page.locator("#admin-controls-window");
  await desktopLauncher.focus();
  await desktopLauncher.press("Enter");
  await expect(adminWindow).toBeVisible();
  await finishWindowAnimation(adminWindow, "retro-window-open");
  await expect(page.locator('[data-admin-tab="run"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(adminWindow).toHaveAttribute("aria-hidden", "true");
  await finishWindowAnimation(adminWindow, "retro-window-close");
  await expect(adminWindow).toBeHidden();
  await expect(desktopLauncher).toBeFocused();

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      const { win } = await openAdmin(page);
      await expect(win).toHaveAccessibleName("Admin Controls");
      await expect(win).toHaveAttribute("role", "dialog");

      for (const tab of ["run", "events", "bindings", "capture"]) {
        await selectAdminTab(page, tab);
      }
      await selectAdminTab(page, "events");
      await page.locator("#admin-event-list").selectOption("dodging-popup-alert");
      const previewMetrics = await page.locator("#admin-panel-events").evaluate((panel) => {
        const browser = panel.querySelector(".admin-event-browser");
        const preview = panel.querySelector("#admin-event-preview");
        const browserStyle = getComputedStyle(browser);
        const previewBounds = preview.getBoundingClientRect();
        const panelBounds = panel.getBoundingClientRect();
        return {
          columnCount: browserStyle.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
          panelClientWidth: panel.clientWidth,
          panelScrollWidth: panel.scrollWidth,
          previewCount: preview.shadowRoot.querySelectorAll(
            '[data-admin-event-preview-window="dodging-popup-alert"]'
          ).length,
          previewLeft: previewBounds.left,
          previewRight: previewBounds.right,
          panelLeft: panelBounds.left,
          panelRight: panelBounds.right,
        };
      });
      expect(previewMetrics.columnCount).toBe(viewport.width <= 480 ? 1 : 2);
      expect(previewMetrics.panelScrollWidth).toBeLessThanOrEqual(
        previewMetrics.panelClientWidth
      );
      expect(previewMetrics.previewCount).toBe(1);
      expect(previewMetrics.previewLeft).toBeGreaterThanOrEqual(
        previewMetrics.panelLeft - 0.6
      );
      expect(previewMetrics.previewRight).toBeLessThanOrEqual(
        previewMetrics.panelRight + 0.6
      );
      await selectAdminTab(page, "run");

      const metrics = await win.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const body = element.querySelector("#admin-controls-body");
        const tabs = element.querySelector(".admin-controls-tabs").getBoundingClientRect();
        const panel = element.querySelector(".admin-controls-panel:not([hidden])");
        const panelRect = panel.getBoundingClientRect();
        const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
        return {
          bodyClientHeight: body.clientHeight,
          bodyScrollHeight: body.scrollHeight,
          bottom: rect.bottom,
          documentOverflow:
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
          left: rect.left,
          panelLeft: panelRect.left,
          panelRight: panelRect.right,
          panelShadow: getComputedStyle(panel).boxShadow,
          raisedControlShadow: getComputedStyle(
            element.querySelector('[data-admin-preset="game-win"]')
          ).boxShadow,
          right: rect.right,
          tabsBottom: tabs.bottom,
          tabsLeft: tabs.left,
          tabsRight: tabs.right,
          panelTop: panelRect.top,
          taskbarTop,
          top: rect.top,
        };
      });
      expect(metrics.left).toBeGreaterThanOrEqual(0);
      expect(metrics.top).toBeGreaterThanOrEqual(0);
      expect(metrics.right).toBeLessThanOrEqual(viewport.width + 0.6);
      expect(metrics.bottom).toBeLessThanOrEqual(metrics.taskbarTop + 0.6);
      expect(metrics.bodyScrollHeight).toBeGreaterThanOrEqual(metrics.bodyClientHeight);
      expect(metrics.documentOverflow).toBe(false);
      expect(Math.abs(metrics.tabsLeft - metrics.panelLeft)).toBeLessThanOrEqual(0.6);
      expect(Math.abs(metrics.tabsRight - metrics.panelRight)).toBeLessThanOrEqual(0.6);
      expect(metrics.tabsBottom).toBeGreaterThanOrEqual(metrics.panelTop);
      expect(metrics.tabsBottom).toBeLessThanOrEqual(metrics.panelTop + 3);
      expect(metrics.panelShadow).toBe(metrics.raisedControlShadow);

      if (["mobile", "short-landscape", "wide"].includes(viewport.name)) {
        await page.screenshot({
          path: testInfo.outputPath(`admin-controls-${viewport.name}.png`),
        });
      }

      if (viewport.name === "mobile") {
        await page.keyboard.press("Escape");
        await expect(win).toHaveAttribute("aria-hidden", "true");
        await finishWindowAnimation(win, "retro-window-close");
        await expect(launcher).toBeFocused();
      } else {
        await closeAdmin(page);
      }

      await dockGithub.scrollIntoViewIfNeeded();
      const launcherMetrics = await page.locator(".taskbar-apps").evaluate((strip) => {
        const bounds = (element) => {
          const rect = element.getBoundingClientRect();
          return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
        };
        return {
          admin: bounds(strip.querySelector('[data-app="admin-controls"]')),
          desktopAdmin: bounds(document.querySelector('.desktop-icon[data-app="admin-controls"]')),
          desktopGithub: bounds(document.querySelector('.desktop-icon[data-github-shortcut]')),
          github: bounds(strip.querySelector("[data-github-shortcut]")),
          strip: bounds(strip),
          taskbarTop: document.querySelector(".taskbar").getBoundingClientRect().top,
        };
      });
      expect(launcherMetrics.admin.left).toBeGreaterThanOrEqual(launcherMetrics.strip.left - 0.6);
      expect(launcherMetrics.github.right).toBeLessThanOrEqual(launcherMetrics.strip.right + 0.6);
      expect(launcherMetrics.admin.right).toBeLessThanOrEqual(launcherMetrics.github.left + 0.6);
      for (const desktopIcon of [
        launcherMetrics.desktopAdmin,
        launcherMetrics.desktopGithub,
      ]) {
        expect(desktopIcon.left).toBeGreaterThanOrEqual(0);
        expect(desktopIcon.right).toBeLessThanOrEqual(viewport.width + 0.6);
        expect(desktopIcon.top).toBeGreaterThanOrEqual(0);
        expect(desktopIcon.bottom).toBeLessThanOrEqual(launcherMetrics.taskbarTop + 0.6);
      }

      if (["short-mobile", "mobile", "desktop", "wide"].includes(viewport.name)) {
        await page.screenshot({
          path: testInfo.outputPath(`admin-launchers-${viewport.name}.png`),
        });
      }
    });
  }

  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.runtimeErrors).toEqual([]);
  expect(diagnostics.mutatingRequests).toEqual([]);
});

test("direct events and fixed seeded controls run locally without duplicate natural events", async ({
  page,
}) => {
  const diagnostics = await preparePage(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(
    await page.locator("#admin-event-preview").evaluate((preview) => preview.shadowRoot === null)
  ).toBe(true);
  await openAdmin(page);

  await selectAdminTab(page, "events");
  const eventList = page.locator("#admin-event-list");
  const eventPreview = page.locator("#admin-event-preview");
  await expect(eventPreview).toHaveRole("img");
  expect(
    await page.evaluate(() =>
      window.rohinAdminOrchestrator
        .listEvents()
        .filter(
          (event) =>
            !(window.rohinAdminOrchestrator.createEventPreview(event.id) instanceof Element)
        )
        .map((event) => event.id)
    )
  ).toEqual([]);
  const eventLabels = await eventList.locator("option").allTextContents();
  const annoyingLabels = eventLabels.filter((label) => label.startsWith("Annoying "));
  expect(annoyingLabels).toEqual([
    "Annoying Dodging Popup Alert",
    "Annoying System Alert",
    "Annoying Vanishing Popup Alert",
  ]);
  expect(eventLabels.indexOf(annoyingLabels.at(-1)) - eventLabels.indexOf(annoyingLabels[0])).toBe(2);

  await eventList.selectOption("dodging-popup-alert");
  await expect(eventPreview).toHaveAttribute(
    "aria-label",
    "First window preview: Annoying Dodging Popup Alert"
  );
  await expect(
    eventPreview.locator('[data-admin-event-preview-window="dodging-popup-alert"]')
  ).toBeVisible();
  await expect(eventPreview.locator("#dodging-popup-window")).toContainText(
    "Is this popup annoying?"
  );
  await expect(eventPreview.locator("#dodging-popup-window")).toHaveAttribute("inert", "");
  await expect(eventPreview.locator("#dodging-popup-window")).toHaveAttribute(
    "aria-hidden",
    "true"
  );
  await expect(eventPreview.locator(".admin-event-preview-stage")).toHaveAttribute(
    "aria-hidden",
    "true"
  );
  await expect(eventPreview.getByRole("button")).toHaveCount(0);
  expect(await eventPreview.ariaSnapshot()).not.toContain("button");

  await eventList.selectOption("mcafee-antivirus-update");
  await expect(eventPreview.locator("#mcafee-prompt-window")).toBeVisible();
  await expect(eventPreview.locator("#mcafee-download-window")).toHaveCount(0);

  await eventList.selectOption("debug-system-alert-seneca-announcement");
  await expect(eventPreview.locator("#debug-system-alert-title")).toHaveText(
    "System Announcement"
  );
  await expect(eventPreview.locator("#debug-system-alert-message")).toContainText(
    "someone else could be handed your days"
  );

  await eventList.selectOption("debug-system-alert-power-cycle-reminder");
  const systemAlertPreviewActions = eventPreview.locator(
    "#debug-system-alert-actions"
  );
  await expect(systemAlertPreviewActions).not.toHaveClass(/\bis-centered\b/);
  await expect(systemAlertPreviewActions).toHaveCSS("justify-content", "flex-end");
  const systemAlertPreviewAlignment = {
    actionsRight: await systemAlertPreviewActions.evaluate(
      (actions) => actions.getBoundingClientRect().right
    ),
    okRight: await eventPreview
      .locator("#debug-system-alert-ok")
      .evaluate((ok) => ok.getBoundingClientRect().right),
  };
  expect(
    Math.abs(
      systemAlertPreviewAlignment.okRight - systemAlertPreviewAlignment.actionsRight
    )
  ).toBeLessThan(1);

  await eventList.selectOption("feliz-jueves");
  await expect(eventPreview.locator("#feliz-jueves-window")).toBeVisible();

  await page.locator("#admin-event-search").fill("vanishing popup");
  await expect(eventList).toHaveValue("vanishing-popup-alert");
  await expect(eventPreview.locator("#vanishing-popup-window")).toBeVisible();
  await page.locator("#admin-event-search").fill("no matching event exists");
  await expect(eventList.locator("option")).toHaveCount(0);
  await expect(eventPreview.locator(".admin-event-preview-empty")).toHaveText(
    "Choose an event to preview its first window."
  );
  await expect(page.locator("#admin-trigger-now")).toBeDisabled();
  await expect(page.locator("#admin-add-cue")).toBeDisabled();
  await page.locator("#admin-event-search").fill("");

  await expect(eventList.locator('option[value="behelit-found"]')).toHaveCount(1);
  const senecaOption = eventList.locator(
    'option[value="debug-system-alert-seneca-announcement"]'
  );
  await expect(senecaOption).toHaveCount(1);
  await expect(senecaOption).toHaveText("System Announcement — Seneca");
  await eventList.selectOption("debug-system-alert-seneca-announcement");
  await page.locator("#admin-trigger-now").click();
  const systemAlert = page.locator(
    "#debug-system-alert-window:not([data-admin-event-preview-window])"
  );
  await expect(systemAlert).toBeVisible();
  await expect(systemAlert).toHaveAttribute("data-alert-id", "seneca-announcement");
  await closeManagedWindow(systemAlert, systemAlert.locator("#debug-system-alert-ok"));

  await eventList.selectOption("behelit-found");
  await page.locator("#admin-trigger-now").click();
  const behelit = page.locator("#behelit-window:not([data-admin-event-preview-window])");
  await expect(behelit).toBeVisible();
  await closeManagedWindow(behelit, behelit.locator("#behelit-ok"));

  await selectAdminTab(page, "bindings");
  await page.locator("#admin-binding-target").selectOption("app:video-editor:taskbar");
  await page.locator("#admin-binding-event").selectOption("behelit-found");
  await setLabeledToggle(page, "admin-binding-once", true);
  await page.locator("#admin-save-binding").click();
  await expect(page.locator("#admin-seed-count")).toHaveText("1");
  await expect(page.locator("#admin-binding-list")).toContainText("Video Editor");

  const target = page.locator('.taskbar-icon[data-app="video-editor"]');
  await expect(target).toHaveAttribute("data-admin-seeded", /.+/);
  await expect(target.locator(".admin-seed-badge")).toBeVisible();
  await closeAdmin(page);
  await expect(target.locator(".admin-seed-badge")).toBeHidden();

  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await target.click();
  const videoDialog = page.locator('[data-app-window="video-editor"]');
  await expect(videoDialog).toBeVisible();
  await expect(behelit).toBeVisible();
  await page.waitForTimeout(2_100);
  await expect(page.locator("#neko-stream-alert-window")).toBeHidden();
  await expect(page.locator("#debug-system-alert-window")).toBeHidden();
  await expect(target).not.toHaveAttribute("data-admin-seeded", /.+/);

  await closeManagedWindow(behelit, behelit.locator("#behelit-ok"));
  await closeManagedWindow(
    videoDialog,
    videoDialog.locator("#video-editor-launch-no")
  );
  await openAdmin(page);
  await selectAdminTab(page, "bindings");
  await expect(page.locator("#admin-seed-count")).toHaveText("0");

  const storage = await page.evaluate((key) => ({
    local: localStorage.getItem(key),
    session: sessionStorage.getItem(key),
  }), storageKey);
  expect(storage.local).not.toBeNull();
  expect(() => JSON.parse(storage.local)).not.toThrow();
  expect(storage.session).toBeNull();

  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.runtimeErrors).toEqual([]);
  expect(diagnostics.mutatingRequests).toEqual([]);
});

test("event previews preserve an initialized first-window state", async ({ page }) => {
  const diagnostics = await preparePage(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openAdmin(page);
  await selectAdminTab(page, "events");

  const eventList = page.locator("#admin-event-list");
  const eventPreview = page.locator("#admin-event-preview");
  await eventList.selectOption("infinity-blade-armory");
  await expect(eventPreview.locator("#infinity-armory-gems [role=gridcell]")).toHaveCount(25);
  await expect(eventPreview.locator("#infinity-armory-gems [data-armory-gem]")).toHaveCount(12);
  await expect(eventPreview.locator("#infinity-armory-level")).toHaveText(
    "Infinity Blade Lvl 1"
  );
  await expect(eventPreview.locator("#infinity-armory-gold")).toHaveText("12000");

  await eventList.selectOption("distress-signal");
  const previewDistressCanvasIsPainted = await eventPreview
    .locator("#distress-signal-canvas")
    .evaluate((canvas) => {
      const blank = document.createElement("canvas");
      blank.width = canvas.width;
      blank.height = canvas.height;
      return canvas.toDataURL() !== blank.toDataURL();
    });
  expect(previewDistressCanvasIsPainted).toBe(true);
  await page.locator("#admin-trigger-now").click();
  const liveDistressWindow = page.locator(
    "#distress-signal-window:not([data-admin-event-preview-window])"
  );
  await expect(liveDistressWindow).toBeVisible();
  expect(
    await liveDistressWindow.locator("#distress-signal-canvas").evaluate((canvas) => {
      const blank = document.createElement("canvas");
      blank.width = canvas.width;
      blank.height = canvas.height;
      return canvas.toDataURL() !== blank.toDataURL();
    })
  ).toBe(true);
  await liveDistressWindow.locator("#distress-signal-close").click();

  await eventList.selectOption("gradescope-curve");
  await expect(eventPreview.locator("#gradescope-curve-path")).toHaveAttribute(
    "d",
    /M 20\.0 132\.0 L/
  );
  await expect(eventPreview.locator("#gradescope-curve-prompt")).toBeVisible();
  await expect(eventPreview.locator("#gradescope-curve-adjust")).toBeHidden();
  const previewCurvePath = await eventPreview.locator("#gradescope-curve-path").getAttribute("d");
  await page.locator("#admin-trigger-now").click();
  const liveGradescopeWindow = page.locator(
    "#gradescope-curve-window:not([data-admin-event-preview-window])"
  );
  await expect(liveGradescopeWindow).toBeVisible();
  await expect(liveGradescopeWindow.locator("#gradescope-curve-path")).toHaveAttribute(
    "d",
    previewCurvePath
  );
  await liveGradescopeWindow.locator("#gradescope-curve-no").click();

  await eventList.selectOption("gears-nest-clear");
  await expect(eventPreview.locator("[data-gears-nest-enemy]")).toHaveCount(5);
  await expect(eventPreview.locator("[data-gears-nest-enemy-cover]")).toHaveCount(4);
  await expect(eventPreview.locator("[data-gears-nest-cover-prop]")).toHaveCount(3);
  await expect(eventPreview.locator("#gears-nest-prompt")).toBeVisible();
  await expect(eventPreview.locator("#gears-nest-status")).toHaveText(
    "Scourge Nest emerging. Engage to clear it."
  );
  await page.locator("#admin-trigger-now").click();
  const liveGearsWindow = page.locator(
    "#gears-nest-window:not([data-admin-event-preview-window])"
  );
  await expect(liveGearsWindow).toBeVisible();
  await expect(liveGearsWindow.locator("[data-gears-nest-enemy]")).toHaveCount(5);
  await expect(liveGearsWindow.locator("[data-gears-nest-enemy-cover]")).toHaveCount(4);
  await expect(liveGearsWindow.locator("[data-gears-nest-cover-prop]")).toHaveCount(3);
  await liveGearsWindow.locator("#gears-nest-retreat").click();

  await eventList.selectOption("relic-recovery");
  await expect(eventPreview.locator("[data-relic-recovery-item]")).toHaveCount(8);
  await expect(eventPreview.locator("[data-relic-recovery-slot]")).toHaveCount(8);
  await expect(eventPreview.locator("#relic-recovery-dialog-text")).toHaveText(
    "Let's collect some relics!"
  );
  expect(await eventPreview.locator("link[rel=stylesheet]").count()).toBe(3);

  await page.locator("#admin-trigger-now").click();
  const liveRelicWindow = page.locator(
    "#relic-recovery-window:not([data-admin-event-preview-window])"
  );
  await expect(liveRelicWindow).toBeVisible();
  await liveRelicWindow.locator("#relic-recovery-start").click();
  await expect(liveRelicWindow.locator("#relic-recovery-dialog")).toBeHidden();

  await eventList.selectOption("dodging-popup-alert");
  await eventList.selectOption("relic-recovery");
  await expect(eventPreview.locator("[data-relic-recovery-item]")).toHaveCount(8);
  await expect(eventPreview.locator("[data-relic-recovery-slot]")).toHaveCount(8);
  await expect(eventPreview.locator("#relic-recovery-dialog-text")).toHaveText(
    "Let's collect some relics!"
  );
  await expect(eventPreview.locator("#relic-recovery-dialog")).toBeVisible();
  expect(await eventPreview.locator("link[rel=stylesheet]").count()).toBe(3);
  await expect(eventPreview.getByRole("button")).toHaveCount(0);

  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.runtimeErrors).toEqual([]);
  expect(diagnostics.mutatingRequests).toEqual([]);
});

test("deterministic sequence bindings and capture settings survive reload", async ({ page }) => {
  const diagnostics = await preparePage(page, { spyOnOrchestratedEvents: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await openAdmin(page);

  await selectAdminTab(page, "capture");
  await page.locator("#admin-sequence-seed").fill("repeatable-promo-take");
  await page.locator("#admin-intensity").selectOption("high");
  await page.locator("#admin-generate-sequence").click();
  const preview = page.locator("#admin-sequence-preview li");
  await expect(preview.first()).toBeVisible();
  const firstPreview = await preview.allTextContents();
  await page.locator("#admin-generate-sequence").click();
  expect(await preview.allTextContents()).toEqual(firstPreview);

  const expected = await page.evaluate(() =>
    window.rohinAdminControls.createSeededSequence(
      "repeatable-promo-take",
      window.rohinAdminOrchestrator.listEvents(),
      2
    )
  );

  await selectAdminTab(page, "bindings");
  await page.locator("#admin-binding-target").selectOption("app:image-tools:taskbar");
  await page.locator("#admin-binding-event").selectOption("__sequence__");
  await setLabeledToggle(page, "admin-binding-repeat", true);
  await page.locator("#admin-save-binding").click();
  await expect(page.locator("#admin-seed-count")).toHaveText("1");

  await page.reload({ waitUntil: "domcontentloaded" });
  await openAdmin(page);
  await selectAdminTab(page, "capture");
  await expect(page.locator("#admin-sequence-seed")).toHaveValue("repeatable-promo-take");
  await expect(page.locator("#admin-intensity")).toHaveValue("high");
  expect(await page.locator("#admin-sequence-preview li").allTextContents()).toEqual(firstPreview);
  await selectAdminTab(page, "bindings");
  await expect(page.locator("#admin-binding-list")).toContainText("Image Tools");
  await closeAdmin(page);

  const target = page.locator('.taskbar-icon[data-app="image-tools"]');
  await target.click();
  await finishWindowAnimation(page.locator('[data-app-window="image-tools"]'), "retro-window-open");
  await target.click();
  await finishWindowAnimation(page.locator('[data-app-window="image-tools"]'), "retro-window-close");
  const calls = await page.evaluate(() => window.__adminOrchestratedEventCalls);
  expect(calls.slice(0, 2)).toEqual(expected);

  const stored = await page.evaluate((key) => ({
    local: JSON.parse(localStorage.getItem(key)),
    session: sessionStorage.getItem(key),
  }), storageKey);
  expect(stored.local).toBeTruthy();
  expect(stored.session).toBeNull();

  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.runtimeErrors).toEqual([]);
  expect(diagnostics.mutatingRequests).toEqual([]);
});

test("capture aids, presets, privacy, media switches, and start-stop controls reflect real state", async ({
  page,
}) => {
  const diagnostics = await preparePage(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openAdmin(page);

  await selectAdminTab(page, "capture");
  await page.locator("#admin-guide").selectOption("vertical");
  await setLabeledToggle(page, "admin-safe-area", true);
  const guide = page.locator("#admin-safe-area-guide");
  await expect(guide).toBeVisible();
  await expect(guide).toHaveAttribute("data-guide", "vertical");
  await expect(page.locator("body")).toHaveClass(/is-admin-safe-area/);

  await setLabeledToggle(page, "admin-audio", false);
  expect(
    await page.locator("audio, video").evaluateAll((media) =>
      media.every((element) => element.muted)
    )
  ).toBe(true);
  await setLabeledToggle(page, "admin-vfx", false);
  await expect(page.locator("body")).toHaveClass(/is-admin-vfx-off/);
  await setLabeledToggle(page, "admin-privacy", true);
  await expect(page.locator("body")).toHaveClass(/is-admin-privacy-mode/);

  await selectAdminTab(page, "events");
  await page.locator("#admin-event-list").selectOption("behelit-found");
  await page.locator("#admin-add-cue").click();
  await selectAdminTab(page, "capture");
  await expect(page.locator("#admin-shot-list li").first()).toBeVisible();
  await page.locator("#admin-show-cue").click();
  await expect(page.locator("#admin-cue-overlay")).toBeVisible();
  await expect(page.locator("#admin-cue-overlay")).not.toHaveText("");

  await selectAdminTab(page, "run");
  await page.locator("#admin-countdown").selectOption("3");
  await setLabeledToggle(page, "admin-hide-before-trigger", false);
  await page.locator("#admin-start-take").click();
  await expect(page.locator("#admin-countdown-overlay")).toBeVisible();
  await expect(page.locator("#admin-stop-take")).toBeEnabled();
  await expect(page.locator('.taskbar-icon[data-app="admin-controls"]')).toHaveClass(
    /is-admin-running/
  );
  await page.locator("#admin-stop-take").click();
  await expect(page.locator("#admin-countdown-overlay")).toBeHidden();
  await expect(page.locator("#admin-stop-take")).toBeDisabled();

  await page.locator("#admin-countdown").selectOption("0");
  const dialogPreset = page.locator('[data-admin-preset="dialog"]');
  await dialogPreset.click();
  const dialog = page.locator('[data-app-window="image-tools"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#image-tools-coming-soon-ok")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveAttribute("aria-hidden", "true");
  await finishWindowAnimation(dialog, "retro-window-close");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#admin-controls-window")).toBeVisible();
  await expect(dialogPreset).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator("#admin-controls-window")).toHaveAttribute(
    "aria-hidden",
    "true"
  );
  await finishWindowAnimation(page.locator("#admin-controls-window"), "retro-window-close");
  await expect(page.locator('.taskbar-icon[data-app="admin-controls"]')).toBeFocused();
  await openAdmin(page);
  await selectAdminTab(page, "run");

  await page.locator('[data-admin-preset="notification"]').click();
  const notification = page.locator("#debug-system-alert-window");
  await expect(notification).toBeVisible();
  await closeManagedWindow(notification, page.locator("#debug-system-alert-ok"));

  await page.locator('[data-admin-preset="desktop-activity"]').click();
  await expect(page.locator('[data-app-window="windows"]')).toBeVisible();
  await expect(page.locator('[data-app-window="taskmgr"]')).toBeVisible();

  await page.locator('[data-admin-preset="game-win"]').click();
  await expect(page.locator('[data-app-window="solitaire"]')).toBeVisible();
  await expect(page.locator("#sol-victory-video-overlay")).toHaveAttribute(
    "aria-hidden",
    "false"
  );
  expect(await page.locator("#sol-victory-video").evaluate((video) => video.muted)).toBe(true);

  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.runtimeErrors).toEqual([]);
  expect(diagnostics.mutatingRequests).toEqual([]);
});

test("picker convenience and Reset Scene preserve local Admin settings", async ({ page }) => {
  const diagnostics = await preparePage(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  const privateValues = {
    lifeCounter: "Private Counter Name",
    profile: "Private Profile Name",
  };
  const lifeCounterName = page.locator(".life-counter-name").first();
  const profileName = page.locator("#game-profile-name");
  await expect(lifeCounterName).toBeAttached();
  await page.evaluate((values) => {
    const lifeInput = document.querySelector(".life-counter-name");
    const profileInput = document.querySelector("#game-profile-name");
    lifeInput.value = values.lifeCounter;
    lifeInput.dispatchEvent(new Event("input", { bubbles: true }));
    profileInput.value = values.profile;
  }, privateValues);

  const { win } = await openAdmin(page);
  await selectAdminTab(page, "capture");
  await page.locator("#admin-intensity").selectOption("high");
  await setLabeledToggle(page, "admin-privacy", true);
  await expect(lifeCounterName).toHaveValue(privateValues.lifeCounter);
  await expect(profileName).toHaveValue(privateValues.profile);
  await expect(lifeCounterName).toHaveAttribute("data-admin-private-input", "");
  await expect(profileName).toHaveAttribute("data-admin-private-input", "");

  await selectAdminTab(page, "bindings");
  const targetSearch = page.locator("#admin-target-search");
  const targetSelect = page.locator("#admin-binding-target");
  await targetSearch.fill("no control has this label");
  await expect(targetSelect.locator("option")).toHaveCount(1);
  await expect(targetSelect).toHaveValue("");

  await page.locator("#admin-pick-target").click();
  await expect(page.locator("body")).toHaveClass(/is-admin-picking-target/);
  await expect(win).toHaveAttribute("aria-hidden", "true");
  await finishWindowAnimation(win, "retro-window-close");

  const target = page.locator('.taskbar-icon[data-app="image-tools"]');
  await expect(target).toHaveAttribute("data-admin-pickable", "");
  await target.click();
  await expect(page.locator("body")).not.toHaveClass(/is-admin-picking-target/);
  await expect(win).toBeVisible();
  await finishWindowAnimation(win, "retro-window-open");
  await expect(targetSearch).toHaveValue("");
  await expect(targetSelect).toHaveValue("app:image-tools:taskbar");

  await page.locator("#admin-binding-event").selectOption("behelit-found");
  await setLabeledToggle(page, "admin-binding-repeat", true);
  await page.locator("#admin-save-binding").click();
  await expect(page.locator("#admin-seed-count")).toHaveText("1");
  await expect(target).toHaveAttribute("data-admin-seeded", "behelit-found");
  await expect(target.locator(".admin-seed-badge")).toBeVisible();

  await selectAdminTab(page, "run");
  await page.evaluate((key) => sessionStorage.setItem(key, "preserve-me"),
    "admin-controls-unrelated-session-value");
  const stateBeforeReset = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  expect(stateBeforeReset).not.toBeNull();

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.locator("#admin-reset-scene").click(),
  ]);
  await page.waitForFunction(() =>
    window.rohinAdminControlsController?.wasResetReload?.() === true
  );

  const storageAfterReset = await page.evaluate(({ adminKey, pendingKey }) => ({
    admin: localStorage.getItem(adminKey),
    pending: sessionStorage.getItem(pendingKey),
    unrelated: sessionStorage.getItem("admin-controls-unrelated-session-value"),
  }), { adminKey: storageKey, pendingKey: resetPendingKey });
  expect(storageAfterReset.admin).toBe(stateBeforeReset);
  expect(storageAfterReset.pending).toBeNull();
  expect(storageAfterReset.unrelated).toBe("preserve-me");

  await openAdmin(page);
  await selectAdminTab(page, "bindings");
  await expect(page.locator("#admin-seed-count")).toHaveText("1");
  await expect(target).toHaveAttribute("data-admin-seeded", "behelit-found");
  await selectAdminTab(page, "capture");
  await expect(page.locator("#admin-intensity")).toHaveValue("high");
  await expect(page.locator("#admin-privacy")).toBeChecked();

  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.runtimeErrors).toEqual([]);
  expect(diagnostics.mutatingRequests).toEqual([]);
});
