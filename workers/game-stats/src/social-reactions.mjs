import {
  ADMINISTRATOR_PROFILE,
  getGameStatsDatabase,
  MAX_REACTIONS_PER_WINDOW,
  MAX_SOCIAL_POST_REACTION_LIST,
  MAX_SOCIAL_POST_REACTIONS,
  SOCIAL_POST_IDS,
} from "./constants.mjs";
import { assertAllowedKeys } from "./events.mjs";
import {
  assertBrowserOriginAllowed,
  assertNoQueryString,
  HttpError,
  jsonResponse,
  readJsonBody,
} from "./http.mjs";
import {
  enforceRateLimit,
  getClientIp,
  hmacDigest,
  requireSecurityConfig,
  validateAdministratorProof,
} from "./security.mjs";
import {
  authenticateSocialProfile,
  blockSocialProfileStatement,
  requireProfileId,
  requireProfileToken,
  selectSocialProfile,
} from "./social-profiles.mjs";

const REACTIONS = Object.freeze(["like", "dislike"]);
const MODERATION_ACTIONS = Object.freeze(["remove", "block"]);

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
const DELETE_PROFILE_REACTIONS_SQL = `
DELETE FROM social_post_reactions
WHERE profile_id = ?
`;

export const SOCIAL_POST_REACTIONS_PATH_PATTERN = /^\/social-posts\/([a-z0-9-]{1,80})\/reactions$/;
export const SOCIAL_POST_MODERATION_PATH = "/administrator/social-posts/moderate";

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

const readAdministratorReactionRequest = (payload, reaction) => {
  if (Object.hasOwn(payload, "profileId") || Object.hasOwn(payload, "token")) {
    throw new HttpError(400, "Administrator reactions do not carry a profile");
  }
  if (payload.administrator !== true) {
    throw new HttpError(400, "Reaction request administrator flag must be true");
  }
  return { administrator: true, reaction };
};

const readReactionRequest = (payload) => {
  assertAllowedKeys(
    payload,
    ["profileId", "token", "administrator", "reaction"],
    "reaction request",
  );
  if (!Object.hasOwn(payload, "reaction")) {
    throw new HttpError(400, "Reaction request requires a reaction");
  }
  const reaction = normalizeReaction(payload.reaction);
  if (Object.hasOwn(payload, "administrator")) {
    return readAdministratorReactionRequest(payload, reaction);
  }
  return {
    administrator: false,
    profileId: requireProfileId(payload.profileId, "reaction request profileId"),
    token: requireProfileToken(payload.token, "reaction request token"),
    reaction,
  };
};

const readModerationRequest = (payload) => {
  assertAllowedKeys(payload, ["profileId", "action"], "moderation request");
  const profileId = requireProfileId(payload.profileId, "moderation request profileId");
  if (!MODERATION_ACTIONS.includes(payload.action)) {
    throw new HttpError(400, 'Moderation action must be "remove" or "block"');
  }
  return { profileId, action: payload.action };
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

/** The reacting identity: the proven Administrator, or a registered profile's server-held row. */
const resolveReactor = async (request, env, reactionRequest) => {
  if (reactionRequest.administrator) {
    await validateAdministratorProof(request, env);
    return ADMINISTRATOR_PROFILE;
  }
  return authenticateSocialProfile(env, reactionRequest.profileId, reactionRequest.token);
};

const clientIpHash = async (request, env) =>
  hmacDigest(requireSecurityConfig(env).ipHashSecret, getClientIp(request));

export const handleGetSocialPostReactions = async (request, env, postId) => {
  assertNoQueryString(request);
  requireKnownPostId(postId);
  return jsonResponse(request, env, await selectReactionSummary(env, postId));
};

export const handlePostSocialPostReaction = async (request, env, postId) => {
  assertBrowserOriginAllowed(request, env);
  assertNoQueryString(request);
  requireKnownPostId(postId);
  const reactionRequest = readReactionRequest(await readJsonBody(request));
  const ipHash = await clientIpHash(request, env);
  await enforceRateLimit(env, ipHash, "reactions", MAX_REACTIONS_PER_WINDOW);
  const profile = await resolveReactor(request, env, reactionRequest);
  await writeReaction(env, postId, profile, reactionRequest.reaction, ipHash);
  return jsonResponse(request, env, await selectReactionSummary(env, postId));
};

const moderateProfile = async (env, profileId, action) => {
  const database = getGameStatsDatabase(env);
  const profileRow = await selectSocialProfile(env, profileId);
  if (action === "block" && !profileRow) {
    throw new HttpError(404, "Unknown profile", { code: "profile-unknown" });
  }
  const statements = [database.prepare(DELETE_PROFILE_REACTIONS_SQL).bind(profileId)];
  if (action === "block") {
    statements.push(blockSocialProfileStatement(env, profileId, new Date().toISOString()));
  }
  const [removed] = await database.batch(statements);
  return {
    removedReactions: Number(removed?.meta?.changes) || 0,
    blocked: action === "block" || Boolean(profileRow?.blocked_at),
  };
};

export const handlePostSocialPostModeration = async (request, env) => {
  assertBrowserOriginAllowed(request, env);
  assertNoQueryString(request);
  await validateAdministratorProof(request, env);
  const { profileId, action } = readModerationRequest(await readJsonBody(request));
  const outcome = await moderateProfile(env, profileId, action);
  return jsonResponse(request, env, { ok: true, profileId, action, ...outcome });
};
