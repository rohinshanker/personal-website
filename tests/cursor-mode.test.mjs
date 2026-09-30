import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  new URL("../scripts/home/core/cursor-mode.js", import.meta.url),
  "utf8"
);

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }
}

const createEventTarget = () => {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const typeListeners = listeners.get(type) || [];
      typeListeners.push(listener);
      listeners.set(type, typeListeners);
    },
    dispatch(type, event = {}) {
      (listeners.get(type) || []).forEach((listener) => listener(event));
    },
  };
};

const createRuntime = ({ mode = "light", reducedMotion = false } = {}) => {
  const windowEvents = createEventTarget();
  const documentEvents = createEventTarget();
  const mediaEvents = createEventTarget();
  const root = { classList: new FakeClassList() };
  const body = { classList: new FakeClassList() };
  const requests = [];
  const storage = new Map([["rohin-os-cursor-mode", mode]]);
  const animationFrames = new Map();
  const intervals = new Map();
  let nextAnimationFrame = 1;
  let nextInterval = 1;

  const motionQuery = {
    matches: reducedMotion,
    addEventListener: mediaEvents.addEventListener,
    dispatch: mediaEvents.dispatch,
  };

  class FakeMutationObserver {
    static instances = [];

    constructor(callback) {
      this.callback = callback;
      this.observations = [];
      FakeMutationObserver.instances.push(this);
    }

    observe(target, options) {
      this.observations.push({ target, options });
    }
  }

  const document = {
    baseURI: "https://example.test/home.html",
    body,
    currentScript: {
      src: "https://example.test/scripts/home/core/cursor-mode.js",
    },
    documentElement: root,
    hidden: false,
    readyState: "complete",
    addEventListener: documentEvents.addEventListener,
  };
  const localStorage = {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
  };
  const window = {
    addEventListener: windowEvents.addEventListener,
    clearInterval(id) {
      intervals.delete(id);
    },
    fetch(url, options) {
      requests.push({ url: String(url), options });
      return Promise.resolve({ ok: true });
    },
    matchMedia() {
      return motionQuery;
    },
    requestAnimationFrame(callback) {
      const id = nextAnimationFrame;
      nextAnimationFrame += 1;
      animationFrames.set(id, callback);
      return id;
    },
    setInterval(callback, delay) {
      const id = nextInterval;
      nextInterval += 1;
      intervals.set(id, { callback, delay });
      return id;
    },
  };

  vm.runInContext(
    source,
    vm.createContext({
      MutationObserver: FakeMutationObserver,
      URL,
      document,
      localStorage,
      window,
    })
  );

  return {
    body,
    dispatchWindow: windowEvents.dispatch,
    flushAnimationFrames() {
      const pending = [...animationFrames.values()];
      animationFrames.clear();
      pending.forEach((callback) => callback());
    },
    intervals,
    motionQuery,
    mutationObservers: FakeMutationObserver.instances,
    requests,
    root,
    runtime: window.RohinCursorRuntime,
    storage,
  };
};

test("the shared runtime applies, persists, and preloads only the active cursor mode", () => {
  const environment = createRuntime({ mode: "dark" });
  const observedModes = [];
  environment.runtime.subscribe((mode) => observedModes.push(mode));
  environment.runtime.start();

  assert.equal(environment.runtime.storageKey, "rohin-os-cursor-mode");
  assert.equal(environment.runtime.getMode(), "dark");
  assert.equal(environment.root.classList.contains("is-cursor-dark-mode"), true);
  assert.equal(environment.body.classList.contains("is-cursor-dark-mode"), true);
  assert.equal(environment.body.classList.contains("is-custom-cursor-ready"), true);
  assert.ok(environment.requests.length > 20);
  assert.ok(
    environment.requests.every(
      ({ url }) => url.includes("-dark.png") || url.includes("/Jeelh-Cursor-Dark/")
    )
  );

  const darkRequestCount = environment.requests.length;
  environment.runtime.preloadMode("dark");
  assert.equal(environment.requests.length, darkRequestCount);

  environment.runtime.setMode("light", { persist: true });
  assert.equal(environment.storage.get("rohin-os-cursor-mode"), "light");
  assert.equal(environment.body.classList.contains("is-cursor-dark-mode"), false);
  assert.ok(
    environment.requests
      .slice(darkRequestCount)
      .every(
        ({ url }) => url.includes("-light.png") || url.includes("/Jeelh-Cursor-Light/")
      )
  );

  environment.dispatchWindow("storage", {
    key: "rohin-os-cursor-mode",
    newValue: "dark",
  });
  assert.equal(environment.runtime.getMode(), "dark");
  assert.deepEqual(observedModes, ["dark", "light", "dark"]);
});

test("one loading observer combines sources and honors reduced motion", () => {
  const environment = createRuntime({ reducedMotion: true });
  environment.runtime.start();
  let primaryBusy = true;
  const primaryTarget = {};
  const secondaryTarget = {};
  const controller = environment.runtime.observeLoading({
    isLoading: () => primaryBusy,
    observations: [
      {
        target: primaryTarget,
        options: { attributes: true },
      },
    ],
  });
  environment.runtime.observeLoading({
    isLoading: () => false,
    observations: [
      {
        target: secondaryTarget,
        options: { childList: true },
      },
    ],
  });
  environment.flushAnimationFrames();

  assert.equal(environment.mutationObservers.length, 1);
  assert.deepEqual(
    environment.mutationObservers[0].observations.map(({ target }) => target),
    [primaryTarget, secondaryTarget]
  );
  assert.equal(environment.body.classList.contains("is-custom-cursor-loading"), true);
  assert.equal(
    environment.body.classList.contains("is-custom-cursor-loading-frame-1"),
    true
  );
  assert.equal(environment.intervals.size, 0);

  const receivedMutationBatches = [];
  const unsubscribe = environment.runtime.subscribeBodyMutations((records) => {
    receivedMutationBatches.push(records);
  });
  assert.equal(environment.mutationObservers.length, 1);
  assert.equal(
    environment.mutationObservers[0].observations.at(-1).target,
    environment.body
  );
  environment.mutationObservers[0].callback([{ type: "childList" }]);
  assert.deepEqual(receivedMutationBatches, [[{ type: "childList" }]]);
  unsubscribe();
  environment.mutationObservers[0].callback([{ type: "attributes" }]);
  assert.equal(receivedMutationBatches.length, 1);

  environment.motionQuery.matches = false;
  environment.motionQuery.dispatch("change");
  environment.flushAnimationFrames();
  assert.equal(environment.intervals.size, 1);
  const [{ callback, delay }] = environment.intervals.values();
  assert.equal(delay, 100);
  callback();
  assert.equal(
    environment.body.classList.contains("is-custom-cursor-loading-frame-2"),
    true
  );

  primaryBusy = false;
  controller.sync();
  environment.flushAnimationFrames();
  assert.equal(environment.body.classList.contains("is-custom-cursor-loading"), false);
  assert.equal(
    [...environment.body.classList.values].some((name) =>
      name.startsWith("is-custom-cursor-loading-frame-")
    ),
    false
  );
  assert.equal(environment.intervals.size, 0);
});
