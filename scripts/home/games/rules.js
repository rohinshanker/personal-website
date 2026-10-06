(() => {
const window = globalThis.window || globalThis;

const RESULT_PROTOCOL = 2;
const RULES_VERSION = 1;
const REPLAY_VERSION = 1;
const GENERATOR_VERSION = 1;
const MAX_REPLAY_BODY_BYTES = 256 * 1024;
const SESSION_LIFETIME_MS = 6 * 60 * 60 * 1000;
const SNAKE_TICK_MS = 118;
const SNAKE_COUNTDOWN_MS = 900;
const GAME_RULE_LIMITS = Object.freeze(Object.fromEntries(
  ["minesweeper", "solitaire", "snake", "sudoku"].map((game) => [
    game,
    Object.freeze({
      inputs: 16_384,
      work: 2_000_000,
      ticks: game === "snake" ? Math.floor(SESSION_LIFETIME_MS / SNAKE_TICK_MS) : 0,
      bytes: MAX_REPLAY_BODY_BYTES,
    }),
  ])
));

class GameRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GameRuleError";
    this.code = code;
  }
}

const assertInteger = (value, minimum, maximum, label = "value") => {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new GameRuleError("invalid-input", `Invalid ${label}`);
  }
  return value;
};

const assertObject = (value, allowedKeys, label = "object") => {
  if (
    !value || typeof value !== "object" || Array.isArray(value) ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(value)) ||
    Object.keys(value).some((key) => !allowedKeys.includes(key))
  ) {
    throw new GameRuleError("invalid-input", `Invalid ${label}`);
  }
  return value;
};

/** Each engine charges primitive work against a request-owned budget. */
const createBudget = (limit) => ({
  remaining: assertInteger(limit, 0, 10_000_000, "work budget"),
  spend(units = 1) {
    assertInteger(units, 0, 10_000_000, "work charge");
    if (units > this.remaining) {
      throw new GameRuleError("replay-limit", "Game verification work limit exceeded");
    }
    this.remaining -= units;
  },
});

/** Mulberry32: only the supplied logical state's RNG word changes. */
const nextRandom = (state) => {
  assertInteger(state.rngState, 0, 0xffffffff, "random state");
  state.rngState = (state.rngState + 0x6d2b79f5) >>> 0;
  let value = state.rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
};

const randomIndex = (state, count, budget) => {
  assertInteger(count, 1, 4096, "random choice count");
  budget?.spend();
  return Math.floor(nextRandom(state) * count);
};

const shuffle = (values, state, budget) => {
  if (!Array.isArray(values) || values.length > 4096) {
    throw new GameRuleError("invalid-input", "Invalid shuffle input");
  }
  const shuffled = values.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const selected = randomIndex(state, index + 1, budget);
    [shuffled[index], shuffled[selected]] = [shuffled[selected], shuffled[index]];
  }
  return shuffled;
};

/** Stable JSON for commitments; rejects non-JSON values and excessive nesting. */
const canonicalJson = (value) => {
  const budget = createBudget(500_000);
  const visit = (current, depth) => {
    budget.spend();
    if (depth > 16) throw new GameRuleError("invalid-input", "Game data is too deeply nested");
    if (current === null || typeof current === "string" || typeof current === "boolean") return current;
    if (typeof current === "number" && Number.isFinite(current)) return current;
    if (Array.isArray(current)) return current.map((item) => visit(item, depth + 1));
    if (current && typeof current === "object") {
      assertObject(current, Object.keys(current), "game data");
      return Object.fromEntries(Object.keys(current).sort().map((key) => [
        key, visit(current[key], depth + 1),
      ]));
    }
    throw new GameRuleError("invalid-input", "Game data must contain only JSON values");
  };
  return JSON.stringify(visit(value, 0));
};

const cloneState = (state) => JSON.parse(canonicalJson(state));

/** Validates order before an engine receives any caller-supplied actions. */
const assertReplay = (inputs, maximum = 16_384) => {
  assertInteger(maximum, 0, 16_384, "replay input limit");
  if (!Array.isArray(inputs) || inputs.length > maximum) {
    throw new GameRuleError("replay-limit", "Game replay input limit exceeded");
  }
  inputs.forEach((input, index) => {
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        input.seq !== index + 1 || typeof input.op !== "string") {
      throw new GameRuleError("invalid-input", "Game replay inputs must be ordered");
    }
  });
  return inputs;
};

window.homeGameRules = Object.freeze({
  RESULT_PROTOCOL,
  RULES_VERSION,
  REPLAY_VERSION,
  GENERATOR_VERSION,
  MAX_REPLAY_BODY_BYTES,
  SESSION_LIFETIME_MS,
  SNAKE_TICK_MS,
  SNAKE_COUNTDOWN_MS,
  GAME_RULE_LIMITS,
  GameRuleError,
  assertInteger,
  assertObject,
  createBudget,
  nextRandom,
  randomIndex,
  shuffle,
  canonicalJson,
  cloneState,
  assertReplay,
});
})();
