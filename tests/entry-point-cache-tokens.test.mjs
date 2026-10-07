import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);

/** Every public HTML entry point, keyed by its repository path. */
const ENTRY_POINTS = Object.freeze([
  "index.html",
  "home.html",
  "modeling/index.html",
  "video-editor/index.html",
]);

const ASSET_REFERENCE_PATTERN = /\b(?:href|src)="([^"?]+\.(?:css|js))(?:\?v=([^"]+))?"/g;
const WARMUP_ENTRY_PATTERN = /\["([^"]+)", "(?:style|script|worker)"\]/g;

/** Local stylesheet and script references, resolved to repository paths. */
const readAssetReferences = (entryPoint, source) => {
  const references = [];
  for (const [, assetPath, token] of source.matchAll(ASSET_REFERENCE_PATTERN)) {
    if (/^(?:https?:)?\/\//.test(assetPath)) continue;
    references.push({
      entryPoint,
      reference: `${assetPath}${token ? `?v=${token}` : ""}`,
      repositoryPath: path.posix.normalize(
        path.posix.join(path.posix.dirname(entryPoint), assetPath)
      ),
      token: token ?? null,
    });
  }
  return references;
};

const readWarmupList = (indexSource) => {
  const start = indexSource.indexOf("const homeWarmupResources = [");
  const end = indexSource.indexOf("];", start);
  assert.ok(start >= 0 && end > start, "index.html must define homeWarmupResources");
  return [...indexSource.slice(start, end).matchAll(WARMUP_ENTRY_PATTERN)].map(
    ([, reference]) => reference
  );
};

const sources = new Map(
  await Promise.all(
    ENTRY_POINTS.map(async (entryPoint) => [
      entryPoint,
      await readFile(new URL(entryPoint, root), "utf8"),
    ])
  )
);
const resourceLoader = await readFile(
  new URL("scripts/home/core/resources.js", root),
  "utf8"
);
const references = ENTRY_POINTS.flatMap((entryPoint) =>
  readAssetReferences(entryPoint, sources.get(entryPoint))
);

test("every stylesheet and script reference carries a cache-busting token", () => {
  const untokened = references.filter(({ token }) => !token);
  assert.deepEqual(
    untokened.map(({ entryPoint, reference }) => `${entryPoint}: ${reference}`),
    []
  );
  assert.ok(references.length >= 30, "the entry points must reference their shared assets");
});

test("each shared asset uses exactly one token across every entry point", () => {
  const tokensByAsset = new Map();
  for (const { repositoryPath, token } of references) {
    tokensByAsset.set(repositoryPath, (tokensByAsset.get(repositoryPath) ?? new Set()).add(token));
  }
  const drifted = [...tokensByAsset]
    .filter(([, tokens]) => tokens.size > 1)
    .map(([repositoryPath, tokens]) => `${repositoryPath}: ${[...tokens].join(", ")}`);
  assert.deepEqual(drifted, []);
});

test("the index.html warm-up list mirrors the home.html asset tags", () => {
  const home = sources.get("home.html");
  const index = sources.get("index.html");
  const warmup = readWarmupList(index);
  assert.ok(warmup.length > 0);
  const missingFromHome = warmup.filter(
    (reference) => !home.includes(`href="${reference}"`) && !home.includes(`src="${reference}"`)
  );
  assert.deepEqual(missingFromHome, []);

  const indexReferences = new Set(
    readAssetReferences("index.html", index).map(({ reference }) => reference)
  );
  const warmupSet = new Set(warmup);
  const unwarmed = readAssetReferences("home.html", home)
    .map(({ reference }) => reference)
    .filter((reference) => !warmupSet.has(reference) && !indexReferences.has(reference));
  assert.deepEqual(unwarmed, []);
});

test("on-demand event and Admin resources stay tokened and outside entry warm-up", () => {
  const onDemand = [
    "styles/home/random-events.css",
    "styles/home/admin-controls.css",
    "scripts/home/admin/orchestrator.js",
    "scripts/home/admin-controls.js",
  ];
  const warmup = readWarmupList(sources.get("index.html"));
  const home = sources.get("home.html");
  onDemand.forEach((path) => {
    assert.match(resourceLoader, new RegExp(`${path.replaceAll("/", "\\/")}\\?v=[^\"]+`));
    assert.equal(warmup.some((reference) => reference.startsWith(`${path}?`)), false);
    assert.equal(home.includes(`href="${path}?`), false);
    assert.equal(home.includes(`src="${path}?`), false);
  });
});
