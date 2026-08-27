(() => {
  "use strict";

  const CURSOR_MODE_STORAGE_KEY = "rohin-os-cursor-mode";
  const DARK_MODE_CLASS = "is-cursor-dark-mode";
  const LOADING_CLASS = "is-custom-cursor-loading";
  const LOADING_FRAME_PREFIX = "is-custom-cursor-loading-frame-";
  const LOADING_FRAME_COUNT = 9;
  const LOADING_FRAME_DELAY_MS = 100;
  const RESIZE_EW_CLASS = "is-video-editor-resizing-ew";
  const RESIZE_NS_CLASS = "is-video-editor-resizing-ns";
  const CURSOR_IMAGE_NAMES = Object.freeze([
    "normal",
    "select",
    "text",
    "text-thin",
    "move",
    "help",
    "unavailable",
    "precision",
    "resize-ew",
    "resize-ns",
    "resize-nwse",
    "resize-nesw",
  ]);
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const preloadedCursorModes = new Set();

  let loadingFrame = 0;
  let loadingFrameClass = "";
  let loadingFrameTimer = 0;

  const storedCursorMode = () => {
    try {
      return localStorage.getItem(CURSOR_MODE_STORAGE_KEY) === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  };

  const applyCursorMode = (mode) => {
    const useDarkCursors = mode === "dark";
    document.documentElement.classList.toggle(DARK_MODE_CLASS, useDarkCursors);
    document.body?.classList.toggle(DARK_MODE_CLASS, useDarkCursors);
    preloadCursorAssets(useDarkCursors ? "dark" : "light");
  };

  const preloadCursorAssets = (mode) => {
    if (!window.fetch || preloadedCursorModes.has(mode)) return;
    preloadedCursorModes.add(mode);
    const generatedImages = CURSOR_IMAGE_NAMES.map(
      (name) => `../assets/cursor-assets/generated-png/${name}-${mode}.png`
    );
    const workingDirectory =
      mode === "dark" ? "Jeelh-Cursor-Dark" : "Jeelh-Cursor-Light";
    const workingPrefix =
      mode === "dark" ? "working-in-background-" : "working-in-background-light-";
    const workingImages = Array.from(
      { length: LOADING_FRAME_COUNT },
      (_, index) =>
        `../assets/cursor-assets/${workingDirectory}/working-in-background-frames/${workingPrefix}${index + 1}.png`
    );
    Promise.allSettled(
      [...generatedImages, ...workingImages].map((source) =>
        fetch(new URL(source, document.baseURI), { cache: "force-cache" })
      )
    );
  };

  const clearLoadingFrame = () => {
    if (!loadingFrameClass || !document.body) return;
    document.body.classList.remove(loadingFrameClass);
    loadingFrameClass = "";
  };

  const showNextLoadingFrame = () => {
    if (!document.body) return;
    loadingFrame = (loadingFrame % LOADING_FRAME_COUNT) + 1;
    const nextClass = `${LOADING_FRAME_PREFIX}${loadingFrame}`;
    if (nextClass === loadingFrameClass) return;
    clearLoadingFrame();
    document.body.classList.add(nextClass);
    loadingFrameClass = nextClass;
  };

  const startLoadingAnimation = () => {
    if (loadingFrameTimer) return;
    showNextLoadingFrame();
    if (reducedMotionQuery.matches) return;
    loadingFrameTimer = window.setInterval(
      showNextLoadingFrame,
      LOADING_FRAME_DELAY_MS
    );
  };

  const stopLoadingAnimation = () => {
    if (loadingFrameTimer) {
      window.clearInterval(loadingFrameTimer);
      loadingFrameTimer = 0;
    }
    loadingFrame = 0;
    clearLoadingFrame();
  };

  const videoEditorIsBusy = () =>
    document.querySelector("#video-editor-auth-form")?.getAttribute("aria-busy") ===
      "true" ||
    document.querySelector("#video-editor-app")?.getAttribute("aria-busy") ===
      "true" ||
    document
      .querySelector("[data-audio-sync-status]")
      ?.getAttribute("data-state") === "analyzing";

  const syncLoadingCursor = () => {
    if (!document.body) return;
    const isBusy = videoEditorIsBusy();
    document.body.classList.toggle(LOADING_CLASS, isBusy);
    if (isBusy) startLoadingAnimation();
    else stopLoadingAnimation();
  };

  const clearPointerOperationCursor = () => {
    document.body?.classList.remove(
      "is-holding-pointer-item",
      RESIZE_EW_CLASS,
      RESIZE_NS_CLASS
    );
  };

  const handlePointerOperationStart = (event) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    document.body.classList.remove(RESIZE_EW_CLASS, RESIZE_NS_CLASS);
    const target = event.target;
    const previewTimelineSeparator = target.closest(
      "#video-editor-preview-timeline-separator"
    );
    if (previewTimelineSeparator) {
      const isSideBySide = Boolean(
        previewTimelineSeparator.closest(
          '[data-video-editor-workspace-layout="side-by-side"]'
        )
      );
      document.body.classList.add(
        isSideBySide ? RESIZE_EW_CLASS : RESIZE_NS_CLASS
      );
      return;
    }
    if (
      target.closest(
        "[data-video-editor-side-separator], [data-trim], [data-resize-effect]"
      )
    ) {
      document.body.classList.add(RESIZE_EW_CLASS);
    }
  };

  const initializeCursorBehavior = () => {
    applyCursorMode(storedCursorMode());
    document.body.classList.add("is-custom-cursor-ready");

    const busyTargets = [
      document.querySelector("#video-editor-auth-form"),
      document.querySelector("#video-editor-app"),
      document.querySelector("[data-audio-sync-status]"),
    ].filter(Boolean);
    if (busyTargets.length) {
      const observer = new MutationObserver(syncLoadingCursor);
      busyTargets.forEach((target) =>
        observer.observe(target, {
          attributes: true,
          attributeFilter: ["aria-busy", "data-state"],
        })
      );
    }
    const authenticationObserver = new MutationObserver(() => {
      if (document.body.dataset.videoEditorAuthState !== "authenticated") {
        clearPointerOperationCursor();
      }
    });
    authenticationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-video-editor-auth-state"],
    });
    document.addEventListener("pointerdown", handlePointerOperationStart, true);
    document.addEventListener("pointerup", clearPointerOperationCursor, true);
    document.addEventListener("pointercancel", clearPointerOperationCursor, true);
    document.addEventListener("lostpointercapture", clearPointerOperationCursor, true);
    document.addEventListener("dragstart", (event) => {
      if (event.defaultPrevented) return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[draggable="true"]')) {
        document.body.classList.add("is-holding-pointer-item");
      }
    });
    document.addEventListener("dragend", clearPointerOperationCursor);
    document.addEventListener("drop", clearPointerOperationCursor);
    window.addEventListener("blur", clearPointerOperationCursor);
    window.addEventListener("pagehide", () => {
      clearPointerOperationCursor();
      stopLoadingAnimation();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearPointerOperationCursor();
        stopLoadingAnimation();
      } else {
        syncLoadingCursor();
      }
    });
    reducedMotionQuery.addEventListener?.("change", () => {
      stopLoadingAnimation();
      syncLoadingCursor();
    });
    syncLoadingCursor();
  };

  applyCursorMode(storedCursorMode());

  window.addEventListener("storage", (event) => {
    if (event.key !== CURSOR_MODE_STORAGE_KEY && event.key !== null) return;
    applyCursorMode(
      event.key === null
        ? storedCursorMode()
        : event.newValue === "dark"
          ? "dark"
          : "light"
    );
  });
  window.addEventListener("pageshow", () => {
    clearPointerOperationCursor();
    applyCursorMode(storedCursorMode());
    syncLoadingCursor();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCursorBehavior, {
      once: true,
    });
  } else {
    initializeCursorBehavior();
  }
})();
