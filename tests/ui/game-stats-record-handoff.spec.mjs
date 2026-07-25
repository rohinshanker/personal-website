import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const profile = Object.freeze({
  id: "player-record-handoff-test",
  name: "Record Tester",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

const disableRemoteGameStats = async (page) => {
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
};

const installRecordTestBridge = async (page) => {
  const mainSource = await readFile(
    new URL("../../scripts/home/main.js", import.meta.url),
    "utf8"
  );
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__gameStatsRecordHandoffTest = Object.freeze({
  recordEvent: (event, options = {}) =>
    recordGameStatsEvent(event, "", options),
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the Game Stats record test bridge.");
  }
  await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedSource,
    })
  );
};

const recordEvent = async (page, payload, options = {}) => {
  await page.evaluate(
    async ({ eventPayload, recordOptions }) => {
      await window.__gameStatsRecordHandoffTest.recordEvent(
        {
          occurredAt: new Date().toISOString(),
          ...eventPayload,
        },
        recordOptions
      );
    },
    { eventPayload: payload, recordOptions: options }
  );
};

const closeStats = async (page, game) => {
  const windowElement = page.locator(`#game-stats-window-${game}`);
  await windowElement.locator(`[data-close="game-stats-${game}"]`).click();
  await expect(windowElement).toBeHidden();
};

test("personal records open only the matching non-Solitaire leaderboard", async ({
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
  await page.addInitScript((savedProfile) => {
    Math.random = () => 0.999999;
    localStorage.clear();
    localStorage.setItem("personalSitePlayerProfileV1", JSON.stringify(savedProfile));
  }, profile);
  await disableRemoteGameStats(page);
  await installRecordTestBridge(page);
  await page.goto("/home.html");

  const statsWindow = (game) => page.locator(`#game-stats-window-${game}`);
  const expectOnlyStatsWindow = async (game) => {
    for (const candidate of ["minesweeper", "solitaire", "snake", "sudoku"]) {
      if (candidate === game) {
        await expect(statsWindow(candidate)).toBeVisible();
      } else {
        await expect(statsWindow(candidate)).toBeHidden();
      }
    }
  };

  await recordEvent(page, {
    id: "event-mines-empty",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 120,
  });
  await expectOnlyStatsWindow("minesweeper");
  await closeStats(page, "minesweeper");

  await recordEvent(page, {
    id: "event-mines-tie",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 120,
  });
  await expect(statsWindow("minesweeper")).toBeHidden();

  await recordEvent(page, {
    id: "event-mines-better",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 119,
  });
  await expectOnlyStatsWindow("minesweeper");
  await closeStats(page, "minesweeper");

  await recordEvent(
    page,
    {
      id: "event-snake-empty",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: 0,
    },
    { snakePreviousHighScore: null }
  );
  await expectOnlyStatsWindow("snake");
  await closeStats(page, "snake");

  await recordEvent(
    page,
    {
      id: "event-snake-tie",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: 0,
    },
    { snakePreviousHighScore: 0 }
  );
  await expect(statsWindow("snake")).toBeHidden();

  await recordEvent(
    page,
    {
      id: "event-snake-better",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: 1,
    },
    { snakePreviousHighScore: 0 }
  );
  await expectOnlyStatsWindow("snake");
  await closeStats(page, "snake");

  await recordEvent(page, {
    id: "event-sudoku-hinted",
    game: "sudoku",
    type: "win",
    difficulty: "easy",
    hintBucket: "withHints",
    metric: 60,
  });
  await expect(statsWindow("sudoku")).toBeHidden();

  await recordEvent(
    page,
    {
      id: "event-sudoku-empty",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 120,
    },
    { sudokuNoHintsSeconds: 120 }
  );
  await expectOnlyStatsWindow("sudoku");
  await closeStats(page, "sudoku");

  await recordEvent(
    page,
    {
      id: "event-sudoku-tie",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 120,
    },
    { sudokuNoHintsSeconds: 120 }
  );
  await expect(statsWindow("sudoku")).toBeHidden();

  await recordEvent(
    page,
    {
      id: "event-sudoku-better",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 119,
    },
    { sudokuNoHintsSeconds: 119 }
  );
  await expectOnlyStatsWindow("sudoku");
  await closeStats(page, "sudoku");

  await recordEvent(page, {
    id: "event-solitaire-empty",
    game: "solitaire",
    type: "win",
    metric: 80,
  });
  await expect(statsWindow("solitaire")).toBeHidden();

  await recordEvent(page, {
    id: "event-solitaire-better",
    game: "solitaire",
    type: "win",
    metric: 70,
  });
  await expect(statsWindow("solitaire")).toBeHidden();

  const layout = await page.evaluate(() => ({
    documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
    visibleStatsWindows: Array.from(
      document.querySelectorAll("[data-game-stats-window]")
    ).filter(
      (element) =>
        !element.classList.contains("is-hidden") &&
        !element.classList.contains("is-closing")
    ).length,
  }));
  expect(layout).toEqual({ documentOverflows: false, visibleStatsWindows: 0 });

  await page.screenshot({
    path: testInfo.outputPath("record-handoff-final-state.png"),
    fullPage: true,
  });
  expect(consoleErrors).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
