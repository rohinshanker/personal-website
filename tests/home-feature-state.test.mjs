import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";

const declaration = (source, name) => {
  const start = source.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `Missing production declaration: ${name}`);
  const end = source.indexOf("\n};", start);
  assert.ok(end > start, `Missing declaration boundary: ${name}`);
  return source.slice(start, end + 4);
};

test("completion dismissal consumes the current deferred authentication once", async () => {
  const source = await readHomeScript("gameStats");
  const context = vm.createContext({ calls: 0 });
  vm.runInContext(`
    let gameStatsAuthenticationDeferredForCompletion = false;
    const requestGameStatsAdministratorAuthentication = () => calls += 1;
    ${declaration(source, "resumeGameStatsAuthenticationAfterCompletion")}
  `, context);
  vm.runInContext("resumeGameStatsAuthenticationAfterCompletion();", context);
  assert.equal(context.calls, 0);
  vm.runInContext(`
    gameStatsAuthenticationDeferredForCompletion = true;
    resumeGameStatsAuthenticationAfterCompletion();
    resumeGameStatsAuthenticationAfterCompletion();
  `, context);
  assert.equal(context.calls, 1);
  assert.equal(vm.runInContext("gameStatsAuthenticationDeferredForCompletion", context), false);
});

test("event media watchers attach after feature windows have registered", async () => {
  const source = await readHomeScript("eventRuntime");
  const listeners = [];
  const image = { addEventListener: (event, callback) => listeners.push({ event, callback }) };
  const win = { querySelectorAll: () => [image] };
  const context = vm.createContext({
    randomEventBindings: [],
    windows: [],
    randomEventViewportWindows: () => context.windows,
    clamped: [],
    clampRandomEventWindowToViewport: (target) => context.clamped.push(target),
  });
  vm.runInContext(`
    ${declaration(source, "watchRandomEventViewportMedia")}
    ${declaration(source, "bindRegisteredRandomEvents")}
  `, context);
  context.windows.push(win);
  let bindingCalls = 0;
  context.randomEventBindings.push(() => bindingCalls += 1);
  vm.runInContext("bindRegisteredRandomEvents();", context);
  assert.equal(bindingCalls, 1);
  assert.equal(context.randomEventBindings.length, 0);
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].event, "load");
  listeners[0].callback();
  assert.deepEqual(context.clamped, [win]);
});
