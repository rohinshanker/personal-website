import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("profile icon gallery keeps only one vertical arrow at each scrollbar end", async () => {
  const css = await readFile(new URL("styles/home/apps/game-stats.css", root), "utf8");

  assert.match(
    css,
    /\.game-profile-icon-gallery::-webkit-scrollbar-button:vertical:start:increment,[\s\S]*?vertical:end:decrement[\s\S]*?display: none;/
  );
  assert.match(
    css,
    /\.game-profile-icon-gallery::-webkit-scrollbar-button:vertical:start:decrement,[\s\S]*?vertical:end:increment[\s\S]*?display: block;/
  );
  assert.match(
    css,
    /vertical:start:decrement \{[\s\S]*?button-up\.svg/
  );
  assert.match(
    css,
    /vertical:end:increment \{[\s\S]*?button-down\.svg/
  );
});

test("profile icon gallery separates its fixed frame and updates selection in place", async () => {
  const [home, index, main, css] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/game-stats.css", root), "utf8"),
  ]);

  assert.match(
    home,
    /<div class="game-profile-icon-gallery-frame">\s*<div class="game-profile-icon-gallery" id="game-profile-icon-gallery" role="listbox" aria-label="Player icons"><\/div>\s*<\/div>/
  );
  assert.match(
    css,
    /\.game-profile-icon-gallery-frame \{[\s\S]*?box-shadow: var\(--border-sunken-outer\), var\(--border-sunken-inner\);[\s\S]*?overflow: hidden;[\s\S]*?padding: 2px;/
  );
  const galleryRule = css.match(/\.game-profile-icon-gallery \{[\s\S]*?\n\}/)?.[0];
  assert.ok(galleryRule, "Missing icon gallery rule.");
  assert.match(galleryRule, /max-height: min\(42vh, 280px\);/);
  assert.match(galleryRule, /overflow: auto;/);
  assert.match(galleryRule, /padding: 4px;/);
  assert.doesNotMatch(galleryRule, /box-shadow:/);

  for (const entryPoint of [home, index]) {
    assert.match(
      entryPoint,
      /styles\/home\/apps\/game-stats\.css\?v=name-caret-fit-20260808/
    );
  }

  const pickerStart = main.indexOf("const updateGameProfileIconOptionSelection =");
  const pickerEnd = main.indexOf("\nconst resolveGameStatsProfilePrompt", pickerStart);
  assert.ok(pickerStart >= 0 && pickerEnd > pickerStart, "Missing icon-picker runtime.");
  const picker = main.slice(pickerStart, pickerEnd);
  assert.match(
    picker,
    /querySelectorAll\("\.game-profile-icon-option"\)[\s\S]*?option\.classList\.toggle\("is-selected", selected\);[\s\S]*?option\.setAttribute\("aria-selected", String\(selected\)\);/
  );
  const clickHandler = picker.match(
    /button\.addEventListener\("click", \(\) => \{[\s\S]*?\n    \}\);/
  )?.[0];
  assert.ok(clickHandler, "Missing icon selection handler.");
  assert.match(clickHandler, /updateGameProfileIconOptionSelection\(button\);/);
  assert.doesNotMatch(clickHandler, /renderGameProfileIconGallery\(\);/);
});
