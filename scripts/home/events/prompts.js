(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  RANDOM_EVENT_KIND_NON_INTERACTIVE,
  SYSTEM_ALERTS,
  bindManagedRandomEventWindowAnimation,
  bindRandomEventButton,
  clampRandomEventWindowToViewport,
  closeManagedRandomEventWindow,
  getRandomEventWindowBounds,
  getRandomEventWindowPosition,
  isManagedRandomEventWindowVisible,
  positionRandomEventWindowInViewport,
  registerRandomEvent,
  registerRandomEventWindows,
  sampleRandomEventPosition,
  setRandomEventWindowPosition,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clampNumber,
  debounceTimer,
  padTwoDigits,
  prefersReducedMotion,
  reducedMotionQuery,
} = window.homeUtil;
const {
  NEKO_SLEEP_FRAME_INTERVAL_MS,
  NEKO_SPRITES,
  startNekoStream,
} = window.homeNeko;
const {
  SKILL_CHECK_DIGIT_SOURCES,
} = window.homeEventSkillCheck;
const {
  calendarPopout,
  openCalendar,
} = window.homeCalendar;
const {
  RED_LIGHTNING_PALETTE,
  clearLightningCanvas,
  drawLightningBorderFrame,
} = window.homeEventLightning;
const {
  unloadDeferredImages,
} = window.homeActivation;
const {
  nextWindowZIndex,
} = window.homeWindows;

const randomAlertWindow = byId("random-alert-window");
const randomAlertClose = byId("random-alert-close");
const randomAlertMaximize = byId("random-alert-maximize");
const randomAlertMinimize = byId("random-alert-minimize");
const randomAlertYes = byId("random-alert-yes");
const randomAlertNo = byId("random-alert-no");
const randomAlertRememberRow = byId("random-alert-remember-row");
const randomAlertRemember = byId("random-alert-remember");
const debugSystemAlertWindow = byId("debug-system-alert-window");
const nekoStreamAlertWindow = byId("neko-stream-alert-window");
const nekoStreamAlertIcon = byId("neko-stream-alert-icon");
const nekoStreamAlertYes = byId("neko-stream-alert-yes");
const nekoStreamAlertNo = byId("neko-stream-alert-no");
const vanishingPopupWindow = byId("vanishing-popup-window");
const vanishingPopupClose = byId("vanishing-popup-close");
const vanishingPopupMaximize = byId("vanishing-popup-maximize");
const vanishingPopupMinimize = byId("vanishing-popup-minimize");
const vanishingPopupYes = byId("vanishing-popup-yes");
const vanishingPopupNo = byId("vanishing-popup-no");
const vanishingPopupExplosion = byId("vanishing-popup-explosion");
const dodgingPopupWindow = byId("dodging-popup-window");
const rohinUpdateWindow = byId("rohin-update-window");
const rohinUpdateRun = byId("rohin-update-run");
const rohinUpdateLater = byId("rohin-update-later");
const mcAfeePromptWindow = byId("mcafee-prompt-window");
const mcAfeeDownloadWindow = byId("mcafee-download-window");
const mcAfeeThanksWindow = byId("mcafee-thanks-window");
const mcAfeeUpdateRun = byId("mcafee-update-run");
const mcAfeeUpdateLater = byId("mcafee-update-later");
const mcAfeeProgress = byId("mcafee-progress");
const mcAfeeProgressBar = byId("mcafee-progress-bar");
const mcAfeeDownloadStatus = byId("mcafee-download-status");
const mcAfeeComplete = byId("mcafee-complete");
const mcAfeeThanksOk = byId("mcafee-thanks-ok");
const midnightGospelInviteWindow = byId("midnight-gospel-invite-window");
const midnightGospelYes = byId("midnight-gospel-yes");
const midnightGospelNo = byId("midnight-gospel-no");
const midnightGospelMeditationWindow = byId("midnight-gospel-meditation-window");
const midnightGospelTimer = byId("midnight-gospel-timer");
const midnightGospelTimerTens = byId("midnight-gospel-timer-tens");
const midnightGospelTimerOnes = byId("midnight-gospel-timer-ones");
const midnightGospelBegin = byId("midnight-gospel-begin");
const calendarReminderWindow = byId("calendar-reminder-window");
const calendarReminderShow = byId("calendar-reminder-show");
const calendarReminderLater = byId("calendar-reminder-later");
const instrumentalityWindow = byId("instrumentality-window");
const instrumentalityYes = byId("instrumentality-yes");
const instrumentalityNo = byId("instrumentality-no");
const instrumentalityCongratsWindow = byId("instrumentality-congrats-window");
const instrumentalityCongratsOk = byId("instrumentality-congrats-ok");
const wallBreachWindow = byId("wall-breach-window");
const wallBreachSuitUp = byId("wall-breach-suit-up");
const spellStackWindow = byId("spell-stack-window");
const spellStackLightningCanvas = byId("spell-stack-lightning-canvas");
const spellStackYes = byId("spell-stack-yes");
const spellStackNo = byId("spell-stack-no");
const nobleSteedWindow = byId("noble-steed-window");
const nobleSteedYes = byId("noble-steed-yes");
const nobleSteedNo = byId("noble-steed-no");
const nobleSteedResultWindow = byId("noble-steed-result-window");
const nobleSteedResultOk = byId("noble-steed-result-ok");
const bidenBlastWindow = byId("biden-blast-window");
const bidenBlastOk = byId("biden-blast-ok");

let randomAlertReopenTimer = null;

let randomAlertFlashTimer = null;

let vanishingPopupCloseTimer = null;

let dodgingPopupAttempts = 0;

let dodgingPopupDirectAttempts = 0;

let dodgingPopupFinalDodgeComplete = false;

let dodgingPopupSlideTimer = null;

let dodgingPopupAutoCloseTimer = null;

let mcAfeeProgressValue = 0;

let mcAfeeProgressTimer = null;

let mcAfeeDotsTimer = null;

let mcAfeeDotsFrame = 0;

const WALL_BREACH_SHAKE_INTERVAL_MS = 1500;

const WALL_BREACH_SHAKE_DURATION_MS = 360;

const WALL_BREACH_FLASH_DURATION_MS = 760;

let wallBreachSequenceActive = false;

let spellStackLightningFrame = null;

let spellStackLightningTimer = null;

let nobleSteedResultTimer = null;

let nobleSteedResultPosition = null;

let debugSystemAlertActiveId = "";

let debugSystemAlertFocusReturn = null;

let nekoStreamAlertFocusReturn = null;

let nekoStreamAlertIconFrame = 0;

let nekoStreamAlertIconTimerId = null;

let nekoStreamAlertResponsePending = false;

const isDebugSystemAlertVisible = () =>
  isManagedRandomEventWindowVisible(debugSystemAlertWindow);

const debugSystemAlertReducedMotionQuery = reducedMotionQuery;

const resetDebugSystemAlert = () => {
  debugSystemAlertActiveId = "";
  if (debugSystemAlertWindow) delete debugSystemAlertWindow.dataset.alertId;
  const focusTarget = debugSystemAlertFocusReturn;
  debugSystemAlertFocusReturn = null;
  if (
    focusTarget?.isConnected &&
    !focusTarget.closest("[inert]") &&
    typeof focusTarget.focus === "function"
  ) {
    focusTarget.focus({ preventScroll: true });
  }
  if (debugSystemAlertWindow?.contains(document.activeElement)) {
    document.activeElement.blur();
  }
};

const renderDebugSystemAlert = (
  alert,
  {
    root = debugSystemAlertWindow,
    interactive = root === debugSystemAlertWindow,
  } = {}
) => {
  if (!alert || !root) return [];
  const title = root.querySelector("#debug-system-alert-title");
  const icon = root.querySelector("#debug-system-alert-icon");
  const message = root.querySelector("#debug-system-alert-message");
  const actions = root.querySelector("#debug-system-alert-actions");
  if (title) title.textContent = alert.title;
  if (icon) icon.src = alert.icon;
  if (message) message.textContent = alert.body;
  if (!actions) return [];

  actions.dataset.buttonAlignment = alert.buttonAlignment;
  const buttons = alert.buttons.map((buttonDefinition) => {
    const button = actions.ownerDocument.createElement("button");
    button.type = "button";
    button.className = "debug-system-alert-action";
    button.dataset.systemAlertButtonId = buttonDefinition.id;
    button.dataset.systemAlertAction = buttonDefinition.action;
    button.textContent = buttonDefinition.label;
    if (interactive && buttonDefinition.action === "dismiss") {
      bindRandomEventButton(button, closeDebugSystemAlert);
    }
    return button;
  });
  actions.replaceChildren(...buttons);
  root.dataset.alertId = alert.id;
  return buttons;
};

const showDebugSystemAlert = (alert) => {
  if (!alert) return false;

  const focusReturn =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let actionButtons = [];
  const didOpen = showManagedRandomEventWindow(debugSystemAlertWindow, {
    beforeShow: () => {
      actionButtons = renderDebugSystemAlert(alert);
    },
    clampAfterMediaLoad: true,
  });
  if (!didOpen) return false;

  debugSystemAlertActiveId = alert.id;
  debugSystemAlertFocusReturn = focusReturn;
  if (debugSystemAlertReducedMotionQuery?.matches) {
    debugSystemAlertWindow.classList.remove("is-opening");
  }
  requestAnimationFrame(() => actionButtons[0]?.focus({ preventScroll: true }));
  return true;
};

const closeDebugSystemAlert = () => {
  closeManagedRandomEventWindow(debugSystemAlertWindow);
  if (!debugSystemAlertReducedMotionQuery?.matches || !debugSystemAlertWindow) return;
  debugSystemAlertWindow.classList.remove("is-closing");
  debugSystemAlertWindow.classList.add("is-hidden");
  resetDebugSystemAlert();
};

const isNekoStreamAlertVisible = () =>
  isManagedRandomEventWindowVisible(nekoStreamAlertWindow);

const nekoStreamAlertReducedMotionQuery = reducedMotionQuery;

const prefersReducedNekoStreamAlertMotion = prefersReducedMotion;

const setNekoStreamAlertIconFrame = () => {
  if (!nekoStreamAlertIcon) return;
  const sprite = nekoStreamAlertIconFrame % 2 === 0
    ? NEKO_SPRITES.sleep1
    : NEKO_SPRITES.sleep2;
  if (nekoStreamAlertIcon.getAttribute("src") !== sprite) {
    nekoStreamAlertIcon.src = sprite;
  }
};

const stopNekoStreamAlertIconAnimation = () => {
  if (nekoStreamAlertIconTimerId !== null) {
    window.clearInterval(nekoStreamAlertIconTimerId);
  }
  nekoStreamAlertIconTimerId = null;
};

const restoreNekoStreamAlertFocus = () => {
  const focusTarget = nekoStreamAlertFocusReturn;
  nekoStreamAlertFocusReturn = null;
  if (
    focusTarget?.isConnected &&
    !focusTarget.closest("[inert]") &&
    typeof focusTarget.focus === "function"
  ) {
    focusTarget.focus({ preventScroll: true });
  }
  if (nekoStreamAlertWindow?.contains(document.activeElement)) {
    document.activeElement.blur();
  }
};

const startNekoStreamAlertIconAnimation = () => {
  stopNekoStreamAlertIconAnimation();
  nekoStreamAlertIconFrame = 0;
  setNekoStreamAlertIconFrame();
  if (prefersReducedNekoStreamAlertMotion()) return;
  nekoStreamAlertIconTimerId = window.setInterval(() => {
    if (!isNekoStreamAlertVisible()) {
      stopNekoStreamAlertIconAnimation();
      return;
    }
    nekoStreamAlertIconFrame += 1;
    setNekoStreamAlertIconFrame();
  }, NEKO_SLEEP_FRAME_INTERVAL_MS);
};

const resetNekoStreamAlert = () => {
  stopNekoStreamAlertIconAnimation();
  nekoStreamAlertResponsePending = false;
  restoreNekoStreamAlertFocus();
};

const handleNekoStreamAlertMotionPreferenceChange = () => {
  if (!prefersReducedNekoStreamAlertMotion()) {
    if (isNekoStreamAlertVisible() && nekoStreamAlertResponsePending) {
      startNekoStreamAlertIconAnimation();
    }
    return;
  }

  stopNekoStreamAlertIconAnimation();
  nekoStreamAlertIconFrame = 0;
  setNekoStreamAlertIconFrame();
  if (!nekoStreamAlertWindow) return;

  const wasClosing = nekoStreamAlertWindow.classList.contains("is-closing");
  nekoStreamAlertWindow.classList.remove("is-opening");
  if (!wasClosing) return;
  nekoStreamAlertWindow.classList.remove("is-closing");
  nekoStreamAlertWindow.classList.add("is-hidden");
  resetNekoStreamAlert();
};

const showNekoStreamAlert = () => {
  const focusReturn =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const didOpen = showManagedRandomEventWindow(nekoStreamAlertWindow, {
    beforeShow: () => {
      stopNekoStreamAlertIconAnimation();
      nekoStreamAlertIconFrame = 0;
      setNekoStreamAlertIconFrame();
    },
    clampAfterMediaLoad: true,
  });
  if (!didOpen) return false;

  nekoStreamAlertFocusReturn = focusReturn;
  nekoStreamAlertResponsePending = true;
  startNekoStreamAlertIconAnimation();
  if (prefersReducedNekoStreamAlertMotion()) {
    nekoStreamAlertWindow.classList.remove("is-opening");
  }
  requestAnimationFrame(() => nekoStreamAlertYes?.focus({ preventScroll: true }));
  return true;
};

const respondToNekoStreamAlert = (shouldStartStream) => {
  if (!nekoStreamAlertResponsePending || !isNekoStreamAlertVisible()) return false;
  nekoStreamAlertResponsePending = false;
  stopNekoStreamAlertIconAnimation();
  restoreNekoStreamAlertFocus();
  closeManagedRandomEventWindow(nekoStreamAlertWindow);
  if (prefersReducedNekoStreamAlertMotion()) {
    nekoStreamAlertWindow.classList.remove("is-opening", "is-closing");
    nekoStreamAlertWindow.classList.add("is-hidden");
    resetNekoStreamAlert();
  }
  if (shouldStartStream) startNekoStream();
  return true;
};

const isRandomAlertVisible = () => isManagedRandomEventWindowVisible(randomAlertWindow);

const resetRandomAlertSize = () => {
  if (!randomAlertWindow) return;
  randomAlertWindow.classList.remove("is-expanded");
  randomAlertWindow.style.left = "";
  randomAlertWindow.style.top = "";
  randomAlertWindow.style.width = "";
  randomAlertWindow.style.height = "";
  randomAlertWindow.style.translate = "";
};

const positionRandomAlertWindow = () => {
  if (!randomAlertWindow || randomAlertWindow.classList.contains("is-expanded")) return;
  positionRandomEventWindowInViewport(randomAlertWindow);
};

const hideRandomAlert = () => {
  closeManagedRandomEventWindow(randomAlertWindow, { force: true });
};

const showRandomAlert = ({ showRemember = false } = {}) => {
  if (!randomAlertWindow) return;
  if (randomAlertReopenTimer) {
    clearTimeout(randomAlertReopenTimer);
    randomAlertReopenTimer = null;
  }
  showManagedRandomEventWindow(randomAlertWindow, {
    clearClasses: ["is-choice-flashing"],
    beforeShow: () => {
      resetRandomAlertSize();
      if (randomAlertRememberRow) randomAlertRememberRow.hidden = !showRemember;
      if (randomAlertRemember) randomAlertRemember.checked = false;
    },
    position: positionRandomAlertWindow,
  });
};

const flashRandomAlertChoices = () => {
  if (!randomAlertWindow) return;
  if (randomAlertFlashTimer) clearTimeout(randomAlertFlashTimer);
  randomAlertWindow.classList.add("is-choice-flashing");
  randomAlertFlashTimer = setTimeout(() => {
    randomAlertWindow.classList.remove("is-choice-flashing");
    randomAlertFlashTimer = null;
  }, 300);
};

const respondToRandomAlert = () => {
  if (!randomAlertWindow) return;
  const rememberVisible = randomAlertRememberRow && !randomAlertRememberRow.hidden;
  const rememberChecked = randomAlertRemember && randomAlertRemember.checked;
  hideRandomAlert();
  if (rememberVisible && rememberChecked) {
    return;
  }
  const delay = rememberVisible ? 2000 + Math.random() * 3000 : 1000;
  randomAlertReopenTimer = setTimeout(() => {
    showRandomAlert({ showRemember: true });
  }, delay);
};

const VANISHING_POPUP_EXPLOSION_DURATION_MS = 1800;

const getVanishingPopupButtons = () =>
  vanishingPopupWindow
    ? Array.from(vanishingPopupWindow.querySelectorAll("[data-vanishing-popup-button]"))
    : [];

const isVanishingPopupVisible = () =>
  isManagedRandomEventWindowVisible(vanishingPopupWindow);

const resetVanishingPopup = () => {
  if (!vanishingPopupWindow) return;
  if (vanishingPopupCloseTimer) {
    clearTimeout(vanishingPopupCloseTimer);
    vanishingPopupCloseTimer = null;
  }
  vanishingPopupWindow.classList.remove("is-expanded", "is-exploding");
  vanishingPopupWindow.style.left = "";
  vanishingPopupWindow.style.top = "";
  vanishingPopupWindow.style.width = "";
  vanishingPopupWindow.style.height = "";
  vanishingPopupWindow.style.translate = "";
  getVanishingPopupButtons().forEach((button) => {
    button.hidden = false;
  });
  if (vanishingPopupExplosion) {
    vanishingPopupExplosion.classList.remove("is-active");
    vanishingPopupExplosion.removeAttribute("src");
    vanishingPopupExplosion.removeAttribute("style");
  }
};

const lockVanishingPopupSize = () => {
  if (!vanishingPopupWindow) return;
  const rect = vanishingPopupWindow.getBoundingClientRect();
  vanishingPopupWindow.style.width = `${Math.ceil(rect.width)}px`;
  vanishingPopupWindow.style.height = `${Math.ceil(rect.height)}px`;
};

const closeVanishingPopup = () => {
  closeManagedRandomEventWindow(vanishingPopupWindow, {
    beforeClose: () => {
      if (vanishingPopupCloseTimer) {
        clearTimeout(vanishingPopupCloseTimer);
        vanishingPopupCloseTimer = null;
      }
    },
  });
};

const positionVanishingPopupExplosion = () => {
  if (!vanishingPopupWindow || !vanishingPopupExplosion) return;
  const rect = vanishingPopupWindow.getBoundingClientRect();
  const windowZIndex = Number.parseInt(vanishingPopupWindow.style.zIndex, 10);
  vanishingPopupExplosion.style.left = `${rect.left + rect.width / 2}px`;
  vanishingPopupExplosion.style.top = `${rect.top + rect.height / 2}px`;
  vanishingPopupExplosion.style.zIndex = String(
    Number.isFinite(windowZIndex) ? windowZIndex + 1 : nextWindowZIndex()
  );
};

const startVanishingPopupExplosion = () => {
  if (!vanishingPopupWindow || vanishingPopupWindow.classList.contains("is-exploding")) return;
  vanishingPopupWindow.classList.remove("is-opening");
  vanishingPopupWindow.classList.add("is-exploding");
  if (vanishingPopupExplosion && vanishingPopupExplosion.dataset.src) {
    positionVanishingPopupExplosion();
    vanishingPopupExplosion.classList.add("is-active");
    vanishingPopupExplosion.removeAttribute("src");
    void vanishingPopupExplosion.offsetWidth;
    vanishingPopupExplosion.src = `${vanishingPopupExplosion.dataset.src}?t=${Date.now()}`;
  }
  vanishingPopupCloseTimer = window.setTimeout(
    closeVanishingPopup,
    VANISHING_POPUP_EXPLOSION_DURATION_MS
  );
};

const hideVanishingPopupButton = (button) => {
  if (!button || button.hidden || !vanishingPopupWindow) return;
  button.hidden = true;
  const remainingButtons = getVanishingPopupButtons().filter((candidate) => !candidate.hidden);
  if (!remainingButtons.length) {
    startVanishingPopupExplosion();
  }
};

const showVanishingPopup = () => {
  showManagedRandomEventWindow(vanishingPopupWindow, {
    beforeShow: resetVanishingPopup,
    position: (win) => {
      positionRandomEventWindowInViewport(win);
      lockVanishingPopupSize();
    },
  });
};

const DODGING_POPUP_DODGE_LIMIT = 14;

const DODGING_POPUP_DIRECT_DODGE_LIMIT = 5;

const DODGING_POPUP_SLIDE_DURATION_MS = 360;

const getDodgingPopupButtons = () =>
  dodgingPopupWindow
    ? Array.from(dodgingPopupWindow.querySelectorAll("[data-dodging-popup-button]"))
    : [];

const isDodgingPopupVisible = () =>
  isManagedRandomEventWindowVisible(dodgingPopupWindow);

const clearDodgingPopupTimers = () => {
  if (dodgingPopupSlideTimer) {
    clearTimeout(dodgingPopupSlideTimer);
    dodgingPopupSlideTimer = null;
  }
  if (dodgingPopupAutoCloseTimer) {
    clearTimeout(dodgingPopupAutoCloseTimer);
    dodgingPopupAutoCloseTimer = null;
  }
};

const resetDodgingPopup = () => {
  if (!dodgingPopupWindow) return;
  clearDodgingPopupTimers();
  dodgingPopupAttempts = 0;
  dodgingPopupDirectAttempts = 0;
  dodgingPopupFinalDodgeComplete = false;
  dodgingPopupWindow.classList.remove("is-expanded", "is-dodging");
  dodgingPopupWindow.style.left = "";
  dodgingPopupWindow.style.top = "";
  dodgingPopupWindow.style.width = "";
  dodgingPopupWindow.style.height = "";
  dodgingPopupWindow.style.translate = "";
  getDodgingPopupButtons().forEach((button) => {
    button.hidden = false;
  });
};

const lockDodgingPopupSize = () => {
  if (!dodgingPopupWindow) return;
  const rect = dodgingPopupWindow.getBoundingClientRect();
  dodgingPopupWindow.style.width = `${Math.ceil(rect.width)}px`;
  dodgingPopupWindow.style.height = `${Math.ceil(rect.height)}px`;
};

const getDodgingPopupSlidePosition = () => {
  const bounds = getRandomEventWindowBounds(dodgingPopupWindow);
  const rect = dodgingPopupWindow.getBoundingClientRect();
  const styleLeft = Number.parseFloat(dodgingPopupWindow.style.left);
  const styleTop = Number.parseFloat(dodgingPopupWindow.style.top);
  const currentLeft = Number.isFinite(styleLeft) ? styleLeft : rect.left;
  const currentTop = Number.isFinite(styleTop) ? styleTop : rect.top;
  let farthestPosition = sampleRandomEventPosition(bounds);
  let farthestDistance = -1;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const position = sampleRandomEventPosition(bounds);
    const xDistance = position.left - currentLeft;
    const yDistance = position.top - currentTop;
    const distance = xDistance * xDistance + yDistance * yDistance;
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestPosition = position;
    }
  }

  return farthestPosition;
};

const dodgingPopupDodgeLimitReached = () =>
  dodgingPopupAttempts >= DODGING_POPUP_DODGE_LIMIT ||
  dodgingPopupDirectAttempts >= DODGING_POPUP_DIRECT_DODGE_LIMIT;

const dodgeDodgingPopup = ({ direct = false, force = false } = {}) => {
  if (
    !isDodgingPopupVisible() ||
    dodgingPopupWindow.classList.contains("is-dodging") ||
    (!force && dodgingPopupDodgeLimitReached())
  ) {
    return false;
  }

  if (direct) dodgingPopupDirectAttempts += 1;
  dodgingPopupAttempts += 1;
  dodgingPopupWindow.classList.add("is-dodging");
  void dodgingPopupWindow.offsetWidth;
  dodgingPopupWindow.style.zIndex = String(nextWindowZIndex());
  const nextPosition = getDodgingPopupSlidePosition();
  setRandomEventWindowPosition(dodgingPopupWindow, nextPosition.left, nextPosition.top);
  dodgingPopupSlideTimer = debounceTimer(dodgingPopupSlideTimer, () => {
    dodgingPopupWindow.classList.remove("is-dodging");
    dodgingPopupSlideTimer = null;
  }, DODGING_POPUP_SLIDE_DURATION_MS);
  return true;
};

const closeDodgingPopup = () => {
  closeManagedRandomEventWindow(dodgingPopupWindow, {
    beforeClose: clearDodgingPopupTimers,
  });
};

const scheduleDodgingPopupAutoClose = () => {
  dodgingPopupAutoCloseTimer = debounceTimer(dodgingPopupAutoCloseTimer, () => {
    dodgingPopupAutoCloseTimer = null;
    closeDodgingPopup();
  }, 2000);
};

const pressDodgingPopupButton = (button) => {
  if (!button || button.hidden || !dodgingPopupWindow) return;
  const visibleButtons = getDodgingPopupButtons().filter((candidate) => !candidate.hidden);
  if (visibleButtons.length <= 1) {
    if (!dodgingPopupFinalDodgeComplete) {
      dodgingPopupFinalDodgeComplete = true;
      dodgeDodgingPopup({ force: true });
      return;
    }
    button.hidden = true;
    scheduleDodgingPopupAutoClose();
    return;
  }
  button.hidden = true;
};

const showDodgingPopup = () => {
  showManagedRandomEventWindow(dodgingPopupWindow, {
    beforeShow: resetDodgingPopup,
    position: (win) => {
      positionRandomEventWindowInViewport(win);
      lockDodgingPopupSize();
    },
  });
};

const isRohinUpdateVisible = () => isManagedRandomEventWindowVisible(rohinUpdateWindow);

const showRohinUpdate = () => {
  showManagedRandomEventWindow(rohinUpdateWindow);
};

const closeRohinUpdate = () => {
  closeManagedRandomEventWindow(rohinUpdateWindow);
};

const isMcAfeeWindowVisible = (win) =>
  Boolean(win && !win.classList.contains("is-hidden"));

const isMcAfeeVisible = () =>
  [mcAfeePromptWindow, mcAfeeDownloadWindow, mcAfeeThanksWindow].some(
    isMcAfeeWindowVisible
  );

const mcAfeeWindows = () =>
  [mcAfeePromptWindow, mcAfeeDownloadWindow, mcAfeeThanksWindow].filter(Boolean);

const showMcAfeeWindow = (win) => {
  showManagedRandomEventWindow(win, {
    isVisible: () => isMcAfeeWindowVisible(win),
    onFront: () => clampRandomEventWindowToViewport(win),
    position: (target) => {
      positionRandomEventWindowInViewport(target);
      clampRandomEventWindowToViewport(target);
    },
    clampAfterMediaLoad: true,
  });
};

const closeMcAfeeWindow = (win) => {
  closeManagedRandomEventWindow(win);
};

const stopMcAfeeDownload = () => {
  if (mcAfeeProgressTimer) {
    clearTimeout(mcAfeeProgressTimer);
    mcAfeeProgressTimer = null;
  }
  if (mcAfeeDotsTimer) {
    clearInterval(mcAfeeDotsTimer);
    mcAfeeDotsTimer = null;
  }
};

const updateMcAfeeDownloadStatus = () => {
  if (!mcAfeeDownloadStatus) return;
  const dots = ".".repeat((mcAfeeDotsFrame % 3) + 1);
  mcAfeeDownloadStatus.textContent = `Downloading${dots}`;
  mcAfeeDotsFrame += 1;
};

const updateMcAfeeProgress = () => {
  if (!mcAfeeProgressBar || !mcAfeeProgress) return;
  mcAfeeProgressBar.style.width = `${mcAfeeProgressValue}%`;
  mcAfeeProgress.setAttribute("aria-valuenow", Math.floor(mcAfeeProgressValue));
};

const finishMcAfeeDownload = () => {
  stopMcAfeeDownload();
  mcAfeeProgressValue = 100;
  updateMcAfeeProgress();
  if (mcAfeeDownloadStatus) mcAfeeDownloadStatus.textContent = "Download complete.";
  if (mcAfeeComplete) mcAfeeComplete.disabled = false;
};

const tickMcAfeeDownload = () => {
  const slowDown = mcAfeeProgressValue > 70 ? 4 : 0;
  const delta = Math.max(0, Math.random() * 9 + 2 - slowDown);
  mcAfeeProgressValue = Math.min(mcAfeeProgressValue + delta, 100);
  updateMcAfeeProgress();

  if (mcAfeeProgressValue < 100) {
    const jitter = 160 + Math.random() * 320;
    mcAfeeProgressTimer = setTimeout(tickMcAfeeDownload, jitter);
    return;
  }

  finishMcAfeeDownload();
};

const startMcAfeeDownload = () => {
  stopMcAfeeDownload();
  mcAfeeProgressValue = 0;
  mcAfeeDotsFrame = 0;
  updateMcAfeeProgress();
  updateMcAfeeDownloadStatus();
  if (mcAfeeComplete) mcAfeeComplete.disabled = true;
  mcAfeeDotsTimer = setInterval(updateMcAfeeDownloadStatus, 420);
  mcAfeeProgressTimer = setTimeout(tickMcAfeeDownload, 300);
};

const showMcAfeePrompt = () => {
  if (mcAfeeUpdateLater) mcAfeeUpdateLater.disabled = false;
  showMcAfeeWindow(mcAfeePromptWindow);
};

const showMcAfeeDownload = () => {
  const alreadyVisible = isMcAfeeWindowVisible(mcAfeeDownloadWindow);
  showMcAfeeWindow(mcAfeeDownloadWindow);
  if (alreadyVisible) return;
  startMcAfeeDownload();
};

const showMcAfeeThanks = () => {
  showMcAfeeWindow(mcAfeeThanksWindow);
};

const MIDNIGHT_GOSPEL_DURATION_SECONDS = 60;

let midnightGospelIntervalId = 0;

let midnightGospelRemainingSeconds = MIDNIGHT_GOSPEL_DURATION_SECONDS;

let midnightGospelTimerActive = false;

let midnightGospelComplete = false;

let midnightGospelInteractionLock = null;

const isMidnightGospelWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isMidnightGospelVisible = () =>
  isMidnightGospelWindowVisible(midnightGospelInviteWindow) ||
  isMidnightGospelWindowVisible(midnightGospelMeditationWindow);

const copyMidnightGospelPosition = (source, target) => {
  if (!source || !target) return false;
  const sourceLeft = Number.parseFloat(source.style.left);
  const sourceTop = Number.parseFloat(source.style.top);
  if (!Number.isFinite(sourceLeft) || !Number.isFinite(sourceTop)) return false;
  setRandomEventWindowPosition(target, sourceLeft, sourceTop);
  return true;
};

const setMidnightGospelTimerText = (seconds) => {
  const clampedSeconds = clampNumber(seconds, 0, 99);
  const digits = padTwoDigits(clampedSeconds);
  if (midnightGospelTimer) {
    midnightGospelTimer.setAttribute(
      "aria-label",
      `Meditation timer: ${clampedSeconds} seconds`
    );
  }
  if (midnightGospelTimerTens) {
    midnightGospelTimerTens.src =
      SKILL_CHECK_DIGIT_SOURCES[digits[0]] || SKILL_CHECK_DIGIT_SOURCES[" "];
  }
  if (midnightGospelTimerOnes) {
    midnightGospelTimerOnes.src =
      SKILL_CHECK_DIGIT_SOURCES[digits[1]] || SKILL_CHECK_DIGIT_SOURCES[" "];
  }
};

const getMidnightGospelInteractionLock = () => {
  if (midnightGospelInteractionLock) return midnightGospelInteractionLock;
  midnightGospelInteractionLock = document.createElement("div");
  midnightGospelInteractionLock.className = "midnight-gospel-interaction-lock is-hidden";
  midnightGospelInteractionLock.setAttribute("aria-hidden", "true");
  document.body.append(midnightGospelInteractionLock);
  return midnightGospelInteractionLock;
};

const setMidnightGospelInteractionLocked = (locked) => {
  const lock = getMidnightGospelInteractionLock();
  lock.classList.toggle("is-hidden", !locked);
  lock.setAttribute("aria-hidden", String(!locked));
  document.body.classList.toggle("is-midnight-gospel-locked", locked);
};

const stopMidnightGospelTimer = ({ markComplete = false } = {}) => {
  if (midnightGospelIntervalId) {
    window.clearInterval(midnightGospelIntervalId);
    midnightGospelIntervalId = 0;
  }
  midnightGospelTimerActive = false;
  setMidnightGospelInteractionLocked(false);
  if (markComplete) {
    midnightGospelComplete = true;
    midnightGospelRemainingSeconds = 0;
    setMidnightGospelTimerText(0);
    if (midnightGospelBegin) {
      midnightGospelBegin.textContent = "Complete";
      midnightGospelBegin.disabled = false;
    }
  }
};

const resetMidnightGospelMeditation = () => {
  stopMidnightGospelTimer();
  midnightGospelComplete = false;
  midnightGospelRemainingSeconds = MIDNIGHT_GOSPEL_DURATION_SECONDS;
  setMidnightGospelTimerText(midnightGospelRemainingSeconds);
  if (midnightGospelBegin) {
    midnightGospelBegin.textContent = "Begin!";
    midnightGospelBegin.disabled = false;
  }
};

const showMidnightGospelInviteWindow = () => {
  showManagedRandomEventWindow(midnightGospelInviteWindow, {
    clampAfterMediaLoad: true,
  });
};

const showMidnightGospelMeditationWindow = (anchorWindow = null) => {
  showManagedRandomEventWindow(midnightGospelMeditationWindow, {
    beforeShow: resetMidnightGospelMeditation,
    position: (target) => {
      if (copyMidnightGospelPosition(anchorWindow, target)) return;
      positionRandomEventWindowInViewport(target);
    },
    clampAfterMediaLoad: true,
  });
};

const closeMidnightGospelWindow = (win) => {
  closeManagedRandomEventWindow(win, {
    beforeClose: () => {
      if (win === midnightGospelMeditationWindow) stopMidnightGospelTimer();
    },
  });
};

const acceptMidnightGospelInvite = () => {
  const anchor = midnightGospelInviteWindow;
  closeMidnightGospelWindow(midnightGospelInviteWindow);
  setTimeout(() => {
    showMidnightGospelMeditationWindow(anchor);
  }, 180);
};

const completeMidnightGospelMeditation = () => {
  stopMidnightGospelTimer({ markComplete: true });
};

const startMidnightGospelTimer = () => {
  if (midnightGospelTimerActive) return;
  if (midnightGospelComplete) {
    closeMidnightGospelWindow(midnightGospelMeditationWindow);
    return;
  }
  midnightGospelTimerActive = true;
  midnightGospelRemainingSeconds = MIDNIGHT_GOSPEL_DURATION_SECONDS;
  setMidnightGospelTimerText(midnightGospelRemainingSeconds);
  if (midnightGospelBegin) {
    midnightGospelBegin.disabled = true;
  }
  setMidnightGospelInteractionLocked(true);
  midnightGospelIntervalId = window.setInterval(() => {
    midnightGospelRemainingSeconds -= 1;
    setMidnightGospelTimerText(midnightGospelRemainingSeconds);
    if (midnightGospelRemainingSeconds <= 0) {
      completeMidnightGospelMeditation();
    }
  }, 1000);
};

const isCalendarReminderVisible = () =>
  isManagedRandomEventWindowVisible(calendarReminderWindow);

const showCalendarReminder = () => {
  showManagedRandomEventWindow(calendarReminderWindow);
};

const closeCalendarReminder = () => {
  closeManagedRandomEventWindow(calendarReminderWindow);
};

const showCalendarFromReminder = () => {
  openCalendar({ triggerEvent: false });
  closeCalendarReminder();
};

const isInstrumentalityWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isInstrumentalityVisible = () =>
  isInstrumentalityWindowVisible(instrumentalityWindow) ||
  isInstrumentalityWindowVisible(instrumentalityCongratsWindow);

const showInstrumentalityWindow = (win) => {
  showManagedRandomEventWindow(win);
};

const closeInstrumentalityWindow = (win) => {
  closeManagedRandomEventWindow(win);
};

const showInstrumentalityPrompt = () => {
  showInstrumentalityWindow(instrumentalityWindow);
};

const showInstrumentalityCongrats = () => {
  showInstrumentalityWindow(instrumentalityCongratsWindow);
};

const rejectInstrumentality = () => {
  closeInstrumentalityWindow(instrumentalityWindow);
  showInstrumentalityCongrats();
};

const isWallBreachVisible = () =>
  wallBreachSequenceActive || isManagedRandomEventWindowVisible(wallBreachWindow);

const triggerWallBreachShake = () => {
  document.documentElement.classList.remove("is-wall-breach-shaking");
  void document.documentElement.offsetWidth;
  document.documentElement.classList.add("is-wall-breach-shaking");
  window.setTimeout(() => {
    document.documentElement.classList.remove("is-wall-breach-shaking");
  }, WALL_BREACH_SHAKE_DURATION_MS);
};

const triggerWallBreachFlash = () =>
  new Promise((resolve) => {
    const flash = document.createElement("div");
    flash.className = "wall-breach-flash";
    document.body.appendChild(flash);
    const animation = flash.animate(
      [
        { opacity: 0 },
        { opacity: 1, offset: 0.08 },
        { opacity: 1, offset: 0.36 },
        { opacity: 0 },
      ],
      {
        duration: WALL_BREACH_FLASH_DURATION_MS,
        easing: "ease-out",
        fill: "forwards",
      }
    );
    animation.addEventListener(
      "finish",
      () => {
        flash.remove();
        resolve();
      },
      { once: true }
    );
  });

const waitForWallBreachShakeInterval = () =>
  new Promise((resolve) => {
    window.setTimeout(resolve, WALL_BREACH_SHAKE_INTERVAL_MS);
  });

const showWallBreachWindow = () => {
  showManagedRandomEventWindow(wallBreachWindow, { clampAfterMediaLoad: true });
};

const runWallBreachSequence = async () => {
  if (isWallBreachVisible()) return;
  wallBreachSequenceActive = true;
  try {
    for (let count = 0; count < 3; count += 1) {
      triggerWallBreachShake();
      await waitForWallBreachShakeInterval();
    }
    triggerWallBreachShake();
    await triggerWallBreachFlash();
    showWallBreachWindow();
  } finally {
    wallBreachSequenceActive = false;
  }
};

const closeWallBreachWindow = () => {
  closeManagedRandomEventWindow(wallBreachWindow);
};

const isSpellStackVisible = () => isManagedRandomEventWindowVisible(spellStackWindow);

const clearSpellStackLightning = () => {
  if (spellStackLightningFrame) {
    cancelAnimationFrame(spellStackLightningFrame);
    spellStackLightningFrame = null;
  }
  if (spellStackLightningTimer) {
    clearTimeout(spellStackLightningTimer);
    spellStackLightningTimer = null;
  }
  spellStackWindow?.classList.remove("is-spell-hit");
  clearLightningCanvas(spellStackLightningCanvas);
};

const showSpellStackWindow = () => {
  clearSpellStackLightning();
  showManagedRandomEventWindow(spellStackWindow, { clampAfterMediaLoad: true });
};

const triggerSpellStackCounterFlash = () => {
  const flash = document.createElement("div");
  flash.className = "spell-stack-counter-flash";
  document.body.appendChild(flash);
  const animation = flash.animate(
    [
      { opacity: 0 },
      { opacity: 0.88, offset: 0.12 },
      { opacity: 0.72, offset: 0.36 },
      { opacity: 0 },
    ],
    {
      duration: 620,
      easing: "ease-out",
      fill: "forwards",
    }
  );
  animation.addEventListener("finish", () => flash.remove(), { once: true });
};

const counterSpellOnStack = () => {
  if (!spellStackWindow || spellStackWindow.classList.contains("is-hidden")) return;
  clearSpellStackLightning();
  triggerSpellStackCounterFlash();
  closeManagedRandomEventWindow(spellStackWindow);
};

const triggerSpellStackLightning = () => {
  if (!spellStackWindow || !spellStackLightningCanvas) return;
  clearSpellStackLightning();
  spellStackWindow.classList.add("is-spell-hit");
  const startedAt = performance.now();
  const duration = 900;

  const render = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const alpha = Math.max(0, 1 - progress * 0.55);
    drawLightningBorderFrame(spellStackLightningCanvas, alpha, RED_LIGHTNING_PALETTE);
    if (progress < 1) {
      spellStackLightningFrame = requestAnimationFrame(render);
      return;
    }
    clearSpellStackLightning();
  };

  spellStackLightningFrame = requestAnimationFrame(render);
  spellStackLightningTimer = window.setTimeout(clearSpellStackLightning, duration + 80);
};

const refuseSpellOnStackCounter = () => {
  if (!spellStackWindow || spellStackWindow.classList.contains("is-hidden")) return;
  triggerSpellStackLightning();
  closeManagedRandomEventWindow(spellStackWindow);
};

const isNobleSteedVisible = () =>
  Boolean(
    nobleSteedResultTimer ||
      isManagedRandomEventWindowVisible(nobleSteedWindow) ||
      isManagedRandomEventWindowVisible(nobleSteedResultWindow)
  );

const clearNobleSteedResultTimer = () => {
  if (!nobleSteedResultTimer) return;
  window.clearTimeout(nobleSteedResultTimer);
  nobleSteedResultTimer = null;
};

const showNobleSteedWindow = () => {
  clearNobleSteedResultTimer();
  nobleSteedResultPosition = null;
  closeManagedRandomEventWindow(nobleSteedResultWindow);
  showManagedRandomEventWindow(nobleSteedWindow, { clampAfterMediaLoad: true });
};

const closeNobleSteedWindow = () => {
  clearNobleSteedResultTimer();
  nobleSteedResultPosition = null;
  closeManagedRandomEventWindow(nobleSteedWindow);
};

const showNobleSteedResultWindow = () => {
  nobleSteedResultTimer = null;
  const didOpen = showManagedRandomEventWindow(nobleSteedResultWindow, {
    clampAfterMediaLoad: true,
  });
  if (didOpen && nobleSteedResultPosition) {
    setRandomEventWindowPosition(
      nobleSteedResultWindow,
      nobleSteedResultPosition.left,
      nobleSteedResultPosition.top
    );
  }
};

const acceptNobleSteedOffer = () => {
  if (!nobleSteedWindow || nobleSteedWindow.classList.contains("is-hidden")) return;
  clearNobleSteedResultTimer();
  nobleSteedResultPosition = getRandomEventWindowPosition(nobleSteedWindow);
  closeManagedRandomEventWindow(nobleSteedWindow);
  nobleSteedResultTimer = window.setTimeout(showNobleSteedResultWindow, 2000);
};

const closeNobleSteedResultWindow = () => {
  clearNobleSteedResultTimer();
  nobleSteedResultPosition = null;
  closeManagedRandomEventWindow(nobleSteedResultWindow);
};

const isBidenBlastVisible = () => isManagedRandomEventWindowVisible(bidenBlastWindow);

const removeBidenExplodePieces = () => {
  document.querySelectorAll(".biden-explode-piece").forEach((piece) => {
    piece.remove();
  });
};

const animateBidenBlastExplode = (mode, onComplete) => {
  if (!bidenBlastWindow) {
    if (onComplete) onComplete();
    return;
  }

  removeBidenExplodePieces();
  const rect = bidenBlastWindow.getBoundingClientRect();
  const columns = 3;
  const rows = 3;
  const pieceWidth = rect.width / columns;
  const pieceHeight = rect.height / rows;
  const pieces = [];

  bidenBlastWindow.classList.add("is-exploding");

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const piece = document.createElement("div");
      piece.className = "biden-explode-piece";
      piece.style.left = `${rect.left + column * pieceWidth}px`;
      piece.style.top = `${rect.top + row * pieceHeight}px`;
      piece.style.width = `${Math.ceil(pieceWidth)}px`;
      piece.style.height = `${Math.ceil(pieceHeight)}px`;
      piece.style.backgroundImage = `linear-gradient(#fff, #fff)`;
      piece.style.backgroundSize = `${rect.width}px ${rect.height}px`;
      piece.style.backgroundPosition = `${-column * pieceWidth}px ${-row * pieceHeight}px`;

      const clone = bidenBlastWindow.cloneNode(true);
      clone.classList.remove(
        "is-opening",
        "is-closing",
        "is-hidden",
        "is-exploding"
      );
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
    const deltaX = (column - centerColumn) * pieceWidth * 1.15;
    const deltaY = (row - centerRow) * pieceHeight * 1.15;
    const outward = `translate(${deltaX}px, ${deltaY}px) scale(0.08)`;
    const inward = "translate(0, 0) scale(1)";
    const fromTransform = mode === "show" ? outward : inward;
    const toTransform = mode === "show" ? inward : outward;
    const fromOpacity = mode === "show" ? 0 : 1;
    const toOpacity = mode === "show" ? 1 : 0;

    const animation = piece.animate(
      [
        { opacity: fromOpacity, transform: fromTransform },
        { opacity: toOpacity, transform: toTransform },
      ],
      {
        duration: 420,
        easing: mode === "show" ? "cubic-bezier(.2,.8,.2,1)" : "cubic-bezier(.6,0,.8,.2)",
        fill: "forwards",
      }
    );

    animation.addEventListener("finish", () => {
      remaining -= 1;
      if (remaining > 0) return;
      removeBidenExplodePieces();
      bidenBlastWindow.classList.remove("is-exploding");
      if (onComplete) onComplete();
    });
  });
};

// The blast replaces the shared open/close animation with its own piece
// explosion, so it opts out of `animate` and runs its own close sequence
// instead of `closeManagedRandomEventWindow`.
const showBidenBlastWindow = () => {
  showManagedRandomEventWindow(bidenBlastWindow, {
    clearClasses: ["is-exploding"],
    animate: false,
    afterShow: () => animateBidenBlastExplode("show"),
  });
};

const closeBidenBlastWindow = () => {
  if (!bidenBlastWindow || bidenBlastWindow.classList.contains("is-hidden")) return;
  bidenBlastWindow.setAttribute("aria-hidden", "true");
  bidenBlastWindow.classList.add("is-closing");
  animateBidenBlastExplode("hide", () => {
    bidenBlastWindow.classList.remove("is-closing");
    bidenBlastWindow.classList.add("is-hidden");
    unloadDeferredImages(bidenBlastWindow);
  });
};

registerRandomEvent({
  id: "neko-stream-system-alert",
  forceOnStart: true,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isNekoStreamAlertVisible,
  canTrigger: ({ triggerName, forceOnStart } = {}) =>
    !isNekoStreamAlertVisible() &&
    (!forceOnStart || triggerName === "startButton"),
  preloadTargets: () => [
    nekoStreamAlertWindow,
    NEKO_SPRITES.sleep1,
    NEKO_SPRITES.sleep2,
  ],
  run: () => {
    showNekoStreamAlert();
  },
  bind: () => {
    bindRandomEventButton(nekoStreamAlertYes, () => respondToNekoStreamAlert(true));
    bindRandomEventButton(nekoStreamAlertNo, () => respondToNekoStreamAlert(false));
    bindManagedRandomEventWindowAnimation(nekoStreamAlertWindow, {
      afterClose: resetNekoStreamAlert,
      unloadImages: false,
    });
    if (typeof nekoStreamAlertReducedMotionQuery?.addEventListener === "function") {
      nekoStreamAlertReducedMotionQuery.addEventListener(
        "change",
        handleNekoStreamAlertMotionPreferenceChange
      );
    } else {
      nekoStreamAlertReducedMotionQuery?.addListener?.(
        handleNekoStreamAlertMotionPreferenceChange
      );
    }
    nekoStreamAlertWindow?.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      respondToNekoStreamAlert(false);
    });
  },
});

registerRandomEvent({
  id: "annoying-system-alert",
  preloadTargets: () => [randomAlertWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isRandomAlertVisible,
  canTrigger: () => !isRandomAlertVisible(),
  run: () => {
    showRandomAlert();
  },
  bind: () => {
    bindManagedRandomEventWindowAnimation(randomAlertWindow, {
      closingClasses: ["is-choice-flashing"],
      unloadImages: false,
    });

    if (randomAlertMaximize) {
      randomAlertMaximize.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!randomAlertWindow) return;
        randomAlertWindow.classList.add("is-expanded");
        randomAlertWindow.style.zIndex = String(nextWindowZIndex());
      });
    }

    if (randomAlertMinimize) {
      randomAlertMinimize.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        resetRandomAlertSize();
        if (randomAlertWindow) randomAlertWindow.style.zIndex = String(nextWindowZIndex());
      });
    }

    if (randomAlertClose) {
      randomAlertClose.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        flashRandomAlertChoices();
      });
    }

    [randomAlertYes, randomAlertNo].forEach((button) => {
      if (!button) return;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        respondToRandomAlert();
      });
    });
  },
});

registerRandomEvent({
  id: "dodging-popup-alert",
  preloadTargets: () => [dodgingPopupWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isDodgingPopupVisible,
  canTrigger: () => !isDodgingPopupVisible(),
  run: () => {
    showDodgingPopup();
  },
  bind: () => {
    getDodgingPopupButtons().forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        pressDodgingPopupButton(button);
      });
    });

    if (dodgingPopupWindow) {
      dodgingPopupWindow.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "mouse") return;
        dodgeDodgingPopup();
      });

      dodgingPopupWindow.addEventListener(
        "click",
        (event) => {
          if (dodgingPopupWindow.classList.contains("is-dodging")) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
          }
          if (!dodgingPopupDodgeLimitReached()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            dodgeDodgingPopup({ direct: true });
          }
        },
        true
      );

      bindManagedRandomEventWindowAnimation(dodgingPopupWindow, {
        closingClasses: ["is-dodging"],
        unloadImages: false,
      });
    }
  },
});

registerRandomEvent({
  id: "vanishing-popup-alert",
  preloadTargets: () => [vanishingPopupWindow, vanishingPopupExplosion],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isVanishingPopupVisible,
  canTrigger: () => !isVanishingPopupVisible(),
  run: () => {
    showVanishingPopup();
  },
  bind: () => {
    [
      vanishingPopupClose,
      vanishingPopupMaximize,
      vanishingPopupMinimize,
      vanishingPopupYes,
      vanishingPopupNo,
    ].forEach((button) => {
      if (!button) return;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        hideVanishingPopupButton(button);
      });
    });

    bindManagedRandomEventWindowAnimation(vanishingPopupWindow, {
      closingClasses: ["is-exploding"],
      unloadImages: false,
      afterClose: () => {
        if (!vanishingPopupExplosion) return;
        vanishingPopupExplosion.classList.remove("is-active");
        vanishingPopupExplosion.removeAttribute("src");
        vanishingPopupExplosion.removeAttribute("style");
      },
    });
  },
});

registerRandomEvent({
  id: "rohin-os-update",
  preloadTargets: () => [rohinUpdateWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isRohinUpdateVisible,
  canTrigger: () => !isRohinUpdateVisible(),
  run: () => {
    showRohinUpdate();
  },
  bind: () => {
    if (rohinUpdateRun) {
      rohinUpdateRun.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.location.href = "index.html";
      });
    }

    if (rohinUpdateLater) {
      rohinUpdateLater.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeRohinUpdate();
      });
    }

    bindManagedRandomEventWindowAnimation(rohinUpdateWindow, { unloadImages: false });
  },
});

registerRandomEvent({
  id: "mcafee-antivirus-update",
  preloadTargets: () => [
    mcAfeePromptWindow,
    mcAfeeDownloadWindow,
    mcAfeeThanksWindow,
  ],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isMcAfeeVisible,
  canTrigger: () => !isMcAfeeVisible(),
  run: () => {
    showMcAfeePrompt();
  },
  bind: () => {
    if (mcAfeeUpdateRun) {
      mcAfeeUpdateRun.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (mcAfeeUpdateLater) mcAfeeUpdateLater.disabled = true;
        showMcAfeeDownload();
      });
    }

    if (mcAfeeUpdateLater) {
      mcAfeeUpdateLater.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeMcAfeeWindow(mcAfeePromptWindow);
      });
    }

    if (mcAfeeComplete) {
      mcAfeeComplete.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (mcAfeeComplete.disabled) return;
        stopMcAfeeDownload();
        closeMcAfeeWindow(mcAfeePromptWindow);
        closeMcAfeeWindow(mcAfeeDownloadWindow);
        showMcAfeeThanks();
      });
    }

    if (mcAfeeThanksOk) {
      mcAfeeThanksOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeMcAfeeWindow(mcAfeeThanksWindow);
      });
    }

    [mcAfeePromptWindow, mcAfeeDownloadWindow, mcAfeeThanksWindow].forEach((win) => {
      bindManagedRandomEventWindowAnimation(win, {
        afterClose: () => {
          if (win === mcAfeeDownloadWindow) stopMcAfeeDownload();
        },
      });
    });
  },
});

registerRandomEvent({
  id: "midnight-gospel",
  preloadTargets: () => [
    midnightGospelInviteWindow,
    midnightGospelMeditationWindow,
  ],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isMidnightGospelVisible,
  canTrigger: () => !isMidnightGospelVisible(),
  run: () => {
    showMidnightGospelInviteWindow();
  },
  bind: () => {
    if (midnightGospelYes) {
      midnightGospelYes.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        acceptMidnightGospelInvite();
      });
    }

    if (midnightGospelNo) {
      midnightGospelNo.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeMidnightGospelWindow(midnightGospelInviteWindow);
      });
    }

    if (midnightGospelBegin) {
      midnightGospelBegin.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startMidnightGospelTimer();
      });
    }

    [midnightGospelInviteWindow, midnightGospelMeditationWindow].forEach((win) => {
      bindManagedRandomEventWindowAnimation(win, {
        afterClose: () => {
          if (win === midnightGospelMeditationWindow) {
            resetMidnightGospelMeditation();
          }
        },
      });
    });
  },
});

registerRandomEvent({
  id: "calendar-reminder",
  preloadTargets: () => [calendarReminderWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isCalendarReminderVisible,
  canTrigger: () =>
    !isCalendarReminderVisible() &&
    !(calendarPopout && calendarPopout.classList.contains("is-open")),
  run: () => {
    showCalendarReminder();
  },
  bind: () => {
    bindRandomEventButton(calendarReminderShow, showCalendarFromReminder);
    bindRandomEventButton(calendarReminderLater, closeCalendarReminder);
    bindManagedRandomEventWindowAnimation(calendarReminderWindow);
  },
});

registerRandomEvent({
  id: "human-instrumentality-project",
  preloadTargets: () => [
    instrumentalityWindow,
    instrumentalityCongratsWindow,
  ],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isInstrumentalityVisible,
  canTrigger: () => !isInstrumentalityVisible(),
  run: () => {
    showInstrumentalityPrompt();
  },
  bind: () => {
    if (instrumentalityYes) {
      instrumentalityYes.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeInstrumentalityWindow(instrumentalityWindow);
      });
    }

    if (instrumentalityNo) {
      instrumentalityNo.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        rejectInstrumentality();
      });
    }

    if (instrumentalityCongratsOk) {
      instrumentalityCongratsOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeInstrumentalityWindow(instrumentalityCongratsWindow);
      });
    }

    [instrumentalityWindow, instrumentalityCongratsWindow].forEach((win) => bindManagedRandomEventWindowAnimation(win));
  },
});

registerRandomEvent({
  id: "spell-on-the-stack",
  preloadTargets: () => [spellStackWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isSpellStackVisible,
  canTrigger: () => !isSpellStackVisible(),
  run: () => {
    showSpellStackWindow();
  },
  bind: () => {
    bindRandomEventButton(spellStackYes, counterSpellOnStack);
    bindRandomEventButton(spellStackNo, refuseSpellOnStackCounter);
    bindManagedRandomEventWindowAnimation(spellStackWindow, {
      afterClose: clearSpellStackLightning,
    });
  },
});

registerRandomEvent({
  id: "noble-steed",
  preloadTargets: () => [
    nobleSteedWindow,
    nobleSteedResultWindow,
    "assets/random%20events/horse.jpeg",
  ],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isNobleSteedVisible,
  canTrigger: () => !isNobleSteedVisible(),
  run: () => {
    showNobleSteedWindow();
  },
  bind: () => {
    bindRandomEventButton(nobleSteedYes, acceptNobleSteedOffer);
    bindRandomEventButton(nobleSteedNo, closeNobleSteedWindow);
    bindRandomEventButton(nobleSteedResultOk, closeNobleSteedResultWindow);
    bindManagedRandomEventWindowAnimation(nobleSteedWindow);
    bindManagedRandomEventWindowAnimation(nobleSteedResultWindow);
  },
});

registerRandomEvent({
  id: "wall-breach",
  preloadTargets: () => [wallBreachWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isWallBreachVisible,
  canTrigger: () => !isWallBreachVisible(),
  run: () => {
    runWallBreachSequence();
  },
  bind: () => {
    bindRandomEventButton(wallBreachSuitUp, closeWallBreachWindow);
    bindManagedRandomEventWindowAnimation(wallBreachWindow);
  },
});

registerRandomEvent({
  id: "biden-blast",
  preloadTargets: () => [bidenBlastWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isBidenBlastVisible,
  canTrigger: () => !isBidenBlastVisible(),
  run: () => {
    showBidenBlastWindow();
  },
  bind: () => {
    if (bidenBlastOk) {
      bidenBlastOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeBidenBlastWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(bidenBlastWindow);
  },
});

bindManagedRandomEventWindowAnimation(debugSystemAlertWindow, {
  afterClose: resetDebugSystemAlert,
  unloadImages: false,
});

debugSystemAlertWindow?.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeDebugSystemAlert();
});

const configureDebugSystemAlertPreview = (preview, alert) => {
  renderDebugSystemAlert(alert, { root: preview, interactive: false });
};

// Every configured system alert becomes an event sharing this one shell.
SYSTEM_ALERTS.forEach((alert) => {
  registerRandomEvent({
    id: `debug-system-alert-${alert.id}`,
    kind: RANDOM_EVENT_KIND_INTERACTIVE,
    isVisible: isDebugSystemAlertVisible,
    canTrigger: () => !isDebugSystemAlertVisible(),
    preloadTargets: () => [alert.icon],
    run: () => showDebugSystemAlert(alert),
    systemAlert: alert,
  });
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  randomAlertWindow,
  debugSystemAlertWindow,
  nekoStreamAlertWindow,
  vanishingPopupWindow,
  dodgingPopupWindow,
  rohinUpdateWindow,
  mcAfeePromptWindow,
  mcAfeeDownloadWindow,
  mcAfeeThanksWindow,
  midnightGospelInviteWindow,
  midnightGospelMeditationWindow,
  calendarReminderWindow,
  instrumentalityWindow,
  instrumentalityCongratsWindow,
  wallBreachWindow,
  spellStackWindow,
  nobleSteedWindow,
  nobleSteedResultWindow,
  bidenBlastWindow,
]);

const isMcAfeeDownloadInProgress = () => Boolean(mcAfeeProgressTimer);

window.homeEventPrompts = Object.freeze({
  isMcAfeeDownloadInProgress,
  bidenBlastWindow,
  calendarReminderWindow,
  configureDebugSystemAlertPreview,
  debugSystemAlertWindow,
  dodgingPopupWindow,
  instrumentalityCongratsWindow,
  instrumentalityWindow,
  isDebugSystemAlertVisible,
  isMcAfeeWindowVisible,
  mcAfeeDownloadWindow,
  mcAfeePromptWindow,
  mcAfeeThanksWindow,
  midnightGospelInviteWindow,
  midnightGospelMeditationWindow,
  nekoStreamAlertWindow,
  nobleSteedResultWindow,
  nobleSteedWindow,
  randomAlertWindow,
  rohinUpdateWindow,
  showDebugSystemAlert,
  spellStackWindow,
  vanishingPopupExplosion,
  vanishingPopupWindow,
  wallBreachWindow,
});
})();
