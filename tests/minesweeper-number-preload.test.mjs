import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { readHomeScript } from "./helpers/home-scripts.mjs";

const root = new URL("../", import.meta.url);

test("Minesweeper preloads every revealed-cell number when its window opens", async () => {
  const main = await readHomeScript("minesweeper");

  assert.match(
    main,
    /const MS_CELL_NUMBER_SOURCES = Object\.freeze\([\s\S]*?\{ length: 8 \}[\s\S]*?cell_\$\{index \+ 1\}\.png/
  );
  assert.match(
    main,
    /const msNumberAssetPreloads = mediaSourcePreloadRequests;[\s\S]*?preloadMediaSource\(src, \{ retainImagePreload: true \}\)/
  );
  assert.match(
    main,
    /const preloadMinesweeperNumberAssets = \(\) =>\s*Promise\.all\(MS_CELL_NUMBER_SOURCES\.map\(preloadMinesweeperNumberAsset\)\)/
  );
  assert.match(
    main,
    /registerWindowLifecycle\("minesweeper", \{\s*beforeOpen: \(\) => \{\s*void preloadMinesweeperNumberAssets\(\);/
  );

  await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      access(
        new URL(
          `assets/minesweeper_assets/cell_numbers/cell_${index + 1}.png`,
          root
        )
      )
    )
  );
});
