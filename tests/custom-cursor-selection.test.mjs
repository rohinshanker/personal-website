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

const compactStyles = styles.replace(/\s+/g, " ");

test("both entry points load the pointer-aware text cursor assets", () => {
  for (const source of [home, index]) {
    assert.match(source, /cursors\.css\?v=text-selection-cursor-20260810/);
    assert.match(
      source,
      /scripts\/home\/text-selection-cursor\.js\?v=text-selection-cursor-20260810/
    );
  }
  assert.match(
    index,
    /\["styles\/home\/cursors\.css\?v=text-selection-cursor-20260810", "style"\]/
  );
});

test("the watcher hit-tests selectable text under a non-touch pointer", () => {
  assert.match(script, /is-custom-cursor-text-hover/);
  assert.match(script, /is-custom-cursor-text-selecting/);
  assert.match(script, /caretPositionFromPoint/);
  assert.match(script, /caretRangeFromPoint/);
  assert.match(script, /Node\.(?:TEXT_NODE|ELEMENT_NODE)/);
  assert.match(script, /getComputedStyle/);
  assert.match(script, /userSelect/);
  assert.match(script, /\/\\S\/u/);
  assert.match(script, /event\.pointerType\s*!==\s*["']mouse["']/);
  assert.match(script, /event\.button\s*!==\s*0/);
  assert.match(script, /requestAnimationFrame/);

  for (const exclusion of [
    "a[href]",
    "button",
    "input",
    "textarea",
    "select",
    "[contenteditable",
    "[aria-disabled",
    "[disabled]",
    ".title-bar",
    ".panel-divider",
    ".is-unavailable",
  ]) {
    assert.ok(script.includes(exclusion), `Missing text-hover exclusion for ${exclusion}`);
  }
});

test("selection state is limited to an active primary-pointer gesture and always cleans up", () => {
  for (const eventName of [
    "pointermove",
    "pointerdown",
    "selectstart",
    "pointerup",
    "pointercancel",
    "lostpointercapture",
  ]) {
    assert.match(
      script,
      new RegExp(`addEventListener\\(["']${eventName}["']`),
      `Missing ${eventName} lifecycle handling`
    );
  }
  for (const eventName of ["blur", "pageshow", "scroll", "resize"]) {
    assert.match(
      script,
      new RegExp(`addEventListener\\(["']${eventName}["']`),
      `Missing ${eventName} cleanup or hover resync handling`
    );
  }
  assert.match(
    script,
    /document\.documentElement\.classList\.toggle\(TEXT_SELECTING_CURSOR_CLASS, isActive\)/
  );
  assert.match(
    script,
    /document\.body\.classList\.toggle\(TEXT_SELECTING_CURSOR_CLASS, isActive\)/
  );
  assert.doesNotMatch(script, /is-custom-cursor-text-selection/);
  assert.doesNotMatch(script, /addEventListener\(["']selectionchange["']/);
});

test("text hover and active selection styling do not remap unrelated cursor tokens", () => {
  assert.doesNotMatch(styles, /is-custom-cursor-text-selection/);
  assert.doesNotMatch(
    styles,
    /--cursor-(?:normal|select|text-thin|help):\s*var\(--cursor-text\)/
  );
  const textStateStart = compactStyles.indexOf(".is-custom-cursor-text-hover");
  const textStateEnd = compactStyles.indexOf("::-webkit-scrollbar", textStateStart);
  assert.notEqual(textStateStart, -1, "Missing selectable-text hover styling");
  assert.notEqual(textStateEnd, -1, "Missing selectable-text styling boundary");
  const textStateBlock = compactStyles.slice(textStateStart, textStateEnd);
  assert.match(textStateBlock, /html\.is-custom-cursor-text-selecting/);
  assert.match(textStateBlock, /body\.is-custom-cursor-text-selecting/);
  assert.match(textStateBlock, /cursor:\s*var\(--cursor-text\)\s*!important;/);

  const precisionStateStart = compactStyles.indexOf(
    "body.is-admin-picking-target [data-admin-pickable]"
  );
  const precisionStateEnd = compactStyles.indexOf("button:disabled", precisionStateStart);
  assert.notEqual(precisionStateStart, -1, "Missing Admin picker precision styling");
  assert.notEqual(precisionStateEnd, -1, "Missing Admin picker styling boundary");
  const precisionStateBlock = compactStyles.slice(precisionStateStart, precisionStateEnd);
  for (const token of ["normal", "select", "text", "move", "help", "resize-ew"]) {
    assert.match(
      precisionStateBlock,
      new RegExp(`--cursor-${token}:\\s*var\\(--cursor-precision\\)`)
    );
  }

  for (const token of [
    "select",
    "help",
    "move",
    "unavailable",
    "resize-ew",
    "resize-nwse",
  ]) {
    assert.match(styles, new RegExp(`cursor:\\s*var\\(--cursor-${token}\\)\\s*!important`));
  }
});
