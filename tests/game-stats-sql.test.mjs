import assert from "node:assert/strict";
import test from "node:test";

import {
  SELECT_STATS_RANKINGS_SQL,
  SELECT_STATS_TOTALS_SQL,
  selectAggregatedGameStats,
} from "../workers/game-stats/src/aggregate.mjs";
import worker from "../workers/game-stats/src/index.mjs";
import { SqliteD1Database, applyGameStatsMigrations } from "./helpers/sqlite-d1.mjs";

const migrationPaths = [1, 2, 3, 4].map(
  (number) =>
    new URL(
      `../workers/game-stats/migrations/${String(number).padStart(4, "0")}_${[
        "create_game_stats",
        "add_game_stat_security",
        "add_sudoku_puzzle_identity",
        "optimize_stats_aggregation",
      ][number - 1]}.sql`,
      import.meta.url
    ).pathname
);

const icon = "assets/app-icons/ico/user_card.ico";

const insertEvent = (database, {
  id,
  game,
  type,
  difficulty = null,
  boardSize = null,
  hintBucket = null,
  metric = null,
  metricKind = null,
  playerId = null,
  playerName = null,
  playerIcon = null,
  occurredAt,
}) => {
  database.sqlite.prepare(`
    INSERT INTO game_events (
      id, game, type, difficulty, board_size, hint_bucket, metric, metric_kind,
      player_id, player_name, player_icon, occurred_at, puzzle_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
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
    occurredAt
  );
};

const createDatabase = () => {
  const database = new SqliteD1Database();
  applyGameStatsMigrations(database, migrationPaths);
  return database;
};

test("SQL aggregation ranks 12 players in every category without returning raw rows", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());
  const env = { personal_site_game_stats: database };
  const players = Array.from({ length: 12 }, (_, index) => ({
    id: `sql-player-${String(index).padStart(2, "0")}`,
    name: `Player ${index}`,
  }));
  const minesweeper = ["beginner", "intermediate", "expert"];
  const snake = ["10", "16", "20", "24"];
  const sudoku = ["easy", "medium", "hard", "expert", "master", "extreme"];
  let sequence = 0;
  const at = () => new Date(Date.now() - 86_400_000 + sequence++ * 1000).toISOString();

  players.forEach((player, playerIndex) => {
    minesweeper.forEach((difficulty, categoryIndex) => {
      insertEvent(database, {
        id: `sql-ms-${difficulty}-${String(playerIndex).padStart(2, "0")}`,
        game: "minesweeper",
        type: "win",
        difficulty,
        metric: 10 + playerIndex + categoryIndex,
        metricKind: "seconds",
        playerId: player.id,
        playerName: player.name,
        playerIcon: icon,
        occurredAt: at(),
      });
    });
    for (let win = 0; win < players.length - playerIndex; win += 1) {
      insertEvent(database, {
        id: `sql-sol-${String(playerIndex).padStart(2, "0")}-${String(win).padStart(2, "0")}`,
        game: "solitaire",
        type: "win",
        metric: 50 + win,
        metricKind: "moves",
        playerId: player.id,
        playerName: win === players.length - playerIndex - 1 ? `Latest ${playerIndex}` : player.name,
        playerIcon: icon,
        occurredAt: at(),
      });
    }
    snake.forEach((boardSize, categoryIndex) => {
      insertEvent(database, {
        id: `sql-snake-${boardSize}-${String(playerIndex).padStart(2, "0")}`,
        game: "snake",
        type: "gamePlayed",
        boardSize,
        metric: 80 - playerIndex - categoryIndex,
        metricKind: "score",
        playerId: player.id,
        playerName: player.name,
        playerIcon: icon,
        occurredAt: at(),
      });
    });
    sudoku.forEach((difficulty, categoryIndex) => {
      for (const hintBucket of ["noHints", "withHints"]) {
        insertEvent(database, {
          id: `sql-su-${hintBucket.toLowerCase()}-${difficulty}-${String(playerIndex).padStart(2, "0")}`,
          game: "sudoku",
          type: "win",
          difficulty,
          hintBucket,
          metric: hintBucket === "noHints" ? 100 + playerIndex + categoryIndex : 1,
          metricKind: "seconds",
          playerId: player.id,
          playerName: player.name,
          playerIcon: icon,
          occurredAt: at(),
        });
      }
    });
  });

  insertEvent(database, {
    id: "sql-anonymous-beginner",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 1,
    metricKind: "seconds",
    occurredAt: at(),
  });
  insertEvent(database, {
    id: "sql-invalid-snake-metric",
    game: "snake",
    type: "gamePlayed",
    boardSize: "10",
    metric: 500,
    metricKind: "score",
    playerId: players[0].id,
    playerName: players[0].name,
    playerIcon: icon,
    occurredAt: at(),
  });
  insertEvent(database, {
    id: "sql-missing-sudoku-time",
    game: "sudoku",
    type: "win",
    difficulty: "easy",
    hintBucket: "noHints",
    metric: null,
    metricKind: null,
    playerId: "sql-history-missing",
    playerName: "Historical",
    playerIcon: icon,
    occurredAt: at(),
  });

  const stats = await selectAggregatedGameStats(env, {
    protocol: "2",
    playerId: players[10].id,
    pendingEventIds: ["sql-ms-beginner-10", "sql-not-stored-0001"],
  });

  assert.equal(stats.version, 2);
  assert.deepEqual(stats.acknowledgedEventIds, ["sql-ms-beginner-10"]);
  assert.equal(stats.totals.minesweeper.wins.beginner, 13);
  assert.equal(stats.totals.snake.gamesPlayed["10"], 12);
  assert.deepEqual(stats.totals.sudoku.wins.easy, { noHints: 13, withHints: 12 });
  assert.deepEqual(stats.playerRanks.minesweeper.beginner, { rank: 11, totalPlayers: 12 });
  assert.deepEqual(stats.playerRanks.solitaire, { rank: 11, totalPlayers: 12 });
  assert.deepEqual(stats.playerRanks.snake["10"], { rank: 11, totalPlayers: 12 });
  assert.deepEqual(stats.playerRanks.sudoku.easy, { rank: 11, totalPlayers: 12 });
  assert.equal(stats.playerRecords.solitaire.name, "Latest 10");
  assert.deepEqual(
    stats.leaderboards.minesweeper.beginner.map(({ playerId }) => playerId),
    players.slice(0, 3).map(({ id }) => id)
  );
  assert.equal(JSON.stringify(stats).includes("sql-invalid-snake-metric"), false);
  assert.equal(JSON.stringify(stats).includes("sql-missing-sudoku-time"), false);

  const unplayed = await selectAggregatedGameStats(env, {
    protocol: "2",
    playerId: "sql-player-unplayed",
    pendingEventIds: [],
  });
  const unplayedRanks = [
    ...Object.values(unplayed.playerRanks.minesweeper),
    unplayed.playerRanks.solitaire,
    ...Object.values(unplayed.playerRanks.snake),
    ...Object.values(unplayed.playerRanks.sudoku),
  ];
  assert.equal(unplayedRanks.length, 14);
  assert.ok(
    unplayedRanks.every(({ rank, totalPlayers }) => rank === null && totalPlayers === 12)
  );

  const legacy = await selectAggregatedGameStats(env, {
    protocol: "1",
    playerId: "",
    pendingEventIds: [],
  });
  assert.ok(legacy.eventIds.includes("sql-missing-sudoku-time"));
  assert.equal(legacy.eventIds.includes("sql-invalid-snake-metric"), false);
});

test("SQL validation deduplicates normalized ids only after accepting a row", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());
  const occurredAt = new Date(Date.now() - 60_000).toISOString();
  const player = {
    id: "sql-alias-player",
    name: "Alias Player",
  };
  insertEvent(database, {
    id: " event-trimmed-001 ",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 0,
    metricKind: "seconds",
    playerId: player.id,
    playerName: player.name,
    playerIcon: icon,
    occurredAt,
  });
  insertEvent(database, {
    id: "event-trimmed-001",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 12,
    metricKind: "seconds",
    playerId: player.id,
    playerName: player.name,
    playerIcon: icon,
    occurredAt,
  });
  insertEvent(database, {
    id: " alias-valid-001 ",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 20,
    metricKind: "seconds",
    playerId: player.id,
    playerName: "First Valid Alias",
    playerIcon: icon,
    occurredAt,
  });
  insertEvent(database, {
    id: "alias-valid-001",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 1,
    metricKind: "seconds",
    playerId: "sql-second-alias",
    playerName: "Second Valid Alias",
    playerIcon: icon,
    occurredAt,
  });
  insertEvent(database, {
    id: "invalid-icon-001",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 1,
    metricKind: "seconds",
    playerId: "sql-invalid-icon",
    playerName: "Invalid Icon",
    playerIcon: "assets/app-icons/ico/.ico",
    occurredAt,
  });

  const stats = await selectAggregatedGameStats(
    { personal_site_game_stats: database },
    { protocol: "2", playerId: player.id, pendingEventIds: [] }
  );
  assert.equal(stats.totals.minesweeper.wins.beginner, 3);
  assert.equal(stats.playerTotals.minesweeper.wins.beginner, 2);
  assert.deepEqual(stats.playerRanks.minesweeper.beginner, {
    rank: 1,
    totalPlayers: 1,
  });
  assert.equal(stats.playerRecords.minesweeper.beginner.metric, 12);
  assert.equal(stats.leaderboards.minesweeper.beginner[0].name, player.name);
});

test("migration 0004 retains security and identity indexes and query plans use category indexes", (t) => {
  const database = createDatabase();
  t.after(() => database.close());
  const indexes = database.sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name")
    .all()
    .map(({ name }) => name);
  for (const name of [
    "game_events_minesweeper_idx",
    "game_events_solitaire_idx",
    "game_events_snake_idx",
    "game_events_sudoku_idx",
    "game_events_puzzle_identity_idx",
    "game_stat_sessions_expiry_idx",
    "game_stats_rate_limits_expiry_idx",
  ]) {
    assert.ok(indexes.includes(name), `${name} should remain`);
  }
  assert.equal(indexes.includes("game_events_game_type_idx"), false);
  assert.equal(indexes.includes("game_events_player_idx"), false);

  const plans = [SELECT_STATS_TOTALS_SQL, SELECT_STATS_RANKINGS_SQL]
    .flatMap((sql) =>
      database.sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(new Date(Date.now() + 60_000).toISOString(), "sql-player-00")
    )
    .map(({ detail }) => detail)
    .join("\n");
  for (const name of [
    "game_events_minesweeper_idx",
    "game_events_solitaire_idx",
    "game_events_snake_idx",
    "game_events_sudoku_idx",
  ]) {
    assert.match(plans, new RegExp(name));
  }
});

test("protocol 2 caches for five seconds while fresh and acknowledgment reads refresh it", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());
  let batchCalls = 0;
  const originalBatch = database.batch.bind(database);
  database.batch = async (statements) => {
    batchCalls += 1;
    return originalBatch(statements);
  };
  insertEvent(database, {
    id: "cache-event-0001",
    game: "minesweeper",
    type: "win",
    difficulty: "beginner",
    metric: 12,
    metricKind: "seconds",
    playerId: "cache-player-0001",
    playerName: "Cache Player",
    playerIcon: icon,
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const env = {
    personal_site_game_stats: database,
    ALLOWED_ORIGIN: "https://rohin.shanker.me",
    EXTRA_ALLOWED_ORIGINS: "https://preview.example",
  };

  let now = Date.now();
  const entries = new Map();
  const cache = {
    async match(request) {
      const entry = entries.get(request.url);
      if (!entry || entry.expiresAt <= now) return undefined;
      return new Response(entry.body, { headers: entry.headers });
    },
    async put(request, response) {
      const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get("Cache-Control"))?.[1]);
      entries.set(request.url, {
        body: await response.text(),
        headers: Object.fromEntries(response.headers),
        expiresAt: now + maxAge * 1000,
      });
    },
  };
  const cachesDescriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { default: cache },
  });
  t.after(() => {
    if (cachesDescriptor) Object.defineProperty(globalThis, "caches", cachesDescriptor);
    else delete globalThis.caches;
  });

  const fetchStats = (search, origin = "https://rohin.shanker.me") =>
    worker.fetch(
      new Request(`https://stats.example.test/stats?${search}`, {
        headers: { Origin: origin },
      }),
      env
    );

  const first = await fetchStats("protocol=2&playerId=cache-player-0001");
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("Access-Control-Allow-Origin"), "https://rohin.shanker.me");
  assert.equal(first.headers.get("Cache-Control"), "no-store");
  assert.equal(batchCalls, 1);

  const cached = await fetchStats(
    "protocol=2&playerId=cache-player-0001",
    "https://preview.example"
  );
  assert.equal(cached.status, 200);
  assert.equal(cached.headers.get("Access-Control-Allow-Origin"), "https://preview.example");
  assert.equal(batchCalls, 1, "the cached body must not re-query SQLite");

  await fetchStats("protocol=2&playerId=cache-player-0002");
  assert.equal(batchCalls, 2, "normalized player ids must use isolated keys");

  await fetchStats("protocol=2&playerId=cache-player-0001&fresh=1");
  assert.equal(batchCalls, 3, "fresh reads bypass the platform cache");
  await fetchStats("protocol=2&playerId=cache-player-0001");
  assert.equal(batchCalls, 3, "a fresh read replaces the ordinary cache entry");

  const acknowledged = await fetchStats(
    "protocol=2&playerId=cache-player-0001&pendingEventId=cache-event-0001"
  );
  assert.equal(batchCalls, 4, "acknowledgment reads bypass the platform cache");
  assert.deepEqual((await acknowledged.json()).acknowledgedEventIds, ["cache-event-0001"]);
  const afterAcknowledgment = await fetchStats(
    "protocol=2&playerId=cache-player-0001"
  );
  assert.equal(batchCalls, 4, "an acknowledgment read refreshes the ordinary cache entry");
  assert.deepEqual(
    (await afterAcknowledgment.json()).acknowledgedEventIds,
    [],
    "request-specific acknowledgments must not be stored in the shared entry"
  );

  const tooMany = new URLSearchParams({ protocol: "2" });
  for (let index = 0; index < 33; index += 1) {
    tooMany.append("pendingEventId", `pending-${String(index).padStart(4, "0")}`);
  }
  const rejected = await fetchStats(tooMany.toString());
  assert.equal(rejected.status, 400);
  assert.equal(rejected.headers.get("Cache-Control"), "no-store");
  assert.equal(batchCalls, 4, "invalid acknowledgment input never reaches SQL");

  now += 5001;
  await fetchStats("protocol=2&playerId=cache-player-0001");
  assert.equal(batchCalls, 5, "the edge entry expires after five seconds");

  const legacy = await fetchStats("playerId=cache-player-0001");
  assert.deepEqual((await legacy.json()).eventIds, ["cache-event-0001"]);
  assert.equal(batchCalls, 6, "the explicit legacy response is never put in the v2 cache");
});

test("Cache API failures do not break stats reads", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      default: {
        match: async () => {
          throw new Error("cache unavailable");
        },
        put: async () => {
          throw new Error("cache unavailable");
        },
      },
    },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "caches", descriptor);
    else delete globalThis.caches;
  });
  const response = await worker.fetch(
    new Request("https://stats.example.test/stats?protocol=2"),
    { personal_site_game_stats: database }
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).version, 2);
});

test("failed SQL reads return an uncached error response", async (t) => {
  let putCalls = 0;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      default: {
        match: async () => undefined,
        put: async () => {
          putCalls += 1;
        },
      },
    },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, "caches", descriptor);
    else delete globalThis.caches;
  });

  const response = await worker.fetch(
    new Request("https://stats.example.test/stats?protocol=2"),
    {
      personal_site_game_stats: {
        prepare: () => ({ bind: () => ({}) }),
        batch: async () => {
          throw new Error("simulated SQL failure");
        },
      },
    }
  );

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Internal server error",
  });
  assert.equal(putCalls, 0);
});


test("SQL historical strings preserve JavaScript whitespace and UTF-16 name limits", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());
  const spaces = [
    9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197,
    8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279,
  ];
  const occurredAt = new Date(Date.now() - 60_000).toISOString();
  for (const [index, code] of spaces.entries()) {
    const space = String.fromCodePoint(code);
    const wrap = (value) => `${space}${value}${space}`;
    assert.equal(space.trim(), "");
    insertEvent(database, {
      id: wrap(`event-whitespace-${index}`),
      game: "minesweeper", type: "win", difficulty: wrap("beginner"),
      metric: 50 + index, metricKind: wrap("seconds"),
      playerId: wrap(`player-whitespace-${index}`),
      playerName: wrap("😀".repeat(20)), playerIcon: wrap(icon), occurredAt,
    });
  }
  insertEvent(database, {
    id: "event-whitespace-only-name", game: "minesweeper", type: "win",
    difficulty: "beginner", metric: 1, metricKind: "seconds",
    playerId: "player-whitespace-only-name", playerName: "\u00a0\u2028\ufeff",
    playerIcon: icon, occurredAt,
  });
  // U+0085 is not ECMAScript whitespace and must keep this id invalid.
  insertEvent(database, {
    id: "\u0085event-not-js-whitespace", game: "minesweeper", type: "win",
    difficulty: "beginner", metric: 1, metricKind: "seconds", occurredAt,
  });
  const stats = await selectAggregatedGameStats(
    { personal_site_game_stats: database },
    { protocol: "2", playerId: "player-whitespace-0", pendingEventIds: ["event-whitespace-0"] }
  );
  assert.equal(stats.totals.minesweeper.wins.beginner, spaces.length + 1);
  assert.equal(stats.playerTotals.minesweeper.wins.beginner, 1);
  assert.deepEqual(stats.playerRanks.minesweeper.beginner, { rank: 1, totalPlayers: spaces.length });
  assert.equal(stats.playerRecords.minesweeper.beginner.name, "😀".repeat(16));
  assert.equal(stats.playerRecords.minesweeper.beginner.icon, icon);
  assert.deepEqual(stats.acknowledgedEventIds, ["event-whitespace-0"]);
  assert.deepEqual(stats.leaderboards.minesweeper.beginner.map(({ eventId }) => eventId),
    ["event-whitespace-0", "event-whitespace-1", "event-whitespace-2"]);
});


test("all stats statements share one future cutoff and reject SQLite relative dates", async (t) => {
  const database = createDatabase();
  t.after(() => database.close());
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  let clockReads = 0;
  t.mock.method(Date, "now", () => now + clockReads++ * 1000);
  for (const [id, occurredAt] of [
    ["event-cutoff-included", new Date(now + 60_000).toISOString()],
    ["event-cutoff-excluded", new Date(now + 60_001).toISOString()],
    ["event-relative-now", "now"],
    ["event-relative-time", "12:00:00"],
  ]) {
    insertEvent(database, {
      id, occurredAt, game: "minesweeper", type: "win", difficulty: "beginner",
      metric: 10, metricKind: "seconds", playerId: "player-cutoff-check",
      playerName: "Cutoff Check", playerIcon: icon,
    });
  }
  const originalBatch = database.batch.bind(database);
  database.batch = async (statements) => {
    assert.deepEqual(statements.map(({ params }) => params[0]),
      Array(statements.length).fill(new Date(now + 60_000).toISOString()));
    return originalBatch(statements);
  };
  const stats = await selectAggregatedGameStats(
    { personal_site_game_stats: database },
    { protocol: "2", playerId: "player-cutoff-check", pendingEventIds: [
      "event-cutoff-included", "event-cutoff-excluded", "event-relative-now", "event-relative-time",
    ] }
  );
  assert.equal(clockReads, 1);
  assert.equal(stats.totals.minesweeper.wins.beginner, 1);
  assert.equal(stats.playerTotals.minesweeper.wins.beginner, 1);
  assert.deepEqual(stats.acknowledgedEventIds, ["event-cutoff-included"]);
  assert.equal(stats.playerRecords.minesweeper.beginner.eventId, "event-cutoff-included");
});
