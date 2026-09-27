import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const description = "My personal website. Best enjoyed on desktop…";
const pages = ["index.html", "home.html"];

const readPage = (path) => readFile(new URL(path, root), "utf8");

const readJsonLd = (html) =>
  Array.from(
    html.matchAll(
      /<script\b[^>]*\btype="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
    ),
    ([, source]) => JSON.parse(source)
  );

test("homepage documents publish one consistent search description", async () => {
  for (const page of pages) {
    const html = await readPage(page);

    for (const selector of [
      `name="description"[^>]*content="${description}"`,
      `property="og:description"[^>]*content="${description}"`,
      `name="twitter:description"[^>]*content="${description}"`,
    ]) {
      assert.match(html, new RegExp(`<meta\\b[^>]*${selector}[^>]*>`, "i"), page);
    }

    const website = readJsonLd(html)
      .flatMap((document) => document["@graph"] ?? [document])
      .find((entry) => entry["@type"] === "WebSite");
    assert.equal(website?.description, description, page);
    assert.match(
      html,
      /<link\b[^>]*\brel="canonical"[^>]*\bhref="https:\/\/rohin\.shanker\.me\/"[^>]*>/i,
      page
    );
  }
});

test("homepage documents share one JSON-LD graph, social image, and theme color", async () => {
  const [index, home] = await Promise.all(pages.map(readPage));
  assert.deepEqual(readJsonLd(home), readJsonLd(index));
  assert.equal(readJsonLd(index).length, 1);

  for (const page of pages) {
    const html = await readPage(page);
    assert.match(
      html,
      /<meta\b[^>]*\bname="viewport"[^>]*\bcontent="width=device-width, initial-scale=1, viewport-fit=cover"/i,
      page
    );
    for (const selector of [
      'property="og:image"[^>]*content="https://rohin\\.shanker\\.me/assets/optimized/bio-pic-720\\.jpg"',
      'name="twitter:image"[^>]*content="https://rohin\\.shanker\\.me/assets/optimized/bio-pic-720\\.jpg"',
      'name="theme-color"[^>]*content="#c0c0c0"',
    ]) {
      assert.match(html, new RegExp(`<meta\\b[^>]*${selector}[^>]*>`, "i"), page);
    }
  }
});

test("both entry documents expose one visually hidden h1 and Home wraps its windows in main", async () => {
  const [index, home] = await Promise.all(pages.map(readPage));
  for (const [page, html] of [["index.html", index], ["home.html", home]]) {
    assert.equal(html.match(/<h1\b/g)?.length, 1, page);
    assert.match(html, /<body>\s*<h1 class="visually-hidden">Rohin OS<\/h1>/, page);
  }
  assert.equal(home.match(/<main\b/g)?.length, 1);
  assert.match(home, /<main class="window-stack">/);
  assert.equal(home.match(/<\/main>/g)?.length, 1);
  assert.doesNotMatch(index, /<main\b/);
  const base = await readFile(new URL("styles/home/base.css", root), "utf8");
  assert.match(base, /\.visually-hidden \{[\s\S]*?clip: rect\(0, 0, 0, 0\);/);
  assert.match(index, /\.visually-hidden \{[\s\S]*?clip: rect\(0, 0, 0, 0\);/);
});

test("homepage documents publish the square favicon assets", async () => {
  for (const page of pages) {
    const html = await readPage(page);

    assert.match(
      html,
      /<link\b(?=[^>]*\brel="icon")(?=[^>]*\bhref="\/assets\/favicon-96\.png")(?=[^>]*\btype="image\/png")(?=[^>]*\bsizes="96x96")[^>]*>/i,
      page
    );
    assert.match(
      html,
      /<link\b(?=[^>]*\brel="apple-touch-icon")(?=[^>]*\bhref="\/assets\/apple-touch-icon-180\.png")(?=[^>]*\bsizes="180x180")[^>]*>/i,
      page
    );
  }
});

test("favicon files are square RGBA PNG images", async () => {
  for (const [path, expectedSize] of [
    ["assets/favicon-96.png", 96],
    ["assets/apple-touch-icon-180.png", 180],
  ]) {
    const png = await readFile(new URL(path, root));

    assert.deepEqual(
      png.subarray(0, 8),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      path
    );
    assert.equal(png.toString("ascii", 12, 16), "IHDR", path);
    assert.equal(png.readUInt32BE(16), expectedSize, path);
    assert.equal(png.readUInt32BE(20), expectedSize, path);
    assert.equal(png[24], 8, `${path} must use 8-bit channels.`);
    assert.equal(png[25], 6, `${path} must use RGBA color.`);
  }
});

test("the loading screen remains excluded from generated search snippets", async () => {
  const html = await readPage("index.html");

  assert.match(
    html,
    /<div\b[^>]*\bclass="loader"[^>]*\bid="loader"[^>]*\bdata-nosnippet(?:\s|>)/i
  );
  assert.match(html, />Downloading latest update of Rohin OS<\/div>/);
  assert.match(html, />This website is optimized for desktop\.[^<]*<\/p>/);
});
