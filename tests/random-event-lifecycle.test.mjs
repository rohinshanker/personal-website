import assert from "node:assert/strict";
import vm from "node:vm";
import { test } from "node:test";

import { readHomeScriptText } from "./helpers/home-scripts.mjs";

// Execute the production helpers with a small DOM double so each lifecycle
// branch can be checked without depending on browser animation timing.
const source = await readHomeScriptText("windows", "activation", "eventRuntime");
const extract = (name) => {
  const match = source.match(new RegExp(`const ${name} = [\\s\\S]*?\\n(?:};|  \\);)`));
  assert.ok(match, name);
  return match[0];
};
const names = [
  "restartWindowAnimation",
  "unloadDeferredImages",
  "isManagedRandomEventWindowVisible",
  "showManagedRandomEventWindow",
  "closeManagedRandomEventWindow",
  "bindManagedRandomEventWindowAnimation",
];
const events = [];
const context = vm.createContext({
  loadDeferredMedia: (win) => {
    events.push("load");
    win.image.src = "loaded";
  },
  positionRandomEventWindowInViewport: () => events.push("position"),
  clampRandomEventWindowAfterMediaLoad: () => events.push("clamp"),
});
vm.runInContext(
  "let topZ = 100;\nconst nextWindowZIndex = () => topZ++;\n" + names.map(extract).join("\n") +
    "\nthis.api = {" + names.join(",") + "};",
  context
);
const {
  showManagedRandomEventWindow: show,
  closeManagedRandomEventWindow: close,
  bindManagedRandomEventWindowAnimation: bind,
  isManagedRandomEventWindowVisible: visible,
} = context.api;
const make = ({ hidden = true, aria = "true" } = {}) => {
  const classes = new Set(hidden ? ["is-hidden"] : []);
  const attrs = { "aria-hidden": aria };
  const listeners = {};
  const image = {
    src: "loaded",
    removeAttribute(name) { delete this[name]; },
  };
  const win = {
    classes, attrs, listeners, image, style: {}, offsetWidth: 50,
    classList: {
      contains: (value) => classes.has(value),
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
    },
    getAttribute: (key) => attrs[key],
    setAttribute: (key, value) => { attrs[key] = value; },
    querySelectorAll: () => [image],
    addEventListener: (name, callback) => { listeners[name] = callback; },
  };
  win.end = (animationName, target = win) =>
    listeners.animationend({ target, animationName });
  return win;
};

test("null and hidden guards do not run event hooks", () => {
  assert.equal(show(null, { beforeShow: () => assert.fail() }), false);
  assert.equal(close(null), false);
  bind(null);
  assert.equal(close(make(), { beforeClose: () => assert.fail() }), false);
});
test("opening preserves reset, media, placement and post-show order", () => {
  events.length = 0;
  const win = make();
  win.classes.add("extra");
  assert.equal(show(win, {
    beforeShow: () => events.push("before"),
    afterShow: () => events.push("after"),
    clearClasses: ["extra"],
    clampAfterMediaLoad: true,
  }), true);
  assert.deepEqual(events, ["before", "load", "position", "clamp", "after"]);
  assert.equal(visible(win), true);
  assert.equal(win.classes.has("extra"), false);
  assert.equal(win.classes.has("is-opening"), true);
});
test("already-visible fronting changes only z-order and onFront", () => {
  const win = make({ hidden: false, aria: "false" });
  let fronted = false;
  assert.equal(show(win, {
    onFront: () => { fronted = true; },
    beforeShow: () => assert.fail(),
  }), false);
  assert.ok(Number(win.style.zIndex) >= 100);
  assert.ok(fronted);
  assert.equal(win.classes.has("is-opening"), false);
});
test("visibility, placement and animation overrides preserve event behavior", () => {
  const win = make({ hidden: false, aria: "true" });
  win.classes.add("is-closing");
  assert.equal(show(win, {
    isVisible: () => !win.classes.has("is-hidden"),
    beforeShow: () => assert.fail(),
  }), false);
  assert.equal(win.attrs["aria-hidden"], "true");
  let positioned = false;
  assert.equal(show(win, {
    isVisible: () => false,
    animate: false,
    position: (target) => {
      assert.equal(target, win);
      positioned = true;
    },
  }), true);
  assert.ok(positioned);
  assert.equal(win.classes.has("is-opening"), false);
  assert.equal(win.classes.has("is-closing"), false);
});
test("forced close bypasses the hidden guard and tears down before aria", () => {
  const win = make({ aria: "false" });
  assert.equal(close(win, {
    force: true,
    beforeClose: () => assert.equal(win.attrs["aria-hidden"], "false"),
  }), true);
  assert.equal(win.attrs["aria-hidden"], "true");
  assert.ok(win.classes.has("is-closing"));
});
test("root animations invoke hooks and unload media before reset", () => {
  const win = make({ hidden: false, aria: "false" });
  win.classes.add("extra");
  let opened = 0;
  let closed = 0;
  bind(win, {
    afterOpen: () => opened++,
    closingClasses: ["extra"],
    afterClose: () => {
      closed++;
      assert.equal(win.image.src, undefined);
    },
  });
  win.end("retro-window-close", win.image);
  win.end("unrelated");
  assert.equal(closed, 0);
  assert.equal(win.classes.has("is-hidden"), false);
  win.end("retro-window-open");
  assert.equal(opened, 1);
  win.end("retro-window-close");
  assert.equal(closed, 1);
  assert.equal(win.classes.has("extra"), false);
  assert.equal(win.classes.has("is-hidden"), true);
});
test("custom removal and retained media bypass default cleanup", () => {
  const win = make({ hidden: false, aria: "false" });
  let removed = 0;
  bind(win, { onClose: () => removed++, afterClose: () => assert.fail() });
  win.end("retro-window-close");
  assert.equal(removed, 1);
  assert.equal(win.classes.has("is-hidden"), false);
  assert.equal(win.image.src, "loaded");
  const kept = make({ hidden: false, aria: "false" });
  bind(kept, { unloadImages: false });
  kept.end("retro-window-close");
  assert.equal(kept.image.src, "loaded");
});


test("default visibility requires a window, its visible class and aria state", () => {
  assert.equal(visible(null), false);
  assert.equal(visible(make()), false);
  assert.equal(visible(make({ hidden: true, aria: "false" })), false);
  assert.equal(visible(make({ hidden: false, aria: "true" })), false);
  assert.equal(visible(make({ hidden: false, aria: "false" })), true);
});

test("default lifecycle finishes opening, swallows desktop clicks and closes", () => {
  const win = make();
  bind(win);
  assert.equal(show(win), true);
  win.end("retro-window-open");
  assert.equal(win.classes.has("is-opening"), false);
  let stopped = false;
  win.listeners.click({ stopPropagation: () => { stopped = true; } });
  assert.equal(stopped, true);
  assert.equal(close(win), true);
  assert.equal(visible(win), false);
  assert.equal(win.classes.has("is-hidden"), false);
  assert.equal(win.classes.has("is-closing"), true);
  win.end("retro-window-close");
  assert.equal(win.classes.has("is-closing"), false);
  assert.equal(win.classes.has("is-hidden"), true);
  assert.equal(win.image.src, undefined);
  assert.equal(close(win), false);
});

test("already-visible windows front without requiring optional callbacks", () => {
  const win = make({ hidden: false, aria: "false" });
  events.length = 0;
  assert.equal(show(win), false);
  const firstZ = Number(win.style.zIndex);
  assert.equal(show(win), false);
  assert.equal(Number(win.style.zIndex), firstZ + 1);
  assert.deepEqual(events, []);
});

test("null animation and media targets are safe no-ops", () => {
  context.api.restartWindowAnimation(null, "is-opening");
  context.api.unloadDeferredImages(null);
});

test("registrations defer bindings, preserve order and drain exactly once", () => {
  const registry = vm.createContext({});
  vm.runInContext(`
    const STANDARD_RANDOM_EVENT_PROBABILITY = 0.1;
    const STANDARD_RANDOM_EVENT_PROBABILITIES = { default: 0.1 };
    const randomEventDefinitions = [];
    const randomEventBindings = [];
    const watchRandomEventViewportMedia = () => {};
    ${extract("registerRandomEvent")}
    ${extract("bindRegisteredRandomEvents")}
    this.api = { registerRandomEvent, bindRegisteredRandomEvents, randomEventDefinitions };
  `, registry);
  const calls = [];
  const {
    registerRandomEvent: register,
    bindRegisteredRandomEvents: bindAll,
  } = registry.api;
  const first = register({ id: "first", bind: () => calls.push("first") });
  register({ id: "shared-shell-event" });
  register({ id: "second", bind: () => calls.push("second") });
  assert.deepEqual(calls, []);
  assert.equal(first.debug, false);
  assert.equal(first.probability, 0.1);
  assert.equal(registry.api.randomEventDefinitions.length, 3);
  bindAll();
  assert.deepEqual(calls, ["first", "second"]);
  bindAll();
  assert.deepEqual(calls, ["first", "second"]);
});
