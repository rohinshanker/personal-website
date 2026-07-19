import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  applyGameStatsEvent,
  applyGameStatsEvents,
  compareLeaderboardEntries,
  createEmptyGameStatsData,
  mergePendingStatsFile,
  normalizeGameStatsEvent,
  parseGameStatsGlobalScript,
  serializeGameStatsGlobalScript,
} from "../scripts/merge-game-stats.mjs";

const root = new URL("../", import.meta.url);
const profile = (id, name = id) => ({
  id,
  name,
  icon: "assets/app-icons/ico/user_card.ico",
});
const event = (overrides) => ({
  id: "event-0001",
  occurredAt: "2026-07-19T00:00:00.000Z",
  ...overrides,
});

test("applies per-game counters and leaderboard categories", () => {
  const { stats, appliedCount } = applyGameStatsEvents(createEmptyGameStatsData(), [
    event({
      id: "event-0001",
      game: "minesweeper",
      type: "win",
      difficulty: "beginner",
      seconds: 42,
      profile: profile("player-mines", "Mira"),
    }),
    event({
      id: "event-0002",
      game: "solitaire",
      type: "win",
      moves: 81,
      profile: profile("player-sol", "Kai"),
    }),
    event({
      id: "event-0003",
      game: "snake",
      type: "gamePlayed",
      boardSize: "16",
      score: 7,
      profile: profile("player-snake", "Lumi"),
    }),
    event({
      id: "event-0004",
      game: "sudoku",
      type: "win",
      difficulty: "hard",
      hintBucket: "noHints",
    }),
    event({
      id: "event-0005",
      game: "sudoku",
      type: "win",
      difficulty: "hard",
      hintBucket: "withHints",
    }),
  ]);

  assert.equal(appliedCount, 5);
  assert.equal(stats.totals.minesweeper.wins.beginner, 1);
  assert.equal(stats.totals.solitaire.wins, 1);
  assert.equal(stats.totals.snake.totalGamesPlayed, 1);
  assert.equal(stats.totals.snake.gamesPlayed["16"], 1);
  assert.equal(stats.totals.sudoku.wins.hard.noHints, 1);
  assert.equal(stats.totals.sudoku.wins.hard.withHints, 1);
  assert.equal(stats.leaderboards.minesweeper.beginner[0].metric, 42);
  assert.equal(stats.leaderboards.solitaire[0].metricKind, "moves");
  assert.equal(stats.leaderboards.snake["16"][0].metricKind, "score");
});

test("dedupes repeated event ids idempotently", () => {
  const win = event({
    game: "solitaire",
    type: "win",
    moves: 93,
    profile: profile("player-one", "Ori"),
  });
  const { stats, appliedCount } = applyGameStatsEvents(createEmptyGameStatsData(), [
    win,
    win,
  ]);
  const result = applyGameStatsEvent(stats, win);

  assert.equal(appliedCount, 1);
  assert.equal(stats.totals.solitaire.wins, 1);
  assert.deepEqual(stats.eventIds, ["event-0001"]);
  assert.equal(result.applied, false);
  assert.equal(result.stats.totals.solitaire.wins, 1);
});

test("sorts and limits leaderboards with one best entry per player", () => {
  const { stats } = applyGameStatsEvents(createEmptyGameStatsData(), [
    event({
      id: "event-0101",
      game: "minesweeper",
      type: "win",
      difficulty: "beginner",
      metric: 55,
      profile: profile("player-1", "Ari"),
    }),
    event({
      id: "event-0102",
      occurredAt: "2026-07-19T00:02:00.000Z",
      game: "minesweeper",
      type: "win",
      difficulty: "beginner",
      metric: 45,
      profile: profile("player-2", "Ciel"),
    }),
    event({
      id: "event-0103",
      occurredAt: "2026-07-19T00:01:00.000Z",
      game: "minesweeper",
      type: "win",
      difficulty: "beginner",
      metric: 45,
      profile: profile("player-3", "Eli"),
    }),
    event({
      id: "event-0104",
      game: "minesweeper",
      type: "win",
      difficulty: "beginner",
      metric: 30,
      profile: profile("player-4", "Sola"),
    }),
    event({
      id: "event-0105",
      game: "minesweeper",
      type: "win",
      difficulty: "beginner",
      metric: 80,
      profile: profile("player-5", "Tavi"),
    }),
    event({
      id: "event-0106",
      game: "minesweeper",
      type: "win",
      difficulty: "beginner",
      metric: 40,
      profile: profile("player-1", "Ari"),
    }),
  ]);

  assert.deepEqual(
    stats.leaderboards.minesweeper.beginner.map((entry) => [
      entry.playerId,
      entry.metric,
      entry.eventId,
    ]),
    [
      ["player-4", 30, "event-0104"],
      ["player-1", 40, "event-0106"],
      ["player-3", 45, "event-0103"],
    ]
  );

  assert.ok(
    compareLeaderboardEntries(
      "asc",
      { metric: 45, occurredAt: "2026-07-19T00:01:00.000Z", eventId: "event-a" },
      { metric: 45, occurredAt: "2026-07-19T00:02:00.000Z", eventId: "event-b" }
    ) < 0
  );
});

test("keeps snake high scores in descending top-five order", () => {
  const { stats } = applyGameStatsEvents(
    createEmptyGameStatsData(),
    [1, 6, 2, 5, 3, 4].map((score, index) =>
      event({
        id: `event-02${index}`,
        game: "snake",
        type: "gamePlayed",
        boardSize: "20",
        score,
        profile: profile(`snake-player-${score}`, `Snake ${score}`),
      })
    )
  );

  assert.deepEqual(
    stats.leaderboards.snake["20"].map((entry) => entry.metric),
    [6, 5, 4, 3, 2]
  );
  assert.equal(stats.leaderboards.snake["20"].length, 5);
});

test("rejects invalid pending events", () => {
  assert.throws(
    () =>
      normalizeGameStatsEvent(
        event({
          id: "bad",
          game: "minesweeper",
          type: "win",
          difficulty: "beginner",
          metric: 30,
        })
      ),
    /Invalid event id/
  );
  assert.throws(
    () =>
      normalizeGameStatsEvent(
        event({
          id: "event-0301",
          game: "minesweeper",
          type: "win",
          difficulty: "legendary",
          metric: 30,
        })
      ),
    /Invalid Minesweeper event/
  );
  assert.throws(
    () =>
      normalizeGameStatsEvent(
        event({
          id: "event-0302",
          game: "snake",
          type: "gamePlayed",
          boardSize: "10",
          score: -1,
        })
      ),
    /Invalid Snake score/
  );
});

test("parses, serializes, and merges the global stats script", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "game-stats-test-"));
  const globalPath = join(tempDirectory, "game-stats-global.js");
  const pendingPath = join(tempDirectory, "pending.json");
  const pendingEvent = event({
    id: "event-0401",
    game: "solitaire",
    type: "win",
    moves: 77,
    profile: profile("player-merge", "Vela"),
  });

  await writeFile(globalPath, serializeGameStatsGlobalScript(createEmptyGameStatsData()));
  await writeFile(
    pendingPath,
    JSON.stringify({ version: 1, events: [pendingEvent, pendingEvent] })
  );

  const result = await mergePendingStatsFile(pendingPath, globalPath);
  const merged = parseGameStatsGlobalScript(await readFile(globalPath, "utf8"));

  assert.equal(result.appliedCount, 1);
  assert.equal(result.eventCount, 2);
  assert.equal(merged.totals.solitaire.wins, 1);
  assert.equal(merged.leaderboards.solitaire[0].metric, 77);
});

test("HTML and runtime are wired for game stats controls", async () => {
  const [homeSource, indexSource, domSource, mainSource, baseStyleSource] =
    await Promise.all([
      readFile(new URL("home.html", root), "utf8"),
      readFile(new URL("index.html", root), "utf8"),
      readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
      readFile(new URL("scripts/home/main.js", root), "utf8"),
      readFile(new URL("style.css", root), "utf8"),
    ]);

  for (const game of ["minesweeper", "solitaire", "snake", "sudoku"]) {
    assert.match(homeSource, new RegExp(`data-game-stats-open="${game}"`));
  }

  assert.match(homeSource, /id="game-stats-window"/);
  assert.match(homeSource, /id="game-profile-prompt"/);
  assert.match(indexSource, /game-stats-global\.js\?v=game-stats-20260719/);
  assert.match(indexSource, /app-icon-manifest\.js\?v=game-stats-20260719/);
  assert.ok(
    homeSource.indexOf("scripts/home/game-stats-global.js") <
      homeSource.indexOf("scripts/home/main.js")
  );
  assert.ok(
    homeSource.indexOf("scripts/home/app-icon-manifest.js") <
      homeSource.indexOf("scripts/home/main.js")
  );
  assert.match(domSource, /gameStatsOpenButtons: all\("\[data-game-stats-open\]"\)/);
  assert.match(mainSource, /gameStatsOpenButtons\.forEach/);
  assert.match(mainSource, /removePublishedGameStatsPendingEvents\(\);/);
  assert.match(mainSource, /game: "minesweeper",[\s\S]*?difficulty: msDifficulty\?\.value/);
  assert.match(mainSource, /game: "solitaire",[\s\S]*?metric: solState\.moves/);
  assert.match(mainSource, /game: "snake",[\s\S]*?boardSize: String\(snakeState\.gridSize\)/);
  assert.match(mainSource, /game: "sudoku",[\s\S]*?hintBucket:/);
  assert.match(baseStyleSource, /assets\/icon\/trophy\.svg/);
});

test("Minesweeper stats control uses rounded trophy and no minimize button", async () => {
  const [homeSource, trophySource] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("assets/icon/trophy.svg", root), "utf8"),
  ]);
  const windowStart = homeSource.indexOf('data-app-window="minesweeper"');
  const windowEnd = homeSource.indexOf('<div class="window-body">', windowStart);
  assert.notEqual(windowStart, -1, "Missing Minesweeper window");
  assert.notEqual(windowEnd, -1, "Missing Minesweeper title bar end");

  const titleBarMarkup = homeSource.slice(windowStart, windowEnd);
  assert.match(titleBarMarkup, /data-game-stats-open="minesweeper"/);
  assert.doesNotMatch(titleBarMarkup, /aria-label="Minimize"/);
  assert.match(trophySource, /fill="currentColor"/);
  assert.match(trophySource, /M16 17H13V19H15V21H9V19H11V17H8V15H16V17Z/);
});
