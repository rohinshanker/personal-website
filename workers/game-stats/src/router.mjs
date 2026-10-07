import { selectAggregatedGameStats } from "./aggregate.mjs";
import { handleClashRoyaleRequest } from "./clash-royale.mjs";
import {
  MAX_REPLAY_BODY_BYTES,
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
  readJsonBodyWithMetadata,
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
import {
  continueVerifiedSession,
  finishVerifiedSession,
  publishVerifiedCompletion,
  restoreVerifiedSession,
  updateVerifiedTiming,
} from "./verified-results.mjs";

const HEALTH_CHECK_SQL = `
SELECT COUNT(*) AS table_count
FROM sqlite_master
WHERE type = 'table'
  AND name IN (
    'game_events', 'game_stat_sessions', 'game_stats_rate_limits',
    'verified_timing_transitions', 'verified_game_completions',
    'verified_completion_jobs', 'verified_completion_progress',
    'verified_completion_replay_chunks'
  )
`;
const DELETE_EXPIRED_SESSIONS_SQL = `
DELETE FROM game_stat_sessions
WHERE expires_at <= ?
`;
const DELETE_EXPIRED_TIMING_TRANSITIONS_SQL = `
DELETE FROM verified_timing_transitions
WHERE session_id IN (
  SELECT id FROM game_stat_sessions WHERE expires_at <= ?
)
`;
const DELETE_EXPIRED_COMPLETION_PROGRESS_SQL = `
DELETE FROM verified_completion_progress
WHERE job_id IN (
  SELECT id FROM verified_completion_jobs WHERE expires_at <= ?
)
`;
const DELETE_EXPIRED_COMPLETION_REPLAY_CHUNKS_SQL = `
DELETE FROM verified_completion_replay_chunks
WHERE job_id IN (
  SELECT id FROM verified_completion_jobs WHERE expires_at <= ?
)
`;
const DELETE_EXPIRED_COMPLETION_JOBS_SQL = `
DELETE FROM verified_completion_jobs
WHERE expires_at <= ?
`;
const DELETE_EXPIRED_UNPUBLISHED_COMPLETIONS_SQL = `
DELETE FROM verified_game_completions
WHERE expires_at <= ? AND published_event_id IS NULL
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
  if (Number(health?.table_count) !== 8) {
    throw new HttpError(500, "D1 health check failed");
  }
  const { buildVersion, acceptedBuildVersions } = requireSecurityConfig(env);
  return jsonResponse(request, env, { ok: true, buildVersion, acceptedBuildVersions });
};

const readReplayRequest = async (read) => {
  try {
    return await read();
  } catch (error) {
    if (error instanceof HttpError && error.status === 413) {
      throw new HttpError(413, error.message, { code: "replay-limit" });
    }
    throw error;
  }
};

const handlePostSession = async (request, env, dependencies) => {
  assertBrowserOriginAllowed(request, env);
  const session = await createSession(
    request,
    env,
    await readJsonBody(request),
    dependencies.verification || {}
  );
  return jsonResponse(request, env, { ok: true, ...session }, 201);
};

const handlePostTiming = async (request, env, sessionId, dependencies) => {
  assertBrowserOriginAllowed(request, env);
  const timing = await updateVerifiedTiming(
    request,
    env,
    sessionId,
    await readJsonBody(request),
    dependencies.verification || {}
  );
  return jsonResponse(request, env, { ok: true, timing });
};

const handlePostFinish = async (request, env, sessionId, dependencies) => {
  assertBrowserOriginAllowed(request, env);
  const verification = dependencies.verification || {};
  const body = await readReplayRequest(
    () => readJsonBodyWithMetadata(
      request,
      MAX_REPLAY_BODY_BYTES,
      verification.now || Date.now
    )
  );
  const result = await finishVerifiedSession(
    request,
    env,
    sessionId,
    body.value,
    verification,
    { transcriptJson: body.text, finishedAt: body.receivedAt }
  );
  return jsonResponse(request, env, { ok: true, ...result }, result.progress ? 202 : 200);
};

const handlePostFinishContinue = async (request, env, sessionId, dependencies) => {
  assertBrowserOriginAllowed(request, env);
  const result = await continueVerifiedSession(
    request,
    env,
    sessionId,
    await readReplayRequest(() => readJsonBody(request)),
    dependencies.verification || {}
  );
  return jsonResponse(request, env, { ok: true, ...result }, result.progress ? 202 : 200);
};

const handlePostRestore = async (request, env, sessionId) => {
  assertBrowserOriginAllowed(request, env);
  const descriptor = await restoreVerifiedSession(
    request,
    env,
    sessionId,
    await readJsonBody(request)
  );
  return jsonResponse(request, env, { ok: true, ...descriptor });
};

const handlePostAdministratorSignIn = async (request, env) => {
  assertBrowserOriginAllowed(request, env);
  const result = await createAdministratorSignIn(request, env, await readJsonBody(request));
  return jsonResponse(request, env, result);
};

const handlePostEvent = async (request, env) => {
  assertBrowserOriginAllowed(request, env);
  const payload = await readJsonBody(request);
  assertAllowedKeys(payload, ["event", "session", "completion"], "event request");
  if (Boolean(payload.session) === Boolean(payload.completion)) {
    throw new HttpError(400, "Event request requires exactly one result proof");
  }
  const event = normalizeGameStatsEvent(payload.event);
  await validateAdministratorEventProof(request, env, event);
  if (payload.completion) {
    const { applied, eventId } = await publishVerifiedCompletion(
      request,
      env,
      payload.event,
      payload.completion
    );
    return jsonResponse(request, env, { ok: true, applied, eventId }, applied ? 201 : 200);
  }
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

export const handleRequest = async (request, env, context, dependencies = {}) => {
  try {
    const url = new URL(request.url);
    if (url.pathname === "/clash-royale") {
      if (request.method === "OPTIONS") return handleOptions(request, env);
      if (request.method === "GET") {
        return await handleClashRoyaleRequest(
          request,
          env,
          context,
          dependencies.clashRoyale
        );
      }
      throw new HttpError(405, "Method is not allowed");
    }
    if (!getGameStatsDatabase(env)) {
      throw new HttpError(500, "D1 database binding is not configured");
    }
    if (request.method === "OPTIONS") return handleOptions(request, env);
    if (url.pathname === "/health" && request.method === "GET") {
      return await handleGetHealth(request, env);
    }
    if (url.pathname === "/stats" && request.method === "GET") {
      return await handleGetStats(request, env, context);
    }
    if (url.pathname === "/sessions" && request.method === "POST") {
      return await handlePostSession(request, env, dependencies);
    }
    const timingMatch = /^\/sessions\/([A-Za-z0-9-]{8,80})\/timing$/.exec(url.pathname);
    if (timingMatch && request.method === "POST") {
      return await handlePostTiming(request, env, timingMatch[1], dependencies);
    }
    const finishMatch = /^\/sessions\/([A-Za-z0-9-]{8,80})\/finish$/.exec(url.pathname);
    if (finishMatch && request.method === "POST") {
      return await handlePostFinish(request, env, finishMatch[1], dependencies);
    }
    const finishContinueMatch =
      /^\/sessions\/([A-Za-z0-9-]{8,80})\/finish\/continue$/.exec(url.pathname);
    if (finishContinueMatch && request.method === "POST") {
      return await handlePostFinishContinue(
        request,
        env,
        finishContinueMatch[1],
        dependencies
      );
    }
    const restoreMatch = /^\/sessions\/([A-Za-z0-9-]{8,80})\/restore$/.exec(url.pathname);
    if (restoreMatch && request.method === "POST") {
      return await handlePostRestore(request, env, restoreMatch[1]);
    }
    if (url.pathname === "/administrator/sign-in" && request.method === "POST") {
      return await handlePostAdministratorSignIn(request, env);
    }
    if (url.pathname === "/events" && request.method === "POST") {
      return await handlePostEvent(request, env);
    }
    if (
      ["/stats", "/sessions", "/events", "/administrator/sign-in"].includes(url.pathname) ||
      timingMatch || finishMatch || finishContinueMatch || restoreMatch
    ) {
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
  const [
    expiredTimingTransitions,
    expiredCompletionReplayChunks,
    expiredCompletionProgress,
    expiredCompletionJobs,
    expiredUnpublishedCompletions,
    expiredSessions,
    expiredRateLimits,
  ] = await database.batch([
    database.prepare(DELETE_EXPIRED_TIMING_TRANSITIONS_SQL).bind(purgedAt),
    database.prepare(DELETE_EXPIRED_COMPLETION_REPLAY_CHUNKS_SQL).bind(purgedAt),
    database.prepare(DELETE_EXPIRED_COMPLETION_PROGRESS_SQL).bind(purgedAt),
    database.prepare(DELETE_EXPIRED_COMPLETION_JOBS_SQL).bind(purgedAt),
    database.prepare(DELETE_EXPIRED_UNPUBLISHED_COMPLETIONS_SQL).bind(purgedAt),
    database.prepare(DELETE_EXPIRED_SESSIONS_SQL).bind(purgedAt),
    database.prepare(DELETE_EXPIRED_RATE_LIMITS_SQL).bind(purgedAt),
  ]);
  return Object.freeze({
    purgedAt,
    expiredTimingTransitions: getChanges(expiredTimingTransitions),
    expiredCompletionReplayChunks: getChanges(expiredCompletionReplayChunks),
    expiredCompletionProgress: getChanges(expiredCompletionProgress),
    expiredCompletionJobs: getChanges(expiredCompletionJobs),
    expiredUnpublishedCompletions: getChanges(expiredUnpublishedCompletions),
    expiredSessions: getChanges(expiredSessions),
    expiredRateLimitBuckets: getChanges(expiredRateLimits),
  });
};

export const scheduled = async (_controller, env) => {
  const summary = await purgeExpiredGameStatsRows(env);
  console.log(
    `Purged ${summary.expiredSessions} expired game sessions and ` +
      `${summary.expiredUnpublishedCompletions} unpublished completions and ` +
      `${summary.expiredRateLimitBuckets} rate-limit buckets at ${summary.purgedAt}.`
  );
};
