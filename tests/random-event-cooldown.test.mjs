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

test("only the requested Neko event uses debug mode", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const registrations = getRandomEventRegistrationBlocks(source);
  const alertConfigStart = source.indexOf("const DEBUG_SYSTEM_ALERTS =");
  const alertConfigEnd = source.indexOf("\nconst RANDOM_EVENT_RELOAD_KEY", alertConfigStart);
  assert.notEqual(alertConfigStart, -1, "The shared system-alert configuration must exist");
  assert.notEqual(alertConfigEnd, -1, "The shared system-alert configuration must be bounded");
  const alertConfig = source.slice(alertConfigStart, alertConfigEnd);

  assert.match(source, /const RANDOM_EVENT_GLOBAL_DEBUG = false;/);
  assert.equal(
    source.match(/const RANDOM_EVENT_DEVELOPER_MODE = false;/g)?.length,
    1,
    "Random event developer mode must have one commit-safe disabled toggle"
  );
  assert.doesNotMatch(source, /const RANDOM_EVENT_DEVELOPER_MODE = true;/);
  assert.match(
    source,
    /const registerRandomEvent = \(definition\) => \{\n  randomEventDefinitions\.push\(definition\);\n  return definition;\n\};/
  );
  assert.match(source, /randomEventDefinitions\.forEach\(\(definition\) => \{/);
  assert.ok(registrations.length > 0, "The normal random-event registry must remain populated");

  const standardRegistrations = registrations.filter((registration) =>
    /\bid:\s*"[^"]+"/.test(registration)
  );
  assert.equal(
    registrations.length,
    standardRegistrations.length + 1,
    "Only the data-driven debug alert family may omit a literal id"
  );
  assert.equal(
    source.match(/\bdebug\s*:\s*true\b/g)?.length ?? 0,
    1,
    "Only the requested Neko event may bypass probability and the global cooldown"
  );
  assert.equal(alertConfig.match(/\bdebug\s*:\s*true\b/g)?.length ?? 0, 0);
  assert.match(
    alertConfig,
    /id: "seneca-announcement",[\s\S]*?debug: false,/
  );
  assert.match(
    alertConfig,
    /id: "deodorant-reminder",[\s\S]*?debug: false,/
  );
  assert.match(
    alertConfig,
    /id: "power-cycle-reminder",[\s\S]*?debug: false,/
  );
  const expectedDebugIds = new Set([
    "neko-stream-system-alert",
  ]);
  const actualDebugIds = new Set();
  const registeredIds = standardRegistrations.map((registration) => {
    const id = registration.match(/\bid:\s*"([^"]+)"/);
    assert.ok(id, "Every registered random event must retain an id");
    assert.match(registration, /\brun:\s*\(/, `Event ${id[1]} must remain runnable`);
    if (expectedDebugIds.has(id[1])) {
      assert.match(registration, /\bdebug\s*:\s*true\b/, id[1]);
      actualDebugIds.add(id[1]);
    } else {
      assert.doesNotMatch(registration, /\bdebug\s*:\s*true\b/, id[1]);
    }
    return id[1];
  });
  assert.deepEqual(actualDebugIds, expectedDebugIds);
  assert.match(
    standardRegistrations.find((registration) =>
      /\bid:\s*"lain-system-alert"/.test(registration)
    ),
    /\bdebug\s*:\s*false\b/,
    "Lain must remain on its normal probability-gated path"
  );
  assert.match(
    standardRegistrations.find((registration) => /\bid:\s*"red-tool"/.test(registration)),
    /\bdebug\s*:\s*false\b/,
    "Red Tool must remain on its normal probability-gated path"
  );
  assert.equal(new Set(registeredIds).size, registeredIds.length, "Event ids must remain unique");
  assert.match(
    source,
    /DEBUG_SYSTEM_ALERTS\.forEach\(\(alert\) => \{[\s\S]*?id: `debug-system-alert-\$\{alert\.id\}`,[\s\S]*?debug: alert\.debug === true,/
  );
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

test("accepted normal random-event triggers use the global seven-and-a-half-second cooldown", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const cooldown = createCooldownRuntime(source);

  cooldown.recordRandomEventTrigger(1000);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(1000), true);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(8499), true);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(8500), false);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(8501), false);
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

test("the scheduler isolates developer events and only cools down normal accepted events", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const scheduler = source.match(
    /const scheduleRandomEventRun = \(definition, context\) => \{([\s\S]*?)\n\};\n\nconst triggerRandomEvents/
  );

  assert.ok(scheduler, "The scheduler should remain a dedicated helper");
  assert.match(scheduler[1], /const debug = Boolean\(context\.debug\);/);
  assert.match(scheduler[1], /if \(isRandomEventGameplayLockActive\(\)\) return false;/);
  assert.match(
    scheduler[1],
    /if \(!debug && isRandomEventTriggerOnCooldown\(\)\) return false;/
  );
  assert.match(scheduler[1], /if \(isRandomEventOnLockdown\(definition\)\) return false;/);
  assert.match(
    scheduler[1],
    /randomEventPendingDefinitions\.add\(definition\);\n  recordRandomEventSelection\(definition\);\n  if \(!debug\) recordRandomEventTrigger\(\);\n  const delayRequest/
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
    /if \(!isHomeActivationReady\(\)\) return false;\n  if \(shouldPauseNaturalRandomEvents\(\)\) return false;\n  if \(isRandomEventGameplayLockActive\(\)\) return false;\n  const triggerOnCooldown = isRandomEventTriggerOnCooldown\(\);/
  );
  assert.match(
    trigger[1],
    /const debugEventPending = Array\.from\(randomEventPendingDefinitions\)\.some\(\n    randomEventDebugEnabled\n  \);[\s\S]*?if \(!randomEventDeveloperModeAllows\(definition\)\) return;\n    const debug = randomEventDebugEnabled\(definition\);\n    if \(debugEventPending && debug\) return;\n    if \(triggerOnCooldown && !debug\) return;/
  );
  assert.match(
    trigger[1],
    /if \(forceDebugRun\) \{[\s\S]*?forcedDebugEvents\.push\([\s\S]*?triggerProbability: 1,[\s\S]*?const selectedDebug = chooseRandomEventOutsideLockdown\(forcedDebugEvents\);[\s\S]*?scheduleRandomEventRun\(selectedDebug\.definition,/
  );
  assert.match(
    trigger[1],
    /const selected = chooseRandomEventOutsideLockdown\(eligibleEvents\);[\s\S]*?if \(!selected\) \{[\s\S]*?return maybeShowFelizJueves\(\);/
  );

  assert.match(
    source,
    /const maybeShowFelizJueves = \(\) => \{\n  if \(RANDOM_EVENT_DEVELOPER_MODE\) return false;\n  if \(isRandomEventGameplayLockActive\(\)\) return false;[\s\S]*?if \(isRandomEventTriggerOnCooldown\(\)\) return false;[\s\S]*?markFelizJuevesShown\(dateKey\);\n  recordRandomEventTrigger\(\);\n  showFelizJuevesWindow\(\);/
  );
  assert.match(
    source,
    /const randomEventDeveloperModeAllows = \(definition\) =>\n  !RANDOM_EVENT_DEVELOPER_MODE \|\| Boolean\(definition\.debug\);/
  );
});

test("debug scheduling bypasses only the global cooldown", async () => {
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
      let lockdownActive = false;
      let triggerCount = 0;
      let selectionCount = 0;
      const randomEventPendingDefinitions = new Set();
      const isRandomEventGameplayLockActive = () => gameplayLockActive;
      const isRandomEventTriggerOnCooldown = () => cooldownActive;
      const recordRandomEventTrigger = () => {
        cooldownActive = true;
        triggerCount += 1;
      };
      const isRandomEventOnLockdown = () => lockdownActive;
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
        getTriggerCount: () => triggerCount,
        schedule: scheduleRandomEventRun,
        setCooldownActive: (value) => { cooldownActive = value; },
        setCanSchedule: (value) => { canSchedule = value; },
        setGameplayLockActive: (value) => { gameplayLockActive = value; },
        setLockdownActive: (value) => { lockdownActive = value; },
      };
    `,
    context
  );

  const runtime = context.randomEventScheduler;
  const first = { id: "first", run: () => {} };
  const second = { id: "second", debug: true, run: () => {} };

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
  assert.equal(runtime.getTriggerCount(), 1);
  assert.equal(runtime.schedule(second, { triggerName: "windowOpen" }), false);
  assert.equal(runtime.getPendingCount(), 1);
  assert.equal(runtime.getSelectionCount(), 1);

  runtime.setGameplayLockActive(true);
  assert.equal(
    runtime.schedule(second, { triggerName: "windowOpen", debug: true }),
    false
  );
  runtime.setGameplayLockActive(false);
  runtime.setLockdownActive(true);
  assert.equal(
    runtime.schedule(second, { triggerName: "windowOpen", debug: true }),
    false
  );
  runtime.setLockdownActive(false);
  runtime.setCooldownActive(true);
  assert.equal(
    runtime.schedule(second, { triggerName: "windowOpen", debug: true }),
    true
  );
  assert.equal(runtime.getPendingCount(), 2);
  assert.equal(runtime.getSelectionCount(), 2);
  assert.equal(runtime.getTriggerCount(), 1);
});

test("developer mode uses raw flags and takes precedence over global debug", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const effectiveDebugHelper = source.match(
    /const randomEventDebugEnabled = \(definition\) =>\n  RANDOM_EVENT_GLOBAL_DEBUG \|\| Boolean\(definition\.debug\);/
  );
  const developerModeHelper = source.match(
    /const randomEventDeveloperModeAllows = \(definition\) =>\n  !RANDOM_EVENT_DEVELOPER_MODE \|\| Boolean\(definition\.debug\);/
  );
  assert.ok(effectiveDebugHelper, "Effective debug state should remain a dedicated helper");
  assert.ok(developerModeHelper, "The developer-mode filter should remain a dedicated helper");

  const evaluate = ({ developerMode, globalDebug, definition }) => {
    const context = vm.createContext({ Boolean, definition });
    return JSON.parse(
      vm.runInContext(
        `const RANDOM_EVENT_DEVELOPER_MODE = ${developerMode};\n` +
          `const RANDOM_EVENT_GLOBAL_DEBUG = ${globalDebug};\n` +
          `${effectiveDebugHelper[0]}\n${developerModeHelper[0]}\n` +
          `JSON.stringify({ allowed: randomEventDeveloperModeAllows(definition), debug: randomEventDebugEnabled(definition) });`,
        context
      )
    );
  };

  assert.deepEqual(
    evaluate({
      developerMode: false,
      globalDebug: false,
      definition: { debug: false },
    }),
    { allowed: true, debug: false }
  );
  assert.deepEqual(
    evaluate({
      developerMode: false,
      globalDebug: false,
      definition: { debug: true },
    }),
    { allowed: true, debug: true }
  );
  assert.deepEqual(
    evaluate({
      developerMode: false,
      globalDebug: true,
      definition: { debug: false },
    }),
    { allowed: true, debug: true }
  );
  assert.deepEqual(
    evaluate({
      developerMode: true,
      globalDebug: true,
      definition: { debug: false },
    }),
    { allowed: false, debug: true }
  );
  assert.deepEqual(
    evaluate({
      developerMode: true,
      globalDebug: false,
      definition: { debug: true },
    }),
    { allowed: true, debug: true }
  );
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
