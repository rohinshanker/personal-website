const MIN_ITEM_DURATION = 0.25;
const DEFAULT_PROJECT_DURATION = 30;
const EFFECT_DURATION = 3;
const KEYBOARD_STEP = 0.25;
const ADMINISTRATOR_PROOF_STORAGE_KEY = "personalSiteAdministratorProofV1";
const ADMINISTRATOR_SESSION_DURATION_MS = 60 * 60 * 1000;
const AUTHENTICATION_REQUEST_TIMEOUT_MS = 8_000;
const AUTHENTICATED_STATE = "authenticated";
const UNAUTHENTICATED_STATE = "unauthenticated";
const ADMINISTRATOR_PROFILE = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
});
const DRAG_TYPES = Object.freeze({
  media: "application/x-rohin-video-editor-media",
  clip: "application/x-rohin-video-editor-clip",
  effect: "application/x-rohin-video-editor-effect",
  tab: "application/x-rohin-video-editor-tab",
});

const EFFECTS = Object.freeze({
  "closed-captions": Object.freeze({
    label: "Closed Captions",
    color: "yellow",
    icon: "../assets/app-icons/ico/accessibility_window_speak.ico",
  }),
  "windows-98": Object.freeze({
    label: "Windows 98",
    color: "navy",
    icon: "../assets/app-icons/ico/windows.ico",
  }),
  transitions: Object.freeze({
    label: "Transitions",
    color: "teal",
    icon: "../assets/app-icons/ico/movie_maker.ico",
  }),
});

const elements = {
  app: document.querySelector("#video-editor-app"),
  authOverlay: document.querySelector("#video-editor-auth-overlay"),
  authDialog: document.querySelector("#video-editor-auth-dialog"),
  authForm: document.querySelector("#video-editor-auth-form"),
  authUsername: document.querySelector("#video-editor-auth-username"),
  authPassword: document.querySelector("#video-editor-auth-password"),
  authSubmit: document.querySelector("#video-editor-auth-submit"),
  authStatus: document.querySelector("#video-editor-auth-status"),
  mediaInput: document.querySelector("#media-file-input"),
  importButton: document.querySelector("#import-media-button"),
  dropZone: document.querySelector("#media-drop-zone"),
  mediaBin: document.querySelector("#media-bin"),
  mediaEmpty: document.querySelector("#media-empty-state"),
  mediaCount: document.querySelector("#media-count"),
  previewVideo: document.querySelector("#preview-video"),
  previewEmpty: document.querySelector("#preview-empty-state"),
  previewName: document.querySelector("#preview-clip-name"),
  audioMix: document.querySelector("#preview-audio-mix"),
  playButton: document.querySelector("#play-pause-button"),
  scrubber: document.querySelector("#playhead-scrubber"),
  currentTime: document.querySelector("#current-time"),
  totalDuration: document.querySelector("#total-duration"),
  timelineScale: document.querySelector("#timeline-scale"),
  timelineScroll: document.querySelector("#timeline-scroll"),
  timelineCanvas: document.querySelector("#timeline-canvas"),
  timelineRuler: document.querySelector("#timeline-ruler"),
  timelineTiers: document.querySelector("#timeline-tiers"),
  timelinePlayhead: document.querySelector("#timeline-playhead"),
  effectsTrack: document.querySelector("#effects-track"),
  status: document.querySelector("#editor-status"),
  tabList: document.querySelector("#effect-tab-list"),
  reopenTab: document.querySelector("#reopen-effect-tab"),
  editorEmpty: document.querySelector("#effect-editor-empty"),
  mediaTemplate: document.querySelector("#media-item-template"),
  tierTemplate: document.querySelector("#tier-template"),
  clipTemplate: document.querySelector("#clip-template"),
  effectTemplate: document.querySelector("#effect-item-template"),
  tabTemplate: document.querySelector("#effect-tab-template"),
};

const state = {
  media: [],
  tiers: [
    { id: "video-1", kind: "video", label: "Video 1" },
    { id: "audio-1", kind: "audio", label: "Audio 1" },
  ],
  clips: [],
  effects: [],
  openTabs: [],
  closedTabs: [],
  activeTab: null,
  selectedMediaId: null,
  playhead: 0,
  pixelsPerSecond: Number(elements.timelineScale?.value) || 64,
  playing: false,
  playbackStartedAt: 0,
  animationFrame: 0,
};

const audioPlayers = new Map();
let nextMediaId = 1;
let nextClipId = 1;
let nextEffectId = 1;
let dragPayload = null;
let administratorProof = null;
let authenticationExpiryTimer = 0;
let authenticationMonitorTimer = 0;
let authenticationAttempt = 0;
let authenticationController = null;
let authenticationReturnFocus = null;
let authenticationStorageAvailable = true;

const desktopEditorQuery = window.matchMedia("(min-width: 1024px)");

const normalizeAuthenticationBackend = (rawConfig) => {
  const value = String(rawConfig?.apiBaseUrl || "").trim();
  const buildVersion = String(rawConfig?.buildVersion || "").trim();
  if (!value || !/^sha256-[a-f0-9]{64}$/.test(buildVersion)) return "";
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return "";
    if (url.username || url.password || url.search || url.hash) return "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const authenticationApiBaseUrl = normalizeAuthenticationBackend(
  window.rohinGameStatsBackend
);

const clamp = (value, minimum, maximum) =>
  Math.min(Math.max(value, minimum), maximum);

const roundTime = (value) => Math.round(value * 100) / 100;

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder
    .toFixed(2)
    .padStart(5, "0")}`;
};

const announce = (message) => {
  if (elements.status) elements.status.textContent = message;
};

const mediaForClip = (clip) =>
  state.media.find((item) => item.id === clip.mediaId) || null;

const clipDuration = (clip) => clip.sourceEnd - clip.sourceStart;

const projectDuration = () => {
  const clipEnd = state.clips.reduce(
    (maximum, clip) => Math.max(maximum, clip.start + clipDuration(clip)),
    0
  );
  const effectEnd = state.effects.reduce(
    (maximum, effect) => Math.max(maximum, effect.start + effect.duration),
    0
  );
  return Math.max(DEFAULT_PROJECT_DURATION, Math.ceil(Math.max(clipEnd, effectEnd) + 2));
};

const setDragData = (event, type, id) => {
  dragPayload = { type, id };
  event.dataTransfer?.setData(type, id);
  event.dataTransfer?.setData("text/plain", id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = type === DRAG_TYPES.media ? "copy" : "move";
};

const getDragData = (event) => {
  for (const type of Object.values(DRAG_TYPES)) {
    const id = event.dataTransfer?.getData(type);
    if (id) return { type, id };
  }
  return dragPayload;
};

const clearDragStyles = () => {
  document
    .querySelectorAll(".is-drop-target, .is-drop-invalid, .is-drag-target")
    .forEach((item) =>
      item.classList.remove("is-drop-target", "is-drop-invalid", "is-drag-target")
    );
};

const normalizeAdministratorProof = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const proof = String(payload.proof || "").trim();
  const reportedExpiresAtMs = new Date(payload.expiresAt || "").getTime();
  if (
    !/^[A-Za-z0-9._~+=\/-]{16,4096}$/.test(proof) ||
    !Number.isFinite(reportedExpiresAtMs) ||
    reportedExpiresAtMs <= Date.now()
  ) {
    return null;
  }
  const expiresAtMs = Math.min(
    reportedExpiresAtMs,
    Date.now() + ADMINISTRATOR_SESSION_DURATION_MS
  );
  return { proof, expiresAt: new Date(expiresAtMs).toISOString() };
};

const normalizeAdministratorSignInResponse = (payload) => {
  const proof = normalizeAdministratorProof(payload);
  const profile = payload?.profile;
  if (
    !proof ||
    profile?.id !== ADMINISTRATOR_PROFILE.id ||
    profile?.name !== ADMINISTRATOR_PROFILE.name ||
    profile?.icon !== ADMINISTRATOR_PROFILE.icon
  ) {
    return null;
  }
  return proof;
};

const readStoredAdministratorProof = () => {
  if (!authenticationStorageAvailable) return { payload: null, proof: null };
  let stored = "";
  try {
    stored = sessionStorage.getItem(ADMINISTRATOR_PROOF_STORAGE_KEY) || "";
  } catch {
    authenticationStorageAvailable = false;
    return { payload: null, proof: null };
  }
  if (!stored) return { payload: null, proof: null };
  try {
    const payload = JSON.parse(stored);
    return { payload, proof: normalizeAdministratorProof(payload) };
  } catch {
    clearStoredAdministratorProof();
    return { payload: {}, proof: null };
  }
};

const storeAdministratorProof = (proof) => {
  const normalized = normalizeAdministratorProof(proof);
  if (!normalized) return null;
  if (authenticationStorageAvailable) {
    try {
      sessionStorage.setItem(
        ADMINISTRATOR_PROOF_STORAGE_KEY,
        JSON.stringify(normalized)
      );
    } catch {
      authenticationStorageAvailable = false;
    }
  }
  return normalized;
};

const clearStoredAdministratorProof = () => {
  if (!authenticationStorageAvailable) return;
  try {
    sessionStorage.removeItem(ADMINISTRATOR_PROOF_STORAGE_KEY);
  } catch {
    authenticationStorageAvailable = false;
  }
};

const setAuthenticationStatus = (message, stateName = "") => {
  if (!elements.authStatus) return;
  elements.authStatus.textContent = message;
  if (stateName) elements.authStatus.dataset.state = stateName;
  else elements.authStatus.removeAttribute("data-state");
};

const setAuthenticationBusy = (busy) => {
  elements.authForm?.setAttribute("aria-busy", String(busy));
  if (elements.authSubmit) elements.authSubmit.disabled = busy || !authenticationApiBaseUrl;
  if (elements.authUsername) elements.authUsername.readOnly = busy;
  if (elements.authPassword) elements.authPassword.readOnly = busy;
};

const authenticationGateIsVisible = () =>
  Boolean(elements.authOverlay && !elements.authOverlay.hidden && desktopEditorQuery.matches);

const focusAuthenticationForm = () => {
  if (!authenticationGateIsVisible()) return;
  window.requestAnimationFrame(() => {
    if (!authenticationGateIsVisible()) return;
    elements.authUsername?.focus({ preventScroll: true });
  });
};

const clearAuthenticationTimers = () => {
  window.clearTimeout(authenticationExpiryTimer);
  window.clearInterval(authenticationMonitorTimer);
  authenticationExpiryTimer = 0;
  authenticationMonitorTimer = 0;
};

const authenticationStatusForReason = (reason) => {
  if (!authenticationApiBaseUrl) {
    return "Sign-in is unavailable right now. Reload this page and try again.";
  }
  if (reason === "expired") {
    return "Your one-hour session expired. Your project is safe in this tab. Sign in again to continue.";
  }
  if (reason === "deauthenticated") {
    return "Your session ended. Your project is safe in this tab. Sign in again to continue.";
  }
  return "Sign in to begin. Access remains active for one hour.";
};

const requireAuthentication = (reason = "initial") => {
  if (
    document.activeElement instanceof HTMLElement &&
    elements.app?.contains(document.activeElement)
  ) {
    authenticationReturnFocus = document.activeElement;
  }

  administratorProof = null;
  clearStoredAdministratorProof();
  clearAuthenticationTimers();
  authenticationController?.abort();
  authenticationController = null;
  authenticationAttempt += 1;
  dragPayload = null;
  clearDragStyles();
  pausePlayback();

  document.body.dataset.videoEditorAuthState = UNAUTHENTICATED_STATE;
  if (elements.app) {
    elements.app.inert = true;
    elements.app.setAttribute("inert", "");
    elements.app.setAttribute("aria-hidden", "true");
  }
  if (elements.authOverlay) elements.authOverlay.hidden = false;
  if (elements.authPassword) elements.authPassword.value = "";
  setAuthenticationBusy(false);
  setAuthenticationStatus(
    authenticationStatusForReason(reason),
    authenticationApiBaseUrl ? "" : "error"
  );
  focusAuthenticationForm();
};

const administratorProofMatchesStorage = () => {
  if (!administratorProof || !authenticationStorageAvailable) return true;
  const stored = readStoredAdministratorProof().proof;
  return Boolean(
    stored &&
      stored.proof === administratorProof.proof &&
      stored.expiresAt === administratorProof.expiresAt
  );
};

const verifyActiveAuthentication = () => {
  if (!administratorProof) return false;
  const expiresAtMs = Date.parse(administratorProof.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    requireAuthentication("expired");
    return false;
  }
  if (!administratorProofMatchesStorage()) {
    requireAuthentication("deauthenticated");
    return false;
  }
  return true;
};

const scheduleAuthenticationExpiry = () => {
  window.clearTimeout(authenticationExpiryTimer);
  if (!administratorProof) return;
  const remainingMs = Date.parse(administratorProof.expiresAt) - Date.now();
  if (remainingMs <= 0) {
    requireAuthentication("expired");
    return;
  }
  authenticationExpiryTimer = window.setTimeout(() => {
    if (verifyActiveAuthentication()) scheduleAuthenticationExpiry();
  }, Math.min(remainingMs, 2_147_000_000));
};

const completeAuthentication = (proof, { initial = false } = {}) => {
  const normalized = storeAdministratorProof(proof);
  if (!normalized) return false;
  administratorProof = normalized;
  clearAuthenticationTimers();

  document.body.dataset.videoEditorAuthState = AUTHENTICATED_STATE;
  if (elements.authOverlay) elements.authOverlay.hidden = true;
  if (elements.app) {
    elements.app.inert = false;
    elements.app.removeAttribute("inert");
    elements.app.removeAttribute("aria-hidden");
  }
  if (elements.authPassword) elements.authPassword.value = "";
  setAuthenticationBusy(false);
  setAuthenticationStatus("");
  scheduleAuthenticationExpiry();
  authenticationMonitorTimer = window.setInterval(verifyActiveAuthentication, 1_000);

  const returnFocus =
    authenticationReturnFocus?.isConnected && elements.app?.contains(authenticationReturnFocus)
      ? authenticationReturnFocus
      : elements.importButton;
  authenticationReturnFocus = null;
  window.requestAnimationFrame(() => returnFocus?.focus({ preventScroll: true }));
  announce(
    initial
      ? "Authenticated session restored. Empty project ready."
      : "Signed in. Your project is ready."
  );
  return true;
};

const readAuthenticationResponse = async (response) => {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error(String(payload?.error || "Sign-in request failed"));
    error.status = response.status;
    throw error;
  }
  return payload;
};

const submitAuthentication = async (event) => {
  event.preventDefault();
  if (elements.authSubmit?.disabled || !authenticationApiBaseUrl) return;

  const username = String(elements.authUsername?.value || "");
  const password = String(elements.authPassword?.value || "");
  if (!username || !password) {
    setAuthenticationStatus("Enter both a username and password.", "error");
    (username ? elements.authPassword : elements.authUsername)?.focus();
    return;
  }

  const attempt = (authenticationAttempt += 1);
  authenticationController?.abort();
  authenticationController = new AbortController();
  const requestTimeout = window.setTimeout(
    () => authenticationController?.abort(),
    AUTHENTICATION_REQUEST_TIMEOUT_MS
  );
  setAuthenticationBusy(true);
  setAuthenticationStatus("Signing in…");

  try {
    const response = await fetch(`${authenticationApiBaseUrl}/administrator/sign-in`, {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
      signal: authenticationController.signal,
    });
    const proof = normalizeAdministratorSignInResponse(
      await readAuthenticationResponse(response)
    );
    if (!proof) throw new Error("invalid-session-response");
    if (attempt !== authenticationAttempt) return;
    completeAuthentication(proof);
  } catch (error) {
    if (attempt !== authenticationAttempt) return;
    const status = Number(error?.status);
    let message = "Sign-in failed. Check your username and password.";
    if (error?.name === "AbortError") {
      message = "Sign-in timed out. Your project is safe in this tab. Try again.";
    } else if (error?.message === "invalid-session-response") {
      message = "Sign-in returned an invalid session. Try again.";
    } else if (!Number.isFinite(status) || status >= 500 || [408, 425].includes(status)) {
      message = "Sign-in service is unavailable. Your project is safe in this tab. Try again.";
    } else if (status === 429) {
      message = "Too many sign-in attempts. Wait a moment, then try again.";
    }
    if (elements.authPassword) elements.authPassword.value = "";
    setAuthenticationStatus(message, "error");
    elements.authPassword?.focus();
  } finally {
    window.clearTimeout(requestTimeout);
    if (attempt === authenticationAttempt) {
      authenticationController = null;
      setAuthenticationBusy(false);
    }
  }
};

const trapAuthenticationFocus = (event) => {
  if (!authenticationGateIsVisible()) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    setAuthenticationStatus("Sign in is required to use Video Editor.");
    focusAuthenticationForm();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [
    elements.authUsername,
    elements.authPassword,
    elements.authSubmit,
  ].filter((element) => element && !element.disabled);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const currentIndex = focusable.indexOf(document.activeElement);
  const nextIndex = event.shiftKey
    ? currentIndex <= 0
      ? focusable.length - 1
      : currentIndex - 1
    : currentIndex === -1 || currentIndex === focusable.length - 1
      ? 0
      : currentIndex + 1;
  event.preventDefault();
  focusable[nextIndex].focus();
};

const initializeAuthentication = () => {
  elements.authForm?.addEventListener("submit", submitAuthentication);
  elements.authOverlay?.addEventListener("pointerdown", (event) => {
    if (event.target === elements.authOverlay) focusAuthenticationForm();
  });
  document.addEventListener("keydown", trapAuthenticationFocus, true);
  document.addEventListener("focusin", (event) => {
    if (!authenticationGateIsVisible() || elements.authDialog?.contains(event.target)) return;
    focusAuthenticationForm();
  });
  const handleDesktopChange = () => {
    if (desktopEditorQuery.matches && !administratorProof) focusAuthenticationForm();
  };
  desktopEditorQuery.addEventListener?.("change", handleDesktopChange);
  window.addEventListener("focus", verifyActiveAuthentication);
  window.addEventListener("pageshow", verifyActiveAuthentication);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) verifyActiveAuthentication();
  });

  const stored = readStoredAdministratorProof();
  if (stored.proof) {
    completeAuthentication(stored.proof, { initial: true });
    return;
  }
  requireAuthentication(stored.payload ? "expired" : "initial");
};

const classifyFile = (file) => {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (["mp4", "mov", "m4v", "webm", "ogv"].includes(extension)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac"].includes(extension)) return "audio";
  return null;
};

const readMediaDuration = (url, kind) =>
  new Promise((resolve, reject) => {
    const media = document.createElement(kind);
    const release = () => {
      media.removeAttribute("src");
      media.load();
    };
    const timeout = window.setTimeout(() => {
      release();
      reject(new Error("Media metadata timed out."));
    }, 12_000);

    media.preload = "metadata";
    media.addEventListener(
      "loadedmetadata",
      () => {
        window.clearTimeout(timeout);
        const duration = media.duration;
        release();
        if (Number.isFinite(duration) && duration > 0) resolve(duration);
        else reject(new Error("The file does not report a usable duration."));
      },
      { once: true }
    );
    media.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        release();
        reject(new Error("The browser could not read this media file."));
      },
      { once: true }
    );
    media.src = url;
  });

const importFiles = async (fileList) => {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  let imported = 0;
  let rejected = 0;
  announce(`Reading ${files.length} local ${files.length === 1 ? "file" : "files"}…`);

  for (const file of files) {
    const kind = classifyFile(file);
    if (!kind) {
      rejected += 1;
      continue;
    }

    const url = URL.createObjectURL(file);
    try {
      const duration = await readMediaDuration(url, kind);
      state.media.push({
        id: `media-${nextMediaId++}`,
        file,
        kind,
        name: file.name,
        duration,
        url,
      });
      imported += 1;
    } catch (error) {
      URL.revokeObjectURL(url);
      rejected += 1;
    }
  }

  renderMediaBin();
  if (imported && rejected) {
    announce(`Imported ${imported} local ${imported === 1 ? "file" : "files"}; ${rejected} could not be read.`);
  } else if (imported) {
    announce(`Imported ${imported} local ${imported === 1 ? "file" : "files"}.`);
  } else {
    announce("No files were imported. Choose readable video or audio files.");
  }
  if (elements.mediaInput) elements.mediaInput.value = "";
};

const renderMediaBin = () => {
  if (!elements.mediaBin || !elements.mediaTemplate) return;
  elements.mediaBin.querySelectorAll("[data-media-id]").forEach((item) => item.remove());
  if (elements.mediaEmpty) elements.mediaEmpty.hidden = state.media.length > 0;
  if (elements.mediaCount) {
    elements.mediaCount.textContent = `${state.media.length} ${state.media.length === 1 ? "item" : "items"}`;
  }

  for (const item of state.media) {
    const fragment = elements.mediaTemplate.content.cloneNode(true);
    const row = fragment.querySelector("[data-media-id]");
    const selectButton = fragment.querySelector("[data-select-media]");
    const addButton = fragment.querySelector("[data-insert-media]");
    row.dataset.mediaId = item.id;
    row.dataset.kind = item.kind;
    row.classList.toggle("is-selected", state.selectedMediaId === item.id);
    row.setAttribute("aria-label", `${item.name}, ${item.kind}, ${formatTime(item.duration)}`);
    fragment.querySelector("[data-media-name]").textContent = item.name;
    fragment.querySelector("[data-media-meta]").textContent = `${item.kind} · ${formatTime(item.duration)}`;
    fragment.querySelector(".media-item__icon").style.backgroundImage = `url("../assets/app-icons/ico/${
      item.kind === "video" ? "camera3_vid.ico" : "loudspeaker_rays.ico"
    }")`;
    selectButton.title = item.name;
    selectButton.addEventListener("click", () => {
      state.selectedMediaId = item.id;
      renderMediaBin();
      announce(`${item.name} selected. Press Add or Enter to place it at the playhead.`);
      elements.mediaBin.querySelector(`[data-media-id="${item.id}"] [data-select-media]`)?.focus();
    });
    selectButton.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      addMediaAtPlayhead(item.id);
    });
    addButton.setAttribute("aria-label", `Add ${item.name} at the playhead`);
    addButton.addEventListener("click", () => addMediaAtPlayhead(item.id));
    row.addEventListener("dragstart", (event) => setDragData(event, DRAG_TYPES.media, item.id));
    row.addEventListener("dragend", () => {
      dragPayload = null;
      clearDragStyles();
    });
    elements.mediaBin.append(fragment);
  }
};

const intervalsForTier = (tierId, excludeClipId = null) =>
  state.clips
    .filter((clip) => clip.tierId === tierId && clip.id !== excludeClipId)
    .map((clip) => ({ start: clip.start, end: clip.start + clipDuration(clip) }))
    .sort((left, right) => left.start - right.start);

const findValidStart = (tierId, desiredStart, duration, excludeClipId = null) => {
  const desired = Math.max(0, desiredStart);
  const intervals = intervalsForTier(tierId, excludeClipId);
  const candidates = [];
  let gapStart = 0;

  for (const interval of intervals) {
    if (interval.start - gapStart >= duration) {
      candidates.push(clamp(desired, gapStart, interval.start - duration));
    }
    gapStart = Math.max(gapStart, interval.end);
  }
  candidates.push(Math.max(gapStart, desired));
  return roundTime(
    candidates.reduce((closest, candidate) =>
      Math.abs(candidate - desired) < Math.abs(closest - desired) ? candidate : closest
    )
  );
};

const firstTierForKind = (kind) => state.tiers.find((tier) => tier.kind === kind) || null;

const addMediaAtPlayhead = (mediaId) => {
  const item = state.media.find((candidate) => candidate.id === mediaId);
  const tier = item ? firstTierForKind(item.kind) : null;
  if (!item || !tier) return;
  addClip(item, tier.id, state.playhead);
};

const addClip = (media, tierId, desiredStart) => {
  const tier = state.tiers.find((candidate) => candidate.id === tierId);
  if (!tier || tier.kind !== media.kind) {
    announce(`${media.name} is ${media.kind}; choose a ${media.kind} tier.`);
    return false;
  }
  const start = findValidStart(tierId, desiredStart, media.duration);
  const clip = {
    id: `clip-${nextClipId++}`,
    mediaId: media.id,
    kind: media.kind,
    sourceStart: 0,
    sourceEnd: media.duration,
    start,
    tierId,
  };
  state.clips.push(clip);
  state.playhead = start;
  renderTimeline();
  announce(
    `${media.name} added to ${tier.label} at ${formatTime(start)}${
      Math.abs(start - desiredStart) > 0.01 ? "; snapped to avoid an overlap" : ""
    }.`
  );
  requestAnimationFrame(() =>
    document.querySelector(`[data-clip-id="${clip.id}"]`)?.focus({ preventScroll: true })
  );
  return true;
};

const moveClip = (clipId, tierId, desiredStart) => {
  const clip = state.clips.find((candidate) => candidate.id === clipId);
  const tier = state.tiers.find((candidate) => candidate.id === tierId);
  const media = clip ? mediaForClip(clip) : null;
  if (!clip || !media || !tier) return false;
  if (tier.kind !== clip.kind) {
    announce(`${media.name} cannot move to ${tier.label}; it accepts ${tier.kind} clips.`);
    return false;
  }
  const start = findValidStart(tier.id, desiredStart, clipDuration(clip), clip.id);
  clip.start = start;
  clip.tierId = tier.id;
  state.playhead = start;
  renderTimeline();
  announce(
    `${media.name} moved to ${tier.label} at ${formatTime(start)}${
      Math.abs(start - desiredStart) > 0.01 ? "; snapped to avoid an overlap" : ""
    }.`
  );
  requestAnimationFrame(() =>
    document.querySelector(`[data-clip-id="${clip.id}"]`)?.focus({ preventScroll: true })
  );
  return true;
};

const moveClipToAdjacentTier = (clip, direction) => {
  const compatible = state.tiers.filter((tier) => tier.kind === clip.kind);
  const index = compatible.findIndex((tier) => tier.id === clip.tierId);
  const target = compatible[index + direction];
  if (!target) {
    announce(`No ${clip.kind} tier is available in that direction.`);
    return;
  }
  moveClip(clip.id, target.id, clip.start);
};

const previousAndNextClip = (clip) => {
  const others = state.clips
    .filter((candidate) => candidate.tierId === clip.tierId && candidate.id !== clip.id)
    .sort((left, right) => left.start - right.start);
  return {
    previous: others.filter((candidate) => candidate.start < clip.start).at(-1) || null,
    next: others.find((candidate) => candidate.start >= clip.start) || null,
  };
};

const trimClip = (clipId, edge, delta) => {
  const clip = state.clips.find((candidate) => candidate.id === clipId);
  const media = clip ? mediaForClip(clip) : null;
  if (!clip || !media) return;
  const { previous, next } = previousAndNextClip(clip);

  if (edge === "start") {
    const earliestTimelineStart = previous
      ? previous.start + clipDuration(previous)
      : 0;
    const earliestFromSource = clip.start - clip.sourceStart;
    const latestStart = clip.start + clipDuration(clip) - MIN_ITEM_DURATION;
    const requestedStart = clip.start + delta;
    const newStart = clamp(
      requestedStart,
      Math.max(earliestTimelineStart, earliestFromSource),
      latestStart
    );
    const applied = newStart - clip.start;
    clip.start = roundTime(newStart);
    clip.sourceStart = roundTime(clip.sourceStart + applied);
  } else {
    const nextStart = next ? next.start : Number.POSITIVE_INFINITY;
    const maximumDuration = Math.min(
      media.duration - clip.sourceStart,
      nextStart - clip.start
    );
    const newDuration = clamp(clipDuration(clip) + delta, MIN_ITEM_DURATION, maximumDuration);
    clip.sourceEnd = roundTime(clip.sourceStart + newDuration);
  }

  renderTimeline();
  announce(
    `${media.name} ${edge} edge trimmed; clip duration ${formatTime(clipDuration(clip))}.`
  );
  requestAnimationFrame(() =>
    document
      .querySelector(`[data-clip-id="${clip.id}"] [data-trim="${edge}"]`)
      ?.focus({ preventScroll: true })
  );
};

const deleteClip = (clipId) => {
  const index = state.clips.findIndex((clip) => clip.id === clipId);
  if (index === -1) return;
  const [clip] = state.clips.splice(index, 1);
  const name = mediaForClip(clip)?.name || "Clip";
  renderTimeline();
  announce(`${name} deleted from the timeline.`);
};

const bindPointerResize = (handle, onDelta) => {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    let previousSeconds = 0;
    handle.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      if (document.body.dataset.videoEditorAuthState !== AUTHENTICATED_STATE) {
        finish();
        return;
      }
      const totalSeconds = roundTime((moveEvent.clientX - startX) / state.pixelsPerSecond);
      const incremental = totalSeconds - previousSeconds;
      if (Math.abs(incremental) < 0.01) return;
      previousSeconds = totalSeconds;
      onDelta(incremental);
    };
    const finish = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish, { once: true });
    document.addEventListener("pointercancel", finish, { once: true });
  });
};

const renderClip = (clip, track) => {
  const media = mediaForClip(clip);
  if (!media || !elements.clipTemplate) return;
  const fragment = elements.clipTemplate.content.cloneNode(true);
  const item = fragment.querySelector("[data-clip-id]");
  item.dataset.clipId = clip.id;
  item.dataset.kind = clip.kind;
  item.style.left = `${clip.start * state.pixelsPerSecond}px`;
  item.style.width = `${Math.max(clipDuration(clip) * state.pixelsPerSecond, 34)}px`;
  item.setAttribute(
    "aria-label",
    `${media.name}, ${formatTime(clipDuration(clip))}, starts ${formatTime(clip.start)}. Arrow keys move; Delete removes.`
  );
  item.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown Delete");
  item.title = media.name;
  fragment.querySelector("[data-clip-label]").textContent = media.name;
  const deleteButton = fragment.querySelector("[data-delete-clip]");
  deleteButton.setAttribute("aria-label", `Delete ${media.name}`);
  deleteButton.addEventListener("click", () => deleteClip(clip.id));

  for (const handle of fragment.querySelectorAll("[data-trim]")) {
    const edge = handle.dataset.trim;
    handle.setAttribute("aria-label", `Trim ${edge} of ${media.name}`);
    handle.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight");
    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      event.stopPropagation();
      trimClip(clip.id, edge, event.key === "ArrowLeft" ? -KEYBOARD_STEP : KEYBOARD_STEP);
    });
    bindPointerResize(handle, (delta) => trimClip(clip.id, edge, delta));
  }

  item.addEventListener("keydown", (event) => {
    if (event.target !== item) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteClip(clip.id);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveClip(
        clip.id,
        clip.tierId,
        clip.start + (event.key === "ArrowLeft" ? -KEYBOARD_STEP : KEYBOARD_STEP)
      );
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      moveClipToAdjacentTier(clip, event.key === "ArrowUp" ? -1 : 1);
    }
  });
  item.addEventListener("dragstart", (event) => {
    if (event.target.closest("button")) {
      event.preventDefault();
      return;
    }
    setDragData(event, DRAG_TYPES.clip, clip.id);
  });
  item.addEventListener("dragend", () => {
    dragPayload = null;
    clearDragStyles();
  });
  track.append(fragment);
};

const timeForPointer = (event, track) => {
  const bounds = track.getBoundingClientRect();
  return roundTime(clamp((event.clientX - bounds.left) / state.pixelsPerSecond, 0, projectDuration()));
};

const bindTrack = (track, tier) => {
  track.addEventListener("dragover", (event) => {
    const payload = getDragData(event);
    if (!payload || ![DRAG_TYPES.media, DRAG_TYPES.clip].includes(payload.type)) return;
    event.preventDefault();
    const kind =
      payload.type === DRAG_TYPES.media
        ? state.media.find((item) => item.id === payload.id)?.kind
        : state.clips.find((clip) => clip.id === payload.id)?.kind;
    track.classList.toggle("is-drop-target", kind === tier.kind);
    track.classList.toggle("is-drop-invalid", kind !== tier.kind);
    if (event.dataTransfer) event.dataTransfer.dropEffect = payload.type === DRAG_TYPES.media ? "copy" : "move";
  });
  track.addEventListener("dragleave", () =>
    track.classList.remove("is-drop-target", "is-drop-invalid")
  );
  track.addEventListener("drop", (event) => {
    event.preventDefault();
    const payload = getDragData(event);
    const desiredStart = timeForPointer(event, track);
    clearDragStyles();
    if (payload?.type === DRAG_TYPES.media) {
      const media = state.media.find((item) => item.id === payload.id);
      if (media) addClip(media, tier.id, desiredStart);
    } else if (payload?.type === DRAG_TYPES.clip) {
      moveClip(payload.id, tier.id, desiredStart);
    }
    dragPayload = null;
  });
  track.addEventListener("click", (event) => {
    if (event.target.closest("[data-clip-id], button")) return;
    setPlayhead(timeForPointer(event, track), true);
  });
  track.addEventListener("keydown", (event) => {
    if (event.target !== track || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    const media = state.media.find((item) => item.id === state.selectedMediaId);
    if (!media) {
      announce("Select a media-bin item before adding it with the keyboard.");
      return;
    }
    addClip(media, tier.id, state.playhead);
  });
};

const addTier = (kind) => {
  const count = state.tiers.filter((tier) => tier.kind === kind).length + 1;
  const tier = { id: `${kind}-${count}`, kind, label: `${kind === "video" ? "Video" : "Audio"} ${count}` };
  if (kind === "video") {
    const lastVideo = state.tiers.reduce(
      (position, candidate, index) => (candidate.kind === "video" ? index : position),
      -1
    );
    state.tiers.splice(lastVideo + 1, 0, tier);
  } else {
    state.tiers.push(tier);
  }
  renderTimeline();
  announce(`${tier.label} added.`);
  requestAnimationFrame(() =>
    document.querySelector(`.timeline-track[data-tier-id="${tier.id}"]`)?.focus()
  );
};

const renderTiers = () => {
  if (!elements.timelineTiers || !elements.tierTemplate) return;
  elements.timelineTiers.replaceChildren();
  for (const tier of state.tiers) {
    const fragment = elements.tierTemplate.content.cloneNode(true);
    const section = fragment.querySelector(".timeline-tier");
    const label = fragment.querySelector("[data-tier-label]");
    const track = fragment.querySelector(".timeline-track");
    const labelId = `${tier.id}-label`;
    section.dataset.tierId = tier.id;
    section.dataset.kind = tier.kind;
    section.setAttribute("aria-labelledby", labelId);
    label.id = labelId;
    label.textContent = tier.label;
    track.dataset.tierId = tier.id;
    track.dataset.kind = tier.kind;
    track.dataset.testid = `timeline-tier-${tier.id}`;
    track.setAttribute("aria-label", `${tier.label} clips`);
    fragment.querySelector("[data-track-empty]").textContent = `Drop ${tier.kind} clips here`;
    bindTrack(track, tier);
    for (const clip of state.clips
      .filter((candidate) => candidate.tierId === tier.id)
      .sort((left, right) => left.start - right.start)) {
      renderClip(clip, track);
    }
    elements.timelineTiers.append(fragment);
  }
};

const renderRuler = () => {
  if (!elements.timelineRuler || !elements.timelineCanvas) return;
  const duration = projectDuration();
  const width = Math.ceil(duration * state.pixelsPerSecond);
  elements.timelineCanvas.style.setProperty("--timeline-content-width", `${width}px`);
  elements.timelineRuler.style.backgroundSize = `${state.pixelsPerSecond}px 100%, ${
    state.pixelsPerSecond / 4
  }px 10px`;
  elements.timelineRuler.replaceChildren();
  const interval = state.pixelsPerSecond >= 48 ? 5 : 10;
  for (let second = 0; second <= duration; second += interval) {
    const label = document.createElement("span");
    label.className = "timeline-ruler__label";
    label.style.left = `${second * state.pixelsPerSecond}px`;
    label.textContent = formatTime(second).slice(0, 5);
    elements.timelineRuler.append(label);
  }
};

const addEffect = (type) => {
  const definition = EFFECTS[type];
  if (!definition) return;
  const effect = {
    id: `effect-${nextEffectId++}`,
    type,
    start: roundTime(state.playhead),
    duration: EFFECT_DURATION,
    tabId: `effect-tab-${type}`,
  };
  state.effects.push(effect);
  renderTimeline();
  announce(`${definition.label} effect added at ${formatTime(effect.start)} for three seconds.`);
  requestAnimationFrame(() =>
    document.querySelector(`[data-effect-item-id="${effect.id}"]`)?.focus({ preventScroll: true })
  );
};

const moveEffect = (effectId, desiredStart) => {
  const effect = state.effects.find((candidate) => candidate.id === effectId);
  if (!effect) return;
  effect.start = roundTime(Math.max(0, desiredStart));
  state.playhead = effect.start;
  renderTimeline();
  announce(`${EFFECTS[effect.type].label} effect moved to ${formatTime(effect.start)}.`);
  requestAnimationFrame(() =>
    document.querySelector(`[data-effect-item-id="${effect.id}"]`)?.focus({ preventScroll: true })
  );
};

const resizeEffect = (effectId, edge, delta) => {
  const effect = state.effects.find((candidate) => candidate.id === effectId);
  if (!effect) return;
  if (edge === "start") {
    const newStart = clamp(effect.start + delta, 0, effect.start + effect.duration - MIN_ITEM_DURATION);
    const applied = newStart - effect.start;
    effect.start = roundTime(newStart);
    effect.duration = roundTime(effect.duration - applied);
  } else {
    effect.duration = roundTime(Math.max(MIN_ITEM_DURATION, effect.duration + delta));
  }
  renderTimeline();
  announce(`${EFFECTS[effect.type].label} effect resized to ${formatTime(effect.duration)}.`);
  requestAnimationFrame(() =>
    document
      .querySelector(`[data-effect-item-id="${effect.id}"] [data-resize-effect="${edge}"]`)
      ?.focus({ preventScroll: true })
  );
};

const deleteEffect = (effectId) => {
  const index = state.effects.findIndex((effect) => effect.id === effectId);
  if (index === -1) return;
  const [effect] = state.effects.splice(index, 1);
  renderTimeline();
  announce(`${EFFECTS[effect.type].label} effect deleted from the timeline.`);
};

const renderEffects = () => {
  if (!elements.effectsTrack || !elements.effectTemplate) return;
  elements.effectsTrack.querySelectorAll("[data-effect-item-id]").forEach((item) => item.remove());
  for (const effect of state.effects.slice().sort((left, right) => left.start - right.start)) {
    const definition = EFFECTS[effect.type];
    const fragment = elements.effectTemplate.content.cloneNode(true);
    const item = fragment.querySelector("[data-effect-item-id]");
    item.dataset.effectItemId = effect.id;
    item.dataset.effect = effect.type;
    item.style.left = `${effect.start * state.pixelsPerSecond}px`;
    item.style.width = `${Math.max(effect.duration * state.pixelsPerSecond, 52)}px`;
    item.setAttribute(
      "aria-label",
      `${definition.label} effect, ${formatTime(effect.duration)}, starts ${formatTime(effect.start)}. Arrow keys move; Delete removes.`
    );
    item.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Delete");
    fragment.querySelector("[data-effect-item-icon]").src = definition.icon;
    fragment.querySelector("[data-effect-item-label]").textContent = definition.label;
    const deleteButton = fragment.querySelector("[data-delete-effect]");
    deleteButton.setAttribute("aria-label", `Delete ${definition.label} effect`);
    deleteButton.addEventListener("click", () => deleteEffect(effect.id));
    for (const handle of fragment.querySelectorAll("[data-resize-effect]")) {
      const edge = handle.dataset.resizeEffect;
      handle.setAttribute("aria-label", `Resize ${edge} of ${definition.label} effect`);
      handle.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight");
      handle.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.stopPropagation();
        resizeEffect(effect.id, edge, event.key === "ArrowLeft" ? -KEYBOARD_STEP : KEYBOARD_STEP);
      });
      bindPointerResize(handle, (delta) => resizeEffect(effect.id, edge, delta));
    }
    item.addEventListener("keydown", (event) => {
      if (event.target !== item) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteEffect(effect.id);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        moveEffect(effect.id, effect.start + (event.key === "ArrowLeft" ? -KEYBOARD_STEP : KEYBOARD_STEP));
      }
    });
    item.addEventListener("dragstart", (event) => {
      if (event.target.closest("button")) {
        event.preventDefault();
        return;
      }
      setDragData(event, DRAG_TYPES.effect, effect.id);
    });
    item.addEventListener("dragend", () => {
      dragPayload = null;
      clearDragStyles();
    });
    elements.effectsTrack.append(fragment);
  }
};

const updateTimeDisplay = () => {
  const duration = projectDuration();
  state.playhead = clamp(state.playhead, 0, duration);
  elements.timelineCanvas?.style.setProperty(
    "--playhead-x",
    `${state.playhead * state.pixelsPerSecond}px`
  );
  if (elements.scrubber) {
    elements.scrubber.max = String(duration);
    elements.scrubber.value = String(state.playhead);
  }
  if (elements.currentTime) elements.currentTime.textContent = formatTime(state.playhead);
  if (elements.totalDuration) elements.totalDuration.textContent = formatTime(duration);
};

const activeClipsAtPlayhead = (kind) =>
  state.clips.filter(
    (clip) =>
      clip.kind === kind &&
      state.playhead >= clip.start &&
      state.playhead < clip.start + clipDuration(clip)
  );

const setMediaTime = (mediaElement, time) => {
  if (!Number.isFinite(time)) return;
  const apply = () => {
    try {
      if (Math.abs(mediaElement.currentTime - time) > 0.12) mediaElement.currentTime = time;
    } catch (error) {
      // The next loadedmetadata event retries the local seek.
    }
  };
  if (mediaElement.readyState >= 1) apply();
  else mediaElement.addEventListener("loadedmetadata", apply, { once: true });
};

const syncPreview = () => {
  if (!elements.previewVideo || !elements.previewEmpty || !elements.previewName) return;
  const activeVideoClips = activeClipsAtPlayhead("video");
  const videoTierOrder = state.tiers.filter((tier) => tier.kind === "video").map((tier) => tier.id);
  const topVideo = activeVideoClips.sort(
    (left, right) => videoTierOrder.indexOf(right.tierId) - videoTierOrder.indexOf(left.tierId)
  )[0];
  const videoMedia = topVideo ? mediaForClip(topVideo) : null;

  if (topVideo && videoMedia) {
    if (elements.previewVideo.dataset.clipId !== topVideo.id) {
      elements.previewVideo.src = videoMedia.url;
      elements.previewVideo.dataset.clipId = topVideo.id;
    }
    elements.previewVideo.hidden = false;
    elements.previewEmpty.hidden = true;
    elements.previewName.textContent = videoMedia.name;
    setMediaTime(
      elements.previewVideo,
      topVideo.sourceStart + state.playhead - topVideo.start
    );
    if (state.playing) elements.previewVideo.play().catch(() => {});
    else elements.previewVideo.pause();
  } else {
    elements.previewVideo.pause();
    elements.previewVideo.hidden = true;
    elements.previewVideo.removeAttribute("data-clip-id");
  }

  const activeAudio = activeClipsAtPlayhead("audio");
  const activeIds = new Set(activeAudio.map((clip) => clip.id));
  for (const [clipId, player] of audioPlayers) {
    if (activeIds.has(clipId)) continue;
    player.pause();
    player.remove();
    audioPlayers.delete(clipId);
  }
  for (const clip of activeAudio) {
    const media = mediaForClip(clip);
    if (!media) continue;
    let player = audioPlayers.get(clip.id);
    if (!player) {
      player = document.createElement("audio");
      player.src = media.url;
      player.preload = "auto";
      player.dataset.audioClipId = clip.id;
      elements.audioMix?.append(player);
      audioPlayers.set(clip.id, player);
    }
    setMediaTime(player, clip.sourceStart + state.playhead - clip.start);
    if (state.playing) player.play().catch(() => {});
    else player.pause();
  }

  if (!videoMedia) {
    elements.previewEmpty.hidden = false;
    const message = elements.previewEmpty.querySelector("span");
    if (activeAudio.length) {
      const names = activeAudio.map((clip) => mediaForClip(clip)?.name).filter(Boolean);
      if (message) message.textContent = `Audio mix: ${names.join(", ")}`;
      elements.previewName.textContent = names.join(", ") || "Audio at playhead";
    } else {
      if (message) message.textContent = "Nothing at the playhead";
      elements.previewName.textContent = "No active clip";
    }
  }
};

const setPlayhead = (value, shouldAnnounce = false) => {
  state.playhead = roundTime(clamp(value, 0, projectDuration()));
  updateTimeDisplay();
  syncPreview();
  if (shouldAnnounce) announce(`Playhead moved to ${formatTime(state.playhead)}.`);
};

const pausePlayback = () => {
  state.playing = false;
  cancelAnimationFrame(state.animationFrame);
  elements.previewVideo?.pause();
  audioPlayers.forEach((player) => player.pause());
  if (elements.playButton) {
    elements.playButton.setAttribute("aria-label", "Play");
    elements.playButton.setAttribute("aria-pressed", "false");
    elements.playButton.querySelector("span").textContent = "▶";
  }
};

const playbackTick = (now) => {
  if (!state.playing) return;
  const nextPlayhead = (now - state.playbackStartedAt) / 1000;
  if (nextPlayhead >= projectDuration()) {
    setPlayhead(projectDuration());
    pausePlayback();
    announce("Playback reached the end of the timeline.");
    return;
  }
  setPlayhead(nextPlayhead);
  state.animationFrame = requestAnimationFrame(playbackTick);
};

const togglePlayback = () => {
  if (state.playing) {
    pausePlayback();
    announce(`Playback paused at ${formatTime(state.playhead)}.`);
    return;
  }
  if (state.playhead >= projectDuration()) state.playhead = 0;
  state.playing = true;
  state.playbackStartedAt = performance.now() - state.playhead * 1000;
  if (elements.playButton) {
    elements.playButton.setAttribute("aria-label", "Pause");
    elements.playButton.setAttribute("aria-pressed", "true");
    elements.playButton.querySelector("span").textContent = "Ⅱ";
  }
  syncPreview();
  state.animationFrame = requestAnimationFrame(playbackTick);
  announce(`Playback started at ${formatTime(state.playhead)}.`);
};

const renderTimeline = () => {
  renderRuler();
  renderTiers();
  renderEffects();
  updateTimeDisplay();
  syncPreview();
};

const focusTab = (type) => {
  document.querySelector(`[data-effect-tab][data-effect="${type}"]`)?.focus();
};

const activateTab = (type, shouldFocus = false) => {
  if (!state.openTabs.includes(type)) return;
  state.activeTab = type;
  renderTabs();
  if (shouldFocus) requestAnimationFrame(() => focusTab(type));
};

const openEffectTab = (type) => {
  const definition = EFFECTS[type];
  if (!definition) return;
  if (!state.openTabs.includes(type)) state.openTabs.push(type);
  state.closedTabs = state.closedTabs.filter((candidate) => candidate !== type);
  state.activeTab = type;
  renderTabs();
  announce(`${definition.label} effect editor opened.`);
  requestAnimationFrame(() => focusTab(type));
};

const closeEffectTab = (type) => {
  const index = state.openTabs.indexOf(type);
  if (index === -1) return;
  state.openTabs.splice(index, 1);
  state.closedTabs = state.closedTabs.filter((candidate) => candidate !== type);
  state.closedTabs.push(type);
  if (state.activeTab === type) {
    state.activeTab = state.openTabs[index] || state.openTabs[index - 1] || null;
  }
  renderTabs();
  announce(`${EFFECTS[type].label} effect editor closed. Use Reopen closed tab to restore it.`);
  requestAnimationFrame(() => {
    if (state.activeTab) focusTab(state.activeTab);
    else elements.reopenTab?.focus();
  });
};

const reorderTab = (type, targetIndex) => {
  const currentIndex = state.openTabs.indexOf(type);
  if (currentIndex === -1) return;
  const boundedTarget = clamp(targetIndex, 0, state.openTabs.length - 1);
  state.openTabs.splice(currentIndex, 1);
  state.openTabs.splice(boundedTarget, 0, type);
  renderTabs();
  announce(`${EFFECTS[type].label} tab moved to position ${boundedTarget + 1}.`);
  requestAnimationFrame(() => focusTab(type));
};

const renderTabs = () => {
  if (!elements.tabList || !elements.tabTemplate) return;
  elements.tabList.replaceChildren();
  state.openTabs.forEach((type, index) => {
    const definition = EFFECTS[type];
    const fragment = elements.tabTemplate.content.cloneNode(true);
    const wrapper = fragment.querySelector("[data-effect-tab-wrapper]");
    const tab = fragment.querySelector("[data-effect-tab]");
    const close = fragment.querySelector("[data-close-effect-tab]");
    wrapper.dataset.effect = type;
    wrapper.classList.toggle("is-active", state.activeTab === type);
    tab.id = `effect-tab-${type}`;
    tab.dataset.effect = type;
    tab.setAttribute("aria-controls", `effect-panel-${type}`);
    tab.setAttribute("aria-selected", String(state.activeTab === type));
    tab.setAttribute("tabindex", state.activeTab === type ? "0" : "-1");
    tab.setAttribute("aria-keyshortcuts", "Control+ArrowLeft Control+ArrowRight Delete");
    fragment.querySelector("[data-effect-tab-icon]").src = definition.icon;
    fragment.querySelector("[data-effect-tab-label]").textContent = definition.label;
    fragment.querySelector("[data-close-effect-tab-label]").textContent = `Close ${definition.label} tab`;
    tab.addEventListener("click", () => activateTab(type));
    tab.addEventListener("keydown", (event) => {
      if (event.key === "Delete") {
        event.preventDefault();
        closeEffectTab(type);
      } else if (event.ctrlKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        reorderTab(type, index + (event.key === "ArrowLeft" ? -1 : 1));
      } else if (!event.ctrlKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        const nextIndex = (index + (event.key === "ArrowLeft" ? -1 : 1) + state.openTabs.length) % state.openTabs.length;
        activateTab(state.openTabs[nextIndex], true);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        activateTab(event.key === "Home" ? state.openTabs[0] : state.openTabs.at(-1), true);
      }
    });
    close.addEventListener("click", () => closeEffectTab(type));
    wrapper.addEventListener("dragstart", (event) => setDragData(event, DRAG_TYPES.tab, type));
    wrapper.addEventListener("dragover", (event) => {
      const payload = getDragData(event);
      if (payload?.type !== DRAG_TYPES.tab || payload.id === type) return;
      event.preventDefault();
      wrapper.classList.add("is-drag-target");
    });
    wrapper.addEventListener("dragleave", () => wrapper.classList.remove("is-drag-target"));
    wrapper.addEventListener("drop", (event) => {
      event.preventDefault();
      const payload = getDragData(event);
      clearDragStyles();
      if (payload?.type === DRAG_TYPES.tab) reorderTab(payload.id, index);
      dragPayload = null;
    });
    wrapper.addEventListener("dragend", () => {
      dragPayload = null;
      clearDragStyles();
    });
    elements.tabList.append(fragment);
  });

  if (elements.reopenTab) elements.reopenTab.disabled = state.closedTabs.length === 0;
  if (elements.editorEmpty) elements.editorEmpty.hidden = Boolean(state.activeTab);
  document.querySelectorAll("[data-effect-editor]").forEach((panel) => {
    const active = panel.dataset.effectEditor === state.activeTab;
    panel.hidden = !active;
    panel.setAttribute("aria-hidden", String(!active));
  });
};

const bindStaticControls = () => {
  elements.importButton?.addEventListener("click", () => elements.mediaInput?.click());
  elements.mediaInput?.addEventListener("change", (event) => importFiles(event.target.files));
  elements.dropZone?.addEventListener("click", () => elements.mediaInput?.click());
  elements.dropZone?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    elements.mediaInput?.click();
  });
  for (const eventName of ["dragenter", "dragover"]) {
    elements.dropZone?.addEventListener(eventName, (event) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      elements.dropZone.classList.add("is-drag-over");
      event.dataTransfer.dropEffect = "copy";
    });
  }
  for (const eventName of ["dragleave", "dragend"]) {
    elements.dropZone?.addEventListener(eventName, () =>
      elements.dropZone.classList.remove("is-drag-over")
    );
  }
  elements.dropZone?.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-drag-over");
    importFiles(event.dataTransfer?.files);
  });

  document.querySelectorAll("[data-add-tier]").forEach((button) =>
    button.addEventListener("click", () => addTier(button.dataset.addTier))
  );
  document.querySelectorAll("[data-effect-tab-target]").forEach((button) =>
    button.addEventListener("click", () => openEffectTab(button.dataset.effect))
  );
  document.querySelectorAll("[data-add-effect]").forEach((button) =>
    button.addEventListener("click", () => addEffect(button.dataset.addEffect))
  );
  elements.reopenTab?.addEventListener("click", () => {
    const type = state.closedTabs.at(-1);
    if (type) openEffectTab(type);
  });
  elements.playButton?.addEventListener("click", togglePlayback);
  elements.scrubber?.addEventListener("input", (event) => {
    pausePlayback();
    setPlayhead(Number(event.target.value));
  });
  elements.scrubber?.addEventListener("change", () =>
    announce(`Playhead moved to ${formatTime(state.playhead)}.`)
  );
  elements.timelineScale?.addEventListener("input", (event) => {
    state.pixelsPerSecond = Number(event.target.value);
    renderTimeline();
    announce(`Timeline scale set to ${state.pixelsPerSecond} pixels per second.`);
  });
  elements.timelineRuler?.addEventListener("click", (event) =>
    setPlayhead(timeForPointer(event, elements.timelineRuler), true)
  );
  elements.timelineScroll?.addEventListener("keydown", (event) => {
    if (event.target !== elements.timelineScroll) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      setPlayhead(
        state.playhead + (event.key === "ArrowLeft" ? -KEYBOARD_STEP : KEYBOARD_STEP),
        true
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setPlayhead(event.key === "Home" ? 0 : projectDuration(), true);
    }
  });

  elements.effectsTrack?.addEventListener("dragover", (event) => {
    const payload = getDragData(event);
    if (payload?.type !== DRAG_TYPES.effect) return;
    event.preventDefault();
    elements.effectsTrack.classList.add("is-drop-target");
  });
  elements.effectsTrack?.addEventListener("dragleave", () =>
    elements.effectsTrack.classList.remove("is-drop-target")
  );
  elements.effectsTrack?.addEventListener("drop", (event) => {
    event.preventDefault();
    const payload = getDragData(event);
    clearDragStyles();
    if (payload?.type === DRAG_TYPES.effect) {
      moveEffect(payload.id, timeForPointer(event, elements.effectsTrack));
    }
    dragPayload = null;
  });
  elements.effectsTrack?.addEventListener("click", (event) => {
    if (event.target.closest("[data-effect-item-id], button")) return;
    setPlayhead(timeForPointer(event, elements.effectsTrack), true);
  });

  window.addEventListener("beforeunload", () => {
    pausePlayback();
    clearAuthenticationTimers();
    authenticationController?.abort();
    for (const media of state.media) URL.revokeObjectURL(media.url);
  });
};

if (elements.app) {
  elements.previewVideo.muted = true;
  bindStaticControls();
  renderMediaBin();
  renderTabs();
  renderTimeline();
  initializeAuthentication();
}
