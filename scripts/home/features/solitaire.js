(() => {
const {
  loadDeferredMedia,
} = window.homeActivation;
const {
  createGameStatsHooks,
} = window.homeGameStats;
const {
  flashBanner,
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
const {
  createBudget,
} = window.homeGameRules;
const solRules = window.homeSolitaireRules;

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

const solStats = createGameStatsHooks("solitaire", solState);

/**
 * The rule engine's view of the board on screen. `solState` is what the cards
 * are drawn from; this is what decides whether a move is legal and what applies
 * it, so the board a player sees and the board a verifier replays are the same
 * board. It also carries the bounded undo stack, which is why there is no
 * separate history array any more.
 */
let solGame = null;

/** The board `solGame` was last projected from. See `solEngineGame`. */
let solGameSignature = "";

/**
 * The move count at that projection. The plan signature leaves it out on
 * purpose — a move count alone can never change what the auto-solve run would
 * play — so it is tracked here, where a staged board's own count matters.
 */
let solGameMoves = 0;

/** One interactive move costs a handful of primitive steps; this is generous. */
const SOLITAIRE_MOVE_WORK = 1024;

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

/**
 * Everything a plan depends on: which cards are where, face up or down, and how
 * far each foundation has come. Building it is far cheaper than replanning, and
 * reading the live cards is what makes both caches that use it safe — a direct
 * `solState` edit, an undo restore or a test bridge invalidates them without
 * announcing itself, because the signature it produces no longer matches.
 */
const solAutoSolveSignature = (state) => {
  const pile = (cards) =>
    (cards || []).map((card) => `${card.id}${card.faceUp ? ">" : "<"}`).join(",");
  return [
    state.won ? "won" : "live",
    pile(state.stock),
    solSuitOrder.map((suit) => (state.foundations?.[suit] || []).length).join(","),
    pile(state.waste),
    ...(state.tableau || []).map(pile),
  ].join("|");
};

/**
 * The engine state for the board on screen, rebuilt from the cards whenever
 * something changed them without going through a move: an Admin preset, a
 * staged fixture, a reset. A board the engine did not deal cannot carry
 * verified provenance, so rebuilding also abandons the pending attempt.
 */
const solEngineGame = () => {
  const signature = solAutoSolveSignature(solState);
  if (solGame && solGameSignature === signature && solGameMoves === solState.moves) {
    return solGame;
  }
  solGame = solRules.fromBoard(solState);
  solGameSignature = signature;
  solGameMoves = solGame.moves;
  solStats.dropSession();
  return solGame;
};

/** Writes the engine's board back onto the cards the renderer reads. */
const solProjectEngineGame = () => {
  const board = solRules.toBoard(solGame);
  solState.stock = board.stock;
  solState.waste = board.waste;
  solState.foundations = board.foundations;
  solState.tableau = board.tableau;
  solState.moves = board.moves;
  solState.won = board.won;
  solGameSignature = solAutoSolveSignature(solState);
  solGameMoves = board.moves;
};

/**
 * Takes the board on screen as the engine's state. New Game, Reset and the Admin
 * presentation boards all write the cards directly, so this is where such a board
 * is validated — and where it loses any pending verified issuance, because a
 * board the server did not issue cannot produce a verified result.
 */
const solAdoptStagedBoard = () => {
  solGame = solRules.fromBoard(solState);
  solAdoptEngineGame();
};

/** Shows whatever `solGame` now holds: a fresh board has no selection or plan. */
const solAdoptEngineGame = () => {
  solState.selected = null;
  solAutoSolvePlanCache = null;
  solProjectEngineGame();
};

/**
 * Plays one move. The engine decides legality, applies it, and the recorded
 * input is what a verifier replays, so nothing can reach the board without
 * entering the replay. Returns false when the move was not available.
 */
const solPlay = (action, { render = true } = {}) => {
  const game = solEngineGame();
  if (!solRules.canApply(game, action)) return false;
  const wasWon = game.won;
  if (!solState.presentation) ensureSolitaireStatsSession();
  solRules.transition(game, action, createBudget(SOLITAIRE_MOVE_WORK));
  if (!solState.presentation) solStats.recordInput(action);
  solProjectEngineGame();
  solState.selected = null;
  solCheckWin(wasWon);
  if (render) solRender();
  return true;
};

const solCanUndo = () => solEngineGame().undo.length > 0;

/** `planAutoSolveBoard`, recomputed only when the board can have changed. */
let solAutoSolvePlanCache = null;

const solCachedAutoSolvePlan = (state) => {
  const signature = solAutoSolveSignature(state);
  if (solAutoSolvePlanCache?.signature === signature) {
    return solAutoSolvePlanCache.plan;
  }
  const plan = solRules.planAutoSolveBoard(state);
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
  flashBanner(solAchievement);
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

/**
 * The server derives the move count from the replay, so the finished board's
 * counter is reconciled to that number when it comes back. A board that has
 * since been reset, undone or replaced is left alone: the official metric
 * belongs to the deal it was derived from, not to whatever is on screen now.
 */
const solFinishedMetricOptions = (finished) => ({
  onCanonicalMetric: ({ metric }) => {
    if (solGame !== finished || !solState.won) return;
    if (!Number.isSafeInteger(metric) || metric < 0) return;
    finished.moves = metric;
    solProjectEngineGame();
    if (solMoves) {
      setSevenSegmentCounter(solMoves, formatSevenSegmentCounter(solState.moves));
    }
  },
});

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
  solStats.recordEvent({
    type: "win",
    metric: solRules.result(solGame).moves,
  }, solFinishedMetricOptions(solGame));
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
  if (solUndo) solUndo.disabled = solving || solState.won || !solCanUndo();
};

/**
 * Announces a victory the moment one happens, and only then. The board on screen
 * is written from the engine before this runs, so whether the deal was already
 * won is something the caller knows and this cannot look up.
 */
const solCheckWin = (wasWon = solState.won) => {
  const foundationCount = solSuitOrder.reduce(
    (total, suit) => total + solState.foundations[suit].length,
    0
  );
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

/** Whether landing `move` will turn over the card it uncovers. */
const solMoveUncoversCard = (move) => {
  if (move.zone !== "tableau") return false;
  const column = solState.tableau[move.pile];
  const below = column[column.length - 2];
  return Boolean(below && !below.faceUp);
};

const solLandAutoSolveCard = (run, move, card, flight) => {
  run.flyer?.remove();
  run.flyer = null;
  const flipped = solMoveUncoversCard(move);
  solPlay(move.action, { render: false });
  solRenderLanding(move, card, flipped);
  solFlashFoundation(move.suit);
  solPlayImpactSound();
  solImpactWindow(flight.dx, flight.dy);
};

/** Closes the engine's run, so one undo snapshot covers the whole animation. */
const solEndAutoRun = () => {
  if (solGame?.autoRun) solPlay({ op: "autoRunEnd" }, { render: false });
};

const solFinishAutoSolve = (run) => {
  if (run !== solAutoSolveRun) return;
  solAutoSolveRun = null;
  solBoard.classList.remove("is-auto-solving");
  solEndAutoRun();
  solCheckWin();
  solRender();
};

const solRunAutoSolveStep = (run) => {
  if (run !== solAutoSolveRun) return;
  const move = solRules.boardFoundationMove(solState);
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
  solEndAutoRun();
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
  if (!solPlay({ op: "autoRunStart" }, { render: false })) return false;
  solPrepareImpactSound();
  solAutoSolveRun = { step: 0, timer: null, flyer: null, completes: plan.completes };
  solBoard.classList.add("is-auto-solving");
  solRender();
  solRunAutoSolveStep(solAutoSolveRun);
  return true;
};

const solIsPackedTableauStack = (cards) =>
  cards.length > 0 &&
  cards.every((card) => card.faceUp) &&
  solRules.isPackedRun(cards.map((card) => card.id));

/** The engine action a selected pile-to-pile move stands for, or null. */
const solSelectedTableauAction = (colIndex) => {
  const selected = solState.selected;
  if (!selected) return null;
  if (selected.zone === "waste") return { op: "wasteToTableau", to: colIndex };
  if (selected.zone === "foundation") {
    return { op: "foundationToTableau", suit: selected.pile, to: colIndex };
  }
  if (selected.zone !== "tableau") return null;
  const column = solState.tableau[selected.pile];
  const faceDown = column.filter((card) => !card.faceUp).length;
  return {
    op: "tableauToTableau",
    from: selected.pile,
    index: selected.index - faceDown,
    to: colIndex,
  };
};

/** The engine action a selected single card moving to a foundation stands for. */
const solSelectedFoundationAction = (suit) => {
  const selected = solState.selected;
  if (!selected || selected.cards.length !== 1) return null;
  if (selected.cards[0].suit !== suit) return null;
  if (selected.zone === "waste") return { op: "wasteToFoundation" };
  if (selected.zone === "tableau") return { op: "tableauToFoundation", from: selected.pile };
  return null;
};

const solMoveSelectedToTableau = (colIndex) => {
  const selected = solState.selected;
  if (!selected) return false;
  if (selected.zone === "tableau" && selected.pile === colIndex) return false;
  const action = solSelectedTableauAction(colIndex);
  return Boolean(action) && solPlay(action);
};

const solMoveSelectedToFoundation = (suit) => {
  const action = solSelectedFoundationAction(suit);
  return Boolean(action) && solPlay(action);
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

/** One click draws, or redeals the waste once the stock has run out. */
const solDraw = () => {
  solState.selected = null;
  if (!solPlay({ op: "draw" }) && !solPlay({ op: "redeal" })) solRender();
};

/** Invalidated by every new board, so a stale issuance cannot land on it. */
let solIssueToken = 0;

/**
 * Asks for the server's board for this deal. A verified result has to bind the
 * state the server issued, so the issued board replaces the local one — but only
 * while nothing has been played on it. Once a move has been made the deal on
 * screen is the player's own, and the attempt stays local rather than having the
 * board change underneath them. Every column keeps its depth either way, so the
 * window the manager has already measured never changes size.
 */
const solRequestIssuedBoard = () => {
  if (solState.presentation || solStats.hasIssuedGame()) return;
  const token = (solIssueToken += 1);
  const pending = solStats.issueGame({});
  if (!pending) return;
  Promise.resolve(pending).then((descriptor) => {
    if (!descriptor || token !== solIssueToken) return;
    if (solState.presentation || solAutoSolveRun) return;
    if (solGame.moves || solGame.undo.length) return;
    solGame = solRules.initial(descriptor.initial);
    solAdoptEngineGame();
    solRender();
  }, () => {
    // An attempt that could not be issued is still playable; it simply stays
    // local, exactly as it does with no backend configured at all.
  });
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
  solStats.dropSession();
  solAdoptStagedBoard();
  solLastCardClick = null;
  solHideVictoryVideo();
  solBoardReady = true;

  solRender();
  solRequestIssuedBoard();
};

/**
 * Stage a presentation-only board: four face-up King-to-Ace runs with nothing
 * left in the stock, so the auto-solve control is ready to play the win.
 * Presentation wins never request a session, publish statistics, record a replay
 * or trigger random events.
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
  solStats.dropSession();
  solAdoptStagedBoard();
  solLastCardClick = null;
  solHideVictoryVideo();
  solBoardReady = true;

  solRender();
};

/** Deals once before first open; staged Admin boards already count as ready. */
const solEnsureBoard = () => {
  if (solBoardReady) return false;
  solNewGame();
  return true;
};

/**
 * The double-click shortcut: send a visible card straight to its foundation.
 * Only the top of the waste or the top of a column can go, which is exactly
 * what the engine will accept, so an impossible double click selects nothing.
 */
const solAutoMoveCardToFoundation = (zone, pile, index) => {
  const source = zone === "tableau" ? solState.tableau[pile] : solState.waste;
  if (!source || index !== source.length - 1) return;
  const card = source[index];
  if (!card || !card.faceUp) return;
  const action = zone === "tableau"
    ? { op: "tableauToFoundation", from: pile }
    : { op: "wasteToFoundation" };
  if (!solPlay(action)) solRender();
};

if (solBoard) {
  solBoard.addEventListener("click", (event) => {
    if (solAutoSolveRun || solState.won) return;
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
    if (solState.won) return;
    if (!solPlay({ op: "undo" })) return;
    if (!solState.won) solHideVictoryVideo();
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
  // Populate the board before the window manager measures it for placement.
  beforeOpen: () => {
    solEnsureBoard();
  },
  onClose: () => {
    solCancelAutoSolve();
    solHideVictoryVideo();
  },
});

const ensureSolitaireStatsSession = () => {
  solStats.ensureSession({});
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
