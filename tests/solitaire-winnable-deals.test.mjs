import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const mainSource = await readFile(new URL("scripts/home/main.js", root), "utf8");
const homeSource = await readFile(new URL("home.html", root), "utf8");

const sourceSection = (start, end) => {
  const startIndex = mainSource.indexOf(start);
  const endIndex = mainSource.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return mainSource.slice(startIndex, endIndex);
};

const dealFactory = new Function(`
  ${sourceSection("const solSuitOrder =", "const solRankNames =")}
  ${sourceSection("const solBuildDeck =", "const solCloneCards =")}
  return {
    solBuildWinnableDeal,
    solDealAttemptCap,
    solDealShuffledDeck,
    solFindWinningMoves,
    solGenerationNodeBudget,
    solSolverNodeBudget,
  };
`);
const {
  solBuildWinnableDeal: buildDeal,
  solDealAttemptCap: attemptCap,
  solDealShuffledDeck: buildShuffledDeal,
  solFindWinningMoves: findWinningMoves,
  solGenerationNodeBudget: generationNodeBudget,
  solSolverNodeBudget: nodeBudget,
} = dealFactory();
const suits = ["spades", "clubs", "diamonds", "hearts"];

const seededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const cloneDeal = (deal) => ({
  stock: deal.stock.map((card) => ({ ...card })),
  waste: [],
  tableau: deal.tableau.map((column) => column.map((card) => ({ ...card }))),
  foundations: Object.fromEntries(suits.map((suit) => [suit, []])),
});

const color = (card) =>
  card.suit === "diamonds" || card.suit === "hearts" ? "red" : "black";

const assertPackedRun = (cards) => {
  assert.ok(cards.length > 0);
  assert.ok(cards.every((card) => card.faceUp));
  for (let index = 0; index < cards.length - 1; index += 1) {
    assert.notEqual(color(cards[index]), color(cards[index + 1]));
    assert.equal(cards[index].rank, cards[index + 1].rank + 1);
  }
};

const assertTableauTarget = (cards, column) => {
  assertPackedRun(cards);
  const target = column.at(-1);
  if (!target) {
    assert.equal(cards[0].rank, 13);
    return;
  }
  assert.equal(target.faceUp, true);
  assert.notEqual(color(cards[0]), color(target));
  assert.equal(cards[0].rank + 1, target.rank);
};

const assertFoundationTarget = (state, card) => {
  assert.equal(card.rank, state.foundations[card.suit].length + 1);
};

const flipTableauTop = (column) => {
  if (column.length && !column.at(-1).faceUp) column.at(-1).faceUp = true;
};

const reachStockCard = (state, cardId) => {
  const remaining = state.stock.length + state.waste.length;
  let actions = 0;
  while (state.waste.at(-1)?.id !== cardId) {
    if (state.stock.length) {
      const card = state.stock.pop();
      card.faceUp = true;
      state.waste.push(card);
    } else {
      assert.ok(state.waste.some((card) => card.id === cardId));
      state.stock = state.waste.reverse().map((card) => {
        card.faceUp = false;
        return card;
      });
      state.waste = [];
    }
    actions += 1;
    assert.ok(actions <= remaining * 2 + 1, `${cardId} was not reachable`);
  }
};

const replaySolution = (deal, solution) => {
  const state = cloneDeal(deal);
  solution.forEach((move) => {
    if (move.from === "stock") reachStockCard(state, move.cardId);
    if (move.type === "toFoundation") {
      if (move.from === "stock") {
        const card = state.waste.pop();
        assert.equal(card.id, move.cardId);
        assertFoundationTarget(state, card);
        state.foundations[card.suit].push(card);
        return;
      }
      assert.equal(move.from, "tableau");
      const column = state.tableau[move.column];
      const card = column.pop();
      assert.equal(card.faceUp, true);
      assertFoundationTarget(state, card);
      state.foundations[card.suit].push(card);
      flipTableauTop(column);
      return;
    }
    assert.equal(move.type, "toTableau");
    if (move.from === "stock") {
      const card = state.waste.pop();
      assert.equal(card.id, move.cardId);
      const target = state.tableau[move.column];
      assertTableauTarget([card], target);
      target.push(card);
      return;
    }
    assert.equal(move.from, "tableau");
    const source = state.tableau[move.column];
    const moving = source.slice(move.index);
    assertTableauTarget(moving, state.tableau[move.toColumn]);
    state.tableau[move.toColumn].push(...source.splice(move.index));
    flipTableauTop(source);
  });

  assert.equal(state.stock.length + state.waste.length, 0);
  assert.ok(state.tableau.every((column) => column.length === 0));
  suits.forEach((suit) => {
    assert.deepEqual(
      state.foundations[suit].map((card) => card.rank),
      Array.from({ length: 13 }, (_, index) => index + 1)
    );
  });
};

const assertStandardDeal = (deal) => {
  assert.deepEqual(deal.tableau.map((column) => column.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(deal.stock.length, 24);
  assert.ok(deal.stock.every((card) => !card.faceUp));
  deal.tableau.forEach((column) => {
    assert.ok(column.slice(0, -1).every((card) => !card.faceUp));
    assert.equal(column.at(-1).faceUp, true);
  });
  const allCards = [...deal.stock, ...deal.tableau.flat()];
  assert.equal(allCards.length, 52);
  assert.equal(new Set(allCards.map((card) => card.id)).size, 52);
  assert.deepEqual(
    allCards.map(({ id, rank, suit }) => ({ id, rank, suit })).sort((a, b) => a.id.localeCompare(b.id)),
    suits.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({
      id: `${suit}-${index + 1}`,
      rank: index + 1,
      suit,
    }))).sort((a, b) => a.id.localeCompare(b.id))
  );
};

const serializeDeal = (deal) => JSON.stringify({
  stock: deal.stock.map((card) => card.id),
  tableau: deal.tableau.map((column) => column.map((card) => card.id)),
});

const seededDeals = Array.from({ length: 500 }, (_, seed) =>
  buildDeal(seededRandom(seed))
);

test("Solitaire creates complete standard random deals", () => {
  [buildDeal(() => 0), buildDeal(() => 1 - Number.EPSILON), ...seededDeals]
    .forEach(assertStandardDeal);
});

test("verified Solitaire solutions replay through independent rules", () => {
  seededDeals.forEach((deal) => {
    if (deal.verified) replaySolution(deal, deal.solution);
  });
});

test("the bounded solver verifies enough uniformly shuffled deals", () => {
  let firstShuffleWins = 0;
  let cappedWins = 0;
  for (let seed = 0; seed < 500; seed += 1) {
    if (findWinningMoves(buildShuffledDeal(seededRandom(seed)), nodeBudget)) firstShuffleWins += 1;
    if (seededDeals[seed].verified) cappedWins += 1;
  }
  assert.ok(firstShuffleWins >= 300, `${firstShuffleWins}/500 first deals verified`);
  assert.ok(cappedWins >= 480, `${cappedWins}/500 capped deals verified`);
  assert.equal(nodeBudget, 12_000);
  assert.equal(generationNodeBudget, 40_000);
  assert.equal(attemptCap, 12);
});

test("exhausted Solitaire generation returns a bounded standard fallback", () => {
  const startedAt = performance.now();
  const deal = buildDeal(() => 0);
  const elapsed = performance.now() - startedAt;
  assertStandardDeal(deal);
  assert.equal(deal.verified, false);
  assert.equal(deal.solution, null);
  assert.ok(elapsed < 500, `constant shuffle completed in ${elapsed.toFixed(2)} ms`);
});

test("Solitaire deal generation is deterministic, diverse, and random-looking", () => {
  assert.deepEqual(buildDeal(seededRandom(8675309)), buildDeal(seededRandom(8675309)));
  assert.ok(new Set(seededDeals.slice(0, 128).map(serializeDeal)).size >= 120);
  const longColumns = seededDeals.slice(0, 200).flatMap((deal) =>
    deal.tableau.filter((column) => column.length >= 3));
  const sameSuitRuns = longColumns.filter((column) => column.every((card, index) =>
    !index || (card.suit === column[0].suit && column[index - 1].rank === card.rank + 1)
  ));
  assert.ok(sameSuitRuns.length / longColumns.length < 0.05);
});

test("New Game installs only the generated stock and tableau", () => {
  const newGameSource = sourceSection("const solNewGame = () => {", "const solAutoMoveCardToFoundation =");
  assert.match(newGameSource, /const deal = solBuildWinnableDeal\(\);/);
  assert.match(newGameSource, /solState\.stock = deal\.stock;/);
  assert.match(newGameSource, /solState\.tableau = deal\.tableau;/);
  assert.doesNotMatch(newGameSource, /deal\.(solution|verified)/);
});

test("Solitaire rules state the solver check and unlimited redeals", () => {
  assert.match(homeSource, /Every new deal is a random shuffle that a built-in solver has checked for at least one winning path with draw-one stock and unlimited redeals\./);
  assert.match(homeSource, /You can redeal as often as needed\./);
});
