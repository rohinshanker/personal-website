/**
 * Sudoku rules, as a portable engine.
 *
 * This file decides what a Sudoku move is, what a Check costs, and when a
 * board is finished. The browser controller in scripts/home/features/sudoku.js
 * owns the grid, the aquarium, the clock and the save file; it asks this engine
 * to decide and to apply every change, so the board a player sees and the board
 * a verifier replays cannot drift apart.
 *
 * The logical state is JSON: the givens, the solution, the player's entries and
 * pencil marks, the assistance latches, and the bounded undo and redo stacks.
 * Timing lives outside the engine — a replay cannot prove a clock.
 */
(() => {
const window = globalThis.window || globalThis;

const {
  GameRuleError,
  assertInteger,
  assertObject,
  randomIndex,
  shuffle,
} = window.homeGameRules;

const DIGITS = "123456789";
const CELL_COUNT = 81;
const UNIT_SIZE = 9;
const FULL_DIGIT_MASK = 0b1111111110;
const MAX_UNDO_STATES = 80;
const MAX_LEADERBOARD_CHECKS = 3;
const BLANK = "0";

const DIFFICULTIES = Object.freeze(["easy", "medium", "hard", "expert", "master", "extreme"]);
const HINT_MODES = Object.freeze(["off", "conflicts", "errors"]);

const boxIndex = (row, columnIndex) => Math.floor(row / 3) * 3 + Math.floor(columnIndex / 3);

/** The other twenty cells sharing a row, column or box with each index. */
const PEERS = Object.freeze(
  Array.from({ length: CELL_COUNT }, (unused, index) => {
    const row = Math.floor(index / UNIT_SIZE);
    const columnIndex = index % UNIT_SIZE;
    const box = boxIndex(row, columnIndex);
    return Object.freeze(
      Array.from({ length: CELL_COUNT }, (ignored, other) => other).filter((other) => {
        if (other === index) return false;
        const otherRow = Math.floor(other / UNIT_SIZE);
        const otherColumn = other % UNIT_SIZE;
        return otherRow === row || otherColumn === columnIndex ||
          boxIndex(otherRow, otherColumn) === box;
      })
    );
  })
);

const fail = (message, code = "invalid-move") => {
  throw new GameRuleError(code, message);
};

const assertGrid = (value, label) => {
  if (typeof value !== "string" || value.length !== CELL_COUNT ||
      !Array.from(value).every((digit) => digit === BLANK || DIGITS.includes(digit))) {
    fail(`Invalid ${label}`, "invalid-input");
  }
  return value;
};

const assertDifficulty = (value) =>
  DIFFICULTIES.includes(value) ? value : fail("Unknown Sudoku difficulty", "invalid-input");

const assertConfig = (config) => {
  const value = assertObject(config ?? {}, ["difficulty"], "Sudoku configuration");
  return { difficulty: assertDifficulty(value.difficulty) };
};

/** Nine distinct digits in every row, column and box, with no blanks left. */
const isCompleteSolution = (grid) => {
  if (grid.includes(BLANK)) return false;
  for (let unit = 0; unit < UNIT_SIZE; unit += 1) {
    let rowMask = 0;
    let columnMask = 0;
    let boxMask = 0;
    for (let offset = 0; offset < UNIT_SIZE; offset += 1) {
      rowMask |= 1 << Number(grid[unit * UNIT_SIZE + offset]);
      columnMask |= 1 << Number(grid[offset * UNIT_SIZE + unit]);
      const box = (Math.floor(unit / 3) * 3 + Math.floor(offset / 3)) * UNIT_SIZE +
        (unit % 3) * 3 + (offset % 3);
      boxMask |= 1 << Number(grid[box]);
    }
    if (rowMask !== FULL_DIGIT_MASK || columnMask !== FULL_DIGIT_MASK ||
        boxMask !== FULL_DIGIT_MASK) {
      return false;
    }
  }
  return true;
};

const isGiven = (state, index) => state.puzzle[index] !== BLANK;

const normalizeNotes = (value) =>
  Array.from(new Set(Array.from(typeof value === "string" ? value : "")))
    .filter((digit) => DIGITS.includes(digit))
    .sort()
    .join("");

const normalizeNoteList = (raw, puzzle) => {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > CELL_COUNT) fail("Invalid notes", "invalid-input");
  return Array.from({ length: CELL_COUNT }, (unused, index) =>
    puzzle[index] === BLANK ? normalizeNotes(list[index]) : "");
};

const withDigit = (grid, index, digit) =>
  `${grid.slice(0, index)}${digit}${grid.slice(index + 1)}`;

/**
 * Every entry that disagrees with the solution. Givens are never counted: they
 * cannot be edited, so they cannot be wrong.
 */
const evaluate = (state) => {
  const wrong = [];
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = state.values[index];
    if (value === BLANK || isGiven(state, index)) continue;
    if (value !== state.solution[index]) wrong.push(index);
  }
  return {
    complete: !state.values.includes(BLANK),
    mistakes: wrong.length,
    valid: wrong.length === 0,
    wrong,
  };
};

/**
 * Every index holding a value that repeats inside its own row, column or box,
 * givens included. This reads the board and never the solution, so a marked
 * pair says only that both cannot stand, never which one is wrong — which is
 * why Conflicts spends no allowance and sets no assistance latch.
 */
const conflictIndexes = (state) => {
  const units = new Map();
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = state.values[index];
    if (value === BLANK) continue;
    const row = Math.floor(index / UNIT_SIZE);
    const columnIndex = index % UNIT_SIZE;
    [`r${row}`, `c${columnIndex}`, `b${boxIndex(row, columnIndex)}`].forEach((unit) => {
      const key = `${unit}:${value}`;
      const members = units.get(key);
      if (members) members.push(index);
      else units.set(key, [index]);
    });
  }
  const conflicts = [];
  units.forEach((members) => {
    if (members.length > 1) conflicts.push(...members);
  });
  return Array.from(new Set(conflicts)).sort((left, right) => left - right);
};

/**
 * Errors mode is the only thing that marks a wrong value, and the assistance
 * latch flips the first time it marks one. Turning the mode off, correcting the
 * value, undoing or redoing cannot reverse it. Outside Errors mode the hidden
 * mistake total stays hidden: the count reads zero.
 */
const refreshHintFeedback = (state) => {
  if (state.hintMode !== "errors") {
    state.mistakes = 0;
    return;
  }
  const { mistakes } = evaluate(state);
  state.mistakes = mistakes;
  if (mistakes > 0) state.usedHint = true;
};

const historyEntry = (state) => ({
  values: state.values,
  notes: state.notes.slice(),
  selectedIndex: state.selectedIndex,
});

const sameEntry = (first, second) =>
  Boolean(first && second && first.selectedIndex === second.selectedIndex &&
    first.values === second.values && first.notes.join("|") === second.notes.join("|"));

const pushUndo = (state) => {
  const entry = historyEntry(state);
  if (sameEntry(entry, state.undo[state.undo.length - 1])) return;
  state.undo.push(entry);
  if (state.undo.length > MAX_UNDO_STATES) state.undo.shift();
  state.redo = [];
};

const applyHistoryEntry = (state, entry) => {
  state.values = entry.values;
  state.notes = entry.notes.slice();
  state.selectedIndex = entry.selectedIndex;
  state.solved = false;
  refreshHintFeedback(state);
};

/**
 * Validates an issued puzzle and returns the working state. The undo and redo
 * stacks always start empty: a replay is verified from the issued puzzle
 * forward, never from a client's history.
 */
const initial = (rawInitial) => {
  const raw = assertObject(rawInitial, [
    "rngState", "difficulty", "puzzle", "solution", "values", "notes", "selectedIndex",
    "hintMode", "noteMode", "errorsConfirmed", "usedHint", "usedReveal", "checksUsed",
    "moves", "solved",
  ], "Sudoku initial state");
  const puzzle = assertGrid(raw.puzzle, "puzzle");
  const solution = assertGrid(raw.solution, "solution");
  if (!isCompleteSolution(solution)) fail("The solution is not a complete grid", "invalid-input");
  if (Array.from(puzzle).some((digit, index) => digit !== BLANK && digit !== solution[index])) {
    fail("The puzzle does not agree with its solution", "invalid-input");
  }
  if (puzzle === solution) fail("The puzzle has nothing left to solve", "invalid-input");
  const values = Array.from(assertGrid(raw.values ?? puzzle, "values"));
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (puzzle[index] !== BLANK && values[index] !== puzzle[index]) {
      fail("A given cannot be overwritten", "invalid-input");
    }
  }
  const state = {
    rngState: assertInteger(raw.rngState ?? 0, 0, 0xffffffff, "random state"),
    difficulty: assertDifficulty(raw.difficulty),
    puzzle,
    solution,
    values: values.join(""),
    notes: normalizeNoteList(raw.notes, puzzle),
    selectedIndex: assertInteger(raw.selectedIndex ?? -1, -1, CELL_COUNT - 1, "selected cell"),
    hintMode: HINT_MODES.includes(raw.hintMode ?? "off")
      ? raw.hintMode ?? "off"
      : fail("Unknown Sudoku hint mode", "invalid-input"),
    noteMode: Boolean(raw.noteMode ?? false),
    errorsConfirmed: Boolean(raw.errorsConfirmed ?? false),
    usedHint: Boolean(raw.usedHint ?? false),
    usedReveal: Boolean(raw.usedReveal ?? false),
    checksUsed: assertInteger(raw.checksUsed ?? 0, 0, MAX_LEADERBOARD_CHECKS, "checks used"),
    moves: assertInteger(raw.moves ?? 0, 0, 100_000, "move count"),
    mistakes: 0,
    solved: false,
    undo: [],
    redo: [],
  };
  if (state.hintMode === "errors" && !state.errorsConfirmed) {
    fail("Errors mode needs its confirmation", "invalid-input");
  }
  // A restored board may already be finished, but only if it really is: the claim
  // is checked against the grid rather than believed. An issued board is never
  // complete, so issuance can never arrive here claiming to be solved.
  if (raw.solved !== undefined && Boolean(raw.solved)) {
    const outcome = evaluate(state);
    if (!outcome.complete || !outcome.valid) {
      fail("That board is not solved", "invalid-input");
    }
    state.solved = true;
  }
  refreshHintFeedback(state);
  return state;
};

const countMove = (state) => {
  state.moves += 1;
};

const assertEditable = (state, action) => {
  const index = assertInteger(action.index, 0, CELL_COUNT - 1, "cell");
  if (isGiven(state, index)) fail("A given cannot be edited");
  return index;
};

const OPERATIONS = Object.freeze({
  select: {
    keys: ["index"],
    cost: () => 1,
    check(state, action) {
      const index = assertInteger(action.index, -1, CELL_COUNT - 1, "cell");
      if (index === state.selectedIndex) fail("That cell is already selected");
    },
    apply(state, action) {
      state.selectedIndex = action.index;
    },
  },
  setValue: {
    keys: ["index", "value"],
    cost: () => PEERS[0].length + UNIT_SIZE,
    check(state, action) {
      const index = assertEditable(state, action);
      if (typeof action.value !== "string" || !DIGITS.includes(action.value)) {
        fail("A cell holds one digit", "invalid-input");
      }
      if (state.values[index] === action.value) fail("That digit is already there");
    },
    apply(state, action) {
      pushUndo(state);
      state.values = withDigit(state.values, action.index, action.value);
      // Placing a digit rules it out of its row, column and box, so the pencil
      // mark is stale the moment the value lands. Retiring it belongs to this
      // move: one undo puts the value and every cleared mark back together.
      PEERS[action.index].forEach((peer) => {
        if (state.notes[peer].includes(action.value)) {
          state.notes[peer] = state.notes[peer].split(action.value).join("");
        }
      });
      state.solved = false;
      countMove(state);
      refreshHintFeedback(state);
    },
  },
  clear: {
    keys: ["index"],
    cost: () => UNIT_SIZE,
    check(state, action) {
      const index = assertEditable(state, action);
      if (state.values[index] === BLANK && !state.notes[index]) fail("That cell is already empty");
    },
    apply(state, action) {
      pushUndo(state);
      // Clearing an empty cell is how the keypad wipes its pencil marks.
      if (state.values[action.index] === BLANK) state.notes[action.index] = "";
      else state.values = withDigit(state.values, action.index, BLANK);
      state.solved = false;
      countMove(state);
      refreshHintFeedback(state);
    },
  },
  toggleNote: {
    keys: ["index", "digit"],
    cost: () => UNIT_SIZE,
    check(state, action) {
      const index = assertEditable(state, action);
      if (typeof action.digit !== "string" || !DIGITS.includes(action.digit)) {
        fail("A pencil mark is one digit", "invalid-input");
      }
      if (state.values[index] !== BLANK) fail("A filled cell holds no pencil marks");
    },
    apply(state, action) {
      pushUndo(state);
      const notes = state.notes[action.index];
      state.notes[action.index] = notes.includes(action.digit)
        ? notes.split(action.digit).join("")
        : normalizeNotes(`${notes}${action.digit}`);
      state.solved = false;
      countMove(state);
      refreshHintFeedback(state);
    },
  },
  undo: {
    keys: [],
    cost: () => CELL_COUNT,
    check(state) {
      if (!state.undo.length) fail("There is nothing to undo");
    },
    apply(state) {
      const current = historyEntry(state);
      applyHistoryEntry(state, state.undo.pop());
      state.redo.push(current);
      if (state.redo.length > MAX_UNDO_STATES) state.redo.shift();
    },
  },
  redo: {
    keys: [],
    cost: () => CELL_COUNT,
    check(state) {
      if (!state.redo.length) fail("There is nothing to redo");
    },
    apply(state) {
      const current = historyEntry(state);
      applyHistoryEntry(state, state.redo.pop());
      state.undo.push(current);
      if (state.undo.length > MAX_UNDO_STATES) state.undo.shift();
    },
  },
  confirmErrors: {
    keys: [],
    cost: () => 1,
    check(state) {
      if (state.errorsConfirmed) fail("The Errors warning is already accepted");
    },
    apply(state) {
      state.errorsConfirmed = true;
    },
  },
  setHintMode: {
    keys: ["mode"],
    cost: () => CELL_COUNT,
    check(state, action) {
      if (!HINT_MODES.includes(action.mode)) fail("Unknown Sudoku hint mode", "invalid-input");
      if (action.mode === state.hintMode) fail("That hint mode is already on");
      if (action.mode === "errors" && !state.errorsConfirmed) {
        fail("Errors mode needs its confirmation first");
      }
    },
    apply(state, action) {
      state.hintMode = action.mode;
      refreshHintFeedback(state);
    },
  },
  setNoteMode: {
    keys: ["enabled"],
    cost: () => 1,
    check(state, action) {
      if (typeof action.enabled !== "boolean") fail("Note mode is a flag", "invalid-input");
      if (action.enabled === state.noteMode) fail("Note mode is already there");
    },
    apply(state, action) {
      state.noteMode = action.enabled;
    },
  },
  /**
   * Check is both the diagnostic and the submission. It spends an allowance
   * only when it reveals at least one mistake, so a clean board is free however
   * many allowances are gone; a complete and correct board is a submission, not
   * a diagnostic, and stays submittable after all three are spent.
   */
  check: {
    keys: [],
    cost: () => CELL_COUNT * 2,
    check() {},
    apply(state) {
      const outcome = evaluate(state);
      if (outcome.complete && outcome.valid) {
        state.mistakes = 0;
        state.solved = true;
        return;
      }
      if (!outcome.valid && state.checksUsed >= MAX_LEADERBOARD_CHECKS) {
        state.mistakes = 0;
        return;
      }
      state.mistakes = outcome.mistakes;
      if (!outcome.valid) state.checksUsed += 1;
    },
  },
});

/**
 * Throws the exact reason `action` cannot be played, or returns its operation.
 *
 * A solved puzzle is not closed: the player can carry on editing it, and the
 * first edit takes the win back off the board. Only publication is final, and
 * that latch belongs to the controller and the server, not to the rules.
 */
const review = (state, action) => {
  const operation = OPERATIONS[action?.op] ||
    fail(`Unknown Sudoku move: ${String(action?.op)}`, "invalid-input");
  assertObject(action, ["seq", "op", ...operation.keys], "Sudoku move");
  operation.check(state, action);
  return operation;
};

const transition = (state, input, budget) => {
  const operation = review(state, input);
  budget.spend(operation.cost(state, input));
  operation.apply(state, input);
  return state;
};

/** Whether `action` is playable now. The controller offers nothing else. */
const canApply = (state, action) => {
  try {
    review(state, action);
    return true;
  } catch (error) {
    if (error instanceof GameRuleError) return false;
    throw error;
  }
};

const result = (state) => ({
  terminal: state.solved,
  won: state.solved,
  lost: false,
  score: state.moves,
  moves: state.moves,
  assistance: state.usedHint || state.usedReveal ? "withHints" : "noHints",
  assistanceCount: state.checksUsed,
  configuration: { difficulty: state.difficulty },
});

/**
 * Relabels the digits and permutes the bands, stacks, rows and columns of a
 * puzzle, optionally transposing it. Every operation is a symmetry of Sudoku:
 * the solution count is unchanged, so a puzzle proved to have exactly one
 * answer still has exactly one, and the clue count — which is what sets the
 * difficulty — is identical. Forty-eight bits of `seed` pick the variant.
 */
const transform = (base, { seed = 0 } = {}) => {
  const raw = assertObject(base, ["difficulty", "puzzle", "solution"], "Sudoku puzzle");
  const puzzle = assertGrid(raw.puzzle, "puzzle");
  const solution = assertGrid(raw.solution, "solution");
  // A local RNG seed, so the engine's own replay randomness is never advanced.
  const rng = { rngState: assertInteger(seed, 0, 0xffffffff, "seed") };
  const next = (count) => randomIndex(rng, count);
  const permute = (items) => shuffle(items, rng);
  const groups = [0, 1, 2];
  const lines = () => permute(groups).flatMap((band) => permute(groups).map((line) => band * 3 + line));
  const rows = lines();
  const columns = lines();
  const digits = permute(Array.from(DIGITS));
  const transpose = next(2) === 1;
  const relabel = Object.fromEntries(Array.from(DIGITS, (digit, offset) => [digit, digits[offset]]));
  const rewrite = (grid) =>
    rows.flatMap((row) => columns.map((columnIndex) => {
      const source = transpose ? columnIndex * UNIT_SIZE + row : row * UNIT_SIZE + columnIndex;
      const digit = grid[source];
      return digit === BLANK ? BLANK : relabel[digit];
    })).join("");
  return {
    difficulty: assertDifficulty(raw.difficulty),
    puzzle: rewrite(puzzle),
    solution: rewrite(solution),
  };
};

window.homeSudokuRules = Object.freeze({
  BLANK,
  CELL_COUNT,
  DIFFICULTIES,
  DIGITS,
  HINT_MODES,
  MAX_LEADERBOARD_CHECKS,
  MAX_UNDO_STATES,
  PEERS,
  assertConfig,
  canApply,
  conflictIndexes,
  evaluate,
  initial,
  isCompleteSolution,
  normalizeNotes,
  result,
  transform,
  transition,
});
})();
