import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import {
  verifiedMinesweeperFixtures,
  verifiedSnakeFixtures,
} from "./helpers/verified-ms-snake-fixtures.mjs";

const sources = await Promise.all([
  readFile(new URL("../scripts/home/games/rules.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/home/games/minesweeper.js", import.meta.url), "utf8"),
  readFile(new URL("../scripts/home/games/snake.js", import.meta.url), "utf8"),
]);
const context = vm.createContext({});
vm.runInContext(sources.join("\n"), context);
const inRealm = (value) =>
  vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(value))})`, context);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("exported Minesweeper fixtures reproduce a win and expose rejected variants", () => {
  const fixture = verifiedMinesweeperFixtures.validWin;
  const replay = context.homeGameRules.assertReplay(inRealm(fixture.replay));
  const state = context.homeMinesweeperRules.initial(inRealm(fixture.initial));
  replay.forEach((input) => context.homeMinesweeperRules.transition(state, input));
  assert.deepEqual(plain(context.homeMinesweeperRules.result(state)), fixture.result);

  const truncatedState = context.homeMinesweeperRules.initial(inRealm(fixture.initial));
  verifiedMinesweeperFixtures.invalid.truncatedReplay.forEach((input) =>
    context.homeMinesweeperRules.transition(truncatedState, inRealm(input))
  );
  assert.equal(context.homeMinesweeperRules.result(truncatedState).terminal, false);
  assert.throws(() => context.homeGameRules.assertReplay(
    inRealm(verifiedMinesweeperFixtures.invalid.reorderedReplay)
  ));
});

test("exported Snake fixtures reproduce a terminal tick and reject replay assertions", () => {
  const fixture = verifiedSnakeFixtures.validLoss;
  const replay = context.homeGameRules.assertReplay(inRealm(fixture.replay));
  const state = context.homeSnakeRules.initial(inRealm(fixture.initial));
  while (state.tick < fixture.terminalTick) {
    replay
      .filter((input) => input.tick === state.tick)
      .forEach((input) => context.homeSnakeRules.transition(state, input));
    context.homeSnakeRules.step(state);
  }
  assert.deepEqual(plain(context.homeSnakeRules.result(state)), fixture.result);

  const scoring = verifiedSnakeFixtures.scoringLoss;
  const scoringState = context.homeSnakeRules.initial(inRealm(scoring.initial));
  while (scoringState.tick < scoring.terminalTick) context.homeSnakeRules.step(scoringState);
  assert.deepEqual(plain(context.homeSnakeRules.result(scoringState)), scoring.result);
  assert.equal(scoring.result.score, 1);
  assert.throws(() => {
    const invalid = context.homeSnakeRules.initial(inRealm(fixture.initial));
    context.homeSnakeRules.transition(
      invalid,
      inRealm(verifiedSnakeFixtures.invalid.oppositeDirection[0])
    );
  }, (error) => error.code === "illegal-action");
  assert.throws(() => context.homeGameRules.assertReplay(
    inRealm(verifiedSnakeFixtures.invalid.reorderedReplay)
  ));
});
