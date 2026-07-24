import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("profile icon gallery keeps only one vertical arrow at each scrollbar end", async () => {
  const css = await readFile(new URL("styles/home/apps/game-stats.css", root), "utf8");

  assert.match(
    css,
    /\.game-profile-icon-gallery::-webkit-scrollbar-button:vertical:start:increment,[\s\S]*?vertical:end:decrement[\s\S]*?display: none;/
  );
  assert.match(
    css,
    /\.game-profile-icon-gallery::-webkit-scrollbar-button:vertical:start:decrement,[\s\S]*?vertical:end:increment[\s\S]*?display: block;/
  );
  assert.match(
    css,
    /vertical:start:decrement \{[\s\S]*?button-up\.svg/
  );
  assert.match(
    css,
    /vertical:end:increment \{[\s\S]*?button-down\.svg/
  );
});
