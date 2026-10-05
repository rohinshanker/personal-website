import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const readConfig = (ci) => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
    const { default: config } = await import("./playwright.config.mjs");
    const { retries, workers, fullyParallel, reporter } = config;
    process.stdout.write(JSON.stringify({ retries, workers, fullyParallel, reporter }));
  `], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, CI: ci ? "1" : "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
};

test("browser CI exposes failures immediately with bounded parallel workers and review artifacts", () => {
  const config = readConfig(true);
  assert.equal(config.retries, 0);
  assert.equal(config.workers, 2);
  assert.equal(config.fullyParallel, true);
  assert.deepEqual(config.reporter, [["github"], ["html", { open: "never" }]]);
});

test("local browser tests also run without retries", () => {
  const config = readConfig(false);
  assert.equal(config.retries, 0);
  assert.equal(config.fullyParallel, true);
  assert.equal(config.workers, undefined);
  assert.equal(config.reporter, "list");
});
