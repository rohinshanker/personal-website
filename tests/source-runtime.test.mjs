import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { plain, sourceBetween } from "./helpers/source-runtime.mjs";

test("source regions reject missing or out-of-order production boundaries", () => {
  assert.equal(sourceBetween("before START body END after", "START", "END"), "START body ");
  assert.throws(() => sourceBetween("END only", "START", "END"), /Unable to find production marker: START/);
  assert.throws(() => sourceBetween("START only", "START", "END"), /Unable to find production marker after START: END/);
  assert.throws(() => sourceBetween("END then START", "START", "END"), /Unable to find production marker after START: END/);
});

test("plain preserves nullish values and primitives", () => {
  for (const value of [null, undefined, 0, false, "text"]) assert.equal(plain(value), value);
});

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
