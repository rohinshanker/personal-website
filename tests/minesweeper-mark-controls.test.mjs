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
    /id="ms-controls-mode"[^>]*aria-label="Control mode"[\s\S]*?<option value="keyboard" selected>Keyboard Controls \(S\/D\/F\)<\/option>[\s\S]*?<option value="mobile">Mobile Controls<\/option>[\s\S]*?<option value="mouse">Click\/Rt Click Only<\/option>/
  );
  assert.match(home, /id="ms-flag-mode"[\s\S]*?hidden/);
  assert.match(home, /id="ms-question-mode"[\s\S]*?hidden/);
  assert.match(home, /minesweeper\.css\?v=minesweeper-keyboard-controls-20260908/);
  assert.match(home, /main\.js\?v=game-build-[a-f0-9]{64}/);
  assert.match(index, /minesweeper\.css\?v=minesweeper-keyboard-controls-20260908/);
  assert.match(index, /main\.js\?v=game-build-[a-f0-9]{64}/);
  assert.match(
    home,
    /id="ms-grid"[\s\S]*?aria-keyshortcuts="S D F"/
  );
  assert.match(
    home,
    /data-app-window="minesweeper-controls"[\s\S]*?data-focus-return-window[\s\S]*?role="dialog"[\s\S]*?aria-modal="false"[\s\S]*?aria-describedby="ms-controls-target-note"[\s\S]*?id="ms-controls-title">Keyboard Controls<\/div>[\s\S]*?class="help"[\s\S]*?aria-label="Minesweeper Wikipedia"[\s\S]*?data-dialog-initial-focus[\s\S]*?data-close="minesweeper-controls"/
  );
  assert.match(
    home,
    /id="ms-controls-target-note">[\s\S]*?The current square is the square under your mouse pointer\./
  );
  for (const instruction of [
    /mouse_ms\.ico[\s\S]*?Press <kbd>S<\/kbd> to click the current square\./,
    /tile_question\.png[\s\S]*?Press <kbd>D<\/kbd> to maybe the current square\./,
    /tile_flag\.png[\s\S]*?Press <kbd>F<\/kbd> to flag the current square\./,
  ]) {
    assert.match(home, instruction);
  }
  assert.doesNotMatch(
    home,
    /ms-keyboard-help|ms-keyboard-controls|id="ms-mobile-controls"/
  );

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
  assert.match(
    styles,
    /\.ms-footer \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1\.2fr\);/
  );
  assert.match(styles, /\.minesweeper-controls-window \{[\s\S]*?330px/);
  assert.match(styles, /\.ms-controls-list li \{[\s\S]*?grid-template-columns: 24px minmax\(0, 1fr\);/);
  assert.match(
    styles,
    /@media \(max-width: 480px\) \{[\s\S]*?\.ms-footer \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/
  );
  assert.match(
    styles,
    /\.ms-cell:focus-visible \{[\s\S]*?outline: 1px dotted #000;[\s\S]*?outline-offset: -3px;/
  );

  assert.match(main, /const msFlagMode = document\.getElementById\("ms-flag-mode"\);/);
  assert.match(main, /const msQuestionMode = document\.getElementById\("ms-question-mode"\);/);
  assert.match(main, /const msControlsMode = document\.getElementById\("ms-controls-mode"\);/);
  assert.match(main, /const msControlsHelp = document\.getElementById\("ms-controls-help"\);/);
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
    /const msSetControlsMode = \(mode\) => \{[\s\S]*?\["keyboard", "mobile", "mouse"\][\s\S]*?msSetMobileControlsVisible\(nextMode === "mobile"\)[\s\S]*?setAttribute\("aria-keyshortcuts", "S D F"\)[\s\S]*?removeAttribute\("aria-keyshortcuts"\)/
  );
  assert.match(
    main,
    /msControlsMode\.addEventListener\("change", \(\) => \{[\s\S]*?msSetControlsMode\(msControlsMode\.value\);/
  );
  assert.match(main, /msSetMarkMode\(null\);\s*msSetControlsMode\("keyboard"\);/);
  assert.match(
    main,
    /const MS_KEYBOARD_ACTIONS = Object\.freeze\(\{[\s\S]*?s: "click",[\s\S]*?d: "question",[\s\S]*?f: "flag"/
  );
  assert.match(
    main,
    /const msKeyboardTargetIndex = \(\) => \{[\s\S]*?querySelector\("\.ms-cell:hover"\)[\s\S]*?if \(!cell\) return null;[\s\S]*?msState\.elements\[index\] !== cell/
  );
  const msKeyboardHandlerStart = main.indexOf(
    'document.addEventListener("keydown", (event) => {\n  const action = MS_KEYBOARD_ACTIONS'
  );
  const msKeyboardHandlerEnd = main.indexOf("\n});\n\nif (msGrid)", msKeyboardHandlerStart);
  assert.notEqual(msKeyboardHandlerStart, -1);
  assert.notEqual(msKeyboardHandlerEnd, -1);
  const msKeyboardHandler = main.slice(msKeyboardHandlerStart, msKeyboardHandlerEnd);
  assert.match(msKeyboardHandler, /event\.repeat/);
  assert.match(msKeyboardHandler, /event\.ctrlKey/);
  assert.match(msKeyboardHandler, /msControlsMode\?\.value !== "keyboard"/);
  assert.match(msKeyboardHandler, /activeWindow !== msWindow/);
  assert.doesNotMatch(msKeyboardHandler, /activeElement|focusedCell/);
  assert.match(msKeyboardHandler, /msHandleLeftClick\(index\)/);
  assert.match(msKeyboardHandler, /msToggleMark\(index, action\)/);
  assert.match(
    main,
    /setAttribute\("aria-label", `Row \$\{row\}, column \$\{column\}: \$\{stateLabel\}`\)/
  );
  assert.match(
    main,
    /msHelp\.addEventListener\("click", \(\) => \{[\s\S]*?comingSoonFocusReturns\.set\(controlsWindow, msHelp\)[\s\S]*?setWindowOpen\("minesweeper-controls", true\);[\s\S]*?DIALOG_INITIAL_FOCUS_SELECTOR[\s\S]*?focus\(\{ preventScroll: true \}\)/
  );
  assert.match(
    main,
    /FOCUS_RETURN_WINDOW_SELECTOR =[\s\S]*?\[data-focus-return-window\]/
  );
  assert.match(
    main,
    /msControlsHelp\.addEventListener\("click", \(\) => \{[\s\S]*?source: "minesweeper-controls-help"[\s\S]*?wikipedia\.org\/wiki\/Minesweeper_\(video_game\)/
  );
  assert.match(
    main,
    /appId === "minesweeper-controls" && isWindowVisible\(msWindow\)[\s\S]*?bringWindowToFront\(msWindow\)/
  );
  assert.match(
    main,
    /const snakeWindow = getAppWindow\("snake"\);[\s\S]*?activeWindow !== snakeWindow[\s\S]*?!isWindowVisible\(snakeWindow\)/
  );
  assert.match(
    main,
    /const restoreSuspendedActiveWindow = \(\) => \{[\s\S]*?activeWindow = suspendedActiveWindow;[\s\S]*?window\.addEventListener\("focus", restoreSuspendedActiveWindow\);/
  );

  await Promise.all([
    access(new URL("assets/minesweeper_assets/tiles/tile_flag.png", root)),
    access(new URL("assets/minesweeper_assets/tiles/tile_question.png", root)),
    access(new URL("assets/app-icons/ico/mouse_ms.ico", root)),
  ]);
});
