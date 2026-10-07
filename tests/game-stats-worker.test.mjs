import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  normalizeGameStatsEvent,
  purgeExpiredGameStatsRows,
} from "../workers/game-stats/src/index.mjs";
import {
  MAX_EVENTS_PER_WINDOW,
  MAX_SESSIONS_PER_WINDOW,
  SESSION_TTL_MS,
} from "../workers/game-stats/src/constants.mjs";
import { createGameStatsDataFromEvents } from "./helpers/game-stats-reference.mjs";
import { SqliteD1Database, applyGameStatsMigrations } from "./helpers/sqlite-d1.mjs";

const gameStatsMigrationPaths = [
  "0001_create_game_stats.sql",
  "0002_add_game_stat_security.sql",
  "0003_add_sudoku_puzzle_identity.sql",
  "0004_optimize_stats_aggregation.sql",
  "0005_add_verified_game_results.sql",
].map((name) => new URL(`../workers/game-stats/migrations/${name}`, import.meta.url).pathname);

const projectEventRow = (sql, row) => {
  const selection = /^\s*SELECT\s+([\s\S]+?)\s+FROM\s+game_events\b/i.exec(sql)?.[1];
  assert.ok(selection, `Missing game_events projection: ${sql}`);
  const columns = selection.split(",").map((column) => column.trim());
  return Object.fromEntries(columns.map((column) => [column, row[column]]));
};

class MockD1Statement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async run() {
    if (this.sql.includes("INSERT INTO game_events")) {
      const [
        id,
        game,
        type,
        difficulty,
        boardSize,
        hintBucket,
        metric,
        metricKind,
        playerId,
        playerName,
        playerIcon,
        occurredAt,
        puzzleKey,
      ] = this.params;
      if (this.database.failNextEventInsert) {
        this.database.failNextEventInsert = false;
        throw new Error("Simulated event insert failure");
      }
      if (this.database.events.has(id)) {
        throw new Error("UNIQUE constraint failed: game_events.id");
      }
      // Mirrors the partial unique index migration 0003 adds.
      if (
        puzzleKey &&
        playerId &&
        [...this.database.events.values()].some(
          (row) => row.puzzle_key === puzzleKey && row.player_id === playerId
        )
      ) {
        throw new Error(
          "UNIQUE constraint failed: game_events.player_id, game_events.puzzle_key"
        );
      }
      if (this.sql.includes("FROM game_stat_sessions")) {
        const sessionId = this.params[13];
        const unexpiredAt = this.params[14];
        const session = this.database.sessions.get(sessionId);
        if (!session || session.consumed_at || session.expires_at <= unexpiredAt) {
          return { meta: { changes: 0 } };
        }
      }
      this.database.events.set(id, {
        id,
        game,
        type,
        difficulty,
        board_size: boardSize,
        hint_bucket: hintBucket,
        metric,
        metric_kind: metricKind,
        player_id: playerId,
        player_name: playerName,
        player_icon: playerIcon,
        occurred_at: occurredAt,
        puzzle_key: puzzleKey ?? null,
      });
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT INTO game_stat_sessions")) {
      const [id, game, configJson, buildVersion, ipHash, issuedAt, expiresAt] = this.params;
      this.database.sessions.set(id, {
        id,
        game,
        config_json: configJson,
        build_version: buildVersion,
        ip_hash: ipHash,
        issued_at: issuedAt,
        expires_at: expiresAt,
        consumed_at: null,
      });
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("UPDATE game_stat_sessions")) {
      if (this.database.failNextSessionConsume) {
        this.database.failNextSessionConsume = false;
        throw new Error("Simulated session consume failure");
      }
      const [consumedAt, id, now] = this.params;
      const session = this.database.sessions.get(id);
      if (!session || session.consumed_at || session.expires_at <= now) {
        return { meta: { changes: 0 } };
      }
      session.consumed_at = consumedAt;
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT INTO game_stats_rate_limits")) {
      this.upsertRateLimit();
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("DELETE FROM game_stat_sessions")) {
      return { meta: { changes: this.database.deleteExpired("sessions", this.params[0]) } };
    }
    if (this.sql.includes("DELETE FROM verified_timing_transitions")) {
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes("DELETE FROM verified_completion_progress")) {
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes("DELETE FROM verified_completion_replay_chunks")) {
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes("DELETE FROM verified_completion_jobs")) {
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes("DELETE FROM verified_game_completions")) {
      // This legacy fixture contains no verified completion receipts.
      return { meta: { changes: 0 } };
    }
    if (this.sql.includes("DELETE FROM game_stats_rate_limits")) {
      return {
        meta: { changes: this.database.deleteExpired("rateLimits", this.params[0]) },
      };
    }
    throw new Error(`Unhandled write query: ${this.sql}`);
  }

  /** Mirrors the rate-limit upsert and its `RETURNING request_count` row. */
  upsertRateLimit() {
    const [bucket, windowStartedAt, expiresAt, resetThreshold] = this.params;
    const existing = this.database.rateLimits.get(bucket);
    if (!existing || existing.window_started_at <= resetThreshold) {
      this.database.rateLimits.set(bucket, {
        request_count: 1,
        window_started_at: windowStartedAt,
        expires_at: expiresAt,
      });
    } else {
      existing.request_count += 1;
      existing.expires_at = expiresAt;
    }
    return { request_count: this.database.rateLimits.get(bucket).request_count };
  }

  async all() {
    assert.match(this.sql, /FROM game_events/);
    return {
      results: Array.from(this.database.events.values(), (row) => projectEventRow(this.sql, row)),
    };
  }

  async first() {
    if (this.sql.includes("INSERT INTO game_stats_rate_limits")) {
      return this.upsertRateLimit();
    }
    if (this.sql.includes("FROM sqlite_master")) {
      if (this.database.failHealthCheck) throw new Error("Simulated D1 health check failure");
      return { table_count: this.database.healthTableCount };
    }
    if (/FROM\s+game_events\s+WHERE\s+id/i.test(this.sql)) {
      const row = this.database.events.get(this.params[0]);
      return row ? projectEventRow(this.sql, row) : null;
    }
    if (/FROM\s+game_events\s+WHERE\s+player_id\s*=\s*\?\s+AND\s+puzzle_key/i.test(this.sql)) {
      const [playerId, puzzleKey] = this.params;
      const row = [...this.database.events.values()].find(
        (candidate) =>
          candidate.player_id === playerId && candidate.puzzle_key === puzzleKey
      );
      return row ? projectEventRow(this.sql, row) : null;
    }
    if (this.sql.includes("FROM game_stat_sessions")) {
      return this.database.sessions.get(this.params[0]) || null;
    }
    throw new Error(`Unhandled read query: ${this.sql}`);
  }
}

class MockD1Database {
  constructor() {
    this.events = new Map();
    this.sessions = new Map();
    this.rateLimits = new Map();
    this.failNextEventInsert = false;
    this.failNextSessionConsume = false;
    this.failHealthCheck = false;
    this.healthTableCount = 8;
    this.batchTail = Promise.resolve();
  }

  prepare(sql) {
    return new MockD1Statement(this, sql);
  }

  /** Mirrors `WHERE expires_at <= ?` for the scheduled purge. */
  deleteExpired(table, expiredAt) {
    let changes = 0;
    for (const [key, row] of this[table]) {
      if (row.expires_at <= expiredAt) {
        this[table].delete(key);
        changes += 1;
      }
    }
    return changes;
  }

  async batch(statements) {
    if (statements.some(({ sql }) => sql.includes("valid_event_candidates AS"))) {
      const sqliteDatabase = new SqliteD1Database();
      try {
        applyGameStatsMigrations(sqliteDatabase, gameStatsMigrationPaths);
        const insert = sqliteDatabase.sqlite.prepare(`
          INSERT INTO game_events (
            id, game, type, difficulty, board_size, hint_bucket, metric, metric_kind,
            player_id, player_name, player_icon, occurred_at, puzzle_key
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const row of this.events.values()) {
          insert.run(
            row.id,
            row.game,
            row.type,
            row.difficulty,
            row.board_size,
            row.hint_bucket,
            row.metric,
            row.metric_kind,
            row.player_id,
            row.player_name,
            row.player_icon,
            row.occurred_at,
            row.puzzle_key
          );
        }
        return await sqliteDatabase.batch(
          statements.map(({ sql, params }) => sqliteDatabase.prepare(sql).bind(...params))
        );
      } finally {
        sqliteDatabase.close();
      }
    }
    const previousBatch = this.batchTail;
    let releaseBatch;
    this.batchTail = new Promise((resolve) => {
      releaseBatch = resolve;
    });
    await previousBatch;
    const copyRows = (rows) =>
      new Map(Array.from(rows, ([key, value]) => [key, { ...value }]));
    const snapshot = {
      events: copyRows(this.events),
      sessions: copyRows(this.sessions),
      rateLimits: copyRows(this.rateLimits),
    };
    try {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    } catch (error) {
      this.events = snapshot.events;
      this.sessions = snapshot.sessions;
      this.rateLimits = snapshot.rateLimits;
      throw error;
    } finally {
      releaseBatch();
    }
  }
}

const buildVersion = `sha256-${"a".repeat(64)}`;

const createEnv = (overrides = {}) => ({
  personal_site_game_stats: new MockD1Database(),
  ALLOWED_ORIGIN: "https://rohin.shanker.me",
  LOCAL_ALLOWED_ORIGIN: "http://127.0.0.1:8000",
  EXTRA_ALLOWED_ORIGINS: "http://127.0.0.1:8011",
  EVENT_SIGNING_SECRET: "test-event-signing-secret",
  IP_HASH_SECRET: "test-ip-hash-secret",
  ADMIN_USERNAME: "test-administrator",
  ADMIN_PASSWORD: "test-administrator-password",
  ADMIN_SESSION_SIGNING_SECRET: "test-administrator-session-signing-secret",
  GAME_BUILD_VERSION: buildVersion,
  // Legacy behavior is exercised only as an explicit compatibility fixture.
  // Production defaults closed when this server-controlled cutoff is absent.
  LEGACY_RESULT_ISSUANCE_CUTOFF: "2999-01-01T00:00:00.000Z",
  ...overrides,
});

const profile = (id, name = id) => ({
  id,
  name,
  icon: "assets/app-icons/ico/user_card.ico",
});

const event = (overrides = {}) => {
  const rawEvent = {
    id: "event-0001",
    game: "minesweeper",
    type: "win",
    metric: 42,
    metricKind: "seconds",
    occurredAt: new Date().toISOString(),
    profile: profile("player-0001", "Mira"),
    ...overrides,
  };
  if (rawEvent.game === "minesweeper" && !Object.hasOwn(overrides, "difficulty")) {
    rawEvent.difficulty = "beginner";
  }
  return Object.fromEntries(
    Object.entries(rawEvent).filter(([, value]) => value !== undefined)
  );
};

const jsonRequest = (
  path,
  body,
  {
    origin = "https://rohin.shanker.me",
    ip = "203.0.113.7",
    authorization = "",
  } = {}
) =>
  new Request(`https://stats.example.test${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
      "CF-Connecting-IP": ip,
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  });

const readJson = async (response) => JSON.parse(await response.text());

const createSession = async (env, game, config, options = {}) => {
  const response = await worker.fetch(
    jsonRequest(
      "/sessions",
      { game, config, buildVersion: env.GAME_BUILD_VERSION, ...options },
      options
    ),
    env
  );
  assert.equal(response.status, 201);
  return readJson(response);
};

const signInAsAdministrator = (env, body, options = {}) =>
  worker.fetch(jsonRequest("/administrator/sign-in", body, options), env);

const ageSessionForCompletion = async (env, sessionProof, elapsedMs = 15_000) => {
  const storedSession = env.personal_site_game_stats.sessions.get(sessionProof.id);
  const [encodedPayload] = sessionProof.token.split(".");
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const issuedAtMs = Date.now() - elapsedMs;
  const issuedAt = new Date(issuedAtMs).toISOString();
  const expiresAt = new Date(issuedAtMs + 6 * 60 * 60 * 1000).toISOString();

  payload.issuedAt = issuedAt;
  payload.expiresAt = expiresAt;
  const nextEncodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.EVENT_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(nextEncodedPayload)
  );

  storedSession.issued_at = issuedAt;
  storedSession.expires_at = expiresAt;
  sessionProof.token = `${nextEncodedPayload}.${Buffer.from(signature).toString("base64url")}`;
  sessionProof.expiresAt = expiresAt;
};

const withMockedNow = async (initialNow, callback) => {
  const originalNow = Date.now;
  let currentNow = initialNow;
  Date.now = () => currentNow;
  try {
    return await callback({
      advance: (delayMs) => {
        currentNow += delayMs;
      },
    });
  } finally {
    Date.now = originalNow;
  }
};

const withScheduler = async (wait, callback) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "scheduler");
  Object.defineProperty(globalThis, "scheduler", {
    configurable: true,
    value: { wait },
  });
  try {
    return await callback();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "scheduler", descriptor);
    } else {
      delete globalThis.scheduler;
    }
  }
};

const postEvent = (env, rawEvent, session, options = {}) =>
  worker.fetch(
    jsonRequest(
      "/events",
      { event: rawEvent, session: { id: session.id, token: session.token } },
      options
    ),
    env
  );

const storeTrustedEvent = (env, rawEvent) => {
  env.personal_site_game_stats.events.set(rawEvent.id, {
    id: rawEvent.id,
    game: rawEvent.game,
    type: rawEvent.type,
    difficulty: rawEvent.difficulty || null,
    board_size: rawEvent.boardSize || null,
    hint_bucket: rawEvent.hintBucket || null,
    metric:
      rawEvent.metric === null || rawEvent.metric === undefined ? null : Number(rawEvent.metric),
    metric_kind: rawEvent.metricKind || null,
    player_id: rawEvent.profile?.id || null,
    player_name: rawEvent.profile?.name || null,
    player_icon: rawEvent.profile?.icon || null,
    occurred_at: rawEvent.occurredAt,
    puzzle_key:
      rawEvent.puzzleId && rawEvent.puzzle
        ? `${rawEvent.puzzleId}:${rawEvent.puzzle}`
        : null,
  });
};

const SUDOKU_PUZZLE = "402030000795020003001705400100004005609000000248507310900108500800050071017043092";

/**
 * Two tabs finishing the same puzzle is the race the browser's claim list
 * cannot close. The Worker deduplicates on the puzzle identity and the player,
 * so the second event id is answered with the result that already stands.
 */
test("records one Sudoku win per puzzle and player however many tabs report it", async () => {
  const env = createEnv();
  const player = profile("player-sudoku-identity", "Identity");
  const identity = { puzzleId: "generated-easy-abc123", puzzle: SUDOKU_PUZZLE };

  const firstSession = await createSession(env, "sudoku", { difficulty: "easy" });
  await ageSessionForCompletion(env, firstSession);
  const firstEvent = event({
    id: "event-sudoku-identity-a",
    game: "sudoku",
    type: "win",
    difficulty: "easy",
    hintBucket: "noHints",
    ...identity,
    metric: 91,
    metricKind: "seconds",
    profile: player,
  });
  const firstResponse = await postEvent(env, firstEvent, firstSession);

  assert.equal(firstResponse.status, 201);
  assert.deepEqual(await readJson(firstResponse), {
    ok: true,
    applied: true,
    eventId: firstEvent.id,
  });
  assert.equal(
    env.personal_site_game_stats.events.get(firstEvent.id).puzzle_key,
    `${identity.puzzleId}:${identity.puzzle}`
  );

  // A second tab, its own event id and its own session, same puzzle.
  const secondSession = await createSession(env, "sudoku", { difficulty: "easy" });
  await ageSessionForCompletion(env, secondSession);
  const secondEvent = { ...firstEvent, id: "event-sudoku-identity-b", metric: 77 };
  const secondResponse = await postEvent(env, secondEvent, secondSession);

  assert.equal(secondResponse.status, 200);
  assert.deepEqual(await readJson(secondResponse), {
    ok: true,
    applied: false,
    eventId: firstEvent.id,
  });
  assert.equal(env.personal_site_game_stats.events.size, 1);
  // The duplicate is a submission like any other: its session was validated
  // and spent, so it cannot be turned on a different result afterwards.
  assert.ok(env.personal_site_game_stats.sessions.get(secondSession.id).consumed_at);
  const reuseResponse = await postEvent(
    env,
    {
      ...firstEvent,
      id: "event-sudoku-identity-reuse",
      puzzleId: "generated-easy-reuse",
    },
    secondSession
  );
  assert.equal(reuseResponse.status, 409);
  assert.match((await readJson(reuseResponse)).error, /session was already used/);
  assert.equal(env.personal_site_game_stats.events.size, 1);

  // Another player finishing the same puzzle is not a duplicate.
  const otherSession = await createSession(env, "sudoku", { difficulty: "easy" });
  await ageSessionForCompletion(env, otherSession);
  const otherResponse = await postEvent(
    env,
    {
      ...firstEvent,
      id: "event-sudoku-identity-c",
      profile: profile("player-sudoku-other", "Other"),
    },
    otherSession
  );

  assert.equal(otherResponse.status, 201);
  assert.equal(env.personal_site_game_stats.events.size, 2);
});

/**
 * The same race, but with both writes in flight: the fast path finds nothing,
 * and the partial unique index is what rejects the second insert.
 */
test("rejects a simultaneous second win for one puzzle at the unique index", async () => {
  const env = createEnv();
  const player = profile("player-sudoku-race", "Racer");
  const sessions = await Promise.all([
    createSession(env, "sudoku", { difficulty: "hard" }),
    createSession(env, "sudoku", { difficulty: "hard" }),
  ]);
  await Promise.all(sessions.map((session) => ageSessionForCompletion(env, session)));
  const base = event({
    game: "sudoku",
    type: "win",
    difficulty: "hard",
    hintBucket: "noHints",
    puzzleId: "generated-hard-def456",
    puzzle: SUDOKU_PUZZLE,
    metric: 123,
    metricKind: "seconds",
    profile: player,
  });

  const responses = await Promise.all([
    postEvent(env, { ...base, id: "event-sudoku-race-a" }, sessions[0]),
    postEvent(env, { ...base, id: "event-sudoku-race-b" }, sessions[1]),
  ]);
  const statuses = responses.map((response) => response.status).sort();
  const bodies = await Promise.all(responses.map(readJson));

  assert.deepEqual(statuses, [200, 201]);
  assert.deepEqual(
    bodies.map((body) => body.applied).sort(),
    [false, true]
  );
  assert.equal(env.personal_site_game_stats.events.size, 1);
  // Both answers name the row that actually stands. The loser's own id was
  // never stored, so returning it would send the client looking in `/stats`
  // for an event that does not exist.
  const [storedId] = [...env.personal_site_game_stats.events.keys()];
  assert.deepEqual(
    bodies.map((body) => body.eventId),
    [storedId, storedId]
  );
  // Replaying the loser gets the same standing result rather than a conflict.
  const loserId = ["event-sudoku-race-a", "event-sudoku-race-b"].find(
    (id) => id !== storedId
  );
  const replaySession = await createSession(env, "sudoku", { difficulty: "hard" });
  await ageSessionForCompletion(env, replaySession);
  const replayResponse = await postEvent(env, { ...base, id: loserId }, replaySession);
  assert.equal(replayResponse.status, 200);
  assert.deepEqual(await readJson(replayResponse), {
    ok: true,
    applied: false,
    eventId: storedId,
  });
  // Both sessions are spent: the loser's was consumed on its own after the
  // batch rolled back, so it cannot be replayed with a different result.
  assert.ok(
    sessions.every(
      (session) => env.personal_site_game_stats.sessions.get(session.id).consumed_at
    )
  );
});

/**
 * A duplicate is acknowledged, not waved through. The shortcut sits behind
 * session validation, so an unusable session is still refused, and two results
 * racing one session end on the standing row rather than on a conflict.
 */
test("a duplicate Sudoku win is still validated like any other submission", async () => {
  const env = createEnv();
  const player = profile("player-sudoku-guard", "Guard");
  const identity = { puzzleId: "generated-medium-guard", puzzle: SUDOKU_PUZZLE };
  const base = event({
    game: "sudoku",
    type: "win",
    difficulty: "medium",
    hintBucket: "noHints",
    ...identity,
    metric: 143,
    metricKind: "seconds",
    profile: player,
  });

  const firstSession = await createSession(env, "sudoku", { difficulty: "medium" });
  await ageSessionForCompletion(env, firstSession);
  assert.equal(
    (await postEvent(env, { ...base, id: "event-guard-a" }, firstSession)).status,
    201
  );

  // A session for another game cannot buy a duplicate acknowledgement.
  const wrongGameSession = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, wrongGameSession);
  const wrongGameResponse = await postEvent(
    env,
    { ...base, id: "event-guard-wrong-game" },
    wrongGameSession
  );
  assert.equal(wrongGameResponse.status, 403);

  // Neither can a session started for a different difficulty.
  const wrongConfigSession = await createSession(env, "sudoku", { difficulty: "hard" });
  await ageSessionForCompletion(env, wrongConfigSession);
  const wrongConfigResponse = await postEvent(
    env,
    { ...base, id: "event-guard-wrong-config" },
    wrongConfigSession
  );
  assert.equal(wrongConfigResponse.status, 400);
  assert.match(
    (await readJson(wrongConfigResponse)).error,
    /does not match the started game/
  );

  // An unsigned session proof is refused before the duplicate is looked up.
  const forgedResponse = await postEvent(
    env,
    { ...base, id: "event-guard-forged" },
    { id: firstSession.id, token: `${firstSession.token}x` }
  );
  assert.ok(forgedResponse.status >= 400);

  assert.equal(env.personal_site_game_stats.events.size, 1);

  // Two results for one puzzle sharing a session: the loser is told which row
  // stands instead of being refused for a session it did nothing wrong with.
  const sharedSession = await createSession(env, "sudoku", { difficulty: "medium" });
  await ageSessionForCompletion(env, sharedSession);
  const sharedResponses = await Promise.all([
    postEvent(env, { ...base, id: "event-guard-shared-a" }, sharedSession),
    postEvent(env, { ...base, id: "event-guard-shared-b" }, sharedSession),
  ]);
  const sharedBodies = await Promise.all(sharedResponses.map(readJson));

  assert.deepEqual(
    sharedResponses.map((response) => response.status),
    [200, 200]
  );
  assert.deepEqual(
    sharedBodies.map((body) => body.eventId),
    ["event-guard-a", "event-guard-a"]
  );
  assert.equal(env.personal_site_game_stats.events.size, 1);
});

/** Rolling compatibility: a browser that predates the identity still publishes. */
test("accepts a Sudoku win with no puzzle identity and rejects a half one", async () => {
  const env = createEnv();
  const session = await createSession(env, "sudoku", { difficulty: "medium" });
  await ageSessionForCompletion(env, session);
  const legacyEvent = event({
    id: "event-sudoku-no-identity",
    game: "sudoku",
    type: "win",
    difficulty: "medium",
    hintBucket: "noHints",
    metric: 64,
    metricKind: "seconds",
    profile: profile("player-sudoku-legacy", "Legacy"),
  });

  const response = await postEvent(env, legacyEvent, session);

  assert.equal(response.status, 201);
  assert.equal(env.personal_site_game_stats.events.get(legacyEvent.id).puzzle_key, null);

  // One field without the other is malformed, not legacy.
  const halfSession = await createSession(env, "sudoku", { difficulty: "medium" });
  await ageSessionForCompletion(env, halfSession);
  const halfResponse = await postEvent(
    env,
    { ...legacyEvent, id: "event-sudoku-half-identity", puzzleId: "generated-medium-1" },
    halfSession
  );

  assert.equal(halfResponse.status, 400);
  assert.match((await readJson(halfResponse)).error, /Sudoku puzzle/);
  assert.equal(
    env.personal_site_game_stats.sessions.get(halfSession.id).consumed_at,
    null
  );

  // So is a puzzle string that is not a board.
  const shapeSession = await createSession(env, "sudoku", { difficulty: "medium" });
  await ageSessionForCompletion(env, shapeSession);
  const shapeResponse = await postEvent(
    env,
    {
      ...legacyEvent,
      id: "event-sudoku-bad-identity",
      puzzleId: "generated-medium-1",
      puzzle: "not-a-board",
    },
    shapeSession
  );

  assert.equal(shapeResponse.status, 400);
  assert.match((await readJson(shapeResponse)).error, /Invalid Sudoku puzzle identity/);
});

/** A row stored before the rollout has no key, so a retry that brings one matches. */
test("replays an identified event id against a row stored without an identity", async () => {
  const env = createEnv();
  const identifiedEvent = event({
    id: "event-sudoku-rollout-replay",
    game: "sudoku",
    type: "win",
    difficulty: "easy",
    hintBucket: "noHints",
    puzzleId: "generated-easy-rollout",
    puzzle: SUDOKU_PUZZLE,
    metric: 55,
    metricKind: "seconds",
    profile: profile("player-sudoku-rollout", "Rollout"),
  });
  const { puzzleId, puzzle, ...storedEvent } = identifiedEvent;
  storeTrustedEvent(env, storedEvent);
  const session = await createSession(env, "sudoku", { difficulty: "easy" });
  await ageSessionForCompletion(env, session);

  const response = await postEvent(env, identifiedEvent, session);

  assert.equal(response.status, 200);
  assert.deepEqual(await readJson(response), {
    ok: true,
    applied: false,
    eventId: identifiedEvent.id,
  });

  // Only the stored key can contradict one: a row written without an identity
  // accepts whichever the retry brings, and a row written with one does not.
  storeTrustedEvent(env, { ...identifiedEvent, id: "event-sudoku-rollout-keyed" });
  const conflictResponse = await postEvent(
    env,
    {
      ...identifiedEvent,
      id: "event-sudoku-rollout-keyed",
      puzzleId: "generated-easy-other",
    },
    session
  );

  assert.equal(conflictResponse.status, 409);
  assert.match(
    (await readJson(conflictResponse)).error,
    /already exists with a different result/
  );
});

test("normalizes all supported game shapes and rejects malformed data", () => {
  assert.equal(normalizeGameStatsEvent(event()).metricKind, "seconds");
  assert.equal(
    normalizeGameStatsEvent(
      event({
        id: "event-0002",
        game: "solitaire",
        metric: 78,
        metricKind: "moves",
      })
    ).metricKind,
    "moves"
  );
  assert.equal(
    normalizeGameStatsEvent(
      event({
        id: "event-0003",
        game: "snake",
        type: "gamePlayed",
        boardSize: "16",
        metric: 9,
        metricKind: "score",
      })
    ).boardSize,
    "16"
  );
  assert.equal(
    normalizeGameStatsEvent(
      event({
        id: "event-0004",
        game: "sudoku",
        type: "win",
        difficulty: "hard",
        hintBucket: "withHints",
        metric: 321,
        metricKind: "seconds",
        profile: null,
      })
    ).metricKind,
    "seconds"
  );
  assert.throws(
    () => normalizeGameStatsEvent(event({ id: "event-0005", extra: "nope" })),
    /Unknown event field/
  );
  assert.throws(
    () =>
      normalizeGameStatsEvent(
        event({ id: "event-0006", occurredAt: "2000-01-01T00:00:00.000Z" })
      ),
    /outside the accepted window/
  );
});

test("returns complete lifetime totals only for the requested player", () => {
  const requestedProfile = profile("player-overall-totals", "Overall Totals");
  const otherProfile = profile("player-other-totals", "Other Totals");
  const occurredAt = new Date().toISOString();
  const events = [
    event({ id: "overall-ms-beginner-1", profile: requestedProfile, occurredAt }),
    event({ id: "overall-ms-beginner-2", profile: requestedProfile, occurredAt }),
    event({
      id: "overall-ms-expert-1",
      difficulty: "expert",
      profile: requestedProfile,
      occurredAt,
    }),
    event({ id: "overall-ms-other-1", profile: otherProfile, occurredAt }),
    event({
      id: "overall-solitaire-1",
      game: "solitaire",
      metric: 80,
      metricKind: "moves",
      profile: requestedProfile,
      occurredAt,
    }),
    event({
      id: "overall-solitaire-2",
      game: "solitaire",
      metric: 90,
      metricKind: "moves",
      profile: requestedProfile,
      occurredAt,
    }),
    event({
      id: "overall-solitaire-other",
      game: "solitaire",
      metric: 70,
      metricKind: "moves",
      profile: otherProfile,
      occurredAt,
    }),
    event({
      id: "overall-solitaire-unprofiled",
      game: "solitaire",
      metric: 75,
      metricKind: "moves",
      profile: null,
      occurredAt,
    }),
    event({
      id: "overall-snake-10-1",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: 4,
      metricKind: "score",
      profile: requestedProfile,
      occurredAt,
    }),
    event({
      id: "overall-snake-16-1",
      game: "snake",
      type: "gamePlayed",
      boardSize: "16",
      metric: 5,
      metricKind: "score",
      profile: requestedProfile,
      occurredAt,
    }),
    event({
      id: "overall-snake-other",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: 6,
      metricKind: "score",
      profile: otherProfile,
      occurredAt,
    }),
    event({
      id: "overall-sudoku-no-hints",
      game: "sudoku",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 90,
      metricKind: "seconds",
      profile: requestedProfile,
      occurredAt,
    }),
    event({
      id: "overall-sudoku-with-hints",
      game: "sudoku",
      difficulty: "easy",
      hintBucket: "withHints",
      metric: 100,
      metricKind: "seconds",
      profile: requestedProfile,
      occurredAt,
    }),
    event({
      id: "overall-sudoku-other",
      game: "sudoku",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 80,
      metricKind: "seconds",
      profile: otherProfile,
      occurredAt,
    }),
  ];

  const stats = createGameStatsDataFromEvents(
    [
      ...events,
      events[0],
      {
        ...events[0],
        id: "overall-malformed-profile",
        profile: { ...requestedProfile, id: [requestedProfile.id] },
      },
    ],
    requestedProfile.id
  );

  assert.deepEqual(stats.playerTotals.minesweeper.wins, {
    beginner: 2,
    intermediate: 0,
    expert: 1,
  });
  assert.equal(stats.playerTotals.solitaire.wins, 2);
  assert.deepEqual(stats.playerTotals.snake, {
    totalGamesPlayed: 2,
    gamesPlayed: { "10": 1, "16": 1, "20": 0, "24": 0 },
  });
  assert.deepEqual(stats.playerTotals.sudoku.wins.easy, {
    noHints: 1,
    withHints: 1,
  });
  assert.deepEqual(
    createGameStatsDataFromEvents(events).playerTotals,
    createGameStatsDataFromEvents(events, "player-missing-totals").playerTotals
  );
  assert.equal(createGameStatsDataFromEvents(events).playerTotals.solitaire.wins, 0);
});

test("requires scalar event strings and exact per-game event fields", () => {
  const sudokuEvent = event({
    id: "event-sudoku-strict-shape",
    game: "sudoku",
    type: "win",
    difficulty: "easy",
    hintBucket: "noHints",
    metric: 75,
    metricKind: "seconds",
    profile: profile("player-sudoku-strict", "Strict Sudoku"),
  });
  const snakeEvent = event({
    id: "event-snake-strict-shape",
    game: "snake",
    type: "gamePlayed",
    boardSize: "10",
    metric: 5,
    metricKind: "score",
  });

  assert.deepEqual(normalizeGameStatsEvent(sudokuEvent), sudokuEvent);

  const nonScalarEvents = [
    { ...sudokuEvent, id: [sudokuEvent.id] },
    { ...sudokuEvent, game: [sudokuEvent.game] },
    { ...sudokuEvent, type: [sudokuEvent.type] },
    { ...sudokuEvent, occurredAt: [sudokuEvent.occurredAt] },
    { ...sudokuEvent, difficulty: [sudokuEvent.difficulty] },
    { ...sudokuEvent, hintBucket: [sudokuEvent.hintBucket] },
    { ...sudokuEvent, metricKind: [sudokuEvent.metricKind] },
    {
      ...sudokuEvent,
      profile: { ...sudokuEvent.profile, id: [sudokuEvent.profile.id] },
    },
    {
      ...sudokuEvent,
      profile: { ...sudokuEvent.profile, name: [sudokuEvent.profile.name] },
    },
    {
      ...sudokuEvent,
      profile: { ...sudokuEvent.profile, icon: [sudokuEvent.profile.icon] },
    },
    { ...snakeEvent, boardSize: [snakeEvent.boardSize] },
  ];
  nonScalarEvents.forEach((rawEvent) => {
    assert.throws(() => normalizeGameStatsEvent(rawEvent), /must be a string/);
  });
  assert.throws(
    () => normalizeGameStatsEvent({ ...sudokuEvent, game: "__proto__" }),
    /Unsupported game/
  );
  assert.throws(
    () => normalizeGameStatsEvent({ ...sudokuEvent, metric: undefined }),
    /Sudoku result requires a completion time/
  );

  const crossGameFields = [
    { ...event({ id: "event-ms-cross-field" }), boardSize: "10" },
    event({
      id: "event-solitaire-cross-field",
      game: "solitaire",
      type: "win",
      difficulty: "beginner",
      metric: 80,
      metricKind: "moves",
    }),
    { ...snakeEvent, hintBucket: "noHints" },
    { ...sudokuEvent, boardSize: "24" },
  ];
  crossGameFields.forEach((rawEvent) => {
    assert.throws(() => normalizeGameStatsEvent(rawEvent), /Unknown event field/);
  });

  const historicalStats = createGameStatsDataFromEvents(
    [{ ...sudokuEvent, boardSize: "24" }],
    sudokuEvent.profile.id
  );
  assert.deepEqual(historicalStats.totals.sudoku.wins.easy, {
    noHints: 1,
    withHints: 0,
  });
  assert.equal(historicalStats.leaderboards.sudoku.easy[0].playerId, sudokuEvent.profile.id);

  const incompleteHistoricalStats = createGameStatsDataFromEvents([
    {
      ...sudokuEvent,
      id: "event-sudoku-historical-no-time",
      metric: undefined,
      metricKind: undefined,
      profile: { ...sudokuEvent.profile, id: [sudokuEvent.profile.id] },
    },
  ]);
  assert.deepEqual(incompleteHistoricalStats.totals.sudoku.wins.easy, {
    noHints: 1,
    withHints: 0,
  });
  assert.deepEqual(incompleteHistoricalStats.leaderboards.sudoku.easy, []);
  assert.deepEqual(incompleteHistoricalStats.eventIds, [
    "event-sudoku-historical-no-time",
  ]);
});

test("requires safe integer metrics with game-specific minimums and bounds", () => {
  const invalidEvents = [
    event({ id: "metric-ms-zero", metric: 0 }),
    event({ id: "metric-ms-negative", metric: -1 }),
    event({ id: "metric-ms-fraction", metric: 1.5 }),
    event({ id: "metric-ms-string", metric: "1" }),
    event({ id: "metric-ms-over-max", metric: 1_000 }),
    event({
      id: "metric-sol-zero",
      game: "solitaire",
      type: "win",
      difficulty: undefined,
      metric: 0,
      metricKind: "moves",
    }),
    event({
      id: "metric-sol-negative",
      game: "solitaire",
      type: "win",
      difficulty: undefined,
      metric: -1,
      metricKind: "moves",
    }),
    event({
      id: "metric-sol-fraction",
      game: "solitaire",
      type: "win",
      difficulty: undefined,
      metric: 1.5,
      metricKind: "moves",
    }),
    event({
      id: "metric-sol-string",
      game: "solitaire",
      type: "win",
      difficulty: undefined,
      metric: "1",
      metricKind: "moves",
    }),
    event({
      id: "metric-sol-over-max",
      game: "solitaire",
      type: "win",
      difficulty: undefined,
      metric: 100_000,
      metricKind: "moves",
    }),
    event({
      id: "metric-sol-unsafe",
      game: "solitaire",
      type: "win",
      difficulty: undefined,
      metric: Number.MAX_SAFE_INTEGER + 1,
      metricKind: "moves",
    }),
    event({
      id: "metric-snake-negative",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: -1,
      metricKind: "score",
    }),
    event({
      id: "metric-snake-fraction",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: 1.5,
      metricKind: "score",
    }),
    event({
      id: "metric-snake-string",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: "1",
      metricKind: "score",
    }),
    event({
      id: "metric-snake-over-board",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: 98,
      metricKind: "score",
    }),
    event({
      id: "metric-sudoku-zero",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 0,
      metricKind: "seconds",
    }),
    event({
      id: "metric-sudoku-negative",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: -1,
      metricKind: "seconds",
    }),
    event({
      id: "metric-sudoku-fraction",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 1.5,
      metricKind: "seconds",
    }),
    event({
      id: "metric-sudoku-string",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: "1",
      metricKind: "seconds",
    }),
    event({
      id: "metric-sudoku-over-max",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 21_601,
      metricKind: "seconds",
    }),
  ];

  invalidEvents.forEach((rawEvent) => {
    assert.throws(() => normalizeGameStatsEvent(rawEvent), /Invalid|out of range/);
  });

  assert.equal(normalizeGameStatsEvent(event({ metric: 1 })).metric, 1);
  assert.equal(normalizeGameStatsEvent(event({ metric: 999 })).metric, 999);
  assert.equal(
    normalizeGameStatsEvent(
      event({
        id: "metric-sol-max",
        game: "solitaire",
        type: "win",
        difficulty: undefined,
        metric: 99_999,
        metricKind: "moves",
      })
    ).metric,
    99_999
  );
  assert.equal(
    normalizeGameStatsEvent(
      event({
        id: "metric-snake-zero",
        game: "snake",
        type: "gamePlayed",
        boardSize: "10",
        metric: 0,
        metricKind: "score",
      })
    ).metric,
    0
  );
  assert.equal(
    normalizeGameStatsEvent(
      event({
        id: "metric-snake-max",
        game: "snake",
        type: "gamePlayed",
        boardSize: "10",
        metric: 97,
        metricKind: "score",
      })
    ).metric,
    97
  );
  assert.equal(
    normalizeGameStatsEvent(
      event({
        id: "metric-sudoku-min",
        game: "sudoku",
        type: "win",
        difficulty: "easy",
        hintBucket: "noHints",
        metric: 1,
        metricKind: "seconds",
      })
    ).metric,
    1
  );
});

test("does not consume a session for strict metric failures and accepts a corrected retry", async () => {
  const env = createEnv();
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, session);

  for (const [id, metric] of [
    ["event-metric-zero", 0],
    ["event-metric-fraction", 1.5],
    ["event-metric-string", "1"],
  ]) {
    const response = await postEvent(env, event({ id, metric }), session);
    assert.equal(response.status, 400);
    assert.match((await readJson(response)).error, /Invalid Minesweeper time/);
    assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
    assert.equal(env.personal_site_game_stats.events.size, 0);
  }

  const accepted = await postEvent(env, event({ id: "event-metric-corrected", metric: 1 }), session);
  assert.equal(accepted.status, 201);
  assert.equal((await readJson(accepted)).applied, true);
});

test("quarantines an invalid legacy metric without taking global stats offline", async () => {
  const env = createEnv();
  storeTrustedEvent(env, event({ id: "legacy-minesweeper-zero", metric: 0 }));
  storeTrustedEvent(
    env,
    event({
      id: "valid-snake-after-legacy",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: 0,
      metricKind: "score",
    })
  );

  const response = await worker.fetch(
    new Request("https://stats.example.test/stats", {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );
  const stats = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(stats.totals.minesweeper.wins.beginner, 0);
  assert.equal(stats.totals.snake.gamesPlayed["10"], 1);
  assert.deepEqual(stats.eventIds, ["valid-snake-after-legacy"]);
});

test("accepts only the bundled Rohin Neko yawn avatar outside the ICO icon manifest", () => {
  const yawnAvatar = normalizeGameStatsEvent(
    event({
      id: "event-rohin-yawn-avatar",
      profile: {
        id: "player-rohin-neko",
        name: "Rohin",
        icon: "assets/neko-assets/sprites/yawn1.png",
      },
    })
  );

  assert.equal(yawnAvatar.profile.icon, "assets/neko-assets/sprites/yawn1.png");
  assert.throws(
    () =>
      normalizeGameStatsEvent(
        event({
          id: "event-unapproved-png-avatar",
          profile: {
            id: "player-unapproved",
            name: "Unapproved",
            icon: "assets/neko-assets/sprites/yawn2.png",
          },
        })
      ),
    /Invalid event profile/
  );
});

test("rejects client-only fields in an event profile", () => {
  assert.throws(
    () =>
      normalizeGameStatsEvent(
        event({
          id: "event-profile-field-0001",
          profile: {
            ...profile("player-strict-profile", "Strict"),
            rerollCount: 1,
          },
        })
      ),
    /Unknown profile field: rerollCount/
  );
});

test("records one verified completion for every tracked game and returns global stats", async () => {
  const env = createEnv();
  const cases = [
    ["minesweeper", { difficulty: "beginner" }, event({ id: "event-ms-0001" })],
    [
      "solitaire",
      {},
      event({ id: "event-sol-0001", game: "solitaire", metric: 81, metricKind: "moves" }),
    ],
    [
      "snake",
      { boardSize: "16" },
      event({
        id: "event-snake-0001",
        game: "snake",
        type: "gamePlayed",
        boardSize: "16",
        metric: 9,
        metricKind: "score",
      }),
    ],
    [
      "sudoku",
      { difficulty: "hard" },
      event({
        id: "event-sudoku-0001",
        game: "sudoku",
        type: "win",
        difficulty: "hard",
        hintBucket: "withHints",
        metric: 321,
        metricKind: "seconds",
        profile: null,
      }),
    ],
  ];

  for (const [game, config, rawEvent] of cases) {
    const session = await createSession(env, game, config);
    await ageSessionForCompletion(env, session);
    const response = await postEvent(env, rawEvent, session);
    assert.equal(response.status, 201);
  }

  const statsResponse = await worker.fetch(
    new Request("https://stats.example.test/stats", {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );
  const stats = await readJson(statsResponse);
  assert.equal(statsResponse.status, 200);
  assert.equal(stats.totals.minesweeper.wins.beginner, 1);
  assert.equal(stats.totals.solitaire.wins, 1);
  assert.equal(stats.totals.snake.gamesPlayed["16"], 1);
  assert.equal(stats.totals.sudoku.wins.hard.withHints, 1);
});

test("rejects an immediate Solitaire win without side effects and accepts the same proof later", async () => {
  const env = createEnv();
  const session = await createSession(env, "solitaire", {});
  const storedSession = env.personal_site_game_stats.sessions.get(session.id);
  const issuedAt = Date.parse(storedSession.issued_at);
  const originalToken = session.token;
  const solitaireEvent = event({
    id: "event-solitaire-eligibility",
    game: "solitaire",
    type: "win",
    difficulty: undefined,
    metric: 80,
    metricKind: "moves",
  });
  const rateLimitsBefore = Array.from(
    env.personal_site_game_stats.rateLimits,
    ([key, value]) => [key, { ...value }]
  );

  const immediateResponse = await postEvent(env, solitaireEvent, session);

  assert.equal(immediateResponse.status, 400);
  assert.match((await readJson(immediateResponse)).error, /completed too quickly/);
  assert.equal(storedSession.consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);
  assert.deepEqual(
    Array.from(env.personal_site_game_stats.rateLimits, ([key, value]) => [
      key,
      { ...value },
    ]),
    rateLimitsBefore
  );

  const acceptedResponse = await withMockedNow(issuedAt + 8_000, () =>
    postEvent(env, solitaireEvent, session)
  );

  assert.equal(session.token, originalToken);
  assert.equal(acceptedResponse.status, 201);
  assert.deepEqual(await readJson(acceptedResponse), {
    ok: true,
    applied: true,
    eventId: solitaireEvent.id,
  });
  assert.ok(storedSession.consumed_at);
  assert.equal(env.personal_site_game_stats.events.get(solitaireEvent.id).metric, 80);
  assert.equal(
    Array.from(env.personal_site_game_stats.rateLimits.keys()).some((key) =>
      key.startsWith("events:")
    ),
    true
  );
});

test("publishes a verified no-hints Sudoku win after the minimum session time", async () => {
  const env = createEnv();
  const sudokuProfile = profile("player-sudoku-publish", "Sudoku Publisher");
  const session = await createSession(env, "sudoku", { difficulty: "easy" });
  const storedSession = env.personal_site_game_stats.sessions.get(session.id);
  const issuedAt = Date.parse(storedSession.issued_at);
  const originalToken = session.token;
  const sudokuEvent = event({
    id: "event-sudoku-eligibility",
    game: "sudoku",
    type: "win",
    difficulty: "easy",
    hintBucket: "noHints",
    metric: 87,
    metricKind: "seconds",
    profile: sudokuProfile,
  });
  const rateLimitsBefore = Array.from(
    env.personal_site_game_stats.rateLimits,
    ([key, value]) => [key, { ...value }]
  );

  const immediateResponse = await postEvent(env, sudokuEvent, session);

  assert.equal(immediateResponse.status, 400);
  assert.match((await readJson(immediateResponse)).error, /completed too quickly/);
  assert.equal(storedSession.consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);
  assert.deepEqual(
    Array.from(env.personal_site_game_stats.rateLimits, ([key, value]) => [
      key,
      { ...value },
    ]),
    rateLimitsBefore
  );

  const acceptedResponse = await withMockedNow(issuedAt + 10_000, () =>
    postEvent(env, sudokuEvent, session)
  );

  assert.equal(session.token, originalToken);
  assert.equal(acceptedResponse.status, 201);
  assert.deepEqual(await readJson(acceptedResponse), {
    ok: true,
    applied: true,
    eventId: sudokuEvent.id,
  });
  assert.ok(storedSession.consumed_at);
  assert.equal(env.personal_site_game_stats.events.get(sudokuEvent.id).metric, 87);

  const statsResponse = await worker.fetch(
    new Request(`https://stats.example.test/stats?playerId=${sudokuProfile.id}`, {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );
  const stats = await readJson(statsResponse);

  assert.equal(statsResponse.status, 200);
  assert.deepEqual(stats.totals.sudoku.wins.easy, { noHints: 1, withHints: 0 });
  assert.equal(stats.leaderboards.sudoku.easy.length, 1);
  assert.equal(stats.leaderboards.sudoku.easy[0].playerId, sudokuProfile.id);
  assert.equal(stats.leaderboards.sudoku.easy[0].metric, 87);
  assert.deepEqual(stats.playerRanks.sudoku.easy, { rank: 1, totalPlayers: 1 });
  assert.equal(stats.playerRecords.sudoku.easy.playerId, sudokuProfile.id);
  assert.equal(stats.playerRecords.sudoku.easy.metric, 87);
});

test("rejects malformed Sudoku fields without consuming the reusable session", async () => {
  const env = createEnv();
  const session = await createSession(env, "sudoku", { difficulty: "hard" });
  await ageSessionForCompletion(env, session);
  const sudokuEvent = event({
    id: "event-sudoku-strict-http",
    game: "sudoku",
    type: "win",
    difficulty: "hard",
    hintBucket: "noHints",
    metric: 98,
    metricKind: "seconds",
    profile: profile("player-sudoku-strict-http", "Strict HTTP Sudoku"),
  });
  const rateLimitsBefore = Array.from(
    env.personal_site_game_stats.rateLimits,
    ([key, value]) => [key, { ...value }]
  );

  const nonScalarResponse = await postEvent(
    env,
    { ...sudokuEvent, hintBucket: [sudokuEvent.hintBucket] },
    session
  );
  assert.equal(nonScalarResponse.status, 400);
  assert.match((await readJson(nonScalarResponse)).error, /must be a string/);
  assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);
  assert.deepEqual(
    Array.from(env.personal_site_game_stats.rateLimits, ([key, value]) => [
      key,
      { ...value },
    ]),
    rateLimitsBefore
  );

  for (const [id, invalidProfile, errorPattern] of [
    [
      "event-sudoku-profile-array",
      { ...sudokuEvent.profile, id: [sudokuEvent.profile.id] },
      /Event profile id must be a string/,
    ],
    [
      "event-sudoku-profile-icon",
      {
        ...sudokuEvent.profile,
        icon: "assets/neko-assets/sprites/yawn2.png",
      },
      /Invalid event profile/,
    ],
  ]) {
    const invalidProfileResponse = await postEvent(
      env,
      { ...sudokuEvent, id, profile: invalidProfile },
      session
    );
    assert.equal(invalidProfileResponse.status, 400);
    assert.match((await readJson(invalidProfileResponse)).error, errorPattern);
    assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
    assert.equal(env.personal_site_game_stats.events.size, 0);
    assert.deepEqual(
      Array.from(env.personal_site_game_stats.rateLimits, ([key, value]) => [
        key,
        { ...value },
      ]),
      rateLimitsBefore
    );
  }

  const crossGameResponse = await postEvent(
    env,
    { ...sudokuEvent, boardSize: "24" },
    session
  );
  assert.equal(crossGameResponse.status, 400);
  assert.match((await readJson(crossGameResponse)).error, /Unknown event field: boardSize/);
  assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);

  const acceptedResponse = await postEvent(env, sudokuEvent, session);
  assert.equal(acceptedResponse.status, 201);
  assert.equal((await readJson(acceptedResponse)).applied, true);
  assert.ok(env.personal_site_game_stats.sessions.get(session.id).consumed_at);
  assert.deepEqual(
    {
      game: env.personal_site_game_stats.events.get(sudokuEvent.id).game,
      difficulty: env.personal_site_game_stats.events.get(sudokuEvent.id).difficulty,
      boardSize: env.personal_site_game_stats.events.get(sudokuEvent.id).board_size,
      hintBucket: env.personal_site_game_stats.events.get(sudokuEvent.id).hint_bucket,
      metric: env.personal_site_game_stats.events.get(sudokuEvent.id).metric,
      metricKind: env.personal_site_game_stats.events.get(sudokuEvent.id).metric_kind,
    },
    {
      game: "sudoku",
      difficulty: "hard",
      boardSize: null,
      hintBucket: "noHints",
      metric: 98,
      metricKind: "seconds",
    }
  );
});

test("keeps a difficulty-mismatched Sudoku session reusable and hinted wins unranked", async () => {
  const env = createEnv();
  const sudokuProfile = profile("player-sudoku-hinted", "Hinted Sudoku");
  const session = await createSession(env, "sudoku", { difficulty: "easy" });
  await ageSessionForCompletion(env, session);
  const mismatchedEvent = event({
    id: "event-sudoku-difficulty-mismatch",
    game: "sudoku",
    type: "win",
    difficulty: "hard",
    hintBucket: "withHints",
    metric: 120,
    metricKind: "seconds",
    profile: sudokuProfile,
  });

  const tamperedResponse = await postEvent(env, mismatchedEvent, {
    ...session,
    token: `${session.token}x`,
  });

  assert.equal(tamperedResponse.status, 403);
  assert.equal((await readJson(tamperedResponse)).error, "Invalid session token");
  assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);

  const mismatchedResponse = await postEvent(env, mismatchedEvent, session);

  assert.equal(mismatchedResponse.status, 400);
  assert.match((await readJson(mismatchedResponse)).error, /does not match/);
  assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);

  const acceptedEvent = {
    ...mismatchedEvent,
    id: "event-sudoku-hinted-accepted",
    difficulty: "easy",
  };
  const acceptedResponse = await postEvent(env, acceptedEvent, session);

  assert.equal(acceptedResponse.status, 201);
  assert.equal((await readJson(acceptedResponse)).applied, true);
  assert.ok(env.personal_site_game_stats.sessions.get(session.id).consumed_at);

  const statsResponse = await worker.fetch(
    new Request(`https://stats.example.test/stats?playerId=${sudokuProfile.id}`, {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );
  const stats = await readJson(statsResponse);

  assert.equal(statsResponse.status, 200);
  assert.deepEqual(stats.totals.sudoku.wins.easy, { noHints: 0, withHints: 1 });
  assert.deepEqual(stats.totals.sudoku.wins.hard, { noHints: 0, withHints: 0 });
  assert.deepEqual(stats.leaderboards.sudoku.easy, []);
  assert.deepEqual(stats.playerRanks.sudoku.easy, { rank: null, totalPlayers: 0 });
  assert.equal(stats.playerRecords.sudoku.easy, null);
});

test("waits inline for a quick zero-score Snake game before counting and ranking it", async () => {
  const env = createEnv();
  const session = await createSession(env, "snake", { boardSize: "16" });
  const issuedAt = Date.parse(env.personal_site_game_stats.sessions.get(session.id).issued_at);
  const waitCalls = [];
  const snakeProfile = profile("player-snake-quick", "Quick Snake");
  const response = await withMockedNow(issuedAt + 1_500, ({ advance }) =>
    withScheduler(
      async (delayMs) => {
        waitCalls.push(delayMs);
        advance(delayMs);
      },
      () =>
        postEvent(
          env,
          event({
            id: "event-snake-quick-zero",
            game: "snake",
            type: "gamePlayed",
            boardSize: "16",
            metric: 0,
            metricKind: "score",
            profile: snakeProfile,
          }),
          session
        )
    )
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await readJson(response), {
    ok: true,
    applied: true,
    eventId: "event-snake-quick-zero",
  });
  assert.deepEqual(waitCalls, [3_500]);
  assert.ok(env.personal_site_game_stats.sessions.get(session.id).consumed_at);

  const statsResponse = await worker.fetch(
    new Request(`https://stats.example.test/stats?playerId=${snakeProfile.id}`, {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );
  const stats = await readJson(statsResponse);
  assert.equal(statsResponse.status, 200);
  assert.equal(stats.totals.snake.totalGamesPlayed, 1);
  assert.equal(stats.totals.snake.gamesPlayed["16"], 1);
  assert.equal(stats.leaderboards.snake["16"][0].metric, 0);
  assert.deepEqual(stats.playerRanks.snake["16"], { rank: 1, totalPlayers: 1 });
  assert.equal(stats.playerRecords.snake["16"].playerId, snakeProfile.id);
});

test("does not trust a Snake scheduler that resolves before eligibility", async () => {
  const env = createEnv();
  const session = await createSession(env, "snake", { boardSize: "10" });
  const issuedAt = Date.parse(env.personal_site_game_stats.sessions.get(session.id).issued_at);
  const response = await withMockedNow(issuedAt + 1_000, () =>
    withScheduler(
      async () => {},
      () =>
        postEvent(
          env,
          event({
            id: "event-snake-early-scheduler",
            game: "snake",
            type: "gamePlayed",
            boardSize: "10",
            metric: 0,
            metricKind: "score",
          }),
          session
        )
    )
  );
  const body = await readJson(response);

  assert.equal(response.status, 425);
  assert.equal(body.retryAfterMs, 4_000);
  assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);
});

test("uses a bounded Node timer fallback for an inline Snake eligibility wait", async () => {
  const env = createEnv();
  const session = await createSession(env, "snake", { boardSize: "10" });
  await ageSessionForCompletion(env, session, 4_900);

  const response = await withScheduler(undefined, () =>
    postEvent(
      env,
      event({
        id: "event-snake-node-wait",
        game: "snake",
        type: "gamePlayed",
        boardSize: "10",
        metric: 0,
        metricKind: "score",
      }),
      session
    )
  );

  assert.equal(response.status, 201);
  assert.equal((await readJson(response)).applied, true);
});

test("returns a bounded 425 for an implausibly early Snake score and accepts a later retry", async () => {
  const env = createEnv();
  const session = await createSession(env, "snake", { boardSize: "16" });
  const highScoreEvent = event({
    id: "event-snake-score-delay",
    game: "snake",
    type: "gamePlayed",
    boardSize: "16",
    metric: 100,
    metricKind: "score",
  });

  const earlyResponse = await postEvent(env, highScoreEvent, session);
  const earlyBody = await readJson(earlyResponse);
  assert.equal(earlyResponse.status, 425);
  assert.equal(earlyBody.ok, false);
  assert.match(earlyBody.error, /not eligible yet/);
  assert.ok(earlyBody.retryAfterMs > 5_000 && earlyBody.retryAfterMs <= 12_700);
  assert.equal(
    earlyResponse.headers.get("Retry-After"),
    String(Math.ceil(earlyBody.retryAfterMs / 1_000))
  );
  assert.equal(earlyResponse.headers.get("Access-Control-Expose-Headers"), "Retry-After");
  assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);
  assert.equal(
    Array.from(env.personal_site_game_stats.rateLimits.keys()).some((key) =>
      key.startsWith("events:")
    ),
    false
  );

  await ageSessionForCompletion(env, session, 12_800);
  const retryResponse = await postEvent(env, highScoreEvent, session);
  assert.equal(retryResponse.status, 201);
  assert.equal((await readJson(retryResponse)).applied, true);
  assert.ok(env.personal_site_game_stats.sessions.get(session.id).consumed_at);
  assert.equal(env.personal_site_game_stats.events.get(highScoreEvent.id).metric, 100);

  const cappedSession = await createSession(env, "snake", { boardSize: "24" });
  const cappedResponse = await postEvent(
    env,
    event({
      id: "event-snake-capped-delay",
      game: "snake",
      type: "gamePlayed",
      boardSize: "24",
      metric: 573,
      metricKind: "score",
    }),
    cappedSession
  );
  const cappedBody = await readJson(cappedResponse);
  assert.equal(cappedResponse.status, 425);
  assert.equal(cappedBody.retryAfterMs, 60_000);
  assert.equal(cappedResponse.headers.get("Retry-After"), "60");
  assert.equal(env.personal_site_game_stats.sessions.get(cappedSession.id).consumed_at, null);
});

test("rejects stale event submissions before consuming their sessions", async () => {
  const env = createEnv();
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, session);
  const response = await postEvent(
    env,
    event({
      id: "event-stale-submission",
      occurredAt: "2020-01-01T00:00:00.000Z",
    }),
    session
  );

  assert.equal(response.status, 400);
  assert.match((await readJson(response)).error, /outside the accepted window/);
  assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
});

test("reports an invalid session event window separately from completion eligibility", async () => {
  const env = createEnv();
  const session = await createSession(env, "snake", { boardSize: "16" });
  await ageSessionForCompletion(env, session);
  const response = await postEvent(
    env,
    event({
      id: "event-snake-session-window",
      game: "snake",
      type: "gamePlayed",
      boardSize: "16",
      metric: 0,
      metricKind: "score",
      occurredAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    }),
    session
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readJson(response), {
    ok: false,
    error: "Game result is outside its session window",
  });
  assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);
});

test("accepts an unexpired session issued before a game build deployment", async () => {
  const env = createEnv();
  const session = await createSession(env, "solitaire", {});
  await ageSessionForCompletion(env, session);
  env.GAME_BUILD_VERSION = `sha256-${"b".repeat(64)}`;

  const response = await postEvent(
    env,
    event({
      id: "event-pre-deploy-session",
      game: "solitaire",
      type: "win",
      difficulty: undefined,
      metric: 77,
      metricKind: "moves",
    }),
    session
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await readJson(response), {
    ok: true,
    applied: true,
    eventId: "event-pre-deploy-session",
  });
  assert.ok(env.personal_site_game_stats.sessions.get(session.id).consumed_at);
});

test("rejects a persisted session build that disagrees with its signed token", async () => {
  const env = createEnv();
  const session = await createSession(env, "solitaire", {});
  await ageSessionForCompletion(env, session);
  const storedSession = env.personal_site_game_stats.sessions.get(session.id);
  storedSession.build_version = `sha256-${"b".repeat(64)}`;

  const response = await postEvent(
    env,
    event({
      id: "event-session-build-mismatch",
      game: "solitaire",
      type: "win",
      difficulty: undefined,
      metric: 79,
      metricKind: "moves",
    }),
    session
  );

  assert.equal(response.status, 403);
  assert.match((await readJson(response)).error, /Stored game session does not match/);
  assert.equal(storedSession.consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);

  const statsResponse = await worker.fetch(
    new Request("https://stats.example.test/stats", {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );
  const stats = await readJson(statsResponse);
  assert.equal(statsResponse.status, 200);
  assert.equal(stats.totals.solitaire.wins, 0);
  assert.deepEqual(stats.leaderboards.solitaire, []);
});

test("rejects a persisted session issue time that disagrees with its signed token", async () => {
  const env = createEnv();
  const session = await createSession(env, "snake", { boardSize: "10" });
  await ageSessionForCompletion(env, session);
  const storedSession = env.personal_site_game_stats.sessions.get(session.id);
  storedSession.issued_at = new Date(Date.parse(storedSession.issued_at) - 1_000).toISOString();

  const response = await postEvent(
    env,
    event({
      id: "event-session-issued-at-mismatch",
      game: "snake",
      type: "gamePlayed",
      boardSize: "10",
      metric: 0,
      metricKind: "score",
    }),
    session
  );

  assert.equal(response.status, 403);
  assert.match((await readJson(response)).error, /Stored game session does not match/);
  assert.equal(storedSession.consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);
});

test("makes an accepted Solitaire win idempotent without allowing a second session use", async () => {
  const env = createEnv();
  const session = await createSession(env, "solitaire", {});
  await ageSessionForCompletion(env, session);
  const idempotentEvent = event({
    id: "event-idempotent",
    game: "solitaire",
    type: "win",
    difficulty: undefined,
    metric: 88,
    metricKind: "moves",
  });
  const first = await postEvent(env, idempotentEvent, session);
  const duplicate = await postEvent(env, idempotentEvent, session);
  const secondEvent = await postEvent(
    env,
    event({
      id: "event-second",
      game: "solitaire",
      type: "win",
      difficulty: undefined,
      metric: 89,
      metricKind: "moves",
    }),
    session
  );

  assert.equal(first.status, 201);
  assert.equal((await readJson(first)).applied, true);
  assert.equal(duplicate.status, 200);
  assert.equal((await readJson(duplicate)).applied, false);
  assert.equal(secondEvent.status, 409);
});

test("rejects non-scalar session game, build, and per-game config fields", async () => {
  const env = createEnv();
  const invalidRequests = [
    {
      body: {
        game: ["sudoku"],
        config: { difficulty: "easy" },
        buildVersion: env.GAME_BUILD_VERSION,
      },
      error: /Session game must be a string/,
    },
    {
      body: {
        game: "sudoku",
        config: { difficulty: "easy" },
        buildVersion: [env.GAME_BUILD_VERSION],
      },
      error: /Game build version must be a string/,
    },
    {
      body: {
        game: "minesweeper",
        config: { difficulty: ["beginner"] },
        buildVersion: env.GAME_BUILD_VERSION,
      },
      error: /Minesweeper difficulty must be a string/,
    },
    {
      body: {
        game: "snake",
        config: { boardSize: ["16"] },
        buildVersion: env.GAME_BUILD_VERSION,
      },
      error: /Snake board size must be a string/,
    },
    {
      body: {
        game: "sudoku",
        config: { difficulty: ["easy"] },
        buildVersion: env.GAME_BUILD_VERSION,
      },
      error: /Sudoku difficulty must be a string/,
    },
  ];

  for (const { body, error } of invalidRequests) {
    const response = await worker.fetch(jsonRequest("/sessions", body), env);
    assert.equal(response.status, 400);
    assert.match((await readJson(response)).error, error);
    assert.equal(env.personal_site_game_stats.sessions.size, 0);
    assert.equal(env.personal_site_game_stats.rateLimits.size, 0);
  }

  const correctedSession = await createSession(env, "sudoku", { difficulty: "easy" });
  assert.ok(env.personal_site_game_stats.sessions.has(correctedSession.id));
  assert.equal(env.personal_site_game_stats.rateLimits.size, 1);
});

test("rejects a stale game build before creating a session", async () => {
  const env = createEnv();
  const response = await worker.fetch(
    jsonRequest("/sessions", {
      game: "solitaire",
      config: {},
      buildVersion: `sha256-${"b".repeat(64)}`,
    }),
    env
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await readJson(response), {
    ok: false,
    error: "Game build version is not compatible",
  });
  assert.equal(env.personal_site_game_stats.sessions.size, 0);
  assert.equal(env.personal_site_game_stats.rateLimits.size, 0);
});

test("accepts an explicitly compatible browser build during a rollout", async () => {
  const previousBuildVersion = `sha256-${"b".repeat(64)}`;
  const env = createEnv({
    GAME_BUILD_COMPATIBILITY_VERSIONS: previousBuildVersion,
  });
  const response = await worker.fetch(
    jsonRequest("/sessions", {
      game: "solitaire",
      config: {},
      buildVersion: previousBuildVersion,
    }),
    env
  );

  assert.equal(response.status, 201);
  const session = await readJson(response);
  assert.equal(
    env.personal_site_game_stats.sessions.get(session.id).build_version,
    previousBuildVersion
  );
});

test("fails closed on malformed or duplicate build compatibility configuration", async () => {
  for (const GAME_BUILD_COMPATIBILITY_VERSIONS of [
    "invalid",
    buildVersion,
    `sha256-${"b".repeat(64)},sha256-${"b".repeat(64)}`,
    Array.from(
      { length: 33 },
      (_, index) => `sha256-${index.toString(16).padStart(64, "0")}`
    ).join(","),
  ]) {
    const env = createEnv({ GAME_BUILD_COMPATIBILITY_VERSIONS });
    const response = await worker.fetch(
      new Request("https://stats.example.test/health"),
      env
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await readJson(response), {
      ok: false,
      error: "Game stats security configuration is incomplete",
    });
  }
});

test("rejects conflicting reuse of an existing event id", async () => {
  const env = createEnv();
  const firstSession = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, firstSession);
  const first = await postEvent(env, event({ id: "event-conflict" }), firstSession);

  const secondSession = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, secondSession);
  const conflict = await postEvent(
    env,
    event({ id: "event-conflict", metric: 99 }),
    secondSession
  );

  assert.equal(first.status, 201);
  assert.equal(conflict.status, 409);
  assert.match((await readJson(conflict)).error, /different result/);
  assert.equal(env.personal_site_game_stats.events.get("event-conflict").metric, 42);
  assert.equal(env.personal_site_game_stats.sessions.get(secondSession.id).consumed_at, null);
});

test("rolls back session consumption when event insertion fails and accepts a retry", async () => {
  const env = createEnv();
  const database = env.personal_site_game_stats;
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, session);
  database.failNextEventInsert = true;

  const failed = await postEvent(env, event({ id: "event-atomic-retry" }), session);

  assert.equal(failed.status, 500);
  assert.equal(database.events.has("event-atomic-retry"), false);
  assert.equal(database.sessions.get(session.id).consumed_at, null);

  const retried = await postEvent(env, event({ id: "event-atomic-retry" }), session);
  const retryBody = await readJson(retried);

  assert.equal(retried.status, 201);
  assert.equal(retryBody.applied, true);
  assert.ok(database.sessions.get(session.id).consumed_at);
  assert.equal(database.events.has("event-atomic-retry"), true);
});

test("rolls back event insertion when session consumption fails and accepts a retry", async () => {
  const env = createEnv();
  const database = env.personal_site_game_stats;
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, session);
  database.failNextSessionConsume = true;

  const failed = await postEvent(env, event({ id: "event-consume-retry" }), session);

  assert.equal(failed.status, 500);
  assert.equal(database.events.has("event-consume-retry"), false);
  assert.equal(database.sessions.get(session.id).consumed_at, null);

  const retried = await postEvent(env, event({ id: "event-consume-retry" }), session);

  assert.equal(retried.status, 201);
  assert.equal((await readJson(retried)).applied, true);
  assert.ok(database.sessions.get(session.id).consumed_at);
  assert.equal(database.events.has("event-consume-retry"), true);
});

test("accepts exactly one of two concurrent results for a single session", async () => {
  const env = createEnv();
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, session);

  const responses = await Promise.all([
    postEvent(env, event({ id: "event-concurrent-a" }), session),
    postEvent(env, event({ id: "event-concurrent-b" }), session),
  ]);

  assert.deepEqual(
    responses.map(({ status }) => status).sort(),
    [201, 409]
  );
  assert.equal(env.personal_site_game_stats.events.size, 1);
  assert.ok(env.personal_site_game_stats.sessions.get(session.id).consumed_at);
});

test("treats simultaneous identical submissions as one accepted idempotent event", async () => {
  const env = createEnv();
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, session);
  const idempotentEvent = event({ id: "event-concurrent-idempotent" });

  const responses = await Promise.all([
    postEvent(env, idempotentEvent, session),
    postEvent(env, idempotentEvent, session),
  ]);
  const bodies = await Promise.all(responses.map((response) => readJson(response)));

  assert.deepEqual(
    responses.map(({ status }) => status).sort(),
    [200, 201]
  );
  assert.deepEqual(
    bodies.map(({ applied }) => applied).sort(),
    [false, true]
  );
  assert.equal(env.personal_site_game_stats.events.size, 1);
});

test("health reports all accepted builds and fails when D1 is unavailable", async () => {
  const previousBuildVersion = `sha256-${"b".repeat(64)}`;
  const env = createEnv({
    GAME_BUILD_COMPATIBILITY_VERSIONS: previousBuildVersion,
  });
  const healthy = await worker.fetch(new Request("https://stats.example.test/health"), env);

  assert.equal(healthy.status, 200);
  assert.deepEqual(await readJson(healthy), {
    ok: true,
    buildVersion,
    acceptedBuildVersions: [buildVersion, previousBuildVersion],
  });

  env.personal_site_game_stats.failHealthCheck = true;
  const unhealthy = await worker.fetch(new Request("https://stats.example.test/health"), env);

  assert.equal(unhealthy.status, 500);
  assert.match((await readJson(unhealthy)).error, /Internal server error/);

  env.personal_site_game_stats.failHealthCheck = false;
  env.personal_site_game_stats.healthTableCount = 2;
  const missingSchema = await worker.fetch(
    new Request("https://stats.example.test/health"),
    env
  );

  assert.equal(missingSchema.status, 500);
  assert.match((await readJson(missingSchema)).error, /D1 health check failed/);
});

test("issues an opaque, one-hour administrator proof only after valid credentials", async () => {
  const env = createEnv();
  const response = await signInAsAdministrator(env, {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  });
  const body = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.profile, {
    id: "player-rohin-neko",
    name: "rohin ^.^",
    icon: "assets/neko-assets/sprites/yawn1.png",
  });
  assert.match(body.proof, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.ok(Date.parse(body.expiresAt) > Date.now());
  const [encodedProofPayload] = body.proof.split(".");
  const signedProofPayload = JSON.parse(
    Buffer.from(encodedProofPayload, "base64url").toString("utf8")
  );
  assert.equal(body.expiresAt, signedProofPayload.expiresAt);
  assert.equal(
    Date.parse(signedProofPayload.expiresAt) - Date.parse(signedProofPayload.issuedAt),
    60 * 60 * 1000
  );
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type");
  assert.doesNotMatch(JSON.stringify(body), /test-administrator/);

  const wrongUsername = await signInAsAdministrator(env, {
    username: "incorrect",
    password: env.ADMIN_PASSWORD,
  });
  const wrongPassword = await signInAsAdministrator(env, {
    username: env.ADMIN_USERNAME,
    password: "incorrect",
  });
  const missingOrigin = await signInAsAdministrator(
    env,
    { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD },
    { origin: "" }
  );
  const unsupportedMethod = await worker.fetch(
    new Request("https://stats.example.test/administrator/sign-in", {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );

  for (const failedResponse of [wrongUsername, wrongPassword]) {
    assert.equal(failedResponse.status, 401);
    assert.deepEqual(await readJson(failedResponse), {
      ok: false,
      error: "Invalid administrator credentials",
    });
  }
  assert.equal(missingOrigin.status, 403);
  assert.equal(unsupportedMethod.status, 405);
});

test("accepts an administrator proof until exactly its one-hour expiry", async () => {
  const env = createEnv();
  const signInResponse = await signInAsAdministrator(env, {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  });
  const signIn = await readJson(signInResponse);
  const expiresAtMs = Date.parse(signIn.expiresAt);
  const acceptedSession = await createSession(env, "minesweeper", {
    difficulty: "beginner",
  });
  const expiredSession = await createSession(env, "minesweeper", {
    difficulty: "beginner",
  });
  await ageSessionForCompletion(env, acceptedSession);
  await ageSessionForCompletion(env, expiredSession);
  const administratorProfile = {
    id: "player-rohin-neko",
    name: "rohin ^.^",
    icon: "assets/neko-assets/sprites/yawn1.png",
  };
  const acceptedEvent = event({
    id: "event-administrator-proof-before-expiry",
    profile: administratorProfile,
  });
  const expiredEvent = event({
    id: "event-administrator-proof-at-expiry",
    profile: administratorProfile,
  });

  await withMockedNow(expiresAtMs - 1, async ({ advance }) => {
    const accepted = await postEvent(env, acceptedEvent, acceptedSession, {
      authorization: `Bearer ${signIn.proof}`,
    });
    assert.equal(accepted.status, 201);

    advance(1);
    const expired = await postEvent(env, expiredEvent, expiredSession, {
      authorization: `Bearer ${signIn.proof}`,
    });
    assert.equal(expired.status, 403);
    assert.deepEqual(await readJson(expired), {
      ok: false,
      error: "Administrator authorization is invalid",
      code: "administrator-authorization",
    });
  });

  assert.equal(env.personal_site_game_stats.events.has(acceptedEvent.id), true);
  assert.equal(env.personal_site_game_stats.events.has(expiredEvent.id), false);
  assert.equal(env.personal_site_game_stats.sessions.get(expiredSession.id).consumed_at, null);
});

test("publishes a protected win when the client IP changes between sign-in, session, and result", async () => {
  const env = createEnv();
  const signInResponse = await signInAsAdministrator(env, {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  });
  const signIn = await readJson(signInResponse);
  const [, encodedProofPayload] = /^([A-Za-z0-9_-]+)\./.exec(signIn.proof) || [];
  const proofPayload = JSON.parse(
    Buffer.from(encodedProofPayload, "base64url").toString("utf8")
  );
  assert.match(
    proofPayload.ipHash,
    /^[A-Za-z0-9_-]+$/,
    "The proof keeps a keyed hash for rollback compatibility, never a raw address."
  );
  assert.doesNotMatch(proofPayload.ipHash, /203\.0\.113\.7/);
  assert.equal(proofPayload.scope, "administrator");

  const sessionIp = "203.0.113.99";
  const sessionResponse = await worker.fetch(
    jsonRequest(
      "/sessions",
      {
        game: "minesweeper",
        config: { difficulty: "beginner" },
        buildVersion: env.GAME_BUILD_VERSION,
      },
      { ip: sessionIp }
    ),
    env
  );
  assert.equal(sessionResponse.status, 201);
  const session = await readJson(sessionResponse);
  await ageSessionForCompletion(env, session);
  const protectedEvent = event({
    id: "event-administrator-proof-changed-ip",
    profile: {
      id: "player-rohin-neko",
      name: "rohin ^.^",
      icon: "assets/neko-assets/sprites/yawn1.png",
    },
  });

  const accepted = await postEvent(env, protectedEvent, session, {
    authorization: `Bearer ${signIn.proof}`,
    ip: "198.51.100.42",
  });

  assert.equal(accepted.status, 201);
  assert.equal((await readJson(accepted)).applied, true);
  assert.equal(env.personal_site_game_stats.events.has(protectedEvent.id), true);
  assert.notEqual(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
  const eventBucket = Array.from(env.personal_site_game_stats.rateLimits.keys()).filter(
    (bucket) => bucket.startsWith("events:")
  );
  assert.equal(eventBucket.length, 1, "The publishing client IP still receives its own rate bucket.");
});

test("reports a rejected game session for the protected profile without the authorization code", async () => {
  const env = createEnv();
  const signInResponse = await signInAsAdministrator(env, {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  });
  const signIn = await readJson(signInResponse);
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, session);
  const protectedEvent = event({
    id: "event-administrator-session-rejected",
    profile: {
      id: "player-rohin-neko",
      name: "rohin ^.^",
      icon: "assets/neko-assets/sprites/yawn1.png",
    },
  });

  const rejected = await postEvent(
    env,
    protectedEvent,
    { ...session, token: `${session.token}x` },
    { authorization: `Bearer ${signIn.proof}` }
  );

  assert.equal(rejected.status, 403);
  const body = await readJson(rejected);
  assert.equal(body.ok, false);
  assert.equal(body.code, undefined, "A session rejection must not look like a lost proof.");
  assert.equal(env.personal_site_game_stats.events.has(protectedEvent.id), false);
  assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
});

test("counts a protected administrator win in global and player totals", async () => {
  const env = createEnv();
  const signInResponse = await signInAsAdministrator(env, {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  });
  const signIn = await readJson(signInResponse);
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, session);
  const administratorEvent = event({
    id: "event-administrator-counted-win",
    profile: {
      id: "player-rohin-neko",
      name: "rohin ^.^",
      icon: "assets/neko-assets/sprites/yawn1.png",
    },
  });

  const accepted = await postEvent(env, administratorEvent, session, {
    authorization: `Bearer ${signIn.proof}`,
  });
  assert.equal(accepted.status, 201);
  assert.equal(env.personal_site_game_stats.events.has(administratorEvent.id), true);

  const statsResponse = await worker.fetch(
    new Request("https://stats.example.test/stats?playerId=player-rohin-neko", {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );
  const stats = await readJson(statsResponse);

  assert.equal(statsResponse.status, 200);
  assert.equal(stats.totals.minesweeper.wins.beginner, 1);
  assert.equal(stats.playerTotals.minesweeper.wins.beginner, 1);
});

test("rate-limits administrator sign-in attempts and protects the administrator profile", async () => {
  const env = createEnv();
  for (let index = 0; index < 5; index += 1) {
    const response = await signInAsAdministrator(env, {
      username: env.ADMIN_USERNAME,
      password: "incorrect",
    });
    assert.equal(response.status, 401);
  }
  const blocked = await signInAsAdministrator(env, {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  });
  assert.equal(blocked.status, 429);
  const [bucket] = env.personal_site_game_stats.rateLimits.keys();
  assert.match(bucket, /^administrator-sign-in:[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(bucket, /203\.0\.113\.7/);

  const eventEnv = createEnv();
  const session = await createSession(eventEnv, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(eventEnv, session);
  const administratorEvent = event({
    id: "event-administrator-0001",
    profile: {
      id: "player-rohin-neko",
      name: "rohin ^.^",
      icon: "assets/neko-assets/sprites/yawn1.png",
    },
  });
  const missingProof = await postEvent(eventEnv, administratorEvent, session);
  assert.equal(missingProof.status, 403);
  assert.deepEqual(await readJson(missingProof), {
    ok: false,
    error: "Administrator authorization is invalid",
    code: "administrator-authorization",
  });
  assert.equal(eventEnv.personal_site_game_stats.sessions.get(session.id).consumed_at, null);

  const signInResponse = await signInAsAdministrator(eventEnv, {
    username: eventEnv.ADMIN_USERNAME,
    password: eventEnv.ADMIN_PASSWORD,
  });
  const signIn = await readJson(signInResponse);
  const accepted = await postEvent(eventEnv, administratorEvent, session, {
    authorization: `Bearer ${signIn.proof}`,
  });
  assert.equal(accepted.status, 201);

  const secondSession = await createSession(eventEnv, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(eventEnv, secondSession);
  const tamperedProof = await postEvent(
    eventEnv,
    event({ ...administratorEvent, id: "event-administrator-0002" }),
    secondSession,
    { authorization: `Bearer ${signIn.proof}x` }
  );
  assert.equal(tamperedProof.status, 403);
  assert.equal((await readJson(tamperedProof)).code, "administrator-authorization");
  assert.equal(eventEnv.personal_site_game_stats.sessions.get(secondSession.id).consumed_at, null);
});

test("rejects tampered, mismatched, too-fast, and cross-origin completion attempts", async () => {
  const env = createEnv();
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  const tooFast = await postEvent(env, event({ id: "event-fast" }), session);

  const mismatchSession = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, mismatchSession);
  const mismatch = await postEvent(
    env,
    event({ id: "event-mismatch", difficulty: "expert", metric: 100 }),
    mismatchSession
  );

  const tamperedSession = await createSession(env, "solitaire", {});
  await ageSessionForCompletion(env, tamperedSession);
  const tampered = await postEvent(
    env,
    event({ id: "event-token", game: "solitaire", metric: 90, metricKind: "moves" }),
    { ...tamperedSession, token: `${tamperedSession.token}x` }
  );

  const crossOrigin = await worker.fetch(
    jsonRequest(
      "/sessions",
      { game: "snake", config: { boardSize: "10" }, buildVersion: env.GAME_BUILD_VERSION },
      { origin: "https://untrusted.example" }
    ),
    env
  );
  const sudokuSession = await createSession(env, "sudoku", { difficulty: "easy" });
  await ageSessionForCompletion(env, sudokuSession);
  const missingSudokuTime = await postEvent(
    env,
    event({
      id: "event-sudoku-missing-time",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: undefined,
      metricKind: undefined,
    }),
    sudokuSession
  );

  assert.equal(tooFast.status, 400);
  assert.match((await readJson(tooFast)).error, /too quickly/);
  assert.equal(mismatch.status, 400);
  assert.match((await readJson(mismatch)).error, /does not match/);
  assert.equal(tampered.status, 403);
  assert.equal(crossOrigin.status, 403);
  assert.equal(missingSudokuTime.status, 400);
  assert.match((await readJson(missingSudokuTime)).error, /requires a completion time/);
});

test("requires a present allowed Origin for session and event writes", async () => {
  const env = createEnv();
  const missingSessionOrigin = await worker.fetch(
    jsonRequest(
      "/sessions",
      { game: "snake", config: { boardSize: "16" }, buildVersion: env.GAME_BUILD_VERSION },
      { origin: "" }
    ),
    env
  );

  assert.equal(missingSessionOrigin.status, 403);
  assert.deepEqual(await readJson(missingSessionOrigin), {
    ok: false,
    error: "Origin is not allowed",
  });
  assert.equal(env.personal_site_game_stats.sessions.size, 0);
  assert.equal(env.personal_site_game_stats.rateLimits.size, 0);

  const session = await createSession(env, "snake", { boardSize: "16" });
  await ageSessionForCompletion(env, session);
  const missingEventOrigin = await postEvent(
    env,
    event({
      id: "event-snake-missing-origin",
      game: "snake",
      type: "gamePlayed",
      boardSize: "16",
      metric: 1,
      metricKind: "score",
    }),
    session,
    { origin: "" }
  );

  assert.equal(missingEventOrigin.status, 403);
  assert.deepEqual(await readJson(missingEventOrigin), {
    ok: false,
    error: "Origin is not allowed",
  });
  assert.equal(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 0);
});

test("publishes a Snake result whose client IP changed after its session was issued", async () => {
  const env = createEnv();
  const session = await createSession(env, "snake", { boardSize: "16" });
  await ageSessionForCompletion(env, session);
  const snakeEvent = event({
    id: "event-snake-changed-ip",
    game: "snake",
    type: "gamePlayed",
    boardSize: "16",
    metric: 1,
    metricKind: "score",
  });

  const changedIpResponse = await postEvent(env, snakeEvent, session, {
    ip: "198.51.100.9",
  });
  assert.equal(changedIpResponse.status, 201);
  assert.equal((await readJson(changedIpResponse)).applied, true);
  assert.notEqual(env.personal_site_game_stats.sessions.get(session.id).consumed_at, null);
  assert.equal(env.personal_site_game_stats.events.size, 1);

  const replayResponse = await postEvent(env, snakeEvent, session);
  assert.equal(replayResponse.status, 200);
  assert.equal((await readJson(replayResponse)).applied, false);
  assert.equal(env.personal_site_game_stats.events.size, 1);

  const storedSession = env.personal_site_game_stats.sessions.get(session.id);
  const [encodedPayload] = session.token.split(".");
  const tokenPayload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  assert.equal(
    storedSession.ip_hash,
    tokenPayload.ipHash,
    "The issuing IP hash stays recorded on the session and inside its token."
  );
});

test("rate-limits session creation with an HMAC-derived bucket", async () => {
  const env = createEnv();
  assert.equal(MAX_SESSIONS_PER_WINDOW, 120);
  assert.equal(MAX_EVENTS_PER_WINDOW, 24);
  assert.equal(SESSION_TTL_MS, 6 * 60 * 60 * 1000);
  for (let index = 0; index < MAX_SESSIONS_PER_WINDOW; index += 1) {
    const response = await worker.fetch(
      jsonRequest("/sessions", {
        game: "solitaire",
        config: {},
        buildVersion: env.GAME_BUILD_VERSION,
      }),
      env
    );
    assert.equal(response.status, 201);
  }
  const blocked = await worker.fetch(
    jsonRequest("/sessions", {
      game: "solitaire",
      config: {},
      buildVersion: env.GAME_BUILD_VERSION,
    }),
    env
  );
  assert.equal(blocked.status, 429);
  const [bucket] = env.personal_site_game_stats.rateLimits.keys();
  assert.match(bucket, /^sessions:[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(bucket, /203\.0\.113\.7/);
});

test("requires strict Turnstile validation when configured", async () => {
  const env = createEnv({
    TURNSTILE_SECRET_KEY: "turnstile-test-secret",
    TURNSTILE_EXPECTED_HOSTNAME: "rohin.shanker.me",
    TURNSTILE_EXPECTED_ACTION: "game-session",
  });
  const missingToken = await worker.fetch(
    jsonRequest("/sessions", {
      game: "solitaire",
      config: {},
      buildVersion: env.GAME_BUILD_VERSION,
    }),
    env
  );
  assert.equal(missingToken.status, 400);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const form = new URLSearchParams(options.body);
    assert.equal(form.get("remoteip"), "203.0.113.7");
    assert.ok(form.get("idempotency_key"));
    return new Response(
      JSON.stringify({ success: true, hostname: "rohin.shanker.me", action: "game-session" })
    );
  };
  try {
    const verified = await worker.fetch(
      jsonRequest("/sessions", {
        game: "solitaire",
        config: {},
        buildVersion: env.GAME_BUILD_VERSION,
        turnstileToken: "valid-turnstile-token",
      }),
      env
    );
    assert.equal(verified.status, 201);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("builds leaderboards from validated stored events", () => {
  const stats = createGameStatsDataFromEvents([
    event({ id: "event-board-0001", metric: 60, profile: profile("player-a", "Ari") }),
    event({ id: "event-board-0002", metric: 35, profile: profile("player-b", "Kai") }),
  ]);
  assert.deepEqual(
    stats.leaderboards.minesweeper.beginner.map((entry) => entry.metric),
    [35, 60]
  );
});

test("builds the Solitaire leaderboard from each player's total validated wins", () => {
  const at = (second) => `2026-07-24T00:00:0${second}.000Z`;
  const solitaireWin = ({ id, player, moves, second }) =>
    event({
      id,
      game: "solitaire",
      type: "win",
      metric: moves,
      metricKind: "moves",
      occurredAt: at(second),
      profile: player,
    });
  const stats = createGameStatsDataFromEvents([
    solitaireWin({
      id: "solitaire-ari-0001",
      player: profile("solitaire-ari", "Ari"),
      moves: 91,
      second: 1,
    }),
    solitaireWin({
      id: "solitaire-kai-0001",
      player: profile("solitaire-kai", "Kai"),
      moves: 62,
      second: 2,
    }),
    solitaireWin({
      id: "solitaire-ari-0002",
      player: profile("solitaire-ari", "Ari"),
      moves: 180,
      second: 3,
    }),
    solitaireWin({
      id: "solitaire-nia-0001",
      player: profile("solitaire-nia", "Nia"),
      moves: 50,
      second: 4,
    }),
    solitaireWin({
      id: "solitaire-kai-0002",
      player: profile("solitaire-kai", "Kai"),
      moves: 240,
      second: 5,
    }),
    solitaireWin({
      id: "solitaire-ari-0003",
      player: profile("solitaire-ari", "Ari"),
      moves: 99,
      second: 6,
    }),
  ]);

  assert.equal(stats.totals.solitaire.wins, 6);
  assert.deepEqual(
    stats.leaderboards.solitaire.map(({ metric, metricKind, name }) => ({
      metric,
      metricKind,
      name,
    })),
    [
      { metric: 3, metricKind: "wins", name: "Ari" },
      { metric: 2, metricKind: "wins", name: "Kai" },
      { metric: 1, metricKind: "wins", name: "Nia" },
    ]
  );
});

test("builds each Sudoku leaderboard from fastest no-hints completions", () => {
  const stats = createGameStatsDataFromEvents([
    event({
      id: "event-sudoku-board-0001",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 90,
      metricKind: "seconds",
      profile: profile("sudoku-a", "Ari"),
    }),
    event({
      id: "event-sudoku-board-0002",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 45,
      metricKind: "seconds",
      profile: profile("sudoku-b", "Kai"),
    }),
    event({
      id: "event-sudoku-board-0003",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 30,
      metricKind: "seconds",
      profile: profile("sudoku-a", "Ari"),
    }),
    event({
      id: "event-sudoku-board-0004",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "noHints",
      metric: 80,
      metricKind: "seconds",
      profile: profile("sudoku-d", "Nia"),
    }),
    event({
      id: "event-sudoku-board-0005",
      game: "sudoku",
      type: "win",
      difficulty: "easy",
      hintBucket: "withHints",
      metric: 12,
      metricKind: "seconds",
      profile: profile("sudoku-c", "Mina"),
    }),
  ]);

  assert.deepEqual(
    stats.leaderboards.sudoku.easy.map((entry) => entry.metric),
    [30, 45, 80]
  );
  assert.deepEqual(stats.totals.sudoku.wins.easy, { noHints: 4, withHints: 1 });
});

test("returns a requested player's best Minesweeper rank beyond the public top three", () => {
  const stats = createGameStatsDataFromEvents(
    [
      event({ id: "event-rank-0001", metric: 12, profile: profile("player-alpha", "Alpha") }),
      event({ id: "event-rank-0002", metric: 24, profile: profile("player-bravo", "Bravo") }),
      event({ id: "event-rank-0003", metric: 36, profile: profile("player-charlie", "Charlie") }),
      event({ id: "event-rank-0004", metric: 80, profile: profile("player-delta", "Delta") }),
      event({ id: "event-rank-0005", metric: 48, profile: profile("player-delta", "Delta") }),
      event({ id: "event-rank-0006", metric: 60, profile: null }),
    ],
    "player-delta"
  );

  assert.deepEqual(
    stats.leaderboards.minesweeper.beginner.map((entry) => entry.metric),
    [12, 24, 36]
  );
  assert.deepEqual(stats.playerRanks.minesweeper.beginner, { rank: 4, totalPlayers: 4 });
  assert.deepEqual(
    createGameStatsDataFromEvents([], "player-missing").playerRanks.minesweeper.beginner,
    { rank: null, totalPlayers: 0 }
  );
});

test("breaks equal metrics by earliest completion and then event id for every game", () => {
  const tiedPlayers = [
    profile("tie-player-alpha", "Alpha"),
    profile("tie-player-bravo", "Bravo"),
    profile("tie-player-charlie", "Charlie"),
  ];
  const early = "2024-01-01T00:00:00.000Z";
  const late = "2024-01-02T00:00:00.000Z";
  const tiedEvents = [];

  [
    ["tie-ms-alpha-01", tiedPlayers[0], early],
    ["tie-ms-bravo-01", tiedPlayers[1], early],
    ["tie-ms-charlie-01", tiedPlayers[2], late],
  ].forEach(([id, player, occurredAt]) => {
    tiedEvents.push(event({ id, metric: 42, occurredAt, profile: player }));
  });
  [
    ["tie-sol-alpha-01", tiedPlayers[0], early],
    ["tie-sol-bravo-01", tiedPlayers[1], early],
    ["tie-sol-charlie-01", tiedPlayers[2], late],
  ].forEach(([id, player, occurredAt]) => {
    tiedEvents.push(
      event({
        id,
        game: "solitaire",
        type: "win",
        metric: 80,
        metricKind: "moves",
        occurredAt,
        profile: player,
      })
    );
  });
  [
    ["tie-snake-alpha-01", tiedPlayers[0], early],
    ["tie-snake-bravo-01", tiedPlayers[1], early],
    ["tie-snake-charlie-01", tiedPlayers[2], late],
  ].forEach(([id, player, occurredAt]) => {
    tiedEvents.push(
      event({
        id,
        game: "snake",
        type: "gamePlayed",
        boardSize: "10",
        metric: 50,
        metricKind: "score",
        occurredAt,
        profile: player,
      })
    );
  });
  [
    ["tie-sudoku-alpha-01", tiedPlayers[0], early],
    ["tie-sudoku-bravo-01", tiedPlayers[1], early],
    ["tie-sudoku-charlie-01", tiedPlayers[2], late],
  ].forEach(([id, player, occurredAt]) => {
    tiedEvents.push(
      event({
        id,
        game: "sudoku",
        type: "win",
        difficulty: "easy",
        hintBucket: "noHints",
        metric: 77,
        metricKind: "seconds",
        occurredAt,
        profile: player,
      })
    );
  });

  const stats = createGameStatsDataFromEvents(tiedEvents, tiedPlayers[1].id);
  const expectedPlayerOrder = tiedPlayers.map(({ id }) => id);
  assert.deepEqual(
    stats.leaderboards.minesweeper.beginner.map(({ playerId }) => playerId),
    expectedPlayerOrder
  );
  assert.deepEqual(
    stats.leaderboards.solitaire.map(({ playerId }) => playerId),
    expectedPlayerOrder
  );
  assert.deepEqual(
    stats.leaderboards.snake["10"].map(({ playerId }) => playerId),
    expectedPlayerOrder
  );
  assert.deepEqual(
    stats.leaderboards.sudoku.easy.map(({ playerId }) => playerId),
    expectedPlayerOrder
  );
  assert.deepEqual(stats.playerRanks.minesweeper.beginner, {
    rank: 2,
    totalPlayers: 3,
  });
  assert.deepEqual(stats.playerRanks.solitaire, { rank: 2, totalPlayers: 3 });
  assert.deepEqual(stats.playerRanks.snake["10"], { rank: 2, totalPlayers: 3 });
  assert.deepEqual(stats.playerRanks.sudoku.easy, { rank: 2, totalPlayers: 3 });
});

test("ranks every multiplayer category across trusted historical stored events", async () => {
  const env = createEnv();
  const minesweeperDifficulties = ["beginner", "intermediate", "expert"];
  const snakeBoardSizes = ["10", "16", "20", "24"];
  const sudokuDifficulties = ["easy", "medium", "hard", "expert", "master", "extreme"];
  const players = Array.from({ length: 12 }, (_, index) =>
    profile(`stress-player-${String(index).padStart(2, "0")}`, `Player ${index}`)
  );
  let timestampOffset = 0;
  const recentTimestamp = () =>
    new Date(Date.now() - 60 * 60 * 1000 - timestampOffset++ * 1000).toISOString();

  players.forEach((player, playerIndex) => {
    minesweeperDifficulties.forEach((difficulty, difficultyIndex) => {
      storeTrustedEvent(
        env,
        event({
          id: `stress-ms-${difficulty}-${String(playerIndex).padStart(2, "0")}`,
          difficulty,
          metric: 10 + playerIndex + difficultyIndex,
          occurredAt:
            playerIndex === 0 && difficulty === "beginner"
              ? "2020-01-01T00:00:00.000Z"
              : recentTimestamp(),
          profile: player,
        })
      );
    });

    for (let winIndex = 0; winIndex < players.length - playerIndex; winIndex += 1) {
      storeTrustedEvent(
        env,
        event({
          id: `stress-sol-${String(playerIndex).padStart(2, "0")}-${String(winIndex).padStart(2, "0")}`,
          game: "solitaire",
          type: "win",
          metric: 80 + winIndex,
          metricKind: "moves",
          occurredAt: recentTimestamp(),
          profile: player,
        })
      );
    }

    snakeBoardSizes.forEach((boardSize, sizeIndex) => {
      storeTrustedEvent(
        env,
        event({
          id: `stress-snake-${boardSize}-${String(playerIndex).padStart(2, "0")}`,
          game: "snake",
          type: "gamePlayed",
          boardSize,
          metric: 80 - playerIndex - sizeIndex,
          metricKind: "score",
          occurredAt: recentTimestamp(),
          profile: player,
        })
      );
    });

    sudokuDifficulties.forEach((difficulty, difficultyIndex) => {
      storeTrustedEvent(
        env,
        event({
          id: `stress-sudoku-${difficulty}-${String(playerIndex).padStart(2, "0")}`,
          game: "sudoku",
          type: "win",
          difficulty,
          hintBucket: "noHints",
          metric: 100 + playerIndex + difficultyIndex,
          metricKind: "seconds",
          occurredAt: recentTimestamp(),
          profile: player,
        })
      );
      storeTrustedEvent(
        env,
        event({
          id: `stress-hints-${difficulty}-${String(playerIndex).padStart(2, "0")}`,
          game: "sudoku",
          type: "win",
          difficulty,
          hintBucket: "withHints",
          metric: 1,
          metricKind: "seconds",
          occurredAt: recentTimestamp(),
          profile: player,
        })
      );
    });
  });

  const partialPlayer = profile("stress-player-partial", "Partial");
  storeTrustedEvent(
    env,
    event({
      id: "stress-partial-beginner",
      difficulty: "beginner",
      metric: 900,
      occurredAt: recentTimestamp(),
      profile: partialPlayer,
    })
  );

  const fetchStats = async (playerId) => {
    const response = await worker.fetch(
      new Request(`https://stats.example.test/stats?playerId=${playerId}`, {
        headers: { Origin: "https://rohin.shanker.me" },
      }),
      env
    );
    assert.equal(response.status, 200);
    return readJson(response);
  };
  const assertPlayerAcrossCategories = (stats, playerIndex, expectedRank) => {
    const expectedPlayerId = players[playerIndex].id;
    minesweeperDifficulties.forEach((difficulty, difficultyIndex) => {
      assert.deepEqual(stats.playerRanks.minesweeper[difficulty], {
        rank: expectedRank,
        totalPlayers: difficulty === "beginner" ? 13 : 12,
      });
      assert.equal(stats.playerRecords.minesweeper[difficulty].playerId, expectedPlayerId);
      assert.equal(
        stats.playerRecords.minesweeper[difficulty].metric,
        10 + playerIndex + difficultyIndex
      );
    });
    assert.deepEqual(stats.playerRanks.solitaire, { rank: expectedRank, totalPlayers: 12 });
    assert.equal(stats.playerRecords.solitaire.playerId, expectedPlayerId);
    assert.equal(stats.playerRecords.solitaire.metric, players.length - playerIndex);
    snakeBoardSizes.forEach((boardSize, sizeIndex) => {
      assert.deepEqual(stats.playerRanks.snake[boardSize], {
        rank: expectedRank,
        totalPlayers: 12,
      });
      assert.equal(stats.playerRecords.snake[boardSize].playerId, expectedPlayerId);
      assert.equal(stats.playerRecords.snake[boardSize].metric, 80 - playerIndex - sizeIndex);
    });
    sudokuDifficulties.forEach((difficulty, difficultyIndex) => {
      assert.deepEqual(stats.playerRanks.sudoku[difficulty], {
        rank: expectedRank,
        totalPlayers: 12,
      });
      assert.equal(stats.playerRecords.sudoku[difficulty].playerId, expectedPlayerId);
      assert.equal(
        stats.playerRecords.sudoku[difficulty].metric,
        100 + playerIndex + difficultyIndex
      );
    });
  };
  const assertGlobalTopThree = (stats) => {
    const topPlayerIds = players.slice(0, 3).map((player) => player.id);
    minesweeperDifficulties.forEach((difficulty) => {
      assert.deepEqual(
        stats.leaderboards.minesweeper[difficulty].map((entry) => entry.playerId),
        topPlayerIds
      );
    });
    assert.deepEqual(
      stats.leaderboards.solitaire.map((entry) => entry.playerId),
      topPlayerIds
    );
    snakeBoardSizes.forEach((boardSize) => {
      assert.deepEqual(
        stats.leaderboards.snake[boardSize].map((entry) => entry.playerId),
        topPlayerIds
      );
    });
    sudokuDifficulties.forEach((difficulty) => {
      assert.deepEqual(
        stats.leaderboards.sudoku[difficulty].map((entry) => entry.playerId),
        topPlayerIds
      );
    });
  };

  const topThreeStats = await fetchStats(players[2].id);
  assertPlayerAcrossCategories(topThreeStats, 2, 3);
  assertGlobalTopThree(topThreeStats);

  const outsideTopThreeStats = await fetchStats(players[10].id);
  assertPlayerAcrossCategories(outsideTopThreeStats, 10, 11);
  assertGlobalTopThree(outsideTopThreeStats);
  assert.ok(
    Object.values(outsideTopThreeStats.leaderboards).every((leaderboardGroup) =>
      Array.isArray(leaderboardGroup)
        ? leaderboardGroup.every((entry) => entry.playerId !== players[10].id)
        : Object.values(leaderboardGroup).every((entries) =>
            entries.every((entry) => entry.playerId !== players[10].id)
          )
    )
  );

  const partialStats = await fetchStats(partialPlayer.id);
  assert.deepEqual(partialStats.playerRanks.minesweeper.beginner, {
    rank: 13,
    totalPlayers: 13,
  });
  assert.equal(partialStats.playerRecords.minesweeper.beginner.playerId, partialPlayer.id);
  minesweeperDifficulties.slice(1).forEach((difficulty) => {
    assert.deepEqual(partialStats.playerRanks.minesweeper[difficulty], {
      rank: null,
      totalPlayers: 12,
    });
    assert.equal(partialStats.playerRecords.minesweeper[difficulty], null);
  });
  assert.deepEqual(partialStats.playerRanks.solitaire, { rank: null, totalPlayers: 12 });
  assert.equal(partialStats.playerRecords.solitaire, null);
  snakeBoardSizes.forEach((boardSize) => {
    assert.deepEqual(partialStats.playerRanks.snake[boardSize], {
      rank: null,
      totalPlayers: 12,
    });
    assert.equal(partialStats.playerRecords.snake[boardSize], null);
  });
  sudokuDifficulties.forEach((difficulty) => {
    assert.deepEqual(partialStats.playerRanks.sudoku[difficulty], {
      rank: null,
      totalPlayers: 12,
    });
    assert.equal(partialStats.playerRecords.sudoku[difficulty], null);
  });

  assert.equal(topThreeStats.totals.sudoku.wins.easy.withHints, 12);
  assert.equal(
    topThreeStats.leaderboards.minesweeper.beginner[0].occurredAt,
    "2020-01-01T00:00:00.000Z"
  );
});

test("stats query rejects invalid player ids", async () => {
  const env = createEnv();
  const invalidResponse = await worker.fetch(
    new Request("https://stats.example.test/stats?playerId=invalid", {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );
  assert.equal(invalidResponse.status, 400);
});

test("the scheduled purge deletes only expired sessions and rate-limit buckets", async () => {
  const env = createEnv();
  const database = env.personal_site_game_stats;
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60 * 60_000).toISOString();

  for (const [id, expiresAt] of [
    ["expired-session", past],
    ["live-session", future],
  ]) {
    database.sessions.set(id, {
      id,
      game: "minesweeper",
      config_json: JSON.stringify({ difficulty: "beginner" }),
      build_version: buildVersion,
      ip_hash: "hash",
      issued_at: past,
      expires_at: expiresAt,
      consumed_at: null,
    });
  }
  for (const [bucket, expiresAt] of [
    ["sessions:expired", past],
    ["events:live", future],
  ]) {
    database.rateLimits.set(bucket, {
      request_count: 3,
      window_started_at: past,
      expires_at: expiresAt,
    });
  }

  const summary = await purgeExpiredGameStatsRows(env);

  assert.equal(summary.expiredSessions, 1);
  assert.equal(summary.expiredRateLimitBuckets, 1);
  assert.equal(summary.expiredUnpublishedCompletions, 0);
  assert.match(summary.purgedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(Array.from(database.sessions.keys()), ["live-session"]);
  assert.deepEqual(Array.from(database.rateLimits.keys()), ["events:live"]);

  const repeated = await purgeExpiredGameStatsRows(env);
  assert.equal(repeated.expiredSessions, 0);
  assert.equal(repeated.expiredRateLimitBuckets, 0);
  assert.equal(repeated.expiredUnpublishedCompletions, 0);
});

test("the scheduled purge keeps a consumed session until it expires", async () => {
  const env = createEnv();
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  await ageSessionForCompletion(env, session);
  const stored = env.personal_site_game_stats.sessions.get(session.id);
  stored.consumed_at = new Date().toISOString();

  const retained = await purgeExpiredGameStatsRows(env);
  assert.equal(retained.expiredSessions, 0);
  assert.equal(retained.expiredUnpublishedCompletions, 0);
  assert.ok(env.personal_site_game_stats.sessions.has(session.id));

  stored.expires_at = new Date(Date.now() - 1_000).toISOString();
  const purged = await purgeExpiredGameStatsRows(env);
  assert.equal(purged.expiredSessions, 1);
  assert.equal(purged.expiredUnpublishedCompletions, 0);
  assert.equal(env.personal_site_game_stats.sessions.size, 0);
});

test("the cron entry point purges through the Worker export and logs its summary", async (context) => {
  const log = context.mock.method(console, "log", () => {});
  const env = createEnv();
  env.personal_site_game_stats.sessions.set("expired-session", {
    id: "expired-session",
    game: "snake",
    config_json: "{}",
    build_version: buildVersion,
    ip_hash: "hash",
    issued_at: new Date(Date.now() - 120_000).toISOString(),
    expires_at: new Date(Date.now() - 60_000).toISOString(),
    consumed_at: null,
  });

  await worker.scheduled({ cron: "0 * * * *", scheduledTime: Date.now() }, env);

  assert.equal(env.personal_site_game_stats.sessions.size, 0);
  assert.match(
    log.mock.calls.at(-1).arguments[0],
    /Purged 1 expired game sessions and 0 unpublished completions and 0 rate-limit buckets at /
  );
});

test("the scheduled purge fails loudly without a database binding or on a D1 error", async () => {
  await assert.rejects(
    purgeExpiredGameStatsRows({}),
    /D1 database binding is not configured/
  );

  const batchError = new Error("Simulated D1 purge failure");
  await assert.rejects(
    purgeExpiredGameStatsRows({
      personal_site_game_stats: {
        prepare: () => ({ bind: () => ({}) }),
        batch: async () => {
          throw batchError;
        },
      },
    }),
    batchError
  );
});

/** A body sent without Content-Length, the way a chunked request arrives. */
const chunkedJsonRequest = (path, body, { origin = "https://rohin.shanker.me" } = {}) =>
  new Request(`https://stats.example.test${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "CF-Connecting-IP": "203.0.113.7",
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));
        controller.close();
      },
    }),
    duplex: "half",
  });

test("the request body limit counts bytes, so a short non-ASCII body is rejected", async () => {
  const env = createEnv();
  // 3,000 UTF-16 code units, but three bytes each: under the old character
  // limit and far over the 4,096-byte one.
  const multiByteName = "✓".repeat(3_000);
  assert.ok(multiByteName.length < 4_096);
  assert.ok(new TextEncoder().encode(multiByteName).byteLength > 4_096);

  const oversized = await worker.fetch(
    chunkedJsonRequest("/sessions", {
      game: "solitaire",
      config: {},
      buildVersion: env.GAME_BUILD_VERSION,
      turnstileToken: multiByteName,
    }),
    env
  );
  assert.equal(oversized.status, 413);
  assert.equal((await readJson(oversized)).error, "Request body is too large");
  assert.equal(env.personal_site_game_stats.sessions.size, 0);
});

test("a chunked body within the byte limit is decoded and accepted", async () => {
  const env = createEnv();
  const accepted = await worker.fetch(
    chunkedJsonRequest("/sessions", {
      game: "minesweeper",
      config: { difficulty: "beginner" },
      buildVersion: env.GAME_BUILD_VERSION,
    }),
    env
  );

  assert.equal(accepted.status, 201);
  assert.equal(env.personal_site_game_stats.sessions.size, 1);

  const malformed = await worker.fetch(
    new Request("https://stats.example.test/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://rohin.shanker.me",
        "CF-Connecting-IP": "203.0.113.7",
      },
      body: "{ not json",
    }),
    env
  );
  assert.equal(malformed.status, 400);
  assert.equal((await readJson(malformed)).error, "Request body must be valid JSON");
});

test("Turnstile verification is time bounded and treats an unreadable reply as a rejection", async () => {
  const env = createEnv({
    TURNSTILE_SECRET_KEY: "turnstile-test-secret",
    TURNSTILE_EXPECTED_HOSTNAME: "rohin.shanker.me",
    TURNSTILE_EXPECTED_ACTION: "game-session",
  });
  const requestSession = () =>
    worker.fetch(
      jsonRequest("/sessions", {
        game: "solitaire",
        config: {},
        buildVersion: env.GAME_BUILD_VERSION,
        turnstileToken: "valid-turnstile-token",
      }),
      env
    );

  const originalFetch = globalThis.fetch;
  const signals = [];
  try {
    globalThis.fetch = async (url, options) => {
      signals.push(options.signal);
      return new Response("<html>gateway error</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      });
    };
    const htmlReply = await requestSession();
    assert.equal(htmlReply.status, 403);
    assert.equal((await readJson(htmlReply)).error, "Turnstile verification failed");

    globalThis.fetch = async (url, options) => {
      signals.push(options.signal);
      return new Response(JSON.stringify({ success: false, "error-codes": ["bad"] }));
    };
    assert.equal((await requestSession()).status, 403);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(signals.length, 2);
  for (const signal of signals) {
    assert.ok(signal instanceof AbortSignal, "every Turnstile request must be bounded");
    assert.equal(signal.aborted, false);
  }
  assert.equal(env.personal_site_game_stats.sessions.size, 0);
});

test("a Turnstile timeout or transport failure is rejected, not reported as a server fault", async () => {
  const env = createEnv({
    TURNSTILE_SECRET_KEY: "turnstile-test-secret",
    TURNSTILE_EXPECTED_HOSTNAME: "rohin.shanker.me",
    TURNSTILE_EXPECTED_ACTION: "game-session",
  });
  const requestSession = () =>
    worker.fetch(
      jsonRequest("/sessions", {
        game: "solitaire",
        config: {},
        buildVersion: env.GAME_BUILD_VERSION,
        turnstileToken: "valid-turnstile-token",
      }),
      env
    );
  const expectRejected = async (response) => {
    assert.equal(response.status, 403);
    assert.equal((await readJson(response)).error, "Turnstile verification failed");
  };

  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  // Waiting out the handler's real five-second bound would make this test the
  // slowest in the file, so shorten the signal it asks for and assert the bound
  // it requested instead.
  const requestedTimeouts = [];
  try {
    AbortSignal.timeout = (milliseconds) => {
      requestedTimeouts.push(milliseconds);
      return originalTimeout.call(AbortSignal, 20);
    };

    globalThis.fetch = async () => {
      throw new DOMException("The operation was aborted", "AbortError");
    };
    await expectRejected(await requestSession());

    globalThis.fetch = async () => {
      throw new TypeError("network error");
    };
    await expectRejected(await requestSession());

    // A transport that never answers must lose to the abort signal rather than
    // leaving the caller with an unexplained 500.
    globalThis.fetch = (url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () =>
          reject(options.signal.reason ?? new DOMException("Aborted", "AbortError"))
        );
      });
    await expectRejected(await requestSession());
  } finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
  }

  assert.deepEqual(requestedTimeouts, [5_000, 5_000, 5_000]);
  assert.equal(env.personal_site_game_stats.sessions.size, 0);
});

test("a session that was never stored is reported apart from a consumed one", async () => {
  const env = createEnv();
  const session = await createSession(env, "solitaire", {});
  await ageSessionForCompletion(env, session);
  const solitaireWin = event({
    id: "event-missing-session",
    game: "solitaire",
    difficulty: undefined,
    metric: 120,
    metricKind: "moves",
  });

  env.personal_site_game_stats.sessions.delete(session.id);
  const missing = await postEvent(env, solitaireWin, session);
  assert.equal(missing.status, 409);
  assert.equal((await readJson(missing)).error, "Game session is no longer on record");

  const replayed = await createSession(env, "solitaire", {});
  await ageSessionForCompletion(env, replayed);
  env.personal_site_game_stats.sessions.get(replayed.id).consumed_at =
    new Date().toISOString();
  const consumed = await postEvent(
    env,
    { ...solitaireWin, id: "event-consumed-session" },
    replayed
  );
  assert.equal(consumed.status, 409);
  assert.equal((await readJson(consumed)).error, "Game session was already used");
});

test("a consumed session's duplicate is validated exactly like a fresh one", async () => {
  const env = createEnv();
  const player = profile("player-sudoku-spent", "Spent");
  const identity = { puzzleId: "generated-easy-spent", puzzle: SUDOKU_PUZZLE };
  const base = event({
    game: "sudoku",
    type: "win",
    difficulty: "easy",
    hintBucket: "noHints",
    ...identity,
    metric: 90,
    metricKind: "seconds",
    profile: player,
  });
  const session = await createSession(env, "sudoku", { difficulty: "easy" });
  await ageSessionForCompletion(env, session);
  assert.equal((await postEvent(env, { ...base, id: "event-spent-first" }, session)).status, 201);
  assert.ok(env.personal_site_game_stats.sessions.get(session.id).consumed_at);

  // A lost response retried with the same id is acknowledged.
  const retry = await postEvent(env, { ...base, id: "event-spent-first" }, session);
  assert.equal(retry.status, 200);
  assert.equal((await readJson(retry)).eventId, "event-spent-first");

  // A second tab's own id for the same puzzle is answered with the standing row.
  const secondTab = await postEvent(
    env,
    { ...base, id: "event-spent-second-tab", metric: 75 },
    session
  );
  assert.equal(secondTab.status, 200);
  assert.deepEqual(await readJson(secondTab), {
    ok: true,
    applied: false,
    eventId: "event-spent-first",
  });

  // A difficulty the session was not started for is refused, as a fresh
  // session refuses it, not acknowledged.
  const wrongDifficulty = await postEvent(
    env,
    { ...base, id: "event-spent-wrong-difficulty", difficulty: "hard" },
    session
  );
  assert.equal(wrongDifficulty.status, 400);
  assert.match((await readJson(wrongDifficulty)).error, /does not match the started game/);

  // So is a result dated before the session began.
  const early = await postEvent(
    env,
    {
      ...base,
      id: "event-spent-early",
      occurredAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    session
  );
  assert.equal(early.status, 400);
  assert.match((await readJson(early)).error, /outside its session window/);

  // A different puzzle on the spent session is still a reused session.
  const reuse = await postEvent(
    env,
    { ...base, id: "event-spent-reuse", puzzleId: "generated-easy-spent-next" },
    session
  );
  assert.equal(reuse.status, 409);
  assert.match((await readJson(reuse)).error, /already used/);

  // The first result is the only row, unchanged.
  assert.equal(env.personal_site_game_stats.events.size, 1);
  assert.equal(env.personal_site_game_stats.events.get("event-spent-first").metric, 90);
});
