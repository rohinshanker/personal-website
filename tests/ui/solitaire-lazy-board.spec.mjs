import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import { REVIEW_VIEWPORT, openApp, openHomeDesktop } from "./helpers/rendered-site.mjs";

/**
 * Solitaire's board is dealt on the first open and then updated in place.
 * These specs hold both halves of that in the real browser: Home must start
 * without generating a solver-checked deal or a statistics session, and every
 * later board update must reuse the nodes whose data has not changed instead of
 * rebuilding the tableau — which is also what keeps the body's tooltip count
 * and the columns' pointer listeners from growing with every move.
 */

const DESKTOP = REVIEW_VIEWPORT.desktop;

/**
 * Serves Solitaire with counters around the two calls that must not happen at
 * startup, plus a reader for the state the board is rendered from.
 */
const installLazyBoardBridge = async (page) => {
  await page.addInitScript(() => {
    // Pointer listeners are not observable after the fact, so they are counted
    // as they are registered, before any Home script runs.
    window.__solColumnListeners = [];
    const addEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function recorded(type, listener, options) {
      const className = typeof this.className === "string" ? this.className : "";
      if (className.includes("sol-tableau-col")) window.__solColumnListeners.push(type);
      return addEventListener.call(this, type, listener, options);
    };
  });
  await routeHomeScript(page, "solitaire", (originalSource) => {
    let source = originalSource.replace(
      "  startGameStatsSession,\n} = window.homeGameStats;",
      `  startGameStatsSession: solStartGameStatsSessionUnderTest,
} = window.homeGameStats;
let solStatsSessionsStarted = 0;
const startGameStatsSession = (...args) => {
  solStatsSessionsStarted += 1;
  return solStartGameStatsSessionUnderTest(...args);
};`
    );
    source = source.replace(
      "const solBuildWinnableDeal = (random = Math.random) => {",
      `let solDealsGenerated = 0;
const solBuildWinnableDeal = (random = Math.random) => {
  solDealsGenerated += 1;`
    );
    source = source.replace(
      "const solRender = () => {\n  if (!solBoard",
      "let solRendersRun = 0;\nconst solRender = () => {\n  solRendersRun += 1;\n  if (!solBoard"
    );
    const instrumented = source.replace(
      /\n\}\)\(\);\s*$/,
      `
window.__solitaireLazyBoardTest = Object.freeze({
  snapshot: () => ({
    deals: solDealsGenerated,
    sessions: solStatsSessionsStarted,
    renders: solRendersRun,
    boardReady: solBoardReady,
    statsSession: solState.statsSession,
    presentation: solState.presentation,
    columns: solState.tableau.map((column) => column.length),
    stock: solState.stock.length,
    waste: solState.waste.length,
    foundations: solSuitOrder.map((suit) => solState.foundations[suit].length),
    moves: solState.moves,
    won: solState.won,
  }),
  stagePresentation: (options) => solStagePresentationWin(options),
});
})();
`
    );
    if (instrumented === source) throw new Error("Unable to attach the lazy-board bridge.");
    return instrumented;
  });
};

const snapshot = (page) => page.evaluate(() => window.__solitaireLazyBoardTest.snapshot());

const columnListenerTypes = (page) => page.evaluate(() => [...window.__solColumnListeners]);

const bodyTooltipCount = (page) =>
  page.evaluate(() => document.querySelectorAll("body > .sol-tableau-tooltip").length);

/**
 * Stamps every board node with the position it currently holds, or reads those
 * stamps back. A node that survived a render still carries the stamp it was
 * given — including the one it was given in the column it has since left — and
 * a node that was rebuilt carries none.
 */
const inspectBoardNodes = (mode) => {
  const nodes = [];
  const add = (key, element) => {
    if (element) nodes.push([key, element]);
  };
  document.querySelectorAll("#sol-tableau .sol-tableau-col").forEach((column) => {
    const index = column.dataset.solCol;
    add(`col:${index}`, column);
    column.querySelectorAll(".sol-card").forEach((card) => {
      add(`col:${index}:${card.dataset.solCardId}`, card);
    });
  });
  document
    .querySelectorAll("#sol-waste .sol-card")
    .forEach((card) => add(`waste:${card.dataset.solCardId}`, card));
  document.querySelectorAll("[data-sol-foundation]").forEach((slot) => {
    slot.querySelectorAll(".sol-card").forEach((card) => {
      add(`foundation:${slot.dataset.solFoundation}:${card.dataset.solCardId}`, card);
    });
  });
  add("stock:back", document.querySelector("#sol-stock [data-sol-stock]"));

  if (mode === "stamp") {
    nodes.forEach(([key, element]) => {
      element.dataset.solStamp = key;
    });
    return nodes.length;
  }
  return Object.fromEntries(
    nodes.map(([key, element]) => [key, element.dataset.solStamp ?? null])
  );
};

const stampBoard = (page) => page.evaluate(inspectBoardNodes, "stamp");
const readStamps = (page) => page.evaluate(inspectBoardNodes, "read");

/**
 * With randomness pinned the shuffle performs no swaps, so the first open deals
 * the deck in suit order. Naming the cards it produces makes a silent change to
 * the deal visible here instead of only in a pixel diff.
 */
const DEALT_FACE_UP_LABELS = [
  "Ace of Spades",
  "Three of Spades",
  "Six of Spades",
  "Ten of Spades",
  "Two of Clubs",
  "Eight of Clubs",
  "Two of Diamonds",
];

const expectDealtBoard = async (page) => {
  const columns = page.locator("#sol-tableau .sol-tableau-col");
  await expect(columns).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    await expect(columns.nth(index).locator(".sol-card")).toHaveCount(index + 1);
    await expect(columns.nth(index).locator(".sol-card").last()).toHaveAttribute(
      "aria-label",
      DEALT_FACE_UP_LABELS[index]
    );
  }
  await expect(page.locator("#sol-tableau .sol-card.is-face-down")).toHaveCount(21);
  await expect(page.locator("#sol-stock")).toHaveAttribute("aria-label", "Stock, 24 cards");
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste");
  await expect(page.locator("[data-sol-foundation] .sol-card")).toHaveCount(0);
};

test("Home starts without dealing a board, opening a session or renting a tooltip", async ({
  page,
}) => {
  await installLazyBoardBridge(page);
  await openHomeDesktop(page, DESKTOP);

  expect(await snapshot(page)).toMatchObject({
    deals: 0,
    sessions: 0,
    renders: 0,
    boardReady: false,
    statsSession: "",
    presentation: null,
    columns: [],
    stock: 0,
  });
  await expect(page.locator("#sol-tableau .sol-tableau-col")).toHaveCount(0);
  await expect(page.locator("#sol-board .sol-card")).toHaveCount(0);
  expect(await bodyTooltipCount(page)).toBe(0);
  expect(await columnListenerTypes(page)).toEqual([]);
});

test("the first open deals once and a reopen hands back the same board nodes", async ({
  page,
}) => {
  await installLazyBoardBridge(page);
  await openHomeDesktop(page, DESKTOP);
  await openApp(page, "solitaire");

  const opened = await snapshot(page);
  expect(opened.deals).toBe(1);
  expect(opened.renders).toBe(1);
  expect(opened.boardReady).toBe(true);
  expect(opened.sessions).toBe(0, "Opening the window is not gameplay.");
  expect(opened.statsSession).toBe("");
  expect(opened.columns).toEqual([1, 2, 3, 4, 5, 6, 7]);
  await expectDealtBoard(page);

  // Seven columns, each with its own tooltip and its own three pointer handlers.
  expect(await bodyTooltipCount(page)).toBe(7);
  expect(await columnListenerTypes(page)).toEqual(
    Array.from({ length: 7 }, () => ["pointerenter", "pointermove", "pointerleave"]).flat()
  );

  await stampBoard(page);
  await page.locator('[data-close="solitaire"]').click();
  await expect(page.locator('[data-app-window="solitaire"]')).toBeHidden();
  await openApp(page, "solitaire");

  const reopened = await snapshot(page);
  expect(reopened.deals).toBe(1, "Reopening keeps the board the player left.");
  expect(reopened.renders).toBe(1, "Reopening does not even re-render.");
  await expectDealtBoard(page);
  const stamps = await readStamps(page);
  expect(Object.values(stamps).every((stamp) => stamp !== null)).toBe(true);
  expect(stamps["col:0:spades-1"]).toBe("col:0:spades-1");
  expect(stamps["stock:back"]).toBe("stock:back");
  expect(await bodyTooltipCount(page)).toBe(7);
});

test("a presentation staged before the first open survives that open unpublished", async ({
  page,
}) => {
  await installLazyBoardBridge(page);
  await openHomeDesktop(page, DESKTOP);

  await page.evaluate(() =>
    window.__solitaireLazyBoardTest.stagePresentation({ visualEffects: false })
  );
  const staged = await snapshot(page);
  expect(staged.deals).toBe(0, "Staging a board never generates a deal.");
  expect(staged.presentation).toEqual({ visualEffects: false });
  expect(staged.columns).toEqual([13, 13, 13, 13, 0, 0, 0]);

  await stampBoard(page);
  await openApp(page, "solitaire");

  const afterOpen = await snapshot(page);
  expect(afterOpen.deals).toBe(0, "Opening must not deal over the staged board.");
  expect(afterOpen.presentation).toEqual({ visualEffects: false });
  expect(afterOpen.statsSession).toBe("");
  expect(afterOpen.sessions).toBe(0);
  const stamps = await readStamps(page);
  expect(stamps["col:0:spades-13"]).toBe("col:0:spades-13");
  await expect(page.locator("#sol-tableau .sol-card")).toHaveCount(52);
  await expect(page.locator("#sol-tableau .sol-card.is-face-down")).toHaveCount(0);
  await expect(page.locator("#sol-auto-solve")).toBeVisible();
  await expect(page.locator("#sol-reset")).toBeHidden();
});

test("Reset deals a new board, keeps the columns, and clears the old selection", async ({
  page,
}) => {
  await installLazyBoardBridge(page);
  await openHomeDesktop(page, DESKTOP);
  await openApp(page, "solitaire");

  // The auto-solve check takes Reset's place while the dealt Ace is exposed, so
  // play it out first; the board it leaves offers Reset again.
  await page.locator("#sol-auto-solve").click();
  await expect(page.locator("#sol-reset")).toBeVisible({ timeout: 20_000 });

  const columnStamps = await page.evaluate(() => {
    const columns = [...document.querySelectorAll("#sol-tableau .sol-tableau-col")];
    columns.forEach((column, index) => {
      column.dataset.solStamp = `column-${index}`;
    });
    return columns.length;
  });
  expect(columnStamps).toBe(7);

  await page.locator("#sol-reset").click();
  const afterReset = await snapshot(page);
  expect(afterReset.deals).toBe(2, "Reset generates another winnable board.");
  expect(afterReset.moves).toBe(0);
  expect(afterReset.foundations).toEqual([0, 0, 0, 0]);
  expect(afterReset.statsSession).toBe("", "A new deal starts a new session later, not now.");
  await expectDealtBoard(page);
  await expect(page.locator("#sol-tableau .sol-card.is-selected")).toHaveCount(0);
  await expect(page.locator("#sol-undo")).toBeDisabled();
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll("#sol-tableau .sol-tableau-col")].map(
        (column) => column.dataset.solStamp ?? null
      )
    )
  ).toEqual(Array.from({ length: 7 }, (_, index) => `column-${index}`));
  expect(await bodyTooltipCount(page)).toBe(7);
});

test("selecting, moving and undoing keep every unchanged card node in place", async ({
  page,
}) => {
  await installLazyBoardBridge(page);
  await openHomeDesktop(page, DESKTOP);
  await openApp(page, "solitaire");

  const ace = page.locator('#sol-tableau [data-sol-card-id="spades-1"]');
  await stampBoard(page);
  await ace.click();
  await expect(ace).toHaveClass(/is-selected/);
  await expect(page.locator("#sol-tableau .sol-card.is-selected")).toHaveCount(1);
  let stamps = await readStamps(page);
  expect(stamps["col:0:spades-1"]).toBe(
    "col:0:spades-1",
    "A selection repaints the card; it does not replace it."
  );
  expect(Object.values(stamps).every((stamp) => stamp !== null)).toBe(true);

  // A second click on the same card is a double-click, which sends the Ace to
  // its foundation: the node moves out of the column and keeps its stamp.
  await ace.click();
  await expect(page.locator('[data-sol-foundation="spades"]')).toHaveAttribute(
    "aria-label",
    "Spades foundation, Ace of Spades"
  );
  stamps = await readStamps(page);
  // Each pile keys its own nodes, so a card that changes pile arrives there as
  // a fresh node rather than carrying the classes of the pile it left.
  expect(stamps["foundation:spades:spades-1"]).toBe(null);
  expect(stamps["col:0:spades-1"]).toBe(undefined, "The card left column 1.");
  expect(stamps["col:1:spades-3"]).toBe("col:1:spades-3", "Untouched columns are untouched.");
  await expect(page.locator("#sol-tableau .sol-card.is-selected")).toHaveCount(0);
  expect((await snapshot(page)).sessions).toBe(1, "A real move opens the session.");

  await page.locator("#sol-stock").click();
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste, King of Hearts");
  stamps = await readStamps(page);
  expect(stamps["waste:hearts-13"]).toBe(null, "A drawn card reaches the waste as a new node.");
  expect(stamps["stock:back"]).toBe("stock:back", "The stock keeps its single back node.");

  await stampBoard(page);
  await page.locator("#sol-undo").click();
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste");
  stamps = await readStamps(page);
  expect(stamps["col:1:spades-3"]).toBe("col:1:spades-3");
  expect(stamps["foundation:spades:spades-1"]).toBe("foundation:spades:spades-1");
  expect(stamps["stock:back"]).toBe("stock:back");
  expect(await bodyTooltipCount(page)).toBe(7);
});

test("emptying and redealing the stock never grows the board's node or listener count", async ({
  page,
}) => {
  await installLazyBoardBridge(page);
  await openHomeDesktop(page, DESKTOP);
  await openApp(page, "solitaire");

  const stock = page.locator("#sol-stock");
  const listenersAtStart = (await columnListenerTypes(page)).length;
  await stampBoard(page);

  for (let draw = 0; draw < 24; draw += 1) {
    await stock.click();
  }
  await expect(stock).toHaveAttribute("aria-label", "Restock waste");
  await expect(page.locator("#sol-stock .sol-slot-mark")).toHaveText("↻");
  await expect(page.locator("#sol-stock [data-sol-stock]")).toHaveCount(0);
  let state = await snapshot(page);
  expect(state.stock).toBe(0);
  expect(state.waste).toBe(24);
  expect(state.moves).toBe(24);

  await stock.click();
  await expect(stock).toHaveAttribute("aria-label", "Stock, 24 cards");
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste");
  state = await snapshot(page);
  expect(state.stock).toBe(24);
  expect(state.waste).toBe(0);
  expect(state.moves).toBe(25);
  expect(state.deals).toBe(1, "A redeal reuses the dealt stock; it never generates one.");

  const stamps = await readStamps(page);
  expect(stamps["col:0:spades-1"]).toBe("col:0:spades-1");
  expect(stamps["stock:back"]).toBe("stock:back", "The restored stock reuses its back node.");
  expect(await bodyTooltipCount(page)).toBe(7);
  expect(await columnListenerTypes(page)).toHaveLength(listenersAtStart);
  expect(
    await page.evaluate(() => document.querySelectorAll(".sol-tableau-tooltip").length)
  ).toBe(7);
});

test("an auto-solve landing updates only the card it moved and the pile it filled", async ({
  page,
}) => {
  await installLazyBoardBridge(page);
  await openHomeDesktop(page, DESKTOP);
  await openApp(page, "solitaire");

  await expect(page.locator("#sol-auto-solve")).toBeVisible();
  await stampBoard(page);
  await page.locator("#sol-auto-solve").click();
  await expect(page.locator('[data-sol-foundation="spades"] .sol-card')).toHaveCount(1, {
    timeout: 20_000,
  });
  await expect(page.locator("#sol-reset")).toBeVisible({ timeout: 20_000 });

  // The landing rewrites the source card and the destination pile and nothing
  // else: every column the run did not touch still holds its original nodes.
  const stamps = await readStamps(page);
  expect(stamps["col:1:spades-3"]).toBe("col:1:spades-3");
  expect(stamps["col:6:diamonds-2"]).toBe("col:6:diamonds-2");
  expect(stamps["col:0:spades-1"]).toBe(undefined, "The Ace left the tableau.");
  await expect(page.locator("#sol-board .sol-flying-card")).toHaveCount(0);
  await expect(page.locator("#sol-board")).not.toHaveClass(/is-auto-solving/);
  await expect(page.locator(".sol-card.is-auto-solve-lifted")).toHaveCount(0);
  expect((await snapshot(page)).deals).toBe(1);
  expect(await bodyTooltipCount(page)).toBe(7);
});
