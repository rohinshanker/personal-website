import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { sourceBetween } from "./helpers/source-runtime.mjs";

test("the production face setter exposes every game state through the reset control", async () => {
  const source = await readHomeScript("minesweeper");
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const attributes = new Map();",
      "const msReset = { setAttribute: (name, value) => attributes.set(name, value) };",
      sourceBetween(source, "const msSetFace =", "\n\nconst msSetMarkMode"),
      "globalThis.setFace = msSetFace;",
      "globalThis.readFace = () => attributes.get('data-face');",
    ].join("\n"),
    context
  );

  for (const face of ["smile", "ooh", "pressed", "lose", "win"]) {
    context.setFace(face);
    assert.equal(context.readFace(), face);
  }
});
