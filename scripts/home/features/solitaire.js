(() => {
const {
  loadDeferredMedia,
} = window.homeActivation;
const {
  createGameStatsEvent,
  recordGameStatsEvent,
  startGameStatsSession,
} = window.homeGameStats;
const {
  prefersReducedMotion,
} = window.homeUtil;
const {
  registerWindowLifecycle,
  setWindowOpen,
} = window.homeWindows;
const {
  notifyActivity,
} = window.homeActivity;
const {
  formatSevenSegmentCounter,
  setSevenSegmentCounter,
} = window.homeMinesweeper;

const SOLITAIRE_MAX_UNDO_STATES = 100;

const SOLITAIRE_DOUBLE_CLICK_WINDOW_MS = 500;

const SOLITAIRE_FIREWORK_BURST_COUNT = 9;

const SOLITAIRE_FIREWORK_BURST_INTERVAL_MS = 260;

const SOLITAIRE_FIREWORK_DURATION_MS = 3600;


const SOLITAIRE_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL = 22;

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

const solAutoSolve = document.getElementById("sol-auto-solve");

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
  statsSession: "",
  presentation: null,
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

let solAutoSolveRun = null;

let solWindowImpact = null;

let solBoardReady = false;

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

const solShuffle = (cards, random = Math.random) => {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
};

const solSolverNodeBudget = 12_000;

const solGenerationNodeBudget = 40_000;

const solDealAttemptCap = 12;

const solDealShuffledDeck = (random) => {
  const deck = solShuffle(solBuildDeck(), random);
  const tableau = [];
  let deckIndex = 0;

  for (let length = 1; length <= 7; length += 1) {
    const column = deck.slice(deckIndex, deckIndex + length);
    column.at(-1).faceUp = true;
    tableau.push(column);
    deckIndex += length;
  }

  return { stock: deck.slice(deckIndex), tableau };
};

const solSearchWinningMoves = (
  deal,
  nodeBudget,
  generationWork = { nodes: 0, limit: nodeBudget }
) => {
  const cards = [...deal.stock, ...deal.tableau.flat()];
  const cardIds = new Set(cards.map((card) => card.id));
  const suitIndex = Object.fromEntries(
    solSuitOrder.map((suit, index) => [suit, index])
  );
  const cardCode = new Map(cards.map((card, index) => [card.id, index]));
  const codeCard = cards.map((card) => ({
    id: card.id,
    rank: card.rank,
    suit: card.suit,
    suitIndex: suitIndex[card.suit],
    color: card.suit === "diamonds" || card.suit === "hearts" ? 1 : 0,
  }));
  const state = {
    foundations: [0, 0, 0, 0],
    stock: deal.stock.map((card) => cardCode.get(card.id)),
    tableau: deal.tableau.map((column) => {
      const firstFaceUp = column.findIndex((card) => card.faceUp);
      return {
        down: column.slice(0, firstFaceUp).map((card) => cardCode.get(card.id)),
        up: column.slice(firstFaceUp).map((card) => cardCode.get(card.id)),
      };
    }),
    path: null,
  };
  const visited = new Set();
  let nodes = 0;

  const cloneState = (current) => ({
    foundations: [...current.foundations],
    stock: [...current.stock],
    tableau: current.tableau.map((column) => ({
      down: [...column.down],
      up: [...column.up],
    })),
    path: current.path,
  });

  const recordMove = (current, move) => {
    current.path = { move, previous: current.path };
  };

  const flipTableauTop = (column) => {
    if (!column.up.length && column.down.length) {
      column.up.push(column.down.pop());
    }
  };

  const canMoveToFoundation = (current, code) => {
    const card = codeCard[code];
    return current.foundations[card.suitIndex] + 1 === card.rank;
  };

  const isSafeFoundationMove = (current, code) => {
    const card = codeCard[code];
    if (card.rank <= 2) return true;
    const oppositeSuitIndexes = card.color ? [0, 1] : [2, 3];
    return oppositeSuitIndexes.every(
      (index) => current.foundations[index] >= card.rank - 1
    );
  };

  const moveTableauTopToFoundation = (current, columnIndex) => {
    const column = current.tableau[columnIndex];
    const code = column.up.pop();
    const card = codeCard[code];
    current.foundations[card.suitIndex] = card.rank;
    recordMove(current, {
      type: "toFoundation",
      from: "tableau",
      column: columnIndex,
    });
    flipTableauTop(column);
  };

  const moveStockToFoundation = (current, stockIndex) => {
    const [code] = current.stock.splice(stockIndex, 1);
    const card = codeCard[code];
    current.foundations[card.suitIndex] = card.rank;
    recordMove(current, {
      type: "toFoundation",
      from: "stock",
      cardId: card.id,
    });
  };

  const applySafeFoundationMoves = (current) => {
    let moved = true;
    while (moved) {
      moved = false;
      for (let columnIndex = 0; columnIndex < 7; columnIndex += 1) {
        const column = current.tableau[columnIndex];
        const code = column.up.at(-1);
        if (
          code !== undefined &&
          canMoveToFoundation(current, code) &&
          isSafeFoundationMove(current, code)
        ) {
          moveTableauTopToFoundation(current, columnIndex);
          moved = true;
          break;
        }
      }
      if (moved) continue;

      const stockIndex = current.stock.findIndex(
        (code) =>
          canMoveToFoundation(current, code) &&
          isSafeFoundationMove(current, code)
      );
      if (stockIndex >= 0) {
        moveStockToFoundation(current, stockIndex);
        moved = true;
      }
    }
  };

  const encodeCodes = (codes) =>
    String.fromCharCode(...codes.map((code) => 65 + code));

  const stateKey = (current) => {
    const stockKey = encodeCodes(
      [...current.stock].sort((left, right) => left - right)
    );
    const columnKeys = current.tableau
      .map(
        (column) => `${encodeCodes(column.down)}/${encodeCodes(column.up)}`
      )
      .sort();
    return `${encodeCodes(current.foundations)}|${stockKey}|${columnKeys.join("|")}`;
  };

  const canMoveRunToColumn = (current, code, targetIndex) => {
    const target = current.tableau[targetIndex].up.at(-1);
    const card = codeCard[code];
    if (target === undefined) return card.rank === 13;
    const targetCard = codeCard[target];
    return card.color !== targetCard.color && card.rank + 1 === targetCard.rank;
  };

  const exposedTargetIsNeeded = (current, sourceIndex, startIndex) => {
    const exposed = codeCard[current.tableau[sourceIndex].up[startIndex - 1]];
    if (
      current.foundations[exposed.suitIndex] + 1 === exposed.rank
    ) {
      return true;
    }
    const fitsExposed = (code) => {
      const card = codeCard[code];
      return card.color !== exposed.color && card.rank + 1 === exposed.rank;
    };
    if (current.stock.some(fitsExposed)) return true;
    return current.tableau.some((column, columnIndex) => {
      if (columnIndex === sourceIndex) return false;
      return column.up.some((code) => fitsExposed(code));
    });
  };

  const tableauMoves = (current) => {
    const moves = [];
    current.tableau.forEach((column, sourceIndex) => {
      column.up.forEach((code, startIndex) => {
        const isWholeRun = startIndex === 0;
        if (
          !isWholeRun &&
          !exposedTargetIsNeeded(current, sourceIndex, startIndex)
        ) {
          return;
        }

        current.tableau.forEach((target, targetIndex) => {
          if (targetIndex === sourceIndex) return;
          if (!canMoveRunToColumn(current, code, targetIndex)) return;
          if (
            !target.up.length &&
            !target.down.length &&
            isWholeRun &&
            !column.down.length &&
            codeCard[code].rank === 13
          ) {
            return;
          }
          moves.push({
            sourceIndex,
            startIndex,
            targetIndex,
            flipsCard: isWholeRun && column.down.length > 0,
          });
        });
      });
    });
    moves.sort((left, right) => Number(right.flipsCard) - Number(left.flipsCard));
    return moves;
  };

  const stockTableauMoves = (current) => {
    const moves = [];
    current.stock.forEach((code, stockIndex) => {
      current.tableau.forEach((column, targetIndex) => {
        if (canMoveRunToColumn(current, code, targetIndex)) {
          moves.push({ code, stockIndex, targetIndex });
        }
      });
    });
    return moves;
  };

  const search = (current) => {
    if (nodes >= nodeBudget || generationWork.nodes >= generationWork.limit) {
      return null;
    }
    applySafeFoundationMoves(current);
    if (current.foundations.every((rank) => rank === 13)) {
      const moves = [];
      for (let step = current.path; step; step = step.previous) {
        moves.push(step.move);
      }
      return moves.reverse();
    }

    const key = stateKey(current);
    if (visited.has(key)) return null;
    visited.add(key);
    nodes += 1;
    generationWork.nodes += 1;

    for (let columnIndex = 0; columnIndex < 7; columnIndex += 1) {
      const column = current.tableau[columnIndex];
      const code = column.up.at(-1);
      if (code !== undefined && canMoveToFoundation(current, code)) {
        const next = cloneState(current);
        moveTableauTopToFoundation(next, columnIndex);
        const solution = search(next);
        if (solution) return solution;
      }
    }

    for (let stockIndex = 0; stockIndex < current.stock.length; stockIndex += 1) {
      const code = current.stock[stockIndex];
      if (canMoveToFoundation(current, code)) {
        const next = cloneState(current);
        moveStockToFoundation(next, stockIndex);
        const solution = search(next);
        if (solution) return solution;
      }
    }

    const availableTableauMoves = tableauMoves(current);
    const tryTableauMoves = (flipsCard) => {
      for (const move of availableTableauMoves) {
        if (move.flipsCard !== flipsCard) continue;
        const next = cloneState(current);
        const source = next.tableau[move.sourceIndex];
        const moving = source.up.splice(move.startIndex);
        next.tableau[move.targetIndex].up.push(...moving);
        recordMove(next, {
          type: "toTableau",
          from: "tableau",
          column: move.sourceIndex,
          index: source.down.length + move.startIndex,
          toColumn: move.targetIndex,
        });
        flipTableauTop(source);
        const solution = search(next);
        if (solution) return solution;
        if (
          nodes >= nodeBudget ||
          generationWork.nodes >= generationWork.limit
        ) {
          return null;
        }
      }
      return undefined;
    };

    const flipSolution = tryTableauMoves(true);
    if (flipSolution) return flipSolution;

    for (const move of stockTableauMoves(current)) {
      const next = cloneState(current);
      next.stock.splice(move.stockIndex, 1);
      next.tableau[move.targetIndex].up.push(move.code);
      recordMove(next, {
        type: "toTableau",
        from: "stock",
        cardId: codeCard[move.code].id,
        column: move.targetIndex,
      });
      const solution = search(next);
      if (solution) return solution;
      if (
        nodes >= nodeBudget ||
        generationWork.nodes >= generationWork.limit
      ) {
        break;
      }
    }

    const rearrangeSolution = tryTableauMoves(false);
    if (rearrangeSolution) return rearrangeSolution;
    return null;
  };

  if (cardIds.size !== 52) return null;
  return search(state);
};

const solFindWinningMoves = (deal, nodeBudget = solSolverNodeBudget) =>
  solSearchWinningMoves(deal, nodeBudget);

const solBuildWinnableDeal = (random = Math.random) => {
  let deal = null;
  const generationWork = { nodes: 0, limit: solGenerationNodeBudget };
  for (
    let attempt = 0;
    attempt < solDealAttemptCap && generationWork.nodes < generationWork.limit;
    attempt += 1
  ) {
    deal = solDealShuffledDeck(random);
    const solution = solSearchWinningMoves(
      deal,
      solSolverNodeBudget,
      generationWork
    );
    if (solution) return { ...deal, solution, verified: true };
  }
  return { ...deal, solution: null, verified: false };
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
  if (solHistory.length > SOLITAIRE_MAX_UNDO_STATES) solHistory.shift();
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

const solAutoSolveTiming = Object.freeze({
  firstIntervalMs: 1000,
  accelerationFactor: 0.86,
  minIntervalMs: 120,
  liftShare: 0.55,
  snapShare: 0.3,
});

const solAutoSolveIntervalMs = (step, timing = solAutoSolveTiming) =>
  Math.max(
    timing.minIntervalMs,
    Math.round(timing.firstIntervalMs * timing.accelerationFactor ** step)
  );

const solAutoSolvePhaseMs = (intervalMs, timing = solAutoSolveTiming) => ({
  liftMs: Math.round(intervalMs * timing.liftShare),
  snapMs: Math.round(intervalMs * timing.snapShare),
});

const solFoundationCardCount = (state) =>
  solSuitOrder.reduce((total, suit) => total + state.foundations[suit].length, 0);

/** A visible card is an exposed tableau top or the top of the waste. */
const solPlayableFoundationMove = (state, suit) => {
  const rank = state.foundations[suit].length + 1;
  if (rank > 13) return null;
  const matches = (card) =>
    Boolean(card) && card.faceUp && card.suit === suit && card.rank === rank;
  const columnIndex = state.tableau.findIndex((column) =>
    matches(column[column.length - 1])
  );
  if (columnIndex >= 0) {
    return {
      zone: "tableau",
      pile: columnIndex,
      index: state.tableau[columnIndex].length - 1,
      suit,
      rank,
    };
  }
  const wasteIndex = state.waste.length - 1;
  if (matches(state.waste[wasteIndex])) {
    return { zone: "waste", pile: "waste", index: wasteIndex, suit, rank };
  }
  return null;
};

const solNextAutoSolveMove = (state) => {
  let best = null;
  solSuitOrder.forEach((suit) => {
    const move = solPlayableFoundationMove(state, suit);
    if (move && (!best || move.rank < best.rank)) best = move;
  });
  return best;
};

/** Moves the card and flips a newly exposed face-down tableau card. */
const solApplyAutoSolveMove = (state, move) => {
  const source = move.zone === "tableau" ? state.tableau[move.pile] : state.waste;
  const [card] = source.splice(move.index, 1);
  state.foundations[move.suit].push(card);
  const exposed = move.zone === "tableau" ? source[source.length - 1] : null;
  const flipped = Boolean(exposed && !exposed.faceUp);
  if (flipped) exposed.faceUp = true;
  return { card, flipped };
};

/**
 * Every foundation move the run will make, lowest rank first, until no visible
 * card fits. `completes` is true when that chain reaches all 52 cards.
 */
const solPlanAutoSolve = (state) => {
  const trial = {
    stock: solCloneCards(state.stock),
    waste: solCloneCards(state.waste),
    foundations: Object.fromEntries(
      solSuitOrder.map((suit) => [suit, solCloneCards(state.foundations[suit])])
    ),
    tableau: state.tableau.map(solCloneCards),
  };
  const moves = [];
  for (let move = solNextAutoSolveMove(trial); move; move = solNextAutoSolveMove(trial)) {
    solApplyAutoSolveMove(trial, move);
    moves.push(move);
  }
  return { moves, completes: solFoundationCardCount(trial) === 52 };
};

/**
 * Everything a plan depends on: which cards are visible, in what order, and how
 * far each foundation has come. Building it is far cheaper than replanning, and
 * reading the live cards is what makes the cache safe — a direct `solState`
 * edit, an undo restore or a test bridge invalidates it without announcing
 * itself, because the signature it produces no longer matches.
 */
const solAutoSolveSignature = (state) => {
  const pile = (cards) =>
    cards.map((card) => `${card.id}${card.faceUp ? ">" : "<"}`).join(",");
  return [
    state.won ? "won" : "live",
    state.stock.length,
    solSuitOrder.map((suit) => state.foundations[suit].length).join(","),
    pile(state.waste),
    ...state.tableau.map(pile),
  ].join("|");
};

let solAutoSolvePlanCache = null;

/** `solPlanAutoSolve`, recomputed only when the board can have changed. */
const solCachedAutoSolvePlan = (state) => {
  const signature = solAutoSolveSignature(state);
  if (solAutoSolvePlanCache?.signature === signature) {
    return solAutoSolvePlanCache.plan;
  }
  const plan = solPlanAutoSolve(state);
  solAutoSolvePlanCache = { signature, plan };
  return plan;
};

const solCanAutoSolve = (state) =>
  !state.won && solCachedAutoSolvePlan(state).moves.length > 0;

const solPresentationRunSuits = [
  ["spades", "hearts"],
  ["hearts", "spades"],
  ["clubs", "diamonds"],
  ["diamonds", "clubs"],
];

const solBuildPresentationTableau = () => {
  const runs = solPresentationRunSuits.map(([oddSuit, evenSuit]) =>
    Array.from({ length: 13 }, (_, offset) => {
      const rank = 13 - offset;
      const suit = rank % 2 ? oddSuit : evenSuit;
      return { id: `${suit}-${rank}`, suit, rank, faceUp: true };
    })
  );
  return [...runs, [], [], []];
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

  for (let i = 0; i < SOLITAIRE_FIREWORK_BURST_COUNT; i += 1) {
    const timer = setTimeout(() => {
      const x = window.innerWidth * (0.18 + Math.random() * 0.64);
      const y = window.innerHeight * (0.16 + Math.random() * 0.42);
      solCreateFireworkBurst(x, y);
    }, i * SOLITAIRE_FIREWORK_BURST_INTERVAL_MS);
    solFireworkTimers.push(timer);
  }

  solFireworkTimeout = setTimeout(() => {
    solFireworks.classList.remove("is-showing");
    solFireworks.setAttribute("aria-hidden", "true");
    solFireworks.innerHTML = "";
    solFireworkTimers = [];
    solFireworkTimeout = null;
  }, SOLITAIRE_FIREWORK_DURATION_MS);
};

const solTriggerVictoryEffects = () => {
  if (solState.presentation) {
    if (solState.presentation.visualEffects) {
      solStartFireworks();
      solShowAchievement();
    }
    solPlayVictoryVideo();
    return;
  }
  solStartFireworks();
  solShowAchievement();
  solPlayVictoryVideo();
  recordGameStatsEvent(
    createGameStatsEvent({
      game: "solitaire",
      type: "win",
      metric: solState.moves,
    }),
    solState.statsSession
  );
  notifyActivity("gameWin", { game: "solitaire" });
};

const solCreateSlotMark = (text) => {
  const mark = document.createElement("span");
  mark.className = "sol-slot-mark";
  mark.textContent = text;
  return mark;
};

/** One reusable mark per slot, so an empty pile keeps its node across renders. */
const solSlotMarks = new Map();

const solSlotMark = (key, text) => {
  const existing = solSlotMarks.get(key);
  if (existing) {
    if (existing.textContent !== text) existing.textContent = text;
    return existing;
  }
  const mark = solCreateSlotMark(text);
  solSlotMarks.set(key, mark);
  return mark;
};

/** Writes an attribute only when it changes, so an unchanged node stays quiet. */
const solSetAttribute = (element, name, value) => {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
};

const solSetText = (element, text) => {
  if (element.textContent !== text) element.textContent = text;
};

/**
 * Makes `nodes` the children of `parent`, in order, by moving the nodes that
 * are already there instead of rebuilding them. Cards, columns and slot marks
 * therefore keep their identity — and with it their listeners, focus and
 * running animations — wherever the data behind them is unchanged.
 */
const solSyncChildren = (parent, nodes) => {
  let cursor = parent.firstChild;
  nodes.forEach((node) => {
    if (cursor === node) {
      cursor = cursor.nextSibling;
      return;
    }
    parent.insertBefore(node, cursor);
  });
  while (cursor) {
    const next = cursor.nextSibling;
    parent.removeChild(cursor);
    cursor = next;
  }
};

/** The card nodes a container already holds, keyed by the card each one shows. */
const solCardElementsById = (parent) => {
  const elements = new Map();
  Array.from(parent.children).forEach((child) => {
    const id = child.getAttribute("data-sol-card-id");
    if (id) elements.set(id, child);
  });
  return elements;
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

const solCreateCardElement = (card) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sol-card";
  button.setAttribute("data-sol-card-id", card.id);
  return button;
};

/** Brings one card node up to date in place, leaving nothing stale behind. */
const solUpdateCardElement = (button, card, zone, pile, index) => {
  solSetAttribute(button, "data-sol-zone", zone);
  solSetAttribute(button, "data-sol-pile", String(pile));
  solSetAttribute(button, "data-sol-index", String(index));
  // A cancelled run leaves its lifted source card on the board, so the classes
  // a run adds are cleared here rather than by rebuilding the column.
  button.classList.remove("is-auto-solve-lifted");
  button.classList.toggle("is-face-down", !card.faceUp);

  if (!card.faceUp) {
    button.classList.remove("is-selected");
    solApplyCardSprite(button, solSprite.backCol, solSprite.backRow);
    solSetAttribute(button, "aria-label", "Face-down card");
    return button;
  }

  button.classList.toggle("is-selected", solIsSelectedCard(card));
  solApplyCardSprite(button, card.rank - 1, solSuitOrder.indexOf(card.suit));
  solSetAttribute(button, "aria-label", solCardName(card));
  return button;
};

/** Reuses the node already showing `card` in this container, or makes one. */
const solCardElement = (existing, card, zone, pile, index) =>
  solUpdateCardElement(
    existing.get(card.id) || solCreateCardElement(card),
    card,
    zone,
    pile,
    index
  );

let solStockBack = null;

const solStockBackElement = () => {
  if (solStockBack) return solStockBack;
  solStockBack = document.createElement("button");
  solStockBack.type = "button";
  solStockBack.className = "sol-card is-face-down";
  solStockBack.setAttribute("data-sol-stock", "");
  solApplyCardSprite(solStockBack, solSprite.backCol, solSprite.backRow);
  return solStockBack;
};

const solRenderFoundationSlot = (slot, suit) => {
  const pile = solState.foundations[suit] || [];
  const topCard = pile[pile.length - 1];
  const existing = solCardElementsById(slot);
  solSyncChildren(slot, [
    topCard
      ? solCardElement(existing, topCard, "foundation", suit, pile.length - 1)
      : solSlotMark(`foundation-${suit}`, solSuitData[suit].symbol),
  ]);
  solSetAttribute(
    slot,
    "aria-label",
    topCard
      ? `${solSuitData[suit].label} foundation, ${solCardName(topCard)}`
      : `${solSuitData[suit].label} foundation`
  );
};

const solStockLabel = () => {
  if (solState.stock.length) return `Stock, ${solState.stock.length} cards`;
  return solState.waste.length ? "Restock waste" : "Empty stock";
};

const solRenderStock = () => {
  const label = solStockLabel();
  if (solState.stock.length) {
    const back = solStockBackElement();
    solSetAttribute(back, "aria-label", label);
    solSyncChildren(solStock, [back]);
  } else {
    solSyncChildren(
      solStock,
      solState.waste.length ? [solSlotMark("stock", "↻")] : []
    );
  }
  solSetAttribute(solStock, "aria-label", label);
};

const solRenderWaste = () => {
  const topCard = solState.waste[solState.waste.length - 1];
  const existing = solCardElementsById(solWaste);
  solSyncChildren(solWaste, [
    topCard
      ? solCardElement(existing, topCard, "waste", "waste", solState.waste.length - 1)
      : solSlotMark("waste", "W"),
  ]);
  solSetAttribute(
    solWaste,
    "aria-label",
    topCard ? `Waste, ${solCardName(topCard)}` : "Waste"
  );
};

/**
 * Each column, its empty slot and its tooltip are built once and then reused.
 * The tooltip in particular has to outlive a render: it lives on the body so it
 * can escape the board's overflow, so rebuilding it per render would add
 * another body node and another set of pointer listeners every time the board
 * changed.
 */
const solTableauColumns = [];

const solTableauColumn = (colIndex) => {
  const existing = solTableauColumns[colIndex];
  if (existing) return existing;

  const columnEl = document.createElement("div");
  columnEl.className = "sol-tableau-col";
  columnEl.setAttribute("data-sol-col", String(colIndex));
  columnEl.setAttribute("role", "button");
  columnEl.setAttribute("tabindex", "0");

  const emptySlot = document.createElement("div");
  emptySlot.className = "sol-slot";
  emptySlot.setAttribute("aria-hidden", "true");

  const tooltip = document.createElement("span");
  tooltip.className = "sol-tableau-tooltip";
  tooltip.setAttribute("role", "tooltip");
  document.body.appendChild(tooltip);
  solAttachTableauTooltip(columnEl, tooltip);

  const column = { columnEl, emptySlot, tooltip };
  solTableauColumns[colIndex] = column;
  return column;
};

const solRenderTableauColumn = (cards, colIndex) => {
  const { columnEl, emptySlot, tooltip } = solTableauColumn(colIndex);
  const existing = solCardElementsById(columnEl);
  solSyncChildren(
    columnEl,
    cards.length
      ? cards.map((card, cardIndex) =>
          solCardElement(existing, card, "tableau", colIndex, cardIndex))
      : [emptySlot]
  );

  const bottomCard = cards.find((card) => card.faceUp);
  if (bottomCard) {
    solSetText(tooltip, `Bottom: ${solCardShortName(bottomCard)}`);
    solSetAttribute(
      columnEl,
      "aria-label",
      `Tableau column ${colIndex + 1}, bottom card ${solCardName(bottomCard)}`
    );
  } else {
    solSetText(tooltip, "");
    if (solActiveTableauTooltip === tooltip) solHideTableauTooltip();
    solSetAttribute(columnEl, "aria-label", `Tableau column ${colIndex + 1}`);
  }

  return columnEl;
};

const solRender = () => {
  if (!solBoard || !solStock || !solWaste || !solTableau) return;

  solRenderStock();
  solRenderWaste();
  solFoundationSlots.forEach((slot) => {
    solRenderFoundationSlot(slot, slot.getAttribute("data-sol-foundation"));
  });
  solSyncChildren(
    solTableau,
    solState.tableau.map((column, colIndex) => solRenderTableauColumn(column, colIndex))
  );

  if (solMoves) {
    setSevenSegmentCounter(solMoves, formatSevenSegmentCounter(solState.moves));
  }
  if (solStatus) solSetText(solStatus, "");
  solRenderToolbar();
};

const solRenderToolbar = () => {
  const solving = Boolean(solAutoSolveRun);
  const showAutoSolve = solving || solCanAutoSolve(solState);
  const completes =
    showAutoSolve &&
    (solving ? solAutoSolveRun.completes : solCachedAutoSolvePlan(solState).completes);
  if (solReset) solReset.hidden = showAutoSolve;
  if (solAutoSolve) {
    solAutoSolve.hidden = !showAutoSolve;
    solAutoSolve.disabled = solving;
    solAutoSolve.classList.toggle("is-completing", completes);
    solSetAttribute(
      solAutoSolve,
      "aria-label",
      completes ? "Auto-solve and win the game" : "Auto-solve visible cards"
    );
  }
  if (solUndo) solUndo.disabled = solving || solState.won || solHistory.length === 0;
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

const solPrefersReducedMotion = prefersReducedMotion;

const solBoardRelativeRect = (element) => {
  const boardRect = solBoard.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left - boardRect.left + solBoard.scrollLeft,
    top: rect.top - boardRect.top + solBoard.scrollTop,
    width: rect.width,
    height: rect.height,
  };
};

const solFoundationSlot = (suit) =>
  Array.from(solFoundationSlots).find(
    (slot) => slot.getAttribute("data-sol-foundation") === suit
  );

const solAutoSolveSourceElement = (move, card) => {
  if (move.zone === "tableau") {
    return solTableau.querySelector(
      `[data-sol-col="${move.pile}"] [data-sol-card-id="${card.id}"]`
    );
  }
  return solWaste.querySelector(`[data-sol-card-id="${card.id}"]`);
};

const solCreateFlyingCard = (card, from) => {
  const flyer = document.createElement("span");
  flyer.className = "sol-card sol-flying-card";
  flyer.setAttribute("aria-hidden", "true");
  flyer.style.left = `${from.left}px`;
  flyer.style.top = `${from.top}px`;
  solApplyCardSprite(flyer, card.rank - 1, solSuitOrder.indexOf(card.suit));
  return flyer;
};

const solAnimateFlight = (flyer, { dx, dy, liftMs, snapMs, height }) => {
  const landed = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
  if (typeof flyer.animate !== "function") {
    flyer.style.translate = landed;
    return;
  }
  const liftY = -Math.max(8, Math.round(height * 0.14));
  const grounded = "drop-shadow(0 0 0 rgba(0, 0, 0, 0))";
  const lifted = "drop-shadow(0 14px 10px rgba(0, 0, 0, 0.45))";
  flyer.animate(
    [
      {
        translate: "0 0",
        scale: "1",
        filter: grounded,
        easing: "cubic-bezier(0.2, 0.7, 0.4, 1)",
      },
      {
        translate: `0 ${liftY}px`,
        scale: "1.07",
        filter: lifted,
        offset: liftMs / (liftMs + snapMs),
        easing: "cubic-bezier(0.6, 0, 1, 0.4)",
      },
      { translate: landed, scale: "1", filter: grounded },
    ],
    { duration: liftMs + snapMs, fill: "forwards" }
  );
};

const solImpactSoundSource = "assets/solitaire-cards/hero-parry.mp3";

const solImpactSoundPoolSize = 4;

let solImpactSoundPool = [];

let solImpactSoundIndex = 0;

const solPrepareImpactSound = () => {
  if (solImpactSoundPool.length || typeof Audio !== "function") return;
  solImpactSoundPool = Array.from({ length: solImpactSoundPoolSize }, () => {
    const audio = new Audio(solImpactSoundSource);
    audio.preload = "auto";
    audio.load();
    return audio;
  });
};

const solPlayImpactSound = () => {
  solPrepareImpactSound();
  const audio = solImpactSoundPool[solImpactSoundIndex];
  if (!audio) return;
  solImpactSoundIndex = (solImpactSoundIndex + 1) % solImpactSoundPool.length;
  try {
    audio.currentTime = 0;
  } catch (error) {
    // Seeking before metadata is ready is harmless; play still starts at 0.
  }
  const playRequest = audio.play();
  if (playRequest && typeof playRequest.catch === "function") {
    playRequest.catch(() => {});
  }
};

const solFlashFoundation = (suit) => {
  const slot = solFoundationSlot(suit);
  if (!slot) return;
  const rect = solBoardRelativeRect(slot);
  const flash = document.createElement("span");
  flash.className = "sol-foundation-flash";
  flash.setAttribute("aria-hidden", "true");
  flash.style.left = `${rect.left}px`;
  flash.style.top = `${rect.top}px`;
  flash.style.width = `${rect.width}px`;
  flash.style.height = `${rect.height}px`;
  const remove = () => flash.remove();
  flash.addEventListener("animationend", remove, { once: true });
  window.setTimeout(remove, 600);
  solBoard.appendChild(flash);
};

const solCancelWindowImpact = () => {
  if (!solWindowImpact) return;
  solWindowImpact.cancel();
  solWindowImpact = null;
};

const solImpactWindow = (dx, dy) => {
  const win = solBoard.closest(".app-window");
  if (!win || typeof win.animate !== "function" || solPrefersReducedMotion()) return;
  const length = Math.hypot(dx, dy) || 1;
  const push = 12;
  const pushX = (dx / length) * push;
  const pushY = (dy / length) * push;
  const shift = (x, y) => `${x.toFixed(2)}px ${y.toFixed(2)}px`;
  solCancelWindowImpact();
  solWindowImpact = win.animate(
    [
      { translate: shift(0, 0) },
      { translate: shift(pushX, pushY), offset: 0.22 },
      { translate: shift(-pushX * 0.35, -pushY * 0.35), offset: 0.62 },
      { translate: shift(0, 0) },
    ],
    { duration: 280, easing: "ease-out", composite: "add" }
  );
  solWindowImpact.addEventListener("finish", () => {
    if (solWindowImpact?.playState === "finished") solWindowImpact = null;
  });
};

/**
 * Updates only the source card and the destination pile after a landing. A
 * full render is reserved for the cases that change more of the board: a
 * waste source, a column that empties, or a newly flipped card.
 */
const solRenderLanding = (move, card, flipped) => {
  const column = move.zone === "tableau" ? solState.tableau[move.pile] : null;
  const columnEl = column && solTableau.querySelector(`[data-sol-col="${move.pile}"]`);
  const cardEl = columnEl?.querySelector(`[data-sol-card-id="${card.id}"]`);
  const slot = solFoundationSlot(move.suit);
  if (!column?.length || flipped || !cardEl || !slot) {
    solRender();
    return;
  }
  cardEl.remove();
  solRenderFoundationSlot(slot, move.suit);
  if (solMoves) {
    setSevenSegmentCounter(solMoves, formatSevenSegmentCounter(solState.moves));
  }
  solRenderToolbar();
};

const solLandAutoSolveCard = (run, move, card, flight) => {
  run.flyer?.remove();
  run.flyer = null;
  const { flipped } = solApplyAutoSolveMove(solState, move);
  solState.moves += 1;
  solRenderLanding(move, card, flipped);
  solFlashFoundation(move.suit);
  solPlayImpactSound();
  solImpactWindow(flight.dx, flight.dy);
};

const solFinishAutoSolve = (run) => {
  if (run !== solAutoSolveRun) return;
  solAutoSolveRun = null;
  solBoard.classList.remove("is-auto-solving");
  solCheckWin();
  solRender();
};

const solRunAutoSolveStep = (run) => {
  if (run !== solAutoSolveRun) return;
  const move = solNextAutoSolveMove(solState);
  if (!move) {
    solFinishAutoSolve(run);
    return;
  }

  const card =
    move.zone === "tableau"
      ? solState.tableau[move.pile][move.index]
      : solState.waste[move.index];
  const intervalMs = solAutoSolveIntervalMs(run.step);
  const { liftMs, snapMs } = solAutoSolvePhaseMs(intervalMs);
  const sourceCard = solAutoSolveSourceElement(move, card);
  const source = sourceCard || (move.zone === "tableau" ? solTableau : solWaste);
  const target = solFoundationSlot(move.suit);
  const from = solBoardRelativeRect(source);
  const to = solBoardRelativeRect(target || source);
  const flight = { dx: to.left - from.left, dy: to.top - from.top };

  sourceCard?.classList.add("is-auto-solve-lifted");
  run.flyer = solCreateFlyingCard(card, from);
  solBoard.appendChild(run.flyer);
  solAnimateFlight(run.flyer, { ...flight, liftMs, snapMs, height: from.height });

  run.timer = window.setTimeout(() => {
    if (run !== solAutoSolveRun) return;
    solLandAutoSolveCard(run, move, card, flight);
    run.step += 1;
    run.timer = window.setTimeout(
      () => solRunAutoSolveStep(run),
      Math.max(0, intervalMs - liftMs - snapMs)
    );
  }, liftMs + snapMs);
};

const solCancelAutoSolve = () => {
  const run = solAutoSolveRun;
  if (!run) return;
  solAutoSolveRun = null;
  window.clearTimeout(run.timer);
  run.flyer?.remove();
  solBoard
    ?.querySelectorAll(".sol-flying-card, .sol-foundation-flash")
    .forEach((element) => element.remove());
  solBoard?.classList.remove("is-auto-solving");
  solCancelWindowImpact();
  solRender();
};

const solStartAutoSolve = () => {
  if (!solBoard || solAutoSolveRun || solState.won) return false;
  const plan = solCachedAutoSolvePlan(solState);
  if (!plan.moves.length) return false;
  solState.selected = null;
  solLastCardClick = null;
  solHideTableauTooltip();
  if (!solState.presentation) ensureSolitaireStatsSession();
  solPushUndo();
  solPrepareImpactSound();
  solAutoSolveRun = { step: 0, timer: null, flyer: null, completes: plan.completes };
  solBoard.classList.add("is-auto-solving");
  solRender();
  solRunAutoSolveStep(solAutoSolveRun);
  return true;
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
  ensureSolitaireStatsSession();
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
    ensureSolitaireStatsSession();
    const card = solState.stock.pop();
    card.faceUp = true;
    solState.waste.push(card);
    solState.moves += 1;
  } else if (solState.waste.length) {
    solPushUndo();
    ensureSolitaireStatsSession();
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
  const deal = solBuildWinnableDeal();

  solCancelAutoSolve();
  solState.presentation = null;
  solState.stock = deal.stock;
  solState.waste = [];
  solState.foundations = {
    spades: [],
    clubs: [],
    diamonds: [],
    hearts: [],
  };
  solState.tableau = deal.tableau;
  solState.selected = null;
  solState.moves = 0;
  solState.won = false;
  solState.statsSession = "";
  solHistory.length = 0;
  solLastCardClick = null;
  solHideVictoryVideo();
  solBoardReady = true;

  solRender();
};

/**
 * Stage a presentation-only board: four face-up King-to-Ace runs with nothing
 * left in the stock, so the auto-solve control is ready to play the win.
 * Presentation wins never publish statistics or trigger random events.
 */
const solStagePresentationWin = ({ visualEffects = true } = {}) => {
  solCancelAutoSolve();
  solState.presentation = { visualEffects: Boolean(visualEffects) };
  solState.stock = [];
  solState.waste = [];
  solState.foundations = {
    spades: [],
    clubs: [],
    diamonds: [],
    hearts: [],
  };
  solState.tableau = solBuildPresentationTableau();
  solState.selected = null;
  solState.moves = 0;
  solState.won = false;
  solState.statsSession = "";
  solHistory.length = 0;
  solLastCardClick = null;
  solHideVictoryVideo();
  solBoardReady = true;

  solRender();
};

/**
 * The board is dealt on the first real open rather than at startup: a
 * solver-checked deal is the most expensive thing this feature does, and a
 * visitor who never opens Solitaire should never pay for it. A staged Admin
 * presentation counts as a board, so opening the window never replaces one.
 */
const solEnsureBoard = () => {
  if (solBoardReady) return false;
  solNewGame();
  return true;
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
    if (solAutoSolveRun) return;
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
        clickTime - solLastCardClick.time <= SOLITAIRE_DOUBLE_CLICK_WINDOW_MS
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

if (solHelp) {
  solHelp.addEventListener("click", () => {
    setWindowOpen("solitaire-rules", true);
  });
}

if (solReset) {
  solReset.addEventListener("click", solNewGame);
}

if (solAutoSolve) {
  solAutoSolve.addEventListener("click", () => {
    solStartAutoSolve();
  });
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
    notifyActivity("newTabLink", {
      href: "https://en.wikipedia.org/wiki/Klondike_(solitaire)",
      source: "solitaire-rules",
    });
    window.open("https://en.wikipedia.org/wiki/Klondike_(solitaire)", "_blank", "noopener,noreferrer");
  });
}

registerWindowLifecycle("solitaire", {
  // Before the window is shown, not after: the manager measures the window to
  // place it, so the board has to hold its cards by then or the first open
  // would be positioned as if Solitaire were empty.
  beforeOpen: () => {
    solEnsureBoard();
  },
  onClose: () => {
    solCancelAutoSolve();
    solHideVictoryVideo();
  },
});

const ensureSolitaireStatsSession = () => {
  if (solState.statsSession) return;
  solState.statsSession = startGameStatsSession("solitaire", {});
};

window.homeSolitaire = Object.freeze({
  SOLITAIRE_RANDOM_EVENT_CLICK_TRIGGER_INTERVAL,
  solCancelAutoSolve,
  solHideVictoryVideo,
  solStagePresentationWin,
  solStartFireworks,
  solState,
});
})();
