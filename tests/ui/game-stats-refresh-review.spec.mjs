import { expect, test } from "./fixtures.mjs";

const reviewStates = Object.freeze([
  {
    id: "initial",
    message: "Global stats will sync automatically.",
    action: "refresh",
    busy: false,
    cursor: "off",
    label: "Refresh Minesweeper stats",
    disabled: false,
  },
  {
    id: "fetching",
    message: "Fetching latest stats...",
    action: "none",
    busy: true,
    cursor: "manual-only",
    label: "Game stats refresh unavailable for Minesweeper",
    disabled: true,
  },
  {
    id: "publishing",
    message: "Publishing saved results...",
    action: "none",
    busy: true,
    cursor: "manual-only",
    label: "Game stats refresh unavailable for Minesweeper",
    disabled: true,
  },
  {
    id: "auth-required",
    message: "Sign in as Administrator to publish your verified Rohin result.",
    action: "authenticate",
    busy: false,
    cursor: "off",
    label: "Sign in as Administrator to sync Minesweeper stats",
    disabled: false,
  },
  {
    id: "auth-waiting",
    message: "Waiting for authentication...",
    action: "none",
    busy: true,
    cursor: "on",
    label: "Game stats refresh unavailable for Minesweeper",
    disabled: true,
  },
  {
    id: "ready",
    message: "Global stats are up to date.",
    action: "refresh",
    busy: false,
    cursor: "off",
    label: "Refresh Minesweeper stats",
    disabled: false,
  },
  {
    id: "request-failed",
    message: "Request failed. Try again later.",
    action: "refresh",
    busy: false,
    cursor: "off",
    label: "Refresh Minesweeper stats",
    disabled: false,
  },
  {
    id: "auth-request-failed",
    message: "Request failed. Try again later.",
    action: "authenticate",
    busy: false,
    cursor: "off",
    label: "Sign in as Administrator to sync Minesweeper stats",
    disabled: false,
  },
  {
    id: "unconfigured",
    message:
      "Automatic global tracking is not configured yet; local stats stay on this device.",
    action: "none",
    busy: false,
    cursor: "off",
    label: "Game stats refresh unavailable for Minesweeper",
    disabled: true,
  },
  {
    id: "ready-missing-verified-session",
    message:
      "Local stats are saved. A result without a verified game session cannot be published.",
    action: "refresh",
    busy: false,
    cursor: "off",
    label: "Refresh Minesweeper stats",
    disabled: false,
  },
  {
    id: "ready-verification-rejected",
    message:
      "Local stats are saved, but a result could not pass server verification.",
    action: "refresh",
    busy: false,
    cursor: "off",
    label: "Refresh Minesweeper stats",
    disabled: false,
  },
  {
    id: "ready-started-without-session",
    message:
      "Local stats are saved. This result started without a verified game session.",
    action: "refresh",
    busy: false,
    cursor: "off",
    label: "Refresh Minesweeper stats",
    disabled: false,
  },
  {
    id: "ready-local-reset",
    message:
      "Local progress was reset. Published and queued leaderboard results remain available.",
    action: "refresh",
    busy: false,
    cursor: "off",
    label: "Refresh Minesweeper stats",
    disabled: false,
  },
]);

test("review page contains the complete exact status/action matrix", async ({
  page,
}) => {
  await page.goto(
    "/docs/validation/assets/game-stats-refresh-review.html"
  );

  for (const state of reviewStates) {
    const card = page.locator(`[data-review-state="${state.id}"]`);
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("data-action", state.action);
    await expect(card).toHaveAttribute("data-busy", String(state.busy));
    await expect(card).toHaveAttribute("data-custom-cursor", state.cursor);

    const status = card.locator(".sync-status");
    const button = card.locator(".refresh-button");
    await expect(status).toHaveText(state.message);
    await expect(button).toHaveAttribute("aria-label", state.label);
    await expect(button).toHaveAttribute("aria-busy", String(state.busy));
    if (state.disabled) {
      await expect(button).toBeDisabled();
    } else {
      await expect(button).toBeEnabled();
    }
  }

  await expect(page.locator(".animated-ellipsis")).toHaveCount(3);
  await expect(
    page.locator('.refresh-button[aria-busy="true"] .button-loading-dots')
  ).toHaveCount(3);
  await expect
    .poll(() =>
      page.locator(".refresh-button img").first().evaluate(
        (image) => image.complete && image.naturalWidth > 0
      )
    )
    .toBe(true);
});

test("review page captures success, rank, and Sudoku edge cases", async ({
  page,
}) => {
  await page.goto(
    "/docs/validation/assets/game-stats-refresh-review.html"
  );

  const success = page.locator(
    '[data-review-state="administrator-success"]'
  );
  const popup = success.locator('[role="dialog"]');
  await expect(popup.locator(".popup-message p")).toHaveText(
    "Administrator access granted."
  );
  await expect(popup.locator(".popup-message p")).toHaveCount(1);
  await expect(popup.locator(".popup-message img")).toHaveAttribute(
    "src",
    "../../../assets/app-icons/ico/msg_warning.ico"
  );
  await expect(popup.locator(".popup-actions button")).toHaveCount(1);
  await expect(popup.locator(".popup-actions button")).toHaveText("OK");
  await expect
    .poll(async () => {
      const actions = await popup.locator(".popup-actions").boundingBox();
      const ok = await popup.locator(".popup-actions button").boundingBox();
      return Boolean(
        actions &&
          ok &&
          Math.abs(actions.x + actions.width - (ok.x + ok.width)) <= 1
      );
    })
    .toBe(true);
  await expect
    .poll(() =>
      popup.locator(".popup-message img").evaluate(
        (image) => image.complete && image.naturalWidth > 0
      )
    )
    .toBe(true);

  const multiplayer = page.locator(
    '[data-review-state="multiplayer-rank"]'
  );
  await expect(multiplayer.locator('[aria-label="Global Top 3"] .score-row')).toHaveCount(
    3
  );
  await expect(multiplayer).toContainText("Administrator");
  await expect(multiplayer).toContainText("#5");
  await expect(multiplayer).toContainText("#12");
  await expect(multiplayer).toContainText("#—");

  const sudoku = page.locator('[data-review-state="sudoku-empty"]');
  await expect(sudoku.locator(".sudoku-placeholder strong")).toHaveCount(6);
  await expect(sudoku.locator(".sudoku-placeholder strong")).toHaveText([
    "99:99",
    "99:99",
    "99:99",
    "99:99",
    "99:99",
    "99:99",
  ]);
});

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]) {
  test(`review page has no horizontal overflow at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto(
      "/docs/validation/assets/game-stats-refresh-review.html"
    );
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("[data-review-state]")).toHaveCount(16);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          body: document.body.scrollWidth <= document.body.clientWidth,
          document:
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
          cards: Array.from(document.querySelectorAll("[data-review-state]")).every(
            (card) => card.scrollWidth <= card.clientWidth
          ),
        }))
      )
      .toEqual({ body: true, cards: true, document: true });
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`${viewport.name}-state-review.png`),
    });
  });
}

test("review dots become static under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    "/docs/validation/assets/game-stats-refresh-review.html"
  );
  await expect
    .poll(() =>
      page.locator(".animated-ellipsis span").first().evaluate(
        (dot) => getComputedStyle(dot).animationName
      )
    )
    .toBe("none");
});
