import {
  ADMINISTRATOR_PROFILE,
  ADMINISTRATOR_PROFILE_ID,
  ADMINISTRATOR_RATE_LIMIT_WINDOW_MS,
  ADMINISTRATOR_SESSION_TTL_MS,
  GAME_BUILD_VERSION_PATTERN,
  MAX_ADMINISTRATOR_SIGN_INS_PER_WINDOW,
  MAX_GAME_BUILD_COMPATIBILITY_VERSIONS,
  RATE_LIMIT_WINDOW_MS,
  getGameStatsDatabase,
} from "./constants.mjs";
import { assertAllowedKeys, isPlainObject } from "./events.mjs";
import { HttpError } from "./http.mjs";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_VERIFY_TIMEOUT_MS = 5 * 1000;
const AUTHORIZATION_ERROR_CODE = "administrator-authorization";
const UPSERT_RATE_LIMIT_SQL = `
INSERT INTO game_stats_rate_limits (
  bucket, request_count, window_started_at, expires_at
) VALUES (?, 1, ?, ?)
ON CONFLICT(bucket) DO UPDATE SET
  request_count = CASE
    WHEN game_stats_rate_limits.window_started_at <= ? THEN 1
    ELSE game_stats_rate_limits.request_count + 1
  END,
  window_started_at = CASE
    WHEN game_stats_rate_limits.window_started_at <= ? THEN excluded.window_started_at
    ELSE game_stats_rate_limits.window_started_at
  END,
  expires_at = excluded.expires_at
RETURNING request_count
`;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toBase64Url = (value) => {
  const bytes = value instanceof Uint8Array ? value : textEncoder.encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (value) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new HttpError(400, "Invalid session token");
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new HttpError(400, "Invalid session token");
  }
};

const importHmacKey = (secret) =>
  crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

const signHmac = async (secret, value) => {
  const key = await importHmacKey(secret);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, textEncoder.encode(value)));
};

export const hmacDigest = async (secret, value) => toBase64Url(await signHmac(secret, value));

const constantTimeSecretEquals = async (comparisonSecret, expected, provided) => {
  const [expectedDigest, providedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(expected)),
    crypto.subtle.digest("SHA-256", textEncoder.encode(provided)),
  ]);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(expectedDigest, providedDigest);
  }
  const key = await importHmacKey(comparisonSecret);
  const signature = await crypto.subtle.sign("HMAC", key, expectedDigest);
  return crypto.subtle.verify("HMAC", key, signature, providedDigest);
};

export const requireSecurityConfig = (env) => {
  const signingSecret = String(env.EVENT_SIGNING_SECRET || "");
  const ipHashSecret = String(env.IP_HASH_SECRET || "");
  const buildVersion = String(env.GAME_BUILD_VERSION || "").trim();
  const compatibilityVersions = String(env.GAME_BUILD_COMPATIBILITY_VERSIONS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const acceptedBuildVersions = [...new Set([buildVersion, ...compatibilityVersions])];
  if (
    !signingSecret ||
    !ipHashSecret ||
    !GAME_BUILD_VERSION_PATTERN.test(buildVersion) ||
    compatibilityVersions.length > MAX_GAME_BUILD_COMPATIBILITY_VERSIONS ||
    compatibilityVersions.some(
      (value) => !GAME_BUILD_VERSION_PATTERN.test(value) || value === buildVersion
    ) ||
    acceptedBuildVersions.length !== compatibilityVersions.length + 1
  ) {
    throw new HttpError(500, "Game stats security configuration is incomplete");
  }
  return { signingSecret, ipHashSecret, buildVersion, acceptedBuildVersions };
};

const requireAdministratorSecurityConfig = (env) => {
  const username = String(env.ADMIN_USERNAME || "");
  const password = String(env.ADMIN_PASSWORD || "");
  const sessionSigningSecret = String(env.ADMIN_SESSION_SIGNING_SECRET || "");
  const ipHashSecret = String(env.IP_HASH_SECRET || "");
  if (!username || !password || !sessionSigningSecret || !ipHashSecret) {
    throw new HttpError(500, "Administrator sign-in is unavailable");
  }
  return { username, password, sessionSigningSecret, ipHashSecret };
};

export const getClientIp = (request) =>
  String(request.headers.get("CF-Connecting-IP") || "local").trim();

export const enforceRateLimit = async (
  env,
  ipHash,
  operation,
  limit,
  windowMs = RATE_LIMIT_WINDOW_MS
) => {
  const now = new Date();
  const windowStartedAt = now.toISOString();
  const resetThreshold = new Date(now.getTime() - windowMs).toISOString();
  const expiresAt = new Date(now.getTime() + windowMs).toISOString();
  const row = await getGameStatsDatabase(env)
    .prepare(UPSERT_RATE_LIMIT_SQL)
    .bind(
      `${operation}:${ipHash}`,
      windowStartedAt,
      expiresAt,
      resetThreshold,
      resetThreshold
    )
    .first();
  if (!row || Number(row.request_count) > limit) {
    throw new HttpError(429, "Too many game stats requests");
  }
};

export const createSessionToken = async (signingSecret, payload) => {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${await hmacDigest(signingSecret, encodedPayload)}`;
};

export const verifySessionToken = async (signingSecret, token) => {
  const [encodedPayload, encodedSignature, ...rest] = String(token || "").split(".");
  if (!encodedPayload || !encodedSignature || rest.length) {
    throw new HttpError(400, "Invalid session token");
  }
  const key = await importHmacKey(signingSecret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    fromBase64Url(encodedSignature),
    textEncoder.encode(encodedPayload)
  );
  if (!valid) throw new HttpError(403, "Invalid session token");
  try {
    const payload = JSON.parse(textDecoder.decode(fromBase64Url(encodedPayload)));
    if (!isPlainObject(payload)) throw new Error("Not an object");
    return payload;
  } catch {
    throw new HttpError(400, "Invalid session token");
  }
};

export const verifyTurnstileIfRequired = async (request, env, payload) => {
  const required = Boolean(env.TURNSTILE_SECRET_KEY) || env.REQUIRE_TURNSTILE === "true";
  if (!required) return;
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new HttpError(500, "Turnstile is required but is not configured");
  }
  const token = String(payload.turnstileToken || "").trim();
  if (!token || token.length > 2048) throw new HttpError(400, "Missing Turnstile token");
  let response;
  let result;
  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: getClientIp(request),
        idempotency_key: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(TURNSTILE_VERIFY_TIMEOUT_MS),
    });
    result = await response.json();
  } catch {
    throw new HttpError(403, "Turnstile verification failed");
  }
  if (
    !response.ok ||
    !result?.success ||
    (env.TURNSTILE_EXPECTED_HOSTNAME && result.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME) ||
    (env.TURNSTILE_EXPECTED_ACTION && result.action !== env.TURNSTILE_EXPECTED_ACTION)
  ) {
    throw new HttpError(403, "Turnstile verification failed");
  }
};

const authorizationError = (message = "Administrator authorization is invalid") =>
  new HttpError(403, message, { code: AUTHORIZATION_ERROR_CODE });

const readAdministratorCredentials = (payload) => {
  assertAllowedKeys(payload, ["username", "password"], "administrator sign-in request");
  if (typeof payload.username !== "string" || typeof payload.password !== "string") {
    throw new HttpError(400, "Administrator sign-in credentials must be text");
  }
  if (!payload.username || !payload.password || payload.username.length > 128 || payload.password.length > 1024) {
    throw new HttpError(401, "Invalid administrator credentials");
  }
  return { username: payload.username, password: payload.password };
};

export const createAdministratorSignIn = async (request, env, payload) => {
  const credentials = readAdministratorCredentials(payload);
  const security = requireAdministratorSecurityConfig(env);
  const ipHash = await hmacDigest(security.ipHashSecret, getClientIp(request));
  await enforceRateLimit(
    env,
    ipHash,
    "administrator-sign-in",
    MAX_ADMINISTRATOR_SIGN_INS_PER_WINDOW,
    ADMINISTRATOR_RATE_LIMIT_WINDOW_MS
  );
  const [usernameMatches, passwordMatches] = await Promise.all([
    constantTimeSecretEquals(security.sessionSigningSecret, security.username, credentials.username),
    constantTimeSecretEquals(security.sessionSigningSecret, security.password, credentials.password),
  ]);
  if (!usernameMatches || !passwordMatches) {
    throw new HttpError(401, "Invalid administrator credentials");
  }
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ADMINISTRATOR_SESSION_TTL_MS);
  const proofPayload = {
    version: 1,
    scope: "administrator",
    profileId: ADMINISTRATOR_PROFILE_ID,
    ipHash,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  return {
    ok: true,
    profile: ADMINISTRATOR_PROFILE,
    proof: await createSessionToken(security.sessionSigningSecret, proofPayload),
    expiresAt: proofPayload.expiresAt,
  };
};

export const validateAdministratorEventProof = async (request, env, event) => {
  if (event.profile?.id !== ADMINISTRATOR_PROFILE_ID) return;
  if (
    event.profile.name !== ADMINISTRATOR_PROFILE.name ||
    event.profile.icon !== ADMINISTRATOR_PROFILE.icon
  ) {
    throw authorizationError("Administrator profile is invalid");
  }
  const authorization = String(request.headers.get("Authorization") || "");
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorization);
  if (!match) throw authorizationError();
  const security = requireAdministratorSecurityConfig(env);
  let proof;
  try {
    proof = await verifySessionToken(security.sessionSigningSecret, match[1]);
  } catch {
    throw authorizationError();
  }
  const expiresAt = Date.parse(String(proof.expiresAt || ""));
  if (
    proof.version !== 1 ||
    proof.scope !== "administrator" ||
    proof.profileId !== ADMINISTRATOR_PROFILE_ID ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    throw authorizationError();
  }
};
