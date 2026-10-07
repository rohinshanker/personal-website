import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const assetReferences = (source, path, base = "/") => [...source.matchAll(/["']([^"'\s]+\?v=[^"'\s]+)["']/g)]
  .map((match) => {
    const url = new URL(match[1], `https://site.test${base}`);
    return url.pathname.slice(1) + url.search;
  })
  .filter((reference) => reference.split("?")[0] === path);
const onlyReference = (source, path, base) => {
  const references = [...new Set(assetReferences(source, path, base))];
  assert.equal(references.length, 1, `one version for ${path}`);
  return references[0];
};

test("shared route assets and preview styles retain identical cache versions", async () => {
  const [home, landing, modeling, admin, resources] = await Promise.all([
    read("home.html"), read("index.html"), read("modeling/index.html"), read("scripts/home/admin-controls.js"),
    read("scripts/home/core/resources.js"),
  ]);
  for (const path of ["style.css", "scripts/home/modeling-portfolio.js", "scripts/home/core/media.js"]) {
    for (const [route, base] of [[landing, "/"], [modeling, "/modeling/"]]) {
      assert.equal(onlyReference(route, path, base), onlyReference(home, path), path);
    }
  }
  const previewArray = admin.match(/const EVENT_PREVIEW_STYLESHEETS = Object\.freeze\((\[[\s\S]*?\])\)/)?.[1];
  assert.ok(previewArray, "preview stylesheet contract exists");
  const stylesheets = vm.runInNewContext(previewArray);
  assert.equal(stylesheets.length, 3);
  for (const stylesheet of stylesheets) {
    const path = stylesheet.split("?")[0];
    const source = path === "styles/home/random-events.css" ? resources : home;
    assert.equal(stylesheet, onlyReference(source, path));
  }
});

test("Video Editor authentication and CSS agree on the desktop boundary", async () => {
  const [script, css] = await Promise.all([read("video-editor/script.js"), read("video-editor/style.css")]);
  const boundary = script.match(/const desktopEditorQuery = window\.matchMedia\("\(min-width: (\d+)px\)"\)/)?.[1];
  assert.ok(boundary, "authentication has an explicit desktop boundary");
  const desktopRules = [...css.matchAll(/@media[^\{]*\(min-width: (\d+)px\)/g)].map((match) => Number(match[1]));
  assert.ok(desktopRules.length >= 2);
  for (const width of desktopRules) assert.equal(width, Number(boundary));
  const mobileRule = css.match(/@media \(max-width: (\d+)px\)\s*\{\s*body\.video-editor-page/);
  assert.ok(mobileRule);
  assert.equal(Number(mobileRule[1]) + 1, Number(boundary));
});

test("the shared Administrator profile matches the independently deployed Worker", async () => {
  const [session, worker] = await Promise.all([
    read("scripts/home/core/administrator-session.js"),
    read("workers/game-stats/src/constants.mjs"),
  ]);
  const context = vm.createContext({ window: {} });
  vm.runInContext(session, context);
  const profile = context.window.homeAdministratorSession.ADMINISTRATOR_PROFILE;
  const workerConstant = (name) => {
    const value = worker.match(new RegExp(`export const ${name} = "([^"]+)";`))?.[1];
    assert.ok(value, `${name} must exist in the Worker`);
    return value;
  };
  assert.equal(profile.id, workerConstant("ADMINISTRATOR_PROFILE_ID"));
  assert.equal(profile.name, workerConstant("ADMINISTRATOR_PROFILE_NAME"));
  assert.equal(profile.icon, workerConstant("ROHIN_NEKO_AVATAR_ICON"));
});

test("shared browser modules load before their route consumers and retain matching versions", async () => {
  const [home, landing, editor, modeling] = await Promise.all([
    read("home.html"), read("index.html"), read("video-editor/index.html"), read("modeling/index.html"),
  ]);
  for (const module of ["cursor-mode", "administrator-session"]) {
    const path = `scripts/home/core/${module}.js`;
    const reference = onlyReference(home, path);
    assert.equal(onlyReference(landing, path), reference, "landing prefetch matches Home");
    assert.equal(onlyReference(editor, path, "/video-editor/"), reference, "editor matches Home");
    assert.ok(home.indexOf(reference) < home.indexOf('src="scripts/home/main.js?'), `${module} before Home`);
    const consumer = module === "cursor-mode" ? "cursor.js" : "script.js";
    assert.ok(editor.indexOf(path) < editor.indexOf(`src="${consumer}?`), `${module} before editor`);
    if (module !== "cursor-mode") continue;
    assert.equal(onlyReference(modeling, path, "/modeling/"), reference, "modeling matches Home");
    assert.ok(
      modeling.indexOf(path) < modeling.indexOf('src="cursor.js?'),
      "cursor-mode before the modeling adapter"
    );
  }
  assert.ok(home.indexOf('src="scripts/home/core/media.js?') < home.indexOf('src="scripts/home/main.js?'));
  assert.ok(modeling.indexOf('src="../scripts/home/core/media.js?') < modeling.indexOf('src="script.js?'));
});

test("cursor preloads and CSS name the same generated images and animation frames", async () => {
  const [runtime, css] = await Promise.all([
    read("scripts/home/core/cursor-mode.js"), read("styles/home/cursors.css"),
  ]);
  const fetched = [];
  const context = vm.createContext({
    URL,
    document: { currentScript: { src: "https://site.test/scripts/home/core/cursor-mode.js" } },
    window: { fetch: async (url) => { fetched.push(url.pathname); } },
  });
  vm.runInContext(runtime, context);
  await context.window.RohinCursorRuntime.preloadMode("light");
  await context.window.RohinCursorRuntime.preloadMode("dark");
  const runtimeImages = [...new Set(fetched.filter((path) => path.endsWith(".png")))].sort();
  const cssImages = [...new Set([...css.matchAll(/url\("([^"\n]+\.png)"\)/g)]
    .map((match) => new URL(match[1], "https://site.test/styles/home/cursors.css").pathname))].sort();
  assert.ok(cssImages.length > 0);
  assert.deepEqual(runtimeImages, cssImages);
});
