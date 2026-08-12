import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { GAME_COMPLETION_SOURCE_FILES } from "./update-game-integrity.mjs";

export const GAME_STATS_BACKEND_CONFIG_URL = new URL(
  "home/game-stats-backend.js",
  import.meta.url
);
export const LIVE_GAME_STATS_BACKEND_CONFIG_URL = new URL(
  "https://rohin.shanker.me/scripts/home/game-stats-backend.js"
);
export const GAME_STATS_DEPLOYMENT_TIMEOUT_MS = 10_000;
export const GAME_STATS_RELEASE_CONVERGENCE_TIMEOUT_MS = 120_000;
export const GAME_STATS_RELEASE_POLL_INTERVAL_MS = 5_000;

const GAME_BUILD_VERSION_PATTERN = /^sha256-[a-f0-9]{64}$/;
const GENERATED_STRING_PATTERN = '"(?:\\\\.|[^"\\\\])*"';
const LIVE_GAME_STATS_ENTRY_FILES = Object.freeze(["home.html", "index.html"]);
const LIVE_GAME_STATS_CACHE_ASSET_PATHS = Object.freeze([
  "scripts/home/game-stats-backend.js",
  "scripts/home/core/dom.js",
  "scripts/home/main.js",
]);
let liveConfigRequestSequence = 0;

const assertPositiveInteger = (value, label) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer`);
  }
};

const defaultCreateCacheBust = () =>
  `${Date.now()}-${process.pid}-${++liveConfigRequestSequence}`;

const defaultSleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const readGeneratedString = (source, propertyName) => {
  const pattern = new RegExp(
    `\\b${propertyName}\\s*:\\s*(${GENERATED_STRING_PATTERN})`,
    "g"
  );
  const matches = Array.from(source.matchAll(pattern));
  if (matches.length !== 1) {
    throw new Error(
      `Generated game stats backend config must contain exactly one ${propertyName}`
    );
  }

  try {
    return JSON.parse(matches[0][1]);
  } catch (error) {
    throw new Error(`Generated game stats backend config has invalid ${propertyName}`, {
      cause: error,
    });
  }
};

const normalizeApiBaseUrl = (value) => {
  const apiBaseUrl = String(value || "").trim();
  let url;
  try {
    url = new URL(apiBaseUrl);
  } catch (error) {
    throw new Error("Generated game stats backend config has an invalid apiBaseUrl", {
      cause: error,
    });
  }
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Generated game stats backend config apiBaseUrl must use HTTP or HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "Generated game stats backend config apiBaseUrl cannot contain " +
        "credentials, a query, or a fragment"
    );
  }

  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString().replace(/\/$/, "");
};

export const parseGameStatsBackendConfig = (source) => {
  if (typeof source !== "string") {
    throw new TypeError("Generated game stats backend config source must be a string");
  }

  const apiBaseUrl = normalizeApiBaseUrl(readGeneratedString(source, "apiBaseUrl"));
  const buildVersion = String(readGeneratedString(source, "buildVersion")).trim();
  if (!GAME_BUILD_VERSION_PATTERN.test(buildVersion)) {
    throw new Error(
      "Generated game stats backend config buildVersion must be a lowercase SHA-256 value"
    );
  }
  return { apiBaseUrl, buildVersion };
};

export const fetchGameStatsHealth = async (
  apiBaseUrl,
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = GAME_STATS_DEPLOYMENT_TIMEOUT_MS,
    createTimeoutSignal = (milliseconds) => AbortSignal.timeout(milliseconds),
  } = {}
) => {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required for the deployment parity check");
  }
  assertPositiveInteger(timeoutMs, "Deployment parity timeout");
  if (typeof createTimeoutSignal !== "function") {
    throw new TypeError("A timeout signal factory is required for the deployment parity check");
  }

  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const healthUrl = new URL("health", `${normalizedApiBaseUrl}/`).toString();
  let response;
  try {
    response = await fetchImpl(healthUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: createTimeoutSignal(timeoutMs),
    });
  } catch (error) {
    throw new Error(`Unable to fetch game stats Worker health at ${healthUrl}`, {
      cause: error,
    });
  }

  if (!response || typeof response !== "object" || typeof response.json !== "function") {
    throw new Error("Game stats Worker health returned an invalid response");
  }
  if (!response.ok) {
    const status = Number.isInteger(response.status) ? response.status : "unknown";
    throw new Error(`Game stats Worker health failed with status ${status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Game stats Worker health did not return valid JSON", { cause: error });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.ok !== true) {
    throw new Error("Game stats Worker health payload is not healthy");
  }

  const buildVersion = String(payload.buildVersion || "").trim();
  if (!GAME_BUILD_VERSION_PATTERN.test(buildVersion)) {
    throw new Error("Game stats Worker health returned an invalid buildVersion");
  }
  const acceptedBuildVersions = payload.acceptedBuildVersions;
  if (
    !Array.isArray(acceptedBuildVersions) ||
    acceptedBuildVersions.length === 0 ||
    acceptedBuildVersions[0] !== buildVersion ||
    acceptedBuildVersions.some(
      (value) =>
        typeof value !== "string" || !GAME_BUILD_VERSION_PATTERN.test(value)
    ) ||
    new Set(acceptedBuildVersions).size !== acceptedBuildVersions.length
  ) {
    throw new Error(
      "Game stats Worker health returned invalid acceptedBuildVersions"
    );
  }
  return {
    healthUrl,
    buildVersion,
    acceptedBuildVersions: Object.freeze([...acceptedBuildVersions]),
  };
};

export const fetchLiveGameStatsBackendConfig = async ({
  configUrl = LIVE_GAME_STATS_BACKEND_CONFIG_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = GAME_STATS_DEPLOYMENT_TIMEOUT_MS,
  createTimeoutSignal = (milliseconds) => AbortSignal.timeout(milliseconds),
  createCacheBust = defaultCreateCacheBust,
} = {}) => {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required for the live config check");
  }
  assertPositiveInteger(timeoutMs, "Live config timeout");
  if (typeof createTimeoutSignal !== "function") {
    throw new TypeError("A timeout signal factory is required for the live config check");
  }
  if (typeof createCacheBust !== "function") {
    throw new TypeError("A cache-bust factory is required for the live config check");
  }

  let stableUrl;
  try {
    stableUrl = new URL(configUrl);
  } catch (error) {
    throw new Error("Live game stats backend config has an invalid URL", { cause: error });
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
  requestUrl.searchParams.set("game_stats_deployment_check", String(createCacheBust()));
  let response;
  try {
    response = await fetchImpl(requestUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/javascript, text/javascript;q=0.9, */*;q=0.1",
        "Cache-Control": "no-cache, no-store",
        Pragma: "no-cache",
      },
      cache: "no-store",
      signal: createTimeoutSignal(timeoutMs),
    });
  } catch (error) {
    throw new Error(
      `Unable to fetch the live game stats backend config at ${stableUrl}`,
      { cause: error }
    );
  }

  if (!response || typeof response !== "object" || typeof response.text !== "function") {
    throw new Error("Live game stats backend config returned an invalid response");
  }
  if (!response.ok) {
    const status = Number.isInteger(response.status) ? response.status : "unknown";
    throw new Error(`Live game stats backend config failed with status ${status}`);
  }

  let source;
  try {
    source = await response.text();
  } catch (error) {
    throw new Error("Unable to read the live game stats backend config", { cause: error });
  }

  let config;
  try {
    config = parseGameStatsBackendConfig(source);
  } catch (error) {
    throw new Error("Live game stats backend config is invalid", { cause: error });
  }
  return Object.freeze({
    configUrl: stableUrl.toString(),
    requestUrl: requestUrl.toString(),
    ...config,
  });
};

const fetchLiveAsset = async (
  assetUrl,
  {
    fetchImpl,
    timeoutMs,
    createTimeoutSignal,
    createCacheBust,
  }
) => {
  const stableUrl = new URL(assetUrl);
  const requestUrl = new URL(stableUrl);
  requestUrl.searchParams.set("game_stats_deployment_check", String(createCacheBust()));

  let response;
  try {
    response = await fetchImpl(requestUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "*/*",
        "Cache-Control": "no-cache, no-store",
        Pragma: "no-cache",
      },
      cache: "no-store",
      signal: createTimeoutSignal(timeoutMs),
    });
  } catch (error) {
    throw new Error(`Unable to fetch live integrity asset at ${stableUrl}`, {
      cause: error,
    });
  }
  if (
    !response ||
    typeof response !== "object" ||
    typeof response.arrayBuffer !== "function"
  ) {
    throw new Error(`Live integrity asset returned an invalid response at ${stableUrl}`);
  }
  if (!response.ok) {
    const status = Number.isInteger(response.status) ? response.status : "unknown";
    throw new Error(`Live integrity asset failed with status ${status} at ${stableUrl}`);
  }

  let body;
  try {
    body = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw new Error(`Unable to read live integrity asset at ${stableUrl}`, {
      cause: error,
    });
  }
  return body;
};

const calculateLiveGameBuildVersion = (sourceFiles) => {
  const digest = createHash("sha256");
  for (const relativePath of GAME_COMPLETION_SOURCE_FILES) {
    const source = sourceFiles.get(relativePath);
    digest.update(relativePath);
    digest.update("\0");
    digest.update(source);
    digest.update("\0");
  }
  return `sha256-${digest.digest("hex")}`;
};

const fetchLiveIntegritySnapshot = async (
  liveConfig,
  {
    fetchImpl,
    timeoutMs,
    createTimeoutSignal,
    createCacheBust,
  }
) => {
  const siteRootUrl = new URL("/", liveConfig.configUrl);
  const relativePaths = [
    ...GAME_COMPLETION_SOURCE_FILES,
    ...LIVE_GAME_STATS_ENTRY_FILES,
  ];
  const responses = await Promise.all(
    relativePaths.map(async (relativePath) => [
      relativePath,
      await fetchLiveAsset(new URL(relativePath, siteRootUrl), {
        fetchImpl,
        timeoutMs,
        createTimeoutSignal,
        createCacheBust,
      }),
    ])
  );
  const assets = new Map(responses);
  const sourceBuildVersion = calculateLiveGameBuildVersion(assets);
  const mismatches = [];
  if (sourceBuildVersion !== liveConfig.buildVersion) {
    mismatches.push(
      `deployed browser config ${liveConfig.buildVersion}, ` +
        `deployed completion sources ${sourceBuildVersion}`
    );
  }

  const cacheToken = `game-build-${liveConfig.buildVersion.replace(/^sha256-/, "")}`;
  for (const entryPath of LIVE_GAME_STATS_ENTRY_FILES) {
    const entrySource = assets.get(entryPath).toString("utf8");
    for (const assetPath of LIVE_GAME_STATS_CACHE_ASSET_PATHS) {
      const expectedReference = `${assetPath}?v=${cacheToken}`;
      if (!entrySource.includes(expectedReference)) {
        mismatches.push(`${entryPath} is missing cache reference ${expectedReference}`);
      }
    }
  }
  return { sourceBuildVersion, mismatches };
};

export const checkGameStatsDeployment = async ({
  configUrl = GAME_STATS_BACKEND_CONFIG_URL,
  readFileImpl = readFile,
  fetchImpl = globalThis.fetch,
  timeoutMs = GAME_STATS_DEPLOYMENT_TIMEOUT_MS,
  createTimeoutSignal,
} = {}) => {
  if (typeof readFileImpl !== "function") {
    throw new TypeError("A file reader is required for the deployment parity check");
  }

  let source;
  try {
    source = await readFileImpl(configUrl, "utf8");
  } catch (error) {
    throw new Error("Unable to read the generated game stats backend config", {
      cause: error,
    });
  }
  const localConfig = parseGameStatsBackendConfig(source);
  const workerHealth = await fetchGameStatsHealth(localConfig.apiBaseUrl, {
    fetchImpl,
    timeoutMs,
    ...(createTimeoutSignal ? { createTimeoutSignal } : {}),
  });

  if (workerHealth.buildVersion !== localConfig.buildVersion) {
    throw new Error(
      `Game stats deployment hash mismatch: browser ${localConfig.buildVersion}, ` +
        `Worker ${workerHealth.buildVersion}`
    );
  }
  return Object.freeze({
    apiBaseUrl: localConfig.apiBaseUrl,
    healthUrl: workerHealth.healthUrl,
    buildVersion: localConfig.buildVersion,
  });
};

export const checkLiveGameStatsDeployment = async ({
  liveConfigUrl = LIVE_GAME_STATS_BACKEND_CONFIG_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = GAME_STATS_DEPLOYMENT_TIMEOUT_MS,
  createTimeoutSignal,
  createCacheBust,
} = {}) => {
  const fetchOptions = {
    configUrl: liveConfigUrl,
    fetchImpl,
    timeoutMs,
    ...(createTimeoutSignal ? { createTimeoutSignal } : {}),
    ...(createCacheBust ? { createCacheBust } : {}),
  };
  const liveConfig = await fetchLiveGameStatsBackendConfig(fetchOptions);
  const workerHealth = await fetchGameStatsHealth(liveConfig.apiBaseUrl, {
    fetchImpl,
    timeoutMs,
    ...(createTimeoutSignal ? { createTimeoutSignal } : {}),
  });

  if (workerHealth.buildVersion !== liveConfig.buildVersion) {
    throw new Error(
      `Live game stats deployment hash mismatch: browser ${liveConfig.buildVersion}, ` +
        `Worker ${workerHealth.buildVersion}`
    );
  }
  return Object.freeze({
    configUrl: liveConfig.configUrl,
    apiBaseUrl: liveConfig.apiBaseUrl,
    healthUrl: workerHealth.healthUrl,
    buildVersion: liveConfig.buildVersion,
  });
};

const describeReleaseMismatch = (localConfig, liveConfig, workerHealth) => {
  const mismatches = [];
  if (liveConfig.apiBaseUrl !== localConfig.apiBaseUrl) {
    mismatches.push(
      `checked-in API ${localConfig.apiBaseUrl}, deployed browser API ${liveConfig.apiBaseUrl}`
    );
  }
  if (liveConfig.buildVersion !== localConfig.buildVersion) {
    mismatches.push(
      `checked-in browser ${localConfig.buildVersion}, ` +
        `deployed browser ${liveConfig.buildVersion}`
    );
  }
  if (workerHealth && workerHealth.buildVersion !== localConfig.buildVersion) {
    mismatches.push(
      `checked-in browser ${localConfig.buildVersion}, Worker ${workerHealth.buildVersion}`
    );
  }
  return mismatches;
};

const describeWorkerTransitionMismatch = (
  localConfig,
  liveConfig,
  workerHealth
) => {
  const mismatches = [];
  if (liveConfig.apiBaseUrl !== localConfig.apiBaseUrl) {
    mismatches.push(
      `checked-in API ${localConfig.apiBaseUrl}, deployed browser API ${liveConfig.apiBaseUrl}`
    );
  }
  if (!workerHealth || workerHealth.buildVersion !== localConfig.buildVersion) {
    mismatches.push(
      `checked-in browser ${localConfig.buildVersion}, Worker ${
        workerHealth?.buildVersion || "unavailable"
      }`
    );
  }
  if (
    workerHealth &&
    !workerHealth.acceptedBuildVersions.includes(liveConfig.buildVersion)
  ) {
    mismatches.push(
      `deployed browser ${liveConfig.buildVersion} is not accepted by the Worker`
    );
  }
  return mismatches;
};

const checkGameStatsReleaseParity = async ({
  verifyWorkerHealth,
  allowCompatibleLiveBuild = false,
  configUrl = GAME_STATS_BACKEND_CONFIG_URL,
  liveConfigUrl = LIVE_GAME_STATS_BACKEND_CONFIG_URL,
  readFileImpl = readFile,
  fetchImpl = globalThis.fetch,
  timeoutMs = GAME_STATS_DEPLOYMENT_TIMEOUT_MS,
  convergenceTimeoutMs = GAME_STATS_RELEASE_CONVERGENCE_TIMEOUT_MS,
  pollIntervalMs = GAME_STATS_RELEASE_POLL_INTERVAL_MS,
  createTimeoutSignal,
  createCacheBust,
  sleepImpl = defaultSleep,
  nowImpl = Date.now,
} = {}) => {
  if (typeof readFileImpl !== "function") {
    throw new TypeError("A file reader is required for the release parity check");
  }
  if (typeof sleepImpl !== "function") {
    throw new TypeError("A sleep implementation is required for the release parity check");
  }
  if (typeof nowImpl !== "function") {
    throw new TypeError("A clock implementation is required for the release parity check");
  }
  assertPositiveInteger(timeoutMs, "Deployment parity timeout");
  assertPositiveInteger(convergenceTimeoutMs, "Release convergence timeout");
  assertPositiveInteger(pollIntervalMs, "Release poll interval");

  let source;
  try {
    source = await readFileImpl(configUrl, "utf8");
  } catch (error) {
    throw new Error("Unable to read the generated game stats backend config", {
      cause: error,
    });
  }
  const localConfig = parseGameStatsBackendConfig(source);
  const startedAt = Number(nowImpl());
  if (!Number.isFinite(startedAt)) {
    throw new Error("Release parity clock returned an invalid time");
  }
  const deadline = startedAt + convergenceTimeoutMs;
  const maxAttempts = Math.max(1, Math.ceil(convergenceTimeoutMs / pollIntervalMs));
  let attempts = 0;
  let lastObservation = "no deployment response was observed";

  while (attempts < maxAttempts) {
    const currentTime = Number(nowImpl());
    if (!Number.isFinite(currentTime)) {
      throw new Error("Release parity clock returned an invalid time");
    }
    if (attempts > 0 && currentTime >= deadline) {
      break;
    }
    attempts += 1;
    const requestTimeoutMs = Math.max(
      1,
      Math.min(timeoutMs, Math.max(1, deadline - currentTime))
    );

    try {
      const liveConfigPromise = fetchLiveGameStatsBackendConfig({
        configUrl: liveConfigUrl,
        fetchImpl,
        timeoutMs: requestTimeoutMs,
        ...(createTimeoutSignal ? { createTimeoutSignal } : {}),
        ...(createCacheBust ? { createCacheBust } : {}),
      });
      const workerHealthPromise = verifyWorkerHealth
        ? fetchGameStatsHealth(localConfig.apiBaseUrl, {
            fetchImpl,
            timeoutMs: requestTimeoutMs,
            ...(createTimeoutSignal ? { createTimeoutSignal } : {}),
          })
        : Promise.resolve(null);
      const [liveConfig, workerHealth] = await Promise.all([
        liveConfigPromise,
        workerHealthPromise,
      ]);
      const mismatches = allowCompatibleLiveBuild
        ? describeWorkerTransitionMismatch(localConfig, liveConfig, workerHealth)
        : describeReleaseMismatch(localConfig, liveConfig, workerHealth);
      let sourceBuildVersion;
      if (mismatches.length === 0) {
        const integritySnapshot = await fetchLiveIntegritySnapshot(liveConfig, {
          fetchImpl,
          timeoutMs: requestTimeoutMs,
          createTimeoutSignal:
            createTimeoutSignal || ((milliseconds) => AbortSignal.timeout(milliseconds)),
          createCacheBust: createCacheBust || defaultCreateCacheBust,
        });
        sourceBuildVersion = integritySnapshot.sourceBuildVersion;
        mismatches.push(...integritySnapshot.mismatches);
      }
      if (mismatches.length === 0) {
        const result = {
          configUrl: liveConfig.configUrl,
          apiBaseUrl: localConfig.apiBaseUrl,
          buildVersion: localConfig.buildVersion,
          sourceBuildVersion,
          attempts,
        };
        if (workerHealth) {
          result.healthUrl = workerHealth.healthUrl;
        }
        return Object.freeze(result);
      }
      lastObservation = mismatches.join("; ");
    } catch (error) {
      lastObservation = error instanceof Error ? error.message : String(error);
    }

    const afterAttempt = Number(nowImpl());
    if (!Number.isFinite(afterAttempt)) {
      throw new Error("Release parity clock returned an invalid time");
    }
    const remainingMs = deadline - afterAttempt;
    if (attempts >= maxAttempts || remainingMs <= 0) {
      break;
    }
    await sleepImpl(Math.min(pollIntervalMs, remainingMs));
  }

  throw new Error(
    `Game stats release parity did not converge within ${convergenceTimeoutMs}ms ` +
      `after ${attempts} attempt${attempts === 1 ? "" : "s"}: ${lastObservation}`
  );
};

export const checkGameStatsStaticRelease = (options = {}) =>
  checkGameStatsReleaseParity({
    ...options,
    verifyWorkerHealth: false,
  });

export const checkGameStatsRelease = (options = {}) =>
  checkGameStatsReleaseParity({
    ...options,
    verifyWorkerHealth: true,
  });

export const checkGameStatsWorkerTransition = (options = {}) =>
  checkGameStatsReleaseParity({
    ...options,
    verifyWorkerHealth: true,
    allowCompatibleLiveBuild: true,
  });

export const runGameStatsDeploymentCheck = async ({
  checkImpl = checkGameStatsDeployment,
  writeOutput = (message) => console.log(message),
  writeError = (message) => console.error(message),
} = {}) => {
  try {
    const result = await checkImpl();
    writeOutput(`Verified game stats deployment parity: ${result.buildVersion}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(`Game stats deployment parity check failed: ${message}`);
    return 1;
  }
};

export const runLiveGameStatsDeploymentCheck = (options = {}) =>
  runGameStatsDeploymentCheck({
    checkImpl: checkLiveGameStatsDeployment,
    ...options,
  });

export const runGameStatsReleaseCheck = (options = {}) =>
  runGameStatsDeploymentCheck({
    checkImpl: checkGameStatsRelease,
    ...options,
  });

export const runGameStatsStaticReleaseCheck = (options = {}) =>
  runGameStatsDeploymentCheck({
    checkImpl: checkGameStatsStaticRelease,
    ...options,
  });

export const runGameStatsWorkerTransitionCheck = (options = {}) =>
  runGameStatsDeploymentCheck({
    checkImpl: checkGameStatsWorkerTransition,
    ...options,
  });

export const runGameStatsDeploymentCli = async ({
  args = process.argv.slice(2),
  runLocalImpl = runGameStatsDeploymentCheck,
  runLiveImpl = runLiveGameStatsDeploymentCheck,
  runStaticReleaseImpl = runGameStatsStaticReleaseCheck,
  runWorkerTransitionImpl = runGameStatsWorkerTransitionCheck,
  runReleaseImpl = runGameStatsReleaseCheck,
  writeError = (message) => console.error(message),
} = {}) => {
  if (args.length === 0) {
    return runLocalImpl();
  }
  if (args.length === 1 && args[0] === "--live") {
    return runLiveImpl();
  }
  if (args.length === 1 && args[0] === "--static-release") {
    return runStaticReleaseImpl();
  }
  if (args.length === 1 && args[0] === "--worker-transition") {
    return runWorkerTransitionImpl();
  }
  if (args.length === 1 && args[0] === "--release") {
    return runReleaseImpl();
  }
  writeError(
    "Usage: node scripts/check-game-stats-deployment.mjs " +
      "[--live|--static-release|--worker-transition|--release]"
  );
  return 1;
};

/* node:coverage ignore next 3 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await runGameStatsDeploymentCli();
}
