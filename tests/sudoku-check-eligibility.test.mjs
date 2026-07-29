import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);

const readSudokuSources = async () => {
  const [home, dom, main, styles] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/sudoku.css", root), "utf8"),
  ]);
  return { home, dom, main, styles };
};

const sourceBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Unable to extract ${startMarker}`);
  return source.slice(start, end);
};

const plainObject = (value) => JSON.parse(JSON.stringify(value));

test("Sudoku exposes three checks, no reveal control, and an accessible Errors warning", async () => {
  const { home, dom, main } = await readSudokuSources();
  const hintOptions = sourceBetween(
    home,
    '<div class="sudoku-hint-options"',
    "\n                    </div>"
  );

  assert.equal(
    [...hintOptions.matchAll(/data-sudoku-hint=/g)].length,
    2,
    "Only Off and Errors may be available as Sudoku hint controls."
  );
  assert.match(hintOptions, /data-sudoku-hint="off"/);
  assert.match(hintOptions, /data-sudoku-hint="errors"/);
  assert.doesNotMatch(hintOptions, /data-sudoku-hint="reveal"/);
  assert.doesNotMatch(main, /const revealSudokuHint =|mode === "reveal"/);

  assert.match(main, /const SUDOKU_MAX_LEADERBOARD_CHECKS = 3;/);
  assert.match(
    home,
    /id="sudoku-leaderboard-checks"[^>]*>0\/3 allowed checks used to place on leaderboard<\/span>/
  );
  assert.match(
    main,
    /`\$\{sudokuState\.checksUsed\}\/\$\{SUDOKU_MAX_LEADERBOARD_CHECKS\} ` \+\s+"allowed checks used to place on leaderboard"/
  );

  const prompt = sourceBetween(
    home,
    '<dialog\n              class="sudoku-errors-prompt"',
    "\n            </dialog>"
  );
  assert.match(prompt, /role="alertdialog"/);
  assert.match(prompt, /aria-modal="true"/);
  assert.match(prompt, /aria-labelledby="sudoku-errors-prompt-title"/);
  assert.match(prompt, /aria-describedby="sudoku-errors-prompt-message"/);
  assert.match(prompt, /class="sudoku-solve-ball"[^>]*aria-hidden="true"/);
  assert.match(
    prompt,
    /Are you sure you would like to have errors revealed\? Doing so will disqualify you from the leaderboard\./
  );
  for (const binding of [
    "sudokuErrorsHint",
    "sudokuErrorsPrompt",
    "sudokuErrorsCancel",
    "sudokuErrorsConfirm",
  ]) {
    assert.match(dom, new RegExp(`\\b${binding}:`));
    assert.match(main, new RegExp(`\\b${binding}\\b`));
  }
  assert.match(
    main,
    /const trapSudokuErrorsPromptFocus = \(event\) => \{[\s\S]*?event\.key !== "Tab"[\s\S]*?lastControl\.focus\(\)[\s\S]*?firstControl\.focus\(\)/
  );
  assert.match(
    main,
    /sudokuErrorsPrompt\.addEventListener\("keydown", trapSudokuErrorsPromptFocus\)/
  );
});

test("Sudoku persists the quota and warning while legacy assists fail closed", async () => {
  const { main } = await readSudokuSources();
  const saveSource = sourceBetween(
    main,
    "const createSudokuSavePayload = () => ({",
    "\n\nconst flushSudokuSave ="
  );
  const restoreSource = sourceBetween(
    main,
    "const restoreSudokuSavedState = () => {",
    "\n\nconst updateSudokuTimeDisplay ="
  );
  const freshPuzzleSource = sourceBetween(
    main,
    "const loadSudokuDifficulty = (difficulty) => {",
    "\n\nconst getLifeCounterWindow ="
  );
  const historySource = sourceBetween(
    main,
    "const createSudokuHistoryEntry = () => ({",
    "\n\nconst areSudokuHistoryEntriesEqual ="
  );

  assert.match(saveSource, /version: 3,/);
  for (const field of ["usedHint", "usedReveal", "checksUsed", "errorsConfirmed"]) {
    assert.match(saveSource, new RegExp(`${field}: sudokuState\\.${field}`));
  }
  assert.match(restoreSource, /!\[1, 2, 3\]\.includes\(savedState\.version\)/);
  assert.match(
    restoreSource,
    /sudokuState\.usedHint = Boolean\(savedState\.usedHint \|\| savedState\.usedReveal\);/,
    "A legacy reveal must remain permanently classified as assisted."
  );
  assert.match(
    restoreSource,
    /sudokuState\.checksUsed = Math\.max\([\s\S]*?Math\.min\([\s\S]*?SUDOKU_MAX_LEADERBOARD_CHECKS[\s\S]*?savedState\.checksUsed/
  );
  assert.match(
    restoreSource,
    /sudokuState\.errorsConfirmed = Boolean\([\s\S]*?savedState\.errorsConfirmed[\s\S]*?savedState\.hintMode === "errors"[\s\S]*?savedState\.usedHint[\s\S]*?savedState\.usedReveal/
  );
  assert.match(
    restoreSource,
    /sudokuState\.statsSession = "";\s+sudokuState\.statsSessionEligible = false;/,
    "Restored games must remain quarantined from global publication."
  );

  for (const initializer of [
    /checksUsed: 0,/,
    /errorsConfirmed: false,/,
    /usedHint: false,/,
    /usedReveal: false,/,
    /hintMode: "off",/,
  ]) {
    assert.match(freshPuzzleSource, initializer);
  }
  assert.doesNotMatch(freshPuzzleSource, /previousHintMode/);
  assert.doesNotMatch(
    historySource,
    /checksUsed|errorsConfirmed|usedHint|usedReveal/,
    "Undo and redo must not restore checks or reverse leaderboard disqualification."
  );
});

test("Errors mode only latches assistance after a visible mistake", async () => {
  const { main } = await readSudokuSources();
  const feedbackSource = sourceBetween(
    main,
    "const refreshSudokuHintFeedback = () => {",
    "\n\nconst applySudokuHistoryEntry ="
  );
  const hintModeSource = sourceBetween(
    main,
    "const setSudokuHintMode = (mode) => {",
    "\n\nconst setSudokuNoteMode ="
  );
  const confirmationSource = sourceBetween(
    main,
    "const confirmSudokuErrors = () => {",
    "\n\nconst setSudokuNoteMode ="
  );

  assert.doesNotMatch(
    hintModeSource,
    /usedHint\s*=\s*true/,
    "Accepting or enabling Errors alone must not disqualify the puzzle."
  );
  assert.match(
    confirmationSource,
    /sudokuState\.errorsConfirmed = true;\s+hideSudokuErrorsPrompt\(\);\s+setSudokuHintMode\("errors"\);/
  );
  assert.doesNotMatch(confirmationSource, /usedHint\s*=\s*true/);
  assert.equal(
    [...main.matchAll(/sudokuState\.usedHint = true;/g)].length,
    1,
    "Only visible Errors feedback may latch the current puzzle as assisted."
  );

  const context = vm.createContext({});
  vm.runInContext(
    [
      "let sudokuState = { hintMode: 'errors', mistakes: 0, usedHint: false };",
      "let result = { complete: false, valid: true, mistakes: 0 };",
      "let markedCalls = 0;",
      "let saveCalls = 0;",
      "const clearSudokuHighlights = () => {};",
      "const updateSudokuMistakesDisplay = () => {};",
      "const scheduleSudokuSave = () => { saveCalls += 1; };",
      "const validateSudokuBoard = ({ mark = false } = {}) => { if (mark) markedCalls += 1; return { ...result }; };",
      feedbackSource,
      "globalThis.refreshForTest = refreshSudokuHintFeedback;",
      "globalThis.setResultForTest = (next) => { result = { ...next }; };",
      "globalThis.readForTest = () => ({ ...sudokuState, markedCalls, saveCalls });",
    ].join("\n"),
    context
  );

  context.refreshForTest();
  assert.deepEqual(plainObject(context.readForTest()), {
    hintMode: "errors",
    mistakes: 0,
    usedHint: false,
    markedCalls: 1,
    saveCalls: 0,
  });

  context.setResultForTest({ complete: false, valid: false, mistakes: 1 });
  context.refreshForTest();
  assert.deepEqual(plainObject(context.readForTest()), {
    hintMode: "errors",
    mistakes: 1,
    usedHint: true,
    markedCalls: 2,
    saveCalls: 1,
  });

  context.setResultForTest({ complete: false, valid: true, mistakes: 0 });
  context.refreshForTest();
  assert.deepEqual(plainObject(context.readForTest()), {
    hintMode: "errors",
    mistakes: 0,
    usedHint: true,
    markedCalls: 3,
    saveCalls: 1,
  });
});

test("three diagnostic checks reveal feedback but an exhausted check does not", async () => {
  const { main } = await readSudokuSources();
  const checkSource = sourceBetween(
    main,
    "const checkSudokuBoard = () => {",
    "\n\nconst renderSudoku ="
  );
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const SUDOKU_MAX_LEADERBOARD_CHECKS = 3;",
      "let sudokuState = {",
      "  checksUsed: 0, mistakes: 0, usedHint: false, usedReveal: false,",
      "  solved: false, completionRecorded: false, difficulty: 'easy', statsSession: 'verified-session'",
      "};",
      "let result = { complete: false, valid: false, mistakes: 1 };",
      "const observations = { markedCalls: 0, unmarkedCalls: 0, clears: 0, statuses: [], saves: 0, records: [] };",
      "const validateSudokuBoard = ({ mark = false } = {}) => {",
      "  if (mark) observations.markedCalls += 1; else observations.unmarkedCalls += 1;",
      "  return { ...result };",
      "};",
      "const clearSudokuHighlights = () => { observations.clears += 1; };",
      "const setSudokuStatus = (status) => { observations.statuses.push(status); };",
      "const scheduleSudokuSave = () => { observations.saves += 1; };",
      "const triggerSudokuCheckBubbleBurst = () => {};",
      "const triggerSudokuFullBubbleBurst = () => {};",
      "const triggerSudokuSolvedTileWave = () => {};",
      "const showSudokuSolvePopup = () => {};",
      "const pauseSudokuTimer = () => {};",
      "const currentSudokuElapsedSeconds = () => 42;",
      "const createGameStatsEvent = (event) => ({ ...event });",
      "const recordGameStatsEvent = (event, session, metadata) => { observations.records.push({ event, session, metadata }); };",
      "const triggerSudokuVictoryEffects = () => {};",
      "const triggerRandomEvents = () => {};",
      checkSource,
      "globalThis.checkForTest = checkSudokuBoard;",
      "globalThis.setResultForTest = (next) => { result = { ...next }; };",
      "globalThis.setMistakesForTest = (mistakes) => { sudokuState.mistakes = mistakes; };",
      "globalThis.readForTest = () => ({ state: { ...sudokuState }, observations: { ...observations, statuses: [...observations.statuses], records: observations.records.map((record) => ({ ...record })) } });",
    ].join("\n"),
    context
  );

  context.checkForTest();
  context.checkForTest();
  context.checkForTest();
  let snapshot = plainObject(context.readForTest());
  assert.equal(snapshot.state.checksUsed, 3);
  assert.equal(snapshot.state.mistakes, 1);
  assert.equal(snapshot.state.usedHint, false, "Allowed checks must not count as hint use.");
  assert.equal(snapshot.observations.unmarkedCalls, 3);
  assert.equal(snapshot.observations.markedCalls, 3);

  context.setMistakesForTest(0);
  context.setResultForTest({ complete: false, valid: false, mistakes: 4 });
  context.checkForTest();
  snapshot = plainObject(context.readForTest());
  assert.equal(snapshot.state.checksUsed, 3);
  assert.equal(snapshot.state.mistakes, 0, "An exhausted check must not reveal the hidden error count.");
  assert.equal(snapshot.observations.unmarkedCalls, 4);
  assert.equal(snapshot.observations.markedCalls, 3, "An exhausted check must not mark cells.");
  assert.equal(snapshot.observations.clears, 1);
  assert.equal(snapshot.observations.statuses.at(-1), "No checks remaining");

  context.setResultForTest({ complete: true, valid: true, mistakes: 0 });
  context.checkForTest();
  snapshot = plainObject(context.readForTest());
  assert.equal(snapshot.state.checksUsed, 3, "A winning submission must not consume a diagnostic check.");
  assert.equal(snapshot.state.solved, true);
  assert.equal(snapshot.state.completionRecorded, true);
  assert.equal(snapshot.observations.unmarkedCalls, 5);
  assert.equal(snapshot.observations.markedCalls, 3);
  assert.deepEqual(snapshot.observations.records, [
    {
      event: {
        game: "sudoku",
        type: "win",
        difficulty: "easy",
        hintBucket: "noHints",
        metric: 42,
        metricKind: "seconds",
      },
      session: "verified-session",
      metadata: { sudokuNoHintsSeconds: 42 },
    },
  ]);
});

test("Sudoku never leaks correctness feedback while a player enters digits", async () => {
  const { main, styles } = await readSudokuSources();
  assert.doesNotMatch(main, /is-correct/);
  assert.doesNotMatch(styles, /is-correct/);

  const feedbackSource = sourceBetween(
    main,
    "const syncSudokuCellFeedback = (input) => {",
    "\n\nconst refreshAllSudokuCells ="
  );
  assert.match(feedbackSource, /classList\.remove\("is-invalid"\)/);
  assert.doesNotMatch(feedbackSource, /sudokuState\.solution|getSudokuCellValue/);
});
