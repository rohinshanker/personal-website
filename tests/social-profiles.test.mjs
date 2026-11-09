import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMINISTRATOR_PROFILE,
  MAX_SOCIAL_PROFILE_REGISTRATIONS_PER_WINDOW,
  SOCIAL_PROFILE_NAME_BLOCKLIST,
} from "../workers/game-stats/src/constants.mjs";
import { hmacDigest, sha256Digest } from "../workers/game-stats/src/security.mjs";
import {
  isBlockedProfileName,
  isSkyGeneratedName,
} from "../workers/game-stats/src/social-profile-names.mjs";
import {
  createSocialHarness,
  emptySummary,
  moderationPath,
  profilesPath,
  readJson,
  socialClientIp,
  socialProfileIcon,
} from "./helpers/social-posts-harness.mjs";

const titleCase = (word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
const registration = (id = "player-0001", name = "Kanori", icon = socialProfileIcon) => ({
  id,
  name,
  icon,
});
const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/;

test("accepts exactly the names the Sky generator grammar can produce", () => {
  for (const name of ["Kanori", "Alumo", "Bexu", "Ukonazi", "Rozimeka", "Mira", "Rohin"]) {
    assert.equal(isSkyGeneratedName(name), true, name);
  }
  const invalid = [
    "Bob",
    "Ab",
    "Kanorixyz",
    "Kan ori",
    "KANORI",
    "kanori",
    "Kannori",
    "Aeiou",
    "Rohin ^.^",
    "Kan0ri",
    "Kanorí",
    "Kanori ",
    " Kanori",
    "Kyla",
    "",
    7,
    null,
    undefined,
    ["Kanori"],
  ];
  for (const name of invalid) {
    assert.equal(isSkyGeneratedName(name), false, JSON.stringify(name));
  }
});

test("rejects every blocklisted word even though the grammar could spell it", () => {
  assert.ok(SOCIAL_PROFILE_NAME_BLOCKLIST.length > 0);
  for (const word of SOCIAL_PROFILE_NAME_BLOCKLIST) {
    assert.equal(word, word.toLowerCase(), "Blocklist entries are stored lowercase.");
    assert.equal(isBlockedProfileName(titleCase(word)), true, word);
    assert.equal(isSkyGeneratedName(titleCase(word)), false, word);
  }
  assert.equal(isBlockedProfileName("Kanori"), false);
});

test("registers a profile once and returns its token exactly once", async () => {
  const harness = createSocialHarness();
  const response = await harness.register(registration());
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await readJson(response);
  assert.deepEqual(Object.keys(body).sort(), ["ok", "profile", "token"]);
  assert.equal(body.ok, true);
  assert.deepEqual(body.profile, registration());
  assert.match(body.token, BASE64URL_43);

  const row = harness.profileRow("player-0001");
  assert.equal(row.player_name, "Kanori");
  assert.equal(row.player_icon, socialProfileIcon);
  assert.notEqual(row.token_hash, body.token, "The token is never stored in plaintext.");
  assert.match(row.token_hash, BASE64URL_43);
  assert.equal(row.token_hash, await sha256Digest(body.token));
  assert.equal(row.ip_hash, await hmacDigest(harness.env.IP_HASH_SECRET, socialClientIp));
  assert.doesNotMatch(JSON.stringify(row), /203\.0\.113\.41/);
  assert.equal(new Date(row.created_at).toISOString(), row.created_at);
  assert.equal(row.blocked_at, null);

  const duplicate = await harness.register(registration("player-0001", "Alumo"));
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await readJson(duplicate), {
    ok: false,
    error: "This profile id is already registered",
    code: "profile-registered",
  });
  assert.equal(harness.profileRow("player-0001").player_name, "Kanori");
  assert.equal(harness.profileRow("player-0001").token_hash, row.token_hash);

  const second = await harness.register(registration("player-0002", "Alumo"));
  assert.equal(second.status, 201);
  assert.notEqual((await readJson(second)).token, body.token);
});

test("rejects names outside the grammar, bad icons and ids, and unknown fields", async () => {
  const harness = createSocialHarness();
  const nameCases = ["Bob", "KANORI", "kanori", "Kannori", "Kan ori", "Tester", "Penis", "Nazi"];
  for (const name of nameCases) {
    const response = await harness.register(registration("player-0001", name));
    assert.equal(response.status, 400, name);
    assert.deepEqual(await readJson(response), {
      ok: false,
      error: "Profile registration name must be a generated name",
      code: "profile-name-invalid",
    });
  }
  const cases = [
    [{ ...registration(), extra: true }, /Unknown profile registration field: extra/],
    [{ id: "player-0001", name: "Kanori" }, /Profile registration icon must be a string/],
    [{ ...registration(), name: 7 }, /Profile registration name must be a string/],
    [{ ...registration(), id: "short" }, /Invalid profile registration id/],
    [{ ...registration(), id: "Player-0001" }, /Invalid profile registration id/],
    [{ ...registration(), id: " player-0001" }, /Invalid profile registration id/],
    [
      { ...registration(), icon: "https://evil.example/x.ico" },
      /Invalid profile registration icon/,
    ],
    [
      { ...registration(), icon: "assets/app-icons/ico/../x.ico" },
      /Invalid profile registration icon/,
    ],
    ["player-0001", /profile registration must be an object/],
    [[], /profile registration must be an object/],
  ];
  for (const [body, pattern] of cases) {
    const response = await harness.register(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.match((await readJson(response)).error, pattern);
  }
  const queried = await harness.register(registration(), { path: `${profilesPath}?x=1` });
  assert.equal(queried.status, 400);
  assert.equal(harness.profileRow("player-0001"), undefined);
  assert.equal(
    harness.database.sqlite.prepare("SELECT COUNT(*) AS count FROM game_stats_rate_limits").get()
      .count,
    0,
    "Malformed registrations never reach the rate limiter.",
  );
});

test("refuses the Administrator identity, a missing Origin, and other methods", async () => {
  const harness = createSocialHarness();
  const expected = {
    ok: false,
    error: "The Administrator profile cannot be registered",
    code: "administrator-authorization",
  };
  const byId = await harness.register(registration(ADMINISTRATOR_PROFILE.id, "Kanori"));
  assert.equal(byId.status, 403);
  assert.deepEqual(await readJson(byId), expected);
  for (const name of [ADMINISTRATOR_PROFILE.name, "Rohin ^.^", " rohin ^.^ "]) {
    const byName = await harness.register(registration("player-0001", name));
    assert.equal(byName.status, 403, name);
    assert.deepEqual(await readJson(byName), expected);
  }
  const neko = await harness.register(
    registration("player-0001", "Kanori", ADMINISTRATOR_PROFILE.icon),
  );
  assert.equal(neko.status, 201, "The neko avatar icon alone is an ordinary allowed icon.");

  const missingOrigin = await harness.register(registration("player-0002"), { withOrigin: false });
  assert.equal(missingOrigin.status, 403);
  assert.deepEqual(await readJson(missingOrigin), { ok: false, error: "Origin is not allowed" });
  assert.equal(harness.profileRow("player-0002"), undefined);

  const read = await harness.get(profilesPath);
  assert.equal(read.status, 405);
  assert.deepEqual(await readJson(read), { ok: false, error: "Method is not allowed" });
  assert.equal(harness.profileRow(ADMINISTRATOR_PROFILE.id), undefined);
});

test("rate-limits registrations per keyed address hash", async () => {
  const harness = createSocialHarness();
  for (let attempt = 0; attempt < MAX_SOCIAL_PROFILE_REGISTRATIONS_PER_WINDOW; attempt += 1) {
    const response = await harness.register(
      registration(`player-${String(attempt).padStart(4, "0")}`),
    );
    assert.equal(response.status, 201, `attempt ${attempt + 1}`);
  }
  const limited = await harness.register(registration("player-limited"));
  assert.equal(limited.status, 429);
  assert.deepEqual(await readJson(limited), { ok: false, error: "Too many game stats requests" });
  assert.equal(harness.profileRow("player-limited"), undefined);

  const otherAddress = await harness.register(registration("player-other"), {
    ip: "198.51.100.9",
  });
  assert.equal(otherAddress.status, 201, "The limit is per address, not global.");

  const expectedHash = await hmacDigest(harness.env.IP_HASH_SECRET, socialClientIp);
  const bucket = harness.database.sqlite
    .prepare("SELECT request_count FROM game_stats_rate_limits WHERE bucket = ?")
    .get(`social-profiles:${expectedHash}`);
  assert.equal(bucket.request_count, MAX_SOCIAL_PROFILE_REGISTRATIONS_PER_WINDOW + 1);
});

test("moderation removes or blocks a profile only with an Administrator proof", async () => {
  const harness = createSocialHarness();
  const kanori = await harness.registerProfile("player-0001", "Kanori");
  const alumo = await harness.registerProfile("player-0002", "Alumo");
  assert.equal((await harness.react(kanori, "like")).status, 200);
  assert.equal(
    (
      await harness.react(kanori, "dislike", {
        path: "/social-posts/lois-post-five-oclock/reactions",
      })
    ).status,
    200,
  );
  assert.equal((await harness.react(alumo, "like")).status, 200);

  const unproved = await harness.post(
    { profileId: "player-0001", action: "remove" },
    { path: moderationPath },
  );
  assert.equal(unproved.status, 403);
  assert.deepEqual(await readJson(unproved), {
    ok: false,
    error: "Administrator authorization is invalid",
    code: "administrator-authorization",
  });
  const forged = await harness.post(
    { profileId: "player-0001", action: "remove" },
    { path: moderationPath, authorization: "Bearer not.a-proof" },
  );
  assert.equal(forged.status, 403);
  assert.equal(harness.allReactionRows().length, 3);

  const signIn = await harness.signInAsAdministrator();
  const authorization = `Bearer ${signIn.proof}`;
  const missingOrigin = await harness.post(
    { profileId: "player-0001", action: "remove" },
    { path: moderationPath, authorization, withOrigin: false },
  );
  assert.equal(missingOrigin.status, 403);
  assert.deepEqual(await readJson(missingOrigin), { ok: false, error: "Origin is not allowed" });

  const removed = await harness.post(
    { profileId: "player-0001", action: "remove" },
    { path: moderationPath, authorization },
  );
  assert.equal(removed.status, 200);
  assert.deepEqual(await readJson(removed), {
    ok: true,
    profileId: "player-0001",
    action: "remove",
    removedReactions: 2,
    blocked: false,
  });
  assert.deepEqual(
    harness.allReactionRows().map((row) => row.profile_id),
    ["player-0002"],
  );
  assert.equal(harness.profileRow("player-0001").blocked_at, null);
  assert.equal(
    (await harness.react(kanori, "like")).status,
    200,
    "A removed profile may react again.",
  );

  const blocked = await harness.post(
    { profileId: "player-0001", action: "block" },
    { path: moderationPath, authorization },
  );
  assert.equal(blocked.status, 200);
  assert.deepEqual(await readJson(blocked), {
    ok: true,
    profileId: "player-0001",
    action: "block",
    removedReactions: 1,
    blocked: true,
  });
  const blockedAt = harness.profileRow("player-0001").blocked_at;
  assert.equal(new Date(blockedAt).toISOString(), blockedAt);
  assert.deepEqual(await readJson(await harness.get()), {
    ...emptySummary(),
    likeCount: 1,
    likes: [alumo.profile],
  });

  const afterBlock = await harness.react(kanori, "like");
  assert.equal(afterBlock.status, 403);
  assert.deepEqual(await readJson(afterBlock), {
    ok: false,
    error: "Profile is blocked",
    code: "profile-blocked",
  });
  const clearAfterBlock = await harness.react(kanori, null);
  assert.equal(clearAfterBlock.status, 403, "Blocked profiles cannot clear either.");

  const blockedAgain = await harness.post(
    { profileId: "player-0001", action: "block" },
    { path: moderationPath, authorization },
  );
  assert.equal(blockedAgain.status, 200);
  assert.equal((await readJson(blockedAgain)).removedReactions, 0);
  assert.equal(harness.profileRow("player-0001").blocked_at, blockedAt, "The first block stands.");

  const removeBlocked = await harness.post(
    { profileId: "player-0001", action: "remove" },
    { path: moderationPath, authorization },
  );
  assert.deepEqual(await readJson(removeBlocked), {
    ok: true,
    profileId: "player-0001",
    action: "remove",
    removedReactions: 0,
    blocked: true,
  });
  assert.equal(harness.allReactionRows().length, 1);
});

test("moderation handles unknown profiles, legacy rows, and malformed requests", async () => {
  const harness = createSocialHarness();
  const signIn = await harness.signInAsAdministrator();
  const authorization = `Bearer ${signIn.proof}`;
  harness.insertRow({
    id: "player-legacy",
    name: "Anything",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  const blockUnknown = await harness.post(
    { profileId: "player-legacy", action: "block" },
    { path: moderationPath, authorization },
  );
  assert.equal(blockUnknown.status, 404);
  assert.deepEqual(await readJson(blockUnknown), {
    ok: false,
    error: "Unknown profile",
    code: "profile-unknown",
  });
  assert.equal(harness.allReactionRows().length, 1, "A refused block removes nothing.");

  const removeLegacy = await harness.post(
    { profileId: "player-legacy", action: "remove" },
    { path: moderationPath, authorization },
  );
  assert.deepEqual(await readJson(removeLegacy), {
    ok: true,
    profileId: "player-legacy",
    action: "remove",
    removedReactions: 1,
    blocked: false,
  });
  assert.equal(harness.allReactionRows().length, 0);

  const cases = [
    [{ profileId: "player-0001", action: "ban" }, /Moderation action must be "remove" or "block"/],
    [{ profileId: "player-0001" }, /Moderation action must be/],
    [{ action: "remove" }, /Moderation request profileId must be a string/],
    [{ profileId: "short", action: "remove" }, /Invalid moderation request profileId/],
    [{ profileId: "player-0001", action: "remove", extra: 1 }, /Unknown moderation request field/],
    [[], /moderation request must be an object/],
  ];
  for (const [body, pattern] of cases) {
    const response = await harness.post(body, { path: moderationPath, authorization });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.match((await readJson(response)).error, pattern);
  }
  const queried = await harness.post(
    { profileId: "player-0001", action: "remove" },
    { path: `${moderationPath}?x=1`, authorization },
  );
  assert.equal(queried.status, 400);
  const read = await harness.get(moderationPath, { Authorization: authorization });
  assert.equal(read.status, 405);
});
