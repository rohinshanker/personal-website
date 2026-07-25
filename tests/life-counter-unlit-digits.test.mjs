import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Counter pads unused display slots with unlit digital assets", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");

  assert.match(
    source,
    /const LIFE_COUNTER_DIGIT_SOURCES = \{[\s\S]*?" ": "assets\/minesweeper_assets\/digital_digits\/digital_unlit\.png",/
  );
  assert.match(
    source,
    /const formatLifeCounterDigits = \(value\) => \{[\s\S]*?return `-\$\{String\(Math\.abs\(normalized\)\)\.padStart\(4, " "\)\}`;[\s\S]*?return String\(normalized\)\.padStart\(5, " "\);/
  );
  assert.doesNotMatch(source, /String\(normalized\)\.padStart\(5, "0"\)/);
});
