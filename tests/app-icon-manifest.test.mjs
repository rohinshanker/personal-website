import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import {
  getAppIconNames,
  renderAppIconManifest,
} from "../scripts/build-app-icon-manifest.mjs";

const manifestUrl = new URL("../scripts/home/app-icon-manifest.js", import.meta.url);

const readManifestIconNames = async () => {
  const source = await readFile(manifestUrl, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: manifestUrl.pathname });
  return { iconNames: context.window.rohinAppIconManifest, source };
};

test("app icon manifest exactly matches the .ico filesystem inventory", async () => {
  const [filesystemIconNames, { iconNames: manifestIconNames }] = await Promise.all([
    getAppIconNames(),
    readManifestIconNames(),
  ]);

  assert.ok(Array.isArray(manifestIconNames), "Manifest must assign an array.");
  assert.deepEqual(Array.from(manifestIconNames), filesystemIconNames);
});

test("app icon manifest is deterministic and has no duplicate filenames", async () => {
  const [filesystemIconNames, { source }] = await Promise.all([
    getAppIconNames(),
    readManifestIconNames(),
  ]);

  assert.equal(new Set(filesystemIconNames).size, filesystemIconNames.length);
  assert.deepEqual([...filesystemIconNames].sort(), filesystemIconNames);
  assert.equal(source, renderAppIconManifest(filesystemIconNames));
});
