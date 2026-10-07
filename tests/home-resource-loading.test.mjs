import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  new URL("../scripts/home/core/resources.js", import.meta.url),
  "utf8"
);

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
