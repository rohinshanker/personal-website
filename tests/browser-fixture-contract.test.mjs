import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import {
  KNOWN_REMOTE_EMBEDS,
  TEST_SERVER_ORIGIN,
  isSkyNameGeneratorRequest,
  remoteEmbedStub,
  servedFile,
} from "./ui/helpers/rendered-site.mjs";
import { resolveUiTestBaseUrl } from "./ui/server-config.mjs";

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
    "installDeterministicSudokuWorker(context)",
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
    /collectRuntimeDiagnostics\(context\)/,
    "The shared fixture must watch the context, so a popup's first navigation is recorded"
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
    [/\.on\(\s*["'](?:pageerror|weberror)["']/, "listen for page exceptions itself"],
    [/\.on\(\s*["']requestfailed["']/, "listen for failed requests itself"],
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

const STUB_CONTENT_TYPE = Object.freeze({
  image: "image/png",
  media: "video/mp4",
  document: "text/html",
});

test("every known remote embed is one exact https address with a stub of its kind", () => {
  const origins = Object.entries(KNOWN_REMOTE_EMBEDS);
  assert.ok(origins.length > 0, "The fixture must name the remote embeds Home ships");
  for (const [origin, paths] of origins) {
    assert.equal(new URL(origin).origin, origin, `${origin} must be a bare origin`);
    assert.equal(new URL(origin).protocol, "https:", `${origin} must be an https origin`);
    for (const [path, kind] of Object.entries(paths)) {
      const url = new URL(path, origin);
      assert.equal(url.origin, origin, `${path} must stay on ${origin}`);
      assert.equal(
        url.pathname,
        path,
        `${path} must be written as the browser requests it, without a query or fragment`
      );
      assert.ok(!path.endsWith("/"), `${path} must name one resource, not a directory`);
      assert.equal(
        remoteEmbedStub(url.href, kind)?.contentType,
        STUB_CONTENT_TYPE[kind],
        `${url.href} must be answered with a ${kind} stub`
      );
    }
  }
});

test("a remote address is stubbed only by exact origin, path, and kind", () => {
  const known = "https://rohinshanker.github.io/pulse-oximeter/site-assets/demo-photo.jpg";
  assert.equal(remoteEmbedStub(known, "image").contentType, "image/png");
  assert.ok(
    remoteEmbedStub(`${known}?width=640#figure`, "image"),
    "A query string or fragment does not change which embed is asked for"
  );
  for (const [url, resourceType, reason] of [
    [known, "fetch", "a script reading an address approved as an image"],
    [known, "media", "a listed image requested as media"],
    [`${known}/extra`, "image", "a path beneath a listed one"],
    ["https://rohinshanker.github.io/pulse-oximeter/site-assets/", "image", "a listed path's directory"],
    ["https://rohinshanker.github.io/pulse-oximeter/site-assets/new.jpg", "image", "a sibling of a listed path"],
    ["https://rohinshanker.github.io/", "document", "a listed origin's root"],
    [known.replace("https:", "http:"), "image", "a listed path over another scheme"],
    [known.replace("github.io", "github.io.example.invalid"), "image", "a listed path on a lookalike host"],
    ["https://images.example.invalid/unlisted.png", "image", "an unknown image"],
    ["https://media.example.invalid/unlisted.mp4", "media", "unknown media"],
    ["https://embeds.example.invalid/player", "document", "an unknown document"],
  ]) {
    assert.equal(remoteEmbedStub(url, resourceType), undefined, `${reason} must not be stubbed`);
  }
});

test("a local mock answers only for the test server's own file", () => {
  assert.equal(TEST_SERVER_ORIGIN, resolveUiTestBaseUrl());
  const path = "scripts/home/game-stats-backend.js";
  const matches = servedFile(path);
  assert.ok(matches(new URL(`${TEST_SERVER_ORIGIN}/${path}`)));
  assert.ok(
    matches(new URL(`${TEST_SERVER_ORIGIN}/${path}?v=cache-token#top`)),
    "A cache token or fragment does not change which file is asked for"
  );
  const server = new URL(TEST_SERVER_ORIGIN);
  for (const [url, reason] of [
    [`https://assets.example.invalid/${path}`, "the same path on a remote host"],
    [`http://${server.hostname}:${Number(server.port) + 1}/${path}`, "the same path on another port"],
    [`http://localhost:${server.port}/${path}`, "the same path under another host name"],
    [`${TEST_SERVER_ORIGIN}/mirror/${path}`, "the same file name beneath another directory"],
    [`${TEST_SERVER_ORIGIN}/${path}.map`, "a longer file name"],
  ]) {
    assert.ok(!matches(new URL(url)), `${reason} must not be answered by the mock`);
  }
});

test("the Sky generator stand-in answers only the exact download", () => {
  const download = "https://perchance.org/api/downloadGenerator";
  assert.ok(
    isSkyNameGeneratorRequest(new URL(`${download}?generatorName=sky-cotl-namegen&listsOnly=true`))
  );
  assert.ok(
    isSkyNameGeneratorRequest(new URL(`${download}?listsOnly=true&generatorName=sky-cotl-namegen`)),
    "Parameter order does not change which download is asked for"
  );
  for (const [url, reason] of [
    [`${download}-typo?generatorName=sky-cotl-namegen&listsOnly=true`, "a mistyped path"],
    [`${download}/extra?generatorName=sky-cotl-namegen&listsOnly=true`, "a path beneath the download"],
    [`${download}?generatorName=another-generator&listsOnly=true`, "another generator"],
    [`${download}?generatorName=sky-cotl-namegen`, "a download without the lists-only flag"],
    [`${download}?generatorName=sky-cotl-namegen&listsOnly=true&extra=1`, "an extra parameter"],
    [download, "the bare endpoint"],
    [
      "https://perchance.org.example.invalid/api/downloadGenerator?generatorName=sky-cotl-namegen&listsOnly=true",
      "a lookalike host",
    ],
    [
      "http://perchance.org/api/downloadGenerator?generatorName=sky-cotl-namegen&listsOnly=true",
      "another scheme",
    ],
  ]) {
    assert.ok(!isSkyNameGeneratorRequest(new URL(url)), `${reason} must not be answered`);
  }
});
