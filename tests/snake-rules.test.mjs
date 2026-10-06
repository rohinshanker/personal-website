import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [commonSource, snakeSource] = await Promise.all([
  readFile(new URL("../scripts/home/games/rules.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/home/games/snake.js", import.meta.url), "utf8"),
]);

const createHarness = () => {
  const context = vm.createContext({});
  vm.runInContext(`${commonSource}\n${snakeSource}`, context);
  return {
    context,
    rules: context.homeSnakeRules,
    inRealm: (value) => vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(value))})`, context),
  };
};

const plain = (value) => JSON.parse(JSON.stringify(value));
test("Snake publishes a frozen deterministic initial state without cosmetic randomness", () => {
  const { rules, inRealm } = createHarness();
  assert.equal(Object.isFrozen(rules), true);
  const first = rules.generate(inRealm({ boardSize: "16" }), inRealm({ seed: 0xabcdef01 }));
  const second = rules.generate(inRealm({ boardSize: "16" }), inRealm({ seed: 0xabcdef01 }));
  assert.deepEqual(plain(first), plain(second));
  assert.equal(first.apples.length, 1);
  assert.equal(first.snake.some((segment) => rules.cellsMatch(segment, first.apples[0])), false);
  assert.equal("sweepOffset" in first.apples[0], false);
  assert.equal(snakeSource.includes("Math.random"), false);
  assert.doesNotMatch(snakeSource, /\b(?:document|localStorage|fetch|setTimeout)\b/);
  const browser = vm.createContext({ window: {} });
  vm.runInContext(`${commonSource}\n${snakeSource}`, browser);
  assert.equal(Object.isFrozen(browser.window.homeSnakeRules), true);
  for (const boardSize of ["10", "16", "20", "24"]) {
    assert.equal(rules.generate(inRealm({ boardSize }), inRealm({ seed: 1 })).configuration.boardSize, boardSize);
  }
});

test("Snake validates and independently clones issued state", () => {
  const { rules, inRealm } = createHarness();
  const raw = rules.generate(inRealm({ boardSize: "10" }), inRealm({ seed: 8 }));
  const state = rules.initial(raw);
  state.snake[0].x = 0;
  assert.notEqual(raw.snake[0].x, 0);
  const overlap = plain(raw);
  overlap.apples[0] = overlap.snake[0];
  assert.throws(() => rules.initial(inRealm(overlap)), /overlaps/);
  const duplicate = plain(raw);
  duplicate.snake[1] = duplicate.snake[0];
  assert.throws(() => rules.initial(inRealm(duplicate)), /overlaps/);
  assert.throws(() => rules.initial(inRealm({ ...plain(raw), extra: true })));
  assert.throws(() => rules.generate(inRealm({ boardSize: "12" }), inRealm({ seed: 1 })));
});

test("Snake keeps the two-command queue and indexes directions by completed tick", () => {
  const { rules, inRealm } = createHarness();
  const direct = (state, direction) => rules.transition(state, inRealm({
    seq: state.nextSeq,
    op: "direction",
    tick: state.tick,
    direction,
  }));
  const state = rules.initial(rules.generate(inRealm({ boardSize: "10" }), inRealm({ seed: 9 })));
  direct(state, "up");
  direct(state, "left");
  assert.deepEqual(plain(state.directionQueue), ["up", "left"]);
  assert.throws(() => direct(state, "down"), (error) => error.code === "illegal-action");
  rules.step(state);
  assert.equal(state.tick, 1);
  assert.equal(state.direction, "up");
  assert.deepEqual(plain(state.directionQueue), ["left"]);
  rules.step(state);
  assert.equal(state.tick, 2);
  assert.equal(state.direction, "left");
  assert.throws(
    () => rules.transition(state, inRealm({
      seq: state.nextSeq,
      op: "direction",
      tick: 1,
      direction: "down",
    })),
    /Invalid Snake direction/
  );
  assert.throws(() => direct(state, "right"), (error) => error.code === "illegal-action");
});

test("Snake eats reproducible apples, grows, and derives the terminal collision result", () => {
  const { rules, inRealm } = createHarness();
  const raw = rules.generate(inRealm({ boardSize: "10" }), inRealm({ seed: 77 }));
  const state = rules.initial(raw);
  const head = state.snake[0];
  state.apples = [{ x: head.x + 1, y: head.y }];
  const rngBefore = state.rngState;
  rules.step(state);
  assert.equal(state.score, 1);
  assert.equal(state.snake.length, 4);
  assert.notEqual(state.rngState, rngBefore);
  while (!state.terminal) rules.step(state);
  assert.deepEqual(plain(rules.result(state)), {
    terminal: true,
    won: false,
    lost: true,
    score: 1,
    moves: 0,
    assistance: "none",
    configuration: { boardSize: "10" },
    terminalTick: state.tick,
  });
  assert.throws(() => rules.step(state), (error) => error.code === "terminal");
});

test("Snake permits moving into a tail cell that vacates on the same tick", () => {
  const { rules, inRealm } = createHarness();
  const state = rules.initial(rules.generate(inRealm({ boardSize: "10" }), inRealm({ seed: 22 })));
  state.snake = [
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 1, y: 3 },
    { x: 1, y: 2 },
  ];
  state.direction = "left";
  state.apples = [{ x: 9, y: 9 }];
  rules.step(state);
  assert.equal(state.terminal, false);
  assert.deepEqual(plain(state.snake[0]), { x: 1, y: 2 });
  assert.equal(state.snake.length, 4);
});

test("Snake rejects malformed replay actions and enforces work budgets", () => {
  const { context, rules, inRealm } = createHarness();
  const raw = rules.generate(inRealm({ boardSize: "10" }), inRealm({ seed: 3 }));
  const state = rules.initial(raw);
  assert.throws(() => rules.transition(state, inRealm({ seq: 1, op: "step", tick: 0, direction: "up" })));
  assert.throws(() => rules.transition(state, inRealm({ seq: 2, op: "direction", tick: 0, direction: "up" })));
  assert.throws(() => rules.transition(state, inRealm({ seq: 1, op: "direction", tick: 0, direction: "up", extra: 1 })));
  assert.throws(
    () => rules.generate(
      inRealm({ boardSize: "24" }),
      { seed: 3, budget: context.homeGameRules.createBudget(1) }
    ),
    (error) => error.code === "replay-limit"
  );
  assert.throws(
    () => rules.step(state, context.homeGameRules.createBudget(0)),
    (error) => error.code === "replay-limit"
  );
  const inputLimited = rules.initial(raw);
  inputLimited.nextSeq = context.homeGameRules.GAME_RULE_LIMITS.snake.inputs + 1;
  assert.throws(
    () => rules.transition(inputLimited, inRealm({
      seq: inputLimited.nextSeq,
      op: "direction",
      tick: 0,
      direction: "up",
    })),
    (error) => error.code === "replay-limit"
  );
  const tickLimited = rules.initial(raw);
  tickLimited.tick = context.homeGameRules.GAME_RULE_LIMITS.snake.ticks;
  assert.throws(() => rules.step(tickLimited), (error) => error.code === "replay-limit");
});
