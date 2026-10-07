import assert from "node:assert/strict";
import test from "node:test";

import {
  SOLITAIRE_DECK_COUNT,
  SOLITAIRE_SUIT_VARIANTS,
  SUDOKU_PUZZLES_PER_DIFFICULTY,
  decodeDeal,
  encodeDeal,
  loadRuleEngines,
  loadSudokuClueTargets,
  loadSudokuGenerator,
  verifyIssuedGameCatalog,
} from "../scripts/build-issued-game-catalog.mjs";
import * as catalog from "../workers/game-stats/src/issued-game-catalog.mjs";

/**
 * The catalog exists so that issuing a verified game costs a table lookup rather
 * than a backtracking search. These tests check the two things that makes
 * necessary: the boards it hands out really are the winnable deals and uniquely
 * solvable puzzles it claims, and a request can never provoke the search that
 * proved them.
 *
 * Rebuilding the artifact from source is `node scripts/build-issued-game-catalog.mjs
 * --check`, which the quality gates run; it takes seconds, so it stays out of the
 * fast suite and this file verifies the shipped artifact on its own terms.
 */

/** Engine state crosses a realm boundary, so it is rebuilt before comparison. */
const plain = (value) => JSON.parse(JSON.stringify(value));

const engines = await loadRuleEngines();
const { countSudokuSolutions } = await loadSudokuGenerator();
const clueTargets = await loadSudokuClueTargets();

test("the catalog holds more prevalidated boards than the contract requires", () => {
  assert.ok(catalog.ISSUED_CATALOG_VERSION >= 1);
  assert.equal(catalog.ISSUED_SOLITAIRE_SUIT_VARIANTS, SOLITAIRE_SUIT_VARIANTS);
  assert.ok(
    catalog.issuedGameVariety("solitaire") >= 32,
    "At least thirty-two Solitaire deals must be issuable."
  );
  assert.equal(
    catalog.issuedGameVariety("solitaire"),
    SOLITAIRE_DECK_COUNT * SOLITAIRE_SUIT_VARIANTS
  );
  for (const difficulty of engines.sudoku.DIFFICULTIES) {
    assert.ok(
      catalog.issuedGameVariety("sudoku", { difficulty }) >= 16,
      `${difficulty} must offer at least sixteen puzzles.`
    );
    assert.equal(
      catalog.issuedGameVariety("sudoku", { difficulty }),
      SUDOKU_PUZZLES_PER_DIFFICULTY
    );
  }
  assert.equal(catalog.issuedGameVariety("minesweeper"), 0);
});

test("every issued Solitaire board is a complete deck the rule engine accepts", () => {
  const seen = new Set();
  for (let seed = 0; seed < catalog.issuedGameVariety("solitaire"); seed += 1) {
    const issued = catalog.generateIssuedInitial("solitaire", {}, seed);
    const state = engines.solitaire.initial(engines.into(issued));
    assert.equal(state.moves, 0, `seed ${seed}`);
    assert.equal(state.won, false, `seed ${seed}`);
    assert.equal(state.undo.length, 0, `seed ${seed}`);
    assert.equal(state.stock.length, 24, `seed ${seed}`);
    assert.deepEqual(
      plain(state.tableau).map((pile) => pile.down.length + pile.up.length),
      [1, 2, 3, 4, 5, 6, 7],
      `seed ${seed}`
    );
    // Every column shows exactly its top card, which is the Klondike deal.
    assert.ok(plain(state.tableau).every((pile) => pile.up.length === 1), `seed ${seed}`);
    seen.add(engines.rules.canonicalJson(engines.into(issued)));
  }
  assert.equal(seen.size, catalog.issuedGameVariety("solitaire"), "No deal repeats.");
});

test("the catalog's suit relabelling is the rule engine's own", () => {
  const decks = catalog.issuedGameVariety("solitaire") / SOLITAIRE_SUIT_VARIANTS;
  for (let index = 0; index < decks; index += 1) {
    const base = catalog.generateIssuedInitial("solitaire", {}, index);
    for (let variant = 0; variant < SOLITAIRE_SUIT_VARIANTS; variant += 1) {
      const issued = catalog.generateIssuedInitial("solitaire", {}, variant * decks + index);
      const expected = engines.solitaire.transformDeal(engines.into(base), { seed: variant });
      assert.equal(
        engines.rules.canonicalJson(engines.into(issued)),
        engines.rules.canonicalJson(engines.into(expected)),
        `deck ${index} variant ${variant}`
      );
    }
  }
});

test("a deal round-trips through its compact encoding without losing a card", () => {
  const issued = catalog.generateIssuedInitial("solitaire", {}, 0);
  const encoded = encodeDeal(issued);
  assert.match(encoded, /^[schd]\d+(?: [schd]\d+)*(?:\|[schd]\d+(?: [schd]\d+)*)+$/);
  const decoded = decodeDeal(encoded);
  assert.deepEqual(decoded.stock, issued.stock);
  assert.deepEqual(decoded.tableau, issued.tableau);
  assert.throws(() => decodeDeal("x1|s1"), /Unknown card code/);
  assert.throws(() => decodeDeal("s99|s1"), /Unknown card code/);
});

test("every issued Sudoku puzzle has exactly one answer at its difficulty's clue count", () => {
  const everyPuzzle = new Set();
  for (const difficulty of engines.sudoku.DIFFICULTIES) {
    const count = catalog.issuedGameVariety("sudoku", { difficulty });
    const forDifficulty = new Set();
    for (let seed = 0; seed < count; seed += 1) {
      const issued = catalog.generateIssuedInitial("sudoku", { difficulty }, seed);
      const state = engines.sudoku.initial(engines.into(issued));
      assert.equal(state.difficulty, difficulty, `${difficulty} seed ${seed}`);
      assert.equal(state.solved, false, `${difficulty} seed ${seed}`);
      assert.equal(state.checksUsed, 0, `${difficulty} seed ${seed}`);
      assert.equal(state.values, state.puzzle, `${difficulty} seed ${seed}`);
      const clues = Array.from(issued.puzzle).filter((digit) => digit !== "0").length;
      assert.equal(clues, clueTargets[difficulty], `${difficulty} seed ${seed}`);
      assert.equal(
        countSudokuSolutions(issued.puzzle.split("").map(Number), 2),
        1,
        `${difficulty} seed ${seed} must have exactly one answer`
      );
      forDifficulty.add(issued.puzzle);
      everyPuzzle.add(issued.puzzle);
    }
    assert.equal(forDifficulty.size, count, `${difficulty} repeats a puzzle`);
  }
  assert.equal(
    everyPuzzle.size,
    engines.sudoku.DIFFICULTIES.reduce(
      (total, difficulty) => total + catalog.issuedGameVariety("sudoku", { difficulty }),
      0
    ),
    "Two difficulties must not share a puzzle."
  );
});

test("issuance is a table lookup, and refuses anything it has no board for", () => {
  const source = catalog.generateIssuedInitial.toString() + catalog.issuedGameVariety.toString();
  assert.doesNotMatch(
    source,
    /while|countSudokuSolutions|solve|search/i,
    "A request handler must never run the search that proved these boards."
  );

  for (const game of ["minesweeper", "snake", "chess", "", null]) {
    assert.throws(() => catalog.generateIssuedInitial(game, {}, 0), /No issued game catalog/);
  }
  assert.throws(
    () => catalog.generateIssuedInitial("sudoku", { difficulty: "fiendish" }, 0),
    /Unknown Sudoku difficulty/
  );
  assert.throws(() => catalog.generateIssuedInitial("sudoku", {}, 0), /Unknown Sudoku difficulty/);
  for (const seed of [-1, 1.5, "0", null, undefined, NaN, Number.MAX_SAFE_INTEGER + 2]) {
    assert.throws(
      () => catalog.generateIssuedInitial("solitaire", {}, seed),
      /Invalid issued game seed/,
      String(seed)
    );
  }

  // The same seed and configuration always name the same board, so a resumed
  // game keeps the one it was issued.
  assert.deepEqual(
    catalog.generateIssuedInitial("solitaire", {}, 7),
    catalog.generateIssuedInitial("solitaire", {}, 7)
  );
  assert.deepEqual(
    catalog.generateIssuedInitial("sudoku", { difficulty: "hard" }, 3),
    catalog.generateIssuedInitial("sudoku", { difficulty: "hard" }, 3)
  );
});

test("the generator's own gate agrees the shipped artifact is sound", async () => {
  // The same checks the build gate runs, against the artifact as shipped. The
  // gate additionally rebuilds it from source, which is too slow for this suite.
  const stored = {
    solitaire: Array.from(
      { length: catalog.issuedGameVariety("solitaire") / SOLITAIRE_SUIT_VARIANTS },
      (unused, index) => encodeDeal(catalog.generateIssuedInitial("solitaire", {}, index))
    ),
    sudoku: Object.fromEntries(
      engines.sudoku.DIFFICULTIES.map((difficulty) => [
        difficulty,
        Array.from(
          { length: catalog.issuedGameVariety("sudoku", { difficulty }) },
          (unused, seed) => {
            const issued = catalog.generateIssuedInitial("sudoku", { difficulty }, seed);
            return { puzzle: issued.puzzle, solution: issued.solution };
          }
        ),
      ])
    ),
  };
  assert.deepEqual(await verifyIssuedGameCatalog(engines, stored, catalog), []);
});
