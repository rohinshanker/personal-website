import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { sourceBetween } from "./helpers/source-runtime.mjs";

const source = await readFile(
  new URL("../scripts/home/core/resources.js", import.meta.url),
  "utf8"
);
const windowsSource = await readFile(
  new URL("../scripts/home/core/windows.js", import.meta.url),
  "utf8"
);
const persistedAdminBehaviorSource = sourceBetween(
  windowsSource,
  'const ADMIN_CONTROLS_STORAGE_KEY = "personalSiteAdminControlsV1";',
  "\n\nconst restorePersistedAdminControlsBehavior ="
);

const hasPersistedAdminControlsBehavior = (storedValue, { storageError = false } = {}) => {
  const context = vm.createContext({
    localStorage: {
      getItem() {
        if (storageError) throw new Error("storage unavailable");
        return storedValue;
      },
    },
  });
  vm.runInContext(
    `${persistedAdminBehaviorSource}\n` +
      "globalThis.result = hasPersistedAdminControlsBehavior();",
    context
  );
  return context.result;
};

const loadResourceRuntime = ({ failOnce = new Set(), incompleteOnce = new Set() } = {}) => {
  const attempts = new Map();
  const appended = [];

  class ResourceElement extends EventTarget {
    constructor(tagName) {
      super();
      this.tagName = tagName.toUpperCase();
      this.dataset = {};
      this.isConnected = false;
    }

    remove() {
      this.isConnected = false;
    }
  }

  const document = {
    createElement: (tagName) => new ResourceElement(tagName),
    head: {
      append(element) {
        element.isConnected = true;
        appended.push(element.dataset.homeResource);
        const key = element.dataset.homeResource;
        attempts.set(key, (attempts.get(key) || 0) + 1);
        queueMicrotask(() => {
          const shouldFail = failOnce.has(key) && attempts.get(key) === 1;
          const shouldStayIncomplete =
            incompleteOnce.has(key) && attempts.get(key) === 1;
          if (!shouldFail && !shouldStayIncomplete && key === "admin-orchestrator") {
            window.rohinAdminOrchestrator = {
              listEvents() {},
              resetScene() {},
              runEvent() {},
            };
          }
          if (!shouldFail && !shouldStayIncomplete && key === "admin-controls") {
            window.rohinAdminControls = {};
            window.rohinAdminControlsController = { getState() {} };
          }
          element.dispatchEvent(new Event(shouldFail ? "error" : "load"));
        });
      },
    },
  };
  const window = {};
  vm.runInNewContext(source, {
    Error,
    Event,
    EventTarget,
    Map,
    Object,
    Promise,
    document,
    queueMicrotask,
    window,
  });
  return { appended, attempts, resources: window.homeResources };
};

test("Home resource loading deduplicates styles and preserves Admin script order", async () => {
  const { appended, attempts, resources } = loadResourceRuntime();

  const firstStyles = resources.loadRandomEventStyles();
  const duplicateStyles = resources.loadRandomEventStyles();
  assert.equal(firstStyles, duplicateStyles);
  await Promise.all([firstStyles, duplicateStyles]);
  await Promise.all([resources.loadAdminResources(), resources.loadAdminResources()]);

  assert.deepEqual(appended, [
    "random-event-styles",
    "admin-styles",
    "admin-orchestrator",
    "admin-controls",
  ]);
  assert.deepEqual(Object.fromEntries(attempts), {
    "random-event-styles": 1,
    "admin-styles": 1,
    "admin-orchestrator": 1,
    "admin-controls": 1,
  });
  assert.equal(resources.resourceState("admin-controls"), "loaded");
});

test("a failed Admin resource is removed and retries without duplicating loaded work", async () => {
  const { appended, attempts, resources } = loadResourceRuntime({
    failOnce: new Set(["admin-styles"]),
  });

  await assert.rejects(resources.loadAdminResources(), /admin-styles/);
  assert.equal(resources.resourceState("admin-styles"), "idle");
  await resources.loadAdminResources();

  assert.deepEqual(appended, [
    "random-event-styles",
    "admin-styles",
    "admin-styles",
    "admin-orchestrator",
    "admin-controls",
  ]);
  assert.equal(attempts.get("random-event-styles"), 1);
  assert.equal(attempts.get("admin-styles"), 2);
  assert.equal(attempts.get("admin-orchestrator"), 1);
  assert.equal(attempts.get("admin-controls"), 1);
});

test("an Admin script that loads without publishing its runtime is removed and retries", async () => {
  const { attempts, resources } = loadResourceRuntime({
    incompleteOnce: new Set(["admin-controls"]),
  });

  await assert.rejects(resources.loadAdminResources(), /admin-controls/);
  assert.equal(resources.resourceState("admin-controls"), "idle");
  await resources.loadAdminResources();

  assert.equal(attempts.get("admin-orchestrator"), 1);
  assert.equal(attempts.get("admin-controls"), 2);
  assert.equal(resources.resourceState("admin-controls"), "loaded");
});

test("cancelling a pending Admin load prevents later scripts and leaves a retry usable", async () => {
  const { appended, resources } = loadResourceRuntime();

  const cancelled = resources.loadAdminResources();
  resources.cancelAdminResourceLoad();
  const retried = resources.loadAdminResources();
  assert.deepEqual(appended, ["random-event-styles", "admin-styles"]);

  await assert.rejects(cancelled, /cancelled/);
  await retried;
  assert.deepEqual(appended, [
    "random-event-styles",
    "admin-styles",
    "admin-orchestrator",
    "admin-controls",
  ]);
});

test("persisted Admin behavior accepts only actionable version-one state", async (t) => {
  const cases = [
    ["missing storage", null, false],
    ["JSON null", "null", false],
    ["unsupported version", JSON.stringify({ version: 2, audio: false }), false],
    ["top-level array", JSON.stringify([{ version: 1, audio: false }]), false],
    ["default flags", JSON.stringify({
      version: 1,
      audio: true,
      visualEffects: true,
      privacy: false,
      promoRandomMode: false,
      safeArea: false,
      guide: "none",
      bindings: [],
    }), false],
    ["invalid binding shapes", JSON.stringify({
      version: 1,
      bindings: [
        null,
        "binding",
        [],
        {},
        { target: "", eventId: "event" },
        { target: "target", eventId: "" },
      ],
    }), false],
    ["unlisted guide", JSON.stringify({ version: 1, guide: "portrait" }), false],
    ["audio disabled", JSON.stringify({ version: 1, audio: false }), true],
    ["visual effects disabled", JSON.stringify({ version: 1, visualEffects: false }), true],
    ["privacy enabled", JSON.stringify({ version: 1, privacy: true }), true],
    ["promo random mode enabled", JSON.stringify({ version: 1, promoRandomMode: true }), true],
    ["safe area enabled", JSON.stringify({ version: 1, safeArea: true }), true],
    ["valid binding", JSON.stringify({
      version: 1,
      bindings: [{ target: "id:start-button", eventId: "vanishing-popup-alert" }],
    }), true],
  ];

  for (const [name, storedValue, expected] of cases) {
    await t.test(name, () => {
      assert.equal(hasPersistedAdminControlsBehavior(storedValue), expected);
    });
  }

  for (const guide of ["vertical", "square", "landscape"]) {
    await t.test(`guide ${guide}`, () => {
      assert.equal(
        hasPersistedAdminControlsBehavior(JSON.stringify({ version: 1, guide })),
        true
      );
    });
  }

  await t.test("malformed JSON", () => {
    assert.equal(hasPersistedAdminControlsBehavior("{"), false);
  });
  await t.test("storage failure", () => {
    assert.equal(hasPersistedAdminControlsBehavior(null, { storageError: true }), false);
  });
});
