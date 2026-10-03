(() => {
const {
  all,
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  clampRandomEventWindowToViewport,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  registerRandomEvent,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  setPointerHeldItemCursor,
} = window.homePointerCursor;
const {
  currentTopZIndex,
} = window.homeWindows;

const infinityArmoryWindow = byId("infinity-armory-window");
const infinityArmoryClose = byId("infinity-armory-close");
const infinityArmoryLevel = byId("infinity-armory-level");
const infinityArmoryAttack = byId("infinity-armory-attack");
const infinityArmoryUpgrade = byId("infinity-armory-upgrade");
const infinityArmoryPrice = byId("infinity-armory-price");
const infinityArmoryGold = byId("infinity-armory-gold");
const infinityArmoryStatus = byId("infinity-armory-status");
const infinityArmorySlots = all("[data-armory-slot]");
const infinityArmoryGemGrid = byId("infinity-armory-gems");

let infinityArmoryGems = [];

let infinityArmoryInventoryGems = [];

const INFINITY_ARMORY_STARTING_GOLD = 12000;

const INFINITY_ARMORY_UPGRADE_PRICES = Object.freeze([1000, 2500, 5000]);

const INFINITY_ARMORY_MAX_LEVEL = INFINITY_ARMORY_UPGRADE_PRICES.length + 1;

const INFINITY_ARMORY_BASE_ATTACK = 500;

const INFINITY_ARMORY_ATTACK_PER_LEVEL = 50;

const INFINITY_ARMORY_SQUARE_ATTACK_BONUS = 500;

const INFINITY_ARMORY_SHAPES = Object.freeze(["square", "circle", "triangle"]);

const INFINITY_ARMORY_GEM_LABELS = Object.freeze({
  square: "Square",
  circle: "Circle",
  triangle: "Triangle",
});

const INFINITY_ARMORY_INVENTORY_SLOT_COUNT = 25;

const INFINITY_ARMORY_INVENTORY_GEM_COUNT = 12;

const INFINITY_ARMORY_CURSOR_GEM_MIN_Z_INDEX = 10000;

const INFINITY_ARMORY_GEM_ICON_BY_SHAPE = Object.freeze({
  square: "assets/random%20events/ib-assets/ib-gem-square.webp",
  circle: "assets/random%20events/ib-assets/ib-gem-circle.webp",
  triangle: "assets/random%20events/ib-assets/ib-gem-triangle.webp",
});

const INFINITY_ARMORY_GEM_COLORS = Object.freeze([
  "ruby",
  "jade",
  "sapphire",
  "amber",
  "violet",
  "opal",
  "emerald",
  "crimson",
  "topaz",
  "frost",
  "shadow",
  "pearl",
]);

const createInfinityArmoryInventoryGems = (random = Math.random) => {
  const gems = Array.from({ length: INFINITY_ARMORY_INVENTORY_GEM_COUNT }, (_, index) => {
    const shape = INFINITY_ARMORY_SHAPES[index % INFINITY_ARMORY_SHAPES.length];
    const color =
      INFINITY_ARMORY_GEM_COLORS[
        (index * 5 + Math.floor(index / INFINITY_ARMORY_SHAPES.length)) %
          INFINITY_ARMORY_GEM_COLORS.length
      ];
    return {
      id: `${shape}-${color}-${index + 1}`,
      shape,
      color,
      label: `${color} ${shape}`,
      src: INFINITY_ARMORY_GEM_ICON_BY_SHAPE[shape],
    };
  });

  for (let index = gems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [gems[index], gems[swapIndex]] = [gems[swapIndex], gems[index]];
  }

  return gems;
};

let infinityArmoryState = {
  level: 1,
  gold: INFINITY_ARMORY_STARTING_GOLD,
  gems: {
    square: null,
    circle: null,
    triangle: null,
  },
  usedGemIds: {},
};

let infinityArmoryCompleteTimer = null;

let infinityArmorySelectedGem = null;

let infinityArmoryCursorGem = null;

const isInfinityArmoryVisible = () =>
  isManagedRandomEventWindowVisible(infinityArmoryWindow);

const clearInfinityArmoryCompletionTimer = () => {
  if (!infinityArmoryCompleteTimer) return;
  clearTimeout(infinityArmoryCompleteTimer);
  infinityArmoryCompleteTimer = null;
};

const createInfinityArmoryState = () => ({
  level: 1,
  gold: INFINITY_ARMORY_STARTING_GOLD,
  gems: {
    square: null,
    circle: null,
    triangle: null,
  },
  usedGemIds: {},
});

const infinityArmoryAllGemsSocketed = () =>
  INFINITY_ARMORY_SHAPES.every((shape) => Boolean(infinityArmoryState.gems[shape]));

const infinityArmoryIsComplete = () =>
  infinityArmoryState.level >= INFINITY_ARMORY_MAX_LEVEL &&
  infinityArmoryAllGemsSocketed();

const renderInfinityArmoryInventory = () => {
  infinityArmoryGems = [];
  if (!infinityArmoryGemGrid) return;
  infinityArmoryGemGrid.replaceChildren();
  for (let index = 0; index < INFINITY_ARMORY_INVENTORY_SLOT_COUNT; index += 1) {
    const gem = infinityArmoryInventoryGems[index];
    const button = document.createElement("button");
    button.className = "infinity-armory-gem";
    button.type = "button";
    button.setAttribute("role", "gridcell");

    if (!gem) {
      button.classList.add("is-empty");
      button.disabled = true;
      button.setAttribute("aria-label", "Empty gem slot");
      infinityArmoryGemGrid.appendChild(button);
      continue;
    }

    button.dataset.armoryGemId = gem.id;
    button.dataset.armoryGem = gem.shape;
    button.dataset.armoryColor = gem.color;
    button.dataset.armoryLabel = gem.label;
    button.dataset.armorySrc = gem.src;
    button.setAttribute("aria-label", gem.label);

    const image = document.createElement("img");
    image.dataset.src = gem.src;
    image.decoding = "async";
    image.alt = "";
    button.appendChild(image);
    infinityArmoryGemGrid.appendChild(button);
  }
  infinityArmoryGems = Array.from(
    infinityArmoryGemGrid.querySelectorAll("[data-armory-gem]")
  );
};

const getInfinityArmoryEventTarget = (event) =>
  event?.target instanceof Element ? event.target : event?.target?.parentElement || null;

const getInfinityArmoryGemIcon = (shape) => INFINITY_ARMORY_GEM_ICON_BY_SHAPE[shape] || "";

const getInfinityArmoryGemFromButton = (button) => {
  if (!button || button.disabled || button.classList.contains("is-empty")) return null;
  const shape = button.dataset.armoryGem;
  const color = button.dataset.armoryColor || "ruby";
  if (!INFINITY_ARMORY_SHAPES.includes(shape)) return null;
  const image = button.querySelector("img");
  const src =
    image?.getAttribute("src") ||
    image?.dataset.src ||
    button.dataset.armorySrc ||
    getInfinityArmoryGemIcon(shape);
  return {
    id: button.dataset.armoryGemId || `${shape}-${color}`,
    shape,
    color,
    label:
      button.dataset.armoryLabel ||
      button.getAttribute("aria-label") ||
      `${color} ${shape}`,
    src,
  };
};

const getInfinityArmoryCursorPosition = (event, fallbackElement = null) => {
  const hasPointerCoordinates =
    Number.isFinite(event?.clientX) &&
    Number.isFinite(event?.clientY) &&
    (event.clientX !== 0 || event.clientY !== 0 || event.detail > 0);
  if (hasPointerCoordinates) {
    return { x: event.clientX, y: event.clientY };
  }

  const rect = fallbackElement?.getBoundingClientRect?.();
  if (rect?.width || rect?.height) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
};

const moveInfinityArmoryCursorGem = (event, fallbackElement = null) => {
  if (!infinityArmoryCursorGem) return;
  const { x, y } = getInfinityArmoryCursorPosition(event, fallbackElement);
  infinityArmoryCursorGem.style.left = `${x}px`;
  infinityArmoryCursorGem.style.top = `${y}px`;
};

const clearInfinityArmorySelectedGem = ({ update = true, status = "" } = {}) => {
  infinityArmorySelectedGem = null;
  setPointerHeldItemCursor("infinity-armory-gem", false);
  if (infinityArmoryCursorGem) {
    infinityArmoryCursorGem.remove();
    infinityArmoryCursorGem = null;
  }
  if (update) updateInfinityArmory();
  if (status && infinityArmoryStatus) infinityArmoryStatus.textContent = status;
};

const createInfinityArmoryCursorGem = (gem, event, sourceElement = null) => {
  if (!gem) return;
  if (infinityArmoryCursorGem) infinityArmoryCursorGem.remove();
  const cursorGem = document.createElement("span");
  cursorGem.className = "infinity-armory-cursor-gem";
  cursorGem.dataset.armoryColor = gem.color;
  cursorGem.setAttribute("aria-hidden", "true");
  cursorGem.style.zIndex = String(
    Math.max(INFINITY_ARMORY_CURSOR_GEM_MIN_Z_INDEX, currentTopZIndex() + 20)
  );
  const image = document.createElement("img");
  image.src = gem.src || getInfinityArmoryGemIcon(gem.shape);
  image.alt = "";
  cursorGem.appendChild(image);
  if (!document.body) return;
  document.body.appendChild(cursorGem);
  infinityArmoryCursorGem = cursorGem;
  setPointerHeldItemCursor("infinity-armory-gem", true);
  moveInfinityArmoryCursorGem(event, sourceElement);
};

const selectInfinityArmoryGem = (button, event) => {
  const gem = getInfinityArmoryGemFromButton(button);
  if (!gem) return;
  if (infinityArmoryState.usedGemIds[gem.id]) return;
  if (infinityArmoryState.gems[gem.shape]) {
    if (infinityArmoryStatus) {
      infinityArmoryStatus.textContent = `${INFINITY_ARMORY_GEM_LABELS[gem.shape]} slot is already filled.`;
    }
    return;
  }
  infinityArmorySelectedGem = gem;
  createInfinityArmoryCursorGem(gem, event, button);
  updateInfinityArmory();
  if (infinityArmoryStatus) {
    infinityArmoryStatus.textContent = `${gem.label} selected.`;
  }
};

const updateInfinityArmory = () => {
  const nextPrice = INFINITY_ARMORY_UPGRADE_PRICES[infinityArmoryState.level - 1] || 0;
  const isMaxLevel = infinityArmoryState.level >= INFINITY_ARMORY_MAX_LEVEL;
  const canUpgrade = !isMaxLevel && infinityArmoryState.gold >= nextPrice;
  const attack =
    INFINITY_ARMORY_BASE_ATTACK +
    (infinityArmoryState.level - 1) * INFINITY_ARMORY_ATTACK_PER_LEVEL +
    (infinityArmoryState.gems.square ? INFINITY_ARMORY_SQUARE_ATTACK_BONUS : 0);

  if (infinityArmoryLevel) {
    infinityArmoryLevel.textContent = `Infinity Blade Lvl ${infinityArmoryState.level}`;
  }
  if (infinityArmoryAttack) {
    infinityArmoryAttack.textContent = String(attack);
  }
  if (infinityArmoryGold) {
    infinityArmoryGold.textContent = String(infinityArmoryState.gold);
  }
  if (infinityArmoryPrice) {
    infinityArmoryPrice.textContent = isMaxLevel ? "MAX" : String(nextPrice);
  }
  if (infinityArmoryUpgrade) {
    infinityArmoryUpgrade.disabled = !canUpgrade;
    infinityArmoryUpgrade.textContent = isMaxLevel ? "Maxed" : "Upgrade";
  }

  infinityArmorySlots.forEach((slot) => {
    const shape = slot.dataset.armorySlot;
    const socketedGem = infinityArmoryState.gems[shape];
    const filled = Boolean(socketedGem);
    const label = shape ? `${shape[0].toUpperCase()}${shape.slice(1)}` : "Gem";
    const image = slot.querySelector("img");
    slot.classList.toggle("is-filled", filled);
    slot.classList.toggle(
      "is-targeted",
      Boolean(infinityArmorySelectedGem && infinityArmorySelectedGem.shape === shape && !filled)
    );
    slot.setAttribute("aria-pressed", String(filled));
    slot.setAttribute("aria-label", `${label} gem slot ${filled ? "filled" : "empty"}`);
    if (socketedGem) {
      slot.dataset.armoryColor = socketedGem.color;
      if (image && socketedGem.src) image.setAttribute("src", socketedGem.src);
    } else {
      delete slot.dataset.armoryColor;
    }
    slot.disabled = filled && !infinityArmorySelectedGem;
  });

  infinityArmoryGems.forEach((gem) => {
    const shape = gem.dataset.armoryGem;
    const id = gem.dataset.armoryGemId || `${shape}-${gem.dataset.armoryColor || "ruby"}`;
    gem.disabled = Boolean(
      infinityArmoryState.gems[shape] || infinityArmoryState.usedGemIds[id]
    );
    gem.classList.toggle("is-selected", infinityArmorySelectedGem?.id === id);
  });

  if (infinityArmoryStatus) {
    if (infinityArmoryIsComplete()) {
      infinityArmoryStatus.textContent = "Armory complete.";
    } else if (infinityArmorySelectedGem) {
      infinityArmoryStatus.textContent = `${infinityArmorySelectedGem.label} selected.`;
    } else {
      infinityArmoryStatus.textContent = "";
    }
  }
};

const closeInfinityArmoryWindow = () => {
  clearInfinityArmoryCompletionTimer();
  clearInfinityArmorySelectedGem({ update: false });
  closeManagedRandomEventWindow(infinityArmoryWindow);
};

const scheduleInfinityArmoryCompletionCheck = () => {
  if (!infinityArmoryIsComplete() || infinityArmoryCompleteTimer) return;
  infinityArmoryCompleteTimer = setTimeout(() => {
    infinityArmoryCompleteTimer = null;
    closeInfinityArmoryWindow();
  }, 650);
};

const resetInfinityArmory = () => {
  clearInfinityArmoryCompletionTimer();
  clearInfinityArmorySelectedGem({ update: false });
  infinityArmoryState = createInfinityArmoryState();
  infinityArmoryInventoryGems = createInfinityArmoryInventoryGems();
  renderInfinityArmoryInventory();
  updateInfinityArmory();
};

const upgradeInfinityArmory = () => {
  if (infinityArmoryState.level >= INFINITY_ARMORY_MAX_LEVEL) return;
  const nextPrice = INFINITY_ARMORY_UPGRADE_PRICES[infinityArmoryState.level - 1] || 0;
  if (infinityArmoryState.gold < nextPrice) {
    if (infinityArmoryStatus) infinityArmoryStatus.textContent = "Not enough gold.";
    return;
  }
  infinityArmoryState.gold -= nextPrice;
  infinityArmoryState.level += 1;
  updateInfinityArmory();
  scheduleInfinityArmoryCompletionCheck();
};

const socketInfinityArmoryGem = (shape) => {
  if (!INFINITY_ARMORY_SHAPES.includes(shape)) return;
  if (!infinityArmorySelectedGem) {
    return;
  }
  if (infinityArmoryState.gems[shape]) {
    clearInfinityArmorySelectedGem({
      status: `${INFINITY_ARMORY_GEM_LABELS[shape]} slot is already filled.`,
    });
    return;
  }
  if (infinityArmorySelectedGem.shape !== shape) {
    clearInfinityArmorySelectedGem({
      status: `${infinityArmorySelectedGem.label} does not fit.`,
    });
    return;
  }
  infinityArmoryState.gems[shape] = { ...infinityArmorySelectedGem };
  infinityArmoryState.usedGemIds[infinityArmorySelectedGem.id] = true;
  clearInfinityArmorySelectedGem({ update: false });
  updateInfinityArmory();
  scheduleInfinityArmoryCompletionCheck();
};

const showInfinityArmoryWindow = () => {
  showManagedRandomEventWindow(infinityArmoryWindow, {
    onFront: () => {
      if (!infinityArmoryCursorGem) return;
      infinityArmoryCursorGem.style.zIndex = String(
        Math.max(INFINITY_ARMORY_CURSOR_GEM_MIN_Z_INDEX, currentTopZIndex() + 20)
      );
    },
    beforeShow: resetInfinityArmory,
    clampAfterMediaLoad: true,
  });
};

const infinityArmoryPreloadTargets = () => [
  infinityArmoryWindow,
  Object.values(INFINITY_ARMORY_GEM_ICON_BY_SHAPE),
];

registerRandomEvent({
  id: "infinity-blade-armory",
  preloadTargets: infinityArmoryPreloadTargets,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isInfinityArmoryVisible,
  canTrigger: () => !isInfinityArmoryVisible(),
  run: () => {
    showInfinityArmoryWindow();
  },
  bind: () => {
    if (infinityArmoryClose) {
      infinityArmoryClose.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeInfinityArmoryWindow();
      });
    }

    if (infinityArmoryUpgrade) {
      infinityArmoryUpgrade.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        upgradeInfinityArmory();
      });
    }

    infinityArmorySlots.forEach((slot) => {
      slot.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        socketInfinityArmoryGem(slot.dataset.armorySlot);
      });
    });

    if (infinityArmoryGemGrid) {
      infinityArmoryGemGrid.addEventListener("click", (event) => {
        const target = getInfinityArmoryEventTarget(event);
        const gem = target?.closest("[data-armory-gem]");
        if (!gem || !infinityArmoryGemGrid.contains(gem)) return;
        event.preventDefault();
        event.stopPropagation();
        if (infinityArmorySelectedGem) {
          clearInfinityArmorySelectedGem({ status: "Gem returned to inventory." });
          return;
        }
        selectInfinityArmoryGem(gem, event);
      });
    }

    document.addEventListener("pointermove", moveInfinityArmoryCursorGem);
    document.addEventListener("click", (event) => {
      if (!infinityArmorySelectedGem) return;
      const target = getInfinityArmoryEventTarget(event);
      if (target && infinityArmoryWindow?.contains(target)) return;
      clearInfinityArmorySelectedGem({ status: "Gem returned to inventory." });
    });

    if (infinityArmoryWindow) {
      infinityArmoryWindow.addEventListener("click", (event) => {
        const target = getInfinityArmoryEventTarget(event);
        if (
          infinityArmorySelectedGem &&
          !target?.closest("[data-armory-slot], [data-armory-gem]")
        ) {
          clearInfinityArmorySelectedGem({ status: "Gem returned to inventory." });
        }
        event.stopPropagation();
      });
    }

    bindManagedRandomEventWindowAnimation(infinityArmoryWindow, {
      afterOpen: () => clampRandomEventWindowToViewport(infinityArmoryWindow),
    });
  },
});

const configureInfinityArmoryPreview = (preview) => {
  if (!preview) return;
  const ownerDocument = preview.ownerDocument;
  const initialState = createInfinityArmoryState();
  const inventory = createInfinityArmoryInventoryGems(() => 0.5);
  const setText = (selector, value) => {
    const element = preview.querySelector(selector);
    if (element) element.textContent = value;
  };
  setText("#infinity-armory-level", `Infinity Blade Lvl ${initialState.level}`);
  setText("#infinity-armory-attack", String(INFINITY_ARMORY_BASE_ATTACK));
  setText("#infinity-armory-price", String(INFINITY_ARMORY_UPGRADE_PRICES[0]));
  setText("#infinity-armory-gold", String(initialState.gold));
  setText("#infinity-armory-status", "");

  const upgrade = preview.querySelector("#infinity-armory-upgrade");
  if (upgrade) {
    upgrade.disabled = false;
    upgrade.textContent = "Upgrade";
  }
  preview.querySelectorAll("[data-armory-slot]").forEach((slot) => {
    const shape = slot.dataset.armorySlot;
    const label = shape ? `${shape[0].toUpperCase()}${shape.slice(1)}` : "Gem";
    slot.classList.remove("is-filled", "is-targeted");
    slot.disabled = false;
    slot.setAttribute("aria-pressed", "false");
    slot.setAttribute("aria-label", `${label} gem slot empty`);
    delete slot.dataset.armoryColor;
    const image = slot.querySelector("img");
    if (image && INFINITY_ARMORY_GEM_ICON_BY_SHAPE[shape]) {
      image.removeAttribute("src");
      image.dataset.src = INFINITY_ARMORY_GEM_ICON_BY_SHAPE[shape];
    }
  });

  const gemGrid = preview.querySelector("#infinity-armory-gems");
  const gemSlots = Array.from({ length: INFINITY_ARMORY_INVENTORY_SLOT_COUNT }, (_, index) => {
    const gem = inventory[index];
    const button = ownerDocument.createElement("button");
    button.className = "infinity-armory-gem";
    button.type = "button";
    button.setAttribute("role", "gridcell");
    if (!gem) {
      button.classList.add("is-empty");
      button.disabled = true;
      button.setAttribute("aria-label", "Empty gem slot");
      return button;
    }
    button.dataset.armoryGemId = gem.id;
    button.dataset.armoryGem = gem.shape;
    button.dataset.armoryColor = gem.color;
    button.dataset.armoryLabel = gem.label;
    button.dataset.armorySrc = gem.src;
    button.setAttribute("aria-label", gem.label);
    const image = ownerDocument.createElement("img");
    image.dataset.src = gem.src;
    image.decoding = "async";
    image.alt = "";
    button.append(image);
    return button;
  });
  gemGrid?.replaceChildren(...gemSlots);
};

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  infinityArmoryWindow,
]);

window.homeEventInfinityArmory = Object.freeze({
  configureInfinityArmoryPreview,
  infinityArmoryPreloadTargets,
  infinityArmoryWindow,
});
})();