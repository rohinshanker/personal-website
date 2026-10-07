import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import {
  REVIEW_VIEWPORTS,
  openApp,
  openHomeDesktop,
  openSudokuBoard,
  settleRender,
} from "./helpers/rendered-site.mjs";
import {
  deliverCanonicalMetric,
  installVerifiedGames,
  issuedDescriptor,
  readVerifiedGameSession,
} from "./helpers/verified-game-session.mjs";

/**
 * Verified Solitaire and Sudoku, in a real browser.
 *
 * The engines and the verification tests argue about rules; what has to be true
 * here is that the game a player sees really is the board the server issued, that
 * every move they make reaches the replay, and that the result published is the
 * one the rules derived. The session adapter is a fixture — the integration
 * commit owns the real one — and it records what the controllers did.
 */

const viewports = REVIEW_VIEWPORTS;

const SOLITAIRE_CONFIG = Object.freeze({ variant: "klondike-draw-one" });
const SUDOKU_CONFIG = Object.freeze({ difficulty: "easy" });

const solitaireIssued = issuedDescriptor("solitaire", SOLITAIRE_CONFIG, 0);
const sudokuIssued = issuedDescriptor("sudoku", SUDOKU_CONFIG, 0);

/** An issued board whose four packed runs are ready for the auto-solve control. */
const revealedIssued = () => {
  const runs = [
    ["spades", "hearts"],
    ["hearts", "spades"],
    ["clubs", "diamonds"],
    ["diamonds", "clubs"],
  ].map(([odd, even]) =>
    Array.from({ length: 13 }, (unused, offset) => {
      const rank = 13 - offset;
      return `${rank % 2 ? odd : even}-${rank}`;
    })
  );
  return {
    ...solitaireIssued,
    initial: {
      variant: "klondike-draw-one",
      rngState: 0,
      stock: [],
      waste: [],
      foundations: { spades: 0, clubs: 0, diamonds: 0, hearts: 0 },
      tableau: [
        ...runs.map((run) => ({ down: [], up: run })),
        { down: [], up: [] },
        { down: [], up: [] },
        { down: [], up: [] },
      ],
      moves: 0,
      won: false,
    },
  };
};

/** The blank cells of the issued puzzle, in grid order, with their answers. */
const sudokuEntries = () => {
  const { puzzle, solution } = sudokuIssued.initial;
  return Array.from({ length: 81 }, (unused, index) => index)
    .filter((index) => puzzle[index] === "0")
    .map((index) => ({ index, digit: solution[index] }));
};

/**
 * Closes the leaderboard profile prompt a published result opens. It holds the
 * screen on purpose, so a test that carries on playing has to put it away first.
 */
const dismissProfilePrompt = async (page) => {
  const prompt = page.locator("#game-profile-prompt");
  if (!(await prompt.isVisible())) return;
  await page.locator("#game-profile-close").click();
  await prompt.waitFor({ state: "hidden" });
};

/** The move counter as the three digits its seven-segment images show. */
const readMoveCounter = (page) =>
  page.locator("#sol-moves img").evaluateAll((images) => images.map((image) => image.alt).join(""));

const readSolitaireBoard = (page) =>
  page.evaluate(() => {
    const { solState } = window.homeSolitaire;
    return {
      stock: solState.stock.map((card) => card.id),
      waste: solState.waste.map((card) => card.id),
      tableau: solState.tableau.map((column) => column.map((card) => card.id)),
      foundations: Object.fromEntries(
        Object.entries(solState.foundations).map(([suit, cards]) => [suit, cards.length])
      ),
      moves: solState.moves,
      won: solState.won,
    };
  });

test("an issued Solitaire deal replaces the local one and every move enters the replay", async ({
  page,
}) => {
  await installVerifiedGames(page, { solitaire: solitaireIssued });
  await openHomeDesktop(page, viewports[2]);
  await openApp(page, "solitaire");

  const board = await readSolitaireBoard(page);
  expect(board.stock).toEqual(solitaireIssued.initial.stock);
  expect(board.tableau).toEqual(
    solitaireIssued.initial.tableau.map((pile) => [...pile.down, ...pile.up])
  );
  expect(board.moves).toBe(0);

  const opened = await readVerifiedGameSession(page);
  expect(opened.issued).toEqual([
    { game: "solitaire", config: {}, options: {}, served: true },
  ]);
  expect(opened.inputs).toEqual([]);

  // A draw, then an undo of it. Both are moves, so both have to be replayable.
  await page.locator("#sol-stock").click();
  await settleRender(page);
  const drawn = await readSolitaireBoard(page);
  expect(drawn.waste).toEqual([solitaireIssued.initial.stock.at(-1)]);
  expect(drawn.moves).toBe(1);
  expect(await readMoveCounter(page)).toBe("001");

  await page.locator("#sol-undo").click();
  await settleRender(page);
  const undone = await readSolitaireBoard(page);
  expect(undone.waste).toEqual([]);
  expect(undone.moves).toBe(0);
  await expect(page.locator("#sol-undo")).toBeDisabled();

  const played = await readVerifiedGameSession(page);
  expect(played.inputs.map((entry) => entry.action)).toEqual([
    { op: "draw", seq: 1 },
    { op: "undo", seq: 2 },
  ]);

  // Reset is a new board, so it needs a board of its own from the server.
  await page.locator("#sol-reset").click();
  await settleRender(page);
  expect((await readVerifiedGameSession(page)).issued).toHaveLength(2);
});

test("a Solitaire win publishes the engine's move count and takes the server's", async ({
  page,
}) => {
  // Eleven seconds of animation is the production cadence, not the contract.
  await routeHomeScript(page, "solitaire", (source) => {
    const faster = source
      .replace("firstIntervalMs: 1000,", "firstIntervalMs: 40,")
      .replace("minIntervalMs: 120,", "minIntervalMs: 12,");
    if (faster === source) throw new Error("Unable to speed up the auto-solve cadence.");
    return faster;
  });
  await installVerifiedGames(page, { solitaire: revealedIssued() });
  await openHomeDesktop(page, viewports[2]);
  await openApp(page, "solitaire");

  const autoSolve = page.locator("#sol-auto-solve");
  await expect(autoSolve).toBeVisible();
  await expect(autoSolve).toHaveClass(/is-completing/);
  await autoSolve.click();
  await page.waitForFunction(() => window.homeSolitaire.solState.won === true, undefined, {
    timeout: 20_000,
  });
  await settleRender(page);

  const won = await readSolitaireBoard(page);
  expect(won.foundations).toEqual({ spades: 13, clubs: 13, diamonds: 13, hearts: 13 });
  expect(won.moves).toBe(52);

  const session = await readVerifiedGameSession(page);
  const operations = session.inputs.map((entry) => entry.action.op);
  expect(operations[0]).toBe("autoRunStart");
  expect(operations.filter((op) => op.endsWith("ToFoundation"))).toHaveLength(52);
  expect(session.inputs.map((entry) => entry.action.seq)).toEqual(
    session.inputs.map((unused, index) => index + 1)
  );
  expect(session.published).toEqual([
    {
      game: "solitaire",
      payload: { type: "win", metric: 52 },
      replay: session.inputs.length,
      issued: true,
    },
  ]);

  // The server derives the move count from the replay; the board follows it.
  expect(await readMoveCounter(page)).toBe("052");
  expect(await deliverCanonicalMetric(page, "solitaire", 57)).toBe(true);
  expect(await readMoveCounter(page)).toBe("057");
  expect((await readSolitaireBoard(page)).moves).toBe(57);

  // A board that has been reset since is not the one the metric belongs to.
  await dismissProfilePrompt(page);
  await page.locator("#sol-reset").click();
  await settleRender(page);
  expect(await deliverCanonicalMetric(page, "solitaire", 99)).toBe(true);
  expect((await readSolitaireBoard(page)).moves).toBe(0);
});

test("an issued Sudoku puzzle records its entries, its pauses and its completion", async ({
  page,
}) => {
  await installVerifiedGames(page, { sudoku: sudokuIssued });
  await openHomeDesktop(page, viewports[2]);
  const win = await openSudokuBoard(page);

  const grid = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#sudoku-grid .sudoku-cell"))
      .map((cell) => (cell.classList.contains("is-given") ? cell.dataset.sudokuValue : "0"))
      .join("")
  );
  expect(grid).toBe(sudokuIssued.initial.puzzle);
  expect((await readVerifiedGameSession(page)).issued).toEqual([
    { game: "sudoku", config: { difficulty: "easy" }, options: {}, served: true },
  ]);

  // Pausing has to be visible to the server, or the time cannot be trusted.
  await win.locator("#sudoku-pause").click();
  await expect(win.locator("#sudoku-resume")).toBeVisible();
  await win.locator("#sudoku-resume").click();
  await expect(win.locator("#sudoku-resume")).toBeHidden();
  expect((await readVerifiedGameSession(page)).timing).toEqual([
    { game: "sudoku", op: "pause" },
    { game: "sudoku", op: "resume" },
  ]);

  const entries = sudokuEntries();
  const firstCell = win.locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${entries[0].index}"]`);
  await firstCell.click();
  // Entering a digit advances to the next editable cell, so the answers go in as
  // one pass over the blanks in grid order.
  await page.keyboard.type(entries.map((entry) => entry.digit).join(""));
  await settleRender(page);

  const entered = await readVerifiedGameSession(page);
  const values = entered.inputs.filter((entry) => entry.action.op === "setValue");
  expect(values).toHaveLength(entries.length);
  expect(values.map((entry) => entry.action.index)).toEqual(entries.map((entry) => entry.index));
  expect(values.map((entry) => entry.action.value)).toEqual(entries.map((entry) => entry.digit));
  expect(entered.published).toEqual([]);

  // Check is the submission, and the first one on a finished board publishes.
  await win.locator("#sudoku-check").click();
  await expect(win.locator("#sudoku-solve-popup")).toBeVisible();
  await settleRender(page);

  const finished = await readVerifiedGameSession(page);
  expect(finished.inputs.at(-1).action.op).toBe("check");
  expect(finished.published).toHaveLength(1);
  expect(finished.published[0].game).toBe("sudoku");
  expect(finished.published[0].issued).toBe(true);
  expect(finished.published[0].payload).toMatchObject({
    type: "win",
    difficulty: "easy",
    hintBucket: "noHints",
    metricKind: "seconds",
  });

  // The server observes the clock, so its elapsed time is the published one and
  // the timer on screen is brought into line with it.
  expect(await deliverCanonicalMetric(page, "sudoku", 754)).toBe(true);
  await expect(win.locator("#sudoku-time")).toHaveText("Time: 12:34");

  // A finished board is terminal: Check reopens its dialog and submits nothing.
  await dismissProfilePrompt(page);
  await win.locator("#sudoku-solve-ok").click();
  await win.locator("#sudoku-check").click();
  await expect(win.locator("#sudoku-solve-popup")).toBeVisible();
  expect((await readVerifiedGameSession(page)).published).toHaveLength(1);
});

for (const viewport of viewports) {
  test(`verified boards render and stay playable at ${viewport.name}`, async ({ page }) => {
    await installVerifiedGames(page, {
      solitaire: solitaireIssued,
      sudoku: sudokuIssued,
    });
    await openHomeDesktop(page, viewport);

    const solitaire = await openApp(page, "solitaire");
    await expect(solitaire).toBeVisible();
    // The tableau shows all twenty-eight dealt cards; the stock shows one
    // reusable back, however many cards are still behind it.
    await expect(solitaire.locator("#sol-tableau [data-sol-card-id]")).toHaveCount(28);
    await expect(solitaire.locator("#sol-stock .sol-card")).toHaveCount(1);
    // The board is laid out at its own width and the window scrolls to it, which
    // is how Solitaire has always fitted a seven-column tableau onto a phone. The
    // window itself has to stay inside the viewport, and every pile has to have
    // been laid out, whether or not it is scrolled into view.
    const windowBox = await solitaire.boundingBox();
    expect(windowBox.x).toBeGreaterThanOrEqual(0);
    expect(windowBox.x + windowBox.width).toBeLessThanOrEqual(viewport.width + 1);
    for (const zone of ["#sol-stock", "#sol-waste", "#sol-tableau"]) {
      const box = await solitaire.locator(zone).boundingBox();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }
    // A board wider than the window has to be scrollable to it, or its last
    // columns would be unplayable. Scrolling to the end is the proof.
    const lastColumn = solitaire.locator('[data-sol-col="6"]');
    await lastColumn.scrollIntoViewIfNeeded();
    const columnBox = await lastColumn.boundingBox();
    expect(columnBox.width).toBeGreaterThan(0);
    expect(columnBox.x).toBeGreaterThanOrEqual(windowBox.x - 1);
    expect(columnBox.x + columnBox.width).toBeLessThanOrEqual(
      windowBox.x + windowBox.width + 1
    );
    await solitaire.locator("#sol-stock").click();
    await settleRender(page);
    await expect(solitaire.locator('[data-sol-zone="waste"]')).toHaveCount(1);
    await solitaire.locator('[data-close="solitaire"]').click();
    await solitaire.waitFor({ state: "hidden" });

    const sudoku = await openSudokuBoard(page);
    await expect(sudoku.locator("#sudoku-grid .sudoku-cell")).toHaveCount(81);
    const gridBox = await sudoku.locator(".sudoku-grid-frame").boundingBox();
    expect(gridBox.width).toBeGreaterThan(0);
    expect(gridBox.width).toBeLessThanOrEqual(viewport.width);
    const blank = sudokuEntries()[0];
    await sudoku
      .locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${blank.index}"]`)
      .click();
    await page.keyboard.type(blank.digit);
    await settleRender(page);
    await expect(
      sudoku.locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${blank.index}"]`)
    ).toHaveAttribute("data-sudoku-value", blank.digit);

    const session = await readVerifiedGameSession(page);
    expect(session.issued.map((entry) => entry.game).sort()).toEqual(["solitaire", "sudoku"]);
    expect(session.inputs.filter((entry) => entry.game === "solitaire")).toHaveLength(1);
    expect(session.inputs.filter((entry) => entry.game === "sudoku").at(-1).action).toMatchObject({
      op: "setValue",
      index: blank.index,
      value: blank.digit,
    });
  });
}
