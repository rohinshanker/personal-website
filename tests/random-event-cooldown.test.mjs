import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import {
  RANDOM_EVENT_SCRIPT_KEYS,
  readHomeScript,
  readHomeScriptText,
} from "./helpers/home-scripts.mjs";

const root = new URL("../", import.meta.url);

/** A shared helper's own source, so the harness runs production code. */
const sharedHelper = (source, name) => {
  const declaration = `const ${name} = `;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${name} should exist in the shared helpers`);
  let depth = 0;
  for (let index = start + declaration.length; index < source.length; index += 1) {
    const character = source[index];
    if ("([{".includes(character)) depth += 1;
    else if (")]}".includes(character)) depth -= 1;
    else if (character === ";" && depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} should be bounded`);
};

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

test("all 30 system alerts register normally and only Neko forces a Start run", async () => {
  const [source, systemAlertSource] = await Promise.all([
    readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator"),
    readFile(new URL("scripts/home/system-alerts.js", root), "utf8"),
  ]);
  const registrations = getRandomEventRegistrationBlocks(source);
  const alertConfigStart = systemAlertSource.indexOf(
    "const SYSTEM_ALERT_INPUTS = Object.freeze(["
  );
  const alertConfigEnd = systemAlertSource.indexOf(
    "\n  ]);\n\n  const definitions =",
    alertConfigStart
  );
  assert.notEqual(alertConfigStart, -1, "The shared system-alert inputs must exist");
  assert.notEqual(alertConfigEnd, -1, "The shared system-alert inputs must be bounded");
  const alertConfig = systemAlertSource.slice(alertConfigStart, alertConfigEnd);
  const alertIds = Array.from(
    alertConfig.matchAll(/^\s+id: "([^"]+)",/gm),
    (match) => match[1]
  );
  const addedAlertIds = [
    "substack-reminder",
    "goldfish",
    "browser-infected",
    "operation-unsupported",
    "time-warning",
    "question-everything",
    "degrees",
    "comdex",
    "battery",
    "tabs",
    "eye-strain",
    "social-media",
    "language",
    "radio-waves",
    "cereal",
    "keys",
    "photos",
  ];

  assert.equal(alertIds.length, 30, "Every system-alert input must register");
  assert.equal(new Set(alertIds).size, 30, "System-alert input ids must be unique");
  assert.deepEqual(alertIds.slice(13), addedAlertIds);
  assert.equal(addedAlertIds.length, 17);

  assert.match(source, /const RANDOM_EVENT_GLOBAL_DEBUG = false;/);
  assert.equal(
    source.match(/const RANDOM_EVENT_DEVELOPER_MODE = false;/g)?.length,
    1,
    "Random event developer mode must have one commit-safe disabled toggle"
  );
  assert.doesNotMatch(source, /const RANDOM_EVENT_DEVELOPER_MODE = true;/);
  assert.match(
    source,
    /const registerRandomEvent = \(definition\) => \{[\s\S]*?debug: false,[\s\S]*?forceOnStart: false,[\s\S]*?probability: STANDARD_RANDOM_EVENT_PROBABILITY,[\s\S]*?probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,[\s\S]*?\.\.\.definition,[\s\S]*?randomEventDefinitions\.push\(registeredDefinition\);[\s\S]*?return registeredDefinition;\n\};/
  );
  assert.match(source, /randomEventDefinitions\.forEach\(\(definition\) => \{/);
  assert.ok(registrations.length > 0, "The normal random-event registry must remain populated");

  const standardRegistrations = registrations.filter((registration) =>
    /\bid:\s*"[^"]+"/.test(registration)
  );
  assert.equal(
    registrations.length,
    standardRegistrations.length + 1,
    "Only the data-driven system-alert family may omit a literal id"
  );
  assert.equal(source.match(/\bdebug\s*:\s*true\b/g)?.length ?? 0, 0);
  assert.equal(
    source.match(/\bforceOnStart\s*:\s*true\b/g)?.length ?? 0,
    1,
    "Only the requested Neko event may force a Start-triggered run"
  );
  assert.doesNotMatch(systemAlertSource, /\bdebug\s*:/);
  const expectedForcedStartIds = new Set([
    "neko-stream-system-alert",
  ]);
  const actualForcedStartIds = new Set();
  const registeredIds = standardRegistrations.map((registration) => {
    const id = registration.match(/\bid:\s*"([^"]+)"/);
    assert.ok(id, "Every registered random event must retain an id");
    assert.match(registration, /\brun:\s*\(/, `Event ${id[1]} must remain runnable`);
    if (expectedForcedStartIds.has(id[1])) {
      assert.match(registration, /\bforceOnStart\s*:\s*true\b/, id[1]);
      assert.doesNotMatch(registration, /\bdebug\s*:\s*true\b/, id[1]);
      actualForcedStartIds.add(id[1]);
    } else {
      assert.doesNotMatch(registration, /\bforceOnStart\s*:\s*true\b/, id[1]);
    }
    return id[1];
  });
  assert.deepEqual(actualForcedStartIds, expectedForcedStartIds);
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
  const generatedSystemAlertIds = alertIds.map((id) => `debug-system-alert-${id}`);
  assert.equal(generatedSystemAlertIds.length, 30);
  assert.equal(
    new Set([...registeredIds, ...generatedSystemAlertIds]).size,
    registeredIds.length + generatedSystemAlertIds.length,
    "Literal and generated event ids must remain unique"
  );
  const systemAlertRegistration = registrations.find((registration) =>
    /id: `debug-system-alert-\$\{alert\.id\}`/.test(registration)
  );
  assert.ok(systemAlertRegistration, "The common system-alert registration must exist");
  assert.doesNotMatch(systemAlertRegistration, /\b(?:debug|probability|probabilities):/);
  assert.match(systemAlertRegistration, /\bkind:\s*RANDOM_EVENT_KIND_INTERACTIVE,/);
  assert.match(systemAlertRegistration, /\bisVisible:\s*isDebugSystemAlertVisible,/);
  assert.match(
    systemAlertRegistration,
    /\bcanTrigger:\s*\(\) => !isDebugSystemAlertVisible\(\),/
  );
  assert.match(systemAlertRegistration, /\bpreloadTargets:\s*\(\) => \[alert\.icon\],/);
  assert.match(systemAlertRegistration, /\brun:\s*\(\) => showDebugSystemAlert\(alert\),/);
  assert.match(systemAlertRegistration, /\bsystemAlert:\s*alert,/);
  assert.match(
    source,
    /SYSTEM_ALERTS\.forEach\(\(alert\) => \{[\s\S]*?id: `debug-system-alert-\$\{alert\.id\}`,[\s\S]*?kind: RANDOM_EVENT_KIND_INTERACTIVE,/
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
    `${sharedHelper(source, "chooseWeightedRandomEvent")}\n` +
      `${source.slice(start, end)}\n` +
      "globalThis.randomEventCooldown = { isRandomEventTriggerOnCooldown, recordRandomEventTrigger, isRandomEventOnLockdown, recordRandomEventSelection, chooseRandomEventOutsideLockdown };",
    context
  );

  return {
    ...context.randomEventCooldown,
    setRandomValues: (values) => randomValues.splice(0, randomValues.length, ...values),
  };
};

const createPromoRandomRuntime = (source) => {
  const start = source.indexOf("const PROMO_RANDOM_EVENT_TRIGGER_FLOOR =");
  const end = source.indexOf("\n\nconst randomEventTriggerProbability", start);
  assert.notEqual(start, -1, "The promo random probability helpers should exist");
  assert.notEqual(end, -1, "The promo random probability helper block should be bounded");

  const context = vm.createContext({ Math, Number });
  vm.runInContext(
    `${sharedHelper(source, "clampNumber")}\n` +
      `${source.slice(start, end)}\n` +
      "globalThis.promoRandom = { promoRandomEventTriggerProbability, promoRandomEventCompactnessWeight };",
    context
  );
  return context.promoRandom;
};

const createGameplayLockRuntime = (source) => {
  const start = source.indexOf("const isRandomEventGameplayLockActive = () =>");
  const end = source.indexOf("\n\nconst scheduleRandomEventRun", start);
  assert.notEqual(start, -1, "The gameplay lock helper should exist");
  assert.notEqual(end, -1, "The gameplay lock helper should be bounded");

  const context = vm.createContext({ Boolean });
  vm.runInContext(
    `
      const randomEventDefinitions = [];
      ${source.slice(start, end)}
      globalThis.randomEventGameplayLock = {
        isActive: isRandomEventGameplayLockActive,
        register: (definition) => randomEventDefinitions.push(definition),
        clear: () => randomEventDefinitions.splice(0, randomEventDefinitions.length),
      };
    `,
    context
  );
  return context.randomEventGameplayLock;
};

const createAdminRandomChoiceRuntime = (source) => {
  const start = source.indexOf("const runAdminRandomEventChoice = async");
  const end = source.indexOf("\n\nconst ADMIN_DESKTOP_ACTIVITY_APPS", start);
  assert.notEqual(start, -1, "The Admin random choice helper should exist");
  assert.notEqual(end, -1, "The Admin random choice helper should be bounded");

  const context = vm.createContext({ Promise, Set });
  vm.runInContext(
    `
      let activationReady = true;
      const whenHomeActivated = Promise.resolve();
      let gameplayLocked = false;
      const isHomeActivationReady = () => activationReady;
      const isRandomEventGameplayLockActive = () => gameplayLocked;
      const adminRandomEventResult = (ok, message) => ({ ok, message });
      const randomEventDefinitions = [];
      const randomEventPendingDefinitions = new Set();
      const lockedIds = new Set();
      const recordedIds = [];
      const runCalls = [];
      const candidateSnapshots = [];
      const randomEventDeveloperModeAllows = (definition) => definition.developerAllowed !== false;
      const randomEventDefinitionIsVisible = (definition) => definition.visible === true;
      const randomEventDebugEnabled = (definition) => definition.debug === true;
      const randomEventDefinitionCanSchedule = (definition) => definition.schedulable !== false;
      const chooseRandomEventOutsideLockdown = (candidates) => {
        candidateSnapshots.push(candidates.map((candidate) => ({
          id: candidate.definition.id,
          triggerProbability: candidate.triggerProbability,
        })));
        return candidates.find((candidate) => !lockedIds.has(candidate.definition.id)) || null;
      };
      const recordRandomEventSelection = (definition) => {
        lockedIds.add(definition.id);
        recordedIds.push(definition.id);
      };
      const runAdminRandomEvent = async (eventId, options) => {
        runCalls.push({ eventId, options });
        return { ok: true, message: \`Triggered \${eventId}.\` };
      };
      ${source.slice(start, end)}
      globalThis.adminRandomChoice = {
        run: runAdminRandomEventChoice,
        setDefinitions: (definitions) => {
          randomEventDefinitions.splice(0, randomEventDefinitions.length, ...definitions);
        },
        markPending: (definition) => randomEventPendingDefinitions.add(definition),
        setGameplayLocked: (value) => { gameplayLocked = value; },
        getCandidateSnapshots: () => candidateSnapshots,
        getRecordedIds: () => recordedIds,
        getRunCalls: () => runCalls,
      };
    `,
    context
  );
  return context.adminRandomChoice;
};

test("accepted normal random-event triggers use the global seven-and-a-half-second cooldown", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
  const cooldown = createCooldownRuntime(source);

  cooldown.recordRandomEventTrigger(1000);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(1000), true);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(8499), true);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(8500), false);
  assert.equal(cooldown.isRandomEventTriggerOnCooldown(8501), false);
});

test("random-event selections remain locked until exactly two minutes have elapsed", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
  const cooldown = createCooldownRuntime(source);
  const event = { id: "alpha" };

  cooldown.recordRandomEventSelection(event, 1000);
  assert.equal(cooldown.isRandomEventOnLockdown(event, 1000), true);
  assert.equal(cooldown.isRandomEventOnLockdown(event, 120999), true);
  assert.equal(cooldown.isRandomEventOnLockdown(event, 121000), false);
});

test("a locked weighted draw is discarded and resampled from the remaining events", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
  const cooldown = createCooldownRuntime(source);
  const locked = { definition: { id: "locked" }, triggerProbability: 0.9 };
  const available = { definition: { id: "available" }, triggerProbability: 0.1 };

  cooldown.recordRandomEventSelection(locked.definition, 0);
  cooldown.setRandomValues([0, 0]);
  assert.equal(cooldown.chooseRandomEventOutsideLockdown([locked, available], 1), available);
});

test("selection terminates cleanly when every candidate is on lockdown", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
  const cooldown = createCooldownRuntime(source);
  const first = { definition: { id: "first" }, triggerProbability: 0.5 };
  const second = { definition: { id: "second" }, triggerProbability: 0.5 };

  cooldown.recordRandomEventSelection(first.definition, 0);
  cooldown.recordRandomEventSelection(second.definition, 0);
  cooldown.setRandomValues([0, 0]);
  assert.equal(cooldown.chooseRandomEventOutsideLockdown([first, second], 1), null);
});

test("the lockdown applies to interactive, debug, and forced-Start event definitions", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
  const cooldown = createCooldownRuntime(source);
  const interactive = { id: "interactive", kind: "interactive" };
  const nonInteractiveDebug = {
    id: "non-interactive-debug",
    kind: "non-interactive",
    debug: true,
  };
  const forcedStart = {
    id: "forced-start",
    kind: "interactive",
    forceOnStart: true,
  };

  cooldown.recordRandomEventSelection(interactive, 0);
  cooldown.recordRandomEventSelection(nonInteractiveDebug, 0);
  cooldown.recordRandomEventSelection(forcedStart, 0);
  assert.equal(cooldown.isRandomEventOnLockdown(interactive, 1), true);
  assert.equal(cooldown.isRandomEventOnLockdown(nonInteractiveDebug, 1), true);
  assert.equal(cooldown.isRandomEventOnLockdown(forcedStart, 1), true);
});

test("unlocked events retain their weighted selection behavior", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
  const cooldown = createCooldownRuntime(source);
  const first = { definition: { id: "first" }, triggerProbability: 0.9 };
  const second = { definition: { id: "second" }, triggerProbability: 0.1 };

  cooldown.setRandomValues([0.95]);
  assert.equal(cooldown.chooseRandomEventOutsideLockdown([first, second], 0), second);
});

test("promo mode raises trigger probability and favors smaller physical footprints", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
  const promo = createPromoRandomRuntime(source);

  assert.equal(promo.promoRandomEventTriggerProbability(0), 0.7);
  assert.equal(promo.promoRandomEventTriggerProbability(0.05), 0.7);
  assert.equal(promo.promoRandomEventTriggerProbability(0.2), 0.8);
  assert.equal(promo.promoRandomEventTriggerProbability(0.4), 1);
  assert.equal(promo.promoRandomEventTriggerProbability(1), 1);

  assert.equal(promo.promoRandomEventCompactnessWeight(100, 100), 1);
  assert.equal(promo.promoRandomEventCompactnessWeight(25, 100), 2);
  assert.equal(promo.promoRandomEventCompactnessWeight(400, 100), 0.5);
  assert.equal(promo.promoRandomEventCompactnessWeight(1, 100), 3);
  assert.equal(promo.promoRandomEventCompactnessWeight(0, 100), 1);
  assert.equal(promo.promoRandomEventCompactnessWeight(100, Number.NaN), 1);

  const cooldown = createCooldownRuntime(source);
  const large = {
    definition: { id: "large" },
    selectionWeight: 0.5,
    triggerProbability: 0.7,
  };
  const small = {
    definition: { id: "small" },
    selectionWeight: 2,
    triggerProbability: 0.7,
  };
  cooldown.setRandomValues([0.3]);
  assert.equal(cooldown.chooseRandomEventOutsideLockdown([large, small], 0), small);

  assert.match(
    source,
    /selectionWeight: isPromoRandomEventModeActive\(\)[\s\S]*?randomEventCompactnessWeightProvider\(definition\)/
  );
  assert.match(source, /Math\.random\(\) >= maxTriggerProbability/);
  assert.match(source, /const getAdminRandomEventCompactnessWeight = \(definition\) =>/);
  assert.match(source, /querySelectorAll\("img\[data-src\], video\[data-src\]"\)/);
  assert.match(
    source,
    /unresolvedMediaEventIds\.has\(eventId\)[\s\S]*?PROMO_RANDOM_EVENT_COMPACTNESS_MIN/
  );
});

test("Admin Random uniformly selects and records through the shared repeat window", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
  const runtime = createAdminRandomChoiceRuntime(source);
  const pending = { id: "pending" };
  const blockedByTrigger = { id: "trigger-blocked", canTrigger: () => false };
  const first = { id: "first", canTrigger: ({ admin }) => admin };
  const second = { id: "second" };
  runtime.setDefinitions([
    pending,
    { id: "developer-blocked", developerAllowed: false },
    { id: "visible", visible: true },
    { id: "kind-blocked", schedulable: false },
    blockedByTrigger,
    first,
    second,
  ]);
  runtime.markPending(pending);

  assert.deepEqual(
    JSON.parse(JSON.stringify(await runtime.run({ source: "first-click" }))),
    { ok: true, message: "Triggered first." }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(await runtime.run({ source: "second-click" }))),
    { ok: true, message: "Triggered second." }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(await runtime.run({ source: "third-click" }))),
    {
      ok: false,
      message: "No eligible event is available outside the recent-repeat window.",
    }
  );
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.getCandidateSnapshots())), [
    [
      { id: "first", triggerProbability: 1 },
      { id: "second", triggerProbability: 1 },
    ],
    [
      { id: "first", triggerProbability: 1 },
      { id: "second", triggerProbability: 1 },
    ],
    [
      { id: "first", triggerProbability: 1 },
      { id: "second", triggerProbability: 1 },
    ],
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.getRecordedIds())), ["first", "second"]);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.getRunCalls())), [
    { eventId: "first", options: { source: "first-click" } },
    { eventId: "second", options: { source: "second-click" } },
  ]);

  runtime.setGameplayLocked(true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await runtime.run())),
    { ok: false, message: "Finish the active gameplay event first." }
  );
});

test("an event that reports a gameplay lock blocks every other event", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
  const lock = createGameplayLockRuntime(source);

  assert.equal(lock.isActive(), false, "nothing is locked with no events registered");

  let midFight = false;
  lock.register({ id: "scheduled-only" });
  lock.register({ id: "mid-fight", isGameplayLocked: () => midFight });
  assert.equal(lock.isActive(), false, "a registered event that is idle does not lock");

  midFight = true;
  assert.equal(lock.isActive(), true, "an event reporting a lock blocks the rest");

  midFight = false;
  assert.equal(lock.isActive(), false, "the lock lifts when the event says so");
});

test("every event that holds the visitor mid-activity reports the lock", async () => {
  // Each condition is the one the monolith checked centrally; the event that
  // owns the state now declares it, so losing one shows up here.
  const conditions = [
    ["eventBrandBurns", /isGameplayLocked: \(\) =>\s*isBrandBurnsVisible\(\) && brandBurnsStage === "fight"/],
    ["eventFate", /isGameplayLocked: \(\) =>\s*isFateVisible\(\) && fateState === "active"/],
    [
      "eventLancerBattle",
      /isGameplayLocked: \(\) =>\s*isLancerBattleVisible\(\) && lancerBattleState === LANCER_BATTLE_STAGES\.active/,
    ],
    [
      "eventGearsNest",
      /isGameplayLocked: \(\) =>\s*isGearsNestVisible\(\) && gearsNestState\.active && !gearsNestState\.completed/,
    ],
    [
      "eventToxicJungle",
      /isGameplayLocked: \(\) =>\s*isToxicJungleVisible\(\) && toxicJungleStage === TOXIC_JUNGLE_STAGE_ACTIVE/,
    ],
  ];

  for (const [key, pattern] of conditions) {
    assert.match(await readHomeScript(key), pattern, `${key} must report its gameplay lock`);
  }
});
test("the scheduler isolates forced events and only cools down normal accepted events", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
  const scheduler = source.match(
    /const scheduleRandomEventRun = \(definition, context\) => \{([\s\S]*?)\n\};\n\nconst triggerRandomEvents/
  );

  assert.ok(scheduler, "The scheduler should remain a dedicated helper");
  assert.match(scheduler[1], /const debug = Boolean\(context\.debug\);/);
  assert.match(
    scheduler[1],
    /const forceOnStart =\n    Boolean\(context\.forceOnStart\) && context\.triggerName === "startButton";/
  );
  assert.match(scheduler[1], /const bypassGlobalLimits = debug \|\| forceOnStart;/);
  assert.match(scheduler[1], /if \(isRandomEventGameplayLockActive\(\)\) return false;/);
  assert.match(
    scheduler[1],
    /if \(!bypassGlobalLimits && isRandomEventTriggerOnCooldown\(\)\) return false;/
  );
  assert.match(scheduler[1], /if \(isRandomEventOnLockdown\(definition\)\) return false;/);
  assert.match(
    scheduler[1],
    /randomEventPendingDefinitions\.add\(definition\);\n  recordRandomEventSelection\(definition\);\n  if \(!bypassGlobalLimits\) recordRandomEventTrigger\(\);\n  const delayRequest/
  );
  assert.match(
    scheduler[1],
    /Promise\.all\(\[delayRequest, preloadRequest\]\)\.then\(\(\) => \{\n    randomEventPendingDefinitions\.delete\(definition\);\n    if \(isRandomEventGameplayLockActive\(\)\) return;/
  );
  assert.match(
    scheduler[1],
    /definition\.canTrigger\(\{ triggerName, detail, debug, forceOnStart \}\)/
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
    /const forcedEventPending = Array\.from\(randomEventPendingDefinitions\)\.some\([\s\S]*?randomEventDebugEnabled\(definition\) \|\|[\s\S]*?randomEventForceOnStartEnabled\(definition\)[\s\S]*?const forceOnStart = randomEventForceOnStartEnabled\(definition\);[\s\S]*?const bypassGlobalLimits =[\s\S]*?debug \|\| \(forceOnStart && triggerName === "startButton"\);[\s\S]*?if \(forcedEventPending && \(debug \|\| forceOnStart\)\) return;[\s\S]*?if \(triggerOnCooldown && !bypassGlobalLimits\) return;/
  );
  assert.match(
    trigger[1],
    /const forceRun =[\s\S]*?forceOnStart && triggerName === "startButton"[\s\S]*?if \(forceRun\) \{[\s\S]*?forcedEvents\.push\([\s\S]*?triggerProbability: 1,[\s\S]*?const selectedForced = chooseRandomEventOutsideLockdown\(forcedEvents\);[\s\S]*?scheduleRandomEventRun\(selectedForced\.definition,/
  );
  assert.match(
    trigger[1],
    /const selected = chooseRandomEventOutsideLockdown\(eligibleEvents\);[\s\S]*?if \(!selected\) \{[\s\S]*?return runRandomEventFallback\(triggerName\);/
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

test("only Start-bound force contexts and debug scheduling bypass global limits", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
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
      const randomEventDefinitionCanSchedule = (
        definition,
        { debug = false, forceOnStart = false } = {}
      ) => debug || forceOnStart || canSchedule;
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
  const nonStartForced = {
    id: "non-start-forced",
    forceOnStart: true,
    run: () => {},
  };
  const forcedStart = { id: "forced-start", forceOnStart: true, run: () => {} };

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

  runtime.setCanSchedule(true);
  assert.equal(
    runtime.schedule(nonStartForced, {
      triggerName: "windowOpen",
      forceOnStart: true,
    }),
    false
  );
  assert.equal(runtime.getPendingCount(), 2);
  assert.equal(runtime.getSelectionCount(), 2);
  assert.equal(runtime.getTriggerCount(), 1);

  runtime.setCooldownActive(false);
  runtime.setCanSchedule(false);
  assert.equal(
    runtime.schedule(nonStartForced, {
      triggerName: "windowOpen",
      forceOnStart: true,
    }),
    false
  );
  assert.equal(runtime.getPendingCount(), 2);
  assert.equal(runtime.getSelectionCount(), 2);
  assert.equal(runtime.getTriggerCount(), 1);

  runtime.setCooldownActive(true);
  assert.equal(
    runtime.schedule(forcedStart, {
      triggerName: "startButton",
      forceOnStart: true,
    }),
    true
  );
  assert.equal(runtime.getPendingCount(), 3);
  assert.equal(runtime.getSelectionCount(), 3);
  assert.equal(runtime.getTriggerCount(), 1);

  const lockedForcedStart = {
    id: "locked-forced-start",
    forceOnStart: true,
    run: () => {},
  };
  runtime.setLockdownActive(true);
  assert.equal(
    runtime.schedule(lockedForcedStart, {
      triggerName: "startButton",
      forceOnStart: true,
    }),
    false
  );
  assert.equal(runtime.getPendingCount(), 3);
  assert.equal(runtime.getSelectionCount(), 3);
});

test("developer mode uses raw flags and takes precedence over global debug", async () => {
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
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
  const source = await readHomeScriptText("util", ...RANDOM_EVENT_SCRIPT_KEYS, "adminOrchestrator");
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
