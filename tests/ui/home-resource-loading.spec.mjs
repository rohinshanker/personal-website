import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./deterministic.mjs";
import { consumeDiagnostics } from "./helpers/rendered-site.mjs";

const proofKey = "personalSiteAdministratorProofV1";
const proof = `${"a".repeat(32)}.${"b".repeat(32)}`;

const prepareHome = async (
  page,
  { authorized = false, storedAdminState = null } = {}
) => {
  await page.addInitScript(({ authorized, proof, proofKey, storedAdminState }) => {
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
  }, { authorized, proof, proofKey, storedAdminState });
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
