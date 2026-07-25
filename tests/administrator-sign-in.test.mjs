import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const requiredAdministratorSecrets = Object.freeze([
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SIGNING_SECRET",
]);

test("Administrator access is hidden in Cursor Settings and dialogs are wired with accessible form controls", async () => {
  const [home, dom, main, styles] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("styles/home/cursors.css", root), "utf8"),
  ]);

  assert.match(
    home,
    /data-app-window="cursor"[\s\S]*?<div class="title-bar-controls">[\s\S]*?<button[^>]*id="cursor-settings-administrator"[^>]*class="help"[^>]*data-app="administrator"[^>]*aria-label="Administrator sign in"[\s\S]*?<button[^>]*aria-label="Close"[^>]*data-close="cursor"/,
    "Cursor Settings must place the Administrator question-mark control directly before Close."
  );
  assert.doesNotMatch(
    home,
    /class="taskbar-icon[^\"]*taskbar-administrator-button[^\"]*"[^>]*data-app="administrator"/,
    "Administrator access must not appear in the app dock."
  );
  assert.match(
    home,
    /data-app-window="administrator"[^>]*id="administrator-window"/,
    "The taskbar button must target the Administrator window."
  );
  assert.match(home, /id="administrator-sign-in-form"/);
  assert.match(home, /<label[^>]*for="administrator-username">\s*Username\s*<\/label>/);
  assert.match(home, /id="administrator-username"[^>]*autocomplete="username"/);
  assert.match(home, /<label[^>]*for="administrator-password">\s*Password\s*<\/label>/);
  assert.match(
    home,
    /id="administrator-password"[^>]*type="password"[^>]*autocomplete="current-password"/
  );
  assert.match(home, /id="administrator-sign-in"[^>]*>\s*Sign In\s*</);
  assert.match(home, /id="administrator-alert-window"/);
  assert.match(home, /class="window app-window random-alert-window is-hidden administrator-alert-window"/);
  assert.match(home, /src="assets\/app-icons\/ico\/msg_warning\.ico" alt=""/);
  assert.match(home, /<p>Administrator access granted\.<\/p>/);
  assert.doesNotMatch(home, /Game Progress profile updated to rohin \^\.\^\./);
  assert.match(home, /id="administrator-alert-close"/);

  for (const reference of [
    'administratorWindow: doc.getElementById("administrator-window"),',
    'administratorSignInForm: doc.getElementById("administrator-sign-in-form"),',
    'administratorUsername: doc.getElementById("administrator-username"),',
    'administratorPassword: doc.getElementById("administrator-password"),',
    'administratorAlertWindow: doc.getElementById("administrator-alert-window"),',
    'administratorAlertClose: doc.getElementById("administrator-alert-close"),',
  ]) {
    assert.ok(dom.includes(reference), `Missing Administrator DOM reference: ${reference}`);
  }

  assert.match(styles, /\.administrator-window\b/);
  assert.match(styles, /\.administrator-alert-window\b/);
  assert.doesNotMatch(styles, /\.administrator-alert-body\b/);
  assert.doesNotMatch(styles, /\.administrator-alert-icon\b/);
  assert.match(main, /"\/administrator\/sign-in"/);
  assert.match(
    main,
    /ADMINISTRATOR_ALERT_Z_INDEX = 1_000_000[\s\S]*?administratorAlertWindow\.style\.zIndex/
  );
  assert.match(main, /win\.classList\.contains\("home-window"\) \|\| appId === "administrator-alert"/);
  assert.match(main, /Authorization\s*:\s*`Bearer \$\{[^}]+\}`/);
  assert.match(main, /GAME_STATS_ADMINISTRATOR_PROOF_STORAGE_KEY/);
  assert.match(main, /sessionStorage\.getItem\(GAME_STATS_ADMINISTRATOR_PROOF_STORAGE_KEY\)/);
  assert.match(main, /sessionStorage\.setItem\(/);
  assert.match(main, /sessionStorage\.removeItem\(GAME_STATS_ADMINISTRATOR_PROOF_STORAGE_KEY\)/);
  assert.doesNotMatch(
    main,
    /localStorage\.setItem\(\s*GAME_STATS_ADMINISTRATOR_PROOF_STORAGE_KEY/,
    "The short-lived authorization proof must not become a long-lived local credential."
  );
});

test("Administrator credentials remain server-only and the protected profile has no keyboard backdoor", async () => {
  const [home, index, main, frontendConfig, workerConfig] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("scripts/home/game-stats-backend.js", root), "utf8"),
    readFile(new URL("workers/game-stats/wrangler.jsonc", root), "utf8"),
  ]);
  const browserSources = [home, index, main, frontendConfig].join("\n");

  for (const secretName of requiredAdministratorSecrets) {
    assert.doesNotMatch(
      browserSources,
      new RegExp(secretName),
      `${secretName} must never be sent to or embedded in browser code.`
    );
  }

  assert.doesNotMatch(main, /ROHIN_NEKO_PROFILE_SHORTCUT/);
  assert.match(
    main,
    /name:\s*"rohin \^\.\^"[\s\S]*?icon:\s*GAME_STATS_ROHIN_NEKO_AVATAR_ICON/
  );
  assert.match(main, /expiresAt/);
  assert.match(main, /normalizeAdministratorProof/);
  assert.match(main, /resetGameProgressLocalData\(\);[\s\S]*?saveGameStatsProfile\(/);
  assert.match(
    main,
    /waitingForAdministratorAuthorizationCount \+= 1;[\s\S]*?remainingSubmissions\.push\(submission\);[\s\S]*?continue;/,
    "A protected event must remain queued so it can publish after a fresh administrator sign-in."
  );
  assert.match(
    main,
    /else if \(waitingForAdministratorAuthorizationCount\) \{[\s\S]*?setGameStatsSyncState\("auth-required"\);/
  );
  for (const secretName of requiredAdministratorSecrets) {
    assert.match(workerConfig, new RegExp(`"${secretName}"`));
  }
});
