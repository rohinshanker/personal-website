import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMINISTRATOR_PROFILE,
  MAX_REACTIONS_PER_WINDOW,
  MAX_SOCIAL_POST_REACTION_LIST,
  MAX_SOCIAL_POST_REACTIONS,
  SOCIAL_POST_IDS,
} from "../workers/game-stats/src/constants.mjs";
import { hmacDigest } from "../workers/game-stats/src/security.mjs";
import {
  socialClientIp as clientIp,
  createSocialHarness,
  emptySummary,
  socialOrigin as origin,
  reactionsPath,
  readJson,
  socialProfileIcon,
} from "./helpers/social-posts-harness.mjs";

const reactionBody = (registered, reaction) => ({
  profileId: registered.profile.id,
  token: registered.token,
  reaction,
});

test("reads an empty summary for every known post without an Origin", async () => {
  const harness = createSocialHarness();
  for (const id of SOCIAL_POST_IDS) {
    const response = await harness.get(reactionsPath(id));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.deepEqual(await readJson(response), emptySummary(id));
  }
});

test("returns CORS headers on reads from an allowed Origin", async () => {
  const harness = createSocialHarness();
  const response = await harness.get(reactionsPath(), { Origin: origin });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
});

test("rejects unknown posts, query strings, and unsupported methods", async () => {
  const harness = createSocialHarness();
  const kanori = await harness.registerProfile("player-0001", "Kanori");
  const unknown = await harness.get(reactionsPath("lois-post-unknown"));
  assert.equal(unknown.status, 404);
  assert.deepEqual(await readJson(unknown), { ok: false, error: "Unknown post" });

  const unknownPost = await harness.react(kanori, "like", {
    path: reactionsPath("lois-post-unknown"),
  });
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

  const queriedPost = await harness.react(kanori, "like", { path: `${reactionsPath()}?x=1` });
  assert.equal(queriedPost.status, 400);

  const deleted = await harness.request(reactionsPath(), { method: "DELETE" });
  assert.equal(deleted.status, 405);
  assert.deepEqual(await readJson(deleted), { ok: false, error: "Method is not allowed" });
  assert.equal(harness.rows().length, 0);
});

test("answers preflight requests with CORS headers", async () => {
  const harness = createSocialHarness();
  const response = await harness.options();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS");
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type");
});

test("refuses writes without an allowed browser Origin and stores nothing", async () => {
  const harness = createSocialHarness();
  const kanori = await harness.registerProfile("player-0001", "Kanori", { ip: "198.51.100.9" });
  const missing = await harness.react(kanori, "like", { withOrigin: false });
  assert.equal(missing.status, 403);
  assert.deepEqual(await readJson(missing), { ok: false, error: "Origin is not allowed" });
  assert.equal(harness.rows().length, 0);
  assert.equal(
    harness.database.sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM game_stats_rate_limits WHERE bucket LIKE 'reactions:%'",
      )
      .get().count,
    0,
    "A refused origin never reaches the rate limiter.",
  );
});

test("records, switches, and removes one reaction per registered profile", async () => {
  const harness = createSocialHarness();
  const mira = await harness.registerProfile("player-0001", "Mira");
  const liked = await harness.react(mira, "like");
  assert.equal(liked.status, 200);
  assert.deepEqual(await readJson(liked), {
    ...emptySummary(),
    likeCount: 1,
    likes: [mira.profile],
  });
  const [likedRow] = harness.rows();
  assert.equal(likedRow.reaction, "like");
  assert.equal(likedRow.created_at, likedRow.updated_at);

  const switched = await harness.react(mira, "dislike");
  assert.equal(switched.status, 200);
  assert.deepEqual(await readJson(switched), {
    ...emptySummary(),
    dislikeCount: 1,
    dislikes: [mira.profile],
  });
  const rows = harness.rows();
  assert.equal(rows.length, 1, "Switching moves the single row rather than adding one.");
  assert.equal(rows[0].reaction, "dislike");
  assert.equal(rows[0].created_at, likedRow.created_at, "The original created_at survives.");
  assert.ok(rows[0].updated_at >= likedRow.updated_at);

  const repeated = await harness.react(mira, "dislike");
  assert.equal(repeated.status, 200);
  assert.equal(harness.rows().length, 1);

  const ola = await harness.registerProfile("player-0002", "Olaveno");
  await harness.react(ola, "dislike");
  const cleared = await harness.react(mira, null);
  assert.equal(cleared.status, 200);
  const clearedBody = await readJson(cleared);
  assert.deepEqual(clearedBody, {
    ...emptySummary(),
    dislikeCount: 1,
    dislikes: [ola.profile],
  });
  assert.deepEqual(
    harness.rows().map((row) => row.profile_id),
    ["player-0002"],
  );

  const clearedAgain = await harness.react(mira, null);
  assert.equal(clearedAgain.status, 200, "Clearing an absent reaction is idempotent.");
  const read = await harness.get();
  assert.deepEqual(await readJson(read), clearedBody);
});

test("keeps reactions separate per post", async () => {
  const harness = createSocialHarness();
  const mira = await harness.registerProfile("player-0001", "Mira");
  await harness.react(mira, "like");
  const otherPost = await harness.react(mira, "dislike", {
    path: reactionsPath(SOCIAL_POST_IDS[1]),
  });
  assert.deepEqual(await readJson(otherPost), {
    ...emptySummary(SOCIAL_POST_IDS[1]),
    dislikeCount: 1,
    dislikes: [mira.profile],
  });
  assert.deepEqual(await readJson(await harness.get()), {
    ...emptySummary(),
    likeCount: 1,
    likes: [mira.profile],
  });
});

test("shows only server-held names and icons, whatever the client sends later", async () => {
  const harness = createSocialHarness();
  const kanori = await harness.registerProfile("player-0001", "Kanori");
  const liked = await harness.react(kanori, "like");
  assert.equal(liked.status, 200);

  const renamed = await harness.register({
    id: "player-0001",
    name: "Alumo",
    icon: "assets/app-icons/ico/world.ico",
  });
  assert.equal(renamed.status, 409, "A registered id keeps its first name and icon.");
  const relike = await harness.react(kanori, "dislike");
  assert.equal(relike.status, 200);
  assert.deepEqual((await readJson(relike)).dislikes, [
    { id: "player-0001", name: "Kanori", icon: socialProfileIcon },
  ]);
  const [row] = harness.rows();
  assert.equal(row.player_name, "Kanori");
  assert.equal(row.player_icon, socialProfileIcon);
  assert.deepEqual((await readJson(await harness.get())).dislikes, [kanori.profile]);
});

test("rejects malformed reaction requests before writing", async () => {
  const harness = createSocialHarness();
  const kanori = await harness.registerProfile("player-0001", "Kanori");
  const valid = reactionBody(kanori, "like");
  const cases = [
    [{ ...valid, extra: true }, /Unknown reaction request field: extra/],
    [
      { profile: { id: "player-0001", name: "Kanori", icon: socialProfileIcon }, reaction: "like" },
      /Unknown reaction request field: profile/,
    ],
    [{ profileId: valid.profileId, token: valid.token }, /Reaction request requires a reaction/],
    [{ ...valid, reaction: undefined }, /Reaction request requires a reaction/],
    [{ ...valid, reaction: "love" }, /Reaction must be "like", "dislike", or null/],
    [{ ...valid, reaction: 1 }, /Reaction must be/],
    [{ token: valid.token, reaction: "like" }, /Reaction request profileId must be a string/],
    [{ ...valid, profileId: "short" }, /Invalid reaction request profileId/],
    [{ ...valid, profileId: "Player-0001" }, /Invalid reaction request profileId/],
    [{ profileId: valid.profileId, reaction: "like" }, /Reaction request token must be a string/],
    [{ ...valid, token: 7 }, /Reaction request token must be a string/],
    [{ ...valid, token: "" }, /Invalid reaction request token/],
    [{ ...valid, token: "t".repeat(129) }, /Invalid reaction request token/],
    [{ ...valid, administrator: true }, /Administrator reactions do not carry a profile/],
    [
      { administrator: true, token: valid.token, reaction: "like" },
      /Administrator reactions do not carry a profile/,
    ],
    [{ administrator: false, reaction: "like" }, /administrator flag must be true/],
    [{ administrator: "yes", reaction: "like" }, /administrator flag must be true/],
    ["player-0001", /reaction request must be an object/],
    [[], /reaction request must be an object/],
  ];
  for (const [body, pattern] of cases) {
    const response = await harness.post(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.match((await readJson(response)).error, pattern);
  }
  const invalidJson = await harness.request(reactionsPath(), {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(invalidJson.status, 400);
  assert.equal(harness.rows().length, 0);
});

test("authenticates reactions by registered profile and token", async () => {
  const harness = createSocialHarness();
  const kanori = await harness.registerProfile("player-0001", "Kanori");

  const unknown = await harness.post({
    profileId: "player-0002",
    token: kanori.token,
    reaction: "like",
  });
  assert.equal(unknown.status, 404);
  assert.deepEqual(await readJson(unknown), {
    ok: false,
    error: "Unknown profile",
    code: "profile-unknown",
  });

  const wrongToken = await harness.post({
    profileId: "player-0001",
    token: `${kanori.token.slice(0, -1)}${kanori.token.endsWith("A") ? "B" : "A"}`,
    reaction: "like",
  });
  assert.equal(wrongToken.status, 403);
  assert.deepEqual(await readJson(wrongToken), {
    ok: false,
    error: "Profile token is invalid",
    code: "profile-token-invalid",
  });

  const hashAsToken = await harness.post({
    profileId: "player-0001",
    token: harness.profileRow("player-0001").token_hash,
    reaction: "like",
  });
  assert.equal(hashAsToken.status, 403, "The stored hash is not a usable token.");
  assert.equal(harness.rows().length, 0);

  const alumo = await harness.registerProfile("player-0002", "Alumo");
  const borrowed = await harness.post({
    profileId: "player-0002",
    token: kanori.token,
    reaction: "like",
  });
  assert.equal(borrowed.status, 403, "One profile's token does not unlock another.");

  const accepted = await harness.react(alumo, "like");
  assert.equal(accepted.status, 200);
  assert.deepEqual((await readJson(accepted)).likes, [alumo.profile]);

  harness.blockProfile("player-0002");
  const blocked = await harness.react(alumo, "dislike");
  assert.equal(blocked.status, 403);
  assert.deepEqual(await readJson(blocked), {
    ok: false,
    error: "Profile is blocked",
    code: "profile-blocked",
  });
  const blockedWrongToken = await harness.post({
    profileId: "player-0002",
    token: kanori.token,
    reaction: "like",
  });
  assert.equal(
    (await readJson(blockedWrongToken)).code,
    "profile-token-invalid",
    "A bad token is reported before the block.",
  );
  assert.equal(harness.rows()[0].reaction, "like", "The blocked write changed nothing.");
});

test("rate-limits reactions per keyed address hash and never stores a raw IP", async () => {
  const harness = createSocialHarness();
  const kanori = await harness.registerProfile("player-0001", "Kanori");
  for (let attempt = 0; attempt < MAX_REACTIONS_PER_WINDOW; attempt += 1) {
    const response = await harness.react(kanori, "like");
    assert.equal(response.status, 200, `attempt ${attempt + 1}`);
  }
  const limited = await harness.react(kanori, "like");
  assert.equal(limited.status, 429);
  assert.deepEqual(await readJson(limited), {
    ok: false,
    error: "Too many game stats requests",
  });

  const alumo = await harness.registerProfile("player-0002", "Alumo", { ip: "198.51.100.9" });
  const otherAddress = await harness.react(alumo, "like", { ip: "198.51.100.9" });
  assert.equal(otherAddress.status, 200, "The limit is per address, not global.");

  const expectedHash = await hmacDigest(harness.env.IP_HASH_SECRET, clientIp);
  const buckets = harness.database.sqlite
    .prepare("SELECT bucket, request_count FROM game_stats_rate_limits ORDER BY bucket")
    .all();
  const bucket = buckets.find(({ bucket: name }) => name === `reactions:${expectedHash}`);
  assert.ok(bucket, JSON.stringify(buckets));
  assert.equal(bucket.request_count, MAX_REACTIONS_PER_WINDOW + 1);
  const registrations = buckets.find(
    ({ bucket: name }) => name === `social-profiles:${expectedHash}`,
  );
  assert.equal(registrations.request_count, 1, "Registration and reactions use separate buckets.");
  assert.doesNotMatch(JSON.stringify(harness.rows()), /203\.0\.113\.41/);
  assert.equal(harness.rows()[0].ip_hash, expectedHash);
});

test("lets the Administrator react without registering, behind a valid proof", async () => {
  const harness = createSocialHarness();
  const unproved = await harness.post({ administrator: true, reaction: "like" });
  assert.equal(unproved.status, 403);
  assert.deepEqual(await readJson(unproved), {
    ok: false,
    error: "Administrator authorization is invalid",
    code: "administrator-authorization",
  });

  const forged = await harness.post(
    { administrator: true, reaction: "like" },
    { authorization: "Bearer not.a-proof" },
  );
  assert.equal(forged.status, 403);
  assert.equal(harness.rows().length, 0);

  const signIn = await harness.signInAsAdministrator();
  const authorization = `Bearer ${signIn.proof}`;
  const proved = await harness.post({ administrator: true, reaction: "like" }, { authorization });
  assert.equal(proved.status, 200);
  assert.deepEqual((await readJson(proved)).likes, [{ ...ADMINISTRATOR_PROFILE }]);
  assert.equal(harness.profileRow(ADMINISTRATOR_PROFILE.id), undefined);

  const mixed = await harness.post(
    { administrator: true, profileId: ADMINISTRATOR_PROFILE.id, reaction: "like" },
    { authorization },
  );
  assert.equal(mixed.status, 400);

  const cleared = await harness.post({ administrator: true, reaction: null }, { authorization });
  assert.equal(cleared.status, 200, "Clearing also needs and accepts the proof.");
  assert.equal(harness.rows().length, 0);

  const originalNow = Date.now;
  Date.now = () => Date.parse(signIn.expiresAt);
  try {
    const afterExpiry = await harness.post(
      { administrator: true, reaction: "like" },
      { authorization },
    );
    assert.equal(afterExpiry.status, 403);
  } finally {
    Date.now = originalNow;
  }
});

test("refuses new profiles once a post is full while existing ones may still change", async () => {
  const harness = createSocialHarness();
  for (let index = 0; index < MAX_SOCIAL_POST_REACTIONS; index += 1) {
    harness.insertRow({
      id: `player-seed-${String(index).padStart(4, "0")}`,
      reaction: index % 2 ? "dislike" : "like",
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    });
  }
  const newcomer = await harness.registerProfile("player-newcomer", "Nirova");
  const full = await harness.react(newcomer, "like");
  assert.equal(full.status, 409);
  assert.deepEqual(await readJson(full), {
    ok: false,
    error: "This post has reached its reaction limit",
    code: "post-full",
  });
  assert.equal(harness.rows().length, MAX_SOCIAL_POST_REACTIONS);

  const existing = await harness.registerProfile("player-seed-0000", "Sezuko");
  const switched = await harness.react(existing, "dislike");
  assert.equal(switched.status, 200);
  const body = await readJson(switched);
  assert.equal(body.likeCount, MAX_SOCIAL_POST_REACTIONS / 2 - 1);
  assert.equal(body.dislikeCount, MAX_SOCIAL_POST_REACTIONS / 2 + 1);
  assert.equal(body.likes.length, MAX_SOCIAL_POST_REACTION_LIST);
  const switchedRow = harness.rows().find((row) => row.profile_id === "player-seed-0000");
  assert.equal(switchedRow.player_name, "Sezuko", "The switch adopts the registered name.");

  const otherPost = await harness.react(newcomer, "like", {
    path: reactionsPath(SOCIAL_POST_IDS[1]),
  });
  assert.equal(otherPost.status, 200, "The cap is per post.");

  const removed = await harness.react(existing, null);
  assert.equal(removed.status, 200);
  const admitted = await harness.react(newcomer, "like");
  assert.equal(admitted.status, 200, "A freed slot admits a new profile.");
});

test("caps each list at the most recent entries while counts stay total", async () => {
  const harness = createSocialHarness();
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
      icon: socialProfileIcon,
    },
  ]);
});

test("the schema rejects unknown reactions and duplicate profiles per post", () => {
  const harness = createSocialHarness();
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
  assert.throws(
    () =>
      harness.database.sqlite
        .prepare(
          `INSERT INTO social_profiles (profile_id, player_name, player_icon, token_hash, ip_hash, created_at)
           VALUES ('player-0003', 'Kanori', ?, 'hash', 'ip', '2026-01-01T00:00:00.000Z')`,
        )
        .run(socialProfileIcon).changes === 1 &&
      harness.database.sqlite
        .prepare(
          `INSERT INTO social_profiles (profile_id, player_name, player_icon, token_hash, ip_hash, created_at)
           VALUES ('player-0003', 'Alumo', ?, 'hash2', 'ip', '2026-01-01T00:00:00.000Z')`,
        )
        .run(socialProfileIcon),
    /UNIQUE constraint failed: social_profiles\.profile_id/,
  );
});
