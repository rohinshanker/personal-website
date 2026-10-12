import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  loadModelingPortfolio,
  renderModelingHome,
} from "../scripts/build-modeling-markup.mjs";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");
const run = (args, cwd) =>
  promisify(execFile)(process.execPath, ["scripts/build-modeling-markup.mjs", ...args], {
    cwd: cwd instanceof URL ? fileURLToPath(cwd) : cwd,
  });

const SELECTOR_START =
  "<!-- BEGIN generated modeling selector rows: node scripts/build-modeling-markup.mjs -->";
const SELECTOR_END = "<!-- END generated modeling selector rows -->";
const VIEWER_START =
  "<!-- BEGIN generated modeling viewer panels: node scripts/build-modeling-markup.mjs -->";
const VIEWER_END = "<!-- END generated modeling viewer panels -->";

const page = ({
  selectorStart = SELECTOR_START,
  selectorEnd = SELECTOR_END,
  viewerStart = VIEWER_START,
  viewerEnd = VIEWER_END,
} = {}) =>
  [
    "<ul>",
    `  ${selectorStart}`,
    "  stale row",
    `  ${selectorEnd}`,
    "</ul>",
    "<div>",
    `    ${viewerStart}`,
    `    ${viewerEnd}`,
    "</div>",
    "",
  ].join("\n");

const shoot = (overrides = {}) => ({
  id: "modeling-one",
  title: "One",
  date: "May 2025",
  icon: "assets/one.png",
  files: ["1.jpg"],
  credits: ["Talent: One"],
  ...overrides,
});

test("the tracked Home modeling markup is generated from the shared data", async () => {
  const [source, home] = await Promise.all([read("scripts/home/modeling-portfolio.js"), read("home.html")]);
  const portfolio = loadModelingPortfolio(source);

  assert.equal(renderModelingHome(home, portfolio), home, "run node scripts/build-modeling-markup.mjs");
  for (const marker of [SELECTOR_START, SELECTOR_END, VIEWER_START, VIEWER_END]) {
    assert.equal(home.split(marker).length, 2, `home.html carries ${marker} once`);
  }
});

test("the check command passes on the tracked tree", async () => {
  const { stdout } = await run(["--check"], root);
  assert.equal(stdout, "Home modeling markup is current.\n");
});

test("the check command rejects stale Home markup and the build repairs it", async (t) => {
  const copy = await mkdtemp(path.join(tmpdir(), "modeling-markup-"));
  t.after(() => rm(copy, { recursive: true, force: true }));
  await mkdir(path.join(copy, "scripts/home"), { recursive: true });
  for (const file of ["scripts/build-modeling-markup.mjs", "scripts/home/modeling-portfolio.js"]) {
    await copyFile(new URL(file, root), path.join(copy, file));
  }
  const home = await read("home.html");
  const stale = home.replace("<p>Designer: Nora</p>", "<p>Designer: Edited by hand</p>");
  assert.notEqual(stale, home);
  await writeFile(path.join(copy, "home.html"), stale);

  await assert.rejects(run(["--check"], copy), (error) => {
    assert.equal(error.code, 1);
    assert.equal(error.stderr, "Home modeling markup is stale. Run: node scripts/build-modeling-markup.mjs\n");
    return true;
  });
  assert.equal(await readFile(path.join(copy, "home.html"), "utf8"), stale, "--check never writes");
  await run([], copy);
  assert.equal(await readFile(path.join(copy, "home.html"), "utf8"), home);
});

test("rendering replaces only the marked regions, in data order, and is idempotent", () => {
  const portfolio = { shoots: [shoot(), shoot({ id: "modeling-two", title: "Two", credits: [] })] };
  const html = renderModelingHome(page(), portfolio);
  const outsideRegions = (value) => value.replace(/(<!-- BEGIN [^\n]*\n)[\s\S]*?(?=[ \t]*<!-- END)/g, "$1");

  assert.equal(renderModelingHome(html, portfolio), html);
  assert.equal(outsideRegions(html), outsideRegions(page()));
  assert.doesNotMatch(html, /stale row/);
  assert.deepEqual(
    Array.from(html.matchAll(/ data-view="([^"]+)"/g), ([, id]) => id),
    ["modeling-one", "modeling-two", "modeling-one", "modeling-two"]
  );
  assert.deepEqual(
    Array.from(html.matchAll(/class="(selector-item[^"]*|viewer-content[^"]*)"/g), ([, name]) => name),
    ["selector-item is-active", "selector-item", "viewer-content", "viewer-content is-hidden"]
  );
  assert.equal(html.match(/<p>Talent: One<\/p>/g).length, 1);
  const viewerLines = html.slice(html.indexOf(VIEWER_START), html.indexOf(VIEWER_END)).split("\n").slice(1, -1);
  assert.ok(viewerLines.every((line) => line.startsWith("    ")), "generated lines keep the marker indent");
});

test("unpublished shoots are skipped and optional credits may be absent", () => {
  const html = renderModelingHome(page(), {
    shoots: [
      shoot({ id: "modeling-draft", files: [], icon: undefined }),
      shoot({ credits: undefined }),
    ],
  });

  assert.doesNotMatch(html, /modeling-draft/);
  assert.match(html, /class="selector-item is-active" type="button" data-view="modeling-one"/);
  assert.match(html, /<div class="viewer-content" data-view="modeling-one">/);
  assert.doesNotMatch(html, /<p>/);
});

test("text and attributes are escaped", () => {
  const html = renderModelingHome(page(), {
    shoots: [
      shoot({
        title: 'Garb "Cirque" <b>&</b>',
        icon: 'assets/a"b.png',
        credits: ["Photo/Video: A & <B>"],
      }),
    ],
  });

  assert.match(html, /<span class="selector-title">Garb "Cirque" &lt;b&gt;&amp;&lt;\/b&gt;<\/span>/);
  assert.match(html, /<h3>Garb "Cirque" &lt;b&gt;&amp;&lt;\/b&gt;<\/h3>/);
  assert.match(html, /data-src="assets\/a&quot;b\.png"/);
  assert.match(html, /<p>Photo\/Video: A &amp; &lt;B&gt;<\/p>/);
});

test("invalid shoot data fails with the shoot and field it concerns", () => {
  const render = (shoots) => () => renderModelingHome(page(), { shoots });

  assert.throws(render([shoot({ title: " " })]), /modeling-one is published but has no title\./);
  assert.throws(render([shoot({ id: undefined })]), /shoot 1 is published but has no id\./);
  assert.throws(render([shoot({ files: undefined })]), /modeling-one needs a files list\./);
  assert.throws(render([shoot(), shoot()]), /Duplicate shoot id modeling-one\./);
  assert.throws(render([shoot({ files: [] })]), /No published modeling shoots to render\./);
});

test("malformed generated boundaries fail before Home is rewritten", () => {
  const render = (html) => () => renderModelingHome(html, { shoots: [shoot()] });
  const viewer = "modeling viewer panels";

  assert.throws(render(page({ viewerStart: "" })), new RegExp(`missing the start marker for ${viewer}`));
  assert.throws(render(page({ viewerEnd: "" })), new RegExp(`missing the end marker for ${viewer}`));
  assert.throws(
    render(page({ viewerEnd: `${VIEWER_END}\n${VIEWER_END}` })),
    new RegExp(`repeats a marker for ${viewer}`)
  );
  assert.throws(
    render(page({ viewerStart: VIEWER_END, viewerEnd: VIEWER_START })),
    new RegExp(`ends ${viewer} before it starts`)
  );
  assert.throws(
    render(page({ selectorStart: `<li>${SELECTOR_START}` })),
    /keep each modeling selector rows marker on its own line/
  );
  assert.throws(
    render(page({ selectorEnd: `x ${SELECTOR_END}` })),
    /keep each modeling selector rows marker on its own line/
  );
  assert.throws(
    render(page({ viewerStart: `${VIEWER_START} x` })),
    /keep each modeling viewer panels marker on its own line/
  );
});
