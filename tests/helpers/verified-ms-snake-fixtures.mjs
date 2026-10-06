import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [commonSource, minesweeperSource, snakeSource] = await Promise.all([
  readFile(new URL("../../scripts/home/games/rules.js", import.meta.url), "utf8"),
  readFile(new URL("../../scripts/home/games/minesweeper.js", import.meta.url), "utf8"),
  readFile(new URL("../../scripts/home/games/snake.js", import.meta.url), "utf8"),
]);

const context = vm.createContext({});
vm.runInContext(`${commonSource}\n${minesweeperSource}\n${snakeSource}`, context);

const plain = (value) => JSON.parse(JSON.stringify(value));
const inRealm = (value) =>
  vm.runInContext(`JSON.parse(${JSON.stringify(JSON.stringify(value))})`, context);

const minesweeperConfig = inRealm({ difficulty: "beginner" });
const minesweeperInitial = context.homeMinesweeperRules.generate(
  minesweeperConfig,
  inRealm({ seed: 0x24724724, firstCell: 0 })
);
const minesweeperState = context.homeMinesweeperRules.initial(minesweeperInitial);
const minesweeperReplay = [];
for (let cell = 0; cell < minesweeperState.cells.length && !minesweeperState.terminal; cell += 1) {
  if (minesweeperState.cells[cell].mine || minesweeperState.cells[cell].revealed) continue;
  const action = { seq: minesweeperReplay.length + 1, op: "reveal", cell };
  context.homeMinesweeperRules.transition(minesweeperState, inRealm(action));
  minesweeperReplay.push(action);
}

const snakeConfig = inRealm({ boardSize: "10" });
const snakeInitial = context.homeSnakeRules.generate(snakeConfig, inRealm({ seed: 0x2475a4e }));
const snakeState = context.homeSnakeRules.initial(snakeInitial);
while (!snakeState.terminal) context.homeSnakeRules.step(snakeState);

export const verifiedMinesweeperFixtures = Object.freeze({
  validWin: Object.freeze({
    config: plain(minesweeperConfig),
    initial: plain(minesweeperInitial),
    replay: plain(minesweeperReplay),
    result: plain(context.homeMinesweeperRules.result(minesweeperState)),
  }),
  invalid: Object.freeze({
    reorderedReplay: plain([
      { ...minesweeperReplay[0], seq: 2 },
      { ...minesweeperReplay[1], seq: 1 },
    ]),
    alteredFirstCell: plain({ ...minesweeperInitial, firstCell: 1 }),
    truncatedReplay: plain(minesweeperReplay.slice(0, -1)),
    fabricatedResult: plain({
      ...context.homeMinesweeperRules.result(minesweeperState),
      won: false,
    }),
    revealMineFirst: plain([{
      seq: 1,
      op: "reveal",
      cell: minesweeperInitial.mineCells[0],
    }]),
  }),
});

export const verifiedSnakeFixtures = Object.freeze({
  validLoss: Object.freeze({
    config: plain(snakeConfig),
    initial: plain(snakeInitial),
    replay: Object.freeze([]),
    terminalTick: snakeState.tick,
    result: plain(context.homeSnakeRules.result(snakeState)),
  }),
  invalid: Object.freeze({
    oppositeDirection: plain([{
      seq: 1,
      op: "direction",
      tick: 0,
      direction: "left",
    }]),
    reorderedReplay: plain([
      { seq: 2, op: "direction", tick: 0, direction: "up" },
      { seq: 1, op: "direction", tick: 0, direction: "left" },
    ]),
    prematureTerminalTick: snakeState.tick - 1,
    excessiveTerminalTick: context.homeGameRules.GAME_RULE_LIMITS.snake.ticks + 1,
    fabricatedResult: plain({
      ...context.homeSnakeRules.result(snakeState),
      score: snakeState.score + 1,
    }),
  }),
});
