import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { readHomeScriptText } from "./helpers/home-scripts.mjs";

const root = new URL("../", import.meta.url);
const [
  script,
  styles,
  home,
  index,
  main,
  cursorRuntime,
  modeling,
  modelingCursor,
  modelingScript,
  modelingStyles,
] = await Promise.all([
  readFile(new URL("scripts/home/text-selection-cursor.js", root), "utf8"),
  readFile(new URL("styles/home/cursors.css", root), "utf8"),
  readFile(new URL("home.html", root), "utf8"),
  readFile(new URL("index.html", root), "utf8"),
  readHomeScriptText("windows", "sudoku", "calendar"),
  readFile(new URL("scripts/home/core/cursor-mode.js", root), "utf8"),
  readFile(new URL("modeling/index.html", root), "utf8"),
  readFile(new URL("modeling/cursor.js", root), "utf8"),
  readFile(new URL("modeling/script.js", root), "utf8"),
  readFile(new URL("modeling/style.css", root), "utf8"),
]);

const compactStyles = styles.replace(/\s+/g, " ");

test("every custom-cursor route loads the pointer-aware text cursor assets", () => {
  for (const source of [home, index, modeling]) {
    assert.match(source, /cursors\.css\?v=[^"]+/);
    assert.match(
      source,
      /scripts\/home\/text-selection-cursor\.js\?v=[^"]+/
    );
  }
  assert.match(
    index,
    /\["styles\/home\/cursors\.css\?v=[^"]+", "style"\]/
  );
  for (const source of [home, index, modeling]) {
    assert.match(
      source,
      /scripts\/home\/core\/cursor-mode\.js\?v=[^"]+/
    );
  }
  assert.match(cursorRuntime, /window\.RohinCursorRuntime\s*=\s*Object\.freeze/);
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
    '[role="separator"]',
    "[data-custom-cursor-guard]",
    ".is-unavailable",
  ]) {
    assert.ok(script.includes(exclusion), `Missing text-hover exclusion for ${exclusion}`);
  }
});

test("route-specific cursor surfaces opt in through generic guard attributes", () => {
  for (const routeSelector of [
    ".calendar-day",
    ".study-tree-row",
    ".ms-cell",
    ".sol-card",
    ".sudoku-cell",
    ".infinity-armory-gem",
    ".pokemon-starter-choice",
    ".dst-resource-token",
    ".portfolio-window",
  ]) {
    assert.equal(
      script.includes(routeSelector),
      false,
      `Shared text-selection logic must not know ${routeSelector}.`
    );
  }

  assert.match(
    home,
    /\bid="sol-waste"[^>]*\bdata-custom-cursor-guard(?:\s|>|=)/i
  );
  assert.match(
    home,
    /\bid="sol-tableau"[^>]*\bdata-custom-cursor-guard(?:\s|>|=)/i
  );
  assert.match(
    home,
    /\bclass="title-bar"[^>]*\bdata-custom-cursor-guard(?:\s|>|=)[^>]*>[\s\S]*?Date &amp; Time/i
  );
  assert.ok(
    (main.match(/setAttribute\("data-custom-cursor-guard", ""\)/g) || []).length >= 3,
    "Dynamic Sudoku and calendar surfaces must carry generic cursor guards."
  );
  assert.match(
    main,
    /toggleAttribute\("data-custom-cursor-guard", isResizeHover\)/
  );
});

test("the modeling route adapts the shared cursor runtime instead of forking it", () => {
  // Fixed page sections are not Home windows: without the opt-out their
  // 98.css title bars would advertise a drag the route cannot perform.
  assert.match(
    modeling,
    /<header\b[^>]*\bclass="window portfolio-header"[\s\S]*?\bdata-no-drag\b[^>]*>/
  );
  assert.match(modeling, /<div class="window portfolio-noscript" data-no-drag>/);
  assert.match(modelingScript, /"window lightbox__window", \{ "data-no-drag": true \}/);
  assert.match(modelingScript, /"data-shoot": shoot\.id,\s*\n\s*"data-no-drag": true,/);

  // The adapter owns a busy predicate and nothing else: no second preference
  // store, asset list, or loading animation on this route.
  assert.match(modelingCursor, /window\.RohinCursorRuntime/);
  assert.match(modelingCursor, /cursorRuntime\.start\(\)/);
  assert.match(
    modelingCursor,
    /isLoading: \(\) => stage\.getAttribute\("aria-busy"\) === "true"/
  );
  assert.match(modelingCursor, /attributeFilter: \["aria-busy"\]/);
  for (const forked of [
    "rohin-os-cursor-mode",
    "localStorage",
    "is-cursor-dark-mode",
    "is-custom-cursor-loading",
    "cursor-assets",
    "setInterval",
  ]) {
    assert.equal(
      modelingCursor.includes(forked),
      false,
      `The modeling adapter must leave ${forked} to the shared runtime.`
    );
  }

  // The shared stylesheet owns every pointer token the route renders, and it
  // wins with !important, so a local declaration would only be dead code.
  assert.doesNotMatch(modelingStyles, /\bcursor\s*:/);
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
