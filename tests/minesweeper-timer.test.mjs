import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";

const root = new URL("../", import.meta.url);
const readMain = () => readHomeScript("minesweeper");

const extractFunction = (source, name) => {
  const start = source.indexOf(`const ${name} = () => `);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = source.indexOf(";\n\n", start);
  assert.notEqual(end, -1, `${name} must end`);
  return source.slice(start, end + 1);
};

const TIMER_FUNCTIONS = Object.freeze([
  "msReadTimerClocks",
  "msSyncElapsed",
  "msStopTimer",
  "msStartTimer",
  "msCheckWin",
]);

/** Runs the production timer and win functions against a controllable clock. */
const createTimerHarness = async ({ difficulty = { value: "beginner" } } = {}) => {
  const main = await readMain();
  const context = {
    msState: {
      started: true,
      gameOver: false,
      timerId: null,
      timerSync: null,
      elapsedMs: 0,
      elapsed: 0,
      flagCount: 0,
      revealedSafeCount: 0,
      mines: 1,
      cells: [{ mine: true, flagged: false }, { mine: false }],
      statsSession: "",
      engineState: {
        terminal: false,
        won: false,
        lost: false,
      },
      completionHandled: false,
    },
    msDifficulty: difficulty,
    clampNumber: (value, min, max) => Math.max(min, Math.min(value, max)),
    MINESWEEPER_TIMER_INTERVAL_MS: 1000,
    MINESWEEPER_COUNTER_MAX: 999,
    clock: 5_000,
    wallClock: 1_800_000_000_000,
    performance: { now: () => context.clock },
    Date: { now: () => context.wallClock },
    advance: (ms) => {
      context.clock += ms;
      context.wallClock += ms;
    },
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
    msStats: {
      ensureSession: (detail) => {
        context.msState.statsSession ||= `minesweeper:${detail.difficulty}`;
        return context.msState.statsSession;
      },
      recordEvent: (event) => {
        context.recorded.push({ event: { ...event, game: "minesweeper" }, session: context.msState.statsSession });
        context.msState.statsSession = "";
      },
    },
    window: {
      homeMinesweeperRules: {
        result: (state) => ({
          terminal: state.terminal,
          won: state.won,
          lost: state.lost,
        }),
      },
    },
    msSetFace: (face) => context.calls.push(`face:${face}`),
    msStartConfetti: () => context.calls.push("confetti"),
    msShowAchievement: () => context.calls.push("achievement"),
    msRenderAll: () => context.calls.push("render"),
    notifyActivity: (name) => context.calls.push(`event:${name}`),
  };
  vm.createContext(context);
  vm.runInContext(
    `${TIMER_FUNCTIONS.map((name) => extractFunction(main, name)).join("\n")}
     Object.assign(this, { ${TIMER_FUNCTIONS.join(", ")} });`,
    context
  );
  return context;
};

test("Minesweeper accumulates elapsed time instead of counting ticks", async () => {
  const main = await readMain();

  assert.match(
    main,
    /const msState = \{[\s\S]*?timerSync: null,\n  elapsedMs: 0,\n  elapsed: 0,/
  );
  assert.doesNotMatch(main, /msState\.elapsed \+= 1/);
  assert.match(
    main,
    /msState\.gameOver = false;\n  msState\.timerSync = null;\n  msState\.elapsedMs = 0;\n  msState\.elapsed = 0;/,
    "a new game clears the clocks before it stops the timer"
  );
});

test("msSyncElapsed is inert before the first reveal", async () => {
  const harness = await createTimerHarness();
  harness.advance(90_000);
  assert.equal(harness.msSyncElapsed(), false);
  assert.equal(harness.msState.elapsed, 0);
});

test("the timer counts whole seconds, catches up after a gap, and caps at 999", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  assert.equal(harness.msState.statsSession, "minesweeper:beginner");
  assert.deepEqual(
    { ...harness.msState.timerSync },
    { monotonic: 5_000, wall: 1_800_000_000_000 }
  );
  assert.equal(harness.msState.timerId, 7);

  harness.advance(999);
  harness.tick();
  assert.equal(harness.msState.elapsed, 0, "the first second still displays 000");
  assert.equal(harness.counterUpdates, 0);

  harness.advance(2_401);
  harness.tick();
  assert.equal(harness.msState.elapsed, 3);
  assert.equal(harness.counterUpdates, 1);

  harness.advance(60_000);
  harness.tick();
  assert.equal(harness.msState.elapsed, 63, "one tick after a hidden minute catches up");

  harness.advance(47 * 60_000);
  harness.tick();
  assert.equal(harness.msState.elapsed, 999);
  harness.advance(5_000);
  harness.tick();
  assert.equal(harness.counterUpdates, 3, "the cap holds without redrawing");
});

test("a restarted timer begins again from zero accumulated time", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  harness.advance(4_000);
  harness.tick();
  harness.msState.elapsed = 0;
  harness.msStartTimer();
  assert.equal(harness.msState.elapsedMs, 0);
  assert.deepEqual([...harness.cleared], [7]);
});

test("ticks are ignored once the game is over or before it starts", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  harness.advance(4_000);
  harness.msState.gameOver = true;
  harness.tick();
  assert.equal(harness.msState.elapsed, 0);
  harness.msState.gameOver = false;
  harness.msState.started = false;
  harness.tick();
  assert.equal(harness.msState.elapsed, 0);
});

const winNow = (harness) => {
  harness.msState.revealedSafeCount = 1;
  harness.msState.gameOver = true;
  harness.msState.engineState.terminal = true;
  harness.msState.engineState.won = true;
  harness.msCheckWin();
  return JSON.parse(JSON.stringify(harness.recorded));
};

test("a device clock moved backwards does not change the recorded win", async () => {
  for (const rollbackMs of [8_000, 20_000, 3_600_000]) {
    const harness = await createTimerHarness();
    harness.msStartTimer();
    for (let second = 0; second < 10; second += 1) {
      harness.advance(1_000);
      harness.tick();
    }
    harness.wallClock -= rollbackMs;
    harness.tick();
    assert.equal(harness.msState.elapsed, 10);
    assert.equal(winNow(harness)[0].event.metric, 10, `rollback ${rollbackMs}`);
  }
});

test("both clocks moving backwards count as no advance", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  harness.advance(10_000);
  harness.tick();
  harness.clock -= 30_000;
  harness.wallClock -= 30_000;
  assert.equal(harness.msSyncElapsed(), false);
  assert.equal(harness.msState.elapsed, 10);
  harness.advance(2_000);
  harness.tick();
  assert.equal(harness.msState.elapsed, 12);
});

test("system sleep that pauses the monotonic clock still counts", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  harness.advance(10_000);
  harness.tick();
  harness.wallClock += 60_000;
  assert.equal(winNow(harness)[0].event.metric, 70);
});

test("a rollback during sleep counts only the wall-clock advance that remains", async () => {
  // Known limit, documented in game-stats-backend.md: with the monotonic clock
  // paused by sleep and the wall clock moved back inside the same sync
  // interval, no browser clock reports the lost time.
  for (const [rollbackMs, recorded] of [
    [8_000, 62],
    [20_000, 50],
    [60_000, 10],
    [90_000, 10],
  ]) {
    const harness = await createTimerHarness();
    harness.msStartTimer();
    harness.advance(10_000);
    harness.tick();
    harness.wallClock += 60_000 - rollbackMs;
    assert.equal(winNow(harness)[0].event.metric, recorded, `rollback ${rollbackMs}`);
    assert.ok(harness.msState.elapsed >= 10, "the displayed time never decreases");
  }
});

test("a device clock moved forwards can only lengthen the time", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  harness.advance(10_000);
  harness.wallClock += 120_000;
  harness.tick();
  assert.equal(harness.msState.elapsed, 130);
});

test("a win records the settled time after a gap with no tick", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  harness.advance(1_000);
  harness.tick();
  harness.advance(41_900);

  assert.deepEqual(winNow(harness), [
    {
      event: { game: "minesweeper", type: "win", difficulty: "beginner", metric: 42 },
      session: "minesweeper:beginner",
    },
  ]);
  assert.deepEqual([...harness.cleared], [7]);
  assert.equal(harness.msState.timerId, null);
  assert.deepEqual(
    [...harness.calls],
    ["face:win", "confetti", "render", "event:gameWin"]
  );
  harness.msCheckWin();
  assert.equal(harness.recorded.length, 1, "a finished game records once");
});

test("an unfinished board records nothing and keeps the timer running", async () => {
  const harness = await createTimerHarness();
  harness.msStartTimer();
  harness.msCheckWin();
  assert.equal(harness.recorded.length, 0);
  assert.equal(harness.msState.timerId, 7);
});

test("an expert win also shows the achievement", async () => {
  const harness = await createTimerHarness({ difficulty: { value: "expert" } });
  harness.msStartTimer();
  harness.advance(7_000);
  const [record] = winNow(harness);
  assert.ok([...harness.calls].includes("achievement"));
  assert.deepEqual(record.event, {
    game: "minesweeper",
    type: "win",
    difficulty: "expert",
    metric: 7,
  });
});

test("a missing or empty difficulty control falls back to beginner", async () => {
  for (const difficulty of [null, { value: "" }]) {
    const harness = await createTimerHarness({ difficulty });
    harness.msStartTimer();
    assert.equal(harness.msState.statsSession, "minesweeper:beginner");
    harness.advance(5_000);
    const [record] = winNow(harness);
    assert.equal(record.event.difficulty, "beginner");
    assert.equal(record.session, "minesweeper:beginner");
    assert.ok(![...harness.calls].includes("achievement"));
  }
});

test("stopping a timer that never started changes nothing", async () => {
  const harness = await createTimerHarness();
  harness.msStopTimer();
  assert.deepEqual([...harness.cleared], []);
  assert.equal(harness.counterUpdates, 0);
});
