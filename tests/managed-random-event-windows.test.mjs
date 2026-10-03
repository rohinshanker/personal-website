/**
 * The managed random-event window contract.
 *
 * Every event opens, closes and animates through one implementation, wires its
 * own DOM from the `bind()` field on its definition, and shares one set of CSS
 * state rules. These checks fail when a new event hand-clones any of that
 * instead of reusing it.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  RANDOM_EVENT_SCRIPT_KEYS,
  readHomeScriptText,
} from "./helpers/home-scripts.mjs";

const root = new URL("../", import.meta.url);

const [eventSources, homeSource, eventStyles] = await Promise.all([
  readHomeScriptText("windows", ...RANDOM_EVENT_SCRIPT_KEYS, "boot"),
  readFile(new URL("home.html", root), "utf8"),
  readFile(new URL("styles/home/random-events.css", root), "utf8"),
]);

/** The one block allowed to contain the raw show sequence. */
const SHOW_HELPER = "const showManagedRandomEventWindow = (";

const registrationBlocks = () => {
  const blocks = [];
  const marker = /^(?: {2})?registerRandomEvent\(\{$/gm;
  for (const match of eventSources.matchAll(marker)) {
    const open = eventSources.indexOf("{", match.index);
    let depth = 0;
    let index = open;
    while (index < eventSources.length) {
      if (eventSources[index] === "{") depth += 1;
      else if (eventSources[index] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    blocks.push(eventSources.slice(open, index + 1));
  }
  return blocks;
};

test("the show sequence is written once", () => {
  const showSequence = [...eventSources.matchAll(/classList\.remove\("is-hidden", "is-closing"/g)];
  assert.equal(
    showSequence.length,
    1,
    "Open a random-event window with showManagedRandomEventWindow instead of clearing is-hidden by hand."
  );
  const helperStart = eventSources.indexOf(SHOW_HELPER);
  assert.notEqual(helperStart, -1, "Missing showManagedRandomEventWindow");
  assert.ok(
    showSequence[0].index > helperStart,
    "The only show sequence must be the one inside showManagedRandomEventWindow."
  );

  // `setWindowOpen` owns the app windows and is deliberately separate.
  const closers = [...eventSources.matchAll(/restartWindowAnimation\([^,]+, "is-closing"\)/g)];
  assert.equal(
    closers.length,
    2,
    "Close a random-event window with closeManagedRandomEventWindow; only the helper and setWindowOpen may start the closing animation."
  );
});

test("the open and close animations are bound once", () => {
  const listeners = [...eventSources.matchAll(/addEventListener\("animationend"/g)];
  const managed = [...eventSources.matchAll(/bindManagedRandomEventWindowAnimation\(/g)];
  assert.ok(
    managed.length > 60,
    `Expected every event window to use the shared binder; found ${managed.length} calls.`
  );
  // Remaining raw listeners belong to the app-window shell, achievement toasts
  // and one-shot sprite animations, none of which are event windows.
  assert.ok(
    listeners.length <= 18,
    `Unexpected raw animationend listener; found ${listeners.length}.`
  );
});

test("every event definition keeps its DOM wiring in bind()", () => {
  const blocks = registrationBlocks();
  assert.ok(blocks.length > 55, `Expected the full event registry; found ${blocks.length}.`);

  const bound = blocks.filter((block) => block.includes("\n  bind: () => {"));
  assert.ok(
    bound.length >= 59,
    `Expected the events that own controls to declare bind(); found ${bound.length}.`
  );

  blocks.forEach((block) => {
    const id = block.match(/id: (?:"([^"]+)"|`([^`]+)`)/);
    assert.ok(id, "Every definition declares an id");
    const name = id[1] ?? id[2];
    if (!block.includes("bind: () => {")) return;
    // The browser debug fixture matches `id:` immediately followed by `debug:`,
    // so bind() has to stay out from between them.
    assert.doesNotMatch(
      block,
      /id: (?:"[^"]+"|`[^`]+`),\n {2,4}bind:/,
      `${name} must not place bind() between id and debug`
    );
    assert.ok(
      block.lastIndexOf("bind: () => {") > block.lastIndexOf("run:"),
      `${name} should declare bind() after run()`
    );
  });
});

test("registerRandomEvent queues bind() for one wiring pass", () => {
  assert.match(
    eventSources,
    /if \(registeredDefinition\.bind\) \{\s*randomEventBindings\.push\(registeredDefinition\.bind\);\s*\}/
  );
  assert.match(
    eventSources,
    /const bindRegisteredRandomEvents = \(\) => \{\s*randomEventBindings\.forEach\(\(bind\) => bind\(\)\);\s*watchRandomEventViewportMedia\(\);\s*randomEventBindings\.length = 0;\s*\};/
  );
  assert.equal(
    [...eventSources.matchAll(/^bindRegisteredRandomEvents\(\);$/gm)].length,
    1,
    "The queued binds run from exactly one call site."
  );
  // Registration happens thousands of lines earlier; wiring must not run there.
  const registerIndex = eventSources.indexOf("const registerRandomEvent = (definition)");
  const bindCallIndex = eventSources.indexOf("\nbindRegisteredRandomEvents();");
  assert.ok(bindCallIndex > registerIndex, "The wiring pass runs after registration");
});

test("every event window carries the managed base class", () => {
  const windowClassLists = [...homeSource.matchAll(/class="window ([^"]*)"/g)].map(
    (match) => match[1].split(/\s+/)
  );
  const rootSelectors = new Set(
    [...eventStyles.matchAll(/^\.([a-z0-9-]+-window)(?=[\s,{.])/gm)].map((match) => match[1])
  );
  const missing = windowClassLists
    .filter((classes) => !classes.includes("app-window"))
    .filter((classes) => classes.some((name) => rootSelectors.has(name)))
    .filter((classes) => !classes.includes("random-event-window"))
    .map((classes) => classes.join("."));
  assert.deepEqual(missing, [], "These event windows are missing random-event-window");

  // The windows built at runtime need it too.
  ["word-error-stack-window", "brand-puck-window", "brand-block-window", "brand-apostle-window"]
    .forEach((name) => {
      assert.match(
        eventSources,
        new RegExp(`win\\.className = "window random-event-window ${name} is-hidden";`),
        `${name} is created without the managed base class`
      );
    });
});

test("the window state rules are declared once", () => {
  assert.match(eventStyles, /\.random-event-window\.is-hidden \{\s*display: none;\s*\}/);
  assert.match(
    eventStyles,
    /\.random-event-window\.is-opening \{\s*animation: retro-window-open var\(--event-window-open-duration, 260ms\)\s*steps\(7, end\) both;\s*\}/
  );
  assert.match(
    eventStyles,
    /\.random-event-window\.is-closing \{\s*pointer-events: none;\s*animation: retro-window-close var\(--event-window-close-duration, 180ms\)\s*steps\(7, end\) both;\s*\}/
  );

  const duplicates = [...eventStyles.matchAll(/^\.([a-z0-9-]+-window)\.(is-hidden|is-opening|is-closing) \{\n([^}]*)\}/gm)]
    .filter(([, name]) => name !== "random-event-window")
    .filter(([, , , body]) => !body.includes("animation: none"))
    .map(([, name, state]) => `.${name}.${state}`);
  assert.deepEqual(
    duplicates,
    [],
    "Express a per-event difference as a custom property instead of restating the state rule."
  );

  // Biden Blast animates with its own piece explosion, so it opts out.
  assert.match(eventStyles, /\.biden-blast-window\.is-opening \{\s*animation: none;\s*\}/);
  assert.match(
    eventStyles,
    /\.biden-blast-window\.is-closing \{[\s\S]*?animation: none;[\s\S]*?\}/
  );
});

test("per-event geometry is expressed as custom properties", () => {
  const rootRules = [...eventStyles.matchAll(/^\.([a-z0-9-]+-window) \{\n([^}]*)\}/gm)];
  const restated = rootRules
    .filter(([, name]) => name !== "random-event-window" && name !== "random-alert-window")
    .filter(([, , body]) =>
      /^\s*(?:position: fixed|display: block|left: 50%|top: 50%|translate: -50% -50%|z-index:)/m.test(body)
    )
    .map(([, name]) => `.${name}`);
  assert.deepEqual(
    restated,
    [],
    "Set --event-window-width / --event-window-max-width / --event-window-z instead of restating the base geometry."
  );
  assert.match(eventStyles, /\.nataraja-window \{[\s\S]*?--event-window-max-width: calc\(75vw - 18px\);/);
  assert.match(eventStyles, /\.brand-puck-window \{[\s\S]*?--event-window-open-duration: 220ms;/);
});
