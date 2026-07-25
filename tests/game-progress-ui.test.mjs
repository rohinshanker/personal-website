import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Game Progress is available from the desktop and taskbar with the joystick icon", async () => {
  const home = await readFile(new URL("home.html", root), "utf8");

  assert.match(
    home,
    /<button class="desktop-icon" data-app="game-progress" aria-label="Game Progress">[\s\S]*?joystick_alt\.ico[\s\S]*?Game Progress/
  );
  assert.match(
    home,
    /<button class="taskbar-icon" data-app="game-progress" aria-label="Game Progress">[\s\S]*?joystick_alt\.ico/
  );
});

test("Game Progress provides a profile and one local-progress panel per game", async () => {
  const home = await readFile(new URL("home.html", root), "utf8");

  assert.match(home, /data-app-window="game-progress"/);
  for (const tab of ["profile", "minesweeper", "solitaire", "snake", "sudoku"]) {
    assert.match(home, new RegExp(`data-view="game-progress-${tab}"`));
    assert.match(home, new RegExp(`id="game-progress-${tab}-content"`));
  }
  assert.match(home, /id="game-progress-create-profile"/);
  assert.match(home, /id="game-progress-reset-local"/);
  assert.match(home, /Published results remain on global stats and leaderboards\./);
  assert.match(
    home,
    /data-view="game-progress-snake">[\s\S]*?assets\/snake-assets\/snake-logo\.png/
  );
});

test("Game Progress uses compact, top-aligned profile and game layouts", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);

  assert.match(source, /game-progress-profile-row/);
  assert.match(source, /game-progress-profile-name/);
  assert.match(source, /game-progress-profile-saved", "Saved"/);
  assert.doesNotMatch(source, /Saved and locked/);
  assert.match(styles, /\.game-progress-window\.game-progress-window \.window-body \{[\s\S]*?height: auto;/);
  assert.match(styles, /\.game-progress-content \{[\s\S]*?align-content: start;[\s\S]*?align-items: start;/);
  assert.match(styles, /\.game-progress-profile-content,[\s\S]*?\.game-progress-game-content \{[\s\S]*?min-height: 0;/);
  assert.match(
    styles,
    /\.game-stats-row\.game-progress-profile-row \{[\s\S]*?"icon name saved"[\s\S]*?grid-template-columns: 24px minmax\(0, 1fr\) auto;/
  );
  assert.match(styles, /\.game-progress-profile-name \{[\s\S]*?font-size: 14px;[\s\S]*?overflow-wrap: break-word;/);
  assert.match(styles, /\.game-progress-profile-saved \{[\s\S]*?align-self: center;[\s\S]*?color: #008000;[\s\S]*?font-weight: bold;[\s\S]*?justify-self: end;/);
  assert.match(styles, /\.game-progress-actions \{[\s\S]*?align-items: center;/);
});

test("Game Progress profile launches every global leaderboard from a white icon panel", async () => {
  const [home, styles, source] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
  ]);
  const profileStart = home.indexOf(
    '<section class="viewer-content game-progress-content" data-view="game-progress-profile">'
  );
  const profileEnd = home.indexOf(
    '<section class="viewer-content game-progress-content is-hidden" data-view="game-progress-minesweeper">',
    profileStart
  );
  const profile = home.slice(profileStart, profileEnd);
  const launchers = [
    ["minesweeper", "Minesweeper", "assets/app-icons/ico/minesweeper.ico"],
    ["solitaire", "Solitaire", "assets/app-icons/ico/game_freecell.ico"],
    ["snake", "Snake", "assets/snake-assets/snake-logo.png"],
    ["sudoku", "Sudoku", "assets/app-icons/ico/calendar2.ico"],
  ];

  assert.match(profile, /id="game-progress-global-leaderboards-title">Global Leaderboards<\/h4>/);
  assert.match(profile, /class="game-progress-global-leaderboard-list"/);
  assert.equal(profile.match(/data-game-stats-open=/g)?.length, launchers.length);
  for (const [game, label, icon] of launchers) {
    assert.match(
      profile,
      new RegExp(
        `<button[\\s\\S]*?type="button"[\\s\\S]*?data-game-stats-open="${game}"[\\s\\S]*?aria-label="Open ${label} global leaderboard"`
      )
    );
    assert.match(profile, new RegExp(`aria-label="Open ${label} global leaderboard"`));
    assert.match(profile, new RegExp(`aria-controls="game-stats-window-${game}"`));
    assert.match(
      profile,
      new RegExp(`src="${icon.replaceAll("/", "\\/")}"[\\s\\S]*?alt=""[\\s\\S]*?aria-hidden="true"`)
    );
  }
  assert.match(
    styles,
    /\.game-progress-global-leaderboard-list \{[\s\S]*?background: #fff;[\s\S]*?grid-template-columns: repeat\(4, minmax\(36px, 1fr\)\);/
  );
  assert.match(
    source,
    /gameStatsOpenButtons\.forEach\(\(button\) => \{[\s\S]*?openGameStatsWindow\(button\.getAttribute\("data-game-stats-open"\)\);/
  );
});

test("Snake Game Progress separates its total and keeps board pairs on one row", async () => {
  const styles = await readFile(new URL("styles/home/apps/game-stats.css", root), "utf8");

  assert.match(styles, /\.game-progress-snake-content \{[\s\S]*?display: grid;[\s\S]*?gap: 6px;/);
  assert.match(styles, /\.game-progress-snake-total \.game-stats-inlay \{[\s\S]*?background: #fff;/);
  assert.match(
    styles,
    /\.game-progress-snake-board-stats \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
});

test("Sudoku Game Progress uses three compact columns at every supported viewport", async () => {
  const styles = await readFile(new URL("styles/home/apps/game-stats.css", root), "utf8");

  assert.match(
    styles,
    /\.game-progress-sudoku-stats \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/
  );
});
