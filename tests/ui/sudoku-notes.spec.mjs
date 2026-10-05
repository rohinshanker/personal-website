import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import {
  REVIEW_VIEWPORTS,
  openHomeDesktop,
  openSudokuBoard,
} from "./helpers/rendered-site.mjs";

/**
 * Rendered contract for the note assistance: pencil marks naming the selected
 * value light up across the board, and placing a digit retires that mark from
 * the row, column, and box it just ruled it out of — as part of the same move,
 * so one undo puts the placement and every cleared note back.
 */

test.setTimeout(120_000);

const DESKTOP = Object.freeze({ width: 1280, height: 800 });
const NOTE_HIGHLIGHT = "rgba(0, 176, 255, 0.4)";
const SEEDED_NOTES = "45";
const PLACED = "4";

/** Reports board geography and seeds notes through the production setter. */
const installNotesBridge = async (page) => {
  await routeHomeScript(page, "sudoku", (source) =>
    source.replace(
      /\n\}\)\(\);\s*$/,
      `
window.__sudokuNotesTest = Object.freeze({
  // An editable empty cell, one editable empty peer in each of its row,
  // column, and box, and one editable empty cell sharing none of them.
  pickNoteScenario: () => {
    const cells = sudokuCells();
    const open = (index) =>
      !isSudokuCellReadOnly(cells[index]) && !sudokuState.values[index];
    const unitsOf = (index) => {
      const row = Math.floor(index / 9);
      const column = index % 9;
      return { row, column, box: sudokuBoxIndex(row, column) };
    };
    for (let target = 0; target < cells.length; target += 1) {
      if (!open(target)) continue;
      const home = unitsOf(target);
      const find = (matches) =>
        cells.findIndex((unusedCell, index) => {
          if (index === target || !open(index)) return false;
          return matches(unitsOf(index));
        });
      const inRow = find((u) => u.row === home.row && u.box !== home.box);
      const inColumn = find((u) => u.column === home.column && u.box !== home.box);
      const inBox = find(
        (u) => u.box === home.box && u.row !== home.row && u.column !== home.column
      );
      const outside = find(
        (u) => u.row !== home.row && u.column !== home.column && u.box !== home.box
      );
      if (inRow >= 0 && inColumn >= 0 && inBox >= 0 && outside >= 0) {
        return { target, inRow, inColumn, inBox, outside };
      }
    }
    return null;
  },
  seedNotes: (indexes, notes) => {
    const cells = sudokuCells();
    indexes.forEach((index) => {
      setSudokuCellNotes(cells[index], index, notes);
    });
    updateSudokuBoardHighlights();
    updateSudokuNumberButtons();
  },
  readNotes: (indexes) => indexes.map((index) => sudokuState.notes[index]),
  valueAt: (index) => sudokuState.values[index],
  givenIndexFor: (digit) =>
    sudokuCells().findIndex(
      (cell, index) => isSudokuCellReadOnly(cell) && sudokuState.puzzle[index] === digit
    ),
});
})();`
    )
  );
};

const bridge = (page, method, ...args) =>
  page.evaluate(
    ([name, params]) => window.__sudokuNotesTest[name](...params),
    [method, args]
  );

const cellAt = (win, index) => win.locator(`.sudoku-cell[data-sudoku-index="${index}"]`);

const noteAt = (win, index, digit) =>
  cellAt(win, index).locator(`.sudoku-note-digit[data-sudoku-note="${digit}"]`);

/** Opens Sudoku with the scenario cells already pencilled in. */
const openSeededBoard = async (page, viewport) => {
  await installNotesBridge(page);
  await openHomeDesktop(page, viewport);
  const win = await openSudokuBoard(page);
  const scenario = await bridge(page, "pickNoteScenario");
  expect(scenario).not.toBeNull();
  const { target, ...rest } = scenario;
  const seeded = Object.values(rest);
  await bridge(page, "seedNotes", seeded, SEEDED_NOTES);
  return { scenario, seeded, win };
};

for (const viewport of REVIEW_VIEWPORTS) {
  test(`notes naming the selected value light up at ${viewport.name}`, async ({
    page,
  }) => {
    const { scenario, seeded, win } = await openSeededBoard(page, viewport);

    // Nothing is selected yet, so no pencil mark is singled out.
    await expect(win.locator("#sudoku-grid")).not.toHaveAttribute(
      "data-sudoku-note-highlight",
      /./
    );

    // Selecting a given that holds the digit lights its pencil marks. A
    // given is used on purpose: selection alone drives the highlight, with
    // no placement to retire any of the marks under test.
    const given = await bridge(page, "givenIndexFor", PLACED);
    expect(given).toBeGreaterThanOrEqual(0);
    await cellAt(win, given).click();
    await expect(win.locator("#sudoku-grid")).toHaveAttribute(
      "data-sudoku-note-highlight",
      PLACED
    );

    const painted = await page.evaluate(
      ({ highlight, indexes, placed }) => {
        const slots = [...document.querySelectorAll("#sudoku-grid .sudoku-note-digit")];
        const read = (index, digit) =>
          getComputedStyle(
            document.querySelector(
              `.sudoku-cell[data-sudoku-index="${index}"] .sudoku-note-digit[data-sudoku-note="${digit}"]`
            )
          ).backgroundColor;
        const lit = slots.filter(
          (slot) => getComputedStyle(slot).backgroundColor === highlight
        );
        return {
          matching: indexes.map((index) => read(index, placed)),
          other: indexes.map((index) => read(index, "5")),
          litCount: lit.length,
          litAreWritten: lit.every((slot) => slot.textContent === placed),
        };
      },
      { highlight: NOTE_HIGHLIGHT, indexes: seeded, placed: PLACED }
    );
    expect(painted.matching.every((color) => color === NOTE_HIGHLIGHT)).toBe(true);
    expect(painted.other.some((color) => color === NOTE_HIGHLIGHT)).toBe(false);
    // Only written pencil marks light up; the other eighty cells hold empty
    // slots for the same digit and must stay blank.
    expect(painted.litCount).toBe(seeded.length);
    expect(painted.litAreWritten).toBe(true);


    // Selecting a cell with no value puts every pencil mark back on the level.
    await cellAt(win, scenario.target).click();
    await expect(win.locator("#sudoku-grid")).not.toHaveAttribute(
      "data-sudoku-note-highlight",
      /./
    );
    expect(
      await noteAt(win, scenario.inRow, PLACED).evaluate(
        (element) => getComputedStyle(element).backgroundColor
      )
    ).not.toBe(NOTE_HIGHLIGHT);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);
  });
}

test("placing a digit retires that note from its row, column, and box", async ({ page }) => {
  const { scenario, seeded, win } = await openSeededBoard(page, DESKTOP);
  const peers = [scenario.inRow, scenario.inColumn, scenario.inBox];

  expect(await bridge(page, "readNotes", seeded)).toEqual(seeded.map(() => SEEDED_NOTES));

  await cellAt(win, scenario.target).click();
  await page.keyboard.press(PLACED);
  await expect(cellAt(win, scenario.target)).toHaveAttribute("data-sudoku-value", PLACED);

  // The three peers lose only the digit that was just ruled out.
  expect(await bridge(page, "readNotes", peers)).toEqual(["5", "5", "5"]);
  for (const peer of peers) {
    await expect(noteAt(win, peer, PLACED)).toBeEmpty();
    await expect(noteAt(win, peer, "5")).toHaveText("5");
    await expect(cellAt(win, peer)).toHaveClass(/has-notes/);
  }
  // A cell sharing no unit is untouched.
  expect(await bridge(page, "readNotes", [scenario.outside])).toEqual([SEEDED_NOTES]);

  // The clearing is part of the placement, so one undo reverses both.
  await win.locator("#sudoku-undo").click();
  expect(await bridge(page, "valueAt", scenario.target)).toBe("");
  expect(await bridge(page, "readNotes", seeded)).toEqual(seeded.map(() => SEEDED_NOTES));
  for (const peer of peers) {
    await expect(noteAt(win, peer, PLACED)).toHaveText(PLACED);
  }

  // And one redo replays it.
  await win.locator("#sudoku-redo").click();
  expect(await bridge(page, "valueAt", scenario.target)).toBe(PLACED);
  expect(await bridge(page, "readNotes", peers)).toEqual(["5", "5", "5"]);

  // Erasing the value does not bring the retired notes back on its own.
  await cellAt(win, scenario.target).click();
  await page.keyboard.press("Backspace");
  expect(await bridge(page, "valueAt", scenario.target)).toBe("");
  expect(await bridge(page, "readNotes", peers)).toEqual(["5", "5", "5"]);
});

test("a note entered in notes mode clears its peers when it becomes a value", async ({
  page,
}) => {
  const { scenario, win } = await openSeededBoard(page, DESKTOP);

  // Notes mode writes a pencil mark and retires nothing: it is not a placement.
  await win.locator("#sudoku-note-toggle").click();
  await cellAt(win, scenario.target).click();
  await page.keyboard.press(PLACED);
  await expect(noteAt(win, scenario.target, PLACED)).toHaveText(PLACED);
  expect(await bridge(page, "readNotes", [scenario.inRow])).toEqual([SEEDED_NOTES]);

  // Leaving notes mode and placing the same digit does retire them.
  await win.locator("#sudoku-note-toggle").click();
  await cellAt(win, scenario.target).click();
  await page.keyboard.press(PLACED);
  await expect(cellAt(win, scenario.target)).toHaveAttribute("data-sudoku-value", PLACED);
  expect(await bridge(page, "readNotes", [scenario.inRow])).toEqual(["5"]);
});
