(() => {
// Keep route-specific styling and asset roots at the call site.
const LOADING_RAW_ASSET = "assets/loading/windows98-hourglass-2x.gif";
const LOADING_PADDED_ASSET = "assets/loading/windows98-hourglass-padded-2x.gif";
const LOADING_RAW_WIDTH = 258;
const LOADING_RAW_HEIGHT = 272;

const isVideoSource = (source) => /\.(mp4|webm|ogg)(?:[?#]|$)/i.test(source);

const createLoadingIndicator = ({ className = "media-loading" } = {}) => {
  const indicator = document.createElement("div");
  indicator.className = className;
  indicator.hidden = true;
  indicator.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.className = `${className}__image`;
  image.alt = "";
  image.decoding = "async";
  indicator.appendChild(image);
  return indicator;
};

const setLoading = (
  slot,
  isLoading,
  { className = "media-loading", assetRoot = "", loadingClass = "" } = {}
) => {
  if (!slot) return;
  let indicator = slot.querySelector(`:scope > .${className}`);
  if (!indicator) {
    indicator = createLoadingIndicator({ className });
    slot.appendChild(indicator);
  }
  if (isLoading) {
    const compact = slot.clientWidth < LOADING_RAW_WIDTH || slot.clientHeight < LOADING_RAW_HEIGHT;
    indicator.classList.toggle(`${className}--compact`, compact);
    const image = indicator.querySelector("img");
    const source = assetRoot + (compact ? LOADING_RAW_ASSET : LOADING_PADDED_ASSET);
    if (image.getAttribute("src") !== source) image.setAttribute("src", source);
    slot.setAttribute("aria-busy", "true");
  } else {
    slot.removeAttribute("aria-busy");
  }
  indicator.hidden = !isLoading;
  if (loadingClass) slot.classList.toggle(loadingClass, isLoading);
};

const deferredMediaElements = (root) => {
  if (!root) return [];
  const elements = root.matches && root.matches("[data-src]") ? [root] : [];
  return root.querySelectorAll
    ? [...elements, ...root.querySelectorAll("[data-src]")]
    : elements;
};

const isHiddenDeferredMediaElement = (element) =>
  Boolean(element?.closest(".viewer-content.is-hidden"));

const deferredMediaPriority = (element) => {
  const viewer = element?.closest(".viewer-content");
  return viewer && !viewer.classList.contains("is-hidden") ? 0 : 1;
};

const orderedDeferredMediaElements = (
  root,
  { activeOnly = false, hiddenOnly = false, visibleOnly = false } = {}
) =>
  deferredMediaElements(root)
    .filter((element) => {
      const hidden = isHiddenDeferredMediaElement(element);
      const activeViewer =
        Boolean(element.closest(".viewer-content")) && !hidden;
      if (activeOnly) return activeViewer;
      if (hiddenOnly) return hidden;
      return !visibleOnly || !hidden;
    })
    .sort((first, second) => deferredMediaPriority(first) - deferredMediaPriority(second));

const fitImageIntoFrame = (image) => {
  if (!image || !image.matches("img")) return;
  const frame = image.closest("[data-fit-image-frame]");
  if (!frame) return;

  const applyImageFit = () => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    frame.style.setProperty(
      "--image-fit-aspect",
      `${image.naturalWidth} / ${image.naturalHeight}`
    );
  };

  if (image.dataset.fitImageFrameBound !== "true") {
    image.addEventListener("load", applyImageFit);
    image.dataset.fitImageFrameBound = "true";
  }

  if (image.complete) applyImageFit();
};

const fitImagesIntoFrames = (root = document) => {
  if (!root) return;
  const images = [];
  if (root.matches && root.matches("[data-fit-image-frame] img")) images.push(root);
  if (root.querySelectorAll) {
    images.push(...root.querySelectorAll("[data-fit-image-frame] img"));
  }
  images.forEach(fitImageIntoFrame);
};

const shouldSkipDeferredMediaElement = (element, visibleOnly) =>
  visibleOnly && isHiddenDeferredMediaElement(element);

const isHiddenCarouselMediaElement = (element) =>
  Boolean(
    element?.closest(".gallery-scroll") &&
      (element.hidden ||
        isHiddenDeferredMediaElement(element) ||
        element.closest(".app-window.is-hidden, .home-window.is-hidden"))
  );

const suspendHiddenCarouselMediaPlayback = (element) => {
  if (!element?.matches("video, audio") || !isHiddenCarouselMediaElement(element)) return;

  element.pause();
  element.autoplay = false;
};

/**
 * Looping event artwork that ships as `<video>` instead of an animated image.
 * This helper owns playback outright: the markup carries no `autoplay`, and a
 * video plays only while its window and the page are visible. When `play()` is
 * refused, or the media never becomes playable, the animated-WebP derivative
 * named by `data-loop-fallback` takes its place.
 */
const LOOP_VIDEO_SELECTOR = "video[data-loop-video]";

const LOOP_VIDEO_INACTIVE_ANCESTORS = [
  ".window.is-hidden",
  ".window.is-closing",
  ".viewer-content.is-hidden",
  ".app-window.is-hidden",
  ".home-window.is-hidden",
  '.window[data-media-closing="true"]',
  "[data-admin-event-preview-window]",
].join(", ");

/** `HAVE_FUTURE_DATA`: the element has enough buffered to start without stalling. */
const LOOP_VIDEO_READY_TO_PLAY = 3;

/**
 * How long a loop video that has never been playable may stay visible before
 * its animated WebP replaces it: a chosen deadline, short enough that a corrupt
 * or never-finishing response does not leave a poster frame standing in for the
 * animation for good.
 */
const LOOP_VIDEO_FALLBACK_MS = 8000;

const loopVideoElements = (root = document) => {
  if (!root?.querySelectorAll) return [];
  const own = root.matches?.(LOOP_VIDEO_SELECTOR) ? [root] : [];
  return [...own, ...root.querySelectorAll(LOOP_VIDEO_SELECTOR)];
};

/**
 * True while the page is hidden, frozen, or on its way into the back/forward
 * cache. Readiness arrives on its own schedule, so without this state a
 * `canplay` after `pagehide` would restart a loop nobody can see; only
 * `pageshow` or a visible `visibilitychange` clears it.
 */
let loopVideoPageSuspended = false;

const isLoopVideoActive = (video) =>
  Boolean(
    video?.isConnected &&
      !video.hidden &&
      !document.hidden &&
      !loopVideoPageSuspended &&
      !video.closest(LOOP_VIDEO_INACTIVE_ANCESTORS)
  );

const hasResolvedMediaSource = (video) =>
  Boolean(video?.getAttribute("src") || video?.querySelector("source[src]"));

/** True once the fallback image took the video's place, so it owns no playback. */
const isLoopVideoReplaced = (video) => video?.dataset.loopFallbackActive === "true";

/** Replaces an unplayable `<video>` with the animated image it names, keeping the same box. */
const activateLoopVideoFallback = (video) => {
  const source = video?.dataset.loopFallback;
  if (!source || isLoopVideoReplaced(video)) return;
  video.dataset.loopFallbackActive = "true";
  cancelLoopVideoFallback(video);
  video.pause();

  const image = document.createElement("img");
  image.className = video.className;
  image.decoding = "async";
  image.alt = "";
  ["width", "height", "aria-hidden"].forEach((name) => {
    if (video.hasAttribute(name)) image.setAttribute(name, video.getAttribute(name));
  });
  image.dataset.loopFallbackFor = video.dataset.loopVideo || "";
  image.src = source;
  video.insertAdjacentElement("afterend", image);
  // The event rules set `display: block`, which outranks the `hidden` UA rule,
  // so the replaced video needs an inline display too.
  video.hidden = true;
  video.style.display = "none";
};

const startLoopVideo = (video) => {
  if (!video.paused) return;
  const playRequest = video.play();
  if (!playRequest || typeof playRequest.catch !== "function") return;
  playRequest.catch((error) => {
    // A pause that interrupts the request is ordinary; a refusal is not.
    if (error?.name === "AbortError" || !isLoopVideoActive(video)) return;
    activateLoopVideoFallback(video);
  });
};

const loopVideoFallbackTimers = new WeakMap();
const playableLoopVideos = new WeakSet();

const cancelLoopVideoFallback = (video) => {
  if (!loopVideoFallbackTimers.has(video)) return;
  clearTimeout(loopVideoFallbackTimers.get(video));
  loopVideoFallbackTimers.delete(video);
};

/** A video that was playable once keeps its `<video>`, even if it buffers later. */
const markLoopVideoPlayable = (video) => {
  playableLoopVideos.add(video);
  cancelLoopVideoFallback(video);
};

/**
 * The bounded wait behind the fallback. A corrupt or never-finishing response
 * can leave `readyState` below `HAVE_FUTURE_DATA` with no further event to wait
 * on, so a timer is the only way out of a frozen poster. The wait belongs to one
 * continuous stay on screen: leaving the screen or suspending the page cancels
 * it, and the next activation starts a full one.
 */
const awaitLoopVideoOrFallback = (video) => {
  if (playableLoopVideos.has(video) || loopVideoFallbackTimers.has(video)) return;
  loopVideoFallbackTimers.set(
    video,
    setTimeout(() => {
      loopVideoFallbackTimers.delete(video);
      // A video removed from the document keeps its timer, since nothing
      // observes removal; expiry re-checks that someone can still see it.
      if (isLoopVideoActive(video)) activateLoopVideoFallback(video);
    }, LOOP_VIDEO_FALLBACK_MS)
  );
};

/** Stops a video nobody can see and ends the wait that belonged to its stay on screen. */
const settleHiddenLoopVideo = (video) => {
  cancelLoopVideoFallback(video);
  if (!video.paused) video.pause();
};

const syncLoopVideoPlayback = (video) => {
  if (!video || isLoopVideoReplaced(video)) return;
  if (!isLoopVideoActive(video)) {
    settleHiddenLoopVideo(video);
    return;
  }
  if (!hasResolvedMediaSource(video)) return;
  if (video.readyState >= LOOP_VIDEO_READY_TO_PLAY) markLoopVideoPlayable(video);
  else awaitLoopVideoOrFallback(video);
  startLoopVideo(video);
};

let loopVideoSyncFrame = 0;

const cancelLoopVideoSync = () => {
  if (!loopVideoSyncFrame) return;
  cancelAnimationFrame(loopVideoSyncFrame);
  loopVideoSyncFrame = 0;
};

const scheduleLoopVideoSync = () => {
  if (loopVideoSyncFrame) return;
  loopVideoSyncFrame = requestAnimationFrame(() => {
    loopVideoSyncFrame = 0;
    loopVideoElements().forEach(syncLoopVideoPlayback);
  });
};

/** Stops what is out of sight now; starting again can wait for the scheduled frame. */
const pauseInactiveLoopVideos = () => {
  loopVideoElements().forEach((video) => {
    if (!isLoopVideoActive(video)) settleHiddenLoopVideo(video);
  });
};

/** Stops every loop video whatever its window looks like: the page itself is going. */
const pauseAllLoopVideos = () => {
  loopVideoElements().forEach(settleHiddenLoopVideo);
};

const onLoopVideoOwnerMutation = () => {
  pauseInactiveLoopVideos();
  scheduleLoopVideoSync();
};

/**
 * A hidden document suspends animation frames, so a pause that waits for one may
 * never run and the loop would keep advancing out of sight. Pausing happens here,
 * synchronously, and drops the frame already queued. The suspended flag then holds
 * until the page comes back, so a `canplay`, `loadeddata`, `error`, or mutation
 * that lands in between cannot start anything either.
 */
const suspendLoopVideoPage = () => {
  loopVideoPageSuspended = true;
  cancelLoopVideoSync();
  pauseAllLoopVideos();
};

const resumeLoopVideoPage = () => {
  loopVideoPageSuspended = false;
  scheduleLoopVideoSync();
};

const onLoopVideoPageVisibilityChange = () => {
  if (document.hidden) suspendLoopVideoPage();
  else resumeLoopVideoPage();
};

let loopVideoOwnerObserver = null;
const observedLoopVideoOwners = new WeakSet();

/**
 * Watches only the windows that own a loop video, so ordinary class churn costs
 * nothing. Registration happens per video rather than once at boot, so a window
 * cloned or built later is observed as soon as its media is activated.
 */
const observeLoopVideoOwner = (video) => {
  const owner = video?.closest?.(".window");
  if (!owner || observedLoopVideoOwners.has(owner)) return;
  observedLoopVideoOwners.add(owner);
  if (!loopVideoOwnerObserver) {
    loopVideoOwnerObserver = new MutationObserver(onLoopVideoOwnerMutation);
  }
  loopVideoOwnerObserver.observe(owner, {
    attributeFilter: ["class", "aria-hidden", "hidden", "data-media-closing"],
  });
};

const preparedLoopVideos = new WeakSet();

/**
 * Hands one video's playback to this helper before any source can resolve: native
 * autoplay would otherwise start it the moment `load()` finds data, inside a window
 * that has never opened. Readiness and failure events both re-drive the sync, so a
 * source that arrives late starts and one that never arrives falls back. Returns
 * true only for the call that registered the video.
 */
const prepareLoopVideo = (video) => {
  if (!video?.matches?.(LOOP_VIDEO_SELECTOR) || preparedLoopVideos.has(video)) return false;
  preparedLoopVideos.add(video);
  video.autoplay = false;
  ["loadeddata", "canplay", "playing", "error"].forEach((eventName) => {
    video.addEventListener(eventName, scheduleLoopVideoSync);
  });
  // Recorded at the event itself: readiness may have dropped again by the time
  // the scheduled sync runs.
  ["canplay", "playing"].forEach((eventName) => {
    video.addEventListener(eventName, () => {
      if (video.readyState >= LOOP_VIDEO_READY_TO_PLAY) markLoopVideoPlayable(video);
    });
  });
  observeLoopVideoOwner(video);
  return true;
};

const prepareLoopVideos = (root = document) => {
  loopVideoElements(root).forEach(prepareLoopVideo);
};

const watchLoopVideoVisibility = () => {
  prepareLoopVideos();
  document.addEventListener("visibilitychange", onLoopVideoPageVisibilityChange);
  // The last synchronous point before the page is frozen, cached, or discarded.
  window.addEventListener("pagehide", suspendLoopVideoPage);
  window.addEventListener("pageshow", resumeLoopVideoPage);
  scheduleLoopVideoSync();
};

// This module loads after the event markup, so the videos parsed so far hand over
// playback immediately; the rest are prepared when their media is activated.
prepareLoopVideos();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", watchLoopVideoVisibility, { once: true });
} else {
  watchLoopVideoVisibility();
}

/** The `<video>`/`<audio>` a deferred `<source>` belongs to, or null for any other element. */
const deferredSourceOwner = (element) =>
  element?.matches("source") ? element.parentElement?.closest("video, audio") ?? null : null;

/**
 * Starts the owning media element once every one of its deferred `<source>`
 * children carries a real `src`, so a two-format `<video>` loads exactly once.
 */
const activateDeferredSourceOwner = (owner) => {
  if (!owner) return;
  if (owner.dataset.poster && !owner.getAttribute("poster")) {
    owner.setAttribute("poster", owner.dataset.poster);
  }
  if (owner.querySelector("source[data-src]:not([src])")) return;
  prepareLoopVideo(owner);
  owner.load();
  scheduleLoopVideoSync();
};

const loadDeferredMediaElement = (element, visibleOnly = false, { eager = false } = {}) => {
  if (!element) return null;
  suspendHiddenCarouselMediaPlayback(element);
  if (shouldSkipDeferredMediaElement(element, visibleOnly)) return null;
  // Registration comes before the resolved-source return below. A window cloned
  // from one that already loaded arrives with `src` on every source, and it still
  // has to hand its playback over: otherwise nothing pauses it when it is hidden.
  if (prepareLoopVideo(deferredSourceOwner(element) ?? element)) scheduleLoopVideoSync();
  if (element.getAttribute("src") || !element.dataset.src) return element;
  if (eager && element.matches("img")) element.loading = "eager";
  fitImageIntoFrame(element);
  const galleryScroll = element.matches("img") && element.closest(".gallery-scroll");
  if (galleryScroll && window.homeGallery?.loadImage) {
    window.homeGallery.loadImage(element, element.dataset.src);
    return element;
  }
  element.setAttribute("src", element.dataset.src);
  if (element.matches("video, audio")) element.load();
  activateDeferredSourceOwner(deferredSourceOwner(element));
  return element;
};

const deferredMediaElementLoaded = (element) => {
  const owner = deferredSourceOwner(element);
  if (owner) return Boolean(element.getAttribute("src")) && owner.readyState >= 2;
  if (!element || !element.getAttribute("src")) return false;
  if (element.matches("img")) return element.complete;
  if (element.matches("video, audio")) return element.readyState >= 2;
  return true;
};

const waitForMediaEvents = (target, loadEvents, isLoaded) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      loadEvents.forEach((eventName) => {
        target.removeEventListener(eventName, finish);
      });
      resolve();
    };

    loadEvents.forEach((eventName) => {
      target.addEventListener(eventName, finish, { once: true });
    });
    if (isLoaded()) finish();
  });

const waitForDeferredMediaElement = (element) => {
  if (!element || deferredMediaElementLoaded(element)) return Promise.resolve();
  if (!element.dataset.src && !element.getAttribute("src")) return Promise.resolve();

  // A deferred `<source>` counts as loaded only once its owner has decoded a
  // frame, so it waits on `loadeddata` (readyState 2), not on metadata alone.
  const owner = deferredSourceOwner(element);
  if (owner) {
    return waitForMediaEvents(owner, ["loadeddata", "error"], () =>
      deferredMediaElementLoaded(element)
    );
  }

  const loadEvents = element.matches("video, audio")
    ? ["loadedmetadata", "error"]
    : ["load", "error"];

  return waitForMediaEvents(element, loadEvents, () => deferredMediaElementLoaded(element));
};

const loadDeferredMedia = (root, visibleOnly = false) => {
  orderedDeferredMediaElements(root, { visibleOnly }).forEach((element) => {
    loadDeferredMediaElement(element, visibleOnly);
  });
};

const preloadDeferredMedia = (root, visibleOnly = false) => {
  const preloadRequests = deferredMediaElements(root).map((element) => {
    if (shouldSkipDeferredMediaElement(element, visibleOnly)) return Promise.resolve();
    const loadRequest = waitForDeferredMediaElement(element);
    loadDeferredMediaElement(element, visibleOnly);
    return loadRequest;
  });

  return Promise.all(preloadRequests).then(() => {});
};

const preloadDeferredMediaInOrder = (
  root,
  {
    activeOnly = false,
    hiddenOnly = false,
    shouldContinue = () => true,
    visibleOnly = false,
  } = {}
) =>
  orderedDeferredMediaElements(root, { activeOnly, hiddenOnly, visibleOnly })
    .filter((element) => element.matches("img, video, audio"))
    .reduce(
      (queue, element) =>
        queue.then(() => {
          if (!shouldContinue()) return "skipped";
          const loadRequest = waitForDeferredMediaElement(element);
          loadDeferredMediaElement(element, false, { eager: hiddenOnly });
          return loadRequest;
        }),
      Promise.resolve()
    );

const mediaSourcePreloadRequests = new Map();

const canonicalMediaSource = (source) => {
  if (!source) return "";
  try {
    return new URL(source, document.baseURI).href;
  } catch (error) {
    return source;
  }
};

const backgroundMediaElement = (
  source,
  { forceImage = false, retainImagePreload = false } = {}
) => {
  if (retainImagePreload) {
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    return { element: preload, events: ["load", "error"], retain: true };
  }
  if (forceImage) return { element: new Image(), events: ["load", "error"] };
  if (isVideoSource(source)) {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    return { element: video, events: ["loadedmetadata", "error"] };
  }
  if (/\.(mp3|wav|m4a|aac|flac)(?:[?#]|$)/i.test(source)) {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    return { element: audio, events: ["loadedmetadata", "error"] };
  }
  return { element: new Image(), events: ["load", "error"] };
};

const preloadMediaSource = (source, options = {}) => {
  const key = canonicalMediaSource(source);
  if (!key) return Promise.resolve("skipped");

  const existing = mediaSourcePreloadRequests.get(key);
  if (existing) return existing.promise;

  const { element, events, retain = false } = backgroundMediaElement(source, options);
  let settle;
  const record = {
    element,
    promise: new Promise((resolve) => {
      settle = resolve;
    }),
  };
  mediaSourcePreloadRequests.set(key, record);

  let settled = false;
  const finish = (status) => {
    if (settled) return;
    settled = true;
    events.forEach((eventName) => element.removeEventListener(eventName, onEvent));
    if (!retain) record.element = null;
    if (status === "error" && mediaSourcePreloadRequests.get(key) === record) {
      mediaSourcePreloadRequests.delete(key);
      element.remove();
    }
    settle(status);
  };
  const onEvent = (event) => finish(event.type === "error" ? "error" : "loaded");

  events.forEach((eventName) => element.addEventListener(eventName, onEvent, { once: true }));
  if (element.matches("link")) {
    element.href = source;
    document.head.append(element);
  } else {
    element.src = source;
  }
  if (element.matches("video, audio")) element.load();
  if (element.matches("img") && element.complete) {
    queueMicrotask(() => finish(element.naturalWidth ? "loaded" : "error"));
  }
  return record.promise;
};

const preloadMediaSourcesInOrder = (sources, { shouldContinue = () => true } = {}) => {
  const seen = new Set();
  const orderedSources = (sources || []).filter((source) => {
    const key = canonicalMediaSource(source);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return orderedSources.reduce(
    (queue, source) =>
      queue.then(() => (shouldContinue() ? preloadMediaSource(source) : "skipped")),
    Promise.resolve()
  );
};

const preloadMediaSourcesAfter = (element, sources, options) =>
  waitForDeferredMediaElement(element).then(() => {
    if (options?.shouldContinue && !options.shouldContinue()) return "skipped";
    return preloadMediaSourcesInOrder(sources, options);
  });

window.homeMedia = {
  createLoadingIndicator,
  isVideoSource,
  setLoading,
  activateDeferredSourceOwner,
  deferredSourceOwner,
  fitImagesIntoFrames,
  loadDeferredMedia,
  loopVideoElements,
  syncLoopVideoPlayback,
  mediaSourcePreloadRequests,
  preloadDeferredMedia,
  preloadDeferredMediaInOrder,
  preloadMediaSource,
  preloadMediaSourcesAfter,
  preloadMediaSourcesInOrder,
};
})();
