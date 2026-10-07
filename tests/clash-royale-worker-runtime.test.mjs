import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const workerPackageUrl = new URL("../workers/game-stats/package.json", import.meta.url);
const workerRequire = createRequire(workerPackageUrl);
const miniflareUrl = pathToFileURL(workerRequire.resolve("miniflare"));
const { Miniflare, NoOpLog } = await import(miniflareUrl.href);

// The production entry also imports portable engines from the site's scripts.
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const workerEntrypoint = fileURLToPath(
  new URL("../workers/game-stats/src/index.mjs", import.meta.url)
);
const playerUrl = "https://proxy.royaleapi.dev/v1/players/%2328CYYU08P";
const battlelogUrl = `${playerUrl}/battlelog`;
const syntheticApiKey = "test-runtime-clash-key";

const profile = {
  tag: "#28CYYU08P",
  name: "Runtime Player",
  trophies: 8000,
  currentDeck: [
    {
      id: 26000000,
      name: "Knight",
      level: 14,
      maxLevel: 14,
      elixirCost: 3,
      rarity: "Common",
      evolutionLevel: 1,
      iconUrls: {
        medium: "https://api-assets.clashroyale.com/cards/300/knight.png",
        evolutionMedium:
          "https://api-assets.clashroyale.com/cardevolutions/300/knight.png",
      },
    },
  ],
};
const battles = Array.from({ length: 21 }, (_, index) => ({
  battleTime: `20261001T${String(index).padStart(2, "0")}0000.000Z`,
  team: [{ tag: "#28CYYU08P", name: "Runtime Player", crowns: 1, cards: [] }],
  opponent: [{
    tag: "#9XYZ",
    name: "Opponent",
    crowns: 0,
    cards: [{
      id: 26000018,
      name: "Mini P.E.K.K.A",
      level: 14,
      maxLevel: 14,
      elixirCost: 4,
      rarity: "RARE",
      evolutionLevel: 2,
      iconUrls: {
        medium: "https://api-assets.clashroyale.com/cards/300/mini-pekka.png",
        heroMedium:
          "https://api-assets.clashroyale.com/cardheroes/300/mini-pekka.png",
      },
    }],
  }],
}));

const createRuntime = (outboundService) =>
  new Miniflare({
    modules: true,
    modulesRoot: repositoryRoot,
    scriptPath: workerEntrypoint,
    compatibilityDate: "2026-07-21",
    bindings: {
      ALLOWED_ORIGIN: "https://rohin.shanker.me",
      CLASH_ROYALE_API_KEY: syntheticApiKey,
    },
    cachePersist: false,
    outboundService,
    log: new NoOpLog(),
  });

const dispatch = (runtime) =>
  runtime.dispatchFetch("https://stats.example.test/clash-royale", {
    headers: { Origin: "https://rohin.shanker.me" },
  });

test("workerd executes the real Worker, mocked upstream, and Cache API", async () => {
  const outboundRequests = [];
  const runtime = createRuntime(async (request) => {
    outboundRequests.push({
      url: request.url,
      authorization: request.headers.get("Authorization"),
    });
    if (request.url === playerUrl) return Response.json(profile);
    if (request.url === battlelogUrl) return Response.json(battles);
    return new Response(null, { status: 404 });
  });

  try {
    const first = await dispatch(runtime);
    const firstBody = await first.json();
    assert.equal(first.status, 200);
    assert.equal(firstBody.ok, true);
    assert.equal(firstBody.player.tag, "#28CYYU08P");
    assert.equal(firstBody.cacheTtlSeconds, 300);
    assert.equal(firstBody.battles.length, 20);
    assert.deepEqual(
      {
        elixirCost: firstBody.player.currentDeck[0].elixirCost,
        rarity: firstBody.player.currentDeck[0].rarity,
        variant: firstBody.player.currentDeck[0].variant,
        variantIconUrl: firstBody.player.currentDeck[0].variantIconUrl,
      },
      {
        elixirCost: 3,
        rarity: "common",
        variant: "evo",
        variantIconUrl:
          "https://api-assets.clashroyale.com/cardevolutions/300/knight.png",
      }
    );
    assert.equal(firstBody.battles[0].opponent[0].cards[0].variant, "hero");
    assert.equal(
      first.headers.get("Access-Control-Allow-Origin"),
      "https://rohin.shanker.me"
    );
    assert.deepEqual(
      outboundRequests.map(({ url }) => url).sort(),
      [playerUrl, battlelogUrl].sort()
    );
    assert.deepEqual(
      outboundRequests.map(({ authorization }) => authorization),
      [`Bearer ${syntheticApiKey}`, `Bearer ${syntheticApiKey}`]
    );
    const cache = (await runtime.getCaches()).default;
    let cached;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      cached = await cache.match("https://stats.example.test/clash-royale?schema=2");
      if (cached) break;
      await delay(20);
    }
    assert.ok(cached, "the background cache write must finish within two seconds");
    const second = await dispatch(runtime);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).fetchedAt, firstBody.fetchedAt);
    assert.equal(outboundRequests.length, 2);
  } finally {
    await runtime.dispose();
  }
});

test("workerd returns a clean failure for a mocked upstream redirect", async () => {
  const outboundRequests = [];
  const runtime = createRuntime(async (request) => {
    outboundRequests.push(request.url);
    if (request.url === playerUrl) {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://untrusted.example/collect-authorization" },
      });
    }
    return Response.json([]);
  });

  try {
    const response = await dispatch(runtime);
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.code, "CLASH_ROYALE_UPSTREAM_ERROR");
    assert.equal(outboundRequests.length, 2);
    assert.ok(outboundRequests.every((url) => url.startsWith(playerUrl)));
  } finally {
    await runtime.dispose();
  }
});
