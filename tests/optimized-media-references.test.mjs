import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MEDIA_MANIFEST, VIDEO_FORMATS, readRecord } from "../scripts/optimize-media.mjs";

const root = new URL("../", import.meta.url);
const rootPath = path.resolve(fileURLToPath(root));

/** Directories and files the Pages artifact ships, mirroring the release workflow. */
const SHIPPED_ROOTS = Object.freeze([
  "home.html",
  "index.html",
  "style.css",
  "sitemap.xml",
  "styles",
  "modeling",
  "video-editor",
  "scripts/home",
]);

const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".mjs", ".json", ".xml"]);

const collectShippedFiles = async (relativePath) => {
  const absolute = path.join(rootPath, relativePath);
  const stats = await stat(absolute);
  if (!stats.isDirectory()) {
    return TEXT_EXTENSIONS.has(path.extname(relativePath)) ? [relativePath] : [];
  }
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => collectShippedFiles(path.posix.join(relativePath, entry.name)))
  );
  return nested.flat();
};

const shippedSources = (await Promise.all(SHIPPED_ROOTS.map(collectShippedFiles))).flat();

const shippedText = new Map(
  await Promise.all(
    shippedSources.map(async (source) => [source, await readFile(path.join(rootPath, source), "utf8")])
  )
);

/** Resolves a repository-relative path one segment at a time with exact-case listings. */
const existsWithExactCase = async (relativePath) => {
  let current = rootPath;
  for (const segment of relativePath.split("/")) {
    let entries;
    try {
      entries = await readdir(current);
    } catch {
      return false;
    }
    if (!entries.includes(segment)) return false;
    current = path.join(current, segment);
  }
  return true;
};

const sourceBasenames = MEDIA_MANIFEST.map((entry) => path.basename(entry.source));

test("the pipeline covers the nineteen oversized random-event GIFs", () => {
  assert.equal(MEDIA_MANIFEST.length, 19);
  assert.equal(new Set(sourceBasenames).size, 19);
});

test("no shipped page or script requests a converted source GIF", () => {
  const offenders = [];
  for (const [source, text] of shippedText) {
    for (const entry of MEDIA_MANIFEST) {
      const encoded = entry.source.replaceAll(" ", "%20");
      if (text.includes(entry.source) || text.includes(encoded)) {
        offenders.push(`${source} still requests ${entry.source}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("every referenced derivative exists with the exact case", async () => {
  const referenced = new Set();
  for (const text of shippedText.values()) {
    for (const [match] of text.matchAll(/assets\/optimized\/random-events\/[\w.-]+/g)) {
      referenced.add(match);
    }
  }
  assert.ok(referenced.size >= 24, `expected the derivative sweep, found ${referenced.size}`);

  const unresolved = [];
  for (const reference of referenced) {
    if (!(await existsWithExactCase(reference))) unresolved.push(reference);
  }
  assert.deepEqual(unresolved, []);
});

test("every manifest derivative is referenced or is a video fallback of one that is", () => {
  const text = [...shippedText.values()].join("\n");
  const unreferenced = MEDIA_MANIFEST.flatMap((entry) =>
    entry.derivatives.map((derivative) => derivative.path)
  ).filter((derivativePath) => !text.includes(derivativePath));
  assert.deepEqual(unreferenced, []);
});

const videoTags = [...shippedText.get("home.html").matchAll(/<video\b[\s\S]*?<\/video>/g)].map(
  (match) => match[0]
);

const attributeValue = (tag, name) =>
  tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] ?? null;

test("every looping event video declares the contract its playback depends on", () => {
  const loopVideos = videoTags.filter((tag) => attributeValue(tag, "data-loop-video"));
  // Six elements over five sources: the advertisement renders its artwork twice,
  // once plainly and once as the pixelated text overlay.
  assert.equal(loopVideos.length, 6, "every loop video is declared");
  assert.equal(
    new Set(loopVideos.map((tag) => attributeValue(tag, "data-loop-fallback"))).size,
    5,
    "the five large loops ship as video"
  );
  assert.equal(
    new Set(loopVideos.map((tag) => attributeValue(tag, "data-loop-video"))).size,
    6,
    "every loop video carries a distinct name"
  );

  for (const tag of loopVideos) {
    const name = attributeValue(tag, "data-loop-video");
    for (const attribute of ["loop", "muted", "playsinline"]) {
      assert.match(tag, new RegExp(`\\s${attribute}\\b`), `${name} declares ${attribute}`);
    }
    // `scripts/home/core/media.js` owns when a loop video plays. Native autoplay
    // would start one inside a window that has never opened, as soon as the
    // deferred sources resolve and `load()` finds data.
    assert.doesNotMatch(tag, /\sautoplay\b/, `${name} leaves playback to the helper`);
    assert.equal(attributeValue(tag, "preload"), "auto", `${name} preloads its media`);
    assert.ok(attributeValue(tag, "data-poster"), `${name} carries a deferred poster`);
    assert.ok(attributeValue(tag, "data-loop-fallback"), `${name} carries an image fallback`);
    assert.ok(attributeValue(tag, "width"), `${name} fixes its intrinsic width`);
    assert.ok(attributeValue(tag, "height"), `${name} fixes its intrinsic height`);

    const sources = [...tag.matchAll(/<source\b[^>]*>/g)].map((match) => match[0]);
    assert.deepEqual(
      sources.map((source) => attributeValue(source, "type")),
      ["video/webm", "video/mp4"],
      `${name} offers WebM before MP4`
    );
    sources.forEach((source) => {
      assert.ok(attributeValue(source, "data-src"), `${name} defers every source`);
      assert.equal(attributeValue(source, "src"), null, `${name} ships no eager source`);
    });
  }
});

test("each looping video's declared box matches its encoded derivative", () => {
  const record = readRecord(rootPath);
  assert.ok(record, "the pipeline record exists");

  const dimensionsByPath = new Map(
    record.entries.flatMap((entry) =>
      entry.derivatives.map((derivative) => [
        derivative.path,
        { width: derivative.width, height: derivative.height },
      ])
    )
  );

  for (const tag of videoTags.filter((candidate) => attributeValue(candidate, "data-loop-video"))) {
    const webm = attributeValue([...tag.matchAll(/<source\b[^>]*>/g)][0][0], "data-src");
    const encoded = dimensionsByPath.get(webm);
    assert.ok(encoded, `${webm} is a recorded derivative`);
    assert.equal(
      `${attributeValue(tag, "width")}x${attributeValue(tag, "height")}`,
      `${encoded.width}x${encoded.height}`,
      `${webm} renders at its encoded size, so loading shifts no layout`
    );
  }
});

test("the five video sources are exactly the ones with WebM, MP4 and a poster", () => {
  const withVideo = MEDIA_MANIFEST.filter((entry) =>
    entry.derivatives.some((derivative) => VIDEO_FORMATS.includes(derivative.format))
  );
  assert.deepEqual(
    withVideo.map((entry) => path.basename(entry.source, ".gif")).sort(),
    ["campfire", "evil-wizards-radar", "lain", "radar", "servalpizza"]
  );
  for (const entry of withVideo) {
    assert.deepEqual(
      entry.derivatives.map((derivative) => derivative.format),
      ["webp", "webm", "mp4", "poster"],
      `${entry.source} ships an image fallback, both video formats and a poster`
    );
  }
});
