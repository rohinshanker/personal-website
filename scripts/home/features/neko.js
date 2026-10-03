(() => {
const {
  all,
  byId,
  taskbar,
} = window.homeDom;
const {
  GAME_STATS_ROHIN_NEKO_AVATAR_ICON,
  GAME_STATS_ROHIN_NEKO_PROFILE,
  getGameStatsProfile,
  registerGameStatsAvatarAnimator,
} = window.homeGameStats;
const {
  clampNumber,
  prefersReducedMotion,
} = window.homeUtil;
const {
  runAfterHomeActivation,
} = window.homeActivation;
const {
  registerViewportObserver,
  registerWindowLifecycle,
} = window.homeWindows;

const nekoLaunchers = all('[data-app="neko"]');
const nekoContextMenu = byId("neko-context-menu");
const nekoStreamCommand = byId("neko-stream-command");
const nekoStreamLayer = byId("neko-stream-layer");

const NEKO_RANDOM_EVENT_PROBABILITY_BONUS = 0.075;

const isNekoRandomEventBoostActive = () =>
  Boolean(document.querySelector("[data-neko-taskbar-icon].is-neko-active"));

const NEKO_SPRITE_BASE = "assets/neko-assets/sprites";

const NEKO_SPRITES = {
  sleep1: `${NEKO_SPRITE_BASE}/sleep1.png`,
  sleep2: `${NEKO_SPRITE_BASE}/sleep2.png`,
  awake: `${NEKO_SPRITE_BASE}/awake.png`,
  yawn1: `${NEKO_SPRITE_BASE}/yawn1.png`,
  yawn2: `${NEKO_SPRITE_BASE}/yawn2.png`,
  wash1: `${NEKO_SPRITE_BASE}/wash1.png`,
  scratch1: `${NEKO_SPRITE_BASE}/scratch1.png`,
  scratch2: `${NEKO_SPRITE_BASE}/scratch2.png`,
  up1: `${NEKO_SPRITE_BASE}/up1.png`,
  up2: `${NEKO_SPRITE_BASE}/up2.png`,
  upright1: `${NEKO_SPRITE_BASE}/upright1.png`,
  upright2: `${NEKO_SPRITE_BASE}/upright2.png`,
  right1: `${NEKO_SPRITE_BASE}/right1.png`,
  right2: `${NEKO_SPRITE_BASE}/right2.png`,
  downright1: `${NEKO_SPRITE_BASE}/downright1.png`,
  downright2: `${NEKO_SPRITE_BASE}/downright2.png`,
  down1: `${NEKO_SPRITE_BASE}/down1.png`,
  down2: `${NEKO_SPRITE_BASE}/down2.png`,
  downleft1: `${NEKO_SPRITE_BASE}/downleft1.png`,
  downleft2: `${NEKO_SPRITE_BASE}/downleft2.png`,
  left1: `${NEKO_SPRITE_BASE}/left1.png`,
  left2: `${NEKO_SPRITE_BASE}/left2.png`,
  upleft1: `${NEKO_SPRITE_BASE}/upleft1.png`,
  upleft2: `${NEKO_SPRITE_BASE}/upleft2.png`,
  upclaw1: `${NEKO_SPRITE_BASE}/upclaw1.png`,
  upclaw2: `${NEKO_SPRITE_BASE}/upclaw2.png`,
  rightclaw1: `${NEKO_SPRITE_BASE}/rightclaw1.png`,
  rightclaw2: `${NEKO_SPRITE_BASE}/rightclaw2.png`,
  downclaw1: `${NEKO_SPRITE_BASE}/downclaw1.png`,
  downclaw2: `${NEKO_SPRITE_BASE}/downclaw2.png`,
  leftclaw1: `${NEKO_SPRITE_BASE}/leftclaw1.png`,
  leftclaw2: `${NEKO_SPRITE_BASE}/leftclaw2.png`,
};

const NEKO_RUN_SPRITES = {
  up: ["up1", "up2"],
  upright: ["upright1", "upright2"],
  right: ["right1", "right2"],
  downright: ["downright1", "downright2"],
  down: ["down1", "down2"],
  downleft: ["downleft1", "downleft2"],
  left: ["left1", "left2"],
  upleft: ["upleft1", "upleft2"],
};

const NEKO_FOOTPRINT_SPRITES = {
  up: `${NEKO_SPRITE_BASE}/fp_up.png`,
  upright: `${NEKO_SPRITE_BASE}/fp_upright.png`,
  right: `${NEKO_SPRITE_BASE}/fp_right.png`,
  downright: `${NEKO_SPRITE_BASE}/fp_downright.png`,
  down: `${NEKO_SPRITE_BASE}/fp_down.png`,
  downleft: `${NEKO_SPRITE_BASE}/fp_downleft.png`,
  left: `${NEKO_SPRITE_BASE}/fp_left.png`,
  upleft: `${NEKO_SPRITE_BASE}/fp_upleft.png`,
};

const NEKO_FOOTPRINT_VISIBLE_OFFSETS = {
  up: { x: 0, y: 10.5 },
  upright: { x: -12, y: 11 },
  right: { x: -11.5, y: -1 },
  downright: { x: -12, y: -12 },
  down: { x: 0, y: -11.5 },
  downleft: { x: 11, y: -12 },
  left: { x: 10.5, y: 0 },
  upleft: { x: 11, y: 11 },
};

const NEKO_SCRATCH_SPRITES = {
  top: ["upclaw1", "upclaw2"],
  right: ["rightclaw1", "rightclaw2"],
  bottom: ["downclaw1", "downclaw2"],
  left: ["leftclaw1", "leftclaw2"],
};

const ROHIN_NEKO_AVATAR_INITIAL_DELAY_MIN_MS = 1000;

const ROHIN_NEKO_AVATAR_INITIAL_DELAY_MAX_MS = 3000;

const ROHIN_NEKO_AVATAR_ACTION_DELAY_MIN_MS = 4000;

const ROHIN_NEKO_AVATAR_ACTION_DELAY_MAX_MS = 8000;

const ROHIN_NEKO_AVATAR_SLEEP_CHANCE = 0.3;

const ROHIN_NEKO_AVATAR_SCRATCH_THRESHOLD = 0.5;

const ROHIN_NEKO_AVATAR_CLAW_THRESHOLD = 0.65;

const ROHIN_NEKO_AVATAR_CLAW_DIRECTIONS = Object.freeze(["left", "right"]);

const rohinNekoAvatarInstances = new Map();

let rohinNekoAvatarObserver = null;

const isRohinNekoProfile = () => {
  const gameStatsProfile = getGameStatsProfile();
  return (
  gameStatsProfile?.id === GAME_STATS_ROHIN_NEKO_PROFILE.id &&
  gameStatsProfile.icon === GAME_STATS_ROHIN_NEKO_AVATAR_ICON
  );
};

const isRohinNekoAvatarVisible = (image) =>
  image.isConnected && !image.closest(".is-hidden, [hidden]");

const setRohinNekoAvatarSprite = (instance, spriteName) => {
  const source = NEKO_SPRITES[spriteName] || NEKO_SPRITES.yawn1;
  if (instance.image.getAttribute("src") !== source) instance.image.src = source;
};

const clearRohinNekoAvatarInstanceTimers = (instance) => {
  if (instance.nextActionTimerId !== null) {
    window.clearTimeout(instance.nextActionTimerId);
  }
  if (instance.frameTimerId !== null) window.clearTimeout(instance.frameTimerId);
  if (instance.sleepTimerId !== null) window.clearInterval(instance.sleepTimerId);
  instance.nextActionTimerId = null;
  instance.frameTimerId = null;
  instance.sleepTimerId = null;
};

const removeRohinNekoAvatarInstance = (image) => {
  const instance = rohinNekoAvatarInstances.get(image);
  if (!instance) return;
  clearRohinNekoAvatarInstanceTimers(instance);
  rohinNekoAvatarInstances.delete(image);
};

const randomRohinNekoAvatarDelay = (minimum, maximum) =>
  minimum + Math.floor(Math.random() * (maximum - minimum + 1));

const getRohinNekoAvatarAction = () => {
  const roll = Math.random();
  if (roll < ROHIN_NEKO_AVATAR_SCRATCH_THRESHOLD) {
    return { name: "scratch", frames: NEKO_SCRATCH_SELF_ACTION.frames };
  }
  if (roll < ROHIN_NEKO_AVATAR_CLAW_THRESHOLD) {
    const directionIndex = Math.min(
      ROHIN_NEKO_AVATAR_CLAW_DIRECTIONS.length - 1,
      Math.floor(Math.random() * ROHIN_NEKO_AVATAR_CLAW_DIRECTIONS.length)
    );
    const direction = ROHIN_NEKO_AVATAR_CLAW_DIRECTIONS[directionIndex];
    const [firstFrame, secondFrame] = NEKO_SCRATCH_SPRITES[direction];
    return {
      name: `claw-${direction}`,
      frames: [
        firstFrame,
        secondFrame,
        firstFrame,
        secondFrame,
        firstFrame,
        secondFrame,
      ],
    };
  }
  return { name: "yawn", frames: NEKO_YAWN_ACTION.frames };
};

const canAnimateRohinNekoAvatarInstance = (instance) =>
  isRohinNekoProfile() &&
  isRohinNekoAvatarVisible(instance.image) &&
  !prefersReducedMotion();

const scheduleRohinNekoAvatarAction = (instance, { initial = false } = {}) => {
  if (!canAnimateRohinNekoAvatarInstance(instance)) {
    removeRohinNekoAvatarInstance(instance.image);
    return;
  }
  const [minimumDelay, maximumDelay] = initial
    ? [ROHIN_NEKO_AVATAR_INITIAL_DELAY_MIN_MS, ROHIN_NEKO_AVATAR_INITIAL_DELAY_MAX_MS]
    : [ROHIN_NEKO_AVATAR_ACTION_DELAY_MIN_MS, ROHIN_NEKO_AVATAR_ACTION_DELAY_MAX_MS];
  instance.nextActionTimerId = window.setTimeout(() => {
    instance.nextActionTimerId = null;
    if (!canAnimateRohinNekoAvatarInstance(instance)) {
      removeRohinNekoAvatarInstance(instance.image);
      return;
    }

    const action = getRohinNekoAvatarAction();
    let frameIndex = 0;
    const playNextFrame = () => {
      if (!canAnimateRohinNekoAvatarInstance(instance)) {
        removeRohinNekoAvatarInstance(instance.image);
        return;
      }
      setRohinNekoAvatarSprite(instance, action.frames[frameIndex]);
      frameIndex += 1;
      if (frameIndex < action.frames.length) {
        instance.frameTimerId = window.setTimeout(playNextFrame, NEKO_FRAME_INTERVAL_MS);
        return;
      }
      instance.frameTimerId = window.setTimeout(() => {
        instance.frameTimerId = null;
        if (!canAnimateRohinNekoAvatarInstance(instance)) {
          removeRohinNekoAvatarInstance(instance.image);
          return;
        }
        setRohinNekoAvatarSprite(instance, "yawn1");
        scheduleRohinNekoAvatarAction(instance);
      }, NEKO_FRAME_INTERVAL_MS);
    };
    playNextFrame();
  }, randomRohinNekoAvatarDelay(minimumDelay, maximumDelay));
};

const createRohinNekoAvatarInstance = (image) => {
  if (rohinNekoAvatarInstances.has(image)) return;
  const instance = {
    image,
    nextActionTimerId: null,
    frameTimerId: null,
    sleepTimerId: null,
  };
  rohinNekoAvatarInstances.set(image, instance);
  if (Math.random() < ROHIN_NEKO_AVATAR_SLEEP_CHANCE) {
    let sleepFrame = 0;
    setRohinNekoAvatarSprite(instance, "sleep1");
    instance.sleepTimerId = window.setInterval(() => {
      if (!canAnimateRohinNekoAvatarInstance(instance)) {
        removeRohinNekoAvatarInstance(image);
        return;
      }
      sleepFrame += 1;
      setRohinNekoAvatarSprite(instance, sleepFrame % 2 === 0 ? "sleep1" : "sleep2");
    }, NEKO_NAP_FRAME_SWITCH_FRAMES * NEKO_FRAME_INTERVAL_MS);
    return;
  }
  setRohinNekoAvatarSprite(instance, "yawn1");
  scheduleRohinNekoAvatarAction(instance, { initial: true });
};

const syncRohinNekoAvatarInstances = () => {
  if (!isRohinNekoProfile()) return;
  rohinNekoAvatarInstances.forEach((instance, image) => {
    if (!isRohinNekoAvatarVisible(image)) removeRohinNekoAvatarInstance(image);
  });
  document.querySelectorAll("img[data-rohin-neko-avatar]").forEach((image) => {
    if (isRohinNekoAvatarVisible(image)) createRohinNekoAvatarInstance(image);
  });
};

const stopRohinNekoAvatarAnimation = () => {
  rohinNekoAvatarObserver?.disconnect();
  rohinNekoAvatarObserver = null;
  rohinNekoAvatarInstances.forEach((instance) => clearRohinNekoAvatarInstanceTimers(instance));
  rohinNekoAvatarInstances.clear();
  document.querySelectorAll("img[data-rohin-neko-avatar]").forEach((image) => {
    if (image.getAttribute("src") !== NEKO_SPRITES.yawn1) image.src = NEKO_SPRITES.yawn1;
  });
};

const startRohinNekoAvatarAnimation = () => {
  if (!isRohinNekoProfile() || prefersReducedMotion()) {
    stopRohinNekoAvatarAnimation();
    return;
  }
  if (!rohinNekoAvatarObserver) {
    rohinNekoAvatarObserver = new MutationObserver(() => {
      syncRohinNekoAvatarInstances();
    });
    rohinNekoAvatarObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "hidden"],
      childList: true,
      subtree: true,
    });
  }
  syncRohinNekoAvatarInstances();
};

const NEKO_TASKBAR_WAKE_ICON = NEKO_SPRITES.awake;

const NEKO_TASKBAR_SLEEP_ICON = NEKO_SPRITES.sleep1;

const NEKO_SCRATCH_SELF_ACTION = {
  name: "scratchSelf",
  frames: ["scratch1", "scratch2", "scratch1", "scratch2", "scratch1", "scratch2"],
};

const NEKO_YAWN_ACTION = {
  name: "yawn",
  frames: ["yawn1", "yawn2", "yawn2", "yawn1"],
};

const NEKO_WASH_ACTION = {
  name: "wash",
  frames: ["wash1", "wash1", "wash1", "wash1", "wash1", "wash1"],
};

const NEKO_AWAKE_ACTION = {
  name: "awake",
  frames: ["awake", "awake", "awake"],
};

const NEKO_IDLE_ACTIONS = [NEKO_SCRATCH_SELF_ACTION, NEKO_YAWN_ACTION, NEKO_WASH_ACTION];

const NEKO_MANUAL_ACTIONS = [
  NEKO_SCRATCH_SELF_ACTION,
  NEKO_YAWN_ACTION,
  NEKO_WASH_ACTION,
  NEKO_AWAKE_ACTION,
];

const NEKO_WAKE_SEQUENCE = [
  { sprite: "awake", duration: 500 },
  { sprite: "yawn1", duration: 450 },
  { sprite: "yawn2", duration: 900, waitForRunAssets: true },
  { sprite: "wash1", duration: 900 },
];

const NEKO_FRAME_INTERVAL_MS = 100;

const NEKO_SLEEP_FRAME_INTERVAL_MS = 850;

const NEKO_NAP_FRAME_SWITCH_FRAMES = 8;

const NEKO_SPEED = 10;

const NEKO_IDLE_DISTANCE = 48;

const NEKO_SPRITE_SIZE = 42;

const NEKO_VERTICAL_OFFSET = 10;

const NEKO_EDGE_SCRATCH_DISTANCE = 4;

const NEKO_EDGE_POINTER_HOTZONE = 2;

const NEKO_IDLE_ACTION_COOLDOWN_FRAMES = 14;

const NEKO_IDLE_ACTION_DELAY_MS = 1000;

const NEKO_MOUSE_STILL_SLEEP_MS = 5000;

const NEKO_EDGE_SCRATCH_SLEEP_MS = 4000;

const NEKO_RETURN_HOME_DISTANCE = 6;

const NEKO_FOOTPRINT_TTL_MS = 3000;

const NEKO_FOOTPRINT_MAX = 10;

const NEKO_FOOTPRINT_SPACING = 30;

const NEKO_FOOTPRINT_BACK_OFFSET = 12;

const NEKO_FOOTPRINT_SIDE_OFFSET = 6;

const NEKO_FOOTPRINT_STAGGER = 5;

let nekoState = "sleeping";

let desktopNekoCat = null;

let nekoAnimationFrameId = null;

let nekoLastFrameTimestamp = 0;

let nekoFrameCount = 0;

let nekoSleepTimerId = null;

let nekoSleepFrame = 0;

let nekoWakeTimerId = null;

let nekoPosX = 32;

let nekoPosY = 32;

let nekoMouseX = window.innerWidth / 2;

let nekoMouseY = window.innerHeight / 2;

let nekoMouseOutsideWindow = false;

let nekoScratchEdge = null;

let nekoScratchTargetX = null;

let nekoScratchTargetY = null;

let nekoIdleAction = null;

let nekoIdleActionFrame = 0;

let nekoIdleActionCooldownFrames = 0;

let nekoIdleStartedAt = 0;

let nekoPlayedIdleActionForCurrentIdle = false;

let nekoLastMouseMoveAt = performance.now();

let nekoEdgeScratchStartedAt = 0;

let nekoIsNapping = false;

let nekoNapFrame = 0;

let nekoReturnX = 32;

let nekoReturnY = 32;

let nekoFootprints = [];

let nekoLastFootprintX = null;

let nekoLastFootprintY = null;

let nekoNextFootprintSide = 1;

let nekoRunAssetsPreloadStarted = false;

let nekoRunAssetsLoaded = false;

let nekoRunAssetsPreloadPromise = null;

const nekoPreloadedRunAssetImages = [];

const preloadNekoRunAssets = () => {
  if (nekoRunAssetsPreloadStarted) return nekoRunAssetsPreloadPromise;
  nekoRunAssetsPreloadStarted = true;
  const assetUrls = new Set([
    ...Object.values(NEKO_SPRITES),
    ...Object.values(NEKO_FOOTPRINT_SPRITES),
  ]);

  nekoRunAssetsPreloadPromise = Promise.all(
    Array.from(assetUrls, (src) =>
      new Promise((resolve) => {
        const image = new Image();
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        image.decoding = "async";
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        image.src = src;
        if (image.complete) finish();
        nekoPreloadedRunAssetImages.push(image);
      })
    )
  ).then(() => {
    nekoRunAssetsLoaded = true;
  });

  return nekoRunAssetsPreloadPromise;
};

const NEKO_STREAM_COUNT = 40;

const NEKO_STREAM_SPAWN_WINDOW_MS = 10_000;

const NEKO_STREAM_MIN_SPEED_MULTIPLIER = 0.8;

const NEKO_STREAM_MAX_SPEED_MULTIPLIER = 1.7;

const NEKO_STREAM_ACTION_CHANCE = 0.25;

const NEKO_STREAM_ACTION_PROGRESS_MIN = 0.2;

const NEKO_STREAM_ACTION_PROGRESS_MAX = 0.8;

const NEKO_STREAM_NON_SLEEP_ACTION_MIN_MS = 5_000;

const NEKO_STREAM_NON_SLEEP_ACTION_MAX_MS = 10_000;

const NEKO_STREAM_YAWN_ACTION_DURATION_MS = 3_000;

const NEKO_STREAM_SLEEP_ACTION_DURATION_MS = 20_000;

const NEKO_STREAM_CLEAN_SIT_PHASE_MS = 1_000;

const NEKO_STREAM_CLEAN_WASH_PHASE_MS = 2_000;

const NEKO_STREAM_CLEAN_CYCLE_MS =
  NEKO_STREAM_CLEAN_SIT_PHASE_MS + NEKO_STREAM_CLEAN_WASH_PHASE_MS;

const NEKO_STREAM_OFFSCREEN_MARGIN = NEKO_SPRITE_SIZE * 2;

const NEKO_STREAM_SOURCE_SIZE_PX = 32;

const NEKO_STREAM_BASE_OPAQUE_HEIGHT_PX = 30;

const NEKO_STREAM_MAX_OPAQUE_BOTTOM_RATIO =
  NEKO_STREAM_BASE_OPAQUE_HEIGHT_PX / NEKO_STREAM_SOURCE_SIZE_PX;

const NEKO_STREAM_SLEEP_OVERLAP_PX = 1;

const NEKO_STREAM_FALLBACK_TASKBAR_HEIGHT_PX = 52;

const NEKO_CONTEXT_MENU_PADDING = 6;

const NEKO_STREAM_OPAQUE_HEIGHT_BY_SPRITE = Object.freeze({
  left1: 27,
  left2: 26,
  right1: 27,
  right2: 26,
  awake: 29,
  scratch1: 29,
  scratch2: 29,
  wash1: 29,
  yawn1: 29,
  yawn2: 29,
  sleep1: 30,
  sleep2: 30,
});

const NEKO_STREAM_ACTIONS = Object.freeze([
  Object.freeze({
    name: "sit",
    frames: NEKO_AWAKE_ACTION.frames,
  }),
  Object.freeze({
    name: "scratch",
    frames: NEKO_SCRATCH_SELF_ACTION.frames,
  }),
  Object.freeze({
    name: "clean",
    frames: Object.freeze([NEKO_AWAKE_ACTION.frames[0], NEKO_WASH_ACTION.frames[0]]),
  }),
  Object.freeze({
    name: "yawn",
    frames: NEKO_YAWN_ACTION.frames,
    fixedDurationMs: NEKO_STREAM_YAWN_ACTION_DURATION_MS,
  }),
  Object.freeze({
    name: "sleep",
    frames: Object.freeze(["sleep1", "sleep2"]),
    fixedDurationMs: NEKO_STREAM_SLEEP_ACTION_DURATION_MS,
  }),
]);

const nekoStreamCats = new Map();

const nekoStreamSpawnTimerIds = new Set();

let nekoStreamAnimationFrameId = null;

let nekoStreamLastFrameTimestamp = 0;

let nekoStreamGeneration = 0;

let nekoStreamSpawnedCount = 0;

let nekoStreamPlannedCount = 0;

let nekoContextMenuOrigin = null;

const sampleNekoStreamRoll = (random = Math.random) => {
  const value = Number(random());
  if (!Number.isFinite(value)) return 0;
  return clampNumber(value, 0, 1);
};

const sampleNekoStreamRange = (minimum, maximum, random = Math.random) =>
  Math.min(maximum, minimum + sampleNekoStreamRoll(random) * (maximum - minimum));

const sampleNekoStreamIndex = (length, random = Math.random) =>
  Math.min(length - 1, Math.floor(sampleNekoStreamRoll(random) * length));

const sampleNekoStreamSpawnSlotRoll = (random = Math.random) =>
  Math.min(sampleNekoStreamRoll(random), 1 - 1e-9);

const createNekoStreamPlan = ({
  count = NEKO_STREAM_COUNT,
  durationMs = NEKO_STREAM_SPAWN_WINDOW_MS,
  random = Math.random,
} = {}) => {
  const spawnSlotDurationMs = count > 0 ? durationMs / count : 0;
  const plans = Array.from({ length: count }, (_, id) => {
    const spawnSlotStartMs = id * spawnSlotDurationMs;
    const spawnDelayMs =
      spawnSlotStartMs + sampleNekoStreamSpawnSlotRoll(random) * spawnSlotDurationMs;
    const entrySide = sampleNekoStreamRoll(random) < 0.5 ? "left" : "right";
    const initialDirection = entrySide === "left" ? 1 : -1;
    const initialSpeedMultiplier = sampleNekoStreamRange(
      NEKO_STREAM_MIN_SPEED_MULTIPLIER,
      NEKO_STREAM_MAX_SPEED_MULTIPLIER,
      random
    );
    const action =
      sampleNekoStreamRoll(random) < NEKO_STREAM_ACTION_CHANCE
        ? NEKO_STREAM_ACTIONS[sampleNekoStreamIndex(NEKO_STREAM_ACTIONS.length, random)]
        : null;

    if (!action) {
      return Object.freeze({
        id,
        spawnDelayMs,
        entrySide,
        initialDirection,
        initialSpeedMultiplier,
        action: null,
        actionTriggerProgress: null,
        actionDurationMs: null,
        postActionDirection: null,
        postActionSpeedMultiplier: null,
      });
    }

    return Object.freeze({
      id,
      spawnDelayMs,
      entrySide,
      initialDirection,
      initialSpeedMultiplier,
      action,
      actionTriggerProgress: sampleNekoStreamRange(
        NEKO_STREAM_ACTION_PROGRESS_MIN,
        NEKO_STREAM_ACTION_PROGRESS_MAX,
        random
      ),
      actionDurationMs:
        action.fixedDurationMs ??
        sampleNekoStreamRange(
          NEKO_STREAM_NON_SLEEP_ACTION_MIN_MS,
          NEKO_STREAM_NON_SLEEP_ACTION_MAX_MS,
          random
        ),
      postActionDirection: null,
      postActionSpeedMultiplier: null,
    });
  });

  return Object.freeze(plans.sort((first, second) => first.spawnDelayMs - second.spawnDelayMs));
};

const isNekoStreamOutsideViewport = (
  x,
  viewportWidth,
  margin = NEKO_STREAM_OFFSCREEN_MARGIN
) => x < -margin || x > viewportWidth + margin;

const getNekoStreamPoseOffsetY = (spriteName) => {
  const opaqueHeight =
    NEKO_STREAM_OPAQUE_HEIGHT_BY_SPRITE[spriteName] ??
    NEKO_STREAM_BASE_OPAQUE_HEIGHT_PX;
  const transparentBaselineCorrection =
    ((NEKO_STREAM_BASE_OPAQUE_HEIGHT_PX - opaqueHeight) * NEKO_SPRITE_SIZE) /
    NEKO_STREAM_SOURCE_SIZE_PX;
  const intentionalOverlap = spriteName.startsWith("sleep")
    ? NEKO_STREAM_SLEEP_OVERLAP_PX
    : 0;
  return transparentBaselineCorrection + intentionalOverlap;
};

const syncNekoStreamLane = () => {
  if (!nekoStreamLayer) return;
  const taskbarBounds = taskbar?.getBoundingClientRect();
  const taskbarTop =
    taskbarBounds && taskbarBounds.height > 0
      ? taskbarBounds.top
      : window.innerHeight - NEKO_STREAM_FALLBACK_TASKBAR_HEIGHT_PX;
  nekoStreamLayer.style.setProperty(
    "--neko-stream-lane-y",
    `${
      taskbarTop -
      NEKO_SPRITE_SIZE * NEKO_STREAM_MAX_OPAQUE_BOTTOM_RATIO
    }px`
  );
};

const setNekoStreamCatSprite = (cat, spriteName) => {
  const resolvedSpriteName = NEKO_SPRITES[spriteName] ? spriteName : "awake";
  const source = NEKO_SPRITES[resolvedSpriteName];
  cat.element.dataset.sprite = resolvedSpriteName;
  cat.element.style.setProperty(
    "--neko-stream-pose-offset-y",
    `${getNekoStreamPoseOffsetY(resolvedSpriteName)}px`
  );
  if (cat.element.getAttribute("src") !== source) cat.element.src = source;
};

const setNekoStreamCatDirection = (cat, direction) => {
  cat.direction = direction;
  cat.element.dataset.direction = direction < 0 ? "left" : "right";
};

const setNekoStreamCatSpeed = (cat, speedMultiplier) => {
  cat.speedMultiplier = speedMultiplier;
  cat.element.dataset.speedMultiplier = speedMultiplier.toFixed(3);
};

const setNekoStreamCatMode = (cat, mode) => {
  cat.mode = mode;
  cat.element.dataset.mode = mode;
};

const renderNekoStreamCat = (cat) => {
  cat.element.style.left = `${cat.x.toFixed(2)}px`;
};

const removeNekoStreamCat = (cat) => {
  cat.element.remove();
  nekoStreamCats.delete(cat.id);
};

const getNekoStreamEntryProgress = (cat, viewportWidth) => {
  if (viewportWidth <= 0) return 0;
  return cat.entrySide === "left"
    ? cat.x / viewportWidth
    : (viewportWidth - cat.x) / viewportWidth;
};

const isNekoStreamCatFullyVisible = (cat, viewportWidth) => {
  const halfSprite = NEKO_SPRITE_SIZE / 2;
  return cat.x >= halfSprite && cat.x <= viewportWidth - halfSprite;
};

const getNekoStreamActionSpriteName = (action, elapsedMs) => {
  const safeElapsedMs = Math.max(0, Number(elapsedMs) || 0);
  if (action.name === "clean") {
    const cycleElapsedMs = safeElapsedMs % NEKO_STREAM_CLEAN_CYCLE_MS;
    return action.frames[
      cycleElapsedMs < NEKO_STREAM_CLEAN_SIT_PHASE_MS ? 0 : 1
    ];
  }

  if (action.name === "yawn") {
    const frameDurationMs =
      NEKO_STREAM_YAWN_ACTION_DURATION_MS / action.frames.length;
    const frameIndex = Math.min(
      action.frames.length - 1,
      Math.floor(safeElapsedMs / frameDurationMs)
    );
    return action.frames[frameIndex];
  }

  const frameIntervalMs =
    action.name === "sleep"
      ? NEKO_NAP_FRAME_SWITCH_FRAMES * NEKO_FRAME_INTERVAL_MS
      : NEKO_FRAME_INTERVAL_MS;
  const frameIndex =
    Math.floor(safeElapsedMs / frameIntervalMs) % action.frames.length;
  return action.frames[frameIndex];
};

const startNekoStreamCatAction = (cat, timestamp) => {
  cat.actionStartedAt = timestamp;
  cat.actionCount += 1;
  cat.element.dataset.actionCount = String(cat.actionCount);
  setNekoStreamCatMode(cat, cat.action.name);
  setNekoStreamCatSprite(cat, getNekoStreamActionSpriteName(cat.action, 0));
};

const completeNekoStreamCatAction = (cat) => {
  cat.actionCompleted = true;
  cat.element.dataset.actionCompleted = "true";
  const nextDirection =
    cat.postActionDirection ?? (sampleNekoStreamRoll() < 0.5 ? -1 : 1);
  const nextSpeedMultiplier =
    cat.postActionSpeedMultiplier ??
    sampleNekoStreamRange(
      NEKO_STREAM_MIN_SPEED_MULTIPLIER,
      NEKO_STREAM_MAX_SPEED_MULTIPLIER
    );
  setNekoStreamCatDirection(cat, nextDirection);
  setNekoStreamCatSpeed(cat, nextSpeedMultiplier);
  cat.runFrameIndex = 0;
  cat.runFrameElapsedMs = 0;
  setNekoStreamCatMode(cat, "running");
  setNekoStreamCatSprite(
    cat,
    NEKO_RUN_SPRITES[cat.direction < 0 ? "left" : "right"][0]
  );
};

const updateNekoStreamCatAction = (cat, timestamp) => {
  const elapsedMs = Math.max(0, timestamp - cat.actionStartedAt);
  if (elapsedMs >= cat.actionDurationMs) {
    completeNekoStreamCatAction(cat);
    return;
  }

  setNekoStreamCatSprite(
    cat,
    getNekoStreamActionSpriteName(cat.action, elapsedMs)
  );
};

const updateRunningNekoStreamCat = (cat, deltaMs, timestamp, viewportWidth) => {
  if (
    cat.action &&
    !cat.actionCompleted &&
    cat.actionStartedAt === null &&
    isNekoStreamCatFullyVisible(cat, viewportWidth) &&
    getNekoStreamEntryProgress(cat, viewportWidth) >= cat.actionTriggerProgress
  ) {
    startNekoStreamCatAction(cat, timestamp);
    return;
  }

  cat.x +=
    cat.direction *
    NEKO_SPEED *
    cat.speedMultiplier *
    (deltaMs / NEKO_FRAME_INTERVAL_MS);
  cat.runFrameElapsedMs += deltaMs;
  if (cat.runFrameElapsedMs >= NEKO_FRAME_INTERVAL_MS) {
    const frameSteps = Math.floor(cat.runFrameElapsedMs / NEKO_FRAME_INTERVAL_MS);
    cat.runFrameElapsedMs %= NEKO_FRAME_INTERVAL_MS;
    cat.runFrameIndex = (cat.runFrameIndex + frameSteps) % 2;
    const directionName = cat.direction < 0 ? "left" : "right";
    setNekoStreamCatSprite(cat, NEKO_RUN_SPRITES[directionName][cat.runFrameIndex]);
  }

  if (isNekoStreamOutsideViewport(cat.x, viewportWidth)) {
    removeNekoStreamCat(cat);
    return;
  }
  renderNekoStreamCat(cat);
};

const animateNekoStream = (timestamp) => {
  if (!nekoStreamCats.size) {
    nekoStreamAnimationFrameId = null;
    nekoStreamLastFrameTimestamp = 0;
    return;
  }

  if (!nekoStreamLastFrameTimestamp) nekoStreamLastFrameTimestamp = timestamp;
  const deltaMs = clampNumber(
    timestamp - nekoStreamLastFrameTimestamp,
    0,
    NEKO_FRAME_INTERVAL_MS * 2
  );
  nekoStreamLastFrameTimestamp = timestamp;
  const viewportWidth = window.innerWidth;

  nekoStreamCats.forEach((cat) => {
    if (isNekoStreamOutsideViewport(cat.x, viewportWidth)) {
      removeNekoStreamCat(cat);
      return;
    }
    if (cat.mode === "running") {
      updateRunningNekoStreamCat(cat, deltaMs, timestamp, viewportWidth);
    } else {
      updateNekoStreamCatAction(cat, timestamp);
    }
  });

  if (!nekoStreamCats.size) {
    nekoStreamAnimationFrameId = null;
    nekoStreamLastFrameTimestamp = 0;
    return;
  }
  nekoStreamAnimationFrameId = window.requestAnimationFrame(animateNekoStream);
};

const ensureNekoStreamAnimation = () => {
  if (nekoStreamAnimationFrameId !== null || !nekoStreamCats.size) return;
  nekoStreamLastFrameTimestamp = 0;
  nekoStreamAnimationFrameId = window.requestAnimationFrame(animateNekoStream);
};

const spawnNekoStreamCat = (plan) => {
  if (!nekoStreamLayer) return;
  const element = document.createElement("img");
  element.className = "neko-stream-cat";
  element.alt = "";
  element.draggable = false;
  element.setAttribute("aria-hidden", "true");
  element.dataset.nekoStreamCat = String(plan.id);
  element.dataset.entrySide = plan.entrySide;
  element.dataset.action = plan.action?.name || "none";
  element.dataset.actionCount = "0";
  element.dataset.actionCompleted = "false";

  const cat = {
    id: plan.id,
    element,
    x:
      plan.entrySide === "left"
        ? -NEKO_SPRITE_SIZE / 2
        : window.innerWidth + NEKO_SPRITE_SIZE / 2,
    entrySide: plan.entrySide,
    direction: plan.initialDirection,
    speedMultiplier: plan.initialSpeedMultiplier,
    action: plan.action,
    actionTriggerProgress: plan.actionTriggerProgress,
    actionDurationMs: plan.actionDurationMs,
    postActionDirection: plan.postActionDirection,
    postActionSpeedMultiplier: plan.postActionSpeedMultiplier,
    actionStartedAt: null,
    actionCompleted: false,
    actionCount: 0,
    mode: "running",
    runFrameIndex: 0,
    runFrameElapsedMs: 0,
  };

  setNekoStreamCatDirection(cat, plan.initialDirection);
  setNekoStreamCatSpeed(cat, plan.initialSpeedMultiplier);
  setNekoStreamCatMode(cat, "running");
  setNekoStreamCatSprite(
    cat,
    NEKO_RUN_SPRITES[plan.initialDirection < 0 ? "left" : "right"][0]
  );
  renderNekoStreamCat(cat);
  nekoStreamLayer.append(element);
  nekoStreamCats.set(cat.id, cat);
  nekoStreamSpawnedCount += 1;
  ensureNekoStreamAnimation();
};

const stopNekoStream = () => {
  nekoStreamGeneration += 1;
  nekoStreamSpawnTimerIds.forEach((timerId) => window.clearTimeout(timerId));
  nekoStreamSpawnTimerIds.clear();
  if (nekoStreamAnimationFrameId !== null) {
    window.cancelAnimationFrame(nekoStreamAnimationFrameId);
  }
  nekoStreamAnimationFrameId = null;
  nekoStreamLastFrameTimestamp = 0;
  nekoStreamCats.clear();
  nekoStreamLayer?.replaceChildren();
};

const startNekoStream = (plan = createNekoStreamPlan()) => {
  stopNekoStream();
  if (!nekoStreamLayer) return;
  const generation = nekoStreamGeneration;
  const streamPlan = Array.isArray(plan) ? plan : [];
  nekoStreamSpawnedCount = 0;
  nekoStreamPlannedCount = streamPlan.length;
  syncNekoStreamLane();

  const scheduleSpawns = () => {
    if (generation !== nekoStreamGeneration) return;
    streamPlan.forEach((catPlan) => {
      let timerId = null;
      timerId = window.setTimeout(() => {
        nekoStreamSpawnTimerIds.delete(timerId);
        if (generation !== nekoStreamGeneration) return;
        spawnNekoStreamCat(catPlan);
      }, catPlan.spawnDelayMs);
      nekoStreamSpawnTimerIds.add(timerId);
    });
  };

  if (nekoRunAssetsLoaded) {
    scheduleSpawns();
    return;
  }
  void preloadNekoRunAssets().then(scheduleSpawns);
};

const closeNekoContextMenu = ({ restoreFocus = false } = {}) => {
  if (!nekoContextMenu) return;
  const origin = nekoContextMenuOrigin;
  nekoContextMenu.hidden = true;
  nekoContextMenu.style.removeProperty("left");
  nekoContextMenu.style.removeProperty("top");
  nekoContextMenu.style.removeProperty("visibility");
  nekoLaunchers.forEach((launcher) => launcher.setAttribute("aria-expanded", "false"));
  nekoContextMenuOrigin = null;
  if (restoreFocus && origin?.isConnected) origin.focus({ preventScroll: true });
};

const focusAdjacentNekoLauncherControl = (moveBackward) => {
  const origin = nekoContextMenuOrigin;
  if (!origin) {
    closeNekoContextMenu();
    return;
  }
  const controls = Array.from(
    origin.parentElement?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || []
  ).filter((control) => control.getClientRects().length > 0);
  const originIndex = controls.indexOf(origin);
  const target = controls[originIndex + (moveBackward ? -1 : 1)] || origin;
  closeNekoContextMenu();
  target.focus({ preventScroll: true });
};

const openNekoContextMenu = (launcher, clientX, clientY) => {
  if (!nekoContextMenu || !nekoStreamCommand) return;
  void preloadNekoRunAssets();
  closeNekoContextMenu();
  nekoContextMenuOrigin = launcher;
  launcher.setAttribute("aria-expanded", "true");
  nekoContextMenu.hidden = false;
  nekoContextMenu.style.visibility = "hidden";
  nekoContextMenu.style.left = "0px";
  nekoContextMenu.style.top = "0px";

  const menuBounds = nekoContextMenu.getBoundingClientRect();
  const launcherBounds = launcher.getBoundingClientRect();
  const taskbarBounds = taskbar?.getBoundingClientRect();
  const requestedLeft = Number.isFinite(clientX) ? clientX : launcherBounds.left;
  const requestedTop = Number.isFinite(clientY) ? clientY : launcherBounds.bottom;
  const availableBottom = Math.min(
    window.innerHeight - NEKO_CONTEXT_MENU_PADDING,
    taskbarBounds?.top ?? window.innerHeight - NEKO_CONTEXT_MENU_PADDING
  );
  const maximumLeft = Math.max(
    NEKO_CONTEXT_MENU_PADDING,
    window.innerWidth - menuBounds.width - NEKO_CONTEXT_MENU_PADDING
  );
  const maximumTop = Math.max(
    NEKO_CONTEXT_MENU_PADDING,
    availableBottom - menuBounds.height - NEKO_CONTEXT_MENU_PADDING
  );
  const left = clampNumber(requestedLeft, NEKO_CONTEXT_MENU_PADDING, maximumLeft);
  const top = clampNumber(requestedTop, NEKO_CONTEXT_MENU_PADDING, maximumTop);

  nekoContextMenu.style.left = `${Math.round(left)}px`;
  nekoContextMenu.style.top = `${Math.round(top)}px`;
  nekoContextMenu.style.visibility = "visible";
  nekoStreamCommand.focus({ preventScroll: true });
};

nekoLaunchers.forEach((launcher) => {
  launcher.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openNekoContextMenu(launcher, event.clientX, event.clientY);
  });
  launcher.addEventListener("keydown", (event) => {
    const opensContextMenu =
      event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
    if (!opensContextMenu) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = launcher.getBoundingClientRect();
    openNekoContextMenu(launcher, bounds.left, bounds.bottom);
  });
});

nekoStreamCommand?.addEventListener("click", () => {
  closeNekoContextMenu({ restoreFocus: true });
  startNekoStream();
});

nekoContextMenu?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeNekoContextMenu({ restoreFocus: true });
    return;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    focusAdjacentNekoLauncherControl(event.shiftKey);
    return;
  }
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    nekoStreamCommand?.focus({ preventScroll: true });
  }
});

document.addEventListener("pointerdown", (event) => {
  if (nekoContextMenu?.hidden || nekoContextMenu?.contains(event.target)) return;
  closeNekoContextMenu();
});

document.addEventListener("contextmenu", (event) => {
  if (nekoContextMenu?.hidden || event.target.closest?.('[data-app="neko"]')) return;
  closeNekoContextMenu();
});

window.addEventListener(
  "scroll",
  () => closeNekoContextMenu({ restoreFocus: true }),
  true
);

window.addEventListener("blur", () => closeNekoContextMenu());

window.addEventListener("pagehide", stopNekoStream);

const setNekoIconAwake = (isAwake) => {
  document.querySelectorAll("[data-neko-icon]").forEach((icon) => {
    icon.classList.toggle("is-awake", isAwake);
  });
};

const setNekoTaskbarActionIcon = (action) => {
  const shouldSleep = action === "sleep";
  const iconSrc = shouldSleep ? NEKO_TASKBAR_SLEEP_ICON : NEKO_TASKBAR_WAKE_ICON;
  document.querySelectorAll("[data-neko-taskbar-icon]").forEach((image) => {
    if (image.getAttribute("src") !== iconSrc) {
      image.src = iconSrc;
    }
    image.classList.toggle("is-neko-active", shouldSleep);
  });
};

const setNekoSleepingIconFrame = (frame) => {
  const sprite = frame % 2 === 0 ? NEKO_SPRITES.sleep1 : NEKO_SPRITES.sleep2;
  document.querySelectorAll("[data-neko-sleeping-cat]").forEach((image) => {
    image.src = sprite;
  });
};

const startNekoSleepBreathing = () => {
  if (nekoSleepTimerId) return;
  nekoSleepFrame = 0;
  setNekoSleepingIconFrame(nekoSleepFrame);
  nekoSleepTimerId = window.setInterval(() => {
    if (nekoState !== "sleeping") return;
    nekoSleepFrame += 1;
    setNekoSleepingIconFrame(nekoSleepFrame);
  }, NEKO_SLEEP_FRAME_INTERVAL_MS);
};

const stopNekoSleepBreathing = () => {
  if (!nekoSleepTimerId) return;
  window.clearInterval(nekoSleepTimerId);
  nekoSleepTimerId = null;
};

const setDesktopNekoSprite = (spriteName) => {
  if (!desktopNekoCat) return;
  const src = NEKO_SPRITES[spriteName] || NEKO_SPRITES.awake;
  if (desktopNekoCat.getAttribute("src") !== src) {
    desktopNekoCat.src = src;
  }
};

const renderDesktopNekoCat = () => {
  if (!desktopNekoCat) return;
  desktopNekoCat.style.left = `${Math.round(nekoPosX)}px`;
  desktopNekoCat.style.top = `${Math.round(nekoPosY)}px`;
};

const resetNekoFootprintSpacing = () => {
  nekoLastFootprintX = null;
  nekoLastFootprintY = null;
  nekoNextFootprintSide = 1;
};

const removeNekoFootprint = (footprint) => {
  if (!footprint) return;
  window.clearTimeout(footprint.timerId);
  footprint.element.remove();
  nekoFootprints = nekoFootprints.filter((item) => item !== footprint);
};

const trimNekoFootprints = () => {
  while (nekoFootprints.length > NEKO_FOOTPRINT_MAX) {
    removeNekoFootprint(nekoFootprints[0]);
  }
};

const createNekoFootprint = (x, y, direction, pawSide) => {
  const src = NEKO_FOOTPRINT_SPRITES[direction];
  if (!src) return;
  const visibleOffset = NEKO_FOOTPRINT_VISIBLE_OFFSETS[direction] || { x: 0, y: 0 };

  const footprint = document.createElement("img");
  footprint.className = `desktop-neko-footprint desktop-neko-footprint--${
    pawSide < 0 ? "left" : "right"
  }`;
  footprint.src = src;
  footprint.alt = "";
  footprint.draggable = false;
  footprint.setAttribute("aria-hidden", "true");
  footprint.style.left = `${Math.round(x - visibleOffset.x)}px`;
  footprint.style.top = `${Math.round(y - visibleOffset.y)}px`;

  const entry = { element: footprint, timerId: null };
  entry.timerId = window.setTimeout(() => removeNekoFootprint(entry), NEKO_FOOTPRINT_TTL_MS);
  nekoFootprints.push(entry);
  document.body.append(footprint);
  trimNekoFootprints();
};

const createNekoFootprintPair = (x, y, direction, moveX, moveY) => {
  const distance = Math.sqrt(moveX ** 2 + moveY ** 2) || 1;
  const alongX = moveX / distance;
  const alongY = moveY / distance;
  const sideX = -alongY;
  const sideY = alongX;
  const firstSide = nekoNextFootprintSide;
  const secondSide = -firstSide;
  const originX = x - alongX * NEKO_FOOTPRINT_BACK_OFFSET;
  const originY = y - NEKO_VERTICAL_OFFSET - alongY * NEKO_FOOTPRINT_BACK_OFFSET;

  createNekoFootprint(
    originX + sideX * NEKO_FOOTPRINT_SIDE_OFFSET * firstSide - alongX * NEKO_FOOTPRINT_STAGGER,
    originY + sideY * NEKO_FOOTPRINT_SIDE_OFFSET * firstSide - alongY * NEKO_FOOTPRINT_STAGGER,
    direction,
    firstSide
  );
  createNekoFootprint(
    originX + sideX * NEKO_FOOTPRINT_SIDE_OFFSET * secondSide + alongX * NEKO_FOOTPRINT_STAGGER,
    originY + sideY * NEKO_FOOTPRINT_SIDE_OFFSET * secondSide + alongY * NEKO_FOOTPRINT_STAGGER,
    direction,
    secondSide
  );

  nekoNextFootprintSide *= -1;
};

const maybeCreateNekoFootprints = (x, y, direction, moveX, moveY) => {
  if (nekoLastFootprintX === null || nekoLastFootprintY === null) {
    nekoLastFootprintX = x;
    nekoLastFootprintY = y;
    createNekoFootprintPair(x, y, direction, moveX, moveY);
    return;
  }

  const distanceFromLastPrint = Math.sqrt(
    (x - nekoLastFootprintX) ** 2 + (y - nekoLastFootprintY) ** 2
  );
  if (distanceFromLastPrint < NEKO_FOOTPRINT_SPACING) return;

  nekoLastFootprintX = x;
  nekoLastFootprintY = y;
  createNekoFootprintPair(x, y, direction, moveX, moveY);
};

const updateNekoPointerTarget = (event) => {
  if (!Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return;
  if (
    Math.abs(event.clientX - nekoMouseX) > 1 ||
    Math.abs(event.clientY - nekoMouseY) > 1
  ) {
    nekoLastMouseMoveAt = performance.now();
    nekoIdleStartedAt = 0;
    nekoPlayedIdleActionForCurrentIdle = false;
    nekoIsNapping = false;
    nekoNapFrame = 0;
  }

  const edge = getNekoPointerViewportEdge(event.clientX, event.clientY);
  if (edge) {
    setNekoScratchTarget(edge, event.clientX, event.clientY);
    return;
  }

  nekoMouseOutsideWindow = false;
  nekoScratchEdge = null;
  nekoScratchTargetX = null;
  nekoScratchTargetY = null;
  nekoEdgeScratchStartedAt = 0;
  nekoMouseX = event.clientX;
  nekoMouseY = event.clientY;
};

const clampNekoCenterX = (x) => {
  const halfSize = NEKO_SPRITE_SIZE / 2;
  const maxX = Math.max(halfSize, window.innerWidth - halfSize);
  return clampNumber(x, halfSize, maxX);
};

const clampNekoCenterY = (y) => {
  const halfSize = NEKO_SPRITE_SIZE / 2;
  // CSS shifts the sprite up, so the stored Y sits below the visual center.
  const minY = halfSize + NEKO_VERTICAL_OFFSET;
  const maxY = Math.max(minY, window.innerHeight - halfSize + NEKO_VERTICAL_OFFSET);
  return clampNumber(y, minY, maxY);
};

const clampNekoTargetToViewport = (clientX, clientY) => ({
  x: clampNumber(clientX, 0, window.innerWidth),
  y: clampNumber(clientY, 0, window.innerHeight),
});

const getNekoScratchAnchor = (edge, targetX, targetY) => {
  const halfSize = NEKO_SPRITE_SIZE / 2;
  const logicalTargetY = targetY + NEKO_VERTICAL_OFFSET;
  switch (edge) {
    case "left":
      return { x: halfSize, y: clampNekoCenterY(logicalTargetY) };
    case "right":
      return {
        x: clampNekoCenterX(window.innerWidth - halfSize),
        y: clampNekoCenterY(logicalTargetY),
      };
    case "top":
      return { x: clampNekoCenterX(targetX), y: halfSize + NEKO_VERTICAL_OFFSET };
    case "bottom":
      return {
        x: clampNekoCenterX(targetX),
        y: clampNekoCenterY(window.innerHeight - halfSize + NEKO_VERTICAL_OFFSET),
      };
    default:
      return { x: clampNekoCenterX(targetX), y: clampNekoCenterY(logicalTargetY) };
  }
};

const getNekoPointerViewportEdge = (clientX, clientY) => {
  const candidates = [
    { edge: "left", distance: clientX, active: clientX <= NEKO_EDGE_POINTER_HOTZONE },
    {
      edge: "right",
      distance: window.innerWidth - clientX,
      active: clientX >= window.innerWidth - NEKO_EDGE_POINTER_HOTZONE,
    },
    { edge: "top", distance: clientY, active: clientY <= NEKO_EDGE_POINTER_HOTZONE },
    {
      edge: "bottom",
      distance: window.innerHeight - clientY,
      active: clientY >= window.innerHeight - NEKO_EDGE_POINTER_HOTZONE,
    },
  ].filter((candidate) => candidate.active);

  if (!candidates.length) return null;
  return candidates.reduce((best, item) =>
    item.distance < best.distance ? item : best
  ).edge;
};

const getNekoPointerExitEdge = (clientX, clientY) => {
  const overshoots = [
    { edge: "left", amount: Math.max(0, -clientX) },
    { edge: "right", amount: Math.max(0, clientX - window.innerWidth) },
    { edge: "top", amount: Math.max(0, -clientY) },
    { edge: "bottom", amount: Math.max(0, clientY - window.innerHeight) },
  ];
  const largestOvershoot = overshoots.reduce((best, item) =>
    item.amount > best.amount ? item : best
  );
  if (largestOvershoot.amount > 0) return largestOvershoot.edge;

  return [
    { edge: "left", distance: Math.abs(clientX) },
    { edge: "right", distance: Math.abs(window.innerWidth - clientX) },
    { edge: "top", distance: Math.abs(clientY) },
    { edge: "bottom", distance: Math.abs(window.innerHeight - clientY) },
  ].reduce((best, item) => (item.distance < best.distance ? item : best)).edge;
};

const setNekoScratchTarget = (edge, clientX, clientY) => {
  const target = clampNekoTargetToViewport(clientX, clientY);
  const scratchAnchor = getNekoScratchAnchor(edge, target.x, target.y);
  const scratchTargetChanged =
    nekoScratchEdge !== edge ||
    !Number.isFinite(nekoScratchTargetX) ||
    !Number.isFinite(nekoScratchTargetY) ||
    Math.abs(nekoScratchTargetX - scratchAnchor.x) > 1 ||
    Math.abs(nekoScratchTargetY - scratchAnchor.y) > 1;

  nekoMouseOutsideWindow = true;
  nekoScratchEdge = edge;
  nekoScratchTargetX = scratchAnchor.x;
  nekoScratchTargetY = scratchAnchor.y;
  nekoMouseX = scratchAnchor.x;
  nekoMouseY = scratchAnchor.y;

  if (scratchTargetChanged) {
    nekoEdgeScratchStartedAt = 0;
  }
};

const handleNekoPointerExit = (event) => {
  if (!["waking", "chasing"].includes(nekoState)) return;
  if (event.relatedTarget || event.toElement) return;

  const fallbackX = clampNumber(nekoMouseX, 0, window.innerWidth);
  const fallbackY = clampNumber(nekoMouseY, 0, window.innerHeight);
  const clientX = Number.isFinite(event.clientX) ? event.clientX : fallbackX;
  const clientY = Number.isFinite(event.clientY) ? event.clientY : fallbackY;
  const edge = getNekoPointerExitEdge(clientX, clientY);
  setNekoScratchTarget(edge, clientX, clientY);
};

const getNekoHomePosition = () => {
  const sleepingCat = document.querySelector("[data-neko-sleeping-cat]");
  const sleepingCatRect = sleepingCat?.getBoundingClientRect();
  if (sleepingCatRect?.width && sleepingCatRect?.height) {
    return {
      x: sleepingCatRect.left + sleepingCatRect.width / 2,
      y: sleepingCatRect.top + sleepingCatRect.height / 2 + NEKO_VERTICAL_OFFSET,
    };
  }

  const icon = document.querySelector("[data-neko-icon]");
  const iconRect = icon?.getBoundingClientRect();
  if (iconRect?.width && iconRect?.height) {
    return {
      x: iconRect.left + iconRect.width / 2,
      y: iconRect.top + iconRect.height / 2 + NEKO_VERTICAL_OFFSET,
    };
  }

  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
};

const createDesktopNekoCat = () => {
  desktopNekoCat = document.createElement("img");
  desktopNekoCat.className = "desktop-neko-cat";
  desktopNekoCat.src = NEKO_SPRITES.awake;
  desktopNekoCat.alt = "";
  desktopNekoCat.draggable = false;
  desktopNekoCat.setAttribute("aria-hidden", "true");
  desktopNekoCat.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startNekoManualAction();
  });
  document.body.append(desktopNekoCat);
};

const clearNekoWakeTimer = () => {
  if (!nekoWakeTimerId) return;
  window.clearTimeout(nekoWakeTimerId);
  nekoWakeTimerId = null;
};

const cancelNekoAnimationFrame = () => {
  if (!nekoAnimationFrameId) return;
  window.cancelAnimationFrame(nekoAnimationFrameId);
  nekoAnimationFrameId = null;
};

const clearNekoIdleAction = () => {
  nekoIdleAction = null;
  nekoIdleActionFrame = 0;
};

const startRandomNekoIdleAction = () => {
  nekoIdleAction = NEKO_IDLE_ACTIONS[Math.floor(Math.random() * NEKO_IDLE_ACTIONS.length)];
  nekoIdleActionFrame = 0;
  nekoPlayedIdleActionForCurrentIdle = true;
};

const startNekoManualAction = () => {
  if (!desktopNekoCat || nekoState === "sleeping") return;

  if (nekoState === "waking") {
    clearNekoWakeTimer();
    nekoState = "chasing";
  } else if (nekoState === "returning") {
    nekoState = "chasing";
  }

  clearNekoActiveInterruptions();
  nekoIdleAction = NEKO_MANUAL_ACTIONS[Math.floor(Math.random() * NEKO_MANUAL_ACTIONS.length)];
  nekoIdleActionFrame = 0;
  nekoIdleActionCooldownFrames = 0;
  nekoIdleStartedAt = performance.now();
  nekoPlayedIdleActionForCurrentIdle = true;
  nekoLastMouseMoveAt = performance.now();
  setNekoTaskbarActionIcon("sleep");
  playNekoIdleAction();
  ensureNekoAnimationFrame();
};

const chooseNekoRunDirection = (diffX, diffY, distance) => {
  const vertical =
    diffY / distance > 0.5 ? "up" : diffY / distance < -0.5 ? "down" : "";
  const horizontal =
    diffX / distance > 0.5 ? "left" : diffX / distance < -0.5 ? "right" : "";
  return `${vertical}${horizontal}` || "down";
};

const isNekoAtScratchEdge = (edge) => {
  if (Number.isFinite(nekoScratchTargetX) && Number.isFinite(nekoScratchTargetY)) {
    const distanceToScratchTarget = Math.sqrt(
      (nekoPosX - nekoScratchTargetX) ** 2 + (nekoPosY - nekoScratchTargetY) ** 2
    );
    return distanceToScratchTarget <= NEKO_SPEED + NEKO_EDGE_SCRATCH_DISTANCE;
  }

  const halfSize = NEKO_SPRITE_SIZE / 2;
  switch (edge) {
    case "left":
      return nekoPosX <= halfSize + NEKO_EDGE_SCRATCH_DISTANCE;
    case "right":
      return nekoPosX >= window.innerWidth - halfSize - NEKO_EDGE_SCRATCH_DISTANCE;
    case "top":
      return nekoPosY <= halfSize + NEKO_VERTICAL_OFFSET + NEKO_EDGE_SCRATCH_DISTANCE;
    case "bottom":
      return (
        nekoPosY >=
        window.innerHeight - halfSize + NEKO_VERTICAL_OFFSET - NEKO_EDGE_SCRATCH_DISTANCE
      );
    default:
      return false;
  }
};

const scratchNekoEdge = (edge) => {
  const sprites = NEKO_SCRATCH_SPRITES[edge];
  if (!sprites) return false;
  if (Number.isFinite(nekoScratchTargetX) && Number.isFinite(nekoScratchTargetY)) {
    nekoPosX = clampNekoCenterX(nekoScratchTargetX);
    nekoPosY = clampNekoCenterY(nekoScratchTargetY);
  }
  setDesktopNekoSprite(sprites[nekoFrameCount % sprites.length]);
  renderDesktopNekoCat();
  return true;
};

const putActiveNekoToSleep = () => {
  clearNekoIdleAction();
  nekoIsNapping = true;
  nekoNapFrame = 0;
  setDesktopNekoSprite("sleep1");
  renderDesktopNekoCat();
};

const sleepActiveNeko = () => {
  const sprite =
    Math.floor(nekoNapFrame / NEKO_NAP_FRAME_SWITCH_FRAMES) % 2 === 0 ? "sleep1" : "sleep2";
  setDesktopNekoSprite(sprite);
  renderDesktopNekoCat();
  nekoNapFrame += 1;
};

const playNekoIdleAction = () => {
  if (!nekoIdleAction) return false;
  const sprite = nekoIdleAction.frames[nekoIdleActionFrame];
  setDesktopNekoSprite(sprite);
  renderDesktopNekoCat();
  nekoIdleActionFrame += 1;

  if (nekoIdleActionFrame >= nekoIdleAction.frames.length) {
    clearNekoIdleAction();
    nekoIdleActionCooldownFrames = NEKO_IDLE_ACTION_COOLDOWN_FRAMES;
  }

  return true;
};

const maybeStartNekoIdleAction = (timestamp) => {
  if (nekoIdleAction) return true;
  if (!nekoIdleStartedAt) {
    nekoIdleStartedAt = timestamp;
    return false;
  }
  if (
    !nekoPlayedIdleActionForCurrentIdle &&
    timestamp - nekoIdleStartedAt >= NEKO_IDLE_ACTION_DELAY_MS
  ) {
    startRandomNekoIdleAction();
    return true;
  }
  if (nekoIdleActionCooldownFrames > 0) {
    nekoIdleActionCooldownFrames -= 1;
    return false;
  }
  return false;
};

const setNekoStillPose = () => {
  setDesktopNekoSprite("yawn1");
  renderDesktopNekoCat();
};

const moveNekoTowardTarget = (targetX, targetY, stopDistance) => {
  const diffX = nekoPosX - targetX;
  const diffY = nekoPosY - targetY;
  const distance = Math.sqrt(diffX ** 2 + diffY ** 2);

  if (distance <= stopDistance || distance < NEKO_SPEED) {
    return true;
  }

  const direction = chooseNekoRunDirection(diffX, diffY, distance);
  const sprites = NEKO_RUN_SPRITES[direction] || NEKO_RUN_SPRITES.down;
  setDesktopNekoSprite(sprites[nekoFrameCount % sprites.length]);

  const moveX = -(diffX / distance) * NEKO_SPEED;
  const moveY = -(diffY / distance) * NEKO_SPEED;
  nekoPosX += moveX;
  nekoPosY += moveY;

  nekoPosX = clampNekoCenterX(nekoPosX);
  nekoPosY = clampNekoCenterY(nekoPosY);
  maybeCreateNekoFootprints(nekoPosX, nekoPosY, direction, moveX, moveY);
  renderDesktopNekoCat();
  return false;
};

const stepNekoTowardMouse = (timestamp) => {
  nekoFrameCount += 1;

  if (nekoIsNapping) {
    sleepActiveNeko();
    return;
  }

  if (playNekoIdleAction()) return;

  const diffX = nekoPosX - nekoMouseX;
  const diffY = nekoPosY - nekoMouseY;
  const distance = Math.sqrt(diffX ** 2 + diffY ** 2);

  if (
    nekoMouseOutsideWindow &&
    nekoScratchEdge &&
    isNekoAtScratchEdge(nekoScratchEdge) &&
    scratchNekoEdge(nekoScratchEdge)
  ) {
    if (!nekoEdgeScratchStartedAt) {
      nekoEdgeScratchStartedAt = timestamp;
    } else if (timestamp - nekoEdgeScratchStartedAt >= NEKO_EDGE_SCRATCH_SLEEP_MS) {
      putActiveNekoToSleep();
    }
    return;
  }

  nekoEdgeScratchStartedAt = 0;

  if (distance < NEKO_SPEED || distance < NEKO_IDLE_DISTANCE) {
    if (timestamp - nekoLastMouseMoveAt >= NEKO_MOUSE_STILL_SLEEP_MS) {
      putActiveNekoToSleep();
      return;
    }
    if (maybeStartNekoIdleAction(timestamp) && playNekoIdleAction()) return;
    setNekoStillPose();
    return;
  }

  clearNekoIdleAction();
  nekoIdleStartedAt = 0;
  nekoPlayedIdleActionForCurrentIdle = false;
  moveNekoTowardTarget(nekoMouseX, nekoMouseY, NEKO_SPEED);
};

const clearNekoActiveInterruptions = () => {
  clearNekoIdleAction();
  nekoMouseOutsideWindow = false;
  nekoScratchEdge = null;
  nekoScratchTargetX = null;
  nekoScratchTargetY = null;
  nekoEdgeScratchStartedAt = 0;
  nekoIsNapping = false;
  nekoNapFrame = 0;
  nekoIdleStartedAt = 0;
  nekoPlayedIdleActionForCurrentIdle = false;
};

const stepNekoTowardBed = () => {
  nekoFrameCount += 1;
  if (moveNekoTowardTarget(nekoReturnX, nekoReturnY, NEKO_RETURN_HOME_DISTANCE)) {
    returnNekoToBed();
  }
};

const animateNeko = (timestamp) => {
  if (!["chasing", "returning"].includes(nekoState)) {
    nekoAnimationFrameId = null;
    return;
  }

  if (!nekoLastFrameTimestamp) {
    nekoLastFrameTimestamp = timestamp;
  }

  if (timestamp - nekoLastFrameTimestamp >= NEKO_FRAME_INTERVAL_MS) {
    nekoLastFrameTimestamp = timestamp;
    if (nekoState === "returning") {
      stepNekoTowardBed();
    } else {
      stepNekoTowardMouse(timestamp);
    }
  }

  if (!["chasing", "returning"].includes(nekoState)) {
    nekoAnimationFrameId = null;
    return;
  }

  nekoAnimationFrameId = window.requestAnimationFrame(animateNeko);
};

const ensureNekoAnimationFrame = () => {
  if (nekoAnimationFrameId) return;
  nekoLastFrameTimestamp = 0;
  nekoAnimationFrameId = window.requestAnimationFrame(animateNeko);
};

const startNekoChasing = () => {
  if (nekoState !== "waking") return;
  nekoState = "chasing";
  setNekoTaskbarActionIcon("sleep");
  nekoFrameCount = 0;
  nekoLastFrameTimestamp = 0;
  resetNekoFootprintSpacing();
  nekoLastMouseMoveAt = performance.now();
  nekoIdleActionCooldownFrames = NEKO_IDLE_ACTION_COOLDOWN_FRAMES;
  nekoIdleStartedAt = 0;
  nekoPlayedIdleActionForCurrentIdle = false;
  nekoEdgeScratchStartedAt = 0;
  nekoIsNapping = false;
  nekoNapFrame = 0;
  cancelNekoAnimationFrame();
  nekoAnimationFrameId = window.requestAnimationFrame(animateNeko);
};

const startNekoReturnToBed = () => {
  if (nekoState === "sleeping") return;
  clearNekoWakeTimer();
  clearNekoActiveInterruptions();
  const homePosition = getNekoHomePosition();
  nekoReturnX = homePosition.x;
  nekoReturnY = homePosition.y;
  nekoState = "returning";
  setNekoTaskbarActionIcon("wake");
  resetNekoFootprintSpacing();
  ensureNekoAnimationFrame();
};

const resumeNekoChasingMouse = () => {
  if (nekoState !== "returning") return;
  clearNekoActiveInterruptions();
  nekoState = "chasing";
  setNekoTaskbarActionIcon("sleep");
  nekoLastMouseMoveAt = performance.now();
  ensureNekoAnimationFrame();
};

const runNekoWakeSequence = (index = 0) => {
  if (nekoState !== "waking") return;

  if (index >= NEKO_WAKE_SEQUENCE.length) {
    startNekoChasing();
    return;
  }

  const step = NEKO_WAKE_SEQUENCE[index];
  setDesktopNekoSprite(step.sprite);
  renderDesktopNekoCat();
  clearNekoWakeTimer();
  nekoWakeTimerId = window.setTimeout(() => {
    nekoWakeTimerId = null;
    if (step.waitForRunAssets && !nekoRunAssetsLoaded) {
      preloadNekoRunAssets().then(() => {
        if (nekoState !== "waking") return;
        runNekoWakeSequence(index + 1);
      });
      return;
    }
    runNekoWakeSequence(index + 1);
  }, step.duration);
};

const wakeNeko = (event) => {
  if (nekoState !== "sleeping") {
    returnNekoToBed();
    return;
  }

  updateNekoPointerTarget(event);
  const homePosition = getNekoHomePosition();
  nekoPosX = homePosition.x;
  nekoPosY = homePosition.y;

  stopNekoSleepBreathing();
  setNekoIconAwake(true);
  setNekoTaskbarActionIcon("sleep");
  createDesktopNekoCat();
  renderDesktopNekoCat();
  preloadNekoRunAssets();
  nekoState = "waking";
  document.addEventListener("pointermove", updateNekoPointerTarget);
  document.addEventListener("pointerout", handleNekoPointerExit);
  document.addEventListener("pointerleave", handleNekoPointerExit);
  document.addEventListener("mouseout", handleNekoPointerExit);
  document.addEventListener("mouseleave", handleNekoPointerExit);
  runNekoWakeSequence();
};

function returnNekoToBed() {
  if (nekoState === "sleeping") return;
  nekoState = "sleeping";
  clearNekoWakeTimer();
  cancelNekoAnimationFrame();
  clearNekoIdleAction();
  document.removeEventListener("pointermove", updateNekoPointerTarget);
  document.removeEventListener("pointerout", handleNekoPointerExit);
  document.removeEventListener("pointerleave", handleNekoPointerExit);
  document.removeEventListener("mouseout", handleNekoPointerExit);
  document.removeEventListener("mouseleave", handleNekoPointerExit);
  nekoMouseOutsideWindow = false;
  nekoScratchEdge = null;
  nekoScratchTargetX = null;
  nekoScratchTargetY = null;
  nekoEdgeScratchStartedAt = 0;
  nekoIsNapping = false;
  nekoNapFrame = 0;
  nekoIdleActionCooldownFrames = 0;
  nekoIdleStartedAt = 0;
  nekoPlayedIdleActionForCurrentIdle = false;
  resetNekoFootprintSpacing();
  desktopNekoCat?.remove();
  desktopNekoCat = null;
  setNekoIconAwake(false);
  setNekoTaskbarActionIcon("wake");
  startNekoSleepBreathing();
}

const toggleNeko = (event) => {
  if (nekoState === "returning") {
    updateNekoPointerTarget(event);
    resumeNekoChasingMouse();
    return;
  }
  if (nekoState !== "sleeping") {
    startNekoReturnToBed();
    return;
  }
  wakeNeko(event);
};

setNekoTaskbarActionIcon("wake");

runAfterHomeActivation(startNekoSleepBreathing);

runAfterHomeActivation(startRohinNekoAvatarAnimation);

// Neko has no window of its own: the taskbar entry toggles the cat instead.
registerWindowLifecycle("neko", {
  onLaunch: (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleNeko(event);
    return true;
  },
});

registerViewportObserver({
  onResize: () => {
    closeNekoContextMenu({ restoreFocus: true });
    syncNekoStreamLane();
  },
});

// Game Stats shows this cat as the Rohin Neko profile icon.
registerGameStatsAvatarAnimator({
  start: startRohinNekoAvatarAnimation,
  stop: stopRohinNekoAvatarAnimation,
});

window.homeNeko = Object.freeze({
  NEKO_RANDOM_EVENT_PROBABILITY_BONUS,
  NEKO_SLEEP_FRAME_INTERVAL_MS,
  NEKO_SPRITES,
  closeNekoContextMenu,
  isNekoRandomEventBoostActive,
  startNekoStream,
  startRohinNekoAvatarAnimation,
  stopRohinNekoAvatarAnimation,
  syncNekoStreamLane,
  toggleNeko,
});
})();
