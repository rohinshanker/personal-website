import "../../../scripts/home/games/rules.js";

import {
  MAX_EVENTS_PER_WINDOW,
  MAX_REPLAY_BODY_BYTES,
  MAX_SESSIONS_PER_WINDOW,
  MAX_VERIFICATION_ATTEMPTS_PER_WINDOW,
  SNAKE_RESUME_COUNTDOWN_MS,
  SNAKE_TICK_MS,
  getGameStatsDatabase,
} from "./constants.mjs";
import {
  assertAllowedKeys,
  assertStoredEventMatches,
  eventToInsertParams,
  normalizeGameStatsEvent,
  puzzleKeyOf,
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

const commonRules = globalThis.homeGameRules;
const VERSION_FIELDS = Object.freeze({
  resultProtocol: commonRules.RESULT_PROTOCOL,
  rulesVersion: commonRules.RULES_VERSION,
  replayVersion: commonRules.REPLAY_VERSION,
  generatorVersion: commonRules.GENERATOR_VERSION,
});
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{8,80}$/;
const ENGINE_GLOBALS = Object.freeze({
  minesweeper: "homeMinesweeperRules",
  solitaire: "homeSolitaireRules",
  snake: "homeSnakeRules",
  sudoku: "homeSudokuRules",
});

const INSERT_VERIFIED_SESSION_SQL = `
INSERT INTO game_stat_sessions (
  id, game, config_json, build_version, ip_hash, issued_at, expires_at,
  result_protocol, rules_version, replay_version, generator_version,
  initial_json, initial_commitment, scope_digest, timing_revision,
  timing_phase, timing_elapsed_ms, timing_updated_at, timing_input_count,
  timing_input_hash
) VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?, ?, ?, ?, ?, 0, 'ready', 0, ?, 0, ?)
`;
const SELECT_VERIFIED_SESSION_SQL = `
SELECT id, game, config_json, build_version, ip_hash, issued_at, expires_at,
  consumed_at, result_protocol, rules_version, replay_version,
  generator_version, initial_json, initial_commitment, scope_digest,
  timing_revision, timing_phase, timing_elapsed_ms, timing_updated_at,
  timing_input_count, timing_input_hash, timing_request_digest, completion_id
FROM game_stat_sessions
WHERE id = ?
`;
const SELECT_TIMING_TRANSITIONS_SQL = `
SELECT revision, operation, request_digest, input_count, input_hash, phase,
  elapsed_ms, observed_at
FROM verified_timing_transitions
WHERE session_id = ?
ORDER BY revision
`;
const UPDATE_TIMING_SQL = `
UPDATE game_stat_sessions
SET timing_revision = ?, timing_phase = ?, timing_elapsed_ms = ?,
  timing_updated_at = ?, timing_input_count = ?, timing_input_hash = ?,
  timing_request_digest = ?
WHERE id = ? AND result_protocol = 2 AND consumed_at IS NULL
  AND expires_at > ? AND timing_revision = ? AND timing_phase = ?
  AND timing_input_count <= ?
`;
const INSERT_TIMING_TRANSITION_SQL = `
INSERT INTO verified_timing_transitions (
  session_id, revision, operation, request_digest, input_count, input_hash,
  phase, elapsed_ms, observed_at
)
SELECT id, ?, ?, ?, ?, ?, ?, ?, ?
FROM game_stat_sessions
WHERE id = ? AND timing_revision = ? AND timing_request_digest = ?
`;
const SELECT_COMPLETION_BY_SESSION_SQL = `
SELECT id, session_id, event_id, request_digest, receipt_token, game, type, difficulty,
  board_size, hint_bucket, metric, metric_kind, puzzle_key,
  initial_commitment, replay_digest, timing_revision, elapsed_ms, finished_at, expires_at,
  published_event_id, publication_digest
FROM verified_game_completions
WHERE session_id = ?
`;
const SELECT_COMPLETION_SQL = `
SELECT id, session_id, event_id, request_digest, receipt_token, game, type, difficulty,
  board_size, hint_bucket, metric, metric_kind, puzzle_key,
  initial_commitment, replay_digest, timing_revision, elapsed_ms, finished_at, expires_at,
  published_event_id, publication_digest
FROM verified_game_completions
WHERE id = ?
`;
const SELECT_COMPLETION_BY_EVENT_SQL = `
SELECT id, session_id, event_id, request_digest
FROM verified_game_completions
WHERE event_id = ?
`;
const CONSUME_VERIFIED_SESSION_SQL = `
UPDATE game_stat_sessions
SET consumed_at = ?, completion_id = ?, timing_phase = 'finished',
  timing_elapsed_ms = ?, timing_updated_at = ?
WHERE id = ? AND result_protocol = 2 AND consumed_at IS NULL
  AND expires_at > ? AND rules_version = ? AND replay_version = ?
  AND generator_version = ? AND initial_commitment = ? AND scope_digest = ?
  AND timing_revision = ? AND timing_phase = 'running'
`;
const INSERT_COMPLETION_SQL = `
INSERT INTO verified_game_completions (
  id, session_id, event_id, request_digest, receipt_token, game, type, difficulty,
  board_size, hint_bucket, metric, metric_kind, puzzle_key,
  initial_commitment, replay_digest, timing_revision, elapsed_ms, finished_at, expires_at
)
SELECT ?, id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
FROM game_stat_sessions
WHERE id = ? AND completion_id = ? AND consumed_at = ?
`;
const BIND_COMPLETION_SQL = `
UPDATE verified_game_completions
SET published_event_id = ?, publication_digest = ?
WHERE id = ? AND event_id = ? AND published_event_id IS NULL
`;
const INSERT_VERIFIED_EVENT_SQL = `
INSERT INTO game_events (
  id, game, type, difficulty, board_size, hint_bucket, metric, metric_kind,
  player_id, player_name, player_icon, occurred_at, puzzle_key,
  schema_version, provenance, completion_id
)
SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2, 'verified', ?
FROM verified_game_completions
WHERE id = ? AND published_event_id = ? AND publication_digest = ?
`;
const SELECT_EVENT_COMPLETION_SQL = `
SELECT completion_id FROM game_events WHERE id = ?
`;

const getChanges = (result) => Number(result?.meta?.changes ?? result?.changes ?? 0);
const nowDate = (dependencies) => new Date((dependencies.now || Date.now)());
const newId = (dependencies) => dependencies.randomUUID
  ? dependencies.randomUUID()
  : crypto.randomUUID();

export const digestCanonical = async (value) =>
  Array.from(new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(commonRules.canonicalJson(value))
  )), (byte) => byte.toString(16).padStart(2, "0")).join("");

export const replayPrefixHash = (inputs, count) => {
  commonRules.assertReplay(inputs);
  commonRules.assertInteger(count, 0, inputs.length, "replay prefix count");
  return digestCanonical(inputs.slice(0, count));
};

const parseJsonColumn = (value, label) => {
  try {
    return JSON.parse(value);
  } catch {
    throw new HttpError(500, `Stored ${label} is invalid`);
  }
};

const resolveEngine = (game, dependencies) => {
  const engine = dependencies.gameEngines?.[game] || globalThis[ENGINE_GLOBALS[game]];
  if (!engine || typeof engine.initial !== "function" ||
      typeof engine.transition !== "function" || typeof engine.result !== "function") {
    throw new HttpError(503, `Verified ${game} rules are unavailable`);
  }
  return engine;
};

const generateInitial = async (game, config, firstCell, seed, dependencies) => {
  const engine = resolveEngine(game, dependencies);
  const budget = commonRules.createBudget(commonRules.GAME_RULE_LIMITS[game].work);
  let rawInitial;
  if (game === "solitaire" || game === "sudoku") {
    const generateIssuedInitial = dependencies.generateIssuedInitial ||
      globalThis.generateIssuedInitial;
    if (typeof generateIssuedInitial !== "function") {
      throw new HttpError(503, "Issued game catalog is unavailable");
    }
    rawInitial = await generateIssuedInitial(game, config, seed);
  } else {
    if (typeof engine.generate !== "function") {
      throw new HttpError(503, `Verified ${game} generation is unavailable`);
    }
    rawInitial = engine.generate(config, { seed, firstCell, budget });
  }
  engine.initial(rawInitial);
  return commonRules.cloneState(rawInitial);
};

const assertVersions = (source) => {
  for (const [key, expected] of Object.entries(VERSION_FIELDS)) {
    if (source[key] !== expected) throw new HttpError(409, `Unsupported ${key}`);
  }
};

const initialCommitmentFor = (_game, _config, initial) => digestCanonical(initial);

const scopeValue = (session) => ({
  scope: "verified-game",
  id: session.id,
  game: session.game,
  config: session.config,
  buildVersion: session.buildVersion,
  ipHash: session.ipHash,
  issuedAt: session.issuedAt,
  expiresAt: session.expiresAt,
  ...VERSION_FIELDS,
  initialCommitment: session.initialCommitment,
});

const normalizeFirstCell = (game, value) => {
  if (value === undefined) return undefined;
  if (game !== "minesweeper") {
    throw new HttpError(400, "firstCell is only valid for Minesweeper");
  }
  assertAllowedKeys(value, ["row", "column"], "firstCell");
  if (!Number.isSafeInteger(value.row) || !Number.isSafeInteger(value.column)) {
    throw new HttpError(400, "Invalid Minesweeper firstCell");
  }
  return { row: value.row, column: value.column };
};

export const createVerifiedSession = async (
  request,
  env,
  rawPayload,
  config,
  dependencies = {}
) => {
  assertVersions(rawPayload);
  const security = requireSecurityConfig(env);
  const game = rawPayload.game.trim();
  const buildVersion = rawPayload.buildVersion.trim();
  if (!security.acceptedBuildVersions.includes(buildVersion)) {
    throw new HttpError(409, "Game build version is not compatible");
  }
  const firstCell = normalizeFirstCell(game, rawPayload.firstCell);
  await verifyTurnstileIfRequired(request, env, rawPayload);
  const ipHash = await hmacDigest(security.ipHashSecret, getClientIp(request));
  await enforceRateLimit(env, ipHash, "sessions", MAX_SESSIONS_PER_WINDOW);
  const issuedAt = nowDate(dependencies);
  const expiresAt = new Date(issuedAt.getTime() + commonRules.SESSION_LIFETIME_MS);
  const seedWords = new Uint32Array(1);
  crypto.getRandomValues(seedWords);
  let initial;
  try {
    initial = await generateInitial(game, config, firstCell, seedWords[0], dependencies);
  } catch (error) {
    return translateRuleError(error);
  }
  const initialCommitment = await initialCommitmentFor(game, config, initial);
  const session = {
    id: newId(dependencies),
    game,
    config,
    buildVersion,
    ipHash,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    initialCommitment,
  };
  const scopeDigest = await hmacDigest(
    security.signingSecret,
    commonRules.canonicalJson(scopeValue(session))
  );
  const emptyReplayHash = await replayPrefixHash([], 0);
  await getGameStatsDatabase(env).prepare(INSERT_VERIFIED_SESSION_SQL).bind(
    session.id,
    game,
    JSON.stringify(config),
    buildVersion,
    ipHash,
    session.issuedAt,
    session.expiresAt,
    VERSION_FIELDS.rulesVersion,
    VERSION_FIELDS.replayVersion,
    VERSION_FIELDS.generatorVersion,
    commonRules.canonicalJson(initial),
    initialCommitment,
    scopeDigest,
    session.issuedAt,
    emptyReplayHash
  ).run();
  const tokenPayload = { ...scopeValue(session), scopeDigest };
  return Object.freeze({
    id: session.id,
    token: await createSessionToken(security.signingSecret, tokenPayload),
    expiresAt: session.expiresAt,
    gameId: session.id,
    game,
    config,
    ...VERSION_FIELDS,
    initialCommitment,
    initial,
    timing: Object.freeze({ revision: 0, phase: "ready", elapsedMs: 0 }),
    limits: commonRules.GAME_RULE_LIMITS[game],
  });
};

const loadVerifiedSession = async (env, sessionId) => {
  if (!SESSION_ID_PATTERN.test(sessionId)) throw new HttpError(400, "Invalid session id");
  const row = await getGameStatsDatabase(env)
    .prepare(SELECT_VERIFIED_SESSION_SQL)
    .bind(sessionId)
    .first();
  if (!row) throw new HttpError(409, "Game session is no longer on record");
  if (Number(row.result_protocol) !== VERSION_FIELDS.resultProtocol) {
    throw new HttpError(409, "Game session does not support replay verification");
  }
  return row;
};

const validateVerifiedProof = async (
  request,
  env,
  session,
  token,
  { requireUnexpired = true } = {}
) => {
  const security = requireSecurityConfig(env);
  const proof = await verifySessionToken(security.signingSecret, token);
  const config = parseJsonColumn(session.config_json, "session configuration");
  const initial = parseJsonColumn(session.initial_json, "initial game state");
  const values = {
    id: session.id,
    game: session.game,
    config,
    buildVersion: session.build_version,
    ipHash: session.ip_hash,
    issuedAt: session.issued_at,
    expiresAt: session.expires_at,
    initialCommitment: session.initial_commitment,
  };
  const expectedCommitment = await initialCommitmentFor(session.game, config, initial);
  const expectedScopeDigest = await hmacDigest(
    security.signingSecret,
    commonRules.canonicalJson(scopeValue(values))
  );
  if (
    proof.scope !== "verified-game" ||
    commonRules.canonicalJson(proof) !== commonRules.canonicalJson({
      ...scopeValue(values),
      scopeDigest: expectedScopeDigest,
    }) ||
    session.initial_commitment !== expectedCommitment ||
    session.scope_digest !== expectedScopeDigest ||
    Number(session.rules_version) !== VERSION_FIELDS.rulesVersion ||
    Number(session.replay_version) !== VERSION_FIELDS.replayVersion ||
    Number(session.generator_version) !== VERSION_FIELDS.generatorVersion
  ) {
    throw new HttpError(403, "Session proof does not match this issued game");
  }
  if (requireUnexpired && Date.parse(session.expires_at) <= Date.now()) {
    throw new HttpError(409, "Game session has expired");
  }
  return { config, initial };
};

const timingResponse = (row) => Object.freeze({
  revision: Number(row.timing_revision ?? row.revision),
  phase: row.timing_phase ?? row.phase,
  elapsedMs: Number(row.timing_elapsed_ms ?? row.elapsed_ms),
});

const readTimingRequest = (rawPayload) => {
  assertAllowedKeys(rawPayload, [
    "session", "expectedRevision", "operation", "inputCount", "inputHash",
  ], "timing request");
  assertAllowedKeys(rawPayload.session, ["id", "token"], "session proof");
  if (typeof rawPayload.session.id !== "string" ||
      typeof rawPayload.session.token !== "string") {
    throw new HttpError(400, "Invalid session proof");
  }
  commonRules.assertInteger(rawPayload.expectedRevision, 0, 1_000_000, "timing revision");
  commonRules.assertInteger(rawPayload.inputCount, 0, 16_384, "timing input count");
  if (!["pause", "resume"].includes(rawPayload.operation)) {
    throw new HttpError(400, "Invalid timing operation");
  }
  if (!HASH_PATTERN.test(String(rawPayload.inputHash || ""))) {
    throw new HttpError(400, "Invalid replay prefix commitment");
  }
  return Object.freeze({ ...rawPayload });
};

export const updateVerifiedTiming = async (
  request,
  env,
  sessionId,
  rawPayload,
  dependencies = {}
) => {
  let payload;
  try {
    payload = readTimingRequest(rawPayload);
  } catch (error) {
    return translateRuleError(error);
  }
  if (payload.session.id !== sessionId) {
    throw new HttpError(403, "Session proof does not match this timing request");
  }
  const session = await loadVerifiedSession(env, sessionId);
  await validateVerifiedProof(request, env, session, payload.session.token);
  const ipHash = await hmacDigest(requireSecurityConfig(env).ipHashSecret, getClientIp(request));
  await enforceRateLimit(
    env,
    ipHash,
    "verification-attempts",
    MAX_VERIFICATION_ATTEMPTS_PER_WINDOW
  );
  const { token: _token, ...proofIdentity } = payload.session;
  const digestPayload = { ...payload, session: proofIdentity };
  const requestDigest = await digestCanonical(digestPayload);
  const nextRevision = payload.expectedRevision + 1;
  const database = getGameStatsDatabase(env);
  const prior = await database.prepare(SELECT_TIMING_TRANSITIONS_SQL).bind(sessionId).all();
  const existing = (prior.results || []).find((row) => Number(row.revision) === nextRevision);
  if (existing) {
    if (existing.request_digest !== requestDigest) {
      throw new HttpError(409, "Timing revision already has different evidence");
    }
    return timingResponse(existing);
  }
  if (Number(session.timing_revision) !== payload.expectedRevision) {
    throw new HttpError(409, "Timing revision is stale");
  }
  const expectedPhase = payload.operation === "pause"
    ? "running"
    : session.timing_phase;
  const nextPhase = payload.operation === "pause" ? "paused" : "running";
  const resumeAllowed = payload.operation === "resume" &&
    ["ready", "paused"].includes(session.timing_phase);
  const pauseAllowed = payload.operation === "pause" &&
    session.game !== "minesweeper" && session.timing_phase === "running";
  if (!resumeAllowed && !pauseAllowed) {
    throw new HttpError(409, "Timing operation is not valid in the current phase");
  }
  if (payload.inputCount < Number(session.timing_input_count)) {
    throw new HttpError(400, "Replay prefix cannot move backwards");
  }
  const observedAt = nowDate(dependencies);
  const elapsedMs = Number(session.timing_elapsed_ms) + (
    payload.operation === "pause"
      ? Math.max(0, observedAt.getTime() - Date.parse(session.timing_updated_at))
      : 0
  );
  const statements = [
    database.prepare(UPDATE_TIMING_SQL).bind(
      nextRevision,
      nextPhase,
      elapsedMs,
      observedAt.toISOString(),
      payload.inputCount,
      payload.inputHash,
      requestDigest,
      sessionId,
      observedAt.toISOString(),
      payload.expectedRevision,
      expectedPhase,
      payload.inputCount
    ),
    database.prepare(INSERT_TIMING_TRANSITION_SQL).bind(
      nextRevision,
      payload.operation,
      requestDigest,
      payload.inputCount,
      payload.inputHash,
      nextPhase,
      elapsedMs,
      observedAt.toISOString(),
      sessionId,
      nextRevision,
      requestDigest
    ),
  ];
  let results;
  try {
    results = await database.batch(statements);
  } catch (error) {
    const rows = await database.prepare(SELECT_TIMING_TRANSITIONS_SQL).bind(sessionId).all();
    const duplicate = (rows.results || []).find((row) => Number(row.revision) === nextRevision);
    if (duplicate?.request_digest === requestDigest) return timingResponse(duplicate);
    throw error;
  }
  if (results.some((result) => getChanges(result) !== 1)) {
    const rows = await database.prepare(SELECT_TIMING_TRANSITIONS_SQL).bind(sessionId).all();
    const duplicate = (rows.results || []).find((row) => Number(row.revision) === nextRevision);
    if (duplicate?.request_digest === requestDigest) return timingResponse(duplicate);
    throw new HttpError(409, "Timing state changed concurrently");
  }
  return Object.freeze({ revision: nextRevision, phase: nextPhase, elapsedMs });
};

const readRestoreRequest = (rawPayload) => {
  assertAllowedKeys(rawPayload, ["session", "inputCount", "inputHash"], "restore request");
  assertAllowedKeys(rawPayload.session, ["id", "token"], "session proof");
  if (typeof rawPayload.session.id !== "string" ||
      typeof rawPayload.session.token !== "string") {
    throw new HttpError(400, "Invalid session proof");
  }
  commonRules.assertInteger(rawPayload.inputCount, 0, 16_384, "restore input count");
  if (!HASH_PATTERN.test(String(rawPayload.inputHash || ""))) {
    throw new HttpError(400, "Invalid replay prefix commitment");
  }
  return rawPayload;
};

export const restoreVerifiedSession = async (request, env, sessionId, rawPayload) => {
  let payload;
  try {
    payload = readRestoreRequest(rawPayload);
  } catch (error) {
    return translateRuleError(error);
  }
  if (payload.session.id !== sessionId) {
    throw new HttpError(403, "Session proof does not match this restore request");
  }
  const session = await loadVerifiedSession(env, sessionId);
  const { config, initial } = await validateVerifiedProof(
    request,
    env,
    session,
    payload.session.token
  );
  if (session.consumed_at || session.completion_id) {
    throw new HttpError(409, "Finished games cannot be restored");
  }
  if (!["ready", "paused"].includes(session.timing_phase)) {
    throw new HttpError(409, "Game must be paused before it can be restored");
  }
  if (
    payload.inputCount !== Number(session.timing_input_count) ||
    payload.inputHash !== session.timing_input_hash
  ) {
    throw new HttpError(409, "Saved replay does not match acknowledged timing evidence");
  }
  return Object.freeze({
    id: session.id,
    token: payload.session.token,
    expiresAt: session.expires_at,
    gameId: session.id,
    game: session.game,
    config,
    ...VERSION_FIELDS,
    initialCommitment: session.initial_commitment,
    initial,
    timing: timingResponse(session),
    limits: commonRules.GAME_RULE_LIMITS[session.game],
  });
};

const translateRuleError = (error) => {
  if (error instanceof commonRules.GameRuleError) {
    throw new HttpError(error.code === "replay-limit" ? 413 : 400, error.message);
  }
  throw error;
};

const applyReplay = (game, engine, initial, inputs, terminalTick, limits) => {
  try {
    commonRules.assertReplay(inputs, limits.inputs);
    const budget = commonRules.createBudget(limits.work);
    let state = engine.initial(initial);
    if (game !== "snake") {
      for (const input of inputs) state = engine.transition(state, input, budget);
    } else {
      commonRules.assertInteger(terminalTick, 0, limits.ticks, "terminal tick");
      let inputIndex = 0;
      for (let tick = 0; tick < terminalTick; tick += 1) {
        while (inputIndex < inputs.length && inputs[inputIndex].tick === tick) {
          state = engine.transition(state, inputs[inputIndex], budget);
          inputIndex += 1;
        }
        if (inputIndex < inputs.length && inputs[inputIndex].tick < tick) {
          throw new commonRules.GameRuleError("invalid-input", "Snake inputs are out of order");
        }
        state = engine.transition(state, Object.freeze({ op: "step", tick }), budget);
      }
      if (inputIndex !== inputs.length) {
        throw new commonRules.GameRuleError("invalid-input", "Snake input occurs after terminal tick");
      }
    }
    return engine.result(state);
  } catch (error) {
    return translateRuleError(error);
  }
};

const assertTerminalResult = (game, result) => {
  if (!result || typeof result !== "object" || result.terminal !== true) {
    throw new HttpError(400, "Replay does not reach a terminal result");
  }
  if (game !== "snake" && result.won !== true) {
    throw new HttpError(400, "Replay does not reach a winning result");
  }
};

const puzzleKeyParts = (puzzleKey) => {
  const separator = String(puzzleKey || "").lastIndexOf(":");
  return separator > 0
    ? { puzzleId: puzzleKey.slice(0, separator), puzzle: puzzleKey.slice(separator + 1) }
    : {};
};

const canonicalEventFor = (eventId, session, result, elapsedMs, finishedAt) => {
  assertTerminalResult(session.game, result);
  const config = parseJsonColumn(session.config_json, "session configuration");
  const seconds = Math.max(1, Math.floor(elapsedMs / 1000));
  if (session.game === "minesweeper") return {
    id: eventId, game: session.game, type: "win", difficulty: config.difficulty,
    metric: seconds, metricKind: "seconds", occurredAt: finishedAt,
  };
  if (session.game === "solitaire") {
    commonRules.assertInteger(result.moves, 1, 99_999, "Solitaire moves");
    return {
      id: eventId, game: session.game, type: "win", metric: result.moves,
      metricKind: "moves", occurredAt: finishedAt,
    };
  }
  if (session.game === "snake") {
    const maximum = Number(config.boardSize) ** 2 - 3;
    commonRules.assertInteger(result.score, 0, maximum, "Snake score");
    return {
      id: eventId, game: session.game, type: "gamePlayed", boardSize: config.boardSize,
      metric: result.score, metricKind: "score", occurredAt: finishedAt,
    };
  }
  const initial = parseJsonColumn(session.initial_json, "initial game state");
  const assistance = Number(result.assistance ?? result.assistanceCount ?? 0);
  const hintBucket = result.hintBucket || (assistance > 0 ? "withHints" : "noHints");
  if (!["noHints", "withHints"].includes(hintBucket)) {
    throw new HttpError(400, "Invalid Sudoku assistance result");
  }
  return {
    id: eventId, game: session.game, type: "win", difficulty: config.difficulty, hintBucket,
    ...(initial.puzzleId && initial.puzzle
      ? { puzzleId: initial.puzzleId, puzzle: initial.puzzle }
      : {}),
    metric: seconds, metricKind: "seconds", occurredAt: finishedAt,
  };
};

const completionToCanonicalEvent = (completion) => ({
  id: completion.event_id,
  game: completion.game,
  type: completion.type,
  ...(completion.difficulty ? { difficulty: completion.difficulty } : {}),
  ...(completion.board_size ? { boardSize: completion.board_size } : {}),
  ...(completion.hint_bucket ? { hintBucket: completion.hint_bucket } : {}),
  ...puzzleKeyParts(completion.puzzle_key),
  metric: Number(completion.metric),
  metricKind: completion.metric_kind,
  occurredAt: completion.finished_at,
});

const completionResponse = (completion) => Object.freeze({
  completion: Object.freeze({
    id: completion.id,
    token: completion.receipt_token,
    expiresAt: completion.expires_at,
    event: Object.freeze(completionToCanonicalEvent(completion)),
    elapsedMs: Number(completion.elapsed_ms),
  }),
});

const readFinishRequest = (rawPayload) => {
  assertAllowedKeys(rawPayload, [
    "eventId", "session", "gameId", "rulesVersion", "replayVersion",
    "timingRevision", "inputs", "terminalTick",
  ], "finish request");
  assertAllowedKeys(rawPayload.session, ["id", "token"], "session proof");
  if (!SESSION_ID_PATTERN.test(String(rawPayload.eventId || ""))) {
    throw new HttpError(400, "Invalid event id");
  }
  if (typeof rawPayload.session.id !== "string" ||
      typeof rawPayload.session.token !== "string" ||
      typeof rawPayload.gameId !== "string") {
    throw new HttpError(400, "Invalid session proof");
  }
  if (rawPayload.rulesVersion !== VERSION_FIELDS.rulesVersion ||
      rawPayload.replayVersion !== VERSION_FIELDS.replayVersion) {
    throw new HttpError(409, "Unsupported replay rules version");
  }
  commonRules.assertInteger(rawPayload.timingRevision, 0, 1_000_000, "timing revision");
  commonRules.assertReplay(rawPayload.inputs);
  return Object.freeze({ ...rawPayload, inputs: commonRules.cloneState(rawPayload.inputs) });
};

export const finishVerifiedSession = async (
  request,
  env,
  sessionId,
  rawPayload,
  dependencies = {}
) => {
  let payload;
  try {
    payload = readFinishRequest(rawPayload);
  } catch (error) {
    return translateRuleError(error);
  }
  const database = getGameStatsDatabase(env);
  if (payload.session.id !== sessionId || payload.gameId !== sessionId) {
    throw new HttpError(403, "Session proof does not match this finish request");
  }
  const { token: _token, ...proofIdentity } = payload.session;
  const digestPayload = { ...payload, session: proofIdentity };
  const requestDigest = await digestCanonical(digestPayload);
  const priorCompletion = await database
    .prepare(SELECT_COMPLETION_BY_SESSION_SQL)
    .bind(sessionId)
    .first();
  if (priorCompletion) {
    const proof = await verifySessionToken(
      requireSecurityConfig(env).signingSecret,
      payload.session.token
    );
    if (
      proof.scope !== "verified-game" || proof.id !== sessionId ||
      proof.game !== priorCompletion.game
    ) {
      throw new HttpError(403, "Session proof does not match this finished game");
    }
    if (priorCompletion.request_digest !== requestDigest) {
      throw new HttpError(409, "Game session was finished with different replay evidence");
    }
    return completionResponse(priorCompletion);
  }
  const session = await loadVerifiedSession(env, sessionId);
  const { initial } = await validateVerifiedProof(
    request,
    env,
    session,
    payload.session.token,
    { requireUnexpired: false }
  );
  if (Date.parse(session.expires_at) <= Date.now()) {
    throw new HttpError(409, "Game session has expired");
  }
  if (session.consumed_at || session.completion_id) {
    throw new HttpError(409, "Game session was already used");
  }
  if (session.timing_phase !== "running" ||
      Number(session.timing_revision) !== payload.timingRevision) {
    throw new HttpError(409, "Timing evidence is incomplete");
  }
  const ipHash = await hmacDigest(requireSecurityConfig(env).ipHashSecret, getClientIp(request));
  await enforceRateLimit(
    env,
    ipHash,
    "verification-attempts",
    MAX_VERIFICATION_ATTEMPTS_PER_WINDOW
  );
  const timingRows = await database
    .prepare(SELECT_TIMING_TRANSITIONS_SQL)
    .bind(sessionId)
    .all();
  for (const row of timingRows.results || []) {
    if (await replayPrefixHash(payload.inputs, Number(row.input_count)) !== row.input_hash) {
      throw new HttpError(400, "Replay does not match acknowledged timing evidence");
    }
  }
  if (
    Number(session.timing_input_count) > payload.inputs.length ||
    await replayPrefixHash(payload.inputs, Number(session.timing_input_count)) !==
      session.timing_input_hash
  ) {
    throw new HttpError(400, "Replay does not match the latest timing evidence");
  }
  const finished = nowDate(dependencies);
  const elapsedMs = Number(session.timing_elapsed_ms) + Math.max(
    0,
    finished.getTime() - Date.parse(session.timing_updated_at)
  );
  if (session.game === "snake") {
    const requiredMs = SNAKE_RESUME_COUNTDOWN_MS + payload.terminalTick * SNAKE_TICK_MS;
    if (elapsedMs < requiredMs) throw new HttpError(425, "Snake replay completed too quickly");
  }
  const engine = resolveEngine(session.game, dependencies);
  const result = applyReplay(
    session.game,
    engine,
    initial,
    payload.inputs,
    payload.terminalTick,
    commonRules.GAME_RULE_LIMITS[session.game]
  );
  const canonicalEvent = canonicalEventFor(
    payload.eventId,
    session,
    result,
    elapsedMs,
    finished.toISOString()
  );
  const replayDigest = await digestCanonical(payload.inputs);
  const completionId = newId(dependencies);
  const receiptPayload = {
    version: 1,
    scope: "verified-completion",
    id: completionId,
    sessionId,
    requestDigest,
    game: session.game,
    finishedAt: finished.toISOString(),
    expiresAt: session.expires_at,
  };
  const receiptToken = await createSessionToken(
    requireSecurityConfig(env).signingSecret,
    receiptPayload
  );
  const insertParams = [
    completionId,
    payload.eventId,
    requestDigest,
    receiptToken,
    canonicalEvent.game,
    canonicalEvent.type,
    canonicalEvent.difficulty || null,
    canonicalEvent.boardSize || null,
    canonicalEvent.hintBucket || null,
    canonicalEvent.metric,
    canonicalEvent.metricKind,
    puzzleKeyOf(canonicalEvent),
    session.initial_commitment,
    replayDigest,
    payload.timingRevision,
    elapsedMs,
    finished.toISOString(),
    session.expires_at,
    sessionId,
    completionId,
    finished.toISOString(),
  ];
  let results;
  try {
    results = await database.batch([
      database.prepare(CONSUME_VERIFIED_SESSION_SQL).bind(
        finished.toISOString(),
        completionId,
        elapsedMs,
        finished.toISOString(),
        sessionId,
        finished.toISOString(),
        VERSION_FIELDS.rulesVersion,
        VERSION_FIELDS.replayVersion,
        VERSION_FIELDS.generatorVersion,
        session.initial_commitment,
        session.scope_digest,
        payload.timingRevision
      ),
      database.prepare(INSERT_COMPLETION_SQL).bind(...insertParams),
    ]);
  } catch (error) {
    const duplicate = await database.prepare(SELECT_COMPLETION_BY_SESSION_SQL).bind(sessionId).first();
    if (duplicate?.request_digest === requestDigest) return completionResponse(duplicate);
    if (await database.prepare(SELECT_COMPLETION_BY_EVENT_SQL).bind(payload.eventId).first()) {
      throw new HttpError(409, "Event id is already reserved by another completion");
    }
    if (await selectExistingEvent(env, payload.eventId)) {
      throw new HttpError(409, "Event id already exists");
    }
    throw error;
  }
  if (results.some((item) => getChanges(item) !== 1)) {
    const duplicate = await database.prepare(SELECT_COMPLETION_BY_SESSION_SQL).bind(sessionId).first();
    if (duplicate?.request_digest === requestDigest) return completionResponse(duplicate);
    throw new HttpError(409, "Game session changed concurrently");
  }
  return Object.freeze({
    completion: Object.freeze({
      id: completionId,
      token: receiptToken,
      expiresAt: session.expires_at,
      event: Object.freeze(canonicalEvent),
      elapsedMs,
    }),
  });
};

const publicationMatches = async (env, completion, event, digest) => {
  if (
    completion.publication_digest !== digest
  ) return false;
  if (completion.published_event_id !== event.id) {
    const puzzleEvent = await selectEventForPuzzle(env, event);
    return puzzleEvent?.id === completion.published_event_id;
  }
  const existing = await selectExistingEvent(env, event.id);
  if (!existing) return false;
  assertStoredEventMatches(existing, event);
  const binding = await getGameStatsDatabase(env)
    .prepare(SELECT_EVENT_COMPLETION_SQL)
    .bind(event.id)
    .first();
  return !binding?.completion_id || binding.completion_id === completion.id;
};

const assertCanonicalAssertions = (completion, event) => {
  const canonical = completionToCanonicalEvent(completion);
  const asserted = Object.fromEntries(
    Object.keys(canonical).map((key) => [key, event[key]])
  );
  if (commonRules.canonicalJson(canonical) !== commonRules.canonicalJson(asserted)) {
    throw new HttpError(400, "Published result does not match the verified completion");
  }
};

export const publishVerifiedCompletion = async (
  request,
  env,
  rawEvent,
  rawCompletion
) => {
  assertAllowedKeys(rawCompletion, ["id", "token"], "completion receipt");
  const completionId = String(rawCompletion.id || "").trim();
  if (!SESSION_ID_PATTERN.test(completionId) || typeof rawCompletion.token !== "string") {
    throw new HttpError(400, "Invalid completion receipt");
  }
  const database = getGameStatsDatabase(env);
  const completion = await database.prepare(SELECT_COMPLETION_SQL).bind(completionId).first();
  if (!completion) throw new HttpError(409, "Verified completion is no longer on record");
  const proof = await verifySessionToken(
    requireSecurityConfig(env).signingSecret,
    rawCompletion.token
  );
  if (
    rawCompletion.token !== completion.receipt_token ||
    proof.version !== 1 || proof.scope !== "verified-completion" ||
    proof.id !== completion.id || proof.sessionId !== completion.session_id ||
    proof.requestDigest !== completion.request_digest || proof.game !== completion.game ||
    proof.finishedAt !== completion.finished_at || proof.expiresAt !== completion.expires_at
  ) {
    throw new HttpError(403, "Completion receipt does not match this result");
  }
  const event = normalizeGameStatsEvent(rawEvent);
  assertCanonicalAssertions(completion, event);
  const publicationDigest = await digestCanonical(event);
  if (completion.published_event_id) {
    if (await publicationMatches(env, completion, event, publicationDigest)) {
      return { applied: false, eventId: completion.published_event_id };
    }
    throw new HttpError(409, "Verified completion was published with different identity");
  }
  if (Date.parse(completion.expires_at) <= Date.now()) {
    throw new HttpError(409, "Completion receipt has expired");
  }
  const existing = await selectExistingEvent(env, event.id);
  if (existing) throw new HttpError(409, "Event id already exists with a different result");
  await enforceRateLimit(
    env,
    await hmacDigest(requireSecurityConfig(env).ipHashSecret, getClientIp(request)),
    "events",
    MAX_EVENTS_PER_WINDOW
  );
  const insertParams = [
    ...eventToInsertParams(event),
    completion.id,
    completion.id,
    event.id,
    publicationDigest,
  ];
  let results;
  try {
    results = await database.batch([
      database.prepare(BIND_COMPLETION_SQL).bind(
        event.id,
        publicationDigest,
        completion.id,
        event.id
      ),
      database.prepare(INSERT_VERIFIED_EVENT_SQL).bind(...insertParams),
    ]);
  } catch (error) {
    const latest = await database.prepare(SELECT_COMPLETION_SQL).bind(completion.id).first();
    if (latest && await publicationMatches(env, latest, event, publicationDigest)) {
      return { applied: false, eventId: latest.published_event_id };
    }
    if (latest?.published_event_id) {
      throw new HttpError(409, "Verified completion was published with different profile");
    }
    const puzzleEvent = await selectEventForPuzzle(env, event);
    if (puzzleEvent) {
      const [bound] = await database.batch([
        database.prepare(BIND_COMPLETION_SQL).bind(
          puzzleEvent.id,
          publicationDigest,
          completion.id,
          event.id
        ),
      ]);
      if (getChanges(bound) === 1) {
        return { applied: false, eventId: puzzleEvent.id };
      }
    }
    throw error;
  }
  if (results.some((item) => getChanges(item) !== 1)) {
    const latest = await database.prepare(SELECT_COMPLETION_SQL).bind(completion.id).first();
    if (latest && await publicationMatches(env, latest, event, publicationDigest)) {
      return { applied: false, eventId: latest.published_event_id };
    }
    throw new HttpError(409, "Verified completion changed concurrently");
  }
  return { applied: true, eventId: event.id };
};

export { MAX_REPLAY_BODY_BYTES, VERSION_FIELDS };
