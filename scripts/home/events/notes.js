(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_DEVELOPER_MODE,
  RANDOM_EVENT_KIND_INTERACTIVE,
  RANDOM_EVENT_KIND_NON_INTERACTIVE,
  STANDARD_RANDOM_EVENT_PROBABILITIES,
  STANDARD_RANDOM_EVENT_PROBABILITY,
  bindManagedRandomEventWindowAnimation,
  bindRandomEventButton,
  clampRandomEventWindowToViewport,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  isRandomEventGameplayLockActive,
  isRandomEventTriggerOnCooldown,
  randomEventKindCanSchedule,
  recordRandomEventTrigger,
  registerRandomEvent,
  registerRandomEventFallback,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  getLocalDateKey,
} = window.homeUtil;
const {
  loadDeferredMedia,
} = window.homeActivation;
const {
  nextWindowZIndex,
} = window.homeWindows;

const felizJuevesWindow = byId("feliz-jueves-window");
const felizJuevesClose = byId("feliz-jueves-close");
const felizJuevesGracias = byId("feliz-jueves-gracias");
const selfLoveAlertWindow = byId("self-love-alert-window");
const selfLoveAlertClose = byId("self-love-alert-close");
const selfLoveAlertYes = byId("self-love-alert-yes");
const selfLoveAlertNo = byId("self-love-alert-no");
const rohinNoteWindow = byId("rohin-note-window");
const rohinNoteOk = byId("rohin-note-ok");
const earthNoteWindow = byId("earth-note-window");
const earthNoteOk = byId("earth-note-ok");
const healthNoteWindow = byId("health-note-window");
const healthNoteOk = byId("health-note-ok");
const loveNoteWindow = byId("love-note-window");
const loveNoteOk = byId("love-note-ok");
const noSmokingWindow = byId("no-smoking-window");
const noSmokingOk = byId("no-smoking-ok");
const possumSpringsWindow = byId("possum-springs-window");
const possumSpringsOk = byId("possum-springs-ok");
const wingedLightWindow = byId("winged-light-window");
const wingedLightCollect = byId("winged-light-collect");
const wingedLightLater = byId("winged-light-later");
const manaFloodWindow = byId("mana-flood-window");
const manaFloodOk = byId("mana-flood-ok");
const mimicWarningWindow = byId("mimic-warning-window");
const mimicWarningOk = byId("mimic-warning-ok");
const nazarWindow = byId("nazar-window");
const nazarClose = byId("nazar-close");
const nazarYes = byId("nazar-yes");
const nazarNo = byId("nazar-no");
const siteGraceWindow = byId("site-grace-window");
const siteGraceTouch = byId("site-grace-touch");
const siteGraceKeep = byId("site-grace-keep");
const lostGraceOverlay = byId("lost-grace-overlay");
const lainAlertWindow = byId("lain-alert-window");
const lainAlertClose = byId("lain-alert-close");
const lelouchAlertWindow = byId("lelouch-alert-window");
const lelouchAlertOk = byId("lelouch-alert-ok");
const berserkSunriseWindow = byId("berserk-sunrise-window");
const berserkSunriseOk = byId("berserk-sunrise-ok");
const deathNoteWindow = byId("death-note-window");
const deathNoteEntry = byId("death-note-entry");
const deathNoteTitleClose = byId("death-note-title-close");
const deathNoteClose = byId("death-note-close");
const currentPublicInfoWindow = byId("current-public-info-window");
const currentPublicInfoClose = byId("current-public-info-close");
const currentPublicInfoThanks = byId("current-public-info-thanks");
const currentPublicInfoImage = byId("current-public-info-image");
const trnaRequestWindow = byId("trna-request-window");
const trnaRequestYes = byId("trna-request-yes");
const trnaRequestNo = byId("trna-request-no");
const natarajaWindow = byId("nataraja-window");
const natarajaVideo = byId("nataraja-video");
const natarajaYes = byId("nataraja-yes");
const natarajaNo = byId("nataraja-no");
const behelitWindow = byId("behelit-window");
const behelitOk = byId("behelit-ok");
const johnPorkWindow = byId("john-pork-window");
const johnPorkStatus = byId("john-pork-status");
const johnPorkClose = byId("john-pork-close");
const johnPorkAccept = byId("john-pork-accept");
const johnPorkDecline = byId("john-pork-decline");
const advertisementWindow = byId("advertisement-window");
const advertisementNoThanks = byId("advertisement-no-thanks");
const saulAdWindow = byId("saul-ad-window");
const saulAdClose = byId("saul-ad-close");
const saulAdImage = byId("saul-ad-image");
const kidnamedfingerWindow = byId("kidnamedfinger-window");
const kidnamedfingerOk = byId("kidnamedfinger-ok");
const walterWhiteWindow = byId("walter-white-window");
const walterWhiteOk = byId("walter-white-ok");
const bountyHunterWindow = byId("bounty-hunter-window");
const bountyHunterClose = byId("bounty-hunter-close");

let selfLoveAlertFlashTimer = null;

let felizJuevesFlashTimer = null;

let felizJuevesShownFallbackDate = "";

let johnPorkStatusTimer = null;

let johnPorkStatusFrame = 0;

let lostGraceOverlayTimer = null;

const SAUL_AD_IMAGES = [
  "assets/random%20events/saul1.jpg",
  "assets/random%20events/saul2.jpg",
];

const FELIZ_JUEVES_SHOWN_KEY = "personalSiteFelizJuevesShownDate";

let wingedLightCollectOverlay = null;

let lainAlertFocusReturn = null;

const isSelfLoveAlertVisible = () =>
  isManagedRandomEventWindowVisible(selfLoveAlertWindow);

const showSelfLoveAlert = () => {
  showManagedRandomEventWindow(selfLoveAlertWindow, {
    clearClasses: ["is-yes-flashing"],
  });
};

const closeSelfLoveAlert = () => {
  closeManagedRandomEventWindow(selfLoveAlertWindow);
};

const flashSelfLoveYes = () => {
  if (!selfLoveAlertWindow) return;
  if (selfLoveAlertFlashTimer) clearTimeout(selfLoveAlertFlashTimer);
  selfLoveAlertWindow.classList.add("is-yes-flashing");
  selfLoveAlertFlashTimer = setTimeout(() => {
    selfLoveAlertWindow.classList.remove("is-yes-flashing");
    selfLoveAlertFlashTimer = null;
  }, 600);
};

const isRohinNoteVisible = () => isManagedRandomEventWindowVisible(rohinNoteWindow);

const showRohinNote = () => {
  showManagedRandomEventWindow(rohinNoteWindow);
};

const closeRohinNote = () => {
  closeManagedRandomEventWindow(rohinNoteWindow);
};

const isEarthNoteVisible = () => isManagedRandomEventWindowVisible(earthNoteWindow);

const showEarthNote = () => {
  showManagedRandomEventWindow(earthNoteWindow);
};

const closeEarthNote = () => {
  closeManagedRandomEventWindow(earthNoteWindow);
};

const isHealthNoteVisible = () => isManagedRandomEventWindowVisible(healthNoteWindow);

const showHealthNote = () => {
  showManagedRandomEventWindow(healthNoteWindow);
};

const closeHealthNote = () => {
  closeManagedRandomEventWindow(healthNoteWindow);
};

const isLoveNoteVisible = () => isManagedRandomEventWindowVisible(loveNoteWindow);

const showLoveNote = () => {
  showManagedRandomEventWindow(loveNoteWindow);
};

const closeLoveNote = () => {
  closeManagedRandomEventWindow(loveNoteWindow);
};

const isNoSmokingVisible = () => isManagedRandomEventWindowVisible(noSmokingWindow);

const showNoSmokingWindow = () => {
  showManagedRandomEventWindow(noSmokingWindow, { clampAfterMediaLoad: true });
};

const closeNoSmokingWindow = () => {
  closeManagedRandomEventWindow(noSmokingWindow);
};

const isPossumSpringsVisible = () =>
  isManagedRandomEventWindowVisible(possumSpringsWindow);

const showPossumSpringsWindow = () => {
  showManagedRandomEventWindow(possumSpringsWindow, { clampAfterMediaLoad: true });
};

const closePossumSpringsWindow = () => {
  closeManagedRandomEventWindow(possumSpringsWindow);
};

const isWingedLightVisible = () => isManagedRandomEventWindowVisible(wingedLightWindow);

const showWingedLightWindow = () => {
  showManagedRandomEventWindow(wingedLightWindow, { clampAfterMediaLoad: true });
};

const closeWingedLightWindow = () => {
  closeManagedRandomEventWindow(wingedLightWindow);
};

const removeWingedLightCollectOverlay = () => {
  if (!wingedLightCollectOverlay) return;
  wingedLightCollectOverlay.remove();
  wingedLightCollectOverlay = null;
};

const triggerWingedLightCollectEffect = () => {
  removeWingedLightCollectOverlay();
  const overlay = document.createElement("div");
  overlay.className = "winged-light-collect-overlay";
  const starPositions = [
    { x: 0, y: -128 },
    { x: 0, y: -64 },
    { x: 0, y: 0 },
    { x: 0, y: 64 },
    { x: 0, y: 128 },
  ];

  starPositions.forEach(({ x, y }, index) => {
    const star = document.createElement("span");
    star.className = "wing-charge-star";
    star.style.setProperty("--star-x", `${x}px`);
    star.style.setProperty("--star-y", `${y}px`);
    star.style.setProperty("--star-x-end", `${Math.round(x * 1.18)}px`);
    star.style.setProperty("--star-y-end", `${Math.round(y * 1.18)}px`);
    star.style.setProperty("--star-delay", `${index * 45}ms`);
    ["1", "2", "3"].forEach((tier) => {
      const tierLayer = document.createElement("span");
      tierLayer.className = `wing-charge-star-tier wing-charge-star-tier--${tier}`;
      star.appendChild(tierLayer);
    });
    overlay.appendChild(star);
  });

  document.body.appendChild(overlay);
  wingedLightCollectOverlay = overlay;
  const cleanup = () => {
    if (wingedLightCollectOverlay !== overlay) return;
    removeWingedLightCollectOverlay();
  };
  const handleOverlayAnimationEnd = (event) => {
    if (event.target !== overlay) return;
    overlay.removeEventListener("animationend", handleOverlayAnimationEnd);
    cleanup();
  };
  overlay.addEventListener("animationend", handleOverlayAnimationEnd);
  setTimeout(cleanup, 4300);
};

const collectWingedLight = () => {
  closeWingedLightWindow();
  triggerWingedLightCollectEffect();
};

const isManaFloodVisible = () => isManagedRandomEventWindowVisible(manaFloodWindow);

const showManaFlood = () => {
  showManagedRandomEventWindow(manaFloodWindow);
};

const closeManaFlood = () => {
  closeManagedRandomEventWindow(manaFloodWindow);
};

const isMimicWarningVisible = () =>
  isManagedRandomEventWindowVisible(mimicWarningWindow);

const showMimicWarning = () => {
  showManagedRandomEventWindow(mimicWarningWindow);
};

const closeMimicWarning = () => {
  closeManagedRandomEventWindow(mimicWarningWindow);
};

const isFelizJuevesVisible = () => isManagedRandomEventWindowVisible(felizJuevesWindow);

const hasShownFelizJuevesToday = (dateKey) => {
  try {
    return localStorage.getItem(FELIZ_JUEVES_SHOWN_KEY) === dateKey;
  } catch (error) {
    return felizJuevesShownFallbackDate === dateKey;
  }
};

const markFelizJuevesShown = (dateKey) => {
  felizJuevesShownFallbackDate = dateKey;
  try {
    localStorage.setItem(FELIZ_JUEVES_SHOWN_KEY, dateKey);
  } catch (error) {
    // Local storage can be disabled in private browsing modes.
  }
};

const showFelizJuevesWindow = () => {
  showManagedRandomEventWindow(felizJuevesWindow, {
    clearClasses: ["is-choice-flashing"],
  });
};

const closeFelizJuevesWindow = () => {
  closeManagedRandomEventWindow(felizJuevesWindow);
};

const flashFelizJuevesChoice = () => {
  if (!felizJuevesWindow) return;
  if (felizJuevesFlashTimer) clearTimeout(felizJuevesFlashTimer);
  felizJuevesWindow.classList.add("is-choice-flashing");
  felizJuevesFlashTimer = setTimeout(() => {
    felizJuevesWindow.classList.remove("is-choice-flashing");
    felizJuevesFlashTimer = null;
  }, 300);
};

const maybeShowFelizJueves = () => {
  if (RANDOM_EVENT_DEVELOPER_MODE) return false;
  if (isRandomEventGameplayLockActive()) return false;
  const today = new Date();
  if (today.getDay() !== 4) return false;
  const dateKey = getLocalDateKey(today);
  if (hasShownFelizJuevesToday(dateKey)) return false;
  if (isRandomEventTriggerOnCooldown()) return false;
  if (
    !randomEventKindCanSchedule(RANDOM_EVENT_KIND_NON_INTERACTIVE, {
      consumeRelease: true,
    })
  ) {
    return false;
  }
  markFelizJuevesShown(dateKey);
  recordRandomEventTrigger();
  showFelizJuevesWindow();
  return true;
};

const isNazarVisible = () => isManagedRandomEventWindowVisible(nazarWindow);

const showNazarWindow = () => {
  showManagedRandomEventWindow(nazarWindow);
};

const closeNazarWindow = () => {
  closeManagedRandomEventWindow(nazarWindow);
};

const isSiteGraceVisible = () => isManagedRandomEventWindowVisible(siteGraceWindow);

const showSiteGraceWindow = () => {
  showManagedRandomEventWindow(siteGraceWindow);
};

const closeSiteGraceWindow = () => {
  closeManagedRandomEventWindow(siteGraceWindow);
};

const showLostGraceOverlay = () => {
  if (!lostGraceOverlay) return;
  if (lostGraceOverlayTimer) clearTimeout(lostGraceOverlayTimer);
  loadDeferredMedia(lostGraceOverlay);
  lostGraceOverlay.classList.remove("is-visible");
  void lostGraceOverlay.offsetWidth;
  lostGraceOverlay.setAttribute("aria-hidden", "false");
  lostGraceOverlay.classList.add("is-visible");
  lostGraceOverlayTimer = setTimeout(() => {
    lostGraceOverlay.classList.remove("is-visible");
    lostGraceOverlay.setAttribute("aria-hidden", "true");
    lostGraceOverlayTimer = null;
  }, 4800);
};

const touchSiteGrace = () => {
  closeSiteGraceWindow();
  showLostGraceOverlay();
};

const isLainAlertVisible = () =>
  isManagedRandomEventWindowVisible(lainAlertWindow);

const resetLainAlert = () => {
  const focusTarget = lainAlertFocusReturn;
  lainAlertFocusReturn = null;
  if (
    focusTarget?.isConnected &&
    !focusTarget.closest("[inert]") &&
    typeof focusTarget.focus === "function"
  ) {
    focusTarget.focus({ preventScroll: true });
  }
};

const showLainAlert = () => {
  const focusReturn =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const didOpen = showManagedRandomEventWindow(lainAlertWindow);
  if (!didOpen) return false;
  lainAlertFocusReturn = focusReturn;
  requestAnimationFrame(() => lainAlertClose?.focus({ preventScroll: true }));
  return true;
};

const closeLainAlert = () => {
  closeManagedRandomEventWindow(lainAlertWindow);
};

const isLelouchAlertVisible = () =>
  isManagedRandomEventWindowVisible(lelouchAlertWindow);

const showLelouchAlert = () => {
  showManagedRandomEventWindow(lelouchAlertWindow);
};

const closeLelouchAlert = () => {
  closeManagedRandomEventWindow(lelouchAlertWindow);
};

const isBerserkSunriseTimeWindow = (date = new Date()) => {
  const hour = date.getHours();
  return hour >= 5 && hour < 19;
};

const isBerserkSunriseVisible = () =>
  isManagedRandomEventWindowVisible(berserkSunriseWindow);

const showBerserkSunrise = () => {
  showManagedRandomEventWindow(berserkSunriseWindow, { clampAfterMediaLoad: true });
};

const closeBerserkSunrise = () => {
  closeManagedRandomEventWindow(berserkSunriseWindow);
};

const isDeathNoteVisible = () => isManagedRandomEventWindowVisible(deathNoteWindow);

const limitDeathNoteEntryToVisibleLines = () => {
  if (!deathNoteEntry) return;
  deathNoteEntry.scrollTop = 0;
  if (deathNoteEntry.clientHeight <= 0) return;
  const initialValue = deathNoteEntry.value;
  const selectionStart = deathNoteEntry.selectionStart;
  const selectionEnd = deathNoteEntry.selectionEnd;
  let value = initialValue;

  while (deathNoteEntry.scrollHeight > deathNoteEntry.clientHeight && value) {
    const finalLineBreak = value.lastIndexOf("\n");
    value = finalLineBreak >= 0 ? value.slice(0, finalLineBreak) : value.slice(0, -1);
    deathNoteEntry.value = value;
  }

  if (value !== initialValue) {
    deathNoteEntry.setSelectionRange(
      Math.min(selectionStart, value.length),
      Math.min(selectionEnd, value.length)
    );
  }
};

const showDeathNoteWindow = () => {
  const didOpen = showManagedRandomEventWindow(deathNoteWindow, {
    beforeShow: () => {
      if (deathNoteEntry) {
        deathNoteEntry.value = "";
        limitDeathNoteEntryToVisibleLines();
      }
    },
    clampAfterMediaLoad: true,
  });
  if (didOpen) {
    requestAnimationFrame(() => {
      deathNoteEntry?.focus({ preventScroll: true });
    });
  }
};

const closeDeathNoteWindow = () => {
  closeManagedRandomEventWindow(deathNoteWindow);
};

const CURRENT_PUBLIC_INFO_ASSETS = Object.freeze([
  "assets/random%20events/current-publicly-available-information/season-1.webp",
  "assets/random%20events/current-publicly-available-information/season-2.webp",
  "assets/random%20events/current-publicly-available-information/season-3.webp",
  "assets/random%20events/current-publicly-available-information/final-season.webp",
  "assets/random%20events/current-publicly-available-information/ova.webp",
]);

const isCurrentPublicInfoVisible = () =>
  isManagedRandomEventWindowVisible(currentPublicInfoWindow);

const selectCurrentPublicInfoImage = () => {
  if (!currentPublicInfoImage || !CURRENT_PUBLIC_INFO_ASSETS.length) return;
  const selected =
    CURRENT_PUBLIC_INFO_ASSETS[
      Math.floor(Math.random() * CURRENT_PUBLIC_INFO_ASSETS.length)
    ];
  if (currentPublicInfoImage.dataset.src !== selected) {
    currentPublicInfoImage.removeAttribute("src");
  }
  currentPublicInfoImage.dataset.src = selected;
};

const showCurrentPublicInfoWindow = () => {
  showManagedRandomEventWindow(currentPublicInfoWindow, {
    beforeShow: selectCurrentPublicInfoImage,
    clampAfterMediaLoad: true,
  });
};

const closeCurrentPublicInfoWindow = () => {
  closeManagedRandomEventWindow(currentPublicInfoWindow);
};

const isTrnaRequestVisible = () => isManagedRandomEventWindowVisible(trnaRequestWindow);

const showTrnaRequestWindow = () => {
  showManagedRandomEventWindow(trnaRequestWindow, { clampAfterMediaLoad: true });
};

const closeTrnaRequestWindow = () => {
  closeManagedRandomEventWindow(trnaRequestWindow);
};

const isNatarajaVisible = () => isManagedRandomEventWindowVisible(natarajaWindow);

const playNatarajaVideo = () => {
  if (!natarajaVideo) return;
  natarajaVideo.play().catch(() => undefined);
};

const resetNatarajaVideo = () => {
  if (!natarajaVideo) return;
  natarajaVideo.pause();
  try {
    natarajaVideo.currentTime = 0;
  } catch (error) {
    // Some browsers reject seeking before video metadata is ready.
  }
};

const showNatarajaWindow = () => {
  const didOpen = showManagedRandomEventWindow(natarajaWindow, {
    clampAfterMediaLoad: true,
  });
  if (didOpen) requestAnimationFrame(playNatarajaVideo);
};

const closeNatarajaWindow = () => {
  resetNatarajaVideo();
  closeManagedRandomEventWindow(natarajaWindow);
};

const isBehelitVisible = () => isManagedRandomEventWindowVisible(behelitWindow);

const showBehelitWindow = () => {
  showManagedRandomEventWindow(behelitWindow, {
    onFront: () => clampRandomEventWindowToViewport(behelitWindow),
    clampAfterMediaLoad: true,
  });
};

const closeBehelitWindow = () => {
  closeManagedRandomEventWindow(behelitWindow);
};

const isJohnPorkVisible = () => isManagedRandomEventWindowVisible(johnPorkWindow);

const updateJohnPorkStatus = () => {
  if (!johnPorkStatus) return;
  const dots = ".".repeat(johnPorkStatusFrame % 4);
  johnPorkStatus.textContent = `Incoming call${dots}`;
  johnPorkStatusFrame += 1;
};

const startJohnPorkStatus = () => {
  if (johnPorkStatusTimer) return;
  johnPorkStatusFrame = 0;
  updateJohnPorkStatus();
  johnPorkStatusTimer = setInterval(updateJohnPorkStatus, 420);
};

const stopJohnPorkStatus = () => {
  if (johnPorkStatusTimer) {
    clearInterval(johnPorkStatusTimer);
    johnPorkStatusTimer = null;
  }
  johnPorkStatusFrame = 0;
  if (johnPorkStatus) johnPorkStatus.textContent = "Incoming call";
};

const showJohnPorkCall = () => {
  showManagedRandomEventWindow(johnPorkWindow, {
    afterShow: startJohnPorkStatus,
  });
};

const closeJohnPorkCall = () => {
  closeManagedRandomEventWindow(johnPorkWindow, {
    beforeClose: stopJohnPorkStatus,
  });
};

const isAdvertisementVisible = () =>
  isManagedRandomEventWindowVisible(advertisementWindow);

const showAdvertisementWindow = () => {
  showManagedRandomEventWindow(advertisementWindow);
};

const closeAdvertisementWindow = () => {
  closeManagedRandomEventWindow(advertisementWindow);
};

const isSaulAdVisible = () => isManagedRandomEventWindowVisible(saulAdWindow);

const showSaulAdWindow = () => {
  if (!saulAdWindow) return;
  if (isSaulAdVisible()) {
    saulAdWindow.style.zIndex = String(nextWindowZIndex());
    return;
  }
  if (saulAdImage) {
    const imageSrc = SAUL_AD_IMAGES[Math.floor(Math.random() * SAUL_AD_IMAGES.length)];
    saulAdImage.removeAttribute("src");
    saulAdImage.dataset.src = imageSrc;
  }
  showManagedRandomEventWindow(saulAdWindow, { clampAfterMediaLoad: true });
};

const closeSaulAdWindow = () => {
  closeManagedRandomEventWindow(saulAdWindow);
};

const isKidnamedfingerVisible = () =>
  isManagedRandomEventWindowVisible(kidnamedfingerWindow);

const showKidnamedfingerWindow = () => {
  showManagedRandomEventWindow(kidnamedfingerWindow, { clampAfterMediaLoad: true });
};

const closeKidnamedfingerWindow = () => {
  closeManagedRandomEventWindow(kidnamedfingerWindow);
};

const isWalterWhiteVisible = () => isManagedRandomEventWindowVisible(walterWhiteWindow);

const showWalterWhiteWindow = () => {
  showManagedRandomEventWindow(walterWhiteWindow, { clampAfterMediaLoad: true });
};

const closeWalterWhiteWindow = () => {
  closeManagedRandomEventWindow(walterWhiteWindow);
};

const isBountyHunterVisible = () =>
  isManagedRandomEventWindowVisible(bountyHunterWindow);

const showBountyHunterWindow = () => {
  showManagedRandomEventWindow(bountyHunterWindow, { clampAfterMediaLoad: true });
};

const closeBountyHunterWindow = () => {
  closeManagedRandomEventWindow(bountyHunterWindow);
};

registerRandomEvent({
  id: "self-love-system-alert",
  preloadTargets: () => [selfLoveAlertWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isSelfLoveAlertVisible,
  canTrigger: () => !isSelfLoveAlertVisible(),
  run: () => {
    showSelfLoveAlert();
  },
  bind: () => {
    if (selfLoveAlertClose) {
      selfLoveAlertClose.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        flashSelfLoveYes();
      });
    }

    if (selfLoveAlertYes) {
      selfLoveAlertYes.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSelfLoveAlert();
      });
    }

    [selfLoveAlertNo].forEach((button) => {
      if (!button) return;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        flashSelfLoveYes();
      });
    });

    bindManagedRandomEventWindowAnimation(selfLoveAlertWindow, {
      closingClasses: ["is-yes-flashing"],
      unloadImages: false,
    });
  },
});

registerRandomEvent({
  id: "rohin-os-note",
  preloadTargets: () => [rohinNoteWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isRohinNoteVisible,
  canTrigger: () => !isRohinNoteVisible(),
  run: () => {
    showRohinNote();
  },
  bind: () => {
    if (rohinNoteOk) {
      rohinNoteOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeRohinNote();
      });
    }

    bindManagedRandomEventWindowAnimation(rohinNoteWindow, { unloadImages: false });
  },
});

registerRandomEvent({
  id: "earth-proverb-note",
  preloadTargets: () => [earthNoteWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isEarthNoteVisible,
  canTrigger: () => !isEarthNoteVisible(),
  run: () => {
    showEarthNote();
  },
  bind: () => {
    if (earthNoteOk) {
      earthNoteOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeEarthNote();
      });
    }

    bindManagedRandomEventWindowAnimation(earthNoteWindow, { unloadImages: false });
  },
});

registerRandomEvent({
  id: "health-note",
  preloadTargets: () => [healthNoteWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isHealthNoteVisible,
  canTrigger: () => !isHealthNoteVisible(),
  run: () => {
    showHealthNote();
  },
  bind: () => {
    if (healthNoteOk) {
      healthNoteOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeHealthNote();
      });
    }

    bindManagedRandomEventWindowAnimation(healthNoteWindow, { unloadImages: false });
  },
});

registerRandomEvent({
  id: "love-note",
  preloadTargets: () => [loveNoteWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isLoveNoteVisible,
  canTrigger: () => !isLoveNoteVisible(),
  run: () => {
    showLoveNote();
  },
  bind: () => {
    if (loveNoteOk) {
      loveNoteOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeLoveNote();
      });
    }

    bindManagedRandomEventWindowAnimation(loveNoteWindow, { unloadImages: false });
  },
});

registerRandomEvent({
  id: "no-smoking-alert",
  preloadTargets: () => [noSmokingWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isNoSmokingVisible,
  canTrigger: () => !isNoSmokingVisible(),
  run: () => {
    showNoSmokingWindow();
  },
  bind: () => {
    if (noSmokingOk) {
      noSmokingOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeNoSmokingWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(noSmokingWindow);
  },
});

registerRandomEvent({
  id: "possum-springs-bulletin",
  preloadTargets: () => [possumSpringsWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isPossumSpringsVisible,
  canTrigger: () => !isPossumSpringsVisible(),
  run: () => {
    showPossumSpringsWindow();
  },
  bind: () => {
    if (possumSpringsOk) {
      possumSpringsOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closePossumSpringsWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(possumSpringsWindow);
  },
});

registerRandomEvent({
  id: "winged-light",
  preloadTargets: () => [wingedLightWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isWingedLightVisible,
  canTrigger: () => !isWingedLightVisible(),
  run: () => {
    showWingedLightWindow();
  },
  bind: () => {
    if (wingedLightCollect) {
      wingedLightCollect.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        collectWingedLight();
      });
    }

    if (wingedLightLater) {
      wingedLightLater.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeWingedLightWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(wingedLightWindow);
  },
});

registerRandomEvent({
  id: "mana-flood",
  preloadTargets: () => [manaFloodWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isManaFloodVisible,
  canTrigger: () => !isManaFloodVisible(),
  run: () => {
    showManaFlood();
  },
  bind: () => {
    if (manaFloodOk) {
      manaFloodOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeManaFlood();
      });
    }

    bindManagedRandomEventWindowAnimation(manaFloodWindow, { unloadImages: false });
  },
});

registerRandomEvent({
  id: "mimic-warning",
  preloadTargets: () => [mimicWarningWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isMimicWarningVisible,
  canTrigger: () => !isMimicWarningVisible(),
  run: () => {
    showMimicWarning();
  },
  bind: () => {
    if (mimicWarningOk) {
      mimicWarningOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeMimicWarning();
      });
    }

    bindManagedRandomEventWindowAnimation(mimicWarningWindow, { unloadImages: false });
  },
});

registerRandomEvent({
  id: "nazar-evil-eye",
  preloadTargets: () => [nazarWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isNazarVisible,
  canTrigger: () => !isNazarVisible(),
  run: () => {
    showNazarWindow();
  },
  bind: () => {
    [nazarClose, nazarYes, nazarNo].forEach((button) => {
      if (!button) return;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeNazarWindow();
      });
    });

    bindManagedRandomEventWindowAnimation(nazarWindow);
  },
});

registerRandomEvent({
  id: "site-of-grace",
  preloadTargets: () => [siteGraceWindow, lostGraceOverlay],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isSiteGraceVisible,
  canTrigger: () => !isSiteGraceVisible(),
  run: () => {
    showSiteGraceWindow();
  },
  bind: () => {
    if (siteGraceTouch) {
      siteGraceTouch.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        touchSiteGrace();
      });
    }

    if (siteGraceKeep) {
      siteGraceKeep.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSiteGraceWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(siteGraceWindow);
  },
});

registerRandomEvent({
  id: "lain-system-alert",
  preloadTargets: () => [lainAlertWindow],
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isLainAlertVisible,
  canTrigger: () => !isLainAlertVisible(),
  run: () => {
    showLainAlert();
  },
  bind: () => {
    bindRandomEventButton(lainAlertClose, closeLainAlert);
    bindManagedRandomEventWindowAnimation(lainAlertWindow, {
      afterClose: resetLainAlert,
    });
    lainAlertWindow?.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeLainAlert();
    });
  },
});

registerRandomEvent({
  id: "lelouch-system-alert",
  preloadTargets: () => [lelouchAlertWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isLelouchAlertVisible,
  canTrigger: () => !isLelouchAlertVisible(),
  run: () => {
    showLelouchAlert();
  },
  bind: () => {
    bindRandomEventButton(lelouchAlertOk, closeLelouchAlert);
    bindManagedRandomEventWindowAnimation(lelouchAlertWindow);
  },
});

registerRandomEvent({
  id: "berserk-sunrise",
  preloadTargets: () => [berserkSunriseWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isBerserkSunriseVisible,
  canTrigger: () => isBerserkSunriseTimeWindow() && !isBerserkSunriseVisible(),
  run: () => {
    showBerserkSunrise();
  },
  bind: () => {
    bindRandomEventButton(berserkSunriseOk, closeBerserkSunrise);
    bindManagedRandomEventWindowAnimation(berserkSunriseWindow);
  },
});

registerRandomEvent({
  id: "death-note",
  preloadTargets: () => [deathNoteWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isDeathNoteVisible,
  canTrigger: () => !isDeathNoteVisible(),
  run: () => {
    showDeathNoteWindow();
  },
  bind: () => {
    bindRandomEventButton(deathNoteClose, closeDeathNoteWindow);
    bindRandomEventButton(deathNoteTitleClose, closeDeathNoteWindow);
    bindManagedRandomEventWindowAnimation(deathNoteWindow, { unloadImages: false });
    deathNoteEntry?.addEventListener("input", limitDeathNoteEntryToVisibleLines);
    deathNoteWindow?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target?.closest(".death-note-lined-page")) return;
      deathNoteEntry?.focus({ preventScroll: true });
      const cursorPosition = deathNoteEntry?.value.length || 0;
      deathNoteEntry?.setSelectionRange(cursorPosition, cursorPosition);
    });
  },
});

registerRandomEvent({
  id: "current-publicly-available-information",
  preloadTargets: () => [
    currentPublicInfoWindow,
    CURRENT_PUBLIC_INFO_ASSETS,
  ],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isCurrentPublicInfoVisible,
  canTrigger: () => !isCurrentPublicInfoVisible(),
  run: () => {
    showCurrentPublicInfoWindow();
  },
  bind: () => {
    bindRandomEventButton(currentPublicInfoClose, closeCurrentPublicInfoWindow);
    bindRandomEventButton(currentPublicInfoThanks, closeCurrentPublicInfoWindow);
    bindManagedRandomEventWindowAnimation(currentPublicInfoWindow);
  },
});

registerRandomEvent({
  id: "spare-a-trna",
  preloadTargets: () => [trnaRequestWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isTrnaRequestVisible,
  canTrigger: () => !isTrnaRequestVisible(),
  run: () => {
    showTrnaRequestWindow();
  },
  bind: () => {
    bindRandomEventButton(trnaRequestYes, closeTrnaRequestWindow);
    bindRandomEventButton(trnaRequestNo, closeTrnaRequestWindow);
    bindManagedRandomEventWindowAnimation(trnaRequestWindow);
  },
});

registerRandomEvent({
  id: "nataraja",
  preloadTargets: () => [natarajaWindow, "assets/random%20events/nataraja.mp4"],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isNatarajaVisible,
  canTrigger: () => !isNatarajaVisible(),
  run: () => {
    showNatarajaWindow();
  },
  bind: () => {
    bindRandomEventButton(natarajaYes, closeNatarajaWindow);
    bindRandomEventButton(natarajaNo, closeNatarajaWindow);
    bindManagedRandomEventWindowAnimation(natarajaWindow, {
      afterClose: resetNatarajaVideo,
      unloadImages: false,
    });
  },
});

registerRandomEvent({
  id: "behelit-found",
  preloadTargets: () => [behelitWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isBehelitVisible,
  canTrigger: () => !isBehelitVisible(),
  run: () => {
    showBehelitWindow();
  },
  bind: () => {
    if (behelitOk) {
      behelitOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeBehelitWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(behelitWindow);
  },
});

registerRandomEvent({
  id: "john-pork",
  preloadTargets: () => [johnPorkWindow],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isJohnPorkVisible,
  canTrigger: () => !isJohnPorkVisible(),
  run: () => {
    showJohnPorkCall();
  },
  bind: () => {
    [johnPorkClose, johnPorkAccept, johnPorkDecline].forEach((button) => {
      if (!button) return;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeJohnPorkCall();
      });
    });

    bindManagedRandomEventWindowAnimation(johnPorkWindow, {
      afterClose: stopJohnPorkStatus,
    });
  },
});

registerRandomEvent({
  id: "saul-advertisement",
  preloadTargets: () => [saulAdWindow, SAUL_AD_IMAGES],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isSaulAdVisible,
  canTrigger: () => !isSaulAdVisible(),
  run: () => {
    showSaulAdWindow();
  },
  bind: () => {
    if (saulAdClose) {
      saulAdClose.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSaulAdWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(saulAdWindow);
  },
});

registerRandomEvent({
  id: "kidnamedfinger",
  preloadTargets: () => [kidnamedfingerWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isKidnamedfingerVisible,
  canTrigger: () => !isKidnamedfingerVisible(),
  run: () => {
    showKidnamedfingerWindow();
  },
  bind: () => {
    if (kidnamedfingerOk) {
      kidnamedfingerOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeKidnamedfingerWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(kidnamedfingerWindow);
  },
});

registerRandomEvent({
  id: "walter-white",
  preloadTargets: () => [walterWhiteWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isWalterWhiteVisible,
  canTrigger: () => !isWalterWhiteVisible(),
  run: () => {
    showWalterWhiteWindow();
  },
  bind: () => {
    if (walterWhiteOk) {
      walterWhiteOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeWalterWhiteWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(walterWhiteWindow);
  },
});

registerRandomEvent({
  id: "bounty-hunter-announcement",
  preloadTargets: () => [bountyHunterWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isBountyHunterVisible,
  canTrigger: () => !isBountyHunterVisible(),
  run: () => {
    showBountyHunterWindow();
  },
  bind: () => {
    if (bountyHunterClose) {
      bountyHunterClose.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeBountyHunterWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(bountyHunterWindow);
  },
});

registerRandomEvent({
  id: "evil-wizards-advertisement",
  preloadTargets: () => [advertisementWindow],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isAdvertisementVisible,
  canTrigger: () => !isAdvertisementVisible(),
  run: () => {
    showAdvertisementWindow();
  },
  bind: () => {
    if (advertisementNoThanks) {
      advertisementNoThanks.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeAdvertisementWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(advertisementWindow);
  },
});

if (felizJuevesClose) {
  felizJuevesClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    flashFelizJuevesChoice();
  });
}

if (felizJuevesGracias) {
  felizJuevesGracias.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeFelizJuevesWindow();
  });
}

// Feliz Jueves is never scheduled: it is what a Thursday calendar visit or a
// game win shows when no other event fired.
registerRandomEventFallback({
  triggers: ["calendarOpen", "gameWin"],
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isFelizJuevesVisible,
  run: maybeShowFelizJueves,
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  felizJuevesWindow,
  selfLoveAlertWindow,
  rohinNoteWindow,
  earthNoteWindow,
  healthNoteWindow,
  loveNoteWindow,
  noSmokingWindow,
  possumSpringsWindow,
  wingedLightWindow,
  manaFloodWindow,
  mimicWarningWindow,
  nazarWindow,
  siteGraceWindow,
  lainAlertWindow,
  lelouchAlertWindow,
  berserkSunriseWindow,
  deathNoteWindow,
  currentPublicInfoWindow,
  trnaRequestWindow,
  natarajaWindow,
  behelitWindow,
  johnPorkWindow,
  advertisementWindow,
  saulAdWindow,
  kidnamedfingerWindow,
  walterWhiteWindow,
  bountyHunterWindow,
]);

bindManagedRandomEventWindowAnimation(felizJuevesWindow, {
  closingClasses: ["is-choice-flashing"],
});

window.homeEventNotes = Object.freeze({
  CURRENT_PUBLIC_INFO_ASSETS,
  SAUL_AD_IMAGES,
  advertisementWindow,
  behelitWindow,
  berserkSunriseWindow,
  bountyHunterWindow,
  closeFelizJuevesWindow,
  currentPublicInfoWindow,
  deathNoteWindow,
  earthNoteWindow,
  felizJuevesWindow,
  healthNoteWindow,
  isFelizJuevesVisible,
  johnPorkWindow,
  kidnamedfingerWindow,
  lainAlertWindow,
  lelouchAlertWindow,
  lostGraceOverlay,
  loveNoteWindow,
  manaFloodWindow,
  maybeShowFelizJueves,
  mimicWarningWindow,
  natarajaWindow,
  nazarWindow,
  noSmokingWindow,
  possumSpringsWindow,
  rohinNoteWindow,
  saulAdWindow,
  selfLoveAlertWindow,
  showFelizJuevesWindow,
  siteGraceWindow,
  trnaRequestWindow,
  walterWhiteWindow,
  wingedLightWindow,
});
})();