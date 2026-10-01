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
const CONVERGENCE_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 5_000;
const MAX_BATTLES = 20;
const MAX_CURRENT_DECK_CARDS = 8;
const MAX_PARTICIPANT_CARDS = 16;
const MAX_PARTICIPANTS = 4;
const ASSET_ORIGIN = "https://api-assets.clashroyale.com";
const CARD_ASSET_PATH = "/cards/300/";
const EVOLUTION_ASSET_PATH = "/cardevolutions/300/";
const HERO_ASSET_PATH = "/cardheroes/300/";
const MIRROR_CARD_ID = 28000006;
const CARD_RARITIES = new Set([
  "common", "rare", "epic", "legendary", "champion",
]);
const CARD_VARIANTS = new Set(["evo", "hero"]);

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const assertPositiveInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
};

class DeploymentTransitionError extends Error {}

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isOptionalNonNegativeInteger = (value) =>
  value === undefined || (Number.isSafeInteger(value) && value >= 0);

const isAssetUrl = (value, pathPrefix) => {
  if (value === undefined) return true;
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return url.origin === ASSET_ORIGIN &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith(pathPrefix) &&
      url.pathname.endsWith(".png");
  } catch {
    return false;
  }
};

const isCard = (card, { allowLegacyVariant = false } = {}) => {
  if (
    !isRecord(card) ||
    !Number.isSafeInteger(card.id) ||
    card.id < 0 ||
    typeof card.name !== "string" ||
    !card.name.trim() ||
    !isOptionalNonNegativeInteger(card.level) ||
    !isOptionalNonNegativeInteger(card.maxLevel) ||
    !isOptionalNonNegativeInteger(card.starLevel) ||
    !isOptionalNonNegativeInteger(card.evolutionLevel) ||
    (card.elixirCost !== undefined &&
      (!Number.isSafeInteger(card.elixirCost) || card.elixirCost < 0 ||
        card.id === MIRROR_CARD_ID)) ||
    (card.rarity !== undefined && !CARD_RARITIES.has(card.rarity)) ||
    (card.variant !== undefined && !CARD_VARIANTS.has(card.variant)) ||
    !isAssetUrl(card.iconUrl, CARD_ASSET_PATH)
  ) {
    return false;
  }
  const expectedVariant = card.evolutionLevel === 1
    ? "evo"
    : card.evolutionLevel === 2
      ? "hero"
      : undefined;
  const isLegacyVariant = allowLegacyVariant &&
    expectedVariant !== undefined &&
    card.variant === undefined &&
    card.variantIconUrl === undefined;
  if (card.variant !== expectedVariant && !isLegacyVariant) return false;
  const variantPath = card.variant === "evo"
    ? EVOLUTION_ASSET_PATH
    : card.variant === "hero"
      ? HERO_ASSET_PATH
      : undefined;
  return card.variantIconUrl === undefined ||
    (variantPath !== undefined && isAssetUrl(card.variantIconUrl, variantPath));
};

const isCardArray = (value, limit, options) =>
  Array.isArray(value) && value.length <= limit &&
  value.every((card) => isCard(card, options));

const isParticipant = (value, options) =>
  isRecord(value) &&
  (value.cards === undefined ||
    isCardArray(value.cards, MAX_PARTICIPANT_CARDS, options));

const isParticipantArray = (value, options) =>
  Array.isArray(value) && value.length > 0 &&
  value.length <= MAX_PARTICIPANTS &&
  value.every((participant) => isParticipant(participant, options));

const isBattle = (value, options) =>
  isRecord(value) &&
  isParticipantArray(value.team, options) &&
  isParticipantArray(value.opponent, options);

const hasSnapshotShape = (payload, options) =>
  payload?.ok === true &&
  payload.player?.tag === PLAYER_TAG &&
  typeof payload.player?.name === "string" &&
  Boolean(payload.player.name.trim()) &&
  isCardArray(payload.player.currentDeck, MAX_CURRENT_DECK_CARDS, options) &&
  Array.isArray(payload.battles) &&
  payload.battles.length <= MAX_BATTLES &&
  payload.battles.every((battle) => isBattle(battle, options)) &&
  payload.cacheTtlSeconds === CACHE_TTL_SECONDS;

const hasLegacyVariantMetadata = (payload) => {
  const cards = [...payload.player.currentDeck];
  for (const battle of payload.battles) {
    for (const participant of [...battle.team, ...battle.opponent]) {
      if (participant.cards) cards.push(...participant.cards);
    }
  }
  return cards.some((card) =>
    (card.evolutionLevel === 1 || card.evolutionLevel === 2) &&
    card.variant === undefined
  );
};

const fetchSnapshot = async ({ endpoint, fetchImpl, now }) => {
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

  if (!hasSnapshotShape(payload)) {
    if (
      hasSnapshotShape(payload, { allowLegacyVariant: true }) &&
      hasLegacyVariantMetadata(payload)
    ) {
      throw new DeploymentTransitionError(
        "deployed Worker still returns legacy card variant metadata"
      );
    }
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

/** Checks the deployed integration without reading or transmitting a secret. */
export const checkClashRoyaleDeployment = async ({
  readFileImpl = readFile,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  pollNow = Date.now,
  sleepImpl = sleep,
  convergenceTimeoutMs = CONVERGENCE_TIMEOUT_MS,
  pollIntervalMs = POLL_INTERVAL_MS,
} = {}) => {
  assertPositiveInteger(convergenceTimeoutMs, "Convergence timeout");
  assertPositiveInteger(pollIntervalMs, "Poll interval");
  if (typeof sleepImpl !== "function" || typeof pollNow !== "function") {
    throw new TypeError("Polling dependencies must be functions");
  }
  const config = parseGameStatsBackendConfig(
    await readFileImpl(GAME_STATS_BACKEND_CONFIG_URL, "utf8")
  );
  const endpoint = `${config.apiBaseUrl}/clash-royale`;
  const maxAttempts = Math.max(
    1,
    Math.ceil(convergenceTimeoutMs / pollIntervalMs)
  );
  const startedAt = Number(pollNow());
  if (!Number.isFinite(startedAt)) {
    throw new Error("Clash Royale deployment clock returned an invalid time");
  }
  const deadline = startedAt + convergenceTimeoutMs;
  let attempts = 0;
  let lastTransitionError;
  while (attempts < maxAttempts) {
    const currentTime = Number(pollNow());
    if (!Number.isFinite(currentTime)) {
      throw new Error("Clash Royale deployment clock returned an invalid time");
    }
    if (attempts > 0 && currentTime >= deadline) break;
    attempts += 1;
    try {
      return await fetchSnapshot({ endpoint, fetchImpl, now });
    } catch (error) {
      if (!(error instanceof DeploymentTransitionError)) throw error;
      lastTransitionError = error;
    }
    const afterAttempt = Number(pollNow());
    if (!Number.isFinite(afterAttempt)) {
      throw new Error("Clash Royale deployment clock returned an invalid time");
    }
    const remainingMs = deadline - afterAttempt;
    if (attempts >= maxAttempts || remainingMs <= 0) break;
    await sleepImpl(Math.min(pollIntervalMs, remainingMs));
  }
  throw new Error(
    `Clash Royale deployment did not converge within ${convergenceTimeoutMs}ms ` +
    `after ${attempts} attempt${attempts === 1 ? "" : "s"}: ` +
    lastTransitionError.message
  );
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
