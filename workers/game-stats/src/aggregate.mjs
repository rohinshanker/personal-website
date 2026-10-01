import {
  GAME_STATS_DIFFICULTIES,
  MAX_EVENT_FUTURE_MS,
  GAME_STATS_SNAKE_BOARD_SIZES,
  GAME_STATS_SUDOKU_DIFFICULTIES,
  STATS_API_PROTOCOL,
  getGameStatsDatabase,
} from "./constants.mjs";
import { createEmptyGameStatsData } from "./data.mjs";

// Match JavaScript String.trim() for trusted historical fields, including
// line terminators and Unicode spaces that SQLite's default trim omits.
const TRIM_CHARACTER_CODES = [
  9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197,
  8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279,
];
const trimmedColumns = Object.fromEntries(
  ["id", "difficulty", "board_size", "hint_bucket", "metric_kind", "player_id",
    "player_name", "player_icon", "occurred_at"].map((column) => [
    column,
    `trim(coalesce(${column}, ''), char(${TRIM_CHARACTER_CODES.join(", ")}))`,
  ])
);

/*
 * Normalize and quarantine legacy rows in SQL. New writes have already passed
 * stricter JavaScript validation. Retain category/profile/metric tolerance
 * for stored calendar timestamps while skipping malformed historical rows.
 * Event ids are primary keys, so no JavaScript-side deduplication pass is
 * needed after the query has accepted the row.
 */
const VALID_EVENT_PROJECTION = `
  SELECT
    rowid AS source_rowid,
    ${trimmedColumns.id} AS id,
    game,
    type,
    ${trimmedColumns.difficulty} AS difficulty,
    ${trimmedColumns.board_size} AS board_size,
    ${trimmedColumns.hint_bucket} AS hint_bucket,
    metric,
    ${trimmedColumns.metric_kind} AS metric_kind,
    ${trimmedColumns.player_id} AS player_id,
    substr(${trimmedColumns.player_name}, 1, 32) AS player_name,
    ${trimmedColumns.player_icon} AS player_icon,
    strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at) AS occurred_at,
    CASE WHEN
      length(${trimmedColumns.player_id}) BETWEEN 8 AND 80
      AND ${trimmedColumns.player_id} NOT GLOB '*[^a-z0-9-]*'
      AND length(substr(${trimmedColumns.player_name}, 1, 32)) > 0
      AND (
        ${trimmedColumns.player_icon} = 'assets/neko-assets/sprites/yawn1.png'
        OR (
          ${trimmedColumns.player_icon} GLOB 'assets/app-icons/ico/*.ico'
          AND length(
            substr(${trimmedColumns.player_icon}, length('assets/app-icons/ico/') + 1)
          ) > length('.ico')
          AND instr(
            substr(${trimmedColumns.player_icon}, length('assets/app-icons/ico/') + 1),
            '/'
          ) = 0
        )
      )
    THEN 1 ELSE 0 END AS valid_profile
`;

const COMMON_EVENT_PREDICATES = `
  length(${trimmedColumns.id}) BETWEEN 8 AND 80
  AND ${trimmedColumns.id} NOT GLOB '*[^a-z0-9-]*'
  AND occurred_at = ${trimmedColumns.occurred_at}
  AND occurred_at GLOB '*-*-*'
  AND julianday(occurred_at) IS NOT NULL
  AND julianday(occurred_at) <= julianday(?1)
`;

const validEventBranch = ({ game, type, predicates }) => `${VALID_EVENT_PROJECTION}
  FROM game_events
  WHERE game = '${game}'
    AND type = '${type}'
    AND ${COMMON_EVENT_PREDICATES}
    AND ${predicates}
`;

const VALID_EVENTS_CTE = `
WITH valid_event_candidates AS (
  ${[
    validEventBranch({
      game: "minesweeper",
      type: "win",
      predicates: `
        ${trimmedColumns.difficulty} IN ('beginner', 'intermediate', 'expert')
        AND typeof(metric) = 'integer'
        AND metric BETWEEN 1 AND 999
        AND ${trimmedColumns.metric_kind} IN ('', 'seconds')
      `,
    }),
    validEventBranch({
      game: "solitaire",
      type: "win",
      predicates: `
        typeof(metric) = 'integer'
        AND metric BETWEEN 1 AND 99999
        AND ${trimmedColumns.metric_kind} IN ('', 'moves')
      `,
    }),
    validEventBranch({
      game: "snake",
      type: "gamePlayed",
      predicates: `
        ${trimmedColumns.board_size} IN ('10', '16', '20', '24')
        AND typeof(metric) = 'integer'
        AND metric BETWEEN 0 AND (
          CAST(${trimmedColumns.board_size} AS INTEGER) * CAST(${trimmedColumns.board_size} AS INTEGER) - 3
        )
        AND ${trimmedColumns.metric_kind} IN ('', 'score')
      `,
    }),
    validEventBranch({
      game: "sudoku",
      type: "win",
      predicates: `
        ${trimmedColumns.difficulty} IN (
          'easy', 'medium', 'hard', 'expert', 'master', 'extreme'
        )
        AND ${trimmedColumns.hint_bucket} IN ('noHints', 'withHints')
        AND (
          metric IS NULL
          OR (typeof(metric) = 'integer' AND metric BETWEEN 1 AND 21600)
        )
        AND ${trimmedColumns.metric_kind} IN ('', 'seconds')
      `,
    }),
  ].join(" UNION ALL ")}
),
valid_events AS (
  SELECT
    id, game, type, difficulty, board_size, hint_bucket, metric, metric_kind,
    player_id, player_name, player_icon, occurred_at, valid_profile
  FROM (
    SELECT
      *,
      row_number() OVER (PARTITION BY id ORDER BY source_rowid) AS id_position
    FROM valid_event_candidates
  )
  WHERE id_position = 1
)
`;

export const SELECT_STATS_TOTALS_SQL = `${VALID_EVENTS_CTE}
SELECT
  game,
  CASE
    WHEN game IN ('minesweeper', 'sudoku') THEN difficulty
    WHEN game = 'snake' THEN board_size
    ELSE ''
  END AS category,
  CASE WHEN game = 'sudoku' THEN hint_bucket ELSE '' END AS subcategory,
  count(*) AS total_count,
  sum(CASE WHEN valid_profile = 1 AND player_id = ?2 THEN 1 ELSE 0 END) AS player_count
FROM valid_events
GROUP BY game, category, subcategory
ORDER BY game, category, subcategory
`;

export const SELECT_STATS_RANKINGS_SQL = `${VALID_EVENTS_CTE},
rankable_events AS (
  SELECT *
  FROM valid_events
  WHERE valid_profile = 1
    AND metric IS NOT NULL
    AND NOT (game = 'sudoku' AND hint_bucket <> 'noHints')
),
best_event_candidates AS (
  SELECT
    game,
    CASE
      WHEN game IN ('minesweeper', 'sudoku') THEN difficulty
      WHEN game = 'snake' THEN board_size
      ELSE ''
    END AS category,
    player_id,
    player_name,
    player_icon,
    id AS event_id,
    metric,
    CASE
      WHEN game IN ('minesweeper', 'sudoku') THEN 'seconds'
      ELSE 'score'
    END AS metric_kind,
    occurred_at,
    row_number() OVER (
      PARTITION BY game,
        CASE
          WHEN game IN ('minesweeper', 'sudoku') THEN difficulty
          WHEN game = 'snake' THEN board_size
          ELSE ''
        END,
        player_id
      ORDER BY
        CASE WHEN game = 'snake' THEN -metric ELSE metric END,
        julianday(occurred_at),
        id
    ) AS player_record_position
  FROM rankable_events
  WHERE game <> 'solitaire'
),
best_events AS (
  SELECT
    game,
    category,
    player_id,
    player_name,
    player_icon,
    event_id,
    metric,
    metric_kind,
    occurred_at
  FROM best_event_candidates
  WHERE player_record_position = 1
),
solitaire_identity_candidates AS (
  SELECT
    player_id,
    player_name,
    player_icon,
    id AS event_id,
    occurred_at,
    row_number() OVER (
      PARTITION BY player_id
      ORDER BY julianday(occurred_at) DESC, id DESC
    ) AS identity_position,
    count(*) OVER (PARTITION BY player_id) AS wins
  FROM rankable_events
  WHERE game = 'solitaire'
),
solitaire_records AS (
  SELECT
    'solitaire' AS game,
    '' AS category,
    player_id,
    player_name,
    player_icon,
    event_id,
    wins AS metric,
    'wins' AS metric_kind,
    occurred_at
  FROM solitaire_identity_candidates
  WHERE identity_position = 1
),
records AS (
  SELECT * FROM best_events
  UNION ALL
  SELECT * FROM solitaire_records
),
ranked_records AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY game, category
      ORDER BY
        CASE WHEN game IN ('solitaire', 'snake') THEN -metric ELSE metric END,
        julianday(occurred_at),
        event_id
    ) AS rank,
    count(*) OVER (PARTITION BY game, category) AS total_players
  FROM records
)
SELECT
  game,
  category,
  player_id,
  player_name,
  player_icon,
  event_id,
  metric,
  metric_kind,
  occurred_at,
  rank,
  total_players
FROM ranked_records
WHERE rank <= 3 OR player_id = ?2
ORDER BY game, category, rank
`;

export const SELECT_LEGACY_EVENT_IDS_SQL = `${VALID_EVENTS_CTE}
SELECT id FROM valid_events ORDER BY id
`;

const selectAcknowledgedIdsSql = (count) => `${VALID_EVENTS_CTE}
SELECT id
FROM valid_events
WHERE id IN (${Array.from({ length: count }, (_, index) => `?${index + 2}`).join(", ")})
ORDER BY id
`;

const resultRows = (result) => result?.results || [];

const leaderboardEntry = (row) => ({
  eventId: String(row.event_id),
  playerId: String(row.player_id),
  name: String(row.player_name).slice(0, 32),
  icon: String(row.player_icon),
  metric: Number(row.metric),
  metricKind: String(row.metric_kind),
  occurredAt: String(row.occurred_at),
});

const applyTotalRow = (stats, row) => {
  const count = Number(row.total_count) || 0;
  const playerCount = Number(row.player_count) || 0;
  if (row.game === "minesweeper" && GAME_STATS_DIFFICULTIES.includes(row.category)) {
    stats.totals.minesweeper.wins[row.category] = count;
    stats.playerTotals.minesweeper.wins[row.category] = playerCount;
  } else if (row.game === "solitaire") {
    stats.totals.solitaire.wins = count;
    stats.playerTotals.solitaire.wins = playerCount;
  } else if (row.game === "snake" && GAME_STATS_SNAKE_BOARD_SIZES.includes(row.category)) {
    stats.totals.snake.gamesPlayed[row.category] = count;
    stats.totals.snake.totalGamesPlayed += count;
    stats.playerTotals.snake.gamesPlayed[row.category] = playerCount;
    stats.playerTotals.snake.totalGamesPlayed += playerCount;
  } else if (
    row.game === "sudoku" &&
    GAME_STATS_SUDOKU_DIFFICULTIES.includes(row.category) &&
    new Set(["noHints", "withHints"]).has(row.subcategory)
  ) {
    stats.totals.sudoku.wins[row.category][row.subcategory] = count;
    stats.playerTotals.sudoku.wins[row.category][row.subcategory] = playerCount;
  }
};

const categoryTargets = (stats, row) => {
  if (row.game === "minesweeper" && GAME_STATS_DIFFICULTIES.includes(row.category)) {
    return {
      leaderboard: stats.leaderboards.minesweeper[row.category],
      setRank: (value) => {
        stats.playerRanks.minesweeper[row.category] = value;
      },
      getRank: () => stats.playerRanks.minesweeper[row.category],
      setRecord: (value) => {
        stats.playerRecords.minesweeper[row.category] = value;
      },
    };
  }
  if (row.game === "solitaire") {
    return {
      leaderboard: stats.leaderboards.solitaire,
      setRank: (value) => {
        stats.playerRanks.solitaire = value;
      },
      getRank: () => stats.playerRanks.solitaire,
      setRecord: (value) => {
        stats.playerRecords.solitaire = value;
      },
    };
  }
  if (row.game === "snake" && GAME_STATS_SNAKE_BOARD_SIZES.includes(row.category)) {
    return {
      leaderboard: stats.leaderboards.snake[row.category],
      setRank: (value) => {
        stats.playerRanks.snake[row.category] = value;
      },
      getRank: () => stats.playerRanks.snake[row.category],
      setRecord: (value) => {
        stats.playerRecords.snake[row.category] = value;
      },
    };
  }
  if (row.game === "sudoku" && GAME_STATS_SUDOKU_DIFFICULTIES.includes(row.category)) {
    return {
      leaderboard: stats.leaderboards.sudoku[row.category],
      setRank: (value) => {
        stats.playerRanks.sudoku[row.category] = value;
      },
      getRank: () => stats.playerRanks.sudoku[row.category],
      setRecord: (value) => {
        stats.playerRecords.sudoku[row.category] = value;
      },
    };
  }
  return null;
};

export const createGameStatsDataFromSqlRows = ({
  totalsRows,
  rankingRows,
  requestedPlayerId = "",
  protocol = STATS_API_PROTOCOL,
  acknowledgmentRows = [],
  legacyIdRows = [],
}) => {
  const legacy = protocol !== STATS_API_PROTOCOL;
  const stats = createEmptyGameStatsData({ legacy });
  stats.generatedAt = new Date().toISOString();
  totalsRows.forEach((row) => applyTotalRow(stats, row));
  rankingRows.forEach((row) => {
    const targets = categoryTargets(stats, row);
    if (!targets) return;
    const entry = leaderboardEntry(row);
    const rank = Number(row.rank);
    const totalPlayers = Number(row.total_players);
    targets.setRank({ ...targets.getRank(), totalPlayers });
    if (rank <= 3) targets.leaderboard.push(entry);
    if (row.player_id === requestedPlayerId) {
      targets.setRank({ rank, totalPlayers });
      targets.setRecord(entry);
    }
  });
  if (legacy) {
    stats.eventIds = legacyIdRows.map(({ id }) => String(id));
  } else {
    stats.acknowledgedEventIds = acknowledgmentRows.map(({ id }) => String(id));
  }
  return stats;
};

export const selectAggregatedGameStats = async (
  env,
  { protocol, playerId, pendingEventIds }
) => {
  const database = getGameStatsDatabase(env);
  const cutoff = new Date(Date.now() + MAX_EVENT_FUTURE_MS).toISOString();
  const statements = [
    database.prepare(SELECT_STATS_TOTALS_SQL).bind(cutoff, playerId),
    database.prepare(SELECT_STATS_RANKINGS_SQL).bind(cutoff, playerId),
  ];
  let acknowledgmentIndex = -1;
  let legacyIdsIndex = -1;
  if (protocol === STATS_API_PROTOCOL && pendingEventIds.length) {
    acknowledgmentIndex = statements.length;
    statements.push(
      database
        .prepare(selectAcknowledgedIdsSql(pendingEventIds.length))
        .bind(cutoff, ...pendingEventIds)
    );
  } else if (protocol !== STATS_API_PROTOCOL) {
    legacyIdsIndex = statements.length;
    statements.push(database.prepare(SELECT_LEGACY_EVENT_IDS_SQL).bind(cutoff));
  }
  const results = await database.batch(statements);
  return createGameStatsDataFromSqlRows({
    totalsRows: resultRows(results[0]),
    rankingRows: resultRows(results[1]),
    requestedPlayerId: playerId,
    protocol,
    acknowledgmentRows: acknowledgmentIndex >= 0 ? resultRows(results[acknowledgmentIndex]) : [],
    legacyIdRows: legacyIdsIndex >= 0 ? resultRows(results[legacyIdsIndex]) : [],
  });
};
