import assert from "node:assert/strict";
import test from "node:test";

import {
  GITHUB_API_VERSION,
  checkCurrentMainRevision,
  fetchCurrentMainCommitSha,
  getMissingProductionCredentialNames,
  runCurrentMainRevisionCheck,
  runGameStatsReleaseContextCli,
  runProductionCredentialCheck,
} from "../scripts/check-game-stats-release-context.mjs";

const WORKFLOW_COMMIT_SHA = "a".repeat(40);
const OTHER_COMMIT_SHA = "b".repeat(40);

const createGitHubResponse = (
  commitSha = WORKFLOW_COMMIT_SHA,
  { ok = true, status = 200 } = {}
) => ({
  ok,
  status,
  json: async () => ({ object: { sha: commitSha } }),
});

test("production credential check accepts only non-empty secret values", () => {
  const environment = {
    CLOUDFLARE_API_TOKEN: "test-api-token",
    CLOUDFLARE_ACCOUNT_ID: "test-account-id",
  };
  assert.deepEqual(getMissingProductionCredentialNames(environment), []);
  assert.equal(runProductionCredentialCheck({ environment }), 0);

  assert.deepEqual(
    getMissingProductionCredentialNames({
      ...environment,
      CLOUDFLARE_API_TOKEN: "  ",
      CLOUDFLARE_ACCOUNT_ID: null,
    }),
    ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]
  );
});

test("production credential check reports each missing secret without values", () => {
  const errors = [];
  assert.equal(
    runProductionCredentialCheck({
      environment: { CLOUDFLARE_API_TOKEN: "test-api-token" },
      writeError: (message) => errors.push(message),
    }),
    1
  );
  assert.deepEqual(errors, [
    "::error::Missing CLOUDFLARE_ACCOUNT_ID repository secret.",
  ]);

  errors.length = 0;
  assert.equal(
    runProductionCredentialCheck({
      environment: {},
      writeError: (message) => errors.push(message),
    }),
    1
  );
  assert.deepEqual(errors, [
    "::error::Missing CLOUDFLARE_API_TOKEN repository secret.",
    "::error::Missing CLOUDFLARE_ACCOUNT_ID repository secret.",
  ]);
});

test("fetches the current main revision with bounded authenticated GitHub API access", async () => {
  const expectedSignal = { name: "test-timeout-signal" };
  const calls = [];
  const result = await fetchCurrentMainCommitSha({
    repository: "owner/repository",
    token: "test-token",
    timeoutMs: 321,
    createTimeoutSignal: (milliseconds) => {
      assert.equal(milliseconds, 321);
      return expectedSignal;
    },
    fetchImpl: async (...args) => {
      calls.push(args);
      return createGitHubResponse();
    },
  });

  assert.equal(result, WORKFLOW_COMMIT_SHA);
  assert.deepEqual(calls, [
    [
      "https://api.github.com/repos/owner/repository/git/ref/heads/main",
      {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer test-token",
          "User-Agent": "personal-site-game-stats-release",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
        signal: expectedSignal,
      },
    ],
  ]);
});

test("rejects invalid GitHub release-context inputs", async () => {
  for (const repository of [undefined, "owner", "/repository", "owner/repo/name"]) {
    await assert.rejects(
      fetchCurrentMainCommitSha({ repository, token: "test-token" }),
      /owner\/name format/
    );
  }
  await assert.rejects(
    fetchCurrentMainCommitSha({ repository: "owner/repository", token: " " }),
    /GITHUB_TOKEN is required/
  );
  await assert.rejects(
    fetchCurrentMainCommitSha({
      repository: "owner/repository",
      token: "test-token",
      fetchImpl: null,
    }),
    /fetch implementation is required/
  );
  for (const timeoutMs of [0, -1, 1.5, Number.NaN]) {
    await assert.rejects(
      fetchCurrentMainCommitSha({
        repository: "owner/repository",
        token: "test-token",
        timeoutMs,
      }),
      /timeout must be a positive integer/
    );
  }
  await assert.rejects(
    fetchCurrentMainCommitSha({
      repository: "owner/repository",
      token: "test-token",
      createTimeoutSignal: null,
    }),
    /timeout signal factory is required/
  );
});

test("reports GitHub network, response, status, JSON, and payload failures", async () => {
  const requestOptions = {
    repository: "owner/repository",
    token: "test-token",
  };
  const networkError = new Error("offline");
  await assert.rejects(
    fetchCurrentMainCommitSha({
      ...requestOptions,
      fetchImpl: async () => {
        throw networkError;
      },
    }),
    (error) => {
      assert.match(error.message, /Unable to read refs\/heads\/main/);
      assert.equal(error.cause, networkError);
      return true;
    }
  );

  for (const response of [null, {}, { ok: true, json: "not-a-function" }]) {
    await assert.rejects(
      fetchCurrentMainCommitSha({
        ...requestOptions,
        fetchImpl: async () => response,
      }),
      /invalid refs\/heads\/main response/
    );
  }
  await assert.rejects(
    fetchCurrentMainCommitSha({
      ...requestOptions,
      fetchImpl: async () => createGitHubResponse(undefined, { ok: false, status: 503 }),
    }),
    /status 503/
  );
  await assert.rejects(
    fetchCurrentMainCommitSha({
      ...requestOptions,
      fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
    }),
    /status unknown/
  );

  const jsonError = new Error("invalid JSON");
  await assert.rejects(
    fetchCurrentMainCommitSha({
      ...requestOptions,
      fetchImpl: async () => ({
        ok: true,
        json: async () => {
          throw jsonError;
        },
      }),
    }),
    (error) => {
      assert.match(error.message, /not valid JSON/);
      assert.equal(error.cause, jsonError);
      return true;
    }
  );
  for (const payload of [null, {}, { object: {} }, { object: { sha: "A".repeat(40) } }]) {
    await assert.rejects(
      fetchCurrentMainCommitSha({
        ...requestOptions,
        fetchImpl: async () => ({ ok: true, json: async () => payload }),
      }),
      /lowercase 40-character Git commit SHA/
    );
  }
});

test("current-main check accepts the active revision and rejects stale runs", async () => {
  const calls = [];
  assert.deepEqual(
    await checkCurrentMainRevision({
      repository: "owner/repository",
      workflowCommitSha: WORKFLOW_COMMIT_SHA,
      token: "test-token",
      fetchCurrentMainCommitShaImpl: async (options) => {
        calls.push(options);
        return WORKFLOW_COMMIT_SHA;
      },
    }),
    { commitSha: WORKFLOW_COMMIT_SHA }
  );
  assert.deepEqual(calls, [
    {
      repository: "owner/repository",
      token: "test-token",
    },
  ]);

  await assert.rejects(
    checkCurrentMainRevision({
      repository: "owner/repository",
      workflowCommitSha: WORKFLOW_COMMIT_SHA,
      token: "test-token",
      fetchCurrentMainCommitShaImpl: async () => OTHER_COMMIT_SHA,
    }),
    /Workflow revision is stale/
  );
  await assert.rejects(
    checkCurrentMainRevision({
      workflowCommitSha: "A".repeat(40),
      fetchCurrentMainCommitShaImpl: async () => WORKFLOW_COMMIT_SHA,
    }),
    /Workflow revision must be a lowercase 40-character Git commit SHA/
  );
});

test("current-main runner emits safe annotations and exit codes", async () => {
  const output = [];
  const errors = [];
  assert.equal(
    await runCurrentMainRevisionCheck({
      checkImpl: async () => ({ commitSha: WORKFLOW_COMMIT_SHA }),
      writeOutput: (message) => output.push(message),
      writeError: (message) => errors.push(message),
    }),
    0
  );
  assert.deepEqual(output, [
    "Verified workflow revision is current on refs/heads/main.",
  ]);
  assert.deepEqual(errors, []);

  assert.equal(
    await runCurrentMainRevisionCheck({
      checkImpl: async () => {
        throw new Error("Workflow revision is stale");
      },
      writeOutput: (message) => output.push(message),
      writeError: (message) => errors.push(message),
    }),
    1
  );
  assert.equal(
    await runCurrentMainRevisionCheck({
      checkImpl: async () => {
        throw "fixed failure";
      },
      writeOutput: (message) => output.push(message),
      writeError: (message) => errors.push(message),
    }),
    1
  );
  assert.deepEqual(errors, [
    "::error::Workflow revision is stale",
    "::error::fixed failure",
  ]);
});

test("release-context checks retain safe default console reporters", async (context) => {
  const output = [];
  const errors = [];
  context.mock.method(console, "log", (message) => output.push(message));
  context.mock.method(console, "error", (message) => errors.push(message));

  assert.equal(runProductionCredentialCheck({ environment: {} }), 1);
  assert.equal(
    await runCurrentMainRevisionCheck({ checkImpl: async () => ({}) }),
    0
  );
  assert.equal(
    await runCurrentMainRevisionCheck({
      checkImpl: async () => {
        throw new Error("fixed failure");
      },
    }),
    1
  );
  assert.equal(await runGameStatsReleaseContextCli({ args: [] }), 1);

  assert.deepEqual(output, [
    "Verified workflow revision is current on refs/heads/main.",
  ]);
  assert.deepEqual(errors, [
    "::error::Missing CLOUDFLARE_API_TOKEN repository secret.",
    "::error::Missing CLOUDFLARE_ACCOUNT_ID repository secret.",
    "::error::fixed failure",
    "Usage: node scripts/check-game-stats-release-context.mjs " +
      "[--credentials|--current-main]",
  ]);
});

test("release-context CLI dispatches its two checks and rejects invalid usage", async () => {
  const calls = [];
  const runners = {
    runCredentialCheckImpl: () => {
      calls.push("credentials");
      return 10;
    },
    runCurrentMainCheckImpl: async () => {
      calls.push("current-main");
      return 20;
    },
  };
  assert.equal(
    await runGameStatsReleaseContextCli({ args: ["--credentials"], ...runners }),
    10
  );
  assert.equal(
    await runGameStatsReleaseContextCli({ args: ["--current-main"], ...runners }),
    20
  );

  const errors = [];
  assert.equal(
    await runGameStatsReleaseContextCli({
      args: [],
      ...runners,
      writeError: (message) => errors.push(message),
    }),
    1
  );
  assert.deepEqual(calls, ["credentials", "current-main"]);
  assert.deepEqual(errors, [
    "Usage: node scripts/check-game-stats-release-context.mjs " +
      "[--credentials|--current-main]",
  ]);
});
