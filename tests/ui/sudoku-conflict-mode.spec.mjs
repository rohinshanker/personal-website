import { expect, test } from "./deterministic.mjs";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";
import {
  FROZEN_INSTANT,
  REVIEW_VIEWPORTS,
  installOfflineGameStats,
  openHomeDesktop,
  openSudokuBoard,
  settleRender,
} from "./helpers/rendered-site.mjs";

/**
 * Rendered contract for the Conflicts hint mode: it marks duplicates inside a
 * row, column, or box from the board alone, so it costs neither a check nor
 * the player's leaderboard eligibility, and it never needs the Errors
 * confirmation.
 */

test.setTimeout(120_000);

const DESKTOP = Object.freeze({ width: 1280, height: 800 });
const CONFLICT_TINT = "rgba(255, 150, 22, 0.44)";

/** Reports board facts the spec needs; every behaviour is driven through the UI. */
const installConflictBridge = async (page) => {
  const mainSource = await readIsolatedMainSource();
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__sudokuConflictTest = Object.freeze({
  // An empty cell plus a given in the same row, and the given's digit.
  rowPair: () => {
    const cells = sudokuCells();
    for (let index = 0; index < cells.length; index += 1) {
      if (isSudokuCellReadOnly(cells[index])) continue;
      const row = Math.floor(index / 9);
      const peer = cells.findIndex(
        (cell, other) => isSudokuCellReadOnly(cell) && Math.floor(other / 9) === row
      );
      if (peer >= 0) {
        return { target: index, peer, digit: sudokuState.puzzle[peer] };
      }
    }
    return null;
  },
  // An empty cell sharing no row, column, or box with the given at \`peer\`.
  unrelatedTo: (peer) => {
    const peerRow = Math.floor(peer / 9);
    const peerColumn = peer % 9;
    const peerBox = sudokuBoxIndex(peerRow, peerColumn);
    return sudokuCells().findIndex((cell, index) => {
      if (isSudokuCellReadOnly(cell)) return false;
      const row = Math.floor(index / 9);
      const column = index % 9;
      return (
        row !== peerRow &&
        column !== peerColumn &&
        sudokuBoxIndex(row, column) !== peerBox
      );
    });
  },
  readEligibility: () => ({
    checksUsed: sudokuState.checksUsed,
    errorsConfirmed: sudokuState.errorsConfirmed,
    hintMode: sudokuState.hintMode,
    usedHint: sudokuState.usedHint,
    usedReveal: sudokuState.usedReveal,
  }),
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the Sudoku conflict-mode test bridge.");
  }
  await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: instrumentedSource })
  );
};

const bridge = (page, method, ...args) =>
  page.evaluate(
    ([name, params]) => window.__sudokuConflictTest[name](...params),
    [method, args]
  );

const cellAt = (win, index) => win.locator(`.sudoku-cell[data-sudoku-index="${index}"]`);

const hint = (win, mode) => win.locator(`[data-sudoku-hint="${mode}"]`);

for (const viewport of REVIEW_VIEWPORTS) {
  test(`Conflicts marks duplicates and keeps its controls readable at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await installConflictBridge(page);
    await openHomeDesktop(page, viewport);
    const win = await openSudokuBoard(page);
    const pair = await bridge(page, "rowPair");
    expect(pair).not.toBeNull();

    await hint(win, "conflicts").click();
    await expect(hint(win, "conflicts")).toHaveAttribute("aria-pressed", "true");
    // Conflicts is a mode of the same group, so Off stands down with it.
    await expect(hint(win, "off")).toHaveAttribute("aria-pressed", "false");
    await expect(hint(win, "errors")).toHaveAttribute("aria-pressed", "false");
    // Turning it on marks nothing: the board holds no duplicate yet.
    await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(0);

    await cellAt(win, pair.target).click();
    await page.keyboard.press(pair.digit);
    await expect(cellAt(win, pair.target)).toHaveAttribute("data-sudoku-value", pair.digit);

    // Both members of the duplicate are marked, the given included.
    await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(2);
    await expect(cellAt(win, pair.target)).toHaveClass(/is-conflict/);
    await expect(cellAt(win, pair.peer)).toHaveClass(/is-conflict/);
    await expect(cellAt(win, pair.target)).toHaveAttribute(
      "aria-label",
      /Conflict\.$/
    );

    const marker = await cellAt(win, pair.target).evaluate((cell) => {
      const style = getComputedStyle(cell);
      const wedge = getComputedStyle(cell, "::after");
      return {
        background: style.backgroundImage,
        color: style.color,
        wedgeHeight: wedge.borderTopWidth,
      };
    });
    expect(marker.background).toContain(CONFLICT_TINT);
    expect(marker.color).toBe("rgb(106, 40, 0)");
    // The corner wedge carries the same meaning without relying on hue.
    expect(marker.wedgeHeight).toBe("7px");

    // Every hint label stays legible and the panel never forces a scrollbar.
    for (const mode of ["off", "conflicts", "errors"]) {
      const button = hint(win, mode);
      await expect(button).toBeVisible();
      expect(
        await button.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
      ).toBe(true);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);

    await page.screenshot({
      path: testInfo.outputPath(`sudoku-conflicts-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });

    // Clearing the duplicate releases both marks. Entering a digit advances
    // the selection, so the cell has to be picked up again.
    await cellAt(win, pair.target).click();
    await page.keyboard.press("Backspace");
    await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(0);
  });
}

test("Conflicts costs no check, no confirmation, and no eligibility", async ({ page }) => {
  await installConflictBridge(page);
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const pair = await bridge(page, "rowPair");
  const unrelated = await bridge(page, "unrelatedTo", pair.peer);
  expect(unrelated).toBeGreaterThanOrEqual(0);

  await hint(win, "conflicts").click();
  // The Errors warning is the disqualifying gate; Conflicts never opens it.
  await expect(win.locator("#sudoku-errors-prompt")).toBeHidden();

  await cellAt(win, pair.target).click();
  await page.keyboard.press(pair.digit);
  await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(2);

  // A duplicate is not a mistake report: the counters and latches stand still.
  await expect(win.locator("#sudoku-mistakes")).toHaveText("Mistakes: 0");
  await expect(win.locator("#sudoku-leaderboard-checks")).toHaveText(
    "0/3 allowed checks used to place on leaderboard"
  );
  await expect(win.locator("#sudoku-status")).toHaveText("Ready");
  expect(await bridge(page, "readEligibility")).toEqual({
    checksUsed: 0,
    errorsConfirmed: false,
    hintMode: "conflicts",
    usedHint: false,
    usedReveal: false,
  });

  // A value that shares no unit is never marked, however wrong it may be.
  await cellAt(win, pair.target).click();
  await page.keyboard.press("Backspace");
  await cellAt(win, unrelated).click();
  await page.keyboard.press(pair.digit);
  await expect(cellAt(win, unrelated)).toHaveAttribute("data-sudoku-value", pair.digit);
  await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(0);

  // Switching modes hands the board over cleanly in both directions.
  await cellAt(win, unrelated).click();
  await page.keyboard.press("Backspace");
  await cellAt(win, pair.target).click();
  await page.keyboard.press(pair.digit);
  await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(2);
  await hint(win, "off").click();
  await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(0);
  await hint(win, "conflicts").click();
  await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(2);

  // Errors still demands its confirmation, and takes the board from Conflicts.
  await hint(win, "errors").click();
  await expect(win.locator("#sudoku-errors-prompt")).toBeVisible();
  await win.locator("#sudoku-errors-cancel").click();
  await expect(win.locator("#sudoku-errors-prompt")).toBeHidden();
  await expect(hint(win, "conflicts")).toHaveAttribute("aria-pressed", "true");
  await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(2);

  await hint(win, "errors").click();
  await win.locator("#sudoku-errors-confirm").click();
  await expect(hint(win, "errors")).toHaveAttribute("aria-pressed", "true");
  await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(0);
});

const RELOAD_MARKER = "sudoku-conflict-mode-initialized";

test("Conflicts survives a reload with the rest of the saved puzzle", async ({ page }) => {
  await installConflictBridge(page);
  await installOfflineGameStats(page);
  await page.clock.setFixedTime(FROZEN_INSTANT);
  await page.setViewportSize(DESKTOP);
  // The shared helper clears storage on every navigation, which a reload
  // test cannot use: the marker keeps the wipe to the first load.
  await page.addInitScript((marker) => {
    Math.random = () => 0.999999;
    if (sessionStorage.getItem(marker) === "1") return;
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(marker, "1");
  }, RELOAD_MARKER);
  await page.goto("/home.html", { waitUntil: "load" });
  await settleRender(page);
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();

  const win = await openSudokuBoard(page);
  const pair = await bridge(page, "rowPair");
  await hint(win, "conflicts").click();
  await cellAt(win, pair.target).click();
  await page.keyboard.press(pair.digit);
  await expect(win.locator(".sudoku-cell.is-conflict")).toHaveCount(2);
  // Saves are debounced; wait for the puzzle to reach storage.
  await page.waitForFunction(
    (digit) =>
      JSON.parse(localStorage.getItem("personalSiteSudokuStateV1") || "{}").hintMode ===
        "conflicts" &&
      String(
        JSON.parse(localStorage.getItem("personalSiteSudokuStateV1") || "{}").values || ""
      ).includes(digit),
    pair.digit
  );

  await page.reload({ waitUntil: "load" });
  await settleRender(page);
  const restored = await openSudokuBoard(page);
  await expect(hint(restored, "conflicts")).toHaveAttribute("aria-pressed", "true");
  await expect(restored.locator(".sudoku-cell.is-conflict")).toHaveCount(2);
  expect((await bridge(page, "readEligibility")).usedHint).toBe(false);
});
