import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GAME_BUILD_VERSION_PATTERN,
  INTEGRITY_CACHE_ASSET_PATHS,
  digestGameCompletionSources,
} from "../scripts/lib/game-build.mjs";
import { parseJsonc } from "../scripts/lib/jsonc.mjs";
import {
  GAME_COMPLETION_SOURCE_FILES,
  MAX_GAME_BUILD_COMPATIBILITY_VERSIONS,
  calculateGameBuildVersion,
  updateGameIntegrity,
  updateWranglerBuildVersion,
} from "../scripts/update-game-integrity.mjs";

test("game build metadata matches the completion source and Worker configuration", async () => {
  const buildVersion = await updateGameIntegrity({ check: true });
  const frontendConfig = await readFile(
    new URL("../scripts/home/game-stats-backend.js", import.meta.url),
    "utf8"
  );
  const wranglerConfig = parseJsonc(
    await readFile(new URL("../workers/game-stats/wrangler.jsonc", import.meta.url), "utf8")
  );
  const [home, index, videoEditor] = await Promise.all([
    readFile(new URL("../home.html", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../video-editor/index.html", import.meta.url), "utf8"),
  ]);
  const cacheToken = `game-build-${buildVersion.replace(/^sha256-/, "")}`;

  assert.equal(buildVersion, await calculateGameBuildVersion());
  assert.match(frontendConfig, new RegExp(`buildVersion: "${buildVersion}"`));
  assert.match(
    frontendConfig,
    /apiBaseUrl: "https:\/\/personal-site-game-stats\.rohinshankerme\.workers\.dev"/
  );
  assert.equal(wranglerConfig.vars.GAME_BUILD_VERSION, buildVersion);
  const compatibilityVersions =
    wranglerConfig.vars.GAME_BUILD_COMPATIBILITY_VERSIONS.split(",");
  assert.ok(compatibilityVersions.length > 0);
  for (const version of compatibilityVersions) {
    assert.match(version, GAME_BUILD_VERSION_PATTERN);
    assert.notEqual(version, buildVersion);
  }
  assert.ok(
    compatibilityVersions.length <= MAX_GAME_BUILD_COMPATIBILITY_VERSIONS
  );
  assert.equal(new Set(compatibilityVersions).size, compatibilityVersions.length);
  assert.equal(wranglerConfig.vars.ALLOWED_ORIGIN, "https://rohin.shanker.me");
  assert.equal(Object.hasOwn(wranglerConfig.vars, "LOCAL_ALLOWED_ORIGIN"), false);
  assert.equal(Object.hasOwn(wranglerConfig.vars, "EXTRA_ALLOWED_ORIGINS"), false);
  assert.deepEqual(wranglerConfig.secrets.required, [
    "EVENT_SIGNING_SECRET",
    "IP_HASH_SECRET",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "ADMIN_SESSION_SIGNING_SECRET",
    "CLASH_ROYALE_API_KEY",
  ]);
  assert.deepEqual(GAME_COMPLETION_SOURCE_FILES, [
    "scripts/home/main.js",
    "scripts/home/core/dom.js",
    "scripts/home/sudoku-generator.worker.js",
  ]);
  for (const entryPoint of [home, index]) {
    for (const assetPath of INTEGRITY_CACHE_ASSET_PATHS) {
      assert.match(entryPoint, new RegExp(`${assetPath.replaceAll(".", "\\.")}\\?v=${cacheToken}`));
    }
  }
  assert.match(
    videoEditor,
    new RegExp(`src="\\.\\./scripts/home/game-stats-backend\\.js\\?v=${cacheToken}" defer`)
  );
});

test("both Wrangler configurations schedule the same expiry purge", async () => {
  const [config, exampleConfig] = await Promise.all(
    [
      "../workers/game-stats/wrangler.jsonc",
      "../workers/game-stats/wrangler.jsonc.example",
    ].map(async (relativePath) =>
      parseJsonc(await readFile(new URL(relativePath, import.meta.url), "utf8"))
    )
  );

  assert.deepEqual(config.triggers.crons, ["0 * * * *"]);
  assert.deepEqual(exampleConfig.triggers, config.triggers);
  assert.deepEqual(exampleConfig.secrets, config.secrets);
});

test("the Worker's local build-identity copies match the shared script definitions", async () => {
  const workerSource = await readFile(
    new URL("../workers/game-stats/src/constants.mjs", import.meta.url),
    "utf8"
  );

  assert.equal(
    workerSource.match(/^export const GAME_BUILD_VERSION_PATTERN = (.+);$/m)?.[1],
    String(GAME_BUILD_VERSION_PATTERN)
  );
  assert.equal(
    Number(
      workerSource.match(
        /^export const MAX_GAME_BUILD_COMPATIBILITY_VERSIONS = (\d+);$/m
      )?.[1]
    ),
    MAX_GAME_BUILD_COMPATIBILITY_VERSIONS
  );
});

/**
 * A pinned file list proves only that the list has not changed by accident. It
 * says nothing about whether the digest actually follows the files it names, so
 * this walks the declared list and mutates each source in memory in turn. A
 * completion source left out of the digest — the Sudoku generator worker was —
 * shows up here as a hash that does not move.
 */
test("changing any declared completion source changes the build version", async () => {
  const sources = new Map(
    await Promise.all(
      GAME_COMPLETION_SOURCE_FILES.map(async (relativePath) => [
        relativePath,
        await readFile(new URL(`../${relativePath}`, import.meta.url)),
      ])
    )
  );
  const readSource = (relativePath) => {
    const bytes = sources.get(relativePath);
    assert.ok(bytes, `${relativePath} must be readable from the repository root`);
    return bytes;
  };
  const unchanged = await digestGameCompletionSources(readSource);
  assert.equal(unchanged, await calculateGameBuildVersion());

  for (const mutated of GAME_COMPLETION_SOURCE_FILES) {
    const digest = await digestGameCompletionSources((relativePath) =>
      relativePath === mutated
        ? Buffer.concat([readSource(relativePath), Buffer.from("\n// mutated\n")])
        : readSource(relativePath)
    );
    assert.notEqual(digest, unchanged, `${mutated} must be inside the build digest`);
  }
});


test("build history retains the previous release, removes invalid duplicates, and evicts the oldest at its bound", () => {
  const version = (number) => `sha256-${number.toString(16).padStart(64, "0")}`;
  const history = Array.from({ length: MAX_GAME_BUILD_COMPATIBILITY_VERSIONS }, (_, index) => version(index + 1));
  const previous = version(100);
  const next = version(101);
  const source = JSON.stringify({ vars: {
    GAME_BUILD_VERSION: previous,
    GAME_BUILD_COMPATIBILITY_VERSIONS: [history[0], "invalid", previous, next, ...history].join(","),
  }});
  const updated = parseJsonc(updateWranglerBuildVersion(source, next));
  assert.equal(updated.vars.GAME_BUILD_VERSION, next);
  assert.deepEqual(updated.vars.GAME_BUILD_COMPATIBILITY_VERSIONS.split(","), [previous, ...history.slice(0, -1)]);
  assert.equal(updateWranglerBuildVersion(JSON.stringify(updated), next), JSON.stringify(updated), "rechecking the same release is idempotent");
});

test("build history starts empty when no valid prior release exists", () => {
  const next = `sha256-${"a".repeat(64)}`;
  const source = JSON.stringify({ vars: { GAME_BUILD_VERSION: "", GAME_BUILD_COMPATIBILITY_VERSIONS: "" } });
  const updated = parseJsonc(updateWranglerBuildVersion(source, next));
  assert.equal(updated.vars.GAME_BUILD_VERSION, next);
  assert.equal(updated.vars.GAME_BUILD_COMPATIBILITY_VERSIONS, "");
});
