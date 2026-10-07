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
 * Membership follows one rule, so a new feature script cannot drift out of it:
 * the four game scripts and the Game Stats client, plus every Home script they
 * read a contract from at load time, transitively. `GAME_SEED_SOURCE_FILES`
 * names the starting points and `tests/game-stats-integrity.test.mjs` proves
 * this list is exactly that closure.
 *
 * The boot entry is not a seed. It wires start-up and announces unload; it does
 * not decide a win, and seeding it would pull the calendar and the random-event
 * runtime into every release identifier.
 *
 * The Sudoku generator worker is listed directly because it is loaded as a
 * worker rather than through a contract. The solution it returns becomes
 * `sudokuState.solution`, which is what decides whether a board is correct and
 * complete, so a release that changes only the worker must change the build
 * version too.
 */
export const GAME_SEED_SOURCE_FILES = Object.freeze([
  "scripts/home/features/snake.js",
  "scripts/home/features/minesweeper.js",
  "scripts/home/features/solitaire.js",
  "scripts/home/features/sudoku.js",
  "scripts/home/features/game-stats.js",
]);

export const GAME_COMPLETION_SOURCE_FILES = Object.freeze([
  "scripts/home/core/activation.js",
  "scripts/home/core/activity.js",
  "scripts/home/core/administrator-session.js",
  "scripts/home/core/dom.js",
  "scripts/home/core/media.js",
  "scripts/home/core/pointer-cursor.js",
  "scripts/home/core/static-noise.js",
  "scripts/home/core/util.js",
  "scripts/home/core/windows.js",
  "scripts/home/features/game-stats.js",
  "scripts/home/features/minesweeper.js",
  "scripts/home/features/snake.js",
  "scripts/home/features/solitaire.js",
  "scripts/home/features/sudoku.js",
  "scripts/home/games/minesweeper.js",
  "scripts/home/games/rules.js",
  "scripts/home/games/session.js",
  "scripts/home/games/snake.js",
  "scripts/home/games/solitaire.js",
  "scripts/home/games/sudoku.js",
  "scripts/home/sudoku-generator.worker.js",
]);

/**
 * Assets whose cache token carries the generated build version: the completion
 * sources, so a browser cannot mix a cached old game script with a new one, and
 * the generated backend config that records the version.
 */
export const INTEGRITY_CACHE_ASSET_PATHS = Object.freeze([
  "scripts/home/game-stats-backend.js",
  ...GAME_COMPLETION_SOURCE_FILES,
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
export const digestGameCompletionSources = async (
  readSource,
  sourceFiles = GAME_COMPLETION_SOURCE_FILES
) => {
  const digest = createHash("sha256");
  for (const relativePath of sourceFiles) {
    digest.update(relativePath);
    digest.update("\0");
    digest.update(await readSource(relativePath));
    digest.update("\0");
  }
  return `sha256-${digest.digest("hex")}`;
};
