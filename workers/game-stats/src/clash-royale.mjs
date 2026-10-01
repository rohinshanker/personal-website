import { HttpError, jsonResponse } from "./http.mjs";

export const CLASH_ROYALE_PLAYER_TAG = "#28CYYU08P";
export const CLASH_ROYALE_CACHE_TTL_SECONDS = 300;

const API_ROOT = "https://proxy.royaleapi.dev/v1/players/%2328CYYU08P";
const PROFILE_URL = API_ROOT;
const BATTLELOG_URL = `${API_ROOT}/battlelog`;
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_PROFILE_BYTES = 256 * 1024;
const MAX_BATTLELOG_BYTES = 1024 * 1024;
const MAX_CACHED_PAYLOAD_BYTES = 512 * 1024;
const MAX_BATTLES = 10;
const MAX_CARDS = 16;
const MAX_TEXT_LENGTH = 256;
const DEFAULT_RATE_LIMIT_RETRY_MS = 30_000;
const MAX_RATE_LIMIT_RETRY_MS = 60_000;
const ASSET_HOST = "api-assets.clashroyale.com";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const upstreamDataError = () =>
  new HttpError(502, "Clash Royale returned invalid data", {
    code: "CLASH_ROYALE_INVALID_DATA",
  });

const requiredText = (value) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > MAX_TEXT_LENGTH
  ) {
    throw upstreamDataError();
  }
  return value;
};

const optionalText = (value) =>
  typeof value === "string" && value.trim() && value.length <= MAX_TEXT_LENGTH
    ? value
    : undefined;

const optionalInteger = (value, { allowNegative = false } = {}) =>
  Number.isSafeInteger(value) && (allowNegative || value >= 0) ? value : undefined;

const normalizeTag = (value) => {
  const tag = requiredText(value).trim().toUpperCase();
  if (!/^#[A-Z0-9]{3,20}$/.test(tag)) throw upstreamDataError();
  return tag;
};

const optionalAssetUrl = (value) => {
  if (typeof value !== "string" || value.length > 2_048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === ASSET_HOST
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

const compact = (entries) =>
  Object.fromEntries(entries.filter(([, value]) => value !== undefined));

const normalizeClan = (value) => {
  if (!isRecord(value)) return undefined;
  return compact([
    ["tag", normalizeTag(value.tag)],
    ["name", requiredText(value.name)],
    ["badgeId", optionalInteger(value.badgeId)],
  ]);
};

const normalizeNamedId = (value) => {
  if (!isRecord(value)) return undefined;
  const id = optionalInteger(value.id);
  const name = optionalText(value.name);
  if (id === undefined || name === undefined) return undefined;
  return { id, name };
};

const normalizeCard = (value) => {
  if (!isRecord(value)) throw upstreamDataError();
  const id = optionalInteger(value.id);
  if (id === undefined) throw upstreamDataError();
  const iconUrl = optionalAssetUrl(value.iconUrls?.medium);
  return compact([
    ["id", id],
    ["name", requiredText(value.name)],
    ["level", optionalInteger(value.level)],
    ["maxLevel", optionalInteger(value.maxLevel)],
    ["starLevel", optionalInteger(value.starLevel)],
    ["evolutionLevel", optionalInteger(value.evolutionLevel)],
    ["iconUrl", iconUrl],
  ]);
};

const normalizeCards = (value, limit = MAX_CARDS) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw upstreamDataError();
  return value.slice(0, limit).map(normalizeCard);
};

const normalizeParticipant = (value) => {
  if (!isRecord(value)) throw upstreamDataError();
  return compact([
    ["tag", normalizeTag(value.tag)],
    ["name", requiredText(value.name)],
    ["crowns", optionalInteger(value.crowns)],
    ["trophyChange", optionalInteger(value.trophyChange, { allowNegative: true })],
    ["clan", normalizeClan(value.clan)],
    ["cards", normalizeCards(value.cards)],
  ]);
};

const normalizeParticipants = (value) => {
  if (!Array.isArray(value) || value.length === 0) throw upstreamDataError();
  return value.slice(0, 4).map(normalizeParticipant);
};

const normalizeBattle = (value) => {
  if (!isRecord(value)) throw upstreamDataError();
  return compact([
    ["battleTime", requiredText(value.battleTime)],
    ["type", optionalText(value.type)],
    ["gameMode", normalizeNamedId(value.gameMode)],
    ["deckSelection", optionalText(value.deckSelection)],
    ["team", normalizeParticipants(value.team)],
    ["opponent", normalizeParticipants(value.opponent)],
  ]);
};

export const normalizeClashRoyalePayload = (profile, battlelog, fetchedAt) => {
  if (!isRecord(profile) || !Array.isArray(battlelog)) throw upstreamDataError();
  const tag = normalizeTag(profile.tag);
  if (tag !== CLASH_ROYALE_PLAYER_TAG) throw upstreamDataError();
  const currentDeck = normalizeCards(profile.currentDeck, 8);
  return {
    ok: true,
    player: compact([
      ["tag", tag],
      ["name", requiredText(profile.name)],
      ["trophies", optionalInteger(profile.trophies)],
      ["bestTrophies", optionalInteger(profile.bestTrophies)],
      ["wins", optionalInteger(profile.wins)],
      ["losses", optionalInteger(profile.losses)],
      ["battleCount", optionalInteger(profile.battleCount)],
      ["threeCrownWins", optionalInteger(profile.threeCrownWins)],
      ["clan", normalizeClan(profile.clan)],
      ["arena", normalizeNamedId(profile.arena)],
      ["currentDeck", currentDeck],
    ]),
    battles: battlelog.slice(0, MAX_BATTLES).map(normalizeBattle),
    fetchedAt: new Date(fetchedAt).toISOString(),
    cacheTtlSeconds: CLASH_ROYALE_CACHE_TTL_SECONDS,
  };
};

const cacheStorage = () => {
  try {
    return globalThis.caches?.default || null;
  } catch {
    return null;
  }
};

const cacheKey = (request) => {
  const url = new URL(request.url);
  url.pathname = "/clash-royale";
  url.search = "";
  return new Request(url.toString(), { method: "GET" });
};

const cancelReader = async (reader) => {
  try {
    await reader.cancel();
  } catch {
    // The response may already have been aborted by the request timeout.
  }
};

const readBoundedText = async (response, maxBytes) => {
  const contentLength = Number(response.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw upstreamDataError();
  }
  if (!response.body) throw upstreamDataError();
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await cancelReader(reader);
        throw upstreamDataError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
};

const readBoundedJson = async (response, maxBytes) => {
  try {
    return JSON.parse(await readBoundedText(response, maxBytes));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new HttpError(504, "Clash Royale request timed out", {
        code: "CLASH_ROYALE_TIMEOUT",
      });
    }
    throw upstreamDataError();
  }
};

const retryAfterMs = (value, nowMs) => {
  const seconds = Number(value);
  let delay = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(value) - nowMs;
  if (!Number.isFinite(delay) || delay <= 0) delay = DEFAULT_RATE_LIMIT_RETRY_MS;
  return Math.min(Math.ceil(delay), MAX_RATE_LIMIT_RETRY_MS);
};

const assertUpstreamSuccess = (response, nowMs) => {
  if (response.ok) return;
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(502, "Clash Royale upstream authentication failed", {
      code: "CLASH_ROYALE_UPSTREAM_AUTH",
    });
  }
  if (response.status === 429) {
    throw new HttpError(429, "Clash Royale request limit reached", {
      code: "CLASH_ROYALE_RATE_LIMITED",
      retryAfterMs: retryAfterMs(response.headers.get("Retry-After") || "", nowMs),
    });
  }
  throw new HttpError(502, "Clash Royale data is temporarily unavailable", {
    code: "CLASH_ROYALE_UPSTREAM_ERROR",
  });
};

const fetchUpstream = async (url, token, fetchImpl) => {
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  try {
    return await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      redirect: "manual",
      signal,
    });
  } catch (error) {
    if (signal.aborted || error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new HttpError(504, "Clash Royale request timed out", {
        code: "CLASH_ROYALE_TIMEOUT",
      });
    }
    throw new HttpError(502, "Clash Royale data is temporarily unavailable", {
      code: "CLASH_ROYALE_UPSTREAM_ERROR",
    });
  }
};

const cancelResponseBody = async (response) => {
  if (!response.body) return;
  try {
    await response.body.cancel();
  } catch {
    // A transport failure may already have closed the response body.
  }
};

const cachedPayload = async (cache, key) => {
  if (!cache) return null;
  let response;
  try {
    response = await cache.match(key);
  } catch {
    return null;
  }
  if (!response) return null;
  try {
    const payload = JSON.parse(await readBoundedText(response, MAX_CACHED_PAYLOAD_BYTES));
    if (
      payload?.ok !== true ||
      payload.player?.tag !== CLASH_ROYALE_PLAYER_TAG ||
      !Array.isArray(payload.battles) ||
      payload.cacheTtlSeconds !== CLASH_ROYALE_CACHE_TTL_SECONDS ||
      Number.isNaN(Date.parse(payload.fetchedAt))
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const cachePayload = async (cache, key, payload, context) => {
  if (!cache) return;
  const response = new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `max-age=${CLASH_ROYALE_CACHE_TTL_SECONDS}`,
    },
  });
  const write = cache.put(key, response).catch(() => {});
  if (typeof context?.waitUntil === "function") {
    context.waitUntil(write);
    return;
  }
  await write;
};

export const handleClashRoyaleRequest = async (
  request,
  env,
  context,
  {
    fetchImpl = globalThis.fetch,
    cache = cacheStorage(),
    now = Date.now,
  } = {}
) => {
  const requestUrl = new URL(request.url);
  if (requestUrl.search) {
    throw new HttpError(400, "Query parameters are not supported");
  }
  const token = env.CLASH_ROYALE_API_KEY;
  if (typeof token !== "string" || !token.trim()) {
    throw new HttpError(503, "Clash Royale data is temporarily unavailable", {
      code: "CLASH_ROYALE_NOT_CONFIGURED",
    });
  }
  const key = cacheKey(request);
  const cached = await cachedPayload(cache, key);
  if (cached) return jsonResponse(request, env, cached);

  const fetchedAt = now();
  const [profileResponse, battlelogResponse] = await Promise.all([
    fetchUpstream(PROFILE_URL, token, fetchImpl),
    fetchUpstream(BATTLELOG_URL, token, fetchImpl),
  ]);
  try {
    assertUpstreamSuccess(profileResponse, fetchedAt);
    assertUpstreamSuccess(battlelogResponse, fetchedAt);
  } catch (error) {
    await Promise.all([
      cancelResponseBody(profileResponse),
      cancelResponseBody(battlelogResponse),
    ]);
    throw error;
  }
  const [profile, battlelog] = await Promise.all([
    readBoundedJson(profileResponse, MAX_PROFILE_BYTES),
    readBoundedJson(battlelogResponse, MAX_BATTLELOG_BYTES),
  ]);
  const payload = normalizeClashRoyalePayload(profile, battlelog, fetchedAt);
  await cachePayload(cache, key, payload, context);
  return jsonResponse(request, env, payload);
};
