import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";

test.setTimeout(300_000);

const API_BASE_URL = "https://game-stats-sudoku-publish.test";
const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const GAME_STATS_SYNC_QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const SUDOKU_STORAGE_KEY = "personalSiteSudokuStateV1";
const TEST_INITIALIZATION_MARKER = "sudokuPublishFlowInitializedV1";
const SUDOKU_DIFFICULTIES = Object.freeze([
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
  "extreme",
]);
const BASELINE_NO_HINTS_WINS = 2;
const BASELINE_WITH_HINTS_WINS = 1;
const PUBLISH_TIMEOUT_MS = 30_000;

const profile = Object.freeze({
  id: "player-sudoku-publish",
  name: "Sudoku Publisher",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const scenarios = Object.freeze([
  Object.freeze({
    elapsedSeconds: 120,
    hintBucket: "noHints",
    label: "no hints",
    usesHintControl: false,
  }),
  Object.freeze({
    elapsedSeconds: 40,
    hintBucket: "withHints",
    label: "with hints",
    usesHintControl: true,
  }),
]);

const generatedBackendSource = await readFile(
  new URL("../../scripts/home/game-stats-backend.js", import.meta.url),
  "utf8"
);
const generatedBuildVersion = generatedBackendSource.match(
  /buildVersion:\s*"(sha256-[a-f0-9]{64})"/
)?.[1];
if (!generatedBuildVersion) {
  throw new Error("Unable to read the generated game build version.");
}

const installBackendConfig = async (page) => {
  const mockedBackendSource = generatedBackendSource.replace(
    /apiBaseUrl:\s*"[^"]*"/,
    `apiBaseUrl: ${JSON.stringify(API_BASE_URL)}`
  );
  if (mockedBackendSource === generatedBackendSource) {
    throw new Error("Unable to install the Sudoku publish backend config.");
  }
  await page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      body: mockedBackendSource,
      contentType: "application/javascript",
    })
  );
};

const installMainBridge = async (page) => {
  const mainSource = await readIsolatedMainSource();
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__sudokuPublishFlowTest = Object.freeze({
  readLifecycle: () => ({
    difficulty: sudokuState.difficulty,
    hasStatsSession: Boolean(sudokuState.statsSession),
    playing: sudokuState.playing,
    statsSessionEligible: sudokuState.statsSessionEligible,
    timerRunning: Boolean(sudokuState.timerId),
  }),
  readIncorrectEntry: () => {
    const cells = sudokuCells();
    const index = cells.findIndex((cell) => !isSudokuCellReadOnly(cell));
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("Sudoku puzzle has no editable cell for an error check.");
    }
    const solutionDigit = sudokuState.solution[index];
    const incorrectDigit = Array.from(SUDOKU_DIGITS).find(
      (digit) => digit !== solutionDigit
    );
    if (!incorrectDigit) {
      throw new Error("Unable to choose an incorrect Sudoku digit.");
    }
    return { incorrectDigit, index, solutionDigit };
  },
  prepareOneCellShort: (elapsedSeconds) => {
    if (!sudokuState.playing) {
      throw new Error("Sudoku must be playing before preparing the terminal board.");
    }
    const cells = sudokuCells();
    const editableIndexes = cells
      .map((cell, index) => (isSudokuCellReadOnly(cell) ? -1 : index))
      .filter((index) => index >= 0);
    const finalIndex = editableIndexes.at(-1);
    if (!Number.isInteger(finalIndex)) {
      throw new Error("Sudoku puzzle has no editable completion cell.");
    }

    editableIndexes.forEach((index) => {
      const cell = cells[index];
      setSudokuCellNotes(cell, index, "");
      setSudokuCellValue(
        cell,
        index,
        index === finalIndex ? "" : sudokuState.solution[index]
      );
      syncSudokuCellFeedback(cell, index);
    });
    sudokuState.elapsedSeconds = Math.max(1, Math.trunc(Number(elapsedSeconds) || 0));
    sudokuState.timerStartedAt = 0;
    updateSudokuTimeDisplay();

    return {
      difficulty: sudokuState.difficulty,
      elapsedSeconds: currentSudokuElapsedSeconds(),
      finalDigit: sudokuState.solution[finalIndex],
      finalIndex,
    };
  },
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the Sudoku publish test bridge.");
  }
  await page.route("**/scripts/home/main.js*", (route) =>
    route.fulfill({
      body: instrumentedSource,
      contentType: "application/javascript",
    })
  );
};

const emptySudokuMap = (valueFactory) =>
  Object.fromEntries(
    SUDOKU_DIFFICULTIES.map((difficulty) => [difficulty, valueFactory(difficulty)])
  );

const createLeaderboardEntry = ({
  eventId,
  playerId,
  name,
  icon = profile.icon,
  metric,
  occurredAt,
}) => ({
  eventId,
  playerId,
  name,
  icon,
  metric,
  metricKind: "seconds",
  occurredAt,
});

const baselineEntries = Object.freeze([
  Object.freeze(
    createLeaderboardEntry({
      eventId: "sudoku-global-aria-0001",
      playerId: "player-sudoku-aria",
      name: "Aria",
      metric: 90,
      occurredAt: "2026-07-01T00:00:00.000Z",
    })
  ),
  Object.freeze(
    createLeaderboardEntry({
      eventId: "sudoku-global-nia-0001",
      playerId: "player-sudoku-nia",
      name: "Nia",
      metric: 180,
      occurredAt: "2026-07-02T00:00:00.000Z",
    })
  ),
]);

const createStatsPayload = (publishedEvents) => {
  const noHintsEvents = publishedEvents
    .filter((event) => event.hintBucket === "noHints")
    .sort((first, second) => first.metric - second.metric);
  const currentBestEvent = noHintsEvents[0] || null;
  const currentPlayerEntry = currentBestEvent
    ? createLeaderboardEntry({
        eventId: currentBestEvent.id,
        playerId: profile.id,
        name: profile.name,
        metric: currentBestEvent.metric,
        occurredAt: currentBestEvent.occurredAt,
      })
    : null;
  const easyLeaderboard = currentPlayerEntry
    ? [baselineEntries[0], currentPlayerEntry, baselineEntries[1]]
    : [...baselineEntries];
  const easyRank = currentPlayerEntry
    ? { rank: 2, totalPlayers: 3 }
    : { rank: null, totalPlayers: 2 };

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    eventIds: publishedEvents.map((event) => event.id),
    totals: {
      sudoku: {
        wins: {
          ...emptySudokuMap(() => ({ noHints: 0, withHints: 0 })),
          easy: {
            noHints:
              BASELINE_NO_HINTS_WINS +
              publishedEvents.filter((event) => event.hintBucket === "noHints").length,
            withHints:
              BASELINE_WITH_HINTS_WINS +
              publishedEvents.filter((event) => event.hintBucket === "withHints").length,
          },
        },
      },
    },
    leaderboards: {
      sudoku: {
        ...emptySudokuMap(() => []),
        easy: easyLeaderboard,
      },
    },
    playerRanks: {
      sudoku: {
        ...emptySudokuMap(() => ({ rank: null, totalPlayers: 0 })),
        easy: easyRank,
      },
    },
    playerRecords: {
      sudoku: {
        ...emptySudokuMap(() => null),
        easy: currentPlayerEntry,
      },
    },
  };
};

const installApi = async (page, scenario) => {
  const eventRequests = [];
  const requestSequence = [];
  const sessionRequests = [];
  const sessionProofs = [];
  const statsRequests = [];
  const publishedEvents = [];
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
      requestSequence.push("session");
      const sequence = String(sessionRequests.length).padStart(4, "0");
      const proof = {
        id: `session-sudoku-${scenario.hintBucket.toLowerCase()}-${sequence}`,
        token: `session-sudoku-${scenario.hintBucket.toLowerCase()}-token-${sequence}`,
      };
      sessionProofs.push(proof);
      await route.fulfill({
        status: 201,
        body: JSON.stringify({
          ...proof,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
        contentType: "application/json",
        headers: corsHeaders,
      });
      return;
    }

    if (request.method() === "POST" && url.pathname === "/events") {
      const body = JSON.parse(request.postData() || "{}");
      eventRequests.push(body);
      requestSequence.push("event");
      publishedEvents.push(body.event);
      await route.fulfill({
        status: 201,
        body: JSON.stringify({ ok: true, applied: true }),
        contentType: "application/json",
        headers: corsHeaders,
      });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/stats") {
      const refreshed = publishedEvents.length > 0;
      statsRequests.push({ path: url.pathname + url.search, refreshed });
      requestSequence.push(refreshed ? "stats-refreshed" : "stats-baseline");
      await route.fulfill({
        status: 200,
        body: JSON.stringify(createStatsPayload(publishedEvents)),
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

  return {
    eventRequests,
    requestSequence,
    sessionProofs,
    sessionRequests,
    statsRequests,
  };
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

const prepareTerminalBoard = async (page, elapsedSeconds) => {
  const terminal = await page.evaluate(
    (seconds) => window.__sudokuPublishFlowTest.prepareOneCellShort(seconds),
    elapsedSeconds
  );
  expect(terminal).toEqual({
    difficulty: "easy",
    elapsedSeconds,
    finalDigit: expect.stringMatching(/^[1-9]$/),
    finalIndex: expect.any(Number),
  });
  return terminal;
};

const finishTerminalBoard = async (sudokuWindow, terminal) => {
  const finalCell = sudokuWindow.locator(
    `.sudoku-cell[data-sudoku-index="${terminal.finalIndex}"]`
  );
  await finalCell.click();
  await sudokuWindow.locator(`[data-sudoku-number="${terminal.finalDigit}"]`).click();
  await expect(finalCell).toHaveAttribute("data-sudoku-value", terminal.finalDigit);
  await sudokuWindow.locator("#sudoku-check").click();
  await expect(sudokuWindow.locator("#sudoku-status")).toHaveText("Solved");
  return finalCell;
};

const confirmErrorsAndRevealMistake = async (page, sudokuWindow) => {
  const errorsHint = sudokuWindow.locator('[data-sudoku-hint="errors"]');
  const errorsPrompt = sudokuWindow.locator("#sudoku-errors-prompt");
  const cancelButton = errorsPrompt.locator("#sudoku-errors-cancel");
  const confirmButton = errorsPrompt.locator("#sudoku-errors-confirm");

  await errorsHint.click();
  await expect(errorsPrompt).toBeVisible();
  await expect(errorsPrompt).toHaveAttribute("role", "alertdialog");
  await expect(errorsPrompt.locator("#sudoku-errors-prompt-message")).toHaveText(
    "Are you sure you would like to have errors revealed? Doing so will disqualify you from the leaderboard."
  );
  await expect(errorsPrompt.locator(".sudoku-solve-ball")).toBeVisible();
  await expect(cancelButton).toHaveText("Cancel");
  await expect(cancelButton).toBeFocused();
  await expect(errorsHint).toHaveAttribute("aria-pressed", "false");

  await confirmButton.click();
  await expect(errorsPrompt).toBeHidden();
  await expect(errorsHint).toHaveAttribute("aria-pressed", "true");

  const incorrectEntry = await page.evaluate(() =>
    window.__sudokuPublishFlowTest.readIncorrectEntry()
  );
  expect(incorrectEntry).toEqual({
    incorrectDigit: expect.stringMatching(/^[1-9]$/),
    index: expect.any(Number),
    solutionDigit: expect.stringMatching(/^[1-9]$/),
  });
  expect(incorrectEntry.incorrectDigit).not.toBe(incorrectEntry.solutionDigit);

  const incorrectCell = sudokuWindow.locator(
    `.sudoku-cell[data-sudoku-index="${incorrectEntry.index}"]`
  );
  await incorrectCell.click();
  await sudokuWindow
    .locator(`[data-sudoku-number="${incorrectEntry.incorrectDigit}"]`)
    .click();
  await expect(incorrectCell).toHaveAttribute(
    "data-sudoku-value",
    incorrectEntry.incorrectDigit
  );
  await expect(incorrectCell).toHaveClass(/is-invalid/);
  await expect(sudokuWindow.locator("#sudoku-mistakes")).toHaveText("Mistakes: 1");
};

const preparePage = async (page, viewport, scenario) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ initializationKey, profileKey, queueKey, savedProfile, statsKey, sudokuKey }) => {
      Math.random = () => 0.999999;
      if (sessionStorage.getItem(initializationKey) === "1") return;
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem(initializationKey, "1");
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
      localStorage.removeItem(queueKey);
      localStorage.removeItem(statsKey);
      localStorage.removeItem(sudokuKey);
    },
    {
      initializationKey: TEST_INITIALIZATION_MARKER,
      profileKey: PROFILE_STORAGE_KEY,
      queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      savedProfile: profile,
      statsKey: GAME_STATS_STORAGE_KEY,
      sudokuKey: SUDOKU_STORAGE_KEY,
    }
  );
  await installBackendConfig(page);
  await installMainBridge(page);
  const api = await installApi(page, scenario);

  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  const aboutWindow = page.locator("#about-window");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) {
    await aboutClose.click();
    await expect(aboutWindow).toBeHidden();
  }
  await expect
    .poll(() => api.statsRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBeGreaterThanOrEqual(1);
  await expect(page.evaluate(() => window.rohinGameStatsBackend)).resolves.toEqual({
    apiBaseUrl: API_BASE_URL,
    buildVersion: generatedBuildVersion,
  });

  await page.locator('.desktop-icon[data-app="sudoku"]').click();
  const sudokuWindow = page.locator('[data-app-window="sudoku"]');
  await expect(sudokuWindow).toBeVisible();
  const playButton = sudokuWindow.locator("#sudoku-play");
  await expect(playButton).toBeEnabled({ timeout: PUBLISH_TIMEOUT_MS });
  expect(api.sessionRequests).toEqual([]);
  expect(api.eventRequests).toEqual([]);

  await playButton.click();
  await expect(sudokuWindow.locator(".sudoku-app")).toHaveClass(/is-sudoku-playing/, {
    timeout: PUBLISH_TIMEOUT_MS,
  });
  await expect
    .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.__sudokuPublishFlowTest.readLifecycle()), {
      timeout: PUBLISH_TIMEOUT_MS,
    })
    .toEqual({
      difficulty: "easy",
      hasStatsSession: true,
      playing: true,
      statsSessionEligible: true,
      timerRunning: true,
    });

  if (scenario.usesHintControl) {
    await confirmErrorsAndRevealMistake(page, sudokuWindow);
  } else {
    await expect(sudokuWindow.locator('[data-sudoku-hint="off"]')).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  }

  const terminal = await prepareTerminalBoard(page, scenario.elapsedSeconds);
  await finishTerminalBoard(sudokuWindow, terminal);
  await expect
    .poll(() => api.requestSequence, { timeout: PUBLISH_TIMEOUT_MS })
    .toContain("event");
  expect(api.eventRequests).toHaveLength(1);
  await expect
    .poll(() => api.statsRequests.some(({ refreshed }) => refreshed), {
      timeout: PUBLISH_TIMEOUT_MS,
    })
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        (queueKey) => JSON.parse(localStorage.getItem(queueKey) || "[]"),
        GAME_STATS_SYNC_QUEUE_STORAGE_KEY
      ),
      { timeout: PUBLISH_TIMEOUT_MS }
    )
    .toEqual([]);

  const statsWindow = page.locator("#game-stats-window-sudoku");
  if (!(await statsWindow.isVisible())) {
    await sudokuWindow
      .locator('[data-game-stats-open="sudoku"]')
      .evaluate((button) => button.click());
  }
  await expect(statsWindow).toBeVisible();
  await expect(statsWindow.locator("[data-game-stats-sync-status]")).toHaveText(
    "Global stats are up to date."
  );

  return { api, runtimeErrors, statsWindow, sudokuWindow, terminal };
};

const expectPublishedRequestContract = (api, scenario) => {
  expect(generatedBuildVersion).toMatch(/^sha256-[a-f0-9]{64}$/);
  expect(api.sessionRequests).toEqual([
    {
      game: "sudoku",
      config: { difficulty: "easy" },
      buildVersion: generatedBuildVersion,
    },
  ]);
  expect(api.eventRequests).toHaveLength(1);
  expect(api.eventRequests[0]).toEqual({
    event: {
      id: expect.stringMatching(/^local-[a-f0-9-]{36}$/),
      game: "sudoku",
      type: "win",
      occurredAt: expect.any(String),
      difficulty: "easy",
      hintBucket: scenario.hintBucket,
      metric: scenario.elapsedSeconds,
      metricKind: "seconds",
      profile: {
        id: profile.id,
        name: profile.name,
        icon: profile.icon,
      },
    },
    session: {
      id: api.sessionProofs[0].id,
      token: api.sessionProofs[0].token,
    },
  });

  const sessionIndex = api.requestSequence.indexOf("session");
  const eventIndex = api.requestSequence.indexOf("event");
  expect(api.requestSequence.filter((request) => request === "session")).toEqual([
    "session",
  ]);
  expect(api.requestSequence.filter((request) => request === "event")).toEqual([
    "event",
  ]);
  expect(sessionIndex).toBeGreaterThanOrEqual(0);
  expect(eventIndex).toBeGreaterThan(sessionIndex);
  expect(api.requestSequence.slice(eventIndex + 1)).toContain("stats-refreshed");
  expect(api.statsRequests.some(({ refreshed }) => !refreshed)).toBe(true);
  expect(api.statsRequests.some(({ refreshed }) => refreshed)).toBe(true);
  expect(
    api.statsRequests.every(({ path }) => path === `/stats?playerId=${profile.id}`)
  ).toBe(true);
};

const readStoredStats = (page) =>
  page.evaluate(
    ({ queueKey, statsKey }) => ({
      queue: JSON.parse(localStorage.getItem(queueKey) || "[]"),
      stats: JSON.parse(localStorage.getItem(statsKey) || "null"),
    }),
    {
      queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      statsKey: GAME_STATS_STORAGE_KEY,
    }
  );

const expectLocalSudokuResult = (stored, scenario) => {
  expect(stored.queue).toEqual([]);
  expect(stored.stats.eventIds).toHaveLength(1);
  expect(stored.stats.totals.sudoku.wins.easy).toEqual({
    noHints: scenario.hintBucket === "noHints" ? 1 : 0,
    withHints: scenario.hintBucket === "withHints" ? 1 : 0,
  });
  expect(stored.stats.totals.sudoku.bestTimes.easy).toBe(
    scenario.hintBucket === "noHints" ? scenario.elapsedSeconds : null
  );

  const localLeaderboard = stored.stats.leaderboards.sudoku.easy;
  const localRecord = stored.stats.playerRecords.sudoku.easy;
  if (scenario.hintBucket === "noHints") {
    expect(localLeaderboard).toHaveLength(1);
    expect(localLeaderboard[0]).toMatchObject({
      eventId: stored.stats.eventIds[0],
      playerId: profile.id,
      name: profile.name,
      icon: profile.icon,
      metric: scenario.elapsedSeconds,
      metricKind: "seconds",
    });
    expect(localRecord).toMatchObject({
      eventId: stored.stats.eventIds[0],
      playerId: profile.id,
      metric: scenario.elapsedSeconds,
    });
  } else {
    expect(localLeaderboard).toEqual([]);
    expect(localRecord).toBeNull();
  }

  for (const difficulty of SUDOKU_DIFFICULTIES.slice(1)) {
    expect(stored.stats.totals.sudoku.wins[difficulty]).toEqual({
      noHints: 0,
      withHints: 0,
    });
    expect(stored.stats.totals.sudoku.bestTimes[difficulty]).toBeNull();
    expect(stored.stats.leaderboards.sudoku[difficulty]).toEqual([]);
    expect(stored.stats.playerRecords.sudoku[difficulty]).toBeNull();
  }
};

const expectGlobalSudokuResult = async (statsWindow, scenario) => {
  const panels = statsWindow.locator(".game-stats-sudoku-leaderboard");
  await expect(panels).toHaveCount(SUDOKU_DIFFICULTIES.length);
  const easyPanel = statsWindow.locator('[aria-labelledby="game-stats-sudoku-easy"]');
  const rows = easyPanel.locator(
    ".game-stats-leaderboard-template-list > .game-stats-sudoku-row"
  );
  const personalRecord = easyPanel.locator(".game-stats-sudoku-local-best-row");

  await expect(easyPanel.getByText("No-Hints Top 3", { exact: true })).toBeVisible();
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toHaveAttribute("aria-label", "Rank 1: Aria, 90 seconds");
  if (scenario.hintBucket === "noHints") {
    await expect(rows.nth(1)).toHaveAttribute(
      "aria-label",
      "Rank 2: Sudoku Publisher, 120 seconds, your entry"
    );
    await expect(rows.nth(2)).toHaveAttribute(
      "aria-label",
      "Rank 3: Nia, 180 seconds"
    );
    await expect(personalRecord).toHaveAttribute(
      "aria-label",
      "Your no-hints record: #2, Sudoku Publisher, 120 seconds"
    );
    await expect(personalRecord.locator(".game-stats-metric--text")).toHaveText("02:00");
  } else {
    await expect(rows.nth(1)).toHaveAttribute(
      "aria-label",
      "Rank 2: Nia, 180 seconds"
    );
    await expect(rows.nth(2)).toHaveAttribute(
      "aria-label",
      "Rank 3: N/A, no recorded time"
    );
    await expect(rows.locator(".game-stats-metric--text")).toHaveText([
      "01:30",
      "03:00",
      "99:99",
    ]);
    await expect(personalRecord).toHaveAttribute(
      "aria-label",
      "Your no-hints record: #—, N/A, no record"
    );
    await expect(personalRecord.locator(".game-stats-metric--text")).toHaveText("99:99");
  }

  await expect(
    easyPanel.locator(
      '[aria-label="Total verified Sudoku completions on Easy: 4"]'
    )
  ).toBeVisible();

  for (const difficulty of SUDOKU_DIFFICULTIES.slice(1)) {
    const label = `${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;
    const panel = statsWindow.locator(
      `[aria-labelledby="game-stats-sudoku-${difficulty}"]`
    );
    await expect(
      panel.locator(
        `[aria-label="Total verified Sudoku completions on ${label}: 0"]`
      )
    ).toBeVisible();
  }
};

const expectStatsWindowContained = async (page, statsWindow) => {
  const layout = await statsWindow.evaluate((windowElement) => {
    const bounds = windowElement.getBoundingClientRect();
    const body = windowElement.querySelector(".window-body");
    return {
      bodyClientWidth: body?.clientWidth || 0,
      bodyScrollWidth: body?.scrollWidth || 0,
      documentScrollWidth: document.documentElement.scrollWidth,
      left: bounds.left,
      right: bounds.right,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.bodyClientWidth);
  expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(
    layout.viewportWidth
  );
};

for (const viewport of viewports) {
  for (const scenario of scenarios) {
    test(`a verified Sudoku ${scenario.label} completion publishes at ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      const { api, runtimeErrors, statsWindow } = await preparePage(
        page,
        viewport,
        scenario
      );
      const status = statsWindow.locator("[data-game-stats-sync-status]");

      await expect(status).toHaveAttribute("data-game-stats-sync-state", "ready");
      await expect(status).toHaveAttribute("role", "status");
      await expectGlobalSudokuResult(statsWindow, scenario);
      expectPublishedRequestContract(api, scenario);
      expectLocalSudokuResult(await readStoredStats(page), scenario);

      const refreshButton = statsWindow.locator('[data-game-stats-refresh="sudoku"]');
      await expect(refreshButton).toHaveAttribute("aria-label", "Refresh Sudoku stats");
      await refreshButton.focus();
      await expect(refreshButton).toBeFocused();
      await expectStatsWindowContained(page, statsWindow);

      const screenshotPath = testInfo.outputPath(
        `sudoku-publish-${scenario.hintBucket}-${viewport.width}x${viewport.height}.png`
      );
      await page.screenshot({ fullPage: true, path: screenshotPath });
      await testInfo.attach(
        `sudoku-publish-${scenario.hintBucket}-${viewport.name}`,
        { path: screenshotPath, contentType: "image/png" }
      );

      expectNoUnexpectedRuntimeErrors(runtimeErrors);
    });
  }
}

test("a solved Sudoku puzzle records once after undo, reload, and New Game", async ({
  page,
}) => {
  const scenario = scenarios[0];
  const { api, runtimeErrors, statsWindow, sudokuWindow, terminal } = await preparePage(
    page,
    { width: 1280, height: 800 },
    scenario
  );
  const closeStats = statsWindow.locator('[data-close="game-stats-sudoku"]');
  await closeStats.click();
  await expect(statsWindow).toBeHidden();
  const solveOk = sudokuWindow.locator("#sudoku-solve-ok");
  if (await solveOk.isVisible()) await solveOk.click();

  const finalCell = sudokuWindow.locator(
    `.sudoku-cell[data-sudoku-index="${terminal.finalIndex}"]`
  );
  await sudokuWindow.locator("#sudoku-undo").click();
  await expect(finalCell).toHaveAttribute("data-sudoku-value", "");
  await finalCell.click();
  await sudokuWindow.locator(`[data-sudoku-number="${terminal.finalDigit}"]`).click();
  await sudokuWindow.locator("#sudoku-check").click();
  await expect(sudokuWindow.locator("#sudoku-status")).toHaveText("Solved");

  expect(api.sessionRequests).toHaveLength(1);
  expect(api.eventRequests).toHaveLength(1);
  let stored = await readStoredStats(page);
  expect(stored.queue).toEqual([]);
  expect(stored.stats.eventIds).toHaveLength(1);
  expect(stored.stats.totals.sudoku.wins.easy).toEqual({
    noHints: 1,
    withHints: 0,
  });

  await expect
    .poll(() =>
      page.evaluate((sudokuKey) => {
        const saved = JSON.parse(localStorage.getItem(sudokuKey) || "null");
        return saved
          ? {
              completionRecorded: saved.completionRecorded,
              solved: saved.solved,
            }
          : null;
      }, SUDOKU_STORAGE_KEY),
      { timeout: PUBLISH_TIMEOUT_MS }
    )
    .toEqual({ completionRecorded: true, solved: true });

  const statsRequestCountBeforeReload = api.statsRequests.length;
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() => api.statsRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBeGreaterThan(statsRequestCountBeforeReload);
  await expect(
    page.evaluate(
      ({ initializationKey, sudokuKey }) => ({
        completionRecorded: JSON.parse(localStorage.getItem(sudokuKey) || "null")
          ?.completionRecorded,
        initializationMarker: sessionStorage.getItem(initializationKey),
      }),
      {
        initializationKey: TEST_INITIALIZATION_MARKER,
        sudokuKey: SUDOKU_STORAGE_KEY,
      }
    )
  ).resolves.toEqual({
    completionRecorded: true,
    initializationMarker: "1",
  });

  const aboutCloseAfterReload = page.locator('#about-window [data-close="about"]');
  if (await aboutCloseAfterReload.isVisible()) await aboutCloseAfterReload.click();
  await page.locator('.desktop-icon[data-app="sudoku"]').click();
  await expect(sudokuWindow).toBeVisible();
  const restoredPlayButton = sudokuWindow.locator("#sudoku-play");
  await expect(restoredPlayButton).toBeEnabled({ timeout: PUBLISH_TIMEOUT_MS });
  await restoredPlayButton.click();
  await expect(sudokuWindow.locator(".sudoku-app")).toHaveClass(/is-sudoku-playing/, {
    timeout: PUBLISH_TIMEOUT_MS,
  });
  await expect
    .poll(() => page.evaluate(() => window.__sudokuPublishFlowTest.readLifecycle()), {
      timeout: PUBLISH_TIMEOUT_MS,
    })
    .toEqual({
      difficulty: "easy",
      hasStatsSession: false,
      playing: true,
      statsSessionEligible: false,
      timerRunning: false,
    });

  const restoredTerminal = await prepareTerminalBoard(page, 135);
  await finishTerminalBoard(sudokuWindow, restoredTerminal);
  await page.waitForTimeout(500);
  expect(api.sessionRequests).toHaveLength(1);
  expect(api.eventRequests).toHaveLength(1);
  stored = await readStoredStats(page);
  expect(stored.queue).toEqual([]);
  expect(stored.stats.eventIds).toHaveLength(1);
  expect(stored.stats.totals.sudoku.wins.easy).toEqual({
    noHints: 1,
    withHints: 0,
  });

  if (await solveOk.isVisible()) await solveOk.click();
  await sudokuWindow.locator("#sudoku-new").click();
  await expect
    .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(2);
  const nextTerminal = await prepareTerminalBoard(page, 150);
  await finishTerminalBoard(sudokuWindow, nextTerminal);
  await expect
    .poll(() => api.eventRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(2);
  await expect
    .poll(() =>
      page.evaluate(
        (queueKey) => JSON.parse(localStorage.getItem(queueKey) || "[]"),
        GAME_STATS_SYNC_QUEUE_STORAGE_KEY
      ),
      { timeout: PUBLISH_TIMEOUT_MS }
    )
    .toEqual([]);

  expect(api.sessionRequests).toEqual([
    {
      game: "sudoku",
      config: { difficulty: "easy" },
      buildVersion: generatedBuildVersion,
    },
    {
      game: "sudoku",
      config: { difficulty: "easy" },
      buildVersion: generatedBuildVersion,
    },
  ]);
  expect(api.eventRequests[1]).toEqual({
    event: {
      id: expect.stringMatching(/^local-[a-f0-9-]{36}$/),
      game: "sudoku",
      type: "win",
      occurredAt: expect.any(String),
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 150,
      metricKind: "seconds",
      profile: {
        id: profile.id,
        name: profile.name,
        icon: profile.icon,
      },
    },
    session: api.sessionProofs[1],
  });
  expect(api.eventRequests[1].event.id).not.toBe(api.eventRequests[0].event.id);
  expect(api.requestSequence.filter((request) => request === "session" || request === "event"))
    .toEqual(["session", "event", "session", "event"]);

  stored = await readStoredStats(page);
  expect(stored.queue).toEqual([]);
  expect(stored.stats.eventIds).toHaveLength(2);
  expect(stored.stats.totals.sudoku.wins.easy).toEqual({
    noHints: 2,
    withHints: 0,
  });
  expect(stored.stats.totals.sudoku.bestTimes.easy).toBe(120);
  expect(stored.stats.leaderboards.sudoku.easy).toHaveLength(1);
  expect(stored.stats.leaderboards.sudoku.easy[0].metric).toBe(120);
  expect(stored.stats.playerRecords.sudoku.easy.metric).toBe(120);

  if (!(await statsWindow.isVisible())) {
    await sudokuWindow.locator('[data-game-stats-open="sudoku"]').click();
  }
  await expect(statsWindow.locator("[data-game-stats-sync-status]")).toHaveText(
    "Global stats are up to date."
  );
  const easyPanel = statsWindow.locator('[aria-labelledby="game-stats-sudoku-easy"]');
  await expect(
    easyPanel.locator(
      '[aria-label="Total verified Sudoku completions on Easy: 5"]'
    )
  ).toBeVisible();
  await expect(easyPanel.locator(".game-stats-sudoku-local-best-row")).toHaveAttribute(
    "aria-label",
    "Your no-hints record: #2, Sudoku Publisher, 120 seconds"
  );
  await expectStatsWindowContained(page, statsWindow);
  expectNoUnexpectedRuntimeErrors(runtimeErrors);
});
