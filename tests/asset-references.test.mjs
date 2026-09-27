import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const rootPath = path.dirname(new URL("package.json", root).pathname);

/** Shipped files whose literal `assets/…` references must resolve on a case-sensitive host. */
const SHIPPED_SOURCES = [
  "index.html",
  "home.html",
  "style.css",
  "sitemap.xml",
  "modeling/index.html",
  "modeling/style.css",
  "modeling/script.js",
  "video-editor/index.html",
  "video-editor/style.css",
  "video-editor/script.js",
  "video-editor/cursor.js",
  "video-editor/audio-analysis.js",
  "styles/home/base.css",
  "styles/home/portfolio.css",
  "styles/home/random-events.css",
  "styles/home/cursors.css",
  "styles/home/admin-controls.css",
  "styles/home/study-resources.css",
  "styles/home/apps/minesweeper.css",
  "styles/home/apps/solitaire.css",
  "styles/home/apps/snake.css",
  "styles/home/apps/sudoku.css",
  "styles/home/apps/game-stats.css",
  "styles/home/apps/life-counter.css",
  "scripts/home/main.js",
  "scripts/home/core/dom.js",
  "scripts/home/core/media.js",
  "scripts/home/system-alerts.js",
  "scripts/home/modeling-portfolio.js",
  "scripts/home/admin-controls.js",
  "scripts/home/text-selection-cursor.js",
  "scripts/home/app-icon-manifest.js",
];

/**
 * A repository asset path: optionally `../`-prefixed or root-relative, never a
 * segment of an external URL or of another name such as `site-assets/`.
 */
const ASSET_REFERENCE_PATTERN = /(?<![\w/.-])(?:\.\.\/)*\/?assets\/[^"'`()<>?#,\n]+/g;

const decodeReference = (reference) => {
  try {
    return decodeURIComponent(reference);
  } catch {
    return reference;
  }
};

/** Resolves a repository-relative path one segment at a time with exact-case directory listings. */
const existsWithExactCase = async (relativePath) => {
  let current = rootPath;
  for (const segment of relativePath.split("/")) {
    let entries;
    try {
      entries = await readdir(current);
    } catch {
      return false;
    }
    if (!entries.includes(segment)) return false;
    current = path.join(current, segment);
  }
  return true;
};

const collectReferences = async () => {
  const references = new Map();
  for (const source of SHIPPED_SOURCES) {
    const text = await readFile(new URL(source, root), "utf8");
    for (const [match] of text.matchAll(ASSET_REFERENCE_PATTERN)) {
      // Template literals and documented `{placeholder}` patterns are runtime shapes, not files.
      if (match.includes("${") || match.includes("{")) continue;
      const normalized = decodeReference(match.replace(/^(?:\.\.\/)+/, "").replace(/^\//, ""))
        .replace(/[\s.;:]+$/, "");
      references.set(normalized, (references.get(normalized) ?? new Set()).add(source));
    }
  }
  return references;
};

test("every literal asset reference in shipped sources resolves with exact case", async () => {
  const references = await collectReferences();
  assert.ok(references.size > 300, `expected a full reference sweep, found ${references.size}`);
  const unresolved = [];
  for (const [reference, sources] of references) {
    if (!(await existsWithExactCase(reference))) {
      unresolved.push(`${reference} (from ${[...sources].join(", ")})`);
    }
  }
  assert.deepEqual(unresolved, []);
});

test("every modeling portfolio shoot file resolves with exact case", async () => {
  const data = await readFile(new URL("scripts/home/modeling-portfolio.js", root), "utf8");
  const files = [];
  for (const [, folder, list] of data.matchAll(/folder:\s*"([^"]+)",\s*files:\s*\[([^\]]*)\]/g)) {
    for (const [, file] of list.matchAll(/"([^"]+)"/g)) files.push(`${folder}/${file}`);
  }
  assert.ok(files.length > 100, `expected the shoot inventory, found ${files.length}`);
  const unresolved = [];
  for (const file of files) {
    if (!(await existsWithExactCase(decodeReference(file)))) unresolved.push(file);
  }
  assert.deepEqual(unresolved, []);
});
