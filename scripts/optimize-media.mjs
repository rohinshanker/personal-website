import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY_ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

/** Directories whose oversized sources must own a derivative. */
export const COVERED_DIRECTORIES = Object.freeze(["assets/random events"]);

/** Source extensions the pipeline knows how to convert. */
export const COVERED_EXTENSIONS = Object.freeze([".gif"]);

/**
 * A source at or above this size ships a derivative instead of the original.
 * One megabyte, decimal: `nana-accept.gif` at 1,029,362 bytes is over 1 MB and
 * under 1 MiB, and it is one of the sources this pipeline owns.
 */
export const SIZE_THRESHOLD_BYTES = 1_000_000;

/** Generated ledger of what was encoded, from which flags, at which size. */
export const RECORD_PATH = "assets/optimized/random-events/derivatives.json";

const SOURCE_DIRECTORY = "assets/random events";
const DERIVATIVE_DIRECTORY = "assets/optimized/random-events";

/**
 * `quality` selects lossy animated WebP. `lossless` is gif2webp's default mode,
 * where `-q` buys compression effort rather than fidelity; it is for flat-palette
 * loops whose lossy encode comes out larger than the source GIF.
 */
const webpFlags = ({ quality, lossless = false }) =>
  Object.freeze(
    lossless ? ["-q", "75", "-m", "6"] : ["-lossy", "-q", String(quality), "-m", "6", "-mixed"]
  );

const EVEN_DIMENSIONS = "scale=trunc(iw/2)*2:trunc(ih/2)*2";

const WEBM_FLAGS = Object.freeze([
  "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1",
  "-pix_fmt", "yuv420p", "-an", "-vf", EVEN_DIMENSIONS,
]);

const MP4_FLAGS = Object.freeze([
  "-c:v", "libx264", "-crf", "28", "-preset", "slow", "-profile:v", "main",
  "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", "-vf", EVEN_DIMENSIONS,
]);

// The Homebrew ffmpeg build carries no WebP encoder, and these five first frames
// are opaque video stills, so the poster ships as JPEG.
const POSTER_FLAGS = Object.freeze([
  "-frames:v", "1", "-c:v", "mjpeg", "-q:v", "4", "-pix_fmt", "yuvj420p",
  "-vf", EVEN_DIMENSIONS,
]);

/**
 * Every source over the threshold, the animated-WebP settings it needed, and
 * whether it is one of the five large loops that also ship as video. Quality
 * moved off the lossy-75 default only where the derivative showed visible
 * banding or smeared text beside its source at the rendered size, or where
 * lossy WebP encoded larger than the GIF.
 */
const SOURCES = Object.freeze([
  { name: "servalpizza", webp: { quality: 75 }, video: true },
  { name: "campfire", webp: { quality: 75 }, video: true },
  { name: "evil-wizards-radar", webp: { quality: 75 }, video: true },
  { name: "birthday", webp: { quality: 75 }, video: false },
  { name: "ramadan", webp: { quality: 75 }, video: false },
  { name: "buddha", webp: { quality: 75 }, video: false },
  { name: "mothersday", webp: { quality: 75 }, video: false },
  { name: "trans", webp: { quality: 75 }, video: false },
  { name: "feliz-jueves", webp: { quality: 75 }, video: false },
  { name: "radar", webp: { lossless: true }, video: true },
  { name: "fathersday", webp: { quality: 75 }, video: false },
  { name: "4thofjuly", webp: { quality: 75 }, video: false },
  { name: "lain", webp: { quality: 75 }, video: true },
  { name: "holi", webp: { quality: 75 }, video: false },
  { name: "halloween", webp: { quality: 75 }, video: false },
  { name: "easter", webp: { quality: 75 }, video: false },
  { name: "valentine", webp: { quality: 75 }, video: false },
  { name: "shoebill", webp: { quality: 75 }, video: false },
  { name: "nana-accept", webp: { quality: 75 }, video: false },
]);

const manifestEntry = ({ name, webp, video }) =>
  Object.freeze({
    source: `${SOURCE_DIRECTORY}/${name}.gif`,
    derivatives: Object.freeze(
      [
        { format: "webp", path: `${DERIVATIVE_DIRECTORY}/${name}.webp`, flags: webpFlags(webp) },
        video && {
          format: "webm",
          path: `${DERIVATIVE_DIRECTORY}/${name}.webm`,
          flags: WEBM_FLAGS,
        },
        video && {
          format: "mp4",
          path: `${DERIVATIVE_DIRECTORY}/${name}.mp4`,
          flags: MP4_FLAGS,
        },
        video && {
          format: "poster",
          path: `${DERIVATIVE_DIRECTORY}/${name}-poster.jpg`,
          flags: POSTER_FLAGS,
        },
      ]
        .filter(Boolean)
        .map((derivative) => Object.freeze(derivative))
    ),
  });

/** The declarative conversion manifest: one entry per source, derivatives in encode order. */
export const MEDIA_MANIFEST = Object.freeze(SOURCES.map(manifestEntry));

/** Derivative formats that a `<video>` element loads rather than an `<img>`. */
export const VIDEO_FORMATS = Object.freeze(["webm", "mp4"]);

const ENCODER_BINARIES = Object.freeze({
  webp: "gif2webp",
  webm: "ffmpeg",
  mp4: "ffmpeg",
  poster: "ffmpeg",
});

/** Builds the exact argument vector an encoder runs, so a rerun is reproducible. */
export const encoderCommand = (derivative, { input, output }) => {
  const binary = ENCODER_BINARIES[derivative.format];
  if (!binary) throw new Error(`Unknown derivative format "${derivative.format}".`);
  const args =
    binary === "gif2webp"
      ? [...derivative.flags, input, "-o", output]
      : ["-y", "-nostdin", "-loglevel", "error", "-i", input, ...derivative.flags, output];
  return { binary, args };
};

const PROBE_ARGS = Object.freeze([
  "-v", "error", "-select_streams", "v:0",
  "-show_entries", "stream=width,height", "-of", "csv=p=0",
]);

/** Parses `width,height` out of the ffprobe CSV line, ignoring trailing empty fields. */
export const parseProbedDimensions = (stdout) => {
  const [width, height] = String(stdout ?? "")
    .trim()
    .split("\n")[0]
    .split(",")
    .map((value) => Number.parseInt(value, 10));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
};

const statOrNull = (filePath) => {
  try {
    return fs.statSync(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
};

const sameFlags = (first, second) =>
  Array.isArray(first) &&
  Array.isArray(second) &&
  first.length === second.length &&
  first.every((value, index) => value === second[index]);

export const readRecord = (root = REPOSITORY_ROOT) => {
  const recordPath = path.join(root, RECORD_PATH);
  try {
    return JSON.parse(fs.readFileSync(recordPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
};

export const renderRecord = (record) => `${JSON.stringify(record, null, 2)}\n`;

const recordedDerivative = (record, source, derivativePath) =>
  record?.entries
    ?.find((entry) => entry.source === source)
    ?.derivatives?.find((derivative) => derivative.path === derivativePath) ?? null;

/**
 * Decides, per derivative, whether a rerun must encode it again. A derivative is
 * current only when it exists, was recorded from the same flags, and is not older
 * than its source.
 */
export const planMediaConversions = ({
  root = REPOSITORY_ROOT,
  manifest = MEDIA_MANIFEST,
  record = readRecord(root),
} = {}) =>
  manifest.flatMap((entry) => {
    const sourceStat = statOrNull(path.join(root, entry.source));
    return entry.derivatives.map((derivative) => {
      const step = { source: entry.source, derivative };
      if (!sourceStat) return { ...step, action: "missing-source", reason: "source is missing" };
      const derivativeStat = statOrNull(path.join(root, derivative.path));
      if (!derivativeStat) {
        return { ...step, action: "encode", reason: "derivative is missing" };
      }
      const recorded = recordedDerivative(record, entry.source, derivative.path);
      if (!recorded) return { ...step, action: "encode", reason: "derivative is unrecorded" };
      if (!sameFlags(recorded.flags, derivative.flags)) {
        return { ...step, action: "encode", reason: "encoder flags changed" };
      }
      if (derivativeStat.mtimeMs < sourceStat.mtimeMs) {
        return { ...step, action: "encode", reason: "source is newer than the derivative" };
      }
      return { ...step, action: "skip", reason: "derivative is current" };
    });
  });

const walkFiles = (directory) => {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  // readdir order is not guaranteed, and the sweep's order must not depend on it.
  // Names are unique within a directory, so the default lexicographic sort is exact.
  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
  return [...entriesByName.keys()].sort().flatMap((name) => {
    const entry = entriesByName.get(name);
    const fullPath = path.join(directory, name);
    if (entry.isDirectory()) return walkFiles(fullPath);
    return entry.isFile() ? [fullPath] : [];
  });
};

/** Every covered source at or above the threshold, as repository-relative paths. */
export const oversizedSources = ({
  root = REPOSITORY_ROOT,
  directories = COVERED_DIRECTORIES,
} = {}) =>
  directories.flatMap((directory) =>
    walkFiles(path.join(root, directory))
      .filter((filePath) => COVERED_EXTENSIONS.includes(path.extname(filePath).toLowerCase()))
      .filter((filePath) => fs.statSync(filePath).size >= SIZE_THRESHOLD_BYTES)
      .map((filePath) => path.relative(root, filePath).split(path.sep).join("/"))
  );

/**
 * Pure-Node verification: no encoder is resolved or run. Fails when a covered
 * source over the threshold has no manifest entry, when a derivative is missing,
 * or when the generated record no longer matches the manifest and the files on
 * disk.
 */
export const checkOptimizedMedia = ({
  root = REPOSITORY_ROOT,
  manifest = MEDIA_MANIFEST,
} = {}) => {
  const problems = [];
  const manifestSources = new Set(manifest.map((entry) => entry.source));

  for (const source of oversizedSources({ root })) {
    if (!manifestSources.has(source)) {
      problems.push(`${source} is over the derivative threshold with no manifest entry`);
    }
  }

  const record = readRecord(root);
  if (!record) {
    problems.push(`${RECORD_PATH} is missing; run: node scripts/optimize-media.mjs`);
  }

  for (const entry of manifest) {
    const sourceStat = statOrNull(path.join(root, entry.source));
    if (!sourceStat) {
      problems.push(`${entry.source} is listed in the manifest but missing from the repository`);
    }
    if (!record) continue;

    const recordedEntry = record.entries?.find((candidate) => candidate.source === entry.source);
    if (!recordedEntry) {
      problems.push(`${entry.source} has no record entry; run: node scripts/optimize-media.mjs`);
      continue;
    }
    if (sourceStat && recordedEntry.sourceBytes !== sourceStat.size) {
      problems.push(
        `${entry.source} changed since its derivatives were recorded; run: node scripts/optimize-media.mjs`
      );
    }
    for (const derivative of entry.derivatives) {
      const recorded = recordedDerivative(record, entry.source, derivative.path);
      if (!recorded) {
        problems.push(`${derivative.path} has no record entry; run: node scripts/optimize-media.mjs`);
        continue;
      }
      if (recorded.format !== derivative.format || !sameFlags(recorded.flags, derivative.flags)) {
        problems.push(
          `${derivative.path} was recorded from different encoder flags; run: node scripts/optimize-media.mjs`
        );
      }
      const derivativeStat = statOrNull(path.join(root, derivative.path));
      if (!derivativeStat) {
        problems.push(`${derivative.path} is missing; run: node scripts/optimize-media.mjs`);
      } else if (derivativeStat.size !== recorded.bytes) {
        problems.push(
          `${derivative.path} is ${derivativeStat.size} bytes but was recorded as ${recorded.bytes}; run: node scripts/optimize-media.mjs`
        );
      }
    }
  }

  for (const recordedEntry of record?.entries ?? []) {
    if (!manifestSources.has(recordedEntry.source)) {
      problems.push(`${recordedEntry.source} is recorded but no longer in the manifest`);
    }
  }

  return { ok: problems.length === 0, problems };
};

/** Finds an executable on PATH without shelling out. */
export const resolveBinaryFromPath = (binary, environment = process.env) => {
  const searchPaths = String(environment.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const searchPath of searchPaths) {
    const candidate = path.join(searchPath, binary);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Keep looking; an unreadable directory on PATH is not an error.
    }
  }
  return null;
};

export const spawnCommand = (binary, args) => {
  const result = spawnSync(binary, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const requireBinary = (binary, resolveBinary, cache) => {
  if (cache.has(binary)) return cache.get(binary);
  const resolved = resolveBinary(binary);
  if (!resolved) {
    throw new Error(
      `optimize-media needs "${binary}" on PATH. Install it (brew install ffmpeg webp) and rerun.`
    );
  }
  cache.set(binary, resolved);
  return resolved;
};

const writeRecord = (root, record) => {
  const recordPath = path.join(root, RECORD_PATH);
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(recordPath, renderRecord(record));
};

/**
 * Encodes every stale derivative and rewrites the record. The record is written
 * after each source finishes, so a failed encoder does not throw away the work
 * already done. `runCommand` and `resolveBinary` are injected so tests can drive
 * the whole pipeline without an encoder installed.
 */
export const optimizeMedia = ({
  root = REPOSITORY_ROOT,
  manifest = MEDIA_MANIFEST,
  runCommand = spawnCommand,
  resolveBinary = resolveBinaryFromPath,
  log = () => {},
} = {}) => {
  const plan = planMediaConversions({ root, manifest });
  const missing = plan.filter((step) => step.action === "missing-source");
  if (missing.length) {
    throw new Error(`optimize-media cannot read: ${missing.map((step) => step.source).join(", ")}`);
  }

  const binaries = new Map();
  const encoded = [];
  const skipped = [];
  const stepsBySource = new Map();
  plan.forEach((step) => {
    stepsBySource.set(step.source, [...(stepsBySource.get(step.source) ?? []), step]);
  });

  const probe = (filePath) => {
    const ffprobe = requireBinary("ffprobe", resolveBinary, binaries);
    const result = runCommand(ffprobe, [...PROBE_ARGS, filePath]);
    const dimensions = result.status === 0 ? parseProbedDimensions(result.stdout) : null;
    if (!dimensions) {
      throw new Error(`ffprobe could not read the dimensions of ${path.relative(root, filePath)}.`);
    }
    return dimensions;
  };

  const record = {
    generatedBy: "scripts/optimize-media.mjs",
    thresholdBytes: SIZE_THRESHOLD_BYTES,
    entries: [],
  };

  for (const entry of manifest) {
    const input = path.join(root, entry.source);
    for (const step of stepsBySource.get(entry.source) ?? []) {
      const output = path.join(root, step.derivative.path);
      if (step.action === "skip") {
        skipped.push(step.derivative.path);
        log(`skip   ${step.derivative.path} (${step.reason})`);
        continue;
      }
      const { binary, args } = encoderCommand(step.derivative, { input, output });
      const resolved = requireBinary(binary, resolveBinary, binaries);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      const result = runCommand(resolved, args);
      if (result.status !== 0) {
        throw new Error(
          `${binary} failed for ${step.derivative.path} (exit ${result.status}): ${result.stderr.trim()}`
        );
      }
      encoded.push(step.derivative.path);
      log(`encode ${step.derivative.path} (${step.reason})`);
    }

    const sourceDimensions = probe(input);
    record.entries.push({
      source: entry.source,
      sourceBytes: fs.statSync(input).size,
      width: sourceDimensions.width,
      height: sourceDimensions.height,
      derivatives: entry.derivatives.map((derivative) => {
        const derivativePath = path.join(root, derivative.path);
        const dimensions = probe(derivativePath);
        return {
          path: derivative.path,
          format: derivative.format,
          flags: [...derivative.flags],
          bytes: fs.statSync(derivativePath).size,
          width: dimensions.width,
          height: dimensions.height,
        };
      }),
    });
    writeRecord(root, record);
  }

  writeRecord(root, record);

  return { encoded, skipped, record };
};

/**
 * The command line: `--check` verifies, anything else encodes. The root and the
 * two streams are injected so every branch runs in-process under a test, rather
 * than only in a child the coverage report cannot see.
 *
 * @returns {number} the process exit code.
 */
export const runOptimizeMediaCli = ({
  argv = process.argv.slice(2),
  root = REPOSITORY_ROOT,
  stdout = (text) => process.stdout.write(text),
  stderr = (text) => process.stderr.write(text),
} = {}) => {
  if (argv.includes("--check")) {
    const { ok, problems } = checkOptimizedMedia({ root });
    if (!ok) {
      stderr(`${problems.map((problem) => `- ${problem}`).join("\n")}\n`);
      return 1;
    }
    stdout(`Optimized media is current for ${MEDIA_MANIFEST.length} sources.\n`);
    return 0;
  }

  const { encoded, skipped } = optimizeMedia({ root, log: (line) => stdout(`${line}\n`) });
  stdout(
    `Encoded ${encoded.length} derivative(s), skipped ${skipped.length} already current.\n`
  );
  return 0;
};

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) process.exitCode = runOptimizeMediaCli();
