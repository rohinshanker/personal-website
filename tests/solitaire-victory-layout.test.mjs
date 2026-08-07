import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Solitaire Victory Royale media is 40% smaller and anchored to the board top", async () => {
  const [home, main, styles] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/apps/solitaire.css", root), "utf8"),
  ]);

  assert.match(
    home,
    /<div class="sol-victory-video-overlay" id="sol-victory-video-overlay" aria-hidden="true">[\s\S]*?<video[\s\S]*?data-src="assets\/solitaire-cards\/victory-royale\.webm"[\s\S]*?<canvas id="sol-victory-canvas" aria-hidden="true"><\/canvas>/
  );
  assert.match(
    home,
    /styles\/home\/apps\/solitaire\.css\?v=solitaire-victory-scale-20260730/
  );
  assert.match(
    styles,
    /\.sol-app \{[\s\S]*?position: relative;/,
    "The board overlay needs the Solitaire app as its positioning context."
  );
  assert.match(
    styles,
    /\.sol-victory-video-overlay \{[\s\S]*?--sol-victory-height-limit: 27vh;[\s\S]*?--sol-victory-width-limit: 28\.8vw;[\s\S]*?--sol-victory-width: min\(234px, var\(--sol-victory-width-limit\)\);[\s\S]*?align-items: flex-start;[\s\S]*?inset: 60px 0 0;[\s\S]*?justify-content: center;[\s\S]*?overflow: hidden;[\s\S]*?padding-top: 16px;[\s\S]*?position: absolute;/,
    "The overlay should match the green board and align its content 16px from the top."
  );
  assert.match(
    styles,
    /\.sol-victory-video-overlay video\.is-visible-fallback \{[\s\S]*?max-height: var\(--sol-victory-height-limit\);[\s\S]*?max-width: var\(--sol-victory-width-limit\);[\s\S]*?width: var\(--sol-victory-width\);/
  );
  assert.match(
    styles,
    /\.sol-victory-video-overlay canvas \{[\s\S]*?max-height: var\(--sol-victory-height-limit\);[\s\S]*?max-width: var\(--sol-victory-width-limit\);[\s\S]*?width: var\(--sol-victory-width\);/
  );
  assert.match(
    main,
    /const solTriggerVictoryEffects = \(\) => \{[\s\S]*?solPlayVictoryVideo\(\);/
  );
  assert.match(
    main,
    /const solCheckWin = \(\) => \{[\s\S]*?if \(!wasWon && solState\.won\) \{[\s\S]*?solTriggerVictoryEffects\(\);/
  );
});
