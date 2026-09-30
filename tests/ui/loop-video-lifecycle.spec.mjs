import { expect, test } from "./deterministic.mjs";
import { openHomeDesktop } from "./helpers/rendered-site.mjs";

/**
 * The playback lifecycle of `video[data-loop-video]`, which
 * `scripts/home/core/media.js` owns outright. Each case covers a way a loop could
 * keep running where the visitor can never see it, or stop short of running at
 * all. Contract: `docs/validation/media-formats.md`.
 */

const viewport = Object.freeze({ width: 1440, height: 900 });

/**
 * Long enough for several frames of the slowest loop the site ships (50/3 fps, a
 * 60 ms frame) to pass if one were playing. A wait is inherent to "never
 * advanced": there is no event to await for something that must not happen.
 */
const OBSERVATION_MS = 500;

const loopVideo = (page, name) => page.locator(`video[data-loop-video="${name}"]`);
const readPlayback = (video) =>
  video.evaluate((element) => ({
    autoplay: element.autoplay,
    paused: element.paused,
    currentTime: element.currentTime,
    readyState: element.readyState,
    // `played` accumulates every range the element has ever played, so an empty
    // list is proof of no playback that no timing can flatter.
    playedRanges: element.played.length,
  }));

const triggerEvent = async (page, eventId) => {
  const result = await page.evaluate(
    (id) =>
      window.rohinAdminOrchestrator.runEvent(id, {
        source: "loop-video-lifecycle-test",
      }),
    eventId
  );
  expect(result.ok, `${eventId} triggered`).toBe(true);
};

/** Opens a hidden result window in place, the way its own show callback would. */
const revealWindow = (page, windowId) =>
  page.evaluate((id) => {
    const owner = document.querySelector(id);
    owner.classList.remove("is-hidden");
    owner.setAttribute("aria-hidden", "false");
    window.homeMedia.loadDeferredMedia(owner);
  }, windowId);

test("a preloaded result window that never opened keeps its loop video at the first frame", async ({
  page,
}) => {
  await openHomeDesktop(page, viewport);
  await triggerEvent(page, "serval-pizza-encounter");

  // The encounter window is what opened. Its result window holds the loop video
  // and stays shut until the visitor offers pizza, but the preloader resolves its
  // sources now, which is when native autoplay would have started the loop.
  await expect(page.locator("#serval-encounter-window")).toBeVisible();
  await expect(page.locator("#serval-pizza-window")).toBeHidden();

  const video = loopVideo(page, "servalpizza");
  await expect
    .poll(() => video.evaluate((element) => element.readyState))
    .toBeGreaterThanOrEqual(2);

  const before = await readPlayback(video);
  expect(before.autoplay, "playback belongs to the helper, not the element").toBe(false);
  expect(before.paused).toBe(true);

  await page.waitForTimeout(OBSERVATION_MS);

  const after = await readPlayback(video);
  expect(after.paused).toBe(true);
  expect(after.currentTime).toBe(before.currentTime);
  expect(after.playedRanges, "the hidden loop never played at all").toBe(0);
});

test("a hidden page pauses a playing loop video without waiting for an animation frame", async ({
  page,
}) => {
  await openHomeDesktop(page, viewport);
  await triggerEvent(page, "dont-starve-campfire");
  await revealWindow(page, "#dst-survive-window");

  const video = loopVideo(page, "campfire");
  await expect.poll(() => video.evaluate((element) => element.paused)).toBe(false);

  const pausedSynchronously = await page.evaluate(() => {
    // A background tab suspends animation frames, so a pause that waits for one
    // may never run. Nothing after this line gets a frame.
    const scheduleFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    const paused = document.querySelector('video[data-loop-video="campfire"]').paused;
    window.requestAnimationFrame = scheduleFrame;
    return paused;
  });
  expect(pausedSynchronously).toBe(true);

  const stopped = await video.evaluate((element) => element.currentTime);
  await page.waitForTimeout(OBSERVATION_MS);
  expect(await video.evaluate((element) => element.currentTime)).toBe(stopped);
});

test("pagehide pauses a playing loop video synchronously", async ({ page }) => {
  await openHomeDesktop(page, viewport);
  await triggerEvent(page, "dont-starve-campfire");
  await revealWindow(page, "#dst-survive-window");

  const video = loopVideo(page, "campfire");
  await expect.poll(() => video.evaluate((element) => element.paused)).toBe(false);

  // `pagehide` can be the last code the page runs before it is frozen or
  // discarded, and the document is still visible when it fires.
  const pausedSynchronously = await page.evaluate(() => {
    const scheduleFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;
    window.dispatchEvent(new Event("pagehide"));
    const paused = document.querySelector('video[data-loop-video="campfire"]').paused;
    window.requestAnimationFrame = scheduleFrame;
    return paused;
  });
  expect(pausedSynchronously).toBe(true);
  expect(await page.evaluate(() => document.hidden)).toBe(false);

  // A sync frame queued before the hide must not undo the pause.
  const stopped = await video.evaluate((element) => element.currentTime);
  await page.waitForTimeout(OBSERVATION_MS);
  expect(await video.evaluate((element) => element.paused)).toBe(true);
  expect(await video.evaluate((element) => element.currentTime)).toBe(stopped);
});

test("the advertisement draws its two stacked layers as one animated image", async ({
  page,
}) => {
  await openHomeDesktop(page, viewport);
  await triggerEvent(page, "evil-wizards-advertisement");
  await expect(page.locator("#advertisement-window")).toBeVisible();

  // Two `<video>` decoders of one file each run their own clock and drift; two
  // `<img>` of one animated WebP share the browser's animation clock, which is
  // how the GIF layers this replaced stayed in step.
  const layers = page.locator(
    "#advertisement-window #advertisement-image, " +
      "#advertisement-window .advertisement-text-pixel-overlay"
  );
  await expect(layers).toHaveCount(2);

  const drawn = await layers.evaluateAll(async (elements) => {
    await Promise.all(elements.map((element) => element.decode()));
    return elements.map((element) => ({
      tag: element.tagName,
      source: element.currentSrc,
      width: element.naturalWidth,
    }));
  });

  expect(drawn.map((layer) => layer.tag)).toEqual(["IMG", "IMG"]);
  expect(
    new Set(drawn.map((layer) => layer.source)).size,
    `layer sources: ${drawn.map((layer) => layer.source).join(", ")}`
  ).toBe(1);
  expect(drawn[0].source).toMatch(/\/assets\/optimized\/random-events\/evil-wizards-radar\.webp$/);
  expect(drawn.every((layer) => layer.width > 0), "both layers decoded").toBe(true);

  // The radar overlay is the one layer with a source of its own, so it stays a
  // loop video and keeps the whole lifecycle contract.
  await expect(loopVideo(page, "radar")).toHaveCount(1);
  await expect
    .poll(() => loopVideo(page, "radar").evaluate((element) => element.paused))
    .toBe(false);
});

test("a window cloned after boot pauses its loop video when it is hidden", async ({ page }) => {
  await openHomeDesktop(page, viewport);

  // Owners are registered when their media is activated, not snapshotted at boot,
  // so a window that did not exist at boot is watched on the same terms.
  await page.evaluate(() => {
    const clone = document.querySelector("#dst-survive-window").cloneNode(true);
    clone.id = "loop-video-lifecycle-clone";
    clone.classList.remove("is-hidden");
    clone.setAttribute("aria-hidden", "false");
    document.body.append(clone);
    window.homeMedia.loadDeferredMedia(clone);
  });

  const cloned = page.locator("#loop-video-lifecycle-clone video[data-loop-video]");
  await expect.poll(() => cloned.evaluate((element) => element.paused)).toBe(false);

  await page.evaluate(() =>
    document.querySelector("#loop-video-lifecycle-clone").classList.add("is-hidden")
  );
  await expect.poll(() => cloned.evaluate((element) => element.paused)).toBe(true);

  const stopped = await cloned.evaluate((element) => element.currentTime);
  await page.waitForTimeout(OBSERVATION_MS);
  expect(await cloned.evaluate((element) => element.currentTime)).toBe(stopped);
});

test("every Admin Controls event preview that clones a loop video stays inert", async ({
  page,
}) => {
  await openHomeDesktop(page, viewport);

  // A preview is a clone, so it now registers an owner like any other window. It
  // must still show nothing but the poster frame.
  const previewedEvents = await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "loop-video-lifecycle-previews";
    document.body.append(host);
    return window.rohinAdminOrchestrator
      .listEvents()
      .map((event) => {
        const preview = window.rohinAdminOrchestrator.createEventPreview(event.id);
        if (!preview?.querySelector("video[data-loop-video]")) return null;
        host.append(preview);
        return event.id;
      })
      .filter(Boolean);
  });
  expect(previewedEvents.length, "some preview clones a loop video").toBeGreaterThan(0);

  await page.waitForTimeout(OBSERVATION_MS);

  const states = await page
    .locator("#loop-video-lifecycle-previews video[data-loop-video]")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        paused: element.paused,
        playedRanges: element.played.length,
      }))
    );
  expect(states.length).toBeGreaterThan(0);
  expect(states.filter((state) => !state.paused || state.playedRanges > 0)).toEqual([]);
});

test("readiness that arrives after pagehide does not restart a loop video", async ({ page }) => {
  await openHomeDesktop(page, viewport);
  await triggerEvent(page, "dont-starve-campfire");
  await revealWindow(page, "#dst-survive-window");

  const video = loopVideo(page, "campfire");
  await expect.poll(() => video.evaluate((element) => element.paused)).toBe(false);

  // The media stack does not stop because the document is on its way out: a
  // buffer that fills after `pagehide` still fires its readiness events, and the
  // document is not `hidden` while they land.
  const hidden = await page.evaluate(async () => {
    const element = document.querySelector('video[data-loop-video="campfire"]');
    window.dispatchEvent(new Event("pagehide"));
    const pausedAtHide = element.paused;
    ["loadeddata", "canplay", "playing"].forEach((name) => {
      element.dispatchEvent(new Event(name));
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { pausedAtHide, pausedAfterReadiness: element.paused };
  });
  expect(hidden.pausedAtHide).toBe(true);
  expect(hidden.pausedAfterReadiness, "late readiness cannot undo the hide").toBe(true);

  const stopped = await video.evaluate((element) => element.currentTime);
  await page.waitForTimeout(OBSERVATION_MS);
  expect(await video.evaluate((element) => element.paused)).toBe(true);
  expect(await video.evaluate((element) => element.currentTime)).toBe(stopped);

  // Only the matching resume event lifts the suspension.
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect.poll(() => video.evaluate((element) => element.paused)).toBe(false);
});
