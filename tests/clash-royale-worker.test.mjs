import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "../workers/game-stats/src/index.mjs";

const PLAYER_URL = "https://proxy.royaleapi.dev/v1/players/%2328CYYU08P";
const BATTLELOG_URL = `${PLAYER_URL}/battlelog`;
const FIXED_NOW = Date.parse("2026-10-01T16:30:00.000Z");

const card = (overrides = {}) => ({
  id: 26000000,
  name: "Knight",
  level: 14,
  maxLevel: 14,
  iconUrls: {
    medium: "https://api-assets.clashroyale.com/cards/300/knight.png",
  },
  ...overrides,
});

const participant = (tag, name, crowns, overrides = {}) => ({
  tag,
  name,
  crowns,
  cards: [card()],
  ...overrides,
});

const profile = (overrides = {}) => ({
  tag: "#28CYYU08P",
  name: "Rohin",
  trophies: 8123,
  bestTrophies: 8200,
  wins: 5000,
  losses: 4100,
  battleCount: 9200,
  threeCrownWins: 900,
  clan: { tag: "#2ABC", name: "Example Clan", badgeId: 16000000 },
  arena: { id: 54000012, name: "Legendary Arena" },
  currentDeck: [
    card({
      elixirCost: 3,
      rarity: "COMMON",
      evolutionLevel: 1,
      iconUrls: {
        medium: "https://api-assets.clashroyale.com/cards/300/knight.png",
        evolutionMedium:
          "https://api-assets.clashroyale.com/cardevolutions/300/knight.png",
      },
      ignoredCardField: "not exposed",
    }),
  ],
  ignoredProfileField: "not exposed",
  ...overrides,
});

const battlelog = (overrides = {}) => [
  {
    battleTime: "20261001T160000.000Z",
    type: "PvP",
    gameMode: { id: 72000006, name: "Ladder", ignored: true },
    deckSelection: "collection",
    team: [
      participant("#28CYYU08P", "Rohin", 2, {
        trophyChange: 30,
        clan: { tag: "#2ABC", name: "Example Clan", badgeId: 16000000 },
      }),
    ],
    opponent: [
      participant("#9XYZ", "Opponent", 1, {
        trophyChange: -30,
        cards: [
          card({
            id: 26000001,
            name: "Mini P.E.K.K.A",
            elixirCost: 4,
            rarity: "Rare",
            evolutionLevel: 2,
            iconUrls: {
              medium: "https://untrusted.example/card.png",
              heroMedium:
                "https://api-assets.clashroyale.com/cardheroes/300/mini-pekka.png",
            },
          }),
        ],
      }),
    ],
    ignoredBattleField: "not exposed",
    ...overrides,
  },
];

const env = (overrides = {}) => ({
  ALLOWED_ORIGIN: "https://rohin.shanker.me",
  CLASH_ROYALE_API_KEY: "test-clash-token",
  ...overrides,
});

const request = (path = "/clash-royale", options = {}) =>
  new Request(`https://stats.example.test${path}`, {
    headers: { Origin: "https://rohin.shanker.me", ...options.headers },
    ...options,
  });

const json = async (response) => JSON.parse(await response.text());

class MemoryCache {
  constructor() {
    this.responses = new Map();
    this.puts = [];
    this.matchError = null;
    this.putError = null;
  }

  key(value) {
    return `${value.method || "GET"} ${value.url || value}`;
  }

  async match(key) {
    if (this.matchError) throw this.matchError;
    return this.responses.get(this.key(key))?.clone();
  }

  async put(key, response) {
    if (this.putError) throw this.putError;
    this.puts.push({ key: this.key(key), response: response.clone() });
    this.responses.set(this.key(key), response.clone());
  }
}

const successFetch = (calls, profileBody = profile(), battlesBody = battlelog()) =>
  async (url, init) => {
    calls.push({ url, init });
    const body = url === PLAYER_URL ? profileBody : battlesBody;
    return Response.json(body);
  };

const fetchRoute = (options = {}) => {
  const cache = Object.hasOwn(options, "cache") ? options.cache : new MemoryCache();
  const pending = [];
  const calls = [];
  const context = {
    waitUntil(promise) {
      pending.push(promise);
    },
  };
  const dependencies = {
    clashRoyale: {
      fetchImpl: options.fetchImpl ?? successFetch(calls),
      cache,
      now: () => FIXED_NOW,
    },
  };
  return {
    cache,
    calls,
    pending,
    run: (routeRequest = request(), routeEnv = env()) =>
      handleRequest(routeRequest, routeEnv, context, dependencies),
    runWithoutContext: (routeRequest = request(), routeEnv = env()) =>
      handleRequest(routeRequest, routeEnv, undefined, dependencies),
  };
};

test("returns an allowlisted profile, current deck, and battle log", async () => {
  const route = fetchRoute();
  const response = await route.run();
  const body = await json(response);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://rohin.shanker.me");
  assert.equal(body.ok, true);
  assert.equal(body.fetchedAt, "2026-10-01T16:30:00.000Z");
  assert.equal(body.cacheTtlSeconds, 300);
  assert.deepEqual(body.player, {
    tag: "#28CYYU08P",
    name: "Rohin",
    trophies: 8123,
    bestTrophies: 8200,
    wins: 5000,
    losses: 4100,
    battleCount: 9200,
    threeCrownWins: 900,
    clan: { tag: "#2ABC", name: "Example Clan", badgeId: 16000000 },
    arena: { id: 54000012, name: "Legendary Arena" },
    currentDeck: [
      {
        id: 26000000,
        name: "Knight",
        level: 14,
        maxLevel: 14,
        evolutionLevel: 1,
        elixirCost: 3,
        rarity: "common",
        variant: "evo",
        iconUrl: "https://api-assets.clashroyale.com/cards/300/knight.png",
        variantIconUrl:
          "https://api-assets.clashroyale.com/cardevolutions/300/knight.png",
      },
    ],
  });
  assert.deepEqual(body.battles[0], {
    battleTime: "20261001T160000.000Z",
    type: "PvP",
    gameMode: { id: 72000006, name: "Ladder" },
    deckSelection: "collection",
    team: [
      {
        tag: "#28CYYU08P",
        name: "Rohin",
        crowns: 2,
        trophyChange: 30,
        clan: { tag: "#2ABC", name: "Example Clan", badgeId: 16000000 },
        cards: [
          {
            id: 26000000,
            name: "Knight",
            level: 14,
            maxLevel: 14,
            iconUrl: "https://api-assets.clashroyale.com/cards/300/knight.png",
          },
        ],
      },
    ],
    opponent: [
      {
        tag: "#9XYZ",
        name: "Opponent",
        crowns: 1,
        trophyChange: -30,
        cards: [
          {
            id: 26000001,
            name: "Mini P.E.K.K.A",
            level: 14,
            maxLevel: 14,
            evolutionLevel: 2,
            elixirCost: 4,
            rarity: "rare",
            variant: "hero",
            variantIconUrl:
              "https://api-assets.clashroyale.com/cardheroes/300/mini-pekka.png",
          },
        ],
      },
    ],
  });
  assert.equal(route.calls.length, 2);
  assert.deepEqual(route.calls.map(({ url }) => url).sort(), [PLAYER_URL, BATTLELOG_URL]);
  for (const { init } of route.calls) {
    assert.equal(init.headers.Accept, "application/json");
    assert.equal(init.headers.Authorization, "Bearer test-clash-token");
    assert.equal(init.redirect, "manual");
    assert.ok(init.signal instanceof AbortSignal);
  }
  assert.equal(route.pending.length, 1);
  await Promise.all(route.pending);
  assert.equal(route.cache.puts.length, 1);
  assert.equal(route.cache.puts[0].response.headers.get("Cache-Control"), "max-age=300");
});

test("returns an empty deck when the upstream profile omits it", async () => {
  const route = fetchRoute({
    fetchImpl: successFetch([], { tag: "#28CYYU08P", name: "Rohin" }, []),
  });
  const response = await route.run();
  assert.equal(response.status, 200);
  const body = await json(response);
  assert.deepEqual(body.player.currentDeck, []);
  assert.deepEqual(body.battles, []);
});

test("caps battle history at twenty while preserving shorter histories", async () => {
  const battles = Array.from({ length: 25 }, (_, index) => ({
    ...battlelog()[0],
    battleTime: `20261001T${String(index).padStart(2, "0")}0000.000Z`,
  }));
  const capped = await fetchRoute({
    fetchImpl: successFetch([], profile(), battles),
  }).run();
  const cappedBody = await json(capped);

  assert.equal(cappedBody.battles.length, 20);
  assert.equal(cappedBody.battles.at(-1).battleTime, "20261001T190000.000Z");

  const short = await fetchRoute({
    fetchImpl: successFetch([], profile(), battles.slice(0, 3)),
  }).run();
  assert.equal((await json(short)).battles.length, 3);
});

test("normalizes optional card cost, rarity, and equipped variant metadata", async () => {
  const metadataCards = [
    card({
      id: 1,
      name: "Zero Cost",
      elixirCost: 0,
      rarity: " Legendary ",
      evolutionLevel: 1,
      maxEvolutionLevel: 2,
      iconUrls: {
        medium: "https://api-assets.clashroyale.com/cards/300/base.png",
        evolutionMedium:
          "https://api-assets.clashroyale.com/cardevolutions/300/evo.png",
        heroMedium: "https://api-assets.clashroyale.com/cardheroes/300/unused.png",
      },
    }),
    card({
      id: 2,
      name: "Invalid Fractional Cost",
      elixirCost: 2.5,
      rarity: "champion",
      evolutionLevel: 2,
      iconUrls: {
        medium: "https://api-assets.clashroyale.com/cards/300/base.svg",
        evolutionMedium:
          "https://api-assets.clashroyale.com/cardevolutions/300/unused.png",
        heroMedium: "https://api-assets.clashroyale.com/cardheroes/300/hero.png",
      },
    }),
    card({
      id: 3,
      name: "Ambiguous Variant",
      elixirCost: -1,
      rarity: "mythic",
      evolutionLevel: 3,
      iconUrls: {
        medium: "https://api-assets.clashroyale.com/not-a-card/base.png",
        evolutionMedium:
          "https://api-assets.clashroyale.com/cardevolutions/300/ambiguous.png",
        heroMedium:
          "https://api-assets.clashroyale.com/cardheroes/300/ambiguous.png",
      },
    }),
    card({ id: 4, name: "Unknown Cost", elixirCost: null, rarity: null }),
    card({
      id: 5,
      name: "Evo Without Artwork",
      evolutionLevel: 1,
      rarity: "EPIC",
      iconUrls: {
        medium: "https://api-assets.clashroyale.com/cards/300/fallback.png",
        evolutionMedium:
          "https://api-assets.clashroyale.com/cardheroes/300/wrong-variant.png",
      },
    }),
    card({
      id: 28000006,
      name: "Mirror",
      elixirCost: 1,
      rarity: "Epic",
      iconUrls: {
        medium: "https://api-assets.clashroyale.com/cards/300/mirror.png",
      },
    }),
  ];
  const response = await fetchRoute({
    fetchImpl: successFetch([], profile({ currentDeck: metadataCards }), []),
  }).run();
  const cards = (await json(response)).player.currentDeck;

  assert.deepEqual(cards[0], {
    id: 1,
    name: "Zero Cost",
    level: 14,
    maxLevel: 14,
    evolutionLevel: 1,
    elixirCost: 0,
    rarity: "legendary",
    variant: "evo",
    iconUrl: "https://api-assets.clashroyale.com/cards/300/base.png",
    variantIconUrl: "https://api-assets.clashroyale.com/cardevolutions/300/evo.png",
  });
  assert.deepEqual(cards[1], {
    id: 2,
    name: "Invalid Fractional Cost",
    level: 14,
    maxLevel: 14,
    evolutionLevel: 2,
    rarity: "champion",
    variant: "hero",
    variantIconUrl: "https://api-assets.clashroyale.com/cardheroes/300/hero.png",
  });
  assert.deepEqual(cards[2], {
    id: 3,
    name: "Ambiguous Variant",
    level: 14,
    maxLevel: 14,
    evolutionLevel: 3,
  });
  assert.deepEqual(cards[3], {
    id: 4,
    name: "Unknown Cost",
    level: 14,
    maxLevel: 14,
    iconUrl: "https://api-assets.clashroyale.com/cards/300/knight.png",
  });
  assert.deepEqual(cards[4], {
    id: 5,
    name: "Evo Without Artwork",
    level: 14,
    maxLevel: 14,
    evolutionLevel: 1,
    rarity: "epic",
    variant: "evo",
    iconUrl: "https://api-assets.clashroyale.com/cards/300/fallback.png",
  });
  assert.deepEqual(cards[5], {
    id: 28000006,
    name: "Mirror",
    level: 14,
    maxLevel: 14,
    rarity: "epic",
    iconUrl: "https://api-assets.clashroyale.com/cards/300/mirror.png",
  });
});

test("serves a valid successful cache entry and refetches a corrupt one", async () => {
  const cache = new MemoryCache();
  const first = fetchRoute({ cache });
  const firstBody = await json(await first.run());
  await Promise.all(first.pending);

  const hit = fetchRoute({
    cache,
    fetchImpl: async () => {
      throw new Error("cache hit must not fetch");
    },
  });
  assert.deepEqual(await json(await hit.run()), firstBody);

  cache.responses.set(
    "GET https://stats.example.test/clash-royale?schema=2",
    Response.json({ ok: true, player: { tag: "#WRONG" }, battles: [] })
  );
  const missCalls = [];
  const miss = fetchRoute({ cache, fetchImpl: successFetch(missCalls) });
  assert.equal((await json(await miss.run())).player.tag, "#28CYYU08P");
  assert.equal(missCalls.length, 2);

  cache.responses.set(
    "GET https://stats.example.test/clash-royale?schema=2",
    new Response("not-json")
  );
  const invalidJsonCalls = [];
  const invalidJson = fetchRoute({ cache, fetchImpl: successFetch(invalidJsonCalls) });
  assert.equal((await json(await invalidJson.run())).ok, true);
  assert.equal(invalidJsonCalls.length, 2);
});

test("does not serve payloads from the legacy cache schema", async () => {
  const cache = new MemoryCache();
  cache.responses.set(
    "GET https://stats.example.test/clash-royale",
    Response.json({
      ok: true,
      player: { tag: "#28CYYU08P", name: "Legacy", currentDeck: [] },
      battles: Array.from({ length: 10 }, () => battlelog()[0]),
      fetchedAt: new Date(FIXED_NOW).toISOString(),
      cacheTtlSeconds: 300,
    })
  );
  const calls = [];
  const route = fetchRoute({ cache, fetchImpl: successFetch(calls) });

  assert.equal((await json(await route.run())).player.name, "Rohin");
  assert.equal(calls.length, 2);
  await Promise.all(route.pending);
  assert.equal(cache.puts[0].key,
    "GET https://stats.example.test/clash-royale?schema=2");
});

test("ignores Cache API failures without taking the endpoint down", async () => {
  const cache = new MemoryCache();
  cache.matchError = new Error("cache unavailable");
  cache.putError = new Error("cache write unavailable");
  const route = fetchRoute({ cache });

  assert.equal((await json(await route.run())).ok, true);
  await Promise.all(route.pending);

  const noCache = fetchRoute({ cache: null });
  assert.equal((await json(await noCache.run())).ok, true);

  const inlineCache = fetchRoute();
  assert.equal((await json(await inlineCache.runWithoutContext())).ok, true);
  assert.equal(inlineCache.cache.puts.length, 1);
});

test("continues when the runtime Cache API is unavailable", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    get() {
      throw new Error("Cache API unavailable");
    },
  });
  try {
    const calls = [];
    const response = await handleRequest(request(), env(), undefined, {
      clashRoyale: {
        fetchImpl: successFetch(calls),
        now: () => FIXED_NOW,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "caches", descriptor);
    } else {
      delete globalThis.caches;
    }
  }
});

test("requires the configured secret and keeps the route independent of D1", async () => {
  const route = fetchRoute();
  const missing = await route.run(request(), env({ CLASH_ROYALE_API_KEY: "" }));

  assert.equal(missing.status, 503);
  assert.deepEqual(await json(missing), {
    ok: false,
    error: "Clash Royale data is temporarily unavailable",
    code: "CLASH_ROYALE_NOT_CONFIGURED",
  });
  assert.equal(route.calls.length, 0);
  assert.equal((await route.run()).status, 200);
});

test("allows only GET without query options and preserves CORS preflight", async () => {
  const route = fetchRoute();
  const post = await route.run(request("/clash-royale", { method: "POST" }));
  const query = await route.run(request("/clash-royale?tag=%23OTHER"));
  const options = await route.run(
    request("/clash-royale", { method: "OPTIONS" }),
    env({ CLASH_ROYALE_API_KEY: "" })
  );

  assert.equal(post.status, 405);
  assert.equal(query.status, 400);
  assert.match((await json(query)).error, /Query parameters/);
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Access-Control-Allow-Origin"), "https://rohin.shanker.me");
  assert.equal(route.calls.length, 0);
});

test("maps upstream authentication failures without exposing the upstream body", async () => {
  for (const status of [401, 403]) {
    const route = fetchRoute({
      fetchImpl: async (url) =>
        url === PLAYER_URL
          ? new Response("credential details from upstream", { status })
          : Response.json([]),
    });
    const response = await route.run();
    const body = await json(response);

    assert.equal(response.status, 502);
    assert.deepEqual(body, {
      ok: false,
      error: "Clash Royale upstream authentication failed",
      code: "CLASH_ROYALE_UPSTREAM_AUTH",
    });
    assert.doesNotMatch(JSON.stringify(body), /credential details|test-clash-token/);
  }
});

test("rejects upstream redirects without following them", async () => {
  const calls = [];
  const route = fetchRoute({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return url === PLAYER_URL
        ? new Response(null, {
            status: 302,
            headers: { Location: "https://untrusted.example/collect-authorization" },
          })
        : Response.json([]);
    },
  });
  const response = await route.run();

  assert.equal(response.status, 502);
  assert.equal((await json(response)).code, "CLASH_ROYALE_UPSTREAM_ERROR");
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ init }) => init.redirect === "manual"));
  assert.ok(calls.every(({ url }) => url.startsWith(PLAYER_URL)));
});

test("cancels both unread bodies after an upstream status failure", async () => {
  const cancelled = [];
  const responseWithTrackedBody = (status, label) =>
    new Response(
      new ReadableStream({
        pull() {},
        cancel() {
          cancelled.push(label);
          if (label === PLAYER_URL) throw new Error("body already closed");
        },
      }),
      { status }
    );
  const route = fetchRoute({
    fetchImpl: async (url) =>
      responseWithTrackedBody(url === PLAYER_URL ? 401 : 200, url),
  });

  assert.equal((await route.run()).status, 502);
  assert.deepEqual(cancelled.sort(), [PLAYER_URL, BATTLELOG_URL].sort());
});

test("maps rate limits with a bounded Retry-After", async () => {
  for (const [retryAfter, expectedMilliseconds, expectedHeader] of [
    ["2", 2_000, "2"],
    ["9999", 60_000, "60"],
    ["not-a-delay", 30_000, "30"],
    [new Date(FIXED_NOW + 4_000).toUTCString(), 4_000, "4"],
  ]) {
    const route = fetchRoute({
      fetchImpl: async (url) =>
        url === PLAYER_URL
          ? new Response(null, { status: 429, headers: { "Retry-After": retryAfter } })
          : Response.json([]),
    });
    const response = await route.run();
    const body = await json(response);

    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), expectedHeader);
    assert.equal(body.retryAfterMs, expectedMilliseconds);
    assert.equal(body.code, "CLASH_ROYALE_RATE_LIMITED");
  }
});

test("maps timeouts, transport failures, and other upstream statuses", async () => {
  const cases = [
    {
      fetchImpl: async () => {
        throw new DOMException("timed out", "TimeoutError");
      },
      status: 504,
      code: "CLASH_ROYALE_TIMEOUT",
    },
    {
      fetchImpl: async () => {
        throw new Error("network detail");
      },
      status: 502,
      code: "CLASH_ROYALE_UPSTREAM_ERROR",
    },
    {
      fetchImpl: async (url) =>
        url === PLAYER_URL ? new Response("maintenance detail", { status: 503 }) : Response.json([]),
      status: 502,
      code: "CLASH_ROYALE_UPSTREAM_ERROR",
    },
  ];

  for (const expected of cases) {
    const response = await fetchRoute({ fetchImpl: expected.fetchImpl }).run();
    const body = await json(response);
    assert.equal(response.status, expected.status);
    assert.equal(body.code, expected.code);
    assert.doesNotMatch(JSON.stringify(body), /network detail|maintenance detail/);
  }
});

test("maps an abort during upstream body consumption to a timeout", async () => {
  const route = fetchRoute({
    fetchImpl: async (url) => {
      if (url === BATTLELOG_URL) return Response.json([]);
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new DOMException("body timed out", "TimeoutError"));
          },
        })
      );
    },
  });
  const response = await route.run();

  assert.equal(response.status, 504);
  assert.equal((await json(response)).code, "CLASH_ROYALE_TIMEOUT");
});

test("rejects invalid, mismatched, and oversized upstream data", async () => {
  const invalidCases = [
    async (url) =>
      url === PLAYER_URL ? new Response("not-json") : Response.json([]),
    successFetch([], profile({ tag: "#OTHER" })),
    successFetch([], profile({ name: "" })),
    successFetch([], profile({ currentDeck: {} })),
    successFetch([], profile({ currentDeck: [null] })),
    successFetch([], profile({ currentDeck: [card({ id: -1 })] })),
    successFetch([], null),
    successFetch([], profile(), {}),
    successFetch([], profile(), [null]),
    successFetch([], profile(), battlelog({ team: [null] })),
    successFetch([], profile(), battlelog({ opponent: "invalid" })),
    successFetch([], profile(), [{ battleTime: "time", team: [], opponent: [] }]),
    async (url) =>
      url === PLAYER_URL
        ? new Response("{}", { headers: { "Content-Length": String(256 * 1024 + 1) } })
        : Response.json([]),
    async (url) =>
      url === PLAYER_URL
        ? new Response(`{"padding":"${"x".repeat(256 * 1024)}"}`)
        : Response.json([]),
    async (url) =>
      url === PLAYER_URL ? new Response(null) : Response.json([]),
    async (url) =>
      url === PLAYER_URL
        ? new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(256 * 1024 + 1));
              },
              cancel() {
                throw new Error("stream already failed");
              },
            })
          )
        : Response.json([]),
  ];

  for (const fetchImpl of invalidCases) {
    const response = await fetchRoute({ fetchImpl }).run();
    assert.equal(response.status, 502);
    assert.deepEqual(await json(response), {
      ok: false,
      error: "Clash Royale returned invalid data",
      code: "CLASH_ROYALE_INVALID_DATA",
    });
  }
});

test("omits unknown optional values while retaining exact participant tags", async () => {
  const calls = [];
  const route = fetchRoute({
    fetchImpl: successFetch(
      calls,
      profile({ trophies: null, losses: -1, clan: undefined, arena: undefined }),
      battlelog({
        team: [
          participant("#28cyyu08p", "Rohin", undefined, {
            cards: [card({ iconUrls: { medium: "not a URL" } })],
          }),
        ],
        opponent: [participant("#9XYZ", "Opponent", Number.NaN)],
      })
    ),
  });
  const body = await json(await route.run());

  assert.equal(body.player.tag, "#28CYYU08P");
  assert.equal(Object.hasOwn(body.player, "trophies"), false);
  assert.equal(Object.hasOwn(body.player, "losses"), false);
  assert.equal(Object.hasOwn(body.player, "clan"), false);
  assert.equal(Object.hasOwn(body.player, "arena"), false);
  assert.equal(body.battles[0].team[0].tag, "#28CYYU08P");
  assert.equal(Object.hasOwn(body.battles[0].team[0], "crowns"), false);
  assert.equal(Object.hasOwn(body.battles[0].opponent[0], "crowns"), false);
  assert.equal(Object.hasOwn(body.battles[0].team[0].cards[0], "iconUrl"), false);
});
