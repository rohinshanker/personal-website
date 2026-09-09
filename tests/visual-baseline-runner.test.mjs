import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parse } from "yaml";

import {
  buildDockerArguments,
  resolvePinnedImage,
} from "../scripts/run-visual-tests.mjs";
import {
  DEFAULT_UI_TEST_OUTPUT_DIR,
  DEFAULT_UI_TEST_PORT,
  resolveUiTestBaseUrl,
  resolveUiTestOutputDir,
  resolveUiTestPort,
} from "../tests/ui/server-config.mjs";

const root = new URL("../", import.meta.url);

const readLockfile = () => readFile(new URL("package-lock.json", root), "utf8");

test("the runner fails clearly when Docker is unavailable", () => {
  const result = spawnSync(process.execPath, ["scripts/run-visual-tests.mjs"], {
    cwd: fileURLToPath(root),
    env: { ...process.env, PATH: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Docker must be running/);
});

test("a failed container makes the runner fail with the same exit status", async () => {
  const directory = await mkdtemp(join(tmpdir(), "visual-runner-"));
  try {
    const executable = join(directory, "docker");
    await writeFile(executable, '#!/bin/sh\nif [ "$1" = info ]; then exit 0; fi\nexit 23\n');
    await chmod(executable, 0o755);
    const result = spawnSync(process.execPath, ["scripts/run-visual-tests.mjs"], {
      cwd: fileURLToPath(root),
      env: { ...process.env, PATH: directory },
      encoding: "utf8",
    });
    assert.equal(result.status, 23, result.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the UI test port is selectable and rejects values outside the usable range", () => {
  assert.equal(resolveUiTestPort({}), DEFAULT_UI_TEST_PORT);
  assert.equal(resolveUiTestPort({ UI_TEST_PORT: "  " }), DEFAULT_UI_TEST_PORT);
  assert.equal(resolveUiTestPort({ UI_TEST_PORT: "4231" }), 4231);
  assert.equal(resolveUiTestBaseUrl({ UI_TEST_PORT: "4231" }), "http://127.0.0.1:4231");

  for (const value of ["0", "80", "70000", "4231.5", "abc", "-1"]) {
    assert.throws(
      () => resolveUiTestPort({ UI_TEST_PORT: value }),
      /UI_TEST_PORT must be an integer/,
      `${value} must be rejected`
    );
  }
});

test("artifact paths cannot escape the ignored results tree or target source", () => {
  assert.equal(resolveUiTestOutputDir({}), DEFAULT_UI_TEST_OUTPUT_DIR);
  assert.equal(
    resolveUiTestOutputDir({ UI_TEST_OUTPUT_DIR: " ./test-results/dem-9/../final " }),
    "test-results/final"
  );

  assert.equal(resolveUiTestOutputDir({ UI_TEST_OUTPUT_DIR: "test-results" }), "test-results");
  for (const value of ["/tmp/results", "../outside", "nested/../../outside", ".", "test-results/..", "assets", "tests", "test-results-other"]) {
    assert.throws(
      () => resolveUiTestOutputDir({ UI_TEST_OUTPUT_DIR: value }),
      /must be test-results or a directory beneath it/,
      `${value} must be rejected before Playwright can clear that directory`
    );
  }
});

test("the container image is pinned to the locked Playwright version", async () => {
  const lockfileText = await readLockfile();
  const version =
    JSON.parse(lockfileText).packages["node_modules/playwright-core"].version;

  assert.equal(
    resolvePinnedImage(lockfileText),
    `mcr.microsoft.com/playwright:v${version}-noble`
  );
  assert.throws(
    () => resolvePinnedImage(JSON.stringify({ packages: {} })),
    /does not pin node_modules\/playwright-core/
  );
});

test("the container runs the visual project with isolated modules and safe arguments", async () => {
  const lockfileText = await readLockfile();
  const args = buildDockerArguments({
    lockfileText,
    env: { UI_TEST_PORT: "4241" },
    args: ["--update-snapshots"],
  });

  assert.equal(args[0], "run");
  assert.ok(args.includes("--rm"));
  assert.deepEqual(
    args.slice(args.indexOf("--platform"), args.indexOf("--platform") + 2),
    ["--platform", "linux/arm64"],
    "baselines are committed for the default platform"
  );

  const mounts = args.filter((value, index) => args[index - 1] === "--volume");
  assert.equal(mounts.length, 2, "the checkout and an isolated node_modules");
  assert.ok(mounts.some((mount) => mount.endsWith(":/repo")));
  assert.ok(mounts.includes("/repo/node_modules"),
    "an anonymous per-run volume avoids host dependencies and shared install races");

  assert.ok(args.includes(resolvePinnedImage(lockfileText)));
  assert.ok(args.includes("--env"));
  assert.ok(args.includes("UI_TEST_PORT=4241"));
  assert.ok(
    !args.some((value) => value.startsWith("CI=")),
    "unset variables must not be forwarded"
  );

  const script = args[args.indexOf("-c") + 1];
  assert.match(script, /npm ci /, "the container installs from the lockfile");
  assert.match(script, /--project=visual "\$@"/, "passthrough stays positional");
  assert.deepEqual(
    args.slice(-2),
    ["sh", "--update-snapshots"],
    "arguments follow the $0 placeholder instead of being interpolated"
  );
});

test("the platform override is honoured for deliberate regeneration", async () => {
  const lockfileText = await readLockfile();
  const args = buildDockerArguments({
    lockfileText,
    env: { UI_VISUAL_PLATFORM: "linux/amd64" },
    args: [],
  });

  assert.equal(args[args.indexOf("--platform") + 1], "linux/amd64");
});

test("an artifact directory the host cannot read back is rejected before Docker runs", async () => {
  const lockfileText = await readLockfile();

  assert.throws(
    () =>
      buildDockerArguments({
        lockfileText,
        env: { UI_TEST_OUTPUT_DIR: "/tmp/results" },
        args: [],
      }),
    /must be test-results or a directory beneath it/
  );
});

test("CI runs both the browser project and the visual baselines", async () => {
  const workflow = parse(
    await readFile(new URL(".github/workflows/ui-layout.yml", root), "utf8")
  );
  const jobs = workflow.jobs;

  assert.deepEqual(Object.keys(jobs).sort(), ["ui", "visual"]);
  assert.equal(workflow.concurrency["cancel-in-progress"], true);

  for (const job of Object.values(jobs)) {
    assert.ok(Number.isInteger(job["timeout-minutes"]), "every job needs a timeout");
  }

  const runsOf = (job) => job.steps.map((step) => step.run).filter(Boolean);
  assert.ok(runsOf(jobs.ui).includes("npm run test:ui"));
  assert.ok(
    runsOf(jobs.visual).includes("npm run test:visual"),
    "the visual baselines must be an actual CI gate"
  );
  assert.equal(
    jobs.visual["runs-on"],
    "ubuntu-24.04-arm",
    "the runner architecture must match the committed baselines"
  );
});

test("the committed baselines match the platform the runner renders on", async () => {
  const { readdir } = await import("node:fs/promises");
  const platforms = await readdir(new URL("tests/ui/__screenshots__/", root));

  assert.deepEqual(
    platforms,
    ["linux-arm64"],
    "CI must never be left depending on a baseline set that was not committed"
  );
  const baselines = await readdir(
    new URL("tests/ui/__screenshots__/linux-arm64/visual/", root)
  );
  assert.ok(baselines.length >= 8, "the curated reference set must stay present");
  assert.ok(baselines.every((name) => name.endsWith(".png")));
});
