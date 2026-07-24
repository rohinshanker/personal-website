import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
export const REPOSITORY_ROOT = path.resolve(path.dirname(scriptPath), "..");

const APPROVED_TEMPLATE_FILE_NAMES = new Set([".env.example", ".dev.vars.example"]);
const SENSITIVE_FILE_NAME = /^(?:\.env(?:\..+)?|\.dev\.vars(?:\..+)?|id_(?:rsa|ecdsa|ed25519)|(?:credentials|service-account|secrets).*\.json|.*\.(?:pem|key|p12|pfx|jks|keystore))$/i;
const SAFE_PLACEHOLDER_VALUE = /^(?:(?:[a-z]+-)?test[-_]|replace[-_]|example[-_]|your[-_]|change[-_]|<|\$\{|process\.env\.|env\.)/i;

const VALUE_RULES = Object.freeze([
  ["private-key-block", /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY(?: BLOCK)?-----/i],
  ["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["gitlab-token", /\bglpat-[A-Za-z0-9_-]{20,}\b/],
  ["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["npm-token", /\bnpm_[A-Za-z0-9]{20,}\b/],
  ["stripe-live-secret", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ["openai-api-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  [
    "hard-coded-bearer-token",
    /(?:Authorization\s*[:=]\s*["'`]?\s*Bearer|\bBearer)\s+[A-Za-z0-9._-]{20,}/i,
  ],
]);

const PROTECTED_SECRET_ASSIGNMENT = /(?:^|[,{;\s])(?:[A-Z][A-Z0-9_]*_(?:API_KEY|API_TOKEN|ACCESS_TOKEN|CLIENT_SECRET|SECRET_KEY|PRIVATE_KEY)|API_KEY|API_TOKEN|ACCESS_TOKEN|CLIENT_SECRET|SECRET_KEY|PRIVATE_KEY|PASSWORD|DATABASE_URL|EVENT_SIGNING_SECRET|IP_HASH_SECRET|TURNSTILE_SECRET_KEY|ADMIN_USERNAME|ADMIN_PASSWORD|ADMIN_SESSION_SIGNING_SECRET|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLASH_API_TOKEN)\s*[:=]\s*["'`]([^"'`\r\n]{12,})["'`]/gm;

const isApprovedTemplateFile = (relativePath) =>
  APPROVED_TEMPLATE_FILE_NAMES.has(path.basename(relativePath));

const findProtectedSecretAssignments = (source) => {
  const findings = [];
  PROTECTED_SECRET_ASSIGNMENT.lastIndex = 0;
  let match;
  while ((match = PROTECTED_SECRET_ASSIGNMENT.exec(source)) !== null) {
    if (!SAFE_PLACEHOLDER_VALUE.test(match[1].trim())) {
      findings.push("hard-coded-secret-assignment");
    }
  }
  return findings;
};

/**
 * Finds credential indicators without retaining or reporting matched values.
 *
 * @param {string} relativePath Repository-relative path.
 * @param {string} source Text file contents.
 * @returns {string[]} Unique rule identifiers.
 */
export const findSecretFindings = (relativePath, source) => {
  const findings = new Set();
  if (SENSITIVE_FILE_NAME.test(path.basename(relativePath)) && !isApprovedTemplateFile(relativePath)) {
    findings.add("sensitive-file-name");
  }
  for (const [rule, expression] of VALUE_RULES) {
    if (expression.test(source)) findings.add(rule);
  }
  for (const rule of findProtectedSecretAssignments(source)) findings.add(rule);
  return [...findings].sort();
};

export const getRepositoryCandidatePaths = async (repositoryRoot = REPOSITORY_ROOT) => {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--deduplicate", "-z"],
    { cwd: repositoryRoot, encoding: "buffer", maxBuffer: 16 * 1024 * 1024 }
  );
  return stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second));
};

/**
 * Scans tracked and non-ignored candidate files. Ignored local secret files are
 * deliberately not read; force-adding one places it in the index and therefore
 * makes this check reject it.
 *
 * @param {string} [repositoryRoot] Repository root to scan.
 * @returns {Promise<Array<{path: string, rule: string}>>} Findings without secret values.
 */
export const scanRepositoryForSecrets = async (repositoryRoot = REPOSITORY_ROOT) => {
  const candidatePaths = await getRepositoryCandidatePaths(repositoryRoot);
  const findings = [];

  for (const relativePath of candidatePaths) {
    const absolutePath = path.resolve(repositoryRoot, relativePath);
    if (!absolutePath.startsWith(`${repositoryRoot}${path.sep}`)) {
      throw new Error(`Refusing to scan a path outside the repository: ${relativePath}`);
    }
    let stats;
    try {
      stats = await lstat(absolutePath);
    } catch (error) {
      if (error && error.code === "ENOENT") continue;
      throw error;
    }
    if (!stats.isFile()) continue;

    const fileNameFindings = findSecretFindings(relativePath, "");
    for (const rule of fileNameFindings) findings.push({ path: relativePath, rule });

    const contents = await readFile(absolutePath);
    if (contents.includes(0)) continue;
    for (const rule of findSecretFindings(relativePath, contents.toString("utf8"))) {
      if (rule !== "sensitive-file-name") findings.push({ path: relativePath, rule });
    }
  }
  return findings;
};

const formatFindings = (findings) =>
  findings.map(({ path: relativePath, rule }) => `- ${relativePath}: ${rule}`).join("\n");

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const findings = await scanRepositoryForSecrets();
  if (findings.length) {
    console.error("Secret guard failed. Remove the credential and rotate it if it was ever shared:");
    console.error(formatFindings(findings));
    process.exitCode = 1;
  } else {
    const candidateCount = (await getRepositoryCandidatePaths()).length;
    console.log(`Secret guard passed: ${candidateCount} repository candidate files scanned.`);
  }
}
