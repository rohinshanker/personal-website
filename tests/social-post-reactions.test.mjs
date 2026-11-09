import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMINISTRATOR_PROFILE,
  MAX_REACTIONS_PER_WINDOW,
  MAX_SOCIAL_POST_REACTION_LIST,
  MAX_SOCIAL_POST_REACTIONS,
  SOCIAL_POST_IDS,
} from "../workers/game-stats/src/constants.mjs";
import { handleRequest } from "../workers/game-stats/src/router.mjs";
import { hmacDigest } from "../workers/game-stats/src/security.mjs";
import { applyGameStatsMigrations, SqliteD1Database } from "./helpers/sqlite-d1.mjs";

const migrationPaths = [
  "0001_create_game_stats.sql",
  "0002_add_game_stat_security.sql",
  "0003_add_sudoku_puzzle_identity.sql",
  "0004_optimize_stats_aggregation.sql",
  "0005_add_verified_game_results.sql",
  "0006_add_social_post_reactions.sql",
].map((name) => new URL(`../workers/game-stats/migrations/${name}`, import.meta.url).pathname);

const origin = "https://rohin.shanker.me";
const buildVersion = `sha256-${"a".repeat(64)}`;
const postId = SOCIAL_POST_IDS[0];
const reactionsPath = (id = postId) => `/social-posts/${id}/reactions`;
const clientIp = "203.0.113.41";

const createEnv = (database, overrides = {}) => ({
  personal_site_game_stats: database,
  ALLOWED_ORIGIN: origin,
  EVENT_SIGNING_SECRET: "test-reaction-signing-secret",
  IP_HASH_SECRET: "test-reaction-ip-secret",
  ADMIN_USERNAME: "test-administrator",
  ADMIN_PASSWORD: "test-administrator-password",
  ADMIN_SESSION_SIGNING_SECRET: "test-administrator-session-signing-secret",
  GAME_BUILD_VERSION: buildVersion,
  ...overrides,
});

const createHarness = () => {
  const database = new SqliteD1Database();
  applyGameStatsMigrations(database, migrationPaths);
  const env = createEnv(database);
  const dispatch = (request) => handleRequest(request, env, undefined, {});
  return {
    database,
    env,
    get(path = reactionsPath(), headers = {}) {
      return dispatch(new Request(`https://stats.example.test${path}`, { headers }));
    },
    post(
      body,
      { path = reactionsPath(), ip = clientIp, withOrigin = true, authorization = "" } = {},
    ) {
      return dispatch(
        new Request(`https://stats.example.test${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(withOrigin ? { Origin: origin } : {}),
            "CF-Connecting-IP": ip,
            ...(authorization ? { Authorization: authorization } : {}),
          },
          body: JSON.stringify(body),
        }),
      );
    },
    options(path = reactionsPath()) {
      return dispatch(
        new Request(`https://stats.example.test${path}`, {
          method: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
          },
        }),
      );
    },
    rows(id = postId) {
      return database.sqlite
        .prepare(
          "SELECT * FROM social_post_reactions WHERE post_id = ? ORDER BY created_at, profile_id",
        )
        .all(id);
    },
    insertRow({ id, reaction = "like", createdAt, postId: rowPostId = postId }) {
      database.sqlite
        .prepare(
          `INSERT INTO social_post_reactions (
             post_id, profile_id, player_name, player_icon, reaction, ip_hash, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'seeded-hash', ?, ?)`,
        )
        .run(rowPostId, id, `Player ${id}`, profile(id).icon, reaction, createdAt, createdAt);
    },
  };
};

const profile = (id, name = `Player ${id}`) => ({
  id,
  name,
  icon: "assets/app-icons/ico/user_card.ico",
});

const readJson = async (response) => JSON.parse(await response.text());

const emptySummary = (id = postId) => ({
  ok: true,
  postId: id,
  likeCount: 0,
  dislikeCount: 0,
  likes: [],
  dislikes: [],
});

const signInAsAdministrator = async (harness) => {
  const response = await harness.post(
    { username: harness.env.ADMIN_USERNAME, password: harness.env.ADMIN_PASSWORD },
    { path: "/administrator/sign-in" },
  );
  assert.equal(response.status, 200);
  return readJson(response);
};

test("reads an empty summary for every known post without an Origin", async () => {
  const harness = createHarness();
  for (const id of SOCIAL_POST_IDS) {
    const response = await harness.get(reactionsPath(id));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.deepEqual(await readJson(response), emptySummary(id));
  }
});

test("returns CORS headers on reads from an allowed Origin", async () => {
  const harness = createHarness();
  const response = await harness.get(reactionsPath(), { Origin: origin });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});

test("rejects unknown posts, query strings, and unsupported methods", async () => {
  const harness = createHarness();
  const unknown = await harness.get(reactionsPath("lois-post-unknown"));
  assert.equal(unknown.status, 404);
  assert.deepEqual(await readJson(unknown), { ok: false, error: "Unknown post" });

  const unknownPost = await harness.post(
    { profile: profile("player-0001"), reaction: "like" },
    { path: reactionsPath("lois-post-unknown") },
  );
  assert.equal(unknownPost.status, 404);

  const malformed = await harness.get("/social-posts/Not%20Valid/reactions");
  assert.equal(malformed.status, 404);
  assert.deepEqual(await readJson(malformed), { ok: false, error: "Route not found" });

  const queried = await harness.get(`${reactionsPath()}?fresh=1`);
  assert.equal(queried.status, 400);
  assert.deepEqual(await readJson(queried), {
    ok: false,
    error: "Query parameters are not supported",
  });

  const queriedPost = await harness.post(
    { profile: profile("player-0001"), reaction: "like" },
    { path: `${reactionsPath()}?x=1` },
  );
  assert.equal(queriedPost.status, 400);

  const deleted = await handleRequest(
    new Request(`https://stats.example.test${reactionsPath()}`, { method: "DELETE" }),
    harness.env,
    undefined,
    {},
  );
  assert.equal(deleted.status, 405);
  assert.deepEqual(await readJson(deleted), { ok: false, error: "Method is not allowed" });
  assert.equal(harness.rows().length, 0);
});

test("answers preflight requests with CORS headers", async () => {
  const harness = createHarness();
  const response = await harness.options();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS");
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type");
});

test("refuses writes without an allowed browser Origin and stores nothing", async () => {
  const harness = createHarness();
  const missing = await harness.post(
    { profile: profile("player-0001"), reaction: "like" },
    { withOrigin: false },
  );
  assert.equal(missing.status, 403);
  assert.deepEqual(await readJson(missing), { ok: false, error: "Origin is not allowed" });
  assert.equal(harness.rows().length, 0);
  assert.equal(
    harness.database.sqlite.prepare("SELECT COUNT(*) AS count FROM game_stats_rate_limits").get()
      .count,
    0,
    "A refused origin never reaches the rate limiter.",
  );
});

test("records, switches, and removes one reaction per profile", async () => {
  const harness = createHarness();
  const mira = profile("player-0001", "Mira");
  const liked = await harness.post({ profile: mira, reaction: "like" });
  assert.equal(liked.status, 200);
  assert.deepEqual(await readJson(liked), {
    ...emptySummary(),
    likeCount: 1,
    likes: [mira],
  });
  const [likedRow] = harness.rows();
  assert.equal(likedRow.reaction, "like");
  assert.equal(likedRow.created_at, likedRow.updated_at);

  const renamed = { ...mira, name: "Mira Two", icon: "assets/app-icons/ico/world.ico" };
  const switched = await harness.post({ profile: renamed, reaction: "dislike" });
  assert.equal(switched.status, 200);
  assert.deepEqual(await readJson(switched), {
    ...emptySummary(),
    dislikeCount: 1,
    dislikes: [renamed],
  });
  const rows = harness.rows();
  assert.equal(rows.length, 1, "Switching moves the single row rather than adding one.");
  assert.equal(rows[0].reaction, "dislike");
  assert.equal(rows[0].player_name, "Mira Two");
  assert.equal(rows[0].player_icon, "assets/app-icons/ico/world.ico");
  assert.equal(rows[0].created_at, likedRow.created_at, "The original created_at survives.");
  assert.ok(rows[0].updated_at >= likedRow.updated_at);

  const repeated = await harness.post({ profile: renamed, reaction: "dislike" });
  assert.equal(repeated.status, 200);
  assert.equal(harness.rows().length, 1);

  const other = profile("player-0002", "Ola");
  await harness.post({ profile: other, reaction: "dislike" });
  const cleared = await harness.post({ profile: renamed, reaction: null });
  assert.equal(cleared.status, 200);
  const clearedBody = await readJson(cleared);
  assert.deepEqual(clearedBody, {
    ...emptySummary(),
    dislikeCount: 1,
    dislikes: [other],
  });
  assert.deepEqual(
    harness.rows().map((row) => row.profile_id),
    ["player-0002"],
  );

  const clearedAgain = await harness.post({ profile: renamed, reaction: null });
  assert.equal(clearedAgain.status, 200, "Clearing an absent reaction is idempotent.");
  const read = await harness.get();
  assert.deepEqual(await readJson(read), clearedBody);
});

test("keeps reactions separate per post", async () => {
  const harness = createHarness();
  const mira = profile("player-0001", "Mira");
  await harness.post({ profile: mira, reaction: "like" });
  const otherPost = await harness.post(
    { profile: mira, reaction: "dislike" },
    { path: reactionsPath(SOCIAL_POST_IDS[1]) },
  );
  assert.deepEqual(await readJson(otherPost), {
    ...emptySummary(SOCIAL_POST_IDS[1]),
    dislikeCount: 1,
    dislikes: [mira],
  });
  assert.deepEqual(await readJson(await harness.get()), {
    ...emptySummary(),
    likeCount: 1,
    likes: [mira],
  });
});

test("rejects malformed reaction requests before writing", async () => {
  const harness = createHarness();
  const valid = profile("player-0001");
  const cases = [
    [{ profile: valid, reaction: "like", extra: true }, /Unknown reaction request field: extra/],
    [{ profile: valid }, /Reaction request requires a reaction/],
    [{ reaction: "like" }, /Reaction request requires a profile/],
    [{ profile: null, reaction: "like" }, /Reaction request requires a profile/],
    [{ profile: valid, reaction: "love" }, /Reaction must be "like", "dislike", or null/],
    [{ profile: valid, reaction: undefined }, /Reaction request requires a reaction/],
    [{ profile: valid, reaction: 1 }, /Reaction must be/],
    [{ profile: { ...valid, extra: 1 }, reaction: "like" }, /Unknown profile field: extra/],
    [
      { profile: { ...valid, name: 7 }, reaction: "like" },
      /Reaction profile name must be a string/,
    ],
    [{ profile: { ...valid, name: "   " }, reaction: "like" }, /Invalid reaction profile/],
    [{ profile: { ...valid, id: "short" }, reaction: "like" }, /Invalid reaction profile/],
    [{ profile: { ...valid, id: "Player-0001" }, reaction: "like" }, /Invalid reaction profile/],
    [{ profile: { ...valid, icon: "https://evil.example/x.ico" }, reaction: "like" }, /Invalid/],
    [{ profile: { ...valid, icon: "assets/app-icons/ico/../x.ico" }, reaction: "like" }, /Invalid/],
    [{ profile: "player-0001", reaction: "like" }, /profile must be an object/],
    [[], /reaction request must be an object/],
  ];
  for (const [body, pattern] of cases) {
    const response = await harness.post(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.match((await readJson(response)).error, pattern);
  }
  const invalidJson = await handleRequest(
    new Request(`https://stats.example.test${reactionsPath()}`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: "{",
    }),
    harness.env,
    undefined,
    {},
  );
  assert.equal(invalidJson.status, 400);
  assert.equal(harness.rows().length, 0);
});

test("trims names to 32 characters and accepts the neko avatar icon", async () => {
  const harness = createHarness();
  const response = await harness.post({
    profile: {
      id: "  player-0001  ",
      name: `  ${"n".repeat(40)}  `,
      icon: " assets/neko-assets/sprites/yawn1.png ",
    },
    reaction: "like",
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await readJson(response)).likes, [
    { id: "player-0001", name: "n".repeat(32), icon: "assets/neko-assets/sprites/yawn1.png" },
  ]);
});

test("rate-limits reactions per keyed address hash and never stores a raw IP", async () => {
  const harness = createHarness();
  const body = { profile: profile("player-0001"), reaction: "like" };
  for (let attempt = 0; attempt < MAX_REACTIONS_PER_WINDOW; attempt += 1) {
    const response = await harness.post(body);
    assert.equal(response.status, 200, `attempt ${attempt + 1}`);
  }
  const limited = await harness.post(body);
  assert.equal(limited.status, 429);
  assert.deepEqual(await readJson(limited), {
    ok: false,
    error: "Too many game stats requests",
  });

  const otherAddress = await harness.post(
    { profile: profile("player-0002"), reaction: "like" },
    { ip: "198.51.100.9" },
  );
  assert.equal(otherAddress.status, 200, "The limit is per address, not global.");

  const expectedHash = await hmacDigest(harness.env.IP_HASH_SECRET, clientIp);
  const buckets = harness.database.sqlite
    .prepare("SELECT bucket, request_count FROM game_stats_rate_limits ORDER BY bucket")
    .all();
  const bucket = buckets.find(({ bucket: name }) => name === `reactions:${expectedHash}`);
  assert.ok(bucket, JSON.stringify(buckets));
  assert.equal(bucket.request_count, MAX_REACTIONS_PER_WINDOW + 1);
  const serialized = JSON.stringify(harness.rows());
  assert.doesNotMatch(serialized, /203\.0\.113\.41/);
  assert.equal(harness.rows()[0].ip_hash, expectedHash);
});

test("protects the Administrator identity behind a valid proof", async () => {
  const harness = createHarness();
  const administrator = { ...ADMINISTRATOR_PROFILE };

  const unproved = await harness.post({ profile: administrator, reaction: "like" });
  assert.equal(unproved.status, 403);
  assert.deepEqual(await readJson(unproved), {
    ok: false,
    error: "Administrator authorization is invalid",
    code: "administrator-authorization",
  });

  const borrowedName = await harness.post({
    profile: profile("player-0001", ADMINISTRATOR_PROFILE.name),
    reaction: "like",
  });
  assert.equal(borrowedName.status, 403);
  assert.deepEqual(await readJson(borrowedName), {
    ok: false,
    error: "Administrator profile is invalid",
    code: "administrator-authorization",
  });

  const borrowedId = await harness.post({
    profile: { ...administrator, name: "someone else" },
    reaction: "like",
  });
  assert.equal(borrowedId.status, 403);
  assert.equal((await readJson(borrowedId)).error, "Administrator profile is invalid");

  const forged = await harness.post(
    { profile: administrator, reaction: "like" },
    { authorization: "Bearer not.a-proof" },
  );
  assert.equal(forged.status, 403);
  assert.equal(harness.rows().length, 0);

  const signIn = await signInAsAdministrator(harness);
  const proved = await harness.post(
    { profile: administrator, reaction: "like" },
    { authorization: `Bearer ${signIn.proof}` },
  );
  assert.equal(proved.status, 200);
  assert.deepEqual((await readJson(proved)).likes, [administrator]);

  const wrongIcon = await harness.post(
    { profile: { ...administrator, icon: "assets/app-icons/ico/user_card.ico" }, reaction: "like" },
    { authorization: `Bearer ${signIn.proof}` },
  );
  assert.equal(wrongIcon.status, 403);

  const expired = await harness.post(
    { profile: administrator, reaction: null },
    {
      authorization: `Bearer ${signIn.proof}`,
    },
  );
  assert.equal(expired.status, 200, "Clearing also needs and accepts the proof.");
  assert.equal(harness.rows().length, 0);

  const originalNow = Date.now;
  Date.now = () => Date.parse(signIn.expiresAt);
  try {
    const afterExpiry = await harness.post(
      { profile: administrator, reaction: "like" },
      { authorization: `Bearer ${signIn.proof}` },
    );
    assert.equal(afterExpiry.status, 403);
  } finally {
    Date.now = originalNow;
  }
});

test("refuses new profiles once a post is full while existing ones may still change", async () => {
  const harness = createHarness();
  for (let index = 0; index < MAX_SOCIAL_POST_REACTIONS; index += 1) {
    harness.insertRow({
      id: `player-seed-${String(index).padStart(4, "0")}`,
      reaction: index % 2 ? "dislike" : "like",
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    });
  }
  const full = await harness.post({ profile: profile("player-newcomer"), reaction: "like" });
  assert.equal(full.status, 409);
  assert.deepEqual(await readJson(full), {
    ok: false,
    error: "This post has reached its reaction limit",
    code: "post-full",
  });
  assert.equal(harness.rows().length, MAX_SOCIAL_POST_REACTIONS);

  const existing = profile("player-seed-0000", "Seed Zero");
  const switched = await harness.post({ profile: existing, reaction: "dislike" });
  assert.equal(switched.status, 200);
  const body = await readJson(switched);
  assert.equal(body.likeCount, MAX_SOCIAL_POST_REACTIONS / 2 - 1);
  assert.equal(body.dislikeCount, MAX_SOCIAL_POST_REACTIONS / 2 + 1);
  assert.equal(body.likes.length, MAX_SOCIAL_POST_REACTION_LIST);

  const otherPost = await harness.post(
    { profile: profile("player-newcomer"), reaction: "like" },
    { path: reactionsPath(SOCIAL_POST_IDS[1]) },
  );
  assert.equal(otherPost.status, 200, "The cap is per post.");

  const removed = await harness.post({ profile: existing, reaction: null });
  assert.equal(removed.status, 200);
  const admitted = await harness.post({ profile: profile("player-newcomer"), reaction: "like" });
  assert.equal(admitted.status, 200, "A freed slot admits a new profile.");
});

test("caps each list at the most recent entries while counts stay total", async () => {
  const harness = createHarness();
  const total = MAX_SOCIAL_POST_REACTION_LIST + 50;
  for (let index = 0; index < total; index += 1) {
    harness.insertRow({
      id: `player-like-${String(index).padStart(4, "0")}`,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    });
  }
  harness.insertRow({
    id: "player-dislike-0000",
    reaction: "dislike",
    createdAt: new Date(Date.UTC(2026, 0, 2)).toISOString(),
  });
  const response = await harness.get();
  const body = await readJson(response);
  assert.equal(body.likeCount, total);
  assert.equal(body.dislikeCount, 1);
  assert.equal(body.likes.length, MAX_SOCIAL_POST_REACTION_LIST);
  assert.equal(body.likes[0].id, "player-like-0050", "The oldest 50 fall off the list.");
  assert.equal(body.likes.at(-1).id, `player-like-${String(total - 1).padStart(4, "0")}`);
  assert.deepEqual(
    body.likes.map(({ id }) => id),
    [...body.likes.map(({ id }) => id)].sort(),
    "Lists are ordered by created_at ascending.",
  );
  assert.deepEqual(body.dislikes, [
    {
      id: "player-dislike-0000",
      name: "Player player-dislike-0000",
      icon: "assets/app-icons/ico/user_card.ico",
    },
  ]);
});

test("the schema rejects unknown reactions and duplicate profiles per post", () => {
  const harness = createHarness();
  harness.insertRow({ id: "player-0001", createdAt: "2026-01-01T00:00:00.000Z" });
  assert.throws(
    () => harness.insertRow({ id: "player-0001", createdAt: "2026-01-01T00:00:01.000Z" }),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () =>
      harness.insertRow({
        id: "player-0002",
        reaction: "love",
        createdAt: "2026-01-01T00:00:02.000Z",
      }),
    /CHECK constraint failed/,
  );
});
