(() => {
const {
  byId,
} = window.homeDom;
const {
  FATE_DRAIN_AMOUNT,
  FATE_DRAIN_INTERVAL_MS,
  FATE_LIGHTNING_DURATION_MS,
  FATE_PRESS_GAIN,
  FATE_START_PROGRESS,
} = window.homeEventFate;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  bindRandomEventButton,
  clampRandomEventWindowToViewport,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  positionRandomEventWindowInViewport,
  recordGeneralRandomEventClick,
  registerRandomEvent,
  registerRandomEventClickSource,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clampNumber,
  debounceTimer,
} = window.homeUtil;
const {
  YELLOW_LIGHTNING_PALETTE,
  clearLightningCanvas,
  drawLightningBorderFrame,
} = window.homeEventLightning;
const {
  loadDeferredMedia,
} = window.homeActivation;
const {
  registerMediaPauseGuard,
} = window.homeWindows;

const lancerBattleWindow = byId("lancer-battle-window");
const lancerBattleTitle = byId("lancer-battle-title");
const lancerBattleTitleClose = byId("lancer-battle-title-close");
const lancerBattleReadyStage = byId("lancer-battle-ready-stage");
const lancerBattleClashStage = byId("lancer-battle-clash-stage");
const lancerBattleResultStage = byId("lancer-battle-result-stage");
const lancerBattleFinalStage = byId("lancer-battle-final-stage");
const lancerBattleClashVideo = byId("lancer-battle-clash-video");
const lancerBattleLightningCanvas = byId("lancer-battle-lightning-canvas");
const lancerBattleProgress = byId("lancer-battle-progress");
const lancerBattleProgressBar = byId("lancer-battle-progress-bar");
const lancerBattleStatus = byId("lancer-battle-status");
const lancerBattleStart = byId("lancer-battle-start");
const lancerBattlePush = byId("lancer-battle-push");
const lancerBattleResultImage = byId("lancer-battle-result-image");
const lancerBattleResultVideo = byId("lancer-battle-result-video");
const lancerBattleResultText = byId("lancer-battle-result-text");
const lancerBattleFinalText = byId("lancer-battle-final-text");
const lancerBattleClose = byId("lancer-battle-close");

let lancerBattleProgressValue = 0;

let lancerBattleState = "idle";

let lancerBattleDrainTimer = null;

let lancerBattleClashTimer = null;

let lancerBattleBoomerangFrame = null;

let lancerBattleLightningFrame = null;

let lancerBattleLightningTimer = null;

let lancerBattleResolveTimer = null;

let lancerBattleResultTimer = null;

let lancerBattleResultVideoToken = 0;

let lancerBattleOpenFinalAfterClose = false;

let lancerBattleBoomerangDirection = 1;

let lancerBattleBoomerangStart = 0;

let lancerBattleBoomerangEnd = 0;

const LANCER_BATTLE_WIN_VIDEO_START_SECONDS = 29.5;

const LANCER_BATTLE_WIN_VIDEO_END_SECONDS = 36.5;

const LANCER_BATTLE_WIN_VIDEO_SRC =
  "assets/random%20events/lancer-battle/lancer-battle-win.mp4";

const LANCER_BATTLE_LOSS_VIDEO_START_SECONDS = 21.5;

const LANCER_BATTLE_LOSS_VIDEO_END_SECONDS = 25;

const LANCER_BATTLE_LOSS_VIDEO_SRC =
  "assets/random%20events/lancer-battle/lancer-battle-loss.mp4";

const LANCER_BATTLE_START_PROGRESS = FATE_START_PROGRESS;

const LANCER_BATTLE_PUSH_GAIN = FATE_PRESS_GAIN;

const LANCER_BATTLE_DRAIN_INTERVAL_MS = FATE_DRAIN_INTERVAL_MS;

const LANCER_BATTLE_DRAIN_AMOUNT = FATE_DRAIN_AMOUNT;

const LANCER_BATTLE_FALLBACK_CLASH_MS = 3600;

const LANCER_BATTLE_BOOMERANG_SECONDS = 0.5;

const LANCER_BATTLE_BOOMERANG_START_BUFFER_SECONDS = 0.05;

const LANCER_BATTLE_BOOMERANG_STEP = 0.033;

const LANCER_BATTLE_CLICK_COUNTER_PROBABILITY = 0.4;

const LANCER_BATTLE_WIN_CLIP_MS =
  (LANCER_BATTLE_WIN_VIDEO_END_SECONDS - LANCER_BATTLE_WIN_VIDEO_START_SECONDS) * 1000;

const LANCER_BATTLE_LOSS_CLIP_MS =
  (LANCER_BATTLE_LOSS_VIDEO_END_SECONDS - LANCER_BATTLE_LOSS_VIDEO_START_SECONDS) * 1000;

const LANCER_BATTLE_STAGES = Object.freeze({
  ready: "ready",
  intro: "intro",
  active: "active",
  resolving: "resolving",
  win: "win",
  loss: "loss",
  final: "final",
  idle: "idle",
});

const isLancerBattleVisible = () =>
  isManagedRandomEventWindowVisible(lancerBattleWindow);

const shouldKeepLancerBattleResultMediaPlaying = (win) =>
  win === lancerBattleWindow &&
  (lancerBattleState === LANCER_BATTLE_STAGES.win ||
    lancerBattleState === LANCER_BATTLE_STAGES.loss);

const setLancerBattleStatus = (message) => {
  if (lancerBattleStatus) lancerBattleStatus.textContent = message;
};

const showLancerBattleStage = (stage) => {
  lancerBattleReadyStage?.classList.toggle("is-hidden", stage !== "ready");
  lancerBattleClashStage?.classList.toggle("is-hidden", stage !== "clash");
  lancerBattleResultStage?.classList.toggle("is-hidden", stage !== "result");
  lancerBattleFinalStage?.classList.toggle("is-hidden", stage !== "final");
  lancerBattleWindow?.classList.toggle("is-ready", stage === "ready");
};

const updateLancerBattleProgress = () => {
  const progress = clampNumber(lancerBattleProgressValue, 0, 100);
  if (lancerBattleProgressBar) {
    lancerBattleProgressBar.style.width = `${progress}%`;
  }
  if (lancerBattleProgress) {
    lancerBattleProgress.setAttribute("aria-valuenow", Math.round(progress));
  }
};

const clearLancerBattleVideo = () => {
  if (!lancerBattleClashVideo) return;
  lancerBattleClashVideo.pause();
  lancerBattleClashVideo.currentTime = 0;
};

const clearLancerBattleLightning = () => {
  if (lancerBattleLightningFrame) {
    cancelAnimationFrame(lancerBattleLightningFrame);
    lancerBattleLightningFrame = null;
  }
  clearLightningCanvas(lancerBattleLightningCanvas);
};

const clearLancerBattleTimers = () => {
  if (lancerBattleDrainTimer) {
    clearInterval(lancerBattleDrainTimer);
    lancerBattleDrainTimer = null;
  }
  if (lancerBattleClashTimer) {
    clearTimeout(lancerBattleClashTimer);
    lancerBattleClashTimer = null;
  }
  if (lancerBattleLightningTimer) {
    clearTimeout(lancerBattleLightningTimer);
    lancerBattleLightningTimer = null;
  }
  if (lancerBattleBoomerangFrame) {
    cancelAnimationFrame(lancerBattleBoomerangFrame);
    lancerBattleBoomerangFrame = null;
  }
  if (lancerBattleResolveTimer) {
    clearTimeout(lancerBattleResolveTimer);
    lancerBattleResolveTimer = null;
  }
  if (lancerBattleResultTimer) {
    clearTimeout(lancerBattleResultTimer);
    lancerBattleResultTimer = null;
  }
  lancerBattleWindow?.classList.remove("is-striking");
  clearLancerBattleLightning();
};

const clearLancerBattleResultMedia = () => {
  lancerBattleResultVideoToken += 1;
  if (lancerBattleResultImage) {
    lancerBattleResultImage.removeAttribute("src");
    lancerBattleResultImage.classList.remove("is-hidden");
  }
  if (lancerBattleResultVideo) {
    lancerBattleResultVideo.pause();
    lancerBattleResultVideo.removeAttribute("src");
    lancerBattleResultVideo.load();
    lancerBattleResultVideo.classList.add("is-hidden");
  }
};

const playLancerBattleResultVideo = (src, token, onPlaybackStarted = () => {}) => {
  let hasStartedPlayback = false;
  const markStarted = () => {
    if (token !== lancerBattleResultVideoToken) return;
    if (hasStartedPlayback) return;
    hasStartedPlayback = true;
    onPlaybackStarted();
  };
  if (lancerBattleResultImage) {
    lancerBattleResultImage.removeAttribute("src");
    lancerBattleResultImage.classList.add("is-hidden");
  }
  lancerBattleResultVideo.pause();
  lancerBattleResultVideo.currentTime = 0;
  lancerBattleResultVideo.src = `${src}${src.includes("?") ? "&" : "?"}replay=${Date.now()}`;
  lancerBattleResultVideo.classList.remove("is-hidden");
  lancerBattleResultVideo.addEventListener("playing", markStarted, { once: true });
  const playRequest = lancerBattleResultVideo.play();
  if (playRequest && typeof playRequest.then === "function") {
    playRequest.then(markStarted).catch(markStarted);
  } else {
    markStarted();
  }
};

const setLancerBattleResultVideo = (src, options = {}) => {
  if (!lancerBattleResultVideo) return;
  lancerBattleResultVideoToken += 1;
  playLancerBattleResultVideo(src, lancerBattleResultVideoToken, options.onPlaybackStarted);
};

const resetLancerBattleWindow = () => {
  clearLancerBattleTimers();
  clearLancerBattleVideo();
  lancerBattleOpenFinalAfterClose = false;
  lancerBattleState = LANCER_BATTLE_STAGES.ready;
  lancerBattleProgressValue = LANCER_BATTLE_START_PROGRESS;
  lancerBattleBoomerangDirection = 1;
  lancerBattleBoomerangStart = 0;
  lancerBattleBoomerangEnd = 0;
  updateLancerBattleProgress();
  lancerBattleWindow?.classList.remove(
    "is-clashing",
    "is-win",
    "is-loss",
    "is-final-alert"
  );
  if (lancerBattleTitle) lancerBattleTitle.textContent = "Lancer Duel";
  if (lancerBattlePush) {
    lancerBattlePush.disabled = true;
    lancerBattlePush.textContent = "Fight Back";
  }
  if (lancerBattleClose) lancerBattleClose.textContent = "Close";
  setLancerBattleStatus("Wait for the clash.");
  clearLancerBattleResultMedia();
  if (lancerBattleResultText) lancerBattleResultText.textContent = "";
  if (lancerBattleFinalText) lancerBattleFinalText.textContent = "";
  showLancerBattleStage("ready");
};

const startLancerBattleLightningStrike = () => {
  if (!lancerBattleLightningCanvas || !isLancerBattleVisible()) return;
  if (lancerBattleLightningFrame) cancelAnimationFrame(lancerBattleLightningFrame);
  const startedAt = performance.now();

  const render = (now) => {
    if (!isLancerBattleVisible()) {
      clearLancerBattleLightning();
      return;
    }
    const progress = Math.min(1, (now - startedAt) / FATE_LIGHTNING_DURATION_MS);
    const flicker = progress < 0.16 ? 1 : Math.random() > 0.32 ? 1 - progress * 0.42 : 0.18;
    const alpha = Math.max(0, flicker * (1 - progress * 0.36));
    drawLightningBorderFrame(
      lancerBattleLightningCanvas,
      alpha,
      YELLOW_LIGHTNING_PALETTE
    );

    if (progress < 1) {
      lancerBattleLightningFrame = requestAnimationFrame(render);
      return;
    }

    lancerBattleLightningFrame = null;
    clearLightningCanvas(lancerBattleLightningCanvas);
  };

  lancerBattleLightningFrame = requestAnimationFrame(render);
};

const pulseLancerBattleWindow = () => {
  if (!lancerBattleWindow) return;
  lancerBattleWindow.classList.remove("is-striking");
  void lancerBattleWindow.offsetWidth;
  lancerBattleWindow.classList.add("is-striking");
  startLancerBattleLightningStrike();
  lancerBattleLightningTimer = debounceTimer(lancerBattleLightningTimer, () => {
    lancerBattleWindow.classList.remove("is-striking");
    lancerBattleLightningTimer = null;
  }, 240);
};

const updateLancerBattleBoomerangFrame = () => {
  if (
    !lancerBattleClashVideo ||
    lancerBattleState !== LANCER_BATTLE_STAGES.active
  ) {
    lancerBattleBoomerangFrame = null;
    return;
  }

  const current = lancerBattleClashVideo.currentTime;
  if (current >= lancerBattleBoomerangEnd) {
    lancerBattleBoomerangDirection = -1;
  } else if (current <= lancerBattleBoomerangStart) {
    lancerBattleBoomerangDirection = 1;
  }
  const nextTime =
    current + LANCER_BATTLE_BOOMERANG_STEP * lancerBattleBoomerangDirection;
  lancerBattleClashVideo.currentTime = clampNumber(
    nextTime,
    lancerBattleBoomerangStart,
    lancerBattleBoomerangEnd
  );
  lancerBattleBoomerangFrame = requestAnimationFrame(
    updateLancerBattleBoomerangFrame
  );
};

const startLancerBattleBoomerang = () => {
  if (!lancerBattleClashVideo) return;
  const duration = Number.isFinite(lancerBattleClashVideo.duration)
    ? lancerBattleClashVideo.duration
    : 0;
  lancerBattleBoomerangEnd = Math.max(0.2, duration || lancerBattleClashVideo.currentTime);
  lancerBattleBoomerangStart = Math.max(
    0,
    lancerBattleBoomerangEnd - LANCER_BATTLE_BOOMERANG_SECONDS
  );
  lancerBattleBoomerangDirection = 1;
  lancerBattleClashVideo.pause();
  lancerBattleClashVideo.currentTime = lancerBattleBoomerangStart;
  if (lancerBattleBoomerangFrame) {
    cancelAnimationFrame(lancerBattleBoomerangFrame);
  }
  lancerBattleBoomerangFrame = requestAnimationFrame(
    updateLancerBattleBoomerangFrame
  );
};

const showLancerBattleFinalPrompt = (success) => {
  if (!success) {
    closeLancerBattleWindow();
    return;
  }
  lancerBattleState = LANCER_BATTLE_STAGES.final;
  lancerBattleWindow?.classList.add("is-final-alert");
  if (lancerBattleTitle) {
    lancerBattleTitle.textContent = "Duel Won";
  }
  clearLancerBattleResultMedia();
  if (lancerBattleFinalText) {
    lancerBattleFinalText.textContent = "Good job, Gear.";
  }
  if (lancerBattleClose) lancerBattleClose.textContent = "OK";
  showLancerBattleStage("final");
  requestAnimationFrame(() => {
    lancerBattleClose?.focus({ preventScroll: true });
  });
};

const reopenLancerBattleFinalPrompt = () => {
  showManagedRandomEventWindow(lancerBattleWindow, {
    isVisible: () => false,
    beforeShow: () => showLancerBattleFinalPrompt(true),
    position: (win) => {
      positionRandomEventWindowInViewport(win);
      clampRandomEventWindowToViewport(win);
    },
  });
};

const transitionLancerBattleWinToFinalPrompt = () => {
  const closing = closeManagedRandomEventWindow(lancerBattleWindow, {
    beforeClose: () => {
      lancerBattleOpenFinalAfterClose = true;
    },
  });
  if (!closing) showLancerBattleFinalPrompt(true);
};

const queueLancerBattleResultCompletion = (success) => {
  if (lancerBattleResultTimer) {
    clearTimeout(lancerBattleResultTimer);
  }
  lancerBattleResultTimer = setTimeout(() => {
    lancerBattleResultTimer = null;
    if (success) {
      transitionLancerBattleWinToFinalPrompt();
    } else {
      closeLancerBattleWindow();
    }
  }, success ? LANCER_BATTLE_WIN_CLIP_MS : LANCER_BATTLE_LOSS_CLIP_MS);
};

const showLancerBattleResult = (success) => {
  lancerBattleState = success ? LANCER_BATTLE_STAGES.win : LANCER_BATTLE_STAGES.loss;
  lancerBattleWindow?.classList.toggle("is-win", success);
  lancerBattleWindow?.classList.toggle("is-loss", !success);
  if (lancerBattleTitle) {
    lancerBattleTitle.textContent = success ? "Enemy Executed" : "You get Overwhelmed";
  }
  if (success) {
    setLancerBattleResultVideo(LANCER_BATTLE_WIN_VIDEO_SRC, {
      onPlaybackStarted: () => queueLancerBattleResultCompletion(true),
    });
  } else {
    setLancerBattleResultVideo(LANCER_BATTLE_LOSS_VIDEO_SRC, {
      onPlaybackStarted: () => queueLancerBattleResultCompletion(false),
    });
  }
  if (lancerBattleResultText) {
    lancerBattleResultText.textContent = success ? "Marcus wins the blade lock." : "";
  }
  showLancerBattleStage("result");
};

const finishLancerBattle = (success) => {
  if (lancerBattleState !== LANCER_BATTLE_STAGES.active) return;
  lancerBattleState = LANCER_BATTLE_STAGES.resolving;
  clearLancerBattleTimers();
  clearLancerBattleVideo();
  lancerBattleWindow?.classList.remove("is-clashing");
  lancerBattleProgressValue = success ? 100 : 0;
  updateLancerBattleProgress();
  if (lancerBattlePush) lancerBattlePush.disabled = true;
  lancerBattleResolveTimer = setTimeout(() => {
    lancerBattleResolveTimer = null;
    showLancerBattleResult(success);
  }, 420);
};

const tickLancerBattleDrain = () => {
  if (lancerBattleState !== LANCER_BATTLE_STAGES.active) return;
  lancerBattleProgressValue = Math.max(
    0,
    lancerBattleProgressValue - LANCER_BATTLE_DRAIN_AMOUNT
  );
  updateLancerBattleProgress();
  if (lancerBattleProgressValue <= 0) finishLancerBattle(false);
};

const startLancerBattleDrain = () => {
  if (lancerBattleDrainTimer) clearInterval(lancerBattleDrainTimer);
  lancerBattleDrainTimer = setInterval(
    tickLancerBattleDrain,
    LANCER_BATTLE_DRAIN_INTERVAL_MS
  );
};

const enterLancerBattleClash = () => {
  if (lancerBattleState !== LANCER_BATTLE_STAGES.intro) return;
  lancerBattleState = LANCER_BATTLE_STAGES.active;
  lancerBattleProgressValue = LANCER_BATTLE_START_PROGRESS;
  updateLancerBattleProgress();
  lancerBattleWindow?.classList.add("is-clashing");
  if (lancerBattlePush) {
    lancerBattlePush.disabled = false;
    lancerBattlePush.focus({ preventScroll: true });
  }
  setLancerBattleStatus("Fight back through the Lancer lock!");
  startLancerBattleBoomerang();
  startLancerBattleDrain();
};

const scheduleLancerBattleClash = () => {
  if (lancerBattleClashTimer) clearTimeout(lancerBattleClashTimer);
  const durationMs =
    lancerBattleClashVideo && Number.isFinite(lancerBattleClashVideo.duration)
      ? Math.max(
          800,
          (
            lancerBattleClashVideo.duration -
            LANCER_BATTLE_BOOMERANG_SECONDS -
            LANCER_BATTLE_BOOMERANG_START_BUFFER_SECONDS
          ) * 1000
        )
      : LANCER_BATTLE_FALLBACK_CLASH_MS;
  lancerBattleClashTimer = setTimeout(() => {
    lancerBattleClashTimer = null;
    enterLancerBattleClash();
  }, durationMs);
};

const startLancerBattle = () => {
  if (lancerBattleState !== LANCER_BATTLE_STAGES.ready) return;
  lancerBattleState = LANCER_BATTLE_STAGES.intro;
  if (lancerBattleTitle) lancerBattleTitle.textContent = "Chainsaw Clash";
  showLancerBattleStage("clash");
  setLancerBattleStatus("The blades are biting...");
  if (lancerBattlePush) {
    lancerBattlePush.disabled = true;
  }
  loadDeferredMedia(lancerBattleWindow);
  if (lancerBattleClashVideo) {
    lancerBattleClashVideo.currentTime = 0;
    const playRequest = lancerBattleClashVideo.play();
    if (playRequest && typeof playRequest.catch === "function") {
      playRequest.catch(() => {});
    }
    if (lancerBattleClashVideo.readyState >= 1) {
      scheduleLancerBattleClash();
    } else {
      lancerBattleClashVideo.addEventListener(
        "loadedmetadata",
        scheduleLancerBattleClash,
        { once: true }
      );
      lancerBattleClashTimer = setTimeout(() => {
        lancerBattleClashTimer = null;
        enterLancerBattleClash();
      }, LANCER_BATTLE_FALLBACK_CLASH_MS);
    }
  } else {
    lancerBattleClashTimer = setTimeout(
      enterLancerBattleClash,
      LANCER_BATTLE_FALLBACK_CLASH_MS
    );
  }
};

const pushLancerBattle = () => {
  if (lancerBattleState !== LANCER_BATTLE_STAGES.active) return;
  lancerBattleProgressValue = Math.min(
    100,
    lancerBattleProgressValue + LANCER_BATTLE_PUSH_GAIN
  );
  updateLancerBattleProgress();
  setLancerBattleStatus("Keep fighting back!");
  pulseLancerBattleWindow();
  if (lancerBattleProgressValue >= 100) finishLancerBattle(true);
};

const handleLancerBattleKeyMash = (event) => {
  if (lancerBattleState !== LANCER_BATTLE_STAGES.active) return;
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  event.preventDefault();
  pushLancerBattle();
};

const showLancerBattleWindow = () => {
  showManagedRandomEventWindow(lancerBattleWindow, {
    onFront: () => clampRandomEventWindowToViewport(lancerBattleWindow),
    beforeShow: resetLancerBattleWindow,
    clampAfterMediaLoad: true,
    afterShow: () => {
      requestAnimationFrame(() => {
        lancerBattleStart?.focus({ preventScroll: true });
      });
    },
  });
};

const closeLancerBattleWindow = () => {
  closeManagedRandomEventWindow(lancerBattleWindow, {
    beforeClose: () => {
      lancerBattleOpenFinalAfterClose = false;
      clearLancerBattleTimers();
      clearLancerBattleVideo();
      clearLancerBattleResultMedia();
      lancerBattleState = LANCER_BATTLE_STAGES.idle;
    },
  });
};

registerRandomEvent({
  id: "lancer-battle",
  isGameplayLocked: () =>
    isLancerBattleVisible() && lancerBattleState === LANCER_BATTLE_STAGES.active,
  preloadTargets: () => [
    lancerBattleWindow,
  ],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isLancerBattleVisible,
  canTrigger: () =>
    lancerBattleState === LANCER_BATTLE_STAGES.idle && !isLancerBattleVisible(),
  run: () => {
    showLancerBattleWindow();
  },
  bind: () => {
    bindRandomEventButton(lancerBattleStart, startLancerBattle);
    bindRandomEventButton(lancerBattlePush, pushLancerBattle);
    bindRandomEventButton(lancerBattleTitleClose, closeLancerBattleWindow);
    bindRandomEventButton(lancerBattleClose, closeLancerBattleWindow);
    document.addEventListener("keydown", handleLancerBattleKeyMash);

    bindManagedRandomEventWindowAnimation(lancerBattleWindow, {
      closingClasses: ["is-clashing", "is-win", "is-loss", "is-final-alert"],
      afterClose: () => {
        clearLancerBattleResultMedia();
        clearLancerBattleVideo();
        if (!lancerBattleOpenFinalAfterClose) return;
        lancerBattleOpenFinalAfterClose = false;
        reopenLancerBattleFinalPrompt();
      },
    });
  },
});

// Fighting back counts towards the next event only part of the time, so a
// long clash does not guarantee one.
registerRandomEventClickSource({
  matches: (target) => Boolean(target?.closest("#lancer-battle-push")),
  claim: () => {
    if (Math.random() < LANCER_BATTLE_CLICK_COUNTER_PROBABILITY) {
      recordGeneralRandomEventClick({ source: "lancer-battle-fight-back" });
    }
  },
});
// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  lancerBattleWindow,
]);

// The victory clip keeps playing while the window loses focus, so the result
// is not cut short by a click elsewhere on the desktop.
registerMediaPauseGuard(shouldKeepLancerBattleResultMediaPlaying);

window.homeEventLancerBattle = Object.freeze({
  LANCER_BATTLE_CLICK_COUNTER_PROBABILITY,
  LANCER_BATTLE_STAGES,
  isLancerBattleVisible,
  lancerBattleState,
  lancerBattleWindow,
  shouldKeepLancerBattleResultMediaPlaying,
});
})();
