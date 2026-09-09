/**
 * Resolves the port and artifact directory shared by the Playwright
 * configuration and the visual-baseline runner.
 *
 * Both are task-selectable so two worktrees can run browser suites at the same
 * time without colliding on a port or overwriting each other's artifacts.
 */

import { posix } from "node:path";

export const DEFAULT_UI_TEST_PORT = 4173;
export const DEFAULT_UI_TEST_OUTPUT_DIR = "test-results";

const MIN_PORT = 1024;
const MAX_PORT = 65535;

/**
 * @param {Record<string, string | undefined>} env
 * @returns {number} the port the suite serves this checkout on.
 */
export const resolveUiTestPort = (env = process.env) => {
  const raw = env.UI_TEST_PORT?.trim();
  if (!raw) return DEFAULT_UI_TEST_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(
      `UI_TEST_PORT must be an integer between ${MIN_PORT} and ${MAX_PORT}; received ${JSON.stringify(raw)}.`
    );
  }
  return port;
};

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string} the base URL every spec navigates against.
 */
export const resolveUiTestBaseUrl = (env = process.env) =>
  `http://127.0.0.1:${resolveUiTestPort(env)}`;

/**
 * Keep output inside the ignored test-results tree. Playwright clears this
 * directory before a run, so accepting source directories or the checkout root
 * would make a configuration typo destructive.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string} a repository-relative directory for traces and failure media.
 */
export const resolveUiTestOutputDir = (env = process.env) => {
  const raw = env.UI_TEST_OUTPUT_DIR?.trim();
  if (!raw) return DEFAULT_UI_TEST_OUTPUT_DIR;
  const normalized = posix.normalize(raw);
  if (normalized !== DEFAULT_UI_TEST_OUTPUT_DIR &&
      !normalized.startsWith(`${DEFAULT_UI_TEST_OUTPUT_DIR}/`)) {
    throw new Error(
      `UI_TEST_OUTPUT_DIR must be test-results or a directory beneath it; received ${JSON.stringify(raw)}.`
    );
  }
  return normalized;
};
