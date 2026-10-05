import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

/**
 * The browser suite is only hermetic if every spec enters through the shared
 * fixture. A spec that imports Playwright directly gets a page with live
 * network, no offline Game Stats backend, and no diagnostic enforcement, and
 * nothing in a passing run would say so. These checks are that guarantee.
 */

const uiDirectory = new URL("ui/", import.meta.url);
const fixtureModule = new URL("ui/deterministic.mjs", import.meta.url);
const backendConfig = new URL("../scripts/home/game-stats-backend.js", import.meta.url);

/** The fixture is the one module allowed to import Playwright itself. */
const SHARED_FIXTURE = "./deterministic.mjs";

/** `import(...)` inside a JSDoc comment is a type reference, not a dependency. */
const staticImports = (source) =>
  [...source.matchAll(/^import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["'];/gm)].map(
    (match) => match[1]
  );

const specFilenames = async () =>
  (await readdir(uiDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".spec.mjs"))
    .map((entry) => entry.name)
    .sort();

const readSpecs = async () =>
  Promise.all(
    (await specFilenames()).map(async (name) => ({
      name,
      source: await readFile(new URL(name, uiDirectory), "utf8"),
    }))
  );

test("the browser suite has specs to hold to the fixture contract", async () => {
  const names = await specFilenames();
  assert.ok(
    names.length >= 50,
    `Expected the UI suite to still be present; found ${names.length} spec files`
  );
});

test("every UI spec takes test and expect from the shared fixture", async () => {
  for (const { name, source } of await readSpecs()) {
    const imports = staticImports(source);
    assert.ok(
      imports.includes(SHARED_FIXTURE),
      `${name} must import the shared fixture from ${SHARED_FIXTURE}`
    );
    const fixtureImport = source.match(
      /^import\s+\{([^}]*)\}\s+from\s+["']\.\/deterministic\.mjs["'];/m
    );
    assert.ok(fixtureImport, `${name} must name its fixture imports in a braced import`);
    const named = fixtureImport[1].split(",").map((entry) => entry.trim()).filter(Boolean);
    assert.ok(named.includes("test"), `${name} must take test from the shared fixture`);
  }
});

test("no UI spec imports Playwright or a base fixture directly", async () => {
  for (const { name, source } of await readSpecs()) {
    for (const specifier of staticImports(source)) {
      assert.notEqual(
        specifier,
        "@playwright/test",
        `${name} must not import @playwright/test; the shared fixture re-exports test and expect`
      );
      assert.notEqual(
        specifier,
        "./fixtures.mjs",
        `${name} must import the shared diagnostic fixture, not a base fixture`
      );
    }
  }
});

test("the shared fixture installs the whole hermetic boundary", async () => {
  const source = await readFile(fixtureModule, "utf8");
  for (const call of [
    "installHermeticNetwork(context)",
    "installGameStatsBackend(context)",
    "installSkyNameGenerator(context)",
    "routeProductionDebugFlags(context)",
  ]) {
    assert.ok(
      source.includes(`await ${call}`),
      `The shared fixture must call ${call} so every page and popup inherits it`
    );
  }
  assert.match(
    source,
    /assertNoRuntimeDiagnostics\(diagnostics\)/,
    "The shared fixture must assert on the diagnostics it collects"
  );
  assert.match(
    source,
    /context\.on\("page"/,
    "The shared fixture must collect diagnostics from popup pages too"
  );
  assert.match(
    source,
    /\{ auto: true \}/,
    "Diagnostic enforcement must be automatic, not opt-in"
  );
});

test("no UI spec rebuilds the hermetic setup the fixture owns", async () => {
  const forbidden = [
    [/const\s+disableRemoteGameStats\b/, "define its own offline Game Stats route"],
    [/window\.rohinGameStatsBackend\s*=/, "hand-write a Game Stats backend config"],
    [/page\.on\(\s*["']pageerror["']/, "listen for page exceptions itself"],
    [/page\.on\(\s*["']requestfailed["']/, "listen for failed requests itself"],
    // Console warnings are not errors and the fixture does not collect them, so
    // only an error collector is a duplicate of what it already enforces.
    [/message\.type\(\)\s*===\s*["']error["']/, "collect console errors itself"],
  ];
  for (const { name, source } of await readSpecs()) {
    for (const [pattern, description] of forbidden) {
      assert.ok(
        !pattern.test(source),
        `${name} must not ${description}; use the shared fixture helpers instead`
      );
    }
  }
});

test("no UI spec can reach the production Game Stats Worker", async () => {
  const origin = new URL(
    (await readFile(backendConfig, "utf8")).match(/apiBaseUrl:\s*"([^"]*)"/)[1]
  ).hostname;
  for (const { name, source } of await readSpecs()) {
    assert.ok(
      !source.includes(origin),
      `${name} names the production Worker host ${origin}; the fixture serves an offline backend`
    );
  }
});

test("no UI spec waits on wall-clock time", async () => {
  for (const { name, source } of await readSpecs()) {
    assert.ok(
      !/\bwaitForTimeout\s*\(/.test(source),
      `${name} calls waitForTimeout; assert the state it is waiting for, or drive page.clock`
    );
  }
});
