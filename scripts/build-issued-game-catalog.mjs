/**
 * Builds the prevalidated Solitaire and Sudoku boards the Game Stats Worker
 * issues for verified play.
 *
 * Issuing a verified game has to be cheap: a request handler cannot afford the
 * backtracking search that proves a Klondike deal winnable or a Sudoku puzzle
 * uniquely solvable. So that work happens here, offline and deterministically,
 * and the Worker only indexes the result.
 *
 * Everything is derived from code that already ships: deals come from the
 * Solitaire rule engine, their winning lines from the controller's solver, and
 * the puzzles from the same generator the browser worker runs. Nothing is
 * hand-written, so `--check` can rebuild the artifact from source and compare it
 * byte for byte, then verify the stored boards on their own terms.
 *
 *   node scripts/build-issued-game-catalog.mjs           # write the artifact
 *   node scripts/build-issued-game-catalog.mjs --check    # verify it
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT_URL = new URL("../", import.meta.url);
const CATALOG_URL = new URL("workers/game-stats/src/issued-game-catalog.mjs", ROOT_URL);

/** Bumped when the artifact's shape changes, not when its contents are rebuilt. */
export const ISSUED_CATALOG_VERSION = 1;

/** Deck and puzzle counts. Both exceed the contract's minimum on purpose. */
export const SOLITAIRE_DECK_COUNT = 48;
export const SOLITAIRE_SUIT_VARIANTS = 8;
export const SUDOKU_PUZZLES_PER_DIFFICULTY = 16;

/** Caps so a pathological search fails loudly instead of running forever. */
const SOLITAIRE_SEED_LIMIT = 400;
const SUDOKU_SEED_LIMIT = 400;
const SUDOKU_GENERATOR_ATTEMPTS = 3;

const SUIT_CODES = Object.freeze({ spades: "s", clubs: "c", diamonds: "d", hearts: "h" });
const CODE_SUITS = Object.freeze(
  Object.fromEntries(Object.entries(SUIT_CODES).map(([suit, code]) => [code, suit]))
);

const readSource = (path) => readFile(new URL(path, ROOT_URL), "utf8");

/** An exact region of a shipped script, bounded by stable declarations. */
const sourceBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end <= start) {
    throw new Error(`Unable to find source markers: ${startMarker} … ${endMarker}`);
  }
  return source.slice(start, end);
};

/** Mulberry32, matching the rule helpers' generator, as a plain function. */
const seededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * The rule engines, in their own realm. They are ordinary classic scripts, so
 * running them here is exactly how a browser or the Worker loads them.
 */
export const loadRuleEngines = async () => {
  const context = vm.createContext({});
  for (const path of [
    "scripts/home/games/rules.js",
    "scripts/home/games/solitaire.js",
    "scripts/home/games/sudoku.js",
  ]) {
    vm.runInContext(await readSource(path), context);
  }
  return {
    rules: context.homeGameRules,
    solitaire: context.homeSolitaireRules,
    sudoku: context.homeSudokuRules,
    /** Rebuilds a value inside the engines' realm, as a request body would be. */
    into: (value) => vm.runInContext(`(${JSON.stringify(value)})`, context),
  };
};

/**
 * The controller's Klondike solver. It stays where it is: the browser needs it
 * for offline deals, and its search treats the stock as a set of reachable
 * cards rather than a pile, so its output is a proof sketch and never a replay.
 */
export const loadSolitaireSolver = async () => {
  const source = await readSource("scripts/home/features/solitaire.js");
  const { solFindWinningMoves } = new Function(`
    ${sourceBetween(source, "const solSuitOrder =", "const solRankNames =")}
    ${sourceBetween(source, "const solBuildDeck =", "const solCloneCards =")}
    return { solFindWinningMoves };
  `)();
  return solFindWinningMoves;
};

/** The browser worker's puzzle generator, driven by a seed instead of Math.random. */
export const loadSudokuGenerator = async () => {
  const workerGlobal = { addEventListener() {}, postMessage() {} };
  vm.runInContext(
    await readSource("scripts/home/sudoku-generator.worker.js"),
    vm.createContext({ self: workerGlobal })
  );
  return workerGlobal.sudokuGenerator;
};

/** The clue target per difficulty, read from the game rather than copied. */
export const loadSudokuClueTargets = async () => {
  const source = await readSource("scripts/home/features/sudoku.js");
  const literal = sourceBetween(
    source,
    "const SUDOKU_GENERATOR_CLUES = Object.freeze({",
    "});"
  ).replace("const SUDOKU_GENERATOR_CLUES = Object.freeze({", "{");
  return new Function(`return ${literal}}`)();
};

const cardCode = (id) => {
  const [suit, rank] = id.split("-");
  return `${SUIT_CODES[suit]}${rank}`;
};

/** `stock|column1|…|column7`, each pile bottom to top, as short card codes. */
export const encodeDeal = (deal) =>
  [deal.stock, ...deal.tableau.map((pile) => [...pile.down, ...pile.up])]
    .map((pile) => pile.map(cardCode).join(" "))
    .join("|");

export const decodeDeal = (encoded) => {
  const piles = encoded.split("|").map((pile) => (pile ? pile.split(" ") : []).map((code) => {
    const suit = CODE_SUITS[code[0]];
    const rank = Number(code.slice(1));
    if (!suit || !Number.isInteger(rank) || rank < 1 || rank > 13) {
      throw new Error(`Unknown card code: ${code}`);
    }
    return `${suit}-${rank}`;
  }));
  const [stock, ...columns] = piles;
  return {
    stock,
    tableau: columns.map((pile) => ({ down: pile.slice(0, -1), up: pile.slice(-1) })),
  };
};

const solverDeal = (raw) => {
  const face = (id, faceUp) => {
    const [suit, rank] = id.split("-");
    return { id, suit, rank: Number(rank), faceUp };
  };
  return {
    stock: raw.stock.map((id) => face(id, false)),
    tableau: raw.tableau.map((pile) => [
      ...pile.down.map((id) => face(id, false)),
      ...pile.up.map((id) => face(id, true)),
    ]),
  };
};

/**
 * Turns the solver's abstract line of play into real moves and plays them.
 * Where the search simply took a card out of the stock, this draws and redeals
 * until that card is actually on top of the waste, so what comes back is a
 * replay the engine accepted move by move — the winnability proof itself.
 */
export const proveWinnable = (engines, raw, solverMoves) => {
  const { rules, solitaire, into } = engines;
  const state = solitaire.initial(into(raw));
  const budget = rules.createBudget(2_000_000);
  const replay = [];
  const play = (action) => {
    replay.push(action);
    solitaire.transition(state, into({ ...action, seq: replay.length }), budget);
  };
  const surface = (cardId) => {
    const limit = (state.stock.length + state.waste.length) * 2 + 2;
    for (let step = 0; step < limit; step += 1) {
      if (state.waste[state.waste.length - 1] === cardId) return;
      play(state.stock.length ? { op: "draw" } : { op: "redeal" });
    }
    throw new Error(`${cardId} never reached the top of the waste`);
  };

  for (const move of solverMoves) {
    if (move.from === "stock") surface(move.cardId);
    if (move.type === "toFoundation") {
      play(move.from === "stock"
        ? { op: "wasteToFoundation" }
        : { op: "tableauToFoundation", from: move.column });
      continue;
    }
    if (move.from === "stock") {
      play({ op: "wasteToTableau", to: move.column });
      continue;
    }
    play({
      op: "tableauToTableau",
      from: move.column,
      index: move.index - state.tableau[move.column].down.length,
      to: move.toColumn,
    });
  }

  if (!solitaire.result(state).won) throw new Error("The solver's line of play did not win");
  return replay;
};

/**
 * Scans deal seeds in order and keeps the ones the solver can win. Scanning in
 * order is what makes the artifact reproducible: the same seeds come back every
 * time, so rebuilding proves nothing changed rather than reshuffling the file.
 */
export const buildSolitaireDecks = async (engines, { count = SOLITAIRE_DECK_COUNT } = {}) => {
  const solve = await loadSolitaireSolver();
  const { rules, solitaire, into } = engines;
  const decks = [];
  for (let seed = 0; seed < SOLITAIRE_SEED_LIMIT && decks.length < count; seed += 1) {
    const raw = solitaire.generate(into({}), { seed, budget: rules.createBudget(1_000) });
    const solverMoves = solve(solverDeal(raw));
    if (!solverMoves) continue;
    proveWinnable(engines, raw, solverMoves);
    decks.push(encodeDeal(raw));
  }
  if (decks.length < count) {
    throw new Error(`Only ${decks.length} of ${count} deal seeds proved winnable`);
  }
  return decks;
};

/**
 * Carves puzzles with the shipped generator until each difficulty has its
 * quota, rejecting any that misses its clue target, repeats, or turns out to
 * have more than one answer. Seeds advance in order, so this too is reproducible.
 */
export const buildSudokuPuzzles = async (
  engines,
  { count = SUDOKU_PUZZLES_PER_DIFFICULTY } = {}
) => {
  const { createGeneratedSudokuPuzzle, countSudokuSolutions } = await loadSudokuGenerator();
  const clueTargets = await loadSudokuClueTargets();
  const { sudoku, into } = engines;
  const puzzles = {};
  const taken = new Set();

  for (const difficulty of sudoku.DIFFICULTIES) {
    const target = clueTargets[difficulty];
    if (!Number.isInteger(target)) throw new Error(`No clue target for ${difficulty}`);
    const made = [];
    for (let seed = 0; seed < SUDOKU_SEED_LIMIT && made.length < count; seed += 1) {
      const generated = createGeneratedSudokuPuzzle(
        target,
        SUDOKU_GENERATOR_ATTEMPTS,
        seededRandom(seed)
      );
      if (!generated || generated.clues !== target) continue;
      if (taken.has(generated.puzzle)) continue;
      if (countSudokuSolutions(generated.puzzle.split("").map(Number), 2) !== 1) continue;
      // The engine is the final word on whether a board can be issued at all.
      sudoku.initial(into({
        difficulty,
        puzzle: generated.puzzle,
        solution: generated.solution,
      }));
      taken.add(generated.puzzle);
      made.push({ puzzle: generated.puzzle, solution: generated.solution });
    }
    if (made.length < count) {
      throw new Error(`Only ${made.length} of ${count} ${difficulty} puzzles were generated`);
    }
    puzzles[difficulty] = made;
  }
  return puzzles;
};

export const buildIssuedGameCatalog = async (engines) => ({
  solitaire: await buildSolitaireDecks(engines),
  sudoku: await buildSudokuPuzzles(engines),
});

export const renderIssuedGameCatalog = (catalog) => {
  const decks = catalog.solitaire.map((deal) => `  ${JSON.stringify(deal)},`).join("\n");
  const puzzles = Object.entries(catalog.sudoku)
    .map(([difficulty, entries]) => [
      `  ${difficulty}: Object.freeze([`,
      ...entries.map(({ puzzle, solution }) =>
        `    Object.freeze({ puzzle: "${puzzle}", solution: "${solution}" }),`),
      "  ]),",
    ].join("\n"))
    .join("\n");

  return `// Generated by scripts/build-issued-game-catalog.mjs. Do not edit by hand.
//
// Prevalidated boards for verified Solitaire and Sudoku play. Every deal below
// was proved winnable, and every puzzle proved to have exactly one answer, by
// rebuilding this file from the shipped engines, solver and generator. Issuing a
// board is therefore an index into this table and nothing more: no backtracking
// search runs inside a request.
//
// To change it, run: node scripts/build-issued-game-catalog.mjs
export const ISSUED_CATALOG_VERSION = ${ISSUED_CATALOG_VERSION};

export const ISSUED_SOLITAIRE_SUIT_VARIANTS = ${SOLITAIRE_SUIT_VARIANTS};

const SOLITAIRE_VARIANT = "klondike-draw-one";

const SUIT_CODES = Object.freeze({ s: "spades", c: "clubs", d: "diamonds", h: "hearts" });

/** \`stock|column1|…|column7\`, each pile bottom to top, as short card codes. */
const SOLITAIRE_DEALS = Object.freeze([
${decks}
]);

const SUDOKU_PUZZLES = Object.freeze({
${puzzles}
});

const decodePile = (pile) =>
  (pile ? pile.split(" ") : []).map((code) => \`\${SUIT_CODES[code[0]]}-\${code.slice(1)}\`);

/**
 * Relabels the suits of a deal. The three bits of \`variant\` swap the two black
 * suits, the two red suits, and the colours themselves, so every card keeps its
 * rank, its colour and its position. Klondike legality reads only rank, colour
 * and suit equality, so each of the eight variants of a deal proved winnable is
 * winnable too — which is what lets one proved deal issue eight distinct games.
 * The generator's \`--check\` gate holds this against the rule engine's own
 * \`transformDeal\`, so the two can never disagree.
 */
const relabelSuits = (variant) => {
  const blacks = variant & 0b001 ? ["clubs", "spades"] : ["spades", "clubs"];
  const reds = variant & 0b010 ? ["hearts", "diamonds"] : ["diamonds", "hearts"];
  const [first, second] = variant & 0b100 ? [reds, blacks] : [blacks, reds];
  const map = { spades: first[0], clubs: first[1], diamonds: second[0], hearts: second[1] };
  return (id) => {
    const separator = id.lastIndexOf("-");
    return \`\${map[id.slice(0, separator)]}-\${id.slice(separator + 1)}\`;
  };
};

const issueSolitaire = (seed) => {
  const deal = SOLITAIRE_DEALS[seed % SOLITAIRE_DEALS.length];
  const relabel = relabelSuits(
    Math.floor(seed / SOLITAIRE_DEALS.length) % ISSUED_SOLITAIRE_SUIT_VARIANTS
  );
  const [stock, ...columns] = deal.split("|").map(decodePile);
  return {
    variant: SOLITAIRE_VARIANT,
    rngState: 0,
    stock: stock.map(relabel),
    waste: [],
    foundations: Object.freeze({ spades: 0, clubs: 0, diamonds: 0, hearts: 0 }),
    tableau: columns.map((pile) => ({
      down: pile.slice(0, -1).map(relabel),
      up: pile.slice(-1).map(relabel),
    })),
    moves: 0,
    won: false,
  };
};

const issueSudoku = (difficulty, seed) => {
  const puzzles = SUDOKU_PUZZLES[difficulty];
  if (!puzzles) throw new Error(\`Unknown Sudoku difficulty: \${String(difficulty)}\`);
  const { puzzle, solution } = puzzles[seed % puzzles.length];
  return { rngState: 0, difficulty, puzzle, solution };
};

/**
 * The full logical initial state for an issued game, ready for the matching
 * engine's \`initial\`. \`seed\` is the Worker's issuance seed; the same seed and
 * configuration always name the same board, so a resumed game keeps its own.
 */
export const generateIssuedInitial = (game, config, seed) => {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new Error(\`Invalid issued game seed: \${String(seed)}\`);
  }
  if (game === "solitaire") return issueSolitaire(seed);
  if (game === "sudoku") return issueSudoku(config?.difficulty, seed);
  throw new Error(\`No issued game catalog for: \${String(game)}\`);
};

/** How many distinct boards a game can issue, for tests and rate planning. */
export const issuedGameVariety = (game, config) => {
  if (game === "solitaire") return SOLITAIRE_DEALS.length * ISSUED_SOLITAIRE_SUIT_VARIANTS;
  if (game === "sudoku") return (SUDOKU_PUZZLES[config?.difficulty] || []).length;
  return 0;
};
`;
};

/**
 * Checks the artifact on its own terms, without rebuilding it: every issued
 * board is a complete deck or a uniquely solvable puzzle, every deal the
 * catalog hands out is one the rule engine accepts, and the catalog's suit
 * relabelling is the engine's own.
 */
export const verifyIssuedGameCatalog = async (engines, catalog, artifact) => {
  const { rules, solitaire, sudoku, into } = engines;
  const { countSudokuSolutions } = await loadSudokuGenerator();
  const clueTargets = await loadSudokuClueTargets();
  const problems = [];
  const expect = (condition, message) => {
    if (!condition) problems.push(message);
  };

  expect(
    catalog.solitaire.length >= 32,
    `the catalog holds ${catalog.solitaire.length} deals, fewer than the 32 required`
  );
  expect(
    artifact.issuedGameVariety("solitaire") ===
      catalog.solitaire.length * SOLITAIRE_SUIT_VARIANTS,
    "the Solitaire variety count does not match the stored deals"
  );

  catalog.solitaire.forEach((deal, index) => {
    const decoded = decodeDeal(deal);
    const ids = [...decoded.stock, ...decoded.tableau.flatMap((pile) => [...pile.down, ...pile.up])];
    expect(new Set(ids).size === solitaire.DECK_SIZE, `deal ${index} is not a complete deck`);
    expect(
      decoded.tableau.map((pile) => pile.down.length + pile.up.length).join() === "1,2,3,4,5,6,7",
      `deal ${index} is not a Klondike layout`
    );
  });

  // Every variant of every stored deal has to be issuable and, through the
  // relabelling proof, winnable. Checking all of them is cheap next to the
  // search that proved the originals.
  for (let index = 0; index < catalog.solitaire.length; index += 1) {
    for (let variant = 0; variant < SOLITAIRE_SUIT_VARIANTS; variant += 1) {
      const seed = variant * catalog.solitaire.length + index;
      const issued = artifact.generateIssuedInitial("solitaire", {}, seed);
      try {
        solitaire.initial(into(issued));
      } catch (error) {
        problems.push(`issued Solitaire seed ${seed} was rejected: ${error.message}`);
        continue;
      }
      const base = { ...decodeDeal(catalog.solitaire[index]), rngState: 0, waste: [], moves: 0 };
      base.foundations = { spades: 0, clubs: 0, diamonds: 0, hearts: 0 };
      const expected = solitaire.transformDeal(into(base), { seed: variant });
      expect(
        rules.canonicalJson(into(issued)) === rules.canonicalJson(into({
          ...expected, variant: "klondike-draw-one", rngState: 0,
        })),
        `issued Solitaire seed ${seed} does not match the engine's own relabelling`
      );
    }
  }

  const everyPuzzle = new Set();
  for (const difficulty of sudoku.DIFFICULTIES) {
    const entries = catalog.sudoku[difficulty] || [];
    expect(
      entries.length >= 16,
      `${difficulty} holds ${entries.length} puzzles, fewer than the 16 required`
    );
    const distinct = new Set(entries.map((entry) => entry.puzzle));
    expect(distinct.size === entries.length, `${difficulty} repeats a puzzle`);
    entries.forEach(({ puzzle, solution }, index) => {
      everyPuzzle.add(puzzle);
      const label = `${difficulty} puzzle ${index}`;
      const clues = Array.from(puzzle).filter((digit) => digit !== "0").length;
      expect(clues === clueTargets[difficulty], `${label} has ${clues} clues, not ${clueTargets[difficulty]}`);
      expect(sudoku.isCompleteSolution(solution), `${label} has an incomplete solution`);
      expect(
        Array.from(puzzle).every((digit, cell) => digit === "0" || digit === solution[cell]),
        `${label} disagrees with its solution`
      );
      expect(
        countSudokuSolutions(puzzle.split("").map(Number), 2) === 1,
        `${label} does not have exactly one answer`
      );
      try {
        sudoku.initial(into(artifact.generateIssuedInitial("sudoku", { difficulty }, index)));
      } catch (error) {
        problems.push(`issued ${label} was rejected: ${error.message}`);
      }
    });
  }
  const storedPuzzles = Object.values(catalog.sudoku).flat().length;
  expect(everyPuzzle.size === storedPuzzles, "two difficulties share a puzzle");

  for (const game of ["minesweeper", "snake", "chess"]) {
    let rejected = false;
    try {
      artifact.generateIssuedInitial(game, {}, 0);
    } catch {
      rejected = true;
    }
    expect(rejected, `the catalog issued a board for the unsupported game ${game}`);
  }
  for (const seed of [-1, 1.5, "0", null]) {
    let rejected = false;
    try {
      artifact.generateIssuedInitial("solitaire", {}, seed);
    } catch {
      rejected = true;
    }
    expect(rejected, `the catalog accepted the invalid seed ${String(seed)}`);
  }

  return problems;
};

const checkOnly = process.argv.includes("--check");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const engines = await loadRuleEngines();
  const catalog = await buildIssuedGameCatalog(engines);
  const rendered = renderIssuedGameCatalog(catalog);
  const current = await readFile(CATALOG_URL, "utf8").catch(() => null);

  if (checkOnly) {
    const artifact = await import(CATALOG_URL.href);
    const problems = await verifyIssuedGameCatalog(engines, catalog, artifact);
    if (current !== rendered) {
      problems.unshift(
        "the issued game catalog is stale. Run: node scripts/build-issued-game-catalog.mjs"
      );
    }
    if (problems.length) {
      process.stderr.write(`${problems.map((problem) => `- ${problem}`).join("\n")}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write(
        `Issued game catalog is current: ${catalog.solitaire.length} deals ` +
        `(${catalog.solitaire.length * SOLITAIRE_SUIT_VARIANTS} boards) and ` +
        `${Object.values(catalog.sudoku).flat().length} puzzles verified.\n`
      );
    }
  } else if (current === rendered) {
    process.stdout.write("Issued game catalog is current.\n");
  } else {
    await writeFile(CATALOG_URL, rendered, "utf8");
    process.stdout.write("Updated workers/game-stats/src/issued-game-catalog.mjs.\n");
  }
}
