import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("media loading uses active-content-first and sequential background contracts", async () => {
  const [media, main] = await Promise.all([
    readFile(new URL("scripts/home/core/media.js", root), "utf8"),
    readFile(new URL("scripts/home/main.js", root), "utf8"),
  ]);

  assert.match(media, /const deferredMediaPriority = \(element\) =>/);
  assert.match(media, /viewer && !viewer\.classList\.contains\("is-hidden"\) \? 0 : 1/);
  assert.match(media, /shouldContinue = \(\) => true/);
  assert.match(media, /const preloadDeferredMediaInOrder = \(/);
  assert.match(media, /\.filter\(\(element\) => element\.matches\("img, video, audio"\)\)/);
  assert.match(media, /loadDeferredMediaElement\(element, false, \{ eager: hiddenOnly \}\)/);
  assert.match(media, /if \(!shouldContinue\(\)\) return "skipped";/);
  assert.match(media, /if \(eager && element\.matches\("img"\)\) element\.loading = "eager";/);
  assert.doesNotMatch(
    media.slice(media.indexOf("const preloadDeferredMediaInOrder")),
    /iframe/
  );
  assert.match(media, /const preloadMediaSourcesInOrder = \(sources, \{ shouldContinue = \(\) => true \} = \{\}\) =>/);
  assert.match(media, /queue\.then\(\(\) => \(shouldContinue\(\) \? preloadMediaSource\(source\) : "skipped"\)\)/);
  assert.match(media, /video\.preload = "metadata";/);
  assert.match(media, /audio\.preload = "metadata";/);
  assert.match(media, /preloadMediaSourcesAfter,/);

  assert.match(main, /const orderedGallerySuccessorSources = \(items, currentIndex\) =>/);
  assert.match(main, /const index = \(currentIndex \+ offset \+ 1\) % items\.length;/);
  assert.match(main, /const queueGallerySuccessors = \(element, items, currentIndex\) =>/);
  assert.match(main, /preloadMediaSourcesAfter\(element, successors, \{/);
  assert.match(main, /galleryPreloadTokens\.get\(element\) === token && isVisibleMediaElement\(element\)/);
  assert.match(main, /const prewarmOpenedAppMedia = \(root, carouselTasks\) =>/);
  assert.match(main, /preloadDeferredMediaInOrder\(root, \{ activeOnly: true \}\)/);
  assert.match(main, /activeMedia\s*\.then\(\(\) => Promise\.all\(carouselTasks\)\)/);
  assert.match(main, /const orderedHiddenViewerPanels = \(root\) =>/);
  assert.match(main, /\(activeIndex \+ offset \+ 1\) % selectorButtons\.length/);
  assert.match(main, /const prewarmHiddenAppPanels = \(root, shouldContinue\) =>/);
  assert.match(main, /preloadMediaSourcesInOrder\(inactiveModelingGallerySources\(root\), \{ shouldContinue \}\)/);
  assert.match(main, /prewarmHiddenAppPanels\(root, shouldContinue\)/);
  assert.match(main, /renderModelingGallery\(container\);[\s\S]*?loadDeferredMedia\(root, true\);/);
});
