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
      "const makeButton = (mode) => { const classes = new Set(); const attrs = new Map(); return { dataset: { msMarkMode: mode }, hidden: true, classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } }, setAttribute(name, value) { attrs.set(name, String(value)); }, read() { return { active: classes.has('is-active'), ariaPressed: attrs.get('aria-pressed'), hidden: this.hidden }; } }; };",
      "const msFlagMode = makeButton('flag');",
      "const msQuestionMode = makeButton('question');",
      "const msControlsMode = { value: '' };",
      "const gridAttributes = new Map();",
      "const msGrid = { setAttribute: (name, value) => gridAttributes.set(name, value), removeAttribute: (name) => gridAttributes.delete(name) };",
      "const msState = { markMode: null, gameOver: false, flagCount: 0, cells: [{ revealed: false, flagged: false, question: false }] };",
      "let renders = 0; let counterUpdates = 0;",
      "const msRenderCell = () => { renders += 1; };",
      "const msUpdateCounters = () => { counterUpdates += 1; };",
      sourceBetween(source, "const msSetMarkMode =", "\n\nconst msReadTimerClocks"),
      sourceBetween(source, "const msToggleFlag =", "\n\nconst msChord"),
      "globalThis.api = { msSetMarkMode, msSetMobileControlsVisible, msSetControlsMode, msToggleFlag, msToggleMark };",
      "globalThis.read = () => ({ cell: msState.cells[0], controlsMode: msControlsMode.value, counterUpdates, flag: msFlagMode.read(), gridShortcut: gridAttributes.get('aria-keyshortcuts') || null, markMode: msState.markMode, question: msQuestionMode.read(), renders });",
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
    cell: { revealed: false, flagged: false, question: false },
    controlsMode: "mobile",
    counterUpdates: 0,
    flag: { active: false, hidden: false },
    gridShortcut: null,
    markMode: null,
    question: { active: false, hidden: false },
    renders: 0,
  });

  context.api.msSetMarkMode("flag");
  assert.equal(context.read().flag.active, true);
  assert.equal(context.read().flag.ariaPressed, "true");
  context.api.msSetMarkMode("question");
  assert.equal(context.read().flag.ariaPressed, "false");
  assert.equal(context.read().question.ariaPressed, "true");

  context.api.msSetControlsMode("keyboard");
  assert.equal(context.read().controlsMode, "keyboard");
  assert.equal(context.read().gridShortcut, "S D F");
  assert.equal(context.read().markMode, null);
  assert.equal(context.read().flag.hidden, true);
  assert.equal(context.read().question.hidden, true);
});

test("production mark functions keep flag counts and modes mutually exclusive", async () => {
  const context = await createHarness();
  context.api.msToggleMark(0, "flag");
  assert.deepEqual(plain(context.read().cell), {
    revealed: false,
    flagged: true,
    question: false,
  });
  assert.equal(context.read().counterUpdates, 1);

  context.api.msToggleMark(0, "question");
  assert.deepEqual(plain(context.read().cell), {
    revealed: false,
    flagged: false,
    question: true,
  });
  assert.equal(context.read().counterUpdates, 2);

  context.api.msToggleFlag(0);
  assert.deepEqual(plain(context.read().cell), {
    revealed: false,
    flagged: false,
    question: false,
  });
  context.api.msToggleFlag(0);
  assert.equal(context.read().cell.flagged, true);
  assert.equal(context.read().renders, 4);
});
