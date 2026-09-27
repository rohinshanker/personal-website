import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { GAME_BUILD_VERSION_PATTERN } from "../scripts/lib/game-build.mjs";
import { parseJsonc } from "../scripts/lib/jsonc.mjs";
import {
  GAME_COMPLETION_SOURCE_FILES,
  MAX_GAME_BUILD_COMPATIBILITY_VERSIONS,
  calculateGameBuildVersion,
  updateGameIntegrity,
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
  assert.ok(
    compatibilityVersions.includes(
      "sha256-7c5f92037db895a1bb868a79152c2db70fc7d7a65c13482ebb56920047c40d0a"
    )
  );
  assert.ok(
    compatibilityVersions.includes(
      "sha256-8da5fabb2d24da0b79b4cbb6a314df595fefbd926adab3a1447c185d865aa6e2"
    )
  );
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
  ]);
  assert.deepEqual(GAME_COMPLETION_SOURCE_FILES, [
    "scripts/home/main.js",
    "scripts/home/core/dom.js",
  ]);
  for (const entryPoint of [home, index]) {
    for (const assetPath of [
      "scripts/home/game-stats-backend.js",
      "scripts/home/core/dom.js",
      "scripts/home/main.js",
    ]) {
      assert.match(entryPoint, new RegExp(`${assetPath.replaceAll(".", "\\.")}\\?v=${cacheToken}`));
    }
  }
  assert.match(
    videoEditor,
    new RegExp(`src="\\.\\./scripts/home/game-stats-backend\\.js\\?v=${cacheToken}" defer`)
  );
});

test("the Worker's local build-identity copies match the shared script definitions", async () => {
  const workerSource = await readFile(
    new URL("../workers/game-stats/src/index.mjs", import.meta.url),
    "utf8"
  );

  assert.equal(
    workerSource.match(/^const GAME_BUILD_VERSION_PATTERN = (.+);$/m)?.[1],
    String(GAME_BUILD_VERSION_PATTERN)
  );
  assert.equal(
    Number(
      workerSource.match(/^const MAX_GAME_BUILD_COMPATIBILITY_VERSIONS = (\d+);$/m)?.[1]
    ),
    MAX_GAME_BUILD_COMPATIBILITY_VERSIONS
  );
});
