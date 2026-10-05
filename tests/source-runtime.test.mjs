import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { plain } from "./helpers/source-runtime.mjs";

test("plain normalizes VM values without dropping undefined-valued keys", () => {
  const value = vm.runInNewContext(
    "({ present: undefined, nested: { missing: undefined }, list: [undefined] })"
  );

  const normalized = plain(value);

  assert.equal(Object.getPrototypeOf(normalized), Object.prototype);
  assert.equal(Object.hasOwn(normalized, "present"), true);
  assert.equal(Object.hasOwn(normalized.nested, "missing"), true);
  assert.deepEqual(normalized, {
    present: undefined,
    nested: { missing: undefined },
    list: [undefined],
  });
});
