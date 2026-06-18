(() => {
const { fitImagesIntoFrames, loadDeferredMedia } = window.homeMedia;
const { dom } = window.homeDom;

const {
  clock,
  startButton,
  appButtons,
  appWindows,
  closeButtons,
  draggableWindows,
  snakeLoadingPanel,
  snakeLoadingMeter,
  snakeLoadingMeterFill,
  snakeLoadingPercent,
  snakeCanvas,
  snakeNoiseCanvas,
  snakeStatus,
  snakeScore,
  snakeHighScore,
  snakeBoardSizeButtons,
  snakeColorButtons,
  snakeAppleColorButtons,
  snakeStart,
  snakeReset,
  snakeHelp,
  snakeDirectionButtons,
  sudokuWindow,
  sudokuApp,
  sudokuAeroPanel,
  sudokuLoadingScreen,
  sudokuAquariumLayer,
  sudokuLoadingMeter,
  sudokuLoadingFill,
  sudokuPlay,
  sudokuGrid,
  sudokuDifficultyButtons,
  sudokuNumberButtons,
  sudokuHintButtons,
  sudokuNoteToggle,
  sudokuNew,
  sudokuUndo,
  sudokuRedo,
  sudokuCheck,
  sudokuStatus,
  sudokuMistakes,
  sudokuTime,
  sudokuSolvePopup,
  sudokuSolveMessage,
  sudokuSolveOk,
  sudokuAchievement,
  lifeCounterPlayers,
  lifeCounterAddPlayer,
  lifeCounterReset,
  lifeCounterWidthDecrease,
  lifeCounterWidthIncrease,
  creditsIcons,
  calendarButton,
  calendarPopout,
  calendarPanel,
  calendarSection,
  calendarHeader,
  calendarGrid,
  calendarPrev,
  calendarNext,
  calendarClock,
  clockImage,
  clockQuote,
  randomEventWindow,
  randomEventTitle,
  randomEventImage,
  randomEventClose,
  randomEventOk,
  felizJuevesWindow,
  felizJuevesClose,
  felizJuevesGracias,
  randomAlertWindow,
  randomAlertClose,
  randomAlertMaximize,
  randomAlertMinimize,
  randomAlertYes,
  randomAlertNo,
  randomAlertRememberRow,
  randomAlertRemember,
  selfLoveAlertWindow,
  selfLoveAlertClose,
  selfLoveAlertYes,
  selfLoveAlertNo,
  rohinUpdateWindow,
  rohinUpdateRun,
  rohinUpdateLater,
  mcAfeePromptWindow,
  mcAfeeDownloadWindow,
  mcAfeeThanksWindow,
  mcAfeeUpdateRun,
  mcAfeeUpdateLater,
  mcAfeeProgress,
  mcAfeeProgressBar,
  mcAfeeDownloadStatus,
  mcAfeeComplete,
  mcAfeeThanksOk,
  rohinNoteWindow,
  rohinNoteOk,
  earthNoteWindow,
  earthNoteOk,
  healthNoteWindow,
  healthNoteOk,
  loveNoteWindow,
  loveNoteOk,
  castleGateWindow,
  castleGateOk,
  possumSpringsWindow,
  possumSpringsOk,
  wingedLightWindow,
  wingedLightCollect,
  wingedLightLater,
  manaFloodWindow,
  manaFloodOk,
  mimicWarningWindow,
  mimicWarningOk,
  skillCheckWindow,
  skillCheckResultWindow,
  skillCheckRoll,
  skillCheckIgnore,
  skillCheckDieTens,
  skillCheckDieOnes,
  skillCheckResultIcon,
  skillCheckResultText,
  skillCheckResultOk,
  distressSignalWindow,
  distressSignalClose,
  distressRadioPanel,
  distressPowerButton,
  distressPowerProgressBar,
  distressSignalCanvas,
  distressFrequencyDial,
  distressPhaseDial,
  distressNavPanel,
  distressMinimapArrow,
  distressNavState,
  distressBearingReadout,
  distressRangeReadout,
  distressStrengthReadout,
  distressLockStatus,
  distressLockStatusText,
  distressNavNoiseCanvas,
  distressStatusNoiseCanvas,
  distressUploadWindow,
  distressUploadOk,
  nazarWindow,
  nazarClose,
  nazarYes,
  nazarNo,
  siteGraceWindow,
  siteGraceTouch,
  siteGraceKeep,
  lostGraceOverlay,
  stalkerWindow,
  stalkerYes,
  stalkerNo,
  stalkerResultWindow,
  stalkerResultOk,
  nanaEncounterWindow,
  nanaEncounterYes,
  nanaEncounterNo,
  nanaAcceptWindow,
  nanaAcceptOk,
  lainAlertWindow,
  lainAlertOk,
  lelouchAlertWindow,
  lelouchAlertOk,
  instrumentalityWindow,
  instrumentalityYes,
  instrumentalityNo,
  instrumentalityCongratsWindow,
  instrumentalityCongratsOk,
  redToolWindow,
  redToolClose,
  redToolChatLog,
  redToolInput,
  redToolSend,
  fateWindow,
  fateTitle,
  fateReadyStage,
  fateFightStage,
  fateResultStage,
  fateProgress,
  fateProgressBar,
  fateStart,
  fateResist,
  fateLightningCanvas,
  fateResultImage,
  fateResultCredit,
  fateResultText,
  fateResultOk,
  behelitWindow,
  behelitOk,
  johnPorkWindow,
  johnPorkStatus,
  johnPorkClose,
  johnPorkAccept,
  johnPorkDecline,
  advertisementWindow,
  advertisementNoThanks,
  bidenBlastWindow,
  bidenBlastOk,
  infinityArmoryWindow,
  infinityArmoryClose,
  infinityArmoryLevel,
  infinityArmoryUpgrade,
  infinityArmoryPrice,
  infinityArmoryGold,
  infinityArmoryStatus,
  infinityArmorySlots,
  infinityArmoryGemGrid,
  virusWindow,
  virusBorderLightningCanvas,
  virusYes,
  virusNo,
  virusRescueWindow,
  virusRescueText,
  virusRescueThanks,
  openFrontiersPdf,
  openPulsePresentation,
  openDronePresentation,
  openTcpPaper,
  openTcpPresentation,
  openWritingTcpPaper,
  openBioe190Presentation,
  openBioe190Proposal,
  pdfIframe,
  pulsePresentationIframe,
  dronePresentationIframe,
  studyTree,
  studyFilePane,
  studyAddress,
  studyCurrentTitle,
  studyItemCount,
  studyPreviewIcon,
  studyPreviewTitle,
  studyPreviewBody,
  studyOpenWindow,
  studyOpenTab,
  studyDownload,
  studyUp,
  studyListView,
  studyGalleryView,
  studyStatusLeft,
  studyStatusRight,
  studyPdfTitle,
  studyPdfIframe,
  pulseProjectImage,
  pulseProjectCaption,
  pulseProjectDescription,
  pulseProjectPrev,
  pulseProjectCounter,
  pulseProjectNext,
  tcpResultsImage,
  tcpResultsCaption,
  tcpResultsDescription,
  tcpResultsPrev,
  tcpResultsCounter,
  tcpResultsNext,
  droneProjectVideo,
  droneVideoCaption,
  droneVideoPrev,
  droneVideoCounter,
  droneVideoNext,
} = dom;

let infinityArmoryGems = [];
let infinityArmoryInventoryGems = [];

// Clash Royale app logic (disabled for now).
// To re-enable: uncomment the CLASH_* constants, clash* variables,
// the block below, and the two event hooks further down.
// const clashRefresh = document.getElementById("cr-refresh");
// const clashStatus = document.getElementById("cr-status");

// const CLASH_API_BASE_URL = "https://api.clashroyale.com/v1";
// const CLASH_API_TOKEN = "";
// const CLASH_PLAYER_TAG = "28CYYU08P";
// const CLASH_SAMPLE_SIZE = 25;
const PULSE_PROJECT_BASE_URL = "https://rohinshanker.github.io/pulse-oximeter";
const PULSE_PRESENTATION_PDF_URL =
  `${PULSE_PROJECT_BASE_URL}/course%20resources/pulse%20ox%20slides.pdf#page=1&zoom=100&toolbar=0&navpanes=0`;
const pulseProjectFigures = [
  {
    src: `${PULSE_PROJECT_BASE_URL}/site-assets/demo-photo.jpg`,
    alt: "Working pulse oximeter demo with the yellow finger sleeve, OLED readout, laptop waveform, and commercial reference oximeter.",
    title: "Demo and validation",
    description:
      "Final bench demo with finger sleeve, live serial waveform, OLED readout, and commercial reference oximeter.",
  },
  {
    src: `${PULSE_PROJECT_BASE_URL}/site-assets/breadboard-2.jpg`,
    alt: "Early breadboard pulse oximeter circuit with Arduino and jumper wires.",
    title: "Prototype iteration 1",
    description:
      "Early analog chain and LED-control testing on a compact breadboard.",
  },
  {
    src: `${PULSE_PROJECT_BASE_URL}/site-assets/breadboard-1.jpg`,
    alt: "Expanded pulse oximeter prototype with multiple breadboards, OLED displays, and a yellow finger sleeve.",
    title: "Prototype iteration 2",
    description:
      "Expanded bench setup with display modules, separated wiring, and the printed finger sleeve.",
  },
  {
    src: `${PULSE_PROJECT_BASE_URL}/site-assets/breadboard-3.jpg`,
    alt: "Final breadboard prototype with Arduino MKR Zero, filtering circuit, and OLED display.",
    title: "Final circuit",
    description:
      "Cleaner final circuit with MKR Zero, analog filtering, OLED readout, and the optical finger interface.",
  },
];
const TCP_PROJECT_BASE_URL = "https://rohinshanker.github.io/EE-122-simulation";
const GITHUB_REPOSITORY_URL =
  "https://github.com/rohinshanker/personal-website";
const tcpResultFigures = [
  {
    src: `${TCP_PROJECT_BASE_URL}/analysis/plots/common_links/throughput_by_category_algorithm.png`,
    alt: "Throughput by algorithm across terrestrial, LEO, GEO 500 ms, and GEO 1000 ms profiles.",
    title: "Common links: throughput by category",
    description:
      "Compares receiver-side throughput across representative terrestrial, LEO, GEO 500 ms, and GEO 1000 ms profiles.",
  },
  {
    src: `${TCP_PROJECT_BASE_URL}/analysis/plots/delay/throughput_vs_delay_ms.png`,
    alt: "Throughput versus configured delay for CUBIC, Reno, BBRv3, and Vegas.",
    title: "Delay suite: throughput versus delay",
    description:
      "Shows how throughput changes as configured delay increases; CUBIC and Reno stay steadier while BBRv3 tapers and Vegas drops at GEO-scale delay.",
  },
  {
    src: `${TCP_PROJECT_BASE_URL}/analysis/plots/loss/retransmits_per_second_vs_loss_pct.png`,
    alt: "Retransmits per second versus configured packet loss for CUBIC, Reno, BBRv3, and Vegas.",
    title: "Loss suite: retransmits versus loss",
    description:
      "Shows BBRv3's aggressive probing tradeoff: higher throughput and utilization are paired with elevated retransmission rates as loss increases.",
  },
  {
    src: `${TCP_PROJECT_BASE_URL}/analysis/plots/summary/utilization_by_condition_heatmap.png`,
    alt: "Heatmap showing utilization by condition and algorithm.",
    title: "Utilization by condition and algorithm",
    description:
      "Summarizes utilization across conditions; BBRv3 is largely yellow and green, indicating higher utilization across many tested profiles.",
  },
];
const DRONE_PRESENTATION_PDF_URL =
  "https://rohinshanker.github.io/drone-navigation-project/assets/docs/EECS%20C106A%20Final%20Project%20-%20Group%2044%20-%20Google%20Slides.pdf#page=1&zoom=100&toolbar=0&navpanes=0";
const droneProjectVideos = [
  {
    src: "https://rohinshanker.github.io/drone-navigation-project/assets/videos/mujocosimulator.mp4",
    title: "MuJoCo simulation demo",
  },
  {
    src: "https://rohinshanker.github.io/drone-navigation-project/assets/videos/livedemo.mp4",
    title: "Live drone demo",
  },
];

const SNAKE_DEFAULT_GRID_SIZE = 16;
const SNAKE_HIGH_SCORE_KEY = "personalSiteSnakeHighScores";
const SNAKE_SETTINGS_KEY = "personalSiteSnakeSettingsV1";
const SNAKE_HIGH_SCORE_SAVE_DEBOUNCE_MS = 350;
const SNAKE_APPLE_SCORE_INTERVAL = 10;
const SNAKE_LOAD_MIN_MS = 1000;
const SNAKE_LOAD_MAX_MS = 4000;
const SNAKE_SIGNATURE_SWEEP_MS = 3200;
const SNAKE_SIGNATURE_SWEEP_CELL_RADIUS = 2;
const SNAKE_COLLECTION_PULSE_MS = 820;
const SNAKE_COLLECTION_PULSE_CELL_RADIUS = 2.5;
const SNAKE_TICK_MS = 118;
const SNAKE_DIRECTION_QUEUE_MAX = 2;
const SNAKE_RESUME_COUNTDOWN_MS = 900;
const SNAKE_RENDER_INTERVAL_MS = 1000 / 24;
const SNAKE_NOISE_INTERVAL_MS = 1000 / 16;
const SNAKE_RANDOM_APPLE_ATTEMPTS = 96;
const SNAKE_COLOR_THEMES = Object.freeze({
  green: {
    head: "#62ff78",
    body: "#2f9a4b",
    glow: "rgba(98, 255, 120, 0.75)",
    sweep: "rgba(98, 255, 120, 0.32)",
    sweepRing: "rgba(98, 255, 120, 0.16)",
    pulse: (alpha) => `rgba(98, 255, 120, ${alpha})`,
  },
  purple: {
    head: "#c77dff",
    body: "#7b2cbf",
    glow: "rgba(199, 125, 255, 0.75)",
    sweep: "rgba(199, 125, 255, 0.32)",
    sweepRing: "rgba(199, 125, 255, 0.16)",
    pulse: (alpha) => `rgba(199, 125, 255, ${alpha})`,
  },
  red: {
    head: "#ff6257",
    body: "#a8211d",
    glow: "rgba(255, 98, 87, 0.75)",
    sweep: "rgba(255, 98, 87, 0.32)",
    sweepRing: "rgba(255, 98, 87, 0.16)",
    pulse: (alpha) => `rgba(255, 98, 87, ${alpha})`,
  },
  blue: {
    head: "#65b7ff",
    body: "#2368c4",
    glow: "rgba(101, 183, 255, 0.75)",
    sweep: "rgba(101, 183, 255, 0.32)",
    sweepRing: "rgba(101, 183, 255, 0.16)",
    pulse: (alpha) => `rgba(101, 183, 255, ${alpha})`,
  },
});
const SNAKE_DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});
const SNAKE_KEY_DIRECTIONS = Object.freeze({
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
});

const SUDOKU_DIGITS = "123456789";
const SUDOKU_CELL_COUNT = 81;
const SUDOKU_STORAGE_KEY = "personalSiteSudokuStateV1";
const SUDOKU_SAVE_DEBOUNCE_MS = 250;
const SUDOKU_MAX_UNDO_STATES = 80;
const SUDOKU_MAX_FISH = 18;
const SUDOKU_MAX_BUBBLE_CLUSTERS = 5;
const createSudokuEmptyValues = () =>
  Array.from({ length: SUDOKU_CELL_COUNT }, () => "");
const createSudokuEmptyNotes = () =>
  Array.from({ length: SUDOKU_CELL_COUNT }, () => "");
const SUDOKU_LOAD_MIN_MS = 1300;
const SUDOKU_LOAD_MAX_MS = 2800;
const SUDOKU_PLAY_BURST_MS = 820;
const SUDOKU_FISH_TYPES = Object.freeze(["clown", "tang", "butterfly", "wrasse"]);
const SUDOKU_FISH_DEPTHS = Object.freeze({
  far: {
    size: [16, 28],
    opacity: [0.28, 0.46],
    blur: [0.5, 1.2],
    duration: [18000, 30000],
    school: [3, 7],
    schoolChance: 0.62,
    top: [16, 78],
    saturate: [0.75, 0.95],
  },
  mid: {
    size: [30, 48],
    opacity: [0.5, 0.68],
    blur: [0.12, 0.45],
    duration: [12000, 20000],
    school: [2, 5],
    schoolChance: 0.38,
    top: [20, 82],
    saturate: [0.95, 1.15],
  },
  near: {
    size: [56, 86],
    opacity: [0.72, 0.9],
    blur: [0, 0.12],
    duration: [8500, 14500],
    school: [1, 3],
    schoolChance: 0.18,
    top: [26, 84],
    saturate: [1.05, 1.25],
  },
});
const SUDOKU_WIN_EFFECTS = Object.freeze({
  hard: { fireworks: true, confetti: false },
  expert: { fireworks: true, confetti: false },
  master: { fireworks: true, confetti: true },
  extreme: { fireworks: true, confetti: true },
});
const SUDOKU_PUZZLES = Object.freeze({
  easy: {
    label: "Easy",
    puzzle:
      "402030000795020003001705400100004005609000000248507310900108500800050071017043092",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
  medium: {
    label: "Medium",
    puzzle:
      "000030007000026000300095426003900060650310048208067010920170000004250000510640090",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
  hard: {
    label: "Hard",
    puzzle:
      "060830000090000080381705400173080260600000708008500300000100004800250001510000092",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
  expert: {
    label: "Expert",
    puzzle:
      "002831000005400080001095406070000005059002000008060009906070530030000071000040090",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
  master: {
    label: "Master",
    puzzle:
      "400031050000006000380000400000080060009000000000067019006008004800209000507600002",
    solution:
      "462831957795426183381795426173984265659312748248567319926178534834259671517643892",
  },
  extreme: {
    label: "Extreme",
    puzzle:
      "600000010400000000020000000000050407008040300001090000300400200050100000000806009",
    solution:
      "693784512487512936125963874932651487568247391741398625319475268856129743274836159",
  },
});

const LIFE_COUNTER_STARTING_LIFE = 20;
const LIFE_COUNTER_MIN_VALUE = -9999;
const LIFE_COUNTER_MAX_VALUE = 99999;
const LIFE_COUNTER_STEP_VALUES = [1, 5, 10, 25, 50, 100, 500, 1000, 5000];
const LIFE_COUNTER_WINDOW_MIN_WIDTH = 254;
const LIFE_COUNTER_WINDOW_DEFAULT_WIDTH = 448;
const LIFE_COUNTER_WINDOW_COLUMN_WIDTH = 192;
const LIFE_COUNTER_WINDOW_COLUMN_GAP = 8;
const LIFE_COUNTER_WINDOW_EXTRA_WIDTH = 56;
const LIFE_COUNTER_WINDOW_VIEWPORT_PADDING = 24;
const LIFE_COUNTER_DIGIT_SOURCES = {
  "0": "assets/minesweeper_assets/digital_digits/digital_0.png",
  "1": "assets/minesweeper_assets/digital_digits/digital_1.png",
  "2": "assets/minesweeper_assets/digital_digits/digital_2.png",
  "3": "assets/minesweeper_assets/digital_digits/digital_3.png",
  "4": "assets/minesweeper_assets/digital_digits/digital_4.png",
  "5": "assets/minesweeper_assets/digital_digits/digital_5.png",
  "6": "assets/minesweeper_assets/digital_digits/digital_6.png",
  "7": "assets/minesweeper_assets/digital_digits/digital_7.png",
  "8": "assets/minesweeper_assets/digital_digits/digital_8.png",
  "9": "assets/minesweeper_assets/digital_digits/digital_9.png",
  "-": "assets/minesweeper_assets/digital_digits/digital_minus.png",
  " ": "assets/minesweeper_assets/digital_digits/digital_blank.png",
};

let topZ = 10;
let calendarDate = new Date();
let windowOffsetIndex = 0;
let snakeState = {
  snake: [],
  apples: [],
  collectionPulses: [],
  occupiedCells: new Set(),
  direction: "right",
  nextDirection: "right",
  directionQueue: [],
  score: 0,
  gridSize: SNAKE_DEFAULT_GRID_SIZE,
  color: "green",
  appleColor: "red",
  highScores: {},
  running: false,
  hasStarted: false,
  gameOver: false,
  tickTimer: null,
  countdownTimer: null,
  countdownStartedAt: 0,
  countdownDuration: 0,
  noiseFrame: null,
  loading: false,
};
let snakePointerPauseSuppressUntil = 0;
let snakeGridCanvas = null;
let snakeGridCacheKey = "";
let snakeHighScoreSaveTimer = null;
let snakeLoadingTimer = null;
let snakeLoadingStartedAt = 0;
let snakeLoadingDuration = 0;
let snakeLoadingProgress = 0;
let snakeRenderDirty = true;
let snakeLastRenderAt = 0;
let snakeLastNoiseAt = 0;
let snakeHudRenderCache = {
  score: "",
  highScore: "",
  startText: "",
  statusText: "",
  gridSize: null,
  color: "",
  appleColor: "",
};
const snakeReducedMotionMedia =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
let sudokuState = {
  difficulty: "easy",
  puzzle: SUDOKU_PUZZLES.easy.puzzle,
  solution: SUDOKU_PUZZLES.easy.solution,
  mistakes: 0,
  elapsedSeconds: 0,
  timerId: null,
  timerStartedAt: 0,
  loadingTimerId: null,
  transitionTimerId: null,
  loadingStartedAt: 0,
  loadingDuration: 0,
  loadingProgress: 0,
  playing: false,
  solved: false,
  usedHint: false,
  usedReveal: false,
  hintMode: "off",
  noteMode: false,
  values: createSudokuEmptyValues(),
  notes: createSudokuEmptyNotes(),
  undoStack: [],
  redoStack: [],
  selectedIndex: -1,
};
let sudokuCellElements = [];
let sudokuSaveTimerId = null;
let sudokuFishTimerId = null;
let sudokuBubbleTimerId = null;
const sudokuReducedMotionMedia =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
let lifeCounterPlayersState = [
  { id: 1, name: "Player 1", life: LIFE_COUNTER_STARTING_LIFE, selectedStep: 1 },
];
let lifeCounterNextPlayerId = 2;
let activeRandomEventKey = "";
let generalRandomEventClickCount = 0;
let minesweeperRandomEventClickCount = 0;
let solitaireRandomEventClickCount = 0;
let randomEventIdleTimer = null;
let activeAppDwellWindow = null;
let activeAppDwellStartedAt = 0;
let activeAppDwellTimer = null;
let randomAlertReopenTimer = null;
let randomAlertFlashTimer = null;
let selfLoveAlertFlashTimer = null;
let felizJuevesFlashTimer = null;
let felizJuevesShownFallbackDate = "";
let johnPorkStatusTimer = null;
let johnPorkStatusFrame = 0;
let mcAfeeProgressValue = 0;
let mcAfeeProgressTimer = null;
let mcAfeeDotsTimer = null;
let mcAfeeDotsFrame = 0;
let wordErrorWindows = [];
let wordErrorOpenTimers = [];
let wordErrorCloseTimers = [];
let wordErrorStackClosing = false;
let virusExploding = false;
let virusRescueAnchor = null;
let virusStrikeTimer = null;
let virusStrikeFrame = null;
let virusStrikeCanvas = null;
let lostGraceOverlayTimer = null;
let redToolTypingStartTimer = null;
let redToolReplyTimer = null;
let redToolTypingTimer = null;
let redToolTypingFrame = 0;
let redToolTypingElement = null;
let skillCheckRollTimer = null;
let skillCheckRollTimeout = null;
let skillCheckRolling = false;
let distressTargetFrequency = 50;
let distressTargetPhase = 50;
let distressSignalSolved = false;
let distressUploadTimer = null;
let distressNoiseAnimationFrame = null;
let distressPowerTimer = null;
let distressPoweredOn = false;
let distressPowerVisibleProgress = 0;
let distressSignalBearing = 0;
let distressSignalRange = 0;
let fateProgressValue = 0;
let fateDrainTimer = null;
let fateLightningTimer = null;
let fateLightningFrame = null;
let fateResolveTimer = null;
let fateResultOpenTimer = null;
let fateState = "idle";
let pulseProjectIndex = 0;
let tcpResultsIndex = 0;
let droneVideoIndex = 0;
let activeWindow = null;
const expandedWindowState = new WeakMap();
// let clashRoyaleLoaded = false;
// let clashRoyaleLoading = false;

const lockMobileViewportZoom = () => {
  let lastTouchEndAt = 0;
  const blockGesture = (event) => event.preventDefault();
  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    document.addEventListener(eventName, blockGesture, { passive: false });
  });
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches && event.touches.length > 1) event.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener(
    "touchend",
    (event) => {
      const target =
        event.target instanceof Element ? event.target : event.target?.parentElement;
      if (target?.closest("input, textarea, select")) return;
      const now = Date.now();
      if (now - lastTouchEndAt <= 300) event.preventDefault();
      lastTouchEndAt = now;
    },
    { passive: false }
  );
};

const updateClock = () => {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const updateCalendarClock = () => {
  if (!calendarClock || !calendarPopout.classList.contains("is-open")) return;
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const blinkOn = Math.floor(Date.now() / 500) % 2 === 0;
  const colonClass = blinkOn ? "clock-colon" : "clock-colon is-off";
  calendarClock.innerHTML = `${hours}<span class="${colonClass}">:</span>${minutes}<span class="${colonClass}">:</span>${seconds}`;
  updateClockImage(now);
};

const updateClockImage = (now) => {
  if (!clockImage || !calendarPopout.classList.contains("is-open")) return;
  const hour = now.getHours();
  let src = "assets/night.png";
  let label = "Night scene";

  if (hour >= 5 && hour < 7) {
    src = "assets/sunrise.png";
    label = "Sunrise scene";
  } else if (hour >= 7 && hour < 18) {
    src = "assets/day.png";
    label = "Day scene";
  } else if (hour >= 18 && hour < 20) {
    src = "assets/sunset.png";
    label = "Sunset scene";
  }

  if (clockImage.getAttribute("src") !== src) {
    clockImage.setAttribute("src", src);
    clockImage.setAttribute("alt", label);
  }
};

let activateVisibleContent = (root) => {
  loadDeferredMedia(root, true);
};

const isWindowVisible = (win) =>
  Boolean(
    win &&
      !win.classList.contains("is-hidden") &&
      !win.classList.contains("is-closing")
  );

const pauseMediaPlayback = (root) => {
  if (!root) return;
  root.querySelectorAll("video, audio").forEach((media) => {
    media.pause();
  });
};

const isVisibleMediaElement = (media) =>
  Boolean(
    media &&
      !media.closest(".viewer-content.is-hidden") &&
      !media.closest('.window[data-media-closing="true"]') &&
      !media.closest(".app-window.is-hidden, .home-window.is-hidden")
  );

const playMediaElement = (media) => {
  if (!media || !isVisibleMediaElement(media)) return;
  if (!media.getAttribute("src") && media.dataset.src) {
    media.setAttribute("src", media.dataset.src);
    media.load();
  }
  const playRequest = media.play();
  if (playRequest && typeof playRequest.catch === "function") {
    playRequest.catch(() => {
      // Some browsers block autoplay unless it follows a user gesture.
    });
  }
};

const playActiveAutoplayVideos = (root) => {
  if (!root) return;
  const win = root.matches(".window") ? root : root.closest(".window");
  if (win && win.dataset.mediaClosing === "true") return;
  if (win && !isWindowVisible(win)) return;
  root.querySelectorAll("video[data-autoplay-on-active]").forEach(playMediaElement);
};

const stopMediaPlayback = (root) => {
  if (!root) return;

  root.querySelectorAll("video, audio").forEach((media) => {
    media.pause();
    if (!media.matches("[data-unload-on-hide]")) return;
    const src = media.getAttribute("src");
    if (src) media.dataset.src = src;
    media.removeAttribute("src");
    media.load();
  });

  root.querySelectorAll("iframe[data-unload-on-hide]").forEach((iframe) => {
    const src = iframe.getAttribute("src");
    if (src) iframe.dataset.src = src;
    iframe.removeAttribute("src");
  });
};

const selectWindowTab = (win, viewId) => {
  if (!win) return;
  const selectorButtons = win.querySelectorAll(".selector-item");
  const viewerPanels = win.querySelectorAll(".viewer-content");

  selectorButtons.forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-view") === viewId);
  });

  viewerPanels.forEach((panel) => {
    const isMatch = panel.getAttribute("data-view") === viewId;
    panel.classList.toggle("is-hidden", !isMatch);
    if (!isMatch) stopMediaPlayback(panel);
  });
};

const resetWindowToFirstTab = (win) => {
  if (!win) return;
  const firstButton = win.querySelector(".selector-item");
  if (firstButton) selectWindowTab(win, firstButton.getAttribute("data-view"));
};

const restartWindowAnimation = (win, animationClass) => {
  if (!win) return;
  win.classList.remove("is-opening", "is-closing");
  void win.offsetWidth;
  win.classList.add(animationClass);
};

const RANDOM_EVENT_GLOBAL_DEBUG = false;
const RANDOM_EVENT_RELOAD_KEY = "personalSiteRandomEventReloadPending";
const FELIZ_JUEVES_SHOWN_KEY = "personalSiteFelizJuevesShownDate";
const RANDOM_EVENT_VIEWPORT_PADDING = 12;
const RANDOM_EVENT_TASKBAR_CLEARANCE = 64;
const RANDOM_EVENT_PLACEMENT_ATTEMPTS = 42;
const RANDOM_EVENT_OBSTACLE_GAP = 10;
const GENERAL_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL = 17;
const MINESWEEPER_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL = 22;
const SOLITAIRE_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL = 27;
const RANDOM_EVENT_IDLE_DELAY_MS = 4 * 60 * 1000;
const RANDOM_EVENT_APP_DWELL_MS = 2 * 60 * 1000;
const RANDOM_EVENT_DELAY_MIN_MS = 0;
const RANDOM_EVENT_DELAY_MAX_MS = 2000;
const RANDOM_EVENT_DELAY_STEP_MS = 100;
const RANDOM_EVENT_REPEAT_DAMPEN_MS = 2 * 60 * 1000;
const RANDOM_EVENT_REPEAT_DAMPEN_FACTOR = 0.5;
const RANDOM_EVENT_KIND_INTERACTIVE = "interactive";
const RANDOM_EVENT_KIND_NON_INTERACTIVE = "noninteractive";
const RANDOM_EVENT_KIND_LIMITS = Object.freeze({
  [RANDOM_EVENT_KIND_INTERACTIVE]: 1,
  [RANDOM_EVENT_KIND_NON_INTERACTIVE]: 2,
});
const RANDOM_EVENT_MAX_LOCK_RELEASE_MS = 30 * 1000;
const INFINITY_ARMORY_STARTING_GOLD = 12000;
const INFINITY_ARMORY_UPGRADE_PRICES = Object.freeze([1000, 2500, 5000]);
const INFINITY_ARMORY_MAX_LEVEL = INFINITY_ARMORY_UPGRADE_PRICES.length + 1;
const INFINITY_ARMORY_SHAPES = Object.freeze(["square", "circle", "triangle"]);
const INFINITY_ARMORY_GEM_LABELS = Object.freeze({
  square: "Square",
  circle: "Circle",
  triangle: "Triangle",
});
const INFINITY_ARMORY_INVENTORY_SLOT_COUNT = 15;
const INFINITY_ARMORY_INVENTORY_GEM_COUNT = INFINITY_ARMORY_INVENTORY_SLOT_COUNT;
const INFINITY_ARMORY_GEM_ICON_BY_SHAPE = Object.freeze({
  square: "assets/random%20events/ib-gem-square.webp",
  circle: "assets/random%20events/ib-gem-circle.webp",
  triangle: "assets/random%20events/ib-gem-triangle.webp",
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
const createInfinityArmoryInventoryGems = () => {
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
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [gems[index], gems[swapIndex]] = [gems[swapIndex], gems[index]];
  }

  return gems;
};
const randomEventDefinitions = [];
const randomEventPendingDefinitions = new Set();
const randomEventKindMaxSince = {
  [RANDOM_EVENT_KIND_INTERACTIVE]: 0,
  [RANDOM_EVENT_KIND_NON_INTERACTIVE]: 0,
};
const randomEventRecentInteractiveRuns = new Map();
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
let wingedLightCollectOverlay = null;

const randomEventViewportWindows = () =>
  [
    randomEventWindow,
    felizJuevesWindow,
    randomAlertWindow,
    selfLoveAlertWindow,
    rohinUpdateWindow,
    mcAfeePromptWindow,
    mcAfeeDownloadWindow,
    mcAfeeThanksWindow,
    ...wordErrorWindows,
    rohinNoteWindow,
    earthNoteWindow,
    healthNoteWindow,
    loveNoteWindow,
    castleGateWindow,
    possumSpringsWindow,
    wingedLightWindow,
    manaFloodWindow,
    mimicWarningWindow,
    skillCheckWindow,
    skillCheckResultWindow,
    distressSignalWindow,
    distressUploadWindow,
    nazarWindow,
    siteGraceWindow,
    stalkerWindow,
    stalkerResultWindow,
    nanaEncounterWindow,
    nanaAcceptWindow,
    lainAlertWindow,
    lelouchAlertWindow,
    instrumentalityWindow,
    instrumentalityCongratsWindow,
    redToolWindow,
    fateWindow,
    behelitWindow,
    johnPorkWindow,
    advertisementWindow,
    bidenBlastWindow,
    infinityArmoryWindow,
    virusWindow,
    virusRescueWindow,
  ].filter(Boolean);

const getRandomEventWindowBounds = (win) => {
  const rect = win.getBoundingClientRect();
  const width = Math.max(win.offsetWidth, rect.width);
  const height = Math.max(win.offsetHeight, rect.height);
  const padding = RANDOM_EVENT_VIEWPORT_PADDING;
  return {
    width,
    height,
    padding,
    maxLeft: Math.max(padding, window.innerWidth - width - padding),
    maxTop: Math.max(
      padding,
      window.innerHeight - height - RANDOM_EVENT_TASKBAR_CLEARANCE
    ),
  };
};

const randomEventCandidateRect = (bounds, left, top) => ({
  left,
  top,
  right: left + bounds.width,
  bottom: top + bounds.height,
});

const randomEventPlacementObstacles = (win) =>
  Array.from(document.querySelectorAll(".window"))
    .filter((candidate) => {
      if (candidate === win) return false;
      if (candidate.closest(".window-explode-piece, .biden-explode-piece")) return false;
      if (candidate.hidden || candidate.classList.contains("is-hidden")) return false;
      if (candidate.getAttribute("aria-hidden") === "true") return false;
      return true;
    })
    .map((candidate) => candidate.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);

const randomEventOverlapArea = (a, b, gap = 0) => {
  const overlapWidth = Math.max(
    0,
    Math.min(a.right, b.right + gap) - Math.max(a.left, b.left - gap)
  );
  const overlapHeight = Math.max(
    0,
    Math.min(a.bottom, b.bottom + gap) - Math.max(a.top, b.top - gap)
  );
  return overlapWidth * overlapHeight;
};

const scoreRandomEventPlacement = (candidate, obstacles) =>
  obstacles.reduce(
    (score, obstacle) =>
      score + randomEventOverlapArea(candidate, obstacle, RANDOM_EVENT_OBSTACLE_GAP),
    0
  );

const sampleRandomEventPosition = ({ padding, maxLeft, maxTop }) => ({
  left: padding + Math.random() * Math.max(0, maxLeft - padding),
  top: padding + Math.random() * Math.max(0, maxTop - padding),
});

const clampRandomEventPosition = ({ padding, maxLeft, maxTop }, { left, top }) => ({
  left: Math.max(padding, Math.min(left, maxLeft)),
  top: Math.max(padding, Math.min(top, maxTop)),
});

const findRandomEventOpenPosition = (win, preferredPositions = []) => {
  const bounds = getRandomEventWindowBounds(win);
  const obstacles = randomEventPlacementObstacles(win);
  const defaultPosition = sampleRandomEventPosition(bounds);

  if (!obstacles.length) {
    return clampRandomEventPosition(bounds, preferredPositions[0] || defaultPosition);
  }

  let bestPosition = null;
  let bestScore = Infinity;
  const cornerPositions = [
    { left: bounds.padding, top: bounds.padding },
    { left: bounds.maxLeft, top: bounds.padding },
    { left: bounds.padding, top: bounds.maxTop },
    { left: bounds.maxLeft, top: bounds.maxTop },
    {
      left: (bounds.padding + bounds.maxLeft) / 2,
      top: (bounds.padding + bounds.maxTop) / 2,
    },
  ];

  const considerPosition = (position) => {
    const clamped = clampRandomEventPosition(bounds, position);
    const rect = randomEventCandidateRect(bounds, clamped.left, clamped.top);
    const score = scoreRandomEventPlacement(rect, obstacles);

    if (score < bestScore) {
      bestScore = score;
      bestPosition = clamped;
    }

    return score === 0;
  };

  const seededPositions = [...preferredPositions];
  for (const position of seededPositions) {
    if (considerPosition(position)) return bestPosition;
  }

  for (let attempt = 0; attempt < RANDOM_EVENT_PLACEMENT_ATTEMPTS; attempt += 1) {
    if (considerPosition(sampleRandomEventPosition(bounds))) return bestPosition;
  }

  for (const position of cornerPositions) {
    if (considerPosition(position)) return bestPosition;
  }

  return bestPosition || defaultPosition;
};

const setRandomEventWindowPosition = (win, left, top, { onPosition } = {}) => {
  if (!win) return;
  const { padding, maxLeft, maxTop } = getRandomEventWindowBounds(win);
  const nextLeft = Math.round(Math.max(padding, Math.min(left, maxLeft)));
  const nextTop = Math.round(Math.max(padding, Math.min(top, maxTop)));
  win.style.translate = "0 0";
  win.style.left = `${nextLeft}px`;
  win.style.top = `${nextTop}px`;
  if (onPosition) onPosition(nextLeft, nextTop);
};

const positionRandomEventWindowInViewport = (win, options) => {
  if (!win) return;
  const { left, top } = findRandomEventOpenPosition(win);
  setRandomEventWindowPosition(win, left, top, options);
};

const clampRandomEventWindowToViewport = (win, options) => {
  if (!win || win.classList.contains("is-hidden")) return;
  const rect = win.getBoundingClientRect();
  const styleLeft = Number.parseFloat(win.style.left);
  const styleTop = Number.parseFloat(win.style.top);
  const currentLeft = Number.isFinite(styleLeft) ? styleLeft : rect.left;
  const currentTop = Number.isFinite(styleTop) ? styleTop : rect.top;
  setRandomEventWindowPosition(win, currentLeft, currentTop, options);
};

const clampRandomEventWindowAfterMediaLoad = (win, options) => {
  if (!win) return;
  requestAnimationFrame(() => clampRandomEventWindowToViewport(win, options));
  [80, 240, 360].forEach((delay) => {
    setTimeout(() => clampRandomEventWindowToViewport(win, options), delay);
  });
  win.querySelectorAll("img").forEach((image) => {
    if (image.complete && image.naturalWidth > 0) {
      clampRandomEventWindowToViewport(win, options);
      return;
    }
    image.addEventListener(
      "load",
      () => clampRandomEventWindowToViewport(win, options),
      { once: true }
    );
  });
};

const clampVisibleRandomEventWindows = () => {
  randomEventViewportWindows().forEach((win) => clampRandomEventWindowToViewport(win));
};

const watchRandomEventViewportMedia = () => {
  randomEventViewportWindows().forEach((win) => {
    win.querySelectorAll("img").forEach((image) => {
      image.addEventListener("load", () => clampRandomEventWindowToViewport(win));
    });
  });
};

const isRandomAlertVisible = () =>
  Boolean(
    randomAlertWindow &&
      !randomAlertWindow.classList.contains("is-hidden") &&
      randomAlertWindow.getAttribute("aria-hidden") === "false"
  );

const resetRandomAlertSize = () => {
  if (!randomAlertWindow) return;
  randomAlertWindow.classList.remove("is-expanded");
  randomAlertWindow.style.left = "";
  randomAlertWindow.style.top = "";
  randomAlertWindow.style.width = "";
  randomAlertWindow.style.height = "";
  randomAlertWindow.style.translate = "";
};

const positionRandomAlertWindow = () => {
  if (!randomAlertWindow || randomAlertWindow.classList.contains("is-expanded")) return;
  positionRandomEventWindowInViewport(randomAlertWindow);
};

const hideRandomAlert = () => {
  if (!randomAlertWindow) return;
  randomAlertWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(randomAlertWindow, "is-closing");
};

const showRandomAlert = ({ showRemember = false } = {}) => {
  if (!randomAlertWindow) return;
  if (randomAlertReopenTimer) {
    clearTimeout(randomAlertReopenTimer);
    randomAlertReopenTimer = null;
  }
  if (isRandomAlertVisible()) {
    randomAlertWindow.style.zIndex = String(topZ++);
    return;
  }
  resetRandomAlertSize();
  if (randomAlertRememberRow) randomAlertRememberRow.hidden = !showRemember;
  if (randomAlertRemember) randomAlertRemember.checked = false;
  randomAlertWindow.classList.remove("is-hidden", "is-closing", "is-choice-flashing");
  randomAlertWindow.setAttribute("aria-hidden", "false");
  positionRandomAlertWindow();
  randomAlertWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(randomAlertWindow, "is-opening");
};

const flashRandomAlertChoices = () => {
  if (!randomAlertWindow) return;
  if (randomAlertFlashTimer) clearTimeout(randomAlertFlashTimer);
  randomAlertWindow.classList.add("is-choice-flashing");
  randomAlertFlashTimer = setTimeout(() => {
    randomAlertWindow.classList.remove("is-choice-flashing");
    randomAlertFlashTimer = null;
  }, 300);
};

const respondToRandomAlert = () => {
  if (!randomAlertWindow) return;
  const rememberVisible = randomAlertRememberRow && !randomAlertRememberRow.hidden;
  const rememberChecked = randomAlertRemember && randomAlertRemember.checked;
  hideRandomAlert();
  if (rememberVisible && rememberChecked) {
    return;
  }
  const delay = rememberVisible ? 2000 + Math.random() * 3000 : 1000;
  randomAlertReopenTimer = setTimeout(() => {
    showRandomAlert({ showRemember: true });
  }, delay);
};

const isSelfLoveAlertVisible = () =>
  Boolean(
    selfLoveAlertWindow &&
      !selfLoveAlertWindow.classList.contains("is-hidden") &&
      selfLoveAlertWindow.getAttribute("aria-hidden") === "false"
  );

const positionSelfLoveAlertWindow = () => {
  positionRandomEventWindowInViewport(selfLoveAlertWindow);
};

const showSelfLoveAlert = () => {
  if (!selfLoveAlertWindow) return;
  if (isSelfLoveAlertVisible()) {
    selfLoveAlertWindow.style.zIndex = String(topZ++);
    return;
  }
  selfLoveAlertWindow.classList.remove("is-hidden", "is-closing", "is-yes-flashing");
  selfLoveAlertWindow.setAttribute("aria-hidden", "false");
  positionSelfLoveAlertWindow();
  selfLoveAlertWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(selfLoveAlertWindow, "is-opening");
};

const closeSelfLoveAlert = () => {
  if (!selfLoveAlertWindow || selfLoveAlertWindow.classList.contains("is-hidden")) return;
  selfLoveAlertWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(selfLoveAlertWindow, "is-closing");
};

const flashSelfLoveYes = () => {
  if (!selfLoveAlertWindow) return;
  if (selfLoveAlertFlashTimer) clearTimeout(selfLoveAlertFlashTimer);
  selfLoveAlertWindow.classList.add("is-yes-flashing");
  selfLoveAlertFlashTimer = setTimeout(() => {
    selfLoveAlertWindow.classList.remove("is-yes-flashing");
    selfLoveAlertFlashTimer = null;
  }, 600);
};

const isRohinUpdateVisible = () =>
  Boolean(
    rohinUpdateWindow &&
      !rohinUpdateWindow.classList.contains("is-hidden") &&
      rohinUpdateWindow.getAttribute("aria-hidden") === "false"
  );

const positionRohinUpdateWindow = () => {
  positionRandomEventWindowInViewport(rohinUpdateWindow);
};

const showRohinUpdate = () => {
  if (!rohinUpdateWindow) return;
  if (isRohinUpdateVisible()) {
    rohinUpdateWindow.style.zIndex = String(topZ++);
    return;
  }
  rohinUpdateWindow.classList.remove("is-hidden", "is-closing");
  rohinUpdateWindow.setAttribute("aria-hidden", "false");
  positionRohinUpdateWindow();
  rohinUpdateWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(rohinUpdateWindow, "is-opening");
};

const closeRohinUpdate = () => {
  if (!rohinUpdateWindow || rohinUpdateWindow.classList.contains("is-hidden")) return;
  rohinUpdateWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(rohinUpdateWindow, "is-closing");
};

const isMcAfeeWindowVisible = (win) =>
  Boolean(win && !win.classList.contains("is-hidden"));

const isMcAfeeVisible = () =>
  [mcAfeePromptWindow, mcAfeeDownloadWindow, mcAfeeThanksWindow].some(
    isMcAfeeWindowVisible
  );

const mcAfeeWindows = () =>
  [mcAfeePromptWindow, mcAfeeDownloadWindow, mcAfeeThanksWindow].filter(Boolean);

const positionMcAfeeWindow = (win) => {
  positionRandomEventWindowInViewport(win);
};

const clampMcAfeeWindowToViewport = (win) => {
  clampRandomEventWindowToViewport(win);
};

const clampMcAfeeWindowAfterMediaLoad = (win) => {
  clampRandomEventWindowAfterMediaLoad(win);
};

const clampVisibleMcAfeeWindows = () => {
  mcAfeeWindows().forEach((win) => clampMcAfeeWindowToViewport(win));
};

const showMcAfeeWindow = (win) => {
  if (!win) return;
  if (!win.classList.contains("is-hidden")) {
    win.style.zIndex = String(topZ++);
    clampMcAfeeWindowToViewport(win);
    return;
  }
  win.classList.remove("is-hidden", "is-closing");
  win.setAttribute("aria-hidden", "false");
  positionMcAfeeWindow(win);
  clampMcAfeeWindowToViewport(win);
  clampMcAfeeWindowAfterMediaLoad(win);
  loadDeferredMedia(win);
  win.style.zIndex = String(topZ++);
  restartWindowAnimation(win, "is-opening");
};

const closeMcAfeeWindow = (win) => {
  if (!win || win.classList.contains("is-hidden")) return;
  win.setAttribute("aria-hidden", "true");
  restartWindowAnimation(win, "is-closing");
};

const stopMcAfeeDownload = () => {
  if (mcAfeeProgressTimer) {
    clearTimeout(mcAfeeProgressTimer);
    mcAfeeProgressTimer = null;
  }
  if (mcAfeeDotsTimer) {
    clearInterval(mcAfeeDotsTimer);
    mcAfeeDotsTimer = null;
  }
};

const updateMcAfeeDownloadStatus = () => {
  if (!mcAfeeDownloadStatus) return;
  const dots = ".".repeat((mcAfeeDotsFrame % 3) + 1);
  mcAfeeDownloadStatus.textContent = `Downloading${dots}`;
  mcAfeeDotsFrame += 1;
};

const updateMcAfeeProgress = () => {
  if (!mcAfeeProgressBar || !mcAfeeProgress) return;
  mcAfeeProgressBar.style.width = `${mcAfeeProgressValue}%`;
  mcAfeeProgress.setAttribute("aria-valuenow", Math.floor(mcAfeeProgressValue));
};

const finishMcAfeeDownload = () => {
  stopMcAfeeDownload();
  mcAfeeProgressValue = 100;
  updateMcAfeeProgress();
  if (mcAfeeDownloadStatus) mcAfeeDownloadStatus.textContent = "Download complete.";
  if (mcAfeeComplete) mcAfeeComplete.disabled = false;
};

const tickMcAfeeDownload = () => {
  const slowDown = mcAfeeProgressValue > 70 ? 4 : 0;
  const delta = Math.max(0, Math.random() * 9 + 2 - slowDown);
  mcAfeeProgressValue = Math.min(mcAfeeProgressValue + delta, 100);
  updateMcAfeeProgress();

  if (mcAfeeProgressValue < 100) {
    const jitter = 160 + Math.random() * 320;
    mcAfeeProgressTimer = setTimeout(tickMcAfeeDownload, jitter);
    return;
  }

  finishMcAfeeDownload();
};

const startMcAfeeDownload = () => {
  stopMcAfeeDownload();
  mcAfeeProgressValue = 0;
  mcAfeeDotsFrame = 0;
  updateMcAfeeProgress();
  updateMcAfeeDownloadStatus();
  if (mcAfeeComplete) mcAfeeComplete.disabled = true;
  mcAfeeDotsTimer = setInterval(updateMcAfeeDownloadStatus, 420);
  mcAfeeProgressTimer = setTimeout(tickMcAfeeDownload, 300);
};

const showMcAfeePrompt = () => {
  if (mcAfeeUpdateLater) mcAfeeUpdateLater.disabled = false;
  showMcAfeeWindow(mcAfeePromptWindow);
};

const showMcAfeeDownload = () => {
  const alreadyVisible = isMcAfeeWindowVisible(mcAfeeDownloadWindow);
  showMcAfeeWindow(mcAfeeDownloadWindow);
  if (alreadyVisible) return;
  startMcAfeeDownload();
};

const showMcAfeeThanks = () => {
  showMcAfeeWindow(mcAfeeThanksWindow);
};

const clearWordErrorTimers = () => {
  wordErrorOpenTimers.forEach((timer) => clearTimeout(timer));
  wordErrorCloseTimers.forEach((timer) => clearTimeout(timer));
  wordErrorOpenTimers = [];
  wordErrorCloseTimers = [];
};

const isWordErrorStackVisible = () => wordErrorWindows.length > 0;

const shuffleWordErrorWindows = (windows) => {
  const shuffled = [...windows];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const nextIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[i]];
  }
  return shuffled;
};

const wordErrorStackLayout = () => {
  const count = 10;
  const padding = 12;
  const taskbarClearance = 64;
  const windowWidth = Math.min(360, Math.max(260, window.innerWidth - padding * 2));
  const windowHeight = 136;
  const availableWidth = Math.max(0, window.innerWidth - padding * 2 - windowWidth);
  const availableHeight = Math.max(
    0,
    window.innerHeight - taskbarClearance - padding - windowHeight
  );
  const maxStep = Math.min(
    28,
    availableWidth / (count - 1),
    availableHeight / (count - 1)
  );
  const step = maxStep >= 8 ? maxStep : Math.max(0, maxStep);
  const totalOffset = step * (count - 1);
  const startLeft = Math.round(padding + Math.max(0, (availableWidth - totalOffset) / 2));
  const startTop = Math.round(padding + Math.max(0, (availableHeight - totalOffset) / 2));

  return {
    count,
    step,
    startLeft,
    startTop,
    windowWidth,
  };
};

const removeWordErrorWindow = (win) => {
  if (!win) return;
  win.remove();
  wordErrorWindows = wordErrorWindows.filter((item) => item !== win);
  if (!wordErrorWindows.length) {
    wordErrorStackClosing = false;
    clearWordErrorTimers();
  }
};

const closeWordErrorWindow = (win) => {
  if (!win || win.classList.contains("is-closing")) return;
  win.setAttribute("aria-hidden", "true");
  restartWindowAnimation(win, "is-closing");
};

const closeWordErrorStack = (selectedWindow) => {
  if (wordErrorStackClosing) return;
  wordErrorStackClosing = true;
  wordErrorOpenTimers.forEach((timer) => clearTimeout(timer));
  wordErrorOpenTimers = [];

  const visibleWindows = wordErrorWindows.filter(
    (win) => !win.classList.contains("is-hidden")
  );
  const hiddenWindows = wordErrorWindows.filter((win) =>
    win.classList.contains("is-hidden")
  );

  hiddenWindows.forEach(removeWordErrorWindow);

  const selectedIsVisible =
    selectedWindow && visibleWindows.includes(selectedWindow);
  if (selectedIsVisible) {
    closeWordErrorWindow(selectedWindow);
  }

  const remainingWindows = shuffleWordErrorWindows(
    visibleWindows.filter((win) => win !== selectedWindow)
  );

  remainingWindows.forEach((win, index) => {
    const timer = setTimeout(() => closeWordErrorWindow(win), (index + 1) * 100);
    wordErrorCloseTimers.push(timer);
  });

  if (!selectedIsVisible && !remainingWindows.length) {
    wordErrorStackClosing = false;
  }
};

const createWordErrorWindow = (index, layout) => {
  const win = document.createElement("div");
  win.className = "window word-error-stack-window is-hidden";
  win.setAttribute("aria-hidden", "true");
  win.style.left = `${Math.round(layout.startLeft + index * layout.step)}px`;
  win.style.top = `${Math.round(layout.startTop + index * layout.step)}px`;
  win.style.width = `${layout.windowWidth}px`;

  const titleBar = document.createElement("div");
  titleBar.className = "title-bar";

  const title = document.createElement("div");
  title.className = "title-bar-text";
  title.textContent = "Microsoft Word";

  const controls = document.createElement("div");
  controls.className = "title-bar-controls";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close");

  controls.appendChild(closeButton);
  titleBar.appendChild(title);
  titleBar.appendChild(controls);

  const body = document.createElement("div");
  body.className = "window-body";

  const message = document.createElement("div");
  message.className = "word-error-message";

  const icon = document.createElement("img");
  icon.src = "assets/app-icons/ico/application_hourglass_small.ico";
  icon.alt = "";

  const text = document.createElement("p");
  text.textContent =
    "Fatal Error: Your license could not be confirmed, please sign back into Microsft Office.";

  const actions = document.createElement("div");
  actions.className = "word-error-actions";

  const noThanks = document.createElement("button");
  noThanks.type = "button";
  noThanks.textContent = "No, thanks.";

  const thinkAboutIt = document.createElement("button");
  thinkAboutIt.type = "button";
  thinkAboutIt.textContent = "I'll think about it.";

  [closeButton, noThanks, thinkAboutIt].forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeWordErrorStack(win);
    });
  });

  win.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      clampMcAfeeWindowToViewport(win);
      return;
    }
    if (event.animationName === "retro-window-close") {
      removeWordErrorWindow(win);
    }
  });

  message.appendChild(icon);
  message.appendChild(text);
  actions.appendChild(noThanks);
  actions.appendChild(thinkAboutIt);
  body.appendChild(message);
  body.appendChild(actions);
  win.appendChild(titleBar);
  win.appendChild(body);

  return win;
};

const showWordErrorStack = () => {
  if (isWordErrorStackVisible()) {
    wordErrorWindows.forEach((win) => {
      if (!win.classList.contains("is-hidden")) win.style.zIndex = String(topZ++);
    });
    return;
  }

  clearWordErrorTimers();
  wordErrorStackClosing = false;
  const layout = wordErrorStackLayout();
  wordErrorWindows = Array.from({ length: layout.count }, (_, index) =>
    createWordErrorWindow(index, layout)
  );

  wordErrorWindows.forEach((win) => document.body.appendChild(win));
  wordErrorWindows.forEach((win, index) => {
    const timer = setTimeout(() => {
      if (wordErrorStackClosing || !wordErrorWindows.includes(win)) return;
      win.classList.remove("is-hidden", "is-closing");
      win.setAttribute("aria-hidden", "false");
      win.style.zIndex = String(topZ++);
      restartWindowAnimation(win, "is-opening");
    }, index * 100);
    wordErrorOpenTimers.push(timer);
  });
};

const isRohinNoteVisible = () =>
  Boolean(
    rohinNoteWindow &&
      !rohinNoteWindow.classList.contains("is-hidden") &&
      rohinNoteWindow.getAttribute("aria-hidden") === "false"
  );

const positionRohinNoteWindow = () => {
  positionRandomEventWindowInViewport(rohinNoteWindow);
};

const showRohinNote = () => {
  if (!rohinNoteWindow) return;
  if (isRohinNoteVisible()) {
    rohinNoteWindow.style.zIndex = String(topZ++);
    return;
  }
  rohinNoteWindow.classList.remove("is-hidden", "is-closing");
  rohinNoteWindow.setAttribute("aria-hidden", "false");
  positionRohinNoteWindow();
  rohinNoteWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(rohinNoteWindow, "is-opening");
};

const closeRohinNote = () => {
  if (!rohinNoteWindow || rohinNoteWindow.classList.contains("is-hidden")) return;
  rohinNoteWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(rohinNoteWindow, "is-closing");
};

const isEarthNoteVisible = () =>
  Boolean(
    earthNoteWindow &&
      !earthNoteWindow.classList.contains("is-hidden") &&
      earthNoteWindow.getAttribute("aria-hidden") === "false"
  );

const positionEarthNoteWindow = () => {
  positionRandomEventWindowInViewport(earthNoteWindow);
};

const showEarthNote = () => {
  if (!earthNoteWindow) return;
  if (isEarthNoteVisible()) {
    earthNoteWindow.style.zIndex = String(topZ++);
    return;
  }
  earthNoteWindow.classList.remove("is-hidden", "is-closing");
  earthNoteWindow.setAttribute("aria-hidden", "false");
  positionEarthNoteWindow();
  earthNoteWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(earthNoteWindow, "is-opening");
};

const closeEarthNote = () => {
  if (!earthNoteWindow || earthNoteWindow.classList.contains("is-hidden")) return;
  earthNoteWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(earthNoteWindow, "is-closing");
};

const isHealthNoteVisible = () =>
  Boolean(
    healthNoteWindow &&
      !healthNoteWindow.classList.contains("is-hidden") &&
      healthNoteWindow.getAttribute("aria-hidden") === "false"
  );

const positionHealthNoteWindow = () => {
  positionRandomEventWindowInViewport(healthNoteWindow);
};

const showHealthNote = () => {
  if (!healthNoteWindow) return;
  if (isHealthNoteVisible()) {
    healthNoteWindow.style.zIndex = String(topZ++);
    return;
  }
  healthNoteWindow.classList.remove("is-hidden", "is-closing");
  healthNoteWindow.setAttribute("aria-hidden", "false");
  positionHealthNoteWindow();
  healthNoteWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(healthNoteWindow, "is-opening");
};

const closeHealthNote = () => {
  if (!healthNoteWindow || healthNoteWindow.classList.contains("is-hidden")) return;
  healthNoteWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(healthNoteWindow, "is-closing");
};

const isLoveNoteVisible = () =>
  Boolean(
    loveNoteWindow &&
      !loveNoteWindow.classList.contains("is-hidden") &&
      loveNoteWindow.getAttribute("aria-hidden") === "false"
  );

const positionLoveNoteWindow = () => {
  positionRandomEventWindowInViewport(loveNoteWindow);
};

const showLoveNote = () => {
  if (!loveNoteWindow) return;
  if (isLoveNoteVisible()) {
    loveNoteWindow.style.zIndex = String(topZ++);
    return;
  }
  loveNoteWindow.classList.remove("is-hidden", "is-closing");
  loveNoteWindow.setAttribute("aria-hidden", "false");
  positionLoveNoteWindow();
  loveNoteWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(loveNoteWindow, "is-opening");
};

const closeLoveNote = () => {
  if (!loveNoteWindow || loveNoteWindow.classList.contains("is-hidden")) return;
  loveNoteWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(loveNoteWindow, "is-closing");
};

const isCastleGateVisible = () =>
  Boolean(
    castleGateWindow &&
      !castleGateWindow.classList.contains("is-hidden") &&
      castleGateWindow.getAttribute("aria-hidden") === "false"
  );

const positionCastleGateWindow = () => {
  positionRandomEventWindowInViewport(castleGateWindow);
};

const showCastleGateWindow = () => {
  if (!castleGateWindow) return;
  if (isCastleGateVisible()) {
    castleGateWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(castleGateWindow);
  castleGateWindow.classList.remove("is-hidden", "is-closing");
  castleGateWindow.setAttribute("aria-hidden", "false");
  positionCastleGateWindow();
  castleGateWindow.style.zIndex = String(topZ++);
  clampRandomEventWindowAfterMediaLoad(castleGateWindow);
  restartWindowAnimation(castleGateWindow, "is-opening");
};

const closeCastleGateWindow = () => {
  if (!castleGateWindow || castleGateWindow.classList.contains("is-hidden")) return;
  castleGateWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(castleGateWindow, "is-closing");
};

const isPossumSpringsVisible = () =>
  Boolean(
    possumSpringsWindow &&
      !possumSpringsWindow.classList.contains("is-hidden") &&
      possumSpringsWindow.getAttribute("aria-hidden") === "false"
  );

const positionPossumSpringsWindow = () => {
  positionRandomEventWindowInViewport(possumSpringsWindow);
};

const showPossumSpringsWindow = () => {
  if (!possumSpringsWindow) return;
  if (isPossumSpringsVisible()) {
    possumSpringsWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(possumSpringsWindow);
  possumSpringsWindow.classList.remove("is-hidden", "is-closing");
  possumSpringsWindow.setAttribute("aria-hidden", "false");
  positionPossumSpringsWindow();
  possumSpringsWindow.style.zIndex = String(topZ++);
  clampRandomEventWindowAfterMediaLoad(possumSpringsWindow);
  restartWindowAnimation(possumSpringsWindow, "is-opening");
};

const closePossumSpringsWindow = () => {
  if (!possumSpringsWindow || possumSpringsWindow.classList.contains("is-hidden")) return;
  possumSpringsWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(possumSpringsWindow, "is-closing");
};

const isWingedLightVisible = () =>
  Boolean(
    wingedLightWindow &&
      !wingedLightWindow.classList.contains("is-hidden") &&
      wingedLightWindow.getAttribute("aria-hidden") === "false"
  );

const positionWingedLightWindow = () => {
  positionRandomEventWindowInViewport(wingedLightWindow);
};

const showWingedLightWindow = () => {
  if (!wingedLightWindow) return;
  if (isWingedLightVisible()) {
    wingedLightWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(wingedLightWindow);
  wingedLightWindow.classList.remove("is-hidden", "is-closing");
  wingedLightWindow.setAttribute("aria-hidden", "false");
  positionWingedLightWindow();
  wingedLightWindow.style.zIndex = String(topZ++);
  clampRandomEventWindowAfterMediaLoad(wingedLightWindow);
  restartWindowAnimation(wingedLightWindow, "is-opening");
};

const closeWingedLightWindow = () => {
  if (!wingedLightWindow || wingedLightWindow.classList.contains("is-hidden")) return;
  wingedLightWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(wingedLightWindow, "is-closing");
};

const removeWingedLightCollectOverlay = () => {
  if (!wingedLightCollectOverlay) return;
  wingedLightCollectOverlay.remove();
  wingedLightCollectOverlay = null;
};

const triggerWingedLightCollectEffect = () => {
  removeWingedLightCollectOverlay();
  const overlay = document.createElement("div");
  overlay.className = "winged-light-collect-overlay";
  const starPositions = [
    { x: 0, y: -180 },
    { x: 0, y: -140 },
    { x: 0, y: -100 },
    { x: 0, y: -60 },
    { x: 0, y: -20 },
    { x: 0, y: 20 },
    { x: 0, y: 60 },
    { x: 0, y: 100 },
    { x: 0, y: 140 },
    { x: 0, y: 180 },
  ];

  starPositions.forEach(({ x, y }, index) => {
    const star = document.createElement("span");
    star.className = "wing-charge-star";
    star.style.setProperty("--star-x", `${x}px`);
    star.style.setProperty("--star-y", `${y}px`);
    star.style.setProperty("--star-x-end", `${Math.round(x * 1.18)}px`);
    star.style.setProperty("--star-y-end", `${Math.round(y * 1.18)}px`);
    star.style.setProperty("--star-delay", `${index * 42}ms`);
    overlay.appendChild(star);
  });

  document.body.appendChild(overlay);
  wingedLightCollectOverlay = overlay;
  const cleanup = () => {
    if (wingedLightCollectOverlay !== overlay) return;
    removeWingedLightCollectOverlay();
  };
  const handleOverlayAnimationEnd = (event) => {
    if (event.target !== overlay) return;
    overlay.removeEventListener("animationend", handleOverlayAnimationEnd);
    cleanup();
  };
  overlay.addEventListener("animationend", handleOverlayAnimationEnd);
  setTimeout(cleanup, 2200);
};

const collectWingedLight = () => {
  closeWingedLightWindow();
  triggerWingedLightCollectEffect();
};

const isManaFloodVisible = () =>
  Boolean(
    manaFloodWindow &&
      !manaFloodWindow.classList.contains("is-hidden") &&
      manaFloodWindow.getAttribute("aria-hidden") === "false"
  );

const positionManaFloodWindow = () => {
  positionRandomEventWindowInViewport(manaFloodWindow);
};

const showManaFlood = () => {
  if (!manaFloodWindow) return;
  if (isManaFloodVisible()) {
    manaFloodWindow.style.zIndex = String(topZ++);
    return;
  }
  manaFloodWindow.classList.remove("is-hidden", "is-closing");
  manaFloodWindow.setAttribute("aria-hidden", "false");
  positionManaFloodWindow();
  manaFloodWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(manaFloodWindow, "is-opening");
};

const closeManaFlood = () => {
  if (!manaFloodWindow || manaFloodWindow.classList.contains("is-hidden")) return;
  manaFloodWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(manaFloodWindow, "is-closing");
};

const isMimicWarningVisible = () =>
  Boolean(
    mimicWarningWindow &&
      !mimicWarningWindow.classList.contains("is-hidden") &&
      mimicWarningWindow.getAttribute("aria-hidden") === "false"
  );

const positionMimicWarningWindow = () => {
  positionRandomEventWindowInViewport(mimicWarningWindow);
};

const showMimicWarning = () => {
  if (!mimicWarningWindow) return;
  if (isMimicWarningVisible()) {
    mimicWarningWindow.style.zIndex = String(topZ++);
    return;
  }
  mimicWarningWindow.classList.remove("is-hidden", "is-closing");
  mimicWarningWindow.setAttribute("aria-hidden", "false");
  positionMimicWarningWindow();
  mimicWarningWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(mimicWarningWindow, "is-opening");
};

const closeMimicWarning = () => {
  if (!mimicWarningWindow || mimicWarningWindow.classList.contains("is-hidden")) return;
  mimicWarningWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(mimicWarningWindow, "is-closing");
};

const SKILL_CHECK_ROLL_DURATION_MS = 1100;
const SKILL_CHECK_ROLL_INTERVAL_MS = 55;
const SKILL_CHECK_FAILURE_ICON = "assets/app-icons/ico/search_file_2.ico";
const SKILL_CHECK_SUCCESS_ICON = "assets/app-icons/ico/game_solitaire.ico";
const SKILL_CHECK_FAILURE_TEXT = "Check failed. You found nothing.";
const SKILL_CHECK_SUCCESS_TEXT =
  "Success. You notice a bag of gold behind the Solitaire app. +15 gold coins.";
const SKILL_CHECK_DIGIT_SOURCES = Object.freeze({
  "0": "assets/minesweeper_assets/digital_digits/digital_0.png",
  "1": "assets/minesweeper_assets/digital_digits/digital_1.png",
  "2": "assets/minesweeper_assets/digital_digits/digital_2.png",
  "3": "assets/minesweeper_assets/digital_digits/digital_3.png",
  "4": "assets/minesweeper_assets/digital_digits/digital_4.png",
  "5": "assets/minesweeper_assets/digital_digits/digital_5.png",
  "6": "assets/minesweeper_assets/digital_digits/digital_6.png",
  "7": "assets/minesweeper_assets/digital_digits/digital_7.png",
  "8": "assets/minesweeper_assets/digital_digits/digital_8.png",
  "9": "assets/minesweeper_assets/digital_digits/digital_9.png",
  " ": "assets/minesweeper_assets/digital_digits/digital_blank.png",
});

const isSkillCheckWindowVisible = (win) =>
  Boolean(
    win && !win.classList.contains("is-hidden") && win.getAttribute("aria-hidden") === "false"
  );

const isSkillCheckVisible = () =>
  isSkillCheckWindowVisible(skillCheckWindow) ||
  isSkillCheckWindowVisible(skillCheckResultWindow);

const setSkillCheckDigit = (image, char) => {
  if (!image) return;
  const src = SKILL_CHECK_DIGIT_SOURCES[char] || SKILL_CHECK_DIGIT_SOURCES[" "];
  image.src = src;
};

const setSkillCheckRollDisplay = (value = null) => {
  const text =
    typeof value === "number" ? String(Math.max(1, Math.min(20, value))).padStart(2, " ") : "  ";
  setSkillCheckDigit(skillCheckDieTens, text[0]);
  setSkillCheckDigit(skillCheckDieOnes, text[1]);
};

const clearSkillCheckRollTimers = () => {
  if (skillCheckRollTimer) {
    clearInterval(skillCheckRollTimer);
    skillCheckRollTimer = null;
  }
  if (skillCheckRollTimeout) {
    clearTimeout(skillCheckRollTimeout);
    skillCheckRollTimeout = null;
  }
  skillCheckRolling = false;
};

const resetSkillCheckWindow = () => {
  clearSkillCheckRollTimers();
  if (skillCheckWindow) skillCheckWindow.classList.remove("is-locked");
  if (skillCheckRoll) skillCheckRoll.disabled = false;
  if (skillCheckIgnore) skillCheckIgnore.disabled = false;
  setSkillCheckRollDisplay();
};

const positionSkillCheckWindow = (win) => {
  positionRandomEventWindowInViewport(win);
};

const lockSkillCheckWindow = () => {
  if (skillCheckWindow) skillCheckWindow.classList.add("is-locked");
  if (skillCheckRoll) skillCheckRoll.disabled = true;
  if (skillCheckIgnore) skillCheckIgnore.disabled = true;
};

const showSkillCheckResultWindow = (roll) => {
  if (!skillCheckResultWindow) return;
  const success = roll >= 15;
  if (skillCheckResultIcon) {
    skillCheckResultIcon.src = success ? SKILL_CHECK_SUCCESS_ICON : SKILL_CHECK_FAILURE_ICON;
  }
  if (skillCheckResultText) {
    skillCheckResultText.textContent = success ? SKILL_CHECK_SUCCESS_TEXT : SKILL_CHECK_FAILURE_TEXT;
  }
  skillCheckResultWindow.classList.remove("is-hidden", "is-closing");
  skillCheckResultWindow.setAttribute("aria-hidden", "false");
  positionSkillCheckWindow(skillCheckResultWindow);
  skillCheckResultWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(skillCheckResultWindow, "is-opening");
  requestAnimationFrame(() => {
    if (skillCheckResultOk) skillCheckResultOk.focus();
  });
};

const beginSkillCheckRoll = () => {
  if (!skillCheckWindow || skillCheckRolling) return;
  skillCheckRolling = true;
  lockSkillCheckWindow();
  skillCheckRollTimer = setInterval(() => {
    setSkillCheckRollDisplay(Math.floor(Math.random() * 20) + 1);
  }, SKILL_CHECK_ROLL_INTERVAL_MS);
  skillCheckRollTimeout = setTimeout(() => {
    clearSkillCheckRollTimers();
    const roll = Math.floor(Math.random() * 20) + 1;
    setSkillCheckRollDisplay(roll);
    lockSkillCheckWindow();
    showSkillCheckResultWindow(roll);
  }, SKILL_CHECK_ROLL_DURATION_MS);
};

const showSkillCheckWindow = () => {
  if (!skillCheckWindow) return;
  if (isSkillCheckVisible()) {
    if (skillCheckResultWindow && isSkillCheckWindowVisible(skillCheckResultWindow)) {
      skillCheckResultWindow.style.zIndex = String(topZ++);
    } else {
      skillCheckWindow.style.zIndex = String(topZ++);
    }
    return;
  }
  resetSkillCheckWindow();
  skillCheckWindow.classList.remove("is-hidden", "is-closing");
  skillCheckWindow.setAttribute("aria-hidden", "false");
  positionSkillCheckWindow(skillCheckWindow);
  skillCheckWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(skillCheckWindow, "is-opening");
  requestAnimationFrame(() => {
    if (skillCheckRoll) skillCheckRoll.focus();
  });
};

const closeSkillCheckWindow = () => {
  clearSkillCheckRollTimers();
  if (skillCheckWindow && !skillCheckWindow.classList.contains("is-hidden")) {
    skillCheckWindow.setAttribute("aria-hidden", "true");
    restartWindowAnimation(skillCheckWindow, "is-closing");
  }
  if (skillCheckResultWindow && !skillCheckResultWindow.classList.contains("is-hidden")) {
    skillCheckResultWindow.setAttribute("aria-hidden", "true");
    restartWindowAnimation(skillCheckResultWindow, "is-closing");
  }
};

const DISTRESS_ALIGNMENT_TOLERANCE = 3.2;
const DISTRESS_UPLOAD_DELAY_MS = 420;
const DISTRESS_POWER_DURATION_MS = 2600;
const DISTRESS_POWER_TICK_MS = 40;
const DISTRESS_CANVAS_WIDTH = 420;
const DISTRESS_CANVAS_HEIGHT = 152;
const DISTRESS_WAVE_NOISE = 0.058;
const DISTRESS_NOISE_SAMPLE_STEP = 1;
const DISTRESS_STATIC_DOTS = 390;
const DISTRESS_GRAIN_LINES = 58;

const isDistressWindowVisible = (win) =>
  Boolean(
    win && !win.classList.contains("is-hidden") && win.getAttribute("aria-hidden") === "false"
  );

const isDistressSignalVisible = () =>
  isDistressWindowVisible(distressSignalWindow) ||
  isDistressWindowVisible(distressUploadWindow);

const getDistressPhaseDelta = (value, target) => {
  const delta = Math.abs(value - target);
  return Math.min(delta, 100 - delta);
};

const getDistressAlignment = () => {
  const frequency = distressFrequencyDial ? Number(distressFrequencyDial.value) : 0;
  const phase = distressPhaseDial ? Number(distressPhaseDial.value) : 0;
  return {
    frequencyDelta: Math.abs(frequency - distressTargetFrequency),
    phaseDelta: getDistressPhaseDelta(phase, distressTargetPhase),
  };
};

const setDistressDialsDisabled = (disabled) => {
  if (distressFrequencyDial) distressFrequencyDial.disabled = disabled;
  if (distressPhaseDial) distressPhaseDial.disabled = disabled;
};

const setDistressStatus = (text) => {
  if (distressLockStatusText) distressLockStatusText.textContent = text;
};

const setDistressNavigationMode = (mode) => {
  if (!distressNavPanel) return;
  distressNavPanel.classList.toggle("is-off", mode === "off");
  distressNavPanel.classList.toggle("is-scanning", mode === "scanning");
  distressNavPanel.classList.toggle("is-locked", mode === "locked");
};

const setDistressNavigationReadout = (
  state,
  bearing = "--",
  range = "--",
  strength = "--"
) => {
  if (distressNavState) distressNavState.textContent = state;
  if (distressBearingReadout) distressBearingReadout.textContent = `BRG ${bearing}`;
  if (distressRangeReadout) distressRangeReadout.textContent = `RNG ${range}`;
  if (distressStrengthReadout) distressStrengthReadout.textContent = `SIG ${strength}`;
};

const resetDistressNavigation = () => {
  setDistressNavigationMode("off");
  if (distressMinimapArrow) {
    distressMinimapArrow.style.setProperty("--distress-bearing", "0deg");
    distressMinimapArrow.style.setProperty("--distress-arrow-x", "0px");
    distressMinimapArrow.style.setProperty("--distress-arrow-y", "0px");
  }
  setDistressNavigationReadout("Map offline");
};

const scanDistressNavigation = () => {
  setDistressNavigationMode("scanning");
  setDistressNavigationReadout("Triangulating");
};

const lockDistressNavigation = () => {
  setDistressNavigationMode("locked");
  const bearing = Math.round(distressSignalBearing);
  const range = `${distressSignalRange.toFixed(1)}km`;
  if (distressMinimapArrow) {
    const bearingRadians = (bearing * Math.PI) / 180;
    const arrowRadius = 27;
    distressMinimapArrow.style.setProperty("--distress-bearing", `${bearing}deg`);
    distressMinimapArrow.style.setProperty(
      "--distress-arrow-x",
      `${Math.sin(bearingRadians) * arrowRadius}px`
    );
    distressMinimapArrow.style.setProperty(
      "--distress-arrow-y",
      `${Math.cos(bearingRadians) * -arrowRadius}px`
    );
  }
  setDistressNavigationReadout(
    "Signal acquired",
    `${String(bearing).padStart(3, "0")} deg`,
    range,
    "100%"
  );
};

const setDistressPowerProgress = (progress) => {
  if (!distressPowerProgressBar) return;
  distressPowerProgressBar.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
};

const getDistressThermalNoise = () =>
  (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

const drawDistressStatic = (ctx, width, height) => {
  ctx.save();
  for (let index = 0; index < DISTRESS_STATIC_DOTS; index += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const size = Math.random() < 0.72 ? 1 : 2;
    const alpha = 0.08 + Math.random() * 0.24;
    ctx.fillStyle = `rgba(112, 255, 135, ${alpha})`;
    ctx.fillRect(x, y, size, 1);
  }
  for (let index = 0; index < DISTRESS_GRAIN_LINES; index += 1) {
    const y = Math.random() * height;
    const length = width * (0.1 + Math.random() * 0.46);
    const centerJitter = (Math.random() - 0.5) * width * 0.18;
    const x = Math.max(0, Math.min(width - length, width * 0.5 - length * 0.5 + centerJitter));
    ctx.fillStyle = `rgba(185, 255, 196, ${0.045 + Math.random() * 0.09})`;
    ctx.fillRect(x, y, length, 1);
  }
  ctx.restore();
};

const drawDistressDisplayGrain = (ctx, width, height) => {
  ctx.save();
  for (let y = 0; y < height; y += 3) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(0, y, width, 1);
  }
  for (let index = 0; index < 170; index += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const alpha = 0.012 + Math.random() * 0.04;
    ctx.fillStyle = `rgba(220, 255, 220, ${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    height * 0.1,
    width * 0.5,
    height * 0.48,
    Math.max(width, height) * 0.68
  );
  vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.34)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

const prepareDistressPanelNoiseCanvas = (canvas) => {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth || canvas.offsetWidth || 1));
  const height = Math.max(1, Math.round(canvas.clientHeight || canvas.offsetHeight || 1));
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
};

const clearDistressPanelNoiseCanvas = (canvas) => {
  prepareDistressPanelNoiseCanvas(canvas);
};

const drawDistressPanelNoiseCanvas = (canvas) => {
  const prepared = prepareDistressPanelNoiseCanvas(canvas);
  if (!prepared) return;
  const { ctx, width, height } = prepared;
  drawDistressStatic(ctx, width, height);
  drawDistressDisplayGrain(ctx, width, height);
};

const drawDistressPanelNoise = () => {
  if (!distressPoweredOn) {
    clearDistressPanelNoiseCanvas(distressNavNoiseCanvas);
    clearDistressPanelNoiseCanvas(distressStatusNoiseCanvas);
    return;
  }
  drawDistressPanelNoiseCanvas(distressNavNoiseCanvas);
  drawDistressPanelNoiseCanvas(distressStatusNoiseCanvas);
};

const isSnakeWindowVisible = () => {
  const win = getAppWindow("snake");
  return Boolean(win && isWindowVisible(win));
};

const isSnakeReducedMotion = () => Boolean(snakeReducedMotionMedia?.matches);

const isSnakePageActive = () =>
  typeof document.hasFocus === "function" ? document.hasFocus() : true;

const canAnimateSnake = () =>
  Boolean(
    isSnakeWindowVisible() &&
      !document.hidden &&
      isSnakePageActive() &&
      !isSnakeReducedMotion()
  );

const requestSnakeRender = () => {
  snakeRenderDirty = true;
  startSnakeNoiseAnimation();
};

const clearSnakeCountdown = () => {
  if (snakeState.countdownTimer) {
    clearTimeout(snakeState.countdownTimer);
    snakeState.countdownTimer = null;
  }
  snakeState.countdownStartedAt = 0;
  snakeState.countdownDuration = 0;
};

const setSnakeLoadingProgress = (progress) => {
  snakeLoadingProgress = Math.max(0, Math.min(100, progress));
  const roundedProgress = Math.round(snakeLoadingProgress);
  if (snakeLoadingMeterFill) {
    snakeLoadingMeterFill.style.setProperty(
      "--snake-load-progress",
      `${roundedProgress}%`
    );
  }
  if (snakeLoadingMeter) {
    snakeLoadingMeter.setAttribute("aria-valuenow", String(roundedProgress));
  }
  if (snakeLoadingPercent) {
    snakeLoadingPercent.textContent = `${roundedProgress}%`;
  }
};

const clearSnakeLoadingTimer = () => {
  if (!snakeLoadingTimer) return;
  clearTimeout(snakeLoadingTimer);
  snakeLoadingTimer = null;
};

const setSnakeLoadingVisible = (visible) => {
  const win = getAppWindow("snake");
  snakeState.loading = visible;
  if (win) win.classList.toggle("is-snake-loading", visible);
  if (snakeLoadingPanel) {
    snakeLoadingPanel.setAttribute("aria-hidden", String(!visible));
  }
};

const clearSnakeLoadingSequence = () => {
  clearSnakeLoadingTimer();
  setSnakeLoadingVisible(false);
  setSnakeLoadingProgress(0);
};

const finishSnakeLoadingSequence = () => {
  clearSnakeLoadingTimer();
  setSnakeLoadingProgress(100);
  setSnakeLoadingVisible(false);
  if (!isSnakeWindowVisible()) return;
  requestSnakeRender();
  if (snakeCanvas) snakeCanvas.focus();
};

const tickSnakeLoadingSequence = () => {
  if (!snakeState.loading || !isSnakeWindowVisible()) {
    clearSnakeLoadingSequence();
    return;
  }

  const elapsed = performance.now() - snakeLoadingStartedAt;
  if (elapsed >= snakeLoadingDuration) {
    finishSnakeLoadingSequence();
    return;
  }

  const timeProgress = (elapsed / snakeLoadingDuration) * 100;
  const naturalJump = 4 + Math.random() * 18;
  const catchupJump = Math.max(0, timeProgress - snakeLoadingProgress) * (0.45 + Math.random() * 0.5);
  const jitterCap = timeProgress + 14 + Math.random() * 18;
  const nextProgress = Math.min(
    96,
    jitterCap,
    snakeLoadingProgress + naturalJump + catchupJump
  );
  setSnakeLoadingProgress(Math.max(snakeLoadingProgress + 1, nextProgress));

  const remainingMs = Math.max(
    0,
    snakeLoadingDuration - (performance.now() - snakeLoadingStartedAt)
  );
  snakeLoadingTimer = window.setTimeout(
    tickSnakeLoadingSequence,
    Math.min(110 + Math.random() * 290, remainingMs)
  );
};

const startSnakeLoadingSequence = () => {
  const win = getAppWindow("snake");
  if (!win) return;
  pauseSnakeGame();
  stopSnakeNoiseAnimation();
  clearSnakeCountdown();
  clearSnakeLoadingTimer();
  setSnakeLoadingVisible(true);
  setSnakeLoadingProgress(0);
  snakeLoadingStartedAt = performance.now();
  snakeLoadingDuration =
    SNAKE_LOAD_MIN_MS + Math.random() * (SNAKE_LOAD_MAX_MS - SNAKE_LOAD_MIN_MS);
  snakeLoadingTimer = window.setTimeout(
    tickSnakeLoadingSequence,
    120 + Math.random() * 220
  );
};

const loadSnakeHighScores = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(SNAKE_HIGH_SCORE_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
};

const saveSnakeHighScores = () => {
  if (snakeHighScoreSaveTimer) {
    clearTimeout(snakeHighScoreSaveTimer);
    snakeHighScoreSaveTimer = null;
  }
  try {
    localStorage.setItem(SNAKE_HIGH_SCORE_KEY, JSON.stringify(snakeState.highScores));
  } catch {
    // High scores are best-effort when storage is unavailable.
  }
};

const scheduleSnakeHighScoreSave = () => {
  if (snakeHighScoreSaveTimer) clearTimeout(snakeHighScoreSaveTimer);
  snakeHighScoreSaveTimer = window.setTimeout(
    saveSnakeHighScores,
    SNAKE_HIGH_SCORE_SAVE_DEBOUNCE_MS
  );
};

const loadSnakeSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(SNAKE_SETTINGS_KEY) || "null");
    if (!stored || typeof stored !== "object") return null;
    const gridSize = Number(stored.gridSize);
    return {
      gridSize: [10, 16, 20, 24].includes(gridSize)
        ? gridSize
        : SNAKE_DEFAULT_GRID_SIZE,
      color: SNAKE_COLOR_THEMES[stored.color] ? stored.color : "green",
      appleColor: SNAKE_COLOR_THEMES[stored.appleColor] ? stored.appleColor : "red",
    };
  } catch {
    return null;
  }
};

const saveSnakeSettings = () => {
  try {
    localStorage.setItem(
      SNAKE_SETTINGS_KEY,
      JSON.stringify({
        gridSize: snakeState.gridSize,
        color: snakeState.color,
        appleColor: snakeState.appleColor,
      })
    );
  } catch {
    // Settings are best-effort when storage is unavailable.
  }
};

const getSnakeHighScore = () => {
  const key = String(snakeState.gridSize);
  const score = Number(snakeState.highScores[key]);
  return Number.isFinite(score) ? score : 0;
};

const updateSnakeHighScore = () => {
  const key = String(snakeState.gridSize);
  if (snakeState.score <= getSnakeHighScore()) return;
  snakeState.highScores[key] = snakeState.score;
  scheduleSnakeHighScoreSave();
};

const updateSnakeBoardSizeButtons = () => {
  snakeBoardSizeButtons.forEach((button) => {
    const isSelected = Number(button.dataset.snakeBoardSize) === snakeState.gridSize;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const updateSnakeColorButtons = () => {
  snakeColorButtons.forEach((button) => {
    const isSelected = button.dataset.snakeColor === snakeState.color;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const updateSnakeAppleColorButtons = () => {
  snakeAppleColorButtons.forEach((button) => {
    const isSelected = button.dataset.snakeAppleColor === snakeState.appleColor;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const getSnakeColorTheme = () =>
  SNAKE_COLOR_THEMES[snakeState.color] || SNAKE_COLOR_THEMES.green;

const getSnakeAppleColorTheme = () =>
  SNAKE_COLOR_THEMES[snakeState.appleColor] || SNAKE_COLOR_THEMES.red;

const updateSnakeHud = () => {
  const scoreText = String(snakeState.score);
  const highScoreText = String(getSnakeHighScore());
  const startText = snakeState.running || snakeState.countdownTimer ? "Pause" : "Start";
  if (snakeScore && snakeHudRenderCache.score !== scoreText) {
    snakeScore.textContent = scoreText;
  }
  if (snakeHighScore && snakeHudRenderCache.highScore !== highScoreText) {
    snakeHighScore.textContent = highScoreText;
  }
  if (snakeStart && snakeHudRenderCache.startText !== startText) {
    snakeStart.textContent = startText;
  }
  if (snakeHudRenderCache.gridSize !== snakeState.gridSize) {
    updateSnakeBoardSizeButtons();
  }
  if (snakeHudRenderCache.color !== snakeState.color) {
    updateSnakeColorButtons();
  }
  if (snakeHudRenderCache.appleColor !== snakeState.appleColor) {
    updateSnakeAppleColorButtons();
  }
  snakeHudRenderCache.score = scoreText;
  snakeHudRenderCache.highScore = highScoreText;
  snakeHudRenderCache.startText = startText;
  snakeHudRenderCache.gridSize = snakeState.gridSize;
  snakeHudRenderCache.color = snakeState.color;
  snakeHudRenderCache.appleColor = snakeState.appleColor;
  let statusText = "Ready";
  if (snakeState.gameOver) {
    statusText = "Signal lost";
  } else if (snakeState.countdownTimer) {
    statusText = "Starting";
  } else if (snakeState.running) {
    statusText = "Tracking";
  } else if (snakeState.hasStarted) {
    statusText = "Paused - press Start";
  }
  if (snakeStatus && snakeHudRenderCache.statusText !== statusText) {
    snakeStatus.textContent = statusText;
  }
  snakeHudRenderCache.statusText = statusText;
};

const resizeSnakeCanvas = (canvas) => {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth || 320));
  const height = Math.max(1, Math.round(canvas.clientHeight || width));
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height, ratio };
};

const getSnakeGridLayer = (width, height, ratio) => {
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  const cacheKey = `${pixelWidth}x${pixelHeight}:${ratio}:${snakeState.gridSize}`;
  if (!snakeGridCanvas) snakeGridCanvas = document.createElement("canvas");
  if (
    snakeGridCacheKey === cacheKey &&
    snakeGridCanvas.width === pixelWidth &&
    snakeGridCanvas.height === pixelHeight
  ) {
    return snakeGridCanvas;
  }
  snakeGridCacheKey = cacheKey;
  snakeGridCanvas.width = pixelWidth;
  snakeGridCanvas.height = pixelHeight;
  const gridCtx = snakeGridCanvas.getContext("2d");
  if (!gridCtx) return snakeGridCanvas;
  const cellWidth = width / snakeState.gridSize;
  const cellHeight = height / snakeState.gridSize;
  gridCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  gridCtx.clearRect(0, 0, width, height);
  gridCtx.fillStyle = "#020403";
  gridCtx.fillRect(0, 0, width, height);
  gridCtx.strokeStyle = "rgba(95, 255, 122, 0.14)";
  gridCtx.lineWidth = 1;
  for (let x = 0; x <= snakeState.gridSize; x += 1) {
    const px = x * cellWidth;
    gridCtx.beginPath();
    gridCtx.moveTo(px, 0);
    gridCtx.lineTo(px, height);
    gridCtx.stroke();
  }
  for (let y = 0; y <= snakeState.gridSize; y += 1) {
    const py = y * cellHeight;
    gridCtx.beginPath();
    gridCtx.moveTo(0, py);
    gridCtx.lineTo(width, py);
    gridCtx.stroke();
  }
  return snakeGridCanvas;
};

const snakeCellsMatch = (a, b) => a.x === b.x && a.y === b.y;

const getSnakeCellKey = (x, y) => y * snakeState.gridSize + x;

const rebuildSnakeOccupiedCells = () => {
  snakeState.occupiedCells = new Set(
    snakeState.snake.map((segment) => getSnakeCellKey(segment.x, segment.y))
  );
};

const getSnakeAppleTargetCount = () =>
  Math.max(1, Math.floor(snakeState.score / SNAKE_APPLE_SCORE_INTERVAL) + 1);

const isSnakeAppleCellOpen = (x, y, appleCells) => {
  const cellKey = getSnakeCellKey(x, y);
  return !snakeState.occupiedCells.has(cellKey) && !appleCells.has(cellKey);
};

const getSnakeRandomApple = (existingApples = snakeState.apples) => {
  const appleCells = new Set(
    existingApples.map((apple) => getSnakeCellKey(apple.x, apple.y))
  );
  const totalCells = snakeState.gridSize * snakeState.gridSize;
  const maxAttempts = Math.min(SNAKE_RANDOM_APPLE_ATTEMPTS, totalCells);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = Math.floor(Math.random() * snakeState.gridSize);
    const y = Math.floor(Math.random() * snakeState.gridSize);
    if (isSnakeAppleCellOpen(x, y, appleCells)) {
      return { x, y, sweepOffset: Math.random() };
    }
  }

  const startCell = Math.floor(Math.random() * totalCells);
  for (let offset = 0; offset < totalCells; offset += 1) {
    const cellIndex = (startCell + offset) % totalCells;
    const x = cellIndex % snakeState.gridSize;
    const y = Math.floor(cellIndex / snakeState.gridSize);
    if (isSnakeAppleCellOpen(x, y, appleCells)) {
      return { x, y, sweepOffset: Math.random() };
    }
  }
  return null;
};

const refillSnakeApples = () => {
  const maxApples = Math.max(0, snakeState.gridSize * snakeState.gridSize - snakeState.snake.length);
  const targetCount = Math.min(getSnakeAppleTargetCount(), maxApples);
  while (snakeState.apples.length < targetCount) {
    const apple = getSnakeRandomApple();
    if (!apple) break;
    snakeState.apples.push(apple);
  }
  if (snakeState.apples.length > targetCount) {
    snakeState.apples = snakeState.apples.slice(0, targetCount);
  }
};

const drawSnakeGame = () => {
  const prepared = resizeSnakeCanvas(snakeCanvas);
  if (!prepared) return;
  const { ctx, width, height, ratio } = prepared;
  const cellWidth = width / snakeState.gridSize;
  const cellHeight = height / snakeState.gridSize;

  ctx.drawImage(getSnakeGridLayer(width, height, ratio), 0, 0, width, height);

  const snakeTheme = getSnakeColorTheme();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = snakeTheme.body;
  ctx.shadowColor = snakeTheme.glow;
  ctx.shadowBlur = 7;
  snakeState.snake.forEach((segment, index) => {
    const inset = index === 0 ? 2 : 3;
    const segmentScale = 0.8;
    const baseX = segment.x * cellWidth + inset;
    const baseY = segment.y * cellHeight + inset;
    const baseWidth = cellWidth - inset * 2;
    const baseHeight = cellHeight - inset * 2;
    const segmentWidth = baseWidth * segmentScale;
    const segmentHeight = baseHeight * segmentScale;
    ctx.fillStyle = index === 0 ? snakeTheme.head : snakeTheme.body;
    ctx.fillRect(
      baseX + (baseWidth - segmentWidth) / 2,
      baseY + (baseHeight - segmentHeight) / 2,
      segmentWidth,
      segmentHeight
    );
  });
  ctx.restore();

  const now = performance.now();
  const appleTheme = getSnakeAppleColorTheme();
  snakeState.apples.forEach((apple) => {
    const appleX = apple.x * cellWidth + cellWidth / 2;
    const appleY = apple.y * cellHeight + cellHeight / 2;
    const cellSize = Math.min(cellWidth, cellHeight);
    const dotRadius = Math.max(2.2, cellSize * 0.16);
    const ringRadius = Math.max(dotRadius + 2, cellSize * 0.38);
    const sweepRadius = cellSize * SNAKE_SIGNATURE_SWEEP_CELL_RADIUS;
    const sweepOffset = Number.isFinite(apple.sweepOffset) ? apple.sweepOffset : 0;
    const sweepAngle =
      ((now / SNAKE_SIGNATURE_SWEEP_MS + sweepOffset) % 1) * Math.PI * 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = appleTheme.glow;
    ctx.shadowBlur = Math.max(5, cellSize * 0.35);
    for (let trailIndex = 0; trailIndex < 18; trailIndex += 1) {
      const trailStart = trailIndex / 18;
      const trailEnd = (trailIndex + 1) / 18;
      const startAngle = sweepAngle - trailEnd * 0.95;
      const endAngle = sweepAngle - trailStart * 0.95;
      const trailAlpha = 0.025 + Math.pow(1 - trailStart, 1.8) * 0.17;
      ctx.fillStyle = appleTheme.pulse(trailAlpha);
      ctx.beginPath();
      ctx.arc(appleX, appleY, sweepRadius, startAngle, endAngle);
      ctx.arc(appleX, appleY, ringRadius + 1, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.lineCap = "round";
    ctx.shadowBlur = Math.max(6, cellSize * 0.42);
    ctx.strokeStyle = appleTheme.pulse(0.4);
    ctx.lineWidth = Math.max(1.5, cellSize * 0.12);
    ctx.beginPath();
    ctx.moveTo(
      appleX + Math.cos(sweepAngle) * (ringRadius + 1),
      appleY + Math.sin(sweepAngle) * (ringRadius + 1)
    );
    ctx.lineTo(
      appleX + Math.cos(sweepAngle) * sweepRadius,
      appleY + Math.sin(sweepAngle) * sweepRadius
    );
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = appleTheme.sweepRing;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(appleX, appleY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = appleTheme.head;
    ctx.shadowColor = appleTheme.glow;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(appleX, appleY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  snakeState.collectionPulses = snakeState.collectionPulses.filter((pulse) => {
    const age = now - pulse.startedAt;
    return age < SNAKE_COLLECTION_PULSE_MS;
  });
  snakeState.collectionPulses.forEach((pulse) => {
    const age = now - pulse.startedAt;
    const progress = Math.max(0, Math.min(1, age / SNAKE_COLLECTION_PULSE_MS));
    const pulseX = pulse.x * cellWidth + cellWidth / 2;
    const pulseY = pulse.y * cellHeight + cellHeight / 2;
    const cellSize = Math.min(cellWidth, cellHeight);
    const radius = Math.max(
      2.5,
      cellSize * (0.18 + progress * (SNAKE_COLLECTION_PULSE_CELL_RADIUS - 0.18))
    );
    const alpha = (1 - progress) * 0.46;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = appleTheme.pulse(alpha);
    ctx.lineWidth = 1 + (1 - progress) * 0.7;
    ctx.beginPath();
    ctx.arc(pulseX, pulseY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  if (snakeState.gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(0, height / 2 - 28, width, 56);
    ctx.fillStyle = "rgba(98, 255, 120, 0.9)";
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SIGNAL LOST", width / 2, height / 2 - 9);
    ctx.font = "11px 'Courier New', monospace";
    ctx.fillText("Press RESET or ENTER to try again.", width / 2, height / 2 + 12);
  } else if (!snakeState.hasStarted && !snakeState.loading) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.fillRect(0, height / 2 - 24, width, 48);
    ctx.fillStyle = "rgba(98, 255, 120, 0.92)";
    ctx.shadowColor = "rgba(98, 255, 120, 0.82)";
    ctx.shadowBlur = 10;
    ctx.font = "bold 15px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Press Any Key to Begin", width / 2, height / 2);
    ctx.restore();
  } else if (snakeState.countdownTimer) {
    const elapsed = performance.now() - snakeState.countdownStartedAt;
    const remaining = Math.max(0, snakeState.countdownDuration - elapsed);
    const count = Math.max(
      1,
      Math.ceil((remaining / snakeState.countdownDuration) * 3)
    );
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
    ctx.fillRect(0, height / 2 - 30, width, 60);
    ctx.fillStyle = "rgba(98, 255, 120, 0.95)";
    ctx.shadowColor = "rgba(98, 255, 120, 0.82)";
    ctx.shadowBlur = 14;
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), width / 2, height / 2);
    ctx.restore();
  } else if (snakeState.hasStarted && !snakeState.running) {
    const pauseBarWidth = Math.max(8, width * 0.035);
    const pauseBarHeight = Math.max(40, height * 0.16);
    const pauseGap = Math.max(10, width * 0.04);
    const pauseX = width / 2 - pauseGap / 2 - pauseBarWidth;
    const pauseY = height / 2 - pauseBarHeight / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.fillRect(0, height / 2 - pauseBarHeight * 0.7, width, pauseBarHeight * 1.4);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(98, 255, 120, 0.92)";
    ctx.shadowColor = "rgba(98, 255, 120, 0.82)";
    ctx.shadowBlur = 12;
    ctx.fillRect(pauseX, pauseY, pauseBarWidth, pauseBarHeight);
    ctx.fillRect(pauseX + pauseBarWidth + pauseGap, pauseY, pauseBarWidth, pauseBarHeight);
    ctx.restore();
  }
};

const drawSnakeNoise = () => {
  if (!isSnakeWindowVisible() || isSnakeReducedMotion()) {
    clearDistressPanelNoiseCanvas(snakeNoiseCanvas);
    return;
  }
  drawDistressPanelNoiseCanvas(snakeNoiseCanvas);
};

const stopSnakeNoiseAnimation = () => {
  if (!snakeState.noiseFrame) return;
  cancelAnimationFrame(snakeState.noiseFrame);
  snakeState.noiseFrame = null;
};

const startSnakeNoiseAnimation = () => {
  if (snakeState.noiseFrame) return;
  const animate = (timestamp) => {
    snakeState.noiseFrame = null;
    if (!isSnakeWindowVisible()) {
      return;
    }
    const hasAnimatedGame =
      snakeState.running ||
      snakeState.countdownTimer ||
      snakeState.gameOver ||
      snakeState.collectionPulses.length > 0;
    const allowAnimation = canAnimateSnake();
    const shouldDrawGame =
      snakeRenderDirty ||
      (allowAnimation &&
        hasAnimatedGame &&
        timestamp - snakeLastRenderAt >= SNAKE_RENDER_INTERVAL_MS);

    if (shouldDrawGame) {
      drawSnakeGame();
      snakeRenderDirty = false;
      snakeLastRenderAt = timestamp;
    }

    if (allowAnimation && timestamp - snakeLastNoiseAt >= SNAKE_NOISE_INTERVAL_MS) {
      drawSnakeNoise();
      snakeLastNoiseAt = timestamp;
    } else if (!allowAnimation) {
      clearDistressPanelNoiseCanvas(snakeNoiseCanvas);
    }

    if (snakeRenderDirty || (allowAnimation && hasAnimatedGame)) {
      snakeState.noiseFrame = requestAnimationFrame(animate);
    }
  };
  snakeState.noiseFrame = requestAnimationFrame(animate);
};

const clearSnakeTick = () => {
  if (!snakeState.tickTimer) return;
  clearTimeout(snakeState.tickTimer);
  snakeState.tickTimer = null;
};

const snakeDirectionsOppose = (firstDirection, secondDirection) => {
  const first = SNAKE_DIRECTIONS[firstDirection];
  const second = SNAKE_DIRECTIONS[secondDirection];
  return Boolean(first && second && first.x + second.x === 0 && first.y + second.y === 0);
};

const setSnakeDirection = (direction) => {
  if (!SNAKE_DIRECTIONS[direction]) return;
  const queuedBase =
    snakeState.directionQueue[snakeState.directionQueue.length - 1] ||
    snakeState.nextDirection ||
    snakeState.direction;
  if (direction === queuedBase || snakeDirectionsOppose(queuedBase, direction)) return;
  if (!snakeState.running && !snakeState.countdownTimer) {
    snakeState.nextDirection = direction;
    return;
  }
  if (snakeState.directionQueue.length >= SNAKE_DIRECTION_QUEUE_MAX) return;
  snakeState.directionQueue.push(direction);
  snakeState.nextDirection = direction;
};

const resetSnakeGame = () => {
  clearSnakeTick();
  clearSnakeCountdown();
  const centerY = Math.floor(snakeState.gridSize / 2);
  const startX = Math.max(3, Math.floor(snakeState.gridSize / 2));
  snakeState.snake = [
    { x: startX, y: centerY },
    { x: startX - 1, y: centerY },
    { x: startX - 2, y: centerY },
  ];
  snakeState.direction = "right";
  snakeState.nextDirection = "right";
  snakeState.directionQueue = [];
  snakeState.score = 0;
  snakeState.running = false;
  snakeState.hasStarted = false;
  snakeState.gameOver = false;
  snakeState.apples = [];
  snakeState.collectionPulses = [];
  rebuildSnakeOccupiedCells();
  refillSnakeApples();
  updateSnakeHud();
  requestSnakeRender();
};

const endSnakeGame = () => {
  clearSnakeTick();
  clearSnakeCountdown();
  snakeState.directionQueue = [];
  snakeState.running = false;
  snakeState.gameOver = true;
  saveSnakeHighScores();
  updateSnakeHud();
  requestSnakeRender();
  triggerRandomEvents("gameLoss", { game: "snake" });
};

const snakeStep = () => {
  if (!snakeState.running) return;
  if (snakeState.directionQueue.length) {
    snakeState.nextDirection = snakeState.directionQueue.shift();
  }
  snakeState.direction = snakeState.nextDirection;
  const direction = SNAKE_DIRECTIONS[snakeState.direction];
  const head = snakeState.snake[0];
  const nextHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  const hitWall =
    nextHead.x < 0 ||
    nextHead.y < 0 ||
    nextHead.x >= snakeState.gridSize ||
    nextHead.y >= snakeState.gridSize;
  const nextHeadKey = getSnakeCellKey(nextHead.x, nextHead.y);
  const eatenAppleIndex = snakeState.apples.findIndex((apple) =>
    snakeCellsMatch(nextHead, apple)
  );
  const tail = snakeState.snake[snakeState.snake.length - 1];
  const movingIntoTail =
    eatenAppleIndex === -1 && tail && snakeCellsMatch(nextHead, tail);
  const hitSelf = snakeState.occupiedCells.has(nextHeadKey) && !movingIntoTail;
  if (hitWall || hitSelf) {
    endSnakeGame();
    return;
  }

  if (eatenAppleIndex === -1) {
    const removedTail = snakeState.snake.pop();
    if (removedTail) {
      snakeState.occupiedCells.delete(getSnakeCellKey(removedTail.x, removedTail.y));
    }
  }
  snakeState.snake.unshift(nextHead);
  snakeState.occupiedCells.add(nextHeadKey);
  if (eatenAppleIndex !== -1) {
    const eatenApple = snakeState.apples[eatenAppleIndex];
    snakeState.score += 1;
    updateSnakeHighScore();
    snakeState.collectionPulses.push({
      x: eatenApple.x,
      y: eatenApple.y,
      startedAt: performance.now(),
    });
    snakeState.apples.splice(eatenAppleIndex, 1);
    refillSnakeApples();
  }

  updateSnakeHud();
  requestSnakeRender();
  snakeState.tickTimer = setTimeout(snakeStep, SNAKE_TICK_MS);
};

const finishSnakeCountdown = () => {
  clearSnakeCountdown();
  if (!isSnakeWindowVisible() || document.hidden || !isSnakePageActive()) {
    updateSnakeHud();
    requestSnakeRender();
    return;
  }
  snakeState.running = true;
  snakeState.hasStarted = true;
  updateSnakeHud();
  startSnakeNoiseAnimation();
  if (snakeCanvas) snakeCanvas.focus();
  clearSnakeTick();
  snakeState.tickTimer = setTimeout(snakeStep, SNAKE_TICK_MS);
  requestSnakeRender();
};

const startSnakeGame = () => {
  if (snakeState.loading) return;
  if (snakeState.gameOver) resetSnakeGame();
  if (snakeState.running || snakeState.countdownTimer) return;
  snakeState.hasStarted = true;
  snakeState.countdownStartedAt = performance.now();
  snakeState.countdownDuration = SNAKE_RESUME_COUNTDOWN_MS;
  snakeState.countdownTimer = window.setTimeout(
    finishSnakeCountdown,
    SNAKE_RESUME_COUNTDOWN_MS
  );
  updateSnakeHud();
  startSnakeNoiseAnimation();
  if (snakeCanvas) snakeCanvas.focus();
  clearSnakeTick();
  requestSnakeRender();
};

const pauseSnakeGame = () => {
  if (!snakeState.running && !snakeState.countdownTimer) return;
  snakeState.running = false;
  clearSnakeCountdown();
  clearSnakeTick();
  updateSnakeHud();
  requestSnakeRender();
};

const toggleSnakeGame = () => {
  if (snakeState.running || snakeState.countdownTimer) {
    pauseSnakeGame();
    return;
  }
  startSnakeGame();
};

const shouldSuppressSnakePointerClick = () => {
  const shouldSuppress = performance.now() < snakePointerPauseSuppressUntil;
  if (shouldSuppress) snakePointerPauseSuppressUntil = 0;
  return shouldSuppress;
};

const drawDistressOffDisplay = (ctx, width, height) => {
  ctx.fillStyle = "#020403";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(41, 92, 50, 0.32)";
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }
  drawDistressDisplayGrain(ctx, width, height);
  ctx.fillStyle = "rgba(98, 255, 120, 0.34)";
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RECEIVER OFFLINE", width / 2, height / 2);
};

const drawDistressWave = (
  ctx,
  width,
  height,
  frequencyValue,
  phaseValue,
  color,
  lineWidth
) => {
  const centerY = height * 0.52;
  const amplitude = height * 0.28;
  const noiseAmplitude = height * DISTRESS_WAVE_NOISE;
  const cycles = 1.15 + (frequencyValue / 100) * 3.1;
  const phase = (phaseValue / 100) * Math.PI * 2;
  let thermal = getDistressThermalNoise();
  ctx.beginPath();
  for (let x = 0; x <= width; x += DISTRESS_NOISE_SAMPLE_STEP) {
    const signal = Math.sin((x / width) * cycles * Math.PI * 2 + phase) * amplitude;
    thermal = thermal * 0.04 + getDistressThermalNoise() * 0.96;
    const fineStatic = getDistressThermalNoise() * noiseAmplitude * 1.05;
    const jitter = thermal * noiseAmplitude + fineStatic;
    const y = centerY + signal + jitter;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
};

const drawDistressSignals = () => {
  drawDistressPanelNoise();
  if (!distressSignalCanvas) return;
  const ctx = distressSignalCanvas.getContext("2d");
  if (!ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(
    1,
    Math.round(distressSignalCanvas.clientWidth || DISTRESS_CANVAS_WIDTH)
  );
  const height = Math.max(
    1,
    Math.round(distressSignalCanvas.clientHeight || DISTRESS_CANVAS_HEIGHT)
  );
  if (
    distressSignalCanvas.width !== Math.round(width * ratio) ||
    distressSignalCanvas.height !== Math.round(height * ratio)
  ) {
    distressSignalCanvas.width = Math.round(width * ratio);
    distressSignalCanvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!distressPoweredOn) {
    drawDistressOffDisplay(ctx, width, height);
    return;
  }
  ctx.fillStyle = "#020403";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(95, 255, 122, 0.14)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  drawDistressStatic(ctx, width, height);
  const frequency = distressFrequencyDial ? Number(distressFrequencyDial.value) : 0;
  const phase = distressPhaseDial ? Number(distressPhaseDial.value) : 0;
  drawDistressWave(
    ctx,
    width,
    height,
    distressTargetFrequency,
    distressTargetPhase,
    "#8f1d1d",
    2
  );
  drawDistressWave(ctx, width, height, frequency, phase, "#2f9a4b", 2);
  drawDistressDisplayGrain(ctx, width, height);
};

const stopDistressNoiseAnimation = () => {
  if (!distressNoiseAnimationFrame) return;
  cancelAnimationFrame(distressNoiseAnimationFrame);
  distressNoiseAnimationFrame = null;
};

const startDistressNoiseAnimation = () => {
  if (!distressPoweredOn) return;
  if (distressNoiseAnimationFrame) return;
  const animate = () => {
    if (!distressPoweredOn || !isDistressWindowVisible(distressSignalWindow)) {
      distressNoiseAnimationFrame = null;
      return;
    }
    drawDistressSignals();
    distressNoiseAnimationFrame = requestAnimationFrame(animate);
  };
  distressNoiseAnimationFrame = requestAnimationFrame(animate);
};

const updateDistressTuning = () => {
  drawDistressSignals();
  if (
    !distressPoweredOn ||
    distressSignalSolved ||
    !isDistressWindowVisible(distressSignalWindow)
  ) {
    return;
  }
  const alignment = getDistressAlignment();
  const aligned =
    alignment.frequencyDelta <= DISTRESS_ALIGNMENT_TOLERANCE &&
    alignment.phaseDelta <= DISTRESS_ALIGNMENT_TOLERANCE;
  const signalStrength = Math.max(
    0,
    Math.min(99, Math.round(100 - alignment.frequencyDelta * 1.4 - alignment.phaseDelta * 1.4))
  );
  if (aligned) {
    distressSignalSolved = true;
    setDistressDialsDisabled(true);
    setDistressStatus("Signal locked");
    lockDistressNavigation();
    if (distressUploadTimer) clearTimeout(distressUploadTimer);
    distressUploadTimer = setTimeout(() => {
      distressUploadTimer = null;
      showDistressUploadWindow();
    }, DISTRESS_UPLOAD_DELAY_MS);
    return;
  }
  const closeEnough = alignment.frequencyDelta <= 9 && alignment.phaseDelta <= 9;
  setDistressStatus(closeEnough ? "Signal stabilizing" : "Signal drifting");
  if (closeEnough) {
    setDistressNavigationReadout("Bearing resolving", "--", "--", `${signalStrength}%`);
  } else {
    setDistressNavigationReadout("Triangulating", "--", "--", `${signalStrength}%`);
  }
};

const clearDistressPowerTimer = () => {
  if (!distressPowerTimer) return;
  clearInterval(distressPowerTimer);
  distressPowerTimer = null;
};

const finishDistressPowerOn = () => {
  clearDistressPowerTimer();
  distressPoweredOn = true;
  if (distressRadioPanel) distressRadioPanel.classList.remove("is-off");
  if (distressPowerButton) distressPowerButton.disabled = true;
  setDistressPowerProgress(1);
  setDistressDialsDisabled(false);
  setDistressStatus("Signal drifting");
  scanDistressNavigation();
  updateDistressTuning();
  startDistressNoiseAnimation();
  requestAnimationFrame(() => {
    if (distressFrequencyDial) distressFrequencyDial.focus();
  });
};

const startDistressPowerSequence = () => {
  if (distressPoweredOn || distressPowerTimer) return;
  const startedAt = performance.now();
  distressPowerVisibleProgress = 0;
  if (distressPowerButton) distressPowerButton.disabled = true;
  setDistressStatus("Receiver warming up");
  setDistressPowerProgress(0);
  drawDistressSignals();
  distressPowerTimer = setInterval(() => {
    const progress = (performance.now() - startedAt) / DISTRESS_POWER_DURATION_MS;
    const targetProgress = Math.min(1, progress);
    const shouldJump =
      targetProgress >= 1 ||
      Math.random() < 0.44 ||
      targetProgress - distressPowerVisibleProgress > 0.09;
    if (shouldJump) {
      const jumpSize = 0.018 + Math.random() * 0.09;
      distressPowerVisibleProgress = Math.min(
        1,
        Math.max(
          distressPowerVisibleProgress,
          Math.min(targetProgress + Math.random() * 0.035, distressPowerVisibleProgress + jumpSize)
        )
      );
    }
    setDistressPowerProgress(distressPowerVisibleProgress);
    drawDistressSignals();
    if (progress >= 1) finishDistressPowerOn();
  }, DISTRESS_POWER_TICK_MS);
};

const resetDistressSignal = () => {
  if (distressUploadTimer) {
    clearTimeout(distressUploadTimer);
    distressUploadTimer = null;
  }
  clearDistressPowerTimer();
  stopDistressNoiseAnimation();
  distressPoweredOn = false;
  distressSignalSolved = false;
  distressSignalBearing = Math.random() * 360;
  distressSignalRange = 3.5 + Math.random() * 48;
  if (distressRadioPanel) distressRadioPanel.classList.add("is-off");
  if (distressPowerButton) distressPowerButton.disabled = false;
  distressPowerVisibleProgress = 0;
  setDistressPowerProgress(0);
  resetDistressNavigation();
  distressTargetFrequency = 20 + Math.random() * 60;
  distressTargetPhase = Math.random() * 100;
  if (distressFrequencyDial) {
    const offset = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 24);
    distressFrequencyDial.value = String(
      Math.max(0, Math.min(100, Math.round(distressTargetFrequency + offset)))
    );
  }
  if (distressPhaseDial) {
    distressPhaseDial.value = String(Math.round((distressTargetPhase + 35 + Math.random() * 30) % 100));
  }
  setDistressDialsDisabled(true);
  setDistressStatus("Receiver offline");
  drawDistressSignals();
};

const showDistressUploadWindow = () => {
  if (!distressUploadWindow) return;
  distressUploadWindow.classList.remove("is-hidden", "is-closing");
  distressUploadWindow.setAttribute("aria-hidden", "false");
  positionRandomEventWindowInViewport(distressUploadWindow);
  distressUploadWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(distressUploadWindow, "is-opening");
  requestAnimationFrame(() => {
    if (distressUploadOk) distressUploadOk.focus();
  });
};

const showDistressSignalWindow = () => {
  if (!distressSignalWindow) return;
  if (isDistressSignalVisible()) {
    [distressUploadWindow, distressSignalWindow].some((win) => {
      if (!isDistressWindowVisible(win)) return false;
      win.style.zIndex = String(topZ++);
      return true;
    });
    return;
  }
  resetDistressSignal();
  loadDeferredMedia(distressSignalWindow);
  distressSignalWindow.classList.remove("is-hidden", "is-closing");
  distressSignalWindow.setAttribute("aria-hidden", "false");
  positionRandomEventWindowInViewport(distressSignalWindow);
  distressSignalWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(distressSignalWindow, "is-opening");
  requestAnimationFrame(drawDistressSignals);
};

const closeDistressWindow = (win) => {
  if (!win || win.classList.contains("is-hidden")) return;
  if (win === distressSignalWindow) {
    clearDistressPowerTimer();
    stopDistressNoiseAnimation();
  }
  win.setAttribute("aria-hidden", "true");
  restartWindowAnimation(win, "is-closing");
};

const closeDistressSignalEvent = () => {
  if (distressUploadTimer) {
    clearTimeout(distressUploadTimer);
    distressUploadTimer = null;
  }
  closeDistressWindow(distressSignalWindow);
  closeDistressWindow(distressUploadWindow);
};

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isFelizJuevesVisible = () =>
  Boolean(
    felizJuevesWindow &&
      !felizJuevesWindow.classList.contains("is-hidden") &&
      felizJuevesWindow.getAttribute("aria-hidden") === "false"
  );

const hasShownFelizJuevesToday = (dateKey) => {
  try {
    return localStorage.getItem(FELIZ_JUEVES_SHOWN_KEY) === dateKey;
  } catch (error) {
    return felizJuevesShownFallbackDate === dateKey;
  }
};

const markFelizJuevesShown = (dateKey) => {
  felizJuevesShownFallbackDate = dateKey;
  try {
    localStorage.setItem(FELIZ_JUEVES_SHOWN_KEY, dateKey);
  } catch (error) {
    // Local storage can be disabled in private browsing modes.
  }
};

const showFelizJuevesWindow = () => {
  if (!felizJuevesWindow) return;
  if (isFelizJuevesVisible()) {
    felizJuevesWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(felizJuevesWindow);
  felizJuevesWindow.classList.remove("is-hidden", "is-closing", "is-choice-flashing");
  felizJuevesWindow.setAttribute("aria-hidden", "false");
  positionRandomEventWindowInViewport(felizJuevesWindow);
  felizJuevesWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(felizJuevesWindow, "is-opening");
};

const closeFelizJuevesWindow = () => {
  if (!felizJuevesWindow || felizJuevesWindow.classList.contains("is-hidden")) return;
  felizJuevesWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(felizJuevesWindow, "is-closing");
};

const flashFelizJuevesChoice = () => {
  if (!felizJuevesWindow) return;
  if (felizJuevesFlashTimer) clearTimeout(felizJuevesFlashTimer);
  felizJuevesWindow.classList.add("is-choice-flashing");
  felizJuevesFlashTimer = setTimeout(() => {
    felizJuevesWindow.classList.remove("is-choice-flashing");
    felizJuevesFlashTimer = null;
  }, 300);
};

const maybeShowFelizJueves = () => {
  const today = new Date();
  if (today.getDay() !== 4) return false;
  const dateKey = getLocalDateKey(today);
  if (hasShownFelizJuevesToday(dateKey)) return false;
  if (
    !randomEventKindCanSchedule(RANDOM_EVENT_KIND_NON_INTERACTIVE, {
      consumeRelease: true,
    })
  ) {
    return false;
  }
  markFelizJuevesShown(dateKey);
  showFelizJuevesWindow();
  return true;
};

const isNazarVisible = () =>
  Boolean(
    nazarWindow &&
      !nazarWindow.classList.contains("is-hidden") &&
      nazarWindow.getAttribute("aria-hidden") === "false"
  );

const positionNazarWindow = () => {
  positionRandomEventWindowInViewport(nazarWindow);
};

const showNazarWindow = () => {
  if (!nazarWindow) return;
  if (isNazarVisible()) {
    nazarWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(nazarWindow);
  nazarWindow.classList.remove("is-hidden", "is-closing");
  nazarWindow.setAttribute("aria-hidden", "false");
  positionNazarWindow();
  nazarWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(nazarWindow, "is-opening");
};

const closeNazarWindow = () => {
  if (!nazarWindow || nazarWindow.classList.contains("is-hidden")) return;
  nazarWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(nazarWindow, "is-closing");
};

const isSiteGraceVisible = () =>
  Boolean(
    siteGraceWindow &&
      !siteGraceWindow.classList.contains("is-hidden") &&
      siteGraceWindow.getAttribute("aria-hidden") === "false"
  );

const positionSiteGraceWindow = () => {
  positionRandomEventWindowInViewport(siteGraceWindow);
};

const showSiteGraceWindow = () => {
  if (!siteGraceWindow) return;
  if (isSiteGraceVisible()) {
    siteGraceWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(siteGraceWindow);
  siteGraceWindow.classList.remove("is-hidden", "is-closing");
  siteGraceWindow.setAttribute("aria-hidden", "false");
  positionSiteGraceWindow();
  siteGraceWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(siteGraceWindow, "is-opening");
};

const closeSiteGraceWindow = () => {
  if (!siteGraceWindow || siteGraceWindow.classList.contains("is-hidden")) return;
  siteGraceWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(siteGraceWindow, "is-closing");
};

const showLostGraceOverlay = () => {
  if (!lostGraceOverlay) return;
  if (lostGraceOverlayTimer) clearTimeout(lostGraceOverlayTimer);
  lostGraceOverlay.classList.remove("is-visible");
  void lostGraceOverlay.offsetWidth;
  lostGraceOverlay.setAttribute("aria-hidden", "false");
  lostGraceOverlay.classList.add("is-visible");
  lostGraceOverlayTimer = setTimeout(() => {
    lostGraceOverlay.classList.remove("is-visible");
    lostGraceOverlay.setAttribute("aria-hidden", "true");
    lostGraceOverlayTimer = null;
  }, 4800);
};

const touchSiteGrace = () => {
  closeSiteGraceWindow();
  showLostGraceOverlay();
};

const isStalkerWindowVisible = (win) =>
  Boolean(
    win && !win.classList.contains("is-hidden") && win.getAttribute("aria-hidden") === "false"
  );

const isStalkerVisible = () =>
  isStalkerWindowVisible(stalkerWindow) || isStalkerWindowVisible(stalkerResultWindow);

const positionStalkerWindow = (win) => {
  positionRandomEventWindowInViewport(win);
};

const copyStalkerWindowPosition = (source, target) => {
  if (!source || !target) return false;
  target.style.translate = source.style.translate || "0 0";
  target.style.left = source.style.left;
  target.style.top = source.style.top;
  return Boolean(source.style.left && source.style.top);
};

const showStalkerWindow = (win = stalkerWindow, anchorWindow = null) => {
  if (!win) return;
  if (isStalkerWindowVisible(win)) {
    win.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(win);
  win.classList.remove("is-hidden", "is-closing");
  win.setAttribute("aria-hidden", "false");
  if (!copyStalkerWindowPosition(anchorWindow, win)) {
    positionStalkerWindow(win);
  }
  win.style.zIndex = String(topZ++);
  restartWindowAnimation(win, "is-opening");
};

const closeStalkerWindow = (win = stalkerWindow) => {
  if (!win || win.classList.contains("is-hidden")) return;
  win.setAttribute("aria-hidden", "true");
  restartWindowAnimation(win, "is-closing");
};

const showStalkerResultWindow = (anchorWindow = null) => {
  showStalkerWindow(stalkerResultWindow, anchorWindow);
};

const isNanaEncounterWindowVisible = (win) =>
  Boolean(
    win && !win.classList.contains("is-hidden") && win.getAttribute("aria-hidden") === "false"
  );

const isNanaEncounterVisible = () =>
  isNanaEncounterWindowVisible(nanaEncounterWindow) ||
  isNanaEncounterWindowVisible(nanaAcceptWindow);

const setNanaEncounterWindowPosition = (win, left, top) => {
  if (!win) return false;
  setRandomEventWindowPosition(win, left, top);
  return true;
};

const positionNanaEncounterWindow = (win) => {
  positionRandomEventWindowInViewport(win);
};

const copyNanaEncounterPosition = (source, target) => {
  if (!source || !target) return false;
  const sourceLeft = Number.parseFloat(source.style.left);
  const sourceTop = Number.parseFloat(source.style.top);
  if (!Number.isFinite(sourceLeft) || !Number.isFinite(sourceTop)) return false;
  return setNanaEncounterWindowPosition(target, sourceLeft, sourceTop);
};

const showNanaEncounterWindow = () => {
  if (!nanaEncounterWindow) return;
  if (isNanaEncounterWindowVisible(nanaEncounterWindow)) {
    nanaEncounterWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(nanaEncounterWindow);
  nanaEncounterWindow.classList.remove("is-hidden", "is-closing");
  nanaEncounterWindow.setAttribute("aria-hidden", "false");
  positionNanaEncounterWindow(nanaEncounterWindow);
  nanaEncounterWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(nanaEncounterWindow, "is-opening");
};

const showNanaAcceptWindow = (anchorWindow = null) => {
  if (!nanaAcceptWindow) return;
  if (isNanaEncounterWindowVisible(nanaAcceptWindow)) {
    nanaAcceptWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(nanaAcceptWindow);
  nanaAcceptWindow.classList.remove("is-hidden", "is-closing");
  nanaAcceptWindow.setAttribute("aria-hidden", "false");
  if (!copyNanaEncounterPosition(anchorWindow, nanaAcceptWindow)) {
    positionNanaEncounterWindow(nanaAcceptWindow);
  }
  nanaAcceptWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(nanaAcceptWindow, "is-opening");
};

const closeNanaEncounterWindow = (win) => {
  if (!win || win.classList.contains("is-hidden")) return;
  win.setAttribute("aria-hidden", "true");
  restartWindowAnimation(win, "is-closing");
};

const acceptNanaEncounter = () => {
  const anchor = nanaEncounterWindow;
  closeNanaEncounterWindow(nanaEncounterWindow);
  setTimeout(() => {
    showNanaAcceptWindow(anchor);
  }, 180);
};

const isLainAlertVisible = () =>
  Boolean(
    lainAlertWindow &&
      !lainAlertWindow.classList.contains("is-hidden") &&
      lainAlertWindow.getAttribute("aria-hidden") === "false"
  );

const positionLainAlertWindow = () => {
  positionRandomEventWindowInViewport(lainAlertWindow);
};

const showLainAlert = () => {
  if (!lainAlertWindow) return;
  if (isLainAlertVisible()) {
    lainAlertWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(lainAlertWindow);
  lainAlertWindow.classList.remove("is-hidden", "is-closing");
  lainAlertWindow.setAttribute("aria-hidden", "false");
  positionLainAlertWindow();
  lainAlertWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(lainAlertWindow, "is-opening");
};

const closeLainAlert = () => {
  if (!lainAlertWindow || lainAlertWindow.classList.contains("is-hidden")) return;
  lainAlertWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(lainAlertWindow, "is-closing");
};

const isLelouchAlertVisible = () =>
  Boolean(
    lelouchAlertWindow &&
      !lelouchAlertWindow.classList.contains("is-hidden") &&
      lelouchAlertWindow.getAttribute("aria-hidden") === "false"
  );

const positionLelouchAlertWindow = () => {
  positionRandomEventWindowInViewport(lelouchAlertWindow);
};

const showLelouchAlert = () => {
  if (!lelouchAlertWindow) return;
  if (isLelouchAlertVisible()) {
    lelouchAlertWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(lelouchAlertWindow);
  lelouchAlertWindow.classList.remove("is-hidden", "is-closing");
  lelouchAlertWindow.setAttribute("aria-hidden", "false");
  positionLelouchAlertWindow();
  lelouchAlertWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(lelouchAlertWindow, "is-opening");
};

const closeLelouchAlert = () => {
  if (!lelouchAlertWindow || lelouchAlertWindow.classList.contains("is-hidden")) return;
  lelouchAlertWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(lelouchAlertWindow, "is-closing");
};

const isInstrumentalityWindowVisible = (win) =>
  Boolean(
    win && !win.classList.contains("is-hidden") && win.getAttribute("aria-hidden") === "false"
  );

const isInstrumentalityVisible = () =>
  isInstrumentalityWindowVisible(instrumentalityWindow) ||
  isInstrumentalityWindowVisible(instrumentalityCongratsWindow);

const positionInstrumentalityWindow = (win) => {
  positionRandomEventWindowInViewport(win);
};

const showInstrumentalityWindow = (win) => {
  if (!win) return;
  if (isInstrumentalityWindowVisible(win)) {
    win.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(win);
  win.classList.remove("is-hidden", "is-closing");
  win.setAttribute("aria-hidden", "false");
  positionInstrumentalityWindow(win);
  win.style.zIndex = String(topZ++);
  restartWindowAnimation(win, "is-opening");
};

const closeInstrumentalityWindow = (win) => {
  if (!win || win.classList.contains("is-hidden")) return;
  win.setAttribute("aria-hidden", "true");
  restartWindowAnimation(win, "is-closing");
};

const showInstrumentalityPrompt = () => {
  showInstrumentalityWindow(instrumentalityWindow);
};

const showInstrumentalityCongrats = () => {
  showInstrumentalityWindow(instrumentalityCongratsWindow);
};

const rejectInstrumentality = () => {
  closeInstrumentalityWindow(instrumentalityWindow);
  showInstrumentalityCongrats();
};

const isRedToolVisible = () =>
  Boolean(
    redToolWindow &&
      !redToolWindow.classList.contains("is-hidden") &&
      redToolWindow.getAttribute("aria-hidden") === "false"
  );

const positionRedToolWindow = () => {
  positionRandomEventWindowInViewport(redToolWindow);
};

const scrollRedToolChatToBottom = () => {
  if (!redToolChatLog) return;
  redToolChatLog.scrollTop = redToolChatLog.scrollHeight;
};

const appendRedToolMessage = (speaker, message, { local = false } = {}) => {
  if (!redToolChatLog) return null;
  const row = document.createElement("div");
  row.className = `red-tool-message${local ? " is-local" : ""}`;

  const icon = document.createElement("img");
  icon.src = local
    ? "assets/app-icons/ico/address_book_user.ico"
    : "assets/random%20events/red-tool-icon.png";
  if (!local) icon.className = "red-tool-avatar";
  icon.alt = "";

  const text = document.createElement("p");
  const name = document.createElement("strong");
  name.textContent = `${speaker}:`;
  text.append(name, ` ${message}`);

  row.append(icon, text);
  redToolChatLog.appendChild(row);
  scrollRedToolChatToBottom();
  return row;
};

const resetRedToolTyping = () => {
  if (redToolTypingStartTimer) {
    clearTimeout(redToolTypingStartTimer);
    redToolTypingStartTimer = null;
  }
  if (redToolReplyTimer) {
    clearTimeout(redToolReplyTimer);
    redToolReplyTimer = null;
  }
  if (redToolTypingTimer) {
    clearInterval(redToolTypingTimer);
    redToolTypingTimer = null;
  }
  redToolTypingFrame = 0;
  if (redToolTypingElement) {
    redToolTypingElement.remove();
    redToolTypingElement = null;
  }
  if (redToolInput) {
    redToolInput.disabled = false;
    redToolInput.placeholder = "Type a message and press Enter";
  }
  if (redToolSend) {
    redToolSend.disabled = false;
  }
};

const sampleRedToolTypingStartDelay = () => 1000 + Math.random() * 1000;

const RED_TOOL_REPLY_BASE_DELAY_MS = 3000;

const sampleRedToolReplyDelay = () => {
  const lambda = 0.5;
  return (-Math.log(1 - Math.random()) / lambda) * 1000;
};

const showRedToolTyping = () => {
  if (!redToolChatLog) return;
  if (redToolTypingElement) redToolTypingElement.remove();
  const row = document.createElement("div");
  row.className = "red-tool-message red-tool-typing";

  const icon = document.createElement("img");
  icon.src = "assets/random%20events/red-tool-icon.png";
  icon.className = "red-tool-avatar";
  icon.alt = "";

  const text = document.createElement("p");
  text.textContent = "Red Tool is typing";

  row.append(icon, text);
  redToolChatLog.appendChild(row);
  redToolTypingElement = row;
  redToolTypingFrame = 0;
  if (redToolTypingTimer) clearInterval(redToolTypingTimer);
  redToolTypingTimer = setInterval(() => {
    redToolTypingFrame = (redToolTypingFrame + 1) % 4;
    text.textContent = `Red Tool is typing${".".repeat(redToolTypingFrame)}`;
  }, 360);
  scrollRedToolChatToBottom();
};

const sendRedToolMessage = () => {
  if (!redToolInput || redToolInput.disabled) return;
  const message = redToolInput.value.trim();
  if (!message) return;
  appendRedToolMessage("You", message, { local: true });
  redToolInput.value = "";
  redToolInput.disabled = true;
  redToolInput.placeholder = "Waiting for Red Tool...";
  if (redToolSend) redToolSend.disabled = true;
  redToolTypingStartTimer = setTimeout(() => {
    redToolTypingStartTimer = null;
    if (isRedToolVisible()) showRedToolTyping();
  }, sampleRedToolTypingStartDelay());
  redToolReplyTimer = setTimeout(() => {
    if (redToolTypingStartTimer) {
      clearTimeout(redToolTypingStartTimer);
      redToolTypingStartTimer = null;
    }
    if (redToolTypingTimer) {
      clearInterval(redToolTypingTimer);
      redToolTypingTimer = null;
    }
    if (redToolTypingElement) redToolTypingElement.remove();
    redToolTypingElement = null;
    appendRedToolMessage("Red Tool", "I don't know.");
    redToolReplyTimer = null;
    if (redToolInput && isRedToolVisible()) {
      redToolInput.disabled = false;
      redToolInput.placeholder = "Type a message and press Enter";
      redToolInput.focus();
    }
    if (redToolSend && isRedToolVisible()) {
      redToolSend.disabled = false;
    }
  }, RED_TOOL_REPLY_BASE_DELAY_MS + sampleRedToolReplyDelay());
};

const showRedToolWindow = () => {
  if (!redToolWindow) return;
  if (isRedToolVisible()) {
    redToolWindow.style.zIndex = String(topZ++);
    if (redToolInput && !redToolInput.disabled) redToolInput.focus();
    return;
  }
  resetRedToolTyping();
  loadDeferredMedia(redToolWindow);
  redToolWindow.classList.remove("is-hidden", "is-closing");
  redToolWindow.setAttribute("aria-hidden", "false");
  positionRedToolWindow();
  redToolWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(redToolWindow, "is-opening");
  requestAnimationFrame(() => {
    if (redToolInput) redToolInput.focus();
  });
};

const closeRedToolWindow = () => {
  if (!redToolWindow || redToolWindow.classList.contains("is-hidden")) return;
  resetRedToolTyping();
  redToolWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(redToolWindow, "is-closing");
};

const FATE_START_PROGRESS = 56;
const FATE_PRESS_GAIN = 5;
const FATE_DRAIN_INTERVAL_MS = 80;
const FATE_DRAIN_AMOUNT = 1.9;
const FATE_RESULT_FREEZE_MS = 1000;
const FATE_RESULT_REOPEN_DELAY_MS = 500;
const FATE_SUCCESS_TEXT =
  "You have resisted causality. Maybe you aren't a shadow on the water... but instead, a fish that breaches water's surface.";
const FATE_LOSS_TEXT = "Perhaps you do not have the strength to resist causality.";
const FATE_LIGHTNING_DURATION_MS = 220;
const FATE_LIGHTNING_BRANCH_CHANCE = 0.22;

const getFateLightningContext = () => {
  if (!fateLightningCanvas) return null;
  return fateLightningCanvas.getContext("2d");
};

const resizeFateLightningCanvas = () => {
  const ctx = getFateLightningContext();
  if (!ctx || !fateLightningCanvas) return null;
  const field = fateLightningCanvas.parentElement;
  const rect = field ? field.getBoundingClientRect() : fateLightningCanvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(height * dpr);

  if (fateLightningCanvas.width !== nextWidth || fateLightningCanvas.height !== nextHeight) {
    fateLightningCanvas.width = nextWidth;
    fateLightningCanvas.height = nextHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
};

const clearFateLightningCanvas = () => {
  const setup = resizeFateLightningCanvas();
  if (!setup) return;
  setup.ctx.clearRect(0, 0, setup.width, setup.height);
};

const generateFateBoltPath = (
  x1,
  y1,
  x2,
  y2,
  displacement,
  branchLevel,
  bolts
) => {
  const midpointX = (x1 + x2) / 2;
  const midpointY = (y1 + y2) / 2;

  if (displacement < 0.5) {
    return [[x2, y2]];
  }

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const offset = (Math.random() - 0.5) * displacement * 3 * (1 - branchLevel * 0.14);
  const newMidX = midpointX + Math.cos(angle + Math.PI / 2) * offset;
  const newMidY = midpointY + Math.sin(angle + Math.PI / 2) * offset;
  const newDisplacement = displacement * 0.42;

  if (branchLevel < 2 && Math.random() < FATE_LIGHTNING_BRANCH_CHANCE) {
    const branchAngle = angle + (Math.random() - 0.5) * Math.PI * 0.95;
    const branchLength = displacement * (Math.random() * 2.6 + 1.6);
    const branchX2 = newMidX + Math.cos(branchAngle) * branchLength;
    const branchY2 = newMidY + Math.sin(branchAngle) * branchLength;
    const branchPath = generateFateBoltPath(
      newMidX,
      newMidY,
      branchX2,
      branchY2,
      newDisplacement,
      branchLevel + 1,
      bolts
    );

    bolts.push({
      path: branchPath,
      start: [newMidX, newMidY],
      level: branchLevel + 1,
    });
  }

  const path1 = generateFateBoltPath(
    x1,
    y1,
    newMidX,
    newMidY,
    newDisplacement,
    branchLevel,
    bolts
  );
  const path2 = generateFateBoltPath(
    newMidX,
    newMidY,
    x2,
    y2,
    newDisplacement,
    branchLevel,
    bolts
  );

  return path1.concat([[newMidX, newMidY]], path2);
};

const drawFateBolt = (ctx, path, startX, startY, level, alpha) => {
  const opacity = alpha * Math.max(0.3, 1 - level * 0.24);
  const glowWidth = level === 0 ? 6 : 3;
  const coreWidth = level === 0 ? 1.4 : 0.65;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
  ctx.lineWidth = glowWidth;
  ctx.shadowBlur = level === 0 ? 16 : 9;
  ctx.shadowColor = "rgba(255, 0, 0, 0.95)";
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 60, 60, ${opacity})`;
  ctx.lineWidth = Math.max(1.4, glowWidth * 0.42);
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 235, 235, ${Math.min(1, opacity + 0.18)})`;
  ctx.lineWidth = coreWidth;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();
  ctx.restore();
};

const drawFateLightningBorderFrame = (alpha) => {
  const setup = resizeFateLightningCanvas();
  if (!setup) return;
  const { ctx, width, height } = setup;
  const inset = 18;
  const left = inset;
  const top = inset;
  const right = Math.max(left + 1, width - inset);
  const bottom = Math.max(top + 1, height - inset);
  const displacement = Math.max(6, Math.min(13, Math.min(width, height) / 14));
  const edges = [
    [left, top, right, top],
    [right, top, right, bottom],
    [right, bottom, left, bottom],
    [left, bottom, left, top],
  ];
  const bolts = [];

  ctx.clearRect(0, 0, width, height);
  edges.forEach(([x1, y1, x2, y2]) => {
    const startX = x1 + (Math.random() - 0.5) * 4;
    const startY = y1 + (Math.random() - 0.5) * 4;
    const endX = x2 + (Math.random() - 0.5) * 4;
    const endY = y2 + (Math.random() - 0.5) * 4;
    const path = generateFateBoltPath(
      startX,
      startY,
      endX,
      endY,
      displacement,
      0,
      bolts
    );

    bolts.push({ path, start: [startX, startY], level: 0 });
  });

  bolts.forEach((bolt) => {
    drawFateBolt(ctx, bolt.path, bolt.start[0], bolt.start[1], bolt.level, alpha);
  });
};

const startFateLightningStrike = () => {
  if (!fateLightningCanvas) return;
  if (fateLightningFrame) cancelAnimationFrame(fateLightningFrame);
  const startedAt = performance.now();

  const render = (now) => {
    const progress = Math.min(1, (now - startedAt) / FATE_LIGHTNING_DURATION_MS);
    const flicker = progress < 0.16 ? 1 : Math.random() > 0.32 ? 1 - progress * 0.42 : 0.18;
    const alpha = Math.max(0, flicker * (1 - progress * 0.36));
    drawFateLightningBorderFrame(alpha);

    if (progress < 1) {
      fateLightningFrame = requestAnimationFrame(render);
      return;
    }

    fateLightningFrame = null;
    clearFateLightningCanvas();
  };

  fateLightningFrame = requestAnimationFrame(render);
};

const isFateVisible = () =>
  Boolean(
    fateWindow &&
      !fateWindow.classList.contains("is-hidden") &&
      fateWindow.getAttribute("aria-hidden") === "false"
  );

const positionFateWindow = () => {
  positionRandomEventWindowInViewport(fateWindow);
};

const updateFateProgress = () => {
  const progress = Math.min(100, Math.max(0, fateProgressValue));
  if (fateProgressBar) fateProgressBar.style.width = `${progress}%`;
  if (fateProgress) fateProgress.setAttribute("aria-valuenow", Math.round(progress));
};

const clearFateTimers = () => {
  if (fateDrainTimer) {
    clearInterval(fateDrainTimer);
    fateDrainTimer = null;
  }
  if (fateLightningTimer) {
    clearTimeout(fateLightningTimer);
    fateLightningTimer = null;
  }
  if (fateLightningFrame) {
    cancelAnimationFrame(fateLightningFrame);
    fateLightningFrame = null;
  }
  if (fateResolveTimer) {
    clearTimeout(fateResolveTimer);
    fateResolveTimer = null;
  }
  if (fateResultOpenTimer) {
    clearTimeout(fateResultOpenTimer);
    fateResultOpenTimer = null;
  }
  if (fateWindow) fateWindow.classList.remove("is-resisting");
  clearFateLightningCanvas();
};

const resetFateWindow = () => {
  clearFateTimers();
  fateState = "ready";
  fateProgressValue = FATE_START_PROGRESS;
  updateFateProgress();
  if (fateTitle) fateTitle.textContent = "Resist Causality";
  if (fateReadyStage) fateReadyStage.classList.remove("is-hidden");
  if (fateFightStage) fateFightStage.classList.add("is-hidden");
  if (fateResultStage) fateResultStage.classList.add("is-hidden");
  if (fateResultImage) {
    fateResultImage.removeAttribute("src");
    fateResultImage.alt = "";
  }
  if (fateResultCredit) fateResultCredit.classList.add("is-hidden");
  if (fateResultText) fateResultText.textContent = "";
  if (fateResultOk) fateResultOk.textContent = "OK";
  if (fateStart) fateStart.disabled = false;
  if (fateResist) fateResist.disabled = false;
};

const startFateMinigame = () => {
  if (fateState !== "ready") return;
  fateState = "active";
  fateProgressValue = FATE_START_PROGRESS;
  updateFateProgress();
  if (fateReadyStage) fateReadyStage.classList.add("is-hidden");
  if (fateFightStage) fateFightStage.classList.remove("is-hidden");
  if (fateStart) fateStart.disabled = true;
  if (fateResist) {
    fateResist.disabled = false;
    fateResist.focus();
  }
  startFateDrain();
};

const pulseFateWindow = () => {
  if (!fateWindow) return;
  fateWindow.classList.remove("is-resisting");
  void fateWindow.offsetWidth;
  fateWindow.classList.add("is-resisting");
  startFateLightningStrike();
  if (fateLightningTimer) clearTimeout(fateLightningTimer);
  fateLightningTimer = setTimeout(() => {
    fateWindow.classList.remove("is-resisting");
    fateLightningTimer = null;
  }, 240);
};

const setFateResultContent = (success) => {
  if (fateTitle) fateTitle.textContent = success ? "Causality Resisted" : "Causality Accepted";
  if (fateReadyStage) fateReadyStage.classList.add("is-hidden");
  if (fateFightStage) fateFightStage.classList.add("is-hidden");
  if (fateResultStage) fateResultStage.classList.remove("is-hidden");
  if (fateResultImage) {
    fateResultImage.src = success
      ? "assets/random%20events/zodd_defeated_by_shld0n_hcks.jpg"
      : "assets/random%20events/guts-lost.jpeg";
    fateResultImage.alt = "";
  }
  if (fateResultCredit) {
    fateResultCredit.classList.toggle("is-hidden", !success);
  }
  if (fateResultText) {
    fateResultText.textContent = success ? FATE_SUCCESS_TEXT : FATE_LOSS_TEXT;
  }
  if (fateResultOk) fateResultOk.textContent = success ? "OK" : "Succumb";
};

const openFateResultWindow = (success) => {
  if (!fateWindow) return;
  fateState = success ? "success" : "loss";
  setFateResultContent(success);
  fateWindow.classList.remove("is-hidden", "is-closing", "is-resisting");
  fateWindow.setAttribute("aria-hidden", "false");
  positionFateWindow();
  clampRandomEventWindowAfterMediaLoad(fateWindow);
  fateWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(fateWindow, "is-opening");
  requestAnimationFrame(() => {
    if (fateResultOk) fateResultOk.focus();
  });
};

const finishFateEvent = (success) => {
  if (fateState !== "active") return;
  fateState = "resolving";
  fateProgressValue = success ? 100 : 0;
  updateFateProgress();
  if (fateDrainTimer) {
    clearInterval(fateDrainTimer);
    fateDrainTimer = null;
  }
  if (fateLightningTimer) {
    clearTimeout(fateLightningTimer);
    fateLightningTimer = null;
  }
  if (fateLightningFrame) {
    cancelAnimationFrame(fateLightningFrame);
    fateLightningFrame = null;
  }
  if (fateWindow) fateWindow.classList.remove("is-resisting");
  clearFateLightningCanvas();
  if (fateResist) fateResist.disabled = true;
  if (fateResolveTimer) clearTimeout(fateResolveTimer);
  if (fateResultOpenTimer) clearTimeout(fateResultOpenTimer);

  fateResolveTimer = setTimeout(() => {
    fateResolveTimer = null;
    if (!fateWindow) return;
    fateState = "transitioning";
    fateWindow.setAttribute("aria-hidden", "true");
    restartWindowAnimation(fateWindow, "is-closing");
    fateResultOpenTimer = setTimeout(() => {
      fateResultOpenTimer = null;
      openFateResultWindow(success);
    }, FATE_RESULT_REOPEN_DELAY_MS);
  }, FATE_RESULT_FREEZE_MS);
};

const tickFateDrain = () => {
  if (fateState !== "active") return;
  fateProgressValue = Math.max(0, fateProgressValue - FATE_DRAIN_AMOUNT);
  updateFateProgress();
  if (fateProgressValue <= 0) finishFateEvent(false);
};

const startFateDrain = () => {
  if (fateDrainTimer) clearInterval(fateDrainTimer);
  fateDrainTimer = setInterval(tickFateDrain, FATE_DRAIN_INTERVAL_MS);
};

const resistFate = () => {
  if (fateState !== "active") return;
  fateProgressValue = Math.min(100, fateProgressValue + FATE_PRESS_GAIN);
  updateFateProgress();
  pulseFateWindow();
  if (fateProgressValue >= 100) {
    finishFateEvent(true);
  }
};

const handleFateKeyMash = (event) => {
  if (fateState !== "active") return;
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  event.preventDefault();
  resistFate();
};

const showFateWindow = () => {
  if (!fateWindow) return;
  if (isFateVisible()) {
    fateWindow.style.zIndex = String(topZ++);
    clampRandomEventWindowToViewport(fateWindow);
    if (fateState === "ready" && fateStart) fateStart.focus();
    if (fateState === "active" && fateResist) fateResist.focus();
    return;
  }
  resetFateWindow();
  loadDeferredMedia(fateWindow);
  fateWindow.classList.remove("is-hidden", "is-closing");
  fateWindow.setAttribute("aria-hidden", "false");
  positionFateWindow();
  clampRandomEventWindowAfterMediaLoad(fateWindow);
  fateWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(fateWindow, "is-opening");
  requestAnimationFrame(() => {
    if (fateStart) fateStart.focus();
  });
};

const closeFateWindow = () => {
  if (!fateWindow || fateWindow.classList.contains("is-hidden")) return;
  clearFateTimers();
  fateState = "idle";
  fateWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(fateWindow, "is-closing");
};

const isBehelitVisible = () =>
  Boolean(
    behelitWindow &&
      !behelitWindow.classList.contains("is-hidden") &&
      behelitWindow.getAttribute("aria-hidden") === "false"
  );

const positionBehelitWindow = () => {
  positionRandomEventWindowInViewport(behelitWindow);
};

const showBehelitWindow = () => {
  if (!behelitWindow) return;
  if (isBehelitVisible()) {
    behelitWindow.style.zIndex = String(topZ++);
    clampRandomEventWindowToViewport(behelitWindow);
    return;
  }
  loadDeferredMedia(behelitWindow);
  behelitWindow.classList.remove("is-hidden", "is-closing");
  behelitWindow.setAttribute("aria-hidden", "false");
  positionBehelitWindow();
  clampRandomEventWindowAfterMediaLoad(behelitWindow);
  behelitWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(behelitWindow, "is-opening");
};

const closeBehelitWindow = () => {
  if (!behelitWindow || behelitWindow.classList.contains("is-hidden")) return;
  behelitWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(behelitWindow, "is-closing");
};

const isJohnPorkVisible = () =>
  Boolean(
    johnPorkWindow &&
      !johnPorkWindow.classList.contains("is-hidden") &&
      johnPorkWindow.getAttribute("aria-hidden") === "false"
  );

const updateJohnPorkStatus = () => {
  if (!johnPorkStatus) return;
  const dots = ".".repeat(johnPorkStatusFrame % 4);
  johnPorkStatus.textContent = `Incoming call${dots}`;
  johnPorkStatusFrame += 1;
};

const startJohnPorkStatus = () => {
  if (johnPorkStatusTimer) return;
  johnPorkStatusFrame = 0;
  updateJohnPorkStatus();
  johnPorkStatusTimer = setInterval(updateJohnPorkStatus, 420);
};

const stopJohnPorkStatus = () => {
  if (johnPorkStatusTimer) {
    clearInterval(johnPorkStatusTimer);
    johnPorkStatusTimer = null;
  }
  johnPorkStatusFrame = 0;
  if (johnPorkStatus) johnPorkStatus.textContent = "Incoming call";
};

const positionJohnPorkWindow = () => {
  positionRandomEventWindowInViewport(johnPorkWindow);
};

const showJohnPorkCall = () => {
  if (!johnPorkWindow) return;
  if (isJohnPorkVisible()) {
    johnPorkWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(johnPorkWindow);
  johnPorkWindow.classList.remove("is-hidden", "is-closing");
  johnPorkWindow.setAttribute("aria-hidden", "false");
  positionJohnPorkWindow();
  johnPorkWindow.style.zIndex = String(topZ++);
  startJohnPorkStatus();
  restartWindowAnimation(johnPorkWindow, "is-opening");
};

const closeJohnPorkCall = () => {
  if (!johnPorkWindow || johnPorkWindow.classList.contains("is-hidden")) return;
  johnPorkWindow.setAttribute("aria-hidden", "true");
  stopJohnPorkStatus();
  restartWindowAnimation(johnPorkWindow, "is-closing");
};

const isAdvertisementVisible = () =>
  Boolean(
    advertisementWindow &&
      !advertisementWindow.classList.contains("is-hidden") &&
      advertisementWindow.getAttribute("aria-hidden") === "false"
  );

const positionAdvertisementWindow = () => {
  positionRandomEventWindowInViewport(advertisementWindow);
};

const showAdvertisementWindow = () => {
  if (!advertisementWindow) return;
  if (isAdvertisementVisible()) {
    advertisementWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(advertisementWindow);
  advertisementWindow.classList.remove("is-hidden", "is-closing");
  advertisementWindow.setAttribute("aria-hidden", "false");
  positionAdvertisementWindow();
  advertisementWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(advertisementWindow, "is-opening");
};

const closeAdvertisementWindow = () => {
  if (!advertisementWindow || advertisementWindow.classList.contains("is-hidden")) return;
  advertisementWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(advertisementWindow, "is-closing");
};

const isBidenBlastVisible = () =>
  Boolean(
    bidenBlastWindow &&
      !bidenBlastWindow.classList.contains("is-hidden") &&
      bidenBlastWindow.getAttribute("aria-hidden") === "false"
  );

const positionBidenBlastWindow = () => {
  positionRandomEventWindowInViewport(bidenBlastWindow);
};

const removeBidenExplodePieces = () => {
  document.querySelectorAll(".biden-explode-piece").forEach((piece) => {
    piece.remove();
  });
};

const animateBidenBlastExplode = (mode, onComplete) => {
  if (!bidenBlastWindow) {
    if (onComplete) onComplete();
    return;
  }

  removeBidenExplodePieces();
  const rect = bidenBlastWindow.getBoundingClientRect();
  const columns = 3;
  const rows = 3;
  const pieceWidth = rect.width / columns;
  const pieceHeight = rect.height / rows;
  const pieces = [];

  bidenBlastWindow.classList.add("is-exploding");

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const piece = document.createElement("div");
      piece.className = "biden-explode-piece";
      piece.style.left = `${rect.left + column * pieceWidth}px`;
      piece.style.top = `${rect.top + row * pieceHeight}px`;
      piece.style.width = `${Math.ceil(pieceWidth)}px`;
      piece.style.height = `${Math.ceil(pieceHeight)}px`;
      piece.style.backgroundImage = `linear-gradient(#fff, #fff)`;
      piece.style.backgroundSize = `${rect.width}px ${rect.height}px`;
      piece.style.backgroundPosition = `${-column * pieceWidth}px ${-row * pieceHeight}px`;

      const clone = bidenBlastWindow.cloneNode(true);
      clone.classList.remove(
        "is-opening",
        "is-closing",
        "is-hidden",
        "is-exploding"
      );
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach((element) => {
        element.removeAttribute("id");
      });
      clone.setAttribute("aria-hidden", "true");
      clone.style.left = `${-column * pieceWidth}px`;
      clone.style.top = `${-row * pieceHeight}px`;
      clone.style.width = `${rect.width}px`;
      clone.style.translate = "0 0";
      clone.style.position = "absolute";
      clone.style.pointerEvents = "none";
      clone.style.zIndex = "0";
      piece.appendChild(clone);

      document.body.appendChild(piece);
      pieces.push({ piece, row, column });
    }
  }

  const centerRow = (rows - 1) / 2;
  const centerColumn = (columns - 1) / 2;
  let remaining = pieces.length;

  pieces.forEach(({ piece, row, column }) => {
    const deltaX = (column - centerColumn) * pieceWidth * 1.15;
    const deltaY = (row - centerRow) * pieceHeight * 1.15;
    const outward = `translate(${deltaX}px, ${deltaY}px) scale(0.08)`;
    const inward = "translate(0, 0) scale(1)";
    const fromTransform = mode === "show" ? outward : inward;
    const toTransform = mode === "show" ? inward : outward;
    const fromOpacity = mode === "show" ? 0 : 1;
    const toOpacity = mode === "show" ? 1 : 0;

    const animation = piece.animate(
      [
        { opacity: fromOpacity, transform: fromTransform },
        { opacity: toOpacity, transform: toTransform },
      ],
      {
        duration: 420,
        easing: mode === "show" ? "cubic-bezier(.2,.8,.2,1)" : "cubic-bezier(.6,0,.8,.2)",
        fill: "forwards",
      }
    );

    animation.addEventListener("finish", () => {
      remaining -= 1;
      if (remaining > 0) return;
      removeBidenExplodePieces();
      bidenBlastWindow.classList.remove("is-exploding");
      if (onComplete) onComplete();
    });
  });
};

const showBidenBlastWindow = () => {
  if (!bidenBlastWindow) return;
  if (isBidenBlastVisible()) {
    bidenBlastWindow.style.zIndex = String(topZ++);
    return;
  }
  loadDeferredMedia(bidenBlastWindow);
  bidenBlastWindow.classList.remove("is-hidden", "is-closing", "is-exploding");
  bidenBlastWindow.setAttribute("aria-hidden", "false");
  positionBidenBlastWindow();
  bidenBlastWindow.style.zIndex = String(topZ++);
  animateBidenBlastExplode("show");
};

const closeBidenBlastWindow = () => {
  if (!bidenBlastWindow || bidenBlastWindow.classList.contains("is-hidden")) return;
  bidenBlastWindow.setAttribute("aria-hidden", "true");
  bidenBlastWindow.classList.add("is-closing");
  animateBidenBlastExplode("hide", () => {
    bidenBlastWindow.classList.remove("is-closing");
    bidenBlastWindow.classList.add("is-hidden");
    bidenBlastWindow.querySelectorAll("img[data-src]").forEach((image) => {
      image.removeAttribute("src");
    });
  });
};

const isInfinityArmoryVisible = () =>
  Boolean(
    infinityArmoryWindow &&
      !infinityArmoryWindow.classList.contains("is-hidden") &&
      infinityArmoryWindow.getAttribute("aria-hidden") === "false"
  );

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

const getInfinityArmoryGemFromButton = (button) => {
  if (!button) return null;
  const shape = button.dataset.armoryGem;
  const color = button.dataset.armoryColor || "ruby";
  if (!INFINITY_ARMORY_SHAPES.includes(shape)) return null;
  const image = button.querySelector("img");
  return {
    id: button.dataset.armoryGemId || `${shape}-${color}`,
    shape,
    color,
    label:
      button.dataset.armoryLabel ||
      button.getAttribute("aria-label") ||
      `${color} ${shape}`,
    src: image?.getAttribute("src") || image?.dataset.src || "",
  };
};

const moveInfinityArmoryCursorGem = (event) => {
  if (!infinityArmoryCursorGem || !event) return;
  infinityArmoryCursorGem.style.left = `${event.clientX}px`;
  infinityArmoryCursorGem.style.top = `${event.clientY}px`;
};

const clearInfinityArmorySelectedGem = ({ update = true, status = "" } = {}) => {
  infinityArmorySelectedGem = null;
  if (infinityArmoryCursorGem) {
    infinityArmoryCursorGem.remove();
    infinityArmoryCursorGem = null;
  }
  if (update) updateInfinityArmory();
  if (status && infinityArmoryStatus) infinityArmoryStatus.textContent = status;
};

const createInfinityArmoryCursorGem = (gem, event) => {
  if (!gem) return;
  if (infinityArmoryCursorGem) infinityArmoryCursorGem.remove();
  const cursorGem = document.createElement("span");
  cursorGem.className = "infinity-armory-cursor-gem";
  cursorGem.dataset.armoryColor = gem.color;
  const image = document.createElement("img");
  image.src = gem.src;
  image.alt = "";
  cursorGem.appendChild(image);
  document.body.appendChild(cursorGem);
  infinityArmoryCursorGem = cursorGem;
  moveInfinityArmoryCursorGem(event);
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
  if (infinityArmorySelectedGem?.id === gem.id) {
    clearInfinityArmorySelectedGem({ status: "Gem returned to inventory." });
    return;
  }
  infinityArmorySelectedGem = gem;
  createInfinityArmoryCursorGem(gem, event);
  updateInfinityArmory();
  if (infinityArmoryStatus) {
    infinityArmoryStatus.textContent = `${gem.label} selected.`;
  }
};

const updateInfinityArmory = () => {
  const nextPrice = INFINITY_ARMORY_UPGRADE_PRICES[infinityArmoryState.level - 1] || 0;
  const isMaxLevel = infinityArmoryState.level >= INFINITY_ARMORY_MAX_LEVEL;
  const canUpgrade = !isMaxLevel && infinityArmoryState.gold >= nextPrice;

  if (infinityArmoryLevel) {
    infinityArmoryLevel.textContent = `Infinity Blade Lvl ${infinityArmoryState.level}`;
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
    slot.disabled = filled;
    slot.setAttribute("aria-pressed", String(filled));
    slot.setAttribute("aria-label", `${label} gem slot ${filled ? "filled" : "empty"}`);
    if (socketedGem) {
      slot.dataset.armoryColor = socketedGem.color;
      if (image && socketedGem.src) image.setAttribute("src", socketedGem.src);
    } else {
      delete slot.dataset.armoryColor;
    }
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
  if (!infinityArmoryWindow || infinityArmoryWindow.classList.contains("is-hidden")) return;
  infinityArmoryWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(infinityArmoryWindow, "is-closing");
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
    if (infinityArmoryStatus) {
      infinityArmoryStatus.textContent = `${INFINITY_ARMORY_GEM_LABELS[shape]} slot is already filled.`;
    }
    return;
  }
  if (infinityArmorySelectedGem.shape !== shape) {
    if (infinityArmoryStatus) {
      infinityArmoryStatus.textContent = `${infinityArmorySelectedGem.label} does not fit.`;
    }
    return;
  }
  infinityArmoryState.gems[shape] = { ...infinityArmorySelectedGem };
  infinityArmoryState.usedGemIds[infinityArmorySelectedGem.id] = true;
  clearInfinityArmorySelectedGem({ update: false });
  updateInfinityArmory();
  scheduleInfinityArmoryCompletionCheck();
};

const positionInfinityArmoryWindow = () => {
  positionRandomEventWindowInViewport(infinityArmoryWindow);
};

const showInfinityArmoryWindow = () => {
  if (!infinityArmoryWindow) return;
  if (isInfinityArmoryVisible()) {
    infinityArmoryWindow.style.zIndex = String(topZ++);
    return;
  }
  resetInfinityArmory();
  loadDeferredMedia(infinityArmoryWindow);
  infinityArmoryWindow.classList.remove("is-hidden", "is-closing");
  infinityArmoryWindow.setAttribute("aria-hidden", "false");
  positionInfinityArmoryWindow();
  infinityArmoryWindow.style.zIndex = String(topZ++);
  clampRandomEventWindowAfterMediaLoad(infinityArmoryWindow);
  restartWindowAnimation(infinityArmoryWindow, "is-opening");
};

const isVirusWindowVisible = (win) =>
  Boolean(win && !win.classList.contains("is-hidden"));

const virusEventWindows = () => [virusWindow, virusRescueWindow].filter(Boolean);

const isVirusVisible = () => virusEventWindows().some(isVirusWindowVisible);

const setVirusEventWindowPosition = (win, left, top) => {
  setRandomEventWindowPosition(win, left, top);
};

const positionVirusEventWindow = (win) => {
  positionRandomEventWindowInViewport(win);
};

const clampVirusEventWindowToViewport = (win) => {
  clampRandomEventWindowToViewport(win);
};

const clampVirusEventWindowAfterMediaLoad = (win) => {
  clampRandomEventWindowAfterMediaLoad(win);
};

const clampVisibleVirusEventWindows = () => {
  virusEventWindows().forEach((win) => clampVirusEventWindowToViewport(win));
};

const chooseVirusRescueAnchor = () => {
  if (!virusWindow) return { left: 12, top: 12 };
  const initialRect = virusWindow.getBoundingClientRect();
  const padding = RANDOM_EVENT_VIEWPORT_PADDING;
  const width = Math.max(initialRect.width, 260);
  const height = Math.max(initialRect.height, 140);
  const maxLeft = Math.max(
    padding,
    window.innerWidth - width - padding
  );
  const maxTop = Math.max(
    padding,
    window.innerHeight - height - RANDOM_EVENT_TASKBAR_CLEARANCE
  );
  const gap = RANDOM_EVENT_OBSTACLE_GAP + 28;
  const bounds = { width, height, padding, maxLeft, maxTop };
  const initialObstacle = {
    left: initialRect.left,
    top: initialRect.top,
    right: initialRect.right,
    bottom: initialRect.bottom,
  };
  const obstacles = [
    initialObstacle,
    ...randomEventPlacementObstacles(virusRescueWindow),
  ];
  const preferredPositions = [
    { left: initialRect.right + gap, top: initialRect.top },
    { left: initialRect.left - width - gap, top: initialRect.top },
    { left: initialRect.left, top: initialRect.bottom + gap },
    { left: initialRect.left, top: initialRect.top - height - gap },
    { left: padding, top: padding },
    { left: maxLeft, top: padding },
    { left: padding, top: maxTop },
    { left: maxLeft, top: maxTop },
  ];
  let bestPosition = null;
  let bestScore = Infinity;

  const considerPosition = (position) => {
    const clamped = clampRandomEventPosition(bounds, position);
    const rect = randomEventCandidateRect(bounds, clamped.left, clamped.top);
    const score = scoreRandomEventPlacement(rect, obstacles);
    if (score < bestScore) {
      bestScore = score;
      bestPosition = clamped;
    }
    return score === 0;
  };

  for (const position of preferredPositions) {
    if (considerPosition(position)) break;
  }

  if (bestScore > 0) {
    for (let attempt = 0; attempt < RANDOM_EVENT_PLACEMENT_ATTEMPTS; attempt += 1) {
      if (considerPosition(sampleRandomEventPosition(bounds))) break;
    }
  }

  const anchor = bestPosition || clampRandomEventPosition(bounds, {
    left: initialRect.right + gap,
    top: initialRect.top,
  });

  return {
    left: Math.round(anchor.left),
    top: Math.round(anchor.top),
    width,
    height,
  };
};

const removeWindowExplodePieces = () => {
  document.querySelectorAll(".window-explode-piece").forEach((piece) => {
    piece.remove();
  });
};

const VIRUS_RESCUE_READY_TEXT = "Fear not, I am here to protect you!";
const VIRUS_RESCUE_ATTACK_TEXT =
  "McAfee Antivirus uses lightning bolt. It is super effective!";
const VIRUS_STRIKE_DURATION_MS = 1000;

const setVirusRescueMessage = (message) => {
  if (virusRescueText) virusRescueText.textContent = message;
};

const setVirusRescueButtonDisabled = (disabled) => {
  if (virusRescueThanks) virusRescueThanks.disabled = disabled;
};

const setVirusInstallButtonsDisabled = (disabled) => {
  if (virusYes) virusYes.disabled = disabled;
  if (virusNo) virusNo.disabled = disabled;
};

const removeVirusStrikeCanvas = () => {
  if (virusStrikeCanvas) {
    virusStrikeCanvas.remove();
    virusStrikeCanvas = null;
  }
};

const clearVirusStrikeEffect = () => {
  if (virusStrikeTimer) {
    clearTimeout(virusStrikeTimer);
    virusStrikeTimer = null;
  }
  if (virusStrikeFrame) {
    cancelAnimationFrame(virusStrikeFrame);
    virusStrikeFrame = null;
  }
  removeVirusStrikeCanvas();
  clearVirusBorderLightningCanvas();
  if (virusWindow) virusWindow.classList.remove("is-virus-struck");
  setVirusInstallButtonsDisabled(false);
};

const createVirusStrikeCanvas = () => {
  removeVirusStrikeCanvas();
  virusStrikeCanvas = document.createElement("canvas");
  virusStrikeCanvas.className = "virus-lightning-canvas";
  virusStrikeCanvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(virusStrikeCanvas);
  return virusStrikeCanvas;
};

const resizeVirusStrikeCanvas = () => {
  if (!virusStrikeCanvas) return null;
  const ctx = virusStrikeCanvas.getContext("2d");
  if (!ctx) return null;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(height * dpr);

  if (
    virusStrikeCanvas.width !== nextWidth ||
    virusStrikeCanvas.height !== nextHeight
  ) {
    virusStrikeCanvas.width = nextWidth;
    virusStrikeCanvas.height = nextHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
};

const resizeVirusBorderLightningCanvas = () => {
  if (!virusBorderLightningCanvas) return null;
  const ctx = virusBorderLightningCanvas.getContext("2d");
  if (!ctx) return null;
  const field = virusBorderLightningCanvas.parentElement;
  const rect = field
    ? field.getBoundingClientRect()
    : virusBorderLightningCanvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const nextWidth = Math.round(width * dpr);
  const nextHeight = Math.round(height * dpr);

  if (
    virusBorderLightningCanvas.width !== nextWidth ||
    virusBorderLightningCanvas.height !== nextHeight
  ) {
    virusBorderLightningCanvas.width = nextWidth;
    virusBorderLightningCanvas.height = nextHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
};

const clearVirusBorderLightningCanvas = () => {
  const setup = resizeVirusBorderLightningCanvas();
  if (!setup) return;
  setup.ctx.clearRect(0, 0, setup.width, setup.height);
};

const getVirusStrikeOrigin = (targetRect) => {
  if (isVirusWindowVisible(virusRescueWindow)) {
    const rescueRect = virusRescueWindow.getBoundingClientRect();
    if (rescueRect.width > 0 && rescueRect.height > 0) {
      return {
        x: rescueRect.left + rescueRect.width / 2,
        y: rescueRect.top + rescueRect.height / 2,
      };
    }
  }
  const anchor = virusRescueAnchor || {
    left: targetRect.left,
    top: targetRect.top,
  };
  return {
    x: anchor.left + (anchor.width || targetRect.width) / 2,
    y: anchor.top + (anchor.height || targetRect.height) / 2,
  };
};

const virusStrikeTargetPoint = (rect, origin) => {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const deltaX = centerX - origin.x;
  const deltaY = centerY - origin.y;
  const halfWidth = Math.max(1, rect.width / 2);
  const halfHeight = Math.max(1, rect.height / 2);
  const scale = 1 / Math.max(
    Math.abs(deltaX) / halfWidth,
    Math.abs(deltaY) / halfHeight,
    0.001
  );
  const borderX = centerX - deltaX * scale;
  const borderY = centerY - deltaY * scale;
  const hitsVerticalEdge =
    Math.abs(borderX - rect.left) < 1 || Math.abs(borderX - rect.right) < 1;

  return {
    x: hitsVerticalEdge
      ? borderX
      : borderX + (Math.random() - 0.5) * rect.width * 0.16,
    y: hitsVerticalEdge
      ? borderY + (Math.random() - 0.5) * rect.height * 0.16
      : borderY,
  };
};

const drawVirusBolt = (ctx, path, startX, startY, level, alpha) => {
  const opacity = alpha * Math.max(0.28, 1 - level * 0.24);
  const glowWidth = level === 0 ? 7 : 3.5;
  const coreWidth = level === 0 ? 1.35 : 0.7;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `rgba(32, 156, 255, ${opacity})`;
  ctx.lineWidth = glowWidth;
  ctx.shadowBlur = level === 0 ? 18 : 9;
  ctx.shadowColor = "rgba(65, 180, 255, 0.95)";
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();

  ctx.strokeStyle = `rgba(126, 219, 255, ${opacity})`;
  ctx.lineWidth = Math.max(1.5, glowWidth * 0.38);
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();

  ctx.strokeStyle = `rgba(245, 252, 255, ${Math.min(1, opacity + 0.22)})`;
  ctx.lineWidth = coreWidth;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  path.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.stroke();
  ctx.restore();
};

const drawVirusWindowLightningBorderFrame = (alpha) => {
  const setup = resizeVirusBorderLightningCanvas();
  if (!setup) return;
  const { ctx, width, height } = setup;
  const inset = 18;
  const left = inset;
  const top = inset;
  const right = Math.max(left + 1, width - inset);
  const bottom = Math.max(top + 1, height - inset);
  const displacement = Math.max(6, Math.min(13, Math.min(width, height) / 14));
  const edges = [
    [left, top, right, top],
    [right, top, right, bottom],
    [right, bottom, left, bottom],
    [left, bottom, left, top],
  ];
  const bolts = [];

  ctx.clearRect(0, 0, width, height);
  edges.forEach(([x1, y1, x2, y2]) => {
    const startX = x1 + (Math.random() - 0.5) * 4;
    const startY = y1 + (Math.random() - 0.5) * 4;
    const endX = x2 + (Math.random() - 0.5) * 4;
    const endY = y2 + (Math.random() - 0.5) * 4;
    const path = generateFateBoltPath(
      startX,
      startY,
      endX,
      endY,
      displacement,
      0,
      bolts
    );

    bolts.push({ path, start: [startX, startY], level: 0 });
  });

  bolts.forEach((bolt) => {
    drawVirusBolt(ctx, bolt.path, bolt.start[0], bolt.start[1], bolt.level, alpha);
  });
};

const drawVirusStrikeFrame = (origin, rect, alpha) => {
  const setup = resizeVirusStrikeCanvas();
  if (!setup) return;
  const { ctx, width, height } = setup;
  const sourceRadius = 5 + Math.random() * 5;

  ctx.clearRect(0, 0, width, height);
  drawVirusWindowLightningBorderFrame(alpha * 0.95);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(225, 248, 255, 0.95)";
  ctx.shadowBlur = 22;
  ctx.shadowColor = "rgba(49, 169, 255, 1)";
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, sourceRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const target = virusStrikeTargetPoint(rect, origin);
  const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
  const displacement = Math.max(9, Math.min(22, distance / 5.5));
  const bolts = [];
  const path = generateFateBoltPath(
    origin.x,
    origin.y,
    target.x,
    target.y,
    displacement,
    0,
    bolts
  );
  bolts.push({ path, start: [origin.x, origin.y], level: 0 });
  bolts.forEach((bolt) => {
    drawVirusBolt(ctx, bolt.path, bolt.start[0], bolt.start[1], bolt.level, alpha);
  });
};

const startVirusStrikeEffect = (onComplete) => {
  if (!virusWindow) {
    if (onComplete) onComplete();
    return;
  }

  clearVirusStrikeEffect();
  createVirusStrikeCanvas();
  setVirusInstallButtonsDisabled(true);
  virusWindow.classList.add("is-virus-struck");

  const startedAt = performance.now();

  const render = (now) => {
    if (!virusWindow || virusWindow.classList.contains("is-hidden")) {
      clearVirusStrikeEffect();
      return;
    }

    const progress = Math.min(1, (now - startedAt) / VIRUS_STRIKE_DURATION_MS);
    const rect = virusWindow.getBoundingClientRect();
    const origin = getVirusStrikeOrigin(rect);
    const flicker = Math.random() > 0.18 ? 1 : 0.32;
    const alpha = Math.max(0, flicker * (1 - progress * 0.12));
    drawVirusStrikeFrame(origin, rect, alpha);

    if (progress < 1) {
      virusStrikeFrame = requestAnimationFrame(render);
      return;
    }

    virusStrikeFrame = null;
  };

  virusStrikeFrame = requestAnimationFrame(render);
  virusStrikeTimer = setTimeout(() => {
    clearVirusStrikeEffect();
    if (onComplete) onComplete();
  }, VIRUS_STRIKE_DURATION_MS);
};

const triggerVirusFlashbang = () => {
  const flash = document.createElement("div");
  flash.className = "virus-flashbang";
  document.body.appendChild(flash);
  const animation = flash.animate(
    [
      { opacity: 0 },
      { opacity: 1, offset: 0.08 },
      { opacity: 1, offset: 0.28 },
      { opacity: 0 },
    ],
    {
      duration: 900,
      easing: "ease-out",
      fill: "forwards",
    }
  );
  animation.addEventListener("finish", () => flash.remove(), { once: true });
};

const animateWindowExplode = (win, onComplete) => {
  if (!win) {
    if (onComplete) onComplete();
    return;
  }

  removeWindowExplodePieces();
  const rect = win.getBoundingClientRect();
  const columns = 4;
  const rows = 4;
  const pieceWidth = rect.width / columns;
  const pieceHeight = rect.height / rows;
  const pieces = [];

  win.classList.add("is-exploding");

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const piece = document.createElement("div");
      piece.className = "window-explode-piece";
      piece.style.left = `${rect.left + column * pieceWidth}px`;
      piece.style.top = `${rect.top + row * pieceHeight}px`;
      piece.style.width = `${Math.ceil(pieceWidth)}px`;
      piece.style.height = `${Math.ceil(pieceHeight)}px`;

      const clone = win.cloneNode(true);
      clone.classList.remove("is-opening", "is-closing", "is-hidden", "is-exploding");
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach((element) => {
        element.removeAttribute("id");
      });
      clone.setAttribute("aria-hidden", "true");
      clone.style.left = `${-column * pieceWidth}px`;
      clone.style.top = `${-row * pieceHeight}px`;
      clone.style.width = `${rect.width}px`;
      clone.style.translate = "0 0";
      clone.style.position = "absolute";
      clone.style.pointerEvents = "none";
      clone.style.zIndex = "0";
      piece.appendChild(clone);

      document.body.appendChild(piece);
      pieces.push({ piece, row, column });
    }
  }

  const centerRow = (rows - 1) / 2;
  const centerColumn = (columns - 1) / 2;
  let remaining = pieces.length;

  pieces.forEach(({ piece, row, column }) => {
    const deltaX = (column - centerColumn) * pieceWidth * 2.25;
    const deltaY = (row - centerRow) * pieceHeight * 2.25;
    const animation = piece.animate(
      [
        { opacity: 1, transform: "translate(0, 0) scale(1)" },
        {
          opacity: 0,
          transform: `translate(${deltaX}px, ${deltaY}px) scale(0.08)`,
        },
      ],
      {
        duration: 560,
        easing: "cubic-bezier(.6,0,.8,.2)",
        fill: "forwards",
      }
    );

    animation.addEventListener("finish", () => {
      remaining -= 1;
      if (remaining > 0) return;
      removeWindowExplodePieces();
      win.classList.remove("is-exploding");
      if (onComplete) onComplete();
    });
  });
};

const showVirusEventWindow = (win, anchor = null, { animate = true } = {}) => {
  if (!win) return;
  if (!win.classList.contains("is-hidden")) {
    win.style.zIndex = String(topZ++);
    clampVirusEventWindowToViewport(win);
    return;
  }
  win.classList.remove(
    "is-hidden",
    "is-opening",
    "is-closing",
    "is-exploding",
    "is-virus-struck"
  );
  win.setAttribute("aria-hidden", "false");
  if (anchor) {
    setVirusEventWindowPosition(win, anchor.left, anchor.top);
  } else {
    positionVirusEventWindow(win);
  }
  clampVirusEventWindowToViewport(win);
  clampVirusEventWindowAfterMediaLoad(win);
  loadDeferredMedia(win);
  win.style.zIndex = String(topZ++);
  if (animate) restartWindowAnimation(win, "is-opening");
};

const closeVirusEventWindow = (win) => {
  if (!win || win.classList.contains("is-hidden")) return;
  if (win === virusWindow) clearVirusStrikeEffect();
  win.setAttribute("aria-hidden", "true");
  restartWindowAnimation(win, "is-closing");
};

const showVirusWindow = () => {
  clearVirusStrikeEffect();
  virusExploding = false;
  virusRescueAnchor = null;
  showVirusEventWindow(virusWindow);
};

const showVirusRescueWindow = (state = "ready") => {
  const isAttack = state === "attack";
  setVirusRescueMessage(isAttack ? VIRUS_RESCUE_ATTACK_TEXT : VIRUS_RESCUE_READY_TEXT);
  setVirusRescueButtonDisabled(isAttack);
  showVirusEventWindow(virusRescueWindow, virusRescueAnchor, {
    animate: !isAttack,
  });
};

const acceptVirusInstall = () => {
  if (!virusWindow || virusExploding || virusWindow.classList.contains("is-hidden")) return;
  virusExploding = true;
  virusRescueAnchor = chooseVirusRescueAnchor();
  showVirusRescueWindow("attack");
  startVirusStrikeEffect(() => {
    virusWindow.setAttribute("aria-hidden", "true");
    triggerVirusFlashbang();
    animateWindowExplode(virusWindow, () => {
      virusExploding = false;
      virusWindow.classList.add("is-hidden");
      virusWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
      showVirusRescueWindow("ready");
    });
  });
};

const registerRandomEvent = (definition) => {
  randomEventDefinitions.push(definition);
  return definition;
};

const randomEventKind = (definition) =>
  definition.kind || RANDOM_EVENT_KIND_NON_INTERACTIVE;

const randomEventDefinitionIsVisible = (definition) =>
  Boolean(definition.isVisible && definition.isVisible());

const randomEventVisibleCountForKind = (kind) => {
  const registeredCount = randomEventDefinitions.reduce(
    (count, definition) =>
      randomEventKind(definition) === kind && randomEventDefinitionIsVisible(definition)
        ? count + 1
        : count,
    0
  );
  const standaloneCount =
    kind === RANDOM_EVENT_KIND_NON_INTERACTIVE && isFelizJuevesVisible() ? 1 : 0;
  return registeredCount + standaloneCount;
};

const randomEventPendingCountForKind = (kind) =>
  Array.from(randomEventPendingDefinitions).filter(
    (definition) => randomEventKind(definition) === kind
  ).length;

const randomEventCountForKind = (kind) =>
  randomEventVisibleCountForKind(kind) + randomEventPendingCountForKind(kind);

const randomEventKindCanSchedule = (kind, { consumeRelease = false } = {}) => {
  const limit = RANDOM_EVENT_KIND_LIMITS[kind];
  if (!limit) return true;

  const count = randomEventCountForKind(kind);
  if (count < limit) {
    randomEventKindMaxSince[kind] = 0;
    return true;
  }

  const now = Date.now();
  if (!randomEventKindMaxSince[kind]) {
    randomEventKindMaxSince[kind] = now;
    return false;
  }

  if (now - randomEventKindMaxSince[kind] < RANDOM_EVENT_MAX_LOCK_RELEASE_MS) {
    return false;
  }

  if (consumeRelease) randomEventKindMaxSince[kind] = now;
  return true;
};

const randomEventDefinitionCanSchedule = (
  definition,
  { consumeRelease = false, debug = false } = {}
) => {
  if (debug) return true;
  return randomEventKindCanSchedule(randomEventKind(definition), {
    consumeRelease,
  });
};

const randomEventDebugEnabled = (definition) =>
  RANDOM_EVENT_GLOBAL_DEBUG || Boolean(definition.debug);

const RANDOM_EVENT_PROBABILITY_GATED_DEBUG_TRIGGERS = new Set([
  "failedAction",
  "windowDrag",
]);

const randomEventTriggerProbability = (triggerName) => {
  const value =
    triggerName in STANDARD_RANDOM_EVENT_PROBABILITIES
      ? STANDARD_RANDOM_EVENT_PROBABILITIES[triggerName]
      : STANDARD_RANDOM_EVENT_PROBABILITY;
  const probability = Number(value);
  if (Number.isNaN(probability)) return 0;
  return Math.min(1, Math.max(0, probability));
};

const recentInteractiveRandomEventRuns = (definition, now = Date.now()) => {
  const eventId = definition.id;
  if (!eventId || randomEventKind(definition) !== RANDOM_EVENT_KIND_INTERACTIVE) {
    return [];
  }
  const cutoff = now - RANDOM_EVENT_REPEAT_DAMPEN_MS;
  const recentRuns = (randomEventRecentInteractiveRuns.get(eventId) || []).filter(
    (timestamp) => timestamp >= cutoff
  );
  if (recentRuns.length) {
    randomEventRecentInteractiveRuns.set(eventId, recentRuns);
  } else {
    randomEventRecentInteractiveRuns.delete(eventId);
  }
  return recentRuns;
};

const interactiveRandomEventRepeatProbability = (definition) => {
  const recentCount = recentInteractiveRandomEventRuns(definition).length;
  return Math.pow(RANDOM_EVENT_REPEAT_DAMPEN_FACTOR, recentCount);
};

const interactiveRandomEventRepeatAllowed = (definition, { debug = false } = {}) => {
  if (debug || randomEventKind(definition) !== RANDOM_EVENT_KIND_INTERACTIVE) {
    return true;
  }
  return Math.random() < interactiveRandomEventRepeatProbability(definition);
};

const recordInteractiveRandomEventRun = (definition, { debug = false } = {}) => {
  const eventId = definition.id;
  if (
    debug ||
    !eventId ||
    randomEventKind(definition) !== RANDOM_EVENT_KIND_INTERACTIVE
  ) {
    return;
  }
  const now = Date.now();
  const recentRuns = recentInteractiveRandomEventRuns(definition, now);
  recentRuns.push(now);
  randomEventRecentInteractiveRuns.set(eventId, recentRuns);
};

const randomEventDelayMs = () => {
  const rawDelay =
    RANDOM_EVENT_DELAY_MIN_MS +
    Math.random() * (RANDOM_EVENT_DELAY_MAX_MS - RANDOM_EVENT_DELAY_MIN_MS);
  return Math.round(rawDelay / RANDOM_EVENT_DELAY_STEP_MS) * RANDOM_EVENT_DELAY_STEP_MS;
};

const scheduleRandomEventRun = (definition, context) => {
  if (randomEventPendingDefinitions.has(definition)) return false;
  if (
    !randomEventDefinitionCanSchedule(definition, {
      consumeRelease: true,
      debug: Boolean(context.debug),
    })
  ) {
    return false;
  }
  randomEventPendingDefinitions.add(definition);
  window.setTimeout(() => {
    randomEventPendingDefinitions.delete(definition);
    const { triggerName, detail, debug } = context;
    if (
      definition.canTrigger &&
      !definition.canTrigger({ triggerName, detail, debug })
    ) {
      return;
    }
    recordInteractiveRandomEventRun(definition, { debug });
    definition.run(context);
  }, randomEventDelayMs());
  return true;
};

const triggerRandomEvents = (triggerName, detail = {}) => {
  const eligibleEvents = [];
  let debugRan = false;

  randomEventDefinitions.forEach((definition) => {
    if (randomEventPendingDefinitions.has(definition)) return;
    const debug = randomEventDebugEnabled(definition);
    const forceDebugRun =
      debug && !RANDOM_EVENT_PROBABILITY_GATED_DEBUG_TRIGGERS.has(triggerName);
    if (
      definition.canTrigger &&
      !definition.canTrigger({ triggerName, detail, debug })
    ) {
      return;
    }
    if (!randomEventDefinitionCanSchedule(definition, { debug })) return;
    if (forceDebugRun) {
      if (scheduleRandomEventRun(definition, { triggerName, detail, debug })) {
        debugRan = true;
      }
      return;
    }
    eligibleEvents.push({ definition, debug });
  });

  if (debugRan) return true;

  if (
    !eligibleEvents.length ||
    Math.random() >= randomEventTriggerProbability(triggerName)
  ) {
    if (triggerName === "calendarOpen" || triggerName === "gameWin") {
      return maybeShowFelizJueves();
    }
    return false;
  }

  const selected = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
  if (
    !selected ||
    !interactiveRandomEventRepeatAllowed(selected.definition, {
      debug: selected.debug,
    })
  ) {
    return false;
  }

  if (
    scheduleRandomEventRun(selected.definition, {
      triggerName,
      detail,
      debug: selected.debug,
    })
  ) {
    return true;
  }

  return false;
};

const scheduleRandomEventIdleTrigger = () => {
  if (randomEventIdleTimer) clearTimeout(randomEventIdleTimer);
  randomEventIdleTimer = setTimeout(() => {
    randomEventIdleTimer = null;
    if (!document.hidden) {
      triggerRandomEvents("idleInterval", {
        idleMs: RANDOM_EVENT_IDLE_DELAY_MS,
      });
    }
    scheduleRandomEventIdleTrigger();
  }, RANDOM_EVENT_IDLE_DELAY_MS);
};

const markRandomEventUserActivity = () => {
  scheduleRandomEventIdleTrigger();
};

const clearAppDwellTimer = () => {
  if (activeAppDwellTimer) {
    clearTimeout(activeAppDwellTimer);
    activeAppDwellTimer = null;
  }
};

const clearActiveAppDwell = () => {
  clearAppDwellTimer();
  activeAppDwellWindow = null;
  activeAppDwellStartedAt = 0;
};

const scheduleActiveAppDwellTimer = () => {
  clearAppDwellTimer();
  if (
    !activeAppDwellWindow ||
    !isWindowVisible(activeAppDwellWindow) ||
    document.hidden
  ) {
    return;
  }

  activeAppDwellTimer = setTimeout(() => {
    if (
      !activeAppDwellWindow ||
      !isWindowVisible(activeAppDwellWindow) ||
      document.hidden
    ) {
      clearActiveAppDwell();
      return;
    }

    triggerRandomEvents("appDwell", {
      appId: activeAppDwellWindow.getAttribute("data-app-window") || "",
      elapsedMs: Date.now() - activeAppDwellStartedAt,
    });
    scheduleActiveAppDwellTimer();
  }, RANDOM_EVENT_APP_DWELL_MS);
};

const trackActiveAppDwell = (win) => {
  if (!win || !win.matches("[data-app-window]") || !isWindowVisible(win)) {
    clearActiveAppDwell();
    return;
  }

  if (activeAppDwellWindow !== win) {
    activeAppDwellWindow = win;
    activeAppDwellStartedAt = Date.now();
  }

  scheduleActiveAppDwellTimer();
};

const isDisabledActionTarget = (element) =>
  Boolean(
    element &&
      (element.matches(":disabled") ||
        element.getAttribute("aria-disabled") === "true" ||
        element.closest("[aria-disabled='true']"))
  );

const isInertTitleBarButton = (button) =>
  Boolean(
    button &&
      button.matches(".title-bar-controls button") &&
      button.getAttribute("aria-label") === "Help" &&
      !button.id &&
      !button.hasAttribute("data-close") &&
      !button.matches(":disabled")
  );

const handleFailedActionTrigger = (event) => {
  if (!event.isTrusted) return;
  const target =
    event.target instanceof Element ? event.target : event.target?.parentElement;
  if (!target) return;
  const actionTarget = target.closest(
    "button, [role='button'], input, select, textarea"
  );
  if (!actionTarget || !document.documentElement.contains(actionTarget)) return;

  const disabled = isDisabledActionTarget(actionTarget);
  const inertTitleBar = actionTarget.matches("button") && isInertTitleBarButton(actionTarget);
  if (!disabled && !inertTitleBar) return;

  triggerRandomEvents("failedAction", {
    reason: disabled ? "disabled" : "inert-title-bar-button",
    label:
      actionTarget.getAttribute("aria-label") ||
      actionTarget.textContent.trim() ||
      actionTarget.id ||
      "",
  });
};

const STANDARD_RANDOM_EVENT_PROBABILITY = 0.0075;
const STANDARD_RANDOM_EVENT_PROBABILITIES = Object.freeze({
  windowOpen: 0.1,
  windowClose: 0.1,
  gameWin: 0.6,
  gameLoss: 0.2,
  startButton: 0.25,
  newTabLink: 0.25,
  fileDownload: 0.5,
  pageReload: 0.4,
  calendarOpen: 0.3,
  generalClicks: 0.5,
  minesweeperClicks: 0.5,
  solitaireClicks: 0.5,
  failedAction: 0.05,
  appDwell: 0.5,
  windowDrag: 0.18,
  idleInterval: 0.3,
});

registerRandomEvent({
  id: "annoying-system-alert",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isRandomAlertVisible,
  canTrigger: () => !isRandomAlertVisible(),
  run: () => {
    showRandomAlert();
  },
});

registerRandomEvent({
  id: "self-love-system-alert",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isSelfLoveAlertVisible,
  canTrigger: () => !isSelfLoveAlertVisible(),
  run: () => {
    showSelfLoveAlert();
  },
});

registerRandomEvent({
  id: "rohin-os-update",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isRohinUpdateVisible,
  canTrigger: () => !isRohinUpdateVisible(),
  run: () => {
    showRohinUpdate();
  },
});

registerRandomEvent({
  id: "mcafee-antivirus-update",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isMcAfeeVisible,
  canTrigger: () => !isMcAfeeVisible(),
  run: () => {
    showMcAfeePrompt();
  },
});

registerRandomEvent({
  id: "microsoft-word-license-stack",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isWordErrorStackVisible,
  canTrigger: () => !isWordErrorStackVisible(),
  run: () => {
    showWordErrorStack();
  },
});

registerRandomEvent({
  id: "rohin-os-note",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isRohinNoteVisible,
  canTrigger: () => !isRohinNoteVisible(),
  run: () => {
    showRohinNote();
  },
});

registerRandomEvent({
  id: "earth-proverb-note",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isEarthNoteVisible,
  canTrigger: () => !isEarthNoteVisible(),
  run: () => {
    showEarthNote();
  },
});

registerRandomEvent({
  id: "health-note",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isHealthNoteVisible,
  canTrigger: () => !isHealthNoteVisible(),
  run: () => {
    showHealthNote();
  },
});

registerRandomEvent({
  id: "love-note",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isLoveNoteVisible,
  canTrigger: () => !isLoveNoteVisible(),
  run: () => {
    showLoveNote();
  },
});

registerRandomEvent({
  id: "castle-gate-alert",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isCastleGateVisible,
  canTrigger: () => !isCastleGateVisible(),
  run: () => {
    showCastleGateWindow();
  },
});

registerRandomEvent({
  id: "possum-springs-bulletin",
  debug: true,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isPossumSpringsVisible,
  canTrigger: () => !isPossumSpringsVisible(),
  run: () => {
    showPossumSpringsWindow();
  },
});

registerRandomEvent({
  id: "winged-light",
  debug: true,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isWingedLightVisible,
  canTrigger: () => !isWingedLightVisible(),
  run: () => {
    showWingedLightWindow();
  },
});

registerRandomEvent({
  id: "mana-flood",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isManaFloodVisible,
  canTrigger: () => !isManaFloodVisible(),
  run: () => {
    showManaFlood();
  },
});

registerRandomEvent({
  id: "mimic-warning",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isMimicWarningVisible,
  canTrigger: () => !isMimicWarningVisible(),
  run: () => {
    showMimicWarning();
  },
});

registerRandomEvent({
  id: "sudden-skill-check",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isSkillCheckVisible,
  canTrigger: () => !isSkillCheckVisible(),
  run: () => {
    showSkillCheckWindow();
  },
});

registerRandomEvent({
  id: "distress-signal",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isDistressSignalVisible,
  canTrigger: () => !isDistressSignalVisible(),
  run: () => {
    showDistressSignalWindow();
  },
});

registerRandomEvent({
  id: "nazar-evil-eye",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isNazarVisible,
  canTrigger: () => !isNazarVisible(),
  run: () => {
    showNazarWindow();
  },
});

registerRandomEvent({
  id: "site-of-grace",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isSiteGraceVisible,
  canTrigger: () => !isSiteGraceVisible(),
  run: () => {
    showSiteGraceWindow();
  },
});

registerRandomEvent({
  id: "stalker-zone",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isStalkerVisible,
  canTrigger: () => !isStalkerVisible(),
  run: () => {
    showStalkerWindow();
  },
});

registerRandomEvent({
  id: "nana-random-encounter",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isNanaEncounterVisible,
  canTrigger: () => !isNanaEncounterVisible(),
  run: () => {
    showNanaEncounterWindow();
  },
});

registerRandomEvent({
  id: "lain-system-alert",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isLainAlertVisible,
  canTrigger: () => !isLainAlertVisible(),
  run: () => {
    showLainAlert();
  },
});

registerRandomEvent({
  id: "lelouch-system-alert",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isLelouchAlertVisible,
  canTrigger: () => !isLelouchAlertVisible(),
  run: () => {
    showLelouchAlert();
  },
});

registerRandomEvent({
  id: "human-instrumentality-project",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isInstrumentalityVisible,
  canTrigger: () => !isInstrumentalityVisible(),
  run: () => {
    showInstrumentalityPrompt();
  },
});

registerRandomEvent({
  id: "red-tool",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isRedToolVisible,
  canTrigger: () => !isRedToolVisible(),
  run: () => {
    showRedToolWindow();
  },
});

registerRandomEvent({
  id: "resist-your-fate",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isFateVisible,
  canTrigger: () => fateState === "idle" && !isFateVisible(),
  run: () => {
    showFateWindow();
  },
});

registerRandomEvent({
  id: "behelit-found",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isBehelitVisible,
  canTrigger: () => !isBehelitVisible(),
  run: () => {
    showBehelitWindow();
  },
});

registerRandomEvent({
  id: "john-pork",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isJohnPorkVisible,
  canTrigger: () => !isJohnPorkVisible(),
  run: () => {
    showJohnPorkCall();
  },
});

registerRandomEvent({
  id: "biden-blast",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isBidenBlastVisible,
  canTrigger: () => !isBidenBlastVisible(),
  run: () => {
    showBidenBlastWindow();
  },
});

registerRandomEvent({
  id: "infinity-blade-armory",
  debug: true,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isInfinityArmoryVisible,
  canTrigger: () => !isInfinityArmoryVisible(),
  run: () => {
    showInfinityArmoryWindow();
  },
});

registerRandomEvent({
  id: "virus",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_INTERACTIVE,
  isVisible: isVirusVisible,
  canTrigger: () => !isVirusVisible(),
  run: () => {
    showVirusWindow();
  },
});

registerRandomEvent({
  id: "evil-wizards-advertisement",
  debug: false,
  probability: STANDARD_RANDOM_EVENT_PROBABILITY,
  probabilities: STANDARD_RANDOM_EVENT_PROBABILITIES,
  kind: RANDOM_EVENT_KIND_NON_INTERACTIVE,
  isVisible: isAdvertisementVisible,
  canTrigger: () => !isAdvertisementVisible(),
  run: () => {
    showAdvertisementWindow();
  },
});

const bringWindowToFront = (win) => {
  if (!win || win.classList.contains("is-hidden")) return;
  if (activeWindow && activeWindow !== win) pauseMediaPlayback(activeWindow);
  activeWindow = win;
  win.style.zIndex = String(topZ++);
  playActiveAutoplayVideos(win);
  trackActiveAppDwell(win);
};

const isSmallResizableWindow = (win) => {
  if (!win) return false;
  if (
    win.classList.contains("study-window") ||
    win.classList.contains("pdf-window") ||
    win.classList.contains("minesweeper-window") ||
    win.classList.contains("solitaire-window")
  ) {
    return false;
  }

  const rect = win.getBoundingClientRect();
  return rect.width <= 760 && rect.height <= 620;
};

const clampNumber = (value, min, max) => Math.max(min, Math.min(value, max));

const getTaskbarViewportClearance = () => {
  const taskbar = document.querySelector(".taskbar");
  if (!taskbar) return 0;
  const rect = taskbar.getBoundingClientRect();
  if (rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) return 0;
  return Math.max(0, window.innerHeight - rect.top);
};

const clampWindowTitleBarPosition = (win, left, top) => {
  const titleBar = win?.querySelector(".title-bar");
  if (!win || !titleBar) return { left, top };

  const rect = win.getBoundingClientRect();
  const titleRect = titleBar.getBoundingClientRect();
  const titleOffsetX = titleRect.left - rect.left;
  const titleOffsetY = titleRect.top - rect.top;
  const viewportPadding = 0;
  const viewportRight = window.innerWidth - viewportPadding;
  const viewportBottom =
    window.innerHeight - getTaskbarViewportClearance() - viewportPadding;
  const maxLeft =
    titleRect.width > viewportRight
      ? viewportPadding - titleOffsetX
      : viewportRight - titleRect.width - titleOffsetX;
  const minLeft =
    titleRect.width > viewportRight
      ? viewportRight - titleRect.width - titleOffsetX
      : viewportPadding - titleOffsetX;
  const maxTop = Math.max(
    viewportPadding - titleOffsetY,
    viewportBottom - titleRect.height - titleOffsetY
  );
  const minTop = viewportPadding - titleOffsetY;

  return {
    left: Math.round(clampNumber(left, minLeft, maxLeft)),
    top: Math.round(clampNumber(top, minTop, maxTop)),
  };
};

const setWindowTitleBarClampedPosition = (win, left, top) => {
  const position = clampWindowTitleBarPosition(win, left, top);
  win.style.left = `${position.left}px`;
  win.style.top = `${position.top}px`;
  return position;
};

const syncPortfolioBodyHeight = (win, outerHeight) => {
  if (!win || !win.classList.contains("portfolio-window")) return;
  const body = win.querySelector(".window-body");
  if (!body) return;
  const titleBar = win.querySelector(".title-bar");
  const titleHeight = titleBar ? titleBar.offsetHeight : 22;
  const nextHeight = Math.max(180, Math.round(outerHeight - titleHeight - 18));
  body.style.height = `${nextHeight}px`;
  body.style.maxHeight = `${nextHeight}px`;
};

const setPortfolioExpandedState = (win, width, height) => {
  if (!win || !win.classList.contains("portfolio-window")) return;
  win.classList.toggle("is-window-expanded", width >= 780 || height >= 560);
};

const setPortfolioResponsiveState = (win, width, height) => {
  if (!win || !win.classList.contains("portfolio-window")) return;
  if (!width || !height) {
    const rect = win.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
  }
  if (!width || !height) return;

  win.classList.toggle("is-portfolio-narrow", width < 540);
  win.classList.toggle("is-portfolio-short", height < 360);
  setPortfolioExpandedState(win, width, height);
};

const isPortfolioResizeCorner = (win, event) => {
  if (!win || !event) return false;
  const rect = win.getBoundingClientRect();
  const hitSize = 24;
  return (
    event.clientX >= rect.right - hitSize &&
    event.clientX <= rect.right &&
    event.clientY >= rect.bottom - hitSize &&
    event.clientY <= rect.bottom
  );
};

const initPortfolioCornerResize = () => {
  document.querySelectorAll(".portfolio-window").forEach((win) => {
    win.classList.add("is-corner-resizable");

    win.addEventListener("pointermove", (event) => {
      if (win.classList.contains("is-manual-resizing")) return;
      win.classList.toggle("is-resize-hover", isPortfolioResizeCorner(win, event));
    });

    win.addEventListener("pointerleave", () => {
      if (!win.classList.contains("is-manual-resizing")) {
        win.classList.remove("is-resize-hover");
      }
    });

    win.addEventListener("pointerdown", (event) => {
      if (!isPortfolioResizeCorner(win, event)) return;
      if (event.button !== 0 && event.pointerType !== "touch") return;
      event.preventDefault();
      event.stopPropagation();
      bringWindowToFront(win);
      expandedWindowState.delete(win);

      const rect = win.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = rect.width;
      const startHeight = rect.height;
      const minWidth = Math.min(280, Math.max(240, window.innerWidth - 24));
      const minHeight = Math.min(220, Math.max(180, window.innerHeight - 96));
      const maxWidth = Math.max(minWidth, window.innerWidth - rect.left - 12);
      const maxHeight = Math.max(minHeight, window.innerHeight - rect.top - 58);

      win.classList.remove("app-window--center");
      win.classList.add("is-manual-resizing");
      document.body.classList.add("is-resizing-window");
      win.style.translate = "0 0";
      win.setPointerCapture(event.pointerId);

      const resizeWindow = (moveEvent) => {
        const nextWidth = Math.round(
          clampNumber(startWidth + moveEvent.clientX - startX, minWidth, maxWidth)
        );
        const nextHeight = Math.round(
          clampNumber(startHeight + moveEvent.clientY - startY, minHeight, maxHeight)
        );

        win.style.width = `${nextWidth}px`;
        win.style.height = `${nextHeight}px`;
        syncPortfolioBodyHeight(win, nextHeight);
        setPortfolioResponsiveState(win, nextWidth, nextHeight);
      };

      const finishResize = (upEvent) => {
        if (win.hasPointerCapture(upEvent.pointerId)) {
          win.releasePointerCapture(upEvent.pointerId);
        }
        win.classList.remove("is-manual-resizing");
        win.classList.remove("is-resize-hover");
        document.body.classList.remove("is-resizing-window");
        win.removeEventListener("pointermove", resizeWindow);
        win.removeEventListener("pointerup", finishResize);
        win.removeEventListener("pointercancel", finishResize);
      };

      win.addEventListener("pointermove", resizeWindow);
      win.addEventListener("pointerup", finishResize);
      win.addEventListener("pointercancel", finishResize);
    }, { capture: true });

    setPortfolioResponsiveState(win);
  });
};

const restoreWindowSize = (win) => {
  const saved = expandedWindowState.get(win);
  if (!saved) {
    if (win) {
      win.classList.remove("is-window-expanded");
      setPortfolioResponsiveState(win);
    }
    return;
  }
  const body = win.querySelector(".window-body");

  win.style.width = saved.width;
  win.style.height = saved.height;
  win.style.left = saved.left;
  win.style.top = saved.top;
  win.style.translate = saved.translate;
  win.classList.toggle("app-window--center", saved.centered);

  if (body) {
    body.style.height = saved.bodyHeight;
    body.style.maxHeight = saved.bodyMaxHeight;
  }

  expandedWindowState.delete(win);
  win.classList.remove("is-window-expanded");
  setPortfolioResponsiveState(win);
};

const expandSmallWindow = (win) => {
  if (!win || expandedWindowState.has(win) || !isSmallResizableWindow(win)) return;
  const rect = win.getBoundingClientRect();
  const body = win.querySelector(".window-body");
  const titleBar = win.querySelector(".title-bar");
  const maxWidth = Math.max(320, window.innerWidth - 48);
  const maxHeight = Math.max(260, window.innerHeight - 86);
  const nextWidth = Math.round(Math.min(maxWidth, Math.max(rect.width * 2, rect.width + 240)));
  const nextHeight = Math.round(Math.min(maxHeight, Math.max(rect.height * 2, rect.height + 180)));
  const maxLeft = Math.max(24, window.innerWidth - nextWidth - 24);
  const maxTop = Math.max(16, window.innerHeight - nextHeight - 70);
  const nextLeft = Math.round(Math.max(24, Math.min(rect.left, maxLeft)));
  const nextTop = Math.round(Math.max(16, Math.min(rect.top, maxTop)));

  expandedWindowState.set(win, {
    width: win.style.width,
    height: win.style.height,
    left: win.style.left,
    top: win.style.top,
    translate: win.style.translate,
    centered: win.classList.contains("app-window--center"),
    bodyHeight: body ? body.style.height : "",
    bodyMaxHeight: body ? body.style.maxHeight : "",
  });

  win.classList.remove("app-window--center");
  win.style.translate = "0 0";
  win.style.left = `${nextLeft}px`;
  win.style.top = `${nextTop}px`;
  win.style.width = `${nextWidth}px`;
  win.style.height = `${nextHeight}px`;

  if (body) {
    if (win.classList.contains("portfolio-window")) {
      syncPortfolioBodyHeight(win, nextHeight);
    } else {
      const titleHeight = titleBar ? titleBar.offsetHeight : 22;
      const nextBodyHeight = Math.max(120, nextHeight - titleHeight - 18);
      body.style.height = `${nextBodyHeight}px`;
      body.style.maxHeight = `${nextBodyHeight}px`;
    }
  }

  setPortfolioResponsiveState(win, nextWidth, nextHeight);
};

const getAppWindow = (appId) =>
  document.querySelector(`[data-app-window=\"${appId}\"]`);

const setWindowOpen = (appId, open) => {
  const win = getAppWindow(appId);
  if (!win) return;

  if (open) {
    delete win.dataset.mediaClosing;
    const isVisible =
      !win.classList.contains("is-hidden") &&
      !win.classList.contains("is-closing");

    if (isVisible) {
      bringWindowToFront(win);
      return;
    }

    win.classList.remove("is-hidden");
    resetWindowToFirstTab(win);
    bringWindowToFront(win);

    if (win.classList.contains("home-window")) {
      win.classList.add("app-window--center");
      win.style.left = "";
      win.style.top = "";
      win.style.translate = "";
    } else {
      const paddingX = 24;
      const paddingY = 24;
      const maxLeft = Math.max(
        paddingX,
        window.innerWidth - win.offsetWidth - paddingX
      );
      const maxTop = Math.max(
        paddingY,
        window.innerHeight - win.offsetHeight - 90
      );
      const randomLeft =
        paddingX + Math.random() * (maxLeft - paddingX);
      const randomTop = paddingY + Math.random() * (maxTop - paddingY);

      win.classList.remove("app-window--center");
      win.style.translate = "0 0";
      win.style.left = `${Math.round(randomLeft)}px`;
      win.style.top = `${Math.round(randomTop)}px`;
    }

    activateVisibleContent(win);

    setPortfolioResponsiveState(win);
    if (appId === "life-counter") updateLifeCounterWidthControls();
    if (appId === "snake") {
      startSnakeLoadingSequence();
    }
    if (appId === "sudoku") {
      startSudokuBootSequence();
    }
    restartWindowAnimation(win, "is-opening");
    triggerRandomEvents("windowOpen", { appId });
    return;
  }

  if (win.classList.contains("is-hidden")) return;

  win.dataset.mediaClosing = "true";
  stopMediaPlayback(win);

  if (activeWindow === win) activeWindow = null;
  if (activeAppDwellWindow === win) clearActiveAppDwell();

  if (appId === "solitaire") {
    solHideVictoryVideo();
  }
  if (appId === "snake") {
    clearSnakeLoadingSequence();
    pauseSnakeGame();
    stopSnakeNoiseAnimation();
  }
  if (appId === "sudoku") {
    clearSudokuBootSequence({ resetView: false });
    pauseSudokuTimer();
  }

  restoreWindowSize(win);
  win.style.zIndex = String(topZ++);
  restartWindowAnimation(win, "is-closing");
  stopMediaPlayback(win);
  triggerRandomEvents("windowClose", { appId });
};

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return Number(value).toLocaleString();
};

const parseBattleTime = (value) => {
  if (!value) return null;
  if (value.includes("-")) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatBattleLabel = (battle) => {
  if (!battle) return "Unknown";
  if (battle.gameMode && battle.gameMode.name) return battle.gameMode.name;
  if (battle.type) return battle.type;
  return "Battle";
};

const formatClan = (clan) => {
  if (!clan) return "--";
  const clanTag = clan.tag ? clan.tag : "";
  return `${clan.name || "--"}${clanTag ? ` (${clanTag})` : ""}`;
};

const buildDeckSignature = (cards) => {
  if (!Array.isArray(cards) || cards.length === 0) return "";
  return cards.map((card) => card.name).sort().join("|");
};

const averageElixir = (cards) => {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  const costs = cards
    .map((card) => Number(card.elixirCost))
    .filter((value) => !Number.isNaN(value));
  if (costs.length === 0) return null;
  const sum = costs.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / costs.length) * 10) / 10;
};

const guessArchetype = (cards) => {
  const names = new Set(cards.map((card) => card.name));
  if (names.has("Hog Rider")) return "Hog Cycle";
  if (names.has("Golem")) return "Golem Beatdown";
  if (names.has("Lava Hound")) return "LavaLoon";
  if (names.has("Royal Giant")) return "Royal Giant";
  if (names.has("X-Bow")) return "X-Bow";
  if (names.has("Mortar")) return "Mortar";
  if (names.has("Balloon")) return "Balloon";
  if (names.has("P.E.K.K.A")) return "P.E.K.K.A Bridge Spam";
  if (names.has("Graveyard")) return "Graveyard";
  return "Mixed";
};

/* Clash Royale app logic (disabled for now).
 * To re-enable: remove this block comment and the two event hooks below.
 * (block continues below)
const updateClashStatus = (message) => {
  if (clashStatus) {
    clashStatus.textContent = message;
  }
};

const renderChips = (container, items) => {
  if (!container) return;
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const chip = document.createElement("span");
    chip.className = "cr-chip";
    chip.textContent = "--";
    container.appendChild(chip);
    return;
  }
  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = "cr-chip";
    chip.textContent = item;
    container.appendChild(chip);
  });
};

const renderDeck = (container, cards) => {
  if (!container) return;
  container.innerHTML = "";
  if (!Array.isArray(cards) || cards.length === 0) {
    const chip = document.createElement("span");
    chip.className = "cr-deck-card";
    chip.textContent = "--";
    container.appendChild(chip);
    return;
  }
  cards.forEach((card) => {
    const chip = document.createElement("span");
    chip.className = "cr-deck-card";
    chip.textContent = card.name;
    container.appendChild(chip);
  });
};

const renderBattleLog = (battles) => {
  const battleLog = document.getElementById("cr-battle-log");
  if (!battleLog) return;
  battleLog.innerHTML = "";
  if (!Array.isArray(battles) || battles.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "No battles found.";
    battleLog.appendChild(empty);
    return;
  }
  battles.forEach((battle) => {
    const team = battle.team ? battle.team[0] : null;
    const opponent = battle.opponent ? battle.opponent[0] : null;
    const teamCrowns = team?.crowns ?? 0;
    const oppCrowns = opponent?.crowns ?? 0;
    const result = teamCrowns > oppCrowns ? "win" : teamCrowns < oppCrowns ? "loss" : "draw";
    const trophyDelta = team?.trophyChange ?? battle.trophyChange ?? null;
    const time = parseBattleTime(battle.battleTime);
    const summary = document.createElement("details");
    summary.className = "cr-battle-item";
    const summaryRow = document.createElement("summary");
    summaryRow.className = "cr-battle-summary";
    const resultBadge = document.createElement("span");
    resultBadge.className = `cr-result is-${result}`;
    resultBadge.textContent = result.toUpperCase();
    const mode = document.createElement("span");
    mode.textContent = formatBattleLabel(battle);
    const crownText = document.createElement("span");
    crownText.textContent = `Crowns ${teamCrowns}-${oppCrowns}`;
    const trophyText = document.createElement("span");
    trophyText.textContent = trophyDelta === null ? "No trophy delta" : `Trophies ${trophyDelta > 0 ? "+" : ""}${trophyDelta}`;
    const timeText = document.createElement("span");
    timeText.textContent = time ? time.toLocaleString() : "Unknown time";
    summaryRow.appendChild(resultBadge);
    summaryRow.appendChild(mode);
    summaryRow.appendChild(crownText);
    summaryRow.appendChild(trophyText);
    summaryRow.appendChild(timeText);
    summary.appendChild(summaryRow);

    const detail = document.createElement("div");
    detail.className = "cr-battle-detail";
    const oppLine = document.createElement("div");
    const oppClan = opponent?.clan ? ` (${opponent.clan.name})` : "";
    oppLine.textContent = `Opponent: ${opponent?.name || "--"}${oppClan} ${opponent?.tag || ""}`;
    const deckRow = document.createElement("div");
    deckRow.innerHTML = "<strong>Your deck:</strong>";
    const deckCards = document.createElement("div");
    deckCards.className = "cr-deck-row";
    renderDeck(deckCards, team?.cards || []);
    const oppDeckRow = document.createElement("div");
    oppDeckRow.innerHTML = "<strong>Opponent deck:</strong>";
    const oppDeckCards = document.createElement("div");
    oppDeckCards.className = "cr-deck-row";
    renderDeck(oppDeckCards, opponent?.cards || []);
    const elixirLine = document.createElement("div");
    const teamElixir = averageElixir(team?.cards || []);
    const oppElixir = averageElixir(opponent?.cards || []);
    elixirLine.textContent = `Elixir avg: you ${teamElixir ?? "--"} / opp ${oppElixir ?? "--"}`;
    detail.appendChild(oppLine);
    detail.appendChild(deckRow);
    detail.appendChild(deckCards);
    detail.appendChild(oppDeckRow);
    detail.appendChild(oppDeckCards);
    detail.appendChild(elixirLine);
    summary.appendChild(detail);

    battleLog.appendChild(summary);
  });
};

const updatePlayerCard = (player) => {
  const nameEl = document.getElementById("cr-player-name");
  const tagEl = document.getElementById("cr-player-tag");
  const kingEl = document.getElementById("cr-king-level");
  const trophiesEl = document.getElementById("cr-trophies");
  const bestEl = document.getElementById("cr-best-trophies");
  const arenaEl = document.getElementById("cr-arena");
  const favEl = document.getElementById("cr-favorite-card");
  const clanEl = document.getElementById("cr-clan");
  const roleEl = document.getElementById("cr-role");
  const donationsEl = document.getElementById("cr-donations");
  const badgesEl = document.getElementById("cr-badges");
  const lastUpdatedEl = document.getElementById("cr-last-updated");

  if (nameEl) nameEl.textContent = player?.name || "--";
  if (tagEl) tagEl.textContent = player?.tag || "--";
  if (kingEl) kingEl.textContent = formatNumber(player?.expLevel || player?.experienceLevel);
  if (trophiesEl) trophiesEl.textContent = formatNumber(player?.trophies);
  if (bestEl) bestEl.textContent = formatNumber(player?.bestTrophies);
  if (arenaEl) arenaEl.textContent = player?.arena?.name || player?.currentArena?.name || "--";
  if (favEl) favEl.textContent = player?.currentFavouriteCard?.name || "--";
  if (clanEl) clanEl.textContent = formatClan(player?.clan);
  if (roleEl) roleEl.textContent = player?.role || "--";
  if (donationsEl) donationsEl.textContent = formatNumber(player?.donations);
  if (badgesEl) {
    const badgeNames = Array.isArray(player?.badges)
      ? player.badges.slice(0, 6).map((badge) => badge.name)
      : [];
    renderChips(badgesEl, badgeNames);
  }
  if (lastUpdatedEl) lastUpdatedEl.textContent = new Date().toLocaleString();
};

const updateAnalytics = (battles) => {
  const sample = battles.slice(0, CLASH_SAMPLE_SIZE);
  const total = sample.length;
  let wins = 0;
  let draws = 0;
  let crownsFor = 0;
  let crownsAgainst = 0;
  let ladderWins = 0;
  let ladderTotal = 0;
  let trophyDeltaSum = 0;
  let trophyDeltaCount = 0;
  const cardCounts = new Map();
  const deckCounts = new Map();

  sample.forEach((battle) => {
    const team = battle.team ? battle.team[0] : null;
    const opponent = battle.opponent ? battle.opponent[0] : null;
    const teamCrowns = team?.crowns ?? 0;
    const oppCrowns = opponent?.crowns ?? 0;
    crownsFor += teamCrowns;
    crownsAgainst += oppCrowns;
    if (teamCrowns > oppCrowns) wins += 1;
    else if (teamCrowns === oppCrowns) draws += 1;

    const isLadder = battle.type === "ladder" || battle.gameMode?.name?.toLowerCase().includes("ladder");
    if (isLadder) {
      ladderTotal += 1;
      if (teamCrowns > oppCrowns) ladderWins += 1;
      const delta = team?.trophyChange ?? battle.trophyChange;
      if (typeof delta === "number") {
        trophyDeltaSum += delta;
        trophyDeltaCount += 1;
      }
    }

    if (Array.isArray(team?.cards)) {
      team.cards.forEach((card) => {
        cardCounts.set(card.name, (cardCounts.get(card.name) || 0) + 1);
      });
      const signature = buildDeckSignature(team.cards);
      if (signature) {
        deckCounts.set(signature, (deckCounts.get(signature) || 0) + 1);
      }
    }
  });

  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const crownDiff = crownsFor - crownsAgainst;
  const avgCrownsFor = total > 0 ? (crownsFor / total).toFixed(2) : "--";
  const avgCrownsAgainst = total > 0 ? (crownsAgainst / total).toFixed(2) : "--";
  const ladderWinRate = ladderTotal > 0 ? ((ladderWins / ladderTotal) * 100).toFixed(1) : "--";
  const avgTrophyDelta = trophyDeltaCount > 0 ? (trophyDeltaSum / trophyDeltaCount).toFixed(2) : "--";

  const topCards = Array.from(cardCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map((entry) => entry[0]);

  let stableDeck = "--";
  if (deckCounts.size > 0 && total > 0) {
    const topDeck = Array.from(deckCounts.values()).sort((a, b) => b - a)[0];
    stableDeck = `${Math.round((topDeck / total) * 100)}%`;
  }

  const archetype = sample[0]?.team?.[0]?.cards ? guessArchetype(sample[0].team[0].cards) : "--";

  document.getElementById("cr-sample").textContent = `${total} matches`;
  document.getElementById("cr-win-rate").textContent = total ? `${winRate.toFixed(1)}%` : "--";
  document.getElementById("cr-crown-diff").textContent = total ? `${crownDiff}` : "--";
  document.getElementById("cr-crown-avg").textContent =
    total ? `${avgCrownsFor} / ${avgCrownsAgainst}` : "--";
  document.getElementById("cr-ladder-winrate").textContent = ladderTotal ? `${ladderWinRate}%` : "--";
  document.getElementById("cr-avg-trophy").textContent = avgTrophyDelta !== "--" ? avgTrophyDelta : "--";
  document.getElementById("cr-deck-stability").textContent = stableDeck;
  document.getElementById("cr-archetype").textContent = archetype;
  renderChips(document.getElementById("cr-top-cards"), topCards);
};

const updateMainDeck = (battles) => {
  const sample = battles.slice(0, CLASH_SAMPLE_SIZE);
  if (sample.length === 0) return;
  const deckCounts = new Map();
  const deckCardsMap = new Map();
  const deckResults = new Map();
  sample.forEach((battle) => {
    const team = battle.team ? battle.team[0] : null;
    if (!team?.cards) return;
    const signature = buildDeckSignature(team.cards);
    if (!signature) return;
    deckCounts.set(signature, (deckCounts.get(signature) || 0) + 1);
    deckCardsMap.set(signature, team.cards);
    const teamCrowns = team.crowns ?? 0;
    const oppCrowns = battle.opponent ? battle.opponent[0]?.crowns ?? 0 : 0;
    const record = deckResults.get(signature) || { wins: 0, total: 0 };
    record.total += 1;
    if (teamCrowns > oppCrowns) record.wins += 1;
    deckResults.set(signature, record);
  });

  let selectedSignature = "";
  let maxCount = 0;
  deckCounts.forEach((count, signature) => {
    if (count > maxCount) {
      maxCount = count;
      selectedSignature = signature;
    }
  });

  if (!selectedSignature) return;
  const cards = deckCardsMap.get(selectedSignature) || [];
  const deckWin = deckResults.get(selectedSignature);
  const winRate = deckWin ? (deckWin.wins / deckWin.total) * 100 : null;
  document.getElementById("cr-main-deck-name").textContent = `${maxCount}x recent`;
  document.getElementById("cr-main-elixir").textContent = averageElixir(cards) ?? "--";
  document.getElementById("cr-main-winrate").textContent = winRate ? `${winRate.toFixed(1)}%` : "--";
  renderDeck(document.getElementById("cr-main-deck"), cards);
};

const loadClashRoyaleData = async (force) => {
  if (clashRoyaleLoading) return;
  if (clashRoyaleLoaded && !force) return;
  if (!CLASH_API_TOKEN) {
    updateClashStatus("Add your Clash Royale API token to load data.");
    return;
  }
  clashRoyaleLoading = true;
  updateClashStatus("Fetching player data...");
  try {
    const tag = encodeURIComponent(`#${CLASH_PLAYER_TAG}`);
    const headers = {
      Authorization: `Bearer ${CLASH_API_TOKEN}`,
    };
    const [playerRes, battleRes] = await Promise.all([
      fetch(`${CLASH_API_BASE_URL}/players/${tag}`, { headers }),
      fetch(`${CLASH_API_BASE_URL}/players/${tag}/battlelog`, { headers }),
    ]);
    if (!playerRes.ok) throw new Error("Player fetch failed");
    if (!battleRes.ok) throw new Error("Battle log fetch failed");
    const player = await playerRes.json();
    const battles = await battleRes.json();
    updatePlayerCard(player);
    renderBattleLog(battles);
    updateAnalytics(battles);
    updateMainDeck(battles);
    clashRoyaleLoaded = true;
    updateClashStatus("Data loaded.");
  } catch (error) {
    updateClashStatus("Unable to load data. Check token and CORS.");
  } finally {
    clashRoyaleLoading = false;
  }
};
*/

const toggleWindow = (appId) => {
  const win = getAppWindow(appId);
  if (win) {
    const shouldOpen =
      win.classList.contains("is-hidden") ||
      win.classList.contains("is-closing");
    setWindowOpen(appId, shouldOpen);
    // (Removed temporary Minesweeper open trigger for achievement.)
    // Clash Royale app disabled for now.
    // if (appId === "clash-royale") {
    //   loadClashRoyaleData(false);
    // }
  }
};

const closeAppWindow = (appId) => {
  setWindowOpen(appId, false);
  if (appId === "minesweeper") {
    msNewGame(msDifficulty ? msDifficulty.value : "beginner");
  }
};

const closeAllWindows = () => {
  appWindows.forEach((win) => {
    closeAppWindow(win.getAttribute("data-app-window"));
  });
  closeCalendar();
};

const sudokuCells = () =>
  sudokuCellElements.length
    ? sudokuCellElements
    : sudokuGrid
      ? Array.from(sudokuGrid.querySelectorAll(".sudoku-cell"))
      : [];

const normalizeSudokuDigit = (value) =>
  Array.from(String(value || "")).find((char) => SUDOKU_DIGITS.includes(char)) ||
  "";

const normalizeSudokuDifficulty = (difficulty) =>
  SUDOKU_PUZZLES[difficulty] ? difficulty : "easy";

const isSudokuGivenAt = (puzzle, index) =>
  SUDOKU_DIGITS.includes(String(puzzle || "")[index] || "");

const normalizeSudokuValues = (values, puzzle = sudokuState.puzzle) => {
  const isArraySource = Array.isArray(values);
  const raw = isArraySource ? values : String(values || "");
  const normalized = createSudokuEmptyValues();
  const safePuzzle = String(puzzle || "").padEnd(SUDOKU_CELL_COUNT, "0");
  for (let index = 0; index < SUDOKU_CELL_COUNT; index += 1) {
    if (isSudokuGivenAt(safePuzzle, index)) {
      normalized[index] = safePuzzle[index];
    } else {
      normalized[index] = normalizeSudokuDigit(raw[index]);
    }
  }
  return normalized;
};

const normalizeSudokuNotes = (notes) =>
  Array.from(new Set(Array.from(notes || "").filter((char) => SUDOKU_DIGITS.includes(char))))
    .sort()
    .join("");

const normalizeSudokuNotesList = (notes, puzzle = sudokuState.puzzle) => {
  const safePuzzle = String(puzzle || "").padEnd(SUDOKU_CELL_COUNT, "0");
  const rawNotes = Array.isArray(notes) ? notes : [];
  return Array.from({ length: SUDOKU_CELL_COUNT }, (_, index) =>
    isSudokuGivenAt(safePuzzle, index) ? "" : normalizeSudokuNotes(rawNotes[index])
  );
};

const normalizeSudokuSelectedIndex = (index) => {
  const selectedIndex = Number(index);
  return Number.isInteger(selectedIndex) &&
    selectedIndex >= 0 &&
    selectedIndex < SUDOKU_CELL_COUNT
    ? selectedIndex
    : -1;
};

const serializeSudokuValues = (values = sudokuState.values) =>
  normalizeSudokuValues(values, sudokuState.puzzle)
    .map((value) => value || "0")
    .join("");

const createSudokuHistoryEntry = () => ({
  values: normalizeSudokuValues(sudokuState.values, sudokuState.puzzle),
  notes: normalizeSudokuNotesList(sudokuState.notes, sudokuState.puzzle),
  selectedIndex: normalizeSudokuSelectedIndex(sudokuState.selectedIndex),
});

const areSudokuHistoryEntriesEqual = (first, second) =>
  Boolean(
    first &&
      second &&
      first.selectedIndex === second.selectedIndex &&
      first.values.join("") === second.values.join("") &&
      first.notes.join("|") === second.notes.join("|")
  );

const updateSudokuHistoryButtons = () => {
  if (sudokuUndo) sudokuUndo.disabled = sudokuState.undoStack.length === 0;
  if (sudokuRedo) sudokuRedo.disabled = sudokuState.redoStack.length === 0;
};

const pushSudokuUndoState = () => {
  const entry = createSudokuHistoryEntry();
  const lastEntry = sudokuState.undoStack[sudokuState.undoStack.length - 1];
  if (areSudokuHistoryEntriesEqual(entry, lastEntry)) return;
  sudokuState.undoStack.push(entry);
  if (sudokuState.undoStack.length > SUDOKU_MAX_UNDO_STATES) {
    sudokuState.undoStack.shift();
  }
  sudokuState.redoStack = [];
  updateSudokuHistoryButtons();
};

const formatSudokuTime = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const remainingSeconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
};

const currentSudokuElapsedSeconds = () => {
  if (!sudokuState.timerStartedAt) return sudokuState.elapsedSeconds;
  return (
    sudokuState.elapsedSeconds +
    Math.floor((Date.now() - sudokuState.timerStartedAt) / 1000)
  );
};

const createSudokuSavePayload = () => ({
  version: 1,
  difficulty: sudokuState.difficulty,
  puzzle: sudokuState.puzzle,
  values: serializeSudokuValues(),
  notes: normalizeSudokuNotesList(sudokuState.notes, sudokuState.puzzle),
  elapsedSeconds: currentSudokuElapsedSeconds(),
  hintMode: sudokuState.hintMode,
  noteMode: sudokuState.noteMode,
  selectedIndex: normalizeSudokuSelectedIndex(sudokuState.selectedIndex),
  usedHint: sudokuState.usedHint,
  usedReveal: sudokuState.usedReveal,
  solved: sudokuState.solved,
});

const flushSudokuSave = () => {
  if (sudokuSaveTimerId) {
    clearTimeout(sudokuSaveTimerId);
    sudokuSaveTimerId = null;
  }
  try {
    localStorage.setItem(SUDOKU_STORAGE_KEY, JSON.stringify(createSudokuSavePayload()));
  } catch (error) {
    // Local storage can be disabled in some browsing modes.
  }
};

const scheduleSudokuSave = () => {
  if (sudokuSaveTimerId) clearTimeout(sudokuSaveTimerId);
  sudokuSaveTimerId = window.setTimeout(flushSudokuSave, SUDOKU_SAVE_DEBOUNCE_MS);
};

const restoreSudokuSavedState = () => {
  let savedState = null;
  try {
    savedState = JSON.parse(localStorage.getItem(SUDOKU_STORAGE_KEY) || "null");
  } catch (error) {
    savedState = null;
  }
  if (!savedState || savedState.version !== 1) return false;

  const difficulty = normalizeSudokuDifficulty(savedState.difficulty);
  const puzzle = SUDOKU_PUZZLES[difficulty];
  if (savedState.puzzle && savedState.puzzle !== puzzle.puzzle) return false;

  sudokuState.difficulty = difficulty;
  sudokuState.puzzle = puzzle.puzzle;
  sudokuState.solution = puzzle.solution;
  sudokuState.mistakes = 0;
  sudokuState.elapsedSeconds = Math.max(0, Math.floor(Number(savedState.elapsedSeconds) || 0));
  sudokuState.timerId = null;
  sudokuState.timerStartedAt = 0;
  sudokuState.playing = false;
  sudokuState.solved = Boolean(savedState.solved);
  sudokuState.usedHint = Boolean(savedState.usedHint);
  sudokuState.usedReveal = Boolean(savedState.usedReveal);
  sudokuState.hintMode = savedState.hintMode === "errors" ? "errors" : "off";
  sudokuState.noteMode = Boolean(savedState.noteMode);
  sudokuState.values = normalizeSudokuValues(savedState.values, puzzle.puzzle);
  sudokuState.notes = normalizeSudokuNotesList(savedState.notes, puzzle.puzzle);
  sudokuState.undoStack = [];
  sudokuState.redoStack = [];
  sudokuState.selectedIndex = normalizeSudokuSelectedIndex(savedState.selectedIndex);
  return true;
};

const updateSudokuTimeDisplay = () => {
  if (sudokuTime) {
    sudokuTime.textContent = `Time: ${formatSudokuTime(currentSudokuElapsedSeconds())}`;
  }
};

const updateSudokuMistakesDisplay = () => {
  if (sudokuMistakes) sudokuMistakes.textContent = `Mistakes: ${sudokuState.mistakes}`;
};

const setSudokuStatus = (message) => {
  if (sudokuStatus) sudokuStatus.textContent = message;
  updateSudokuMistakesDisplay();
  updateSudokuTimeDisplay();
};

const startSudokuTimer = () => {
  if (sudokuState.solved || sudokuState.timerId) return;
  sudokuState.timerStartedAt = Date.now();
  sudokuState.timerId = window.setInterval(updateSudokuTimeDisplay, 1000);
  updateSudokuTimeDisplay();
};

const pauseSudokuTimer = () => {
  if (!sudokuState.timerId) return;
  sudokuState.elapsedSeconds = currentSudokuElapsedSeconds();
  clearInterval(sudokuState.timerId);
  sudokuState.timerId = null;
  sudokuState.timerStartedAt = 0;
  updateSudokuTimeDisplay();
  scheduleSudokuSave();
};

const resetSudokuTimer = () => {
  if (sudokuState.timerId) clearInterval(sudokuState.timerId);
  sudokuState.elapsedSeconds = 0;
  sudokuState.timerId = null;
  sudokuState.timerStartedAt = 0;
  updateSudokuTimeDisplay();
};

const isSudokuWindowVisible = () => {
  const win = getAppWindow("sudoku");
  return Boolean(
    win &&
      !win.classList.contains("is-hidden") &&
      !win.classList.contains("is-closing")
  );
};

const isSudokuReducedMotion = () => Boolean(sudokuReducedMotionMedia?.matches);

const isSudokuPageActive = () =>
  typeof document.hasFocus === "function" ? document.hasFocus() : true;

const isSudokuAquariumActive = () =>
  Boolean(
    sudokuAquariumLayer &&
      sudokuState.playing &&
      isSudokuWindowVisible() &&
      !document.hidden &&
      isSudokuPageActive() &&
      !isSudokuReducedMotion()
  );

const setSudokuLoadingProgress = (progress) => {
  sudokuState.loadingProgress = Math.max(0, Math.min(100, progress));
  const roundedProgress = Math.round(sudokuState.loadingProgress);
  if (sudokuLoadingFill) {
    sudokuLoadingFill.style.setProperty(
      "--sudoku-load-progress",
      `${roundedProgress}%`
    );
  }
  if (sudokuLoadingMeter) {
    sudokuLoadingMeter.setAttribute("aria-valuenow", String(roundedProgress));
  }
};

const clearSudokuLoadingTimer = () => {
  if (!sudokuState.loadingTimerId) return;
  clearTimeout(sudokuState.loadingTimerId);
  sudokuState.loadingTimerId = null;
};

const clearSudokuTransitionTimer = () => {
  if (!sudokuState.transitionTimerId) return;
  clearTimeout(sudokuState.transitionTimerId);
  sudokuState.transitionTimerId = null;
};

const clearSudokuBubbleBursts = () => {
  document
    .querySelectorAll(".sudoku-burst-effect")
    .forEach((element) => element.remove());
};

const clearSudokuPlayBurst = () => {
  if (sudokuApp) sudokuApp.classList.remove("is-sudoku-bursting");
  if (sudokuPlay) sudokuPlay.classList.remove("animate");
  clearSudokuBubbleBursts();
};

const triggerSudokuBubbleBurst = (target, variant) => {
  if (!target) return;
  const className = `sudoku-burst-effect--${variant}`;
  target.querySelectorAll(`.${className}`).forEach((element) => element.remove());
  const effect = document.createElement("span");
  effect.className = `sudoku-burst-effect ${className}`;
  effect.setAttribute("aria-hidden", "true");
  target.append(effect);
  window.setTimeout(() => effect.remove(), SUDOKU_PLAY_BURST_MS + 120);
};

const triggerSudokuCheckBubbleBurst = () => {
  triggerSudokuBubbleBurst(sudokuCheck, "button");
};

const triggerSudokuFullBubbleBurst = () => {
  triggerSudokuBubbleBurst(sudokuAeroPanel || sudokuApp, "full");
};

const sudokuRandomBetween = (min, max) => min + Math.random() * (max - min);

const sudokuRandomInt = (min, max) =>
  Math.floor(sudokuRandomBetween(min, max + 1));

const sudokuPick = (items) => items[Math.floor(Math.random() * items.length)];

const sampleSudokuFishDepth = () => {
  const roll = Math.random();
  if (roll < 0.7) return "far";
  if (roll < 0.93) return "mid";
  return "near";
};

const clearSudokuAquariumTimers = () => {
  if (sudokuFishTimerId) {
    clearTimeout(sudokuFishTimerId);
    sudokuFishTimerId = null;
  }
  if (sudokuBubbleTimerId) {
    clearTimeout(sudokuBubbleTimerId);
    sudokuBubbleTimerId = null;
  }
};

const clearSudokuAquarium = () => {
  clearSudokuAquariumTimers();
  if (!sudokuAquariumLayer) return;
  sudokuAquariumLayer
    .querySelectorAll(".sudoku-fish, .sudoku-bubble-cluster")
    .forEach((element) => element.remove());
};

const createSudokuFishElement = ({
  depth,
  type,
  top,
  size,
  opacity,
  blur,
  saturate,
  duration,
  delay,
  direction,
}) => {
  const fish = document.createElement("span");
  fish.className = `sudoku-fish sudoku-fish--${type} sudoku-fish--${depth}`;
  fish.setAttribute("aria-hidden", "true");
  fish.style.setProperty("--fish-top", `${top.toFixed(1)}%`);
  fish.style.setProperty("--fish-size", `${Math.round(size)}px`);
  fish.style.setProperty("--fish-opacity", opacity.toFixed(2));
  fish.style.setProperty("--fish-blur", `${blur.toFixed(2)}px`);
  fish.style.setProperty("--fish-saturate", saturate.toFixed(2));
  fish.style.setProperty("--fish-duration", `${Math.round(duration)}ms`);
  fish.style.setProperty("--fish-delay", `${Math.round(delay)}ms`);
  fish.style.setProperty("--fish-start-left", direction === 1 ? "-22%" : "122%");
  fish.style.setProperty("--fish-end-left", direction === 1 ? "122%" : "-22%");
  fish.style.setProperty("--fish-dir", String(direction));
  fish.style.setProperty("--fish-bob", `${sudokuRandomBetween(2, 8).toFixed(1)}px`);

  const body = document.createElement("span");
  body.className = "sudoku-fish-body";
  fish.append(body);
  fish.addEventListener("animationend", () => fish.remove(), { once: true });
  return fish;
};

const spawnSudokuFishPass = () => {
  if (!isSudokuAquariumActive()) return;
  const liveFishCount = sudokuAquariumLayer.querySelectorAll(".sudoku-fish").length;
  const availableSlots = SUDOKU_MAX_FISH - liveFishCount;
  if (availableSlots <= 0) return;

  const depth = sampleSudokuFishDepth();
  const config = SUDOKU_FISH_DEPTHS[depth];
  const isSchool = Math.random() < config.schoolChance;
  const count = Math.min(
    availableSlots,
    isSchool ? sudokuRandomInt(config.school[0], config.school[1]) : 1
  );
  const baseType = sudokuPick(SUDOKU_FISH_TYPES);
  const baseTop = sudokuRandomBetween(config.top[0], config.top[1]);
  const baseSize = sudokuRandomBetween(config.size[0], config.size[1]);
  const direction = Math.random() < 0.5 ? 1 : -1;

  for (let index = 0; index < count; index += 1) {
    const topOffset =
      count === 1
        ? 0
        : (index - (count - 1) / 2) * sudokuRandomBetween(3, 7) +
          sudokuRandomBetween(-2, 2);
    const type = Math.random() < 0.75 ? baseType : sudokuPick(SUDOKU_FISH_TYPES);
    const fish = createSudokuFishElement({
      depth,
      type,
      top: Math.max(8, Math.min(90, baseTop + topOffset)),
      size: baseSize * sudokuRandomBetween(0.84, 1.26),
      opacity: sudokuRandomBetween(config.opacity[0], config.opacity[1]),
      blur: sudokuRandomBetween(config.blur[0], config.blur[1]),
      saturate: sudokuRandomBetween(config.saturate[0], config.saturate[1]),
      duration: sudokuRandomBetween(config.duration[0], config.duration[1]),
      delay: index * sudokuRandomBetween(120, 420),
      direction,
    });
    sudokuAquariumLayer.append(fish);
  }
};

const spawnSudokuBubbleCluster = () => {
  if (!isSudokuAquariumActive()) return;
  if (
    sudokuAquariumLayer.querySelectorAll(".sudoku-bubble-cluster").length >=
    SUDOKU_MAX_BUBBLE_CLUSTERS
  ) {
    return;
  }

  const cluster = document.createElement("span");
  const bubbleCount = sudokuRandomInt(4, 10);
  cluster.className = "sudoku-bubble-cluster";
  cluster.setAttribute("aria-hidden", "true");
  cluster.style.setProperty("--bubble-left", `${sudokuRandomBetween(12, 88).toFixed(1)}%`);
  cluster.style.setProperty("--bubble-width", `${Math.round(sudokuRandomBetween(48, 110))}px`);
  cluster.style.setProperty("--bubble-duration", `${Math.round(sudokuRandomBetween(9000, 14000))}ms`);
  cluster.style.setProperty("--bubble-opacity", sudokuRandomBetween(0.56, 0.84).toFixed(2));
  cluster.style.setProperty("--bubble-drift", `${sudokuRandomBetween(-30, 30).toFixed(1)}px`);

  for (let index = 0; index < bubbleCount; index += 1) {
    const bubble = document.createElement("span");
    bubble.className = "sudoku-bubble";
    bubble.style.setProperty("--bubble-size", `${Math.round(sudokuRandomBetween(7, 22))}px`);
    bubble.style.setProperty("--bubble-offset", `${sudokuRandomBetween(4, 96).toFixed(1)}%`);
    bubble.style.setProperty("--bubble-bottom", `${Math.round(sudokuRandomBetween(0, 66))}px`);
    bubble.style.setProperty("--bubble-wobble", `${Math.round(sudokuRandomBetween(1200, 2600))}ms`);
    cluster.append(bubble);
  }

  cluster.addEventListener("animationend", () => cluster.remove(), { once: true });
  sudokuAquariumLayer.append(cluster);
};

const scheduleSudokuFish = (delay = 0) => {
  if (!isSudokuAquariumActive() || sudokuFishTimerId) return;
  sudokuFishTimerId = window.setTimeout(() => {
    sudokuFishTimerId = null;
    if (!isSudokuAquariumActive()) return;
    spawnSudokuFishPass();
    scheduleSudokuFish(sudokuRandomBetween(1600, 4800));
  }, delay);
};

const scheduleSudokuBubbles = (delay = 0) => {
  if (!isSudokuAquariumActive() || sudokuBubbleTimerId) return;
  sudokuBubbleTimerId = window.setTimeout(() => {
    sudokuBubbleTimerId = null;
    if (!isSudokuAquariumActive()) return;
    spawnSudokuBubbleCluster();
    scheduleSudokuBubbles(sudokuRandomBetween(2500, 7500));
  }, delay);
};

const startSudokuAquarium = () => {
  if (!isSudokuAquariumActive()) return;
  scheduleSudokuFish(sudokuRandomBetween(300, 1400));
  scheduleSudokuBubbles(sudokuRandomBetween(1400, 3200));
};

const syncSudokuAquariumActivity = () => {
  if (isSudokuAquariumActive()) {
    startSudokuAquarium();
  } else {
    clearSudokuAquarium();
  }
};

const setSudokuBootState = (state) => {
  if (!sudokuApp) return;
  sudokuApp.classList.toggle("is-sudoku-loading", state === "loading");
  sudokuApp.classList.toggle("is-sudoku-ready", state === "ready");
  sudokuApp.classList.toggle("is-sudoku-bursting", state === "bursting");
  sudokuApp.classList.toggle("is-sudoku-playing", state === "playing");
  if (sudokuWindow) {
    sudokuWindow.classList.toggle("is-sudoku-playing", state === "playing");
  }
  if (sudokuPlay) sudokuPlay.disabled = state !== "ready";
  if (sudokuLoadingScreen) {
    sudokuLoadingScreen.setAttribute("aria-hidden", String(state === "playing"));
  }
  if (state === "playing") startSudokuAquarium();
  else clearSudokuAquarium();
};

const finishSudokuLoadingSequence = () => {
  clearSudokuLoadingTimer();
  sudokuState.loadingStartedAt = 0;
  setSudokuLoadingProgress(100);
  setSudokuBootState("ready");
  requestAnimationFrame(() => {
    if (sudokuPlay && isSudokuWindowVisible()) sudokuPlay.focus();
  });
};

const tickSudokuLoadingSequence = () => {
  if (!isSudokuWindowVisible() || sudokuState.playing) {
    clearSudokuLoadingTimer();
    return;
  }

  const elapsed = performance.now() - sudokuState.loadingStartedAt;
  if (elapsed >= sudokuState.loadingDuration) {
    finishSudokuLoadingSequence();
    return;
  }

  const targetProgress = (elapsed / sudokuState.loadingDuration) * 100;
  const jump = 3 + Math.random() * 14;
  const catchup = Math.max(0, targetProgress - sudokuState.loadingProgress) * 0.58;
  setSudokuLoadingProgress(
    Math.min(98, Math.max(sudokuState.loadingProgress + 1, sudokuState.loadingProgress + jump + catchup))
  );

  const remainingMs = Math.max(
    0,
    sudokuState.loadingDuration - (performance.now() - sudokuState.loadingStartedAt)
  );
  sudokuState.loadingTimerId = window.setTimeout(
    tickSudokuLoadingSequence,
    Math.min(90 + Math.random() * 210, remainingMs)
  );
};

const startSudokuBootSequence = () => {
  if (!sudokuApp) return;
  pauseSudokuTimer();
  hideSudokuSolvePopup();
  clearSudokuLoadingTimer();
  clearSudokuTransitionTimer();
  clearSudokuPlayBurst();
  sudokuState.playing = false;
  sudokuState.loadingStartedAt = performance.now();
  sudokuState.loadingDuration =
    SUDOKU_LOAD_MIN_MS + Math.random() * (SUDOKU_LOAD_MAX_MS - SUDOKU_LOAD_MIN_MS);
  setSudokuLoadingProgress(0);
  setSudokuBootState("loading");
  sudokuState.loadingTimerId = window.setTimeout(
    tickSudokuLoadingSequence,
    120 + Math.random() * 180
  );
};

const clearSudokuBootSequence = ({ resetView = true } = {}) => {
  clearSudokuLoadingTimer();
  clearSudokuTransitionTimer();
  clearSudokuPlayBurst();
  clearSudokuAquarium();
  hideSudokuSolvePopup();
  sudokuState.playing = false;
  sudokuState.loadingStartedAt = 0;
  sudokuState.loadingDuration = 0;
  setSudokuLoadingProgress(0);
  if (resetView) setSudokuBootState("");
  scheduleSudokuSave();
};

const selectedSudokuCell = () => {
  const index = normalizeSudokuSelectedIndex(sudokuState.selectedIndex);
  return index >= 0 ? sudokuCells()[index] || null : null;
};

const focusSudokuCell = (index) => {
  const selectedIndex = normalizeSudokuSelectedIndex(index);
  const cell = selectedIndex >= 0 ? sudokuCells()[selectedIndex] : null;
  if (!cell) return;
  selectSudokuCell(cell);
  cell.focus();
};

const focusNextSudokuEditableCell = (index) => {
  const cells = sudokuCells();
  if (!cells.length) return;
  for (let offset = 1; offset <= SUDOKU_CELL_COUNT; offset += 1) {
    const nextIndex = (index + offset) % SUDOKU_CELL_COUNT;
    const nextCell = cells[nextIndex];
    if (nextCell && !isSudokuCellReadOnly(nextCell)) {
      focusSudokuCell(nextIndex);
      return;
    }
  }
};

const revealSudokuGameFromBoot = () => {
  clearSudokuTransitionTimer();
  clearSudokuPlayBurst();
  clearSudokuLoadingTimer();
  if (!isSudokuWindowVisible()) return;
  sudokuState.playing = true;
  setSudokuLoadingProgress(100);
  setSudokuBootState("playing");
  setSudokuStatus(sudokuState.solved ? "Solved" : "Ready");
  startSudokuTimer();
  const firstOpenCell =
    selectedSudokuCell() || sudokuCells().find((cell) => !cell.readOnly);
  requestAnimationFrame(() => {
    if (firstOpenCell) firstOpenCell.focus();
  });
  scheduleSudokuSave();
};

const startSudokuGameFromBoot = () => {
  if (sudokuState.transitionTimerId) return;
  clearSudokuTransitionTimer();
  setSudokuBootState("bursting");
  if (sudokuPlay) {
    sudokuPlay.classList.remove("animate");
    void sudokuPlay.offsetWidth;
    sudokuPlay.classList.add("animate");
  }

  let finished = false;
  const finishTransition = () => {
    if (finished) return;
    finished = true;
    revealSudokuGameFromBoot();
  };

  sudokuState.transitionTimerId = window.setTimeout(
    finishTransition,
    SUDOKU_PLAY_BURST_MS
  );
};

const updateSudokuDifficultyButtons = () => {
  if (sudokuApp) sudokuApp.dataset.sudokuDifficulty = sudokuState.difficulty;
  sudokuDifficultyButtons.forEach((button) => {
    const isSelected = button.dataset.sudokuDifficulty === sudokuState.difficulty;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const isSudokuCellReadOnly = (cell) => Boolean(cell?.readOnly);

const getSudokuCellValue = (cell) => {
  const index = Number(cell?.dataset.sudokuIndex);
  if (Number.isInteger(index) && sudokuState.values) {
    return sudokuState.values[index] || "";
  }
  return (cell?.value || "").slice(0, 1);
};

const getSudokuCellNotes = (index) => sudokuState.notes?.[index] || "";

const updateSudokuCellAriaLabel = (cell, index) => {
  const row = Math.floor(index / 9) + 1;
  const column = (index % 9) + 1;
  const value = getSudokuCellValue(cell);
  const notes = getSudokuCellNotes(index);
  const valueText = value ? `Value ${value}` : "Empty";
  const noteText = !value && notes ? `Notes ${notes.split("").join(", ")}` : "No notes";
  cell.setAttribute("aria-label", `Row ${row}, column ${column}. ${valueText}. ${noteText}.`);
};

const renderSudokuCellNotes = (cell, index) => {
  if (!cell) return;
  const notes = getSudokuCellNotes(index);
  const noteDigits =
    cell._sudokuNoteDigits ||
    Array.from(cell.querySelectorAll(".sudoku-note-digit"));
  noteDigits.forEach((note, digitIndex) => {
    const digit = String(digitIndex + 1);
    note.textContent = notes.includes(digit) ? digit : "";
  });
};

const refreshSudokuCellDisplay = (cell, index) => {
  if (!cell) return;
  const value = getSudokuCellValue(cell);
  const valueEl = cell._sudokuValueEl || cell.querySelector(".sudoku-cell-value");
  if (valueEl) valueEl.textContent = value;
  renderSudokuCellNotes(cell, index);
  cell.value = value;
  cell.dataset.sudokuValue = value;
  cell.classList.toggle("has-value", Boolean(value));
  cell.classList.toggle("has-notes", !value && Boolean(getSudokuCellNotes(index)));
  updateSudokuCellAriaLabel(cell, index);
};

const setSudokuCellValue = (cell, index, value) => {
  if (!sudokuState.values) sudokuState.values = createSudokuEmptyValues();
  const givenValue = String(sudokuState.puzzle || "")[index] || "";
  const digit = SUDOKU_DIGITS.includes(givenValue)
    ? givenValue
    : normalizeSudokuDigit(value);
  sudokuState.values[index] = digit;
  if (cell) refreshSudokuCellDisplay(cell, index);
};

const setSudokuCellNotes = (cell, index, notes) => {
  if (!sudokuState.notes) sudokuState.notes = createSudokuEmptyNotes();
  sudokuState.notes[index] = isSudokuGivenAt(sudokuState.puzzle, index)
    ? ""
    : normalizeSudokuNotes(notes);
  refreshSudokuCellDisplay(cell, index);
};

const updateSudokuNoteToggle = () => {
  if (!sudokuNoteToggle) return;
  sudokuNoteToggle.classList.toggle("is-selected", sudokuState.noteMode);
  sudokuNoteToggle.setAttribute("aria-pressed", String(sudokuState.noteMode));
};

const updateSudokuNumberButtons = () => {
  const cell = selectedSudokuCell();
  const selectedIndex = cell ? Number(cell.dataset.sudokuIndex) : -1;
  const selectedValue = cell && !isSudokuCellReadOnly(cell) ? getSudokuCellValue(cell) : "";
  const selectedNotes =
    cell && !isSudokuCellReadOnly(cell) && Number.isInteger(selectedIndex)
      ? getSudokuCellNotes(selectedIndex)
      : "";
  sudokuNumberButtons.forEach((button) => {
    const value = button.dataset.sudokuNumber;
    const isSelected =
      (sudokuState.noteMode &&
        !selectedValue &&
        SUDOKU_DIGITS.includes(value) &&
        selectedNotes.includes(value)) ||
      (!sudokuState.noteMode && value === selectedValue) ||
      (value === "clear" &&
        cell &&
        !isSudokuCellReadOnly(cell) &&
        !selectedValue &&
        !selectedNotes);
    button.classList.toggle("is-selected", Boolean(isSelected));
    button.setAttribute("aria-pressed", String(Boolean(isSelected)));
  });
  updateSudokuNoteToggle();
};

const updateSudokuHintButtons = () => {
  sudokuHintButtons.forEach((button) => {
    const mode = button.dataset.sudokuHint;
    const isSelected = mode !== "reveal" && mode === sudokuState.hintMode;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const clearSudokuHighlights = () => {
  sudokuCells().forEach((cell) => cell.classList.remove("is-invalid"));
};

const clearSudokuSolvedWave = () => {
  sudokuCells().forEach((cell) => {
    cell.classList.remove("is-solved-wave");
    cell.style.removeProperty("--sudoku-solve-delay");
  });
};

const hideSudokuSolvePopup = () => {
  if (!sudokuSolvePopup) return;
  sudokuSolvePopup.classList.remove("is-visible");
  sudokuSolvePopup.setAttribute("aria-hidden", "true");
};

const showSudokuSolvePopup = () => {
  if (!sudokuSolvePopup || !sudokuSolveMessage) return;
  sudokuSolveMessage.textContent = sudokuState.usedReveal
    ? "Good job! Try not to use hints next time."
    : "Good job!";
  sudokuSolvePopup.classList.add("is-visible");
  sudokuSolvePopup.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    if (sudokuSolveOk) sudokuSolveOk.focus();
  });
};

const selectSudokuCell = (selectedCell) => {
  const cells = sudokuCells();
  const selectedIndex = selectedCell ? Number(selectedCell.dataset.sudokuIndex) : -1;
  const hasSelection =
    Number.isInteger(selectedIndex) &&
    selectedIndex >= 0 &&
    selectedIndex < cells.length;
  const selectedRow = hasSelection ? Math.floor(selectedIndex / 9) : -1;
  const selectedColumn = hasSelection ? selectedIndex % 9 : -1;

  cells.forEach((cell, index) => {
    const isSelected = cell === selectedCell;
    const isAxisHighlight =
      hasSelection &&
      (Math.floor(index / 9) === selectedRow || index % 9 === selectedColumn);
    cell.classList.toggle("is-selected", isSelected);
    cell.classList.toggle("is-axis-highlight", isAxisHighlight);
  });

  sudokuState.selectedIndex = hasSelection ? selectedIndex : -1;
  updateSudokuNumberButtons();
  scheduleSudokuSave();
};

const syncSudokuCellFeedback = (input, index) => {
  input.classList.remove("is-invalid");
  const isCorrect =
    !isSudokuCellReadOnly(input) &&
    Boolean(getSudokuCellValue(input)) &&
    getSudokuCellValue(input) === sudokuState.solution[index];
  input.classList.toggle("is-correct", isCorrect);
};

const refreshAllSudokuCells = () => {
  sudokuCells().forEach((cell, index) => {
    refreshSudokuCellDisplay(cell, index);
    syncSudokuCellFeedback(cell, index);
  });
};

const validateSudokuBoard = ({ mark = false } = {}) => {
  const cells = sudokuCells();
  const values = normalizeSudokuValues(sudokuState.values, sudokuState.puzzle);
  const mistakeIndexes = new Set();

  values.forEach((value, index) => {
    if (!value || isSudokuGivenAt(sudokuState.puzzle, index)) return;
    if (value !== sudokuState.solution[index]) mistakeIndexes.add(index);
  });

  if (mark) {
    cells.forEach((cell, index) => {
      const isInvalid = mistakeIndexes.has(index);
      cell.classList.remove("is-invalid");
      if (isInvalid) {
        void cell.offsetWidth;
        cell.classList.add("is-invalid");
      }
    });
  }

  return {
    complete: values.every(Boolean),
    mistakes: mistakeIndexes.size,
    valid: mistakeIndexes.size === 0,
  };
};

const updateSudokuMistakesFromBoard = () => {
  const result = validateSudokuBoard();
  sudokuState.mistakes = result.mistakes;
  updateSudokuMistakesDisplay();
  return result;
};

const refreshSudokuHintFeedback = () => {
  if (sudokuState.hintMode !== "errors") {
    clearSudokuHighlights();
    return updateSudokuMistakesFromBoard();
  }
  const result = validateSudokuBoard({ mark: true });
  sudokuState.mistakes = result.mistakes;
  updateSudokuMistakesDisplay();
  return result;
};

const applySudokuHistoryEntry = (entry) => {
  if (!entry) return;
  hideSudokuSolvePopup();
  clearSudokuSolvedWave();
  sudokuState.values = normalizeSudokuValues(entry.values, sudokuState.puzzle);
  sudokuState.notes = normalizeSudokuNotesList(entry.notes, sudokuState.puzzle);
  sudokuState.selectedIndex = normalizeSudokuSelectedIndex(entry.selectedIndex);
  sudokuState.solved = false;
  refreshAllSudokuCells();
  refreshSudokuHintFeedback();
  updateSudokuNumberButtons();
  updateSudokuHistoryButtons();
  setSudokuStatus("Ready");
  scheduleSudokuSave();
  const selectedCell = selectedSudokuCell();
  if (selectedCell && sudokuState.playing) selectedCell.focus();
};

const undoSudokuMove = () => {
  if (!sudokuState.undoStack.length) return;
  const currentEntry = createSudokuHistoryEntry();
  const previousEntry = sudokuState.undoStack.pop();
  sudokuState.redoStack.push(currentEntry);
  applySudokuHistoryEntry(previousEntry);
};

const redoSudokuMove = () => {
  if (!sudokuState.redoStack.length) return;
  const currentEntry = createSudokuHistoryEntry();
  const nextEntry = sudokuState.redoStack.pop();
  sudokuState.undoStack.push(currentEntry);
  applySudokuHistoryEntry(nextEntry);
};

const updateSudokuCellValue = (
  input,
  index,
  value,
  { clearEmptyNotes = false, recordHistory = true, autoAdvance = false } = {}
) => {
  if (!input || isSudokuCellReadOnly(input)) return;
  const digit = normalizeSudokuDigit(value);
  const previousValue = getSudokuCellValue(input);
  const willClearNotes =
    !digit && !previousValue && clearEmptyNotes && Boolean(getSudokuCellNotes(index));
  if (digit === previousValue && !willClearNotes) return;

  if (recordHistory) pushSudokuUndoState();
  hideSudokuSolvePopup();
  clearSudokuSolvedWave();
  if (sudokuState.playing) startSudokuTimer();
  if (willClearNotes) sudokuState.notes[index] = "";
  setSudokuCellValue(input, index, digit);
  syncSudokuCellFeedback(input, index);
  refreshSudokuHintFeedback();
  updateSudokuNumberButtons();
  updateSudokuHistoryButtons();
  sudokuState.solved = false;
  setSudokuStatus("Ready");
  scheduleSudokuSave();
  if (autoAdvance && digit) focusNextSudokuEditableCell(index);
};

const toggleSudokuNote = (cell, index, digit, { recordHistory = true } = {}) => {
  if (!cell || isSudokuCellReadOnly(cell) || !SUDOKU_DIGITS.includes(digit)) return;
  if (getSudokuCellValue(cell)) return;
  const notes = getSudokuCellNotes(index);
  const nextNotes = notes.includes(digit)
    ? notes.replace(digit, "")
    : normalizeSudokuNotes(`${notes}${digit}`);
  if (nextNotes === notes) return;

  if (recordHistory) pushSudokuUndoState();
  hideSudokuSolvePopup();
  clearSudokuSolvedWave();
  if (sudokuState.playing) startSudokuTimer();
  setSudokuCellNotes(cell, index, nextNotes);
  updateSudokuNumberButtons();
  updateSudokuHistoryButtons();
  sudokuState.solved = false;
  setSudokuStatus("Ready");
  scheduleSudokuSave();
};

const applySudokuDigitToCell = (cell, index, value) => {
  if (sudokuState.noteMode) {
    toggleSudokuNote(cell, index, value);
    return;
  }
  updateSudokuCellValue(cell, index, value, { autoAdvance: true });
};

const clearSudokuCellValueOrNotes = (cell, index) => {
  updateSudokuCellValue(cell, index, "", { clearEmptyNotes: true });
};

const applySudokuNumber = (value) => {
  const cells = sudokuCells();
  let cell = selectedSudokuCell();
  if (!cell || isSudokuCellReadOnly(cell)) {
    cell = cells.find((candidate) => !isSudokuCellReadOnly(candidate)) || null;
  }
  if (!cell || isSudokuCellReadOnly(cell)) return;
  const index = Number(cell.dataset.sudokuIndex);
  if (!Number.isInteger(index)) return;
  sudokuState.selectedIndex = index;
  selectSudokuCell(cell);
  if (value === "clear") clearSudokuCellValueOrNotes(cell, index);
  else applySudokuDigitToCell(cell, index, value);
  (selectedSudokuCell() || cell).focus();
};

const revealSudokuHint = () => {
  const cells = sudokuCells();
  let cell = selectedSudokuCell();
  if (
    !cell ||
    isSudokuCellReadOnly(cell) ||
    getSudokuCellValue(cell) === sudokuState.solution[sudokuState.selectedIndex]
  ) {
    cell =
      cells.find(
        (candidate, index) =>
          !isSudokuCellReadOnly(candidate) &&
          getSudokuCellValue(candidate) !== sudokuState.solution[index]
      ) || null;
  }
  if (!cell || isSudokuCellReadOnly(cell)) return false;
  const index = Number(cell.dataset.sudokuIndex);
  if (!Number.isInteger(index)) return false;
  sudokuState.selectedIndex = index;
  selectSudokuCell(cell);
  updateSudokuCellValue(cell, index, sudokuState.solution[index]);
  cell.focus();
  return true;
};

const setSudokuHintMode = (mode) => {
  if (mode === "reveal") {
    if (revealSudokuHint()) {
      sudokuState.usedHint = true;
      sudokuState.usedReveal = true;
      scheduleSudokuSave();
    }
    updateSudokuHintButtons();
    return;
  }
  if (mode === "errors") sudokuState.usedHint = true;
  sudokuState.hintMode = mode === "errors" ? "errors" : "off";
  updateSudokuHintButtons();
  refreshSudokuHintFeedback();
  setSudokuStatus("Ready");
  scheduleSudokuSave();
};

const setSudokuNoteMode = (enabled) => {
  sudokuState.noteMode = Boolean(enabled);
  updateSudokuNoteToggle();
  updateSudokuNumberButtons();
  scheduleSudokuSave();
};

const showSudokuAchievement = () => {
  if (!sudokuAchievement) return;
  sudokuAchievement.classList.remove("is-showing");
  void sudokuAchievement.offsetWidth;
  sudokuAchievement.classList.add("is-showing");
};

const triggerSudokuVictoryEffects = () => {
  if (isSudokuReducedMotion()) return;
  const effects = SUDOKU_WIN_EFFECTS[sudokuState.difficulty];
  if (!effects) return;
  showSudokuAchievement();
  if (effects.fireworks && !sudokuState.usedHint) solStartFireworks();
  if (effects.confetti) msStartConfetti();
};

const triggerSudokuSolvedTileWave = () => {
  const cells = sudokuCells();
  cells.forEach((cell) => {
    cell.classList.remove("is-solved-wave");
    cell.style.removeProperty("--sudoku-solve-delay");
  });
  void sudokuGrid?.offsetWidth;
  cells.forEach((cell, index) => {
    cell.style.setProperty("--sudoku-solve-delay", `${index * 28}ms`);
    cell.classList.add("is-solved-wave");
  });
};

const handleSudokuCellKeydown = (event, cell) => {
  const index = Number(cell?.dataset.sudokuIndex);
  if (!Number.isInteger(index)) return;
  const row = Math.floor(index / 9);
  const column = index % 9;
  const moves = {
    ArrowUp: Math.max(0, row - 1) * 9 + column,
    ArrowDown: Math.min(8, row + 1) * 9 + column,
    ArrowLeft: row * 9 + Math.max(0, column - 1),
    ArrowRight: row * 9 + Math.min(8, column + 1),
  };
  if (event.key in moves) {
    event.preventDefault();
    focusSudokuCell(moves[event.key]);
    return;
  }
  if (SUDOKU_DIGITS.includes(event.key)) {
    event.preventDefault();
    sudokuState.selectedIndex = index;
    selectSudokuCell(cell);
    applySudokuDigitToCell(cell, index, event.key);
    return;
  }
  if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
    event.preventDefault();
    sudokuState.selectedIndex = index;
    selectSudokuCell(cell);
    clearSudokuCellValueOrNotes(cell, index);
  }
};

const handleSudokuGridClick = (event) => {
  const cell = event.target.closest?.(".sudoku-cell");
  if (!cell || !sudokuGrid.contains(cell)) return;
  focusSudokuCell(Number(cell.dataset.sudokuIndex));
};

const handleSudokuGridFocus = (event) => {
  const cell = event.target.closest?.(".sudoku-cell");
  if (!cell || !sudokuGrid.contains(cell)) return;
  selectSudokuCell(cell);
};

const handleSudokuGridKeydown = (event) => {
  const cell = event.target.closest?.(".sudoku-cell");
  if (!cell || !sudokuGrid.contains(cell)) return;
  handleSudokuCellKeydown(event, cell);
};

const handleSudokuUndoRedoShortcut = (event) => {
  const isUndoKey = event.key === "z" || event.key === "Z";
  const isRedoKey = event.key === "y" || event.key === "Y";
  if (!isSudokuWindowVisible() || (!event.metaKey && !event.ctrlKey) || event.altKey) return;
  if (!isUndoKey && !isRedoKey) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.matches("input, textarea, select")) return;
  event.preventDefault();
  if (isRedoKey || event.shiftKey) redoSudokuMove();
  else undoSudokuMove();
};

const checkSudokuBoard = () => {
  const result = validateSudokuBoard({ mark: true });
  sudokuState.mistakes = result.mistakes;
  updateSudokuMistakesDisplay();
  if (!result.valid) {
    setSudokuStatus("System alert");
    return;
  }
  if (!result.complete) {
    triggerSudokuCheckBubbleBurst();
    setSudokuStatus("Ready");
    return;
  }
  setSudokuStatus("Solved");
  triggerSudokuFullBubbleBurst();
  triggerSudokuSolvedTileWave();
  showSudokuSolvePopup();
  pauseSudokuTimer();
  if (!sudokuState.solved) {
    sudokuState.solved = true;
    triggerSudokuVictoryEffects();
    triggerRandomEvents("gameWin", { game: "sudoku" });
    scheduleSudokuSave();
  }
};

const renderSudoku = () => {
  if (!sudokuGrid) return;
  sudokuGrid.replaceChildren();
  sudokuCellElements = [];
  sudokuGrid.setAttribute("role", "grid");
  const puzzle = sudokuState.puzzle.padEnd(SUDOKU_CELL_COUNT, "0").slice(0, SUDOKU_CELL_COUNT);
  sudokuState.puzzle = puzzle;
  sudokuState.solution = sudokuState.solution.padEnd(SUDOKU_CELL_COUNT, "0").slice(0, SUDOKU_CELL_COUNT);
  sudokuState.values = normalizeSudokuValues(sudokuState.values, puzzle);
  sudokuState.notes = normalizeSudokuNotesList(sudokuState.notes, puzzle);

  const fragment = document.createDocumentFragment();
  puzzle.split("").forEach((value, index) => {
    const cell = document.createElement("div");
    cell.className = "sudoku-cell";
    cell.tabIndex = 0;
    cell.value = "";
    cell.readOnly = false;
    cell.dataset.sudokuIndex = String(index);
    cell.setAttribute("role", "gridcell");

    const valueEl = document.createElement("span");
    valueEl.className = "sudoku-cell-value";
    const notesEl = document.createElement("span");
    notesEl.className = "sudoku-cell-notes";
    notesEl.setAttribute("aria-hidden", "true");
    cell._sudokuValueEl = valueEl;
    cell._sudokuNoteDigits = [];
    SUDOKU_DIGITS.split("").forEach(() => {
      const note = document.createElement("span");
      note.className = "sudoku-note-digit";
      cell._sudokuNoteDigits.push(note);
      notesEl.append(note);
    });
    cell.append(valueEl, notesEl);

    if (SUDOKU_DIGITS.includes(value)) {
      cell.readOnly = true;
      cell.classList.add("is-given");
      sudokuState.notes[index] = "";
    }
    setSudokuCellValue(cell, index, sudokuState.values[index]);
    syncSudokuCellFeedback(cell, index);
    sudokuCellElements[index] = cell;
    fragment.append(cell);
  });
  sudokuGrid.append(fragment);

  updateSudokuDifficultyButtons();
  updateSudokuHintButtons();
  refreshSudokuHintFeedback();
  selectSudokuCell(sudokuCellElements[sudokuState.selectedIndex] || null);
  updateSudokuHistoryButtons();
  updateSudokuTimeDisplay();
  setSudokuStatus(sudokuState.solved ? "Solved" : "Ready");
};

const loadSudokuDifficulty = (difficulty) => {
  const normalizedDifficulty = normalizeSudokuDifficulty(difficulty);
  const puzzle = SUDOKU_PUZZLES[normalizedDifficulty];
  const wasPlaying = sudokuState.playing;
  const previousHintMode = sudokuState.hintMode;
  const previousNoteMode = sudokuState.noteMode;
  const loadingTimerId = sudokuState.loadingTimerId;
  const transitionTimerId = sudokuState.transitionTimerId;
  const loadingStartedAt = sudokuState.loadingStartedAt;
  const loadingDuration = sudokuState.loadingDuration;
  const loadingProgress = sudokuState.loadingProgress;
  hideSudokuSolvePopup();
  pauseSudokuTimer();
  sudokuState = {
    difficulty: normalizedDifficulty,
    puzzle: puzzle.puzzle,
    solution: puzzle.solution,
    mistakes: 0,
    elapsedSeconds: 0,
    timerId: null,
    timerStartedAt: 0,
    loadingTimerId,
    transitionTimerId,
    loadingStartedAt,
    loadingDuration,
    loadingProgress,
    playing: wasPlaying,
    solved: false,
    usedHint: false,
    usedReveal: false,
    hintMode: previousHintMode,
    noteMode: previousNoteMode,
    values: normalizeSudokuValues("", puzzle.puzzle),
    notes: createSudokuEmptyNotes(),
    undoStack: [],
    redoStack: [],
    selectedIndex: -1,
  };
  renderSudoku();
  resetSudokuTimer();
  scheduleSudokuSave();
  if (isSudokuWindowVisible() && wasPlaying) startSudokuTimer();
};

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

const normalizeLifeCounterWindowWidth = (width) => {
  const columns = getLifeCounterWindowColumns(width);
  return getLifeCounterWindowWidthForColumns(columns);
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

const updateLifeCounterWidthControls = () => {
  const win = getLifeCounterWindow();
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

const formatLifeCounterDigits = (value) => {
  const normalized = normalizeLifeCounterValue(value);
  if (normalized < 0) {
    return `-${String(Math.abs(normalized)).padStart(4, "0")}`;
  }
  return String(normalized).padStart(5, "0");
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

const removeLifeCounterPlayer = (playerId) => {
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
      },
    ];
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
  lifeCounterPlayers.replaceChildren();

  lifeCounterPlayersState.forEach((player) => {
    const selectedStep = getLifeCounterSelectedStep(player);

    const card = document.createElement("section");
    card.className = "life-counter-player";
    card.dataset.playerId = String(player.id);

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
    card.append(header, total, setRow, controls);
    lifeCounterPlayers.append(card);
  });
};

const addLifeCounterPlayer = () => {
  const playerId = lifeCounterNextPlayerId++;
  lifeCounterPlayersState.push({
    id: playerId,
    name: `Player ${playerId}`,
    life: LIFE_COUNTER_STARTING_LIFE,
    selectedStep: 1,
  });
  renderLifeCounter();
};

const resetLifeCounterPlayers = () => {
  lifeCounterPlayersState.forEach((player) => {
    player.life = LIFE_COUNTER_STARTING_LIFE;
  });
  renderLifeCounter();
};

sudokuDifficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    loadSudokuDifficulty(button.dataset.sudokuDifficulty);
  });
});

sudokuNumberButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applySudokuNumber(button.dataset.sudokuNumber || "");
  });
});

sudokuHintButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSudokuHintMode(button.dataset.sudokuHint || "off");
  });
});

if (sudokuNoteToggle) {
  sudokuNoteToggle.addEventListener("click", () => {
    setSudokuNoteMode(!sudokuState.noteMode);
  });
}

if (sudokuUndo) {
  sudokuUndo.addEventListener("click", undoSudokuMove);
}

if (sudokuRedo) {
  sudokuRedo.addEventListener("click", redoSudokuMove);
}

if (sudokuNew) {
  sudokuNew.addEventListener("click", () => {
    loadSudokuDifficulty(sudokuState.difficulty);
  });
}

if (sudokuCheck) {
  sudokuCheck.addEventListener("click", checkSudokuBoard);
}

if (sudokuPlay) {
  sudokuPlay.addEventListener("click", startSudokuGameFromBoot);
}

if (sudokuGrid) {
  sudokuGrid.addEventListener("click", handleSudokuGridClick);
  sudokuGrid.addEventListener("focusin", handleSudokuGridFocus);
  sudokuGrid.addEventListener("keydown", handleSudokuGridKeydown);
}

document.addEventListener("keydown", handleSudokuUndoRedoShortcut);
document.addEventListener("visibilitychange", syncSudokuAquariumActivity);
window.addEventListener("focus", syncSudokuAquariumActivity);
window.addEventListener("blur", syncSudokuAquariumActivity);
if (sudokuReducedMotionMedia) {
  if (typeof sudokuReducedMotionMedia.addEventListener === "function") {
    sudokuReducedMotionMedia.addEventListener("change", syncSudokuAquariumActivity);
  } else if (typeof sudokuReducedMotionMedia.addListener === "function") {
    sudokuReducedMotionMedia.addListener(syncSudokuAquariumActivity);
  }
}

if (sudokuSolveOk) {
  sudokuSolveOk.addEventListener("click", hideSudokuSolvePopup);
}

if (sudokuSolvePopup) {
  sudokuSolvePopup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hideSudokuSolvePopup();
    }
  });
}

if (lifeCounterAddPlayer) {
  lifeCounterAddPlayer.addEventListener("click", addLifeCounterPlayer);
}

if (lifeCounterReset) {
  lifeCounterReset.addEventListener("click", resetLifeCounterPlayers);
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

restoreSudokuSavedState();
renderSudoku();
renderLifeCounter();
updateLifeCounterWidthControls();

initPortfolioCornerResize();
updateClock();
setInterval(updateClock, 1000 * 30);
updateCalendarClock();
setInterval(updateCalendarClock, 500);
window.addEventListener("beforeunload", () => {
  flushSudokuSave();
  saveSnakeHighScores();
  saveSnakeSettings();
  try {
    sessionStorage.setItem(RANDOM_EVENT_RELOAD_KEY, "true");
  } catch (error) {
    // Session storage can be disabled in some browsing modes.
  }
});

window.addEventListener("load", () => {
  let isReload = false;
  try {
    const navigationEntry = performance.getEntriesByType("navigation")[0];
    isReload = navigationEntry && navigationEntry.type === "reload";
  } catch (error) {
    isReload = false;
  }

  try {
    if (isReload && sessionStorage.getItem(RANDOM_EVENT_RELOAD_KEY) === "true") {
      setTimeout(() => {
        triggerRandomEvents("pageReload");
      }, 300);
    }
    sessionStorage.removeItem(RANDOM_EVENT_RELOAD_KEY);
  } catch (error) {
    // Ignore storage failures; the page should still load normally.
  }
});

scheduleRandomEventIdleTrigger();

appWindows.forEach((win) => {
  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      stopMediaPlayback(win);
      win.classList.remove("is-closing");
      win.classList.add("is-hidden");
    }
  });
});

const creditsFrames = [
  "assets/app-icons/ico/search_laptop_1.ico",
  "assets/app-icons/ico/search_laptop_2.ico",
  "assets/app-icons/ico/search_laptop_3.ico",
  "assets/app-icons/ico/search_laptop_4.ico",
];

creditsIcons.forEach((icon) => {
  let frameIndex = 0;
  let intervalId = null;
  const startAnimation = () => {
    if (intervalId) return;
    intervalId = setInterval(() => {
      frameIndex = (frameIndex + 1) % creditsFrames.length;
      icon.setAttribute("src", creditsFrames[frameIndex]);
    }, 140);
  };
  const stopAnimation = () => {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
    frameIndex = 0;
    icon.setAttribute("src", creditsFrames[0]);
  };

  icon.addEventListener("mouseenter", startAnimation);
  icon.addEventListener("mouseleave", stopAnimation);
  icon.addEventListener("focus", startAnimation);
  icon.addEventListener("blur", stopAnimation);
});

document.querySelectorAll(".portfolio-window").forEach((windowEl) => {
  const selectorButtons = windowEl.querySelectorAll(".selector-item");
  const selectorPanel = windowEl.querySelector(".selector-panel");
  const divider = windowEl.querySelector(".panel-divider");

  selectorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const viewId = button.getAttribute("data-view");
      if (!viewId) return;

      selectWindowTab(windowEl, viewId);
      activateVisibleContent(windowEl);
    });
  });

  if (divider && selectorPanel) {
    divider.addEventListener("pointerdown", (event) => {
      const body = windowEl.querySelector(".window-body");
      if (!body) return;
      if (event.button !== 0 && event.pointerType !== "touch") return;
      event.preventDefault();
      const bodyRect = body.getBoundingClientRect();
      const startX = event.clientX;
      const startWidth = selectorPanel.getBoundingClientRect().width;
      const minWidth = 200;
      const maxWidth = Math.max(minWidth, Math.min(420, bodyRect.width - 220));

      divider.setPointerCapture(event.pointerId);

      const onMove = (moveEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(minWidth, Math.min(startWidth + delta, maxWidth));
        selectorPanel.style.width = `${nextWidth}px`;
        selectorPanel.style.flexBasis = `${nextWidth}px`;
      };

      const onUp = (upEvent) => {
        if (divider.hasPointerCapture(upEvent.pointerId)) {
          divider.releasePointerCapture(upEvent.pointerId);
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
  }
});

const pathfinderImages = [
  "assets/creative-work/pathfinder-logo.png",
  "assets/creative-work/pathfinder-cad.png",
  "assets/creative-work/pathfinder-new-trash.png",
  "assets/creative-work/pathfinder-perso%20n.png",
];
const pathfinderImage = document.getElementById("pathfinder-image");
const pathfinderPrev = document.getElementById("pathfinder-prev");
const pathfinderCounter = document.getElementById("pathfinder-counter");
const pathfinderNext = document.getElementById("pathfinder-next");
let pathfinderIndex = 0;

const berserkPosterImages = [
  "assets/creative-work/berserk-poster-redesign/magazine%20cover.png",
  "assets/creative-work/berserk-poster-redesign/watercolor%20poster.png",
  "assets/creative-work/berserk-poster-redesign/BW.png",
  "assets/creative-work/berserk-poster-redesign/BW%20paintbrush.png",
  "assets/creative-work/berserk-poster-redesign/black%20cyberpunk.png",
  "assets/creative-work/berserk-poster-redesign/yellow%20cyberpunk%20griffith.png",
];
const berserkPosterImage = document.getElementById("berserk-poster-image");
const berserkPosterPrev = document.getElementById("berserk-poster-prev");
const berserkPosterCounter = document.getElementById("berserk-poster-counter");
const berserkPosterNext = document.getElementById("berserk-poster-next");
let berserkPosterIndex = 0;

const myBrothersGhostImages = [
  {
    src: "assets/creative-work/my-brothers-ghost-01.jpg",
    caption: "In production 2026",
    alt: "My Brother's Ghost in production 2026 poster",
  },
  {
    src: "assets/creative-work/my-brothers-ghost-02.jpg",
    caption: "Two brothers reconnect in a haunted apartment",
    alt: "My Brother's Ghost haunted apartment poster",
  },
  {
    src: "assets/creative-work/my-brothers-ghost-03.jpg",
    caption: "Rohin Shanker is Ghost",
    alt: "Rohin Shanker is Ghost poster",
  },
];
const myBrothersGhostImage = document.getElementById("my-brothers-ghost-image");
const myBrothersGhostPrev = document.getElementById("my-brothers-ghost-prev");
const myBrothersGhostCounter = document.getElementById("my-brothers-ghost-counter");
const myBrothersGhostNext = document.getElementById("my-brothers-ghost-next");
let myBrothersGhostIndex = 0;

const frontiersPdfSlides = [
  {
    page: 4,
    src: "assets/writing/mec-slides/mec-page-4.png",
    alt: "Microbial Edge Computing slide 4",
  },
  {
    page: 5,
    src: "assets/writing/mec-slides/mec-page-5.png",
    alt: "Microbial Edge Computing slide 5",
  },
];
const frontiersSlideImage = document.getElementById("frontiers-slide-image");
const frontiersSlidePrev = document.getElementById("frontiers-slide-prev");
const frontiersSlideCounter = document.getElementById("frontiers-slide-counter");
const frontiersSlideNext = document.getElementById("frontiers-slide-next");
let frontiersSlideIndex = 0;

const galleryCounterText = (index, total) => `${index + 1} of ${total}`;

const bindGalleryNavigation = (previous, next, itemCount, getIndex, setIndex, update) => {
  if (!previous || !next || !itemCount) return;

  const move = (offset) => {
    setIndex((getIndex() + offset + itemCount) % itemCount);
    update();
  };

  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
};

const setupGalleryControlLabels = (root = document) => {
  root.querySelectorAll(".gallery-controls button").forEach((button) => {
    const label = button.textContent.trim();
    const isPrevious = /^prev/i.test(label);
    button.dataset.fullLabel = label;
    button.dataset.shortLabel = isPrevious ? "Prev" : "Next";
    button.dataset.iconLabel = isPrevious ? "‹" : "›";
    if (!button.hasAttribute("aria-label")) {
      button.setAttribute("aria-label", isPrevious ? "Previous item" : "Next item");
    }
  });
};

const modelingLinkIconPaths = {
  website: "assets/app-icons/ico/msie1.ico",
  instagram: "assets/social-icons/instagram-icon.png",
  camera: "assets/app-icons/ico/camera.ico",
  paintOld: "assets/app-icons/ico/paint_old.ico",
  pcxAlt: "assets/app-icons/ico/pcx_alt.ico",
};

const modelingBrandLinks = {
  standstill: [
    {
      type: "website",
      label: "Standstill website",
      href: "https://linktr.ee/standstill.ss",
    },
    {
      type: "instagram",
      label: "Standstill Instagram",
      href: "https://www.instagram.com/standstill.us/",
    },
  ],
  garb: [
    {
      type: "website",
      label: "Garb website",
      href: "https://www.berkeleygarb.com/",
    },
    {
      type: "instagram",
      label: "Garb Instagram",
      href: "https://www.instagram.com/garbberkeley/",
    },
  ],
  clubRambutan: [
    {
      type: "website",
      label: "Club Rambutan website",
      href: "https://www.clubrambutan.com/",
    },
    {
      type: "instagram",
      label: "Club Rambutan Instagram",
      href: "https://www.instagram.com/club.rambutan/",
    },
  ],
  arthaus: [
    {
      type: "website",
      label: "ArtHaus website",
      href: "https://arthaus.mov/",
    },
    {
      type: "instagram",
      label: "ArtHaus Instagram",
      href: "https://www.instagram.com/arthaus.living/",
    },
  ],
  brainscramble: [
    {
      type: "website",
      label: "BrainScramble website",
      href: "https://thebrainscramble.com/",
    },
    {
      type: "instagram",
      label: "BrainScramble Berkeley Instagram",
      href: "https://www.instagram.com/brainscrambleberkeley/",
    },
  ],
  fast: [
    {
      type: "website",
      label: "FAST at Cal website",
      href: "https://bit.ly/m/FASTCal",
    },
    {
      type: "instagram",
      label: "FAST at Cal Instagram",
      href: "https://www.instagram.com/fastcal/",
    },
  ],
  saturnLosAngeles: [
    {
      type: "website",
      label: "Saturn Los Angeles website",
      href: "https://www.saturnlosangeles.com/",
    },
    {
      type: "instagram",
      label: "Saturn Los Angeles Instagram",
      href: "https://www.instagram.com/saturnlosangeles/",
    },
  ],
  vampireShoot: [
    {
      type: "camera",
      label: "Ryan Photo Collection Instagram",
      href: "https://www.instagram.com/ryanphotocollection/",
    },
    {
      type: "paintOld",
      label: "Beauty by 3mm4 Instagram",
      href: "https://www.instagram.com/beautyby3mm4/",
      title: "Beauty Instagram",
    },
  ],
};

const modelingLinkData = {
  "modeling-stand-still-drop": [
    ...modelingBrandLinks.standstill,
    {
      type: "pcxAlt",
      label: "Sebastian Ng Instagram",
      href: "https://www.instagram.com/sebastianrng/",
      title: "Designer Instagram",
    },
  ],
  "modeling-garb-merch-promo-shoot": modelingBrandLinks.garb,
  "modeling-garb-cirque-du-moi-runway-show": [
    ...modelingBrandLinks.garb,
    {
      type: "pcxAlt",
      label: "Zack Dell Instagram",
      href: "https://www.instagram.com/eigenzack/",
      title: "Designer Instagram",
    },
  ],
  "modeling-garb-garbage-runway-show-oct2025": [
    ...modelingBrandLinks.garb,
    {
      type: "pcxAlt",
      label: "Miriam Klaczynska Instagram",
      href: "https://www.instagram.com/sleepymiriam/",
      title: "Designer Instagram",
    },
  ],
  "modeling-club-rambutan-runway-show": [
    ...modelingBrandLinks.clubRambutan,
    {
      type: "instagram",
      label: "Club Rambutan runway post",
      href: "https://www.instagram.com/p/DQCyVvDkhhr/",
    },
    {
      type: "pcxAlt",
      label: "Datou designer website",
      href: "https://datou.online/",
      title: "Designer Website",
    },
  ],
  "modeling-arthaus-promo-shoot": modelingBrandLinks.arthaus,
  "modeling-xoxo510-x-brainscramble-shoot": [
    ...modelingBrandLinks.brainscramble,
    {
      type: "instagram",
      label: "XOXO510 Instagram",
      href: "https://www.instagram.com/xoxo510/",
    },
    {
      type: "camera",
      label: "Tressa Davies Instagram",
      href: "https://www.instagram.com/tressatookthis/",
      title: "Photographer Instagram",
    },
  ],
  "modeling-fast-sonder-lookbook-shoot-2": [
    ...modelingBrandLinks.fast,
    {
      type: "pcxAlt",
      label: "Pauper Co Instagram",
      href: "https://www.instagram.com/pauperco/",
      title: "Designer Instagram",
    },
    {
      type: "camera",
      label: "Charlize Chiu Instagram",
      href: "https://www.instagram.com/charlize.chiu/",
      title: "Photographer Instagram",
    },
    {
      type: "paintOld",
      label: "Miranda makeup Instagram",
      href: "https://www.instagram.com/makeup._.miranda/",
      title: "Beauty Instagram",
    },
  ],
  "modeling-fast-sonder-lookbook-shoot": [
    ...modelingBrandLinks.fast,
    {
      type: "camera",
      label: "Charlize Chiu Instagram",
      href: "https://www.instagram.com/charlize.chiu/",
      title: "Photographer Instagram",
    },
  ],
  "modeling-saturn-los-angeles-gaia-ss25-shoot": [
    ...modelingBrandLinks.saturnLosAngeles,
    {
      type: "pcxAlt",
      label: "Ryan Cheung Instagram",
      href: "https://www.instagram.com/rcheungus/",
      title: "Designer Instagram",
    },
  ],
  "modeling-garb-garbage-runway-show": [
    ...modelingBrandLinks.garb,
    {
      type: "pcxAlt",
      label: "Kailey Espinoza Instagram",
      href: "https://www.instagram.com/kaileyespnza/",
      title: "Designer Instagram",
    },
  ],
  "modeling-garb-means-business-shoot": modelingBrandLinks.garb,
  "modeling-vampire-shoot": modelingBrandLinks.vampireShoot,
  "modeling-garb-garbage-runway": modelingBrandLinks.garb,
  "modeling-fast-crescendo-lookbook-shoot-2": [
    ...modelingBrandLinks.fast,
    {
      type: "camera",
      label: "Charlize Chiu Instagram",
      href: "https://www.instagram.com/charlize.chiu/",
      title: "Photographer Instagram",
    },
  ],
  "modeling-fast-crescendo-lookbook-shoot": [
    ...modelingBrandLinks.fast,
    {
      type: "camera",
      label: "Ryan Photo Collection Instagram",
      href: "https://www.instagram.com/ryanphotocollection/",
      title: "Photographer Instagram",
    },
    {
      type: "camera",
      label: "Will Yau photos",
      href: "https://wyauphoto.mypixieset.com/",
      title: "Photographer Portfolio",
    },
  ],
  "modeling-fast-reverie-runway-show": [
    ...modelingBrandLinks.fast,
    {
      type: "camera",
      label: "Fin Pimnara Instagram",
      href: "https://www.instagram.com/fintakesphotos/",
    },
  ],
  "modeling-fast-reverie-lookbook-shoot": [
    ...modelingBrandLinks.fast,
    {
      type: "camera",
      label: "Agodi Instagram",
      href: "https://www.instagram.com/agodi.png/",
      title: "Photographer Instagram",
    },
  ],
  "modeling-fast-devotion-lookbook-shoot": [
    ...modelingBrandLinks.fast,
    {
      type: "camera",
      label: "Julianne Han photos",
      href: "https://juliannehan.cargo.site/",
      title: "Photos",
    },
  ],
  "modeling-saturn-la-black-friday-drop": [
    ...modelingBrandLinks.saturnLosAngeles,
    {
      type: "pcxAlt",
      label: "Ryan Cheung Instagram",
      href: "https://www.instagram.com/rcheungus/",
      title: "Designer Instagram",
    },
    {
      type: "camera",
      label: "Flickz by Fredo photos",
      href: "https://flickzbyfredo.mypixieset.com/",
      title: "Photos",
    },
  ],
};

const modelingGallery = (folder, filenames = [], type = "images", options = {}) => ({
  folder,
  [type]: filenames.map((filename) => `${folder}/${filename}`),
  ...options,
});

const modelingGalleryData = {
  "modeling-stand-still-drop": modelingGallery(
    "assets/modeling/stand-still-mar26",
    [
      "1.mp4",
      "2.jpg",
      "3.jpg",
      "4.jpg",
      "5.jpg",
      "6.jpg",
    ],
    "media",
    { autoplay: true }
  ),
  "modeling-garb-merch-promo-shoot": modelingGallery(
    "assets/modeling/garb-merch-lighter-promo-feb26",
    [
      "2.jpg",
      "1.jpg",
    ]
  ),
  "modeling-garb-cirque-du-moi-runway-show": modelingGallery(
    "assets/modeling/garb-cirque-du-moi-rnwy-dec2025",
    [
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.jpg",
      "5.jpg",
    ]
  ),
  "modeling-garb-garbage-runway-show-oct2025": modelingGallery(
    "assets/modeling/garb-garbage-rnwy-oct2025",
    [
      "1.jpg",
      "2.jpg",
      "3.JPG",
      "4.jpg",
      "5.jpg",
      "6.jpg",
      "7.jpg",
      "8.JPG",
    ]
  ),
  "modeling-club-rambutan-runway-show": modelingGallery(
    "assets/modeling/club-rambutan-runway-show",
    [
      "01-rambutan-photo.jpg",
      "02-rambutan-photo.jpg",
      "03-rambutan-photo.jpg",
      "04-rambutan-photo.jpg",
      "05-rambutan-photo.jpg",
      "06-rambutan-photo.jpg",
    ]
  ),
  "modeling-arthaus-promo-shoot": modelingGallery(
    "assets/modeling/arthaus-promo-shoot-sep25",
    [
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.jpg",
      "5.jpg",
      "6.jpg",
    ]
  ),
  "modeling-xoxo510-x-brainscramble-shoot": modelingGallery(
    "assets/modeling/xoxo510-brainscramble",
    [
      "01-brainscramble-photo.jpg",
      "02-brainscramble-photo.jpg",
      "03-brainscramble-photo.jpg",
      "04-brainscramble-photo.jpg",
      "05-brainscramble-photo.jpg",
      "06-brainscramble-photo.jpg",
      "07-brainscramble-photo.jpg",
      "08-brainscramble-photo.jpg",
      "09-brainscramble-photo.jpg",
      "10-brainscramble-photo.jpg",
    ]
  ),
  "modeling-fast-sonder-lookbook-shoot-2": modelingGallery(
    "assets/modeling/fast-sonder-lb2-may2025",
    [
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.jpg",
      "5.png",
      "6.jpg",
      "7.jpg",
      "8.jpg",
      "9.jpg",
      "10.jpg",
      "11.jpg",
      "12.jpg",
    ]
  ),
  "modeling-fast-sonder-lookbook-shoot": modelingGallery(
    "assets/modeling/fast-sonder-lb-may2025",
    [
      "1.JPG",
      "2.JPG",
      "3.JPG",
      "4.JPG",
      "5.JPG",
      "6.JPG",
      "7.JPG",
      "8.JPG",
      "9.JPG",
      "11.JPG",
      "12.JPG",
      "13.JPG",
    ]
  ),
  "modeling-saturn-los-angeles-gaia-ss25-shoot": modelingGallery(
    "assets/modeling/saturn-LA-gaia-apr2025",
    [
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.jpg",
      "5.jpg",
      "6.jpg",
      "7.jpg",
    ]
  ),
  "modeling-garb-garbage-runway-show": modelingGallery(
    "assets/modeling/garb-garbage-rnwy-apr2025",
    [
      "1.JPEG",
      "2.jpeg",
      "3.jpeg",
      "4.jpeg",
    ]
  ),
  "modeling-garb-means-business-shoot": modelingGallery(
    "assets/modeling/garb-means-business-jan2025",
    [
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.JPG",
      "5.JPG",
      "6.jpg",
      "7.JPG",
      "8.JPG",
      "9.jpg",
    ]
  ),
  "modeling-vampire-shoot": modelingGallery("assets/modeling/vampire-shoot-jan2025", [
    "01-vampire-photo.jpg",
    "02-vampire-photo.jpg",
    "03-vampire-photo.jpg",
    "04-vampire-photo.jpg",
    "05-vampire-photo.jpg",
    "06-vampire-photo.jpg",
    "07-vampire-photo.jpg",
    "08-vampire-photo.jpg",
    "09-vampire-photo.jpg",
    "10-vampire-photo.jpg",
    "11-vampire-photo.jpg",
    "12-vampire-photo.jpg",
    "13-vampire-photo.jpg",
    "14-vampire-photo.jpg",
    "15-vampire-photo.jpg",
    "16-vampire-photo.jpg",
  ]),
  "modeling-garb-garbage-runway": modelingGallery(
    "assets/modeling/garb-garbage-rnwy-dec2024",
    [
      "0.JPEG",
      "1.JPEG",
      "2.JPEG",
      "3.JPEG",
      "3-5.JPEG",
      "4.JPEG",
      "5.JPEG",
      "6.JPEG",
      "6-5.JPEG",
      "7.JPEG",
      "8.JPEG",
      "9.JPEG",
      "10.JPEG",
    ]
  ),
  "modeling-fast-crescendo-lookbook-shoot-2": modelingGallery(
    "assets/modeling/fast-crescendo2-lb-oct2024",
    [
      "IMG_0369.jpg",
      "IMG_0370.jpg",
      "IMG_0371.jpg",
      "IMG_0372.jpg",
      "IMG_0373.jpg",
      "IMG_0374.jpg",
      "IMG_0375.jpg",
      "IMG_0376.jpg",
      "IMG_0377.jpg",
      "IMG_0378.jpg",
    ]
  ),
  "modeling-fast-crescendo-lookbook-shoot": modelingGallery(
    "assets/modeling/fast-crescendo-lb-oct2024",
    [
      "01-crescendo-photo.jpg",
      "02-crescendo-photo.jpg",
      "03-crescendo-photo.jpg",
      "04-crescendo-photo.jpg",
      "05-crescendo-photo.jpg",
      "06-crescendo-photo.jpg",
      "07-crescendo-photo.jpg",
      "08-crescendo-photo.jpg",
      "09-crescendo-photo.jpg",
      "10-crescendo-photo.jpg",
      "11-crescendo-photo.jpg",
    ]
  ),
  "modeling-fast-reverie-runway-show": modelingGallery(
    "assets/modeling/fast-reverie-rnwy-apr2024",
    [
      "01-runway-video.mp4",
      "02-runway-photo.jpg",
      "03-runway-photo.jpg",
      "04-runway-photo.jpg",
      "05-runway-photo.png",
    ],
    "media"
  ),
  "modeling-fast-reverie-lookbook-shoot": modelingGallery(
    "assets/modeling/fast-reverie-lb-mar2024",
    [
      "01-reverie-photo.jpg",
      "02-reverie-photo.jpg",
      "03-reverie-photo.jpg",
      "04-reverie-photo.jpg",
    ]
  ),
  "modeling-fast-devotion-lookbook-shoot": modelingGallery(
    "assets/modeling/fast-devotion-lb-nov2023",
    [
      "IMG_0327.jpg",
      "IMG_0328.jpg",
      "IMG_0329.jpg",
      "IMG_0330.jpg",
      "IMG_0331.jpg",
      "IMG_0333.jpg",
      "IMG_0334.jpg",
      "IMG_0335.jpg",
      "IMG_0332.jpg",
    ]
  ),
  "modeling-saturn-la-black-friday-drop": modelingGallery(
    "assets/modeling/saturn-LA-oct2023",
    [
      "IMG_9695.jpg",
      "IMG_9696.jpg",
      "IMG_9697.jpg",
      "IMG_9698.jpg",
      "IMG_9699.jpg",
      "IMG_9700.jpg",
      "IMG_9701.jpg",
      "IMG_9702.jpg",
      "IMG_9703.jpg",
      "IMG_9704.jpg",
      "IMG_9705.jpg",
      "IMG_9706.jpg",
    ]
  ),
};

const renderModelingLinks = (container) => {
  if (container.dataset.rendered === "true") return;
  const linkId = container.getAttribute("data-modeling-links");
  const links = modelingLinkData[linkId] || [];

  if (!links.length) {
    container.replaceChildren();
    container.dataset.rendered = "true";
    return;
  }

  const row = document.createElement("div");
  row.className = "lp-link-row";
  row.setAttribute("aria-label", "Modeling project links");

  links.forEach(({ type, label, href, title }) => {
    const anchor = document.createElement("a");
    anchor.className = "lp-link";
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.setAttribute("aria-label", label);
    anchor.title =
      title || (type === "instagram" ? "Instagram" : "Website");

    const icon = document.createElement("img");
    icon.src = modelingLinkIconPaths[type] || modelingLinkIconPaths.website;
    icon.alt = "";

    anchor.appendChild(icon);
    row.appendChild(anchor);
  });

  container.replaceChildren(row);
  container.dataset.rendered = "true";
};

const renderModelingGallery = (container) => {
  if (container.dataset.rendered === "true") return;
  const galleryId = container.getAttribute("data-modeling-gallery");
  const gallery = modelingGalleryData[galleryId];
  if (!gallery) return;
  const media = gallery.media || gallery.images;

  const frame = document.createElement("div");
  frame.className = "gallery-frame";

  if (!media.length) {
    const empty = document.createElement("div");
    empty.className = "gallery-empty";
    empty.textContent = `No images found in ${gallery.folder} yet.`;
    frame.appendChild(empty);
    container.replaceChildren(frame);
    container.dataset.rendered = "true";
    return;
  }

  let currentIndex = 0;
  const scroll = document.createElement("div");
  scroll.className = "gallery-scroll gallery-scroll--modeling";

  const controls = document.createElement("div");
  controls.className = "gallery-controls";

  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "Previous";

  const counter = document.createElement("span");
  counter.className = "gallery-counter";
  counter.setAttribute("aria-live", "polite");

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next";

  controls.appendChild(previous);
  controls.appendChild(counter);
  controls.appendChild(next);
  frame.appendChild(scroll);
  frame.appendChild(controls);
  container.replaceChildren(frame);

  const update = () => {
    const previousVideo = scroll.querySelector("video");
    if (previousVideo) {
      previousVideo.pause();
      previousVideo.removeAttribute("src");
      previousVideo.load();
    }

    const source = media[currentIndex];
    const isVideo = /\.(mp4|webm|ogg)(?:[?#]|$)/i.test(source);
    const currentMedia = document.createElement(isVideo ? "video" : "img");
    currentMedia.src = source;

    if (isVideo) {
      currentMedia.controls = true;
      currentMedia.playsInline = true;
      currentMedia.preload = "metadata";
      currentMedia.dataset.unloadOnHide = "";
      if (gallery.autoplay) {
        currentMedia.autoplay = true;
        currentMedia.dataset.autoplayOnActive = "";
      }
      currentMedia.setAttribute(
        "aria-label",
        `Modeling video ${galleryCounterText(currentIndex, media.length)}`
      );
    } else {
      currentMedia.loading = "lazy";
      currentMedia.decoding = "async";
      currentMedia.alt = `Modeling photo ${galleryCounterText(currentIndex, media.length)}`;
    }

    scroll.replaceChildren(currentMedia);
    counter.textContent = galleryCounterText(currentIndex, media.length);
    if (gallery.autoplay && isVideo) playMediaElement(currentMedia);
  };

  bindGalleryNavigation(
    previous,
    next,
    media.length,
    () => currentIndex,
    (index) => {
      currentIndex = index;
    },
    update
  );

  update();
  container.dataset.rendered = "true";
  setupGalleryControlLabels(container);
};

setupGalleryControlLabels();

const updatePathfinderImage = () => {
  if (!pathfinderImage) return;
  pathfinderImage.setAttribute("src", pathfinderImages[pathfinderIndex]);
  if (pathfinderCounter) {
    pathfinderCounter.textContent = galleryCounterText(pathfinderIndex, pathfinderImages.length);
  }
};

const updateBerserkPosterImage = () => {
  if (!berserkPosterImage) return;
  berserkPosterImage.setAttribute("src", berserkPosterImages[berserkPosterIndex]);
  berserkPosterImage.setAttribute(
    "alt",
    `Berserk poster redesign ${berserkPosterIndex + 1}`
  );
  if (berserkPosterCounter) {
    berserkPosterCounter.textContent = galleryCounterText(
      berserkPosterIndex,
      berserkPosterImages.length
    );
  }
};

const updateMyBrothersGhostImage = () => {
  if (!myBrothersGhostImage) return;
  const activeImage = myBrothersGhostImages[myBrothersGhostIndex];
  myBrothersGhostImage.setAttribute("src", activeImage.src);
  myBrothersGhostImage.setAttribute("alt", activeImage.alt);
  if (myBrothersGhostCounter) {
    myBrothersGhostCounter.textContent = galleryCounterText(
      myBrothersGhostIndex,
      myBrothersGhostImages.length
    );
  }
};

const updateFrontiersSlide = () => {
  if (!frontiersSlideImage || !frontiersPdfSlides.length) return;
  const activeSlide = frontiersPdfSlides[frontiersSlideIndex];
  frontiersSlideImage.setAttribute("src", activeSlide.src);
  frontiersSlideImage.setAttribute("alt", activeSlide.alt);
  if (frontiersSlideCounter) {
    frontiersSlideCounter.textContent = galleryCounterText(
      frontiersSlideIndex,
      frontiersPdfSlides.length
    );
  }
};

const updatePulseProjectFigure = () => {
  if (!pulseProjectImage || !pulseProjectFigures.length) return;
  const activeFigure = pulseProjectFigures[pulseProjectIndex];
  pulseProjectImage.dataset.src = activeFigure.src;
  pulseProjectImage.setAttribute("src", activeFigure.src);
  pulseProjectImage.setAttribute("alt", activeFigure.alt);
  if (pulseProjectCaption) {
    pulseProjectCaption.textContent = activeFigure.title;
  }
  if (pulseProjectDescription) {
    pulseProjectDescription.textContent = activeFigure.description;
  }
  if (pulseProjectCounter) {
    pulseProjectCounter.textContent = galleryCounterText(
      pulseProjectIndex,
      pulseProjectFigures.length
    );
  }
};

const updateTcpResultFigure = () => {
  if (!tcpResultsImage || !tcpResultFigures.length) return;
  const activeFigure = tcpResultFigures[tcpResultsIndex];
  tcpResultsImage.dataset.src = activeFigure.src;
  tcpResultsImage.setAttribute("src", activeFigure.src);
  tcpResultsImage.setAttribute("alt", activeFigure.alt);
  if (tcpResultsCaption) {
    tcpResultsCaption.textContent = activeFigure.title;
  }
  if (tcpResultsDescription) {
    tcpResultsDescription.textContent = activeFigure.description;
  }
  if (tcpResultsCounter) {
    tcpResultsCounter.textContent = galleryCounterText(
      tcpResultsIndex,
      tcpResultFigures.length
    );
  }
};

const syncDroneProjectVideo = () => {
  if (!droneProjectVideo || !droneProjectVideos.length) return;
  const activeVideo = droneProjectVideos[droneVideoIndex];
  if (!activeVideo) return;

  droneProjectVideo.dataset.src = activeVideo.src;
  if (droneProjectVideo.getAttribute("src") !== activeVideo.src) {
    droneProjectVideo.pause();
    droneProjectVideo.setAttribute("src", activeVideo.src);
    droneProjectVideo.load();
  }

  droneProjectVideo.setAttribute("aria-label", activeVideo.title);

  if (droneVideoCaption) {
    droneVideoCaption.textContent = activeVideo.title;
  }
  if (droneVideoCounter) {
    droneVideoCounter.textContent = galleryCounterText(
      droneVideoIndex,
      droneProjectVideos.length
    );
  }
};

activateVisibleContent = (root) => {
  if (!root) return;
  loadDeferredMedia(root, true);

  root.querySelectorAll("[data-modeling-links]").forEach((container) => {
    if (!container.closest(".viewer-content.is-hidden")) {
      renderModelingLinks(container);
    }
  });

  root.querySelectorAll("[data-modeling-gallery]").forEach((container) => {
    if (!container.closest(".viewer-content.is-hidden")) {
      renderModelingGallery(container);
    }
  });

  const dronePanel = root.querySelector(
    '[data-view="projects-drone-navigation"]:not(.is-hidden)'
  );
  if (dronePanel && droneProjectVideo && dronePanel.contains(droneProjectVideo)) {
    syncDroneProjectVideo();
  }

  playActiveAutoplayVideos(root);
};

bindGalleryNavigation(
  pathfinderPrev,
  pathfinderNext,
  pathfinderImages.length,
  () => pathfinderIndex,
  (index) => {
    pathfinderIndex = index;
  },
  updatePathfinderImage
);

bindGalleryNavigation(
  berserkPosterPrev,
  berserkPosterNext,
  berserkPosterImages.length,
  () => berserkPosterIndex,
  (index) => {
    berserkPosterIndex = index;
  },
  updateBerserkPosterImage
);

bindGalleryNavigation(
  myBrothersGhostPrev,
  myBrothersGhostNext,
  myBrothersGhostImages.length,
  () => myBrothersGhostIndex,
  (index) => {
    myBrothersGhostIndex = index;
  },
  updateMyBrothersGhostImage
);

bindGalleryNavigation(
  frontiersSlidePrev,
  frontiersSlideNext,
  frontiersPdfSlides.length,
  () => frontiersSlideIndex,
  (index) => {
    frontiersSlideIndex = index;
  },
  updateFrontiersSlide
);

bindGalleryNavigation(
  pulseProjectPrev,
  pulseProjectNext,
  pulseProjectFigures.length,
  () => pulseProjectIndex,
  (index) => {
    pulseProjectIndex = index;
  },
  updatePulseProjectFigure
);

bindGalleryNavigation(
  tcpResultsPrev,
  tcpResultsNext,
  tcpResultFigures.length,
  () => tcpResultsIndex,
  (index) => {
    tcpResultsIndex = index;
  },
  updateTcpResultFigure
);

bindGalleryNavigation(
  droneVideoPrev,
  droneVideoNext,
  droneProjectVideos.length,
  () => droneVideoIndex,
  (index) => {
    droneVideoIndex = index;
  },
  syncDroneProjectVideo
);

if (openFrontiersPdf) {
  openFrontiersPdf.addEventListener("click", () => {
    setWindowOpen("mec-pdf", true);
  });
}

if (openBioe190Presentation) {
  openBioe190Presentation.addEventListener("click", () => {
    setWindowOpen("bioe190-presentation-pdf", true);
  });
}

if (openBioe190Proposal) {
  openBioe190Proposal.addEventListener("click", () => {
    setWindowOpen("bioe190-proposal-pdf", true);
  });
}

if (openPulsePresentation) {
  openPulsePresentation.addEventListener("click", () => {
    if (
      pulsePresentationIframe &&
      pulsePresentationIframe.dataset.src !== PULSE_PRESENTATION_PDF_URL
    ) {
      pulsePresentationIframe.dataset.src = PULSE_PRESENTATION_PDF_URL;
      pulsePresentationIframe.removeAttribute("src");
    }
    setWindowOpen("pulse-presentation-pdf", true);
  });
}

if (openDronePresentation) {
  openDronePresentation.addEventListener("click", () => {
    if (
      dronePresentationIframe &&
      dronePresentationIframe.dataset.src !== DRONE_PRESENTATION_PDF_URL
    ) {
      dronePresentationIframe.dataset.src = DRONE_PRESENTATION_PDF_URL;
      dronePresentationIframe.removeAttribute("src");
    }
    setWindowOpen("drone-presentation-pdf", true);
  });
}

if (openTcpPaper) {
  openTcpPaper.addEventListener("click", () => {
    setWindowOpen("tcp-paper-pdf", true);
  });
}

if (openWritingTcpPaper) {
  openWritingTcpPaper.addEventListener("click", () => {
    setWindowOpen("tcp-paper-pdf", true);
  });
}

if (openTcpPresentation) {
  openTcpPresentation.addEventListener("click", () => {
    setWindowOpen("tcp-presentation-pdf", true);
  });
}

const STUDY_ICONS = {
  folderClosed: "assets/app-icons/ico/directory_closed.ico",
  folderOpen: "assets/app-icons/ico/directory_open.ico",
  document: "assets/app-icons/ico/document.ico",
};
const STUDY_MANIFEST_URL = "assets/study%20resources/manifest.json";

const studyResourcesRoot = {
  id: "study-resources",
  type: "folder",
  name: "Study Resources",
  // Future PDFs should live under assets/study resources/{school}/{type}/{course}/{resource}.pdf.
  children: [
    {
      id: "uc-berkeley",
      type: "folder",
      name: "UC Berkeley",
      children: [
    {
      id: "bioeng",
      type: "folder",
      name: "BIOENG",
      children: [
        { id: "bioeng-101", type: "folder", name: "BIOENG 101", children: [] },
        { id: "bioeng-145", type: "folder", name: "BIOENG 145", children: [] },
        { id: "bioeng-190", type: "folder", name: "BIOENG 190", children: [] },
        { id: "bioeng-103", type: "folder", name: "BIOENG 103", children: [] },
        { id: "bioeng-147", type: "folder", name: "BIOENG 147", children: [] },
        { id: "bioeng-104", type: "folder", name: "BIOENG 104", children: [] },
        { id: "bioeng-135", type: "folder", name: "BIOENG 135", children: [] },
        { id: "bioeng-114", type: "folder", name: "BIOENG 114", children: [] },
        { id: "bioeng-c149", type: "folder", name: "BIOENG C149", children: [] },
        { id: "bioeng-11", type: "folder", name: "BIOENG 11", children: [] },
        { id: "bioeng-100", type: "folder", name: "BIOENG 100", children: [] },
        { id: "bioeng-26", type: "folder", name: "BIOENG 26", children: [] },
        { id: "bioeng-25", type: "folder", name: "BIOENG 25", children: [] },
        { id: "bioeng-171", type: "folder", name: "BIOENG 171", children: [] },
        { id: "bioeng-10", type: "folder", name: "BIOENG 10", children: [] },
      ],
    },
    {
      id: "compsci",
      type: "folder",
      name: "COMPSCI",
      children: [
        { id: "compsci-189", type: "folder", name: "COMPSCI 189", children: [] },
        { id: "compsci-161", type: "folder", name: "COMPSCI 161", children: [] },
        { id: "compsci-188", type: "folder", name: "COMPSCI 188", children: [] },
        { id: "compsci-61c", type: "folder", name: "COMPSCI 61C", children: [] },
        { id: "compsci-70", type: "folder", name: "COMPSCI 70", children: [] },
        { id: "compsci-61b", type: "folder", name: "COMPSCI 61B", children: [] },
        { id: "compsci-61a", type: "folder", name: "COMPSCI 61A", children: [] },
      ],
    },
    {
      id: "engin",
      type: "folder",
      name: "ENGIN",
      children: [
        { id: "engin-198", type: "folder", name: "ENGIN 198", children: [] },
        { id: "engin-183a", type: "folder", name: "ENGIN 183A", children: [] },
        { id: "engin-183e", type: "folder", name: "ENGIN 183E", children: [] },
      ],
    },
    {
      id: "eecs",
      type: "folder",
      name: "EECS",
      children: [
        { id: "eecs-c106a", type: "folder", name: "EECS C106A", children: [] },
        { id: "eecs-16b", type: "folder", name: "EECS 16B", children: [] },
        { id: "eecs-16a", type: "folder", name: "EECS 16A", children: [] },
      ],
    },
    {
      id: "chem",
      type: "folder",
      name: "CHEM",
      children: [
        { id: "chem-3a", type: "folder", name: "CHEM 3A", children: [] },
        { id: "chem-3al", type: "folder", name: "CHEM 3AL", children: [] },
      ],
    },
    {
      id: "math",
      type: "folder",
      name: "MATH",
      children: [
        { id: "math-54", type: "folder", name: "MATH 54", children: [] },
        { id: "math-w53", type: "folder", name: "MATH W53", children: [] },
      ],
    },
    {
      id: "etc-tech",
      type: "folder",
      name: "ETC. (tech)",
      children: [
        {
          id: "eleng",
          type: "folder",
          name: "ELENG",
          children: [
            { id: "eleng-122", type: "folder", name: "ELENG 122", children: [] },
          ],
        },
        {
          id: "physics",
          type: "folder",
          name: "PHYSICS",
          children: [
            { id: "physics-7b", type: "folder", name: "PHYSICS 7B", children: [] },
          ],
        },
        {
          id: "cmpbio",
          type: "folder",
          name: "CMPBIO",
          children: [
            { id: "cmpbio-198bc", type: "folder", name: "CMPBIO 198BC", children: [] },
          ],
        },
        {
          id: "stat",
          type: "folder",
          name: "STAT",
          children: [
            { id: "stat-20", type: "folder", name: "STAT 20", children: [] },
          ],
        },
      ],
    },
    {
      id: "etc-non-tech",
      type: "folder",
      name: "ETC. (non-tech)",
      children: [
        {
          id: "english",
          type: "folder",
          name: "ENGLISH",
          children: [
            { id: "english-198", type: "folder", name: "ENGLISH 198", children: [] },
          ],
        },
        {
          id: "econ",
          type: "folder",
          name: "ECON",
          children: [
            { id: "econ-1", type: "folder", name: "ECON 1", children: [] },
          ],
        },
        {
          id: "theater",
          type: "folder",
          name: "THEATER",
          children: [
            { id: "theater-r1b", type: "folder", name: "THEATER R1B", children: [] },
          ],
        },
        {
          id: "desinv",
          type: "folder",
          name: "DESINV",
          children: [
            { id: "desinv-21", type: "folder", name: "DESINV 21", children: [] },
          ],
        },
        {
          id: "history",
          type: "folder",
          name: "HISTORY",
          children: [
            { id: "history-136b", type: "folder", name: "HISTORY 136B", children: [] },
          ],
        },
        {
          id: "polsci",
          type: "folder",
          name: "POLSCI",
          children: [
            { id: "polsci-5", type: "folder", name: "POLSCI 5", children: [] },
          ],
        },
        {
          id: "ugba",
          type: "folder",
          name: "UGBA",
          children: [
            { id: "ugba-10", type: "folder", name: "UGBA 10", children: [] },
          ],
        },
      ],
    },
  ],
},
{
  id: "yale",
  type: "folder",
  name: "Yale",
  children: [],
},
    ],
  };

const studyState = {
  selectedId: "study-resources",
  expandedIds: new Set(["study-resources"]),
  viewMode: "list",
};
const studyIndex = new Map();

const studyBuildIndex = (node, parentId = null, path = []) => {
  const nextPath = [...path, node.name];
  studyIndex.set(node.id, { node, parentId, path: nextPath });
  (node.children || []).forEach((child) => {
    studyBuildIndex(child, node.id, nextPath);
  });
};

const studyRebuildIndex = () => {
  studyIndex.clear();
  studyBuildIndex(studyResourcesRoot);
};

const studyGetEntry = (id) => studyIndex.get(id) || null;

const studyGetSelectedEntry = () => studyGetEntry(studyState.selectedId);

const studyGetParentEntry = (entry) =>
  entry && entry.parentId ? studyGetEntry(entry.parentId) : null;

const studyIsFolder = (node) => node && node.type === "folder";

const studyIsPdf = (node) => node && node.type === "pdf";

const studyPathText = (entry) => (entry ? entry.path.join("\\") : "Study Resources");

const studyObjectCountText = (count) => `${count} object${count === 1 ? "" : "s"}`;

const studySubitemCount = (node) =>
  studyIsFolder(node) && Array.isArray(node.children) ? node.children.length : 0;

const studySubitemText = (node) =>
  `${studySubitemCount(node)} item${studySubitemCount(node) === 1 ? "" : "s"}`;

const studyStorageBytes = (node) => {
  if (!node) return 0;
  if (studyIsPdf(node)) return Number(node.sizeBytes) || 0;
  return (node.children || []).reduce(
    (total, child) => total + studyStorageBytes(child),
    0
  );
};

const studyFormatStorage = (bytes) => {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
};

const studyStorageText = (node) => studyFormatStorage(studyStorageBytes(node));

const studyMetadataText = (node) => `${studySubitemText(node)}, ${studyStorageText(node)}`;

const studyTypeText = (node) => (studyIsPdf(node) ? "PDF Document" : "File Folder");

const studyIconForNode = (node) => {
  if (studyIsPdf(node)) return STUDY_ICONS.document;
  return studyState.expandedIds.has(node.id)
    ? STUDY_ICONS.folderOpen
    : STUDY_ICONS.folderClosed;
};

const studyPdfEmbedSrc = (node, page = 1, zoom = 100) =>
  node && node.path
    ? `${node.path}#page=${page}&zoom=${zoom}&toolbar=0&navpanes=0`
    : "";

const studyPdfThumbnailPages = (node) =>
  Array.isArray(node.thumbnailPages) && node.thumbnailPages.length
    ? node.thumbnailPages
    : [1, 2, 3];

const studySlug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const studyChildIdExists = (root, id) => {
  if (root.id === id) return true;
  return (root.children || []).some((child) => studyChildIdExists(child, id));
};

const studyUniqueId = (baseId) => {
  let id = baseId;
  let index = 2;
  while (studyChildIdExists(studyResourcesRoot, id)) {
    id = `${baseId}-${index}`;
    index += 1;
  }
  return id;
};

const studyEnsureFolderPath = (folderPath) => {
  let current = studyResourcesRoot;
  const pathParts = [];

  folderPath.forEach((folderName) => {
    pathParts.push(folderName);
    current.children = current.children || [];
    let next = current.children.find(
      (child) => studyIsFolder(child) && child.name === folderName
    );

    if (!next) {
      next = {
        id: studyUniqueId(`folder-${pathParts.map(studySlug).join("-")}`),
        type: "folder",
        name: folderName,
        children: [],
      };
      current.children.push(next);
    }

    current = next;
  });

  return current;
};

const studyMergeManifest = (manifest) => {
  const files = Array.isArray(manifest && manifest.files) ? manifest.files : [];

  files.forEach((file) => {
    if (!file || !file.path || !file.name) return;
    const folderPath = Array.isArray(file.folderPath) ? file.folderPath : [];
    const folder = studyEnsureFolderPath(folderPath);
    folder.children = folder.children || [];

    const existing = folder.children.find(
      (child) => studyIsPdf(child) && child.path === file.path
    );
    if (existing) {
      existing.name = file.name;
      existing.sizeBytes = Number(file.sizeBytes) || 0;
      existing.thumbnailPages = file.thumbnailPages;
      return;
    }

    folder.children.push({
      id: studyUniqueId(
        `pdf-${[...folderPath, file.name].map(studySlug).join("-")}`
      ),
      type: "pdf",
      name: file.name,
      path: file.path,
      sizeBytes: Number(file.sizeBytes) || 0,
      thumbnailPages: file.thumbnailPages,
      downloadName: file.downloadName || file.name,
    });
  });
};

const studyLoadManifest = async () => {
  if (window.location.protocol === "file:") return;
  try {
    const response = await fetch(STUDY_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    studyMergeManifest(manifest);
    studyRebuildIndex();
    studyRender();
  } catch (error) {
    // Static file browsing may block fetch(); the scaffold still works without a manifest.
  }
};

const studyCreateIcon = (src) => {
  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  return image;
};

const studyCreateEmpty = (text, className = "study-empty") => {
  const empty = document.createElement("div");
  empty.className = className;
  empty.textContent = text;
  return empty;
};

const studyCreateText = (className, text) => {
  const element = document.createElement("span");
  if (className) element.className = className;
  element.textContent = text;
  return element;
};

const studyRenderFileListHeader = () => {
  const header = document.createElement("div");
  header.className = "study-file-list-header";
  header.setAttribute("aria-hidden", "true");
  ["", "Name", "Type", "Items", "Size"].forEach((label) => {
    header.appendChild(studyCreateText("", label));
  });
  return header;
};

const studySetSelected = (id) => {
  if (!studyGetEntry(id)) return;
  studyState.selectedId = id;
  studyRender();
};

const studyToggleFolder = (id, forceOpen = null) => {
  const entry = studyGetEntry(id);
  if (!entry || !studyIsFolder(entry.node)) return;
  const shouldOpen =
    forceOpen === null ? !studyState.expandedIds.has(id) : Boolean(forceOpen);
  if (shouldOpen) {
    studyState.expandedIds.add(id);
  } else {
    studyState.expandedIds.delete(id);
  }
  studyRender();
};

const studySelectedPdfEntry = () => {
  const entry = studyGetSelectedEntry();
  return entry && studyIsPdf(entry.node) ? entry : null;
};

const studyOpenSelectedInWindow = () => {
  const entry = studySelectedPdfEntry();
  if (!entry || !entry.node.path || !studyPdfIframe || !studyPdfTitle) return;
  studyPdfTitle.textContent = entry.node.name;
  studyPdfIframe.title = entry.node.name;
  studyPdfIframe.dataset.src = studyPdfEmbedSrc(entry.node);
  studyPdfIframe.removeAttribute("src");
  setWindowOpen("study-pdf", true);
};

const studyOpenSelectedInTab = () => {
  const entry = studySelectedPdfEntry();
  if (!entry || !entry.node.path) return;
  triggerRandomEvents("newTabLink", { href: entry.node.path, source: "study-resources" });
  window.open(entry.node.path, "_blank", "noopener,noreferrer");
};

const studyDownloadSelected = () => {
  const entry = studySelectedPdfEntry();
  if (!entry || !entry.node.path) return;
  const link = document.createElement("a");
  link.href = entry.node.path;
  link.download = entry.node.downloadName || entry.node.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  triggerRandomEvents("fileDownload", {
    href: entry.node.path,
    source: "study-resources",
  });
};

const studyRenderTreeNode = (entry) => {
  const { node } = entry;
  const item = document.createElement("li");
  const row = document.createElement("div");
  row.className = "study-tree-row";

  if (studyIsFolder(node)) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "study-tree-toggle";
    toggle.dataset.studyToggle = node.id;
    toggle.setAttribute(
      "aria-label",
      `${studyState.expandedIds.has(node.id) ? "Close" : "Open"} ${node.name}`
    );
    toggle.textContent = studyState.expandedIds.has(node.id) ? "-" : "+";
    row.appendChild(toggle);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "study-tree-toggle-spacer";
    row.appendChild(spacer);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "study-tree-item";
  button.dataset.studySelect = node.id;
  button.setAttribute(
    "aria-label",
    `${node.name}, ${studyTypeText(node)}, ${studyMetadataText(node)}`
  );
  if (studyState.selectedId === node.id) button.classList.add("is-selected");
  button.appendChild(studyCreateIcon(studyIconForNode(node)));

  button.appendChild(studyCreateText("", node.name));
  button.appendChild(studyCreateText("study-tree-meta", `(${studyMetadataText(node)})`));
  row.appendChild(button);
  item.appendChild(row);

  if (studyIsFolder(node) && studyState.expandedIds.has(node.id)) {
    const children = node.children || [];
    if (children.length) {
      const childList = document.createElement("ul");
      children.forEach((child) => {
        const childEntry = studyGetEntry(child.id);
        if (childEntry) childList.appendChild(studyRenderTreeNode(childEntry));
      });
      item.appendChild(childList);
    }
  }

  return item;
};

const studyRenderTree = () => {
  if (!studyTree) return;
  const rootEntry = studyGetEntry(studyResourcesRoot.id);
  if (!rootEntry) return;
  const list = document.createElement("ul");
  list.className = "study-tree-list";
  list.appendChild(studyRenderTreeNode(rootEntry));
  studyTree.replaceChildren(list);
};

const studyRenderFilePane = () => {
  if (!studyFilePane) return;
  const selected = studyGetSelectedEntry();
  const browseEntry =
    selected && studyIsFolder(selected.node)
      ? selected
      : studyGetParentEntry(selected) || studyGetEntry(studyResourcesRoot.id);
  const children = browseEntry && browseEntry.node.children ? browseEntry.node.children : [];

  studyFilePane.classList.toggle("is-list", studyState.viewMode === "list");
  studyFilePane.classList.toggle("is-gallery", studyState.viewMode === "gallery");

  if (studyCurrentTitle) studyCurrentTitle.textContent = browseEntry.node.name;
  if (studyItemCount) {
    studyItemCount.textContent = `${studyObjectCountText(children.length)}, ${studyStorageText(browseEntry.node)}`;
  }

  if (!children.length) {
    studyFilePane.replaceChildren(
      studyCreateEmpty(
        "This folder is empty. Course folders and PDFs will appear here after the class list is added."
      )
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  if (studyState.viewMode === "list") {
    fragment.appendChild(studyRenderFileListHeader());
  }

  children.forEach((child) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "study-file-item";
    button.dataset.studyFile = child.id;
    button.setAttribute(
      "aria-label",
      `${child.name}, ${studyTypeText(child)}, ${studyMetadataText(child)}`
    );
    if (studyState.selectedId === child.id) button.classList.add("is-selected");
    button.appendChild(studyCreateIcon(studyIconForNode(child)));

    button.appendChild(studyCreateText("study-file-name", child.name));
    button.appendChild(studyCreateText("study-file-type", studyTypeText(child)));
    button.appendChild(studyCreateText("study-file-subitems", studySubitemText(child)));
    button.appendChild(studyCreateText("study-file-storage", studyStorageText(child)));

    fragment.appendChild(button);
  });

  studyFilePane.replaceChildren(fragment);
};

const studyRenderPdfPreview = (node) => {
  const wrapper = document.createElement("div");
  wrapper.className = "study-preview-pdf";

  const thumbnails = document.createElement("div");
  thumbnails.className = "study-pdf-thumbnails";
  thumbnails.setAttribute("aria-label", `${node.name} page thumbnails`);

  const main = document.createElement("div");
  main.className = "study-pdf-main";

  const mainIframe = document.createElement("iframe");
  mainIframe.src = studyPdfEmbedSrc(node);
  mainIframe.title = node.name;
  main.appendChild(mainIframe);

  const pages = studyPdfThumbnailPages(node);
  pages.forEach((page, index) => {
    const thumbnail = document.createElement("div");
    thumbnail.className = "study-pdf-thumbnail";
    if (index === 0) thumbnail.classList.add("is-active");
    thumbnail.setAttribute("role", "button");
    thumbnail.setAttribute("tabindex", "0");
    thumbnail.setAttribute("aria-label", `Preview page ${page}`);
    thumbnail.dataset.studyPreviewPage = String(page);

    const frame = document.createElement("div");
    frame.className = "study-pdf-thumbnail-frame";

    const iframe = document.createElement("iframe");
    iframe.src = studyPdfEmbedSrc(node, page, 55);
    iframe.title = `${node.name}, page ${page}`;
    iframe.setAttribute("tabindex", "-1");
    frame.appendChild(iframe);

    thumbnail.appendChild(frame);
    thumbnail.appendChild(studyCreateText("study-pdf-thumbnail-label", `Page ${page}`));
    thumbnails.appendChild(thumbnail);
  });

  const setPage = (page, thumbnail) => {
    mainIframe.src = studyPdfEmbedSrc(node, page);
    thumbnails.querySelectorAll(".study-pdf-thumbnail").forEach((item) => {
      item.classList.toggle("is-active", item === thumbnail);
    });
  };

  thumbnails.addEventListener("click", (event) => {
    const thumbnail = event.target.closest("[data-study-preview-page]");
    if (!thumbnail || !thumbnails.contains(thumbnail)) return;
    setPage(Number(thumbnail.dataset.studyPreviewPage), thumbnail);
  });

  thumbnails.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const thumbnail = event.target.closest("[data-study-preview-page]");
    if (!thumbnail || !thumbnails.contains(thumbnail)) return;
    event.preventDefault();
    setPage(Number(thumbnail.dataset.studyPreviewPage), thumbnail);
  });

  wrapper.appendChild(thumbnails);
  wrapper.appendChild(main);
  return wrapper;
};

const studyRenderPreview = () => {
  if (!studyPreviewBody || !studyPreviewTitle || !studyPreviewIcon) return;
  const selected = studyGetSelectedEntry();
  const canOpenPdf = selected && studyIsPdf(selected.node) && Boolean(selected.node.path);

  studyPreviewIcon.src = selected ? studyIconForNode(selected.node) : STUDY_ICONS.folderOpen;
  studyPreviewTitle.textContent = selected ? selected.node.name : "Study Resources";

  if (canOpenPdf) {
    studyPreviewBody.replaceChildren(studyRenderPdfPreview(selected.node));
  } else {
    const selectedFolder = selected && studyIsFolder(selected.node) ? selected.node : null;
    const message =
      selectedFolder && selectedFolder.children && selectedFolder.children.length
        ? "Select a course folder or PDF resource to preview it here."
        : "No PDFs are available in this folder yet.";
    studyPreviewBody.replaceChildren(studyCreateEmpty(message, "study-preview-empty"));
  }

  if (studyOpenWindow) studyOpenWindow.disabled = !canOpenPdf;
  if (studyOpenTab) studyOpenTab.disabled = !canOpenPdf;
  if (studyDownload) studyDownload.disabled = !canOpenPdf;
};

const studyRenderStatus = () => {
  const selected = studyGetSelectedEntry();
  const browseEntry =
    selected && studyIsFolder(selected.node)
      ? selected
      : studyGetParentEntry(selected) || studyGetEntry(studyResourcesRoot.id);
  const count =
    browseEntry && browseEntry.node.children ? browseEntry.node.children.length : 0;
  if (studyAddress) studyAddress.textContent = studyPathText(selected);
  if (studyStatusLeft) {
    studyStatusLeft.textContent = `${studyObjectCountText(count)}, ${studyStorageText(browseEntry.node)}`;
  }
  if (studyStatusRight) studyStatusRight.textContent = studyPathText(selected);
  if (studyUp) studyUp.disabled = !selected || !selected.parentId;
};

const studyRenderViewButtons = () => {
  [
    [studyListView, "list"],
    [studyGalleryView, "gallery"],
  ].forEach(([button, mode]) => {
    if (!button) return;
    const isActive = studyState.viewMode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

function studyRender() {
  studyRenderTree();
  studyRenderFilePane();
  studyRenderPreview();
  studyRenderStatus();
  studyRenderViewButtons();
}

if (studyTree && studyFilePane) {
  studyRebuildIndex();
  studyRender();
  studyLoadManifest();

  studyTree.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-study-toggle]");
    if (toggle && studyTree.contains(toggle)) {
      studyToggleFolder(toggle.getAttribute("data-study-toggle"));
      return;
    }

    const item = event.target.closest("[data-study-select]");
    if (item && studyTree.contains(item)) {
      const id = item.getAttribute("data-study-select");
      const entry = studyGetEntry(id);
      if (event.detail > 1 && entry && studyIsFolder(entry.node)) {
        studyState.expandedIds.add(id);
        studySetSelected(id);
        return;
      }
      studySetSelected(id);
    }
  });

  studyTree.addEventListener("dblclick", (event) => {
    const item = event.target.closest("[data-study-select]");
    if (!item) return;
    const id = item.getAttribute("data-study-select");
    const entry = studyGetEntry(id);
    if (entry && studyIsFolder(entry.node)) {
      studyState.expandedIds.add(id);
      studySetSelected(id);
    }
  });

  studyFilePane.addEventListener("click", (event) => {
    const item = event.target.closest("[data-study-file]");
    if (!item || !studyFilePane.contains(item)) return;
    const id = item.getAttribute("data-study-file");
    const entry = studyGetEntry(id);
    if (event.detail > 1 && entry) {
      if (studyIsFolder(entry.node)) {
        studyState.expandedIds.add(id);
        studySetSelected(id);
        return;
      }
      studySetSelected(id);
      studyOpenSelectedInWindow();
      return;
    }
    studySetSelected(id);
  });

  studyFilePane.addEventListener("dblclick", (event) => {
    const item = event.target.closest("[data-study-file]");
    if (!item) return;
    const id = item.getAttribute("data-study-file");
    const entry = studyGetEntry(id);
    if (!entry) return;
    if (studyIsFolder(entry.node)) {
      studyState.expandedIds.add(id);
      studySetSelected(id);
      return;
    }
    studySetSelected(id);
    studyOpenSelectedInWindow();
  });

  if (studyUp) {
    studyUp.addEventListener("click", () => {
      const parent = studyGetParentEntry(studyGetSelectedEntry());
      if (parent) studySetSelected(parent.node.id);
    });
  }

  [
    [studyListView, "list"],
    [studyGalleryView, "gallery"],
  ].forEach(([button, mode]) => {
    if (!button) return;
    button.addEventListener("click", () => {
      studyState.viewMode = mode;
      studyRender();
    });
  });

  [
    [studyOpenWindow, studyOpenSelectedInWindow],
    [studyOpenTab, studyOpenSelectedInTab],
    [studyDownload, studyDownloadSelected],
  ].forEach(([button, handler]) => {
    if (button) button.addEventListener("click", handler);
  });
}

const calendarImages = {
  0: "assets/calendar-pics/jan.jpg",
  1: "assets/modeling/fast-devotion-lb-nov2023/IMG_0330.jpg",
  2: "assets/calendar-pics/mar-standstill.jpg",
  3: "assets/calendar-pics/apr-sonder-lb2.jpg",
  4: "assets/modeling/fast-reverie-lb-mar2024/02-reverie-photo.jpg",
  5: "assets/modeling/fast-crescendo-lb-oct2024/01-crescendo-photo.jpg",
  6: "assets/modeling/xoxo510-brainscramble/01-brainscramble-photo.jpg",
  7: "assets/modeling/club-rambutan-runway-show/01-rambutan-photo.jpg",
  8: "assets/modeling/garb-means-business-jan2025/1.jpg",
  9: "assets/modeling/vampire-shoot-jan2025/01-vampire-photo.jpg",
  10: "assets/modeling/saturn-LA-oct2023/IMG_9696.jpg",
  11: "assets/modeling/garb-garbage-rnwy-apr2025/1.JPEG",
};

const calendarImagePositions = {
  2: "center top",
  3: "center top",
  4: "center calc(100% + 30px)",
  5: "center top",
  7: "center top",
  9: "left center",
  10: "center top",
};

const calendarImageSizes = {
  9: "contain",
};

const calendarImageBackgrounds = {
  9: "#000",
};

const calendarQuotes = {
  0: `"Perhaps you were made for this moment, to walk through blazing fire and come forth as gold"<br>—Morgan Harper Nichols`,
  1: `"The gentle yield of water will cut obstinate stone"<br>—Lao Tzu`,
  2:
    `"Man will not merely endure: he will prevail. He is immortal, not because he alone among creatures has an inexhaustible voice, but because he has a soul, a spirit capable of compassion and sacrifice and endurance."<br>` +
    `—William Faulkner`,
  3:
    `"Happiness, like success, cannot be pursued; it must ensue, and it only does so as the unintended side-effect of dedication to a cause greater than oneself"<br>` +
    `—Viktor E. Frankl`,
  4: `"To plant a garden is to believe in tomorrow."<br>—Audrey Hepburn`,
  5:
    `"I took a deep breath and listened to the old brag of my heart. I am, I am, I am." ` +
    `—Sylvia Plath`,
  6: `"It takes great courage to see the world in all its tainted glory, and still to love it." —Oscar Wilde`,
  7: `"In the depth of winter, I finally learned that within me there lay an invincible summer. —Albert Camus`,
  8: `"It isn’t constancy that keeps us alive, it’s the progression we use to move us." —Olivie Blake`,
  9: `"The best way to predict the future it to create it"<br>—Peter Drucker`,
  10: `"Our life is shaped by our mind, for we become what we think."<br>—Buddha`,
  11: `"To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment"<br>—Ralph Waldo Emerson`,
};

const calendarEvents = {
  "0-1": {
    title: "New Year's Day",
    image: "assets/random%20events/newyear.gif",
  },
  "1-4": {
    title: "Cancer Awareness Day",
    image: "assets/random%20events/fcancer.gif",
  },
  "1-11": {
    title: "February 11",
    image: "assets/random%20events/birthday.gif",
  },
  "1-14": {
    title: "Valentine's Day",
    image: "assets/random%20events/valentine.gif",
  },
  "2-4": {
    title: "Where did she go?",
    image: "assets/random%20events/nana.gif",
  },
  "2-8": {
    title: "International Women's Day",
    image: "assets/random%20events/iwd.gif",
  },
  "2-31": {
    title: "Transgender Day of Visibility",
    image: "assets/random%20events/trans.gif",
  },
  "3-20": {
    title: "April 20",
    image: "assets/random%20events/swed.gif",
  },
  "4-5": {
    title: "Cinco de Mayo",
    image: "assets/random%20events/cincodemayo.gif",
  },
  "5-1": {
    title: "Pride Month",
    image: "assets/random%20events/pridemonth.gif",
  },
  "5-19": {
    title: "Juneteenth",
    image: "assets/random%20events/juneteenth.gif",
  },
  "6-4": {
    title: "Fourth of July",
    image: "assets/random%20events/4thofjuly.gif",
  },
  "8-11": {
    title: "September 11",
    image: "assets/random%20events/remembering911.gif",
  },
  "8-23": {
    title: "Bisexual Visibility Day",
    image:
      "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXRreml3ZDZodnJwZmVkYmIyaHY4bjBoOHkyc2ozdDR0cTJjZHpnOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/fJzFpWBj82lk1tW5RY/giphy.gif",
  },
  "9-31": {
    title: "Halloween",
    image: "assets/random%20events/halloween.gif",
  },
  "10-2": {
    title: "Dia de los Muertos",
    image: "assets/random%20events/diadelosmuertos.gif",
  },
  "11-25": {
    title: "Christmas Day",
    image: "assets/random%20events/christmas.gif",
  },
};

const eidAlFitrEvent = {
  title: "Eid Mubarak",
  image: "assets/random%20events/eidmubarak.gif",
};

const chineseNewYearEvent = {
  title: "Chinese New Year",
  image: "assets/random%20events/chinesenewyear.gif",
};

const easterEvent = {
  title: "Easter Day",
  image: "assets/random%20events/easter.gif",
};

const diwaliEvent = {
  title: "Diwali",
  image: "assets/random%20events/diwali.gif",
};

const ramadanEvent = {
  title: "Ramadan Starts",
  image: "assets/random%20events/ramadan.gif",
};

const holiEvent = {
  title: "Holi",
  image: "assets/random%20events/holi.gif",
};

const hanukkahEvent = {
  title: "Hanukkah",
  image: "assets/random%20events/hanukkah.gif",
};

const vesakEvent = {
  title: "Vesak Day",
  image: "assets/random%20events/buddha.gif",
};

const thanksgivingEvent = {
  title: "Thanksgiving Day",
  image: "assets/random%20events/thanksgiving.gif",
};

const laborDayEvent = {
  title: "Labor Day",
  image: "assets/random%20events/laborday.gif",
};

const mothersDayEvent = {
  title: "Mother's Day",
  image: "assets/random%20events/mothersday.gif",
};

const fathersDayEvent = {
  title: "Father's Day",
  image: "assets/random%20events/fathersday.gif",
};

const onamEvent = {
  title: "Onam",
  image:
    "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExZjRoeGk1ZW51MGxuYjd1aDQxb3RlMmZodTBnOWlsYTA1cTFuZGZoOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XGLBlMvhA0PO9MEDmv/giphy.gif",
};

const pongalEvent = {
  title: "Pongal",
  image:
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMDVnNmphdHYxbTJoMDJjNXNmZHg3eW5pcHF1MDNkMWVjOGw3dmpocyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Ph5WvQ9jJKJGOVLpgD/giphy.gif",
};

const eidAlFitrDateOverrides = {
  2024: { month: 3, day: 10 },
  2025: { month: 2, day: 30 },
  2026: { month: 2, day: 20 },
  2027: { month: 2, day: 10 },
  2028: { month: 1, day: 27 },
  2029: { month: 1, day: 15 },
  2030: { month: 1, day: 5 },
  2031: { month: 0, day: 25 },
};

const chineseNewYearDateOverrides = {
  2024: { month: 1, day: 10 },
  2025: { month: 0, day: 29 },
  2026: { month: 1, day: 17 },
  2027: { month: 1, day: 6 },
  2028: { month: 0, day: 26 },
  2029: { month: 1, day: 13 },
  2030: { month: 1, day: 3 },
  2031: { month: 0, day: 23 },
  2032: { month: 1, day: 11 },
  2033: { month: 0, day: 31 },
  2034: { month: 1, day: 19 },
  2035: { month: 1, day: 8 },
  2036: { month: 0, day: 28 },
  2037: { month: 1, day: 15 },
  2038: { month: 1, day: 4 },
  2039: { month: 0, day: 24 },
  2040: { month: 1, day: 12 },
  2041: { month: 1, day: 1 },
  2042: { month: 0, day: 22 },
  2043: { month: 1, day: 10 },
};

const diwaliDateOverrides = {
  2024: { month: 9, day: 31 },
  2025: { month: 9, day: 20 },
  2026: { month: 10, day: 8 },
  2027: { month: 9, day: 28 },
  2028: { month: 9, day: 17 },
  2029: { month: 10, day: 5 },
  2030: { month: 9, day: 25 },
};

const ramadanStartDateOverrides = {
  2024: [{ month: 2, day: 12 }],
  2025: [{ month: 2, day: 1 }],
  2026: [{ month: 1, day: 18 }],
  2027: [{ month: 1, day: 8 }],
  2028: [{ month: 0, day: 28 }],
  2029: [{ month: 0, day: 16 }],
  2030: [
    { month: 0, day: 6 },
    { month: 11, day: 26 },
  ],
  2031: [{ month: 11, day: 15 }],
};

const holiDateOverrides = {
  2024: { month: 2, day: 25 },
  2025: { month: 2, day: 14 },
  2026: { month: 2, day: 3 },
  2027: { month: 2, day: 22 },
  2028: { month: 2, day: 11 },
  2029: { month: 1, day: 28 },
  2030: { month: 2, day: 19 },
};

const hanukkahDateOverrides = {
  2024: { month: 11, day: 26 },
  2025: { month: 11, day: 15 },
  2026: { month: 11, day: 5 },
  2027: { month: 11, day: 25 },
  2028: { month: 11, day: 13 },
  2029: { month: 11, day: 2 },
  2030: { month: 11, day: 21 },
  2031: { month: 11, day: 10 },
};

const vesakDateOverrides = {
  2024: { month: 4, day: 23 },
  2025: { month: 4, day: 12 },
  2026: { month: 4, day: 1 },
  2027: { month: 4, day: 20 },
  2028: { month: 4, day: 8 },
  2029: { month: 4, day: 27 },
  2030: { month: 4, day: 17 },
  2031: { month: 4, day: 7 },
};

const onamDateOverrides = {
  2024: { month: 8, day: 15 },
  2025: { month: 8, day: 5 },
  2026: { month: 7, day: 26 },
  2027: { month: 8, day: 12 },
  2028: { month: 8, day: 1 },
};

const pongalDateOverrides = {
  2024: { month: 0, day: 15 },
  2025: { month: 0, day: 14 },
  2026: { month: 0, day: 14 },
  2027: { month: 0, day: 15 },
  2028: { month: 0, day: 15 },
  2029: { month: 0, day: 14 },
  2030: { month: 0, day: 14 },
  2031: { month: 0, day: 15 },
};

let eidAlFitrFormatter = null;
try {
  eidAlFitrFormatter = new Intl.DateTimeFormat("en-u-ca-islamic-civil", {
    month: "numeric",
    day: "numeric",
  });
} catch (error) {
  eidAlFitrFormatter = null;
}

const eidAlFitrDateCache = new Map();

const getChineseNewYearDate = (year) =>
  chineseNewYearDateOverrides[year] || null;

const getDiwaliDate = (year) => diwaliDateOverrides[year] || null;

const getRamadanStartDates = (year) =>
  ramadanStartDateOverrides[year] || [];

const getHoliDate = (year) => holiDateOverrides[year] || null;

const getHanukkahDate = (year) => hanukkahDateOverrides[year] || null;

const getVesakDate = (year) => vesakDateOverrides[year] || null;

const getOnamDate = (year) => onamDateOverrides[year] || null;

const getPongalDate = (year) => pongalDateOverrides[year] || null;

const getThanksgivingDate = (year) => {
  const novemberFirst = new Date(year, 10, 1);
  const firstThursdayOffset = (4 - novemberFirst.getDay() + 7) % 7;
  return { month: 10, day: 1 + firstThursdayOffset + 21 };
};

const getLaborDayDate = (year) => {
  const septemberFirst = new Date(year, 8, 1);
  const firstMondayOffset = (1 - septemberFirst.getDay() + 7) % 7;
  return { month: 8, day: 1 + firstMondayOffset };
};

const getMothersDayDate = (year) => {
  const mayFirst = new Date(year, 4, 1);
  const firstSundayOffset = (7 - mayFirst.getDay()) % 7;
  return { month: 4, day: 1 + firstSundayOffset + 7 };
};

const getFathersDayDate = (year) => {
  const juneFirst = new Date(year, 5, 1);
  const firstSundayOffset = (7 - juneFirst.getDay()) % 7;
  return { month: 5, day: 1 + firstSundayOffset + 14 };
};

const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month: month - 1, day };
};

const getIslamicMonthDay = (date) => {
  if (!eidAlFitrFormatter) return null;
  const parts = eidAlFitrFormatter.formatToParts(date);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!month || !day) return null;
  return { month, day };
};

const getEidAlFitrDate = (year) => {
  if (eidAlFitrDateOverrides[year]) return eidAlFitrDateOverrides[year];
  if (eidAlFitrDateCache.has(year)) return eidAlFitrDateCache.get(year);

  let match = null;
  const probe = new Date(year, 0, 1, 12);
  while (probe.getFullYear() === year) {
    const islamic = getIslamicMonthDay(probe);
    if (islamic && islamic.month === 10 && islamic.day === 1) {
      match = { month: probe.getMonth(), day: probe.getDate() };
      break;
    }
    probe.setDate(probe.getDate() + 1);
  }

  eidAlFitrDateCache.set(year, match);
  return match;
};

const updateCalendarQuote = (month) => {
  if (!clockQuote) return;
  const quote = calendarQuotes[month];
  if (quote) {
    clockQuote.innerHTML = quote;
  }
};

const updateCalendarBackground = (month) => {
  if (!calendarSection) return;
  const src = calendarImages[month] || "";
  calendarSection.style.backgroundImage = src ? `url("${src}")` : "none";
  calendarSection.style.backgroundPosition = calendarImagePositions[month] || "center";
  calendarSection.style.backgroundSize = calendarImageSizes[month] || "cover";
  calendarSection.style.backgroundColor = calendarImageBackgrounds[month] || "";
};

const closeCalendar = () => {
  if (!calendarPopout) return;
  calendarPopout.classList.remove("is-open");
  calendarPopout.setAttribute("aria-hidden", "true");
  if (calendarSection) {
    calendarSection.style.backgroundImage = "none";
    calendarSection.style.backgroundPosition = "center";
    calendarSection.style.backgroundSize = "";
    calendarSection.style.backgroundColor = "";
  }
  if (clockImage) clockImage.removeAttribute("src");
};

const clampCalendarDate = (date) => {
  const now = new Date();
  const minDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const maxDate = new Date(now.getFullYear() + 1, now.getMonth(), 1);
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
};

const getCalendarEventKey = (year, month, day) => `${year}-${month}-${day}`;
const getCalendarEvent = (year, month, day) => {
  const chineseNewYearDate = getChineseNewYearDate(year);
  if (
    chineseNewYearDate &&
    chineseNewYearDate.month === month &&
    chineseNewYearDate.day === day
  ) {
    return chineseNewYearEvent;
  }

  const eidAlFitrDate = getEidAlFitrDate(year);
  if (
    eidAlFitrDate &&
    eidAlFitrDate.month === month &&
    eidAlFitrDate.day === day
  ) {
    return eidAlFitrEvent;
  }

  const ramadanStartDates = getRamadanStartDates(year);
  if (
    ramadanStartDates.some(
      (ramadanDate) => ramadanDate.month === month && ramadanDate.day === day
    )
  ) {
    return ramadanEvent;
  }

  const holiDate = getHoliDate(year);
  if (holiDate && holiDate.month === month && holiDate.day === day) {
    return holiEvent;
  }

  const vesakDate = getVesakDate(year);
  if (vesakDate && vesakDate.month === month && vesakDate.day === day) {
    return vesakEvent;
  }

  const pongalDate = getPongalDate(year);
  if (pongalDate && pongalDate.month === month && pongalDate.day === day) {
    return pongalEvent;
  }

  const onamDate = getOnamDate(year);
  if (onamDate && onamDate.month === month && onamDate.day === day) {
    return onamEvent;
  }

  const easterDate = getEasterDate(year);
  if (easterDate.month === month && easterDate.day === day) {
    return easterEvent;
  }

  const diwaliDate = getDiwaliDate(year);
  if (diwaliDate && diwaliDate.month === month && diwaliDate.day === day) {
    return diwaliEvent;
  }

  const hanukkahDate = getHanukkahDate(year);
  if (hanukkahDate && hanukkahDate.month === month && hanukkahDate.day === day) {
    return hanukkahEvent;
  }

  const laborDayDate = getLaborDayDate(year);
  if (laborDayDate.month === month && laborDayDate.day === day) {
    return laborDayEvent;
  }

  const mothersDayDate = getMothersDayDate(year);
  if (mothersDayDate.month === month && mothersDayDate.day === day) {
    return mothersDayEvent;
  }

  const fathersDayDate = getFathersDayDate(year);
  if (fathersDayDate.month === month && fathersDayDate.day === day) {
    return fathersDayEvent;
  }

  const thanksgivingDate = getThanksgivingDate(year);
  if (
    thanksgivingDate.month === month &&
    thanksgivingDate.day === day
  ) {
    return thanksgivingEvent;
  }

  return calendarEvents[`${month}-${day}`] || null;
};

const openRandomEventWindow = (calendarEvent, eventKey) => {
  if (!randomEventWindow) return;
  activeRandomEventKey = eventKey || "";
  if (calendarEvent) {
    if (randomEventTitle) {
      randomEventTitle.textContent = calendarEvent.title;
    }
    if (randomEventImage) {
      if (randomEventImage.dataset.src !== calendarEvent.image) {
        randomEventImage.removeAttribute("src");
      }
      randomEventImage.dataset.src = calendarEvent.image;
    }
  }
  loadDeferredMedia(randomEventWindow);
  randomEventWindow.classList.remove("is-hidden", "is-closing");
  randomEventWindow.setAttribute("aria-hidden", "false");
  positionRandomEventWindowInViewport(randomEventWindow);
  randomEventWindow.style.zIndex = String(topZ++);
  restartWindowAnimation(randomEventWindow, "is-opening");
};

const closeRandomEventWindow = () => {
  if (!randomEventWindow) return;
  activeRandomEventKey = "";
  randomEventWindow.setAttribute("aria-hidden", "true");
  restartWindowAnimation(randomEventWindow, "is-closing");
};

const appendCalendarCell = (text, className = "calendar-day") => {
  const cell = document.createElement("div");
  cell.className = className;
  cell.textContent = String(text);
  calendarGrid.appendChild(cell);
  return cell;
};

const buildCalendar = (date) => {
  const clampedDate = clampCalendarDate(date);
  calendarDate = clampedDate;
  const year = clampedDate.getFullYear();
  const month = clampedDate.getMonth();
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() === month;
  const today = now.getDate();
  const monthLabel = clampedDate.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });

  const firstOfMonth = new Date(year, month, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  calendarHeader.textContent = monthLabel;
  calendarGrid.innerHTML = "";
  updateCalendarBackground(month);
  updateCalendarQuote(month);

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  dayLabels.forEach((label, index) => {
    const labelCell = appendCalendarCell(label);
    if (index === 4) {
      labelCell.dataset.calendarWeekday = "thursday";
      labelCell.setAttribute("role", "button");
      labelCell.setAttribute("aria-label", "Feliz Jueves");
      labelCell.title = "Feliz Jueves";
    }
  });

  for (let i = startDay - 1; i >= 0; i -= 1) {
    appendCalendarCell(daysInPrevMonth - i, "calendar-day is-muted");
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isToday = isCurrentMonth && day === today;
    const calendarEvent = getCalendarEvent(year, month, day);
    const cell = appendCalendarCell(
      day,
      `calendar-day${isToday ? " is-today" : ""}${calendarEvent ? " is-event-day" : ""}`
    );
    cell.dataset.calendarDay = String(day);
    cell.dataset.calendarMonth = String(month);
    cell.dataset.calendarYear = String(year);
  }

  const totalCells = dayLabels.length + startDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i += 1) {
    appendCalendarCell(i, "calendar-day is-muted");
  }
};

const toggleCalendar = () => {
  const isOpen = calendarPopout.classList.contains("is-open");
  if (isOpen) {
    closeCalendar();
    return;
  }

  calendarPopout.classList.add("is-open");
  calendarPopout.setAttribute("aria-hidden", "false");
  calendarDate = new Date();
  buildCalendar(calendarDate);
  updateCalendarClock();
  triggerRandomEvents("calendarOpen");
};

calendarButton.addEventListener("click", toggleCalendar);
calendarPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  const nextDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  buildCalendar(nextDate);
});

calendarNext.addEventListener("click", (event) => {
  event.stopPropagation();
  const nextDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  buildCalendar(nextDate);
});

calendarHeader.addEventListener("click", () => {
  buildCalendar(new Date());
});

calendarGrid.addEventListener("click", (event) => {
  const thursdayCell = event.target.closest("[data-calendar-weekday='thursday']");
  if (thursdayCell && calendarGrid.contains(thursdayCell)) {
    event.stopPropagation();
    showFelizJuevesWindow();
    return;
  }

  const dayCell = event.target.closest("[data-calendar-day]");
  if (!dayCell || !calendarGrid.contains(dayCell)) return;
  const eventMonth = Number(dayCell.dataset.calendarMonth);
  const eventDay = Number(dayCell.dataset.calendarDay);
  const eventYear = Number(dayCell.dataset.calendarYear);
  const eventKey = getCalendarEventKey(eventYear, eventMonth, eventDay);
  const calendarEvent = getCalendarEvent(eventYear, eventMonth, eventDay);
  if (calendarEvent) {
    event.stopPropagation();
    const isSameEventOpen =
      activeRandomEventKey === eventKey &&
      randomEventWindow &&
      !randomEventWindow.classList.contains("is-hidden") &&
      randomEventWindow.getAttribute("aria-hidden") === "false";
    if (isSameEventOpen) {
      closeRandomEventWindow();
      return;
    }
    openRandomEventWindow(calendarEvent, eventKey);
  }
});

[randomEventClose, randomEventOk].forEach((button) => {
  if (!button) return;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    closeRandomEventWindow();
  });
});

if (randomEventWindow) {
  randomEventWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  randomEventWindow.addEventListener("animationend", (event) => {
    if (event.target !== randomEventWindow) return;
    if (event.animationName === "retro-window-open") {
      randomEventWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      randomEventWindow.classList.remove("is-closing");
      randomEventWindow.classList.add("is-hidden");
      randomEventWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (randomAlertWindow) {
  randomAlertWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  randomAlertWindow.addEventListener("animationend", (event) => {
    if (event.target !== randomAlertWindow) return;
    if (event.animationName === "retro-window-open") {
      randomAlertWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      randomAlertWindow.classList.remove("is-closing", "is-choice-flashing");
      randomAlertWindow.classList.add("is-hidden");
    }
  });
}

if (felizJuevesClose) {
  felizJuevesClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    flashFelizJuevesChoice();
  });
}

if (felizJuevesGracias) {
  felizJuevesGracias.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeFelizJuevesWindow();
  });
}

if (felizJuevesWindow) {
  felizJuevesWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  felizJuevesWindow.addEventListener("animationend", (event) => {
    if (event.target !== felizJuevesWindow) return;
    if (event.animationName === "retro-window-open") {
      felizJuevesWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      felizJuevesWindow.classList.remove("is-closing", "is-choice-flashing");
      felizJuevesWindow.classList.add("is-hidden");
      felizJuevesWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (randomAlertMaximize) {
  randomAlertMaximize.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!randomAlertWindow) return;
    randomAlertWindow.classList.add("is-expanded");
    randomAlertWindow.style.zIndex = String(topZ++);
  });
}

if (randomAlertMinimize) {
  randomAlertMinimize.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetRandomAlertSize();
    if (randomAlertWindow) randomAlertWindow.style.zIndex = String(topZ++);
  });
}

if (randomAlertClose) {
  randomAlertClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    flashRandomAlertChoices();
  });
}

[randomAlertYes, randomAlertNo].forEach((button) => {
  if (!button) return;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    respondToRandomAlert();
  });
});

if (selfLoveAlertClose) {
  selfLoveAlertClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    flashSelfLoveYes();
  });
}

if (selfLoveAlertYes) {
  selfLoveAlertYes.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeSelfLoveAlert();
  });
}

[selfLoveAlertNo].forEach((button) => {
  if (!button) return;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    flashSelfLoveYes();
  });
});

if (selfLoveAlertWindow) {
  selfLoveAlertWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  selfLoveAlertWindow.addEventListener("animationend", (event) => {
    if (event.target !== selfLoveAlertWindow) return;
    if (event.animationName === "retro-window-open") {
      selfLoveAlertWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      selfLoveAlertWindow.classList.remove("is-closing", "is-yes-flashing");
      selfLoveAlertWindow.classList.add("is-hidden");
    }
  });
}

if (rohinUpdateRun) {
  rohinUpdateRun.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.location.href = "index.html";
  });
}

if (rohinUpdateLater) {
  rohinUpdateLater.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeRohinUpdate();
  });
}

if (rohinUpdateWindow) {
  rohinUpdateWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  rohinUpdateWindow.addEventListener("animationend", (event) => {
    if (event.target !== rohinUpdateWindow) return;
    if (event.animationName === "retro-window-open") {
      rohinUpdateWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      rohinUpdateWindow.classList.remove("is-closing");
      rohinUpdateWindow.classList.add("is-hidden");
    }
  });
}

if (mcAfeeUpdateRun) {
  mcAfeeUpdateRun.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (mcAfeeUpdateLater) mcAfeeUpdateLater.disabled = true;
    showMcAfeeDownload();
  });
}

if (mcAfeeUpdateLater) {
  mcAfeeUpdateLater.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMcAfeeWindow(mcAfeePromptWindow);
  });
}

if (mcAfeeComplete) {
  mcAfeeComplete.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (mcAfeeComplete.disabled) return;
    stopMcAfeeDownload();
    closeMcAfeeWindow(mcAfeePromptWindow);
    closeMcAfeeWindow(mcAfeeDownloadWindow);
    showMcAfeeThanks();
  });
}

if (mcAfeeThanksOk) {
  mcAfeeThanksOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMcAfeeWindow(mcAfeeThanksWindow);
  });
}

[mcAfeePromptWindow, mcAfeeDownloadWindow, mcAfeeThanksWindow].forEach((win) => {
  if (!win) return;
  win.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      win.classList.remove("is-closing");
      win.classList.add("is-hidden");
      if (win === mcAfeeDownloadWindow) stopMcAfeeDownload();
      win.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
});

if (rohinNoteOk) {
  rohinNoteOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeRohinNote();
  });
}

if (rohinNoteWindow) {
  rohinNoteWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  rohinNoteWindow.addEventListener("animationend", (event) => {
    if (event.target !== rohinNoteWindow) return;
    if (event.animationName === "retro-window-open") {
      rohinNoteWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      rohinNoteWindow.classList.remove("is-closing");
      rohinNoteWindow.classList.add("is-hidden");
    }
  });
}

if (earthNoteOk) {
  earthNoteOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeEarthNote();
  });
}

if (earthNoteWindow) {
  earthNoteWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  earthNoteWindow.addEventListener("animationend", (event) => {
    if (event.target !== earthNoteWindow) return;
    if (event.animationName === "retro-window-open") {
      earthNoteWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      earthNoteWindow.classList.remove("is-closing");
      earthNoteWindow.classList.add("is-hidden");
    }
  });
}

if (healthNoteOk) {
  healthNoteOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeHealthNote();
  });
}

if (healthNoteWindow) {
  healthNoteWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  healthNoteWindow.addEventListener("animationend", (event) => {
    if (event.target !== healthNoteWindow) return;
    if (event.animationName === "retro-window-open") {
      healthNoteWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      healthNoteWindow.classList.remove("is-closing");
      healthNoteWindow.classList.add("is-hidden");
    }
  });
}

if (loveNoteOk) {
  loveNoteOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLoveNote();
  });
}

if (loveNoteWindow) {
  loveNoteWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  loveNoteWindow.addEventListener("animationend", (event) => {
    if (event.target !== loveNoteWindow) return;
    if (event.animationName === "retro-window-open") {
      loveNoteWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      loveNoteWindow.classList.remove("is-closing");
      loveNoteWindow.classList.add("is-hidden");
    }
  });
}

if (castleGateOk) {
  castleGateOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeCastleGateWindow();
  });
}

if (castleGateWindow) {
  castleGateWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  castleGateWindow.addEventListener("animationend", (event) => {
    if (event.target !== castleGateWindow) return;
    if (event.animationName === "retro-window-open") {
      castleGateWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      castleGateWindow.classList.remove("is-closing");
      castleGateWindow.classList.add("is-hidden");
    }
  });
}

if (possumSpringsOk) {
  possumSpringsOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closePossumSpringsWindow();
  });
}

if (possumSpringsWindow) {
  possumSpringsWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  possumSpringsWindow.addEventListener("animationend", (event) => {
    if (event.target !== possumSpringsWindow) return;
    if (event.animationName === "retro-window-open") {
      possumSpringsWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      possumSpringsWindow.classList.remove("is-closing");
      possumSpringsWindow.classList.add("is-hidden");
      possumSpringsWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (wingedLightCollect) {
  wingedLightCollect.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    collectWingedLight();
  });
}

if (wingedLightLater) {
  wingedLightLater.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeWingedLightWindow();
  });
}

if (wingedLightWindow) {
  wingedLightWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  wingedLightWindow.addEventListener("animationend", (event) => {
    if (event.target !== wingedLightWindow) return;
    if (event.animationName === "retro-window-open") {
      wingedLightWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      wingedLightWindow.classList.remove("is-closing");
      wingedLightWindow.classList.add("is-hidden");
      wingedLightWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (manaFloodOk) {
  manaFloodOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeManaFlood();
  });
}

if (manaFloodWindow) {
  manaFloodWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  manaFloodWindow.addEventListener("animationend", (event) => {
    if (event.target !== manaFloodWindow) return;
    if (event.animationName === "retro-window-open") {
      manaFloodWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      manaFloodWindow.classList.remove("is-closing");
      manaFloodWindow.classList.add("is-hidden");
    }
  });
}

if (mimicWarningOk) {
  mimicWarningOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMimicWarning();
  });
}

if (mimicWarningWindow) {
  mimicWarningWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  mimicWarningWindow.addEventListener("animationend", (event) => {
    if (event.target !== mimicWarningWindow) return;
    if (event.animationName === "retro-window-open") {
      mimicWarningWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      mimicWarningWindow.classList.remove("is-closing");
      mimicWarningWindow.classList.add("is-hidden");
    }
  });
}

if (skillCheckRoll) {
  skillCheckRoll.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    beginSkillCheckRoll();
  });
}

if (skillCheckIgnore) {
  skillCheckIgnore.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeSkillCheckWindow();
  });
}

if (skillCheckResultOk) {
  skillCheckResultOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeSkillCheckWindow();
  });
}

[skillCheckWindow, skillCheckResultWindow].forEach((win) => {
  if (!win) return;
  win.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      win.classList.remove("is-closing");
      win.classList.add("is-hidden");
      if (win === skillCheckWindow) resetSkillCheckWindow();
    }
  });
});

if (distressPowerButton) {
  distressPowerButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startDistressPowerSequence();
  });
}

if (distressSignalClose) {
  distressSignalClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeDistressSignalEvent();
  });
}

[distressFrequencyDial, distressPhaseDial].forEach((dial) => {
  if (!dial) return;
  dial.addEventListener("input", () => {
    updateDistressTuning();
  });
});

if (distressUploadOk) {
  distressUploadOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeDistressSignalEvent();
  });
}

[distressSignalWindow, distressUploadWindow].forEach((win) => {
  if (!win) return;
  win.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      win.classList.remove("is-closing");
      win.classList.add("is-hidden");
      win.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
});

[nazarClose, nazarYes, nazarNo].forEach((button) => {
  if (!button) return;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeNazarWindow();
  });
});

if (nazarWindow) {
  nazarWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  nazarWindow.addEventListener("animationend", (event) => {
    if (event.target !== nazarWindow) return;
    if (event.animationName === "retro-window-open") {
      nazarWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      nazarWindow.classList.remove("is-closing");
      nazarWindow.classList.add("is-hidden");
      nazarWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (siteGraceTouch) {
  siteGraceTouch.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    touchSiteGrace();
  });
}

if (siteGraceKeep) {
  siteGraceKeep.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeSiteGraceWindow();
  });
}

if (siteGraceWindow) {
  siteGraceWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  siteGraceWindow.addEventListener("animationend", (event) => {
    if (event.target !== siteGraceWindow) return;
    if (event.animationName === "retro-window-open") {
      siteGraceWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      siteGraceWindow.classList.remove("is-closing");
      siteGraceWindow.classList.add("is-hidden");
      siteGraceWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (stalkerYes) {
  stalkerYes.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeStalkerWindow(stalkerWindow);
    showStalkerResultWindow(stalkerWindow);
  });
}

if (stalkerNo) {
  stalkerNo.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeStalkerWindow(stalkerWindow);
  });
}

if (stalkerResultOk) {
  stalkerResultOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeStalkerWindow(stalkerResultWindow);
  });
}

[stalkerWindow, stalkerResultWindow].forEach((win) => {
  if (!win) return;
  win.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      win.classList.remove("is-closing");
      win.classList.add("is-hidden");
      win.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
});

if (nanaEncounterYes) {
  nanaEncounterYes.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    acceptNanaEncounter();
  });
}

if (nanaEncounterNo) {
  nanaEncounterNo.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeNanaEncounterWindow(nanaEncounterWindow);
  });
}

if (nanaAcceptOk) {
  nanaAcceptOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeNanaEncounterWindow(nanaAcceptWindow);
  });
}

[nanaEncounterWindow, nanaAcceptWindow].forEach((win) => {
  if (!win) return;
  win.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      win.classList.remove("is-closing");
      win.classList.add("is-hidden");
      win.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
});

if (lainAlertOk) {
  lainAlertOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLainAlert();
  });
}

if (lainAlertWindow) {
  lainAlertWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  lainAlertWindow.addEventListener("animationend", (event) => {
    if (event.target !== lainAlertWindow) return;
    if (event.animationName === "retro-window-open") {
      lainAlertWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      lainAlertWindow.classList.remove("is-closing");
      lainAlertWindow.classList.add("is-hidden");
      lainAlertWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (lelouchAlertOk) {
  lelouchAlertOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLelouchAlert();
  });
}

if (lelouchAlertWindow) {
  lelouchAlertWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  lelouchAlertWindow.addEventListener("animationend", (event) => {
    if (event.target !== lelouchAlertWindow) return;
    if (event.animationName === "retro-window-open") {
      lelouchAlertWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      lelouchAlertWindow.classList.remove("is-closing");
      lelouchAlertWindow.classList.add("is-hidden");
      lelouchAlertWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (instrumentalityYes) {
  instrumentalityYes.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeInstrumentalityWindow(instrumentalityWindow);
  });
}

if (instrumentalityNo) {
  instrumentalityNo.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    rejectInstrumentality();
  });
}

if (instrumentalityCongratsOk) {
  instrumentalityCongratsOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeInstrumentalityWindow(instrumentalityCongratsWindow);
  });
}

[instrumentalityWindow, instrumentalityCongratsWindow].forEach((win) => {
  if (!win) return;
  win.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      win.classList.remove("is-closing");
      win.classList.add("is-hidden");
      win.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
});

if (redToolClose) {
  redToolClose.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeRedToolWindow();
  });
}

if (redToolInput) {
  redToolInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    sendRedToolMessage();
  });
}

if (redToolSend) {
  redToolSend.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    sendRedToolMessage();
  });
}

if (redToolWindow) {
  redToolWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  redToolWindow.addEventListener("animationend", (event) => {
    if (event.target !== redToolWindow) return;
    if (event.animationName === "retro-window-open") {
      redToolWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      redToolWindow.classList.remove("is-closing");
      redToolWindow.classList.add("is-hidden");
      redToolWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (fateStart) {
  fateStart.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startFateMinigame();
  });
}

if (fateResist) {
  fateResist.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    resistFate();
  });
}

if (fateResultOk) {
  fateResultOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeFateWindow();
  });
}

document.addEventListener("keydown", handleFateKeyMash);

if (fateWindow) {
  fateWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  fateWindow.addEventListener("animationend", (event) => {
    if (event.target !== fateWindow) return;
    if (event.animationName === "retro-window-open") {
      fateWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      fateWindow.classList.remove("is-closing");
      fateWindow.classList.add("is-hidden");
      fateWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
      if (fateResultImage) fateResultImage.removeAttribute("src");
    }
  });
}

if (behelitOk) {
  behelitOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeBehelitWindow();
  });
}

if (behelitWindow) {
  behelitWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  behelitWindow.addEventListener("animationend", (event) => {
    if (event.target !== behelitWindow) return;
    if (event.animationName === "retro-window-open") {
      behelitWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      behelitWindow.classList.remove("is-closing");
      behelitWindow.classList.add("is-hidden");
      behelitWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

[johnPorkClose, johnPorkAccept, johnPorkDecline].forEach((button) => {
  if (!button) return;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeJohnPorkCall();
  });
});

if (johnPorkWindow) {
  johnPorkWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  johnPorkWindow.addEventListener("animationend", (event) => {
    if (event.target !== johnPorkWindow) return;
    if (event.animationName === "retro-window-open") {
      johnPorkWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      johnPorkWindow.classList.remove("is-closing");
      johnPorkWindow.classList.add("is-hidden");
      stopJohnPorkStatus();
      johnPorkWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (advertisementNoThanks) {
  advertisementNoThanks.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeAdvertisementWindow();
  });
}

if (advertisementWindow) {
  advertisementWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  advertisementWindow.addEventListener("animationend", (event) => {
    if (event.target !== advertisementWindow) return;
    if (event.animationName === "retro-window-open") {
      advertisementWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      advertisementWindow.classList.remove("is-closing");
      advertisementWindow.classList.add("is-hidden");
      advertisementWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (bidenBlastOk) {
  bidenBlastOk.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeBidenBlastWindow();
  });
}

if (bidenBlastWindow) {
  bidenBlastWindow.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  bidenBlastWindow.addEventListener("animationend", (event) => {
    if (event.target !== bidenBlastWindow) return;
    if (event.animationName === "retro-window-open") {
      bidenBlastWindow.classList.remove("is-opening");
      return;
    }
    if (event.animationName === "retro-window-close") {
      bidenBlastWindow.classList.remove("is-closing");
      bidenBlastWindow.classList.add("is-hidden");
      bidenBlastWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

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
    const target =
      event.target instanceof Element ? event.target : event.target?.parentElement;
    const gem = target?.closest("[data-armory-gem]");
    if (!gem || !infinityArmoryGemGrid.contains(gem)) return;
    event.preventDefault();
    event.stopPropagation();
    selectInfinityArmoryGem(gem, event);
  });
}

document.addEventListener("pointermove", moveInfinityArmoryCursorGem);
document.addEventListener("click", (event) => {
  if (!infinityArmorySelectedGem) return;
  const target =
    event.target instanceof Element ? event.target : event.target?.parentElement;
  if (target?.closest("#infinity-armory-window")) return;
  clearInfinityArmorySelectedGem({ status: "Gem returned to inventory." });
});

if (infinityArmoryWindow) {
  infinityArmoryWindow.addEventListener("click", (event) => {
    const target =
      event.target instanceof Element ? event.target : event.target?.parentElement;
    if (
      infinityArmorySelectedGem &&
      !target?.closest("[data-armory-slot], [data-armory-gem]")
    ) {
      clearInfinityArmorySelectedGem({ status: "Gem returned to inventory." });
    }
    event.stopPropagation();
  });

  infinityArmoryWindow.addEventListener("animationend", (event) => {
    if (event.target !== infinityArmoryWindow) return;
    if (event.animationName === "retro-window-open") {
      infinityArmoryWindow.classList.remove("is-opening");
      clampRandomEventWindowToViewport(infinityArmoryWindow);
      return;
    }
    if (event.animationName === "retro-window-close") {
      infinityArmoryWindow.classList.remove("is-closing");
      infinityArmoryWindow.classList.add("is-hidden");
      infinityArmoryWindow.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
}

if (virusYes) {
  virusYes.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    acceptVirusInstall();
  });
}

if (virusNo) {
  virusNo.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeVirusEventWindow(virusWindow);
  });
}

if (virusRescueThanks) {
  virusRescueThanks.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeVirusEventWindow(virusRescueWindow);
  });
}

[virusWindow, virusRescueWindow].forEach((win) => {
  if (!win) return;
  win.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  win.addEventListener("animationend", (event) => {
    if (event.target !== win) return;
    if (event.animationName === "retro-window-open") {
      win.classList.remove("is-opening");
      clampVirusEventWindowToViewport(win);
      return;
    }
    if (event.animationName === "retro-window-close") {
      win.classList.remove("is-closing");
      win.classList.add("is-hidden");
      win.querySelectorAll("img[data-src]").forEach((image) => {
        image.removeAttribute("src");
      });
    }
  });
});

document.addEventListener("click", (event) => {
  if (!calendarPopout.classList.contains("is-open")) return;
  if (calendarPopout.contains(event.target)) return;
  if (calendarButton.contains(event.target)) return;
  closeCalendar();
});

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!event.isTrusted) return;
    markRandomEventUserActivity();
    handleFailedActionTrigger(event);
  },
  { capture: true }
);

document.addEventListener(
  "keydown",
  (event) => {
    if (event.isTrusted) markRandomEventUserActivity();
  },
  { capture: true }
);

document.addEventListener(
  "wheel",
  (event) => {
    if (event.isTrusted) markRandomEventUserActivity();
  },
  { capture: true, passive: true }
);

document.addEventListener(
  "click",
  (event) => {
    if (!event.isTrusted) return;
    const target =
      event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target?.closest("#fate-resist")) return;
    if (target?.closest('[data-app-window="minesweeper"]')) {
      minesweeperRandomEventClickCount += 1;
      if (
        minesweeperRandomEventClickCount %
          MINESWEEPER_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL !==
        0
      ) {
        return;
      }
      triggerRandomEvents("minesweeperClicks", {
        clickCount: minesweeperRandomEventClickCount,
        appId: "minesweeper",
      });
      return;
    }
    if (target?.closest('[data-app-window="solitaire"]')) {
      solitaireRandomEventClickCount += 1;
      if (
        solitaireRandomEventClickCount %
          SOLITAIRE_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL !==
        0
      ) {
        return;
      }
      triggerRandomEvents("solitaireClicks", {
        clickCount: solitaireRandomEventClickCount,
        appId: "solitaire",
      });
      return;
    }
    generalRandomEventClickCount += 1;
    if (
      generalRandomEventClickCount %
        GENERAL_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL !==
      0
    ) {
      return;
    }
    triggerRandomEvents("generalClicks", {
      clickCount: generalRandomEventClickCount,
    });
  },
  { capture: true }
);

document.addEventListener("click", (event) => {
  if (!event.isTrusted) return;
  const link = event.target.closest("a[href]");
  if (!link || !document.documentElement.contains(link)) return;
  if (link.hasAttribute("download")) {
    triggerRandomEvents("fileDownload", {
      href: link.href,
      source: "download-link",
    });
  }
  if (link.target === "_blank") {
    triggerRandomEvents("newTabLink", {
      href: link.href,
      source: "anchor",
    });
  }
});

appButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const appId = button.getAttribute("data-app");
    toggleWindow(appId);
  });
});

document.querySelectorAll("[data-github-shortcut]").forEach((button) => {
  button.addEventListener("click", () => {
    triggerRandomEvents("newTabLink", {
      href: GITHUB_REPOSITORY_URL,
      source: "github-shortcut",
    });
    window.open(GITHUB_REPOSITORY_URL, "_blank", "noopener,noreferrer");
  });
});

if (startButton) {
  startButton.addEventListener("click", () => {
    triggerRandomEvents("startButton");
    closeAllWindows();
  });
}

closeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const appId = button.getAttribute("data-close");
    closeAppWindow(appId);
  });
});

document.addEventListener(
  "pointerdown",
  (event) => {
    if (
      (!snakeState.running && !snakeState.countdownTimer) ||
      !isSnakeWindowVisible()
    ) {
      return;
    }
    const target =
      event.target instanceof Element ? event.target : event.target?.parentElement;
    if (target?.closest('[data-app-window="snake"]')) return;
    pauseSnakeGame();
    snakePointerPauseSuppressUntil = performance.now() + 250;
  },
  true
);

if (snakeStart) {
  snakeStart.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    toggleSnakeGame();
  });
}

if (snakeReset) {
  snakeReset.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    resetSnakeGame();
    if (snakeCanvas) snakeCanvas.focus();
  });
}

if (snakeHelp) {
  snakeHelp.addEventListener("click", (event) => {
    event.preventDefault();
    if (shouldSuppressSnakePointerClick()) return;
    setWindowOpen("snake-rules", true);
  });
}

snakeBoardSizeButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    const selectedSize = Number(button.dataset.snakeBoardSize);
    snakeState.gridSize =
      Number.isFinite(selectedSize) && selectedSize > 0
        ? selectedSize
        : SNAKE_DEFAULT_GRID_SIZE;
    saveSnakeSettings();
    resetSnakeGame();
    if (snakeCanvas) snakeCanvas.focus();
  });
});

snakeColorButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    const selectedColor = button.dataset.snakeColor;
    if (!SNAKE_COLOR_THEMES[selectedColor]) return;
    snakeState.color = selectedColor;
    saveSnakeSettings();
    updateSnakeHud();
    requestSnakeRender();
    if (snakeCanvas) snakeCanvas.focus();
  });
});

snakeAppleColorButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    const selectedColor = button.dataset.snakeAppleColor;
    if (!SNAKE_COLOR_THEMES[selectedColor]) return;
    snakeState.appleColor = selectedColor;
    saveSnakeSettings();
    updateSnakeHud();
    requestSnakeRender();
    if (snakeCanvas) snakeCanvas.focus();
  });
});

snakeDirectionButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (snakeState.loading) return;
    if (shouldSuppressSnakePointerClick()) return;
    const direction = button.getAttribute("data-snake-direction");
    setSnakeDirection(direction);
    if (!snakeState.running && !snakeState.countdownTimer) startSnakeGame();
  });
});

document.addEventListener("keydown", (event) => {
  if (!isSnakeWindowVisible()) return;
  const target =
    event.target instanceof Element ? event.target : event.target?.parentElement;
  if (target?.matches("input, textarea, select")) return;
  if (snakeState.loading) {
    if (
      SNAKE_KEY_DIRECTIONS[event.key] ||
      event.key === " " ||
      event.key === "Enter"
    ) {
      event.preventDefault();
    }
    return;
  }
  if (snakeState.gameOver) {
    if (event.key === "Enter") {
      event.preventDefault();
      resetSnakeGame();
      if (snakeCanvas) snakeCanvas.focus();
      return;
    }
    if (SNAKE_KEY_DIRECTIONS[event.key] || event.key === " ") {
      event.preventDefault();
    }
    return;
  }
  const direction = SNAKE_KEY_DIRECTIONS[event.key];
  const beginsGame =
    !snakeState.hasStarted &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    event.key !== "Shift" &&
    event.key !== "Meta" &&
    event.key !== "Control" &&
    event.key !== "Alt";
  if (direction) {
    event.preventDefault();
    setSnakeDirection(direction);
    if (!snakeState.running && !snakeState.countdownTimer) startSnakeGame();
    return;
  }
  if (beginsGame) {
    event.preventDefault();
    startSnakeGame();
    return;
  }
  if (event.key === " ") {
    event.preventDefault();
    toggleSnakeGame();
  }
});

snakeState.highScores = loadSnakeHighScores();
const selectedSnakeBoardSizeButton =
  document.querySelector("[data-snake-board-size].is-selected") ||
  snakeBoardSizeButtons[0];
if (selectedSnakeBoardSizeButton) {
  const selectedSize = Number(selectedSnakeBoardSizeButton.dataset.snakeBoardSize);
  snakeState.gridSize =
    Number.isFinite(selectedSize) && selectedSize > 0
      ? selectedSize
      : SNAKE_DEFAULT_GRID_SIZE;
}
const selectedSnakeColorButton =
  document.querySelector("[data-snake-color].is-selected") ||
  snakeColorButtons[0];
if (
  selectedSnakeColorButton &&
  SNAKE_COLOR_THEMES[selectedSnakeColorButton.dataset.snakeColor]
) {
  snakeState.color = selectedSnakeColorButton.dataset.snakeColor;
}
const selectedSnakeAppleColorButton =
  document.querySelector("[data-snake-apple-color].is-selected") ||
  snakeAppleColorButtons[0];
if (
  selectedSnakeAppleColorButton &&
  SNAKE_COLOR_THEMES[selectedSnakeAppleColorButton.dataset.snakeAppleColor]
) {
  snakeState.appleColor = selectedSnakeAppleColorButton.dataset.snakeAppleColor;
}
const savedSnakeSettings = loadSnakeSettings();
if (savedSnakeSettings) {
  snakeState.gridSize = savedSnakeSettings.gridSize;
  snakeState.color = savedSnakeSettings.color;
  snakeState.appleColor = savedSnakeSettings.appleColor;
}
resetSnakeGame();

const msGrid = document.getElementById("ms-grid");
const msMines = document.getElementById("ms-mines");
const msTime = document.getElementById("ms-time");
const msReset = document.getElementById("ms-reset");
const msDifficulty = document.getElementById("ms-difficulty");
const msLoseBanner = document.getElementById("ms-lose-banner");
const msAchievement = document.getElementById("ms-achievement");
const msBoard = document.querySelector("[data-app-window=\"minesweeper\"] .ms-board");
const msHelp = document.getElementById("ms-help");

const msConfig = {
  beginner: { cols: 9, rows: 9, mines: 10 },
  intermediate: { cols: 16, rows: 16, mines: 40 },
  expert: { cols: 30, rows: 16, mines: 99 },
};

const msDigitSources = {
  "0": "assets/minesweeper_assets/digital_digits/digital_0.png",
  "1": "assets/minesweeper_assets/digital_digits/digital_1.png",
  "2": "assets/minesweeper_assets/digital_digits/digital_2.png",
  "3": "assets/minesweeper_assets/digital_digits/digital_3.png",
  "4": "assets/minesweeper_assets/digital_digits/digital_4.png",
  "5": "assets/minesweeper_assets/digital_digits/digital_5.png",
  "6": "assets/minesweeper_assets/digital_digits/digital_6.png",
  "7": "assets/minesweeper_assets/digital_digits/digital_7.png",
  "8": "assets/minesweeper_assets/digital_digits/digital_8.png",
  "9": "assets/minesweeper_assets/digital_digits/digital_9.png",
  "-": "assets/minesweeper_assets/digital_digits/digital_minus.png",
  " ": "assets/minesweeper_assets/digital_digits/digital_blank.png",
};

const msState = {
  cols: 9,
  rows: 9,
  mines: 10,
  cells: [],
  elements: [],
  started: false,
  gameOver: false,
  timerId: null,
  elapsed: 0,
};

const msConfettiCanvas = document.getElementById("ms-confetti");
const msConfettiCtx = msConfettiCanvas ? msConfettiCanvas.getContext("2d") : null;
let msConfettiPieces = [];
let msConfettiAnimId = null;

const msResizeConfetti = () => {
  if (!msConfettiCanvas) return;
  msConfettiCanvas.width = window.innerWidth;
  msConfettiCanvas.height = window.innerHeight;
};

const msStartConfetti = () => {
  if (!msConfettiCanvas || !msConfettiCtx) return;
  msResizeConfetti();
  msConfettiPieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * msConfettiCanvas.width,
    y: -20 - Math.random() * msConfettiCanvas.height * 0.3,
    size: 4 + Math.random() * 6,
    speed: 1 + Math.random() * 3,
    drift: (Math.random() - 0.5) * 1.5,
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 0.2,
    color: `hsl(${Math.random() * 360}, 90%, 60%)`,
  }));
  if (msConfettiAnimId) cancelAnimationFrame(msConfettiAnimId);

  const animate = () => {
    if (!msConfettiCanvas || !msConfettiCtx) return;
    msConfettiCtx.clearRect(0, 0, msConfettiCanvas.width, msConfettiCanvas.height);
    msConfettiPieces.forEach((piece) => {
      piece.x += piece.drift;
      piece.y += piece.speed;
      piece.rotation += piece.rotationSpeed;
      msConfettiCtx.save();
      msConfettiCtx.translate(piece.x, piece.y);
      msConfettiCtx.rotate(piece.rotation);
      msConfettiCtx.fillStyle = piece.color;
      msConfettiCtx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
      msConfettiCtx.restore();
    });
    msConfettiPieces = msConfettiPieces.filter(
      (piece) => piece.y < msConfettiCanvas.height + 30
    );
    if (msConfettiPieces.length > 0) {
      msConfettiAnimId = requestAnimationFrame(animate);
    } else {
      if (msConfettiAnimId) cancelAnimationFrame(msConfettiAnimId);
      msConfettiAnimId = null;
      msConfettiCtx.clearRect(0, 0, msConfettiCanvas.width, msConfettiCanvas.height);
    }
  };
  animate();
};

const msShowAchievement = () => {
  if (!msAchievement) return;
  msAchievement.classList.remove("is-showing");
  void msAchievement.offsetWidth;
  msAchievement.classList.add("is-showing");
};

const msIndex = (x, y) => y * msState.cols + x;

const msNeighbors = (index) => {
  const x = index % msState.cols;
  const y = Math.floor(index / msState.cols);
  const list = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= msState.cols || ny >= msState.rows) continue;
      list.push(msIndex(nx, ny));
    }
  }
  return list;
};

const msFormatCounter = (value) => {
  const clamped = Math.max(-99, Math.min(999, value));
  if (clamped < 0) {
    return `-${String(Math.abs(clamped)).padStart(2, "0")}`;
  }
  return String(clamped).padStart(3, "0");
};

const msSetCounter = (el, value) => {
  if (!el) return;
  const digits = String(value).padStart(3, " ").slice(-3);
  const imgs = el.querySelectorAll("img");
  imgs.forEach((img, index) => {
    const char = digits[index] ?? " ";
    img.src = msDigitSources[char] || msDigitSources[" "];
    img.alt = char.trim() || " ";
  });
};

const msUpdateCounters = () => {
  if (!msMines || !msTime) return;
  const flags = msState.cells.filter((cell) => cell.flagged).length;
  const remaining = msState.mines - flags;
  msSetCounter(msMines, msFormatCounter(remaining));
  msSetCounter(msTime, msFormatCounter(msState.elapsed));
};

const msSetFace = (face) => {
  if (msReset) msReset.setAttribute("data-face", face);
};

const msStopTimer = () => {
  if (msState.timerId) {
    clearInterval(msState.timerId);
    msState.timerId = null;
  }
};

const msStartTimer = () => {
  msStopTimer();
  msState.timerId = setInterval(() => {
    if (msState.gameOver || !msState.started) return;
    if (msState.elapsed >= 999) return;
    msState.elapsed += 1;
    msUpdateCounters();
  }, 1000);
};

const msPlaceMines = (safeIndex) => {
  const forbidden = new Set([safeIndex, ...msNeighbors(safeIndex)]);
  const choices = [];
  for (let i = 0; i < msState.cols * msState.rows; i += 1) {
    if (!forbidden.has(i)) choices.push(i);
  }
  for (let i = choices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  for (let i = 0; i < msState.mines; i += 1) {
    const idx = choices[i];
    if (idx === undefined) break;
    msState.cells[idx].mine = true;
  }
};

const msComputeAdjacents = () => {
  msState.cells.forEach((cell, index) => {
    if (cell.mine) {
      cell.adjacent = 0;
      return;
    }
    const count = msNeighbors(index).filter((n) => msState.cells[n].mine).length;
    cell.adjacent = count;
  });
};

const msRevealCell = (index) => {
  const cell = msState.cells[index];
  if (!cell || cell.revealed || cell.flagged) return;
  cell.question = false;
  cell.revealed = true;
  if (cell.mine) {
    cell.blown = true;
    msState.gameOver = true;
    msSetFace("lose");
    msStopTimer();
    if (msLoseBanner) msLoseBanner.classList.add("is-visible");
    msRevealAllMines();
    msRenderCell(index);
    triggerRandomEvents("gameLoss", { game: "minesweeper" });
    return;
  }
  msRenderCell(index);
  if (cell.adjacent === 0) {
    const queue = [index];
    const visited = new Set(queue);
    while (queue.length) {
      const current = queue.shift();
      msNeighbors(current).forEach((n) => {
        const neighbor = msState.cells[n];
        if (!neighbor || neighbor.revealed || neighbor.flagged) return;
        neighbor.question = false;
        neighbor.revealed = true;
        msRenderCell(n);
        if (neighbor.adjacent === 0 && !visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      });
    }
  }
  msCheckWin();
};

const msRevealAllMines = () => {
  msState.cells.forEach((cell) => {
    if (cell.mine) {
      cell.revealed = true;
    } else if (cell.flagged) {
      cell.misflagged = true;
    }
  });
  msRenderAll();
};

const msCheckWin = () => {
  if (msState.gameOver) return;
  const safeCells = msState.cells.filter((cell) => !cell.mine);
  const revealedSafe = safeCells.filter((cell) => cell.revealed).length;
  if (revealedSafe === safeCells.length) {
    msState.gameOver = true;
    msSetFace("win");
    msStopTimer();
    msStartConfetti();
    if (msDifficulty && msDifficulty.value === "expert") {
      msShowAchievement();
    }
    msState.cells.forEach((cell) => {
      if (cell.mine) cell.flagged = true;
    });
    msRenderAll();
    triggerRandomEvents("gameWin", { game: "minesweeper" });
  }
};

const msRenderCell = (index) => {
  const cell = msState.cells[index];
  const el = msState.elements[index];
  if (!cell || !el) return;
  el.className = "ms-cell";
  el.removeAttribute("data-number");
  el.textContent = "";
  if (cell.misflagged) {
    el.classList.add("is-mine-wrong");
    return;
  }
  if (cell.revealed) {
    el.classList.add("is-revealed");
    if (cell.mine) {
      el.classList.add("is-mine");
      if (cell.blown) el.classList.add("is-blown");
    } else if (cell.adjacent > 0) {
      el.setAttribute("data-number", String(cell.adjacent));
    }
    return;
  }
  if (cell.flagged) {
    el.classList.add("is-flagged");
  } else if (cell.question) {
    el.classList.add("is-question");
  }
};

const msRenderAll = () => {
  msState.cells.forEach((_, index) => msRenderCell(index));
  msUpdateCounters();
};

const msBuildGrid = () => {
  if (!msGrid) return;
  msGrid.innerHTML = "";
  msState.elements = [];
  msGrid.style.gridTemplateColumns = `repeat(${msState.cols}, var(--ms-cell-size))`;
  msGrid.style.gridTemplateRows = `repeat(${msState.rows}, var(--ms-cell-size))`;
  for (let i = 0; i < msState.cols * msState.rows; i += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ms-cell";
    button.setAttribute("data-index", String(i));
    button.setAttribute("role", "gridcell");
    msGrid.appendChild(button);
    msState.elements.push(button);
  }
};

const msUpdateBoardAlignment = () => {
  if (!msBoard || !msGrid) return;
  const shouldOverflow = msGrid.scrollWidth > msBoard.clientWidth;
  msBoard.classList.toggle("is-overflowing", shouldOverflow);
};

const msNewGame = (difficulty) => {
  const config = msConfig[difficulty] || msConfig.beginner;
  msState.cols = config.cols;
  msState.rows = config.rows;
  msState.mines = config.mines;
  msState.cells = Array.from({ length: config.cols * config.rows }, () => ({
    mine: false,
    revealed: false,
    flagged: false,
    question: false,
    blown: false,
    misflagged: false,
    adjacent: 0,
  }));
  msState.started = false;
  msState.gameOver = false;
  msState.elapsed = 0;
  msSetFace("smile");
  msStopTimer();
  if (msLoseBanner) msLoseBanner.classList.remove("is-visible");
  msBuildGrid();
  msUpdateBoardAlignment();
  msUpdateCounters();
};

const msHandleLeftClick = (index) => {
  if (msState.gameOver) return;
  const cell = msState.cells[index];
  if (!cell) return;
  if (cell.revealed) {
    msChord(index);
    return;
  }
  if (!msState.started) {
    msPlaceMines(index);
    msComputeAdjacents();
    msState.started = true;
    msStartTimer();
  }
  msRevealCell(index);
};

const msToggleFlag = (index) => {
  const cell = msState.cells[index];
  if (!cell || cell.revealed || msState.gameOver) return;
  if (!cell.flagged && !cell.question) {
    cell.flagged = true;
  } else if (cell.flagged) {
    cell.flagged = false;
    cell.question = true;
  } else if (cell.question) {
    cell.question = false;
  }
  msRenderCell(index);
  msUpdateCounters();
};

const msChord = (index) => {
  const cell = msState.cells[index];
  if (!cell || !cell.revealed || cell.adjacent === 0 || msState.gameOver) return;
  const neighbors = msNeighbors(index);
  const flaggedCount = neighbors.filter((n) => msState.cells[n].flagged).length;
  if (flaggedCount !== cell.adjacent) return;
  neighbors.forEach((n) => {
    if (!msState.cells[n].flagged) msRevealCell(n);
  });
};

if (msGrid) {
  msGrid.addEventListener("click", (event) => {
    const cell = event.target.closest(".ms-cell");
    if (!cell) return;
    const index = Number(cell.getAttribute("data-index"));
    if (Number.isNaN(index)) return;
    msHandleLeftClick(index);
  });

  msGrid.addEventListener("dblclick", (event) => {
    const cell = event.target.closest(".ms-cell");
    if (!cell) return;
    const index = Number(cell.getAttribute("data-index"));
    if (Number.isNaN(index)) return;
    msChord(index);
  });

  msGrid.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest(".ms-cell");
    if (!cell) return;
    event.preventDefault();
    const index = Number(cell.getAttribute("data-index"));
    if (Number.isNaN(index)) return;
    msToggleFlag(index);
  });

  msGrid.addEventListener("pointerdown", (event) => {
    if (msState.gameOver) return;
    const cell = event.target.closest(".ms-cell");
    if (!cell) return;
    msSetFace("ooh");
    cell.classList.add("is-pressed");
    if (cell.classList.contains("is-question")) {
      cell.classList.add("is-pressed");
    }
  });

  msGrid.addEventListener("pointerup", (event) => {
    if (!msState.gameOver) msSetFace("smile");
    const cell = event.target.closest(".ms-cell");
    if (cell) cell.classList.remove("is-pressed");
  });

  msGrid.addEventListener("pointerleave", () => {
    if (!msState.gameOver) msSetFace("smile");
    msGrid.querySelectorAll(".ms-cell.is-pressed").forEach((cell) => {
      cell.classList.remove("is-pressed");
    });
  });
}

if (msReset) {
  msReset.addEventListener("click", () => {
    msNewGame(msDifficulty ? msDifficulty.value : "beginner");
  });

  msReset.addEventListener("pointerdown", () => {
    if (!msState.gameOver) msSetFace("pressed");
  });

  msReset.addEventListener("pointerup", () => {
    if (!msState.gameOver) msSetFace("smile");
  });

  msReset.addEventListener("pointerleave", () => {
    if (!msState.gameOver) msSetFace("smile");
  });
}

if (msAchievement) {
  msAchievement.addEventListener("animationend", () => {
    msAchievement.classList.remove("is-showing");
  });
}

if (msHelp) {
  msHelp.addEventListener("click", () => {
    triggerRandomEvents("newTabLink", {
      href: "https://en.wikipedia.org/wiki/Minesweeper_(video_game)",
      source: "minesweeper-help",
    });
    window.open("https://en.wikipedia.org/wiki/Minesweeper_(video_game)", "_blank", "noopener,noreferrer");
  });
}

if (msDifficulty) {
  msDifficulty.addEventListener("change", () => {
    msNewGame(msDifficulty.value);
  });
}

msNewGame("beginner");

const solBoard = document.getElementById("sol-board");
const solStock = document.getElementById("sol-stock");
const solWaste = document.getElementById("sol-waste");
const solTableau = document.getElementById("sol-tableau");
const solFoundationSlots = document.querySelectorAll("[data-sol-foundation]");
const solMoves = document.getElementById("sol-moves");
const solStatus = document.getElementById("sol-status");
const solHelp = document.getElementById("sol-help");
const solRulesHelp = document.getElementById("sol-rules-help");
const solReset = document.getElementById("sol-reset");
const solUndo = document.getElementById("sol-undo");
const solAchievement = document.getElementById("sol-achievement");
const solFireworks = document.getElementById("sol-fireworks");
const solVictoryVideoOverlay = document.getElementById("sol-victory-video-overlay");
const solVictoryVideo = document.getElementById("sol-victory-video");
const solVictoryCanvas = document.getElementById("sol-victory-canvas");

const solSuitData = {
  spades: { symbol: "♠", label: "Spades", color: "black" },
  clubs: { symbol: "♣", label: "Clubs", color: "black" },
  diamonds: { symbol: "♦", label: "Diamonds", color: "red" },
  hearts: { symbol: "♥", label: "Hearts", color: "red" },
};

const solSuitOrder = ["spades", "clubs", "diamonds", "hearts"];
const solRankNames = {
  1: "Ace",
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
  11: "Jack",
  12: "Queen",
  13: "King",
};

const solState = {
  stock: [],
  waste: [],
  foundations: {
    spades: [],
    clubs: [],
    diamonds: [],
    hearts: [],
  },
  tableau: [],
  selected: null,
  moves: 0,
  won: false,
};
const solHistory = [];
const solFireworkColors = [
  "#ff004d",
  "#ffa300",
  "#fff024",
  "#00e756",
  "#29adff",
  "#83769c",
  "#ff77a8",
  "#ffffff",
];
let solFireworkTimeout = null;
let solFireworkTimers = [];
let solVictoryFrameRequest = null;
let solVictoryScratchCanvas = null;
let solActiveTableauTooltip = null;
let solLastCardClick = null;

const solSprite = {
  cardHeight: 22,
  imageHeight: 114,
  backCol: 10,
  backRow: 4,
};

const solCardColor = (card) => solSuitData[card.suit].color;

const solCardName = (card) =>
  `${solRankNames[card.rank]} of ${solSuitData[card.suit].label}`;

const solCardShortName = (card) => {
  const rank = { 1: "A", 11: "J", 12: "Q", 13: "K" }[card.rank] || card.rank;
  return `${rank} ${solSuitData[card.suit].symbol}`;
};

const solPositionTableauTooltip = (tooltip, pointer) => {
  const offset = 12;
  const minEdge = 4;
  tooltip.style.left = `${pointer.clientX + offset}px`;
  tooltip.style.top = `${pointer.clientY + offset}px`;
  if (!tooltip.classList.contains("is-visible")) return;

  const bounds = tooltip.getBoundingClientRect();
  const left = Math.min(pointer.clientX + offset, window.innerWidth - bounds.width - minEdge);
  const top = Math.min(pointer.clientY + offset, window.innerHeight - bounds.height - minEdge);
  tooltip.style.left = `${Math.max(minEdge, left)}px`;
  tooltip.style.top = `${Math.max(minEdge, top)}px`;
};

const solHideTableauTooltip = () => {
  if (solActiveTableauTooltip) {
    solActiveTableauTooltip.classList.remove("is-visible");
    solActiveTableauTooltip = null;
  }
};

const solAttachTableauTooltip = (column, tooltip) => {
  let pointer = null;

  const updatePointer = (event) => {
    const card = event.target.closest(".sol-card:not(.is-face-down)");
    if (!card || !column.contains(card)) {
      pointer = null;
      if (solActiveTableauTooltip === tooltip) solHideTableauTooltip();
      return;
    }

    pointer = { clientX: event.clientX, clientY: event.clientY };
    if (solActiveTableauTooltip !== tooltip) {
      solHideTableauTooltip();
      solActiveTableauTooltip = tooltip;
      tooltip.classList.add("is-visible");
    }
    solPositionTableauTooltip(tooltip, pointer);
  };

  column.addEventListener("pointerenter", updatePointer);
  column.addEventListener("pointermove", updatePointer);

  column.addEventListener("pointerleave", () => {
    pointer = null;
    if (solActiveTableauTooltip === tooltip) solHideTableauTooltip();
  });
};

const solSpritePosition = (col, row) => {
  const x = col === 0 ? 0 : (col / 12) * 100;
  const yDenominator = solSprite.imageHeight - solSprite.cardHeight;
  const y = row === 0 ? 0 : ((row * solSprite.cardHeight) / yDenominator) * 100;
  return {
    x: `${x.toFixed(4)}%`,
    y: `${y.toFixed(4)}%`,
  };
};

const solApplyCardSprite = (button, col, row) => {
  const position = solSpritePosition(col, row);
  button.style.setProperty("--sol-sprite-x", position.x);
  button.style.setProperty("--sol-sprite-y", position.y);
};

const solBuildDeck = () => {
  const deck = [];
  solSuitOrder.forEach((suit) => {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        faceUp: false,
      });
    }
  });
  return deck;
};

const solShuffle = (cards) => {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
};

const solCloneCards = (cards) => cards.map((card) => ({ ...card }));

const solSnapshot = () => ({
  stock: solCloneCards(solState.stock),
  waste: solCloneCards(solState.waste),
  foundations: {
    spades: solCloneCards(solState.foundations.spades),
    clubs: solCloneCards(solState.foundations.clubs),
    diamonds: solCloneCards(solState.foundations.diamonds),
    hearts: solCloneCards(solState.foundations.hearts),
  },
  tableau: solState.tableau.map(solCloneCards),
  moves: solState.moves,
  won: solState.won,
});

const solPushUndo = () => {
  solHistory.push(solSnapshot());
  if (solHistory.length > 100) solHistory.shift();
};

const solRestoreSnapshot = (snapshot) => {
  solState.stock = solCloneCards(snapshot.stock);
  solState.waste = solCloneCards(snapshot.waste);
  solState.foundations = {
    spades: solCloneCards(snapshot.foundations.spades),
    clubs: solCloneCards(snapshot.foundations.clubs),
    diamonds: solCloneCards(snapshot.foundations.diamonds),
    hearts: solCloneCards(snapshot.foundations.hearts),
  };
  solState.tableau = snapshot.tableau.map(solCloneCards);
  solState.selected = null;
  solState.moves = snapshot.moves;
  solState.won = snapshot.won;
};

const solShowAchievement = () => {
  if (!solAchievement) return;
  solAchievement.classList.remove("is-showing");
  void solAchievement.offsetWidth;
  solAchievement.classList.add("is-showing");
};

const solHideVictoryVideo = () => {
  if (!solVictoryVideoOverlay || !solVictoryVideo) return;
  if (solVictoryFrameRequest) {
    cancelAnimationFrame(solVictoryFrameRequest);
    solVictoryFrameRequest = null;
  }
  solVictoryVideoOverlay.classList.remove("is-showing");
  solVictoryVideoOverlay.setAttribute("aria-hidden", "true");
  solVictoryVideo.classList.remove("is-visible-fallback");
  if (solVictoryCanvas) {
    solVictoryCanvas.classList.remove("is-hidden");
    const context = solVictoryCanvas.getContext("2d");
    if (context) context.clearRect(0, 0, solVictoryCanvas.width, solVictoryCanvas.height);
  }
  solVictoryVideo.pause();
  try {
    solVictoryVideo.currentTime = 0;
  } catch (error) {
    // Some browsers delay seeking until video metadata is ready.
  }
};

const solDrawVictoryFrame = () => {
  solVictoryFrameRequest = null;
  if (!solVictoryVideoOverlay || !solVictoryVideo || !solVictoryCanvas) return;
  if (!solVictoryVideoOverlay.classList.contains("is-showing")) return;

  const sourceWidth = solVictoryVideo.videoWidth;
  const sourceHeight = solVictoryVideo.videoHeight;
  if (!sourceWidth || !sourceHeight) {
    if (!solVictoryVideo.paused && !solVictoryVideo.ended) {
      solVictoryFrameRequest = requestAnimationFrame(solDrawVictoryFrame);
    }
    return;
  }

  const width = Math.min(sourceWidth, 960);
  const height = Math.round((sourceHeight / sourceWidth) * width);

  if (!solVictoryScratchCanvas) {
    solVictoryScratchCanvas = document.createElement("canvas");
  }

  if (
    solVictoryScratchCanvas.width !== width ||
    solVictoryScratchCanvas.height !== height
  ) {
    solVictoryScratchCanvas.width = width;
    solVictoryScratchCanvas.height = height;
  }

  const scratchContext = solVictoryScratchCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!scratchContext) return;

  try {
    scratchContext.clearRect(0, 0, width, height);
    scratchContext.drawImage(solVictoryVideo, 0, 0, width, height);
    const frame = scratchContext.getImageData(0, 0, width, height);
    const pixels = frame.data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let i = 0; i < pixels.length; i += 4) {
      const brightest = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
      if (brightest < 32) {
        pixels[i + 3] = 0;
      } else if (brightest < 72) {
        pixels[i + 3] = Math.round(pixels[i + 3] * ((brightest - 32) / 40));
      }

      if (pixels[i + 3] > 8) {
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    const context = solVictoryCanvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    if (maxX < minX || maxY < minY) {
      context.clearRect(0, 0, solVictoryCanvas.width, solVictoryCanvas.height);
      return;
    }

    const cropPadding = Math.max(
      6,
      Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * 0.04)
    );
    const cropX = Math.max(0, minX - cropPadding);
    const cropY = Math.max(0, minY - cropPadding);
    const cropRight = Math.min(width - 1, maxX + cropPadding);
    const cropBottom = Math.min(height - 1, maxY + cropPadding);
    const cropWidth = cropRight - cropX + 1;
    const cropHeight = cropBottom - cropY + 1;

    if (
      solVictoryCanvas.width !== cropWidth ||
      solVictoryCanvas.height !== cropHeight
    ) {
      solVictoryCanvas.width = cropWidth;
      solVictoryCanvas.height = cropHeight;
    }

    const croppedFrame = context.createImageData(cropWidth, cropHeight);
    for (let y = 0; y < cropHeight; y += 1) {
      const sourceStart = ((cropY + y) * width + cropX) * 4;
      const sourceEnd = sourceStart + cropWidth * 4;
      croppedFrame.data.set(
        pixels.subarray(sourceStart, sourceEnd),
        y * cropWidth * 4
      );
    }

    context.putImageData(croppedFrame, 0, 0);
  } catch (error) {
    solVictoryCanvas.classList.add("is-hidden");
    solVictoryVideo.classList.add("is-visible-fallback");
    return;
  }

  if (!solVictoryVideo.paused && !solVictoryVideo.ended) {
    solVictoryFrameRequest = requestAnimationFrame(solDrawVictoryFrame);
  }
};

const solStartVictoryCanvas = () => {
  if (!solVictoryCanvas) return;
  if (solVictoryFrameRequest) cancelAnimationFrame(solVictoryFrameRequest);
  solVictoryFrameRequest = requestAnimationFrame(solDrawVictoryFrame);
};

const solPlayVictoryVideo = () => {
  if (!solVictoryVideoOverlay || !solVictoryVideo) return;
  loadDeferredMedia(solVictoryVideo);
  solVictoryVideoOverlay.classList.add("is-showing");
  solVictoryVideoOverlay.setAttribute("aria-hidden", "false");
  solVictoryVideo.classList.remove("is-visible-fallback");
  if (solVictoryCanvas) solVictoryCanvas.classList.remove("is-hidden");
  solVictoryVideo.pause();
  solVictoryVideo.muted = false;
  solVictoryVideo.volume = 1;
  try {
    solVictoryVideo.currentTime = 0;
  } catch (error) {
    solVictoryVideo.load();
  }

  solStartVictoryCanvas();
  const playPromise = solVictoryVideo.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.then(solStartVictoryCanvas).catch(() => {});
  }
};

const solCreateFireworkBurst = (x, y) => {
  if (!solFireworks) return;
  const particleCount = 46;

  for (let i = 0; i < particleCount; i += 1) {
    const dot = document.createElement("span");
    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.22;
    const distance = 60 + Math.random() * 155;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance + 38;
    const color =
      solFireworkColors[Math.floor(Math.random() * solFireworkColors.length)];

    dot.className = "sol-firework-dot";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.setProperty("--sol-firework-dx", `${dx.toFixed(1)}px`);
    dot.style.setProperty("--sol-firework-dy", `${dy.toFixed(1)}px`);
    dot.style.setProperty("--sol-firework-color", color);
    solFireworks.appendChild(dot);
  }
};

const solStartFireworks = () => {
  if (!solFireworks) return;
  solFireworkTimers.forEach((timer) => clearTimeout(timer));
  solFireworkTimers = [];
  if (solFireworkTimeout) clearTimeout(solFireworkTimeout);

  solFireworks.innerHTML = "";
  solFireworks.classList.add("is-showing");
  solFireworks.setAttribute("aria-hidden", "false");

  const burstCount = 9;
  for (let i = 0; i < burstCount; i += 1) {
    const timer = setTimeout(() => {
      const x = window.innerWidth * (0.18 + Math.random() * 0.64);
      const y = window.innerHeight * (0.16 + Math.random() * 0.42);
      solCreateFireworkBurst(x, y);
    }, i * 260);
    solFireworkTimers.push(timer);
  }

  solFireworkTimeout = setTimeout(() => {
    solFireworks.classList.remove("is-showing");
    solFireworks.setAttribute("aria-hidden", "true");
    solFireworks.innerHTML = "";
    solFireworkTimers = [];
    solFireworkTimeout = null;
  }, 3600);
};

const solTriggerVictoryEffects = () => {
  solStartFireworks();
  solShowAchievement();
  solPlayVictoryVideo();
  triggerRandomEvents("gameWin", { game: "solitaire" });
};

const solCreateSlotMark = (text) => {
  const mark = document.createElement("span");
  mark.className = "sol-slot-mark";
  mark.textContent = text;
  return mark;
};

const solSelectionMatches = (zone, pile, index) => {
  const selected = solState.selected;
  return (
    selected &&
    selected.zone === zone &&
    selected.pile === pile &&
    selected.index === index
  );
};

const solIsSelectedCard = (card) =>
  Boolean(
    solState.selected &&
      solState.selected.cards.some((selectedCard) => selectedCard.id === card.id)
  );

const solCreateCardElement = (card, zone, pile, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sol-card";
  button.setAttribute("data-sol-card-id", card.id);
  button.setAttribute("data-sol-zone", zone);
  button.setAttribute("data-sol-pile", String(pile));
  button.setAttribute("data-sol-index", String(index));

  if (!card.faceUp) {
    button.classList.add("is-face-down");
    solApplyCardSprite(button, solSprite.backCol, solSprite.backRow);
    button.setAttribute("aria-label", "Face-down card");
    return button;
  }

  if (solIsSelectedCard(card)) {
    button.classList.add("is-selected");
  }

  solApplyCardSprite(button, card.rank - 1, solSuitOrder.indexOf(card.suit));
  button.setAttribute("aria-label", solCardName(card));

  return button;
};

const solCreateStockBack = () => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sol-card is-face-down";
  button.setAttribute("data-sol-stock", "");
  button.setAttribute("aria-label", `Stock, ${solState.stock.length} cards`);
  solApplyCardSprite(button, solSprite.backCol, solSprite.backRow);
  return button;
};

const solRender = () => {
  if (!solBoard || !solStock || !solWaste || !solTableau) return;

  solStock.innerHTML = "";
  if (solState.stock.length) {
    solStock.appendChild(solCreateStockBack());
    solStock.setAttribute("aria-label", `Stock, ${solState.stock.length} cards`);
  } else {
    if (solState.waste.length) solStock.appendChild(solCreateSlotMark("↻"));
    solStock.setAttribute(
      "aria-label",
      solState.waste.length ? "Restock waste" : "Empty stock"
    );
  }

  solWaste.innerHTML = "";
  const wasteTop = solState.waste[solState.waste.length - 1];
  if (wasteTop) {
    solWaste.appendChild(
      solCreateCardElement(wasteTop, "waste", "waste", solState.waste.length - 1)
    );
  } else {
    solWaste.appendChild(solCreateSlotMark("W"));
  }
  solWaste.setAttribute("aria-label", wasteTop ? `Waste, ${solCardName(wasteTop)}` : "Waste");

  solFoundationSlots.forEach((slot) => {
    const suit = slot.getAttribute("data-sol-foundation");
    const pile = solState.foundations[suit] || [];
    const topCard = pile[pile.length - 1];
    slot.innerHTML = "";
    if (topCard) {
      slot.appendChild(solCreateCardElement(topCard, "foundation", suit, pile.length - 1));
    } else {
      slot.appendChild(solCreateSlotMark(solSuitData[suit].symbol));
    }
    slot.setAttribute(
      "aria-label",
      topCard
        ? `${solSuitData[suit].label} foundation, ${solCardName(topCard)}`
        : `${solSuitData[suit].label} foundation`
    );
  });

  solHideTableauTooltip();
  document.querySelectorAll(".sol-tableau-tooltip").forEach((tooltip) => {
    tooltip.remove();
  });
  solTableau.innerHTML = "";
  solState.tableau.forEach((column, colIndex) => {
    const columnEl = document.createElement("div");
    columnEl.className = "sol-tableau-col";
    columnEl.setAttribute("data-sol-col", String(colIndex));
    columnEl.setAttribute("role", "button");
    columnEl.setAttribute("tabindex", "0");
    columnEl.setAttribute("aria-label", `Tableau column ${colIndex + 1}`);

    if (!column.length) {
      const emptySlot = document.createElement("div");
      emptySlot.className = "sol-slot";
      emptySlot.setAttribute("aria-hidden", "true");
      columnEl.appendChild(emptySlot);
    } else {
      column.forEach((card, cardIndex) => {
        columnEl.appendChild(
          solCreateCardElement(card, "tableau", colIndex, cardIndex)
        );
      });

      const bottomCard = column.find((card) => card.faceUp);
      if (bottomCard) {
        const tooltip = document.createElement("span");
        tooltip.className = "sol-tableau-tooltip";
        tooltip.setAttribute("role", "tooltip");
        tooltip.textContent = `Bottom: ${solCardShortName(bottomCard)}`;
        document.body.appendChild(tooltip);
        solAttachTableauTooltip(columnEl, tooltip);
        columnEl.setAttribute(
          "aria-label",
          `Tableau column ${colIndex + 1}, bottom card ${solCardName(bottomCard)}`
        );
      }
    }

    solTableau.appendChild(columnEl);
  });

  if (solMoves) msSetCounter(solMoves, msFormatCounter(solState.moves));
  if (solStatus) solStatus.textContent = "";
  if (solUndo) solUndo.disabled = solState.won || solHistory.length === 0;
};

const solCheckWin = () => {
  const foundationCount = solSuitOrder.reduce(
    (total, suit) => total + solState.foundations[suit].length,
    0
  );
  const wasWon = solState.won;
  solState.won = foundationCount === 52;
  if (!wasWon && solState.won) {
    solTriggerVictoryEffects();
  }
};

const solFlipSourceTopCard = (selected) => {
  if (!selected || selected.zone !== "tableau") return;
  const column = solState.tableau[selected.pile];
  const topCard = column[column.length - 1];
  if (topCard && !topCard.faceUp) topCard.faceUp = true;
};

const solRemoveSelectedCards = () => {
  const selected = solState.selected;
  if (!selected) return [];

  if (selected.zone === "waste") {
    return solState.waste.splice(selected.index, 1);
  }

  if (selected.zone === "tableau") {
    return solState.tableau[selected.pile].splice(selected.index);
  }

  if (selected.zone === "foundation") {
    return solState.foundations[selected.pile].splice(selected.index, 1);
  }

  return [];
};

const solCompleteMove = (selected) => {
  solFlipSourceTopCard(selected);
  solState.selected = null;
  solState.moves += 1;
  solCheckWin();
  solRender();
};

const solIsPackedTableauStack = (cards) => {
  if (!cards.length || cards.some((card) => !card.faceUp)) return false;

  for (let i = 0; i < cards.length - 1; i += 1) {
    const upper = cards[i];
    const lower = cards[i + 1];
    if (solCardColor(upper) === solCardColor(lower)) return false;
    if (upper.rank !== lower.rank + 1) return false;
  }

  return true;
};

const solCanMoveToTableau = (cards, column) => {
  const firstCard = cards[0];
  if (!firstCard) return false;
  if (!solIsPackedTableauStack(cards)) return false;
  const targetCard = column[column.length - 1];

  if (!targetCard) return firstCard.rank === 13;
  if (!targetCard.faceUp) return false;

  return (
    solCardColor(firstCard) !== solCardColor(targetCard) &&
    firstCard.rank + 1 === targetCard.rank
  );
};

const solCanMoveToFoundation = (cards, suit) => {
  if (!cards || cards.length !== 1) return false;
  const card = cards[0];
  if (card.suit !== suit) return false;

  const foundation = solState.foundations[suit];
  const topCard = foundation[foundation.length - 1];
  if (!topCard) return card.rank === 1;
  return card.rank === topCard.rank + 1;
};

const solMoveSelectedToTableau = (colIndex) => {
  const selected = solState.selected;
  if (!selected) return false;
  if (selected.zone === "tableau" && selected.pile === colIndex) return false;

  const column = solState.tableau[colIndex];
  if (!solCanMoveToTableau(selected.cards, column)) return false;

  solPushUndo();
  const movingCards = solRemoveSelectedCards();
  column.push(...movingCards);
  solCompleteMove(selected);
  return true;
};

const solMoveSelectedToFoundation = (suit) => {
  const selected = solState.selected;
  if (!selected) return false;
  if (selected.zone === "foundation" && selected.pile === suit) return false;
  if (!solCanMoveToFoundation(selected.cards, suit)) return false;

  solPushUndo();
  const movingCards = solRemoveSelectedCards();
  solState.foundations[suit].push(...movingCards);
  solCompleteMove(selected);
  return true;
};

const solSelectWaste = () => {
  const index = solState.waste.length - 1;
  if (index < 0) return;

  if (solSelectionMatches("waste", "waste", index)) {
    solState.selected = null;
  } else {
    solState.selected = {
      zone: "waste",
      pile: "waste",
      index,
      cards: [solState.waste[index]],
    };
  }

  solRender();
};

const solSelectFoundation = (suit, index) => {
  const pile = solState.foundations[suit];
  if (index !== pile.length - 1) return;

  if (solSelectionMatches("foundation", suit, index)) {
    solState.selected = null;
  } else {
    solState.selected = {
      zone: "foundation",
      pile: suit,
      index,
      cards: [pile[index]],
    };
  }

  solRender();
};

const solSelectTableau = (colIndex, cardIndex) => {
  const column = solState.tableau[colIndex];
  const card = column[cardIndex];
  if (!card || !card.faceUp) return;

  if (solState.selected && solMoveSelectedToTableau(colIndex)) return;
  const cards = column.slice(cardIndex);
  if (!solIsPackedTableauStack(cards)) return;

  if (solSelectionMatches("tableau", colIndex, cardIndex)) {
    solState.selected = null;
  } else {
    solState.selected = {
      zone: "tableau",
      pile: colIndex,
      index: cardIndex,
      cards,
    };
  }

  solRender();
};

const solDraw = () => {
  solState.selected = null;

  if (solState.stock.length) {
    solPushUndo();
    const card = solState.stock.pop();
    card.faceUp = true;
    solState.waste.push(card);
    solState.moves += 1;
  } else if (solState.waste.length) {
    solPushUndo();
    solState.stock = solState.waste.reverse().map((card) => {
      card.faceUp = false;
      return card;
    });
    solState.waste = [];
    solState.moves += 1;
  }

  solRender();
};

const solNewGame = () => {
  const deck = solShuffle(solBuildDeck());

  solState.stock = [];
  solState.waste = [];
  solState.foundations = {
    spades: [],
    clubs: [],
    diamonds: [],
    hearts: [],
  };
  solState.tableau = Array.from({ length: 7 }, () => []);
  solState.selected = null;
  solState.moves = 0;
  solState.won = false;
  solHistory.length = 0;
  solLastCardClick = null;
  solHideVictoryVideo();

  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row <= col; row += 1) {
      const card = deck.pop();
      card.faceUp = row === col;
      solState.tableau[col].push(card);
    }
  }

  solState.stock = deck;
  solRender();
};

const solAutoMoveCardToFoundation = (zone, pile, index) => {
  let card = null;

  if (zone === "waste") {
    const wasteIndex = solState.waste.length - 1;
    if (index !== wasteIndex) return;
    card = solState.waste[wasteIndex];
    solState.selected = {
      zone: "waste",
      pile: "waste",
      index: wasteIndex,
      cards: [card],
    };
  } else if (zone === "tableau") {
    const column = solState.tableau[pile];
    if (index !== column.length - 1) return;
    card = column[index];
    if (!card || !card.faceUp) return;
    solState.selected = {
      zone: "tableau",
      pile,
      index,
      cards: [card],
    };
  }

  if (!card || !solMoveSelectedToFoundation(card.suit)) {
    solRender();
  }
};

if (solBoard) {
  solBoard.addEventListener("click", (event) => {
    const stockHit = event.target.closest("[data-sol-stock]");
    if (stockHit && solBoard.contains(stockHit)) {
      solLastCardClick = null;
      solDraw();
      return;
    }

    const foundationEl = event.target.closest("[data-sol-foundation]");
    const cardEl = event.target.closest("[data-sol-card-id]");

    if (foundationEl && solState.selected) {
      const suit = foundationEl.getAttribute("data-sol-foundation");
      if (solMoveSelectedToFoundation(suit)) return;
    }

    if (cardEl) {
      const zone = cardEl.getAttribute("data-sol-zone");
      const pileValue = cardEl.getAttribute("data-sol-pile");
      const index = Number(cardEl.getAttribute("data-sol-index"));
      const cardId = cardEl.getAttribute("data-sol-card-id");
      const clickKey = `${zone}:${pileValue}:${index}:${cardId}`;
      const clickTime = Date.now();

      if (
        (zone === "waste" || zone === "tableau") &&
        solLastCardClick &&
        solLastCardClick.key === clickKey &&
        clickTime - solLastCardClick.time <= 500
      ) {
        solLastCardClick = null;
        const pile = zone === "tableau" ? Number(pileValue) : pileValue;
        solAutoMoveCardToFoundation(zone, pile, index);
        return;
      }

      solLastCardClick = { key: clickKey, time: clickTime };

      if (zone === "waste") {
        solSelectWaste();
        return;
      }

      if (zone === "foundation") {
        solSelectFoundation(pileValue, index);
        return;
      }

      if (zone === "tableau") {
        solSelectTableau(Number(pileValue), index);
      }

      return;
    }

    solLastCardClick = null;
    if (foundationEl && solState.selected) {
      const suit = foundationEl.getAttribute("data-sol-foundation");
      solMoveSelectedToFoundation(suit);
      return;
    }

    const columnEl = event.target.closest("[data-sol-col]");
    if (columnEl && solState.selected) {
      solMoveSelectedToTableau(Number(columnEl.getAttribute("data-sol-col")));
    }
  });

  solBoard.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('[role="button"]')) return;
    event.preventDefault();
    target.click();
  });
}

if (solAchievement) {
  solAchievement.addEventListener("animationend", () => {
    solAchievement.classList.remove("is-showing");
  });
}

if (sudokuAchievement) {
  sudokuAchievement.addEventListener("animationend", () => {
    sudokuAchievement.classList.remove("is-showing");
  });
}

if (solHelp) {
  solHelp.addEventListener("click", () => {
    setWindowOpen("solitaire-rules", true);
  });
}

if (solReset) {
  solReset.addEventListener("click", solNewGame);
}

if (solUndo) {
  solUndo.addEventListener("click", () => {
    const snapshot = solHistory.pop();
    if (!snapshot) return;
    solRestoreSnapshot(snapshot);
    if (!solState.won) solHideVictoryVideo();
    solRender();
  });
}

if (solVictoryVideo) {
  solVictoryVideo.addEventListener("loadeddata", solStartVictoryCanvas);
  solVictoryVideo.addEventListener("play", solStartVictoryCanvas);
  solVictoryVideo.addEventListener("seeked", solStartVictoryCanvas);
  solVictoryVideo.addEventListener("ended", () => {
    solVictoryVideo.pause();
    solDrawVictoryFrame();
  });
}

if (solRulesHelp) {
  solRulesHelp.addEventListener("click", () => {
    triggerRandomEvents("newTabLink", {
      href: "https://en.wikipedia.org/wiki/Klondike_(solitaire)",
      source: "solitaire-rules",
    });
    window.open("https://en.wikipedia.org/wiki/Klondike_(solitaire)", "_blank", "noopener,noreferrer");
  });
}

solNewGame();

const handleSnakeActivityChange = () => {
  if (!isSnakeWindowVisible()) {
    stopSnakeNoiseAnimation();
    return;
  }
  if (document.hidden || !isSnakePageActive()) {
    stopSnakeNoiseAnimation();
    if (snakeState.running || snakeState.countdownTimer) {
      pauseSnakeGame();
    } else {
      requestSnakeRender();
    }
    return;
  }
  requestSnakeRender();
};

const handleSnakeReducedMotionChange = () => {
  clearDistressPanelNoiseCanvas(snakeNoiseCanvas);
  if (isSnakeReducedMotion()) stopSnakeNoiseAnimation();
  requestSnakeRender();
};

lockMobileViewportZoom();
fitImagesIntoFrames(document);
watchRandomEventViewportMedia();
window.addEventListener("resize", msResizeConfetti);
window.addEventListener("resize", msUpdateBoardAlignment);
window.addEventListener("resize", () => {
  document
    .querySelectorAll(".portfolio-window")
    .forEach((win) => setPortfolioResponsiveState(win));
});
window.addEventListener("resize", () => {
  if (isDistressWindowVisible(distressSignalWindow)) requestAnimationFrame(drawDistressSignals);
});
window.addEventListener("resize", () => {
  if (!isSnakeWindowVisible()) return;
  requestSnakeRender();
});
window.addEventListener("resize", clampVisibleRandomEventWindows);
window.addEventListener("resize", updateLifeCounterWidthControls);
document.addEventListener("visibilitychange", handleSnakeActivityChange);
window.addEventListener("blur", handleSnakeActivityChange);
window.addEventListener("focus", handleSnakeActivityChange);
if (snakeReducedMotionMedia) {
  if (typeof snakeReducedMotionMedia.addEventListener === "function") {
    snakeReducedMotionMedia.addEventListener("change", handleSnakeReducedMotionChange);
  } else if (typeof snakeReducedMotionMedia.addListener === "function") {
    snakeReducedMotionMedia.addListener(handleSnakeReducedMotionChange);
  }
}

document.addEventListener(
  "pointerdown",
  (event) => {
    if (!activeWindow || !isWindowVisible(activeWindow)) return;
    if (activeWindow.contains(event.target)) return;
    pauseMediaPlayback(activeWindow);
    clearActiveAppDwell();
    activeWindow = null;
  },
  { capture: true }
);

const pauseActiveWindowMedia = () => {
  if (!activeWindow) return;
  pauseMediaPlayback(activeWindow);
  clearActiveAppDwell();
  activeWindow = null;
};
const defaultDocumentTitle = document.title || "Rohin OS";
const awayDocumentTitle = "come back :(";

window.addEventListener("blur", pauseActiveWindowMedia);
document.addEventListener("visibilitychange", () => {
  document.title = document.hidden ? awayDocumentTitle : defaultDocumentTitle;
  if (document.hidden) pauseActiveWindowMedia();
});

// if (clashRefresh) {
//   clashRefresh.addEventListener("click", () => {
//     loadClashRoyaleData(true);
//   });
// }

const clampVisibleWindowTitleBars = () => {
  draggableWindows.forEach((win) => {
    if (
      win.hidden ||
      win.classList.contains("is-hidden") ||
      win.classList.contains("app-window--center")
    ) {
      return;
    }
    const rect = win.getBoundingClientRect();
    setWindowTitleBarClampedPosition(win, rect.left, rect.top);
  });
};

let clampWindowTitleBarsFrameId = 0;
window.addEventListener("resize", () => {
  if (clampWindowTitleBarsFrameId) cancelAnimationFrame(clampWindowTitleBarsFrameId);
  clampWindowTitleBarsFrameId = requestAnimationFrame(() => {
    clampWindowTitleBarsFrameId = 0;
    clampVisibleWindowTitleBars();
  });
});

draggableWindows.forEach((win) => {
  win.addEventListener(
    "pointerdown",
    () => {
      bringWindowToFront(win);
    },
    { capture: true }
  );

  const titleBar = win.querySelector(".title-bar");
  if (!titleBar) return;
  const minimizeButton = win.querySelector('.title-bar-controls button[aria-label="Minimize"]');
  const maximizeButton = win.querySelector('.title-bar-controls button[aria-label="Maximize"]');

  if (maximizeButton) {
    maximizeButton.addEventListener("click", (event) => {
      event.preventDefault();
      expandSmallWindow(win);
    });
  }

  if (minimizeButton) {
    minimizeButton.addEventListener("click", (event) => {
      event.preventDefault();
      restoreWindowSize(win);
    });
  }

  titleBar.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".title-bar-controls")) return;
    const rect = win.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    let didDragWindow = false;

    win.classList.remove("app-window--center");
    win.style.translate = "0 0";
    if (win.id === "about-window") {
      win.style.left = `${rect.left}px`;
      win.style.top = `${rect.top}px`;
    }
    titleBar.setPointerCapture(event.pointerId);

    const moveHandler = (moveEvent) => {
      if (
        !didDragWindow &&
        Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 3
      ) {
        didDragWindow = true;
      }
      const nextLeft = moveEvent.clientX - offsetX;
      const nextTop = moveEvent.clientY - offsetY;
      setWindowTitleBarClampedPosition(win, nextLeft, nextTop);
    };

    const upHandler = (upEvent) => {
      titleBar.releasePointerCapture(upEvent.pointerId);
      titleBar.removeEventListener("pointermove", moveHandler);
      titleBar.removeEventListener("pointerup", upHandler);
      if (randomEventViewportWindows().includes(win)) {
        clampRandomEventWindowToViewport(win);
      } else {
        const rect = win.getBoundingClientRect();
        setWindowTitleBarClampedPosition(win, rect.left, rect.top);
      }
      if (didDragWindow) {
        triggerRandomEvents("windowDrag", {
          appId: win.getAttribute("data-app-window") || "",
          windowId: win.id || "",
        });
      }
      if (win.getAttribute("data-app-window") === "life-counter") {
        updateLifeCounterWidthControls();
      }
    };

    titleBar.addEventListener("pointermove", moveHandler);
    titleBar.addEventListener("pointerup", upHandler);
  });
});

const scheduleCalendarRefresh = () => {
  const now = new Date();
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const delay = nextDay.getTime() - now.getTime() + 1000;
  setTimeout(() => {
    if (calendarPopout.classList.contains("is-open")) {
      calendarDate = new Date();
      buildCalendar(calendarDate);
    }
    scheduleCalendarRefresh();
  }, delay);
};

scheduleCalendarRefresh();
})();
