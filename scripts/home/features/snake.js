(() => {
const {
  all,
  byId,
  one,
} = window.homeDom;
const {
  clampNumber,
  createProgressLoader,
  debounceTimer,
  isPageActive,
  readJsonStorage,
  reducedMotionQuery,
  removeStorage,
  writeJsonStorage,
} = window.homeUtil;
const {
  getAppWindow,
  isWindowVisible,
  registerActiveWindowKeyHandler,
  registerViewportObserver,
  registerWindowLifecycle,
  setWindowOpen,
} = window.homeWindows;
const {
  createGameStatsHooks,
  registerGameStatsLocalSource,
} = window.homeGameStats;
const {
  notifyActivity,
} = window.homeActivity;
const {
  clearNoiseCanvas,
  drawNoiseCanvas,
} = window.homeStaticNoise;
const {
  SNAKE_COUNTDOWN_MS: SNAKE_RESUME_COUNTDOWN_MS,
  SNAKE_TICK_MS,
} = window.homeGameRules;
const {
  DIRECTIONS: SNAKE_DIRECTIONS,
  directionsOppose: snakeDirectionsOppose,
  generate: generateSnake,
  initial: initialSnake,
  result: snakeResult,
  step: stepSnake,
  transition: transitionSnake,
} = window.homeSnakeRules;

const snakeLoadingPanel = byId("snake-loading-panel");
const snakeLoadingMeter = one(".snake-loading-meter");
const snakeLoadingMeterFill = byId("snake-loading-meter-fill");
const snakeLoadingPercent = byId("snake-loading-percent");
const snakeCanvas = byId("snake-canvas");
const snakeNoiseCanvas = byId("snake-noise-canvas");
const snakeStatus = byId("snake-status");
const snakeScore = byId("snake-score");
const snakeHighScore = byId("snake-high-score");
const snakeBoardSizeButtons = all("[data-snake-board-size]");
const snakeColorButtons = all("[data-snake-color]");
const snakeAppleColorButtons = all("[data-snake-apple-color]");
const snakeStart = byId("snake-start");
const snakeReset = byId("snake-reset");
const snakeHelp = byId("snake-help");
const snakeDirectionButtons = all("[data-snake-direction]");

const SNAKE_DEFAULT_GRID_SIZE = 16;

const SNAKE_HIGH_SCORE_KEY = "personalSiteSnakeHighScores";

const SNAKE_SETTINGS_KEY = "personalSiteSnakeSettingsV1";

const SNAKE_HIGH_SCORE_SAVE_DEBOUNCE_MS = 350;

const SNAKE_LOAD_MIN_MS = 1000;

const SNAKE_LOAD_MAX_MS = 4000;

const SNAKE_SIGNATURE_SWEEP_MS = 3200;

const SNAKE_SIGNATURE_SWEEP_CELL_RADIUS = 2;

const SNAKE_COLLECTION_PULSE_MS = 820;

const SNAKE_COLLECTION_PULSE_CELL_RADIUS = 2.5;

const SNAKE_RENDER_INTERVAL_MS = 1000 / 24;

const SNAKE_NOISE_INTERVAL_MS = 1000 / 16;

const SNAKE_POINTER_PAUSE_SUPPRESSION_MS = 250;

const SNAKE_COLOR_THEMES = Object.freeze({
  green: {
    head: "#62ff78",
    body: "#2f9a4b",
    glow: "rgba(98, 255, 120, 0.75)",
    sweep: "rgba(98, 255, 120, 0.32)",
    sweepRing: "rgba(98, 255, 120, 0.16)",
    pulse: (alpha) => `rgba(98, 255, 120, ${alpha})`,
  },
  purple: {
    head: "#c77dff",
    body: "#7b2cbf",
    glow: "rgba(199, 125, 255, 0.75)",
    sweep: "rgba(199, 125, 255, 0.32)",
    sweepRing: "rgba(199, 125, 255, 0.16)",
    pulse: (alpha) => `rgba(199, 125, 255, ${alpha})`,
  },
  red: {
    head: "#ff6257",
    body: "#a8211d",
    glow: "rgba(255, 98, 87, 0.75)",
    sweep: "rgba(255, 98, 87, 0.32)",
    sweepRing: "rgba(255, 98, 87, 0.16)",
    pulse: (alpha) => `rgba(255, 98, 87, ${alpha})`,
  },
  blue: {
    head: "#65b7ff",
    body: "#2368c4",
    glow: "rgba(101, 183, 255, 0.75)",
    sweep: "rgba(101, 183, 255, 0.32)",
    sweepRing: "rgba(101, 183, 255, 0.16)",
    pulse: (alpha) => `rgba(101, 183, 255, ${alpha})`,
  },
});

const SNAKE_KEY_DIRECTIONS = Object.freeze({
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
});

let snakeState = {
  snake: [],
  apples: [],
  collectionPulses: [],
  occupiedCells: new Set(),
  direction: "right",
  nextDirection: "right",
  directionQueue: [],
  score: 0,
  gridSize: SNAKE_DEFAULT_GRID_SIZE,
  color: "green",
  appleColor: "red",
  highScores: {},
  running: false,
  hasStarted: false,
  gameOver: false,
  statsSession: "",
  recordAtStart: null,
  tickTimer: null,
  countdownTimer: null,
  countdownStartedAt: 0,
  countdownDuration: 0,
  noiseFrame: null,
  loading: false,
  engineState: null,
  issuePending: false,
  runRevision: 0,
  bufferedDirections: [],
  timingPromise: null,
};

const snakeStats = createGameStatsHooks("snake", () => snakeState);

let snakePointerPauseSuppressUntil = 0;

let snakeGridCanvas = null;

let snakeGridCacheKey = "";

let snakeHighScoreSaveTimer = null;

let snakeLoadingStartedAt = 0;

let snakeLoadingDuration = 0;

let snakeLoadingProgress = 0;

let snakeRenderDirty = true;

let snakeLastRenderAt = 0;

let snakeLastNoiseAt = 0;

let snakeHudRenderCache = {
  score: "",
  highScore: "",
  startText: "",
  statusText: "",
  gridSize: null,
  color: "",
  appleColor: "",
};

const snakeReducedMotionMedia = reducedMotionQuery;

const isSnakeWindowVisible = () => {
  const win = getAppWindow("snake");
  return Boolean(win && isWindowVisible(win));
};

const isSnakeReducedMotion = () => Boolean(snakeReducedMotionMedia?.matches);

const canAnimateSnake = () =>
  Boolean(
    isSnakeWindowVisible() &&
      isPageActive(document) &&
      !isSnakeReducedMotion()
  );

const requestSnakeRender = () => {
  snakeRenderDirty = true;
  startSnakeNoiseAnimation();
};

const clearSnakeCountdown = () => {
  if (snakeState.countdownTimer) {
    clearTimeout(snakeState.countdownTimer);
    snakeState.countdownTimer = null;
  }
  snakeState.countdownStartedAt = 0;
  snakeState.countdownDuration = 0;
};

const setSnakeLoadingProgress = (progress) => {
  snakeLoadingProgress = clampNumber(progress, 0, 100);
  const roundedProgress = Math.round(snakeLoadingProgress);
  if (snakeLoadingMeterFill) {
    snakeLoadingMeterFill.style.setProperty(
      "--snake-load-progress",
      `${roundedProgress}%`
    );
  }
  if (snakeLoadingMeter) {
    snakeLoadingMeter.setAttribute("aria-valuenow", String(roundedProgress));
  }
  if (snakeLoadingPercent) {
    snakeLoadingPercent.textContent = `${roundedProgress}%`;
  }
};

const setSnakeLoadingVisible = (visible) => {
  const win = getAppWindow("snake");
  snakeState.loading = visible;
  if (win) win.classList.toggle("is-snake-loading", visible);
  if (snakeLoadingPanel) {
    snakeLoadingPanel.setAttribute("aria-hidden", String(!visible));
  }
};

const clearSnakeLoadingSequence = () => {
  snakeProgressLoader.cancel();
  setSnakeLoadingVisible(false);
  setSnakeLoadingProgress(0);
};

const finishSnakeLoadingSequence = () => {
  setSnakeLoadingVisible(false);
  if (!isSnakeWindowVisible()) return;
  requestSnakeRender();
  if (snakeCanvas) snakeCanvas.focus();
};

const snakeProgressLoader = createProgressLoader({
  progressCap: 96,
  shouldContinue: () => snakeState.loading && isSnakeWindowVisible(),
  nextProgress: ({ elapsedMs, durationMs, progress }) => {
    const timeProgress = (elapsedMs / durationMs) * 100;
    const naturalJump = 4 + Math.random() * 18;
    const catchupJump =
      Math.max(0, timeProgress - progress) * (0.45 + Math.random() * 0.5);
    const jitterCap = timeProgress + 14 + Math.random() * 18;
    return Math.max(progress + 1, Math.min(jitterCap, progress + naturalJump + catchupJump));
  },
  nextDelay: ({ elapsedMs, durationMs }) =>
    Math.min(110 + Math.random() * 290, Math.max(0, durationMs - elapsedMs)),
  onProgress: setSnakeLoadingProgress,
  onReady: finishSnakeLoadingSequence,
});

const startSnakeLoadingSequence = () => {
  const win = getAppWindow("snake");
  if (!win) return;
  pauseSnakeGame();
  stopSnakeNoiseAnimation();
  clearSnakeCountdown();
  setSnakeLoadingVisible(true);
  snakeLoadingDuration =
    SNAKE_LOAD_MIN_MS + Math.random() * (SNAKE_LOAD_MAX_MS - SNAKE_LOAD_MIN_MS);
  const loading = snakeProgressLoader.start({
    duration: snakeLoadingDuration,
    initialDelay: 120 + Math.random() * 220,
  });
  snakeLoadingStartedAt = loading.startedAt;
};

const loadSnakeHighScores = () => {
  const stored = readJsonStorage(() => localStorage, SNAKE_HIGH_SCORE_KEY, {});
  return stored && typeof stored === "object" ? stored : {};
};

const saveSnakeHighScores = () => {
  if (snakeHighScoreSaveTimer) {
    clearTimeout(snakeHighScoreSaveTimer);
    snakeHighScoreSaveTimer = null;
  }
  writeJsonStorage(() => localStorage, SNAKE_HIGH_SCORE_KEY, snakeState.highScores);
};

const scheduleSnakeHighScoreSave = () => {
  snakeHighScoreSaveTimer = debounceTimer(
    snakeHighScoreSaveTimer,
    saveSnakeHighScores,
    SNAKE_HIGH_SCORE_SAVE_DEBOUNCE_MS
  );
};

const loadSnakeSettings = () => {
  const stored = readJsonStorage(() => localStorage, SNAKE_SETTINGS_KEY, null);
  if (!stored || typeof stored !== "object") return null;
  const gridSize = Number(stored.gridSize);
  return {
    gridSize: [10, 16, 20, 24].includes(gridSize)
      ? gridSize
      : SNAKE_DEFAULT_GRID_SIZE,
    color: SNAKE_COLOR_THEMES[stored.color] ? stored.color : "green",
    appleColor: SNAKE_COLOR_THEMES[stored.appleColor] ? stored.appleColor : "red",
  };
};

const saveSnakeSettings = () => {
  writeJsonStorage(() => localStorage, SNAKE_SETTINGS_KEY, {
    gridSize: snakeState.gridSize,
    color: snakeState.color,
    appleColor: snakeState.appleColor,
  });
};

const getSnakeHighScore = () => {
  const key = String(snakeState.gridSize);
  const score = Number(snakeState.highScores[key]);
  return Number.isFinite(score) ? score : 0;
};

const updateSnakeHighScore = () => {
  const key = String(snakeState.gridSize);
  if (snakeState.score <= getSnakeHighScore()) return;
  snakeState.highScores[key] = snakeState.score;
  scheduleSnakeHighScoreSave();
};

const updateSnakeBoardSizeButtons = () => {
  snakeBoardSizeButtons.forEach((button) => {
    const isSelected = Number(button.dataset.snakeBoardSize) === snakeState.gridSize;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const updateSnakeColorButtons = () => {
  snakeColorButtons.forEach((button) => {
    const isSelected = button.dataset.snakeColor === snakeState.color;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const updateSnakeAppleColorButtons = () => {
  snakeAppleColorButtons.forEach((button) => {
    const isSelected = button.dataset.snakeAppleColor === snakeState.appleColor;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const getSnakeColorTheme = () =>
  SNAKE_COLOR_THEMES[snakeState.color] || SNAKE_COLOR_THEMES.green;

const getSnakeAppleColorTheme = () =>
  SNAKE_COLOR_THEMES[snakeState.appleColor] || SNAKE_COLOR_THEMES.red;

const updateSnakeHud = () => {
  const scoreText = String(snakeState.score);
  const highScoreText = String(getSnakeHighScore());
  const startText = snakeState.running || snakeState.countdownTimer ? "Pause" : "Start";
  if (snakeScore && snakeHudRenderCache.score !== scoreText) {
    snakeScore.textContent = scoreText;
  }
  if (snakeHighScore && snakeHudRenderCache.highScore !== highScoreText) {
    snakeHighScore.textContent = highScoreText;
  }
  if (snakeStart && snakeHudRenderCache.startText !== startText) {
    snakeStart.textContent = startText;
  }
  if (snakeHudRenderCache.gridSize !== snakeState.gridSize) {
    updateSnakeBoardSizeButtons();
  }
  if (snakeHudRenderCache.color !== snakeState.color) {
    updateSnakeColorButtons();
  }
  if (snakeHudRenderCache.appleColor !== snakeState.appleColor) {
    updateSnakeAppleColorButtons();
  }
  snakeHudRenderCache.score = scoreText;
  snakeHudRenderCache.highScore = highScoreText;
  snakeHudRenderCache.startText = startText;
  snakeHudRenderCache.gridSize = snakeState.gridSize;
  snakeHudRenderCache.color = snakeState.color;
  snakeHudRenderCache.appleColor = snakeState.appleColor;
  let statusText = "Ready";
  if (snakeState.gameOver) {
    statusText = "Signal lost";
  } else if (snakeState.countdownTimer) {
    statusText = "Starting";
  } else if (snakeState.running) {
    statusText = "Tracking";
  } else if (snakeState.hasStarted) {
    statusText = "Paused - press Start";
  }
  if (snakeStatus && snakeHudRenderCache.statusText !== statusText) {
    snakeStatus.textContent = statusText;
  }
  snakeHudRenderCache.statusText = statusText;
};

const resizeSnakeCanvas = (canvas) => {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth || 320));
  const height = Math.max(1, Math.round(canvas.clientHeight || width));
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height, ratio };
};

const getSnakeGridLayer = (width, height, ratio) => {
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  const cacheKey = `${pixelWidth}x${pixelHeight}:${ratio}:${snakeState.gridSize}`;
  if (!snakeGridCanvas) snakeGridCanvas = document.createElement("canvas");
  if (
    snakeGridCacheKey === cacheKey &&
    snakeGridCanvas.width === pixelWidth &&
    snakeGridCanvas.height === pixelHeight
  ) {
    return snakeGridCanvas;
  }
  snakeGridCacheKey = cacheKey;
  snakeGridCanvas.width = pixelWidth;
  snakeGridCanvas.height = pixelHeight;
  const gridCtx = snakeGridCanvas.getContext("2d");
  if (!gridCtx) return snakeGridCanvas;
  const cellWidth = width / snakeState.gridSize;
  const cellHeight = height / snakeState.gridSize;
  gridCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  gridCtx.clearRect(0, 0, width, height);
  gridCtx.fillStyle = "#020403";
  gridCtx.fillRect(0, 0, width, height);
  gridCtx.strokeStyle = "rgba(95, 255, 122, 0.14)";
  gridCtx.lineWidth = 1;
  for (let x = 0; x <= snakeState.gridSize; x += 1) {
    const px = x * cellWidth;
    gridCtx.beginPath();
    gridCtx.moveTo(px, 0);
    gridCtx.lineTo(px, height);
    gridCtx.stroke();
  }
  for (let y = 0; y <= snakeState.gridSize; y += 1) {
    const py = y * cellHeight;
    gridCtx.beginPath();
    gridCtx.moveTo(0, py);
    gridCtx.lineTo(width, py);
    gridCtx.stroke();
  }
  return snakeGridCanvas;
};

const snakeCellsMatch = (a, b) => a.x === b.x && a.y === b.y;

const getSnakeCellKey = (x, y) => y * snakeState.gridSize + x;

const rebuildSnakeOccupiedCells = () => {
  snakeState.occupiedCells = new Set(
    snakeState.snake.map((segment) => getSnakeCellKey(segment.x, segment.y))
  );
};

const snakeRandomSeed = () => Math.floor(Math.random() * 0x1_0000_0000) >>> 0;

const snakeSyncEngineState = () => {
  const engine = snakeState.engineState;
  if (!engine) return;
  const previousApples = new Map(
    snakeState.apples.map((apple) => [`${apple.x},${apple.y}`, apple])
  );
  snakeState.gridSize = Number(engine.configuration.boardSize);
  snakeState.snake = engine.snake.map(({ x, y }) => ({ x, y }));
  snakeState.apples = engine.apples.map(({ x, y }) => ({
    x,
    y,
    sweepOffset: previousApples.get(`${x},${y}`)?.sweepOffset ?? Math.random(),
  }));
  snakeState.direction = engine.direction;
  snakeState.directionQueue = engine.directionQueue.slice();
  snakeState.nextDirection =
    engine.directionQueue[engine.directionQueue.length - 1] || engine.direction;
  snakeState.score = engine.score;
  snakeState.gameOver = engine.terminal;
  rebuildSnakeOccupiedCells();
};

const snakeGenerateLocalState = () => initialSnake(generateSnake(
  { boardSize: String(snakeState.gridSize) },
  { seed: snakeRandomSeed() }
));

const snakeInstallEngineState = (engineState) => {
  snakeState.engineState = engineState;
  snakeSyncEngineState();
};

const snakeRecordDirection = (direction) => {
  const engine = snakeState.engineState;
  if (!engine) return false;
  try {
    transitionSnake(engine, {
      seq: engine.nextSeq,
      op: "direction",
      tick: engine.tick,
      direction,
    });
  } catch (error) {
    if (error?.code === "illegal-action") return false;
    throw error;
  }
  if (typeof snakeStats.recordInput === "function") {
    snakeStats.recordInput({ op: "direction", tick: engine.tick, direction });
  }
  snakeSyncEngineState();
  return true;
};

const drawSnakeGame = () => {
  const prepared = resizeSnakeCanvas(snakeCanvas);
  if (!prepared) return;
  const { ctx, width, height, ratio } = prepared;
  const cellWidth = width / snakeState.gridSize;
  const cellHeight = height / snakeState.gridSize;

  ctx.drawImage(getSnakeGridLayer(width, height, ratio), 0, 0, width, height);

  const snakeTheme = getSnakeColorTheme();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = snakeTheme.body;
  ctx.shadowColor = snakeTheme.glow;
  ctx.shadowBlur = 7;
  snakeState.snake.forEach((segment, index) => {
    const inset = index === 0 ? 2 : 3;
    const segmentScale = 0.8;
    const baseX = segment.x * cellWidth + inset;
    const baseY = segment.y * cellHeight + inset;
    const baseWidth = cellWidth - inset * 2;
    const baseHeight = cellHeight - inset * 2;
    const segmentWidth = baseWidth * segmentScale;
    const segmentHeight = baseHeight * segmentScale;
    ctx.fillStyle = index === 0 ? snakeTheme.head : snakeTheme.body;
    ctx.fillRect(
      baseX + (baseWidth - segmentWidth) / 2,
      baseY + (baseHeight - segmentHeight) / 2,
      segmentWidth,
      segmentHeight
    );
  });
  ctx.restore();

  const now = performance.now();
  const appleTheme = getSnakeAppleColorTheme();
  snakeState.apples.forEach((apple) => {
    const appleX = apple.x * cellWidth + cellWidth / 2;
    const appleY = apple.y * cellHeight + cellHeight / 2;
    const cellSize = Math.min(cellWidth, cellHeight);
    const dotRadius = Math.max(2.2, cellSize * 0.16);
    const ringRadius = Math.max(dotRadius + 2, cellSize * 0.38);
    const sweepRadius = cellSize * SNAKE_SIGNATURE_SWEEP_CELL_RADIUS;
    const sweepOffset = Number.isFinite(apple.sweepOffset) ? apple.sweepOffset : 0;
    const sweepAngle =
      ((now / SNAKE_SIGNATURE_SWEEP_MS + sweepOffset) % 1) * Math.PI * 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = appleTheme.glow;
    ctx.shadowBlur = Math.max(5, cellSize * 0.35);
    for (let trailIndex = 0; trailIndex < 18; trailIndex += 1) {
      const trailStart = trailIndex / 18;
      const trailEnd = (trailIndex + 1) / 18;
      const startAngle = sweepAngle - trailEnd * 0.95;
      const endAngle = sweepAngle - trailStart * 0.95;
      const trailAlpha = 0.025 + Math.pow(1 - trailStart, 1.8) * 0.17;
      ctx.fillStyle = appleTheme.pulse(trailAlpha);
      ctx.beginPath();
      ctx.arc(appleX, appleY, sweepRadius, startAngle, endAngle);
      ctx.arc(appleX, appleY, ringRadius + 1, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.lineCap = "round";
    ctx.shadowBlur = Math.max(6, cellSize * 0.42);
    ctx.strokeStyle = appleTheme.pulse(0.4);
    ctx.lineWidth = Math.max(1.5, cellSize * 0.12);
    ctx.beginPath();
    ctx.moveTo(
      appleX + Math.cos(sweepAngle) * (ringRadius + 1),
      appleY + Math.sin(sweepAngle) * (ringRadius + 1)
    );
    ctx.lineTo(
      appleX + Math.cos(sweepAngle) * sweepRadius,
      appleY + Math.sin(sweepAngle) * sweepRadius
    );
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = appleTheme.sweepRing;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(appleX, appleY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = appleTheme.head;
    ctx.shadowColor = appleTheme.glow;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(appleX, appleY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  snakeState.collectionPulses = snakeState.collectionPulses.filter((pulse) => {
    const age = now - pulse.startedAt;
    return age < SNAKE_COLLECTION_PULSE_MS;
  });
  snakeState.collectionPulses.forEach((pulse) => {
    const age = now - pulse.startedAt;
    const progress = clampNumber(age / SNAKE_COLLECTION_PULSE_MS, 0, 1);
    const pulseX = pulse.x * cellWidth + cellWidth / 2;
    const pulseY = pulse.y * cellHeight + cellHeight / 2;
    const cellSize = Math.min(cellWidth, cellHeight);
    const radius = Math.max(
      2.5,
      cellSize * (0.18 + progress * (SNAKE_COLLECTION_PULSE_CELL_RADIUS - 0.18))
    );
    const alpha = (1 - progress) * 0.46;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = appleTheme.pulse(alpha);
    ctx.lineWidth = 1 + (1 - progress) * 0.7;
    ctx.beginPath();
    ctx.arc(pulseX, pulseY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  if (snakeState.gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(0, height / 2 - 28, width, 56);
    ctx.fillStyle = "rgba(98, 255, 120, 0.9)";
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SIGNAL LOST", width / 2, height / 2 - 9);
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillText("Press RESET or ENTER to try again.", width / 2, height / 2 + 12);
  } else if (!snakeState.hasStarted && !snakeState.loading) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.fillRect(0, height / 2 - 24, width, 48);
    ctx.fillStyle = "rgba(98, 255, 120, 0.92)";
    ctx.shadowColor = "rgba(98, 255, 120, 0.82)";
    ctx.shadowBlur = 10;
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Press Any Key to Begin", width / 2, height / 2);
    ctx.restore();
  } else if (snakeState.countdownTimer) {
    const elapsed = performance.now() - snakeState.countdownStartedAt;
    const remaining = Math.max(0, snakeState.countdownDuration - elapsed);
    const count = Math.max(
      1,
      Math.ceil((remaining / snakeState.countdownDuration) * 3)
    );
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
    ctx.fillRect(0, height / 2 - 30, width, 60);
    ctx.fillStyle = "rgba(98, 255, 120, 0.95)";
    ctx.shadowColor = "rgba(98, 255, 120, 0.82)";
    ctx.shadowBlur = 14;
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), width / 2, height / 2);
    ctx.restore();
  } else if (snakeState.hasStarted && !snakeState.running) {
    const pauseBarWidth = Math.max(8, width * 0.035);
    const pauseBarHeight = Math.max(40, height * 0.16);
    const pauseGap = Math.max(10, width * 0.04);
    const pauseX = width / 2 - pauseGap / 2 - pauseBarWidth;
    const pauseY = height / 2 - pauseBarHeight / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.fillRect(0, height / 2 - pauseBarHeight * 0.7, width, pauseBarHeight * 1.4);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(98, 255, 120, 0.92)";
    ctx.shadowColor = "rgba(98, 255, 120, 0.82)";
    ctx.shadowBlur = 12;
    ctx.fillRect(pauseX, pauseY, pauseBarWidth, pauseBarHeight);
    ctx.fillRect(pauseX + pauseBarWidth + pauseGap, pauseY, pauseBarWidth, pauseBarHeight);
    ctx.restore();
  }
};

const drawSnakeNoise = () => {
  if (!isSnakeWindowVisible() || isSnakeReducedMotion()) {
    clearNoiseCanvas(snakeNoiseCanvas);
    return;
  }
  drawNoiseCanvas(snakeNoiseCanvas);
};

const stopSnakeNoiseAnimation = () => {
  if (!snakeState.noiseFrame) return;
  cancelAnimationFrame(snakeState.noiseFrame);
  snakeState.noiseFrame = null;
};

const startSnakeNoiseAnimation = () => {
  if (snakeState.noiseFrame) return;
  const animate = (timestamp) => {
    snakeState.noiseFrame = null;
    if (!isSnakeWindowVisible()) {
      return;
    }
    const hasAnimatedGame =
      snakeState.running ||
      snakeState.countdownTimer ||
      snakeState.gameOver ||
      snakeState.collectionPulses.length > 0;
    const allowAnimation = canAnimateSnake();
    const shouldDrawGame =
      snakeRenderDirty ||
      (allowAnimation &&
        hasAnimatedGame &&
        timestamp - snakeLastRenderAt >= SNAKE_RENDER_INTERVAL_MS);

    if (shouldDrawGame) {
      drawSnakeGame();
      snakeRenderDirty = false;
      snakeLastRenderAt = timestamp;
    }

    if (allowAnimation && timestamp - snakeLastNoiseAt >= SNAKE_NOISE_INTERVAL_MS) {
      drawSnakeNoise();
      snakeLastNoiseAt = timestamp;
    } else if (!allowAnimation) {
      clearNoiseCanvas(snakeNoiseCanvas);
    }

    if (snakeRenderDirty || (allowAnimation && hasAnimatedGame)) {
      snakeState.noiseFrame = requestAnimationFrame(animate);
    }
  };
  snakeState.noiseFrame = requestAnimationFrame(animate);
};

const clearSnakeTick = () => {
  if (!snakeState.tickTimer) return;
  clearTimeout(snakeState.tickTimer);
  snakeState.tickTimer = null;
};

const setSnakeDirection = (direction) => {
  if (!SNAKE_DIRECTIONS[direction]) return;
  if (!snakeState.running && !snakeState.countdownTimer) {
    const engineQueue = snakeState.engineState?.directionQueue || [];
    const base =
      snakeState.bufferedDirections.at(-1) ||
      engineQueue.at(-1) ||
      snakeState.engineState?.direction ||
      "right";
    if (
      engineQueue.length + snakeState.bufferedDirections.length >= 2 ||
      direction === base ||
      snakeDirectionsOppose(base, direction)
    ) return;
    snakeState.bufferedDirections.push(direction);
    snakeState.nextDirection = direction;
    return;
  }
  snakeRecordDirection(direction);
};

const resetSnakeGame = () => {
  clearSnakeTick();
  clearSnakeCountdown();
  snakeState.direction = "right";
  snakeState.nextDirection = "right";
  snakeState.directionQueue = [];
  snakeState.score = 0;
  snakeState.running = false;
  snakeState.hasStarted = false;
  snakeState.gameOver = false;
  snakeState.issuePending = false;
  snakeState.bufferedDirections = [];
  snakeState.runRevision += 1;
  snakeStats.dropSession();
  snakeState.recordAtStart = null;
  snakeState.collectionPulses = [];
  snakeInstallEngineState(snakeGenerateLocalState());
  updateSnakeHud();
  requestSnakeRender();
};

const endSnakeGame = () => {
  clearSnakeTick();
  clearSnakeCountdown();
  snakeState.directionQueue = [];
  snakeState.running = false;
  snakeState.gameOver = true;
  if (snakeState.hasStarted) {
    const completedEngine = snakeState.engineState;
    const completedResult = snakeResult(completedEngine);
    const submittedScore = snakeState.score;
    const previousHighScore = snakeState.recordAtStart;
    snakeStats.recordEvent(
      {
        type: "gamePlayed",
        boardSize: String(snakeState.gridSize),
        metric: snakeState.score,
      },
      {
        snakePreviousHighScore: snakeState.recordAtStart,
        terminalTick: completedResult.terminalTick,
        onCanonicalMetric: ({ metric, metricKind, updateLocalStats = true }) => {
          if (snakeState.engineState !== completedEngine || !snakeState.gameOver) return;
          if (metricKind !== "score" || !Number.isSafeInteger(metric) || metric < 0) return;
          snakeState.score = metric;
          if (updateLocalStats) {
            const highScoreKey = String(snakeState.gridSize);
            if (
              submittedScore > metric &&
              snakeState.highScores[highScoreKey] === submittedScore
            ) {
              if (Number.isFinite(previousHighScore)) {
                snakeState.highScores[highScoreKey] = previousHighScore;
              } else {
                delete snakeState.highScores[highScoreKey];
              }
            }
            updateSnakeHighScore();
            saveSnakeHighScores();
          }
          updateSnakeHud();
        },
      }
    );
  }
  saveSnakeHighScores();
  updateSnakeHud();
  requestSnakeRender();
  notifyActivity("gameLoss", { game: "snake" });
};

const snakeStep = () => {
  if (!snakeState.running) return;
  const previousScore = snakeState.score;
  const previousApples = snakeState.apples.slice();
  stepSnake(snakeState.engineState);
  snakeSyncEngineState();
  if (snakeState.score > previousScore) {
    const eatenApple = previousApples.find((apple) =>
      !snakeState.apples.some((candidate) => snakeCellsMatch(candidate, apple))
    );
    updateSnakeHighScore();
    if (eatenApple) {
      snakeState.collectionPulses.push({
        x: eatenApple.x,
        y: eatenApple.y,
        startedAt: performance.now(),
      });
    }
  }
  if (snakeState.gameOver) {
    endSnakeGame();
    return;
  }

  updateSnakeHud();
  requestSnakeRender();
  snakeState.tickTimer = setTimeout(snakeStep, SNAKE_TICK_MS);
};

const finishSnakeCountdown = () => {
  clearSnakeCountdown();
  if (!isSnakeWindowVisible() || !isPageActive(document)) {
    updateSnakeHud();
    requestSnakeRender();
    return;
  }
  snakeState.running = true;
  snakeState.hasStarted = true;
  updateSnakeHud();
  startSnakeNoiseAnimation();
  if (snakeCanvas) snakeCanvas.focus();
  clearSnakeTick();
  snakeState.tickTimer = setTimeout(snakeStep, SNAKE_TICK_MS);
  requestSnakeRender();
};

const startSnakeGame = async () => {
  if (snakeState.loading) return;
  if (snakeState.gameOver) resetSnakeGame();
  if (snakeState.running || snakeState.countdownTimer || snakeState.issuePending) return;
  const runRevision = snakeState.runRevision;
  snakeState.issuePending = true;
  if (!snakeState.hasStarted) {
    const storedHighScore = Number(
      snakeState.highScores[String(snakeState.gridSize)]
    );
    snakeState.recordAtStart = Number.isFinite(storedHighScore)
      ? storedHighScore
      : null;
    let descriptor = null;
    try {
      if (typeof snakeStats.issueGame === "function") {
        descriptor = await snakeStats.issueGame({
          boardSize: String(snakeState.gridSize),
        });
      } else {
        snakeStats.ensureSession({ boardSize: String(snakeState.gridSize) });
      }
    } catch {
      if (runRevision === snakeState.runRevision) snakeStats.dropSession();
      descriptor = null;
    }
    if (runRevision !== snakeState.runRevision) {
      return;
    }
    if (descriptor) {
      try {
        if (!descriptor.initial) throw new TypeError("Issued Snake state is missing");
        const issuedState = initialSnake(descriptor.initial);
        if (issuedState.configuration.boardSize !== String(snakeState.gridSize)) {
          throw new TypeError("Issued Snake state does not match the requested board");
        }
        snakeInstallEngineState(issuedState);
      } catch {
        snakeStats.dropSession();
        snakeInstallEngineState(snakeGenerateLocalState());
      }
    }
  }
  snakeState.hasStarted = true;
  if (snakeState.timingPromise) {
    await snakeState.timingPromise;
    if (runRevision !== snakeState.runRevision) {
      return;
    }
  }
  if (typeof snakeStats.resumeGame === "function") {
    let resumePromise;
    try {
      resumePromise = Promise.resolve(snakeStats.resumeGame()).catch(() => null);
    } catch {
      // Timing acknowledgement failures keep the run local-only.
      resumePromise = Promise.resolve(null);
    }
    snakeState.timingPromise = resumePromise;
    await resumePromise;
    if (snakeState.timingPromise === resumePromise) snakeState.timingPromise = null;
    if (runRevision !== snakeState.runRevision) {
      return;
    }
  }
  const pendingDirections = snakeState.bufferedDirections;
  snakeState.bufferedDirections = [];
  pendingDirections.forEach((direction) => snakeRecordDirection(direction));
  snakeState.issuePending = false;
  snakeState.countdownStartedAt = performance.now();
  snakeState.countdownDuration = SNAKE_RESUME_COUNTDOWN_MS;
  snakeState.countdownTimer = window.setTimeout(
    finishSnakeCountdown,
    SNAKE_RESUME_COUNTDOWN_MS
  );
  updateSnakeHud();
  startSnakeNoiseAnimation();
  if (snakeCanvas) snakeCanvas.focus();
  clearSnakeTick();
  requestSnakeRender();
};

const pauseSnakeGame = () => {
  if (!snakeState.running && !snakeState.countdownTimer) return;
  snakeState.running = false;
  clearSnakeCountdown();
  clearSnakeTick();
  if (typeof snakeStats.pauseGame === "function") {
    try {
      snakeState.timingPromise = Promise.resolve(snakeStats.pauseGame()).catch(() => null);
    } catch {
      // Timing acknowledgement failures keep the run local-only.
      snakeState.timingPromise = null;
    }
  }
  updateSnakeHud();
  requestSnakeRender();
};

const toggleSnakeGame = () => {
  if (snakeState.running || snakeState.countdownTimer) {
    pauseSnakeGame();
    return;
  }
  startSnakeGame();
};

const shouldSuppressSnakePointerClick = () => {
  const shouldSuppress = performance.now() < snakePointerPauseSuppressUntil;
  if (shouldSuppress) snakePointerPauseSuppressUntil = 0;
  return shouldSuppress;
};

document.addEventListener(
  "pointerdown",
  (event) => {
    if (
      (!snakeState.running && !snakeState.countdownTimer) ||
      !isSnakeWindowVisible()
    ) {
      return;
    }
    const target =
      event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target?.closest('[data-app-window="snake"]')) return;
    pauseSnakeGame();
    snakePointerPauseSuppressUntil =
      performance.now() + SNAKE_POINTER_PAUSE_SUPPRESSION_MS;
  },
  true
);

if (snakeStart) {
  snakeStart.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    toggleSnakeGame();
  });
}

if (snakeReset) {
  snakeReset.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    resetSnakeGame();
    if (snakeCanvas) snakeCanvas.focus();
  });
}

if (snakeHelp) {
  snakeHelp.addEventListener("click", (event) => {
    event.preventDefault();
    if (shouldSuppressSnakePointerClick()) return;
    setWindowOpen("snake-rules", true);
  });
}

snakeBoardSizeButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    const selectedSize = Number(button.dataset.snakeBoardSize);
    snakeState.gridSize =
      Number.isFinite(selectedSize) && selectedSize > 0
        ? selectedSize
        : SNAKE_DEFAULT_GRID_SIZE;
    saveSnakeSettings();
    resetSnakeGame();
    if (snakeCanvas) snakeCanvas.focus();
  });
});

snakeColorButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    const selectedColor = button.dataset.snakeColor;
    if (!SNAKE_COLOR_THEMES[selectedColor]) return;
    snakeState.color = selectedColor;
    saveSnakeSettings();
    updateSnakeHud();
    requestSnakeRender();
    if (snakeCanvas) snakeCanvas.focus();
  });
});

snakeAppleColorButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    const selectedColor = button.dataset.snakeAppleColor;
    if (!SNAKE_COLOR_THEMES[selectedColor]) return;
    snakeState.appleColor = selectedColor;
    saveSnakeSettings();
    updateSnakeHud();
    requestSnakeRender();
    if (snakeCanvas) snakeCanvas.focus();
  });
});

snakeDirectionButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    const direction = button.getAttribute("data-snake-direction");
    setSnakeDirection(direction);
    if (!snakeState.running && !snakeState.countdownTimer) startSnakeGame();
  });
});

registerActiveWindowKeyHandler("snake", (event) => {
  const target =
    event.target instanceof Element ? event.target : event.target?.parentElement;
  if (target?.matches("input, textarea, select")) return;
  if (snakeState.loading) {
    if (
      SNAKE_KEY_DIRECTIONS[event.key] ||
      event.key === " " ||
      event.key === "Enter"
    ) {
      event.preventDefault();
    }
    return;
  }
  if (snakeState.gameOver) {
    if (event.key === "Enter") {
      event.preventDefault();
      resetSnakeGame();
      if (snakeCanvas) snakeCanvas.focus();
      return;
    }
    if (SNAKE_KEY_DIRECTIONS[event.key] || event.key === " ") {
      event.preventDefault();
    }
    return;
  }
  const direction = SNAKE_KEY_DIRECTIONS[event.key];
  const beginsGame =
    !snakeState.hasStarted &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    event.key !== "Shift" &&
    event.key !== "Meta" &&
    event.key !== "Control" &&
    event.key !== "Alt";
  if (direction) {
    event.preventDefault();
    setSnakeDirection(direction);
    if (!snakeState.running && !snakeState.countdownTimer) startSnakeGame();
    return;
  }
  if (beginsGame) {
    event.preventDefault();
    startSnakeGame();
    return;
  }
  if (event.key === " ") {
    event.preventDefault();
    toggleSnakeGame();
  }
});

snakeState.highScores = loadSnakeHighScores();

const selectedSnakeBoardSizeButton =
  document.querySelector("[data-snake-board-size].is-selected") ||
  snakeBoardSizeButtons[0];

if (selectedSnakeBoardSizeButton) {
  const selectedSize = Number(selectedSnakeBoardSizeButton.dataset.snakeBoardSize);
  snakeState.gridSize =
    Number.isFinite(selectedSize) && selectedSize > 0
      ? selectedSize
      : SNAKE_DEFAULT_GRID_SIZE;
}

const selectedSnakeColorButton =
  document.querySelector("[data-snake-color].is-selected") ||
  snakeColorButtons[0];

if (
  selectedSnakeColorButton &&
  SNAKE_COLOR_THEMES[selectedSnakeColorButton.dataset.snakeColor]
) {
  snakeState.color = selectedSnakeColorButton.dataset.snakeColor;
}

const selectedSnakeAppleColorButton =
  document.querySelector("[data-snake-apple-color].is-selected") ||
  snakeAppleColorButtons[0];

if (
  selectedSnakeAppleColorButton &&
  SNAKE_COLOR_THEMES[selectedSnakeAppleColorButton.dataset.snakeAppleColor]
) {
  snakeState.appleColor = selectedSnakeAppleColorButton.dataset.snakeAppleColor;
}

const savedSnakeSettings = loadSnakeSettings();

if (savedSnakeSettings) {
  snakeState.gridSize = savedSnakeSettings.gridSize;
  snakeState.color = savedSnakeSettings.color;
  snakeState.appleColor = savedSnakeSettings.appleColor;
}

resetSnakeGame();

const handleSnakeActivityChange = () => {
  if (!isSnakeWindowVisible()) {
    stopSnakeNoiseAnimation();
    return;
  }
  if (!isPageActive(document)) {
    stopSnakeNoiseAnimation();
    if (snakeState.running || snakeState.countdownTimer) {
      pauseSnakeGame();
    } else {
      requestSnakeRender();
    }
    return;
  }
  requestSnakeRender();
};

const handleSnakeReducedMotionChange = () => {
  clearNoiseCanvas(snakeNoiseCanvas);
  if (isSnakeReducedMotion()) stopSnakeNoiseAnimation();
  requestSnakeRender();
};

document.addEventListener("visibilitychange", handleSnakeActivityChange);

window.addEventListener("blur", handleSnakeActivityChange);

window.addEventListener("focus", handleSnakeActivityChange);

if (snakeReducedMotionMedia) {
  if (typeof snakeReducedMotionMedia.addEventListener === "function") {
    snakeReducedMotionMedia.addEventListener("change", handleSnakeReducedMotionChange);
  } else if (typeof snakeReducedMotionMedia.addListener === "function") {
    snakeReducedMotionMedia.addListener(handleSnakeReducedMotionChange);
  }
}

registerWindowLifecycle("snake", {
  onOpen: () => startSnakeLoadingSequence(),
  onClose: () => {
    clearSnakeLoadingSequence();
    pauseSnakeGame();
    stopSnakeNoiseAnimation();
  },
});

registerViewportObserver({
  onFrame: () => {
    if (isSnakeWindowVisible()) requestSnakeRender();
  },
});

// Resetting Game Progress wipes this game's local records; Snake decides what
// that means rather than the Game Stats client reaching into its state.
registerGameStatsLocalSource("snake", {
  readLocalRecord: (size) => snakeState.highScores[size],
  resetLocalData: () => {
    if (snakeHighScoreSaveTimer) {
      clearTimeout(snakeHighScoreSaveTimer);
      snakeHighScoreSaveTimer = null;
    }
    snakeState.highScores = {};
    removeStorage(() => localStorage, SNAKE_HIGH_SCORE_KEY);
    updateSnakeHud();
  },
});

window.homeSnake = Object.freeze({
  SNAKE_HIGH_SCORE_KEY,
  clearSnakeLoadingSequence,
  isSnakeWindowVisible,
  pauseSnakeGame,
  requestSnakeRender,
  saveSnakeHighScores,
  saveSnakeSettings,
  snakeHighScoreSaveTimer,
  snakeState,
  startSnakeLoadingSequence,
  stopSnakeNoiseAnimation,
  updateSnakeHud,
});
})();
