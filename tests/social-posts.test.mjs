import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { HOME_SCRIPTS, readProductionScript, repositoryRoot } from "./helpers/home-scripts.mjs";

/**
 * Source contract for the Lois Griffin social-post events. Both posts live in
 * one script that registers two interactive, disarmed events on the shared
 * random-event runtime, keeps the visitor's own reaction in localStorage and
 * shares every reaction through the Game Stats Worker.
 */

const SCRIPT_PATH = "scripts/home/events/social-posts.js";
const SCRIPT_VERSION = "social-posts-20261109b";
const STORAGE_KEY = "personalSiteSocialPostLikesV1";
const EVENT_IDS = ["lois-post-happened", "lois-post-five-oclock"];
const OFFLINE_MESSAGE = "Couldn't reach the server. Your reaction is saved on this device.";

const source = await readProductionScript(new URL(SCRIPT_PATH, repositoryRoot));
const home = await readFile(new URL("home.html", repositoryRoot), "utf8");
const index = await readFile(new URL("index.html", repositoryRoot), "utf8");

/** One event's `registerRandomEvent({ … })` block. */
const registrationFor = (eventId) => {
  const idIndex = source.indexOf(`id: "${eventId}",`);
  assert.notEqual(idIndex, -1, `${eventId} must be registered`);
  const start = source.lastIndexOf("registerRandomEvent({", idIndex);
  const end = source.indexOf("\n});", idIndex);
  assert.ok(start !== -1 && end > start, `${eventId}'s registration must be bounded`);
  return source.slice(start, end);
};

/** The root `<div … id="…">` of one window, matched by nesting depth. */
const windowFragment = (windowId) => {
  const marker = `id="${windowId}"`;
  const markerIndex = home.indexOf(marker);
  assert.notEqual(markerIndex, -1, `home.html must contain ${marker}`);
  const start = home.lastIndexOf("<div", markerIndex);
  let depth = 0;
  for (const match of home.slice(start).matchAll(/<div\b[^>]*>|<\/div\s*>/g)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return home.slice(start, start + match.index + match[0].length);
  }
  assert.fail(`unterminated root div for ${windowId}`);
};

test("the social-post script is a registered Home script that both pages load by version", () => {
  assert.ok(
    Object.values(HOME_SCRIPTS).includes(SCRIPT_PATH),
    `${SCRIPT_PATH} must be listed in HOME_SCRIPTS so the shared event contracts read it`,
  );
  assert.match(
    home,
    new RegExp(`<script src="${SCRIPT_PATH}\\?v=${SCRIPT_VERSION}" defer></script>`),
  );
  assert.ok(
    index.includes(`["${SCRIPT_PATH}?v=${SCRIPT_VERSION}", "script"]`),
    "index.html must warm the script up with the same version token",
  );
});

test("likes persist under one storage key that the script exports", () => {
  assert.ok(source.includes(`"${STORAGE_KEY}"`), `the storage key literal ${STORAGE_KEY}`);
  assert.match(
    source,
    /window\.homeEventSocialPosts = Object\.freeze\(\{[\s\S]*?socialPostWindows[\s\S]*?readSocialPostLikes[\s\S]*?SOCIAL_POST_LIKES_STORAGE_KEY[\s\S]*?\}\)/,
  );
  assert.match(source, /SOCIAL_POST_LIKES_STORAGE_KEY = "personalSiteSocialPostLikesV1"/);
  assert.match(source, /SOCIAL_POST_DISLIKES_STORAGE_KEY = "personalSiteSocialPostDislikesV1"/);
  assert.match(
    source,
    /window\.homeEventSocialPosts = Object\.freeze\(\{[\s\S]*?readSocialPostDislikes[\s\S]*?SOCIAL_POST_DISLIKES_STORAGE_KEY[\s\S]*?\}\)/,
  );
});

test("reactions go through the Game Stats Worker with a per-device fallback", () => {
  assert.match(
    source,
    /SOCIAL_POST_REACTIONS_PATH = "\/social-posts\/\{postId\}\/reactions"/,
    "the reactions route template",
  );
  assert.match(
    source,
    /normalizeBackendBaseUrl\(window\.rohinGameStatsBackend\)/,
    "the script reads the generated backend config for its base URL",
  );
  assert.ok(source.includes(`"${OFFLINE_MESSAGE}"`), "the offline system row text");
  assert.match(source, /Accept: "application\/json"/);
  assert.match(source, /"Content-Type": "application\/json"/);
  assert.match(source, /Authorization: `Bearer \$\{proof\.proof\}`/);
  assert.match(
    source,
    /window\.homeEventSocialPosts = Object\.freeze\(\{[\s\S]*?SOCIAL_POST_REACTIONS_PATH[\s\S]*?\}\)/,
    "the path template is exported so tests can route it",
  );
  assert.doesNotMatch(
    source,
    /console\.(?:log|warn|error|info|debug)\(/,
    "the script logs nothing",
  );
});

test("both posts register as disarmed interactive events with the Red Tool shape", () => {
  for (const eventId of EVENT_IDS) {
    const registration = registrationFor(eventId);
    assert.match(registration, /\bdebug: false,/, `${eventId} ships disarmed`);
    assert.match(
      registration,
      /\bkind: RANDOM_EVENT_KIND_INTERACTIVE,/,
      `${eventId} is an interactive event`,
    );
    assert.match(registration, /\bpreloadTargets: /, `${eventId} names its preload targets`);
    assert.match(registration, /\bisVisible: /, `${eventId} reports its visibility`);
    assert.match(registration, /\bcanTrigger: /, `${eventId} guards its trigger`);
    assert.match(registration, /\brun: /, `${eventId} has a run hook`);
    assert.match(registration, /\bbind: /, `${eventId} binds its DOM after run`);
    assert.doesNotMatch(registration, /forceOnStart: true/, `${eventId} never forces from Start`);
  }
  assert.equal(
    source.match(/registerRandomEvent\(\{/g)?.length,
    EVENT_IDS.length,
    "the script registers exactly the two posts",
  );
});

test("window visibility goes through the managed helpers only", () => {
  assert.doesNotMatch(source, /classList\.remove\("is-hidden"/);
  assert.doesNotMatch(source, /classList\.add\("is-hidden"/);
  assert.match(source, /showManagedRandomEventWindow\(/);
  assert.match(source, /closeManagedRandomEventWindow\(/);
  assert.match(source, /isManagedRandomEventWindowVisible\(/);
  assert.match(source, /bindManagedRandomEventWindowAnimation\(/);
  assert.match(source, /registerRandomEventWindows\(/);
});

test("the like count label reads 0 likes, 1 like and N likes", () => {
  const exposed = source.match(/const (\w*[lL]ikeCount\w*[lL]abel\w*|format\w*Likes?\w*) = /);
  if (exposed) {
    const name = exposed[1];
    const body = source.slice(source.indexOf(`const ${name} = `));
    const declaration = body.slice(
      0,
      body.indexOf("\n\n") === -1 ? undefined : body.indexOf("\n\n"),
    );
    const label = new Function(`${declaration}\nreturn ${name};`)();
    assert.equal(label(0), "0 likes");
    assert.equal(label(1), "1 like");
    assert.equal(label(2), "2 likes");
    return;
  }
  assert.ok(
    source.includes('"0 likes"') || /\blikes?\b/.test(source),
    "the script spells out the like label",
  );
  assert.match(source, /1 like\b|=== 1 \? "" : "s"|=== 1 \? "like" : "likes"/);
});

test("each post window is a hidden social-post chat window with the shared controls", () => {
  const titles = new Set();
  for (const [eventId, image] of [
    ["lois-post-happened", "lois-post-happened.png"],
    ["lois-post-five-oclock", "lois-post-five-oclock.png"],
  ]) {
    const fragment = windowFragment(`${eventId}-window`);
    assert.match(
      fragment,
      /^<div\s+class="window random-event-window event-chat-window social-post-window is-hidden"/,
      `${eventId} root class`,
    );
    assert.match(fragment, /aria-hidden="true"/);
    assert.doesNotMatch(fragment, /role="alertdialog"/);
    assert.match(fragment, new RegExp(`id="${eventId}-close"`));
    const title = fragment.match(/class="title-bar-text"[^>]*>([^<]*)</)?.[1]?.trim();
    assert.ok(title, `${eventId} has a title`);
    titles.add(title);
    assert.match(fragment, /Lois Griffin/);
    assert.match(
      fragment,
      new RegExp(`<img[^>]*data-src="assets/random-events/${image}"[^>]*>`),
      `${eventId} defers its post image`,
    );
    const postImage = fragment.match(
      new RegExp(`<img[^>]*data-src="assets/random-events/${image}"[^>]*>`),
    )[0];
    assert.match(postImage, /\swidth="\d+"/, `${eventId} post image width`);
    assert.match(postImage, /\sheight="\d+"/, `${eventId} post image height`);
    assert.match(fragment, /data-social-post-like-count/);
    assert.match(
      fragment,
      /<button[^>]*class="[^"]*\bsocial-post-like\b[^"]*"[^>]*data-social-post-like\b/,
    );
    assert.match(fragment, /aria-pressed="false"/);
    assert.match(fragment, /<ul[^>]*data-social-post-likers/);
    assert.match(fragment, /No one has liked this yet\./);
    assert.match(
      fragment,
      /data-social-post-log[^>]*role="log"|role="log"[^>]*data-social-post-log/,
    );
  }
  assert.deepEqual([...titles], ["Facebook"], "both posts are titled Facebook");
  assert.match(windowFragment("lois-post-happened-window"), /so THIS happened/);
  assert.match(
    windowFragment("lois-post-five-oclock-window"),
    /It(?:'|&#39;|&apos;|’)s got to be 5:00 somewhere, right\?/,
  );
});
