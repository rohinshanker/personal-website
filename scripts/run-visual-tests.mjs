#!/usr/bin/env node
/**
 * Runs the `visual` Playwright project in the one environment its baselines are
 * valid in: the `mcr.microsoft.com/playwright` container matching the
 * `playwright-core` version pinned by `package-lock.json`.
 *
 * The container is always used, including on Linux, so a developer machine and
 * CI rasterize with the same browser build and the same fonts. Its
 * `node_modules` lives in a Docker volume installed from the lockfile, so a
 * host install for another platform is never mounted into Linux.
 *
 * Any extra argument is passed straight to `playwright test`, so
 * `node scripts/run-visual-tests.mjs --update-snapshots` regenerates baselines.
 */

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { resolveUiTestOutputDir } from "../tests/ui/server-config.mjs";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CONTAINER_WORKDIR = "/repo";
const CONTAINER_MODULES = `${CONTAINER_WORKDIR}/node_modules`;

/**
 * Linux ARM64 matches Apple Silicon and the CI runner. Changing architecture
 * requires regenerating the complete baseline set and updating CI together.
 */
const DEFAULT_CONTAINER_PLATFORM = "linux/arm64";

/** Environment variables the container needs to reproduce the host invocation. */
const FORWARDED_ENV = Object.freeze([
  "CI",
  "UI_TEST_PORT",
  "UI_TEST_OUTPUT_DIR",
  "UI_TEST_SERVER_LOGS",
]);

/**
 * Installs from the lockfile in a fresh volume, then runs the project.
 * Passthrough arguments arrive as positional parameters, so nothing
 * from the command line is interpreted by the shell.
 */
const CONTAINER_SCRIPT =
  'set -e; ' +
  'npm ci --no-audit --no-fund; ' +
  'exec ./node_modules/.bin/playwright test --project=visual "$@"';

/**
 * @param {string} lockfileText contents of `package-lock.json`.
 * @returns {string} the image tag matching the lockfile, so a baseline can never
 *   be produced by a different browser build.
 */
export const resolvePinnedImage = (lockfileText) => {
  const version = JSON.parse(lockfileText).packages?.["node_modules/playwright-core"]
    ?.version;
  if (!version) {
    throw new Error(
      "package-lock.json does not pin node_modules/playwright-core; run `npm install` first."
    );
  }
  return `mcr.microsoft.com/playwright:v${version}-noble`;
};

/**
 * Builds the full `docker` argument list.
 *
 * @param {{lockfileText: string, env: Record<string, string | undefined>, args: string[]}} options
 * @returns {string[]}
 */
export const buildDockerArguments = ({ lockfileText, env, args }) => {
  // Rejects an artifact directory the host could not read back.
  resolveUiTestOutputDir(env);
  const forwarded = FORWARDED_ENV.filter((name) => env[name] !== undefined).flatMap(
    (name) => ["--env", `${name}=${env[name]}`]
  );
  return [
    "run",
    "--rm",
    "--init",
    "--ipc=host",
    "--platform",
    env.UI_VISUAL_PLATFORM || DEFAULT_CONTAINER_PLATFORM,
    "--volume",
    `${REPOSITORY_ROOT}:${CONTAINER_WORKDIR}`,
    "--volume",
    CONTAINER_MODULES,
    "--workdir",
    CONTAINER_WORKDIR,
    ...forwarded,
    resolvePinnedImage(lockfileText),
    "sh",
    "-c",
    CONTAINER_SCRIPT,
    "sh",
    ...args,
  ];
};

const dockerIsRunning = () =>
  spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;

const main = async () => {
  if (!dockerIsRunning()) {
    console.error(
      [
        "Visual baselines are generated and compared inside the pinned Playwright",
        "container, so Docker must be running. Start Docker and retry.",
      ].join("\n")
    );
    return 1;
  }

  const lockfileText = await readFile(
    new URL("../package-lock.json", import.meta.url),
    "utf8"
  );
  const result = spawnSync(
    "docker",
    buildDockerArguments({
      lockfileText,
      env: process.env,
      args: process.argv.slice(2),
    }),
    { stdio: "inherit", cwd: REPOSITORY_ROOT }
  );
  return result.status ?? 1;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
