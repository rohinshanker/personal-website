(() => {
const {
  all,
  byId,
  startButton,
} = window.homeDom;
const {
  ADMINISTRATOR_PROFILE: GAME_STATS_ADMINISTRATOR_PROFILE,
  createAdministratorSession,
  isAdministratorProfile: isGameStatsAdministratorProfile,
  normalizeAdministratorSignInResponse,
} = window.homeAdministratorSession;
const {
  clampWindowFullyIntoViewport,
  closeAppWindow,
  registerAdminControlsAccess,
  registerViewportObserver,
  registerWindowLifecycle,
  restartWindowAnimation,
  setWindowFocusReturn,
  setWindowOpen,
  setWindowTitleBarClampedPosition,
} = window.homeWindows;
const {
  DIGITAL_DIGIT_SOURCES: LIFE_COUNTER_DIGIT_SOURCES,
  clampNumber,
  formatElapsedTime,
  prefersReducedMotion,
  readJsonStorage,
  removeStorage,
  writeJsonStorage,
} = window.homeUtil;
const {
  createGameSession,
} = window.homeGameSession;

const administratorWindow = byId("administrator-window");
const administratorSignInForm = byId("administrator-sign-in-form");
const administratorUsername = byId("administrator-username");
const administratorPassword = byId("administrator-password");
const administratorSignIn = byId("administrator-sign-in");
const administratorAlertWindow = byId("administrator-alert-window");
const administratorAlertClose = byId("administrator-alert-close");
const gameStatsWindows = all("[data-game-stats-window]");
const gameStatsOpenButtons = all("[data-game-stats-open]");
const gameStatsRefreshButtons = all("[data-game-stats-refresh]");
const gameProfilePrompt = byId("game-profile-prompt");
const gameProfileDialog = byId("game-profile-dialog");
const gameProfileTitle = byId("game-profile-title");
const gameProfileNameControls = byId("game-profile-name-controls");
const gameProfileNameCredit = byId("game-profile-name-credit");
const gameProfileNamePicker = byId("game-profile-name-picker");
const gameProfileName = byId("game-profile-name");
const gameProfileNameToggle = byId("game-profile-name-toggle");
const gameProfileNameOptions = byId("game-profile-name-options");
const gameProfileReroll = byId("game-profile-reroll");
const gameProfileRerollLabel = byId("game-profile-reroll-label");
const gameProfileRerollCount = byId("game-profile-reroll-count");
const gameProfileIconSearch = byId("game-profile-icon-search");
const gameProfileIconGallery = byId("game-profile-icon-gallery");
const gameProfileSave = byId("game-profile-save");
const gameProfileCancel = byId("game-profile-cancel");
const gameProfileClose = byId("game-profile-close");

/**
 * The puzzle a Sudoku win came from. The Worker deduplicates by this identity
 * and the player, which is what closes the cross-tab races the browser's claim
 * list cannot. Both fields are dropped unless both are well formed, because a
 * half-identity is worse than none: the Worker rejects it outright.
 */
const normalizeSudokuEventIdentity = (rawEvent) => {
  const puzzleId = String(rawEvent.puzzleId || "").trim();
  const puzzle = String(rawEvent.puzzle || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{3,79}$/.test(puzzleId) || !/^[0-9]{81}$/.test(puzzle)) {
    return {};
  }
  return { puzzleId, puzzle };
};

const GAME_STATS_STORAGE_KEY = "personalSiteGameStatsV1";

const GAME_STATS_SYNC_QUEUE_STORAGE_KEY = "personalSiteGameStatsSyncQueueV1";

const GAME_STATS_PROFILE_STORAGE_KEY = "personalSitePlayerProfileV1";

const GAME_STATS_ADMINISTRATOR_SIGN_IN_Z_INDEX = 999_999;

const GAME_STATS_MAX_SYNC_QUEUE_LENGTH = 100;

const GAME_STATS_API_PROTOCOL = "2";

const GAME_STATS_MAX_PENDING_ACKNOWLEDGMENTS = 32;

// The Worker attaches this code to every rejected Administrator proof. Any other
// 403 is a rejected game session and must not reopen sign-in.
const GAME_STATS_ADMINISTRATOR_AUTHORIZATION_ERROR_CODE = "administrator-authorization";

// A presented proof that the Worker rejects is renewed at most this many times
// per queued result, so a persistent rejection cannot become a sign-in loop.
const GAME_STATS_MAX_ADMINISTRATOR_PROOF_RETRIES = 1;

const GAME_STATS_API_TIMEOUT_MS = 8000;

const GAME_STATS_SESSION_BUILD_RETRY_ATTEMPTS = 60;

const GAME_STATS_SESSION_BUILD_RETRY_INTERVAL_MS = 2000;

const GAME_STATS_MAX_NAME_REROLLS = 10;

const GAME_STATS_NAME_ROLL_COOLDOWN_MS = 3000;

const GAME_STATS_NAME_SUGGESTION_COUNT = 5;

const GAME_STATS_PROFILE_EDITOR_MODES = Object.freeze({
  create: "create",
  icon: "icon",
});

const GAME_STATS_RECORD_TROPHY_PRESS_COUNT = 2;

const GAME_STATS_RECORD_TROPHY_PRESS_MS = 120;

const GAME_STATS_RECORD_TROPHY_RELEASE_MS = 100;

const GAME_STATS_DEFAULT_ICON = "assets/app-icons/ico/user_card.ico";

const GAME_STATS_EMPTY_LEADERBOARD_ICON = "assets/app-icons/ico/address_book_user.ico";

const GAME_STATS_ROHIN_NEKO_AVATAR_ICON = GAME_STATS_ADMINISTRATOR_PROFILE.icon;

const GAME_STATS_ROHIN_NEKO_PROFILE = Object.freeze({
  ...GAME_STATS_ADMINISTRATOR_PROFILE,
  rerollCount: 0,
});

const GAME_STATS_API_ERROR_NAME = "API Error";

const GAME_STATS_SKY_NAME_GENERATOR_URL =
  "https://perchance.org/api/downloadGenerator?generatorName=sky-cotl-namegen&listsOnly=true";

const GAME_STATS_NAME_GENERATOR_TIMEOUT_MS = 8000;

const GAME_STATS_DIFFICULTIES = Object.freeze(["beginner", "intermediate", "expert"]);

const GAME_STATS_SUDOKU_DIFFICULTIES = Object.freeze([
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
  "extreme",
]);

const GAME_STATS_SUDOKU_PLACEHOLDER_TIME = "99:99";

const GAME_STATS_SNAKE_BOARD_SIZES = Object.freeze(["10", "16", "20", "24"]);

const GAME_STATS_HINT_BUCKETS = Object.freeze(["noHints", "withHints"]);

const GAME_STATS_SUPPORTED_GAMES = Object.freeze([
  "minesweeper",
  "solitaire",
  "snake",
  "sudoku",
]);

const GAME_STATS_SYNC_STATES = Object.freeze({
  initial: Object.freeze({
    message: "Global stats will sync automatically.",
    action: "refresh",
    busy: false,
    disabled: false,
  }),
  fetching: Object.freeze({
    message: "Fetching latest stats...",
    action: "none",
    busy: true,
    disabled: true,
  }),
  publishing: Object.freeze({
    message: "Publishing saved results...",
    action: "none",
    busy: true,
    disabled: true,
  }),
  "auth-required": Object.freeze({
    message: "Sign in as Administrator to publish your verified Rohin result.",
    action: "authenticate",
    busy: false,
    disabled: false,
  }),
  "auth-waiting": Object.freeze({
    message: "Waiting for authentication...",
    action: "none",
    busy: true,
    disabled: true,
  }),
  ready: Object.freeze({
    message: "Global stats are up to date.",
    action: "refresh",
    busy: false,
    disabled: false,
  }),
  "request-failed": Object.freeze({
    message: "Request failed. Try again later.",
    action: "refresh",
    busy: false,
    disabled: false,
  }),
  "auth-request-failed": Object.freeze({
    message: "Request failed. Try again later.",
    action: "authenticate",
    busy: false,
    disabled: false,
  }),
  "build-mismatch": Object.freeze({
    message:
      "Results cannot be published while the game update is deploying. Reload this page after the update finishes, then start a new game.",
    action: "reload",
    busy: false,
    disabled: false,
  }),
  "release-waiting": Object.freeze({
    message:
      "Game stats are finishing an update. This game's result will publish automatically when the update is ready.",
    action: "none",
    busy: true,
    disabled: true,
  }),
  "session-expired": Object.freeze({
    message:
      "Saved on this device. This game's online session expired, so this result can't be published. Start a new game to publish a new result.",
    action: "refresh",
    busy: false,
    disabled: false,
  }),
  unconfigured: Object.freeze({
    message:
      "Automatic global tracking is not configured yet; local stats stay on this device.",
    action: "none",
    busy: false,
    disabled: true,
  }),
});

const GAME_STATS_MEDAL_SOURCES = Object.freeze([
  "assets/minesweeper_assets/gold-medal.png",
  "assets/minesweeper_assets/silver-medal.png",
  "assets/minesweeper_assets/bronze-medal.png",
]);

const GAME_STATS_DIGIT_SOURCES = Object.freeze({
  ...LIFE_COUNTER_DIGIT_SOURCES,
  " ": "assets/minesweeper_assets/digital_digits/digital_unlit.png",
});

const GAME_STATS_ICON_MANIFEST = Object.freeze(
  (Array.isArray(window.rohinAppIconManifest) ? window.rohinAppIconManifest : [])
    .filter((filename) => /^[^/]+\.ico$/i.test(String(filename)))
    .map((filename) => ({
      filename: String(filename),
      src: `assets/app-icons/ico/${String(filename)}`,
    }))
);

const normalizeGameStatsBackendConfig = (rawConfig) => {
  if (!rawConfig || typeof rawConfig !== "object") {
    return { apiBaseUrl: "", buildVersion: "" };
  }
  const apiBaseUrl = String(rawConfig.apiBaseUrl || "").trim();
  const buildVersion = String(rawConfig.buildVersion || "").trim();
  if (!apiBaseUrl || !/^sha256-[a-f0-9]{64}$/.test(buildVersion)) {
    return { apiBaseUrl: "", buildVersion: "" };
  }
  try {
    const url = new URL(apiBaseUrl);
    if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported API protocol");
    if (url.username || url.password || url.search || url.hash) {
      throw new Error("Unsupported API URL components");
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return { apiBaseUrl: url.toString().replace(/\/$/, ""), buildVersion };
  } catch {
    return { apiBaseUrl: "", buildVersion: "" };
  }
};

const gameStatsBackend = normalizeGameStatsBackendConfig(window.rohinGameStatsBackend);

const createGameStatsEmptyMinesweeperWins = () =>
  Object.fromEntries(GAME_STATS_DIFFICULTIES.map((difficulty) => [difficulty, 0]));

const createGameStatsEmptyMinesweeperLeaderboards = () =>
  Object.fromEntries(GAME_STATS_DIFFICULTIES.map((difficulty) => [difficulty, []]));

const createGameStatsEmptyPlayerRank = () => ({ rank: null, totalPlayers: 0 });

const createGameStatsEmptyMinesweeperPlayerRanks = () =>
  Object.fromEntries(
    GAME_STATS_DIFFICULTIES.map((difficulty) => [difficulty, createGameStatsEmptyPlayerRank()])
  );

const createGameStatsEmptyMinesweeperPlayerRecords = () =>
  Object.fromEntries(GAME_STATS_DIFFICULTIES.map((difficulty) => [difficulty, null]));

const createGameStatsEmptySnakeGames = () =>
  Object.fromEntries(GAME_STATS_SNAKE_BOARD_SIZES.map((size) => [size, 0]));

const createGameStatsEmptySnakeLeaderboards = () =>
  Object.fromEntries(GAME_STATS_SNAKE_BOARD_SIZES.map((size) => [size, []]));

const createGameStatsEmptySnakePlayerRanks = () =>
  Object.fromEntries(
    GAME_STATS_SNAKE_BOARD_SIZES.map((size) => [size, createGameStatsEmptyPlayerRank()])
  );

const createGameStatsEmptySnakePlayerRecords = () =>
  Object.fromEntries(GAME_STATS_SNAKE_BOARD_SIZES.map((size) => [size, null]));

const createGameStatsEmptySudokuWins = () =>
  Object.fromEntries(
    GAME_STATS_SUDOKU_DIFFICULTIES.map((difficulty) => [
      difficulty,
      { noHints: 0, withHints: 0 },
    ])
  );

const createGameStatsEmptySudokuBestTimes = () =>
  Object.fromEntries(
    GAME_STATS_SUDOKU_DIFFICULTIES.map((difficulty) => [difficulty, null])
  );

const createGameStatsEmptySudokuLeaderboards = () =>
  Object.fromEntries(GAME_STATS_SUDOKU_DIFFICULTIES.map((difficulty) => [difficulty, []]));

const createGameStatsEmptySudokuPlayerRanks = () =>
  Object.fromEntries(
    GAME_STATS_SUDOKU_DIFFICULTIES.map((difficulty) => [
      difficulty,
      createGameStatsEmptyPlayerRank(),
    ])
  );

const createGameStatsEmptySudokuPlayerRecords = () =>
  Object.fromEntries(GAME_STATS_SUDOKU_DIFFICULTIES.map((difficulty) => [difficulty, null]));

const createGameStatsEmptyPlayerTotals = () => ({
  minesweeper: { wins: createGameStatsEmptyMinesweeperWins() },
  solitaire: { wins: 0 },
  snake: {
    totalGamesPlayed: 0,
    gamesPlayed: createGameStatsEmptySnakeGames(),
  },
  sudoku: { wins: createGameStatsEmptySudokuWins() },
});

const createEmptyGameStatsData = () => ({
  version: 1,
  generatedAt: new Date(0).toISOString(),
  eventIds: [],
  acknowledgedEventIds: [],
  acknowledgementsAvailable: false,
  totals: {
    minesweeper: { wins: createGameStatsEmptyMinesweeperWins() },
    solitaire: { wins: 0 },
    snake: {
      totalGamesPlayed: 0,
      gamesPlayed: createGameStatsEmptySnakeGames(),
    },
    sudoku: {
      wins: createGameStatsEmptySudokuWins(),
      bestTimes: createGameStatsEmptySudokuBestTimes(),
    },
  },
  playerTotals: createGameStatsEmptyPlayerTotals(),
  leaderboards: {
    minesweeper: createGameStatsEmptyMinesweeperLeaderboards(),
    solitaire: [],
    snake: createGameStatsEmptySnakeLeaderboards(),
    sudoku: createGameStatsEmptySudokuLeaderboards(),
  },
  playerRanks: {
    minesweeper: createGameStatsEmptyMinesweeperPlayerRanks(),
    solitaire: createGameStatsEmptyPlayerRank(),
    snake: createGameStatsEmptySnakePlayerRanks(),
    sudoku: createGameStatsEmptySudokuPlayerRanks(),
  },
  playerRecords: {
    minesweeper: createGameStatsEmptyMinesweeperPlayerRecords(),
    solitaire: null,
    snake: createGameStatsEmptySnakePlayerRecords(),
    sudoku: createGameStatsEmptySudokuPlayerRecords(),
  },
});

const gameStatsPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0;
};

const isGameStatsAllowedProfileIcon = (icon) =>
  /^assets\/app-icons\/ico\/[^/]+\.ico$/.test(icon) ||
  icon === GAME_STATS_ROHIN_NEKO_AVATAR_ICON;

const gameStatsOptionalPositiveInteger = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null;
};

const normalizeGameStatsPlayerRank = (value) => {
  const totalPlayers = gameStatsPositiveInteger(value?.totalPlayers);
  const rank = gameStatsPositiveInteger(value?.rank);
  return {
    rank: rank > 0 && rank <= totalPlayers ? rank : null,
    totalPlayers,
  };
};

const normalizeGameStatsIsoDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

const normalizeGameStatsProfile = (profile) => {
  if (!profile || typeof profile !== "object") return null;
  const id = String(profile.id || "").trim();
  const name = String(profile.name || "").trim().slice(0, 32);
  const icon = String(profile.icon || "").trim();
  const rerollCount = gameStatsPositiveInteger(profile.rerollCount);
  if (!id || !name || !isGameStatsAllowedProfileIcon(icon)) return null;
  return {
    id,
    name,
    icon,
    rerollCount: Math.min(GAME_STATS_MAX_NAME_REROLLS, rerollCount),
  };
};

const normalizeGameStatsEventProfile = (profile) => {
  const normalizedProfile = normalizeGameStatsProfile(profile);
  if (!normalizedProfile) return null;
  return {
    id: normalizedProfile.id,
    name: normalizedProfile.name,
    icon: normalizedProfile.icon,
  };
};

const normalizeGameStatsLeaderboardEntries = (entries, direction, limit) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const profile = normalizeGameStatsProfile({
        id: entry.playerId,
        name: entry.name,
        icon: entry.icon,
      });
      const eventId = String(entry.eventId || "").trim();
      if (!profile || !eventId) return null;
      return {
        eventId,
        playerId: profile.id,
        name: profile.name,
        icon: profile.icon,
        metric: gameStatsPositiveInteger(entry.metric),
        metricKind: String(entry.metricKind || ""),
        occurredAt: normalizeGameStatsIsoDate(entry.occurredAt),
      };
    })
    .filter(Boolean)
    .sort((first, second) => compareGameStatsLeaderboardEntries(direction, first, second))
    .slice(0, limit);

const normalizeGameStatsData = (
  rawData = {},
  { solitaireLeaderboardDirection = "asc" } = {}
) => {
  const data = createEmptyGameStatsData();
  const totals = rawData && typeof rawData === "object" ? rawData.totals || {} : {};
  const leaderboards =
    rawData && typeof rawData === "object" ? rawData.leaderboards || {} : {};
  const playerRanks =
    rawData && typeof rawData === "object" ? rawData.playerRanks || {} : {};
  const playerRecords =
    rawData && typeof rawData === "object" ? rawData.playerRecords || {} : {};
  const playerTotals =
    rawData && typeof rawData === "object" ? rawData.playerTotals || {} : {};

  GAME_STATS_DIFFICULTIES.forEach((difficulty) => {
    data.totals.minesweeper.wins[difficulty] = gameStatsPositiveInteger(
      totals.minesweeper?.wins?.[difficulty]
    );
    data.playerTotals.minesweeper.wins[difficulty] = gameStatsPositiveInteger(
      playerTotals.minesweeper?.wins?.[difficulty]
    );
    data.leaderboards.minesweeper[difficulty] = normalizeGameStatsLeaderboardEntries(
      leaderboards.minesweeper?.[difficulty],
      "asc",
      3
    );
    data.playerRanks.minesweeper[difficulty] = normalizeGameStatsPlayerRank(
      playerRanks.minesweeper?.[difficulty]
    );
    data.playerRecords.minesweeper[difficulty] =
      normalizeGameStatsLeaderboardEntries(
        [playerRecords.minesweeper?.[difficulty]],
        "asc",
        1
      )[0] || null;
  });

  data.totals.solitaire.wins = gameStatsPositiveInteger(totals.solitaire?.wins);
  data.playerTotals.solitaire.wins = gameStatsPositiveInteger(
    playerTotals.solitaire?.wins
  );
  data.leaderboards.solitaire = normalizeGameStatsLeaderboardEntries(
    leaderboards.solitaire,
    solitaireLeaderboardDirection,
    3
  );
  data.playerRanks.solitaire = normalizeGameStatsPlayerRank(playerRanks.solitaire);
  data.playerRecords.solitaire =
    normalizeGameStatsLeaderboardEntries(
      [playerRecords.solitaire],
      solitaireLeaderboardDirection,
      1
    )[0] || null;

  data.totals.snake.totalGamesPlayed = gameStatsPositiveInteger(
    totals.snake?.totalGamesPlayed
  );
  data.playerTotals.snake.totalGamesPlayed = gameStatsPositiveInteger(
    playerTotals.snake?.totalGamesPlayed
  );
  GAME_STATS_SNAKE_BOARD_SIZES.forEach((size) => {
    data.totals.snake.gamesPlayed[size] = gameStatsPositiveInteger(
      totals.snake?.gamesPlayed?.[size]
    );
    data.playerTotals.snake.gamesPlayed[size] = gameStatsPositiveInteger(
      playerTotals.snake?.gamesPlayed?.[size]
    );
    data.leaderboards.snake[size] = normalizeGameStatsLeaderboardEntries(
      leaderboards.snake?.[size],
      "desc",
      3
    );
    data.playerRanks.snake[size] = normalizeGameStatsPlayerRank(
      playerRanks.snake?.[size]
    );
    data.playerRecords.snake[size] =
      normalizeGameStatsLeaderboardEntries([playerRecords.snake?.[size]], "desc", 1)[0] ||
      null;
  });

  GAME_STATS_SUDOKU_DIFFICULTIES.forEach((difficulty) => {
    GAME_STATS_HINT_BUCKETS.forEach((hintBucket) => {
      data.totals.sudoku.wins[difficulty][hintBucket] = gameStatsPositiveInteger(
        totals.sudoku?.wins?.[difficulty]?.[hintBucket]
      );
      data.playerTotals.sudoku.wins[difficulty][hintBucket] = gameStatsPositiveInteger(
        playerTotals.sudoku?.wins?.[difficulty]?.[hintBucket]
      );
    });
    data.totals.sudoku.bestTimes[difficulty] = gameStatsOptionalPositiveInteger(
      totals.sudoku?.bestTimes?.[difficulty]
    );
    data.leaderboards.sudoku[difficulty] = normalizeGameStatsLeaderboardEntries(
      leaderboards.sudoku?.[difficulty],
      "asc",
      3
    );
    data.playerRanks.sudoku[difficulty] = normalizeGameStatsPlayerRank(
      playerRanks.sudoku?.[difficulty]
    );
    data.playerRecords.sudoku[difficulty] =
      normalizeGameStatsLeaderboardEntries(
        [playerRecords.sudoku?.[difficulty]],
        "asc",
        1
      )[0] || null;
  });

  data.generatedAt = normalizeGameStatsIsoDate(rawData.generatedAt);
  data.eventIds = Array.from(
    new Set((Array.isArray(rawData.eventIds) ? rawData.eventIds : []).map(String))
  ).filter((id) => /^[a-z0-9-]{8,80}$/.test(id));
  const rawAcknowledgedEventIds = Array.isArray(rawData.acknowledgedEventIds)
    ? rawData.acknowledgedEventIds
    : Array.isArray(rawData.eventIds)
      ? rawData.eventIds
      : null;
  data.acknowledgementsAvailable = Boolean(rawAcknowledgedEventIds);
  data.acknowledgedEventIds = Array.from(
    new Set((rawAcknowledgedEventIds || []).map(String))
  ).filter((id) => /^[a-z0-9-]{8,80}$/.test(id));
  return data;
};

function compareGameStatsLeaderboardEntries(direction, first, second) {
  if (first.metric !== second.metric) {
    return direction === "desc"
      ? second.metric - first.metric
      : first.metric - second.metric;
  }
  const firstTime = new Date(first.occurredAt).getTime();
  const secondTime = new Date(second.occurredAt).getTime();
  if (firstTime !== secondTime) return firstTime - secondTime;
  return String(first.eventId).localeCompare(String(second.eventId));
}

const createGameStatsEventId = () => {
  if (window.crypto?.randomUUID) return `local-${window.crypto.randomUUID()}`;
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const normalizeGameStatsMetric = (value) => {
  const metric = Number(value);
  return Number.isFinite(metric) && metric >= 0 ? Math.trunc(metric) : null;
};

function normalizeGameStatsEvent(rawEvent) {
  if (!rawEvent || typeof rawEvent !== "object") return null;
  const id = String(rawEvent.id || "").trim();
  const game = String(rawEvent.game || "").trim();
  const type = String(rawEvent.type || "").trim();
  const occurredAt = normalizeGameStatsIsoDate(rawEvent.occurredAt);
  const profile = normalizeGameStatsEventProfile(rawEvent.profile);
  if (!/^[a-z0-9-]{8,80}$/.test(id)) return null;

  if (game === "minesweeper") {
    const difficulty = String(rawEvent.difficulty || rawEvent.category || "").trim();
    const metric = normalizeGameStatsMetric(rawEvent.metric ?? rawEvent.seconds);
    if (type !== "win" || !GAME_STATS_DIFFICULTIES.includes(difficulty) || metric === null) {
      return null;
    }
    return {
      id,
      game,
      type,
      occurredAt,
      difficulty,
      metric,
      metricKind: "seconds",
      profile,
    };
  }

  if (game === "solitaire") {
    const metric = normalizeGameStatsMetric(rawEvent.metric ?? rawEvent.moves);
    if (type !== "win" || metric === null) return null;
    return {
      id,
      game,
      type,
      occurredAt,
      metric,
      metricKind: "moves",
      profile,
    };
  }

  if (game === "snake") {
    const boardSize = String(rawEvent.boardSize || rawEvent.category || "").trim();
    const metric = normalizeGameStatsMetric(rawEvent.metric ?? rawEvent.score);
    if (
      type !== "gamePlayed" ||
      !GAME_STATS_SNAKE_BOARD_SIZES.includes(boardSize) ||
      metric === null
    ) {
      return null;
    }
    return {
      id,
      game,
      type,
      occurredAt,
      boardSize,
      metric,
      metricKind: "score",
      profile,
    };
  }

  if (game === "sudoku") {
    const difficulty = String(rawEvent.difficulty || "").trim();
    const hintBucket = String(rawEvent.hintBucket || "").trim();
    const metricSource = rawEvent.metric ?? rawEvent.seconds;
    const metric =
      metricSource === undefined || metricSource === null || metricSource === ""
        ? null
        : normalizeGameStatsMetric(metricSource);
    if (
      type !== "win" ||
      !GAME_STATS_SUDOKU_DIFFICULTIES.includes(difficulty) ||
      !GAME_STATS_HINT_BUCKETS.includes(hintBucket) ||
      (metricSource !== undefined && metricSource !== null && metricSource !== "" &&
        metric === null) ||
      (metric !== null && String(rawEvent.metricKind || "seconds").trim() !== "seconds")
    ) {
      return null;
    }
    return {
      id,
      game,
      type,
      occurredAt,
      difficulty,
      hintBucket,
      ...normalizeSudokuEventIdentity(rawEvent),
      ...(metric === null ? {} : { metric, metricKind: "seconds" }),
      profile,
    };
  }

  return null;
}

const loadGameStatsLocalState = () =>
  normalizeGameStatsData(readJsonStorage(() => localStorage, GAME_STATS_STORAGE_KEY, {}) || {});

const saveGameStatsLocalState = () => {
  writeJsonStorage(() => localStorage, GAME_STATS_STORAGE_KEY, gameStatsLocalState);
};

const normalizeGameStatsSession = (rawSession, { allowExpired = false } = {}) => {
  if (!rawSession || typeof rawSession !== "object") return null;
  const id = String(rawSession.id || rawSession.sessionId || "").trim();
  const token = String(rawSession.token || rawSession.sessionToken || "").trim();
  const expiresAt = String(rawSession.expiresAt || "").trim();
  const expiresAtMs = new Date(expiresAt).getTime();
  if (
    !/^[A-Za-z0-9._~+\/-]{8,256}$/.test(id) ||
    !/^[A-Za-z0-9._~+=\/-]{8,2048}$/.test(token) ||
    !Number.isFinite(expiresAtMs) ||
    (!allowExpired && expiresAtMs <= Date.now())
  ) {
    return null;
  }
  return { id, token, expiresAt: new Date(expiresAtMs).toISOString() };
};

const normalizeGameStatsSubmission = (rawSubmission) => {
  if (!rawSubmission || typeof rawSubmission !== "object") return null;
  const event = normalizeGameStatsEvent(rawSubmission.event);
  if (!event) return null;
  const proofRejections = rawSubmission.proofRejections;
  const completion = normalizeGameStatsSession(rawSubmission.completion, { allowExpired: true });
  return {
    event,
    session: normalizeGameStatsSession(rawSubmission.session, { allowExpired: true }),
    ...(completion ? { completion } : {}),
    proofRejections:
      Number.isSafeInteger(proofRejections) && proofRejections > 0 ? proofRejections : 0,
  };
};

const loadGameStatsSubmissionQueue = () => {
  const stored = readJsonStorage(() => localStorage, GAME_STATS_SYNC_QUEUE_STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored
    .map(normalizeGameStatsSubmission)
    .filter(Boolean)
    .slice(-GAME_STATS_MAX_SYNC_QUEUE_LENGTH);
};

const saveGameStatsSubmissionQueue = () => {
  writeJsonStorage(() => localStorage, GAME_STATS_SYNC_QUEUE_STORAGE_KEY, gameStatsSubmissionQueue);
};

const isGameStatsBackendConfigured = () =>
  Boolean(gameStatsBackend.apiBaseUrl && gameStatsBackend.buildVersion);

const gameStatsApiUrl = (path) => `${gameStatsBackend.apiBaseUrl}${path}`;

const fetchGameStatsApi = async (path, options = {}) => {
  if (!isGameStatsBackendConfigured()) {
    throw new Error("Automatic game tracking is not configured");
  }
  if (typeof fetch !== "function") throw new Error("Fetch is unavailable");

  const { signal: externalSignal, ...fetchOptions } = options;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const abortFromExternalSignal = () => controller?.abort();
  if (externalSignal && controller) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }
  const timeout = controller
    ? window.setTimeout(() => controller.abort(), GAME_STATS_API_TIMEOUT_MS)
    : 0;
  try {
    return await fetch(gameStatsApiUrl(path), {
      ...fetchOptions,
      signal: controller?.signal || externalSignal,
      headers: {
        ...(fetchOptions.body === undefined || fetchOptions.body === null
          ? {}
          : { "Content-Type": "application/json" }),
        ...(fetchOptions.headers || {}),
      },
    });
  } finally {
    if (timeout) window.clearTimeout(timeout);
    externalSignal?.removeEventListener?.("abort", abortFromExternalSignal);
  }
};

const readGameStatsApiJson = async (response) => {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = String(payload?.error || `Game stats request failed (${response.status})`);
    const error = new Error(message);
    error.status = response.status;
    error.code = typeof payload?.code === "string" ? payload.code : "";
    throw error;
  }
  return payload;
};

let gameStatsSessionSequence = 0;

const gameStatsSessions = new Map();

const gameStatsAdministratorSession = createAdministratorSession({
  onInvalidated: () => {
    const adminWindow = document.getElementById("admin-controls-window");
    if (!adminWindow || adminWindow.getAttribute("aria-hidden") !== "false") return;
    // Reuse launch denial so the gate receives keyboard focus after closing Admin.
    setWindowOpen("admin-controls", true);
    const gate = document.getElementById("admin-controls-stand-in-window");
    const launcher = document.querySelector('.taskbar-icon[data-app="admin-controls"]');
    setWindowFocusReturn(gate, launcher);
  },
});

gameStatsAdministratorSession.restore();

const clearGameStatsAdministratorProof = () => gameStatsAdministratorSession.clear();

const hasActiveGameStatsAdministratorProof = () =>
  gameStatsAdministratorSession.isActive();

const getAdministratorEventHeaders = (profile) => {
  if (!isGameStatsAdministratorProfile(profile)) return {};
  if (!hasActiveGameStatsAdministratorProof()) return {};
  return { Authorization: `Bearer ${gameStatsAdministratorSession.getProof().proof}` };
};

const reportGameStatsSessionFailure = (
  { status = 0, reason = "" } = {},
  { localSaved = false } = {}
) => {
  if (status === 409) {
    setGameStatsSyncState("build-mismatch");
    return;
  }
  if (reason === "unconfigured") {
    setGameStatsSyncState("unconfigured");
    return;
  }
  const prefix = localSaved ? "Local stats are saved, but " : "";
  const subject = localSaved ? "the" : "The";
  const message =
    status === 429
      ? `${prefix}${subject} verified game session request was rate limited. Try again later.`
      : reason === "invalid-response"
        ? `${prefix}${subject} game server returned an invalid session response. Start a new game and try again.`
        : `${prefix}${subject} verified game session request failed${
            status ? ` (HTTP ${status})` : ""
          }. Start a new game and try again.`;
  setGameStatsSyncState("request-failed", { message, localResult: localSaved });
};

const normalizeGameStatsSessionConfig = (game, rawConfig) => {
  const config =
    rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig)
      ? rawConfig
      : {};
  if (game === "minesweeper" || game === "sudoku") {
    return {
      difficulty:
        typeof config.difficulty === "string" ? config.difficulty.trim() : "",
    };
  }
  if (game === "snake") {
    return {
      boardSize: typeof config.boardSize === "string" ? config.boardSize.trim() : "",
    };
  }
  return {};
};

const isGameStatsSessionExpired = (session) =>
  !Number.isFinite(new Date(session?.expiresAt || "").getTime()) ||
  new Date(session.expiresAt).getTime() <= Date.now();

const startGameStatsSession = (game, rawConfig) => {
  const config = normalizeGameStatsSessionConfig(game, rawConfig);
  const configKey = JSON.stringify(config);
  const existingEntry = gameStatsSessions.get(game);
  if (
    existingEntry?.configKey === configKey &&
    (!existingEntry.result ||
      (existingEntry.result.session &&
        !isGameStatsSessionExpired(existingEntry.result.session)))
  ) {
    return existingEntry.sessionKey;
  }

  existingEntry?.controller?.abort();
  const sessionKey = `${game}-${Date.now().toString(36)}-${(gameStatsSessionSequence += 1)}`;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const entry = {
    configKey,
    controller,
    result: null,
    sessionKey,
    sessionRequest: null,
  };
  entry.sessionRequest = (async () => {
    if (!isGameStatsBackendConfigured()) {
      const failure = { session: null, status: 0, reason: "unconfigured" };
      reportGameStatsSessionFailure(failure);
      return failure;
    }
    let waitedForCompatibleBuild = false;
    const finishCompatibleBuildWait = () => {
      if (!waitedForCompatibleBuild) return false;
      waitedForCompatibleBuild = false;
      gameStatsReleaseWaitCount = Math.max(0, gameStatsReleaseWaitCount - 1);
      return true;
    };
    for (
      let attempt = 0;
      attempt <= GAME_STATS_SESSION_BUILD_RETRY_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const response = await fetchGameStatsApi("/sessions", {
          method: "POST",
          body: JSON.stringify({ game, config, buildVersion: gameStatsBackend.buildVersion }),
          signal: controller?.signal,
        });
        const session = normalizeGameStatsSession(await readGameStatsApiJson(response));
        if (!session) {
          finishCompatibleBuildWait();
          const failure = { session: null, status: 0, reason: "invalid-response" };
          reportGameStatsSessionFailure(failure);
          return failure;
        }
        const finishedCompatibleBuildWait = finishCompatibleBuildWait();
        if (
          finishedCompatibleBuildWait &&
          gameStatsReleaseWaitCount === 0 &&
          gameStatsSyncState === "release-waiting"
        ) {
          setGameStatsSyncState("ready");
        }
        return {
          session,
          status: Number(response.status) || 0,
        };
      } catch (error) {
        if (controller?.signal.aborted) {
          finishCompatibleBuildWait();
          return { session: null, status: 0, reason: "aborted" };
        }
        const status = Number(error?.status) || 0;
        if (status === 409 && attempt < GAME_STATS_SESSION_BUILD_RETRY_ATTEMPTS) {
          if (!waitedForCompatibleBuild) {
            waitedForCompatibleBuild = true;
            gameStatsReleaseWaitCount += 1;
          }
          setGameStatsSyncState("release-waiting");
          await new Promise((resolve) =>
            window.setTimeout(resolve, GAME_STATS_SESSION_BUILD_RETRY_INTERVAL_MS)
          );
          continue;
        }
        finishCompatibleBuildWait();
        const failure = { session: null, status };
        reportGameStatsSessionFailure(failure);
        return failure;
      }
    }
    throw new Error("Game stats session retry loop exhausted unexpectedly");
  })().then((result) => {
    entry.result = result;
    return result;
  });
  gameStatsSessions.set(game, entry);
  return sessionKey;
};

const getGameStatsSession = (sessionKey) => {
  const gameEntry = [...gameStatsSessions.entries()].find(
    ([, entry]) => entry.sessionKey === sessionKey
  );
  if (!sessionKey || !gameEntry) {
    return Promise.resolve({ session: null, status: 0 });
  }
  const [game, entry] = gameEntry;
  if (gameStatsSessions.get(game) === entry) gameStatsSessions.delete(game);
  return entry.sessionRequest;
};

const loadGameStatsProfile = () =>
  normalizeGameStatsProfile(readJsonStorage(() => localStorage, GAME_STATS_PROFILE_STORAGE_KEY));

const clearGameStatsGlobalPlayerScope = () => {
  if (!gameStatsGlobalState) return;
  const emptyData = createEmptyGameStatsData();
  gameStatsGlobalPlayerTotalsAvailable = false;
  gameStatsGlobalState.playerTotals = emptyData.playerTotals;
  gameStatsGlobalState.playerRanks = emptyData.playerRanks;
  gameStatsGlobalState.playerRecords = emptyData.playerRecords;
};

const saveGameStatsProfile = (profile) => {
  if (gameStatsProfile) return gameStatsProfile;
  const normalizedProfile = normalizeGameStatsProfile(profile);
  if (!normalizedProfile) return null;
  clearGameStatsGlobalPlayerScope();
  gameStatsProfile = normalizedProfile;
  writeJsonStorage(() => localStorage, GAME_STATS_PROFILE_STORAGE_KEY, gameStatsProfile);
  return gameStatsProfile;
};

const saveGameStatsProfileIcon = (icon) => {
  if (!gameStatsProfile) return null;
  const nextProfile = normalizeGameStatsProfile({ ...gameStatsProfile, icon });
  if (!nextProfile) return null;
  gameStatsProfile = nextProfile;
  writeJsonStorage(() => localStorage, GAME_STATS_PROFILE_STORAGE_KEY, gameStatsProfile);
  return gameStatsProfile;
};

const clearGameStatsProfile = () => {
  gameStatsProfile = null;
  clearGameStatsGlobalPlayerScope();
  clearGameStatsAdministratorProof();
  gameStatsAvatarAnimator.stop?.();
  removeStorage(() => localStorage, GAME_STATS_PROFILE_STORAGE_KEY);
};

const createGameStatsLeaderboardEntry = (event) => ({
  eventId: event.id,
  playerId: event.profile.id,
  name: event.profile.name,
  icon: event.profile.icon,
  metric: event.metric,
  metricKind: event.metricKind,
  occurredAt: event.occurredAt,
});

const upsertGameStatsLeaderboardEntry = (leaderboard, event, limit, direction) => {
  if (!event.profile || !Number.isFinite(event.metric)) return leaderboard;
  const nextEntry = createGameStatsLeaderboardEntry(event);
  const entries = Array.isArray(leaderboard) ? [...leaderboard] : [];
  const existingIndex = entries.findIndex((entry) => entry.playerId === nextEntry.playerId);
  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    if (compareGameStatsLeaderboardEntries(direction, nextEntry, existing) < 0) {
      entries[existingIndex] = nextEntry;
    }
  } else {
    entries.push(nextEntry);
  }
  return entries
    .sort((first, second) => compareGameStatsLeaderboardEntries(direction, first, second))
    .slice(0, limit);
};

const updateGameStatsPlayerRecord = (record, event, direction) =>
  upsertGameStatsLeaderboardEntry(
    record ? [record] : [],
    event,
    1,
    direction
  )[0] || record || null;

const incrementGameStatsTotals = (totals, event) => {
  if (event.game === "minesweeper") {
    totals.minesweeper.wins[event.difficulty] += 1;
  } else if (event.game === "solitaire") {
    totals.solitaire.wins += 1;
  } else if (event.game === "snake") {
    totals.snake.totalGamesPlayed += 1;
    totals.snake.gamesPlayed[event.boardSize] += 1;
  } else if (event.game === "sudoku") {
    totals.sudoku.wins[event.difficulty][event.hintBucket] += 1;
  }
};

const applyGameStatsEventToData = (data, rawEvent) => {
  const event = normalizeGameStatsEvent(rawEvent);
  if (!event || data.eventIds.includes(event.id)) return false;
  data.eventIds.push(event.id);
  incrementGameStatsTotals(data.totals, event);

  if (event.game === "minesweeper") {
    data.leaderboards.minesweeper[event.difficulty] = upsertGameStatsLeaderboardEntry(
      data.leaderboards.minesweeper[event.difficulty],
      event,
      3,
      "asc"
    );
    data.playerRecords.minesweeper[event.difficulty] = updateGameStatsPlayerRecord(
      data.playerRecords.minesweeper[event.difficulty],
      event,
      "asc"
    );
  } else if (event.game === "solitaire") {
    data.leaderboards.solitaire = upsertGameStatsLeaderboardEntry(
      data.leaderboards.solitaire,
      event,
      5,
      "asc"
    );
  } else if (event.game === "snake") {
    data.leaderboards.snake[event.boardSize] = upsertGameStatsLeaderboardEntry(
      data.leaderboards.snake[event.boardSize],
      event,
      5,
      "desc"
    );
    data.playerRecords.snake[event.boardSize] = updateGameStatsPlayerRecord(
      data.playerRecords.snake[event.boardSize],
      event,
      "desc"
    );
  } else if (event.game === "sudoku") {
    if (event.hintBucket === "noHints" && Number.isFinite(event.metric)) {
      data.leaderboards.sudoku[event.difficulty] = upsertGameStatsLeaderboardEntry(
        data.leaderboards.sudoku[event.difficulty],
        event,
        3,
        "asc"
      );
      data.playerRecords.sudoku[event.difficulty] = updateGameStatsPlayerRecord(
        data.playerRecords.sudoku[event.difficulty],
        event,
        "asc"
      );
    }
  }

  return true;
};

const applyConfirmedGameStatsEventToTotals = (
  data,
  rawEvent,
  { playerId = "", playerTotalsAvailable = false } = {}
) => {
  const event = normalizeGameStatsEvent(rawEvent);
  if (!event || data.eventIds.includes(event.id)) return false;
  data.eventIds.push(event.id);
  incrementGameStatsTotals(data.totals, event);
  if (playerTotalsAvailable && event.profile?.id === playerId) {
    incrementGameStatsTotals(data.playerTotals, event);
    if (event.game === "solitaire") {
      const wins = data.playerTotals.solitaire.wins;
      const summary = {
        eventId: event.id,
        playerId: event.profile.id,
        name: event.profile.name,
        icon: event.profile.icon,
        metric: wins,
        metricKind: "wins",
        occurredAt: event.occurredAt,
      };
      data.playerRecords.solitaire = summary;
      const leaderboardIndex = data.leaderboards.solitaire.findIndex(
        (entry) => entry.playerId === playerId
      );
      if (leaderboardIndex >= 0) {
        data.leaderboards.solitaire[leaderboardIndex] = summary;
        data.leaderboards.solitaire.sort((first, second) =>
          compareGameStatsLeaderboardEntries("desc", first, second)
        );
        data.playerRanks.solitaire.rank =
          data.leaderboards.solitaire.findIndex((entry) => entry.playerId === playerId) + 1;
      }
    }
  }
  return true;
};

const reconcileConfirmedGameStatsEvents = (
  data,
  {
    playerId = "",
    playerTotalsAvailable = false,
    requestedAcknowledgmentIds = [],
  } = {}
) => {
  const requestedIds = new Set(requestedAcknowledgmentIds);
  const acknowledgedIds = new Set(data.acknowledgedEventIds);
  gameStatsConfirmedEvents.forEach((event, eventId) => {
    if (
      data.acknowledgementsAvailable &&
      requestedIds.has(eventId) &&
      acknowledgedIds.has(eventId)
    ) {
      gameStatsConfirmedEvents.delete(eventId);
      return;
    }
    applyConfirmedGameStatsEventToTotals(data, event, {
      playerId,
      playerTotalsAvailable,
    });
  });
  return data;
};

const markGameStatsEventConfirmed = (rawEvent) => {
  const event = normalizeGameStatsEvent(rawEvent);
  if (!event) return false;
  gameStatsConfirmedEvents.set(event.id, event);
  while (gameStatsConfirmedEvents.size > GAME_STATS_MAX_PENDING_ACKNOWLEDGMENTS) {
    gameStatsConfirmedEvents.delete(gameStatsConfirmedEvents.keys().next().value);
  }
  return applyConfirmedGameStatsEventToTotals(gameStatsGlobalState, event, {
    playerId: gameStatsProfile?.id || "",
    playerTotalsAvailable: gameStatsGlobalPlayerTotalsAvailable,
  });
};

const updateGameStatsSudokuBestTime = (data, difficulty, seconds) => {
  const nextBestTime = gameStatsOptionalPositiveInteger(seconds);
  if (nextBestTime === null) return;
  const currentBestTime = data.totals.sudoku.bestTimes[difficulty];
  data.totals.sudoku.bestTimes[difficulty] =
    currentBestTime === null ? nextBestTime : Math.min(currentBestTime, nextBestTime);
};

const getGameStatsLeaderboardSpec = (event) => {
  if (!event || !Number.isFinite(event.metric)) return null;
  if (event.game === "minesweeper") {
    return {
      entries: (data) => data.leaderboards.minesweeper[event.difficulty],
      playerRecord: (data) => data.playerRecords.minesweeper[event.difficulty],
      limit: 3,
      direction: "asc",
    };
  }
  if (event.game === "snake") {
    return {
      entries: (data) => data.leaderboards.snake[event.boardSize],
      playerRecord: (data) => data.playerRecords.snake[event.boardSize],
      limit: 5,
      direction: "desc",
    };
  }
  if (event.game === "sudoku" && event.hintBucket === "noHints") {
    return {
      entries: (data) => data.leaderboards.sudoku[event.difficulty],
      playerRecord: (data) => data.playerRecords.sudoku[event.difficulty],
      limit: 3,
      direction: "asc",
    };
  }
  return null;
};

const gameStatsEventBeatsPersonalRecord = (
  localData,
  globalData,
  event,
  { snakePreviousHighScore = undefined } = {}
) => {
  const spec = getGameStatsLeaderboardSpec(event);
  if (!spec) return false;

  const playerId = event.profile?.id || "";
  const recordMetrics = [];
  const addRecordMetric = (record) => {
    if (
      record &&
      playerId &&
      record.playerId === playerId &&
      Number.isFinite(record.metric)
    ) {
      recordMetrics.push(record.metric);
    }
  };

  const localEntries = spec.entries(localData);
  if (Array.isArray(localEntries)) {
    addRecordMetric(localEntries.find((entry) => entry.playerId === playerId));
  }
  addRecordMetric(spec.playerRecord(localData));
  addRecordMetric(spec.playerRecord(globalData));

  if (event.game === "snake" && Number.isFinite(snakePreviousHighScore)) {
    recordMetrics.push(snakePreviousHighScore);
  }
  if (event.game === "sudoku") {
    const localBestTime = localData.totals.sudoku.bestTimes[event.difficulty];
    if (Number.isFinite(localBestTime)) recordMetrics.push(localBestTime);
  }

  if (!recordMetrics.length) return true;
  const previousRecord =
    spec.direction === "desc"
      ? Math.max(...recordMetrics)
      : Math.min(...recordMetrics);
  return spec.direction === "desc"
    ? event.metric > previousRecord
    : event.metric < previousRecord;
};

const gameStatsEventQualifiesForData = (data, event) => {
  const spec = getGameStatsLeaderboardSpec(event);
  if (!spec) return false;
  const entries = spec.entries(data);
  if (!Array.isArray(entries) || entries.length < spec.limit) return true;
  const candidate = {
    eventId: event.id,
    metric: event.metric,
    occurredAt: event.occurredAt,
  };
  const worst = entries[entries.length - 1];
  return compareGameStatsLeaderboardEntries(spec.direction, candidate, worst) < 0;
};

const gameStatsEventQualifiesForLeaderboard = (event) =>
  gameStatsEventQualifiesForData(gameStatsLocalState, event) ||
  gameStatsEventQualifiesForData(gameStatsGlobalState, event);

const createGameStatsEvent = (payload) =>
  normalizeGameStatsEvent({
    id: createGameStatsEventId(),
    occurredAt: new Date().toISOString(),
    ...payload,
  });

const gameStatsRandomIndex = (length) => {
  if (!Number.isInteger(length) || length < 1) return 0;
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    const unbiasedLimit = 0x100000000 - (0x100000000 % length);
    do {
      window.crypto.getRandomValues(values);
    } while (values[0] >= unbiasedLimit);
    return values[0] % length;
  }
  return Math.floor(Math.random() * length);
};

const parseGameStatsSkyNameList = (source, listName) => {
  const lines = String(source || "").split(/\r?\n/);
  const listStart = lines.findIndex((line) => line.trim() === listName);
  if (listStart < 0) throw new Error("Sky name generator list is unavailable.");

  const values = [];
  for (let index = listStart + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (/^[a-z][a-z0-9-]*$/i.test(line) && line.length > 1) break;
    const match = line.match(/^([a-z])(?:\s+\^([0-9]+(?:\.[0-9]+)?))?$/i);
    if (!match) throw new Error("Sky name generator list is invalid.");
    const weight = Number(match[2] || "1");
    const weightUnits = weight * 2;
    if (!Number.isInteger(weightUnits) || weightUnits < 1 || weightUnits > 20) {
      throw new Error("Sky name generator weight is invalid.");
    }
    for (let repeat = 0; repeat < weightUnits; repeat += 1) {
      values.push(match[1].toLowerCase());
    }
  }
  if (!values.length) throw new Error("Sky name generator list is empty.");
  return values;
};

const parseGameStatsSkyNamePatterns = (source) => {
  const lines = String(source || "").split(/\r?\n/);
  const namesStart = lines.findIndex((line) => line.trim() === "names");
  if (namesStart < 0) throw new Error("Sky name generator patterns are unavailable.");

  const patterns = [];
  for (let index = namesStart + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "vowels") break;
    if (!line) continue;
    const parts = [...line.matchAll(/\[(vowels|consonants)\]/g)].map((match) => match[1]);
    if (!parts.length) throw new Error("Sky name generator pattern is invalid.");
    if (
      parts.length < 4 ||
      parts.length > 8 ||
      parts.some((part, partIndex) => partIndex > 0 && part === parts[partIndex - 1])
    ) {
      throw new Error("Sky name generator pattern is invalid.");
    }
    patterns.push(parts);
  }
  if (patterns.length !== 10) throw new Error("Sky name generator patterns are incomplete.");
  return patterns;
};

const parseGameStatsSkyNameGrammar = (source) => {
  const definition = String(source || "");
  if (!/^title\s*=\s*Sky Name Generator\s*$/m.test(definition)) {
    throw new Error("Sky name generator definition is invalid.");
  }
  const vowels = parseGameStatsSkyNameList(definition, "vowels");
  if (vowels.length !== 10 || new Set(vowels).size !== 5 || vowels.some((vowel) => !"aeiou".includes(vowel))) {
    throw new Error("Sky name generator vowels are invalid.");
  }
  return Object.freeze({
    vowels,
    consonants: parseGameStatsSkyNameList(definition, "consonants"),
    patterns: parseGameStatsSkyNamePatterns(definition),
  });
};

const createGameStatsSkyName = (grammar) => {
  const pattern = grammar.patterns[gameStatsRandomIndex(grammar.patterns.length)];
  const name = pattern
    .map((part) => {
      const values = grammar[part];
      return values[gameStatsRandomIndex(values.length)];
    })
    .join("");
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
};

let gameStatsSkyNameGrammar = null;

const fetchGameStatsSkyNameGrammar = async () => {
  if (typeof window.fetch !== "function") {
    throw new Error("Name generator is unavailable.");
  }
  if (gameStatsSkyNameGrammar) return gameStatsSkyNameGrammar;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    GAME_STATS_NAME_GENERATOR_TIMEOUT_MS
  );
  try {
    const response = await window.fetch(GAME_STATS_SKY_NAME_GENERATOR_URL, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Name generator request failed.");
    gameStatsSkyNameGrammar = parseGameStatsSkyNameGrammar(await response.text());
    return gameStatsSkyNameGrammar;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const fetchGameStatsName = async () =>
  createGameStatsSkyName(await fetchGameStatsSkyNameGrammar());

const fetchGameStatsNameSuggestions = async () => {
  const grammar = await fetchGameStatsSkyNameGrammar();
  const suggestions = [];
  const attempts = GAME_STATS_NAME_SUGGESTION_COUNT * 8;
  for (let index = 0; index < attempts && suggestions.length < GAME_STATS_NAME_SUGGESTION_COUNT; index += 1) {
    const name = createGameStatsSkyName(grammar);
    if (!suggestions.includes(name)) suggestions.push(name);
  }
  if (suggestions.length !== GAME_STATS_NAME_SUGGESTION_COUNT) {
    throw new Error("Name generator did not provide enough unique names.");
  }
  return suggestions;
};

let gameStatsNameRollInFlight = false;

let gameStatsNameRollId = 0;

let gameStatsNameRollCooldownEndsAt = 0;

let gameStatsNameRollCooldownTimer = null;

let gameStatsDraftNameSuggestions = [];

let gameStatsNameSuggestionsOpen = false;

let gameStatsNameSuggestionActiveIndex = -1;

let gameStatsPreserveNameSuggestionsAfterReroll = false;

let gameStatsProfileEditorMode = GAME_STATS_PROFILE_EDITOR_MODES.create;

let gameStatsProfileDialogReturnFocus = null;

const isGameStatsProfileIconEditor = () =>
  gameStatsProfileEditorMode === GAME_STATS_PROFILE_EDITOR_MODES.icon;

const setGameStatsProfileEditorMode = (mode) => {
  const iconOnly = mode === GAME_STATS_PROFILE_EDITOR_MODES.icon;
  gameStatsProfileEditorMode = iconOnly
    ? GAME_STATS_PROFILE_EDITOR_MODES.icon
    : GAME_STATS_PROFILE_EDITOR_MODES.create;
  gameProfileDialog?.classList.toggle("is-icon-only", iconOnly);
  if (gameProfileTitle) {
    gameProfileTitle.textContent = iconOnly ? "Change Profile Icon" : "Leaderboard Profile";
  }
  if (gameProfileNameControls) gameProfileNameControls.hidden = iconOnly;
  if (gameProfileNameCredit) gameProfileNameCredit.hidden = iconOnly;
  if (gameProfileSave) gameProfileSave.textContent = iconOnly ? "Save Icon" : "Save Profile";
  if (gameProfileCancel) gameProfileCancel.textContent = iconOnly ? "Cancel" : "Skip Leaderboard";
  if (gameProfileClose) {
    gameProfileClose.setAttribute(
      "aria-label",
      iconOnly ? "Close icon picker" : "Close leaderboard profile"
    );
  }
};

const setGameProfilePromptVisible = (visible) => {
  if (!gameProfilePrompt) return;
  gameProfilePrompt.classList.toggle("is-hidden", !visible);
  gameProfilePrompt.setAttribute("aria-hidden", String(!visible));
  if (visible) {
    gameProfileDialog?.classList.add("app-window--center");
    gameProfileDialog?.style.removeProperty("left");
    gameProfileDialog?.style.removeProperty("top");
    gameProfileDialog?.style.removeProperty("translate");
    restartWindowAnimation(gameProfileDialog, "is-opening");
  }
};

const getGameStatsNameRollCooldownSeconds = () =>
  Math.max(0, Math.ceil((gameStatsNameRollCooldownEndsAt - Date.now()) / 1000));

const stopGameStatsNameRollCooldown = () => {
  if (gameStatsNameRollCooldownTimer !== null) {
    window.clearInterval(gameStatsNameRollCooldownTimer);
    gameStatsNameRollCooldownTimer = null;
  }
  gameStatsNameRollCooldownEndsAt = 0;
};

const setGameProfileNameSuggestionsVisible = (visible) => {
  const isVisible = Boolean(
    visible &&
      !isGameStatsProfileIconEditor() &&
      !gameStatsNameRollInFlight &&
      gameStatsDraftNameSuggestions.length &&
      gameProfileNameOptions
  );
  gameStatsNameSuggestionsOpen = isVisible;
  gameProfileNameOptions?.classList.toggle("is-hidden", !isVisible);
  gameProfileNameOptions?.setAttribute("aria-hidden", String(!isVisible));
  gameProfileName?.setAttribute("aria-expanded", String(isVisible));
  gameProfileNameToggle?.setAttribute("aria-expanded", String(isVisible));
};

const setGameProfileNameSuggestionActive = (index, { focus = false } = {}) => {
  if (!gameProfileNameOptions || !gameStatsNameSuggestionsOpen) return;
  const options = [...gameProfileNameOptions.querySelectorAll("[role='option']")];
  if (!options.length) return;
  const normalizedIndex = Number.isInteger(index) && index >= 0 && index < options.length ? index : -1;
  gameStatsNameSuggestionActiveIndex = normalizedIndex;
  options.forEach((option, optionIndex) => {
    const isActive = optionIndex === normalizedIndex;
    option.classList.toggle("is-active", isActive);
  });
  if (normalizedIndex === -1) {
    gameProfileName?.removeAttribute("aria-activedescendant");
    return;
  }
  gameProfileName?.setAttribute("aria-activedescendant", options[normalizedIndex].id);
  if (focus) options[normalizedIndex].focus();
};

const selectGameStatsDraftName = (name) => {
  if (!gameStatsDraftProfile || !gameStatsDraftNameSuggestions.includes(name)) return;
  gameStatsDraftProfile.name = name;
  gameStatsNameSuggestionActiveIndex = gameStatsDraftNameSuggestions.indexOf(name);
  [...(gameProfileNameOptions?.querySelectorAll("[role='option']") || [])].forEach(
    (option, optionIndex) => {
      option.setAttribute(
        "aria-selected",
        String(gameStatsDraftNameSuggestions[optionIndex] === name)
      );
    }
  );
  setGameProfileNameSuggestionsVisible(false);
  updateGameProfileRerollState();
  gameProfileName?.focus();
};

const renderGameProfileNameSuggestions = () => {
  if (!gameProfileNameOptions) return;
  gameProfileNameOptions.replaceChildren();
  gameStatsDraftNameSuggestions.forEach((name, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "game-profile-name-option";
    option.id = `game-profile-name-option-${index}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(name === gameStatsDraftProfile?.name));
    option.textContent = name;
    option.addEventListener("click", () => selectGameStatsDraftName(name));
    gameProfileNameOptions.append(option);
  });
};

const updateGameProfileRerollState = () => {
  if (!gameStatsDraftProfile) return;
  const remaining = Math.max(
    0,
    GAME_STATS_MAX_NAME_REROLLS - gameStatsDraftProfile.rerollCount
  );
  const cooldownSeconds = getGameStatsNameRollCooldownSeconds();
  if (gameProfileName) {
    gameProfileName.setAttribute("aria-busy", String(gameStatsNameRollInFlight));
    gameProfileName.disabled = gameStatsNameRollInFlight;
    gameProfileName.value = gameStatsDraftProfile.name;
    gameProfileName.placeholder = gameStatsNameRollInFlight
      ? "Loading generated names…"
      : "Choose a generated name";
  }
  if (gameProfileNameToggle) {
    gameProfileNameToggle.disabled = gameStatsNameRollInFlight || !gameStatsDraftNameSuggestions.length;
  }
  if (gameProfileReroll) {
    gameProfileReroll.disabled =
      remaining <= 0 || gameStatsNameRollInFlight || cooldownSeconds > 0;
    gameProfileReroll.setAttribute(
      "aria-label",
      cooldownSeconds > 0
        ? `Reroll available in ${cooldownSeconds} second${cooldownSeconds === 1 ? "" : "s"}`
        : "Reroll generated name"
    );
  }
  if (gameProfileRerollLabel) {
    gameProfileRerollLabel.textContent = cooldownSeconds > 0 ? `${cooldownSeconds}s` : "Reroll";
  }
  if (gameProfileSave) {
    gameProfileSave.disabled = gameStatsNameRollInFlight || !gameStatsDraftProfile.name.trim();
  }
  if (gameProfileRerollCount) {
    gameProfileRerollCount.textContent = `${remaining} left`;
  }
};

const startGameStatsNameRollCooldown = () => {
  stopGameStatsNameRollCooldown();
  gameStatsNameRollCooldownEndsAt = Date.now() + GAME_STATS_NAME_ROLL_COOLDOWN_MS;
  updateGameProfileRerollState();
  gameStatsNameRollCooldownTimer = window.setInterval(() => {
    if (getGameStatsNameRollCooldownSeconds() === 0) stopGameStatsNameRollCooldown();
    updateGameProfileRerollState();
  }, 250);
};

const rollGameStatsDraftName = async ({ isReroll = false } = {}) => {
  if (
    !gameStatsDraftProfile ||
    gameStatsNameRollInFlight ||
    (isReroll && getGameStatsNameRollCooldownSeconds() > 0)
  ) {
    return false;
  }
  if (isReroll) startGameStatsNameRollCooldown();
  const rollId = ++gameStatsNameRollId;
  gameStatsNameRollInFlight = true;
  setGameProfileNameSuggestionsVisible(false);
  updateGameProfileRerollState();
  try {
    const suggestions = await fetchGameStatsNameSuggestions();
    if (!gameStatsDraftProfile || rollId !== gameStatsNameRollId) return false;
    gameStatsDraftNameSuggestions = suggestions;
    if (!isReroll || !gameStatsDraftProfile.name.trim()) {
      gameStatsDraftProfile.name = suggestions[0];
    }
    gameStatsNameSuggestionActiveIndex = suggestions.indexOf(gameStatsDraftProfile.name);
    renderGameProfileNameSuggestions();
    return true;
  } catch {
    if (!gameStatsDraftProfile || rollId !== gameStatsNameRollId) return false;
    if (!isReroll || !gameStatsDraftProfile.name.trim()) {
      gameStatsDraftProfile.name = GAME_STATS_API_ERROR_NAME;
      gameStatsDraftNameSuggestions = [];
      renderGameProfileNameSuggestions();
    }
    return false;
  } finally {
    if (rollId !== gameStatsNameRollId) return;
    gameStatsNameRollInFlight = false;
    updateGameProfileRerollState();
    setGameProfileNameSuggestionsVisible(Boolean(gameStatsDraftNameSuggestions.length));
    if (gameStatsNameSuggestionsOpen) {
      setGameProfileNameSuggestionActive(gameStatsNameSuggestionActiveIndex);
    }
  }
};

const getGameStatsProfileNameFromIcon = (filename) =>
  String(filename || "")
    .replace(/\.ico$/i, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 32);

const updateGameProfileIconOptionSelection = (selectedButton) => {
  gameProfileIconGallery
    ?.querySelectorAll(".game-profile-icon-option")
    .forEach((option) => {
      const selected = option === selectedButton;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-selected", String(selected));
    });
};

const renderGameProfileIconGallery = () => {
  if (!gameProfileIconGallery || !gameStatsDraftProfile) return;
  const filter = String(gameProfileIconSearch?.value || "").trim().toLowerCase();
  const icons = GAME_STATS_ICON_MANIFEST.filter((icon) =>
    icon.filename.toLowerCase().includes(filter)
  );
  gameProfileIconGallery.replaceChildren();
  if (!icons.length) {
    const empty = document.createElement("div");
    empty.className = "game-stats-empty";
    empty.textContent = "No matching icons.";
    gameProfileIconGallery.append(empty);
    return;
  }
  icons.forEach((icon) => {
    const button = document.createElement("button");
    button.className = "game-profile-icon-option";
    button.type = "button";
    button.classList.toggle("is-selected", icon.src === gameStatsDraftProfile.icon);
    button.setAttribute("aria-selected", String(icon.src === gameStatsDraftProfile.icon));
    const image = document.createElement("img");
    image.src = icon.src;
    image.alt = "";
    const label = document.createElement("span");
    label.textContent = icon.filename;
    button.append(image, label);
    button.addEventListener("click", () => {
      gameStatsDraftProfile.icon = icon.src;
      if (gameStatsDraftProfile.name === GAME_STATS_API_ERROR_NAME) {
        if (!isGameStatsProfileIconEditor()) {
          gameStatsDraftProfile.name = getGameStatsProfileNameFromIcon(icon.filename);
        }
      }
      updateGameProfileRerollState();
      updateGameProfileIconOptionSelection(button);
    });
    gameProfileIconGallery.append(button);
  });
};

const resolveGameStatsProfilePrompt = (profile) => {
  const resolve = gameStatsProfilePromptResolve;
  const returnFocus = gameStatsProfileDialogReturnFocus;
  gameStatsProfilePromptResolve = null;
  gameStatsProfileDialogReturnFocus = null;
  gameStatsDraftProfile = null;
  gameStatsNameRollId += 1;
  gameStatsNameRollInFlight = false;
  gameStatsDraftNameSuggestions = [];
  gameStatsNameSuggestionsOpen = false;
  gameStatsNameSuggestionActiveIndex = -1;
  renderGameProfileNameSuggestions();
  setGameProfileNameSuggestionsVisible(false);
  stopGameStatsNameRollCooldown();
  setGameProfilePromptVisible(false);
  setGameStatsProfileEditorMode(GAME_STATS_PROFILE_EDITOR_MODES.create);
  renderGameProgressWindow();
  if (resolve) resolve(profile);
  if (returnFocus?.isConnected) {
    window.setTimeout(() => returnFocus.focus(), 0);
  }
};

const skipGameStatsProfilePrompt = () => {
  resolveGameStatsProfilePrompt(null);
};

const requestGameStatsProfile = async () => {
  if (gameStatsProfile) return gameStatsProfile;
  if (!gameProfilePrompt || gameStatsProfilePromptResolve || gameStatsDraftProfile) return null;
  const defaultIcon =
    GAME_STATS_ICON_MANIFEST.find((icon) => icon.src === GAME_STATS_DEFAULT_ICON)?.src ||
    GAME_STATS_ICON_MANIFEST[0]?.src ||
    GAME_STATS_DEFAULT_ICON;
  gameStatsNameRollId += 1;
  gameStatsNameRollInFlight = false;
  stopGameStatsNameRollCooldown();
  setGameStatsProfileEditorMode(GAME_STATS_PROFILE_EDITOR_MODES.create);
  gameStatsDraftProfile = {
    id: createGameStatsEventId().replace(/^local-/, "player-"),
    name: "",
    icon: defaultIcon,
    rerollCount: 0,
  };
  gameStatsDraftNameSuggestions = [];
  gameStatsNameSuggestionsOpen = false;
  gameStatsNameSuggestionActiveIndex = -1;
  renderGameProfileNameSuggestions();
  setGameProfileNameSuggestionsVisible(false);
  if (gameProfileIconSearch) gameProfileIconSearch.value = "";
  updateGameProfileRerollState();
  renderGameProfileIconGallery();
  setGameProfilePromptVisible(true);
  void rollGameStatsDraftName();
  requestAnimationFrame(() => gameProfileReroll?.focus());
  return new Promise((resolve) => {
    gameStatsProfilePromptResolve = resolve;
  });
};

const openGameProgressProfileIconPicker = () => {
  if (
    !gameStatsProfile ||
    !gameProfilePrompt ||
    gameStatsProfilePromptResolve ||
    gameStatsDraftProfile
  ) {
    return false;
  }
  gameStatsNameRollId += 1;
  gameStatsNameRollInFlight = false;
  stopGameStatsNameRollCooldown();
  gameStatsDraftProfile = { ...gameStatsProfile };
  gameStatsDraftNameSuggestions = [];
  gameStatsNameSuggestionsOpen = false;
  gameStatsNameSuggestionActiveIndex = -1;
  renderGameProfileNameSuggestions();
  setGameStatsProfileEditorMode(GAME_STATS_PROFILE_EDITOR_MODES.icon);
  setGameProfileNameSuggestionsVisible(false);
  if (gameProfileIconSearch) gameProfileIconSearch.value = "";
  updateGameProfileRerollState();
  renderGameProfileIconGallery();
  gameStatsProfileDialogReturnFocus = document.getElementById(
    "game-progress-create-profile"
  );
  setGameProfilePromptVisible(true);
  requestAnimationFrame(() => gameProfileIconSearch?.focus());
  return true;
};

const createGameProgressProfile = async () => {
  if (gameStatsProfile) return gameStatsProfile;
  const profile = await requestGameStatsProfile();
  renderGameProgressWindow();
  return profile;
};

const queueGameStatsSubmission = (event, session, completion = null) => {
  if (!session && !completion) return false;
  gameStatsSubmissionQueue.push({
    event, session, ...(completion ? { completion } : {}), proofRejections: 0,
  });
  if (gameStatsSubmissionQueue.length > GAME_STATS_MAX_SYNC_QUEUE_LENGTH) {
    gameStatsSubmissionQueue = gameStatsSubmissionQueue.slice(-GAME_STATS_MAX_SYNC_QUEUE_LENGTH);
  }
  saveGameStatsSubmissionQueue();
  return true;
};

const waitForGameStatsTrophyState = (delayMs) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

const playGameStatsRecordHandoff = (game) => {
  const runHandoff = async () => {
    const trophyButton = Array.from(gameStatsOpenButtons).find(
      (button) => button.getAttribute("data-game-stats-open") === game
    );
    const reduceMotion = prefersReducedMotion();

    try {
      if (trophyButton && !reduceMotion) {
        for (let press = 0; press < GAME_STATS_RECORD_TROPHY_PRESS_COUNT; press += 1) {
          trophyButton.classList.add("is-pressed");
          await waitForGameStatsTrophyState(GAME_STATS_RECORD_TROPHY_PRESS_MS);
          trophyButton.classList.remove("is-pressed");
          await waitForGameStatsTrophyState(GAME_STATS_RECORD_TROPHY_RELEASE_MS);
        }
      }
      openGameStatsWindow(game);
    } finally {
      if (trophyButton?.classList.contains("is-pressed")) {
        trophyButton.classList.remove("is-pressed");
      }
    }
  };

  const handoffPromise = gameStatsRecordHandoffQueue.then(runHandoff, runHandoff);
  gameStatsRecordHandoffQueue = handoffPromise.catch(() => {});
  return handoffPromise;
};

const getGameStatsSyncStateDefinition = () =>
  GAME_STATS_SYNC_STATES[gameStatsSyncState] || GAME_STATS_SYNC_STATES.initial;

const setGameStatsSyncState = (state, { message = "", localResult = false } = {}) => {
  if (!GAME_STATS_SYNC_STATES[state]) return;
  if (gameStatsSyncState === "build-mismatch" && state !== "build-mismatch") return;
  if (state === "session-expired") {
    gameStatsExpiredResultNoticePending = true;
    gameStatsLocalResultNotice = null;
  } else if (localResult) {
    gameStatsLocalResultNotice = { state, message };
    gameStatsExpiredResultNoticePending = false;
  } else if (gameStatsManualRefreshInProgress || state === "publishing") {
    gameStatsExpiredResultNoticePending = false;
    gameStatsLocalResultNotice = null;
  }
  if (gameStatsLocalResultNotice && !gameStatsManualRefreshInProgress) {
    if (state === "fetching" && gameStatsSyncState === gameStatsLocalResultNotice.state) return;
    if (state === "ready") ({ state, message } = gameStatsLocalResultNotice);
  }
  if (gameStatsExpiredResultNoticePending && !gameStatsManualRefreshInProgress) {
    if (state === "fetching" && gameStatsSyncState === "session-expired") return;
    if (state === "ready") {
      state = "session-expired";
      message = "";
    }
  }
  if (
    gameStatsReleaseWaitCount > 0 &&
    state !== "release-waiting" &&
    state !== "build-mismatch"
  ) {
    return;
  }
  gameStatsSyncState = state;
  gameStatsSyncMessage = message || GAME_STATS_SYNC_STATES[state].message;
  renderGameStatsWindows();
};

const isGameStatsSyncBusy = () => getGameStatsSyncStateDefinition().busy;

const isVisibleGameStatsRefreshButton = (button) => {
  const windowElement = button?.closest("[data-game-stats-window]");
  return Boolean(
    button?.isConnected &&
      !button.disabled &&
      windowElement &&
      !windowElement.classList.contains("is-hidden") &&
      !windowElement.classList.contains("is-closing")
  );
};

const restoreGameStatsAuthenticationFocus = (preferredButton) => {
  const focusTarget = isVisibleGameStatsRefreshButton(preferredButton)
    ? preferredButton
    : Array.from(gameStatsRefreshButtons).find(isVisibleGameStatsRefreshButton) ||
      startButton;
  window.setTimeout(() => focusTarget?.focus(), 0);
};

const cancelGameStatsAuthenticationWait = () => {
  if (gameStatsSyncState !== "auth-waiting") return;
  const returnFocus = gameStatsAuthenticationReturnFocus;
  gameStatsAuthenticationReturnFocus = null;
  gameStatsManualRefreshInProgress = false;
  setGameStatsSyncState("auth-required");
  restoreGameStatsAuthenticationFocus(returnFocus);
};

const failGameStatsAuthenticationWait = () => {
  if (gameStatsSyncState !== "auth-waiting") return;
  const returnFocus = gameStatsAuthenticationReturnFocus;
  gameStatsAuthenticationReturnFocus = null;
  gameStatsManualRefreshInProgress = false;
  setGameStatsSyncState("auth-request-failed");
  restoreGameStatsAuthenticationFocus(returnFocus);
};

const setAdministratorAuthenticationLayerElevated = (elevated) => {
  const windowStack = administratorWindow?.closest(".window-stack");
  if (!windowStack) return;
  if (elevated) {
    windowStack.style.zIndex = String(GAME_STATS_ADMINISTRATOR_SIGN_IN_Z_INDEX);
  } else {
    windowStack.style.removeProperty("z-index");
  }
};

const clampVisibleAdministratorWindow = () => {
  if (
    !administratorWindow ||
    administratorWindow.classList.contains("is-hidden") ||
    administratorWindow.classList.contains("is-closing")
  ) {
    return;
  }
  clampWindowFullyIntoViewport(administratorWindow);
};

const requestGameStatsAdministratorAuthentication = (returnFocus) => {
  if (!["auth-required", "auth-request-failed"].includes(gameStatsSyncState)) return;
  gameStatsAuthenticationReturnFocus =
    returnFocus || gameStatsAuthenticationReturnFocus || null;
  if (isGameStatsCompletionDialogOpen()) {
    gameStatsAuthenticationDeferredForCompletion = true;
    return;
  }
  gameStatsAuthenticationDeferredForCompletion = false;
  gameStatsManualRefreshInProgress = true;
  setGameStatsSyncState("auth-waiting");
  setAdministratorAuthenticationLayerElevated(true);
  setWindowOpen("administrator", true);
  if (administratorWindow) {
    administratorWindow.style.zIndex = String(
      GAME_STATS_ADMINISTRATOR_SIGN_IN_Z_INDEX
    );
  }
  window.setTimeout(() => administratorUsername?.focus(), 0);
};

const refreshGameStatsGlobalState = async ({ announce = true, fresh = false } = {}) => {
  if (!isGameStatsBackendConfigured()) {
    if (announce) setGameStatsSyncState("unconfigured");
    return false;
  }
  try {
    const requestedPlayerId = gameStatsProfile?.id || "";
    const requestedAcknowledgmentIds = Array.from(gameStatsConfirmedEvents.keys()).slice(
      -GAME_STATS_MAX_PENDING_ACKNOWLEDGMENTS
    );
    const statsQuery = new URLSearchParams({ protocol: GAME_STATS_API_PROTOCOL });
    if (requestedPlayerId) statsQuery.set("playerId", requestedPlayerId);
    requestedAcknowledgmentIds.forEach((eventId) =>
      statsQuery.append("pendingEventId", eventId)
    );
    if (fresh) statsQuery.set("fresh", "1");
    const response = await fetchGameStatsApi(`/stats?${statsQuery}`, {
      method: "GET",
      ...(fresh ? { cache: "no-store" } : {}),
    });
    const payload = await readGameStatsApiJson(response);
    const nextGlobalPlayerTotalsAvailable = Boolean(
      requestedPlayerId &&
      payload?.playerTotals &&
      typeof payload.playerTotals === "object" &&
      !Array.isArray(payload.playerTotals)
    );
    const nextGlobalState = normalizeGameStatsData(payload, {
      solitaireLeaderboardDirection: "desc",
    });
    if ((gameStatsProfile?.id || "") !== requestedPlayerId) {
      gameStatsSyncRequested = true;
      return null;
    }
    reconcileConfirmedGameStatsEvents(nextGlobalState, {
      playerId: requestedPlayerId,
      playerTotalsAvailable: nextGlobalPlayerTotalsAvailable,
      requestedAcknowledgmentIds,
    });
    gameStatsGlobalState = nextGlobalState;
    gameStatsGlobalPlayerTotalsAvailable = nextGlobalPlayerTotalsAvailable;
    if (announce) {
      setGameStatsSyncState("ready");
    }
    return true;
  } catch {
    if (announce) {
      setGameStatsSyncState("request-failed");
    }
    return false;
  }
};

const runGameStatsSyncPass = async () => {
  let expiredCount = 0;
  let rejectedCount = 0;
  let waitingForAdministratorAuthorizationCount = 0;
  let waitingForSessionCount = 0;
  const remainingSubmissions = [];
  const hasQueuedSubmissions = gameStatsSubmissionQueue.length > 0;
  let publishedSubmission = false;

  setGameStatsSyncState(hasQueuedSubmissions ? "publishing" : "fetching");

  for (const submission of gameStatsSubmissionQueue) {
    const publicationProof = submission.completion || submission.session;
    if (!publicationProof) {
      waitingForSessionCount += 1;
      continue;
    }
    if (isGameStatsSessionExpired(publicationProof)) {
      expiredCount += 1;
      continue;
    }
    if (
      submission.event.profile?.id === GAME_STATS_ROHIN_NEKO_PROFILE.id &&
      !isGameStatsAdministratorProfile(submission.event.profile)
    ) {
      // No proof is ever attached to a non-canonical protected identity and the
      // Worker always rejects it, so asking for credentials could never help.
      rejectedCount += 1;
      continue;
    }
    const administratorHeaders = getAdministratorEventHeaders(submission.event.profile);
    const sentAdministratorProof = Boolean(administratorHeaders.Authorization);
    try {
      const response = await fetchGameStatsApi("/events", {
        method: "POST",
        headers: administratorHeaders,
        body: JSON.stringify({
          event: {
            ...submission.event,
            profile: normalizeGameStatsEventProfile(submission.event.profile),
          },
          ...(submission.completion
            ? { completion: { id: publicationProof.id, token: publicationProof.token } }
            : { session: { id: publicationProof.id, token: publicationProof.token } }),
        }),
      });
      const acknowledgement = await readGameStatsApiJson(response);
      publishedSubmission = true;
      // The Worker answers with the event id the result now stands under. A
      // different id means this submission was never stored: another tab
      // published the same puzzle first, and the server already counts that
      // win. Confirming this one would count it twice, and the id it would
      // then wait on can never appear in `/stats`, so the inflation would
      // survive every later refresh.
      const acknowledgedId = String(acknowledgement?.eventId || "");
      if (!acknowledgedId || acknowledgedId === submission.event.id) {
        markGameStatsEventConfirmed(submission.event);
      }
    } catch (error) {
      const status = Number(error?.status);
      const proofRejected =
        submission.event.profile?.id === GAME_STATS_ROHIN_NEKO_PROFILE.id &&
        status === 403 &&
        sentAdministratorProof &&
        error?.code === GAME_STATS_ADMINISTRATOR_AUTHORIZATION_ERROR_CODE;
      if (proofRejected) {
        submission.proofRejections = (submission.proofRejections || 0) + 1;
        clearGameStatsAdministratorProof();
      }
      if (isGameStatsSessionExpired(publicationProof)) {
        expiredCount += 1;
        continue;
      }
      if (
        submission.event.profile?.id === GAME_STATS_ROHIN_NEKO_PROFILE.id &&
        status === 403
      ) {
        if (
          !sentAdministratorProof ||
          (proofRejected &&
            submission.proofRejections <= GAME_STATS_MAX_ADMINISTRATOR_PROOF_RETRIES)
        ) {
          waitingForAdministratorAuthorizationCount += 1;
          remainingSubmissions.push(submission);
          continue;
        }
        // Any other 403 is a rejected game session, not a lost proof. Keep the
        // proof, stop asking for credentials, and keep the result locally.
      }
      if (
        status >= 400 &&
        status < 500 &&
        ![408, 425, 429].includes(status)
      ) {
        rejectedCount += 1;
      } else {
        remainingSubmissions.push(submission);
      }
    }
  }

  gameStatsSubmissionQueue = remainingSubmissions;
  saveGameStatsSubmissionQueue();
  setGameStatsSyncState("fetching");
  const globalStatsAvailable = await refreshGameStatsGlobalState({
    announce: false,
    fresh: gameStatsManualRefreshInProgress || publishedSubmission,
  });

  if (globalStatsAvailable === null) {
    return;
  }
  if (!globalStatsAvailable) {
    setGameStatsSyncState(
      waitingForAdministratorAuthorizationCount
        ? "auth-request-failed"
        : "request-failed"
    );
  } else if (waitingForSessionCount) {
    setGameStatsSyncState("ready", {
      message:
        "Local stats are saved. A result without a verified game session cannot be published.",
    });
  } else if (waitingForAdministratorAuthorizationCount) {
    setGameStatsSyncState("auth-required");
  } else if (expiredCount) {
    setGameStatsSyncState("session-expired");
  } else if (rejectedCount) {
    setGameStatsSyncState("ready", {
      message: "Local stats are saved, but a result could not pass server verification.",
      localResult: true,
    });
  } else if (gameStatsSubmissionQueue.length) {
    setGameStatsSyncState("request-failed");
  } else {
    setGameStatsSyncState("ready");
  }

  if (waitingForAdministratorAuthorizationCount) {
    requestGameStatsAdministratorAuthentication();
  }
};

const syncQueuedGameStats = ({ manual = false } = {}) => {
  if (gameStatsSyncState === "build-mismatch") return Promise.resolve(false);
  if (gameStatsSyncState === "auth-waiting") {
    return gameStatsSyncPromise || Promise.resolve(false);
  }
  if (!isGameStatsBackendConfigured()) {
    setGameStatsSyncState("unconfigured");
    return Promise.resolve(false);
  }
  if (manual) gameStatsManualRefreshInProgress = true;
  if (gameStatsSyncPromise) {
    gameStatsSyncRequested = true;
    return gameStatsSyncPromise;
  }

  gameStatsSyncInProgress = true;
  gameStatsSyncPromise = (async () => {
    do {
      gameStatsSyncRequested = false;
      await runGameStatsSyncPass();
    } while (gameStatsSyncRequested);
    return gameStatsSyncState !== "request-failed";
  })()
    .catch(() => {
      setGameStatsSyncState("request-failed");
      return false;
    })
    .finally(() => {
      gameStatsSyncInProgress = false;
      gameStatsSyncRequested = false;
      gameStatsManualRefreshInProgress = false;
      gameStatsSyncPromise = null;
      renderGameStatsWindows();
    });
  return gameStatsSyncPromise;
};

const gameStatsCanonicalMetricGroups = new Map();

const getGameStatsMetricCategory = (data, event) => {
  const field = event.game === "snake" ? event.boardSize : event.difficulty;
  const entries = event.game === "solitaire"
    ? data.leaderboards.solitaire : data.leaderboards[event.game][field];
  return {
    key: `${event.game}:${field || ""}`,
    direction: event.game === "snake" ? "desc" : "asc",
    limit: event.game === "snake" || event.game === "solitaire" ? 5 : 3,
    entries,
    record: event.game === "solitaire" ? null : data.playerRecords[event.game][field],
    setEntries(value) {
      if (event.game === "solitaire") data.leaderboards.solitaire = value;
      else data.leaderboards[event.game][field] = value;
    },
    setRecord(value) {
      if (event.game !== "solitaire") data.playerRecords[event.game][field] = value;
    },
  };
};

/** Retains the pre-result best while concurrent server clocks are reconciled. */
const beginGameStatsMetricCorrection = (event, pending) => {
  if (!pending && !gameStatsCanonicalMetricGroups.size) return null;
  if (gameStatsLocalState.eventIds.includes(event.id)) return null;
  const category = getGameStatsMetricCategory(gameStatsLocalState, event);
  let group = gameStatsCanonicalMetricGroups.get(category.key);
  if (!group && !pending) return null;
  if (!group || group.generation !== gameStatsLocalResetGeneration) {
    group = {
      generation: gameStatsLocalResetGeneration,
      entries: category.entries.slice(), record: category.record,
      bestTime: event.game === "sudoku" ? gameStatsLocalState.totals.sudoku.bestTimes[event.difficulty] : null,
      events: new Map(),
    };
    gameStatsCanonicalMetricGroups.set(category.key, group);
  }
  group.events.set(event.id, { event: { ...event }, settled: !pending });
  return { group, key: category.key };
};

const finishGameStatsMetricCorrection = (correction, event) => {
  if (!correction) return;
  const { group, key } = correction;
  if (group.generation !== gameStatsLocalResetGeneration) {
    if (gameStatsCanonicalMetricGroups.get(key) === group) gameStatsCanonicalMetricGroups.delete(key);
    return;
  }
  const update = group.events.get(event.id);
  update.event = { ...event };
  update.settled = true;
  const category = getGameStatsMetricCategory(gameStatsLocalState, event);
  const pendingIds = new Set(group.events.keys());
  const candidates = [...group.entries, ...category.entries.filter((entry) => !pendingIds.has(entry.eventId))];
  const players = new Map();
  for (const entry of candidates) {
    const existing = players.get(entry.playerId);
    if (!existing || compareGameStatsLeaderboardEntries(category.direction, entry, existing) < 0) {
      players.set(entry.playerId, entry);
    }
  }
  let entries = Array.from(players.values()).sort((first, second) =>
    compareGameStatsLeaderboardEntries(category.direction, first, second)
  ).slice(0, category.limit);
  let record = category.record && !pendingIds.has(category.record.eventId)
    ? category.record : group.record;
  let bestTime = group.bestTime;
  for (const item of group.events.values()) {
    const candidate = item.event;
    if (candidate.game === "sudoku" && candidate.hintBucket !== "noHints") continue;
    entries = upsertGameStatsLeaderboardEntry(entries, candidate, category.limit, category.direction);
    record = updateGameStatsPlayerRecord(record, candidate, category.direction);
    if (candidate.game === "sudoku") {
      bestTime = bestTime === null ? candidate.metric : Math.min(bestTime, candidate.metric);
    }
  }
  category.setEntries(entries);
  category.setRecord(record);
  if (event.game === "sudoku") gameStatsLocalState.totals.sudoku.bestTimes[event.difficulty] = bestTime;
  if (Array.from(group.events.values()).every((item) => item.settled)) {
    gameStatsCanonicalMetricGroups.delete(key);
  }
  saveGameStatsLocalState();
};

const recordGameStatsEvent = async (
  rawEvent,
  sessionKey = "",
  {
    sudokuNoHintsSeconds = null, snakePreviousHighScore = undefined,
    completionPromise = null, onCanonicalMetric = null,
  } = {}
) => {
  const sessionResultPromise = completionPromise
    ? completionPromise.then(
        (completion) => ({ completion }),
        (error) => ({ reason: error?.code || "request-failed", status: Number(error?.status) || 0 })
      )
    : getGameStatsSession(sessionKey);
  const event = normalizeGameStatsEvent(rawEvent);
  if (!event) return;
  const recordOptions = { snakePreviousHighScore };
  const mayBeatPersonalRecord = gameStatsEventBeatsPersonalRecord(
    gameStatsLocalState,
    gameStatsGlobalState,
    event,
    recordOptions
  );
  const resetGeneration = gameStatsLocalResetGeneration;
  let profile = gameStatsProfile;
  if (
    !profile &&
    (event.type === "win" ||
      mayBeatPersonalRecord ||
      gameStatsEventQualifiesForLeaderboard(event))
  ) {
    profile = await requestGameStatsProfile();
  }
  if (profile) event.profile = normalizeGameStatsEventProfile(profile);
  if (resetGeneration !== gameStatsLocalResetGeneration) return;
  const beatPersonalRecord = gameStatsEventBeatsPersonalRecord(
    gameStatsLocalState,
    gameStatsGlobalState,
    event,
    recordOptions
  );
  const priorRecordData = completionPromise ? JSON.parse(JSON.stringify({
    leaderboards: gameStatsLocalState.leaderboards,
    playerRecords: gameStatsLocalState.playerRecords,
    totals: { sudoku: { bestTimes: gameStatsLocalState.totals.sudoku.bestTimes } },
  })) : null;
  const metricCorrection = beginGameStatsMetricCorrection(event, Boolean(completionPromise));
  const applied = applyGameStatsEventToData(gameStatsLocalState, event);
  if (!applied) return;
  if (event.game === "sudoku" && event.hintBucket === "noHints") {
    updateGameStatsSudokuBestTime(
      gameStatsLocalState,
      event.difficulty,
      sudokuNoHintsSeconds
    );
  }
  saveGameStatsLocalState();
  let recordHandoffPromise = beatPersonalRecord && !completionPromise
    ? playGameStatsRecordHandoff(event.game)
    : null;
  const sessionResult = await sessionResultPromise;
  const completion = sessionResult?.completion || null;
  const session = sessionResult?.session || null;
  if (completion) {
    const canonical = normalizeGameStatsEvent({ ...completion.event, profile: event.profile });
    if (!canonical || canonical.id !== event.id || canonical.game !== event.game ||
        canonical.type !== event.type || canonical.difficulty !== event.difficulty ||
        canonical.boardSize !== event.boardSize || canonical.hintBucket !== event.hintBucket) {
      finishGameStatsMetricCorrection(metricCorrection, event);
      setGameStatsSyncState("ready", {
        message: "Local stats are saved, but a result could not pass server verification.",
        localResult: true,
      });
      if (recordHandoffPromise) await recordHandoffPromise;
      return;
    }
    Object.assign(event, canonical);
    finishGameStatsMetricCorrection(metricCorrection, event);
    onCanonicalMetric?.({
      metric: event.metric, metricKind: event.metricKind, elapsedMs: completion.elapsedMs,
      updateLocalStats: resetGeneration === gameStatsLocalResetGeneration,
    });
  } else {
    finishGameStatsMetricCorrection(metricCorrection, event);
  }
  if (completionPromise && resetGeneration === gameStatsLocalResetGeneration &&
      gameStatsEventBeatsPersonalRecord(priorRecordData, gameStatsGlobalState, event, recordOptions)) {
    recordHandoffPromise = playGameStatsRecordHandoff(event.game);
  }
  if (!session && !completion) {
    if (sessionResult?.reason === "session-expired") {
      setGameStatsSyncState("session-expired");
    } else if (sessionResult?.reason === "replay-limit") {
      setGameStatsSyncState("ready", {
        message: "Saved on this device. This game's replay exceeds verification limits, so this result can't be published.",
        localResult: true,
      });
    } else if (completionPromise && [401, 403, 429].includes(sessionResult?.status)) {
      reportGameStatsSessionFailure(sessionResult, { localSaved: true });
    } else if (completionPromise) {
      setGameStatsSyncState("ready", {
        message: "Local stats are saved, but this game's result could not be verified for publication.",
        localResult: true,
      });
    } else if (sessionKey) {
      reportGameStatsSessionFailure(sessionResult, { localSaved: true });
    } else {
      setGameStatsSyncState("ready", {
        message: "Local stats are saved. This result started without a verified game session.",
        localResult: true,
      });
    }
    if (recordHandoffPromise) await recordHandoffPromise;
    return;
  }
  if (isGameStatsSessionExpired(completion || session)) {
    setGameStatsSyncState("session-expired");
    if (recordHandoffPromise) await recordHandoffPromise;
    return;
  }
  queueGameStatsSubmission(event, session, completion);
  if (gameStatsSyncState !== "auth-waiting") {
    setGameStatsSyncState("publishing", {
      message: "Publishing saved results...",
    });
  }
  void syncQueuedGameStats();
  if (recordHandoffPromise) await recordHandoffPromise;
};

const formatGameStatsCounter = (value, length = 3) =>
  String(Math.max(0, Math.trunc(Number(value) || 0))).padStart(length, " ");

const gameStatsDigitResizeObservers = new WeakMap();

const disconnectGameStatsDigitResizeObservers = (container) => {
  container?.querySelectorAll(".game-stats-digit-strip").forEach((strip) => {
    const observer = gameStatsDigitResizeObservers.get(strip);
    if (!observer) return;
    observer.disconnect();
    gameStatsDigitResizeObservers.delete(strip);
  });
};

const appendGameStatsDigits = (
  container,
  value,
  length = 3,
  { decorative = false, fillWidth = false } = {}
) => {
  const strip = document.createElement("span");
  strip.className = "game-stats-digit-strip";
  if (decorative) strip.setAttribute("aria-hidden", "true");
  const renderDigits = () => {
    const availableDigitSlots = fillWidth
      ? Math.floor(Math.max(0, strip.clientWidth - 4) / 11)
      : 0;
    const digitLength = Math.max(length, availableDigitSlots);
    if (strip.dataset.gameStatsDigitLength === String(digitLength)) return;
    const digits = formatGameStatsCounter(value, digitLength).slice(-digitLength);
    strip.dataset.gameStatsDigitLength = String(digitLength);
    strip.style.setProperty("--game-stats-digit-count", String(digits.length));
    strip.replaceChildren();
    digits.split("").forEach((digit) => {
      const image = document.createElement("img");
      image.src = GAME_STATS_DIGIT_SOURCES[digit] || GAME_STATS_DIGIT_SOURCES[" "];
      image.alt = decorative ? "" : digit.trim();
      strip.append(image);
    });
  };

  renderDigits();
  container.append(strip);
  if (fillWidth) {
    window.requestAnimationFrame(renderDigits);
    if (typeof ResizeObserver === "undefined") return;
    const digitResizeObserver = new ResizeObserver(() => {
      if (!strip.isConnected) {
        digitResizeObserver.disconnect();
        gameStatsDigitResizeObservers.delete(strip);
        return;
      }
      renderDigits();
    });
    gameStatsDigitResizeObservers.set(strip, digitResizeObserver);
    digitResizeObserver.observe(strip);
  }
};

const createGameStatsNode = (tagName, className, text = "") => {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const appendGameStatsMetric = (container, entry) => {
  if (entry.metricKind === "seconds") {
    appendGameStatsDigits(container, entry.metric, 3);
    return;
  }
  container.append(createGameStatsNode("span", "", String(entry.metric)));
};

const createGameStatsPlayerIcon = (source, className = "game-stats-player-icon") => {
  const icon = document.createElement("img");
  const fallback = GAME_STATS_DEFAULT_ICON;
  icon.className = className;
  icon.src = source || fallback;
  icon.alt = "";
  if (source === GAME_STATS_ROHIN_NEKO_AVATAR_ICON) {
    icon.dataset.rohinNekoAvatar = "true";
  }
  icon.addEventListener(
    "error",
    () => {
      icon.src = fallback;
    },
    { once: true }
  );
  return icon;
};

const createGameStatsPlayerName = (value, { currentPlayer = false } = {}) => {
  const name = createGameStatsNode("span", "game-stats-player-name");
  const fullName = String(value || "N/A");
  const text = createGameStatsNode("span", "game-stats-player-name-text", fullName);
  name.title = fullName;
  if (currentPlayer) name.classList.add("is-current-player");
  name.append(text);
  return name;
};

const updateGameStatsPlayerNameMarquees = (root = document) => {
  if (!root) return;
  root.querySelectorAll(".game-stats-player-name").forEach((name) => {
    const text = name.querySelector(".game-stats-player-name-text");
    if (!text || !name.clientWidth) return;
    const distance = Math.max(0, Math.ceil(text.scrollWidth - name.clientWidth));
    const isOverflowing = distance > 0;
    name.classList.toggle("is-overflowing", isOverflowing);
    if (isOverflowing) {
      name.style.setProperty("--game-stats-name-scroll-distance", `${distance}px`);
      name.style.setProperty(
        "--game-stats-name-scroll-duration",
        `${clampNumber(distance / 12, 3, 10).toFixed(2)}s`
      );
    } else {
      name.style.removeProperty("--game-stats-name-scroll-distance");
      name.style.removeProperty("--game-stats-name-scroll-duration");
    }
  });
};

let gameStatsNameMarqueeFrame = 0;

const scheduleGameStatsPlayerNameMarquees = () => {
  if (gameStatsNameMarqueeFrame) window.cancelAnimationFrame(gameStatsNameMarqueeFrame);
  gameStatsNameMarqueeFrame = window.requestAnimationFrame(() => {
    gameStatsNameMarqueeFrame = 0;
    updateGameStatsPlayerNameMarquees();
  });
};

const gameStatsMinesweeperPersonalRecord = (difficulty) => {
  const globalRecord = gameStatsProfile
    ? gameStatsGlobalState.playerRecords.minesweeper[difficulty]
    : null;
  if (
    gameStatsProfile &&
    globalRecord?.playerId === gameStatsProfile.id &&
    Number.isFinite(globalRecord.metric)
  ) {
    return globalRecord.metric;
  }
  const localEntries = gameStatsLocalState.leaderboards.minesweeper[difficulty] || [];
  const times = localEntries
    .filter((entry) => entry.playerId === gameStatsProfile?.id)
    .map((entry) => entry.metric)
    .filter((metric) => Number.isFinite(metric));
  return times.length ? Math.min(...times) : 999;
};

const getGameStatsVerifiedPlayerRecord = (record) =>
  gameStatsProfile && record?.playerId === gameStatsProfile.id ? record : null;

const getGameStatsLocalPlayerRecord = (record) =>
  gameStatsProfile && record?.playerId === gameStatsProfile.id ? record : null;

const createGameStatsLeaderboardPlayer = (
  nameValue,
  iconSource,
  {
    currentPlayer = false,
    className = "",
    iconClassName = "",
  } = {}
) => {
  const identity = createGameStatsNode(
    "span",
    ["game-stats-leaderboard-template-player", className]
      .filter(Boolean)
      .join(" ")
  );
  identity.append(
    createGameStatsPlayerIcon(
      iconSource,
      ["game-stats-leaderboard-template-player-icon", iconClassName]
        .filter(Boolean)
        .join(" ")
    ),
    createGameStatsPlayerName(nameValue, { currentPlayer })
  );
  return identity;
};

const createMinesweeperLeaderboardPlayer = (
  nameValue,
  iconSource,
  { currentPlayer = false } = {}
) =>
  createGameStatsLeaderboardPlayer(nameValue, iconSource, {
    currentPlayer,
    className: "game-stats-minesweeper-player",
    iconClassName: "game-stats-minesweeper-player-icon",
  });

/**
 * Builds the shared shell for an ordered game leaderboard. Consumers provide
 * their game-specific classes and can override the metric presentation while
 * the panel, heading, label, and list keep a consistent accessible structure.
 */
const createGameStatsLeaderboardTemplate = ({
  title,
  titleId = "",
  sectionLabel = "Leaderboard",
  className = "",
  headingClassName = "",
  sectionLabelClassName = "",
  listClassName = "",
  metricPresentation = "digits",
  metricFormatter = null,
}) => {
  const panel = createGameStatsNode(
    "section",
    ["game-stats-leaderboard-template", className].filter(Boolean).join(" ")
  );
  const heading = createGameStatsNode(
    "h3",
    ["game-stats-leaderboard-template-heading", headingClassName]
      .filter(Boolean)
      .join(" "),
    title
  );
  if (titleId) {
    heading.id = titleId;
    panel.setAttribute("aria-labelledby", titleId);
  }
  const label = createGameStatsNode(
    "div",
    ["game-stats-leaderboard-template-subheading", sectionLabelClassName]
      .filter(Boolean)
      .join(" "),
    sectionLabel
  );
  const list = createGameStatsNode(
    "ol",
    ["game-stats-leaderboard-template-list", listClassName]
      .filter(Boolean)
      .join(" ")
  );
  const appendMetric = (container, value, options = {}) => {
    if (metricPresentation === "text") {
      container.classList.add("game-stats-metric--text");
      container.textContent =
        typeof metricFormatter === "function" ? metricFormatter(value) : String(value);
      return;
    }
    appendGameStatsLeaderboardMetric(container, value, options);
  };
  panel.append(heading, label, list);
  return { panel, list, appendMetric };
};

/**
 * Builds a three-slot leaderboard entry: rank, player identity, and metric.
 * The caller owns the slot content so medals, numeric ranks, and digit-based
 * timers remain interchangeable without changing the row structure.
 */
const createGameStatsLeaderboardRow = ({
  tagName = "div",
  className = "",
  rank,
  identity,
  metric,
  ariaLabel = "",
}) => {
  const row = createGameStatsNode(
    tagName,
    ["game-stats-leaderboard-template-row", className].filter(Boolean).join(" ")
  );
  if (ariaLabel) row.setAttribute("aria-label", ariaLabel);
  row.append(rank, identity, metric);
  return row;
};

/**
 * Adds a labeled leaderboard detail without introducing an extra layout
 * wrapper. This keeps record and aggregate cards aligned with leaderboard
 * entries while allowing games to supply their own presentation classes.
 */
const createGameStatsLeaderboardLabeledSection = ({
  label,
  value,
  className = "",
  labelClassName = "",
}) => {
  const section = createGameStatsNode(
    "div",
    ["game-stats-leaderboard-template-section", className]
      .filter(Boolean)
      .join(" ")
  );
  section.append(
    createGameStatsNode(
      "div",
      ["game-stats-leaderboard-template-subheading", labelClassName]
        .filter(Boolean)
        .join(" "),
      label
    ),
    value
  );
  return section;
};

const appendMinesweeperLeaderboardRows = (list, entries) => {
  Array.from({ length: 3 }, (_, index) => {
    const entry = entries[index] || null;
    const metricValue = entry?.metric ?? 999;
    const medal = document.createElement("img");
    medal.className = "game-stats-minesweeper-medal";
    medal.src = GAME_STATS_MEDAL_SOURCES[index];
    medal.alt = "";
    medal.setAttribute("aria-hidden", "true");

    const isCurrentPlayer = Boolean(
      entry && gameStatsProfile && entry.playerId === gameStatsProfile.id
    );
    const iconSource = entry?.icon || (
      entry ? GAME_STATS_DEFAULT_ICON : GAME_STATS_EMPTY_LEADERBOARD_ICON
    );
    const identity = createMinesweeperLeaderboardPlayer(
      entry?.name || "N/A",
      iconSource,
      { currentPlayer: isCurrentPlayer }
    );
    const metric = createGameStatsNode("span", "game-stats-metric");
    appendGameStatsDigits(metric, metricValue, 3);
    const row = createGameStatsLeaderboardRow({
      tagName: "li",
      className: "game-stats-minesweeper-row",
      rank: medal,
      identity,
      metric,
      ariaLabel: `Rank ${index + 1}: ${entry?.name || "N/A"}, ${metricValue} seconds${
        isCurrentPlayer ? ", your entry" : ""
      }`,
    });
    list.append(row);
  });
};

const appendGameStatsLeaderboardMetric = (
  container,
  metricValue,
  { decorative = false, fillWidth = false } = {}
) => {
  const normalizedMetric = Math.max(0, Number(metricValue) || 0);
  appendGameStatsDigits(
    container,
    normalizedMetric,
    Math.max(3, String(Math.trunc(normalizedMetric)).length),
    { decorative, fillWidth }
  );
};

const createGameStatsGlobalCounterValue = (value, ariaLabel, className) => {
  const displayValue = createGameStatsNode(
    "span",
    [className, "game-stats-global-counter-value"].filter(Boolean).join(" ")
  );
  displayValue.setAttribute("role", "img");
  displayValue.setAttribute("aria-label", ariaLabel);
  appendGameStatsLeaderboardMetric(displayValue, value, {
    decorative: true,
    fillWidth: true,
  });
  return displayValue;
};

const formatGameStatsSudokuDifficulty = (difficulty) =>
  `${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;

const formatGameStatsSudokuLeaderboardTime = (seconds) =>
  formatElapsedTime(seconds, GAME_STATS_SUDOKU_PLACEHOLDER_TIME);

const gameStatsSudokuTotalGames = (difficulty) => {
  const wins = gameStatsGlobalState.totals.sudoku.wins[difficulty];
  return wins.noHints + wins.withHints;
};

const appendSudokuGlobalLeaderboardRows = (list, entries, appendMetric) => {
  Array.from({ length: 3 }, (_, index) => {
    const entry = entries[index] || null;
    const seconds = Number.isFinite(entry?.metric) ? entry.metric : null;
    const timeLabel = seconds === null ? "no recorded time" : `${seconds} seconds`;
    const medal = document.createElement("img");
    medal.className = "game-stats-leaderboard-template-medal";
    medal.src = GAME_STATS_MEDAL_SOURCES[index];
    medal.alt = "";
    medal.setAttribute("aria-hidden", "true");

    const isCurrentPlayer = Boolean(
      entry && gameStatsProfile && entry.playerId === gameStatsProfile.id
    );
    const iconSource = entry?.icon || (
      entry ? GAME_STATS_DEFAULT_ICON : GAME_STATS_EMPTY_LEADERBOARD_ICON
    );
    const identity = createGameStatsLeaderboardPlayer(entry?.name || "N/A", iconSource, {
      currentPlayer: isCurrentPlayer,
    });
    const metric = createGameStatsNode("span", "game-stats-metric");
    appendMetric(metric, seconds);
    list.append(
      createGameStatsLeaderboardRow({
        tagName: "li",
        className: "game-stats-sudoku-row",
        rank: medal,
        identity,
        metric,
        ariaLabel: `Rank ${index + 1}: ${entry?.name || "N/A"}, ${timeLabel}${
          isCurrentPlayer ? ", your entry" : ""
        }`,
      })
    );
  });
};

const appendSudokuPersonalRecord = (panel, difficulty, appendMetric) => {
  const verifiedEntry = getGameStatsVerifiedPlayerRecord(
    gameStatsGlobalState.playerRecords.sudoku[difficulty]
  );
  const localEntry = getGameStatsLocalPlayerRecord(
    gameStatsLocalState.leaderboards.sudoku[difficulty][0]
  );
  const entry = verifiedEntry || localEntry;
  const playerRank = verifiedEntry
    ? gameStatsGlobalState.playerRanks.sudoku[difficulty]
    : createGameStatsEmptyPlayerRank();
  const seconds = Number.isFinite(entry?.metric) ? entry.metric : null;
  const hasEntry = Boolean(entry && seconds !== null);
  const rankText = `#${playerRank.rank ?? "—"}`;
  const rank = createGameStatsNode(
    "span",
    "game-stats-leaderboard-template-rank",
    rankText
  );
  rank.setAttribute(
    "aria-label",
    playerRank.rank ? `Global rank ${playerRank.rank}` : "No global rank"
  );
  const iconSource =
    entry?.icon || gameStatsProfile?.icon || GAME_STATS_EMPTY_LEADERBOARD_ICON;
  const identity = createGameStatsLeaderboardPlayer(
    entry?.name || gameStatsProfile?.name || "N/A",
    iconSource,
    {
      currentPlayer: Boolean(gameStatsProfile),
    }
  );
  const metric = createGameStatsNode("span", "game-stats-metric");
  appendMetric(metric, seconds);
  const row = createGameStatsLeaderboardRow({
    className: "game-stats-sudoku-row game-stats-sudoku-local-best-row",
    rank,
    identity,
    metric,
    ariaLabel: hasEntry
      ? `Your no-hints record: ${rankText}, ${entry.name}, ${seconds} seconds`
      : `Your no-hints record: ${rankText}, N/A, no record`,
  });
  panel.append(
    createGameStatsLeaderboardLabeledSection({
      label: "Your Record",
      value: row,
      className: "game-stats-sudoku-local-best",
    })
  );
};

const appendSudokuTotalGames = (panel, difficulty) => {
  const totalGames = gameStatsSudokuTotalGames(difficulty);
  const label = formatGameStatsSudokuDifficulty(difficulty);
  const value = createGameStatsGlobalCounterValue(
    totalGames,
    `Total verified Sudoku completions on ${label}: ${totalGames}`,
    "game-stats-leaderboard-template-stat-value"
  );
  panel.append(
    createGameStatsLeaderboardLabeledSection({
      label: "Total Games",
      value,
      className: "game-stats-sudoku-total-games",
    })
  );
};

const appendSolitaireGlobalLeaderboardRows = (list, entries) => {
  Array.from({ length: 3 }, (_, index) => {
    const entry = entries[index] || null;
    const wins = entry?.metric ?? 0;
    const medal = document.createElement("img");
    medal.className = "game-stats-leaderboard-template-medal";
    medal.src = GAME_STATS_MEDAL_SOURCES[index];
    medal.alt = "";
    medal.setAttribute("aria-hidden", "true");

    const isCurrentPlayer = Boolean(
      entry && gameStatsProfile && entry.playerId === gameStatsProfile.id
    );
    const iconSource = entry?.icon || (
      entry ? GAME_STATS_DEFAULT_ICON : GAME_STATS_EMPTY_LEADERBOARD_ICON
    );
    const identity = createGameStatsLeaderboardPlayer(entry?.name || "N/A", iconSource, {
      currentPlayer: isCurrentPlayer,
    });
    const metric = createGameStatsNode("span", "game-stats-metric");
    appendGameStatsLeaderboardMetric(metric, wins);
    list.append(
      createGameStatsLeaderboardRow({
        tagName: "li",
        className: "game-stats-solitaire-row",
        rank: medal,
        identity,
        metric,
        ariaLabel: `Rank ${index + 1}: ${entry?.name || "N/A"}, ${wins} ${
          wins === 1 ? "win" : "wins"
        }${
          isCurrentPlayer ? ", your entry" : ""
        }`,
      })
    );
  });
};

const appendSolitairePersonalRecord = (panel) => {
  const verifiedEntry = getGameStatsVerifiedPlayerRecord(
    gameStatsGlobalState.playerRecords.solitaire
  );
  const wins = gameStatsGlobalPlayerTotalsAvailable
    ? gameStatsGlobalState.playerTotals.solitaire.wins
    : verifiedEntry?.metric ?? gameStatsLocalState.totals.solitaire.wins;
  const hasProfile = Boolean(gameStatsProfile);
  const playerRank = verifiedEntry
    ? gameStatsGlobalState.playerRanks.solitaire
    : createGameStatsEmptyPlayerRank();
  const rankText = `#${playerRank.rank ?? "—"}`;
  const rank = createGameStatsNode(
    "span",
    "game-stats-leaderboard-template-rank",
    rankText
  );
  rank.setAttribute(
    "aria-label",
    playerRank.rank ? `Global rank ${playerRank.rank}` : "No global rank"
  );
  const iconSource =
    verifiedEntry?.icon ||
    gameStatsProfile?.icon ||
    (hasProfile ? GAME_STATS_DEFAULT_ICON : GAME_STATS_EMPTY_LEADERBOARD_ICON);
  const identity = createGameStatsLeaderboardPlayer(
    verifiedEntry?.name || gameStatsProfile?.name || "N/A",
    iconSource,
    {
      currentPlayer: hasProfile,
    }
  );
  const metric = createGameStatsNode("span", "game-stats-metric");
  appendGameStatsLeaderboardMetric(metric, wins);
  const row = createGameStatsLeaderboardRow({
    className: "game-stats-solitaire-row game-stats-solitaire-local-wins-row",
    rank,
    identity,
    metric,
    ariaLabel: `Your Solitaire record: ${rankText}, ${
      verifiedEntry?.name || gameStatsProfile?.name || "N/A"
    }, ${wins} ${
      wins === 1 ? "win" : "wins"
    }`,
  });
  panel.append(
    createGameStatsLeaderboardLabeledSection({
      label: "Your Record",
      value: row,
      className: "game-stats-solitaire-local-wins",
    })
  );
};

const appendSolitaireGlobalWins = (panel) => {
  const wins = gameStatsGlobalState.totals.solitaire.wins;
  const value = createGameStatsGlobalCounterValue(
    wins,
    `Global wins: ${wins}`,
    "game-stats-leaderboard-template-stat-value"
  );
  panel.append(
    createGameStatsLeaderboardLabeledSection({
      label: "Global Wins",
      value,
      className: "game-stats-solitaire-global-wins",
    })
  );
};

const appendSnakeGlobalLeaderboardRows = (list, entries) => {
  Array.from({ length: 3 }, (_, index) => {
    const entry = entries[index] || null;
    const score = entry?.metric ?? 0;
    const medal = document.createElement("img");
    medal.className = "game-stats-leaderboard-template-medal";
    medal.src = GAME_STATS_MEDAL_SOURCES[index];
    medal.alt = "";
    medal.setAttribute("aria-hidden", "true");

    const isCurrentPlayer = Boolean(
      entry && gameStatsProfile && entry.playerId === gameStatsProfile.id
    );
    const iconSource = entry?.icon || (
      entry ? GAME_STATS_DEFAULT_ICON : GAME_STATS_EMPTY_LEADERBOARD_ICON
    );
    const identity = createGameStatsLeaderboardPlayer(entry?.name || "N/A", iconSource, {
      currentPlayer: isCurrentPlayer,
    });
    const metric = createGameStatsNode("span", "game-stats-metric");
    appendGameStatsLeaderboardMetric(metric, score);
    list.append(
      createGameStatsLeaderboardRow({
        tagName: "li",
        className: "game-stats-snake-row",
        rank: medal,
        identity,
        metric,
        ariaLabel: `Rank ${index + 1}: ${entry?.name || "N/A"}, ${score} points${
          isCurrentPlayer ? ", your entry" : ""
        }`,
      })
    );
  });
};

const appendSnakePersonalRecord = (panel, size) => {
  const verifiedEntry = getGameStatsVerifiedPlayerRecord(
    gameStatsGlobalState.playerRecords.snake[size]
  );
  const localEntry = getGameStatsLocalPlayerRecord(
    gameStatsLocalState.leaderboards.snake[size][0]
  );
  const entry = verifiedEntry || localEntry;
  const playerRank = verifiedEntry
    ? gameStatsGlobalState.playerRanks.snake[size]
    : createGameStatsEmptyPlayerRank();
  const score = entry?.metric ?? 0;
  const rankText = `#${playerRank.rank ?? "—"}`;
  const rank = createGameStatsNode(
    "span",
    "game-stats-leaderboard-template-rank",
    rankText
  );
  rank.setAttribute(
    "aria-label",
    playerRank.rank ? `Global rank ${playerRank.rank}` : "No global rank"
  );
  const iconSource =
    entry?.icon || gameStatsProfile?.icon || GAME_STATS_EMPTY_LEADERBOARD_ICON;
  const identity = createGameStatsLeaderboardPlayer(
    entry?.name || gameStatsProfile?.name || "N/A",
    iconSource,
    {
      currentPlayer: Boolean(gameStatsProfile),
    }
  );
  const metric = createGameStatsNode("span", "game-stats-metric");
  appendGameStatsLeaderboardMetric(metric, score);
  const row = createGameStatsLeaderboardRow({
    className: "game-stats-snake-row game-stats-snake-local-best-row",
    rank,
    identity,
    metric,
    ariaLabel: `Your record: ${rankText}, ${
      entry?.name || gameStatsProfile?.name || "N/A"
    }, ${score} points`,
  });
  panel.append(
    createGameStatsLeaderboardLabeledSection({
      label: "Your Record",
      value: row,
      className: "game-stats-snake-local-best",
    })
  );
};

const appendSnakeTotalGames = (panel, size) => {
  const gamesPlayed = gameStatsGlobalState.totals.snake.gamesPlayed[size];
  const value = createGameStatsGlobalCounterValue(
    gamesPlayed,
    `Global games played on ${size}×${size}: ${gamesPlayed}`,
    "game-stats-leaderboard-template-stat-value"
  );
  panel.append(
    createGameStatsLeaderboardLabeledSection({
      label: "Total Games",
      value,
      className: "game-stats-snake-total-games",
    })
  );
};

const appendMinesweeperStat = (
  container,
  label,
  value,
  { digits = false, globalCounter = false, className = "" } = {}
) => {
  const displayValue = globalCounter
    ? createGameStatsGlobalCounterValue(
        value,
        `${label}: ${value}`,
        "game-stats-minesweeper-stat-value"
      )
    : createGameStatsNode("span", "game-stats-minesweeper-stat-value");
  if (digits && !globalCounter) {
    appendGameStatsDigits(displayValue, value, 3);
  } else if (!globalCounter) {
    displayValue.textContent = String(value);
  }
  container.append(
    createGameStatsLeaderboardLabeledSection({
      label,
      value: displayValue,
      className: ["game-stats-minesweeper-stat", className].filter(Boolean).join(" "),
      labelClassName: "game-stats-minesweeper-subheading",
    })
  );
};

const appendMinesweeperPersonalRecord = (container, difficulty) => {
  const verifiedEntry = getGameStatsVerifiedPlayerRecord(
    gameStatsGlobalState.playerRecords.minesweeper[difficulty]
  );
  const playerRank = verifiedEntry
    ? gameStatsGlobalState.playerRanks.minesweeper[difficulty]
    : createGameStatsEmptyPlayerRank();
  const profile = verifiedEntry || gameStatsProfile || {
    name: "No saved player",
    icon: GAME_STATS_DEFAULT_ICON,
  };
  const personalRecord = gameStatsMinesweeperPersonalRecord(difficulty);
  const rankText = `#${playerRank.rank ?? "—"}`;
  const rank = createGameStatsNode("span", "game-stats-minesweeper-rank", rankText);
  rank.setAttribute("aria-label", playerRank.rank ? `Global rank ${playerRank.rank}` : "No global rank");
  const metric = createGameStatsNode("span", "game-stats-metric");
  appendGameStatsDigits(metric, personalRecord, 3);
  const identity = createMinesweeperLeaderboardPlayer(profile.name, profile.icon, {
    currentPlayer: Boolean(gameStatsProfile),
  });
  const row = createGameStatsLeaderboardRow({
    className: "game-stats-minesweeper-row game-stats-minesweeper-record-row",
    rank,
    identity,
    metric,
    ariaLabel: `Your record: ${rankText}, ${profile.name}, ${personalRecord} seconds`,
  });
  container.append(
    createGameStatsLeaderboardLabeledSection({
      label: "Your Record",
      value: row,
      className: "game-stats-minesweeper-stat game-stats-minesweeper-record",
      labelClassName: "game-stats-minesweeper-subheading",
    })
  );
};

const renderGameStatsMinesweeper = (root) => {
  const columns = createGameStatsNode("div", "game-stats-minesweeper-columns");
  GAME_STATS_DIFFICULTIES.forEach((difficulty) => {
    const label = `${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;
    const leaderboard = createGameStatsLeaderboardTemplate({
      title: label,
      titleId: `game-stats-minesweeper-${difficulty}`,
      className: "game-stats-minesweeper-column",
      headingClassName: "game-stats-minesweeper-heading",
      sectionLabelClassName: "game-stats-minesweeper-subheading",
      listClassName: "game-stats-minesweeper-list",
    });
    appendMinesweeperLeaderboardRows(
      leaderboard.list,
      gameStatsGlobalState.leaderboards.minesweeper[difficulty]
    );
    appendMinesweeperPersonalRecord(leaderboard.panel, difficulty);
    appendMinesweeperStat(
      leaderboard.panel,
      "Global Wins",
      gameStatsGlobalState.totals.minesweeper.wins[difficulty],
      {
        globalCounter: true,
        className: "game-stats-minesweeper-global-wins",
      }
    );
    columns.append(leaderboard.panel);
  });
  root.append(columns);

  const handoff = createGameStatsNode("p", "game-stats-game-progress-handoff");
  const icon = document.createElement("img");
  icon.src = "assets/app-icons/ico/joystick_alt.ico";
  icon.alt = "";
  handoff.append(icon, document.createTextNode("View your personal stats in the Game Progress app"));
  root.append(handoff);
};

const renderGameStatsSolitaire = (root) => {
  const leaderboard = createGameStatsLeaderboardTemplate({
    title: "Most Wins",
    titleId: "game-stats-solitaire-most-wins",
    sectionLabel: "Global Top 3",
    className: "game-stats-solitaire-column",
  });
  appendSolitaireGlobalLeaderboardRows(
    leaderboard.list,
    gameStatsGlobalState.leaderboards.solitaire
  );
  appendSolitairePersonalRecord(leaderboard.panel);
  appendSolitaireGlobalWins(leaderboard.panel);
  root.append(leaderboard.panel);
};

const renderGameStatsSnake = (root) => {
  const columns = createGameStatsNode("div", "game-stats-snake-columns");
  const boardSizesPerColumn = Math.ceil(GAME_STATS_SNAKE_BOARD_SIZES.length / 2);
  for (let columnIndex = 0; columnIndex < 2; columnIndex += 1) {
    const column = createGameStatsNode("div", "game-stats-snake-column");
    const boardSizes = GAME_STATS_SNAKE_BOARD_SIZES.slice(
      columnIndex * boardSizesPerColumn,
      (columnIndex + 1) * boardSizesPerColumn
    );
    boardSizes.forEach((size) => {
      const leaderboard = createGameStatsLeaderboardTemplate({
        title: `${size}×${size} High Scores`,
        titleId: `game-stats-snake-${size}`,
        sectionLabel: "Global Top 3",
        className: "game-stats-snake-leaderboard",
      });
      appendSnakeGlobalLeaderboardRows(
        leaderboard.list,
        gameStatsGlobalState.leaderboards.snake[size]
      );
      appendSnakePersonalRecord(leaderboard.panel, size);
      appendSnakeTotalGames(leaderboard.panel, size);
      column.append(leaderboard.panel);
    });
    columns.append(column);
  }
  root.append(columns);
};

const renderGameStatsSudoku = (root) => {
  const columns = createGameStatsNode("div", "game-stats-sudoku-columns");
  const difficultiesPerColumn = Math.ceil(GAME_STATS_SUDOKU_DIFFICULTIES.length / 3);
  for (let columnIndex = 0; columnIndex < 3; columnIndex += 1) {
    const column = createGameStatsNode("div", "game-stats-sudoku-column");
    const difficulties = GAME_STATS_SUDOKU_DIFFICULTIES.slice(
      columnIndex * difficultiesPerColumn,
      (columnIndex + 1) * difficultiesPerColumn
    );
    difficulties.forEach((difficulty) => {
      const label = formatGameStatsSudokuDifficulty(difficulty);
      const leaderboard = createGameStatsLeaderboardTemplate({
        title: label,
        titleId: `game-stats-sudoku-${difficulty}`,
        sectionLabel: "No-Hints Top 3",
        className: "game-stats-sudoku-leaderboard",
        metricPresentation: "text",
        metricFormatter: formatGameStatsSudokuLeaderboardTime,
      });
      appendSudokuGlobalLeaderboardRows(
        leaderboard.list,
        gameStatsGlobalState.leaderboards.sudoku[difficulty],
        leaderboard.appendMetric
      );
      appendSudokuPersonalRecord(
        leaderboard.panel,
        difficulty,
        leaderboard.appendMetric
      );
      appendSudokuTotalGames(leaderboard.panel, difficulty);
      column.append(leaderboard.panel);
    });
    columns.append(column);
  }
  root.append(columns);
};

const getGameProgressContent = (id) => document.getElementById(id);

const appendGameProgressStat = (
  container,
  label,
  value,
  { ariaLabel = "" } = {}
) => {
  const item = createGameStatsNode("div", "game-stats-inlay");
  if (ariaLabel) item.setAttribute("aria-label", ariaLabel);
  item.append(
    createGameStatsNode("span", "game-stats-label", label),
    createGameStatsNode("span", "game-stats-value", String(value))
  );
  container.append(item);
};

const formatGameProgressRecord = (entry, unit) =>
  entry && Number.isFinite(entry.metric) ? `${entry.metric} ${unit}` : "No record yet";

const formatGameProgressSudokuBestTime = (seconds) =>
  formatElapsedTime(seconds, "—");

const getGameProgressPlayerTotals = () =>
  gameStatsGlobalPlayerTotalsAvailable
    ? gameStatsGlobalState.playerTotals
    : gameStatsLocalState.totals;

const renderGameProgressProfile = () => {
  const content = getGameProgressContent("game-progress-profile-content");
  const createButton = document.getElementById("game-progress-create-profile");
  if (!content) return;

  disconnectGameStatsDigitResizeObservers(content);
  content.replaceChildren();
  if (!gameStatsProfile) {
    content.append(
      createGameStatsNode(
        "p",
        "game-progress-empty",
        "No profile is saved on this browser. Create one now, or choose it after your next qualifying win."
      )
    );
    if (createButton) {
      createButton.hidden = false;
      createButton.disabled = Boolean(gameStatsProfilePromptResolve);
      createButton.textContent = "Create Profile";
      createButton.setAttribute("aria-label", "Create Profile");
    }
    return;
  }

  const profile = createGameStatsNode("div", "game-stats-row game-progress-profile-row");
  const icon = createGameStatsPlayerIcon(gameStatsProfile.icon);
  profile.append(
    icon,
    createGameStatsNode("span", "game-progress-profile-name", gameStatsProfile.name),
    createGameStatsNode("span", "game-progress-profile-saved", "Saved")
  );
  content.append(profile);
  if (createButton) {
    createButton.hidden = false;
    createButton.disabled = Boolean(gameStatsDraftProfile);
    createButton.textContent = "Change Icon";
    createButton.setAttribute("aria-label", "Change Icon");
  }
};

const renderGameProgressMinesweeper = () => {
  const content = getGameProgressContent("game-progress-minesweeper-content");
  if (!content) return;
  const summary = createGameStatsNode("div", "game-stats-summary-grid");
  const playerTotals = getGameProgressPlayerTotals();
  GAME_STATS_DIFFICULTIES.forEach((difficulty) => {
    const label = `${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;
    appendGameProgressStat(
      summary,
      `${label} wins`,
      playerTotals.minesweeper.wins[difficulty]
    );
    appendGameProgressStat(
      summary,
      `${label} best clear`,
      formatGameProgressRecord(
        gameStatsLocalState.leaderboards.minesweeper[difficulty][0],
        "seconds"
      )
    );
  });
  content.replaceChildren(summary);
};

const renderGameProgressSolitaire = () => {
  const content = getGameProgressContent("game-progress-solitaire-content");
  if (!content) return;
  const summary = createGameStatsNode("div", "game-stats-summary-grid");
  const playerTotals = getGameProgressPlayerTotals();
  appendGameProgressStat(summary, "Wins", playerTotals.solitaire.wins);
  appendGameProgressStat(
    summary,
    "Fewest moves",
    formatGameProgressRecord(gameStatsLocalState.leaderboards.solitaire[0], "moves")
  );
  content.replaceChildren(summary);
};

const renderGameProgressSnake = () => {
  const content = getGameProgressContent("game-progress-snake-content");
  if (!content) return;
  content.classList.add("game-progress-snake-content");
  const playerTotals = getGameProgressPlayerTotals();
  const totalGames = createGameStatsNode("div", "game-progress-snake-total");
  appendGameProgressStat(
    totalGames,
    "Games played",
    playerTotals.snake.totalGamesPlayed
  );

  const boardStats = createGameStatsNode(
    "div",
    "game-stats-summary-grid game-progress-snake-board-stats"
  );
  GAME_STATS_SNAKE_BOARD_SIZES.forEach((size) => {
    appendGameProgressStat(
      boardStats,
      `${size}×${size} games`,
      playerTotals.snake.gamesPlayed[size]
    );
    appendGameProgressStat(
      boardStats,
      `${size}×${size} high score`,
      gameStatsPositiveInteger(readGameStatsLocalRecord("snake", size))
    );
  });
  content.replaceChildren(totalGames, boardStats);
};

const renderGameProgressSudoku = () => {
  const content = getGameProgressContent("game-progress-sudoku-content");
  if (!content) return;
  const summary = createGameStatsNode("div", "game-progress-sudoku-stats");
  const playerTotals = getGameProgressPlayerTotals();
  GAME_STATS_SUDOKU_DIFFICULTIES.forEach((difficulty) => {
    const label = `${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;
    const wins = playerTotals.sudoku.wins[difficulty];
    const bestTime = gameStatsLocalState.totals.sudoku.bestTimes[difficulty];
    const bestTimeValue = formatGameProgressSudokuBestTime(bestTime);
    appendGameProgressStat(summary, `${label} (no hints)`, `${wins.noHints} Wins`);
    appendGameProgressStat(summary, `${label} (hints)`, `${wins.withHints} Wins`);
    appendGameProgressStat(
      summary,
      "Best Time (no hints)",
      bestTimeValue,
      {
        ariaLabel: `${label} best time without hints: ${
          bestTime === null ? "No record yet" : bestTimeValue
        }`,
      }
    );
  });
  content.replaceChildren(summary);
};

const renderGameProgressWindow = () => {
  renderGameProgressProfile();
  renderGameProgressMinesweeper();
  renderGameProgressSolitaire();
  renderGameProgressSnake();
  renderGameProgressSudoku();
};

const resetGameProgressLocalData = () => {
  gameStatsLocalResetGeneration += 1;
  gameStatsExpiredResultNoticePending = false;
  gameStatsLocalResultNotice = null;
  if (gameStatsDraftProfile) resolveGameStatsProfilePrompt(null);

  gameStatsLocalState = createEmptyGameStatsData();
  saveGameStatsLocalState();
  clearGameStatsProfile();

  gameStatsLocalSources.forEach((source) => source.resetLocalData?.());

  // Keep the sync queue and global state intact: reset is local-only and must
  // never retract verified or already queued leaderboard results.
  if (gameStatsSyncPromise || gameStatsSyncState === "auth-waiting") {
    renderGameStatsWindows();
  } else {
    setGameStatsSyncState("ready", {
      message:
        "Local progress was reset. Published and queued leaderboard results remain available.",
    });
  }
};

const renderGameStatsSyncStatus = (status, message, animated, state) => {
  if (!status) return;
  status.setAttribute("aria-busy", String(animated));
  status.dataset.gameStatsSyncState = state;
  if (!animated || !message.endsWith("...")) {
    status.removeAttribute("aria-label");
    status.textContent = message;
    return;
  }

  const ellipsis = createGameStatsNode("span", "game-stats-sync-ellipsis");
  ellipsis.setAttribute("aria-hidden", "true");
  Array.from({ length: 3 }, () => {
    ellipsis.append(createGameStatsNode("span", "", "."));
  });
  status.setAttribute("aria-label", message);
  status.replaceChildren(
    document.createTextNode(message.slice(0, -3)),
    ellipsis
  );
};

const getGameStatsWindowParts = (game) => {
  const windowElement = Array.from(gameStatsWindows).find(
    (candidate) => candidate.getAttribute("data-game-stats-window") === game
  );
  if (!windowElement) return null;
  return {
    windowElement,
    title: windowElement.querySelector("[data-game-stats-title]"),
    content: windowElement.querySelector("[data-game-stats-content]"),
    syncStatus: windowElement.querySelector("[data-game-stats-sync-status]"),
    refreshButton: windowElement.querySelector("[data-game-stats-refresh]"),
  };
};

const renderGameStatsWindow = (game) => {
  const windowParts = getGameStatsWindowParts(game);
  if (!windowParts?.content) return;
  const { title, content, syncStatus, refreshButton } = windowParts;
  if (!gameStatsSyncAnnouncementGame) gameStatsSyncAnnouncementGame = game;
  syncStatus?.setAttribute(
    "aria-live",
    game === gameStatsSyncAnnouncementGame ? "polite" : "off"
  );
  const backendConfigured = isGameStatsBackendConfigured();
  const syncStateKey = backendConfigured ? gameStatsSyncState : "unconfigured";
  const syncState = backendConfigured
    ? getGameStatsSyncStateDefinition()
    : GAME_STATS_SYNC_STATES.unconfigured;
  const syncMessage =
    (backendConfigured && gameStatsSyncMessage) || syncState.message;
  renderGameStatsSyncStatus(syncStatus, syncMessage, syncState.busy, syncStateKey);

  if (refreshButton) {
    const gameLabel = `${game[0].toUpperCase()}${game.slice(1)}`;
    const actionLabel =
      syncState.action === "authenticate"
        ? `Sign in as Administrator to sync ${gameLabel} stats`
        : syncState.action === "reload"
          ? `Reload page to update ${gameLabel} stats`
        : syncState.action === "refresh"
          ? `Refresh ${gameLabel} stats`
          : `Game stats refresh unavailable for ${gameLabel}`;
    refreshButton.disabled = syncState.disabled;
    refreshButton.dataset.gameStatsAction = syncState.action;
    refreshButton.dataset.gameStatsSyncState = syncStateKey;
    refreshButton.setAttribute("aria-busy", String(syncState.busy));
    refreshButton.setAttribute("aria-label", actionLabel);
    refreshButton.title = actionLabel;
  }
  if (title) {
    title.textContent = `${game[0].toUpperCase()}${game.slice(1)} Stats`;
  }

  content.replaceChildren();
  if (game === "minesweeper") {
    renderGameStatsMinesweeper(content);
  } else if (game === "solitaire") {
    renderGameStatsSolitaire(content);
  } else if (game === "snake") {
    renderGameStatsSnake(content);
  } else if (game === "sudoku") {
    renderGameStatsSudoku(content);
  }
  scheduleGameStatsPlayerNameMarquees();
};

const renderGameStatsWindows = () => {
  const visibleGames = GAME_STATS_SUPPORTED_GAMES.filter((game) => {
    const windowElement = getGameStatsWindowParts(game)?.windowElement;
    return Boolean(
      windowElement &&
        !windowElement.classList.contains("is-hidden") &&
        !windowElement.classList.contains("is-closing")
    );
  });
  if (!visibleGames.includes(gameStatsSyncAnnouncementGame)) {
    gameStatsSyncAnnouncementGame = visibleGames[0] || "";
  }
  GAME_STATS_SUPPORTED_GAMES.forEach((game) => {
    getGameStatsWindowParts(game)?.syncStatus?.setAttribute(
      "aria-live",
      game === gameStatsSyncAnnouncementGame ? "polite" : "off"
    );
  });
  visibleGames.forEach(renderGameStatsWindow);
  renderGameProgressWindow();
};

const scheduleGameStatsWindowViewportClamp = (windowElement) => {
  if (
    !windowElement ||
    windowElement.dataset.gameStatsViewportClampScheduled === "true"
  ) {
    return;
  }

  windowElement.dataset.gameStatsViewportClampScheduled = "true";
  let onAnimationEnd = null;
  const clampAfterOpening = () => {
    if (windowElement.dataset.gameStatsViewportClampScheduled !== "true") return;
    delete windowElement.dataset.gameStatsViewportClampScheduled;
    if (onAnimationEnd) {
      windowElement.removeEventListener("animationend", onAnimationEnd);
    }
    if (
      windowElement.classList.contains("is-hidden") ||
      windowElement.classList.contains("is-closing")
    ) {
      return;
    }
    clampWindowFullyIntoViewport(windowElement);
  };

  if (windowElement.classList.contains("is-opening")) {
    onAnimationEnd = (event) => {
      if (event.target !== windowElement || event.animationName !== "retro-window-open") {
        return;
      }
      window.requestAnimationFrame(clampAfterOpening);
    };
    windowElement.addEventListener("animationend", onAnimationEnd);
    window.setTimeout(() => {
      if (!windowElement.classList.contains("is-opening")) {
        clampAfterOpening();
      }
    }, 320);
    return;
  }

  window.requestAnimationFrame(clampAfterOpening);
};

const positionNewGameStatsWindow = (game, windowElement) => {
  const gameIndex = GAME_STATS_SUPPORTED_GAMES.indexOf(game);
  if (gameIndex < 0 || !windowElement) return;

  const padding = 24;
  const taskbarHeight = 90;
  const gap = 16;
  const windowWidth = windowElement.offsetWidth;
  const windowHeight = windowElement.offsetHeight;
  const maxLeft = Math.max(padding, window.innerWidth - windowWidth - padding);
  const maxTop = Math.max(padding, window.innerHeight - windowHeight - taskbarHeight);
  const canUseTwoColumns = window.innerWidth >= windowWidth * 2 + padding * 2 + gap;
  const column = gameIndex % 2;
  const row = Math.floor(gameIndex / 2);
  const left = canUseTwoColumns
    ? column === 0
      ? padding
      : maxLeft
    : Math.min(maxLeft, padding + gameIndex * 28);
  const top = canUseTwoColumns
    ? Math.min(maxTop, padding + row * (windowHeight + gap))
    : Math.min(maxTop, padding + gameIndex * 28);

  windowElement.style.left = `${Math.round(left)}px`;
  windowElement.style.top = `${Math.round(top)}px`;
  scheduleGameStatsWindowViewportClamp(windowElement);
};

const positionVisibleGameStatsWindows = () => {
  const visibleWindows = GAME_STATS_SUPPORTED_GAMES.map(getGameStatsWindowParts)
    .filter(
      (windowParts) =>
        windowParts &&
        !windowParts.windowElement.classList.contains("is-hidden") &&
        !windowParts.windowElement.classList.contains("is-closing")
    );
  if (visibleWindows.length < 2) {
    visibleWindows.forEach(({ windowElement }) => clampWindowFullyIntoViewport(windowElement));
    return;
  }

  const padding = 24;
  const gap = 16;
  const largestWindowWidth = Math.max(
    ...visibleWindows.map(({ windowElement }) => windowElement.offsetWidth)
  );
  const canUseTwoColumns =
    window.innerWidth >= largestWindowWidth * 2 + padding * 2 + gap;

  visibleWindows.forEach(({ windowElement }, index) => {
    const titleBarHeight = windowElement.querySelector(".title-bar")?.offsetHeight || 24;
    const column = canUseTwoColumns ? index % 2 : 0;
    const row = canUseTwoColumns ? Math.floor(index / 2) : index;
    const left =
      column === 0
        ? padding
        : Math.max(padding, window.innerWidth - windowElement.offsetWidth - padding);
    const top = canUseTwoColumns
      ? padding + row * (windowElement.offsetHeight + gap)
      : padding + row * (titleBarHeight + 4);
    setWindowTitleBarClampedPosition(windowElement, left, top);
  });
};

const openGameStatsWindow = (game) => {
  if (!GAME_STATS_SUPPORTED_GAMES.includes(game)) return;
  gameStatsSyncAnnouncementGame = game;
  const windowParts = getGameStatsWindowParts(game);
  const wasVisible = Boolean(
    windowParts &&
      !windowParts.windowElement.classList.contains("is-hidden") &&
      !windowParts.windowElement.classList.contains("is-closing")
  );
  setWindowOpen(`game-stats-${game}`, true);
  renderGameStatsWindow(game);
  if (!wasVisible) positionNewGameStatsWindow(game, windowParts?.windowElement);
  scheduleGameStatsWindowViewportClamp(windowParts?.windowElement);
  void syncQueuedGameStats();
};

let gameStatsGlobalState = createEmptyGameStatsData();

let gameStatsGlobalPlayerTotalsAvailable = false;

let gameStatsLocalState = loadGameStatsLocalState();

let gameStatsSubmissionQueue = loadGameStatsSubmissionQueue();

const gameStatsConfirmedEvents = new Map();

let gameStatsProfile = loadGameStatsProfile();

// The animated profile avatar lives with the cat that draws it.
let gameStatsAvatarAnimator = {};

const registerGameStatsAvatarAnimator = (animator) => {
  gameStatsAvatarAnimator = animator || {};
};

const gameStatsLocalSources = new Map();

/**
 * A game registers how to wipe its own local records, how to read a local
 * best, and whether a completion dialog of its own is holding the screen.
 */
const registerGameStatsLocalSource = (game, source) => {
  gameStatsLocalSources.set(game, { ...gameStatsLocalSources.get(game), ...source });
};

const readGameStatsLocalRecord = (game, key) =>
  gameStatsLocalSources.get(game)?.readLocalRecord?.(key);

const isGameStatsCompletionDialogOpen = () =>
  [...gameStatsLocalSources.values()].some((source) =>
    Boolean(source.isCompletionDialogOpen?.())
  );

const hasActiveGameStatsAdministratorAccess = () =>
  hasActiveGameStatsAdministratorProof();

// The window manager decides where the Admin Controls launcher goes; only this
// script can say whether an administrator session is live.
registerAdminControlsAccess(hasActiveGameStatsAdministratorAccess);

let gameStatsProfilePromptResolve = null;

let gameStatsDraftProfile = null;

let gameStatsSyncInProgress = false;

let gameStatsSyncRequested = false;

let gameStatsSyncPromise = null;

let gameStatsManualRefreshInProgress = false;

let gameStatsSyncState = "initial";
let gameStatsExpiredResultNoticePending = false;
let gameStatsLocalResultNotice = null;

let gameStatsSyncMessage = "";

let gameStatsReleaseWaitCount = 0;

let gameStatsAuthenticationReturnFocus = null;

let gameStatsAuthenticationDeferredForCompletion = false;

let gameStatsSyncAnnouncementGame = "";

let administratorSignInAttemptId = 0;

let administratorSignInAbortController = null;

let gameStatsLocalResetGeneration = 0;

let gameStatsRecordHandoffQueue = Promise.resolve();

const closeAdministratorSignIn = () => {
  closeAppWindow("administrator");
};

const ADMINISTRATOR_ALERT_Z_INDEX = 1_000_000;

const openAdministratorAccessAlert = () => {
  setWindowOpen("administrator-alert", true);
  if (administratorAlertWindow) {
    administratorAlertWindow.style.zIndex = String(ADMINISTRATOR_ALERT_Z_INDEX);
  }
};

const completeAdministratorSignIn = (administratorProof) => {
  const resumeManualRefresh = gameStatsSyncState === "auth-waiting";
  const alreadyUsesAdministratorProfile = isGameStatsAdministratorProfile(gameStatsProfile);
  if (!alreadyUsesAdministratorProfile) resetGameProgressLocalData();
  const profile = alreadyUsesAdministratorProfile
    ? gameStatsProfile
    : saveGameStatsProfile(GAME_STATS_ROHIN_NEKO_PROFILE);
  if (!profile) return false;

  if (!gameStatsAdministratorSession.adopt(administratorProof)) return false;
  renderGameStatsWindows();
  gameStatsAvatarAnimator.start?.();
  gameStatsAuthenticationReturnFocus = null;
  if (resumeManualRefresh) setGameStatsSyncState("ready");
  void syncQueuedGameStats({ manual: resumeManualRefresh });
  return true;
};

if (administratorSignInForm) {
  administratorSignInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (administratorSignIn?.disabled) return;

    const username = String(administratorUsername?.value || "");
    const password = String(administratorPassword?.value || "");
    if (!username || !password) {
      closeAdministratorSignIn();
      return;
    }

    if (administratorSignIn) administratorSignIn.disabled = true;
    const signInAttemptId = (administratorSignInAttemptId += 1);
    const signInController =
      typeof AbortController === "function" ? new AbortController() : null;
    administratorSignInAbortController = signInController;
    let administratorProof = null;
    let authenticationRequestFailed = false;
    try {
      const response = await fetchGameStatsApi("/administrator/sign-in", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        signal: signInController?.signal,
      });
      administratorProof = normalizeAdministratorSignInResponse(
        await readGameStatsApiJson(response)
      );
    } catch (error) {
      const status = Number(error?.status);
      authenticationRequestFailed =
        !Number.isFinite(status) ||
        status >= 500 ||
        [408, 425, 429].includes(status);
      // Credential failures stay generic; transient request failures use the shared retry state.
    } finally {
      if (signInAttemptId === administratorSignInAttemptId) {
        administratorSignInAbortController = null;
        if (administratorSignIn) administratorSignIn.disabled = false;
      }
    }

    if (signInAttemptId !== administratorSignInAttemptId) return;
    if (!administratorProof || !completeAdministratorSignIn(administratorProof)) {
      if (authenticationRequestFailed && gameStatsSyncState === "auth-waiting") {
        failGameStatsAuthenticationWait();
        if (administratorPassword) administratorPassword.value = "";
        setWindowOpen("administrator", false);
        setAdministratorAuthenticationLayerElevated(false);
        return;
      }
      closeAdministratorSignIn();
      return;
    }
    if (administratorPassword) administratorPassword.value = "";
    setWindowOpen("administrator", false);
    openAdministratorAccessAlert();
  });
}

administratorAlertWindow?.addEventListener("animationend", (event) => {
  if (event.target !== administratorAlertWindow || event.animationName !== "retro-window-open") return;
  administratorAlertWindow.classList.remove("is-opening");
  administratorAlertClose?.focus();
});

gameStatsOpenButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openGameStatsWindow(button.getAttribute("data-game-stats-open"));
  });
});

gameStatsRefreshButtons.forEach((button) => {
  button.addEventListener("click", () => {
    gameStatsSyncAnnouncementGame =
      button.getAttribute("data-game-stats-refresh") || gameStatsSyncAnnouncementGame;
    const syncState = getGameStatsSyncStateDefinition();
    if (button.disabled || syncState.disabled || syncState.busy) return;
    if (syncState.action === "authenticate") {
      requestGameStatsAdministratorAuthentication(button);
      return;
    }
    if (syncState.action === "reload") {
      window.location.reload();
      return;
    }
    if (syncState.action === "refresh") {
      void syncQueuedGameStats({ manual: true });
    }
  });
});

if (gameProfileReroll) {
  gameProfileReroll.addEventListener("click", async () => {
    if (
      !gameStatsDraftProfile ||
      gameStatsNameRollInFlight ||
      gameStatsDraftProfile.rerollCount >= GAME_STATS_MAX_NAME_REROLLS
    ) {
      return;
    }
    gameStatsPreserveNameSuggestionsAfterReroll = true;
    const rolled = await rollGameStatsDraftName({ isReroll: true });
    if (rolled && gameStatsDraftProfile) gameStatsDraftProfile.rerollCount += 1;
    updateGameProfileRerollState();
    window.setTimeout(() => {
      gameStatsPreserveNameSuggestionsAfterReroll = false;
    }, 0);
  });
}

const toggleGameProfileNameSuggestions = () => {
  if (gameStatsNameRollInFlight || !gameStatsDraftNameSuggestions.length) return;
  setGameProfileNameSuggestionsVisible(!gameStatsNameSuggestionsOpen);
  if (gameStatsNameSuggestionsOpen) {
    const selectedIndex = gameStatsDraftNameSuggestions.indexOf(gameStatsDraftProfile?.name);
    setGameProfileNameSuggestionActive(selectedIndex);
  }
};

if (gameProfileName) {
  gameProfileName.addEventListener("click", toggleGameProfileNameSuggestions);
  gameProfileName.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && gameStatsNameSuggestionsOpen) {
      event.preventDefault();
      event.stopPropagation();
      setGameProfileNameSuggestionsVisible(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (!gameStatsNameSuggestionsOpen) {
      toggleGameProfileNameSuggestions();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      const name = gameStatsDraftNameSuggestions[gameStatsNameSuggestionActiveIndex];
      if (name) selectGameStatsDraftName(name);
      return;
    }
    const movement = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = clampNumber(
      gameStatsNameSuggestionActiveIndex + movement,
      0,
      gameStatsDraftNameSuggestions.length - 1
    );
    setGameProfileNameSuggestionActive(nextIndex);
  });
}

if (gameProfileNameToggle) {
  gameProfileNameToggle.addEventListener("click", toggleGameProfileNameSuggestions);
}

if (gameProfileNameOptions) {
  gameProfileNameOptions.addEventListener("keydown", (event) => {
    if (!event.target.matches("[role='option']")) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const options = [...gameProfileNameOptions.querySelectorAll("[role='option']")];
    const currentIndex = options.indexOf(event.target);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : clampNumber(
              currentIndex + (event.key === "ArrowDown" ? 1 : -1),
              0,
              options.length - 1
            );
    setGameProfileNameSuggestionActive(nextIndex, { focus: true });
  });
}

if (gameProfileNamePicker) {
  gameProfileNamePicker.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (
        !gameProfileNamePicker.contains(document.activeElement) &&
        document.activeElement !== gameProfileReroll &&
        !gameStatsPreserveNameSuggestionsAfterReroll
      ) {
        setGameProfileNameSuggestionsVisible(false);
      }
    }, 0);
  });
}

document.addEventListener("pointerdown", (event) => {
  if (
    gameStatsNameSuggestionsOpen &&
    gameProfileNamePicker &&
    !gameProfileNamePicker.contains(event.target)
  ) {
    setGameProfileNameSuggestionsVisible(false);
  }
});

if (gameProfileIconSearch) {
  gameProfileIconSearch.addEventListener("input", renderGameProfileIconGallery);
}

if (gameProfileSave) {
  gameProfileSave.addEventListener("click", () => {
    if (!gameStatsDraftProfile) return;
    if (isGameStatsProfileIconEditor()) {
      const savedProfile = saveGameStatsProfileIcon(gameStatsDraftProfile.icon);
      if (!savedProfile) {
        gameProfileIconSearch?.focus();
        return;
      }
      resolveGameStatsProfilePrompt(savedProfile);
      return;
    }
    const profile = normalizeGameStatsProfile({
      ...gameStatsDraftProfile,
    });
    if (!profile) {
      gameProfileReroll?.focus();
      return;
    }
    const savedProfile = saveGameStatsProfile(profile);
    if (!savedProfile) return;
    resolveGameStatsProfilePrompt(savedProfile);
  });
}

if (gameProfileCancel) {
  gameProfileCancel.addEventListener("click", () => {
    skipGameStatsProfilePrompt();
  });
}

if (gameProfileClose) {
  gameProfileClose.addEventListener("click", () => {
    skipGameStatsProfilePrompt();
  });
}

document.addEventListener("keydown", (event) => {
  if (!gameStatsDraftProfile || event.key !== "Escape") return;
  if (gameStatsNameSuggestionsOpen) {
    event.preventDefault();
    setGameProfileNameSuggestionsVisible(false);
    gameProfileName?.focus();
    return;
  }
  event.preventDefault();
  skipGameStatsProfilePrompt();
});

if (gameProfileDialog) {
  gameProfileDialog.addEventListener("animationend", (event) => {
    if (event.animationName === "retro-window-open") {
      gameProfileDialog.classList.remove("is-opening");
    }
  });
}

const gameProgressCreateProfile = document.getElementById("game-progress-create-profile");

if (gameProgressCreateProfile) {
  gameProgressCreateProfile.addEventListener("click", () => {
    if (gameStatsProfilePromptResolve || gameStatsDraftProfile) return;
    if (gameStatsProfile) {
      openGameProgressProfileIconPicker();
      return;
    }
    void createGameProgressProfile();
  });
}

const gameProgressResetLocal = document.getElementById("game-progress-reset-local");

if (gameProgressResetLocal) {
  gameProgressResetLocal.addEventListener("click", () => {
    resetGameProgressLocalData();
  });
}

renderGameStatsWindows();

void syncQueuedGameStats();

window.addEventListener("online", () => {
  void syncQueuedGameStats();
});


registerViewportObserver({
  onFrame: () => {
    scheduleGameStatsPlayerNameMarquees();
    positionVisibleGameStatsWindows();
    clampVisibleAdministratorWindow();
  },
});

registerWindowLifecycle("game-progress", {
  onAlreadyOpen: (win) => {
    scheduleGameStatsWindowViewportClamp(win);
    void syncQueuedGameStats();
  },
  onOpen: () => {
    renderGameProgressWindow();
    void syncQueuedGameStats();
  },
  onOpened: (win) => scheduleGameStatsWindowViewportClamp(win),
  onTabChange: (win) => scheduleGameStatsWindowViewportClamp(win),
});

// Closing the sign-in window abandons the attempt in flight, so a reopened
// window never adopts the previous request's answer.
registerWindowLifecycle("administrator", {
  beforeDismiss: () => {
    administratorSignInAttemptId += 1;
    administratorSignInAbortController?.abort();
    administratorSignInAbortController = null;
    if (administratorSignIn) administratorSignIn.disabled = false;
    if (administratorPassword) administratorPassword.value = "";
    cancelGameStatsAuthenticationWait();
  },
  afterDismiss: () => setAdministratorAuthenticationLayerElevated(false),
});

registerWindowLifecycle("administrator-alert", {
  afterDismiss: () => setAdministratorAuthenticationLayerElevated(false),
});

administratorWindow?.addEventListener("animationend", (event) => {
  if (event.target !== administratorWindow || event.animationName !== "retro-window-open") return;
  administratorWindow.classList.remove("is-opening");
  administratorUsername?.focus();
});

const getGameStatsProfile = () => gameStatsProfile;

const isGameStatsManualRefreshInProgress = () => gameStatsManualRefreshInProgress;

const resumeGameStatsAuthenticationAfterCompletion = () => {
  if (!gameStatsAuthenticationDeferredForCompletion) return;
  gameStatsAuthenticationDeferredForCompletion = false;
  requestGameStatsAdministratorAuthentication();
};

const requestIssuedGameStatsApi = async (path, payload, requestOptions = {}) => {
  if (!isGameStatsBackendConfigured()) {
    throw Object.assign(new Error("Game tracking is not configured"), { code: "unconfigured" });
  }
  let waiting = false;
  try {
    for (let attempt = 0; ; attempt += 1) {
      if (requestOptions.signal?.aborted) throw new DOMException("Game issuance canceled", "AbortError");
      try {
        const response = await fetchGameStatsApi(path, {
          method: "POST", body: JSON.stringify(payload), ...requestOptions,
        });
        return await readGameStatsApiJson(response);
      } catch (error) {
        if (path !== "/sessions" || Number(error?.status) !== 409 ||
            attempt >= GAME_STATS_SESSION_BUILD_RETRY_ATTEMPTS || requestOptions.signal?.aborted) {
          throw error;
        }
        if (!waiting) {
          waiting = true;
          gameStatsReleaseWaitCount += 1;
        }
        setGameStatsSyncState("release-waiting");
        await new Promise((resolve) => {
          const signal = requestOptions.signal;
          const finish = () => {
            window.clearTimeout(timer);
            signal?.removeEventListener("abort", finish);
            resolve();
          };
          const timer = window.setTimeout(finish, GAME_STATS_SESSION_BUILD_RETRY_INTERVAL_MS);
          signal?.addEventListener("abort", finish, { once: true });
          if (signal?.aborted) finish();
        });
      }
    }
  } finally {
    if (waiting) {
      gameStatsReleaseWaitCount = Math.max(0, gameStatsReleaseWaitCount - 1);
      if (gameStatsReleaseWaitCount === 0 && gameStatsSyncState === "release-waiting") {
        setGameStatsSyncState("ready");
      }
    }
  }
};

const createGameStatsHooks = (game, stateOrGetter) => {
  if (!GAME_STATS_SUPPORTED_GAMES.includes(game)) {
    throw new TypeError("Unsupported game stats hook");
  }
  if (
    typeof stateOrGetter !== "function" &&
    (!stateOrGetter ||
      typeof stateOrGetter !== "object" ||
      typeof stateOrGetter.statsSession !== "string")
  ) {
    throw new TypeError("Game stats hooks require a mutable statsSession string");
  }
  const getState = () => {
    const state =
      typeof stateOrGetter === "function" ? stateOrGetter() : stateOrGetter;
    if (!state || typeof state !== "object" || typeof state.statsSession !== "string") {
      throw new TypeError("Game stats hooks require a mutable statsSession string");
    }
    return state;
  };
  let issuedSession = null;
  const issued = () => {
    if (!issuedSession) {
      issuedSession = createGameSession({
        game,
        getState,
        buildVersion: gameStatsBackend.buildVersion,
        request: requestIssuedGameStatsApi,
        reportFailure: (error) => {
          if (error?.code === "session-expired") setGameStatsSyncState("session-expired");
          else reportGameStatsSessionFailure({ reason: error?.code || "request-failed", status: Number(error?.status) || 0 });
        },
      });
    }
    return issuedSession;
  };
  return Object.freeze({
    issueGame: (config, options) => issued().issueGame(normalizeGameStatsSessionConfig(game, config), options),
    recordInput: (action) => issuedSession?.recordInput(action) || false,
    pauseGame: () => issuedSession?.pauseGame() || Promise.resolve(null),
    resumeGame: () => issuedSession?.resumeGame() || Promise.resolve(null),
    exportGame: () => issuedSession?.exportGame() || null,
    restoreGame: (saved) => issued().restoreGame(saved),
    hasIssuedGame: () => issuedSession?.hasIssuedGame() || false,
    ensureSession(config) {
      const state = getState();
      if (!state.statsSession) {
        state.statsSession = startGameStatsSession(game, config);
      }
      return state.statsSession;
    },
    dropSession() {
      issuedSession?.dropSession();
      const state = getState();
      state.statsSession = "";
    },
    recordEvent(payload, options = {}) {
      const state = getState();
      const claim = issuedSession?.claimCompletion() || null;
      const sessionKey = state.statsSession;
      state.statsSession = "";
      const event = createGameStatsEvent({ ...payload, game });
      return recordGameStatsEvent(
        event,
        sessionKey,
        claim
          ? { ...options, completionPromise: claim.finish(event.id, { terminalTick: options.terminalTick }) }
          : options
      );
    },
  });
};

window.homeGameStats = Object.freeze({
  getGameStatsProfile,
  isGameStatsManualRefreshInProgress,
  resumeGameStatsAuthenticationAfterCompletion,
  registerGameStatsLocalSource,
  registerGameStatsAvatarAnimator,
  GAME_STATS_DIFFICULTIES,
  GAME_STATS_ROHIN_NEKO_AVATAR_ICON,
  GAME_STATS_ROHIN_NEKO_PROFILE,
  administratorPassword,
  administratorSignIn,
  cancelGameStatsAuthenticationWait,
  clampVisibleAdministratorWindow,
  createGameStatsEvent,
  createGameStatsHooks,
  isGameStatsSyncBusy,
  positionVisibleGameStatsWindows,
  recordGameStatsEvent,
  renderGameProgressWindow,
  requestGameStatsAdministratorAuthentication,
  scheduleGameStatsPlayerNameMarquees,
  scheduleGameStatsWindowViewportClamp,
  setAdministratorAuthenticationLayerElevated,
  startGameStatsSession,
  syncQueuedGameStats,
});
})();
