import { readFile } from "node:fs/promises";

import { resolveUiTestBaseUrl } from "../server-config.mjs";

/**
 * Shared setup for renders that must look identical on every run: a pinned
 * clock, an offline Game Stats backend, suppressed random events, and clean
 * browser storage.
 */

/**
 * The one origin the suite serves this checkout on, from the same setting the
 * Playwright configuration reads.
 */
export const TEST_SERVER_ORIGIN = new URL(resolveUiTestBaseUrl()).origin;

/**
 * Matches one file the test server serves, whatever cache token follows it.
 * Every local mock is pinned this way, so the same path on any other host is
 * not answered by the mock and falls through to the hermetic block.
 *
 * @param {string} path repository-relative, for example `scripts/home/main.js`.
 * @returns {(url: URL) => boolean}
 */
export const servedFile = (path) => (url) =>
  url.origin === TEST_SERVER_ORIGIN && url.pathname === `/${path}`;

/** Matches any test-server file whose path fits `pattern`. */
const servedPath = (pattern) => (url) =>
  url.origin === TEST_SERVER_ORIGIN && pattern.test(url.pathname);

/** Wednesday, so the Thursday-only Feliz Jueves event never registers. */
export const FROZEN_INSTANT = new Date("2026-03-04T12:00:00.000Z");

/**
 * The draw every deterministic realm returns. Weighted random events all sit
 * below it, so none fire, and the Sudoku generator shuffles the same way on
 * every run.
 */
export const DETERMINISTIC_RANDOM_DRAW = 0.999999;

const SUDOKU_WORKER_PATH = "scripts/home/sudoku-generator.worker.js";

/**
 * The Sudoku generator runs in its own worker, which an init script cannot
 * reach: a worker gets a fresh realm with its own Math. Without this the
 * board would differ on every run, so the source is served with the same
 * draw pinned that the page uses.
 */
export const readDeterministicSudokuWorkerSource = async () => {
  const source = await readFile(new URL(`../../../${SUDOKU_WORKER_PATH}`, import.meta.url), "utf8");
  return `Math.random = () => ${DETERMINISTIC_RANDOM_DRAW};\n${source}`;
};

/**
 * Serves the Sudoku generator worker with its draw pinned. The shared fixture
 * installs this on the browser context.
 *
 * @param {import("@playwright/test").Page | import("@playwright/test").BrowserContext} target
 */
export const installDeterministicSudokuWorker = async (target) => {
  const source = await readDeterministicSudokuWorkerSource();
  await target.route(servedFile(SUDOKU_WORKER_PATH), (route) =>
    route.fulfill({ contentType: "application/javascript", body: source })
  );
};

/**
 * Holds every generator reply back by `delayMs`, so a request made from the
 * page is still outstanding when the next interaction lands. The shared
 * fixture already routes the pinned worker source; this route is registered
 * later, so it is the one that answers.
 *
 * @param {import("@playwright/test").Page} page
 */
export const installDelayedSudokuGeneratorReplies = async (page, delayMs) => {
  const source = await readDeterministicSudokuWorkerSource();
  await page.route(servedFile(SUDOKU_WORKER_PATH), (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body:
        "const deferredPost = self.postMessage.bind(self);\n" +
        `self.postMessage = (data) => setTimeout(() => deferredPost(data), ${delayMs});\n` +
        source,
    })
  );
};

/** The viewport matrix required for rendered UI review. */
export const REVIEW_VIEWPORTS = Object.freeze([
  Object.freeze({ name: "mobile", width: 375, height: 812 }),
  Object.freeze({ name: "tablet", width: 768, height: 1024 }),
  Object.freeze({ name: "desktop", width: 1280, height: 800 }),
  Object.freeze({ name: "wide", width: 1440, height: 900 }),
]);

/** The four review sizes by name, for a spec that needs only one of them. */
export const REVIEW_VIEWPORT = Object.freeze(
  Object.fromEntries(REVIEW_VIEWPORTS.map((viewport) => [viewport.name, viewport]))
);

/**
 * The adjacent pair that proves a layout breakpoint actually switches: one
 * viewport on each side of it. Both widths are named by the caller, because a
 * `max-width: 640px` rule and a `min-width: 641px` rule straddle the same
 * boundary from different sides and a shared table would silently move the
 * width a spec actually covers.
 *
 * @param {string} label what the breakpoint controls, for the viewport name.
 * @param {{below: number, above: number, height?: number}} widths
 * @returns {ReadonlyArray<{name: string, width: number, height: number}>}
 */
export const breakpointPair = (label, { below, above, height = 900 }) =>
  Object.freeze([
    Object.freeze({ name: `below ${label}`, width: below, height }),
    Object.freeze({ name: `above ${label}`, width: above, height }),
  ]);

const GAME_STATS_BACKEND_PATH = "scripts/home/game-stats-backend.js";

const generatedBackendSource = await readFile(
  new URL(`../../../${GAME_STATS_BACKEND_PATH}`, import.meta.url),
  "utf8"
);

/** The build version the generated config carries. */
export const PRODUCTION_BUILD_VERSION =
  generatedBackendSource.match(/buildVersion:\s*"([^"]*)"/)[1];

/**
 * Serves the real generated backend config with the API base URL and build
 * version a test needs. The default is the offline shape: the page keeps its
 * production build version but has no address to reach, so no Game Stats
 * request leaves the page at all.
 *
 * The shared fixture installs the default on the browser context, so a spec
 * calls this only to opt into a backend. A page-level route always wins over
 * the context-level default, and a later route wins over an earlier one, so
 * the opt-in applies wherever it is registered.
 *
 * @param {import("@playwright/test").Page | import("@playwright/test").BrowserContext} target
 * @param {{apiBaseUrl?: string, buildVersion?: string}} [config]
 */
export const installGameStatsBackend = async (
  target,
  { apiBaseUrl = "", buildVersion = PRODUCTION_BUILD_VERSION } = {}
) => {
  const source = generatedBackendSource
    .replace(/apiBaseUrl:\s*"[^"]*"/, `apiBaseUrl: ${JSON.stringify(apiBaseUrl)}`)
    .replace(/buildVersion:\s*"[^"]*"/, `buildVersion: ${JSON.stringify(buildVersion)}`);
  await target.route(servedFile(GAME_STATS_BACKEND_PATH), (route) =>
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
 * A local stand-in for each kind of remote embed: enough for the element to
 * load and keep the layout it sizes while the test stays offline.
 */
const OFFLINE_STUB = Object.freeze({
  image: Object.freeze({ body: ONE_PIXEL_PNG, contentType: "image/png" }),
  media: Object.freeze({ body: stubVideo, contentType: "video/mp4" }),
  document: Object.freeze({ body: "<!doctype html><title>stub</title>", contentType: "text/html" }),
});

/**
 * Every remote address the shipped pages embed, as origin, then exact path,
 * then the kind of request the embedding element makes. Written by hand from
 * the Home markup and the gallery and calendar sources. Nothing is approved by
 * prefix, origin, or resource type, so a new embed is blocked and reported
 * until it is added here on purpose.
 */
export const KNOWN_REMOTE_EMBEDS = Object.freeze({
  "https://rohinshanker.github.io": Object.freeze({
    "/pulse-oximeter/site-assets/demo-photo.jpg": "image",
    "/pulse-oximeter/site-assets/breadboard-1.jpg": "image",
    "/pulse-oximeter/site-assets/breadboard-2.jpg": "image",
    "/pulse-oximeter/site-assets/breadboard-3.jpg": "image",
    "/pulse-oximeter/course%20resources/pulse%20ox%20slides.pdf": "document",
    "/EE-122-simulation/analysis/plots/common_links/throughput_by_category_algorithm.png": "image",
    "/EE-122-simulation/analysis/plots/delay/throughput_vs_delay_ms.png": "image",
    "/EE-122-simulation/analysis/plots/loss/retransmits_per_second_vs_loss_pct.png": "image",
    "/EE-122-simulation/analysis/plots/summary/utilization_by_condition_heatmap.png": "image",
    "/EE-122-simulation/project-resources/extended-abstract.pdf": "document",
    "/EE-122-simulation/project-resources/ee122-presentation.pdf": "document",
    "/drone-navigation-project/assets/docs/EECS%20C106A%20Final%20Project%20-%20Group%2044%20-%20Google%20Slides.pdf":
      "document",
    "/drone-navigation-project/assets/videos/mujocosimulator.mp4": "media",
    "/drone-navigation-project/assets/videos/livedemo.mp4": "media",
  }),
  "https://www.youtube.com": Object.freeze({ "/embed/rduOw_oshqM": "document" }),
  "https://imgix.bustle.com": Object.freeze({
    "/inverse/8d/d9/86/e4/92b5/4dec/b80e/3402288d9a18/giphy-9gif.gif": "media",
  }),
  "https://media.giphy.com": Object.freeze({
    "/media/v1.Y2lkPTc5MGI3NjExMDVnNmphdHYxbTJoMDJjNXNmZHg3eW5pcHF1MDNkMWVjOGw3dmpocyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Ph5WvQ9jJKJGOVLpgD/giphy.gif":
      "image",
  }),
  "https://media3.giphy.com": Object.freeze({
    "/media/v1.Y2lkPTc5MGI3NjExZjRoeGk1ZW51MGxuYjd1aDQxb3RlMmZodTBnOWlsYTA1cTFuZGZoOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XGLBlMvhA0PO9MEDmv/giphy.gif":
      "image",
  }),
  "https://media4.giphy.com": Object.freeze({
    "/media/v1.Y2lkPTc5MGI3NjExbXRreml3ZDZodnJwZmVkYmIyaHY4bjBoOHkyc2ozdDR0cTJjZHpnOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/fJzFpWBj82lk1tW5RY/giphy.gif":
      "image",
  }),
});

/**
 * The local stub that answers a request, or `undefined` when the request is
 * not a known embed loaded the way the page embeds it. The query string and
 * fragment only tune the remote player, so they do not take part in the match.
 *
 * @param {string} url the address the browser asked for.
 * @param {string} resourceType Playwright's `request.resourceType()`.
 * @returns {{body: string | Buffer, contentType: string} | undefined}
 */
export const remoteEmbedStub = (url, resourceType) => {
  const { origin, pathname } = new URL(url);
  const kind = KNOWN_REMOTE_EMBEDS[origin]?.[pathname];
  return kind === resourceType ? OFFLINE_STUB[kind] : undefined;
};

/**
 * The Sky name generator definition Home downloads to seed leaderboard profile
 * names. The shared fixture serves this copy, so any spec that reaches the
 * profile prompt gets real generated names without calling perchance.org.
 */
export const SKY_NAME_GENERATOR_DEFINITION = `title = Sky Name Generator

names
  [vowels][consonants][vowels][consonants]
  [consonants][vowels][consonants][vowels]
  [vowels][consonants][vowels][consonants][vowels]
  [consonants][vowels][consonants][vowels][consonants]
  [vowels][consonants][vowels][consonants][vowels][consonants]
  [consonants][vowels][consonants][vowels][consonants][vowels]
  [vowels][consonants][vowels][consonants][vowels][consonants][vowels]
  [consonants][vowels][consonants][vowels][consonants][vowels][consonants]
  [vowels][consonants][vowels][consonants][vowels][consonants][vowels][consonants]
  [consonants][vowels][consonants][vowels][consonants][vowels][consonants][vowels]

vowels
  a
  e
  i
  o
  u

consonants
  b
  c
  d
  f
  g
  h ^0.5
  j
  k
  l
  m
  n
  p
  q ^0.5
  r
  s
  t
  v
  w ^0.5
  x ^0.5
  y
  z ^0.5`;

/** The one download Home makes for profile names: the Sky generator's lists. */
const SKY_NAME_GENERATOR_URL = new URL(
  "https://perchance.org/api/downloadGenerator?generatorName=sky-cotl-namegen&listsOnly=true"
);

const sortedQuery = (url) => {
  const query = new URLSearchParams(url.search);
  query.sort();
  return query.toString();
};

/**
 * True only for the Sky generator download itself: that origin, that path, and
 * those parameters in any order. Another generator, or a neighbouring path on
 * the same host, is a different request and is not answered for it.
 *
 * @param {URL} url
 * @returns {boolean}
 */
export const isSkyNameGeneratorRequest = (url) =>
  url.origin === SKY_NAME_GENERATOR_URL.origin &&
  url.pathname === SKY_NAME_GENERATOR_URL.pathname &&
  sortedQuery(url) === sortedQuery(SKY_NAME_GENERATOR_URL);

/**
 * Answers the Sky name generator download with a definition the page can parse.
 *
 * @param {import("@playwright/test").Page | import("@playwright/test").BrowserContext} target
 * @param {string} [definition]
 */
export const installSkyNameGenerator = (target, definition = SKY_NAME_GENERATOR_DEFINITION) =>
  target.route(isSkyNameGeneratorRequest, (route) =>
    route.fulfill({ body: definition, contentType: "text/plain" })
  );

/**
 * Severs the browser context from everything but the test server. A known
 * remote embed is answered with a local stub of its kind; every other request
 * that would leave the test server — the live Game Stats Worker above all, but
 * equally an unlisted image or another loopback port — is aborted, which
 * surfaces in the diagnostics record as a failed request and fails the test.
 * A spec that needs a specific external response routes that URL itself.
 *
 * Registered before any other route, so every later route — context or page,
 * fixture or spec — takes precedence over it.
 *
 * @param {import("@playwright/test").BrowserContext} context
 */
export const installHermeticNetwork = (context) =>
  context.route(
    (url) => url.origin !== TEST_SERVER_ORIGIN,
    (route, request) => {
      const stub = remoteEmbedStub(request.url(), request.resourceType());
      return stub ? route.fulfill(stub) : route.abort("blockedbyclient");
    }
  );

/**
 * Serves every modeling photo as a one-pixel PNG and every modeling video as a
 * small valid H.264 clip, so gallery specs stay fast and hermetic without a
 * single 404. Pass a context so pages opened later, such as popups, inherit it.
 *
 * @param {import("@playwright/test").Page | import("@playwright/test").BrowserContext} target
 */
export const installStubbedModelingMedia = async (target) => {
  await target.route(servedPath(/^\/assets\/modeling\/.*\.(?:mp4|mov|webm)$/i), (route) =>
    route.fulfill({ body: stubVideo, contentType: "video/mp4" })
  );
  await target.route(servedPath(/^\/assets\/modeling\/.*\.(?:jpe?g|png)$/i), (route) =>
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
 * Records what every page in the context reports, from before the first one
 * navigates. The listeners sit on the context because a page only receives a
 * network event once Playwright has announced that page, and a popup's first
 * navigation is answered or refused before then. One listener per channel also
 * records each event once, however many pages are open or times they navigate.
 *
 * @param {import("@playwright/test").BrowserContext} context
 * @returns {{consoleErrors: string[], runtimeErrors: string[], requestFailures: string[], errorResponses: string[]}}
 *   live-updating collections of everything the context's pages reported.
 */
export const collectRuntimeDiagnostics = (context) => {
  const diagnostics = {
    consoleErrors: [],
    runtimeErrors: [],
    requestFailures: [],
    errorResponses: [],
  };
  context.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  context.on("weberror", (webError) => diagnostics.runtimeErrors.push(webError.error().message));
  context.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (errorText === PAGE_CANCELLED) return;
    diagnostics.requestFailures.push(
      `${request.method()} ${request.url()} (${errorText})`
    );
  });
  context.on("response", (response) => {
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

const matchesDiagnostic = (entry, matcher) =>
  typeof matcher === "string" ? entry.includes(matcher) : matcher.test(entry);

/**
 * Removes the diagnostics a test deliberately provoked, one entry per matcher,
 * and fails when a matcher found nothing. Anything the test did not name stays
 * in the record and still fails the automatic assertion, so this is an exact
 * receipt rather than a standing allowance for a class of error.
 *
 * @param {{consoleErrors: string[], runtimeErrors: string[], requestFailures: string[], errorResponses: string[]}} diagnostics
 * @param {Partial<Record<"consoleErrors" | "runtimeErrors" | "requestFailures" | "errorResponses", ReadonlyArray<string | RegExp>>>} expected
 */
export const consumeDiagnostics = (diagnostics, expected) => {
  Object.entries(expected).forEach(([channel, matchers]) => {
    const entries = diagnostics[channel];
    if (!entries) throw new Error(`Unknown diagnostic channel: ${channel}.`);
    matchers.forEach((matcher) => {
      const index = entries.findIndex((entry) => matchesDiagnostic(entry, matcher));
      if (index < 0) {
        throw new Error(
          `Expected a ${channel} entry matching ${matcher}; the page reported ` +
            `${entries.length ? entries.join(", ") : "none"}.`
        );
      }
      entries.splice(index, 1);
    });
  });
};

/**
 * Yields two animation frames and a round trip to the runner.
 *
 * Home schedules its resize, render, and preload work on `requestAnimationFrame`,
 * so anything a just-completed interaction set in motion has run by the time
 * this resolves — including the request events the runner records. It is the
 * barrier for "and then nothing else happened", which a wall-clock pause only
 * ever guessed at.
 *
 * @param {import("@playwright/test").Page} page
 * @param {number} [frames] how many frames to yield. Two is the barrier for
 *   work the page has already scheduled; a few more is the window in which an
 *   element that claims to be stopped would visibly have moved.
 */
export const settleFrames = (page, frames = 2) =>
  page.evaluate(
    (count) =>
      new Promise((resolve) => {
        const step = (remaining) =>
          remaining > 0 ? requestAnimationFrame(() => step(remaining - 1)) : resolve();
        step(count);
      }),
    frames
  );

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
  await page.clock.setFixedTime(FROZEN_INSTANT);
  await page.setViewportSize(viewport);
  await page.addInitScript((draw) => {
    localStorage.clear();
    sessionStorage.clear();
    // Weighted random events all draw below this value, so none fire.
    Math.random = () => draw;
  }, DETERMINISTIC_RANDOM_DRAW);
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
