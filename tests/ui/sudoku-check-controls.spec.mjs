import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.setTimeout(120_000);

const API_BASE_URL = "https://game-stats-sudoku-check-controls.test";
const BUILD_VERSION = `sha256-${"d".repeat(64)}`;
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const WARNING_TEXT =
  "Are you sure you would like to have errors revealed? Doing so will disqualify you from the leaderboard.";
const CHECK_COUNTER_TEXT = (count) =>
  `${count}/3 allowed checks used to place on leaderboard`;
const profile = Object.freeze({
  id: "player-sudoku-check-controls",
  name: "Sudoku Controls Tester",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});
const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const installBackendConfig = (page) =>
  page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      body: `window.rohinGameStatsBackend = Object.freeze({
        apiBaseUrl: ${JSON.stringify(API_BASE_URL)},
        buildVersion: ${JSON.stringify(BUILD_VERSION)}
      });`,
      contentType: "application/javascript",
    })
  );

const installApi = async (page) => {
  const eventRequests = [];
  const sessionRequests = [];
  let sessionSequence = 0;
  const corsHeaders = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  };

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/sessions") {
      sessionRequests.push(JSON.parse(request.postData() || "{}"));
      sessionSequence += 1;
      await route.fulfill({
        status: 201,
        body: JSON.stringify({
          id: `session-sudoku-check-controls-${sessionSequence}`,
          token: `token-sudoku-check-controls-${sessionSequence}`,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
        contentType: "application/json",
        headers: corsHeaders,
      });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/events") {
      eventRequests.push(JSON.parse(request.postData() || "{}"));
      await route.fulfill({
        status: 201,
        body: JSON.stringify({ ok: true, applied: true }),
        contentType: "application/json",
        headers: corsHeaders,
      });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/stats") {
      await route.fulfill({
        body: JSON.stringify({
          version: 1,
          generatedAt: new Date().toISOString(),
          eventIds: [],
          totals: {},
          leaderboards: {},
          playerRanks: {},
          playerRecords: {},
        }),
        contentType: "application/json",
        headers: corsHeaders,
      });
      return;
    }

    await route.fulfill({
      status: 404,
      body: JSON.stringify({ ok: false, error: "Unexpected test route" }),
      contentType: "application/json",
      headers: corsHeaders,
    });
  });

  return { eventRequests, sessionRequests };
};

const installMainBridge = async (page) => {
  const mainSource = await readFile(
    new URL("../../scripts/home/main.js", import.meta.url),
    "utf8"
  );
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__sudokuCheckControlsTest = Object.freeze({
  freezeTimerAt: (elapsedSeconds) => {
    if (sudokuState.timerId) clearInterval(sudokuState.timerId);
    sudokuState.timerId = null;
    sudokuState.timerStartedAt = 0;
    sudokuState.elapsedSeconds = Math.max(
      0,
      Math.trunc(Number(elapsedSeconds) || 0)
    );
    updateSudokuTimeDisplay();
    return sudokuTime?.textContent || "";
  },
  readIncorrectEntry: () => {
    const cells = sudokuCells();
    const index = cells.findIndex((cell) => !isSudokuCellReadOnly(cell));
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("Sudoku puzzle has no editable cell for the test.");
    }
    const solutionDigit = sudokuState.solution[index];
    const incorrectDigit = SUDOKU_DIGITS.split("").find(
      (digit) => digit !== solutionDigit
    );
    if (!incorrectDigit) {
      throw new Error("Unable to choose an incorrect Sudoku digit.");
    }
    return { incorrectDigit, index, solutionDigit };
  },
  prepareCompletedBoard: () => {
    const cells = sudokuCells();
    let editableCellCount = 0;
    cells.forEach((cell, index) => {
      if (isSudokuCellReadOnly(cell)) return;
      editableCellCount += 1;
      setSudokuCellNotes(cell, index, "");
      setSudokuCellValue(cell, index, sudokuState.solution[index]);
      syncSudokuCellFeedback(cell, index);
    });
    clearSudokuHighlights();
    sudokuState.mistakes = 0;
    sudokuState.solved = false;
    setSudokuStatus("Ready");
    return { editableCellCount };
  },
  readState: () => ({
    checksUsed: sudokuState.checksUsed,
    errorsConfirmed: sudokuState.errorsConfirmed,
    hintMode: sudokuState.hintMode,
    mistakes: sudokuState.mistakes,
    playing: sudokuState.playing,
    solved: sudokuState.solved,
    usedHint: sudokuState.usedHint,
  }),
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the Sudoku check-controls test bridge.");
  }

  await page.route("**/scripts/home/main.js*", (route) =>
    route.fulfill({
      body: instrumentedSource,
      contentType: "application/javascript",
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
      errorText: request.failure()?.errorText || "unknown failure",
      method: request.method(),
      url: request.url(),
    });
  });
  return { consoleErrors, pageErrors, requestFailures };
};

const expectNoUnexpectedRuntimeErrors = (runtimeErrors) => {
  const unexpectedRequestFailures = runtimeErrors.requestFailures.filter(
    ({ errorText, method, url }) =>
      !(
        errorText === "net::ERR_ABORTED" &&
        method === "GET" &&
        /\/assets\/neko-assets\/sprites\/sleep[12]\.png(?:\?|$)/.test(url)
      )
  );
  expect(runtimeErrors.consoleErrors).toEqual([]);
  expect(runtimeErrors.pageErrors).toEqual([]);
  expect(unexpectedRequestFailures).toEqual([]);
};

const preparePage = async (page, viewport = viewports[2]) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ profileKey, savedProfile }) => {
      Math.random = () => 0.999999;
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
    },
    { profileKey: PROFILE_STORAGE_KEY, savedProfile: profile }
  );
  await installBackendConfig(page);
  await installMainBridge(page);
  const api = await installApi(page);

  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  const aboutWindow = page.locator("#about-window");
  const aboutClose = aboutWindow.locator('[data-close="about"]');
  if (await aboutClose.isVisible()) {
    await aboutClose.click();
    await expect(aboutWindow).toBeHidden();
  }

  await page.locator('.desktop-icon[data-app="sudoku"]').click();
  const sudokuWindow = page.locator('[data-app-window="sudoku"]');
  await expect(sudokuWindow).toBeVisible();
  const playButton = sudokuWindow.locator("#sudoku-play");
  await expect(playButton).toBeEnabled({ timeout: 10_000 });
  await playButton.click();
  await expect(sudokuWindow.locator(".sudoku-app")).toHaveClass(
    /is-sudoku-playing/,
    { timeout: 10_000 }
  );
  await sudokuWindow.locator(".sudoku-game-content").evaluate(async (element) => {
    await Promise.allSettled(
      element.getAnimations().map((animation) => animation.finished)
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
  });
  await expect(sudokuWindow.locator("#sudoku-leaderboard-checks")).toHaveText(
    CHECK_COUNTER_TEXT(0)
  );
  await expect
    .poll(() => api.sessionRequests.length, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(1);

  return { api, runtimeErrors, sudokuWindow };
};

const readState = (page) =>
  page.evaluate(() => window.__sudokuCheckControlsTest.readState());

const readIncorrectEntry = (page) =>
  page.evaluate(() => window.__sudokuCheckControlsTest.readIncorrectEntry());

const enterIncorrectDigit = async (page, sudokuWindow) => {
  const entry = await readIncorrectEntry(page);
  const cell = sudokuWindow.locator(
    `.sudoku-cell[data-sudoku-index="${entry.index}"]`
  );
  await cell.click();
  await sudokuWindow
    .locator(`[data-sudoku-number="${entry.incorrectDigit}"]`)
    .click();
  await expect(cell).toHaveAttribute("data-sudoku-value", entry.incorrectDigit);
  return { cell, entry };
};

const expectWarningPrompt = async (sudokuWindow) => {
  const prompt = sudokuWindow.locator("#sudoku-errors-prompt");
  await expect(prompt).toBeVisible();
  await expect(prompt).toHaveAttribute("role", "alertdialog");
  await expect(prompt.locator("#sudoku-errors-prompt-message")).toHaveText(
    WARNING_TEXT
  );
  const sphere = prompt.locator(".sudoku-solve-ball");
  await expect(sphere).toBeVisible();
  await expect(sphere).toHaveAttribute("aria-hidden", "true");
  await expect(prompt.locator("#sudoku-errors-cancel")).toBeFocused();
  return prompt;
};

const readStatusbarGeometry = (sudokuWindow) =>
  sudokuWindow.evaluate((windowElement) => {
    const selectors = [
      ".sudoku-statusbar",
      "#sudoku-status",
      "#sudoku-mistakes",
      "#sudoku-time",
      "#sudoku-leaderboard-checks",
      ".sudoku-control-panel",
      "#sudoku-check",
    ];
    return Object.fromEntries(
      selectors.map((selector) => {
        const element = windowElement.querySelector(selector);
        if (!element) throw new Error(`Missing geometry target: ${selector}`);
        const rect = element.getBoundingClientRect();
        return [
          selector,
          {
            height: rect.height,
            width: rect.width,
            x: rect.x,
            y: rect.y,
          },
        ];
      })
    );
  });

const expectGeometryToMatch = (actual, expected) => {
  expect(Object.keys(actual)).toEqual(Object.keys(expected));
  for (const [selector, expectedRect] of Object.entries(expected)) {
    for (const [dimension, expectedValue] of Object.entries(expectedRect)) {
      expect(
        actual[selector][dimension],
        `${selector} ${dimension} changed when the timer text grew`
      ).toBeCloseTo(expectedValue, 1);
    }
  }
};

const expectViewportContainment = async (page, sudokuWindow, prompt = null) => {
  const layout = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  }));
  expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth);

  const expectContained = async (locator, label) => {
    const rect = await locator.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });
    expect(rect.left, `${label} left edge`).toBeGreaterThanOrEqual(-1);
    expect(rect.top, `${label} top edge`).toBeGreaterThanOrEqual(-1);
    expect(rect.right, `${label} right edge`).toBeLessThanOrEqual(
      rect.viewportWidth + 1
    );
    expect(rect.bottom, `${label} bottom edge`).toBeLessThanOrEqual(
      rect.viewportHeight + 1
    );
  };

  await expectContained(sudokuWindow, "Sudoku window");
  if (prompt) await expectContained(prompt, "Errors prompt");

  const internalOverflow = await sudokuWindow.evaluate((windowElement) => {
    const app = windowElement.querySelector(".sudoku-app");
    const statusbar = windowElement.querySelector(".sudoku-statusbar");
    return {
      appClientWidth: app?.clientWidth || 0,
      appScrollWidth: app?.scrollWidth || 0,
      statusbarClientWidth: statusbar?.clientWidth || 0,
      statusbarScrollWidth: statusbar?.scrollWidth || 0,
    };
  });
  expect(internalOverflow.appScrollWidth).toBeLessThanOrEqual(
    internalOverflow.appClientWidth
  );
  expect(internalOverflow.statusbarScrollWidth).toBeLessThanOrEqual(
    internalOverflow.statusbarClientWidth
  );
};

test("Errors confirmation is repeatable, puzzle-scoped, and disqualifies only after a visible error", async ({
  page,
}) => {
  const { runtimeErrors, sudokuWindow } = await preparePage(page);
  const errorsButton = sudokuWindow.locator('[data-sudoku-hint="errors"]');
  const offButton = sudokuWindow.locator('[data-sudoku-hint="off"]');
  const prompt = sudokuWindow.locator("#sudoku-errors-prompt");

  await expect(sudokuWindow.locator('[data-sudoku-hint="reveal"]')).toHaveCount(0);
  await expect(
    sudokuWindow.getByRole("button", { name: "Reveal", exact: true })
  ).toHaveCount(0);
  await expect(offButton).toHaveAttribute("aria-pressed", "true");

  await errorsButton.click();
  const firstPrompt = await expectWarningPrompt(sudokuWindow);
  await expect(errorsButton).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Shift+Tab");
  await expect(firstPrompt.locator("#sudoku-errors-confirm")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstPrompt.locator("#sudoku-errors-cancel")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(prompt).toBeHidden();
  await expect(offButton).toHaveAttribute("aria-pressed", "true");
  await expect(errorsButton).toBeFocused();

  await errorsButton.click();
  await expectWarningPrompt(sudokuWindow);
  await prompt.locator("#sudoku-errors-cancel").click();
  await expect(prompt).toBeHidden();
  await expect(offButton).toHaveAttribute("aria-pressed", "true");
  await expect(errorsButton).toBeFocused();

  await errorsButton.click();
  await expectWarningPrompt(sudokuWindow);
  await prompt.locator("#sudoku-errors-confirm").click();
  await expect(prompt).toBeHidden();
  await expect(errorsButton).toHaveAttribute("aria-pressed", "true");
  expect(await readState(page)).toMatchObject({
    errorsConfirmed: true,
    hintMode: "errors",
    mistakes: 0,
    usedHint: false,
  });

  await offButton.click();
  await expect(offButton).toHaveAttribute("aria-pressed", "true");
  await errorsButton.click();
  await expect(prompt).toBeHidden();
  await expect(errorsButton).toHaveAttribute("aria-pressed", "true");
  expect(await readState(page)).toMatchObject({
    errorsConfirmed: true,
    hintMode: "errors",
    usedHint: false,
  });

  const { cell } = await enterIncorrectDigit(page, sudokuWindow);
  await expect(cell).toHaveClass(/is-invalid/);
  await expect(sudokuWindow.locator("#sudoku-mistakes")).toHaveText("Mistakes: 1");
  expect(await readState(page)).toMatchObject({ mistakes: 1, usedHint: true });

  await sudokuWindow.locator("#sudoku-check").click();
  await expect(sudokuWindow.locator("#sudoku-leaderboard-checks")).toHaveText(
    CHECK_COUNTER_TEXT(1)
  );
  await sudokuWindow.locator("#sudoku-new").click();
  await expect(offButton).toHaveAttribute("aria-pressed", "true");
  await expect(errorsButton).toHaveAttribute("aria-pressed", "false");
  await expect(sudokuWindow.locator("#sudoku-leaderboard-checks")).toHaveText(
    CHECK_COUNTER_TEXT(0)
  );
  expect(await readState(page)).toMatchObject({
    checksUsed: 0,
    errorsConfirmed: false,
    hintMode: "off",
    mistakes: 0,
    usedHint: false,
  });

  await errorsButton.click();
  await expectWarningPrompt(sudokuWindow);
  await prompt.locator("#sudoku-errors-cancel").click();
  expectNoUnexpectedRuntimeErrors(runtimeErrors);
});

test("three diagnostic checks are allowed and a completed board remains submittable", async ({
  page,
}) => {
  const { api, runtimeErrors, sudokuWindow } = await preparePage(page);
  const checkButton = sudokuWindow.locator("#sudoku-check");
  const counter = sudokuWindow.locator("#sudoku-leaderboard-checks");
  const { cell } = await enterIncorrectDigit(page, sudokuWindow);

  await expect(cell).not.toHaveClass(/is-invalid/);
  for (let count = 1; count <= 3; count += 1) {
    await checkButton.click();
    await expect(counter).toHaveText(CHECK_COUNTER_TEXT(count));
    await expect(cell).toHaveClass(/is-invalid/);
    expect(await readState(page)).toMatchObject({
      checksUsed: count,
      usedHint: false,
    });
  }

  await checkButton.click();
  await expect(counter).toHaveText(CHECK_COUNTER_TEXT(3));
  await expect(sudokuWindow.locator("#sudoku-status")).toHaveText(
    "No checks remaining"
  );
  await expect(sudokuWindow.locator("#sudoku-mistakes")).toHaveText("Mistakes: 0");
  await expect(cell).not.toHaveClass(/is-invalid/);
  expect(await readState(page)).toMatchObject({
    checksUsed: 3,
    mistakes: 0,
    usedHint: false,
  });

  const completion = await page.evaluate(() =>
    window.__sudokuCheckControlsTest.prepareCompletedBoard()
  );
  expect(completion.editableCellCount).toBeGreaterThan(0);
  await page.evaluate(() => window.__sudokuCheckControlsTest.freezeTimerAt(75));
  await checkButton.click();
  await expect(sudokuWindow.locator("#sudoku-status")).toHaveText("Solved");
  await expect(sudokuWindow.locator("#sudoku-solve-popup")).toBeVisible();
  expect(await readState(page)).toMatchObject({
    checksUsed: 3,
    solved: true,
    usedHint: false,
  });
  await expect.poll(() => api.eventRequests.length, { timeout: 10_000 }).toBe(1);
  expect(api.eventRequests[0].event).toMatchObject({
    difficulty: "easy",
    game: "sudoku",
    hintBucket: "noHints",
    metric: 75,
    metricKind: "seconds",
    type: "win",
  });
  expectNoUnexpectedRuntimeErrors(runtimeErrors);
});

for (const viewport of viewports) {
  test(`the stable status bar and Errors prompt fit the ${viewport.name} viewport`, async ({
    page,
  }, testInfo) => {
    const { runtimeErrors, sudokuWindow } = await preparePage(page, viewport);
    const counter = sudokuWindow.locator("#sudoku-leaderboard-checks");
    await expect(counter).toHaveText(CHECK_COUNTER_TEXT(0));
    await expect(sudokuWindow.locator('[data-sudoku-hint="reveal"]')).toHaveCount(0);

    const timerCases = [
      { elapsedSeconds: 0, text: "Time: 00:00" },
      { elapsedSeconds: 5_999, text: "Time: 99:59" },
      { elapsedSeconds: 21_600, text: "Time: 360:00" },
    ];
    let baselineGeometry = null;
    for (const timerCase of timerCases) {
      await page.evaluate(
        (elapsedSeconds) =>
          window.__sudokuCheckControlsTest.freezeTimerAt(elapsedSeconds),
        timerCase.elapsedSeconds
      );
      await expect(sudokuWindow.locator("#sudoku-time")).toHaveText(timerCase.text);
      const geometry = await readStatusbarGeometry(sudokuWindow);
      if (!baselineGeometry) baselineGeometry = geometry;
      else expectGeometryToMatch(geometry, baselineGeometry);
    }

    await expectViewportContainment(page, sudokuWindow);
    const layoutScreenshot = testInfo.outputPath(
      `sudoku-check-controls-layout-${viewport.width}x${viewport.height}.png`
    );
    await page.screenshot({ fullPage: true, path: layoutScreenshot });
    await testInfo.attach(`sudoku-check-controls-layout-${viewport.name}`, {
      path: layoutScreenshot,
      contentType: "image/png",
    });

    await sudokuWindow.locator('[data-sudoku-hint="errors"]').click();
    const prompt = await expectWarningPrompt(sudokuWindow);
    await expectViewportContainment(page, sudokuWindow, prompt);
    const promptScreenshot = testInfo.outputPath(
      `sudoku-check-controls-prompt-${viewport.width}x${viewport.height}.png`
    );
    await page.screenshot({ fullPage: true, path: promptScreenshot });
    await testInfo.attach(`sudoku-check-controls-prompt-${viewport.name}`, {
      path: promptScreenshot,
      contentType: "image/png",
    });

    await page.keyboard.press("Escape");
    await expect(prompt).toBeHidden();
    expectNoUnexpectedRuntimeErrors(runtimeErrors);
  });
}
