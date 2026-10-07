import { readFile } from "node:fs/promises";

import { generateIssuedInitial } from "../../../workers/game-stats/src/issued-game-catalog.mjs";
import { routeHomeScript } from "./home-script-routes.mjs";

const root = new URL("../../../", import.meta.url);

/**
 * Serves the Solitaire and Sudoku rule engines with the rule helpers they
 * extend. They are ordinary ordered classic scripts, so this puts them exactly
 * where the page's own load order will: after `scripts/home/games/rules.js` and
 * before the game controllers that destructure their contracts.
 */
export const installGameRuleEngines = async (page) => {
  const [solitaire, sudoku] = await Promise.all([
    readFile(new URL("scripts/home/games/solitaire.js", root), "utf8"),
    readFile(new URL("scripts/home/games/sudoku.js", root), "utf8"),
  ]);
  await routeHomeScript(page, "gameRules", (source) => `${source}\n${solitaire}\n${sudoku}`);
};

/** The issued descriptor the Worker's `POST /sessions` answers with. */
export const issuedDescriptor = (game, config, seed) => {
  const initial = generateIssuedInitial(game, config, seed);
  return {
    id: `session-${game}-${seed}`,
    token: `token-${game}-${seed}`,
    expiresAt: "2026-03-04T18:00:00.000Z",
    gameId: `issued-${game}-${seed}`,
    game,
    config,
    resultProtocol: 2,
    rulesVersion: 1,
    replayVersion: 1,
    generatorVersion: 1,
    initialCommitment: `commitment-${game}-${seed}`,
    initial,
    timing: { revision: 1, phase: "ready", elapsedMs: 0 },
    limits: { inputs: 16_384, work: 2_000_000, ticks: 0, bytes: 262_144 },
  };
};

/**
 * Installs the verified-session half of the Game Stats hooks, as a fixture.
 *
 * The real adapter belongs to the integration commit; what the Solitaire and
 * Sudoku controllers need from it is a frozen contract, so this stands in for it
 * and records what the controllers actually did: which boards they asked for,
 * every input they recorded against one, the timing boundaries they reported, and
 * the results they published. `window.__verifiedGameSession` reads it back, and
 * `deliverCanonicalMetric` plays the server's authoritative metric in.
 */
export const installVerifiedGameSession = async (page, { descriptors = {} } = {}) => {
  await page.addInitScript((seeded) => {
    window.__verifiedGameSessionDescriptors = seeded;
  }, descriptors);

  await routeHomeScript(page, "gameStats", (source) => {
    const factory = "const createGameStatsHooks = (game, stateOrGetter) => {";
    const publish = "window.homeGameStats = Object.freeze({";
    if (!source.includes(factory) || !source.includes(publish)) {
      throw new Error("The Game Stats hook factory is no longer where this fixture wraps it.");
    }
    // The production factory is wrapped rather than edited, so the fixture holds
    // whatever contract it returns and simply puts the verified half in front.
    return source
      .replace(factory, "const createProductionGameStatsHooks = (game, stateOrGetter) => {")
      .replace(publish, `${WRAPPER}

${publish}`);
  });
};

/** The wrapper the fixture installs around the production hook factory. */
const WRAPPER = `const createGameStatsHooks = (game, stateOrGetter) => {
  const base = createProductionGameStatsHooks(game, stateOrGetter);
  const verified = (window.__verifiedGameSession ||= {
    issued: [], inputs: [], timing: [], published: [], restored: [], options: new Map(),
  });
  const attempt = { descriptor: null, replay: [] };
  const seeded = () => (window.__verifiedGameSessionDescriptors || {})[game] || null;
  return Object.freeze({
    ...base,
    // Abandoning the attempt invalidates its issuance, so a new board has to ask
    // for one of its own rather than inheriting this board's.
    dropSession: (...args) => {
      attempt.descriptor = null;
      attempt.replay = [];
      return base.dropSession(...args);
    },
    recordEvent: (payload, options = {}) => {
      verified.published.push({
        game,
        payload,
        replay: attempt.replay.length,
        issued: Boolean(attempt.descriptor),
      });
      verified.options.set(game, options);
      return base.recordEvent(payload, options);
    },
    hasIssuedGame: () => Boolean(attempt.descriptor),
    issueGame: async (config, options = {}) => {
      const descriptor = seeded();
      verified.issued.push({ game, config, options, served: Boolean(descriptor) });
      if (!descriptor) return null;
      attempt.descriptor = descriptor;
      attempt.replay = [];
      return descriptor;
    },
    recordInput: (action) => {
      if (!attempt.descriptor) return null;
      const recorded = { ...action, seq: attempt.replay.length + 1 };
      attempt.replay.push(recorded);
      verified.inputs.push({ game, action: recorded });
      return recorded;
    },
    pauseGame: async () => { verified.timing.push({ game, op: "pause" }); return true; },
    resumeGame: async () => { verified.timing.push({ game, op: "resume" }); return true; },
    exportGame: () =>
      attempt.descriptor ? { descriptor: attempt.descriptor, replay: attempt.replay } : null,
    restoreGame: (saved) => {
      verified.restored.push({ game, saved: saved ? { replay: saved.replay.length } : null });
      if (!saved) return null;
      attempt.descriptor = saved.descriptor;
      attempt.replay = saved.replay.slice();
      return saved.descriptor;
    },
  });
};`;

/** Hands a controller the server's authoritative metric for its finished board. */
export const deliverCanonicalMetric = (page, game, metric) =>
  page.evaluate(
    ([forGame, value]) => {
      const options = window.__verifiedGameSession?.options.get(forGame);
      if (!options?.onCanonicalMetric) return false;
      options.onCanonicalMetric({
        metric: value,
        metricKind: forGame === "sudoku" ? "seconds" : "moves",
        elapsedMs: value * 1000,
      });
      return true;
    },
    [game, metric]
  );

/** Everything the controllers reported to the session, as plain JSON. */
export const readVerifiedGameSession = (page) =>
  page.evaluate(() => {
    const verified = window.__verifiedGameSession;
    if (!verified) return null;
    return {
      issued: verified.issued,
      inputs: verified.inputs,
      timing: verified.timing,
      published: verified.published,
      restored: verified.restored,
    };
  });

/** Installs the engines and the session fixture together, as a page needs both. */
export const installVerifiedGames = async (page, descriptors) => {
  await installGameRuleEngines(page);
  await installVerifiedGameSession(page, { descriptors });
};
