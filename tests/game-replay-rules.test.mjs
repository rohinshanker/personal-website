import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../scripts/home/games/rules.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(source, context);
const rules = context.homeGameRules;
const inRealm = (value) => vm.runInContext(`(${JSON.stringify(value)})`, context);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("rule helpers publish a frozen portable contract with bounded game limits", () => {
  assert.equal(Object.isFrozen(rules), true);
  assert.equal(rules.RESULT_PROTOCOL, 2);
  assert.equal(rules.RULES_VERSION, 1);
  assert.equal(rules.REPLAY_VERSION, 1);
  assert.equal(rules.GAME_RULE_LIMITS.snake.ticks * rules.SNAKE_TICK_MS <= rules.SESSION_LIFETIME_MS, true);
  for (const value of Object.values(rules.GAME_RULE_LIMITS)) assert.equal(Object.isFrozen(value), true);
  const browser = vm.createContext({ window: {} });
  vm.runInContext(source, browser);
  assert.equal(browser.window.homeGameRules.RESULT_PROTOCOL, 2);
});

test("integer and object validation reject malformed values and unknown keys", () => {
  assert.equal(rules.assertInteger(0, 0, 4), 0);
  for (const invalid of [-1, 5, 1.5, "1", null, Infinity]) {
    assert.throws(() => rules.assertInteger(invalid, 0, 4), /Invalid/);
  }
  const value = inRealm({ op: "move" });
  assert.equal(rules.assertObject(value, ["op"]), value);
  const noPrototype = vm.runInContext("Object.create(null)", context);
  assert.equal(rules.assertObject(noPrototype, []), noPrototype);
  for (const invalid of [null, [], "x", inRealm({ unknown: 1 }), vm.runInContext("new Date()", context)]) {
    assert.throws(() => rules.assertObject(invalid, ["op"]), /Invalid/);
  }
});

test("work budgets charge exactly, reject invalid charges, and never overspend", () => {
  const budget = rules.createBudget(3);
  budget.spend(); budget.spend(2); budget.spend(0);
  assert.equal(budget.remaining, 0);
  assert.throws(() => budget.spend(), (error) => error.code === "replay-limit");
  assert.equal(budget.remaining, 0);
  for (const invalid of [-1, 1.5, "1", Infinity, NaN]) {
    assert.throws(() => rules.createBudget(invalid));
    assert.throws(() => budget.spend(invalid));
  }
  assert.throws(() => rules.createBudget(120_000_001));
  const largest = rules.createBudget(120_000_000);
  assert.throws(() => largest.spend(10_000_001));
  assert.equal(largest.remaining, 120_000_000);
});

test("seeded randomness and shuffles are reproducible without changing source arrays", () => {
  for (const seed of [0, 1, 0xffffffff]) {
    const first = { rngState: seed }; const second = { rngState: seed };
    const values = Array.from({ length: 52 }, (_, index) => index);
    const budget = rules.createBudget(51);
    const shuffled = rules.shuffle(values, first, budget);
    assert.deepEqual(plain(shuffled), plain(rules.shuffle(values, second)));
    assert.deepEqual(values, Array.from({ length: 52 }, (_, index) => index));
    assert.deepEqual(plain(shuffled).sort((left, right) => left - right), values);
    assert.equal(budget.remaining, 0);
    for (let index = 0; index < 100; index += 1) {
      const next = rules.nextRandom(first);
      assert.equal(next >= 0 && next < 1, true);
    }
  }
  assert.deepEqual(plain(rules.shuffle([], { rngState: 0 })), []);
  assert.throws(() => rules.shuffle("x", { rngState: 0 }));
  assert.throws(() => rules.shuffle(Array(4097), { rngState: 0 }));
  assert.throws(() => rules.nextRandom({ rngState: -1 }));
  assert.equal(rules.randomIndex({ rngState: 0 }, 1), 0);
  assert.throws(() => rules.randomIndex({ rngState: 0 }, 0));
});

test("canonical JSON sorts keys, clones independently, and rejects unsupported data", () => {
  const value = inRealm({ z: [1, null, true], a: { y: "value", b: 3 } });
  assert.equal(rules.canonicalJson(value), '{"a":{"b":3,"y":"value"},"z":[1,null,true]}');
  const cloned = rules.cloneState(value);
  cloned.a.b = 4;
  assert.equal(value.a.b, 3);
  for (const invalid of [undefined, Infinity, NaN, () => {}, 1n]) {
    assert.throws(() => rules.canonicalJson(invalid));
  }
  assert.throws(() => rules.canonicalJson(vm.runInContext("new Date()", context)));
  assert.throws(() => rules.canonicalJson(vm.runInContext("({a:undefined})", context)));
  const nested = inRealm(Array(18).fill(0).reduce((value) => [value], 0));
  assert.throws(() => rules.canonicalJson(nested), /deeply nested/);
  assert.throws(() => rules.canonicalJson(inRealm(Array(500_001).fill(0))), /work limit/);
});

test("replay ordering rejects gaps, duplicates, missing operations and excessive input", () => {
  const inputs = [{ seq: 1, op: "move" }, { seq: 2, op: "undo" }];
  assert.equal(rules.assertReplay(inputs), inputs);
  assert.equal(rules.assertReplay([]).length, 0);
  for (const invalid of [null, {}, [{seq: 2, op: "move"}], [{seq: 1}], [null], [[]], [{seq: 1, op: "x"}, {seq: 1, op: "x"}]]) {
    assert.throws(() => rules.assertReplay(invalid));
  }
  assert.throws(() => rules.assertReplay(inputs, 1), /input limit/);
  assert.throws(() => rules.assertReplay([], -1));
});
