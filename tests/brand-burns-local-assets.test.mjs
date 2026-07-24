import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const apostleIds = Object.freeze([
  "femto",
  "zodd",
  "grunbeld",
  "borkoff",
  "locus",
  "irvine",
  "ganishka",
  "wyald",
  "snake-lord",
  "rakshas",
]);

test("Brand Burns bundles every Apostle image for localhost rendering", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const start = source.indexOf("const BRAND_BURNS_FEMTO =");
  const end = source.indexOf("const INFINITY_ARMORY_STARTING_GOLD", start);
  assert.notEqual(start, -1, "Brand Burns should define Femto");
  assert.notEqual(end, -1, "Brand Burns Apostle definitions should be bounded");
  const definitions = source.slice(start, end);

  assert.doesNotMatch(definitions, /https?:\/\//i);
  assert.doesNotMatch(definitions, /static\.wikia\.nocookie\.net/i);

  for (const id of apostleIds) {
    const asset = `assets/random%20events/brand-burns/${id}.webp`;
    assert.match(definitions, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const localAsset = new URL(asset.replaceAll("%20", " "), root);
    await access(localAsset);
    assert.ok((await stat(localAsset)).size > 0, `${id} image should not be empty`);
  }

  assert.match(
    source,
    /const brandBurnsPreloadTargets = \(\) => \[[\s\S]*?BRAND_BURNS_FEMTO\.image,[\s\S]*?BRAND_BURNS_APOSTLES\.map\(\(apostle\) => apostle\.image\)/
  );
});
