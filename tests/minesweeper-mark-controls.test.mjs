import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Minesweeper has exclusive flag and question-mark placement controls", async () => {
  const [home, index, main, styles] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/minesweeper.css", root), "utf8"),
  ]);

  assert.match(
    home,
    /id="ms-mines"[\s\S]*?id="ms-flag-mode"[\s\S]*?id="ms-reset"[\s\S]*?id="ms-question-mode"[\s\S]*?id="ms-time"/
  );
  assert.match(
    home,
    /id="ms-flag-mode"[\s\S]*?type="button"[\s\S]*?data-ms-mark-mode="flag"[\s\S]*?aria-pressed="false"/
  );
  assert.match(
    home,
    /id="ms-question-mode"[\s\S]*?type="button"[\s\S]*?data-ms-mark-mode="question"[\s\S]*?aria-pressed="false"/
  );
  assert.match(
    home,
    /id="ms-mobile-controls"[^>]*type="checkbox"[^>]*autocomplete="off"[\s\S]*?<label[^>]*for="ms-mobile-controls"[^>]*>Mobile controls\?<\/label>/
  );
  assert.doesNotMatch(
    home.match(/<input[^>]*id="ms-mobile-controls"[^>]*>/)?.[0] || "",
    /\schecked(?:\s|=|>)/,
    "Mobile controls must start inactive."
  );
  assert.match(home, /id="ms-flag-mode"[\s\S]*?hidden/);
  assert.match(home, /id="ms-question-mode"[\s\S]*?hidden/);
  assert.match(home, /minesweeper\.css\?v=minesweeper-mobile-controls-20260724/);
  assert.match(home, /main\.js\?v=game-build-[a-f0-9]{64}/);
  assert.match(index, /minesweeper\.css\?v=minesweeper-mobile-controls-20260724/);
  assert.match(index, /main\.js\?v=game-build-[a-f0-9]{64}/);

  assert.match(
    styles,
    /\.ms-top-panel \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 32px 38px 32px minmax\(0, 1fr\);/
  );
  for (const columnPlacement of [
    /#ms-mines \{[\s\S]*?grid-column: 1;/,
    /#ms-flag-mode \{[\s\S]*?grid-column: 2;/,
    /\.ms-reset \{[\s\S]*?grid-column: 3;/,
    /#ms-question-mode \{[\s\S]*?grid-column: 4;/,
    /#ms-time \{[\s\S]*?grid-column: 5;/,
  ]) {
    assert.match(
      styles,
      columnPlacement,
      "Each top-panel item must retain its column when optional controls are hidden."
    );
  }
  assert.match(
    styles,
    /\.ms-mark-control \{[\s\S]*?box-shadow: none;[\s\S]*?height: 32px;[\s\S]*?min-height: 32px;[\s\S]*?min-width: 32px;[\s\S]*?width: 32px;/
  );
  assert.match(
    styles,
    /\.ms-mark-control\[data-ms-mark-mode="flag"\]::before \{[\s\S]*?tile_flag\.png/
  );
  assert.match(
    styles,
    /\.ms-mark-control\[data-ms-mark-mode="question"\]::before \{[\s\S]*?tile_question\.png/
  );
  assert.match(
    styles,
    /\.ms-mark-control\.is-active,[\s\S]*?\.ms-mark-control\[aria-pressed="true"\] \{[\s\S]*?border-sunken/
  );
  assert.match(styles, /\.ms-mark-control\[hidden\] \{[\s\S]*?display: none;/);
  assert.match(styles, /\.ms-mobile-controls-label \{[\s\S]*?margin-right: auto;/);

  assert.match(main, /const msFlagMode = document\.getElementById\("ms-flag-mode"\);/);
  assert.match(main, /const msQuestionMode = document\.getElementById\("ms-question-mode"\);/);
  assert.match(main, /const msMobileControls = document\.getElementById\("ms-mobile-controls"\);/);
  assert.match(main, /markMode: null,/);
  assert.match(
    main,
    /const msSetMarkMode = \(mode\) => \{[\s\S]*?mode === "flag" \|\| mode === "question"[\s\S]*?msState\.markMode === nextMode \? null : nextMode[\s\S]*?classList\.toggle\("is-active", isActive\)[\s\S]*?setAttribute\("aria-pressed", String\(isActive\)\)/
  );
  assert.match(
    main,
    /const msHandleLeftClick = \(index\) => \{[\s\S]*?if \(msState\.markMode\) \{[\s\S]*?msToggleMark\(index, msState\.markMode\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?if \(cell\.revealed\)/
  );
  assert.match(
    main,
    /const msToggleMark = \(index, mode\) => \{[\s\S]*?mode === "flag"[\s\S]*?cell\.flagged = !cell\.flagged;[\s\S]*?cell\.question = false;[\s\S]*?mode === "question"[\s\S]*?cell\.question = !cell\.question;[\s\S]*?cell\.flagged = false;[\s\S]*?msRenderCell\(index\);[\s\S]*?msUpdateCounters\(\);/
  );
  assert.match(main, /msGrid\.addEventListener\("contextmenu"[\s\S]*?msToggleFlag\(index\);/);
  assert.match(main, /if \(msState\.markMode\) return;[\s\S]*?msSetFace\("ooh"\);/);
  assert.match(
    main,
    /\[\[msFlagMode, "flag"\], \[msQuestionMode, "question"\]\]\.forEach\([\s\S]*?button\.addEventListener\("click", \(\) => \{[\s\S]*?msSetMarkMode\(mode\);/
  );
  assert.match(
    main,
    /const msSetMobileControlsVisible = \(isVisible\) => \{[\s\S]*?button\.hidden = !visible;[\s\S]*?if \(!visible\) msSetMarkMode\(null\);/
  );
  assert.match(
    main,
    /msMobileControls\.checked = false;[\s\S]*?msMobileControls\.addEventListener\("change", \(\) => \{[\s\S]*?msSetMobileControlsVisible\(msMobileControls\.checked\);/
  );
  assert.match(main, /msSetMarkMode\(null\);\s*msSetMobileControlsVisible\(false\);/);

  await Promise.all([
    access(new URL("assets/minesweeper_assets/tiles/tile_flag.png", root)),
    access(new URL("assets/minesweeper_assets/tiles/tile_question.png", root)),
  ]);
});
