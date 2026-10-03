(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  RANDOM_EVENT_TASKBAR_CLEARANCE,
  RANDOM_EVENT_VIEWPORT_PADDING,
  bindManagedRandomEventWindowAnimation,
  closeManagedRandomEventWindow,
  getRandomEventVisualInsets,
  isManagedRandomEventWindowVisible,
  positionRandomEventWindowInViewport,
  registerRandomEvent,
  registerRandomEventWindows,
  registerRandomEventVisualScale,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clearPokemonStyleDialogueTyping,
  setPokemonStyleDialogueText,
  setPokemonStyleSegmentedDialogue,
} = window.homeEventDialogue;
const {
  registerViewportObserver,
} = window.homeWindows;

const relicRecoveryWindow = byId("relic-recovery-window");
const relicRecoveryScene = byId("relic-recovery-scene");
const relicRecoveryRelics = byId("relic-recovery-relics");
const relicRecoveryHotbar = byId("relic-recovery-hotbar");
const relicRecoveryDialog = byId("relic-recovery-dialog");
const relicRecoveryDialogText = byId("relic-recovery-dialog-text");
const relicRecoveryDialogActions = byId("relic-recovery-dialog-actions");
const relicRecoveryStart = byId("relic-recovery-start");
const relicRecoveryDecline = byId("relic-recovery-decline");
const relicRecoveryContinue = byId("relic-recovery-continue");
const relicRecoveryDetail = byId("relic-recovery-detail");
const relicRecoveryDetailImage = byId("relic-recovery-detail-image");
const relicRecoveryDetailName = byId("relic-recovery-detail-name");
const relicRecoveryDetailDescription = byId("relic-recovery-detail-description");

const RELIC_RECOVERY_ASSETS = Object.freeze({
  background: "assets/random%20events/made-in-abyss-background.webp",
  nanachi: "assets/random%20events/nanachi-icon.webp",
  offering: "assets/random%20events/relic-recovery/offering.webp",
  uglySpinner: "assets/random%20events/relic-recovery/ugly-spinner.webp",
  ivyBadge: "assets/random%20events/relic-recovery/ivy-badge.webp",
  pulledTeeth: "assets/random%20events/relic-recovery/pulled-teeth.webp",
  doubleBellBall: "assets/random%20events/relic-recovery/double-bell-ball.webp",
  spiralingHeatStone:
    "assets/random%20events/relic-recovery/spiraling-heat-stone.webp",
  shatterPot: "assets/random%20events/relic-recovery/shatter-pot.webp",
  tangledFluid: "assets/random%20events/relic-recovery/tangled-fluid.webp",
});

const RELIC_RECOVERY_ITEMS = Object.freeze([
  {
    id: "offering",
    name: "Offering",
    description: "A coin-shaped Relic material.",
    image: RELIC_RECOVERY_ASSETS.offering,
    color: "#d8a64a",
    x: 80,
    y: 34,
    scale: 0.58,
    depth: 2,
  },
  {
    id: "ugly-spinner",
    name: "Ugly Spinner",
    description:
      "A material used to make Relic equipment. If you try to stack them, they spin away for some reason.",
    image: RELIC_RECOVERY_ASSETS.uglySpinner,
    color: "#8e6f46",
    x: 28,
    y: 66,
    scale: 1.12,
    depth: 6,
  },
  {
    id: "ivy-badge",
    name: "Ivy Badge",
    description: "A badge-like Relic material.",
    image: RELIC_RECOVERY_ASSETS.ivyBadge,
    color: "#5f8f52",
    x: 54,
    y: 44,
    scale: 0.68,
    depth: 3,
  },
  {
    id: "pulled-teeth",
    name: "Pulled Teeth",
    description: "A Relic material that resembles a pulled tooth.",
    image: RELIC_RECOVERY_ASSETS.pulledTeeth,
    color: "#d8d0b9",
    x: 79,
    y: 47,
    scale: 0.7,
    depth: 3,
  },
  {
    id: "double-bell-ball",
    name: "Double-Bell Ball",
    description:
      "A ball within a ball. It makes a strange sound when shaken. It's softer than it looks.",
    image: RELIC_RECOVERY_ASSETS.doubleBellBall,
    color: "#c98536",
    x: 87,
    y: 41,
    scale: 0.66,
    depth: 3,
  },
  {
    id: "spiraling-heat-stone",
    name: "Spiraling Heat Stone",
    description:
      "A material used for Relic equipment. Squeezing it will cause the rock in the middle to emit heat.",
    image: RELIC_RECOVERY_ASSETS.spiralingHeatStone,
    color: "#cf7241",
    x: 24,
    y: 31,
    scale: 0.54,
    depth: 1,
  },
  {
    id: "shatter-pot",
    name: "Shatter Pot",
    description:
      "A material that looks like shattered pot pieces. Surprisingly, they're extremely hard.",
    image: RELIC_RECOVERY_ASSETS.shatterPot,
    color: "#8f7b68",
    x: 62,
    y: 68,
    scale: 1.24,
    depth: 7,
  },
  {
    id: "tangled-fluid",
    name: "Tangled Fluid",
    description: "The inner fluids can be used as a strong adhesive.",
    image: RELIC_RECOVERY_ASSETS.tangledFluid,
    color: "#9a77b9",
    x: 43,
    y: 44,
    scale: 0.66,
    depth: 2,
  },
]);

const RELIC_RECOVERY_STAGE_PROMPT = "prompt";

const RELIC_RECOVERY_STAGE_ACTIVE = "active";

const RELIC_RECOVERY_STAGE_DETAIL = "detail";

const RELIC_RECOVERY_STAGE_COMPLETE = "complete";

let relicRecoveryStage = RELIC_RECOVERY_STAGE_PROMPT;

let relicRecoveryCollectedIds = new Set();

let relicRecoveryPendingId = "";

let relicRecoveryFlyingId = "";

let relicRecoveryDetailCloseTimer = 0;

let relicRecoveryFlyTimer = 0;

const isRelicRecoveryVisible = () =>
  isManagedRandomEventWindowVisible(relicRecoveryWindow);

const setRelicRecoveryElementHidden = (element, hidden) => {
  if (!element) return;
  element.classList.toggle("is-hidden", hidden);
  element.setAttribute("aria-hidden", String(hidden));
};

const getRelicRecoveryItem = (relicId) =>
  RELIC_RECOVERY_ITEMS.find((item) => item.id === relicId);

const clearRelicRecoveryDetailCloseTimer = () => {
  if (!relicRecoveryDetailCloseTimer) return;
  window.clearTimeout(relicRecoveryDetailCloseTimer);
  relicRecoveryDetailCloseTimer = 0;
};

const clearRelicRecoveryFlyTimer = () => {
  if (!relicRecoveryFlyTimer) return;
  window.clearTimeout(relicRecoveryFlyTimer);
  relicRecoveryFlyTimer = 0;
};

const clearRelicRecoveryFlyers = () => {
  clearRelicRecoveryFlyTimer();
  relicRecoveryFlyingId = "";
  relicRecoveryScene
    ?.querySelectorAll(".relic-recovery-flyer")
    .forEach((flyer) => flyer.remove());
};

const clearRelicRecoveryTyping = () => {
  clearPokemonStyleDialogueTyping(relicRecoveryDialogText);
};

const relicRecoveryNotableSegment = (text, colorClass) => ({
  text,
  className: `pokemon-dialogue-name ${colorClass}`,
});

const setRelicRecoveryDialog = (
  message,
  { complete = false, instant = false } = {}
) => {
  if (complete) {
    const segments = [
      { text: "Thanks for all the help. See you in " },
      relicRecoveryNotableSegment("Layer 2", "pokemon-starter-type-color--water"),
      { text: "!" },
    ];
    if (instant) {
      setPokemonStyleDialogueText(relicRecoveryDialogText, message, {
        instant: true,
        arrow: true,
      });
    } else {
      setPokemonStyleSegmentedDialogue(relicRecoveryDialogText, segments, {
        arrow: true,
      });
    }
  } else {
    const segments = [
      { text: "Let's collect some " },
      relicRecoveryNotableSegment("relics", "pokemon-starter-type-color--grass"),
      { text: "!" },
    ];
    if (instant) {
      setPokemonStyleDialogueText(relicRecoveryDialogText, message, {
        instant: true,
        arrow: true,
      });
    } else {
      setPokemonStyleSegmentedDialogue(relicRecoveryDialogText, segments, {
        arrow: true,
      });
    }
  }
  setRelicRecoveryElementHidden(relicRecoveryDialog, false);
  setRelicRecoveryElementHidden(relicRecoveryStart, complete);
  setRelicRecoveryElementHidden(relicRecoveryDecline, complete);
  setRelicRecoveryElementHidden(relicRecoveryContinue, !complete);
  relicRecoveryDialogActions?.classList.remove("is-hidden");
};

const renderRelicRecoveryHotbar = () => {
  if (!relicRecoveryHotbar) return;
  const slots = RELIC_RECOVERY_ITEMS.map((item) => {
    const slot = document.createElement("span");
    slot.className = "relic-recovery-slot";
    slot.dataset.relicRecoverySlot = item.id;
    const collected = relicRecoveryCollectedIds.has(item.id);
    slot.classList.toggle("is-collected", collected);
    slot.setAttribute(
      "aria-label",
      collected ? `${item.name}: ${item.description}` : `Unrecovered ${item.name}`
    );
    if (collected) {
      slot.dataset.relicTooltipName = item.name;
      slot.dataset.relicTooltipDescription = item.description;
      slot.tabIndex = 0;
    }
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = collected ? item.name : "";
    image.setAttribute("aria-hidden", String(!collected));
    slot.append(image);
    if (collected) {
      const tooltip = document.createElement("span");
      tooltip.className = "relic-recovery-tooltip";
      tooltip.setAttribute("role", "tooltip");

      const tooltipName = document.createElement("strong");
      tooltipName.textContent = item.name;
      tooltipName.style.color = item.color;

      const tooltipDescription = document.createElement("span");
      tooltipDescription.textContent = item.description;

      tooltip.append(tooltipName, tooltipDescription);
      slot.append(tooltip);
    }
    return slot;
  });
  relicRecoveryHotbar.replaceChildren(...slots);
};

const renderRelicRecoveryItems = () => {
  if (!relicRecoveryRelics) return;
  const relicButtons = RELIC_RECOVERY_ITEMS.filter(
    (item) =>
      !relicRecoveryCollectedIds.has(item.id) &&
      item.id !== relicRecoveryPendingId &&
      item.id !== relicRecoveryFlyingId
  ).map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "relic-recovery-item";
    button.dataset.relicRecoveryItem = item.id;
    button.style.setProperty("--relic-x", `${item.x}%`);
    button.style.setProperty("--relic-y", `${item.y}%`);
    button.style.setProperty("--relic-scale", String(item.scale));
    button.style.setProperty("--relic-depth", String(item.depth));
    button.setAttribute("aria-label", `Retrieve ${item.name}`);

    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.name;
    button.append(image);
    return button;
  });
  relicRecoveryRelics.replaceChildren(...relicButtons);
};

const renderRelicRecovery = () => {
  renderRelicRecoveryItems();
  renderRelicRecoveryHotbar();
};

const completeRelicRecoveryCollection = (relicId) => {
  if (!relicId) return;
  clearRelicRecoveryFlyers();
  relicRecoveryFlyingId = "";
  relicRecoveryCollectedIds.add(relicId);
  relicRecoveryWindow?.classList.remove("is-detail-open");
  renderRelicRecovery();

  if (relicRecoveryCollectedIds.size >= RELIC_RECOVERY_ITEMS.length) {
    relicRecoveryStage = RELIC_RECOVERY_STAGE_COMPLETE;
    relicRecoveryWindow?.classList.add("is-complete");
    setRelicRecoveryDialog("Thanks for all the help. See you in Layer 2!", {
      complete: true,
    });
    relicRecoveryContinue?.focus({ preventScroll: true });
    return;
  }

  relicRecoveryStage = RELIC_RECOVERY_STAGE_ACTIVE;
};

const animateRelicRecoveryToHotbar = (item) => {
  if (!item || !relicRecoveryScene) {
    completeRelicRecoveryCollection(item?.id || "");
    return;
  }

  clearRelicRecoveryFlyers();
  relicRecoveryFlyingId = item.id;
  renderRelicRecovery();
  const sceneRect = relicRecoveryScene.getBoundingClientRect();
  const targetSlot = relicRecoveryHotbar?.querySelector(
    `[data-relic-recovery-slot="${item.id}"]`
  );
  const targetRect = targetSlot?.getBoundingClientRect();
  if (!sceneRect.width || !sceneRect.height || !targetRect) {
    completeRelicRecoveryCollection(item.id);
    return;
  }
  const fitScale = getRelicRecoveryFitScale();
  const sceneWidth = sceneRect.width / fitScale;
  const sceneHeight = sceneRect.height / fitScale;
  const targetCenterX =
    (targetRect.left + targetRect.width / 2 - sceneRect.left) / fitScale;
  const targetCenterY =
    (targetRect.top + targetRect.height / 2 - sceneRect.top) / fitScale;

  const flyer = document.createElement("img");
  flyer.className = "relic-recovery-flyer";
  flyer.src = item.image;
  flyer.alt = "";
  flyer.setAttribute("aria-hidden", "true");
  flyer.style.setProperty("--fly-start-x", `${sceneWidth * 0.5}px`);
  flyer.style.setProperty("--fly-start-y", `${sceneHeight * 0.48}px`);
  flyer.style.setProperty("--fly-end-x", `${targetCenterX}px`);
  flyer.style.setProperty("--fly-end-y", `${targetCenterY}px`);
  flyer.style.setProperty(
    "--fly-mid-x",
    `${(sceneWidth * 0.5 + targetCenterX) / 2}px`
  );
  flyer.style.setProperty(
    "--fly-mid-y",
    `${Math.min(sceneHeight * 0.48, targetCenterY) - 74}px`
  );
  relicRecoveryScene.append(flyer);

  const finishFly = () => completeRelicRecoveryCollection(item.id);
  flyer.addEventListener("animationend", finishFly, { once: true });
  relicRecoveryFlyTimer = window.setTimeout(finishFly, 760);
};

const resetRelicRecoveryEvent = ({ typewrite = false } = {}) => {
  relicRecoveryStage = RELIC_RECOVERY_STAGE_PROMPT;
  relicRecoveryCollectedIds = new Set();
  relicRecoveryPendingId = "";
  relicRecoveryFlyingId = "";
  clearRelicRecoveryDetailCloseTimer();
  clearRelicRecoveryFlyers();
  relicRecoveryWindow?.classList.remove("is-detail-open", "is-complete");
  relicRecoveryDetail?.classList.remove("is-opening", "is-closing");
  setRelicRecoveryElementHidden(relicRecoveryDetail, true);
  setRelicRecoveryDialog("Let's collect some relics!", { instant: !typewrite });
  renderRelicRecovery();
};

const showRelicRecoveryWindow = () => {
  showManagedRandomEventWindow(relicRecoveryWindow, {
    beforeShow: () => resetRelicRecoveryEvent({ typewrite: true }),
    position: (win) => {
      // The scale fit has to settle before the viewport placement measures it.
      updateRelicRecoveryViewportFit();
      positionRandomEventWindowInViewport(win);
    },
    clampAfterMediaLoad: true,
  });
};

const closeRelicRecoveryWindow = () => {
  closeManagedRandomEventWindow(relicRecoveryWindow, {
    beforeClose: clearRelicRecoveryTyping,
  });
};

const startRelicRecovery = () => {
  if (!isRelicRecoveryVisible()) return;
  clearRelicRecoveryTyping();
  relicRecoveryStage = RELIC_RECOVERY_STAGE_ACTIVE;
  setRelicRecoveryElementHidden(relicRecoveryDialog, true);
  renderRelicRecovery();
};

const showRelicRecoveryDetail = (relicId) => {
  const item = getRelicRecoveryItem(relicId);
  if (!item || relicRecoveryStage !== RELIC_RECOVERY_STAGE_ACTIVE) return;
  relicRecoveryStage = RELIC_RECOVERY_STAGE_DETAIL;
  relicRecoveryPendingId = item.id;
  relicRecoveryWindow?.classList.add("is-detail-open");
  relicRecoveryDetail?.classList.remove("is-closing");
  if (relicRecoveryDetailImage) {
    relicRecoveryDetailImage.src = item.image;
    relicRecoveryDetailImage.alt = item.name;
  }
  if (relicRecoveryDetailName) relicRecoveryDetailName.textContent = item.name;
  if (relicRecoveryDetailDescription) {
    relicRecoveryDetailDescription.textContent = item.description;
  }
  setRelicRecoveryElementHidden(relicRecoveryDetail, false);
  relicRecoveryDetail?.classList.add("is-opening");
  renderRelicRecovery();
  relicRecoveryDetail?.focus({ preventScroll: true });
};

const finishRelicRecoveryDetail = () => {
  if (
    relicRecoveryStage !== RELIC_RECOVERY_STAGE_DETAIL ||
    !relicRecoveryPendingId ||
    relicRecoveryDetail?.classList.contains("is-opening") ||
    relicRecoveryDetail?.classList.contains("is-closing")
  ) {
    return;
  }
  clearRelicRecoveryDetailCloseTimer();
  relicRecoveryDetail?.classList.remove("is-opening");
  relicRecoveryDetail?.classList.add("is-closing");
  relicRecoveryDetailCloseTimer = window.setTimeout(
    completeRelicRecoveryDetailClose,
    220
  );
};

const completeRelicRecoveryDetailClose = () => {
  if (
    relicRecoveryStage !== RELIC_RECOVERY_STAGE_DETAIL ||
    !relicRecoveryPendingId
  ) {
    return;
  }
  clearRelicRecoveryDetailCloseTimer();
  const item = getRelicRecoveryItem(relicRecoveryPendingId);
  relicRecoveryWindow?.classList.remove("is-detail-open");
  relicRecoveryDetail?.classList.remove("is-closing");
  setRelicRecoveryElementHidden(relicRecoveryDetail, true);
  relicRecoveryPendingId = "";
  animateRelicRecoveryToHotbar(item);
};

registerRandomEvent({
  id: "relic-recovery",
  preloadTargets: () => [
    relicRecoveryWindow,
    Object.values(RELIC_RECOVERY_ASSETS),
  ],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isRelicRecoveryVisible,
  canTrigger: () => !isRelicRecoveryVisible(),
  run: () => {
    showRelicRecoveryWindow();
  },
  bind: () => {
    if (relicRecoveryStart) {
      relicRecoveryStart.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startRelicRecovery();
      });
    }

    if (relicRecoveryDecline) {
      relicRecoveryDecline.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeRelicRecoveryWindow();
      });
    }

    if (relicRecoveryContinue) {
      relicRecoveryContinue.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (relicRecoveryStage === RELIC_RECOVERY_STAGE_COMPLETE) {
          closeRelicRecoveryWindow();
        }
      });
    }

    if (relicRecoveryDetail) {
      relicRecoveryDetail.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        finishRelicRecoveryDetail();
      });

      relicRecoveryDetail.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        finishRelicRecoveryDetail();
      });
    }

    bindManagedRandomEventWindowAnimation(relicRecoveryDetail, {
      onClose: completeRelicRecoveryDetailClose,
    });

    if (relicRecoveryRelics) {
      relicRecoveryRelics.addEventListener("click", (event) => {
        const relicButton = event.target.closest("[data-relic-recovery-item]");
        if (!relicButton || !relicRecoveryRelics.contains(relicButton)) return;
        event.preventDefault();
        event.stopPropagation();
        showRelicRecoveryDetail(relicButton.dataset.relicRecoveryItem);
      });
    }

    if (relicRecoveryScene) {
      relicRecoveryScene.addEventListener("click", (event) => {
        if (relicRecoveryStage !== RELIC_RECOVERY_STAGE_DETAIL) return;
        event.preventDefault();
        event.stopPropagation();
        finishRelicRecoveryDetail();
      });
    }

    bindManagedRandomEventWindowAnimation(relicRecoveryWindow, {
      afterClose: () => {
        if (relicRecoveryDetailImage) {
          relicRecoveryDetailImage.removeAttribute("src");
          relicRecoveryDetailImage.alt = "";
        }
        resetRelicRecoveryEvent();
      },
    });
  },
});

const configureRelicRecoveryPreview = (preview) => {
  if (!preview) return;
  preview.classList.remove("is-detail-open", "is-complete");
  preview.querySelectorAll(".relic-recovery-flyer").forEach((flyer) => flyer.remove());

  const detail = preview.querySelector("#relic-recovery-detail");
  detail?.classList.add("is-hidden");
  detail?.classList.remove("is-opening", "is-closing");
  detail?.setAttribute("aria-hidden", "true");

  const dialog = preview.querySelector("#relic-recovery-dialog");
  dialog?.classList.remove("is-hidden");
  dialog?.setAttribute("aria-hidden", "false");
  const dialogText = preview.querySelector("#relic-recovery-dialog-text");
  if (dialogText) dialogText.textContent = "Let's collect some relics!";

  const start = preview.querySelector("#relic-recovery-start");
  const decline = preview.querySelector("#relic-recovery-decline");
  const continueButton = preview.querySelector("#relic-recovery-continue");
  [start, decline].forEach((button) => {
    button?.classList.remove("is-hidden");
    button?.setAttribute("aria-hidden", "false");
  });
  continueButton?.classList.add("is-hidden");
  continueButton?.setAttribute("aria-hidden", "true");
  preview.querySelector("#relic-recovery-dialog-actions")?.classList.remove("is-hidden");

  const ownerDocument = preview.ownerDocument;
  const relics = preview.querySelector("#relic-recovery-relics");
  const relicButtons = RELIC_RECOVERY_ITEMS.map((item) => {
    const button = ownerDocument.createElement("button");
    button.type = "button";
    button.className = "relic-recovery-item";
    button.dataset.relicRecoveryItem = item.id;
    button.style.setProperty("--relic-x", `${item.x}%`);
    button.style.setProperty("--relic-y", `${item.y}%`);
    button.style.setProperty("--relic-scale", String(item.scale));
    button.style.setProperty("--relic-depth", String(item.depth));
    button.setAttribute("aria-label", `Retrieve ${item.name}`);
    const image = ownerDocument.createElement("img");
    image.dataset.src = item.image;
    image.alt = item.name;
    button.append(image);
    return button;
  });
  relics?.replaceChildren(...relicButtons);

  const hotbar = preview.querySelector("#relic-recovery-hotbar");
  const hotbarSlots = RELIC_RECOVERY_ITEMS.map((item) => {
    const slot = ownerDocument.createElement("span");
    slot.className = "relic-recovery-slot";
    slot.dataset.relicRecoverySlot = item.id;
    slot.setAttribute("aria-label", `Unrecovered ${item.name}`);
    const image = ownerDocument.createElement("img");
    image.dataset.src = item.image;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    slot.append(image);
    return slot;
  });
  hotbar?.replaceChildren(...hotbarSlots);
};

const RELIC_RECOVERY_FIT_SCALE_PROPERTY = "--relic-recovery-fit-scale";

const getRelicRecoveryFitScale = () => {
  const scale = Number.parseFloat(
    relicRecoveryWindow?.style.getPropertyValue(RELIC_RECOVERY_FIT_SCALE_PROPERTY)
  );
  return Number.isFinite(scale) && scale > 0 ? Math.min(1, scale) : 1;
};

registerRandomEventVisualScale(relicRecoveryWindow, getRelicRecoveryFitScale);

const updateRelicRecoveryViewportFit = () => {
  if (
    !relicRecoveryWindow ||
    relicRecoveryWindow.classList.contains("is-hidden") ||
    relicRecoveryWindow.offsetWidth <= 0 ||
    relicRecoveryWindow.offsetHeight <= 0
  ) {
    return;
  }

  const previousInsets = getRandomEventVisualInsets(relicRecoveryWindow);
  const previousStyleLeft = Number.parseFloat(relicRecoveryWindow.style.left);
  const previousStyleTop = Number.parseFloat(relicRecoveryWindow.style.top);
  const preserveVisualPosition =
    relicRecoveryWindow.style.left.endsWith("px") &&
    relicRecoveryWindow.style.top.endsWith("px") &&
    Number.isFinite(previousStyleLeft) &&
    Number.isFinite(previousStyleTop);
  const previousVisualLeft = previousStyleLeft + previousInsets.insetX;
  const previousVisualTop = previousStyleTop + previousInsets.insetY;
  const availableWidth = Math.max(
    1,
    window.innerWidth - RANDOM_EVENT_VIEWPORT_PADDING * 2
  );
  const availableHeight = Math.max(
    1,
    window.innerHeight -
      RANDOM_EVENT_TASKBAR_CLEARANCE -
      RANDOM_EVENT_VIEWPORT_PADDING * 2
  );
  const fitScale = Math.min(
    1,
    availableWidth / relicRecoveryWindow.offsetWidth,
    availableHeight / relicRecoveryWindow.offsetHeight
  );
  relicRecoveryWindow.style.setProperty(
    RELIC_RECOVERY_FIT_SCALE_PROPERTY,
    String(fitScale)
  );

  if (!preserveVisualPosition) return;
  const nextInsets = getRandomEventVisualInsets(relicRecoveryWindow);
  relicRecoveryWindow.style.left = `${previousVisualLeft - nextInsets.insetX}px`;
  relicRecoveryWindow.style.top = `${previousVisualTop - nextInsets.insetY}px`;
};

// The scene scales to fit whatever room the window has.
registerViewportObserver({
  onFrame: () => updateRelicRecoveryViewportFit(),
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  relicRecoveryWindow,
]);

window.homeEventRelicRecovery = Object.freeze({
  RELIC_RECOVERY_ASSETS,
  configureRelicRecoveryPreview,
  relicRecoveryWindow,
});
})();
