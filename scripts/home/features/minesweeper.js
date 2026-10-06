(() => {
const {
  mediaSourcePreloadRequests,
  preloadMediaSource,
} = window.homeMedia;
const {
  GAME_STATS_DIFFICULTIES,
  createGameStatsHooks,
} = window.homeGameStats;
const {
  clampNumber,
  flashBanner,
  padTwoDigits,
} = window.homeUtil;
const {
  DIALOG_INITIAL_FOCUS_SELECTOR,
  bringWindowToFront,
  getAppWindow,
  isWindowVisible,
  registerActiveWindowKeyHandler,
  registerViewportObserver,
  registerWindowLifecycle,
  setWindowFocusReturn,
  setWindowOpen,
} = window.homeWindows;
const {
  notifyActivity,
} = window.homeActivity;
const {
  CONFIGURATIONS: MINESWEEPER_RULE_CONFIGS,
  generate: generateMinesweeper,
  initial: initialMinesweeper,
  transition: transitionMinesweeper,
} = window.homeMinesweeperRules;

const MINESWEEPER_CONFIGS = Object.freeze([
  MINESWEEPER_RULE_CONFIGS.beginner,
  MINESWEEPER_RULE_CONFIGS.intermediate,
  MINESWEEPER_RULE_CONFIGS.expert,
]);

const MINESWEEPER_COUNTER_MAX = 999;

const MINESWEEPER_TIMER_INTERVAL_MS = 1000;

const MINESWEEPER_CONFETTI_PIECE_COUNT = 120;


const MINESWEEPER_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL = 18;

const msGrid = document.getElementById("ms-grid");

const msMines = document.getElementById("ms-mines");

const msTime = document.getElementById("ms-time");

const msReset = document.getElementById("ms-reset");

const msFlagMode = document.getElementById("ms-flag-mode");

const msQuestionMode = document.getElementById("ms-question-mode");

const msControlsMode = document.getElementById("ms-controls-mode");

const msControlsHelp = document.getElementById("ms-controls-help");

const msDifficulty = document.getElementById("ms-difficulty");

const msLoseBanner = document.getElementById("ms-lose-banner");

const msAchievement = document.getElementById("ms-achievement");

const msBoard = document.querySelector("[data-app-window=\"minesweeper\"] .ms-board");

const msHelp = document.getElementById("ms-help");

const msWindow = msGrid?.closest('[data-app-window="minesweeper"]');

const MS_KEYBOARD_ACTIONS = Object.freeze({
  s: "click",
  d: "question",
  f: "flag",
});

const MS_CELL_NUMBER_SOURCES = Object.freeze(
  Array.from(
    { length: 8 },
    (_, index) => `assets/minesweeper_assets/cell_numbers/cell_${index + 1}.png`
  )
);

const msNumberAssetPreloads = mediaSourcePreloadRequests;

const preloadMinesweeperNumberAsset = (src) =>
  preloadMediaSource(src, { retainImagePreload: true });

const preloadMinesweeperNumberAssets = () =>
  Promise.all(MS_CELL_NUMBER_SOURCES.map(preloadMinesweeperNumberAsset));

const msConfig = Object.freeze(
  Object.fromEntries(
    GAME_STATS_DIFFICULTIES.map((difficulty, index) => [
      difficulty,
      MINESWEEPER_CONFIGS[index],
    ])
  )
);

const msDigitSources = {
  "0": "assets/minesweeper_assets/digital_digits/digital_0.png",
  "1": "assets/minesweeper_assets/digital_digits/digital_1.png",
  "2": "assets/minesweeper_assets/digital_digits/digital_2.png",
  "3": "assets/minesweeper_assets/digital_digits/digital_3.png",
  "4": "assets/minesweeper_assets/digital_digits/digital_4.png",
  "5": "assets/minesweeper_assets/digital_digits/digital_5.png",
  "6": "assets/minesweeper_assets/digital_digits/digital_6.png",
  "7": "assets/minesweeper_assets/digital_digits/digital_7.png",
  "8": "assets/minesweeper_assets/digital_digits/digital_8.png",
  "9": "assets/minesweeper_assets/digital_digits/digital_9.png",
  "-": "assets/minesweeper_assets/digital_digits/digital_minus.png",
  " ": "assets/minesweeper_assets/digital_digits/digital_blank.png",
};

const msState = {
  cols: 9,
  rows: 9,
  mines: 10,
  cells: [],
  elements: [],
  started: false,
  gameOver: false,
  timerId: null,
  timerSync: null,
  elapsedMs: 0,
  elapsed: 0,
  flagCount: 0,
  revealedSafeCount: 0,
  markMode: null,
  statsSession: "",
  engineState: null,
  issuePending: false,
  pendingInputs: [],
  boardRevision: 0,
  completionHandled: false,
};

const msStats = createGameStatsHooks("minesweeper", msState);

const msConfettiCanvas = document.getElementById("ms-confetti");

const msConfettiCtx = msConfettiCanvas ? msConfettiCanvas.getContext("2d") : null;

let msConfettiPieces = [];

let msConfettiAnimId = null;

const msResizeConfetti = () => {
  if (!msConfettiCanvas) return;
  msConfettiCanvas.width = window.innerWidth;
  msConfettiCanvas.height = window.innerHeight;
};

const msStartConfetti = () => {
  if (!msConfettiCanvas || !msConfettiCtx) return;
  msResizeConfetti();
  msConfettiPieces = Array.from({ length: MINESWEEPER_CONFETTI_PIECE_COUNT }, () => ({
    x: Math.random() * msConfettiCanvas.width,
    y: -20 - Math.random() * msConfettiCanvas.height * 0.3,
    size: 4 + Math.random() * 6,
    speed: 1 + Math.random() * 3,
    drift: (Math.random() - 0.5) * 1.5,
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 0.2,
    color: `hsl(${Math.random() * 360}, 90%, 60%)`,
  }));
  if (msConfettiAnimId) cancelAnimationFrame(msConfettiAnimId);

  const animate = () => {
    if (!msConfettiCanvas || !msConfettiCtx) return;
    msConfettiCtx.clearRect(0, 0, msConfettiCanvas.width, msConfettiCanvas.height);
    msConfettiPieces.forEach((piece) => {
      piece.x += piece.drift;
      piece.y += piece.speed;
      piece.rotation += piece.rotationSpeed;
      msConfettiCtx.save();
      msConfettiCtx.translate(piece.x, piece.y);
      msConfettiCtx.rotate(piece.rotation);
      msConfettiCtx.fillStyle = piece.color;
      msConfettiCtx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
      msConfettiCtx.restore();
    });
    msConfettiPieces = msConfettiPieces.filter(
      (piece) => piece.y < msConfettiCanvas.height + 30
    );
    if (msConfettiPieces.length > 0) {
      msConfettiAnimId = requestAnimationFrame(animate);
    } else {
      if (msConfettiAnimId) cancelAnimationFrame(msConfettiAnimId);
      msConfettiAnimId = null;
      msConfettiCtx.clearRect(0, 0, msConfettiCanvas.width, msConfettiCanvas.height);
    }
  };
  animate();
};

const msShowAchievement = () => {
  flashBanner(msAchievement);
};

const msRandomSeed = () => Math.floor(Math.random() * 0x1_0000_0000) >>> 0;

const msSyncEngineState = () => {
  const engine = msState.engineState;
  if (!engine) return;
  msState.cols = engine.configuration.cols;
  msState.rows = engine.configuration.rows;
  msState.mines = engine.configuration.mines;
  msState.started = engine.started;
  msState.gameOver = engine.terminal;
  msState.flagCount = engine.flagCount;
  msState.revealedSafeCount = engine.revealedSafeCount;
  msState.cells = engine.cells.map((cell) => ({
    mine: cell.mine,
    adjacent: cell.adjacent,
    revealed: cell.revealed,
    flagged: cell.mark === "flag",
    question: cell.mark === "question",
    blown: cell.blown,
    misflagged: cell.misflagged,
  }));
};

const msApplyEngineInput = (input, { record = true } = {}) => {
  if (!msState.engineState) return false;
  transitionMinesweeper(msState.engineState, {
    seq: msState.engineState.nextSeq,
    ...input,
  });
  if (record && typeof msStats.recordInput === "function") msStats.recordInput(input);
  msSyncEngineState();
  return true;
};

const msGenerateLocalBoard = (firstCell) => initialMinesweeper(
  generateMinesweeper(
    { difficulty: msDifficulty?.value || "beginner" },
    { seed: msRandomSeed(), firstCell }
  )
);

const msPrepareBoard = async (firstCell) => {
  if (msState.engineState) return true;
  if (msState.issuePending) return false;
  const boardRevision = msState.boardRevision;
  msState.issuePending = true;
  let descriptor = null;
  try {
    if (typeof msStats.issueGame === "function") {
      descriptor = await msStats.issueGame(
          { difficulty: msDifficulty?.value || "beginner" },
          { firstCell }
        );
    } else {
      msStats.ensureSession({ difficulty: msDifficulty?.value || "beginner" });
    }
  } catch {
    if (boardRevision === msState.boardRevision) msStats.dropSession();
    descriptor = null;
  }
  if (boardRevision !== msState.boardRevision) {
    return false;
  }
  try {
    if (descriptor) {
      if (!descriptor.initial) throw new TypeError("Issued Minesweeper state is missing");
      const issuedState = initialMinesweeper(descriptor.initial);
      if (
        issuedState.firstCell !== firstCell ||
        issuedState.configuration.difficulty !== (msDifficulty?.value || "beginner")
      ) {
        throw new TypeError("Issued Minesweeper state does not match the requested board");
      }
      msState.engineState = issuedState;
    } else {
      msState.engineState = msGenerateLocalBoard(firstCell);
    }
  } catch {
    msStats.dropSession();
    msState.engineState = msGenerateLocalBoard(firstCell);
  }
  const pendingInputs = msState.pendingInputs;
  msState.pendingInputs = [];
  pendingInputs.forEach((input) => msApplyEngineInput(input));
  if (typeof msStats.resumeGame === "function") {
    try {
      await msStats.resumeGame();
    } catch {
      // Timing acknowledgement failures keep the board local-only.
    }
  }
  if (boardRevision !== msState.boardRevision) {
    return false;
  }
  msState.issuePending = false;
  msSyncEngineState();
  msRenderAll();
  return true;
};

const formatSevenSegmentCounter = (value) => {
  const clamped = clampNumber(value, -99, MINESWEEPER_COUNTER_MAX);
  if (clamped < 0) {
    return `-${padTwoDigits(Math.abs(clamped))}`;
  }
  return String(clamped).padStart(3, "0");
};

const setSevenSegmentCounter = (el, value) => {
  if (!el) return;
  const digits = String(value).padStart(3, " ").slice(-3);
  const imgs = el.querySelectorAll("img");
  imgs.forEach((img, index) => {
    const char = digits[index] ?? " ";
    img.src = msDigitSources[char] || msDigitSources[" "];
    img.alt = char.trim() || " ";
  });
};

const msUpdateCounters = () => {
  if (!msMines || !msTime) return;
  const remaining = msState.mines - msState.flagCount;
  setSevenSegmentCounter(msMines, formatSevenSegmentCounter(remaining));
  setSevenSegmentCounter(msTime, formatSevenSegmentCounter(msState.elapsed));
};

const msSetFace = (face) => {
  if (msReset) msReset.setAttribute("data-face", face);
};

const msSetMarkMode = (mode) => {
  const nextMode = mode === "flag" || mode === "question" ? mode : null;
  msState.markMode = msState.markMode === nextMode ? null : nextMode;
  [msFlagMode, msQuestionMode].forEach((button) => {
    if (!button) return;
    const isActive = button.dataset.msMarkMode === msState.markMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

const msSetMobileControlsVisible = (isVisible) => {
  const visible = Boolean(isVisible);
  [msFlagMode, msQuestionMode].forEach((button) => {
    if (button) button.hidden = !visible;
  });
  if (!visible) msSetMarkMode(null);
};

const msSetControlsMode = (mode) => {
  const nextMode = ["keyboard", "mobile", "mouse"].includes(mode)
    ? mode
    : "keyboard";
  if (msControlsMode) msControlsMode.value = nextMode;
  msSetMobileControlsVisible(nextMode === "mobile");
  if (!msGrid) return;
  if (nextMode === "keyboard") {
    msGrid.setAttribute("aria-keyshortcuts", "S D F");
  } else {
    msGrid.removeAttribute("aria-keyshortcuts");
  }
};

const msReadTimerClocks = () => ({
  monotonic: performance.now(),
  wall: Date.now(),
});

/**
 * Accumulates real elapsed time since the previous sync, taking whichever
 * clock advanced further. The monotonic clock ignores device clock changes but
 * can pause during system sleep; the wall clock covers sleep but can jump
 * backwards, which counts as no advance. A throttled or hidden tab therefore
 * catches up, and the displayed seconds never decrease. Returns whether the
 * displayed value changed.
 */
const msSyncElapsed = () => {
  if (msState.timerSync === null) return false;
  const clocks = msReadTimerClocks();
  msState.elapsedMs += Math.max(
    clocks.monotonic - msState.timerSync.monotonic,
    clocks.wall - msState.timerSync.wall,
    0
  );
  msState.timerSync = clocks;
  const elapsed = clampNumber(
    Math.floor(msState.elapsedMs / MINESWEEPER_TIMER_INTERVAL_MS),
    msState.elapsed,
    MINESWEEPER_COUNTER_MAX
  );
  if (elapsed === msState.elapsed) return false;
  msState.elapsed = elapsed;
  return true;
};

const msStopTimer = () => {
  if (msSyncElapsed()) msUpdateCounters();
  if (msState.timerId) {
    clearInterval(msState.timerId);
    msState.timerId = null;
  }
};

const msStartTimer = () => {
  msStopTimer();
  if (typeof msStats.issueGame !== "function") {
    msStats.ensureSession({ difficulty: msDifficulty?.value || "beginner" });
  }
  msState.timerSync = msReadTimerClocks();
  msState.elapsedMs = 0;
  msState.timerId = setInterval(() => {
    if (msState.gameOver || !msState.started) return;
    if (msSyncElapsed()) msUpdateCounters();
  }, MINESWEEPER_TIMER_INTERVAL_MS);
};

const msRevealCell = (index) => {
  if (!msState.engineState || msState.gameOver) return;
  const cell = msState.cells[index];
  if (!cell || cell.revealed || cell.flagged) return;
  msApplyEngineInput({ op: "reveal", cell: index });
  msRenderAll();
  msCheckWin();
};

const msRevealAllMines = () => {
  msSyncEngineState();
  msRenderAll();
};

const msCheckWin = () => {
  const result = msState.engineState
    ? window.homeMinesweeperRules.result(msState.engineState)
    : null;
  if (!result?.terminal) return;
  if (msState.completionHandled) return;
  msState.completionHandled = true;
  msStopTimer();
  if (result.lost) {
    msSetFace("lose");
    if (msLoseBanner) msLoseBanner.classList.add("is-visible");
    msRevealAllMines();
    notifyActivity("gameLoss", { game: "minesweeper" });
    return;
  }
  if (result.won) {
    msSetFace("win");
    msStartConfetti();
    if (msDifficulty && msDifficulty.value === "expert") {
      msShowAchievement();
    }
    msRenderAll();
    const completedEngine = msState.engineState;
    msStats.recordEvent({
      type: "win",
      difficulty: msDifficulty?.value || "beginner",
      metric: msState.elapsed,
    }, {
      onCanonicalMetric: ({ metric, metricKind, elapsedMs }) => {
        if (msState.engineState !== completedEngine || !msState.gameOver) return;
        const canonicalSeconds = metricKind === "seconds"
          ? metric
          : Math.floor(elapsedMs / MINESWEEPER_TIMER_INTERVAL_MS);
        if (!Number.isSafeInteger(canonicalSeconds) || canonicalSeconds < 0) return;
        msState.elapsed = Math.min(canonicalSeconds, MINESWEEPER_COUNTER_MAX);
        msState.elapsedMs = msState.elapsed * MINESWEEPER_TIMER_INTERVAL_MS;
        msUpdateCounters();
      },
    });
    notifyActivity("gameWin", { game: "minesweeper" });
  }
};

const msRenderCell = (index) => {
  const cell = msState.cells[index];
  const el = msState.elements[index];
  if (!cell || !el) return;
  const row = Math.floor(index / msState.cols) + 1;
  const column = (index % msState.cols) + 1;
  let stateLabel = "covered";
  if (cell.misflagged) {
    stateLabel = "incorrectly flagged";
  } else if (cell.revealed && cell.mine) {
    stateLabel = cell.blown ? "triggered mine" : "mine";
  } else if (cell.revealed && cell.adjacent > 0) {
    stateLabel = `${cell.adjacent} adjacent ${cell.adjacent === 1 ? "mine" : "mines"}`;
  } else if (cell.revealed) {
    stateLabel = "revealed empty";
  } else if (cell.flagged) {
    stateLabel = "flagged";
  } else if (cell.question) {
    stateLabel = "maybe";
  }
  el.setAttribute("aria-label", `Row ${row}, column ${column}: ${stateLabel}`);
  el.className = "ms-cell";
  el.removeAttribute("data-number");
  el.textContent = "";
  if (cell.misflagged) {
    el.classList.add("is-mine-wrong");
    return;
  }
  if (cell.revealed) {
    el.classList.add("is-revealed");
    if (cell.mine) {
      el.classList.add("is-mine");
      if (cell.blown) el.classList.add("is-blown");
    } else if (cell.adjacent > 0) {
      el.setAttribute("data-number", String(cell.adjacent));
    }
    return;
  }
  if (cell.flagged) {
    el.classList.add("is-flagged");
  } else if (cell.question) {
    el.classList.add("is-question");
  }
};

const msRenderAll = () => {
  msState.cells.forEach((_, index) => msRenderCell(index));
  msUpdateCounters();
};

const msBuildGrid = () => {
  if (!msGrid) return;
  msGrid.innerHTML = "";
  msState.elements = [];
  msGrid.setAttribute("aria-rowcount", String(msState.rows));
  msGrid.setAttribute("aria-colcount", String(msState.cols));
  msGrid.style.gridTemplateColumns = `repeat(${msState.cols}, var(--ms-cell-size))`;
  msGrid.style.gridTemplateRows = `repeat(${msState.rows}, var(--ms-cell-size))`;
  // A grid must expose its cells through rows. `.ms-row` is `display: contents`
  // so the board keeps its single CSS grid of cells.
  for (let row = 0; row < msState.rows; row += 1) {
    const rowElement = document.createElement("div");
    rowElement.className = "ms-row";
    rowElement.setAttribute("role", "row");
    rowElement.setAttribute("aria-rowindex", String(row + 1));
    for (let col = 0; col < msState.cols; col += 1) {
      const index = row * msState.cols + col;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ms-cell";
      button.setAttribute("data-index", String(index));
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-rowindex", String(row + 1));
      button.setAttribute("aria-colindex", String(col + 1));
      button.setAttribute(
        "aria-label",
        `Row ${row + 1}, column ${col + 1}: covered`
      );
      rowElement.appendChild(button);
      msState.elements.push(button);
    }
    msGrid.appendChild(rowElement);
  }
};

const msUpdateBoardAlignment = () => {
  if (!msBoard || !msGrid) return;
  const shouldOverflow = msGrid.scrollWidth > msBoard.clientWidth;
  msBoard.classList.toggle("is-overflowing", shouldOverflow);
};

const msNewGame = (difficulty) => {
  const config = msConfig[difficulty] || msConfig.beginner;
  msState.cols = config.cols;
  msState.rows = config.rows;
  msState.mines = config.mines;
  msState.cells = Array.from({ length: config.cols * config.rows }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    question: false,
    blown: false,
    misflagged: false,
    adjacent: 0,
  }));
  msState.started = false;
  msState.gameOver = false;
  msState.timerSync = null;
  msState.elapsedMs = 0;
  msState.elapsed = 0;
  msState.flagCount = 0;
  msState.revealedSafeCount = 0;
  msState.engineState = null;
  msState.issuePending = false;
  msState.pendingInputs = [];
  msState.boardRevision += 1;
  msState.completionHandled = false;
  msStats.dropSession();
  msSetFace("smile");
  msStopTimer();
  if (msLoseBanner) msLoseBanner.classList.remove("is-visible");
  msBuildGrid();
  msUpdateBoardAlignment();
  msUpdateCounters();
};

const msHandleLeftClick = async (index) => {
  if (msState.gameOver || msState.issuePending) return;
  const cell = msState.cells[index];
  if (!cell) return;
  if (msState.markMode) {
    msToggleMark(index, msState.markMode);
    return;
  }
  if (cell.revealed) {
    msChord(index);
    return;
  }
  if (!msState.started) {
    const prepared = await msPrepareBoard(index);
    if (!prepared || msState.gameOver) return;
    msStartTimer();
  }
  msRevealCell(index);
};

const msToggleFlag = (index) => {
  const cell = msState.cells[index];
  if (!cell || cell.revealed || msState.gameOver || msState.issuePending) return;
  const mark = cell.flagged ? "question" : cell.question ? "none" : "flag";
  msSetCellMark(index, mark);
};

const msSetCellMark = (index, mark) => {
  const cell = msState.cells[index];
  const alreadyMarked =
    cell?.flagged === (mark === "flag") && cell?.question === (mark === "question");
  if (!cell || cell.revealed || msState.gameOver || msState.issuePending || alreadyMarked) {
    return;
  }
  const input = { op: "mark", cell: index, mark };
  if (msState.engineState) {
    msApplyEngineInput(input);
  } else {
    msState.pendingInputs.push(input);
    const wasFlagged = cell.flagged;
    cell.flagged = mark === "flag";
    cell.question = mark === "question";
    if (cell.flagged !== wasFlagged) msState.flagCount += cell.flagged ? 1 : -1;
  }
  msRenderCell(index);
  msUpdateCounters();
};

const msToggleMark = (index, mode) => {
  const cell = msState.cells[index];
  if (!cell || cell.revealed || msState.gameOver || msState.issuePending) return;
  let mark;
  if (mode === "flag") {
    mark = cell.flagged ? "none" : "flag";
  } else if (mode === "question") {
    mark = cell.question ? "none" : "question";
  } else {
    return;
  }
  msSetCellMark(index, mark);
};

const msChord = (index) => {
  const cell = msState.cells[index];
  if (
    !cell || !cell.revealed || cell.adjacent === 0 ||
    msState.gameOver || msState.issuePending
  ) return;
  try {
    msApplyEngineInput({ op: "chord", cell: index });
  } catch (error) {
    if (error?.code === "illegal-action") return;
    throw error;
  }
  msRenderAll();
  msCheckWin();
};

const msKeyboardTargetIndex = () => {
  if (!msGrid) return null;
  const cell = msGrid.querySelector(".ms-cell:hover");
  if (!cell) return null;
  const index = Number(cell.getAttribute("data-index"));
  if (!Number.isInteger(index) || msState.elements[index] !== cell) return null;
  return index;
};

registerActiveWindowKeyHandler("minesweeper", (event) => {
  const action = MS_KEYBOARD_ACTIONS[event.key.toLowerCase()];
  if (!action) return;
  if (
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    msState.gameOver ||
    msControlsMode?.value !== "keyboard" ||
    !msWindow
  ) {
    return;
  }
  const index = msKeyboardTargetIndex();
  if (index === null) return;
  event.preventDefault();
  if (action === "click") {
    msHandleLeftClick(index);
    return;
  }
  msToggleMark(index, action);
});

if (msGrid) {
  msGrid.addEventListener("click", (event) => {
    const cell = event.target.closest(".ms-cell");
    if (!cell) return;
    const index = Number(cell.getAttribute("data-index"));
    if (Number.isNaN(index)) return;
    msHandleLeftClick(index);
  });

  msGrid.addEventListener("dblclick", (event) => {
    const cell = event.target.closest(".ms-cell");
    if (!cell) return;
    const index = Number(cell.getAttribute("data-index"));
    if (Number.isNaN(index)) return;
    msChord(index);
  });

  msGrid.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest(".ms-cell");
    if (!cell) return;
    event.preventDefault();
    const index = Number(cell.getAttribute("data-index"));
    if (Number.isNaN(index)) return;
    msToggleFlag(index);
  });

  msGrid.addEventListener("pointerdown", (event) => {
    if (msState.gameOver) return;
    const cell = event.target.closest(".ms-cell");
    if (!cell) return;
    if (msState.markMode) return;
    msSetFace("ooh");
    cell.classList.add("is-pressed");
    if (cell.classList.contains("is-question")) {
      cell.classList.add("is-pressed");
    }
  });

  msGrid.addEventListener("pointerup", (event) => {
    if (!msState.gameOver) msSetFace("smile");
    const cell = event.target.closest(".ms-cell");
    if (cell) cell.classList.remove("is-pressed");
  });

  msGrid.addEventListener("pointerleave", () => {
    if (!msState.gameOver) msSetFace("smile");
    msGrid.querySelectorAll(".ms-cell.is-pressed").forEach((cell) => {
      cell.classList.remove("is-pressed");
    });
  });
}

if (msReset) {
  msReset.addEventListener("click", () => {
    msNewGame(msDifficulty ? msDifficulty.value : "beginner");
  });

  msReset.addEventListener("pointerdown", () => {
    if (!msState.gameOver) msSetFace("pressed");
  });

  msReset.addEventListener("pointerup", () => {
    if (!msState.gameOver) msSetFace("smile");
  });

  msReset.addEventListener("pointerleave", () => {
    if (!msState.gameOver) msSetFace("smile");
  });
}

[[msFlagMode, "flag"], [msQuestionMode, "question"]].forEach(([button, mode]) => {
  if (!button) return;
  button.addEventListener("click", () => {
    msSetMarkMode(mode);
  });
});

if (msControlsHelp) {
  msControlsHelp.addEventListener("click", () => {
    notifyActivity("newTabLink", {
      href: "https://en.wikipedia.org/wiki/Minesweeper_(video_game)",
      source: "minesweeper-controls-help",
    });
    window.open("https://en.wikipedia.org/wiki/Minesweeper_(video_game)", "_blank", "noopener,noreferrer");
  });
}

if (msDifficulty) {
  msDifficulty.addEventListener("change", () => {
    msNewGame(msDifficulty.value);
  });
}

if (msControlsMode) {
  msControlsMode.addEventListener("change", () => {
    msSetControlsMode(msControlsMode.value);
  });
}

msSetMarkMode(null);

msSetControlsMode("keyboard");

msNewGame("beginner");

registerWindowLifecycle("minesweeper", {
  beforeOpen: () => {
    void preloadMinesweeperNumberAssets();
  },
  // Dismissing the board also puts the controls away and deals a fresh game,
  // so reopening never resumes a board the player walked away from.
  afterDismiss: () => {
    setWindowOpen("minesweeper-controls", false);
    msNewGame(msDifficulty ? msDifficulty.value : "beginner");
  },
});

registerWindowLifecycle("minesweeper-controls", {
  afterDismiss: () => {
    if (isWindowVisible(msWindow)) bringWindowToFront(msWindow);
  },
});

registerViewportObserver({
  onFrame: () => {
    msResizeConfetti();
    msUpdateBoardAlignment();
  },
});

if (msHelp) {
  msHelp.addEventListener("click", () => {
    const controlsWindow = getAppWindow("minesweeper-controls");
    setWindowFocusReturn(controlsWindow, msHelp);
    setWindowOpen("minesweeper-controls", true);
    requestAnimationFrame(() => {
      controlsWindow
        ?.querySelector(DIALOG_INITIAL_FOCUS_SELECTOR)
        ?.focus({ preventScroll: true });
    });
  });
}

window.homeMinesweeper = Object.freeze({
  formatSevenSegmentCounter,
  setSevenSegmentCounter,
  MINESWEEPER_COUNTER_MAX,
  MINESWEEPER_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL,
  msDifficulty,
  msDigitSources,
  msHelp,
  msNewGame,
  msResizeConfetti,
  msStartConfetti,
  msUpdateBoardAlignment,
  msWindow,
  preloadMinesweeperNumberAssets,
});
})();
