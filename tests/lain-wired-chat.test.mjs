import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

const sliceBetween = (source, startMarker, endMarker) => {
  const start = source.lastIndexOf("<div", source.indexOf(startMarker));
  const end = source.indexOf(endMarker, source.indexOf(startMarker));
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
};

const registrationFor = (source, eventId) => {
  const idMarker = `id: "${eventId}",`;
  const idIndex = source.indexOf(idMarker);
  const start = source.lastIndexOf("registerRandomEvent({", idIndex);
  const end = source.indexOf("\n});", idIndex);
  assert.notEqual(idIndex, -1, `Missing ${eventId} registration`);
  assert.notEqual(start, -1, `Missing ${eventId} registration start`);
  assert.notEqual(end, -1, `Missing ${eventId} registration end`);
  return source.slice(start, end + 4);
};

test("Lain is a single-message Wired chat with a permanently disabled reply composer", async () => {
  const home = await readFile(new URL("home.html", root), "utf8");
  const markup = sliceBetween(
    home,
    'id="lain-alert-window"',
    '<div\n      class="window lelouch-alert-window'
  );

  assert.match(
    markup,
    /class="window event-chat-window lain-alert-window is-hidden"/
  );
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /aria-labelledby="lain-alert-title"/);
  assert.match(markup, /aria-describedby="lain-alert-message"/);
  assert.match(
    markup,
    /id="lain-alert-title">The Wired: New Message<\/div>/
  );
  assert.match(
    markup,
    /<button type="button" aria-label="Close" id="lain-alert-close"><\/button>/
  );
  assert.match(
    markup,
    /class="red-tool-image lain-alert-image-frame">[\s\S]*?class="lain-alert-image"[\s\S]*?data-src="assets\/random%20events\/lain\.gif"/
  );
  assert.match(
    markup,
    /class="red-tool-chat-log lain-alert-chat-log"[\s\S]*?role="log"[\s\S]*?aria-label="Message history"/
  );
  assert.equal(
    markup.match(/class="red-tool-system-alert lain-alert-system-alert"/g)?.length,
    1,
    "The Wired chat must contain exactly one System Alert row"
  );
  assert.match(
    markup,
    /class="red-tool-system-alert lain-alert-system-alert">[\s\S]*?<img src="assets\/app-icons\/ico\/msg_information\.ico" alt="" \/>[\s\S]*?<strong class="red-tool-system-label">System Alert:<\/strong>\s*You cannot send any messages in this chat\./
  );
  assert.ok(
    markup.indexOf('class="red-tool-message lain-alert-message"') <
      markup.indexOf('class="red-tool-system-alert lain-alert-system-alert"'),
    "Admin's message must precede the System Alert"
  );
  assert.equal(
    markup.match(/class="red-tool-message lain-alert-message"/g)?.length,
    1,
    "The Wired chat must contain exactly one message"
  );
  assert.match(
    markup,
    /<img src="assets\/app-icons\/ico\/user_computer\.ico" alt="" \/>/
  );
  assert.match(
    markup,
    /<p id="lain-alert-message">\s*<strong>Admin:<\/strong> No matter where you go, everyone is connected\.\s*<\/p>/
  );
  assert.equal(
    markup.match(/<button\b/g)?.length,
    2,
    "The Wired window must expose only Close and the disabled Send control"
  );
  assert.match(
    markup,
    /<input[\s\S]*?id="lain-alert-input"[\s\S]*?aria-label="Reply unavailable"[\s\S]*?placeholder="Replies are disabled"[\s\S]*?disabled[\s\S]*?>/
  );
  assert.match(
    markup,
    /<button type="button" id="lain-alert-send" disabled>Send<\/button>/
  );
  assert.doesNotMatch(markup, /<textarea\b|contenteditable/i);
  assert.doesNotMatch(markup, /red-tool-header/);
  assert.doesNotMatch(markup, />\s*(?:Reply|OK)\s*</i);
});

test("Lain shares the Red Tool shell without inheriting its cropped image or fixed chat height", async () => {
  const css = await readFile(
    new URL("styles/home/random-events.css", root),
    "utf8"
  );

  assert.match(
    css,
    /\.event-chat-window \{[\s\S]*?width: min\(430px, calc\(100vw - 32px\)\);/
  );
  assert.match(css, /\.event-chat-window \.window-body \{[\s\S]*?gap: 8px;/);
  assert.match(
    css,
    /\.lain-alert-image-frame \{[\s\S]*?aspect-ratio: 500 \/ 352;[\s\S]*?box-sizing: border-box;[\s\S]*?max-height: min\(35vh, 260px\);[\s\S]*?padding: 6px;/
  );
  assert.match(
    css,
    /\.lain-alert-image \{[\s\S]*?height: 100%;[\s\S]*?object-fit: contain;[\s\S]*?width: 100%;/
  );
  assert.match(
    css,
    /\.lain-alert-chat-log \{[\s\S]*?height: auto;[\s\S]*?max-height: 150px;[\s\S]*?min-height: 52px;/
  );
  assert.doesNotMatch(css, /\.lain-alert-window img\s*\{/);
  assert.doesNotMatch(css, /\.lain-alert-window button\s*\{/);
});

test("Lain and Red Tool remain normally probability-gated", async () => {
  const [main, dom] = await Promise.all([
    readFile(new URL("scripts/home/main.js", root), "utf8"),
    readFile(new URL("scripts/home/core/dom.js", root), "utf8"),
  ]);
  const lainRegistration = registrationFor(main, "lain-system-alert");
  const redToolRegistration = registrationFor(main, "red-tool");

  assert.match(lainRegistration, /debug: false,/);
  assert.match(lainRegistration, /kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,/);
  assert.match(lainRegistration, /showLainAlert\(\);/);
  assert.match(redToolRegistration, /debug: false,/);
  assert.match(redToolRegistration, /kind: RANDOM_EVENT_KIND_INTERACTIVE,/);
  assert.match(redToolRegistration, /showRedToolWindow\(\);/);
  assert.match(
    dom,
    /lainAlertClose: doc\.getElementById\("lain-alert-close"\)/
  );
  assert.match(main, /bindRandomEventButton\(lainAlertClose, closeLainAlert\);/);
  assert.match(
    main,
    /const showLainAlert = \(\) => \{[\s\S]*?lainAlertFocusReturn = focusReturn;[\s\S]*?lainAlertClose\?\.focus\(\{ preventScroll: true \}\)\);[\s\S]*?return true;/
  );
  assert.match(
    main,
    /bindManagedRandomEventWindowAnimation\(lainAlertWindow, \{\n  afterClose: resetLainAlert,\n\}\);/
  );
  assert.match(
    main,
    /lainAlertWindow\?\.addEventListener\("keydown", \(event\) => \{[\s\S]*?event\.key !== "Escape"[\s\S]*?closeLainAlert\(\);/
  );
  assert.doesNotMatch(`${dom}\n${main}`, /lainAlertOk|lain-alert-ok/);
});

test("Wired chat assets and cache-busted stylesheet references are present", async () => {
  const [home, index, lainAsset, avatarAsset] = await Promise.all([
    readFile(new URL("home.html", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
    stat(new URL("assets/random events/lain.gif", root)),
    stat(new URL("assets/app-icons/ico/user_computer.ico", root)),
  ]);
  const stylesheet =
    "styles/home/random-events.css?v=lancer-result-click-20260808";

  assert.ok(lainAsset.isFile() && lainAsset.size > 0);
  assert.ok(avatarAsset.isFile() && avatarAsset.size > 0);
  assert.ok(home.includes(stylesheet));
  assert.ok(index.includes(stylesheet));
});
