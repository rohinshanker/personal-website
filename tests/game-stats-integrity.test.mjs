import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GAME_COMPLETION_SOURCE_FILES,
  calculateGameBuildVersion,
  updateGameIntegrity,
} from "../scripts/update-game-integrity.mjs";

test("game build metadata matches the completion source and Worker configuration", async () => {
  const buildVersion = await updateGameIntegrity({ check: true });
  const frontendConfig = await readFile(
    new URL("../scripts/home/game-stats-backend.js", import.meta.url),
    "utf8"
  );
  const wranglerConfig = JSON.parse(
    await readFile(new URL("../workers/game-stats/wrangler.jsonc", import.meta.url), "utf8")
  );
  const [home, index] = await Promise.all([
    readFile(new URL("../home.html", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
  ]);
  const cacheToken = `game-build-${buildVersion.replace(/^sha256-/, "")}`;

  assert.equal(buildVersion, await calculateGameBuildVersion());
  assert.match(frontendConfig, new RegExp(`buildVersion: "${buildVersion}"`));
  assert.match(
    frontendConfig,
    /apiBaseUrl: "https:\/\/personal-site-game-stats\.rohinshankerme\.workers\.dev"/
  );
  assert.equal(wranglerConfig.vars.GAME_BUILD_VERSION, buildVersion);
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
});
