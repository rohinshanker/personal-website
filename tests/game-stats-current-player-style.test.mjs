import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("shared leaderboard player styling uses green text without an outline", async () => {
  const [main, styles] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);
  const playerName = main.match(
    /const createGameStatsPlayerName = \(value, \{ currentPlayer = false \} = \{\}\) => \{([\s\S]*?)\n\};\n\nconst updateGameStatsPlayerNameMarquees/
  );
  const leaderboardPlayer = main.match(
    /const createGameStatsLeaderboardPlayer = \(([\s\S]*?)\n\};\n\nconst createMinesweeperLeaderboardPlayer/
  );
  const currentPlayerRule = styles.match(
    /\.game-stats-player-name\.is-current-player \{([\s\S]*?)\n\}/
  );

  assert.ok(playerName, "Player names should have one shared current-player marker");
  assert.ok(leaderboardPlayer, "Shared leaderboard entries should render the shared player name");
  assert.ok(currentPlayerRule, "The current-player name should have a dedicated style rule");
  assert.match(playerName[1], /name\.classList\.add\("is-current-player"\)/);
  assert.match(
    leaderboardPlayer[1],
    /createGameStatsPlayerName\(nameValue, \{ currentPlayer \}\)/
  );
  assert.match(currentPlayerRule[1], /color: #008000;/);
  assert.doesNotMatch(currentPlayerRule[1], /outline\s*:/);
});
