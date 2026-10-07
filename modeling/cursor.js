(() => {
  "use strict";

  const cursorRuntime = window.RohinCursorRuntime;
  if (!cursorRuntime) throw new Error("The shared cursor runtime did not load.");
  cursorRuntime.start();

  /**
   * The fullscreen viewer is the route's only blocking wait: a full-quality
   * photo or clip the visitor asked for and is looking at. Lazy carousel
   * slides keep their own hourglass instead, so ordinary scrolling never turns
   * the pointer over.
   */
  const observeViewerLoading = () => {
    const stage = document.querySelector("[data-lightbox-stage]");
    if (!stage) return;
    cursorRuntime.observeLoading({
      isLoading: () => stage.getAttribute("aria-busy") === "true",
      observations: [
        {
          target: stage,
          immediate: true,
          options: { attributes: true, attributeFilter: ["aria-busy"] },
        },
      ],
    });
  };

  // The route script is deferred, so the viewer exists by DOMContentLoaded.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeViewerLoading, { once: true });
  } else {
    observeViewerLoading();
  }
})();
