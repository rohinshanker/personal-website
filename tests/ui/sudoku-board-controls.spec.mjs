import { expect, test } from "./deterministic.mjs";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";
import {
  FROZEN_INSTANT,
  REVIEW_VIEWPORTS,
  installOfflineGameStats,
  openApp,
  openHomeDesktop,
  openSudokuBoard,
  settleRender,
} from "./helpers/rendered-site.mjs";

/**
 * Rendered contract for the Sudoku board controls: a digit placed nine times
 * greys out of the keypad, selecting a value highlights its other placements,
 * N toggles notes with a pointer-tracking hint, and digits typed while a panel
 * button holds focus still edit the selected cell.
 */

test.setTimeout(120_000);

const DESKTOP = Object.freeze({ width: 1280, height: 800 });
const NOTE_HINT = "Press N to toggle";
const VALUE_HIGHLIGHT = "rgba(0, 176, 255, 0.4)";

/**
 * Exposes read-only board facts and a bulk placement helper. Every behaviour
 * under test is still driven through the rendered controls.
 *
 * @param {import("@playwright/test").Page} page
 */
const installBoardBridge = async (page) => {
  const mainSource = await readIsolatedMainSource();
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__sudokuBoardControlsTest = Object.freeze({
  editableIndexesFor: (digit) =>
    sudokuCells()
      .map((cell, index) =>
        !isSudokuCellReadOnly(cell) && sudokuState.solution[index] === digit ? index : -1
      )
      .filter((index) => index >= 0),
  givenIndexFor: (digit) =>
    sudokuCells().findIndex(
      (cell, index) => isSudokuCellReadOnly(cell) && sudokuState.puzzle[index] === digit
    ),
  placeDigit: (digit, indexes) => {
    const cells = sudokuCells();
    indexes.forEach((index) => {
      setSudokuCellValue(cells[index], index, digit);
    });
    updateSudokuBoardHighlights();
    updateSudokuNumberButtons();
  },
  completeBoard: () => {
    const cells = sudokuCells();
    cells.forEach((cell, index) => {
      if (isSudokuCellReadOnly(cell)) return;
      setSudokuCellNotes(cell, index, "");
      setSudokuCellValue(cell, index, sudokuState.solution[index]);
    });
    updateSudokuBoardHighlights();
    updateSudokuNumberButtons();
  },
  readState: () => ({
    noteMode: sudokuState.noteMode,
    notes: sudokuState.notes.slice(),
    selectedIndex: sudokuState.selectedIndex,
    values: sudokuState.values.join(""),
  }),
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the Sudoku board-controls test bridge.");
  }
  await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: instrumentedSource })
  );
};

const bridge = (page, method, ...args) =>
  page.evaluate(
    ([name, params]) => window.__sudokuBoardControlsTest[name](...params),
    [method, args]
  );

const cellAt = (win, index) => win.locator(`.sudoku-cell[data-sudoku-index="${index}"]`);

const keypad = (win, digit) => win.locator(`[data-sudoku-number="${digit}"]`);

/** Lays out a digit until exactly one editable placement is left. */
const placeAllButOne = async (page, digit) => {
  const indexes = await bridge(page, "editableIndexesFor", digit);
  expect(indexes.length).toBeGreaterThan(1);
  const remaining = indexes.at(-1);
  await bridge(page, "placeDigit", digit, indexes.slice(0, -1));
  return remaining;
};

for (const viewport of REVIEW_VIEWPORTS) {
  test(`exhausted digits grey out and matching values highlight at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await installBoardBridge(page);
    await openHomeDesktop(page, viewport);
    const win = await openSudokuBoard(page);
    const digit = "5";
    const button = keypad(win, digit);

    const lastIndex = await placeAllButOne(page, digit);
    await expect(button).toBeEnabled();
    await expect(button).not.toHaveClass(/is-exhausted/);

    await cellAt(win, lastIndex).click();
    await button.click();
    await expect(cellAt(win, lastIndex)).toHaveAttribute("data-sudoku-value", digit);
    await expect(button).toHaveClass(/is-exhausted/);
    await expect(button).toBeDisabled();
    for (const other of ["1", "2", "3", "4", "6", "7", "8", "9", "clear"]) {
      await expect(keypad(win, other)).toBeEnabled();
      await expect(keypad(win, other)).not.toHaveClass(/is-exhausted/);
    }
    const exhaustedStyle = await button.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, opacity: style.opacity };
    });
    expect(exhaustedStyle.color).toBe("rgb(123, 137, 146)");
    expect(Number(exhaustedStyle.opacity)).toBeLessThan(1);

    // Selecting any placement of the digit marks every other placement.
    await cellAt(win, lastIndex).click();
    const highlight = await page.evaluate(
      ({ selectedIndex, tint, value }) => {
        const cells = [...document.querySelectorAll("#sudoku-grid .sudoku-cell")];
        const matching = cells.filter((cell) => cell.dataset.sudokuValue === value);
        const same = cells.filter((cell) => cell.classList.contains("is-same-value"));
        const selected = cells[selectedIndex];
        const background = (cell) => getComputedStyle(cell).backgroundImage;
        return {
          matchingCount: matching.length,
          sameCount: same.length,
          sameAreAllMatches: same.every((cell) => cell.dataset.sudokuValue === value),
          selectedIsSame: selected.classList.contains("is-same-value"),
          selectedIsSelected: selected.classList.contains("is-selected"),
          sameHaveTint: same.every((cell) => background(cell).includes(tint)),
          selectedHasTint: background(selected).includes(tint),
          otherHasTint: cells.some(
            (cell) => cell.dataset.sudokuValue !== value && background(cell).includes(tint)
          ),
        };
      },
      { selectedIndex: lastIndex, tint: VALUE_HIGHLIGHT, value: digit }
    );
    expect(highlight).toEqual({
      matchingCount: 9,
      sameCount: 8,
      sameAreAllMatches: true,
      selectedIsSame: false,
      selectedIsSelected: true,
      sameHaveTint: true,
      selectedHasTint: false,
      otherHasTint: false,
    });

    await page.screenshot({
      path: testInfo.outputPath(`sudoku-board-controls-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });

    // Clearing the ninth placement reopens the keypad and drops the highlight.
    await page.keyboard.press("Backspace");
    await expect(cellAt(win, lastIndex)).toHaveAttribute("data-sudoku-value", "");
    await expect(button).toBeEnabled();
    await expect(button).not.toHaveClass(/is-exhausted/);
    await expect(win.locator(".sudoku-cell.is-same-value")).toHaveCount(0);
    expect(
      await win.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });
}

test("N toggles notes only in the active Sudoku window and the button hints at it", async ({
  page,
}, testInfo) => {
  await installBoardBridge(page);
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const noteToggle = win.locator("#sudoku-note-toggle");
  const tooltip = page.locator("#sudoku-note-tooltip");
  const [firstEditable] = await bridge(page, "editableIndexesFor", "1");

  await expect(noteToggle).toHaveAttribute("aria-keyshortcuts", "N");
  await expect(noteToggle).toHaveAccessibleDescription(NOTE_HINT);
  await expect(tooltip).toBeHidden();
  await expect(tooltip).toHaveAttribute("role", "tooltip");

  await cellAt(win, firstEditable).click();
  await page.keyboard.press("n");
  await expect(noteToggle).toHaveAttribute("aria-pressed", "true");
  await expect(noteToggle).toHaveClass(/is-selected/);
  await page.keyboard.press("N");
  await expect(noteToggle).toHaveAttribute("aria-pressed", "false");

  // Focus on a panel button is still inside the active window.
  await win.locator("#sudoku-check").focus();
  await page.keyboard.press("n");
  await expect(noteToggle).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("n");
  await expect(noteToggle).toHaveAttribute("aria-pressed", "false");

  // The hint appears instantly, tracks the pointer, and matches the Solitaire pile hint.
  const box = await noteToggle.boundingBox();
  const start = { x: box.x + 8, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText(NOTE_HINT);
  const readTooltip = () =>
    tooltip.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        background: style.backgroundColor,
        color: style.color,
        height: rect.height,
        left: rect.left,
        position: style.position,
        top: rect.top,
        transitionDuration: style.transitionDuration,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        width: rect.width,
      };
    });
  // Sits 12px below and right of the pointer, pulled back from the viewport edge.
  const expectTracking = (placement, pointer) => {
    const left = Math.max(4, Math.min(pointer.x + 12, placement.viewportWidth - placement.width - 4));
    const top = Math.max(4, Math.min(pointer.y + 12, placement.viewportHeight - placement.height - 4));
    expect(placement.left).toBeCloseTo(left, 0);
    expect(placement.top).toBeCloseTo(top, 0);
  };
  const atStart = await readTooltip();
  expect(atStart).toMatchObject({
    background: "rgb(0, 0, 0)",
    color: "rgb(255, 255, 255)",
    position: "fixed",
    transitionDuration: "0s",
  });
  expectTracking(atStart, start);

  const moved = { x: start.x + 20, y: start.y + 3 };
  await page.mouse.move(moved.x, moved.y);
  const afterMove = await readTooltip();
  expectTracking(afterMove, moved);
  expect(afterMove.top).not.toBe(atStart.top);
  await page.screenshot({
    path: testInfo.outputPath("sudoku-note-hint-1280x800.png"),
    fullPage: true,
  });

  await page.mouse.move(box.x + box.width + 40, box.y - 40);
  await expect(tooltip).toBeHidden();

  // Another active window keeps the shortcut to itself.
  await openApp(page, "solitaire");
  await page.keyboard.press("n");
  expect((await bridge(page, "readState")).noteMode).toBe(false);
});

test("digits typed while a panel button holds focus edit the selected cell", async ({
  page,
}) => {
  await installBoardBridge(page);
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const [target] = await bridge(page, "editableIndexesFor", "7");
  const givenIndex = await bridge(page, "givenIndexFor", "3");
  expect(givenIndex).toBeGreaterThanOrEqual(0);
  const erase = keypad(win, "clear");

  await cellAt(win, target).click();
  await erase.focus();
  await expect(erase).toBeFocused();
  await page.keyboard.press("7");
  await expect(cellAt(win, target)).toHaveAttribute("data-sudoku-value", "7");

  // Clear keys reach the selection from a focused action button too.
  await cellAt(win, target).click();
  await win.locator("#sudoku-new").focus();
  await page.keyboard.press("Backspace");
  await expect(cellAt(win, target)).toHaveAttribute("data-sudoku-value", "");

  // Notes mode is honoured for typed digits.
  await win.locator("#sudoku-note-toggle").click();
  await expect(win.locator("#sudoku-note-toggle")).toHaveAttribute("aria-pressed", "true");
  await cellAt(win, target).click();
  await erase.focus();
  await page.keyboard.press("4");
  await expect(cellAt(win, target)).toHaveClass(/has-notes/);
  expect((await bridge(page, "readState")).notes[target]).toBe("4");
  await page.keyboard.press("4");
  expect((await bridge(page, "readState")).notes[target]).toBe("");
  await win.locator("#sudoku-note-toggle").click();

  // A selected given cell never changes.
  const before = (await bridge(page, "readState")).values;
  await cellAt(win, givenIndex).click();
  await erase.focus();
  await page.keyboard.press("9");
  await page.keyboard.press("Backspace");
  expect((await bridge(page, "readState")).values).toBe(before);

  // Modifier chords are left to the browser and undo/redo handling.
  await cellAt(win, target).click();
  await erase.focus();
  await page.keyboard.press("Control+7");
  await expect(cellAt(win, target)).toHaveAttribute("data-sudoku-value", "");
});

/**
 * Like openHomeDesktop, but with a saved player profile so a win records
 * locally without opening the profile prompt.
 */
const openHomeDesktopWithProfile = async (page, viewport) => {
  await installOfflineGameStats(page);
  await page.clock.setFixedTime(FROZEN_INSTANT);
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => 0.999999;
    localStorage.setItem(
      "personalSitePlayerProfileV1",
      JSON.stringify({
        id: "player-sudoku-board-controls",
        name: "Board Controls Tester",
        icon: "assets/app-icons/ico/user_card.ico",
        rerollCount: 0,
      })
    );
  });
  await page.goto("/home.html", { waitUntil: "load" });
  await settleRender(page);
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) {
    await aboutClose.click();
    await page.locator("#about-window").waitFor({ state: "hidden" });
  }
};

test("keys pressed on the solved dialog leave the finished board alone", async ({ page }) => {
  await installBoardBridge(page);
  await openHomeDesktopWithProfile(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const [target] = await bridge(page, "editableIndexesFor", "2");
  const solveOk = win.locator("#sudoku-solve-ok");

  await cellAt(win, target).click();
  await bridge(page, "completeBoard");
  await win.locator("#sudoku-check").click();
  await expect(win.locator("#sudoku-status")).toHaveText("Solved");
  await expect(solveOk).toBeVisible();

  // The record handoff may raise the stats window; bring Sudoku back on top.
  const statsWindow = page.locator("#game-stats-window-sudoku");
  if (await statsWindow.isVisible()) {
    await statsWindow.locator('[data-close="game-stats-sudoku"]').click();
    await expect(statsWindow).toBeHidden();
  }
  await win.locator(".title-bar").first().click();
  await solveOk.focus();
  await expect(solveOk).toBeFocused();
  const solvedValues = (await bridge(page, "readState")).values;

  for (const key of ["Backspace", "Delete", "0", "7", "n"]) {
    await page.keyboard.press(key);
  }
  expect((await bridge(page, "readState")).values).toBe(solvedValues);
  expect((await bridge(page, "readState")).noteMode).toBe(false);
  await expect(solveOk).toBeVisible();
  await expect(win.locator("#sudoku-status")).toHaveText("Solved");
  await expect(cellAt(win, target)).toHaveAttribute("data-sudoku-value", "2");

  // Dismissing the dialog restores keyboard editing for a new attempt.
  await solveOk.click();
  await expect(solveOk).toBeHidden();
  await cellAt(win, target).click();
  await win.locator("#sudoku-new").focus();
  await page.keyboard.press("Backspace");
  await expect(cellAt(win, target)).toHaveAttribute("data-sudoku-value", "");
});
