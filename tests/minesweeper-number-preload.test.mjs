import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Minesweeper preloads every revealed-cell number when its window opens", async () => {
  const main = await readFile(new URL("scripts/home/main.js", root), "utf8");

  assert.match(
    main,
    /const MS_CELL_NUMBER_SOURCES = Object\.freeze\([\s\S]*?\{ length: 8 \}[\s\S]*?cell_\$\{index \+ 1\}\.png/
  );
  assert.match(
    main,
    /const preloadMinesweeperNumberAsset = \(src\) => \{[\s\S]*?document\.createElement\("link"\)[\s\S]*?preload\.rel = "preload"[\s\S]*?preload\.as = "image"[\s\S]*?preload\.href = src[\s\S]*?document\.head\.append\(preload\)[\s\S]*?msNumberAssetPreloads\.set\(src, \{ element: preload, promise \}\)/
  );
  assert.match(
    main,
    /const preloadMinesweeperNumberAssets = \(\) =>\s*Promise\.all\(MS_CELL_NUMBER_SOURCES\.map\(preloadMinesweeperNumberAsset\)\)/
  );
  assert.match(
    main,
    /if \(open\) \{\s*if \(appId === "minesweeper"\) \{\s*void preloadMinesweeperNumberAssets\(\);/
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
