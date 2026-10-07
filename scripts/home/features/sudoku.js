(() => {
const {
  all,
  byId,
  one,
} = window.homeDom;
const {
  afterFrames,
  clampNumber,
  createProgressLoader,
  debounceTimer,
  flashBanner,
  formatElapsedTime,
  isPageActive,
  readJsonStorage,
  reducedMotionQuery,
  removeStorage,
  writeJsonStorage,
} = window.homeUtil;
const {
  isHomeActivationReady,
  runAfterHomeActivation,
} = window.homeActivation;
const {
  createGameStatsHooks,
  resumeGameStatsAuthenticationAfterCompletion,
  registerGameStatsLocalSource,
  requestGameStatsAdministratorAuthentication,
} = window.homeGameStats;
const {
  clampWindowFullyIntoViewport,
  getAppWindow,
  isWindowVisible,
  registerActiveWindowKeyHandler,
  registerViewportObserver,
  registerWindowLifecycle,
} = window.homeWindows;
const {
  solStartFireworks,
} = window.homeSolitaire;
const {
  msStartConfetti,
} = window.homeMinesweeper;
const {
  notifyActivity,
} = window.homeActivity;
const {
  createBudget,
} = window.homeGameRules;
const sudokuRules = window.homeSudokuRules;

const sudokuWindow = one('[data-app-window="sudoku"]');
const sudokuApp = one(".sudoku-app");
const sudokuAeroPanel = one(".sudoku-aero-panel");
const sudokuLoadingScreen = byId("sudoku-loading-screen");
const sudokuAquariumLayer = byId("sudoku-aquarium-layer");
const sudokuLoadingMeter = byId("sudoku-loading-meter");
const sudokuLoadingFill = byId("sudoku-loading-fill");
const sudokuPlay = byId("sudoku-play");
const sudokuGeneratorSource = byId("sudoku-generator-source");
const sudokuGrid = byId("sudoku-grid");
const sudokuGridFrame = one(".sudoku-grid-frame");
const sudokuControlPanel = one(".sudoku-control-panel");
const sudokuPauseOverlay = byId("sudoku-pause-overlay");
const sudokuResume = byId("sudoku-resume");
const sudokuDifficultyButtons = all("[data-sudoku-difficulty]");
const sudokuNumberButtons = all("[data-sudoku-number]");
const sudokuHintButtons = all("[data-sudoku-hint]");
const sudokuNoteToggle = byId("sudoku-note-toggle");
const sudokuNew = byId("sudoku-new");
const sudokuUndo = byId("sudoku-undo");
const sudokuRedo = byId("sudoku-redo");
const sudokuCheck = byId("sudoku-check");
const sudokuPause = byId("sudoku-pause");
const sudokuStatus = byId("sudoku-status");
const sudokuMistakes = byId("sudoku-mistakes");
const sudokuTime = byId("sudoku-time");
const sudokuLeaderboardChecks = byId("sudoku-leaderboard-checks");
const sudokuErrorsHint = one('[data-sudoku-hint="errors"]');
const sudokuErrorsPrompt = byId("sudoku-errors-prompt");
const sudokuErrorsCancel = byId("sudoku-errors-cancel");
const sudokuErrorsConfirm = byId("sudoku-errors-confirm");
const sudokuSolvePopup = byId("sudoku-solve-popup");
const sudokuSolveMessage = byId("sudoku-solve-message");
const sudokuSolveOk = byId("sudoku-solve-ok");
const sudokuAchievement = byId("sudoku-achievement");

const SUDOKU_DIGITS = "123456789";

const SUDOKU_CELL_COUNT = 81;

const SUDOKU_ROW_COUNT = 9;

// Conflicts read the board alone, so they sit alongside Errors as a mode the
// player can hold without forfeiting the leaderboard.
const SUDOKU_HINT_MODES = Object.freeze(["off", "conflicts", "errors"]);

const SUDOKU_STORAGE_KEY = "personalSiteSudokuStateV1";

const SUDOKU_COMPLETION_CLAIMS_KEY = "personalSiteSudokuCompletionsV1";

// Claims are ~100 bytes each. The cap only bounds storage; a tab that missed
// the claim event and outlives this many later completions could republish.
const SUDOKU_MAX_COMPLETION_CLAIMS = 500;

const SUDOKU_SAVE_DEBOUNCE_MS = 250;

const SUDOKU_MAX_UNDO_STATES = 80;

const SUDOKU_TIMER_INTERVAL_MS = 1000;

const SUDOKU_MAX_LEADERBOARD_CHECKS = 3;

const SUDOKU_MAX_FISH = 18;

const SUDOKU_MAX_BUBBLE_CLUSTERS = 5;

const SUDOKU_NOTE_SHORTCUT_HINT = "Press N to toggle";

const createSudokuEmptyValues = () =>
  Array.from({ length: SUDOKU_CELL_COUNT }, () => "");

const createSudokuEmptyNotes = () =>
  Array.from({ length: SUDOKU_CELL_COUNT }, () => "");

// The meter's floor, so the boot screen does not flash past. Past the floor
// the loader waits on the generator instead of on a second timer.
const SUDOKU_LOAD_MIN_MS = 1300;

const SUDOKU_LOAD_READY_POLL_MS = 90;

const SUDOKU_PLAY_BURST_MS = 820;

const SUDOKU_FISH_TYPES = Object.freeze(["clown", "tang", "butterfly", "wrasse"]);

const SUDOKU_FISH_DEPTHS = Object.freeze({
  far: {
    size: [16, 28],
    opacity: [0.28, 0.46],
    blur: [0.5, 1.2],
    duration: [18000, 30000],
    school: [3, 7],
    schoolChance: 0.62,
    top: [16, 78],
    saturate: [0.75, 0.95],
  },
  mid: {
    size: [30, 48],
    opacity: [0.5, 0.68],
    blur: [0.12, 0.45],
    duration: [12000, 20000],
    school: [2, 5],
    schoolChance: 0.38,
    top: [20, 82],
    saturate: [0.95, 1.15],
  },
  near: {
    size: [56, 86],
    opacity: [0.72, 0.9],
    blur: [0, 0.12],
    duration: [8500, 14500],
    school: [1, 3],
    schoolChance: 0.18,
    top: [26, 84],
    saturate: [1.05, 1.25],
  },
});

const SUDOKU_WIN_EFFECTS = Object.freeze({
  hard: { fireworks: true, confetti: false },
  expert: { fireworks: true, confetti: false },
  master: { fireworks: true, confetti: true },
  extreme: { fireworks: true, confetti: true },
});

const SUDOKU_PUZZLES = Object.freeze({
  easy: {
    id: "seed-easy",
    label: "Easy",
    puzzle:
      "402030000795020003001705400100004005609000000248507310900108500800050071017043092",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
  medium: {
    id: "seed-medium",
    label: "Medium",
    puzzle:
      "000030007000026000300095426003900060650310048208067010920170000004250000510640090",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
  hard: {
    id: "seed-hard",
    label: "Hard",
    puzzle:
      "060830000090000080381705400173080260600000708008500300000100004800250001510000092",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
  expert: {
    id: "seed-expert",
    label: "Expert",
    puzzle:
      "002831000005400080001095406070000005059002000008060009906070530030000071000040090",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
  master: {
    id: "seed-master",
    label: "Master",
    puzzle:
      "400031050000006000380000400000080060009000000000067019006008004800209000507600002",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
  extreme: {
    id: "seed-extreme",
    label: "Extreme",
    puzzle:
      "600000010400000000020000000000050407008040300001090000300400200050100000000806009",
    solution:
      "693784512487512936125963874932651487568247391741398625319475268856129743274836159",
  },
});

const SUDOKU_GENERATOR_CLUES = Object.freeze({
  easy: 42,
  medium: 36,
  hard: 32,
  expert: 28,
  master: 26,
  extreme: 24,
});

const SUDOKU_GENERATOR_MAX_ATTEMPTS = 3;

const SUDOKU_FULL_DIGIT_MASK = 0b1111111110;



let sudokuState = {
  difficulty: "easy",
  // Blank scaffolding: the first puzzle is carved off-thread when Sudoku is
  // opened, so a page that never opens it never adopts one.
  puzzleId: "",
  puzzle: "0".repeat(SUDOKU_CELL_COUNT),
  solution: "0".repeat(SUDOKU_CELL_COUNT),
  mistakes: 0,
  elapsedSeconds: 0,
  timerId: null,
  timerStartedAt: 0,
  loadingTimerId: null,
  transitionTimerId: null,
  loadingStartedAt: 0,
  loadingDuration: 0,
  loadingProgress: 0,
  playing: false,
  solved: false,
  completionRecorded: false,
  usedHint: false,
  usedReveal: false,
  checksUsed: 0,
  errorsConfirmed: false,
  statsSession: "",
  statsSessionEligible: true,
  hintMode: "off",
  noteMode: false,
  values: createSudokuEmptyValues(),
  notes: createSudokuEmptyNotes(),
  selectedIndex: -1,
};

const sudokuStats = createGameStatsHooks("sudoku", () => sudokuState);

/**
 * The rule engine's view of the puzzle on screen. `sudokuState` is what the grid
 * is drawn from and what the save file carries; this is what decides whether an
 * edit is allowed, what a Check costs, and when the board is finished, so the
 * puzzle a player solves and the puzzle a verifier replays are the same puzzle.
 * It also carries the bounded undo and redo stacks.
 */
let sudokuGame = null;

/**
 * Logical changes applied to the board on screen that no attached proof covers.
 *
 * Whether the board has been played on cannot be read off the board itself.
 * `moves` counts entries and pencil marks only, so accepting the Errors warning,
 * changing the hint mode or turning notes on all leave it at zero, and an entry
 * that was undone leaves it back at zero — yet every one of those is recorded as
 * an input and will be replayed by the verifier. So the count is kept here, at
 * the one place every applied change passes through, and it is cleared only when
 * the board is replaced by one the proof does account for.
 */
let sudokuAppliedMoves = 0;

let sudokuCellElements = [];

// The boot loader holds until a real puzzle exists, and the newest request
// for one wins, so a superseded generation cannot land on the board.
let sudokuPuzzleReady = false;

let sudokuPuzzleRequestToken = 0;

// Pause is not part of sudokuState: a new puzzle replaces that object wholesale,
// and the save payload deliberately carries no paused flag, because a reload
// comes back through the boot loader and its Play button.
let sudokuPaused = false;

let sudokuStatusBeforePause = "";

let sudokuSaveTimerId = null;

let sudokuSaveQueuedForActivation = false;

let sudokuFishTimerId = null;

let sudokuBubbleTimerId = null;

let sudokuNoteTooltip = null;

const sudokuReducedMotionMedia = reducedMotionQuery;

const sudokuCells = () =>
  sudokuCellElements.length
    ? sudokuCellElements
    : sudokuGrid
      ? Array.from(sudokuGrid.querySelectorAll(".sudoku-cell"))
      : [];

const normalizeSudokuDigit = (value) =>
  Array.from(String(value || "")).find((char) => SUDOKU_DIGITS.includes(char)) ||
  "";

/**
 * What a control may ask for: exactly one digit, or the empty string meaning
 * clear. Anything else is `null`, and the caller refuses it.
 *
 * `normalizeSudokuDigit` above reads one character out of a saved grid, where
 * reaching past a stray character is the right thing to do. An input is not a
 * saved grid: trimming "89" down to "8" would accept a value the player never
 * chose and hand the rules a move that looks legal, so the two are kept apart.
 */
const sudokuDigitInput = (value) => {
  if (value === "") return "";
  if (typeof value !== "string" || value.length !== 1) return null;
  return SUDOKU_DIGITS.includes(value) ? value : null;
};

const normalizeSudokuDifficulty = (difficulty) =>
  SUDOKU_PUZZLES[difficulty] ? difficulty : "easy";

const normalizeSudokuHintMode = (mode) =>
  SUDOKU_HINT_MODES.includes(mode) ? mode : "off";

const isSudokuGivenAt = (puzzle, index) =>
  SUDOKU_DIGITS.includes(String(puzzle || "")[index] || "");

const normalizeSudokuValues = (values, puzzle = sudokuState.puzzle) => {
  const isArraySource = Array.isArray(values);
  const raw = isArraySource ? values : String(values || "");
  const normalized = createSudokuEmptyValues();
  const safePuzzle = String(puzzle || "").padEnd(SUDOKU_CELL_COUNT, "0");
  for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
    if (isSudokuGivenAt(safePuzzle, index)) {
      normalized[index] = safePuzzle[index];
    } else {
      normalized[index] = normalizeSudokuDigit(raw[index]);
    }
  }
  return normalized;
};

const normalizeSudokuNotes = (notes) =>
  Array.from(new Set(Array.from(notes || "").filter((char) => SUDOKU_DIGITS.includes(char))))
    .sort()
    .join("");

const normalizeSudokuNotesList = (notes, puzzle = sudokuState.puzzle) => {
  const safePuzzle = String(puzzle || "").padEnd(SUDOKU_CELL_COUNT, "0");
  const rawNotes = Array.isArray(notes) ? notes : [];
  return Array.from({ length: SUDOKU_CELL_COUNT }, (_, index) =>
    isSudokuGivenAt(safePuzzle, index) ? "" : normalizeSudokuNotes(rawNotes[index])
  );
};

const normalizeSudokuSelectedIndex = (index) => {
  const selectedIndex = Number(index);
  return Number.isInteger(selectedIndex) &&
    selectedIndex >= 0 &&
    selectedIndex < SUDOKU_CELL_COUNT
    ? selectedIndex
    : -1;
};

const normalizeSudokuPuzzleString = (puzzle) => {
  const raw = String(puzzle || "");
  return Array.from({ length: SUDOKU_CELL_COUNT }, (_, index) =>
    SUDOKU_DIGITS.includes(raw[index]) ? raw[index] : "0"
  ).join("");
};

const normalizeSudokuSolutionString = (solution) => {
  const raw = String(solution || "");
  return Array.from({ length: SUDOKU_CELL_COUNT }, (_, index) =>
    SUDOKU_DIGITS.includes(raw[index]) ? raw[index] : "0"
  ).join("");
};

const sudokuBoxIndex = (row, column) =>
  Math.floor(row / 3) * 3 + Math.floor(column / 3);

/** The other twenty cells that share a row, column, or box with each index. */
const SUDOKU_PEER_INDEXES = Object.freeze(
  Array.from({ length: SUDOKU_CELL_COUNT }, (unusedCell, index) => {
    const row = Math.floor(index / 9);
    const column = index % 9;
    const box = sudokuBoxIndex(row, column);
    const peers = [];
    for (let other = 0; other < SUDOKU_CELL_COUNT; other += 1) {
      if (other === index) continue;
      const otherRow = Math.floor(other / 9);
      const otherColumn = other % 9;
      if (
        otherRow === row ||
        otherColumn === column ||
        sudokuBoxIndex(otherRow, otherColumn) === box
      ) {
        peers.push(other);
      }
    }
    return Object.freeze(peers);
  })
);

const countSudokuMaskBits = (mask) => {
  let count = 0;
  let remainingMask = mask;
  while (remainingMask) {
    remainingMask &= remainingMask - 1;
    count += 1;
  }
  return count;
};

const isCompleteSudokuSolution = (solution) => {
  const normalizedSolution = normalizeSudokuSolutionString(solution);
  if (normalizedSolution.includes("0")) return false;

  for (let row = 0; row < 9; row += 1) {
    let rowMask = 0;
    let columnMask = 0;
    for (let offset = 0; offset < 9; offset += 1) {
      rowMask |= 1 << Number(normalizedSolution[row * 9 + offset]);
      columnMask |= 1 << Number(normalizedSolution[offset * 9 + row]);
    }
    if (rowMask !== SUDOKU_FULL_DIGIT_MASK || columnMask !== SUDOKU_FULL_DIGIT_MASK) {
      return false;
    }
  }

  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < 3; boxColumn += 1) {
      let boxMask = 0;
      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          const index = (boxRow * 3 + row) * 9 + boxColumn * 3 + column;
          boxMask |= 1 << Number(normalizedSolution[index]);
        }
      }
      if (boxMask !== SUDOKU_FULL_DIGIT_MASK) return false;
    }
  }

  return true;
};

const isSudokuSolutionCompatibleWithPuzzle = (puzzle, solution) => {
  const normalizedPuzzle = normalizeSudokuPuzzleString(puzzle);
  const normalizedSolution = normalizeSudokuSolutionString(solution);
  if (!isCompleteSudokuSolution(normalizedSolution)) return false;
  return Array.from(normalizedPuzzle).every(
    (value, index) => value === "0" || value === normalizedSolution[index]
  );
};

const createSudokuPuzzleId = (difficulty) =>
  `generated-${difficulty}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

/*
 * Generation runs in scripts/home/sudoku-generator.worker.js, which owns it
 * outright. Carving a puzzle re-solves the grid after every removed clue, and
 * on the main thread that ran during script evaluation and again on every New
 * Game, freezing the page both times.
 *
 * A puzzle is taken from a warm pool when one is waiting, which is the usual
 * case: after each use the worker refills that difficulty in the background.
 * A cold difficulty resolves asynchronously instead of blocking, and the boot
 * loader holds until a real puzzle exists rather than finishing on a timer.
 *
 * The id is still minted here, at the moment a puzzle is adopted, so puzzle
 * identity belongs to the state that saves it and never to the pool.
 */
const SUDOKU_POOL_TARGET = 1;

const SUDOKU_GENERATING_STATUS = "Generating";

let sudokuGeneratorWorker = null;

let sudokuGeneratorUnavailable = false;

let sudokuGeneratorNextRequestId = 0;

/** requestId -> { difficulty, resolve }. */
const sudokuGeneratorRequests = new Map();

/** difficulty -> generated puzzles waiting to be adopted. */
const sudokuPuzzlePool = new Map();

/** difficulty -> resolvers waiting for the next puzzle of that difficulty. */
const sudokuPuzzleWaiters = new Map();

/** The one waiter the board itself is holding, so a newer request can drop it. */
let sudokuPendingAdoption = null;

const staticSudokuPuzzle = (difficulty) => {
  const seed = SUDOKU_PUZZLES[difficulty];
  return { clues: 0, puzzle: seed.puzzle, solution: seed.solution };
};

/**
 * Hands every pending request the static puzzle its difficulty ships with.
 * Used when the worker cannot start or dies: the site already carries a
 * playable puzzle per difficulty, so no generation moves back to this thread.
 */
const abandonSudokuGenerator = () => {
  sudokuGeneratorUnavailable = true;
  sudokuGeneratorWorker = null;
  const pending = [...sudokuGeneratorRequests.values()];
  sudokuGeneratorRequests.clear();
  pending.forEach(({ difficulty, resolve }) => resolve(staticSudokuPuzzle(difficulty)));
  const waiting = [...sudokuPuzzleWaiters.entries()];
  sudokuPuzzleWaiters.clear();
  waiting.forEach(([difficulty, resolvers]) => {
    resolvers.forEach((resolve) => resolve(staticSudokuPuzzle(difficulty)));
  });
};

const handleSudokuGeneratorMessage = (event) => {
  const { requestId, difficulty, puzzle, solution, clues, error } = event.data || {};
  const request = sudokuGeneratorRequests.get(requestId);
  if (!request) return;
  sudokuGeneratorRequests.delete(requestId);
  request.resolve(
    error || !puzzle || !solution
      ? staticSudokuPuzzle(request.difficulty)
      : { clues, puzzle, solution }
  );
  if (difficulty) topUpSudokuPuzzlePool(difficulty);
};

const getSudokuGeneratorWorker = () => {
  if (sudokuGeneratorWorker || sudokuGeneratorUnavailable) return sudokuGeneratorWorker;
  const source = sudokuGeneratorSource?.getAttribute("href");
  if (!source || typeof Worker !== "function") {
    abandonSudokuGenerator();
    return null;
  }
  try {
    sudokuGeneratorWorker = new Worker(source);
  } catch (error) {
    abandonSudokuGenerator();
    return null;
  }
  sudokuGeneratorWorker.addEventListener("message", handleSudokuGeneratorMessage);
  sudokuGeneratorWorker.addEventListener("error", abandonSudokuGenerator);
  return sudokuGeneratorWorker;
};

/** Asks the worker for one puzzle, resolving with a static one if it cannot. */
const generateSudokuPuzzle = (difficulty, resolve) => {
  const worker = getSudokuGeneratorWorker();
  if (!worker) {
    resolve(staticSudokuPuzzle(difficulty));
    return;
  }
  const requestId = (sudokuGeneratorNextRequestId += 1);
  sudokuGeneratorRequests.set(requestId, { difficulty, resolve });
  worker.postMessage({
    requestId,
    difficulty,
    targetClues: SUDOKU_GENERATOR_CLUES[difficulty] || SUDOKU_GENERATOR_CLUES.easy,
    maxAttempts: SUDOKU_GENERATOR_MAX_ATTEMPTS,
  });
};

const sudokuPuzzlesInFlightFor = (difficulty) =>
  [...sudokuGeneratorRequests.values()].filter(
    (request) => request.difficulty === difficulty
  ).length;

/**
 * Keeps at most `SUDOKU_POOL_TARGET` spares per difficulty. Work that was
 * already in flight when its waiter went away still delivers, and a puzzle
 * nobody has room for is dropped rather than stockpiled: one player can only
 * play one board, so a full pool is the whole demand.
 */
const returnSudokuPuzzleToPool = (difficulty, generated) => {
  const pool = sudokuPuzzlePool.get(difficulty) || [];
  if (pool.length >= SUDOKU_POOL_TARGET) return;
  pool.push(generated);
  sudokuPuzzlePool.set(difficulty, pool);
};

/** Drops a waiter that no longer has anyone to hand its puzzle to. */
const cancelSudokuPuzzleWaiter = (difficulty, adopt) => {
  const waiters = sudokuPuzzleWaiters.get(difficulty);
  const index = waiters ? waiters.indexOf(adopt) : -1;
  if (index < 0) return;
  waiters.splice(index, 1);
  if (!waiters.length) sudokuPuzzleWaiters.delete(difficulty);
};

/**
 * Keeps one spare puzzle warm for a difficulty the player is using. Untouched
 * difficulties are never pre-generated, so opening the page costs one puzzle,
 * not six.
 */
const topUpSudokuPuzzlePool = (difficulty) => {
  if (sudokuGeneratorUnavailable) return;
  const pooled = sudokuPuzzlePool.get(difficulty)?.length || 0;
  const waiting = sudokuPuzzleWaiters.get(difficulty)?.length || 0;
  const wanted = SUDOKU_POOL_TARGET + waiting - pooled - sudokuPuzzlesInFlightFor(difficulty);
  for (let request = 0; request < wanted; request += 1) {
    // The first request is what starts the worker, so it is also where a
    // browser that cannot run one is found out. Stop asking the moment that
    // happens rather than pooling spares nobody asked for.
    if (sudokuGeneratorUnavailable) return;
    generateSudokuPuzzle(difficulty, (generated) => {
      const resolvers = sudokuPuzzleWaiters.get(difficulty);
      const resolve = resolvers?.shift();
      if (!resolvers?.length) sudokuPuzzleWaiters.delete(difficulty);
      if (resolve) resolve(generated);
      else returnSudokuPuzzleToPool(difficulty, generated);
    });
  }
};

/**
 * Calls back with a puzzle for `difficulty` — synchronously when one is warm,
 * which is the usual case, and otherwise as soon as the worker delivers.
 */
const withSudokuPuzzle = (difficulty, adopt) => {
  const pool = sudokuPuzzlePool.get(difficulty);
  const pooled = pool?.shift();
  if (pool && !pool.length) sudokuPuzzlePool.delete(difficulty);
  if (pooled) {
    topUpSudokuPuzzlePool(difficulty);
    adopt(pooled);
    return;
  }
  // Generation that cannot run is answered here, in the same tick, rather
  // than by a waiter no refill will ever reach: once the worker is gone the
  // pool stops filling, so a queued request would wait forever.
  if (sudokuGeneratorUnavailable) {
    adopt(staticSudokuPuzzle(difficulty));
    return;
  }
  const waiters = sudokuPuzzleWaiters.get(difficulty) || [];
  waiters.push(adopt);
  sudokuPuzzleWaiters.set(difficulty, waiters);
  topUpSudokuPuzzlePool(difficulty);
};

const serializeSudokuValues = (values = sudokuState.values) =>
  normalizeSudokuValues(values, sudokuState.puzzle)
    .map((value) => value || "0")
    .join("");

/**
 * Writes the engine's puzzle onto the state the grid and the save file read.
 * Every latch the engine owns — the check count, the assistance flag, the
 * accepted Errors warning — comes back through here, so the display can never
 * claim an allowance the rules did not spend.
 */
const projectSudokuGame = () => {
  sudokuState.difficulty = sudokuGame.difficulty;
  sudokuState.puzzle = sudokuGame.puzzle;
  sudokuState.solution = sudokuGame.solution;
  sudokuState.values = Array.from(sudokuGame.values, (digit) =>
    digit === "0" ? "" : digit);
  sudokuState.notes = sudokuGame.notes.slice();
  sudokuState.selectedIndex = sudokuGame.selectedIndex;
  sudokuState.hintMode = sudokuGame.hintMode;
  sudokuState.noteMode = sudokuGame.noteMode;
  sudokuState.mistakes = sudokuGame.mistakes;
  sudokuState.checksUsed = sudokuGame.checksUsed;
  sudokuState.usedHint = sudokuGame.usedHint;
  sudokuState.usedReveal = sudokuGame.usedReveal;
  sudokuState.errorsConfirmed = sudokuGame.errorsConfirmed;
  sudokuState.solved = sudokuGame.solved;
};

/** Redraws only the cells whose value or pencil marks the move actually changed. */
const refreshChangedSudokuCells = (before) => {
  const cells = sudokuCells();
  for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
    if (before.values[index] === sudokuGame.values[index] &&
        before.notes[index] === sudokuGame.notes[index]) {
      continue;
    }
    const cell = cells[index];
    if (!cell) continue;
    refreshSudokuCellDisplay(cell, index);
    syncSudokuCellFeedback(cell, index);
  }
};

const updateSudokuHistoryButtons = () => {
  if (sudokuUndo) sudokuUndo.disabled = !sudokuGame?.undo.length;
  if (sudokuRedo) sudokuRedo.disabled = !sudokuGame?.redo.length;
};

/** One edit costs a few dozen primitive steps; this is generous. */
const SUDOKU_MOVE_WORK = 2048;

/**
 * Plays one move. The engine decides whether it is allowed and applies it, and
 * the recorded input is what a verifier replays, so nothing can reach the board
 * without entering the replay. Returns false when the move was not available —
 * a given, a digit already there, an exhausted allowance.
 */
const applySudokuMove = (action) => {
  if (!sudokuGame || !sudokuRules.canApply(sudokuGame, action)) return false;
  const before = { values: sudokuGame.values, notes: sudokuGame.notes.slice() };
  sudokuRules.transition(sudokuGame, action, createBudget(SUDOKU_MOVE_WORK));
  sudokuAppliedMoves += 1;
  sudokuStats.recordInput(action);
  projectSudokuGame();
  refreshChangedSudokuCells(before);
  return true;
};

/**
 * Brings the engine's idea of the selected cell up to date, immediately before a
 * move needs it. Selecting a cell is not itself a move, so a player who clicks
 * around the grid without typing records nothing; but an undo restores the cell
 * the edit was made in, which means the engine has to know it by then.
 */
const syncSudokuSelection = () => {
  if (!sudokuGame || sudokuGame.selectedIndex === sudokuState.selectedIndex) return;
  applySudokuMove({ op: "select", index: normalizeSudokuSelectedIndex(sudokuState.selectedIndex) });
};

const formatSudokuTime = formatElapsedTime;

const currentSudokuElapsedSeconds = () => {
  if (!sudokuState.timerStartedAt) return sudokuState.elapsedSeconds;
  return (
    sudokuState.elapsedSeconds +
    Math.floor((Date.now() - sudokuState.timerStartedAt) / 1000)
  );
};

const createSudokuSavePayload = () => ({
  version: 3,
  difficulty: sudokuState.difficulty,
  puzzleId: sudokuState.puzzleId,
  puzzle: sudokuState.puzzle,
  solution: sudokuState.solution,
  values: serializeSudokuValues(),
  notes: normalizeSudokuNotesList(sudokuState.notes, sudokuState.puzzle),
  elapsedSeconds: currentSudokuElapsedSeconds(),
  hintMode: sudokuState.hintMode,
  noteMode: sudokuState.noteMode,
  selectedIndex: normalizeSudokuSelectedIndex(sudokuState.selectedIndex),
  usedHint: sudokuState.usedHint,
  usedReveal: sudokuState.usedReveal,
  checksUsed: sudokuState.checksUsed,
  errorsConfirmed: sudokuState.errorsConfirmed,
  solved: sudokuState.solved,
  completionRecorded: sudokuState.completionRecorded,
  // The issued game and the inputs recorded against it, so a puzzle resumed in a
  // later session can still publish a verified result. A save without this block
  // is an ordinary offline puzzle and stays one.
  verified: sudokuStats.exportGame(),
});

const flushSudokuSave = () => {
  // Before the first puzzle is adopted the board is blank scaffolding; saving
  // it would overwrite nothing useful with nothing at all.
  if (!sudokuPuzzleReady) return;
  if (!isHomeActivationReady()) {
    sudokuSaveQueuedForActivation = true;
    runAfterHomeActivation(flushSudokuSave);
    return;
  }
  sudokuSaveQueuedForActivation = false;
  if (sudokuSaveTimerId) {
    clearTimeout(sudokuSaveTimerId);
    sudokuSaveTimerId = null;
  }
  writeJsonStorage(() => localStorage, SUDOKU_STORAGE_KEY, createSudokuSavePayload());
};

const scheduleSudokuSave = () => {
  if (!isHomeActivationReady()) {
    if (!sudokuSaveQueuedForActivation) {
      sudokuSaveQueuedForActivation = true;
      runAfterHomeActivation(scheduleSudokuSave);
    }
    return;
  }
  sudokuSaveQueuedForActivation = false;
  sudokuSaveTimerId = debounceTimer(
    sudokuSaveTimerId,
    flushSudokuSave,
    SUDOKU_SAVE_DEBOUNCE_MS
  );
};

const restoreSudokuSavedState = () => {
  const savedState = readJsonStorage(() => localStorage, SUDOKU_STORAGE_KEY, null);
  if (!savedState || ![1, 2, 3].includes(savedState.version)) return false;

  const difficulty = normalizeSudokuDifficulty(savedState.difficulty);
  const fallbackPuzzle = SUDOKU_PUZZLES[difficulty];
  let puzzle = fallbackPuzzle.puzzle;
  let solution = fallbackPuzzle.solution;
  let puzzleId = fallbackPuzzle.id;

  if (savedState.version >= 2) {
    const savedPuzzle = normalizeSudokuPuzzleString(savedState.puzzle);
    const savedSolution = normalizeSudokuSolutionString(savedState.solution);
    if (!isSudokuSolutionCompatibleWithPuzzle(savedPuzzle, savedSolution)) return false;
    puzzle = savedPuzzle;
    solution = savedSolution;
    puzzleId = String(savedState.puzzleId || "") || createSudokuPuzzleId(difficulty);
  } else if (savedState.puzzle && savedState.puzzle !== fallbackPuzzle.puzzle) {
    return false;
  }

  sudokuState.difficulty = difficulty;
  sudokuState.puzzleId = puzzleId;
  sudokuState.puzzle = puzzle;
  sudokuState.solution = solution;
  sudokuState.mistakes = 0;
  sudokuState.elapsedSeconds = Math.max(0, Math.floor(Number(savedState.elapsedSeconds) || 0));
  sudokuState.timerId = null;
  sudokuState.timerStartedAt = 0;
  sudokuState.playing = false;
  sudokuState.solved = Boolean(savedState.solved);
  sudokuState.completionRecorded = Boolean(
    savedState.completionRecorded || savedState.solved
  );
  if (isSudokuCompletionClaimed(readSudokuCompletionClaims(), puzzleId, puzzle)) {
    sudokuState.completionRecorded = true;
  }
  sudokuState.usedHint = Boolean(savedState.usedHint || savedState.usedReveal);
  sudokuState.usedReveal = Boolean(savedState.usedReveal);
  sudokuState.checksUsed = clampNumber(
    Math.floor(Number(savedState.checksUsed) || 0),
    0,
    SUDOKU_MAX_LEADERBOARD_CHECKS
  );
  sudokuState.errorsConfirmed = Boolean(
    savedState.errorsConfirmed ||
      savedState.hintMode === "errors" ||
      savedState.usedHint ||
      savedState.usedReveal
  );
  sudokuStats.dropSession();
  sudokuState.statsSessionEligible = !sudokuState.completionRecorded;
  sudokuState.hintMode = normalizeSudokuHintMode(savedState.hintMode);
  sudokuState.noteMode = Boolean(savedState.noteMode);
  sudokuState.values = normalizeSudokuValues(savedState.values, puzzle);
  sudokuState.notes = normalizeSudokuNotesList(savedState.notes, puzzle);
  sudokuState.selectedIndex = normalizeSudokuSelectedIndex(savedState.selectedIndex);
  adoptRestoredSudokuGame(savedState);
  return true;
};

/**
 * Lets go of a proof the board on screen never adopted, and persists the save
 * that says so.
 *
 * The board, its modes, its latches and its selection are left exactly as they
 * are: the attempt simply carries on as the ordinary offline puzzle it now is.
 * The recorded replay is never cleared to make this board pass for the one the
 * proof describes, and no new proof is minted to cover it.
 */
const releaseUnadoptedSudokuProof = () => {
  sudokuStats.dropSession();
  scheduleSudokuSave();
};

/**
 * Replaying a restored session can touch every cell once per recorded input.
 */
const SUDOKU_RESTORE_WORK = 2_000_000;

/**
 * Rebuilds the engine state for a restored puzzle, and keeps its verified
 * identity only when the server really will restore that issued game.
 *
 * Restoring is a request, so it settles later: the puzzle is playable from the
 * save immediately, and the issued board is adopted only once the server has
 * agreed, and only while this is still the puzzle on screen. An arbitrary
 * offline save stays completely playable; it simply cannot acquire provenance it
 * never had, which is the whole point of binding a result to an issued board.
 */
const adoptRestoredSudokuGame = (savedState) => {
  const restoredBoard = {
    difficulty: sudokuState.difficulty,
    puzzle: sudokuState.puzzle,
    solution: sudokuState.solution,
    values: sudokuState.values.map((value) => value || "0").join(""),
    notes: sudokuState.notes,
    selectedIndex: sudokuState.selectedIndex,
    hintMode: sudokuState.hintMode,
    noteMode: sudokuState.noteMode,
    errorsConfirmed: sudokuState.errorsConfirmed,
    usedHint: sudokuState.usedHint,
    usedReveal: sudokuState.usedReveal,
    checksUsed: sudokuState.checksUsed,
  };
  sudokuGame = sudokuRules.initial(restoredBoard);
  sudokuAppliedMoves = 0;
  // A save can claim to be finished, and an old one can claim it of a board that
  // plainly is not. The claim is taken only where the grid supports it; the
  // completion latch is kept either way, so a save can never publish twice.
  const outcome = sudokuRules.evaluate(sudokuGame);
  if (sudokuState.solved && outcome.complete && outcome.valid) {
    sudokuGame = sudokuRules.initial({ ...restoredBoard, solved: true });
  }
  projectSudokuGame();

  // A puzzle that has already been recorded cannot publish again, so there is
  // nothing for a restored session to carry.
  if (!sudokuState.statsSessionEligible) return;
  const pending = sudokuStats.restoreGame(savedState.verified);
  if (!pending) return;
  // Logical changes are applied to the board in place, so neither the board
  // object nor the puzzle id moves when a mode is switched or a warning is
  // accepted: the count of applied changes is what sees it. Without it, a reply
  // that arrived after the player turned Notes on replaced their board with one
  // rebuilt from the old replay, because the cells still matched.
  const owned = {
    game: sudokuGame,
    puzzleId: sudokuState.puzzleId,
    appliedMoves: sudokuAppliedMoves,
  };
  const ownsBoard = () =>
    sudokuGame === owned.game && sudokuState.puzzleId === owned.puzzleId;
  Promise.resolve(pending).then((descriptor) => {
    // A new puzzle since the request went out owns the session now, and its proof
    // is not this stale reply's to let go of.
    if (!ownsBoard()) return;
    if (
      sudokuAppliedMoves !== owned.appliedMoves ||
      !adoptIssuedSudokuReplay(descriptor, savedState.verified?.bufferedInputs)
    ) {
      releaseUnadoptedSudokuProof();
    }
  }, () => {
    if (ownsBoard()) releaseUnadoptedSudokuProof();
  });
};

/**
 * Replays the restored session's recorded inputs over the board the server
 * issued, so the puzzle on screen is the one the verifier derives its result
 * from rather than a save that merely resembles it. Anything the server did not
 * agree to restore — a running autosave with no acknowledged pause, an expired
 * session, a board it never issued — leaves the attempt local-only.
 */
const adoptIssuedSudokuReplay = (descriptor, savedReplay) => {
  // The restored session has to be this puzzle's: a board the server issued for
  // some other puzzle is not a proof of this one.
  if (!descriptor || descriptor.initial?.puzzle !== sudokuState.puzzle) return false;
  if (descriptor.initial.solution !== sudokuState.solution) return false;
  let restored;
  try {
    restored = sudokuRules.initial(descriptor.initial);
    const budget = createBudget(SUDOKU_RESTORE_WORK);
    const replay = [...(descriptor.inputs || []), ...(savedReplay || [])];
    replay.forEach((input) => sudokuRules.transition(restored, input, budget));
  } catch (error) {
    return false;
  }
  // The replay has to land on the board the save shows. If it does not, the two
  // are not the same game, and the player's board is what stays: a proof that
  // reproduces something else must not quietly replace what they were playing.
  const saved = sudokuState.values.map((value) => value || "0").join("");
  if (restored.values !== saved) return false;
  if (restored.notes.join("|") !== sudokuState.notes.join("|")) return false;
  // The frontend session key the adapter returned stays on the live state: the
  // board is replaced here, never the object that owns the key.
  sudokuGame = restored;
  sudokuAppliedMoves = 0;
  renderSudoku();
  scheduleSudokuSave();
  return true;
};

const updateSudokuTimeDisplay = () => {
  if (sudokuTime) {
    sudokuTime.textContent = `Time: ${formatSudokuTime(currentSudokuElapsedSeconds())}`;
  }
};

const updateSudokuMistakesDisplay = () => {
  if (sudokuMistakes) sudokuMistakes.textContent = `Mistakes: ${sudokuState.mistakes}`;
};

const updateSudokuLeaderboardChecksDisplay = () => {
  if (!sudokuLeaderboardChecks) return;
  const message =
    `${sudokuState.checksUsed}/${SUDOKU_MAX_LEADERBOARD_CHECKS} ` +
    "allowed checks used to place on leaderboard";
  if (sudokuLeaderboardChecks.textContent !== message) {
    sudokuLeaderboardChecks.textContent = message;
  }
};

const setSudokuStatus = (message) => {
  if (sudokuStatus) sudokuStatus.textContent = message;
  updateSudokuMistakesDisplay();
  updateSudokuTimeDisplay();
  updateSudokuLeaderboardChecksDisplay();
};

const startSudokuTimer = () => {
  if (sudokuState.solved || sudokuState.timerId) return;
  sudokuState.timerStartedAt = Date.now();
  sudokuState.timerId = window.setInterval(
    updateSudokuTimeDisplay,
    SUDOKU_TIMER_INTERVAL_MS
  );
  // Ranked time has to be the time on screen, so the server is told where this
  // clock starts. Until it has acknowledged that, recorded inputs are only
  // buffered and no result can be submitted.
  sudokuStats.resumeGame();
  updateSudokuTimeDisplay();
};

const pauseSudokuTimer = () => {
  if (!sudokuState.timerId) return;
  sudokuState.elapsedSeconds = currentSudokuElapsedSeconds();
  clearInterval(sudokuState.timerId);
  sudokuState.timerId = null;
  sudokuState.timerStartedAt = 0;
  // The same boundary, from the other side: a stopped clock is a pause the
  // server has to acknowledge, or the time it excludes cannot be trusted.
  sudokuStats.pauseGame();
  updateSudokuTimeDisplay();
  scheduleSudokuSave();
};

const resetSudokuTimer = () => {
  if (sudokuState.timerId) clearInterval(sudokuState.timerId);
  sudokuState.elapsedSeconds = 0;
  sudokuState.timerId = null;
  sudokuState.timerStartedAt = 0;
  updateSudokuTimeDisplay();
};

const isSudokuWindowVisible = () => {
  const win = getAppWindow("sudoku");
  return Boolean(
    win &&
      !win.classList.contains("is-hidden") &&
      !win.classList.contains("is-closing")
  );
};

const isSudokuReducedMotion = () => Boolean(sudokuReducedMotionMedia?.matches);

const isSudokuAquariumActive = () =>
  Boolean(
    sudokuAquariumLayer &&
      sudokuState.playing &&
      isSudokuWindowVisible() &&
      isPageActive(document) &&
      !isSudokuReducedMotion()
  );

const setSudokuLoadingProgress = (progress) => {
  sudokuState.loadingProgress = clampNumber(progress, 0, 100);
  const roundedProgress = Math.round(sudokuState.loadingProgress);
  if (sudokuLoadingFill) {
    sudokuLoadingFill.style.setProperty(
      "--sudoku-load-progress",
      `${roundedProgress}%`
    );
  }
  if (sudokuLoadingMeter) {
    sudokuLoadingMeter.setAttribute("aria-valuenow", String(roundedProgress));
  }
};

const clearSudokuLoadingTimer = () => {
  sudokuProgressLoader.cancel();
};

const clearSudokuTransitionTimer = () => {
  if (!sudokuState.transitionTimerId) return;
  clearTimeout(sudokuState.transitionTimerId);
  sudokuState.transitionTimerId = null;
};

const clearSudokuBubbleBursts = () => {
  document
    .querySelectorAll(".sudoku-burst-effect")
    .forEach((element) => element.remove());
};

const clearSudokuPlayBurst = () => {
  if (sudokuApp) sudokuApp.classList.remove("is-sudoku-bursting");
  if (sudokuPlay) sudokuPlay.classList.remove("animate");
  clearSudokuBubbleBursts();
};

const triggerSudokuBubbleBurst = (target, variant) => {
  if (!target) return;
  const className = `sudoku-burst-effect--${variant}`;
  target.querySelectorAll(`.${className}`).forEach((element) => element.remove());
  const effect = document.createElement("span");
  effect.className = `sudoku-burst-effect ${className}`;
  effect.setAttribute("aria-hidden", "true");
  target.append(effect);
  window.setTimeout(() => effect.remove(), SUDOKU_PLAY_BURST_MS + 120);
};

const triggerSudokuCheckBubbleBurst = () => {
  triggerSudokuBubbleBurst(sudokuCheck, "button");
};

const triggerSudokuFullBubbleBurst = () => {
  triggerSudokuBubbleBurst(sudokuAeroPanel || sudokuApp, "full");
};

const sudokuRandomBetween = (min, max) => min + Math.random() * (max - min);

const sudokuRandomInt = (min, max) =>
  Math.floor(sudokuRandomBetween(min, max + 1));

const sudokuPick = (items) => items[Math.floor(Math.random() * items.length)];

const sampleSudokuFishDepth = () => {
  const roll = Math.random();
  if (roll < 0.7) return "far";
  if (roll < 0.93) return "mid";
  return "near";
};

const clearSudokuAquariumTimers = () => {
  if (sudokuFishTimerId) {
    clearTimeout(sudokuFishTimerId);
    sudokuFishTimerId = null;
  }
  if (sudokuBubbleTimerId) {
    clearTimeout(sudokuBubbleTimerId);
    sudokuBubbleTimerId = null;
  }
};

const clearSudokuAquarium = () => {
  clearSudokuAquariumTimers();
  if (!sudokuAquariumLayer) return;
  sudokuAquariumLayer
    .querySelectorAll(".sudoku-fish, .sudoku-bubble-cluster")
    .forEach((element) => element.remove());
};

const createSudokuFishElement = ({
  depth,
  type,
  top,
  size,
  opacity,
  blur,
  saturate,
  duration,
  delay,
  direction,
}) => {
  const fish = document.createElement("span");
  fish.className = `sudoku-fish sudoku-fish--${type} sudoku-fish--${depth}`;
  fish.setAttribute("aria-hidden", "true");
  fish.style.setProperty("--fish-top", `${top.toFixed(1)}%`);
  fish.style.setProperty("--fish-size", `${Math.round(size)}px`);
  fish.style.setProperty("--fish-opacity", opacity.toFixed(2));
  fish.style.setProperty("--fish-blur", `${blur.toFixed(2)}px`);
  fish.style.setProperty("--fish-saturate", saturate.toFixed(2));
  fish.style.setProperty("--fish-duration", `${Math.round(duration)}ms`);
  fish.style.setProperty("--fish-delay", `${Math.round(delay)}ms`);
  fish.style.setProperty("--fish-start-left", direction === 1 ? "-22%" : "122%");
  fish.style.setProperty("--fish-end-left", direction === 1 ? "122%" : "-22%");
  fish.style.setProperty("--fish-dir", String(direction));
  fish.style.setProperty("--fish-bob", `${sudokuRandomBetween(2, 8).toFixed(1)}px`);

  const body = document.createElement("span");
  body.className = "sudoku-fish-body";
  fish.append(body);
  fish.addEventListener("animationend", () => fish.remove(), { once: true });
  return fish;
};

const spawnSudokuFishPass = () => {
  if (!isSudokuAquariumActive()) return;
  const liveFishCount = sudokuAquariumLayer.querySelectorAll(".sudoku-fish").length;
  const availableSlots = SUDOKU_MAX_FISH - liveFishCount;
  if (availableSlots <= 0) return;

  const depth = sampleSudokuFishDepth();
  const config = SUDOKU_FISH_DEPTHS[depth];
  const isSchool = Math.random() < config.schoolChance;
  const count = Math.min(
    availableSlots,
    isSchool ? sudokuRandomInt(config.school[0], config.school[1]) : 1
  );
  const baseType = sudokuPick(SUDOKU_FISH_TYPES);
  const baseTop = sudokuRandomBetween(config.top[0], config.top[1]);
  const baseSize = sudokuRandomBetween(config.size[0], config.size[1]);
  const direction = Math.random() < 0.5 ? 1 : -1;

  for (let index = 0; index < count; index += 1) {
    const topOffset =
      count === 1
        ? 0
        : (index - (count - 1) / 2) * sudokuRandomBetween(3, 7) +
          sudokuRandomBetween(-2, 2);
    const type = Math.random() < 0.75 ? baseType : sudokuPick(SUDOKU_FISH_TYPES);
    const fish = createSudokuFishElement({
      depth,
      type,
      top: clampNumber(baseTop + topOffset, 8, 90),
      size: baseSize * sudokuRandomBetween(0.84, 1.26),
      opacity: sudokuRandomBetween(config.opacity[0], config.opacity[1]),
      blur: sudokuRandomBetween(config.blur[0], config.blur[1]),
      saturate: sudokuRandomBetween(config.saturate[0], config.saturate[1]),
      duration: sudokuRandomBetween(config.duration[0], config.duration[1]),
      delay: index * sudokuRandomBetween(120, 420),
      direction,
    });
    sudokuAquariumLayer.append(fish);
  }
};

const spawnSudokuBubbleCluster = () => {
  if (!isSudokuAquariumActive()) return;
  if (
    sudokuAquariumLayer.querySelectorAll(".sudoku-bubble-cluster").length >=
    SUDOKU_MAX_BUBBLE_CLUSTERS
  ) {
    return;
  }

  const cluster = document.createElement("span");
  const bubbleCount = sudokuRandomInt(4, 10);
  cluster.className = "sudoku-bubble-cluster";
  cluster.setAttribute("aria-hidden", "true");
  cluster.style.setProperty("--bubble-left", `${sudokuRandomBetween(12, 88).toFixed(1)}%`);
  cluster.style.setProperty("--bubble-width", `${Math.round(sudokuRandomBetween(48, 110))}px`);
  cluster.style.setProperty("--bubble-duration", `${Math.round(sudokuRandomBetween(9000, 14000))}ms`);
  cluster.style.setProperty("--bubble-opacity", sudokuRandomBetween(0.56, 0.84).toFixed(2));
  cluster.style.setProperty("--bubble-drift", `${sudokuRandomBetween(-30, 30).toFixed(1)}px`);

  for (let index = 0; index < bubbleCount; index += 1) {
    const bubble = document.createElement("span");
    bubble.className = "sudoku-bubble";
    bubble.style.setProperty("--bubble-size", `${Math.round(sudokuRandomBetween(7, 22))}px`);
    bubble.style.setProperty("--bubble-offset", `${sudokuRandomBetween(4, 96).toFixed(1)}%`);
    bubble.style.setProperty("--bubble-bottom", `${Math.round(sudokuRandomBetween(0, 66))}px`);
    bubble.style.setProperty("--bubble-wobble", `${Math.round(sudokuRandomBetween(1200, 2600))}ms`);
    cluster.append(bubble);
  }

  cluster.addEventListener("animationend", () => cluster.remove(), { once: true });
  sudokuAquariumLayer.append(cluster);
};

const scheduleSudokuFish = (delay = 0) => {
  if (!isSudokuAquariumActive() || sudokuFishTimerId) return;
  sudokuFishTimerId = window.setTimeout(() => {
    sudokuFishTimerId = null;
    if (!isSudokuAquariumActive()) return;
    spawnSudokuFishPass();
    scheduleSudokuFish(sudokuRandomBetween(1600, 4800));
  }, delay);
};

const scheduleSudokuBubbles = (delay = 0) => {
  if (!isSudokuAquariumActive() || sudokuBubbleTimerId) return;
  sudokuBubbleTimerId = window.setTimeout(() => {
    sudokuBubbleTimerId = null;
    if (!isSudokuAquariumActive()) return;
    spawnSudokuBubbleCluster();
    scheduleSudokuBubbles(sudokuRandomBetween(2500, 7500));
  }, delay);
};

const startSudokuAquarium = () => {
  if (!isSudokuAquariumActive()) return;
  scheduleSudokuFish(sudokuRandomBetween(300, 1400));
  scheduleSudokuBubbles(sudokuRandomBetween(1400, 3200));
};

const syncSudokuAquariumActivity = () => {
  if (isSudokuAquariumActive()) {
    startSudokuAquarium();
  } else {
    clearSudokuAquarium();
  }
};

/**
 * Pause hides the board rather than covering it: every value and note goes
 * invisible and the board and control panel drop to a thin wash so the
 * aquarium reads through them. The two regions also go `inert`, so a paused
 * board cannot be clicked, tabbed into, or typed on, and the single centred
 * play button is the only way back. The aquarium keeps swimming, because
 * `sudokuState.playing` stays true: pausing stops the clock, not the window.
 */
const setSudokuPaused = (paused) => {
  const nextPaused = Boolean(paused) && sudokuState.playing && !sudokuState.solved;
  if (nextPaused === sudokuPaused) return;
  sudokuPaused = nextPaused;
  sudokuApp?.classList.toggle("is-sudoku-paused", sudokuPaused);
  if (sudokuGridFrame) sudokuGridFrame.inert = sudokuPaused;
  if (sudokuControlPanel) sudokuControlPanel.inert = sudokuPaused;
  if (sudokuPause) sudokuPause.setAttribute("aria-pressed", String(sudokuPaused));
  if (sudokuPauseOverlay) {
    sudokuPauseOverlay.setAttribute("aria-hidden", String(!sudokuPaused));
  }
  // The clock's own start and stop are what the server is told about, so pausing
  // and resuming carry the boundary through `pauseSudokuTimer` and
  // `startSudokuTimer` rather than reporting it twice.
  if (sudokuPaused) {
    sudokuStatusBeforePause = sudokuStatus?.textContent || "";
    pauseSudokuTimer();
    setSudokuStatus("Paused");
    if (isSudokuWindowVisible()) sudokuResume?.focus();
    return;
  }
  setSudokuStatus(sudokuStatusBeforePause || (sudokuState.solved ? "Solved" : "Ready"));
  sudokuStatusBeforePause = "";
  if (!isSudokuWindowVisible() || !sudokuState.playing) return;
  startSudokuTimer();
  // Focus goes back to the board the player was on, not to the button that
  // just disappeared from under the pointer.
  (selectedSudokuCell() || sudokuPause)?.focus();
};

// A hidden tab pauses the game as well as the aquarium; coming back does not
// resume it, so time never runs on a board nobody is looking at.
const handleSudokuVisibilityChange = () => {
  if (document.hidden) setSudokuPaused(true);
  syncSudokuAquariumActivity();
};

const clampSudokuWindowIntoViewport = () => {
  if (!sudokuWindow || !isSudokuWindowVisible()) return;
  clampWindowFullyIntoViewport(sudokuWindow, { padding: 12 });
};

const scheduleSudokuWindowViewportClamp = () => {
  afterFrames(1, () => {
    clampSudokuWindowIntoViewport();
    afterFrames(1, clampSudokuWindowIntoViewport);
  });
};

const setSudokuBootState = (state) => {
  if (!sudokuApp) return;
  sudokuApp.classList.toggle("is-sudoku-loading", state === "loading");
  sudokuApp.classList.toggle("is-sudoku-ready", state === "ready");
  sudokuApp.classList.toggle("is-sudoku-bursting", state === "bursting");
  sudokuApp.classList.toggle("is-sudoku-playing", state === "playing");
  if (sudokuWindow) {
    sudokuWindow.classList.toggle("is-sudoku-playing", state === "playing");
  }
  if (sudokuPlay) sudokuPlay.disabled = state !== "ready";
  if (sudokuLoadingScreen) {
    sudokuLoadingScreen.setAttribute("aria-hidden", String(state === "playing"));
  }
  if (state === "playing") {
    scheduleSudokuWindowViewportClamp();
    startSudokuAquarium();
  } else {
    clearSudokuAquarium();
  }
};

const finishSudokuLoadingSequence = () => {
  sudokuState.loadingStartedAt = 0;
  setSudokuBootState("ready");
  requestAnimationFrame(() => {
    if (sudokuPlay && isSudokuWindowVisible()) sudokuPlay.focus();
  });
};

// The meter runs for at least its floor, then holds at 98 until a real puzzle
// exists. Play is offered on readiness, never on a timer alone.
const sudokuProgressLoader = createProgressLoader({
  progressCap: 98,
  isReady: () => sudokuPuzzleReady,
  shouldContinue: () => isSudokuWindowVisible() && !sudokuState.playing,
  nextProgress: ({ elapsedMs, durationMs, progress }) => {
    const targetProgress = (elapsedMs / durationMs) * 100;
    const jump = 3 + Math.random() * 14;
    const catchup = Math.max(0, targetProgress - progress) * 0.58;
    return Math.max(progress + 1, progress + jump + catchup);
  },
  nextDelay: ({ elapsedMs, durationMs, waitingForReady }) =>
    waitingForReady
      ? SUDOKU_LOAD_READY_POLL_MS
      : Math.min(90 + Math.random() * 210, Math.max(0, durationMs - elapsedMs)),
  onProgress: setSudokuLoadingProgress,
  onReady: finishSudokuLoadingSequence,
  onTimerChange: (timerId) => {
    sudokuState.loadingTimerId = timerId;
  },
});

const startSudokuBootSequence = () => {
  if (!sudokuApp) return;
  pauseSudokuTimer();
  hideSudokuErrorsPrompt({ restoreFocus: false });
  hideSudokuSolvePopup();
  clearSudokuTransitionTimer();
  clearSudokuPlayBurst();
  sudokuState.playing = false;
  setSudokuPaused(false);
  sudokuState.loadingDuration = SUDOKU_LOAD_MIN_MS;
  // Opening Sudoku is what starts the generator: the first puzzle if there is
  // none, and otherwise a spare so the next New Game is instant.
  if (sudokuPuzzleReady) topUpSudokuPuzzlePool(sudokuState.difficulty);
  else loadSudokuDifficulty(sudokuState.difficulty);
  setSudokuBootState("loading");
  const loading = sudokuProgressLoader.start({
    duration: sudokuState.loadingDuration,
    initialDelay: 120 + Math.random() * 180,
  });
  sudokuState.loadingStartedAt = loading.startedAt;
};

const clearSudokuBootSequence = ({ resetView = true } = {}) => {
  clearSudokuLoadingTimer();
  clearSudokuTransitionTimer();
  clearSudokuPlayBurst();
  clearSudokuAquarium();
  hideSudokuErrorsPrompt({ restoreFocus: false });
  hideSudokuSolvePopup();
  hideSudokuNoteTooltip();
  sudokuState.playing = false;
  setSudokuPaused(false);
  sudokuState.loadingStartedAt = 0;
  sudokuState.loadingDuration = 0;
  setSudokuLoadingProgress(0);
  if (resetView) setSudokuBootState("");
  scheduleSudokuSave();
};

const selectedSudokuCell = () => {
  const index = normalizeSudokuSelectedIndex(sudokuState.selectedIndex);
  return index >= 0 ? sudokuCells()[index] || null : null;
};

const focusSudokuCell = (index) => {
  const selectedIndex = normalizeSudokuSelectedIndex(index);
  const cell = selectedIndex >= 0 ? sudokuCells()[selectedIndex] : null;
  if (!cell) return;
  selectSudokuCell(cell);
  cell.focus();
};

const focusNextSudokuEditableCell = (index) => {
  const cells = sudokuCells();
  if (!cells.length) return;
  for (let offset = 1; offset <= SUDOKU_CELL_COUNT; offset += 1) {
    const nextIndex = (index + offset) % SUDOKU_CELL_COUNT;
    const nextCell = cells[nextIndex];
    if (nextCell && !isSudokuCellReadOnly(nextCell)) {
      focusSudokuCell(nextIndex);
      return;
    }
  }
};

const revealSudokuGameFromBoot = () => {
  clearSudokuTransitionTimer();
  clearSudokuPlayBurst();
  clearSudokuLoadingTimer();
  if (!isSudokuWindowVisible()) return;
  sudokuState.playing = true;
  setSudokuLoadingProgress(100);
  setSudokuBootState("playing");
  setSudokuStatus(sudokuState.solved ? "Solved" : "Ready");
  startSudokuTimer();
  const firstOpenCell =
    selectedSudokuCell() || sudokuCells().find((cell) => !cell.readOnly);
  requestAnimationFrame(() => {
    if (firstOpenCell) firstOpenCell.focus();
  });
  scheduleSudokuSave();
};

const startSudokuGameFromBoot = () => {
  if (sudokuState.transitionTimerId) return;
  clearSudokuTransitionTimer();
  setSudokuBootState("bursting");
  if (sudokuPlay) {
    sudokuPlay.classList.remove("animate");
    void sudokuPlay.offsetWidth;
    sudokuPlay.classList.add("animate");
  }

  let finished = false;
  const finishTransition = () => {
    if (finished) return;
    finished = true;
    revealSudokuGameFromBoot();
  };

  sudokuState.transitionTimerId = window.setTimeout(
    finishTransition,
    SUDOKU_PLAY_BURST_MS
  );
};

const updateSudokuDifficultyButtons = () => {
  if (sudokuApp) sudokuApp.dataset.sudokuDifficulty = sudokuState.difficulty;
  sudokuDifficultyButtons.forEach((button) => {
    const isSelected = button.dataset.sudokuDifficulty === sudokuState.difficulty;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const isSudokuCellReadOnly = (cell) => Boolean(cell?.readOnly);

const getSudokuCellValue = (cell) => {
  const index = Number(cell?.dataset.sudokuIndex);
  if (Number.isInteger(index) && sudokuState.values) {
    return sudokuState.values[index] || "";
  }
  return (cell?.value || "").slice(0, 1);
};

const getSudokuCellNotes = (index) => sudokuState.notes?.[index] || "";

const updateSudokuCellAriaLabel = (cell, index) => {
  const row = Math.floor(index / 9) + 1;
  const column = (index % 9) + 1;
  const value = getSudokuCellValue(cell);
  const notes = getSudokuCellNotes(index);
  const valueText = value ? `Value ${value}` : "Empty";
  const noteText = !value && notes ? `Notes ${notes.split("").join(", ")}` : "No notes";
  const conflictText = cell.classList.contains("is-conflict") ? " Conflict." : "";
  cell.setAttribute(
    "aria-label",
    `Row ${row}, column ${column}. ${valueText}. ${noteText}.${conflictText}`
  );
};

const renderSudokuCellNotes = (cell, index) => {
  if (!cell) return;
  const notes = getSudokuCellNotes(index);
  const noteDigits =
    cell._sudokuNoteDigits ||
    Array.from(cell.querySelectorAll(".sudoku-note-digit"));
  noteDigits.forEach((note, digitIndex) => {
    const digit = String(digitIndex + 1);
    note.textContent = notes.includes(digit) ? digit : "";
  });
};

const refreshSudokuCellDisplay = (cell, index) => {
  if (!cell) return;
  const value = getSudokuCellValue(cell);
  const valueEl = cell._sudokuValueEl || cell.querySelector(".sudoku-cell-value");
  if (valueEl) valueEl.textContent = value;
  renderSudokuCellNotes(cell, index);
  cell.value = value;
  cell.dataset.sudokuValue = value;
  cell.classList.toggle("has-value", Boolean(value));
  cell.classList.toggle("has-notes", !value && Boolean(getSudokuCellNotes(index)));
  updateSudokuCellAriaLabel(cell, index);
};

const setSudokuCellValue = (cell, index, value) => {
  if (!sudokuState.values) sudokuState.values = createSudokuEmptyValues();
  const givenValue = String(sudokuState.puzzle || "")[index] || "";
  const digit = SUDOKU_DIGITS.includes(givenValue)
    ? givenValue
    : normalizeSudokuDigit(value);
  sudokuState.values[index] = digit;
  if (cell) refreshSudokuCellDisplay(cell, index);
};

const setSudokuCellNotes = (cell, index, notes) => {
  if (!sudokuState.notes) sudokuState.notes = createSudokuEmptyNotes();
  sudokuState.notes[index] = isSudokuGivenAt(sudokuState.puzzle, index)
    ? ""
    : normalizeSudokuNotes(notes);
  refreshSudokuCellDisplay(cell, index);
};

const updateSudokuNoteToggle = () => {
  if (!sudokuNoteToggle) return;
  sudokuNoteToggle.classList.toggle("is-selected", sudokuState.noteMode);
  sudokuNoteToggle.setAttribute("aria-pressed", String(sudokuState.noteMode));
};

// Counts in place rather than through normalizeSudokuValues: this runs on
// every keystroke and the normalized copy was thrown away immediately.
const countSudokuDigitPlacements = () => {
  const counts = Object.fromEntries(SUDOKU_DIGITS.split("").map((digit) => [digit, 0]));
  const puzzle = String(sudokuState.puzzle || "");
  const values = sudokuState.values;
  for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
    const value = isSudokuGivenAt(puzzle, index)
      ? puzzle[index]
      : normalizeSudokuDigit(values?.[index]);
    if (value) counts[value] += 1;
  }
  return counts;
};

// A digit placed in all nine rows has no legal cell left, so its keypad
// button greys out. Keyboard entry stays open so a wrong ninth placement can
// still be overwritten.
const isSudokuDigitExhausted = (digit, counts = countSudokuDigitPlacements()) =>
  SUDOKU_DIGITS.includes(digit) && counts[digit] >= SUDOKU_ROW_COUNT;

// Both refreshes run on every keystroke. Each keeps the state it last wrote
// so an unchanged cell or button is skipped outright, instead of re-toggling
// three class tokens across all 81 cells and every keypad button. Nothing
// else writes these classes, and renderSudoku drops the caches with the
// cells it replaces.
const SUDOKU_STATE_EXHAUSTED = 1;

const SUDOKU_STATE_SELECTED = 2;

const SUDOKU_STATE_AXIS = 4;

const SUDOKU_STATE_SAME_VALUE = 8;

const SUDOKU_STATE_CONFLICT = 16;

// The remaining count rides above the flags in the same keypad state word.
const SUDOKU_STATE_REMAINING_SHIFT = 5;

const SUDOKU_STATE_UNWRITTEN = -1;

let sudokuHighlightCache = { elements: null, states: [] };

let sudokuKeypadCache = { elements: null, states: [] };

/**
 * A cache is only valid for the exact element list it was written against.
 * renderSudoku builds a fresh cell array, so keying on identity retires the
 * stale states with the cells they described, with nothing to remember to
 * call.
 */
const resolveSudokuStateCache = (cache, elements) =>
  cache.elements === elements
    ? cache
    : { elements, states: new Array(elements.length).fill(SUDOKU_STATE_UNWRITTEN) };

/**
 * Shows how many placements a digit still has, so the keypad reports the
 * whole count rather than only the greyed state at nine. The badge is
 * decorative; the button carries the same fact in its accessible name, which
 * keeps the visible digit at the front of the label.
 */
const updateSudokuRemainingBadge = (button, digit, remaining) => {
  const badge =
    button._sudokuRemainingBadge ||
    button.querySelector(".sudoku-number-remaining");
  if (!badge) return;
  button._sudokuRemainingBadge = badge;
  badge.textContent = remaining > 0 ? String(remaining) : "";
  button.setAttribute(
    "aria-label",
    remaining > 0 ? `${digit}, ${remaining} left` : `${digit}, none left`
  );
};

const updateSudokuNumberButtons = () => {
  const cell = selectedSudokuCell();
  const selectedIndex = cell ? Number(cell.dataset.sudokuIndex) : -1;
  const selectedValue = cell && !isSudokuCellReadOnly(cell) ? getSudokuCellValue(cell) : "";
  const selectedNotes =
    cell && !isSudokuCellReadOnly(cell) && Number.isInteger(selectedIndex)
      ? getSudokuCellNotes(selectedIndex)
      : "";
  const digitCounts = countSudokuDigitPlacements();
  sudokuKeypadCache = resolveSudokuStateCache(sudokuKeypadCache, sudokuNumberButtons);
  sudokuNumberButtons.forEach((button, buttonIndex) => {
    const value = button.dataset.sudokuNumber;
    const isDigit = SUDOKU_DIGITS.includes(value);
    const remaining = isDigit ? SUDOKU_ROW_COUNT - digitCounts[value] : 0;
    const isExhausted = isSudokuDigitExhausted(value, digitCounts);
    const isSelected = Boolean(
      (sudokuState.noteMode &&
        !selectedValue &&
        SUDOKU_DIGITS.includes(value) &&
        selectedNotes.includes(value)) ||
        (!sudokuState.noteMode && value === selectedValue) ||
        (value === "clear" &&
          cell &&
          !isSudokuCellReadOnly(cell) &&
          !selectedValue &&
          !selectedNotes)
    );
    const state =
      (isExhausted ? SUDOKU_STATE_EXHAUSTED : 0) |
      (isSelected ? SUDOKU_STATE_SELECTED : 0) |
      (remaining << SUDOKU_STATE_REMAINING_SHIFT);
    if (state === sudokuKeypadCache.states[buttonIndex]) return;
    sudokuKeypadCache.states[buttonIndex] = state;
    button.classList.toggle("is-exhausted", isExhausted);
    button.disabled = isExhausted;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    if (isDigit) updateSudokuRemainingBadge(button, value, remaining);
  });
  updateSudokuNoteToggle();
};

const updateSudokuHintButtons = () => {
  sudokuHintButtons.forEach((button) => {
    const mode = button.dataset.sudokuHint;
    const isSelected = mode === sudokuState.hintMode;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const clearSudokuHighlights = () => {
  sudokuCells().forEach((cell) => cell.classList.remove("is-invalid"));
};

const clearSudokuSolvedWave = () => {
  sudokuCells().forEach((cell) => {
    cell.classList.remove("is-solved-wave");
    cell.style.removeProperty("--sudoku-solve-delay");
  });
};

const hideSudokuErrorsPrompt = ({ restoreFocus = true } = {}) => {
  if (!sudokuErrorsPrompt?.open) return;
  sudokuErrorsPrompt.close();
  if (restoreFocus) {
    requestAnimationFrame(() => sudokuErrorsHint?.focus());
  }
};

const showSudokuErrorsPrompt = () => {
  if (!sudokuErrorsPrompt || sudokuErrorsPrompt.open) return;
  sudokuErrorsPrompt.showModal();
  requestAnimationFrame(() => sudokuErrorsCancel?.focus());
};

const trapSudokuErrorsPromptFocus = (event) => {
  if (event.key !== "Tab" || !sudokuErrorsPrompt?.open) return;
  const firstControl = sudokuErrorsCancel;
  const lastControl = sudokuErrorsConfirm;
  if (!firstControl || !lastControl) return;
  if (event.shiftKey && document.activeElement === firstControl) {
    event.preventDefault();
    lastControl.focus();
  } else if (!event.shiftKey && document.activeElement === lastControl) {
    event.preventDefault();
    firstControl.focus();
  }
};

const isSudokuSolvePopupVisible = () =>
  Boolean(sudokuSolvePopup?.classList.contains("is-visible")) &&
  sudokuSolvePopup.getAttribute("aria-hidden") === "false";

// The solved dialog and the Errors prompt own the keyboard while they are
// open. Every Sudoku key path consults this, so a keypress on the focused OK
// button cannot edit a finished board or rewind it through undo.
const isSudokuModalOpen = () =>
  Boolean(sudokuErrorsPrompt?.open) || isSudokuSolvePopupVisible();

// Pause locks the same paths: a paused board hides its values, so a keypress
// must not edit or rewind what the player cannot see.
const isSudokuBoardLocked = () => isSudokuModalOpen() || sudokuPaused;

const hideSudokuSolvePopup = () => {
  if (!sudokuSolvePopup) return;
  sudokuSolvePopup.classList.remove("is-visible");
  sudokuSolvePopup.setAttribute("aria-hidden", "true");
  resumeGameStatsAuthenticationAfterCompletion();
};

const showSudokuSolvePopup = () => {
  if (!sudokuSolvePopup || !sudokuSolveMessage) return;
  sudokuSolveMessage.textContent = sudokuState.usedHint || sudokuState.usedReveal
    ? "Good job! Try not to use hints next time."
    : "Good job!";
  sudokuSolvePopup.classList.add("is-visible");
  sudokuSolvePopup.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    if (sudokuSolveOk) sudokuSolveOk.focus();
  });
};

// A full but unsolved board can only be resolved by Check, so the button glows
// gold and replays the sunken-then-raised press. The flag holds the current
// state so a later board update cannot restart the press mid-glow.
let sudokuFullBoardPromptActive = false;

const refreshSudokuFullBoardPrompt = () => {
  if (!sudokuCheck) return;
  const values = sudokuState.values;
  const isBoardFull =
    !sudokuState.solved &&
    Array.isArray(values) &&
    values.length === SUDOKU_CELL_COUNT &&
    values.every(Boolean);
  if (isBoardFull === sudokuFullBoardPromptActive) return;
  sudokuFullBoardPromptActive = isBoardFull;
  // Adding the class is what starts the press, so every re-entry replays it.
  sudokuCheck.classList.toggle("is-board-full", isBoardFull);
};

// Marks the selected cell, its row and column, and every other cell holding
// the selected value. Runs on selection changes and after any value change.
const updateSudokuBoardHighlights = () => {
  const cells = sudokuCells();
  const selectedIndex = normalizeSudokuSelectedIndex(sudokuState.selectedIndex);
  const hasSelection = selectedIndex >= 0 && selectedIndex < cells.length;
  const selectedRow = hasSelection ? Math.floor(selectedIndex / 9) : -1;
  const selectedColumn = hasSelection ? selectedIndex % 9 : -1;
  const selectedValue = hasSelection ? sudokuState.values?.[selectedIndex] || "" : "";
  // Notes matching the selected value light up through one grid attribute,
  // so the 81 cells' note slots cost nothing to keep in step.
  if (sudokuGrid) {
    if (selectedValue) sudokuGrid.dataset.sudokuNoteHighlight = selectedValue;
    else delete sudokuGrid.dataset.sudokuNoteHighlight;
  }
  sudokuHighlightCache = resolveSudokuStateCache(sudokuHighlightCache, cells);

  for (let index = 0; index < cells.length; index += 1) {
    const isSelected = index === selectedIndex;
    const isAxisHighlight =
      hasSelection &&
      (Math.floor(index / 9) === selectedRow || index % 9 === selectedColumn);
    const isSameValue =
      Boolean(selectedValue) &&
      !isSelected &&
      (sudokuState.values?.[index] || "") === selectedValue;
    const state =
      (isSelected ? SUDOKU_STATE_SELECTED : 0) |
      (isAxisHighlight ? SUDOKU_STATE_AXIS : 0) |
      (isSameValue ? SUDOKU_STATE_SAME_VALUE : 0);
    if (state === sudokuHighlightCache.states[index]) continue;
    sudokuHighlightCache.states[index] = state;
    const { classList } = cells[index];
    classList.toggle("is-selected", isSelected);
    classList.toggle("is-axis-highlight", isAxisHighlight);
    classList.toggle("is-same-value", isSameValue);
  }
  refreshSudokuFullBoardPrompt();
};

const selectSudokuCell = (selectedCell) => {
  const selectedIndex = normalizeSudokuSelectedIndex(selectedCell?.dataset.sudokuIndex);
  sudokuState.selectedIndex = selectedIndex < sudokuCells().length ? selectedIndex : -1;
  updateSudokuBoardHighlights();
  updateSudokuNumberButtons();
  scheduleSudokuSave();
};

const syncSudokuCellFeedback = (input) => {
  input.classList.remove("is-invalid");
};

const refreshAllSudokuCells = () => {
  sudokuCells().forEach((cell, index) => {
    refreshSudokuCellDisplay(cell, index);
    syncSudokuCellFeedback(cell, index);
  });
};

const validateSudokuBoard = ({ mark = false } = {}) => {
  const cells = sudokuCells();
  const outcome = sudokuGame
    ? sudokuRules.evaluate(sudokuGame)
    : { complete: false, mistakes: 0, valid: true, wrong: [] };
  const mistakeIndexes = new Set(outcome.wrong);

  if (mark) {
    cells.forEach((cell, index) => {
      const isInvalid = mistakeIndexes.has(index);
      cell.classList.remove("is-invalid");
      if (isInvalid) {
        void cell.offsetWidth;
        cell.classList.add("is-invalid");
      }
    });
  }

  return {
    complete: outcome.complete,
    mistakes: outcome.mistakes,
    valid: outcome.valid,
  };
};

/**
 * Every index holding a value that repeats inside its own row, column, or box,
 * givens included. The engine computes it from the board and nothing else: it
 * never consults the solution, so a wrong value that shares no unit with another
 * is left unmarked, and a marked pair says only that both cannot stand, never
 * which of them is wrong.
 */
const findSudokuConflictIndexes = () =>
  new Set(sudokuGame ? sudokuRules.conflictIndexes(sudokuGame) : []);

let sudokuConflictCache = { elements: null, states: [] };

// Diffed like the highlight pass: this runs on every keystroke too.
const refreshSudokuConflictMarks = () => {
  const cells = sudokuCells();
  sudokuConflictCache = resolveSudokuStateCache(sudokuConflictCache, cells);
  const conflicts =
    sudokuState.hintMode === "conflicts" ? findSudokuConflictIndexes() : null;
  for (let index = 0; index < cells.length; index += 1) {
    const state = conflicts?.has(index) ? SUDOKU_STATE_CONFLICT : 0;
    if (state === sudokuConflictCache.states[index]) continue;
    sudokuConflictCache.states[index] = state;
    cells[index].classList.toggle("is-conflict", state === SUDOKU_STATE_CONFLICT);
    updateSudokuCellAriaLabel(cells[index], index);
  }
};

/**
 * Paints the current hint mode. The engine already decided what the mode means —
 * including whether marking a wrong value tripped the irreversible assistance
 * latch — so this reads those decisions and never makes them.
 */
const refreshSudokuHintFeedback = () => {
  refreshSudokuConflictMarks();
  if (sudokuState.hintMode !== "errors") {
    clearSudokuHighlights();
    updateSudokuMistakesDisplay();
    return validateSudokuBoard();
  }
  const result = validateSudokuBoard({ mark: true });
  updateSudokuMistakesDisplay();
  return result;
};

/** Shows the board the engine restored, after an undo or a redo. */
const showRestoredSudokuBoard = () => {
  hideSudokuSolvePopup();
  clearSudokuSolvedWave();
  refreshAllSudokuCells();
  refreshSudokuHintFeedback();
  updateSudokuBoardHighlights();
  updateSudokuNumberButtons();
  updateSudokuHistoryButtons();
  setSudokuStatus("Ready");
  scheduleSudokuSave();
  const selectedCell = selectedSudokuCell();
  if (selectedCell && sudokuState.playing) selectedCell.focus();
};

const undoSudokuMove = () => {
  if (applySudokuMove({ op: "undo" })) showRestoredSudokuBoard();
};

const redoSudokuMove = () => {
  if (applySudokuMove({ op: "redo" })) showRestoredSudokuBoard();
};

/**
 * The shared tail of every edit. The engine has already applied the move and
 * retired the pencil marks the new digit rules out — one undo puts the value and
 * all of them back together — so this is the board reacting to that.
 */
const afterSudokuEdit = () => {
  hideSudokuSolvePopup();
  clearSudokuSolvedWave();
  if (sudokuState.playing) startSudokuTimer();
  refreshSudokuHintFeedback();
  updateSudokuBoardHighlights();
  updateSudokuNumberButtons();
  updateSudokuHistoryButtons();
  setSudokuStatus("Ready");
  scheduleSudokuSave();
};

const updateSudokuCellValue = (
  input,
  index,
  value,
  { clearEmptyNotes = false, autoAdvance = false } = {}
) => {
  if (!input || isSudokuCellReadOnly(input)) return;
  const digit = sudokuDigitInput(value);
  // A value that is neither one digit nor a clear is refused outright, rather
  // than trimmed into one or mistaken for the other.
  if (digit === null) return;
  // Clearing is its own move: on an empty cell the keypad wipes its pencil marks
  // instead, which is why only that path asks for it.
  if (!digit && !clearEmptyNotes && !getSudokuCellValue(input)) return;
  syncSudokuSelection();
  const applied = digit
    ? applySudokuMove({ op: "setValue", index, value: digit })
    : applySudokuMove({ op: "clear", index });
  if (!applied) return;
  afterSudokuEdit();
  if (autoAdvance && digit) focusNextSudokuEditableCell(index);
};

const toggleSudokuNote = (cell, index, digit) => {
  if (!cell || isSudokuCellReadOnly(cell)) return;
  // One pencil mark per toggle. A multi-character value would set several at
  // once, so it is refused here as well as by the rules.
  if (!sudokuDigitInput(digit)) return;
  syncSudokuSelection();
  if (!applySudokuMove({ op: "toggleNote", index, digit })) return;
  afterSudokuEdit();
};

const applySudokuDigitToCell = (cell, index, value) => {
  if (sudokuState.noteMode) {
    toggleSudokuNote(cell, index, value);
    return;
  }
  updateSudokuCellValue(cell, index, value, { autoAdvance: true });
};

const clearSudokuCellValueOrNotes = (cell, index) => {
  updateSudokuCellValue(cell, index, "", { clearEmptyNotes: true });
};

const applySudokuNumber = (value) => {
  const cells = sudokuCells();
  let cell = selectedSudokuCell();
  if (!cell || isSudokuCellReadOnly(cell)) {
    cell = cells.find((candidate) => !isSudokuCellReadOnly(candidate)) || null;
  }
  if (!cell || isSudokuCellReadOnly(cell)) return;
  const index = Number(cell.dataset.sudokuIndex);
  if (!Number.isInteger(index)) return;
  sudokuState.selectedIndex = index;
  selectSudokuCell(cell);
  if (value === "clear") clearSudokuCellValueOrNotes(cell, index);
  else applySudokuDigitToCell(cell, index, value);
  (selectedSudokuCell() || cell).focus();
};

const setSudokuHintMode = (mode) => {
  if (mode === "errors" && !sudokuState.errorsConfirmed) {
    showSudokuErrorsPrompt();
    return;
  }
  if (!applySudokuMove({ op: "setHintMode", mode: normalizeSudokuHintMode(mode) })) return;
  updateSudokuHintButtons();
  refreshSudokuHintFeedback();
  setSudokuStatus("Ready");
  scheduleSudokuSave();
};

const confirmSudokuErrors = () => {
  applySudokuMove({ op: "confirmErrors" });
  hideSudokuErrorsPrompt();
  setSudokuHintMode("errors");
};

const setSudokuNoteMode = (enabled) => {
  if (!applySudokuMove({ op: "setNoteMode", enabled: Boolean(enabled) })) return;
  updateSudokuNoteToggle();
  updateSudokuNumberButtons();
  scheduleSudokuSave();
};

const showSudokuAchievement = () => {
  flashBanner(sudokuAchievement);
};

const triggerSudokuVictoryEffects = () => {
  if (isSudokuReducedMotion()) return;
  const effects = SUDOKU_WIN_EFFECTS[sudokuState.difficulty];
  if (!effects) return;
  if (!sudokuState.usedHint && !sudokuState.usedReveal) showSudokuAchievement();
  if (effects.fireworks && !sudokuState.usedHint) solStartFireworks();
  if (effects.confetti) msStartConfetti();
};

const triggerSudokuSolvedTileWave = () => {
  const cells = sudokuCells();
  cells.forEach((cell) => {
    cell.classList.remove("is-solved-wave");
    cell.style.removeProperty("--sudoku-solve-delay");
  });
  void sudokuGrid?.offsetWidth;
  cells.forEach((cell, index) => {
    cell.style.setProperty("--sudoku-solve-delay", `${index * 28}ms`);
    cell.classList.add("is-solved-wave");
  });
};

const handleSudokuCellKeydown = (event, cell) => {
  const index = Number(cell?.dataset.sudokuIndex);
  if (!Number.isInteger(index)) return;
  const row = Math.floor(index / 9);
  const column = index % 9;
  const moves = {
    ArrowUp: Math.max(0, row - 1) * 9 + column,
    ArrowDown: Math.min(8, row + 1) * 9 + column,
    ArrowLeft: row * 9 + Math.max(0, column - 1),
    ArrowRight: row * 9 + Math.min(8, column + 1),
  };
  if (event.key in moves) {
    event.preventDefault();
    focusSudokuCell(moves[event.key]);
    return;
  }
  if (SUDOKU_DIGITS.includes(event.key)) {
    event.preventDefault();
    sudokuState.selectedIndex = index;
    selectSudokuCell(cell);
    applySudokuDigitToCell(cell, index, event.key);
    return;
  }
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
    event.preventDefault();
    sudokuState.selectedIndex = index;
    selectSudokuCell(cell);
    clearSudokuCellValueOrNotes(cell, index);
  }
};

const handleSudokuGridClick = (event) => {
  const cell = event.target.closest?.(".sudoku-cell");
  if (!cell || !sudokuGrid.contains(cell)) return;
  focusSudokuCell(Number(cell.dataset.sudokuIndex));
};

const handleSudokuGridFocus = (event) => {
  const cell = event.target.closest?.(".sudoku-cell");
  if (!cell || !sudokuGrid.contains(cell)) return;
  selectSudokuCell(cell);
};

const handleSudokuGridKeydown = (event) => {
  if (isSudokuBoardLocked()) return;
  const cell = event.target.closest?.(".sudoku-cell");
  if (!cell || !sudokuGrid.contains(cell)) return;
  handleSudokuCellKeydown(event, cell);
};

const handleSudokuUndoRedoShortcut = (event) => {
  const isUndoKey = event.key === "z" || event.key === "Z";
  const isRedoKey = event.key === "y" || event.key === "Y";
  if (
    isSudokuBoardLocked() ||
    (!event.metaKey && !event.ctrlKey) ||
    event.altKey
  ) {
    return;
  }
  if (!isUndoKey && !isRedoKey) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.matches("input, textarea, select")) return;
  event.preventDefault();
  if (isRedoKey || event.shiftKey) redoSudokuMove();
  else undoSudokuMove();
};

const ensureSudokuNoteTooltip = () => {
  if (sudokuNoteTooltip) return sudokuNoteTooltip;
  sudokuNoteTooltip = document.createElement("span");
  sudokuNoteTooltip.className = "sudoku-key-tooltip";
  sudokuNoteTooltip.id = "sudoku-note-tooltip";
  sudokuNoteTooltip.setAttribute("role", "tooltip");
  sudokuNoteTooltip.textContent = SUDOKU_NOTE_SHORTCUT_HINT;
  document.body.append(sudokuNoteTooltip);
  return sudokuNoteTooltip;
};

const positionSudokuKeyTooltip = (tooltip, pointer) => {
  const offset = 12;
  const minEdge = 4;
  tooltip.style.left = `${pointer.clientX + offset}px`;
  tooltip.style.top = `${pointer.clientY + offset}px`;
  const bounds = tooltip.getBoundingClientRect();
  const left = Math.min(pointer.clientX + offset, window.innerWidth - bounds.width - minEdge);
  const top = Math.min(pointer.clientY + offset, window.innerHeight - bounds.height - minEdge);
  tooltip.style.left = `${Math.max(minEdge, left)}px`;
  tooltip.style.top = `${Math.max(minEdge, top)}px`;
};

const hideSudokuNoteTooltip = () => {
  sudokuNoteTooltip?.classList.remove("is-visible");
};

const showSudokuNoteTooltip = (event) => {
  if (event.pointerType === "touch") return;
  const tooltip = ensureSudokuNoteTooltip();
  tooltip.classList.add("is-visible");
  positionSudokuKeyTooltip(tooltip, event);
};

const isSudokuKeyboardActive = () => {
  return Boolean(sudokuState.playing && !isSudokuBoardLocked());
};

// Window-level keys: N toggles notes anywhere in the active Sudoku window,
// and digits or clear keys edit the selected cell even while a keypad or
// action button holds focus. The grid keeps its own digit handling, which
// marks those events as handled before they reach the document.
const handleSudokuWindowKeydown = (event) => {
  if (
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    !isSudokuKeyboardActive()
  ) {
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
  if (event.key === "n" || event.key === "N") {
    if (event.repeat) return;
    event.preventDefault();
    setSudokuNoteMode(!sudokuState.noteMode);
    return;
  }
  if (target && sudokuGrid?.contains(target)) return;
  const cell = selectedSudokuCell();
  if (!cell || isSudokuCellReadOnly(cell)) return;
  const index = Number(cell.dataset.sudokuIndex);
  if (!Number.isInteger(index)) return;
  if (SUDOKU_DIGITS.includes(event.key)) {
    event.preventDefault();
    applySudokuDigitToCell(cell, index, event.key);
    return;
  }
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
    event.preventDefault();
    clearSudokuCellValueOrNotes(cell, index);
  }
};

// Every tab shares one saved puzzle. Completions are claimed in a separate,
// append-only list that ordinary debounced saves never write, so a stale
// save from another tab cannot erase a claim. The first tab to complete a
// puzzle claims it; the others adopt the claim from the storage event's
// payload, or read the list at their own completion, so one puzzle publishes
// once. Two tabs completing in the same instant remain a known limit.
const normalizeSudokuCompletionClaims = (claims) =>
  (Array.isArray(claims) ? claims : [])
    .filter(
      (claim) =>
        claim && typeof claim.puzzleId === "string" && typeof claim.puzzle === "string"
    )
    .slice(-SUDOKU_MAX_COMPLETION_CLAIMS);

const parseSudokuCompletionClaims = (serialized) => {
  try {
    return normalizeSudokuCompletionClaims(JSON.parse(serialized || "null"));
  } catch (error) {
    return [];
  }
};

const readSudokuCompletionClaims = () => {
  try {
    return parseSudokuCompletionClaims(localStorage.getItem(SUDOKU_COMPLETION_CLAIMS_KEY));
  } catch (error) {
    return [];
  }
};

const isSudokuCompletionClaimed = (
  claims,
  puzzleId = sudokuState.puzzleId,
  puzzle = sudokuState.puzzle
) => claims.some((claim) => claim.puzzleId === puzzleId && claim.puzzle === puzzle);

const claimSudokuCompletion = () => {
  const claims = readSudokuCompletionClaims();
  if (isSudokuCompletionClaimed(claims)) return;
  claims.push({ puzzleId: sudokuState.puzzleId, puzzle: sudokuState.puzzle });
  try {
    localStorage.setItem(
      SUDOKU_COMPLETION_CLAIMS_KEY,
      JSON.stringify(normalizeSudokuCompletionClaims(claims))
    );
  } catch (error) {
    // Storage is unavailable; the in-memory latch still holds for this tab.
  }
};

const isSudokuCompletionRecordedInStorage = () =>
  isSudokuCompletionClaimed(readSudokuCompletionClaims());

const syncSudokuCompletionFromStorage = (event) => {
  if (sudokuState.completionRecorded) return;
  if (event.key !== null && event.key !== SUDOKU_COMPLETION_CLAIMS_KEY) return;
  const claims =
    event.key === SUDOKU_COMPLETION_CLAIMS_KEY
      ? parseSudokuCompletionClaims(event.newValue)
      : readSudokuCompletionClaims();
  if (isSudokuCompletionClaimed(claims)) sudokuState.completionRecorded = true;
};

const recordSudokuCompletion = () => {
  const elapsedSeconds = currentSudokuElapsedSeconds();
  const finished = sudokuGame;
  const hintBucket = sudokuRules.result(finished).assistance;
  sudokuStats.recordEvent(
    {
      type: "win",
      difficulty: sudokuState.difficulty,
      hintBucket,
      puzzleId: sudokuState.puzzleId,
      puzzle: sudokuState.puzzle,
      metric: elapsedSeconds,
      metricKind: "seconds",
    },
    {
      sudokuNoHintsSeconds: hintBucket === "noHints" ? elapsedSeconds : null,
      /**
       * The server observes the start and the finish, so its elapsed time is the
       * one that gets published — and the clock on screen is brought into line
       * with it, rather than leaving the player looking at a different number. A
       * board that has since been replaced or reset is left alone: this metric
       * belongs to the puzzle it was derived from.
       */
      onCanonicalMetric: ({ metric, metricKind, updateLocalStats = true }) => {
        if (sudokuGame !== finished || !sudokuState.solved) return;
        if (metricKind !== "seconds") return;
        if (!Number.isSafeInteger(metric) || metric < 0) return;
        sudokuState.elapsedSeconds = metric;
        sudokuState.timerStartedAt = 0;
        updateSudokuTimeDisplay();
        // Local statistics cleared since the finish stay cleared: the clock on
        // screen is this board's business, the saved puzzle is not.
        if (updateLocalStats) flushSudokuSave();
      },
    }
  );
  triggerSudokuVictoryEffects();
  notifyActivity("gameWin", { game: "sudoku" });
};

const checkSudokuBoard = () => {
  // A finished board is terminal. Check puts the solved dialog back up and
  // nothing else: the result it produced has already been claimed.
  if (sudokuState.solved) {
    showSudokuSolvePopup();
    refreshSudokuFullBoardPrompt();
    return;
  }

  const outcome = validateSudokuBoard();
  if (!applySudokuMove({ op: "check" })) return;

  if (!outcome.complete || !outcome.valid) {
    // Three mistake-revealing checks are all a puzzle gets. The engine answers a
    // fourth by leaving the mistake count at zero, so nothing is revealed here.
    if (!outcome.valid && !sudokuState.mistakes) {
      clearSudokuHighlights();
      setSudokuStatus("No checks remaining");
      scheduleSudokuSave();
      return;
    }

    validateSudokuBoard({ mark: true });
    if (outcome.valid) {
      triggerSudokuCheckBubbleBurst();
      setSudokuStatus("Ready");
    } else {
      setSudokuStatus("System alert");
    }
    scheduleSudokuSave();
    return;
  }

  setSudokuStatus("Solved");
  triggerSudokuFullBubbleBurst();
  triggerSudokuSolvedTileWave();
  showSudokuSolvePopup();
  pauseSudokuTimer();
  if (!sudokuState.completionRecorded) {
    sudokuState.completionRecorded = true;
    const recordedByAnotherTab = isSudokuCompletionRecordedInStorage();
    claimSudokuCompletion();
    flushSudokuSave();
    if (!recordedByAnotherTab) recordSudokuCompletion();
  }
  scheduleSudokuSave();
  refreshSudokuFullBoardPrompt();
};

const renderSudoku = () => {
  if (!sudokuGrid) return;
  sudokuGrid.replaceChildren();
  sudokuCellElements = [];
  sudokuGrid.setAttribute("role", "grid");
  // The engine holds the authoritative board, so drawing reads it rather than
  // re-deriving one: the grid cannot show an entry the rules never accepted.
  if (sudokuGame) projectSudokuGame();
  const puzzle = sudokuState.puzzle;

  // A grid must expose its cells through rows. `.sudoku-row` is
  // `display: contents` so the board keeps its single 9x9 CSS grid.
  const fragment = document.createDocumentFragment();
  const rowElements = Array.from({ length: SUDOKU_ROW_COUNT }, (unused, rowIndex) => {
    const rowElement = document.createElement("div");
    rowElement.className = "sudoku-row";
    rowElement.setAttribute("role", "row");
    rowElement.setAttribute("aria-rowindex", String(rowIndex + 1));
    fragment.append(rowElement);
    return rowElement;
  });
  puzzle.split("").forEach((value, index) => {
    const cell = document.createElement("div");
    cell.className = "sudoku-cell";
    cell.tabIndex = 0;
    cell.value = "";
    cell.readOnly = false;
    cell.dataset.sudokuIndex = String(index);
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("data-custom-cursor-guard", "");

    const valueEl = document.createElement("span");
    valueEl.className = "sudoku-cell-value";
    const notesEl = document.createElement("span");
    notesEl.className = "sudoku-cell-notes";
    notesEl.setAttribute("aria-hidden", "true");
    cell._sudokuValueEl = valueEl;
    cell._sudokuNoteDigits = [];
    SUDOKU_DIGITS.split("").forEach((noteDigit) => {
      const note = document.createElement("span");
      note.className = "sudoku-note-digit";
      // Each slot always stands for the same digit, so the stylesheet can
      // match it against the grid's selected value with no per-key work.
      note.dataset.sudokuNote = noteDigit;
      cell._sudokuNoteDigits.push(note);
      notesEl.append(note);
    });
    cell.append(valueEl, notesEl);

    if (SUDOKU_DIGITS.includes(value)) {
      cell.readOnly = true;
      cell.classList.add("is-given");
      sudokuState.notes[index] = "";
    }
    setSudokuCellValue(cell, index, sudokuState.values[index]);
    syncSudokuCellFeedback(cell, index);
    sudokuCellElements[index] = cell;
    rowElements[Math.floor(index / SUDOKU_ROW_COUNT)].append(cell);
  });
  sudokuGrid.append(fragment);

  updateSudokuDifficultyButtons();
  updateSudokuHintButtons();
  refreshSudokuHintFeedback();
  selectSudokuCell(sudokuCellElements[sudokuState.selectedIndex] || null);
  updateSudokuHistoryButtons();
  updateSudokuTimeDisplay();
  setSudokuStatus(sudokuState.solved ? "Solved" : "Ready");
};

/**
 * Replaces the board with a generated puzzle. The id is minted here, so a
 * pooled puzzle has no identity until the moment it is adopted, and the live
 * loader and note-mode state carry over rather than being captured when the
 * request went out.
 */
/**
 * A warm puzzle is adopted in the same tick, so this state is usually never
 * seen. A cold difficulty leaves the current board up: the grid reports
 * `aria-busy` and the status says so, rather than the window freezing.
 */
const setSudokuGeneratingState = (isGenerating) => {
  sudokuGrid?.setAttribute("aria-busy", String(isGenerating));
  if (isGenerating) setSudokuStatus(SUDOKU_GENERATING_STATUS);
};

/** Invalidated by every new puzzle, so a stale issuance cannot land on one. */
let sudokuIssueToken = 0;

/**
 * Asks for the server's puzzle for this difficulty. A verified result has to bind
 * the board the server issued, so the issued puzzle replaces the generated one —
 * but only while the grid is still untouched. Once an entry has been made the
 * puzzle on screen is the player's own, and the attempt stays local rather than
 * having the board change underneath them.
 */
const requestIssuedSudokuPuzzle = () => {
  if (sudokuStats.hasIssuedGame()) return;
  const token = (sudokuIssueToken += 1);
  const carriedNoteMode = sudokuState.noteMode;
  const pending = sudokuStats.issueGame({ difficulty: sudokuState.difficulty });
  if (!pending) return;
  Promise.resolve(pending).then((descriptor) => {
    // A newer request owns the session now; this one was already detached.
    if (!descriptor || token !== sudokuIssueToken) return;
    if (sudokuAppliedMoves || sudokuState.solved) {
      // Something was played before the server answered, so the puzzle on screen
      // is not the one it issued and the recorded replay belongs to this board,
      // not to that one. The board the player is on is kept exactly as it is and
      // the proof it never applied to is dropped. Clearing the replay instead
      // would leave this board wearing a proof of a puzzle it never was.
      releaseUnadoptedSudokuProof();
      return;
    }
    sudokuGame = sudokuRules.initial(descriptor.initial);
    sudokuAppliedMoves = 0;
    sudokuState.puzzleId = descriptor.gameId || sudokuState.puzzleId;
    // New Game carries the pencil-mark preference across puzzles, and an issued
    // board always starts with it off. It is turned back on as a move on the
    // board the server issued, so the verifier derives the mode the player is
    // in rather than being handed it: carrying it as unrecorded state would put
    // the replay and the board on screen into different modes.
    if (carriedNoteMode) applySudokuMove({ op: "setNoteMode", enabled: true });
    // Everything applied so far is recorded against the board that was issued.
    sudokuAppliedMoves = 0;
    renderSudoku();
    scheduleSudokuSave();
  }, () => {
    // A puzzle that could not be issued is still playable; it simply stays local,
    // exactly as it does with no backend configured at all.
  });
};

const adoptSudokuPuzzle = (difficulty, generated) => {
  const wasPlaying = sudokuState.playing;
  const previousNoteMode = sudokuState.noteMode;
  const loadingTimerId = sudokuState.loadingTimerId;
  const transitionTimerId = sudokuState.transitionTimerId;
  const loadingStartedAt = sudokuState.loadingStartedAt;
  const loadingDuration = sudokuState.loadingDuration;
  const loadingProgress = sudokuState.loadingProgress;
  hideSudokuErrorsPrompt({ restoreFocus: false });
  hideSudokuSolvePopup();
  pauseSudokuTimer();
  sudokuState = {
    difficulty,
    puzzleId: createSudokuPuzzleId(difficulty),
    puzzle: generated.puzzle,
    solution: generated.solution,
    mistakes: 0,
    elapsedSeconds: 0,
    timerId: null,
    timerStartedAt: 0,
    loadingTimerId,
    transitionTimerId,
    loadingStartedAt,
    loadingDuration,
    loadingProgress,
    playing: wasPlaying,
    solved: false,
    completionRecorded: false,
    usedHint: false,
    usedReveal: false,
    checksUsed: 0,
    errorsConfirmed: false,
    statsSession: "",
    statsSessionEligible: true,
    hintMode: "off",
    noteMode: previousNoteMode,
    values: normalizeSudokuValues("", generated.puzzle),
    notes: createSudokuEmptyNotes(),
    selectedIndex: -1,
  };
  sudokuGame = sudokuRules.initial({
    difficulty,
    puzzle: generated.puzzle,
    solution: generated.solution,
    noteMode: previousNoteMode,
  });
  sudokuAppliedMoves = 0;
  sudokuPuzzleReady = true;
  renderSudoku();
  requestIssuedSudokuPuzzle();
  setSudokuGeneratingState(false);
  resetSudokuTimer();
  scheduleSudokuSave();
  // A cold difficulty can land while the player is paused, by hand or by a
  // hidden tab. The new board is adopted behind the resume overlay, so the
  // status stays Paused and the clock waits for the play button: a timer
  // started here would run on a board nobody can see. Resuming then reports
  // Ready, because the status kept for the resume belongs to the old puzzle.
  if (sudokuPaused) {
    sudokuStatusBeforePause = "Ready";
    setSudokuStatus("Paused");
    return;
  }
  if (isSudokuWindowVisible() && wasPlaying) startSudokuTimer();
};

/**
 * New Game and the difficulty buttons never block. A warm puzzle is adopted
 * in the same tick; a cold difficulty leaves the current board in place and
 * reports Generating until the worker delivers.
 *
 * Only the newest request can reach the board, so an older one that is still
 * waiting is withdrawn here rather than left to draw a generation nobody will
 * adopt: ten impatient clicks on a cold difficulty are one board's worth of
 * demand, not ten. Work already in flight still delivers, into the capped
 * pool; the token guard catches a waiter that resolved before it was dropped.
 */
const loadSudokuDifficulty = (difficulty) => {
  const normalizedDifficulty = normalizeSudokuDifficulty(difficulty);
  const token = (sudokuPuzzleRequestToken += 1);
  if (sudokuPendingAdoption) {
    cancelSudokuPuzzleWaiter(
      sudokuPendingAdoption.difficulty,
      sudokuPendingAdoption.adopt
    );
    sudokuPendingAdoption = null;
  }
  setSudokuGeneratingState(true);
  const adopt = (generated) => {
    sudokuPendingAdoption = null;
    if (token !== sudokuPuzzleRequestToken) {
      returnSudokuPuzzleToPool(normalizedDifficulty, generated);
      return;
    }
    adoptSudokuPuzzle(normalizedDifficulty, generated);
  };
  sudokuPendingAdoption = { difficulty: normalizedDifficulty, adopt };
  withSudokuPuzzle(normalizedDifficulty, adopt);
};

sudokuDifficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    loadSudokuDifficulty(button.dataset.sudokuDifficulty);
  });
});

sudokuNumberButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applySudokuNumber(button.dataset.sudokuNumber || "");
  });
});

sudokuHintButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSudokuHintMode(button.dataset.sudokuHint || "off");
  });
});

if (sudokuNoteToggle) {
  ensureSudokuNoteTooltip();
  sudokuNoteToggle.addEventListener("click", () => {
    setSudokuNoteMode(!sudokuState.noteMode);
  });
  sudokuNoteToggle.addEventListener("pointerenter", showSudokuNoteTooltip);
  sudokuNoteToggle.addEventListener("pointermove", showSudokuNoteTooltip);
  sudokuNoteToggle.addEventListener("pointerleave", hideSudokuNoteTooltip);
}

if (sudokuUndo) {
  sudokuUndo.addEventListener("click", undoSudokuMove);
}

if (sudokuRedo) {
  sudokuRedo.addEventListener("click", redoSudokuMove);
}

if (sudokuNew) {
  sudokuNew.addEventListener("click", () => {
    loadSudokuDifficulty(sudokuState.difficulty);
  });
}

if (sudokuCheck) {
  sudokuCheck.addEventListener("click", checkSudokuBoard);
}

if (sudokuPause) {
  sudokuPause.addEventListener("click", () => setSudokuPaused(true));
}

if (sudokuResume) {
  sudokuResume.addEventListener("click", () => setSudokuPaused(false));
}

if (sudokuPlay) {
  sudokuPlay.addEventListener("click", startSudokuGameFromBoot);
}

if (sudokuGrid) {
  sudokuGrid.addEventListener("click", handleSudokuGridClick);
  sudokuGrid.addEventListener("focusin", handleSudokuGridFocus);
  sudokuGrid.addEventListener("keydown", handleSudokuGridKeydown);
}

registerActiveWindowKeyHandler("sudoku", handleSudokuUndoRedoShortcut);

registerActiveWindowKeyHandler("sudoku", handleSudokuWindowKeydown);

window.addEventListener("storage", syncSudokuCompletionFromStorage);

document.addEventListener("visibilitychange", handleSudokuVisibilityChange);

window.addEventListener("focus", syncSudokuAquariumActivity);

window.addEventListener("blur", syncSudokuAquariumActivity);

if (sudokuReducedMotionMedia) {
  if (typeof sudokuReducedMotionMedia.addEventListener === "function") {
    sudokuReducedMotionMedia.addEventListener("change", syncSudokuAquariumActivity);
  } else if (typeof sudokuReducedMotionMedia.addListener === "function") {
    sudokuReducedMotionMedia.addListener(syncSudokuAquariumActivity);
  }
}

if (sudokuSolveOk) {
  sudokuSolveOk.addEventListener("click", hideSudokuSolvePopup);
}

if (sudokuErrorsCancel) {
  sudokuErrorsCancel.addEventListener("click", () => hideSudokuErrorsPrompt());
}

if (sudokuErrorsConfirm) {
  sudokuErrorsConfirm.addEventListener("click", confirmSudokuErrors);
}

if (sudokuErrorsPrompt) {
  sudokuErrorsPrompt.addEventListener("keydown", trapSudokuErrorsPromptFocus);
  sudokuErrorsPrompt.addEventListener("cancel", (event) => {
    event.preventDefault();
    hideSudokuErrorsPrompt();
  });
}

if (sudokuSolvePopup) {
  sudokuSolvePopup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hideSudokuSolvePopup();
    }
  });
}

// With nothing to restore the board renders empty and stays that way until
// Sudoku is opened: the first puzzle is generated like any other, off-thread,
// so no visitor pays for one on a page they never open.
sudokuPuzzleReady = restoreSudokuSavedState();

renderSudoku();

registerWindowLifecycle("sudoku", {
  onOpen: () => startSudokuBootSequence(),
  onClose: () => {
    clearSudokuBootSequence({ resetView: false });
    pauseSudokuTimer();
  },
});

registerViewportObserver({
  onFrame: () => {
    if (sudokuApp?.classList.contains("is-sudoku-playing")) {
      scheduleSudokuWindowViewportClamp();
    }
  },
});

registerGameStatsLocalSource("sudoku", {
  // The solved dialog holds the screen, so a sign-in prompt waits for it.
  isCompletionDialogOpen: () =>
    Boolean(
      sudokuSolvePopup?.classList.contains("is-visible") &&
        sudokuSolvePopup.getAttribute("aria-hidden") === "false"
    ),
  resetLocalData: () => {
    pauseSudokuTimer();
    sudokuState.playing = false;
    sudokuState.hintMode = "off";
    sudokuState.noteMode = false;
    loadSudokuDifficulty("easy");
    removeStorage(() => localStorage, SUDOKU_STORAGE_KEY);
    // Completion claims retain their cross-tab merge policy and storage path.
    try {
      localStorage.removeItem(SUDOKU_COMPLETION_CLAIMS_KEY);
    } catch {
      // The fresh in-memory puzzle still replaces the previous player's game.
    }
  },
});

window.homeSudoku = Object.freeze({
  SUDOKU_COMPLETION_CLAIMS_KEY,
  SUDOKU_STORAGE_KEY,
  clearSudokuBootSequence,
  flushSudokuSave,
  formatSudokuTime,
  isSudokuWindowVisible,
  loadSudokuDifficulty,
  pauseSudokuTimer,
  scheduleSudokuWindowViewportClamp,
  startSudokuBootSequence,
  sudokuApp,
  sudokuSolvePopup,
  sudokuState,
});
})();
