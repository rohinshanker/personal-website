import { readFile } from "node:fs/promises";

/**
 * Shared setup for renders that must look identical on every run: a pinned
 * clock, an offline Game Stats backend, suppressed random events, and clean
 * browser storage.
 */

/** Wednesday, so the Thursday-only Feliz Jueves event never registers. */
export const FROZEN_INSTANT = new Date("2026-03-04T12:00:00.000Z");

/** The viewport matrix required for rendered UI review. */
export const REVIEW_VIEWPORTS = Object.freeze([
  Object.freeze({ name: "mobile", width: 375, height: 812 }),
  Object.freeze({ name: "tablet", width: 768, height: 1024 }),
  Object.freeze({ name: "desktop", width: 1280, height: 800 }),
  Object.freeze({ name: "wide", width: 1440, height: 900 }),
]);

const generatedBackendSource = await readFile(
  new URL("../../../scripts/home/game-stats-backend.js", import.meta.url),
  "utf8"
);

/**
 * Serves the real generated backend config with an empty API base URL so the
 * page keeps its production build version but never reaches the live Worker.
 *
 * @param {import("@playwright/test").Page} page
 */
export const installOfflineGameStats = async (page) => {
  const source = generatedBackendSource.replace(
    /apiBaseUrl:\s*"[^"]*"/,
    'apiBaseUrl: ""'
  );
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: source })
  );
};

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+q0g9QAAAAABJRU5ErkJggg==",
  "base64"
);

const stubVideo = await readFile(
  new URL("../../../assets/modeling/fast-reverie-rnwy-apr2024/01-runway-video.mp4", import.meta.url)
);

/**
 * Serves every modeling photo as a one-pixel PNG and every modeling video as a
 * small valid H.264 clip, so gallery specs stay fast and hermetic without a
 * single 404. Pass a context so pages opened later, such as popups, inherit it.
 *
 * @param {import("@playwright/test").Page | import("@playwright/test").BrowserContext} target
 */
export const installStubbedModelingMedia = async (target) => {
  await target.route(/\/assets\/modeling\/.*\.(?:mp4|mov|webm)(?:\?.*)?$/i, (route) =>
    route.fulfill({ body: stubVideo, contentType: "video/mp4" })
  );
  await target.route(/\/assets\/modeling\/.*\.(?:jpe?g|png)(?:\?.*)?$/i, (route) =>
    route.fulfill({ body: ONE_PIXEL_PNG, contentType: "image/png" })
  );
};

/**
 * `net::ERR_ABORTED` is the page cancelling its own request — swapping an
 * animated icon's `src`, or tearing down a `<video>` when its window closes.
 * It is not a delivery failure, and treating it as one makes the check noise.
 */
const PAGE_CANCELLED = "net::ERR_ABORTED";

/**
 * Attaches the listeners once per page, so a spec that navigates repeatedly
 * does not accumulate duplicates.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {{consoleErrors: string[], runtimeErrors: string[], requestFailures: string[], errorResponses: string[]}}
 *   live-updating collections of everything the page reported.
 */
export const collectRuntimeDiagnostics = (page) => {
  const diagnostics = {
    consoleErrors: [],
    runtimeErrors: [],
    requestFailures: [],
    errorResponses: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.runtimeErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (errorText === PAGE_CANCELLED) return;
    diagnostics.requestFailures.push(
      `${request.method()} ${request.url()} (${errorText})`
    );
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    diagnostics.errorResponses.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
};

/**
 * Throws when the page reported anything. Collecting diagnostics is only useful
 * if something asserts on them, so `tests/ui/deterministic.mjs` calls this after
 * every test rather than leaving it to each spec.
 *
 * @param {{consoleErrors: string[], runtimeErrors: string[], requestFailures: string[], errorResponses: string[]}} diagnostics
 */
export const assertNoRuntimeDiagnostics = (diagnostics) => {
  const reported = [
    ...diagnostics.runtimeErrors.map((entry) => `page error: ${entry}`),
    ...diagnostics.consoleErrors.map((entry) => `console error: ${entry}`),
    ...diagnostics.requestFailures.map((entry) => `request failed: ${entry}`),
    ...diagnostics.errorResponses.map((entry) => `error response: ${entry}`),
  ];
  if (reported.length) {
    throw new Error(
      `The page reported ${reported.length} runtime problem(s):\n${reported.join("\n")}`
    );
  }
};

/**
 * Waits until fonts and every laid-out image have finished decoding, so a
 * screenshot cannot capture a half-painted frame.
 *
 * @param {import("@playwright/test").Page} page
 */
export const settleRender = async (page) => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const pending = Array.from(document.images).filter((image) => {
      const { width, height } = image.getBoundingClientRect();
      return width > 0 && height > 0 && !image.complete;
    });
    await Promise.all(
      pending.map(
        (image) =>
          new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          })
      )
    );
  });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
};

/**
 * Opens a route with deterministic time, randomness, and storage.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} path route to open, for example `/home.html`.
 * @param {{width: number, height: number}} viewport
 */
export const openDeterministicRoute = async (page, path, viewport) => {
  await installOfflineGameStats(page);
  await page.clock.setFixedTime(FROZEN_INSTANT);
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Weighted random events all draw below this value, so none fire.
    Math.random = () => 0.999999;
  });
  await page.goto(path, { waitUntil: "load" });
  await settleRender(page);
};

/**
 * Opens Home and dismisses the About window that greets every visitor.
 *
 * @param {import("@playwright/test").Page} page
 * @param {{width: number, height: number}} viewport
 */
export const openHomeDesktop = async (page, viewport) => {
  await openDeterministicRoute(page, "/home.html", viewport);
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) {
    await aboutClose.click();
    await page.locator("#about-window").waitFor({ state: "hidden" });
  }
};

/**
 * Launches a desktop application through its taskbar control.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} app the `data-app` / `data-app-window` identifier.
 * @returns {Promise<import("@playwright/test").Locator>} the opened window.
 */
export const openApp = async (page, app) => {
  await page.locator(`.taskbar-icon[data-app="${app}"]`).click();
  const win = page.locator(`[data-app-window="${app}"]`);
  await win.waitFor({ state: "visible" });
  await win.evaluate((element) => {
    if (!element.classList.contains("is-opening")) return undefined;
    return new Promise((resolve) => {
      element.addEventListener("animationend", resolve, { once: true });
    });
  });
  await settleRender(page);
  return win;
};

/**
 * Opens Sudoku and drives its boot sequence — loading, ready, Play — through
 * to the playing state, which is the only state that renders the board and
 * control panel.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<import("@playwright/test").Locator>} the playing window.
 */
export const openSudokuBoard = async (page) => {
  const win = await openApp(page, "sudoku");
  const play = win.locator("#sudoku-play");
  await play.waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.getElementById("sudoku-play")?.disabled === false,
    undefined,
    { timeout: 20_000 }
  );
  await play.click();
  await win.locator(".sudoku-game-content").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelectorAll("#sudoku-grid .sudoku-cell").length === 81
  );
  await settleRender(page);
  return win;
};
