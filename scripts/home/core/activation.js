(() => {
const {
  loadDeferredMedia: loadDeferredMediaNow,
  preloadDeferredMedia: preloadDeferredMediaNow,
  preloadDeferredMediaInOrder: preloadDeferredMediaInOrderNow,
} = window.homeMedia;

let homeActivationReady = !document.prerendering;

let resolveHomeActivated = null;

const homePrerenderDebugEnabled = (() => {
  try {
    return new URLSearchParams(window.location.search).get("prerenderDebug") === "1";
  } catch (error) {
    return false;
  }
})();

const homeSawPrerendering = Boolean(document.prerendering);

const homePerfNow = () => Math.round(performance.now());

const getHomePrerenderActivationStart = () => {
  try {
    const navigationEntry = performance.getEntriesByType("navigation")[0];
    return Number(navigationEntry?.activationStart) || 0;
  } catch (error) {
    return 0;
  }
};

const homePerfLog = (...args) => {
  if (!homePrerenderDebugEnabled) return;
  console.info("[Rohin OS prerender]", ...args);
};

window.rohinHomePerf = {
  activationStart: getHomePrerenderActivationStart(),
  prerendered: homeSawPrerendering || getHomePrerenderActivationStart() > 0,
  activatedAt: homeActivationReady ? homePerfNow() : null,
  firstDesktopPaintAt: null,
  sawPrerendering: homeSawPrerendering,
};

window.rohinHomePrerenderActivationStart = window.rohinHomePerf.activationStart;

homePerfLog("boot", {
  documentPrerendering: document.prerendering,
  visibilityState: document.visibilityState,
  activationStart: window.rohinHomePerf.activationStart,
  activationStartPositive: window.rohinHomePerf.activationStart > 0,
});

const whenHomeActivated = homeActivationReady
  ? Promise.resolve()
  : new Promise((resolve) => {
      resolveHomeActivated = resolve;
    });

const isHomeActivationReady = () => homeActivationReady;

const recordHomeActivation = (source) => {
  const activationStart = getHomePrerenderActivationStart();
  window.rohinHomePerf.activationStart = activationStart;
  window.rohinHomePerf.prerendered =
    window.rohinHomePerf.sawPrerendering || activationStart > 0;
  window.rohinHomePerf.activatedAt = window.rohinHomePerf.activatedAt || homePerfNow();
  window.rohinHomePrerenderActivationStart = activationStart;
  homePerfLog("activated", {
    source,
    activationStartPositive: activationStart > 0,
    ...window.rohinHomePerf,
  });
};

const runHomeActivationCallback = (callback) => {
  try {
    callback();
  } catch (error) {
    console.error("[Rohin OS] Activation callback failed", error);
  }
};

function markHomeActivated(event) {
  if (homeActivationReady) return;
  homeActivationReady = true;
  document.removeEventListener("visibilitychange", checkHomeActivation);
  window.removeEventListener("pageshow", checkHomeActivation);
  recordHomeActivation(event?.type || "markHomeActivated");
  if (resolveHomeActivated) {
    resolveHomeActivated();
    resolveHomeActivated = null;
  }
}

function checkHomeActivation(event) {
  if (!document.prerendering && document.visibilityState !== "hidden") {
    markHomeActivated(event);
  }
}

if (!homeActivationReady) {
  document.addEventListener(
    "prerenderingchange",
    (event) => {
      homePerfLog("prerenderingchange", {
        documentPrerendering: document.prerendering,
        visibilityState: document.visibilityState,
      });
      markHomeActivated(event);
    },
    { once: true }
  );
  document.addEventListener("visibilitychange", checkHomeActivation);
  window.addEventListener("pageshow", checkHomeActivation);
} else {
  recordHomeActivation("initial");
}

const runAfterHomeActivation = (callback) => {
  const run = () => {
    runHomeActivationCallback(callback);
  };
  if (isHomeActivationReady()) {
    run();
    return;
  }
  whenHomeActivated.then(run);
};

const loadDeferredMedia = (root, visibleOnly = false) => {
  if (!root) return;
  if (!isHomeActivationReady()) {
    runAfterHomeActivation(() => loadDeferredMedia(root, visibleOnly));
    return;
  }
  loadDeferredMediaNow(root, visibleOnly);
};

const preloadDeferredMedia = (root, visibleOnly = false) => {
  if (!root) return Promise.resolve();
  if (!isHomeActivationReady()) {
    return whenHomeActivated.then(() => preloadDeferredMedia(root, visibleOnly));
  }
  return preloadDeferredMediaNow(root, visibleOnly);
};

const preloadDeferredMediaInOrder = (root, options = {}) => {
  if (!root) return Promise.resolve();
  if (!isHomeActivationReady()) {
    return whenHomeActivated.then(() => preloadDeferredMediaInOrder(root, options));
  }
  return preloadDeferredMediaInOrderNow(root, options);
};

const unloadDeferredImages = (root) => {
  if (!root) return;
  root.querySelectorAll("img[data-src]").forEach((image) => {
    image.removeAttribute("src");
  });
};

window.homeActivation = Object.freeze({
  homePerfLog,
  homePerfNow,
  isHomeActivationReady,
  loadDeferredMedia,
  preloadDeferredMedia,
  preloadDeferredMediaInOrder,
  runAfterHomeActivation,
  unloadDeferredImages,
  whenHomeActivated,
});
})();