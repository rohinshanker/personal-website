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
  return source.slice(start, end + 4);
};

test("Minesweeper derives its time from the wall clock, not from tick counts", async () => {
  const main = await readMain();

  assert.match(main, /const msState = \{[\s\S]*?startedAt: null,[\s\S]*?elapsed: 0,/);
  assert.match(
    main,
    /const msStartTimer = \(\) => \{[\s\S]*?msState\.startedAt = Date\.now\(\);[\s\S]*?setInterval\(\(\) => \{[\s\S]*?if \(msSyncElapsed\(\)\) msUpdateCounters\(\);/
  );
  assert.doesNotMatch(main, /msState\.elapsed \+= 1/);
  assert.match(
    main,
    /const msStopTimer = \(\) => \{\n  if \(msSyncElapsed\(\)\) msUpdateCounters\(\);/,
    "stopping the timer settles the elapsed value before it is read"
  );
  assert.match(
    main,
    /msSetFace\("win"\);\n    msStopTimer\(\);[\s\S]*?metric: msState\.elapsed,/,
    "the win metric is read after the timer settles"
  );
  assert.match(
    main,
    /msState\.gameOver = false;\n  msState\.startedAt = null;\n  msState\.elapsed = 0;/,
    "a new game clears the start instant before it stops the timer"
  );
});

test("msSyncElapsed clamps to the counter maximum and reports changes", async () => {
  const main = await readMain();
  const context = {
    msState: { startedAt: null, elapsed: 0 },
    clampNumber: (value, min, max) => Math.max(min, Math.min(value, max)),
    MINESWEEPER_TIMER_INTERVAL_MS: 1000,
    MINESWEEPER_COUNTER_MAX: 999,
    now: 0,
    Date: { now: () => context.now },
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction(main, "msSyncElapsed")}; this.msSyncElapsed = msSyncElapsed;`, context);

  assert.equal(context.msSyncElapsed(), false, "no start instant means nothing to sync");

  context.msState.startedAt = 10_000;
  context.now = 10_500;
  assert.equal(context.msSyncElapsed(), false);
  assert.equal(context.msState.elapsed, 0);

  context.now = 13_999;
  assert.equal(context.msSyncElapsed(), true);
  assert.equal(context.msState.elapsed, 3);

  context.now = 10_000 + 47 * 60_000;
  assert.equal(context.msSyncElapsed(), true, "a hidden tab catches up in one sync");
  assert.equal(context.msState.elapsed, 999);
  assert.equal(context.msSyncElapsed(), false, "the cap holds without churn");
});
