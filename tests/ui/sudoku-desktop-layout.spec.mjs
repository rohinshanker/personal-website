import { expect, test } from "./deterministic.mjs";
import { openHomeDesktop, openSudokuBoard } from "./helpers/rendered-site.mjs";

/**
 * Rendered geometry for the Sudoku window layout contract: controls sit beside
 * the board on desktop in the order Numbers, Difficulty, Hints, actions; they
 * stack below it in the compact container; and the status bar keeps the timer
 * in a fixed track so changing digits cannot shift its neighbours.
 */

const DESKTOP = Object.freeze({ width: 1280, height: 800 });
const MOBILE = Object.freeze({ width: 375, height: 812 });

/**
 * Reads the geometry of the Sudoku layout from the visible window only.
 *
 * @param {import("@playwright/test").Page} page
 */
const readSudokuLayout = (page) =>
  page.evaluate(() => {
    const win = document.querySelector('[data-app-window="sudoku"]');
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const find = (selector) => box(win.querySelector(selector));
    const panel = win.querySelector(".sudoku-control-panel");
    return {
      window: box(win),
      board: find(".sudoku-board-column"),
      grid: find("#sudoku-grid"),
      panel: box(panel),
      panelInsetBottom:
        Number.parseFloat(getComputedStyle(panel).paddingBottom) +
        Number.parseFloat(getComputedStyle(panel).borderBottomWidth),
      sections: [...panel.querySelectorAll(".sudoku-control-section")].map((section) => {
        const rect = section.getBoundingClientRect();
        return {
          label: section.querySelector(".sudoku-panel-label").textContent.trim(),
          top: rect.top,
          left: rect.left,
          width: rect.width,
        };
      }),
      actions: find(".sudoku-control-panel .sudoku-actions"),
      actionOrder: [...win.querySelectorAll(".sudoku-control-panel .sudoku-actions button")].map(
        (button) => button.id
      ),
      statusBar: find(".sudoku-statusbar"),
      mistakes: find("#sudoku-mistakes"),
      time: find("#sudoku-time"),
      checks: find("#sudoku-leaderboard-checks"),
      documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

test("Sudoku places its controls beside the board on desktop", async ({ page }, testInfo) => {
  await openHomeDesktop(page, DESKTOP);
  await openSudokuBoard(page);

  const layout = await readSudokuLayout(page);

  expect(layout.window.width).toBeCloseTo(Math.min(DESKTOP.width * 0.94, 660), 1);
  expect(layout.panel.left).toBeGreaterThanOrEqual(layout.board.right);
  expect(layout.panel.top).toBeCloseTo(layout.board.top, 0);
  expect(layout.panel.bottom).toBeCloseTo(layout.board.bottom, 0);
  expect(layout.panel.width).toBeGreaterThanOrEqual(168);

  expect(layout.sections.map((section) => section.label)).toEqual([
    "Numbers",
    "Difficulty",
    "Hints",
  ]);
  const sectionTops = layout.sections.map((section) => section.top);
  expect(sectionTops).toEqual([...sectionTops].sort((a, b) => a - b));

  // The action row is pinned to the bottom of the control panel column.
  expect(layout.actions.top).toBeGreaterThan(sectionTops.at(-1));
  expect(layout.panel.bottom - layout.actions.bottom).toBeCloseTo(
    layout.panelInsetBottom,
    0
  );
  expect(layout.actions.left).toBeGreaterThanOrEqual(layout.board.right);
  expect(layout.actionOrder).toEqual([
    "sudoku-new",
    "sudoku-undo",
    "sudoku-redo",
    "sudoku-check",
  ]);

  expect(layout.documentOverflows).toBe(false);
  expect(layout.window.right).toBeLessThanOrEqual(DESKTOP.width);

  await page.screenshot({
    path: testInfo.outputPath("sudoku-desktop-1280x800.png"),
    fullPage: true,
  });
});

test("Sudoku stacks its controls under the board in the compact container", async ({
  page,
}, testInfo) => {
  await openHomeDesktop(page, MOBILE);
  await openSudokuBoard(page);

  const layout = await readSudokuLayout(page);

  expect(layout.panel.top).toBeGreaterThanOrEqual(layout.board.bottom);
  expect(layout.panel.left).toBeCloseTo(layout.board.left, 0);

  // The control sections share two tracks and the action row spans both.
  expect(layout.sections).toHaveLength(3);
  expect(layout.sections[0].left).toBeLessThan(layout.sections[1].left);
  expect(layout.actions.left).toBeCloseTo(layout.sections[0].left, 0);
  expect(layout.actions.right).toBeCloseTo(
    layout.sections[1].left + layout.sections[1].width,
    0
  );

  expect(layout.documentOverflows).toBe(false);
  expect(layout.window.left).toBeGreaterThanOrEqual(0);
  expect(layout.window.right).toBeLessThanOrEqual(MOBILE.width);
  // The board is allowed to exceed its column track, but never the window.
  expect(layout.grid.left).toBeGreaterThanOrEqual(layout.window.left);
  expect(layout.grid.right).toBeLessThanOrEqual(layout.window.right);

  await page.screenshot({
    path: testInfo.outputPath("sudoku-mobile-375x812.png"),
    fullPage: true,
  });
});

test("the Sudoku status bar holds the timer in place while its neighbours change", async ({
  page,
}) => {
  await openHomeDesktop(page, DESKTOP);
  await openSudokuBoard(page);

  const before = await readSudokuLayout(page);
  await expect(page.locator("#sudoku-leaderboard-checks")).toHaveText(
    "0/3 allowed checks used to place on leaderboard"
  );
  // The checks row owns a full-width track under the other status items.
  expect(before.checks.top).toBeGreaterThanOrEqual(before.time.bottom - 1);
  expect(before.checks.width).toBeCloseTo(before.statusBar.width, 0);

  const widened = await page.evaluate(() => {
    const mistakes = document.getElementById("sudoku-mistakes");
    const time = document.getElementById("sudoku-time");
    mistakes.textContent = "Mistakes 8888/3";
    time.textContent = "88:88";
    const rect = time.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width };
  });

  expect(widened.left).toBeCloseTo(before.time.left, 0);
  expect(widened.width).toBeCloseTo(before.time.width, 0);
});
