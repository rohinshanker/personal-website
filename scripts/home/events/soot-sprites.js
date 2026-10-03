(() => {
const {
  byId,
  taskbar,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  bindRandomEventButton,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  registerRandomEvent,
  registerRandomEventWindows,
  setRandomEventWindowPosition,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clampNumber,
} = window.homeUtil;

const sootSpritesWindow = byId("soot-sprites-window");
const sootSpritesYes = byId("soot-sprites-yes");
const sootSpritesNo = byId("soot-sprites-no");

let sootSpritesOverlay = null;

let sootSpritesRevealTimer = null;

let sootSpritesWindowHoldTimer = null;

let sootSpritesCleanupTimer = null;

const sootSpriteMotionAnimations = new WeakMap();

const SOOT_SPRITES_DESKTOP_COUNT = 32;

const SOOT_SPRITES_MOBILE_COUNT = 20;

const SOOT_SPRITES_CLEANUP_MS = 27000;

const SOOT_SPRITES_REVEAL_DELAY_MS = 120;

const SOOT_SPRITES_WINDOW_HOLD_AFTER_LOAD_MS = 1000;

const SOOT_SPRITES_SPAWN_CLEARANCE = 64;

const SOOT_SPRITES_FALL_SAMPLE_COUNT = 12;

const SOOT_SPRITES_DIRECTION_SWITCH_CHANCE = 0.55;

const SOOT_SPRITES_DIRECTION_SWITCH_MIN_DELAY_MS = 1000;

const SOOT_SPRITES_DIRECTION_SWITCH_MAX_DELAY_MS = 3000;

const SOOT_SPRITES_MIN_PATH_SPEED = 0.22;

const SOOT_SPRITES_AIR_TRAIL_CANDIES_PER_SPRITE = 2.2;

const SOOT_SPRITES_GROUND_RUN_CANDY_MULTIPLIER = 2;

const SOOT_CANDY_LANDING_PROGRESS = 0.72;

const SOOT_CANDY_HOLD_AFTER_LANDING_MS = 4000;

const SOOT_CANDY_FADE_DURATION_MS = 1200;

const SOOT_SPRITES_CANDY_COLORS = Object.freeze([
  "#c9f7c2",
  "#ffc6dc",
  "#fff2a6",
  "#fffaf0",
  "#bde7ff",
]);

const isSootSpritesVisible = () =>
  isManagedRandomEventWindowVisible(sootSpritesWindow) ||
  Boolean(
    sootSpritesOverlay ||
      sootSpritesRevealTimer ||
      sootSpritesWindowHoldTimer
  );

const randomSootSpriteValue = (min, max) => min + Math.random() * (max - min);

const randomSootCandyColor = () =>
  SOOT_SPRITES_CANDY_COLORS[
    Math.floor(Math.random() * SOOT_SPRITES_CANDY_COLORS.length)
  ];

const setSootSpritePx = (element, property, value) => {
  element.style.setProperty(property, `${Math.round(value)}px`);
};

const clearSootSpritesLifecycleTimers = () => {
  if (sootSpritesRevealTimer) window.clearTimeout(sootSpritesRevealTimer);
  if (sootSpritesWindowHoldTimer) window.clearTimeout(sootSpritesWindowHoldTimer);
  sootSpritesRevealTimer = null;
  sootSpritesWindowHoldTimer = null;
};

const cleanupSootSpritesOverlay = () => {
  clearSootSpritesLifecycleTimers();
  if (sootSpritesOverlay) {
    sootSpritesOverlay.remove();
    sootSpritesOverlay = null;
  }
  if (sootSpritesCleanupTimer) {
    window.clearTimeout(sootSpritesCleanupTimer);
    sootSpritesCleanupTimer = null;
  }
  document.body.classList.remove("is-soot-sprites-active");
};

const setSootSpritesWindowLoading = (loading) => {
  sootSpritesWindow?.classList.toggle("is-loading-sprites", loading);
  [sootSpritesYes, sootSpritesNo].forEach((button) => {
    if (!button) return;
    button.disabled = loading;
    button.setAttribute("aria-disabled", String(loading));
  });
};

const getSootSpritesLaunchRect = () => {
  const rect = sootSpritesWindow?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) return rect;
  const width = Math.min(340, window.innerWidth - 32);
  const height = 150;
  return {
    left: (window.innerWidth - width) / 2,
    top: Math.max(16, (window.innerHeight - height) / 2),
    width,
    height,
  };
};

const getSootSpritesStagedZIndex = () => {
  const windowZIndex = Number.parseInt(sootSpritesWindow?.style.zIndex || "", 10);
  return Math.max(0, (Number.isFinite(windowZIndex) ? windowZIndex : 140) - 1);
};

const reserveSootSpritesSpawnLane = () => {
  if (!sootSpritesWindow) return;
  const toolbarTop = getSootSpritesToolbarTop();
  const currentLeft = Number.parseFloat(sootSpritesWindow.style.left);
  const currentTop = Number.parseFloat(sootSpritesWindow.style.top);
  const maxTop = Math.max(
    12,
    toolbarTop - sootSpritesWindow.offsetHeight - SOOT_SPRITES_SPAWN_CLEARANCE
  );
  setRandomEventWindowPosition(
    sootSpritesWindow,
    Number.isFinite(currentLeft) ? currentLeft : 12,
    Math.min(Number.isFinite(currentTop) ? currentTop : maxTop, maxTop)
  );
};

const getSootSpritesToolbarTop = () => {
  const appMenu = document.querySelector(".taskbar-apps");
  const taskbar = appMenu || document.querySelector(".taskbar");
  return taskbar?.getBoundingClientRect().top || window.innerHeight - 52;
};

const getSootSpritesGroundY = (spriteSize) => {
  const toolbarTop = getSootSpritesToolbarTop();
  return clampNumber(toolbarTop - spriteSize, 0, window.innerHeight - spriteSize);
};

const getSootCandyLandingY = (candySize) => {
  const toolbarTop = getSootSpritesToolbarTop();
  return clampNumber(toolbarTop - candySize, 0, window.innerHeight - candySize);
};

const getSootSpriteParabolaPoint = (trajectory, progress) => {
  const clampedProgress = clampNumber(progress, 0, 1);
  return {
    x: trajectory.startX + (trajectory.landingX - trajectory.startX) * clampedProgress,
    y:
      trajectory.startY +
      (trajectory.groundY - trajectory.startY) * clampedProgress * clampedProgress,
  };
};

const createSootSpriteFallSamples = (trajectory) => {
  let previousPoint = getSootSpriteParabolaPoint(trajectory, 0);
  let distance = 0;
  const samples = [
    {
      ...previousPoint,
      distance,
      progress: 0,
    },
  ];

  for (let index = 1; index <= SOOT_SPRITES_FALL_SAMPLE_COUNT; index += 1) {
    const progress = index / SOOT_SPRITES_FALL_SAMPLE_COUNT;
    const point = getSootSpriteParabolaPoint(trajectory, progress);
    distance += Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
    samples.push({
      ...point,
      distance,
      progress,
    });
    previousPoint = point;
  }

  return samples;
};

const getSootSpriteFallPointAtDistance = (trajectory, distance) => {
  const samples = trajectory.fallSamples;
  if (!samples?.length) return getSootSpriteParabolaPoint(trajectory, 0);
  if (distance <= 0) return samples[0];

  for (let index = 1; index < samples.length; index += 1) {
    const previousSample = samples[index - 1];
    const nextSample = samples[index];
    if (distance > nextSample.distance) continue;

    const span = nextSample.distance - previousSample.distance || 1;
    const segmentProgress = (distance - previousSample.distance) / span;
    return {
      distance,
      progress:
        previousSample.progress +
        (nextSample.progress - previousSample.progress) * segmentProgress,
      x: previousSample.x + (nextSample.x - previousSample.x) * segmentProgress,
      y: previousSample.y + (nextSample.y - previousSample.y) * segmentProgress,
    };
  }

  return samples[samples.length - 1];
};

const getSootSpriteFallScale = (pathProgress, runScale) => {
  const progress = clampNumber(pathProgress, 0, 1);
  const baseScale = 1 + (runScale - 1) * progress;
  const arcStretch = Math.sin(progress * Math.PI) * 0.04;
  return Number((baseScale + arcStretch).toFixed(3));
};

const getSootSpriteTransform = (point, scale) =>
  `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0) scale(${scale})`;

const getSootSpriteTimelineOffset = (trajectory, distance) => {
  if (!trajectory.duration || !trajectory.pathSpeed) return 0;
  if (distance <= trajectory.fallLength) {
    return clampNumber(distance / trajectory.pathSpeed / trajectory.duration, 0, 1);
  }

  const segment =
    trajectory.runSegments.find((candidate) => distance <= candidate.endDistance) ||
    trajectory.runSegments[trajectory.runSegments.length - 1];
  if (!segment) return 1;

  const elapsedTime =
    segment.startTime +
    (distance - segment.startDistance) / Math.max(0.001, segment.speed);
  return clampNumber(elapsedTime / trajectory.duration, 0, 1);
};

const createSootSpritePathKeyframes = (trajectory) => [
  ...trajectory.fallSamples.map((sample) => ({
    offset: getSootSpriteTimelineOffset(trajectory, sample.distance),
    opacity: 1,
    transform: getSootSpriteTransform(
      sample,
      getSootSpriteFallScale(sample.progress, trajectory.runScale)
    ),
  })),
  ...trajectory.runSegments.map((segment) => ({
    offset: clampNumber(segment.endTime / trajectory.duration, 0, 1),
    opacity: 1,
    transform: getSootSpriteTransform(
      { x: segment.endX, y: trajectory.exitY },
      trajectory.runScale
    ),
  })),
];

const animateSootSpriteElement = (sprite, trajectory) => {
  if (typeof sprite.animate !== "function") return null;
  sprite.classList.add("soot-sprite--scripted");
  return sprite.animate(createSootSpritePathKeyframes(trajectory), {
    delay: trajectory.delay,
    duration: trajectory.duration,
    easing: "linear",
    fill: "both",
  });
};

const getSootCandyGravityPoint = (trajectory, progress) => {
  const clampedProgress = clampNumber(progress, 0, 1);
  return {
    x:
      trajectory.startX +
      (trajectory.landingX - trajectory.startX) * clampedProgress,
    y:
      trajectory.startY +
      (trajectory.landingY - trajectory.startY) * clampedProgress * clampedProgress,
  };
};

const createSootCandyTrajectory = ({
  startX,
  startY,
  size,
  minHorizontalTravel,
  maxHorizontalTravel,
}) => {
  const landingY = getSootCandyLandingY(size);
  const safeStartX = clampNumber(startX, 6, window.innerWidth - size - 6);
  const safeStartY = clampNumber(
    startY,
    0,
    landingY - randomSootSpriteValue(18, 72)
  );
  const landingDirection = Math.random() < 0.5 ? -1 : 1;
  const landingX = clampNumber(
    safeStartX +
      landingDirection * randomSootSpriteValue(minHorizontalTravel, maxHorizontalTravel),
    6,
    window.innerWidth - size - 6
  );
  const trajectory = {
    startX: safeStartX,
    startY: safeStartY,
    landingX,
    landingY,
  };
  const fallQuarter = getSootCandyGravityPoint(trajectory, 0.25);
  const fallMidpoint = getSootCandyGravityPoint(trajectory, 0.5);
  const fallThreeQuarter = getSootCandyGravityPoint(trajectory, 0.75);

  return {
    ...trajectory,
    fallQuarterX: fallQuarter.x,
    fallQuarterY: fallQuarter.y,
    fallMidpointX: fallMidpoint.x,
    fallMidpointY: fallMidpoint.y,
    fallThreeQuarterX: fallThreeQuarter.x,
    fallThreeQuarterY: fallThreeQuarter.y,
  };
};

const setSootCandyTrajectoryProperties = (candy, trajectory) => {
  setSootSpritePx(candy, "--candy-x0", trajectory.startX);
  setSootSpritePx(candy, "--candy-y0", trajectory.startY);
  setSootSpritePx(candy, "--candy-x-fall-25", trajectory.fallQuarterX);
  setSootSpritePx(candy, "--candy-y-fall-25", trajectory.fallQuarterY);
  setSootSpritePx(candy, "--candy-x-fall-50", trajectory.fallMidpointX);
  setSootSpritePx(candy, "--candy-y-fall-50", trajectory.fallMidpointY);
  setSootSpritePx(candy, "--candy-x-fall-75", trajectory.fallThreeQuarterX);
  setSootSpritePx(candy, "--candy-y-fall-75", trajectory.fallThreeQuarterY);
  setSootSpritePx(candy, "--candy-x-land", trajectory.landingX);
  setSootSpritePx(candy, "--candy-y-land", trajectory.landingY);
};

const setSootCandySpinProperties = (candy, spin) => {
  candy.style.setProperty("--candy-spin-25", `${(spin * 0.25).toFixed(0)}deg`);
  candy.style.setProperty("--candy-spin-50", `${(spin * 0.5).toFixed(0)}deg`);
  candy.style.setProperty("--candy-spin-75", `${(spin * 0.75).toFixed(0)}deg`);
  candy.style.setProperty("--candy-spin", `${spin.toFixed(0)}deg`);
};

const setSootCandyTimingProperties = (candy, { delay, fallDuration }) => {
  const landingDelay =
    delay + fallDuration * SOOT_CANDY_LANDING_PROGRESS;
  const fadeDelay = landingDelay + SOOT_CANDY_HOLD_AFTER_LANDING_MS;

  candy.style.setProperty("--candy-delay", `${delay}ms`);
  candy.style.setProperty("--candy-fall-duration", `${fallDuration}ms`);
  candy.style.setProperty(
    "--candy-hold-duration",
    `${SOOT_CANDY_HOLD_AFTER_LANDING_MS}ms`
  );
  candy.style.setProperty(
    "--candy-fade-duration",
    `${SOOT_CANDY_FADE_DURATION_MS}ms`
  );
  candy.style.setProperty("--candy-fade-delay", `${fadeDelay}ms`);
};

const getSootSpriteRunExitX = (size, direction) =>
  direction < 0
    ? -size - randomSootSpriteValue(60, 190)
    : window.innerWidth + randomSootSpriteValue(60, 190);

const isSootSpriteOnScreenAtX = (x, size) => x + size > 0 && x < window.innerWidth;

const createSootSpriteRunSegment = ({
  startX,
  endX,
  startDistance,
  groundY,
}) => {
  const length = Math.max(1, Math.hypot(endX - startX, 0));
  return {
    startDistance,
    endDistance: startDistance + length,
    startX,
    endX,
    y: groundY,
    length,
  };
};

const applySootSpriteRunSegmentTiming = ({
  fallLength,
  pathSpeed,
  runSegments,
  switchSpeedMultiplier,
}) => {
  let elapsedTime = fallLength / pathSpeed;
  return runSegments.map((segment, index) => {
    const speedMultiplier = index === 0 ? 1 : switchSpeedMultiplier;
    const speed = pathSpeed * speedMultiplier;
    const duration = segment.length / speed;
    const timedSegment = {
      ...segment,
      duration,
      endTime: elapsedTime + duration,
      speed,
      speedMultiplier,
      startTime: elapsedTime,
    };
    elapsedTime = timedSegment.endTime;
    return timedSegment;
  });
};

const createSootSpriteSpawnGrid = (launchRect, spriteCount) => {
  const aspectRatio = launchRect.width / Math.max(1, launchRect.height);
  const columns = clampNumber(
    Math.round(Math.sqrt(spriteCount * aspectRatio)),
    1,
    spriteCount
  );
  const rows = Math.ceil(spriteCount / columns);
  const horizontalInset = clampNumber(launchRect.width * 0.08, 8, 20);
  const verticalInset = clampNumber(launchRect.height * 0.1, 8, 20);
  const usableWidth = Math.max(1, launchRect.width - horizontalInset * 2);
  const usableHeight = Math.max(1, launchRect.height - verticalInset * 2);

  return Array.from({ length: spriteCount }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const spritesInRow = Math.min(columns, spriteCount - row * columns);
    return {
      x:
        launchRect.left +
        horizontalInset +
        (usableWidth * (column + 0.5)) / spritesInRow,
      y:
        launchRect.top +
        verticalInset +
        (usableHeight * (row + 0.5)) / rows,
    };
  });
};

const createSootSpriteTrajectory = (launchRect, { startPoint } = {}) => {
  const size = Math.round(randomSootSpriteValue(24, 40));
  const groundY = getSootSpritesGroundY(size);
  const minimumFallDistance = Math.min(24, size);
  const startMinX = launchRect.left + 4;
  const startMaxX = Math.max(startMinX, launchRect.left + launchRect.width - size - 4);
  const startMinY = launchRect.top + 4;
  const startMaxY = clampNumber(
    groundY - minimumFallDistance,
    startMinY,
    launchRect.top + launchRect.height - size - 4
  );
  const startX = startPoint
    ? clampNumber(startPoint.x - size / 2, startMinX, startMaxX)
    : randomSootSpriteValue(startMinX, startMaxX);
  const startY = startPoint
    ? clampNumber(startPoint.y - size / 2, startMinY, startMaxY)
    : randomSootSpriteValue(startMinY, startMaxY);
  const minLandingX = 10;
  const maxLandingX = Math.max(minLandingX, window.innerWidth - size - 10);
  const leftTravel = Math.max(0, startX - minLandingX);
  const rightTravel = Math.max(0, maxLandingX - startX);
  let fallSide = Math.random() < 0.5 ? -1 : 1;
  if ((fallSide < 0 ? leftTravel : rightTravel) < 80) {
    fallSide = leftTravel > rightTravel ? -1 : 1;
  }
  const availableFallTravel = fallSide < 0 ? leftTravel : rightTravel;
  const maxFallTravel = Math.min(availableFallTravel, randomSootSpriteValue(190, 380));
  const minFallTravel = Math.min(maxFallTravel, 72);
  const fallTravel =
    maxFallTravel <= 0 ? 0 : randomSootSpriteValue(minFallTravel, maxFallTravel);
  const landingX = startX + fallSide * fallTravel;
  const initialRunDirection = Math.random() < 0.5 ? -1 : 1;
  const initialExitX = getSootSpriteRunExitX(size, initialRunDirection);
  const exitY = groundY;
  const delay = 0;
  const baseDuration = randomSootSpriteValue(3600, 4800);
  const runScale = randomSootSpriteValue(0.78, 1.08);
  const directionSwitchDelay = randomSootSpriteValue(
    SOOT_SPRITES_DIRECTION_SWITCH_MIN_DELAY_MS,
    SOOT_SPRITES_DIRECTION_SWITCH_MAX_DELAY_MS
  );
  const directionSwitchRoll = Math.random();
  const trajectory = {
    size,
    startX,
    startY,
    groundY,
    landingX,
    exitX: initialExitX,
    exitY,
    delay,
    duration: baseDuration,
    initialRunDirection,
    runScale,
  };
  const fallSamples = createSootSpriteFallSamples(trajectory);
  const fallLength = fallSamples[fallSamples.length - 1].distance;
  const initialRunSegment = createSootSpriteRunSegment({
    startX: landingX,
    endX: initialExitX,
    startDistance: fallLength,
    groundY,
  });
  const basePathLength = Math.max(1, fallLength + initialRunSegment.length);
  const pathSpeed = Math.max(SOOT_SPRITES_MIN_PATH_SPEED, basePathLength / baseDuration);
  const switchRunDistance = pathSpeed * directionSwitchDelay;
  const switchX = landingX + initialRunDirection * switchRunDistance;
  const shouldSwitchDirection =
    directionSwitchRoll < SOOT_SPRITES_DIRECTION_SWITCH_CHANCE &&
    switchRunDistance < initialRunSegment.length &&
    isSootSpriteOnScreenAtX(switchX, size);
  const directionSwitchSpeedMultiplier = shouldSwitchDirection
    ? randomSootSpriteValue(1, 2)
    : 1;
  const runSegments = shouldSwitchDirection
    ? [
        createSootSpriteRunSegment({
          startX: landingX,
          endX: switchX,
          startDistance: fallLength,
          groundY,
        }),
      ]
    : [initialRunSegment];

  if (shouldSwitchDirection) {
    const switchedExitX = getSootSpriteRunExitX(size, -initialRunDirection);
    runSegments.push(
      createSootSpriteRunSegment({
        startX: switchX,
        endX: switchedExitX,
        startDistance: runSegments[0].endDistance,
        groundY,
      })
    );
  }

  const exitX = runSegments[runSegments.length - 1].endX;
  const runLength = runSegments.reduce((total, segment) => total + segment.length, 0);
  const totalPathLength = Math.max(1, fallLength + runLength);
  const timedRunSegments = applySootSpriteRunSegmentTiming({
    fallLength,
    pathSpeed,
    runSegments,
    switchSpeedMultiplier: directionSwitchSpeedMultiplier,
  });
  const fallDuration = fallLength / pathSpeed;
  const totalPathDuration =
    timedRunSegments[timedRunSegments.length - 1]?.endTime || fallDuration;
  const measuredTrajectory = {
    ...trajectory,
    directionSwitchDelay,
    directionSwitchRoll,
    directionSwitchSpeedMultiplier,
    didSwitchDirection: shouldSwitchDirection,
    duration: totalPathDuration,
    exitX,
    fallDuration,
    fallLength,
    fallSamples,
    landingProgress: fallDuration / totalPathDuration,
    pathSpeed,
    runSegments: timedRunSegments,
    runLength,
    totalPathDuration,
    totalPathLength,
  };
  const fallQuarter = getSootSpriteFallPointAtDistance(
    measuredTrajectory,
    fallLength * 0.25
  );
  const fallMidpoint = getSootSpriteFallPointAtDistance(
    measuredTrajectory,
    fallLength * 0.5
  );
  const fallThreeQuarter = getSootSpriteFallPointAtDistance(
    measuredTrajectory,
    fallLength * 0.75
  );

  return {
    ...measuredTrajectory,
    fallQuarterX: fallQuarter.x,
    fallQuarterY: fallQuarter.y,
    fallMidpointX: fallMidpoint.x,
    fallMidpointY: fallMidpoint.y,
    fallThreeQuarterX: fallThreeQuarter.x,
    fallThreeQuarterY: fallThreeQuarter.y,
  };
};

const getSootSpriteTrajectoryPoint = (trajectory, progress) => {
  const clampedProgress = clampNumber(progress, 0, 1);
  const elapsedTime = clampedProgress * trajectory.duration;
  if (elapsedTime <= trajectory.fallDuration) {
    return getSootSpriteFallPointAtDistance(
      trajectory,
      elapsedTime * trajectory.pathSpeed
    );
  }

  const segment =
    trajectory.runSegments.find((candidate) => elapsedTime <= candidate.endTime) ||
    trajectory.runSegments[trajectory.runSegments.length - 1];
  const segmentProgress =
    (elapsedTime - segment.startTime) / Math.max(1, segment.duration);
  return {
    x: segment.startX + (segment.endX - segment.startX) * segmentProgress,
    y: segment.y,
  };
};

const getSootSpriteAirTrailProgress = (trajectory) => {
  const start = 0.08;
  const end = clampNumber(trajectory.landingProgress - 0.04, start, 0.92);
  return randomSootSpriteValue(start, end);
};

const getSootSpriteGroundRunProgress = (trajectory) => {
  const start = clampNumber(trajectory.landingProgress + 0.04, 0.08, 0.96);
  return randomSootSpriteValue(start, 0.96);
};

const createSootSpriteElement = (index, trajectory, { paused = false } = {}) => {
  const sprite = document.createElement("span");
  sprite.className = "soot-sprite";
  sprite.setAttribute("aria-hidden", "true");

  setSootSpritePx(sprite, "--soot-x0", trajectory.startX);
  setSootSpritePx(sprite, "--soot-y0", trajectory.startY);
  setSootSpritePx(sprite, "--soot-x-fall-25", trajectory.fallQuarterX);
  setSootSpritePx(sprite, "--soot-y-fall-25", trajectory.fallQuarterY);
  setSootSpritePx(sprite, "--soot-x-fall-50", trajectory.fallMidpointX);
  setSootSpritePx(sprite, "--soot-y-fall-50", trajectory.fallMidpointY);
  setSootSpritePx(sprite, "--soot-x-fall-75", trajectory.fallThreeQuarterX);
  setSootSpritePx(sprite, "--soot-y-fall-75", trajectory.fallThreeQuarterY);
  setSootSpritePx(sprite, "--soot-x-land", trajectory.landingX);
  setSootSpritePx(sprite, "--soot-y-land", trajectory.groundY);
  setSootSpritePx(sprite, "--soot-x3", trajectory.exitX);
  setSootSpritePx(sprite, "--soot-y3", trajectory.exitY);
  setSootSpritePx(sprite, "--soot-size", trajectory.size);
  sprite.style.setProperty("--soot-delay", `${trajectory.delay}ms`);
  sprite.style.setProperty("--soot-duration", `${trajectory.duration}ms`);
  sprite.style.setProperty("--soot-run-scale", String(trajectory.runScale));
  sprite.style.setProperty(
    "--soot-body-radius",
    `${Math.round(randomSootSpriteValue(42, 58))}% ${Math.round(
      randomSootSpriteValue(42, 58)
    )}% ${Math.round(randomSootSpriteValue(42, 58))}% ${Math.round(
      randomSootSpriteValue(42, 58)
    )}% / ${Math.round(randomSootSpriteValue(42, 58))}% ${Math.round(
      randomSootSpriteValue(42, 58)
    )}% ${Math.round(randomSootSpriteValue(42, 58))}% ${Math.round(
      randomSootSpriteValue(42, 58)
    )}%`
  );
  sprite.style.setProperty("--soot-wobble-delay", `${index * -83}ms`);
  sprite.style.setProperty("--soot-left-eye-width", `${randomSootSpriteValue(7, 10).toFixed(1)}px`);
  sprite.style.setProperty("--soot-left-eye-height", `${randomSootSpriteValue(8, 12).toFixed(1)}px`);
  sprite.style.setProperty("--soot-right-eye-width", `${randomSootSpriteValue(7, 10).toFixed(1)}px`);
  sprite.style.setProperty("--soot-right-eye-height", `${randomSootSpriteValue(8, 12).toFixed(1)}px`);
  sprite.style.setProperty("--soot-left-eye-rotate", `${randomSootSpriteValue(-10, 9).toFixed(1)}deg`);
  sprite.style.setProperty("--soot-right-eye-rotate", `${randomSootSpriteValue(-9, 10).toFixed(1)}deg`);

  const body = document.createElement("span");
  body.className = "soot-sprite-body";
  const leftEye = document.createElement("span");
  leftEye.className = "soot-sprite-eye soot-sprite-eye--left";
  const rightEye = document.createElement("span");
  rightEye.className = "soot-sprite-eye soot-sprite-eye--right";
  body.append(leftEye, rightEye);
  sprite.append(body);
  const motion = animateSootSpriteElement(sprite, trajectory);
  if (paused && motion) {
    motion.pause();
    sootSpriteMotionAnimations.set(sprite, motion);
  }
  return sprite;
};

const createSootCandyElement = (launchRect) => {
  const candy = document.createElement("span");
  candy.className = "soot-star-candy";
  candy.setAttribute("aria-hidden", "true");
  const size = Math.round(randomSootSpriteValue(8, 14));
  const x0 = launchRect.left + randomSootSpriteValue(8, Math.max(10, launchRect.width - 16));
  const y0 = launchRect.top + randomSootSpriteValue(8, Math.max(10, launchRect.height - 12));
  const trajectory = createSootCandyTrajectory({
    startX: x0,
    startY: y0,
    size,
    minHorizontalTravel: 44,
    maxHorizontalTravel: 250,
  });
  const spin = randomSootSpriteValue(-820, 820);
  setSootCandyTrajectoryProperties(candy, trajectory);
  setSootSpritePx(candy, "--candy-size", size);
  candy.style.setProperty("--candy-color", randomSootCandyColor());
  setSootCandyTimingProperties(candy, {
    delay: randomSootSpriteValue(140, 520),
    fallDuration: randomSootSpriteValue(3600, 4800),
  });
  setSootCandySpinProperties(candy, spin);
  return candy;
};

const createSootTrailCandyElement = (trajectory, progress) => {
  const candy = document.createElement("span");
  candy.className = "soot-star-candy soot-star-candy--trail";
  candy.setAttribute("aria-hidden", "true");
  const size = Math.round(randomSootSpriteValue(6, 11));
  const origin = getSootSpriteTrajectoryPoint(trajectory, progress);
  const x0 = origin.x + randomSootSpriteValue(-12, 12);
  const y0 = origin.y + randomSootSpriteValue(-10, 14);
  const candyTrajectory = createSootCandyTrajectory({
    startX: x0,
    startY: y0,
    size,
    minHorizontalTravel: 36,
    maxHorizontalTravel: 176,
  });
  const spin = randomSootSpriteValue(-620, 620);
  setSootCandyTrajectoryProperties(candy, candyTrajectory);
  setSootSpritePx(candy, "--candy-size", size);
  candy.style.setProperty("--candy-color", randomSootCandyColor());
  setSootCandyTimingProperties(candy, {
    delay:
      trajectory.delay +
      trajectory.duration * progress +
      randomSootSpriteValue(-90, 140),
    fallDuration: randomSootSpriteValue(3200, 4300),
  });
  setSootCandySpinProperties(candy, spin);
  return candy;
};

const createSootPuffElement = (launchRect, large = false) => {
  const puff = document.createElement("span");
  puff.className = large ? "soot-puff soot-puff--large" : "soot-puff";
  puff.setAttribute("aria-hidden", "true");
  const size = randomSootSpriteValue(large ? 192 : 84, large ? 380 : 208);
  const x0 = launchRect.left + randomSootSpriteValue(-20, launchRect.width + 20);
  const y0 = launchRect.top + randomSootSpriteValue(-14, launchRect.height + 20);
  setSootSpritePx(puff, "--puff-x0", x0);
  setSootSpritePx(puff, "--puff-y0", y0);
  setSootSpritePx(puff, "--puff-x1", x0 + randomSootSpriteValue(-320, 320));
  setSootSpritePx(puff, "--puff-y1", y0 + randomSootSpriteValue(large ? -140 : -210, large ? 230 : 150));
  setSootSpritePx(puff, "--puff-size", size);
  puff.style.setProperty(
    "--puff-delay",
    `${randomSootSpriteValue(40, 360)}ms`
  );
  puff.style.setProperty("--puff-duration", `${randomSootSpriteValue(5400, 7600)}ms`);
  return puff;
};

const createSootTrailPuffElement = (trajectory, index, progress) => {
  const puff = document.createElement("span");
  puff.className = index % 5 === 0 ? "soot-puff soot-puff--trail soot-puff--large" : "soot-puff soot-puff--trail";
  puff.setAttribute("aria-hidden", "true");
  const direction = trajectory.exitX < trajectory.landingX ? -1 : 1;
  const size = randomSootSpriteValue(76, 196);
  const origin = getSootSpriteTrajectoryPoint(trajectory, progress);
  const x0 = origin.x + direction * randomSootSpriteValue(4, 28);
  const y0 = origin.y + randomSootSpriteValue(-10, 18);
  setSootSpritePx(puff, "--puff-x0", x0);
  setSootSpritePx(puff, "--puff-y0", y0);
  setSootSpritePx(puff, "--puff-x1", x0 + direction * randomSootSpriteValue(70, 240));
  setSootSpritePx(puff, "--puff-y1", y0 + randomSootSpriteValue(-46, 54));
  setSootSpritePx(puff, "--puff-size", size);
  puff.style.setProperty(
    "--puff-delay",
    `${trajectory.delay + trajectory.duration * progress + randomSootSpriteValue(-120, 180)}ms`
  );
  puff.style.setProperty("--puff-duration", `${randomSootSpriteValue(5300, 7300)}ms`);
  return puff;
};

const showSootSpritesSwarm = (launchRect = getSootSpritesLaunchRect()) => {
  cleanupSootSpritesOverlay();
  const overlay = document.createElement("div");
  overlay.className = "soot-sprites-swarm is-staged";
  overlay.style.zIndex = String(getSootSpritesStagedZIndex());
  overlay.setAttribute("aria-hidden", "true");

  const spriteCount =
    window.innerWidth < 560 ? SOOT_SPRITES_MOBILE_COUNT : SOOT_SPRITES_DESKTOP_COUNT;
  const spawnGrid = createSootSpriteSpawnGrid(launchRect, spriteCount);
  const trajectories = spawnGrid.map((startPoint) =>
    createSootSpriteTrajectory(launchRect, { startPoint })
  );
  trajectories.forEach((trajectory, index) => {
    overlay.append(createSootSpriteElement(index, trajectory, { paused: true }));
  });

  const airTrailCandyCount = Math.round(
    spriteCount * SOOT_SPRITES_AIR_TRAIL_CANDIES_PER_SPRITE
  );
  for (let index = 0; index < airTrailCandyCount; index += 1) {
    const trajectory = trajectories[index % trajectories.length];
    overlay.append(
      createSootTrailCandyElement(trajectory, getSootSpriteAirTrailProgress(trajectory))
    );
  }

  // Ground-run candy is intentionally twice as dense as the airborne trail.
  const groundRunCandyCount = Math.round(
    spriteCount *
      SOOT_SPRITES_AIR_TRAIL_CANDIES_PER_SPRITE *
      SOOT_SPRITES_GROUND_RUN_CANDY_MULTIPLIER
  );
  for (let index = 0; index < groundRunCandyCount; index += 1) {
    const trajectory = trajectories[index % trajectories.length];
    overlay.append(
      createSootTrailCandyElement(trajectory, getSootSpriteGroundRunProgress(trajectory))
    );
  }

  const trailPuffCount = Math.round(spriteCount * 1.4);
  for (let index = 0; index < trailPuffCount; index += 1) {
    const progress = 0.04 + ((index * 0.13) % 0.92);
    overlay.append(
      createSootTrailPuffElement(trajectories[index % trajectories.length], index, progress)
    );
  }

  const candyCount = Math.round(spriteCount * 1.28);
  for (let index = 0; index < candyCount; index += 1) {
    overlay.append(createSootCandyElement(launchRect));
  }

  const puffCount = Math.round(spriteCount * 0.48);
  for (let index = 0; index < puffCount; index += 1) {
    overlay.append(createSootPuffElement(launchRect, index % 5 === 0));
  }

  document.body.append(overlay);
  document.body.classList.add("is-soot-sprites-active");
  sootSpritesOverlay = overlay;
  sootSpritesCleanupTimer = window.setTimeout(cleanupSootSpritesOverlay, SOOT_SPRITES_CLEANUP_MS);
  return overlay;
};

const releaseSootSpritesSwarm = () => {
  const overlay = sootSpritesOverlay;
  if (!overlay?.classList.contains("is-staged")) return;
  overlay.classList.remove("is-staged");
  overlay.style.removeProperty("z-index");
  overlay.querySelectorAll(".soot-sprite").forEach((sprite) => {
    sootSpriteMotionAnimations.get(sprite)?.play();
  });
};

const showSootSpritesWindow = () => {
  const didOpen = showManagedRandomEventWindow(sootSpritesWindow, {
    clampAfterMediaLoad: true,
  });
  if (didOpen) reserveSootSpritesSpawnLane();
};

const closeSootSpritesWindow = () => {
  clearSootSpritesLifecycleTimers();
  setSootSpritesWindowLoading(false);
  closeManagedRandomEventWindow(sootSpritesWindow);
};

const inspectSootSpritesGpu = () => {
  if (!sootSpritesWindow || sootSpritesWindow.classList.contains("is-hidden")) return;
  const launchRect = getSootSpritesLaunchRect();
  clearSootSpritesLifecycleTimers();
  setSootSpritesWindowLoading(true);
  sootSpritesRevealTimer = window.setTimeout(() => {
    sootSpritesRevealTimer = null;
    const overlay = showSootSpritesSwarm(launchRect);
    // The procedural sprites are ready after their nodes have been committed to a frame.
    window.requestAnimationFrame(() => {
      if (overlay !== sootSpritesOverlay) return;
      sootSpritesWindowHoldTimer = window.setTimeout(() => {
        sootSpritesWindowHoldTimer = null;
        setSootSpritesWindowLoading(false);
        closeManagedRandomEventWindow(sootSpritesWindow);
      }, SOOT_SPRITES_WINDOW_HOLD_AFTER_LOAD_MS);
    });
  }, SOOT_SPRITES_REVEAL_DELAY_MS);
};

registerRandomEvent({
  id: "soot-sprites",
  preloadTargets: () => [sootSpritesWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isSootSpritesVisible,
  canTrigger: () => !isSootSpritesVisible(),
  run: () => {
    showSootSpritesWindow();
  },
  bind: () => {
    bindRandomEventButton(sootSpritesYes, inspectSootSpritesGpu);
    bindRandomEventButton(sootSpritesNo, closeSootSpritesWindow);
    bindManagedRandomEventWindowAnimation(sootSpritesWindow, {
      afterClose: releaseSootSpritesSwarm,
    });
  },
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  sootSpritesWindow,
]);

window.homeEventSootSprites = Object.freeze({
  isSootSpritesVisible,
  sootSpritesWindow,
});
})();