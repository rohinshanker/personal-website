import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import { readHomeScript } from "./helpers/home-scripts.mjs";
import { plain, sourceBetween } from "./helpers/source-runtime.mjs";

const root = new URL("../", import.meta.url);
const requiredAdministratorSecrets = Object.freeze([
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SIGNING_SECRET",
]);

test("Administrator sign-in remains hidden, accessible, and free of server secrets", async () => {
  const [home, index, gameStats, session, frontendConfig, workerConfig] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readHomeScript("gameStats"),
    readFile(new URL("scripts/home/core/administrator-session.js", root), "utf8"),
    readFile(new URL("scripts/home/game-stats-backend.js", root), "utf8"),
    readFile(new URL("workers/game-stats/wrangler.jsonc", root), "utf8"),
  ]);
  const browserSources = [home, index, gameStats, session, frontendConfig].join("\n");

  assert.match(
    home,
    /id="cursor-settings-administrator"[^>]*data-app="administrator"[^>]*aria-label="Administrator sign in"/
  );
  assert.doesNotMatch(home, /taskbar-administrator-button/);
  assert.match(home, /<label[^>]*for="administrator-username">\s*Username\s*<\/label>/);
  assert.match(home, /id="administrator-password"[^>]*type="password"[^>]*autocomplete="current-password"/);
  assert.match(home, /<p>Administrator access granted\.<\/p>/);
  assert.match(home, /src="scripts\/home\/core\/administrator-session\.js\?v=[^"]+"/);
  assert.doesNotMatch(home, /Game Progress profile updated to rohin \^\.\^\./);
  assert.doesNotMatch(session, /\blocalStorage\b/);

  for (const secretName of requiredAdministratorSecrets) {
    assert.doesNotMatch(browserSources, new RegExp(secretName));
    assert.match(workerConfig, new RegExp(`"${secretName}"`));
  }
});

const loadCompletionHarness = async ({ administratorProfile = false, adopt = true } = {}) => {
  const source = await readHomeScript("gameStats");
  const context = vm.createContext({});
  vm.runInContext(
    [
      `let gameStatsProfile = ${administratorProfile ? "{ id: 'admin' }" : "{ id: 'ordinary' }"};`,
      'let gameStatsSyncState = "auth-waiting";',
      "let gameStatsAuthenticationReturnFocus = {};",
      "const calls = [];",
      "const GAME_STATS_ROHIN_NEKO_PROFILE = { id: 'admin' };",
      "const isGameStatsAdministratorProfile = (profile) => profile?.id === 'admin';",
      "const resetGameProgressLocalData = () => calls.push('reset');",
      "const saveGameStatsProfile = (profile) => { calls.push('save-profile'); gameStatsProfile = profile; return profile; };",
      `const gameStatsAdministratorSession = { adopt: () => ${adopt} };`,
      "const renderGameStatsWindows = () => calls.push('render');",
      "const gameStatsAvatarAnimator = { start: () => calls.push('avatar') };",
      "const setGameStatsSyncState = (state) => { gameStatsSyncState = state; calls.push(['state', state]); };",
      "const syncQueuedGameStats = ({ manual }) => calls.push(['sync', manual]);",
      sourceBetween(
        source,
        "const completeAdministratorSignIn =",
        "\n\nif (administratorSignInForm)"
      ),
      "globalThis.complete = completeAdministratorSignIn;",
      "globalThis.read = () => ({ calls, gameStatsAuthenticationReturnFocus, gameStatsProfile, gameStatsSyncState });",
    ].join("\n"),
    context
  );
  return context;
};

test("the production success transition adopts proof, resets ordinary data, and resumes sync", async () => {
  const context = await loadCompletionHarness();
  assert.equal(context.complete({ proof: "proof", expiresAt: "later" }), true);
  assert.deepEqual(plain(context.read()), {
    calls: [
      "reset",
      "save-profile",
      "render",
      "avatar",
      ["state", "ready"],
      ["sync", true],
    ],
    gameStatsAuthenticationReturnFocus: null,
    gameStatsProfile: { id: "admin" },
    gameStatsSyncState: "ready",
  });
});

test("the production success transition preserves an existing Administrator profile", async () => {
  const context = await loadCompletionHarness({ administratorProfile: true });
  assert.equal(context.complete({ proof: "proof", expiresAt: "later" }), true);
  assert.deepEqual(plain(context.read().calls), [
    "render",
    "avatar",
    ["state", "ready"],
    ["sync", true],
  ]);
});

test("a rejected proof cannot render or synchronize Administrator state", async () => {
  const context = await loadCompletionHarness({ administratorProfile: true, adopt: false });
  assert.equal(context.complete({ proof: "bad", expiresAt: "later" }), false);
  assert.deepEqual(plain(context.read().calls), []);
  assert.equal(context.read().gameStatsSyncState, "auth-waiting");
});
