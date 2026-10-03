import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { findForwardReferences } from "./helpers/js-load-order.mjs";
import { listHomeScriptFiles, repositoryRoot } from "./helpers/home-scripts.mjs";

/**
 * Within one Home script, a statement that runs while the script loads may only
 * read bindings declared above it: `const` and `let` sit in their temporal dead
 * zone until their declaration runs, so a top-level object literal that names a
 * binding further down the file throws a ReferenceError and takes the whole
 * feature with it. Splitting the monolith made this easy to get wrong, and the
 * browser was the only other place that showed it.
 */

test("the forward-reference scan sees eager reads and ignores deferred ones", () => {
  const eager = [
    "(() => {",
    "const table = Object.freeze([{ items: LATER }]);",
    "",
    "const LATER = [1];",
    "})();",
  ].join("\n");
  assert.deepEqual(findForwardReferences(eager), [
    "2 reads LATER, declared at line 4",
  ]);

  const declaredFirst = [
    "(() => {",
    "const LATER = [1];",
    "",
    "const table = Object.freeze([{ items: LATER }]);",
    "})();",
  ].join("\n");
  assert.deepEqual(findForwardReferences(declaredFirst), []);

  // A function body runs after the script finishes loading, braced or not.
  for (const body of ["() => LATER", "() => {\n  return LATER;\n}"]) {
    const deferred = `(() => {\nconst read = ${body};\n\nconst LATER = [1];\n})();\n`;
    assert.deepEqual(findForwardReferences(deferred), [], body);
  }

  // One literal may both defer a read and make an eager one.
  const mixed = [
    "(() => {",
    "const entry = { read: () => LATER, value: LATER };",
    "",
    "const LATER = 1;",
    "})();",
  ].join("\n");
  assert.deepEqual(findForwardReferences(mixed), [
    "2 reads LATER, declared at line 4",
  ]);

  // The scan also covers the one Home script that is an ES module.
  assert.deepEqual(findForwardReferences("const first = SECOND;\nconst SECOND = 2;\n"), [
    "1 reads SECOND, declared at line 2",
  ]);
});

test("no Home script reads a top-level binding before it is declared", async () => {
  const problems = [];

  for (const file of listHomeScriptFiles()) {
    const source = await readFile(new URL(file, repositoryRoot), "utf8");
    for (const problem of findForwardReferences(source)) {
      problems.push(`${file}:${problem}`);
    }
  }

  assert.deepEqual(
    problems,
    [],
    `a statement that runs at load time read a binding declared later:\n  ${problems.join("\n  ")}`
  );
});
