/**
 * Klondike Solitaire rules, as a portable engine.
 *
 * This file is the only implementation of what a Solitaire move is. The
 * browser controller in scripts/home/features/solitaire.js owns the cards on
 * screen, the animations and the clock; it asks this engine to decide and to
 * apply every change, so the board a player sees and the board a verifier
 * replays can never drift apart.
 *
 * The logical state is JSON and nothing else: card identifiers, face-down and
 * face-up runs, foundation heights, a move count and a bounded undo stack. A
 * face-up flag cannot be wrong here because it is not stored — a stock card is
 * down, a waste card is up, and a tableau column keeps its two runs apart.
 */
(() => {
const window = globalThis.window || globalThis;

const {
  GameRuleError,
  assertInteger,
  assertObject,
  cloneState,
  shuffle,
} = window.homeGameRules;

const SUITS = Object.freeze(["spades", "clubs", "diamonds", "hearts"]);
const RED_SUITS = Object.freeze(["diamonds", "hearts"]);
const RANKS = 13;
const DECK_SIZE = SUITS.length * RANKS;
const TABLEAU_COLUMNS = 7;
const MAX_UNDO_STATES = 100;
const VARIANT = "klondike-draw-one";

const CARD_IDS = Object.freeze(
  SUITS.flatMap((suit) => Array.from({ length: RANKS }, (unused, offset) => `${suit}-${offset + 1}`))
);

/** id -> immutable card facts. Nothing outside this file may add an id. */
const CARDS = new Map(
  CARD_IDS.map((id) => {
    const [suit, rank] = id.split("-");
    return [id, Object.freeze({ id, suit, rank: Number(rank), red: RED_SUITS.includes(suit) })];
  })
);

const fail = (message, code = "invalid-move") => {
  throw new GameRuleError(code, message);
};

const card = (id) => CARDS.get(id) || fail(`Unknown card: ${String(id)}`, "invalid-input");

const assertCardList = (value, label) => {
  if (!Array.isArray(value) || value.length > DECK_SIZE) {
    fail(`Invalid ${label}`, "invalid-input");
  }
  value.forEach((id) => {
    if (typeof id !== "string") fail(`Invalid ${label}`, "invalid-input");
    card(id);
  });
  return value.slice();
};

const assertConfig = (config) => {
  const value = assertObject(config ?? {}, ["variant"], "Solitaire configuration");
  if (value.variant !== undefined && value.variant !== VARIANT) {
    fail("Unsupported Solitaire variant", "invalid-input");
  }
  return { variant: VARIANT };
};

const foundationTotal = (foundations) =>
  SUITS.reduce((total, suit) => total + foundations[suit], 0);

/** Both opposite-colour foundations have passed this card, so it is safe. */
const topOf = (pile) => (pile.length ? pile[pile.length - 1] : null);

const column = (state, index) =>
  state.tableau[assertInteger(index, 0, TABLEAU_COLUMNS - 1, "tableau column")];

const isPackedRun = (ids) => {
  if (!Array.isArray(ids) || !ids.length) return false;
  for (let position = 0; position < ids.length - 1; position += 1) {
    const upper = card(ids[position]);
    const lower = card(ids[position + 1]);
    if (upper.red === lower.red || upper.rank !== lower.rank + 1) return false;
  }
  return true;
};

const acceptsOnTableau = (ids, target) => {
  if (!isPackedRun(ids)) return false;
  const moving = card(ids[0]);
  const targetId = topOf(target.up);
  if (!targetId) return moving.rank === RANKS;
  const resting = card(targetId);
  return moving.red !== resting.red && moving.rank + 1 === resting.rank;
};

const acceptsOnFoundation = (state, id) => {
  const moving = card(id);
  return state.foundations[moving.suit] + 1 === moving.rank;
};

/** A column always shows its top card: an empty run over a buried one is illegal. */
const flipExposed = (pile) => {
  if (!pile.up.length && pile.down.length) pile.up.push(pile.down.pop());
};

const boardSnapshot = (state) => ({
  stock: state.stock.slice(),
  waste: state.waste.slice(),
  foundations: { ...state.foundations },
  tableau: state.tableau.map((pile) => ({ down: pile.down.slice(), up: pile.up.slice() })),
  moves: state.moves,
  won: state.won,
});

const pushUndo = (state) => {
  // An animated auto-solve run is one step to the player, so the snapshot taken
  // when it opened is the only one: the cards it lands add none of their own.
  if (state.autoRun) return;
  state.undo.push(boardSnapshot(state));
  if (state.undo.length > MAX_UNDO_STATES) state.undo.shift();
};

const restoreSnapshot = (state, snapshot) => {
  state.stock = snapshot.stock.slice();
  state.waste = snapshot.waste.slice();
  state.foundations = { ...snapshot.foundations };
  state.tableau = snapshot.tableau.map((pile) => ({ down: pile.down.slice(), up: pile.up.slice() }));
  state.moves = snapshot.moves;
  state.won = snapshot.won;
};

/** Every card accounted for exactly once, and every run legally stacked. */
const assertCompleteDeck = (state) => {
  const seen = new Set();
  const claim = (id) => {
    if (seen.has(id)) fail("A card appears twice on the board", "invalid-input");
    seen.add(id);
  };
  state.stock.forEach(claim);
  state.waste.forEach(claim);
  state.tableau.forEach((pile) => {
    pile.down.forEach(claim);
    pile.up.forEach(claim);
  });
  SUITS.forEach((suit) => {
    for (let rank = 1; rank <= state.foundations[suit]; rank += 1) claim(`${suit}-${rank}`);
  });
  if (seen.size !== DECK_SIZE) fail("The board is not a complete deck", "invalid-input");
};

const normalizeFoundations = (raw) => {
  const value = assertObject(raw ?? {}, SUITS, "foundations");
  return Object.fromEntries(
    SUITS.map((suit) => [suit, assertInteger(value[suit] ?? 0, 0, RANKS, `${suit} foundation`)])
  );
};

const normalizeTableau = (raw) => {
  if (!Array.isArray(raw) || raw.length !== TABLEAU_COLUMNS) {
    fail("Solitaire needs seven tableau columns", "invalid-input");
  }
  return raw.map((pile) => {
    const value = assertObject(pile, ["down", "up"], "tableau column");
    const down = assertCardList(value.down ?? [], "tableau column");
    const up = assertCardList(value.up ?? [], "tableau column");
    if (down.length && !up.length) fail("A tableau column must show its top card", "invalid-input");
    if (up.length && !isPackedRun(up)) fail("A face-up tableau run must be packed", "invalid-input");
    return { down, up };
  });
};

/**
 * Validates an issued board and returns the working state. The undo stack,
 * auto-run flag and assistance counter always start empty: a replay is
 * verified from the issued board forward, never from a client's history.
 */
const initial = (rawInitial) => {
  const raw = assertObject(rawInitial, [
    "rngState", "stock", "waste", "foundations", "tableau", "moves", "won", "redeals", "variant",
  ], "Solitaire initial state");
  if (raw.variant !== undefined && raw.variant !== VARIANT) {
    fail("Unsupported Solitaire variant", "invalid-input");
  }
  const state = {
    rngState: assertInteger(raw.rngState ?? 0, 0, 0xffffffff, "random state"),
    stock: assertCardList(raw.stock ?? [], "stock"),
    waste: assertCardList(raw.waste ?? [], "waste"),
    foundations: normalizeFoundations(raw.foundations),
    tableau: normalizeTableau(raw.tableau),
    moves: assertInteger(raw.moves ?? 0, 0, 100_000, "move count"),
    redeals: assertInteger(raw.redeals ?? 0, 0, 100_000, "redeal count"),
    autoMoves: 0,
    autoRun: false,
    undo: [],
    won: false,
  };
  assertCompleteDeck(state);
  const complete = foundationTotal(state.foundations) === DECK_SIZE;
  if (raw.won !== undefined && Boolean(raw.won) !== complete) {
    fail("The win flag does not match the foundations", "invalid-input");
  }
  state.won = complete;
  return state;
};

/** A deterministic Klondike deal. Winnability is proved offline, not here. */
const generate = (config, { seed = 0, budget } = {}) => {
  assertConfig(config);
  const rng = { rngState: assertInteger(seed, 0, 0xffffffff, "seed") };
  const shuffled = shuffle(CARD_IDS.slice(), rng, budget);
  const tableau = [];
  let cursor = 0;
  for (let length = 1; length <= TABLEAU_COLUMNS; length += 1) {
    const dealt = shuffled.slice(cursor, cursor + length);
    tableau.push({ down: dealt.slice(0, -1), up: dealt.slice(-1) });
    cursor += length;
  }
  return {
    variant: VARIANT,
    rngState: rng.rngState,
    stock: shuffled.slice(cursor),
    waste: [],
    foundations: Object.fromEntries(SUITS.map((suit) => [suit, 0])),
    tableau,
    moves: 0,
    won: false,
  };
};

const settle = (state) => {
  state.won = foundationTotal(state.foundations) === DECK_SIZE;
  // A finished deal is not solving itself, so the run ends with the win rather
  // than needing a move the terminal board would reject.
  if (state.won) state.autoRun = false;
  return state;
};

const countMove = (state, { auto = false } = {}) => {
  state.moves += 1;
  if (auto) state.autoMoves += 1;
};

const OPERATIONS = Object.freeze({
  draw: {
    keys: [],
    cost: () => 1,
    check(state) {
      if (!state.stock.length) fail("The stock is empty");
    },
    apply(state) {
      pushUndo(state);
      state.waste.push(state.stock.pop());
      countMove(state);
    },
  },
  redeal: {
    keys: [],
    cost: (state) => 1 + state.waste.length,
    check(state) {
      if (state.stock.length) fail("The stock still holds cards");
      if (!state.waste.length) fail("There is nothing to redeal");
    },
    apply(state) {
      pushUndo(state);
      state.stock = state.waste.reverse();
      state.waste = [];
      state.redeals += 1;
      countMove(state);
    },
  },
  tableauToTableau: {
    keys: ["from", "index", "to"],
    cost: () => TABLEAU_COLUMNS,
    check(state, action) {
      const source = column(state, action.from);
      const to = assertInteger(action.to, 0, TABLEAU_COLUMNS - 1, "target column");
      if (action.from === to) fail("A run cannot move onto its own column");
      if (!source.up.length) fail("That column has no face-up cards");
      assertInteger(action.index, 0, source.up.length - 1, "run start");
      if (!acceptsOnTableau(source.up.slice(action.index), state.tableau[to])) {
        fail("That run does not fit there");
      }
    },
    apply(state, action) {
      pushUndo(state);
      const source = state.tableau[action.from];
      const moving = source.up.splice(action.index);
      state.tableau[action.to].up.push(...moving);
      flipExposed(source);
      countMove(state);
    },
  },
  wasteToTableau: {
    keys: ["to"],
    cost: () => 2,
    check(state, action) {
      const to = assertInteger(action.to, 0, TABLEAU_COLUMNS - 1, "target column");
      const id = topOf(state.waste) ?? fail("The waste is empty");
      if (!acceptsOnTableau([id], state.tableau[to])) fail("That card does not fit there");
    },
    apply(state, action) {
      pushUndo(state);
      state.tableau[action.to].up.push(state.waste.pop());
      countMove(state);
    },
  },
  tableauToFoundation: {
    keys: ["from"],
    cost: () => 2,
    check(state, action) {
      const source = column(state, action.from);
      const id = topOf(source.up) ?? fail("That column has no face-up cards");
      if (!acceptsOnFoundation(state, id)) fail("That card does not fit its foundation");
    },
    apply(state, action) {
      pushUndo(state);
      const source = state.tableau[action.from];
      state.foundations[card(source.up.pop()).suit] += 1;
      flipExposed(source);
      countMove(state, { auto: state.autoRun });
    },
  },
  wasteToFoundation: {
    keys: [],
    cost: () => 2,
    check(state) {
      const id = topOf(state.waste) ?? fail("The waste is empty");
      if (!acceptsOnFoundation(state, id)) fail("That card does not fit its foundation");
    },
    apply(state) {
      pushUndo(state);
      state.foundations[card(state.waste.pop()).suit] += 1;
      countMove(state, { auto: state.autoRun });
    },
  },
  foundationToTableau: {
    keys: ["suit", "to"],
    cost: () => 2,
    check(state, action) {
      if (!SUITS.includes(action.suit)) fail("Unknown foundation suit", "invalid-input");
      const rank = state.foundations[action.suit];
      if (!rank) fail("That foundation is empty");
      const to = assertInteger(action.to, 0, TABLEAU_COLUMNS - 1, "target column");
      if (!acceptsOnTableau([`${action.suit}-${rank}`], state.tableau[to])) {
        fail("That card does not fit there");
      }
    },
    apply(state, action) {
      pushUndo(state);
      const rank = state.foundations[action.suit];
      state.foundations[action.suit] -= 1;
      state.tableau[action.to].up.push(`${action.suit}-${rank}`);
      countMove(state);
    },
  },
  undo: {
    keys: [],
    cost: () => DECK_SIZE,
    check(state) {
      if (!state.undo.length) fail("There is nothing to undo");
    },
    apply(state) {
      restoreSnapshot(state, state.undo.pop());
    },
  },
  autoRunStart: {
    keys: [],
    cost: () => DECK_SIZE,
    check(state) {
      if (!nextFoundationMove(state)) fail("No visible card can move to a foundation");
    },
    apply(state) {
      pushUndo(state);
      state.autoRun = true;
    },
  },
  autoRunEnd: {
    keys: [],
    cost: () => 1,
    check(state) {
      if (!state.autoRun) fail("The board is not solving itself");
    },
    apply(state) {
      state.autoRun = false;
    },
  },
});

/**
 * Only foundation moves land during an animated auto-solve run, and Undo is
 * unavailable until it ends: one snapshot covers the whole run.
 */
const AUTO_RUN_OPERATIONS = Object.freeze(["tableauToFoundation", "wasteToFoundation", "autoRunEnd"]);

/** Throws the exact reason `action` cannot be played, or returns its operation. */
const review = (state, action) => {
  if (state.won) fail("The board is already won");
  const operation = OPERATIONS[action?.op] ||
    fail(`Unknown Solitaire move: ${String(action?.op)}`, "invalid-input");
  assertObject(action, ["seq", "op", ...operation.keys], "Solitaire move");
  if (state.autoRun && action.op === "autoRunStart") fail("The board is already solving itself");
  if (state.autoRun && !AUTO_RUN_OPERATIONS.includes(action.op)) {
    fail("Only an auto-solve foundation move can land during a run");
  }
  operation.check(state, action);
  return operation;
};

const transition = (state, input, budget) => {
  const operation = review(state, input);
  budget.spend(operation.cost(state, input));
  operation.apply(state, input);
  return settle(state);
};

/** Whether `action` is playable now. The controller offers nothing else. */
const canApply = (state, action) => {
  try {
    review(state, action);
    return true;
  } catch (error) {
    if (error instanceof GameRuleError) return false;
    throw error;
  }
};

const result = (state) => ({
  terminal: state.won,
  won: state.won,
  lost: false,
  score: state.moves,
  moves: state.moves,
  assistance: state.autoMoves ? "autoSolve" : "none",
  assistanceCount: state.autoMoves,
  configuration: { variant: VARIANT },
});

/**
 * The lowest-ranked foundation move available from a visible card: a tableau
 * top, or the top of the waste. It reads a board of cards rather than the
 * logical state, because that is what the controller has on screen and what a
 * staged Admin or fixture board is; a partial board simply offers less.
 *
 * Each move carries the pile and index the animation needs and the legal engine
 * action that lands it, so an auto-solve run plays ordinary moves — the planner
 * never gets to invent one.
 */
const boardFoundationMove = (board) => {
  const height = (suit) => (board.foundations?.[suit] || []).length;
  const wanted = (entry, suit) =>
    Boolean(entry) && entry.faceUp === true && entry.suit === suit && entry.rank === height(suit) + 1;
  let best = null;
  const consider = (move) => {
    if (move.rank <= RANKS && (!best || move.rank < best.rank)) best = move;
  };
  SUITS.forEach((suit) => {
    const rank = height(suit) + 1;
    if (rank > RANKS) return;
    const columns = board.tableau || [];
    for (let pile = 0; pile < columns.length; pile += 1) {
      const cards = columns[pile] || [];
      if (wanted(cards[cards.length - 1], suit)) {
        consider({
          zone: "tableau", pile, index: cards.length - 1, suit, rank,
          action: { op: "tableauToFoundation", from: pile },
        });
        return;
      }
    }
    const waste = board.waste || [];
    if (wanted(waste[waste.length - 1], suit)) {
      consider({
        zone: "waste", pile: "waste", index: waste.length - 1, suit, rank,
        action: { op: "wasteToFoundation" },
      });
    }
  });
  return best;
};

/**
 * Every foundation move an auto-solve run would make, lowest rank first, until
 * no visible card fits, and whether that chain finishes the deal. Planning works
 * on a copy, so the live board is untouched.
 */
const planAutoSolveBoard = (board) => {
  // The cards are copied, not just the piles: planning turns a card over when it
  // surfaces, and these are the very objects the board on screen is drawn from.
  const copy = (cards) => (cards || []).map((card) => ({ ...card }));
  const trial = {
    waste: copy(board.waste),
    foundations: Object.fromEntries(
      SUITS.map((suit) => [suit, copy(board.foundations?.[suit])])
    ),
    tableau: (board.tableau || []).map(copy),
  };
  const moves = [];
  for (let move = boardFoundationMove(trial); move; move = boardFoundationMove(trial)) {
    moves.push(move);
    const source = move.zone === "tableau" ? trial.tableau[move.pile] : trial.waste;
    const [moved] = source.splice(move.index, 1);
    trial.foundations[move.suit].push(moved);
    const exposed = move.zone === "tableau" ? source[source.length - 1] : null;
    if (exposed && !exposed.faceUp) exposed.faceUp = true;
    if (moves.length > DECK_SIZE) fail("Auto-solve plan overran the deck");
  }
  const placed = SUITS.reduce((total, suit) => total + trial.foundations[suit].length, 0);
  return { moves, completes: placed === DECK_SIZE };
};

const nextFoundationMove = (state) => boardFoundationMove(toBoard(state));

const planAutoSolve = (state) => planAutoSolveBoard(toBoard(state));

/**
 * The board as cards to draw: stock face down, waste face up, and each tableau
 * column's buried run face down beneath its packed face-up run. Foundations
 * expand from their heights, so a foundation can only ever hold a legal run.
 */
const toBoard = (state) => {
  const face = (id, faceUp) => ({ ...card(id), faceUp });
  return {
    rngState: state.rngState,
    stock: state.stock.map((id) => face(id, false)),
    waste: state.waste.map((id) => face(id, true)),
    foundations: Object.fromEntries(
      SUITS.map((suit) => [
        suit,
        Array.from({ length: state.foundations[suit] }, (unused, offset) => face(`${suit}-${offset + 1}`, true)),
      ])
    ),
    tableau: state.tableau.map((pile) => [
      ...pile.down.map((id) => face(id, false)),
      ...pile.up.map((id) => face(id, true)),
    ]),
    moves: state.moves,
    won: state.won,
  };
};

/**
 * The inverse of `toBoard`, for a board this engine did not deal: an offline
 * save or a staged Admin presentation. The result is validated like any issued
 * state, so an impossible board is rejected here rather than played.
 */
const fromBoard = (board) => {
  if (!board || typeof board !== "object") fail("Invalid Solitaire board", "invalid-input");
  const value = board;
  const ids = (cards) =>
    (Array.isArray(cards) ? cards : fail("Invalid pile", "invalid-input"))
      .map((entry) => card(entry?.id).id);
  const foundations = value.foundations ?? {};
  return initial({
    rngState: value.rngState ?? 0,
    stock: ids(value.stock ?? []),
    waste: ids(value.waste ?? []),
    foundations: Object.fromEntries(SUITS.map((suit) => [suit, ids(foundations[suit] ?? []).length])),
    tableau: (Array.isArray(value.tableau) ? value.tableau : fail("Invalid tableau", "invalid-input")).map((cards) => {
      const pile = ids(cards);
      const firstUp = (Array.isArray(cards) ? cards : []).findIndex((entry) => entry.faceUp);
      const split = firstUp < 0 ? pile.length : firstUp;
      return { down: pile.slice(0, split), up: pile.slice(split) };
    }),
    moves: value.moves ?? 0,
  });
};

/**
 * Relabels the suits of an issued deal. The three bits of `seed` swap the two
 * black suits, the two red suits, and the colours themselves, so every card
 * keeps its rank, its colour pattern and its position. Klondike legality reads
 * only rank, colour and suit equality, so a winning line of play on the original
 * deal is the same line of play here: the eight variants of a deck proved
 * winnable are all winnable, and the proof does not have to be redone.
 */
const transformDeal = (rawInitial, { seed = 0 } = {}) => {
  const state = initial(rawInitial);
  const variant = assertInteger(seed, 0, 0xffffffff, "seed") & 0b111;
  const blacks = variant & 0b001 ? ["clubs", "spades"] : ["spades", "clubs"];
  const reds = variant & 0b010 ? ["hearts", "diamonds"] : ["diamonds", "hearts"];
  const [first, second] = variant & 0b100 ? [reds, blacks] : [blacks, reds];
  const relabel = { spades: first[0], clubs: first[1], diamonds: second[0], hearts: second[1] };
  const move = (id) => `${relabel[card(id).suit]}-${card(id).rank}`;
  return {
    variant: VARIANT,
    rngState: state.rngState,
    stock: state.stock.map(move),
    waste: state.waste.map(move),
    foundations: Object.fromEntries(SUITS.map((suit) => [relabel[suit], state.foundations[suit]])),
    tableau: state.tableau.map((pile) => ({ down: pile.down.map(move), up: pile.up.map(move) })),
    moves: state.moves,
    won: state.won,
  };
};

window.homeSolitaireRules = Object.freeze({
  CARD_IDS,
  DECK_SIZE,
  MAX_UNDO_STATES,
  SUITS,
  TABLEAU_COLUMNS,
  VARIANT,
  acceptsOnFoundation,
  acceptsOnTableau,
  assertConfig,
  boardFoundationMove,
  canApply,
  foundationTotal,
  fromBoard,
  generate,
  initial,
  isPackedRun,
  nextFoundationMove,
  planAutoSolve,
  planAutoSolveBoard,
  result,
  toBoard,
  transformDeal,
  transition,
});
})();
