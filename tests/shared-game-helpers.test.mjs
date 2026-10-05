import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";

const loadUtil = async () => {
  const context = vm.createContext({
    document: { hidden: false, hasFocus: () => true },
    performance: { now: () => 0 },
    window: {
      clearTimeout: () => {},
      matchMedia: () => ({ matches: false }),
      requestAnimationFrame: (callback) => callback(),
      setTimeout: () => 1,
    },
  });
  vm.runInContext(await readHomeScript("util"), context);
  return context.window.homeUtil;
};

test("JSON storage helpers contain access, parse, serialization, and mutation failures", async () => {
  const { readJsonStorage, removeStorage, writeJsonStorage } = await loadUtil();
  const values = new Map([["valid", '{"score":7}'], ["broken", "{"]]);
  const storage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };

  assert.deepEqual({ ...readJsonStorage(() => storage, "valid", {}) }, { score: 7 });
  assert.equal(readJsonStorage(() => storage, "missing", "fallback"), "fallback");
  assert.equal(readJsonStorage(() => storage, "broken", "fallback"), "fallback");
  assert.equal(readJsonStorage(() => { throw new Error("blocked"); }, "valid", 4), 4);

  assert.equal(writeJsonStorage(() => storage, "written", { ready: true }), true);
  assert.equal(values.get("written"), '{"ready":true}');
  const cyclic = {};
  cyclic.self = cyclic;
  assert.equal(writeJsonStorage(() => storage, "cyclic", cyclic), false);
  assert.equal(writeJsonStorage(() => { throw new Error("blocked"); }, "x", 1), false);

  assert.equal(removeStorage(() => storage, "written"), true);
  assert.equal(values.has("written"), false);
  assert.equal(removeStorage(() => { throw new Error("blocked"); }, "x"), false);
});

test("flashBanner restarts once and ignores descendant animation events", async () => {
  const { flashBanner } = await loadUtil();
  const classes = new Set(["is-showing"]);
  const listeners = new Set();
  let layoutReads = 0;
  const element = {
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
    addEventListener: (name, listener) => {
      assert.equal(name, "animationend");
      listeners.add(listener);
    },
    removeEventListener: (name, listener) => {
      assert.equal(name, "animationend");
      listeners.delete(listener);
    },
    get offsetWidth() {
      layoutReads += 1;
      return 100;
    },
  };

  assert.equal(flashBanner(null), false);
  assert.equal(flashBanner(element), true);
  assert.equal(classes.has("is-showing"), true);
  assert.equal(listeners.size, 1);
  assert.equal(flashBanner(element), true);
  assert.equal(layoutReads, 2);
  assert.equal(listeners.size, 1, "restarts replace the earlier cleanup listener");

  const [cleanup] = listeners;
  cleanup({ target: {} });
  assert.equal(classes.has("is-showing"), true);
  cleanup({ target: element });
  assert.equal(classes.has("is-showing"), false);
  assert.equal(listeners.size, 0);
  cleanup({ target: element });
  assert.equal(listeners.size, 0, "cleanup remains idempotent");
});

test("isPageActive combines visibility and optional focus support", async () => {
  const { isPageActive } = await loadUtil();
  assert.equal(isPageActive({ hidden: false }), true);
  assert.equal(isPageActive({ hidden: true, hasFocus: () => true }), false);
  assert.equal(isPageActive({ hidden: false, hasFocus: () => false }), false);
  assert.equal(isPageActive({ hidden: false, hasFocus: () => true }), true);
  assert.equal(isPageActive(null), false);
});

test("createProgressLoader caps intermediate progress, waits for readiness, and completes", async () => {
  const { createProgressLoader } = await loadUtil();
  let clock = 0;
  let nextId = 0;
  let ready = false;
  const timers = new Map();
  const cleared = [];
  const progress = [];
  const callbacks = [];
  const timerChanges = [];
  let completions = 0;
  const loader = createProgressLoader({
    progressCap: 80,
    isReady: () => ready,
    nextProgress: () => 200,
    nextDelay: ({ waitingForReady }) => (waitingForReady ? 25 : 50),
    onProgress: (value) => {
      progress.push(value);
      callbacks.push(`progress:${value}`);
    },
    onReady: () => {
      callbacks.push("ready");
      completions += 1;
    },
    onTimerChange: (id) => timerChanges.push(id),
    now: () => clock,
    setTimer: (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimer: (id) => {
      cleared.push(id);
      timers.delete(id);
    },
  });

  assert.deepEqual({ ...loader.start({ duration: 100, initialDelay: 10 }) }, {
    durationMs: 100,
    startedAt: 0,
  });
  assert.deepEqual(progress, [0]);
  assert.equal(timers.get(1).delay, 10);

  clock = 50;
  timers.get(1).callback();
  assert.deepEqual(progress, [0, 80]);
  assert.equal(timers.get(2).delay, 50);

  clock = 100;
  timers.get(2).callback();
  assert.equal(timers.get(3).delay, 25, "duration alone does not manufacture readiness");
  ready = true;
  clock = 125;
  timers.get(3).callback();
  assert.deepEqual(progress, [0, 80, 80, 100]);
  assert.equal(completions, 1);
  assert.deepEqual(callbacks.slice(-2), ["progress:100", "ready"]);
  assert.deepEqual({ ...loader.snapshot() }, {
    durationMs: 100,
    progress: 100,
    running: false,
    startedAt: 0,
    timerId: null,
  });
  assert.ok(timerChanges.includes(null));
  assert.deepEqual(cleared, []);
});

test("createProgressLoader cancellation and continuation guards retire owned timers", async () => {
  const { createProgressLoader } = await loadUtil();
  let nextId = 0;
  let active = true;
  const timers = new Map();
  const cleared = [];
  const loader = createProgressLoader({
    progressCap: 90,
    shouldContinue: () => active,
    nextProgress: ({ progress }) => progress + 1,
    nextDelay: () => 10,
    onProgress: () => {},
    onReady: () => assert.fail("cancelled loader cannot complete"),
    setTimer: (callback) => {
      const id = ++nextId;
      timers.set(id, callback);
      return id;
    },
    clearTimer: (id) => {
      cleared.push(id);
      timers.delete(id);
    },
  });

  loader.start({ duration: 100, initialDelay: 5 });
  const stale = timers.get(1);
  loader.cancel();
  assert.deepEqual(cleared, [1]);
  stale();
  assert.equal(loader.snapshot().running, false);

  loader.start({ duration: 100 });
  active = false;
  timers.get(2)();
  assert.equal(loader.snapshot().running, false);
  assert.equal(loader.snapshot().timerId, null);
});

test("createProgressLoader does not let reentrant callbacks revive an old generation", async () => {
  const { createProgressLoader } = await loadUtil();
  let clock = 0;
  let nextId = 0;
  let mode = "cancel";
  let loader;
  const timers = new Map();
  const completions = [];
  const progress = [];
  const schedule = (callback) => {
    const id = ++nextId;
    timers.set(id, callback);
    return id;
  };
  loader = createProgressLoader({
    progressCap: 90,
    nextProgress: ({ progress: current }) => current + 1,
    nextDelay: () => 10,
    onProgress: (value) => {
      progress.push(value);
      if (value === 1 && mode === "cancel") loader.cancel();
      if (value === 100 && mode === "restart") {
        mode = "none";
        loader.start({ duration: 50 });
      }
    },
    onReady: () => completions.push("ready"),
    now: () => clock,
    setTimer: schedule,
    clearTimer: (id) => timers.delete(id),
  });

  loader.start({ duration: 100 });
  timers.get(1)();
  assert.deepEqual(progress, [0, 1]);
  assert.equal(loader.snapshot().running, false);
  assert.equal(timers.size, 1, "the fired fake timer is retained only by the harness");
  assert.equal(nextId, 1, "the cancelled generation scheduled no successor");

  timers.clear();
  mode = "restart";
  clock = 100;
  loader.start({ duration: 0 });
  timers.get(2)();
  assert.deepEqual(progress.slice(-2), [100, 0]);
  assert.deepEqual(completions, [], "the restarted generation suppresses stale readiness");
  assert.equal(loader.snapshot().running, true);
  assert.equal(nextId, 3, "only the restarted generation owns a pending timer");
});

test("the active-window dispatcher applies common guards once and preserves handler order", async () => {
  const source = await readHomeScript("windows");
  const start = source.indexOf("const activeWindowKeyHandlers = new Map();");
  const endMarker = 'document.addEventListener("keydown", dispatchActiveWindowKeydown);';
  const end = source.indexOf(endMarker, start) + endMarker.length;
  assert.ok(start >= 0 && end > start);

  let listener = null;
  let pageActive = true;
  let windowVisible = true;
  const activeWindow = {
    getAttribute: (name) => (name === "data-app-window" ? "sudoku" : null),
  };
  const context = vm.createContext({
    document: {
      addEventListener: (name, callback) => {
        assert.equal(name, "keydown");
        listener = callback;
      },
    },
    getActiveWindow: () => activeWindow,
    isPageActive: () => pageActive,
    isWindowVisible: () => windowVisible,
  });
  vm.runInContext(
    `${source.slice(start, end)}\nObject.assign(globalThis, { registerActiveWindowKeyHandler });`,
    context
  );
  const calls = [];
  context.registerActiveWindowKeyHandler("sudoku", (event) => {
    calls.push("undo");
    if (event.stopAfterFirst) return true;
    if (event.preventInFirst) event.defaultPrevented = true;
    return false;
  });
  context.registerActiveWindowKeyHandler("sudoku", () => calls.push("entry"));

  listener({ defaultPrevented: true });
  pageActive = false;
  listener({ defaultPrevented: false });
  pageActive = true;
  windowVisible = false;
  listener({ defaultPrevented: false });
  assert.deepEqual(calls, []);

  windowVisible = true;
  listener({ defaultPrevented: false });
  assert.deepEqual(calls, ["undo", "entry"]);
  listener({ defaultPrevented: false, stopAfterFirst: true });
  assert.deepEqual(calls, ["undo", "entry", "undo"]);
  listener({ defaultPrevented: false, preventInFirst: true });
  assert.deepEqual(calls, ["undo", "entry", "undo", "undo"]);
});
