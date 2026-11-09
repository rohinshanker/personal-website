/**
 * Behavioural cover for the two Lois Griffin social-post random events.
 *
 * Both windows share one script, one storage pair and one reaction model: the
 * count labels, the likers list, the activity log and the profile gate are
 * driven by `scripts/home/events/social-posts.js`, and every reaction is
 * shared through the Game Stats Worker's `/social-posts/{postId}/reactions`
 * route. These cases force each event through the Administrator orchestrator
 * against an in-memory stand-in for that route and assert the rendered result
 * at every review viewport: the managed window lifecycle, focus, geometry, the
 * Like toggle with and without a Game Progress profile, persistence across a
 * reload, server state on open, what a press sends, the per-device fallback
 * when the Worker fails, how a second post behaves while the first is open, and
 * an axe scan of the open window.
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
const ADMINISTRATOR_PROOF_STORAGE_KEY = "personalSiteAdministratorProofV1";
/** Set once per tab, so a reload keeps the storage the first load wrote. */
const STORAGE_PREPARED_KEY = "socialPostsSpecStoragePrepared";

const API_BASE_URL = "https://game-stats.test";
const REACTIONS_ROUTE = /^\/social-posts\/([^/]+)\/reactions$/;
const reactionsUrl = (postId) => `${API_BASE_URL}/social-posts/${postId}/reactions`;

const TEST_PROFILE = Object.freeze({
  id: "player-test",
  name: "Tester",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});
const TEST_REACTOR = Object.freeze({
  id: TEST_PROFILE.id,
  name: TEST_PROFILE.name,
  icon: TEST_PROFILE.icon,
});
const ALICE = Object.freeze({ id: "player-alice", name: "Alice", icon: TEST_PROFILE.icon });
const BOB = Object.freeze({ id: "player-bob", name: "Bob", icon: TEST_PROFILE.icon });
const CAROL = Object.freeze({ id: "player-carol", name: "Carol", icon: TEST_PROFILE.icon });
const ADMINISTRATOR_PROFILE = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
  rerollCount: 0,
});
const ADMINISTRATOR_PROOF = `${"a".repeat(32)}.${"b".repeat(32)}`;

const EMPTY_LIKERS_TEXT = "No one has liked this yet.";
const NO_PROFILE_TEXT = "Create a profile in Game Progress to like this post.";
const OFFLINE_TEXT = "Couldn't reach the server. Your reaction is saved on this device.";

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

/** The empty Game Stats snapshot `game-stats.js` asks for once a backend is configured. */
const EMPTY_STATS_SNAPSHOT = Object.freeze({
  generatedAt: "2026-03-04T12:00:00.000Z",
  totals: {},
  leaderboards: {},
  playerRanks: {},
  playerRecords: {},
});

/**
 * An in-memory stand-in for the Worker's reactions route: one reaction per
 * profile per post, lists in arrival order, counts as totals, `null` removes.
 * Every request is recorded with its headers and parsed body. A non-200
 * `getStatus` or `postStatus` makes that method fail with the Worker's error
 * body instead, and an unknown path is a 404 as on the real Worker.
 */
const createReactionsFake = ({ getStatus = 200, postStatus = 200 } = {}) => {
  const posts = new Map();
  const requests = [];
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
  const handle = async (route) => {
    const request = route.request();
    const match = new URL(request.url()).pathname.match(REACTIONS_ROUTE);
    const record = {
      method: request.method(),
      postId: match?.[1] ?? null,
      headers: request.headers(),
      body: request.postData() ? JSON.parse(request.postData()) : null,
    };
    requests.push(record);
    const status = match ? (record.method === "POST" ? postStatus : getStatus) : 404;
    if (status !== 200) {
      await route.fulfill(jsonResponse(status, { ok: false, error: "Unavailable" }));
      return;
    }
    if (record.method === "POST") seed(record.postId, record.body.profile, record.body.reaction);
    await route.fulfill(jsonResponse(200, stateOf(record.postId)));
  };
  return {
    handle,
    requests,
    seed,
    posts: () => requests.filter((record) => record.method === "POST"),
    reactionOf: (postId, profileId) => entriesOf(postId).get(profileId)?.reaction ?? null,
  };
};

/**
 * Opens Home with clean storage, an optional seeded profile and proof, every
 * random draw pinned high and the Game Stats backend answered by `reactions`
 * (the stats snapshot is empty), then dismisses the About window. Storage is reset only on the tab's first load,
 * so `page.reload()` observes what the page persisted.
 */
const preparePage = async (
  page,
  viewport,
  { profile = null, proof = null, reactions = createReactionsFake() } = {},
) => {
  await page.setViewportSize(viewport);
  await installGameStatsBackend(page, { apiBaseUrl: API_BASE_URL });
  await page.route(`${API_BASE_URL}/**`, (route) =>
    new URL(route.request().url()).pathname === "/stats"
      ? route.fulfill(jsonResponse(200, EMPTY_STATS_SNAPSHOT))
      : reactions.handle(route),
  );
  await page.addInitScript(
    ({ preparedKey, profile, profileKey, proof, proofKey }) => {
      if (!sessionStorage.getItem(preparedKey)) {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem(preparedKey, "1");
        if (profile) localStorage.setItem(profileKey, JSON.stringify(profile));
        if (proof) sessionStorage.setItem(proofKey, JSON.stringify(proof));
      }
      Math.random = () => 0.999999;
    },
    {
      preparedKey: STORAGE_PREPARED_KEY,
      profile,
      profileKey: PROFILE_STORAGE_KEY,
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

const parts = (win) => ({
  count: win.locator("[data-social-post-like-count]"),
  dislikeCount: win.locator("[data-social-post-dislike-count]"),
  like: win.locator("button.social-post-like[data-social-post-like]"),
  dislike: win.locator("button.social-post-dislike[data-social-post-dislike]"),
  likers: win.locator("ul[data-social-post-likers]"),
  likerRows: win.locator("ul[data-social-post-likers] li"),
  log: win.locator('[data-social-post-log][role="log"]'),
  logEntries: win.locator('[data-social-post-log][role="log"] p'),
  offlineRows: win.locator('[data-social-post-log][role="log"] .is-system p', {
    hasText: OFFLINE_TEXT,
  }),
});

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
    expect(await page.evaluate((key) => localStorage.getItem(key), LIKES_STORAGE_KEY)).toBeNull();
    await settleFrames(page);
    expect(reactions.posts(), "a refused press sends nothing").toEqual([]);

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
    await expect(likerRows.first()).toContainText("Tester");
    await expect(likerRows.first()).not.toHaveText(EMPTY_LIKERS_TEXT);
    await expect(logEntries.last()).toHaveText("Tester liked this.");
    await expect(logEntries.last().locator("strong")).toHaveText("Tester");
    await expectServerReaction(reactions, eventId, "like");

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
    await expect(logEntries.last()).toHaveText("Tester disliked this.");
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
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      LIKES_STORAGE_KEY,
    );
    expect(stored).toEqual({ [eventId]: [TEST_REACTOR] });

    await page.reload({ waitUntil: "load" });
    await dismissAbout(page);
    win = await openPost(page, eventId);
    ({ count, like, likerRows } = parts(win));
    await expect(count, "the like survives a reload").toHaveText("1 like");
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expect(likerRows).toHaveCount(1);
    await expect(likerRows.first()).toContainText("Tester");
    expect(
      await page.evaluate((key) => window.homeEventSocialPosts.readSocialPostLikes()[key], eventId),
    ).toEqual([TEST_REACTOR]);

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
    await page.evaluate((key) => localStorage.getItem(key), LIKES_STORAGE_KEY),
    "other visitors' reactions are not cached on this device",
  ).toBeNull();
});

test("a press posts the visitor's reaction and the window settles on the Worker's reply", async ({
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
    "Tester",
  ]);
  await expect(logEntries).toHaveText([
    "Alice liked this.",
    "Tester liked this.",
    "Carol disliked this.",
  ]);
  const [likePost] = reactions.posts();
  expect(likePost.postId).toBe(eventId);
  expect(likePost.body).toEqual({ profile: TEST_REACTOR, reaction: "like" });
  expect(likePost.headers["content-type"]).toBe("application/json");
  expect(likePost.headers.accept).toBe("application/json");
  expect(likePost.headers.authorization, "only the Administrator sends a proof").toBeUndefined();

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
    "Tester disliked this.",
  ]);

  await dislike.click();
  await expect(dislikeCount).toHaveText("1 dislike");
  await expect(dislike).toHaveAttribute("aria-pressed", "false");
  await expectServerReaction(reactions, eventId, null);
  await expect(logEntries).toHaveText(["Alice liked this.", "Carol disliked this."]);
  expect(reactions.posts().map((record) => record.body.reaction)).toEqual([
    "like",
    "dislike",
    null,
  ]);
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), LIKES_STORAGE_KEY),
    "the device cache holds only the visitor's own reaction",
  ).toEqual({ [eventId]: [] });
});

test("the Administrator's press carries the stored proof as a Bearer token", async ({ page }) => {
  const eventId = "lois-post-happened";
  const reactions = await preparePage(page, REVIEW_VIEWPORT.desktop, {
    profile: ADMINISTRATOR_PROFILE,
    proof: {
      proof: ADMINISTRATOR_PROOF,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });

  const win = await openPost(page, eventId);
  const { count, like } = parts(win);
  await like.click();
  await expect(count).toHaveText("1 like");
  await expect.poll(() => reactions.reactionOf(eventId, ADMINISTRATOR_PROFILE.id)).toBe("like");
  const [post] = reactions.posts();
  expect(post.headers.authorization).toBe(`Bearer ${ADMINISTRATOR_PROOF}`);
  expect(post.body.profile).toEqual({
    id: ADMINISTRATOR_PROFILE.id,
    name: ADMINISTRATOR_PROFILE.name,
    icon: ADMINISTRATOR_PROFILE.icon,
  });
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
  await expect(likerRows).toHaveText(["Alice", "Tester"]);
  await expect(logEntries).toHaveText(["Alice liked this.", "Tester liked this.", OFFLINE_TEXT]);
  expect(reactions.reactionOf(eventId, TEST_PROFILE.id), "the Worker never applied it").toBeNull();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), LIKES_STORAGE_KEY),
  ).toEqual({ [eventId]: [TEST_REACTOR] });

  // A second failed press re-renders the log and reports the failure once more, not twice.
  await like.click();
  await expect(count).toHaveText("1 like");
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(offlineRows).toHaveCount(1);
  await expect(logEntries).toHaveText(["Alice liked this.", OFFLINE_TEXT]);
  expect(reactions.posts()).toHaveLength(2);

  const failedLoad = "Failed to load resource: the server responded with a status of 503";
  consumeDiagnostics(diagnostics, {
    errorResponses: [`503 ${reactionsUrl(eventId)}`, `503 ${reactionsUrl(eventId)}`],
    consoleErrors: [failedLoad, failedLoad],
  });
});

test("an older Worker without the route behaves like a failure", async ({ page, diagnostics }) => {
  const eventId = "lois-post-five-oclock";
  await preparePage(page, REVIEW_VIEWPORT.mobile, {
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
  await expect(likerRows).toHaveText(["Tester"]);
  await expect(logEntries).toHaveText(["Tester liked this.", OFFLINE_TEXT]);

  await like.click();
  await expect(count).toHaveText("0 likes");
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);
  await expect(logEntries).toHaveText([OFFLINE_TEXT]);

  const failedLoad = "Failed to load resource: the server responded with a status of 404";
  consumeDiagnostics(diagnostics, {
    errorResponses: [
      `404 ${reactionsUrl(eventId)}`,
      `404 ${reactionsUrl(eventId)}`,
      `404 ${reactionsUrl(eventId)}`,
    ],
    consoleErrors: [failedLoad, failedLoad, failedLoad],
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
