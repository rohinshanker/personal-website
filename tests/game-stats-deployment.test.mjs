import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GAME_STATS_BACKEND_CONFIG_URL,
  LIVE_GAME_STATS_BACKEND_CONFIG_URL,
  checkGameStatsDeployment,
  checkGameStatsRelease,
  checkGameStatsStaticRelease,
  checkLiveGameStatsDeployment,
  fetchGameStatsHealth,
  fetchLiveGameStatsBackendConfig,
  parseGameStatsBackendConfig,
  runGameStatsDeploymentCli,
  runGameStatsDeploymentCheck,
  runGameStatsReleaseCheck,
  runGameStatsStaticReleaseCheck,
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

const createConfig = ({
  apiBaseUrl = "https://worker.example.test",
  buildVersion = LOCAL_BUILD_VERSION,
} = {}) => `window.rohinGameStatsBackend = Object.freeze({
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
  buildVersion: ${JSON.stringify(buildVersion)},
});`;

const createHealthResponse = (
  payload = { ok: true, buildVersion: LOCAL_BUILD_VERSION },
  { ok = true, status = 200 } = {}
) => ({
  ok,
  status,
  json: async () => payload,
});

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
    return createHealthResponse({ ok: true, buildVersion: workerBuildVersion });
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

test("CLI dispatches local, live-only, static-release, and full-release parity checks", async () => {
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
  assert.deepEqual(calls, ["local", "live", "static-release", "release"]);
  assert.deepEqual(errors, [
    "Usage: node scripts/check-game-stats-deployment.mjs " +
      "[--live|--static-release|--release]",
  ]);
  assert.equal(LIVE_GAME_STATS_BACKEND_CONFIG_URL.protocol, "https:");
});

test("CLI usage failures write through the default console reporter", async (context) => {
  const errors = [];
  context.mock.method(console, "error", (message) => errors.push(message));
  assert.equal(await runGameStatsDeploymentCli({ args: ["--invalid"] }), 1);
  assert.deepEqual(errors, [
    "Usage: node scripts/check-game-stats-deployment.mjs " +
      "[--live|--static-release|--release]",
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
    await runGameStatsReleaseCheck({
      checkImpl: async () => ({ buildVersion: REMOTE_BUILD_VERSION }),
      writeOutput: (message) => output.push(message),
    }),
    0
  );
  assert.deepEqual(output, [
    `Verified game stats deployment parity: ${LOCAL_BUILD_VERSION}`,
    `Verified game stats deployment parity: ${RELEASE_BUILD_VERSION}`,
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
    workerPackageJson.scripts["release:check"],
    "node ../../scripts/check-game-stats-deployment.mjs --release"
  );
  assert.equal(
    workerPackageJson.scripts["deploy:check"],
    "wrangler deploy --dry-run --config wrangler.jsonc"
  );
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run game-stats:integrity:check/);
  assert.match(workflow, /npm --prefix workers\/game-stats run deploy:check/);
  assert.match(
    workflow,
    /npm --prefix workers\/game-stats run deploy -- --config wrangler\.jsonc/
  );
  assert.doesNotMatch(workflow, /cloudflare\/wrangler-action/);
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /Missing CLOUDFLARE_API_TOKEN repository secret/);
  assert.match(workflow, /Missing CLOUDFLARE_ACCOUNT_ID repository secret/);
  assert.match(workflow, /exit "\$missing"/);
  assert.match(workflow, /npm run game-stats:static-release:check/);
  assert.match(workflow, /npm run game-stats:release:check/);
  assert.match(workflow, /group: game-stats-worker-release-\$\{\{ github\.ref \}\}/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.ok(
    workflow.indexOf("npm --prefix workers/game-stats run deploy:check") <
      workflow.indexOf("Deploy current Worker configuration")
  );
  assert.ok(
    workflow.indexOf("Require production credentials") <
      workflow.indexOf("npm run game-stats:static-release:check")
  );
  assert.ok(
    workflow.indexOf("npm run game-stats:static-release:check") <
      workflow.indexOf("Deploy current Worker configuration")
  );
  assert.ok(
    workflow.indexOf("Deploy current Worker configuration") <
      workflow.indexOf("npm run game-stats:release:check")
  );
  assert.match(validationGuide, /npm run game-stats:deployment:check/);
  assert.match(validationGuide, /npm run game-stats:static-release:check/);
  assert.match(validationGuide, /npm run game-stats:release:check/);
  assert.match(validationGuide, /unique cache-busting query/);
  assert.match(validationGuide, /relative path \+ NUL \+ bytes \+ NUL/);
  assert.match(validationGuide, /HTML cache reference fails/);
  assert.match(validationGuide, /intentionally ignoring\s+Worker `\/health`/);
  assert.match(validationGuide, /CLOUDFLARE_API_TOKEN/);
  assert.match(validationGuide, /CLOUDFLARE_ACCOUNT_ID/);
});
