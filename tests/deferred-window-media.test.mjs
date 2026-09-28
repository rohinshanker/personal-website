import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const main = await readFile(new URL("../scripts/home/main.js", import.meta.url), "utf8");

const functionBody = (name) => {
  const start = main.indexOf(`const ${name} =`);
  assert.notEqual(start, -1, `missing ${name}`);
  const arrow = main.indexOf("=>", start);
  const brace = main.indexOf("{", arrow);
  let depth = 0;
  for (let index = brace; index < main.length; index += 1) {
    if (main[index] === "{") depth += 1;
    if (main[index] === "}") depth -= 1;
    if (depth === 0) return main.slice(start, index + 1);
  }
  assert.fail(`unterminated ${name}`);
};

test("managed event setup runs before deferred media activation", () => {
  const body = functionBody("showManagedRandomEventWindow");
  // Match only live statements: a commented-out call must not satisfy this.
  const setupIndex = body.search(/^[ \t]*if \(beforeShow\) beforeShow\(\);/m);
  const loadIndex = body.search(/^[ \t]*loadDeferredMedia\(win\);/m);

  assert.notEqual(setupIndex, -1);
  assert.notEqual(loadIndex, -1);
  assert.ok(setupIndex < loadIndex);
});
