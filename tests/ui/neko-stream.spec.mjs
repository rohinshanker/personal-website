import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.setTimeout(120_000);

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const disableRemoteGameStats = (page) =>
  page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });',
    })
  );

const installNekoStreamBridge = async (page) => {
  const mainSource = await readFile(
    new URL("../../scripts/home/main.js", import.meta.url),
    "utf8"
  );
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
const createNekoStreamTestPlan = (specs) =>
  specs.map((spec, index) => {
    const entrySide = spec.entrySide === "right" ? "right" : "left";
    const action = spec.actionName
      ? NEKO_STREAM_ACTIONS.find((candidate) => candidate.name === spec.actionName)
      : null;
    if (spec.actionName && !action) {
      throw new Error(\`Unknown Neko stream action: \${spec.actionName}\`);
    }
    return Object.freeze({
      id: spec.id ?? index,
      spawnDelayMs: Math.max(0, Number(spec.spawnDelayMs) || 0),
      entrySide,
      initialDirection: entrySide === "left" ? 1 : -1,
      initialSpeedMultiplier: Number(spec.initialSpeedMultiplier) || 1,
      action,
      actionTriggerProgress: action
        ? Number(spec.actionTriggerProgress ?? 0.2)
        : null,
      actionDurationMs: action
        ? Number(
            spec.actionDurationMs ??
              action.fixedDurationMs ??
              NEKO_STREAM_NON_SLEEP_ACTION_MIN_MS
          )
        : null,
      postActionDirection: action
        ? (spec.postActionDirection == null
            ? null
            : Number(spec.postActionDirection) < 0
              ? -1
              : 1)
        : null,
      postActionSpeedMultiplier: action
        ? (spec.postActionSpeedMultiplier == null
            ? null
            : Number(spec.postActionSpeedMultiplier) || 1)
        : null,
    });
  });

const readNekoStreamTestSnapshot = () => ({
  animationFrameActive: nekoStreamAnimationFrameId !== null,
  assetsLoaded: nekoRunAssetsLoaded,
  generation: nekoStreamGeneration,
  lastFrameTimestamp: nekoStreamLastFrameTimestamp,
  layerChildCount: nekoStreamLayer?.children.length || 0,
  pendingSpawnCount: nekoStreamSpawnTimerIds.size,
  plannedCount: nekoStreamPlannedCount,
  spawnedCount: nekoStreamSpawnedCount,
  cats: Array.from(nekoStreamCats.values(), (cat) => ({
    actionCompleted: cat.actionCompleted,
    actionCount: cat.actionCount,
    actionDurationMs: cat.actionDurationMs,
    actionName: cat.action?.name || null,
    actionStartedAt: cat.actionStartedAt,
    direction: cat.direction,
    entrySide: cat.entrySide,
    id: cat.id,
    mode: cat.mode,
    postActionDirection: cat.postActionDirection,
    postActionSpeedMultiplier: cat.postActionSpeedMultiplier,
    speedMultiplier: cat.speedMultiplier,
    sprite: cat.element.getAttribute("src"),
    spriteName: cat.element.dataset.sprite,
    x: cat.x,
  })).sort((first, second) => first.id - second.id),
});

const nekoStreamAlertDefinition = randomEventDefinitions.find(
  (definition) => definition.id === "neko-stream-system-alert"
);

const readNekoStreamAlertTestSnapshot = () => ({
  debug: nekoStreamAlertDefinition?.debug === true,
  iconFrame: nekoStreamAlertIconFrame,
  iconTimerActive: nekoStreamAlertIconTimerId !== null,
  pendingDefinition: randomEventPendingDefinitions.has(nekoStreamAlertDefinition),
  responsePending: nekoStreamAlertResponsePending,
  visible: isNekoStreamAlertVisible(),
});

window.__nekoStreamTest = Object.freeze({
  alertSnapshot: readNekoStreamAlertTestSnapshot,
  openAlert: () => showNekoStreamAlert(),
  preloadAlert: () =>
    preloadRandomEventAssets(nekoStreamAlertDefinition, {
      triggerName: "startButton",
      detail: {},
      debug: true,
    }),
  preloadStream: () => preloadNekoRunAssets(),
  scheduleAlert: () =>
    scheduleRandomEventRun(nekoStreamAlertDefinition, {
      triggerName: "startButton",
      detail: {},
      debug: true,
    }),
  triggerAlert: (triggerName = "startButton") => triggerRandomEvents(triggerName),
  snapshot: readNekoStreamTestSnapshot,
  start: (specs) => {
    startNekoStream(createNekoStreamTestPlan(specs));
    return readNekoStreamTestSnapshot();
  },
  stop: () => {
    stopNekoStream();
    return readNekoStreamTestSnapshot();
  },
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the Neko stream test bridge.");
  }
  await page.route("**/scripts/home/main.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedSource,
    })
  );
};

const collectRuntimeErrors = (page) => {
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    requestFailures.push({
      error: request.failure()?.errorText || "unknown failure",
      url: request.url(),
    });
  });
  return { consoleErrors, pageErrors, requestFailures };
};

const preparePage = async (
  page,
  { clock = false, reducedMotion = "no-preference", viewport = viewports[2] } = {}
) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion });
  if (clock) {
    await page.clock.install({ time: new Date("2026-07-29T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-07-29T12:00:10Z"));
  }
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
    localStorage.clear();
    sessionStorage.clear();
  });
  await disableRemoteGameStats(page);
  await installNekoStreamBridge(page);
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => Boolean(window.__nekoStreamTest))).toBe(true);

  const aboutWindow = page.locator("#about-window");
  const aboutClose = aboutWindow.locator('[data-close="about"]');
  if (await aboutClose.isVisible()) {
    await aboutWindow.evaluate((element) => {
      element.classList.add("is-hidden");
      element.setAttribute("aria-hidden", "true");
    });
    await expect(aboutWindow).toBeHidden();
  }
  return runtimeErrors;
};

const readSnapshot = (page) =>
  page.evaluate(() => window.__nekoStreamTest.snapshot());

const startStream = async (page, specs) => {
  const initialSnapshot = await page.evaluate(
    (streamSpecs) => window.__nekoStreamTest.start(streamSpecs),
    specs
  );
  if (initialSnapshot.plannedCount > 0) {
    await expect
      .poll(async () => {
        const snapshot = await readSnapshot(page);
        return snapshot.pendingSpawnCount + snapshot.spawnedCount;
      })
      .toBe(initialSnapshot.plannedCount);
  }
  return readSnapshot(page);
};

const stopStream = (page) =>
  page.evaluate(() => window.__nekoStreamTest.stop());

const readAlertSnapshot = (page) =>
  page.evaluate(() => window.__nekoStreamTest.alertSnapshot());

const dispatchWindowAnimationEnd = (locator, animationName) =>
  locator.evaluate((element, name) => {
    element.dispatchEvent(new AnimationEvent("animationend", { animationName: name }));
  }, animationName);

const finishNekoStreamAlertClose = async (page) => {
  const alert = page.locator("#neko-stream-alert-window");
  await dispatchWindowAnimationEnd(alert, "retro-window-close");
  await expect(alert).toBeHidden();
};

const readNekoStreamAlertGeometry = (page) =>
  page.evaluate(() => {
    const bounds = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return {
        bottom: rect.bottom,
        centerY: rect.top + rect.height / 2,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
    };
    const alert = document.querySelector("#neko-stream-alert-window");
    const icon = document.querySelector("#neko-stream-alert-icon");
    const alertStyles = getComputedStyle(alert);
    return {
      actions: bounds("#neko-stream-alert-actions"),
      alert: bounds("#neko-stream-alert-window"),
      alertAnimationName: alertStyles.animationName,
      alertClassName: alert.className,
      alertClipPath: alertStyles.clipPath,
      alertScale: alertStyles.scale,
      body: bounds("#neko-stream-alert-window .window-body"),
      icon: bounds("#neko-stream-alert-icon"),
      iconImageRendering: getComputedStyle(icon).imageRendering,
      iconLoaded: icon.complete && icon.naturalWidth > 0,
      message: bounds("#neko-stream-alert-message"),
      no: bounds("#neko-stream-alert-no"),
      overflow:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.documentElement.scrollHeight > window.innerHeight,
      yes: bounds("#neko-stream-alert-yes"),
    };
  });

const expectBoundsContained = (inner, outer, tolerance = 0.6) => {
  expect(inner.left).toBeGreaterThanOrEqual(outer.left - tolerance);
  expect(inner.top).toBeGreaterThanOrEqual(outer.top - tolerance);
  expect(inner.right).toBeLessThanOrEqual(outer.right + tolerance);
  expect(inner.bottom).toBeLessThanOrEqual(outer.bottom + tolerance);
};

const readMenuGeometry = (page) =>
  page.evaluate(() => {
    const menu = document.querySelector("#neko-context-menu").getBoundingClientRect();
    const taskbar = document.querySelector(".taskbar").getBoundingClientRect();
    return {
      menu: {
        bottom: menu.bottom,
        left: menu.left,
        right: menu.right,
        top: menu.top,
      },
      taskbarTop: taskbar.top,
      viewport: { height: window.innerHeight, width: window.innerWidth },
    };
  });

const expectMenuContained = (geometry) => {
  expect(geometry.menu.left).toBeGreaterThanOrEqual(5.5);
  expect(geometry.menu.top).toBeGreaterThanOrEqual(5.5);
  expect(geometry.menu.right).toBeLessThanOrEqual(geometry.viewport.width - 5.5);
  expect(geometry.menu.bottom).toBeLessThanOrEqual(geometry.taskbarTop - 5.5);
};

const expectNoRuntimeErrors = (runtimeErrors) => {
  const unexpectedRequestFailures = runtimeErrors.requestFailures.filter(
    ({ error, url }) =>
      !(
        error === "net::ERR_ABORTED" &&
        /\/assets\/neko-assets\/sprites\/[a-z0-9]+\.png(?:\?|$)/.test(url)
      )
  );
  expect(runtimeErrors.consoleErrors).toEqual([]);
  expect(runtimeErrors.pageErrors).toEqual([]);
  expect(unexpectedRequestFailures).toEqual([]);
};

const readNekoPoseMetrics = (page) =>
  page.evaluate(() => {
    const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
    const cats = Array.from(document.querySelectorAll(".neko-stream-cat"));
    return {
      taskbarTop,
      poses: cats.map((cat) => {
        const canvas = document.createElement("canvas");
        canvas.width = cat.naturalWidth;
        canvas.height = cat.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(cat, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let lastOpaqueRow = -1;
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            if (pixels[(y * canvas.width + x) * 4 + 3] > 0) lastOpaqueRow = y;
          }
        }
        const bounds = cat.getBoundingClientRect();
        const renderedRowHeight = bounds.height / canvas.height;
        return {
          actionName: cat.dataset.action,
          mode: cat.dataset.mode,
          opaqueBottom: bounds.top + (lastOpaqueRow + 1) * renderedRowHeight,
          previousRowBottom: bounds.top + lastOpaqueRow * renderedRowHeight,
          spriteName: cat.dataset.sprite,
        };
      }),
    };
  });

const expectNekoPoseAligned = ({ opaqueBottom, previousRowBottom, spriteName }, taskbarTop) => {
  if (spriteName === "sleep1" || spriteName === "sleep2") {
    expect(Math.abs(opaqueBottom - (taskbarTop + 1))).toBeLessThanOrEqual(0.25);
    expect(previousRowBottom).toBeLessThan(taskbarTop);
    return;
  }
  expect(Math.abs(opaqueBottom - taskbarTop)).toBeLessThanOrEqual(0.25);
};

test("the forced debug event shows an animated accessible prompt and No or Escape never starts a stream", async ({
  page,
}, testInfo) => {
  const runtimeErrors = await preparePage(page, { clock: true });
  const alert = page.locator("#neko-stream-alert-window");
  const icon = page.locator("#neko-stream-alert-icon");
  const yes = page.getByRole("button", { name: "Yes", exact: true });
  const no = page.getByRole("button", { name: "No", exact: true });
  const sentinel = page.locator("#taskbar-clock-button");
  const initialStream = await readSnapshot(page);

  await page.evaluate(() => window.__nekoStreamTest.preloadAlert());
  expect((await readAlertSnapshot(page)).debug).toBe(true);
  expect(
    await page.evaluate(() => window.__nekoStreamTest.triggerAlert("windowOpen"))
  ).toBe(false);
  expect((await readAlertSnapshot(page)).pendingDefinition).toBe(false);
  await sentinel.focus();
  expect(
    await page.evaluate(() => [
      window.__nekoStreamTest.triggerAlert(),
      window.__nekoStreamTest.triggerAlert(),
    ])
  ).toEqual([true, false]);
  expect((await readAlertSnapshot(page)).pendingDefinition).toBe(true);
  await page.clock.runFor(1_999);
  await expect(alert).toBeHidden();
  await page.clock.runFor(1);
  await expect(alert).toBeVisible();
  await expect(alert).toHaveAttribute("role", "alertdialog");
  await expect(alert).toHaveAccessibleName("System Alert");
  await expect(alert).toHaveAccessibleDescription("Trigger /nekostream?");
  await expect(icon).toHaveAttribute("alt", "");
  await expect(icon).toHaveAttribute("src", /sleep1\.png$/);
  await page.clock.runFor(17);
  await expect(yes).toBeFocused();
  expect((await readAlertSnapshot(page)).pendingDefinition).toBe(false);
  expect((await readAlertSnapshot(page)).iconTimerActive).toBe(true);

  await page.clock.runFor(832);
  await expect(icon).toHaveAttribute("src", /sleep1\.png$/);
  await page.clock.runFor(1);
  await expect(icon).toHaveAttribute("src", /sleep2\.png$/);
  await page.clock.runFor(850);
  await expect(icon).toHaveAttribute("src", /sleep1\.png$/);

  await no.focus();
  await no.evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await expect(alert).toHaveAttribute("aria-hidden", "true");
  await expect(sentinel).toBeFocused();
  expect((await readAlertSnapshot(page)).iconTimerActive).toBe(false);
  expect((await readSnapshot(page)).generation).toBe(initialStream.generation);
  await finishNekoStreamAlertClose(page);
  await expect(sentinel).toBeFocused();

  expect(await page.evaluate(() => window.__nekoStreamTest.openAlert())).toBe(true);
  await page.clock.runFor(17);
  await expect(yes).toBeFocused();
  await yes.press("Escape");
  await expect(alert).toHaveAttribute("aria-hidden", "true");
  await expect(sentinel).toBeFocused();
  expect((await readSnapshot(page)).generation).toBe(initialStream.generation);
  await finishNekoStreamAlertClose(page);
  await expect(sentinel).toBeFocused();

  expect(await page.evaluate(() => window.__nekoStreamTest.openAlert())).toBe(true);
  expect((await readAlertSnapshot(page)).iconTimerActive).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(alert).not.toHaveClass(/is-opening/);
  await expect(icon).toHaveAttribute("src", /sleep1\.png$/);
  await expect
    .poll(async () => (await readAlertSnapshot(page)).iconTimerActive)
    .toBe(false);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect
    .poll(async () => (await readAlertSnapshot(page)).iconTimerActive)
    .toBe(true);
  await no.click();
  await expect(alert).toHaveClass(/is-closing/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(alert).toBeHidden();
  await expect(alert).not.toHaveClass(/is-closing/);
  await expect(sentinel).toBeFocused();

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.evaluate(() => window.__nekoStreamTest.openAlert())).toBe(true);
  await expect(alert).not.toHaveClass(/is-opening/);
  expect(
    await alert.evaluate((element) => getComputedStyle(element).animationName)
  ).toBe("none");
  await page.clock.runFor(1_700);
  await expect(icon).toHaveAttribute("src", /sleep1\.png$/);
  expect((await readAlertSnapshot(page)).iconTimerActive).toBe(false);
  await no.click();
  await expect(alert).toBeHidden();
  await expect(sentinel).toBeFocused();
  await page.emulateMedia({ reducedMotion: "no-preference" });

  for (const viewport of viewports) {
    await test.step(`prompt-${viewport.name}`, async () => {
      await page.setViewportSize(viewport);
      await sentinel.focus();
      expect(await page.evaluate(() => window.__nekoStreamTest.openAlert())).toBe(true);
      await page.clock.runFor(17);
      await dispatchWindowAnimationEnd(alert, "retro-window-open");
      await expect(yes).toBeFocused();
      const metrics = await readNekoStreamAlertGeometry(page);
      expect(metrics.iconLoaded).toBe(true);
      expect(metrics.iconImageRendering).toBe("pixelated");
      expect(metrics.overflow).toBe(false);
      expect(metrics.alertAnimationName).toBe("none");
      expect(metrics.alertClassName).not.toContain("is-opening");
      expect(metrics.alertClipPath).toBe("none");
      expect(metrics.alertScale).toBe("none");
      expect(metrics.alert.height).toBeGreaterThan(100);
      expect(metrics.alert.width).toBeGreaterThan(300);
      expect(metrics.alert.left).toBeGreaterThanOrEqual(11.5);
      expect(metrics.alert.top).toBeGreaterThanOrEqual(11.5);
      expect(metrics.alert.right).toBeLessThanOrEqual(viewport.width - 11.5);
      expect(metrics.alert.bottom).toBeLessThanOrEqual(viewport.height - 63.5);
      expectBoundsContained(metrics.icon, metrics.body);
      expectBoundsContained(metrics.message, metrics.body);
      expectBoundsContained(metrics.yes, metrics.actions);
      expectBoundsContained(metrics.no, metrics.actions);
      expect(Math.abs(metrics.icon.centerY - metrics.message.centerY)).toBeLessThan(1);
      const semanticSnapshot = await alert.ariaSnapshot();
      expect(semanticSnapshot).toContain("System Alert");
      expect(semanticSnapshot).toContain("Trigger /nekostream?");
      await testInfo.attach(`neko-stream-alert-${viewport.name}.aria.yml`, {
        body: semanticSnapshot,
        contentType: "text/yaml",
      });
      await page.screenshot({
        path: testInfo.outputPath(`neko-stream-alert-${viewport.name}.png`),
      });
      await no.click();
      await finishNekoStreamAlertClose(page);
      await expect(sentinel).toBeFocused();
    });
  }

  expectNoRuntimeErrors(runtimeErrors);
});

test("Yes closes the prompt and starts exactly one complete forty-cat stream", async ({
  page,
}) => {
  const runtimeErrors = await preparePage(page, { clock: true });
  const alert = page.locator("#neko-stream-alert-window");
  const yes = page.locator("#neko-stream-alert-yes");
  const sentinel = page.locator("#taskbar-clock-button");
  await page.evaluate(() => window.__nekoStreamTest.preloadStream());
  await sentinel.focus();
  const before = await readSnapshot(page);
  expect(await page.evaluate(() => window.__nekoStreamTest.openAlert())).toBe(true);
  await page.clock.runFor(17);
  await expect(yes).toBeFocused();

  await yes.evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await expect(alert).toHaveAttribute("aria-hidden", "true");
  await expect(sentinel).toBeFocused();
  let after = await readSnapshot(page);
  expect(after.generation).toBe(before.generation + 1);
  expect(after.plannedCount).toBe(40);
  expect(after.pendingSpawnCount + after.spawnedCount).toBe(40);
  expect((await readAlertSnapshot(page)).iconTimerActive).toBe(false);

  await yes.dispatchEvent("click");
  after = await readSnapshot(page);
  expect(after.generation).toBe(before.generation + 1);
  expect(after.plannedCount).toBe(40);
  await finishNekoStreamAlertClose(page);
  await expect(sentinel).toBeFocused();

  await page.clock.runFor(10_000);
  after = await readSnapshot(page);
  expect(after.spawnedCount).toBe(40);
  expect(after.pendingSpawnCount).toBe(0);
  await stopStream(page);
  expectNoRuntimeErrors(runtimeErrors);
});

test("both Neko launchers provide the bounded /nekostream menu without changing left-click behavior", async ({
  page,
}) => {
  const runtimeErrors = await preparePage(page, { reducedMotion: "reduce" });
  const desktopLauncher = page.locator('.desktop-icon[data-app="neko"]');
  const taskbarLauncher = page.locator('.taskbar [data-app="neko"]');
  const menu = page.getByRole("menu", { name: "Neko commands" });
  const command = page.getByRole("menuitem", { name: "/nekostream" });

  await desktopLauncher.click({ button: "right" });
  await expect(menu).toBeVisible();
  await expect(command).toBeFocused();
  await expect(desktopLauncher).toHaveAttribute("aria-expanded", "true");
  await expect(taskbarLauncher).toHaveAttribute("aria-expanded", "false");
  await expect(menu.getByRole("menuitem")).toHaveCount(1);
  await expect(page.locator(".desktop-neko-cat")).toHaveCount(0);
  expectMenuContained(await readMenuGeometry(page));

  await command.press("Escape");
  await expect(menu).toBeHidden();
  await expect(desktopLauncher).toBeFocused();
  await expect(desktopLauncher).toHaveAttribute("aria-expanded", "false");
  await expect(desktopLauncher).toHaveCSS("outline-style", "dotted");

  await desktopLauncher.click({ button: "right" });
  await command.press("Tab");
  await expect(menu).toBeHidden();
  await expect(page.locator('.desktop-icon[data-app="sudoku"]')).toBeFocused();

  await desktopLauncher.click({ button: "right" });
  await command.press("Shift+Tab");
  await expect(menu).toBeHidden();
  await expect(page.locator('.desktop-icon[data-app="snake"]')).toBeFocused();

  await desktopLauncher.focus();
  await desktopLauncher.press("Shift+F10");
  await page.setViewportSize({ width: 1_279, height: 800 });
  await expect(menu).toBeHidden();
  await expect(desktopLauncher).toBeFocused();
  await page.setViewportSize(viewports[2]);

  await taskbarLauncher.focus();
  await taskbarLauncher.press("Shift+F10");
  await expect(command).toBeFocused();
  await expect(taskbarLauncher).toHaveAttribute("aria-expanded", "true");
  expectMenuContained(await readMenuGeometry(page));
  await page.locator(".taskbar-apps").evaluate((apps) => {
    apps.scrollLeft += 44;
    apps.dispatchEvent(new Event("scroll"));
  });
  await expect(menu).toBeHidden();
  await expect(taskbarLauncher).toBeFocused();

  await taskbarLauncher.press("Shift+F10");
  await expect(command).toBeFocused();
  await page.mouse.click(500, 200);
  await expect(menu).toBeHidden();
  await expect(taskbarLauncher).toHaveAttribute("aria-expanded", "false");

  await taskbarLauncher.focus();
  await taskbarLauncher.press("ContextMenu");
  await expect(command).toBeFocused();
  await command.click();
  await expect(menu).toBeHidden();
  await expect(taskbarLauncher).toBeFocused();
  await expect
    .poll(async () => (await readSnapshot(page)).pendingSpawnCount)
    .toBe(40);
  const firstWave = await readSnapshot(page);
  expect(firstWave.plannedCount).toBe(40);
  expect(firstWave.pendingSpawnCount).toBe(40);
  expect(firstWave.layerChildCount).toBe(0);

  await taskbarLauncher.click({ button: "right" });
  await command.click();
  await expect
    .poll(async () => (await readSnapshot(page)).pendingSpawnCount)
    .toBe(40);
  const replacementWave = await readSnapshot(page);
  expect(replacementWave.generation).toBe(firstWave.generation + 1);
  expect(replacementWave.plannedCount).toBe(40);
  expect(replacementWave.pendingSpawnCount).toBe(40);
  expect(replacementWave.layerChildCount).toBe(0);
  await stopStream(page);

  await desktopLauncher.click();
  await expect(menu).toBeHidden();
  await expect(page.locator(".desktop-neko-cat")).toHaveCount(1);
  expectNoRuntimeErrors(runtimeErrors);
});

test("the real /nekostream command schedules and spawns its complete default wave", async ({
  page,
}) => {
  const runtimeErrors = await preparePage(page, { clock: true });
  const desktopLauncher = page.locator('.desktop-icon[data-app="neko"]');
  const command = page.getByRole("menuitem", { name: "/nekostream" });
  await desktopLauncher.dispatchEvent("contextmenu", {
    bubbles: true,
    button: 2,
    cancelable: true,
    clientX: 128,
    clientY: 128,
  });
  await expect(command).toBeFocused();
  await expect
    .poll(async () => (await readSnapshot(page)).assetsLoaded)
    .toBe(true);

  await page.evaluate(() => {
    let seed = 0x5eed1234;
    Math.random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed / 0x1_0000_0000;
    };
  });
  await command.dispatchEvent("click");
  await page.evaluate(() => {
    Math.random = () => 0.999999;
  });
  for (let expectedSpawnedCount = 1; expectedSpawnedCount <= 40; expectedSpawnedCount += 1) {
    await page.clock.runFor(250);
    expect((await readSnapshot(page)).spawnedCount).toBe(expectedSpawnedCount);
  }

  const snapshot = await readSnapshot(page);
  expect(snapshot.plannedCount).toBe(40);
  expect(snapshot.spawnedCount).toBe(40);
  expect(snapshot.pendingSpawnCount).toBe(0);
  expect(snapshot.cats.length).toBeGreaterThan(0);
  expect(new Set(snapshot.cats.map(({ entrySide }) => entrySide))).toEqual(
    new Set(["left", "right"])
  );
  expect(snapshot.cats.some(({ actionName }) => actionName !== null)).toBe(true);
  snapshot.cats.forEach(({ speedMultiplier }) => {
    expect(speedMultiplier).toBeGreaterThanOrEqual(0.8);
    expect(speedMultiplier).toBeLessThanOrEqual(1.7);
  });
  await stopStream(page);
  expectNoRuntimeErrors(runtimeErrors);
});

test("one shared runtime spawns forty cats, preserves canonical speed, completes each action once, and cleans up", async ({
  page,
}) => {
  const runtimeErrors = await preparePage(page, { clock: true });
  const wave = Array.from({ length: 40 }, (_, index) => ({
    entrySide: index % 2 === 0 ? "left" : "right",
    initialSpeedMultiplier: 0.8,
    spawnDelayMs: (index / 39) * 10_000,
  }));
  await startStream(page, wave);
  await page.clock.runFor(9_999);
  let snapshot = await readSnapshot(page);
  expect(snapshot.spawnedCount).toBe(39);
  expect(snapshot.pendingSpawnCount).toBe(1);
  expect(snapshot.cats).toHaveLength(39);

  await page.clock.runFor(1);
  snapshot = await readSnapshot(page);
  expect(snapshot.spawnedCount).toBe(40);
  expect(snapshot.pendingSpawnCount).toBe(0);
  expect(snapshot.cats).toHaveLength(40);
  expect(new Set(snapshot.cats.map(({ entrySide }) => entrySide))).toEqual(
    new Set(["left", "right"])
  );
  snapshot.cats.forEach(({ speedMultiplier }) => {
    expect(speedMultiplier).toBeGreaterThanOrEqual(0.8);
    expect(speedMultiplier).toBeLessThanOrEqual(1.7);
  });

  await stopStream(page);
  await startStream(page, [
    { entrySide: "left", initialSpeedMultiplier: 1.2, spawnDelayMs: 0 },
  ]);
  await page.clock.runFor(34);
  const beforeMovement = (await readSnapshot(page)).cats[0];
  await page.clock.runFor(100);
  const afterMovement = (await readSnapshot(page)).cats[0];
  expect(afterMovement.x - beforeMovement.x).toBeGreaterThanOrEqual(10);
  expect(afterMovement.x - beforeMovement.x).toBeLessThanOrEqual(14);
  await page.clock.runFor(15_000);
  snapshot = await readSnapshot(page);
  expect(snapshot.cats).toHaveLength(0);
  expect(snapshot.layerChildCount).toBe(0);
  expect(snapshot.pendingSpawnCount).toBe(0);
  expect(snapshot.animationFrameActive).toBe(false);

  await page.setViewportSize({ width: 375, height: 812 });
  const actionWave = ["sit", "scratch", "clean", "yawn", "sleep"].map(
    (actionName, index) => ({
      actionName,
      actionTriggerProgress: 0.2,
      entrySide: index % 2 === 0 ? "left" : "right",
      initialSpeedMultiplier: 1.7,
      postActionDirection: index % 2 === 0 ? -1 : 1,
      postActionSpeedMultiplier: 0.8 + index * 0.2,
      actionDurationMs:
        actionName === "sleep" ? 20_000 : actionName === "yawn" ? 3_000 : 10_000,
      spawnDelayMs: 0,
    })
  );
  await startStream(page, actionWave);
  await page.clock.runFor(700);
  snapshot = await readSnapshot(page);
  expect(snapshot.cats.map(({ mode }) => mode)).toEqual([
    "sit",
    "scratch",
    "clean",
    "yawn",
    "sleep",
  ]);
  expect(snapshot.cats.map(({ actionCount }) => actionCount)).toEqual([1, 1, 1, 1, 1]);
  snapshot.cats.forEach(({ x }) => {
    expect(x).toBeGreaterThanOrEqual(21);
    expect(x).toBeLessThanOrEqual(354);
  });
  const actionLaneMetrics = await readNekoPoseMetrics(page);
  actionLaneMetrics.poses.forEach((pose) =>
    expectNekoPoseAligned(pose, actionLaneMetrics.taskbarTop)
  );
  const sleepingLaneMetrics = actionLaneMetrics.poses.find(
    ({ actionName }) => actionName === "sleep"
  );
  expect(sleepingLaneMetrics).toBeDefined();
  expect(sleepingLaneMetrics.opaqueBottom).toBeGreaterThan(
    actionLaneMetrics.taskbarTop
  );
  const stoppedPositions = new Map(snapshot.cats.map(({ id, x }) => [id, x]));

  await page.clock.runFor(200);
  snapshot = await readSnapshot(page);
  snapshot.cats.forEach(({ id, x }) => expect(x).toBeCloseTo(stoppedPositions.get(id), 5));
  expect(snapshot.cats.find(({ actionName }) => actionName === "sleep").sprite).toMatch(
    /sleep1\.png$/
  );
  expect(snapshot.cats.find(({ actionName }) => actionName === "clean").spriteName).toBe(
    "awake"
  );
  expect(snapshot.cats.find(({ actionName }) => actionName === "yawn").spriteName).toBe(
    "yawn1"
  );

  const scratchSprite = snapshot.cats.find(
    ({ actionName }) => actionName === "scratch"
  ).sprite;
  await page.clock.runFor(100);
  snapshot = await readSnapshot(page);
  expect(snapshot.cats.find(({ actionName }) => actionName === "scratch").sprite).not.toBe(
    scratchSprite
  );

  await page.clock.runFor(800);
  snapshot = await readSnapshot(page);
  expect(snapshot.cats.map(({ mode }) => mode)).toEqual([
    "sit",
    "scratch",
    "clean",
    "yawn",
    "sleep",
  ]);
  expect(snapshot.cats.find(({ actionName }) => actionName === "clean").spriteName).toBe(
    "wash1"
  );
  expect(snapshot.cats.find(({ actionName }) => actionName === "yawn").spriteName).toBe(
    "yawn2"
  );
  expect(snapshot.cats.find(({ actionName }) => actionName === "sleep").sprite).toMatch(
    /sleep2\.png$/
  );

  const cleanCat = snapshot.cats.find(({ actionName }) => actionName === "clean");
  const cleanElapsedMs = snapshot.lastFrameTimestamp - cleanCat.actionStartedAt;
  await page.clock.runFor(Math.ceil(3_000 - cleanElapsedMs + 34));
  snapshot = await readSnapshot(page);
  expect(snapshot.cats.find(({ actionName }) => actionName === "clean").spriteName).toBe(
    "awake"
  );
  expect(snapshot.cats.find(({ actionName }) => actionName === "yawn").mode).toBe(
    "running"
  );

  await page.clock.runFor(4_000);
  snapshot = await readSnapshot(page);
  expect(snapshot.cats.map(({ mode }) => mode)).toEqual([
    "sit",
    "scratch",
    "clean",
    "sleep",
  ]);
  expect(snapshot.cats.map(({ actionCompleted }) => actionCompleted)).toEqual([
    false,
    false,
    false,
    false,
  ]);
  snapshot.cats
    .filter(({ actionName }) => actionName !== "yawn")
    .forEach(({ id, x }) => expect(x).toBeCloseTo(stoppedPositions.get(id), 5));

  const delayedWave = Array.from({ length: 20 }, (_, index) => ({
    id: index,
    spawnDelayMs: 10_000,
  }));
  const firstDelayed = await startStream(page, delayedWave);
  const replacementDelayed = await startStream(
    page,
    Array.from({ length: 40 }, (_, index) => ({ id: index, spawnDelayMs: 30_000 }))
  );
  expect(firstDelayed.pendingSpawnCount).toBe(20);
  expect(replacementDelayed.generation).toBe(firstDelayed.generation + 1);
  expect(replacementDelayed.pendingSpawnCount).toBe(40);
  expect(replacementDelayed.layerChildCount).toBe(0);
  await page.clock.runFor(20_500);
  snapshot = await readSnapshot(page);
  expect(snapshot.generation).toBe(replacementDelayed.generation);
  expect(snapshot.pendingSpawnCount).toBe(40);
  expect(snapshot.spawnedCount).toBe(0);
  expect(snapshot.cats).toHaveLength(0);
  expect(snapshot.layerChildCount).toBe(0);
  expect(snapshot.animationFrameActive).toBe(false);
  snapshot = await stopStream(page);
  expect(snapshot.pendingSpawnCount).toBe(0);
  expect(snapshot.layerChildCount).toBe(0);
  expect(snapshot.animationFrameActive).toBe(false);
  expectNoRuntimeErrors(runtimeErrors);
});

test("each stream action honors its planned long duration and completes exactly once", async ({
  page,
}) => {
  const runtimeErrors = await preparePage(page, {
    clock: true,
    viewport: { width: 375, height: 812 },
  });
  const actionCases = [
    { actionName: "sit", actionDurationMs: 5_000 },
    { actionName: "scratch", actionDurationMs: 7_500 },
    { actionName: "clean", actionDurationMs: 10_000 },
    { actionName: "yawn", actionDurationMs: 3_000 },
    { actionName: "sleep", actionDurationMs: 20_000 },
  ];

  for (const actionCase of actionCases) {
    await test.step(`${actionCase.actionName}-${actionCase.actionDurationMs}`, async () => {
      await startStream(page, [
        {
          ...actionCase,
          actionTriggerProgress: 0.2,
          entrySide: "left",
          initialSpeedMultiplier: 1.7,
          postActionDirection: -1,
          postActionSpeedMultiplier: 0.8,
          spawnDelayMs: 0,
        },
      ]);
      await page.clock.runFor(700);
      let snapshot = await readSnapshot(page);
      let cat = snapshot.cats[0];
      expect(cat.mode).toBe(actionCase.actionName);
      expect(cat.actionDurationMs).toBe(actionCase.actionDurationMs);
      expect(cat.actionCount).toBe(1);
      expect(cat.actionCompleted).toBe(false);
      const stoppedX = cat.x;

      if (actionCase.actionName === "scratch") {
        await page.clock.runFor(3_000);
        const firstLoopSnapshot = await readSnapshot(page);
        const firstLoopCat = firstLoopSnapshot.cats[0];
        const firstLoopSprite = firstLoopCat.sprite;
        const elapsedWithinFrameMs =
          (firstLoopSnapshot.lastFrameTimestamp - firstLoopCat.actionStartedAt) % 100;
        await page.clock.runFor(134 - elapsedWithinFrameMs);
        const secondLoopSprite = (await readSnapshot(page)).cats[0].sprite;
        expect(secondLoopSprite).not.toBe(firstLoopSprite);
      }

      snapshot = await readSnapshot(page);
      cat = snapshot.cats[0];
      const elapsedMs = snapshot.lastFrameTimestamp - cat.actionStartedAt;
      const beforeDeadlineMs = Math.max(
        0,
        Math.floor(actionCase.actionDurationMs - elapsedMs - 20)
      );
      await page.clock.runFor(beforeDeadlineMs);
      cat = (await readSnapshot(page)).cats[0];
      expect(cat.mode).toBe(actionCase.actionName);
      expect(cat.actionCompleted).toBe(false);
      expect(cat.x).toBeCloseTo(stoppedX, 5);

      await page.clock.runFor(50);
      cat = (await readSnapshot(page)).cats[0];
      expect(cat.mode).toBe("running");
      expect(cat.actionCompleted).toBe(true);
      expect(cat.actionCount).toBe(1);
      expect(cat.direction).toBe(cat.postActionDirection);
      expect(cat.speedMultiplier).toBe(cat.postActionSpeedMultiplier);

      await page.clock.runFor(100);
      cat = (await readSnapshot(page)).cats[0];
      expect(cat.actionCount).toBe(1);
      expect(cat.x).toBeLessThan(stoppedX);
      await stopStream(page);
    });
  }

  await startStream(page, [
    {
      actionDurationMs: 5_000,
      actionName: "sit",
      actionTriggerProgress: 0.2,
      entrySide: "left",
      initialSpeedMultiplier: 1.7,
      spawnDelayMs: 0,
    },
    {
      actionDurationMs: 5_000,
      actionName: "sit",
      actionTriggerProgress: 0.2,
      entrySide: "right",
      initialSpeedMultiplier: 1.7,
      spawnDelayMs: 0,
    },
  ]);
  await page.clock.runFor(700);
  let snapshot = await readSnapshot(page);
  expect(snapshot.cats.map(({ mode }) => mode)).toEqual(["sit", "sit"]);
  expect(snapshot.cats.map(({ postActionDirection }) => postActionDirection)).toEqual([
    null,
    null,
  ]);
  expect(
    snapshot.cats.map(({ postActionSpeedMultiplier }) => postActionSpeedMultiplier)
  ).toEqual([null, null]);
  await page.evaluate(() => {
    const completionRolls = [0, 0, 1, 1];
    let completionRollIndex = 0;
    Math.random = () => completionRolls[completionRollIndex++] ?? 1;
  });
  const sampledActionElapsedMs =
    snapshot.lastFrameTimestamp - snapshot.cats[0].actionStartedAt;
  await page.clock.runFor(Math.ceil(5_000 - sampledActionElapsedMs + 50));
  snapshot = await readSnapshot(page);
  expect(snapshot.cats.map(({ direction }) => direction)).toEqual([-1, 1]);
  expect(snapshot.cats.map(({ speedMultiplier }) => speedMultiplier)).toEqual([0.8, 1.7]);
  expect(snapshot.cats.map(({ actionCompleted }) => actionCompleted)).toEqual([true, true]);
  expect(snapshot.cats.map(({ actionCount }) => actionCount)).toEqual([1, 1]);
  await stopStream(page);

  await page.setViewportSize({ width: 1_440, height: 900 });
  await startStream(page, [
    {
      actionDurationMs: 20_000,
      actionName: "sleep",
      actionTriggerProgress: 0.8,
      entrySide: "left",
      initialSpeedMultiplier: 1.7,
      spawnDelayMs: 0,
    },
  ]);
  await page.clock.runFor(7_200);
  expect((await readSnapshot(page)).cats[0].mode).toBe("sleep");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.runFor(34);
  snapshot = await readSnapshot(page);
  expect(snapshot.cats).toHaveLength(0);
  expect(snapshot.layerChildCount).toBe(0);
  expect(snapshot.animationFrameActive).toBe(false);

  await startStream(page, [
    {
      actionDurationMs: 20_000,
      actionName: "sleep",
      actionTriggerProgress: 0.2,
      entrySide: "left",
      initialSpeedMultiplier: 1.7,
      spawnDelayMs: 0,
    },
  ]);
  await page.clock.runFor(700);
  expect((await readSnapshot(page)).cats[0].mode).toBe("sleep");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  snapshot = await readSnapshot(page);
  expect(snapshot.cats).toHaveLength(0);
  expect(snapshot.layerChildCount).toBe(0);
  expect(snapshot.pendingSpawnCount).toBe(0);
  expect(snapshot.animationFrameActive).toBe(false);
  await page.clock.runFor(20_500);
  snapshot = await readSnapshot(page);
  expect(snapshot.cats).toHaveLength(0);
  expect(snapshot.layerChildCount).toBe(0);
  expect(snapshot.animationFrameActive).toBe(false);
  expectNoRuntimeErrors(runtimeErrors);
});

test("the taskbar stream and menu remain layered, contained, and usable at every target viewport", async ({
  page,
}, testInfo) => {
  const runtimeErrors = await preparePage(page, { clock: true });

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      const visualWave = Array.from({ length: 40 }, (_, index) => ({
        entrySide: index % 2 === 0 ? "left" : "right",
        initialSpeedMultiplier: 0.8 + (index % 10) * 0.1,
        spawnDelayMs: index * 25,
      }));
      await startStream(page, visualWave);
      await page.clock.runFor(1_500);
      expect((await readSnapshot(page)).cats).toHaveLength(40);

      await page.locator('.taskbar [data-app="neko"]').evaluate(
        (launcher, coordinates) => {
          launcher.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              button: 2,
              cancelable: true,
              clientX: coordinates.x,
              clientY: coordinates.y,
            })
          );
        },
        { x: viewport.width - 1, y: viewport.height - 1 }
      );
      await expect(page.getByRole("menuitem", { name: "/nekostream" })).toBeFocused();
      expectMenuContained(await readMenuGeometry(page));
      const menuSnapshot = await page
        .getByRole("menu", { name: "Neko commands" })
        .ariaSnapshot();
      expect(menuSnapshot).toContain("/nekostream");
      await testInfo.attach(`neko-stream-menu-${viewport.name}.aria.yml`, {
        body: menuSnapshot,
        contentType: "text/yaml",
      });

      const metrics = await page.evaluate(() => {
        const taskbar = document.querySelector(".taskbar").getBoundingClientRect();
        const layer = document.querySelector("#neko-stream-layer");
        const cats = Array.from(document.querySelectorAll(".neko-stream-cat"));
        return {
          catBounds: cats.map((cat) => {
            const bounds = cat.getBoundingClientRect();
            return {
              bottom: bounds.bottom,
              top: bounds.top,
            };
          }),
          catsAreDecorative: cats.every(
            (cat) => cat.getAttribute("alt") === "" && cat.getAttribute("aria-hidden") === "true"
          ),
          imagesLoaded: cats.every((cat) => cat.complete && cat.naturalWidth > 0),
          layerPointerEvents: getComputedStyle(layer).pointerEvents,
          layerZIndex: getComputedStyle(layer).zIndex,
          overflow:
            document.documentElement.scrollWidth > window.innerWidth ||
            document.documentElement.scrollHeight > window.innerHeight,
          taskbar: { bottom: taskbar.bottom, top: taskbar.top },
        };
      });
      expect(metrics.layerPointerEvents).toBe("none");
      expect(metrics.layerZIndex).toBe("10001");
      expect(metrics.catsAreDecorative).toBe(true);
      expect(metrics.imagesLoaded).toBe(true);
      expect(metrics.overflow).toBe(false);
      const runningPoseMetrics = await readNekoPoseMetrics(page);
      const runningSpriteNames = new Set(
        runningPoseMetrics.poses.map(({ spriteName }) => spriteName)
      );
      for (const spriteName of ["left1", "left2", "right1", "right2"]) {
        expect(runningSpriteNames.has(spriteName)).toBe(true);
      }
      runningPoseMetrics.poses.forEach((pose) =>
        expectNekoPoseAligned(pose, runningPoseMetrics.taskbarTop)
      );

      await page.screenshot({
        path: testInfo.outputPath(`neko-stream-${viewport.name}.png`),
      });
      await page.getByRole("menuitem", { name: "/nekostream" }).press("Escape");
      await stopStream(page);

      await startStream(page, [
        {
          actionDurationMs: 10_000,
          actionName: "sit",
          actionTriggerProgress: 0.2,
          entrySide: "left",
          initialSpeedMultiplier: 1.7,
          spawnDelayMs: 0,
        },
        {
          actionDurationMs: 10_000,
          actionName: "scratch",
          actionTriggerProgress: 0.3,
          entrySide: "left",
          initialSpeedMultiplier: 1.7,
          spawnDelayMs: 0,
        },
        {
          actionDurationMs: 3_000,
          actionName: "yawn",
          actionTriggerProgress: 0.4,
          entrySide: "left",
          initialSpeedMultiplier: 1.7,
          spawnDelayMs: 0,
        },
        {
          actionDurationMs: 10_000,
          actionName: "clean",
          actionTriggerProgress: 0.3,
          entrySide: "right",
          initialSpeedMultiplier: 1.7,
          spawnDelayMs: 0,
        },
        {
          actionDurationMs: 20_000,
          actionName: "sleep",
          actionTriggerProgress: 0.2,
          entrySide: "right",
          initialSpeedMultiplier: 1.7,
          spawnDelayMs: 0,
        },
      ]);
      await page.clock.runFor(3_800);
      const actionSnapshot = await readSnapshot(page);
      expect(actionSnapshot.cats.map(({ mode }) => mode)).toEqual([
        "sit",
        "scratch",
        "yawn",
        "clean",
        "sleep",
      ]);
      expect(actionSnapshot.cats.map(({ actionCompleted }) => actionCompleted)).toEqual([
        false,
        false,
        false,
        false,
        false,
      ]);
      const actionMetrics = await page.evaluate(() => {
        const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
        const cats = Array.from(document.querySelectorAll(".neko-stream-cat"));
        return {
          catBottoms: cats.map((cat) => cat.getBoundingClientRect().bottom),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          taskbarTop,
        };
      });
      expect(actionMetrics.overflow).toBe(false);
      actionMetrics.catBottoms.forEach((bottom) =>
        expect(bottom).toBeLessThanOrEqual(actionMetrics.taskbarTop + 5)
      );
      const actionPoseMetrics = await readNekoPoseMetrics(page);
      actionPoseMetrics.poses.forEach((pose) =>
        expectNekoPoseAligned(pose, actionPoseMetrics.taskbarTop)
      );
      await page.screenshot({
        path: testInfo.outputPath(`neko-stream-actions-${viewport.name}.png`),
      });
      const stripTop = Math.max(0, actionMetrics.taskbarTop - 64);
      await page.screenshot({
        clip: {
          height: Math.min(64, viewport.height - stripTop),
          width: viewport.width,
          x: 0,
          y: stripTop,
        },
        path: testInfo.outputPath(`neko-stream-actions-strip-${viewport.name}.png`),
      });

      if (viewport.name === "mobile") {
        await page.setViewportSize({ width: 844, height: 390 });
        const resizedLaneMetrics = await readNekoPoseMetrics(page);
        resizedLaneMetrics.poses.forEach((pose) =>
          expectNekoPoseAligned(pose, resizedLaneMetrics.taskbarTop)
        );
        await page.screenshot({
          path: testInfo.outputPath("neko-stream-mobile-landscape.png"),
        });
      }
      await stopStream(page);
    });
  }

  expectNoRuntimeErrors(runtimeErrors);
});
