import {
  ADMINISTRATOR_PROFILE,
  getGameStatsDatabase,
  MAX_SOCIAL_PROFILE_REGISTRATIONS_PER_WINDOW,
  SOCIAL_PROFILE_TOKEN_BYTES,
} from "./constants.mjs";
import { assertAllowedKeys, isAllowedProfileIcon } from "./events.mjs";
import {
  assertBrowserOriginAllowed,
  assertNoQueryString,
  HttpError,
  jsonResponse,
  readJsonBody,
} from "./http.mjs";
import {
  createRandomToken,
  enforceRateLimit,
  getClientIp,
  hmacDigest,
  requireSecurityConfig,
  sha256Digest,
} from "./security.mjs";
import { isSkyGeneratedName } from "./social-profile-names.mjs";

export const SOCIAL_PROFILES_PATH = "/social-profiles";
export const PROFILE_ID_PATTERN = /^[a-z0-9-]{8,80}$/;
const MAX_TOKEN_LENGTH = 128;

// A duplicate id changes nothing, which the caller reports as 409.
const INSERT_PROFILE_SQL = `
INSERT INTO social_profiles (
  profile_id, player_name, player_icon, token_hash, ip_hash, created_at
) VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(profile_id) DO NOTHING
`;
const SELECT_PROFILE_SQL = `
SELECT profile_id, player_name, player_icon, token_hash, blocked_at
FROM social_profiles
WHERE profile_id = ?
`;
const BLOCK_PROFILE_SQL = `
UPDATE social_profiles
SET blocked_at = COALESCE(blocked_at, ?)
WHERE profile_id = ?
`;

const capitalize = (text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** `label` is the lowercase field phrase, e.g. "reaction request profileId". */
const requireString = (value, label) => {
  if (typeof value !== "string") {
    throw new HttpError(400, `${capitalize(label)} must be a string`);
  }
  return value;
};

export const requireProfileId = (value, label) => {
  const id = requireString(value, label);
  if (!PROFILE_ID_PATTERN.test(id)) throw new HttpError(400, `Invalid ${label}`);
  return id;
};

export const requireProfileToken = (value, label) => {
  const token = requireString(value, label);
  if (!token || token.length > MAX_TOKEN_LENGTH) throw new HttpError(400, `Invalid ${label}`);
  return token;
};

const administratorIdentityError = () =>
  new HttpError(403, "The Administrator profile cannot be registered", {
    code: "administrator-authorization",
  });

const readRegistrationRequest = (payload) => {
  assertAllowedKeys(payload, ["id", "name", "icon"], "profile registration");
  const id = requireProfileId(payload.id, "profile registration id");
  const name = requireString(payload.name, "profile registration name");
  const icon = requireString(payload.icon, "profile registration icon");
  if (id === ADMINISTRATOR_PROFILE.id || name.trim().toLowerCase() === ADMINISTRATOR_PROFILE.name) {
    throw administratorIdentityError();
  }
  if (!isSkyGeneratedName(name)) {
    throw new HttpError(400, "Profile registration name must be a generated name", {
      code: "profile-name-invalid",
    });
  }
  if (!isAllowedProfileIcon(icon)) {
    throw new HttpError(400, "Invalid profile registration icon");
  }
  return { id, name, icon };
};

const insertProfile = async (env, profile, tokenHash, ipHash) => {
  const result = await getGameStatsDatabase(env)
    .prepare(INSERT_PROFILE_SQL)
    .bind(profile.id, profile.name, profile.icon, tokenHash, ipHash, new Date().toISOString())
    .run();
  if (Number(result?.meta?.changes) !== 1) {
    throw new HttpError(409, "This profile id is already registered", {
      code: "profile-registered",
    });
  }
};

export const selectSocialProfile = (env, profileId) =>
  getGameStatsDatabase(env).prepare(SELECT_PROFILE_SQL).bind(profileId).first();

export const blockSocialProfileStatement = (env, profileId, blockedAt) =>
  getGameStatsDatabase(env).prepare(BLOCK_PROFILE_SQL).bind(blockedAt, profileId);

const rowToProfile = (row) => ({
  id: row.profile_id,
  name: row.player_name,
  icon: row.player_icon,
});

/**
 * Resolves a registered profile from its id and one-time token. The returned
 * name and icon are the server-held values; the request never supplies them.
 */
export const authenticateSocialProfile = async (env, profileId, token) => {
  const row = await selectSocialProfile(env, profileId);
  if (!row) throw new HttpError(404, "Unknown profile", { code: "profile-unknown" });
  // Both sides are digests of a 256-bit random token, so a plain comparison
  // leaks nothing an attacker can use.
  if ((await sha256Digest(token)) !== row.token_hash) {
    throw new HttpError(403, "Profile token is invalid", { code: "profile-token-invalid" });
  }
  if (row.blocked_at) throw new HttpError(403, "Profile is blocked", { code: "profile-blocked" });
  return rowToProfile(row);
};

export const handlePostSocialProfileRegistration = async (request, env) => {
  assertBrowserOriginAllowed(request, env);
  assertNoQueryString(request);
  const profile = readRegistrationRequest(await readJsonBody(request));
  const ipHash = await hmacDigest(requireSecurityConfig(env).ipHashSecret, getClientIp(request));
  await enforceRateLimit(
    env,
    ipHash,
    "social-profiles",
    MAX_SOCIAL_PROFILE_REGISTRATIONS_PER_WINDOW,
  );
  const token = createRandomToken(SOCIAL_PROFILE_TOKEN_BYTES);
  await insertProfile(env, profile, await sha256Digest(token), ipHash);
  return jsonResponse(request, env, { ok: true, profile, token }, 201);
};
