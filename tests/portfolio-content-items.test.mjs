// Content contract for the newest Projects items (Cyano Gene Visualizer,
// win98-site-kit) and the pinned Substack item in Writing: order, default
// selection, links and the figures each carousel lists.

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const windowMarkup = (home, appId) => {
  const start = home.indexOf(`data-app-window="${appId}"`);
  assert.notEqual(start, -1, `Missing window ${appId}`);
  const end = home.indexOf('<div class="window app-window', start + 1);
  return home.slice(start, end === -1 ? undefined : end);
};

const selectorViews = (markup) =>
  [...markup.matchAll(/<button class="selector-item[^"]*" type="button" data-view="([^"]+)"/g)].map(
    (match) => match[1],
  );

const panel = (markup, view) => {
  const start = markup.indexOf(`data-view="${view}">`, markup.indexOf('class="viewer-panel"'));
  assert.notEqual(start, -1, `Missing panel ${view}`);
  const end = markup.indexOf('<div class="viewer-content', start + 1);
  return markup.slice(start, end === -1 ? undefined : end);
};

const exists = (path) =>
  access(new URL(path, root)).then(
    () => true,
    () => false,
  );

test("Projects opens on the Cyano visualizer with the kit second and older items unchanged", async () => {
  const projects = windowMarkup(await read("home.html"), "windows");
  const views = selectorViews(projects);
  assert.deepEqual(views.slice(0, 6), [
    "projects-cyano-gene-visualizer",
    "projects-win98-site-kit",
    "projects-pulse-oximeter",
    "projects-tcp-congestion-control",
    "projects-ekg",
    "projects-drone-navigation",
  ]);
  assert.match(
    projects,
    /class="selector-item is-active" type="button" data-view="projects-cyano-gene-visualizer"/,
  );
  assert.equal(
    (projects.match(/class="selector-item is-active"/g) || []).length,
    1,
    "Exactly one Projects item starts active.",
  );
  assert.match(projects, /<div class="viewer-content" data-view="projects-cyano-gene-visualizer">/);
  assert.match(
    projects,
    /<div class="viewer-content is-hidden" data-view="projects-pulse-oximeter">/,
  );

  const cyano = panel(projects, "projects-cyano-gene-visualizer");
  assert.match(cyano, /href="https:\/\/rohinshanker\.github\.io\/isaacs-cyano-gene-selection\/"/);
  assert.match(cyano, /href="https:\/\/github\.com\/rohinshanker\/isaacs-cyano-gene-selection"/);
  assert.match(cyano, /button-link--gold-glow[\s\S]*?Open the visualizer/);
  assert.match(cyano, /Isaacs Lab/);

  const kit = panel(projects, "projects-win98-site-kit");
  assert.match(kit, /href="https:\/\/rohinshanker\.github\.io\/win98-site-kit\/"/);
  assert.match(kit, /href="https:\/\/github\.com\/rohinshanker\/win98-site-kit"/);
  assert.match(kit, /button-link--gold-glow[\s\S]*?Open showcase/);
  for (const section of [cyano, kit]) {
    for (const link of section.matchAll(/<a\b[^>]*>/g)) {
      assert.match(link[0], /target="_blank"/);
      assert.match(link[0], /rel="noreferrer"/);
    }
  }
});

test("Writing pins Substack first with Open Substack and Subscribe links", async () => {
  const writing = windowMarkup(await read("home.html"), "taskmgr");
  const views = selectorViews(writing);
  assert.equal(views[0], "writing-substack");
  assert.equal(views[1], "writing-structural-bioinformatics");
  assert.match(
    writing,
    /class="selector-item is-active" type="button" data-view="writing-substack"/,
  );
  assert.equal((writing.match(/class="selector-item is-active"/g) || []).length, 1);
  assert.match(
    writing,
    /<div class="viewer-content is-hidden" data-view="writing-structural-bioinformatics">/,
  );

  const substack = panel(writing, "writing-substack");
  assert.match(substack, /<h3>Substack<\/h3>/);
  assert.match(substack, /Read my latest publications on Substack!/);
  assert.match(substack, /data-src="assets\/app-icons\/ico\/newspaper\.ico"/);
  const links = [...substack.matchAll(/<a\b([^>]*)>\s*([^<]+?)\s*<\/a>/g)].map((match) => ({
    attributes: match[1],
    text: match[2],
  }));
  assert.deepEqual(
    links.map((link) => [link.text, link.attributes.match(/href="([^"]+)"/)[1]]),
    [
      ["Open Substack", "https://rohins.substack.com/"],
      ["Subscribe", "https://rohins.substack.com/subscribe"],
    ],
  );
  for (const link of links) {
    assert.match(link.attributes, /target="_blank"/);
    assert.match(link.attributes, /rel="noopener noreferrer"/);
  }
  assert.match(
    writing,
    /data-view="writing-substack">\s*<img class="selector-thumb" data-src="assets\/app-icons\/ico\/newspaper\.ico"/,
    "The Substack item uses the same newspaper icon as the Socials entry.",
  );
});

test("the new carousels list figures that exist, and their markup shows the first figure", async () => {
  const [gallery, home] = await Promise.all([
    read("scripts/home/features/gallery.js"),
    read("home.html"),
  ]);
  for (const [name, folder, count, imageId] of [
    ["cyanoProjectFigures", "assets/projects/cyano-gene-visualizer/", 3, "cyano-project-image"],
    ["kitProjectFigures", "assets/projects/win98-site-kit/", 2, "kit-project-image"],
  ]) {
    const start = gallery.indexOf(`const ${name} = Object.freeze([`);
    assert.notEqual(start, -1, `Missing ${name}`);
    const block = gallery.slice(start, gallery.indexOf("]);", start));
    const sources = [...block.matchAll(/src: "([^"]+)"/g)].map((match) => match[1]);
    assert.equal(sources.length, count);
    for (const source of sources) {
      assert.ok(source.startsWith(folder), source);
      assert.ok(await exists(source), `${source} exists`);
    }
    assert.equal((block.match(/title: "/g) || []).length, count);
    assert.equal((block.match(/description:/g) || []).length, count);
    const image = home.match(new RegExp(`id="${imageId}"\\s+data-src="([^"]+)"`))?.[1];
    assert.equal(image, sources[0], `${imageId} starts on the first figure`);
    assert.match(
      home,
      new RegExp(`id="${imageId.replace("-image", "-counter")}"[^>]*>1 of ${count}<`),
    );
  }
  assert.match(gallery, /bindGalleryNavigation\(\s*cyanoProjectPrev,/);
  assert.match(gallery, /bindGalleryNavigation\(\s*kitProjectPrev,/);
  assert.match(gallery, /element: cyanoProjectImage,/);
  assert.match(gallery, /element: kitProjectImage,/);
});
