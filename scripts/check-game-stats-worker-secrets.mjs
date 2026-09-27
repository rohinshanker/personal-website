import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "./lib/jsonc.mjs";

export const WRANGLER_CONFIG_URL = new URL(
  "../workers/game-stats/wrangler.jsonc",
  import.meta.url
);
const WORKER_DIRECTORY = fileURLToPath(new URL("../workers/game-stats/", import.meta.url));
const SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * `secrets.required` in `wrangler.jsonc` is documentation that Wrangler itself
 * ignores, so this script is what turns it into a release gate.
 */
export const readRequiredSecretNames = async ({
  configUrl = WRANGLER_CONFIG_URL,
  readFileImpl = readFile,
} = {}) => {
  const config = parseJsonc(await readFileImpl(configUrl, "utf8"));
  const requiredNames = config.secrets?.required;
  if (
    !Array.isArray(requiredNames) ||
    requiredNames.length === 0 ||
    requiredNames.some(
      (name) => typeof name !== "string" || !SECRET_NAME_PATTERN.test(name)
    ) ||
    new Set(requiredNames).size !== requiredNames.length
  ) {
    throw new Error(
      "Wrangler configuration must list unique uppercase secrets.required names"
    );
  }
  return Object.freeze([...requiredNames]);
};

/** Reads the names out of `wrangler secret list --format json`. */
export const parseDeployedSecretNames = (output) => {
  let payload;
  try {
    payload = JSON.parse(output);
  } catch (error) {
    throw new Error("Wrangler secret list did not return valid JSON", {
      cause: error,
    });
  }
  if (
    !Array.isArray(payload) ||
    payload.some((entry) => typeof entry?.name !== "string")
  ) {
    throw new Error("Wrangler secret list did not return named secrets");
  }
  return Object.freeze(payload.map((entry) => entry.name));
};

export const listDeployedSecrets = ({
  spawnImpl = spawnSync,
  workerDirectory = WORKER_DIRECTORY,
} = {}) => {
  const result = spawnImpl(
    "npx",
    ["wrangler", "secret", "list", "--config", "wrangler.jsonc", "--format", "json"],
    { cwd: workerDirectory, encoding: "utf8" }
  );
  if (result.error) {
    throw new Error("Unable to run wrangler secret list", { cause: result.error });
  }
  if (result.status !== 0) {
    throw new Error(
      `wrangler secret list exited with status ${result.status}: ${String(
        result.stderr || ""
      ).trim()}`
    );
  }
  return String(result.stdout || "");
};

export const checkGameStatsWorkerSecrets = async ({
  listDeployedSecretsImpl = listDeployedSecrets,
  ...options
} = {}) => {
  const requiredNames = await readRequiredSecretNames(options);
  const deployedNames = parseDeployedSecretNames(listDeployedSecretsImpl());
  const missingNames = requiredNames.filter(
    (name) => !deployedNames.includes(name)
  );
  if (missingNames.length > 0) {
    throw new Error(
      `The deployed Worker is missing required secrets: ${missingNames.join(", ")}`
    );
  }
  return Object.freeze({ requiredNames, deployedNames });
};

export const runGameStatsWorkerSecretsCheck = async ({
  checkImpl = checkGameStatsWorkerSecrets,
  writeOutput = (message) => console.log(message),
  writeError = (message) => console.error(message),
} = {}) => {
  try {
    const { requiredNames } = await checkImpl();
    writeOutput(
      `Verified ${requiredNames.length} required Worker secrets are configured.`
    );
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(`::error::${message}`);
    return 1;
  }
};

const scriptPath = fileURLToPath(import.meta.url);

/* node:coverage ignore next 3 */
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = await runGameStatsWorkerSecretsCheck();
}
