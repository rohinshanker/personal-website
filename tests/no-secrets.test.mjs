import assert from "node:assert/strict";
import test from "node:test";

import {
  findSecretFindings,
  scanRepositoryForSecrets,
} from "../scripts/check-no-secrets.mjs";

test("secret guard identifies credentials without exposing their values", () => {
  const githubToken = ["ghp_", "A".repeat(36)].join("");
  const privateKeyHeader = ["-----BEGIN", " PRIVATE KEY-----"].join("");
  const protectedName = ["EVENT_", "SIGNING_SECRET"].join("");
  const administratorPasswordName = ["ADMIN_", "PASSWORD"].join("");
  const administratorSigningSecretName = ["ADMIN_", "SESSION_SIGNING_SECRET"].join("");
  const findings = findSecretFindings(
    "config.mjs",
    `const token = "${githubToken}";\n${privateKeyHeader}\n${protectedName} = "live-value-that-is-long-enough";\n${administratorPasswordName} = "another-long-live-value";\n${administratorSigningSecretName} = "third-long-live-value";`
  );

  assert.deepEqual(findings, [
    "github-token",
    "hard-coded-admin-credential",
    "hard-coded-secret-assignment",
    "private-key-block",
  ]);
});

test("secret guard permits documented local-variable templates but rejects real secret file names", () => {
  assert.deepEqual(
    findSecretFindings(".dev.vars.example", "EXAMPLE_VALUE=replace-with-local-value"),
    []
  );
  assert.deepEqual(findSecretFindings(".dev.vars", ""), ["sensitive-file-name"]);
  assert.deepEqual(findSecretFindings("credentials.json", ""), ["sensitive-file-name"]);
  assert.deepEqual(findSecretFindings("credentials.p12", ""), ["sensitive-file-name"]);
  assert.deepEqual(findSecretFindings("service-account-prod.json", ""), ["sensitive-file-name"]);
  assert.deepEqual(findSecretFindings("id_ed25519", ""), ["sensitive-file-name"]);
});

test("secret guard rejects short Administrator identity literals without reporting them", () => {
  const administratorUsernameName = ["ADMIN_", "USERNAME"].join("");
  const administratorPasswordName = ["admin", "Password"].join("");
  const administratorPasswordHashName = ["admin", "Password", "Hash"].join("");
  const envStylePasswordName = ["ADMIN_", "PASSWORD"].join("");
  const findings = findSecretFindings(
    "config.mjs",
    `const ${administratorUsernameName} = "u";\nconst ${administratorPasswordName} = "p";\nconst ${administratorPasswordHashName} = "h";\n${envStylePasswordName}=tiny`
  );

  assert.deepEqual(findings, ["hard-coded-admin-credential"]);
  assert.deepEqual(
    findSecretFindings(
      ".dev.vars.example",
      `${administratorUsernameName}=replace-with-local-username\n${envStylePasswordName}=replace-with-local-password`
    ),
    []
  );
});

test("repository candidates contain no credential indicators", async () => {
  assert.deepEqual(await scanRepositoryForSecrets(), []);
});
