(() => {
  "use strict";

  const RESIZE_EW_CLASS = "is-video-editor-resizing-ew";
  const RESIZE_NS_CLASS = "is-video-editor-resizing-ns";
  const cursorRuntime = window.RohinCursorRuntime;
  if (!cursorRuntime) throw new Error("The shared cursor runtime did not load.");
  cursorRuntime.start();

  const videoEditorIsBusy = () =>
    document.querySelector("#video-editor-auth-form")?.getAttribute("aria-busy") ===
      "true" ||
    document.querySelector("#video-editor-app")?.getAttribute("aria-busy") ===
      "true" ||
    document
      .querySelector("[data-audio-sync-status]")
      ?.getAttribute("data-state") === "analyzing";

  let loadingController = null;

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
    const busyTargets = [
      document.querySelector("#video-editor-auth-form"),
      document.querySelector("#video-editor-app"),
      document.querySelector("[data-audio-sync-status]"),
    ].filter(Boolean);
    loadingController = cursorRuntime.observeLoading({
      isLoading: videoEditorIsBusy,
      observations: busyTargets.map((target) => ({
        target,
        immediate: true,
        options: {
          attributes: true,
          attributeFilter: ["aria-busy", "data-state"],
        },
      })),
    });
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
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearPointerOperationCursor();
      }
    });
  };
  window.addEventListener("pageshow", () => {
    clearPointerOperationCursor();
    loadingController?.sync();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeCursorBehavior, {
      once: true,
    });
  } else {
    initializeCursorBehavior();
  }
})();
