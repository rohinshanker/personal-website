import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const PROOF_STORAGE_KEY = "personalSiteAdministratorProofV1";
const HOUR_MS = 60 * 60 * 1000;
const START_MS = Date.UTC(2026, 8, 30, 12, 0, 0);
const VALID_PROOF = `${"a".repeat(32)}.${"b".repeat(32)}`;
const ADMINISTRATOR_PROFILE = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
});

/** The module runs in its own realm, so compare its values as plain data. */
const plain = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

const source = await readFile(
  new URL("../scripts/home/core/administrator-session.js", import.meta.url),
  "utf8"
);

/** A clock the session reads through `Date`, so expiry is exercised without waiting. */
const createClock = (startMs = START_MS) => {
  let currentMs = startMs;
  class ClockDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(currentMs);
      else super(...args);
    }

    static now() {
      return currentMs;
    }
  }
  return {
    Date: ClockDate,
    now: () => currentMs,
    advance(ms) {
      currentMs += ms;
    },
  };
};

/** Records what the session scheduled instead of running it on the real event loop. */
const createTimers = () => {
  const timeouts = new Map();
  const intervals = new Map();
  let nextId = 1;
  return {
    api: {
      setTimeout(callback, delay) {
        const id = nextId++;
        timeouts.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id) {
        timeouts.delete(id);
      },
      setInterval(callback, delay) {
        const id = nextId++;
        intervals.set(id, { callback, delay });
        return id;
      },
      clearInterval(id) {
        intervals.delete(id);
      },
    },
    counts: () => ({ timeouts: timeouts.size, intervals: intervals.size }),
    intervalDelays: () => [...intervals.values()].map(({ delay }) => delay),
    timeoutDelays: () => [...timeouts.values()].map(({ delay }) => delay),
    runTimeouts() {
      const due = [...timeouts.values()];
      timeouts.clear();
      due.forEach(({ callback }) => callback());
    },
    tickIntervals() {
      [...intervals.values()].forEach(({ callback }) => callback());
    },
  };
};

const createStorage = ({ denied = false, entries = {} } = {}) => {
  const store = new Map(Object.entries(entries));
  let refused = denied;
  const guard = () => {
    if (refused) throw new Error("session storage is blocked");
  };
  return {
    store,
    deny() {
      refused = true;
    },
    api: {
      getItem(key) {
        guard();
        return store.get(key) ?? null;
      },
      setItem(key, value) {
        guard();
        store.set(key, String(value));
      },
      removeItem(key) {
        guard();
        store.delete(key);
      },
    },
  };
};

const loadSessionModule = ({ clock, timers, storage }) => {
  const pageWindow = { ...timers.api, sessionStorage: storage.api };
  vm.runInContext(source, vm.createContext({ window: pageWindow, Date: clock.Date }));
  return pageWindow.homeAdministratorSession;
};

/** One route's worth of session under a fake clock, timers, and session storage. */
const createHarness = ({ stored, denied = false } = {}) => {
  const clock = createClock();
  const timers = createTimers();
  const storage = createStorage({
    denied,
    entries: stored ? { [PROOF_STORAGE_KEY]: JSON.stringify(stored) } : {},
  });
  const namespace = loadSessionModule({ clock, timers, storage });
  const invalidations = [];
  const session = namespace.createAdministratorSession({
    onInvalidated: (reason) => invalidations.push(reason),
  });
  return { clock, invalidations, namespace, session, storage, timers };
};

const liveProof = (clock, { lifetimeMs = 60_000, proof = VALID_PROOF } = {}) => ({
  proof,
  expiresAt: new Date(clock.now() + lifetimeMs).toISOString(),
});

const readStoredProof = (storage) =>
  JSON.parse(storage.store.get(PROOF_STORAGE_KEY) || "null");

test("a proof is accepted only while it is well formed and still live", () => {
  const { clock, namespace } = createHarness();
  const { normalizeAdministratorProof } = namespace;

  assert.deepEqual(
    plain(normalizeAdministratorProof(liveProof(clock))),
    { proof: VALID_PROOF, expiresAt: new Date(clock.now() + 60_000).toISOString() }
  );

  for (const rejected of [
    null,
    "not-an-object",
    {},
    { proof: "too-short", expiresAt: new Date(clock.now() + 60_000).toISOString() },
    { proof: `${"a".repeat(16)}!`, expiresAt: new Date(clock.now() + 60_000).toISOString() },
    { proof: VALID_PROOF, expiresAt: "not-a-date" },
    { proof: VALID_PROOF, expiresAt: new Date(clock.now()).toISOString() },
    { proof: VALID_PROOF, expiresAt: new Date(clock.now() - 1).toISOString() },
  ]) {
    assert.equal(normalizeAdministratorProof(rejected), null, JSON.stringify(rejected));
  }

  assert.equal(
    normalizeAdministratorProof({ proof: `${"Z-z_9.~+=/".repeat(2)}`, expiresAt: new Date(clock.now() + 60_000).toISOString() })?.proof,
    "Z-z_9.~+=/Z-z_9.~+=/",
    "The unreserved characters the Worker encodes proofs with must all be accepted."
  );
});

test("a browser session is bounded to one hour however long the Worker reports", () => {
  const { clock, namespace } = createHarness();

  assert.equal(namespace.ADMINISTRATOR_SESSION_DURATION_MS, HOUR_MS);
  assert.equal(
    namespace.normalizeAdministratorProof(liveProof(clock, { lifetimeMs: 8 * HOUR_MS }))
      .expiresAt,
    new Date(clock.now() + HOUR_MS).toISOString()
  );
  assert.equal(
    namespace.normalizeAdministratorProof(liveProof(clock, { lifetimeMs: 15 * 60_000 }))
      .expiresAt,
    new Date(clock.now() + 15 * 60_000).toISOString(),
    "A shorter Worker expiry must win over the browser bound."
  );
});

test("a sign-in response counts only with a live proof for the protected profile", () => {
  const { clock, namespace } = createHarness();
  const { normalizeAdministratorSignInResponse } = namespace;
  const proof = liveProof(clock);

  assert.deepEqual(
    plain(normalizeAdministratorSignInResponse({ ...proof, profile: ADMINISTRATOR_PROFILE })),
    { proof: VALID_PROOF, expiresAt: proof.expiresAt }
  );
  assert.equal(normalizeAdministratorSignInResponse({ ...proof }), null);
  for (const field of ["id", "name", "icon"]) {
    assert.equal(
      normalizeAdministratorSignInResponse({
        ...proof,
        profile: { ...ADMINISTRATOR_PROFILE, [field]: "someone-else" },
      }),
      null,
      `A response for a different ${field} must not authorize the Administrator.`
    );
  }
  assert.equal(
    normalizeAdministratorSignInResponse({
      proof: VALID_PROOF,
      expiresAt: new Date(clock.now() - 1).toISOString(),
      profile: ADMINISTRATOR_PROFILE,
    }),
    null
  );
});

test("adopting a proof stores it and arms both the expiry and the storage watch", () => {
  const { clock, session, storage, timers } = createHarness();

  assert.deepEqual(timers.counts(), { timeouts: 0, intervals: 0 });
  const adopted = plain(session.adopt(liveProof(clock, { lifetimeMs: 90_000 })));

  assert.deepEqual(adopted, {
    proof: VALID_PROOF,
    expiresAt: new Date(clock.now() + 90_000).toISOString(),
  });
  assert.deepEqual(plain(session.getProof()), adopted);
  assert.deepEqual(readStoredProof(storage), adopted);
  assert.equal(session.isActive(), true);
  assert.deepEqual(timers.counts(), { timeouts: 1, intervals: 1 });
  assert.deepEqual(timers.timeoutDelays(), [90_000]);
  assert.deepEqual(timers.intervalDelays(), [1_000]);

  assert.equal(session.adopt({ proof: "too-short", expiresAt: adopted.expiresAt }), null);
  assert.deepEqual(
    plain(session.getProof()),
    adopted,
    "A rejected proof must not end the session."
  );
});

test("an expiring session ends itself and reports why", () => {
  const { clock, invalidations, session, storage, timers } = createHarness();
  session.adopt(liveProof(clock, { lifetimeMs: 60_000 }));

  clock.advance(30_000);
  timers.runTimeouts();
  assert.deepEqual(invalidations, [], "A live session must re-arm rather than end.");
  assert.equal(session.isActive(), true);
  assert.deepEqual(timers.timeoutDelays(), [30_000]);

  clock.advance(30_000);
  timers.runTimeouts();
  assert.deepEqual(invalidations, ["expired"]);
  assert.equal(session.getProof(), null);
  assert.equal(session.isActive(), false);
  assert.equal(storage.store.has(PROOF_STORAGE_KEY), false);
  assert.deepEqual(timers.counts(), { timeouts: 0, intervals: 0 });
});

test("a proof dropped from storage elsewhere deauthenticates this page", () => {
  const { clock, invalidations, session, storage, timers } = createHarness();
  session.adopt(liveProof(clock));

  storage.store.delete(PROOF_STORAGE_KEY);
  timers.tickIntervals();

  assert.deepEqual(invalidations, ["deauthenticated"]);
  assert.equal(session.getProof(), null);
  assert.deepEqual(timers.counts(), { timeouts: 0, intervals: 0 });
});

test("a proof replaced in storage elsewhere deauthenticates this page", () => {
  const { clock, invalidations, session, storage, timers } = createHarness();
  session.adopt(liveProof(clock));

  storage.store.set(
    PROOF_STORAGE_KEY,
    JSON.stringify(liveProof(clock, { proof: `${"c".repeat(32)}.${"d".repeat(32)}` }))
  );
  timers.tickIntervals();

  assert.deepEqual(invalidations, ["deauthenticated"]);
  assert.equal(session.verify(), "inactive");
});

test("restoring resumes a live stored session and drops a stale one", () => {
  const clock = createClock();
  const live = createHarness({ stored: liveProof(clock, { lifetimeMs: 120_000 }) });

  const resumed = live.session.restore();
  assert.equal(resumed.proof.proof, VALID_PROOF);
  assert.deepEqual(plain(live.session.getProof()), plain(resumed.proof));
  assert.deepEqual(live.timers.counts(), { timeouts: 1, intervals: 1 });
  assert.deepEqual(live.invalidations, []);

  const stale = createHarness({
    stored: { proof: VALID_PROOF, expiresAt: new Date(clock.now() - 1).toISOString() },
  });
  const lapsed = stale.session.restore();
  assert.equal(lapsed.proof, null);
  assert.ok(lapsed.payload, "A lapsed session must stay distinguishable from no session.");
  assert.equal(stale.session.getProof(), null);
  assert.equal(
    stale.storage.store.has(PROOF_STORAGE_KEY),
    false,
    "A stored proof that no longer normalizes must not linger."
  );
  assert.deepEqual(stale.timers.counts(), { timeouts: 0, intervals: 0 });

  const empty = createHarness();
  const never = empty.session.restore();
  assert.deepEqual(plain(never), { payload: null, proof: null });
});

test("unreadable stored JSON is discarded rather than trusted", () => {
  const { session, storage } = createHarness();
  storage.store.set(PROOF_STORAGE_KEY, "{not json");

  const stored = session.restore();

  assert.deepEqual(plain(stored), { payload: {}, proof: null });
  assert.equal(storage.store.has(PROOF_STORAGE_KEY), false);
});

test("clearing ends the session everywhere it was recorded", () => {
  const { clock, invalidations, session, storage, timers } = createHarness();
  session.adopt(liveProof(clock));

  session.clear();

  assert.equal(session.getProof(), null);
  assert.equal(session.verify(), "inactive");
  assert.equal(storage.store.has(PROOF_STORAGE_KEY), false);
  assert.deepEqual(timers.counts(), { timeouts: 0, intervals: 0 });
  assert.deepEqual(invalidations, [], "An explicit sign-out is not an invalidation.");
});

test("a discarded page can release its timers and leave the session in storage", () => {
  const { clock, session, storage, timers } = createHarness();
  const adopted = plain(session.adopt(liveProof(clock)));

  session.stopMonitoring();

  assert.deepEqual(timers.counts(), { timeouts: 0, intervals: 0 });
  assert.deepEqual(readStoredProof(storage), adopted);
  assert.deepEqual(plain(session.getProof()), adopted);
});

test("a blocked session storage keeps the page usable without persisting anything", () => {
  const { clock, invalidations, session, storage, timers } = createHarness({ denied: true });

  assert.deepEqual(plain(session.restore()), { payload: null, proof: null });
  const adopted = plain(session.adopt(liveProof(clock)));

  assert.equal(session.isStorageAvailable(), false);
  assert.deepEqual(plain(session.getProof()), adopted);
  assert.equal(storage.store.size, 0);

  timers.tickIntervals();
  assert.deepEqual(
    invalidations,
    [],
    "Storage that cannot be read must not be mistaken for a revoked session."
  );
  assert.equal(session.isActive(), true);
});

test("session storage that fails mid-page stops being used without ending the session", () => {
  const { clock, invalidations, session, storage, timers } = createHarness();
  const adopted = plain(session.adopt(liveProof(clock)));

  storage.deny();
  timers.tickIntervals();

  assert.equal(session.isStorageAvailable(), false);
  assert.deepEqual(plain(session.getProof()), adopted);
  assert.deepEqual(invalidations, []);
});

test("a handler that re-checks the session during invalidation sees it already ended", () => {
  const clock = createClock();
  const timers = createTimers();
  const storage = createStorage();
  const namespace = loadSessionModule({ clock, timers, storage });
  const observed = [];
  const session = namespace.createAdministratorSession({
    onInvalidated: (reason) => {
      observed.push({
        reason,
        proof: plain(session.getProof()),
        active: session.isActive(),
      });
      session.clear();
    },
  });

  session.adopt(liveProof(clock, { lifetimeMs: 60_000 }));
  clock.advance(60_000);
  timers.runTimeouts();

  assert.deepEqual(observed, [{ reason: "expired", proof: null, active: false }]);
});

test("the shared contract exposes one storage key, profile, and poll interval", () => {
  const { namespace } = createHarness();

  assert.equal(namespace.ADMINISTRATOR_PROOF_STORAGE_KEY, PROOF_STORAGE_KEY);
  assert.deepEqual(plain(namespace.ADMINISTRATOR_PROFILE), ADMINISTRATOR_PROFILE);
  assert.equal(namespace.ADMINISTRATOR_AVATAR_ICON, ADMINISTRATOR_PROFILE.icon);
  assert.equal(namespace.ADMINISTRATOR_STORAGE_POLL_INTERVAL_MS, 1_000);
  assert.equal(namespace.isAdministratorProfile(ADMINISTRATOR_PROFILE), true);
  assert.equal(namespace.isAdministratorProfile(null), false);
  assert.equal(
    namespace.isAdministratorProfile({ ...ADMINISTRATOR_PROFILE, rerollCount: 0 }),
    true,
    "Home's local reroll bookkeeping must not disqualify the protected profile."
  );
  assert.equal(Object.isFrozen(namespace), true);
  assert.equal(Object.isFrozen(namespace.ADMINISTRATOR_PROFILE), true);
});
