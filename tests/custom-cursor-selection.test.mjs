import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [script, styles, home, index] = await Promise.all([
  readFile(new URL("scripts/home/text-selection-cursor.js", root), "utf8"),
  readFile(new URL("styles/home/cursors.css", root), "utf8"),
  readFile(new URL("home.html", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
]);

const getCssBlock = (selector) => {
  const start = styles.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing CSS block for ${selector}`);
  const end = styles.indexOf("}\n", start);
  assert.notEqual(end, -1, `Missing CSS block end for ${selector}`);
  return styles.slice(start, end + 1);
};

test("both entry points load the shared text-selection cursor behavior", () => {
  for (const source of [home, index]) {
    assert.match(source, /cursors\.css\?v=text-selection-cursor-20260806/);
    assert.match(
      source,
      /scripts\/home\/text-selection-cursor\.js\?v=text-selection-cursor-20260806/
    );
  }
});

test("the cursor watcher follows only nonempty highlighted document text", () => {
  assert.match(script, /const hasHighlightedDocumentText = \(\) => \{/);
  assert.match(script, /selection\.rangeCount > 0/);
  assert.match(script, /!selection\.isCollapsed/);
  assert.match(script, /selection\.toString\(\)\.length > 0/);
  assert.match(
    script,
    /document\.documentElement\.classList\.toggle\(TEXT_SELECTION_CURSOR_CLASS, hasHighlightedText\)/
  );
  assert.match(
    script,
    /document\.body\.classList\.toggle\(TEXT_SELECTION_CURSOR_CLASS, hasHighlightedText\)/
  );
  for (const eventName of [
    "selectionchange",
    "selectstart",
    "pointerup",
    "pointercancel",
  ]) {
    assert.match(
      script,
      new RegExp(`document\\.addEventListener\\("${eventName}", scheduleTextSelectionCursorSync\\)`)
    );
  }
  assert.match(
    script,
    /window\.addEventListener\("pageshow", scheduleTextSelectionCursorSync\)/
  );
  assert.match(script, /syncFrameId = window\.requestAnimationFrame\(syncTextSelectionCursor\)/);
});

test("highlighted text reuses the textbox cursor without masking guarded cursors", () => {
  const selectionBlock = getCssBlock("body.is-custom-cursor-text-selection");
  for (const token of ["normal", "select", "text-thin", "help"]) {
    assert.match(selectionBlock, new RegExp(`--cursor-${token}: var\\(--cursor-text\\);`));
  }
  for (const token of [
    "working",
    "busy",
    "unavailable",
    "pressed",
    "move",
    "precision",
    "resize-ew",
    "resize-ns",
    "resize-nwse",
    "resize-nesw",
  ]) {
    assert.doesNotMatch(selectionBlock, new RegExp(`--cursor-${token}:`));
  }
  assert.ok(
    styles.indexOf("body.is-custom-cursor-text-selection") >
      styles.indexOf("body.is-cursor-dark-mode"),
    "The selection tokens must override the selected light or dark cursor theme"
  );
});
