import { selectAggregatedGameStats } from "./aggregate.mjs";
import {
  STATS_API_PROTOCOL,
  getGameStatsDatabase,
} from "./constants.mjs";
import {
  assertAllowedKeys,
  assertStoredEventMatches,
  normalizeGameStatsEvent,
  selectEventForPuzzle,
  selectExistingEvent,
} from "./events.mjs";
import {
  HttpError,
  assertBrowserOriginAllowed,
  assertOriginAllowed,
  corsHeaders,
  errorResponse,
  jsonResponse,
  readJsonBody,
  readStatsCache,
  readStatsRequest,
  statsCacheKey,
  statsJsonResponse,
  writeStatsCache,
} from "./http.mjs";
import {
  createAdministratorSignIn,
  requireSecurityConfig,
  validateAdministratorEventProof,
} from "./security.mjs";
import {
  consumeGameStatsSession,
  consumeSessionAndStoreEvent,
  createSession,
  getChanges,
  validateSession,
} from "./sessions.mjs";

const HEALTH_CHECK_SQL = `
SELECT COUNT(*) AS table_count
FROM sqlite_master
WHERE type = 'table'
  AND name IN ('game_events', 'game_stat_sessions', 'game_stats_rate_limits')
`;
const DELETE_EXPIRED_SESSIONS_SQL = `
DELETE FROM game_stat_sessions
WHERE expires_at <= ?
`;
const DELETE_EXPIRED_RATE_LIMITS_SQL = `
DELETE FROM game_stats_rate_limits
WHERE expires_at <= ?
`;

const handleOptions = (request, env) => {
  assertOriginAllowed(request, env);
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
};

const handleGetStats = async (request, env, context) => {
  const statsRequest = readStatsRequest(request);
  const modern = statsRequest.protocol === STATS_API_PROTOCOL;
  const cacheReadable =
    modern &&
    !statsRequest.fresh &&
    statsRequest.pendingEventIds.length === 0;
  const cacheKey = modern ? statsCacheKey(request, statsRequest) : null;
  if (cacheReadable) {
    const cachedBody = await readStatsCache(cacheKey);
    if (cachedBody !== null) return statsJsonResponse(request, env, cachedBody);
  }
  const stats = await selectAggregatedGameStats(env, statsRequest);
  const serializedBody = JSON.stringify(stats);
  if (cacheKey) {
    const cacheBody = statsRequest.pendingEventIds.length
      ? JSON.stringify({ ...stats, acknowledgedEventIds: [] })
      : serializedBody;
    await writeStatsCache(cacheKey, cacheBody, context);
  }
  return statsJsonResponse(request, env, serializedBody);
};

const handleGetHealth = async (request, env) => {
  const health = await getGameStatsDatabase(env).prepare(HEALTH_CHECK_SQL).first();
  if (Number(health?.table_count) !== 3) {
    throw new HttpError(500, "D1 health check failed");
  }
  const { buildVersion, acceptedBuildVersions } = requireSecurityConfig(env);
  return jsonResponse(request, env, { ok: true, buildVersion, acceptedBuildVersions });
};

const handlePostSession = async (request, env) => {
  assertBrowserOriginAllowed(request, env);
  const session = await createSession(request, env, await readJsonBody(request));
  return jsonResponse(request, env, { ok: true, ...session }, 201);
};

const handlePostAdministratorSignIn = async (request, env) => {
  assertBrowserOriginAllowed(request, env);
  const result = await createAdministratorSignIn(request, env, await readJsonBody(request));
  return jsonResponse(request, env, result);
};

const handlePostEvent = async (request, env) => {
  assertBrowserOriginAllowed(request, env);
  const payload = await readJsonBody(request);
  assertAllowedKeys(payload, ["event", "session"], "event request");
  const event = normalizeGameStatsEvent(payload.event);
  await validateAdministratorEventProof(request, env, event);
  const existing = await selectExistingEvent(env, event.id);
  if (existing) {
    assertStoredEventMatches(existing, event);
    return jsonResponse(request, env, { ok: true, applied: false, eventId: event.id });
  }
  const sessionId = await validateSession(request, env, event, payload.session);
  const recordedForPuzzle = await selectEventForPuzzle(env, event);
  if (recordedForPuzzle) {
    if (sessionId) await consumeGameStatsSession(env, sessionId);
    return jsonResponse(request, env, {
      ok: true,
      applied: false,
      eventId: recordedForPuzzle.id,
    });
  }
  const { applied, eventId } = sessionId
    ? await consumeSessionAndStoreEvent(env, sessionId, event)
    : { applied: false, eventId: event.id };
  return jsonResponse(request, env, { ok: true, applied, eventId }, applied ? 201 : 200);
};

export const handleRequest = async (request, env, context) => {
  try {
    if (!getGameStatsDatabase(env)) {
      throw new HttpError(500, "D1 database binding is not configured");
    }
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return handleOptions(request, env);
    if (url.pathname === "/health" && request.method === "GET") {
      return await handleGetHealth(request, env);
    }
    if (url.pathname === "/stats" && request.method === "GET") {
      return await handleGetStats(request, env, context);
    }
    if (url.pathname === "/sessions" && request.method === "POST") {
      return await handlePostSession(request, env);
    }
    if (url.pathname === "/administrator/sign-in" && request.method === "POST") {
      return await handlePostAdministratorSignIn(request, env);
    }
    if (url.pathname === "/events" && request.method === "POST") {
      return await handlePostEvent(request, env);
    }
    if (["/stats", "/sessions", "/events", "/administrator/sign-in"].includes(url.pathname)) {
      throw new HttpError(405, "Method is not allowed");
    }
    throw new HttpError(404, "Route not found");
  } catch (error) {
    return errorResponse(request, env, error);
  }
};

export const purgeExpiredGameStatsRows = async (env) => {
  const database = getGameStatsDatabase(env);
  if (!database) throw new Error("D1 database binding is not configured");
  const purgedAt = new Date().toISOString();
  const [expiredSessions, expiredRateLimits] = await database.batch([
    database.prepare(DELETE_EXPIRED_SESSIONS_SQL).bind(purgedAt),
    database.prepare(DELETE_EXPIRED_RATE_LIMITS_SQL).bind(purgedAt),
  ]);
  return Object.freeze({
    purgedAt,
    expiredSessions: getChanges(expiredSessions),
    expiredRateLimitBuckets: getChanges(expiredRateLimits),
  });
};

export const scheduled = async (_controller, env) => {
  const summary = await purgeExpiredGameStatsRows(env);
  console.log(
    `Purged ${summary.expiredSessions} expired game sessions and ` +
      `${summary.expiredRateLimitBuckets} rate-limit buckets at ${summary.purgedAt}.`
  );
};
