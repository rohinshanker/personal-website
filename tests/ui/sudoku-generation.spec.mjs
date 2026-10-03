import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import {
  installDelayedSudokuGeneratorReplies,
  openHomeDesktop,
  openSudokuBoard,
} from "./helpers/rendered-site.mjs";

/**
 * Rendered contract for off-thread puzzle generation: the carve runs in a
 * worker, the boot loader offers Play on a real puzzle rather than on a
 * timer, New Game returns immediately whether or not a puzzle is warm, and a
 * browser that cannot start the worker still gets a playable board.
 */

test.setTimeout(180_000);

const DESKTOP = Object.freeze({ width: 1280, height: 800 });
const WORKER_SOURCE = "scripts/home/sudoku-generator.worker.js";
const GENERATION_TIMEOUT_MS = 60_000;
/** A click that carves a puzzle on this thread costs far more than this. */
const NON_BLOCKING_MS = 50;

const installGenerationBridge = async (page) => {
  await routeHomeScript(page, "sudoku", (source) =>
    source.replace(
      /\n\}\)\(\);\s*$/,
      `
window.__sudokuGenerationTest = Object.freeze({
  readPuzzle: () => ({
    difficulty: sudokuState.difficulty,
    puzzle: sudokuState.puzzle,
    puzzleId: sudokuState.puzzleId,
    solution: sudokuState.solution,
  }),
  staticPuzzleFor: (difficulty) => SUDOKU_PUZZLES[difficulty].puzzle,
  pooledCountFor: (difficulty) => sudokuPuzzlePool.get(difficulty)?.length || 0,
  waiterCountFor: (difficulty) => sudokuPuzzleWaiters.get(difficulty)?.length || 0,
  inFlightCount: () => sudokuGeneratorRequests.size,
  isPuzzleReady: () => sudokuPuzzleReady,
  readBoard: () => ({
    undoDisabled: sudokuUndo.disabled,
    // Blank cells read as "0" so the board compares against a puzzle string.
    values: sudokuState.values.map((value) => value || "0").join(""),
  }),
});
})();`
    )
  );
};

const bridge = (page, method, ...args) =>
  page.evaluate(
    ([name, params]) => window.__sudokuGenerationTest[name](...params),
    [method, args]
  );

/** Clicks in page context and reports how long the main thread was held. */
const timeClick = (page, selector) =>
  page.evaluate((target) => {
    const start = performance.now();
    document.querySelector(target).click();
    return performance.now() - start;
  }, selector);

const waitForGeneratedBoard = async (page, win, previousDifficulty) => {
  await expect(win.locator("#sudoku-grid")).toHaveAttribute("aria-busy", "false", {
    timeout: GENERATION_TIMEOUT_MS,
  });
  await expect
    .poll(async () => (await bridge(page, "readPuzzle")).difficulty, {
      timeout: GENERATION_TIMEOUT_MS,
    })
    .not.toBe(previousDifficulty);
  return bridge(page, "readPuzzle");
};

test("the boot loader offers Play on a real puzzle carved in the worker", async ({
  page,
}) => {
  await installGenerationBridge(page);
  await openHomeDesktop(page, DESKTOP);

  // The worker source is prefetched with a version token like every other
  // shipped asset, and the Sudoku feature reads its URL from that declaration.
  const source = page.locator("#sudoku-generator-source");
  await expect(source).toHaveAttribute("as", "worker");
  expect(await source.getAttribute("href")).toMatch(
    new RegExp(`^${WORKER_SOURCE.replace(/[.]/g, "[.]")}[?]v=.+$`)
  );

  // Fetching the file is not running it: nobody has carved a puzzle on a
  // page where Sudoku was never opened.
  expect(await bridge(page, "isPuzzleReady")).toBe(false);
  expect((await bridge(page, "readPuzzle")).puzzle).toBe("0".repeat(81));

  const win = await openSudokuBoard(page);
  expect(await bridge(page, "isPuzzleReady")).toBe(true);

  // Play was offered only once a real puzzle existed behind the loader.
  const state = await bridge(page, "readPuzzle");
  expect(state.puzzle).toMatch(/^[0-9]{81}$/);
  expect(state.puzzle.replace(/0/g, "").length).toBeGreaterThan(20);
  expect(state.solution).toMatch(/^[1-9]{81}$/);
  expect(state.puzzleId).toMatch(/^generated-easy-/);
  await expect(win.locator(".sudoku-cell.is-given")).toHaveCount(
    state.puzzle.replace(/0/g, "").length
  );

  // One spare is kept warm for the difficulty in play, and no others.
  await expect
    .poll(() => bridge(page, "pooledCountFor", "easy"), { timeout: GENERATION_TIMEOUT_MS })
    .toBe(1);
  expect(await bridge(page, "pooledCountFor", "extreme")).toBe(0);
});

test("New Game and a cold difficulty both return without holding the thread", async ({
  page,
}) => {
  await installGenerationBridge(page);
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);
  await expect
    .poll(() => bridge(page, "pooledCountFor", "easy"), { timeout: GENERATION_TIMEOUT_MS })
    .toBe(1);

  // A warm New Game swaps the board in the same tick. The suite pins the
  // generator's draws, so every carve yields the same grid; a fresh board is
  // what proves the swap, not a different puzzle string.
  const firstEditable = await win
    .locator(".sudoku-cell:not(.is-given)")
    .first()
    .getAttribute("data-sudoku-index");
  await win.locator(`.sudoku-cell[data-sudoku-index="${firstEditable}"]`).click();
  await page.keyboard.press("8");
  expect((await bridge(page, "readBoard")).undoDisabled).toBe(false);

  expect(await timeClick(page, "#sudoku-new")).toBeLessThan(NON_BLOCKING_MS);
  const swapped = await bridge(page, "readBoard");
  expect(swapped.undoDisabled).toBe(true);
  expect(swapped.values).toBe((await bridge(page, "readPuzzle")).puzzle);
  await expect(win.locator("#sudoku-grid")).toHaveAttribute("aria-busy", "false");
  // The spare was spent, and the worker refills it in the background.
  await expect
    .poll(() => bridge(page, "pooledCountFor", "easy"), { timeout: GENERATION_TIMEOUT_MS })
    .toBe(1);
  const second = await bridge(page, "readPuzzle");

  // Extreme has never been played, so nothing is pooled for it. The click
  // still returns at once; carving it on this thread is what used to freeze
  // the window for seconds.
  expect(await bridge(page, "pooledCountFor", "extreme")).toBe(0);
  expect(
    await timeClick(page, '[data-sudoku-difficulty="extreme"]')
  ).toBeLessThan(NON_BLOCKING_MS);

  const extreme = await waitForGeneratedBoard(page, win, second.difficulty);
  expect(extreme.difficulty).toBe("extreme");
  expect(extreme.puzzleId).toMatch(/^generated-extreme-/);
  expect(extreme.solution).toMatch(/^[1-9]{81}$/);
  await expect(win.locator("#sudoku-status")).toHaveText("Ready");

  // The board is playable straight away.
  const extremeEditable = await win
    .locator(".sudoku-cell:not(.is-given)")
    .first()
    .getAttribute("data-sudoku-index");
  await win.locator(`.sudoku-cell[data-sudoku-index="${extremeEditable}"]`).click();
  await page.keyboard.press("7");
  await expect(
    win.locator(`.sudoku-cell[data-sudoku-index="${extremeEditable}"]`)
  ).toHaveAttribute("data-sudoku-value", "7");
});

test("a browser that cannot start the worker still gets a playable board", async ({
  page,
}) => {
  await installGenerationBridge(page);
  await page.addInitScript(() => {
    // Constructing a worker throws on some locked-down configurations.
    window.Worker = function BlockedWorker() {
      throw new Error("Workers are unavailable.");
    };
  });

  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);

  // The static puzzle the site already ships for that difficulty is used,
  // rather than moving the carve back onto this thread.
  const state = await bridge(page, "readPuzzle");
  expect(state.puzzle).toBe(await bridge(page, "staticPuzzleFor", "easy"));
  await expect(win.locator("#sudoku-grid")).toHaveAttribute("aria-busy", "false");
  await expect(win.locator("#sudoku-status")).toHaveText("Ready");

  // New Game is still instant and still leaves a playable board.
  expect(await timeClick(page, "#sudoku-new")).toBeLessThan(NON_BLOCKING_MS);
  expect((await bridge(page, "readPuzzle")).puzzle).toBe(
    await bridge(page, "staticPuzzleFor", "easy")
  );
  const firstEditable = await win
    .locator(".sudoku-cell:not(.is-given)")
    .first()
    .getAttribute("data-sudoku-index");
  await win.locator(`.sudoku-cell[data-sudoku-index="${firstEditable}"]`).click();
  await page.keyboard.press("5");
  await expect(
    win.locator(`.sudoku-cell[data-sudoku-index="${firstEditable}"]`)
  ).toHaveAttribute("data-sudoku-value", "5");
});

test("every later request is served once the worker cannot start", async ({
  page,
}) => {
  await installGenerationBridge(page);
  await page.addInitScript(() => {
    window.Worker = function BlockedWorker() {
      throw new Error("Workers are unavailable.");
    };
  });

  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);

  // A difficulty nobody has played has nothing pooled and no worker to carve
  // one. It must still swap the board rather than leaving the previous puzzle
  // up behind a Generating status that never clears.
  expect(await bridge(page, "pooledCountFor", "hard")).toBe(0);
  expect(
    await timeClick(page, '[data-sudoku-difficulty="hard"]')
  ).toBeLessThan(NON_BLOCKING_MS);

  const hard = await bridge(page, "readPuzzle");
  expect(hard.difficulty).toBe("hard");
  expect(hard.puzzle).toBe(await bridge(page, "staticPuzzleFor", "hard"));
  expect(hard.puzzleId).toMatch(/^generated-hard-/);
  await expect(win.locator("#sudoku-grid")).toHaveAttribute("aria-busy", "false");
  await expect(win.locator("#sudoku-status")).toHaveText("Ready");
  expect(await bridge(page, "waiterCountFor", "hard")).toBe(0);
  expect(await bridge(page, "inFlightCount")).toBe(0);

  // New Game keeps working past the point where any accidental spare is
  // spent, and so does a second difficulty change.
  for (let game = 0; game < 3; game += 1) {
    expect(await timeClick(page, "#sudoku-new")).toBeLessThan(NON_BLOCKING_MS);
    expect((await bridge(page, "readPuzzle")).puzzle).toBe(
      await bridge(page, "staticPuzzleFor", "hard")
    );
    await expect(win.locator("#sudoku-grid")).toHaveAttribute("aria-busy", "false");
  }

  expect(
    await timeClick(page, '[data-sudoku-difficulty="extreme"]')
  ).toBeLessThan(NON_BLOCKING_MS);
  expect((await bridge(page, "readPuzzle")).puzzle).toBe(
    await bridge(page, "staticPuzzleFor", "extreme")
  );
  await expect(win.locator("#sudoku-status")).toHaveText("Ready");

  // The board is playable, so the fallback never leaves an inert grid.
  const editable = await win
    .locator(".sudoku-cell:not(.is-given)")
    .first()
    .getAttribute("data-sudoku-index");
  await win.locator(`.sudoku-cell[data-sudoku-index="${editable}"]`).click();
  await page.keyboard.press("4");
  await expect(
    win.locator(`.sudoku-cell[data-sudoku-index="${editable}"]`)
  ).toHaveAttribute("data-sudoku-value", "4");
});

test("impatient clicks on a cold difficulty stay one board's worth of work", async ({
  page,
}) => {
  await installGenerationBridge(page);
  await installDelayedSudokuGeneratorReplies(page, 600);
  await openHomeDesktop(page, DESKTOP);
  const win = await openSudokuBoard(page);

  // Ten clicks land while the first carve is still outstanding. Only the last
  // one can reach the board, so the nine before it are withdrawn instead of
  // each drawing a generation of its own.
  await page.evaluate(() => {
    const button = document.querySelector('button[data-sudoku-difficulty="extreme"]');
    for (let click = 0; click < 10; click += 1) button.click();
  });
  expect(await bridge(page, "waiterCountFor", "extreme")).toBe(1);
  expect(await bridge(page, "inFlightCount")).toBeLessThanOrEqual(2);

  const extreme = await waitForGeneratedBoard(page, win, "easy");
  expect(extreme.difficulty).toBe("extreme");
  await expect(win.locator("#sudoku-status")).toHaveText("Ready");

  // Once everything settles, the pool holds the one warm spare it is meant
  // to, and no request is left running.
  await expect
    .poll(() => bridge(page, "inFlightCount"), { timeout: GENERATION_TIMEOUT_MS })
    .toBe(0);
  expect(await bridge(page, "pooledCountFor", "extreme")).toBe(1);
  expect(await bridge(page, "waiterCountFor", "extreme")).toBe(0);
});
