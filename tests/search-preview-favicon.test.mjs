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
