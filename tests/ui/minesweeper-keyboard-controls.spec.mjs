import { expect, test } from "./fixtures.mjs";

const VIEWPORTS = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const configureOfflineGameStats = (page) =>
  page.route("**/scripts/home/game-stats-backend.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "" });',
    })
  );

const collectRuntimeErrors = (page) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
};

const prepareMinesweeper = async (page, viewport = VIEWPORTS[2]) => {
  const runtimeErrors = collectRuntimeErrors(page);
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await configureOfflineGameStats(page);
  await page.addInitScript(() => {
    Math.random = () => 0.5;
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });

  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await page
    .getByRole("toolbar", { name: "Taskbar" })
    .getByRole("button", { name: "Minesweeper" })
    .click();

  const app = page.locator('[data-app-window="minesweeper"]');
  await expect(app).toBeVisible();
  return { app, runtimeErrors };
};

const expectCellCovered = async (cell) => {
  await expect(cell).not.toHaveClass(/is-revealed|is-flagged|is-question/);
};

test("Help opens a compact Keyboard Controls window with a Wikipedia action", async ({
  page,
}) => {
  const { app, runtimeErrors } = await prepareMinesweeper(page, VIEWPORTS[0]);
  await app.getByRole("button", { name: "Help" }).click();

  const controlsWindow = page.locator('[data-app-window="minesweeper-controls"]');
  await expect(controlsWindow).toBeVisible();
  await expect(controlsWindow).toHaveAccessibleName("Keyboard Controls");
  await expect(controlsWindow).toHaveAccessibleDescription(
    "The current square is the square under your mouse pointer."
  );
  await expect(controlsWindow.getByText("Press S to click the current square.")).toBeVisible();
  await expect(controlsWindow.getByText("Press D to maybe the current square.")).toBeVisible();
  await expect(controlsWindow.getByText("Press F to flag the current square.")).toBeVisible();
  await expect(controlsWindow.locator(".ms-controls-list img")).toHaveCount(3);
  const wikipediaButton = controlsWindow.getByRole("button", {
    name: "Minesweeper Wikipedia",
  });
  await expect(wikipediaButton).toBeFocused();
  expect(await wikipediaButton.evaluate((button) => getComputedStyle(button).backgroundImage)).toContain(
    "help.svg"
  );

  const target = app.locator(".ms-cell").nth(70);
  await target.hover();
  await page.keyboard.press("f");
  await expectCellCovered(target);
  await wikipediaButton.focus();
  await page.keyboard.press("Tab");
  await expect(controlsWindow.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(controlsWindow).toBeHidden();
  await expect(app.getByRole("button", { name: "Help" })).toBeFocused();
  await app.getByRole("button", { name: "Help" }).click();
  await expect(wikipediaButton).toBeFocused();

  const dimensions = await page.evaluate(() => {
    const game = document.querySelector('[data-app-window="minesweeper"]').getBoundingClientRect();
    const controls = document
      .querySelector('[data-app-window="minesweeper-controls"]')
      .getBoundingClientRect();
    return {
      compact: controls.width < game.width && controls.height < game.height,
      contained:
        controls.left >= 0 &&
        controls.right <= window.innerWidth &&
        controls.top >= 0 &&
        controls.bottom <= window.innerHeight,
    };
  });
  expect(dimensions).toEqual({ compact: true, contained: true });

  const openedUrl = await page.evaluate(() => {
    window.__minesweeperOpenedUrl = null;
    window.open = (url) => {
      window.__minesweeperOpenedUrl = String(url);
      return null;
    };
    return window.__minesweeperOpenedUrl;
  });
  expect(openedUrl).toBeNull();
  await wikipediaButton.click();
  await expect
    .poll(() => page.evaluate(() => window.__minesweeperOpenedUrl))
    .toBe("https://en.wikipedia.org/wiki/Minesweeper_(video_game)");

  await controlsWindow.getByRole("button", { name: "Close" }).click();
  await expect(controlsWindow).toBeHidden();
  await expect(app.getByRole("button", { name: "Help" })).toBeFocused();
  await target.hover();
  await page.keyboard.press("f");
  await expect(target).toHaveClass(/is-flagged/);
  await app.getByRole("button", { name: "Help" }).click();
  await expect(controlsWindow).toBeVisible();
  await app.getByRole("button", { name: "Close" }).click();
  await expect(app).toBeHidden();
  await expect(controlsWindow).toBeHidden();
  expect(runtimeErrors.consoleErrors).toEqual([]);
  expect(runtimeErrors.pageErrors).toEqual([]);
});

for (const viewport of VIEWPORTS) {
  test(`S, D, and F control the hovered square at ${viewport.name}`, async ({ page }) => {
    const { app, runtimeErrors } = await prepareMinesweeper(page, viewport);
    const grid = app.locator("#ms-grid");
    const target = grid.locator(".ms-cell").nth(40);

    await expect(grid).toHaveAttribute("aria-keyshortcuts", "S D F");
    await expect(grid).toHaveAttribute("aria-rowcount", "9");
    await expect(grid).toHaveAttribute("aria-colcount", "9");
    await expect(app.locator("#ms-controls-mode")).toHaveValue("keyboard");
    await expect(app.locator("#ms-keyboard-help")).toHaveCount(0);

    await target.hover();
    await page.keyboard.press("f");
    await expect(target).toHaveClass(/is-flagged/);
    await expect(target).toHaveAttribute("aria-label", "Row 5, column 5: flagged");
    await expect(target).not.toHaveClass(/is-question/);

    await page.keyboard.press("d");
    await expect(target).toHaveClass(/is-question/);
    await expect(target).toHaveAttribute("aria-label", "Row 5, column 5: maybe");
    await expect(target).not.toHaveClass(/is-flagged/);

    await page.keyboard.press("d");
    await expectCellCovered(target);

    await page.keyboard.press("Shift+f");
    await expect(target).toHaveClass(/is-flagged/);
    await page.keyboard.press("f");
    await expectCellCovered(target);

    await page.keyboard.press("d");
    await expect(target).toHaveClass(/is-question/);
    await page.keyboard.press("s");
    await expect(target).toHaveClass(/is-revealed/);
    await expect(target).not.toHaveClass(/is-question/);
    await expect(target).toHaveAttribute("aria-label", "Row 5, column 5: revealed empty");

    const layout = await app.evaluate((windowElement) => {
      const footer = windowElement.querySelector(".ms-footer");
      const appRect = windowElement.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      return {
        footerContained:
          footerRect.left >= appRect.left &&
          footerRect.right <= appRect.right &&
          footerRect.top >= appRect.top &&
          footerRect.bottom <= appRect.bottom,
        documentOverflows:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(layout).toEqual({
      footerContained: true,
      documentOverflows: false,
    });
    expect(runtimeErrors.consoleErrors).toEqual([]);
    expect(runtimeErrors.pageErrors).toEqual([]);
  });
}

test("keyboard controls always target the hovered square, never focus", async ({ page }) => {
  const { app, runtimeErrors } = await prepareMinesweeper(page);
  const cells = app.locator(".ms-cell");
  const focusedCell = cells.nth(20);
  const hoveredCell = cells.nth(21);

  await page.mouse.move(1, 1);
  await focusedCell.focus();
  await page.keyboard.press("d");
  await expectCellCovered(focusedCell);
  const focusStyle = await focusedCell.evaluate((cell) => {
    const style = getComputedStyle(cell);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(focusStyle).toEqual({ style: "dotted", width: "1px" });

  await hoveredCell.hover();
  await page.keyboard.press("f");
  await expect(hoveredCell).toHaveClass(/is-flagged/);
  await expectCellCovered(focusedCell);
  await page.keyboard.press("f");
  await expectCellCovered(hoveredCell);

  await hoveredCell.hover();
  await app.locator("#ms-difficulty").focus();
  await page.keyboard.press("d");
  await expect(hoveredCell).toHaveClass(/is-question/);
  await page.keyboard.press("d");
  await expectCellCovered(hoveredCell);

  await hoveredCell.focus();
  await page.mouse.move(1, 1);
  for (const init of [
    { key: "f", repeat: true },
    { key: "f", ctrlKey: true },
    { key: "d", metaKey: true },
    { key: "s", altKey: true },
    { key: "f", isComposing: true },
  ]) {
    await hoveredCell.dispatchEvent("keydown", init);
  }
  await expectCellCovered(hoveredCell);

  await hoveredCell.evaluate((cell) => cell.blur());
  await page.keyboard.press("f");
  await expectCellCovered(hoveredCell);

  const controlsMode = app.locator("#ms-controls-mode");
  await controlsMode.selectOption("mouse");
  await expect(controlsMode).toHaveValue("mouse");
  await expect(app.locator("#ms-grid")).not.toHaveAttribute("aria-keyshortcuts");
  await hoveredCell.hover();
  await page.keyboard.press("f");
  await expectCellCovered(hoveredCell);
  await controlsMode.selectOption("keyboard");
  await expect(controlsMode).toHaveValue("keyboard");
  await expect(app.locator("#ms-grid")).toHaveAttribute("aria-keyshortcuts", "S D F");
  expect(runtimeErrors.consoleErrors).toEqual([]);
  expect(runtimeErrors.pageErrors).toEqual([]);
});

test("the mode menu switches mobile controls and keyboard input exactly", async ({ page }) => {
  const { app, runtimeErrors } = await prepareMinesweeper(page, VIEWPORTS[0]);
  const controlsMode = app.locator("#ms-controls-mode");
  const flagMode = app.locator("#ms-flag-mode");
  const questionMode = app.locator("#ms-question-mode");
  const cell = app.locator(".ms-cell").nth(40);

  await controlsMode.selectOption("mobile");
  await expect(app.locator("#ms-grid")).not.toHaveAttribute("aria-keyshortcuts");
  await flagMode.click();
  await cell.hover();
  await page.keyboard.press("s");
  await expectCellCovered(cell);
  await cell.click();
  await expect(cell).toHaveClass(/is-flagged/);
  await cell.click();
  await expectCellCovered(cell);

  await questionMode.click();
  await cell.hover();
  await page.keyboard.press("s");
  await expectCellCovered(cell);
  await cell.click();
  await expect(cell).toHaveClass(/is-question/);
  await cell.click();
  await expectCellCovered(cell);

  await controlsMode.selectOption("mouse");
  await expect(flagMode).toBeHidden();
  await expect(questionMode).toBeHidden();
  await cell.hover();
  await page.keyboard.press("f");
  await expectCellCovered(cell);

  await controlsMode.selectOption("keyboard");
  await expect(app.locator("#ms-grid")).toHaveAttribute("aria-keyshortcuts", "S D F");
  await cell.hover();
  await page.keyboard.press("f");
  await expect(cell).toHaveClass(/is-flagged/);
  await page.keyboard.press("s");
  await expect(cell).toHaveClass(/is-flagged/);
  await page.keyboard.press("f");
  await expectCellCovered(cell);
  await page.keyboard.press("s");
  await expect(cell).toHaveClass(/is-revealed/);
  await page.keyboard.press("d");
  await page.keyboard.press("f");
  await expect(cell).toHaveClass(/is-revealed/);

  expect(runtimeErrors.consoleErrors).toEqual([]);
  expect(runtimeErrors.pageErrors).toEqual([]);
});

test("shortcuts survive grid rebuilds and stop after the game ends", async ({ page }) => {
  const { app, runtimeErrors } = await prepareMinesweeper(page);
  let cell = app.locator(".ms-cell").nth(40);

  await cell.hover();
  await page.keyboard.press("f");
  await expect(cell).toHaveClass(/is-flagged/);
  await app.locator("#ms-reset").click();
  cell = app.locator(".ms-cell").nth(40);
  await cell.hover();
  await page.keyboard.press("d");
  await expect(cell).toHaveClass(/is-question/);

  await app.locator("#ms-difficulty").selectOption("intermediate");
  await expect(app.locator(".ms-cell")).toHaveCount(256);
  cell = app.locator(".ms-cell").nth(100);
  await cell.hover();
  await cell.focus();
  await page.keyboard.press("f");
  await expect(cell).toHaveClass(/is-flagged/);

  await app.locator("#ms-difficulty").selectOption("beginner");
  const safeCell = app.locator(".ms-cell").nth(40);
  const mineCell = app.locator(".ms-cell").nth(0);
  await safeCell.hover();
  await safeCell.focus();
  await page.keyboard.press("s");
  await expect(safeCell).toHaveClass(/is-revealed/);
  await mineCell.hover();
  await mineCell.focus();
  await page.keyboard.press("s");
  await expect(mineCell).toHaveClass(/is-mine is-blown|is-blown is-mine/);

  const coveredCell = app.locator(".ms-cell").nth(44);
  const before = await coveredCell.getAttribute("class");
  await coveredCell.hover();
  await page.keyboard.press("s");
  await page.keyboard.press("d");
  await page.keyboard.press("f");
  await expect(coveredCell).toHaveAttribute("class", before);

  expect(runtimeErrors.consoleErrors).toEqual([]);
  expect(runtimeErrors.pageErrors).toEqual([]);
});

test("Minesweeper receives S and D when Snake is open behind it", async ({ page }) => {
  const { app, runtimeErrors } = await prepareMinesweeper(page);
  const snakeButton = page
    .getByRole("toolbar", { name: "Taskbar" })
    .getByRole("button", { name: "Snake" });
  await snakeButton.click();
  const snake = page.locator('[data-app-window="snake"]');
  await expect(snake).toBeVisible();
  await expect(snake.locator("#snake-loading-panel")).toHaveAttribute(
    "aria-hidden",
    "true",
    { timeout: 6_000 }
  );
  await expect(snake.locator("#snake-status")).toHaveText("Ready");

  const target = app.locator(".ms-cell").nth(40);
  await target.focus();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  await page.keyboard.press("d");
  await expect(target).toHaveAttribute("class", "ms-cell");
  await expect(snake.locator("#snake-status")).toHaveText("Starting");
  await snake.locator("#snake-reset").click();
  await expect(snake.locator("#snake-status")).toHaveText("Ready");

  await target.dispatchEvent("pointerdown", { button: 0, pointerId: 1 });
  await target.dispatchEvent("pointerup", { button: 0, pointerId: 1 });
  const secondTarget = app.locator(".ms-cell").nth(44);
  await secondTarget.hover();
  await page.keyboard.press("d");
  await expect(secondTarget).toHaveClass(/is-question/);
  await page.keyboard.press("s");
  await expect(secondTarget).toHaveClass(/is-revealed/);
  await expect(snake.locator("#snake-status")).toHaveText("Ready");

  const restoredTarget = app.locator(".ms-cell").nth(54);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  await restoredTarget.hover();
  await page.keyboard.press("f");
  await expect(restoredTarget).toHaveClass(/is-flagged/);

  expect(runtimeErrors.consoleErrors).toEqual([]);
  expect(runtimeErrors.pageErrors).toEqual([]);
});
