import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Sudoku keeps desktop controls beside the board in the requested order", async () => {
  const [home, index, styles] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("styles/home/apps/sudoku.css", root), "utf8"),
  ]);
  const boardColumnStart = home.indexOf('<div class="sudoku-board-column">');
  const controlPanelStart = home.indexOf('<div class="sudoku-control-panel" aria-label="Sudoku controls">');
  const numbersStart = home.indexOf('<span class="sudoku-panel-label">Numbers</span>');
  const difficultyStart = home.indexOf('<span class="sudoku-panel-label">Difficulty</span>');
  const hintsStart = home.indexOf('<span class="sudoku-panel-label">Hints</span>');
  const actionsStart = home.indexOf('<div class="sudoku-actions">', controlPanelStart);

  assert.ok(boardColumnStart >= 0, "Sudoku should have a board column");
  assert.ok(controlPanelStart > boardColumnStart, "the control panel should follow the board");
  assert.ok(numbersStart > controlPanelStart, "Numbers should be in the control panel");
  assert.ok(difficultyStart > numbersStart, "Difficulty should follow Numbers");
  assert.ok(hintsStart > difficultyStart, "Hints should follow Difficulty");
  assert.ok(actionsStart > hintsStart, "actions should follow Hints in the control panel");
  assert.match(home, /sudoku\.css\?v=sudoku-desktop-controls-20260722/);
  assert.match(index, /sudoku\.css\?v=sudoku-desktop-controls-20260722/);
  assert.doesNotMatch(
    home.slice(boardColumnStart, controlPanelStart),
    /id="sudoku-(?:new|undo|redo|check)"/,
    "actions must not remain below the board on desktop"
  );
  assert.match(home.slice(actionsStart), /id="sudoku-new"[\s\S]*?id="sudoku-undo"[\s\S]*?id="sudoku-redo"[\s\S]*?id="sudoku-check"/);
  assert.match(
    styles,
    /\.sudoku-game-content \{[\s\S]*?grid-template-columns: max-content minmax\(168px, 1fr\);[\s\S]*?align-items: stretch;/
  );
  assert.match(styles, /\.sudoku-window \{[\s\S]*?width: min\(94vw, 660px\);/);
  assert.match(
    styles,
    /@container \(min-width: 541px\) \{[\s\S]*?\.sudoku-control-panel \{[\s\S]*?grid-template-rows: auto auto auto minmax\(0, 1fr\);[\s\S]*?\.sudoku-control-panel \.sudoku-actions \{[\s\S]*?align-self: end;/
  );
  assert.match(
    styles,
    /@container \(max-width: 540px\) \{[\s\S]*?\.sudoku-game-content \{[\s\S]*?grid-template-columns: 1fr;[\s\S]*?\.sudoku-control-panel \.sudoku-actions \{[\s\S]*?grid-column: 1 \/ -1;/
  );
  assert.match(
    styles,
    /\.sudoku-statusbar \{[\s\S]*?grid-template-columns: minmax\(96px, 1fr\) 82px 90px;/,
    "mistakes and timer need fixed tracks so timer digits cannot shift adjacent items"
  );
  assert.match(
    styles,
    /#sudoku-mistakes,[\s\S]*?#sudoku-time,[\s\S]*?#sudoku-leaderboard-checks \{[\s\S]*?font-variant-numeric: tabular-nums;/
  );
  assert.match(
    styles,
    /#sudoku-leaderboard-checks \{[\s\S]*?grid-column: 1 \/ -1;/
  );
  assert.match(
    home,
    /id="sudoku-leaderboard-checks"[^>]*>0\/3 allowed checks used to place on leaderboard<\/span>/
  );
});
