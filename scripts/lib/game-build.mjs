import { createHash } from "node:crypto";

/**
 * One definition of the public Game Stats build identity, shared by every
 * repository script that generates, verifies, or compares it. The Worker keeps
 * its own copies because a deployed Worker bundle must not reach outside
 * `workers/game-stats`; `tests/game-stats-integrity.test.mjs` proves the two
 * stay equal.
 */
export const GAME_BUILD_VERSION_PATTERN = /^sha256-[a-f0-9]{64}$/;
export const MAX_GAME_BUILD_COMPATIBILITY_VERSIONS = 32;

/**
 * The browser files that decide when a game starts and completes. The digest is
 * a release identifier, not a secret or proof that a client did not modify code
 * after the browser loaded it.
 *
 * The Sudoku generator worker belongs here because the solution it returns
 * becomes `sudokuState.solution`, which is what decides whether a board is
 * correct and complete. A release that changes only the worker changes what
 * counts as a win, so it must change the build version too.
 */
export const GAME_COMPLETION_SOURCE_FILES = Object.freeze([
  "scripts/home/main.js",
  "scripts/home/core/dom.js",
  "scripts/home/sudoku-generator.worker.js",
]);

/** Assets whose cache token carries the generated build version. */
export const INTEGRITY_CACHE_ASSET_PATHS = Object.freeze([
  "scripts/home/game-stats-backend.js",
  "scripts/home/core/dom.js",
  "scripts/home/main.js",
  "scripts/home/sudoku-generator.worker.js",
]);

/** Public HTML entry points that load the completion sources. */
export const INTEGRITY_ENTRY_FILES = Object.freeze(["home.html", "index.html"]);

export const createIntegrityCacheToken = (buildVersion) =>
  `game-build-${buildVersion.replace(/^sha256-/, "")}`;

/**
 * Digests the completion sources as `relative path + NUL + bytes + NUL`, in the
 * declared order. `readSource` resolves each relative path to its bytes, so the
 * same function serves local files and fetched deployment responses.
 */
export const digestGameCompletionSources = async (readSource) => {
  const digest = createHash("sha256");
  for (const relativePath of GAME_COMPLETION_SOURCE_FILES) {
    digest.update(relativePath);
    digest.update("\0");
    digest.update(await readSource(relativePath));
    digest.update("\0");
  }
  return `sha256-${digest.digest("hex")}`;
};
