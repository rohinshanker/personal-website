import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildStudyResourcesManifest,
  renderStudyResourcesManifest,
} from "../scripts/build-study-resources-manifest.mjs";

const MANIFEST_URL = new URL(
  "../assets/study resources/manifest.json",
  import.meta.url
);

test("the tracked study resources manifest matches its PDF inventory", async () => {
  const manifest = buildStudyResourcesManifest();
  const source = await readFile(MANIFEST_URL, "utf8");

  assert.equal(source, renderStudyResourcesManifest(manifest));
  assert.deepEqual(JSON.parse(source), manifest);
});

test("the study resources manifest declares its public base path", () => {
  const manifest = buildStudyResourcesManifest();

  assert.equal(manifest.root, "Study Resources");
  assert.equal(manifest.basePath, "assets/study%20resources");
  assert.ok(Array.isArray(manifest.files));
  for (const file of manifest.files) {
    assert.match(file.name, /\.pdf$/i);
    assert.ok(file.path.startsWith("assets/study%20resources/"));
    assert.doesNotMatch(file.path, / /);
    assert.ok(file.sizeBytes > 0);
    assert.deepEqual(file.thumbnailPages, [1, 2, 3]);
    assert.equal(file.downloadName, file.name);
  }
});
