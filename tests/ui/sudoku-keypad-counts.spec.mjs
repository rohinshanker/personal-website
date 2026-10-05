import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import {
  REVIEW_VIEWPORTS,
  openHomeDesktop,
  openSudokuBoard,
} from "./helpers/rendered-site.mjs";

/**
 * Rendered contract for the keypad's remaining counts: every digit reports
 * how many placements it still has, not only the greyed state at nine, and
 * the badge tracks placements, clears, undo, and a new puzzle.
 */

test.setTimeout(120_000);

const DESKTOP = Object.freeze({ width: 1280, height: 800 });
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Exposes board facts and a bulk placement helper, as the sibling specs do. */
const installKeypadBridge = async (page) => {
  await routeHomeScript(page, "sudoku", (source) =>
    source.replace(
      /\n\}\)\(\);\s*$/,
      `
window.__sudokuKeypadTest = Object.freeze({
  editableIndexesFor: (digit) =>
    sudokuCells()
      .map((cell, index) =>
        !isSudokuCellReadOnly(cell) && sudokuState.solution[index] === digit ? index : -1
      )
      .filter((index) => index >= 0),
  placedCounts: () => {
    const counts = {};
    "123456789".split("").forEach((digit) => {
      counts[digit] = 0;
    });
    sudokuState.values.forEach((value) => {
      if (value) counts[value] += 1;
    });
    return counts;
  },
  placeDigit: (digit, indexes) => {
    const cells = sudokuCells();
    indexes.forEach((index) => {
      setSudokuCellValue(cells[index], index, digit);
    });
    updateSudokuBoardHighlights();
    updateSudokuNumberButtons();
  },
});
})();`
    )
  );
};

const bridge = (page, method, ...args) =>
  page.evaluate(
    ([name, params]) => window.__sudokuKeypadTest[name](...params),
    [method, args]
  );

const cellAt = (win, index) => win.locator(`.sudoku-cell[data-sudoku-index="${index}"]`);

const keypad = (win, digit) => win.locator(`[data-sudoku-number="${digit}"]`);

const badge = (win, digit) =>
  keypad(win, digit).locator(".sudoku-number-remaining");

/** Every digit's badge text, in keypad order. */
const readBadges = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.sudoku-number-grid [data-sudoku-number]')]
      .filter((button) => button.dataset.sudokuNumber !== "clear")
      .map((button) => button.querySelector(".sudoku-number-remaining").textContent)
  );

for (const viewport of REVIEW_VIEWPORTS) {
  test(`the keypad reports every digit's remaining placements at ${viewport.name}`, async ({
    page,
  }) => {
    await installKeypadBridge(page);
    await openHomeDesktop(page, viewport);
    const win = await openSudokuBoard(page);

    // The badges open on the givens the puzzle shipped with.
    const placed = await bridge(page, "placedCounts");
    expect(await readBadges(page)).toEqual(
      DIGITS.map((digit) => String(9 - placed[digit]))
    );

    // Each badge sits inside its own button and never spills out of it.
    const geometry = await page.evaluate(() =>
      [...document.querySelectorAll('.sudoku-number-grid [data-sudoku-number]')]
        .filter((button) => button.dataset.sudokuNumber !== "clear")
        .map((button) => {
          const outer = button.getBoundingClientRect();
          const inner = button
            .querySelector(".sudoku-number-remaining")
            .getBoundingClientRect();
          return {
            contained:
              inner.left >= outer.left - 0.5 &&
              inner.right <= outer.right + 0.5 &&
              inner.top >= outer.top - 0.5 &&
              inner.bottom <= outer.bottom + 0.5,
            digitVisible:
              button.querySelector(".sudoku-number-digit").getBoundingClientRect()
                .width > 0,
          };
        })
    );
    expect(geometry.every((entry) => entry.contained && entry.digitVisible)).toBe(true);


    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });
}

test("a digit's badge counts down to nothing and comes back with the placement", async ({
  page,
}) => {
  await installKeypadBridge(page);
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const digit = "5";
  const indexes = await bridge(page, "editableIndexesFor", digit);
  const placed = await bridge(page, "placedCounts");
  const before = 9 - placed[digit];
  expect(indexes.length).toBe(before);

  // One placement at a time, through the keypad.
  await cellAt(win, indexes[0]).click();
  await keypad(win, digit).click();
  await expect(badge(win, digit)).toHaveText(String(before - 1));
  await expect(keypad(win, digit)).toHaveAttribute(
    "aria-label",
    `${digit}, ${before - 1} left`
  );

  // The rest at once, down to the exhausted state.
  await bridge(page, "placeDigit", digit, indexes.slice(1));
  await expect(badge(win, digit)).toBeEmpty();
  await expect(keypad(win, digit)).toHaveAttribute("aria-label", `${digit}, none left`);
  await expect(keypad(win, digit)).toHaveClass(/is-exhausted/);
  await expect(keypad(win, digit)).toBeDisabled();

  // Other digits are unaffected.
  const after = await bridge(page, "placedCounts");
  expect(await readBadges(page)).toEqual(
    DIGITS.map((other) => (9 - after[other] > 0 ? String(9 - after[other]) : ""))
  );

  // Clearing a placement brings the count and the button back.
  await cellAt(win, indexes.at(-1)).click();
  await page.keyboard.press("Backspace");
  await expect(badge(win, digit)).toHaveText("1");
  await expect(keypad(win, digit)).toBeEnabled();
  await expect(keypad(win, digit)).not.toHaveClass(/is-exhausted/);

  // Undo restores the placement and the badge with it.
  await win.locator("#sudoku-undo").click();
  await expect(badge(win, digit)).toBeEmpty();
  await expect(keypad(win, digit)).toBeDisabled();

  // A new puzzle resets every badge to its own givens.
  await win.locator("#sudoku-new").click();
  const fresh = await bridge(page, "placedCounts");
  expect(await readBadges(page)).toEqual(
    DIGITS.map((other) => String(9 - fresh[other]))
  );
  await expect(keypad(win, digit)).toBeEnabled();
});

test("a wrong ninth placement still exhausts the digit and empties its badge", async ({
  page,
}) => {
  await installKeypadBridge(page);
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const digit = "7";
  const indexes = await bridge(page, "editableIndexesFor", digit);
  // Leave the digit's last true home open and spend the placement elsewhere.
  const spare = (await bridge(page, "editableIndexesFor", "3")).at(-1);
  expect(spare).toBeGreaterThanOrEqual(0);

  await bridge(page, "placeDigit", digit, indexes.slice(0, -1));
  await expect(badge(win, digit)).toHaveText("1");

  await cellAt(win, spare).click();
  await keypad(win, digit).click();
  await expect(badge(win, digit)).toBeEmpty();
  await expect(keypad(win, digit)).toHaveClass(/is-exhausted/);
  // Keyboard entry stays open, so the wrong placement can be overwritten.
  await cellAt(win, spare).click();
  await page.keyboard.press("3");
  await expect(badge(win, digit)).toHaveText("1");
  await expect(keypad(win, digit)).toBeEnabled();
});
