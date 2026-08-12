import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

import {
  GAME_STATS_BACKEND_CONFIG_URL,
  LIVE_GAME_STATS_BACKEND_CONFIG_URL,
  checkGameStatsDeployment,
  checkGameStatsRelease,
  checkGameStatsStaticRelease,
  checkGameStatsWorkerTransition,
  checkLiveGameStatsDeployment,
  fetchGameStatsHealth,
  fetchLiveGameStatsBackendConfig,
  parseGameStatsBackendConfig,
  runGameStatsDeploymentCli,
  runGameStatsDeploymentCheck,
  runGameStatsReleaseCheck,
  runGameStatsStaticReleaseCheck,
  runGameStatsWorkerTransitionCheck,
  runLiveGameStatsDeploymentCheck,
} from "../scripts/check-game-stats-deployment.mjs";

const LOCAL_BUILD_VERSION = `sha256-${"a".repeat(64)}`;
const REMOTE_BUILD_VERSION = `sha256-${"b".repeat(64)}`;
const RELEASE_SOURCE_FILES = new Map([
  ["scripts/home/main.js", Buffer.from("const releaseMain = true;\n")],
  ["scripts/home/core/dom.js", Buffer.from("const releaseDom = true;\n")],
]);
const calculateReleaseBuildVersion = (sourceFiles = RELEASE_SOURCE_FILES) => {
  const digest = createHash("sha256");
  for (const relativePath of [
    "scripts/home/main.js",
    "scripts/home/core/dom.js",
  ]) {
    digest.update(relativePath);
    digest.update("\0");
    digest.update(sourceFiles.get(relativePath));
    digest.update("\0");
  }
  return `sha256-${digest.digest("hex")}`;
};
const RELEASE_BUILD_VERSION = calculateReleaseBuildVersion();
const PREVIOUS_RELEASE_SOURCE_FILES = new Map([
  ["scripts/home/main.js", Buffer.from("const previousReleaseMain = true;\n")],
  ["scripts/home/core/dom.js", Buffer.from("const previousReleaseDom = true;\n")],
]);
const PREVIOUS_RELEASE_BUILD_VERSION = calculateReleaseBuildVersion(
  PREVIOUS_RELEASE_SOURCE_FILES
);

const createConfig = ({
  apiBaseUrl = "https://worker.example.test",
  buildVersion = LOCAL_BUILD_VERSION,
} = {}) => `window.rohinGameStatsBackend = Object.freeze({
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
  buildVersion: ${JSON.stringify(buildVersion)},
});`;

const createHealthResponse = (
  payload = {
    ok: true,
    buildVersion: LOCAL_BUILD_VERSION,
    acceptedBuildVersions: [LOCAL_BUILD_VERSION],
  },
  { ok = true, status = 200 } = {}
) => {
  const normalizedPayload =
    payload &&
    payload.ok === true &&
    typeof payload.buildVersion === "string" &&
    !Object.hasOwn(payload, "acceptedBuildVersions")
      ? { ...payload, acceptedBuildVersions: [payload.buildVersion] }
      : payload;
  return {
    ok,
    status,
    json: async () => normalizedPayload,
  };
};

const createConfigResponse = (
  source = createConfig(),
  { ok = true, status = 200 } = {}
) => ({
  ok,
  status,
  text: async () => source,
});

const createAssetResponse = (source, { ok = true, status = 200 } = {}) => {
  const body = Buffer.isBuffer(source) ? source : Buffer.from(source);
  return {
    ok,
    status,
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  };
};

const createIntegrityEntry = (buildVersion = RELEASE_BUILD_VERSION) => {
  const cacheToken = `game-build-${buildVersion.replace(/^sha256-/, "")}`;
  return [
    "scripts/home/game-stats-backend.js",
    "scripts/home/core/dom.js",
    "scripts/home/main.js",
  ]
    .map((assetPath) => `<script src="${assetPath}?v=${cacheToken}"></script>`)
    .join("\n");
};

const createReleaseDependencyResponse = (
  url,
  {
    sourceFiles = RELEASE_SOURCE_FILES,
    entryBuildVersion = RELEASE_BUILD_VERSION,
    workerBuildVersion = RELEASE_BUILD_VERSION,
    workerAcceptedBuildVersions = [workerBuildVersion],
    homeSource = createIntegrityEntry(entryBuildVersion),
    indexSource = createIntegrityEntry(entryBuildVersion),
  } = {}
) => {
  const pathname = new URL(url).pathname;
  if (sourceFiles.has(pathname.replace(/^\//, ""))) {
    return createAssetResponse(sourceFiles.get(pathname.replace(/^\//, "")));
  }
  if (pathname === "/home.html") return createAssetResponse(homeSource);
  if (pathname === "/index.html") return createAssetResponse(indexSource);
  if (pathname.endsWith("/health")) {
    return createHealthResponse({
      ok: true,
      buildVersion: workerBuildVersion,
      acceptedBuildVersions: workerAcceptedBuildVersions,
    });
  }
  throw new Error(`Unexpected release dependency URL: ${url}`);
};

test("parses and normalizes the generated browser backend config", () => {
  assert.deepEqual(
    parseGameStatsBackendConfig(
      createConfig({ apiBaseUrl: " https://worker.example.test/api/// " })
    ),
    {
      apiBaseUrl: "https://worker.example.test/api",
      buildVersion: LOCAL_BUILD_VERSION,
    }
  );
});

test("rejects missing, duplicate, and non-string generated config fields", () => {
  assert.throws(() => parseGameStatsBackendConfig(null), /source must be a string/);
  assert.throws(
    () =>
      parseGameStatsBackendConfig(
        `window.x = { apiBaseUrl: "\\q", buildVersion: ${JSON.stringify(
          LOCAL_BUILD_VERSION
        )} };`
      ),
    /invalid apiBaseUrl/
  );
  assert.throws(
    () => parseGameStatsBackendConfig('window.x = { buildVersion: "value" };'),
    /exactly one apiBaseUrl/
  );
  assert.throws(
    () =>
      parseGameStatsBackendConfig(
        `${createConfig()}\nwindow.x = { buildVersion: ${JSON.stringify(LOCAL_BUILD_VERSION)} };`
      ),
    /exactly one buildVersion/
  );
});

test("rejects unsafe API URLs and malformed browser build versions", () => {
  for (const apiBaseUrl of [
    "",
    "not-a-url",
    "ftp://worker.example.test",
    "https://user:secret@worker.example.test",
    "https://worker.example.test?version=1",
    "https://worker.example.test#health",
  ]) {
    assert.throws(() => parseGameStatsBackendConfig(createConfig({ apiBaseUrl })));
  }
  for (const buildVersion of [
    "",
    "sha256-short",
    `sha256-${"A".repeat(64)}`,
    "not-a-hash",
  ]) {
    assert.throws(
      () => parseGameStatsBackendConfig(createConfig({ buildVersion })),
      /lowercase SHA-256/
    );
  }
});

test("fetches a no-store Worker health response through injected dependencies", async () => {
  const expectedSignal = { name: "test-timeout-signal" };
  const calls = [];
  const result = await fetchGameStatsHealth("https://worker.example.test/api/", {
    timeoutMs: 321,
    createTimeoutSignal: (milliseconds) => {
      assert.equal(milliseconds, 321);
      return expectedSignal;
    },
    fetchImpl: async (...args) => {
      calls.push(args);
      return createHealthResponse();
    },
  });

  assert.deepEqual(result, {
    healthUrl: "https://worker.example.test/api/health",
    buildVersion: LOCAL_BUILD_VERSION,
    acceptedBuildVersions: [LOCAL_BUILD_VERSION],
  });
  assert.deepEqual(calls, [
    [
      "https://worker.example.test/api/health",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: expectedSignal,
      },
    ],
  ]);
});

test("validates health-check dependencies and timeout bounds", async () => {
  await assert.rejects(
    fetchGameStatsHealth("https://worker.example.test", { fetchImpl: null }),
    /fetch implementation is required/
  );
  await assert.rejects(
    fetchGameStatsHealth("https://worker.example.test", { createTimeoutSignal: null }),
    /timeout signal factory is required/
  );
  for (const timeoutMs of [0, -1, 1.5, Number.NaN]) {
    await assert.rejects(
      fetchGameStatsHealth("https://worker.example.test", { timeoutMs }),
      /timeout must be a positive integer/
    );
  }
});

test("reports network, response, status, JSON, and health payload failures", async () => {
  const networkError = new Error("offline");
  await assert.rejects(
    fetchGameStatsHealth("https://worker.example.test", {
      fetchImpl: async () => {
        throw networkError;
      },
    }),
    (error) => {
      assert.match(error.message, /Unable to fetch game stats Worker health/);
      assert.equal(error.cause, networkError);
      return true;
    }
  );
  for (const response of [null, {}, { ok: true, json: "not-a-function" }]) {
    await assert.rejects(
      fetchGameStatsHealth("https://worker.example.test", {
        fetchImpl: async () => response,
      }),
      /invalid response/
    );
  }
  await assert.rejects(
    fetchGameStatsHealth("https://worker.example.test", {
      fetchImpl: async () => createHealthResponse({}, { ok: false, status: 503 }),
    }),
    /status 503/
  );
  await assert.rejects(
    fetchGameStatsHealth("https://worker.example.test", {
      fetchImpl: async () => ({
        ok: false,
        json: async () => ({}),
      }),
    }),
    /status unknown/
  );
  const jsonError = new Error("invalid JSON");
  await assert.rejects(
    fetchGameStatsHealth("https://worker.example.test", {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw jsonError;
        },
      }),
    }),
    (error) => {
      assert.match(error.message, /did not return valid JSON/);
      assert.equal(error.cause, jsonError);
      return true;
    }
  );
  for (const payload of [null, [], {}, { ok: false, buildVersion: LOCAL_BUILD_VERSION }]) {
    await assert.rejects(
      fetchGameStatsHealth("https://worker.example.test", {
        fetchImpl: async () => createHealthResponse(payload),
      }),
      /payload is not healthy/
    );
  }
  for (const buildVersion of [null, "sha256-short", `sha256-${"C".repeat(64)}`]) {
    await assert.rejects(
      fetchGameStatsHealth("https://worker.example.test", {
        fetchImpl: async () => createHealthResponse({ ok: true, buildVersion }),
      }),
      /invalid buildVersion/
    );
  }
  for (const acceptedBuildVersions of [
    null,
    [],
    [REMOTE_BUILD_VERSION],
    [LOCAL_BUILD_VERSION, "invalid"],
    [LOCAL_BUILD_VERSION, LOCAL_BUILD_VERSION],
  ]) {
    await assert.rejects(
      fetchGameStatsHealth("https://worker.example.test", {
        fetchImpl: async () =>
          createHealthResponse({
            ok: true,
            buildVersion: LOCAL_BUILD_VERSION,
            acceptedBuildVersions,
          }),
      }),
      /invalid acceptedBuildVersions/
    );
  }
});

test("fetches and parses the deployed browser config without using caches", async () => {
  const expectedSignal = { name: "live-config-signal" };
  const calls = [];
  const result = await fetchLiveGameStatsBackendConfig({
    configUrl: "https://site.example.test/game-stats-backend.js",
    timeoutMs: 654,
    createCacheBust: () => "fixed-cache-bust",
    createTimeoutSignal: (milliseconds) => {
      assert.equal(milliseconds, 654);
      return expectedSignal;
    },
    fetchImpl: async (...args) => {
      calls.push(args);
      return createConfigResponse();
    },
  });

  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(result, {
    configUrl: "https://site.example.test/game-stats-backend.js",
    requestUrl:
      "https://site.example.test/game-stats-backend.js?game_stats_deployment_check=fixed-cache-bust",
    apiBaseUrl: "https://worker.example.test",
    buildVersion: LOCAL_BUILD_VERSION,
  });
  assert.deepEqual(calls, [
    [
      result.requestUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/javascript, text/javascript;q=0.9, */*;q=0.1",
          "Cache-Control": "no-cache, no-store",
          Pragma: "no-cache",
        },
        cache: "no-store",
        signal: expectedSignal,
      },
    ],
  ]);
});

test("validates live config dependencies, URL, response, and generated source", async () => {
  await assert.rejects(
    fetchLiveGameStatsBackendConfig({ fetchImpl: null }),
    /fetch implementation is required/
  );
  await assert.rejects(
    fetchLiveGameStatsBackendConfig({ timeoutMs: 0 }),
    /timeout must be a positive integer/
  );
  await assert.rejects(
    fetchLiveGameStatsBackendConfig({ createTimeoutSignal: null }),
    /timeout signal factory is required/
  );
  await assert.rejects(
    fetchLiveGameStatsBackendConfig({ createCacheBust: null }),
    /cache-bust factory is required/
  );
  for (const configUrl of [
    "not-a-url",
    "file:///tmp/config.js",
    "https://user:secret@site.example.test/config.js",
    "https://site.example.test/config.js#stale",
  ]) {
    await assert.rejects(fetchLiveGameStatsBackendConfig({ configUrl }));
  }
  await assert.rejects(
    fetchLiveGameStatsBackendConfig({
      fetchImpl: async () => {
        throw new Error("offline");
      },
    }),
    /Unable to fetch the live game stats backend config/
  );
  for (const response of [null, {}, { ok: true, text: "not-a-function" }]) {
    await assert.rejects(
      fetchLiveGameStatsBackendConfig({ fetchImpl: async () => response }),
      /invalid response/
    );
  }
  await assert.rejects(
    fetchLiveGameStatsBackendConfig({
      fetchImpl: async () => createConfigResponse("", { ok: false, status: 404 }),
    }),
    /status 404/
  );
  await assert.rejects(
    fetchLiveGameStatsBackendConfig({
      fetchImpl: async () => ({ ok: false, text: async () => "" }),
    }),
    /status unknown/
  );
  const readError = new Error("body unavailable");
  await assert.rejects(
    fetchLiveGameStatsBackendConfig({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => {
          throw readError;
        },
      }),
    }),
    (error) => {
      assert.match(error.message, /Unable to read the live/);
      assert.equal(error.cause, readError);
      return true;
    }
  );
  await assert.rejects(
    fetchLiveGameStatsBackendConfig({
      fetchImpl: async () => createConfigResponse("window.invalid = true;"),
    }),
    /config is invalid/
  );
});

test("compares the generated browser hash with Worker health", async () => {
  const readCalls = [];
  const result = await checkGameStatsDeployment({
    configUrl: new URL("file:///test/game-stats-backend.js"),
    readFileImpl: async (...args) => {
      readCalls.push(args);
      return createConfig();
    },
    fetchImpl: async () => createHealthResponse(),
    createTimeoutSignal: () => ({ name: "signal" }),
  });

  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(result, {
    apiBaseUrl: "https://worker.example.test",
    healthUrl: "https://worker.example.test/health",
    buildVersion: LOCAL_BUILD_VERSION,
  });
  assert.deepEqual(readCalls, [
    [new URL("file:///test/game-stats-backend.js"), "utf8"],
  ]);
});

test("rejects missing readers, read failures, and browser/Worker hash mismatches", async () => {
  await assert.rejects(
    checkGameStatsDeployment({ readFileImpl: null }),
    /file reader is required/
  );
  const readError = new Error("unreadable");
  await assert.rejects(
    checkGameStatsDeployment({
      readFileImpl: async () => {
        throw readError;
      },
    }),
    (error) => {
      assert.match(error.message, /Unable to read the generated/);
      assert.equal(error.cause, readError);
      return true;
    }
  );
  await assert.rejects(
    checkGameStatsDeployment({
      readFileImpl: async () => createConfig(),
      fetchImpl: async () =>
        createHealthResponse({ ok: true, buildVersion: REMOTE_BUILD_VERSION }),
    }),
    new RegExp(`browser ${LOCAL_BUILD_VERSION}, Worker ${REMOTE_BUILD_VERSION}`)
  );
});

test("uses the checked-in generated config by default", async () => {
  const source = await readFile(GAME_STATS_BACKEND_CONFIG_URL, "utf8");
  const expected = parseGameStatsBackendConfig(source);
  const result = await checkGameStatsDeployment({
    fetchImpl: async () =>
      createHealthResponse({ ok: true, buildVersion: expected.buildVersion }),
  });

  assert.equal(result.apiBaseUrl, expected.apiBaseUrl);
  assert.equal(result.buildVersion, expected.buildVersion);
});

test("compares the cache-busted deployed browser config with its Worker", async () => {
  const calls = [];
  const result = await checkLiveGameStatsDeployment({
    liveConfigUrl: "https://site.example.test/game-stats-backend.js",
    createCacheBust: () => "live-only",
    createTimeoutSignal: () => ({ name: "signal" }),
    fetchImpl: async (url) => {
      calls.push(url);
      return url.includes("game-stats-backend.js")
        ? createConfigResponse()
        : createHealthResponse();
    },
  });

  assert.deepEqual(result, {
    configUrl: "https://site.example.test/game-stats-backend.js",
    apiBaseUrl: "https://worker.example.test",
    healthUrl: "https://worker.example.test/health",
    buildVersion: LOCAL_BUILD_VERSION,
  });
  assert.deepEqual(calls, [
    "https://site.example.test/game-stats-backend.js?game_stats_deployment_check=live-only",
    "https://worker.example.test/health",
  ]);

  await assert.rejects(
    checkLiveGameStatsDeployment({
      liveConfigUrl: "https://site.example.test/game-stats-backend.js",
      fetchImpl: async (url) =>
        url.includes("game-stats-backend.js")
          ? createConfigResponse()
          : createHealthResponse({ ok: true, buildVersion: REMOTE_BUILD_VERSION }),
    }),
    new RegExp(`browser ${LOCAL_BUILD_VERSION}, Worker ${REMOTE_BUILD_VERSION}`)
  );
});

test("release check polls until checked-in, deployed browser, and Worker config match", async () => {
  let liveFetches = 0;
  const sleeps = [];
  const result = await checkGameStatsRelease({
    configUrl: new URL("file:///test/game-stats-backend.js"),
    liveConfigUrl: "https://site.example.test/game-stats-backend.js",
    readFileImpl: async () => createConfig({ buildVersion: RELEASE_BUILD_VERSION }),
    convergenceTimeoutMs: 10,
    pollIntervalMs: 5,
    nowImpl: () => 0,
    sleepImpl: async (milliseconds) => sleeps.push(milliseconds),
    createCacheBust: () => `attempt-${liveFetches + 1}`,
    createTimeoutSignal: () => ({ name: "signal" }),
    fetchImpl: async (url) => {
      if (url.includes("game-stats-backend.js")) {
        liveFetches += 1;
        return createConfigResponse(
          createConfig({
            buildVersion:
              liveFetches === 1 ? REMOTE_BUILD_VERSION : RELEASE_BUILD_VERSION,
          })
        );
      }
      return createReleaseDependencyResponse(url);
    },
  });

  assert.deepEqual(result, {
    configUrl: "https://site.example.test/game-stats-backend.js",
    apiBaseUrl: "https://worker.example.test",
    healthUrl: "https://worker.example.test/health",
    buildVersion: RELEASE_BUILD_VERSION,
    sourceBuildVersion: RELEASE_BUILD_VERSION,
    attempts: 2,
  });
  assert.equal(liveFetches, 2);
  assert.deepEqual(sleeps, [5]);
});

test("release check rejects stale live config even when local config and Worker match", async () => {
  let liveFetches = 0;
  let healthFetches = 0;
  await assert.rejects(
    checkGameStatsRelease({
      liveConfigUrl: "https://site.example.test/game-stats-backend.js",
      readFileImpl: async () => createConfig(),
      convergenceTimeoutMs: 10,
      pollIntervalMs: 5,
      nowImpl: () => 0,
      sleepImpl: async () => {},
      createCacheBust: () => `stale-${liveFetches + 1}`,
      fetchImpl: async (url) => {
        if (url.includes("game-stats-backend.js")) {
          liveFetches += 1;
          return createConfigResponse(
            createConfig({
              apiBaseUrl: "https://old-worker.example.test",
              buildVersion: REMOTE_BUILD_VERSION,
            })
          );
        }
        healthFetches += 1;
        return createHealthResponse();
      },
    }),
    (error) => {
      assert.match(error.message, /did not converge within 10ms after 2 attempts/);
      assert.match(error.message, /deployed browser API https:\/\/old-worker\.example\.test/);
      assert.match(error.message, new RegExp(`deployed browser ${REMOTE_BUILD_VERSION}`));
      return true;
    }
  );
  assert.equal(liveFetches, 2);
  assert.equal(healthFetches, 2);
});

test("static release gate polls for browser convergence without requesting Worker health", async () => {
  let liveFetches = 0;
  let healthFetches = 0;
  const sleeps = [];
  const result = await checkGameStatsStaticRelease({
    liveConfigUrl: "https://site.example.test/game-stats-backend.js",
    readFileImpl: async () => createConfig({ buildVersion: RELEASE_BUILD_VERSION }),
    convergenceTimeoutMs: 10,
    pollIntervalMs: 5,
    nowImpl: () => 0,
    sleepImpl: async (milliseconds) => sleeps.push(milliseconds),
    fetchImpl: async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname.endsWith("game-stats-backend.js")) {
        liveFetches += 1;
        return createConfigResponse(
          createConfig({
            apiBaseUrl:
              liveFetches === 1
                ? "https://old-worker.example.test"
                : "https://worker.example.test",
            buildVersion:
              liveFetches === 1 ? REMOTE_BUILD_VERSION : RELEASE_BUILD_VERSION,
          })
        );
      }
      if (pathname.endsWith("/health")) {
        healthFetches += 1;
        throw new Error("Static release gate must not request Worker health");
      }
      return createReleaseDependencyResponse(url);
    },
  });

  assert.deepEqual(result, {
    configUrl: "https://site.example.test/game-stats-backend.js",
    apiBaseUrl: "https://worker.example.test",
    buildVersion: RELEASE_BUILD_VERSION,
    sourceBuildVersion: RELEASE_BUILD_VERSION,
    attempts: 2,
  });
  assert.equal(liveFetches, 2);
  assert.equal(healthFetches, 0);
  assert.deepEqual(sleeps, [5]);
});

test("Worker transition accepts the coherent live build before Pages publication", async () => {
  const readCandidate = async () =>
    createConfig({ buildVersion: RELEASE_BUILD_VERSION });
  const transitionOptions = {
    liveConfigUrl: "https://site.example.test/game-stats-backend.js",
    readFileImpl: readCandidate,
    convergenceTimeoutMs: 1,
    pollIntervalMs: 1,
    nowImpl: () => 0,
    sleepImpl: async () => {},
    createCacheBust: () => "transition",
    createTimeoutSignal: () => ({ name: "signal" }),
  };
  const fetchTransition = (acceptedBuildVersions) => async (url) => {
    if (url.includes("game-stats-backend.js")) {
      return createConfigResponse(
        createConfig({ buildVersion: PREVIOUS_RELEASE_BUILD_VERSION })
      );
    }
    return createReleaseDependencyResponse(url, {
      sourceFiles: PREVIOUS_RELEASE_SOURCE_FILES,
      entryBuildVersion: PREVIOUS_RELEASE_BUILD_VERSION,
      workerBuildVersion: RELEASE_BUILD_VERSION,
      workerAcceptedBuildVersions: acceptedBuildVersions,
    });
  };

  assert.deepEqual(
    await checkGameStatsWorkerTransition({
      ...transitionOptions,
      fetchImpl: fetchTransition([
        RELEASE_BUILD_VERSION,
        PREVIOUS_RELEASE_BUILD_VERSION,
      ]),
    }),
    {
      configUrl: "https://site.example.test/game-stats-backend.js",
      apiBaseUrl: "https://worker.example.test",
      healthUrl: "https://worker.example.test/health",
      buildVersion: RELEASE_BUILD_VERSION,
      sourceBuildVersion: PREVIOUS_RELEASE_BUILD_VERSION,
      attempts: 1,
    }
  );

  await assert.rejects(
    checkGameStatsWorkerTransition({
      ...transitionOptions,
      fetchImpl: fetchTransition([RELEASE_BUILD_VERSION]),
    }),
    new RegExp(
      `deployed browser ${PREVIOUS_RELEASE_BUILD_VERSION} is not accepted by the Worker`
    )
  );
});

test("release check rejects a stale live completion source and fetches assets uncached", async () => {
  const staleSources = new Map(RELEASE_SOURCE_FILES);
  staleSources.set("scripts/home/main.js", Buffer.from("const releaseMain = false;\n"));
  const staleSourceBuildVersion = calculateReleaseBuildVersion(staleSources);
  const assetCalls = [];
  let cacheBustSequence = 0;

  await assert.rejects(
    checkGameStatsStaticRelease({
      liveConfigUrl: "https://site.example.test/game-stats-backend.js",
      readFileImpl: async () => createConfig({ buildVersion: RELEASE_BUILD_VERSION }),
      convergenceTimeoutMs: 1,
      pollIntervalMs: 1,
      nowImpl: () => 0,
      createCacheBust: () => `integrity-${++cacheBustSequence}`,
      createTimeoutSignal: () => ({ name: "integrity-signal" }),
      fetchImpl: async (url, options) => {
        const pathname = new URL(url).pathname;
        if (pathname.endsWith("game-stats-backend.js")) {
          return createConfigResponse(
            createConfig({ buildVersion: RELEASE_BUILD_VERSION })
          );
        }
        if (pathname.endsWith("/health")) {
          throw new Error("Static release gate must not request Worker health");
        }
        assetCalls.push([url, options]);
        return createReleaseDependencyResponse(url, { sourceFiles: staleSources });
      },
    }),
    (error) => {
      assert.match(error.message, new RegExp(`browser config ${RELEASE_BUILD_VERSION}`));
      assert.match(
        error.message,
        new RegExp(`completion sources ${staleSourceBuildVersion}`)
      );
      return true;
    }
  );

  assert.equal(assetCalls.length, 4);
  for (const [url, options] of assetCalls) {
    assert.match(url, /game_stats_deployment_check=integrity-/);
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers["Cache-Control"], "no-cache, no-store");
    assert.equal(options.signal.name, "integrity-signal");
  }
});

test("release check rejects stale cache-token references in either live HTML entry", async () => {
  const staleEntry = createIntegrityEntry(REMOTE_BUILD_VERSION);
  for (const entryPath of ["home.html", "index.html"]) {
    await assert.rejects(
      checkGameStatsStaticRelease({
        liveConfigUrl: "https://site.example.test/game-stats-backend.js",
        readFileImpl: async () => createConfig({ buildVersion: RELEASE_BUILD_VERSION }),
        convergenceTimeoutMs: 1,
        pollIntervalMs: 1,
        nowImpl: () => 0,
        fetchImpl: async (url) => {
          const pathname = new URL(url).pathname;
          if (pathname.endsWith("game-stats-backend.js")) {
            return createConfigResponse(
              createConfig({ buildVersion: RELEASE_BUILD_VERSION })
            );
          }
          return createReleaseDependencyResponse(url, {
            ...(entryPath === "home.html" ? { homeSource: staleEntry } : {}),
            ...(entryPath === "index.html" ? { indexSource: staleEntry } : {}),
          });
        },
      }),
      (error) => {
        const cacheToken = RELEASE_BUILD_VERSION.replace(/^sha256-/, "game-build-");
        assert.match(
          error.message,
          new RegExp(
            `${entryPath.replace(".", "\\.")} is missing cache reference ` +
              `scripts/home/main\\.js\\?v=${cacheToken}`
          )
        );
        return true;
      }
    );
  }
});

test("release check reports every live integrity asset failure shape", async () => {
  const readError = new Error("asset body unavailable");
  const cases = [
    {
      response: async () => {
        throw new Error("asset offline");
      },
      expected: /Unable to fetch live integrity asset/,
    },
    { response: async () => null, expected: /invalid response/ },
    { response: async () => "invalid", expected: /invalid response/ },
    { response: async () => ({}), expected: /invalid response/ },
    {
      response: async () => createAssetResponse("", { ok: false, status: 503 }),
      expected: /status 503/,
    },
    {
      response: async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }),
      expected: /status unknown/,
    },
    {
      response: async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => {
          throw readError;
        },
      }),
      expected: /Unable to read live integrity asset/,
    },
  ];

  for (const { response, expected } of cases) {
    await assert.rejects(
      checkGameStatsRelease({
        liveConfigUrl: "https://site.example.test/game-stats-backend.js",
        readFileImpl: async () => createConfig({ buildVersion: RELEASE_BUILD_VERSION }),
        convergenceTimeoutMs: 1,
        pollIntervalMs: 1,
        nowImpl: () => 0,
        fetchImpl: async (url) => {
          const pathname = new URL(url).pathname;
          if (pathname.endsWith("game-stats-backend.js")) {
            return createConfigResponse(
              createConfig({ buildVersion: RELEASE_BUILD_VERSION })
            );
          }
          if (pathname.endsWith("/health")) {
            return createReleaseDependencyResponse(url);
          }
          if (pathname.endsWith("/scripts/home/main.js")) {
            return response();
          }
          return createReleaseDependencyResponse(url);
        },
      }),
      expected
    );
  }
});

test("release check validates polling dependencies and remains time bounded", async () => {
  const baseOptions = { readFileImpl: async () => createConfig() };
  await assert.rejects(
    checkGameStatsRelease({ ...baseOptions, readFileImpl: null }),
    /file reader is required/
  );
  await assert.rejects(
    checkGameStatsRelease({ ...baseOptions, sleepImpl: null }),
    /sleep implementation is required/
  );
  await assert.rejects(
    checkGameStatsRelease({ ...baseOptions, nowImpl: null }),
    /clock implementation is required/
  );
  for (const options of [
    { timeoutMs: 0 },
    { convergenceTimeoutMs: 0 },
    { pollIntervalMs: 0 },
  ]) {
    await assert.rejects(checkGameStatsRelease({ ...baseOptions, ...options }), /positive integer/);
  }
  await assert.rejects(
    checkGameStatsRelease({ ...baseOptions, nowImpl: () => Number.NaN }),
    /clock returned an invalid time/
  );

  let time = 0;
  let fetches = 0;
  await assert.rejects(
    checkGameStatsRelease({
      ...baseOptions,
      convergenceTimeoutMs: 10,
      pollIntervalMs: 5,
      nowImpl: () => time,
      sleepImpl: async (milliseconds) => {
        time += milliseconds;
      },
      fetchImpl: async (url) => {
        fetches += 1;
        return url.includes("game-stats-backend.js")
          ? createConfigResponse(createConfig({ buildVersion: REMOTE_BUILD_VERSION }))
          : createHealthResponse();
      },
    }),
    /did not converge within 10ms after 2 attempts/
  );
  assert.equal(time, 5);
  assert.equal(fetches, 4);
});

test("release check reports local reads, Worker skew, transient failures, and invalid clocks", async () => {
  const readError = new Error("local config unavailable");
  await assert.rejects(
    checkGameStatsRelease({
      readFileImpl: async () => {
        throw readError;
      },
    }),
    (error) => {
      assert.match(error.message, /Unable to read the generated/);
      assert.equal(error.cause, readError);
      return true;
    }
  );

  await assert.rejects(
    checkGameStatsRelease({
      readFileImpl: async () => createConfig(),
      convergenceTimeoutMs: 1,
      pollIntervalMs: 1,
      nowImpl: () => 0,
      fetchImpl: async (url) =>
        url.includes("game-stats-backend.js")
          ? createConfigResponse()
          : createHealthResponse({ ok: true, buildVersion: REMOTE_BUILD_VERSION }),
    }),
    new RegExp(`Worker ${REMOTE_BUILD_VERSION}`)
  );

  await assert.rejects(
    checkGameStatsRelease({
      readFileImpl: async () => createConfig(),
      convergenceTimeoutMs: 1,
      pollIntervalMs: 1,
      nowImpl: () => 0,
      createCacheBust: () => {
        throw "cache-bust failure";
      },
      fetchImpl: async () => createHealthResponse(),
    }),
    /cache-bust failure/
  );

  let clockReads = 0;
  await assert.rejects(
    checkGameStatsRelease({
      readFileImpl: async () => createConfig(),
      convergenceTimeoutMs: 10,
      pollIntervalMs: 5,
      nowImpl: () => (++clockReads === 2 ? Number.NaN : 0),
    }),
    /clock returned an invalid time/
  );

  clockReads = 0;
  await assert.rejects(
    checkGameStatsRelease({
      readFileImpl: async () => createConfig(),
      convergenceTimeoutMs: 10,
      pollIntervalMs: 5,
      nowImpl: () => (++clockReads === 3 ? Number.NaN : 0),
      fetchImpl: async (url) =>
        url.includes("game-stats-backend.js")
          ? createConfigResponse(createConfig({ buildVersion: REMOTE_BUILD_VERSION }))
          : createHealthResponse(),
    }),
    /clock returned an invalid time/
  );
});

test("release check stops at its deadline and default sleeper permits convergence", async (context) => {
  const clockValues = [0, 0, 0, 10];
  await assert.rejects(
    checkGameStatsRelease({
      readFileImpl: async () => createConfig(),
      convergenceTimeoutMs: 10,
      pollIntervalMs: 5,
      nowImpl: () => clockValues.shift() ?? 10,
      sleepImpl: async () => {},
      fetchImpl: async (url) =>
        url.includes("game-stats-backend.js")
          ? createConfigResponse(createConfig({ buildVersion: REMOTE_BUILD_VERSION }))
          : createHealthResponse(),
    }),
    /after 1 attempt:/
  );

  const expiringClockValues = [0, 0, 10];
  await assert.rejects(
    checkGameStatsRelease({
      readFileImpl: async () => createConfig(),
      convergenceTimeoutMs: 10,
      pollIntervalMs: 5,
      nowImpl: () => expiringClockValues.shift() ?? 10,
      sleepImpl: async () => {},
      fetchImpl: async (url) =>
        url.includes("game-stats-backend.js")
          ? createConfigResponse(createConfig({ buildVersion: REMOTE_BUILD_VERSION }))
          : createHealthResponse(),
    }),
    /after 1 attempt:/
  );

  const scheduledSleeps = [];
  context.mock.method(globalThis, "setTimeout", (callback, milliseconds) => {
    scheduledSleeps.push(milliseconds);
    callback();
    return { name: "mock-timeout" };
  });
  let liveFetches = 0;
  const result = await checkGameStatsRelease({
    readFileImpl: async () => createConfig({ buildVersion: RELEASE_BUILD_VERSION }),
    convergenceTimeoutMs: 10,
    pollIntervalMs: 1,
    nowImpl: () => 0,
    fetchImpl: async (url) => {
      if (url.includes("game-stats-backend.js")) {
        liveFetches += 1;
        return createConfigResponse(
          createConfig({
            buildVersion:
              liveFetches === 1 ? REMOTE_BUILD_VERSION : RELEASE_BUILD_VERSION,
          })
        );
      }
      return createReleaseDependencyResponse(url);
    },
  });
  assert.equal(result.attempts, 2);
  assert.deepEqual(scheduledSleeps, [1]);
});

test("CLI runner reports success and every failure shape without exiting directly", async () => {
  const output = [];
  const errors = [];
  assert.equal(
    await runGameStatsDeploymentCheck({
      checkImpl: async () => ({ buildVersion: LOCAL_BUILD_VERSION }),
      writeOutput: (message) => output.push(message),
      writeError: (message) => errors.push(message),
    }),
    0
  );
  assert.deepEqual(output, [`Verified game stats deployment parity: ${LOCAL_BUILD_VERSION}`]);
  assert.deepEqual(errors, []);

  assert.equal(
    await runGameStatsDeploymentCheck({
      checkImpl: async () => {
        throw new Error("mismatch");
      },
      writeOutput: (message) => output.push(message),
      writeError: (message) => errors.push(message),
    }),
    1
  );
  assert.equal(
    await runGameStatsDeploymentCheck({
      checkImpl: async () => {
        throw "non-error failure";
      },
      writeOutput: (message) => output.push(message),
      writeError: (message) => errors.push(message),
    }),
    1
  );
  assert.deepEqual(errors, [
    "Game stats deployment parity check failed: mismatch",
    "Game stats deployment parity check failed: non-error failure",
  ]);
});

test("CLI runner writes through its default console reporters", async (context) => {
  const output = [];
  const errors = [];
  context.mock.method(console, "log", (message) => output.push(message));
  context.mock.method(console, "error", (message) => errors.push(message));

  assert.equal(
    await runGameStatsDeploymentCheck({
      checkImpl: async () => ({ buildVersion: LOCAL_BUILD_VERSION }),
    }),
    0
  );
  assert.equal(
    await runGameStatsDeploymentCheck({
      checkImpl: async () => {
        throw new Error("console failure");
      },
    }),
    1
  );
  assert.deepEqual(output, [`Verified game stats deployment parity: ${LOCAL_BUILD_VERSION}`]);
  assert.deepEqual(errors, [
    "Game stats deployment parity check failed: console failure",
  ]);
});

test("CLI dispatches every deployment and release parity check", async () => {
  const calls = [];
  const runners = {
    runLocalImpl: async () => {
      calls.push("local");
      return 10;
    },
    runLiveImpl: async () => {
      calls.push("live");
      return 20;
    },
    runStaticReleaseImpl: async () => {
      calls.push("static-release");
      return 30;
    },
    runWorkerTransitionImpl: async () => {
      calls.push("worker-transition");
      return 35;
    },
    runReleaseImpl: async () => {
      calls.push("release");
      return 40;
    },
  };
  assert.equal(await runGameStatsDeploymentCli({ args: [], ...runners }), 10);
  assert.equal(await runGameStatsDeploymentCli({ args: ["--live"], ...runners }), 20);
  assert.equal(
    await runGameStatsDeploymentCli({ args: ["--static-release"], ...runners }),
    30
  );
  assert.equal(
    await runGameStatsDeploymentCli({ args: ["--worker-transition"], ...runners }),
    35
  );
  assert.equal(await runGameStatsDeploymentCli({ args: ["--release"], ...runners }), 40);

  const errors = [];
  assert.equal(
    await runGameStatsDeploymentCli({
      args: ["--unknown"],
      ...runners,
      writeError: (message) => errors.push(message),
    }),
    1
  );
  assert.deepEqual(calls, [
    "local",
    "live",
    "static-release",
    "worker-transition",
    "release",
  ]);
  assert.deepEqual(errors, [
    "Usage: node scripts/check-game-stats-deployment.mjs " +
      "[--live|--static-release|--worker-transition|--release]",
  ]);
  assert.equal(LIVE_GAME_STATS_BACKEND_CONFIG_URL.protocol, "https:");
});

test("CLI usage failures write through the default console reporter", async (context) => {
  const errors = [];
  context.mock.method(console, "error", (message) => errors.push(message));
  assert.equal(await runGameStatsDeploymentCli({ args: ["--invalid"] }), 1);
  assert.deepEqual(errors, [
    "Usage: node scripts/check-game-stats-deployment.mjs " +
      "[--live|--static-release|--worker-transition|--release]",
  ]);
});

test("specialized CLI runners retain injectable check behavior", async () => {
  const output = [];
  assert.equal(
    await runLiveGameStatsDeploymentCheck({
      checkImpl: async () => ({ buildVersion: LOCAL_BUILD_VERSION }),
      writeOutput: (message) => output.push(message),
    }),
    0
  );
  assert.equal(
    await runGameStatsStaticReleaseCheck({
      checkImpl: async () => ({ buildVersion: RELEASE_BUILD_VERSION }),
      writeOutput: (message) => output.push(message),
    }),
    0
  );
  assert.equal(
    await runGameStatsWorkerTransitionCheck({
      checkImpl: async () => ({ buildVersion: LOCAL_BUILD_VERSION }),
      writeOutput: (message) => output.push(message),
    }),
    0
  );
  assert.equal(
    await runGameStatsReleaseCheck({
      checkImpl: async () => ({ buildVersion: REMOTE_BUILD_VERSION }),
      writeOutput: (message) => output.push(message),
    }),
    0
  );
  assert.deepEqual(output, [
    `Verified game stats deployment parity: ${LOCAL_BUILD_VERSION}`,
    `Verified game stats deployment parity: ${RELEASE_BUILD_VERSION}`,
    `Verified game stats deployment parity: ${LOCAL_BUILD_VERSION}`,
    `Verified game stats deployment parity: ${REMOTE_BUILD_VERSION}`,
  ]);
});

test("npm scripts, release workflow, and validation guide expose the parity guard", async () => {
  const root = new URL("../", import.meta.url);
  const [packageJson, workerPackageJson, workflow, validationGuide] = await Promise.all([
    readFile(new URL("package.json", root), "utf8").then(JSON.parse),
    readFile(new URL("workers/game-stats/package.json", root), "utf8").then(JSON.parse),
    readFile(new URL(".github/workflows/game-stats-worker-release.yml", root), "utf8"),
    readFile(new URL("docs/validation/game-stats-backend.md", root), "utf8"),
  ]);

  assert.equal(
    packageJson.scripts["game-stats:deployment:check"],
    "node scripts/check-game-stats-deployment.mjs --live"
  );
  assert.equal(
    packageJson.scripts["game-stats:static-release:check"],
    "node scripts/check-game-stats-deployment.mjs --static-release"
  );
  assert.equal(
    packageJson.scripts["game-stats:worker-transition:check"],
    "node scripts/check-game-stats-deployment.mjs --worker-transition"
  );
  assert.equal(
    packageJson.scripts["game-stats:release:check"],
    "node scripts/check-game-stats-deployment.mjs --release"
  );
  assert.equal(
    packageJson.scripts["game-stats:integrity:check"],
    "node scripts/update-game-integrity.mjs --check"
  );
  assert.equal(
    workerPackageJson.scripts["deployment:check"],
    "node ../../scripts/check-game-stats-deployment.mjs --live"
  );
  assert.equal(
    workerPackageJson.scripts["static-release:check"],
    "node ../../scripts/check-game-stats-deployment.mjs --static-release"
  );
  assert.equal(
    workerPackageJson.scripts["worker-transition:check"],
    "node ../../scripts/check-game-stats-deployment.mjs --worker-transition"
  );
  assert.equal(
    workerPackageJson.scripts["release:check"],
    "node ../../scripts/check-game-stats-deployment.mjs --release"
  );
  assert.equal(
    workerPackageJson.scripts["deploy:check"],
    "wrangler deploy --dry-run --config wrangler.jsonc --strict"
  );
  const workflowDefinition = parse(workflow);
  assert.deepEqual(Object.keys(workflowDefinition.on).sort(), [
    "pull_request",
    "push",
    "workflow_dispatch",
  ]);
  assert.deepEqual(workflowDefinition.on.push.branches, ["main"]);
  assert.equal(workflowDefinition.on.pull_request, null);
  assert.equal(workflowDefinition.on.workflow_dispatch, null);
  assert.deepEqual(workflowDefinition.permissions, { contents: "read" });
  assert.deepEqual(workflowDefinition.concurrency, {
    group: "game-stats-worker-release-${{ github.ref }}",
    "cancel-in-progress": true,
  });
  assert.deepEqual(Object.keys(workflowDefinition.jobs).sort(), [
    "deploy-pages",
    "deploy-worker",
    "package-pages",
    "verify",
  ]);

  const {
    verify,
    "deploy-worker": deployWorker,
    "package-pages": packagePages,
    "deploy-pages": deployPages,
  } = workflowDefinition.jobs;
  const verifySource = JSON.stringify(verify);
  assert.doesNotMatch(verifySource, /secrets\.|CLOUDFLARE_/);
  assert.doesNotMatch(verifySource, /pull_request_target/);
  assert.match(verifySource, /npm test/);
  assert.match(verifySource, /npm run game-stats:integrity:check/);
  assert.match(verifySource, /npm --prefix workers\/game-stats run deploy:check/);
  assert.doesNotMatch(verifySource, /run deploy --/);

  assert.equal(deployWorker.needs, "verify");
  assert.match(deployWorker.if, /github\.ref == 'refs\/heads\/main'/);
  assert.match(deployWorker.if, /github\.event_name == 'push'/);
  assert.match(deployWorker.if, /github\.event_name == 'workflow_dispatch'/);
  assert.doesNotMatch(deployWorker.if, /pull_request/);
  assert.equal(deployWorker.env, undefined);
  assert.equal(packagePages.needs, "deploy-worker");
  assert.equal(deployPages.needs, "package-pages");
  assert.deepEqual(packagePages.permissions, {
    contents: "read",
    pages: "write",
  });
  assert.deepEqual(deployPages.permissions, {
    contents: "read",
    pages: "write",
    "id-token": "write",
  });
  assert.deepEqual(deployPages.environment, {
    name: "github-pages",
    url: "${{ steps.deployment.outputs.page_url }}",
  });

  for (const job of [verify, deployWorker, packagePages, deployPages]) {
    const checkoutStep = job.steps.find((step) =>
      step.uses?.startsWith("actions/checkout@")
    );
    const setupNodeStep = job.steps.find((step) =>
      step.uses?.startsWith("actions/setup-node@")
    );
    assert.equal(
      checkoutStep.uses,
      "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd"
    );
    assert.equal(checkoutStep.with["persist-credentials"], false);
    assert.equal(
      setupNodeStep.uses,
      "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e"
    );
  }

  const workerStepByName = Object.fromEntries(
    deployWorker.steps.map((step) => [step.name, step])
  );
  assert.deepEqual(workerStepByName["Require production credentials"].env, {
    CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
    CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
  });
  assert.equal(
    workerStepByName["Require production credentials"].run,
    "node scripts/check-game-stats-release-context.mjs --credentials"
  );
  assert.deepEqual(
    workerStepByName["Reject a superseded workflow revision"].env,
    {
    GITHUB_TOKEN: "${{ github.token }}",
    }
  );
  assert.equal(
    workerStepByName["Reject a superseded workflow revision"].run,
    "node scripts/check-game-stats-release-context.mjs --current-main"
  );
  assert.deepEqual(
    workerStepByName["Deploy rollout-compatible Worker configuration"].env,
    {
      CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
      CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    }
  );
  assert.equal(
    workerStepByName["Deploy rollout-compatible Worker configuration"].run,
    "npm --prefix workers/game-stats run deploy -- --config wrangler.jsonc --strict"
  );
  assert.equal(
    workerStepByName[
      "Verify live browser remains accepted by the candidate Worker"
    ].run,
    "npm run game-stats:worker-transition:check"
  );
  assert.doesNotMatch(workflow, /cloudflare\/wrangler-action|pull_request_target/);

  const workerStepNames = deployWorker.steps.map((step) => step.name);
  assert.ok(
    workerStepNames.indexOf("Require production credentials") <
      workerStepNames.indexOf("Reject a superseded workflow revision")
  );
  assert.ok(
    workerStepNames.indexOf("Reject a superseded workflow revision") <
      workerStepNames.indexOf("Deploy rollout-compatible Worker configuration")
  );
  assert.ok(
    workerStepNames.indexOf("Deploy rollout-compatible Worker configuration") <
      workerStepNames.indexOf(
        "Verify live browser remains accepted by the candidate Worker"
      )
  );

  const pagesPackageStepByName = Object.fromEntries(
    packagePages.steps.map((step) => [step.name, step])
  );
  assert.equal(
    pagesPackageStepByName["Configure GitHub Pages"].uses,
    "actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b"
  );
  assert.match(
    pagesPackageStepByName["Assemble public site artifact"].run,
    /cp -R assets styles video-editor/
  );
  assert.match(
    pagesPackageStepByName["Assemble public site artifact"].run,
    /cp -R scripts\/home/
  );
  assert.match(
    pagesPackageStepByName["Assemble public site artifact"].run,
    /cp CNAME home\.html index\.html robots\.txt sitemap\.xml style\.css/
  );
  assert.equal(
    pagesPackageStepByName["Upload GitHub Pages artifact"].uses,
    "actions/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b"
  );

  const pagesDeployStepByName = Object.fromEntries(
    deployPages.steps.map((step) => [step.name, step])
  );
  assert.equal(
    pagesDeployStepByName["Deploy verified GitHub Pages artifact"].uses,
    "actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e"
  );
  assert.equal(
    pagesDeployStepByName[
      "Verify checked-in/deployed browser/Worker release parity"
    ].run,
    "npm run game-stats:release:check"
  );
  assert.doesNotMatch(workflow, /Wait for checked-in browser release/);
  assert.match(validationGuide, /npm run game-stats:deployment:check/);
  assert.match(validationGuide, /npm run game-stats:static-release:check/);
  assert.match(validationGuide, /npm run game-stats:worker-transition:check/);
  assert.match(validationGuide, /npm run game-stats:release:check/);
  assert.match(validationGuide, /unique cache-busting query/);
  assert.match(validationGuide, /relative path \+ NUL \+ bytes \+ NUL/);
  assert.match(validationGuide, /HTML cache reference fails/);
  assert.match(validationGuide, /GitHub Actions.*publishing source/s);
  assert.match(validationGuide, /rolling compatibility window/);
  assert.match(validationGuide, /CLOUDFLARE_API_TOKEN/);
  assert.match(validationGuide, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(validationGuide, /current `main` revision/);
  assert.match(validationGuide, /Wrangler's `--strict`/);
});
