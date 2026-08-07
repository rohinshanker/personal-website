(() => {
"use strict";

const STORAGE_KEY = "personalSiteAdminControlsV1";
const RESET_PENDING_KEY = "personalSiteAdminControlsResetPendingV1";
const RANDOM_EVENT_VALUE = "__random__";
const SEQUENCE_EVENT_VALUE = "__sequence__";
const STATE_VERSION = 1;
const SEQUENCE_LENGTH = 24;

const DEFAULT_STATE = Object.freeze({
  version: STATE_VERSION,
  activeTab: "run",
  countdown: 3,
  hideBeforeTrigger: true,
  showCountdown: true,
  bindings: Object.freeze([]),
  sequenceSeed: "promo-001",
  sequence: Object.freeze([]),
  sequenceCursor: 0,
  frequency: 15,
  duration: 30,
  intensity: "medium",
  shotList: Object.freeze([]),
  cueCursor: -1,
  guide: "off",
  safeArea: false,
  audio: true,
  visualEffects: true,
  privacy: false,
  pauseNatural: true,
});

const TAB_VALUES = new Set(["run", "events", "bindings", "capture"]);
const COUNTDOWN_VALUES = new Set([0, 3, 5, 10]);
const FREQUENCY_VALUES = new Set([5, 15, 30, 60]);
const DURATION_VALUES = new Set([15, 30, 60, 120]);
const INTENSITY_VALUES = new Set(["low", "medium", "high"]);
const GUIDE_VALUES = new Set(["off", "vertical", "square", "landscape"]);
const EVENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,95}$/;
const TARGET_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/;
const APP_TARGET_PATTERN = /^app:([a-z0-9][a-z0-9-]{0,63}):(desktop|taskbar|other-\d{1,2})$/;
const ACTION_TARGET_PATTERN = /^action:([a-f0-9]{8}):(\d{1,2})$/;
const GITHUB_TARGET_PATTERN = /^github:(\d{1,2})$/;

const cloneDefaults = () => ({
  ...DEFAULT_STATE,
  bindings: [],
  sequence: [],
  shotList: [],
});

const cleanText = (value, maximum = 160) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);

const normalizeTargetKey = (value) => {
  const key = String(value || "");
  if (key === "start") return key;
  if (key.startsWith("id:") && TARGET_ID_PATTERN.test(key.slice(3))) return key;
  if (APP_TARGET_PATTERN.test(key)) return key;
  if (ACTION_TARGET_PATTERN.test(key)) return key;
  if (GITHUB_TARGET_PATTERN.test(key)) return key;
  return "";
};

const normalizeEventChoice = (value) => {
  const eventId = String(value || "");
  if (eventId === RANDOM_EVENT_VALUE || eventId === SEQUENCE_EVENT_VALUE) {
    return eventId;
  }
  return EVENT_ID_PATTERN.test(eventId) ? eventId : "";
};

const normalizeBinding = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const target = normalizeTargetKey(value.target);
  const eventId = normalizeEventChoice(value.eventId);
  if (!target || !eventId) return null;
  return {
    target,
    label: cleanText(value.label, 96) || "Site control",
    eventId,
    mode: value.mode === "repeat" ? "repeat" : "once",
  };
};

const normalizeCue = (value) => {
  if (typeof value === "string") {
    const label = cleanText(value, 180);
    return label ? { label, eventId: "" } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const label = cleanText(value.label, 180);
  if (!label) return null;
  const eventId = value.eventId ? normalizeEventChoice(value.eventId) : "";
  return { label, eventId };
};

const normalizeState = (value) => {
  const normalized = cloneDefaults();
  if (!value || typeof value !== "object" || Array.isArray(value)) return normalized;
  if (value.version !== STATE_VERSION) return normalized;

  if (TAB_VALUES.has(value.activeTab)) normalized.activeTab = value.activeTab;
  const countdown = Number(value.countdown);
  if (COUNTDOWN_VALUES.has(countdown)) normalized.countdown = countdown;
  normalized.hideBeforeTrigger = value.hideBeforeTrigger !== false;
  normalized.showCountdown = value.showCountdown !== false;
  normalized.bindings = Array.isArray(value.bindings)
    ? value.bindings.map(normalizeBinding).filter(Boolean).slice(0, 100)
    : [];
  normalized.sequenceSeed = cleanText(value.sequenceSeed, 64) || DEFAULT_STATE.sequenceSeed;
  normalized.sequence = Array.isArray(value.sequence)
    ? value.sequence
        .map((eventId) => String(eventId || ""))
        .filter((eventId) => EVENT_ID_PATTERN.test(eventId))
        .slice(0, 100)
    : [];
  const cursor = Number(value.sequenceCursor);
  normalized.sequenceCursor = Number.isInteger(cursor) && cursor >= 0 ? cursor : 0;
  const frequency = Number(value.frequency);
  if (FREQUENCY_VALUES.has(frequency)) normalized.frequency = frequency;
  const duration = Number(value.duration);
  if (DURATION_VALUES.has(duration)) normalized.duration = duration;
  if (INTENSITY_VALUES.has(value.intensity)) normalized.intensity = value.intensity;
  normalized.shotList = Array.isArray(value.shotList)
    ? value.shotList.map(normalizeCue).filter(Boolean).slice(0, 100)
    : [];
  const cueCursor = Number(value.cueCursor);
  normalized.cueCursor = Number.isInteger(cueCursor) ? cueCursor : -1;
  if (GUIDE_VALUES.has(value.guide)) normalized.guide = value.guide;
  normalized.safeArea = value.safeArea === true;
  normalized.audio = value.audio !== false;
  normalized.visualEffects = value.visualEffects !== false;
  normalized.privacy = value.privacy === true;
  normalized.pauseNatural = value.pauseNatural !== false;
  return normalized;
};

const hashString = (value) => {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createSeededSequence = (seed, eventIds, length = SEQUENCE_LENGTH) => {
  const choices = Array.from(new Set(
    (Array.isArray(eventIds) ? eventIds : []).map((eventId) =>
      String(eventId && typeof eventId === "object" ? eventId.id || "" : eventId || "")
    )
  ))
    .filter((eventId) => EVENT_ID_PATTERN.test(eventId))
    .sort();
  if (!choices.length) return [];

  let randomState = hashString(cleanText(seed, 64) || DEFAULT_STATE.sequenceSeed) || 1;
  const random = () => {
    randomState += 0x6d2b79f5;
    let value = randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const safeLength = Math.max(1, Math.min(100, Math.floor(Number(length) || SEQUENCE_LENGTH)));
  const sequence = [];
  for (let index = 0; index < safeLength; index += 1) {
    let choiceIndex = Math.floor(random() * choices.length);
    if (
      choices.length > 1 &&
      sequence.length &&
      choices[choiceIndex] === sequence[sequence.length - 1]
    ) {
      choiceIndex = (choiceIndex + 1 + Math.floor(random() * (choices.length - 1))) % choices.length;
    }
    sequence.push(choices[choiceIndex]);
  }
  return sequence;
};

const create = ({ runtime, storage, resetStorage, doc, browserWindow } = {}) => {
  const orchestrator = runtime || window.rohinAdminOrchestrator;
  const pageWindow = browserWindow || window;
  const documentRef = doc || pageWindow.document;
  const localStateStorage = storage || pageWindow.localStorage;
  const transientStorage = resetStorage || pageWindow.sessionStorage;
  const adminWindow = documentRef.getElementById("admin-controls-window");
  if (!orchestrator || !adminWindow) return null;

  const byId = (id) => documentRef.getElementById(id);
  const controls = {
    body: byId("admin-controls-body"),
    status: byId("admin-controls-status"),
    seedCount: byId("admin-seed-count"),
    countdown: byId("admin-countdown"),
    hideBeforeTrigger: byId("admin-hide-before-trigger"),
    showCountdown: byId("admin-show-countdown"),
    startTake: byId("admin-start-take"),
    stopTake: byId("admin-stop-take"),
    resetScene: byId("admin-reset-scene"),
    eventSearch: byId("admin-event-search"),
    eventKind: byId("admin-event-kind"),
    eventList: byId("admin-event-list"),
    triggerNow: byId("admin-trigger-now"),
    runSequenceNext: byId("admin-run-sequence-next"),
    addCue: byId("admin-add-cue"),
    targetSearch: byId("admin-target-search"),
    bindingTarget: byId("admin-binding-target"),
    pickTarget: byId("admin-pick-target"),
    bindingEvent: byId("admin-binding-event"),
    bindingOnce: byId("admin-binding-once"),
    bindingRepeat: byId("admin-binding-repeat"),
    saveBinding: byId("admin-save-binding"),
    clearBindings: byId("admin-clear-bindings"),
    bindingList: byId("admin-binding-list"),
    sequenceSeed: byId("admin-sequence-seed"),
    generateSequence: byId("admin-generate-sequence"),
    replaySequence: byId("admin-replay-sequence"),
    sequencePreview: byId("admin-sequence-preview"),
    frequency: byId("admin-frequency"),
    duration: byId("admin-duration"),
    intensity: byId("admin-intensity"),
    shotList: byId("admin-shot-list"),
    cueCurrent: byId("admin-cue-current"),
    cuePrev: byId("admin-cue-prev"),
    cueNext: byId("admin-cue-next"),
    showCue: byId("admin-show-cue"),
    guide: byId("admin-guide"),
    safeArea: byId("admin-safe-area"),
    audio: byId("admin-audio"),
    visualEffects: byId("admin-vfx"),
    privacy: byId("admin-privacy"),
    pauseNatural: byId("admin-pause-natural"),
    clearData: byId("admin-clear-data"),
    countdownOverlay: byId("admin-countdown-overlay"),
    cueOverlay: byId("admin-cue-overlay"),
    guideOverlay: byId("admin-safe-area-guide"),
    announcer: byId("admin-controls-announcer"),
  };

  let state = cloneDefaults();
  try {
    state = normalizeState(JSON.parse(localStateStorage.getItem(STORAGE_KEY) || "null"));
  } catch (error) {
    state = cloneDefaults();
  }

  let resetReload = false;
  try {
    resetReload = transientStorage.getItem(RESET_PENDING_KEY) === "1";
    if (resetReload) transientStorage.removeItem(RESET_PENDING_KEY);
  } catch (error) {
    resetReload = false;
  }

  const rawEvents = Array.isArray(orchestrator.listEvents?.())
    ? orchestrator.listEvents()
    : [];
  const events = rawEvents
    .map((eventDefinition) => ({
      id: String(eventDefinition?.id || ""),
      label: cleanText(eventDefinition?.label, 180),
      kind: eventDefinition?.kind === "interactive" ? "interactive" : "noninteractive",
    }))
    .filter((eventDefinition) =>
      EVENT_ID_PATTERN.test(eventDefinition.id) && Boolean(eventDefinition.label)
    );
  const eventById = new Map(events.map((eventDefinition) => [eventDefinition.id, eventDefinition]));
  const mediaMuteState = new Map();
  const privacyState = new Map();
  const seededIndicatorState = new Map();
  const stableControlLabels = new WeakMap();
  let targetChoices = [];
  let selectedTargetKey = "";
  let focusReturn = null;
  let wasOpen = false;
  let pickingTarget = false;
  let countdownTimer = null;
  let countdownResolve = null;
  let takeInterval = null;
  let takeStopTimer = null;
  let takeActive = false;
  let takeBeatActive = false;
  let takeGeneration = 0;
  let cueOverlayTimer = null;
  let seedIndicatorFrame = null;

  const persist = () => {
    try {
      localStateStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      return false;
    }
  };

  const announce = (message) => {
    const text = cleanText(message, 220);
    if (controls.status) controls.status.textContent = text || "Ready · Local only";
    if (controls.announcer) {
      controls.announcer.textContent = "";
      pageWindow.requestAnimationFrame(() => {
        controls.announcer.textContent = text;
      });
    }
  };

  const eventLabel = (eventId) => {
    if (eventId === RANDOM_EVENT_VALUE) return "Random event";
    if (eventId === SEQUENCE_EVENT_VALUE) return "Next sequence cue";
    return eventById.get(eventId)?.label || eventId || "Unknown event";
  };

  const isAdminOpen = () =>
    !adminWindow.classList.contains("is-hidden") &&
    !adminWindow.classList.contains("is-closing") &&
    adminWindow.getAttribute("aria-hidden") !== "true";

  const updatePauseState = () => {
    documentRef.body.classList.toggle("is-admin-controls-open", isAdminOpen());
  };

  const option = (value, label) => {
    const item = documentRef.createElement("option");
    item.value = value;
    item.textContent = label;
    return item;
  };

  const formatControlLabel = (element) => {
    if (stableControlLabels.has(element)) return stableControlLabels.get(element);
    const explicit = cleanText(
      element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        element.textContent,
      96
    );
    const appId = element.getAttribute("data-app");
    const windowName = element.closest(".window")
      ?.querySelector(":scope > .title-bar .title-bar-text")?.textContent;
    let label = explicit || "Site control";
    if (appId) {
      const location = element.classList.contains("desktop-icon")
        ? "Desktop"
        : element.classList.contains("taskbar-icon")
          ? "Dock"
          : "App control";
      label = `${explicit || `Open ${appId}`} (${location})`;
    }
    else if (windowName && explicit) label = `${cleanText(windowName, 48)} — ${explicit}`;
    stableControlLabels.set(element, label);
    return label;
  };

  const actionFingerprint = (element) => {
    const pieces = [
      element.tagName,
      element.getAttribute("data-close"),
      element.getAttribute("data-game-stats-open"),
      element.getAttribute("data-game-stats-refresh"),
      element.getAttribute("name"),
      element.getAttribute("type"),
      formatControlLabel(element),
    ];
    return hashString(pieces.join("|")).toString(16).padStart(8, "0");
  };

  const eligibleTargets = () =>
    Array.from(documentRef.querySelectorAll("button, a[href]"))
      .filter((element) =>
        !element.closest("#admin-controls-window, #admin-controls-stand-in-window") &&
        !element.closest("#admin-countdown-overlay") &&
        element.getAttribute("data-app") !== "admin-controls" &&
        !element.hasAttribute("data-admin-seed-description")
      );

  const descriptorForTarget = (element) => {
    if (!(element instanceof pageWindow.Element)) return "";
    const control = element.closest("button, a[href]");
    if (
      !control ||
      control.closest("#admin-controls-window, #admin-controls-stand-in-window")
    ) {
      return "";
    }
    if (control.id && TARGET_ID_PATTERN.test(control.id)) return `id:${control.id}`;
    if (control.matches(".start-button")) return "start";

    const appId = control.getAttribute("data-app");
    if (appId && EVENT_ID_PATTERN.test(appId)) {
      if (control.classList.contains("desktop-icon")) return `app:${appId}:desktop`;
      if (control.classList.contains("taskbar-icon")) return `app:${appId}:taskbar`;
      const peers = eligibleTargets().filter(
        (candidate) =>
          candidate.getAttribute("data-app") === appId &&
          !candidate.classList.contains("desktop-icon") &&
          !candidate.classList.contains("taskbar-icon")
      );
      const index = peers.indexOf(control);
      if (index >= 0 && index < 100) return `app:${appId}:other-${index}`;
    }

    if (control.hasAttribute("data-github-shortcut")) {
      const peers = eligibleTargets().filter((candidate) =>
        candidate.hasAttribute("data-github-shortcut")
      );
      const index = peers.indexOf(control);
      if (index >= 0 && index < 100) return `github:${index}`;
    }

    const fingerprint = actionFingerprint(control);
    const peers = eligibleTargets().filter(
      (candidate) => actionFingerprint(candidate) === fingerprint
    );
    const index = peers.indexOf(control);
    return index >= 0 && index < 100 ? `action:${fingerprint}:${index}` : "";
  };

  const resolveTarget = (key) => {
    const normalizedKey = normalizeTargetKey(key);
    if (!normalizedKey) return null;
    if (normalizedKey === "start") return documentRef.querySelector(".start-button");
    if (normalizedKey.startsWith("id:")) {
      const element = documentRef.getElementById(normalizedKey.slice(3));
      return element?.matches("button, a[href]") && !element.closest("#admin-controls-window")
        ? element
        : null;
    }

    const appMatch = normalizedKey.match(APP_TARGET_PATTERN);
    if (appMatch) {
      const [, appId, location] = appMatch;
      const candidates = eligibleTargets().filter(
        (candidate) => candidate.getAttribute("data-app") === appId
      );
      if (location === "desktop") {
        return candidates.find((candidate) => candidate.classList.contains("desktop-icon")) || null;
      }
      if (location === "taskbar") {
        return candidates.find((candidate) => candidate.classList.contains("taskbar-icon")) || null;
      }
      return candidates.filter(
        (candidate) =>
          !candidate.classList.contains("desktop-icon") &&
          !candidate.classList.contains("taskbar-icon")
      )[Number(location.slice("other-".length))] || null;
    }

    const githubMatch = normalizedKey.match(GITHUB_TARGET_PATTERN);
    if (githubMatch) {
      return eligibleTargets().filter((candidate) =>
        candidate.hasAttribute("data-github-shortcut")
      )[Number(githubMatch[1])] || null;
    }

    const actionMatch = normalizedKey.match(ACTION_TARGET_PATTERN);
    if (actionMatch) {
      return eligibleTargets().filter(
        (candidate) => actionFingerprint(candidate) === actionMatch[1]
      )[Number(actionMatch[2])] || null;
    }
    return null;
  };

  const collectTargetChoices = () => {
    const seen = new Set();
    targetChoices = eligibleTargets()
      .map((element) => ({
        element,
        key: descriptorForTarget(element),
        label: formatControlLabel(element),
      }))
      .filter((target) => {
        if (!target.key || seen.has(target.key)) return false;
        seen.add(target.key);
        return true;
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  };

  const removeSeedIndicator = (element, record) => {
    element.removeAttribute("data-admin-seeded");
    element.querySelectorAll(":scope > .admin-seed-badge, :scope > [data-admin-seed-description]")
      .forEach((indicator) => indicator.remove());
    if (record.describedBy === null) element.removeAttribute("aria-describedby");
    else element.setAttribute("aria-describedby", record.describedBy);
    if (record.addedPosition && element.style.position === "relative") {
      if (record.inlinePosition) {
        element.style.setProperty(
          "position",
          record.inlinePosition,
          record.inlinePositionPriority
        );
      } else {
        element.style.removeProperty("position");
      }
    }
    seededIndicatorState.delete(element);
  };

  const clearSeedIndicators = () => {
    [...seededIndicatorState.entries()].forEach(([element, record]) => {
      removeSeedIndicator(element, record);
    });
  };

  const updateSeedIndicators = () => {
    if (!isAdminOpen()) {
      clearSeedIndicators();
      return;
    }
    const desired = new Map();
    state.bindings.forEach((binding) => {
      const element = resolveTarget(binding.target);
      if (element && !desired.has(element)) desired.set(element, binding);
    });
    [...seededIndicatorState.entries()].forEach(([element, record]) => {
      const binding = desired.get(element);
      if (
        binding &&
        binding.eventId === record.eventId &&
        binding.mode === record.mode &&
        binding.target === record.target &&
        element.isConnected
      ) {
        desired.delete(element);
        return;
      }
      removeSeedIndicator(element, record);
    });
    desired.forEach((binding, element) => {
      const descriptionId = `admin-seed-description-${hashString(binding.target).toString(16)}`;
      const badge = documentRef.createElement("span");
      badge.className = "admin-seed-badge";
      badge.setAttribute("aria-hidden", "true");
      const description = documentRef.createElement("span");
      description.className = "admin-visually-hidden";
      description.id = descriptionId;
      description.setAttribute("data-admin-seed-description", "");
      description.textContent = `Seeded with ${eventLabel(binding.eventId)}; ${
        binding.mode === "once" ? "next activation only" : "every activation"
      }.`;
      const describedBy = element.getAttribute("aria-describedby");
      const addedPosition = pageWindow.getComputedStyle(element).position === "static";
      const inlinePosition = element.style.getPropertyValue("position");
      const inlinePositionPriority = element.style.getPropertyPriority("position");
      if (addedPosition) element.style.setProperty("position", "relative");
      seededIndicatorState.set(element, {
        addedPosition,
        describedBy,
        eventId: binding.eventId,
        inlinePosition,
        inlinePositionPriority,
        mode: binding.mode,
        target: binding.target,
      });
      element.setAttribute("data-admin-seeded", binding.eventId);
      element.setAttribute(
        "aria-describedby",
        [describedBy, descriptionId].filter(Boolean).join(" ")
      );
      element.append(badge, description);
    });
  };

  const renderEventList = () => {
    if (!controls.eventList) return;
    const selected = controls.eventList.value;
    const search = cleanText(controls.eventSearch?.value, 96).toLocaleLowerCase();
    const kind = controls.eventKind?.value || "all";
    const filtered = events.filter((eventDefinition) =>
      (!search || eventDefinition.label.toLocaleLowerCase().includes(search)) &&
      (kind === "all" || eventDefinition.kind === kind)
    );
    controls.eventList.replaceChildren(
      ...filtered.map((eventDefinition) => option(eventDefinition.id, eventDefinition.label))
    );
    if (filtered.some((eventDefinition) => eventDefinition.id === selected)) {
      controls.eventList.value = selected;
    }
    controls.triggerNow.disabled = !filtered.length;
    controls.addCue.disabled = !filtered.length;
  };

  const renderBindingEvents = () => {
    if (!controls.bindingEvent) return;
    const selected = normalizeEventChoice(controls.bindingEvent.value) || RANDOM_EVENT_VALUE;
    controls.bindingEvent.replaceChildren(
      option(RANDOM_EVENT_VALUE, "Random eligible event"),
      option(SEQUENCE_EVENT_VALUE, "Next deterministic sequence cue"),
      ...events.map((eventDefinition) => option(eventDefinition.id, eventDefinition.label))
    );
    controls.bindingEvent.value = Array.from(controls.bindingEvent.options).some(
      (item) => item.value === selected
    )
      ? selected
      : RANDOM_EVENT_VALUE;
  };

  const renderTargetChoices = () => {
    if (!controls.bindingTarget) return;
    collectTargetChoices();
    const search = cleanText(controls.targetSearch?.value, 96).toLocaleLowerCase();
    const filtered = targetChoices.filter((target) =>
      !search || target.label.toLocaleLowerCase().includes(search)
    );
    const emptyOption = option("", filtered.length ? "Choose a control" : "No matching controls");
    controls.bindingTarget.replaceChildren(
      emptyOption,
      ...filtered.map((target) => option(target.key, target.label))
    );
    if (filtered.some((target) => target.key === selectedTargetKey)) {
      controls.bindingTarget.value = selectedTargetKey;
    } else {
      selectedTargetKey = "";
    }
  };

  const renderBindings = () => {
    if (!controls.bindingList) return;
    controls.seedCount.textContent = String(state.bindings.length);
    if (!state.bindings.length) {
      const empty = documentRef.createElement("li");
      empty.className = "admin-empty-state";
      empty.textContent = "No controls are seeded.";
      controls.bindingList.replaceChildren(empty);
      updateSeedIndicators();
      return;
    }
    controls.bindingList.replaceChildren(
      ...state.bindings.map((binding, index) => {
        const item = documentRef.createElement("li");
        const text = documentRef.createElement("span");
        text.textContent = `${binding.label} → ${eventLabel(binding.eventId)} (${
          binding.mode === "once" ? "once" : "repeat"
        }) `;
        const remove = documentRef.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.setAttribute("data-admin-remove-binding", String(index));
        remove.setAttribute("aria-label", `Remove seed from ${binding.label}`);
        item.append(text, remove);
        return item;
      })
    );
    updateSeedIndicators();
  };

  const renderSequence = () => {
    if (!controls.sequencePreview) return;
    if (!state.sequence.length) {
      const empty = documentRef.createElement("li");
      empty.className = "admin-empty-state";
      empty.textContent = "Generate a sequence to preview its cues.";
      controls.sequencePreview.replaceChildren(empty);
      return;
    }
    controls.sequencePreview.replaceChildren(
      ...state.sequence.map((eventId, index) => {
        const item = documentRef.createElement("li");
        const isCurrent = index === state.sequenceCursor % state.sequence.length;
        item.textContent = `${eventLabel(eventId)}${isCurrent ? " · NEXT" : ""}`;
        if (isCurrent) item.setAttribute("aria-current", "step");
        return item;
      })
    );
  };

  const cueAtCursor = () =>
    state.cueCursor >= 0 && state.cueCursor < state.shotList.length
      ? state.shotList[state.cueCursor]
      : null;

  const renderShotList = () => {
    if (!controls.shotList) return;
    if (!state.shotList.length) {
      const empty = documentRef.createElement("li");
      empty.className = "admin-empty-state";
      empty.textContent = "No cues have been added.";
      controls.shotList.replaceChildren(empty);
    } else {
      controls.shotList.replaceChildren(
        ...state.shotList.map((cue, index) => {
          const item = documentRef.createElement("li");
          if (index === state.cueCursor) item.setAttribute("aria-current", "step");
          const text = documentRef.createElement("span");
          text.textContent = `${cue.label} `;
          const remove = documentRef.createElement("button");
          remove.type = "button";
          remove.textContent = "Remove";
          remove.setAttribute("data-admin-remove-cue", String(index));
          remove.setAttribute("aria-label", `Remove cue ${index + 1}: ${cue.label}`);
          item.append(text, remove);
          return item;
        })
      );
    }
    const currentCue = cueAtCursor();
    controls.cueCurrent.textContent = currentCue
      ? `Cue ${state.cueCursor + 1}/${state.shotList.length}: ${currentCue.label}`
      : "No cue selected";
    controls.cuePrev.disabled = !state.shotList.length;
    controls.cueNext.disabled = !state.shotList.length;
    controls.showCue.disabled = !currentCue;
  };

  const activateTab = (tabName, { focus = false, save = true } = {}) => {
    if (!TAB_VALUES.has(tabName)) return;
    state.activeTab = tabName;
    documentRef.querySelectorAll("[data-admin-tab]").forEach((tab) => {
      const active = tab.getAttribute("data-admin-tab") === tabName;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus({ preventScroll: true });
    });
    documentRef.querySelectorAll("[data-admin-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-admin-panel") !== tabName;
    });
    if (tabName === "bindings") renderTargetChoices();
    if (save) persist();
  };

  const syncGuide = () => {
    const visible = state.guide !== "off";
    controls.guideOverlay.hidden = !visible;
    controls.guideOverlay.setAttribute("aria-hidden", String(!visible));
    controls.guideOverlay.dataset.guide = state.guide;
    documentRef.body.classList.toggle("is-admin-safe-area-enabled", state.safeArea);
  };

  const muteMediaElement = (media) => {
    if (!(media instanceof pageWindow.HTMLMediaElement)) return;
    if (!mediaMuteState.has(media)) mediaMuteState.set(media, media.muted);
    media.muted = true;
  };

  const syncAudio = () => {
    documentRef.body.classList.toggle("is-admin-audio-off", !state.audio);
    if (!state.audio) {
      documentRef.querySelectorAll("audio, video").forEach(muteMediaElement);
      return;
    }
    mediaMuteState.forEach((wasMuted, media) => {
      if (media.isConnected) media.muted = wasMuted;
    });
    mediaMuteState.clear();
  };

  const privacyFixtureFor = (element) => {
    if (element.matches(".socials-username")) return "@promo_creator";
    if (element.matches(".game-stats-player-name-text")) return "Demo Player";
    if (element.matches(".game-progress-profile-name, #cr-player-name")) return "Demo Player";
    if (element.matches(".life-counter-name")) return "Player";
    if (element.matches("#game-profile-name, #administrator-username")) return "Demo Player";
    return "Demo Data";
  };

  const applyPrivacyFixtures = () => {
    const privateText = documentRef.querySelectorAll(
      ".socials-username, .game-stats-player-name-text, .game-progress-profile-name, #cr-player-name"
    );
    const privateInputs = documentRef.querySelectorAll(
      ".life-counter-name, #game-profile-name, #administrator-username"
    );
    if (state.privacy) {
      privateText.forEach((element) => {
        if (!privacyState.has(element)) {
          privacyState.set(element, {
            kind: "text",
            privateMarker: element.getAttribute("data-admin-private"),
            fixture: element.getAttribute("data-admin-privacy-fixture"),
          });
        }
        const fixture = privacyFixtureFor(element);
        element.setAttribute("data-admin-private", "");
        element.setAttribute("data-admin-privacy-fixture", fixture);
      });
      privateInputs.forEach((element) => {
        const host = element.parentElement;
        if (!host) return;
        if (!privacyState.has(element)) {
          privacyState.set(element, {
            kind: "input",
            host,
            inputMarker: element.getAttribute("data-admin-private-input"),
            hostHadClass: host.classList.contains("admin-privacy-input-host"),
            hostFixture: host.getAttribute("data-admin-privacy-input-fixture"),
          });
        }
        const fixture = privacyFixtureFor(element);
        element.setAttribute("data-admin-private-input", "");
        host.classList.add("admin-privacy-input-host");
        host.setAttribute("data-admin-privacy-input-fixture", fixture);
        host.style.setProperty("--admin-privacy-input-left", `${element.offsetLeft + 3}px`);
        host.style.setProperty("--admin-privacy-input-top", `${element.offsetTop + 3}px`);
        host.style.setProperty(
          "--admin-privacy-input-width",
          `${Math.max(0, element.offsetWidth - 6)}px`
        );
        host.style.setProperty(
          "--admin-privacy-input-height",
          `${Math.max(0, element.offsetHeight - 6)}px`
        );
      });
      return;
    }
    privacyState.forEach((record, element) => {
      if (element.isConnected) {
        if (record.kind === "input") {
          if (record.inputMarker === null) element.removeAttribute("data-admin-private-input");
          else element.setAttribute("data-admin-private-input", record.inputMarker);
          if (record.host?.isConnected) {
            if (!record.hostHadClass) record.host.classList.remove("admin-privacy-input-host");
            if (record.hostFixture === null) {
              record.host.removeAttribute("data-admin-privacy-input-fixture");
            } else {
              record.host.setAttribute("data-admin-privacy-input-fixture", record.hostFixture);
            }
            [
              "--admin-privacy-input-left",
              "--admin-privacy-input-top",
              "--admin-privacy-input-width",
              "--admin-privacy-input-height",
            ].forEach((property) => record.host.style.removeProperty(property));
          }
        } else {
          if (record.privateMarker === null) element.removeAttribute("data-admin-private");
          else element.setAttribute("data-admin-private", record.privateMarker);
          if (record.fixture === null) element.removeAttribute("data-admin-privacy-fixture");
          else element.setAttribute("data-admin-privacy-fixture", record.fixture);
        }
      }
    });
    privacyState.clear();
  };

  const syncEffects = () => {
    documentRef.body.classList.toggle("is-admin-vfx-off", !state.visualEffects);
    documentRef.body.classList.toggle("is-admin-privacy-mode", state.privacy);
    syncGuide();
    syncAudio();
    applyPrivacyFixtures();
  };

  const syncForm = () => {
    controls.countdown.value = String(state.countdown);
    controls.hideBeforeTrigger.checked = state.hideBeforeTrigger;
    controls.showCountdown.checked = state.showCountdown;
    controls.sequenceSeed.value = state.sequenceSeed;
    controls.frequency.value = String(state.frequency);
    controls.duration.value = String(state.duration);
    controls.intensity.value = state.intensity;
    controls.guide.value = state.guide;
    controls.safeArea.checked = state.safeArea;
    controls.audio.checked = state.audio;
    controls.visualEffects.checked = state.visualEffects;
    controls.privacy.checked = state.privacy;
    controls.pauseNatural.checked = state.pauseNatural;
    controls.startTake.disabled = takeActive || Boolean(countdownTimer);
    controls.stopTake.disabled = !takeActive && !countdownTimer;
    activateTab(state.activeTab, { save: false });
    renderEventList();
    renderBindingEvents();
    renderTargetChoices();
    renderBindings();
    renderSequence();
    renderShotList();
    syncEffects();
  };

  const generateSequence = ({ resetCursor = true, quiet = false } = {}) => {
    const seed = cleanText(controls.sequenceSeed.value, 64) || DEFAULT_STATE.sequenceSeed;
    state.sequenceSeed = seed;
    state.sequence = createSeededSequence(
      seed,
      events.map((eventDefinition) => eventDefinition.id),
      SEQUENCE_LENGTH
    );
    if (resetCursor) state.sequenceCursor = 0;
    controls.sequenceSeed.value = seed;
    persist();
    renderSequence();
    if (!quiet) {
      announce(
        state.sequence.length
          ? `Generated ${state.sequence.length} repeatable event cues from “${seed}”.`
          : "No events are available for a sequence."
      );
    }
    return state.sequence;
  };

  const runEvent = async (eventId, source) => {
    if (!eventById.has(eventId)) {
      const result = { ok: false, message: "That event is no longer available." };
      announce(result.message);
      return result;
    }
    announce(`Starting ${eventLabel(eventId)}…`);
    try {
      const result = await orchestrator.runEvent(eventId, { source });
      announce(result?.message || (result?.ok ? "Event triggered." : "Event could not start."));
      return result || { ok: false, message: "Event could not start." };
    } catch (error) {
      const result = { ok: false, message: `${eventLabel(eventId)} failed to start.` };
      announce(result.message);
      return result;
    }
  };

  const runNextSequence = async (source = "admin-sequence") => {
    const availableIds = new Set(events.map((eventDefinition) => eventDefinition.id));
    state.sequence = state.sequence.filter((eventId) => availableIds.has(eventId));
    if (!state.sequence.length) generateSequence();
    if (!state.sequence.length) {
      return { ok: false, message: "No sequence cues are available." };
    }
    const index = state.sequenceCursor % state.sequence.length;
    const eventId = state.sequence[index];
    state.sequenceCursor = (index + 1) % state.sequence.length;
    persist();
    renderSequence();
    return runEvent(eventId, source);
  };

  const runEventChoice = async (eventId, source = "admin-controls") => {
    if (eventId === SEQUENCE_EVENT_VALUE) return runNextSequence(source);
    if (eventId === RANDOM_EVENT_VALUE) {
      if (!events.length) return { ok: false, message: "No events are available." };
      const selected = events[Math.floor(Math.random() * events.length)];
      return runEvent(selected.id, source);
    }
    return runEvent(eventId, source);
  };

  const hideCountdownOverlay = () => {
    controls.countdownOverlay.hidden = true;
    controls.countdownOverlay.setAttribute("aria-hidden", "true");
    controls.countdownOverlay.textContent = "";
  };

  const cancelCountdown = (message = "Take cancelled.") => {
    if (!countdownTimer) return false;
    pageWindow.clearInterval(countdownTimer);
    countdownTimer = null;
    hideCountdownOverlay();
    const resolve = countdownResolve;
    countdownResolve = null;
    if (resolve) resolve({ ok: false, message });
    syncForm();
    announce(message);
    return true;
  };

  const closeAdminForCapture = () => {
    if (adminWindow.contains(documentRef.activeElement)) {
      documentRef.querySelector('.taskbar-icon[data-app="admin-controls"]')?.focus({
        preventScroll: true,
      });
    }
    orchestrator.closeWindow?.();
  };

  const runWithCountdown = (action, label) => {
    cancelCountdown("");
    if (state.hideBeforeTrigger) closeAdminForCapture();
    const seconds = state.countdown;
    if (!seconds) return Promise.resolve().then(action);

    let remaining = seconds;
    if (state.showCountdown) {
      controls.countdownOverlay.hidden = false;
      controls.countdownOverlay.setAttribute("aria-hidden", "false");
      controls.countdownOverlay.textContent = String(remaining);
    }
    announce(`${label} starts in ${remaining} seconds.`);
    return new Promise((resolve) => {
      countdownResolve = resolve;
      countdownTimer = pageWindow.setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          if (state.showCountdown) controls.countdownOverlay.textContent = String(remaining);
          announce(`${label} starts in ${remaining} second${remaining === 1 ? "" : "s"}.`);
          return;
        }
        pageWindow.clearInterval(countdownTimer);
        countdownTimer = null;
        countdownResolve = null;
        hideCountdownOverlay();
        syncForm();
        Promise.resolve()
          .then(action)
          .then(resolve, () => resolve({ ok: false, message: `${label} could not start.` }));
      }, 1000);
      syncForm();
    });
  };

  const intensityCount = () => {
    if (state.intensity === "high") return 3;
    if (state.intensity === "medium") return 2;
    return 1;
  };

  const runTakeBeat = async (generation = takeGeneration) => {
    if (!takeActive || takeBeatActive || generation !== takeGeneration) return;
    takeBeatActive = true;
    try {
      for (
        let index = 0;
        index < intensityCount() && takeActive && generation === takeGeneration;
        index += 1
      ) {
        await runNextSequence("admin-automatic-take");
      }
    } finally {
      if (generation === takeGeneration) takeBeatActive = false;
    }
  };

  const stopTake = (message = "Take stopped.") => {
    const hadActivity = takeActive || Boolean(takeInterval) || Boolean(takeStopTimer);
    takeGeneration += 1;
    takeActive = false;
    takeBeatActive = false;
    if (takeInterval) pageWindow.clearInterval(takeInterval);
    if (takeStopTimer) pageWindow.clearTimeout(takeStopTimer);
    takeInterval = null;
    takeStopTimer = null;
    documentRef.querySelectorAll('[data-app="admin-controls"]').forEach((launcher) => {
      launcher.classList.remove("is-admin-running");
    });
    syncForm();
    if (hadActivity && message) announce(message);
    return hadActivity;
  };

  const beginTake = () => {
    stopTake("");
    takeActive = true;
    const generation = takeGeneration;
    documentRef.querySelectorAll('[data-app="admin-controls"]').forEach((launcher) => {
      launcher.classList.add("is-admin-running");
    });
    syncForm();
    announce(
      `Take running for ${state.duration} seconds · ${state.intensity} intensity · every ${state.frequency} seconds.`
    );
    void runTakeBeat(generation);
    takeInterval = pageWindow.setInterval(
      () => void runTakeBeat(generation),
      state.frequency * 1000
    );
    takeStopTimer = pageWindow.setTimeout(
      () => stopTake("Take complete."),
      state.duration * 1000
    );
    return { ok: true, message: "Take started." };
  };

  const showCurrentCue = () => {
    const cue = cueAtCursor();
    if (!cue) return;
    if (cueOverlayTimer) pageWindow.clearTimeout(cueOverlayTimer);
    controls.cueOverlay.textContent = cue.label;
    controls.cueOverlay.hidden = false;
    controls.cueOverlay.setAttribute("aria-hidden", "false");
    cueOverlayTimer = pageWindow.setTimeout(() => {
      controls.cueOverlay.hidden = true;
      controls.cueOverlay.setAttribute("aria-hidden", "true");
      cueOverlayTimer = null;
    }, 3000);
    announce(`Showing cue: ${cue.label}`);
  };

  const moveCue = (direction) => {
    if (!state.shotList.length) return;
    const start = state.cueCursor < 0 ? (direction > 0 ? -1 : 0) : state.cueCursor;
    state.cueCursor = (start + direction + state.shotList.length) % state.shotList.length;
    persist();
    renderShotList();
  };

  const stopPicking = ({ reopen = false, message = "Target picker cancelled." } = {}) => {
    pickingTarget = false;
    documentRef.body.classList.remove("is-admin-picking-target");
    documentRef.querySelectorAll("[data-admin-pickable], [data-admin-pick-hover]").forEach((element) => {
      element.removeAttribute("data-admin-pickable");
      element.removeAttribute("data-admin-pick-hover");
    });
    if (reopen) {
      pageWindow.requestAnimationFrame(() => {
        const launcher =
          focusReturn?.isConnected &&
          focusReturn.getAttribute?.("data-app") === "admin-controls"
            ? focusReturn
            : documentRef.querySelector('.taskbar-icon[data-app="admin-controls"]');
        launcher?.click();
      });
    }
    if (message) announce(message);
  };

  const startPicking = () => {
    controls.targetSearch.value = "";
    collectTargetChoices();
    pickingTarget = true;
    documentRef.body.classList.add("is-admin-picking-target");
    targetChoices.forEach((target) => target.element.setAttribute("data-admin-pickable", ""));
    announce("Choose a highlighted control. Press Escape to cancel.");
    closeAdminForCapture();
  };

  const saveBinding = () => {
    const target = normalizeTargetKey(controls.bindingTarget.value || selectedTargetKey);
    const targetChoice = targetChoices.find((choice) => choice.key === target);
    const eventId = normalizeEventChoice(controls.bindingEvent.value);
    if (!target || !targetChoice) {
      announce("Choose a control to seed first.");
      controls.bindingTarget.focus();
      return;
    }
    if (!eventId) {
      announce("Choose an event for this control.");
      controls.bindingEvent.focus();
      return;
    }
    const binding = {
      target,
      label: targetChoice.label,
      eventId,
      mode: controls.bindingRepeat.checked ? "repeat" : "once",
    };
    state.bindings = [...state.bindings.filter((candidate) => candidate.target !== target), binding];
    persist();
    renderBindings();
    announce(`Seeded ${binding.label} with ${eventLabel(binding.eventId)}.`);
  };

  const setLaunchersRunning = (running) => {
    documentRef.querySelectorAll('[data-app="admin-controls"]').forEach((launcher) => {
      launcher.classList.toggle("is-admin-running", running);
    });
  };

  documentRef.querySelectorAll('[data-app="admin-controls"]').forEach((launcher) => {
    launcher.addEventListener("click", () => {
      focusReturn = launcher;
    });
  });

  documentRef.querySelectorAll("[data-admin-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.getAttribute("data-admin-tab"));
    });
    tab.addEventListener("keydown", (event) => {
      const tabs = Array.from(documentRef.querySelectorAll("[data-admin-tab]"));
      const currentIndex = tabs.indexOf(tab);
      let nextIndex = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
      }
      if (nextIndex === null) return;
      event.preventDefault();
      activateTab(tabs[nextIndex].getAttribute("data-admin-tab"), { focus: true });
    });
  });

  controls.eventSearch.addEventListener("input", renderEventList);
  controls.eventKind.addEventListener("change", renderEventList);
  controls.targetSearch.addEventListener("input", renderTargetChoices);
  controls.bindingTarget.addEventListener("change", () => {
    selectedTargetKey = normalizeTargetKey(controls.bindingTarget.value);
  });
  controls.saveBinding.addEventListener("click", saveBinding);
  controls.pickTarget.addEventListener("click", startPicking);
  controls.clearBindings.addEventListener("click", () => {
    state.bindings = [];
    persist();
    renderBindings();
    announce("All control seeds cleared.");
  });
  controls.bindingList.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-admin-remove-binding]");
    if (!remove) return;
    const index = Number(remove.getAttribute("data-admin-remove-binding"));
    if (!Number.isInteger(index) || !state.bindings[index]) return;
    const [removed] = state.bindings.splice(index, 1);
    state.bindings = [...state.bindings];
    persist();
    renderBindings();
    announce(`Removed the seed from ${removed.label}.`);
  });

  controls.triggerNow.addEventListener("click", () => {
    void runEventChoice(controls.eventList.value, "admin-direct-event");
  });
  controls.runSequenceNext.addEventListener("click", () => {
    void runNextSequence("admin-direct-sequence");
  });
  controls.addCue.addEventListener("click", () => {
    const eventId = controls.eventList.value;
    if (!eventById.has(eventId)) return;
    state.shotList = [...state.shotList, { label: eventLabel(eventId), eventId }];
    state.cueCursor = state.shotList.length - 1;
    persist();
    renderShotList();
    announce(`Added ${eventLabel(eventId)} to the shot list.`);
  });

  controls.generateSequence.addEventListener("click", () => generateSequence());
  controls.replaySequence.addEventListener("click", () => {
    if (!state.sequence.length) generateSequence();
    state.sequenceCursor = 0;
    persist();
    renderSequence();
    announce("Sequence rewound to its first cue.");
  });
  controls.shotList.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-admin-remove-cue]");
    if (!remove) return;
    const index = Number(remove.getAttribute("data-admin-remove-cue"));
    if (!Number.isInteger(index) || !state.shotList[index]) return;
    state.shotList.splice(index, 1);
    state.shotList = [...state.shotList];
    if (!state.shotList.length) state.cueCursor = -1;
    else state.cueCursor = Math.min(state.cueCursor, state.shotList.length - 1);
    persist();
    renderShotList();
    announce("Cue removed.");
  });
  controls.cuePrev.addEventListener("click", () => moveCue(-1));
  controls.cueNext.addEventListener("click", () => moveCue(1));
  controls.showCue.addEventListener("click", showCurrentCue);

  documentRef.querySelectorAll("[data-admin-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const presetId = button.getAttribute("data-admin-preset");
      const label = cleanText(button.textContent, 80) || "Scene";
      void runWithCountdown(
        async () => {
          const result = await orchestrator.runPreset(presetId, {
            intensity: state.intensity,
            visualEffects: state.visualEffects,
          });
          announce(result?.message || `${label} preset complete.`);
          return result;
        },
        label
      );
    });
  });

  controls.startTake.addEventListener("click", () => {
    setLaunchersRunning(true);
    void runWithCountdown(beginTake, "Automatic take").then((result) => {
      if (!result?.ok && !takeActive) setLaunchersRunning(false);
    });
  });
  controls.stopTake.addEventListener("click", () => {
    const cancelled = cancelCountdown("Take cancelled.");
    stopTake(cancelled ? "" : "Take stopped.");
    setLaunchersRunning(false);
  });
  controls.resetScene.addEventListener("click", () => {
    cancelCountdown("");
    stopTake("");
    try {
      transientStorage.setItem(RESET_PENDING_KEY, "1");
    } catch (error) {
      announce("Scene reset is unavailable in this browser.");
      return;
    }
    announce("Resetting the scene while keeping local Admin settings…");
    orchestrator.resetScene();
  });

  const persistSelectNumber = (control, property, allowedValues) => {
    control.addEventListener("change", () => {
      const value = Number(control.value);
      if (!allowedValues.has(value)) return;
      state[property] = value;
      persist();
    });
  };
  persistSelectNumber(controls.countdown, "countdown", COUNTDOWN_VALUES);
  persistSelectNumber(controls.frequency, "frequency", FREQUENCY_VALUES);
  persistSelectNumber(controls.duration, "duration", DURATION_VALUES);
  controls.intensity.addEventListener("change", () => {
    if (!INTENSITY_VALUES.has(controls.intensity.value)) return;
    state.intensity = controls.intensity.value;
    persist();
  });
  controls.sequenceSeed.addEventListener("change", () => {
    state.sequenceSeed = cleanText(controls.sequenceSeed.value, 64) || DEFAULT_STATE.sequenceSeed;
    controls.sequenceSeed.value = state.sequenceSeed;
    persist();
  });

  const persistToggle = (control, property, afterChange = null) => {
    control.addEventListener("change", () => {
      state[property] = control.checked;
      persist();
      if (afterChange) afterChange();
    });
  };
  persistToggle(controls.hideBeforeTrigger, "hideBeforeTrigger");
  persistToggle(controls.showCountdown, "showCountdown");
  persistToggle(controls.safeArea, "safeArea", syncGuide);
  persistToggle(controls.audio, "audio", syncAudio);
  persistToggle(controls.visualEffects, "visualEffects", syncEffects);
  persistToggle(controls.privacy, "privacy", syncEffects);
  persistToggle(controls.pauseNatural, "pauseNatural");
  controls.guide.addEventListener("change", () => {
    if (!GUIDE_VALUES.has(controls.guide.value)) return;
    state.guide = controls.guide.value;
    persist();
    syncGuide();
  });

  controls.clearData.addEventListener("click", () => {
    cancelCountdown("");
    stopTake("");
    clearSeedIndicators();
    try {
      localStateStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      announce("Admin data could not be cleared in this browser.");
      return;
    }
    state = cloneDefaults();
    selectedTargetKey = "";
    syncForm();
    announce("Admin data cleared. Site and game data were not changed.");
  });

  const handleDocumentClick = (event) => {
    const rawTarget = event.target instanceof pageWindow.Element
      ? event.target
      : event.target?.parentElement;
    const control = rawTarget?.closest("button, a[href]");
    if (!control) return null;
    if (control.getAttribute("data-app") === "admin-controls") {
      focusReturn = control;
      return null;
    }
    if (control.closest("#admin-controls-window, #admin-controls-stand-in-window")) {
      return null;
    }

    const targetKey = descriptorForTarget(control);
    if (pickingTarget) {
      event.preventDefault();
      event.stopPropagation();
      const targetChoice = targetChoices.find((choice) => choice.key === targetKey);
      if (!targetChoice) {
        announce("That control cannot be seeded.");
        return { type: "picker-invalid" };
      }
      selectedTargetKey = targetKey;
      stopPicking({ reopen: true, message: `Selected ${targetChoice.label}.` });
      return { type: "picker", target: targetKey };
    }

    const bindingIndex = state.bindings.findIndex((binding) => binding.target === targetKey);
    if (bindingIndex < 0) return null;
    const binding = state.bindings[bindingIndex];
    orchestrator.suppressNaturalTriggers?.();
    if (binding.mode === "once") {
      state.bindings.splice(bindingIndex, 1);
      state.bindings = [...state.bindings];
      persist();
      renderBindings();
    }
    void runEventChoice(binding.eventId, `admin-seeded-control:${binding.target}`);
    return { type: "seed", target: binding.target, eventId: binding.eventId };
  };

  documentRef.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (event.defaultPrevented) return;
    if (pickingTarget) {
      event.preventDefault();
      event.stopPropagation();
      stopPicking({ reopen: true });
      return;
    }
    if (!isAdminOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    orchestrator.closeWindow?.();
  });

  const syncWindowState = () => {
    const open = isAdminOpen();
    updatePauseState();
    if (open === wasOpen) return;
    wasOpen = open;
    if (open) {
      renderTargetChoices();
      renderBindings();
      pageWindow.requestAnimationFrame(() => {
        documentRef.querySelector(`[data-admin-tab="${state.activeTab}"]`)?.focus({
          preventScroll: true,
        });
      });
      return;
    }
    clearSeedIndicators();
    if (!pickingTarget && focusReturn?.isConnected) {
      focusReturn.focus({ preventScroll: true });
    }
  };

  const adminObserver = new pageWindow.MutationObserver(syncWindowState);
  adminObserver.observe(adminWindow, {
    attributes: true,
    attributeFilter: ["class", "aria-hidden"],
  });
  const contentObserver = new pageWindow.MutationObserver(() => {
    if (state.privacy) applyPrivacyFixtures();
    if (!state.audio) documentRef.querySelectorAll("audio, video").forEach(muteMediaElement);
    if (isAdminOpen() && !seedIndicatorFrame) {
      seedIndicatorFrame = pageWindow.requestAnimationFrame(() => {
        seedIndicatorFrame = null;
        updateSeedIndicators();
      });
    }
  });
  contentObserver.observe(documentRef.body, { childList: true, subtree: true });
  pageWindow.addEventListener("resize", () => {
    if (state.privacy) applyPrivacyFixtures();
  });

  const mediaPrototype = pageWindow.HTMLMediaElement?.prototype;
  const originalMediaPlay = mediaPrototype?.play;
  if (mediaPrototype && typeof originalMediaPlay === "function") {
    mediaPrototype.play = function adminControlledMediaPlay(...args) {
      if (!state.audio) muteMediaElement(this);
      return originalMediaPlay.apply(this, args);
    };
  }

  pageWindow.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    cancelCountdown("");
    stopTake("");
    if (cueOverlayTimer) pageWindow.clearTimeout(cueOverlayTimer);
    if (seedIndicatorFrame) pageWindow.cancelAnimationFrame(seedIndicatorFrame);
    adminObserver.disconnect();
    contentObserver.disconnect();
  });

  syncForm();
  syncWindowState();
  if (!state.sequence.length && events.length) generateSequence({ quiet: true });
  controls.status.textContent = "Ready · Local only";
  controls.announcer.textContent = "";

  return Object.freeze({
    getState: () => normalizeState(state),
    handleDocumentClick,
    shouldPauseNaturalEvents: () =>
      state.pauseNatural &&
      (isAdminOpen() || pickingTarget || Boolean(countdownTimer) || takeActive),
    wasResetReload: () => resetReload,
  });
};

const namespace = Object.freeze({
  STORAGE_KEY,
  RESET_PENDING_KEY,
  RANDOM_EVENT_VALUE,
  DEFAULT_STATE,
  normalizeState,
  createSeededSequence,
  create,
});

window.rohinAdminControls = namespace;

const mount = () => {
  if (window.rohinAdminControlsController) return;
  window.rohinAdminControlsController = namespace.create({
    runtime: window.rohinAdminOrchestrator,
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
} else {
  mount();
}
})();
