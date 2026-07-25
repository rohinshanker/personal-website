import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const readResetFunction = async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const match = source.match(
    /const resetGameProgressLocalData = \(\) => \{([\s\S]*?)\n\};\n\nconst renderGameStatsWindow/
  );
  assert.ok(match, "resetGameProgressLocalData should remain a focused function");
  return { source, resetSource: match[1] };
};

test("Game Progress keeps a saved profile immutable and gives new profiles ten rerolls", async () => {
  const [source, home] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("home.html", root), "utf8"),
  ]);

  assert.match(source, /const GAME_STATS_MAX_NAME_REROLLS = 10;/);
  assert.match(home, /id="game-profile-reroll-count" aria-live="polite">10 left</);
  assert.match(
    source,
    /const saveGameStatsProfile = \(profile\) => \{\n  if \(gameStatsProfile\) return gameStatsProfile;/
  );
  assert.match(source, /const createGameProgressProfile = async \(\) => \{/);
  assert.match(
    source,
    /let profile = gameStatsProfile;\n  if \(\n    !profile &&\n    \(event\.type === "win" \|\| gameStatsEventQualifiesForLeaderboard\(event\)\)/
  );
  assert.match(source, /event\.profile = normalizeGameStatsEventProfile\(profile\);/);
});

test("Game Progress changes only the icon of a saved profile", async () => {
  const [source, home, dom] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
  ]);

  assert.match(home, /id="game-profile-name-controls"/);
  assert.match(home, /id="game-profile-name-credit"/);
  assert.match(dom, /gameProfileNameControls: byId\("game-profile-name-controls"\),/);
  assert.match(dom, /gameProfileNameCredit: byId\("game-profile-name-credit"\),/);
  assert.match(
    source,
    /const saveGameStatsProfileIcon = \(icon\) => \{[\s\S]*?\{ \.\.\.gameStatsProfile, icon \}/
  );
  assert.match(
    source,
    /const openGameProgressProfileIconPicker = \(\) => \{[\s\S]*?gameStatsDraftProfile = \{ \.\.\.gameStatsProfile \};[\s\S]*?setGameStatsProfileEditorMode\(GAME_STATS_PROFILE_EDITOR_MODES\.icon\);/
  );
  assert.match(source, /gameProfileNameControls\.hidden = iconOnly;/);
  assert.match(source, /gameProfileNameCredit\.hidden = iconOnly;/);
  assert.match(source, /createButton\.textContent = "Change Icon";/);
  assert.match(
    source,
    /if \(gameStatsProfile\) \{[\s\S]*?openGameProgressProfileIconPicker\(\);/
  );
  assert.match(
    source,
    /!isGameStatsProfileIconEditor\(\) &&[\s\S]*?gameStatsDraftProfile\.name === GAME_STATS_API_ERROR_NAME/
  );
});

test("Game Progress reset clears only local aggregate, profile, and Snake record data", async () => {
  const { resetSource } = await readResetFunction();

  assert.match(resetSource, /gameStatsLocalState = createEmptyGameStatsData\(\);/);
  assert.match(resetSource, /saveGameStatsLocalState\(\);/);
  assert.match(resetSource, /clearGameStatsProfile\(\);/);
  assert.match(resetSource, /snakeState\.highScores = \{\};/);
  assert.match(resetSource, /localStorage\.removeItem\(SNAKE_HIGH_SCORE_KEY\);/);
  assert.match(resetSource, /Published and queued leaderboard results remain available/);
  assert.doesNotMatch(resetSource, /gameStatsSubmissionQueue\s*=/);
  assert.doesNotMatch(resetSource, /GAME_STATS_SYNC_QUEUE_STORAGE_KEY/);
  assert.doesNotMatch(resetSource, /gameStatsGlobalState\s*=/);
});

test("Game Progress renders local data for its profile and every supported game", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");

  for (const contentId of [
    "game-progress-profile-content",
    "game-progress-minesweeper-content",
    "game-progress-solitaire-content",
    "game-progress-snake-content",
    "game-progress-sudoku-content",
  ]) {
    assert.match(source, new RegExp(`getGameProgressContent\\("${contentId}"\\)`));
  }

  assert.match(source, /const gameProgressCreateProfile = document\.getElementById\(/);
  assert.match(source, /const gameProgressResetLocal = document\.getElementById\(/);
});

test("Snake Game Progress keeps each board size's games and high score together", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const match = source.match(
    /const renderGameProgressSnake = \(\) => \{([\s\S]*?)\n\};\n\nconst renderGameProgressSudoku/
  );

  assert.ok(match, "renderGameProgressSnake should remain a focused function");
  const snakeProgressSource = match[1];
  assert.match(snakeProgressSource, /"game-progress-snake-total"/);
  assert.match(snakeProgressSource, /game-progress-snake-board-stats/);
  assert.match(snakeProgressSource, /gamesPlayed\[size\]/);
  assert.match(snakeProgressSource, /snakeState\.highScores\[size\]/);
  assert.match(snakeProgressSource, /content\.replaceChildren\(totalGames, boardStats\);/);
});

test("Sudoku Game Progress keeps compact win columns and a local no-hints best time", async () => {
  const source = await readFile(new URL("scripts/home/main.js", root), "utf8");
  const match = source.match(
    /const renderGameProgressSudoku = \(\) => \{([\s\S]*?)\n\};\n\nconst renderGameProgressWindow/
  );

  assert.ok(match, "renderGameProgressSudoku should remain a focused function");
  const sudokuProgressSource = match[1];
  assert.match(sudokuProgressSource, /"game-progress-sudoku-stats"/);
  assert.match(sudokuProgressSource, /\$\{label\} \(no hints\)/);
  assert.match(sudokuProgressSource, /\$\{label\} \(hints\)/);
  assert.match(sudokuProgressSource, /"Best Time \(no hints\)"/);
  assert.match(sudokuProgressSource, /\$\{wins\.noHints\} Wins/);
  assert.match(sudokuProgressSource, /\$\{wins\.withHints\} Wins/);
  assert.match(source, /const createGameStatsEmptySudokuBestTimes/);
  assert.match(source, /totals\.sudoku\?\.bestTimes\?\.\[difficulty\]/);
  assert.match(source, /value === null \|\| value === undefined \|\| value === ""/);
  assert.match(source, /currentBestTime === null \? nextBestTime : Math\.min\(currentBestTime, nextBestTime\)/);
  assert.match(source, /sudokuNoHintsSeconds:\n          hintBucket === "noHints"/);
});
