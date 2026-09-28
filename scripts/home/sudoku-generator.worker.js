/**
 * Sudoku puzzle generation, off the main thread.
 *
 * Carving a puzzle means removing clues one at a time and re-solving after
 * each removal to prove the grid still has exactly one answer. That is a
 * backtracking search run dozens of times, and on the main thread it froze
 * the page: the board was generated during script evaluation, and every New
 * Game stalled the UI until it finished.
 *
 * This worker owns that work end to end. It is the only implementation —
 * `main.js` keeps none of its own — so there is one generator to reason
 * about. When a browser cannot start it, `main.js` falls back to the static
 * puzzles it already ships rather than generating on the main thread.
 *
 * Protocol: post `{ requestId, difficulty, targetClues, maxAttempts }`;
 * receive `{ requestId, difficulty, puzzle, solution, clues }`, or
 * `{ requestId, difficulty, error }` if generation threw. The caller assigns
 * the puzzle id, so identity stays with the state that saves it.
 */

const SUDOKU_DIGITS = "123456789";
const SUDOKU_CELL_COUNT = 81;
const SUDOKU_FULL_DIGIT_MASK = 0b1111111110;

const shuffle = (items) => {
  const shuffled = Array.from(items);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const sudokuBoxIndex = (row, column) =>
  Math.floor(row / 3) * 3 + Math.floor(column / 3);

const countSudokuMaskBits = (mask) => {
  let count = 0;
  let remainingMask = mask;
  while (remainingMask) {
    remainingMask &= remainingMask - 1;
    count += 1;
  }
  return count;
};

/** A filled grid, built by shuffling the bands, stacks, and digits of one pattern. */
const createSudokuFullSolution = () => {
  const groups = [0, 1, 2];
  const rows = shuffle(groups).flatMap((band) =>
    shuffle(groups).map((row) => band * 3 + row)
  );
  const columns = shuffle(groups).flatMap((stack) =>
    shuffle(groups).map((column) => stack * 3 + column)
  );
  const digits = shuffle(SUDOKU_DIGITS.split(""));
  const pattern = (row, column) => (row * 3 + Math.floor(row / 3) + column) % 9;

  return rows
    .flatMap((row) => columns.map((column) => digits[pattern(row, column)]))
    .join("");
};

/**
 * Counts solutions up to `limit`. Carving only needs to know whether a second
 * answer exists, so the search stops as soon as it finds one.
 */
const countSudokuSolutions = (board, limit = 2) => {
  const rowMasks = Array.from({ length: 9 }, () => 0);
  const columnMasks = Array.from({ length: 9 }, () => 0);
  const boxMasks = Array.from({ length: 9 }, () => 0);

  for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
    const value = board[index];
    if (!value) continue;
    const row = Math.floor(index / 9);
    const column = index % 9;
    const box = sudokuBoxIndex(row, column);
    const digitMask = 1 << value;
    if (
      rowMasks[row] & digitMask ||
      columnMasks[column] & digitMask ||
      boxMasks[box] & digitMask
    ) {
      return 0;
    }
    rowMasks[row] |= digitMask;
    columnMasks[column] |= digitMask;
    boxMasks[box] |= digitMask;
  }

  let solutions = 0;
  const solve = () => {
    if (solutions >= limit) return;

    let bestIndex = -1;
    let bestMask = 0;
    let bestOptionCount = 10;
    for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
      if (board[index]) continue;
      const row = Math.floor(index / 9);
      const column = index % 9;
      const box = sudokuBoxIndex(row, column);
      const candidateMask =
        SUDOKU_FULL_DIGIT_MASK & ~(rowMasks[row] | columnMasks[column] | boxMasks[box]);
      const optionCount = countSudokuMaskBits(candidateMask);
      if (!optionCount) return;
      if (optionCount < bestOptionCount) {
        bestIndex = index;
        bestMask = candidateMask;
        bestOptionCount = optionCount;
        if (optionCount === 1) break;
      }
    }

    if (bestIndex === -1) {
      solutions += 1;
      return;
    }

    const row = Math.floor(bestIndex / 9);
    const column = bestIndex % 9;
    const box = sudokuBoxIndex(row, column);
    let candidateMask = bestMask;
    while (candidateMask && solutions < limit) {
      const digitMask = candidateMask & -candidateMask;
      const digit = Math.log2(digitMask);
      board[bestIndex] = digit;
      rowMasks[row] |= digitMask;
      columnMasks[column] |= digitMask;
      boxMasks[box] |= digitMask;
      solve();
      rowMasks[row] &= ~digitMask;
      columnMasks[column] &= ~digitMask;
      boxMasks[box] &= ~digitMask;
      board[bestIndex] = 0;
      candidateMask &= candidateMask - 1;
    }
  };

  solve();
  return solutions;
};

/**
 * Removes clues in a random order, keeping a removal only while the grid still
 * has one answer. Several attempts are made because a single carve can stall
 * above the clue target; the sparsest attempt wins.
 */
const createGeneratedSudokuPuzzle = (targetClues, maxAttempts) => {
  let bestPuzzle = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const solution = createSudokuFullSolution();
    const puzzleValues = solution.split("");
    let clueCount = SUDOKU_CELL_COUNT;

    shuffle(Array.from({ length: SUDOKU_CELL_COUNT }, (unusedCell, index) => index)).forEach(
      (index) => {
        if (clueCount <= targetClues) return;
        const removedValue = puzzleValues[index];
        puzzleValues[index] = "0";
        const board = puzzleValues.map((value) => Number(value));
        if (countSudokuSolutions(board, 2) === 1) {
          clueCount -= 1;
          return;
        }
        puzzleValues[index] = removedValue;
      }
    );

    const generatedPuzzle = { clues: clueCount, puzzle: puzzleValues.join(""), solution };
    if (!bestPuzzle || clueCount < bestPuzzle.clues) bestPuzzle = generatedPuzzle;
    if (clueCount <= targetClues) return generatedPuzzle;
  }

  return bestPuzzle;
};

self.addEventListener("message", (event) => {
  const { requestId, difficulty, targetClues, maxAttempts } = event.data || {};
  try {
    const generated = createGeneratedSudokuPuzzle(targetClues, maxAttempts);
    self.postMessage({ requestId, difficulty, ...generated });
  } catch (error) {
    self.postMessage({ requestId, difficulty, error: String(error?.message || error) });
  }
});
