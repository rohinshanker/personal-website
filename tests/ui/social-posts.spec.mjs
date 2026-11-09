/**
 * Behavioural cover for the two Lois Griffin social-post random events.
 *
 * Both windows share one script, one storage key and one Like model: the
 * count label, the likers list, the activity log and the profile gate are
 * driven by `scripts/home/events/social-posts.js`. These cases force each
 * event through the Administrator orchestrator and assert the rendered result
 * at every review viewport: the managed window lifecycle, focus, geometry, the
 * Like toggle with and without a Game Progress profile, persistence across a
 * reload, how a second post behaves while the first is open, and an axe scan
 * of the open window.
 */

import { expect, test } from "./deterministic.mjs";
import { scanForViolations } from "./helpers/accessibility-contracts.mjs";
import { REVIEW_VIEWPORT, REVIEW_VIEWPORTS } from "./helpers/rendered-site.mjs";

test.setTimeout(180_000);

const PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";
const LIKES_STORAGE_KEY = "personalSiteSocialPostLikesV1";
/** Set once per tab, so a reload keeps the storage the first load wrote. */
const STORAGE_PREPARED_KEY = "socialPostsSpecStoragePrepared";

const TEST_PROFILE = Object.freeze({
  id: "player-test",
  name: "Tester",
  icon: "assets/app-icons/ico/user_card.ico",
  rerollCount: 0,
});

const EMPTY_LIKERS_TEXT = "No one has liked this yet.";
const NO_PROFILE_TEXT = "Create a profile in Game Progress to like this post.";

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

/**
 * Opens Home with clean storage, an optional seeded profile and every random
 * draw pinned high, then dismisses the About window. Storage is reset only on
 * the tab's first load, so `page.reload()` observes what the page persisted.
 */
const preparePage = async (page, viewport, { profile = null } = {}) => {
  await page.setViewportSize(viewport);
  await page.addInitScript(
    ({ preparedKey, profile, profileKey }) => {
      if (!sessionStorage.getItem(preparedKey)) {
        localStorage.clear();
        sessionStorage.clear();
        sessionStorage.setItem(preparedKey, "1");
        if (profile) localStorage.setItem(profileKey, JSON.stringify(profile));
      }
      Math.random = () => 0.999999;
    },
    { preparedKey: STORAGE_PREPARED_KEY, profile, profileKey: PROFILE_STORAGE_KEY },
  );
  await page.goto("/home.html", { waitUntil: "load" });
  await dismissAbout(page);
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
    await preparePage(page, viewport);

    // Something outside the window holds focus, so the close path has a
    // concrete element to hand focus back to.
    const startButton = page.locator(".start-button");
    await startButton.focus();
    await expect(startButton).toBeFocused();

    const result = await forceEvent(page, eventId);
    expect(result.ok, result.message).toBe(true);
    const win = await expectOpen(page, eventId);
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

    // No profile: the Like is refused and the log says how to get one.
    const entriesBefore = await logEntries.count();
    await like.click();
    await expect(count).toHaveText("0 likes");
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await expect(likerRows).toHaveCount(1);
    await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);
    await expect(logEntries).toHaveCount(entriesBefore + 1);
    await expect(logEntries.last()).toHaveText(NO_PROFILE_TEXT);
    expect(await page.evaluate((key) => localStorage.getItem(key), LIKES_STORAGE_KEY)).toBeNull();

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
    await preparePage(page, viewport, { profile: TEST_PROFILE });

    let result = await forceEvent(page, eventId);
    expect(result.ok, result.message).toBe(true);
    let win = await expectOpen(page, eventId);
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

    await like.click();
    await expect(count).toHaveText("0 likes");
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await expect(likerRows).toHaveCount(1);
    await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);
    await expect(logEntries, "removing the like removes its row").toHaveCount(0);

    await page.reload({ waitUntil: "load" });
    await dismissAbout(page);
    result = await forceEvent(page, eventId);
    expect(result.ok, result.message).toBe(true);
    win = await expectOpen(page, eventId);
    let dislike;
    let dislikeCount;
    ({ count, dislikeCount, like, dislike, likerRows, logEntries } = parts(win));
    await expect(count, "the unlike was persisted").toHaveText("0 likes");
    await expect(dislikeCount).toHaveText("0 dislikes");
    await like.click();
    await expect(count).toHaveText("1 like");
    await expect(like).toHaveAttribute("aria-pressed", "true");

    // A dislike replaces the like: one reaction per profile.
    await dislike.click();
    await expect(dislikeCount).toHaveText("1 dislike");
    await expect(dislike).toHaveAttribute("aria-pressed", "true");
    await expect(count).toHaveText("0 likes");
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await expect(likerRows.first()).toHaveText(EMPTY_LIKERS_TEXT);
    await expect(logEntries).toHaveCount(1);
    await expect(logEntries.last()).toHaveText("Tester disliked this.");
    await dislike.click();
    await expect(dislikeCount).toHaveText("0 dislikes");
    await expect(dislike).toHaveAttribute("aria-pressed", "false");
    await expect(logEntries, "removing the dislike removes its row").toHaveCount(0);
    await like.click();
    await expect(count).toHaveText("1 like");
    await expect(like).toHaveAttribute("aria-pressed", "true");
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      LIKES_STORAGE_KEY,
    );
    expect(stored).toEqual({
      [eventId]: [{ id: TEST_PROFILE.id, name: TEST_PROFILE.name, icon: TEST_PROFILE.icon }],
    });

    await page.reload({ waitUntil: "load" });
    await dismissAbout(page);
    result = await forceEvent(page, eventId);
    expect(result.ok, result.message).toBe(true);
    win = await expectOpen(page, eventId);
    ({ count, like, likerRows } = parts(win));
    await expect(count, "the like survives a reload").toHaveText("1 like");
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expect(likerRows).toHaveCount(1);
    await expect(likerRows.first()).toContainText("Tester");
    expect(
      await page.evaluate((key) => window.homeEventSocialPosts.readSocialPostLikes()[key], eventId),
    ).toEqual([{ id: TEST_PROFILE.id, name: TEST_PROFILE.name, icon: TEST_PROFILE.icon }]);

    await win.locator(POSTS[eventId].close).click();
    await expect(win).toBeHidden();
  });
}

test(`"5:00 somewhere" opens beside an open post, and a post refuses a repeat trigger`, async ({
  page,
}) => {
  await preparePage(page, REVIEW_VIEWPORT.desktop);
  const first = "lois-post-happened";
  const second = "lois-post-five-oclock";

  const firstResult = await forceEvent(page, first);
  expect(firstResult.ok, firstResult.message).toBe(true);
  const firstWindow = await expectOpen(page, first);

  // Observed runtime behaviour: `runEvent` refuses only the event whose own
  // window is already open (the "already open" result), and the interactive
  // kind limit applies to natural triggers, not to a forced run. So forcing
  // the other post while the first is open neither queues nor refuses it: the
  // second post opens as a separate window stacked above the first, and the
  // first stays where it was. Forcing the same post again is refused.
  const secondResult = await forceEvent(page, second);
  expect(secondResult.ok, secondResult.message).toBe(true);
  const secondWindow = await expectOpen(page, second);
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

  const soloResult = await forceEvent(page, second);
  expect(soloResult.ok, soloResult.message).toBe(true);
  const win = await expectOpen(page, second);
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
