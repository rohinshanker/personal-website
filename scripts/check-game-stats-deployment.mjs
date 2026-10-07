import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  GAME_BUILD_VERSION_PATTERN,
  GAME_COMPLETION_SOURCE_FILES,
  INTEGRITY_CACHE_ASSET_PATHS,
  INTEGRITY_ENTRY_FILES,
  createIntegrityCacheToken,
  digestGameCompletionSources,
} from "./lib/game-build.mjs";
import {
  assertFetchDependencies,
  assertPositiveInteger,
  fetchGuardedBody,
} from "./lib/http.mjs";

export const GAME_STATS_BACKEND_CONFIG_URL = new URL(
  "home/game-stats-backend.js",
  import.meta.url
);
/** The published site. */
export const DEFAULT_LIVE_GAME_STATS_BACKEND_CONFIG_URL =
  "https://rohin.shanker.me/scripts/home/game-stats-backend.js";

/** `GAME_STATS_LIVE_CONFIG_URL` retargets every live and release check at
 * another origin without editing this script. */
export const resolveLiveGameStatsBackendConfigUrl = (environment = process.env) =>
  new URL(
    environment.GAME_STATS_LIVE_CONFIG_URL?.trim() ||
      DEFAULT_LIVE_GAME_STATS_BACKEND_CONFIG_URL
  );

export const LIVE_GAME_STATS_BACKEND_CONFIG_URL =
  resolveLiveGameStatsBackendConfigUrl();
export const GAME_STATS_DEPLOYMENT_TIMEOUT_MS = 10_000;
export const GAME_STATS_RELEASE_CONVERGENCE_TIMEOUT_MS = 120_000;
export const GAME_STATS_RELEASE_POLL_INTERVAL_MS = 5_000;

const GENERATED_STRING_PATTERN = '"(?:\\\\.|[^"\\\\])*"';
let liveConfigRequestSequence = 0;

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
  assertFetchDependencies({
    fetchImpl,
    timeoutMs,
    createTimeoutSignal,
    purpose: "for the deployment parity check",
    timeoutLabel: "Deployment parity timeout",
  });

  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const healthUrl = new URL("health", `${normalizedApiBaseUrl}/`).toString();
  const payload = await fetchGuardedBody(healthUrl, {
    fetchImpl,
    timeoutMs,
    createTimeoutSignal,
    readAs: "json",
    init: {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
    messages: {
      requestFailed: `Unable to fetch game stats Worker health at ${healthUrl}`,
      invalidResponse: "Game stats Worker health returned an invalid response",
      statusFailed: (status) =>
        `Game stats Worker health failed with status ${status}`,
      bodyUnreadable: "Game stats Worker health did not return valid JSON",
    },
  });
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
  assertFetchDependencies({
    fetchImpl,
    timeoutMs,
    createTimeoutSignal,
    purpose: "for the live config check",
    timeoutLabel: "Live config timeout",
  });
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
      invalidResponse:
        "Live game stats backend config returned an invalid response",
      statusFailed: (status) =>
        `Live game stats backend config failed with status ${status}`,
      bodyUnreadable: "Unable to read the live game stats backend config",
    },
  });

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

  return Buffer.from(
    await fetchGuardedBody(requestUrl.toString(), {
      fetchImpl,
      timeoutMs,
      createTimeoutSignal,
      readAs: "arrayBuffer",
      init: {
        method: "GET",
        headers: {
          Accept: "*/*",
          "Cache-Control": "no-cache, no-store",
          Pragma: "no-cache",
        },
        cache: "no-store",
      },
      messages: {
        requestFailed: `Unable to fetch live integrity asset at ${stableUrl}`,
        invalidResponse: `Live integrity asset returned an invalid response at ${stableUrl}`,
        statusFailed: (status) =>
          `Live integrity asset failed with status ${status} at ${stableUrl}`,
        bodyUnreadable: `Unable to read live integrity asset at ${stableUrl}`,
      },
    })
  );
};

/**
 * The completion-source manifests earlier releases published and hashed,
 * newest first. A live site still advertising one of them is accepted only
 * during a transition to a different browser build, and only when its fetched
 * bytes reproduce the advertised build hash and its entry pages carry that
 * manifest's full cache references. Without those proofs a live config naming
 * an unreproducible hash is indistinguishable from a stale deploy.
 *
 * Each entry records verbatim the exact ordered list that release digested. It
 * is deliberately not derived from `GAME_COMPLETION_SOURCE_FILES`, because that
 * list keeps evolving and a published historical contract must not move with
 * it. Final release parity still requires today's full manifest.
 */
const HISTORICAL_COMPLETION_SOURCE_MANIFESTS = Object.freeze([
  // The modular Home scripts before `core/resources.js` and
  // `scripts/home/games/*` were extracted.
  Object.freeze([
    "scripts/home/core/activation.js",
    "scripts/home/core/activity.js",
    "scripts/home/core/administrator-session.js",
    "scripts/home/core/dom.js",
    "scripts/home/core/media.js",
    "scripts/home/core/pointer-cursor.js",
    "scripts/home/core/static-noise.js",
    "scripts/home/core/util.js",
    "scripts/home/core/windows.js",
    "scripts/home/features/game-stats.js",
    "scripts/home/features/minesweeper.js",
    "scripts/home/features/snake.js",
    "scripts/home/features/solitaire.js",
    "scripts/home/features/sudoku.js",
    "scripts/home/sudoku-generator.worker.js",
  ]),
  // The monolith, the shared DOM table and the Sudoku worker.
  Object.freeze([
    "scripts/home/main.js",
    "scripts/home/core/dom.js",
    "scripts/home/sudoku-generator.worker.js",
  ]),
  // The monolith and the shared DOM table.
  Object.freeze(["scripts/home/main.js", "scripts/home/core/dom.js"]),
]);

const fetchLiveIntegritySnapshot = async (
  liveConfig,
  {
    fetchImpl,
    timeoutMs,
    createTimeoutSignal,
    createCacheBust,
    allowLegacyManifest = false,
  }
) => {
  const siteRootUrl = new URL("/", liveConfig.configUrl);
  const assets = new Map();
  const loadAssets = async (paths) => {
    await Promise.all(paths.filter((path) => !assets.has(path)).map(async (path) => {
      assets.set(path, await fetchLiveAsset(new URL(path, siteRootUrl), {
        fetchImpl,
        timeoutMs,
        createTimeoutSignal,
        createCacheBust,
      }));
    }));
  };
  let sourceBuildVersion;
  let cacheAssetPaths = INTEGRITY_CACHE_ASSET_PATHS;
  let matchedHistoricalManifest = false;
  if (allowLegacyManifest) {
    for (const sourceFiles of HISTORICAL_COMPLETION_SOURCE_MANIFESTS) {
      try {
        await loadAssets([...sourceFiles, ...INTEGRITY_ENTRY_FILES]);
        sourceBuildVersion = await digestGameCompletionSources(
          (path) => assets.get(path), sourceFiles
        );
      } catch {
        // A source the live site no longer serves rules this manifest out.
        continue;
      }
      if (sourceBuildVersion === liveConfig.buildVersion) {
        cacheAssetPaths = ["scripts/home/game-stats-backend.js", ...sourceFiles];
        matchedHistoricalManifest = true;
        break;
      }
    }
  }
  if (!matchedHistoricalManifest) {
    await loadAssets([...GAME_COMPLETION_SOURCE_FILES, ...INTEGRITY_ENTRY_FILES]);
    sourceBuildVersion = await digestGameCompletionSources((path) => assets.get(path));
  }
  const mismatches = [];
  if (sourceBuildVersion !== liveConfig.buildVersion) {
    mismatches.push(
      `deployed browser config ${liveConfig.buildVersion}, ` +
        `deployed completion sources ${sourceBuildVersion}`
    );
  }

  const cacheToken = createIntegrityCacheToken(liveConfig.buildVersion);
  for (const entryPath of INTEGRITY_ENTRY_FILES) {
    const entrySource = assets.get(entryPath).toString("utf8");
    for (const assetPath of cacheAssetPaths) {
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

/** The Worker-transition gate always verifies Worker health, so `workerHealth`
 * is present here; only `describeReleaseMismatch` sees a skipped health check. */
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
  if (workerHealth.buildVersion !== localConfig.buildVersion) {
    mismatches.push(
      `checked-in browser ${localConfig.buildVersion}, Worker ${workerHealth.buildVersion}`
    );
  }
  if (!workerHealth.acceptedBuildVersions.includes(liveConfig.buildVersion)) {
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
          allowLegacyManifest: allowCompatibleLiveBuild && liveConfig.buildVersion !== localConfig.buildVersion,
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
