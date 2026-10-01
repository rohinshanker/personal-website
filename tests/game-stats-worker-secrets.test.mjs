import assert from "node:assert/strict";
import test from "node:test";

import {
  checkGameStatsWorkerSecrets,
  listDeployedSecrets,
  parseDeployedSecretNames,
  readRequiredSecretNames,
  runGameStatsWorkerSecretsCheck,
} from "../scripts/check-game-stats-worker-secrets.mjs";

const REQUIRED_SECRET_NAMES = Object.freeze([
  "EVENT_SIGNING_SECRET",
  "IP_HASH_SECRET",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SIGNING_SECRET",
  "CLASH_ROYALE_API_KEY",
]);

const secretListOutput = (names) =>
  JSON.stringify(names.map((name) => ({ name, type: "secret_text" })));

test("the checked-in Wrangler configuration lists the six required secrets", async () => {
  assert.deepEqual(
    Array.from(await readRequiredSecretNames()),
    REQUIRED_SECRET_NAMES
  );
});

test("required secret names must be unique uppercase strings", async () => {
  const withConfig = (config) =>
    readRequiredSecretNames({ readFileImpl: async () => JSON.stringify(config) });

  for (const secrets of [
    undefined,
    {},
    { required: [] },
    { required: "EVENT_SIGNING_SECRET" },
    { required: ["EVENT_SIGNING_SECRET", 7] },
    { required: ["lowercase_secret"] },
    { required: ["EVENT_SIGNING_SECRET", "EVENT_SIGNING_SECRET"] },
  ]) {
    await assert.rejects(
      withConfig({ secrets }),
      /unique uppercase secrets\.required names/
    );
  }
  assert.deepEqual(
    Array.from(
      await withConfig({
        // A comment must not break the gate that reads this file.
        secrets: { required: ["EVENT_SIGNING_SECRET"] },
      })
    ),
    ["EVENT_SIGNING_SECRET"]
  );
});

test("a Wrangler secret list parses into names and rejects other payloads", () => {
  assert.deepEqual(
    Array.from(parseDeployedSecretNames(secretListOutput(REQUIRED_SECRET_NAMES))),
    REQUIRED_SECRET_NAMES
  );
  assert.deepEqual(Array.from(parseDeployedSecretNames("[]")), []);
  assert.throws(
    () => parseDeployedSecretNames("not json"),
    /did not return valid JSON/
  );
  for (const payload of ['{"name":"A"}', '[{"type":"secret_text"}]', "null"]) {
    assert.throws(
      () => parseDeployedSecretNames(payload),
      /did not return named secrets/
    );
  }
});

test("the gate accepts a complete secret set and names what is missing", async () => {
  assert.deepEqual(
    (
      await checkGameStatsWorkerSecrets({
        listDeployedSecretsImpl: () =>
          secretListOutput([...REQUIRED_SECRET_NAMES, "TURNSTILE_SECRET_KEY"]),
      })
    ).requiredNames,
    REQUIRED_SECRET_NAMES
  );

  await assert.rejects(
    checkGameStatsWorkerSecrets({
      listDeployedSecretsImpl: () =>
        secretListOutput(["EVENT_SIGNING_SECRET", "IP_HASH_SECRET"]),
    }),
    /missing required secrets: ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SIGNING_SECRET, CLASH_ROYALE_API_KEY/
  );
});

test("the Wrangler invocation is bounded to the Worker configuration", () => {
  const calls = [];
  const output = listDeployedSecrets({
    spawnImpl: (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0, stdout: "[]" };
    },
    workerDirectory: "/repo/workers/game-stats/",
  });

  assert.equal(output, "[]");
  assert.deepEqual(calls, [
    {
      command: "npx",
      args: [
        "wrangler",
        "secret",
        "list",
        "--config",
        "wrangler.jsonc",
        "--format",
        "json",
      ],
      options: { cwd: "/repo/workers/game-stats/", encoding: "utf8" },
    },
  ]);
  assert.equal(listDeployedSecrets({ spawnImpl: () => ({ status: 0 }) }), "");
  assert.throws(
    () => parseDeployedSecretNames(""),
    /did not return valid JSON/
  );
});

test("a failed Wrangler invocation is reported, not treated as an empty list", () => {
  const spawnError = new Error("npx is unavailable");
  assert.throws(
    () => listDeployedSecrets({ spawnImpl: () => ({ error: spawnError }) }),
    (error) => {
      assert.match(error.message, /Unable to run wrangler secret list/);
      assert.equal(error.cause, spawnError);
      return true;
    }
  );
  assert.throws(
    () =>
      listDeployedSecrets({
        spawnImpl: () => ({ status: 1, stderr: " Authentication error \n" }),
      }),
    /exited with status 1: Authentication error/
  );
  assert.throws(
    () => listDeployedSecrets({ spawnImpl: () => ({ status: 1 }) }),
    /exited with status 1: $/
  );
});

test("the secrets runner annotates failures and returns shell exit codes", async () => {
  const output = [];
  const errors = [];

  assert.equal(
    await runGameStatsWorkerSecretsCheck({
      checkImpl: async () => ({ requiredNames: REQUIRED_SECRET_NAMES }),
      writeOutput: (message) => output.push(message),
      writeError: (message) => errors.push(message),
    }),
    0
  );
  assert.deepEqual(output, [
    "Verified 6 required Worker secrets are configured.",
  ]);
  assert.deepEqual(errors, []);

  assert.equal(
    await runGameStatsWorkerSecretsCheck({
      checkImpl: async () => {
        throw new Error("IP_HASH_SECRET is missing");
      },
      writeOutput: (message) => output.push(message),
      writeError: (message) => errors.push(message),
    }),
    1
  );
  assert.deepEqual(errors, ["::error::IP_HASH_SECRET is missing"]);

  assert.equal(
    await runGameStatsWorkerSecretsCheck({
      checkImpl: async () => {
        throw "wrangler crashed";
      },
      writeOutput: (message) => output.push(message),
      writeError: (message) => errors.push(message),
    }),
    1
  );
  assert.deepEqual(errors.at(-1), "::error::wrangler crashed");
});

test("the secrets runner keeps safe default console reporters", async (context) => {
  const log = context.mock.method(console, "log", () => {});
  const error = context.mock.method(console, "error", () => {});

  assert.equal(
    await runGameStatsWorkerSecretsCheck({
      checkImpl: async () => ({ requiredNames: [] }),
    }),
    0
  );
  assert.equal(
    await runGameStatsWorkerSecretsCheck({
      checkImpl: async () => {
        throw new Error("no credentials");
      },
    }),
    1
  );
  assert.deepEqual(log.mock.calls[0].arguments, [
    "Verified 0 required Worker secrets are configured.",
  ]);
  assert.deepEqual(error.mock.calls[0].arguments, ["::error::no credentials"]);
});
