(() => {
  "use strict";

  const STORAGE_KEY = "rohin-os-cursor-mode";
  const DARK_MODE_CLASS = "is-cursor-dark-mode";
  const READY_CLASS = "is-custom-cursor-ready";
  const LOADING_CLASS = "is-custom-cursor-loading";
  const LOADING_FRAME_PREFIX = "is-custom-cursor-loading-frame-";
  const LOADING_FRAME_COUNT = 9;
  const LOADING_FRAME_DELAY_MS = 100;
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
  const LEGACY_CURSOR_NAMES = Object.freeze([
    "Normal Select",
    "Select",
    "Text Select",
    "Text Select Thin",
    "Move",
    "Help Select",
    "Unavailable",
    "Precision Select",
    "Horizontal Resize",
    "Verticle Resize",
    "Diagonal Resize 1",
    "Diagonal Resize 2",
  ]);
  const MODE_ASSET_DETAILS = Object.freeze({
    light: Object.freeze({
      directory: "Jeelh-Cursor-Light",
      generatedSuffix: "light",
      legacySuffix: " Light",
      workingPrefix: "working-in-background-light-",
      workingAnimation: "Working In Background Light.ani",
      busyAnimation: "Busy Light.ani",
    }),
    dark: Object.freeze({
      directory: "Jeelh-Cursor-Dark",
      generatedSuffix: "dark",
      legacySuffix: "",
      workingPrefix: "working-in-background-",
      workingAnimation: "Working In Background.ani",
      busyAnimation: "Busy.ani",
    }),
  });

  const scriptUrl = document.currentScript?.src || document.baseURI;
  const cursorAssetRoot = new URL("../../../assets/cursor-assets/", scriptUrl);
  const modeListeners = new Set();
  const preloadedModes = new Map();
  let currentMode = null;
  let hasStarted = false;
  let loadingRuntime = null;

  const normalizeMode = (mode) => (mode === "dark" ? "dark" : "light");

  const readStoredMode = () => {
    try {
      return normalizeMode(localStorage.getItem(STORAGE_KEY));
    } catch {
      return "light";
    }
  };

  const cursorAssetPaths = (mode) => {
    const normalizedMode = normalizeMode(mode);
    const details = MODE_ASSET_DETAILS[normalizedMode];
    const generatedImages = CURSOR_IMAGE_NAMES.map(
      (name) => `generated-png/${name}-${details.generatedSuffix}.png`
    );
    const workingFrames = Array.from(
      { length: LOADING_FRAME_COUNT },
      (_, index) =>
        `${details.directory}/working-in-background-frames/${details.workingPrefix}${index + 1}.png`
    );
    const legacyCursors = LEGACY_CURSOR_NAMES.map(
      (name) => `${details.directory}/${name}${details.legacySuffix}.cur`
    );
    return [
      ...generatedImages,
      ...workingFrames,
      ...legacyCursors,
      `${details.directory}/${details.workingAnimation}`,
      `${details.directory}/${details.busyAnimation}`,
    ];
  };

  const preloadMode = (mode) => {
    const normalizedMode = normalizeMode(mode);
    if (preloadedModes.has(normalizedMode)) {
      return preloadedModes.get(normalizedMode);
    }
    if (typeof window.fetch !== "function") {
      const ready = Promise.resolve();
      preloadedModes.set(normalizedMode, ready);
      return ready;
    }

    const preload = Promise.allSettled(
      cursorAssetPaths(normalizedMode).map((path) =>
        window.fetch(new URL(path, cursorAssetRoot), { cache: "force-cache" })
      )
    ).then(() => undefined);
    preloadedModes.set(normalizedMode, preload);
    return preload;
  };

  const notifyModeListeners = () => {
    modeListeners.forEach((listener) => listener(currentMode));
  };

  const applyMode = (mode) => {
    const normalizedMode = normalizeMode(mode);
    const didChange = currentMode !== normalizedMode;
    currentMode = normalizedMode;
    const useDarkCursors = normalizedMode === "dark";
    document.documentElement.classList.toggle(DARK_MODE_CLASS, useDarkCursors);
    document.body?.classList.toggle(DARK_MODE_CLASS, useDarkCursors);
    preloadMode(normalizedMode);
    if (didChange) notifyModeListeners();
    return normalizedMode;
  };

  const markReady = () => {
    if (!document.body) return;
    document.body.classList.add(READY_CLASS);
    applyMode(currentMode || readStoredMode());
  };

  const syncStoredMode = () => applyMode(readStoredMode());

  const handleStorage = (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    applyMode(event.key === null ? readStoredMode() : event.newValue);
  };

  const start = () => {
    if (hasStarted) return currentMode;
    hasStarted = true;
    syncStoredMode();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("pageshow", syncStoredMode);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", markReady, { once: true });
    } else {
      markReady();
    }
    return currentMode;
  };

  const setMode = (mode, { persist = false } = {}) => {
    const normalizedMode = applyMode(mode);
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, normalizedMode);
      } catch {
        // The visual preference still applies when storage is unavailable.
      }
    }
    return normalizedMode;
  };

  const subscribe = (listener) => {
    modeListeners.add(listener);
    if (currentMode) listener(currentMode);
    return () => modeListeners.delete(listener);
  };

  const createLoadingRuntime = () => {
    const loadingSources = new Set();
    const bodyMutationListeners = new Set();
    const immediateTargets = new WeakSet();
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new MutationObserver((records) => {
      if (records.some((record) => immediateTargets.has(record.target))) {
        syncLoadingState();
      } else {
        scheduleLoadingSync();
      }
      bodyMutationListeners.forEach((listener) => listener(records));
    });
    let isBodyObserved = false;
    let loadingFrame = 0;
    let loadingFrameClass = "";
    let loadingFrameTimer = 0;
    let loadingSyncFrame = 0;

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

    const stopLoadingAnimation = () => {
      if (loadingFrameTimer) {
        window.clearInterval(loadingFrameTimer);
        loadingFrameTimer = 0;
      }
      loadingFrame = 0;
      clearLoadingFrame();
    };

    const startLoadingAnimation = () => {
      if (loadingFrameTimer || loadingFrameClass) return;
      showNextLoadingFrame();
      if (reducedMotionQuery.matches) return;
      loadingFrameTimer = window.setInterval(
        showNextLoadingFrame,
        LOADING_FRAME_DELAY_MS
      );
    };

    const syncLoadingState = () => {
      loadingSyncFrame = 0;
      if (!document.body) return;
      const isLoading = Array.from(loadingSources).some((source) => source());
      document.body.classList.toggle(LOADING_CLASS, isLoading);
      if (isLoading && !document.hidden) startLoadingAnimation();
      else stopLoadingAnimation();
    };

    function scheduleLoadingSync() {
      if (loadingSyncFrame) return;
      loadingSyncFrame = window.requestAnimationFrame(syncLoadingState);
    }

    const handleVisibilityChange = () => {
      if (document.hidden) stopLoadingAnimation();
      else scheduleLoadingSync();
    };
    const handleMotionChange = () => {
      stopLoadingAnimation();
      scheduleLoadingSync();
    };

    window.addEventListener("focus", scheduleLoadingSync);
    window.addEventListener("blur", scheduleLoadingSync);
    window.addEventListener("pageshow", scheduleLoadingSync);
    window.addEventListener("pagehide", stopLoadingAnimation);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", handleMotionChange);
    } else {
      reducedMotionQuery.addListener?.(handleMotionChange);
    }

    return Object.freeze({
      addSource(source) {
        loadingSources.add(source);
        scheduleLoadingSync();
      },
      observe(target, options, immediate = false) {
        if (!target) return;
        if (immediate) immediateTargets.add(target);
        observer.observe(target, options);
      },
      observeBody() {
        if (isBodyObserved || !document.body) return;
        isBodyObserved = true;
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ["aria-hidden", "class", "disabled", "hidden", "style"],
          childList: true,
          subtree: true,
        });
      },
      subscribeBodyMutations(listener) {
        bodyMutationListeners.add(listener);
        return () => bodyMutationListeners.delete(listener);
      },
      sync: scheduleLoadingSync,
    });
  };

  const observeLoading = ({ isLoading, observations = [], observeBody = false }) => {
    if (typeof isLoading !== "function") {
      throw new TypeError("A cursor loading-state predicate is required.");
    }
    loadingRuntime ||= createLoadingRuntime();
    loadingRuntime.addSource(isLoading);
    if (observeBody) loadingRuntime.observeBody();
    observations.forEach(({ target, options, immediate }) =>
      loadingRuntime.observe(target, options, immediate)
    );
    return loadingRuntime;
  };

  const subscribeBodyMutations = (listener) => {
    if (typeof listener !== "function") {
      throw new TypeError("A body-mutation listener is required.");
    }
    loadingRuntime ||= createLoadingRuntime();
    loadingRuntime.observeBody();
    return loadingRuntime.subscribeBodyMutations(listener);
  };

  window.RohinCursorRuntime = Object.freeze({
    storageKey: STORAGE_KEY,
    start,
    getMode: () => currentMode || readStoredMode(),
    setMode,
    syncStoredMode,
    preloadMode,
    subscribe,
    observeLoading,
    subscribeBodyMutations,
  });
})();
