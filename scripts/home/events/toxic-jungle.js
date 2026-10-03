(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  bindRandomEventButton,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  registerRandomEvent,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clearPokemonStyleDialogueTyping,
  setPokemonStyleDialogueText,
  setPokemonStyleSegmentedDialogue,
} = window.homeEventDialogue;
const {
  nextWindowZIndex,
} = window.homeWindows;

const toxicJungleWindow = byId("toxic-jungle-window");
const toxicJungleScene = byId("toxic-jungle-scene");
const toxicJungleSpores = byId("toxic-jungle-spores");
const toxicJungleCounters = byId("toxic-jungle-counters");
const toxicJungleDialog = byId("toxic-jungle-dialog");
const toxicJungleDialogText = byId("toxic-jungle-dialog-text");
const toxicJungleDialogActions = byId("toxic-jungle-dialog-actions");
const toxicJungleStart = byId("toxic-jungle-start");
const toxicJungleDecline = byId("toxic-jungle-decline");

const TOXIC_JUNGLE_ASSETS = Object.freeze({
  background: "assets/random%20events/toxic-jungle.webp",
  nausicaa: "assets/random%20events/nausicaa.jpg",
});

const TOXIC_JUNGLE_STAGE_PROMPT = "prompt";

const TOXIC_JUNGLE_STAGE_ACTIVE = "active";

const TOXIC_JUNGLE_STAGE_COMPLETE = "complete";

const TOXIC_JUNGLE_SPORE_TARGET = 10;

const TOXIC_JUNGLE_ACTIVE_SPORES_PER_TYPE = 3;

const TOXIC_JUNGLE_PROMPT =
  "Hey! Can you help me collect some spores?";

const TOXIC_JUNGLE_COMPLETE_MESSAGE =
  "Thanks for the help! Watch your back out there.";

const TOXIC_JUNGLE_SPORE_TYPES = Object.freeze([
  { id: "blue", label: "Blue", color: "#a9cbd4" },
  { id: "red", label: "Red", color: "#d6a2a0" },
  { id: "white", label: "White", color: "#d7d4c6" },
]);

let toxicJungleStage = TOXIC_JUNGLE_STAGE_PROMPT;

let toxicJungleCounts = {};

let toxicJungleSporeSequence = 0;

const createToxicJungleCounts = () =>
  Object.fromEntries(TOXIC_JUNGLE_SPORE_TYPES.map((type) => [type.id, 0]));

const isToxicJungleVisible = () =>
  isManagedRandomEventWindowVisible(toxicJungleWindow);

const setToxicJungleElementHidden = (element, hidden) => {
  if (!element) return;
  element.classList.toggle("is-hidden", hidden);
  element.setAttribute("aria-hidden", String(hidden));
};

const clearToxicJungleTyping = () => {
  clearPokemonStyleDialogueTyping(toxicJungleDialogText);
};

const setToxicJungleDialog = (message, { instant = false } = {}) => {
  if (instant) {
    setPokemonStyleDialogueText(toxicJungleDialogText, message, {
      instant: true,
      arrow: true,
    });
    return;
  }
  setPokemonStyleSegmentedDialogue(
    toxicJungleDialogText,
    [{ text: message }],
    { arrow: true }
  );
};

const renderToxicJungleCounters = () => {
  if (!toxicJungleCounters) return;
  const rows = TOXIC_JUNGLE_SPORE_TYPES.map((type) => {
    const row = document.createElement("span");
    row.className = "toxic-jungle-counter-row";

    const symbol = document.createElement("span");
    symbol.className = `toxic-jungle-counter-symbol toxic-jungle-counter-symbol--${type.id}`;
    symbol.style.setProperty("--spore-color", type.color);
    symbol.setAttribute("aria-hidden", "true");

    const count = document.createElement("span");
    count.textContent = `${type.label}: ${toxicJungleCounts[type.id] || 0}/${TOXIC_JUNGLE_SPORE_TARGET}`;

    row.append(symbol, count);
    return row;
  });
  toxicJungleCounters.replaceChildren(...rows);
};

const getToxicJungleSporeTravel = () => {
  const width = toxicJungleScene?.clientWidth || 760;
  return `${Math.max(width + 72, 420)}px`;
};

const spawnToxicJungleSpore = (type) => {
  if (
    !toxicJungleSpores ||
    toxicJungleStage !== TOXIC_JUNGLE_STAGE_ACTIVE ||
    (toxicJungleCounts[type.id] || 0) >= TOXIC_JUNGLE_SPORE_TARGET
  ) {
    return;
  }

  toxicJungleSporeSequence += 1;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `toxic-jungle-spore toxic-jungle-spore--${type.id}`;
  button.dataset.toxicJungleSpore = type.id;
  button.style.setProperty("--spore-color", type.color);
  button.style.setProperty("--spore-y", `${18 + Math.random() * 58}%`);
  button.style.setProperty("--spore-scale", `${0.72 + Math.random() * 0.42}`);
  button.style.setProperty("--spore-duration", `${9 + Math.random() * 5}s`);
  button.style.setProperty("--spore-delay", "0s");
  button.style.setProperty("--spore-travel", getToxicJungleSporeTravel());
  button.style.setProperty("--spore-bob-delay", `${toxicJungleSporeSequence * -0.17}s`);
  button.setAttribute("aria-label", `Collect ${type.label.toLowerCase()} spore`);
  const sporeCore = document.createElement("span");
  sporeCore.className = "toxic-jungle-spore-core";
  sporeCore.setAttribute("aria-hidden", "true");
  button.append(sporeCore);
  toxicJungleSpores.append(button);
};

const clearToxicJungleSpores = () => {
  toxicJungleSpores?.replaceChildren();
};

const populateToxicJungleSpores = () => {
  clearToxicJungleSpores();
  TOXIC_JUNGLE_SPORE_TYPES.forEach((type) => {
    for (let count = 0; count < TOXIC_JUNGLE_ACTIVE_SPORES_PER_TYPE; count += 1) {
      spawnToxicJungleSpore(type);
    }
  });
};

const isToxicJungleComplete = () =>
  TOXIC_JUNGLE_SPORE_TYPES.every(
    (type) => (toxicJungleCounts[type.id] || 0) >= TOXIC_JUNGLE_SPORE_TARGET
  );

const completeToxicJungle = () => {
  toxicJungleStage = TOXIC_JUNGLE_STAGE_COMPLETE;
  clearToxicJungleSpores();
  toxicJungleWindow?.classList.add("is-complete");
  setToxicJungleElementHidden(toxicJungleDialog, false);
  setToxicJungleElementHidden(toxicJungleStart, true);
  setToxicJungleElementHidden(toxicJungleDecline, true);
  toxicJungleDialogActions?.classList.add("is-hidden");
  toxicJungleDialogActions?.setAttribute("aria-hidden", "true");
  setToxicJungleDialog(TOXIC_JUNGLE_COMPLETE_MESSAGE);
};

const collectToxicJungleSpore = (button) => {
  if (!button || toxicJungleStage !== TOXIC_JUNGLE_STAGE_ACTIVE) return;
  const type = TOXIC_JUNGLE_SPORE_TYPES.find(
    (candidate) => candidate.id === button.dataset.toxicJungleSpore
  );
  if (!type) return;

  toxicJungleCounts[type.id] = Math.min(
    TOXIC_JUNGLE_SPORE_TARGET,
    (toxicJungleCounts[type.id] || 0) + 1
  );
  button.remove();
  renderToxicJungleCounters();

  if (isToxicJungleComplete()) {
    completeToxicJungle();
    return;
  }

  spawnToxicJungleSpore(type);
};

const resetToxicJungleEvent = ({ typewrite = false } = {}) => {
  toxicJungleStage = TOXIC_JUNGLE_STAGE_PROMPT;
  toxicJungleCounts = createToxicJungleCounts();
  toxicJungleSporeSequence = 0;
  clearToxicJungleSpores();
  clearToxicJungleTyping();
  toxicJungleWindow?.classList.remove("is-complete");
  setToxicJungleElementHidden(toxicJungleDialog, false);
  setToxicJungleElementHidden(toxicJungleCounters, true);
  setToxicJungleElementHidden(toxicJungleStart, false);
  setToxicJungleElementHidden(toxicJungleDecline, false);
  toxicJungleDialogActions?.classList.remove("is-hidden");
  toxicJungleDialogActions?.setAttribute("aria-hidden", "false");
  setToxicJungleDialog(TOXIC_JUNGLE_PROMPT, { instant: !typewrite });
  renderToxicJungleCounters();
};

const showToxicJungleWindow = () => {
  const didOpen = showManagedRandomEventWindow(toxicJungleWindow, {
    beforeShow: () => resetToxicJungleEvent({ typewrite: true }),
    clampAfterMediaLoad: true,
  });
  if (!didOpen && isToxicJungleVisible()) {
    toxicJungleWindow.style.zIndex = String(nextWindowZIndex());
  }
};

const closeToxicJungleWindow = () => {
  clearToxicJungleTyping();
  closeManagedRandomEventWindow(toxicJungleWindow);
};

const startToxicJungleCollection = () => {
  if (!isToxicJungleVisible()) return;
  clearToxicJungleTyping();
  toxicJungleStage = TOXIC_JUNGLE_STAGE_ACTIVE;
  setToxicJungleElementHidden(toxicJungleDialog, true);
  setToxicJungleElementHidden(toxicJungleCounters, false);
  renderToxicJungleCounters();
  populateToxicJungleSpores();
};

registerRandomEvent({
  id: "toxic-jungle",
  isGameplayLocked: () =>
    isToxicJungleVisible() && toxicJungleStage === TOXIC_JUNGLE_STAGE_ACTIVE,
  preloadTargets: () => [
    toxicJungleWindow,
    Object.values(TOXIC_JUNGLE_ASSETS),
  ],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isToxicJungleVisible,
  canTrigger: () => !isToxicJungleVisible(),
  run: () => {
    showToxicJungleWindow();
  },
  bind: () => {
    bindRandomEventButton(toxicJungleStart, startToxicJungleCollection);
    bindRandomEventButton(toxicJungleDecline, closeToxicJungleWindow);
    if (toxicJungleSpores) {
      toxicJungleSpores.addEventListener("click", (event) => {
        const target =
          event.target instanceof Element
            ? event.target.closest("[data-toxic-jungle-spore]")
            : null;
        if (!target || !toxicJungleSpores.contains(target)) return;
        event.preventDefault();
        event.stopPropagation();
        collectToxicJungleSpore(target);
      });
    }
    bindManagedRandomEventWindowAnimation(toxicJungleWindow, {
      afterClose: resetToxicJungleEvent,
    });
    toxicJungleWindow?.addEventListener("click", (event) => {
      if (toxicJungleStage !== TOXIC_JUNGLE_STAGE_COMPLETE) return;
      event.preventDefault();
      event.stopPropagation();
      closeToxicJungleWindow();
    });
  },
});

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  toxicJungleWindow,
]);

window.homeEventToxicJungle = Object.freeze({
  TOXIC_JUNGLE_ASSETS,
  TOXIC_JUNGLE_STAGE_ACTIVE,
  isToxicJungleVisible,
  toxicJungleStage,
  toxicJungleWindow,
});
})();
