import { expect, test } from "./deterministic.mjs";
import {
  installStubbedModelingMedia,
  openApp,
  openDeterministicRoute,
  openHomeDesktop,
  openSudokuBoard,
  settleRender,
} from "./helpers/rendered-site.mjs";

/**
 * A small curated set of reference screenshots for the states a visitor always
 * sees: the entry loader, the Home desktop, the About window that greets every
 * visitor, and three application windows, at desktop and mobile widths.
 *
 * Sudoku is pinned twice, because its two board states look nothing alike: a
 * playing board carrying the greyed exhausted keypad, the remaining-count
 * badges, and the same-value tint, and the paused board behind its single
 * play button.
 *
 * Baselines are byte-comparable only when the browser, fonts, and rasterizer
 * match, so they are generated and compared exclusively in the Playwright
 * container pinned by `package-lock.json`. `npm run test:visual` starts it.
 */

const MOBILE = Object.freeze({ width: 375, height: 812 });
const DESKTOP = Object.freeze({ width: 1280, height: 800 });

test.beforeAll(() => {
  if (process.platform !== "linux") {
    throw new Error(
      [
        `Visual baselines are generated on linux; this host is ${process.platform}.`,
        "Run `npm run test:visual` (or `npm run test:visual:update`) instead, which",
        "runs this project inside the pinned Playwright container.",
      ].join("\n")
    );
  }
});

test("the entry loader matches its reference render at desktop and mobile", async ({
  page,
}) => {
  for (const [name, viewport] of Object.entries({ desktop: DESKTOP, mobile: MOBILE })) {
    await openDeterministicRoute(page, "/", viewport);
    await expect(page.locator("#proceed-button")).toBeEnabled({ timeout: 20_000 });
    await expect(page.locator("#status-text")).toHaveText("Ready. Click Proceed to continue.");
    await settleRender(page);

    await expect(page).toHaveScreenshot(`entry-ready-${name}.png`, { fullPage: true });
  }
});

test("the entry alert dialog matches its reference render", async ({ page }) => {
  await openDeterministicRoute(page, "/", DESKTOP);
  await page.locator("#cancel-button").click();
  const dialog = page.locator("#alert-overlay .alert-window");
  await expect(dialog).toBeVisible();
  await settleRender(page);

  await expect(dialog).toHaveScreenshot("entry-alert-dialog.png");
});

test("the Home desktop matches its reference render at desktop and mobile", async ({
  page,
}) => {
  // The Neko launcher breathes by swapping sprites on a `setInterval`, and a
  // fixed Date alone does not pause that timer. Masking keeps its position and
  // size under comparison while leaving the alternating frame out.
  const breathingNeko = page.locator("[data-neko-sleeping-cat]");

  for (const [name, viewport] of Object.entries({ desktop: DESKTOP, mobile: MOBILE })) {
    await openHomeDesktop(page, viewport);
    await expect(page.locator(".desktop")).toBeVisible();
    await expect(page.locator('[role="toolbar"][aria-label="Taskbar"]')).toBeVisible();

    await expect(page).toHaveScreenshot(`home-desktop-${name}.png`, {
      fullPage: true,
      mask: [breathingNeko],
    });
  }
});

test("the About window matches its reference render", async ({ page }) => {
  await openDeterministicRoute(page, "/home.html", DESKTOP);
  const about = page.locator("#about-window");
  await expect(about).toBeVisible();
  await expect(about).not.toHaveClass(/is-opening/);
  await settleRender(page);

  await expect(about).toHaveScreenshot("home-about-window.png");
});

test("the Minesweeper window matches its reference render", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  const minesweeper = await openApp(page, "minesweeper");
  await expect(page.locator("#ms-grid .ms-cell")).toHaveCount(81);

  await expect(minesweeper).toHaveScreenshot("home-minesweeper-window.png");
});

test("the offline Game Progress window matches its reference render", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  const progress = await openApp(page, "game-progress");
  await expect(progress).toBeVisible();
  await settleRender(page);

  await expect(progress).toHaveScreenshot("home-game-progress-window.png");
});

test("the modeling portfolio route matches its reference render at desktop and mobile", async ({
  page,
}) => {
  // Photos and clips are stubbed, and the container's Chromium has no H.264
  // decoder, so the strips are masked: their position and size are still
  // compared while the baseline records the page chrome and controls.
  await installStubbedModelingMedia(page);
  for (const [name, viewport] of Object.entries({ desktop: DESKTOP, mobile: MOBILE })) {
    await openDeterministicRoute(page, "/modeling/", viewport);
    await expect(page.locator("section.shoot")).toHaveCount(22);
    await settleRender(page);

    await expect(page).toHaveScreenshot(`modeling-portfolio-${name}.png`, {
      mask: [page.locator(".carousel__strip")],
    });
  }
});

/**
 * Places a digit up to its ninth placement and leaves one of those cells
 * selected, so a single render carries the greyed exhausted keypad button,
 * every remaining-count badge, and the same-value tint together. The values
 * are entered through the board, so the render is of the real path.
 */
const exhaustSudokuDigit = async (page, win, digit) => {
  const indexes = await page.evaluate((value) => {
    const cells = [...document.querySelectorAll("#sudoku-grid .sudoku-cell")];
    const placed = cells.filter((cell) => cell.dataset.sudokuValue === value).length;
    return cells
      .map((cell, index) => (cell.readOnly ? -1 : index))
      .filter((index) => index >= 0)
      .slice(0, 9 - placed);
  }, digit);
  for (const index of indexes) {
    await win.locator(`.sudoku-cell[data-sudoku-index="${index}"]`).click();
    await page.keyboard.press(digit);
  }
  await win.locator(`.sudoku-cell[data-sudoku-index="${indexes.at(-1)}"]`).click();
  return indexes;
};

test("the playing Sudoku window matches its reference render", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  await exhaustSudokuDigit(page, win, "7");

  await expect(win.locator('[data-sudoku-number="7"]')).toHaveClass(/is-exhausted/);
  await expect(win.locator(".sudoku-cell.is-same-value")).toHaveCount(8);
  await settleRender(page);

  await expect(win).toHaveScreenshot("home-sudoku-window.png");
});

test("the paused Sudoku window matches its reference render", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  await exhaustSudokuDigit(page, win, "7");
  await win.locator("#sudoku-pause").click();

  await expect(win.locator("#sudoku-resume")).toBeVisible();
  await expect(win.locator(".sudoku-app")).toHaveClass(/is-sudoku-paused/);
  await settleRender(page);

  await expect(win).toHaveScreenshot("home-sudoku-paused-window.png");
});
