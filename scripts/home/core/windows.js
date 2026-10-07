(() => {
const {
  isHomeActivationReady,
  loadDeferredMedia,
  runAfterHomeActivation,
} = window.homeActivation;
const {
  appButtons,
  appWindows,
  closeButtons,
  draggableWindows,
  startButton,
  taskbar,
} = window.homeDom;
const {
  clampNumber,
  isPageActive,
} = window.homeUtil;
const {
  setPointerHeldItemCursor,
} = window.homePointerCursor;
const {
  notifyActivity,
} = window.homeActivity;
const {
  cancelAdminResourceLoad,
  loadAdminResources,
  resourceState,
} = window.homeResources;

// Extension points. The window manager knows about windows, not about what
// lives inside them: a feature registers what should happen to its own window
// instead of the manager naming every feature. That is what lets each feature
// script load after the manager it depends on.
const windowLifecycles = new Map();

const registerWindowLifecycle = (appId, hooks) => {
  windowLifecycles.set(appId, { ...windowLifecycles.get(appId), ...hooks });
};

const windowLifecycle = (appId) => windowLifecycles.get(appId) || {};

const contentActivators = [];

const registerContentActivator = (activate) => {
  contentActivators.push(activate);
};

const viewportObservers = [];

const registerViewportObserver = (observer) => {
  viewportObservers.push(observer);
};

const activeWindowObservers = [];

const registerActiveWindowObserver = (observer) => {
  activeWindowObservers.push(observer);
};

// A placement owns the windows it positions, so the manager can ask who should
// place a window rather than testing for one kind of window by name.
const windowPlacements = [];

const registerWindowPlacement = (placement) => {
  windowPlacements.push(placement);
};

const mediaPauseGuards = [];

const registerMediaPauseGuard = (guard) => {
  mediaPauseGuards.push(guard);
};

const closeAllHooks = [];

const registerCloseAllHook = (hook) => {
  closeAllHooks.push(hook);
};

const windowPlacementFor = (win) =>
  windowPlacements.find((placement) => placement.owns(win)) || null;

const windowVisualInsets = (win) =>
  windowPlacementFor(win)?.insets?.(win) || { insetX: 0, insetY: 0 };

const shouldKeepActiveWindowMediaPlaying = (win) =>
  mediaPauseGuards.some((guard) => guard(win));

const ADMIN_CONTROLS_APP_ID = "admin-controls";

const ADMIN_CONTROLS_STAND_IN_APP_ID = "admin-controls-stand-in";

const ADMIN_CONTROLS_STORAGE_KEY = "personalSiteAdminControlsV1";

const ADMIN_CONTROLS_RESET_PENDING_KEY = "personalSiteAdminControlsResetPendingV1";

const isAdminControlsAppId = (appId) =>
  appId === ADMIN_CONTROLS_APP_ID || appId === ADMIN_CONTROLS_STAND_IN_APP_ID;

// Without a live administrator session the launcher opens the stand-in window
// instead. The session itself answers the check.
let adminControlsAccessCheck = () => false;

const hasPersistedAdminControlsBehavior = () => {
  try {
    if (sessionStorage.getItem(ADMIN_CONTROLS_RESET_PENDING_KEY) === "1") return true;
    const state = JSON.parse(localStorage.getItem(ADMIN_CONTROLS_STORAGE_KEY) || "null");
    if (!state || state.version !== 1 || Array.isArray(state)) return false;
    const hasBinding = Array.isArray(state.bindings) && state.bindings.some((binding) =>
      binding &&
      typeof binding === "object" &&
      typeof binding.target === "string" &&
      Boolean(binding.target) &&
      typeof binding.eventId === "string" &&
      Boolean(binding.eventId)
    );
    return Boolean(
      state.audio === false ||
        state.visualEffects === false ||
        state.privacy === true ||
        state.promoRandomMode === true ||
        state.safeArea === true ||
        ["vertical", "square", "landscape"].includes(state.guide) ||
        hasBinding
    );
  } catch (error) {
    return false;
  }
};

const restorePersistedAdminControlsBehavior = async () => {
  while (
    !document.hidden &&
    adminControlsAccessCheck() &&
    hasPersistedAdminControlsBehavior() &&
    !adminControlsResourcesReady()
  ) {
    try {
      await loadAdminResources();
      return;
    } catch (error) {
      if (error?.code !== "home-resource-load-cancelled") return;
    }
  }
};

let adminControlsRestoreScheduled = false;

const schedulePersistedAdminControlsRestore = () => {
  if (typeof document === "undefined") return;
  if (adminControlsRestoreScheduled) return;
  adminControlsRestoreScheduled = true;
  const restore = () => {
    adminControlsRestoreScheduled = false;
    void restorePersistedAdminControlsBehavior();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restore, { once: true });
  } else {
    queueMicrotask(restore);
  }
};

const registerAdminControlsAccess = (check) => {
  adminControlsAccessCheck = check;
  schedulePersistedAdminControlsRestore();
};

const resolveAdminControlsLaunchAppId = (appId) =>
  appId === ADMIN_CONTROLS_APP_ID && !adminControlsAccessCheck()
    ? ADMIN_CONTROLS_STAND_IN_APP_ID
    : appId;

let adminControlsLaunchGeneration = 0;

let adminControlsLaunchPending = false;

let adminControlsLaunchFocusReturn = null;

const adminControlsStandInWindow = () => getAppWindow(ADMIN_CONTROLS_STAND_IN_APP_ID);

const adminControlsStandInMessage = () =>
  document.getElementById("admin-controls-stand-in-message");

const adminControlsStandInAction = () =>
  document.getElementById("admin-controls-stand-in-ok");

const configureAdminControlsStandIn = (state = "denied") => {
  const win = adminControlsStandInWindow();
  const message = adminControlsStandInMessage();
  const action = adminControlsStandInAction();
  if (!win || !message || !action) return;
  win.dataset.adminResourceState = state;
  action.disabled = false;
  if (state === "loading") {
    message.textContent = "Loading Admin Controls…";
    action.textContent = "Cancel";
    return;
  }
  if (state === "error") {
    message.textContent = "Admin Controls could not load. Choose Retry to try again.";
    action.textContent = "Retry";
    return;
  }
  message.textContent = "nothing to see here...";
  action.textContent = "OK";
};

const setAdminControlsResourceBusy = (isBusy) => {
  adminControlsLaunchPending = isBusy;
  document.body?.classList.toggle("is-admin-resources-loading", isBusy);
};

const cancelAdminControlsLaunch = () => {
  if (!adminControlsLaunchPending) return false;
  adminControlsLaunchGeneration += 1;
  cancelAdminResourceLoad();
  setAdminControlsResourceBusy(false);
  configureAdminControlsStandIn("denied");
  return true;
};

const adminControlsResourcesReady = () =>
  ["random-event-styles", "admin-styles", "admin-orchestrator", "admin-controls"].every(
    (key) => resourceState(key) === "loaded"
  );

let topZ = 10;

/** The next stacking index, so nothing else has to share the counter. */
const nextWindowZIndex = () => topZ++;

const currentTopZIndex = () => topZ;

/** Where focus returns to when a dialog-style window closes. */
const setWindowFocusReturn = (win, element) => {
  if (win && element) comingSoonFocusReturns.set(win, element);
};

let activeWindow = null;

const getActiveWindow = () => activeWindow;

let suspendedActiveWindow = null;

const comingSoonFocusReturns = new WeakMap();

const expandedWindowState = new WeakMap();

const FOCUS_RETURN_WINDOW_SELECTOR =
  "[data-coming-soon-window], [data-launch-prompt-window], [data-focus-return-window]";

const DIALOG_INITIAL_FOCUS_SELECTOR =
  "[data-dialog-initial-focus], [data-coming-soon-ok]";

const VIDEO_EDITOR_PATH = "/video-editor/";

const MODELING_PORTFOLIO_PATH = "/modeling/";

const MODELING_LAUNCH_APP_ID = "modeling-launch";

const LAUNCH_PROMPT_POPUP_ERROR =
  "The new tab was blocked. Allow pop-ups for this site, then choose Yes again.";

/** Yes/No prompts that open a sibling route in a new tab, keyed by their app window id. */
const NEW_TAB_LAUNCH_PROMPTS = Object.freeze({
  "video-editor": Object.freeze({ path: VIDEO_EDITOR_PATH, source: "video-editor-launcher" }),
  [MODELING_LAUNCH_APP_ID]: Object.freeze({
    path: MODELING_PORTFOLIO_PATH,
    source: "modeling-launcher",
  }),
});

const lockMobileViewportZoom = () => {
  let lastTouchEndAt = 0;
  const blockGesture = (event) => event.preventDefault();
  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    document.addEventListener(eventName, blockGesture, { passive: false });
  });
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches && event.touches.length > 1) event.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener(
    "touchend",
    (event) => {
      const target =
        event.target instanceof Element ? event.target : event.target?.parentElement;
      if (target?.closest("input, textarea, select")) return;
      const now = Date.now();
      if (now - lastTouchEndAt <= 300) event.preventDefault();
      lastTouchEndAt = now;
    },
    { passive: false }
  );
};

const activateVisibleContent = (root) => {
  if (!root) return;
  if (!isHomeActivationReady()) {
    runAfterHomeActivation(() => activateVisibleContent(root));
    return;
  }
  if (!contentActivators.length) {
    loadDeferredMedia(root, true);
    return;
  }
  contentActivators.forEach((activate) => activate(root));
};

const isWindowVisible = (win) =>
  Boolean(
    win &&
      !win.classList.contains("is-hidden") &&
      !win.classList.contains("is-closing")
  );

const activeWindowKeyHandlers = new Map();

/** Registers an ordered keyboard handler for one active app window. */
const registerActiveWindowKeyHandler = (appId, handler) => {
  if (!activeWindowKeyHandlers.has(appId)) activeWindowKeyHandlers.set(appId, []);
  activeWindowKeyHandlers.get(appId).push(handler);
};

const dispatchActiveWindowKeydown = (event) => {
  if (event.defaultPrevented || !isPageActive(document)) return;
  const win = getActiveWindow();
  if (!isWindowVisible(win)) return;
  const appId = win.getAttribute("data-app-window");
  const handlers = activeWindowKeyHandlers.get(appId);
  if (!handlers) return;
  for (const handler of handlers) {
    if (handler(event, win) || event.defaultPrevented) break;
  }
};

document.addEventListener("keydown", dispatchActiveWindowKeydown);

const pauseMediaPlayback = (root) => {
  if (!root) return;
  // Event loop artwork replaced an animated GIF, so it keeps running while its
  // window is visible and stops only when the window hides.
  root.querySelectorAll("video:not([data-loop-video]), audio").forEach((media) => {
    media.pause();
  });
};

const isVisibleMediaElement = (media) =>
  Boolean(
    media &&
      !media.closest(".viewer-content.is-hidden") &&
      !media.closest('.window[data-media-closing="true"]') &&
      !media.closest(".app-window.is-hidden, .home-window.is-hidden")
  );

const playMediaElement = (media) => {
  if (!isHomeActivationReady()) {
    runAfterHomeActivation(() => playMediaElement(media));
    return;
  }
  if (!media || !isVisibleMediaElement(media)) return;
  if (!media.getAttribute("src") && media.dataset.src) {
    media.setAttribute("src", media.dataset.src);
    media.load();
  }
  const playRequest = media.play();
  if (playRequest && typeof playRequest.catch === "function") {
    playRequest.catch(() => {
      // Some browsers block autoplay unless it follows a user gesture.
    });
  }
};

const playActiveAutoplayVideos = (root) => {
  if (!root) return;
  const win = root.matches(".window") ? root : root.closest(".window");
  if (win && win.dataset.mediaClosing === "true") return;
  if (win && !isWindowVisible(win)) return;
  root.querySelectorAll("video[data-autoplay-on-active]").forEach(playMediaElement);
};

const stopMediaPlayback = (root) => {
  if (!root) return;

  root.querySelectorAll("video, audio").forEach((media) => {
    media.pause();
    if (!media.matches("[data-unload-on-hide]")) return;
    const src = media.getAttribute("src");
    if (src) media.dataset.src = src;
    media.removeAttribute("src");
    media.load();
  });

  root.querySelectorAll("iframe[data-unload-on-hide]").forEach((iframe) => {
    const src = iframe.getAttribute("src");
    if (src) iframe.dataset.src = src;
    iframe.removeAttribute("src");
  });
};

const selectWindowTab = (win, viewId) => {
  if (!win) return;
  const selectorButtons = win.querySelectorAll(".selector-item");
  const viewerPanels = win.querySelectorAll(".viewer-content");

  selectorButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-view") === viewId);
  });

  viewerPanels.forEach((panel) => {
    const isMatch = panel.getAttribute("data-view") === viewId;
    panel.classList.toggle("is-hidden", !isMatch);
    if (!isMatch) stopMediaPlayback(panel);
  });
};

const resetWindowToFirstTab = (win) => {
  if (!win) return;
  const firstButton = win.querySelector(".selector-item");
  if (firstButton) selectWindowTab(win, firstButton.getAttribute("data-view"));
};

const restartWindowAnimation = (win, animationClass) => {
  if (!win) return;
  win.classList.remove("is-opening", "is-closing");
  void win.offsetWidth;
  win.classList.add(animationClass);
};

const bringWindowToFront = (win) => {
  if (!win || win.classList.contains("is-hidden")) return;
  if (activeWindow && activeWindow !== win) pauseMediaPlayback(activeWindow);
  activeWindow = win;
  suspendedActiveWindow = null;
  win.style.zIndex = String(nextWindowZIndex());
  playActiveAutoplayVideos(win);
  activeWindowObservers.forEach((observer) => observer.onActivate?.(win));
};

const isSmallResizableWindow = (win) => {
  if (!win) return false;
  if (
    win.classList.contains("study-window") ||
    win.classList.contains("pdf-window") ||
    win.classList.contains("minesweeper-window") ||
    win.classList.contains("solitaire-window")
  ) {
    return false;
  }

  const rect = win.getBoundingClientRect();
  return rect.width <= 760 && rect.height <= 620;
};

const getTaskbarViewportClearance = () => {
  const taskbar = document.querySelector(".taskbar");
  if (!taskbar) return 0;
  const rect = taskbar.getBoundingClientRect();
  if (rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) return 0;
  return Math.max(0, window.innerHeight - rect.top);
};

const readWindowTitleBarClampGeometry = (win, windowRect = null) => {
  const titleBar = win?.querySelector(".title-bar");
  if (!win || !titleBar) return null;

  const rect = windowRect || win.getBoundingClientRect();
  const titleRect = titleBar.getBoundingClientRect();
  return {
    height: titleRect.height,
    offsetX: titleRect.left - rect.left,
    offsetY: titleRect.top - rect.top,
    width: titleRect.width,
  };
};

const clampWindowTitleBarPosition = (
  win,
  left,
  top,
  geometry = readWindowTitleBarClampGeometry(win)
) => {
  if (!geometry) return { left, top };
  const { height, offsetX: titleOffsetX, offsetY: titleOffsetY, width } = geometry;
  const viewportPadding = 0;
  const viewportRight = window.innerWidth - viewportPadding;
  const viewportBottom =
    window.innerHeight - getTaskbarViewportClearance() - viewportPadding;
  const maxLeft =
    width > viewportRight
      ? viewportPadding - titleOffsetX
      : viewportRight - width - titleOffsetX;
  const minLeft =
    width > viewportRight
      ? viewportRight - width - titleOffsetX
      : viewportPadding - titleOffsetX;
  const maxTop = Math.max(
    viewportPadding - titleOffsetY,
    viewportBottom - height - titleOffsetY
  );
  const minTop = viewportPadding - titleOffsetY;

  return {
    left: Math.round(clampNumber(left, minLeft, maxLeft)),
    top: Math.round(clampNumber(top, minTop, maxTop)),
  };
};

const setWindowTitleBarClampedPosition = (win, left, top, geometry) => {
  const position = clampWindowTitleBarPosition(win, left, top, geometry);
  const { insetX, insetY } = windowVisualInsets(win);
  win.style.left = `${position.left - insetX}px`;
  win.style.top = `${position.top - insetY}px`;
  return position;
};

const clampWindowFullyIntoViewport = (win, { padding = 12 } = {}) => {
  if (!win) return null;
  const rect = win.getBoundingClientRect();
  const availableWidth = Math.max(1, window.innerWidth - padding * 2);
  const availableHeight = Math.max(
    1,
    window.innerHeight - getTaskbarViewportClearance() - padding * 2
  );
  const maxLeft = Math.max(padding, window.innerWidth - rect.width - padding);
  const maxTop = Math.max(
    padding,
    window.innerHeight - getTaskbarViewportClearance() - rect.height - padding
  );
  const nextLeft =
    rect.width > availableWidth
      ? padding
      : Math.round(clampNumber(rect.left, padding, maxLeft));
  const nextTop =
    rect.height > availableHeight
      ? padding
      : Math.round(clampNumber(rect.top, padding, maxTop));

  win.classList.remove("app-window--center");
  win.style.translate = "0 0";
  win.style.left = `${nextLeft}px`;
  win.style.top = `${nextTop}px`;
  return { left: nextLeft, top: nextTop };
};

const isWindowDragDisabled = (win) => Boolean(win?.hasAttribute("data-no-drag"));

const syncPortfolioBodyHeight = (win, outerHeight) => {
  if (!win || !win.classList.contains("portfolio-window")) return;
  const body = win.querySelector(".window-body");
  if (!body) return;
  const titleBar = win.querySelector(".title-bar");
  const titleHeight = titleBar ? titleBar.offsetHeight : 22;
  const nextHeight = Math.max(180, Math.round(outerHeight - titleHeight - 18));
  body.style.height = `${nextHeight}px`;
  body.style.maxHeight = `${nextHeight}px`;
};

const setPortfolioExpandedState = (win, width, height) => {
  if (!win || !win.classList.contains("portfolio-window")) return;
  win.classList.toggle("is-window-expanded", width >= 780 || height >= 560);
};

const setPortfolioResponsiveState = (win, width, height) => {
  if (!win || !win.classList.contains("portfolio-window")) return;
  if (!width || !height) {
    const rect = win.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
  }
  if (!width || !height) return;

  win.classList.toggle("is-portfolio-narrow", width < 540);
  win.classList.toggle("is-portfolio-short", height < 360);
  setPortfolioExpandedState(win, width, height);
};

const isPortfolioResizeCorner = (win, event) => {
  if (!win || !event) return false;
  const rect = win.getBoundingClientRect();
  const hitSize = 24;
  return (
    event.clientX >= rect.right - hitSize &&
    event.clientX <= rect.right &&
    event.clientY >= rect.bottom - hitSize &&
    event.clientY <= rect.bottom
  );
};

const initPortfolioCornerResize = () => {
  document.querySelectorAll(".portfolio-window").forEach((win) => {
    win.classList.add("is-corner-resizable");

    win.addEventListener("pointermove", (event) => {
      if (win.classList.contains("is-manual-resizing")) return;
      const isResizeHover = isPortfolioResizeCorner(win, event);
      win.classList.toggle("is-resize-hover", isResizeHover);
      win.toggleAttribute("data-custom-cursor-guard", isResizeHover);
    });

    win.addEventListener("pointerleave", () => {
      if (!win.classList.contains("is-manual-resizing")) {
        win.classList.remove("is-resize-hover");
        win.removeAttribute("data-custom-cursor-guard");
      }
    });

    win.addEventListener("pointerdown", (event) => {
      if (!isPortfolioResizeCorner(win, event)) return;
      if (event.button !== 0 && event.pointerType !== "touch") return;
      event.preventDefault();
      event.stopPropagation();
      bringWindowToFront(win);
      expandedWindowState.delete(win);

      const rect = win.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = rect.width;
      const startHeight = rect.height;
      const minWidth = clampNumber(window.innerWidth - 24, 240, 280);
      const minHeight = clampNumber(window.innerHeight - 96, 180, 220);
      const maxWidth = Math.max(minWidth, window.innerWidth - rect.left - 12);
      const maxHeight = Math.max(minHeight, window.innerHeight - rect.top - 58);

      win.classList.remove("app-window--center");
      win.classList.add("is-manual-resizing");
      win.setAttribute("data-custom-cursor-guard", "");
      document.body.classList.add("is-resizing-window");
      win.style.translate = "0 0";
      win.setPointerCapture(event.pointerId);

      const resizeWindow = (moveEvent) => {
        const nextWidth = Math.round(
          clampNumber(startWidth + moveEvent.clientX - startX, minWidth, maxWidth)
        );
        const nextHeight = Math.round(
          clampNumber(startHeight + moveEvent.clientY - startY, minHeight, maxHeight)
        );

        win.style.width = `${nextWidth}px`;
        win.style.height = `${nextHeight}px`;
        syncPortfolioBodyHeight(win, nextHeight);
        setPortfolioResponsiveState(win, nextWidth, nextHeight);
      };

      const finishResize = (upEvent) => {
        if (win.hasPointerCapture(upEvent.pointerId)) {
          win.releasePointerCapture(upEvent.pointerId);
        }
        win.classList.remove("is-manual-resizing");
        win.classList.remove("is-resize-hover");
        win.removeAttribute("data-custom-cursor-guard");
        document.body.classList.remove("is-resizing-window");
        win.removeEventListener("pointermove", resizeWindow);
        win.removeEventListener("pointerup", finishResize);
        win.removeEventListener("pointercancel", finishResize);
      };

      win.addEventListener("pointermove", resizeWindow);
      win.addEventListener("pointerup", finishResize);
      win.addEventListener("pointercancel", finishResize);
    }, { capture: true });

    setPortfolioResponsiveState(win);
  });
};

const restoreWindowSize = (win) => {
  const saved = expandedWindowState.get(win);
  if (!saved) {
    if (win) {
      win.classList.remove("is-window-expanded");
      setPortfolioResponsiveState(win);
    }
    return;
  }
  const body = win.querySelector(".window-body");

  win.style.width = saved.width;
  win.style.height = saved.height;
  win.style.left = saved.left;
  win.style.top = saved.top;
  win.style.translate = saved.translate;
  win.classList.toggle("app-window--center", saved.centered);

  if (body) {
    body.style.height = saved.bodyHeight;
    body.style.maxHeight = saved.bodyMaxHeight;
  }

  expandedWindowState.delete(win);
  win.classList.remove("is-window-expanded");
  setPortfolioResponsiveState(win);
};

const expandSmallWindow = (win) => {
  if (!win || expandedWindowState.has(win) || !isSmallResizableWindow(win)) return;
  const rect = win.getBoundingClientRect();
  const body = win.querySelector(".window-body");
  const titleBar = win.querySelector(".title-bar");
  const maxWidth = Math.max(320, window.innerWidth - 48);
  const maxHeight = Math.max(260, window.innerHeight - 86);
  const nextWidth = Math.round(
    clampNumber(Math.max(rect.width * 2, rect.width + 240), 0, maxWidth)
  );
  const nextHeight = Math.round(
    clampNumber(Math.max(rect.height * 2, rect.height + 180), 0, maxHeight)
  );
  const maxLeft = Math.max(24, window.innerWidth - nextWidth - 24);
  const maxTop = Math.max(16, window.innerHeight - nextHeight - 70);
  const nextLeft = Math.round(clampNumber(rect.left, 24, maxLeft));
  const nextTop = Math.round(clampNumber(rect.top, 16, maxTop));

  expandedWindowState.set(win, {
    width: win.style.width,
    height: win.style.height,
    left: win.style.left,
    top: win.style.top,
    translate: win.style.translate,
    centered: win.classList.contains("app-window--center"),
    bodyHeight: body ? body.style.height : "",
    bodyMaxHeight: body ? body.style.maxHeight : "",
  });

  win.classList.remove("app-window--center");
  win.style.translate = "0 0";
  win.style.left = `${nextLeft}px`;
  win.style.top = `${nextTop}px`;
  win.style.width = `${nextWidth}px`;
  win.style.height = `${nextHeight}px`;

  if (body) {
    if (win.classList.contains("portfolio-window")) {
      syncPortfolioBodyHeight(win, nextHeight);
    } else {
      const titleHeight = titleBar ? titleBar.offsetHeight : 22;
      const nextBodyHeight = Math.max(120, nextHeight - titleHeight - 18);
      body.style.height = `${nextBodyHeight}px`;
      body.style.maxHeight = `${nextBodyHeight}px`;
    }
  }

  setPortfolioResponsiveState(win, nextWidth, nextHeight);
};

const getAppWindow = (appId) =>
  document.querySelector(`[data-app-window=\"${appId}\"]`);

const launchPromptErrorElement = (appId) =>
  getAppWindow(appId)?.querySelector("[data-launch-prompt-error]") || null;

const resetLaunchPromptError = (appId) => {
  const error = launchPromptErrorElement(appId);
  if (!error) return;
  error.textContent = "";
  error.hidden = true;
};

const showLaunchPromptError = (appId) => {
  const error = launchPromptErrorElement(appId);
  if (!error) return;
  error.textContent = LAUNCH_PROMPT_POPUP_ERROR;
  error.hidden = false;
  requestAnimationFrame(() => {
    const win = getAppWindow(appId);
    if (win) windowPlacementFor(win)?.clamp?.(win);
  });
};

const openLaunchPromptInNewTab = (appId) => {
  const prompt = NEW_TAB_LAUNCH_PROMPTS[appId];
  if (!prompt) return;
  resetLaunchPromptError(appId);
  let openedWindow = null;
  try {
    openedWindow = window.open(prompt.path, "_blank");
  } catch (error) {
    showLaunchPromptError(appId);
    return;
  }
  if (!openedWindow) {
    showLaunchPromptError(appId);
    return;
  }
  try {
    openedWindow.opener = null;
  } catch (error) {
    openedWindow.close();
    showLaunchPromptError(appId);
    return;
  }
  notifyActivity("newTabLink", { href: prompt.path, source: prompt.source });
  closeAppWindow(appId);
};

/**
 * The Modeling window always arrives with a prompt offering the standalone
 * /modeling/ route. The prompt returns focus to whatever launched Modeling.
 */
const openModelingLaunchPrompt = () => {
  const promptWindow = getAppWindow(MODELING_LAUNCH_APP_ID);
  if (!promptWindow) return;
  const focusReturn =
    document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : document.querySelector('.taskbar-icon[data-app="modeling"]');
  if (focusReturn) comingSoonFocusReturns.set(promptWindow, focusReturn);
  setWindowOpen(MODELING_LAUNCH_APP_ID, true);
  requestAnimationFrame(() => {
    promptWindow.querySelector(DIALOG_INITIAL_FOCUS_SELECTOR)?.focus({ preventScroll: true });
  });
};

const setWindowOpen = (appId, open) => {
  const win = getAppWindow(appId);
  if (!win) return;

  if (open && NEW_TAB_LAUNCH_PROMPTS[appId]) {
    resetLaunchPromptError(appId);
  }

  if (open && appId === ADMIN_CONTROLS_APP_ID) {
    const resolvedAppId = resolveAdminControlsLaunchAppId(appId);
    if (resolvedAppId !== appId) {
      configureAdminControlsStandIn("denied");
      if (!win.classList.contains("is-hidden")) {
        setWindowOpen(appId, false);
      }
      const standInWindow = getAppWindow(resolvedAppId);
      const activeFocus =
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body
          ? document.activeElement
          : document.querySelector('.taskbar-icon[data-app="admin-controls"]');
      if (standInWindow && activeFocus) {
        comingSoonFocusReturns.set(standInWindow, activeFocus);
      }
      setWindowOpen(resolvedAppId, true);
      requestAnimationFrame(() => {
        getAppWindow(resolvedAppId)
          ?.querySelector(DIALOG_INITIAL_FOCUS_SELECTOR)
          ?.focus({ preventScroll: true });
      });
      return;
    }
    const standInWindow = getAppWindow(ADMIN_CONTROLS_STAND_IN_APP_ID);
    setWindowOpen(ADMIN_CONTROLS_STAND_IN_APP_ID, false);
    if (standInWindow) comingSoonFocusReturns.delete(standInWindow);
  }

  if (open) {
    windowLifecycle(appId).beforeOpen?.(win);
    delete win.dataset.mediaClosing;
    const isVisible =
      !win.classList.contains("is-hidden") &&
      !win.classList.contains("is-closing");

    if (isVisible) {
      bringWindowToFront(win);
      windowLifecycle(appId).onAlreadyOpen?.(win);
      return;
    }

    win.classList.remove("is-hidden");
    if (win.hasAttribute("aria-hidden")) {
      win.setAttribute("aria-hidden", "false");
    }
    resetWindowToFirstTab(win);
    bringWindowToFront(win);

    if (win.hasAttribute("data-random-viewport-position")) {
      win.classList.remove("app-window--center");
      windowPlacementFor(win)?.position?.(win);
    } else if (win.classList.contains("home-window") || appId === "administrator-alert") {
      win.classList.add("app-window--center");
      win.style.left = "";
      win.style.top = "";
      win.style.translate = "";
    } else {
      const paddingX = 24;
      const paddingY = 24;
      const maxLeft = Math.max(
        paddingX,
        window.innerWidth - win.offsetWidth - paddingX
      );
      const maxTop = Math.max(
        paddingY,
        window.innerHeight - win.offsetHeight - 90
      );
      const randomLeft =
        paddingX + Math.random() * (maxLeft - paddingX);
      const randomTop = paddingY + Math.random() * (maxTop - paddingY);

      win.classList.remove("app-window--center");
      win.style.translate = "0 0";
      win.style.left = `${Math.round(randomLeft)}px`;
      win.style.top = `${Math.round(randomTop)}px`;
    }

    activateVisibleContent(win);
    setPortfolioResponsiveState(win);
    windowLifecycle(appId).onOpen?.(win);
    restartWindowAnimation(win, "is-opening");
    windowLifecycle(appId).onOpened?.(win);
    if (!isAdminControlsAppId(appId)) {
      notifyActivity("windowOpen", { appId });
    }
    if (appId === "modeling") openModelingLaunchPrompt();
    if (appId === "clash-royale") window.ClashRoyaleApp?.load(false);
    return;
  }

  if (win.classList.contains("is-hidden")) return;

  if (appId === "clash-royale") window.ClashRoyaleApp?.cancel();

  if (
    win.matches(FOCUS_RETURN_WINDOW_SELECTOR) &&
    document.activeElement instanceof HTMLElement &&
    !win.contains(document.activeElement)
  ) {
    comingSoonFocusReturns.set(win, document.activeElement);
  }
  if (win.hasAttribute("aria-hidden")) {
    win.setAttribute("aria-hidden", "true");
  }

  win.dataset.mediaClosing = "true";
  stopMediaPlayback(win);

  if (activeWindow === win) activeWindow = null;
  if (suspendedActiveWindow === win) suspendedActiveWindow = null;
  activeWindowObservers.forEach((observer) => observer.onWindowClosed?.(win));

  windowLifecycle(appId).onClose?.(win);

  restoreWindowSize(win);
  win.style.zIndex = String(nextWindowZIndex());
  restartWindowAnimation(win, "is-closing");
  stopMediaPlayback(win);
  if (!isAdminControlsAppId(appId)) {
    notifyActivity("windowClose", { appId });
  }
};

const toggleWindow = (appId) => {
  const win = getAppWindow(appId);
  if (win) {
    const shouldOpen =
      win.classList.contains("is-hidden") ||
      win.classList.contains("is-closing");
    if (appId === "administrator" && !shouldOpen) {
      closeAppWindow(appId);
      return;
    }
    setWindowOpen(appId, shouldOpen);
    // (Removed temporary Minesweeper open trigger for achievement.)
  }
};

const closeAppWindow = (appId) => {
  windowLifecycle(appId).beforeDismiss?.();
  setWindowOpen(appId, false);
  windowLifecycle(appId).afterDismiss?.();
};

const closeAllWindows = () => {
  appWindows.forEach((win) => {
    closeAppWindow(win.getAttribute("data-app-window"));
  });
  closeAllHooks.forEach((hook) => hook());
};

const focusAdminControls = () => {
  const target = document.querySelector(
    '#admin-controls-window [role="tab"][aria-selected="true"], #admin-controls-window button'
  );
  target?.focus({ preventScroll: true });
};

const openLoadedAdminControls = (focusReturn) => {
  if (!adminControlsAccessCheck()) return false;
  const standInWindow = adminControlsStandInWindow();
  if (standInWindow && !standInWindow.classList.contains("is-hidden")) {
    setWindowOpen(ADMIN_CONTROLS_STAND_IN_APP_ID, false);
    comingSoonFocusReturns.delete(standInWindow);
  }
  configureAdminControlsStandIn("denied");
  const adminWindow = getAppWindow(ADMIN_CONTROLS_APP_ID);
  if (adminWindow && focusReturn) comingSoonFocusReturns.set(adminWindow, focusReturn);
  setWindowOpen(ADMIN_CONTROLS_APP_ID, true);
  requestAnimationFrame(focusAdminControls);
  return true;
};

const showAdminControlsStandIn = (focusReturn) => {
  const win = adminControlsStandInWindow();
  if (win && focusReturn) comingSoonFocusReturns.set(win, focusReturn);
  setWindowOpen(ADMIN_CONTROLS_STAND_IN_APP_ID, true);
  requestAnimationFrame(() => adminControlsStandInAction()?.focus({ preventScroll: true }));
};

const requestAdminControlsLaunch = async (focusReturn) => {
  if (!adminControlsAccessCheck()) {
    configureAdminControlsStandIn("denied");
    showAdminControlsStandIn(focusReturn);
    return;
  }
  if (adminControlsLaunchPending) {
    if (focusReturn) adminControlsLaunchFocusReturn = focusReturn;
    showAdminControlsStandIn(adminControlsLaunchFocusReturn);
    return;
  }
  if (adminControlsResourcesReady()) {
    openLoadedAdminControls(focusReturn);
    return;
  }

  const generation = (adminControlsLaunchGeneration += 1);
  adminControlsLaunchFocusReturn = focusReturn;
  setAdminControlsResourceBusy(true);
  configureAdminControlsStandIn("loading");
  showAdminControlsStandIn(focusReturn);

  try {
    await loadAdminResources();
  } catch (error) {
    if (generation !== adminControlsLaunchGeneration) return;
    setAdminControlsResourceBusy(false);
    configureAdminControlsStandIn("error");
    showAdminControlsStandIn(adminControlsLaunchFocusReturn);
    return;
  }

  if (generation !== adminControlsLaunchGeneration) return;
  setAdminControlsResourceBusy(false);
  if (!adminControlsAccessCheck()) {
    configureAdminControlsStandIn("denied");
    showAdminControlsStandIn(adminControlsLaunchFocusReturn);
    return;
  }
  openLoadedAdminControls(adminControlsLaunchFocusReturn);
};

const handleAdminControlsLauncher = (button) => {
  const adminWindow = getAppWindow(ADMIN_CONTROLS_APP_ID);
  if (isWindowVisible(adminWindow)) {
    closeAppWindow(ADMIN_CONTROLS_APP_ID);
    return;
  }
  if (!adminControlsAccessCheck()) {
    configureAdminControlsStandIn("denied");
    const standInWindow = adminControlsStandInWindow();
    if (isWindowVisible(standInWindow)) closeAppWindow(ADMIN_CONTROLS_STAND_IN_APP_ID);
    else showAdminControlsStandIn(button);
    return;
  }
  void requestAdminControlsLaunch(button);
};

registerWindowLifecycle(ADMIN_CONTROLS_STAND_IN_APP_ID, {
  beforeDismiss: cancelAdminControlsLaunch,
});

window.addEventListener("pagehide", cancelAdminControlsLaunch);

initPortfolioCornerResize();

appWindows.forEach((win) => {
  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      stopMediaPlayback(win);
      win.classList.remove("is-closing");
      win.classList.add("is-hidden");
      if (win.matches(FOCUS_RETURN_WINDOW_SELECTOR)) {
        const focusTarget = comingSoonFocusReturns.get(win);
        comingSoonFocusReturns.delete(win);
        if (
          focusTarget?.isConnected &&
          !focusTarget.closest("[inert]") &&
          typeof focusTarget.focus === "function"
        ) {
          focusTarget.focus({ preventScroll: true });
        }
      }
    }
  });
});

document.querySelectorAll(".portfolio-window").forEach((windowEl) => {
  const selectorButtons = windowEl.querySelectorAll(".selector-item");
  const selectorPanel = windowEl.querySelector(".selector-panel");
  const divider = windowEl.querySelector(".panel-divider");

  selectorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const viewId = button.getAttribute("data-view");
      if (!viewId) return;

      selectWindowTab(windowEl, viewId);
      activateVisibleContent(windowEl);
      windowLifecycle(windowEl.getAttribute("data-app-window")).onTabChange?.(
        windowEl
      );
    });
  });

  if (divider && selectorPanel) {
    divider.addEventListener("pointerdown", (event) => {
      const body = windowEl.querySelector(".window-body");
      if (!body) return;
      if (event.button !== 0 && event.pointerType !== "touch") return;
      event.preventDefault();
      const bodyRect = body.getBoundingClientRect();
      const startX = event.clientX;
      const startWidth = selectorPanel.getBoundingClientRect().width;
      const minWidth = 200;
      const maxWidth = clampNumber(bodyRect.width - 220, minWidth, 420);

      divider.setPointerCapture(event.pointerId);

      const onMove = (moveEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = clampNumber(startWidth + delta, minWidth, maxWidth);
        selectorPanel.style.width = `${nextWidth}px`;
        selectorPanel.style.flexBasis = `${nextWidth}px`;
      };

      const onUp = (upEvent) => {
        if (divider.hasPointerCapture(upEvent.pointerId)) {
          divider.releasePointerCapture(upEvent.pointerId);
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
  }
});

appButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    const appId = button.getAttribute("data-app");
    if (windowLifecycle(appId).onLaunch?.(event)) return;
    if (appId === ADMIN_CONTROLS_APP_ID) {
      handleAdminControlsLauncher(button);
      return;
    }
    const launchAppId = resolveAdminControlsLaunchAppId(appId);
    const win = getAppWindow(launchAppId);
    const opensFocusReturnWindow = Boolean(
      win?.matches(FOCUS_RETURN_WINDOW_SELECTOR) &&
      (win.classList.contains("is-hidden") || win.classList.contains("is-closing"))
    );
    if (opensFocusReturnWindow) {
      comingSoonFocusReturns.set(win, button);
    }
    toggleWindow(launchAppId);
    if (opensFocusReturnWindow) {
      requestAnimationFrame(() => {
        win.querySelector(DIALOG_INITIAL_FOCUS_SELECTOR)?.focus({ preventScroll: true });
      });
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const focusedFocusReturnWindow =
    document.activeElement instanceof Element
      ? document.activeElement.closest(FOCUS_RETURN_WINDOW_SELECTOR)
      : null;
  const openFocusReturnWindow = [
    focusedFocusReturnWindow,
    activeWindow,
    ...document.querySelectorAll(FOCUS_RETURN_WINDOW_SELECTOR),
  ].find(
    (win) =>
      win?.matches(FOCUS_RETURN_WINDOW_SELECTOR) &&
      !win.classList.contains("is-hidden") &&
      !win.classList.contains("is-closing")
  );
  if (!openFocusReturnWindow) return;
  event.preventDefault();
  event.stopPropagation();
  closeAppWindow(openFocusReturnWindow.getAttribute("data-app-window"));
});

document.querySelectorAll("[data-launch-prompt-open]").forEach((button) => {
  button.addEventListener("click", () => {
    const appId = button.closest("[data-app-window]")?.getAttribute("data-app-window");
    if (appId) openLaunchPromptInNewTab(appId);
  });
});

if (startButton) {
  startButton.addEventListener("click", () => {
    notifyActivity("startButton");
    closeAllWindows();
  });
}


lockMobileViewportZoom();

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!activeWindow || !isWindowVisible(activeWindow)) return;
    if (activeWindow.contains(event.target)) return;
    if (!shouldKeepActiveWindowMediaPlaying(activeWindow)) {
      pauseMediaPlayback(activeWindow);
    }
    activeWindowObservers.forEach((observer) => observer.onDeactivate?.());
    activeWindow = null;
    suspendedActiveWindow = null;
  },
  { capture: true }
);

const pauseActiveWindowMedia = () => {
  if (!activeWindow) return;
  suspendedActiveWindow = activeWindow;
  pauseMediaPlayback(activeWindow);
  activeWindowObservers.forEach((observer) => observer.onDeactivate?.());
  activeWindow = null;
};

const restoreSuspendedActiveWindow = () => {
  if (
    activeWindow ||
    !suspendedActiveWindow ||
    !isPageActive(document)
  ) {
    return;
  }
  if (!isWindowVisible(suspendedActiveWindow)) {
    suspendedActiveWindow = null;
    return;
  }
  activeWindow = suspendedActiveWindow;
  suspendedActiveWindow = null;
  activeWindowObservers.forEach((observer) => observer.onActivate?.(activeWindow));
};

window.addEventListener("blur", pauseActiveWindowMedia);

window.addEventListener("focus", restoreSuspendedActiveWindow);

const readVisibleWindowTitleBarClamps = () =>
  [...draggableWindows].flatMap((win) => {
    if (
      win.hidden ||
      win.classList.contains("is-hidden") ||
      win.classList.contains("app-window--center") ||
      isWindowDragDisabled(win)
    ) {
      return [];
    }
    const rect = win.getBoundingClientRect();
    const position = clampWindowTitleBarPosition(win, rect.left, rect.top);
    const { insetX, insetY } = windowVisualInsets(win);
    return [{ win, left: position.left - insetX, top: position.top - insetY }];
  });

const clampVisibleWindowTitleBars = (clamps = readVisibleWindowTitleBarClamps()) => {
  clamps.forEach(({ win, left, top }) => {
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
  });
};

const readPortfolioWindowSizes = () =>
  [...document.querySelectorAll(".portfolio-window")].map((win) => {
    const rect = win.getBoundingClientRect();
    return { win, width: rect.width, height: rect.height };
  });

let windowResizeFrameId = 0;

const dispatchWindowResize = () => {
  viewportObservers.forEach((observer) => observer.onResize?.());
  if (windowResizeFrameId) return;
  windowResizeFrameId = requestAnimationFrame(() => {
    windowResizeFrameId = 0;

    // Collect layout measurements before any resize handler mutates the page.
    const portfolioWindowSizes = readPortfolioWindowSizes();

    portfolioWindowSizes.forEach(({ win, width, height }) => {
      setPortfolioResponsiveState(win, width, height);
    });
    viewportObservers.forEach((observer) => observer.onFrame?.());
    clampVisibleWindowTitleBars(readVisibleWindowTitleBarClamps());
  });
};

window.addEventListener("resize", dispatchWindowResize);

draggableWindows.forEach((win) => {
  win.addEventListener(
    "pointerdown",
    () => {
      bringWindowToFront(win);
    },
    { capture: true }
  );

  const titleBar = win.querySelector(".title-bar");
  if (!titleBar) return;
  if (isWindowDragDisabled(win)) return;
  const minimizeButton = win.querySelector('.title-bar-controls button[aria-label="Minimize"]');
  const maximizeButton = win.querySelector('.title-bar-controls button[aria-label="Maximize"]');

  if (maximizeButton) {
    maximizeButton.addEventListener("click", (event) => {
      event.preventDefault();
      expandSmallWindow(win);
    });
  }

  if (minimizeButton) {
    minimizeButton.addEventListener("click", (event) => {
      event.preventDefault();
      restoreWindowSize(win);
    });
  }

  titleBar.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".title-bar-controls")) return;
    // Drag from the final geometry even when the opening scale is still active.
    for (const animation of win.getAnimations()) {
      if (animation.animationName === "retro-window-open") animation.finish();
    }
    const rect = win.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const dragTitleBarGeometry = readWindowTitleBarClampGeometry(win, rect);
    let didDragWindow = false;

    if (win.classList.contains("app-window--center")) {
      win.style.left = `${rect.left}px`;
      win.style.top = `${rect.top}px`;
    }
    win.classList.remove("app-window--center");
    win.style.translate = "0 0";
    titleBar.setPointerCapture(event.pointerId);
    setPointerHeldItemCursor("window-drag", true);

    const moveHandler = (moveEvent) => {
      if (
        !didDragWindow &&
        Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 3
      ) {
        didDragWindow = true;
      }
      const nextLeft = moveEvent.clientX - offsetX;
      const nextTop = moveEvent.clientY - offsetY;
      setWindowTitleBarClampedPosition(win, nextLeft, nextTop, dragTitleBarGeometry);
    };

    const upHandler = (upEvent) => {
      if (titleBar.hasPointerCapture(upEvent.pointerId)) {
        titleBar.releasePointerCapture(upEvent.pointerId);
      }
      titleBar.removeEventListener("pointermove", moveHandler);
      titleBar.removeEventListener("pointerup", upHandler);
      titleBar.removeEventListener("pointercancel", upHandler);
      setPointerHeldItemCursor("window-drag", false);
      const placement = windowPlacementFor(win);
      if (placement?.clamp) {
        placement.clamp(win);
      } else {
        const rect = win.getBoundingClientRect();
        setWindowTitleBarClampedPosition(win, rect.left, rect.top);
      }
      if (
        didDragWindow &&
        !isAdminControlsAppId(win.getAttribute("data-app-window"))
      ) {
        notifyActivity("windowDrag", {
          appId: win.getAttribute("data-app-window") || "",
          windowId: win.id || "",
        });
      }
      windowLifecycle(win.getAttribute("data-app-window")).onDragEnd?.(win);
    };

    titleBar.addEventListener("pointermove", moveHandler);
    titleBar.addEventListener("pointerup", upHandler);
    titleBar.addEventListener("pointercancel", upHandler);
  });
});

closeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const appId = button.getAttribute("data-close");
    if (
      appId === ADMIN_CONTROLS_STAND_IN_APP_ID &&
      button === adminControlsStandInAction() &&
      adminControlsStandInWindow()?.dataset.adminResourceState === "error"
    ) {
      void requestAdminControlsLaunch(adminControlsLaunchFocusReturn);
      return;
    }
    closeAppWindow(appId);
  });
});

window.homeWindows = Object.freeze({
  bringWindowToFront,
  ADMIN_CONTROLS_APP_ID,
  ADMIN_CONTROLS_STAND_IN_APP_ID,
  DIALOG_INITIAL_FOCUS_SELECTOR,
  activateVisibleContent,
  cancelAdminControlsLaunch,
  clampWindowFullyIntoViewport,
  closeAppWindow,
  currentTopZIndex,
  getActiveWindow,
  getAppWindow,
  isAdminControlsAppId,
  isVisibleMediaElement,
  isWindowVisible,
  nextWindowZIndex,
  pauseActiveWindowMedia,
  playActiveAutoplayVideos,
  playMediaElement,
  registerActiveWindowObserver,
  registerActiveWindowKeyHandler,
  registerAdminControlsAccess,
  registerCloseAllHook,
  registerContentActivator,
  registerMediaPauseGuard,
  registerViewportObserver,
  registerWindowLifecycle,
  registerWindowPlacement,
  restartWindowAnimation,
  restoreSuspendedActiveWindow,
  setWindowFocusReturn,
  setWindowOpen,
  setWindowTitleBarClampedPosition,
});
})();
