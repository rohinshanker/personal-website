import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { homeScriptUrl } from "./helpers/home-scripts.mjs";

const mainSourceUrl = homeScriptUrl("sudoku");

const readMainSource = () => readFile(mainSourceUrl, "utf8");

const sourceBetween = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
};

test("Sudoku records at most one completion for each generated puzzle", async () => {
  const source = await readMainSource();
  const checkSource = sourceBetween(
    source,
    "const checkSudokuBoard = () => {",
    "\n\nconst renderSudoku = () => {"
  );

  assert.match(
    checkSource,
    /if \(!sudokuState\.completionRecorded\) \{\s+sudokuState\.completionRecorded = true;\s+const recordedByAnotherTab = isSudokuCompletionRecordedInStorage\(\);\s+claimSudokuCompletion\(\);\s+flushSudokuSave\(\);\s+if \(!recordedByAnotherTab\) recordSudokuCompletion\(\);\s+\}\s+scheduleSudokuSave\(\);/,
    "the latch must flip and flush to storage before the record handoff, and a completion another tab already recorded must stay local"
  );
  assert.match(
    checkSource,
    /if \(sudokuState\.solved\) \{\s+showSudokuSolvePopup\(\);\s+refreshSudokuFullBoardPrompt\(\);\s+return;/,
    "a finished board is terminal: Check reopens its dialog and submits nothing"
  );
  assert.match(
    checkSource,
    /if \(!applySudokuMove\(\{ op: "check" \}\)\) return;/,
    "the rule engine spends the allowance and decides the board is finished"
  );
  assert.doesNotMatch(checkSource, /recordGameStatsEvent\(/);

  const recordSource = sourceBetween(
    source,
    "const recordSudokuCompletion = () => {",
    "\n\nconst checkSudokuBoard = () => {"
  );
  assert.match(recordSource, /sudokuStats\.recordEvent\(/);
  assert.match(recordSource, /notifyActivity\("gameWin", \{ game: "sudoku" \}\);/);
  assert.doesNotMatch(recordSource, /completionRecorded/);

  const storageSyncSource = sourceBetween(
    source,
    "const normalizeSudokuCompletionClaims = (claims) =>",
    "\n\nconst recordSudokuCompletion = () => {"
  );
  assert.match(
    storageSyncSource,
    /claims\.some\(\(claim\) => claim\.puzzleId === puzzleId && claim\.puzzle === puzzle\)/,
    "another tab's claim counts only for the identical puzzle"
  );
  assert.doesNotMatch(
    storageSyncSource,
    /SUDOKU_STORAGE_KEY/,
    "claims must live apart from the mutable save slot so stale saves cannot erase them"
  );
  assert.match(
    storageSyncSource,
    /event\.key === SUDOKU_COMPLETION_CLAIMS_KEY\s+\? parseSudokuCompletionClaims\(event\.newValue\)/,
    "a tab adopts the claim carried by the storage event rather than rereading storage"
  );
  assert.match(source, /window\.addEventListener\("storage", syncSudokuCompletionFromStorage\);/);
  assert.match(
    sourceBetween(source, "const restoreSudokuSavedState = () => {", "\n\nconst updateSudokuTimeDisplay ="),
    /if \(isSudokuCompletionClaimed\(readSudokuCompletionClaims\(\), puzzleId, puzzle\)\) \{\s+sudokuState\.completionRecorded = true;/,
    "a restored puzzle honours a completion claimed by another tab"
  );

  const editableLifecycleSource = sourceBetween(
    source,
    "/** Shows the board the engine restored, after an undo or a redo. */",
    "\n\n// Every tab shares one saved puzzle."
  );
  assert.doesNotMatch(
    editableLifecycleSource,
    /completionRecorded/,
    "undo, redo, notes, and cell edits must not re-arm a completed puzzle"
  );
});

test("Sudoku persists the completion latch and gates restored publication on it", async () => {
  const source = await readMainSource();
  const saveSource = sourceBetween(
    source,
    "const createSudokuSavePayload = () => ({",
    "\n\nconst flushSudokuSave = () => {"
  );
  const restoreSource = sourceBetween(
    source,
    "const restoreSudokuSavedState = () => {",
    "\n\nconst updateSudokuTimeDisplay = () => {"
  );

  assert.match(
    saveSource,
    /completionRecorded: sudokuState\.completionRecorded/
  );
  assert.match(
    restoreSource,
    /sudokuState\.completionRecorded = Boolean\(\s+savedState\.completionRecorded \|\| savedState\.solved\s+\);/,
    "legacy solved saves must restore as already recorded"
  );
  assert.match(
    restoreSource,
    /sudokuStats\.dropSession\(\);\s+sudokuState\.statsSessionEligible = !sudokuState\.completionRecorded;/,
    "a restored unsolved puzzle must request a fresh verified session; a recorded one must not"
  );
});

test("only fresh Sudoku puzzle creation clears the completion latch", async () => {
  const source = await readMainSource();
  const loadSource = sourceBetween(
    source,
    "const adoptSudokuPuzzle = (difficulty, generated) => {",
    "\nconst loadSudokuDifficulty ="
  );
  const falseInitializers = source.match(/completionRecorded:\s*false/g) || [];

  assert.equal(
    falseInitializers.length,
    2,
    "only initial state and a genuinely new generated puzzle may clear the latch"
  );
  assert.match(loadSource, /solved: false,\s+completionRecorded: false,/);
  assert.doesNotMatch(source, /completionRecorded\s*=\s*false/);
});


test("starting the clock reports its boundary and never opens an unverified session", async () => {
  const source = await readMainSource();
  const timer = sourceBetween(source, "const startSudokuTimer =", "const pauseSudokuTimer =");

  // A result is verified against the board the server issued, so there is no
  // session left for the clock to open: the only thing it reports is where the
  // clock started, which is what makes the published time trustworthy.
  assert.doesNotMatch(
    source,
    /ensureSession/,
    "The controller must not fall back to an unverified session."
  );

  for (const [eligible, recorded] of [
    [true, false],
    [true, true],
    [false, false],
    [false, true],
  ]) {
    const resumes = [];
    const state = {
      difficulty: "easy", solved: false, timerId: null,
      statsSessionEligible: eligible, completionRecorded: recorded,
    };
    const context = vm.createContext({
      sudokuState: state,
      sudokuStats: { resumeGame: () => resumes.push(true) },
      Date: { now: () => 100 },
      window: { setInterval: () => 17 },
      SUDOKU_TIMER_INTERVAL_MS: 1_000,
      updateSudokuTimeDisplay: () => {},
    });
    vm.runInContext(`${timer}\nstartSudokuTimer();`, context);
    assert.deepEqual(resumes, [true]);
    assert.equal(state.timerId, 17);
    assert.equal(state.timerStartedAt, 100);
  }
});
