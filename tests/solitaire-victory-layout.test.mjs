import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { plain, sourceBetween } from "./helpers/source-runtime.mjs";

const root = new URL("../", import.meta.url);

test("Solitaire keeps the victory media wired to an accessible overlay", async () => {
  const home = await readFile(new URL("home.html", root), "utf8");
  assert.match(
    home,
    /id="sol-victory-video-overlay" aria-hidden="true">[\s\S]*?id="sol-victory-video"[\s\S]*?data-src="assets\/solitaire-cards\/victory-royale\.webm"[\s\S]*?id="sol-victory-canvas" aria-hidden="true"/
  );
  assert.match(home, /href="styles\/home\/apps\/solitaire\.css\?v=[^"]+"/);
  assert.match(home, /src="scripts\/home\/features\/solitaire\.js\?v=[^"]+"/);
  await access(new URL("assets/solitaire-cards/victory-royale.webm", root));
});

const createVictoryHarness = async ({ presentation = null } = {}) => {
  const source = await readHomeScript("solitaire");
  const context = vm.createContext({});
  vm.runInContext(
    [
      "const calls = [];",
      "const solSuitOrder = ['spades', 'clubs', 'diamonds', 'hearts'];",
      `const solState = { won: false, moves: 17, statsSession: 'session-1', presentation: ${JSON.stringify(presentation)}, foundations: Object.fromEntries(solSuitOrder.map((suit) => [suit, Array(13).fill({})])) };`,
      "const solStartFireworks = () => calls.push('fireworks');",
      "const solShowAchievement = () => calls.push('achievement');",
      "const solPlayVictoryVideo = () => calls.push('video');",
      "const createGameStatsEvent = (event) => event;",
      "const recordGameStatsEvent = (event, session) => calls.push(['record', event, session]);",
      "const notifyActivity = (name, detail) => calls.push(['activity', name, detail]);",
      sourceBetween(source, "const solTriggerVictoryEffects =", "\n\nconst solCreateSlotMark"),
      sourceBetween(source, "const solCheckWin =", "\n\nconst solPrefersReducedMotion"),
      "globalThis.checkWin = solCheckWin;",
      "globalThis.read = () => ({ calls, won: solState.won });",
    ].join("\n"),
    context
  );
  return context;
};

test("the production win transition records and presents a victory exactly once", async () => {
  const context = await createVictoryHarness();
  context.checkWin();
  context.checkWin();
  assert.deepEqual(plain(context.read()), {
    calls: [
      "fireworks",
      "achievement",
      "video",
      [
        "record",
        { game: "solitaire", type: "win", metric: 17 },
        "session-1",
      ],
      ["activity", "gameWin", { game: "solitaire" }],
    ],
    won: true,
  });
});

test("presentation victories never publish gameplay results", async () => {
  const context = await createVictoryHarness({ presentation: { visualEffects: false } });
  context.checkWin();
  assert.deepEqual(plain(context.read()), { calls: ["video"], won: true });
});
