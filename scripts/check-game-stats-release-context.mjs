import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertFetchDependencies, fetchGuardedBody } from "./lib/http.mjs";

export const GITHUB_API_VERSION = "2022-11-28";
export const GITHUB_REQUEST_TIMEOUT_MS = 10_000;
export const PRODUCTION_CREDENTIAL_NAMES = Object.freeze([
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
]);

const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/;
const GITHUB_REPOSITORY_PATTERN =
  /^([A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+)$/;

const normalizeEnvironmentValue = (value) =>
  typeof value === "string" ? value.trim() : "";

const parseGitHubRepository = (repository) => {
  const normalizedRepository = normalizeEnvironmentValue(repository);
  const match = GITHUB_REPOSITORY_PATTERN.exec(normalizedRepository);
  if (!match) {
    throw new Error("GITHUB_REPOSITORY must use owner/name format");
  }
  return { owner: match[1], repository: match[2] };
};

const parseCommitSha = (value, label) => {
  const commitSha = normalizeEnvironmentValue(value);
  if (!COMMIT_SHA_PATTERN.test(commitSha)) {
    throw new Error(`${label} must be a lowercase 40-character Git commit SHA`);
  }
  return commitSha;
};

export const getMissingProductionCredentialNames = (
  environment = process.env
) =>
  PRODUCTION_CREDENTIAL_NAMES.filter(
    (credentialName) => !normalizeEnvironmentValue(environment?.[credentialName])
  );

export const runProductionCredentialCheck = ({
  environment = process.env,
  writeError = (message) => console.error(message),
} = {}) => {
  const missingCredentialNames = getMissingProductionCredentialNames(environment);
  for (const credentialName of missingCredentialNames) {
    writeError(`::error::Missing ${credentialName} repository secret.`);
  }
  return missingCredentialNames.length === 0 ? 0 : 1;
};

export const fetchCurrentMainCommitSha = async ({
  repository,
  token,
  fetchImpl = globalThis.fetch,
  timeoutMs = GITHUB_REQUEST_TIMEOUT_MS,
  createTimeoutSignal = (milliseconds) => AbortSignal.timeout(milliseconds),
} = {}) => {
  const { owner, repository: repositoryName } = parseGitHubRepository(repository);
  const normalizedToken = normalizeEnvironmentValue(token);
  if (!normalizedToken) {
    throw new Error("GITHUB_TOKEN is required to verify the current main revision");
  }
  assertFetchDependencies({
    fetchImpl,
    timeoutMs,
    createTimeoutSignal,
    purpose: "to verify main",
    timeoutLabel: "GitHub request timeout",
  });

  const url =
    `https://api.github.com/repos/${owner}/${repositoryName}/git/ref/heads/main`;
  const payload = await fetchGuardedBody(url, {
    fetchImpl,
    timeoutMs,
    createTimeoutSignal,
    readAs: "json",
    init: {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${normalizedToken}`,
        "User-Agent": "personal-site-game-stats-release",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
    },
    messages: {
      requestFailed: "Unable to read refs/heads/main from GitHub",
      invalidResponse: "GitHub returned an invalid refs/heads/main response",
      statusFailed: (status) =>
        `GitHub refs/heads/main request failed with status ${status}`,
      bodyUnreadable: "GitHub refs/heads/main response was not valid JSON",
    },
  });
  return parseCommitSha(payload?.object?.sha, "GitHub refs/heads/main revision");
};

export const checkCurrentMainRevision = async ({
  repository = process.env.GITHUB_REPOSITORY,
  workflowCommitSha = process.env.GITHUB_SHA,
  token = process.env.GITHUB_TOKEN,
  fetchCurrentMainCommitShaImpl = fetchCurrentMainCommitSha,
  ...fetchOptions
} = {}) => {
  const expectedCommitSha = parseCommitSha(
    workflowCommitSha,
    "Workflow revision"
  );
  const currentMainCommitSha = await fetchCurrentMainCommitShaImpl({
    repository,
    token,
    ...fetchOptions,
  });
  if (currentMainCommitSha !== expectedCommitSha) {
    throw new Error(
      "Workflow revision is stale: refs/heads/main moved after this run started"
    );
  }
  return { commitSha: expectedCommitSha };
};

export const runCurrentMainRevisionCheck = async ({
  checkImpl = checkCurrentMainRevision,
  writeOutput = (message) => console.log(message),
  writeError = (message) => console.error(message),
} = {}) => {
  try {
    await checkImpl();
    writeOutput("Verified workflow revision is current on refs/heads/main.");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(`::error::${message}`);
    return 1;
  }
};

export const runGameStatsReleaseContextCli = async ({
  args = process.argv.slice(2),
  runCredentialCheckImpl = runProductionCredentialCheck,
  runCurrentMainCheckImpl = runCurrentMainRevisionCheck,
  writeError = (message) => console.error(message),
} = {}) => {
  if (args.length === 1 && args[0] === "--credentials") {
    return runCredentialCheckImpl();
  }
  if (args.length === 1 && args[0] === "--current-main") {
    return runCurrentMainCheckImpl();
  }
  writeError(
    "Usage: node scripts/check-game-stats-release-context.mjs " +
      "[--credentials|--current-main]"
  );
  return 1;
};

const scriptPath = fileURLToPath(import.meta.url);

/* node:coverage ignore next 3 */
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = await runGameStatsReleaseContextCli();
}
