import { expect, test } from "@playwright/test";

const API_BASE_URL = "https://game-stats-refresh.test";
const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const GAME_STATS_SYNC_QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const ADMINISTRATOR_PROOF_STORAGE_KEY = "personalSiteAdministratorProofV1";
const SNAKE_HIGH_SCORE_KEY = "personalSiteSnakeHighScores";
const ADMINISTRATOR_PROOF = `${"a".repeat(32)}.${"b".repeat(32)}`;
const ADMINISTRATOR_PROFILE = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
});
const PLAYER_PROFILE = Object.freeze({
  id: "player-refresh-control",
  name: "Refresh Tester",
  icon: "assets/app-icons/ico/user_card.ico",
});
const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
]);

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

const createQueuedSubmission = (profile = PLAYER_PROFILE) => ({
  event: {
    id: `refresh-${profile.id === ADMINISTRATOR_PROFILE.id ? "admin" : "player"}-event`,
    game: "minesweeper",
    type: "win",
    occurredAt: new Date().toISOString(),
    difficulty: "beginner",
    metric: 42,
    metricKind: "seconds",
    profile,
  },
  session: {
    id: `refresh-${profile.id === ADMINISTRATOR_PROFILE.id ? "admin" : "player"}-session`,
    token: "refresh-control-session-token",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  },
});

const installBackendConfig = async (page, { configured = true } = {}) => {
  await page.route("**/scripts/home/game-stats-backend.js*", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({
        apiBaseUrl: ${JSON.stringify(configured ? API_BASE_URL : "")},
        buildVersion: ${JSON.stringify(configured ? `sha256-${"c".repeat(64)}` : "")}
      });`,
    });
  });
};

const installApiHarness = async (
  page,
  { requireAdministratorProof = false } = {}
) => {
  const statsRequests = [];
  const eventRequests = [];
  const signInRequests = [];
  const statsBehaviors = [];
  const eventGates = [];
  const signInGates = [];

  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/stats") {
      statsRequests.push(url.pathname + url.search);
      const behavior = statsBehaviors.shift();
      behavior?.started.resolve();
      if (behavior?.kind === "gate") {
        await behavior.release.promise;
      } else if (behavior?.kind === "timeout") {
        await new Promise((resolve) => setTimeout(resolve, behavior.delayMs));
      }
      try {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            generatedAt: new Date().toISOString(),
            totals: {},
            leaderboards: {},
            playerRanks: {},
            playerRecords: {},
          }),
        });
      } catch {
        // An intentionally timed-out browser request can close before the mock responds.
      }
      return;
    }

    if (url.pathname === "/events") {
      const eventRequest = {
        authorization: request.headers().authorization || "",
        body: JSON.parse(request.postData() || "{}"),
      };
      eventRequests.push(eventRequest);
      const gate = eventGates.shift();
      gate?.started.resolve();
      if (gate) await gate.release.promise;

      if (
        requireAdministratorProof &&
        eventRequest.body.event?.profile?.id === ADMINISTRATOR_PROFILE.id &&
        eventRequest.authorization !== `Bearer ${ADMINISTRATOR_PROOF}`
      ) {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "Administrator proof required" }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, applied: true }),
      });
      return;
    }

    if (url.pathname === "/administrator/sign-in") {
      signInRequests.push(JSON.parse(request.postData() || "{}"));
      const gate = signInGates.shift();
      gate?.started.resolve();
      if (gate) await gate.release.promise;
      try {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            profile: ADMINISTRATOR_PROFILE,
            proof: ADMINISTRATOR_PROOF,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          }),
        });
      } catch {
        // Closing the sign-in window intentionally aborts an in-flight request.
      }
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Unexpected test route" }),
    });
  });

  return {
    eventRequests,
    holdNextEvent() {
      const gate = { release: createDeferred(), started: createDeferred() };
      eventGates.push(gate);
      return gate;
    },
    holdNextStats() {
      const gate = {
        kind: "gate",
        release: createDeferred(),
        started: createDeferred(),
      };
      statsBehaviors.push(gate);
      return gate;
    },
    holdNextSignIn() {
      const gate = { release: createDeferred(), started: createDeferred() };
      signInGates.push(gate);
      return gate;
    },
    signInRequests,
    statsRequests,
    timeoutNextStats(delayMs = 300) {
      const behavior = {
        kind: "timeout",
        delayMs,
        started: createDeferred(),
      };
      statsBehaviors.push(behavior);
      return behavior;
    },
  };
};

const collectRuntimeErrors = (page) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  return { consoleErrors, pageErrors };
};

const preparePage = async (
  page,
  {
    apiTimeoutMs = null,
    gameStats = null,
    profile = null,
    queue = null,
    snakeHighScores = null,
  } = {}
) => {
  await page.addInitScript(
    ({
      acceleratedApiTimeoutMs,
      gameStatsStorageKey,
      profileStorageKey,
      queueStorageKey,
      savedGameStats,
      savedProfile,
      savedQueue,
      savedSnakeHighScores,
      snakeHighScoreKey,
    }) => {
      Math.random = () => 0.999999999;
      if (savedProfile) {
        localStorage.setItem(profileStorageKey, JSON.stringify(savedProfile));
      } else {
        localStorage.removeItem(profileStorageKey);
      }
      if (savedGameStats) {
        localStorage.setItem(gameStatsStorageKey, JSON.stringify(savedGameStats));
      } else {
        localStorage.removeItem(gameStatsStorageKey);
      }
      if (savedQueue) {
        localStorage.setItem(queueStorageKey, JSON.stringify(savedQueue));
      } else {
        localStorage.removeItem(queueStorageKey);
      }
      if (savedSnakeHighScores) {
        localStorage.setItem(snakeHighScoreKey, JSON.stringify(savedSnakeHighScores));
      } else {
        localStorage.removeItem(snakeHighScoreKey);
      }
      if (acceleratedApiTimeoutMs) {
        const nativeSetTimeout = window.setTimeout.bind(window);
        window.setTimeout = (handler, delay = 0, ...args) =>
          nativeSetTimeout(
            handler,
            delay === 8000 ? acceleratedApiTimeoutMs : delay,
            ...args
          );
      }
    },
    {
      acceleratedApiTimeoutMs: apiTimeoutMs,
      gameStatsStorageKey: GAME_STATS_STORAGE_KEY,
      profileStorageKey: PROFILE_STORAGE_KEY,
      queueStorageKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      savedGameStats: gameStats,
      savedProfile: profile,
      savedQueue: queue,
      savedSnakeHighScores: snakeHighScores,
      snakeHighScoreKey: SNAKE_HIGH_SCORE_KEY,
    }
  );
  await page.goto("/home.html");
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
};

const openStatsWindow = async (page, game, { programmatic = false } = {}) => {
  const desktopIcon = page.locator(`.desktop-icon[data-app="${game}"]`);
  if (programmatic) {
    await desktopIcon.evaluate((element) => element.click());
  } else {
    await desktopIcon.click();
  }

  const gameWindow = page.locator(`[data-app-window="${game}"]`);
  await expect(gameWindow).toBeVisible();
  const statsControl = gameWindow.locator(`[data-game-stats-open="${game}"]`);
  if (programmatic) {
    await statsControl.evaluate((element) => element.click());
  } else {
    await statsControl.click();
  }

  const statsWindow = page.locator(`[data-game-stats-window="${game}"]`);
  await expect(statsWindow).toBeVisible();
  await expect(statsWindow).not.toHaveClass(/is-opening/);
  return {
    button: statsWindow.locator(`[data-game-stats-refresh="${game}"]`),
    status: statsWindow.locator("[data-game-stats-sync-status]"),
    window: statsWindow,
  };
};

const expectSyncState = async (
  parts,
  { busy, buttonLabel, buttonDisabled, message }
) => {
  await expect(parts.status).toHaveText(message);
  await expect(parts.status).toHaveAttribute("aria-busy", String(busy));
  await expect(parts.button).toHaveAttribute("aria-busy", String(busy));
  await expect(parts.button).toHaveAttribute("aria-label", buttonLabel);
  if (buttonDisabled) {
    await expect(parts.button).toBeDisabled();
  } else {
    await expect(parts.button).toBeEnabled();
  }
};

const expectNoHorizontalOverflow = async (parts) => {
  await expect
    .poll(() =>
      parts.window.evaluate((windowElement) => {
        const row = windowElement.querySelector(".game-stats-sync-row");
        const status = windowElement.querySelector("[data-game-stats-sync-status]");
        const button = windowElement.querySelector("[data-game-stats-refresh]");
        const rowBounds = row.getBoundingClientRect();
        const statusBounds = status.getBoundingClientRect();
        const buttonBounds = button.getBoundingClientRect();
        return {
          documentOverflows:
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
          rowOverflows: row.scrollWidth > row.clientWidth,
          statusStartsInsideRow: statusBounds.left >= rowBounds.left - 1,
          statusEndsBeforeButton: statusBounds.right <= buttonBounds.left,
          buttonEndsInsideRow: buttonBounds.right <= rowBounds.right + 1,
        };
      })
    )
    .toEqual({
      documentOverflows: false,
      rowOverflows: false,
      statusStartsInsideRow: true,
      statusEndsBeforeButton: true,
      buttonEndsInsideRow: true,
    });
};

const expectNoUnexpectedRuntimeErrors = (runtime, allowedConsolePattern = null) => {
  expect(runtime.pageErrors).toEqual([]);
  const unexpectedConsoleErrors = allowedConsolePattern
    ? runtime.consoleErrors.filter((message) => !allowedConsolePattern.test(message))
    : runtime.consoleErrors;
  expect(unexpectedConsoleErrors).toEqual([]);
};

for (const viewport of viewports) {
  test(`initial automatic sync, ready, and manual refresh at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const runtime = collectRuntimeErrors(page);
    await installBackendConfig(page);
    const api = await installApiHarness(page);
    const initialGate = api.holdNextStats();

    await preparePage(page);
    await initialGate.started.promise;
    const stats = await openStatsWindow(page, "minesweeper");

    await expectSyncState(stats, {
      busy: true,
      buttonDisabled: true,
      buttonLabel: "Game stats refresh unavailable for Minesweeper",
      message: "Fetching latest stats...",
    });
    await expect(stats.status).toHaveAttribute("aria-label", "Fetching latest stats...");
    await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
    await expectNoHorizontalOverflow(stats);

    initialGate.release.resolve();
    await expectSyncState(stats, {
      busy: false,
      buttonDisabled: false,
      buttonLabel: "Refresh Minesweeper stats",
      message: "Global stats are up to date.",
    });

    const baselineRequestCount = api.statsRequests.length;
    const manualGate = api.holdNextStats();
    await stats.button.click();
    await manualGate.started.promise;

    await expectSyncState(stats, {
      busy: true,
      buttonDisabled: true,
      buttonLabel: "Game stats refresh unavailable for Minesweeper",
      message: "Fetching latest stats...",
    });
    await expect(stats.status).toHaveAttribute("aria-label", "Fetching latest stats...");
    await expect(page.locator("body")).toHaveClass(/is-custom-cursor-loading/);
    expect(api.statsRequests).toHaveLength(baselineRequestCount + 1);
    await expectNoHorizontalOverflow(stats);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-manual-fetching.png`),
    });

    manualGate.release.resolve();
    await expectSyncState(stats, {
      busy: false,
      buttonDisabled: false,
      buttonLabel: "Refresh Minesweeper stats",
      message: "Global stats are up to date.",
    });
    await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
    await expectNoHorizontalOverflow(stats);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-ready.png`),
    });
    expectNoUnexpectedRuntimeErrors(runtime);
  });
}

test("queued results publish before fetching and clear from local storage", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(viewports[1]);
  const runtime = collectRuntimeErrors(page);
  await installBackendConfig(page);
  const api = await installApiHarness(page);
  const eventGate = api.holdNextEvent();

  await preparePage(page, { queue: [createQueuedSubmission()] });
  await eventGate.started.promise;
  const stats = await openStatsWindow(page, "minesweeper");

  await expectSyncState(stats, {
    busy: true,
    buttonDisabled: true,
    buttonLabel: "Game stats refresh unavailable for Minesweeper",
    message: "Publishing saved results...",
  });
  await expect(stats.status).toHaveAttribute(
    "aria-label",
    "Publishing saved results..."
  );
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
  await expectNoHorizontalOverflow(stats);
  await page.screenshot({ path: testInfo.outputPath("publishing-queued-result.png") });

  eventGate.release.resolve();
  await expectSyncState(stats, {
    busy: false,
    buttonDisabled: false,
    buttonLabel: "Refresh Minesweeper stats",
    message: "Global stats are up to date.",
  });
  expect(api.eventRequests).toHaveLength(1);
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "[]"), GAME_STATS_SYNC_QUEUE_STORAGE_KEY)
    )
    .toEqual([]);
  expectNoUnexpectedRuntimeErrors(runtime);
});

test("visible game windows share one coalesced manual refresh", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(viewports[1]);
  const runtime = collectRuntimeErrors(page);
  await installBackendConfig(page);
  const api = await installApiHarness(page);
  await preparePage(page);
  const minesweeper = await openStatsWindow(page, "minesweeper");
  await expect(minesweeper.status).toHaveText("Global stats are up to date.");
  const solitaire = await openStatsWindow(page, "solitaire", { programmatic: true });
  await expect(solitaire.status).toHaveText("Global stats are up to date.");
  const visibleLiveRegions = page.locator(
    '[data-game-stats-window]:visible [data-game-stats-sync-status]'
  );
  await expect(visibleLiveRegions).toHaveCount(2);
  await expect(
    page.locator(
      '[data-game-stats-window]:visible [data-game-stats-sync-status][aria-live="polite"]'
    )
  ).toHaveCount(1);
  await expect(
    page.locator(
      '[data-game-stats-window]:visible [data-game-stats-sync-status][aria-live="off"]'
    )
  ).toHaveCount(1);

  const baselineRequestCount = api.statsRequests.length;
  const manualGate = api.holdNextStats();
  await page.evaluate(() => {
    document.querySelector('[data-game-stats-refresh="minesweeper"]').click();
    document.querySelector('[data-game-stats-refresh="solitaire"]').click();
  });
  await manualGate.started.promise;

  await expectSyncState(minesweeper, {
    busy: true,
    buttonDisabled: true,
    buttonLabel: "Game stats refresh unavailable for Minesweeper",
    message: "Fetching latest stats...",
  });
  await expectSyncState(solitaire, {
    busy: true,
    buttonDisabled: true,
    buttonLabel: "Game stats refresh unavailable for Solitaire",
    message: "Fetching latest stats...",
  });
  expect(api.statsRequests).toHaveLength(baselineRequestCount + 1);
  await expect(page.locator("body")).toHaveClass(/is-custom-cursor-loading/);
  await page.screenshot({ path: testInfo.outputPath("shared-manual-refresh.png") });

  manualGate.release.resolve();
  await expect(minesweeper.status).toHaveText("Global stats are up to date.");
  await expect(solitaire.status).toHaveText("Global stats are up to date.");
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
  await expectNoHorizontalOverflow(minesweeper);
  await expectNoHorizontalOverflow(solitaire);
  expectNoUnexpectedRuntimeErrors(runtime);
});

test("manual request timeout restores retry with exact failure copy", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(viewports[1]);
  const runtime = collectRuntimeErrors(page);
  await installBackendConfig(page);
  const api = await installApiHarness(page);
  await preparePage(page, { apiTimeoutMs: 1000 });
  const stats = await openStatsWindow(page, "minesweeper");
  await expect(stats.status).toHaveText("Global stats are up to date.");

  const baselineRequestCount = api.statsRequests.length;
  const timeoutRequest = api.timeoutNextStats(1400);
  await stats.button.click();
  await timeoutRequest.started.promise;
  await expectSyncState(stats, {
    busy: true,
    buttonDisabled: true,
    buttonLabel: "Game stats refresh unavailable for Minesweeper",
    message: "Fetching latest stats...",
  });
  await expect(page.locator("body")).toHaveClass(/is-custom-cursor-loading/);

  await expectSyncState(stats, {
    busy: false,
    buttonDisabled: false,
    buttonLabel: "Refresh Minesweeper stats",
    message: "Request failed. Try again later.",
  });
  expect(api.statsRequests).toHaveLength(baselineRequestCount + 1);
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
  await expectNoHorizontalOverflow(stats);
  await page.screenshot({ path: testInfo.outputPath("request-timeout-failed.png") });
  expectNoUnexpectedRuntimeErrors(runtime, /ERR_ABORTED|ERR_FAILED|game-stats-refresh\.test/);
});

for (const viewport of viewports) {
  test(`unconfigured backend disables refresh at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    const runtime = collectRuntimeErrors(page);
    await installBackendConfig(page, { configured: false });
    await preparePage(page);
    const stats = await openStatsWindow(page, "minesweeper");

    await expectSyncState(stats, {
      busy: false,
      buttonDisabled: true,
      buttonLabel: "Game stats refresh unavailable for Minesweeper",
      message:
        "Automatic global tracking is not configured yet; local stats stay on this device.",
    });
    await expectNoHorizontalOverflow(stats);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}-unconfigured.png`),
    });
    expectNoUnexpectedRuntimeErrors(runtime);
  });
}

test("authentication action waits, cancel restores focus, and sign-in resumes publish", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(viewports[1]);
  const runtime = collectRuntimeErrors(page);
  await installBackendConfig(page);
  const api = await installApiHarness(page, {
    requireAdministratorProof: true,
  });
  await preparePage(page, {
    queue: [createQueuedSubmission(ADMINISTRATOR_PROFILE)],
  });
  const stats = await openStatsWindow(page, "minesweeper");

  await expectSyncState(stats, {
    busy: false,
    buttonDisabled: false,
    buttonLabel: "Sign in as Administrator to sync Minesweeper stats",
    message: "Sign in as Administrator to publish your verified Rohin result.",
  });
  await stats.button.click();
  const administratorWindow = page.locator("#administrator-window");
  await expect(administratorWindow).toBeVisible();
  await expect(page.locator("#administrator-username")).toBeFocused();
  await expectSyncState(stats, {
    busy: true,
    buttonDisabled: true,
    buttonLabel: "Game stats refresh unavailable for Minesweeper",
    message: "Waiting for authentication...",
  });
  await expect(stats.status).toHaveAttribute(
    "aria-label",
    "Waiting for authentication..."
  );
  await expect(page.locator("body")).toHaveClass(/is-custom-cursor-loading/);
  await page.screenshot({ path: testInfo.outputPath("waiting-for-authentication.png") });

  await administratorWindow.getByRole("button", { name: "Close" }).click();
  await expect(administratorWindow).toBeHidden();
  await expectSyncState(stats, {
    busy: false,
    buttonDisabled: false,
    buttonLabel: "Sign in as Administrator to sync Minesweeper stats",
    message: "Sign in as Administrator to publish your verified Rohin result.",
  });
  await expect(stats.button).toBeFocused();
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);

  await stats.button.click();
  await expect(administratorWindow).toBeVisible();
  await page.locator("#administrator-username").fill("administrator");
  await page.locator("#administrator-password").fill("password");
  await page.locator("#administrator-sign-in").click();

  await expect(page.locator("#administrator-alert-window")).toBeVisible();
  await expect
    .poll(
      () =>
        api.eventRequests.filter(
          (request) => request.authorization === `Bearer ${ADMINISTRATOR_PROOF}`
        ).length
    )
    .toBe(1);
  await expectSyncState(stats, {
    busy: false,
    buttonDisabled: false,
    buttonLabel: "Refresh Minesweeper stats",
    message: "Global stats are up to date.",
  });
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
  expect(api.signInRequests).toEqual([
    { username: "administrator", password: "password" },
  ]);
  await expectNoHorizontalOverflow(stats);
  await page.screenshot({
    path: testInfo.outputPath("administrator-sign-in-resumed.png"),
  });
  expectNoUnexpectedRuntimeErrors(runtime, /403 \(Forbidden\)/);
});

test("closing Administrator sign-in invalidates a delayed successful response", async ({
  page,
}, testInfo) => {
  await page.setViewportSize(viewports[1]);
  const runtime = collectRuntimeErrors(page);
  await installBackendConfig(page);
  const api = await installApiHarness(page, {
    requireAdministratorProof: true,
  });
  const delayedSignIn = api.holdNextSignIn();
  const originalProfile = {
    id: "player-before-delayed-admin",
    name: "Existing Player",
    icon: "assets/app-icons/ico/user_card.ico",
    rerollCount: 0,
  };
  const originalStats = {
    generatedAt: new Date().toISOString(),
    totals: {
      minesweeper: {
        wins: { beginner: 4, intermediate: 0, expert: 0 },
      },
    },
  };
  const originalSnakeHighScores = { 16: 99 };
  await preparePage(page, {
    gameStats: originalStats,
    profile: originalProfile,
    queue: [createQueuedSubmission(ADMINISTRATOR_PROFILE)],
    snakeHighScores: originalSnakeHighScores,
  });
  const stats = await openStatsWindow(page, "minesweeper");
  await expect(stats.status).toHaveText(
    "Sign in as Administrator to publish your verified Rohin result."
  );

  await stats.button.click();
  const administratorWindow = page.locator("#administrator-window");
  const submit = page.locator("#administrator-sign-in");
  await expect(administratorWindow).toBeVisible();
  await page.locator("#administrator-username").fill("administrator");
  await page.locator("#administrator-password").fill("password");
  await submit.click();
  await delayedSignIn.started.promise;
  await expect(submit).toBeDisabled();

  await administratorWindow.getByRole("button", { name: "Close" }).click();
  await expect(administratorWindow).toBeHidden();
  delayedSignIn.release.resolve();
  await page.waitForTimeout(250);

  const stateAfterLateSuccess = await page.evaluate(
    ({
      administratorProofStorageKey,
      gameStatsStorageKey,
      profileStorageKey,
      snakeHighScoreKey,
    }) => ({
      gameStats: JSON.parse(localStorage.getItem(gameStatsStorageKey) || "null"),
      profile: JSON.parse(localStorage.getItem(profileStorageKey) || "null"),
      proof: sessionStorage.getItem(administratorProofStorageKey),
      snakeHighScores: JSON.parse(
        localStorage.getItem(snakeHighScoreKey) || "null"
      ),
    }),
    {
      administratorProofStorageKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
      gameStatsStorageKey: GAME_STATS_STORAGE_KEY,
      profileStorageKey: PROFILE_STORAGE_KEY,
      snakeHighScoreKey: SNAKE_HIGH_SCORE_KEY,
    }
  );
  expect(stateAfterLateSuccess.profile).toEqual(originalProfile);
  expect(stateAfterLateSuccess.gameStats.totals.minesweeper.wins.beginner).toBe(4);
  expect(stateAfterLateSuccess.snakeHighScores).toEqual(originalSnakeHighScores);
  expect(stateAfterLateSuccess.proof).toBeNull();
  await expect(page.locator("#administrator-alert-window")).toBeHidden();
  await expect(submit).toBeEnabled();
  await expect(stats.status).toHaveText(
    "Sign in as Administrator to publish your verified Rohin result."
  );

  await stats.button.click();
  await expect(administratorWindow).toBeVisible();
  await expect(submit).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath("delayed-sign-in-cancelled-and-reopened.png"),
  });
  expectNoUnexpectedRuntimeErrors(
    runtime,
    /403 \(Forbidden\)|ERR_ABORTED|ERR_FAILED|game-stats-refresh\.test/
  );
});
