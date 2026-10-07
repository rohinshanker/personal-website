import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import {
  DETERMINISTIC_RANDOM_DRAW,
  FROZEN_INSTANT,
  REVIEW_VIEWPORTS,
  consumeDiagnostics,
  installGameStatsBackend,
  openApp,
  openSudokuBoard,
  settleRender,
} from "./helpers/rendered-site.mjs";
import {
  ISSUED_API_BASE_URL,
  installVerifiedGames,
  issuedDescriptor,
} from "./helpers/verified-game-session.mjs";

/**
 * Verified Solitaire and Sudoku, in a real browser, against the real session
 * adapter. Only the Worker's API is answered locally.
 *
 * The engines and the Node tests argue about rules; what has to be true here is
 * that the game a player sees is the board the server issued, that every move
 * they make reaches the replay the server will verify, and that a board the
 * server will not vouch for keeps playing and keeps quiet.
 */

const viewports = REVIEW_VIEWPORTS;
const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const SUDOKU_STORAGE_KEY = "personalSiteSudokuStateV1";
const INITIALIZED_MARKER = "personalSiteVerifiedGamesInitialized";

const SOLITAIRE_CONFIG = Object.freeze({ variant: "klondike-draw-one" });
const SUDOKU_CONFIG = Object.freeze({ difficulty: "easy" });

const profile = Object.freeze({
  id: "player-verified-games",
  name: "Replay Verifier",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

const solitaireBoard = () => issuedDescriptor("solitaire", SOLITAIRE_CONFIG, 0);
const sudokuBoard = () => issuedDescriptor("sudoku", SUDOKU_CONFIG, 0);

/** An issued deal whose four packed runs are ready for the auto-solve control. */
const revealedBoard = () => {
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
  return issuedDescriptor("solitaire", SOLITAIRE_CONFIG, 1, {
    id: "session-solitaire-revealed",
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
  });
};

/** The blank cells of the issued puzzle, in grid order, with their answers. */
const sudokuEntries = (descriptor) => {
  const { puzzle, solution } = descriptor.initial;
  return Array.from({ length: 81 }, (unused, index) => index)
    .filter((index) => puzzle[index] === "0")
    .map((index) => ({ index, digit: solution[index] }));
};

/**
 * Opens Home with a chosen leaderboard profile and a backend only this suite
 * answers. Storage is cleared once rather than on every load, because a reload
 * is the point of the restoration cases: a saved puzzle has to survive it.
 */
const openVerifiedPage = async (page, viewport, options) => {
  await page.clock.setFixedTime(FROZEN_INSTANT);
  await page.setViewportSize(viewport);
  await installGameStatsBackend(page, { apiBaseUrl: ISSUED_API_BASE_URL });
  const api = await installVerifiedGames(page, options);
  await page.addInitScript(
    ({ draw, marker, profileKey, savedProfile }) => {
      // Weighted random events all draw below this value, so none fire.
      Math.random = () => draw;
      if (sessionStorage.getItem(marker) === "1") return;
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem(marker, "1");
      if (savedProfile) localStorage.setItem(profileKey, JSON.stringify(savedProfile));
    },
    {
      draw: DETERMINISTIC_RANDOM_DRAW,
      marker: INITIALIZED_MARKER,
      profileKey: PROFILE_STORAGE_KEY,
      savedProfile: "profile" in options ? options.profile : profile,
    }
  );
  await page.goto("/home.html", { waitUntil: "load" });
  await settleRender(page);
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) {
    await aboutClose.click();
    await page.locator("#about-window").waitFor({ state: "hidden" });
  }
  return api;
};

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
      session: solState.statsSession,
    };
  });

/** The move counter as the three digits its seven-segment images show. */
const readMoveCounter = (page) =>
  page.locator("#sol-moves img").evaluateAll((images) => images.map((image) => image.alt).join(""));

/** Closes the leaderboard profile prompt a published result can open. */
const dismissProfilePrompt = async (page) => {
  const prompt = page.locator("#game-profile-prompt");
  if (!(await prompt.isVisible())) return;
  await page.locator("#game-profile-close").click();
  await prompt.waitFor({ state: "hidden" });
};

test("an issued Solitaire deal replaces the local one and every move reaches the replay", async ({
  page,
}) => {
  const board = solitaireBoard();
  const api = await openVerifiedPage(page, viewports[2], { boards: { solitaire: board } });
  await openApp(page, "solitaire");
  await expect.poll(() => api.issued.length).toBe(1);
  await settleRender(page);

  const shown = await readSolitaireBoard(page);
  expect(shown.stock).toEqual(board.initial.stock);
  expect(shown.tableau).toEqual(
    board.initial.tableau.map((pile) => [...pile.down, ...pile.up])
  );
  expect(shown.moves).toBe(0);
  expect(shown.session).toBe("solitaire-issued-1");
  expect(api.issued[0]).toMatchObject({
    game: "solitaire",
    resultProtocol: 2,
    rulesVersion: 1,
    replayVersion: 1,
    generatorVersion: 1,
  });

  // A draw, then an undo of it. Both are moves, so both have to be replayable.
  await page.locator("#sol-stock").click();
  await settleRender(page);
  expect((await readSolitaireBoard(page)).waste).toEqual([board.initial.stock.at(-1)]);
  expect(await readMoveCounter(page)).toBe("001");

  await page.locator("#sol-undo").click();
  await settleRender(page);
  expect((await readSolitaireBoard(page)).waste).toEqual([]);
  await expect(page.locator("#sol-undo")).toBeDisabled();

  // Reset is a new board, so it needs a board of its own from the server.
  await page.locator("#sol-reset").click();
  await expect.poll(() => api.issued.length).toBe(2);
  expect((await readSolitaireBoard(page)).session).toBe("solitaire-issued-2");
});

test("a Solitaire win submits the replay it played and takes the server's move count", async ({
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
  const api = await openVerifiedPage(page, viewports[2], {
    boards: { solitaire: revealedBoard() },
  });
  await openApp(page, "solitaire");
  await expect.poll(() => api.issued.length).toBe(1);
  await settleRender(page);

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

  // The replay the server is asked to verify is the one that was played, and its
  // fifty-two foundation moves are the move count the engine derives.
  await expect.poll(() => api.finishes.length, { timeout: 20_000 }).toBe(1);
  const replay = api.replayFor("solitaire");
  expect(replay[0]).toMatchObject({ seq: 1, op: "autoRunStart" });
  expect(replay.filter(({ op }) => op.endsWith("ToFoundation"))).toHaveLength(52);
  expect(replay.map(({ seq }) => seq)).toEqual(replay.map((unused, index) => index + 1));
  expect(api.finishFor("solitaire").request).toMatchObject({
    gameId: "session-solitaire-revealed",
    rulesVersion: 1,
    replayVersion: 1,
  });

  // The receipt's metric is the server's, and the finished board follows it.
  await expect.poll(() => api.published.length, { timeout: 20_000 }).toBe(1);
  expect(api.published[0].event).toMatchObject({ game: "solitaire", metric: 32 });
  await expect.poll(() => readMoveCounter(page), { timeout: 20_000 }).toBe("032");

  // A board reset since is not the one that metric belongs to.
  await dismissProfilePrompt(page);
  await page.locator("#sol-reset").click();
  await settleRender(page);
  expect((await readSolitaireBoard(page)).moves).toBe(0);
  expect(await readMoveCounter(page)).toBe("000");
});

test("a deal played before issuance answers keeps itself and drops the proof", async ({
  page,
}) => {
  const board = solitaireBoard();
  let release = null;
  const api = await openVerifiedPage(page, viewports[2], { boards: { solitaire: board } });
  // Hold the issuance open so a move can land on the local deal first.
  await page.route(`${ISSUED_API_BASE_URL}/sessions`, async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route.fallback();
  });

  await openApp(page, "solitaire");
  const local = await readSolitaireBoard(page);
  expect(local.stock).not.toEqual(board.initial.stock);

  await page.locator("#sol-stock").click();
  await settleRender(page);
  expect((await readSolitaireBoard(page)).moves).toBe(1);

  release();
  await expect.poll(() => api.issued.length).toBe(1);
  await settleRender(page);

  // The board the player started on stays, and the proof it never used is gone.
  const played = await readSolitaireBoard(page);
  expect(played.tableau).toEqual(local.tableau);
  expect(played.stock).toEqual(local.stock.slice(0, -1));
  expect(played.waste).toEqual([local.stock.at(-1)]);
  expect(played.session).toBe("");
  expect(api.finishes).toHaveLength(0);
});

test("an issued Sudoku puzzle records its entries, its acknowledged pauses and its completion", async ({
  page,
}) => {
  const board = sudokuBoard();
  const api = await openVerifiedPage(page, viewports[2], { boards: { sudoku: board } });
  const win = await openSudokuBoard(page);
  await expect.poll(() => api.issued.length).toBe(1);
  await settleRender(page);

  const grid = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#sudoku-grid .sudoku-cell"))
      .map((cell) => (cell.classList.contains("is-given") ? cell.dataset.sudokuValue : "0"))
      .join("")
  );
  expect(grid).toBe(board.initial.puzzle);

  // Pausing has to be acknowledged by the server, or the time cannot be trusted.
  await win.locator("#sudoku-pause").click();
  await expect(win.locator("#sudoku-resume")).toBeVisible();
  await expect.poll(() => api.timing.map(({ operation }) => operation)).toContain("pause");
  await win.locator("#sudoku-resume").click();
  await expect(win.locator("#sudoku-resume")).toBeHidden();
  await expect.poll(() => api.timing.map(({ operation }) => operation)).toContain("resume");

  const entries = sudokuEntries(board);
  await win
    .locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${entries[0].index}"]`)
    .click();
  // Entering a digit advances to the next editable cell, so the answers go in as
  // one pass over the blanks in grid order.
  await page.keyboard.type(entries.map((entry) => entry.digit).join(""));
  await settleRender(page);
  expect(api.finishes).toHaveLength(0);

  // Check is the submission, and it is what asks the server to verify.
  await win.locator("#sudoku-check").click();
  await expect(win.locator("#sudoku-solve-popup")).toBeVisible();
  await expect.poll(() => api.finishes.length, { timeout: 20_000 }).toBe(1);

  const replay = api.replayFor("sudoku");
  const values = replay.filter(({ op }) => op === "setValue");
  expect(values.map(({ index }) => index)).toEqual(entries.map((entry) => entry.index));
  expect(values.map(({ value }) => value)).toEqual(entries.map((entry) => entry.digit));
  expect(replay.at(-1).op).toBe("check");
  expect(replay.map(({ seq }) => seq)).toEqual(replay.map((unused, index) => index + 1));

  // The server observes the clock, so its elapsed time is the published one and
  // the timer on screen is brought into line with it.
  await expect.poll(() => api.published.length, { timeout: 20_000 }).toBe(1);
  expect(api.published[0].event).toMatchObject({ game: "sudoku", metricKind: "seconds" });
  await expect(win.locator("#sudoku-time")).toHaveText("Time: 00:32", { timeout: 20_000 });
});

test("a Sudoku completion finishes before the profile prompt and binds the issued puzzle", async ({
  page,
}) => {
  const board = sudokuBoard();
  // No stored profile, so the completion has to wait for one to be chosen. The
  // finish must not wait with it: the replay is claimed and verified first.
  const api = await openVerifiedPage(page, viewports[2], {
    boards: { sudoku: board },
    profile: null,
  });
  const win = await openSudokuBoard(page);
  await expect.poll(() => api.issued.length).toBe(1);

  const entries = sudokuEntries(board);
  await win
    .locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${entries[0].index}"]`)
    .click();
  await page.keyboard.type(entries.map((entry) => entry.digit).join(""));
  await win.locator("#sudoku-check").click();

  // The finish is submitted while the profile prompt is still open and nothing
  // has been published.
  await expect(page.locator("#game-profile-prompt")).toBeVisible();
  await expect.poll(() => api.finishes.length, { timeout: 20_000 }).toBe(1);
  expect(api.published).toHaveLength(0);
  expect(api.finishes[0].request).toMatchObject({
    gameId: board.id,
    rulesVersion: 1,
    replayVersion: 1,
  });

  // Choosing a profile publishes the result the server already verified, and its
  // identity follows the board the server issued.
  await page.locator("#game-profile-cancel").click();
  await expect.poll(() => api.published.length, { timeout: 20_000 }).toBe(1);
  expect(api.published[0].event).toMatchObject({
    game: "sudoku",
    difficulty: "easy",
    hintBucket: "noHints",
    metricKind: "seconds",
    puzzleId: board.gameId,
    puzzle: board.initial.puzzle,
  });
  expect(api.published[0].completion).toMatchObject({ token: "synthetic-completion-proof" });
});

test("a new Sudoku puzzle cannot abort or retarget the finish the last one claimed", async ({
  page,
}) => {
  const board = sudokuBoard();
  const api = await openVerifiedPage(page, viewports[2], { boards: { sudoku: board } });
  const win = await openSudokuBoard(page);
  await expect.poll(() => api.issued.length).toBe(1);

  const entries = sudokuEntries(board);
  await win
    .locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${entries[0].index}"]`)
    .click();
  await page.keyboard.type(entries.map((entry) => entry.digit).join(""));
  await win.locator("#sudoku-check").click();
  await expect.poll(() => api.finishes.length, { timeout: 20_000 }).toBe(1);
  const claimed = api.finishes[0];

  // A new puzzle immediately after the claim: it gets a board of its own, and
  // the finish already claimed still completes against the puzzle it was for.
  await dismissProfilePrompt(page);
  await win.locator("#sudoku-solve-ok").click();
  await win.locator("#sudoku-new").click();
  await expect.poll(() => api.issued.length, { timeout: 20_000 }).toBe(2);

  await expect.poll(() => api.published.length, { timeout: 20_000 }).toBe(1);
  expect(api.finishes).toHaveLength(1);
  expect(api.finishes[0]).toBe(claimed);
  expect(api.published[0].event.puzzleId).toBe(board.gameId);
});

test("a Sudoku puzzle reloaded after an acknowledged pause keeps its replay", async ({
  page,
}) => {
  const board = sudokuBoard();
  const api = await openVerifiedPage(page, viewports[2], { boards: { sudoku: board } });
  const win = await openSudokuBoard(page);
  await expect.poll(() => api.issued.length).toBe(1);

  const entries = sudokuEntries(board);
  await win
    .locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${entries[0].index}"]`)
    .click();
  await page.keyboard.type(entries[0].digit);
  await win.locator("#sudoku-pause").click();
  await expect.poll(() => api.timing.some(({ operation }) => operation === "pause")).toBe(true);
  // The save has to carry the issued game and the inputs recorded against it.
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        return saved?.verified
          ? { id: saved.verified.descriptor.id, inputs: saved.verified.inputs.length }
          : null;
      }, SUDOKU_STORAGE_KEY)
    )
    .toEqual({ id: board.id, inputs: 2 });

  await page.reload({ waitUntil: "domcontentloaded" });
  const reopened = await openSudokuBoard(page);
  await expect.poll(() => api.restores.length, { timeout: 20_000 }).toBe(1);
  expect(api.restores[0].id).toBe(board.id);
  expect(api.restores[0].request).toMatchObject({ inputCount: 2 });

  // The restored board is the issued one with its replay applied, not the save.
  await expect(
    reopened.locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${entries[0].index}"]`)
  ).toHaveAttribute("data-sudoku-value", entries[0].digit);
  await expect
    .poll(() => page.evaluate(() => document.getElementById("sudoku-grid")?.dataset.sudokuIndex))
    .toBeUndefined();
  expect(api.issued).toHaveLength(1);
});

test("a Sudoku puzzle reloaded without an acknowledged pause stays local-only", async ({
  page,
  diagnostics,
}) => {
  const board = sudokuBoard();
  const api = await openVerifiedPage(page, viewports[2], {
    boards: { sudoku: board },
    restore: "refuse",
  });
  const win = await openSudokuBoard(page);
  await expect.poll(() => api.issued.length).toBe(1);

  const entries = sudokuEntries(board);
  await win
    .locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${entries[0].index}"]`)
    .click();
  await page.keyboard.type(entries[0].digit);
  await expect
    .poll(() =>
      page.evaluate((key) => Boolean(JSON.parse(localStorage.getItem(key) || "null")?.verified), SUDOKU_STORAGE_KEY)
    )
    .toBe(true);

  await page.reload({ waitUntil: "domcontentloaded" });
  const reopened = await openSudokuBoard(page);
  await expect.poll(() => api.restores.length, { timeout: 20_000 }).toBe(1);

  // A running autosave cannot be backdated into verified timing. The puzzle is
  // still entirely playable; it simply carries no session any more.
  await expect(
    reopened.locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${entries[0].index}"]`)
  ).toHaveAttribute("data-sudoku-value", entries[0].digit);
  await expect
    .poll(() => page.evaluate(() => document.querySelector(".sudoku-app") !== null))
    .toBe(true);
  // The replay-verified proof is gone. Sudoku still resumes into an ordinary
  // session, which is how a restored puzzle has always carried on.
  expect(api.restores).toHaveLength(1);
  expect(api.finishes).toHaveLength(0);
  await reopened
    .locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${entries[1].index}"]`)
    .click();
  await page.keyboard.type(entries[1].digit);
  await expect(
    reopened.locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${entries[1].index}"]`)
  ).toHaveAttribute("data-sudoku-value", entries[1].digit);

  // Refusing the restoration is the behaviour under test; nothing else may have
  // gone wrong, which the fixture asserts on what is left.
  consumeDiagnostics(diagnostics, {
    consoleErrors: [
      "Failed to load resource: the server responded with a status of 409 (Conflict)",
    ],
    errorResponses: [`409 ${ISSUED_API_BASE_URL}/sessions/session-sudoku-0/restore`],
  });
});

for (const viewport of viewports) {
  test(`verified boards render and stay playable at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const solitaire = solitaireBoard();
    const sudoku = sudokuBoard();
    const api = await openVerifiedPage(page, viewport, {
      boards: { solitaire, sudoku },
    });

    const solitaireWindow = await openApp(page, "solitaire");
    await expect.poll(() => api.issued.length).toBe(1);
    await settleRender(page);
    // The tableau shows all twenty-eight dealt cards; the stock shows one
    // reusable back, however many cards are still behind it.
    await expect(solitaireWindow.locator("#sol-tableau [data-sol-card-id]")).toHaveCount(28);
    await expect(solitaireWindow.locator("#sol-stock .sol-card")).toHaveCount(1);
    const windowBox = await solitaireWindow.boundingBox();
    expect(windowBox.x).toBeGreaterThanOrEqual(0);
    expect(windowBox.x + windowBox.width).toBeLessThanOrEqual(viewport.width + 1);
    for (const zone of ["#sol-stock", "#sol-waste", "#sol-tableau"]) {
      const box = await solitaireWindow.locator(zone).boundingBox();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }
    // A board wider than the window has to be scrollable to it, or its last
    // columns would be unplayable. Scrolling to the end is the proof.
    const lastColumn = solitaireWindow.locator('[data-sol-col="6"]');
    await lastColumn.scrollIntoViewIfNeeded();
    const columnBox = await lastColumn.boundingBox();
    expect(columnBox.width).toBeGreaterThan(0);
    expect(columnBox.x).toBeGreaterThanOrEqual(windowBox.x - 1);
    expect(columnBox.x + columnBox.width).toBeLessThanOrEqual(windowBox.x + windowBox.width + 1);

    await solitaireWindow.locator("#sol-stock").click();
    await settleRender(page);
    await expect(solitaireWindow.locator('[data-sol-zone="waste"]')).toHaveCount(1);
    await solitaireWindow.locator('[data-close="solitaire"]').click();
    await solitaireWindow.waitFor({ state: "hidden" });

    const sudokuWindow = await openSudokuBoard(page);
    await expect.poll(() => api.issued.length).toBe(2);
    await expect(sudokuWindow.locator("#sudoku-grid .sudoku-cell")).toHaveCount(81);
    const gridBox = await sudokuWindow.locator(".sudoku-grid-frame").boundingBox();
    expect(gridBox.width).toBeGreaterThan(0);
    expect(gridBox.width).toBeLessThanOrEqual(viewport.width);
    const blank = sudokuEntries(sudoku)[0];
    await sudokuWindow
      .locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${blank.index}"]`)
      .click();
    await page.keyboard.type(blank.digit);
    await settleRender(page);
    await expect(
      sudokuWindow.locator(`#sudoku-grid .sudoku-cell[data-sudoku-index="${blank.index}"]`)
    ).toHaveAttribute("data-sudoku-value", blank.digit);

    expect(api.issued.map(({ game }) => game)).toEqual(["solitaire", "sudoku"]);
    expect(api.finishes).toHaveLength(0);

    // The issued board is what the player reads and operates, so the rendered
    // grid is held to the same accessibility bar as the rest of the window.
    const accessibility = await new AxeBuilder({ page })
      .include('[data-app-window="sudoku"]')
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`verified-sudoku-${viewport.name}.png`),
    });
  });
}
