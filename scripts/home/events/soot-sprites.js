(() => {
  const { byId, taskbar } = window.homeDom;
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
  const { clampNumber } = window.homeUtil;

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

  /*
   * Pixel-art sprites (docs/notes/tickets/A_soot-sprite-redesign__20260929.md, candidate I).
   * Each sprite draws one of three looks on a cell grid of `round(size / unit)` cells per body:
   * a black disc, a radial coat of single-cell hairs, white eyes with a baked gaze. The whole
   * swarm shares one canvas sheet encoded once; every sprite shows its frames through
   * `background-position` scaled with `image-rendering: pixelated`.
   */
  const SOOT_LOOKS = Object.freeze([
    Object.freeze({
      unit: 2,
      fur: Object.freeze({ min: 0.1, max: 0.22, density: 1.3, curl: 0.16 }),
    }),
    Object.freeze({
      unit: 1.5,
      fur: Object.freeze({ min: 0.14, max: 0.3, density: 0.9, curl: 0.3 }),
    }),
    Object.freeze({
      unit: 2,
      fur: Object.freeze({ min: 0.1, max: 0.22, density: 1.3, curl: 0.16 }),
    }),
  ]);

  const SOOT_MIN_BODY_CELLS = 8;

  const SOOT_EYE_WIDTH = 0.36;

  const SOOT_EYE_GAP = 0.38;

  const SOOT_EYE_LIFT = 0.05;

  const SOOT_PUPIL = 0.07;

  const SOOT_FRAMES_PER_SPRITE = 3;

  /* Sprites are 24–40 px; the sheet is sized for the widest grid so it can be allocated first. */
  const SOOT_SPRITE_MAX_SIZE = 40;

  const SOOT_INK = "#000";

  const SOOT_EYE_WHITE = "#fff";

  /* The coat flickers between two drawings every step; a blink frame shows for one step. */
  const SOOT_BOIL_STEP_MS = 160;

  const SOOT_BLINK_MIN_MS = 2400;

  const SOOT_BLINK_MAX_MS = 4800;

  /* Irregular tremble: a whole-cell offset every 55–115 ms, larger on the ground, with twitches and hops. */
  const SOOT_JITTER_MIN_MS = 55;

  const SOOT_JITTER_MAX_MS = 115;

  const SOOT_JITTER_FALL_REACH = 0.03;

  const SOOT_JITTER_RUN_REACH = 0.06;

  const SOOT_JITTER_TWITCH_CHANCE = 0.18;

  const SOOT_JITTER_HOP_CHANCE = 0.06;

  const SOOT_JITTER_HOP_RISE = 0.22;

  /* Pixel candy: the five colours in two 9-cell star shapes on one sheet. */
  const SOOT_CANDY_CELLS = 9;

  const SOOT_CANDY_SHAPES = Object.freeze([
    Object.freeze([
      "....X....",
      ".X..X..X.",
      "..XXXXX..",
      ".XXXXXXX.",
      "XXXXXXXXX",
      ".XXXXXXX.",
      "..XXXXX..",
      ".X..X..X.",
      "....X....",
    ]),
    Object.freeze([
      "X...X...X",
      ".X.XXX.X.",
      "..XXXXX..",
      ".XXXXXXX.",
      "X.XXXXX.X",
      ".XXXXXXX.",
      "..XXXXX..",
      ".X.XXX.X.",
      "X...X...X",
    ]),
  ]);

  /* Pixel smoke: six 96×48-cell blobs in three translucent shades of black with a dithered rim. */
  const SOOT_PUFF_CELLS = Object.freeze({ width: 96, height: 48 });

  const SOOT_PUFF_SHAPES = 6;

  /*
   * The swarm is built across animation frames while the alert holds, so no task runs long:
   * the cost of each step is the style resolution of the elements it appends, not the drawing.
   */
  const SOOT_SWARM_SPRITE_BATCH = 2;

  const SOOT_SWARM_EFFECT_BATCH = 5;

  const sootSpriteBehaviourAnimations = new WeakMap();

  const sootReducedMotionQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  const prefersSootReducedMotion = () => Boolean(sootReducedMotionQuery?.matches);

  let sootEffectSheets = null;

  const isSootSpritesVisible = () =>
    isManagedRandomEventWindowVisible(sootSpritesWindow) ||
    Boolean(sootSpritesOverlay || sootSpritesRevealTimer || sootSpritesWindowHoldTimer);

  const randomSootSpriteValue = (min, max) => min + Math.random() * (max - min);

  /** A random colour and star shape, as a slot on the shared candy sheet. */
  const setSootCandyLook = (candy) => {
    const color = Math.floor(Math.random() * SOOT_SPRITES_CANDY_COLORS.length);
    const shape = Math.floor(Math.random() * SOOT_CANDY_SHAPES.length);
    candy.style.setProperty("--candy-color", SOOT_SPRITES_CANDY_COLORS[color]);
    candy.style.setProperty(
      "--soot-candy-slot",
      String(shape * SOOT_SPRITES_CANDY_COLORS.length + color),
    );
    // Inline, not inherited through a custom property: a data URL in var() would be re-parsed
    // on every style resolution of the element.
    candy.style.backgroundImage = getSootEffectSheets().candy.image;
  };

  const setSootPuffLook = (puff) => {
    puff.style.setProperty(
      "--soot-puff-shape",
      String(Math.floor(Math.random() * SOOT_PUFF_SHAPES)),
    );
    puff.style.backgroundImage = getSootEffectSheets().puff.image;
  };

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
      toolbarTop - sootSpritesWindow.offsetHeight - SOOT_SPRITES_SPAWN_CLEARANCE,
    );
    setRandomEventWindowPosition(
      sootSpritesWindow,
      Number.isFinite(currentLeft) ? currentLeft : 12,
      Math.min(Number.isFinite(currentTop) ? currentTop : maxTop, maxTop),
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
      segment.startTime + (distance - segment.startDistance) / Math.max(0.001, segment.speed);
    return clampNumber(elapsedTime / trajectory.duration, 0, 1);
  };

  const createSootSpritePathKeyframes = (trajectory) => [
    ...trajectory.fallSamples.map((sample) => ({
      offset: getSootSpriteTimelineOffset(trajectory, sample.distance),
      opacity: 1,
      transform: getSootSpriteTransform(
        sample,
        getSootSpriteFallScale(sample.progress, trajectory.runScale),
      ),
    })),
    ...trajectory.runSegments.map((segment) => ({
      offset: clampNumber(segment.endTime / trajectory.duration, 0, 1),
      opacity: 1,
      transform: getSootSpriteTransform(
        { x: segment.endX, y: trajectory.exitY },
        trajectory.runScale,
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
      x: trajectory.startX + (trajectory.landingX - trajectory.startX) * clampedProgress,
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
    const safeStartY = clampNumber(startY, 0, landingY - randomSootSpriteValue(18, 72));
    const landingDirection = Math.random() < 0.5 ? -1 : 1;
    const landingX = clampNumber(
      safeStartX +
        landingDirection * randomSootSpriteValue(minHorizontalTravel, maxHorizontalTravel),
      6,
      window.innerWidth - size - 6,
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
    const landingDelay = delay + fallDuration * SOOT_CANDY_LANDING_PROGRESS;
    const fadeDelay = landingDelay + SOOT_CANDY_HOLD_AFTER_LANDING_MS;

    candy.style.setProperty("--candy-delay", `${delay}ms`);
    candy.style.setProperty("--candy-fall-duration", `${fallDuration}ms`);
    candy.style.setProperty("--candy-hold-duration", `${SOOT_CANDY_HOLD_AFTER_LANDING_MS}ms`);
    candy.style.setProperty("--candy-fade-duration", `${SOOT_CANDY_FADE_DURATION_MS}ms`);
    candy.style.setProperty("--candy-fade-delay", `${fadeDelay}ms`);
  };

  const getSootSpriteRunExitX = (size, direction) =>
    direction < 0
      ? -size - randomSootSpriteValue(60, 190)
      : window.innerWidth + randomSootSpriteValue(60, 190);

  const isSootSpriteOnScreenAtX = (x, size) => x + size > 0 && x < window.innerWidth;

  const createSootSpriteRunSegment = ({ startX, endX, startDistance, groundY }) => {
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
    const columns = clampNumber(Math.round(Math.sqrt(spriteCount * aspectRatio)), 1, spriteCount);
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
        x: launchRect.left + horizontalInset + (usableWidth * (column + 0.5)) / spritesInRow,
        y: launchRect.top + verticalInset + (usableHeight * (row + 0.5)) / rows,
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
      launchRect.top + launchRect.height - size - 4,
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
    const fallTravel = maxFallTravel <= 0 ? 0 : randomSootSpriteValue(minFallTravel, maxFallTravel);
    const landingX = startX + fallSide * fallTravel;
    const initialRunDirection = Math.random() < 0.5 ? -1 : 1;
    const initialExitX = getSootSpriteRunExitX(size, initialRunDirection);
    const exitY = groundY;
    const delay = 0;
    const baseDuration = randomSootSpriteValue(3600, 4800);
    const runScale = randomSootSpriteValue(0.78, 1.08);
    const directionSwitchDelay = randomSootSpriteValue(
      SOOT_SPRITES_DIRECTION_SWITCH_MIN_DELAY_MS,
      SOOT_SPRITES_DIRECTION_SWITCH_MAX_DELAY_MS,
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
    const directionSwitchSpeedMultiplier = shouldSwitchDirection ? randomSootSpriteValue(1, 2) : 1;
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
        }),
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
    const fallQuarter = getSootSpriteFallPointAtDistance(measuredTrajectory, fallLength * 0.25);
    const fallMidpoint = getSootSpriteFallPointAtDistance(measuredTrajectory, fallLength * 0.5);
    const fallThreeQuarter = getSootSpriteFallPointAtDistance(
      measuredTrajectory,
      fallLength * 0.75,
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
      return getSootSpriteFallPointAtDistance(trajectory, elapsedTime * trajectory.pathSpeed);
    }

    const segment =
      trajectory.runSegments.find((candidate) => elapsedTime <= candidate.endTime) ||
      trajectory.runSegments[trajectory.runSegments.length - 1];
    const segmentProgress = (elapsedTime - segment.startTime) / Math.max(1, segment.duration);
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

  /** Cell geometry for one sprite: body diameter in cells and the frame size that fits the coat. */
  const getSootSpriteGeometry = (look, size) => {
    const bodyCells = Math.max(SOOT_MIN_BODY_CELLS, Math.round(size / look.unit));
    const furCells = Math.ceil(bodyCells * look.fur.max) + 1;
    const cells = bodyCells + furCells * 2;
    return { bodyCells, cells, centre: cells / 2, cellPx: size / bodyCells };
  };

  const fillSootCell = (context, x, y) => {
    context.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  };

  /** Fills the cells whose centres fall inside the ellipse; `reach` below 1 trims the corner cells. */
  const fillSootEllipse = (context, cx, cy, rx, ry, reach = 1) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= reach) fillSootCell(context, x, y);
      }
    }
  };

  /** Single-cell hairs rooted one cell inside the body edge, each with its own length and bend. */
  const drawSootCoat = (context, geometry, fur) => {
    const { bodyCells, centre } = geometry;
    const radius = bodyCells / 2;
    const count = Math.round(Math.PI * bodyCells * fur.density);
    const step = (Math.PI * 2) / count;
    for (let index = 0; index < count; index += 1) {
      const angle = step * index + randomSootSpriteValue(-step * 0.4, step * 0.4);
      const length = randomSootSpriteValue(fur.min, fur.max) * bodyCells;
      const bend = randomSootSpriteValue(-fur.curl, fur.curl);
      for (let distance = radius - 1; distance <= radius + length; distance += 0.5) {
        const along = Math.max(0, distance - radius) / Math.max(length, 0.5);
        const hairAngle = angle + bend * along;
        fillSootCell(
          context,
          centre + distance * Math.cos(hairAngle),
          centre + distance * Math.sin(hairAngle),
        );
      }
    }
  };

  /** White ovals with trimmed corners and a square pupil of whole cells kept inside the white. */
  const drawSootEyes = (context, geometry, gaze, { closed = false } = {}) => {
    const { bodyCells, centre } = geometry;
    const rx = (SOOT_EYE_WIDTH * bodyCells) / 2;
    const ry = rx * 1.15;
    const eyeY = centre - SOOT_EYE_LIFT * bodyCells;
    const pupil = Math.max(1, Math.round(bodyCells * SOOT_PUPIL));
    const reachX = Math.max(0, Math.floor(rx - pupil / 2 - 1));
    const reachY = Math.max(0, Math.floor(ry - pupil / 2 - 1));
    [-1, 1].forEach((side) => {
      const eyeX = centre + (side * SOOT_EYE_GAP * bodyCells) / 2;
      context.fillStyle = SOOT_EYE_WHITE;
      if (closed) {
        for (let x = Math.floor(eyeX - rx * 0.8); x < Math.ceil(eyeX + rx * 0.8); x += 1) {
          fillSootCell(context, x, eyeY);
        }
        return;
      }
      fillSootEllipse(context, eyeX, eyeY, rx, ry, 0.85);
      context.fillStyle = SOOT_INK;
      context.fillRect(
        Math.round(eyeX + gaze.x * reachX - pupil / 2),
        Math.round(eyeY + gaze.y * reachY - pupil / 2),
        pupil,
        pupil,
      );
    });
  };

  /** A random direction scaled so pupils stay inside the whites; most sprites look mostly ahead. */
  const randomSootGaze = () => {
    const angle = randomSootSpriteValue(0, Math.PI * 2);
    const reach = randomSootSpriteValue(0.2, 1);
    return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
  };

  /** Plans one sprite's look, grid and gaze; its frames are drawn later at `originX` on the sheet. */
  const planSootSprite = (size, originX, sheet) => {
    const look = SOOT_LOOKS[Math.floor(Math.random() * SOOT_LOOKS.length)];
    const geometry = getSootSpriteGeometry(look, size);
    return {
      size,
      look,
      geometry,
      gaze: randomSootGaze(),
      originX,
      sheetWidth: sheet.canvas.width,
      sheetHeight: sheet.canvas.height,
    };
  };

  /** Draws a sprite's three frames (two coats, one blink) side by side on the sheet. */
  const drawSootSpritePlan = (context, plan) => {
    const { geometry, look, gaze } = plan;
    for (let frame = 0; frame < SOOT_FRAMES_PER_SPRITE; frame += 1) {
      context.save();
      context.translate(plan.originX + frame * geometry.cells, 0);
      context.fillStyle = SOOT_INK;
      drawSootCoat(context, geometry, look.fur);
      fillSootEllipse(
        context,
        geometry.centre,
        geometry.centre,
        geometry.bodyCells / 2,
        geometry.bodyCells / 2,
      );
      drawSootEyes(context, geometry, gaze, { closed: frame === 2 });
      context.restore();
    }
  };

  /** One canvas wide enough for every planned sprite's frames. */
  /** The widest grid any look draws at the largest sprite size. */
  const getSootSpriteMaxCells = () =>
    Math.max(...SOOT_LOOKS.map((look) => getSootSpriteGeometry(look, SOOT_SPRITE_MAX_SIZE).cells));

  /** One canvas with room for every sprite's frames at the widest grid, allocated before planning. */
  const createSootSpriteSheet = (spriteCount) => {
    const canvas = document.createElement("canvas");
    const cells = getSootSpriteMaxCells();
    canvas.width = Math.max(1, spriteCount * cells * SOOT_FRAMES_PER_SPRITE);
    canvas.height = cells;
    return { canvas, context: canvas.getContext("2d") };
  };

  /** Keyframes alternating the two coat frames with a blink frame every few seconds. */
  const createSootBoilKeyframes = (framePositions, duration) => {
    const steps = Math.max(2, Math.floor(duration / SOOT_BOIL_STEP_MS));
    const blinkEvery = Math.round(
      randomSootSpriteValue(SOOT_BLINK_MIN_MS, SOOT_BLINK_MAX_MS) / SOOT_BOIL_STEP_MS,
    );
    const blinkPhase = Math.floor(randomSootSpriteValue(0, blinkEvery));
    const keyframes = [];
    for (let step = 0; step <= steps; step += 1) {
      const frame = (step + blinkPhase) % blinkEvery === 0 ? 2 : step % 2;
      keyframes.push({
        offset: Math.min(1, step / steps),
        backgroundPosition: framePositions[frame],
        easing: "step-end",
      });
    }
    return keyframes;
  };

  /**
   * Frame-stepped tremble added on top of the slow wobble: a whole-cell shift in a random
   * direction every 55–115 ms, within 0.03 D while falling and 0.06 D on the ground, doubled for
   * an occasional twitch, with a rare hop of 0.22 D upward once landed.
   */
  const createSootJitterKeyframes = ({ size, cellPx }, { duration, landingProgress }) => {
    const snap = (value) => Math.round(value / cellPx) * cellPx;
    const keyframes = [{ offset: 0, transform: "translate(0px, 0px)", easing: "step-end" }];
    let at = 0;
    while (at < duration) {
      at += randomSootSpriteValue(SOOT_JITTER_MIN_MS, SOOT_JITTER_MAX_MS);
      const offset = Math.min(1, at / duration);
      const grounded = offset >= landingProgress;
      let reach = (grounded ? SOOT_JITTER_RUN_REACH : SOOT_JITTER_FALL_REACH) * size;
      if (Math.random() < SOOT_JITTER_TWITCH_CHANCE) reach *= 2;
      const dx = snap(randomSootSpriteValue(-reach, reach));
      let dy = snap(randomSootSpriteValue(-reach, reach));
      if (grounded && Math.random() < SOOT_JITTER_HOP_CHANCE)
        dy = -snap(SOOT_JITTER_HOP_RISE * size);
      keyframes.push({ offset, transform: `translate(${dx}px, ${dy}px)`, easing: "step-end" });
    }
    keyframes[keyframes.length - 1].offset = 1;
    return keyframes;
  };

  /** Darkens or lightens a hex colour by `amount` (−1…1). */
  const shadeSootColor = (hex, amount) => {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
    return `rgb(${channels
      .map((value) =>
        Math.round(amount < 0 ? value * (1 + amount) : value + (255 - value) * amount),
      )
      .join(", ")})`;
  };

  /** Every candy colour in every shape: a filled star, a white highlight cell, a darker lower-right edge. */
  const renderSootCandySheet = () => {
    const sheet = document.createElement("canvas");
    sheet.width = SOOT_CANDY_CELLS * SOOT_SPRITES_CANDY_COLORS.length * SOOT_CANDY_SHAPES.length;
    sheet.height = SOOT_CANDY_CELLS;
    const context = sheet.getContext("2d");
    SOOT_CANDY_SHAPES.forEach((shape, shapeIndex) => {
      SOOT_SPRITES_CANDY_COLORS.forEach((color, colorIndex) => {
        const originX =
          (shapeIndex * SOOT_SPRITES_CANDY_COLORS.length + colorIndex) * SOOT_CANDY_CELLS;
        shape.forEach((row, y) => {
          [...row].forEach((cell, x) => {
            if (cell !== "X") return;
            const onEdge =
              y >= 5 && x >= 4 && (shape[y + 1]?.[x] !== "X" || shape[y]?.[x + 1] !== "X");
            context.fillStyle = onEdge ? shadeSootColor(color, -0.28) : color;
            context.fillRect(originX + x, y, 1, 1);
          });
        });
        context.fillStyle = SOOT_EYE_WHITE;
        context.fillRect(originX + 3, 3, 1, 1);
      });
    });
    return {
      image: `url("${sheet.toDataURL("image/png")}")`,
      slots: SOOT_SPRITES_CANDY_COLORS.length * SOOT_CANDY_SHAPES.length,
    };
  };

  /** Six smoke blobs, each a union of soft discs in three shades of black with a dithered rim. */
  const renderSootPuffSheet = () => {
    const { width, height } = SOOT_PUFF_CELLS;
    const sheet = document.createElement("canvas");
    sheet.width = width * SOOT_PUFF_SHAPES;
    sheet.height = height;
    const context = sheet.getContext("2d");
    for (let shape = 0; shape < SOOT_PUFF_SHAPES; shape += 1) {
      const discs = [];
      const discCount = Math.round(randomSootSpriteValue(6, 9));
      for (let index = 0; index < discCount; index += 1) {
        discs.push({
          x: randomSootSpriteValue(width * 0.22, width * 0.78),
          y: randomSootSpriteValue(height * 0.3, height * 0.7),
          r: randomSootSpriteValue(height * 0.2, height * 0.34),
        });
      }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          let nearest = Number.POSITIVE_INFINITY;
          discs.forEach((disc) => {
            const distance = Math.hypot(x + 0.5 - disc.x, y + 0.5 - disc.y) / disc.r;
            if (distance < nearest) nearest = distance;
          });
          let alpha = 0;
          if (nearest < 0.7) alpha = 0.5;
          else if (nearest < 1) alpha = Math.random() < 0.85 ? 0.32 : 0;
          else if (nearest < 1.18) alpha = Math.random() < 0.4 ? 0.16 : 0;
          if (!alpha) continue;
          context.fillStyle = `rgba(0, 0, 0, ${alpha})`;
          context.fillRect(shape * width + x, y, 1, 1);
        }
      }
    }
    return { image: `url("${sheet.toDataURL("image/png")}")`, shapes: SOOT_PUFF_SHAPES };
  };

  /** The candy and smoke sheets are drawn once per page and shared by every swarm. */
  const getSootEffectSheets = () => {
    if (!sootEffectSheets) {
      sootEffectSheets = { candy: renderSootCandySheet(), puff: renderSootPuffSheet() };
    }
    return sootEffectSheets;
  };

  const createSootSpriteElement = (index, trajectory, plan, { paused = false } = {}) => {
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
    sprite.style.setProperty("--soot-wobble-delay", `${index * -83}ms`);
    const { geometry } = plan;
    const framePx = geometry.cells * geometry.cellPx;
    sprite.style.setProperty("--soot-frame-size", `${framePx}px`);
    sprite.style.setProperty("--soot-frame-inset", `${(trajectory.size - framePx) / 2}px`);
    sprite.style.setProperty(
      "--soot-sheet-size",
      `${plan.sheetWidth * geometry.cellPx}px ${plan.sheetHeight * geometry.cellPx}px`,
    );
    const framePositions = [];
    for (let frame = 0; frame < SOOT_FRAMES_PER_SPRITE; frame += 1) {
      framePositions.push(`${-(plan.originX + frame * geometry.cells) * geometry.cellPx}px 0px`);
    }
    sprite.style.setProperty("--soot-frame-position", framePositions[0]);

    const body = document.createElement("span");
    body.className = "soot-sprite-body";
    const frame = document.createElement("span");
    frame.className = "soot-sprite-frame";
    body.append(frame);
    sprite.append(body);
    const behaviours = [];
    if (!prefersSootReducedMotion() && typeof frame.animate === "function") {
      const timing = { delay: trajectory.delay, duration: trajectory.duration, fill: "both" };
      behaviours.push(
        frame.animate(createSootBoilKeyframes(framePositions, trajectory.duration), timing),
      );
      behaviours.push(
        body.animate(
          createSootJitterKeyframes({ size: trajectory.size, cellPx: geometry.cellPx }, trajectory),
          { ...timing, composite: "add" },
        ),
      );
    }
    const motion = animateSootSpriteElement(sprite, trajectory);
    if (paused && motion) {
      motion.pause();
      sootSpriteMotionAnimations.set(sprite, motion);
    }
    if (paused)
      behaviours.forEach((animation) => {
        animation.pause();
      });
    sootSpriteBehaviourAnimations.set(sprite, behaviours);
    return sprite;
  };

  const createSootCandyElement = (launchRect, lag = 0) => {
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
    setSootCandyLook(candy);
    setSootCandyTimingProperties(candy, {
      delay: randomSootSpriteValue(140, 520) - lag,
      fallDuration: randomSootSpriteValue(3600, 4800),
    });
    setSootCandySpinProperties(candy, spin);
    return candy;
  };

  const createSootTrailCandyElement = (trajectory, progress, lag = 0) => {
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
    setSootCandyLook(candy);
    setSootCandyTimingProperties(candy, {
      delay:
        trajectory.delay + trajectory.duration * progress + randomSootSpriteValue(-90, 140) - lag,
      fallDuration: randomSootSpriteValue(3200, 4300),
    });
    setSootCandySpinProperties(candy, spin);
    return candy;
  };

  const createSootPuffElement = (launchRect, large = false, lag = 0) => {
    const puff = document.createElement("span");
    puff.className = large ? "soot-puff soot-puff--large" : "soot-puff";
    puff.setAttribute("aria-hidden", "true");
    const size = randomSootSpriteValue(large ? 192 : 84, large ? 380 : 208);
    const x0 = launchRect.left + randomSootSpriteValue(-20, launchRect.width + 20);
    const y0 = launchRect.top + randomSootSpriteValue(-14, launchRect.height + 20);
    setSootSpritePx(puff, "--puff-x0", x0);
    setSootSpritePx(puff, "--puff-y0", y0);
    setSootSpritePx(puff, "--puff-x1", x0 + randomSootSpriteValue(-320, 320));
    setSootSpritePx(
      puff,
      "--puff-y1",
      y0 + randomSootSpriteValue(large ? -140 : -210, large ? 230 : 150),
    );
    setSootSpritePx(puff, "--puff-size", size);
    puff.style.setProperty("--puff-delay", `${randomSootSpriteValue(40, 360) - lag}ms`);
    puff.style.setProperty("--puff-duration", `${randomSootSpriteValue(5400, 7600)}ms`);
    setSootPuffLook(puff);
    return puff;
  };

  const createSootTrailPuffElement = (trajectory, index, progress, lag = 0) => {
    const puff = document.createElement("span");
    puff.className =
      index % 5 === 0
        ? "soot-puff soot-puff--trail soot-puff--large"
        : "soot-puff soot-puff--trail";
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
      `${trajectory.delay + trajectory.duration * progress + randomSootSpriteValue(-120, 180) - lag}ms`,
    );
    puff.style.setProperty("--puff-duration", `${randomSootSpriteValue(5300, 7300)}ms`);
    setSootPuffLook(puff);
    return puff;
  };

  /** Runs `steps` one per animation frame while `overlay` is still the live swarm. */
  const runSootSwarmSteps = (overlay, steps) =>
    new Promise((resolve) => {
      const next = () => {
        if (overlay !== sootSpritesOverlay) return;
        const step = steps.shift();
        if (!step) {
          resolve();
          return;
        }
        step();
        window.requestAnimationFrame(next);
      };
      next();
    });

  /** Plays everything a sprite created after the swarm's release would otherwise hold paused. */
  const playSootSprite = (sprite) => {
    sootSpriteMotionAnimations.get(sprite)?.play();
    sootSpriteBehaviourAnimations.get(sprite)?.forEach((animation) => {
      animation.play();
    });
  };

  /**
   * Milliseconds since the swarm was released, so an effect appended afterwards starts its
   * animation where it would have been had it existed at release.
   */
  const getSootSwarmLag = (overlay) =>
    overlay.sootReleasedAt === undefined ? 0 : performance.now() - overlay.sootReleasedAt;

  const showSootSpritesSwarm = (launchRect = getSootSpritesLaunchRect()) => {
    cleanupSootSpritesOverlay();
    const overlay = document.createElement("div");
    overlay.className = "soot-sprites-swarm is-staged";
    overlay.style.zIndex = String(getSootSpritesStagedZIndex());
    overlay.setAttribute("aria-hidden", "true");

    const spriteCount =
      window.innerWidth < 560 ? SOOT_SPRITES_MOBILE_COUNT : SOOT_SPRITES_DESKTOP_COUNT;
    const spawnGrid = createSootSpriteSpawnGrid(launchRect, spriteCount);
    const sheet = createSootSpriteSheet(spriteCount);
    const trajectories = [];
    let originX = 0;

    const staged = () => overlay.classList.contains("is-staged");
    // Sprites first: each step plans, draws and appends a few, then the sheet is encoded.
    const spriteSteps = [];
    for (let start = 0; start < spriteCount; start += SOOT_SWARM_SPRITE_BATCH) {
      spriteSteps.push(() => {
        for (
          let index = start;
          index < Math.min(spriteCount, start + SOOT_SWARM_SPRITE_BATCH);
          index += 1
        ) {
          const trajectory = createSootSpriteTrajectory(launchRect, {
            startPoint: spawnGrid[index],
          });
          const plan = planSootSprite(trajectory.size, originX, sheet);
          originX += plan.geometry.cells * SOOT_FRAMES_PER_SPRITE;
          trajectories.push(trajectory);
          drawSootSpritePlan(sheet.context, plan);
          const sprite = createSootSpriteElement(index, trajectory, plan, { paused: true });
          overlay.append(sprite);
          if (!staged()) playSootSprite(sprite);
        }
      });
    }
    spriteSteps.push(() => {
      const sheetImage = `url("${sheet.canvas.toDataURL("image/png")}")`;
      overlay.querySelectorAll(".soot-sprite-frame").forEach((frame) => {
        frame.style.backgroundImage = sheetImage;
      });
    });
    // The candy and smoke sheets are drawn once per page; their first draw gets its own frame.
    spriteSteps.push(() => {
      const sheets = getSootEffectSheets();
      overlay.style.setProperty("--soot-candy-slots", String(sheets.candy.slots));
      overlay.style.setProperty("--soot-puff-shapes", String(sheets.puff.shapes));
    });

    // Candies and smoke follow in small batches; they may land after the release, so each
    // one starts its animation offset by the time it missed.
    const airTrailCandyCount = Math.round(spriteCount * SOOT_SPRITES_AIR_TRAIL_CANDIES_PER_SPRITE);
    // Ground-run candy is intentionally twice as dense as the airborne trail.
    const groundRunCandyCount = Math.round(
      spriteCount *
        SOOT_SPRITES_AIR_TRAIL_CANDIES_PER_SPRITE *
        SOOT_SPRITES_GROUND_RUN_CANDY_MULTIPLIER,
    );
    const trailPuffCount = Math.round(spriteCount * 1.4);
    const candyCount = Math.round(spriteCount * 1.28);
    const puffCount = Math.round(spriteCount * 0.48);
    const effects = [];
    for (let index = 0; index < airTrailCandyCount; index += 1) {
      effects.push((lag) => {
        const trajectory = trajectories[index % trajectories.length];
        return createSootTrailCandyElement(
          trajectory,
          getSootSpriteAirTrailProgress(trajectory),
          lag,
        );
      });
    }
    for (let index = 0; index < groundRunCandyCount; index += 1) {
      effects.push((lag) => {
        const trajectory = trajectories[index % trajectories.length];
        return createSootTrailCandyElement(
          trajectory,
          getSootSpriteGroundRunProgress(trajectory),
          lag,
        );
      });
    }
    for (let index = 0; index < trailPuffCount; index += 1) {
      const progress = 0.04 + ((index * 0.13) % 0.92);
      effects.push((lag) =>
        createSootTrailPuffElement(trajectories[index % trajectories.length], index, progress, lag),
      );
    }
    for (let index = 0; index < candyCount; index += 1) {
      effects.push((lag) => createSootCandyElement(launchRect, lag));
    }
    for (let index = 0; index < puffCount; index += 1) {
      effects.push((lag) => createSootPuffElement(launchRect, index % 5 === 0, lag));
    }
    const effectSteps = [];
    for (let start = 0; start < effects.length; start += SOOT_SWARM_EFFECT_BATCH) {
      effectSteps.push(() => {
        const lag = getSootSwarmLag(overlay);
        effects.slice(start, start + SOOT_SWARM_EFFECT_BATCH).forEach((create) => {
          overlay.append(create(lag));
        });
      });
    }

    document.body.append(overlay);
    document.body.classList.add("is-soot-sprites-active");
    sootSpritesOverlay = overlay;
    sootSpritesCleanupTimer = window.setTimeout(cleanupSootSpritesOverlay, SOOT_SPRITES_CLEANUP_MS);
    overlay.sootSpritesReady = runSootSwarmSteps(overlay, spriteSteps);
    overlay.sootEffectsReady = overlay.sootSpritesReady.then(() =>
      runSootSwarmSteps(overlay, effectSteps),
    );
    return overlay;
  };

  const releaseSootSpritesSwarm = () => {
    const overlay = sootSpritesOverlay;
    if (!overlay?.classList.contains("is-staged")) return;
    overlay.classList.remove("is-staged");
    overlay.style.removeProperty("z-index");
    overlay.sootReleasedAt = performance.now();
    overlay.querySelectorAll(".soot-sprite").forEach((sprite) => {
      sootSpriteMotionAnimations.get(sprite)?.play();
      sootSpriteBehaviourAnimations.get(sprite)?.forEach((animation) => {
        animation.play();
      });
    });
  };

  const showSootSpritesWindow = () => {
    showManagedRandomEventWindow(sootSpritesWindow, {
      afterShow: reserveSootSpritesSpawnLane,
      clampAfterMediaLoad: true,
    });
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
      // The swarm is built across frames while the alert holds; the hold runs from the
      // first committed frame and the alert closes once both it and the build are done.
      window.requestAnimationFrame(() => {
        if (overlay !== sootSpritesOverlay) return;
        sootSpritesWindowHoldTimer = window.setTimeout(() => {
          sootSpritesWindowHoldTimer = null;
          overlay.sootSpritesReady.then(() => {
            if (overlay !== sootSpritesOverlay) return;
            setSootSpritesWindowLoading(false);
            closeManagedRandomEventWindow(sootSpritesWindow);
          });
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
  registerRandomEventWindows(() => [sootSpritesWindow]);

  window.homeEventSootSprites = Object.freeze({
    isSootSpritesVisible,
    sootSpritesWindow,
  });
})();
