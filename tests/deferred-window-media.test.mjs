import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const home = await readFile(new URL("home.html", root), "utf8");
const main = await readFile(new URL("scripts/home/main.js", root), "utf8");

const appWindows = new Map([
  ["study-resources", { deferred: 1 }],
  ["minesweeper", { deferred: 0, eagerDigits: 6 }],
  ["minesweeper-controls", { deferred: 3 }],
  ["solitaire", { deferred: 1, eagerDigits: 3 }],
  ["game-progress", { deferred: 9 }],
  ["life-counter", { deferred: 1 }],
  ["cursor", { deferred: 1 }],
  ["video-editor", { deferred: 1 }],
  ["modeling-launch", { deferred: 1 }],
  ["image-tools", { deferred: 1 }],
  ["admin-controls", { deferred: 1 }],
  ["admin-controls-stand-in", { deferred: 1 }],
  ["administrator-alert", { deferred: 1 }],
]);

const eventWindows = new Map([
  ["random-alert-window", 1],
  ["debug-system-alert-window", 1],
  ["neko-stream-alert-window", 1],
  ["vanishing-popup-window", 1],
  ["dodging-popup-window", 1],
  ["self-love-alert-window", 1],
  ["rohin-update-window", 1],
  ["rohin-note-window", 1],
  ["earth-note-window", 1],
  ["health-note-window", 1],
  ["love-note-window", 1],
  ["mana-flood-window", 1],
  ["mimic-warning-window", 1],
  ["skill-check-window", 3],
  ["skill-check-result-window", 1],
  ["distress-upload-window", 1],
  ["stalker-result-window", 1],
  ["midnight-gospel-meditation-window", 2],
  ["john-pork-window", 2],
  // The Wired artwork is a looping <video>; only the two chat icons stay images.
  ["lain-alert-window", 2],
  ["gears-nest-window", 1],
  ["instrumentality-window", 1],
  ["red-tool-window", 3],
  ["soot-sprites-window", 1],
  ["noble-steed-result-window", 1],
  ["lancer-battle-window", 1],
]);

const attributeValue = (tag, name) =>
  tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] ?? null;

const divFragment = (marker) => {
  const markerIndex = home.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing ${marker}`);
  const start = home.lastIndexOf("<div", markerIndex);
  assert.notEqual(start, -1, `missing root div for ${marker}`);
  let depth = 0;
  for (const match of home.slice(start).matchAll(/<div\b[^>]*>|<\/div\s*>/g)) {
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) return home.slice(start, start + match.index + match[0].length);
  }
  assert.fail(`unterminated root div for ${marker}`);
};

const assertDeferredImages = (label, fragment, expectedDeferred, eagerDigits = 0) => {
  const images = [...fragment.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
  const deferred = images.filter((tag) => attributeValue(tag, "data-src"));
  const eager = images.filter((tag) => attributeValue(tag, "src"));

  assert.ok(
    deferred.length >= expectedDeferred,
    `${label} has at least the newly deferred image count`
  );
  assert.equal(eager.length, eagerDigits, `${label} eager image count`);
  assert.ok(
    deferred.filter(
      (tag) => attributeValue(tag, "width") && attributeValue(tag, "height")
    ).length >= expectedDeferred,
    `${label} fixes the intrinsic size of every newly deferred image`
  );
  eager.forEach((tag) => {
    assert.match(tag, /class="ms-digit"/);
    assert.match(tag, /assets\/minesweeper_assets\/digital_digits\//);
  });
};

const functionBody = (name) => {
  const start = main.indexOf(`const ${name} =`);
  assert.notEqual(start, -1, `missing ${name}`);
  const arrow = main.indexOf("=>", start);
  const brace = main.indexOf("{", arrow);
  let depth = 0;
  for (let index = brace; index < main.length; index += 1) {
    if (main[index] === "{") depth += 1;
    if (main[index] === "}") depth -= 1;
    if (depth === 0) return main.slice(start, index + 1);
  }
  assert.fail(`unterminated ${name}`);
};

test("managed event setup runs before deferred media activation", () => {
  const body = functionBody("showManagedRandomEventWindow");
  // Match only live statements: a commented-out call must not satisfy this.
  const setupIndex = body.search(/^[ \t]*if \(beforeShow\) beforeShow\(\);/m);
  const loadIndex = body.search(/^[ \t]*loadDeferredMedia\(win\);/m);

  assert.notEqual(setupIndex, -1);
  assert.notEqual(loadIndex, -1);
  assert.ok(setupIndex < loadIndex);
});

test("hidden app and event window images defer fixed-size media", () => {
  for (const [appId, expected] of appWindows) {
    assertDeferredImages(
      appId,
      divFragment(`data-app-window="${appId}"`),
      expected.deferred,
      expected.eagerDigits
    );
  }
  for (const [windowId, expectedDeferred] of eventWindows) {
    assertDeferredImages(
      windowId,
      divFragment(`id="${windowId}"`),
      expectedDeferred
    );
  }
});
