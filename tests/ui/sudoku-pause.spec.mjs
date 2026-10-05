import { expect, test } from "./deterministic.mjs";
import {
  FROZEN_INSTANT,
  REVIEW_VIEWPORTS,
  installDelayedSudokuGeneratorReplies,
  openHomeDesktop,
  openSudokuBoard,
} from "./helpers/rendered-site.mjs";

/**
 * Rendered contract for pause: the clock stops, every value and note goes
 * invisible, the board and control panel thin out over the aquarium, both are
 * inert, and one centred play button is the way back. A hidden tab pauses the
 * game the same way.
 */

test.setTimeout(120_000);

const DESKTOP = Object.freeze({ width: 1280, height: 800 });
/** Faded enough that the aquarium, not the board, is what reads through. */
const PAUSED_MAX_OPACITY = 0.3;

/** Moves the pinned clock forward without letting it tick on its own. */
const advanceClock = (page, seconds) =>
  page.clock.setFixedTime(new Date(FROZEN_INSTANT.getTime() + seconds * 1000));

/**
 * Resolves once the board is showing a puzzle of that difficulty. The app
 * element carries the same attribute, so the button is named explicitly.
 */
const waitForAdoptedDifficulty = (win, difficulty) =>
  expect(
    win.locator(`button[data-sudoku-difficulty="${difficulty}"]`)
  ).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });

const firstEditableIndex = (win) =>
  win.locator(".sudoku-cell:not(.is-given)").first().getAttribute("data-sudoku-index");

const readPausedLook = (page) =>
  page.evaluate(() => {
    const opacityOf = (selector) =>
      Number(getComputedStyle(document.querySelector(selector)).opacity);
    const cells = [...document.querySelectorAll("#sudoku-grid .sudoku-cell")];
    const isHidden = (element) => getComputedStyle(element).visibility === "hidden";
    return {
      frameOpacity: opacityOf(".sudoku-grid-frame"),
      panelOpacity: opacityOf(".sudoku-control-panel"),
      frameInert: document.querySelector(".sudoku-grid-frame").inert,
      panelInert: document.querySelector(".sudoku-control-panel").inert,
      visibleValues: cells.filter(
        (cell) => !isHidden(cell.querySelector(".sudoku-cell-value"))
      ).length,
      visibleNotes: cells.filter(
        (cell) => !isHidden(cell.querySelector(".sudoku-cell-notes"))
      ).length,
      resumeButtons: document.querySelectorAll(
        ".sudoku-pause-overlay .sudoku-play-button"
      ).length,
    };
  });

/** How far the resume button's centre sits from the board's centre. */
const resumeOffsetFromBoard = (page) =>
  page.evaluate(() => {
    const centreOf = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    };
    const board = centreOf("#sudoku-grid");
    const resume = centreOf("#sudoku-resume");
    return {
      x: Math.abs(board.x - resume.x),
      y: Math.abs(board.y - resume.y),
    };
  });

/** Writes one value and one pencil mark, so pause has something to hide. */
const seedBoard = async (page, win) => {
  const valueIndex = await firstEditableIndex(win);
  await win.locator(`.sudoku-cell[data-sudoku-index="${valueIndex}"]`).click();
  await page.keyboard.press("8");
  const noteIndex = await win
    .locator(".sudoku-cell:not(.is-given)")
    .nth(1)
    .getAttribute("data-sudoku-index");
  await win.locator("#sudoku-note-toggle").click();
  await win.locator(`.sudoku-cell[data-sudoku-index="${noteIndex}"]`).click();
  await page.keyboard.press("4");
  await win.locator("#sudoku-note-toggle").click();
  return { valueIndex, noteIndex };
};

for (const viewport of REVIEW_VIEWPORTS) {
  test(`a paused board hides its numbers behind one play button at ${viewport.name}`, async ({
    page,
  }) => {
    await openHomeDesktop(page, viewport);
    const win = await openSudokuBoard(page);
    await seedBoard(page, win);

    const app = win.locator(".sudoku-app");
    await expect(app).not.toHaveClass(/is-sudoku-paused/);
    await expect(win.locator("#sudoku-resume")).toBeHidden();

    await win.locator("#sudoku-pause").click();
    await expect(app).toHaveClass(/is-sudoku-paused/);
    await expect(win.locator("#sudoku-pause")).toHaveAttribute("aria-pressed", "true");
    await expect(win.locator("#sudoku-status")).toHaveText("Paused");

    // The wash fades in, so settle it before measuring.
    await expect
      .poll(async () => {
        const { frameOpacity, panelOpacity } = await readPausedLook(page);
        return Math.max(frameOpacity, panelOpacity);
      })
      .toBeLessThan(PAUSED_MAX_OPACITY);

    const look = await readPausedLook(page);
    expect(look.visibleValues).toBe(0);
    expect(look.visibleNotes).toBe(0);
    expect(look.frameInert).toBe(true);
    expect(look.panelInert).toBe(true);
    // One button, and it is the board's centre it sits on.
    expect(look.resumeButtons).toBe(1);
    await expect(win.locator("#sudoku-resume")).toBeVisible();
    const offset = await resumeOffsetFromBoard(page);
    expect(offset.x).toBeLessThan(1);
    expect(offset.y).toBeLessThan(1);
    // The aquarium keeps swimming behind the wash: pausing stops the clock.
    await expect(win.locator("#sudoku-aquarium-layer")).toBeVisible();

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    ).toBe(false);

    await win.locator("#sudoku-resume").click();
    await expect(app).not.toHaveClass(/is-sudoku-paused/);
    await expect(win.locator("#sudoku-resume")).toBeHidden();
    await expect
      .poll(async () => {
        const { frameOpacity, panelOpacity } = await readPausedLook(page);
        return Math.min(frameOpacity, panelOpacity);
      })
      .toBe(1);
    const resumed = await readPausedLook(page);
    expect(resumed.frameInert).toBe(false);
    expect(resumed.panelInert).toBe(false);
    expect(resumed.visibleValues).toBeGreaterThan(0);
  });
}

test("pause stops the clock and resume starts it from where it stopped", async ({
  page,
}) => {
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const time = win.locator("#sudoku-time");

  await advanceClock(page, 5);
  await expect(time).toHaveText("Time: 00:05");

  await win.locator("#sudoku-pause").click();
  await expect(time).toHaveText("Time: 00:05");

  // Six seconds pass with the game paused and the clock does not move.
  await advanceClock(page, 11);
  await expect(time).toHaveText("Time: 00:05");

  await win.locator("#sudoku-resume").click();
  await expect(time).toHaveText("Time: 00:05");
  await advanceClock(page, 14);
  await expect(time).toHaveText("Time: 00:08");
});

test("a paused board ignores clicks, digits, and undo", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const { valueIndex } = await seedBoard(page, win);
  const seeded = win.locator(`.sudoku-cell[data-sudoku-index="${valueIndex}"]`);
  await expect(seeded).toHaveAttribute("data-sudoku-value", "8");

  await win.locator("#sudoku-pause").click();

  // Pausing moves focus to the one control that still answers.
  await expect(win.locator("#sudoku-resume")).toBeFocused();

  // The board is inert, so a forced click reaches the overlay and no cell.
  await seeded.click({ force: true });
  await page.keyboard.press("3");
  await expect(seeded).toHaveAttribute("data-sudoku-value", "8");

  // Nor can the board be rewound out from under the pause.
  await page.keyboard.press("Control+z");
  await expect(seeded).toHaveAttribute("data-sudoku-value", "8");

  await win.locator("#sudoku-resume").click();
  await expect(win.locator("#sudoku-status")).toHaveText("Ready");
  await seeded.click();
  await page.keyboard.press("3");
  await expect(seeded).toHaveAttribute("data-sudoku-value", "3");
});

test("hiding the tab pauses the game and returning to it does not resume", async ({
  page,
}) => {
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const app = win.locator(".sudoku-app");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(app).toHaveClass(/is-sudoku-paused/);
  await expect(win.locator("#sudoku-status")).toHaveText("Paused");

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(app).toHaveClass(/is-sudoku-paused/);

  await win.locator("#sudoku-resume").click();
  await expect(app).not.toHaveClass(/is-sudoku-paused/);
});

test("closing Sudoku while paused reopens on the loader, not the pause", async ({
  page,
}) => {
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  await win.locator("#sudoku-pause").click();
  await expect(win.locator(".sudoku-app")).toHaveClass(/is-sudoku-paused/);

  await win.locator('[data-close="sudoku"]').click();
  await win.waitFor({ state: "hidden" });

  const reopened = await openSudokuBoard(page);
  await expect(reopened.locator(".sudoku-app")).not.toHaveClass(/is-sudoku-paused/);
  await expect(reopened.locator("#sudoku-pause")).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await expect(reopened.locator("#sudoku-status")).toHaveText("Ready");
});

test("a puzzle adopted while paused leaves the clock and the pause alone", async ({
  page,
}) => {
  await installDelayedSudokuGeneratorReplies(page, 600);
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const time = win.locator("#sudoku-time");
  const app = win.locator(".sudoku-app");

  await advanceClock(page, 5);
  await expect(time).toHaveText("Time: 00:05");

  // Hard is cold, so its puzzle is still being carved when Pause lands.
  await win.locator('button[data-sudoku-difficulty="hard"]').click();
  await win.locator("#sudoku-pause").click();
  await expect(app).toHaveClass(/is-sudoku-paused/);

  await waitForAdoptedDifficulty(win, "hard");
  await expect(win.locator("#sudoku-grid")).toHaveAttribute("aria-busy", "false");

  // The new board is adopted behind the overlay: still paused, still hidden,
  // and the clock reset by the new puzzle does not start running.
  await expect(app).toHaveClass(/is-sudoku-paused/);
  await expect(win.locator("#sudoku-status")).toHaveText("Paused");
  await expect(time).toHaveText("Time: 00:00");
  expect(await readPausedLook(page)).toMatchObject({
    frameInert: true,
    panelInert: true,
    visibleValues: 0,
    resumeButtons: 1,
  });
  await advanceClock(page, 10);
  await expect(time).toHaveText("Time: 00:00");

  // Resuming reports the new puzzle's own status, not the one the old board
  // carried into the pause, and only then does the clock move.
  await win.locator("#sudoku-resume").click();
  await expect(app).not.toHaveClass(/is-sudoku-paused/);
  await expect(win.locator("#sudoku-status")).toHaveText("Ready");
  await advanceClock(page, 14);
  await expect(time).toHaveText("Time: 00:04");
});

test("a puzzle adopted while the tab is hidden stays paused", async ({ page }) => {
  await installDelayedSudokuGeneratorReplies(page, 600);
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  const time = win.locator("#sudoku-time");
  const app = win.locator(".sudoku-app");

  await win.locator('button[data-sudoku-difficulty="extreme"]').click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(app).toHaveClass(/is-sudoku-paused/);

  await waitForAdoptedDifficulty(win, "extreme");
  await expect(app).toHaveClass(/is-sudoku-paused/);
  await expect(win.locator("#sudoku-status")).toHaveText("Paused");
  await advanceClock(page, 9);
  await expect(time).toHaveText("Time: 00:00");

  // Returning to the tab still does not resume, so the clock waits for the
  // play button even though a new puzzle landed while the tab was away.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(app).toHaveClass(/is-sudoku-paused/);
  await expect(time).toHaveText("Time: 00:00");

  await win.locator("#sudoku-resume").click();
  await expect(app).not.toHaveClass(/is-sudoku-paused/);
  await advanceClock(page, 13);
  await expect(time).toHaveText("Time: 00:04");
});
