(() => {
const {
  all,
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  positionRandomEventWindowInViewport,
  registerRandomEvent,
  registerRandomEventWindows,
  setRandomEventWindowPosition,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clampNumber,
} = window.homeUtil;
const {
  setPointerHeldItemCursor,
} = window.homePointerCursor;

const dstNightWindow = byId("dst-night-window");
const dstNightWarning = byId("dst-night-warning");
const dstNightOk = byId("dst-night-ok");
const dstCraftingWindow = byId("dst-crafting-window");
const dstCraftCampfire = byId("dst-craft-campfire");
const dstNightProgress = byId("dst-night-progress");
const dstWoodSource = byId("dst-wood-source");
const dstGrassSource = byId("dst-grass-source");
const dstWoodCount = byId("dst-wood-count");
const dstGrassCount = byId("dst-grass-count");
const dstCraftSlots = all("[data-dst-slot]");
const dstSurviveWindow = byId("dst-survive-window");
const dstSurviveOk = byId("dst-survive-ok");
const dstDarknessWindow = byId("dst-darkness-window");
const dstDarknessOk = byId("dst-darkness-ok");

const DST_NIGHT_DURATION_MS = 7000;

const DST_RECIPE_REQUIREMENTS = {
  wood: 2,
  grass: 3,
};

let dstNightAnimationFrame = 0;

let dstNightTimerStartedAt = 0;

let dstNightCraftingActive = false;

let dstDraggedResource = "";

let dstCarryGhost = null;

let dstLastPointer = {
  x: 0,
  y: 0,
};

let dstCraftState = {
  wood: 0,
  grass: 0,
};

const isDstWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isDstNightVisible = () => isDstWindowVisible(dstNightWindow);

const isDstCraftingVisible = () => isDstWindowVisible(dstCraftingWindow);

const isDstSurviveVisible = () => isDstWindowVisible(dstSurviveWindow);

const isDstDarknessVisible = () => isDstWindowVisible(dstDarknessWindow);

const isDstCampfireEventVisible = () =>
  isDstNightVisible() || isDstCraftingVisible() || isDstSurviveVisible() || isDstDarknessVisible();

const copyDstWindowPosition = (source, target) => {
  if (!source || !target) return false;
  const sourceLeft = Number.parseFloat(source.style.left);
  const sourceTop = Number.parseFloat(source.style.top);
  if (!Number.isFinite(sourceLeft) || !Number.isFinite(sourceTop)) return false;
  setRandomEventWindowPosition(target, sourceLeft, sourceTop);
  return true;
};

// Each campfire window opens where the one it replaced sat, so the chain reads
// as one window changing rather than several appearing in different places.
const positionDstWindow = (win, anchorWindow) => {
  if (copyDstWindowPosition(anchorWindow, win)) return;
  positionRandomEventWindowInViewport(win);
};

const stopDstNightTimer = () => {
  if (dstNightAnimationFrame) {
    window.cancelAnimationFrame(dstNightAnimationFrame);
    dstNightAnimationFrame = 0;
  }
  dstNightTimerStartedAt = 0;
  dstNightCraftingActive = false;
};

const setDstNightProgress = (percent) => {
  if (!dstNightProgress) return;
  const clampedPercent = clampNumber(percent, 0, 100);
  dstNightProgress.style.width = `${clampedPercent}%`;
};

const updateDstCraftCounts = () => {
  const remainingWood = Math.max(0, DST_RECIPE_REQUIREMENTS.wood - dstCraftState.wood);
  const remainingGrass = Math.max(0, DST_RECIPE_REQUIREMENTS.grass - dstCraftState.grass);
  if (dstWoodCount) dstWoodCount.textContent = String(remainingWood);
  if (dstGrassCount) dstGrassCount.textContent = String(remainingGrass);
  if (dstWoodSource) dstWoodSource.disabled = remainingWood <= 0;
  if (dstGrassSource) dstGrassSource.disabled = remainingGrass <= 0;
  if (dstCraftCampfire) {
    dstCraftCampfire.disabled = remainingWood > 0 || remainingGrass > 0;
  }
};

const getDstResourceImage = (resource) => {
  if (resource === "wood") return "assets/random%20events/dst-log.webp";
  if (resource === "grass") return "assets/random%20events/dst-grass.webp";
  return "";
};

const updateDstCompatibleSlots = (resource) => {
  dstCraftSlots?.forEach((slot) => {
    const isCompatible = Boolean(
      resource && slot.dataset.dstSlot === resource && !slot.dataset.dstFilled
    );
    slot.classList.toggle("is-compatible", isCompatible);
    if (!isCompatible) {
      slot.classList.remove("is-drag-over");
    }
  });
};

const getDstCarryGhost = () => {
  if (dstCarryGhost) return dstCarryGhost;
  dstCarryGhost = document.createElement("div");
  dstCarryGhost.className = "dst-carry-ghost is-hidden";
  const image = document.createElement("img");
  image.alt = "";
  image.decoding = "async";
  dstCarryGhost.append(image);
  document.body.append(dstCarryGhost);
  return dstCarryGhost;
};

const positionDstCarryGhost = (x, y) => {
  if (!dstCarryGhost || !Number.isFinite(x) || !Number.isFinite(y)) return;
  dstCarryGhost.style.left = `${x}px`;
  dstCarryGhost.style.top = `${y}px`;
};

const clearDstDraggedResource = () => {
  dstDraggedResource = "";
  setPointerHeldItemCursor("dst-resource", false);
  document.querySelectorAll(".dst-resource-token.is-selected").forEach((token) => {
    token.classList.remove("is-selected");
  });
  updateDstCompatibleSlots("");
  if (dstCarryGhost) {
    dstCarryGhost.classList.add("is-hidden");
  }
};

const carryDstResource = (resource, x = dstLastPointer.x, y = dstLastPointer.y) => {
  const imageSrc = getDstResourceImage(resource);
  if (!imageSrc) {
    clearDstDraggedResource();
    return;
  }
  dstDraggedResource = resource;
  setPointerHeldItemCursor("dst-resource", true);
  const ghost = getDstCarryGhost();
  const image = ghost.querySelector("img");
  if (image) {
    image.src = imageSrc;
  }
  ghost.classList.remove("is-hidden");
  positionDstCarryGhost(x, y);
  updateDstCompatibleSlots(resource);
};

const resetDstCraftingState = () => {
  clearDstDraggedResource();
  dstCraftState = {
    wood: 0,
    grass: 0,
  };
  dstCraftSlots?.forEach((slot) => {
    slot.classList.remove("is-filled", "is-drag-over");
    slot.removeAttribute("data-dst-filled");
    slot.replaceChildren();
  });
  updateDstCraftCounts();
  setDstNightProgress(100);
};

const resetDstNightWindow = () => {
  stopDstNightTimer();
  dstNightWarning?.classList.remove("is-hidden");
  resetDstCraftingState();
};

const showDstSurviveWindow = (anchorWindow = null) => {
  showManagedRandomEventWindow(dstSurviveWindow, {
    isVisible: () => false,
    position: (win) => positionDstWindow(win, anchorWindow),
    clampAfterMediaLoad: true,
  });
};

const showDstDarknessWindow = (anchorWindow = null) => {
  showManagedRandomEventWindow(dstDarknessWindow, {
    isVisible: () => false,
    position: (win) => positionDstWindow(win, anchorWindow),
    clampAfterMediaLoad: true,
  });
};

const closeDstNightWindow = () => {
  closeManagedRandomEventWindow(dstNightWindow);
};

const closeDstCraftingWindow = () => {
  closeManagedRandomEventWindow(dstCraftingWindow, {
    beforeClose: () => {
      stopDstNightTimer();
      clearDstDraggedResource();
    },
  });
};

const closeDstSurviveWindow = () => {
  closeManagedRandomEventWindow(dstSurviveWindow);
};

const closeDstDarknessWindow = () => {
  closeManagedRandomEventWindow(dstDarknessWindow);
};

const failDstNightCrafting = () => {
  if (!dstNightCraftingActive) return;
  const anchor = dstCraftingWindow;
  closeDstCraftingWindow();
  showDstDarknessWindow(anchor);
};

const completeDstNightCrafting = () => {
  if (!dstNightCraftingActive) return;
  if (dstCraftState.wood < DST_RECIPE_REQUIREMENTS.wood) return;
  if (dstCraftState.grass < DST_RECIPE_REQUIREMENTS.grass) return;
  if (dstCraftCampfire) {
    dstCraftCampfire.disabled = true;
  }
  const anchor = dstCraftingWindow;
  closeDstCraftingWindow();
  showDstSurviveWindow(anchor);
};

const updateDstNightTimer = (timestamp) => {
  if (!dstNightCraftingActive) return;
  if (!dstNightTimerStartedAt) {
    dstNightTimerStartedAt = timestamp;
  }

  const elapsed = timestamp - dstNightTimerStartedAt;
  const remainingRatio = 1 - elapsed / DST_NIGHT_DURATION_MS;
  setDstNightProgress(remainingRatio * 100);

  if (remainingRatio <= 0) {
    failDstNightCrafting();
    return;
  }

  dstNightAnimationFrame = window.requestAnimationFrame(updateDstNightTimer);
};

const startDstNightCrafting = () => {
  if (!dstCraftingWindow || dstNightCraftingActive) return;
  const anchor = dstNightWindow;
  closeDstNightWindow();
  showManagedRandomEventWindow(dstCraftingWindow, {
    isVisible: () => false,
    beforeShow: resetDstCraftingState,
    position: (win) => positionDstWindow(win, anchor),
    clampAfterMediaLoad: true,
  });
  dstNightCraftingActive = true;
  dstNightTimerStartedAt = 0;
  dstNightAnimationFrame = window.requestAnimationFrame(updateDstNightTimer);
};

const showDstNightWindow = () => {
  showManagedRandomEventWindow(dstNightWindow, {
    beforeShow: resetDstNightWindow,
    clampAfterMediaLoad: true,
  });
};

const fillDstCraftSlot = (slot, resource) => {
  if (!slot || !resource) return false;
  if (slot.dataset.dstFilled) return false;
  if (slot.dataset.dstSlot !== resource) return false;
  if (dstCraftState[resource] >= DST_RECIPE_REQUIREMENTS[resource]) return false;

  const imageSrc = getDstResourceImage(resource);
  if (!imageSrc) return false;

  const image = document.createElement("img");
  image.src = imageSrc;
  image.decoding = "async";
  image.alt = "";
  slot.replaceChildren(image);
  slot.dataset.dstFilled = resource;
  slot.classList.add("is-filled");
  slot.classList.remove("is-drag-over");
  dstCraftState = {
    ...dstCraftState,
    [resource]: dstCraftState[resource] + 1,
  };
  updateDstCraftCounts();
  updateDstCompatibleSlots(dstDraggedResource);
  return true;
};

registerRandomEvent({
  id: "dont-starve-campfire",
  preloadTargets: () => [
    dstNightWindow,
    dstCraftingWindow,
    dstSurviveWindow,
    dstDarknessWindow,
  ],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isDstCampfireEventVisible,
  canTrigger: () => !isDstCampfireEventVisible(),
  run: () => {
    showDstNightWindow();
  },
  bind: () => {
    if (dstNightOk) {
      dstNightOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startDstNightCrafting();
      });
    }

    if (dstCraftCampfire) {
      dstCraftCampfire.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        completeDstNightCrafting();
      });
    }

    document.addEventListener("pointermove", (event) => {
      dstLastPointer = {
        x: event.clientX,
        y: event.clientY,
      };
      if (dstDraggedResource) {
        positionDstCarryGhost(event.clientX, event.clientY);
      }
    });

    [dstWoodSource, dstGrassSource].forEach((source) => {
      if (!source) return;

      source.addEventListener("dragstart", (event) => {
        if (source.disabled) {
          event.preventDefault();
          return;
        }
        const resource = source.dataset.dstResource || "";
        dstDraggedResource = resource;
        setPointerHeldItemCursor("dst-resource", true);
        updateDstCompatibleSlots(resource);
        event.dataTransfer?.setData("text/plain", resource);
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "copy";
        }
      });

      source.addEventListener("dragend", () => {
        clearDstDraggedResource();
      });

      source.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (source.disabled) return;
        clearDstDraggedResource();
        carryDstResource(source.dataset.dstResource || "", event.clientX, event.clientY);
        source.classList.add("is-selected");
      });
    });

    dstCraftSlots?.forEach((slot) => {
      slot.addEventListener("dragover", (event) => {
        const resource = event.dataTransfer?.getData("text/plain") || dstDraggedResource;
        if (!resource || slot.dataset.dstSlot !== resource || slot.dataset.dstFilled) return;
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "copy";
        }
        slot.classList.add("is-drag-over");
      });

      slot.addEventListener("dragleave", () => {
        slot.classList.remove("is-drag-over");
      });

      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        const resource = event.dataTransfer?.getData("text/plain") || dstDraggedResource;
        if (fillDstCraftSlot(slot, resource)) {
          clearDstDraggedResource();
        }
      });

      slot.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (fillDstCraftSlot(slot, dstDraggedResource)) {
          clearDstDraggedResource();
        }
      });
    });

    if (dstSurviveOk) {
      dstSurviveOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeDstSurviveWindow();
      });
    }

    if (dstDarknessOk) {
      dstDarknessOk.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeDstDarknessWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(dstNightWindow, {
      afterClose: () => {
        // Handing off to the crafting window is not the end of the chain, so the
        // night state survives until nothing in the chain is open.
        if (dstNightCraftingActive || isDstCraftingVisible()) return;
        resetDstNightWindow();
      },
    });

    bindManagedRandomEventWindowAnimation(dstCraftingWindow, {
      afterClose: resetDstCraftingState,
    });

    bindManagedRandomEventWindowAnimation(dstSurviveWindow);

    bindManagedRandomEventWindowAnimation(dstDarknessWindow);
  },
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  dstNightWindow,
  dstCraftingWindow,
  dstSurviveWindow,
  dstDarknessWindow,
]);

window.homeEventDstNight = Object.freeze({
  dstCraftingWindow,
  dstDarknessWindow,
  dstNightWindow,
  dstSurviveWindow,
});
})();