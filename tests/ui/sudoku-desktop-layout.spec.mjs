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
      aquarium: find(".sudoku-aero-panel"),
      frame: find(".sudoku-grid-frame"),
      keypad: find(".sudoku-number-grid"),
      difficulty: find(".sudoku-difficulty-grid"),
      digit: find(".sudoku-number-grid button"),
      hints: find(".sudoku-hint-options"),
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
          bottom: rect.bottom,
        };
      }),
      actions: find(".sudoku-control-panel .sudoku-actions"),
      actionButtons: ["new", "pause", "redo", "undo", "check"].map((id) =>
        find(`#sudoku-${id}`)
      ),
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

for (const viewport of [DESKTOP, { width: 768, height: 1024 }, { width: 1440, height: 900 }, { width: 681, height: 900 }]) {
  test(`Sudoku places its controls beside the board at ${viewport.width}px`, async ({ page }, testInfo) => {
    await openHomeDesktop(page, viewport);
    await openSudokuBoard(page);

    const layout = await readSudokuLayout(page);

    expect(layout.window.width).toBeCloseTo(Math.min(viewport.width * 0.94, 660), 1);
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
      "sudoku-pause",
      "sudoku-redo",
      "sudoku-undo",
      "sudoku-check",
    ]);

    const [newGame, pause, redo, undo, check] = layout.actionButtons;
    expect(newGame.top).toBeCloseTo(pause.top, 0);
    expect(redo.top).toBeCloseTo(undo.top, 0);
    expect(redo.top).toBeGreaterThanOrEqual(newGame.bottom);
    expect(check.top).toBeGreaterThanOrEqual(redo.bottom);
    for (const [left, right] of [[newGame, pause], [redo, undo]]) {
      expect(left.left).toBeCloseTo(layout.hints.left, 0);
      expect(right.right).toBeCloseTo(layout.hints.right, 0);
      expect(left.width).toBeCloseTo(right.width, 0);
    }
    expect(check.width).toBeCloseTo(newGame.width, 0);

    expect(layout.documentOverflows).toBe(false);
    expect(layout.window.right).toBeLessThanOrEqual(viewport.width);

    await page.screenshot({
      path: testInfo.outputPath(`sudoku-desktop-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
  });

}

for (const viewport of [MOBILE, { width: 680, height: 900 }]) {
  test(`Sudoku stacks aligned controls under the board at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await openHomeDesktop(page, viewport);
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
    expect(layout.window.right).toBeLessThanOrEqual(viewport.width);
    // Both panels share the aquarium's centered content track. The grid must
    // fit its own frame, including its borders, rather than overflow that track.
    expect(layout.frame.width).toBeCloseTo(layout.panel.width, 0);
    expect(layout.frame.left).toBeCloseTo(layout.panel.left, 0);
    expect(layout.frame.left - layout.aquarium.left).toBeCloseTo(
      layout.aquarium.right - layout.frame.right, 0
    );
    expect(layout.grid.left).toBeGreaterThan(layout.frame.left);
    expect(layout.grid.right).toBeLessThan(layout.frame.right);
    expect(layout.sections[0].top).toBeCloseTo(layout.sections[1].top, 0);
    expect(layout.keypad.top).toBeCloseTo(layout.difficulty.top, 0);
    expect(layout.keypad.bottom).toBeCloseTo(layout.hints.bottom, 0);
    expect(layout.digit.height).toBeGreaterThan(30);
    expect(layout.sections[0].width).toBeCloseTo(layout.sections[1].width, 0);
    const [newGame, pause, redo, undo, check] = layout.actionButtons;
    expect(newGame.top).toBeCloseTo(pause.top, 0);
    expect(check.top).toBeCloseTo(newGame.top, 0);
    expect(newGame.right).toBeLessThan(pause.left);
    expect(pause.right).toBeLessThan(check.left);
    expect(undo.top).toBeCloseTo(redo.top, 0);
    expect(undo.top).toBeGreaterThanOrEqual(check.bottom);
    expect(undo.right).toBeLessThan(redo.left);
    expect(undo.left - layout.actions.left).toBeCloseTo(
      layout.actions.right - redo.right, 0
    );

    await page.screenshot({
      path: testInfo.outputPath(`sudoku-mobile-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
  });

}

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
