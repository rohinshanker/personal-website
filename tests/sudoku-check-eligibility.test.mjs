import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";

const root = new URL("../", import.meta.url);

const readSudokuSources = async () => {
  const [home, dom, main, styles] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readHomeScript("sudoku"),
    readHomeScript("sudoku"),
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

/** The one puzzle these tests solve, taken from the difficulty Sudoku ships. */
const PUZZLE = "402030000795020003001705400100004005609000000248507310900108500800050071017043092";
const SOLUTION = "462831957795426183381795426173984265659312748248567319926178534834259671517643892";

/**
 * A realm holding the real rule engine and the controller glue in front of it.
 * The eligibility rules — what a Check costs, when the assistance latch trips,
 * what Conflicts may read — now live in the engine, so these tests drive the
 * engine itself rather than a stand-in that could agree with the wrong answer.
 */
const createSudokuEngineRealm = async (extra = [], tail = []) => {
  const context = vm.createContext({});
  for (const path of ["scripts/home/games/rules.js", "scripts/home/games/sudoku.js"]) {
    vm.runInContext(await readFile(new URL(path, root), "utf8"), context);
  }
  const main = await readHomeScript("sudoku");
  vm.runInContext(
    [
      "const sudokuRules = homeSudokuRules;",
      "const createBudget = homeGameRules.createBudget;",
      "const SUDOKU_CELL_COUNT = 81;",
      "const SUDOKU_DIGITS = '123456789';",
      "const recordedInputs = [];",
      "let sudokuGame = null;",
      "let sudokuAppliedMoves = 0;",
      "let sudokuState = {};",
      "const recordedEvents = [];",
      `const sudokuStats = {
         recordInput: (action) => recordedInputs.push(action),
         recordEvent: (event, options) => recordedEvents.push({ event, options }),
       };`,
      "const normalizeSudokuSelectedIndex = (index) =>",
      "  Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < 81 ? Number(index) : -1;",
      "const sudokuCells = () => [];",
      "const refreshSudokuCellDisplay = () => {};",
      "const syncSudokuCellFeedback = () => {};",
      "const sudokuUndo = null;",
      "const sudokuRedo = null;",
      ...extra,
      sourceBetween(
        main,
        "/**\n * Writes the engine's puzzle onto the state",
        "\n\nconst formatSudokuTime ="
      ),
      `globalThis.startForTest = (overrides = {}) => {
         sudokuGame = sudokuRules.initial({
           difficulty: "easy", puzzle: ${JSON.stringify(PUZZLE)},
           solution: ${JSON.stringify(SOLUTION)}, ...overrides,
         });
         projectSudokuGame();
       };`,
      "globalThis.playForTest = (action) => applySudokuMove(JSON.parse(JSON.stringify(action)));",
      `globalThis.conflictsForTest = (puzzle, solution, values) =>
         sudokuRules.conflictIndexes(sudokuRules.initial({
           difficulty: "easy", puzzle, solution, values,
         }));`,
      "globalThis.engineForTest = () => sudokuRules;",
      "globalThis.gameForTest = () => sudokuGame;",
      "globalThis.inputsForTest = () => recordedInputs;",
      "globalThis.stateForTest = () => sudokuState;",
      ...tail,
    ].join("\n"),
    context
  );
  return context;
};

/**
 * Enters `digit` at `index`, or the solution's digit when none is given. A given
 * cell or a digit that happens to be the right one would make the move a no-op,
 * which is exactly the kind of silently weakened fixture worth failing on.
 */
const enter = (context, index, digit) => {
  assert.equal(PUZZLE[index], "0", `Cell ${index} is a given and cannot be entered`);
  const value = digit || SOLUTION[index];
  assert.equal(
    context.playForTest({ op: "setValue", index, value }),
    true,
    `Entering ${value} at ${index} changed nothing`
  );
};

/** Fills every blank correctly except the indexes listed, which go wrong. */
const fillBoard = (context, wrongIndexes = []) => {
  for (let index = 0; index < 81; index += 1) {
    if (PUZZLE[index] !== "0") continue;
    const correct = SOLUTION[index];
    const digit = wrongIndexes.includes(index)
      ? String((Number(correct) % 9) + 1)
      : correct;
    enter(context, index, digit);
  }
};

// Rendered Sudoku layout geometry lives in tests/ui/sudoku-desktop-layout.spec.mjs.
// The cache-busting reference is a literal contract, so it stays a source test.
test("Every entry point loads the current Sudoku stylesheet build", async () => {
  const [home, index] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  const reference = /styles\/home\/apps\/sudoku\.css\?v=[^"]+/;

  assert.match(home, reference);
  assert.match(index, reference);
});

test("Sudoku exposes three checks, no reveal control, and an accessible Errors warning", async () => {
  const { home, dom, main } = await readSudokuSources();
  const hintOptions = sourceBetween(
    home,
    '<div class="sudoku-hint-options"',
    "\n                    </div>"
  );

  assert.equal(
    [...hintOptions.matchAll(/data-sudoku-hint=/g)].length,
    3,
    "Only Off, Conflicts, and Errors may be available as Sudoku hint controls."
  );
  assert.match(hintOptions, /data-sudoku-hint="off"/);
  assert.match(hintOptions, /data-sudoku-hint="conflicts"/);
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
    assert.match(dom, new RegExp(`const ${binding} = `));
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
    "const adoptSudokuPuzzle = (difficulty, generated) => {",
    "\nconst loadSudokuDifficulty ="
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
    /sudokuState\.checksUsed = clampNumber\([\s\S]*?savedState\.checksUsed[\s\S]*?0,[\s\S]*?SUDOKU_MAX_LEADERBOARD_CHECKS/
  );
  assert.match(
    restoreSource,
    /sudokuState\.errorsConfirmed = Boolean\([\s\S]*?savedState\.errorsConfirmed[\s\S]*?savedState\.hintMode === "errors"[\s\S]*?savedState\.usedHint[\s\S]*?savedState\.usedReveal/
  );
  assert.match(
    restoreSource,
    /sudokuStats\.dropSession\(\);\s+sudokuState\.statsSessionEligible = !sudokuState\.completionRecorded;/,
    "A restored puzzle publishes only while its completion latch is still open."
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

  // Undo history holds the board and nothing else, so it cannot hand back a
  // spent allowance or reverse a leaderboard disqualification.
  const context = await createSudokuEngineRealm();
  context.startForTest({ errorsConfirmed: true, hintMode: "errors", checksUsed: 1 });
  enter(context, 1, "1");
  const latched = plainObject(context.stateForTest());
  assert.equal(latched.usedHint, true);
  assert.equal(latched.checksUsed, 1);
  assert.deepEqual(
    Object.keys(plainObject(context.gameForTest().undo[0])).sort(),
    ["notes", "selectedIndex", "values"]
  );
  context.playForTest({ op: "undo" });
  context.playForTest({ op: "redo" });
  const afterHistory = plainObject(context.stateForTest());
  assert.equal(afterHistory.usedHint, true);
  assert.equal(afterHistory.checksUsed, 1);
  assert.equal(afterHistory.errorsConfirmed, true);
});

test("Errors mode only latches assistance after a visible mistake", async () => {
  const { main } = await readSudokuSources();
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
  const feedbackSource = sourceBetween(
    main,
    "const refreshSudokuHintFeedback = () => {",
    "\n\n/** Shows the board the engine restored"
  );

  assert.doesNotMatch(
    hintModeSource,
    /usedHint\s*=\s*true/,
    "Accepting or enabling Errors alone must not disqualify the puzzle."
  );
  assert.match(
    hintModeSource,
    /if \(mode === "errors" && !sudokuState\.errorsConfirmed\)/,
    "Only Errors may demand the disqualifying confirmation."
  );
  assert.doesNotMatch(confirmationSource, /usedHint\s*=\s*true/);
  assert.doesNotMatch(
    main,
    /sudokuState\.usedHint = true/,
    "The latch belongs to the rule engine, so the controller cannot set it at all."
  );
  assert.doesNotMatch(
    feedbackSource,
    /usedHint|checksUsed|mistakes =/,
    "Painting the hint mode must not decide anything the rules own."
  );

  const context = await createSudokuEngineRealm();

  // Errors mode is refused outright until its warning has been accepted.
  context.startForTest();
  assert.equal(context.playForTest({ op: "setHintMode", mode: "errors" }), false);
  assert.equal(context.playForTest({ op: "confirmErrors" }), true);
  assert.equal(context.playForTest({ op: "setHintMode", mode: "errors" }), true);
  assert.equal(context.stateForTest().usedHint, false, "Accepting alone is not assistance.");
  assert.equal(context.stateForTest().mistakes, 0);

  // A correct entry marks nothing, so the latch stays open.
  enter(context, 2 * 9 + 0);
  assert.equal(context.stateForTest().usedHint, false);
  assert.equal(context.stateForTest().mistakes, 0);

  // The first visibly marked wrong value trips it, irreversibly.
  enter(context, 0 * 9 + 1, "1");
  assert.equal(context.stateForTest().mistakes, 1);
  assert.equal(context.stateForTest().usedHint, true);

  context.playForTest({ op: "clear", index: 0 * 9 + 1 });
  assert.equal(context.stateForTest().mistakes, 0, "The mark goes with the value.");
  assert.equal(context.stateForTest().usedHint, true, "Correcting it cannot take it back.");

  context.playForTest({ op: "setHintMode", mode: "off" });
  assert.equal(context.stateForTest().usedHint, true, "Nor can turning the mode off.");
  assert.equal(context.stateForTest().mistakes, 0, "Off hides the hidden mistake total.");

  context.playForTest({ op: "undo" });
  assert.equal(context.stateForTest().usedHint, true, "Nor can an undo.");
  assert.equal(
    context.engineForTest().result(context.gameForTest()).assistance,
    "withHints",
    "A latched puzzle leaves the no-hints bucket for good."
  );
});

test("Conflict mode reads the board alone and stays leaderboard eligible", async () => {
  const { main, styles } = await readSudokuSources();
  const conflictSource = sourceBetween(
    main,
    "const findSudokuConflictIndexes = () =>",
    "\n\nlet sudokuConflictCache ="
  );
  const marksSource = sourceBetween(
    main,
    "const refreshSudokuConflictMarks = () => {",
    "\n\n/**\n * Paints the current hint mode."
  );

  // Nothing on the conflict path may reach for the solution, the check quota,
  // the mistake count, or the assistance latch.
  for (const source of [conflictSource, marksSource]) {
    assert.doesNotMatch(source, /solution|usedHint|usedReveal|checksUsed|mistakes/);
  }
  assert.match(styles, /\.sudoku-grid \.sudoku-cell\.is-conflict \{/);

  const context = await createSudokuEngineRealm();
  const conflictsFor = (entries) => {
    const values = Array.from(PUZZLE, () => "0");
    Object.entries(entries).forEach(([index, value]) => {
      values[Number(index)] = value;
    });
    // A blank puzzle keeps the fixture honest: every value below is the player's,
    // so nothing here can be excused as a given.
    return plainObject(context.conflictsForTest(
      `${"0".repeat(80)}${SOLUTION[80]}`,
      SOLUTION,
      `${values.slice(0, 80).join("")}${SOLUTION[80]}`
    )).filter((index) => index !== 80);
  };

  assert.deepEqual(conflictsFor({}), []);
  // Row 0, then column 3, then box 0.
  assert.deepEqual(conflictsFor({ 0: "4", 5: "4" }), [0, 5]);
  assert.deepEqual(conflictsFor({ 3: "7", 30: "7" }), [3, 30]);
  assert.deepEqual(conflictsFor({ 0: "9", 10: "9" }), [0, 10]);
  // Every member of an over-filled unit is marked, on any number of axes.
  assert.deepEqual(conflictsFor({ 0: "2", 1: "2", 9: "2" }), [0, 1, 9]);
  // A value that shares no unit is never a conflict, however wrong it is: the
  // mode cannot tell, because it never looks at the solution.
  assert.deepEqual(conflictsFor({ 0: "1", 40: "1" }), []);

  // Marking conflicts costs nothing and latches nothing.
  context.startForTest();
  assert.equal(context.playForTest({ op: "setHintMode", mode: "conflicts" }), true);
  enter(context, 1, "4");
  const state = context.stateForTest();
  assert.equal(state.checksUsed, 0);
  assert.equal(state.usedHint, false);
  assert.equal(state.mistakes, 0, "Conflicts leaves the mistake count alone.");
  assert.equal(
    context.engineForTest().result(context.gameForTest()).assistance,
    "noHints",
    "A run that only used Conflicts stays eligible for the no-hints bucket."
  );
});

/**
 * Both check tests run the real `checkSudokuBoard` over the real rule engine, so
 * what a Check costs is decided by the rules rather than by a stand-in that could
 * agree with the wrong answer. Only the board's surroundings are stubbed.
 */
const createSudokuCheckContext = async (main) => {
  const context = await createSudokuEngineRealm([
    "const SUDOKU_MAX_LEADERBOARD_CHECKS = 3;",
    "const SUDOKU_COMPLETION_CLAIMS_KEY = 'sudoku-claims-test';",
    "const SUDOKU_MAX_COMPLETION_CLAIMS = 12;",
    "let storedClaims = null;",
    `const localStorage = {
       getItem: (key) => (key === SUDOKU_COMPLETION_CLAIMS_KEY && storedClaims ? JSON.stringify(storedClaims) : null),
       setItem: (key, value) => { if (key === SUDOKU_COMPLETION_CLAIMS_KEY) { storedClaims = JSON.parse(value); observations.claimWrites += 1; } },
     };`,
    "const observations = { markedCalls: 0, unmarkedCalls: 0, clears: 0, statuses: [], saves: 0, flushes: 0, claimWrites: 0, promptRefreshes: 0, bursts: 0 };",
    "const flushSudokuSave = () => { observations.flushes += 1; };",
    `const validateSudokuBoard = ({ mark = false } = {}) => {
       if (mark) observations.markedCalls += 1; else observations.unmarkedCalls += 1;
       const outcome = sudokuRules.evaluate(sudokuGame);
       return { complete: outcome.complete, mistakes: outcome.mistakes, valid: outcome.valid };
     };`,
    "const clearSudokuHighlights = () => { observations.clears += 1; };",
    "const setSudokuStatus = (status) => { observations.statuses.push(status); };",
    "const scheduleSudokuSave = () => { observations.saves += 1; };",
    "const triggerSudokuCheckBubbleBurst = () => { observations.bursts += 1; };",
    "const triggerSudokuFullBubbleBurst = () => {};",
    "const triggerSudokuSolvedTileWave = () => {};",
    "const showSudokuSolvePopup = () => {};",
    "const pauseSudokuTimer = () => {};",
    "const updateSudokuTimeDisplay = () => {};",
    "const currentSudokuElapsedSeconds = () => 42;",
    "const triggerSudokuVictoryEffects = () => {};",
    "const notifyActivity = () => {};",
    "const refreshSudokuFullBoardPrompt = () => { observations.promptRefreshes += 1; };",
  ], [
    sourceBetween(
      main,
      "const normalizeSudokuCompletionClaims = (claims) =>",
      "\n\nconst renderSudoku ="
    ),
    "globalThis.checkForTest = () => checkSudokuBoard();",
    "globalThis.setStoredClaimsForTest = (claims) => { storedClaims = claims; };",
    "globalThis.readStoredClaimsForTest = () => storedClaims;",
    "globalThis.syncStorageForTest = (event) => syncSudokuCompletionFromStorage(JSON.parse(JSON.stringify(event)));",
    // A finished board is terminal, so re-running a completion means telling both
    // the latch and the engine that this board is open again.
    "globalThis.reopenForTest = () => { sudokuState.completionRecorded = false; sudokuGame.solved = false; sudokuState.solved = false; };",
    "globalThis.recordsForTest = () => recordedEvents;",
    "globalThis.readForTest = () => ({ state: { ...sudokuState }, observations: { ...observations, statuses: [...observations.statuses] } });",
  ]);
  context.startForTest();
  Object.assign(context.stateForTest(), {
    puzzleId: "puzzle-a",
    difficulty: "easy",
    completionRecorded: false,
    statsSession: "verified-session",
  });
  return context;
};

test("three diagnostic checks reveal feedback but an exhausted check does not", async () => {
  const { main } = await readSudokuSources();
  const context = await createSudokuCheckContext(main);

  // One wrong entry, diagnosed three times.
  enter(context, 1, "1");
  context.checkForTest();
  context.checkForTest();
  context.checkForTest();
  let snapshot = plainObject(context.readForTest());
  assert.equal(snapshot.state.checksUsed, 3);
  assert.equal(snapshot.state.mistakes, 1);
  assert.equal(snapshot.state.usedHint, false, "Allowed checks must not count as hint use.");
  assert.equal(snapshot.observations.unmarkedCalls, 3);
  assert.equal(snapshot.observations.markedCalls, 3);

  // More mistakes, no allowance left to reveal them.
  enter(context, 3, "1");
  enter(context, 6, "1");
  enter(context, 7, "1");
  context.checkForTest();
  snapshot = plainObject(context.readForTest());
  assert.equal(snapshot.state.checksUsed, 3);
  assert.equal(snapshot.state.mistakes, 0, "An exhausted check must not reveal the hidden error count.");
  assert.equal(snapshot.observations.markedCalls, 3, "An exhausted check must not mark cells.");
  assert.equal(snapshot.observations.clears, 1);
  assert.equal(snapshot.observations.statuses.at(-1), "No checks remaining");

  // A complete and correct board is a submission, not a diagnostic.
  fillBoard(context);
  context.checkForTest();
  snapshot = plainObject(context.readForTest());
  assert.equal(snapshot.state.checksUsed, 3, "A winning submission must not consume a diagnostic check.");
  assert.equal(snapshot.state.solved, true);
  assert.equal(snapshot.state.completionRecorded, true);
  assert.equal(snapshot.observations.markedCalls, 3);

  const records = context.recordsForTest();
  assert.equal(records.length, 1);
  assert.deepEqual(plainObject(records[0].event), {
    type: "win",
    difficulty: "easy",
    hintBucket: "noHints",
    // The puzzle identity the Worker deduplicates on.
    puzzleId: "puzzle-a",
    puzzle: PUZZLE,
    metric: 42,
    metricKind: "seconds",
  });
  assert.equal(records[0].options.sudokuNoHintsSeconds, 42);
  assert.equal(
    typeof records[0].options.onCanonicalMetric,
    "function",
    "The server's elapsed time has somewhere to land."
  );
  assert.equal(
    snapshot.observations.flushes,
    1,
    "The latch must reach storage synchronously so other tabs see it."
  );
  assert.deepEqual(
    plainObject(context.readStoredClaimsForTest()),
    [{ puzzleId: "puzzle-a", puzzle: PUZZLE }],
    "A completion claims its puzzle in the append-only list."
  );
  assert.equal(snapshot.observations.claimWrites, 1);

  // Pressing Check on a finished board reopens its dialog and submits nothing.
  context.checkForTest();
  assert.equal(context.recordsForTest().length, 1);

  // Another tab already claimed this exact puzzle: latch, but stay local.
  context.reopenForTest();
  context.checkForTest();
  snapshot = plainObject(context.readForTest());
  assert.equal(snapshot.state.solved, true);
  assert.equal(snapshot.state.completionRecorded, true);
  assert.equal(context.recordsForTest().length, 1, "A puzzle claimed elsewhere must not publish again.");
  assert.equal(snapshot.observations.claimWrites, 1, "An existing claim is not rewritten.");
  assert.equal(snapshot.observations.flushes, 2);

  // A claim for a different puzzle does not block this one.
  context.reopenForTest();
  context.setStoredClaimsForTest([{ puzzleId: "puzzle-b", puzzle: "2".repeat(81) }]);
  context.checkForTest();
  assert.equal(context.recordsForTest().length, 2);
  assert.deepEqual(
    plainObject(context.readStoredClaimsForTest()),
    [
      { puzzleId: "puzzle-b", puzzle: "2".repeat(81) },
      { puzzleId: "puzzle-a", puzzle: PUZZLE },
    ]
  );

  // The storage event's payload is adopted directly, even when the stored list
  // has since been overwritten, so a stale save cannot re-arm the tab.
  context.reopenForTest();
  context.setStoredClaimsForTest(null);
  context.syncStorageForTest({
    key: "sudoku-claims-test",
    newValue: JSON.stringify([{ puzzleId: "puzzle-a", puzzle: PUZZLE }]),
  });
  assert.equal(
    plainObject(context.readForTest()).state.completionRecorded,
    true,
    "A claim carried by the event is adopted."
  );
  context.checkForTest();
  assert.equal(context.recordsForTest().length, 2, "An adopted claim keeps the completion local.");

  // Unrelated keys and other puzzles' claims leave an open latch alone.
  context.reopenForTest();
  context.syncStorageForTest({ key: "somethingElse", newValue: "x" });
  context.syncStorageForTest({
    key: "sudoku-claims-test",
    newValue: JSON.stringify([{ puzzleId: "puzzle-c", puzzle: "3".repeat(81) }]),
  });
  assert.equal(plainObject(context.readForTest()).state.completionRecorded, false);
});

test("a restored puzzle honours completion claims made by other tabs", async () => {
  const main = await readHomeScript("sudoku");
  const context = vm.createContext({});
  for (const path of ["scripts/home/games/rules.js", "scripts/home/games/sudoku.js"]) {
    vm.runInContext(await readFile(new URL(path, root), "utf8"), context);
  }
  vm.runInContext(
    [
      sourceBetween(main, "const SUDOKU_DIGITS = ", "const SUDOKU_FULL_DIGIT_MASK = ") +
        "const SUDOKU_FULL_DIGIT_MASK = 0b1111111110;",
      "const sudokuRules = homeSudokuRules;",
      "const createBudget = homeGameRules.createBudget;",
      "const clampNumber = (value, min, max) => Math.max(min, Math.min(value, max));",
      'const padTwoDigits = (value) => String(value).padStart(2, "0");',
      'const formatElapsedTime = (seconds, placeholder = "\u2014") =>',
      "  Number.isFinite(seconds)",
      '    ? `${padTwoDigits(Math.floor(Math.max(0, Math.floor(seconds)) / 60))}:${padTwoDigits(Math.max(0, Math.floor(seconds)) % 60)}`',
      "    : placeholder;",
      "const sudokuGrid = null;",
      "let sudokuCellElements = [];",
      "let sudokuGame = null;",
      "let sudokuAppliedMoves = 0;",
      "let sudokuState = { puzzleId: '', puzzle: '' };",
      "const restoreCalls = [];",
      `const sudokuStats = {
         dropSession: () => { sudokuState.statsSession = ''; },
         exportGame: () => null,
         recordInput: () => {},
         restoreGame: (saved) => { restoreCalls.push(saved); return restored; },
       };`,
      "let restored = null;",
      "const refreshSudokuCellDisplay = () => {};",
      "const syncSudokuCellFeedback = () => {};",
      "const sudokuUndo = null;",
      "const sudokuRedo = null;",
      "const storage = new Map();",
      `const localStorage = {
         getItem: (key) => (storage.has(key) ? storage.get(key) : null),
         setItem: (key, value) => { storage.set(key, String(value)); },
       };`,
      `const readJsonStorage = (getStorage, key, fallbackValue = null) => {
         try {
           const serialized = getStorage().getItem(key);
           return serialized === null ? fallbackValue : JSON.parse(serialized);
         } catch { return fallbackValue; }
       };`,
      sourceBetween(
        main,
        "const normalizeSudokuCompletionClaims = (claims) =>",
        "\n\nconst recordSudokuCompletion = () => {"
      ),
      sourceBetween(main, "const sudokuCells = () =>", "\n\nconst updateSudokuTimeDisplay ="),
      "globalThis.puzzles = SUDOKU_PUZZLES;",
      "globalThis.setSavedForTest = (saved) => { storage.set(SUDOKU_STORAGE_KEY, JSON.stringify(saved)); };",
      "globalThis.setClaimsForTest = (claims) => { storage.set(SUDOKU_COMPLETION_CLAIMS_KEY, JSON.stringify(claims)); };",
      "globalThis.setRestoredForTest = (descriptor) => { restored = descriptor; };",
      "globalThis.restoreCallsForTest = () => restoreCalls;",
      "globalThis.restoreForTest = () => restoreSudokuSavedState();",
      `globalThis.readForTest = () => ({
         completionRecorded: sudokuState.completionRecorded,
         statsSessionEligible: sudokuState.statsSessionEligible,
         puzzleId: sudokuState.puzzleId,
         session: sudokuState.statsSession || "",
         solved: sudokuState.solved,
       });`,
    ].join("\n"),
    context
  );
  const easy = plainObject(context.puzzles.easy);
  const medium = plainObject(context.puzzles.medium);
  const savedPuzzle = (entry, overrides = {}) => ({
    version: 3,
    difficulty: entry === easy ? "easy" : "medium",
    puzzleId: `${entry.id}-tab`,
    puzzle: entry.puzzle,
    solution: entry.solution,
    values: "",
    notes: [],
    elapsedSeconds: 90,
    solved: false,
    completionRecorded: false,
    ...overrides,
  });

  // An unfinished puzzle nobody has claimed resumes publishable.
  context.setSavedForTest(savedPuzzle(easy));
  assert.equal(context.restoreForTest(), true);
  assert.deepEqual(plainObject(context.readForTest()), {
    completionRecorded: false,
    statsSessionEligible: true,
    puzzleId: `${easy.id}-tab`,
    session: "",
    solved: false,
  });

  // The same unfinished save, once another tab has claimed it, stays local.
  context.setClaimsForTest([{ puzzleId: `${easy.id}-tab`, puzzle: easy.puzzle }]);
  assert.equal(context.restoreForTest(), true);
  assert.deepEqual(plainObject(context.readForTest()), {
    completionRecorded: true,
    statsSessionEligible: false,
    puzzleId: `${easy.id}-tab`,
    session: "",
    solved: false,
  });

  // A claim for a different puzzle does not latch this one.
  context.setSavedForTest(savedPuzzle(medium));
  assert.equal(context.restoreForTest(), true);
  assert.deepEqual(plainObject(context.readForTest()), {
    completionRecorded: false,
    statsSessionEligible: true,
    puzzleId: `${medium.id}-tab`,
    session: "",
    solved: false,
  });

  // A save that claims to be solved with an empty grid keeps its latch, but the
  // engine refuses the claim itself: the board is plainly unsolved.
  context.setSavedForTest(savedPuzzle(medium, { solved: true }));
  assert.equal(context.restoreForTest(), true);
  assert.deepEqual(plainObject(context.readForTest()), {
    completionRecorded: true,
    statsSessionEligible: false,
    puzzleId: `${medium.id}-tab`,
    session: "",
    solved: false,
  });

  // A save whose grid really is finished restores as the finished board it is.
  context.setSavedForTest(savedPuzzle(medium, { solved: true, values: medium.solution }));
  assert.equal(context.restoreForTest(), true);
  assert.equal(plainObject(context.readForTest()).solved, true);
});

test("a restored puzzle keeps verified provenance only for the board the server restores", async () => {
  const { main } = await readSudokuSources();
  const restoreSource = sourceBetween(
    main,
    "const adoptRestoredSudokuGame = (savedState) => {",
    "\n\nconst updateSudokuTimeDisplay ="
  );
  const saveSource = sourceBetween(
    main,
    "const createSudokuSavePayload = () => ({",
    "\n\nconst flushSudokuSave ="
  );

  assert.match(
    saveSource,
    /verified: sudokuStats\.exportGame\(\),/,
    "The issued game and its recorded inputs have to survive a reload."
  );

  // Restoring is a request. Treating it as a value was the defect: the saved
  // descriptor is the server's to confirm, and it confirms it later.
  assert.match(
    restoreSource,
    /const pending = sudokuStats\.restoreGame\(savedState\.verified\);/
  );
  assert.match(restoreSource, /Promise\.resolve\(pending\)\.then\(/);
  assert.doesNotMatch(
    restoreSource,
    /const restored = sudokuStats\.restoreGame/,
    "A promise must never be compared against a descriptor."
  );
  assert.match(
    restoreSource,
    /if \(sudokuGame !== owned\.game \|\| sudokuState\.puzzleId !== owned\.puzzleId\) return;/,
    "A puzzle replaced while the request was out owns the session now."
  );
  assert.match(
    restoreSource,
    /if \(!adoptIssuedSudokuReplay\(descriptor, savedState\.verified\?\.bufferedInputs\)\) \{\s+sudokuStats\.dropSession\(\);/,
    "A restoration the server refuses has to leave the attempt local-only."
  );
  // The replay has to land on the board the save shows, or the two are not the
  // same game and the player's board is what stays.
  assert.match(restoreSource, /if \(restored\.values !== saved\) return false;/);
  assert.match(
    restoreSource,
    /if \(restored\.notes\.join\("\|"\) !== sudokuState\.notes\.join\("\|"\)\) return false;/
  );
  assert.match(
    restoreSource,
    /if \(!sudokuState\.statsSessionEligible\) return;/,
    "A puzzle already recorded has nothing to restore."
  );
  // The board is rebuilt from the issued state and the replay, not from the save.
  assert.match(
    restoreSource,
    /descriptor\.initial\?\.puzzle !== sudokuState\.puzzle/
  );
  assert.match(
    restoreSource,
    /restored = sudokuRules\.initial\(descriptor\.initial\);/
  );
  assert.match(
    restoreSource,
    /\[\.\.\.\(descriptor\.inputs \|\| \[\]\), \.\.\.\(savedReplay \|\| \[\]\)\]/,
    "Both the acknowledged prefix and the buffered actions belong to the board."
  );

  // A board the server never issued cannot keep a proof it was handed.
  const issuedSource = sourceBetween(
    main,
    "const requestIssuedSudokuPuzzle = () => {",
    "\n\nconst adoptSudokuPuzzle ="
  );
  assert.match(
    issuedSource,
    /if \(sudokuAppliedMoves \|\| sudokuState\.solved\) \{\s+\/\/[\s\S]*?sudokuStats\.dropSession\(\);\s+return;/,
    "Anything played before issuance must drop the proof, not ignore it."
  );
  // The board cannot answer whether it was played on: accepting the Errors
  // warning, switching Notes or Conflicts on, and an entry that was undone all
  // leave `moves` and the undo stack at zero, while every one of them is already
  // recorded in the replay the server will verify.
  assert.doesNotMatch(
    issuedSource,
    /sudokuGame\.moves \|\| sudokuGame\.undo\.length/,
    "A guard that reads the board misses every change the board does not show."
  );
  const moveSource = sourceBetween(
    main,
    "const applySudokuMove = (action) => {",
    "\n\n/**\n * Brings the engine's idea"
  );
  assert.match(
    moveSource,
    /sudokuAppliedMoves \+= 1;\s+sudokuStats\.recordInput\(action\);/,
    "Every recorded change has to be counted, or the guard reads a stale zero."
  );
  // Cleared only where the board is replaced by one the proof does account for.
  assert.match(
    issuedSource,
    /sudokuGame = sudokuRules\.initial\(descriptor\.initial\);\s+sudokuAppliedMoves = 0;/
  );
  assert.match(
    restoreSource,
    /sudokuGame = sudokuRules\.initial\(restoredBoard\);\s+sudokuAppliedMoves = 0;/
  );
  assert.match(restoreSource, /sudokuGame = restored;\s+sudokuAppliedMoves = 0;/);
  const adoptSource = sourceBetween(
    main,
    "const adoptSudokuPuzzle = (difficulty, generated) => {",
    "\n\n/**\n * New Game and the difficulty buttons never block."
  );
  assert.match(adoptSource, /sudokuAppliedMoves = 0;/);
  assert.match(adoptSource, /requestIssuedSudokuPuzzle\(\);/);

  // The server's elapsed time reconciles the display without rewriting cleared
  // local data.
  const completionSource = sourceBetween(
    main,
    "const recordSudokuCompletion = () => {",
    "\n\nconst checkSudokuBoard ="
  );
  assert.match(
    completionSource,
    /onCanonicalMetric: \(\{ metric, metricKind, updateLocalStats = true \}\) => \{/
  );
  assert.match(completionSource, /if \(updateLocalStats\) flushSudokuSave\(\);/);
});

test("the production entry refuses a malformed digit rather than trimming it", async () => {
  const { main } = await readSudokuSources();

  // The save file's normaliser reads one character out of a stored grid, where
  // reaching past a stray character is right. An input is not a stored grid, so
  // the two tests are kept apart and the entry one is exact.
  const entrySource = sourceBetween(
    main,
    "const sudokuDigitInput = (value) => {",
    "\n\nconst normalizeSudokuDifficulty"
  );
  assert.match(entrySource, /value\.length !== 1/);
  const editSource = sourceBetween(
    main,
    "const updateSudokuCellValue = (",
    "\n\nconst toggleSudokuNote ="
  );
  assert.match(editSource, /const digit = sudokuDigitInput\(value\);/);
  assert.match(editSource, /if \(digit === null\) return;/);
  assert.doesNotMatch(
    editSource,
    /normalizeSudokuDigit/,
    "Trimming an input would accept a value the player never chose."
  );
  assert.match(
    sourceBetween(main, "const toggleSudokuNote = (", "\n\nconst applySudokuDigitToCell ="),
    /if \(!sudokuDigitInput\(digit\)\) return;/
  );

  const context = await createSudokuEngineRealm([
    "const isSudokuCellReadOnly = (cell) => Boolean(cell && cell.readOnly);",
    "const getSudokuCellValue = (cell) => sudokuState.values[cell.index] || '';",
    "const getSudokuCellNotes = (index) => sudokuState.notes[index] || '';",
    "const afterSudokuEdit = () => { edits += 1; };",
    "const focusNextSudokuEditableCell = () => {};",
    "let edits = 0;",
  ], [
    sourceBetween(main, "const sudokuDigitInput = (value) => {", "\n\nconst normalizeSudokuDifficulty"),
    sourceBetween(main, "const updateSudokuCellValue = (", "\n\nconst applySudokuDigitToCell ="),
    "globalThis.cellFor = (index) => ({ index, readOnly: false });",
    "globalThis.editFor = (index, value) => updateSudokuCellValue(cellFor(index), index, value);",
    "globalThis.clearFor = (index) => updateSudokuCellValue(cellFor(index), index, '', { clearEmptyNotes: true });",
    "globalThis.noteFor = (index, digit) => toggleSudokuNote(cellFor(index), index, digit);",
    "globalThis.editsForTest = () => edits;",
  ]);
  context.startForTest();
  const blank = Array.from({ length: 81 }, (unused, index) => index).find(
    (index) => PUZZLE[index] === "0"
  );

  for (const value of ["89", "123456789", "0", " 1", 1, null, ["1"]]) {
    context.editFor(blank, value);
    context.noteFor(blank, value);
  }
  const untouched = plainObject(context.stateForTest());
  assert.equal(untouched.values[blank], "", "No malformed value reached the board");
  assert.equal(untouched.notes[blank], "");
  assert.equal(context.editsForTest(), 0, "Nothing was treated as an edit");
  assert.equal(context.gameForTest().values.length, 81);

  // One digit, a pencil mark and a clear all still work.
  context.editFor(blank, SOLUTION[blank]);
  assert.equal(plainObject(context.stateForTest()).values[blank], SOLUTION[blank]);
  context.clearFor(blank);
  assert.equal(plainObject(context.stateForTest()).values[blank], "");
  context.noteFor(blank, "6");
  assert.equal(plainObject(context.stateForTest()).notes[blank], "6");
  context.clearFor(blank);
  assert.equal(plainObject(context.stateForTest()).notes[blank], "");
  assert.equal(context.gameForTest().values.length, 81);
});

test("a check that reveals no mistake is free and stays free once the quota is spent", async () => {
  const { main } = await readSudokuSources();
  const context = await createSudokuCheckContext(main);
  const readCheck = () => {
    const snapshot = plainObject(context.readForTest());
    return {
      bursts: snapshot.observations.bursts,
      checksUsed: snapshot.state.checksUsed,
      clears: snapshot.observations.clears,
      markedCalls: snapshot.observations.markedCalls,
      mistakes: snapshot.state.mistakes,
      status: snapshot.observations.statuses.at(-1),
      usedHint: snapshot.state.usedHint,
    };
  };

  // A clean but unfinished board: diagnosed, celebrated, and not counted.
  enter(context, 1);
  context.checkForTest();
  context.checkForTest();
  assert.deepEqual(readCheck(), {
    bursts: 2,
    checksUsed: 0,
    clears: 0,
    markedCalls: 2,
    mistakes: 0,
    status: "Ready",
    usedHint: false,
  });

  // Only the mistake-revealing checks spend the allowance.
  enter(context, 3, "1");
  enter(context, 6, "1");
  context.checkForTest();
  context.checkForTest();
  context.checkForTest();
  assert.deepEqual(readCheck(), {
    bursts: 2,
    checksUsed: 3,
    clears: 0,
    markedCalls: 5,
    mistakes: 2,
    status: "System alert",
    usedHint: false,
  });

  // With the quota spent, a clean board still validates and stays free.
  context.playForTest({ op: "clear", index: 3 });
  context.playForTest({ op: "clear", index: 6 });
  context.checkForTest();
  assert.deepEqual(readCheck(), {
    bursts: 3,
    checksUsed: 3,
    clears: 0,
    markedCalls: 6,
    mistakes: 0,
    status: "Ready",
    usedHint: false,
  });

  // A board with errors reports only the refusal and marks nothing.
  enter(context, 3, "1");
  enter(context, 6, "1");
  enter(context, 7, "1");
  enter(context, 8, "1");
  context.checkForTest();
  assert.deepEqual(readCheck(), {
    bursts: 3,
    checksUsed: 3,
    clears: 1,
    markedCalls: 6,
    mistakes: 0,
    status: "No checks remaining",
    usedHint: false,
  });
});

test("the Check button prompts while the board is full and unsolved", async () => {
  const { main, styles } = await readSudokuSources();
  const promptSource = sourceBetween(
    main,
    "let sudokuFullBoardPromptActive = false;",
    "\n\n// Marks the selected cell"
  );
  const highlightSource = sourceBetween(
    main,
    "const updateSudokuBoardHighlights = () => {",
    "\n\nconst selectSudokuCell ="
  );

  assert.match(
    highlightSource,
    /refreshSudokuFullBoardPrompt\(\);\n\};$/,
    "The prompt must ride the existing board-update path."
  );
  assert.doesNotMatch(
    promptSource,
    /focus\(\)|setSudokuStatus|updateSudokuNumberButtons|usedHint/,
    "The prompt is visual only: no focus, status, keypad, or latch change."
  );

  const context = vm.createContext({});
  vm.runInContext(
    [
      "const SUDOKU_CELL_COUNT = 81;",
      "const classes = new Set();",
      "let toggles = 0;",
      "const sudokuCheck = { classList: { toggle: (name, on) => {",
      "  toggles += 1;",
      "  if (on) classes.add(name); else classes.delete(name);",
      "} } };",
      "let sudokuState = { solved: false, values: Array.from({ length: 81 }, () => '') };",
      promptSource,
      "globalThis.refreshForTest = refreshSudokuFullBoardPrompt;",
      "globalThis.setBoardForTest = ({ filled = 81, solved = false } = {}) => {",
      "  sudokuState.solved = solved;",
      "  sudokuState.values = Array.from({ length: 81 }, (unused, index) => (index < filled ? '5' : ''));",
      "};",
      "globalThis.readForTest = () => ({ classes: [...classes], toggles });",
    ].join("\n"),
    context
  );

  const expectPrompt = (classes, toggles, message) => {
    assert.deepEqual(plainObject(context.readForTest()), { classes, toggles }, message);
  };

  context.refreshForTest();
  expectPrompt([], 0, "A partial board never touches the button.");

  context.setBoardForTest({ filled: 81 });
  context.refreshForTest();
  expectPrompt(["is-board-full"], 1, "A full unsolved board starts the prompt.");

  context.refreshForTest();
  expectPrompt(
    ["is-board-full"],
    1,
    "Later board updates must not restart the press mid-glow."
  );

  context.setBoardForTest({ filled: 80 });
  context.refreshForTest();
  expectPrompt([], 2, "Clearing a cell ends the prompt.");

  context.setBoardForTest({ filled: 81 });
  context.refreshForTest();
  expectPrompt(["is-board-full"], 3, "Filling the board again replays the press.");

  context.setBoardForTest({ filled: 81, solved: true });
  context.refreshForTest();
  expectPrompt([], 4, "Solving the puzzle ends the prompt.");

  assert.match(styles, /--sudoku-prompt-gold: #[0-9a-f]{6};/);
  assert.match(
    styles,
    /#sudoku-check\.is-board-full \{[\s\S]*?animation: sudoku-check-prompt-press [\d]+ms [a-z-]+ 2;[\s\S]*?box-shadow: var\(--sudoku-prompt-raised\), var\(--sudoku-prompt-glow\);/,
    "The glow must outlast the two presses."
  );
  assert.match(
    styles,
    /@keyframes sudoku-check-prompt-press \{[\s\S]*?var\(--sudoku-prompt-sunken\)[\s\S]*?var\(--sudoku-prompt-raised\)[\s\S]*?\n\}/,
    "The press must move through the sunken frame and back."
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\) \{\n  #sudoku-check\.is-board-full \{\n    animation: none;/,
    "Reduced motion keeps the glow and drops only the press."
  );
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
