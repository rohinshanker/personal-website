import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  readHomeScriptText,
} from "./helpers/home-scripts.mjs";

const root = new URL("../", import.meta.url);
const readMain = () => readHomeScriptText(
    "windows",
    "neko",
    "sudoku",
    "calendar",
    "gallery",
    "lifeCounter",
    "eventDistressSignal"
  );

const extractBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Unable to extract ${startMarker}`);
  return source.slice(start, end);
};

test("small-window expansion and loading progress preserve their upper bounds", async () => {
  const main = await readMain();
  const expansion = extractBetween(main, "const expandSmallWindow", "const getAppWindow");
  const sudokuLoading = extractBetween(
    main,
    "const sudokuProgressLoader",
    "const startSudokuBootSequence"
  );
  const distressLoading = extractBetween(
    main,
    "const startDistressPowerSequence",
    "const resetDistressSignal"
  );

  assert.match(
    expansion,
    /clampNumber\(Math\.max\(rect\.width \* 2, rect\.width \+ 240\), 0, maxWidth\)/
  );
  assert.match(
    expansion,
    /clampNumber\(Math\.max\(rect\.height \* 2, rect\.height \+ 180\), 0, maxHeight\)/
  );
  assert.match(
    sudokuLoading,
    /progressCap: 98,[\s\S]*?return Math\.max\(progress \+ 1, progress \+ jump \+ catchup\);/
  );
  assert.match(
    distressLoading,
    /Math\.min\(\s*1,\s*Math\.max\(\s*distressPowerVisibleProgress,\s*Math\.min\(targetProgress \+ Math\.random\(\) \* 0\.035, distressPowerVisibleProgress \+ jumpSize\)/
  );
});

test("Neko run assets retain every image and finish after every request settles", async () => {
  const main = await readMain();
  const preload = extractBetween(main, "const preloadNekoRunAssets", "const NEKO_STREAM_COUNT");

  assert.match(preload, /image\.addEventListener\("load", finish, \{ once: true \}\)/);
  assert.match(preload, /image\.addEventListener\("error", finish, \{ once: true \}\)/);
  assert.match(preload, /nekoPreloadedRunAssetImages\.push\(image\)/);
  assert.match(preload, /\.then\(\(\) => \{\s*nekoRunAssetsLoaded = true;/);
  assert.doesNotMatch(main, /NEKO_RUN_ASSET_PRELOAD_ATTEMPTS|preloadNekoRunAsset\s*=/);
  assert.doesNotMatch(preload, /image\.decode\(/);
});

test("resize dispatch keeps NodeList conversion and clamps title bars after mutating handlers", async () => {
  const main = await readMain();
  const titleBarRead = extractBetween(
    main,
    "const readVisibleWindowTitleBarClamps",
    "const clampVisibleWindowTitleBars"
  );
  const dispatcher = extractBetween(
    main,
    "const dispatchWindowResize",
    'window.addEventListener("resize", dispatchWindowResize)'
  );

  assert.match(titleBarRead, /\[\.\.\.draggableWindows\]\.flatMap/);
  assert.ok(
    dispatcher.indexOf("clampVisibleWindowTitleBars(readVisibleWindowTitleBarClamps())") >
      dispatcher.indexOf("updateLifeCounterWidthControls()"),
    "Title bars must be measured and clamped after resize handlers that mutate window geometry."
  );
});

test("Credits drag geometry is cached without rounding the portfolio divider width", async () => {
  const main = await readMain();
  const portfolioDivider = extractBetween(
    main,
    'document.querySelectorAll(".portfolio-window")',
    "const pathfinderImages"
  );
  const draggableWindows = extractBetween(
    main,
    "draggableWindows.forEach((win) => {",
    "const scheduleCalendarRefresh"
  );

  assert.match(portfolioDivider, /const startWidth = selectorPanel\.getBoundingClientRect\(\)\.width;/);
  assert.doesNotMatch(portfolioDivider, /const startWidth = selectorPanel\.offsetWidth;/);
  assert.match(
    draggableWindows,
    /const dragTitleBarGeometry = readWindowTitleBarClampGeometry\(win, rect\);[\s\S]*?setWindowTitleBarClampedPosition\(win, nextLeft, nextTop, dragTitleBarGeometry\);/
  );
});
