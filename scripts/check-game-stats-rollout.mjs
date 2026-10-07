import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  GAME_STATS_DEPLOYMENT_TIMEOUT_MS,
  parseGameStatsBackendConfig,
  resolveLiveGameStatsBackendConfigUrl,
} from "./check-game-stats-deployment.mjs";
import { assertFetchDependencies, fetchGuardedBody } from "./lib/http.mjs";
import { parseJsonc } from "./lib/jsonc.mjs";

/**
 * The deploy-time gate for the first verified-result rollout.
 *
 * The Worker fails new legacy (`resultProtocol` 1) issuance closed whenever
 * `LEGACY_RESULT_ISSUANCE_CUTOFF` is unset. That is the right steady state, but
 * the deploy that first publishes verified clients also leaves browsers holding
 * a cached pre-verification copy, and those browsers can only ask for a legacy
 * session. This check refuses that one deploy until the operator has declared a
 * future UTC deadline for the compatibility window.
 *
 * The window only governs *new* legacy issuance. Proofs already issued keep
 * their original six-hour expiry under the Worker's existing rules; nothing
 * here renews them.
 */

export const WRANGLER_CONFIG_URL = new URL(
  "../workers/game-stats/wrangler.jsonc",
  import.meta.url
);
export const LOCAL_BACKEND_CONFIG_URL = new URL(
  "home/game-stats-backend.js",
  import.meta.url
);
export const LEGACY_CUTOFF_VAR_NAME = "LEGACY_RESULT_ISSUANCE_CUTOFF";

/** A published client that omits the generated field predates verified results. */
export const CACHED_CLIENT_RESULT_PROTOCOL = 1;
export const SUPPORTED_RESULT_PROTOCOLS = Object.freeze([1, 2]);

export const EXAMPLE_LEGACY_CUTOFF = "2026-11-01T00:00:00Z";

/**
 * An explicit UTC instant, so a deadline a deployer writes by hand cannot be
 * read as a local time. The Worker compares the same value against `Date.now()`.
 */
const UTC_DEADLINE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;

/**
 * `Date.parse` rolls an out-of-range field forward, so `2026-02-31T00:00:00Z`
 * silently becomes March 3rd. A deadline has to mean the instant it names, and
 * the round trip back from the parsed value is what proves it does.
 */
const parseUtcDeadline = (deadline) => {
  const match = UTC_DEADLINE_PATTERN.exec(deadline);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, millisecond = ""] = match;
  const deadlineMs = Date.parse(deadline);
  const canonical =
    `${year}-${month}-${day}T${hour}:${minute}:${second}.` +
    `${millisecond.padEnd(3, "0")}Z`;
  if (!Number.isFinite(deadlineMs) || new Date(deadlineMs).toISOString() !== canonical) {
    return null;
  }
  return deadlineMs;
};

/**
 * The generated member as it is written, not as it evaluates: this source is
 * fetched from the public site, so it is read with a field pattern rather than
 * executed.
 */
const RESULT_PROTOCOL_FIELD_PATTERN = /\bresultProtocol\s*:\s*([^,}\r\n]*)/g;

let rolloutRequestSequence = 0;

const defaultCreateCacheBust = () =>
  `${Date.now()}-${process.pid}-${++rolloutRequestSequence}`;

/**
 * Returns the declared protocol, or `undefined` when the field is absent.
 * Callers decide what absence means: for a fetched copy it means the client
 * predates the field, and for this repository's own generated file it means the
 * build metadata is stale.
 */
export const readGeneratedResultProtocol = (source) => {
  if (typeof source !== "string") {
    throw new TypeError(
      "Generated game stats backend config source must be a string"
    );
  }
  const matches = [...source.matchAll(RESULT_PROTOCOL_FIELD_PATTERN)];
  if (matches.length > 1) {
    throw new Error(
      "Generated game stats backend config must declare resultProtocol at most once"
    );
  }
  if (matches.length === 0) return undefined;

  const declared = matches[0][1].trim();
  if (!/^\d+$/.test(declared)) {
    throw new Error(
      "Generated game stats backend config resultProtocol must be a plain integer"
    );
  }
  const resultProtocol = Number(declared);
  if (!SUPPORTED_RESULT_PROTOCOLS.includes(resultProtocol)) {
    throw new Error(
      `Generated game stats backend config declares unsupported resultProtocol ${resultProtocol}`
    );
  }
  return resultProtocol;
};

/**
 * Reads the declared compatibility deadline out of `wrangler.jsonc`.
 *
 * The variable must be declared even when it is empty: the Worker treats an
 * absent value as closed, and an undeclared knob gives a deployer nothing to
 * set. An empty value is the closed default; a non-empty value must be a real
 * UTC instant.
 */
export const readLegacyIssuanceCutoff = async ({
  configUrl = WRANGLER_CONFIG_URL,
  readFileImpl = readFile,
} = {}) => {
  if (typeof readFileImpl !== "function") {
    throw new TypeError("A file reader is required for the rollout preflight");
  }

  let config;
  try {
    config = parseJsonc(await readFileImpl(configUrl, "utf8"));
  } catch (error) {
    throw new Error("Unable to read the Worker's Wrangler configuration", {
      cause: error,
    });
  }

  const vars = config?.vars;
  if (
    !vars ||
    typeof vars !== "object" ||
    Array.isArray(vars) ||
    !Object.hasOwn(vars, LEGACY_CUTOFF_VAR_NAME)
  ) {
    throw new Error(
      `Wrangler configuration must declare vars.${LEGACY_CUTOFF_VAR_NAME}, ` +
        `empty for the closed default or a UTC deadline in the form ${EXAMPLE_LEGACY_CUTOFF}`
    );
  }
  const declared = vars[LEGACY_CUTOFF_VAR_NAME];
  if (typeof declared !== "string") {
    throw new Error(
      `Wrangler configuration ${LEGACY_CUTOFF_VAR_NAME} must be a string`
    );
  }

  const deadline = declared.trim();
  if (deadline === "") {
    return Object.freeze({ deadline: null, deadlineMs: null });
  }
  const deadlineMs = parseUtcDeadline(deadline);
  if (deadlineMs === null) {
    throw new Error(
      `Wrangler configuration ${LEGACY_CUTOFF_VAR_NAME} must be empty or a real UTC ` +
        `calendar instant in the form ${EXAMPLE_LEGACY_CUTOFF}`
    );
  }
  return Object.freeze({ deadline, deadlineMs });
};

/** `open` means the Worker still issues new legacy sessions at `now`. */
export const resolveLegacyIssuancePhase = (cutoff, now) => {
  if (!Number.isFinite(now)) {
    throw new TypeError("The rollout preflight clock returned an invalid time");
  }
  if (cutoff.deadlineMs === null) {
    return Object.freeze({ phase: "closed", deadline: null, reason: "unset" });
  }
  return cutoff.deadlineMs > now
    ? Object.freeze({ phase: "open", deadline: cutoff.deadline, reason: "window" })
    : Object.freeze({ phase: "closed", deadline: cutoff.deadline, reason: "elapsed" });
};

export const describeLegacyIssuance = ({ phase, deadline, reason }) => {
  if (phase === "open") return `open until ${deadline}`;
  return reason === "unset"
    ? "closed (no deadline declared)"
    : `closed (deadline ${deadline} already elapsed)`;
};

/**
 * Reads the protocol the published client actually speaks. This is the only
 * outbound request the preflight makes, it asks for one public asset, and it
 * must not be answered from cache: the whole question is what browsers are
 * loading right now.
 */
export const fetchLiveGameStatsClientProtocol = async ({
  configUrl = resolveLiveGameStatsBackendConfigUrl(),
  fetchImpl = globalThis.fetch,
  timeoutMs = GAME_STATS_DEPLOYMENT_TIMEOUT_MS,
  createTimeoutSignal = (milliseconds) => AbortSignal.timeout(milliseconds),
  createCacheBust = defaultCreateCacheBust,
} = {}) => {
  assertFetchDependencies({
    fetchImpl,
    timeoutMs,
    createTimeoutSignal,
    purpose: "for the rollout preflight",
    timeoutLabel: "Rollout preflight timeout",
  });
  if (typeof createCacheBust !== "function") {
    throw new TypeError(
      "A cache-bust factory is required for the rollout preflight"
    );
  }

  let stableUrl;
  try {
    stableUrl = new URL(configUrl);
  } catch (error) {
    throw new Error("Live game stats backend config has an invalid URL", {
      cause: error,
    });
  }
  if (!/^https?:$/.test(stableUrl.protocol)) {
    throw new Error("Live game stats backend config URL must use HTTP or HTTPS");
  }
  if (stableUrl.username || stableUrl.password || stableUrl.hash) {
    throw new Error(
      "Live game stats backend config URL cannot contain credentials or a fragment"
    );
  }

  const requestUrl = new URL(stableUrl);
  requestUrl.searchParams.set("game_stats_rollout_check", String(createCacheBust()));
  const source = await fetchGuardedBody(requestUrl.toString(), {
    fetchImpl,
    timeoutMs,
    createTimeoutSignal,
    readAs: "text",
    init: {
      method: "GET",
      headers: {
        Accept: "application/javascript, text/javascript;q=0.9, */*;q=0.1",
        "Cache-Control": "no-cache, no-store",
        Pragma: "no-cache",
      },
      cache: "no-store",
    },
    messages: {
      requestFailed: `Unable to fetch the live game stats backend config at ${stableUrl}`,
      invalidResponse: "Live game stats backend config returned an invalid response",
      statusFailed: (status) =>
        `Live game stats backend config failed with status ${status}`,
      bodyUnreadable: "Unable to read the live game stats backend config",
    },
  });

  let resultProtocol;
  try {
    parseGameStatsBackendConfig(source);
    resultProtocol = readGeneratedResultProtocol(source);
  } catch (error) {
    throw new Error("Live game stats backend config is invalid", { cause: error });
  }
  return Object.freeze({
    configUrl: stableUrl.toString(),
    requestUrl: requestUrl.toString(),
    resultProtocol: resultProtocol ?? CACHED_CLIENT_RESULT_PROTOCOL,
  });
};

export const checkGameStatsRollout = async ({
  backendConfigUrl = LOCAL_BACKEND_CONFIG_URL,
  wranglerConfigUrl = WRANGLER_CONFIG_URL,
  readFileImpl = readFile,
  liveConfigUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = GAME_STATS_DEPLOYMENT_TIMEOUT_MS,
  createTimeoutSignal,
  createCacheBust,
  nowImpl = () => Date.now(),
  fetchLiveProtocolImpl = fetchLiveGameStatsClientProtocol,
} = {}) => {
  if (typeof readFileImpl !== "function") {
    throw new TypeError("A file reader is required for the rollout preflight");
  }
  if (typeof nowImpl !== "function") {
    throw new TypeError("A clock is required for the rollout preflight");
  }

  let source;
  try {
    source = await readFileImpl(backendConfigUrl, "utf8");
  } catch (error) {
    throw new Error("Unable to read the generated game stats backend config", {
      cause: error,
    });
  }
  parseGameStatsBackendConfig(source);
  const localResultProtocol = readGeneratedResultProtocol(source);
  if (localResultProtocol === undefined) {
    throw new Error(
      "Generated game stats backend config does not declare resultProtocol. " +
        "Run: node scripts/update-game-integrity.mjs"
    );
  }

  const legacyIssuance = resolveLegacyIssuancePhase(
    await readLegacyIssuanceCutoff({ configUrl: wranglerConfigUrl, readFileImpl }),
    Number(nowImpl())
  );
  const live = await fetchLiveProtocolImpl({
    ...(liveConfigUrl ? { configUrl: liveConfigUrl } : {}),
    fetchImpl,
    timeoutMs,
    ...(createTimeoutSignal ? { createTimeoutSignal } : {}),
    ...(createCacheBust ? { createCacheBust } : {}),
  });

  if (
    live.resultProtocol === CACHED_CLIENT_RESULT_PROTOCOL &&
    localResultProtocol > CACHED_CLIENT_RESULT_PROTOCOL &&
    legacyIssuance.phase !== "open"
  ) {
    throw new Error(
      `Browsers still hold the resultProtocol ${live.resultProtocol} client while this ` +
        `build publishes ${localResultProtocol}, so new legacy issuance must stay open ` +
        `for the compatibility window. New legacy issuance is ` +
        `${describeLegacyIssuance(legacyIssuance)}. Set vars.${LEGACY_CUTOFF_VAR_NAME} ` +
        `in workers/game-stats/wrangler.jsonc to a future UTC deadline, in the form ` +
        `${EXAMPLE_LEGACY_CUTOFF}, then deploy again.`
    );
  }
  return Object.freeze({
    localResultProtocol,
    liveResultProtocol: live.resultProtocol,
    legacyIssuance,
  });
};

export const runGameStatsRolloutCheck = async ({
  checkImpl = checkGameStatsRollout,
  writeOutput = (message) => console.log(message),
  writeError = (message) => console.error(message),
} = {}) => {
  try {
    const result = await checkImpl();
    writeOutput(
      `Verified game stats rollout preflight: published client resultProtocol ` +
        `${result.liveResultProtocol}, this build ${result.localResultProtocol}, ` +
        `new legacy issuance ${describeLegacyIssuance(result.legacyIssuance)}.`
    );
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(`::error::Game stats rollout preflight failed: ${message}`);
    return 1;
  }
};

/**
 * `npm` runs a `pre<script>` hook without the caller's extra arguments, so the
 * predeploy hook always reaches this with none. Anything else is a mistake.
 */
export const runGameStatsRolloutCli = async ({
  args = process.argv.slice(2),
  runCheckImpl = runGameStatsRolloutCheck,
  writeError = (message) => console.error(message),
} = {}) => {
  if (args.length > 0) {
    writeError("Usage: node scripts/check-game-stats-rollout.mjs");
    return 1;
  }
  return runCheckImpl();
};

const scriptPath = fileURLToPath(import.meta.url);

/* node:coverage ignore next 3 */
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = await runGameStatsRolloutCli();
}
