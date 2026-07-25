import { expect, test } from "@playwright/test";

const API_BASE_URL = "https://game-stats.test";
const CONFIG_SCRIPT_URL =
  /\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/;
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const SYNC_QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";
const PROFILE_ICON = "assets/app-icons/ico/user_card.ico";

const MINESWEEPER_DIFFICULTIES = Object.freeze([
  "beginner",
  "intermediate",
  "expert",
]);
const SNAKE_BOARD_SIZES = Object.freeze(["10", "16", "20", "24"]);
const SUDOKU_DIFFICULTIES = Object.freeze([
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
  "extreme",
]);
const VIEWPORTS = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
]);

const PLAYERS = Object.freeze(
  Array.from({ length: 12 }, (_, index) =>
    Object.freeze({
      id: `player-ranked-${String(index + 1).padStart(2, "0")}`,
      name: `Ranked Player ${String(index + 1).padStart(2, "0")}`,
      icon: PROFILE_ICON,
      rerollCount: 0,
    })
  )
);
const RANKED_PROFILE = PLAYERS[7];
const UNPLAYED_PROFILE = Object.freeze({
  id: "player-unplayed",
  name: "Unplayed Player",
  icon: PROFILE_ICON,
  rerollCount: 0,
});
const EMPTY_WORLD_PROFILE = Object.freeze({
  id: "player-empty-world",
  name: "Empty World Player",
  icon: PROFILE_ICON,
  rerollCount: 0,
});

const CATEGORY_MODELS = Object.freeze({
  minesweeper: Object.freeze({
    beginner: Object.freeze({
      baseMetric: 30,
      direction: "asc",
      metricKind: "seconds",
      rank: 8,
      step: 4,
    }),
    intermediate: Object.freeze({
      baseMetric: 75,
      direction: "asc",
      metricKind: "seconds",
      rank: 9,
      step: 7,
    }),
    expert: Object.freeze({
      baseMetric: 150,
      direction: "asc",
      metricKind: "seconds",
      rank: 10,
      step: 13,
    }),
  }),
  solitaire: Object.freeze({
    baseMetric: 120,
    direction: "desc",
    metricKind: "wins",
    rank: 11,
    step: 9,
  }),
  snake: Object.freeze({
    10: Object.freeze({
      baseMetric: 1000,
      direction: "desc",
      metricKind: "points",
      rank: 4,
      step: 50,
    }),
    16: Object.freeze({
      baseMetric: 2000,
      direction: "desc",
      metricKind: "points",
      rank: 6,
      step: 80,
    }),
    20: Object.freeze({
      baseMetric: 3000,
      direction: "desc",
      metricKind: "points",
      rank: 9,
      step: 100,
    }),
    24: Object.freeze({
      baseMetric: 4000,
      direction: "desc",
      metricKind: "points",
      rank: 12,
      step: 125,
    }),
  }),
  sudoku: Object.freeze({
    easy: Object.freeze({
      baseMetric: 45,
      direction: "asc",
      metricKind: "seconds",
      rank: 4,
      step: 5,
    }),
    medium: Object.freeze({
      baseMetric: 80,
      direction: "asc",
      metricKind: "seconds",
      rank: 5,
      step: 7,
    }),
    hard: Object.freeze({
      baseMetric: 120,
      direction: "asc",
      metricKind: "seconds",
      rank: 6,
      step: 9,
    }),
    expert: Object.freeze({
      baseMetric: 180,
      direction: "asc",
      metricKind: "seconds",
      rank: 7,
      step: 11,
    }),
    master: Object.freeze({
      baseMetric: 240,
      direction: "asc",
      metricKind: "seconds",
      rank: 9,
      step: 13,
    }),
    extreme: Object.freeze({
      baseMetric: 300,
      direction: "asc",
      metricKind: "seconds",
      rank: 12,
      step: 17,
    }),
  }),
});

const categoryPlayerOrder = (rankedPlayerRank) => {
  const leaders = PLAYERS.slice(0, 3);
  const remaining = PLAYERS.filter(
    (player) =>
      player.id !== RANKED_PROFILE.id &&
      !leaders.some((leader) => leader.id === player.id)
  );
  const playersBeforeRanked = rankedPlayerRank - 4;
  return [
    ...leaders,
    ...remaining.slice(0, playersBeforeRanked),
    RANKED_PROFILE,
    ...remaining.slice(playersBeforeRanked),
  ];
};

const categoryEntries = (categoryKey, model) =>
  categoryPlayerOrder(model.rank).map((player, index) => {
    const rank = index + 1;
    const metric =
      model.direction === "asc"
        ? model.baseMetric + model.step * index
        : model.baseMetric - model.step * index;
    return Object.freeze({
      eventId: `event-${categoryKey}-${player.id}`,
      playerId: player.id,
      name: player.name,
      icon: player.icon,
      metric,
      metricKind: model.metricKind,
      occurredAt: new Date(Date.UTC(2026, 6, 25, 0, 0, rank)).toISOString(),
    });
  });

const FULL_CATEGORY_ENTRIES = Object.freeze({
  minesweeper: Object.freeze(
    Object.fromEntries(
      MINESWEEPER_DIFFICULTIES.map((difficulty) => [
        difficulty,
        Object.freeze(
          categoryEntries(
            `minesweeper-${difficulty}`,
            CATEGORY_MODELS.minesweeper[difficulty]
          )
        ),
      ])
    )
  ),
  solitaire: Object.freeze(
    categoryEntries("solitaire", CATEGORY_MODELS.solitaire)
  ),
  snake: Object.freeze(
    Object.fromEntries(
      SNAKE_BOARD_SIZES.map((size) => [
        size,
        Object.freeze(
          categoryEntries(`snake-${size}`, CATEGORY_MODELS.snake[size])
        ),
      ])
    )
  ),
  sudoku: Object.freeze(
    Object.fromEntries(
      SUDOKU_DIFFICULTIES.map((difficulty) => [
        difficulty,
        Object.freeze(
          categoryEntries(`sudoku-${difficulty}`, CATEGORY_MODELS.sudoku[difficulty])
        ),
      ])
    )
  ),
});

const rankedEntry = (entries) =>
  entries.find((entry) => entry.playerId === RANKED_PROFILE.id);

const rankPayload = (model, includeRankedPlayer) => ({
  rank: includeRankedPlayer ? model.rank : null,
  totalPlayers: PLAYERS.length,
});

const createMultiplayerPayload = (requestedPlayerId) => {
  const includeRankedPlayer = requestedPlayerId === RANKED_PROFILE.id;
  return {
    version: 1,
    generatedAt: "2026-07-25T00:30:00.000Z",
    eventIds: [],
    totals: {
      minesweeper: {
        wins: Object.fromEntries(
          MINESWEEPER_DIFFICULTIES.map((difficulty) => [
            difficulty,
            FULL_CATEGORY_ENTRIES.minesweeper[difficulty].length,
          ])
        ),
      },
      solitaire: { wins: 720 },
      snake: {
        totalGamesPlayed: PLAYERS.length * SNAKE_BOARD_SIZES.length,
        gamesPlayed: Object.fromEntries(
          SNAKE_BOARD_SIZES.map((size) => [
            size,
            FULL_CATEGORY_ENTRIES.snake[size].length,
          ])
        ),
      },
      sudoku: {
        wins: Object.fromEntries(
          SUDOKU_DIFFICULTIES.map((difficulty) => [
            difficulty,
            {
              noHints: FULL_CATEGORY_ENTRIES.sudoku[difficulty].length,
              withHints: 3,
            },
          ])
        ),
        bestTimes: Object.fromEntries(
          SUDOKU_DIFFICULTIES.map((difficulty) => [
            difficulty,
            FULL_CATEGORY_ENTRIES.sudoku[difficulty][0].metric,
          ])
        ),
      },
    },
    leaderboards: {
      minesweeper: Object.fromEntries(
        MINESWEEPER_DIFFICULTIES.map((difficulty) => [
          difficulty,
          FULL_CATEGORY_ENTRIES.minesweeper[difficulty].slice(0, 3),
        ])
      ),
      solitaire: FULL_CATEGORY_ENTRIES.solitaire.slice(0, 3),
      snake: Object.fromEntries(
        SNAKE_BOARD_SIZES.map((size) => [
          size,
          FULL_CATEGORY_ENTRIES.snake[size].slice(0, 3),
        ])
      ),
      sudoku: Object.fromEntries(
        SUDOKU_DIFFICULTIES.map((difficulty) => [
          difficulty,
          FULL_CATEGORY_ENTRIES.sudoku[difficulty].slice(0, 3),
        ])
      ),
    },
    playerRanks: {
      minesweeper: Object.fromEntries(
        MINESWEEPER_DIFFICULTIES.map((difficulty) => [
          difficulty,
          rankPayload(CATEGORY_MODELS.minesweeper[difficulty], includeRankedPlayer),
        ])
      ),
      solitaire: rankPayload(CATEGORY_MODELS.solitaire, includeRankedPlayer),
      snake: Object.fromEntries(
        SNAKE_BOARD_SIZES.map((size) => [
          size,
          rankPayload(CATEGORY_MODELS.snake[size], includeRankedPlayer),
        ])
      ),
      sudoku: Object.fromEntries(
        SUDOKU_DIFFICULTIES.map((difficulty) => [
          difficulty,
          rankPayload(CATEGORY_MODELS.sudoku[difficulty], includeRankedPlayer),
        ])
      ),
    },
    playerRecords: {
      minesweeper: Object.fromEntries(
        MINESWEEPER_DIFFICULTIES.map((difficulty) => [
          difficulty,
          includeRankedPlayer
            ? rankedEntry(FULL_CATEGORY_ENTRIES.minesweeper[difficulty])
            : null,
        ])
      ),
      solitaire: includeRankedPlayer
        ? rankedEntry(FULL_CATEGORY_ENTRIES.solitaire)
        : null,
      snake: Object.fromEntries(
        SNAKE_BOARD_SIZES.map((size) => [
          size,
          includeRankedPlayer ? rankedEntry(FULL_CATEGORY_ENTRIES.snake[size]) : null,
        ])
      ),
      sudoku: Object.fromEntries(
        SUDOKU_DIFFICULTIES.map((difficulty) => [
          difficulty,
          includeRankedPlayer
            ? rankedEntry(FULL_CATEGORY_ENTRIES.sudoku[difficulty])
            : null,
        ])
      ),
    },
  };
};

const createEmptyPayload = () => ({
  version: 1,
  generatedAt: "2026-07-25T00:30:00.000Z",
  eventIds: [],
  totals: {
    minesweeper: {
      wins: Object.fromEntries(
        MINESWEEPER_DIFFICULTIES.map((difficulty) => [difficulty, 0])
      ),
    },
    solitaire: { wins: 0 },
    snake: {
      totalGamesPlayed: 0,
      gamesPlayed: Object.fromEntries(SNAKE_BOARD_SIZES.map((size) => [size, 0])),
    },
    sudoku: {
      wins: Object.fromEntries(
        SUDOKU_DIFFICULTIES.map((difficulty) => [
          difficulty,
          { noHints: 0, withHints: 0 },
        ])
      ),
      bestTimes: Object.fromEntries(
        SUDOKU_DIFFICULTIES.map((difficulty) => [difficulty, null])
      ),
    },
  },
  leaderboards: {
    minesweeper: Object.fromEntries(
      MINESWEEPER_DIFFICULTIES.map((difficulty) => [difficulty, []])
    ),
    solitaire: [],
    snake: Object.fromEntries(SNAKE_BOARD_SIZES.map((size) => [size, []])),
    sudoku: Object.fromEntries(
      SUDOKU_DIFFICULTIES.map((difficulty) => [difficulty, []])
    ),
  },
  playerRanks: {
    minesweeper: Object.fromEntries(
      MINESWEEPER_DIFFICULTIES.map((difficulty) => [
        difficulty,
        { rank: null, totalPlayers: 0 },
      ])
    ),
    solitaire: { rank: null, totalPlayers: 0 },
    snake: Object.fromEntries(
      SNAKE_BOARD_SIZES.map((size) => [size, { rank: null, totalPlayers: 0 }])
    ),
    sudoku: Object.fromEntries(
      SUDOKU_DIFFICULTIES.map((difficulty) => [
        difficulty,
        { rank: null, totalPlayers: 0 },
      ])
    ),
  },
  playerRecords: {
    minesweeper: Object.fromEntries(
      MINESWEEPER_DIFFICULTIES.map((difficulty) => [difficulty, null])
    ),
    solitaire: null,
    snake: Object.fromEntries(SNAKE_BOARD_SIZES.map((size) => [size, null])),
    sudoku: Object.fromEntries(
      SUDOKU_DIFFICULTIES.map((difficulty) => [difficulty, null])
    ),
  },
});

const installMockBackend = async (
  page,
  { profile, emptyPayload = false } = {}
) => {
  const requestedPlayerIds = [];
  const runtimeErrors = [];
  const consoleErrors = [];

  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.route(CONFIG_SCRIPT_URL, (route) =>
    route.fulfill({
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "${API_BASE_URL}", buildVersion: "test-multiplayer-ranks" });`,
      contentType: "application/javascript",
    })
  );
  await page.route(`${API_BASE_URL}/**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const corsHeaders = {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Origin": "*",
    };

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }
    if (request.method() !== "GET" || url.pathname !== "/stats") {
      return route.fulfill({
        status: 404,
        body: JSON.stringify({ error: "Unexpected mock API request" }),
        contentType: "application/json",
        headers: corsHeaders,
      });
    }

    const requestedPlayerId = url.searchParams.get("playerId");
    requestedPlayerIds.push(requestedPlayerId);
    return route.fulfill({
      status: 200,
      body: JSON.stringify(
        emptyPayload
          ? createEmptyPayload()
          : createMultiplayerPayload(requestedPlayerId)
      ),
      contentType: "application/json",
      headers: corsHeaders,
    });
  });
  await page.addInitScript(
    ({ profileKey, queueKey, savedProfile, statsKey }) => {
      Math.random = () => 0.999999;
      localStorage.setItem(profileKey, JSON.stringify(savedProfile));
      localStorage.removeItem(statsKey);
      localStorage.removeItem(queueKey);
      sessionStorage.clear();
    },
    {
      profileKey: PROFILE_STORAGE_KEY,
      queueKey: SYNC_QUEUE_STORAGE_KEY,
      savedProfile: profile,
      statsKey: STATS_STORAGE_KEY,
    }
  );

  return { consoleErrors, requestedPlayerIds, runtimeErrors };
};

const dismissAboutWindow = async (page) => {
  const close = page.locator('#about-window [data-close="about"]');
  if (await close.isVisible()) await close.click();
};

const openStatsWindow = async (page, game) => {
  const app = page.locator(`[data-app-window="${game}"]`);
  await page.locator(`.desktop-icon[data-app="${game}"]`).click();
  await expect(app).toBeVisible();
  await app.locator(`[data-game-stats-open="${game}"]`).click();

  const stats = page.locator(`#game-stats-window-${game}`);
  await expect(stats).toBeVisible();
  await expect(stats.locator("[data-game-stats-sync-status]")).toHaveText(
    "Global stats are up to date."
  );
  return { app, stats };
};

const closeStatsWindow = async (page, game, app, stats) => {
  await stats.locator(`[data-close="game-stats-${game}"]`).click();
  await expect(stats).toBeHidden();
  await app.locator(`[data-close="${game}"]`).click();
  await expect(app).toBeHidden();
  await expect(page.locator(`#game-stats-window-${game}`)).toBeHidden();
};

const assertNoHorizontalOverflow = async (page, stats) => {
  await expect
    .poll(
      () =>
        stats.evaluate((windowElement) => {
          const rect = windowElement.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= window.innerWidth;
        }),
      { message: "stats window should finish clamping inside the viewport" }
    )
    .toBe(true);

  const layout = await stats.evaluate((windowElement) => {
    const rect = windowElement.getBoundingClientRect();
    const body = windowElement.querySelector(".window-body");
    return {
      bodyClientWidth: body?.clientWidth || 0,
      bodyScrollWidth: body?.scrollWidth || 0,
      documentScrollWidth: document.documentElement.scrollWidth,
      left: rect.left,
      right: rect.right,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.bodyClientWidth);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(
    layout.viewportWidth
  );
};

const assertLeaderboardRankSpacing = async (stats) => {
  await expect
    .poll(
      () =>
        stats.evaluate((windowElement) =>
          Array.from(
            windowElement.querySelectorAll(
              ".game-stats-leaderboard-template-row, .game-stats-minesweeper-row"
            )
          ).every((row) => {
            const rank = row.querySelector(
              ".game-stats-leaderboard-template-medal, .game-stats-minesweeper-medal, .game-stats-leaderboard-template-rank, .game-stats-minesweeper-rank"
            );
            const icon = row.querySelector(
              ".game-stats-leaderboard-template-player-icon, .game-stats-minesweeper-player-icon"
            );
            const name = row.querySelector(".game-stats-player-name");
            if (!rank || !icon || !name) return false;

            const rankBounds = rank.getBoundingClientRect();
            const iconBounds = icon.getBoundingClientRect();
            const nameBounds = name.getBoundingClientRect();
            const rankToIconGap = iconBounds.left - rankBounds.right;
            const iconToNameGap = nameBounds.left - iconBounds.right;

            return (
              Math.abs(rankToIconGap - iconToNameGap) <= 0.5 &&
              Math.abs(rankToIconGap - 2) <= 0.5
            );
          })
        ),
      { message: "leaderboard rank and player-name gaps should both be 2px" }
    )
    .toBe(true);
};

const expectDigitMetric = async (row, metric) => {
  const digitImages = await row
    .locator(".game-stats-metric img")
    .evaluateAll((images) =>
      images.map((image) => ({
        alt: image.alt,
        source: new URL(image.src).pathname,
      }))
    );
  const expectedDigits = String(metric).padStart(3, " ");
  expect(digitImages.map(({ alt }) => alt).join("")).toBe(expectedDigits);
  expect(digitImages.map(({ source }, index) => source)).toEqual(
    expectedDigits.split("").map((digit) =>
      `/assets/minesweeper_assets/digital_digits/digital_${
        digit === " " ? "unlit" : digit
      }.png`
    )
  );
};

const formatSudokuTime = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;

const expectedGlobalLabels = (game, category) => {
  const entries =
    game === "solitaire"
      ? FULL_CATEGORY_ENTRIES.solitaire
      : FULL_CATEGORY_ENTRIES[game][category];
  return entries.slice(0, 3).map((entry, index) => {
    if (game === "minesweeper") {
      return `Rank ${index + 1}: ${entry.name}, ${entry.metric} seconds`;
    }
    if (game === "solitaire") {
      return `Rank ${index + 1}: ${entry.name}, ${entry.metric} wins`;
    }
    if (game === "snake") {
      return `Rank ${index + 1}: ${entry.name}, ${entry.metric} points`;
    }
    return `Rank ${index + 1}: ${entry.name}, ${entry.metric} seconds`;
  });
};

const expectGlobalRows = async (panel, game, category) => {
  const rows = panel.locator(
    ".game-stats-leaderboard-template-list > .game-stats-leaderboard-template-row"
  );
  const labels = expectedGlobalLabels(game, category);
  await expect(rows).toHaveCount(3);
  for (const [index, label] of labels.entries()) {
    await expect(rows.nth(index)).toHaveAttribute("aria-label", label);
    await expect(
      rows.nth(index).locator(".game-stats-player-name-text")
    ).toHaveText(PLAYERS[index].name);
  }
  return labels;
};

const expectRankedMinesweeper = async (stats) => {
  for (const difficulty of MINESWEEPER_DIFFICULTIES) {
    const panel = stats.locator(
      `[aria-labelledby="game-stats-minesweeper-${difficulty}"]`
    );
    await expectGlobalRows(panel, "minesweeper", difficulty);
    const model = CATEGORY_MODELS.minesweeper[difficulty];
    const entry = rankedEntry(FULL_CATEGORY_ENTRIES.minesweeper[difficulty]);
    const row = panel.locator(".game-stats-minesweeper-record-row");
    await expect(panel.getByText("Your Record", { exact: true })).toBeVisible();
    await expect(row.locator(".game-stats-minesweeper-rank")).toHaveText(
      `#${model.rank}`
    );
    await expect(row).toHaveAttribute(
      "aria-label",
      `Your record: #${model.rank}, ${RANKED_PROFILE.name}, ${entry.metric} seconds`
    );
    await expectDigitMetric(row, entry.metric);
  }
};

const expectRankedSolitaire = async (stats) => {
  const panel = stats.locator(
    '[aria-labelledby="game-stats-solitaire-most-wins"]'
  );
  await expectGlobalRows(panel, "solitaire");
  const entry = rankedEntry(FULL_CATEGORY_ENTRIES.solitaire);
  const row = panel.locator(".game-stats-solitaire-local-wins-row");
  await expect(panel.getByText("Your Record", { exact: true })).toBeVisible();
  await expect(row.locator(".game-stats-leaderboard-template-rank")).toHaveText(
    `#${CATEGORY_MODELS.solitaire.rank}`
  );
  await expect(row).toHaveAttribute(
    "aria-label",
    `Your Solitaire record: #${CATEGORY_MODELS.solitaire.rank}, ${RANKED_PROFILE.name}, ${entry.metric} wins`
  );
  await expectDigitMetric(row, entry.metric);
};

const expectRankedSnake = async (stats) => {
  for (const size of SNAKE_BOARD_SIZES) {
    const panel = stats.locator(`[aria-labelledby="game-stats-snake-${size}"]`);
    await expectGlobalRows(panel, "snake", size);
    const model = CATEGORY_MODELS.snake[size];
    const entry = rankedEntry(FULL_CATEGORY_ENTRIES.snake[size]);
    const row = panel.locator(".game-stats-snake-local-best-row");
    await expect(panel.getByText("Your Record", { exact: true })).toBeVisible();
    await expect(row.locator(".game-stats-leaderboard-template-rank")).toHaveText(
      `#${model.rank}`
    );
    await expect(row).toHaveAttribute(
      "aria-label",
      `Your record: #${model.rank}, ${RANKED_PROFILE.name}, ${entry.metric} points`
    );
    await expectDigitMetric(row, entry.metric);
  }
};

const expectRankedSudoku = async (stats) => {
  for (const difficulty of SUDOKU_DIFFICULTIES) {
    const panel = stats.locator(
      `[aria-labelledby="game-stats-sudoku-${difficulty}"]`
    );
    await expectGlobalRows(panel, "sudoku", difficulty);
    const model = CATEGORY_MODELS.sudoku[difficulty];
    const entry = rankedEntry(FULL_CATEGORY_ENTRIES.sudoku[difficulty]);
    const row = panel.locator(".game-stats-sudoku-local-best-row");
    await expect(panel.getByText("Your Record", { exact: true })).toBeVisible();
    await expect(row.locator(".game-stats-leaderboard-template-rank")).toHaveText(
      `#${model.rank}`
    );
    await expect(row).toHaveAttribute(
      "aria-label",
      `Your no-hints record: #${model.rank}, ${RANKED_PROFILE.name}, ${entry.metric} seconds`
    );
    await expect(row.locator(".game-stats-metric--text")).toHaveText(
      formatSudokuTime(entry.metric)
    );
  }
};

const expectUnplayedRanks = async (stats, game) => {
  const rows =
    game === "minesweeper"
      ? stats.locator(".game-stats-minesweeper-record-row")
      : game === "solitaire"
        ? stats.locator(".game-stats-solitaire-local-wins-row")
        : game === "snake"
          ? stats.locator(".game-stats-snake-local-best-row")
          : stats.locator(".game-stats-sudoku-local-best-row");
  const expectedCount =
    game === "minesweeper"
      ? MINESWEEPER_DIFFICULTIES.length
      : game === "solitaire"
        ? 1
        : game === "snake"
          ? SNAKE_BOARD_SIZES.length
          : SUDOKU_DIFFICULTIES.length;

  await expect(rows).toHaveCount(expectedCount);
  for (let index = 0; index < expectedCount; index += 1) {
    const rank = rows
      .nth(index)
      .locator(
        game === "minesweeper"
          ? ".game-stats-minesweeper-rank"
          : ".game-stats-leaderboard-template-rank"
      );
    await expect(rank).toHaveText("#—");
    await expect(rank).toHaveAttribute("aria-label", "No global rank");
  }
  if (game === "sudoku") {
    await expect(rows.locator(".game-stats-metric--text")).toHaveText(
      SUDOKU_DIFFICULTIES.map(() => "99:99")
    );
  }
};

const expectEveryGlobalTopThree = async (stats, game) => {
  if (game === "minesweeper") {
    for (const difficulty of MINESWEEPER_DIFFICULTIES) {
      await expectGlobalRows(
        stats.locator(
          `[aria-labelledby="game-stats-minesweeper-${difficulty}"]`
        ),
        game,
        difficulty
      );
    }
    return;
  }
  if (game === "solitaire") {
    await expectGlobalRows(
      stats.locator('[aria-labelledby="game-stats-solitaire-most-wins"]'),
      game
    );
    return;
  }
  if (game === "snake") {
    for (const size of SNAKE_BOARD_SIZES) {
      await expectGlobalRows(
        stats.locator(`[aria-labelledby="game-stats-snake-${size}"]`),
        game,
        size
      );
    }
    return;
  }
  for (const difficulty of SUDOKU_DIFFICULTIES) {
    await expectGlobalRows(
      stats.locator(`[aria-labelledby="game-stats-sudoku-${difficulty}"]`),
      game,
      difficulty
    );
  }
};

for (const viewport of VIEWPORTS) {
  test(`12-player rankings keep global Top 3 independent at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const diagnostics = await installMockBackend(page, {
      profile: RANKED_PROFILE,
    });
    await page.goto("/home.html");
    await dismissAboutWindow(page);

    for (const game of ["minesweeper", "solitaire", "snake", "sudoku"]) {
      const { app, stats } = await openStatsWindow(page, game);
      if (game === "minesweeper") await expectRankedMinesweeper(stats);
      if (game === "solitaire") await expectRankedSolitaire(stats);
      if (game === "snake") await expectRankedSnake(stats);
      if (game === "sudoku") {
        await expectRankedSudoku(stats);
        await page.screenshot({
          path: testInfo.outputPath(
            `ranked-sudoku-${viewport.width}x${viewport.height}.png`
          ),
          fullPage: true,
        });
      }
      await assertNoHorizontalOverflow(page, stats);
      await assertLeaderboardRankSpacing(stats);
      await closeStatsWindow(page, game, app, stats);
    }

    expect(diagnostics.requestedPlayerIds.length).toBeGreaterThanOrEqual(4);
    expect(new Set(diagnostics.requestedPlayerIds)).toEqual(
      new Set([RANKED_PROFILE.id])
    );
    expect(diagnostics.runtimeErrors).toEqual([]);
    expect(diagnostics.consoleErrors).toEqual([]);
  });

  test(`unplayed player stays unranked without changing Top 3 at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const diagnostics = await installMockBackend(page, {
      profile: UNPLAYED_PROFILE,
    });
    await page.goto("/home.html");
    await dismissAboutWindow(page);

    for (const game of ["minesweeper", "solitaire", "snake", "sudoku"]) {
      const { app, stats } = await openStatsWindow(page, game);
      await expectEveryGlobalTopThree(stats, game);
      await expectUnplayedRanks(stats, game);
      await assertNoHorizontalOverflow(page, stats);
      await assertLeaderboardRankSpacing(stats);
      await closeStatsWindow(page, game, app, stats);
    }

    expect(diagnostics.requestedPlayerIds.length).toBeGreaterThanOrEqual(4);
    expect(new Set(diagnostics.requestedPlayerIds)).toEqual(
      new Set([UNPLAYED_PROFILE.id])
    );
    expect(diagnostics.runtimeErrors).toEqual([]);
    expect(diagnostics.consoleErrors).toEqual([]);
  });

  test(`empty Sudoku slots use 99:99 at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const diagnostics = await installMockBackend(page, {
      profile: EMPTY_WORLD_PROFILE,
      emptyPayload: true,
    });
    await page.goto("/home.html");
    await dismissAboutWindow(page);

    const { app, stats } = await openStatsWindow(page, "sudoku");
    const globalRows = stats.locator(
      ".game-stats-sudoku-leaderboard .game-stats-leaderboard-template-list > .game-stats-sudoku-row"
    );
    const personalRows = stats.locator(".game-stats-sudoku-local-best-row");
    await expect(globalRows).toHaveCount(SUDOKU_DIFFICULTIES.length * 3);
    await expect(personalRows).toHaveCount(SUDOKU_DIFFICULTIES.length);
    await expect(globalRows.locator(".game-stats-metric--text")).toHaveText(
      Array.from({ length: SUDOKU_DIFFICULTIES.length * 3 }, () => "99:99")
    );
    await expect(personalRows.locator(".game-stats-metric--text")).toHaveText(
      SUDOKU_DIFFICULTIES.map(() => "99:99")
    );
    await expect(
      stats.locator(".game-stats-sudoku-row .game-stats-metric--text")
    ).toHaveText(
      Array.from({ length: SUDOKU_DIFFICULTIES.length * 4 }, () => "99:99")
    );
    await assertNoHorizontalOverflow(page, stats);
    await page.screenshot({
      path: testInfo.outputPath(
        `empty-sudoku-${viewport.width}x${viewport.height}.png`
      ),
      fullPage: true,
    });
    await closeStatsWindow(page, "sudoku", app, stats);

    expect(diagnostics.requestedPlayerIds).toContain(EMPTY_WORLD_PROFILE.id);
    expect(diagnostics.runtimeErrors).toEqual([]);
    expect(diagnostics.consoleErrors).toEqual([]);
  });
}
