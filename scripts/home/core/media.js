(() => {
const deferredMediaElements = (root) => {
  if (!root) return [];
  const elements = root.matches && root.matches("[data-src]") ? [root] : [];
  return [...elements, ...root.querySelectorAll("[data-src]")];
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

const loadDeferredMedia = (root, visibleOnly = false) => {
  deferredMediaElements(root).forEach((element) => {
    if (visibleOnly && element.closest(".viewer-content.is-hidden")) return;
    if (element.getAttribute("src") || !element.dataset.src) return;
    fitImageIntoFrame(element);
    element.setAttribute("src", element.dataset.src);
    if (element.matches("video, audio")) element.load();
  });
};

window.homeMedia = {
  fitImageIntoFrame,
  fitImagesIntoFrames,
  loadDeferredMedia,
};
})();
