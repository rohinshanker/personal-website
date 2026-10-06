import "../../../scripts/home/games/rules.js";

import {
  MAX_EVENTS_PER_WINDOW,
  MAX_REPLAY_BODY_BYTES,
  MAX_SESSIONS_PER_WINDOW,
  MAX_VERIFICATION_ACTION_WORK,
  MAX_VERIFICATION_ACTION_BYTES,
  MAX_VERIFICATION_ATTEMPTS_PER_WINDOW,
  MAX_VERIFICATION_BATCH_CANONICAL_BYTES,
  MAX_VERIFICATION_BATCH_CLONE_BYTES,
  MAX_VERIFICATION_BATCH_OPERATIONS,
  MAX_VERIFICATION_BATCH_WORK,
  MAX_VERIFICATION_CHECKPOINT_BYTES,
  MAX_VERIFICATION_CONTINUATIONS_PER_WINDOW,
  MAX_VERIFICATION_JOB_CONTINUATIONS,
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
const limitsFor = (game) => Object.freeze({
  ...commonRules.GAME_RULE_LIMITS[game],
  continuations: MAX_VERIFICATION_JOB_CONTINUATIONS,
});
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{8,80}$/;
const REPLAY_LIMIT_CODE = "replay-limit";
const SESSION_EXPIRED_CODE = "session-expired";
const replayLimitError = (message) =>
  new HttpError(413, message, { code: REPLAY_LIMIT_CODE });
const sessionExpiredError = (message) =>
  new HttpError(409, message, { code: SESSION_EXPIRED_CODE });
const textEncoder = new TextEncoder();
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
  timing_input_count, timing_input_hash, timing_request_digest, completion_id,
  finish_job_id
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
  AND timing_revision = ? AND timing_phase = 'finishing' AND finish_job_id = ?
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
const START_FINISHING_SQL = `
UPDATE game_stat_sessions
SET timing_phase = 'finishing', timing_elapsed_ms = ?, timing_updated_at = ?,
  finish_job_id = ?
WHERE id = ? AND result_protocol = 2 AND consumed_at IS NULL
  AND completion_id IS NULL AND finish_job_id IS NULL AND expires_at > ?
  AND rules_version = ? AND replay_version = ? AND generator_version = ?
  AND initial_commitment = ? AND scope_digest = ?
  AND timing_revision = ? AND timing_phase = ? AND timing_input_count = ?
`;
const INSERT_COMPLETION_JOB_SQL = `
INSERT INTO verified_completion_jobs (
  id, session_id, event_id, request_digest, transcript_digest, transcript_json,
  rules_version, replay_version, timing_revision, terminal_tick, input_count,
  progress_token, checkpoint_digest, continuation_limit, resume_count, elapsed_ms, finished_at,
  expires_at, updated_at
)
SELECT ?, id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, expires_at, ?
FROM game_stat_sessions
WHERE id = ? AND finish_job_id = ? AND timing_phase = 'finishing'
`;
const INSERT_PROGRESS_SQL = `
INSERT INTO verified_completion_progress (
  job_id, revision, token, input_cursor, tick_cursor, checkpoint_digest, created_at
)
SELECT id, ?, ?, ?, ?, ?, ?
FROM verified_completion_jobs
WHERE id = ? AND progress_revision = ? AND progress_token = ?
`;
const SELECT_COMPLETION_JOB_SQL = `
SELECT id, session_id, event_id, request_digest, transcript_digest, transcript_json,
  rules_version, replay_version, timing_revision, timing_verified_revision,
  terminal_tick, input_count, input_cursor, tick_cursor,
  state_json, work_used, progress_revision, progress_token, checkpoint_digest,
  request_count, continuation_limit, resume_count, elapsed_ms, finished_at, expires_at, stage,
  completion_id, updated_at
FROM verified_completion_jobs
WHERE session_id = ?
`;
const SELECT_COMPLETION_JOB_BY_ID_SQL = SELECT_COMPLETION_JOB_SQL.replace(
  "WHERE session_id = ?",
  "WHERE id = ?"
);
const SELECT_COMPLETION_JOB_BY_EVENT_SQL = SELECT_COMPLETION_JOB_SQL.replace(
  "WHERE session_id = ?",
  "WHERE event_id = ?"
);
const SELECT_PROGRESS_SQL = `
SELECT job_id, revision, token, input_cursor, tick_cursor, checkpoint_digest
FROM verified_completion_progress
WHERE job_id = ? AND revision = ?
`;
const SELECT_NEXT_PROGRESS_SQL = `
SELECT job_id, revision, token, input_cursor, tick_cursor, checkpoint_digest
FROM verified_completion_progress
WHERE job_id = ? AND revision = ?
`;
const SELECT_TIMING_REVISION_SQL = `
SELECT revision, operation, input_count, input_hash
FROM verified_timing_transitions
WHERE session_id = ? AND revision = ?
`;
const SELECT_CANONICAL_PREFIX_SQL = `
SELECT COALESCE(GROUP_CONCAT(canonical_inputs, ','), '') AS canonical_prefix
FROM (
  SELECT canonical_inputs
  FROM verified_completion_replay_chunks
  WHERE job_id = ? AND end_cursor <= ?
  ORDER BY start_cursor
)
`;
const SELECT_RESUME_COUNT_SQL = `
SELECT COUNT(*) AS count
FROM verified_timing_transitions
WHERE session_id = ? AND operation = 'resume' AND revision <= ?
`;
const SELECT_JOB_INPUTS_SQL = `
WITH RECURSIVE indexes(value) AS (
  SELECT ?
  UNION ALL
  SELECT value + 1 FROM indexes WHERE value + 1 < ?
)
SELECT value AS input_index,
  json_extract(
    transcript_json,
    '$.inputs[' || CAST(value AS INTEGER) || ']'
  ) AS input_json
FROM verified_completion_jobs, indexes
WHERE id = ? AND value < ?
ORDER BY value
`;
const UPDATE_COMPLETION_JOB_SQL = `
UPDATE verified_completion_jobs
SET timing_verified_revision = ?, input_cursor = ?, tick_cursor = ?,
  state_json = ?, work_used = ?, progress_revision = ?, progress_token = ?,
  checkpoint_digest = ?, request_count = request_count + 1, stage = ?, updated_at = ?
WHERE id = ? AND stage = ? AND progress_revision = ? AND progress_token = ?
  AND checkpoint_digest = ? AND request_count < continuation_limit
  AND completion_id IS NULL
`;
const INSERT_REPLAY_CHUNK_SQL = `
INSERT INTO verified_completion_replay_chunks (
  job_id, start_cursor, end_cursor, canonical_inputs, created_at
)
SELECT id, ?, ?, ?, ?
FROM verified_completion_jobs
WHERE id = ? AND progress_revision = ? AND progress_token = ?
`;
const COMPLETE_JOB_SQL = `
UPDATE verified_completion_jobs
SET stage = 'completed', completion_id = ?, request_count = request_count + 1,
  updated_at = ?
WHERE id = ? AND stage = 'finalize' AND progress_revision = ?
  AND progress_token = ? AND checkpoint_digest = ?
  AND request_count < continuation_limit AND completion_id IS NULL
`;

const getChanges = (result) => Number(result?.meta?.changes ?? result?.changes ?? 0);
const nowDate = (dependencies) => new Date((dependencies.now || Date.now)());
const newId = (dependencies) => dependencies.randomUUID
  ? dependencies.randomUUID()
  : crypto.randomUUID();

const digestText = async (value) =>
  Array.from(new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(value)
  )), (byte) => byte.toString(16).padStart(2, "0")).join("");

export const digestCanonical = async (value) =>
  digestText(commonRules.canonicalJson(value));

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
      typeof engine.transition !== "function" || typeof engine.result !== "function" ||
      (game === "snake" && typeof engine.step !== "function")) {
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
  if (!Number.isSafeInteger(value)) {
    throw new HttpError(400, "Invalid Minesweeper firstCell");
  }
  return value;
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
    limits: limitsFor(game),
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
  { requireUnexpired = true, verifyInitial = true } = {}
) => {
  const security = requireSecurityConfig(env);
  const proof = await verifySessionToken(security.signingSecret, token);
  const config = parseJsonColumn(session.config_json, "session configuration");
  const initial = verifyInitial
    ? parseJsonColumn(session.initial_json, "initial game state")
    : null;
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
  const expectedCommitment = verifyInitial
    ? await initialCommitmentFor(session.game, config, initial)
    : session.initial_commitment;
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
    throw sessionExpiredError("Game session has expired");
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
    limits: limitsFor(session.game),
  });
};

const translateRuleError = (error) => {
  if (error instanceof commonRules.GameRuleError) {
    throw new HttpError(error.code === REPLAY_LIMIT_CODE ? 413 : 400, error.message, {
      code: error.code,
    });
  }
  throw error;
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
  if (!Array.isArray(rawPayload.inputs) || rawPayload.inputs.length > 16_384) {
    throw new commonRules.GameRuleError(
      "replay-limit",
      "Game replay input limit exceeded"
    );
  }
  if (rawPayload.terminalTick !== undefined) {
    commonRules.assertInteger(
      rawPayload.terminalTick,
      0,
      commonRules.GAME_RULE_LIMITS.snake.ticks,
      "terminal tick"
    );
  }
  return Object.freeze({ ...rawPayload });
};

const readContinueRequest = (rawPayload) => {
  assertAllowedKeys(rawPayload, ["session", "progress"], "finish continuation request");
  assertAllowedKeys(rawPayload.session, ["id", "token"], "session proof");
  assertAllowedKeys(rawPayload.progress, ["id", "token"], "progress proof");
  if (
    !SESSION_ID_PATTERN.test(String(rawPayload.session.id || "")) ||
    typeof rawPayload.session.token !== "string" ||
    !SESSION_ID_PATTERN.test(String(rawPayload.progress.id || "")) ||
    typeof rawPayload.progress.token !== "string"
  ) {
    throw new HttpError(400, "Invalid finish continuation proof");
  }
  return Object.freeze({
    session: Object.freeze({ ...rawPayload.session }),
    progress: Object.freeze({ ...rawPayload.progress }),
  });
};

const progressResponse = (id, token) => Object.freeze({
  progress: Object.freeze({ id, token }),
});

const progressTokenPayload = (job) => ({
  version: 1,
  scope: "verified-progress",
  id: job.id,
  sessionId: job.session_id,
  transcriptDigest: job.transcript_digest,
  rulesVersion: Number(job.rules_version),
  replayVersion: Number(job.replay_version),
  continuationLimit: Number(job.continuation_limit),
  revision: Number(job.progress_revision),
  inputCursor: Number(job.input_cursor),
  tickCursor: Number(job.tick_cursor),
  checkpointDigest: job.checkpoint_digest,
  expiresAt: job.expires_at,
});

const createProgressToken = (secret, job) =>
  createSessionToken(secret, progressTokenPayload(job));

const checkpointDigestFor = async (job, checkpoint) => {
  const stateDigest = checkpoint.state_json
    ? await digestText(checkpoint.state_json)
    : "";
  const canonicalChunkDigest = checkpoint.canonical_chunk
    ? await digestText(checkpoint.canonical_chunk)
    : "";
  return digestCanonical({
    previous: job.checkpoint_digest || job.transcript_digest,
    transcriptDigest: job.transcript_digest,
    revision: Number(checkpoint.progress_revision),
    timingRevision: Number(checkpoint.timing_verified_revision),
    inputCursor: Number(checkpoint.input_cursor),
    tickCursor: Number(checkpoint.tick_cursor),
    workUsed: Number(checkpoint.work_used),
    stage: checkpoint.stage,
    stateDigest,
    canonicalChunkDigest,
  });
};

const getCompletionForJob = async (database, job) => {
  if (!job.completion_id) return null;
  return database.prepare(SELECT_COMPLETION_SQL).bind(job.completion_id).first();
};

const priorJobResponse = async (database, job, requestDigest) => {
  if (job.request_digest !== requestDigest) {
    throw new HttpError(409, "Game session is already bound to a different transcript");
  }
  const completion = await getCompletionForJob(database, job);
  if (completion) return completionResponse(completion);
  return progressResponse(job.id, job.progress_token);
};

const verifyProgressProof = async (env, job, rawToken) => {
  const proof = await verifySessionToken(
    requireSecurityConfig(env).signingSecret,
    rawToken
  );
  if (
    proof.version !== 1 || proof.scope !== "verified-progress" ||
    proof.id !== job.id || proof.sessionId !== job.session_id ||
    proof.transcriptDigest !== job.transcript_digest ||
    proof.rulesVersion !== Number(job.rules_version) ||
    proof.replayVersion !== Number(job.replay_version) ||
    proof.continuationLimit !== Number(job.continuation_limit) ||
    !Number.isSafeInteger(proof.revision) || proof.revision < 0 ||
    !Number.isSafeInteger(proof.inputCursor) || proof.inputCursor < 0 ||
    !Number.isSafeInteger(proof.tickCursor) || proof.tickCursor < 0 ||
    !HASH_PATTERN.test(String(proof.checkpointDigest || "")) ||
    proof.expiresAt !== job.expires_at
  ) {
    throw new HttpError(403, "Progress proof does not match this verification job");
  }
  const stored = await getGameStatsDatabase(env)
    .prepare(SELECT_PROGRESS_SQL)
    .bind(job.id, proof.revision)
    .first();
  if (
    !stored || stored.token !== rawToken ||
    Number(stored.input_cursor) !== proof.inputCursor ||
    Number(stored.tick_cursor) !== proof.tickCursor ||
    stored.checkpoint_digest !== proof.checkpointDigest
  ) {
    throw new HttpError(403, "Progress proof is not an issued checkpoint");
  }
  return proof;
};

const nextProgressResponse = async (database, jobId, revision) => {
  const next = await database
    .prepare(SELECT_NEXT_PROGRESS_SQL)
    .bind(jobId, revision + 1)
    .first();
  if (!next) throw new HttpError(409, "Verification progress changed concurrently");
  return progressResponse(jobId, next.token);
};

export const finishVerifiedSession = async (
  request,
  env,
  sessionId,
  rawPayload,
  dependencies = {},
  metadata = {}
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
  const transcriptJson = metadata.transcriptJson || JSON.stringify(rawPayload);
  const finishedAt = String(metadata.finishedAt || nowDate(dependencies).toISOString());
  const finished = new Date(finishedAt);
  if (!Number.isFinite(finished.getTime())) throw new HttpError(500, "Invalid finish timestamp");
  const requestDigest = await digestText(transcriptJson);
  const existingJob = await database
    .prepare(SELECT_COMPLETION_JOB_SQL)
    .bind(sessionId)
    .first();
  if (existingJob) return priorJobResponse(database, existingJob, requestDigest);
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
  await validateVerifiedProof(
    request,
    env,
    session,
    payload.session.token,
    { requireUnexpired: false, verifyInitial: false }
  );
  if (Date.parse(session.expires_at) <= finished.getTime()) {
    throw sessionExpiredError("Game session has expired");
  }
  if (session.consumed_at || session.completion_id) {
    throw new HttpError(409, "Game session was already used");
  }
  const finishTimingPhase = session.timing_phase;
  const finishFromPaused = finishTimingPhase === "paused";
  if (!["running", "paused"].includes(finishTimingPhase) ||
      (finishFromPaused && session.game === "minesweeper") ||
      Number(session.timing_revision) !== payload.timingRevision ||
      (finishFromPaused && Number(session.timing_input_count) !== payload.inputs.length)) {
    throw new HttpError(409, "Timing evidence is incomplete");
  }
  if (payload.inputs.length > commonRules.GAME_RULE_LIMITS[session.game].inputs) {
    throw replayLimitError("Game replay input limit exceeded");
  }
  const ipHash = await hmacDigest(requireSecurityConfig(env).ipHashSecret, getClientIp(request));
  await enforceRateLimit(
    env,
    ipHash,
    "verification-attempts",
    MAX_VERIFICATION_ATTEMPTS_PER_WINDOW
  );
  const elapsedMs = Number(session.timing_elapsed_ms) + (
    finishFromPaused
      ? 0
      : Math.max(0, finished.getTime() - Date.parse(session.timing_updated_at))
  );
  const resumeCount = Number((await database
    .prepare(SELECT_RESUME_COUNT_SQL)
    .bind(sessionId, payload.timingRevision)
    .first())?.count || 0);
  if (resumeCount < 1) throw new HttpError(409, "Timing evidence is incomplete");
  if (session.game === "snake") {
    if (!Number.isSafeInteger(payload.terminalTick)) {
      throw new HttpError(400, "Snake completion requires a terminal tick");
    }
    const requiredMs =
      SNAKE_RESUME_COUNTDOWN_MS * resumeCount + payload.terminalTick * SNAKE_TICK_MS;
    if (elapsedMs < requiredMs) throw new HttpError(425, "Snake replay completed too quickly");
  } else if (payload.terminalTick !== undefined) {
    throw new HttpError(400, "Terminal ticks are only valid for Snake");
  }
  const jobId = newId(dependencies);
  const transcriptDigest = requestDigest;
  const initialCheckpoint = {
    id: jobId,
    session_id: sessionId,
    transcript_digest: transcriptDigest,
    rules_version: VERSION_FIELDS.rulesVersion,
    replay_version: VERSION_FIELDS.replayVersion,
    continuation_limit: MAX_VERIFICATION_JOB_CONTINUATIONS,
    progress_revision: 0,
    input_cursor: 0,
    tick_cursor: 0,
    timing_verified_revision: 0,
    work_used: 0,
    stage: "replay",
    state_json: null,
    expires_at: session.expires_at,
  };
  initialCheckpoint.checkpoint_digest = await checkpointDigestFor(
    { transcript_digest: transcriptDigest, checkpoint_digest: "" },
    initialCheckpoint
  );
  const security = requireSecurityConfig(env);
  initialCheckpoint.progress_token = await createProgressToken(security.signingSecret, {
    ...initialCheckpoint,
  });
  const startParams = [
    elapsedMs,
    finishedAt,
    jobId,
    sessionId,
    finishedAt,
    VERSION_FIELDS.rulesVersion,
    VERSION_FIELDS.replayVersion,
    VERSION_FIELDS.generatorVersion,
    session.initial_commitment,
    session.scope_digest,
    payload.timingRevision,
    finishTimingPhase,
    session.timing_input_count,
  ];
  const jobParams = [
    jobId,
    payload.eventId,
    requestDigest,
    transcriptDigest,
    transcriptJson,
    VERSION_FIELDS.rulesVersion,
    VERSION_FIELDS.replayVersion,
    payload.timingRevision,
    payload.terminalTick ?? null,
    payload.inputs.length,
    initialCheckpoint.progress_token,
    initialCheckpoint.checkpoint_digest,
    MAX_VERIFICATION_JOB_CONTINUATIONS,
    resumeCount,
    elapsedMs,
    finishedAt,
    finishedAt,
    sessionId,
    jobId,
  ];
  let results;
  try {
    results = await database.batch([
      database.prepare(START_FINISHING_SQL).bind(...startParams),
      database.prepare(INSERT_COMPLETION_JOB_SQL).bind(...jobParams),
      database.prepare(INSERT_PROGRESS_SQL).bind(
        0,
        initialCheckpoint.progress_token,
        0,
        0,
        initialCheckpoint.checkpoint_digest,
        finishedAt,
        jobId,
        0,
        initialCheckpoint.progress_token
      ),
    ]);
  } catch (error) {
    const duplicate = await database.prepare(SELECT_COMPLETION_JOB_SQL).bind(sessionId).first();
    if (duplicate) return priorJobResponse(database, duplicate, requestDigest);
    if (await database.prepare(SELECT_COMPLETION_BY_EVENT_SQL).bind(payload.eventId).first()) {
      throw new HttpError(409, "Event id is already reserved by another completion");
    }
    if (await database.prepare(SELECT_COMPLETION_JOB_BY_EVENT_SQL).bind(payload.eventId).first()) {
      throw new HttpError(409, "Event id is already reserved by another verification job");
    }
    if (await selectExistingEvent(env, payload.eventId)) {
      throw new HttpError(409, "Event id already exists");
    }
    throw error;
  }
  if (results.some((item) => getChanges(item) !== 1)) {
    const duplicate = await database.prepare(SELECT_COMPLETION_JOB_SQL).bind(sessionId).first();
    if (duplicate) return priorJobResponse(database, duplicate, requestDigest);
    throw new HttpError(409, "Game session changed concurrently");
  }
  return progressResponse(jobId, initialCheckpoint.progress_token);
};

class BatchWorkExhausted extends Error {}

const replayInputAt = (rows, cursor) => {
  const row = rows.find((candidate) => Number(candidate.input_index) === cursor);
  if (!row || typeof row.input_json !== "string") {
    throw new HttpError(400, "Stored replay transcript is incomplete");
  }
  const input = parseJsonColumn(row.input_json, "replay input");
  if (
    !input || typeof input !== "object" || Array.isArray(input) ||
    input.seq !== cursor + 1 || typeof input.op !== "string"
  ) {
    throw new HttpError(400, "Game replay inputs must be ordered");
  }
  return input;
};

const canonicalPrefixAt = async (database, jobId, inputCursor) => {
  const prefix = String((await database
    .prepare(SELECT_CANONICAL_PREFIX_SQL)
    .bind(jobId, inputCursor)
    .first())?.canonical_prefix || "");
  if (textEncoder.encode(prefix).byteLength > MAX_REPLAY_BODY_BYTES) {
    throw replayLimitError("Replay prefix exceeds the verification byte limit");
  }
  return prefix;
};

const transitionOne = (engine, state, input, remainingBatchWork, step = false) => {
  let actionWork = 0;
  const candidate = structuredClone(state);
  const budget = {
    spend(units = 1) {
      commonRules.assertInteger(units, 0, 10_000_000, "work charge");
      if (actionWork + units > MAX_VERIFICATION_ACTION_WORK) {
        throw new commonRules.GameRuleError(
          "replay-limit",
          "One replay action exceeds the verification work limit"
        );
      }
      if (actionWork + units > remainingBatchWork) throw new BatchWorkExhausted();
      actionWork += units;
    },
  };
  const transitioned = step
    ? engine.step(candidate, budget)
    : engine.transition(candidate, input, budget);
  return { state: transitioned, work: actionWork };
};

const commitCheckpoint = async (env, database, job, checkpoint) => {
  checkpoint.progress_revision = Number(job.progress_revision) + 1;
  checkpoint.checkpoint_digest = await checkpointDigestFor(job, checkpoint);
  checkpoint.progress_token = await createProgressToken(
    requireSecurityConfig(env).signingSecret,
    { ...job, ...checkpoint }
  );
  const updatedAt = nowDate({}).toISOString();
  const statements = [
    database.prepare(UPDATE_COMPLETION_JOB_SQL).bind(
      checkpoint.timing_verified_revision,
      checkpoint.input_cursor,
      checkpoint.tick_cursor,
      checkpoint.state_json,
      checkpoint.work_used,
      checkpoint.progress_revision,
      checkpoint.progress_token,
      checkpoint.checkpoint_digest,
      checkpoint.stage,
      updatedAt,
      job.id,
      job.stage,
      job.progress_revision,
      job.progress_token,
      job.checkpoint_digest
    ),
  ];
  if (checkpoint.canonical_chunk) {
    statements.push(database.prepare(INSERT_REPLAY_CHUNK_SQL).bind(
      job.input_cursor,
      checkpoint.input_cursor,
      checkpoint.canonical_chunk,
      updatedAt,
      job.id,
      checkpoint.progress_revision,
      checkpoint.progress_token
    ));
  }
  statements.push(database.prepare(INSERT_PROGRESS_SQL).bind(
    checkpoint.progress_revision,
    checkpoint.progress_token,
    checkpoint.input_cursor,
    checkpoint.tick_cursor,
    checkpoint.checkpoint_digest,
    updatedAt,
    job.id,
    checkpoint.progress_revision,
    checkpoint.progress_token
  ));
  let results;
  try {
    results = await database.batch(statements);
  } catch (error) {
    const latest = await database.prepare(SELECT_COMPLETION_JOB_BY_ID_SQL).bind(job.id).first();
    if (latest && Number(latest.progress_revision) > Number(job.progress_revision)) {
      return nextProgressResponse(database, job.id, Number(job.progress_revision));
    }
    throw error;
  }
  if (results.some((item) => getChanges(item) !== 1)) {
    const latest = await database.prepare(SELECT_COMPLETION_JOB_BY_ID_SQL).bind(job.id).first();
    if (latest && Number(latest.progress_revision) > Number(job.progress_revision)) {
      return nextProgressResponse(database, job.id, Number(job.progress_revision));
    }
    throw new HttpError(409, "Verification progress changed concurrently");
  }
  return progressResponse(job.id, checkpoint.progress_token);
};

const finalizeJob = async (env, database, session, job, dependencies) => {
  const engine = resolveEngine(session.game, dependencies);
  const state = parseJsonColumn(job.state_json, "verification checkpoint");
  let result;
  try {
    result = engine.result(state);
  } catch (error) {
    return translateRuleError(error);
  }
  const canonicalEvent = canonicalEventFor(
    job.event_id,
    session,
    result,
    Number(job.elapsed_ms),
    job.finished_at
  );
  const canonicalPrefix = await canonicalPrefixAt(database, job.id, job.input_count);
  const replayDigest = await digestText(`[${canonicalPrefix}]`);
  const completionId = newId(dependencies);
  const receiptPayload = {
    version: 1,
    scope: "verified-completion",
    id: completionId,
    sessionId: job.session_id,
    requestDigest: job.request_digest,
    game: session.game,
    finishedAt: job.finished_at,
    expiresAt: job.expires_at,
  };
  const receiptToken = await createSessionToken(
    requireSecurityConfig(env).signingSecret,
    receiptPayload
  );
  const insertParams = [
    completionId,
    job.event_id,
    job.request_digest,
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
    job.timing_revision,
    job.elapsed_ms,
    job.finished_at,
    job.expires_at,
    job.session_id,
    completionId,
    job.finished_at,
  ];
  let results;
  try {
    results = await database.batch([
      database.prepare(CONSUME_VERIFIED_SESSION_SQL).bind(
        job.finished_at,
        completionId,
        job.elapsed_ms,
        job.finished_at,
        job.session_id,
        job.finished_at,
        VERSION_FIELDS.rulesVersion,
        VERSION_FIELDS.replayVersion,
        VERSION_FIELDS.generatorVersion,
        session.initial_commitment,
        session.scope_digest,
        job.timing_revision,
        job.id
      ),
      database.prepare(INSERT_COMPLETION_SQL).bind(...insertParams),
      database.prepare(COMPLETE_JOB_SQL).bind(
        completionId,
        nowDate(dependencies).toISOString(),
        job.id,
        job.progress_revision,
        job.progress_token,
        job.checkpoint_digest
      ),
    ]);
  } catch (error) {
    const duplicate = await database
      .prepare(SELECT_COMPLETION_BY_SESSION_SQL)
      .bind(job.session_id)
      .first();
    if (duplicate?.request_digest === job.request_digest) return completionResponse(duplicate);
    if (await database.prepare(SELECT_COMPLETION_BY_EVENT_SQL).bind(job.event_id).first()) {
      throw new HttpError(409, "Event id is already reserved by another completion");
    }
    throw error;
  }
  if (results.some((item) => getChanges(item) !== 1)) {
    const duplicate = await database
      .prepare(SELECT_COMPLETION_BY_SESSION_SQL)
      .bind(job.session_id)
      .first();
    if (duplicate?.request_digest === job.request_digest) return completionResponse(duplicate);
    throw new HttpError(409, "Verification completion changed concurrently");
  }
  return Object.freeze({
    completion: Object.freeze({
      id: completionId,
      token: receiptToken,
      expiresAt: job.expires_at,
      event: Object.freeze(canonicalEvent),
      elapsedMs: Number(job.elapsed_ms),
    }),
  });
};

export const continueVerifiedSession = async (
  request,
  env,
  sessionId,
  rawPayload,
  dependencies = {}
) => {
  let payload;
  try {
    payload = readContinueRequest(rawPayload);
  } catch (error) {
    return translateRuleError(error);
  }
  if (payload.session.id !== sessionId) {
    throw new HttpError(403, "Session proof does not match this continuation");
  }
  const database = getGameStatsDatabase(env);
  const job = await database
    .prepare(SELECT_COMPLETION_JOB_BY_ID_SQL)
    .bind(payload.progress.id)
    .first();
  if (!job || job.session_id !== sessionId) {
    throw new HttpError(409, "Verification progress is no longer on record");
  }
  const proof = await verifyProgressProof(env, job, payload.progress.token);
  if (Number(proof.revision) < Number(job.progress_revision)) {
    await enforceRateLimit(
      env,
      await hmacDigest(
        requireSecurityConfig(env).ipHashSecret,
        getClientIp(request)
      ),
      "verification-continuations",
      MAX_VERIFICATION_CONTINUATIONS_PER_WINDOW
    );
    return nextProgressResponse(database, job.id, Number(proof.revision));
  }
  if (Number(proof.revision) !== Number(job.progress_revision) ||
      payload.progress.token !== job.progress_token) {
    throw new HttpError(409, "Verification progress is stale");
  }
  const existingCompletion = await getCompletionForJob(database, job);
  if (existingCompletion) return completionResponse(existingCompletion);
  if (
    Number(job.rules_version) !== VERSION_FIELDS.rulesVersion ||
    Number(job.replay_version) !== VERSION_FIELDS.replayVersion
  ) {
    throw new HttpError(409, "Verification job uses an unsupported version");
  }
  if (Date.parse(job.expires_at) <= nowDate(dependencies).getTime()) {
    throw sessionExpiredError("Game session has expired during verification");
  }
  if (
    !Number.isSafeInteger(Number(job.continuation_limit)) ||
    Number(job.continuation_limit) < 1 ||
    Number(job.continuation_limit) > MAX_VERIFICATION_JOB_CONTINUATIONS
  ) {
    throw new HttpError(409, "Verification job has an invalid continuation limit");
  }
  if (Number(job.request_count) >= Number(job.continuation_limit)) {
    throw replayLimitError("Verification continuation limit exceeded");
  }
  const session = await loadVerifiedSession(env, sessionId);
  await validateVerifiedProof(
    request,
    env,
    session,
    payload.session.token,
    { requireUnexpired: false, verifyInitial: false }
  );
  if (session.finish_job_id !== job.id || session.timing_phase !== "finishing") {
    throw new HttpError(409, "Game session is not bound to this verification job");
  }
  const ipHash = await hmacDigest(
    requireSecurityConfig(env).ipHashSecret,
    getClientIp(request)
  );
  await enforceRateLimit(
    env,
    ipHash,
    "verification-continuations",
    MAX_VERIFICATION_CONTINUATIONS_PER_WINDOW
  );
  if (job.stage === "finalize") {
    return finalizeJob(env, database, session, job, dependencies);
  }
  if (job.stage !== "replay") throw new HttpError(409, "Invalid verification job state");

  const nextTimingRevision = Number(job.timing_verified_revision) + 1;
  if (nextTimingRevision <= Number(job.timing_revision)) {
    const timing = await database
      .prepare(SELECT_TIMING_REVISION_SQL)
      .bind(sessionId, nextTimingRevision)
      .first();
    if (!timing) throw new HttpError(409, "Timing evidence is incomplete");
    if (Number(timing.input_count) < Number(job.input_cursor)) {
      throw new HttpError(400, "Replay passed unverified timing evidence");
    }
    if (Number(timing.input_count) === Number(job.input_cursor)) {
      const canonicalPrefix = await canonicalPrefixAt(database, job.id, job.input_cursor);
      const prefixHash = await digestText(`[${canonicalPrefix}]`);
      if (prefixHash !== timing.input_hash) {
        throw new HttpError(400, "Replay does not match acknowledged timing evidence");
      }
      const timingVerifiedRevision = nextTimingRevision;
      const replayDone = Number(job.input_cursor) === Number(job.input_count) &&
        (session.game !== "snake" ||
          Number(job.tick_cursor) === Number(job.terminal_tick));
      return commitCheckpoint(env, database, job, {
        timing_verified_revision: timingVerifiedRevision,
        input_cursor: Number(job.input_cursor),
        tick_cursor: Number(job.tick_cursor),
        state_json: job.state_json,
        work_used: Number(job.work_used),
        stage: replayDone && timingVerifiedRevision === Number(job.timing_revision)
          ? "finalize"
          : job.stage,
      });
    }
  }

  const inputLimit = Math.min(
    Number(job.input_count),
    Number(job.input_cursor) + MAX_VERIFICATION_BATCH_OPERATIONS
  );
  const inputRows = (await database
    .prepare(SELECT_JOB_INPUTS_SQL)
    .bind(job.input_cursor, inputLimit, job.id, inputLimit)
    .all()).results || [];
  const replayStartedAt = typeof dependencies.onVerificationBatch === "function"
    ? performance.now()
    : 0;
  const engine = resolveEngine(session.game, dependencies);
  let state;
  if (job.state_json) {
    state = parseJsonColumn(job.state_json, "verification checkpoint");
  } else {
    const initial = parseJsonColumn(session.initial_json, "initial game state");
    if (await digestCanonical(initial) !== session.initial_commitment) {
      throw new HttpError(403, "Stored initial game state commitment changed");
    }
    state = engine.initial(initial);
  }
  let inputCursor = Number(job.input_cursor);
  let tickCursor = Number(job.tick_cursor);
  const canonicalInputs = [];
  let batchWork = 0;
  let canonicalBytes = 0;
  let operations = 0;
  const checkpointBytes = textEncoder.encode(
    String(job.state_json || session.initial_json)
  ).byteLength;
  if (checkpointBytes > MAX_VERIFICATION_CHECKPOINT_BYTES) {
    throw replayLimitError("Verification checkpoint is too large");
  }
  const nextBoundary = nextTimingRevision <= Number(job.timing_revision)
    ? Number((await database
      .prepare(SELECT_TIMING_REVISION_SQL)
      .bind(sessionId, nextTimingRevision)
      .first()).input_count)
    : Number(job.input_count);

  while (operations < MAX_VERIFICATION_BATCH_OPERATIONS) {
    if (inputCursor === nextBoundary && nextTimingRevision <= Number(job.timing_revision)) break;
    let input;
    let consumesInput = false;
    if (session.game === "snake") {
      const nextInput = inputCursor < Number(job.input_count)
        ? replayInputAt(inputRows, inputCursor)
        : null;
      if (nextInput && !Number.isSafeInteger(nextInput.tick)) {
        throw new HttpError(400, "Invalid Snake input tick");
      }
      if (nextInput && nextInput.tick < tickCursor) {
        throw new HttpError(400, "Snake inputs are out of order");
      }
      if (nextInput && nextInput.tick === tickCursor) {
        input = nextInput;
        consumesInput = true;
      } else if (tickCursor < Number(job.terminal_tick)) {
        input = null;
      } else {
        if (nextInput) throw new HttpError(400, "Snake input occurs after terminal tick");
        break;
      }
    } else {
      if (inputCursor >= Number(job.input_count)) break;
      input = replayInputAt(inputRows, inputCursor);
      consumesInput = true;
    }
    if ((operations + 1) * checkpointBytes > MAX_VERIFICATION_BATCH_CLONE_BYTES) {
      if (operations === 0) {
        throw replayLimitError("One replay action requires too much checkpoint cloning");
      }
      break;
    }
    const canonicalInput = consumesInput ? commonRules.canonicalJson(input) : "";
    const canonicalInputBytes = textEncoder.encode(canonicalInput).byteLength;
    if (canonicalInputBytes > MAX_VERIFICATION_ACTION_BYTES) {
      throw replayLimitError("One replay action is too large");
    }
    if (canonicalBytes + canonicalInputBytes > MAX_VERIFICATION_BATCH_CANONICAL_BYTES) break;
    let transitioned;
    try {
      transitioned = transitionOne(
        engine,
        state,
        input,
        MAX_VERIFICATION_BATCH_WORK - batchWork,
        !consumesInput
      );
    } catch (error) {
      if (error instanceof BatchWorkExhausted) break;
      return translateRuleError(error);
    }
    state = transitioned.state;
    batchWork += transitioned.work;
    operations += 1;
    if (consumesInput) {
      canonicalInputs.push(canonicalInput);
      canonicalBytes += canonicalInputBytes;
      inputCursor += 1;
    } else {
      tickCursor += 1;
    }
    if (Number(job.work_used) + batchWork > commonRules.GAME_RULE_LIMITS[session.game].work) {
      throw replayLimitError("Game verification work limit exceeded");
    }
  }
  if (operations === 0) {
    throw new HttpError(400, "Replay cannot advance verification progress");
  }
  const stateJson = commonRules.canonicalJson(state);
  if (textEncoder.encode(stateJson).byteLength > MAX_VERIFICATION_CHECKPOINT_BYTES) {
    throw replayLimitError("Verification checkpoint is too large");
  }
  if (replayStartedAt) {
    dependencies.onVerificationBatch(Object.freeze({
      operations,
      work: batchWork,
      wallMs: performance.now() - replayStartedAt,
    }));
  }
  const replayDone = inputCursor === Number(job.input_count) &&
    (session.game !== "snake" || tickCursor === Number(job.terminal_tick));
  const timingDone = Number(job.timing_verified_revision) === Number(job.timing_revision);
  return commitCheckpoint(env, database, job, {
    timing_verified_revision: Number(job.timing_verified_revision),
    input_cursor: inputCursor,
    tick_cursor: tickCursor,
    canonical_chunk: canonicalInputs.join(","),
    state_json: stateJson,
    work_used: Number(job.work_used) + batchWork,
    stage: replayDone && timingDone ? "finalize" : "replay",
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
    throw sessionExpiredError("Completion receipt has expired");
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
