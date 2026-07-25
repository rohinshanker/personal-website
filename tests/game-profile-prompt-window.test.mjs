import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Leaderboard profile prompt opens as a draggable window with a shared skip close path", async () => {
  const [home, index, main, dom, styles] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);

  assert.match(
    home,
    /id="game-profile-prompt"[\s\S]*?<div[\s\S]*?class="window game-profile-dialog"[\s\S]*?id="game-profile-dialog"/
  );
  assert.match(
    home,
    /id="game-profile-title">Leaderboard Profile<[\s\S]*?<div class="title-bar-controls">[\s\S]*?id="game-profile-close"[\s\S]*?type="button"[\s\S]*?aria-label="Close leaderboard profile"/
  );
  assert.match(home, /id="game-profile-cancel">Skip Leaderboard</);
  assert.doesNotMatch(home, /id="game-profile-dialog"[^>]*data-no-drag/);
  assert.match(home, /game-stats\.css\?v=leaderboard-refresh-20260725/);
  assert.match(home, /main\.js\?v=game-build-[a-f0-9]{64}/);
  assert.match(index, /game-stats\.css\?v=leaderboard-refresh-20260725/);
  assert.match(index, /main\.js\?v=game-build-[a-f0-9]{64}/);

  assert.match(dom, /gameProfileDialog: byId\("game-profile-dialog"\),/);
  assert.match(dom, /gameProfileClose: byId\("game-profile-close"\),/);
  assert.match(
    styles,
    /\.game-profile-dialog \{[\s\S]*?left: 50%;[\s\S]*?position: absolute;[\s\S]*?top: 50%;[\s\S]*?translate: -50% -50%;/
  );
  assert.match(
    styles,
    /\.game-profile-dialog\.is-opening \{[\s\S]*?animation: retro-window-open 260ms steps\(7, end\) both;/
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.game-profile-dialog\.is-opening \{[\s\S]*?animation-duration: 1ms;/
  );

  assert.match(
    main,
    /const setGameProfilePromptVisible = \(visible\) => \{[\s\S]*?classList\.toggle\("is-hidden", !visible\)[\s\S]*?if \(visible\) \{[\s\S]*?gameProfileDialog\?\.classList\.add\("app-window--center"\);[\s\S]*?gameProfileDialog\?\.style\.removeProperty\("left"\);[\s\S]*?gameProfileDialog\?\.style\.removeProperty\("top"\);[\s\S]*?gameProfileDialog\?\.style\.removeProperty\("translate"\);[\s\S]*?restartWindowAnimation\(gameProfileDialog, "is-opening"\);/
  );
  assert.match(
    main,
    /const skipGameStatsProfilePrompt = \(\) => \{\s*resolveGameStatsProfilePrompt\(null\);\s*\};/
  );
  assert.match(
    main,
    /if \(gameProfileCancel\) \{[\s\S]*?skipGameStatsProfilePrompt\(\);/
  );
  assert.match(
    main,
    /if \(gameProfileClose\) \{[\s\S]*?skipGameStatsProfilePrompt\(\);/
  );
  assert.match(
    main,
    /event\.key !== "Escape"[\s\S]*?skipGameStatsProfilePrompt\(\);/
  );
  assert.match(
    main,
    /gameProfileDialog\.addEventListener\("animationend", \(event\) => \{[\s\S]*?event\.animationName === "retro-window-open"[\s\S]*?classList\.remove\("is-opening"\)/
  );
});

test("Centered leaderboard profile drag retains its rendered position before clearing its translate", async () => {
  const [main, styles] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);

  assert.match(
    styles,
    /\.game-profile-dialog \{[\s\S]*?left: 50%;[\s\S]*?top: 50%;[\s\S]*?translate: -50% -50%;/
  );

  const draggableWindowsStart = main.indexOf("draggableWindows.forEach((win) => {");
  const dragListenerStart = main.indexOf(
    'titleBar.addEventListener("pointerdown", (event) => {',
    draggableWindowsStart
  );
  const dragListenerEnd = main.indexOf(
    'titleBar.addEventListener("pointermove", moveHandler);',
    dragListenerStart
  );
  assert.notEqual(draggableWindowsStart, -1, "Missing shared draggable-window initializer");
  assert.notEqual(dragListenerStart, -1, "Missing shared title-bar pointer handler");
  assert.notEqual(dragListenerEnd, -1, "Missing title-bar drag handler boundary");

  const dragHandler = main.slice(dragListenerStart, dragListenerEnd);
  assert.match(
    dragHandler,
    /const rect = win\.getBoundingClientRect\(\);[\s\S]*?if \(win\.id === "about-window" \|\| win\.id === "game-profile-dialog"\) \{[\s\S]*?win\.style\.left = `\$\{rect\.left\}px`;[\s\S]*?win\.style\.top = `\$\{rect\.top\}px`;[\s\S]*?\}[\s\S]*?win\.classList\.remove\("app-window--center"\);[\s\S]*?win\.style\.translate = "0 0";/,
    "The profile dialog's rendered geometry must be pinned before its centering translate is removed."
  );
  assert.match(
    dragHandler,
    /const offsetX = event\.clientX - rect\.left;[\s\S]*?const offsetY = event\.clientY - rect\.top;[\s\S]*?titleBar\.setPointerCapture\(event\.pointerId\);/,
    "Pointer offsets must use the stable rendered geometry retained for the drag."
  );
  assert.match(
    dragHandler,
    /titleBar\.setPointerCapture\(event\.pointerId\);[\s\S]*?const nextLeft = moveEvent\.clientX - offsetX;[\s\S]*?const nextTop = moveEvent\.clientY - offsetY;[\s\S]*?setWindowTitleBarClampedPosition\(win, nextLeft, nextTop\);/,
    "The shared pointer-capture, pointer-offset, and clamping behavior must remain intact."
  );
});
