import {
  MAX_EVENT_BODY_BYTES,
  MAX_PENDING_EVENT_ACKNOWLEDGMENTS,
  MAX_RETRY_AFTER_MS,
  STATS_API_PROTOCOL,
  STATS_CACHE_TTL_SECONDS,
} from "./constants.mjs";

export class HttpError extends Error {
  constructor(status, message, { retryAfterMs = 0, code = "" } = {}) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.code = code;
  }
}

const normalizeOrigin = (origin) => {
  if (!origin) return "";
  try {
    return new URL(origin).origin;
  } catch {
    return "";
  }
};

const splitOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean);

const allowedOrigins = (env) =>
  new Set([
    ...splitOrigins(env.ALLOWED_ORIGIN),
    ...splitOrigins(env.LOCAL_ALLOWED_ORIGIN),
    ...splitOrigins(env.EXTRA_ALLOWED_ORIGINS),
  ]);

export const allowedCorsOrigin = (request, env) => {
  const requestOrigin = normalizeOrigin(request.headers.get("Origin"));
  return requestOrigin && allowedOrigins(env).has(requestOrigin) ? requestOrigin : "";
};

export const corsHeaders = (request, env) => {
  const origin = allowedCorsOrigin(request, env);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

export const assertOriginAllowed = (request, env) => {
  if (request.headers.get("Origin") && !allowedCorsOrigin(request, env)) {
    throw new HttpError(403, "Origin is not allowed");
  }
};

export const assertBrowserOriginAllowed = (request, env) => {
  if (!allowedCorsOrigin(request, env)) throw new HttpError(403, "Origin is not allowed");
};

export const jsonResponse = (request, env, body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
      ...extraHeaders,
    },
  });

const textDecoder = new TextDecoder();

export const readJsonBody = async (request, maximumBytes = MAX_EVENT_BODY_BYTES) => {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new HttpError(500, "Invalid request body limit");
  }
  if (contentLength > maximumBytes) {
    throw new HttpError(413, "Request body is too large");
  }
  const chunks = [];
  let receivedBytes = 0;
  const reader = request.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
        if (receivedBytes > maximumBytes) {
          await reader.cancel("Request body is too large");
          throw new HttpError(413, "Request body is too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const body = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(textDecoder.decode(body));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
};

const normalizeEventId = (value) => {
  const id = String(value || "").trim();
  if (!/^[a-z0-9-]{8,80}$/.test(id)) {
    throw new HttpError(400, "Invalid pending event id");
  }
  return id;
};

export const readStatsRequest = (request) => {
  const url = new URL(request.url);
  const protocol = url.searchParams.get("protocol") || "1";
  if (!new Set(["1", STATS_API_PROTOCOL]).has(protocol)) {
    throw new HttpError(400, "Unsupported stats protocol");
  }
  const playerId = String(url.searchParams.get("playerId") || "").trim();
  if (playerId && !/^[a-z0-9-]{8,80}$/.test(playerId)) {
    throw new HttpError(400, "Invalid stats player id");
  }
  const rawPendingIds = url.searchParams.getAll("pendingEventId");
  if (rawPendingIds.length > MAX_PENDING_EVENT_ACKNOWLEDGMENTS) {
    throw new HttpError(400, "Too many pending event ids");
  }
  if (protocol !== STATS_API_PROTOCOL && rawPendingIds.length) {
    throw new HttpError(400, "Pending acknowledgments require stats protocol 2");
  }
  const pendingEventIds = [...new Set(rawPendingIds.map(normalizeEventId))];
  const freshValue = url.searchParams.get("fresh");
  if (freshValue !== null && freshValue !== "1") {
    throw new HttpError(400, "Invalid fresh stats option");
  }
  return Object.freeze({
    protocol,
    playerId,
    pendingEventIds,
    fresh: freshValue === "1",
  });
};

const cacheStorage = () => {
  try {
    return globalThis.caches?.default || null;
  } catch {
    return null;
  }
};

export const statsCacheKey = (request, { protocol, playerId }) => {
  const url = new URL(request.url);
  url.pathname = "/stats";
  url.search = "";
  url.searchParams.set("protocol", protocol);
  if (playerId) url.searchParams.set("playerId", playerId);
  return new Request(url.toString(), { method: "GET" });
};

export const readStatsCache = async (key) => {
  const cache = cacheStorage();
  if (!cache) return null;
  try {
    const cached = await cache.match(key);
    return cached ? await cached.text() : null;
  } catch {
    return null;
  }
};

export const writeStatsCache = async (key, body, context) => {
  const cache = cacheStorage();
  if (!cache) return;
  const response = new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `max-age=${STATS_CACHE_TTL_SECONDS}`,
    },
  });
  const write = cache.put(key, response).catch(() => {});
  if (typeof context?.waitUntil === "function") {
    context.waitUntil(write);
    return;
  }
  await write;
};

export const statsJsonResponse = (request, env, serializedBody) =>
  new Response(serializedBody, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
    },
  });

export const errorResponse = (request, env, error) => {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : "Internal server error";
  const retryAfterMs =
    error instanceof HttpError && Number.isSafeInteger(error.retryAfterMs)
      ? Math.max(0, Math.min(error.retryAfterMs, MAX_RETRY_AFTER_MS))
      : 0;
  const code = error instanceof HttpError && error.code ? error.code : "";
  return jsonResponse(
    request,
    env,
    {
      ok: false,
      error: message,
      ...(code ? { code } : {}),
      ...(retryAfterMs ? { retryAfterMs } : {}),
    },
    status,
    retryAfterMs
      ? {
          "Access-Control-Expose-Headers": "Retry-After",
          "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
        }
      : {}
  );
};
