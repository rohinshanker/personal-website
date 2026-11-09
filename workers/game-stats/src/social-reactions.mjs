import {
  getGameStatsDatabase,
  MAX_REACTIONS_PER_WINDOW,
  MAX_SOCIAL_POST_REACTION_LIST,
  MAX_SOCIAL_POST_REACTIONS,
  SOCIAL_POST_IDS,
} from "./constants.mjs";
import { assertAllowedKeys, normalizeProfile } from "./events.mjs";
import { assertBrowserOriginAllowed, HttpError, jsonResponse, readJsonBody } from "./http.mjs";
import {
  enforceRateLimit,
  getClientIp,
  hmacDigest,
  requireSecurityConfig,
  validateAdministratorProfileProof,
} from "./security.mjs";

const REACTIONS = Object.freeze(["like", "dislike"]);

const COUNT_REACTIONS_SQL = `
SELECT reaction, COUNT(*) AS reaction_count
FROM social_post_reactions
WHERE post_id = ?
GROUP BY reaction
`;
// The most recent rows win the cap; the response lists them oldest first.
const SELECT_RECENT_REACTIONS_SQL = `
SELECT profile_id, player_name, player_icon
FROM (
  SELECT profile_id, player_name, player_icon, created_at
  FROM social_post_reactions
  WHERE post_id = ? AND reaction = ?
  ORDER BY created_at DESC, profile_id DESC
  LIMIT ?
)
ORDER BY created_at ASC, profile_id ASC
`;
// A new profile is admitted only while the post is below its cap; an existing
// profile may always change its reaction. One statement keeps the check and
// the write atomic.
const UPSERT_REACTION_SQL = `
INSERT INTO social_post_reactions (
  post_id, profile_id, player_name, player_icon, reaction, ip_hash, created_at, updated_at
)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7
WHERE (SELECT COUNT(*) FROM social_post_reactions WHERE post_id = ?1) < ?8
  OR EXISTS (
    SELECT 1 FROM social_post_reactions WHERE post_id = ?1 AND profile_id = ?2
  )
ON CONFLICT(post_id, profile_id) DO UPDATE SET
  player_name = excluded.player_name,
  player_icon = excluded.player_icon,
  reaction = excluded.reaction,
  ip_hash = excluded.ip_hash,
  updated_at = excluded.updated_at
`;
const DELETE_REACTION_SQL = `
DELETE FROM social_post_reactions
WHERE post_id = ? AND profile_id = ?
`;

export const SOCIAL_POST_REACTIONS_PATH_PATTERN = /^\/social-posts\/([a-z0-9-]{1,80})\/reactions$/;

const assertNoQueryString = (request) => {
  if (new URL(request.url).search) {
    throw new HttpError(400, "Query parameters are not supported");
  }
};

const requireKnownPostId = (postId) => {
  if (!SOCIAL_POST_IDS.includes(postId)) throw new HttpError(404, "Unknown post");
  return postId;
};

const normalizeReaction = (value) => {
  if (value === null) return null;
  if (!REACTIONS.includes(value)) {
    throw new HttpError(400, 'Reaction must be "like", "dislike", or null');
  }
  return value;
};

const readReactionRequest = (payload) => {
  assertAllowedKeys(payload, ["profile", "reaction"], "reaction request");
  if (!Object.hasOwn(payload, "reaction")) {
    throw new HttpError(400, "Reaction request requires a reaction");
  }
  const profile = normalizeProfile(payload.profile, { label: "Reaction profile" });
  if (!profile) throw new HttpError(400, "Reaction request requires a profile");
  return { profile, reaction: normalizeReaction(payload.reaction) };
};

const rowToProfile = (row) => ({
  id: row.profile_id,
  name: row.player_name,
  icon: row.player_icon,
});

const countsByReaction = (rows) => {
  const counts = { like: 0, dislike: 0 };
  for (const row of rows) counts[row.reaction] = Number(row.reaction_count);
  return counts;
};

const selectReactionSummary = async (env, postId) => {
  const database = getGameStatsDatabase(env);
  const [counts, likes, dislikes] = await database.batch([
    database.prepare(COUNT_REACTIONS_SQL).bind(postId),
    database
      .prepare(SELECT_RECENT_REACTIONS_SQL)
      .bind(postId, "like", MAX_SOCIAL_POST_REACTION_LIST),
    database
      .prepare(SELECT_RECENT_REACTIONS_SQL)
      .bind(postId, "dislike", MAX_SOCIAL_POST_REACTION_LIST),
  ]);
  const totals = countsByReaction(counts.results || []);
  return {
    ok: true,
    postId,
    likeCount: totals.like,
    dislikeCount: totals.dislike,
    likes: (likes.results || []).map(rowToProfile),
    dislikes: (dislikes.results || []).map(rowToProfile),
  };
};

const writeReaction = async (env, postId, profile, reaction, ipHash) => {
  const database = getGameStatsDatabase(env);
  if (reaction === null) {
    await database.prepare(DELETE_REACTION_SQL).bind(postId, profile.id).run();
    return;
  }
  const result = await database
    .prepare(UPSERT_REACTION_SQL)
    .bind(
      postId,
      profile.id,
      profile.name,
      profile.icon,
      reaction,
      ipHash,
      new Date().toISOString(),
      MAX_SOCIAL_POST_REACTIONS,
    )
    .run();
  if (Number(result?.meta?.changes) !== 1) {
    throw new HttpError(409, "This post has reached its reaction limit", { code: "post-full" });
  }
};

export const handleGetSocialPostReactions = async (request, env, postId) => {
  assertNoQueryString(request);
  requireKnownPostId(postId);
  return jsonResponse(request, env, await selectReactionSummary(env, postId));
};

export const handlePostSocialPostReaction = async (request, env, postId) => {
  assertBrowserOriginAllowed(request, env);
  assertNoQueryString(request);
  requireKnownPostId(postId);
  const { profile, reaction } = readReactionRequest(await readJsonBody(request));
  const ipHash = await hmacDigest(requireSecurityConfig(env).ipHashSecret, getClientIp(request));
  await enforceRateLimit(env, ipHash, "reactions", MAX_REACTIONS_PER_WINDOW);
  await validateAdministratorProfileProof(request, env, profile);
  await writeReaction(env, postId, profile, reaction, ipHash);
  return jsonResponse(request, env, await selectReactionSummary(env, postId));
};
