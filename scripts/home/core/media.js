(() => {
const deferredMediaElements = (root) => {
  if (!root) return [];
  const elements = root.matches && root.matches("[data-src]") ? [root] : [];
  return root.querySelectorAll
    ? [...elements, ...root.querySelectorAll("[data-src]")]
    : elements;
};

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
  visibleOnly && element.closest(".viewer-content.is-hidden");

const loadDeferredMediaElement = (element, visibleOnly = false) => {
  if (!element || shouldSkipDeferredMediaElement(element, visibleOnly)) return null;
  if (element.getAttribute("src") || !element.dataset.src) return element;
  fitImageIntoFrame(element);
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
    ? ["loadeddata", "error"]
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
  deferredMediaElements(root).forEach((element) => {
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

window.homeMedia = {
  fitImageIntoFrame,
  fitImagesIntoFrames,
  loadDeferredMedia,
  preloadDeferredMedia,
};
})();
