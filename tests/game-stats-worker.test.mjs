import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  createGameStatsDataFromEvents,
  normalizeGameStatsEvent,
} from "../workers/game-stats/src/index.mjs";

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
    if (this.sql.includes("INSERT OR IGNORE INTO game_events")) {
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
      ] = this.params;
      if (this.database.events.has(id)) return { meta: { changes: 0 } };
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
      const [consumedAt, id, now] = this.params;
      const session = this.database.sessions.get(id);
      if (!session || session.consumed_at || session.expires_at <= now) {
        return { meta: { changes: 0 } };
      }
      session.consumed_at = consumedAt;
      return { meta: { changes: 1 } };
    }
    if (this.sql.includes("INSERT INTO game_stats_rate_limits")) {
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
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unhandled write query: ${this.sql}`);
  }

  async all() {
    assert.match(this.sql, /FROM game_events/);
    return { results: Array.from(this.database.events.values()) };
  }

  async first() {
    if (this.sql.includes("FROM game_events WHERE id")) {
      return this.database.events.get(this.params[0]) || null;
    }
    if (this.sql.includes("FROM game_stat_sessions")) {
      return this.database.sessions.get(this.params[0]) || null;
    }
    if (this.sql.includes("FROM game_stats_rate_limits")) {
      return this.database.rateLimits.get(this.params[0]) || null;
    }
    throw new Error(`Unhandled read query: ${this.sql}`);
  }
}

class MockD1Database {
  constructor() {
    this.events = new Map();
    this.sessions = new Map();
    this.rateLimits = new Map();
  }

  prepare(sql) {
    return new MockD1Statement(this, sql);
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
  ...overrides,
});

const profile = (id, name = id) => ({
  id,
  name,
  icon: "assets/app-icons/ico/user_card.ico",
});

const event = (overrides = {}) => ({
  id: "event-0001",
  game: "minesweeper",
  type: "win",
  difficulty: "beginner",
  metric: 42,
  metricKind: "seconds",
  occurredAt: new Date().toISOString(),
  profile: profile("player-0001", "Mira"),
  ...overrides,
});

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
      Origin: origin,
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

const ageSessionForCompletion = (env, sessionId, elapsedMs = 15_000) => {
  const session = env.personal_site_game_stats.sessions.get(sessionId);
  session.issued_at = new Date(Date.now() - elapsedMs).toISOString();
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
  const unapprovedAvatar = normalizeGameStatsEvent(
    event({
      id: "event-unapproved-png-avatar",
      profile: {
        id: "player-unapproved",
        name: "Unapproved",
        icon: "assets/neko-assets/sprites/yawn2.png",
      },
    })
  );

  assert.equal(yawnAvatar.profile.icon, "assets/neko-assets/sprites/yawn1.png");
  assert.equal(unapprovedAvatar.profile, null);
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
    ageSessionForCompletion(env, session.id);
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

test("makes an accepted event idempotent without allowing a second session use", async () => {
  const env = createEnv();
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  ageSessionForCompletion(env, session.id);
  const first = await postEvent(env, event({ id: "event-idempotent" }), session);
  const duplicate = await postEvent(env, event({ id: "event-idempotent" }), session);
  const secondEvent = await postEvent(env, event({ id: "event-second" }), session);

  assert.equal(first.status, 201);
  assert.equal((await readJson(first)).applied, true);
  assert.equal(duplicate.status, 200);
  assert.equal((await readJson(duplicate)).applied, false);
  assert.equal(secondEvent.status, 409);
});

test("issues an opaque, short-lived administrator proof only after valid credentials", async () => {
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
  ageSessionForCompletion(eventEnv, session.id);
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
  ageSessionForCompletion(eventEnv, secondSession.id);
  const tamperedProof = await postEvent(
    eventEnv,
    event({ ...administratorEvent, id: "event-administrator-0002" }),
    secondSession,
    { authorization: `Bearer ${signIn.proof}x` }
  );
  assert.equal(tamperedProof.status, 403);
  assert.equal(eventEnv.personal_site_game_stats.sessions.get(secondSession.id).consumed_at, null);
});

test("rejects tampered, mismatched, too-fast, and cross-origin completion attempts", async () => {
  const env = createEnv();
  const session = await createSession(env, "minesweeper", { difficulty: "beginner" });
  const tooFast = await postEvent(env, event({ id: "event-fast" }), session);

  const mismatchSession = await createSession(env, "minesweeper", { difficulty: "beginner" });
  ageSessionForCompletion(env, mismatchSession.id);
  const mismatch = await postEvent(
    env,
    event({ id: "event-mismatch", difficulty: "expert", metric: 100 }),
    mismatchSession
  );

  const tamperedSession = await createSession(env, "solitaire", {});
  ageSessionForCompletion(env, tamperedSession.id);
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
  ageSessionForCompletion(env, sudokuSession.id);
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

test("rate-limits session creation with an HMAC-derived bucket", async () => {
  const env = createEnv();
  for (let index = 0; index < 24; index += 1) {
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

test("stats query returns only the requested player's rank and rejects invalid player ids", async () => {
  const env = createEnv();
  const rawEvents = [
    event({ id: "event-query-0001", metric: 10, profile: profile("player-alpha", "Alpha") }),
    event({ id: "event-query-0002", metric: 20, profile: profile("player-bravo", "Bravo") }),
    event({ id: "event-query-0003", metric: 30, profile: profile("player-charlie", "Charlie") }),
    event({ id: "event-query-0004", metric: 40, profile: profile("player-delta", "Delta") }),
  ].map(normalizeGameStatsEvent);
  rawEvents.forEach((storedEvent) => {
    env.personal_site_game_stats.events.set(storedEvent.id, {
      id: storedEvent.id,
      game: storedEvent.game,
      type: storedEvent.type,
      difficulty: storedEvent.difficulty,
      board_size: null,
      hint_bucket: null,
      metric: storedEvent.metric,
      metric_kind: storedEvent.metricKind,
      player_id: storedEvent.profile.id,
      player_name: storedEvent.profile.name,
      player_icon: storedEvent.profile.icon,
      occurred_at: storedEvent.occurredAt,
    });
  });

  const rankedResponse = await worker.fetch(
    new Request("https://stats.example.test/stats?playerId=player-delta", {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );
  assert.equal(rankedResponse.status, 200);
  assert.deepEqual((await readJson(rankedResponse)).playerRanks.minesweeper.beginner, {
    rank: 4,
    totalPlayers: 4,
  });

  const invalidResponse = await worker.fetch(
    new Request("https://stats.example.test/stats?playerId=invalid", {
      headers: { Origin: "https://rohin.shanker.me" },
    }),
    env
  );
  assert.equal(invalidResponse.status, 400);
});
