(() => {
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
 * refused it falls back to the animated-WebP derivative in `data-loop-fallback`.
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

const loopVideoElements = (root = document) => {
  if (!root?.querySelectorAll) return [];
  const own = root.matches?.(LOOP_VIDEO_SELECTOR) ? [root] : [];
  return [...own, ...root.querySelectorAll(LOOP_VIDEO_SELECTOR)];
};

const isLoopVideoActive = (video) =>
  Boolean(
    video?.isConnected &&
      !video.hidden &&
      !document.hidden &&
      !video.closest(LOOP_VIDEO_INACTIVE_ANCESTORS)
  );

const hasResolvedMediaSource = (video) =>
  Boolean(video?.getAttribute("src") || video?.querySelector("source[src]"));

/** True once the fallback image took the video's place, so it owns no playback. */
const isLoopVideoReplaced = (video) => video?.dataset.loopFallbackActive === "true";

/** Replaces a refused `<video>` with the animated image it names, keeping the same box. */
const activateLoopVideoFallback = (video) => {
  const source = video?.dataset.loopFallback;
  if (!source || isLoopVideoReplaced(video)) return;
  video.dataset.loopFallbackActive = "true";
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

const syncLoopVideoPlayback = (video) => {
  if (!video || isLoopVideoReplaced(video)) return;
  if (!isLoopVideoActive(video)) {
    if (!video.paused) video.pause();
    return;
  }
  if (!hasResolvedMediaSource(video)) return;
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
    if (!video.paused && !isLoopVideoActive(video)) video.pause();
  });
};

/** Stops every loop video whatever its window looks like: the page itself is going. */
const pauseAllLoopVideos = () => {
  loopVideoElements().forEach((video) => {
    if (!video.paused) video.pause();
  });
};

const onLoopVideoOwnerMutation = () => {
  pauseInactiveLoopVideos();
  scheduleLoopVideoSync();
};

/**
 * A hidden document suspends animation frames, so a pause that waits for one may
 * never run and the loop would keep advancing out of sight. Pausing happens here,
 * synchronously, and drops the frame already queued so it cannot undo the pause;
 * resuming goes back through the ordinary scheduled sync.
 */
const stopLoopVideosForPageHide = () => {
  cancelLoopVideoSync();
  pauseAllLoopVideos();
};

const onLoopVideoPageVisibilityChange = () => {
  if (document.hidden) {
    stopLoopVideosForPageHide();
    return;
  }
  scheduleLoopVideoSync();
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
 * that has never opened. Readiness events re-drive the sync, so a source that
 * arrives late still starts. Returns true only for the call that registered it.
 */
const prepareLoopVideo = (video) => {
  if (!video?.matches?.(LOOP_VIDEO_SELECTOR) || preparedLoopVideos.has(video)) return false;
  preparedLoopVideos.add(video);
  video.autoplay = false;
  ["loadeddata", "canplay", "playing"].forEach((eventName) => {
    video.addEventListener(eventName, scheduleLoopVideoSync);
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
  window.addEventListener("pagehide", stopLoopVideosForPageHide);
  window.addEventListener("pageshow", scheduleLoopVideoSync);
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
  if (element.getAttribute("src") || !element.dataset.src) return element;
  prepareLoopVideo(element);
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
  if (/\.(mp4|webm|ogg)(?:[?#]|$)/i.test(source)) {
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
