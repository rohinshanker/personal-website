import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { generateIssuedInitial } from "../../../workers/game-stats/src/issued-game-catalog.mjs";
import { routeHomeScript } from "./home-script-routes.mjs";

const root = new URL("../../../", import.meta.url);

/** Only this suite answers here, so no route can resolve to the live Worker. */
export const ISSUED_API_BASE_URL = "https://game-stats-verified-games.test";

/**
 * Serves the Solitaire and Sudoku rule engines with the rule helpers they
 * extend, which is where the page's own load order will carry them. It does not
 * exist for the session: the real adapter runs untouched, and only the network
 * under it is answered locally.
 */
export const installGameRuleEngines = async (page) => {
  const [solitaire, sudoku] = await Promise.all([
    readFile(new URL("scripts/home/games/solitaire.js", root), "utf8"),
    readFile(new URL("scripts/home/games/sudoku.js", root), "utf8"),
  ]);
  await routeHomeScript(page, "gameRules", (source) => `${source}\n${solitaire}\n${sudoku}`);
};

/** Stable key order, so a commitment matches the engines' own canonical JSON. */
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** The commitment the adapter recomputes from the issued state it receives. */
export const commitmentFor = (value) => sha256(canonicalJson(value));

/**
 * A Klondike board of four packed King-to-Ace runs and an empty stock: the
 * auto-solve control can play it straight to a win, which is what makes it
 * useful as an issued board in a test that needs a finished deal quickly.
 */
export const revealedSolitaireInitial = () => {
  const runs = [
    ["spades", "hearts"],
    ["hearts", "spades"],
    ["clubs", "diamonds"],
    ["diamonds", "clubs"],
  ].map(([odd, even]) =>
    Array.from({ length: 13 }, (unused, offset) => {
      const rank = 13 - offset;
      return `${rank % 2 ? odd : even}-${rank}`;
    })
  );
  return {
    variant: "klondike-draw-one",
    rngState: 0,
    stock: [],
    waste: [],
    foundations: { spades: 0, clubs: 0, diamonds: 0, hearts: 0 },
    tableau: [
      ...runs.map((run) => ({ down: [], up: run })),
      { down: [], up: [] },
      { down: [], up: [] },
      { down: [], up: [] },
    ],
    moves: 0,
    won: false,
  };
};

/**
 * A Klondike board one legal move from a win: every suit home but the last King,
 * which is sitting face up and alone on the first column. A test that needs a
 * verified completion can play that single card, so the win is a real move on
 * issued state rather than a board staged beneath the rules.
 */
export const nearWinSolitaireInitial = () => ({
  variant: "klondike-draw-one",
  rngState: 0,
  stock: [],
  waste: [],
  foundations: { spades: 13, clubs: 13, diamonds: 13, hearts: 12 },
  tableau: [
    { down: [], up: ["hearts-13"] },
    { down: [], up: [] },
    { down: [], up: [] },
    { down: [], up: [] },
    { down: [], up: [] },
    { down: [], up: [] },
    { down: [], up: [] },
  ],
  moves: 0,
  won: false,
});

const LIMITS = Object.freeze({
  inputs: 16_384,
  work: 2_000_000,
  ticks: 0,
  bytes: 262_144,
  continuations: 4,
});

/**
 * An issued game as the Worker answers `POST /sessions`: the catalog's board,
 * the identity the adapter insists on (`gameId` equal to `id`), a SHA-256
 * commitment over the canonical initial state, and every version field.
 */
export const issuedDescriptor = (game, config, seed, { id, expiresAt, initial } = {}) => {
  const sessionId = id || `session-${game}-${seed}`;
  const board = initial || generateIssuedInitial(game, config, seed);
  return {
    id: sessionId,
    gameId: sessionId,
    token: `synthetic-${game}-session-proof-${seed}`,
    game,
    config,
    resultProtocol: 2,
    rulesVersion: 1,
    replayVersion: 1,
    generatorVersion: 1,
    expiresAt: expiresAt || new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    initial: board,
    initialCommitment: commitmentFor(board),
    timing: { revision: 0, phase: "ready", elapsedMs: 0 },
    limits: { ...LIMITS },
  };
};

/**
 * A responder for the verified-session half of the Game Stats API, for a spec
 * that already owns a route of its own.
 *
 * Opening Solitaire or Sudoku now asks the server for a board, and finishing one
 * asks it to verify a replay. A spec with its own `/events` and `/stats` mock
 * can hand each request here first: `handle` answers the four verified-session
 * paths accurately and returns false for everything else, so the spec's own
 * branches carry on unchanged.
 *
 * Nothing is faked beyond the server's side of the exchange — the board issued
 * is a real catalog board with a real commitment, and the receipt echoes the
 * event the controller actually submitted.
 *
 * @param {{games?: string[], configs?: Record<string, object>,
 *          initials?: Record<string, object>, receipts?: Record<string, object>,
 *          elapsedMs?: number}} options
 */
export const createIssuedGameResponder = ({
  games = ["solitaire", "sudoku"],
  configs = {},
  initials = {},
  receipts = {},
  elapsedMs = 32_000,
} = {}) => {
  const issued = [];
  const timing = [];
  const restores = [];
  const finishes = [];
  const continuations = [];
  /** Every board issued, by session id, because a restore names one of them. */
  const boards = new Map();
  const latest = new Map();
  const revisions = new Map();
  const gameOf = new Map();
  let sequence = 0;

  // Each issuance is a new board, as it is on the server: a game that reissues
  // the same puzzle under the same identity could not be completed twice, and a
  // fixture that did so would be testing something the Worker never does.
  const descriptorFor = (game, config) => {
    sequence += 1;
    const descriptor = issuedDescriptor(
      game,
      config,
      sequence,
      { id: `session-${game}-verified-${sequence}`, initial: initials[game] }
    );
    boards.set(descriptor.id, descriptor);
    latest.set(game, descriptor);
    gameOf.set(descriptor.id, game);
    return { ...descriptor, config };
  };

  /** game -> the elapsed time the server will report for its next completion. */
  const metrics = new Map();

  const receiptFor = (finish) => {
    const game = gameOf.get(finish.id);
    const template = receipts[game] ||
      (game === "sudoku"
        ? {
            type: "win",
            difficulty: configs.sudoku?.difficulty || "easy",
            hintBucket: "noHints",
            metricKind: "seconds",
          }
        : { type: "win", metricKind: "moves" });
    const { metric: templateMetric, ...event } = template;
    const metric = metrics.has(game)
      ? metrics.get(game)
      : templateMetric ?? Math.round(elapsedMs / 1000);
    return {
      completion: {
        id: `completion-${finish.id}`,
        token: "synthetic-completion-proof",
        expiresAt: boards.get(finish.id).expiresAt,
        elapsedMs,
        event: {
          ...event,
          id: finish.request.eventId,
          game,
          metric,
          occurredAt: new Date().toISOString(),
        },
      },
    };
  };

  return {
    /** The issuance request bodies, in order. */
    issued,
    timing,
    restores,
    finishes,
    continuations,
    /** The ordered replay the adapter submitted for one game's verification. */
    replayFor: (game) =>
      finishes.find((finish) => gameOf.get(finish.id) === game)?.request?.inputs || [],
    /** The board most recently issued for one game. */
    boardFor: (game) => latest.get(game) || null,
    /**
     * Registers a board a spec issued from its own `/sessions` branch, so the
     * remaining verified paths can be answered for it. A spec that gates
     * issuance itself — a build-version conflict, a rate limit — keeps that
     * branch and hands the board over here.
     */
    adopt: (descriptor, game) => {
      boards.set(descriptor.id, descriptor);
      latest.set(game, descriptor);
      gameOf.set(descriptor.id, game);
      revisions.set(descriptor.id, descriptor.timing?.revision ?? 0);
      return descriptor;
    },
    /**
     * Sets the elapsed time the server will report for this game's next
     * completion. Timing is the server's to decide, so a test that arranges a
     * different clock says so here rather than hoping the receipt agrees.
     */
    setMetric: (game, metric) => metrics.set(game, metric),
    /**
     * Answers one request if it belongs to the verified-session protocol.
     * @returns {Promise<boolean>} whether the request was answered here.
     */
    async handle(route) {
      const request = route.request();
      if (request.method() !== "POST") return false;
      const { pathname } = new URL(request.url());
      const body = request.postDataJSON();
      const json = (payload, status = 200) =>
        route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });

      if (pathname === "/sessions") {
        if (!games.includes(body?.game)) return false;
        const descriptor = descriptorFor(body.game, body.config);
        issued.push(body);
        revisions.set(descriptor.id, 0);
        await json(descriptor);
        return true;
      }

      const segments = pathname.split("/");
      if (segments[1] !== "sessions" || !gameOf.has(segments[2])) return false;
      const id = segments[2];

      if (pathname.endsWith("/timing")) {
        const revision = (body?.expectedRevision ?? revisions.get(id) ?? 0) + 1;
        revisions.set(id, revision);
        timing.push({ id, operation: body?.operation, request: body });
        await json({
          ok: true,
          timing: {
            revision,
            phase: body?.operation === "pause" ? "paused" : "running",
            elapsedMs: 0,
          },
        });
        return true;
      }

      if (pathname.endsWith("/restore")) {
        restores.push({ id, request: body });
        const descriptor = boards.get(id);
        const revision = (revisions.get(id) ?? 0) + 1;
        revisions.set(id, revision);
        // The Worker restores a session only from a ready or acknowledged-paused
        // phase, and answers with the very board it issued.
        await json({
          ...descriptor,
          timing: { revision, phase: "paused", elapsedMs },
        });
        return true;
      }

      if (pathname.endsWith("/finish/continue")) {
        continuations.push({ id, request: body });
        await json(receiptFor(finishes.at(-1)));
        return true;
      }

      if (pathname.endsWith("/finish")) {
        finishes.push({ id, request: body });
        await json({
          progress: { id: `progress-${finishes.length}`, token: "synthetic-progress-proof" },
        });
        return true;
      }

      return false;
    },
  };
};

/**
 * Answers issuance, and only issuance, for a spec whose subject is something
 * else: a leaderboard's text, a stats window's layout, a profile prompt.
 *
 * Opening Solitaire or Sudoku now asks the server for a board, so a page with a
 * backend configured makes that request whether or not the test cares about it.
 * Answering it accurately is the honest fixture: the request is real, so it gets
 * a real issued board, and nothing about the result being verified is faked.
 * Suppressing the diagnostic or letting it reach a live backend would hide it.
 *
 * @param {import("@playwright/test").Page} page
 * @param {{apiBaseUrl: string, games?: string[]}} options
 * @returns {Promise<{issued: Array<{game: string}>, timing: Array<{operation: string}>}>}
 */
export const installIssuedGameIssuance = async (page, { apiBaseUrl, games = ["solitaire", "sudoku"] }) => {
  const issued = [];
  const timing = [];
  const phases = new Map();
  const boards = Object.fromEntries(
    games.map((game) => [
      game,
      issuedDescriptor(game, game === "sudoku" ? { difficulty: "easy" } : { variant: "klondike-draw-one" }, 0, {
        id: `session-${game}-quiet`,
      }),
    ])
  );

  await page.route(`${apiBaseUrl}/sessions`, async (route) => {
    const body = route.request().postDataJSON();
    const descriptor = boards[body?.game];
    if (!descriptor) {
      await route.fallback();
      return;
    }
    issued.push({ game: body.game, config: body.config });
    phases.set(descriptor.id, 0);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ...descriptor, config: body.config }),
    });
  });

  await page.route(`${apiBaseUrl}/sessions/*/timing`, async (route) => {
    const body = route.request().postDataJSON();
    const id = new URL(route.request().url()).pathname.split("/")[2];
    const revision = (body?.expectedRevision ?? phases.get(id) ?? 0) + 1;
    phases.set(id, revision);
    timing.push({ id, operation: body?.operation });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        timing: {
          revision,
          phase: body?.operation === "pause" ? "paused" : "running",
          elapsedMs: 0,
        },
      }),
    });
  });

  return { issued, timing };
};

/**
 * Answers the Game Stats API for verified play, so the real session adapter runs
 * against a server that behaves like the Worker: issuance, acknowledged timing
 * boundaries, restoration of a ready or paused session only, a finish that
 * returns a bounded continuation, and a completion receipt.
 *
 * Everything the adapter sent is recorded, so a test can assert on the replay
 * the server would actually verify rather than on the controller's own account
 * of it.
 *
 * The receipt's event has to agree with the one the controller submitted on every
 * identity field, or the adapter treats the result as unverified. `receipts`
 * supplies those fields per game, since a finish request names only its session.
 *
 * @param {import("@playwright/test").Page} page
 * @param {{boards?: Record<string, object>, receipts?: Record<string, object>,
 *          restore?: "accept" | "refuse",
 *          finishFailure?: {status: number, code: string}, elapsedMs?: number}} options
 */
export const installIssuedGameApi = async (page, {
  boards = {},
  receipts = {},
  restore = "accept",
  finishFailure = null,
  elapsedMs = 32_000,
} = {}) => {
  const issued = [];
  const timing = [];
  const restores = [];
  const finishes = [];
  const published = [];
  const continuations = [];
  /** game -> the descriptor last issued for it, so timing can advance it. */
  const live = new Map();
  /** session id -> game, because a finish identifies its session and not its game. */
  const gameOf = new Map(
    Object.entries(boards).map(([game, descriptor]) => [descriptor.id, game])
  );
  let paused = restore === "accept";

  await page.route(`${ISSUED_API_BASE_URL}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    const json = (payload, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });

    if (path === "/sessions") {
      const descriptor = boards[body.game];
      if (!descriptor) {
        await json({ ok: false, error: "No board", code: "unsupported-game" }, 400);
        return;
      }
      const served = { ...descriptor, config: body.config, timing: { ...descriptor.timing } };
      issued.push(body);
      live.set(body.game, served);
      gameOf.set(served.id, body.game);
      await json(served);
      return;
    }

    if (path.endsWith("/timing")) {
      const descriptor = live.get(
        [...live.keys()].find((game) => live.get(game).id === path.split("/")[2])
      );
      if (!descriptor) {
        await json({ ok: false, error: "Unknown session", code: "not-found" }, 404);
        return;
      }
      const next = {
        revision: body.expectedRevision + 1,
        phase: body.operation === "pause" ? "paused" : "running",
        elapsedMs: descriptor.timing.elapsedMs,
      };
      descriptor.timing = next;
      timing.push({ id: descriptor.id, operation: body.operation, request: body });
      await json({ ok: true, timing: next });
      return;
    }

    if (path.endsWith("/restore")) {
      restores.push({ id: path.split("/")[2], request: body });
      if (!paused) {
        // A running autosave has no acknowledged pause to restore from, so the
        // server refuses it exactly as the Worker does.
        await json({ ok: false, error: "Timing cannot be restored", code: "invalid-timing" }, 409);
        return;
      }
      const descriptor = [...live.values()].find((entry) => entry.id === path.split("/")[2]) ||
        Object.values(boards).find((entry) => entry.id === path.split("/")[2]);
      if (!descriptor) {
        await json({ ok: false, error: "Unknown session", code: "not-found" }, 404);
        return;
      }
      await json({
        ...descriptor,
        timing: { revision: (descriptor.timing.revision || 0) + 1, phase: "paused", elapsedMs },
      });
      return;
    }

    if (path.endsWith("/finish/continue")) {
      continuations.push(body);
      await json(receipt(finishes.at(-1), elapsedMs));
      return;
    }

    if (path.endsWith("/finish")) {
      const id = path.split("/")[2];
      finishes.push({ id, game: gameOf.get(id) || null, request: body });
      if (finishFailure) {
        await json(
          { ok: false, error: "Verification failed", code: finishFailure.code },
          finishFailure.status
        );
        return;
      }
      await json({
        progress: { id: `progress-${finishes.length}`, token: "synthetic-progress-proof" },
      });
      return;
    }

    if (path === "/events") {
      published.push(body);
      await json({ ok: true, applied: true, eventId: body.event.id });
      return;
    }

    if (path === "/stats") {
      await json({
        generatedAt: new Date().toISOString(),
        totals: {},
        leaderboards: {},
        playerRanks: {},
        playerRecords: {},
        acknowledgedEventIds: published.map((entry) => entry.event?.id).filter(Boolean),
      });
      return;
    }

    throw new Error(`Unexpected verified game route ${path}`);
  });

  /** The identity fields each game's own completion event carries. */
  const receiptEvent = (game) => {
    if (receipts[game]) return receipts[game];
    if (game === "sudoku") {
      return {
        type: "win",
        difficulty: boards.sudoku?.config?.difficulty || "easy",
        hintBucket: "noHints",
        metricKind: "seconds",
      };
    }
    return { type: "win", metricKind: "moves" };
  };

  const receipt = (finish, finishedMs) => {
    const game = finish?.game;
    return {
      completion: {
        id: `completion-${finish?.id || "unknown"}`,
        token: "synthetic-completion-proof",
        expiresAt: boards[game]?.expiresAt,
        elapsedMs: finishedMs,
        event: {
          ...receiptEvent(game),
          id: finish?.request?.eventId,
          game,
          metric: Math.round(finishedMs / 1000),
          occurredAt: new Date().toISOString(),
        },
      },
    };
  };

  return {
    issued,
    timing,
    restores,
    finishes,
    published,
    continuations,
    /** The ordered replay the adapter submitted for verification. */
    replayFor: (game) => finishes.find((finish) => finish.game === game)?.request?.inputs || [],
    /** The finish request submitted for one game, if any. */
    finishFor: (game) => finishes.find((finish) => finish.game === game) || null,
    /** Makes a later restoration refuse, as a running autosave does. */
    refuseRestore: () => {
      paused = false;
    },
    allowRestore: () => {
      paused = true;
    },
  };
};

/** Installs the engines and the issued-game API, as a verified page needs both. */
export const installVerifiedGames = async (page, options = {}) => {
  await installGameRuleEngines(page);
  return installIssuedGameApi(page, options);
};
