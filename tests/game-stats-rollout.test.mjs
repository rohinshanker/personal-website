import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  CACHED_CLIENT_RESULT_PROTOCOL,
  EXAMPLE_LEGACY_CUTOFF,
  LEGACY_CUTOFF_VAR_NAME,
  LOCAL_BACKEND_CONFIG_URL,
  WRANGLER_CONFIG_URL,
  checkGameStatsRollout,
  describeLegacyIssuance,
  fetchLiveGameStatsClientProtocol,
  parseGeneratedBackendMembers,
  readGeneratedResultProtocol,
  readLegacyIssuanceCutoff,
  resolveLegacyIssuancePhase,
  runGameStatsRolloutCheck,
  runGameStatsRolloutCli,
} from "../scripts/check-game-stats-rollout.mjs";
import {
  createFrontendConfig,
  readCommonResultProtocol,
} from "../scripts/update-game-integrity.mjs";
import { parseJsonc } from "../scripts/lib/jsonc.mjs";

const REPOSITORY_ROOT = new URL("../", import.meta.url);
const ROLLOUT_SCRIPT = new URL("../scripts/check-game-stats-rollout.mjs", import.meta.url);
const BUILD_VERSION = `sha256-${"a".repeat(64)}`;
const NOW = Date.parse("2026-10-07T00:00:00Z");
const FUTURE = "2026-11-01T00:00:00Z";
const PAST = "2026-09-01T00:00:00Z";
const LIVE_CONFIG_URL = "https://site.example.test/scripts/home/game-stats-backend.js";

/** `resultProtocol` is interpolated raw so a test can declare a malformed one. */
const createGeneratedConfig = ({
  apiBaseUrl = "https://worker.example.test",
  buildVersion = BUILD_VERSION,
  resultProtocol = "2",
  extra = "",
} = {}) =>
  `window.rohinGameStatsBackend = Object.freeze({\n` +
  `  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},\n` +
  `  buildVersion: ${JSON.stringify(buildVersion)},\n` +
  (resultProtocol === null ? "" : `  resultProtocol: ${resultProtocol},\n`) +
  extra +
  `});\n`;

/** `declared` is raw JSONC text; `undefined` omits the member entirely. */
const createWranglerConfig = (declared, { vars } = {}) =>
  `{\n` +
  `  // A comment and a trailing comma, as Wrangler allows.\n` +
  `  "name": "personal-site-game-stats",\n` +
  `  "vars": ${
    vars ??
    `{\n    "ALLOWED_ORIGIN": "https://site.example.test",\n${
      declared === undefined
        ? ""
        : `    "${LEGACY_CUTOFF_VAR_NAME}": ${declared},\n`
    }  }`
  },\n` +
  `}\n`;

const withCutoff = (value) => createWranglerConfig(JSON.stringify(value));

const createReader = (files) => async (url, encoding) => {
  assert.equal(encoding, "utf8");
  const key = String(url);
  if (!(key in files)) throw Object.assign(new Error(`ENOENT ${key}`), { code: "ENOENT" });
  const value = files[key];
  if (value instanceof Error) throw value;
  return value;
};

const createTimeoutSignal = (milliseconds) => ({ timeoutMs: milliseconds });

const createFetchStub = (body, { ok = true, status = 200, read } = {}) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (body instanceof Error) throw body;
    if (body === null) return { ok, status };
    return { ok, status, text: read ?? (async () => body) };
  };
  return { fetchImpl, calls };
};

const liveOptions = (fetchStub, overrides = {}) => ({
  configUrl: LIVE_CONFIG_URL,
  fetchImpl: fetchStub.fetchImpl,
  timeoutMs: 5_000,
  createTimeoutSignal,
  createCacheBust: () => "fixed-cache-bust",
  ...overrides,
});

const rolloutOptions = ({
  local = createGeneratedConfig(),
  wrangler = withCutoff(""),
  fetchStub = createFetchStub(createGeneratedConfig()),
  now = NOW,
  ...overrides
} = {}) => ({
  backendConfigUrl: "file:///repo/game-stats-backend.js",
  wranglerConfigUrl: "file:///repo/wrangler.jsonc",
  readFileImpl: createReader({
    "file:///repo/game-stats-backend.js": local,
    "file:///repo/wrangler.jsonc": wrangler,
  }),
  liveConfigUrl: LIVE_CONFIG_URL,
  fetchImpl: fetchStub.fetchImpl,
  timeoutMs: 5_000,
  createTimeoutSignal,
  createCacheBust: () => "fixed-cache-bust",
  nowImpl: () => now,
  ...overrides,
});

test("the generated result protocol is read as a written field, never evaluated", () => {
  assert.equal(readGeneratedResultProtocol(createGeneratedConfig()), 2);
  assert.equal(
    readGeneratedResultProtocol(createGeneratedConfig({ resultProtocol: " 1 " })),
    1
  );
  assert.equal(
    readGeneratedResultProtocol(createGeneratedConfig({ resultProtocol: null })),
    undefined,
    "a client published before the field existed simply omits it"
  );

  assert.throws(
    () => readGeneratedResultProtocol(createGeneratedConfig({ extra: "  resultProtocol: 1,\n" })),
    /declares resultProtocol more than once/
  );
  assert.throws(
    () => readGeneratedResultProtocol(createGeneratedConfig({ resultProtocol: '"2"' })),
    /resultProtocol must be a plain integer/,
    "a string member is well-formed but is not a protocol"
  );
  for (const malformed of ["2.5", "two", "+2", "", "0x2"]) {
    assert.throws(
      () => readGeneratedResultProtocol(createGeneratedConfig({ resultProtocol: malformed })),
      /not a plain string or integer field/,
      `${malformed || "(empty)"} must be rejected rather than guessed`
    );
  }
  for (const unsupported of ["0", "3", "99"]) {
    assert.throws(
      () => readGeneratedResultProtocol(createGeneratedConfig({ resultProtocol: unsupported })),
      /unsupported resultProtocol/
    );
  }
  for (const invalid of [undefined, null, 2, Buffer.from("resultProtocol: 2")]) {
    assert.throws(() => readGeneratedResultProtocol(invalid), TypeError);
  }
});

test("the legacy cutoff must be declared, and empty is the closed default", async () => {
  assert.deepEqual(
    await readLegacyIssuanceCutoff({
      configUrl: "file:///repo/wrangler.jsonc",
      readFileImpl: createReader({ "file:///repo/wrangler.jsonc": withCutoff("") }),
    }),
    { deadline: null, deadlineMs: null }
  );
  assert.deepEqual(
    await readLegacyIssuanceCutoff({
      configUrl: "file:///repo/wrangler.jsonc",
      readFileImpl: createReader({ "file:///repo/wrangler.jsonc": withCutoff("   ") }),
    }),
    { deadline: null, deadlineMs: null },
    "the Worker also fails closed on a blank value"
  );
  assert.deepEqual(
    await readLegacyIssuanceCutoff({
      configUrl: "file:///repo/wrangler.jsonc",
      readFileImpl: createReader({ "file:///repo/wrangler.jsonc": withCutoff(FUTURE) }),
    }),
    { deadline: FUTURE, deadlineMs: Date.parse(FUTURE) }
  );
  assert.deepEqual(
    await readLegacyIssuanceCutoff({
      configUrl: "file:///repo/wrangler.jsonc",
      readFileImpl: createReader({
        "file:///repo/wrangler.jsonc": withCutoff("2026-11-01T00:00:00.250Z"),
      }),
    }),
    {
      deadline: "2026-11-01T00:00:00.250Z",
      deadlineMs: Date.parse("2026-11-01T00:00:00.250Z"),
    }
  );
});

test("a cutoff that is missing, mistyped, or not a UTC instant stops the deploy", async () => {
  const read = (source) => ({
    configUrl: "file:///repo/wrangler.jsonc",
    readFileImpl: createReader({ "file:///repo/wrangler.jsonc": source }),
  });

  for (const source of [
    createWranglerConfig(undefined),
    createWranglerConfig(undefined, { vars: "null" }),
    createWranglerConfig(undefined, { vars: "[]" }),
    createWranglerConfig(undefined, { vars: '"inline"' }),
    `{ "name": "personal-site-game-stats" }`,
  ]) {
    await assert.rejects(
      readLegacyIssuanceCutoff(read(source)),
      new RegExp(`must declare vars\\.${LEGACY_CUTOFF_VAR_NAME}`)
    );
  }
  for (const raw of ["null", "0", "false", '["2026-11-01T00:00:00Z"]']) {
    await assert.rejects(
      readLegacyIssuanceCutoff(read(createWranglerConfig(raw))),
      /must be a string/
    );
  }
  for (const malformed of [
    "2026-11-01T00:00:00",
    "2026-11-01T00:00:00+00:00",
    "2026-11-01",
    "2026-11-01T00:00Z",
    "2026-11-01T00:00:00.1234Z",
    "Nov 1 2026 UTC",
    "tomorrow",
    // Date.parse rolls these forward instead of rejecting them.
    "2026-02-31T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-11-01T24:00:00Z",
    "2026-11-01T23:59:60Z",
  ]) {
    await assert.rejects(
      readLegacyIssuanceCutoff(read(withCutoff(malformed))),
      new RegExp(
        `${LEGACY_CUTOFF_VAR_NAME} must be empty or a real UTC calendar instant`
      ),
      `${malformed} does not name one unambiguous UTC instant`
    );
  }
  assert.equal(
    (
      await readLegacyIssuanceCutoff(read(withCutoff("2026-02-28T23:59:59.999Z")))
    ).deadlineMs,
    Date.parse("2026-02-28T23:59:59.999Z"),
    "a real end-of-month instant still parses"
  );
  await assert.rejects(
    readLegacyIssuanceCutoff(read("{ not json")),
    /Unable to read the Worker's Wrangler configuration/
  );
  await assert.rejects(
    readLegacyIssuanceCutoff({ configUrl: "file:///missing.jsonc", readFileImpl: createReader({}) }),
    /Unable to read the Worker's Wrangler configuration/
  );
  await assert.rejects(
    readLegacyIssuanceCutoff({ readFileImpl: "not a function" }),
    TypeError
  );
});

test("the issuance phase follows the injected clock, and an unusable clock is rejected", () => {
  const deadlineMs = Date.parse(FUTURE);
  assert.deepEqual(resolveLegacyIssuancePhase({ deadline: null, deadlineMs: null }, NOW), {
    phase: "closed",
    deadline: null,
    reason: "unset",
  });
  assert.deepEqual(resolveLegacyIssuancePhase({ deadline: FUTURE, deadlineMs }, NOW), {
    phase: "open",
    deadline: FUTURE,
    reason: "window",
  });
  assert.deepEqual(
    resolveLegacyIssuancePhase({ deadline: FUTURE, deadlineMs }, deadlineMs - 1),
    { phase: "open", deadline: FUTURE, reason: "window" }
  );
  assert.deepEqual(
    resolveLegacyIssuancePhase({ deadline: FUTURE, deadlineMs }, deadlineMs),
    { phase: "closed", deadline: FUTURE, reason: "elapsed" },
    "the Worker closes issuance once now has reached the deadline"
  );
  assert.deepEqual(
    resolveLegacyIssuancePhase({ deadline: PAST, deadlineMs: Date.parse(PAST) }, NOW),
    { phase: "closed", deadline: PAST, reason: "elapsed" }
  );
  for (const invalid of [Number.NaN, Infinity, undefined, null, "now"]) {
    assert.throws(() => resolveLegacyIssuancePhase({ deadline: null, deadlineMs: null }, invalid), TypeError);
  }
});

test("each issuance phase is described for an operator", () => {
  assert.equal(
    describeLegacyIssuance({ phase: "open", deadline: FUTURE, reason: "window" }),
    `open until ${FUTURE}`
  );
  assert.equal(
    describeLegacyIssuance({ phase: "closed", deadline: null, reason: "unset" }),
    "closed (no deadline declared)"
  );
  assert.equal(
    describeLegacyIssuance({ phase: "closed", deadline: PAST, reason: "elapsed" }),
    `closed (deadline ${PAST} already elapsed)`
  );
});

test("the live client protocol is fetched uncached from one public asset", async () => {
  const fetchStub = createFetchStub(createGeneratedConfig());
  const live = await fetchLiveGameStatsClientProtocol(liveOptions(fetchStub));

  assert.equal(live.resultProtocol, 2);
  assert.equal(live.configUrl, LIVE_CONFIG_URL);
  assert.equal(live.requestUrl, `${LIVE_CONFIG_URL}?game_stats_rollout_check=fixed-cache-bust`);
  assert.equal(fetchStub.calls.length, 1);
  const [{ url, init }] = fetchStub.calls;
  assert.equal(url, live.requestUrl);
  assert.equal(init.method, "GET");
  assert.equal(init.cache, "no-store");
  assert.equal(init.headers["Cache-Control"], "no-cache, no-store");
  assert.deepEqual(init.signal, { timeoutMs: 5_000 });
});

test("a published client without the field counts as the legacy protocol", async () => {
  const fetchStub = createFetchStub(createGeneratedConfig({ resultProtocol: null }));
  const live = await fetchLiveGameStatsClientProtocol(liveOptions(fetchStub));
  assert.equal(live.resultProtocol, CACHED_CLIENT_RESULT_PROTOCOL);
  assert.equal(live.resultProtocol, 1);
});

test("the live fetch rejects unusable transports, URLs, responses, and bodies", async () => {
  const fetchStub = createFetchStub(createGeneratedConfig());
  for (const [overrides, expected] of [
    [{ fetchImpl: null }, /fetch implementation is required for the rollout preflight/],
    [{ fetchImpl: "fetch" }, /fetch implementation is required for the rollout preflight/],
    [{ timeoutMs: 0 }, /Rollout preflight timeout must be a positive integer/],
    [{ timeoutMs: 1.5 }, /Rollout preflight timeout must be a positive integer/],
    [{ createTimeoutSignal: null }, /timeout signal factory is required/],
    [{ createCacheBust: "soon" }, /cache-bust factory is required/],
    [{ configUrl: "not-a-url" }, /invalid URL/],
    [{ configUrl: "file:///local/game-stats-backend.js" }, /must use HTTP or HTTPS/],
    [{ configUrl: "https://user:pass@site.example.test/c.js" }, /credentials or a fragment/],
    [{ configUrl: "https://site.example.test/c.js#top" }, /credentials or a fragment/],
  ]) {
    await assert.rejects(
      fetchLiveGameStatsClientProtocol(liveOptions(fetchStub, overrides)),
      expected
    );
  }
  assert.equal(fetchStub.calls.length, 0, "a rejected input must not reach the network");

  await assert.rejects(
    fetchLiveGameStatsClientProtocol(
      liveOptions(createFetchStub(new Error("socket closed")))
    ),
    /Unable to fetch the live game stats backend config at https:\/\/site\.example\.test/
  );
  await assert.rejects(
    fetchLiveGameStatsClientProtocol(liveOptions(createFetchStub(null))),
    /returned an invalid response/
  );
  await assert.rejects(
    fetchLiveGameStatsClientProtocol(
      liveOptions(createFetchStub(createGeneratedConfig(), { ok: false, status: 503 }))
    ),
    /failed with status 503/
  );
  await assert.rejects(
    fetchLiveGameStatsClientProtocol(
      liveOptions(
        createFetchStub(createGeneratedConfig(), {
          ok: false,
          status: "gateway",
        })
      )
    ),
    /failed with status unknown/
  );
  await assert.rejects(
    fetchLiveGameStatsClientProtocol(
      liveOptions(
        createFetchStub(createGeneratedConfig(), {
          read: async () => {
            throw new Error("aborted");
          },
        })
      )
    ),
    /Unable to read the live game stats backend config/
  );
});

test("a malformed or duplicated live protocol is rejected, not guessed", async () => {
  for (const body of [
    "window.somethingElse = {};",
    createGeneratedConfig({ buildVersion: "sha256-not-a-digest" }),
    createGeneratedConfig({ resultProtocol: '"2"' }),
    createGeneratedConfig({ resultProtocol: "3" }),
    createGeneratedConfig({ extra: "  resultProtocol: 2,\n" }),
  ]) {
    await assert.rejects(
      fetchLiveGameStatsClientProtocol(liveOptions(createFetchStub(body))),
      /Live game stats backend config is invalid/
    );
  }
});

test("the first verified rollout needs a future cutoff before it may deploy", async () => {
  for (const wrangler of [withCutoff(""), withCutoff(PAST)]) {
    await assert.rejects(
      checkGameStatsRollout(
        rolloutOptions({
          wrangler,
          fetchStub: createFetchStub(createGeneratedConfig({ resultProtocol: null })),
        })
      ),
      (error) => {
        assert.match(error.message, /Browsers still hold the resultProtocol 1 client/);
        assert.match(error.message, /this build publishes 2/);
        assert.match(error.message, new RegExp(`vars\\.${LEGACY_CUTOFF_VAR_NAME}`));
        assert.match(error.message, new RegExp(EXAMPLE_LEGACY_CUTOFF));
        return true;
      }
    );
  }

  const open = await checkGameStatsRollout(
    rolloutOptions({
      wrangler: withCutoff(FUTURE),
      fetchStub: createFetchStub(createGeneratedConfig({ resultProtocol: null })),
    })
  );
  assert.deepEqual(open, {
    localResultProtocol: 2,
    liveResultProtocol: 1,
    legacyIssuance: { phase: "open", deadline: FUTURE, reason: "window" },
  });
});

test("once verified clients are published, the cutoff is the operator's choice", async () => {
  for (const [wrangler, expectedPhase] of [
    [withCutoff(""), "closed"],
    [withCutoff(PAST), "closed"],
    [withCutoff(FUTURE), "open"],
  ]) {
    const result = await checkGameStatsRollout(
      rolloutOptions({ wrangler, fetchStub: createFetchStub(createGeneratedConfig()) })
    );
    assert.equal(result.liveResultProtocol, 2);
    assert.equal(result.localResultProtocol, 2);
    assert.equal(result.legacyIssuance.phase, expectedPhase);
  }
});

test("a build that publishes no new protocol is not a verified rollout", async () => {
  const result = await checkGameStatsRollout(
    rolloutOptions({
      local: createGeneratedConfig({ resultProtocol: "1" }),
      fetchStub: createFetchStub(createGeneratedConfig({ resultProtocol: null })),
    })
  );
  assert.deepEqual(result, {
    localResultProtocol: 1,
    liveResultProtocol: 1,
    legacyIssuance: { phase: "closed", deadline: null, reason: "unset" },
  });
});

test("local metadata and configuration are settled before anything is fetched", async () => {
  for (const [options, expected] of [
    [{ local: createGeneratedConfig({ resultProtocol: null }) }, /does not declare resultProtocol/],
    [{ local: createGeneratedConfig({ resultProtocol: "3" }) }, /unsupported resultProtocol 3/],
    [{ local: "window.rohinGameStatsBackend = {};" }, /exactly one apiBaseUrl/],
    [
      { local: createGeneratedConfig({ apiBaseUrl: "ftp://worker.example.test" }) },
      /apiBaseUrl must use HTTP or HTTPS/,
    ],
    [{ wrangler: withCutoff("tomorrow") }, /must be empty or a real UTC calendar instant/],
    [{ wrangler: createWranglerConfig(undefined) }, /must declare vars\./],
  ]) {
    const fetchStub = createFetchStub(createGeneratedConfig());
    await assert.rejects(checkGameStatsRollout(rolloutOptions({ ...options, fetchStub })), expected);
    assert.equal(fetchStub.calls.length, 0, "a local failure must not reach the network");
  }

  await assert.rejects(
    checkGameStatsRollout(
      rolloutOptions({ backendConfigUrl: "file:///repo/missing.js" })
    ),
    /Unable to read the generated game stats backend config/
  );
  await assert.rejects(
    checkGameStatsRollout(rolloutOptions({ readFileImpl: "not a function" })),
    TypeError
  );
  await assert.rejects(
    checkGameStatsRollout(rolloutOptions({ nowImpl: "not a function" })),
    TypeError
  );
  for (const clock of [() => Number.NaN, () => "soon", () => undefined]) {
    await assert.rejects(
      checkGameStatsRollout(rolloutOptions({ nowImpl: clock })),
      /clock returned an invalid time/
    );
  }
});

test("the transport dependencies reach the live fetch exactly as injected", async () => {
  const received = [];
  const result = await checkGameStatsRollout(
    rolloutOptions({
      fetchLiveProtocolImpl: async (options) => {
        received.push(options);
        return { resultProtocol: 2 };
      },
    })
  );

  assert.equal(result.liveResultProtocol, 2);
  assert.equal(received.length, 1);
  assert.equal(received[0].configUrl, LIVE_CONFIG_URL);
  assert.equal(received[0].timeoutMs, 5_000);
  assert.equal(received[0].createTimeoutSignal, createTimeoutSignal);
  assert.equal(received[0].createCacheBust(), "fixed-cache-bust");

  const defaulted = [];
  await checkGameStatsRollout({
    ...rolloutOptions(),
    liveConfigUrl: undefined,
    createTimeoutSignal: undefined,
    createCacheBust: undefined,
    fetchLiveProtocolImpl: async (options) => {
      defaulted.push(options);
      return { resultProtocol: 2 };
    },
  });
  assert.deepEqual(Object.keys(defaulted[0]).sort(), ["fetchImpl", "timeoutMs"]);
});

test("the command reports the protocol, phase, and cutoff without echoing configuration", async () => {
  const output = [];
  const errors = [];
  const code = await runGameStatsRolloutCheck({
    checkImpl: async () =>
      Object.freeze({
        localResultProtocol: 2,
        liveResultProtocol: 1,
        legacyIssuance: { phase: "open", deadline: FUTURE, reason: "window" },
      }),
    writeOutput: (message) => output.push(message),
    writeError: (message) => errors.push(message),
  });

  assert.equal(code, 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(output, [
    "Verified game stats rollout preflight: published client resultProtocol 1, " +
      `this build 2, new legacy issuance open until ${FUTURE}.`,
  ]);
  for (const secret of ["apiBaseUrl", "buildVersion", "sha256-", "workers.dev", "http"]) {
    assert.ok(!output[0].includes(secret), `success output must not echo ${secret}`);
  }
});

test("the command exits nonzero with an annotated, actionable failure", async () => {
  const output = [];
  const errors = [];
  const code = await runGameStatsRolloutCheck({
    checkImpl: async () => {
      throw new Error(`Set vars.${LEGACY_CUTOFF_VAR_NAME} to a future UTC deadline`);
    },
    writeOutput: (message) => output.push(message),
    writeError: (message) => errors.push(message),
  });

  assert.equal(code, 1);
  assert.deepEqual(output, []);
  assert.deepEqual(errors, [
    "::error::Game stats rollout preflight failed: " +
      `Set vars.${LEGACY_CUTOFF_VAR_NAME} to a future UTC deadline`,
  ]);

  const thrown = [];
  assert.equal(
    await runGameStatsRolloutCheck({
      checkImpl: async () => {
        throw "closed";
      },
      writeOutput: () => {},
      writeError: (message) => thrown.push(message),
    }),
    1
  );
  assert.match(thrown[0], /preflight failed: closed/);
});

test("the predeploy hook takes no arguments", async () => {
  const errors = [];
  let ran = 0;
  assert.equal(
    await runGameStatsRolloutCli({
      args: [],
      runCheckImpl: async () => {
        ran += 1;
        return 0;
      },
      writeError: (message) => errors.push(message),
    }),
    0
  );
  assert.equal(ran, 1);
  assert.deepEqual(errors, []);

  for (const args of [["--live"], ["--config", "wrangler.jsonc"], [""]]) {
    const usage = [];
    assert.equal(
      await runGameStatsRolloutCli({
        args,
        runCheckImpl: async () => {
          throw new Error("the check must not run for unknown arguments");
        },
        writeError: (message) => usage.push(message),
      }),
      1
    );
    assert.deepEqual(usage, ["Usage: node scripts/check-game-stats-rollout.mjs"]);
  }
});

test("the script entry point refuses arguments without reaching the network", async () => {
  const result = await promisify(execFile)(
    process.execPath,
    [ROLLOUT_SCRIPT.pathname, "--release"],
    { cwd: REPOSITORY_ROOT.pathname }
  ).then(
    () => assert.fail("the entry point must exit nonzero for unknown arguments"),
    (error) => error
  );

  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^Usage: node scripts\/check-game-stats-rollout\.mjs\n$/);
});

test("the generated backend config declares the shared rules' result protocol", async () => {
  const resultProtocol = await readCommonResultProtocol();
  const generated = createFrontendConfig(
    "https://worker.example.test",
    BUILD_VERSION,
    resultProtocol
  );

  assert.equal(readGeneratedResultProtocol(generated), resultProtocol);
  assert.equal(
    readGeneratedResultProtocol(await readFile(LOCAL_BACKEND_CONFIG_URL, "utf8")),
    resultProtocol,
    "the committed generated config must match the shared rules"
  );

  // The portable rules publish onto `globalThis` when no browser window exists.
  for (const rules of [
    "globalThis.homeGameRules = Object.freeze({});",
    "globalThis.homeGameRules = Object.freeze({ RESULT_PROTOCOL: 0 });",
    'globalThis.homeGameRules = Object.freeze({ RESULT_PROTOCOL: "2" });',
    "globalThis.homeGameRules = Object.freeze({ RESULT_PROTOCOL: 1.5 });",
    "globalThis.nothingPublished = true;",
  ]) {
    await assert.rejects(
      readCommonResultProtocol({
        rulesUrl: "file:///repo/rules.js",
        readFileImpl: createReader({ "file:///repo/rules.js": rules }),
      }),
      /must publish a positive integer RESULT_PROTOCOL/,
      "the generator cannot invent a protocol the rules do not declare"
    );
  }
});

test("both Wrangler configurations declare and document the cutoff", async () => {
  for (const relativePath of [
    "workers/game-stats/wrangler.jsonc",
    "workers/game-stats/wrangler.jsonc.example",
  ]) {
    const source = await readFile(new URL(relativePath, REPOSITORY_ROOT), "utf8");
    assert.ok(
      LEGACY_CUTOFF_VAR_NAME in parseJsonc(source).vars,
      `${relativePath} must declare the knob a deployer sets`
    );
    assert.match(
      source,
      new RegExp(`${EXAMPLE_LEGACY_CUTOFF}`),
      `${relativePath} must document the deadline a deployer sets`
    );
  }

  // The template ships closed. The production file is whatever the operator has
  // committed for the current release, so this only requires a value the gate
  // and the Worker both accept — a deadline must not make the release's own
  // `npm test` fail, and the assertion must not depend on the time of day.
  assert.equal(
    parseJsonc(
      await readFile(
        new URL("workers/game-stats/wrangler.jsonc.example", REPOSITORY_ROOT),
        "utf8"
      )
    ).vars[LEGACY_CUTOFF_VAR_NAME],
    "",
    "the example must ship the closed default"
  );
  const configured = await readLegacyIssuanceCutoff({ configUrl: WRANGLER_CONFIG_URL });
  assert.ok(
    configured.deadline === null || Number.isFinite(configured.deadlineMs),
    "the committed production cutoff must be empty or a real UTC instant"
  );
  assert.equal(String(WRANGLER_CONFIG_URL).endsWith("workers/game-stats/wrangler.jsonc"), true);
});

test("the Worker's deploy script runs the preflight and its dry run stays local", async () => {
  const workerPackage = JSON.parse(
    await readFile(new URL("workers/game-stats/package.json", REPOSITORY_ROOT), "utf8")
  );

  assert.equal(
    workerPackage.scripts.predeploy,
    "node ../../scripts/check-game-stats-rollout.mjs"
  );
  assert.equal(workerPackage.scripts.deploy, "wrangler deploy");
  assert.equal(
    workerPackage.scripts["deploy:check"],
    "wrangler deploy --dry-run --config wrangler.jsonc --strict"
  );
  for (const hook of ["predeploy:check", "postdeploy", "prestart", "pretest"]) {
    assert.equal(
      hook in workerPackage.scripts,
      false,
      `${hook} must not gate a local or unrelated command on a future deployment date`
    );
  }
});

test("the defaults supply a real abort signal, a unique cache bust, and the system clock", async () => {
  const fetchStub = createFetchStub(createGeneratedConfig());
  const first = await fetchLiveGameStatsClientProtocol({
    configUrl: LIVE_CONFIG_URL,
    fetchImpl: fetchStub.fetchImpl,
  });
  const second = await fetchLiveGameStatsClientProtocol({
    configUrl: LIVE_CONFIG_URL,
    fetchImpl: fetchStub.fetchImpl,
  });

  assert.equal(first.resultProtocol, 2);
  assert.ok(fetchStub.calls[0].init.signal instanceof AbortSignal);
  assert.notEqual(
    first.requestUrl,
    second.requestUrl,
    "two preflights in one process must not share a cache-bust value"
  );

  const result = await checkGameStatsRollout(
    rolloutOptions({
      wrangler: withCutoff("2999-01-01T00:00:00Z"),
      nowImpl: undefined,
      fetchStub: createFetchStub(createGeneratedConfig({ resultProtocol: null })),
    })
  );
  assert.equal(result.legacyIssuance.phase, "open", "the system clock is far from 2999");
});

test("the default writers report through the console", async () => {
  const { log, error } = console;
  const lines = [];
  console.log = (message) => lines.push(["log", message]);
  console.error = (message) => lines.push(["error", message]);
  try {
    assert.equal(
      await runGameStatsRolloutCheck({
        checkImpl: async () => ({
          localResultProtocol: 2,
          liveResultProtocol: 2,
          legacyIssuance: { phase: "closed", deadline: null, reason: "unset" },
        }),
      }),
      0
    );
    assert.equal(
      await runGameStatsRolloutCheck({
        checkImpl: async () => {
          throw new Error("no deadline");
        },
      }),
      1
    );
    assert.equal(await runGameStatsRolloutCli({ args: ["--live"], runCheckImpl: async () => 0 }), 1);
  } finally {
    console.log = log;
    console.error = error;
  }

  assert.deepEqual(
    lines.map(([stream]) => stream),
    ["log", "error", "error"]
  );
  assert.match(lines[0][1], /new legacy issuance closed \(no deadline declared\)\.$/);
  assert.match(lines[1][1], /^::error::Game stats rollout preflight failed: no deadline$/);
  assert.match(lines[2][1], /^Usage: node scripts\/check-game-stats-rollout\.mjs$/);
});

/**
 * The Worker's own expression at `workers/game-stats/src/sessions.mjs`. The
 * preflight may be stricter — it refuses to approve a value whose meaning is
 * unclear — but it must never report a window the Worker would not honour.
 */
const workerLegacyPhase = (declared, now) => {
  const legacyCutoff = Date.parse(String(declared || ""));
  return !Number.isFinite(legacyCutoff) || now >= legacyCutoff ? "closed" : "open";
};

test("every cutoff the preflight approves means the same thing to the Worker", async () => {
  const read = (declared) => ({
    configUrl: "file:///repo/wrangler.jsonc",
    readFileImpl: createReader({ "file:///repo/wrangler.jsonc": withCutoff(declared) }),
  });
  const accepted = ["", "   ", FUTURE, PAST, "2026-11-01T00:00:00.250Z"];
  const rejected = [
    // Date.parse accepts these, so trimming or reformatting them here would
    // approve a window the Worker closes on the spot.
    " 2026-11-01T00:00:00Z ",
    "2026-11-01T00:00:00Z\n",
    "\t2026-11-01T00:00:00Z",
    "2026-11-01T00:00:00+00:00",
    "2026-11-01",
  ];

  for (const declared of accepted) {
    const cutoff = await readLegacyIssuanceCutoff(read(declared));
    for (const now of [NOW, Date.parse(FUTURE), Date.parse(FUTURE) + 1]) {
      assert.equal(
        resolveLegacyIssuancePhase(cutoff, now).phase,
        workerLegacyPhase(declared, now),
        `${JSON.stringify(declared)} must mean the same at ${new Date(now).toISOString()}`
      );
    }
  }
  for (const declared of rejected) {
    await assert.rejects(
      readLegacyIssuanceCutoff(read(declared)),
      /must be empty or a real UTC calendar instant/,
      `${JSON.stringify(declared)} must not be normalized into an approval`
    );
  }

  // The reviewed regression: the padded deadline read as open while the Worker
  // failed to parse it at all and closed legacy issuance immediately.
  const padded = " 2026-11-01T00:00:00Z ";
  assert.equal(workerLegacyPhase(padded, NOW), "closed");
  await assert.rejects(
    checkGameStatsRollout(
      rolloutOptions({
        wrangler: withCutoff(padded),
        fetchStub: createFetchStub(createGeneratedConfig({ resultProtocol: null })),
      })
    ),
    /must be empty or a real UTC calendar instant/
  );
});

test("a published config is parsed as generated members, never evaluated", async () => {
  const generated = createFrontendConfig(
    "https://worker.example.test",
    BUILD_VERSION,
    2
  );
  const members = parseGeneratedBackendMembers(generated);

  assert.deepEqual(
    [...members.keys()],
    ["apiBaseUrl", "buildVersion", "resultProtocol"],
    "the parser must accept exactly what the generator produces"
  );
  assert.equal(
    JSON.parse(members.get("apiBaseUrl")),
    "https://worker.example.test",
    "a // inside the apiBaseUrl string is content, not a comment"
  );
  assert.equal(
    readGeneratedResultProtocol(
      generated.replace("https://worker.example.test", "http://host/a//b?q=1#x")
    ),
    2
  );

  // The three live-source variants the review reproduced against this parser.
  assert.equal(
    readGeneratedResultProtocol(generated.replace("  resultProtocol: 2,", "  // resultProtocol: 2,")),
    undefined,
    "a commented-out member is absent, which is the legacy client"
  );
  assert.throws(
    () =>
      readGeneratedResultProtocol(
        generated.replace("  resultProtocol: 2,", '  resultProtocol: 2,\n  "resultProtocol": 1,')
      ),
    /not a plain string or integer field/,
    "a quoted key must never override the declared member"
  );
  assert.throws(
    () =>
      readGeneratedResultProtocol(
        generated.replace("  resultProtocol: 2,", "  resultProtocol: 2\n    + 1,")
      ),
    /not a plain string or integer field/,
    "an expression is not a declared protocol"
  );
});

test("anything outside the generated grammar fails the gate", async () => {
  const generated = createFrontendConfig("https://worker.example.test", BUILD_VERSION, 2);

  for (const [source, expected] of [
    ["window.rohinGameStatsBackend = { apiBaseUrl: \"https://a.test\" };", /one frozen window\.rohinGameStatsBackend object literal/],
    [generated.replace("Object.freeze({", "Object.seal({"), /one frozen window\.rohinGameStatsBackend object literal/],
    [`${generated}window.somethingElse = 1;\n`, /one frozen window\.rohinGameStatsBackend object literal/],
    [generated.replace("});", "}) || {};"), /one frozen window\.rohinGameStatsBackend object literal/],
    [generated.replace("  resultProtocol: 2,", "  resultProtocol: 2,\n  resultProtocol: 1,"), /declares resultProtocol more than once/],
    [generated.replace("  resultProtocol: 2,", "  rolloutExempt: 1,\n  resultProtocol: 2,"), /unknown member rolloutExempt/],
    [generated.replace("  resultProtocol: 2,", "  resultProtocol: 0x2,"), /not a plain string or integer field/],
    [generated.replace("  resultProtocol: 2,", "  resultProtocol: '2',"), /not a plain string or integer field/],
    [generated.replace("  resultProtocol: 2,", "  resultProtocol: Number(2),"), /not a plain string or integer field/],
    [generated.replace("  resultProtocol: 2,", "  resultProtocol: 2.0,"), /not a plain string or integer field/],
    [generated.replace("  resultProtocol: 2,", "  ...spread,"), /not a plain string or integer field/],
  ]) {
    assert.throws(() => parseGeneratedBackendMembers(source), expected);
  }
  // A well-formed member carrying an unsupported value is the reader's call.
  const unsupported = generated.replace("  resultProtocol: 2,", "  resultProtocol: 3,");
  assert.equal(parseGeneratedBackendMembers(unsupported).get("resultProtocol"), "3");
  assert.throws(
    () => readGeneratedResultProtocol(unsupported),
    /unsupported resultProtocol 3/
  );
  for (const invalid of [undefined, null, 2, Buffer.from(generated)]) {
    assert.throws(() => parseGeneratedBackendMembers(invalid), TypeError);
  }

  // A rejected published config stops the deploy rather than reading as legacy.
  await assert.rejects(
    fetchLiveGameStatsClientProtocol(
      liveOptions(createFetchStub(generated.replace("  resultProtocol: 2,", "  resultProtocol: 2\n    + 1,")))
    ),
    /Live game stats backend config is invalid/
  );
});

test("the committed and generated configs parse under the restricted grammar", async () => {
  const resultProtocol = await readCommonResultProtocol();
  const committed = await readFile(LOCAL_BACKEND_CONFIG_URL, "utf8");
  const members = parseGeneratedBackendMembers(committed);

  assert.deepEqual(
    [...members.keys()],
    [...parseGeneratedBackendMembers(
      createFrontendConfig("https://worker.example.test", BUILD_VERSION, resultProtocol)
    ).keys()],
    "the committed file and the generator must declare the same members"
  );
  assert.equal(readGeneratedResultProtocol(committed), resultProtocol);
});
