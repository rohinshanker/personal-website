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
  runOptimizeMediaCli,
  spawnCommand,
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
  assert.equal(parseProbedDimensions(undefined), null, "a probe that wrote nothing");
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

/**
 * A scratch repository that can run the shipped CLI: the script resolves its own
 * root from its module URL, so `<root>/scripts/optimize-media.mjs` makes `<root>`
 * the repository it checks and encodes.
 */
const installScriptInto = (root) => {
  const scriptPath = path.join(root, "scripts/optimize-media.mjs");
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.copyFileSync(path.join(repositoryRoot, "scripts/optimize-media.mjs"), scriptPath);
  return scriptPath;
};

/**
 * Executables that stand in for the encoders on `PATH`. `ffprobe` answers with
 * fixed dimensions; the encoders write their last argument, which is the output
 * path for both `gif2webp -o out` and `ffmpeg ... out`.
 */
const installStubBinaries = (root) => {
  const binDirectory = path.join(root, "stub-bin");
  fs.mkdirSync(binDirectory, { recursive: true });
  const write = (name, body) => {
    const target = path.join(binDirectory, name);
    fs.writeFileSync(target, body);
    fs.chmodSync(target, 0o755);
  };
  write("ffprobe", "#!/bin/sh\nprintf '320,240\\n'\n");
  const writeLastArgument = [
    "#!/bin/sh",
    "for out; do :; done",
    'mkdir -p "$(dirname "$out")"',
    "printf 'stub' > \"$out\"",
    "",
  ].join("\n");
  write("gif2webp", writeLastArgument);
  write("ffmpeg", writeLastArgument);
  return binDirectory;
};

test("planning re-encodes a derivative that exists but was never recorded", (t) => {
  const root = createFixtureRoot(t);
  optimizeMedia({
    root,
    manifest: fixtureManifest,
    ...createEncoderStub(),
    resolveBinary: resolveEverything,
  });
  // The files are current, but a record that lost them cannot vouch for the flags
  // they came from, so they are encoded again rather than trusted.
  fs.writeFileSync(
    path.join(root, RECORD_PATH),
    renderRecord({ ...readRecord(root), entries: [] })
  );

  assert.deepEqual(
    planMediaConversions({ root, manifest: fixtureManifest }).map((step) => [
      step.action,
      step.reason,
    ]),
    [
      ["encode", "derivative is unrecorded"],
      ["encode", "derivative is unrecorded"],
    ]
  );
});

test("a manifest entry that declares no derivatives is still measured and recorded", (t) => {
  const root = createFixtureRoot(t);
  const sourceOnly = [{ source: fixtureManifest[0].source, derivatives: [] }];
  const stub = createEncoderStub({ probe: "858,824" });

  const { encoded, skipped, record } = optimizeMedia({
    root,
    manifest: sourceOnly,
    runCommand: stub.runCommand,
    resolveBinary: resolveEverything,
  });
  assert.deepEqual({ encoded, skipped }, { encoded: [], skipped: [] });
  assert.deepEqual(record.entries, [
    {
      source: "assets/random events/sample.gif",
      sourceBytes: SIZE_THRESHOLD_BYTES + 512,
      width: 858,
      height: 824,
      derivatives: [],
    },
  ]);
  assert.deepEqual(checkOptimizedMedia({ root, manifest: sourceOnly }), {
    ok: true,
    problems: [],
  });
});

test("the source sweep skips a directory that is not there and surfaces one that cannot be read", (t) => {
  const root = createFixtureRoot(t);
  assert.deepEqual(
    oversizedSources({ root, directories: ["assets/never-created"] }),
    [],
    "an absent covered directory contributes nothing"
  );

  // A covered directory that is really a file is a configuration mistake, not an
  // absent tree, so it must not be swallowed with the same shrug.
  writeFixtureFile(root, "assets/plain-file", 8);
  assert.throws(() => oversizedSources({ root, directories: ["assets/plain-file"] }), {
    code: "ENOTDIR",
  });
});

test("the sweep walks nested directories and ignores entries that are not files", (t) => {
  const root = createFixtureRoot(t);
  writeFixtureFile(root, "assets/random events/nested/deep.gif", SIZE_THRESHOLD_BYTES + 1);
  fs.symlinkSync(
    path.join(root, "assets/random events/sample.gif"),
    path.join(root, "assets/random events/dangling.gif")
  );
  fs.rmSync(path.join(root, "assets/random events/sample.gif"));

  assert.deepEqual(oversizedSources({ root }), ["assets/random events/nested/deep.gif"]);
});

test("--check fails when a manifest source disappeared after it was recorded", (t) => {
  const root = createFixtureRoot(t);
  optimizeMedia({
    root,
    manifest: fixtureManifest,
    ...createEncoderStub(),
    resolveBinary: resolveEverything,
  });
  fs.rmSync(path.join(root, "assets/random events/sample.gif"));

  const { ok, problems } = checkOptimizedMedia({ root, manifest: fixtureManifest });
  assert.equal(ok, false);
  assert.ok(
    problems.includes(
      "assets/random events/sample.gif is listed in the manifest but missing from the repository"
    )
  );
});

test("--check fails when the record lost a source entry or one of its derivatives", (t) => {
  const root = createFixtureRoot(t);
  optimizeMedia({
    root,
    manifest: fixtureManifest,
    ...createEncoderStub(),
    resolveBinary: resolveEverything,
  });
  const recordPath = path.join(root, RECORD_PATH);
  const record = readRecord(root);

  fs.writeFileSync(recordPath, renderRecord({ ...record, entries: [] }));
  assert.ok(
    checkOptimizedMedia({ root, manifest: fixtureManifest }).problems.includes(
      "assets/random events/sample.gif has no record entry; run: node scripts/optimize-media.mjs"
    ),
    "a record with no entry for the source"
  );

  fs.writeFileSync(
    recordPath,
    renderRecord({
      ...record,
      entries: [{ ...record.entries[0], derivatives: record.entries[0].derivatives.slice(0, 1) }],
    })
  );
  assert.ok(
    checkOptimizedMedia({ root, manifest: fixtureManifest }).problems.includes(
      "assets/optimized/random-events/sample.mp4 has no record entry; run: node scripts/optimize-media.mjs"
    ),
    "a record that kept the source but dropped a derivative"
  );
});

test("a probe that fails, or answers nothing usable, stops the run", (t) => {
  const answerProbeWith = (stub, probeResult) => (binary, args) =>
    binary.endsWith("ffprobe") ? probeResult : stub.runCommand(binary, args);

  const failed = createFixtureRoot(t);
  assert.throws(
    () =>
      optimizeMedia({
        root: failed,
        manifest: fixtureManifest,
        runCommand: answerProbeWith(createEncoderStub(), {
          status: 1,
          stdout: "",
          stderr: "moov atom not found",
        }),
        resolveBinary: resolveEverything,
      }),
    /ffprobe could not read the dimensions of assets\/random events\/sample\.gif/
  );

  const unusable = createFixtureRoot(t);
  assert.throws(
    () =>
      optimizeMedia({
        root: unusable,
        manifest: fixtureManifest,
        runCommand: answerProbeWith(createEncoderStub(), {
          status: 0,
          stdout: "N/A,N/A\n",
          stderr: "",
        }),
        resolveBinary: resolveEverything,
      }),
    /ffprobe could not read the dimensions of/
  );
});

test("spawnCommand reports a real process and throws when the binary cannot start", () => {
  assert.deepEqual(
    spawnCommand(process.execPath, [
      "-e",
      "process.stdout.write('320,240'); process.stderr.write('note')",
    ]),
    { status: 0, stdout: "320,240", stderr: "note" }
  );
  assert.throws(() => spawnCommand(path.join(repositoryRoot, "scripts/absent-encoder"), []), {
    code: "ENOENT",
  });
});

/** Collects one CLI run's streams so each branch can be asserted in-process. */
const runCli = ({ argv, root }) => {
  const out = [];
  const err = [];
  const code = runOptimizeMediaCli({
    argv,
    root,
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
  });
  return { code, stdout: out.join(""), stderr: err.join("") };
};

test("the CLI encodes, then skips, then verifies the same scratch repository", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "optimize-media-cli-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  MEDIA_MANIFEST.forEach((entry) => writeFixtureFile(root, entry.source, 512));

  // The CLI owns the real manifest and resolves encoders from PATH, so the stubs
  // go on PATH. That runs every branch in-process, where the coverage report can
  // see it, rather than only in a child.
  const realPath = process.env.PATH;
  process.env.PATH = installStubBinaries(root);
  t.after(() => {
    process.env.PATH = realPath;
  });

  const derivativeCount = MEDIA_MANIFEST.reduce(
    (total, entry) => total + entry.derivatives.length,
    0
  );
  const summary = (encoded, skipped) =>
    new RegExp(`Encoded ${encoded} derivative\\(s\\), skipped ${skipped} already current\\.`);

  const encoded = runCli({ argv: [], root });
  assert.equal(encoded.code, 0);
  assert.match(encoded.stdout, summary(derivativeCount, 0));
  assert.match(
    encoded.stdout,
    /^encode assets\/optimized\/random-events\/servalpizza\.webp \(derivative is missing\)$/m
  );
  assert.equal(readRecord(root).entries.length, MEDIA_MANIFEST.length);

  const skipped = runCli({ argv: [], root });
  assert.equal(skipped.code, 0);
  assert.match(skipped.stdout, summary(0, derivativeCount));
  assert.match(
    skipped.stdout,
    /^skip {3}assets\/optimized\/random-events\/servalpizza\.webp \(derivative is current\)$/m
  );

  const verified = runCli({ argv: ["--check"], root });
  assert.equal(verified.code, 0);
  assert.equal(verified.stderr, "");
  assert.match(
    verified.stdout,
    new RegExp(`Optimized media is current for ${MEDIA_MANIFEST.length} sources\\.`)
  );

  fs.rmSync(path.join(root, MEDIA_MANIFEST[0].derivatives[0].path));
  const failed = runCli({ argv: ["--check"], root });
  assert.equal(failed.code, 1);
  assert.equal(failed.stdout, "");
  assert.match(failed.stderr, /^- .+ is missing; run: node scripts\/optimize-media\.mjs$/m);
});

test("the CLI reports problems on the process's own error stream by default", (t) => {
  const root = createFixtureRoot(t);
  const reported = [];
  const realWrite = process.stderr.write;
  // Only stderr is borrowed: the test runner reports on stdout.
  process.stderr.write = (text) => {
    reported.push(String(text));
    return true;
  };
  t.after(() => {
    process.stderr.write = realWrite;
  });

  const stdout = [];
  const code = runOptimizeMediaCli({ argv: ["--check"], root, stdout: (text) => stdout.push(text) });
  process.stderr.write = realWrite;

  assert.equal(code, 1);
  assert.deepEqual(stdout, [], "a failing check writes nothing to stdout");
  assert.match(reported.join(""), /derivatives\.json is missing/);
});

test("the shipped --check exits non-zero and names what is wrong", async (t) => {
  const root = createFixtureRoot(t);
  installScriptInto(root);

  await assert.rejects(
    () =>
      run(process.execPath, ["scripts/optimize-media.mjs", "--check"], {
        cwd: root,
        env: { ...process.env, PATH: "" },
      }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /derivatives\.json is missing/);
      assert.equal(error.stdout, "");
      return true;
    }
  );
});

test("the repository's own derivatives pass the shipped --check without an encoder", async () => {
  const { stdout } = await run(process.execPath, ["scripts/optimize-media.mjs", "--check"], {
    cwd: repositoryRoot,
    env: { ...process.env, PATH: "" },
  });
  assert.match(stdout, /Optimized media is current for \d+ sources\./);
});
