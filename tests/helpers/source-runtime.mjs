import assert from "node:assert/strict";

/** Extracts an exact production-source region bounded by stable declarations. */
export const sourceBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `Unable to find production marker: ${startMarker}`);
  assert.ok(end > start, `Unable to find production marker after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
};

/** Converts values created in a VM realm into ordinary assertion-friendly data. */
export const plain = (value) =>
  value == null ? value : JSON.parse(JSON.stringify(value));
