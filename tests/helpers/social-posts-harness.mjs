/* Real-SQLite harness for the social-post reaction, profile, and moderation routes. */
import assert from "node:assert/strict";
import { SOCIAL_POST_IDS } from "../../workers/game-stats/src/constants.mjs";
import { handleRequest } from "../../workers/game-stats/src/router.mjs";
import { applyGameStatsMigrations, SqliteD1Database } from "./sqlite-d1.mjs";

const migrationPaths = [
  "0001_create_game_stats.sql",
  "0002_add_game_stat_security.sql",
  "0003_add_sudoku_puzzle_identity.sql",
  "0004_optimize_stats_aggregation.sql",
  "0005_add_verified_game_results.sql",
  "0006_add_social_post_reactions.sql",
  "0007_add_social_profiles.sql",
].map((name) => new URL(`../../workers/game-stats/migrations/${name}`, import.meta.url).pathname);

export const socialOrigin = "https://rohin.shanker.me";
export const socialClientIp = "203.0.113.41";
export const socialProfileIcon = "assets/app-icons/ico/user_card.ico";
export const defaultPostId = SOCIAL_POST_IDS[0];
export const reactionsPath = (id = defaultPostId) => `/social-posts/${id}/reactions`;
export const profilesPath = "/social-profiles";
export const moderationPath = "/administrator/social-posts/moderate";

export const readJson = async (response) => JSON.parse(await response.text());

export const emptySummary = (id = defaultPostId) => ({
  ok: true,
  postId: id,
  likeCount: 0,
  dislikeCount: 0,
  likes: [],
  dislikes: [],
});

const createEnv = (database) => ({
  personal_site_game_stats: database,
  ALLOWED_ORIGIN: socialOrigin,
  EVENT_SIGNING_SECRET: "test-reaction-signing-secret",
  IP_HASH_SECRET: "test-reaction-ip-secret",
  ADMIN_USERNAME: "test-administrator",
  ADMIN_PASSWORD: "test-administrator-password",
  ADMIN_SESSION_SIGNING_SECRET: "test-administrator-session-signing-secret",
  GAME_BUILD_VERSION: `sha256-${"a".repeat(64)}`,
});

export const createSocialHarness = () => {
  const database = new SqliteD1Database();
  applyGameStatsMigrations(database, migrationPaths);
  const env = createEnv(database);
  const dispatch = (request) => handleRequest(request, env, undefined, {});
  const harness = {
    database,
    env,
    dispatch,
    request(path, init = {}) {
      return dispatch(new Request(`https://stats.example.test${path}`, init));
    },
    get(path = reactionsPath(), headers = {}) {
      return harness.request(path, { headers });
    },
    post(
      body,
      { path = reactionsPath(), ip = socialClientIp, withOrigin = true, authorization = "" } = {},
    ) {
      return harness.request(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(withOrigin ? { Origin: socialOrigin } : {}),
          "CF-Connecting-IP": ip,
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify(body),
      });
    },
    options(path = reactionsPath()) {
      return harness.request(path, {
        method: "OPTIONS",
        headers: {
          Origin: socialOrigin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type",
        },
      });
    },
    rows(id = defaultPostId) {
      return database.sqlite
        .prepare(
          "SELECT * FROM social_post_reactions WHERE post_id = ? ORDER BY created_at, profile_id",
        )
        .all(id);
    },
    allReactionRows() {
      return database.sqlite
        .prepare("SELECT * FROM social_post_reactions ORDER BY post_id, created_at, profile_id")
        .all();
    },
    profileRow(id) {
      return database.sqlite.prepare("SELECT * FROM social_profiles WHERE profile_id = ?").get(id);
    },
    insertRow({
      id,
      name = `Player ${id}`,
      reaction = "like",
      createdAt,
      postId: rowPostId = defaultPostId,
    }) {
      database.sqlite
        .prepare(
          `INSERT INTO social_post_reactions (
             post_id, profile_id, player_name, player_icon, reaction, ip_hash, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'seeded-hash', ?, ?)`,
        )
        .run(rowPostId, id, name, socialProfileIcon, reaction, createdAt, createdAt);
    },
    blockProfile(id, blockedAt = "2026-01-01T00:00:00.000Z") {
      database.sqlite
        .prepare("UPDATE social_profiles SET blocked_at = ? WHERE profile_id = ?")
        .run(blockedAt, id);
    },
    /** Registers `{ id, name, icon }`; returns the raw response. */
    register(body, options = {}) {
      return harness.post(body, { path: profilesPath, ...options });
    },
    /** Registers a grammar-valid profile and returns `{ profile, token }`. */
    async registerProfile(id, name, options = {}) {
      const response = await harness.register({ id, name, icon: socialProfileIcon }, options);
      assert.equal(response.status, 201, await response.clone().text());
      const body = await readJson(response);
      return { profile: body.profile, token: body.token };
    },
    /** Signs in as the Administrator and returns the sign-in body (`proof`, `expiresAt`). */
    async signInAsAdministrator() {
      const response = await harness.post(
        { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD },
        { path: "/administrator/sign-in" },
      );
      assert.equal(response.status, 200);
      return readJson(response);
    },
    react(registered, reaction, options = {}) {
      return harness.post(
        { profileId: registered.profile.id, token: registered.token, reaction },
        options,
      );
    },
  };
  return harness;
};
