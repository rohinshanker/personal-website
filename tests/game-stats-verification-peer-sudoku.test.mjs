import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { canonicalSudokuHintBucket } from
  "../workers/game-stats/src/verified-results.mjs";

const sudokuEngineUrl = new URL("../scripts/home/games/sudoku.js", import.meta.url);
const hasPeerSudokuEngine = existsSync(sudokuEngineUrl);
const puzzle =
  "402030000795020003001705400100004005609000000248507310900108500800050071017043092";
const solution =
  "462831957795426183381795426173984265659312748248567319926178534834259671517643892";

test("real Sudoku clean and assisted results map to the canonical hint buckets", {
  skip: hasPeerSudokuEngine ? false : "Stream B Sudoku engine is not integrated in this worktree",
}, async () => {
  await import(sudokuEngineUrl);
  const scenarios = [
    { usedHint: false, checksUsed: 2, expected: "noHints" },
    { usedHint: true, checksUsed: 0, expected: "withHints" },
  ];
  for (const { usedHint, checksUsed, expected } of scenarios) {
    const state = globalThis.homeSudokuRules.initial({
      rngState: 0,
      difficulty: "easy",
      puzzle,
      solution,
      values: solution,
      usedHint,
      checksUsed,
      solved: true,
    });
    const result = globalThis.homeSudokuRules.result(state);
    assert.equal(result.assistance, expected);
    assert.equal(result.assistanceCount, checksUsed);
    assert.equal(canonicalSudokuHintBucket(result), expected);
  }
});
