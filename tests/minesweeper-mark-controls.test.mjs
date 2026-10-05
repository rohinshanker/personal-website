import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { plain, sourceBetween } from "./helpers/source-runtime.mjs";

const root = new URL("../", import.meta.url);

const createHarness = async () => {
  const source = await readHomeScript("minesweeper");
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const makeButton = (mode) => { const classes = new Set(); const attrs = new Map([['aria-pressed', 'false']]); return { dataset: { msMarkMode: mode }, hidden: true, classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } }, getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; }, setAttribute(name, value) { attrs.set(name, String(value)); }, read() { return { active: classes.has('is-active'), ariaPressed: this.getAttribute('aria-pressed'), hidden: this.hidden }; } }; };",
      "const msFlagMode = makeButton('flag');",
      "const msQuestionMode = makeButton('question');",
      "const msControlsMode = { value: '' };",
      "const gridAttributes = new Map([['aria-keyshortcuts', 'S D F']]);",
      "const msGrid = { getAttribute: (name) => gridAttributes.has(name) ? gridAttributes.get(name) : null, setAttribute: (name, value) => gridAttributes.set(name, String(value)), removeAttribute: (name) => gridAttributes.delete(name) };",
      "const makeCell = () => ({ revealed: false, flagged: false, question: false });",
      "const msState = { markMode: null, gameOver: false, flagCount: 0, cells: [makeCell(), makeCell(), makeCell()] };",
      "let renders = 0; let counterUpdates = 0;",
      "const msRenderCell = () => { renders += 1; };",
      "const msUpdateCounters = () => { counterUpdates += 1; };",
      sourceBetween(source, "const msSetMarkMode =", "\n\nconst msReadTimerClocks"),
      sourceBetween(source, "const msToggleFlag =", "\n\nconst msChord"),
      "globalThis.api = { msSetMarkMode, msSetMobileControlsVisible, msSetControlsMode, msToggleFlag, msToggleMark };",
      "globalThis.seedCell = (index, updates) => Object.assign(msState.cells[index], updates);",
      "globalThis.setFlagCount = (value) => { msState.flagCount = value; };",
      "globalThis.setGameOver = (value) => { msState.gameOver = value; };",
      "globalThis.read = () => ({ cells: msState.cells, controlsMode: msControlsMode.value, counterUpdates, flag: msFlagMode.read(), flagCount: msState.flagCount, gridShortcut: msGrid.getAttribute('aria-keyshortcuts'), markMode: msState.markMode, question: msQuestionMode.read(), renders });",
    ].join("\n"),
    context
  );
  return context;
};

test("Minesweeper keeps accessible mark-control wiring and assets", async () => {
  const home = await readFile(new URL("home.html", root), "utf8");
  assert.match(home, /id="ms-flag-mode"[^>]*data-ms-mark-mode="flag"[^>]*aria-pressed="false"/);
  assert.match(home, /id="ms-question-mode"[^>]*data-ms-mark-mode="question"[^>]*aria-pressed="false"/);
  assert.match(home, /id="ms-controls-mode"[^>]*aria-label="Control mode"/);
  assert.match(home, /id="ms-grid"[^>]*aria-keyshortcuts="S D F"/);
  assert.match(home, /Press <kbd>S<\/kbd> to click the current square\./);
  assert.match(home, /Press <kbd>D<\/kbd> to maybe the current square\./);
  assert.match(home, /Press <kbd>F<\/kbd> to flag the current square\./);
  assert.match(home, /href="styles\/home\/apps\/minesweeper\.css\?v=[^"]+"/);
  assert.match(home, /src="scripts\/home\/features\/minesweeper\.js\?v=[^"]+"/);

  await Promise.all([
    access(new URL("assets/minesweeper_assets/tiles/tile_flag.png", root)),
    access(new URL("assets/minesweeper_assets/tiles/tile_question.png", root)),
    access(new URL("assets/app-icons/ico/mouse_ms.ico", root)),
  ]);
});

test("production control-mode functions expose only the selected input mode", async () => {
  const context = await createHarness();
  context.api.msSetControlsMode("mobile");
  assert.deepEqual(plain(context.read()), {
    cells: [
      { revealed: false, flagged: false, question: false },
      { revealed: false, flagged: false, question: false },
      { revealed: false, flagged: false, question: false },
    ],
    controlsMode: "mobile",
    counterUpdates: 0,
    flag: { active: false, ariaPressed: "false", hidden: false },
    flagCount: 0,
    gridShortcut: null,
    markMode: null,
    question: { active: false, ariaPressed: "false", hidden: false },
    renders: 0,
  });

  context.api.msSetMarkMode("flag");
  assert.equal(context.read().flag.active, true);
  assert.equal(context.read().flag.ariaPressed, "true");
  context.api.msSetMarkMode("flag");
  assert.equal(context.read().markMode, null);
  assert.equal(context.read().flag.ariaPressed, "false");
  context.api.msSetMarkMode("question");
  assert.equal(context.read().flag.ariaPressed, "false");
  assert.equal(context.read().question.ariaPressed, "true");

  context.api.msSetControlsMode("mouse");
  assert.equal(context.read().controlsMode, "mouse");
  assert.equal(context.read().gridShortcut, null);
  assert.equal(context.read().markMode, null);
  assert.equal(context.read().flag.hidden, true);
  assert.equal(context.read().question.hidden, true);

  context.api.msSetControlsMode("unsupported");
  assert.equal(context.read().controlsMode, "keyboard");
  assert.equal(context.read().gridShortcut, "S D F");
  assert.equal(context.read().markMode, null);
  assert.equal(context.read().flag.hidden, true);
  assert.equal(context.read().question.hidden, true);
});

test("production mark functions keep per-cell states and flag arithmetic consistent", async () => {
  const context = await createHarness();
  context.api.msToggleMark(0, "flag");
  assert.deepEqual(plain(context.read().cells[0]), {
    revealed: false,
    flagged: true,
    question: false,
  });
  assert.equal(context.read().flagCount, 1);
  assert.equal(context.read().counterUpdates, 1);

  context.api.msToggleMark(1, "question");
  assert.equal(context.read().flagCount, 1);
  context.api.msToggleMark(1, "flag");
  assert.deepEqual(plain(context.read().cells[1]), {
    revealed: false,
    flagged: true,
    question: false,
  });
  assert.equal(context.read().flagCount, 2);

  context.api.msToggleMark(0, "question");
  assert.deepEqual(plain(context.read().cells[0]), {
    revealed: false,
    flagged: false,
    question: true,
  });
  assert.equal(context.read().flagCount, 1);
  context.api.msToggleMark(0, "flag");
  assert.deepEqual(plain(context.read().cells[0]), {
    revealed: false,
    flagged: true,
    question: false,
  });
  assert.equal(context.read().flagCount, 2);
  context.api.msToggleMark(0, "flag");
  assert.equal(context.read().cells[0].flagged, false);
  assert.equal(context.read().flagCount, 1);

  context.api.msToggleMark(2, "unsupported");
  assert.deepEqual(plain(context.read().cells[2]), {
    revealed: false,
    flagged: false,
    question: false,
  });

  context.api.msToggleFlag(2);
  assert.equal(context.read().cells[2].flagged, true);
  assert.equal(context.read().flagCount, 2);
  context.api.msToggleFlag(2);
  assert.equal(context.read().cells[2].flagged, false);
  assert.equal(context.read().cells[2].question, true);
  assert.equal(context.read().flagCount, 1);
  context.api.msToggleFlag(2);
  assert.equal(context.read().cells[2].question, false);
  assert.equal(context.read().flagCount, 1);
  assert.equal(context.read().renders, 9);
  assert.equal(context.read().counterUpdates, 9);
});

test("production mark guards leave revealed and game-over cells unchanged", async () => {
  const context = await createHarness();
  context.seedCell(0, { revealed: true });
  context.api.msToggleMark(0, "flag");
  assert.deepEqual(plain(context.read().cells[0]), {
    revealed: true,
    flagged: false,
    question: false,
  });

  context.seedCell(1, { flagged: true });
  context.setFlagCount(1);
  context.setGameOver(true);
  context.api.msToggleFlag(1);
  assert.deepEqual(plain(context.read().cells[1]), {
    revealed: false,
    flagged: true,
    question: false,
  });
  assert.equal(context.read().flagCount, 1);
  assert.equal(context.read().renders, 0);
  assert.equal(context.read().counterUpdates, 0);
});
