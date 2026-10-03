(() => {
const {
  PROMO_RANDOM_EVENT_COMPACTNESS_MIN,
  RANDOM_EVENT_KIND_NON_INTERACTIVE,
  SYSTEM_ALERTS,
  chooseRandomEventOutsideLockdown,
  collectRandomEventPreloadTargets,
  getRandomEventPreloadTargets,
  isRandomEventGameplayLockActive,
  preloadRandomEventAssets,
  promoRandomEventCompactnessWeight,
  randomEventDebugEnabled,
  randomEventDefinitionCanSchedule,
  randomEventDefinitionIsVisible,
  randomEventDefinitions,
  randomEventDeveloperModeAllows,
  randomEventKind,
  randomEventPendingDefinitions,
  recordRandomEventSelection,
  setRandomEventCompactnessWeightProvider,
  suppressAdminNaturalTriggersForCurrentTask,
} = window.homeEventRuntime;
const {
  createWordErrorWindow,
  wordErrorStackLayout,
} = window.homeEventWordError;
const {
  activateDeferredSourceOwner,
  deferredSourceOwner,
} = window.homeMedia;
const {
  felizJuevesWindow,
  isFelizJuevesVisible,
  showFelizJuevesWindow,
} = window.homeEventNotes;
const {
  configureDebugSystemAlertPreview,
  debugSystemAlertWindow,
  showDebugSystemAlert,
} = window.homeEventPrompts;
const {
  configureRelicRecoveryPreview,
} = window.homeEventRelicRecovery;
const {
  configureInfinityArmoryPreview,
} = window.homeEventInfinityArmory;
const {
  configureGradescopeCurvePreview,
} = window.homeEventGradescopeCurve;
const {
  configureGearsNestPreview,
} = window.homeEventGearsNest;
const {
  drawDistressSignalPreview,
} = window.homeEventDistressSignal;
const {
  isHomeActivationReady,
  whenHomeActivated,
} = window.homeActivation;
const {
  closeAppWindow,
  getAppWindow,
  setWindowFocusReturn,
  setWindowOpen,
} = window.homeWindows;
const {
  solStagePresentationWin,
} = window.homeSolitaire;


const ADMIN_RANDOM_EVENT_LABELS = Object.freeze({
  "annoying-system-alert": "Annoying System Alert",
  "dodging-popup-alert": "Annoying Dodging Popup Alert",
  "current-publicly-available-information": "Current Public Information",
  "debug-system-alert-deodorant-reminder": "System Alert — Hygiene Reminder",
  "debug-system-alert-power-cycle-reminder": "System Alert — Power-Cycle Reminder",
  "debug-system-alert-seneca-announcement": "System Announcement — Seneca",
  "dont-starve-campfire": "Don't Starve Campfire",
  "feliz-jueves": "Feliz Jueves",
  "gears-nest-clear": "Gears Nest",
  "neko-stream-system-alert": "Neko Stream Alert",
  "resist-your-fate": "Resist Your Fate",
  "rohin-os-note": "Rohin OS Note",
  "rohin-os-update": "Rohin OS Update",
  "spare-a-trna": "Spare a tRNA",
  "vanishing-popup-alert": "Annoying Vanishing Popup Alert",
});

const formatAdminRandomEventLabel = (eventId) => {
  if (ADMIN_RANDOM_EVENT_LABELS[eventId]) {
    return ADMIN_RANDOM_EVENT_LABELS[eventId];
  }
  if (eventId.startsWith("debug-system-alert-")) {
    const alertId = eventId.slice("debug-system-alert-".length);
    const alert = SYSTEM_ALERTS.find((candidate) => candidate.id === alertId);
    return alert ? alert.label : "System Alert";
  }
  return eventId
    .split("-")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
};

const listAdminRandomEvents = () => [
  ...randomEventDefinitions.map((definition) => ({
    id: definition.id,
    kind: randomEventKind(definition),
    label: formatAdminRandomEventLabel(definition.id),
  })),
  {
    id: "feliz-jueves",
    kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
    label: formatAdminRandomEventLabel("feliz-jueves"),
  },
].sort((left, right) => left.label.localeCompare(right.label));

const getAdminRandomEventPreviewSource = (definition) => {
  if (!definition) return null;
  if (definition.id === "microsoft-word-license-stack") {
    return createWordErrorWindow(0, wordErrorStackLayout());
  }
  try {
    const targets = collectRandomEventPreloadTargets(
      getRandomEventPreloadTargets(definition, {
        triggerName: "adminControlsPreview",
        detail: { source: "admin-controls" },
        admin: true,
      })
    );
    return targets.find((target) => target instanceof Element) || null;
  } catch (error) {
    return null;
  }
};

const prepareAdminRandomEventPreview = (sourceWindow, eventId) => {
  if (!(sourceWindow instanceof Element)) return null;
  const preview = sourceWindow.cloneNode(true);
  preview.classList.remove(
    "is-hidden",
    "is-opening",
    "is-closing",
    "is-choice-flashing"
  );
  preview.hidden = false;
  preview.inert = true;
  preview.setAttribute("aria-hidden", "true");
  preview.removeAttribute("aria-modal");
  preview.removeAttribute("role");
  preview.setAttribute("data-admin-event-preview-window", eventId);
  ["left", "right", "top", "bottom", "translate", "transform", "z-index"].forEach(
    (property) => preview.style.removeProperty(property)
  );
  preview.querySelectorAll("audio, video").forEach((media) => {
    media.autoplay = false;
    media.controls = false;
    media.muted = true;
    media.removeAttribute("autoplay");
  });
  return preview;
};

const activateAdminRandomEventPreviewMedia = (preview) => {
  preview?.querySelectorAll("[data-src]").forEach((media) => {
    if (!media.hasAttribute("src")) media.setAttribute("src", media.getAttribute("data-src"));
    // A cloned `<video>` needs its own load() before it can paint its poster.
    activateDeferredSourceOwner(deferredSourceOwner(media));
  });
  return preview;
};

const createAdminRandomEventPreviewTemplate = (eventId) => {
  const normalizedId = String(eventId || "");
  if (normalizedId === "feliz-jueves") {
    return prepareAdminRandomEventPreview(felizJuevesWindow, normalizedId);
  }

  const definition = randomEventDefinitions.find(
    (candidate) => candidate.id === normalizedId
  );
  if (definition?.systemAlert) {
    const preview = prepareAdminRandomEventPreview(debugSystemAlertWindow, normalizedId);
    configureDebugSystemAlertPreview(preview, definition.systemAlert);
    return preview;
  }

  const preview = prepareAdminRandomEventPreview(
    getAdminRandomEventPreviewSource(definition),
    normalizedId
  );
  if (normalizedId === "relic-recovery") configureRelicRecoveryPreview(preview);
  if (normalizedId === "infinity-blade-armory") configureInfinityArmoryPreview(preview);
  if (normalizedId === "gradescope-curve") configureGradescopeCurvePreview(preview);
  if (normalizedId === "gears-nest-clear") configureGearsNestPreview(preview);
  return preview;
};

const ADMIN_RANDOM_EVENT_PREVIEW_TEMPLATES = new Map(
  listAdminRandomEvents().map((eventDefinition) => [
    eventDefinition.id,
    createAdminRandomEventPreviewTemplate(eventDefinition.id),
  ])
);

let adminRandomEventFootprintCacheKey = "";

let adminRandomEventCompactnessWeights = new Map();

const measureAdminRandomEventCompactnessWeights = () => {
  const cacheKey = `${window.innerWidth}x${window.innerHeight}`;
  if (
    cacheKey === adminRandomEventFootprintCacheKey &&
    adminRandomEventCompactnessWeights.size
  ) {
    return adminRandomEventCompactnessWeights;
  }

  const measurementHost = document.createElement("div");
  measurementHost.setAttribute("aria-hidden", "true");
  measurementHost.inert = true;
  Object.assign(measurementHost.style, {
    contain: "layout style paint",
    height: `${Math.max(1, window.innerHeight)}px`,
    left: "-200vw",
    overflow: "hidden",
    pointerEvents: "none",
    position: "fixed",
    top: "0",
    visibility: "hidden",
    width: `${Math.max(1, window.innerWidth)}px`,
  });

  const previews = [];
  ADMIN_RANDOM_EVENT_PREVIEW_TEMPLATES.forEach((template, eventId) => {
    if (!(template instanceof Element)) return;
    const preview = template.cloneNode(true);
    preview.style.setProperty("bottom", "auto", "important");
    preview.style.setProperty("left", "auto", "important");
    preview.style.setProperty("max-height", "none", "important");
    preview.style.setProperty("max-width", "none", "important");
    preview.style.setProperty("position", "static", "important");
    preview.style.setProperty("right", "auto", "important");
    preview.style.setProperty("top", "auto", "important");
    preview.style.setProperty("transform", "none", "important");
    preview.style.setProperty("translate", "none", "important");
    previews.push({ eventId, preview });
    measurementHost.append(preview);
  });

  const areas = new Map();
  const unresolvedMediaEventIds = new Set();
  try {
    document.body.append(measurementHost);
    previews.forEach(({ eventId, preview }) => {
      const hasUnresolvedLayoutMedia = Array.from(
        preview.querySelectorAll("img[data-src], video[data-src]")
      ).some((media) => {
        const mediaBounds = media.getBoundingClientRect();
        const mediaWidth = Math.max(0, mediaBounds.width || media.offsetWidth);
        const mediaHeight = Math.max(0, mediaBounds.height || media.offsetHeight);
        return mediaWidth <= 0 || mediaHeight <= 0;
      });
      if (hasUnresolvedLayoutMedia) {
        unresolvedMediaEventIds.add(eventId);
        return;
      }
      const bounds = preview.getBoundingClientRect();
      const width = Math.max(0, bounds.width || preview.offsetWidth);
      const height = Math.max(0, bounds.height || preview.offsetHeight);
      if (width > 0 && height > 0) areas.set(eventId, width * height);
    });
  } finally {
    measurementHost.remove();
  }

  const sortedAreas = [...areas.values()].sort((left, right) => left - right);
  const referenceArea = sortedAreas.length
    ? sortedAreas[Math.floor(sortedAreas.length / 2)]
    : 1;
  adminRandomEventCompactnessWeights = new Map(
    previews.map(({ eventId }) => [
      eventId,
      unresolvedMediaEventIds.has(eventId)
        ? PROMO_RANDOM_EVENT_COMPACTNESS_MIN
        : promoRandomEventCompactnessWeight(areas.get(eventId), referenceArea),
    ])
  );
  adminRandomEventFootprintCacheKey = cacheKey;
  return adminRandomEventCompactnessWeights;
};

const getAdminRandomEventCompactnessWeight = (definition) =>
  measureAdminRandomEventCompactnessWeights().get(definition?.id) || 1;

const createAdminRandomEventPreview = (eventId) => {
  const normalizedId = String(eventId || "");
  const template = ADMIN_RANDOM_EVENT_PREVIEW_TEMPLATES.get(normalizedId);
  const preview = activateAdminRandomEventPreviewMedia(
    template?.cloneNode(true) || null
  );
  if (normalizedId === "distress-signal") drawDistressSignalPreview(preview);
  return preview;
};

const adminRandomEventResult = (ok, message) => ({ ok, message });

const runAdminRandomEvent = async (eventId, { source = "admin-controls" } = {}) => {
  if (!isHomeActivationReady()) await whenHomeActivated;
  if (isRandomEventGameplayLockActive()) {
    return adminRandomEventResult(false, "Finish the active gameplay event first.");
  }

  if (eventId === "feliz-jueves") {
    if (isFelizJuevesVisible()) {
      return adminRandomEventResult(false, "Feliz Jueves is already open.");
    }
    suppressAdminNaturalTriggersForCurrentTask();
    showFelizJuevesWindow();
    return adminRandomEventResult(true, "Triggered Feliz Jueves.");
  }

  const definition = randomEventDefinitions.find((candidate) => candidate.id === eventId);
  if (!definition) {
    return adminRandomEventResult(false, "That event is no longer available.");
  }
  if (randomEventPendingDefinitions.has(definition)) {
    return adminRandomEventResult(false, `${formatAdminRandomEventLabel(eventId)} is loading.`);
  }
  if (randomEventDefinitionIsVisible(definition)) {
    return adminRandomEventResult(false, `${formatAdminRandomEventLabel(eventId)} is already open.`);
  }

  randomEventPendingDefinitions.add(definition);
  try {
    await preloadRandomEventAssets(definition, {
      triggerName: "adminControls",
      detail: { source },
      admin: true,
    });
    if (isRandomEventGameplayLockActive()) {
      return adminRandomEventResult(false, "An interactive gameplay event started first.");
    }
    if (randomEventDefinitionIsVisible(definition)) {
      return adminRandomEventResult(false, `${formatAdminRandomEventLabel(eventId)} is already open.`);
    }

    suppressAdminNaturalTriggersForCurrentTask();
    const runResult = await Promise.resolve(
      definition.run({
        triggerName: "adminControls",
        detail: { source },
        admin: true,
      })
    );
    if (runResult === false) {
      return adminRandomEventResult(false, `${formatAdminRandomEventLabel(eventId)} could not start.`);
    }
    return adminRandomEventResult(true, `Triggered ${formatAdminRandomEventLabel(eventId)}.`);
  } catch (error) {
    console.error("[Rohin OS] Admin event failed", eventId, error);
    return adminRandomEventResult(false, `${formatAdminRandomEventLabel(eventId)} failed to start.`);
  } finally {
    randomEventPendingDefinitions.delete(definition);
  }
};

const runAdminRandomEventChoice = async ({ source = "admin-controls" } = {}) => {
  if (!isHomeActivationReady()) await whenHomeActivated;
  if (isRandomEventGameplayLockActive()) {
    return adminRandomEventResult(false, "Finish the active gameplay event first.");
  }

  const triggerContext = {
    triggerName: "adminControls",
    detail: { source },
    admin: true,
  };
  const eligibleEvents = randomEventDefinitions
    .filter((definition) => {
      if (randomEventPendingDefinitions.has(definition)) return false;
      if (!randomEventDeveloperModeAllows(definition)) return false;
      if (randomEventDefinitionIsVisible(definition)) return false;
      const debug = randomEventDebugEnabled(definition);
      if (!randomEventDefinitionCanSchedule(definition, { debug })) return false;
      return !definition.canTrigger || definition.canTrigger(triggerContext);
    })
    .map((definition) => ({
      definition,
      triggerProbability: 1,
    }));
  const selected = chooseRandomEventOutsideLockdown(eligibleEvents);
  if (!selected) {
    return adminRandomEventResult(
      false,
      "No eligible event is available outside the recent-repeat window."
    );
  }

  recordRandomEventSelection(selected.definition);
  return runAdminRandomEvent(selected.definition.id, { source });
};

const ADMIN_DESKTOP_ACTIVITY_APPS = Object.freeze([
  "windows",
  "taskmgr",
  "paint",
]);

const adminPresetIntensityCount = (intensity) => {
  if (intensity === "high") return 3;
  if (intensity === "medium") return 2;
  return 1;
};

const runAdminScenePreset = async (
  presetId,
  { intensity = "medium", visualEffects = true } = {}
) => {
  if (!isHomeActivationReady()) await whenHomeActivated;
  if (isRandomEventGameplayLockActive()) {
    return adminRandomEventResult(false, "Finish the active gameplay event first.");
  }

  suppressAdminNaturalTriggersForCurrentTask();
  if (presetId === "game-win") {
    setWindowOpen("solitaire", true);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    solStagePresentationWin({ visualEffects });
    return adminRandomEventResult(
      true,
      "Staged a local Solitaire win. Press the check button to auto-solve."
    );
  }

  if (presetId === "dialog") {
    const dialogWindow = getAppWindow("image-tools");
    const activeFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusReturn =
      activeFocus?.closest("#admin-controls-window") &&
      activeFocus.closest("#admin-controls-window").getAttribute("aria-hidden") === "true"
        ? document.querySelector('.taskbar-icon[data-app="admin-controls"]')
        : activeFocus;
    if (dialogWindow && focusReturn) {
      setWindowFocusReturn(dialogWindow, focusReturn);
    }
    setWindowOpen("image-tools", true);
    requestAnimationFrame(() => {
      dialogWindow?.querySelector("[data-coming-soon-ok]")?.focus({ preventScroll: true });
    });
    return adminRandomEventResult(true, "Opened a dialog scene.");
  }

  if (presetId === "notification") {
    const opened = showDebugSystemAlert(SYSTEM_ALERTS[0]);
    return adminRandomEventResult(
      opened,
      opened ? "Opened a notification scene." : "A notification is already open."
    );
  }

  if (presetId === "desktop-activity") {
    ADMIN_DESKTOP_ACTIVITY_APPS
      .slice(0, adminPresetIntensityCount(intensity))
      .forEach((appId) => setWindowOpen(appId, true));
    return adminRandomEventResult(true, "Opened a desktop activity scene.");
  }

  return adminRandomEventResult(false, "That scene preset is not available.");
};

window.rohinAdminOrchestrator = Object.freeze({
  closeWindow: () => closeAppWindow("admin-controls"),
  createEventPreview: createAdminRandomEventPreview,
  getPromoRandomEventWeight: (eventId) =>
    getAdminRandomEventCompactnessWeight({ id: String(eventId || "") }),
  listEvents: listAdminRandomEvents,
  resetScene: () => window.location.reload(),
  runEvent: runAdminRandomEvent,
  runRandomEvent: runAdminRandomEventChoice,
  runPreset: runAdminScenePreset,
  suppressNaturalTriggers: suppressAdminNaturalTriggersForCurrentTask,
});

// Promo mode asks the runtime to favour compact windows; the measuring lives
// here because only the orchestrator knows the preview geometry.
setRandomEventCompactnessWeightProvider(getAdminRandomEventCompactnessWeight);
})();
