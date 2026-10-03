(() => {
const {
  byId,
} = window.homeDom;
const {
  clearLightningCanvas,
  drawLightningBorderFrame,
} = window.homeEventLightning;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  bindRandomEventButton,
  clampRandomEventWindowToViewport,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  registerRandomEvent,
  registerRandomEventClickSource,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clampNumber,
  debounceTimer,
} = window.homeUtil;

const fateWindow = byId("fate-window");
const fateTitle = byId("fate-title");
const fateTitleClose = byId("fate-title-close");
const fateReadyStage = byId("fate-ready-stage");
const fateFightStage = byId("fate-fight-stage");
const fateResultStage = byId("fate-result-stage");
const fateProgress = byId("fate-progress");
const fateProgressBar = byId("fate-progress-bar");
const fateStart = byId("fate-start");
const fateResist = byId("fate-resist");
const fateLightningCanvas = byId("fate-lightning-canvas");
const fateResultImage = byId("fate-result-image");
const fateResultCredit = byId("fate-result-credit");
const fateResultText = byId("fate-result-text");
const fateResultOk = byId("fate-result-ok");

let fateProgressValue = 0;

let fateDrainTimer = null;

let fateLightningTimer = null;

let fateLightningFrame = null;

let fateResolveTimer = null;

let fateResultOpenTimer = null;

let fateState = "idle";

const FATE_START_PROGRESS = 56;

const FATE_PRESS_GAIN = 5;

const FATE_DRAIN_INTERVAL_MS = 80;

const FATE_DRAIN_AMOUNT = 1.9;

const FATE_RESULT_FREEZE_MS = 1000;

const FATE_RESULT_REOPEN_DELAY_MS = 500;

const FATE_SUCCESS_TEXT =
  "Maybe you aren't a shadow on the water... but instead, a fish that breaches water's surface.";

const FATE_LOSS_TEXT = "Perhaps you do not have the strength to resist causality.";

const FATE_LIGHTNING_DURATION_MS = 220;

const getFateLightningContext = () => {
  if (!fateLightningCanvas) return null;
  return fateLightningCanvas.getContext("2d");
};

const clearFateLightningCanvas = () => clearLightningCanvas(fateLightningCanvas);

const drawFateLightningBorderFrame = (alpha) => {
  drawLightningBorderFrame(fateLightningCanvas, alpha);
};

const startFateLightningStrike = () => {
  if (!fateLightningCanvas) return;
  if (fateLightningFrame) cancelAnimationFrame(fateLightningFrame);
  const startedAt = performance.now();

  const render = (now) => {
    const progress = Math.min(1, (now - startedAt) / FATE_LIGHTNING_DURATION_MS);
    const flicker = progress < 0.16 ? 1 : Math.random() > 0.32 ? 1 - progress * 0.42 : 0.18;
    const alpha = Math.max(0, flicker * (1 - progress * 0.36));
    drawFateLightningBorderFrame(alpha);

    if (progress < 1) {
      fateLightningFrame = requestAnimationFrame(render);
      return;
    }

    fateLightningFrame = null;
    clearFateLightningCanvas();
  };

  fateLightningFrame = requestAnimationFrame(render);
};

const isFateVisible = () => isManagedRandomEventWindowVisible(fateWindow);

const updateFateProgress = () => {
  const progress = clampNumber(fateProgressValue, 0, 100);
  if (fateProgressBar) fateProgressBar.style.width = `${progress}%`;
  if (fateProgress) fateProgress.setAttribute("aria-valuenow", Math.round(progress));
};

const clearFateTimers = () => {
  if (fateDrainTimer) {
    clearInterval(fateDrainTimer);
    fateDrainTimer = null;
  }
  if (fateLightningTimer) {
    clearTimeout(fateLightningTimer);
    fateLightningTimer = null;
  }
  if (fateLightningFrame) {
    cancelAnimationFrame(fateLightningFrame);
    fateLightningFrame = null;
  }
  if (fateResolveTimer) {
    clearTimeout(fateResolveTimer);
    fateResolveTimer = null;
  }
  if (fateResultOpenTimer) {
    clearTimeout(fateResultOpenTimer);
    fateResultOpenTimer = null;
  }
  if (fateWindow) fateWindow.classList.remove("is-resisting");
  clearFateLightningCanvas();
};

const resetFateWindow = () => {
  clearFateTimers();
  fateState = "ready";
  fateProgressValue = FATE_START_PROGRESS;
  updateFateProgress();
  if (fateTitle) fateTitle.textContent = "Resist Causality";
  if (fateReadyStage) fateReadyStage.classList.remove("is-hidden");
  if (fateFightStage) fateFightStage.classList.add("is-hidden");
  if (fateResultStage) fateResultStage.classList.add("is-hidden");
  if (fateResultImage) {
    fateResultImage.removeAttribute("src");
    fateResultImage.alt = "";
  }
  if (fateResultCredit) fateResultCredit.classList.add("is-hidden");
  if (fateResultText) fateResultText.textContent = "";
  if (fateResultOk) fateResultOk.textContent = "OK";
  if (fateStart) fateStart.disabled = false;
  if (fateResist) fateResist.disabled = false;
};

const startFateMinigame = () => {
  if (fateState !== "ready") return;
  fateState = "active";
  fateProgressValue = FATE_START_PROGRESS;
  updateFateProgress();
  if (fateReadyStage) fateReadyStage.classList.add("is-hidden");
  if (fateFightStage) fateFightStage.classList.remove("is-hidden");
  if (fateStart) fateStart.disabled = true;
  if (fateResist) {
    fateResist.disabled = false;
    fateResist.focus();
  }
  startFateDrain();
};

const pulseFateWindow = () => {
  if (!fateWindow) return;
  fateWindow.classList.remove("is-resisting");
  void fateWindow.offsetWidth;
  fateWindow.classList.add("is-resisting");
  startFateLightningStrike();
  fateLightningTimer = debounceTimer(fateLightningTimer, () => {
    fateWindow.classList.remove("is-resisting");
    fateLightningTimer = null;
  }, 240);
};

const setFateResultContent = (success) => {
  if (fateTitle) fateTitle.textContent = success ? "Causality Resisted" : "Your Fate has been Sealed";
  if (fateReadyStage) fateReadyStage.classList.add("is-hidden");
  if (fateFightStage) fateFightStage.classList.add("is-hidden");
  if (fateResultStage) fateResultStage.classList.remove("is-hidden");
  if (fateResultImage) {
    fateResultImage.src = success
      ? "assets/random%20events/zodd_defeated_by_shld0n_hcks.jpg"
      : "assets/random%20events/guts-lost.jpeg";
    fateResultImage.alt = "";
  }
  if (fateResultCredit) {
    fateResultCredit.classList.toggle("is-hidden", !success);
  }
  if (fateResultText) {
    fateResultText.textContent = success ? FATE_SUCCESS_TEXT : FATE_LOSS_TEXT;
  }
  if (fateResultOk) fateResultOk.textContent = success ? "OK" : "Succumb";
};

const openFateResultWindow = (success) => {
  if (!fateWindow) return;
  fateState = success ? "success" : "loss";
  setFateResultContent(success);
  showManagedRandomEventWindow(fateWindow, {
    isVisible: () => false,
    clearClasses: ["is-resisting"],
    clampAfterMediaLoad: true,
    afterShow: () => {
      requestAnimationFrame(() => {
        if (fateResultOk) fateResultOk.focus();
      });
    },
  });
};

const finishFateEvent = (success) => {
  if (fateState !== "active") return;
  fateState = "resolving";
  fateProgressValue = success ? 100 : 0;
  updateFateProgress();
  if (fateDrainTimer) {
    clearInterval(fateDrainTimer);
    fateDrainTimer = null;
  }
  if (fateLightningTimer) {
    clearTimeout(fateLightningTimer);
    fateLightningTimer = null;
  }
  if (fateLightningFrame) {
    cancelAnimationFrame(fateLightningFrame);
    fateLightningFrame = null;
  }
  if (fateWindow) fateWindow.classList.remove("is-resisting");
  clearFateLightningCanvas();
  if (fateResist) fateResist.disabled = true;
  if (fateResolveTimer) clearTimeout(fateResolveTimer);
  if (fateResultOpenTimer) clearTimeout(fateResultOpenTimer);

  fateResolveTimer = setTimeout(() => {
    fateResolveTimer = null;
    if (!fateWindow) return;
    fateState = "transitioning";
    closeManagedRandomEventWindow(fateWindow, { force: true });
    fateResultOpenTimer = setTimeout(() => {
      fateResultOpenTimer = null;
      openFateResultWindow(success);
    }, FATE_RESULT_REOPEN_DELAY_MS);
  }, FATE_RESULT_FREEZE_MS);
};

const tickFateDrain = () => {
  if (fateState !== "active") return;
  fateProgressValue = Math.max(0, fateProgressValue - FATE_DRAIN_AMOUNT);
  updateFateProgress();
  if (fateProgressValue <= 0) finishFateEvent(false);
};

const startFateDrain = () => {
  if (fateDrainTimer) clearInterval(fateDrainTimer);
  fateDrainTimer = setInterval(tickFateDrain, FATE_DRAIN_INTERVAL_MS);
};

const resistFate = () => {
  if (fateState !== "active") return;
  fateProgressValue = Math.min(100, fateProgressValue + FATE_PRESS_GAIN);
  updateFateProgress();
  pulseFateWindow();
  if (fateProgressValue >= 100) {
    finishFateEvent(true);
  }
};

const handleFateKeyMash = (event) => {
  if (fateState !== "active") return;
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  event.preventDefault();
  resistFate();
};

const showFateWindow = () => {
  showManagedRandomEventWindow(fateWindow, {
    onFront: () => {
      clampRandomEventWindowToViewport(fateWindow);
      if (fateState === "ready" && fateStart) fateStart.focus();
      if (fateState === "active" && fateResist) fateResist.focus();
    },
    beforeShow: resetFateWindow,
    clampAfterMediaLoad: true,
    afterShow: () => {
      requestAnimationFrame(() => {
        if (fateStart) fateStart.focus();
      });
    },
  });
};

const closeFateWindow = () => {
  closeManagedRandomEventWindow(fateWindow, {
    beforeClose: () => {
      clearFateTimers();
      fateState = "idle";
    },
  });
};

registerRandomEvent({
  id: "resist-your-fate",
  isGameplayLocked: () => isFateVisible() && fateState === "active",
  preloadTargets: () => [
    fateWindow,
    "assets/random%20events/zodd_defeated_by_shld0n_hcks.jpg",
    "assets/random%20events/guts-lost.jpeg",
  ],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isFateVisible,
  canTrigger: () => fateState === "idle" && !isFateVisible(),
  run: () => {
    showFateWindow();
  },
  bind: () => {
    if (fateStart) {
      fateStart.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startFateMinigame();
      });
    }

    if (fateResist) {
      fateResist.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        resistFate();
      });
    }

    if (fateResultOk) {
      fateResultOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeFateWindow();
      });
    }

    bindRandomEventButton(fateTitleClose, closeFateWindow);

    document.addEventListener("keydown", handleFateKeyMash);

    bindManagedRandomEventWindowAnimation(fateWindow, {
      afterClose: () => {
        if (fateResultImage) fateResultImage.removeAttribute("src");
      },
    });
  },
});

// Resisting Fate is the minigame's own input, never a desktop click the
// runtime should count towards the next event.
registerRandomEventClickSource({
  matches: (target) => Boolean(target?.closest("#fate-resist")),
  claim: () => {},
});
// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  fateWindow,
]);

window.homeEventFate = Object.freeze({
  FATE_DRAIN_AMOUNT,
  FATE_DRAIN_INTERVAL_MS,
  FATE_LIGHTNING_DURATION_MS,
  FATE_PRESS_GAIN,
  FATE_START_PROGRESS,
  fateState,
  fateWindow,
  isFateVisible,
});
})();