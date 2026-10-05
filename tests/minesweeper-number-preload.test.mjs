import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { plain, sourceBetween } from "./helpers/source-runtime.mjs";

const root = new URL("../", import.meta.url);

test("the production preload function requests all eight number assets with retention", async () => {
  const source = await readHomeScript("minesweeper");
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const calls = [];",
      "const mediaSourcePreloadRequests = new Map();",
      "const preloadMediaSource = async (src, options) => { calls.push({ src, options }); return src; };",
      sourceBetween(source, "const MS_CELL_NUMBER_SOURCES =", "\n\nconst msConfig ="),
      "globalThis.preload = preloadMinesweeperNumberAssets;",
      "globalThis.readCalls = () => calls;",
    ].join("\n"),
    context
  );

  const loaded = await context.preload();
  const expected = Array.from(
    { length: 8 },
    (_, index) => `assets/minesweeper_assets/cell_numbers/cell_${index + 1}.png`
  );
  assert.deepEqual(plain(loaded), expected);
  assert.deepEqual(
    plain(context.readCalls()),
    expected.map((src) => ({ src, options: { retainImagePreload: true } }))
  );
  await Promise.all(expected.map((path) => access(new URL(path, root))));
});
