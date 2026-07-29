import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSourceUrl = new URL("../scripts/home/main.js", import.meta.url);

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
    /if \(!sudokuState\.solved\) \{\s+sudokuState\.solved = true;\s+if \(!sudokuState\.completionRecorded\) \{\s+sudokuState\.completionRecorded = true;/
  );
  assert.ok(
    checkSource.indexOf("sudokuState.completionRecorded = true;") <
      checkSource.indexOf("recordGameStatsEvent("),
    "the completion latch must flip before the asynchronous record handoff starts"
  );
  assert.match(
    checkSource,
    /triggerRandomEvents\("gameWin", \{ game: "sudoku" \}\);\s+\}\s+scheduleSudokuSave\(\);/
  );

  const editableLifecycleSource = sourceBetween(
    source,
    "const applySudokuHistoryEntry = (entry) => {",
    "\n\nconst checkSudokuBoard = () => {"
  );
  assert.doesNotMatch(
    editableLifecycleSource,
    /completionRecorded/,
    "undo, redo, notes, and cell edits must not re-arm a completed puzzle"
  );
});

test("Sudoku persists the completion latch and quarantines restored games", async () => {
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
    /sudokuState\.statsSession = "";\s+sudokuState\.statsSessionEligible = false;/,
    "a restored puzzle must remain ineligible for global publication"
  );
});

test("only fresh Sudoku puzzle creation clears the completion latch", async () => {
  const source = await readMainSource();
  const loadSource = sourceBetween(
    source,
    "const loadSudokuDifficulty = (difficulty) => {",
    "\n\nconst getLifeCounterWindow = () =>"
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
