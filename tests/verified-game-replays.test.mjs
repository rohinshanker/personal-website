import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVerifiedGameFixtures,
  loadVerifiedGameEngines,
  plainValue,
  replayGame,
  sequence,
} from "./helpers/verified-sol-sudoku-fixtures.mjs";

/**
 * Verifying a result means replaying ordered inputs against the board the server
 * issued and deriving the outcome from them. These tests hold the Solitaire and
 * Sudoku engines to that: a legal replay reaches exactly one known result, and
 * every way of being wrong is refused rather than quietly tolerated.
 */

const engines = await loadVerifiedGameEngines();
const fixtures = await buildVerifiedGameFixtures(engines);
const { GameRuleError } = engines.rules;

const isRuleError = (error) => error instanceof GameRuleError;

for (const game of ["solitaire", "sudoku"]) {
  test(`${game}: every legal replay derives exactly the result it claims`, () => {
    for (const fixture of fixtures[game].valid) {
      const outcome = replayGame(engines, game, fixture.initial, fixture.replay);
      for (const [key, expected] of Object.entries(fixture.expected)) {
        assert.equal(outcome.result[key], expected, `${fixture.name}: ${key}`);
      }
      assert.equal(outcome.result.lost, false, fixture.name);
      assert.ok(outcome.spent > 0, `${fixture.name} must charge for its work`);
    }
  });

  test(`${game}: a replay that is wrong in any one way is refused`, () => {
    for (const fixture of fixtures[game].invalid) {
      if (fixture.mayReplayLegally) {
        // Reusing a proof against a different board need not be illegal move by
        // move; what it must never do is reproduce the result it was made for.
        let reproduced = false;
        try {
          reproduced = replayGame(engines, game, fixture.initial, fixture.replay).result.won;
        } catch (error) {
          assert.ok(isRuleError(error), fixture.name);
        }
        assert.equal(reproduced, false, fixture.name);
        continue;
      }
      assert.throws(
        () => replayGame(engines, game, fixture.initial, fixture.replay),
        isRuleError,
        fixture.name
      );
    }
  });

  test(`${game}: an initial state the rules do not allow is refused`, () => {
    const engine = game === "solitaire" ? engines.solitaire : engines.sudoku;
    for (const fixture of fixtures[game].alteredInitials) {
      assert.throws(
        () => engine.initial(engines.into(fixture.initial)),
        isRuleError,
        fixture.name
      );
    }
  });

  test(`${game}: the browser and the verifier reach byte-identical state`, async () => {
    // A browser loads these as ordered classic scripts and the Worker imports the
    // same source as a module. Two realms stand in for the two, and the canonical
    // JSON of the finished state is what has to match.
    const browser = await loadVerifiedGameEngines();
    for (const fixture of fixtures[game].valid) {
      assert.equal(
        replayGame(browser, game, fixture.initial, fixture.replay).canonical,
        replayGame(engines, game, fixture.initial, fixture.replay).canonical,
        fixture.name
      );
    }
  });

  test(`${game}: verification work is bounded before the replay runs`, () => {
    const limits = engines.rules.GAME_RULE_LIMITS[game];
    assert.ok(limits.inputs > 0 && limits.work > 0 && limits.bytes > 0);
    const fixture = fixtures[game].valid[0];
    const needed = replayGame(engines, game, fixture.initial, fixture.replay).spent;
    assert.throws(
      () => replayGame(engines, game, fixture.initial, fixture.replay, { work: needed - 1 }),
      (error) => error.code === "replay-limit",
      "A replay that outruns its budget stops instead of finishing"
    );
  });
}

test("solitaire: the eight suit relabellings of a proved deal are all winnable", () => {
  const { solitaire, rules, into } = engines;
  const [winning] = fixtures.solitaire.valid;
  const seen = new Set();

  for (let variant = 0; variant < 8; variant += 1) {
    const relabelled = plainValue(solitaire.transformDeal(into(winning.initial), { seed: variant }));
    seen.add(rules.canonicalJson(into(relabelled)));
    // Suit relabelling keeps every rank, colour and position, and Klondike reads
    // only those, so the very same line of play has to win here too.
    const outcome = replayGame(engines, "solitaire", relabelled, winning.replay);
    assert.equal(outcome.result.won, true, `variant ${variant}`);
    assert.equal(outcome.result.moves, winning.expected.moves, `variant ${variant}`);
  }
  assert.equal(seen.size, 8, "Each variant is a distinct deal.");
});

test("solitaire: undo is bounded, and one auto-solve run costs one undo", () => {
  const { solitaire, rules, into } = engines;
  const [, , autoSolve] = fixtures.solitaire.valid;
  assert.equal(solitaire.MAX_UNDO_STATES, 100);

  // Draws and undos, more than the stack can hold.
  const deal = fixtures.solitaire.valid[0].initial;
  const budget = rules.createBudget(2_000_000);
  const state = solitaire.initial(into(deal));
  for (let step = 0; step < 24; step += 1) {
    solitaire.transition(state, into({ seq: step + 1, op: "draw" }), budget);
  }
  assert.equal(state.undo.length, 24);
  assert.equal(state.moves, 24);

  // A run brackets its own moves, so the whole animation reverts in one step.
  const run = solitaire.initial(into(autoSolve.initial));
  solitaire.transition(run, into({ seq: 1, op: "autoRunStart" }), budget);
  assert.equal(run.undo.length, 1);
  autoSolve.replay.slice(1, 5).forEach((action, index) => {
    solitaire.transition(run, into({ ...action, seq: index + 2 }), budget);
  });
  assert.equal(run.undo.length, 1, "Landed cards add no further undo steps.");
  assert.equal(run.autoMoves, 4);
  assert.equal(plainValue(solitaire.result(run)).assistance, "autoSolve");
  solitaire.transition(run, into({ seq: 6, op: "autoRunEnd" }), budget);
  solitaire.transition(run, into({ seq: 7, op: "undo" }), budget);
  assert.equal(run.moves, 0, "One undo takes the whole run back.");
  assert.equal(run.undo.length, 0);
});

test("sudoku: the three check allowances are spent only on revealed mistakes", () => {
  const { sudoku, rules, into } = engines;
  const budget = rules.createBudget(2_000_000);
  const state = sudoku.initial(into(fixtures.sudoku.valid[0].initial));
  const wrong = String((Number(state.solution[1]) % 9) + 1);
  let seq = 0;
  const play = (action) => sudoku.transition(state, into({ ...action, seq: (seq += 1) }), budget);

  // A clean board is free, however many allowances are left.
  play({ op: "check" });
  play({ op: "check" });
  assert.equal(state.checksUsed, 0);

  play({ op: "setValue", index: 1, value: wrong });
  for (let attempt = 0; attempt < 5; attempt += 1) play({ op: "check" });
  assert.equal(state.checksUsed, sudoku.MAX_LEADERBOARD_CHECKS);
  assert.equal(state.mistakes, 0, "A refused check reveals nothing.");

  // Spent allowances never make a clean board unverifiable, and the finished
  // board still submits.
  play({ op: "setValue", index: 1, value: state.solution[1] });
  play({ op: "check" });
  assert.equal(state.checksUsed, 3);
  assert.equal(plainValue(sudoku.result(state)).assistance, "noHints");
});

test("sudoku: undo and redo restore the board and never the assistance", () => {
  const { sudoku, rules, into } = engines;
  const budget = rules.createBudget(2_000_000);
  const state = sudoku.initial(into({
    ...fixtures.sudoku.valid[0].initial,
    errorsConfirmed: true,
    hintMode: "errors",
    checksUsed: 2,
  }));
  const wrong = String((Number(state.solution[1]) % 9) + 1);
  let seq = 0;
  const play = (action) => sudoku.transition(state, into({ ...action, seq: (seq += 1) }), budget);

  play({ op: "setValue", index: 1, value: wrong });
  assert.equal(state.usedHint, true, "A marked wrong value latches the puzzle.");
  assert.equal(state.undo.length, 1);

  play({ op: "undo" });
  assert.equal(state.values[1], "0");
  assert.equal(state.usedHint, true, "Undo cannot reverse a disqualification.");
  assert.equal(state.checksUsed, 2, "Nor hand back a spent allowance.");
  play({ op: "redo" });
  assert.equal(state.values[1], wrong);

  // The bound holds, and the oldest entry is the one that goes.
  assert.equal(sudoku.MAX_UNDO_STATES, 80);
  for (let step = 0; step < 100; step += 1) {
    const index = 1 + (step % 2) * 2;
    play({ op: "setValue", index, value: String((step % 9) + 1) === state.values[index]
      ? String(((step + 1) % 9) + 1)
      : String((step % 9) + 1) });
  }
  assert.equal(state.undo.length, 80);
});

test("sudoku: placing a digit retires the pencil marks it rules out, as one move", () => {
  const { sudoku, rules, into } = engines;
  const budget = rules.createBudget(2_000_000);
  const state = sudoku.initial(into(fixtures.sudoku.valid[0].initial));
  const digit = state.solution[1];
  const peers = plainValue(sudoku.PEERS[1]).filter((index) => state.puzzle[index] === "0");
  let seq = 0;
  const play = (action) => sudoku.transition(state, into({ ...action, seq: (seq += 1) }), budget);

  peers.slice(0, 4).forEach((index) => play({ op: "toggleNote", index, digit }));
  assert.ok(peers.slice(0, 4).every((index) => state.notes[index] === digit));

  play({ op: "setValue", index: 1, value: digit });
  assert.ok(
    peers.slice(0, 4).every((index) => state.notes[index] === ""),
    "A placed digit cannot stay pencilled into its own row, column or box."
  );

  play({ op: "undo" });
  assert.ok(
    peers.slice(0, 4).every((index) => state.notes[index] === digit),
    "One undo puts the value and every mark it cleared back together."
  );
});

test("a played digit is exactly one digit, and the board stays eighty-one cells", () => {
  const { sudoku, rules, into } = engines;
  const { initial: issued } = fixtures.sudoku.valid[0];
  const budget = () => rules.createBudget(2_000_000);

  // `DIGITS.includes(value)` is substring matching: it answers true for the
  // empty string, for "89" and for the whole alphabet. A value of more than one
  // character written into the grid pushed it past eighty-one cells, and the
  // cell beyond the board was never scored — so a board that read as complete
  // and correct could be assembled out of one extra character.
  // DEM-258 review finding 1, reproduced here as the thing that must not work.
  const blanks = Array.from({ length: sudoku.CELL_COUNT }, (unused, index) => index)
    .filter((index) => issued.puzzle[index] === "0");
  const lastBlank = blanks.at(-1);
  const forged = sudoku.initial(into(issued));
  let seq = 0;
  const play = (state, action) =>
    sudoku.transition(state, into({ ...action, seq: (seq += 1) }), budget());

  blanks.slice(0, -1).forEach((index) => {
    play(forged, { op: "setValue", index, value: issued.solution[index] });
  });
  assert.equal(forged.values.length, sudoku.CELL_COUNT);
  assert.throws(
    () => play(forged, {
      op: "setValue",
      index: lastBlank,
      value: issued.solution.slice(lastBlank - 1, lastBlank + 1),
    }),
    (error) => error.code === "invalid-input",
    "Two characters into the final cell must be refused"
  );
  assert.equal(forged.values.length, sudoku.CELL_COUNT, "A refused move changes nothing");
  assert.equal(plainValue(sudoku.evaluate(forged)).complete, false);
  assert.equal(plainValue(sudoku.result(forged)).won, false);

  // Honest play on the very same board still finishes.
  play(forged, { op: "setValue", index: lastBlank, value: issued.solution[lastBlank] });
  play(forged, { op: "check" });
  assert.equal(plainValue(sudoku.result(forged)).won, true);

  // Every value-taking operation shares one test, and it is exact.
  const fresh = sudoku.initial(into(issued));
  const firstBlank = blanks[0];
  for (const value of ["", "89", "123456789", "0", " 1", "1 ", "\u0661", 1, null, true]) {
    assert.throws(
      () => sudoku.transition(fresh, into({ seq: 1, op: "setValue", index: firstBlank, value }), budget()),
      (error) => error.code === "invalid-input",
      `setValue ${JSON.stringify(value) ?? String(value)}`
    );
    assert.throws(
      () => sudoku.transition(fresh, into({ seq: 1, op: "toggleNote", index: firstBlank, digit: value }), budget()),
      (error) => error.code === "invalid-input",
      `toggleNote ${JSON.stringify(value) ?? String(value)}`
    );
  }
  assert.equal(sudoku.assertDigit("7", "digit"), "7");
  assert.equal(fresh.values, issued.puzzle, "None of them touched the board");
  assert.deepEqual(plainValue(fresh.notes).filter(Boolean), []);

  // A clear is its own operation and still works, on a value and on marks.
  play(fresh, { op: "setValue", index: firstBlank, value: issued.solution[firstBlank] });
  play(fresh, { op: "clear", index: firstBlank });
  assert.equal(fresh.values[firstBlank], "0");
  play(fresh, { op: "toggleNote", index: firstBlank, digit: "4" });
  assert.equal(fresh.notes[firstBlank], "4");
  play(fresh, { op: "clear", index: firstBlank });
  assert.equal(fresh.notes[firstBlank], "");
  assert.equal(fresh.values.length, sudoku.CELL_COUNT);
});

test("both engines publish one frozen portable contract in either runtime", async () => {
  for (const [game, contract] of [["solitaire", "homeSolitaireRules"], ["sudoku", "homeSudokuRules"]]) {
    const engine = game === "solitaire" ? engines.solitaire : engines.sudoku;
    assert.equal(Object.isFrozen(engine), true, game);
    for (const name of ["initial", "transition", "result", "canApply"]) {
      assert.equal(typeof engine[name], "function", `${game}.${name}`);
    }
    assert.equal(engines.context[contract], engine, game);
  }

  // No DOM, clock, storage or network may appear in a portable engine, and the
  // only randomness is the seeded generator the rule helpers own.
  const { readFile } = await import("node:fs/promises");
  for (const file of ["solitaire", "sudoku"]) {
    const source = await readFile(
      new URL(`../scripts/home/games/${file}.js`, import.meta.url),
      "utf8"
    );
    assert.match(source, /^\(\(\) => \{\nconst window = globalThis\.window \|\| globalThis;/m, file);
    assert.match(source, new RegExp(`window\\.home\\w+Rules = Object\\.freeze\\(\\{`), file);
    assert.doesNotMatch(
      source,
      /document|localStorage|sessionStorage|fetch\(|XMLHttpRequest|setTimeout|setInterval|requestAnimationFrame|Date\.now|new Date|Math\.random|performance\./,
      `${file} must stay a pure rule engine`
    );
  }
});

test("replay ordering is checked before any engine sees an action", () => {
  const ordering = [
    ...fixtures.solitaire.invalid.filter((fixture) => fixture.ordering),
    ...fixtures.sudoku.invalid.filter((fixture) => fixture.ordering),
  ];
  assert.ok(ordering.length >= 3);
  for (const fixture of ordering) {
    assert.throws(
      () => engines.rules.assertReplay(engines.into(fixture.replay)),
      isRuleError,
      fixture.name
    );
  }
  assert.deepEqual(plainValue(engines.rules.assertReplay(engines.into(sequence([{ op: "draw" }])))), [
    { op: "draw", seq: 1 },
  ]);
});
