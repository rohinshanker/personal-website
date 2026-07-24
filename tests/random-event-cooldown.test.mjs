import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

const getRandomEventRegistrationBlocks = (source) => {
  const registrationStart = "registerRandomEvent({";
  const registrations = [];
  let searchFrom = 0;

  while (true) {
    const callStart = source.indexOf(registrationStart, searchFrom);
    if (callStart === -1) return registrations;

    const objectStart = callStart + registrationStart.length - 1;
    let objectDepth = 0;
    let quote = "";
    let escaped = false;
    let objectEnd = -1;

    for (let index = objectStart; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = "";
        }
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
        continue;
      }
      if (character === "{") objectDepth += 1;
      if (character === "}") {
        objectDepth -= 1;
        if (objectDepth === 0) {
          objectEnd = index;
          break;
        }
      }
    }

    assert.notEqual(objectEnd, -1, "Each random-event registration must close its object");
    registrations.push(source.slice(objectStart, objectEnd + 1));
    searchFrom = objectEnd + 1;
  }
};

test("all registered random events keep debug mode disabled", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const registrations = getRandomEventRegistrationBlocks(source);

  assert.match(source, /const RANDOM_EVENT_GLOBAL_DEBUG = false;/);
  assert.match(
    source,
    /const registerRandomEvent = \(definition\) => \{\n  randomEventDefinitions\.push\(definition\);\n  return definition;\n\};/
  );
  assert.match(source, /randomEventDefinitions\.forEach\(\(definition\) => \{/);
  assert.ok(registrations.length > 0, "The normal random-event registry must remain populated");

  const registeredIds = registrations.map((registration) => {
    const id = registration.match(/\bid:\s*"([^"]+)"/);
    assert.ok(id, "Every registered random event must retain an id");
    assert.match(registration, /\brun:\s*\(/, `Event ${id[1]} must remain runnable`);
    assert.doesNotMatch(registration, /\bdebug\s*:\s*true\b/, id[1]);
    return id[1];
  });
  assert.equal(new Set(registeredIds).size, registeredIds.length, "Event ids must remain unique");
});

const createCooldownRuntime = (source) => {
  const start = source.indexOf("const RANDOM_EVENT_SELECTION_LOCKDOWN_MS =");
  const end = source.indexOf("\nconst randomEventDelayMs = () =>", start);
  assert.notEqual(start, -1, "The random-event lockdown helpers should exist");
  assert.notEqual(end, -1, "The random-event cooldown helper block should be bounded");

  const randomValues = [];
  const math = Object.create(Math);
  math.random = () => {
    assert.notEqual(randomValues.length, 0, "The test must provide every weighted roll");
    return randomValues.shift();
  };
  const context = vm.createContext({ Map, Math: math, Number });
  vm.runInContext(
    `${source.slice(start, end)}\n` +
      "globalThis.randomEventCooldown = { isRandomEventTriggerOnCooldown, recordRandomEventTrigger, isRandomEventOnLockdown, recordRandomEventSelection, chooseRandomEventOutsideLockdown };",
    context
  );

  return {
    ...context.randomEventCooldown,
    setRandomValues: (values) => randomValues.splice(0, randomValues.length, ...values),
  };
};

const createGameplayLockRuntime = (source) => {
  const start = source.indexOf("const isRandomEventGameplayLockActive = () =>");
  const end = source.indexOf("\n\nconst scheduleRandomEventRun", start);
  assert.notEqual(start, -1, "The gameplay lock helper should exist");
  assert.notEqual(end, -1, "The gameplay lock helper should be bounded");

  const context = vm.createContext({});
  vm.runInContext(
    `
      let brandVisible = false;
      let brandBurnsStage = "idle";
      let fateVisible = false;
      let fateState = "idle";
      let lancerVisible = false;
      const LANCER_BATTLE_STAGES = { active: "active" };
      let lancerBattleState = "idle";
      let gearsVisible = false;
      let gearsNestState = { active: false, completed: false };
      let toxicVisible = false;
      const TOXIC_JUNGLE_STAGE_ACTIVE = "active";
      let toxicJungleStage = "prompt";
      const isBrandBurnsVisible = () => brandVisible;
      const isFateVisible = () => fateVisible;
      const isLancerBattleVisible = () => lancerVisible;
      const isGearsNestVisible = () => gearsVisible;
      const isToxicJungleVisible = () => toxicVisible;
      ${source.slice(start, end)}
      globalThis.randomEventGameplayLock = {
        isActive: isRandomEventGameplayLockActive,
        setBrand: (visible, stage) => { brandVisible = visible; brandBurnsStage = stage; },
        setFate: (visible, state) => { fateVisible = visible; fateState = state; },
        setLancer: (visible, state) => { lancerVisible = visible; lancerBattleState = state; },
        setGears: (visible, active, completed) => {
          gearsVisible = visible;
          gearsNestState = { active, completed };
        },
        setToxic: (visible, stage) => { toxicVisible = visible; toxicJungleStage = stage; },
      };
    `,
    context
  );
  return context.randomEventGameplayLock;
};

test("any accepted random-event trigger starts a global five-second cooldown", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const cooldown = createCooldownRuntime(source);

  cooldown.recordRandomEventTrigger(1000);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(1000), true);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(5999), true);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(6000), false);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(6001), false);
});

test("random-event selections remain locked until exactly two minutes have elapsed", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const cooldown = createCooldownRuntime(source);
  const event = { id: "alpha" };

  cooldown.recordRandomEventSelection(event, 1000);
  assert.equal(cooldown.isRandomEventOnLockdown(event, 1000), true);
  assert.equal(cooldown.isRandomEventOnLockdown(event, 120999), true);
  assert.equal(cooldown.isRandomEventOnLockdown(event, 121000), false);
});

test("a locked weighted draw is discarded and resampled from the remaining events", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const cooldown = createCooldownRuntime(source);
  const locked = { definition: { id: "locked" }, triggerProbability: 0.9 };
  const available = { definition: { id: "available" }, triggerProbability: 0.1 };

  cooldown.recordRandomEventSelection(locked.definition, 0);
  cooldown.setRandomValues([0, 0]);
  assert.equal(cooldown.chooseRandomEventOutsideLockdown([locked, available], 1), available);
});

test("selection terminates cleanly when every candidate is on lockdown", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const cooldown = createCooldownRuntime(source);
  const first = { definition: { id: "first" }, triggerProbability: 0.5 };
  const second = { definition: { id: "second" }, triggerProbability: 0.5 };

  cooldown.recordRandomEventSelection(first.definition, 0);
  cooldown.recordRandomEventSelection(second.definition, 0);
  cooldown.setRandomValues([0, 0]);
  assert.equal(cooldown.chooseRandomEventOutsideLockdown([first, second], 1), null);
});

test("the lockdown applies to interactive, non-interactive, and debug event definitions", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const cooldown = createCooldownRuntime(source);
  const interactive = { id: "interactive", kind: "interactive" };
  const nonInteractiveDebug = {
    id: "non-interactive-debug",
    kind: "non-interactive",
    debug: true,
  };

  cooldown.recordRandomEventSelection(interactive, 0);
  cooldown.recordRandomEventSelection(nonInteractiveDebug, 0);
  assert.equal(cooldown.isRandomEventOnLockdown(interactive, 1), true);
  assert.equal(cooldown.isRandomEventOnLockdown(nonInteractiveDebug, 1), true);
});

test("unlocked events retain their weighted selection behavior", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const cooldown = createCooldownRuntime(source);
  const first = { definition: { id: "first" }, triggerProbability: 0.9 };
  const second = { definition: { id: "second" }, triggerProbability: 0.1 };

  cooldown.setRandomValues([0.95]);
  assert.equal(cooldown.chooseRandomEventOutsideLockdown([first, second], 0), second);
});

test("active combat and click-collection gameplay blocks random events until it ends", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const lock = createGameplayLockRuntime(source);

  assert.equal(lock.isActive(), false);

  lock.setBrand(true, "fight");
  assert.equal(lock.isActive(), true);
  lock.setBrand(true, "idle");
  assert.equal(lock.isActive(), false);

  lock.setFate(true, "active");
  assert.equal(lock.isActive(), true);
  lock.setFate(true, "success");
  assert.equal(lock.isActive(), false);

  lock.setLancer(true, "active");
  assert.equal(lock.isActive(), true);
  lock.setLancer(true, "resolving");
  assert.equal(lock.isActive(), false);

  lock.setGears(true, true, false);
  assert.equal(lock.isActive(), true);
  lock.setGears(true, false, true);
  assert.equal(lock.isActive(), false);
  lock.setGears(false, true, false);
  assert.equal(lock.isActive(), false);

  lock.setToxic(true, "active");
  assert.equal(lock.isActive(), true);
  lock.setToxic(true, "complete");
  assert.equal(lock.isActive(), false);
});

test("the scheduler locks and globally cools down every accepted event before its asynchronous run", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const scheduler = source.match(
    /const scheduleRandomEventRun = \(definition, context\) => \{([\s\S]*?)\n\};\n\nconst triggerRandomEvents/
  );

  assert.ok(scheduler, "The scheduler should remain a dedicated helper");
  assert.match(scheduler[1], /if \(isRandomEventGameplayLockActive\(\)\) return false;/);
  assert.match(scheduler[1], /if \(isRandomEventTriggerOnCooldown\(\)\) return false;/);
  assert.match(scheduler[1], /if \(isRandomEventOnLockdown\(definition\)\) return false;/);
  assert.match(
    scheduler[1],
    /randomEventPendingDefinitions\.add\(definition\);\n  recordRandomEventSelection\(definition\);\n  recordRandomEventTrigger\(\);\n  const delayRequest/
  );
  assert.match(
    scheduler[1],
    /Promise\.all\(\[delayRequest, preloadRequest\]\)\.then\(\(\) => \{\n    randomEventPendingDefinitions\.delete\(definition\);\n    if \(isRandomEventGameplayLockActive\(\)\) return;/
  );
  assert.doesNotMatch(source, /RANDOM_EVENT_REPEAT_DAMPEN|interactiveRandomEventRepeat|recordInteractiveRandomEventRun/);

  const trigger = source.match(
    /const triggerRandomEvents = \(triggerName, detail = \{\}\) => \{([\s\S]*?)\n\};\n\nconst recordGeneralRandomEventClick/
  );
  assert.ok(trigger, "The trigger should remain a dedicated helper");
  assert.match(
    trigger[1],
    /if \(!isHomeActivationReady\(\)\) return false;\n  if \(isRandomEventGameplayLockActive\(\)\) return false;\n  if \(isRandomEventTriggerOnCooldown\(\)\) return false;/
  );
  assert.match(
    trigger[1],
    /const selected = chooseRandomEventOutsideLockdown\(eligibleEvents\);[\s\S]*?if \(!selected\) \{[\s\S]*?return maybeShowFelizJueves\(\);/
  );

  assert.match(
    source,
    /const maybeShowFelizJueves = \(\) => \{\n  if \(isRandomEventGameplayLockActive\(\)\) return false;[\s\S]*?if \(isRandomEventTriggerOnCooldown\(\)\) return false;[\s\S]*?markFelizJuevesShown\(dateKey\);\n  recordRandomEventTrigger\(\);\n  showFelizJuevesWindow\(\);/
  );
});

test("the scheduler rejects active gameplay and holds other events during the global cooldown", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const scheduler = source.match(
    /const scheduleRandomEventRun = \(definition, context\) => \{([\s\S]*?)\n\};\n\nconst triggerRandomEvents/
  );
  assert.ok(scheduler, "The scheduler should remain independently executable");

  const context = vm.createContext({ Promise, Set });
  vm.runInContext(
    `
      let cooldownActive = false;
      let canSchedule = false;
      let gameplayLockActive = true;
      let selectionCount = 0;
      const randomEventPendingDefinitions = new Set();
      const isRandomEventGameplayLockActive = () => gameplayLockActive;
      const isRandomEventTriggerOnCooldown = () => cooldownActive;
      const recordRandomEventTrigger = () => { cooldownActive = true; };
      const isRandomEventOnLockdown = () => false;
      const randomEventDefinitionCanSchedule = () => canSchedule;
      const recordRandomEventSelection = () => { selectionCount += 1; };
      const randomEventDelayMs = () => 0;
      const preloadRandomEventAssets = () => new Promise(() => {});
      const window = { setTimeout: () => {} };
      const scheduleRandomEventRun = (definition, context) => {${scheduler[1]}
      };
      globalThis.randomEventScheduler = {
        getCooldownActive: () => cooldownActive,
        getPendingCount: () => randomEventPendingDefinitions.size,
        getSelectionCount: () => selectionCount,
        schedule: scheduleRandomEventRun,
        setCanSchedule: (value) => { canSchedule = value; },
        setGameplayLockActive: (value) => { gameplayLockActive = value; },
      };
    `,
    context
  );

  const runtime = context.randomEventScheduler;
  const first = { id: "first", run: () => {} };
  const second = { id: "second", run: () => {} };

  assert.equal(runtime.schedule(first, { triggerName: "gameWin" }), false);
  assert.equal(runtime.getCooldownActive(), false);
  assert.equal(runtime.getPendingCount(), 0);
  assert.equal(runtime.getSelectionCount(), 0);

  runtime.setGameplayLockActive(false);
  runtime.setCanSchedule(true);
  assert.equal(runtime.schedule(first, { triggerName: "gameWin" }), true);
  assert.equal(runtime.getCooldownActive(), true);
  assert.equal(runtime.getPendingCount(), 1);
  assert.equal(runtime.getSelectionCount(), 1);
  assert.equal(runtime.schedule(second, { triggerName: "windowOpen" }), false);
  assert.equal(runtime.getPendingCount(), 1);
  assert.equal(runtime.getSelectionCount(), 1);
});

test("a queued event does not appear after a gameplay lock begins", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const scheduler = source.match(
    /const scheduleRandomEventRun = \(definition, context\) => \{([\s\S]*?)\n\};\n\nconst triggerRandomEvents/
  );
  assert.ok(scheduler, "The scheduler should remain independently executable");

  const context = vm.createContext({ Promise, Set });
  vm.runInContext(
    `
      let gameplayLockActive = false;
      let resolvePreload;
      const randomEventPendingDefinitions = new Set();
      const isRandomEventGameplayLockActive = () => gameplayLockActive;
      const isRandomEventTriggerOnCooldown = () => false;
      const recordRandomEventTrigger = () => {};
      const isRandomEventOnLockdown = () => false;
      const randomEventDefinitionCanSchedule = () => true;
      const recordRandomEventSelection = () => {};
      const randomEventDelayMs = () => 0;
      const preloadRandomEventAssets = () => new Promise((resolve) => {
        resolvePreload = resolve;
      });
      const window = { setTimeout: (callback) => callback() };
      const scheduleRandomEventRun = (definition, context) => {${scheduler[1]}
      };
      globalThis.randomEventSchedulerRace = {
        schedule: scheduleRandomEventRun,
        resolvePreload: () => resolvePreload(),
        setGameplayLockActive: (value) => { gameplayLockActive = value; },
        getPendingCount: () => randomEventPendingDefinitions.size,
      };
    `,
    context
  );

  const runtime = context.randomEventSchedulerRace;
  let firstRuns = 0;
  const first = { id: "first", run: () => { firstRuns += 1; } };

  assert.equal(runtime.schedule(first, { triggerName: "generalClicks" }), true);
  runtime.setGameplayLockActive(true);
  runtime.resolvePreload();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(firstRuns, 0);
  assert.equal(runtime.getPendingCount(), 0);

  runtime.setGameplayLockActive(false);
  let secondRuns = 0;
  const second = { id: "second", run: () => { secondRuns += 1; } };
  assert.equal(runtime.schedule(second, { triggerName: "generalClicks" }), true);
  runtime.resolvePreload();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(secondRuns, 1);
});
