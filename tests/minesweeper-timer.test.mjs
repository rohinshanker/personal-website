import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const readMain = () => readFile(new URL("scripts/home/main.js", root), "utf8");

const extractFunction = (source, name) => {
  const start = source.indexOf(`const ${name} = () => {`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = source.indexOf("\n};\n", start);
  assert.notEqual(end, -1, `${name} must end`);
  return source.slice(start, end + 4);
};

const TIMER_FUNCTIONS = Object.freeze([
  "msSyncElapsed",
  "msStopTimer",
  "msStartTimer",
  "msCheckWin",
]);

/** Runs the production timer and win functions against a controllable clock. */
const createTimerHarness = async ({ difficulty = "beginner" } = {}) => {
  const main = await readMain();
  const context = {
    msState: {
      started: true,
      gameOver: false,
      timerId: null,
      startedAt: null,
      elapsed: 0,
      flagCount: 0,
      revealedSafeCount: 0,
      mines: 1,
      cells: [{ mine: true, flagged: false }, { mine: false }],
      statsSession: "",
    },
    msDifficulty: { value: difficulty },
    clampNumber: (value, min, max) => Math.max(min, Math.min(value, max)),
    MINESWEEPER_TIMER_INTERVAL_MS: 1000,
    MINESWEEPER_COUNTER_MAX: 999,
    clock: 5_000,
    performance: { now: () => context.clock },
    tick: null,
    counterUpdates: 0,
    cleared: [],
    recorded: [],
    calls: [],
    setInterval: (callback) => {
      context.tick = callback;
      return 7;
    },
    clearInterval: (id) => context.cleared.push(id),
    msUpdateCounters: () => {
      context.counterUpdates += 1;
    },
    startGameStatsSession: (game, detail) => `${game}:${detail.difficulty}`,
    createGameStatsEvent: (event) => event,
    recordGameStatsEvent: (event, session) => context.recorded.push({ event, session }),
    msSetFace: (face) => context.calls.push(`face:${face}`),
    msStartConfetti: () => context.calls.push("confetti"),
    msShowAchievement: () => context.calls.push("achievement"),
    msRenderAll: () => context.calls.push("render"),
    triggerRandomEvents: (name) => context.calls.push(`event:${name}`),
  };
  vm.createContext(context);
  vm.runInContext(
    `${TIMER_FUNCTIONS.map((name) => extractFunction(main, name)).join("\n")}
     Object.assign(this, { ${TIMER_FUNCTIONS.join(", ")} });`,
    context
  );
  return context;
};

test("Minesweeper times games from the monotonic clock, not from tick counts", async () => {
  const main = await readMain();

  assert.match(main, /const msState = \{[\s\S]*?startedAt: null,[\s\S]*?elapsed: 0,/);
  assert.doesNotMatch(main, /msState\.elapsed \+= 1/);
  assert.doesNotMatch(
    extractFunction(main, "msSyncElapsed") + extractFunction(main, "msStartTimer"),
    /Date\.now/,
    "an adjustable device clock must not time a leaderboard game"
  );
  assert.match(
    main,
    /msState\.gameOver = false;\n  msState\.startedAt = null;\n  msState\.elapsed = 0;/,
    "a new game clears the start instant before it stops the timer"
  );
});

test("msSyncElapsed is inert before the first reveal", async () => {
  const harness = await createTimerHarness();
  harness.clock = 90_000;
  assert.equal(harness.msSyncElapsed(), false);
  assert.equal(harness.msState.elapsed, 0);
});

test("the timer counts whole seconds, catches up after a gap, and caps at 999", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  assert.equal(harness.msState.statsSession, "minesweeper:beginner");
  assert.equal(harness.msState.startedAt, 5_000);
  assert.equal(harness.msState.timerId, 7);

  harness.clock = 5_999;
  harness.tick();
  assert.equal(harness.msState.elapsed, 0, "the first second still displays 000");
  assert.equal(harness.counterUpdates, 0);

  harness.clock = 8_400;
  harness.tick();
  assert.equal(harness.msState.elapsed, 3);
  assert.equal(harness.counterUpdates, 1);

  harness.clock = 5_000 + 63_000;
  harness.tick();
  assert.equal(harness.msState.elapsed, 63, "one tick after a hidden minute catches up");

  harness.clock = 5_000 + 47 * 60_000;
  harness.tick();
  assert.equal(harness.msState.elapsed, 999);
  harness.tick();
  assert.equal(harness.counterUpdates, 3, "the cap holds without redrawing");
});

test("ticks are ignored once the game is over or before it starts", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  harness.clock = 9_000;
  harness.msState.gameOver = true;
  harness.tick();
  assert.equal(harness.msState.elapsed, 0);
  harness.msState.gameOver = false;
  harness.msState.started = false;
  harness.tick();
  assert.equal(harness.msState.elapsed, 0);
});

test("elapsed time never decreases if the clock source moves backwards", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  harness.clock = 15_000;
  harness.tick();
  assert.equal(harness.msState.elapsed, 10);

  harness.clock = -5_000;
  assert.equal(harness.msSyncElapsed(), false);
  assert.equal(harness.msState.elapsed, 10);
});

test("a win records the settled time after a gap with no tick", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  harness.clock = 6_000;
  harness.tick();
  harness.clock = 5_000 + 42_900;
  harness.msState.revealedSafeCount = 1;
  harness.msCheckWin();

  assert.deepEqual(harness.cleared, [7]);
  assert.equal(harness.msState.timerId, null);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.recorded)), [
    {
      event: { game: "minesweeper", type: "win", difficulty: "beginner", metric: 42 },
      session: "minesweeper:beginner",
    },
  ]);
  assert.deepEqual(
    [...harness.calls],
    ["face:win", "confetti", "render", "event:gameWin"]
  );

  harness.msCheckWin();
  assert.equal(harness.recorded.length, 1, "a finished game records once");
});

test("an expert win also shows the achievement, and an unfinished board records nothing", async () => {
  const unfinished = await createTimerHarness();
  unfinished.msStartTimer();
  unfinished.msCheckWin();
  assert.equal(unfinished.recorded.length, 0);

  const expert = await createTimerHarness({ difficulty: "expert" });
  expert.msStartTimer();
  expert.clock = 12_000;
  expert.msState.revealedSafeCount = 1;
  expert.msCheckWin();
  assert.ok([...expert.calls].includes("achievement"));
  assert.equal(expert.recorded[0].event.metric, 7);
});

test("stopping a timer that never started changes nothing", async () => {
  const harness = await createTimerHarness();
  harness.msStopTimer();
  assert.deepEqual([...harness.cleared], []);
  assert.equal(harness.counterUpdates, 0);
});
