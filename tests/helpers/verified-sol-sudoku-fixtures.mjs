/**
 * Deterministic Solitaire and Sudoku replay fixtures.
 *
 * Verifying a result means replaying ordered inputs against an issued board, so
 * the tests that matter need two things: replays that are genuinely legal and
 * reach a known result, and replays that are wrong in one specific way each. Both
 * are built here, from the real rule engines and the real issued-game catalog, so
 * the Worker's verification tests and the engines' own tests argue over the same
 * material instead of each inventing its own.
 *
 * Every fixture is a plain JSON value. Nothing here touches a clock, a DOM or a
 * network, and the same call always produces the same fixtures.
 */
import { readFile } from "node:fs/promises";
import vm from "node:vm";

import {
  decodeDeal,
  loadSolitaireSolver,
  proveWinnable,
} from "../../scripts/build-issued-game-catalog.mjs";

const root = new URL("../../", import.meta.url);

/**
 * The rule engines in one realm. They are ordinary classic scripts, so this is
 * how a browser loads them and how the Worker imports them; a caller that wants
 * to prove browser and server agree can create two realms and compare.
 */
export const loadVerifiedGameEngines = async () => {
  const context = vm.createContext({});
  for (const path of [
    "scripts/home/games/rules.js",
    "scripts/home/games/solitaire.js",
    "scripts/home/games/sudoku.js",
  ]) {
    vm.runInContext(await readFile(new URL(path, root), "utf8"), context);
  }
  return {
    context,
    rules: context.homeGameRules,
    solitaire: context.homeSolitaireRules,
    sudoku: context.homeSudokuRules,
    /** Rebuilds a value inside the realm, as parsing a request body would. */
    into: (value) => vm.runInContext(`(${JSON.stringify(value)})`, context),
  };
};

/** The engines' JSON, as plain host values a test can compare and serialize. */
export const plainValue = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

/** Numbers each action in order, which is what `assertReplay` insists on. */
export const sequence = (actions) =>
  actions.map((action, index) => ({ ...action, seq: index + 1 }));

/**
 * Replays `actions` against `initial` and returns the derived result. This is
 * the whole verification step in miniature, which is why the fixtures below are
 * checked with it rather than by assertion alone.
 */
export const replayGame = (engines, game, initial, actions, { work } = {}) => {
  const engine = game === "solitaire" ? engines.solitaire : engines.sudoku;
  const limits = engines.rules.GAME_RULE_LIMITS[game];
  const budget = engines.rules.createBudget(work ?? limits.work);
  const state = engine.initial(engines.into(initial));
  engines.rules.assertReplay(engines.into(actions), limits.inputs);
  actions.forEach((action) => engine.transition(state, engines.into(action), budget));
  return {
    state,
    result: plainValue(engine.result(state)),
    canonical: engines.rules.canonicalJson(state),
    spent: (work ?? limits.work) - budget.remaining,
  };
};

const SOLITAIRE_CONFIG = Object.freeze({ variant: "klondike-draw-one" });

/** The issued board for one catalog seed, straight from the shipped catalog. */
const issuedSolitaire = async (seed) => {
  const { generateIssuedInitial } = await import(
    new URL("workers/game-stats/src/issued-game-catalog.mjs", root).href
  );
  return plainValue(generateIssuedInitial("solitaire", {}, seed));
};

/** A board whose tableau is four packed King-to-Ace runs, ready to auto-solve. */
const revealedSolitaireBoard = () => {
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
  };
};

/** Moves one card between two piles of an issued deal, leaving 52 cards. */
const swapTwoStockCards = (initial) => {
  const altered = plainValue(initial);
  [altered.stock[0], altered.stock[1]] = [altered.stock[1], altered.stock[0]];
  return altered;
};

export const buildSolitaireFixtures = async (engines) => {
  const initial = await issuedSolitaire(0);
  const solve = await loadSolitaireSolver();
  const winningReplay = sequence(
    proveWinnable(engines, initial, solve({
      stock: initial.stock.map((id) => ({ id, faceUp: false, ...splitCard(id) })),
      tableau: initial.tableau.map((pile) => [
        ...pile.down.map((id) => ({ id, faceUp: false, ...splitCard(id) })),
        ...pile.up.map((id) => ({ id, faceUp: true, ...splitCard(id) })),
      ]),
    }))
  );

  const revealed = revealedSolitaireBoard();
  const autoSolveReplay = sequence([
    { op: "autoRunStart" },
    ...engines.solitaire
      .planAutoSolveBoard(engines.into(engines.solitaire.toBoard(engines.solitaire.initial(engines.into(revealed)))))
      .moves.map((move) => plainValue(move.action)),
  ]);

  const valid = [
    {
      name: "a solved issued deal",
      game: "solitaire",
      config: SOLITAIRE_CONFIG,
      seed: 0,
      initial,
      replay: winningReplay,
      expected: { won: true, terminal: true, moves: winningReplay.length, assistance: "none" },
    },
    {
      name: "a deal drawn through once and left unfinished",
      game: "solitaire",
      config: SOLITAIRE_CONFIG,
      seed: 0,
      initial,
      replay: sequence([{ op: "draw" }, { op: "draw" }, { op: "undo" }]),
      expected: { won: false, terminal: false, moves: 1, assistance: "none" },
    },
    {
      name: "an auto-solved revealed board",
      game: "solitaire",
      config: SOLITAIRE_CONFIG,
      seed: null,
      initial: revealed,
      replay: autoSolveReplay,
      expected: { won: true, terminal: true, moves: 52, assistance: "autoSolve" },
    },
  ];

  const invalid = [
    { name: "an unknown operation", initial, replay: sequence([{ op: "teleport" }]) },
    { name: "an action with an extra field", initial, replay: sequence([{ op: "draw", from: 0 }]) },
    { name: "a redeal while the stock still holds cards", initial, replay: sequence([{ op: "redeal" }]) },
    { name: "an undo with nothing to undo", initial, replay: sequence([{ op: "undo" }]) },
    {
      name: "a tableau move the cards do not allow",
      initial,
      replay: sequence([{ op: "tableauToTableau", from: 0, index: 0, to: 1 }]),
    },
    {
      name: "a foundation move from an empty waste",
      initial,
      replay: sequence([{ op: "wasteToFoundation" }]),
    },
    {
      name: "a move played after the deal was won",
      initial,
      replay: [...winningReplay, { seq: winningReplay.length + 1, op: "draw" }],
    },
    {
      name: "an ordinary move inside an auto-solve run",
      initial,
      replay: sequence([{ op: "autoRunStart" }]),
    },
    {
      name: "an auto-run closed before it opened",
      initial,
      replay: sequence([{ op: "autoRunEnd" }]),
    },
    {
      name: "a winning replay reused against an altered deal",
      initial: swapTwoStockCards(initial),
      replay: winningReplay,
      note: "The replay must not reproduce the win; it is legal only for the issued deal.",
      mayReplayLegally: true,
    },
    {
      name: "a replay whose sequence numbers were reordered",
      initial,
      replay: [{ seq: 2, op: "draw" }, { seq: 1, op: "draw" }],
      ordering: true,
    },
    {
      name: "a replay with a missing sequence number",
      initial,
      replay: [{ seq: 1, op: "draw" }, { seq: 3, op: "draw" }],
      ordering: true,
    },
    {
      name: "a replay longer than the input limit",
      initial,
      replay: sequence(Array.from({ length: 16_385 }, () => ({ op: "draw" }))),
      ordering: true,
    },
  ];

  const alteredInitials = [
    { name: "a deal missing a card", initial: dropFirstStockCard(initial) },
    { name: "a deal holding one card twice", initial: duplicateFirstStockCard(initial) },
    { name: "a column hiding its top card", initial: burySolitaireTopCard(initial) },
    { name: "a face-up run that is not packed", initial: unpackSolitaireRun(initial) },
    { name: "a win claimed on an unfinished deal", initial: { ...initial, won: true } },
    { name: "an unsupported variant", initial: { ...initial, variant: "spider" } },
  ];

  return { valid, invalid, alteredInitials };
};

const splitCard = (id) => {
  const separator = id.lastIndexOf("-");
  return { suit: id.slice(0, separator), rank: Number(id.slice(separator + 1)) };
};

const dropFirstStockCard = (initial) => {
  const altered = plainValue(initial);
  altered.stock.shift();
  return altered;
};

const duplicateFirstStockCard = (initial) => {
  const altered = plainValue(initial);
  altered.stock[1] = altered.stock[0];
  return altered;
};

const burySolitaireTopCard = (initial) => {
  const altered = plainValue(initial);
  altered.tableau[1].down.push(...altered.tableau[1].up);
  altered.tableau[1].up = [];
  return altered;
};

const unpackSolitaireRun = (initial) => {
  const altered = plainValue(initial);
  altered.tableau[0].up = [...altered.tableau[0].up, altered.stock.pop()];
  return altered;
};

/** The easy puzzle Sudoku ships, which is also the catalog's base material. */
export const SUDOKU_PUZZLE =
  "402030000795020003001705400100004005609000000248507310900108500800050071017043092";
export const SUDOKU_SOLUTION =
  "462831957795426183381795426173984265659312748248567319926178534834259671517643892";

const sudokuInitial = (overrides = {}) => ({
  rngState: 0,
  difficulty: "easy",
  puzzle: SUDOKU_PUZZLE,
  solution: SUDOKU_SOLUTION,
  ...overrides,
});

/** Every blank cell, filled correctly except where `wrong` says otherwise. */
const fillSudoku = (wrong = {}) =>
  Array.from({ length: 81 }, (unused, index) => index)
    .filter((index) => SUDOKU_PUZZLE[index] === "0")
    .map((index) => ({
      op: "setValue",
      index,
      value: wrong[index] || SUDOKU_SOLUTION[index],
    }));

const WRONG_AT_ONE = String((Number(SUDOKU_SOLUTION[1]) % 9) + 1);

/** The last cell a player fills, which is where a grown grid hides. */
const LAST_BLANK_INDEX = Array.from({ length: 81 }, (unused, index) => index)
  .filter((index) => SUDOKU_PUZZLE[index] === "0")
  .at(-1);

export const buildSudokuFixtures = async () => {
  const initial = sudokuInitial();
  const solvedReplay = sequence([...fillSudoku(), { op: "check" }]);

  const valid = [
    {
      name: "a puzzle solved with no assistance",
      game: "sudoku",
      config: { difficulty: "easy" },
      initial,
      replay: solvedReplay,
      expected: {
        won: true,
        terminal: true,
        assistance: "noHints",
        assistanceCount: 0,
        moves: solvedReplay.length - 1,
      },
    },
    {
      name: "a puzzle solved after two counted checks",
      game: "sudoku",
      config: { difficulty: "easy" },
      initial,
      replay: sequence([
        { op: "setValue", index: 1, value: WRONG_AT_ONE },
        { op: "check" },
        { op: "check" },
        ...fillSudoku(),
        { op: "check" },
      ]),
      expected: { won: true, terminal: true, assistance: "noHints", assistanceCount: 2 },
    },
    {
      name: "a puzzle solved after Errors mode marked a mistake",
      game: "sudoku",
      config: { difficulty: "easy" },
      initial,
      replay: sequence([
        { op: "confirmErrors" },
        { op: "setHintMode", mode: "errors" },
        { op: "setValue", index: 1, value: WRONG_AT_ONE },
        ...fillSudoku(),
        { op: "check" },
      ]),
      expected: { won: true, terminal: true, assistance: "withHints" },
    },
    {
      name: "a solved puzzle the player carried on editing",
      game: "sudoku",
      config: { difficulty: "easy" },
      initial,
      // Editing a finished board takes the win back off it. Only publication is
      // final, so the rules let play continue and simply stop claiming a win.
      replay: sequence([...solvedReplay.map(({ seq, ...action }) => action), { op: "clear", index: 1 }]),
      expected: { won: false, terminal: false, assistance: "noHints" },
    },
    {
      name: "an unfinished puzzle with pencil marks and an undo",
      game: "sudoku",
      config: { difficulty: "easy" },
      initial,
      replay: sequence([
        { op: "select", index: 1 },
        { op: "toggleNote", index: 1, digit: "6" },
        { op: "toggleNote", index: 1, digit: "9" },
        { op: "undo" },
        { op: "redo" },
      ]),
      expected: { won: false, terminal: false, assistance: "noHints" },
    },
  ];

  const invalid = [
    {
      name: "an entry on a given cell",
      initial,
      replay: sequence([{ op: "setValue", index: 0, value: "5" }]),
    },
    {
      name: "a digit outside one to nine",
      initial,
      replay: sequence([{ op: "setValue", index: 1, value: "0" }]),
    },
    // A membership test on the digit string answers true for "", for "89" and
    // for the whole alphabet, and a multi-character value written into the grid
    // pushes it past eighty-one cells — where nothing scores it. Each of these
    // is one digit's worth of the same mistake.
    ...["", "89", "123456789", "1 ", " 1", "١"].map((value) => ({
      name: `a cell value of ${JSON.stringify(value)}`,
      initial,
      replay: sequence([{ op: "setValue", index: 1, value }]),
    })),
    ...[1, null, true, ["1"], { digit: "1" }].map((value) => ({
      name: `a cell value that is not a string: ${JSON.stringify(value) ?? String(value)}`,
      initial,
      replay: sequence([{ op: "setValue", index: 1, value }]),
    })),
    ...["", "89", "123456789"].map((digit) => ({
      name: `a pencil mark of ${JSON.stringify(digit)}`,
      initial,
      replay: sequence([{ op: "toggleNote", index: 1, digit }]),
    })),
    {
      // The review's own proof: every blank but the last answered honestly, and
      // two characters into the last one. It used to finish, win and publish.
      name: "a win forged by writing two digits into the final cell",
      initial,
      replay: sequence([
        ...fillSudoku().filter(({ index }) => index !== LAST_BLANK_INDEX),
        { op: "setValue", index: LAST_BLANK_INDEX, value: SUDOKU_SOLUTION.slice(79, 81) },
        { op: "check" },
      ]),
    },
    {
      name: "a pencil mark on a filled cell",
      initial,
      replay: sequence([
        { op: "setValue", index: 1, value: "6" },
        { op: "toggleNote", index: 1, digit: "4" },
      ]),
    },
    { name: "an undo with nothing to undo", initial, replay: sequence([{ op: "undo" }]) },
    { name: "a redo with nothing to redo", initial, replay: sequence([{ op: "redo" }]) },
    {
      name: "Errors mode without its confirmation",
      initial,
      replay: sequence([{ op: "setHintMode", mode: "errors" }]),
    },
    {
      name: "a solved replay reused against a different puzzle",
      initial: sudokuInitial({
        puzzle: `${SUDOKU_PUZZLE.slice(0, 1)}${SUDOKU_SOLUTION[1]}${SUDOKU_PUZZLE.slice(2)}`,
      }),
      replay: solvedReplay,
      note: "The first entry is now a given, so the replay cannot be applied.",
    },
    {
      name: "a replay whose sequence numbers were reordered",
      initial,
      replay: [
        { seq: 2, op: "setValue", index: 1, value: "6" },
        { seq: 1, op: "select", index: 1 },
      ],
      ordering: true,
    },
  ];

  const alteredInitials = [
    { name: "a puzzle that disagrees with its solution", initial: sudokuInitial({ puzzle: `9${SUDOKU_PUZZLE.slice(1)}` }) },
    { name: "an incomplete solution", initial: sudokuInitial({ solution: `0${SUDOKU_SOLUTION.slice(1)}` }) },
    { name: "a puzzle with nothing left to solve", initial: sudokuInitial({ puzzle: SUDOKU_SOLUTION }) },
    { name: "an unknown difficulty", initial: sudokuInitial({ difficulty: "fiendish" }) },
    { name: "a given overwritten in the issued values", initial: sudokuInitial({ values: `9${SUDOKU_PUZZLE.slice(1)}` }) },
    { name: "an allowance beyond the three a puzzle gets", initial: sudokuInitial({ checksUsed: 4 }) },
    { name: "Errors mode issued without its confirmation", initial: sudokuInitial({ hintMode: "errors" }) },
    { name: "a win claimed on an untouched puzzle", initial: sudokuInitial({ solved: true }) },
  ];

  return { valid, invalid, alteredInitials };
};

/** Both games' fixtures, for a caller that wants the whole set. */
export const buildVerifiedGameFixtures = async (engines) => ({
  solitaire: await buildSolitaireFixtures(engines),
  sudoku: await buildSudokuFixtures(engines),
});
