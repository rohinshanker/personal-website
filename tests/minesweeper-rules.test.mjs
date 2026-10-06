import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [commonSource, minesweeperSource] = await Promise.all([
  readFile(new URL("../scripts/home/games/rules.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/home/games/minesweeper.js", import.meta.url), "utf8"),
]);

const createHarness = () => {
  const context = vm.createContext({});
  vm.runInContext(`${commonSource}\n${minesweeperSource}`, context);
  return {
    context,
    rules: context.homeMinesweeperRules,
    inRealm: (value) => vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(value))})`, context),
  };
};

const plain = (value) => JSON.parse(JSON.stringify(value));

test("Minesweeper publishes a frozen deterministic generator with first-cell safety", () => {
  const { rules, inRealm } = createHarness();
  assert.equal(Object.isFrozen(rules), true);
  const options = inRealm({ seed: 0x12345678, firstCell: 40 });
  const first = rules.generate(inRealm({ difficulty: "beginner" }), options);
  const second = rules.generate(
    inRealm({ difficulty: "beginner" }),
    inRealm({ seed: 0x12345678, firstCell: 40 })
  );
  assert.deepEqual(plain(first), plain(second));
  assert.equal(first.mineCells.length, 10);
  assert.equal(new Set(first.mineCells).size, 10);
  const protectedCells = new Set([40, ...rules.neighborsFor(40, 9, 9)]);
  assert.equal(first.mineCells.some((index) => protectedCells.has(index)), false);
  assert.notDeepEqual(
    plain(first.mineCells),
    plain(rules.generate(
      inRealm({ difficulty: "beginner" }),
      inRealm({ seed: 0x12345679, firstCell: 40 })
    ).mineCells)
  );
  assert.doesNotMatch(minesweeperSource, /\b(?:document|localStorage|fetch|setTimeout)\b|Math\.random/);
  const browser = vm.createContext({ window: {} });
  vm.runInContext(`${commonSource}\n${minesweeperSource}`, browser);
  assert.equal(Object.isFrozen(browser.window.homeMinesweeperRules), true);
});

test("Minesweeper validates issued layouts and clones independent logical state", () => {
  const { rules, inRealm } = createHarness();
  const raw = rules.generate(
    inRealm({ difficulty: "intermediate" }),
    inRealm({ seed: 7, firstCell: 0 })
  );
  const state = rules.initial(raw);
  state.cells[0].revealed = true;
  assert.equal(raw.mineCells.includes(0), false);
  assert.equal(rules.initial(raw).cells[0].revealed, false);
  const malformed = plain(raw);
  malformed.mineCells[1] = malformed.mineCells[0];
  assert.throws(() => rules.initial(inRealm(malformed)), /Duplicate/);
  const unsafe = plain(raw);
  unsafe.mineCells[0] = 0;
  assert.throws(() => rules.initial(inRealm(unsafe)), /not protected/);
  assert.throws(() => rules.generate(inRealm({ difficulty: "custom" }), inRealm({ seed: 1, firstCell: 0 })));
  assert.throws(() => rules.initial(inRealm({ ...plain(raw), extra: true })));
});

test("Minesweeper replays marks, first reveal, flood fill, and a complete win", () => {
  const { rules, inRealm } = createHarness();
  const apply = (state, action) =>
    rules.transition(state, inRealm({ seq: state.nextSeq, ...action }));
  const raw = rules.generate(
    inRealm({ difficulty: "beginner" }),
    inRealm({ seed: 99, firstCell: 0 })
  );
  const state = rules.initial(raw);
  const markedCell = raw.mineCells[0];
  apply(state, { op: "mark", cell: markedCell, mark: "flag" });
  apply(state, { op: "mark", cell: markedCell, mark: "question" });
  apply(state, { op: "mark", cell: markedCell, mark: "none" });
  apply(state, { op: "reveal", cell: 0 });
  assert.equal(state.started, true);
  assert.equal(state.cells[0].revealed, true);
  for (let index = 0; index < state.cells.length && !state.terminal; index += 1) {
    if (!state.cells[index].mine && !state.cells[index].revealed) {
      apply(state, { op: "reveal", cell: index });
    }
  }
  assert.deepEqual(plain(rules.result(state)), {
    terminal: true,
    won: true,
    lost: false,
    score: null,
    moves: state.moves,
    assistance: "none",
    configuration: { difficulty: "beginner" },
  });
  assert.equal(state.flagCount, 10);
  assert.equal(state.cells.filter((cell) => cell.mine && cell.mark === "flag").length, 10);
});

test("Minesweeper rejects altered actions and stops permanently at a loss", () => {
  const { rules, inRealm } = createHarness();
  const apply = (state, action) =>
    rules.transition(state, inRealm({ seq: state.nextSeq, ...action }));
  const raw = rules.generate(
    inRealm({ difficulty: "beginner" }),
    inRealm({ seed: 123, firstCell: 0 })
  );
  const wrongFirst = rules.initial(raw);
  assert.throws(
    () => rules.transition(wrongFirst, inRealm({ seq: 1, op: "reveal", cell: 1 })),
    (error) => error.code === "first-cell-mismatch"
  );
  const state = rules.initial(raw);
  apply(state, { op: "reveal", cell: 0 });
  const mine = raw.mineCells.find((index) => !state.cells[index].revealed);
  apply(state, { op: "reveal", cell: mine });
  assert.equal(state.terminal, true);
  assert.equal(state.lost, true);
  assert.equal(state.cells[mine].blown, true);
  assert.equal(state.cells.filter((cell) => cell.mine && cell.revealed).length, 10);
  assert.throws(
    () => apply(state, { op: "mark", cell: 1, mark: "flag" }),
    (error) => error.code === "terminal"
  );
  const fresh = rules.initial(raw);
  assert.throws(() => rules.transition(fresh, inRealm({ seq: 2, op: "reveal", cell: 0 })));
  assert.throws(() => rules.transition(fresh, inRealm({ seq: 1, op: "reveal", cell: 0, extra: 1 })));
});

test("Minesweeper chords legal neighbors and halts the chord on its first mine", () => {
  const { rules, inRealm } = createHarness();
  const apply = (state, action) =>
    rules.transition(state, inRealm({ seq: state.nextSeq, ...action }));
  let scenario = null;
  for (let seed = 1; seed < 200 && !scenario; seed += 1) {
    const raw = rules.generate(
      inRealm({ difficulty: "beginner" }),
      inRealm({ seed, firstCell: 0 })
    );
    const state = rules.initial(raw);
    apply(state, { op: "reveal", cell: 0 });
    for (let index = 0; index < state.cells.length; index += 1) {
      const cell = state.cells[index];
      if (!cell.revealed || cell.adjacent < 1) continue;
      const neighbors = rules.neighborsFor(index, 9, 9);
      const mines = neighbors.filter((neighbor) => state.cells[neighbor].mine);
      const safeCovered = neighbors.filter(
        (neighbor) => !state.cells[neighbor].mine && !state.cells[neighbor].revealed
      );
      if (mines.length === cell.adjacent && safeCovered.length) {
        scenario = { raw, index, mines, safeCovered };
        break;
      }
    }
  }
  assert.ok(scenario, "expected a deterministic chord scenario");
  const legal = rules.initial(scenario.raw);
  apply(legal, { op: "reveal", cell: 0 });
  scenario.mines.forEach((cell) => apply(legal, { op: "mark", cell, mark: "flag" }));
  apply(legal, { op: "chord", cell: scenario.index });
  assert.equal(scenario.safeCovered.some((cell) => legal.cells[cell].revealed), true);

  const losing = rules.initial(scenario.raw);
  losing.cells.forEach((cell) => Object.assign(cell, {
    mine: false,
    adjacent: 0,
    revealed: false,
    mark: "none",
    blown: false,
    misflagged: false,
  }));
  losing.started = true;
  losing.firstCell = 10;
  losing.cells[10].revealed = true;
  losing.cells[10].adjacent = 1;
  losing.cells[1].mine = true;
  losing.revealedSafeCount = 1;
  losing.flagCount = 0;
  losing.moves = 0;
  losing.nextSeq = 1;
  apply(losing, { op: "mark", cell: 0, mark: "flag" });
  apply(losing, { op: "chord", cell: 10 });
  assert.equal(losing.lost, true);
  assert.equal(losing.cells[1].blown, true);
  assert.equal(losing.cells[2].revealed, false, "the chord stops at the triggered mine");
});

test("Minesweeper charges generation and transition work budgets", () => {
  const { context, rules, inRealm } = createHarness();
  const tinyBudget = context.homeGameRules.createBudget(1);
  assert.throws(
    () => rules.generate(inRealm({ difficulty: "beginner" }), {
      seed: 1,
      firstCell: 0,
      budget: tinyBudget,
    }),
    (error) => error.code === "replay-limit"
  );
  const raw = rules.generate(inRealm({ difficulty: "beginner" }), inRealm({ seed: 1, firstCell: 0 }));
  const state = rules.initial(raw);
  assert.throws(
    () => rules.transition(
      state,
      inRealm({ seq: 1, op: "reveal", cell: 0 }),
      context.homeGameRules.createBudget(0)
    ),
    (error) => error.code === "replay-limit"
  );
  const limited = rules.initial(raw);
  limited.nextSeq = context.homeGameRules.GAME_RULE_LIMITS.minesweeper.inputs + 1;
  assert.throws(
    () => rules.transition(limited, inRealm({
      seq: limited.nextSeq,
      op: "reveal",
      cell: 0,
    })),
    (error) => error.code === "replay-limit"
  );
});
