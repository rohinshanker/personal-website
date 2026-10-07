import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { readHomeScript, repositoryRoot } from "./helpers/home-scripts.mjs";
import {
  contractImports,
  contractPublications,
  loadHomeContractGraph,
} from "./helpers/home-contracts.mjs";

test("whole-contract rule aliases remain part of the load dependency graph", () => {
  assert.deepEqual(contractImports(`
const { initial, transition } = window.homeSnakeRules;
const solRules = window.homeSolitaireRules;
const sudokuRules = window.homeSudokuRules;
const ordinaryValue = window.innerWidth;
`), [
    { contract: "homeSnakeRules", names: ["initial", "transition"] },
    { contract: "homeSolitaireRules", names: [] },
    { contract: "homeSudokuRules", names: [] },
  ]);
});

/**
 * The Home page loads ordered classic scripts, so a module can only read a
 * contract that an earlier script already published. These tests derive the
 * real graph from the files and from `home.html`, so a missing export, a typo
 * in a destructure, or a script moved later than something that needs it fails
 * here rather than as a blank desktop in the browser.
 */

async function loadHomeGraph() {
  const { files, sources, publishedBy, duplicates } = await loadHomeContractGraph();
  const home = await readFile(new URL("home.html", repositoryRoot), "utf8");

  assert.deepEqual(duplicates, [], "a contract must have exactly one owner");

  // Script order as the browser sees it. Attribute order varies, and one tag
  // spans several lines, so this matches the `src` itself.
  const eagerOrder = [...home.matchAll(/src="(scripts\/home\/[^"?]+)(?:\?[^"]*)?"/g)].map(
    (match) => match[1]
  );
  const order = [
    ...eagerOrder,
    "scripts/home/admin/orchestrator.js",
    "scripts/home/admin-controls.js",
  ];

  return { eagerOrder, files, sources, order, publishedBy, home };
}

test("every Home script is loaded by home.html exactly once", async () => {
  const { eagerOrder, files } = await loadHomeGraph();
  const loadable = files.filter((file) => !file.endsWith(".worker.js"));
  const lazy = new Set([
    "scripts/home/admin/orchestrator.js",
    "scripts/home/admin-controls.js",
  ]);

  for (const file of loadable) {
    const count = eagerOrder.filter((src) => src === file).length;
    assert.equal(
      count,
      lazy.has(file) ? 0 : 1,
      file + " should have the expected eager Home load count, saw " + count
    );
  }
  for (const src of eagerOrder) {
    assert.ok(loadable.includes(src), "home.html loads " + src + ", which is not a Home script");
  }
});

test("Home classic scripts defer in dependency order and Admin stays ordered on demand", async () => {
  const { home } = await loadHomeGraph();
  const classicTags = [...home.matchAll(/<script\b([^>]*)\bsrc="scripts\/home\/[^"]+"([^>]*)><\/script>/g)]
    .map((match) => match.slice(1).join(" "))
    .filter((attributes) => !/\btype="module"/.test(attributes));
  assert.ok(classicTags.length > 40);
  classicTags.forEach((attributes) => assert.match(attributes, /\bdefer\b/));

  const resources = await readHomeScript("resources");
  assert.ok(
    resources.indexOf("scripts/home/admin/orchestrator.js") <
      resources.indexOf("scripts/home/admin-controls.js"),
    "Admin orchestrator must load before its controller"
  );
});

test("each imported contract name is published by its owner", async () => {
  const { files, sources, publishedBy } = await loadHomeGraph();

  for (const file of files) {
    for (const { contract, names } of contractImports(sources[file])) {
      const owner = publishedBy.get(contract);
      assert.ok(owner, `${file} imports window.${contract}, which no Home script publishes`);
      for (const name of names) {
        assert.ok(
          owner.names.has(name),
          `${file} imports ${name} from window.${contract}, but ${owner.file} does not publish it`
        );
      }
    }
  }
});

test("a contract is published before any script that reads it", async () => {
  const { files, sources, order, publishedBy } = await loadHomeGraph();
  const position = new Map(order.map((src, index) => [src, index]));

  for (const file of files) {
    if (!position.has(file)) continue;
    for (const { contract } of contractImports(sources[file])) {
      const owner = publishedBy.get(contract);
      if (!owner || !position.has(owner.file)) continue;
      assert.ok(
        position.get(owner.file) < position.get(file),
        `${file} reads window.${contract} at load time, so ${owner.file} must come earlier in home.html`
      );
    }
  }
});

test("no Home script publishes a name it does not declare", async () => {
  const { files, sources } = await loadHomeGraph();

  for (const file of files) {
    const source = sources[file];
    for (const { contract, shorthand } of contractPublications(source)) {
      const before = source.slice(0, source.indexOf(`window.${contract} =`));
      for (const name of shorthand) {
        const declared = new RegExp(
          `(?:const|let|var|function|class)\\s+${name}\\b`,
          "m"
        ).test(before);
        assert.ok(declared, `${file} publishes ${name} without declaring it`);
      }
    }
  }
});

test("main.js stays a boot entry rather than a feature module", async () => {
  const source = await readHomeScript("boot");
  const lines = source.split("\n").length;

  assert.ok(
    lines < 160,
    `scripts/home/main.js should stay a small boot entry; it is ${lines} lines`
  );
  assert.ok(
    !/Object\.freeze\(\{[\s\S]*\}\)\s*;/.test(source.replace(/window\.home[A-Za-z]*\s*=\s*/, "")) ||
      !/window\.homeBoot/.test(source),
    "the boot entry should not publish a contract of its own"
  );
});

test("the eager shared-shell table stays small", async () => {
  const source = await readHomeScript("dom");
  const entries = [...source.matchAll(/^\s{2}[A-Za-z_$][\w$]*:/gm)].length;

  assert.ok(
    entries <= 16,
    `core/dom.js should only hold shared shell elements and lookup helpers; it has ${entries} entries`
  );
});
