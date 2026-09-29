import { expect, test } from "./deterministic.mjs";
import { openHomeDesktop } from "./helpers/rendered-site.mjs";

/**
 * The playback lifecycle of `video[data-loop-video]`, which
 * `scripts/home/core/media.js` owns outright. Each case covers a way a loop could
 * keep running where the visitor can never see it, or two layers of one animation
 * could fall out of step. Contract: `docs/validation/media-formats.md`.
 */

const viewport = Object.freeze({ width: 1440, height: 900 });

/**
 * Long enough for several frames of the slowest loop the site ships (50/3 fps, a
 * 60 ms frame) to pass if one were playing. A wait is inherent to "never
 * advanced": there is no event to await for something that must not happen.
 */
const OBSERVATION_MS = 500;

/** Held back far enough that a per-element clock would show a whole second of offset. */
const SECOND_LAYER_DELAY_MS = 1000;

/**
 * One frame at 50/3 fps, the rate of the clip the advertisement stacks twice. The
 * helper re-aligns past one frame at 30 fps, so anything beyond this is a layer
 * that never joined the group's clock.
 */
const ONE_FRAME_SECONDS = 0.06;

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

test("the advertisement's stacked layers share one clock when the second response is held back", async ({
  page,
}) => {
  await openHomeDesktop(page, viewport);

  let radarRequests = 0;
  // Both layers decode the same file. Holding the second response back is what
  // drove them a second apart when each owned its own clock.
  await page.route("**/evil-wizards-radar.webm", async (route) => {
    radarRequests += 1;
    if (radarRequests === 2) {
      await new Promise((resolve) => setTimeout(resolve, SECOND_LAYER_DELAY_MS));
    }
    await route.continue();
  });

  await triggerEvent(page, "evil-wizards-advertisement");
  await expect(page.locator("#advertisement-window")).toBeVisible();

  const layerTimes = () =>
    page.evaluate(() =>
      ["evil-wizards-radar", "evil-wizards-radar-text"].map((name) => {
        const element = document.querySelector(`video[data-loop-video="${name}"]`);
        return { paused: element.paused, currentTime: element.currentTime };
      })
    );

  await expect
    .poll(async () => (await layerTimes()).every((layer) => !layer.paused), {
      timeout: 15_000,
    })
    .toBe(true);
  expect(radarRequests, "each layer fetched the shared source once").toBe(2);

  // Neither layer may start before the other can, and neither may drift away
  // afterwards, so the offset is sampled across a stretch of playback.
  const offsets = [];
  for (let sample = 0; sample < 5; sample += 1) {
    const [base, overlay] = await layerTimes();
    offsets.push(Math.abs(base.currentTime - overlay.currentTime));
    await page.waitForTimeout(200);
  }
  expect(Math.max(...offsets), `layer offsets: ${offsets.join(", ")}`).toBeLessThanOrEqual(
    ONE_FRAME_SECONDS
  );
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
