import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../scripts/home/core/media.js", import.meta.url), "utf8");

class Element {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.classes = new Set();
    this.classList = { toggle: (name, enabled) => {
      if (enabled) this.classes.add(name);
      else this.classes.delete(name);
    } };
    this.clientWidth = 258;
    this.clientHeight = 272;
    this.sourceWrites = 0;
  }
  appendChild(child) { this.children.push(child); }
  setAttribute(name, value) {
    this.attributes.set(name, value);
    if (name === "src") this.sourceWrites += 1;
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector(selector) {
    return this.children.find((child) => selector === "img"
      ? child.tagName === "img"
      : selector === `:scope > .${child.className}`) ?? null;
  }
}

const loadMedia = () => {
  const context = vm.createContext({
    window: {},
    document: {
      readyState: "loading",
      querySelectorAll: () => [],
      addEventListener() {},
      createElement: (tag) => new Element(tag),
    },
  });
  vm.runInContext(source, context);
  return context.window.homeMedia;
};

test("video detection is shared and handles extension case, fragments, and queries", () => {
  const { isVideoSource } = loadMedia();
  for (const path of ["clip.mp4", "clip.WEBM?download=1", "clip.ogg#start", "/dir/a.MP4?q#f"]) {
    assert.equal(isVideoSource(path), true, path);
  }
  for (const path of ["", "image.png", "clip.mp4.png", "mp4", "clip.mp4/extra"]) {
    assert.equal(isVideoSource(path), false, path);
  }
});

test("hourglass creation is hidden, decorative, and supports each route's CSS block", () => {
  const { createLoadingIndicator } = loadMedia();
  for (const className of ["media-loading", "gallery-loading-indicator"]) {
    const indicator = createLoadingIndicator({ className });
    assert.equal(indicator.className, className);
    assert.equal(indicator.hidden, true);
    assert.equal(indicator.getAttribute("aria-hidden"), "true");
    const image = indicator.querySelector("img");
    assert.equal(image.className, `${className}__image`);
    assert.equal(image.alt, "");
    assert.equal(image.decoding, "async");
    assert.equal(image.getAttribute("src"), null);
  }
  assert.equal(createLoadingIndicator().className, "media-loading");
});

test("loader uses strict compact thresholds and route-relative assets, then clears busy state", () => {
  const { setLoading, createLoadingIndicator } = loadMedia();
  setLoading(null, true);
  for (const options of [{}, {
    className: "gallery-loading-indicator", loadingClass: "is-image-loading", assetRoot: "../",
  }]) {
    const slot = new Element("div");
    // Both pre-created (Modeling) and on-demand (Home) indicators are supported.
    if (!options.className) slot.appendChild(createLoadingIndicator());
    const className = options.className ?? "media-loading";
    for (const [width, height, compact] of [[258, 272, false], [257, 272, true], [258, 271, true], [400, 400, false]]) {
      slot.clientWidth = width;
      slot.clientHeight = height;
      setLoading(slot, true, options);
      assert.equal(slot.children.length, 1);
      const indicator = slot.children[0];
      const image = indicator.querySelector("img");
      assert.equal(indicator.classes.has(`${className}--compact`), compact);
      assert.equal(image.getAttribute("src"), `${options.assetRoot ?? ""}assets/loading/windows98-hourglass${compact ? "" : "-padded"}-2x.gif`);
      assert.equal(indicator.hidden, false);
      assert.equal(slot.getAttribute("aria-busy"), "true");
      if (options.loadingClass) assert.equal(slot.classes.has(options.loadingClass), true);
      const writes = image.sourceWrites;
      setLoading(slot, true, options);
      assert.equal(image.sourceWrites, writes, "repeat calls do not restart the GIF");
      setLoading(slot, false, options);
      assert.equal(indicator.hidden, true);
      assert.equal(slot.getAttribute("aria-busy"), null);
      assert.equal(slot.classes.has("is-image-loading"), false);
    }
  }
});
