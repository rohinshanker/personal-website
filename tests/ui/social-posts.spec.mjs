/**
 * Behavioural cover for the two Lois Griffin social-post random events.
 *
 * Both windows share one script, one storage pair and one reaction model: the
 * count labels, the likers list, the activity log and the profile gate are
 * driven by `scripts/home/events/social-posts.js`, and every reaction is
 * shared through the Game Stats Worker. A visitor registers once per device
 * on `/social-profiles` and then reacts on `/social-posts/{postId}/reactions`
 * under the token that registration returned; the Administrator reacts under
 * the stored proof instead. These cases force each event through the
 * Administrator orchestrator against an in-memory stand-in for both routes and
 * assert the rendered result at every review viewport: the managed window
 * lifecycle, focus, geometry, the Like toggle with and without a Game Progress
 * profile, persistence across a reload, server state on open, what a press
 * sends, registration and its refusals, a stale token, the per-device fallback
 * when the Worker fails, how a second post behaves while the first is open,
 * and an axe scan of the open window.
 */

import { expect, test } from "./deterministic.mjs";
import { scanForViolations } from "./helpers/accessibility-contracts.mjs";
import {
  consumeDiagnostics,
  installGameStatsBackend,
  REVIEW_VIEWPORT,
  REVIEW_VIEWPORTS,
  settleFrames,
} from "./helpers/rendered-site.mjs";

test.setTimeout(180_000);

const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const LIKES_STORAGE_KEY = "personalSiteSocialPostLikesV1";
const PROFILE_RECORD_STORAGE_KEY = "personalSiteSocialProfileV1";
const ADMINISTRATOR_PROOF_STORAGE_KEY = "personalSiteAdministratorProofV1";
/** Set once per tab, so a reload keeps the storage the first load wrote. */
const STORAGE_PREPARED_KEY = "socialPostsSpecStoragePrepared";

const API_BASE_URL = "https://game-stats.test";
const REACTIONS_ROUTE = /^\/social-posts\/([^/]+)\/reactions$/;
const PROFILES_PATH = "/social-profiles";
const reactionsUrl = (postId) => `${API_BASE_URL}/social-posts/${postId}/reactions`;
const profilesUrl = () => `${API_BASE_URL}${PROFILES_PATH}`;
/** The loose shape of a generated name: a capital and three to seven lowercase letters. */
const GENERATED_NAME = /^[A-Z][a-z]{3,7}$/;

const TEST_PROFILE = Object.freeze({
  id: "player-test",
  name: "Tesori",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});
const TEST_REACTOR = Object.freeze({
  id: TEST_PROFILE.id,
  name: TEST_PROFILE.name,
  icon: TEST_PROFILE.icon,
});
/** A hand-typed name the Worker's grammar refuses. */
const BOB_PROFILE = Object.freeze({
  id: "player-bob",
  name: "Bob",
  icon: TEST_PROFILE.icon,
  rerollCount: 0,
});
const ALICE = Object.freeze({ id: "player-alice", name: "Alice", icon: TEST_PROFILE.icon });
const BOB = Object.freeze({ id: BOB_PROFILE.id, name: BOB_PROFILE.name, icon: BOB_PROFILE.icon });
const CAROL = Object.freeze({ id: "player-carol", name: "Carol", icon: TEST_PROFILE.icon });
const ADMINISTRATOR_PROFILE = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
  rerollCount: 0,
});
/** The Administrator as the Worker lists them from its own record. */
const ADMINISTRATOR_REACTOR = Object.freeze({
  id: ADMINISTRATOR_PROFILE.id,
  name: ADMINISTRATOR_PROFILE.name,
  icon: ADMINISTRATOR_PROFILE.icon,
});
const ADMINISTRATOR_PROOF = `${"a".repeat(32)}.${"b".repeat(32)}`;

const EMPTY_LIKERS_TEXT = "No one has liked this yet.";
const NO_PROFILE_TEXT = "Create a profile in Game Progress to like this post.";
const OFFLINE_TEXT = "Couldn't reach the server. Your reaction is saved on this device.";
const PROFILE_REGISTERED_TEXT =
  "This profile is already registered from another device, so it can't react here.";
const PROFILE_NAME_REJECTED_TEXT =
  "Your profile name isn't a generated name, so it can't be used on posts.";
const PROFILE_BLOCKED_TEXT = "This profile can't react on posts.";

const POSTS = Object.freeze({
  "lois-post-happened": Object.freeze({
    windowId: "lois-post-happened-window",
    close: "#lois-post-happened-close",
    text: "so THIS happened",
    image: "assets/random-events/lois-post-happened.png",
  }),
  "lois-post-five-oclock": Object.freeze({
    windowId: "lois-post-five-oclock-window",
    close: "#lois-post-five-oclock-close",
    text: "It's got to be 5:00 somewhere, right?",
    image: "assets/random-events/lois-post-five-oclock.png",
  }),
});

const PERSISTENCE_VIEWPORTS = [REVIEW_VIEWPORT.mobile, REVIEW_VIEWPORT.desktop];

const jsonResponse = (status, body) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/** Chromium's console line for a response the page fetched with this status. */
const failedLoad = (status) =>
  `Failed to load resource: the server responded with a status of ${status}`;

/** The empty Game Stats snapshot `game-stats.js` asks for once a backend is configured. */
const EMPTY_STATS_SNAPSHOT = Object.freeze({
  generatedAt: "2026-03-04T12:00:00.000Z",
  totals: {},
  leaderboards: {},
  playerRanks: {},
  playerRecords: {},
});

/**
 * An in-memory stand-in for the Worker's social routes.
 *
 * `POST /social-profiles` registers `{ id, name, icon }` once per id: a name
 * outside the generator grammar or a malformed body is a 400, a known id a
 * 409 `profile-registered`, and a success a 201 with a token. A reaction post
 * is checked against that registration: an unknown id is a 404
 * `profile-unknown`, a token the fake revoked or never issued a 403
 * `profile-token-invalid`, a blocked id a 403 `profile-blocked`. The
 * Administrator reacts with `{ administrator: true }` under a Bearer header and
 * is listed under the fake's own record. Reactions hold one per profile per
 * post in arrival order, counts are totals and `null` removes. Every request
 * is recorded with its path, headers and parsed body. A non-200 `getStatus`
 * fails every GET and a non-200 `postStatus` every POST, registration included,
 * with the Worker's error body; an unknown path is a 404 as on the real Worker.
 */
const createReactionsFake = ({ getStatus = 200, postStatus = 200, blockedIds = [] } = {}) => {
  const posts = new Map();
  /** Registered profiles by id: `{ profile, token }`. */
  const profiles = new Map();
  const revokedTokens = new Set();
  const requests = [];
  let tokensIssued = 0;
  const entriesOf = (postId) => {
    if (!posts.has(postId)) posts.set(postId, new Map());
    return posts.get(postId);
  };
  const stateOf = (postId) => {
    const entries = [...entriesOf(postId).values()];
    const likes = entries
      .filter((entry) => entry.reaction === "like")
      .map((entry) => entry.profile);
    const dislikes = entries
      .filter((entry) => entry.reaction === "dislike")
      .map((entry) => entry.profile);
    return {
      ok: true,
      postId,
      likeCount: likes.length,
      dislikeCount: dislikes.length,
      likes,
      dislikes,
    };
  };
  const seed = (postId, profile, reaction) => {
    if (reaction === null) entriesOf(postId).delete(profile.id);
    else entriesOf(postId).set(profile.id, { profile, reaction });
  };
  /** Registers a profile as another device would and returns its token. */
  const registerProfile = ({ id, name, icon }) => {
    const token = `token-${id}-${++tokensIssued}`;
    profiles.set(id, { profile: { id, name, icon }, token });
    return token;
  };
  /** Frees the id and refuses its current token from now on, as a Worker-side reset does. */
  const revokeToken = (id) => {
    revokedTokens.add(profiles.get(id).token);
    profiles.delete(id);
  };
  const register = (body) => {
    const wellFormed =
      typeof body?.id === "string" &&
      typeof body.name === "string" &&
      GENERATED_NAME.test(body.name) &&
      typeof body.icon === "string";
    if (!wellFormed) return jsonResponse(400, { ok: false, code: "profile-invalid" });
    if (profiles.has(body.id)) return jsonResponse(409, { ok: false, code: "profile-registered" });
    const token = registerProfile(body);
    return jsonResponse(201, { ok: true, profile: profiles.get(body.id).profile, token });
  };
  const react = (postId, body, headers) => {
    if (body?.administrator === true) {
      if (!/^Bearer \S+$/.test(headers.authorization ?? "")) {
        return jsonResponse(401, { ok: false, code: "administrator-proof-invalid" });
      }
      seed(postId, ADMINISTRATOR_REACTOR, body.reaction);
      return jsonResponse(200, stateOf(postId));
    }
    if (revokedTokens.has(body?.token)) {
      return jsonResponse(403, { ok: false, code: "profile-token-invalid" });
    }
    const registered = profiles.get(body?.profileId);
    if (!registered) return jsonResponse(404, { ok: false, code: "profile-unknown" });
    if (registered.token !== body.token) {
      return jsonResponse(403, { ok: false, code: "profile-token-invalid" });
    }
    if (blockedIds.includes(registered.profile.id)) {
      return jsonResponse(403, { ok: false, code: "profile-blocked" });
    }
    seed(postId, registered.profile, body.reaction);
    return jsonResponse(200, stateOf(postId));
  };
  const handle = async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const match = path.match(REACTIONS_ROUTE);
    const record = {
      method: request.method(),
      path,
      postId: match?.[1] ?? null,
      headers: request.headers(),
      body: request.postData() ? JSON.parse(request.postData()) : null,
    };
    requests.push(record);
    const forcedStatus = record.method === "POST" ? postStatus : getStatus;
    if (forcedStatus !== 200) {
      await route.fulfill(jsonResponse(forcedStatus, { ok: false, error: "Unavailable" }));
      return;
    }
    if (path === PROFILES_PATH && record.method === "POST") {
      await route.fulfill(register(record.body));
      return;
    }
    if (!match) {
      await route.fulfill(jsonResponse(404, { ok: false, error: "Not found" }));
      return;
    }
    if (record.method === "POST") {
      await route.fulfill(react(record.postId, record.body, record.headers));
      return;
    }
    await route.fulfill(jsonResponse(200, stateOf(record.postId)));
  };
  return {
    handle,
    requests,
    seed,
    registerProfile,
    revokeToken,
    forgetProfile: (id) => profiles.delete(id),
    tokenOf: (id) => profiles.get(id)?.token ?? null,
    posts: () => requests.filter((record) => record.method === "POST" && record.postId),
    registrations: () =>
      requests.filter((record) => record.method === "POST" && record.path === PROFILES_PATH),
    reactionOf: (postId, profileId) => entriesOf(postId).get(profileId)?.reaction ?? null,
  };
};

/**
 * Opens Home with clean storage, an optional seeded profile, registration
 * record and proof, every random draw pinned high and the Game Stats backend
 * answered by `reactions` (the stats snapshot is empty), then dismisses the
 * About window. Storage is reset only on the tab's first load, so
 * `page.reload()` observes what the page persisted.
 */
const preparePage = async (
  page,
  viewport,
  { profile = null, profileRecord = null, proof = null, reactions = createReactionsFake() } = {},
) => {
  await page.setViewportSize(viewport);
  await installGameStatsBackend(page, { apiBaseUrl: API_BASE_URL });
  await page.route(`${API_BASE_URL}/**`, (route) =>
    new URL(route.request().url()).pathname === "/stats"
      ? route.fulfill(jsonResponse(200, EMPTY_STATS_SNAPSHOT))
      : reactions.handle(route),
  );
  await page.addInitScript(
    ({ preparedKey, profile, profileKey, profileRecord, profileRecordKey, proof, proofKey }) => {
      if (!sessionStorage.getItem(preparedKey)) {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem(preparedKey, "1");
        if (profile) localStorage.setItem(profileKey, JSON.stringify(profile));
        if (profileRecord) localStorage.setItem(profileRecordKey, JSON.stringify(profileRecord));
        if (proof) sessionStorage.setItem(proofKey, JSON.stringify(proof));
      }
      Math.random = () => 0.999999;
    },
    {
      preparedKey: STORAGE_PREPARED_KEY,
      profile,
      profileKey: PROFILE_STORAGE_KEY,
      profileRecord,
      profileRecordKey: PROFILE_RECORD_STORAGE_KEY,
      proof,
      proofKey: ADMINISTRATOR_PROOF_STORAGE_KEY,
    },
  );
  await page.goto("/home.html", { waitUntil: "load" });
  await dismissAbout(page);
  return reactions;
};

const dismissAbout = async (page) => {
  const aboutClose = page.locator('#about-window [data-close="about"]');
  if (await aboutClose.isVisible()) await aboutClose.click();
  await expect(page.locator("#about-window")).toBeHidden();
};

/** Forces one event the way a developer does from the console. */
const forceEvent = (page, eventId) =>
  page.evaluate(async (id) => {
    await window.homeResources.loadAdminResources();
    return window.rohinAdminOrchestrator.runEvent(id, { source: "dev" });
  }, eventId);

/** Forces one event and returns its open window. */
const openPost = async (page, eventId) => {
  const result = await forceEvent(page, eventId);
  expect(result.ok, result.message).toBe(true);
  return expectOpen(page, eventId);
};

/** The live window: the Administrator preview clones the same ids. */
const liveWindow = (page, eventId) =>
  page.locator(`#${POSTS[eventId].windowId}:not([data-admin-event-preview-window])`);

const parts = (win) => {
  const systemRows = (text) =>
    win.locator('[data-social-post-log][role="log"] .is-system p', { hasText: text });
  return {
    count: win.locator("[data-social-post-like-count]"),
    dislikeCount: win.locator("[data-social-post-dislike-count]"),
    like: win.locator("button.social-post-like[data-social-post-like]"),
    dislike: win.locator("button.social-post-dislike[data-social-post-dislike]"),
    likers: win.locator("ul[data-social-post-likers]"),
    likerRows: win.locator("ul[data-social-post-likers] li"),
    log: win.locator('[data-social-post-log][role="log"]'),
    logEntries: win.locator('[data-social-post-log][role="log"] p'),
    offlineRows: systemRows(OFFLINE_TEXT),
    systemRows,
  };
};

const expectOpen = async (page, eventId) => {
  const win = liveWindow(page, eventId);
  await expect(win, `${eventId} opens`).toBeVisible();
  await expect(win).toHaveAttribute("aria-hidden", "false");
  await expect(win).not.toHaveClass(/is-opening/);
  await expect(win, `${eventId} is a dialog`).toHaveAttribute("role", "dialog");
  await expect(win).not.toHaveAttribute("aria-modal", "true");
  return win;
};

/** Waits for the fake to hold `reaction` for the visitor on `postId`. */
const expectServerReaction = (reactions, postId, reaction) =>
  expect
    .poll(() => reactions.reactionOf(postId, TEST_PROFILE.id), {
      message: `the Worker holds ${JSON.stringify(reaction)} for ${postId}`,
    })
    .toBe(reaction);

const readStorage = (page, key) =>
  page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)), key);

/** The registration record this device keeps for the test profile. */
const expectedRecord = (token) => ({
  profileId: TEST_PROFILE.id,
  token,
  name: TEST_PROFILE.name,
  icon: TEST_PROFILE.icon,
});

/** Geometry of the window, its post image and the document, in CSS pixels. */
const measure = (win, imageSelector) =>
  win.evaluate((element, selector) => {
    const bounds = (node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const image = element.querySelector(selector);
    const body = element.querySelector(".window-body");
    return {
      win: bounds(element),
      image: bounds(image),
      imageNaturalWidth: image.naturalWidth,
      imageComplete: image.complete,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      documentOverflow:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.documentElement.scrollHeight > window.innerHeight,
      taskbarTop: document.querySelector(".taskbar").getBoundingClientRect().top,
    };
  }, imageSelector);

for (const viewport of REVIEW_VIEWPORTS) {
  test(`"so THIS happened" opens, gates Like behind a profile and closes on Escape at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    const eventId = "lois-post-happened";
    const post = POSTS[eventId];
    const reactions = await preparePage(page, viewport);

    // Something outside the window holds focus, so the close path has a
    // concrete element to hand focus back to.
    const startButton = page.locator(".start-button");
    await startButton.focus();
    await expect(startButton).toBeFocused();

    const win = await openPost(page, eventId);
    const { count, like, likerRows, logEntries } = parts(win);

    await expect(win.locator(".title-bar-text").first()).toHaveText(/\S/);
    await expect(win).toHaveClass(/\bsocial-post-window\b/);
    await expect(win).toHaveClass(/\bevent-chat-window\b/);
    await expect(win.getByText("Lois Griffin").first()).toBeVisible();
    await expect(win.getByText(post.text, { exact: true })).toBeVisible();
    await expect(like, "Like takes focus when the post opens").toBeFocused();
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await expect(count).toHaveText("0 likes");
    await expect(likerRows).toHaveCount(1);
    await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);

    const imageSelector = `img[data-src="${post.image}"]`;
    const postImage = win.locator(imageSelector);
    await expect(postImage).toHaveAttribute("width", /^\d+$/);
    await expect(postImage).toHaveAttribute("height", /^\d+$/);
    await expect
      .poll(() => postImage.evaluate((image) => image.naturalWidth), {
        message: "the post image decodes",
      })
      .toBeGreaterThan(0);
    const metrics = await measure(win, imageSelector);
    expect(metrics.imageComplete).toBe(true);
    expect(metrics.image.left, "image left edge inside the window").toBeGreaterThanOrEqual(
      metrics.win.left,
    );
    expect(metrics.image.right, "image right edge inside the window").toBeLessThanOrEqual(
      metrics.win.right + 0.5,
    );
    expect(metrics.image.top).toBeGreaterThanOrEqual(metrics.win.top);
    expect(metrics.image.bottom).toBeLessThanOrEqual(metrics.win.bottom + 0.5);
    expect(
      metrics.bodyScrollWidth,
      "the window body has no horizontal overflow",
    ).toBeLessThanOrEqual(metrics.bodyClientWidth);
    expect(metrics.documentOverflow, "nothing overflows the viewport").toBe(false);
    expect(metrics.win.left).toBeGreaterThanOrEqual(0);
    expect(metrics.win.top).toBeGreaterThanOrEqual(0);
    expect(metrics.win.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(metrics.win.bottom).toBeLessThanOrEqual(metrics.taskbarTop + 1);

    // Opening asked the Worker for the post's state.
    await expect
      .poll(() => reactions.requests.map((record) => `${record.method} ${record.postId}`))
      .toEqual([`GET ${eventId}`]);

    // No profile: the Like is refused, the log says how to get one and
    // nothing is sent to the Worker.
    const entriesBefore = await logEntries.count();
    await like.click();
    await expect(count).toHaveText("0 likes");
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await expect(likerRows).toHaveCount(1);
    await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);
    await expect(logEntries).toHaveCount(entriesBefore + 1);
    await expect(logEntries.last()).toHaveText(NO_PROFILE_TEXT);
    expect(await readStorage(page, LIKES_STORAGE_KEY)).toBeNull();
    expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY)).toBeNull();
    await settleFrames(page);
    expect(reactions.posts(), "a refused press sends nothing").toEqual([]);
    expect(reactions.registrations(), "a refused press registers nothing").toEqual([]);

    expect(await scanForViolations(page, testInfo, `social-post-${viewport.name}`)).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(win).toHaveAttribute("aria-hidden", "true");
    await expect(win).toBeHidden();
    await expect(win).toHaveClass(/is-hidden/);
    await expect(startButton, "focus returns to where it was").toBeFocused();
  });
}

for (const viewport of PERSISTENCE_VIEWPORTS) {
  test(`a profile can like, unlike and keep a like across a reload at ${viewport.name}`, async ({
    page,
  }) => {
    const eventId = "lois-post-happened";
    const reactions = await preparePage(page, viewport, { profile: TEST_PROFILE });

    let win = await openPost(page, eventId);
    let { count, like, likerRows, logEntries } = parts(win);
    await expect(like).toBeFocused();
    await expect(count).toHaveText("0 likes");

    await like.click();
    await expect(count).toHaveText("1 like");
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expect(likerRows).toHaveCount(1);
    await expect(likerRows.first()).toContainText("Tesori");
    await expect(likerRows.first()).not.toHaveText(EMPTY_LIKERS_TEXT);
    await expect(logEntries.last()).toHaveText("Tesori liked this.");
    await expect(logEntries.last().locator("strong")).toHaveText("Tesori");
    await expectServerReaction(reactions, eventId, "like");
    // The first press registered this device, then reacted under the token.
    const token = reactions.tokenOf(TEST_PROFILE.id);
    expect(token).toMatch(/^token-/);
    expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY)).toEqual(expectedRecord(token));

    await like.click();
    await expect(count).toHaveText("0 likes");
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await expect(likerRows).toHaveCount(1);
    await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);
    await expect(logEntries, "removing the like removes its row").toHaveCount(0);
    await expectServerReaction(reactions, eventId, null);

    await page.reload({ waitUntil: "load" });
    await dismissAbout(page);
    win = await openPost(page, eventId);
    let dislike;
    let dislikeCount;
    ({ count, dislikeCount, like, dislike, likerRows, logEntries } = parts(win));
    await expect(count, "the unlike was persisted").toHaveText("0 likes");
    await expect(dislikeCount).toHaveText("0 dislikes");
    await like.click();
    await expect(count).toHaveText("1 like");
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expectServerReaction(reactions, eventId, "like");

    // A dislike replaces the like: one reaction per profile.
    await dislike.click();
    await expect(dislikeCount).toHaveText("1 dislike");
    await expect(dislike).toHaveAttribute("aria-pressed", "true");
    await expect(count).toHaveText("0 likes");
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);
    await expect(logEntries).toHaveCount(1);
    await expect(logEntries.last()).toHaveText("Tesori disliked this.");
    await expectServerReaction(reactions, eventId, "dislike");
    await dislike.click();
    await expect(dislikeCount).toHaveText("0 dislikes");
    await expect(dislike).toHaveAttribute("aria-pressed", "false");
    await expect(logEntries, "removing the dislike removes its row").toHaveCount(0);
    await expectServerReaction(reactions, eventId, null);
    await like.click();
    await expect(count).toHaveText("1 like");
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expectServerReaction(reactions, eventId, "like");
    expect(await readStorage(page, LIKES_STORAGE_KEY)).toEqual({ [eventId]: [TEST_REACTOR] });

    await page.reload({ waitUntil: "load" });
    await dismissAbout(page);
    win = await openPost(page, eventId);
    ({ count, like, likerRows } = parts(win));
    await expect(count, "the like survives a reload").toHaveText("1 like");
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expect(likerRows).toHaveCount(1);
    await expect(likerRows.first()).toContainText("Tesori");
    expect(
      await page.evaluate((key) => window.homeEventSocialPosts.readSocialPostLikes()[key], eventId),
    ).toEqual([TEST_REACTOR]);

    // One registration for the whole session, reloads included; every press
    // reused the stored token.
    expect(reactions.registrations()).toHaveLength(1);
    expect(reactions.posts().map((record) => record.body.token)).toEqual(Array(6).fill(token));
    expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY)).toEqual(expectedRecord(token));

    await win.locator(POSTS[eventId].close).click();
    await expect(win).toBeHidden();
  });
}

test("opening a post shows the Worker's reactions: counts, likers and the log in order", async ({
  page,
}) => {
  const eventId = "lois-post-five-oclock";
  const reactions = createReactionsFake();
  reactions.seed(eventId, ALICE, "like");
  reactions.seed(eventId, BOB, "like");
  reactions.seed(eventId, CAROL, "dislike");
  // The other post stays untouched, so its state must not leak across.
  reactions.seed("lois-post-happened", CAROL, "like");
  await preparePage(page, REVIEW_VIEWPORT.desktop, { reactions });

  const win = await openPost(page, eventId);
  const { count, dislikeCount, like, dislike, likerRows, logEntries } = parts(win);
  await expect(count).toHaveText("2 likes");
  await expect(dislikeCount).toHaveText("1 dislike");
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(dislike).toHaveAttribute("aria-pressed", "false");
  await expect(likerRows).toHaveText(["Alice", "Bob"]);
  await expect(logEntries).toHaveText([
    "Alice liked this.",
    "Bob liked this.",
    "Carol disliked this.",
  ]);
  expect(reactions.requests.map((record) => `${record.method} ${record.postId}`)).toEqual([
    `GET ${eventId}`,
  ]);
  expect(reactions.requests[0].headers.accept).toBe("application/json");
  expect(
    await readStorage(page, LIKES_STORAGE_KEY),
    "other visitors' reactions are not cached on this device",
  ).toBeNull();
});

test("a first press registers the device, then reacts under the token; later presses reuse it", async ({
  page,
}) => {
  const eventId = "lois-post-happened";
  const reactions = createReactionsFake();
  reactions.seed(eventId, ALICE, "like");
  reactions.seed(eventId, CAROL, "dislike");
  await preparePage(page, REVIEW_VIEWPORT.desktop, { profile: TEST_PROFILE, reactions });

  const win = await openPost(page, eventId);
  const { count, dislikeCount, like, dislike, likerRows, logEntries } = parts(win);
  await expect(count).toHaveText("1 like");
  await expect(dislikeCount).toHaveText("1 dislike");

  await like.click();
  await expect(count).toHaveText("2 likes");
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expectServerReaction(reactions, eventId, "like");
  await expect(likerRows, "the visitor appears once, after earlier likers").toHaveText([
    "Alice",
    "Tesori",
  ]);
  await expect(logEntries).toHaveText([
    "Alice liked this.",
    "Tesori liked this.",
    "Carol disliked this.",
  ]);
  const token = reactions.tokenOf(TEST_PROFILE.id);
  expect(
    reactions.requests.map((record) => `${record.method} ${record.path}`),
    "registration precedes the reaction",
  ).toEqual([
    `GET /social-posts/${eventId}/reactions`,
    `POST ${PROFILES_PATH}`,
    `POST /social-posts/${eventId}/reactions`,
  ]);
  const [registration] = reactions.registrations();
  expect(registration.body).toEqual(TEST_REACTOR);
  expect(registration.headers["content-type"]).toBe("application/json");
  expect(registration.headers.accept).toBe("application/json");
  expect(registration.headers.authorization).toBeUndefined();
  const [likePost] = reactions.posts();
  expect(likePost.postId).toBe(eventId);
  expect(likePost.body, "the reaction carries the id and token, never a name").toEqual({
    profileId: TEST_PROFILE.id,
    token,
    reaction: "like",
  });
  expect(likePost.headers["content-type"]).toBe("application/json");
  expect(likePost.headers.accept).toBe("application/json");
  expect(likePost.headers.authorization, "only the Administrator sends a proof").toBeUndefined();
  expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY)).toEqual(expectedRecord(token));

  await dislike.click();
  await expect(dislikeCount).toHaveText("2 dislikes");
  await expect(count).toHaveText("1 like");
  await expect(dislike).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expectServerReaction(reactions, eventId, "dislike");
  await expect(likerRows).toHaveText(["Alice"]);
  await expect(logEntries).toHaveText([
    "Alice liked this.",
    "Carol disliked this.",
    "Tesori disliked this.",
  ]);

  await dislike.click();
  await expect(dislikeCount).toHaveText("1 dislike");
  await expect(dislike).toHaveAttribute("aria-pressed", "false");
  await expectServerReaction(reactions, eventId, null);
  await expect(logEntries).toHaveText(["Alice liked this.", "Carol disliked this."]);
  expect(reactions.registrations(), "the token is reused, no second registration").toHaveLength(1);
  expect(reactions.posts().map((record) => record.body)).toEqual([
    { profileId: TEST_PROFILE.id, token, reaction: "like" },
    { profileId: TEST_PROFILE.id, token, reaction: "dislike" },
    { profileId: TEST_PROFILE.id, token, reaction: null },
  ]);
  expect(
    await readStorage(page, LIKES_STORAGE_KEY),
    "the device cache holds only the visitor's own reaction",
  ).toEqual({ [eventId]: [] });
});

test("a token the Worker refuses is dropped and the device registers once more", async ({
  page,
  diagnostics,
}) => {
  const eventId = "lois-post-happened";
  const reactions = createReactionsFake();
  const staleToken = reactions.registerProfile(TEST_REACTOR);
  reactions.revokeToken(TEST_PROFILE.id);
  await preparePage(page, REVIEW_VIEWPORT.desktop, {
    profile: TEST_PROFILE,
    profileRecord: expectedRecord(staleToken),
    reactions,
  });

  const win = await openPost(page, eventId);
  const { count, like, likerRows, logEntries, systemRows } = parts(win);

  // 403 profile-token-invalid: register again, then react under the new token.
  await like.click();
  await expect(count).toHaveText("1 like");
  await expectServerReaction(reactions, eventId, "like");
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(likerRows).toHaveText(["Tesori"]);
  await expect(logEntries).toHaveText(["Tesori liked this."]);
  const freshToken = reactions.tokenOf(TEST_PROFILE.id);
  expect(freshToken).not.toBe(staleToken);
  expect(reactions.registrations()).toHaveLength(1);
  expect(reactions.posts().map((record) => record.body.token)).toEqual([staleToken, freshToken]);
  expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY)).toEqual(expectedRecord(freshToken));

  // 404 profile-unknown: the Worker forgot the device; the same recovery applies.
  reactions.forgetProfile(TEST_PROFILE.id);
  await like.click();
  await expect(count).toHaveText("0 likes");
  await expectServerReaction(reactions, eventId, null);
  await expect(like).toHaveAttribute("aria-pressed", "false");
  const newestToken = reactions.tokenOf(TEST_PROFILE.id);
  expect(newestToken).not.toBe(freshToken);
  expect(reactions.registrations()).toHaveLength(2);
  expect(reactions.posts().map((record) => record.body.token)).toEqual([
    staleToken,
    freshToken,
    freshToken,
    newestToken,
  ]);
  expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY)).toEqual(expectedRecord(newestToken));
  await expect(systemRows(/./), "a recovered press shows no system row").toHaveCount(0);

  consumeDiagnostics(diagnostics, {
    errorResponses: [`403 ${reactionsUrl(eventId)}`, `404 ${reactionsUrl(eventId)}`],
    consoleErrors: [failedLoad(403), failedLoad(404)],
  });
});

test("a profile registered from another device cannot react here, and the press is taken back", async ({
  page,
  diagnostics,
}) => {
  const eventId = "lois-post-happened";
  const reactions = createReactionsFake();
  reactions.seed(eventId, ALICE, "like");
  reactions.registerProfile(TEST_REACTOR);
  await preparePage(page, REVIEW_VIEWPORT.desktop, { profile: TEST_PROFILE, reactions });

  const win = await openPost(page, eventId);
  const { count, like, likerRows, logEntries, systemRows } = parts(win);
  await expect(count).toHaveText("1 like");

  await like.click();
  await expect(systemRows(PROFILE_REGISTERED_TEXT)).toHaveCount(1);
  await expect(count, "the optimistic like is taken back").toHaveText("1 like");
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(likerRows).toHaveText(["Alice"]);
  await expect(logEntries).toHaveText(["Alice liked this.", PROFILE_REGISTERED_TEXT]);
  expect(reactions.reactionOf(eventId, TEST_PROFILE.id)).toBeNull();
  expect(reactions.posts(), "no reaction is sent without a token").toEqual([]);
  expect(reactions.registrations()).toHaveLength(1);
  expect(await readStorage(page, LIKES_STORAGE_KEY), "the cache is reverted").toEqual({
    [eventId]: [],
  });
  expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY), "no token is kept").toBeNull();

  // Another press tries again and reports once more, not twice.
  await like.click();
  await expect(systemRows(PROFILE_REGISTERED_TEXT)).toHaveCount(1);
  await expect(count).toHaveText("1 like");
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(logEntries).toHaveText(["Alice liked this.", PROFILE_REGISTERED_TEXT]);
  expect(reactions.registrations()).toHaveLength(2);

  consumeDiagnostics(diagnostics, {
    errorResponses: [`409 ${profilesUrl()}`, `409 ${profilesUrl()}`],
    consoleErrors: [failedLoad(409), failedLoad(409)],
  });
});

test("a blocked profile is told so and its press is taken back", async ({ page, diagnostics }) => {
  const eventId = "lois-post-five-oclock";
  const reactions = createReactionsFake({ blockedIds: [TEST_PROFILE.id] });
  reactions.seed(eventId, CAROL, "dislike");
  await preparePage(page, REVIEW_VIEWPORT.desktop, { profile: TEST_PROFILE, reactions });

  const win = await openPost(page, eventId);
  const { count, dislikeCount, dislike, likerRows, logEntries, systemRows } = parts(win);
  await expect(dislikeCount).toHaveText("1 dislike");

  await dislike.click();
  await expect(systemRows(PROFILE_BLOCKED_TEXT)).toHaveCount(1);
  await expect(dislikeCount, "the optimistic dislike is taken back").toHaveText("1 dislike");
  await expect(count).toHaveText("0 likes");
  await expect(dislike).toHaveAttribute("aria-pressed", "false");
  await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);
  await expect(logEntries).toHaveText(["Carol disliked this.", PROFILE_BLOCKED_TEXT]);
  expect(reactions.reactionOf(eventId, TEST_PROFILE.id)).toBeNull();
  // Registration itself went through; only the reaction was refused.
  const token = reactions.tokenOf(TEST_PROFILE.id);
  expect(reactions.registrations()).toHaveLength(1);
  expect(reactions.posts().map((record) => record.body)).toEqual([
    { profileId: TEST_PROFILE.id, token, reaction: "dislike" },
  ]);
  expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY)).toEqual(expectedRecord(token));
  expect(
    await page.evaluate(
      (key) => window.homeEventSocialPosts.readSocialPostDislikes()[key],
      eventId,
    ),
    "the cache is reverted",
  ).toEqual([]);

  consumeDiagnostics(diagnostics, {
    errorResponses: [`403 ${reactionsUrl(eventId)}`],
    consoleErrors: [failedLoad(403)],
  });
});

test("a name outside the generator grammar is refused and the press is taken back", async ({
  page,
  diagnostics,
}) => {
  const eventId = "lois-post-happened";
  const reactions = createReactionsFake();
  reactions.seed(eventId, ALICE, "like");
  await preparePage(page, REVIEW_VIEWPORT.mobile, { profile: BOB_PROFILE, reactions });

  const win = await openPost(page, eventId);
  const { count, like, likerRows, logEntries, systemRows } = parts(win);
  await expect(count).toHaveText("1 like");

  await like.click();
  await expect(systemRows(PROFILE_NAME_REJECTED_TEXT)).toHaveCount(1);
  await expect(count).toHaveText("1 like");
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(likerRows).toHaveText(["Alice"]);
  await expect(logEntries).toHaveText(["Alice liked this.", PROFILE_NAME_REJECTED_TEXT]);
  expect(reactions.registrations().map((record) => record.body)).toEqual([BOB]);
  expect(reactions.posts()).toEqual([]);
  expect(reactions.reactionOf(eventId, BOB.id)).toBeNull();
  expect(await readStorage(page, LIKES_STORAGE_KEY)).toEqual({ [eventId]: [] });
  expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY)).toBeNull();

  consumeDiagnostics(diagnostics, {
    errorResponses: [`400 ${profilesUrl()}`],
    consoleErrors: [failedLoad(400)],
  });
});

test("the Administrator's press carries the stored proof as a Bearer token and never registers", async ({
  page,
}) => {
  const eventId = "lois-post-happened";
  const reactions = await preparePage(page, REVIEW_VIEWPORT.desktop, {
    profile: ADMINISTRATOR_PROFILE,
    proof: {
      proof: ADMINISTRATOR_PROOF,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });

  const win = await openPost(page, eventId);
  const { count, like, likerRows, logEntries } = parts(win);
  await like.click();
  await expect(count).toHaveText("1 like");
  await expect.poll(() => reactions.reactionOf(eventId, ADMINISTRATOR_PROFILE.id)).toBe("like");
  await expect(likerRows, "the name comes from the Worker's record").toHaveText(["rohin ^.^"]);
  await expect(logEntries).toHaveText(["rohin ^.^ liked this."]);
  const [post] = reactions.posts();
  expect(post.headers.authorization).toBe(`Bearer ${ADMINISTRATOR_PROOF}`);
  expect(post.body).toEqual({ administrator: true, reaction: "like" });
  expect(reactions.registrations(), "the Administrator is never registered").toEqual([]);
  expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY)).toBeNull();
});

test("a failed post keeps the reaction on this device and says so once", async ({
  page,
  diagnostics,
}) => {
  const eventId = "lois-post-happened";
  const reactions = createReactionsFake({ postStatus: 503 });
  reactions.seed(eventId, ALICE, "like");
  await preparePage(page, REVIEW_VIEWPORT.desktop, { profile: TEST_PROFILE, reactions });

  const win = await openPost(page, eventId);
  const { count, like, likerRows, logEntries, offlineRows } = parts(win);
  await expect(count).toHaveText("1 like");

  await like.click();
  await expect(offlineRows).toHaveCount(1);
  await expect(count, "the optimistic like stays").toHaveText("2 likes");
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(likerRows).toHaveText(["Alice", "Tesori"]);
  await expect(logEntries).toHaveText(["Alice liked this.", "Tesori liked this.", OFFLINE_TEXT]);
  expect(reactions.reactionOf(eventId, TEST_PROFILE.id), "the Worker never applied it").toBeNull();
  expect(await readStorage(page, LIKES_STORAGE_KEY)).toEqual({ [eventId]: [TEST_REACTOR] });
  expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY), "no token was issued").toBeNull();

  // A second failed press re-renders the log and reports the failure once more, not twice.
  await like.click();
  await expect(count).toHaveText("1 like");
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(offlineRows).toHaveCount(1);
  await expect(logEntries).toHaveText(["Alice liked this.", OFFLINE_TEXT]);
  // Registration failed each time, so no reaction was ever sent.
  expect(reactions.registrations()).toHaveLength(2);
  expect(reactions.posts()).toEqual([]);

  consumeDiagnostics(diagnostics, {
    errorResponses: [`503 ${profilesUrl()}`, `503 ${profilesUrl()}`],
    consoleErrors: [failedLoad(503), failedLoad(503)],
  });
});

test("an older Worker without the routes behaves like a failure", async ({ page, diagnostics }) => {
  const eventId = "lois-post-five-oclock";
  const reactions = await preparePage(page, REVIEW_VIEWPORT.mobile, {
    profile: TEST_PROFILE,
    reactions: createReactionsFake({ getStatus: 404, postStatus: 404 }),
  });

  const win = await openPost(page, eventId);
  const { count, dislikeCount, like, likerRows, logEntries, offlineRows } = parts(win);
  await expect(count).toHaveText("0 likes");
  await expect(logEntries, "a failed load is silent").toHaveCount(0);

  await like.click();
  await expect(offlineRows).toHaveCount(1);
  await expect(count).toHaveText("1 like");
  await expect(dislikeCount).toHaveText("0 dislikes");
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(likerRows).toHaveText(["Tesori"]);
  await expect(logEntries).toHaveText(["Tesori liked this.", OFFLINE_TEXT]);

  await like.click();
  await expect(count).toHaveText("0 likes");
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);
  await expect(logEntries).toHaveText([OFFLINE_TEXT]);
  expect(reactions.registrations()).toHaveLength(2);
  expect(reactions.posts()).toEqual([]);
  expect(await readStorage(page, PROFILE_RECORD_STORAGE_KEY)).toBeNull();

  consumeDiagnostics(diagnostics, {
    errorResponses: [
      `404 ${reactionsUrl(eventId)}`,
      `404 ${profilesUrl()}`,
      `404 ${profilesUrl()}`,
    ],
    consoleErrors: [failedLoad(404), failedLoad(404), failedLoad(404)],
  });
});

test(`"5:00 somewhere" opens beside an open post, and a post refuses a repeat trigger`, async ({
  page,
}) => {
  await preparePage(page, REVIEW_VIEWPORT.desktop);
  const first = "lois-post-happened";
  const second = "lois-post-five-oclock";

  const firstWindow = await openPost(page, first);

  // Observed runtime behaviour: `runEvent` refuses only the event whose own
  // window is already open (the "already open" result), and the interactive
  // kind limit applies to natural triggers, not to a forced run. So forcing
  // the other post while the first is open neither queues nor refuses it: the
  // second post opens as a separate window stacked above the first, and the
  // first stays where it was. Forcing the same post again is refused.
  const secondWindow = await openPost(page, second);
  await expect(firstWindow).toBeVisible();
  const [firstZ, secondZ] = await Promise.all([
    firstWindow.evaluate((element) => Number(element.style.zIndex)),
    secondWindow.evaluate((element) => Number(element.style.zIndex)),
  ]);
  expect(secondZ, "the second post stacks above the first").toBeGreaterThan(firstZ);
  const repeatResult = await forceEvent(page, first);
  expect(repeatResult.ok).toBe(false);
  expect(repeatResult.message).toMatch(/already open/);
  await expect(page.locator(".social-post-window:not(.is-hidden)")).toHaveCount(2);
  await secondWindow.locator(POSTS[second].close).click();
  await expect(secondWindow).toBeHidden();

  await firstWindow.locator(POSTS[first].close).click();
  await expect(firstWindow).toBeHidden();
  await expect(firstWindow).toHaveAttribute("aria-hidden", "true");

  const win = await openPost(page, second);
  const { count, like, likerRows } = parts(win);
  await expect(win.getByText(POSTS[second].text, { exact: true })).toBeVisible();
  await expect(win.locator(`img[data-src="${POSTS[second].image}"]`)).toBeVisible();
  await expect(like).toBeFocused();
  await expect(count).toHaveText("0 likes");
  await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);
  await expect(liveWindow(page, first)).toBeHidden();

  // Both posts share the Facebook title; each dialog is still labelled by its own title id.
  const titles = await page
    .locator(
      `#${POSTS[first].windowId}:not([data-admin-event-preview-window]) .title-bar-text, ` +
        `#${POSTS[second].windowId}:not([data-admin-event-preview-window]) .title-bar-text`,
    )
    .allTextContents();
  expect(titles.map((title) => title.trim())).toEqual(["Facebook", "Facebook"]);

  await win.locator(POSTS[second].close).click();
  await expect(win).toBeHidden();
});
