import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const supportedGames = ["minesweeper", "solitaire", "snake", "sudoku"];

test("every Game Stats window has an independently accessible refresh row", async () => {
  const homeSource = await readFile(new URL("home.html", root), "utf8");

  assert.equal((homeSource.match(/class="game-stats-sync-row"/g) ?? []).length, 4);
  assert.equal((homeSource.match(/data-game-stats-sync-status/g) ?? []).length, 4);
  assert.equal((homeSource.match(/data-game-stats-refresh="/g) ?? []).length, 4);
  assert.equal(
    (
      homeSource.match(
        /class="game-stats-sync-status"[\s\S]*?data-game-stats-sync-status[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"/g
      ) ?? []
    ).length,
    4
  );

  for (const game of supportedGames) {
    const label = `${game[0].toUpperCase()}${game.slice(1)}`;
    const windowPattern = new RegExp(
      `data-game-stats-window="${game}"[\\s\\S]*?` +
        `class="game-stats-sync-row"[\\s\\S]*?` +
        `data-game-stats-sync-status[\\s\\S]*?` +
        `data-game-stats-refresh="${game}"[\\s\\S]*?` +
        `aria-label="Refresh ${label} stats"[\\s\\S]*?` +
        `aria-busy="false"[\\s\\S]*?` +
        `assets/solitaire-cards/undo-button\\.png`
    );

    assert.match(homeSource, windowPattern);
  }

  assert.doesNotMatch(
    homeSource,
    /class="game-stats-sync-row"[^>]*(?:aria-live|role="status")/
  );
  assert.equal(
    (
      homeSource.match(
        /<img[\s\S]*?assets\/solitaire-cards\/undo-button\.png[\s\S]*?alt=""[\s\S]*?width="14"[\s\S]*?height="14"/g
      ) ?? []
    ).length,
    4
  );
});

test("Game Stats exposes refresh controls and statuses to application code", async () => {
  const domSource = await readFile(new URL("scripts/home/core/dom.js", root), "utf8");

  assert.match(
    domSource,
    /gameStatsSyncStatuses: all\("\[data-game-stats-sync-status\]"\)/
  );
  assert.match(
    domSource,
    /gameStatsRefreshButtons: all\("\[data-game-stats-refresh\]"\)/
  );
});

test("Game Stats refresh rows stay bounded and expose disabled and loading states", async () => {
  const cssSource = await readFile(
    new URL("styles/home/apps/game-stats.css", root),
    "utf8"
  );

  assert.match(
    cssSource,
    /\.game-stats-sync-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+24px;[\s\S]*?min-width:\s*0;/
  );
  assert.match(
    cssSource,
    /\.game-stats-sync-status\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?white-space:\s*normal;/
  );
  assert.match(
    cssSource,
    /\.game-stats-refresh-button\s*\{[\s\S]*?height:\s*24px;[\s\S]*?min-width:\s*24px;[\s\S]*?width:\s*24px;/
  );
  assert.match(
    cssSource,
    /\.game-stats-refresh-button img\s*\{[\s\S]*?height:\s*14px;[\s\S]*?width:\s*14px;/
  );
  assert.match(cssSource, /\.game-stats-refresh-button:disabled/);
  assert.match(cssSource, /\.game-stats-refresh-button\[aria-busy="true"\]/);
  assert.match(cssSource, /@keyframes game-stats-refresh-dot/);
  assert.match(
    cssSource,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.game-stats-refresh-loading > span\s*\{[\s\S]*?animation:\s*none;/
  );
});
