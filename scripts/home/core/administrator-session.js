(() => {
/**
 * The one Administrator session contract shared by Home and the Video Editor.
 * Both routes sign in against the same Worker endpoint and read the same
 * short-lived proof out of `sessionStorage`, so the storage key, the proof
 * shape, the protected profile, and the expiry/storage lifecycle live here
 * instead of being hand-synced in two runtimes.
 *
 * Nothing in this module handles credentials: the username and password reach
 * the Worker from the route that owns the sign-in form, and only the returned
 * proof comes back through here.
 */
const ADMINISTRATOR_PROOF_STORAGE_KEY = "personalSiteAdministratorProofV1";

/**
 * The Worker decides when a proof expires; the browser additionally refuses to
 * treat one as live for longer than an hour, so a clock skew or an over-long
 * server expiry cannot extend a session on this side.
 */
const ADMINISTRATOR_SESSION_DURATION_MS = 60 * 60 * 1000;

/** The unreserved URL characters the Worker uses to encode a proof. */
const ADMINISTRATOR_PROOF_PATTERN = /^[A-Za-z0-9._~+=\/-]{16,4096}$/;

/** A proof dropped from storage in another tab must end this tab's session too. */
const ADMINISTRATOR_STORAGE_POLL_INTERVAL_MS = 1_000;

/** `setTimeout` saturates past this delay, so long sessions re-arm instead. */
const MAX_SESSION_TIMEOUT_MS = 2_147_000_000;

const ADMINISTRATOR_AVATAR_ICON = "assets/neko-assets/sprites/yawn1.png";

/** The single protected profile the Worker publishes verified results for. */
const ADMINISTRATOR_PROFILE = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: ADMINISTRATOR_AVATAR_ICON,
});

/** Session states reported by `verify()`. */
const SESSION_ACTIVE = "active";
const SESSION_INACTIVE = "inactive";
const SESSION_EXPIRED = "expired";
const SESSION_DEAUTHENTICATED = "deauthenticated";

/**
 * Accepts a proof payload only while it is well formed and still live, and
 * bounds its recorded expiry to `ADMINISTRATOR_SESSION_DURATION_MS`.
 */
const normalizeAdministratorProof = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const proof = String(payload.proof || "").trim();
  const reportedExpiresAtMs = new Date(payload.expiresAt || "").getTime();
  if (
    !ADMINISTRATOR_PROOF_PATTERN.test(proof) ||
    !Number.isFinite(reportedExpiresAtMs) ||
    reportedExpiresAtMs <= Date.now()
  ) {
    return null;
  }
  const expiresAtMs = Math.min(
    reportedExpiresAtMs,
    Date.now() + ADMINISTRATOR_SESSION_DURATION_MS
  );
  return { proof, expiresAt: new Date(expiresAtMs).toISOString() };
};

const isAdministratorProfile = (profile) =>
  profile?.id === ADMINISTRATOR_PROFILE.id &&
  profile.name === ADMINISTRATOR_PROFILE.name &&
  profile.icon === ADMINISTRATOR_PROFILE.icon;

/** A sign-in response counts only when it carries a live proof for that profile. */
const normalizeAdministratorSignInResponse = (payload) => {
  const proof = normalizeAdministratorProof(payload);
  if (!proof || !isAdministratorProfile(payload?.profile)) return null;
  return proof;
};

/**
 * Owns one route's Administrator session: the stored proof, the in-memory copy,
 * and the timers that end the session the moment it expires or disappears from
 * storage. `onInvalidated` receives `"expired"` or `"deauthenticated"` after the
 * session has already been cleared.
 */
const createAdministratorSession = ({
  storage,
  browserWindow,
  onInvalidated,
} = {}) => {
  const pageWindow = browserWindow || window;
  let storageAvailable = true;
  let activeProof = null;
  let expiryTimer = 0;
  let monitorTimer = 0;
  let invalidating = false;

  /**
   * Session storage is best-effort: a browser that denies it (private mode,
   * blocked storage) disables it for the rest of the page rather than throwing
   * on every read, and the proof stays usable in memory for this tab.
   */
  const withStorage = (operation, fallback) => {
    if (!storageAvailable) return fallback;
    try {
      return operation(storage || pageWindow.sessionStorage);
    } catch {
      storageAvailable = false;
      return fallback;
    }
  };

  const clearStored = () =>
    withStorage((store) => {
      store.removeItem(ADMINISTRATOR_PROOF_STORAGE_KEY);
      return true;
    }, false);

  /**
   * Reports both the raw payload and its normalized form: a route needs the
   * payload to tell "never signed in" from "the stored session lapsed".
   */
  const readStored = () => {
    const stored = withStorage(
      (store) => store.getItem(ADMINISTRATOR_PROOF_STORAGE_KEY) || "",
      ""
    );
    if (!stored) return { payload: null, proof: null };
    try {
      const payload = JSON.parse(stored);
      return { payload, proof: normalizeAdministratorProof(payload) };
    } catch {
      clearStored();
      return { payload: {}, proof: null };
    }
  };

  const matchesStorage = () => {
    if (!activeProof || !storageAvailable) return true;
    const stored = readStored().proof;
    // A read that just turned storage off says nothing about the session; only
    // a readable store that no longer holds this proof means it was revoked.
    if (!storageAvailable) return true;
    return Boolean(
      stored &&
        stored.proof === activeProof.proof &&
        stored.expiresAt === activeProof.expiresAt
    );
  };

  /**
   * Drops the timers without ending the session, so a page being discarded can
   * release them and still leave the stored proof for the next page in the tab.
   */
  const stopMonitoring = () => {
    pageWindow.clearTimeout(expiryTimer);
    pageWindow.clearInterval(monitorTimer);
    expiryTimer = 0;
    monitorTimer = 0;
  };

  const clear = () => {
    activeProof = null;
    stopMonitoring();
    clearStored();
  };

  /**
   * Clears first, then reports, so a handler that inspects the session during
   * `onInvalidated` already sees it ended. The guard keeps a handler that calls
   * back into `verify()` from recursing.
   */
  const invalidate = (reason) => {
    if (invalidating) return reason;
    invalidating = true;
    try {
      clear();
      onInvalidated?.(reason);
    } finally {
      invalidating = false;
    }
    return reason;
  };

  const verify = () => {
    if (!activeProof) return SESSION_INACTIVE;
    const normalizedProof = normalizeAdministratorProof(activeProof);
    if (!normalizedProof) return invalidate(SESSION_EXPIRED);
    activeProof = normalizedProof;
    if (!matchesStorage()) return invalidate(SESSION_DEAUTHENTICATED);
    return SESSION_ACTIVE;
  };

  const scheduleExpiry = () => {
    pageWindow.clearTimeout(expiryTimer);
    expiryTimer = 0;
    if (!activeProof) return;
    const remainingMs = Date.parse(activeProof.expiresAt) - Date.now();
    if (remainingMs <= 0) {
      invalidate(SESSION_EXPIRED);
      return;
    }
    expiryTimer = pageWindow.setTimeout(() => {
      expiryTimer = 0;
      if (verify() === SESSION_ACTIVE) scheduleExpiry();
    }, Math.min(remainingMs, MAX_SESSION_TIMEOUT_MS));
  };

  const startMonitoring = () => {
    stopMonitoring();
    scheduleExpiry();
    if (!activeProof) return;
    monitorTimer = pageWindow.setInterval(verify, ADMINISTRATOR_STORAGE_POLL_INTERVAL_MS);
  };

  /** Makes a freshly issued or restored proof this page's live session. */
  const adopt = (candidate) => {
    const normalizedProof = normalizeAdministratorProof(candidate);
    if (!normalizedProof) return null;
    activeProof = normalizedProof;
    withStorage((store) => {
      store.setItem(
        ADMINISTRATOR_PROOF_STORAGE_KEY,
        JSON.stringify(normalizedProof)
      );
      return true;
    }, false);
    startMonitoring();
    return normalizedProof;
  };

  /** Resumes a session left in storage by an earlier page in this tab. */
  const restore = () => {
    const stored = readStored();
    if (stored.proof) adopt(stored.proof);
    else if (stored.payload) clearStored();
    return stored;
  };

  return Object.freeze({
    adopt,
    clear,
    getProof: () => activeProof,
    isActive: () => verify() === SESSION_ACTIVE,
    isStorageAvailable: () => storageAvailable,
    readStored,
    restore,
    stopMonitoring,
    verify,
  });
};

window.homeAdministratorSession = Object.freeze({
  ADMINISTRATOR_AVATAR_ICON,
  ADMINISTRATOR_PROFILE,
  ADMINISTRATOR_PROOF_PATTERN,
  ADMINISTRATOR_PROOF_STORAGE_KEY,
  ADMINISTRATOR_SESSION_DURATION_MS,
  ADMINISTRATOR_STORAGE_POLL_INTERVAL_MS,
  SESSION_ACTIVE,
  SESSION_DEAUTHENTICATED,
  SESSION_EXPIRED,
  SESSION_INACTIVE,
  createAdministratorSession,
  isAdministratorProfile,
  normalizeAdministratorProof,
  normalizeAdministratorSignInResponse,
});
})();
