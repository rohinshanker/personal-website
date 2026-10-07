(() => {
const {
  byId,
  startButton,
} = window.homeDom;
const {
  chooseWeightedRandomEvent,
  clampNumber,
  debounceTimer,
} = window.homeUtil;
const {
  isAdminControlsAppId,
  isWindowVisible,
  nextWindowZIndex,
  registerActiveWindowObserver,
  registerWindowPlacement,
  restartWindowAnimation,
  wasAdminControlsResetReload,
} = window.homeWindows;
const {
  isHomeActivationReady,
  loadDeferredMedia,
  preloadDeferredMedia,
  runAfterHomeActivation,
  unloadDeferredImages,
} = window.homeActivation;
const {
  NEKO_RANDOM_EVENT_PROBABILITY_BONUS,
  isNekoRandomEventBoostActive,
} = window.homeNeko;
const {
  mediaSourcePreloadRequests,
  preloadMediaSource,
} = window.homeMedia;
const {
  MINESWEEPER_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL,
} = window.homeMinesweeper;
const {
  SOLITAIRE_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL,
} = window.homeSolitaire;
const {
  observeActivity,
} = window.homeActivity;
const {
  loadRandomEventStyles,
  resourceState,
} = window.homeResources;

const randomEventWindow = byId("random-event-window");
const randomEventTitle = byId("random-event-title");
const randomEventImage = byId("random-event-image");
const randomEventClose = byId("random-event-close");
const randomEventOk = byId("random-event-ok");

let activeRandomEventKey = "";

let generalRandomEventClickCount = 0;

let randomEventIdleTimer = null;

let activeAppDwellWindow = null;

let activeAppDwellStartedAt = 0;

let activeAppDwellTimer = null;

const RANDOM_EVENT_GLOBAL_DEBUG = false;

// For local testing, enable this together with individual event debug flags.
// Keep false in committed code.
const RANDOM_EVENT_DEVELOPER_MODE = false;

const SYSTEM_ALERTS = window.rohinSystemAlerts.definitions;

const RANDOM_EVENT_RELOAD_KEY = "personalSiteRandomEventReloadPending";

const RANDOM_EVENT_VIEWPORT_PADDING = 12;

const RANDOM_EVENT_TASKBAR_CLEARANCE = 64;


const RANDOM_EVENT_PLACEMENT_ATTEMPTS = 42;

const RANDOM_EVENT_OBSTACLE_GAP = 10;

const GENERAL_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL = 14;

const RANDOM_EVENT_IDLE_DELAY_MS = 4 * 60 * 1000;

const RANDOM_EVENT_APP_DWELL_MS = 2 * 60 * 1000;

const RANDOM_EVENT_DELAY_MIN_MS = 0;

const RANDOM_EVENT_DELAY_MAX_MS = 2000;

const RANDOM_EVENT_DELAY_STEP_MS = 100;

const RANDOM_EVENT_KIND_INTERACTIVE = "interactive";

const RANDOM_EVENT_KIND_NON_INTERACTIVE = "noninteractive";

const RANDOM_EVENT_KIND_LIMITS = Object.freeze({
  [RANDOM_EVENT_KIND_INTERACTIVE]: 1,
  [RANDOM_EVENT_KIND_NON_INTERACTIVE]: 2,
});

const RANDOM_EVENT_MAX_LOCK_RELEASE_MS = 30 * 1000;

const randomEventDefinitions = [];

const randomEventBindings = [];

const randomEventPendingDefinitions = new Set();

const randomEventKindMaxSince = {
  [RANDOM_EVENT_KIND_INTERACTIVE]: 0,
  [RANDOM_EVENT_KIND_NON_INTERACTIVE]: 0,
};

// Windows the runtime positions, clamps and keeps inside the viewport. Each
// event script contributes its own, so this never has to name every event.
const randomEventWindowSources = [];

const registerRandomEventWindows = (source) => {
  randomEventWindowSources.push(source);
};

const randomEventViewportWindows = () =>
  [
    randomEventWindow,
    ...randomEventWindowSources.flatMap((source) => source()),
    ...document.querySelectorAll("[data-random-viewport-position]"),
  ].filter(Boolean);


const randomEventVisualScales = new WeakMap();

const registerRandomEventVisualScale = (win, getScale) => {
  if (win) randomEventVisualScales.set(win, getScale);
};

const getRandomEventVisualInsets = (win) => {
  const getScale = randomEventVisualScales.get(win);
  if (!getScale) {
    return { scale: 1, insetX: 0, insetY: 0 };
  }
  const scale = getScale();
  return {
    scale,
    insetX: (win.offsetWidth * (1 - scale)) / 2,
    insetY: (win.offsetHeight * (1 - scale)) / 2,
  };
};


const getRandomEventWindowBounds = (win) => {
  const rect = win.getBoundingClientRect();
  const { scale } = getRandomEventVisualInsets(win);
  const width =
    randomEventVisualScales.has(win)
      ? win.offsetWidth * scale
      : Math.max(win.offsetWidth, rect.width);
  const height =
    randomEventVisualScales.has(win)
      ? win.offsetHeight * scale
      : Math.max(win.offsetHeight, rect.height);
  const padding = RANDOM_EVENT_VIEWPORT_PADDING;
  return {
    width,
    height,
    padding,
    maxLeft: Math.max(padding, window.innerWidth - width - padding),
    maxTop: Math.max(
      padding,
      window.innerHeight - height - RANDOM_EVENT_TASKBAR_CLEARANCE
    ),
  };
};

const randomEventCandidateRect = (bounds, left, top) => ({
  left,
  top,
  right: left + bounds.width,
  bottom: top + bounds.height,
});

const randomEventPlacementObstacles = (win) =>
  Array.from(document.querySelectorAll(".window"))
    .filter((candidate) => {
      if (candidate === win) return false;
      if (candidate.closest(".window-explode-piece, .biden-explode-piece")) return false;
      if (candidate.hidden || candidate.classList.contains("is-hidden")) return false;
      if (candidate.getAttribute("aria-hidden") === "true") return false;
      return true;
    })
    .map((candidate) => candidate.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);

const randomEventOverlapArea = (a, b, gap = 0) => {
  const overlapWidth = Math.max(
    0,
    Math.min(a.right, b.right + gap) - Math.max(a.left, b.left - gap)
  );
  const overlapHeight = Math.max(
    0,
    Math.min(a.bottom, b.bottom + gap) - Math.max(a.top, b.top - gap)
  );
  return overlapWidth * overlapHeight;
};

const scoreRandomEventPlacement = (candidate, obstacles) =>
  obstacles.reduce(
    (score, obstacle) =>
      score + randomEventOverlapArea(candidate, obstacle, RANDOM_EVENT_OBSTACLE_GAP),
    0
  );

const sampleRandomEventPosition = ({ padding, maxLeft, maxTop }) => ({
  left: padding + Math.random() * Math.max(0, maxLeft - padding),
  top: padding + Math.random() * Math.max(0, maxTop - padding),
});

const clampRandomEventPosition = ({ padding, maxLeft, maxTop }, { left, top }) => ({
  left: clampNumber(left, padding, maxLeft),
  top: clampNumber(top, padding, maxTop),
});

const findRandomEventOpenPosition = (win, preferredPositions = []) => {
  const bounds = getRandomEventWindowBounds(win);
  const obstacles = randomEventPlacementObstacles(win);
  const defaultPosition = sampleRandomEventPosition(bounds);

  if (!obstacles.length) {
    return clampRandomEventPosition(bounds, preferredPositions[0] || defaultPosition);
  }

  let bestPosition = null;
  let bestScore = Infinity;
  const cornerPositions = [
    { left: bounds.padding, top: bounds.padding },
    { left: bounds.maxLeft, top: bounds.padding },
    { left: bounds.padding, top: bounds.maxTop },
    { left: bounds.maxLeft, top: bounds.maxTop },
    {
      left: (bounds.padding + bounds.maxLeft) / 2,
      top: (bounds.padding + bounds.maxTop) / 2,
    },
  ];

  const considerPosition = (position) => {
    const clamped = clampRandomEventPosition(bounds, position);
    const rect = randomEventCandidateRect(bounds, clamped.left, clamped.top);
    const score = scoreRandomEventPlacement(rect, obstacles);

    if (score < bestScore) {
      bestScore = score;
      bestPosition = clamped;
    }

    return score === 0;
  };

  const seededPositions = [...preferredPositions];
  for (const position of seededPositions) {
    if (considerPosition(position)) return bestPosition;
  }

  for (let attempt = 0; attempt < RANDOM_EVENT_PLACEMENT_ATTEMPTS; attempt += 1) {
    if (considerPosition(sampleRandomEventPosition(bounds))) return bestPosition;
  }

  for (const position of cornerPositions) {
    if (considerPosition(position)) return bestPosition;
  }

  return bestPosition || defaultPosition;
};

const setRandomEventWindowPosition = (win, left, top, { onPosition } = {}) => {
  if (!win) return;
  const { padding, maxLeft, maxTop } = getRandomEventWindowBounds(win);
  const nextLeft = Math.round(clampNumber(left, padding, maxLeft));
  const nextTop = Math.round(clampNumber(top, padding, maxTop));
  const { insetX, insetY } = getRandomEventVisualInsets(win);
  win.style.translate = "0 0";
  win.style.left = `${nextLeft - insetX}px`;
  win.style.top = `${nextTop - insetY}px`;
  if (onPosition) onPosition(nextLeft, nextTop);
};

const positionRandomEventWindowInViewport = (win, options) => {
  if (!win) return;
  const { left, top } = findRandomEventOpenPosition(win);
  setRandomEventWindowPosition(win, left, top, options);
};

const clampRandomEventWindowToViewport = (win, options) => {
  if (!win || win.classList.contains("is-hidden")) return;
  const rect = win.getBoundingClientRect();
  const styleLeft = Number.parseFloat(win.style.left);
  const styleTop = Number.parseFloat(win.style.top);
  const { insetX, insetY } = getRandomEventVisualInsets(win);
  const currentLeft = Number.isFinite(styleLeft) ? styleLeft + insetX : rect.left;
  const currentTop = Number.isFinite(styleTop) ? styleTop + insetY : rect.top;
  setRandomEventWindowPosition(win, currentLeft, currentTop, options);
};

const clampRandomEventWindowAfterMediaLoad = (win, options) => {
  if (!win) return;
  requestAnimationFrame(() => clampRandomEventWindowToViewport(win, options));
  [80, 240, 360].forEach((delay) => {
    setTimeout(() => clampRandomEventWindowToViewport(win, options), delay);
  });
  win.querySelectorAll("img").forEach((image) => {
    if (image.complete && image.naturalWidth > 0) {
      clampRandomEventWindowToViewport(win, options);
      return;
    }
    image.addEventListener(
      "load",
      () => clampRandomEventWindowToViewport(win, options),
      { once: true }
    );
  });
};

const clampVisibleRandomEventWindows = () => {
  randomEventViewportWindows().forEach((win) => clampRandomEventWindowToViewport(win));
};

const randomEventWatchedImages = new WeakSet();

const watchRandomEventViewportMedia = () => {
  randomEventViewportWindows().forEach((win) => {
    win.querySelectorAll("img").forEach((image) => {
      if (randomEventWatchedImages.has(image)) return;
      randomEventWatchedImages.add(image);
      image.addEventListener("load", () => clampRandomEventWindowToViewport(win));
    });
  });
};

const isManagedRandomEventWindowVisible = (win) =>
  Boolean(
    win &&
      !win.classList.contains("is-hidden") &&
      win.getAttribute("aria-hidden") === "false"
  );

const randomEventStyleOpenRequests = new Map();

const openManagedRandomEventWindow = (
  win,
  {
    isVisible,
    onFront,
    beforeShow,
    position,
    afterShow,
    clearClasses,
    animate = true,
    clampAfterMediaLoad = false,
  } = {}
) => {
  if (isVisible ? isVisible() : isManagedRandomEventWindowVisible(win)) {
    win.style.zIndex = String(nextWindowZIndex());
    if (onFront) onFront();
    return false;
  }

  if (beforeShow) beforeShow();
  loadDeferredMedia(win);
  win.classList.remove("is-hidden", "is-closing", ...(clearClasses || []));
  win.setAttribute("aria-hidden", "false");
  if (position) position(win);
  else positionRandomEventWindowInViewport(win);
  win.style.zIndex = String(nextWindowZIndex());
  if (animate) restartWindowAnimation(win, "is-opening");
  if (clampAfterMediaLoad) clampRandomEventWindowAfterMediaLoad(win);
  if (afterShow) afterShow();
  return true;
};

// Opens a random-event window through the one shared lifecycle. `isVisible`
// replaces the default visibility test, `onFront` runs instead of opening when
// the window is already visible, `beforeShow` prepares state once an open is
// committed, `position` replaces viewport placement, and `afterShow` runs after
// the opening animation starts. A cold call is accepted synchronously but does
// not perform state, geometry, media, or animation work until styles are ready.
const showManagedRandomEventWindow = (
  win,
  options = {}
) => {
  if (!win) return false;
  const isVisible = options.isVisible
    ? options.isVisible()
    : isManagedRandomEventWindowVisible(win);
  if (isVisible) {
    win.style.zIndex = String(nextWindowZIndex());
    options.onFront?.();
    return false;
  }

  if (randomEventStyleOpenRequests.has(win)) return false;
  if (resourceState("random-event-styles") === "loaded") {
    return openManagedRandomEventWindow(win, options);
  }

  const request = { cancelled: false };
  randomEventStyleOpenRequests.set(win, request);
  loadRandomEventStyles()
    .then(() => {
      if (
        request.cancelled ||
        randomEventStyleOpenRequests.get(win) !== request ||
        !win.isConnected ||
        document.hidden
      ) {
        return;
      }
      randomEventStyleOpenRequests.delete(win);
      openManagedRandomEventWindow(win, options);
    })
    .catch((error) => {
      if (randomEventStyleOpenRequests.get(win) === request) {
        randomEventStyleOpenRequests.delete(win);
      }
      if (!request.cancelled) {
        console.warn("[Rohin OS] Random event styles could not load", error);
      }
    });
  return true;
};

// Starts the shared closing animation. `force` skips the `is-hidden` guard for
// windows that track their own closing state, and `beforeClose` runs the event's
// teardown only once a close is committed. Returns true when a close started.
const closeManagedRandomEventWindow = (
  win,
  { force = false, beforeClose } = {}
) => {
  if (!win) return false;
  const pendingStyleOpen = randomEventStyleOpenRequests.get(win);
  if (pendingStyleOpen) {
    pendingStyleOpen.cancelled = true;
    randomEventStyleOpenRequests.delete(win);
    return true;
  }
  if (!force && win.classList.contains("is-hidden")) return false;
  if (beforeClose) beforeClose();
  win.setAttribute("aria-hidden", "true");
  restartWindowAnimation(win, "is-closing");
  return true;
};

// Wires the shared open/close animation bookkeeping: swallow clicks so the
// desktop does not see them, drop `is-opening` when the open animation ends, and
// hide, unload and reset the window when the close animation ends.
// `closingClasses` are cleared alongside `is-closing`.
const bindManagedRandomEventWindowAnimation = (
  win,
  { afterOpen, afterClose, onClose, closingClasses, unloadImages = true } = {}
) => {
  if (!win) return;

  win.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      if (afterOpen) afterOpen();
      return;
    }
    if (event.animationName !== "retro-window-close") return;
    if (onClose) {
      onClose();
      return;
    }
    win.classList.remove("is-closing", ...(closingClasses || []));
    win.classList.add("is-hidden");
    if (unloadImages) unloadDeferredImages(win);
    if (afterClose) afterClose();
  });
};

const bindRandomEventButton = (button, action) => {
  if (!button) return;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    action(event);
  });
};

const getRandomEventWindowPosition = (win) => {
  if (!win) return null;
  const rect = win.getBoundingClientRect();
  const styleLeft = Number.parseFloat(win.style.left);
  const styleTop = Number.parseFloat(win.style.top);
  return {
    left: Number.isFinite(styleLeft) ? styleLeft : rect.left,
    top: Number.isFinite(styleTop) ? styleTop : rect.top,
  };
};

const removeWindowExplodePieces = () => {
  document.querySelectorAll(".window-explode-piece").forEach((piece) => {
    piece.remove();
  });
};

const animateWindowExplode = (win, onComplete) => {
  if (!win) {
    if (onComplete) onComplete();
    return;
  }

  removeWindowExplodePieces();
  const rect = win.getBoundingClientRect();
  const columns = 4;
  const rows = 4;
  const pieceWidth = rect.width / columns;
  const pieceHeight = rect.height / rows;
  const pieces = [];

  win.classList.add("is-exploding");

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const piece = document.createElement("div");
      piece.className = "window-explode-piece";
      piece.style.left = `${rect.left + column * pieceWidth}px`;
      piece.style.top = `${rect.top + row * pieceHeight}px`;
      piece.style.width = `${Math.ceil(pieceWidth)}px`;
      piece.style.height = `${Math.ceil(pieceHeight)}px`;

      const clone = win.cloneNode(true);
      clone.classList.remove("is-opening", "is-closing", "is-hidden", "is-exploding");
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach((element) => {
        element.removeAttribute("id");
      });
      clone.setAttribute("aria-hidden", "true");
      clone.style.left = `${-column * pieceWidth}px`;
      clone.style.top = `${-row * pieceHeight}px`;
      clone.style.width = `${rect.width}px`;
      clone.style.translate = "0 0";
      clone.style.position = "absolute";
      clone.style.pointerEvents = "none";
      clone.style.zIndex = "0";
      piece.appendChild(clone);

      document.body.appendChild(piece);
      pieces.push({ piece, row, column });
    }
  }

  const centerRow = (rows - 1) / 2;
  const centerColumn = (columns - 1) / 2;
  let remaining = pieces.length;

  pieces.forEach(({ piece, row, column }) => {
    const deltaX = (column - centerColumn) * pieceWidth * 2.25;
    const deltaY = (row - centerRow) * pieceHeight * 2.25;
    const animation = piece.animate(
      [
        { opacity: 1, transform: "translate(0, 0) scale(1)" },
        {
          opacity: 0,
          transform: `translate(${deltaX}px, ${deltaY}px) scale(0.08)`,
        },
      ],
      {
        duration: 560,
        easing: "cubic-bezier(.6,0,.8,.2)",
        fill: "forwards",
      }
    );

    animation.addEventListener("finish", () => {
      remaining -= 1;
      if (remaining > 0) return;
      removeWindowExplodePieces();
      win.classList.remove("is-exploding");
      if (onComplete) onComplete();
    });
  });
};

const registerRandomEvent = (definition) => {
  const registeredDefinition = {
    debug: false,
    forceOnStart: false,
    probability: STANDARD_RANDOM_EVENT_PROBABILITY,
    probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
    ...definition,
  };
  randomEventDefinitions.push(registeredDefinition);
  if (registeredDefinition.bind) {
    randomEventBindings.push(registeredDefinition.bind);
  }
  return registeredDefinition;
};

// Registration happens thousands of lines before the desktop wires itself up,
// and a few events add document-level listeners whose order against the rest of
// the page is observable, so the queued `bind()` callbacks run from the one call
// site below instead of during registration.
const bindRegisteredRandomEvents = () => {
  randomEventBindings.forEach((bind) => bind());
  watchRandomEventViewportMedia();
  randomEventBindings.length = 0;
};

const randomEventKind = (definition) =>
  definition.kind || RANDOM_EVENT_KIND_NON_INTERACTIVE;

const randomEventDefinitionIsVisible = (definition) =>
  Boolean(definition.isVisible && definition.isVisible());

const randomEventVisibleCountForKind = (kind) => {
  const registeredCount = randomEventDefinitions.reduce(
    (count, definition) =>
      randomEventKind(definition) === kind && randomEventDefinitionIsVisible(definition)
        ? count + 1
        : count,
    0
  );
  return registeredCount + randomEventFallbackCountForKind(kind);
};

const randomEventPendingCountForKind = (kind) =>
  Array.from(randomEventPendingDefinitions).filter(
    (definition) => randomEventKind(definition) === kind
  ).length;

const randomEventCountForKind = (kind) =>
  randomEventVisibleCountForKind(kind) + randomEventPendingCountForKind(kind);

const randomEventKindCanSchedule = (kind, { consumeRelease = false } = {}) => {
  const limit = RANDOM_EVENT_KIND_LIMITS[kind];
  if (!limit) return true;

  const count = randomEventCountForKind(kind);
  if (count < limit) {
    randomEventKindMaxSince[kind] = 0;
    return true;
  }

  const now = Date.now();
  if (!randomEventKindMaxSince[kind]) {
    randomEventKindMaxSince[kind] = now;
    return false;
  }

  if (now - randomEventKindMaxSince[kind] < RANDOM_EVENT_MAX_LOCK_RELEASE_MS) {
    return false;
  }

  if (consumeRelease) randomEventKindMaxSince[kind] = now;
  return true;
};

const randomEventDefinitionCanSchedule = (
  definition,
  { consumeRelease = false, debug = false, forceOnStart = false } = {}
) => {
  if (debug || forceOnStart) return true;
  return randomEventKindCanSchedule(randomEventKind(definition), {
    consumeRelease,
  });
};

const randomEventDebugEnabled = (definition) =>
  RANDOM_EVENT_GLOBAL_DEBUG || Boolean(definition.debug);

const randomEventForceOnStartEnabled = (definition) =>
  Boolean(definition.forceOnStart);

const randomEventDeveloperModeAllows = (definition) =>
  !RANDOM_EVENT_DEVELOPER_MODE || Boolean(definition.debug);

const RANDOM_EVENT_PROBABILITY_GATED_DEBUG_TRIGGERS = new Set([
  "carouselNavigation",
  "failedAction",
  "windowDrag",
]);

const PROMO_RANDOM_EVENT_TRIGGER_FLOOR = 0.7;

const PROMO_RANDOM_EVENT_PROBABILITY_MULTIPLIER = 4;

const PROMO_RANDOM_EVENT_COMPACTNESS_MIN = 0.5;

const PROMO_RANDOM_EVENT_COMPACTNESS_MAX = 3;

const isPromoRandomEventModeActive = () =>
  Boolean(
    window.rohinAdminControlsController?.isPromoRandomModeEnabled?.()
  );

const promoRandomEventTriggerProbability = (probability) =>
  clampNumber(
    probability * PROMO_RANDOM_EVENT_PROBABILITY_MULTIPLIER,
    PROMO_RANDOM_EVENT_TRIGGER_FLOOR,
    1
  );

const promoRandomEventCompactnessWeight = (area, referenceArea) => {
  const normalizedArea = Number(area);
  const normalizedReference = Number(referenceArea);
  if (
    !Number.isFinite(normalizedArea) ||
    normalizedArea <= 0 ||
    !Number.isFinite(normalizedReference) ||
    normalizedReference <= 0
  ) {
    return 1;
  }
  return clampNumber(
    Math.sqrt(normalizedReference / normalizedArea),
    PROMO_RANDOM_EVENT_COMPACTNESS_MIN,
    PROMO_RANDOM_EVENT_COMPACTNESS_MAX
  );
};

const randomEventTriggerProbability = (triggerName, definition = null) => {
  const probabilities = definition?.probabilities || STANDARD_RANDOM_EVENT_PROBABILITIES;
  const fallbackProbability = definition?.probability ?? STANDARD_RANDOM_EVENT_PROBABILITY;
  const value =
    probabilities && triggerName in probabilities
      ? probabilities[triggerName]
      : fallbackProbability;
  const probability = Number(value);
  if (Number.isNaN(probability)) return 0;
  const boostedProbability =
    probability + (isNekoRandomEventBoostActive() ? NEKO_RANDOM_EVENT_PROBABILITY_BONUS : 0);
  const clampedProbability = clampNumber(boostedProbability, 0, 1);
  return isPromoRandomEventModeActive()
    ? promoRandomEventTriggerProbability(clampedProbability)
    : clampedProbability;
};

const RANDOM_EVENT_SELECTION_LOCKDOWN_MS = 2 * 60 * 1000;

const randomEventSelectionLockdownUntil = new Map();

const RANDOM_EVENT_TRIGGER_COOLDOWN_MS = 7.5 * 1000;

let randomEventTriggerCooldownUntil = 0;

let adminNaturalTriggerSuppressionDepth = 0;

const suppressAdminNaturalTriggersForCurrentTask = () => {
  adminNaturalTriggerSuppressionDepth += 1;
  window.setTimeout(() => {
    adminNaturalTriggerSuppressionDepth = Math.max(
      0,
      adminNaturalTriggerSuppressionDepth - 1
    );
  }, 0);
};

// Promo mode biases towards compact windows. The Admin orchestrator measures
// them, so it supplies the weighting; without it every event weighs the same.
let randomEventCompactnessWeightProvider = () => 1;

const setRandomEventCompactnessWeightProvider = (provider) => {
  randomEventCompactnessWeightProvider =
    typeof provider === "function" ? provider : () => 1;
};

// Clicks inside a specific event or game window are accounted for by whoever
// owns that window. The matchers cover disjoint windows, so the order sources
// register in never decides which one claims a click.
// Some events exist only as the answer when nothing else fires for a given
// trigger. They are not scheduled, so they register separately and report the
// slot they occupy while visible.
const randomEventFallbacks = [];

const registerRandomEventFallback = (fallback) => {
  randomEventFallbacks.push(fallback);
};

const runRandomEventFallback = (triggerName) => {
  const fallback = randomEventFallbacks.find((entry) =>
    entry.triggers.includes(triggerName)
  );
  return fallback ? Boolean(fallback.run()) : false;
};

const randomEventFallbackCountForKind = (kind) =>
  randomEventFallbacks.filter(
    (fallback) => fallback.kind === kind && fallback.isVisible()
  ).length;

const randomEventClickSources = [];

const registerRandomEventClickSource = (source) => {
  randomEventClickSources.push(source);
};

let minesweeperRandomEventClickCount = 0;
let solitaireRandomEventClickCount = 0;

const shouldPauseNaturalRandomEvents = () =>
  adminNaturalTriggerSuppressionDepth > 0 ||
  Boolean(
    window.rohinAdminControlsController?.shouldPauseNaturalEvents?.()
  );

const isRandomEventTriggerOnCooldown = (now = Date.now()) => {
  if (
    !Number.isFinite(randomEventTriggerCooldownUntil) ||
    now >= randomEventTriggerCooldownUntil
  ) {
    randomEventTriggerCooldownUntil = 0;
    return false;
  }
  return true;
};

const recordRandomEventTrigger = (now = Date.now()) => {
  randomEventTriggerCooldownUntil = now + RANDOM_EVENT_TRIGGER_COOLDOWN_MS;
};

const isRandomEventOnLockdown = (definition, now = Date.now()) => {
  const eventId = definition?.id;
  if (!eventId) return false;

  const lockdownUntil = randomEventSelectionLockdownUntil.get(eventId);
  if (!Number.isFinite(lockdownUntil) || now >= lockdownUntil) {
    randomEventSelectionLockdownUntil.delete(eventId);
    return false;
  }
  return true;
};

const recordRandomEventSelection = (definition, now = Date.now()) => {
  const eventId = definition?.id;
  if (!eventId) return;
  randomEventSelectionLockdownUntil.set(eventId, now + RANDOM_EVENT_SELECTION_LOCKDOWN_MS);
};

const chooseRandomEventOutsideLockdown = (eligibleEvents, now = Date.now()) => {
  const candidates = [...eligibleEvents];
  while (candidates.length) {
    const selected = chooseWeightedRandomEvent(candidates);
    if (!selected) return null;
    if (!isRandomEventOnLockdown(selected.definition, now)) return selected;
    candidates.splice(candidates.indexOf(selected), 1);
  }
  return null;
};

const randomEventDelayMs = () => {
  const rawDelay =
    RANDOM_EVENT_DELAY_MIN_MS +
    Math.random() * (RANDOM_EVENT_DELAY_MAX_MS - RANDOM_EVENT_DELAY_MIN_MS);
  return Math.round(rawDelay / RANDOM_EVENT_DELAY_STEP_MS) * RANDOM_EVENT_DELAY_STEP_MS;
};

const randomEventPreloadSourceCache = mediaSourcePreloadRequests;

const preloadRandomEventSource = (src) => {
  const normalizedSrc = String(src || "");
  if (!normalizedSrc) return Promise.resolve();
  return preloadMediaSource(normalizedSrc, { forceImage: true });
};

const collectRandomEventPreloadTargets = (target, collection = []) => {
  if (!target) return collection;
  if (
    typeof target === "string" ||
    target instanceof Element ||
    typeof target.then === "function"
  ) {
    collection.push(target);
    return collection;
  }
  if (typeof target[Symbol.iterator] === "function") {
    Array.from(target).forEach((item) => {
      collectRandomEventPreloadTargets(item, collection);
    });
  }
  return collection;
};

const preloadRandomEventTarget = (target) => {
  if (!target) return Promise.resolve();
  if (typeof target === "string") return preloadRandomEventSource(target);
  if (target instanceof Element) return preloadDeferredMedia(target);
  if (typeof target.then === "function") return target.catch(() => {});
  return Promise.resolve();
};

const getRandomEventPreloadTargets = (definition, context) => {
  const preloadTargets = definition.preloadTargets;
  return typeof preloadTargets === "function"
    ? preloadTargets(context)
    : preloadTargets;
};

const preloadRandomEventAssets = (definition, context) => {
  let targets = [];
  try {
    targets = collectRandomEventPreloadTargets(
      getRandomEventPreloadTargets(definition, context)
    );
  } catch (error) {
    console.warn("[Rohin OS] Random event asset preload setup failed", definition.id, error);
    return Promise.resolve();
  }

  return Promise.all([
    loadRandomEventStyles(),
    ...targets.map(preloadRandomEventTarget),
  ]).catch((error) => {
    console.warn("[Rohin OS] Random event asset preload failed", definition.id, error);
  });
};

window.addEventListener("pagehide", () => {
  randomEventStyleOpenRequests.forEach((request) => {
    request.cancelled = true;
  });
  randomEventStyleOpenRequests.clear();
});

// An event that has the visitor mid-fight blocks new ones. Each such event
// reports its own state when it registers.
const isRandomEventGameplayLockActive = () =>
  randomEventDefinitions.some((definition) =>
    Boolean(definition.isGameplayLocked?.())
  );

const scheduleRandomEventRun = (definition, context) => {
  const debug = Boolean(context.debug);
  const forceOnStart =
    Boolean(context.forceOnStart) && context.triggerName === "startButton";
  const bypassGlobalLimits = debug || forceOnStart;
  if (isRandomEventGameplayLockActive()) return false;
  if (randomEventPendingDefinitions.has(definition)) return false;
  if (!bypassGlobalLimits && isRandomEventTriggerOnCooldown()) return false;
  if (isRandomEventOnLockdown(definition)) return false;
  if (
    !randomEventDefinitionCanSchedule(definition, {
      consumeRelease: true,
      debug,
      forceOnStart,
    })
  ) {
    return false;
  }
  randomEventPendingDefinitions.add(definition);
  recordRandomEventSelection(definition);
  if (!bypassGlobalLimits) recordRandomEventTrigger();
  const delayRequest = new Promise((resolve) => {
    window.setTimeout(resolve, randomEventDelayMs());
  });
  const preloadRequest = preloadRandomEventAssets(definition, context);

  Promise.all([delayRequest, preloadRequest]).then(() => {
    randomEventPendingDefinitions.delete(definition);
    if (isRandomEventGameplayLockActive()) return;
    const { triggerName, detail } = context;
    if (
      definition.canTrigger &&
      !definition.canTrigger({ triggerName, detail, debug, forceOnStart })
    ) {
      return;
    }
    definition.run(context);
  });
  return true;
};

const triggerRandomEvents = (triggerName, detail = {}) => {
  if (!isHomeActivationReady()) return false;
  if (shouldPauseNaturalRandomEvents()) return false;
  if (isRandomEventGameplayLockActive()) return false;
  const triggerOnCooldown = isRandomEventTriggerOnCooldown();
  const forcedEventPending = Array.from(randomEventPendingDefinitions).some(
    (definition) =>
      randomEventDebugEnabled(definition) ||
      randomEventForceOnStartEnabled(definition)
  );
  const eligibleEvents = [];
  const forcedEvents = [];

  randomEventDefinitions.forEach((definition) => {
    if (randomEventPendingDefinitions.has(definition)) return;
    if (!randomEventDeveloperModeAllows(definition)) return;
    const debug = randomEventDebugEnabled(definition);
    const forceOnStart = randomEventForceOnStartEnabled(definition);
    const bypassGlobalLimits =
      debug || (forceOnStart && triggerName === "startButton");
    if (forcedEventPending && (debug || forceOnStart)) return;
    if (triggerOnCooldown && !bypassGlobalLimits) return;
    const forceRun =
      (forceOnStart && triggerName === "startButton") ||
      (debug && !RANDOM_EVENT_PROBABILITY_GATED_DEBUG_TRIGGERS.has(triggerName));
    if (
      definition.canTrigger &&
      !definition.canTrigger({ triggerName, detail, debug, forceOnStart })
    ) {
      return;
    }
    if (
      !randomEventDefinitionCanSchedule(definition, {
        debug,
        forceOnStart: forceOnStart && triggerName === "startButton",
      })
    ) {
      return;
    }
    if (forceRun) {
      forcedEvents.push({
        definition,
        debug,
        forceOnStart,
        triggerProbability: 1,
      });
      return;
    }
    const triggerProbability = randomEventTriggerProbability(triggerName, definition);
    eligibleEvents.push({
      definition,
      debug,
      forceOnStart,
      triggerProbability,
      selectionWeight: isPromoRandomEventModeActive()
        ? triggerProbability * randomEventCompactnessWeightProvider(definition)
        : triggerProbability,
    });
  });

  const selectedForced = chooseRandomEventOutsideLockdown(forcedEvents);
  if (
    selectedForced &&
    scheduleRandomEventRun(selectedForced.definition, {
      triggerName,
      detail,
      debug: selectedForced.debug,
      forceOnStart: selectedForced.forceOnStart,
    })
  ) {
    return true;
  }

  const maxTriggerProbability = eligibleEvents.reduce(
    (maxProbability, event) => Math.max(maxProbability, event.triggerProbability),
    0
  );

  if (
    !eligibleEvents.length ||
    Math.random() >= maxTriggerProbability
  ) {
    return runRandomEventFallback(triggerName);
  }

  const selected = chooseRandomEventOutsideLockdown(eligibleEvents);
  if (!selected) {
    return runRandomEventFallback(triggerName);
  }

  if (
    scheduleRandomEventRun(selected.definition, {
      triggerName,
      detail,
      debug: selected.debug,
      forceOnStart: selected.forceOnStart,
    })
  ) {
    return true;
  }

  return false;
};

const recordGeneralRandomEventClick = (detail = {}) => {
  generalRandomEventClickCount += 1;
  if (
    generalRandomEventClickCount %
      GENERAL_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL !==
    0
  ) {
    return false;
  }
  return triggerRandomEvents("generalClicks", {
    clickCount: generalRandomEventClickCount,
    ...detail,
  });
};

const scheduleRandomEventIdleTrigger = () => {
  randomEventIdleTimer = debounceTimer(randomEventIdleTimer, () => {
    randomEventIdleTimer = null;
    if (!document.hidden) {
      triggerRandomEvents("idleInterval", {
        idleMs: RANDOM_EVENT_IDLE_DELAY_MS,
      });
    }
    scheduleRandomEventIdleTrigger();
  }, RANDOM_EVENT_IDLE_DELAY_MS);
};

const markRandomEventUserActivity = () => {
  scheduleRandomEventIdleTrigger();
};

const clearAppDwellTimer = () => {
  if (activeAppDwellTimer) {
    clearTimeout(activeAppDwellTimer);
    activeAppDwellTimer = null;
  }
};

const clearActiveAppDwell = () => {
  clearAppDwellTimer();
  activeAppDwellWindow = null;
  activeAppDwellStartedAt = 0;
};

const scheduleActiveAppDwellTimer = () => {
  clearAppDwellTimer();
  if (
    !activeAppDwellWindow ||
    !isWindowVisible(activeAppDwellWindow) ||
    document.hidden
  ) {
    return;
  }

  activeAppDwellTimer = setTimeout(() => {
    if (
      !activeAppDwellWindow ||
      !isWindowVisible(activeAppDwellWindow) ||
      document.hidden
    ) {
      clearActiveAppDwell();
      return;
    }

    triggerRandomEvents("appDwell", {
      appId: activeAppDwellWindow.getAttribute("data-app-window") || "",
      elapsedMs: Date.now() - activeAppDwellStartedAt,
    });
    scheduleActiveAppDwellTimer();
  }, RANDOM_EVENT_APP_DWELL_MS);
};

const trackActiveAppDwell = (win) => {
  if (
    !win ||
    !win.matches("[data-app-window]") ||
    isAdminControlsAppId(win.getAttribute("data-app-window")) ||
    !isWindowVisible(win)
  ) {
    clearActiveAppDwell();
    return;
  }

  if (activeAppDwellWindow !== win) {
    activeAppDwellWindow = win;
    activeAppDwellStartedAt = Date.now();
  }

  scheduleActiveAppDwellTimer();
};

const isDisabledActionTarget = (element) =>
  Boolean(
    element &&
      (element.matches(":disabled") ||
        element.getAttribute("aria-disabled") === "true" ||
        element.closest("[aria-disabled='true']"))
  );

const isInertTitleBarButton = (button) =>
  Boolean(
    button &&
      button.matches(".title-bar-controls button") &&
      button.getAttribute("aria-label") === "Help" &&
      !button.id &&
      !button.hasAttribute("data-close") &&
      !button.matches(":disabled")
  );

const handleFailedActionTrigger = (event) => {
  if (!event.isTrusted) return;
  const target =
    event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target) return;
  const actionTarget = target.closest(
    "button, [role='button'], input, select, textarea"
  );
  if (!actionTarget || !document.documentElement.contains(actionTarget)) return;

  const disabled = isDisabledActionTarget(actionTarget);
  const inertTitleBar = actionTarget.matches("button") && isInertTitleBarButton(actionTarget);
  if (!disabled && !inertTitleBar) return;

  triggerRandomEvents("failedAction", {
    reason: disabled ? "disabled" : "inert-title-bar-button",
    label:
      actionTarget.getAttribute("aria-label") ||
      actionTarget.textContent.trim() ||
      actionTarget.id ||
      "",
  });
};

const STANDARD_RANDOM_EVENT_PROBABILITY = 0.0075;

const STANDARD_RANDOM_EVENT_PROBABILITIES = Object.freeze({
  windowOpen: 0.15,
  windowClose: 0.15,
  gameWin: 0.8,
  gameLoss: 0.3,
  startButton: 0.25,
  carouselNavigation: 0.05,
  newTabLink: 0.35,
  fileDownload: 0.65,
  pageReload: 0.5,
  calendarOpen: 0.3,
  generalClicks: 0.5,
  minesweeperClicks: 0.5,
  solitaireClicks: 0.5,
  failedAction: 0.1,
  appDwell: 0.6,
  windowDrag: 0.18,
  idleInterval: 0.4,
});


window.addEventListener("load", () => {
  runAfterHomeActivation(() => {
    let isReload = false;
    try {
      const navigationEntry = performance.getEntriesByType("navigation")[0];
      isReload = navigationEntry && navigationEntry.type === "reload";
    } catch (error) {
      isReload = false;
    }

    try {
      const adminResetReload = wasAdminControlsResetReload();
      if (
        isReload &&
        !adminResetReload &&
        sessionStorage.getItem(RANDOM_EVENT_RELOAD_KEY) === "true"
      ) {
        setTimeout(() => {
          triggerRandomEvents("pageReload");
        }, 300);
      }
      sessionStorage.removeItem(RANDOM_EVENT_RELOAD_KEY);
    } catch (error) {
      // Ignore storage failures; the page should still load normally.
    }
  });
});

const openRandomEventWindow = (calendarEvent, eventKey) => {
  if (!randomEventWindow) return;
  activeRandomEventKey = eventKey || "";
  if (calendarEvent) {
    if (randomEventTitle) {
      randomEventTitle.textContent = calendarEvent.title;
    }
    if (randomEventImage) {
      if (randomEventImage.dataset.src !== calendarEvent.image) {
        randomEventImage.removeAttribute("src");
      }
      randomEventImage.dataset.src = calendarEvent.image;
    }
  }
  showManagedRandomEventWindow(randomEventWindow, { isVisible: () => false });
};

const closeRandomEventWindow = () => {
  closeManagedRandomEventWindow(randomEventWindow, {
    force: true,
    beforeClose: () => {
      activeRandomEventKey = "";
    },
  });
};

// The calendar event window, Feliz Jueves and the shared system-alert shell are
// not per-event definitions, so they stay wired here.
[randomEventClose, randomEventOk].forEach((button) => {
  if (!button) return;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    closeRandomEventWindow();
  });
});

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!event.isTrusted) return;
    const target =
      event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target?.closest("#admin-controls-window, #admin-controls-stand-in-window")) return;
    markRandomEventUserActivity();
    handleFailedActionTrigger(event);
  },
  { capture: true }
);

document.addEventListener(
  "keydown",
  (event) => {
    if (event.isTrusted) markRandomEventUserActivity();
  },
  { capture: true }
);

document.addEventListener(
  "wheel",
  (event) => {
    if (event.isTrusted) markRandomEventUserActivity();
  },
  { capture: true, passive: true }
);

document.addEventListener(
  "click",
  (event) => {
    if (!event.isTrusted) return;
    const target =
      event.target instanceof Element ? event.target : event.target?.parentElement;
    const adminInteraction =
      window.rohinAdminControlsController?.handleDocumentClick?.(event) || null;
    if (
      adminInteraction ||
      target?.closest("#admin-controls-window, #admin-controls-stand-in-window")
    ) {
      return;
    }
    const clickSource = randomEventClickSources.find((source) =>
      source.matches(target)
    );
    if (clickSource) {
      clickSource.claim({ target });
      return;
    }
    recordGeneralRandomEventClick();
  },
  { capture: true }
);

document.addEventListener("click", (event) => {
  if (!event.isTrusted) return;
  const link = event.target.closest("a[href]");
  if (!link || !document.documentElement.contains(link)) return;
  if (link.hasAttribute("download")) {
    triggerRandomEvents("fileDownload", {
      href: link.href,
      source: "download-link",
    });
  }
  if (link.target === "_blank") {
    triggerRandomEvents("newTabLink", {
      href: link.href,
      source: "anchor",
    });
  }
});

registerRandomEventClickSource({
  matches: (target) => Boolean(target?.closest('[data-app-window="minesweeper"]')),
  claim: () => {
    minesweeperRandomEventClickCount += 1;
    if (
      minesweeperRandomEventClickCount %
        MINESWEEPER_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL !==
      0
    ) {
      return;
    }
    triggerRandomEvents("minesweeperClicks", {
      clickCount: minesweeperRandomEventClickCount,
      appId: "minesweeper",
    });
  },
});

registerRandomEventClickSource({
  matches: (target) => Boolean(target?.closest('[data-app-window="solitaire"]')),
  claim: () => {
    solitaireRandomEventClickCount += 1;
    if (
      solitaireRandomEventClickCount %
        SOLITAIRE_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL !==
      0
    ) {
      return;
    }
    triggerRandomEvents("solitaireClicks", {
      clickCount: solitaireRandomEventClickCount,
      appId: "solitaire",
    });
  },
});

// Features announce what the visitor did; this is the only listener.
observeActivity(triggerRandomEvents);

// The runtime places and clamps the windows it owns; the window manager asks
// rather than testing for a kind of window itself.
registerWindowPlacement({
  owns: (win) => randomEventViewportWindows().includes(win),
  position: positionRandomEventWindowInViewport,
  clamp: clampRandomEventWindowToViewport,
  insets: getRandomEventVisualInsets,
});

registerActiveWindowObserver({
  onActivate: (win) => trackActiveAppDwell(win),
  onDeactivate: () => clearActiveAppDwell(),
  onWindowClosed: (win) => {
    if (activeAppDwellWindow === win) clearActiveAppDwell();
  },
});

bindManagedRandomEventWindowAnimation(randomEventWindow);

const getActiveRandomEventKey = () => activeRandomEventKey;

window.homeEventRuntime = Object.freeze({
  getActiveRandomEventKey,
  PROMO_RANDOM_EVENT_COMPACTNESS_MIN,
  RANDOM_EVENT_DEVELOPER_MODE,
  RANDOM_EVENT_KIND_INTERACTIVE,
  RANDOM_EVENT_KIND_NON_INTERACTIVE,
  RANDOM_EVENT_OBSTACLE_GAP,
  RANDOM_EVENT_PLACEMENT_ATTEMPTS,
  RANDOM_EVENT_RELOAD_KEY,
  RANDOM_EVENT_TASKBAR_CLEARANCE,
  RANDOM_EVENT_VIEWPORT_PADDING,
  STANDARD_RANDOM_EVENT_PROBABILITIES,
  STANDARD_RANDOM_EVENT_PROBABILITY,
  SYSTEM_ALERTS,
  activeAppDwellWindow,
  animateWindowExplode,
  bindManagedRandomEventWindowAnimation,
  bindRandomEventButton,
  bindRegisteredRandomEvents,
  chooseRandomEventOutsideLockdown,
  clampRandomEventPosition,
  clampRandomEventWindowAfterMediaLoad,
  clampRandomEventWindowToViewport,
  clampVisibleRandomEventWindows,
  clearActiveAppDwell,
  closeManagedRandomEventWindow,
  closeRandomEventWindow,
  collectRandomEventPreloadTargets,
  getRandomEventPreloadTargets,
  getRandomEventVisualInsets,
  getRandomEventWindowBounds,
  getRandomEventWindowPosition,
  isManagedRandomEventWindowVisible,
  isRandomEventGameplayLockActive,
  isRandomEventTriggerOnCooldown,
  openRandomEventWindow,
  positionRandomEventWindowInViewport,
  preloadRandomEventAssets,
  promoRandomEventCompactnessWeight,
  randomEventCandidateRect,
  randomEventDebugEnabled,
  randomEventDefinitionCanSchedule,
  randomEventDefinitionIsVisible,
  randomEventDefinitions,
  randomEventDeveloperModeAllows,
  randomEventForceOnStartEnabled,
  randomEventKind,
  randomEventKindCanSchedule,
  randomEventPendingDefinitions,
  randomEventViewportWindows,
  randomEventWindow,
  recordGeneralRandomEventClick,
  recordRandomEventSelection,
  recordRandomEventTrigger,
  registerRandomEvent,
  registerRandomEventClickSource,
  registerRandomEventFallback,
  registerRandomEventWindows,
  registerRandomEventVisualScale,
  randomEventPlacementObstacles,
  sampleRandomEventPosition,
  scheduleRandomEventIdleTrigger,
  scoreRandomEventPlacement,
  setRandomEventCompactnessWeightProvider,
  setRandomEventWindowPosition,
  showManagedRandomEventWindow,
  suppressAdminNaturalTriggersForCurrentTask,
  trackActiveAppDwell,
});
})();
