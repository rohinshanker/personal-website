(() => {
const {
  all,
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

const gearsNestWindow = byId("gears-nest-window");
const gearsNestPrompt = byId("gears-nest-prompt");
const gearsNestEngage = byId("gears-nest-engage");
const gearsNestRetreat = byId("gears-nest-retreat");
const gearsNestCombat = byId("gears-nest-combat");
const gearsNestBattlefield = byId("gears-nest-battlefield");
const gearsNestEnemyCovers = byId("gears-nest-enemy-covers");
const gearsNestEnemies = byId("gears-nest-enemies");
const gearsNestPlayerCovers = byId("gears-nest-player-covers");
const gearsNestProjectiles = byId("gears-nest-projectiles");
const gearsNestPlayer = byId("gears-nest-player");
const gearsNestCoverButtons = all("[data-gears-nest-cover]");
const gearsNestHealth = byId("gears-nest-health");
const gearsNestHealthValue = byId("gears-nest-health-value");
const gearsNestAmmo = byId("gears-nest-ammo");
const gearsNestStatus = byId("gears-nest-status");
const gearsNestResult = byId("gears-nest-result");
const gearsNestResultText = byId("gears-nest-result-text");
const gearsNestResultOk = byId("gears-nest-result-ok");
const gearsNestReloadCursor = byId("gears-nest-reload-cursor");

const GEARS_NEST_ASSETS = Object.freeze({
  nest: "assets/random%20events/scourge-nest-background.webp",
  cogGear: "assets/random%20events/gears-nest/cog-gear.webp",
  drone: "assets/random%20events/gears-nest/locust-drone.webp",
  boomer: "assets/random%20events/gears-nest/boomer.webp",
  lancer: "assets/random%20events/gears-nest/lancer.webp",
  explosion: "assets/random%20events/pixel-explosion.gif",
});

const GEARS_NEST_STAGE_PROMPT = "prompt";

const GEARS_NEST_STAGE_COMBAT = "combat";

const GEARS_NEST_PLAYER_MAX_HEALTH = 100;

const GEARS_NEST_MAGAZINE_SIZE = 32;

const GEARS_NEST_RELOAD_MS = 1050;

const GEARS_NEST_ENEMY_HEALTH_MULTIPLIER = 3 * 0.9;

const GEARS_NEST_PLAYER_ATTACK_MULTIPLIER = 1.1;

const GEARS_NEST_DRONE_DAMAGE = 3.5 * GEARS_NEST_PLAYER_ATTACK_MULTIPLIER;

const GEARS_NEST_BOOMER_DAMAGE = 4 * GEARS_NEST_PLAYER_ATTACK_MULTIPLIER;

const GEARS_NEST_EXPLOSION_DURATION_MS = 1800;

const GEARS_NEST_SHOOTING_RECOVER_MS = 360;

const GEARS_NEST_RAPID_FIRE_MS = 130;

const GEARS_NEST_COVER_CHANGE_MS = 310;

const GEARS_NEST_ENEMY_ATTACK_MS = 1050;

const GEARS_NEST_GRENADE_FUSE_MS = 1700;

const GEARS_NEST_ROCKET_FUSE_MS = 1900;

const GEARS_NEST_GRENADE_MIN_GAP_MS = 3000;

const GEARS_NEST_ROCKET_MIN_GAP_MS = 4200;

const GEARS_NEST_GRENADE_CHANCE = 0.4;

const GEARS_NEST_ROCKET_CHANCE = 0.46;

const GEARS_NEST_LONE_BOOMER_ROCKET_SPEED_MULTIPLIER = 2;

const GEARS_NEST_COVER_POSITIONS = Object.freeze([
  { index: 0, label: "left cover", shortLabel: "Left", x: 19, y: 87, width: 132 },
  { index: 1, label: "center cover", shortLabel: "Center", x: 50, y: 90, width: 144 },
  { index: 2, label: "right cover", shortLabel: "Right", x: 80, y: 86, width: 132 },
]);

const GEARS_NEST_ENEMY_COVER_SLOTS = Object.freeze([
  { id: "enemy-cover-left", x: 18, y: 67, width: 106, enemyX: 18, enemyY: 58, enemyWidth: 66 },
  { id: "enemy-cover-mid-left", x: 36, y: 63, width: 94, enemyX: 36, enemyY: 54, enemyWidth: 72 },
  { id: "enemy-cover-mid-right", x: 58, y: 64, width: 100, enemyX: 58, enemyY: 55, enemyWidth: 62 },
  { id: "enemy-cover-right", x: 75, y: 68, width: 104, enemyX: 75, enemyY: 59, enemyWidth: 68 },
]);

const GEARS_NEST_ENEMY_TEMPLATES = Object.freeze([
  {
    id: "drone-left",
    name: "Locust Drone",
    type: "drone",
    baseHealth: 30,
    hasCover: true,
    coverSlotIndex: 0,
    image: GEARS_NEST_ASSETS.drone,
    coverDamage: 1,
    exposedDamage: 7,
  },
  {
    id: "drone-center",
    name: "Locust Drone",
    type: "drone",
    baseHealth: 34,
    hasCover: true,
    coverSlotIndex: 1,
    image: GEARS_NEST_ASSETS.drone,
    coverDamage: 1,
    exposedDamage: 8,
  },
  {
    id: "drone-mid-right",
    name: "Locust Drone",
    type: "drone",
    baseHealth: 28,
    hasCover: true,
    coverSlotIndex: 2,
    image: GEARS_NEST_ASSETS.drone,
    coverDamage: 1,
    exposedDamage: 8,
  },
  {
    id: "drone-right",
    name: "Locust Drone",
    type: "drone",
    baseHealth: 30,
    hasCover: true,
    coverSlotIndex: 3,
    image: GEARS_NEST_ASSETS.drone,
    coverDamage: 1,
    exposedDamage: 7,
  },
  {
    id: "boomer",
    name: "Boomer",
    type: "boomer",
    baseHealth: 58,
    hasCover: false,
    x: 86,
    y: 47,
    width: 118,
    image: GEARS_NEST_ASSETS.boomer,
    coverDamage: 2,
    exposedDamage: 11,
  },
]);

const applyGearsNestEnemyCoverSlot = (enemy, coverSlotIndex) => {
  const cover = GEARS_NEST_ENEMY_COVER_SLOTS[coverSlotIndex];
  if (!cover) return enemy;
  return {
    ...enemy,
    coverSlotIndex,
    coverId: cover.id,
    x: cover.enemyX,
    y: cover.enemyY,
    width: cover.enemyWidth,
  };
};

const getGearsNestEnemyHealth = (enemy) =>
  Math.ceil(enemy.baseHealth * GEARS_NEST_ENEMY_HEALTH_MULTIPLIER);

const createGearsNestEnemies = () =>
  GEARS_NEST_ENEMY_TEMPLATES.map((enemy) => {
    const positionedEnemy = enemy.hasCover
      ? applyGearsNestEnemyCoverSlot(enemy, enemy.coverSlotIndex)
      : enemy;
    const maxHealth = getGearsNestEnemyHealth(positionedEnemy);
    return {
      ...positionedEnemy,
      maxHealth,
      health: maxHealth,
    };
  });

const createGearsNestState = () => ({
  active: false,
  completed: false,
  outcome: "",
  stage: GEARS_NEST_STAGE_PROMPT,
  health: GEARS_NEST_PLAYER_MAX_HEALTH,
  ammo: GEARS_NEST_MAGAZINE_SIZE,
  coverIndex: 1,
  exposed: false,
  exposureEndsAt: 0,
  firing: false,
  heldEnemyId: "",
  switching: false,
  reloading: false,
  enemies: createGearsNestEnemies(),
  enemyFiringIds: new Set(),
  hazards: [],
  nextHazardId: 1,
  explosions: [],
  nextExplosionId: 1,
  lastGrenadeAt: 0,
  lastRocketAt: 0,
  enemyCoverShift: 1,
  timerIds: new Set(),
  attackIntervalId: 0,
  fireIntervalId: 0,
});

let gearsNestState = createGearsNestState();

const isGearsNestVisible = () =>
  isManagedRandomEventWindowVisible(gearsNestWindow);

const gearsNestAliveEnemies = () =>
  gearsNestState.enemies.filter((enemy) => enemy.health > 0);

const getGearsNestRocketMinGapMs = (aliveEnemies) => {
  const isLoneBoomer =
    aliveEnemies.length === 1 && aliveEnemies[0].type === "boomer";
  return isLoneBoomer
    ? GEARS_NEST_ROCKET_MIN_GAP_MS / GEARS_NEST_LONE_BOOMER_ROCKET_SPEED_MULTIPLIER
    : GEARS_NEST_ROCKET_MIN_GAP_MS;
};

const setGearsNestTimer = (callback, delay) => {
  const timerId = window.setTimeout(() => {
    gearsNestState.timerIds.delete(timerId);
    callback();
  }, delay);
  gearsNestState.timerIds.add(timerId);
  return timerId;
};

const clearGearsNestAttackTimer = () => {
  if (!gearsNestState.attackIntervalId) return;
  window.clearInterval(gearsNestState.attackIntervalId);
  gearsNestState.attackIntervalId = 0;
};

const clearGearsNestFireTimer = () => {
  if (!gearsNestState.fireIntervalId) return;
  window.clearInterval(gearsNestState.fireIntervalId);
  gearsNestState.fireIntervalId = 0;
};

const clearGearsNestTimers = () => {
  gearsNestState.timerIds.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  gearsNestState.timerIds.clear();
  clearGearsNestAttackTimer();
  clearGearsNestFireTimer();
};

const setGearsNestStage = (stage) => {
  gearsNestState.stage = stage;
  const isPrompt = stage === GEARS_NEST_STAGE_PROMPT;
  const isCombat = stage === GEARS_NEST_STAGE_COMBAT;
  gearsNestPrompt?.classList.toggle("is-hidden", !isPrompt);
  gearsNestCombat?.classList.remove("is-hidden");
  gearsNestWindow?.classList.toggle("is-combat", isCombat);
  gearsNestWindow?.classList.toggle("is-prompting", isPrompt);
};

const setGearsNestStatus = (message) => {
  if (gearsNestStatus) gearsNestStatus.textContent = message;
};

const renderGearsNestPlayerCovers = () => {
  if (!gearsNestPlayerCovers) return;
  const covers = GEARS_NEST_COVER_POSITIONS.map((cover) => {
    const marker = document.createElement("span");
    marker.className = "gears-nest-player-cover";
    marker.dataset.gearsNestCoverProp = String(cover.index);
    marker.style.left = `${cover.x}%`;
    marker.style.top = `${cover.y}%`;
    marker.style.width = `${cover.width}px`;
    return marker;
  });
  gearsNestPlayerCovers.replaceChildren(...covers);
};

const renderGearsNestEnemyCovers = () => {
  if (!gearsNestEnemyCovers) return;
  const occupiedCoverIds = new Set(
    gearsNestAliveEnemies()
      .map((enemy) => enemy.coverId)
      .filter(Boolean)
  );
  const covers = GEARS_NEST_ENEMY_COVER_SLOTS.map((cover) => {
    const marker = document.createElement("span");
    marker.className = "gears-nest-enemy-cover";
    marker.classList.toggle("is-occupied", occupiedCoverIds.has(cover.id));
    marker.dataset.gearsNestEnemyCover = cover.id;
    marker.style.left = `${cover.x}%`;
    marker.style.top = `${cover.y}%`;
    marker.style.width = `${cover.width}px`;
    return marker;
  });
  gearsNestEnemyCovers.replaceChildren(...covers);
};

const renderGearsNestProjectiles = () => {
  if (!gearsNestProjectiles) return;
  const projectiles = gearsNestState.hazards.map((hazard) => {
    const marker = document.createElement("div");
    marker.className = `gears-nest-projectile gears-nest-projectile--${hazard.type}`;
    marker.style.setProperty("--start-x", `${hazard.source.x}%`);
    marker.style.setProperty("--start-y", `${hazard.source.y}%`);
    marker.style.setProperty("--mid-x", `${(hazard.source.x + hazard.target.x) / 2}%`);
    marker.style.setProperty(
      "--arc-y",
      `${Math.min(hazard.source.y, hazard.target.y) - hazard.arcLift}%`
    );
    marker.style.setProperty("--end-x", `${hazard.target.x}%`);
    marker.style.setProperty("--end-y", `${hazard.target.y}%`);
    marker.style.setProperty("--flight-ms", `${hazard.durationMs}ms`);

    const body = document.createElement("span");
    body.className = "gears-nest-projectile-body";
    body.textContent = hazard.type === "rocket" ? "BOOM" : "";
    marker.append(body);

    const warning = document.createElement("span");
    warning.className = "gears-nest-hazard";
    warning.textContent = hazard.type === "rocket" ? "ROCKET" : "FRAG";
    warning.style.left = `${hazard.warning.x}%`;
    warning.style.top = `${hazard.warning.y}%`;
    marker.append(warning);

    return marker;
  });
  const explosions = gearsNestState.explosions.map((explosion) => {
    const image = document.createElement("img");
    image.className = "gears-nest-explosion";
    image.src = explosion.src;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    image.style.left = `${explosion.x}%`;
    image.style.top = `${explosion.y}%`;
    return image;
  });
  gearsNestProjectiles.replaceChildren(...projectiles, ...explosions);
};

const updateGearsNestHud = () => {
  const health = Math.max(0, gearsNestState.health);
  const healthPercent = `${health}%`;
  if (gearsNestHealth) gearsNestHealth.style.width = healthPercent;
  const healthbar = gearsNestHealth?.closest(".gears-nest-healthbar");
  if (healthbar) healthbar.setAttribute("aria-valuenow", String(health));
  if (gearsNestHealthValue) gearsNestHealthValue.textContent = String(health);
  if (gearsNestAmmo) {
    gearsNestAmmo.textContent = gearsNestState.reloading
      ? "Reloading..."
      : `${gearsNestState.ammo} / ${GEARS_NEST_MAGAZINE_SIZE}`;
  }
  gearsNestWindow?.classList.toggle("is-reloading", gearsNestState.reloading);
  gearsNestWindow?.classList.toggle("is-firing", gearsNestState.firing);
  gearsNestWindow?.classList.toggle("is-switching-cover", gearsNestState.switching);
  gearsNestPlayer?.classList.toggle("is-peeking", gearsNestState.exposed);
  gearsNestPlayer?.classList.toggle("is-firing", gearsNestState.firing);
  gearsNestPlayer?.classList.toggle("is-switching", gearsNestState.switching);
  if (gearsNestPlayer) {
    gearsNestPlayer.dataset.cover = String(gearsNestState.coverIndex);
  }
  gearsNestCoverButtons.forEach((button) => {
    const coverIndex = Number(button.getAttribute("data-gears-nest-cover"));
    const active = coverIndex === gearsNestState.coverIndex;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = gearsNestState.completed || !gearsNestState.active;
  });
};

const renderGearsNestEnemies = () => {
  if (!gearsNestEnemies) return;
  renderGearsNestEnemyCovers();
  const enemyButtons = gearsNestAliveEnemies().map((enemy) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `gears-nest-enemy gears-nest-enemy--${enemy.type}`;
    button.classList.toggle("is-behind-cover", Boolean(enemy.coverId));
    button.classList.toggle("is-firing", gearsNestState.enemyFiringIds.has(enemy.id));
    button.classList.toggle("is-targeted", gearsNestState.heldEnemyId === enemy.id);
    button.dataset.gearsNestEnemy = enemy.id;
    button.style.left = `${enemy.x}%`;
    button.style.top = `${enemy.y}%`;
    button.style.width = `${enemy.width}px`;
    button.setAttribute(
      "aria-label",
      `${enemy.name}, ${enemy.health} health remaining`
    );

    const image = document.createElement("img");
    image.src = enemy.image;
    image.decoding = "async";
    image.alt = "";
    button.append(image);

    const meter = document.createElement("span");
    meter.className = "gears-nest-enemy-health";
    meter.style.width = `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%`;
    button.append(meter);

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      startGearsNestFiring(enemy.id);
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
    return button;
  });
  gearsNestEnemies.replaceChildren(...enemyButtons);
};

const moveGearsNestEnemyToCoverSlot = (enemy, coverSlotIndex) => {
  const cover = GEARS_NEST_ENEMY_COVER_SLOTS[coverSlotIndex];
  if (!cover) return;
  enemy.coverSlotIndex = coverSlotIndex;
  enemy.coverId = cover.id;
  enemy.x = cover.enemyX;
  enemy.y = cover.enemyY;
  enemy.width = cover.enemyWidth;
};

const moveGearsNestAliveDronesToOpenCovers = () => {
  const aliveDrones = gearsNestAliveEnemies().filter(
    (enemy) => enemy.type === "drone"
  );
  if (!aliveDrones.length) return;
  const startIndex =
    gearsNestState.enemyCoverShift % GEARS_NEST_ENEMY_COVER_SLOTS.length;
  aliveDrones.forEach((enemy, offset) => {
    const coverSlotIndex =
      (startIndex + offset) % GEARS_NEST_ENEMY_COVER_SLOTS.length;
    moveGearsNestEnemyToCoverSlot(enemy, coverSlotIndex);
  });
  gearsNestState.enemyCoverShift =
    (gearsNestState.enemyCoverShift + 1) % GEARS_NEST_ENEMY_COVER_SLOTS.length;
};

const resetGearsNestPrompt = () => {
  clearGearsNestTimers();
  gearsNestState = createGearsNestState();
  gearsNestWindow?.classList.remove(
    "is-cleared",
    "is-damaged",
    "is-failed",
    "is-firing",
    "is-reloading",
    "is-switching-cover"
  );
  gearsNestPlayer?.classList.remove("is-firing", "is-peeking", "is-switching");
  renderGearsNestPlayerCovers();
  renderGearsNestEnemies();
  if (gearsNestProjectiles) gearsNestProjectiles.replaceChildren();
  gearsNestResult?.classList.add("is-hidden");
  if (gearsNestResultText) gearsNestResultText.textContent = "";
  setGearsNestStatus("Scourge Nest emerging. Engage to clear it.");
  setGearsNestStage(GEARS_NEST_STAGE_PROMPT);
  updateGearsNestHud();
};

const flashGearsNestDamage = () => {
  gearsNestWindow?.classList.add("is-damaged");
  setGearsNestTimer(() => {
    gearsNestWindow?.classList.remove("is-damaged");
  }, 260);
};

const completeGearsNestEvent = (outcome) => {
  if (gearsNestState.completed) return;
  clearGearsNestTimers();
  gearsNestState.active = false;
  gearsNestState.completed = true;
  gearsNestState.outcome = outcome;
  gearsNestState.exposed = false;
  gearsNestState.exposureEndsAt = 0;
  gearsNestState.firing = false;
  gearsNestState.heldEnemyId = "";
  gearsNestState.switching = false;
  gearsNestState.reloading = false;
  gearsNestState.enemyFiringIds.clear();
  gearsNestState.hazards = [];
  gearsNestState.explosions = [];
  renderGearsNestProjectiles();
  gearsNestWindow?.classList.toggle("is-cleared", outcome === "cleared");
  gearsNestWindow?.classList.toggle("is-failed", outcome === "failed");
  updateGearsNestHud();
  renderGearsNestEnemies();
  if (gearsNestResultText) {
    gearsNestResultText.textContent =
      outcome === "cleared"
        ? "Scourge Nest cleared."
        : "The nest overran your position.";
  }
  gearsNestResult?.classList.remove("is-hidden");
  setGearsNestStatus(
    outcome === "cleared"
      ? "Area secured. The Grubs are down."
      : "Downed in the breach."
  );
  requestAnimationFrame(() => {
    gearsNestResultOk?.focus({ preventScroll: true });
  });
};

const isGearsNestPlayerOutOfCover = () =>
  gearsNestState.exposed || gearsNestState.switching;

const damageGearsNestPlayer = (amount, message, { flash = false } = {}) => {
  if (!gearsNestState.active || gearsNestState.completed || amount <= 0) return;
  gearsNestState.health = Math.max(0, gearsNestState.health - amount);
  if (flash) flashGearsNestDamage();
  updateGearsNestHud();
  if (message) setGearsNestStatus(message);
  if (gearsNestState.health <= 0) completeGearsNestEvent("failed");
};

const incomingGearsNestBulletDamage = (enemy) =>
  isGearsNestPlayerOutOfCover() ? enemy.exposedDamage : enemy.coverDamage;

const markGearsNestEnemyFiring = (enemyId) => {
  if (!enemyId || gearsNestState.completed) return;
  gearsNestState.enemyFiringIds.add(enemyId);
  renderGearsNestEnemies();
  setGearsNestTimer(() => {
    gearsNestState.enemyFiringIds.delete(enemyId);
    renderGearsNestEnemies();
  }, 260);
};

const applyGearsNestBulletDamage = (enemy) => {
  markGearsNestEnemyFiring(enemy.id);
  const playerOutOfCover = isGearsNestPlayerOutOfCover();
  const amount = incomingGearsNestBulletDamage(enemy);
  const coverText = playerOutOfCover
    ? "caught you out of cover"
    : "peppered the cover";
  damageGearsNestPlayer(amount, `${enemy.name} ${coverText}.`, {
    flash: playerOutOfCover,
  });
};

const scheduleGearsNestExposureRecovery = (delayMs) => {
  gearsNestState.exposureEndsAt = Math.max(
    gearsNestState.exposureEndsAt,
    Date.now() + delayMs
  );
  setGearsNestTimer(removeGearsNestExposure, delayMs);
};

const stopGearsNestFiring = () => {
  if (!gearsNestState.firing && !gearsNestState.fireIntervalId) return;
  clearGearsNestFireTimer();
  gearsNestState.firing = false;
  gearsNestState.heldEnemyId = "";
  if (gearsNestState.active && !gearsNestState.completed && gearsNestState.exposed) {
    scheduleGearsNestExposureRecovery(GEARS_NEST_SHOOTING_RECOVER_MS);
  }
  updateGearsNestHud();
  renderGearsNestEnemies();
};

const startGearsNestReload = () => {
  if (!gearsNestState.active || gearsNestState.completed || gearsNestState.reloading) {
    return;
  }
  stopGearsNestFiring();
  gearsNestState.reloading = true;
  setGearsNestStatus("Reloading the Lancer...");
  updateGearsNestHud();
  setGearsNestTimer(() => {
    if (!gearsNestState.active || gearsNestState.completed) return;
    gearsNestState.reloading = false;
    gearsNestState.ammo = GEARS_NEST_MAGAZINE_SIZE;
    setGearsNestStatus("Lancer reloaded. Keep firing.");
    updateGearsNestHud();
  }, GEARS_NEST_RELOAD_MS);
};

const removeGearsNestExposure = () => {
  if (gearsNestState.firing) return;
  const remainingExposureMs = gearsNestState.exposureEndsAt - Date.now();
  if (remainingExposureMs > 0) {
    setGearsNestTimer(removeGearsNestExposure, remainingExposureMs);
    return;
  }
  gearsNestState.exposed = false;
  gearsNestState.exposureEndsAt = 0;
  updateGearsNestHud();
};

const fireGearsNestEnemy = (enemyId) => {
  if (!gearsNestState.active || gearsNestState.completed) return;
  if (gearsNestState.reloading) {
    setGearsNestStatus("Reloading. Stay in cover.");
    return;
  }
  if (gearsNestState.ammo <= 0) {
    startGearsNestReload();
    return;
  }

  const enemy = gearsNestState.enemies.find(
    (candidate) => candidate.id === enemyId && candidate.health > 0
  );
  if (!enemy) return;

  gearsNestState.exposed = true;
  gearsNestState.ammo -= 1;
  const damage =
    enemy.type === "boomer" ? GEARS_NEST_BOOMER_DAMAGE : GEARS_NEST_DRONE_DAMAGE;
  enemy.health = Math.max(0, Number((enemy.health - damage).toFixed(2)));
  if (enemy.health <= 0) moveGearsNestAliveDronesToOpenCovers();
  setGearsNestStatus(
    enemy.health > 0 ? `${enemy.name} hit.` : `${enemy.name} down.`
  );
  updateGearsNestHud();
  renderGearsNestEnemies();

  if (gearsNestState.completed) return;

  scheduleGearsNestExposureRecovery(GEARS_NEST_SHOOTING_RECOVER_MS);
  if (!gearsNestAliveEnemies().length) {
    completeGearsNestEvent("cleared");
    return;
  }
  if (gearsNestState.ammo <= 0) startGearsNestReload();
};

const startGearsNestFiring = (enemyId) => {
  if (!gearsNestState.active || gearsNestState.completed || gearsNestState.reloading) {
    return;
  }
  const enemy = gearsNestState.enemies.find(
    (candidate) => candidate.id === enemyId && candidate.health > 0
  );
  if (!enemy) return;

  clearGearsNestFireTimer();
  gearsNestState.firing = true;
  gearsNestState.heldEnemyId = enemyId;
  updateGearsNestHud();
  renderGearsNestEnemies();
  fireGearsNestEnemy(enemyId);

  if (gearsNestState.completed || gearsNestState.reloading) return;
  gearsNestState.fireIntervalId = window.setInterval(() => {
    if (!gearsNestState.firing || gearsNestState.reloading) {
      stopGearsNestFiring();
      return;
    }
    const target = gearsNestState.enemies.find(
      (candidate) =>
        candidate.id === gearsNestState.heldEnemyId && candidate.health > 0
    );
    if (!target) {
      stopGearsNestFiring();
      return;
    }
    fireGearsNestEnemy(target.id);
  }, GEARS_NEST_RAPID_FIRE_MS);
};

const setGearsNestCover = (coverIndex) => {
  if (
    !gearsNestState.active ||
    gearsNestState.completed ||
    gearsNestState.switching ||
    coverIndex === gearsNestState.coverIndex ||
    !GEARS_NEST_COVER_POSITIONS[coverIndex]
  ) {
    return;
  }
  gearsNestState.coverIndex = coverIndex;
  gearsNestState.switching = true;
  const cover = GEARS_NEST_COVER_POSITIONS[coverIndex];
  setGearsNestStatus(`Moving to ${cover.label}.`);
  updateGearsNestHud();
  setGearsNestTimer(() => {
    if (!gearsNestState.active || gearsNestState.completed) return;
    gearsNestState.switching = false;
    setGearsNestStatus(`Set behind ${cover.label}.`);
    updateGearsNestHud();
  }, GEARS_NEST_COVER_CHANGE_MS);
};

const resolveGearsNestHazard = (hazardId) => {
  const hazard = gearsNestState.hazards.find((candidate) => candidate.id === hazardId);
  if (!hazard || !gearsNestState.active || gearsNestState.completed) return;
  gearsNestState.hazards = gearsNestState.hazards.filter(
    (candidate) => candidate.id !== hazardId
  );
  const stillInBlastCover = gearsNestState.coverIndex === hazard.coverIndex;
  if (!stillInBlastCover) {
    setGearsNestStatus(
      hazard.type === "rocket" ? "Boomshot missed the cover." : "Frag avoided."
    );
  } else {
    const exposed = isGearsNestPlayerOutOfCover();
    const amount =
      hazard.type === "rocket" ? (exposed ? 40 : 14) : exposed ? 28 : 20;
    damageGearsNestPlayer(
      amount,
      hazard.type === "rocket"
        ? "Boomshot hit the cover."
        : "Frag detonated on your cover.",
      { flash: exposed }
    );
  }

  const explosion = {
    id: gearsNestState.nextExplosionId,
    src: `${GEARS_NEST_ASSETS.explosion}?impact=${Date.now()}-${gearsNestState.nextExplosionId}`,
    x: hazard.impact.x,
    y: hazard.impact.y,
  };
  gearsNestState.nextExplosionId += 1;
  gearsNestState.explosions.push(explosion);
  renderGearsNestProjectiles();
  setGearsNestTimer(() => {
    gearsNestState.explosions = gearsNestState.explosions.filter(
      (candidate) => candidate.id !== explosion.id
    );
    renderGearsNestProjectiles();
  }, GEARS_NEST_EXPLOSION_DURATION_MS);
};

const launchGearsNestHazard = (type, enemy) => {
  if (!gearsNestState.active || gearsNestState.completed) return;
  const targetCoverIndex = gearsNestState.coverIndex;
  const target = GEARS_NEST_COVER_POSITIONS[targetCoverIndex];
  const hazard = {
    id: gearsNestState.nextHazardId,
    type,
    coverIndex: targetCoverIndex,
    durationMs: type === "rocket" ? GEARS_NEST_ROCKET_FUSE_MS : GEARS_NEST_GRENADE_FUSE_MS,
    arcLift: type === "rocket" ? 8 : 24,
    source: {
      x: enemy.x,
      y: type === "rocket" ? enemy.y + 12 : enemy.y + 8,
    },
    target: {
      x: target.x,
      y: type === "rocket" ? target.y - 16 : target.y - 10,
    },
    warning: {
      x: target.x,
      y: target.y - 12,
    },
    impact: {
      x: target.x,
      y: target.y - 6,
    },
  };
  gearsNestState.nextHazardId += 1;
  gearsNestState.hazards.push(hazard);
  markGearsNestEnemyFiring(enemy.id);
  renderGearsNestProjectiles();
  setGearsNestStatus(
    type === "rocket"
      ? `${enemy.name} yelled BOOM. Switch cover!`
      : `${enemy.name} threw a frag. Switch cover!`
  );
  setGearsNestTimer(
    () => resolveGearsNestHazard(hazard.id),
    type === "rocket" ? GEARS_NEST_ROCKET_FUSE_MS : GEARS_NEST_GRENADE_FUSE_MS
  );
};

const chooseGearsNestEnemyAttack = () => {
  if (!gearsNestState.active || gearsNestState.completed) return;
  const aliveEnemies = gearsNestAliveEnemies();
  if (!aliveEnemies.length) {
    completeGearsNestEvent("cleared");
    return;
  }

  const now = Date.now();
  const boomer = aliveEnemies.find((enemy) => enemy.type === "boomer");
  const drones = aliveEnemies.filter((enemy) => enemy.type === "drone");
  const canLaunchHazard = gearsNestState.hazards.length < 2;
  const rocketMinGapMs = getGearsNestRocketMinGapMs(aliveEnemies);

  if (
    boomer &&
    canLaunchHazard &&
    now - gearsNestState.lastRocketAt > rocketMinGapMs &&
    Math.random() < GEARS_NEST_ROCKET_CHANCE
  ) {
    gearsNestState.lastRocketAt = now;
    launchGearsNestHazard("rocket", boomer);
    return;
  }

  if (
    drones.length &&
    canLaunchHazard &&
    now - gearsNestState.lastGrenadeAt > GEARS_NEST_GRENADE_MIN_GAP_MS &&
    Math.random() < GEARS_NEST_GRENADE_CHANCE
  ) {
    gearsNestState.lastGrenadeAt = now;
    launchGearsNestHazard(
      "grenade",
      drones[Math.floor(Math.random() * drones.length)]
    );
    return;
  }

  if (!drones.length) return;
  applyGearsNestBulletDamage(drones[Math.floor(Math.random() * drones.length)]);
};

const startGearsNestEnemyAttacks = () => {
  clearGearsNestAttackTimer();
  gearsNestState.attackIntervalId = window.setInterval(
    chooseGearsNestEnemyAttack,
    GEARS_NEST_ENEMY_ATTACK_MS
  );
};

const startGearsNestCombat = () => {
  clearGearsNestTimers();
  gearsNestState = createGearsNestState();
  gearsNestState.active = true;
  setGearsNestStage(GEARS_NEST_STAGE_COMBAT);
  gearsNestResult?.classList.add("is-hidden");
  gearsNestWindow?.classList.remove(
    "is-cleared",
    "is-damaged",
    "is-failed",
    "is-firing"
  );
  setGearsNestStatus("Hold fire on a Grub to spray the Lancer.");
  updateGearsNestHud();
  renderGearsNestEnemies();
  renderGearsNestProjectiles();
  startGearsNestEnemyAttacks();
};

const showGearsNest = () => {
  showManagedRandomEventWindow(gearsNestWindow, {
    beforeShow: resetGearsNestPrompt,
    clampAfterMediaLoad: true,
  });
};

const closeGearsNest = () => {
  clearGearsNestTimers();
  closeManagedRandomEventWindow(gearsNestWindow);
};

const moveGearsNestReloadCursor = (event) => {
  if (!gearsNestBattlefield || !gearsNestReloadCursor) return;
  const rect = gearsNestBattlefield.getBoundingClientRect();
  gearsNestReloadCursor.style.left = `${event.clientX - rect.left}px`;
  gearsNestReloadCursor.style.top = `${event.clientY - rect.top}px`;
};

registerRandomEvent({
  id: "gears-nest-clear",
  isGameplayLocked: () =>
    isGearsNestVisible() && gearsNestState.active && !gearsNestState.completed,
  preloadTargets: () => [gearsNestWindow, Object.values(GEARS_NEST_ASSETS)],
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isGearsNestVisible,
  canTrigger: () => !isGearsNestVisible(),
  run: () => {
    showGearsNest();
  },
  bind: () => {
    bindRandomEventButton(gearsNestEngage, startGearsNestCombat);
    bindRandomEventButton(gearsNestRetreat, closeGearsNest);
    bindRandomEventButton(gearsNestResultOk, closeGearsNest);
    gearsNestCoverButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setGearsNestCover(Number(button.getAttribute("data-gears-nest-cover")));
      });
    });
    gearsNestBattlefield?.addEventListener("pointermove", moveGearsNestReloadCursor);
    gearsNestBattlefield?.addEventListener("pointerleave", stopGearsNestFiring);
    document.addEventListener("pointerup", stopGearsNestFiring);
    document.addEventListener("pointercancel", stopGearsNestFiring);
    bindManagedRandomEventWindowAnimation(gearsNestWindow, {
      afterClose: resetGearsNestPrompt,
    });
  },
});

const configureGearsNestPreview = (preview) => {
  if (!preview) return;
  const ownerDocument = preview.ownerDocument;
  const state = createGearsNestState();
  preview.classList.remove(
    "is-cleared",
    "is-combat",
    "is-damaged",
    "is-failed",
    "is-firing",
    "is-reloading",
    "is-switching-cover"
  );
  preview.classList.add("is-prompting");
  preview.querySelector("#gears-nest-combat")?.classList.remove("is-hidden");
  preview.querySelector("#gears-nest-prompt")?.classList.remove("is-hidden");
  preview.querySelector("#gears-nest-result")?.classList.add("is-hidden");
  const resultText = preview.querySelector("#gears-nest-result-text");
  if (resultText) resultText.textContent = "";
  const status = preview.querySelector("#gears-nest-status");
  if (status) status.textContent = "Scourge Nest emerging. Engage to clear it.";
  const ammo = preview.querySelector("#gears-nest-ammo");
  if (ammo) ammo.textContent = `${state.ammo} / ${GEARS_NEST_MAGAZINE_SIZE}`;
  const health = preview.querySelector("#gears-nest-health");
  if (health) health.style.width = `${state.health}%`;
  health?.closest(".gears-nest-healthbar")?.setAttribute(
    "aria-valuenow",
    String(state.health)
  );
  const healthValue = preview.querySelector("#gears-nest-health-value");
  if (healthValue) healthValue.textContent = String(state.health);
  const player = preview.querySelector("#gears-nest-player");
  player?.classList.remove("is-firing", "is-peeking", "is-switching");
  if (player) player.dataset.cover = String(state.coverIndex);

  const playerCovers = GEARS_NEST_COVER_POSITIONS.map((cover) => {
    const marker = ownerDocument.createElement("span");
    marker.className = "gears-nest-player-cover";
    marker.dataset.gearsNestCoverProp = String(cover.index);
    marker.style.left = `${cover.x}%`;
    marker.style.top = `${cover.y}%`;
    marker.style.width = `${cover.width}px`;
    return marker;
  });
  preview.querySelector("#gears-nest-player-covers")?.replaceChildren(...playerCovers);

  const occupiedCoverIds = new Set(
    state.enemies.map((enemy) => enemy.coverId).filter(Boolean)
  );
  const enemyCovers = GEARS_NEST_ENEMY_COVER_SLOTS.map((cover) => {
    const marker = ownerDocument.createElement("span");
    marker.className = "gears-nest-enemy-cover";
    marker.classList.toggle("is-occupied", occupiedCoverIds.has(cover.id));
    marker.dataset.gearsNestEnemyCover = cover.id;
    marker.style.left = `${cover.x}%`;
    marker.style.top = `${cover.y}%`;
    marker.style.width = `${cover.width}px`;
    return marker;
  });
  preview.querySelector("#gears-nest-enemy-covers")?.replaceChildren(...enemyCovers);

  const enemies = state.enemies.map((enemy) => {
    const button = ownerDocument.createElement("button");
    button.type = "button";
    button.className = `gears-nest-enemy gears-nest-enemy--${enemy.type}`;
    button.classList.toggle("is-behind-cover", Boolean(enemy.coverId));
    button.dataset.gearsNestEnemy = enemy.id;
    button.style.left = `${enemy.x}%`;
    button.style.top = `${enemy.y}%`;
    button.style.width = `${enemy.width}px`;
    button.setAttribute("aria-label", `${enemy.name}, ${enemy.health} health remaining`);
    const image = ownerDocument.createElement("img");
    image.dataset.src = enemy.image;
    image.decoding = "async";
    image.alt = "";
    const meter = ownerDocument.createElement("span");
    meter.className = "gears-nest-enemy-health";
    meter.style.width = `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%`;
    button.append(image, meter);
    return button;
  });
  preview.querySelector("#gears-nest-enemies")?.replaceChildren(...enemies);
  preview.querySelector("#gears-nest-projectiles")?.replaceChildren();
  preview.querySelectorAll("[data-gears-nest-cover]").forEach((button) => {
    const coverIndex = Number(button.getAttribute("data-gears-nest-cover"));
    const active = coverIndex === state.coverIndex;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = true;
  });
};

// The runtime keeps these inside the viewport as the window resizes.
registerRandomEventWindows(() => [
  gearsNestWindow,
]);

window.homeEventGearsNest = Object.freeze({
  GEARS_NEST_ASSETS,
  configureGearsNestPreview,
  gearsNestState,
  gearsNestWindow,
  isGearsNestVisible,
});
})();
