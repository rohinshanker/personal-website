import { expect, test } from "./deterministic.mjs";
import { FROZEN_INSTANT, openHomeDesktop } from "./helpers/rendered-site.mjs";

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

/**
 * `LOOP_VIDEO_FALLBACK_MS` in `scripts/home/core/media.js`: how long a visible
 * video may stay below `HAVE_FUTURE_DATA` before its animated WebP replaces it.
 * The fallback cases jump the clock past it rather than waiting it out.
 */
const FALLBACK_BOUND_MS = 8000;

const loopVideo = (page, name) => page.locator(`video[data-loop-video="${name}"]`);

/** The image `activateLoopVideoFallback` leaves behind in a video's place. */
const loopFallbackImage = (page, name) => page.locator(`img[data-loop-fallback-for="${name}"]`);

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

test("a clone whose sources already resolved is registered and pauses when hidden", async ({
  page,
}) => {
  await openHomeDesktop(page, viewport);
  await triggerEvent(page, "dont-starve-campfire");

  // Preloading the original resolves its sources, so the clone below inherits a
  // real `src` on every one of them — the shape that used to skip registration.
  await expect
    .poll(() => loopVideo(page, "campfire").evaluate((element) => element.readyState))
    .toBeGreaterThanOrEqual(2);

  const arrivedResolved = await page.evaluate(() => {
    const clone = document.querySelector("#dst-survive-window").cloneNode(true);
    clone.id = "loop-video-lifecycle-resolved-clone";
    clone.classList.remove("is-hidden");
    clone.setAttribute("aria-hidden", "false");
    document.body.append(clone);
    const sources = [...clone.querySelectorAll("video[data-loop-video] source")];
    window.homeMedia.loadDeferredMedia(clone);
    return sources.length > 0 && sources.every((source) => source.getAttribute("src"));
  });
  expect(arrivedResolved, "the clone arrived with its sources already resolved").toBe(true);

  const cloned = page.locator("#loop-video-lifecycle-resolved-clone video[data-loop-video]");
  await expect.poll(() => cloned.evaluate((element) => element.paused)).toBe(false);

  await page.evaluate(() =>
    document.querySelector("#loop-video-lifecycle-resolved-clone").classList.add("is-hidden")
  );
  await expect.poll(() => cloned.evaluate((element) => element.paused)).toBe(true);

  const stopped = await cloned.evaluate((element) => element.currentTime);
  await page.waitForTimeout(OBSERVATION_MS);
  expect(await cloned.evaluate((element) => element.currentTime)).toBe(stopped);
});

test("a loop video whose sources never arrive falls back to its animated WebP", async ({
  page,
}) => {
  // The bound is jumped, not waited out, so the case costs no wall-clock time.
  await page.clock.install({ time: FROZEN_INSTANT });

  let releaseSources = () => {};
  const held = new Promise((resolve) => {
    releaseSources = resolve;
  });
  // A response that never finishes leaves `readyState` at `HAVE_NOTHING` with no
  // further event to wait on. `aborted` is the page cancelling its own request,
  // which the runtime-diagnostics fixture treats as ordinary.
  await page.route(/\/campfire\.(?:webm|mp4)(?:\?.*)?$/, async (route) => {
    await held;
    await route.abort("aborted");
  });

  await openHomeDesktop(page, viewport);
  // The window is opened directly: the event's own preloader awaits a decoded
  // frame, which a source that never arrives never delivers.
  await revealWindow(page, "#dst-survive-window");

  const video = loopVideo(page, "campfire");
  await expect
    .poll(() => video.evaluate((element) => element.readyState))
    .toBe(0);
  await expect(loopFallbackImage(page, "campfire")).toHaveCount(0);

  await page.clock.fastForward(FALLBACK_BOUND_MS);

  const fallback = loopFallbackImage(page, "campfire");
  await expect(fallback).toHaveCount(1);
  await expect(fallback).toHaveJSProperty("naturalWidth", 858);
  expect(await fallback.getAttribute("src")).toBe(
    "assets/optimized/random-events/campfire.webp"
  );
  expect(await video.evaluate((element) => element.hidden)).toBe(true);

  releaseSources();
});

test("a loop video that never reaches HAVE_FUTURE_DATA falls back to its animated WebP", async ({
  page,
}) => {
  await page.clock.install({ time: FROZEN_INSTANT });
  await openHomeDesktop(page, viewport);

  // A response that arrives but never buffers enough to start is the other half
  // of "unplayable": the element holds a decoded poster frame and stops there.
  await page.evaluate(() => {
    Object.defineProperty(
      document.querySelector('video[data-loop-video="campfire"]'),
      "readyState",
      { configurable: true, get: () => 1 }
    );
  });

  await triggerEvent(page, "dont-starve-campfire");
  await revealWindow(page, "#dst-survive-window");

  const video = loopVideo(page, "campfire");
  await expect.poll(() => video.evaluate((element) => element.readyState)).toBe(1);
  await expect(loopFallbackImage(page, "campfire")).toHaveCount(0);

  await page.clock.fastForward(FALLBACK_BOUND_MS);

  const fallback = loopFallbackImage(page, "campfire");
  await expect(fallback).toHaveCount(1);
  await expect(fallback).toHaveJSProperty("naturalWidth", 858);
  expect(await video.evaluate((element) => element.paused)).toBe(true);
  expect(await video.evaluate((element) => element.hidden)).toBe(true);
});

const pinReadyState = (page, name, readyState) =>
  page.evaluate(
    ([loopName, value]) => {
      Object.defineProperty(
        document.querySelector(`video[data-loop-video="${loopName}"]`),
        "readyState",
        { configurable: true, get: () => value }
      );
    },
    [name, readyState]
  );

const hideWindow = (page, windowId) =>
  page.evaluate((id) => {
    const owner = document.querySelector(id);
    owner.classList.add("is-hidden");
    owner.setAttribute("aria-hidden", "true");
  }, windowId);

test("time spent hidden does not count towards the fallback wait", async ({ page }) => {
  await page.clock.install({ time: FROZEN_INSTANT });
  await openHomeDesktop(page, viewport);
  // Real time must not creep between commands: the deadlines below are exact.
  await page.clock.pauseAt(FROZEN_INSTANT);
  await pinReadyState(page, "campfire", 1);

  await triggerEvent(page, "dont-starve-campfire");
  await revealWindow(page, "#dst-survive-window");
  await page.clock.runFor(1000);

  await hideWindow(page, "#dst-survive-window");
  await page.clock.runFor(6700);
  await revealWindow(page, "#dst-survive-window");

  // 8.2 s after the first reveal, 0.5 s after the second: the first stay's
  // wait was cancelled when the window closed.
  await page.clock.runFor(500);
  await expect(loopFallbackImage(page, "campfire")).toHaveCount(0);

  await page.clock.runFor(FALLBACK_BOUND_MS - 600);
  await expect(loopFallbackImage(page, "campfire")).toHaveCount(0);

  await page.clock.runFor(200);
  await expect(loopFallbackImage(page, "campfire")).toHaveCount(1);
});

test("a suspended page cancels the fallback wait and a resumed page starts a full one", async ({
  page,
}) => {
  await page.clock.install({ time: FROZEN_INSTANT });
  await openHomeDesktop(page, viewport);
  // Real time must not creep between commands: the deadlines below are exact.
  await page.clock.pauseAt(FROZEN_INSTANT);
  await pinReadyState(page, "campfire", 1);

  await triggerEvent(page, "dont-starve-campfire");
  await revealWindow(page, "#dst-survive-window");
  await page.clock.runFor(1000);

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  await page.clock.runFor(FALLBACK_BOUND_MS);
  await expect(loopFallbackImage(page, "campfire")).toHaveCount(0);

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow")));
  await page.clock.runFor(FALLBACK_BOUND_MS - 500);
  await expect(loopFallbackImage(page, "campfire")).toHaveCount(0);

  await page.clock.runFor(1000);
  await expect(loopFallbackImage(page, "campfire")).toHaveCount(1);
});

test("a loop video that was playable once keeps its video when it buffers later", async ({
  page,
}) => {
  await page.clock.install({ time: FROZEN_INSTANT });
  await openHomeDesktop(page, viewport);
  // Real time must not creep between commands: the deadlines below are exact.
  await page.clock.pauseAt(FROZEN_INSTANT);
  await pinReadyState(page, "campfire", 1);

  await triggerEvent(page, "dont-starve-campfire");
  await revealWindow(page, "#dst-survive-window");
  await page.clock.runFor(500);

  await pinReadyState(page, "campfire", 4);
  await loopVideo(page, "campfire").evaluate((element) =>
    element.dispatchEvent(new Event("canplay"))
  );
  // Readiness drops again before any scheduled sync could observe the 4.
  await pinReadyState(page, "campfire", 2);
  await page.clock.runFor(FALLBACK_BOUND_MS * 2);

  await expect(loopFallbackImage(page, "campfire")).toHaveCount(0);
  await expect(loopVideo(page, "campfire")).toBeVisible();
});

test("a loop video removed from the document before its wait ends is left alone", async ({
  page,
}) => {
  await page.clock.install({ time: FROZEN_INSTANT });
  await openHomeDesktop(page, viewport);
  await page.clock.pauseAt(FROZEN_INSTANT);
  await pinReadyState(page, "campfire", 1);

  await triggerEvent(page, "dont-starve-campfire");
  await revealWindow(page, "#dst-survive-window");
  await page.clock.runFor(1000);

  const detached = await page.evaluateHandle(() => {
    const owner = document.querySelector("#dst-survive-window");
    owner.remove();
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    return owner;
  });
  await page.clock.runFor(FALLBACK_BOUND_MS * 2);

  expect(
    await detached.evaluate((owner) => owner.querySelectorAll("img[data-loop-fallback-for]").length)
  ).toBe(0);
  expect(await detached.evaluate((owner) => owner.querySelector("video").hidden)).toBe(false);
});

test("a loop video whose sources cannot be decoded falls back to its animated WebP", async ({
  page,
  diagnostics,
}) => {
  await page.clock.install({ time: FROZEN_INSTANT });
  // Both formats answer and neither decodes. The `<video>` is left at
  // `HAVE_NOTHING` with `NETWORK_NO_SOURCE`, and its pending `play()` never
  // settles, so the bounded wait is the only thing that clears the poster.
  await page.route(/\/campfire\.(?:webm|mp4)(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "video/webm", body: Buffer.from("not a video at all") })
  );

  await openHomeDesktop(page, viewport);
  // Sources that fail fire `error` at the `<source>` elements, never at the
  // `<video>`, so the event's preloader would wait on a frame that never comes.
  await revealWindow(page, "#dst-survive-window");

  const video = loopVideo(page, "campfire");
  await expect.poll(() => video.evaluate((element) => element.networkState)).toBe(3);
  await expect(loopFallbackImage(page, "campfire")).toHaveCount(0);

  await page.clock.fastForward(FALLBACK_BOUND_MS);

  const fallback = loopFallbackImage(page, "campfire");
  await expect(fallback).toHaveCount(1);
  await expect(fallback).toHaveJSProperty("naturalWidth", 858);
  expect(await fallback.getAttribute("src")).toBe(
    "assets/optimized/random-events/campfire.webp"
  );
  expect(await video.evaluate((element) => element.hidden)).toBe(true);

  // Undecodable media is what this case serves on purpose.
  diagnostics.consoleErrors.length = 0;
});
