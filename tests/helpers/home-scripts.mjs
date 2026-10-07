import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";

const root = new URL("../../", import.meta.url);

/**
 * The Home page is built from ordered classic scripts. Each one owns a feature
 * and publishes a single frozen contract on `window`; nothing re-exports
 * another script's names. Tests read the script that owns the behaviour they
 * assert, so a file move shows up here instead of in every test.
 */
export const HOME_SCRIPTS = Object.freeze({
  dom: "scripts/home/core/dom.js",
  media: "scripts/home/core/media.js",
  administratorSession: "scripts/home/core/administrator-session.js",
  cursorMode: "scripts/home/core/cursor-mode.js",
  util: "scripts/home/core/util.js",
  pointerCursor: "scripts/home/core/pointer-cursor.js",
  activity: "scripts/home/core/activity.js",
  activation: "scripts/home/core/activation.js",
  windows: "scripts/home/core/windows.js",

  desktop: "scripts/home/features/desktop.js",
  about: "scripts/home/features/about.js",
  gallery: "scripts/home/features/gallery.js",
  study: "scripts/home/features/study.js",
  gameRules: "scripts/home/games/rules.js",
  minesweeperRules: "scripts/home/games/minesweeper.js",
  snakeRules: "scripts/home/games/snake.js",
  solitaireRules: "scripts/home/games/solitaire.js",
  sudokuRules: "scripts/home/games/sudoku.js",
  gameSession: "scripts/home/games/session.js",
  gameStats: "scripts/home/features/game-stats.js",
  snake: "scripts/home/features/snake.js",
  minesweeper: "scripts/home/features/minesweeper.js",
  solitaire: "scripts/home/features/solitaire.js",
  sudoku: "scripts/home/features/sudoku.js",
  lifeCounter: "scripts/home/features/life-counter.js",
  neko: "scripts/home/features/neko.js",
  cursor: "scripts/home/features/cursor.js",
  calendar: "scripts/home/features/calendar.js",

  eventRuntime: "scripts/home/events/runtime.js",
  eventLightning: "scripts/home/events/lightning.js",
  eventDialogue: "scripts/home/events/dialogue.js",
  eventNotes: "scripts/home/events/notes.js",
  eventPrompts: "scripts/home/events/prompts.js",
  eventCreatures: "scripts/home/events/creatures.js",
  eventWordError: "scripts/home/events/word-error.js",
  eventSkillCheck: "scripts/home/events/skill-check.js",
  eventGradescopeCurve: "scripts/home/events/gradescope-curve.js",
  eventRedTool: "scripts/home/events/red-tool.js",
  eventDistressSignal: "scripts/home/events/distress-signal.js",
  eventGearsNest: "scripts/home/events/gears-nest.js",
  eventFate: "scripts/home/events/fate.js",
  eventSootSprites: "scripts/home/events/soot-sprites.js",
  eventToxicJungle: "scripts/home/events/toxic-jungle.js",
  eventLancerBattle: "scripts/home/events/lancer-battle.js",
  eventBrandBurns: "scripts/home/events/brand-burns.js",
  eventPokemonStarter: "scripts/home/events/pokemon-starter.js",
  eventRelicRecovery: "scripts/home/events/relic-recovery.js",
  eventDstNight: "scripts/home/events/dst-night.js",
  eventInfinityArmory: "scripts/home/events/infinity-armory.js",
  eventVirus: "scripts/home/events/virus.js",

  adminOrchestrator: "scripts/home/admin/orchestrator.js",
  adminControls: "scripts/home/admin-controls.js",
  boot: "scripts/home/main.js",

  systemAlerts: "scripts/home/system-alerts.js",
  appIconManifest: "scripts/home/app-icon-manifest.js",
  gameStatsBackend: "scripts/home/game-stats-backend.js",
  modelingPortfolio: "scripts/home/modeling-portfolio.js",
  clashRoyale: "scripts/home/clash-royale.js",
  textSelectionCursor: "scripts/home/text-selection-cursor.js",
  sudokuWorker: "scripts/home/sudoku-generator.worker.js",
});

/** Repository-relative path of a Home script. */
export function homeScriptPath(key) {
  const path = HOME_SCRIPTS[key];
  if (!path) {
    throw new Error(
      `unknown Home script "${key}"; add it to HOME_SCRIPTS in tests/helpers/home-scripts.mjs`
    );
  }
  return path;
}

/** Absolute URL of a Home script. */
export function homeScriptUrl(key) {
  return new URL(homeScriptPath(key), root);
}

/** Source text of one Home script. */
export function readHomeScript(key) {
  return readFile(homeScriptUrl(key), "utf8");
}

/** Source text of several Home scripts, keyed the same way. */
export async function readHomeScripts(...keys) {
  const sources = await Promise.all(keys.map((key) => readHomeScript(key)));
  return Object.fromEntries(keys.map((key, index) => [key, sources[index]]));
}

/**
 * The named scripts' source text joined for scanning, each preceded by its
 * path. For tests that assert on text spanning a few scripts — a shared CSS
 * contract, an asset manifest — where naming the scripts is the point. It is
 * source text, not a runtime: nothing here is executed, and a test that runs
 * production code should read the one script that owns it.
 */
export async function readHomeScriptText(...keys) {
  const sources = await Promise.all(keys.map((key) => readHomeScript(key)));
  return keys
    .map((key, index) => `/* ${homeScriptPath(key)} */\n${sources[index]}`)
    .join("\n");
}

/** Keys of the random-event scripts, in load order. */
export const RANDOM_EVENT_SCRIPT_KEYS = Object.freeze(
  Object.keys(HOME_SCRIPTS).filter((key) =>
    HOME_SCRIPTS[key].startsWith("scripts/home/events/")
  )
);

/**
 * Every random-event script's source text, for assertions about the contract
 * all events share — registration shape, managed windows, probability gating,
 * local assets. An assertion about one event should read that event's script.
 */
export function readRandomEventScriptText() {
  return readHomeScriptText(...RANDOM_EVENT_SCRIPT_KEYS);
}

/** Every Home script on disk, as repository-relative paths. */
export function listHomeScriptFiles() {
  const found = [];
  const walk = (relative) => {
    for (const entry of readdirSync(new URL(relative, root))) {
      const child = `${relative}${entry}`;
      if (statSync(new URL(child, root)).isDirectory()) walk(`${child}/`);
      else if (entry.endsWith(".js")) found.push(child);
    }
  };
  walk("scripts/home/");
  return found.sort();
}

export { root as repositoryRoot };
