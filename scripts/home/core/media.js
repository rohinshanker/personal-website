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

const loadDeferredMediaElement = (element, visibleOnly = false, { eager = false } = {}) => {
  if (!element) return null;
  suspendHiddenCarouselMediaPlayback(element);
  if (shouldSkipDeferredMediaElement(element, visibleOnly)) return null;
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
  return element;
};

const deferredMediaElementLoaded = (element) => {
  if (!element || !element.getAttribute("src")) return false;
  if (element.matches("img")) return element.complete;
  if (element.matches("video, audio")) return element.readyState >= 2;
  return true;
};

const waitForDeferredMediaElement = (element) => {
  if (!element || deferredMediaElementLoaded(element)) return Promise.resolve();
  if (!element.dataset.src && !element.getAttribute("src")) return Promise.resolve();

  const loadEvents = element.matches("video, audio")
    ? ["loadedmetadata", "error"]
    : ["load", "error"];

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      loadEvents.forEach((eventName) => {
        element.removeEventListener(eventName, finish);
      });
      resolve();
    };

    loadEvents.forEach((eventName) => {
      element.addEventListener(eventName, finish, { once: true });
    });
    if (deferredMediaElementLoaded(element)) finish();
  });
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

const backgroundMediaElement = (source) => {
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

const preloadMediaSource = (source) => {
  const key = canonicalMediaSource(source);
  if (!key) return Promise.resolve("skipped");

  const existing = mediaSourcePreloadRequests.get(key);
  if (existing) return existing.promise;

  const { element, events } = backgroundMediaElement(source);
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
    record.element = null;
    if (status === "error" && mediaSourcePreloadRequests.get(key) === record) {
      mediaSourcePreloadRequests.delete(key);
    }
    settle(status);
  };
  const onEvent = (event) => finish(event.type === "error" ? "error" : "loaded");

  events.forEach((eventName) => element.addEventListener(eventName, onEvent, { once: true }));
  element.src = source;
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
  fitImageIntoFrame,
  fitImagesIntoFrames,
  loadDeferredMedia,
  preloadDeferredMedia,
  preloadDeferredMediaInOrder,
  preloadMediaSourcesAfter,
  preloadMediaSourcesInOrder,
};
})();
