import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  MEDIA_MANIFEST,
  RECORD_PATH,
  SIZE_THRESHOLD_BYTES,
  checkOptimizedMedia,
  encoderCommand,
  optimizeMedia,
  oversizedSources,
  parseProbedDimensions,
  planMediaConversions,
  readRecord,
  renderRecord,
  resolveBinaryFromPath,
} from "../scripts/optimize-media.mjs";

const run = promisify(execFile);
const repositoryRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

const WEBP_FLAGS = Object.freeze(["-lossy", "-q", "75", "-m", "6", "-mixed"]);
const MP4_FLAGS = Object.freeze(["-c:v", "libx264", "-crf", "28"]);

/** A two-derivative manifest that exercises both encoders without touching the repository. */
const fixtureManifest = Object.freeze([
  Object.freeze({
    source: "assets/random events/sample.gif",
    derivatives: Object.freeze([
      Object.freeze({
        format: "webp",
        path: "assets/optimized/random-events/sample.webp",
        flags: WEBP_FLAGS,
      }),
      Object.freeze({
        format: "mp4",
        path: "assets/optimized/random-events/sample.mp4",
        flags: MP4_FLAGS,
      }),
    ]),
  }),
]);

const writeFixtureFile = (root, relativePath, bytes) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.alloc(bytes, 7));
  return target;
};

const createFixtureRoot = (t, { sourceBytes = SIZE_THRESHOLD_BYTES + 512 } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "optimize-media-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeFixtureFile(root, "assets/random events/sample.gif", sourceBytes);
  return root;
};

/** Stands in for gif2webp/ffmpeg/ffprobe: writes a deterministic output, reports fixed dimensions. */
const createEncoderStub = ({ outputBytes = 64, probe = "320,240" } = {}) => {
  const calls = [];
  const runCommand = (binary, args) => {
    calls.push({ binary, args });
    if (binary.endsWith("ffprobe")) return { status: 0, stdout: `${probe}\n`, stderr: "" };
    const output = binary.endsWith("gif2webp") ? args[args.length - 1] : args[args.length - 1];
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, Buffer.alloc(outputBytes, 3));
    return { status: 0, stdout: "", stderr: "" };
  };
  return { calls, runCommand };
};

const resolveEverything = (binary) => `/stub/bin/${binary}`;

test("the manifest covers every oversized source in the repository", () => {
  const sources = oversizedSources({ root: repositoryRoot });
  const manifestSources = new Set(MEDIA_MANIFEST.map((entry) => entry.source));
  assert.ok(sources.length >= 19, `expected the full sweep, found ${sources.length}`);
  assert.deepEqual(
    sources.filter((source) => !manifestSources.has(source)),
    []
  );
});

test("encoder commands are reproducible argument vectors", () => {
  const [webp, mp4] = fixtureManifest[0].derivatives;
  assert.deepEqual(encoderCommand(webp, { input: "in.gif", output: "out.webp" }), {
    binary: "gif2webp",
    args: ["-lossy", "-q", "75", "-m", "6", "-mixed", "in.gif", "-o", "out.webp"],
  });
  assert.deepEqual(encoderCommand(mp4, { input: "in.gif", output: "out.mp4" }), {
    binary: "ffmpeg",
    args: ["-y", "-nostdin", "-loglevel", "error", "-i", "in.gif", "-c:v", "libx264", "-crf", "28", "out.mp4"],
  });
  assert.throws(
    () => encoderCommand({ format: "avif", flags: [] }, { input: "a", output: "b" }),
    /Unknown derivative format/
  );
});

test("ffprobe output parses into positive dimensions", () => {
  assert.deepEqual(parseProbedDimensions("628,640\n"), { width: 628, height: 640 });
  assert.deepEqual(parseProbedDimensions("500,352\n500,352\n"), { width: 500, height: 352 });
  assert.equal(parseProbedDimensions(""), null);
  assert.equal(parseProbedDimensions("0,240"), null);
  assert.equal(parseProbedDimensions("N/A,N/A"), null);
});

test("planning encodes every derivative that has never been built", (t) => {
  const root = createFixtureRoot(t);
  const plan = planMediaConversions({ root, manifest: fixtureManifest });
  assert.deepEqual(
    plan.map((step) => [step.derivative.path, step.action, step.reason]),
    [
      ["assets/optimized/random-events/sample.webp", "encode", "derivative is missing"],
      ["assets/optimized/random-events/sample.mp4", "encode", "derivative is missing"],
    ]
  );
});

test("planning reports a source the manifest names but the repository lacks", (t) => {
  const root = createFixtureRoot(t);
  fs.rmSync(path.join(root, "assets/random events/sample.gif"));
  const plan = planMediaConversions({ root, manifest: fixtureManifest });
  assert.deepEqual(new Set(plan.map((step) => step.action)), new Set(["missing-source"]));
  assert.throws(
    () =>
      optimizeMedia({
        root,
        manifest: fixtureManifest,
        ...createEncoderStub(),
        resolveBinary: resolveEverything,
      }),
    /cannot read: assets\/random events\/sample\.gif/
  );
});

test("a second run skips every derivative and re-runs nothing", (t) => {
  const root = createFixtureRoot(t);
  const first = createEncoderStub();
  const firstRun = optimizeMedia({
    root,
    manifest: fixtureManifest,
    runCommand: first.runCommand,
    resolveBinary: resolveEverything,
  });
  assert.deepEqual(firstRun.encoded, [
    "assets/optimized/random-events/sample.webp",
    "assets/optimized/random-events/sample.mp4",
  ]);
  assert.deepEqual(firstRun.skipped, []);

  const second = createEncoderStub();
  const secondRun = optimizeMedia({
    root,
    manifest: fixtureManifest,
    runCommand: second.runCommand,
    resolveBinary: resolveEverything,
  });
  assert.deepEqual(secondRun.encoded, []);
  assert.deepEqual(secondRun.skipped, [
    "assets/optimized/random-events/sample.webp",
    "assets/optimized/random-events/sample.mp4",
  ]);
  assert.deepEqual(
    second.calls.filter((call) => !call.binary.endsWith("ffprobe")),
    [],
    "an idempotent rerun invokes no encoder"
  );
  assert.equal(renderRecord(secondRun.record), renderRecord(firstRun.record));
});

test("changed encoder flags re-encode the affected derivative only", (t) => {
  const root = createFixtureRoot(t);
  optimizeMedia({
    root,
    manifest: fixtureManifest,
    ...createEncoderStub(),
    resolveBinary: resolveEverything,
  });

  const retuned = [
    {
      ...fixtureManifest[0],
      derivatives: [
        { ...fixtureManifest[0].derivatives[0], flags: ["-lossy", "-q", "90", "-m", "6", "-mixed"] },
        fixtureManifest[0].derivatives[1],
      ],
    },
  ];
  const plan = planMediaConversions({ root, manifest: retuned });
  assert.deepEqual(
    plan.map((step) => [step.action, step.reason]),
    [
      ["encode", "encoder flags changed"],
      ["skip", "derivative is current"],
    ]
  );
});

test("a source newer than its derivative re-encodes", (t) => {
  const root = createFixtureRoot(t);
  optimizeMedia({
    root,
    manifest: fixtureManifest,
    ...createEncoderStub(),
    resolveBinary: resolveEverything,
  });

  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(path.join(root, "assets/random events/sample.gif"), future, future);
  const plan = planMediaConversions({ root, manifest: fixtureManifest });
  assert.deepEqual(new Set(plan.map((step) => step.reason)), new Set([
    "source is newer than the derivative",
  ]));
});

test("a missing encoder fails with an actionable message and encodes nothing", (t) => {
  const root = createFixtureRoot(t);
  const stub = createEncoderStub();
  assert.throws(
    () =>
      optimizeMedia({
        root,
        manifest: fixtureManifest,
        runCommand: stub.runCommand,
        resolveBinary: (binary) => (binary === "gif2webp" ? null : `/stub/bin/${binary}`),
      }),
    /optimize-media needs "gif2webp" on PATH/
  );
  assert.deepEqual(stub.calls, []);
  assert.equal(fs.existsSync(path.join(root, RECORD_PATH)), false);
});

test("a mid-run failure keeps the sources that already finished", (t) => {
  const root = createFixtureRoot(t);
  writeFixtureFile(root, "assets/random events/second.gif", SIZE_THRESHOLD_BYTES + 256);
  const twoSources = [
    fixtureManifest[0],
    {
      source: "assets/random events/second.gif",
      derivatives: [
        {
          format: "webp",
          path: "assets/optimized/random-events/second.webp",
          flags: WEBP_FLAGS,
        },
      ],
    },
  ];

  const stub = createEncoderStub();
  assert.throws(
    () =>
      optimizeMedia({
        root,
        manifest: twoSources,
        runCommand: (binary, args) =>
          args.at(-1).endsWith("second.webp")
            ? { status: 1, stdout: "", stderr: "out of memory" }
            : stub.runCommand(binary, args),
        resolveBinary: resolveEverything,
      }),
    /gif2webp failed for assets\/optimized\/random-events\/second\.webp/
  );

  const record = readRecord(root);
  assert.deepEqual(
    record.entries.map((entry) => entry.source),
    ["assets/random events/sample.gif"],
    "the finished source stays recorded"
  );
  assert.deepEqual(
    planMediaConversions({ root, manifest: twoSources }).map((step) => step.action),
    ["skip", "skip", "encode"],
    "a rerun resumes at the source that failed"
  );
});

test("a failing encoder surfaces its exit code and stderr", (t) => {
  const root = createFixtureRoot(t);
  assert.throws(
    () =>
      optimizeMedia({
        root,
        manifest: fixtureManifest,
        runCommand: () => ({ status: 3, stdout: "", stderr: "bad palette\n" }),
        resolveBinary: resolveEverything,
      }),
    /gif2webp failed for assets\/optimized\/random-events\/sample\.webp \(exit 3\): bad palette/
  );
});

test("resolveBinaryFromPath finds an executable and reports a missing one", (t) => {
  const root = createFixtureRoot(t);
  const binDirectory = path.join(root, "bin");
  fs.mkdirSync(binDirectory, { recursive: true });
  const executable = path.join(binDirectory, "fake-encoder");
  fs.writeFileSync(executable, "#!/bin/sh\n");
  fs.chmodSync(executable, 0o755);
  assert.equal(resolveBinaryFromPath("fake-encoder", { PATH: binDirectory }), executable);
  assert.equal(resolveBinaryFromPath("absent-encoder", { PATH: binDirectory }), null);
  assert.equal(resolveBinaryFromPath("fake-encoder", {}), null);
});

test("--check passes once every derivative is built and recorded", (t) => {
  const root = createFixtureRoot(t);
  optimizeMedia({
    root,
    manifest: fixtureManifest,
    ...createEncoderStub(),
    resolveBinary: resolveEverything,
  });
  assert.deepEqual(checkOptimizedMedia({ root, manifest: fixtureManifest }), {
    ok: true,
    problems: [],
  });
});

test("--check fails when the record is missing entirely", (t) => {
  const root = createFixtureRoot(t);
  const { ok, problems } = checkOptimizedMedia({ root, manifest: fixtureManifest });
  assert.equal(ok, false);
  assert.ok(problems.some((problem) => problem.includes(`${RECORD_PATH} is missing`)));
});

test("--check fails when an oversized source has no manifest entry", (t) => {
  const root = createFixtureRoot(t);
  writeFixtureFile(root, "assets/random events/unconverted.gif", SIZE_THRESHOLD_BYTES + 1);
  const { ok, problems } = checkOptimizedMedia({ root, manifest: fixtureManifest });
  assert.equal(ok, false);
  assert.ok(
    problems.includes(
      "assets/random events/unconverted.gif is over the derivative threshold with no manifest entry"
    )
  );
});

test("--check ignores a source under the threshold", (t) => {
  const root = createFixtureRoot(t);
  optimizeMedia({
    root,
    manifest: fixtureManifest,
    ...createEncoderStub(),
    resolveBinary: resolveEverything,
  });
  writeFixtureFile(root, "assets/random events/tiny.gif", SIZE_THRESHOLD_BYTES - 1);
  assert.deepEqual(checkOptimizedMedia({ root, manifest: fixtureManifest }).problems, []);
});

test("--check fails when a recorded derivative was deleted", (t) => {
  const root = createFixtureRoot(t);
  optimizeMedia({
    root,
    manifest: fixtureManifest,
    ...createEncoderStub(),
    resolveBinary: resolveEverything,
  });
  fs.rmSync(path.join(root, "assets/optimized/random-events/sample.mp4"));
  const { ok, problems } = checkOptimizedMedia({ root, manifest: fixtureManifest });
  assert.equal(ok, false);
  assert.ok(
    problems.some((problem) =>
      problem.startsWith("assets/optimized/random-events/sample.mp4 is missing")
    )
  );
});

test("--check fails when the record is stale against the manifest or the files", (t) => {
  const root = createFixtureRoot(t);
  optimizeMedia({
    root,
    manifest: fixtureManifest,
    ...createEncoderStub(),
    resolveBinary: resolveEverything,
  });

  const retuned = [
    {
      ...fixtureManifest[0],
      derivatives: [
        { ...fixtureManifest[0].derivatives[0], flags: ["-lossy", "-q", "90"] },
        fixtureManifest[0].derivatives[1],
      ],
    },
  ];
  assert.ok(
    checkOptimizedMedia({ root, manifest: retuned }).problems.some((problem) =>
      problem.includes("was recorded from different encoder flags")
    )
  );

  writeFixtureFile(root, "assets/random events/sample.gif", SIZE_THRESHOLD_BYTES + 1024);
  assert.ok(
    checkOptimizedMedia({ root, manifest: fixtureManifest }).problems.some((problem) =>
      problem.includes("changed since its derivatives were recorded")
    )
  );

  writeFixtureFile(root, "assets/optimized/random-events/sample.webp", 4096);
  assert.ok(
    checkOptimizedMedia({ root, manifest: fixtureManifest }).problems.some((problem) =>
      problem.includes("but was recorded as")
    )
  );
});

test("--check fails when the record still lists a dropped manifest entry", (t) => {
  const root = createFixtureRoot(t);
  optimizeMedia({
    root,
    manifest: fixtureManifest,
    ...createEncoderStub(),
    resolveBinary: resolveEverything,
  });
  const { ok, problems } = checkOptimizedMedia({ root, manifest: [] });
  assert.equal(ok, false);
  assert.ok(
    problems.includes("assets/random events/sample.gif is recorded but no longer in the manifest")
  );
});

test("the repository's own derivatives pass the shipped --check without an encoder", async () => {
  const { stdout } = await run(process.execPath, ["scripts/optimize-media.mjs", "--check"], {
    cwd: repositoryRoot,
    env: { ...process.env, PATH: "" },
  });
  assert.match(stdout, /Optimized media is current for \d+ sources\./);
});
