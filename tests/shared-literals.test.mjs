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
  const [home, landing, modeling, admin] = await Promise.all([
    read("home.html"), read("index.html"), read("modeling/index.html"), read("scripts/home/admin-controls.js"),
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
    assert.equal(stylesheet, onlyReference(home, stylesheet.split("?")[0]));
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
