(() => {
const {
  byId,
} = window.homeDom;
const {
  RANDOM_EVENT_KIND_INTERACTIVE,
  bindManagedRandomEventWindowAnimation,
  clampRandomEventWindowAfterMediaLoad,
  clampRandomEventWindowToViewport,
  closeManagedRandomEventWindow,
  isManagedRandomEventWindowVisible,
  recordGeneralRandomEventClick,
  registerRandomEvent,
  registerRandomEventClickSource,
  registerRandomEventWindows,
  showManagedRandomEventWindow,
} = window.homeEventRuntime;
const {
  clampNumber,
  debounceTimer,
  shuffle,
} = window.homeUtil;
const {
  GREEN_LIGHTNING_PALETTE,
  clearLightningCanvas,
  drawLightningBorderFrame,
} = window.homeEventLightning;
const {
  FATE_LIGHTNING_DURATION_MS,
} = window.homeEventFate;
const {
  loadDeferredMedia,
} = window.homeActivation;
const {
  nextWindowZIndex,
} = window.homeWindows;

const brandBurnsWindow = byId("brand-burns-window");
const brandBurnsTitle = byId("brand-burns-title");
const brandBurnsClose = byId("brand-burns-close");
const brandBurnsPromptStage = byId("brand-burns-stage-prompt");
const brandBurnsFightStage = byId("brand-burns-stage-fight");
const brandBurnsFight = byId("brand-burns-fight");
const brandBurnsIcon = byId("brand-burns-icon");
const brandBurnsCombatIcon = byId("brand-burns-combat-icon");
const brandBurnsHealth = byId("brand-burns-health");
const brandBurnsHealthValue = byId("brand-burns-health-value");
const brandBurnsStamina = byId("brand-burns-stamina");
const brandBurnsStaminaValue = byId("brand-burns-stamina-value");
const brandBurnsStatus = byId("brand-burns-status");
const brandBurnsEnemyCount = byId("brand-burns-enemy-count");

const BRAND_BURNS_RANDOM_EVENT_BUTTON_CLICK_RATIO = 3;

const BRAND_BURNS_BRAND_ICON = "assets/random%20events/guts-glowing-brand.png";

const BRAND_BURNS_GUTS_ICON = "assets/random%20events/guts-icon.jpg";

const BRAND_BURNS_PUCK_IMAGE = "assets/random%20events/puck-healer.jpeg";

const BRAND_BURNS_PUCK_WIN_IMAGE = "assets/random%20events/puck-win.jpeg";

const BRAND_BURNS_DRAGON_SLAYER_ICON = "assets/random%20events/dragon-slayer.jpeg";

const BRAND_BURNS_ENCOUNTER_COUNT = 5;

const BRAND_BURNS_APOSTLE_OPEN_DELAY_MS = 240;

const BRAND_BURNS_APOSTLE_CLOSE_DELAY_MS = 90;

const BRAND_BURNS_ATTACK_MIN_DAMAGE = 100;

const BRAND_BURNS_ATTACK_MAX_DAMAGE = 300;

const BRAND_BURNS_PLAYER_MAX_HEALTH = 4000;

const BRAND_BURNS_PLAYER_MAX_STAMINA = 100;

const BRAND_BURNS_APOSTLE_PLAYER_ATTACK_MIN_DAMAGE = 1;

const BRAND_BURNS_APOSTLE_PLAYER_ATTACK_MAX_DAMAGE = 300;

const BRAND_BURNS_APOSTLE_ATTACK_MIN_DELAY_MS = 1800;

const BRAND_BURNS_APOSTLE_ATTACK_MAX_DELAY_MS = 4200;

const BRAND_BURNS_BLOCK_DURATION_MS = 5 * 1000;

const BRAND_BURNS_BLOCK_COOLDOWN_MS = 5 * 1000;

const BRAND_BURNS_BLOCK_DAMAGE_FACTOR = 1 / 6;

const BRAND_BURNS_METER_SEGMENTS = 16;

const BRAND_BURNS_OMEN_MIN_DELAY_MS = 900;

const BRAND_BURNS_OMEN_MAX_DELAY_MS = 2600;

const BRAND_BURNS_STAMINA_ATTACK_MIN_COST = 8;

const BRAND_BURNS_STAMINA_ATTACK_MAX_COST = 18;

const BRAND_BURNS_STAMINA_RECOVERY_MS = 380;

const BRAND_BURNS_STAMINA_RECOVERY_AMOUNT = 6;

const BRAND_BURNS_STAMINA_RECOVERY_MIN_FACTOR = 0.3;

const BRAND_BURNS_STAMINA_LOW_HEALTH_BONUS = 0.45;

const BRAND_BURNS_STAMINA_BLOCK_RECOVERY_BONUS = 2;

const BRAND_BURNS_PUCK_HEALTH_THRESHOLD_FACTOR = 0.65;

const BRAND_BURNS_PUCK_HEAL_COOLDOWN_MS = 4 * 1000;

const BRAND_BURNS_PUCK_HEAL_RANGES_BY_REMAINING = Object.freeze({
  5: [400, 500],
  4: [300, 500],
  3: [300, 400],
  2: [200, 300],
  1: [100, 200],
});

const BRAND_BURNS_FEMTO = Object.freeze({
  id: "femto",
  name: "Femto",
  image: "assets/random%20events/brand-burns/femto.webp",
  minHealth: 3500,
  maxHealth: 4000,
});

const BRAND_BURNS_APOSTLES = Object.freeze([
  {
    id: "zodd",
    name: "Zodd",
    image: "assets/random%20events/brand-burns/zodd.webp",
    minHealth: 2400,
    maxHealth: 3500,
  },
  {
    id: "grunbeld",
    name: "Grunbeld",
    image: "assets/random%20events/brand-burns/grunbeld.webp",
    minHealth: 2600,
    maxHealth: 3500,
  },
  {
    id: "borkoff",
    name: "Borkoff",
    image: "assets/random%20events/brand-burns/borkoff.webp",
    minHealth: 900,
    maxHealth: 1900,
  },
  {
    id: "locus",
    name: "Locus",
    image: "assets/random%20events/brand-burns/locus.webp",
    minHealth: 1800,
    maxHealth: 3100,
  },
  {
    id: "irvine",
    name: "Irvine",
    image: "assets/random%20events/brand-burns/irvine.webp",
    minHealth: 1400,
    maxHealth: 2600,
  },
  {
    id: "ganishka",
    name: "Ganishka",
    image: "assets/random%20events/brand-burns/ganishka.webp",
    minHealth: 2600,
    maxHealth: 3500,
  },
  {
    id: "wyald",
    name: "Wyald",
    image: "assets/random%20events/brand-burns/wyald.webp",
    minHealth: 1500,
    maxHealth: 3100,
  },
  {
    id: "snake-lord",
    name: "Snake Lord",
    image: "assets/random%20events/brand-burns/snake-lord.webp",
    minHealth: 700,
    maxHealth: 1700,
  },
  {
    id: "rakshas",
    name: "Rakshas",
    image: "assets/random%20events/brand-burns/rakshas.webp",
    minHealth: 1600,
    maxHealth: 2900,
  },
]);

let brandBurnsStage = "idle";

let brandBurnsEnemyWindows = [];

let brandBurnsEnemyTimers = [];

let brandBurnsStaminaTimer = null;

let brandBurnsOmenTimer = null;

let brandBurnsOmenHitTimer = null;

let brandBurnsOmenLightningFrame = null;

let brandBurnsPreserveEnemyWindowsOnMainClose = false;

let brandBurnsHealHitTimer = null;

let brandBurnsHealLightningFrame = null;

let brandBurnsPuckWindow = null;

let brandBurnsPuckHealButton = null;

let brandBurnsPuckCooldownTimer = null;

let brandBurnsPuckHasAppeared = false;

let brandBurnsPuckHealReady = false;

let brandBurnsBlockTimer = null;

let brandBurnsBlockCooldownTimer = null;

let brandBurnsBlockWindow = null;

let brandBurnsBlockProgressBar = null;

let brandBurnsBlockProgressFrame = null;

let brandBurnsBlocking = false;

let brandBurnsOutcome = null;

let brandBurnsStats = {
  health: BRAND_BURNS_PLAYER_MAX_HEALTH,
  maxHealth: BRAND_BURNS_PLAYER_MAX_HEALTH,
  stamina: BRAND_BURNS_PLAYER_MAX_STAMINA,
  defeated: 0,
  total: BRAND_BURNS_ENCOUNTER_COUNT,
};

const brandBurnsRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const isBrandBurnsWindowVisible = (win) => isManagedRandomEventWindowVisible(win);

const isBrandBurnsMainWindowVisible = () =>
  isBrandBurnsWindowVisible(brandBurnsWindow);

const isBrandBurnsEnemyWindowVisible = (win) =>
  isBrandBurnsWindowVisible(win);

const isBrandBurnsButtonClickTarget = (target) =>
  Boolean(
    target?.closest("button") &&
      target.closest(
        "#brand-burns-window, .brand-apostle-window, .brand-puck-window, .brand-block-window"
      )
  );

const isBrandBurnsVisible = () =>
  isBrandBurnsMainWindowVisible() ||
  isBrandBurnsPuckWindowVisible() ||
  isBrandBurnsBlockWindowVisible() ||
  brandBurnsEnemyWindows.some(isBrandBurnsEnemyWindowVisible);

const setBrandBurnsStageHidden = (stage, hidden) => {
  if (!stage) return;
  stage.classList.toggle("is-hidden", hidden);
};

const brandBurnsMeterPercent = (value, maxValue) => {
  const max = Math.max(1, maxValue);
  const clamped = clampNumber(value, 0, max);
  if (clamped <= 0) return 0;
  const segments = Math.ceil((clamped / max) * BRAND_BURNS_METER_SEGMENTS);
  return (
    (Math.min(BRAND_BURNS_METER_SEGMENTS, segments) / BRAND_BURNS_METER_SEGMENTS) * 100
  );
};

const updateBrandBurnsHud = () => {
  const maxHealth = Math.max(1, brandBurnsStats.maxHealth || BRAND_BURNS_PLAYER_MAX_HEALTH);
  const health = clampNumber(brandBurnsStats.health, 0, maxHealth);
  const healthPercent = brandBurnsMeterPercent(health, maxHealth);
  const stamina = clampNumber(brandBurnsStats.stamina, 0, BRAND_BURNS_PLAYER_MAX_STAMINA);
  const staminaPercent = brandBurnsMeterPercent(stamina, BRAND_BURNS_PLAYER_MAX_STAMINA);
  const remaining = Math.max(0, brandBurnsStats.total - brandBurnsStats.defeated);

  if (brandBurnsHealth) brandBurnsHealth.style.width = `${healthPercent}%`;
  if (brandBurnsHealth?.parentElement) {
    brandBurnsHealth.parentElement.setAttribute("aria-valuenow", Math.round(health));
    brandBurnsHealth.parentElement.setAttribute("aria-valuemax", String(maxHealth));
  }
  if (brandBurnsHealthValue) {
    brandBurnsHealthValue.textContent = `${Math.round(health)}/${maxHealth}`;
  }
  if (brandBurnsStamina) brandBurnsStamina.style.width = `${staminaPercent}%`;
  if (brandBurnsStamina?.parentElement) {
    brandBurnsStamina.parentElement.setAttribute("aria-valuenow", Math.round(stamina));
    brandBurnsStamina.parentElement.setAttribute(
      "aria-valuemax",
      String(BRAND_BURNS_PLAYER_MAX_STAMINA)
    );
  }
  if (brandBurnsStaminaValue) {
    brandBurnsStaminaValue.textContent = `${Math.round(stamina)}/${BRAND_BURNS_PLAYER_MAX_STAMINA}`;
  }
  if (brandBurnsEnemyCount) {
    brandBurnsEnemyCount.textContent = `Apostles remaining: ${remaining}`;
  }
};

const resetBrandBurnsStats = () => {
  brandBurnsStats = {
    health: BRAND_BURNS_PLAYER_MAX_HEALTH,
    maxHealth: BRAND_BURNS_PLAYER_MAX_HEALTH,
    stamina: BRAND_BURNS_PLAYER_MAX_STAMINA,
    defeated: 0,
    total: BRAND_BURNS_ENCOUNTER_COUNT,
  };
  updateBrandBurnsHud();
};

const stopBrandBurnsStaminaRecovery = () => {
  if (!brandBurnsStaminaTimer) return;
  clearInterval(brandBurnsStaminaTimer);
  brandBurnsStaminaTimer = null;
};

const hasBrandBurnsAttackStamina = () =>
  brandBurnsStats.stamina >= BRAND_BURNS_STAMINA_ATTACK_MIN_COST;

const getBrandBurnsAttackStaminaCost = () =>
  brandBurnsRandomInt(
    BRAND_BURNS_STAMINA_ATTACK_MIN_COST,
    clampNumber(
      Math.floor(brandBurnsStats.stamina),
      BRAND_BURNS_STAMINA_ATTACK_MIN_COST,
      BRAND_BURNS_STAMINA_ATTACK_MAX_COST
    )
  );

const getBrandBurnsStaminaRecoveryAmount = () => {
  const maxHealth = Math.max(1, brandBurnsStats.maxHealth || BRAND_BURNS_PLAYER_MAX_HEALTH);
  const staminaFactor = Math.max(
    BRAND_BURNS_STAMINA_RECOVERY_MIN_FACTOR,
    clampNumber(brandBurnsStats.stamina, 0, BRAND_BURNS_PLAYER_MAX_STAMINA) /
      BRAND_BURNS_PLAYER_MAX_STAMINA
  );
  const missingHealthFactor =
    1 +
    (1 - clampNumber(brandBurnsStats.health, 0, maxHealth) / maxHealth) *
      BRAND_BURNS_STAMINA_LOW_HEALTH_BONUS;
  const blockFactor = brandBurnsBlocking ? BRAND_BURNS_STAMINA_BLOCK_RECOVERY_BONUS : 1;

  return BRAND_BURNS_STAMINA_RECOVERY_AMOUNT * staminaFactor * missingHealthFactor * blockFactor;
};

const startBrandBurnsStaminaRecovery = () => {
  stopBrandBurnsStaminaRecovery();
  brandBurnsStaminaTimer = setInterval(() => {
    if (brandBurnsStage !== "fight") {
      stopBrandBurnsStaminaRecovery();
      return;
    }
    const nextStamina = Math.min(
      BRAND_BURNS_PLAYER_MAX_STAMINA,
      brandBurnsStats.stamina + getBrandBurnsStaminaRecoveryAmount()
    );
    if (nextStamina === brandBurnsStats.stamina) return;

    brandBurnsStats.stamina = nextStamina;
    updateBrandBurnsHud();
    updateBrandBurnsAttackButtonStates();
  }, BRAND_BURNS_STAMINA_RECOVERY_MS);
};

const clearBrandBurnsEnemyTimers = () => {
  brandBurnsEnemyTimers.forEach((timer) => clearTimeout(timer));
  brandBurnsEnemyTimers = [];
};

const updateBrandBurnsEnemyHud = (state) => {
  const percent = clampNumber((state.health / state.maxHealth) * 100, 0, 100);
  if (state.healthBar) state.healthBar.style.width = `${percent}%`;
  if (state.healthValue) {
    state.healthValue.textContent = `${Math.max(0, Math.round(state.health))}/${state.maxHealth}`;
  }
};

const brandBurnsViewerImage = () => brandBurnsWindow?.querySelector("#brand-burns-weapon-icon");

const setBrandBurnsViewerImage = (src) => {
  const image = brandBurnsViewerImage();
  if (!image) return;
  image.dataset.src = src;
  image.src = src;
};

const clearBrandBurnsEnemyAttackTimer = (state) => {
  if (!state?.playerAttackTimer) return;
  clearTimeout(state.playerAttackTimer);
  state.playerAttackTimer = null;
};

const brandBurnsOmenLightningCanvas = () =>
  brandBurnsWindow?.querySelector(".brand-burns-lightning-canvas") || null;

const clearBrandBurnsOmenEffect = () => {
  if (brandBurnsOmenTimer) {
    clearTimeout(brandBurnsOmenTimer);
    brandBurnsOmenTimer = null;
  }
  if (brandBurnsOmenHitTimer) {
    clearTimeout(brandBurnsOmenHitTimer);
    brandBurnsOmenHitTimer = null;
  }
  if (brandBurnsOmenLightningFrame) {
    cancelAnimationFrame(brandBurnsOmenLightningFrame);
    brandBurnsOmenLightningFrame = null;
  }
  clearLightningCanvas(brandBurnsOmenLightningCanvas());
  if (brandBurnsWindow) brandBurnsWindow.classList.remove("is-omen");
};

const clearBrandBurnsHealEffect = () => {
  if (brandBurnsHealHitTimer) {
    clearTimeout(brandBurnsHealHitTimer);
    brandBurnsHealHitTimer = null;
  }
  if (brandBurnsHealLightningFrame) {
    cancelAnimationFrame(brandBurnsHealLightningFrame);
    brandBurnsHealLightningFrame = null;
  }
  clearLightningCanvas(brandBurnsOmenLightningCanvas());
  if (brandBurnsWindow) brandBurnsWindow.classList.remove("is-healed");
};

const startBrandBurnsOmenLightningStrike = () => {
  const canvas = brandBurnsOmenLightningCanvas();
  if (!canvas) return;
  if (brandBurnsOmenLightningFrame) {
    cancelAnimationFrame(brandBurnsOmenLightningFrame);
  }
  const startedAt = performance.now();

  const render = (now) => {
    const progress = Math.min(1, (now - startedAt) / FATE_LIGHTNING_DURATION_MS);
    const flicker = progress < 0.16 ? 1 : Math.random() > 0.32 ? 1 - progress * 0.42 : 0.18;
    const alpha = Math.max(0, flicker * (1 - progress * 0.36));
    drawLightningBorderFrame(canvas, alpha);

    if (progress < 1) {
      brandBurnsOmenLightningFrame = requestAnimationFrame(render);
      return;
    }

    brandBurnsOmenLightningFrame = null;
    clearLightningCanvas(canvas);
  };

  brandBurnsOmenLightningFrame = requestAnimationFrame(render);
};

const pulseBrandBurnsOmen = () => {
  if (!brandBurnsWindow || brandBurnsStage !== "prompt" || !isBrandBurnsMainWindowVisible()) {
    return;
  }
  if (brandBurnsOmenHitTimer) {
    clearTimeout(brandBurnsOmenHitTimer);
    brandBurnsOmenHitTimer = null;
  }

  brandBurnsWindow.classList.remove("is-omen");
  void brandBurnsWindow.offsetWidth;
  brandBurnsWindow.classList.add("is-omen");
  startBrandBurnsOmenLightningStrike();
  brandBurnsOmenHitTimer = setTimeout(() => {
    if (brandBurnsWindow) brandBurnsWindow.classList.remove("is-omen");
    brandBurnsOmenHitTimer = null;
  }, 240);
};

const scheduleBrandBurnsOmenPulse = () => {
  if (brandBurnsOmenTimer) {
    clearTimeout(brandBurnsOmenTimer);
    brandBurnsOmenTimer = null;
  }
  if (!brandBurnsWindow || brandBurnsStage !== "prompt" || !isBrandBurnsMainWindowVisible()) {
    return;
  }

  const delay = brandBurnsRandomInt(
    BRAND_BURNS_OMEN_MIN_DELAY_MS,
    BRAND_BURNS_OMEN_MAX_DELAY_MS
  );
  brandBurnsOmenTimer = setTimeout(() => {
    brandBurnsOmenTimer = null;
    if (brandBurnsStage !== "prompt" || !isBrandBurnsMainWindowVisible()) return;
    pulseBrandBurnsOmen();
    scheduleBrandBurnsOmenPulse();
  }, delay);
};

const startBrandBurnsHealLightningStrike = () => {
  const canvas = brandBurnsOmenLightningCanvas();
  if (!canvas) return;
  if (brandBurnsHealLightningFrame) cancelAnimationFrame(brandBurnsHealLightningFrame);
  const startedAt = performance.now();

  const render = (now) => {
    const progress = Math.min(1, (now - startedAt) / FATE_LIGHTNING_DURATION_MS);
    const flicker = progress < 0.16 ? 1 : Math.random() > 0.32 ? 1 - progress * 0.42 : 0.18;
    const alpha = Math.max(0, flicker * (1 - progress * 0.36));
    drawLightningBorderFrame(canvas, alpha, GREEN_LIGHTNING_PALETTE);

    if (progress < 1) {
      brandBurnsHealLightningFrame = requestAnimationFrame(render);
      return;
    }

    brandBurnsHealLightningFrame = null;
    clearLightningCanvas(canvas);
  };

  brandBurnsHealLightningFrame = requestAnimationFrame(render);
};

const pulseBrandBurnsHealEffect = () => {
  if (!brandBurnsWindow) return;
  if (brandBurnsHealHitTimer) {
    clearTimeout(brandBurnsHealHitTimer);
    brandBurnsHealHitTimer = null;
  }

  brandBurnsWindow.classList.remove("is-healed");
  void brandBurnsWindow.offsetWidth;
  brandBurnsWindow.classList.add("is-healed");
  startBrandBurnsHealLightningStrike();
  brandBurnsHealHitTimer = setTimeout(() => {
    if (brandBurnsWindow) brandBurnsWindow.classList.remove("is-healed");
    brandBurnsHealHitTimer = null;
  }, 240);
};

const isBrandBurnsPuckWindowVisible = () =>
  isBrandBurnsWindowVisible(brandBurnsPuckWindow);

const clearBrandBurnsPuckCooldown = () => {
  if (!brandBurnsPuckCooldownTimer) return;
  clearTimeout(brandBurnsPuckCooldownTimer);
  brandBurnsPuckCooldownTimer = null;
};

const setBrandBurnsPuckHealReady = (ready) => {
  brandBurnsPuckHealReady = ready;
  if (!brandBurnsPuckHealButton) return;
  const canHeal = ready && brandBurnsStage === "fight" && brandBurnsStats.health > 0;
  brandBurnsPuckHealButton.disabled = !canHeal;
};

const createBrandBurnsStatusEntry = (...nodes) => {
  const entry = document.createElement("span");
  entry.className = "brand-burns-status-entry";
  entry.append(...nodes);
  return entry;
};

const scrollBrandBurnsStatusLog = () => {
  if (!brandBurnsStatus) return;
  brandBurnsStatus.scrollTop = brandBurnsStatus.scrollHeight;
};

const setBrandBurnsStatusText = (message) => {
  if (!brandBurnsStatus) return;
  brandBurnsStatus.replaceChildren(createBrandBurnsStatusEntry(document.createTextNode(message)));
  scrollBrandBurnsStatusLog();
};

const appendBrandBurnsStatusWithAmount = (prefix, amount, suffix, amountClassName) => {
  if (!brandBurnsStatus) return;
  const amountNode = document.createElement("span");
  amountNode.className = amountClassName;
  amountNode.textContent = String(amount);
  const entry = createBrandBurnsStatusEntry(
    document.createTextNode(prefix),
    amountNode,
    document.createTextNode(suffix)
  );
  entry.classList.add("is-new");
  brandBurnsStatus.append(entry);

  while (brandBurnsStatus.children.length > 4) {
    brandBurnsStatus.firstElementChild?.remove();
  }

  scrollBrandBurnsStatusLog();
};

const scheduleBrandBurnsPuckHealCooldown = () => {
  clearBrandBurnsPuckCooldown();
  setBrandBurnsPuckHealReady(false);
  brandBurnsPuckCooldownTimer = setTimeout(() => {
    brandBurnsPuckCooldownTimer = null;
    setBrandBurnsPuckHealReady(true);
  }, BRAND_BURNS_PUCK_HEAL_COOLDOWN_MS);
};

const getBrandBurnsRemainingApostleCount = () =>
  Math.max(0, brandBurnsStats.total - brandBurnsStats.defeated);

const getBrandBurnsPuckHealRange = () =>
  BRAND_BURNS_PUCK_HEAL_RANGES_BY_REMAINING[getBrandBurnsRemainingApostleCount()] ||
  BRAND_BURNS_PUCK_HEAL_RANGES_BY_REMAINING[1];

const healBrandBurnsPlayerFromPuck = () => {
  if (!brandBurnsPuckHealReady || brandBurnsStage !== "fight" || brandBurnsStats.health <= 0) {
    return;
  }

  const maxHealth = Math.max(1, brandBurnsStats.maxHealth || BRAND_BURNS_PLAYER_MAX_HEALTH);
  const [healMin, healMax] = getBrandBurnsPuckHealRange();
  const healAmount = brandBurnsRandomInt(healMin, healMax);
  const previousHealth = brandBurnsStats.health;
  brandBurnsStats.health = Math.min(maxHealth, brandBurnsStats.health + healAmount);
  const actualHeal = Math.round(brandBurnsStats.health - previousHealth);

  updateBrandBurnsHud();
  pulseBrandBurnsHealEffect();
  if (actualHeal > 0) {
    appendBrandBurnsStatusWithAmount(
      "Puck heals you for ",
      actualHeal,
      ".",
      "brand-burns-status-heal"
    );
  } else {
    setBrandBurnsStatusText("Puck is ready if the brand burns again.");
  }
  scheduleBrandBurnsPuckHealCooldown();
};

const removeBrandBurnsPuckWindow = () => {
  clearBrandBurnsPuckCooldown();
  if (brandBurnsPuckWindow) brandBurnsPuckWindow.remove();
  brandBurnsPuckWindow = null;
  brandBurnsPuckHealButton = null;
  brandBurnsPuckHealReady = false;
};

const closeBrandBurnsPuckWindow = () => {
  if (!brandBurnsPuckWindow) return;
  clearBrandBurnsPuckCooldown();
  if (!closeManagedRandomEventWindow(brandBurnsPuckWindow)) {
    removeBrandBurnsPuckWindow();
  }
};

const createBrandBurnsPuckWindow = () => {
  const win = document.createElement("div");
  win.className = "window random-event-window brand-puck-window is-hidden";
  win.setAttribute("aria-hidden", "true");

  const titleBar = document.createElement("div");
  titleBar.className = "title-bar";

  const title = document.createElement("div");
  title.className = "title-bar-text";
  title.textContent = "Puck";
  titleBar.append(title);

  const body = document.createElement("div");
  body.className = "window-body brand-puck-body";

  const frame = document.createElement("div");
  frame.className = "brand-puck-image-frame";

  const image = document.createElement("img");
  image.src = BRAND_BURNS_PUCK_IMAGE;
  image.decoding = "async";
  image.alt = "Puck";
  frame.append(image);

  const actions = document.createElement("div");
  actions.className = "brand-puck-actions";

  const healButton = document.createElement("button");
  healButton.type = "button";
  healButton.textContent = "Heal";
  actions.append(healButton);
  body.append(frame, actions);
  win.append(titleBar, body);

  brandBurnsPuckHealButton = healButton;

  healButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    healBrandBurnsPlayerFromPuck();
  });

  bindManagedRandomEventWindowAnimation(win, {
    afterOpen: () => clampRandomEventWindowToViewport(win),
    onClose: removeBrandBurnsPuckWindow,
  });

  image.addEventListener("load", () => clampRandomEventWindowToViewport(win));
  return win;
};

const showBrandBurnsPuckWindow = () => {
  if (isBrandBurnsPuckWindowVisible()) {
    brandBurnsPuckWindow.style.zIndex = String(nextWindowZIndex());
    clampRandomEventWindowToViewport(brandBurnsPuckWindow);
    setBrandBurnsPuckHealReady(brandBurnsPuckHealReady);
    return;
  }

  brandBurnsPuckWindow = createBrandBurnsPuckWindow();
  document.body.appendChild(brandBurnsPuckWindow);
  showManagedRandomEventWindow(brandBurnsPuckWindow, {
    isVisible: () => false,
    clampAfterMediaLoad: true,
    afterShow: () => setBrandBurnsPuckHealReady(true),
  });
};

const maybeShowBrandBurnsPuckWindow = () => {
  const maxHealth = Math.max(1, brandBurnsStats.maxHealth || BRAND_BURNS_PLAYER_MAX_HEALTH);
  const isBelowThreshold =
    brandBurnsStats.health > 0 &&
    brandBurnsStats.health < maxHealth * BRAND_BURNS_PUCK_HEALTH_THRESHOLD_FACTOR;

  if (
    brandBurnsPuckHasAppeared ||
    brandBurnsStage !== "fight" ||
    !isBrandBurnsMainWindowVisible() ||
    !isBelowThreshold
  ) {
    return;
  }

  brandBurnsPuckHasAppeared = true;
  showBrandBurnsPuckWindow();
};

const clearBrandBurnsEnemyHitEffect = (state) => {
  if (!state) return;
  if (state.hitTimer) {
    clearTimeout(state.hitTimer);
    state.hitTimer = null;
  }
  if (state.lightningFrame) {
    cancelAnimationFrame(state.lightningFrame);
    state.lightningFrame = null;
  }
  clearLightningCanvas(state.lightningCanvas);
  if (state.win) state.win.classList.remove("is-hit");
};

const startBrandBurnsEnemyLightningStrike = (state) => {
  if (!state?.lightningCanvas) return;
  if (state.lightningFrame) cancelAnimationFrame(state.lightningFrame);
  const startedAt = performance.now();

  const render = (now) => {
    const progress = Math.min(1, (now - startedAt) / FATE_LIGHTNING_DURATION_MS);
    const flicker = progress < 0.16 ? 1 : Math.random() > 0.32 ? 1 - progress * 0.42 : 0.18;
    const alpha = Math.max(0, flicker * (1 - progress * 0.36));
    drawLightningBorderFrame(state.lightningCanvas, alpha);

    if (progress < 1) {
      state.lightningFrame = requestAnimationFrame(render);
      return;
    }

    state.lightningFrame = null;
    clearLightningCanvas(state.lightningCanvas);
  };

  state.lightningFrame = requestAnimationFrame(render);
};

const pulseBrandBurnsEnemyHit = (state) => {
  if (!state?.win) return;
  if (state.hitTimer) {
    clearTimeout(state.hitTimer);
    state.hitTimer = null;
  }

  state.win.classList.remove("is-hit");
  void state.win.offsetWidth;
  state.win.classList.add("is-hit");
  startBrandBurnsEnemyLightningStrike(state);
  state.hitTimer = setTimeout(() => {
    if (state.win) state.win.classList.remove("is-hit");
    state.hitTimer = null;
  }, 240);
};

const stopBrandBurnsEnemyAttacks = () => {
  brandBurnsEnemyWindows.forEach((win) => {
    if (win.brandBurnsState) clearBrandBurnsEnemyAttackTimer(win.brandBurnsState);
  });
};

const updateBrandBurnsAttackButtonStates = () => {
  const shouldDisableAttacks =
    brandBurnsBlocking ||
    brandBurnsStage !== "fight" ||
    brandBurnsStats.health <= 0 ||
    !hasBrandBurnsAttackStamina();

  brandBurnsEnemyWindows.forEach((win) => {
    const state = win.brandBurnsState;
    if (!state?.attackButton) return;
    state.attackButton.disabled = state.defeated || shouldDisableAttacks;
  });
};

const isBrandBurnsBlockCoolingDown = () => Boolean(brandBurnsBlockCooldownTimer);

const updateBrandBurnsActionButton = () => {
  if (!brandBurnsFight) return;
  if (brandBurnsOutcome === "won") {
    brandBurnsFight.textContent = "Rest";
    brandBurnsFight.disabled = false;
    return;
  }
  if (brandBurnsOutcome === "lost") {
    brandBurnsFight.textContent = "Give Up";
    brandBurnsFight.disabled = false;
    return;
  }
  if (brandBurnsStage === "prompt") {
    brandBurnsFight.textContent = "Fight them off!";
    brandBurnsFight.disabled = false;
    return;
  }
  if (brandBurnsStage === "fight") {
    if (brandBurnsBlocking) {
      brandBurnsFight.textContent = "Blocking...";
      brandBurnsFight.disabled = true;
      return;
    }
    if (isBrandBurnsBlockCoolingDown()) {
      brandBurnsFight.textContent = "Recovering...";
      brandBurnsFight.disabled = true;
      return;
    }
    brandBurnsFight.textContent = "Block";
    brandBurnsFight.disabled = brandBurnsStats.health <= 0;
    return;
  }
  brandBurnsFight.textContent = "Block";
  brandBurnsFight.disabled = true;
};

const clearBrandBurnsBlockCooldown = () => {
  if (!brandBurnsBlockCooldownTimer) return;
  clearTimeout(brandBurnsBlockCooldownTimer);
  brandBurnsBlockCooldownTimer = null;
};

const startBrandBurnsBlockCooldown = () => {
  clearBrandBurnsBlockCooldown();
  if (brandBurnsStage !== "fight" || brandBurnsStats.health <= 0 || brandBurnsOutcome) return;
  brandBurnsBlockCooldownTimer = setTimeout(() => {
    brandBurnsBlockCooldownTimer = null;
    updateBrandBurnsActionButton();
  }, BRAND_BURNS_BLOCK_COOLDOWN_MS);
  updateBrandBurnsActionButton();
};

const clearBrandBurnsBlockProgress = () => {
  if (!brandBurnsBlockProgressFrame) return;
  cancelAnimationFrame(brandBurnsBlockProgressFrame);
  brandBurnsBlockProgressFrame = null;
};

const isBrandBurnsBlockWindowVisible = () =>
  isBrandBurnsWindowVisible(brandBurnsBlockWindow);

const removeBrandBurnsBlockWindow = () => {
  clearBrandBurnsBlockProgress();
  if (brandBurnsBlockWindow) brandBurnsBlockWindow.remove();
  brandBurnsBlockWindow = null;
  brandBurnsBlockProgressBar = null;
};

const closeBrandBurnsBlockWindow = () => {
  clearBrandBurnsBlockProgress();
  if (!brandBurnsBlockWindow) return;
  if (brandBurnsBlockWindow.classList.contains("is-hidden")) {
    removeBrandBurnsBlockWindow();
    return;
  }
  const closingWindow = brandBurnsBlockWindow;
  closeManagedRandomEventWindow(brandBurnsBlockWindow, { force: true });
  setTimeout(() => {
    if (brandBurnsBlockWindow === closingWindow && closingWindow.classList.contains("is-closing")) {
      removeBrandBurnsBlockWindow();
    }
  }, 220);
};

const animateBrandBurnsBlockProgress = (startedAt) => {
  if (!brandBurnsBlockProgressBar || !brandBurnsBlocking) {
    clearBrandBurnsBlockProgress();
    return;
  }

  const progress = Math.min(1, (performance.now() - startedAt) / BRAND_BURNS_BLOCK_DURATION_MS);
  const percent = progress * 100;
  brandBurnsBlockProgressBar.style.width = `${percent}%`;
  brandBurnsBlockProgressBar.parentElement?.setAttribute(
    "aria-valuenow",
    String(Math.round(percent))
  );

  if (progress >= 1) {
    brandBurnsBlockProgressFrame = null;
    endBrandBurnsBlock();
    return;
  }

  brandBurnsBlockProgressFrame = requestAnimationFrame(() =>
    animateBrandBurnsBlockProgress(startedAt)
  );
};

const createBrandBurnsBlockWindow = () => {
  const win = document.createElement("div");
  win.className = "window random-event-window brand-block-window is-hidden";
  win.setAttribute("aria-hidden", "true");

  const titleBar = document.createElement("div");
  titleBar.className = "title-bar";

  const title = document.createElement("div");
  title.className = "title-bar-text";
  title.textContent = "Blocking";
  titleBar.append(title);

  const body = document.createElement("div");
  body.className = "window-body brand-block-body";

  const label = document.createElement("p");
  label.className = "brand-block-status";
  label.textContent = "Blocking";

  const progress = document.createElement("div");
  progress.className = "progress-indicator segmented brand-block-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "Block duration");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-valuenow", "0");

  const bar = document.createElement("span");
  bar.className = "progress-indicator-bar";
  bar.style.width = "0%";
  progress.append(bar);

  const actions = document.createElement("div");
  actions.className = "brand-block-actions";

  const dropButton = document.createElement("button");
  dropButton.type = "button";
  dropButton.textContent = "Drop Guard";
  actions.append(dropButton);

  body.append(label, progress, actions);
  win.append(titleBar, body);

  dropButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    endBrandBurnsBlock();
  });

  bindManagedRandomEventWindowAnimation(win, {
    afterOpen: () => clampRandomEventWindowToViewport(win),
    onClose: removeBrandBurnsBlockWindow,
  });

  brandBurnsBlockProgressBar = bar;
  return win;
};

const showBrandBurnsBlockWindow = () => {
  removeBrandBurnsBlockWindow();
  brandBurnsBlockWindow = createBrandBurnsBlockWindow();
  document.body.appendChild(brandBurnsBlockWindow);
  showManagedRandomEventWindow(brandBurnsBlockWindow, { isVisible: () => false });

  const startedAt = performance.now();
  animateBrandBurnsBlockProgress(startedAt);
};

const endBrandBurnsBlock = () => {
  if (brandBurnsBlockTimer) {
    clearTimeout(brandBurnsBlockTimer);
    brandBurnsBlockTimer = null;
  }
  if (!brandBurnsBlocking) return;
  brandBurnsBlocking = false;
  closeBrandBurnsBlockWindow();
  startBrandBurnsBlockCooldown();
  updateBrandBurnsAttackButtonStates();
  updateBrandBurnsActionButton();
  if (brandBurnsStatus && brandBurnsStage === "fight" && brandBurnsStats.health > 0) {
    setBrandBurnsStatusText("Your guard drops. You can attack again.");
  }
};

const clearBrandBurnsBlock = () => {
  if (brandBurnsBlockTimer) {
    clearTimeout(brandBurnsBlockTimer);
    brandBurnsBlockTimer = null;
  }
  clearBrandBurnsBlockCooldown();
  brandBurnsBlocking = false;
  closeBrandBurnsBlockWindow();
  updateBrandBurnsAttackButtonStates();
  updateBrandBurnsActionButton();
};

const startBrandBurnsBlock = () => {
  if (
    brandBurnsStage !== "fight" ||
    brandBurnsStats.health <= 0 ||
    brandBurnsBlocking ||
    isBrandBurnsBlockCoolingDown()
  ) {
    updateBrandBurnsActionButton();
    return;
  }
  brandBurnsBlocking = true;
  updateBrandBurnsAttackButtonStates();
  updateBrandBurnsActionButton();
  if (brandBurnsStatus) {
    setBrandBurnsStatusText("You brace behind the Dragon Slayer.");
  }
  showBrandBurnsBlockWindow();
  brandBurnsBlockTimer = debounceTimer(
    brandBurnsBlockTimer,
    endBrandBurnsBlock,
    BRAND_BURNS_BLOCK_DURATION_MS
  );
};

const finishBrandBurnsIfPlayerDefeated = () => {
  if (brandBurnsStats.health > 0) return false;
  brandBurnsStats.health = 0;
  brandBurnsOutcome = "lost";
  updateBrandBurnsHud();
  stopBrandBurnsStaminaRecovery();
  stopBrandBurnsEnemyAttacks();
  clearBrandBurnsBlock();
  clearBrandBurnsPuckCooldown();
  setBrandBurnsPuckHealReady(false);
  updateBrandBurnsAttackButtonStates();
  if (brandBurnsStatus) {
    setBrandBurnsStatusText("You have been overwhelmed.");
  }
  updateBrandBurnsActionButton();
  return true;
};

const scheduleBrandBurnsEnemyAttack = (state) => {
  clearBrandBurnsEnemyAttackTimer(state);
  if (
    !state ||
    state.defeated ||
    brandBurnsStage !== "fight" ||
    brandBurnsStats.health <= 0 ||
    !isBrandBurnsEnemyWindowVisible(state.win)
  ) {
    return;
  }

  const delay = brandBurnsRandomInt(
    BRAND_BURNS_APOSTLE_ATTACK_MIN_DELAY_MS,
    BRAND_BURNS_APOSTLE_ATTACK_MAX_DELAY_MS
  );
  state.playerAttackTimer = setTimeout(() => {
    state.playerAttackTimer = null;
    if (
      state.defeated ||
      brandBurnsStage !== "fight" ||
      brandBurnsStats.health <= 0 ||
      !isBrandBurnsEnemyWindowVisible(state.win)
    ) {
      return;
    }

    const rawDamage = brandBurnsRandomInt(
      BRAND_BURNS_APOSTLE_PLAYER_ATTACK_MIN_DAMAGE,
      BRAND_BURNS_APOSTLE_PLAYER_ATTACK_MAX_DAMAGE
    );
    const damage = brandBurnsBlocking
      ? Math.max(1, Math.ceil(rawDamage * BRAND_BURNS_BLOCK_DAMAGE_FACTOR))
      : rawDamage;
    brandBurnsStats.health = Math.max(0, brandBurnsStats.health - damage);
    updateBrandBurnsHud();
    maybeShowBrandBurnsPuckWindow();
    if (brandBurnsWindow) {
      brandBurnsWindow.classList.remove("is-hit");
      void brandBurnsWindow.offsetWidth;
      brandBurnsWindow.classList.add("is-hit");
      setTimeout(() => {
        if (brandBurnsWindow) brandBurnsWindow.classList.remove("is-hit");
      }, 190);
    }
    appendBrandBurnsStatusWithAmount(
      brandBurnsBlocking
        ? `${state.definition.name} hits your guard for `
        : `${state.definition.name} hits you for `,
      damage,
      " damage.",
      "brand-burns-status-damage"
    );
    if (!finishBrandBurnsIfPlayerDefeated()) {
      scheduleBrandBurnsEnemyAttack(state);
    }
  }, delay);
};

const removeBrandBurnsEnemyWindow = (win) => {
  if (!win) return;
  if (win.brandBurnsState) clearBrandBurnsEnemyAttackTimer(win.brandBurnsState);
  if (win.brandBurnsState) clearBrandBurnsEnemyHitEffect(win.brandBurnsState);
  win.remove();
  brandBurnsEnemyWindows = brandBurnsEnemyWindows.filter((item) => item !== win);
};

const closeBrandBurnsEnemyWindow = (win) => {
  if (win?.classList.contains("is-closing")) return;
  closeManagedRandomEventWindow(win, {
    force: true,
    beforeClose: () => {
      if (!win.brandBurnsState) return;
      clearBrandBurnsEnemyAttackTimer(win.brandBurnsState);
      clearBrandBurnsEnemyHitEffect(win.brandBurnsState);
    },
  });
};

const closeBrandBurnsEnemyWindows = ({ stagger = false } = {}) => {
  const windows = brandBurnsEnemyWindows.filter(isBrandBurnsEnemyWindowVisible);
  if (!stagger) {
    windows.forEach(closeBrandBurnsEnemyWindow);
    return;
  }

  windows.forEach((win, index) => {
    const timer = setTimeout(
      () => closeBrandBurnsEnemyWindow(win),
      index * BRAND_BURNS_APOSTLE_CLOSE_DELAY_MS
    );
    brandBurnsEnemyTimers.push(timer);
  });
};

const finishBrandBurnsIfCleared = () => {
  if (brandBurnsStats.defeated < brandBurnsStats.total) return;
  brandBurnsOutcome = "won";
  stopBrandBurnsStaminaRecovery();
  stopBrandBurnsEnemyAttacks();
  clearBrandBurnsBlock();
  closeBrandBurnsPuckWindow();
  setBrandBurnsViewerImage(BRAND_BURNS_PUCK_WIN_IMAGE);
  if (brandBurnsStatus) {
    setBrandBurnsStatusText("The night relents. The brand cools.");
  }
  if (brandBurnsEnemyCount) {
    brandBurnsEnemyCount.textContent = "Apostles remaining: 0";
  }
  updateBrandBurnsActionButton();
};

const recordBrandBurnsDefeat = (state) => {
  state.defeated = true;
  brandBurnsStats.defeated = Math.min(
    brandBurnsStats.total,
    brandBurnsStats.defeated + 1
  );
  updateBrandBurnsHud();
  if (brandBurnsStatus) {
    setBrandBurnsStatusText(`${state.definition.name} is driven back.`);
  }
  finishBrandBurnsIfCleared();
};

const attackBrandBurnsEnemy = (state) => {
  if (!state || state.defeated || brandBurnsBlocking || brandBurnsStats.health <= 0) return;
  if (!hasBrandBurnsAttackStamina()) {
    updateBrandBurnsAttackButtonStates();
    if (brandBurnsStatus) {
      setBrandBurnsStatusText("You need more stamina to attack.");
    }
    return;
  }

  const damage = brandBurnsRandomInt(
    BRAND_BURNS_ATTACK_MIN_DAMAGE,
    BRAND_BURNS_ATTACK_MAX_DAMAGE
  );
  const staminaCost = getBrandBurnsAttackStaminaCost();

  brandBurnsStats.stamina = Math.max(0, brandBurnsStats.stamina - staminaCost);
  state.health = Math.max(0, state.health - damage);
  updateBrandBurnsHud();
  updateBrandBurnsAttackButtonStates();
  updateBrandBurnsEnemyHud(state);

  if (state.damageLabel) {
    state.damageLabel.textContent = `-${damage}`;
    state.damageLabel.classList.remove("is-flashing");
    void state.damageLabel.offsetWidth;
    state.damageLabel.classList.add("is-flashing");
  }

  pulseBrandBurnsEnemyHit(state);

  if (state.health > 0) {
    if (brandBurnsStatus) {
      setBrandBurnsStatusText(`${state.definition.name} takes ${damage} damage.`);
    }
    return;
  }

  if (state.attackButton) {
    state.attackButton.disabled = true;
    state.attackButton.textContent = "Defeated";
  }
  clearBrandBurnsEnemyAttackTimer(state);
  if (state.win) state.win.classList.add("is-defeated");
  recordBrandBurnsDefeat(state);
  setTimeout(() => closeBrandBurnsEnemyWindow(state.win), 650);
};

const createBrandBurnsEnemyWindow = (definition) => {
  const maxHealth = brandBurnsRandomInt(definition.minHealth, definition.maxHealth);
  const state = {
    definition,
    health: maxHealth,
    maxHealth,
    defeated: false,
  };

  const win = document.createElement("div");
  win.className = "window random-event-window brand-apostle-window is-hidden";
  win.setAttribute("aria-hidden", "true");
  win.dataset.brandBurnsEnemy = definition.id;

  const lightningField = document.createElement("div");
  lightningField.className = "brand-apostle-lightning-field";
  lightningField.setAttribute("aria-hidden", "true");

  const lightningCanvas = document.createElement("canvas");
  lightningCanvas.className = "brand-apostle-lightning-canvas";
  lightningField.append(lightningCanvas);

  const titleBar = document.createElement("div");
  titleBar.className = "title-bar";

  const title = document.createElement("div");
  title.className = "title-bar-text";
  title.textContent = definition.name;

  titleBar.append(title);

  const body = document.createElement("div");
  body.className = "window-body";

  const frame = document.createElement("div");
  frame.className = "brand-apostle-image-frame";

  const image = document.createElement("img");
  image.src = definition.image;
  image.decoding = "async";
  image.alt = `Released form of ${definition.name}`;
  frame.append(image);

  const healthRow = document.createElement("div");
  healthRow.className = "brand-apostle-health-row";

  const healthLabel = document.createElement("div");
  healthLabel.className = "brand-apostle-health-label";

  const healthName = document.createElement("span");
  healthName.textContent = "Health";

  const healthValue = document.createElement("span");
  healthValue.textContent = `${maxHealth}/${maxHealth}`;

  const healthTrack = document.createElement("div");
  healthTrack.className = "brand-apostle-health-track";

  const healthBar = document.createElement("span");
  healthTrack.append(healthBar);

  healthLabel.append(healthName, healthValue);
  healthRow.append(healthLabel, healthTrack);

  const combatRow = document.createElement("div");
  combatRow.className = "brand-apostle-combat-row";

  const damageLabel = document.createElement("span");
  damageLabel.className = "brand-apostle-damage";
  damageLabel.textContent = "-0";

  const attackButton = document.createElement("button");
  attackButton.type = "button";
  attackButton.textContent = "Attack!";

  combatRow.append(damageLabel, attackButton);
  body.append(frame, healthRow, combatRow);
  win.append(lightningField, titleBar, body);

  state.win = win;
  state.healthBar = healthBar;
  state.healthValue = healthValue;
  state.attackButton = attackButton;
  state.damageLabel = damageLabel;
  state.lightningCanvas = lightningCanvas;
  win.brandBurnsState = state;

  attackButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    attackBrandBurnsEnemy(state);
  });

  bindManagedRandomEventWindowAnimation(win, {
    afterOpen: () => clampRandomEventWindowToViewport(win),
    onClose: () => removeBrandBurnsEnemyWindow(win),
  });

  image.addEventListener("load", () => clampRandomEventWindowToViewport(win));
  updateBrandBurnsEnemyHud(state);
  return state;
};

const chooseBrandBurnsEnemies = () => {
  const apostleCount = Math.max(0, BRAND_BURNS_ENCOUNTER_COUNT - 1);
  const apostles = shuffle(BRAND_BURNS_APOSTLES).slice(0, apostleCount);
  return shuffle([BRAND_BURNS_FEMTO, ...apostles]);
};

const openBrandBurnsEnemyWindow = (state) => {
  if (!state?.win || brandBurnsStage !== "fight") return;
  document.body.appendChild(state.win);
  brandBurnsEnemyWindows.push(state.win);
  showManagedRandomEventWindow(state.win, {
    isVisible: () => false,
    clampAfterMediaLoad: true,
  });
  updateBrandBurnsAttackButtonStates();
  scheduleBrandBurnsEnemyAttack(state);
};

const spawnBrandBurnsEnemies = () => {
  clearBrandBurnsEnemyTimers();
  const enemyStates = chooseBrandBurnsEnemies().map(createBrandBurnsEnemyWindow);
  brandBurnsStats.total = enemyStates.length;
  updateBrandBurnsHud();

  enemyStates.forEach((state, index) => {
    const timer = setTimeout(
      () => openBrandBurnsEnemyWindow(state),
      index * BRAND_BURNS_APOSTLE_OPEN_DELAY_MS
    );
    brandBurnsEnemyTimers.push(timer);
  });
};

const resetBrandBurnsWindow = () => {
  clearBrandBurnsOmenEffect();
  clearBrandBurnsHealEffect();
  clearBrandBurnsEnemyTimers();
  stopBrandBurnsStaminaRecovery();
  stopBrandBurnsEnemyAttacks();
  brandBurnsEnemyWindows.forEach((win) => win.remove());
  brandBurnsEnemyWindows = [];
  removeBrandBurnsPuckWindow();
  brandBurnsPreserveEnemyWindowsOnMainClose = false;
  brandBurnsPuckHasAppeared = false;
  brandBurnsOutcome = null;
  brandBurnsStage = "prompt";
  clearBrandBurnsBlock();
  resetBrandBurnsStats();
  if (brandBurnsTitle) brandBurnsTitle.textContent = "Your Brand Burns...";
  if (brandBurnsIcon) brandBurnsIcon.dataset.src = BRAND_BURNS_BRAND_ICON;
  if (brandBurnsCombatIcon) brandBurnsCombatIcon.dataset.src = BRAND_BURNS_GUTS_ICON;
  setBrandBurnsViewerImage(BRAND_BURNS_DRAGON_SLAYER_ICON);
  if (brandBurnsStatus) {
    setBrandBurnsStatusText("The apostles are closing in.");
  }
  setBrandBurnsStageHidden(brandBurnsPromptStage, false);
  setBrandBurnsStageHidden(brandBurnsFightStage, true);
  updateBrandBurnsActionButton();
  if (brandBurnsClose) brandBurnsClose.disabled = false;
};

const showBrandBurnsWindow = () => {
  if (!brandBurnsWindow) return;
  if (isBrandBurnsVisible()) {
    // A visible puck, block or enemy window keeps the event owned by its stage;
    // only the main window gets raised.
    if (isBrandBurnsMainWindowVisible()) {
      brandBurnsWindow.style.zIndex = String(nextWindowZIndex());
      clampRandomEventWindowToViewport(brandBurnsWindow);
    }
    return;
  }
  showManagedRandomEventWindow(brandBurnsWindow, {
    beforeShow: resetBrandBurnsWindow,
    clampAfterMediaLoad: true,
    afterShow: () => {
      scheduleBrandBurnsOmenPulse();
      requestAnimationFrame(() => {
        if (brandBurnsFight) brandBurnsFight.focus();
      });
    },
  });
};

const startBrandBurnsFight = () => {
  if (!brandBurnsWindow || brandBurnsStage !== "prompt") return;
  clearBrandBurnsOmenEffect();
  brandBurnsStage = "fight";
  if (brandBurnsTitle) brandBurnsTitle.textContent = "Struggler";
  setBrandBurnsStageHidden(brandBurnsPromptStage, true);
  setBrandBurnsStageHidden(brandBurnsFightStage, false);
  updateBrandBurnsActionButton();
  if (brandBurnsClose) brandBurnsClose.disabled = true;
  loadDeferredMedia(brandBurnsWindow);
  clampRandomEventWindowAfterMediaLoad(brandBurnsWindow);
  startBrandBurnsStaminaRecovery();
  spawnBrandBurnsEnemies();
};

const closeBrandBurnsWindow = () => {
  if (!brandBurnsWindow && !brandBurnsEnemyWindows.length) return;
  const shouldStaggerEnemyClose =
    brandBurnsStats.health <= 0 && brandBurnsEnemyWindows.some(isBrandBurnsEnemyWindowVisible);
  clearBrandBurnsOmenEffect();
  clearBrandBurnsHealEffect();
  clearBrandBurnsEnemyTimers();
  stopBrandBurnsStaminaRecovery();
  stopBrandBurnsEnemyAttacks();
  clearBrandBurnsBlock();
  closeBrandBurnsPuckWindow();
  brandBurnsStage = "idle";
  brandBurnsPreserveEnemyWindowsOnMainClose = shouldStaggerEnemyClose;
  closeBrandBurnsEnemyWindows({ stagger: shouldStaggerEnemyClose });
  closeManagedRandomEventWindow(brandBurnsWindow);
};

const brandBurnsPreloadTargets = () => [
  brandBurnsWindow,
  BRAND_BURNS_BRAND_ICON,
  BRAND_BURNS_GUTS_ICON,
  BRAND_BURNS_PUCK_IMAGE,
  BRAND_BURNS_PUCK_WIN_IMAGE,
  BRAND_BURNS_DRAGON_SLAYER_ICON,
  BRAND_BURNS_FEMTO.image,
  BRAND_BURNS_APOSTLES.map((apostle) => apostle.image),
];

registerRandomEvent({
  id: "brand-burns",
  isGameplayLocked: () => isBrandBurnsVisible() && brandBurnsStage === "fight",
  preloadTargets: brandBurnsPreloadTargets,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isBrandBurnsVisible,
  canTrigger: () => !isBrandBurnsVisible(),
  run: () => {
    showBrandBurnsWindow();
  },
  bind: () => {
    if (brandBurnsFight) {
      brandBurnsFight.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (brandBurnsOutcome) {
          closeBrandBurnsWindow();
          return;
        }
        if (brandBurnsStage === "prompt") {
          startBrandBurnsFight();
          return;
        }
        if (brandBurnsStage === "fight") {
          startBrandBurnsBlock();
        }
      });
    }

    if (brandBurnsClose) {
      brandBurnsClose.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeBrandBurnsWindow();
      });
    }

    bindManagedRandomEventWindowAnimation(brandBurnsWindow, {
      afterOpen: () => clampRandomEventWindowToViewport(brandBurnsWindow),
      afterClose: () => {
        // A staggered enemy close keeps those windows alive past the main close, so
        // the full reset waits for them instead of tearing them down here.
        if (brandBurnsPreserveEnemyWindowsOnMainClose) {
          brandBurnsPreserveEnemyWindowsOnMainClose = false;
        } else {
          resetBrandBurnsWindow();
        }
        brandBurnsStage = "idle";
      },
    });
  },
});

// Only every few combat presses counts, so a drawn-out fight does not flood
// the desktop with new events.
let brandBurnsRandomEventButtonClickCount = 0;

registerRandomEventClickSource({
  matches: isBrandBurnsButtonClickTarget,
  claim: () => {
    brandBurnsRandomEventButtonClickCount += 1;
    if (
      brandBurnsRandomEventButtonClickCount %
        BRAND_BURNS_RANDOM_EVENT_BUTTON_CLICK_RATIO ===
      0
    ) {
      recordGeneralRandomEventClick({
        source: "brand-burns-buttons",
        buttonClickCount: brandBurnsRandomEventButtonClickCount,
      });
    }
  },
});
// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  brandBurnsWindow,
  brandBurnsPuckWindow,
  brandBurnsBlockWindow,
  ...brandBurnsEnemyWindows,
]);

window.homeEventBrandBurns = Object.freeze({
  BRAND_BURNS_RANDOM_EVENT_BUTTON_CLICK_RATIO,
  brandBurnsBlockWindow,
  brandBurnsPreloadTargets,
  brandBurnsPuckWindow,
  brandBurnsRandomEventButtonClickCount,
  brandBurnsStage,
  brandBurnsWindow,
  isBrandBurnsButtonClickTarget,
  isBrandBurnsVisible,
});
})();