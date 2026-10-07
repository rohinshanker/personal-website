import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./deterministic.mjs";
import { consumeDiagnostics } from "./helpers/rendered-site.mjs";

const proofKey = "personalSiteAdministratorProofV1";
const proof = `${"a".repeat(32)}.${"b".repeat(32)}`;

const prepareHome = async (
  page,
  { authorized = false, prerendered = false, storedAdminState = null } = {}
) => {
  await page.addInitScript(({
    authorized,
    prerendered,
    proof,
    proofKey,
    storedAdminState,
  }) => {
    localStorage.clear();
    sessionStorage.clear();
    if (storedAdminState) {
      localStorage.setItem("personalSiteAdminControlsV1", JSON.stringify(storedAdminState));
    }
    if (authorized) {
      sessionStorage.setItem(proofKey, JSON.stringify({
        proof,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }));
    }
    Math.random = () => 0.999999;
    if (prerendered) {
      window.__homeTestPrerendering = true;
      window.__homeTestVisibilityState = "hidden";
      Object.defineProperty(document, "prerendering", {
        configurable: true,
        get: () => window.__homeTestPrerendering,
      });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => window.__homeTestVisibilityState,
      });
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => window.__homeTestVisibilityState === "hidden",
      });
    }
  }, { authorized, prerendered, proof, proofKey, storedAdminState });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
};

const deferredRoute = async (page, pattern) => {
  let release;
  let requested;
  const released = new Promise((resolve) => { release = resolve; });
  const seen = new Promise((resolve) => { requested = resolve; });
  let count = 0;
  await page.route(pattern, async (route) => {
    count += 1;
    requested();
    await released;
    await route.continue();
  });
  return { release, seen, count: () => count };
};

const finishAnimation = async (win, name) => {
  await win.dispatchEvent("animationend", { animationName: name });
  await expect(win).not.toHaveClass(/is-opening|is-closing/);
};

test("Admin resources stay cold for default and unauthorized restored sessions", async ({
  page,
}) => {
  const adminResources = () => page.evaluate(() => performance.getEntriesByType("resource")
    .map((entry) => new URL(entry.name).pathname)
    .filter((path) => path.includes("admin-controls") || path.includes("admin/orchestrator")));

  await prepareHome(page, { authorized: true });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve)
  )));
  expect(await adminResources()).toEqual([]);

  await prepareHome(page, {
    storedAdminState: { version: 1, audio: false, privacy: true },
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve)
  )));
  expect(await adminResources()).toEqual([]);
  await expect(page.locator("body")).not.toHaveClass(/is-admin-audio-off|is-admin-privacy-mode/);
});

test("the closed Home desktop hides static event overlays without requesting event CSS", async ({
  diagnostics,
  page,
}) => {
  let attempts = 0;
  let releaseDelayedStyles;
  let reportDelayedStyles;
  const delayedStylesReleased = new Promise((resolve) => {
    releaseDelayedStyles = resolve;
  });
  const delayedStylesRequested = new Promise((resolve) => {
    reportDelayedStyles = resolve;
  });
  await page.route("**/styles/home/random-events.css?*", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.abort("failed");
      return;
    }
    reportDelayedStyles();
    await delayedStylesReleased;
    await route.continue();
  });
  await page.clock.install();
  await prepareHome(page);
  const about = page.locator("#about-window");
  const explosion = page.locator("#vanishing-popup-explosion");
  const vanishingWindow = page.locator("#vanishing-popup-window");
  const preloadVanishingEvent = () => page.evaluate(async () => {
    const definition = window.homeEventRuntime.randomEventDefinitions.find(
      ({ id }) => id === "vanishing-popup-alert"
    );
    await window.homeEventRuntime.preloadRandomEventAssets(definition, {});
  });
  await page.locator('#about-window [data-close="about"]').click();
  await finishAnimation(about, "retro-window-close");

  await expect(about).toBeHidden();
  await expect(page.locator("#lost-grace-overlay")).toBeHidden();
  expect(await page.locator("#lost-grace-overlay").evaluate((element) => ({
    ariaHidden: element.getAttribute("aria-hidden"),
    display: getComputedStyle(element).display,
    imageSource: element.querySelector("img")?.getAttribute("src") || null,
    resourceState: window.homeResources.resourceState("random-event-styles"),
  }))).toEqual({
    ariaHidden: "true",
    display: "none",
    imageSource: null,
    resourceState: "idle",
  });
  await preloadVanishingEvent();
  await expect.poll(() => page.evaluate(() =>
    window.homeResources.resourceState("random-event-styles")
  )).toBe("idle");
  await expect(vanishingWindow).toBeHidden();
  await expect(explosion).toBeHidden();
  expect(await explosion.evaluate((element) => ({
    display: getComputedStyle(element).display,
    height: element.getBoundingClientRect().height,
    imageSource: element.getAttribute("src"),
    width: element.getBoundingClientRect().width,
  }))).toEqual({
    display: "none",
    height: 0,
    imageSource: "assets/random%20events/pixel-explosion.gif",
    width: 0,
  });
  consumeDiagnostics(diagnostics, {
    consoleErrors: ["Failed to load resource: net::ERR_FAILED"],
    requestFailures: [/styles\/home\/random-events\.css.*\(net::ERR_FAILED\)/],
  });

  const delayedPreload = preloadVanishingEvent();
  await delayedStylesRequested;
  expect(await page.evaluate(() =>
    window.homeResources.resourceState("random-event-styles")
  )).toBe("loading");
  await expect(vanishingWindow).toBeHidden();
  await expect(explosion).toBeHidden();
  releaseDelayedStyles();
  await delayedPreload;
  expect(await page.evaluate(() =>
    window.homeResources.resourceState("random-event-styles")
  )).toBe("loaded");

  await page.evaluate(() => {
    const definition = window.homeEventRuntime.randomEventDefinitions.find(
      ({ id }) => id === "vanishing-popup-alert"
    );
    definition.run();
  });
  await expect(vanishingWindow).toBeVisible();
  await expect(explosion).toBeHidden();
  await vanishingWindow.locator("[data-vanishing-popup-button]").evaluateAll((buttons) => {
    buttons.forEach((button) => button.click());
  });
  await expect(vanishingWindow).toHaveClass(/is-exploding/);
  await expect(explosion).toBeVisible();
  await expect(explosion).toHaveClass(/is-active/);
  await page.clock.fastForward(1800);
  await finishAnimation(vanishingWindow, "retro-window-close");
  await expect(vanishingWindow).toBeHidden();
  await expect(explosion).toBeHidden();
  expect(await explosion.getAttribute("src")).toBeNull();
  expect(attempts).toBe(2);
  await expect(page.locator("#self-love-alert-window .random-alert-message p"))
    .toHaveCSS("margin", "0px");
});

test("authorized restore waits for the eager Home runtime before loading Admin resources", async ({
  page,
}) => {
  const notes = await deferredRoute(page, "**/scripts/home/events/notes.js?*");
  const requested = [];
  page.on("request", (request) => requested.push(new URL(request.url()).pathname));
  await page.addInitScript(({ proof, proofKey }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("personalSiteAdminControlsV1", JSON.stringify({
      version: 1,
      audio: false,
      privacy: true,
    }));
    sessionStorage.setItem(proofKey, JSON.stringify({
      proof,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }));
    Math.random = () => 0.999999;
  }, { proof, proofKey });
  await page.emulateMedia({ reducedMotion: "reduce" });

  try {
    await page.goto("/home.html", { waitUntil: "commit" });
    await notes.seen;
    await page.waitForFunction(() => Boolean(window.homeEventRuntime));
    expect(await page.evaluate(() => ({
      bootReady: window.homeActivation.isHomeEagerRuntimeReady(),
      notesReady: Boolean(window.homeEventNotes),
    }))).toEqual({ bootReady: false, notesReady: false });
    expect(requested.filter((path) =>
      path.includes("admin-controls") || path.includes("admin/orchestrator")
    )).toEqual([]);

    notes.release();
    await page.waitForFunction(() => Boolean(window.rohinAdminControlsController));
    expect(await page.evaluate(() => ({
      bootReady: window.homeActivation.isHomeEagerRuntimeReady(),
      notesReady: Boolean(window.homeEventNotes),
      state: window.rohinAdminControlsController.getState(),
    }))).toMatchObject({
      bootReady: true,
      notesReady: true,
      state: { audio: false, privacy: true },
    });
    await expect(page.locator("#admin-controls-window")).toBeHidden();
    await expect(page.locator("body")).toHaveClass(/is-admin-audio-off/);
    await expect(page.locator("body")).toHaveClass(/is-admin-privacy-mode/);
  } finally {
    notes.release();
  }
});

test("authorized restore resumes after prerender activation without opening Admin", async ({
  page,
}) => {
  await prepareHome(page, {
    authorized: true,
    prerendered: true,
    storedAdminState: { version: 1, audio: false, visualEffects: false },
  });

  await page.waitForFunction(() => window.homeActivation.isHomeEagerRuntimeReady());
  expect(await page.evaluate(() => ({
    activated: window.homeActivation.isHomeActivationReady(),
    controller: Boolean(window.rohinAdminControlsController),
  }))).toEqual({ activated: false, controller: false });

  await page.evaluate(() => {
    window.__homeTestPrerendering = false;
    window.__homeTestVisibilityState = "visible";
    document.dispatchEvent(new Event("prerenderingchange"));
  });
  await page.waitForFunction(() => Boolean(window.rohinAdminControlsController));
  await expect(page.locator("#admin-controls-window")).toBeHidden();
  await expect(page.locator("body")).toHaveClass(/is-admin-audio-off/);
  await expect(page.locator("body")).toHaveClass(/is-admin-vfx-off/);
});

test("reset reload suppression survives failed Admin restore and expired access", async ({
  diagnostics,
  page,
}) => {
  let adminStyleAttempts = 0;
  await page.route("**/styles/home/admin-controls.css?*", async (route) => {
    adminStyleAttempts += 1;
    await route.abort("failed");
  });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });

  await page.evaluate(({ proof, proofKey }) => {
    localStorage.setItem("personalSiteAdminControlsV1", JSON.stringify({
      version: 1,
      audio: false,
    }));
    sessionStorage.setItem(proofKey, JSON.stringify({
      proof,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }));
    sessionStorage.setItem("personalSiteAdminControlsResetPendingV1", "1");
  }, { proof, proofKey });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(() => adminStyleAttempts).toBe(1);
  await page.waitForLoadState("load");
  await page.clock.fastForward(450);
  expect(await page.evaluate(() => ({
    controller: Boolean(window.rohinAdminControlsController),
    marker: sessionStorage.getItem("personalSiteAdminControlsResetPendingV1"),
    resetReload: window.homeWindows.wasAdminControlsResetReload(),
    visibleEvents: [...document.querySelectorAll(".random-event-window")]
      .filter((element) => getComputedStyle(element).display !== "none").length,
  }))).toEqual({
    controller: false,
    marker: null,
    resetReload: true,
    visibleEvents: 0,
  });
  consumeDiagnostics(diagnostics, {
    consoleErrors: ["Failed to load resource: net::ERR_FAILED"],
    requestFailures: [/styles\/home\/admin-controls\.css.*\(net::ERR_FAILED\)/],
  });

  await page.evaluate(({ proof, proofKey }) => {
    localStorage.removeItem("personalSiteAdminControlsV1");
    sessionStorage.setItem(proofKey, JSON.stringify({
      proof,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    }));
    sessionStorage.setItem("personalSiteAdminControlsResetPendingV1", "1");
  }, { proof, proofKey });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await page.clock.fastForward(450);
  expect(adminStyleAttempts).toBe(1);
  expect(await page.evaluate(() => ({
    controller: Boolean(window.rohinAdminControlsController),
    marker: sessionStorage.getItem("personalSiteAdminControlsResetPendingV1"),
    resetReload: window.homeWindows.wasAdminControlsResetReload(),
    visibleEvents: [...document.querySelectorAll(".random-event-window")]
      .filter((element) => getComputedStyle(element).display !== "none").length,
  }))).toEqual({
    controller: false,
    marker: null,
    resetReload: true,
    visibleEvents: 0,
  });
});

test("authorized Admin loading deduplicates, cancels cleanly, and retries", async ({ page }) => {
  const adminStyles = await deferredRoute(page, "**/styles/home/admin-controls.css?*");
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await prepareHome(page, { authorized: true });

  const launcher = page.locator('.taskbar-icon[data-app="admin-controls"]');
  const standIn = page.locator("#admin-controls-stand-in-window");
  const admin = page.locator("#admin-controls-window");
  await launcher.click();
  await adminStyles.seen;
  await launcher.click();

  await expect(standIn).toBeVisible();
  await expect(standIn).toHaveAccessibleDescription("Loading Admin Controls…");
  await expect(page.locator("#admin-controls-stand-in-ok")).toHaveText("Cancel");
  await expect(page.locator("body")).toHaveClass(/is-admin-resources-loading/);
  await expect(page.locator("body")).toHaveClass(/is-custom-cursor-loading/);
  expect(adminStyles.count()).toBe(1);
  expect(requests.filter((path) => path.endsWith("/admin-controls.css"))).toHaveLength(1);
  expect(requests.filter((path) => path.includes("/admin/orchestrator.js"))).toHaveLength(0);
  expect(requests.filter((path) => path.endsWith("/admin-controls.js"))).toHaveLength(0);

  await page.locator("#admin-controls-stand-in-ok").click();
  await finishAnimation(standIn, "retro-window-close");
  await expect(page.locator("body")).not.toHaveClass(/is-admin-resources-loading/);
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
  await launcher.click();
  await expect(standIn).toHaveAccessibleDescription("Loading Admin Controls…");
  adminStyles.release();
  await expect(admin).toBeVisible();
  await finishAnimation(admin, "retro-window-open");
  await expect(page.locator("#admin-tab-run")).toBeFocused();
  await expect(page.locator("body")).not.toHaveClass(/is-admin-resources-loading/);
  expect(requests.filter((path) => path.includes("/admin/orchestrator.js"))).toHaveLength(1);
  expect(requests.filter((path) => path.endsWith("/admin-controls.js"))).toHaveLength(1);
  expect(await page.evaluate(() => ({
    controller: Boolean(window.rohinAdminControlsController),
    orchestrator: Boolean(window.rohinAdminOrchestrator),
  }))).toEqual({ controller: true, orchestrator: true });

  const accessibility = await new AxeBuilder({ page })
    .include("#admin-controls-window")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("Admin load failure shows retry feedback and never opens stale or expired access", async ({
  diagnostics,
  page,
}) => {
  let attempts = 0;
  await page.route("**/styles/home/admin-controls.css?*", async (route) => {
    attempts += 1;
    if (attempts === 1) await route.abort("failed");
    else await route.continue();
  });
  await prepareHome(page, { authorized: true });

  const launcher = page.locator('.taskbar-icon[data-app="admin-controls"]');
  const standIn = page.locator("#admin-controls-stand-in-window");
  await launcher.click();
  await expect(standIn).toHaveAccessibleDescription(
    "Admin Controls could not load. Choose Retry to try again."
  );
  await expect(page.locator("#admin-controls-stand-in-ok")).toHaveText("Retry");
  await expect(page.locator("body")).not.toHaveClass(/is-admin-resources-loading/);
  await expect(page.locator("#admin-controls-window")).toBeHidden();

  consumeDiagnostics(diagnostics, {
    consoleErrors: ["Failed to load resource: net::ERR_FAILED"],
    requestFailures: [/styles\/home\/admin-controls\.css.*\(net::ERR_FAILED\)/],
  });

  await page.locator("#admin-controls-stand-in-ok").click();
  await expect(page.locator("#admin-controls-window")).toBeVisible();
  expect(attempts).toBe(2);

  await page.reload({ waitUntil: "domcontentloaded" });
  const delayed = await deferredRoute(page, "**/styles/home/admin-controls.css?*");
  await launcher.click();
  await delayed.seen;
  await page.evaluate((key) => sessionStorage.removeItem(key), proofKey);
  delayed.release();
  await expect(standIn).toHaveAccessibleDescription("nothing to see here...");
  await expect(page.locator("#admin-controls-window")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/is-admin-resources-loading/);
});

for (const lazyScript of [
  {
    key: "admin-orchestrator",
    pattern: "**/scripts/home/admin/orchestrator.js?*",
  },
  {
    key: "admin-controls",
    pattern: "**/scripts/home/admin-controls.js?*",
  },
]) {
  test(`${lazyScript.key} must publish its runtime before Admin marks it loaded`, async ({
    page,
  }) => {
    let attempts = 0;
    await page.route(lazyScript.pattern, async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          contentType: "text/javascript",
          headers: { "cache-control": "no-store" },
          body: "window.__adminIncompleteScriptExecuted = true;",
        });
        return;
      }
      await route.continue();
    });
    await prepareHome(page, { authorized: true });

    const standIn = page.locator("#admin-controls-stand-in-window");
    await page.locator('.taskbar-icon[data-app="admin-controls"]').click();
    await expect(standIn).toHaveAccessibleDescription(
      "Admin Controls could not load. Choose Retry to try again."
    );
    expect(await page.evaluate((key) => ({
      incompleteExecuted: window.__adminIncompleteScriptExecuted === true,
      state: window.homeResources.resourceState(key),
      controller: Boolean(window.rohinAdminControlsController),
    }), lazyScript.key)).toEqual({
      incompleteExecuted: true,
      state: "idle",
      controller: false,
    });

    await page.locator("#admin-controls-stand-in-ok").click();
    await expect(page.locator("#admin-controls-window")).toBeVisible();
    expect(attempts).toBe(2);
    expect(await page.evaluate(() => ({
      controller: Boolean(window.rohinAdminControlsController),
      orchestrator: Boolean(window.rohinAdminOrchestrator),
    }))).toEqual({ controller: true, orchestrator: true });
  });
}

test("page exit cancels pending Admin initialization and restores the cursor", async ({ page }) => {
  const adminStyles = await deferredRoute(page, "**/styles/home/admin-controls.css?*");
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await prepareHome(page, { authorized: true });

  await page.locator('.taskbar-icon[data-app="admin-controls"]').click();
  await adminStyles.seen;
  await expect(page.locator("body")).toHaveClass(/is-admin-resources-loading/);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  await expect(page.locator("body")).not.toHaveClass(/is-admin-resources-loading/);
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);

  adminStyles.release();
  await expect.poll(() => page.evaluate(() =>
    window.homeResources.resourceState("admin-styles")
  )).toBe("loaded");
  await expect(page.locator("#admin-controls-window")).toBeHidden();
  expect(requests.filter((path) => path.includes("/admin/orchestrator.js"))).toHaveLength(0);
  expect(requests.filter((path) => path.endsWith("/admin-controls.js"))).toHaveLength(0);
});

test("a cold random-event callback waits for stylesheet readiness before first paint", async ({
  page,
}) => {
  const styles = await deferredRoute(page, "**/styles/home/random-events.css?*");
  await prepareHome(page);
  const win = page.locator("#random-event-window");

  expect(await page.evaluate(() => window.homeEventRuntime.showManagedRandomEventWindow(
    document.querySelector("#random-event-window"),
    { animate: false }
  ))).toBe(true);
  await styles.seen;
  await expect(win).toBeHidden();
  expect(await page.evaluate(() => ({
    state: window.homeResources.resourceState("random-event-styles"),
    src: document.querySelector("#random-event-image").getAttribute("src"),
  }))).toEqual({ state: "loading", src: null });

  expect(await page.evaluate(() => window.homeEventRuntime.closeManagedRandomEventWindow(
    document.querySelector("#random-event-window")
  ))).toBe(true);
  styles.release();
  await expect.poll(() => page.evaluate(() =>
    window.homeResources.resourceState("random-event-styles")
  )).toBe("loaded");
  await expect(win).toBeHidden();

  expect(await page.evaluate(() => window.homeEventRuntime.showManagedRandomEventWindow(
    document.querySelector("#random-event-window"),
    { animate: false }
  ))).toBe(true);
  await expect(win).toBeVisible();
  await expect(win).toHaveCSS("width", "360px");
  expect(await win.evaluate((element) => ({
    opening: element.classList.contains("is-opening"),
    state: window.homeResources.resourceState("random-event-styles"),
  }))).toEqual({ opening: false, state: "loaded" });
});

test("random-event stylesheet failure leaves the window hidden and retries", async ({
  diagnostics,
  page,
}) => {
  let attempts = 0;
  await page.route("**/styles/home/random-events.css?*", async (route) => {
    attempts += 1;
    if (attempts === 1) await route.abort("failed");
    else await route.continue();
  });
  await prepareHome(page);

  const show = () => page.evaluate(() => window.homeEventRuntime.showManagedRandomEventWindow(
    document.querySelector("#random-event-window"),
    { animate: false }
  ));
  expect(await show()).toBe(true);
  await expect.poll(() => page.evaluate(() =>
    window.homeResources.resourceState("random-event-styles")
  )).toBe("idle");
  await expect(page.locator("#random-event-window")).toBeHidden();
  consumeDiagnostics(diagnostics, {
    consoleErrors: ["Failed to load resource: net::ERR_FAILED"],
    requestFailures: [/styles\/home\/random-events\.css.*\(net::ERR_FAILED\)/],
  });

  expect(await show()).toBe(true);
  await expect(page.locator("#random-event-window")).toBeVisible();
  expect(attempts).toBe(2);
});
