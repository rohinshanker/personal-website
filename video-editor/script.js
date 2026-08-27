const MIN_ITEM_DURATION = 0.25;
const DEFAULT_PROJECT_DURATION = 30;
const EFFECT_DURATION = 3;
const KEYBOARD_STEP = 0.25;
const FRAME_DIMENSION_MIN = 16;
const FRAME_DIMENSION_MAX = 7680;
const PREVIEW_SPLIT_MIN = 25;
const PREVIEW_SPLIT_MAX = 75;
const PREVIEW_SPLIT_STEP = 5;
const STANDARD_PREVIEW_MIN = 190;
const COMPACT_STANDARD_PREVIEW_MIN = 160;
const STANDARD_TIMELINE_MIN = 160;
const SIDE_BY_SIDE_PREVIEW_MIN = 180;
const SIDE_BY_SIDE_TIMELINE_MIN = 200;
const DEFAULT_PREVIEW_SPLIT = window.innerHeight <= 680 ? 39 : 44;
const TIMELINE_LABEL_RESERVE = 42;
const MEDIA_PANEL_MIN = 220;
const MEDIA_PANEL_MAX = 360;
const MEDIA_PANEL_DEFAULT = 260;
const EFFECTS_PANEL_MIN = 240;
const EFFECTS_PANEL_MAX = 420;
const EFFECTS_PANEL_DEFAULT = 300;
const SIDE_PANEL_KEYBOARD_STEP = 16;
const COMPOSE_PANEL_MIN = 420;
const AUDIO_ANALYSIS_MAX_FILE_BYTES = 64 * 1024 * 1024;
const AUDIO_ANALYSIS_MAX_DURATION = 10 * 60;
const AUDIO_ANALYSIS_MAX_DECODED_BYTES = 256 * 1024 * 1024;
const GUIDEPOST_NUDGE = 0.05;
const GUIDEPOST_LARGE_NUDGE = 0.25;
const GUIDEPOST_FLASH_DURATION_MS = 110;
const GUIDEPOST_COLORS = Object.freeze([
  "#ff3b30",
  "#00a6ff",
  "#35c759",
  "#ff9500",
  "#af52de",
  "#00b8a9",
]);
const SOUND_EFFECT_SAMPLE_RATE = 22050;
const CLICK_SOUND_DURATION = 0.12;
const TYPING_SOUND_DURATION = 1.2;
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
    timelineInsertable: true,
  }),
  "windows-98": Object.freeze({
    label: "Windows 98",
    color: "navy",
    icon: "../assets/app-icons/ico/windows.ico",
    timelineInsertable: true,
  }),
  transitions: Object.freeze({
    label: "Transitions",
    color: "teal",
    icon: "../assets/app-icons/ico/movie_maker.ico",
    timelineInsertable: true,
  }),
  "audio-sync-cut": Object.freeze({
    label: "Audio-Sync Cut",
    icon: "../assets/app-icons/ico/mixer_sound.ico",
    timelineInsertable: false,
  }),
  audio: Object.freeze({
    label: "Audio",
    icon: "../assets/app-icons/ico/mixer_cd_sound.ico",
    timelineInsertable: false,
  }),
});

const FRAME_PRESETS = Object.freeze({
  "9:16": Object.freeze({ label: "Reel / TikTok (9:16)", width: 9, height: 16 }),
  "16:9": Object.freeze({ label: "Widescreen (16:9)", width: 16, height: 9 }),
  "1:1": Object.freeze({ label: "Square (1:1)", width: 1, height: 1 }),
  "4:5": Object.freeze({ label: "Portrait (4:5)", width: 4, height: 5 }),
  "4:3": Object.freeze({ label: "Classic (4:3)", width: 4, height: 3 }),
  "21:9": Object.freeze({ label: "Cinematic (21:9)", width: 21, height: 9 }),
  "3:2": Object.freeze({ label: "Photo (3:2)", width: 3, height: 2 }),
});
const WORKSPACE_LAYOUTS = Object.freeze({
  standard: "Standard",
  "side-by-side": "Side by side",
});
const SOCIAL_GUIDELINE_PLATFORMS = Object.freeze({
  "instagram-reels": Object.freeze({
    label: "Instagram Reels",
    zones: Object.freeze({
      top: "Top controls",
      right: "Like / comment / share",
      bottom: "Caption / audio / navigation",
    }),
  }),
  tiktok: Object.freeze({
    label: "TikTok",
    zones: Object.freeze({
      top: "Feed header",
      right: "Like / comment / save / share",
      bottom: "Caption / sound / navigation",
    }),
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
  mediaPanel: document.querySelector("#media-panel"),
  effectsPanel: document.querySelector("#effects-panel"),
  mediaComposeSeparator: document.querySelector(
    "#video-editor-media-compose-separator"
  ),
  composeEffectsSeparator: document.querySelector(
    "#video-editor-compose-effects-separator"
  ),
  composeBody: document.querySelector(".compose-panel__body"),
  previewStage: document.querySelector("#preview-stage"),
  previewViewport: document.querySelector(".preview-stage-viewport"),
  previewVideo: document.querySelector("#preview-video"),
  previewEmpty: document.querySelector("#preview-empty-state"),
  previewName: document.querySelector("#preview-clip-name"),
  framePreset: document.querySelector("#video-editor-frame-preset"),
  frameCustomSize: document.querySelector("#video-editor-frame-custom-size"),
  frameCustomWidth: document.querySelector("#video-editor-frame-custom-width"),
  frameCustomHeight: document.querySelector("#video-editor-frame-custom-height"),
  workspaceLayoutControls: document.querySelector("#video-editor-workspace-layout"),
  workspaceLayoutOptions: document.querySelectorAll(
    "[data-video-editor-workspace-layout-option]"
  ),
  guidelinesControls: document.querySelector("#video-editor-guidelines"),
  guidelinesPlatform: document.querySelector("#video-editor-guidelines-platform"),
  guidelinesOverlay: document.querySelector(
    "#video-editor-social-guidelines-overlay"
  ),
  guidelineZones: document.querySelectorAll("[data-guideline-zone]"),
  previewTimelineSeparator: document.querySelector(
    "#video-editor-preview-timeline-separator"
  ),
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
  audioSyncGuideLayer: document.querySelector("#audio-sync-guide-layer"),
  audioSyncFlash: document.querySelector("#audio-sync-flash"),
  audioSyncSource: document.querySelector("#audio-sync-source"),
  audioSyncAnalyze: document.querySelector("[data-audio-sync-analyze]"),
  audioSyncStatus: document.querySelector("[data-audio-sync-status]"),
  audioSyncGraphView: document.querySelector("#audio-sync-graph-view"),
  audioSyncWaveform: document.querySelector("[data-audio-sync-waveform]"),
  audioSyncSpectrum: document.querySelector("[data-audio-sync-spectrum]"),
  audioSyncFrequencyMin: document.querySelector("#audio-sync-frequency-min"),
  audioSyncFrequencyMax: document.querySelector("#audio-sync-frequency-max"),
  audioSyncThreshold: document.querySelector("#audio-sync-threshold"),
  audioSyncThresholdOutput: document.querySelector("#audio-sync-threshold-output"),
  audioSyncDirection: document.querySelector("#audio-sync-direction"),
  audioSyncRecommendations: document.querySelectorAll(
    "[data-audio-sync-recommendation]"
  ),
  audioSyncGenerate: document.querySelector("[data-audio-sync-generate]"),
  audioSyncRules: document.querySelector("#audio-sync-rules"),
  audioSyncRulesEmpty: document.querySelector("[data-audio-sync-rules-empty]"),
  audioSyncRuleTotal: document.querySelector("[data-audio-sync-rule-total]"),
  audioSyncRuleTemplate: document.querySelector("#audio-sync-rule-template"),
  audioSyncGuidepostTemplate: document.querySelector(
    "#audio-sync-guidepost-template"
  ),
  audioYoutubeQuery: document.querySelector("#audio-effect-youtube-query"),
  audioYoutubeSearch: document.querySelector("[data-audio-youtube-search]"),
  audioLocalFile: document.querySelector("#audio-local-file"),
  audioLocalSource: document.querySelector("#audio-local-source"),
  audioLocalStart: document.querySelector("#audio-local-start"),
  audioLocalEnd: document.querySelector("#audio-local-end"),
  audioLocalStartOutput: document.querySelector("[data-audio-local-start-output]"),
  audioLocalEndOutput: document.querySelector("[data-audio-local-end-output]"),
  audioLocalPreview: document.querySelector("#audio-local-preview"),
  audioLocalInsert: document.querySelector("[data-audio-local-insert]"),
  soundYoutubeQuery: document.querySelector("#sound-effect-youtube-query"),
  soundYoutubeSearch: document.querySelector("[data-sound-effect-youtube-search]"),
  soundEffectPresets: document.querySelectorAll("[data-sound-effect-preset]"),
  soundEffectLoop: document.querySelector("#sound-effect-loop"),
  soundEffectDuration: document.querySelector("#sound-effect-duration"),
  soundEffectPreview: document.querySelector("[data-sound-effect-preview]"),
  soundEffectInsert: document.querySelector("[data-sound-effect-insert]"),
  soundEffectStatus: document.querySelector("[data-sound-effect-status]"),
  status: document.querySelector("#editor-status"),
  tabList: document.querySelector("#effect-tab-list"),
  defaultTab: document.querySelector("#effect-tab-default"),
  defaultTabFace: document.querySelector("[data-effect-default-tab-face]"),
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
  playbackPreviousTime: 0,
  animationFrame: 0,
  framePreset: "none",
  frameWidth: 0,
  frameHeight: 0,
  customFrameWidth: 1080,
  customFrameHeight: 1920,
  guidelinesPlatform: "none",
  workspaceLayout: "standard",
  previewSplit: DEFAULT_PREVIEW_SPLIT,
  previewSplitByLayout: {
    standard: DEFAULT_PREVIEW_SPLIT,
    "side-by-side": DEFAULT_PREVIEW_SPLIT,
  },
  audioSync: {
    analysis: null,
    analysisMediaId: null,
    graphView: "combined",
    rules: [],
    sourceClipId: null,
    status: "idle",
  },
  audioLocal: {
    mediaId: null,
    sourceEnd: 0,
    sourceStart: 0,
  },
  soundEffect: {
    duration: 3,
    loop: false,
    preset: "click",
  },
  mediaPanelWidth: MEDIA_PANEL_DEFAULT,
  effectsPanelWidth: EFFECTS_PANEL_DEFAULT,
};

const audioPlayers = new Map();
let nextMediaId = 1;
let nextClipId = 1;
let nextEffectId = 1;
let nextAudioSyncRuleId = 1;
let nextGuidepostId = 1;
let mediaImportsInFlight = 0;
let dragPayload = null;
let tabDragTargetIndex = null;
let administratorProof = null;
let authenticationExpiryTimer = 0;
let authenticationMonitorTimer = 0;
let authenticationAttempt = 0;
let authenticationController = null;
let authenticationReturnFocus = null;
let authenticationStorageAvailable = true;
let previewResizeObserver = null;
let sidePanelResizeObserver = null;
let effectTabResizeObserver = null;
let effectTabMarqueeFrame = 0;
let audioAnalysisGeneration = 0;
let audioAnalysisWorker = null;
let guidepostFlashTimer = 0;
let soundEffectPreviewPlayer = null;
let soundEffectPreviewUrl = "";

const audioAnalysisCache = new Map();

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

const normalizeFrameDimension = (value, fallback) => {
  const numericValue = Math.round(Number(value));
  if (!Number.isFinite(numericValue)) return fallback;
  return clamp(numericValue, FRAME_DIMENSION_MIN, FRAME_DIMENSION_MAX);
};

const fitPreviewStage = () => {
  if (!elements.previewStage) return;
  const viewport = elements.previewViewport || elements.previewStage.parentElement;
  if (!viewport) return;
  const bounds = viewport.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const ratio = state.frameWidth / state.frameHeight;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    elements.previewStage.style.width = `${Math.max(1, bounds.width)}px`;
    elements.previewStage.style.height = `${Math.max(1, bounds.height)}px`;
    return;
  }
  let width = bounds.width;
  let height = width / ratio;
  if (height > bounds.height) {
    height = bounds.height;
    width = height * ratio;
  }
  elements.previewStage.style.width = `${Math.max(1, width)}px`;
  elements.previewStage.style.height = `${Math.max(1, height)}px`;
};

const frameSelection = () => {
  if (state.framePreset === "none") {
    return { label: "N/A", width: 0, height: 0 };
  }
  if (state.framePreset === "custom") {
    return {
      label: `Custom (${state.customFrameWidth} × ${state.customFrameHeight})`,
      width: state.customFrameWidth,
      height: state.customFrameHeight,
    };
  }
  return FRAME_PRESETS[state.framePreset] || { label: "N/A", width: 0, height: 0 };
};

const socialGuidelinesEligible = () => state.framePreset === "9:16";
const socialGuidelinesSelected = () => state.guidelinesPlatform !== "none";

const applySocialGuidelines = (shouldAnnounce = false) => {
  const platform = SOCIAL_GUIDELINE_PLATFORMS[state.guidelinesPlatform] || null;
  const selected = socialGuidelinesSelected() && Boolean(platform);
  const eligible = socialGuidelinesEligible();
  const visible = selected && eligible;
  if (elements.guidelinesPlatform) {
    elements.guidelinesPlatform.value = selected ? state.guidelinesPlatform : "none";
  }
  if (elements.guidelinesControls) {
    elements.guidelinesControls.dataset.guidelinesState = visible
      ? "visible"
      : selected
        ? "paused"
        : "off";
  }
  if (elements.guidelinesOverlay) {
    elements.guidelinesOverlay.dataset.guidelinePlatform = state.guidelinesPlatform;
    elements.guidelinesOverlay.hidden = !visible;
    elements.guidelinesOverlay.setAttribute("aria-hidden", "true");
  }
  elements.guidelineZones.forEach((zone) => {
    const label = platform?.zones[zone.dataset.guidelineZone];
    const labelNode = zone.querySelector("span");
    if (label && labelNode) labelNode.textContent = label;
  });
  if (shouldAnnounce) {
    if (!selected) {
      announce("UI guidelines hidden.");
    } else if (!eligible) {
      announce(
        `${platform.label} UI guidelines selected. Select Reel / TikTok (9:16) to display them.`
      );
    } else {
      announce(`${platform.label} UI guidelines shown.`);
    }
  }
  return visible;
};

const applyFrameSize = (shouldAnnounce = false) => {
  const frame = frameSelection();
  const isFlexibleFrame = state.framePreset === "none";
  state.frameWidth = frame.width;
  state.frameHeight = frame.height;
  if (elements.previewStage) {
    elements.previewStage.dataset.framePreset = state.framePreset;
    elements.previewStage.dataset.frameWidth = isFlexibleFrame ? "auto" : String(frame.width);
    elements.previewStage.dataset.frameHeight = isFlexibleFrame
      ? "auto"
      : String(frame.height);
    elements.previewStage.classList.toggle("is-frame-flexible", isFlexibleFrame);
    if (isFlexibleFrame) {
      elements.previewStage.style.removeProperty("--video-editor-frame-aspect-ratio");
      elements.previewStage.style.removeProperty("--video-editor-frame-width");
      elements.previewStage.style.removeProperty("--video-editor-frame-height");
    } else {
      elements.previewStage.style.setProperty(
        "--video-editor-frame-aspect-ratio",
        `${frame.width} / ${frame.height}`
      );
      elements.previewStage.style.setProperty(
        "--video-editor-frame-width",
        String(frame.width)
      );
      elements.previewStage.style.setProperty(
        "--video-editor-frame-height",
        String(frame.height)
      );
    }
    elements.previewStage.setAttribute(
      "aria-label",
      isFlexibleFrame
        ? "Composed timeline preview, flexible frame (N/A)"
        : `Composed timeline preview, ${frame.label}`
    );
  }
  const guidelinesVisible = applySocialGuidelines(false);
  requestAnimationFrame(fitPreviewStage);
  if (shouldAnnounce) {
    const guidelinesPlatform = SOCIAL_GUIDELINE_PLATFORMS[state.guidelinesPlatform];
    const guidelinesStatus = guidelinesPlatform
      ? guidelinesVisible
        ? ` ${guidelinesPlatform.label} UI guidelines shown.`
        : ` ${guidelinesPlatform.label} UI guidelines paused until Reel / TikTok (9:16) is selected.`
      : "";
    announce(`Frame size set to ${frame.label}.${guidelinesStatus}`);
  }
};

const updateCustomFrameSize = (shouldAnnounce = false, shouldNormalize = false) => {
  if (!elements.frameCustomWidth || !elements.frameCustomHeight) return;
  if (!elements.frameCustomWidth.value || !elements.frameCustomHeight.value) return;
  const width = elements.frameCustomWidth.valueAsNumber;
  const height = elements.frameCustomHeight.valueAsNumber;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return;
  if (
    !shouldNormalize &&
    (!Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < FRAME_DIMENSION_MIN ||
      width > FRAME_DIMENSION_MAX ||
      height < FRAME_DIMENSION_MIN ||
      height > FRAME_DIMENSION_MAX)
  ) {
    return;
  }
  state.customFrameWidth = normalizeFrameDimension(width, state.customFrameWidth);
  state.customFrameHeight = normalizeFrameDimension(height, state.customFrameHeight);
  if (shouldNormalize) {
    elements.frameCustomWidth.value = String(state.customFrameWidth);
    elements.frameCustomHeight.value = String(state.customFrameHeight);
  }
  if (state.framePreset === "custom") applyFrameSize(shouldAnnounce);
};

const previewSplitBounds = () => {
  if (!elements.composeBody) {
    return {
      flexibleSize: 0,
      maximum: PREVIEW_SPLIT_MAX,
      minimum: PREVIEW_SPLIT_MIN,
    };
  }
  const sideBySide = state.workspaceLayout === "side-by-side";
  const bodyBounds = elements.composeBody.getBoundingClientRect();
  const bodyStyle = getComputedStyle(elements.composeBody);
  const axisSize = sideBySide ? bodyBounds.width : bodyBounds.height;
  const gap =
    Number.parseFloat(sideBySide ? bodyStyle.columnGap : bodyStyle.rowGap) || 0;
  const separatorSize = sideBySide
    ? elements.previewTimelineSeparator?.offsetWidth || 9
    : elements.previewTimelineSeparator?.offsetHeight || 9;
  const flexibleSize = axisSize - separatorSize - gap * 2;
  if (flexibleSize <= 0) {
    return {
      flexibleSize: 0,
      maximum: PREVIEW_SPLIT_MAX,
      minimum: PREVIEW_SPLIT_MIN,
    };
  }
  let previewMinimumPixels = SIDE_BY_SIDE_PREVIEW_MIN;
  if (!sideBySide) {
    previewMinimumPixels =
      window.innerHeight <= 680
        ? COMPACT_STANDARD_PREVIEW_MIN
        : STANDARD_PREVIEW_MIN;
  }
  const minimum = Math.min(
    PREVIEW_SPLIT_MAX,
    Math.max(
      PREVIEW_SPLIT_MIN,
      Math.ceil((previewMinimumPixels / flexibleSize) * 100)
    )
  );
  const timelineMinimumPixels = sideBySide
    ? SIDE_BY_SIDE_TIMELINE_MIN
    : STANDARD_TIMELINE_MIN;
  const maximum = Math.min(
    PREVIEW_SPLIT_MAX,
    Math.floor(
      ((flexibleSize - timelineMinimumPixels) / flexibleSize) * 100
    )
  );
  return {
    flexibleSize,
    maximum: Math.max(minimum, maximum),
    minimum,
  };
};

const setPreviewSplit = (value, shouldAnnounce = false) => {
  const bounds = previewSplitBounds();
  state.previewSplit = Math.round(clamp(value, bounds.minimum, bounds.maximum));
  state.previewSplitByLayout[state.workspaceLayout] = state.previewSplit;
  elements.composeBody?.style.setProperty(
    "--video-editor-preview-split",
    `${state.previewSplit}fr`
  );
  elements.composeBody?.style.setProperty(
    "--video-editor-timeline-split",
    `${100 - state.previewSplit}fr`
  );
  if (elements.previewTimelineSeparator) {
    elements.previewTimelineSeparator.setAttribute("aria-valuemin", String(bounds.minimum));
    elements.previewTimelineSeparator.setAttribute("aria-valuemax", String(bounds.maximum));
    elements.previewTimelineSeparator.setAttribute("aria-valuenow", String(state.previewSplit));
    elements.previewTimelineSeparator.setAttribute(
      "aria-valuetext",
      state.workspaceLayout === "side-by-side"
        ? `Preview width ${state.previewSplit}%, timeline width ${100 - state.previewSplit}%`
        : `Preview height ${state.previewSplit}%, timeline height ${100 - state.previewSplit}%`
    );
  }
  requestAnimationFrame(fitPreviewStage);
  if (shouldAnnounce) announce(`Preview area set to ${state.previewSplit} percent.`);
};

const setWorkspaceLayout = (layout, shouldAnnounce = false) => {
  if (!Object.hasOwn(WORKSPACE_LAYOUTS, layout)) return;
  state.workspaceLayout = layout;
  state.previewSplit = state.previewSplitByLayout[layout];
  if (elements.composeBody) {
    elements.composeBody.dataset.videoEditorWorkspaceLayout = layout;
  }
  elements.workspaceLayoutOptions.forEach((button) => {
    const isActive = button.dataset.videoEditorWorkspaceLayoutOption === layout;
    button.setAttribute("aria-pressed", String(isActive));
  });
  if (elements.previewTimelineSeparator) {
    elements.previewTimelineSeparator.setAttribute(
      "aria-orientation",
      layout === "side-by-side" ? "vertical" : "horizontal"
    );
  }
  setPreviewSplit(state.previewSplit);
  requestAnimationFrame(fitPreviewStage);
  if (shouldAnnounce) {
    announce(`Workspace layout set to ${WORKSPACE_LAYOUTS[layout]}.`);
  }
};

const bindPreviewTimelineSeparator = () => {
  const separator = elements.previewTimelineSeparator;
  if (!separator || !elements.composeBody) return;
  separator.addEventListener("keydown", (event) => {
    let nextValue = null;
    if (
      (state.workspaceLayout === "standard" && event.key === "ArrowUp") ||
      (state.workspaceLayout === "side-by-side" && event.key === "ArrowLeft")
    ) {
      nextValue = state.previewSplit - PREVIEW_SPLIT_STEP;
    } else if (
      (state.workspaceLayout === "standard" && event.key === "ArrowDown") ||
      (state.workspaceLayout === "side-by-side" && event.key === "ArrowRight")
    ) {
      nextValue = state.previewSplit + PREVIEW_SPLIT_STEP;
    } else if (event.key === "Home") nextValue = previewSplitBounds().minimum;
    else if (event.key === "End") nextValue = previewSplitBounds().maximum;
    if (nextValue === null) return;
    event.preventDefault();
    setPreviewSplit(nextValue, true);
  });
  separator.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    separator.focus();
    const sideBySide = state.workspaceLayout === "side-by-side";
    const startPointerPosition = sideBySide ? event.clientX : event.clientY;
    const startValue = state.previewSplit;
    const bounds = elements.composeBody.getBoundingClientRect();
    let changed = false;
    separator.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      if (document.body.dataset.videoEditorAuthState !== AUTHENTICATED_STATE) {
        finish();
        return;
      }
      const pointerPosition = sideBySide ? moveEvent.clientX : moveEvent.clientY;
      const availableSize =
        previewSplitBounds().flexibleSize ||
        (sideBySide ? bounds.width : bounds.height);
      const delta = ((pointerPosition - startPointerPosition) / availableSize) * 100;
      const splitBounds = previewSplitBounds();
      const nextValue = clamp(
        startValue + delta,
        splitBounds.minimum,
        splitBounds.maximum
      );
      changed ||= Math.round(nextValue) !== state.previewSplit;
      setPreviewSplit(nextValue);
    };
    const finish = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      if (changed) announce(`Preview area set to ${state.previewSplit} percent.`);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish, { once: true });
    document.addEventListener("pointercancel", finish, { once: true });
  });
};

const sidePanelDetails = (side) =>
  side === "media"
    ? {
        cssProperty: "--video-editor-media-panel-width",
        label: "Project Media",
        maximum: MEDIA_PANEL_MAX,
        minimum: MEDIA_PANEL_MIN,
        separator: elements.mediaComposeSeparator,
        stateKey: "mediaPanelWidth",
      }
    : {
        cssProperty: "--video-editor-effects-panel-width",
        label: "Effect Editor",
        maximum: EFFECTS_PANEL_MAX,
        minimum: EFFECTS_PANEL_MIN,
        separator: elements.composeEffectsSeparator,
        stateKey: "effectsPanelWidth",
      };

const availablePanelWidth = () => {
  if (!elements.app || !elements.app.clientWidth) return 0;
  const style = getComputedStyle(elements.app);
  const horizontalPadding =
    (Number.parseFloat(style.paddingLeft) || 0) +
    (Number.parseFloat(style.paddingRight) || 0);
  const gap = Number.parseFloat(style.columnGap) || 0;
  const separatorWidth =
    (elements.mediaComposeSeparator?.getBoundingClientRect().width || 0) +
    (elements.composeEffectsSeparator?.getBoundingClientRect().width || 0);
  return elements.app.clientWidth - horizontalPadding - separatorWidth - gap * 4;
};

const sidePanelMaximum = (side) => {
  const details = sidePanelDetails(side);
  const otherWidth =
    side === "media" ? state.effectsPanelWidth : state.mediaPanelWidth;
  const layoutMaximum = availablePanelWidth() - otherWidth - COMPOSE_PANEL_MIN;
  return Math.max(details.minimum, Math.min(details.maximum, layoutMaximum));
};

const scheduleEffectTabTitleMarquees = () => {
  if (effectTabMarqueeFrame) cancelAnimationFrame(effectTabMarqueeFrame);
  effectTabMarqueeFrame = requestAnimationFrame(() => {
    effectTabMarqueeFrame = 0;
    elements.tabList?.querySelectorAll("[data-effect-tab-wrapper]").forEach((tab) => {
      const viewport = tab.querySelector("[data-effect-tab-title-viewport]");
      const track = tab.querySelector("[data-effect-tab-title-track]");
      if (!viewport || !track || !viewport.clientWidth) return;
      const distance = Math.max(0, Math.ceil(track.scrollWidth - viewport.clientWidth));
      tab.classList.toggle("is-title-overflowing", distance > 0);
      if (distance > 0) {
        tab.style.setProperty("--effect-tab-title-scroll-distance", `${distance}px`);
        tab.style.setProperty(
          "--effect-tab-title-scroll-duration",
          `${Math.min(10, Math.max(3, distance / 12)).toFixed(2)}s`
        );
      } else {
        tab.style.removeProperty("--effect-tab-title-scroll-distance");
        tab.style.removeProperty("--effect-tab-title-scroll-duration");
      }
    });
  });
};

const updateSidePanelLayout = () => {
  if (!elements.app) return;
  for (const side of ["media", "effects"]) {
    const details = sidePanelDetails(side);
    elements.app.style.setProperty(
      details.cssProperty,
      `${state[details.stateKey]}px`
    );
    if (!details.separator) continue;
    details.separator.setAttribute("aria-valuemin", String(details.minimum));
    details.separator.setAttribute("aria-valuemax", String(sidePanelMaximum(side)));
    details.separator.setAttribute("aria-valuenow", String(state[details.stateKey]));
    details.separator.setAttribute(
      "aria-valuetext",
      `${details.label} width ${state[details.stateKey]} pixels`
    );
  }
  if (state.workspaceLayout === "side-by-side") {
    setPreviewSplit(state.previewSplit);
  }
  requestAnimationFrame(fitPreviewStage);
  scheduleEffectTabTitleMarquees();
};

const reconcileSidePanelWidths = () => {
  const available = availablePanelWidth();
  if (!available) return;
  state.mediaPanelWidth = Math.round(
    clamp(state.mediaPanelWidth, MEDIA_PANEL_MIN, MEDIA_PANEL_MAX)
  );
  state.effectsPanelWidth = Math.round(
    clamp(state.effectsPanelWidth, EFFECTS_PANEL_MIN, EFFECTS_PANEL_MAX)
  );
  let excess =
    state.mediaPanelWidth + state.effectsPanelWidth + COMPOSE_PANEL_MIN - available;
  if (excess > 0) {
    const effectsReduction = Math.min(
      excess,
      state.effectsPanelWidth - EFFECTS_PANEL_MIN
    );
    state.effectsPanelWidth -= effectsReduction;
    excess -= effectsReduction;
  }
  if (excess > 0) {
    state.mediaPanelWidth -= Math.min(
      excess,
      state.mediaPanelWidth - MEDIA_PANEL_MIN
    );
  }
  updateSidePanelLayout();
};

const setSidePanelWidth = (side, value, shouldAnnounce = false) => {
  const details = sidePanelDetails(side);
  state[details.stateKey] = Math.round(
    clamp(value, details.minimum, sidePanelMaximum(side))
  );
  updateSidePanelLayout();
  if (shouldAnnounce) {
    announce(`${details.label} panel set to ${state[details.stateKey]} pixels.`);
  }
};

const bindSidePanelSeparator = (side) => {
  const details = sidePanelDetails(side);
  const separator = details.separator;
  if (!separator) return;
  separator.addEventListener("keydown", (event) => {
    let nextValue = null;
    if (event.key === "Home") nextValue = details.minimum;
    else if (event.key === "End") nextValue = sidePanelMaximum(side);
    else if (side === "media" && event.key === "ArrowLeft") {
      nextValue = state[details.stateKey] - SIDE_PANEL_KEYBOARD_STEP;
    } else if (side === "media" && event.key === "ArrowRight") {
      nextValue = state[details.stateKey] + SIDE_PANEL_KEYBOARD_STEP;
    } else if (side === "effects" && event.key === "ArrowLeft") {
      nextValue = state[details.stateKey] + SIDE_PANEL_KEYBOARD_STEP;
    } else if (side === "effects" && event.key === "ArrowRight") {
      nextValue = state[details.stateKey] - SIDE_PANEL_KEYBOARD_STEP;
    }
    if (nextValue === null) return;
    event.preventDefault();
    setSidePanelWidth(side, nextValue, true);
  });
  separator.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    separator.focus();
    const startX = event.clientX;
    const startWidth = state[details.stateKey];
    let changed = false;
    separator.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      if (document.body.dataset.videoEditorAuthState !== AUTHENTICATED_STATE) {
        finish();
        return;
      }
      const direction = side === "media" ? 1 : -1;
      const nextWidth = startWidth + (moveEvent.clientX - startX) * direction;
      const previousWidth = state[details.stateKey];
      setSidePanelWidth(side, nextWidth);
      changed ||= previousWidth !== state[details.stateKey];
    };
    const finish = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      if (changed) {
        announce(`${details.label} panel set to ${state[details.stateKey]} pixels.`);
      }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish, { once: true });
    document.addEventListener("pointercancel", finish, { once: true });
  });
};

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
    return "Your session expired. Your project is safe in this tab. Sign in again to continue using the Video Editor.";
  }
  if (reason === "deauthenticated") {
    return "Your session ended. Your project is safe in this tab. Sign in again to continue using the Video Editor.";
  }
  return "Sign in to begin.";
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
    setAuthenticationStatus("Sign in to begin.");
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
  if (!files.length) return [];

  let imported = 0;
  let rejected = 0;
  const importedMedia = [];
  announce(`Reading ${files.length} local ${files.length === 1 ? "file" : "files"}…`);
  mediaImportsInFlight += 1;
  elements.app?.setAttribute("aria-busy", "true");

  try {
    for (const file of files) {
      const kind = classifyFile(file);
      if (!kind) {
        rejected += 1;
        continue;
      }

      const url = URL.createObjectURL(file);
      try {
        const duration = await readMediaDuration(url, kind);
        const mediaItem = {
          id: `media-${nextMediaId++}`,
          file,
          kind,
          name: file.name,
          duration,
          url,
        };
        state.media.push(mediaItem);
        importedMedia.push(mediaItem);
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
    return importedMedia;
  } finally {
    mediaImportsInFlight = Math.max(0, mediaImportsInFlight - 1);
    if (mediaImportsInFlight === 0) {
      elements.app?.setAttribute("aria-busy", "false");
    }
  }
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
  renderAudioToolSources();
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

const insertClipSegment = (
  media,
  tierId,
  desiredStart,
  sourceStart,
  sourceEnd,
  {
    announceChange = true,
    focus = true,
    minimumDuration = MIN_ITEM_DURATION,
    snap = true,
  } = {}
) => {
  const tier = state.tiers.find((candidate) => candidate.id === tierId);
  if (!tier || tier.kind !== media.kind) {
    if (announceChange) {
      announce(`${media.name} is ${media.kind}; choose a ${media.kind} tier.`);
    }
    return null;
  }
  const normalizedSourceStart = roundTime(
    clamp(sourceStart, 0, Math.max(0, media.duration - minimumDuration))
  );
  const normalizedSourceEnd = roundTime(
    clamp(sourceEnd, normalizedSourceStart + minimumDuration, media.duration)
  );
  const duration = normalizedSourceEnd - normalizedSourceStart;
  if (duration < minimumDuration) {
    if (announceChange) announce(`Choose at least ${formatTime(minimumDuration)} of source media.`);
    return null;
  }
  const validStart = findValidStart(tierId, desiredStart, duration);
  if (!snap && Math.abs(validStart - desiredStart) > 0.01) return null;
  const start = snap ? validStart : roundTime(Math.max(0, desiredStart));
  const clip = {
    id: `clip-${nextClipId++}`,
    mediaId: media.id,
    kind: media.kind,
    sourceStart: normalizedSourceStart,
    sourceEnd: normalizedSourceEnd,
    start,
    tierId,
  };
  state.clips.push(clip);
  state.playhead = start;
  renderTimeline();
  if (announceChange) {
    announce(
      `${media.name} added to ${tier.label} at ${formatTime(start)}${
        Math.abs(start - desiredStart) > 0.01 ? "; snapped to avoid an overlap" : ""
      }.`
    );
  }
  if (focus) {
    requestAnimationFrame(() =>
      document.querySelector(`[data-clip-id="${clip.id}"]`)?.focus({
        preventScroll: true,
      })
    );
  }
  return clip;
};

const addClip = (media, tierId, desiredStart) =>
  Boolean(
    insertClipSegment(media, tierId, desiredStart, 0, media.duration)
  );

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
  item.dataset.sourceStart = String(clip.sourceStart);
  item.dataset.sourceEnd = String(clip.sourceEnd);
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
  const durationWidth = Math.ceil(duration * state.pixelsPerSecond);
  const contentWidth = durationWidth + TIMELINE_LABEL_RESERVE;
  elements.timelineCanvas.style.setProperty(
    "--timeline-content-width",
    `${contentWidth}px`
  );
  elements.timelineCanvas.style.setProperty(
    "--timeline-duration-width",
    `${durationWidth}px`
  );
  elements.timelineCanvas.style.setProperty(
    "--timeline-second-width",
    `${state.pixelsPerSecond}px`
  );
  elements.timelineRuler.replaceChildren();
  const labelInterval = state.pixelsPerSecond >= 48 ? 5 : 10;
  for (let second = 0; second <= duration; second += 1) {
    const isMajor = second % labelInterval === 0 || second === duration;
    const tick = document.createElement("span");
    tick.className = "timeline-ruler__tick";
    tick.dataset.rulerTick = isMajor ? "major" : "minor";
    tick.dataset.timeSeconds = String(second);
    tick.style.left = `${second * state.pixelsPerSecond}px`;
    if (isMajor) {
      const label = document.createElement("span");
      label.className = "timeline-ruler__label";
      label.textContent = formatTime(second).slice(0, 5);
      tick.append(label);
    }
    elements.timelineRuler.append(tick);
  }
};

const insertEffect = (
  type,
  start,
  duration = EFFECT_DURATION,
  metadata = {}
) => {
  const definition = EFFECTS[type];
  if (!definition?.timelineInsertable) return null;
  const effect = {
    id: `effect-${nextEffectId++}`,
    type,
    start: roundTime(Math.max(0, start)),
    duration: roundTime(Math.max(MIN_ITEM_DURATION, duration)),
    tabId: `effect-tab-${type}`,
    ...metadata,
  };
  state.effects.push(effect);
  return effect;
};

const addEffect = (type) => {
  const definition = EFFECTS[type];
  const effect = insertEffect(type, state.playhead);
  if (!definition || !effect) return;
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

const setAudioSyncStatus = (message, status = state.audioSync.status) => {
  state.audioSync.status = status;
  if (elements.audioSyncStatus) {
    elements.audioSyncStatus.textContent = message;
    elements.audioSyncStatus.dataset.state = status;
  }
};

const audioClipLabel = (clip) => {
  const media = mediaForClip(clip);
  const tier = state.tiers.find((candidate) => candidate.id === clip.tierId);
  return `${media?.name || "Audio clip"} · ${tier?.label || "Audio"} · ${formatTime(clip.start)}`;
};

const setAudioLocalSource = (mediaId, { resetRange = true } = {}) => {
  const media = state.media.find(
    (candidate) => candidate.id === mediaId && candidate.kind === "audio"
  );
  state.audioLocal.mediaId = media?.id || null;
  if (resetRange) {
    state.audioLocal.sourceStart = 0;
    state.audioLocal.sourceEnd = media?.duration || 0;
  }
  for (const input of [elements.audioLocalStart, elements.audioLocalEnd]) {
    if (!input) continue;
    input.disabled = !media;
    input.max = String(media?.duration || 0);
  }
  if (elements.audioLocalStart) {
    elements.audioLocalStart.value = String(state.audioLocal.sourceStart);
  }
  if (elements.audioLocalEnd) {
    elements.audioLocalEnd.value = String(state.audioLocal.sourceEnd);
  }
  if (elements.audioLocalStartOutput) {
    elements.audioLocalStartOutput.textContent = formatTime(
      state.audioLocal.sourceStart
    );
  }
  if (elements.audioLocalEndOutput) {
    elements.audioLocalEndOutput.textContent = formatTime(state.audioLocal.sourceEnd);
  }
  if (elements.audioLocalInsert) elements.audioLocalInsert.disabled = !media;
  if (elements.audioLocalPreview) {
    elements.audioLocalPreview.pause();
    elements.audioLocalPreview.hidden = !media;
    if (media && elements.audioLocalPreview.src !== media.url) {
      elements.audioLocalPreview.src = media.url;
    } else if (!media) {
      elements.audioLocalPreview.removeAttribute("src");
      elements.audioLocalPreview.load();
    }
  }
};

const replaceSelectOptions = (select, items, placeholder, selectedId) => {
  if (!select) return;
  select.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = placeholder;
  select.append(empty);
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    select.append(option);
  }
  select.value = selectedId || "";
};

const renderAudioToolSources = () => {
  const audioClips = state.clips
    .filter((clip) => clip.kind === "audio" && mediaForClip(clip))
    .sort((left, right) => left.start - right.start);
  if (!audioClips.some((clip) => clip.id === state.audioSync.sourceClipId)) {
    state.audioSync.sourceClipId = audioClips[0]?.id || null;
  }
  replaceSelectOptions(
    elements.audioSyncSource,
    audioClips.map((clip) => ({ id: clip.id, label: audioClipLabel(clip) })),
    "Select an Audio timeline clip…",
    state.audioSync.sourceClipId
  );
  if (elements.audioSyncAnalyze) {
    elements.audioSyncAnalyze.disabled =
      !state.audioSync.sourceClipId || state.audioSync.status === "analyzing";
  }

  const audioMedia = state.media.filter((media) => media.kind === "audio");
  const priorMediaId = state.audioLocal.mediaId;
  if (!audioMedia.some((media) => media.id === priorMediaId)) {
    state.audioLocal.mediaId = audioMedia[0]?.id || null;
  }
  replaceSelectOptions(
    elements.audioLocalSource,
    audioMedia.map((media) => ({
      id: media.id,
      label: `${media.name} · ${formatTime(media.duration)}`,
    })),
    "No local audio selected",
    state.audioLocal.mediaId
  );
  setAudioLocalSource(state.audioLocal.mediaId, {
    resetRange: state.audioLocal.mediaId !== priorMediaId,
  });
};

const selectedAudioSyncClip = () =>
  state.clips.find(
    (clip) => clip.id === state.audioSync.sourceClipId && clip.kind === "audio"
  ) || null;

const loudestAudioChannel = (audioBuffer) => {
  let selected = audioBuffer.getChannelData(0);
  let selectedEnergy = -1;
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const samples = audioBuffer.getChannelData(channel);
    const stride = Math.max(1, Math.floor(samples.length / 20000));
    let energy = 0;
    for (let index = 0; index < samples.length; index += stride) {
      energy += samples[index] * samples[index];
    }
    if (energy > selectedEnergy) {
      selected = samples;
      selectedEnergy = energy;
    }
  }
  return new Float32Array(selected);
};

const waveFileSampleRate = (buffer) => {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 28) return 0;
  const view = new DataView(buffer);
  const text = (offset, length) =>
    Array.from({ length }, (_, index) => String.fromCharCode(view.getUint8(offset + index))).join("");
  if (text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE") return 0;
  for (let offset = 12; offset + 8 <= view.byteLength; ) {
    const chunk = text(offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (chunk === "fmt " && size >= 16 && offset + 16 <= view.byteLength) {
      return view.getUint32(offset + 12, true);
    }
    offset += 8 + size + (size % 2);
  }
  return 0;
};

const ensureAudioAnalysisWorker = () => {
  if (audioAnalysisWorker) return audioAnalysisWorker;
  audioAnalysisWorker = new Worker(
    new URL("./audio-analysis-worker.js", import.meta.url)
  );
  return audioAnalysisWorker;
};

const runAudioAnalysisWorker = (samples, sampleRate, generation) =>
  new Promise((resolve, reject) => {
    const worker = ensureAudioAnalysisWorker();
    const receive = (event) => {
      if (event.data?.generation !== generation) return;
      worker.removeEventListener("message", receive);
      worker.removeEventListener("error", fail);
      if (event.data.ok) resolve(event.data.analysis);
      else reject(new Error(event.data.error || "Audio analysis failed."));
    };
    const fail = (event) => {
      worker.removeEventListener("message", receive);
      worker.removeEventListener("error", fail);
      reject(new Error(event.message || "Audio analysis worker failed."));
    };
    worker.addEventListener("message", receive);
    worker.addEventListener("error", fail);
    worker.postMessage({ generation, sampleRate, samples }, [samples.buffer]);
  });

const analyzeSelectedAudioClip = async () => {
  const clip = selectedAudioSyncClip();
  const media = clip ? mediaForClip(clip) : null;
  if (!clip || !media) {
    setAudioSyncStatus("Choose an Audio timeline clip to begin.", "idle");
    return;
  }
  const generation = (audioAnalysisGeneration += 1);
  setAudioSyncStatus(`Analyzing ${media.name}…`, "analyzing");
  renderAudioToolSources();
  try {
    let analysis = audioAnalysisCache.get(media.id) || null;
    if (!analysis) {
      if (media.file.size > AUDIO_ANALYSIS_MAX_FILE_BYTES) {
        throw new Error("Audio analysis supports files up to 64 MB.");
      }
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) {
        throw new Error("This browser does not support local audio analysis.");
      }
      const context = new AudioContextConstructor();
      let audioBuffer;
      const sourceBytes = await media.file.arrayBuffer();
      const declaredSampleRate = waveFileSampleRate(sourceBytes);
      try {
        audioBuffer = await context.decodeAudioData(sourceBytes);
      } finally {
        await context.close().catch(() => {});
      }
      if (generation !== audioAnalysisGeneration) return;
      if (audioBuffer.duration > AUDIO_ANALYSIS_MAX_DURATION) {
        throw new Error("Audio analysis supports tracks up to ten minutes.");
      }
      const decodedBytes =
        audioBuffer.length * audioBuffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
      if (decodedBytes > AUDIO_ANALYSIS_MAX_DECODED_BYTES) {
        throw new Error("This decoded audio track is too large to analyze safely.");
      }
      analysis = await runAudioAnalysisWorker(
        loudestAudioChannel(audioBuffer),
        audioBuffer.sampleRate,
        generation
      );
      if (declaredSampleRate) analysis.sourceSampleRate = declaredSampleRate;
      audioAnalysisCache.set(media.id, analysis);
    }
    if (generation !== audioAnalysisGeneration) return;
    state.audioSync.analysis = analysis;
    state.audioSync.analysisMediaId = media.id;
    state.audioSync.status = "ready";
    setAudioSyncStatus(
      `Analyzed ${media.name}: ${formatTime(analysis.duration)} at ${analysis.sourceSampleRate} Hz.`,
      "ready"
    );
    if (elements.audioSyncGenerate) elements.audioSyncGenerate.disabled = false;
    elements.audioSyncRecommendations.forEach((button) => {
      button.disabled = false;
    });
    renderAudioSyncGraphs();
  } catch (error) {
    if (generation !== audioAnalysisGeneration) return;
    state.audioSync.analysis = null;
    state.audioSync.analysisMediaId = null;
    setAudioSyncStatus(
      String(error?.message || "The browser could not analyze this audio file."),
      "error"
    );
    if (elements.audioSyncGenerate) elements.audioSyncGenerate.disabled = true;
  } finally {
    renderAudioToolSources();
  }
};

const audioSyncApi = () => window.VideoEditorAudioAnalysis || null;

const normalizedAudioSyncRange = () => {
  const analysis = state.audioSync.analysis;
  const nyquist = analysis ? analysis.sampleRate / 2 : 20000;
  const rawMinimum = Number(elements.audioSyncFrequencyMin?.value);
  const rawMaximum = Number(elements.audioSyncFrequencyMax?.value);
  const minimum = clamp(Number.isFinite(rawMinimum) ? rawMinimum : 40, 20, nyquist);
  const maximum = clamp(
    Number.isFinite(rawMaximum) ? rawMaximum : 2000,
    minimum,
    nyquist
  );
  if (elements.audioSyncFrequencyMin) elements.audioSyncFrequencyMin.value = String(Math.round(minimum));
  if (elements.audioSyncFrequencyMax) elements.audioSyncFrequencyMax.value = String(Math.round(maximum));
  return { maximum, minimum };
};

const selectedAudioSyncSeries = ({ detector = "band", maximum, minimum } = {}) => {
  const analysis = state.audioSync.analysis;
  const api = audioSyncApi();
  if (!analysis || !api) return null;
  return detector === "onset"
    ? api.createOnsetSeries(analysis)
    : api.createBandSeries(analysis, minimum, maximum);
};

const sizeCanvas = (canvas) => {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round((bounds.width || 360) * ratio));
  const height = Math.max(1, Math.round((bounds.height || 76) * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { context: canvas.getContext("2d"), height, ratio, width };
};

const drawAudioSyncWaveform = (container) => {
  const canvas = container?.querySelector("canvas");
  const analysis = state.audioSync.analysis;
  if (!canvas || !analysis) return;
  const { context, height, width } = sizeCanvas(canvas);
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const { maximums, minimums } = analysis.waveform;
  context.strokeStyle = "#00ffff";
  context.lineWidth = Math.max(1, window.devicePixelRatio || 1);
  context.beginPath();
  for (let index = 0; index < maximums.length; index += 1) {
    const x = (index / Math.max(1, maximums.length - 1)) * (width - 1);
    const top = (0.5 - maximums[index] * 0.45) * height;
    const bottom = (0.5 - minimums[index] * 0.45) * height;
    context.moveTo(x, top);
    context.lineTo(x, bottom);
  }
  context.stroke();
};

const frequencyX = (frequency, analysis, width) => {
  const minimum = Math.max(20, analysis.bandEdges[0]);
  const maximum = analysis.bandEdges.at(-1);
  return (
    (Math.log(Math.max(minimum, frequency)) - Math.log(minimum)) /
    (Math.log(maximum) - Math.log(minimum))
  ) * width;
};

const drawAudioSyncSpectrum = (container) => {
  const canvas = container?.querySelector("canvas");
  const analysis = state.audioSync.analysis;
  if (!canvas || !analysis) return;
  const { context, height, width } = sizeCanvas(canvas);
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const { minimum, maximum } = normalizedAudioSyncRange();
  const left = frequencyX(minimum, analysis, width);
  const right = frequencyX(maximum, analysis, width);
  context.fillStyle = "rgba(255, 255, 0, 0.18)";
  context.fillRect(left, 0, Math.max(1, right - left), height);
  context.fillStyle = "#00ffff";
  analysis.averageSpectrum.forEach((value, index) => {
    const x1 = frequencyX(analysis.bandEdges[index], analysis, width);
    const x2 = frequencyX(analysis.bandEdges[index + 1], analysis, width);
    const barHeight = value * (height - 4);
    context.fillRect(x1, height - barHeight, Math.max(1, x2 - x1 - 1), barHeight);
  });
};

const renderAudioSyncGraphs = () => {
  const view = elements.audioSyncGraphView?.value || state.audioSync.graphView;
  state.audioSync.graphView = view;
  const showWaveform = view === "combined" || view === "waveform";
  const showSpectrum = view === "combined" || view === "frequency";
  if (elements.audioSyncWaveform) elements.audioSyncWaveform.hidden = !showWaveform;
  if (elements.audioSyncSpectrum) elements.audioSyncSpectrum.hidden = !showSpectrum;
  const analysis = state.audioSync.analysis;
  for (const container of [elements.audioSyncWaveform, elements.audioSyncSpectrum]) {
    const placeholder = container?.querySelector("span");
    if (placeholder) placeholder.hidden = Boolean(analysis);
  }
  if (!analysis) return;
  const source = selectedAudioSyncClip();
  const media = source ? mediaForClip(source) : null;
  elements.audioSyncWaveform?.setAttribute(
    "aria-label",
    `Waveform for ${media?.name || "analyzed audio"}, ${formatTime(analysis.duration)}.`
  );
  const range = normalizedAudioSyncRange();
  elements.audioSyncSpectrum?.setAttribute(
    "aria-label",
    `Frequency spectrum for ${media?.name || "analyzed audio"}; Fourier graph with selected range ${Math.round(range.minimum)} to ${Math.round(range.maximum)} hertz.`
  );
  if (showWaveform) drawAudioSyncWaveform(elements.audioSyncWaveform);
  if (showSpectrum) drawAudioSyncSpectrum(elements.audioSyncSpectrum);
};

const guidepostTimelineTime = (rule, guidepost) => {
  const clip = state.clips.find(
    (candidate) => candidate.id === rule.sourceClipId && candidate.kind === "audio"
  );
  if (
    !clip ||
    guidepost.sourceTime < clip.sourceStart - 0.001 ||
    guidepost.sourceTime > clip.sourceEnd + 0.001
  ) {
    return null;
  }
  return roundTime(clip.start + guidepost.sourceTime - clip.sourceStart);
};

const mappedGuideposts = (rule) =>
  rule.guideposts
    .map((guidepost) => ({
      ...guidepost,
      timelineTime: guidepostTimelineTime(rule, guidepost),
    }))
    .filter((guidepost) => guidepost.timelineTime !== null)
    .sort((left, right) => left.timelineTime - right.timelineTime);

const guidepostLabel = (rule, guidepost) =>
  `${rule.label} guidepost at ${formatTime(guidepost.timelineTime)}, ${guidepost.polarity} threshold crossing`;

const nudgeGuidepost = (ruleId, guidepostId, delta) => {
  const rule = state.audioSync.rules.find((candidate) => candidate.id === ruleId);
  const guidepost = rule?.guideposts.find((candidate) => candidate.id === guidepostId);
  const analysis = state.audioSync.analysis;
  if (!rule || !guidepost || !analysis) return;
  guidepost.sourceTime = roundTime(clamp(guidepost.sourceTime + delta, 0, analysis.duration));
  renderAudioSyncRules();
  renderAudioSyncGuideposts();
  announce(`${rule.label} guidepost moved to ${formatTime(guidepostTimelineTime(rule, guidepost) ?? 0)}.`);
  requestAnimationFrame(() =>
    document.querySelector(`[data-guidepost-id="${guidepost.id}"]`)?.focus()
  );
};

const deleteGuidepost = (ruleId, guidepostId) => {
  const rule = state.audioSync.rules.find((candidate) => candidate.id === ruleId);
  if (!rule) return;
  rule.guideposts = rule.guideposts.filter((candidate) => candidate.id !== guidepostId);
  renderAudioSyncRules();
  renderAudioSyncGuideposts();
  announce(`${rule.label} guidepost deleted.`);
};

const splitVideoClipsAtGuideposts = (rule) => {
  const boundaries = mappedGuideposts(rule).map((guidepost) => guidepost.timelineTime);
  let cuts = 0;
  const originalClips = state.clips.filter((clip) => clip.kind === "video");
  for (const clip of originalClips) {
    const inside = boundaries.filter(
      (time) => time > clip.start + MIN_ITEM_DURATION && time < clip.start + clipDuration(clip) - MIN_ITEM_DURATION
    );
    if (!inside.length) continue;
    const originalEnd = clip.start + clipDuration(clip);
    const sourceTimelineOffset = clip.sourceStart - clip.start;
    const edges = [clip.start, ...inside, originalEnd];
    clip.sourceEnd = roundTime(edges[1] + sourceTimelineOffset);
    for (let index = 1; index < edges.length - 1; index += 1) {
      state.clips.push({
        ...clip,
        id: `clip-${nextClipId++}`,
        sourceStart: roundTime(edges[index] + sourceTimelineOffset),
        sourceEnd: roundTime(edges[index + 1] + sourceTimelineOffset),
        start: roundTime(edges[index]),
      });
      cuts += 1;
    }
  }
  renderTimeline();
  announce(cuts ? `${rule.label} created ${cuts} video ${cuts === 1 ? "cut" : "cuts"}.` : `${rule.label} has no guideposts inside a video clip.`);
};

const tierHasRoom = (tierId, start, duration) =>
  Math.abs(findValidStart(tierId, start, duration) - start) <= 0.01;

const fillGuidepostGap = (rule) => {
  const media = state.media.find(
    (candidate) => candidate.id === state.selectedMediaId && candidate.kind === "video"
  );
  if (!media) {
    announce("Select a video in Import Media before filling a guidepost gap.");
    return;
  }
  const guideposts = mappedGuideposts(rule);
  const interval = guideposts
    .slice(0, -1)
    .map((guidepost, index) => ({ end: guideposts[index + 1].timelineTime, start: guidepost.timelineTime }))
    .find((candidate) => candidate.start >= state.playhead - 0.01);
  if (!interval) {
    announce(`${rule.label} has no complete guidepost gap at or after the playhead.`);
    return;
  }
  const duration = roundTime(interval.end - interval.start);
  if (duration < MIN_ITEM_DURATION || media.duration + 0.001 < duration) {
    announce(`${media.name} is too short to fill the ${formatTime(duration)} guidepost gap.`);
    return;
  }
  const tier = state.tiers.find(
    (candidate) => candidate.kind === "video" && tierHasRoom(candidate.id, interval.start, duration)
  );
  if (!tier) {
    announce("The guidepost gap is occupied or overlaps clips on every Video tier.");
    return;
  }
  const clip = insertClipSegment(media, tier.id, interval.start, 0, duration, {
    announceChange: false,
    snap: false,
  });
  if (clip) announce(`${media.name} filled ${rule.label}'s ${formatTime(duration)} gap on ${tier.label}.`);
};

const addEffectsAtGuideposts = (rule, type) => {
  const definition = EFFECTS[type];
  if (!definition?.timelineInsertable) return;
  const guideposts = mappedGuideposts(rule);
  guideposts.forEach((guidepost) => insertEffect(type, guidepost.timelineTime));
  renderTimeline();
  announce(`${definition.label} added at ${guideposts.length} ${rule.label} guideposts.`);
};

const deleteAudioSyncRule = (ruleId) => {
  const index = state.audioSync.rules.findIndex((candidate) => candidate.id === ruleId);
  if (index < 0) return;
  const [rule] = state.audioSync.rules.splice(index, 1);
  renderAudioSyncRules();
  renderAudioSyncGuideposts();
  announce(`${rule.label} guidepost rule deleted.`);
};

const renderAudioSyncRules = () => {
  if (!elements.audioSyncRules || !elements.audioSyncRuleTemplate) return;
  elements.audioSyncRules.querySelectorAll("[data-audio-sync-rule-id]").forEach((item) => item.remove());
  if (elements.audioSyncRulesEmpty) elements.audioSyncRulesEmpty.hidden = state.audioSync.rules.length > 0;
  if (elements.audioSyncRuleTotal) {
    elements.audioSyncRuleTotal.textContent = `${state.audioSync.rules.length} ${state.audioSync.rules.length === 1 ? "rule" : "rules"}`;
  }
  for (const rule of state.audioSync.rules) {
    const fragment = elements.audioSyncRuleTemplate.content.cloneNode(true);
    const item = fragment.querySelector("[data-audio-sync-rule-id]");
    const color = fragment.querySelector("[data-audio-sync-rule-color]");
    const label = fragment.querySelector("[data-audio-sync-rule-label]");
    const mapped = mappedGuideposts(rule);
    item.dataset.audioSyncRuleId = rule.id;
    item.style.setProperty("--guidepost-color", rule.color);
    color.value = rule.color;
    label.value = rule.label;
    fragment.querySelector("[data-audio-sync-rule-count]").textContent = `${mapped.length} ${mapped.length === 1 ? "guidepost" : "guideposts"}`;
    color.addEventListener("input", (event) => {
      rule.color = event.target.value;
      renderAudioSyncGuideposts();
      item.style.setProperty("--guidepost-color", rule.color);
    });
    label.addEventListener("change", (event) => {
      rule.label = event.target.value.trim() || "Audio rule";
      renderAudioSyncRules();
      renderAudioSyncGuideposts();
      announce(`Guidepost rule renamed ${rule.label}.`);
    });
    fragment.querySelector('[data-guidepost-action="cut"]').addEventListener("click", () => splitVideoClipsAtGuideposts(rule));
    fragment.querySelector('[data-guidepost-action="fill"]').addEventListener("click", () => fillGuidepostGap(rule));
    const effectButton = fragment.querySelector('[data-guidepost-action="effect"]');
    const effectSelect = fragment.querySelector("[data-guidepost-effect-type]");
    effectSelect.disabled = false;
    effectButton.addEventListener("click", () => addEffectsAtGuideposts(rule, effectSelect.value));
    fragment.querySelector("[data-delete-audio-sync-rule]").addEventListener("click", () => deleteAudioSyncRule(rule.id));
    const markerList = fragment.querySelector("[data-audio-sync-marker-list]");
    for (const guidepost of mapped) {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.dataset.guidepostId = guidepost.id;
      marker.dataset.guidepostTime = String(guidepost.timelineTime);
      marker.dataset.guidepostSourceTime = String(guidepost.sourceTime);
      marker.dataset.guidepostGroupId = rule.id;
      marker.setAttribute("role", "listitem");
      marker.setAttribute("aria-label", guidepostLabel(rule, guidepost));
      marker.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Delete Enter");
      marker.textContent = `${formatTime(guidepost.timelineTime)} · ${guidepost.polarity}`;
      marker.style.borderLeft = `5px solid ${rule.color}`;
      marker.addEventListener("click", () => setPlayhead(guidepost.timelineTime, true));
      marker.addEventListener("keydown", (event) => {
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          deleteGuidepost(rule.id, guidepost.id);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          const amount = event.shiftKey ? GUIDEPOST_LARGE_NUDGE : GUIDEPOST_NUDGE;
          nudgeGuidepost(rule.id, guidepost.id, event.key === "ArrowLeft" ? -amount : amount);
        } else if (event.key === "Enter") {
          event.preventDefault();
          setPlayhead(guidepost.timelineTime, true);
        }
      });
      markerList.append(marker);
    }
    elements.audioSyncRules.append(fragment);
  }
};

const renderAudioSyncGuideposts = () => {
  if (!elements.audioSyncGuideLayer || !elements.audioSyncGuidepostTemplate) return;
  elements.audioSyncGuideLayer.replaceChildren();
  for (const rule of state.audioSync.rules) {
    const mapped = mappedGuideposts(rule);
    if (!mapped.length) continue;
    const template = elements.audioSyncGuidepostTemplate.content;
    const group = template.firstElementChild.cloneNode(false);
    group.dataset.guidepostGroupId = rule.id;
    group.dataset.guidepostColor = rule.color;
    group.dataset.guidepostSourceClipId = rule.sourceClipId;
    group.style.setProperty("--guidepost-color", rule.color);
    for (const guidepost of mapped) {
      const marker = template.querySelector("[data-guidepost-visual-id]").cloneNode(true);
      marker.dataset.guidepostVisualId = guidepost.id;
      marker.dataset.guidepostTime = String(guidepost.timelineTime);
      marker.dataset.guidepostSourceTime = String(guidepost.sourceTime);
      marker.style.setProperty("--guidepost-x", `${guidepost.timelineTime * state.pixelsPerSecond}px`);
      group.append(marker);
    }
    elements.audioSyncGuideLayer.append(group);
  }
};

const createAudioSyncRule = ({ detector = "band", direction, label, maximum, minimum, threshold } = {}) => {
  const analysis = state.audioSync.analysis;
  const clip = selectedAudioSyncClip();
  const api = audioSyncApi();
  if (!analysis || !clip || !api) {
    setAudioSyncStatus("Analyze an Audio timeline clip before generating guideposts.", "error");
    return null;
  }
  const range = normalizedAudioSyncRange();
  const boundedMinimum = minimum ?? range.minimum;
  const boundedMaximum = maximum ?? range.maximum;
  const series = selectedAudioSyncSeries({ detector, maximum: boundedMaximum, minimum: boundedMinimum });
  const normalizedThreshold = threshold ?? Number(elements.audioSyncThreshold?.value || 65) / 100;
  const selectedDirection = direction || elements.audioSyncDirection?.value || "rising";
  const crossings = api.findThresholdCrossings(
    analysis.frameTimes,
    series,
    normalizedThreshold,
    selectedDirection,
    { minimumSpacing: detector === "onset" ? 0.28 : 0.18 }
  );
  const rule = {
    color: GUIDEPOST_COLORS[(nextAudioSyncRuleId - 1) % GUIDEPOST_COLORS.length],
    detector,
    direction: selectedDirection,
    guideposts: crossings.map((crossing) => ({
      id: `guidepost-${nextGuidepostId++}`,
      polarity: crossing.polarity,
      score: crossing.score,
      sourceTime: roundTime(crossing.time),
    })),
    id: `audio-sync-rule-${nextAudioSyncRuleId++}`,
    label: label || `${Math.round(boundedMinimum)}–${Math.round(boundedMaximum)} Hz ${selectedDirection}`,
    maximum: boundedMaximum,
    mediaId: state.audioSync.analysisMediaId,
    minimum: boundedMinimum,
    sourceClipId: clip.id,
    threshold: normalizedThreshold,
  };
  state.audioSync.rules.push(rule);
  renderAudioSyncRules();
  renderAudioSyncGuideposts();
  setAudioSyncStatus(`${rule.label} created ${rule.guideposts.length} ${rule.guideposts.length === 1 ? "guidepost" : "guideposts"}.`, "ready");
  announce(`${rule.label} guidepost rule created with ${rule.guideposts.length} markers.`);
  return rule;
};

const createRecommendedAudioSyncRule = (type) => {
  const analysis = state.audioSync.analysis;
  const api = audioSyncApi();
  if (!analysis || !api) return;
  const nyquist = analysis.sampleRate / 2;
  const definitions = {
    low: { label: "Recommended lows", maximum: Math.min(250, nyquist), minimum: 40 },
    mid: { label: "Recommended mids", maximum: Math.min(2000, nyquist), minimum: 250 },
    high: { label: "Recommended highs", maximum: Math.min(8000, nyquist), minimum: 2000 },
    beats: { detector: "onset", label: "Recommended beats", maximum: Math.min(8000, nyquist), minimum: 40 },
  };
  const definition = definitions[type];
  if (!definition) return;
  const series = selectedAudioSyncSeries(definition);
  createAudioSyncRule({
    ...definition,
    direction: "rising",
    threshold: api.recommendThreshold(series, type === "beats" ? 0.68 : 0.75),
  });
};

const allMappedGuideposts = () =>
  state.audioSync.rules.flatMap((rule) =>
    mappedGuideposts(rule).map((guidepost) => ({ ...guidepost, color: rule.color, rule }))
  );

const videoActiveAtTime = (time) =>
  state.clips.some(
    (clip) => clip.kind === "video" && time >= clip.start && time < clip.start + clipDuration(clip)
  );

const flashGuidepost = (guidepost) => {
  if (!elements.audioSyncFlash || videoActiveAtTime(guidepost.timelineTime)) return;
  window.clearTimeout(guidepostFlashTimer);
  elements.audioSyncFlash.hidden = false;
  elements.audioSyncFlash.dataset.flashActive = "true";
  elements.audioSyncFlash.dataset.guidepostId = guidepost.id;
  elements.audioSyncFlash.dataset.guidepostGroupId = guidepost.rule.id;
  elements.audioSyncFlash.dataset.guidepostColor = guidepost.color;
  elements.audioSyncFlash.style.backgroundColor = guidepost.color;
  guidepostFlashTimer = window.setTimeout(() => {
    elements.audioSyncFlash.dataset.flashActive = "false";
    elements.audioSyncFlash.hidden = true;
  }, GUIDEPOST_FLASH_DURATION_MS);
};

const flashCrossedGuideposts = (from, to) => {
  if (to <= from) return;
  const crossed = allMappedGuideposts().filter(
    (guidepost) => guidepost.timelineTime > from && guidepost.timelineTime <= to
  );
  crossed.forEach(flashGuidepost);
};

const openOfficialYoutubeSearch = (query, suffix = "") => {
  const value = String(query || "").trim();
  if (!value) {
    announce("Enter a YouTube search first.");
    return false;
  }
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", `${value}${suffix}`.trim());
  const youtubeUrl = url.href;
  let popup = null;
  try {
    popup = window.open(youtubeUrl, "_blank", "noopener,noreferrer");
    if (popup) popup.opener = null;
  } catch {
    popup = null;
  }
  if (!popup) {
    announce("YouTube search was blocked. Allow pop-ups and try again.");
    return false;
  }
  announce("Official YouTube search opened in a new tab. Import audio you have rights to use as a local file.");
  return true;
};

const updateAudioLocalRange = () => {
  const media = state.media.find((candidate) => candidate.id === state.audioLocal.mediaId);
  if (!media) return false;
  const start = clamp(Number(elements.audioLocalStart?.value || 0), 0, media.duration);
  const end = clamp(Number(elements.audioLocalEnd?.value || media.duration), 0, media.duration);
  state.audioLocal.sourceStart = roundTime(start);
  state.audioLocal.sourceEnd = roundTime(end);
  if (elements.audioLocalStart) elements.audioLocalStart.value = String(state.audioLocal.sourceStart);
  if (elements.audioLocalEnd) elements.audioLocalEnd.value = String(state.audioLocal.sourceEnd);
  if (elements.audioLocalStartOutput) elements.audioLocalStartOutput.textContent = formatTime(state.audioLocal.sourceStart);
  if (elements.audioLocalEndOutput) elements.audioLocalEndOutput.textContent = formatTime(state.audioLocal.sourceEnd);
  const valid = state.audioLocal.sourceEnd > state.audioLocal.sourceStart;
  if (elements.audioLocalInsert) elements.audioLocalInsert.disabled = !valid;
  if (valid && elements.audioLocalPreview) setMediaTime(elements.audioLocalPreview, state.audioLocal.sourceStart);
  return valid;
};

const insertLocalAudioSelection = () => {
  const media = state.media.find(
    (candidate) => candidate.id === state.audioLocal.mediaId && candidate.kind === "audio"
  );
  const tier = firstTierForKind("audio");
  if (!media || !tier || !updateAudioLocalRange()) {
    announce("Choose at least 0.25 seconds of local audio.");
    return;
  }
  if (state.audioLocal.sourceEnd - state.audioLocal.sourceStart < MIN_ITEM_DURATION) {
    state.audioLocal.sourceEnd = roundTime(
      Math.min(media.duration, state.audioLocal.sourceStart + MIN_ITEM_DURATION)
    );
    if (state.audioLocal.sourceEnd - state.audioLocal.sourceStart < MIN_ITEM_DURATION) {
      state.audioLocal.sourceStart = roundTime(
        Math.max(0, state.audioLocal.sourceEnd - MIN_ITEM_DURATION)
      );
    }
    if (elements.audioLocalStart) elements.audioLocalStart.value = String(state.audioLocal.sourceStart);
    if (elements.audioLocalEnd) elements.audioLocalEnd.value = String(state.audioLocal.sourceEnd);
    if (elements.audioLocalStartOutput) elements.audioLocalStartOutput.textContent = formatTime(state.audioLocal.sourceStart);
    if (elements.audioLocalEndOutput) elements.audioLocalEndOutput.textContent = formatTime(state.audioLocal.sourceEnd);
  }
  insertClipSegment(
    media,
    tier.id,
    state.playhead,
    state.audioLocal.sourceStart,
    state.audioLocal.sourceEnd
  );
};

const writeAscii = (view, offset, value) => {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
};

const encodeWaveFile = (samples, sampleRate) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => {
    view.setInt16(44 + index * 2, Math.round(clamp(sample, -1, 1) * 32767), true);
  });
  return new Blob([buffer], { type: "audio/wav" });
};

const synthesizeClick = () => {
  const samples = new Float32Array(Math.round(CLICK_SOUND_DURATION * SOUND_EFFECT_SAMPLE_RATE));
  let noise = 0x12345678;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / SOUND_EFFECT_SAMPLE_RATE;
    noise = (1664525 * noise + 1013904223) >>> 0;
    const random = noise / 0xffffffff - 0.5;
    const envelope = Math.exp(-time * 44);
    samples[index] = envelope * (0.72 * Math.sin(2 * Math.PI * 1450 * time) + 0.32 * random);
  }
  return samples;
};

const synthesizeTyping = (duration) => {
  const samples = new Float32Array(Math.round(duration * SOUND_EFFECT_SAMPLE_RATE));
  const spacing = 0.145;
  for (let pulse = 0; pulse * spacing < duration; pulse += 1) {
    const start = Math.round(pulse * spacing * SOUND_EFFECT_SAMPLE_RATE);
    const pitch = 720 + (pulse % 4) * 95;
    const length = Math.min(samples.length - start, Math.round(0.055 * SOUND_EFFECT_SAMPLE_RATE));
    for (let index = 0; index < length; index += 1) {
      const time = index / SOUND_EFFECT_SAMPLE_RATE;
      samples[start + index] += Math.exp(-time * 70) * Math.sin(2 * Math.PI * pitch * time) * 0.58;
    }
  }
  return samples;
};

const soundEffectDuration = () =>
  state.soundEffect.preset === "click"
    ? CLICK_SOUND_DURATION
    : state.soundEffect.loop
      ? clamp(Number(elements.soundEffectDuration?.value || 3), 1, 30)
      : TYPING_SOUND_DURATION;

const createSoundEffectFile = () => {
  const duration = soundEffectDuration();
  const samples = state.soundEffect.preset === "click" ? synthesizeClick() : synthesizeTyping(duration);
  const label = state.soundEffect.preset === "click" ? "Click" : "Typing";
  return {
    duration,
    file: new File([encodeWaveFile(samples, SOUND_EFFECT_SAMPLE_RATE)], `${label.toLowerCase()}-sound-effect.wav`, { type: "audio/wav" }),
    label,
  };
};

const updateSoundEffectControls = () => {
  const typing = state.soundEffect.preset === "typing";
  elements.soundEffectPresets.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.soundEffectPreset === state.soundEffect.preset));
  });
  if (elements.soundEffectLoop) {
    elements.soundEffectLoop.disabled = !typing;
    elements.soundEffectLoop.checked = typing && state.soundEffect.loop;
  }
  if (elements.soundEffectDuration) {
    elements.soundEffectDuration.disabled = !typing || !state.soundEffect.loop;
    elements.soundEffectDuration.value = String(state.soundEffect.duration);
  }
  if (elements.soundEffectPreview) elements.soundEffectPreview.textContent = `Preview ${typing ? "Typing" : "Click"}`;
  if (elements.soundEffectStatus) {
    elements.soundEffectStatus.textContent = typing
      ? `Typing preset ready${state.soundEffect.loop ? `; loops for ${state.soundEffect.duration} seconds` : "; 1.2 seconds"}.`
      : "Click preset ready; 0.12 seconds.";
  }
};

const stopSoundEffectPreview = () => {
  soundEffectPreviewPlayer?.pause();
  soundEffectPreviewPlayer = null;
  if (soundEffectPreviewUrl) URL.revokeObjectURL(soundEffectPreviewUrl);
  soundEffectPreviewUrl = "";
};

const previewSoundEffect = () => {
  stopSoundEffectPreview();
  const generated = createSoundEffectFile();
  soundEffectPreviewUrl = URL.createObjectURL(generated.file);
  soundEffectPreviewPlayer = new Audio(soundEffectPreviewUrl);
  soundEffectPreviewPlayer.addEventListener("ended", stopSoundEffectPreview, { once: true });
  soundEffectPreviewPlayer.play().catch(() => {
    if (elements.soundEffectStatus) elements.soundEffectStatus.textContent = "Preview could not start. Try again.";
  });
  if (elements.soundEffectStatus) elements.soundEffectStatus.textContent = `Previewing ${generated.label}, ${formatTime(generated.duration)}.`;
};

const insertSoundEffect = () => {
  const generated = createSoundEffectFile();
  const url = URL.createObjectURL(generated.file);
  const media = {
    duration: generated.duration,
    file: generated.file,
    id: `media-${nextMediaId++}`,
    kind: "audio",
    name: generated.file.name,
    url,
  };
  state.media.push(media);
  state.audioLocal.mediaId = media.id;
  state.selectedMediaId = media.id;
  renderMediaBin();
  const tier = firstTierForKind("audio");
  if (tier) {
    insertClipSegment(media, tier.id, state.playhead, 0, media.duration, {
      minimumDuration: 0.01,
    });
  }
  if (elements.soundEffectStatus) elements.soundEffectStatus.textContent = `${generated.label} inserted at the playhead.`;
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

const setPlaybackButtonState = (isPlaying) => {
  if (!elements.playButton) return;
  elements.playButton.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  elements.playButton.setAttribute("aria-pressed", String(isPlaying));
  const icon = elements.playButton.querySelector("[data-transport-icon]");
  if (icon) {
    icon.src = isPlaying
      ? "../assets/pixelarticons/pause.svg"
      : "../assets/pixelarticons/play.svg";
  }
};

const pausePlayback = () => {
  state.playing = false;
  cancelAnimationFrame(state.animationFrame);
  window.clearTimeout(guidepostFlashTimer);
  if (elements.audioSyncFlash) {
    elements.audioSyncFlash.dataset.flashActive = "false";
    elements.audioSyncFlash.hidden = true;
  }
  elements.previewVideo?.pause();
  audioPlayers.forEach((player) => player.pause());
  setPlaybackButtonState(false);
};

const playbackTick = (now) => {
  if (!state.playing) return;
  const nextPlayhead = (now - state.playbackStartedAt) / 1000;
  if (nextPlayhead >= projectDuration()) {
    flashCrossedGuideposts(state.playbackPreviousTime, projectDuration());
    setPlayhead(projectDuration());
    pausePlayback();
    announce("Playback reached the end of the timeline.");
    return;
  }
  flashCrossedGuideposts(state.playbackPreviousTime, nextPlayhead);
  state.playbackPreviousTime = nextPlayhead;
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
  state.playbackPreviousTime = state.playhead;
  setPlaybackButtonState(true);
  syncPreview();
  state.animationFrame = requestAnimationFrame(playbackTick);
  announce(`Playback started at ${formatTime(state.playhead)}.`);
};

const renderTimeline = () => {
  renderRuler();
  renderTiers();
  renderEffects();
  renderAudioSyncGuideposts();
  renderAudioSyncRules();
  renderAudioToolSources();
  updateTimeDisplay();
  syncPreview();
};

const focusTab = (type) => {
  const tab = type
    ? document.querySelector(`[data-effect-tab-wrapper][data-effect="${type}"]`)
    : elements.defaultTab;
  tab?.focus();
  tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
};

const activateTab = (type, shouldFocus = false) => {
  if (type !== null && !state.openTabs.includes(type)) return;
  state.activeTab = type;
  renderTabs();
  if (type === "audio-sync-cut") requestAnimationFrame(renderAudioSyncGraphs);
  if (shouldFocus) requestAnimationFrame(() => focusTab(type));
};

const openEffectTab = (type) => {
  const definition = EFFECTS[type];
  if (!definition) return;
  if (!state.openTabs.includes(type)) state.openTabs.push(type);
  state.closedTabs = state.closedTabs.filter((candidate) => candidate !== type);
  state.activeTab = type;
  renderTabs();
  if (type === "audio-sync-cut") requestAnimationFrame(renderAudioSyncGraphs);
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
  announce(
    `${EFFECTS[type].label} effect editor closed. Choose it from Project Media to reopen it.`
  );
  requestAnimationFrame(() => focusTab(state.activeTab));
};

const reorderTab = (type, targetIndex) => {
  const currentIndex = state.openTabs.indexOf(type);
  if (currentIndex === -1) return;
  const boundedTarget = clamp(targetIndex, 0, state.openTabs.length - 1);
  state.openTabs.splice(currentIndex, 1);
  state.openTabs.splice(boundedTarget, 0, type);
  renderTabs();
  announce(`${EFFECTS[type].label} tab moved to position ${boundedTarget + 2}.`);
  requestAnimationFrame(() => focusTab(type));
};

const renderTabs = () => {
  if (!elements.tabList || !elements.tabTemplate) return;
  elements.tabList.replaceChildren(...(elements.defaultTab ? [elements.defaultTab] : []));
  const defaultIsActive = state.activeTab === null;
  if (elements.defaultTab) {
    elements.defaultTab.classList.toggle("is-active", defaultIsActive);
    elements.defaultTab.setAttribute("aria-selected", String(defaultIsActive));
    elements.defaultTab.setAttribute("tabindex", defaultIsActive ? "0" : "-1");
    elements.defaultTab.setAttribute("aria-posinset", "1");
    elements.defaultTab.setAttribute("aria-setsize", String(state.openTabs.length + 1));
  }
  state.openTabs.forEach((type, index) => {
    const definition = EFFECTS[type];
    const fragment = elements.tabTemplate.content.cloneNode(true);
    const wrapper = fragment.querySelector("[data-effect-tab-wrapper]");
    const tabFace = fragment.querySelector("[data-effect-tab]");
    const close = fragment.querySelector("[data-close-effect-tab]");
    const isActive = state.activeTab === type;
    wrapper.dataset.effect = type;
    wrapper.classList.toggle("is-active", isActive);
    wrapper.id = `effect-tab-${type}`;
    wrapper.setAttribute("aria-label", definition.label);
    wrapper.setAttribute("aria-controls", `effect-panel-${type}`);
    wrapper.setAttribute("aria-selected", String(isActive));
    wrapper.setAttribute("tabindex", isActive ? "0" : "-1");
    wrapper.setAttribute("aria-posinset", String(index + 2));
    wrapper.setAttribute("aria-setsize", String(state.openTabs.length + 1));
    wrapper.setAttribute(
      "aria-keyshortcuts",
      "Control+ArrowLeft Control+ArrowRight Delete"
    );
    tabFace.href = `#effect-panel-${type}`;
    tabFace.dataset.effect = type;
    tabFace.title = definition.label;
    fragment.querySelector("[data-effect-tab-icon]").src = definition.icon;
    const titleViewport = fragment.querySelector("[data-effect-tab-title-viewport]");
    titleViewport.title = definition.label;
    fragment.querySelector("[data-effect-tab-label]").textContent = definition.label;
    fragment.querySelector("[data-close-effect-tab-label]").textContent = `Close ${definition.label} tab`;
    close.setAttribute("aria-label", `Close ${definition.label} tab`);
    tabFace.addEventListener("click", (event) => {
      event.preventDefault();
      activateTab(type);
    });
    wrapper.addEventListener("keydown", (event) => {
      if (event.target.closest("[data-close-effect-tab]")) return;
      if (event.key === "Delete") {
        event.preventDefault();
        closeEffectTab(type);
      } else if (event.ctrlKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        reorderTab(type, index + (event.key === "ArrowLeft" ? -1 : 1));
      } else if (!event.ctrlKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        const tabOrder = [null, ...state.openTabs];
        const currentIndex = index + 1;
        const nextIndex =
          (currentIndex + (event.key === "ArrowLeft" ? -1 : 1) + tabOrder.length) %
          tabOrder.length;
        activateTab(tabOrder[nextIndex], true);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        activateTab(event.key === "Home" ? null : state.openTabs.at(-1), true);
      }
    });
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      closeEffectTab(type);
    });
    wrapper.addEventListener("dragstart", (event) => {
      if (event.target.closest("[data-close-effect-tab]")) {
        event.preventDefault();
        return;
      }
      tabDragTargetIndex = null;
      setDragData(event, DRAG_TYPES.tab, type);
    });
    const acceptTabDrag = (event) => {
      const payload = getDragData(event);
      if (payload?.type !== DRAG_TYPES.tab || payload.id === type) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      tabDragTargetIndex = index;
      wrapper.classList.add("is-drag-target");
    };
    wrapper.addEventListener("dragenter", acceptTabDrag);
    wrapper.addEventListener("dragover", acceptTabDrag);
    wrapper.addEventListener("dragleave", (event) => {
      if (event.relatedTarget instanceof Node && wrapper.contains(event.relatedTarget)) return;
      wrapper.classList.remove("is-drag-target");
      if (tabDragTargetIndex === index) tabDragTargetIndex = null;
    });
    wrapper.addEventListener("drop", (event) => {
      event.preventDefault();
      const payload = getDragData(event);
      tabDragTargetIndex = null;
      clearDragStyles();
      if (payload?.type === DRAG_TYPES.tab) reorderTab(payload.id, index);
      dragPayload = null;
    });
    wrapper.addEventListener("dragend", () => {
      const pendingTargetIndex = tabDragTargetIndex;
      tabDragTargetIndex = null;
      dragPayload = null;
      clearDragStyles();
      if (pendingTargetIndex !== null) reorderTab(type, pendingTargetIndex);
    });
    elements.tabList.append(fragment);
  });
  scheduleEffectTabTitleMarquees();

  if (elements.editorEmpty) elements.editorEmpty.hidden = Boolean(state.activeTab);
  elements.editorEmpty?.setAttribute("aria-hidden", String(!defaultIsActive));
  document.querySelectorAll("[data-effect-editor]").forEach((panel) => {
    const active = panel.dataset.effectEditor === state.activeTab;
    panel.hidden = !active;
    panel.setAttribute("aria-hidden", String(!active));
  });
};

const bindStaticControls = () => {
  elements.framePreset?.addEventListener("change", (event) => {
    state.framePreset = event.target.value;
    if (elements.frameCustomSize) {
      elements.frameCustomSize.hidden = state.framePreset !== "custom";
    }
    const shouldAutoSelectSideBySide =
      state.framePreset === "9:16" && state.workspaceLayout === "standard";
    applyFrameSize(!shouldAutoSelectSideBySide);
    if (shouldAutoSelectSideBySide) {
      setWorkspaceLayout("side-by-side");
      const guidelinesPlatform = SOCIAL_GUIDELINE_PLATFORMS[state.guidelinesPlatform];
      const guidelinesStatus = guidelinesPlatform
        ? ` ${guidelinesPlatform.label} UI guidelines shown.`
        : "";
      announce(
        `Frame size set to Reel / TikTok (9:16). Workspace layout changed to Side by side.${guidelinesStatus}`
      );
    }
    if (state.framePreset === "custom") elements.frameCustomWidth?.focus();
  });
  elements.workspaceLayoutOptions.forEach((button) => {
    button.addEventListener("click", () => {
      setWorkspaceLayout(button.dataset.videoEditorWorkspaceLayoutOption, true);
    });
  });
  elements.defaultTabFace?.addEventListener("click", (event) => {
    event.preventDefault();
    activateTab(null);
  });
  elements.defaultTab?.addEventListener("keydown", (event) => {
    if (!event.ctrlKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      const target =
        event.key === "ArrowRight" ? state.openTabs[0] : state.openTabs.at(-1);
      activateTab(target ?? null, true);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      activateTab(event.key === "End" ? (state.openTabs.at(-1) ?? null) : null, true);
    }
  });
  elements.guidelinesPlatform?.addEventListener("change", (event) => {
    if (event.target.value !== "none" && !SOCIAL_GUIDELINE_PLATFORMS[event.target.value]) {
      return;
    }
    state.guidelinesPlatform = event.target.value;
    applySocialGuidelines(true);
  });
  elements.frameCustomWidth?.addEventListener("input", () => updateCustomFrameSize(true));
  elements.frameCustomHeight?.addEventListener("input", () => updateCustomFrameSize(true));
  elements.frameCustomWidth?.addEventListener("change", () =>
    updateCustomFrameSize(true, true)
  );
  elements.frameCustomHeight?.addEventListener("change", () =>
    updateCustomFrameSize(true, true)
  );
  bindPreviewTimelineSeparator();
  bindSidePanelSeparator("media");
  bindSidePanelSeparator("effects");
  elements.importButton?.addEventListener("click", () => elements.mediaInput?.click());
  elements.mediaInput?.addEventListener("change", (event) => importFiles(event.target.files));
  elements.audioSyncSource?.addEventListener("change", (event) => {
    state.audioSync.sourceClipId = event.target.value || null;
    const clip = selectedAudioSyncClip();
    const media = clip ? mediaForClip(clip) : null;
    if (!media || state.audioSync.analysisMediaId !== media.id) {
      state.audioSync.analysis = null;
      state.audioSync.analysisMediaId = null;
      if (elements.audioSyncGenerate) elements.audioSyncGenerate.disabled = true;
      elements.audioSyncRecommendations.forEach((button) => {
        button.disabled = true;
      });
      setAudioSyncStatus(
        clip ? `Analyze ${media.name} to create guideposts.` : "Choose an Audio timeline clip to begin.",
        "idle"
      );
    }
    renderAudioSyncGraphs();
  });
  elements.audioSyncAnalyze?.addEventListener("click", analyzeSelectedAudioClip);
  elements.audioSyncGraphView?.addEventListener("change", renderAudioSyncGraphs);
  for (const input of [elements.audioSyncFrequencyMin, elements.audioSyncFrequencyMax]) {
    input?.addEventListener("input", renderAudioSyncGraphs);
    input?.addEventListener("change", () => {
      normalizedAudioSyncRange();
      renderAudioSyncGraphs();
    });
  }
  elements.audioSyncThreshold?.addEventListener("input", (event) => {
    if (elements.audioSyncThresholdOutput) {
      elements.audioSyncThresholdOutput.textContent = `${event.target.value}%`;
    }
  });
  elements.audioSyncGenerate?.addEventListener("click", () => createAudioSyncRule());
  elements.audioSyncRecommendations.forEach((button) => {
    button.addEventListener("click", () =>
      createRecommendedAudioSyncRule(button.dataset.audioSyncRecommendation)
    );
  });

  const bindYoutubeSearch = (button, input, suffix) => {
    const form = button?.closest("form");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      openOfficialYoutubeSearch(input?.value, suffix);
    });
  };
  bindYoutubeSearch(elements.audioYoutubeSearch, elements.audioYoutubeQuery, "");
  bindYoutubeSearch(elements.soundYoutubeSearch, elements.soundYoutubeQuery, "");
  elements.audioLocalFile?.addEventListener("change", async (event) => {
    const imported = await importFiles(event.target.files);
    const media = imported.find((candidate) => candidate.kind === "audio");
    if (media) setAudioLocalSource(media.id);
    event.target.value = "";
  });
  elements.audioLocalSource?.addEventListener("change", (event) => {
    setAudioLocalSource(event.target.value);
    if (state.audioLocal.mediaId) {
      const media = state.media.find((candidate) => candidate.id === state.audioLocal.mediaId);
      announce(`${media?.name || "Local audio"} selected for trimming.`);
    }
  });
  for (const input of [elements.audioLocalStart, elements.audioLocalEnd]) {
    input?.addEventListener("input", updateAudioLocalRange);
    input?.addEventListener("change", () => {
      if (updateAudioLocalRange()) {
        announce(
          `Audio selection set from ${formatTime(state.audioLocal.sourceStart)} to ${formatTime(state.audioLocal.sourceEnd)}.`
        );
      }
    });
  }
  elements.audioLocalPreview?.addEventListener("play", () => {
    if (
      elements.audioLocalPreview.currentTime < state.audioLocal.sourceStart ||
      elements.audioLocalPreview.currentTime >= state.audioLocal.sourceEnd
    ) {
      elements.audioLocalPreview.currentTime = state.audioLocal.sourceStart;
    }
  });
  elements.audioLocalPreview?.addEventListener("timeupdate", () => {
    if (elements.audioLocalPreview.currentTime < state.audioLocal.sourceEnd) return;
    elements.audioLocalPreview.pause();
    elements.audioLocalPreview.currentTime = state.audioLocal.sourceStart;
  });
  elements.audioLocalInsert?.addEventListener("click", insertLocalAudioSelection);
  elements.soundEffectPresets.forEach((button) => {
    button.addEventListener("click", () => {
      state.soundEffect.preset = button.dataset.soundEffectPreset;
      if (state.soundEffect.preset !== "typing") state.soundEffect.loop = false;
      updateSoundEffectControls();
      announce(`${state.soundEffect.preset === "click" ? "Click" : "Typing"} sound effect selected.`);
    });
  });
  elements.soundEffectLoop?.addEventListener("change", (event) => {
    state.soundEffect.loop = event.target.checked;
    updateSoundEffectControls();
  });
  elements.soundEffectDuration?.addEventListener("change", (event) => {
    state.soundEffect.duration = roundTime(clamp(Number(event.target.value || 3), 1, 30));
    updateSoundEffectControls();
  });
  elements.soundEffectPreview?.addEventListener("click", previewSoundEffect);
  elements.soundEffectInsert?.addEventListener("click", insertSoundEffect);
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
    stopSoundEffectPreview();
    audioAnalysisWorker?.terminate();
    clearAuthenticationTimers();
    authenticationController?.abort();
    previewResizeObserver?.disconnect();
    sidePanelResizeObserver?.disconnect();
    effectTabResizeObserver?.disconnect();
    cancelAnimationFrame(effectTabMarqueeFrame);
    for (const media of state.media) URL.revokeObjectURL(media.url);
  });
};

if (elements.app) {
  elements.previewVideo.muted = true;
  bindStaticControls();
  applyFrameSize();
  setWorkspaceLayout(state.workspaceLayout);
  setPreviewSplit(state.previewSplit);
  reconcileSidePanelWidths();
  if (elements.previewViewport && "ResizeObserver" in window) {
    previewResizeObserver = new ResizeObserver(fitPreviewStage);
    previewResizeObserver.observe(elements.previewViewport);
  }
  if ("ResizeObserver" in window) {
    sidePanelResizeObserver = new ResizeObserver(reconcileSidePanelWidths);
    sidePanelResizeObserver.observe(elements.app);
    if (elements.effectsPanel) {
      effectTabResizeObserver = new ResizeObserver(scheduleEffectTabTitleMarquees);
      effectTabResizeObserver.observe(elements.effectsPanel);
    }
  }
  window.addEventListener("resize", () => {
    reconcileSidePanelWidths();
    fitPreviewStage();
    scheduleEffectTabTitleMarquees();
  });
  renderMediaBin();
  renderAudioSyncRules();
  renderAudioSyncGraphs();
  updateSoundEffectControls();
  renderTabs();
  renderTimeline();
  initializeAuthentication();
}
