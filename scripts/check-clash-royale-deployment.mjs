import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  GAME_STATS_BACKEND_CONFIG_URL,
  parseGameStatsBackendConfig,
} from "./check-game-stats-deployment.mjs";
import { fetchGuardedBody } from "./lib/http.mjs";

const SITE_ORIGIN = "https://rohin.shanker.me";
const PLAYER_TAG = "#28CYYU08P";
const CACHE_TTL_SECONDS = 300;

/** Checks the deployed integration without reading or transmitting a secret. */
export const checkClashRoyaleDeployment = async ({
  readFileImpl = readFile,
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) => {
  const config = parseGameStatsBackendConfig(
    await readFileImpl(GAME_STATS_BACKEND_CONFIG_URL, "utf8")
  );
  const endpoint = `${config.apiBaseUrl}/clash-royale`;
  const payload = await fetchGuardedBody(endpoint, {
    fetchImpl: async (url, options) => {
      const response = await fetchImpl(url, options);
      if (
        response?.ok &&
        response.headers?.get("Access-Control-Allow-Origin") !== SITE_ORIGIN
      ) {
        throw new Error("Clash Royale response does not allow the production origin");
      }
      return response;
    },
    timeoutMs: 15_000,
    createTimeoutSignal: (milliseconds) => AbortSignal.timeout(milliseconds),
    readAs: "json",
    init: {
      method: "GET",
      headers: { Accept: "application/json", Origin: SITE_ORIGIN },
      cache: "no-store",
      redirect: "error",
    },
    messages: {
      requestFailed: "Clash Royale request or production CORS check failed",
      invalidResponse: "Clash Royale endpoint returned an invalid response",
      statusFailed: (status) => `Clash Royale endpoint failed with HTTP ${status}`,
      bodyUnreadable: "Clash Royale endpoint did not return valid JSON",
    },
  });

  if (
    payload?.ok !== true ||
    payload.player?.tag !== PLAYER_TAG ||
    typeof payload.player?.name !== "string" ||
    !payload.player.name.trim() ||
    !Array.isArray(payload.battles) ||
    payload.cacheTtlSeconds !== CACHE_TTL_SECONDS
  ) {
    throw new Error("Clash Royale endpoint returned an invalid player snapshot");
  }
  const fetchedAt = typeof payload.fetchedAt === "string"
    ? Date.parse(payload.fetchedAt)
    : NaN;
  const age = now() - fetchedAt;
  if (!Number.isFinite(age) || age < -30_000 || age > 330_000) {
    throw new Error("Clash Royale snapshot timestamp is invalid or stale");
  }
  return { playerTag: PLAYER_TAG, battleCount: payload.battles.length };
};

export const runClashRoyaleDeploymentCheck = async ({
  checkImpl = checkClashRoyaleDeployment,
  writeOutput = console.log,
  writeError = console.error,
} = {}) => {
  try {
    const result = await checkImpl();
    writeOutput(
      `Verified live Clash Royale player ${result.playerTag}, ` +
      `${result.battleCount} recent battles, fresh snapshot, and production CORS.`
    );
    return 0;
  } catch (error) {
    writeError(`Clash Royale deployment check failed: ${error.message}`);
    return 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await runClashRoyaleDeploymentCheck();
}
