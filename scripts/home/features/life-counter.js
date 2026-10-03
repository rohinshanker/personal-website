(() => {
const {
  byId,
} = window.homeDom;
const {
  getAppWindow,
  registerViewportObserver,
  registerWindowLifecycle,
} = window.homeWindows;
const {
  DIGITAL_DIGIT_SOURCES: LIFE_COUNTER_DIGIT_SOURCES,
  clampNumber,
} = window.homeUtil;

const lifeCounterPlayers = byId("life-counter-players");
const lifeCounterAddPlayer = byId("life-counter-add-player");
const lifeCounterReset = byId("life-counter-reset");
const lifeCounterInitiativeActions = byId("life-counter-initiative-actions");
const lifeCounterRollAll = byId("life-counter-roll-all");
const lifeCounterInitiativeToggle = byId("life-counter-initiative-toggle");
const lifeCounterWidthDecrease = byId("life-counter-width-decrease");
const lifeCounterWidthIncrease = byId("life-counter-width-increase");

const LIFE_COUNTER_STARTING_LIFE = 20;

const LIFE_COUNTER_MIN_VALUE = -9999;

const LIFE_COUNTER_MAX_VALUE = 99999;

const LIFE_COUNTER_STEP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000, 5000];

const LIFE_COUNTER_INITIATIVE_VALUES = Array.from({ length: 20 }, (_, index) => index + 1);

const LIFE_COUNTER_INITIATIVE_ROLL_FRAMES = 18;

const LIFE_COUNTER_WINDOW_MIN_WIDTH = 254;

const LIFE_COUNTER_WINDOW_DEFAULT_WIDTH = 448;

const LIFE_COUNTER_WINDOW_COLUMN_WIDTH = 192;

const LIFE_COUNTER_WINDOW_COLUMN_GAP = 8;

const LIFE_COUNTER_WINDOW_EXTRA_WIDTH = 56;

const LIFE_COUNTER_WINDOW_VIEWPORT_PADDING = 24;



let lifeCounterPlayersState = [
  {
    id: 1,
    name: "Player 1",
    life: LIFE_COUNTER_STARTING_LIFE,
    selectedStep: 1,
    initiative: null,
    initiativeRolling: false,
  },
];

let lifeCounterNextPlayerId = 2;

let lifeCounterInitiativeEnabled = false;

let lifeCounterInitiativeLeaderIds = new Set();

let lifeCounterInitiativeLeaderUpdatePending = false;

const lifeCounterInitiativeRollTimers = new Map();

const getLifeCounterWindow = () => getAppWindow("life-counter");

const getLifeCounterWindowWidth = () => {
  const win = getLifeCounterWindow();
  if (!win) return LIFE_COUNTER_WINDOW_DEFAULT_WIDTH;
  const styleWidth = Number.parseFloat(win.style.width);
  const rectWidth = win.getBoundingClientRect().width;
  return Math.round(styleWidth || rectWidth || LIFE_COUNTER_WINDOW_DEFAULT_WIDTH);
};

const getLifeCounterWindowWidthForColumns = (columns) =>
  Math.max(
    LIFE_COUNTER_WINDOW_MIN_WIDTH,
    columns * LIFE_COUNTER_WINDOW_COLUMN_WIDTH +
      Math.max(0, columns - 1) * LIFE_COUNTER_WINDOW_COLUMN_GAP +
      LIFE_COUNTER_WINDOW_EXTRA_WIDTH
  );

const getLifeCounterWindowColumns = (width) => {
  const safeWidth = Number.isFinite(width) ? width : LIFE_COUNTER_WINDOW_DEFAULT_WIDTH;
  const columns = Math.round(
    (safeWidth - LIFE_COUNTER_WINDOW_EXTRA_WIDTH + LIFE_COUNTER_WINDOW_COLUMN_GAP) /
      (LIFE_COUNTER_WINDOW_COLUMN_WIDTH + LIFE_COUNTER_WINDOW_COLUMN_GAP)
  );
  return Math.max(1, columns);
};

const getLifeCounterMaxWidthAtPosition = () => {
  const win = getLifeCounterWindow();
  if (!win || win.classList.contains("is-hidden")) {
    return Math.max(
      LIFE_COUNTER_WINDOW_MIN_WIDTH,
      window.innerWidth - LIFE_COUNTER_WINDOW_VIEWPORT_PADDING * 2
    );
  }
  const rect = win.getBoundingClientRect();
  return Math.max(
    LIFE_COUNTER_WINDOW_MIN_WIDTH,
    window.innerWidth - rect.left - LIFE_COUNTER_WINDOW_VIEWPORT_PADDING
  );
};

const syncLifeCounterInitiativeToolbar = () => {
  const currentColumns = getLifeCounterWindowColumns(getLifeCounterWindowWidth());
  const isCompactRollAll = currentColumns <= 2;

  if (lifeCounterInitiativeActions) {
    lifeCounterInitiativeActions.classList.toggle(
      "is-split",
      lifeCounterInitiativeEnabled
    );
    lifeCounterInitiativeActions.classList.toggle(
      "is-compact-roll-all",
      lifeCounterInitiativeEnabled && isCompactRollAll
    );
  }

  if (lifeCounterRollAll) {
    lifeCounterRollAll.hidden = !lifeCounterInitiativeEnabled;
    lifeCounterRollAll.classList.toggle("is-icon-only", isCompactRollAll);
    lifeCounterRollAll.setAttribute("aria-label", "Roll all initiatives");
    lifeCounterRollAll.title = isCompactRollAll ? "Roll all initiatives" : "";
  }

  if (lifeCounterInitiativeToggle) {
    lifeCounterInitiativeToggle.setAttribute(
      "aria-pressed",
      String(lifeCounterInitiativeEnabled)
    );
    lifeCounterInitiativeToggle.textContent = lifeCounterInitiativeEnabled
      ? "Hide Initiative"
      : "Show Initiative";
  }
};

const updateLifeCounterWidthControls = () => {
  const win = getLifeCounterWindow();
  syncLifeCounterInitiativeToolbar();
  if (!win || !lifeCounterWidthDecrease || !lifeCounterWidthIncrease) return;
  const currentColumns = getLifeCounterWindowColumns(getLifeCounterWindowWidth());
  const nextWidth = getLifeCounterWindowWidthForColumns(currentColumns + 1);
  const maxWidth = getLifeCounterMaxWidthAtPosition();
  lifeCounterWidthDecrease.disabled = currentColumns <= 1;
  lifeCounterWidthIncrease.disabled = nextWidth > maxWidth;
};

const setLifeCounterWindowWidth = (direction) => {
  const win = getLifeCounterWindow();
  if (!win) return;
  const currentColumns = getLifeCounterWindowColumns(getLifeCounterWindowWidth());
  const nextColumns = currentColumns + direction;
  const nextWidth = getLifeCounterWindowWidthForColumns(nextColumns);
  const maxWidth = getLifeCounterMaxWidthAtPosition();
  if (nextColumns < 1 || nextWidth > maxWidth) {
    updateLifeCounterWidthControls();
    return;
  }
  win.style.width = `${nextWidth}px`;
  updateLifeCounterWidthControls();
};

const getLifeCounterPlayer = (playerId) =>
  lifeCounterPlayersState.find((player) => player.id === playerId);

const normalizeLifeCounterValue = (value, fallback = LIFE_COUNTER_STARTING_LIFE) => {
  const parsed = Number(value);
  const nextValue = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  return clampNumber(nextValue, LIFE_COUNTER_MIN_VALUE, LIFE_COUNTER_MAX_VALUE);
};

const getLifeCounterSelectedStep = (player) =>
  LIFE_COUNTER_STEP_VALUES.includes(player.selectedStep)
    ? player.selectedStep
    : LIFE_COUNTER_STEP_VALUES[0];

const normalizeLifeCounterInitiative = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  return LIFE_COUNTER_INITIATIVE_VALUES.includes(normalized) ? normalized : null;
};

const formatLifeCounterDigits = (value) => {
  const normalized = normalizeLifeCounterValue(value);
  if (normalized < 0) {
    return `-${String(Math.abs(normalized)).padStart(4, " ")}`;
  }
  return String(normalized).padStart(5, " ");
};

const setLifeCounterPlayerValue = (playerId, value, fallback) => {
  const player = getLifeCounterPlayer(playerId);
  if (!player) return;
  player.life = normalizeLifeCounterValue(value, fallback ?? player.life);
  renderLifeCounter();
};

const lifeCounterInputHasSubmitValue = (input) => {
  if (!input || input.value.trim() === "") return false;
  const parsed = Number(input.value);
  return Number.isFinite(parsed) && Math.trunc(parsed) !== 0;
};

const updateLifeCounterSubmitButton = (input, button) => {
  if (!button) return;
  button.disabled = !lifeCounterInputHasSubmitValue(input);
};

const submitLifeCounterInputValue = (playerId, input, button, fallback) => {
  if (!lifeCounterInputHasSubmitValue(input)) {
    updateLifeCounterSubmitButton(input, button);
    return;
  }
  setLifeCounterPlayerValue(playerId, input.value, fallback);
};

const adjustLifeCounterPlayer = (playerId, direction) => {
  const player = getLifeCounterPlayer(playerId);
  if (!player) return;
  const selectedStep = getLifeCounterSelectedStep(player);
  setLifeCounterPlayerValue(playerId, player.life + direction * selectedStep, player.life);
};

const selectLifeCounterStep = (playerId, step) => {
  const player = getLifeCounterPlayer(playerId);
  if (!player || !LIFE_COUNTER_STEP_VALUES.includes(step)) return;
  player.selectedStep = step;
  renderLifeCounter();
};

const clearLifeCounterInitiativeRoll = (playerId) => {
  const roll = lifeCounterInitiativeRollTimers.get(playerId);
  if (!roll) return;
  window.clearTimeout(roll.timerId);
  lifeCounterInitiativeRollTimers.delete(playerId);
};

const clearAllLifeCounterInitiativeRolls = () => {
  lifeCounterInitiativeRollTimers.forEach((roll) => {
    window.clearTimeout(roll.timerId);
  });
  lifeCounterInitiativeRollTimers.clear();
  lifeCounterPlayersState.forEach((player) => {
    player.initiativeRolling = false;
  });
};

const clearLifeCounterInitiativeLeaders = () => {
  lifeCounterInitiativeLeaderIds = new Set();
};

const updateLifeCounterInitiativeLeaders = ({ force = false } = {}) => {
  if (!force && !lifeCounterInitiativeLeaderUpdatePending) return;
  if (
    !lifeCounterInitiativeEnabled ||
    lifeCounterPlayersState.some((player) => player.initiativeRolling)
  ) {
    return;
  }

  const playersWithInitiative = lifeCounterPlayersState.filter(
    (player) => normalizeLifeCounterInitiative(player.initiative) !== null
  );
  if (!playersWithInitiative.length) {
    clearLifeCounterInitiativeLeaders();
    lifeCounterInitiativeLeaderUpdatePending = false;
    return;
  }

  const highestInitiative = Math.max(
    ...playersWithInitiative.map((player) => player.initiative)
  );
  lifeCounterInitiativeLeaderIds = new Set(
    playersWithInitiative
      .filter((player) => player.initiative === highestInitiative)
      .map((player) => player.id)
  );
  lifeCounterInitiativeLeaderUpdatePending = false;
};

const createLifeCounterInitiativeRollSequence = (targetValue) =>
  Array.from({ length: LIFE_COUNTER_INITIATIVE_ROLL_FRAMES }, (_, index) =>
    index === LIFE_COUNTER_INITIATIVE_ROLL_FRAMES - 1
      ? targetValue
      : LIFE_COUNTER_INITIATIVE_VALUES[
          Math.floor(Math.random() * LIFE_COUNTER_INITIATIVE_VALUES.length)
        ]
  );

const lifeCounterInitiativeRollDelay = (index) => {
  const progress = index / Math.max(1, LIFE_COUNTER_INITIATIVE_ROLL_FRAMES - 1);
  return Math.round(36 + progress ** 2.45 * 245);
};

const selectLifeCounterInitiative = (playerId, initiative) => {
  const player = getLifeCounterPlayer(playerId);
  const normalizedInitiative = normalizeLifeCounterInitiative(initiative);
  if (!player || normalizedInitiative === null) return;
  clearLifeCounterInitiativeRoll(playerId);
  player.initiative = normalizedInitiative;
  player.initiativeRolling = false;
  lifeCounterInitiativeLeaderUpdatePending = false;
  clearLifeCounterInitiativeLeaders();
  renderLifeCounter();
};

const startLifeCounterInitiativeRoll = (playerId) => {
  const player = getLifeCounterPlayer(playerId);
  if (!player || !lifeCounterInitiativeEnabled) return;

  clearLifeCounterInitiativeRoll(playerId);
  lifeCounterInitiativeLeaderUpdatePending = true;
  const targetValue =
    LIFE_COUNTER_INITIATIVE_VALUES[
      Math.floor(Math.random() * LIFE_COUNTER_INITIATIVE_VALUES.length)
    ];
  const sequence = createLifeCounterInitiativeRollSequence(targetValue);

  player.initiativeRolling = true;

  const advanceRoll = (index) => {
    const activePlayer = getLifeCounterPlayer(playerId);
    if (!activePlayer) {
      clearLifeCounterInitiativeRoll(playerId);
      return;
    }

    const isFinalRollFrame = index >= sequence.length - 1;
    activePlayer.initiative = sequence[index];
    activePlayer.initiativeRolling = !isFinalRollFrame;

    if (isFinalRollFrame) {
      lifeCounterInitiativeRollTimers.delete(playerId);
      updateLifeCounterInitiativeLeaders();
      renderLifeCounter();
      return;
    }

    renderLifeCounter();

    const timerId = window.setTimeout(
      () => advanceRoll(index + 1),
      lifeCounterInitiativeRollDelay(index)
    );
    lifeCounterInitiativeRollTimers.set(playerId, { timerId });
  };

  advanceRoll(0);
};

const startAllLifeCounterInitiativeRolls = () => {
  if (!lifeCounterInitiativeEnabled) return;
  lifeCounterPlayersState.forEach((player) => {
    startLifeCounterInitiativeRoll(player.id);
  });
};

const removeLifeCounterPlayer = (playerId) => {
  clearLifeCounterInitiativeRoll(playerId);
  lifeCounterPlayersState = lifeCounterPlayersState.filter(
    (player) => player.id !== playerId
  );

  if (!lifeCounterPlayersState.length) {
    lifeCounterPlayersState = [
      {
        id: lifeCounterNextPlayerId++,
        name: "Player 1",
        life: LIFE_COUNTER_STARTING_LIFE,
        selectedStep: 1,
        initiative: null,
        initiativeRolling: false,
      },
    ];
  }

  if (lifeCounterInitiativeLeaderIds.size) {
    updateLifeCounterInitiativeLeaders({ force: true });
  }
  renderLifeCounter();
};

const appendLifeCounterDigits = (container, value) => {
  formatLifeCounterDigits(value)
    .split("")
    .forEach((digit) => {
      const image = document.createElement("img");
      image.className = "life-counter-digit";
      image.src = LIFE_COUNTER_DIGIT_SOURCES[digit] || LIFE_COUNTER_DIGIT_SOURCES[" "];
      image.alt = "";
      container.append(image);
    });
};

const renderLifeCounter = () => {
  if (!lifeCounterPlayers) return;
  const previousScrollTop = lifeCounterPlayers.scrollTop;
  const previousScrollLeft = lifeCounterPlayers.scrollLeft;
  const restoreScrollPosition = () => {
    lifeCounterPlayers.scrollTop = previousScrollTop;
    lifeCounterPlayers.scrollLeft = previousScrollLeft;
  };

  lifeCounterPlayers.replaceChildren();

  lifeCounterPlayersState.forEach((player) => {
    const selectedStep = getLifeCounterSelectedStep(player);

    const card = document.createElement("section");
    card.className = "life-counter-player";
    card.dataset.playerId = String(player.id);
    card.classList.toggle(
      "is-initiative-leader",
      lifeCounterInitiativeLeaderIds.has(player.id)
    );

    const header = document.createElement("div");
    header.className = "life-counter-player-header";

    const nameInput = document.createElement("input");
    nameInput.className = "life-counter-name";
    nameInput.type = "text";
    nameInput.value = player.name;
    nameInput.setAttribute("aria-label", "Player name");
    nameInput.addEventListener("input", () => {
      player.name = nameInput.value;
    });

    const removeButton = document.createElement("button");
    removeButton.className = "life-counter-remove";
    removeButton.type = "button";
    removeButton.textContent = "X";
    removeButton.setAttribute(
      "aria-label",
      `Delete ${player.name || "player"}`
    );
    removeButton.addEventListener("click", () => {
      removeLifeCounterPlayer(player.id);
    });

    header.append(nameInput, removeButton);

    const total = document.createElement("div");
    total.className = "life-counter-total";
    total.setAttribute("aria-label", String(player.life));
    total.setAttribute("aria-live", "polite");
    total.setAttribute("role", "img");
    appendLifeCounterDigits(total, player.life);

    const initiative = document.createElement("div");
    initiative.className = "life-counter-initiative";

    const initiativeHeader = document.createElement("div");
    initiativeHeader.className = "life-counter-initiative-header";

    const initiativeLabel = document.createElement("span");
    initiativeLabel.className = "life-counter-initiative-label";
    initiativeLabel.textContent = "Initiative";

    const initiativeRollButton = document.createElement("button");
    initiativeRollButton.className = "life-counter-initiative-roll";
    initiativeRollButton.type = "button";
    initiativeRollButton.disabled = Boolean(player.initiativeRolling);
    initiativeRollButton.setAttribute(
      "aria-label",
      `Roll initiative for ${player.name || "player"}`
    );

    const initiativeRollIcon = document.createElement("img");
    initiativeRollIcon.src = "assets/app-icons/ico/charmap_w2k.ico";
    initiativeRollIcon.alt = "";
    initiativeRollButton.append(initiativeRollIcon);
    initiativeRollButton.addEventListener("click", () => {
      startLifeCounterInitiativeRoll(player.id);
    });

    initiativeHeader.append(initiativeLabel, initiativeRollButton);

    const initiativeGrid = document.createElement("div");
    initiativeGrid.className = "life-counter-initiative-grid";

    LIFE_COUNTER_INITIATIVE_VALUES.forEach((initiativeValue) => {
      const initiativeButton = document.createElement("button");
      const isSelected = player.initiative === initiativeValue;
      initiativeButton.type = "button";
      initiativeButton.textContent = String(initiativeValue);
      initiativeButton.classList.toggle("is-selected", isSelected);
      initiativeButton.classList.toggle(
        "is-rolling",
        Boolean(player.initiativeRolling) && isSelected
      );
      initiativeButton.setAttribute("aria-pressed", String(isSelected));
      initiativeButton.setAttribute(
        "aria-label",
        `Set initiative to ${initiativeValue}`
      );
      initiativeButton.addEventListener("click", () => {
        selectLifeCounterInitiative(player.id, initiativeValue);
      });
      initiativeGrid.append(initiativeButton);
    });

    initiative.append(initiativeHeader, initiativeGrid);

    const setRow = document.createElement("div");
    setRow.className = "life-counter-set-row";

    const valueInput = document.createElement("input");
    valueInput.className = "life-counter-value-input";
    valueInput.type = "number";
    valueInput.inputMode = "numeric";
    valueInput.min = String(LIFE_COUNTER_MIN_VALUE);
    valueInput.max = String(LIFE_COUNTER_MAX_VALUE);
    valueInput.step = "1";
    valueInput.placeholder = "Set value";
    valueInput.setAttribute(
      "aria-label",
      `Set value for ${player.name || "player"}`
    );

    const submitButton = document.createElement("button");
    submitButton.className = "life-counter-submit";
    submitButton.type = "button";
    submitButton.setAttribute(
      "aria-label",
      `Submit value for ${player.name || "player"}`
    );

    const submitIcon = document.createElement("img");
    submitIcon.src = "assets/app-icons/ico/check.ico";
    submitIcon.alt = "";
    submitButton.append(submitIcon);

    valueInput.addEventListener("input", () => {
      updateLifeCounterSubmitButton(valueInput, submitButton);
    });
    valueInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      submitLifeCounterInputValue(player.id, valueInput, submitButton, player.life);
    });
    submitButton.addEventListener("click", () => {
      submitLifeCounterInputValue(player.id, valueInput, submitButton, player.life);
    });
    updateLifeCounterSubmitButton(valueInput, submitButton);

    setRow.append(valueInput, submitButton);

    const controls = document.createElement("div");
    controls.className = "life-counter-controls";

    const stepGrid = document.createElement("div");
    stepGrid.className = "life-counter-step-grid";

    LIFE_COUNTER_STEP_VALUES.forEach((step) => {
      const stepButton = document.createElement("button");
      stepButton.type = "button";
      stepButton.textContent = String(step);
      stepButton.classList.toggle("is-selected", step === selectedStep);
      stepButton.setAttribute("aria-pressed", String(step === selectedStep));
      stepButton.setAttribute("aria-label", `Select ${step}`);
      stepButton.addEventListener("click", () => {
        selectLifeCounterStep(player.id, step);
      });
      stepGrid.append(stepButton);
    });

    const adjustRow = document.createElement("div");
    adjustRow.className = "life-counter-adjust-row";

    [
      { label: "-", direction: -1, action: "Subtract" },
      { label: "+", direction: 1, action: "Add" },
    ].forEach(({ label, direction, action }) => {
      const adjustButton = document.createElement("button");
      adjustButton.type = "button";
      adjustButton.textContent = label;
      adjustButton.setAttribute("aria-label", `${action} selected value`);
      adjustButton.addEventListener("click", () => {
        adjustLifeCounterPlayer(player.id, direction);
      });
      adjustRow.append(adjustButton);
    });

    controls.append(stepGrid, adjustRow);
    if (lifeCounterInitiativeEnabled) {
      card.append(header, total, setRow, controls, initiative);
    } else {
      card.append(header, total, setRow, controls);
    }
    lifeCounterPlayers.append(card);
  });

  restoreScrollPosition();
  window.requestAnimationFrame(restoreScrollPosition);
};

const setLifeCounterInitiativeEnabled = (enabled) => {
  lifeCounterInitiativeEnabled = Boolean(enabled);
  if (!lifeCounterInitiativeEnabled) {
    clearAllLifeCounterInitiativeRolls();
    lifeCounterInitiativeLeaderUpdatePending = false;
    clearLifeCounterInitiativeLeaders();
  }
  syncLifeCounterInitiativeToolbar();
  renderLifeCounter();
};

const addLifeCounterPlayer = () => {
  const playerId = lifeCounterNextPlayerId++;
  lifeCounterPlayersState.push({
    id: playerId,
    name: `Player ${playerId}`,
    life: LIFE_COUNTER_STARTING_LIFE,
    selectedStep: 1,
    initiative: null,
    initiativeRolling: false,
  });
  renderLifeCounter();
};

const resetLifeCounterPlayers = () => {
  lifeCounterPlayersState.forEach((player) => {
    player.life = LIFE_COUNTER_STARTING_LIFE;
  });
  renderLifeCounter();
};

if (lifeCounterAddPlayer) {
  lifeCounterAddPlayer.addEventListener("click", addLifeCounterPlayer);
}

if (lifeCounterReset) {
  lifeCounterReset.addEventListener("click", resetLifeCounterPlayers);
}

if (lifeCounterInitiativeToggle) {
  lifeCounterInitiativeToggle.addEventListener("click", () => {
    setLifeCounterInitiativeEnabled(!lifeCounterInitiativeEnabled);
  });
}

if (lifeCounterRollAll) {
  lifeCounterRollAll.addEventListener("click", startAllLifeCounterInitiativeRolls);
}

if (lifeCounterWidthDecrease) {
  lifeCounterWidthDecrease.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLifeCounterWindowWidth(-1);
  });
}

if (lifeCounterWidthIncrease) {
  lifeCounterWidthIncrease.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLifeCounterWindowWidth(1);
  });
}

renderLifeCounter();

updateLifeCounterWidthControls();

registerWindowLifecycle("life-counter", {
  onOpen: () => updateLifeCounterWidthControls(),
  onDragEnd: () => updateLifeCounterWidthControls(),
});

registerViewportObserver({
  onFrame: () => updateLifeCounterWidthControls(),
});

window.homeLifeCounter = Object.freeze({
  updateLifeCounterWidthControls,
});
})();
