import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Minesweeper offsets only the uneven smile face toward visual center", async () => {
  const styles = await readFile(new URL("styles/home/apps/minesweeper.css", root), "utf8");

  assert.match(
    styles,
    /\.ms-reset\[data-face="smile"\]::before \{[\s\S]*?background-position: calc\(50% - 1px\) center;/
  );
  assert.doesNotMatch(
    styles,
    /\.ms-reset\[data-face="(?:ooh|pressed|lose|win)"\]::before \{[\s\S]*?background-position:/
  );
});
