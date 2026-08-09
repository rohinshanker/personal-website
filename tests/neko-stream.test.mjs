import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

const readSources = async () => {
  const [home, index, styles, randomEventStyles, dom, main] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("styles/home/base.css", root), "utf8"),
    readFile(new URL("styles/home/random-events.css", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
  ]);
  return { dom, home, index, main, randomEventStyles, styles };
};

const extractBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Unable to extract ${startMarker}`);
  return source.slice(start, end);
};

const loadPlanner = async () => {
  const { main } = await readSources();
  const constants = extractBetween(
    main,
    "const NEKO_STREAM_COUNT",
    "const nekoStreamCats"
  );
  const planner = extractBetween(
    main,
    "const sampleNekoStreamRoll",
    "const syncNekoStreamLane"
  );
  const actionSpriteResolver = extractBetween(
    main,
    "const getNekoStreamActionSpriteName",
    "const startNekoStreamCatAction"
  );
  const context = vm.createContext({});
  const script = new vm.Script(`
    const NEKO_SPRITE_SIZE = 42;
    const NEKO_FRAME_INTERVAL_MS = 100;
    const NEKO_NAP_FRAME_SWITCH_FRAMES = 8;
    const NEKO_AWAKE_ACTION = Object.freeze({ frames: Object.freeze(["awake", "awake", "awake"]) });
    const NEKO_SCRATCH_SELF_ACTION = Object.freeze({
      frames: Object.freeze(["scratch1", "scratch2", "scratch1", "scratch2", "scratch1", "scratch2"]),
    });
    const NEKO_WASH_ACTION = Object.freeze({
      frames: Object.freeze(["wash1", "wash1", "wash1", "wash1", "wash1", "wash1"]),
    });
    const NEKO_YAWN_ACTION = Object.freeze({
      frames: Object.freeze(["yawn1", "yawn2", "yawn2", "yawn1"]),
    });
    ${constants}
    ${planner}
    ${actionSpriteResolver}
    globalThis.planner = Object.freeze({
      actions: NEKO_STREAM_ACTIONS,
      constants: Object.freeze({
        actionChance: NEKO_STREAM_ACTION_CHANCE,
        cleanCycle: NEKO_STREAM_CLEAN_CYCLE_MS,
        cleanSitPhase: NEKO_STREAM_CLEAN_SIT_PHASE_MS,
        cleanWashPhase: NEKO_STREAM_CLEAN_WASH_PHASE_MS,
        count: NEKO_STREAM_COUNT,
        fallbackTaskbarHeight: NEKO_STREAM_FALLBACK_TASKBAR_HEIGHT_PX,
        maxSpeed: NEKO_STREAM_MAX_SPEED_MULTIPLIER,
        minSpeed: NEKO_STREAM_MIN_SPEED_MULTIPLIER,
        nonSleepActionMax: NEKO_STREAM_NON_SLEEP_ACTION_MAX_MS,
        nonSleepActionMin: NEKO_STREAM_NON_SLEEP_ACTION_MIN_MS,
        offscreenMargin: NEKO_STREAM_OFFSCREEN_MARGIN,
        opaqueBottomRatio: NEKO_STREAM_MAX_OPAQUE_BOTTOM_RATIO,
        sleepActionDuration: NEKO_STREAM_SLEEP_ACTION_DURATION_MS,
        sleepOverlap: NEKO_STREAM_SLEEP_OVERLAP_PX,
        sourceSize: NEKO_STREAM_SOURCE_SIZE_PX,
        spawnWindow: NEKO_STREAM_SPAWN_WINDOW_MS,
        yawnActionDuration: NEKO_STREAM_YAWN_ACTION_DURATION_MS,
      }),
      createPlan: createNekoStreamPlan,
      isOutside: isNekoStreamOutsideViewport,
      poseOffset: getNekoStreamPoseOffsetY,
      spriteName: getNekoStreamActionSpriteName,
    });
  `);
  script.runInContext(context);
  return context.planner;
};

const sequenceRandom = (rolls, fallback = 0) => {
  let index = 0;
  return () => (index < rolls.length ? rolls[index++] : fallback);
};

const createActionPlan = (planner, actionTypeRoll, options = {}) => {
  const {
    actionGateRoll = 0.249999,
    actionDurationRoll = 0.5,
    actionProgressRoll = 0.5,
  } = options;
  const rolls = [0, 0, 0, actionGateRoll, actionTypeRoll, actionProgressRoll];
  const actionIndex = Math.min(4, Math.floor(Math.max(0, actionTypeRoll) * 5));
  if (actionIndex <= 2) rolls.push(actionDurationRoll);
  return planner.createPlan({ count: 1, random: sequenceRandom(rolls) })[0];
};

test("Neko launchers expose one accessible context command above a non-interactive stream layer", async () => {
  const { dom, home, index, main, styles } = await readSources();
  const launchers = home.match(/<button\b(?=[^>]*\bdata-app="neko")[^>]*>/g) || [];

  assert.equal(launchers.length, 2, "Desktop and taskbar Neko launchers must both exist");
  launchers.forEach((launcher) => {
    assert.match(launcher, /aria-haspopup="menu"/);
    assert.match(launcher, /aria-controls="neko-context-menu"/);
    assert.match(launcher, /aria-expanded="false"/);
  });
  assert.match(
    home,
    /id="neko-context-menu"[\s\S]*?role="menu"[\s\S]*?id="neko-stream-command"[\s\S]*?role="menuitem"[\s\S]*?\/nekostream/
  );
  assert.match(home, /class="neko-stream-layer" id="neko-stream-layer" aria-hidden="true"/);
  assert.match(dom, /nekoLaunchers: all\('\[data-app="neko"\]'\)/);
  assert.match(dom, /nekoContextMenu: byId\("neko-context-menu"\)/);
  assert.match(dom, /nekoStreamCommand: byId\("neko-stream-command"\)/);
  assert.match(dom, /nekoStreamLayer: byId\("neko-stream-layer"\)/);

  assert.match(
    styles,
    /\.neko-stream-layer \{[\s\S]*?z-index: 10001;[\s\S]*?overflow: hidden;[\s\S]*?pointer-events: none;/
  );
  assert.match(
    styles,
    /\.neko-stream-cat \{[\s\S]*?width: 42px;[\s\S]*?height: 42px;[\s\S]*?image-rendering: pixelated;[\s\S]*?pointer-events: none;/
  );
  assert.match(styles, /--neko-stream-pose-offset-y: 0px;/);
  assert.match(
    styles,
    /top: var\(--neko-stream-lane-y, calc\(100vh - 91\.375px\)\);/
  );
  assert.match(
    styles,
    /transform: translate\(-50%, var\(--neko-stream-pose-offset-y\)\);/
  );
  assert.doesNotMatch(styles, /\.neko-stream-cat\[data-mode=/);
  assert.match(styles, /\.neko-context-menu \{[\s\S]*?z-index: 10002;/);
  assert.match(styles, /\.neko-context-menu\[hidden\] \{\s*display: none;/);
  assert.match(home, /styles\/home\/base\.css\?v=admin-launchers-20260803/);
  assert.match(index, /styles\/home\/base\.css\?v=admin-launchers-20260803/);
  assert.doesNotMatch(main, /window\.__nekoStreamTest/);
});

test("the debug random-event registry exposes one guarded animated Neko stream alert", async () => {
  const { dom, home, index, main, randomEventStyles } = await readSources();
  const registration = extractBetween(
    main,
    'registerRandomEvent({\n  id: "neko-stream-system-alert"',
    '\n\nregisterRandomEvent({\n  id: "annoying-system-alert"'
  );

  assert.match(
    home,
    /id="neko-stream-alert-window"[\s\S]*?role="alertdialog"[\s\S]*?aria-modal="false"[\s\S]*?aria-labelledby="neko-stream-alert-title"[\s\S]*?aria-describedby="neko-stream-alert-message"/
  );
  assert.match(
    home,
    /id="neko-stream-alert-icon"[\s\S]*?src="assets\/neko-assets\/sprites\/sleep1\.png"[\s\S]*?alt=""/
  );
  assert.match(home, /<p id="neko-stream-alert-message">Trigger \/nekostream\?<\/p>/);
  assert.match(home, /<button type="button" id="neko-stream-alert-yes">Yes<\/button>/);
  assert.match(home, /<button type="button" id="neko-stream-alert-no">No<\/button>/);
  for (const binding of [
    "nekoStreamAlertWindow",
    "nekoStreamAlertIcon",
    "nekoStreamAlertYes",
    "nekoStreamAlertNo",
  ]) {
    assert.match(dom, new RegExp(`${binding}:`));
    assert.match(main, new RegExp(`\\b${binding}\\b`));
  }

  assert.match(
    randomEventStyles,
    /\.neko-stream-alert-message img \{\n  image-rendering: pixelated;\n  object-fit: contain;/
  );
  assert.match(
    randomEventStyles,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.neko-stream-alert-window\.is-opening,[\s\S]*?\.neko-stream-alert-window\.is-closing \{\n    animation: none;/
  );
  assert.match(
    home,
    /styles\/home\/random-events\.css\?v=lancer-result-click-20260808/
  );
  assert.match(
    index,
    /styles\/home\/random-events\.css\?v=lancer-result-click-20260808/
  );
  await Promise.all([
    readFile(new URL("assets/neko-assets/sprites/sleep1.png", root)),
    readFile(new URL("assets/neko-assets/sprites/sleep2.png", root)),
  ]);

  assert.match(registration, /id: "neko-stream-system-alert"/);
  assert.match(registration, /debug: true/);
  assert.match(registration, /probability: STANDARD_RANDOM_EVENT_PROBABILITY/);
  assert.match(registration, /probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES/);
  assert.match(registration, /kind: RANDOM_EVENT_KIND_INTERACTIVE/);
  assert.match(registration, /isVisible: isNekoStreamAlertVisible/);
  assert.match(
    registration,
    /canTrigger: \(\{ triggerName, debug \} = \{\}\) =>\n    !isNekoStreamAlertVisible\(\) && \(!debug \|\| triggerName === "startButton"\)/
  );
  assert.match(
    registration,
    /preloadTargets: \(\) => \[[\s\S]*?nekoStreamAlertWindow,[\s\S]*?NEKO_SPRITES\.sleep1,[\s\S]*?NEKO_SPRITES\.sleep2,/
  );
  assert.match(registration, /run: \(\) => \{\n    showNekoStreamAlert\(\);/);
  assert.match(main, /randomAlertWindow,\n    debugSystemAlertWindow,\n    nekoStreamAlertWindow,/);
  assert.match(main, /}, NEKO_SLEEP_FRAME_INTERVAL_MS\);/);
  assert.match(
    main,
    /nekoStreamAlertReducedMotionQuery\.addEventListener\(\n    "change",\n    handleNekoStreamAlertMotionPreferenceChange\n  \);[\s\S]*?nekoStreamAlertReducedMotionQuery\?\.addListener\?\.\(/
  );
  assert.match(
    main,
    /const wasClosing = nekoStreamAlertWindow\.classList\.contains\("is-closing"\);[\s\S]*?classList\.remove\("is-opening"\);[\s\S]*?if \(!wasClosing\) return;[\s\S]*?classList\.remove\("is-closing"\);[\s\S]*?classList\.add\("is-hidden"\);[\s\S]*?resetNekoStreamAlert\(\);/
  );
  assert.match(
    main,
    /if \(prefersReducedNekoStreamAlertMotion\(\)\) \{\n    nekoStreamAlertWindow\.classList\.remove\("is-opening", "is-closing"\);\n    nekoStreamAlertWindow\.classList\.add\("is-hidden"\);\n    resetNekoStreamAlert\(\);/
  );
  assert.match(
    main,
    /if \(!nekoStreamAlertResponsePending \|\| !isNekoStreamAlertVisible\(\)\) return false;[\s\S]*?nekoStreamAlertResponsePending = false;[\s\S]*?closeManagedRandomEventWindow\(nekoStreamAlertWindow\);[\s\S]*?if \(shouldStartStream\) startNekoStream\(\);/
  );
  assert.match(main, /bindRandomEventButton\(nekoStreamAlertYes, \(\) => respondToNekoStreamAlert\(true\)\)/);
  assert.match(main, /bindRandomEventButton\(nekoStreamAlertNo, \(\) => respondToNekoStreamAlert\(false\)\)/);
});

test("Neko stream plans exactly forty bounded, chronologically scheduled cats", async () => {
  const planner = await loadPlanner();
  const { constants } = planner;
  assert.equal(constants.count, 40);
  assert.equal(constants.fallbackTaskbarHeight, 52);
  assert.equal(constants.spawnWindow, 10_000);
  assert.equal(constants.minSpeed, 0.8);
  assert.equal(constants.maxSpeed, 1.7);
  assert.equal(constants.actionChance, 0.25);
  assert.equal(constants.opaqueBottomRatio, 30 / 32);
  assert.equal(constants.nonSleepActionMin, 5_000);
  assert.equal(constants.nonSleepActionMax, 10_000);
  assert.equal(constants.cleanSitPhase, 1_000);
  assert.equal(constants.cleanWashPhase, 2_000);
  assert.equal(constants.cleanCycle, 3_000);
  assert.equal(constants.yawnActionDuration, 3_000);
  assert.equal(constants.sleepActionDuration, 20_000);
  assert.equal(constants.sleepOverlap, 1);
  assert.equal(constants.sourceSize, 32);
  assert.equal(constants.offscreenMargin, 84);

  let seed = 0x5eed1234;
  const random = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const plan = planner.createPlan({ random });
  assert.equal(plan.length, 40);
  for (let index = 0; index < plan.length; index += 1) {
    const cat = plan[index];
    const slotStartMs = index * 250;
    const slotEndMs = slotStartMs + 250;
    assert.equal(cat.id, index);
    assert.ok(cat.spawnDelayMs >= slotStartMs && cat.spawnDelayMs < slotEndMs);
    assert.ok(cat.initialSpeedMultiplier >= 0.8 && cat.initialSpeedMultiplier <= 1.7);
    assert.equal(cat.initialDirection, cat.entrySide === "left" ? 1 : -1);
    if (index > 0) assert.ok(plan[index - 1].spawnDelayMs <= cat.spawnDelayMs);
    if (cat.action) {
      assert.ok(cat.actionTriggerProgress >= 0.2 && cat.actionTriggerProgress <= 0.8);
      assert.equal(cat.postActionDirection, null);
      assert.equal(cat.postActionSpeedMultiplier, null);
      if (cat.action.name === "sleep") {
        assert.equal(cat.actionDurationMs, 20_000);
      } else if (cat.action.name === "yawn") {
        assert.equal(cat.actionDurationMs, 3_000);
      } else {
        assert.ok(cat.actionDurationMs >= 5_000 && cat.actionDurationMs <= 10_000);
      }
    } else {
      assert.equal(cat.actionDurationMs, null);
    }
  }

  const minimumPlan = planner.createPlan({ count: 1, random: () => 0 })[0];
  assert.equal(minimumPlan.spawnDelayMs, 0);
  assert.equal(minimumPlan.entrySide, "left");
  assert.equal(minimumPlan.initialDirection, 1);
  assert.equal(minimumPlan.initialSpeedMultiplier, 0.8);

  const maximumPlan = planner.createPlan({ count: 1, random: () => 1 })[0];
  assert.ok(maximumPlan.spawnDelayMs < 10_000);
  assert.equal(maximumPlan.entrySide, "right");
  assert.equal(maximumPlan.initialDirection, -1);
  assert.equal(maximumPlan.initialSpeedMultiplier, 1.7);
  assert.equal(maximumPlan.action, null);
  assert.equal(maximumPlan.actionDurationMs, null);

  const earliestPlan = planner.createPlan({ count: 40, random: () => 0 });
  const latestPlan = planner.createPlan({ count: 40, random: () => 1 });
  earliestPlan.forEach((cat, index) => assert.equal(cat.spawnDelayMs, index * 250));
  latestPlan.forEach((cat, index) => {
    assert.ok(cat.spawnDelayMs >= index * 250);
    assert.ok(cat.spawnDelayMs < (index + 1) * 250);
  });

  for (let index = 1; index < plan.length; index += 1) {
    assert.ok(plan[index].spawnDelayMs - plan[index - 1].spawnDelayMs < 500);
  }

  let secondSeed = 0xcade1234;
  const secondPlan = planner.createPlan({
    random: () => {
      secondSeed = (secondSeed * 1_664_525 + 1_013_904_223) >>> 0;
      return secondSeed / 0x1_0000_0000;
    },
  });
  assert.notDeepEqual(
    plan.map(({ spawnDelayMs }) => spawnDelayMs),
    secondPlan.map(({ spawnDelayMs }) => spawnDelayMs)
  );
});

test("the action gate, five actions, visible trigger, and action durations are deterministic", async () => {
  const planner = await loadPlanner();
  const blockedAtBoundary = planner.createPlan({
    count: 1,
    random: sequenceRandom([0, 0, 0, 0.25]),
  })[0];
  assert.equal(blockedAtBoundary.action, null, "A 0.25 roll must not pass a 25% gate");

  const actionCases = [
    [0, "sit"],
    [0.2 - Number.EPSILON, "sit"],
    [0.2, "scratch"],
    [0.4 - Number.EPSILON, "scratch"],
    [0.4, "clean"],
    [0.6 - Number.EPSILON, "clean"],
    [0.6, "yawn"],
    [0.8 - Number.EPSILON, "yawn"],
    [0.8, "sleep"],
    [1, "sleep"],
  ];
  for (const [roll, expectedName] of actionCases) {
    const plan = createActionPlan(planner, roll);
    assert.equal(plan.action.name, expectedName);
    assert.equal(plan.actionTriggerProgress, 0.5);
    assert.equal(plan.postActionDirection, null);
    assert.equal(plan.postActionSpeedMultiplier, null);
    const expectedDuration =
      expectedName === "sleep" ? 20_000 : expectedName === "yawn" ? 3_000 : 7_500;
    assert.equal(plan.actionDurationMs, expectedDuration);
  }

  for (const actionTypeRoll of [0, 0.2, 0.4]) {
    assert.equal(
      createActionPlan(planner, actionTypeRoll, { actionDurationRoll: 0 })
        .actionDurationMs,
      5_000
    );
    assert.equal(
      createActionPlan(planner, actionTypeRoll, { actionDurationRoll: 1 })
        .actionDurationMs,
      10_000
    );
  }

  assert.equal(createActionPlan(planner, 0.6).actionDurationMs, 3_000);
  assert.equal(createActionPlan(planner, 0.8).actionDurationMs, 20_000);
});

test("stream actions and movement reuse canonical Neko timing and cleanup contracts", async () => {
  const { main } = await readSources();
  const planner = await loadPlanner();
  const actionNames = Array.from(planner.actions, ({ name }) => name);
  assert.deepEqual(actionNames, ["sit", "scratch", "clean", "yawn", "sleep"]);

  assert.match(main, /name: "sit",\s*frames: NEKO_AWAKE_ACTION\.frames/);
  assert.match(main, /name: "scratch",\s*frames: NEKO_SCRATCH_SELF_ACTION\.frames/);
  assert.match(
    main,
    /name: "clean",\s*frames: Object\.freeze\(\[NEKO_AWAKE_ACTION\.frames\[0\], NEKO_WASH_ACTION\.frames\[0\]\]\)/
  );
  assert.match(
    main,
    /name: "yawn",\s*frames: NEKO_YAWN_ACTION\.frames,\s*fixedDurationMs: NEKO_STREAM_YAWN_ACTION_DURATION_MS/
  );
  assert.match(
    main,
    /action\.name === "sleep"\s*\? NEKO_NAP_FRAME_SWITCH_FRAMES \* NEKO_FRAME_INTERVAL_MS/
  );
  assert.match(main, /elapsedMs >= cat\.actionDurationMs/);
  assert.match(
    main,
    /Math\.floor\(safeElapsedMs \/ frameIntervalMs\) % action\.frames\.length/
  );
  assert.doesNotMatch(main, /sleepDurationMs/);
  assert.match(
    main,
    /cat\.direction \*\s*NEKO_SPEED \*\s*cat\.speedMultiplier \*\s*\(deltaMs \/ NEKO_FRAME_INTERVAL_MS\)/
  );
  assert.match(main, /!cat\.actionCompleted &&\s*cat\.actionStartedAt === null/);
  assert.match(main, /cat\.actionCount \+= 1/);
  assert.match(
    main,
    /cat\.postActionDirection \?\? \(sampleNekoStreamRoll\(\) < 0\.5 \? -1 : 1\)/
  );
  assert.match(
    main,
    /cat\.postActionSpeedMultiplier \?\?[\s\S]*?sampleNekoStreamRange\([\s\S]*?NEKO_STREAM_MIN_SPEED_MULTIPLIER,[\s\S]*?NEKO_STREAM_MAX_SPEED_MULTIPLIER/
  );
  assert.match(main, /const nekoStreamCats = new Map\(\)/);
  assert.match(main, /const nekoStreamSpawnTimerIds = new Set\(\)/);
  assert.match(
    main,
    /nekoStreamCats\.forEach\(\(cat\) => \{\s*if \(isNekoStreamOutsideViewport\(cat\.x, viewportWidth\)\) \{\s*removeNekoStreamCat\(cat\);\s*return;\s*\}\s*if \(cat\.mode === "running"\)/
  );
  assert.match(main, /window\.addEventListener\("pagehide", stopNekoStream\)/);

  assert.equal(planner.spriteName(planner.actions[2], 0), "awake");
  assert.equal(planner.spriteName(planner.actions[2], 999), "awake");
  assert.equal(planner.spriteName(planner.actions[2], 1_000), "wash1");
  assert.equal(planner.spriteName(planner.actions[2], 2_999), "wash1");
  assert.equal(planner.spriteName(planner.actions[2], 3_000), "awake");
  assert.equal(planner.spriteName(planner.actions[2], 3_999), "awake");
  assert.equal(planner.spriteName(planner.actions[2], 4_000), "wash1");

  assert.equal(planner.spriteName(planner.actions[3], 0), "yawn1");
  assert.equal(planner.spriteName(planner.actions[3], 749), "yawn1");
  assert.equal(planner.spriteName(planner.actions[3], 750), "yawn2");
  assert.equal(planner.spriteName(planner.actions[3], 2_249), "yawn2");
  assert.equal(planner.spriteName(planner.actions[3], 2_250), "yawn1");
  assert.equal(planner.spriteName(planner.actions[3], 2_999), "yawn1");

  assert.equal(planner.spriteName(planner.actions[4], 0), "sleep1");
  assert.equal(planner.spriteName(planner.actions[4], 799), "sleep1");
  assert.equal(planner.spriteName(planner.actions[4], 800), "sleep2");
  assert.equal(planner.spriteName(planner.actions[4], 1_599), "sleep2");
  assert.equal(planner.spriteName(planner.actions[4], 1_600), "sleep1");

  assert.equal(planner.poseOffset("left1"), 3.9375);
  assert.equal(planner.poseOffset("right1"), 3.9375);
  assert.equal(planner.poseOffset("left2"), 5.25);
  assert.equal(planner.poseOffset("right2"), 5.25);
  for (const sprite of [
    "awake",
    "scratch1",
    "scratch2",
    "wash1",
    "yawn1",
    "yawn2",
  ]) {
    assert.equal(planner.poseOffset(sprite), 1.3125, sprite);
  }
  assert.equal(planner.poseOffset("sleep1"), 1);
  assert.equal(planner.poseOffset("sleep2"), 1);
  assert.match(
    main,
    /cat\.element\.style\.setProperty\(\n    "--neko-stream-pose-offset-y",\n    `\$\{getNekoStreamPoseOffsetY\(resolvedSpriteName\)\}px`\n  \);/
  );

  assert.equal(planner.isOutside(-84, 1280), false);
  assert.equal(planner.isOutside(1280 + 84, 1280), false);
  assert.equal(planner.isOutside(-84.001, 1280), true);
  assert.equal(planner.isOutside(1280 + 84.001, 1280), true);
});
