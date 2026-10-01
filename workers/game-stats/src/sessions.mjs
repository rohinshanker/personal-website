import {
  GAME_STATS_DIFFICULTIES,
  GAME_STATS_SNAKE_BOARD_SIZES,
  GAME_STATS_SUDOKU_DIFFICULTIES,
  MAX_EVENTS_PER_WINDOW,
  MAX_INLINE_SNAKE_ELIGIBILITY_WAIT_MS,
  MAX_RETRY_AFTER_MS,
  MAX_SESSIONS_PER_WINDOW,
  MIN_SNAKE_SESSION_DURATION_MS,
  SESSION_EVENT_START_GRACE_MS,
  SESSION_TTL_MS,
  SNAKE_RESUME_COUNTDOWN_MS,
  SNAKE_TICK_MS,
  MAX_EVENT_FUTURE_MS,
  getGameStatsDatabase,
} from "./constants.mjs";
import {
  INSERT_EVENT_FOR_SESSION_SQL,
  assertAllowedKeys,
  assertStoredEventMatches,
  eventToInsertParams,
  isPlainObject,
  selectEventForPuzzle,
  selectExistingEvent,
} from "./events.mjs";
import { HttpError } from "./http.mjs";
import {
  createSessionToken,
  enforceRateLimit,
  getClientIp,
  hmacDigest,
  requireSecurityConfig,
  verifySessionToken,
  verifyTurnstileIfRequired,
} from "./security.mjs";

const INSERT_SESSION_SQL = `
INSERT INTO game_stat_sessions (
  id, game, config_json, build_version, ip_hash, issued_at, expires_at
) VALUES (?, ?, ?, ?, ?, ?, ?)
`;
const SELECT_SESSION_SQL = `
SELECT id, game, config_json, build_version, ip_hash, issued_at, expires_at, consumed_at
FROM game_stat_sessions
WHERE id = ?
`;
const CONSUME_SESSION_SQL = `
UPDATE game_stat_sessions
SET consumed_at = ?
WHERE id = ? AND consumed_at IS NULL AND expires_at > ?
`;

export const getChanges = (result) => Number(result?.meta?.changes ?? result?.changes ?? 0);

const normalizeSessionConfig = (game, rawConfig) => {
  if (game === "minesweeper") {
    assertAllowedKeys(rawConfig, ["difficulty"], "Minesweeper session config");
    if (typeof rawConfig.difficulty !== "string") {
      throw new HttpError(400, "Minesweeper difficulty must be a string");
    }
    const difficulty = rawConfig.difficulty.trim();
    if (!GAME_STATS_DIFFICULTIES.includes(difficulty)) {
      throw new HttpError(400, "Invalid Minesweeper session config");
    }
    return { difficulty };
  }
  if (game === "solitaire") {
    assertAllowedKeys(rawConfig, [], "Solitaire session config");
    return {};
  }
  if (game === "snake") {
    assertAllowedKeys(rawConfig, ["boardSize"], "Snake session config");
    if (typeof rawConfig.boardSize !== "string") {
      throw new HttpError(400, "Snake board size must be a string");
    }
    const boardSize = rawConfig.boardSize.trim();
    if (!GAME_STATS_SNAKE_BOARD_SIZES.includes(boardSize)) {
      throw new HttpError(400, "Invalid Snake session config");
    }
    return { boardSize };
  }
  if (game === "sudoku") {
    assertAllowedKeys(rawConfig, ["difficulty"], "Sudoku session config");
    if (typeof rawConfig.difficulty !== "string") {
      throw new HttpError(400, "Sudoku difficulty must be a string");
    }
    const difficulty = rawConfig.difficulty.trim();
    if (!GAME_STATS_SUDOKU_DIFFICULTIES.includes(difficulty)) {
      throw new HttpError(400, "Invalid Sudoku session config");
    }
    return { difficulty };
  }
  throw new HttpError(400, "Unsupported game");
};

const sessionConfigMatchesEvent = (config, event) => {
  if (event.game === "minesweeper" || event.game === "sudoku") {
    return config.difficulty === event.difficulty;
  }
  if (event.game === "snake") return config.boardSize === event.boardSize;
  return event.game === "solitaire";
};

const minimumSessionDurationMs = (event) => {
  if (event.game === "minesweeper") return 3 * 1000;
  if (event.game === "solitaire") return 8 * 1000;
  if (event.game === "snake") {
    return Math.max(
      MIN_SNAKE_SESSION_DURATION_MS,
      SNAKE_RESUME_COUNTDOWN_MS + event.metric * SNAKE_TICK_MS
    );
  }
  return 10 * 1000;
};

const waitForSnakeEligibility = async (delayMs) => {
  if (
    !Number.isSafeInteger(delayMs) ||
    delayMs < 1 ||
    delayMs > MAX_INLINE_SNAKE_ELIGIBILITY_WAIT_MS
  ) {
    throw new HttpError(500, "Invalid Snake eligibility delay");
  }
  if (typeof globalThis.scheduler?.wait === "function") {
    await globalThis.scheduler.wait(delayMs);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const requireSessionEligibility = async (event, sessionIssuedAt) => {
  const minimumDurationMs = minimumSessionDurationMs(event);
  const eligibleAt = sessionIssuedAt + minimumDurationMs;
  const elapsedMs = Date.now() - sessionIssuedAt;
  if (elapsedMs >= minimumDurationMs) return;
  if (event.game !== "snake") {
    throw new HttpError(400, "Game result was completed too quickly");
  }
  const remainingMs = Math.ceil(minimumDurationMs - elapsedMs);
  if (remainingMs <= MAX_INLINE_SNAKE_ELIGIBILITY_WAIT_MS) {
    await waitForSnakeEligibility(remainingMs);
    const remainingAfterWaitMs = Math.ceil(eligibleAt - Date.now());
    if (remainingAfterWaitMs <= 0) return;
    throw new HttpError(425, "Snake result is not eligible yet", {
      retryAfterMs: Math.min(remainingAfterWaitMs, MAX_RETRY_AFTER_MS),
    });
  }
  throw new HttpError(425, "Snake result is not eligible yet", {
    retryAfterMs: Math.min(remainingMs, MAX_RETRY_AFTER_MS),
  });
};

export const createSession = async (request, env, rawPayload) => {
  assertAllowedKeys(
    rawPayload,
    ["game", "config", "buildVersion", "turnstileToken"],
    "session request"
  );
  const security = requireSecurityConfig(env);
  if (typeof rawPayload.game !== "string") {
    throw new HttpError(400, "Session game must be a string");
  }
  if (typeof rawPayload.buildVersion !== "string") {
    throw new HttpError(400, "Game build version must be a string");
  }
  const game = rawPayload.game.trim();
  const buildVersion = rawPayload.buildVersion.trim();
  if (!security.acceptedBuildVersions.includes(buildVersion)) {
    throw new HttpError(409, "Game build version is not compatible");
  }
  const config = normalizeSessionConfig(game, rawPayload.config);
  await verifyTurnstileIfRequired(request, env, rawPayload);
  const ipHash = await hmacDigest(security.ipHashSecret, getClientIp(request));
  await enforceRateLimit(env, ipHash, "sessions", MAX_SESSIONS_PER_WINDOW);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_MS);
  const session = {
    id: crypto.randomUUID(),
    game,
    config,
    buildVersion,
    ipHash,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  await getGameStatsDatabase(env)
    .prepare(INSERT_SESSION_SQL)
    .bind(
      session.id,
      session.game,
      JSON.stringify(session.config),
      session.buildVersion,
      session.ipHash,
      session.issuedAt,
      session.expiresAt
    )
    .run();
  return {
    id: session.id,
    token: await createSessionToken(security.signingSecret, session),
    expiresAt: session.expiresAt,
  };
};

export const validateSession = async (request, env, event, rawSession) => {
  assertAllowedKeys(rawSession, ["id", "token"], "session proof");
  const security = requireSecurityConfig(env);
  const sessionId = String(rawSession.id || "").trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(sessionId)) {
    throw new HttpError(400, "Invalid session id");
  }
  const tokenPayload = await verifySessionToken(security.signingSecret, rawSession.token);
  const ipHash = await hmacDigest(security.ipHashSecret, getClientIp(request));
  if (
    tokenPayload.id !== sessionId ||
    tokenPayload.game !== event.game ||
    typeof tokenPayload.ipHash !== "string" ||
    !isPlainObject(tokenPayload.config)
  ) {
    throw new HttpError(403, "Session proof does not match this result");
  }
  const session = await getGameStatsDatabase(env).prepare(SELECT_SESSION_SQL).bind(sessionId).first();
  if (!session) throw new HttpError(409, "Game session is no longer on record");
  if (
    session.game !== event.game ||
    session.build_version !== tokenPayload.buildVersion ||
    session.ip_hash !== tokenPayload.ipHash ||
    session.config_json !== JSON.stringify(tokenPayload.config) ||
    session.issued_at !== tokenPayload.issuedAt ||
    session.expires_at !== tokenPayload.expiresAt ||
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    throw new HttpError(403, "Stored game session does not match this result");
  }
  if (!sessionConfigMatchesEvent(tokenPayload.config, event)) {
    throw new HttpError(400, "Game result does not match the started game");
  }
  const eventTime = new Date(event.occurredAt).getTime();
  const sessionIssuedAt = new Date(session.issued_at).getTime();
  if (
    eventTime < sessionIssuedAt - SESSION_EVENT_START_GRACE_MS ||
    eventTime > Date.now() + MAX_EVENT_FUTURE_MS
  ) {
    throw new HttpError(400, "Game result is outside its session window");
  }
  await requireSessionEligibility(event, sessionIssuedAt);
  await enforceRateLimit(env, ipHash, "events", MAX_EVENTS_PER_WINDOW);
  if (session.consumed_at) {
    const existing = await selectExistingEvent(env, event.id);
    if (existing) {
      assertStoredEventMatches(existing, event);
      return null;
    }
    if (await selectEventForPuzzle(env, event)) return null;
    throw new HttpError(409, "Game session was already used");
  }
  return sessionId;
};

export const consumeGameStatsSession = (env, sessionId) => {
  const consumedAt = new Date().toISOString();
  return getGameStatsDatabase(env)
    .prepare(CONSUME_SESSION_SQL)
    .bind(consumedAt, sessionId, consumedAt)
    .run();
};

export const consumeSessionAndStoreEvent = async (env, sessionId, event) => {
  const database = getGameStatsDatabase(env);
  const consumedAt = new Date().toISOString();
  let results;
  try {
    results = await database.batch([
      database
        .prepare(INSERT_EVENT_FOR_SESSION_SQL)
        .bind(...eventToInsertParams(event), sessionId, consumedAt),
      database.prepare(CONSUME_SESSION_SQL).bind(consumedAt, sessionId, consumedAt),
    ]);
  } catch (error) {
    const existing = await selectExistingEvent(env, event.id);
    if (existing) {
      assertStoredEventMatches(existing, event);
      return { applied: false, eventId: existing.id };
    }
    const recorded = await selectEventForPuzzle(env, event);
    if (recorded) {
      await consumeGameStatsSession(env, sessionId);
      return { applied: false, eventId: recorded.id };
    }
    throw error;
  }
  const [inserted, consumed] = results;
  if (!getChanges(inserted) || !getChanges(consumed)) {
    const existing = await selectExistingEvent(env, event.id);
    if (existing) {
      assertStoredEventMatches(existing, event);
      return { applied: false, eventId: existing.id };
    }
    const recorded = await selectEventForPuzzle(env, event);
    if (recorded) return { applied: false, eventId: recorded.id };
    throw new HttpError(409, "Game session was already used");
  }
  return { applied: true, eventId: event.id };
};
