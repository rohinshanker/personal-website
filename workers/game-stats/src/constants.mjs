export const GAME_STATS_DIFFICULTIES = Object.freeze([
  "beginner",
  "intermediate",
  "expert",
]);
export const GAME_STATS_SUDOKU_DIFFICULTIES = Object.freeze([
  "easy",
  "medium",
  "hard",
  "expert",
  "master",
  "extreme",
]);
export const GAME_STATS_SNAKE_BOARD_SIZES = Object.freeze(["10", "16", "20", "24"]);
export const GAME_STATS_HINT_BUCKETS = Object.freeze(["noHints", "withHints"]);
export const GAME_BUILD_VERSION_PATTERN = /^sha256-[a-f0-9]{64}$/;
export const MAX_GAME_BUILD_COMPATIBILITY_VERSIONS = 32;
export const MAX_EVENT_BODY_BYTES = 4096;
export const MAX_REPLAY_BODY_BYTES = 256 * 1024;
export const MAX_PENDING_EVENT_ACKNOWLEDGMENTS = 32;
export const STATS_API_PROTOCOL = "2";
export const STATS_CACHE_TTL_SECONDS = 5;

export const MAX_SOLITAIRE_MOVES = 99999;
export const MAX_MINESWEEPER_SECONDS = 999;
export const MAX_SUDOKU_SECONDS = 6 * 60 * 60;
export const MAX_EVENT_AGE_MS = 24 * 60 * 60 * 1000;
export const MAX_EVENT_FUTURE_MS = 60 * 1000;
export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
export const SESSION_EVENT_START_GRACE_MS = 2 * 60 * 1000;
export const MIN_SNAKE_SESSION_DURATION_MS = 5 * 1000;
export const MAX_INLINE_SNAKE_ELIGIBILITY_WAIT_MS = 5 * 1000;
export const MAX_RETRY_AFTER_MS = 60 * 1000;
export const SNAKE_RESUME_COUNTDOWN_MS = 900;
export const SNAKE_TICK_MS = 118;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const MAX_SESSIONS_PER_WINDOW = 120;
export const MAX_EVENTS_PER_WINDOW = 24;
export const MAX_VERIFICATION_ATTEMPTS_PER_WINDOW = 240;
export const MAX_VERIFICATION_CONTINUATIONS_PER_WINDOW = 8192;
export const MAX_VERIFICATION_JOB_CONTINUATIONS = 8192;
export const MAX_VERIFIED_TIMING_REVISIONS = 8192;
export const MAX_VERIFICATION_BATCH_OPERATIONS = 32;
export const MAX_VERIFICATION_BATCH_WORK = 40_000;
export const MAX_VERIFICATION_ACTION_WORK = 20_000;
export const MAX_VERIFICATION_ACTION_BYTES = 16 * 1024;
export const MAX_VERIFICATION_BATCH_CANONICAL_BYTES = 64 * 1024;
export const MAX_VERIFICATION_BATCH_CLONE_BYTES = 512 * 1024;
export const MAX_VERIFICATION_CHECKPOINT_BYTES = 256 * 1024;
export const ADMINISTRATOR_SESSION_TTL_MS = 60 * 60 * 1000;
export const ADMINISTRATOR_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const MAX_ADMINISTRATOR_SIGN_INS_PER_WINDOW = 5;

export const ADMINISTRATOR_PROFILE_ID = "player-rohin-neko";
export const ADMINISTRATOR_PROFILE_NAME = "rohin ^.^";
export const ROHIN_NEKO_AVATAR_ICON = "assets/neko-assets/sprites/yawn1.png";
export const ADMINISTRATOR_PROFILE = Object.freeze({
  id: ADMINISTRATOR_PROFILE_ID,
  name: ADMINISTRATOR_PROFILE_NAME,
  icon: ROHIN_NEKO_AVATAR_ICON,
});

export const getGameStatsDatabase = (env) => env.personal_site_game_stats;
