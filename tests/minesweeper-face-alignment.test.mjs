import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { sourceBetween } from "./helpers/source-runtime.mjs";

const root = new URL("../", import.meta.url);

test("only the uneven smile face receives the one-pixel centering offset", async () => {
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
