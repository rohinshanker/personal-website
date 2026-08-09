import { expect, test } from "./fixtures.mjs";

const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";
const GAME_STATS_SYNC_QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";
const ADMINISTRATOR_PROOF_STORAGE_KEY = "personalSiteAdministratorProofV1";
const SNAKE_HIGH_SCORE_KEY = "personalSiteSnakeHighScores";
const SUDOKU_STORAGE_KEY = "personalSiteSudokuStateV1";
const ADMINISTRATOR_PROFILE = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
  rerollCount: 0,
});
const ADMINISTRATOR_EVENT_PROFILE = Object.freeze({
  id: ADMINISTRATOR_PROFILE.id,
  name: ADMINISTRATOR_PROFILE.name,
  icon: ADMINISTRATOR_PROFILE.icon,
});

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
]);

const API_BASE_URL = "https://game-stats.test";
const administratorProof = `${"a".repeat(32)}.${"b".repeat(32)}`;

const configureAdministratorApi = async (page, signInStatus, { onEvent } = {}) => {
  await page.route("**/scripts/home/game-stats-backend.js*", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "${API_BASE_URL}", buildVersion: "sha256-${"a".repeat(64)}" });`,
    });
  });
  await page.route(`${API_BASE_URL}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/administrator/sign-in") {
      const credentials = JSON.parse(request.postData() || "{}");
      expect(credentials).toEqual({ username: "administrator", password: "password" });
      if (signInStatus === "success") {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            profile: {
              id: ADMINISTRATOR_PROFILE.id,
              name: ADMINISTRATOR_PROFILE.name,
              icon: ADMINISTRATOR_PROFILE.icon,
            },
            proof: administratorProof,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          }),
        });
        return;
      }
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Invalid administrator credentials" }),
      });
      return;
    }
    if (url.pathname === "/events") {
      const publishedEvent = {
        authorization: request.headers().authorization || "",
        body: JSON.parse(request.postData() || "{}"),
      };
      onEvent?.(publishedEvent);
      const unknownProfileField = Object.keys(
        publishedEvent.body.event?.profile || {}
      ).find((field) => !["id", "name", "icon"].includes(field));
      if (unknownProfileField) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            error: `Unknown profile field: ${unknownProfileField}`,
          }),
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
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({}) });
  });
};

const preparePage = async (page, signInStatus, { seedLocalState = true, ...apiOptions } = {}) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999999;
  });
  if (seedLocalState) {
    await page.addInitScript(
      ({ profileStorageKey, gameStatsStorageKey, snakeHighScoreKey, sudokuStorageKey }) => {
        localStorage.setItem(
          profileStorageKey,
          JSON.stringify({
            id: "player-before-administrator",
            name: "Before Administrator",
            icon: "assets/app-icons/ico/user_card.ico",
            rerollCount: 0,
          })
        );
        localStorage.setItem(
          gameStatsStorageKey,
          JSON.stringify({ totals: { minesweeper: { wins: { beginner: 4 } } } })
        );
        localStorage.setItem(snakeHighScoreKey, JSON.stringify({ 16: 99 }));
        localStorage.setItem(
          sudokuStorageKey,
          JSON.stringify({
            version: 1,
            difficulty: "easy",
            values: "9".repeat(81),
            elapsedSeconds: 123,
          })
        );
      },
      {
        profileStorageKey: PROFILE_STORAGE_KEY,
        gameStatsStorageKey: GAME_STATS_STORAGE_KEY,
        snakeHighScoreKey: SNAKE_HIGH_SCORE_KEY,
        sudokuStorageKey: SUDOKU_STORAGE_KEY,
      }
    );
  }
  await configureAdministratorApi(page, signInStatus, apiOptions);
  await page.goto("/home.html");
  await page.locator("#about-window").evaluate((element) => {
    element.classList.remove("is-opening", "is-closing");
    element.classList.add("is-hidden");
    element.setAttribute("aria-hidden", "true");
  });
  await page.evaluate(() => {
    const controller = window.rohinAdminControlsController;
    if (!controller) return;
    window.rohinAdminControlsController = Object.freeze({
      ...controller,
      shouldPauseNaturalEvents: () => true,
    });
  });
};

const finishWindowAnimation = async (win, animationName) => {
  await win.dispatchEvent("animationend", { animationName });
};

const openAdministratorWindow = async (page) => {
  const cursorSettingsButton = page
    .getByRole("toolbar", { name: "Taskbar" })
    .getByRole("button", { name: "Cursor Settings" });
  await cursorSettingsButton.scrollIntoViewIfNeeded();
  await cursorSettingsButton.click();
  const cursorWindow = page.locator('[data-app-window="cursor"]');
  await expect(cursorWindow).toBeVisible();

  const administratorButton = cursorWindow.locator("#cursor-settings-administrator");
  await expect(administratorButton).toHaveAttribute("aria-label", "Administrator sign in");
  await administratorButton.click();
  const windowElement = page.locator("#administrator-window");
  await expect(windowElement).toBeVisible();
  await expect(page.locator("#administrator-username")).toBeFocused();
  return windowElement;
};

for (const viewport of viewports) {
  test(`Administrator sign-in succeeds without overflow at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await preparePage(page, "success");
    const signInWindow = await openAdministratorWindow(page);

    await page.locator("#administrator-username").fill("administrator");
    await page.locator("#administrator-password").fill("password");
    await page.locator("#administrator-sign-in").click();

    await expect(signInWindow).toBeHidden();
    const alertWindow = page.locator("#administrator-alert-window");
    await expect(alertWindow).toBeVisible();
    const alertMessage = alertWindow.locator(".random-alert-message");
    await expect(alertMessage).toHaveText("Administrator access granted.");
    await expect(alertMessage.locator('img[src="assets/app-icons/ico/msg_warning.ico"]')).toBeVisible();
    await expect(alertWindow.locator(".random-alert-actions")).toHaveCSS("justify-content", "flex-end");
    await expect(alertWindow).not.toContainText("Game Progress profile updated to rohin ^.^.");
    await expect(alertWindow).toHaveCSS("z-index", "1000000");
    await expect(page.locator("#administrator-alert-close")).toBeFocused();

    const alertPosition = await alertWindow.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        centerX: bounds.left + bounds.width / 2,
        centerY: bounds.top + bounds.height / 2,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(alertPosition.centerX).toBeCloseTo(alertPosition.viewportWidth / 2, 1);
    expect(alertPosition.centerY).toBeCloseTo(alertPosition.viewportHeight / 2, 1);
    await page.screenshot({ path: testInfo.outputPath("administrator-access-alert.png") });

    await page.locator("#administrator-alert-close").click();
    await expect(alertWindow).toBeHidden();

    const state = await page.evaluate(
      ({
        profileStorageKey,
        gameStatsStorageKey,
        snakeHighScoreKey,
        sudokuStorageKey,
        administratorProofStorageKey,
      }) => ({
        profile: JSON.parse(localStorage.getItem(profileStorageKey)),
        gameStats: JSON.parse(localStorage.getItem(gameStatsStorageKey)),
        snakeScores: localStorage.getItem(snakeHighScoreKey),
        sudokuGame: JSON.parse(localStorage.getItem(sudokuStorageKey) || "null"),
        proof: JSON.parse(sessionStorage.getItem(administratorProofStorageKey)),
        documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
      }),
      {
        profileStorageKey: PROFILE_STORAGE_KEY,
        gameStatsStorageKey: GAME_STATS_STORAGE_KEY,
        snakeHighScoreKey: SNAKE_HIGH_SCORE_KEY,
        sudokuStorageKey: SUDOKU_STORAGE_KEY,
        administratorProofStorageKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
      }
    );
    expect(state.profile).toEqual(ADMINISTRATOR_PROFILE);
    expect(state.gameStats.totals.minesweeper.wins.beginner).toBe(0);
    expect(state.snakeScores).toBeNull();
    expect(state.sudokuGame?.elapsedSeconds ?? 0).toBe(0);
    expect(state.sudokuGame?.values || "").not.toBe("9".repeat(81));
    expect(state.proof.proof).toBe(administratorProof);
    expect(Date.parse(state.proof.expiresAt)).toBeGreaterThan(Date.now());
    expect(state.documentOverflows).toBe(false);

    const adminLauncher = page
      .getByRole("toolbar", { name: "Taskbar" })
      .getByRole("button", { name: "Admin", exact: true });
    await adminLauncher.scrollIntoViewIfNeeded();
    await adminLauncher.click();
    await expect(page.locator("#admin-controls-window")).toBeVisible();
    await expect(page.locator("#admin-controls-stand-in-window")).toBeHidden();
    await expect(page.locator('[data-admin-tab="run"]')).toBeFocused();
  });
}

test("Administrator proof survives a refresh and publishes a verified Rohin result", async ({ page }) => {
  const publishedEvents = [];
  await page.setViewportSize({ width: 1280, height: 800 });
  await preparePage(page, "success", {
    onEvent: (event) => publishedEvents.push(event),
    seedLocalState: false,
  });
  await openAdministratorWindow(page);
  await page.locator("#administrator-username").fill("administrator");
  await page.locator("#administrator-password").fill("password");
  await page.locator("#administrator-sign-in").click();
  await expect(page.locator("#administrator-alert-window")).toBeVisible();

  await page.evaluate(
    ({ queueStorageKey, profile }) => {
      localStorage.setItem(
        queueStorageKey,
        JSON.stringify([
          {
            event: {
              id: "event-rohin-refresh-save-0001",
              game: "minesweeper",
              type: "win",
              occurredAt: new Date().toISOString(),
              difficulty: "beginner",
              metric: 42,
              metricKind: "seconds",
              profile,
            },
            session: {
              id: "session-rohin-refresh-save-0001",
              token: "a".repeat(32),
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
          },
        ])
      );
    },
    { queueStorageKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY, profile: ADMINISTRATOR_PROFILE }
  );
  await page.reload();

  await expect.poll(() => publishedEvents.length).toBe(1);
  expect(publishedEvents[0].authorization).toBe(`Bearer ${administratorProof}`);
  expect(publishedEvents[0].body.event.profile).toEqual(ADMINISTRATOR_EVENT_PROFILE);

  const state = await page.evaluate(
    ({ profileStorageKey, queueStorageKey, proofStorageKey }) => ({
      profile: JSON.parse(localStorage.getItem(profileStorageKey)),
      queuedResults: JSON.parse(localStorage.getItem(queueStorageKey)),
      proof: JSON.parse(sessionStorage.getItem(proofStorageKey)),
    }),
    {
      profileStorageKey: PROFILE_STORAGE_KEY,
      queueStorageKey: GAME_STATS_SYNC_QUEUE_STORAGE_KEY,
      proofStorageKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
    }
  );
  expect(state.profile).toEqual(ADMINISTRATOR_PROFILE);
  expect(state.queuedResults).toEqual([]);
  expect(state.proof.proof).toBe(administratorProof);
});

test("Administrator launch keeps focus when replacing an open access notice", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await preparePage(page, "success");
  const adminLauncher = page
    .getByRole("toolbar", { name: "Taskbar" })
    .getByRole("button", { name: "Admin", exact: true });
  const standIn = page.locator("#admin-controls-stand-in-window");

  await adminLauncher.scrollIntoViewIfNeeded();
  await adminLauncher.click();
  await expect(standIn).toBeVisible();
  await expect(page.locator("#admin-controls-stand-in-ok")).toBeFocused();

  const signInWindow = await openAdministratorWindow(page);
  await page.locator("#administrator-username").fill("administrator");
  await page.locator("#administrator-password").fill("password");
  await page.locator("#administrator-sign-in").click();
  await expect(signInWindow).toBeHidden();
  await page.locator("#administrator-alert-close").click();
  await expect(page.locator("#administrator-alert-window")).toBeHidden();

  await adminLauncher.click();
  await expect(page.locator("#admin-controls-window")).toBeVisible();
  const runTab = page.locator('[data-admin-tab="run"]');
  await expect(runTab).toBeFocused();
  await finishWindowAnimation(standIn, "retro-window-close");
  await expect(standIn).toBeHidden();
  await expect(runTab).toBeFocused();
});

test("Administrator failure closes the sign-in window and never grants access", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await preparePage(page, "failure");
  const signInWindow = await openAdministratorWindow(page);

  await page.locator("#administrator-username").fill("administrator");
  await page.locator("#administrator-password").fill("password");
  await page.locator("#administrator-sign-in").click();

  await expect(signInWindow).toBeHidden();
  await expect(page.locator("#administrator-alert-window")).toBeHidden();
  await expect(page.locator("#administrator-password")).toHaveValue("");
  await expect
    .poll(() =>
      page.evaluate((profileStorageKey) => JSON.parse(localStorage.getItem(profileStorageKey)).name, PROFILE_STORAGE_KEY)
    )
    .toBe("Before Administrator");

  const adminLauncher = page
    .getByRole("toolbar", { name: "Taskbar" })
    .getByRole("button", { name: "Admin", exact: true });
  await adminLauncher.scrollIntoViewIfNeeded();
  await adminLauncher.click();
  await expect(page.locator("#admin-controls-stand-in-window")).toBeVisible();
  await expect(page.locator("#admin-controls-window")).toBeHidden();
});

test("Administrator sign-in stays fully visible when an open desktop window resizes to mobile", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await preparePage(page, "success");
  const signInWindow = await openAdministratorWindow(page);

  await page.setViewportSize({ width: 375, height: 812 });
  await expect
    .poll(() =>
      signInWindow.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          horizontallyContained:
            bounds.left >= 0 && bounds.right <= window.innerWidth,
          verticallyContained:
            bounds.top >= 0 && bounds.bottom <= window.innerHeight,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        };
      })
    )
    .toEqual({
      horizontallyContained: true,
      verticallyContained: true,
      viewport: "375x812",
    });

  const geometry = await signInWindow.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.documentOverflows).toBe(false);
  await expect(page.locator("#administrator-username")).toBeFocused();
  await page.screenshot({
    path: testInfo.outputPath("administrator-resized-desktop-to-mobile.png"),
  });
});
