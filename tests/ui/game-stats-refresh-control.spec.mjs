import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import { consumeDiagnostics, installGameStatsBackend, settleFrames } from "./helpers/rendered-site.mjs";
import { installIssuedGameIssuance } from "./helpers/verified-game-session.mjs";

const API_BASE_URL = "https://game-stats-refresh.test";
const SIGN_IN_URL = `${API_BASE_URL}/administrator/sign-in`;
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
/** The publish the Worker refuses until an Administrator proof arrives. */
const REJECTED_EVENT = Object.freeze({
  consoleErrors: ["status of 403 (Forbidden)"],
  errorResponses: [`403 ${API_BASE_URL}/events`],
});

/**
 * The line in the sign-in submit handler that drops an answer belonging to an
 * attempt the visitor has since dismissed.
 */
const STALE_ATTEMPT_GUARD = "if (signInAttemptId !== administratorSignInAttemptId) return;";

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

const installBackendConfig = (page, { configured = true } = {}) =>
  installGameStatsBackend(page, {
    apiBaseUrl: configured ? API_BASE_URL : "",
    buildVersion: configured ? `sha256-${"c".repeat(64)}` : "",
  });

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
  const signInFailureStatuses = [];

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
      const failureStatus = signInFailureStatuses.shift();
      if (failureStatus) {
        await route.fulfill({
          status: failureStatus,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            error: "Authentication service unavailable",
          }),
        });
        return;
      }
      const answered = route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          profile: ADMINISTRATOR_PROFILE,
          proof: ADMINISTRATOR_PROOF,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      });
      // Only a held answer can outlive its request: closing the sign-in window
      // aborts the fetch, and there is then nothing left to answer.
      await (gate ? answered.catch(() => undefined) : answered);
      gate?.settled.resolve();
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Unexpected test route" }),
    });
  });

  // Registered after the catch-all above, so it answers first: opening a game
  // asks the server for a board, and this spec is about the refresh control.
  await installIssuedGameIssuance(page, {
    apiBaseUrl: API_BASE_URL,
    games: ["solitaire", "sudoku"],
  });

  return {
    eventRequests,
    failNextSignIn(status = 503) {
      signInFailureStatuses.push(status);
    },
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
      const gate = {
        release: createDeferred(),
        // Resolves once the harness has finished answering. It says nothing
        // about whether the page was still listening; the request's own
        // outcome does.
        settled: createDeferred(),
        started: createDeferred(),
      };
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
          buttonIsCompact: buttonBounds.width <= 24.5,
          buttonDoesNotExpandRow: buttonBounds.height <= statusBounds.height + 1,
        };
      })
    )
    .toEqual({
      documentOverflows: false,
      rowOverflows: false,
      statusStartsInsideRow: true,
      statusEndsBeforeButton: true,
      buttonEndsInsideRow: true,
      buttonIsCompact: true,
      buttonDoesNotExpandRow: true,
    });
};

for (const viewport of viewports) {
  test(`initial automatic sync, ready, and manual refresh at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
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

    manualGate.release.resolve();
    await expectSyncState(stats, {
      busy: false,
      buttonDisabled: false,
      buttonLabel: "Refresh Minesweeper stats",
      message: "Global stats are up to date.",
    });
    await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
    await expectNoHorizontalOverflow(stats);
  });
}

test("queued results publish before fetching and clear from local storage", async ({
  page,
}) => {
  await page.setViewportSize(viewports[1]);
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
});

test("visible game windows share one coalesced manual refresh", async ({
  page,
}) => {
  await page.setViewportSize(viewports[1]);
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

  manualGate.release.resolve();
  await expect(minesweeper.status).toHaveText("Global stats are up to date.");
  await expect(solitaire.status).toHaveText("Global stats are up to date.");
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
  await expectNoHorizontalOverflow(minesweeper);
  await expectNoHorizontalOverflow(solitaire);
});

test("manual request timeout restores retry with exact failure copy", async ({
  page,
}) => {
  await page.setViewportSize(viewports[1]);
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
});

for (const viewport of viewports) {
  test(`unconfigured backend disables refresh at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
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
  });
}

test("required authentication opens automatically, cancel restores focus, and sign-in resumes publish", async ({
  diagnostics,
  page,
}) => {
  await page.setViewportSize(viewports[1]);
  await installBackendConfig(page);
  const api = await installApiHarness(page, {
    requireAdministratorProof: true,
  });
  const rejectedEvent = api.holdNextEvent();
  await preparePage(page, {
    queue: [createQueuedSubmission(ADMINISTRATOR_PROFILE)],
  });
  await rejectedEvent.started.promise;
  await expect(page.locator("#administrator-window")).toBeHidden();
  rejectedEvent.release.resolve();
  const administratorWindow = page.locator("#administrator-window");
  await expect(administratorWindow).toBeVisible();
  await expect(administratorWindow).not.toHaveClass(/is-opening/);
  await expect(page.locator("#administrator-username")).toBeFocused();
  await expect(administratorWindow).toHaveCSS("z-index", "999999");
  await expect(page.locator(".window-stack")).toHaveCSS("z-index", "999999");
  expect(api.eventRequests).toHaveLength(1);
  expect(api.eventRequests[0].authorization).toBe("");
  await expect
    .poll(() =>
      page.evaluate(
        (queueKey) => JSON.parse(localStorage.getItem(queueKey) || "[]").length,
        GAME_STATS_SYNC_QUEUE_STORAGE_KEY
      )
    )
    .toBe(1);

  const stats = await openStatsWindow(page, "minesweeper", {
    programmatic: true,
  });
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
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);

  await administratorWindow.getByRole("button", { name: "Close" }).click();
  await expect(administratorWindow).toBeHidden();
  await expect(page.locator(".window-stack")).toHaveCSS("z-index", "2");
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
  await page.locator("#administrator-username").fill("test-only-administrator");
  await page.locator("#administrator-password").fill("test-only-password");
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
    { username: "test-only-administrator", password: "test-only-password" },
  ]);
  await expectNoHorizontalOverflow(stats);
  consumeDiagnostics(diagnostics, REJECTED_EVENT);
});

test("Administrator request failure stays retryable and restores refresh focus", async ({
  diagnostics,
  page,
}) => {
  await page.setViewportSize(viewports[1]);
  await installBackendConfig(page);
  const api = await installApiHarness(page, {
    requireAdministratorProof: true,
  });
  api.failNextSignIn(503);
  const rejectedEvent = api.holdNextEvent();
  await preparePage(page, {
    queue: [createQueuedSubmission(ADMINISTRATOR_PROFILE)],
  });
  await rejectedEvent.started.promise;
  rejectedEvent.release.resolve();
  const administratorWindow = page.locator("#administrator-window");
  const username = page.locator("#administrator-username");
  const password = page.locator("#administrator-password");
  const submit = page.locator("#administrator-sign-in");
  await expect(administratorWindow).toBeVisible();
  await expect(username).toBeFocused();
  const stats = await openStatsWindow(page, "minesweeper", {
    programmatic: true,
  });
  await expectSyncState(stats, {
    busy: true,
    buttonDisabled: true,
    buttonLabel: "Game stats refresh unavailable for Minesweeper",
    message: "Waiting for authentication...",
  });
  await username.fill("test-only-administrator");
  await password.fill("test-only-password");
  await submit.click();

  await expect(administratorWindow).toBeHidden();
  await expectSyncState(stats, {
    busy: false,
    buttonDisabled: false,
    buttonLabel: "Sign in as Administrator to sync Minesweeper stats",
    message: "Request failed. Try again later.",
  });
  await expect(stats.status).toHaveAttribute(
    "data-game-stats-sync-state",
    "auth-request-failed"
  );
  await expect(stats.button).toHaveAttribute(
    "data-game-stats-action",
    "authenticate"
  );
  await expect(stats.button).toBeFocused();
  await expect(submit).toBeEnabled();
  await expect(password).toHaveValue("");
  await expect(page.locator("#administrator-alert-window")).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(/is-custom-cursor-loading/);
  await expectNoHorizontalOverflow(stats);

  await stats.button.click();
  await expect(administratorWindow).toBeVisible();
  await expect(username).toBeFocused();
  await expect(submit).toBeEnabled();
  await expectSyncState(stats, {
    busy: true,
    buttonDisabled: true,
    buttonLabel: "Game stats refresh unavailable for Minesweeper",
    message: "Waiting for authentication...",
  });
  expect(api.signInRequests).toEqual([
    { username: "test-only-administrator", password: "test-only-password" },
  ]);
  consumeDiagnostics(diagnostics, {
    consoleErrors: [
      ...REJECTED_EVENT.consoleErrors,
      "status of 503 (Service Unavailable)",
    ],
    errorResponses: [
      ...REJECTED_EVENT.errorResponses,
      `503 ${API_BASE_URL}/administrator/sign-in`,
    ],
  });
});

/** Progress a visitor already has, which a discarded sign-in must leave alone. */
const createSavedProgress = () => ({
  gameStats: {
    generatedAt: new Date().toISOString(),
    totals: {
      minesweeper: {
        wins: { beginner: 4, intermediate: 0, expert: 0 },
      },
    },
  },
  profile: {
    id: "player-before-delayed-admin",
    name: "Existing Player",
    icon: "assets/app-icons/ico/user_card.ico",
    rerollCount: 0,
  },
  snakeHighScores: { 16: 99 },
});

/** Everything a completed Administrator sign-in writes to browser storage. */
const readPersistedState = (page) =>
  page.evaluate(
    ({
      administratorProofStorageKey,
      gameStatsStorageKey,
      profileStorageKey,
      queueStorageKey,
      snakeHighScoreKey,
    }) => ({
      gameStats: JSON.parse(localStorage.getItem(gameStatsStorageKey) || "null"),
      profile: JSON.parse(localStorage.getItem(profileStorageKey) || "null"),
      proof: sessionStorage.getItem(administratorProofStorageKey),
      queue: JSON.parse(localStorage.getItem(queueStorageKey) || "null"),
      snakeHighScores: JSON.parse(localStorage.getItem(snakeHighScoreKey) || "null"),
    }),
    {
      administratorProofStorageKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
      gameStatsStorageKey: GAME_STATS_STORAGE_KEY,
      profileStorageKey: PROFILE_STORAGE_KEY,
      queueStorageKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      snakeHighScoreKey: SNAKE_HIGH_SCORE_KEY,
    }
  );

/**
 * Opens Home with a rejected Administrator publish, so the sign-in window is
 * up and the stats window is waiting on it, then submits credentials.
 *
 * @param {import("@playwright/test").Page} page
 * @param {(api: object) => unknown} beforeLoad setup that must precede navigation.
 */
const submitAdministratorSignIn = async (page, beforeLoad) => {
  await page.setViewportSize(viewports[1]);
  await installBackendConfig(page);
  const api = await installApiHarness(page, {
    requireAdministratorProof: true,
  });
  const rejectedEvent = api.holdNextEvent();
  const saved = createSavedProgress();
  await beforeLoad(api);
  await preparePage(page, {
    ...saved,
    queue: [createQueuedSubmission(ADMINISTRATOR_PROFILE)],
  });
  await rejectedEvent.started.promise;
  rejectedEvent.release.resolve();
  const administratorWindow = page.locator("#administrator-window");
  const submit = page.locator("#administrator-sign-in");
  await expect(administratorWindow).toBeVisible();
  await expect(page.locator("#administrator-username")).toBeFocused();
  const stats = await openStatsWindow(page, "minesweeper", {
    programmatic: true,
  });
  await expectSyncState(stats, {
    busy: true,
    buttonDisabled: true,
    buttonLabel: "Game stats refresh unavailable for Minesweeper",
    message: "Waiting for authentication...",
  });
  await page.locator("#administrator-username").fill("test-only-administrator");
  await page.locator("#administrator-password").fill("test-only-password");
  await submit.click();
  return { administratorWindow, api, saved, stats, submit };
};

const dismissAdministratorSignIn = async (administratorWindow) => {
  await administratorWindow.getByRole("button", { name: "Close" }).click();
  await expect(administratorWindow).toBeHidden();
};

/** The visitor's own progress is intact and no Administrator proof is held. */
const expectProgressUntouched = (persisted, saved) => {
  expect(persisted.profile).toEqual(saved.profile);
  expect(persisted.gameStats.totals.minesweeper.wins.beginner).toBe(4);
  expect(persisted.snakeHighScores).toEqual(saved.snakeHighScores);
  expect(persisted.queue).toHaveLength(1);
  expect(persisted.proof).toBeNull();
};

/** The stats window is back to asking for a sign-in it has not received. */
const expectAuthenticationStillRequired = async (page, { stats, submit }) => {
  await expect(page.locator("#administrator-alert-window")).toBeHidden();
  await expect(submit).toBeEnabled();
  await expectSyncState(stats, {
    busy: false,
    buttonDisabled: false,
    buttonLabel: "Sign in as Administrator to sync Minesweeper stats",
    message: "Sign in as Administrator to publish your verified Rohin result.",
  });
  await expect(stats.button).toHaveAttribute("data-game-stats-action", "authenticate");
};

test("closing Administrator sign-in cancels the request in flight", async ({
  diagnostics,
  page,
}) => {
  let delayedSignIn;
  const signIn = await submitAdministratorSignIn(page, (api) => {
    delayedSignIn = api.holdNextSignIn();
  });
  await delayedSignIn.started.promise;
  await expect(signIn.submit).toBeDisabled();

  const cancelled = page.waitForEvent("requestfailed", (request) => request.url() === SIGN_IN_URL);
  await dismissAdministratorSignIn(signIn.administratorWindow);
  // The Worker had not answered, so the page never sees a response at all.
  // The answer that does arrive after dismissal is the next case.
  const abandoned = await cancelled;
  expect(abandoned.failure().errorText).toBe("net::ERR_ABORTED");
  expect(await abandoned.response()).toBeNull();
  delayedSignIn.release.resolve();
  await delayedSignIn.settled.promise;
  await settleFrames(page);

  expectProgressUntouched(await readPersistedState(page), signIn.saved);
  await expectAuthenticationStillRequired(page, signIn);

  await signIn.stats.button.click();
  await expect(signIn.administratorWindow).toBeVisible();
  await expect(signIn.submit).toBeEnabled();
  expect(signIn.api.signInRequests).toHaveLength(1);
  consumeDiagnostics(diagnostics, REJECTED_EVENT);
});

/**
 * Parks the page's decoded Administrator sign-in answer. The fetch has already
 * resolved with its real status and the body has been read and parsed; only
 * the hand-over of the parsed payload waits. `deliver()` releases it and
 * resolves a task later, once everything the payload wakes has run.
 *
 * @param {import("@playwright/test").Page} page
 */
const holdDecodedSignIn = (page) =>
  page.addInitScript((signInUrl) => {
    const nativeJson = Response.prototype.json;
    const received = Promise.withResolvers();
    const released = Promise.withResolvers();
    const delivered = Promise.withResolvers();
    Response.prototype.json = function heldJson() {
      const decoded = nativeJson.call(this);
      if (this.url !== signInUrl) return decoded;
      return decoded.then(async (body) => {
        received.resolve({ body, ok: this.ok, status: this.status });
        await released.promise;
        setTimeout(delivered.resolve, 0);
        return body;
      });
    };
    window.heldSignIn = {
      received: received.promise,
      deliver: () => {
        released.resolve();
        return delivered.promise;
      },
    };
  }, SIGN_IN_URL);

/**
 * Lets the Worker answer a sign-in successfully, dismisses the window while the
 * page is still holding the decoded answer, and only then hands it over.
 *
 * @param {import("@playwright/test").Page} page
 */
const deliverSignInAfterDismissal = async (page) => {
  const answered = page.waitForResponse(SIGN_IN_URL);
  const signIn = await submitAdministratorSignIn(page, () => holdDecodedSignIn(page));
  const response = await answered;
  // Receipt: the Worker's 200 reached the page whole and was parsed there.
  expect(response.status()).toBe(200);
  await response.finished();
  expect(response.request().failure()).toBeNull();
  expect(await page.evaluate(() => window.heldSignIn.received)).toEqual({
    body: {
      ok: true,
      profile: ADMINISTRATOR_PROFILE,
      proof: ADMINISTRATOR_PROOF,
      expiresAt: expect.any(String),
    },
    ok: true,
    status: 200,
  });
  await expect(signIn.submit).toBeDisabled();

  await dismissAdministratorSignIn(signIn.administratorWindow);
  const beforeDelivery = await readPersistedState(page);
  expectProgressUntouched(beforeDelivery, signIn.saved);
  await page.evaluate(() => window.heldSignIn.deliver());
  await settleFrames(page);
  return { ...signIn, beforeDelivery };
};

test("a successful Administrator answer that lands after dismissal is discarded", async ({
  diagnostics,
  page,
}) => {
  const signIn = await deliverSignInAfterDismissal(page);

  expect(await readPersistedState(page)).toEqual(signIn.beforeDelivery);
  await expect(signIn.administratorWindow).toBeHidden();
  await expectAuthenticationStillRequired(page, signIn);
  expect(signIn.api.signInRequests).toHaveLength(1);
  // The protected result was offered once, without a proof, and never again.
  expect(signIn.api.eventRequests.map((request) => request.authorization)).toEqual([""]);
  consumeDiagnostics(diagnostics, REJECTED_EVENT);
});

test("without the stale-attempt guard the same late answer is adopted", async ({
  diagnostics,
  page,
}) => {
  // Served from memory only. The case above differs from this one by nothing
  // but the guard, so this is the proof that it reaches the guard at all.
  await routeHomeScript(page, "gameStats", (source) => {
    expect(source.split(STALE_ATTEMPT_GUARD)).toHaveLength(2);
    return source.replace(STALE_ATTEMPT_GUARD, "");
  });
  const signIn = await deliverSignInAfterDismissal(page);

  await expect(page.locator("#administrator-alert-window")).toBeVisible();
  await expect
    .poll(() => signIn.api.eventRequests.map((request) => request.authorization))
    .toEqual(["", `Bearer ${ADMINISTRATOR_PROOF}`]);
  await expect(signIn.stats.status).toHaveText("Global stats are up to date.");
  const adopted = await readPersistedState(page);
  expect(adopted.proof).toContain(ADMINISTRATOR_PROOF);
  expect(adopted.profile).toMatchObject({ id: ADMINISTRATOR_PROFILE.id });
  expect(adopted.queue).toEqual([]);
  consumeDiagnostics(diagnostics, REJECTED_EVENT);
});
