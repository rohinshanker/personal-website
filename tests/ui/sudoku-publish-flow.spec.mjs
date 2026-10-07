import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./deterministic.mjs";
import { REVIEW_VIEWPORTS, settleFrames } from "./helpers/rendered-site.mjs";
import { readFile } from "node:fs/promises";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import { createIssuedGameResponder } from "./helpers/verified-game-session.mjs";

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
/**
 * The puzzle identity every Sudoku win carries, so the Worker can refuse a
 * second win for one puzzle. The id is minted per adopted puzzle and the
 * board is the 81-character puzzle string it was solved from.
 */
const SUDOKU_PUZZLE_ID_PATTERN = expect.stringMatching(
  /^(?:generated-(?:easy|medium|hard|expert|master|extreme)-[a-z0-9]+-[a-z0-9]{1,6}|session-sudoku-verified-[0-9]+)$/
);
const SUDOKU_PUZZLE_PATTERN = expect.stringMatching(/^[0-9]{81}$/);

const PUBLISH_TIMEOUT_MS = 30_000;

const profile = Object.freeze({
  id: "player-sudoku-publish",
  name: "Sudoku Publisher",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

const viewports = REVIEW_VIEWPORTS;

const isPlayerStatsPath = (path, playerId) => {
  const url = new URL(path, API_BASE_URL);
  return (
    url.pathname === "/stats" &&
    url.searchParams.get("protocol") === "2" &&
    url.searchParams.get("playerId") === playerId
  );
};

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
const generatedResultProtocol = Number(
  generatedBackendSource.match(/resultProtocol:\s*(\d+)/)?.[1]
);
if (!generatedResultProtocol) {
  throw new Error("Unable to read the generated result protocol.");
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

const installSudokuBridge = async (page) => {
  await routeHomeScript(page, "sudoku", (source) =>
    source.replace(
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
  readBoard: () => ({
    hintMode: sudokuState.hintMode,
    noteMode: sudokuState.noteMode,
    puzzle: sudokuState.puzzle,
    puzzleId: sudokuState.puzzleId,
    values: sudokuState.values.map((value) => value || "0").join(""),
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

    // Through the real edit path, so the board is one the rules produced. The
    // last cell is emptied rather than skipped: a restored puzzle arrives
    // already complete, and the completion this leaves for the test to drive has
    // to be a real one.
    editableIndexes.forEach((index) => {
      sudokuState.selectedIndex = index;
      if (index === finalIndex) {
        updateSudokuCellValue(cells[index], index, "", { clearEmptyNotes: true });
        return;
      }
      updateSudokuCellValue(cells[index], index, sudokuState.solution[index]);
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
    )
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

const createStatsPayload = (publishedEvents, acknowledgedEventIds = []) => {
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
    version: 2,
    generatedAt: new Date().toISOString(),
    acknowledgedEventIds,
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
  const sessionProofs = [];
  // Completing a puzzle asks the server to verify its replay, so the
  // verified-session half of the protocol is answered accurately and the metric
  // it returns is the one this scenario expects to see published.
  const verified = createIssuedGameResponder({
    games: ["sudoku"],
    elapsedMs: scenario.elapsedSeconds * 1000,
    receipts: {
      sudoku: {
        type: "win",
        difficulty: "easy",
        hintBucket: scenario.hintBucket,
        metricKind: "seconds",
        metric: scenario.elapsedSeconds,
      },
    },
  });
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
      requestSequence.push("session");
    }
    if (await verified.handle(route)) return;

    if (request.method() === "POST" && url.pathname === "/sessions") {
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
      const pendingEventIds = new Set(url.searchParams.getAll("pendingEventId"));
      await route.fulfill({
        status: 200,
        body: JSON.stringify(
          createStatsPayload(
            publishedEvents,
            publishedEvents.map(({ id }) => id).filter((id) => pendingEventIds.has(id))
          )
        ),
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
    sessionRequests: verified.issued,
    statsRequests,
    verified,
  };
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

/**
 * Brings up the desktop against the mocked backend, stopping just short of
 * opening Sudoku. `afterRoutes` runs once the API mock is registered, so a test
 * can add a route that answers ahead of it and hold a request open.
 */
const bootHome = async (page, viewport, scenario, { afterRoutes } = {}) => {
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
  await installSudokuBridge(page);
  const api = await installApi(page, scenario);
  if (afterRoutes) await afterRoutes(api);

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
    resultProtocol: generatedResultProtocol,
  });
  return api;
};

const preparePage = async (page, viewport, scenario) => {
  const api = await bootHome(page, viewport, scenario);

  await page.locator('.desktop-icon[data-app="sudoku"]').click();
  const sudokuWindow = page.locator('[data-app-window="sudoku"]');
  await expect(sudokuWindow).toBeVisible();
  const playButton = sudokuWindow.locator("#sudoku-play");
  await expect(playButton).toBeEnabled({ timeout: PUBLISH_TIMEOUT_MS });
  // The board is asked for when it is adopted, which is before Play: a verified
  // result has to bind the puzzle the server chose, so it cannot wait for the
  // first entry. Nothing is published yet.
  await expect
    .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
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

  return { api, statsWindow, sudokuWindow, terminal };
};

const expectPublishedRequestContract = (api, scenario) => {
  expect(generatedBuildVersion).toMatch(/^sha256-[a-f0-9]{64}$/);
  expect(api.sessionRequests).toEqual([
    {
      game: "sudoku",
      config: { difficulty: "easy" },
      buildVersion: generatedBuildVersion,
      resultProtocol: 2,
      rulesVersion: 1,
      replayVersion: 1,
      generatorVersion: 1,
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
      puzzleId: SUDOKU_PUZZLE_ID_PATTERN,
      puzzle: SUDOKU_PUZZLE_PATTERN,
      metric: scenario.elapsedSeconds,
      metricKind: "seconds",
      profile: {
        id: profile.id,
        name: profile.name,
        icon: profile.icon,
      },
    },
    // A verified result is published against the completion receipt the server
    // returned for its replay, not against a session proof alone.
    completion: {
      id: `completion-${api.verified.finishes[0].id}`,
      token: "synthetic-completion-proof",
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
  expect(api.statsRequests.every(({ path }) => isPlayerStatsPath(path, profile.id))).toBe(true);
  expect(
    api.statsRequests.some(({ path }) => {
      const url = new URL(path, API_BASE_URL);
      return (
        url.searchParams.get("fresh") === "1" &&
        url.searchParams.getAll("pendingEventId").includes(api.eventRequests[0].event.id)
      );
    })
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
      const { api, statsWindow } = await preparePage(
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

    });
  }
}

/**
 * Plays an issued puzzle to one cell short, then pauses until the server has
 * acknowledged the pause and the proof is in the save — the only state a reload
 * can be restored into. Leaves the page ready to reload.
 */
const prepareRestorableSudokuPause = async (page, scenario, viewport = viewports[2]) => {
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
  await installSudokuBridge(page);
  const api = await installApi(page, scenario);

  const openSudokuAndPlay = async () => {
    const aboutClose = page.locator('#about-window [data-close="about"]');
    if (await aboutClose.isVisible()) await aboutClose.click();
    await page.locator('.desktop-icon[data-app="sudoku"]').click();
    const sudokuWindow = page.locator('[data-app-window="sudoku"]');
    await expect(sudokuWindow).toBeVisible();
    const playButton = sudokuWindow.locator("#sudoku-play");
    await expect(playButton).toBeEnabled({ timeout: PUBLISH_TIMEOUT_MS });
    await playButton.click();
    await expect(sudokuWindow.locator(".sudoku-app")).toHaveClass(/is-sudoku-playing/, {
      timeout: PUBLISH_TIMEOUT_MS,
    });
    return sudokuWindow;
  };

  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await expect
    .poll(() => api.statsRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBeGreaterThanOrEqual(1);
  let sudokuWindow = await openSudokuAndPlay();
  await expect
    .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);

  // Play most of the puzzle, then let the progress persist before leaving.
  const terminal = await prepareTerminalBoard(page, 100);
  await sudokuWindow
    .locator(`.sudoku-cell[data-sudoku-index="${terminal.finalIndex}"]`)
    .click();
  await expect
    .poll(
      () =>
        page.evaluate((sudokuKey) => {
          const saved = JSON.parse(localStorage.getItem(sudokuKey) || "null");
          return saved
            ? {
                completionRecorded: saved.completionRecorded,
                elapsedSeconds: saved.elapsedSeconds,
                filledCells: saved.values.replace(/[^1-9]/g, "").length,
                solved: saved.solved,
              }
            : null;
        }, SUDOKU_STORAGE_KEY),
      { timeout: PUBLISH_TIMEOUT_MS }
    )
    .toEqual({
      completionRecorded: false,
      elapsedSeconds: 100,
      filledCells: 80,
      solved: false,
    });
  expect(api.eventRequests).toEqual([]);

  // Ranked time excludes the pause, so the server has to have acknowledged one
  // before a reload can be restored into it. A running autosave is still
  // perfectly playable afterwards; it simply carries no verified session.
  await sudokuWindow.locator("#sudoku-pause").click();
  await expect(sudokuWindow.locator("#sudoku-resume")).toBeVisible();
  await expect
    .poll(() => api.verified.timing.filter(({ operation }) => operation === "pause").length, {
      timeout: PUBLISH_TIMEOUT_MS,
    })
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        (sudokuKey) =>
          Boolean(JSON.parse(localStorage.getItem(sudokuKey) || "null")?.verified),
        SUDOKU_STORAGE_KEY
      ),
      { timeout: PUBLISH_TIMEOUT_MS }
    )
    .toBe(true);

  // The identity the restore has to come back with: a restored puzzle is the
  // same puzzle, not a new one that resembles it.
  const { puzzleId } = await page.evaluate(
    (sudokuKey) => JSON.parse(localStorage.getItem(sudokuKey)),
    SUDOKU_STORAGE_KEY
  );
  expect(puzzleId).toEqual(SUDOKU_PUZZLE_ID_PATTERN);
  return { api, openSudokuAndPlay, puzzleId, sudokuWindow, terminal };
};

test("a restored unsolved Sudoku puzzle publishes through its restored verified session", async ({
  page,
}) => {
  const scenario = scenarios[0];
  const { api, openSudokuAndPlay, terminal } = await prepareRestorableSudokuPause(
    page,
    scenario
  );

  const statsRequestCountBeforeReload = api.statsRequests.length;
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() => api.statsRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBeGreaterThan(statsRequestCountBeforeReload);
  const sudokuWindow = await openSudokuAndPlay();

  // The puzzle resumes on the board the server issued, with the replay it
  // acknowledged: a restoration, not a second issuance.
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
  await expect
    .poll(() => api.verified.restores.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  expect(api.sessionRequests).toHaveLength(1);
  await expect(
    sudokuWindow.locator(`.sudoku-cell[data-sudoku-index="${terminal.finalIndex}"]`)
  ).toHaveAttribute("data-sudoku-value", "");

  await finishTerminalBoard(sudokuWindow, terminal);
  await expect
    .poll(() => api.eventRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  expect(api.eventRequests[0]).toEqual({
    event: {
      id: expect.stringMatching(/^local-[a-f0-9-]{36}$/),
      game: "sudoku",
      type: "win",
      occurredAt: expect.any(String),
      difficulty: "easy",
      hintBucket: "noHints",
      puzzleId: SUDOKU_PUZZLE_ID_PATTERN,
      puzzle: SUDOKU_PUZZLE_PATTERN,
      metric: expect.any(Number),
      metricKind: "seconds",
      profile: {
        id: profile.id,
        name: profile.name,
        icon: profile.icon,
      },
    },
    completion: {
      id: `completion-${api.verified.finishes[0].id}`,
      token: "synthetic-completion-proof",
    },
  });
  // The restored elapsed time carries through into the published result.
  expect(api.eventRequests[0].event.metric).toBeGreaterThanOrEqual(100);
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
  const stored = await readStoredStats(page);
  expect(stored.stats.eventIds).toHaveLength(1);
  expect(stored.stats.totals.sudoku.wins.easy).toEqual({ noHints: 1, withHints: 0 });
});

test("one restored puzzle open in two tabs publishes once", async ({ context }) => {
  const scenario = scenarios[0];
  const initializationKey = "sudokuPublishFlowTabsInitializedV1";
  await context.addInitScript(
    ({ initializationKey: marker, profileKey, queueKey, savedProfile, statsKey, sudokuKey }) => {
      Math.random = () => 0.999999;
      // A context init script also runs on the opaque about:blank each new
      // tab starts at, where reading storage throws. Only the served
      // document has anything to seed.
      if (location.origin === "null") return;
      if (localStorage.getItem(marker) === "1") return;
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(marker, "1");
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
      localStorage.removeItem(queueKey);
      localStorage.removeItem(statsKey);
      localStorage.removeItem(sudokuKey);
    },
    {
      initializationKey,
      profileKey: PROFILE_STORAGE_KEY,
      queueKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      savedProfile: profile,
      statsKey: GAME_STATS_STORAGE_KEY,
      sudokuKey: SUDOKU_STORAGE_KEY,
    }
  );
  // Routes registered on the context serve both tabs and share one API log.
  await installBackendConfig(context);
  await installSudokuBridge(context);
  const api = await installApi(context, scenario);

  const openTab = async () => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/home.html", { waitUntil: "domcontentloaded" });
    const aboutClose = page.locator('#about-window [data-close="about"]');
    if (await aboutClose.isVisible()) await aboutClose.click();
    await page.locator('.desktop-icon[data-app="sudoku"]').click();
    const sudokuWindow = page.locator('[data-app-window="sudoku"]');
    await expect(sudokuWindow).toBeVisible();
    const playButton = sudokuWindow.locator("#sudoku-play");
    await expect(playButton).toBeEnabled({ timeout: PUBLISH_TIMEOUT_MS });
    await playButton.click();
    await expect(sudokuWindow.locator(".sudoku-app")).toHaveClass(/is-sudoku-playing/, {
      timeout: PUBLISH_TIMEOUT_MS,
    });
    return { page, sudokuWindow };
  };

  const first = await openTab();
  await expect
    .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  const terminal = await prepareTerminalBoard(first.page, 100);
  await first.sudokuWindow
    .locator(`.sudoku-cell[data-sudoku-index="${terminal.finalIndex}"]`)
    .click();
  await expect
    .poll(
      () =>
        first.page.evaluate(
          (sudokuKey) =>
            JSON.parse(localStorage.getItem(sudokuKey) || "null")?.values.replace(
              /[^1-9]/g,
              ""
            ).length,
          SUDOKU_STORAGE_KEY
        ),
      { timeout: PUBLISH_TIMEOUT_MS }
    )
    .toBe(80);

  // The save a second tab can restore from is one the server acknowledged a
  // pause for, so the first tab pauses before handing the puzzle over.
  await first.sudokuWindow.locator("#sudoku-pause").click();
  await expect(first.sudokuWindow.locator("#sudoku-resume")).toBeVisible();
  await expect
    .poll(() => api.verified.timing.filter(({ operation }) => operation === "pause").length, {
      timeout: PUBLISH_TIMEOUT_MS,
    })
    .toBe(1);

  // The second tab restores the same unfinished puzzle rather than being issued
  // another: one board, one proof, however many tabs are looking at it.
  const second = await openTab();
  await expect
    .poll(() => api.verified.restores.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  expect(api.sessionRequests).toHaveLength(1);
  await expect(
    second.sudokuWindow.locator(`.sudoku-cell[data-sudoku-index="${terminal.finalIndex}"]`)
  ).toHaveAttribute("data-sudoku-value", "");
  expect(
    await second.page.evaluate(() => window.__sudokuPublishFlowTest.readLifecycle())
  ).toMatchObject({ hasStatsSession: true, statsSessionEligible: true });

  // The first tab was paused to hand the save over; it resumes to finish.
  await first.sudokuWindow.locator("#sudoku-resume").click();
  await expect(first.sudokuWindow.locator("#sudoku-resume")).toBeHidden();

  await finishTerminalBoard(first.sudokuWindow, terminal);
  await expect
    .poll(() => api.eventRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  // The latch reached storage before the handoff, so the other tab already knows.
  await expect
    .poll(
      () =>
        second.page.evaluate(
          (sudokuKey) => JSON.parse(localStorage.getItem(sudokuKey) || "null")?.completionRecorded,
          SUDOKU_STORAGE_KEY
        ),
      { timeout: PUBLISH_TIMEOUT_MS }
    )
    .toBe(true);

  await finishTerminalBoard(second.sudokuWindow, terminal);
  await expect
    .poll(
      () =>
        second.page.evaluate(
          (sudokuKey) => {
            const saved = JSON.parse(localStorage.getItem(sudokuKey) || "null");
            return saved ? { completionRecorded: saved.completionRecorded, solved: saved.solved } : null;
          },
          SUDOKU_STORAGE_KEY
        ),
      { timeout: PUBLISH_TIMEOUT_MS }
    )
    .toEqual({ completionRecorded: true, solved: true });
  // The second tab has finished reacting, so a second publish would already
  // have been recorded if the latch had failed.
  await settleFrames(second.page);
  expect(api.eventRequests).toHaveLength(1);
  // One board was issued and restored once; both tabs were looking at the same
  // proof, so neither could publish a second result for it.
  expect(api.sessionRequests).toHaveLength(1);
  expect(api.verified.restores).toHaveLength(1);
  const stored = await readStoredStats(second.page);
  expect(stored.stats.totals.sudoku.wins.easy).toEqual({ noHints: 1, withHints: 0 });
});

test("a solved Sudoku puzzle records once after undo, reload, and New Game", async ({
  page,
}) => {
  const scenario = scenarios[0];
  const { api, statsWindow, sudokuWindow, terminal } = await preparePage(
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
  // The restored puzzle was already recorded, so the only proof available is
  // that the settled page added nothing.
  await expect
    .poll(() => readStoredStats(page).then(({ queue }) => queue), {
      timeout: PUBLISH_TIMEOUT_MS,
    })
    .toEqual([]);
  await settleFrames(page);
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
  // The second board runs a different clock, and the server is what reports it.
  api.verified.setMetric("sudoku", 150);
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

  // Two boards, each issued with the protocol and version fields the Worker
  // binds its replay to.
  expect(api.sessionRequests).toEqual([
    {
      game: "sudoku",
      config: { difficulty: "easy" },
      buildVersion: generatedBuildVersion,
      resultProtocol: 2,
      rulesVersion: 1,
      replayVersion: 1,
      generatorVersion: 1,
    },
    {
      game: "sudoku",
      config: { difficulty: "easy" },
      buildVersion: generatedBuildVersion,
      resultProtocol: 2,
      rulesVersion: 1,
      replayVersion: 1,
      generatorVersion: 1,
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
      puzzleId: SUDOKU_PUZZLE_ID_PATTERN,
      puzzle: SUDOKU_PUZZLE_PATTERN,
      metric: 150,
      metricKind: "seconds",
      profile: {
        id: profile.id,
        name: profile.name,
        icon: profile.icon,
      },
    },
    completion: {
      id: `completion-${api.verified.finishes[1].id}`,
      token: "synthetic-completion-proof",
    },
  });
  expect(api.eventRequests[1].event.id).not.toBe(api.eventRequests[0].event.id);
  // The identity the Worker deduplicates on follows the board, so a New Game
  // publishes a different puzzle rather than a second win for the first one.
  expect(api.eventRequests[1].event.puzzleId).not.toBe(
    api.eventRequests[0].event.puzzleId
  );
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
});

/**
 * Opens Sudoku and starts play while issuance is still outstanding, so the
 * controls a player can reach before the server answers are reachable here too.
 */
const startHeldSudokuGame = async (page, held) => {
  await page.locator('.desktop-icon[data-app="sudoku"]').click();
  const sudokuWindow = page.locator('[data-app-window="sudoku"]');
  await expect(sudokuWindow).toBeVisible();
  const playButton = sudokuWindow.locator("#sudoku-play");
  await expect(playButton).toBeEnabled({ timeout: PUBLISH_TIMEOUT_MS });
  // The board is asked for as soon as it is adopted, so the request is already
  // waiting on the gate before anything is played.
  await expect.poll(() => held.requests, { timeout: PUBLISH_TIMEOUT_MS }).toBe(1);
  await playButton.click();
  await expect(sudokuWindow.locator(".sudoku-app")).toHaveClass(/is-sudoku-playing/, {
    timeout: PUBLISH_TIMEOUT_MS,
  });
  return sudokuWindow;
};

const acceptSudokuErrorsWarning = async (sudokuWindow) => {
  const errorsHint = sudokuWindow.locator('[data-sudoku-hint="errors"]');
  await errorsHint.click();
  const errorsPrompt = sudokuWindow.locator("#sudoku-errors-prompt");
  await expect(errorsPrompt).toBeVisible();
  await errorsPrompt.locator("#sudoku-errors-confirm").click();
  await expect(errorsPrompt).toBeHidden();
  await expect(errorsHint).toHaveAttribute("aria-pressed", "true");
};

/**
 * Holds issuance open behind a gate the test releases, answering ahead of the
 * API mock and handing the request on once the board underneath has been played.
 */
const holdSudokuIssuance = (page) => {
  const held = { requests: 0, release: () => {} };
  const gate = new Promise((resolve) => {
    held.release = resolve;
  });
  held.install = async () => {
    await page.route(`${API_BASE_URL}/sessions`, async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      held.requests += 1;
      await gate;
      await route.fallback();
    });
  };
  return held;
};

/**
 * The changes a player can make while issuance is outstanding that the board
 * itself cannot show afterwards. Each one is recorded as an input against the
 * local board, so none of them may be carried over to the board the server
 * issued — and `moves` and the undo stack are back to empty for every one of
 * them by the time the descriptor lands.
 */
const heldSudokuInteractions = Object.freeze([
  Object.freeze({
    label: "the Errors warning is accepted",
    solves: true,
    run: (page, sudokuWindow) => acceptSudokuErrorsWarning(sudokuWindow),
    expectKept: async (sudokuWindow) => {
      await expect(sudokuWindow.locator('[data-sudoku-hint="errors"]')).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      await expect(sudokuWindow.locator('[data-sudoku-hint="off"]')).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    },
  }),
  Object.freeze({
    label: "Conflicts is switched on",
    solves: false,
    run: async (page, sudokuWindow) => {
      await sudokuWindow.locator('[data-sudoku-hint="conflicts"]').click();
      await expect(
        sudokuWindow.locator('[data-sudoku-hint="conflicts"]')
      ).toHaveAttribute("aria-pressed", "true");
    },
    expectKept: (sudokuWindow) =>
      expect(sudokuWindow.locator('[data-sudoku-hint="conflicts"]')).toHaveAttribute(
        "aria-pressed",
        "true"
      ),
  }),
  Object.freeze({
    label: "Notes is switched on",
    solves: false,
    run: async (page, sudokuWindow) => {
      await sudokuWindow.locator("#sudoku-note-toggle").click();
      await expect(sudokuWindow.locator("#sudoku-note-toggle")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    },
    expectKept: (sudokuWindow) =>
      expect(sudokuWindow.locator("#sudoku-note-toggle")).toHaveAttribute(
        "aria-pressed",
        "true"
      ),
  }),
  Object.freeze({
    label: "an entry is made and undone",
    solves: false,
    run: async (page, sudokuWindow) => {
      const entry = await page.evaluate(() =>
        window.__sudokuPublishFlowTest.readIncorrectEntry()
      );
      const cell = sudokuWindow.locator(
        `.sudoku-cell[data-sudoku-index="${entry.index}"]`
      );
      await cell.click();
      await sudokuWindow.locator(`[data-sudoku-number="${entry.solutionDigit}"]`).click();
      await expect(cell).toHaveAttribute("data-sudoku-value", entry.solutionDigit);
      await sudokuWindow.locator("#sudoku-undo").click();
      // Back to the board it started from, which is exactly why the board cannot
      // be asked whether anything happened.
      await expect(cell).toHaveAttribute("data-sudoku-value", "");
    },
    expectKept: (sudokuWindow) =>
      expect(sudokuWindow.locator("#sudoku-undo")).toBeVisible(),
  }),
]);

heldSudokuInteractions.forEach((interaction) => {
  test(`late Sudoku issuance keeps the played board when ${interaction.label}`, async ({
    page,
  }) => {
    const scenario = scenarios[0];
    const held = holdSudokuIssuance(page);
    const api = await bootHome(page, viewports[2], scenario, {
      afterRoutes: held.install,
    });

    const sudokuWindow = await startHeldSudokuGame(page, held);
    await interaction.run(page, sudokuWindow);
    const playedBoard = await page.evaluate(() =>
      window.__sudokuPublishFlowTest.readBoard()
    );

    held.release();
    await expect
      .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
      .toBe(1);
    await expect
      .poll(() => page.evaluate(() => window.__sudokuPublishFlowTest.readLifecycle()), {
        timeout: PUBLISH_TIMEOUT_MS,
      })
      .toEqual({
        difficulty: "easy",
        // The proof the server issued never applied to this board, so it is let
        // go rather than attached to a puzzle it does not describe.
        hasStatsSession: false,
        playing: true,
        statsSessionEligible: true,
        timerRunning: true,
      });

    const issued = api.verified.boardFor("sudoku");
    expect(issued.initial.puzzle).not.toBe(playedBoard.puzzle);
    // The board the player is on is the board that stays, down to the cell they
    // were on; the issued puzzle is not swapped in underneath them.
    expect(await page.evaluate(() => window.__sudokuPublishFlowTest.readBoard())).toEqual(
      playedBoard
    );
    await interaction.expectKept(sudokuWindow);
    await settleFrames(page);

    if (!interaction.solves) return;
    // Nothing is replayed to the server for an attempt whose proof was let go,
    // so there is no second warning to reject and no publish to verify.
    const terminal = await prepareTerminalBoard(page, scenario.elapsedSeconds);
    await finishTerminalBoard(sudokuWindow, terminal);
    await expect
      .poll(() => page.evaluate(() => window.__sudokuPublishFlowTest.readBoard()), {
        timeout: PUBLISH_TIMEOUT_MS,
      })
      .toEqual({ ...playedBoard, values: expect.stringMatching(/^[1-9]{81}$/) });
    expect(api.verified.finishes).toEqual([]);
    expect(api.verified.replayFor("sudoku")).toEqual([]);
    expect(api.sessionRequests).toHaveLength(1);
  });
});

test("late Sudoku issuance on a pristine board is adopted and publishes", async ({
  page,
}) => {
  const scenario = scenarios[0];
  const held = holdSudokuIssuance(page);
  const api = await bootHome(page, viewports[2], scenario, {
    afterRoutes: held.install,
  });

  const sudokuWindow = await startHeldSudokuGame(page, held);
  held.release();
  await expect
    .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);

  // Nothing was played while the server was answering, so this really is the
  // board it issued and the proof belongs to it.
  const issued = api.verified.boardFor("sudoku");
  await expect
    .poll(() => page.evaluate(() => window.__sudokuPublishFlowTest.readBoard()), {
      timeout: PUBLISH_TIMEOUT_MS,
    })
    .toEqual({
      hintMode: "off",
      noteMode: false,
      puzzle: issued.initial.puzzle,
      puzzleId: issued.id,
      values: issued.initial.puzzle,
    });
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

  const terminal = await prepareTerminalBoard(page, scenario.elapsedSeconds);
  await finishTerminalBoard(sudokuWindow, terminal);
  await expect
    .poll(() => api.verified.finishes.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  await expect
    .poll(() => api.eventRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  // Publishing is not finished when /events returns: the contract below covers
  // the refreshed read that follows it, so wait for that read and for the queue
  // it drains rather than asserting into a half-settled sequence.
  await expect
    .poll(() => api.statsRequests.some(({ refreshed }) => refreshed), {
      timeout: PUBLISH_TIMEOUT_MS,
    })
    .toBe(true);
  await expect
    .poll(
      () =>
        page.evaluate(
          (queueKey) => JSON.parse(localStorage.getItem(queueKey) || "[]"),
          GAME_STATS_SYNC_QUEUE_STORAGE_KEY
        ),
      { timeout: PUBLISH_TIMEOUT_MS }
    )
    .toEqual([]);
  expectPublishedRequestContract(api, scenario);

  // The replay the server verified has to be the one game it was issued for,
  // with no repeated warning in it: a second confirmation would be a move the
  // rules reject, and the result would never verify.
  const replay = api.verified.replayFor("sudoku");
  expect(replay.filter(({ op }) => op === "confirmErrors")).toEqual([]);
  const verified = await page.evaluate(
    ({ initial, inputs }) => {
      const state = window.homeSudokuRules.initial(initial);
      try {
        for (const input of inputs) {
          window.homeSudokuRules.transition(
            state,
            input,
            window.homeGameRules.createBudget(2_000_000)
          );
        }
        return { result: window.homeSudokuRules.result(state) };
      } catch (error) {
        return { code: error.code, message: error.message };
      }
    },
    { initial: issued.initial, inputs: replay }
  );
  // The published bucket is the verifier's own assistance verdict on the replay,
  // not a claim the page made about itself.
  expect(verified).toEqual({
    result: expect.objectContaining({
      assistance: scenario.hintBucket,
      assistanceCount: 0,
      lost: false,
      terminal: true,
      won: true,
    }),
  });
  await settleFrames(page);
});

viewports.forEach((viewport) => {
  test(`a board kept through late Sudoku issuance renders at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const scenario = scenarios[0];
    const held = holdSudokuIssuance(page);
    const api = await bootHome(page, viewport, scenario, { afterRoutes: held.install });

    const sudokuWindow = await startHeldSudokuGame(page, held);
    await acceptSudokuErrorsWarning(sudokuWindow);
    held.release();
    await expect
      .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
      .toBe(1);
    await expect
      .poll(() => page.evaluate(() => window.__sudokuPublishFlowTest.readLifecycle()), {
        timeout: PUBLISH_TIMEOUT_MS,
      })
      .toEqual({
        difficulty: "easy",
        hasStatsSession: false,
        playing: true,
        statsSessionEligible: true,
        timerRunning: true,
      });
    await settleFrames(page);

    // The warning the player accepted is still the one showing, on the board they
    // accepted it on, and the puzzle is playable rather than half-replaced.
    await expect(sudokuWindow.locator('[data-sudoku-hint="errors"]')).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(sudokuWindow.locator(".sudoku-app")).toHaveClass(/is-sudoku-playing/);
    await expect(sudokuWindow.locator("#sudoku-errors-prompt")).toBeHidden();
    const accessibility = await new AxeBuilder({ page })
      .include('[data-app-window="sudoku"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`sudoku-late-issuance-${viewport.name}.png`),
      fullPage: true,
    });
  });
});

test("a carried note mode survives late issuance as a recorded action", async ({
  page,
}) => {
  const scenario = scenarios[0];
  const api = await bootHome(page, viewports[2], scenario);

  await page.locator('.desktop-icon[data-app="sudoku"]').click();
  const sudokuWindow = page.locator('[data-app-window="sudoku"]');
  await expect(sudokuWindow).toBeVisible();
  const playButton = sudokuWindow.locator("#sudoku-play");
  await expect(playButton).toBeEnabled({ timeout: PUBLISH_TIMEOUT_MS });
  await playButton.click();
  await expect(sudokuWindow.locator(".sudoku-app")).toHaveClass(/is-sudoku-playing/, {
    timeout: PUBLISH_TIMEOUT_MS,
  });
  await expect
    .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);

  const noteToggle = sudokuWindow.locator("#sudoku-note-toggle");
  await noteToggle.click();
  await expect(noteToggle).toHaveAttribute("aria-pressed", "true");

  // New Game carries the preference onto the puzzle it generates, so the board
  // the server then issues has to arrive at the same place.
  const held = holdSudokuIssuance(page);
  await held.install();
  await sudokuWindow.locator("#sudoku-new").click();
  await expect.poll(() => held.requests, { timeout: PUBLISH_TIMEOUT_MS }).toBe(1);
  await expect(noteToggle).toHaveAttribute("aria-pressed", "true");

  held.release();
  await expect
    .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(2);
  const issued = api.verified.boardFor("sudoku");
  await expect
    .poll(() => page.evaluate(() => window.__sudokuPublishFlowTest.readBoard()), {
      timeout: PUBLISH_TIMEOUT_MS,
    })
    .toEqual({
      hintMode: "off",
      noteMode: true,
      puzzle: issued.initial.puzzle,
      puzzleId: issued.id,
      values: issued.initial.puzzle,
    });
  await expect(noteToggle).toHaveAttribute("aria-pressed", "true");

  // Entries go in as values again, through the same control a player uses.
  await noteToggle.click();
  await expect(noteToggle).toHaveAttribute("aria-pressed", "false");
  const terminal = await prepareTerminalBoard(page, scenario.elapsedSeconds);
  await finishTerminalBoard(sudokuWindow, terminal);
  await expect
    .poll(() => api.verified.finishes.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);

  // The preference is carried as an action on the issued board, so the verifier
  // derives the same state the player sees rather than being handed it.
  const replay = api.verified.replayFor("sudoku");
  // Carrying it is the first thing the issued session records, ahead of any
  // entry, which is what makes the rest of the replay land in the right mode.
  expect(replay.filter(({ op }) => op === "setNoteMode")).toEqual([
    { op: "setNoteMode", enabled: true, seq: 1 },
    { op: "setNoteMode", enabled: false, seq: expect.any(Number) },
  ]);
  const verified = await page.evaluate(
    ({ initial, inputs }) => {
      const state = window.homeSudokuRules.initial(initial);
      try {
        for (const input of inputs) {
          window.homeSudokuRules.transition(
            state,
            input,
            window.homeGameRules.createBudget(2_000_000)
          );
        }
        return { result: window.homeSudokuRules.result(state) };
      } catch (error) {
        return { code: error.code, message: error.message };
      }
    },
    { initial: issued.initial, inputs: replay }
  );
  expect(verified).toEqual({
    result: expect.objectContaining({ terminal: true, won: true }),
  });
});

/**
 * Holds the restore reply for the one issued session, answering ahead of the API
 * mock so the test can play on the restored board while the server is still
 * deciding whether it will restore it.
 */
const holdSudokuRestore = (page) => {
  const held = { requests: 0, release: () => {} };
  const gate = new Promise((resolve) => {
    held.release = resolve;
  });
  held.install = async () => {
    await page.route(`${API_BASE_URL}/sessions/*/restore`, async (route) => {
      held.requests += 1;
      await gate;
      await route.fallback();
    });
  };
  return held;
};

/** Everything a player can see of the board, for a before-and-after comparison. */
const readSudokuSurface = (sudokuWindow) =>
  sudokuWindow.evaluate((element) => ({
    errors: element
      .querySelector('[data-sudoku-hint="errors"]')
      .getAttribute("aria-pressed"),
    mistakes: element.querySelector("#sudoku-mistakes").textContent,
    notes: element.querySelector("#sudoku-note-toggle").getAttribute("aria-pressed"),
    selected: [...element.querySelectorAll(".sudoku-cell")].findIndex((cell) =>
      cell.classList.contains("is-selected")
    ),
    values: [...element.querySelectorAll(".sudoku-cell")]
      .map((cell) => cell.dataset.sudokuValue || "0")
      .join(""),
  }));

const readSudokuSave = (page) =>
  page.evaluate((sudokuKey) => {
    const saved = JSON.parse(localStorage.getItem(sudokuKey) || "null");
    return saved
      ? {
          errorsConfirmed: saved.errorsConfirmed,
          hintMode: saved.hintMode,
          noteMode: saved.noteMode,
          puzzleId: saved.puzzleId,
          values: saved.values,
          verified: saved.verified,
        }
      : null;
  }, SUDOKU_STORAGE_KEY);

/**
 * Changes made while the restore reply is outstanding. None of them moves the
 * board object or the puzzle id, and the last one leaves the cells and the modes
 * exactly as they were — so only the count of applied changes can tell that the
 * old replay no longer describes this board.
 */
const heldRestoreInteractions = Object.freeze([
  Object.freeze({
    label: "Notes is switched on",
    savedModes: { errorsConfirmed: false, hintMode: "off", noteMode: true },
    run: async (page, sudokuWindow) => {
      await sudokuWindow.locator("#sudoku-note-toggle").click();
      await expect(sudokuWindow.locator("#sudoku-note-toggle")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    },
  }),
  Object.freeze({
    label: "the Errors warning is accepted",
    savedModes: { errorsConfirmed: true, hintMode: "errors", noteMode: false },
    run: (page, sudokuWindow) => acceptSudokuErrorsWarning(sudokuWindow),
  }),
  Object.freeze({
    label: "Notes is switched on and back off",
    savedModes: { errorsConfirmed: false, hintMode: "off", noteMode: false },
    run: async (page, sudokuWindow) => {
      const noteToggle = sudokuWindow.locator("#sudoku-note-toggle");
      await noteToggle.click();
      await expect(noteToggle).toHaveAttribute("aria-pressed", "true");
      await noteToggle.click();
      // Nothing on the board changed in the end, and two actions were still
      // recorded against it that the restored replay does not contain.
      await expect(noteToggle).toHaveAttribute("aria-pressed", "false");
    },
  }),
]);

heldRestoreInteractions.forEach((interaction) => {
  test(`a held restore keeps the played board when ${interaction.label}`, async ({
    page,
  }) => {
    const scenario = scenarios[0];
    const { api, openSudokuAndPlay, puzzleId } = await prepareRestorableSudokuPause(
      page,
      scenario
    );

    const held = holdSudokuRestore(page);
    await held.install();
    await page.reload({ waitUntil: "domcontentloaded" });
    const sudokuWindow = await openSudokuAndPlay();
    await expect.poll(() => held.requests, { timeout: PUBLISH_TIMEOUT_MS }).toBe(1);

    await interaction.run(page, sudokuWindow);
    const before = await readSudokuSurface(sudokuWindow);

    held.release();
    await expect
      .poll(() => api.verified.restores.length, { timeout: PUBLISH_TIMEOUT_MS })
      .toBe(1);
    await expect
      .poll(() => page.evaluate(() => window.__sudokuPublishFlowTest.readLifecycle()), {
        timeout: PUBLISH_TIMEOUT_MS,
      })
      .toEqual({
        difficulty: "easy",
        // The restored proof describes the board as it was before the reload, so
        // it is let go rather than used to replace the board in front of the
        // player. The puzzle stays playable and the clock keeps running.
        hasStatsSession: false,
        playing: true,
        statsSessionEligible: true,
        timerRunning: true,
      });
    await settleFrames(page);
    expect(await readSudokuSurface(sudokuWindow)).toEqual(before);

    // The save now says what is true: an ordinary offline puzzle, with the modes
    // the player set, and no proof attached to it.
    await expect
      .poll(() => readSudokuSave(page), { timeout: PUBLISH_TIMEOUT_MS })
      .toEqual({
        ...interaction.savedModes,
        puzzleId,
        values: before.values,
        verified: null,
      });
    // No new proof was minted to cover the board, and no replay was submitted.
    expect(api.sessionRequests).toHaveLength(1);
    expect(api.verified.finishes).toEqual([]);
    expect(api.eventRequests).toEqual([]);
  });
});

test("a stale restore reply does not detach a newer puzzle's proof", async ({ page }) => {
  const scenario = scenarios[0];
  const { api, openSudokuAndPlay } = await prepareRestorableSudokuPause(page, scenario);

  const held = holdSudokuRestore(page);
  await held.install();
  await page.reload({ waitUntil: "domcontentloaded" });
  const sudokuWindow = await openSudokuAndPlay();
  await expect.poll(() => held.requests, { timeout: PUBLISH_TIMEOUT_MS }).toBe(1);

  // A new puzzle owns the session before the old reply lands.
  await sudokuWindow.locator("#sudoku-new").click();
  await expect
    .poll(() => api.sessionRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(2);
  const issued = api.verified.boardFor("sudoku");
  await expect
    .poll(() => page.evaluate(() => window.__sudokuPublishFlowTest.readBoard()), {
      timeout: PUBLISH_TIMEOUT_MS,
    })
    .toEqual({
      hintMode: "off",
      noteMode: false,
      puzzle: issued.initial.puzzle,
      puzzleId: issued.id,
      values: issued.initial.puzzle,
    });

  held.release();
  await expect
    .poll(() => api.verified.restores.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  await settleFrames(page);

  // The reply belonged to the puzzle that was replaced, so it has nothing to let
  // go of: the proof the new puzzle is holding is not its to detach.
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
  const terminal = await prepareTerminalBoard(page, scenario.elapsedSeconds);
  await finishTerminalBoard(sudokuWindow, terminal);
  await expect
    .poll(() => api.verified.finishes.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  await expect
    .poll(() => api.eventRequests.length, { timeout: PUBLISH_TIMEOUT_MS })
    .toBe(1);
  expect(api.eventRequests[0].completion).toEqual({
    id: `completion-${api.verified.finishes[0].id}`,
    token: "synthetic-completion-proof",
  });
});

viewports.forEach((viewport) => {
  test(`a board kept through a held Sudoku restore renders at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const scenario = scenarios[0];
    const { api, openSudokuAndPlay } = await prepareRestorableSudokuPause(
      page,
      scenario,
      viewport
    );

    const held = holdSudokuRestore(page);
    await held.install();
    await page.reload({ waitUntil: "domcontentloaded" });
    const sudokuWindow = await openSudokuAndPlay();
    await expect.poll(() => held.requests, { timeout: PUBLISH_TIMEOUT_MS }).toBe(1);
    await acceptSudokuErrorsWarning(sudokuWindow);
    const before = await readSudokuSurface(sudokuWindow);
    await page.screenshot({
      path: testInfo.outputPath(`sudoku-held-restore-${viewport.name}-before.png`),
      fullPage: true,
    });

    held.release();
    await expect
      .poll(() => api.verified.restores.length, { timeout: PUBLISH_TIMEOUT_MS })
      .toBe(1);
    await expect
      .poll(() => page.evaluate(() => window.__sudokuPublishFlowTest.readLifecycle()), {
        timeout: PUBLISH_TIMEOUT_MS,
      })
      .toEqual({
        difficulty: "easy",
        hasStatsSession: false,
        playing: true,
        statsSessionEligible: true,
        timerRunning: true,
      });
    await settleFrames(page);

    // The warning the player accepted is still showing, on their own board.
    expect(await readSudokuSurface(sudokuWindow)).toEqual(before);
    await expect(sudokuWindow.locator('[data-sudoku-hint="errors"]')).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(sudokuWindow.locator(".sudoku-app")).toHaveClass(/is-sudoku-playing/);
    await expect(sudokuWindow.locator("#sudoku-errors-prompt")).toBeHidden();
    const accessibility = await new AxeBuilder({ page })
      .include('[data-app-window="sudoku"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`sudoku-held-restore-${viewport.name}-after.png`),
      fullPage: true,
    });
  });
});
