import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const mainSource = await readFile(
  new URL("scripts/home/main.js", root),
  "utf8"
);
const homeSource = await readFile(new URL("home.html", root), "utf8");

const sourceSection = (start, end) => {
  const startIndex = mainSource.indexOf(start);
  const endIndex = mainSource.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return mainSource.slice(startIndex, endIndex);
};

const buildDealFactory = new Function(`
  ${sourceSection("const solSuitOrder =", "const solRankNames =")}
  ${sourceSection("const solBuildDeck =", "const solCloneCards =")}
  return solBuildWinnableDeal;
`);
const buildDeal = buildDealFactory();
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
  tableau: deal.tableau.map((column) =>
    column.map((card) => ({ ...card }))
  ),
  foundations: Object.fromEntries(suits.map((suit) => [suit, []])),
});

const assertStandardDeal = (deal) => {
  assert.deepEqual(
    deal.tableau.map((column) => column.length),
    [1, 2, 3, 4, 5, 6, 7]
  );
  assert.equal(deal.stock.length, 24);
  assert.ok(deal.stock.every((card) => !card.faceUp));

  deal.tableau.forEach((column) => {
    assert.ok(column.length > 0);
    assert.ok(column.slice(0, -1).every((card) => !card.faceUp));
    assert.equal(column.at(-1).faceUp, true);
    assert.ok(column.every((card) => card.suit === column[0].suit));
    for (let index = 1; index < column.length; index += 1) {
      assert.equal(column[index - 1].rank, column[index].rank + 1);
    }
  });

  const allCards = [...deal.stock, ...deal.tableau.flat()];
  assert.equal(allCards.length, 52);
  assert.equal(new Set(allCards.map((card) => card.id)).size, 52);
  assert.deepEqual(
    [...allCards]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, rank, suit }) => ({ id, rank, suit })),
    suits
      .flatMap((suit) =>
        Array.from({ length: 13 }, (_, index) => ({
          id: `${suit}-${index + 1}`,
          rank: index + 1,
          suit,
        }))
      )
      .sort((left, right) => left.id.localeCompare(right.id))
  );
};

const replayFoundationWin = (deal) => {
  const state = cloneDeal(deal);
  let transitions = 0;

  suits.forEach((suit) => {
    for (let rank = 1; rank <= 13; rank += 1) {
      const id = `${suit}-${rank}`;
      const tableauColumn = state.tableau.find(
        (column) => column.at(-1)?.id === id
      );

      if (tableauColumn) {
        const card = tableauColumn.pop();
        assert.equal(card.faceUp, true);
        assert.equal(state.foundations[suit].length + 1, card.rank);
        state.foundations[suit].push(card);
        if (tableauColumn.length) tableauColumn.at(-1).faceUp = true;
        transitions += 1;
        continue;
      }

      let draws = 0;
      while (state.waste.at(-1)?.id !== id) {
        if (state.stock.length) {
          const card = state.stock.pop();
          card.faceUp = true;
          state.waste.push(card);
        } else {
          assert.ok(state.waste.length, `Card ${id} is unreachable`);
          state.stock = state.waste.reverse().map((card) => {
            card.faceUp = false;
            return card;
          });
          state.waste = [];
        }
        draws += 1;
        transitions += 1;
        assert.ok(draws <= 25, `Card ${id} needed more than one stock pass`);
      }

      const card = state.waste.pop();
      assert.equal(card.faceUp, true);
      assert.equal(card.rank, state.foundations[suit].length + 1);
      state.foundations[suit].push(card);
      transitions += 1;
    }
  });

  assert.ok(state.tableau.every((column) => column.length === 0));
  assert.equal(state.stock.length + state.waste.length, 0);
  suits.forEach((suit) => {
    assert.deepEqual(
      state.foundations[suit].map((card) => card.rank),
      Array.from({ length: 13 }, (_, index) => index + 1)
    );
  });
  assert.ok(transitions <= 375);
};

const serializeDeal = (deal) =>
  JSON.stringify({
    stock: deal.stock.map((card) => card.id),
    tableau: deal.tableau.map((column) => column.map((card) => card.id)),
  });

test("Solitaire creates complete standard deals with a legal foundation win", () => {
  const randomStreams = [
    () => 0,
    () => 1 - Number.EPSILON,
    ...Array.from({ length: 2_000 }, (_, seed) => seededRandom(seed)),
  ];

  randomStreams.forEach((random) => {
    const deal = buildDeal(random);
    assertStandardDeal(deal);
    replayFoundationWin(deal);
  });
});

test("Solitaire deal generation is deterministic, diverse, and bounded", () => {
  assert.equal(
    serializeDeal(buildDeal(seededRandom(8675309))),
    serializeDeal(buildDeal(seededRandom(8675309)))
  );

  const distinctDeals = new Set(
    Array.from({ length: 128 }, (_, seed) =>
      serializeDeal(buildDeal(seededRandom(seed)))
    )
  );
  assert.ok(distinctDeals.size >= 120);

  let randomCalls = 0;
  buildDeal(() => {
    randomCalls += 1;
    return 0.5;
  });
  assert.equal(randomCalls, 53);
});

test("New Game installs the guaranteed deal without an unconstrained shuffle", () => {
  const newGameSource = sourceSection(
    "const solNewGame = () => {",
    "const solAutoMoveCardToFoundation ="
  );
  assert.match(newGameSource, /const deal = solBuildWinnableDeal\(\);/);
  assert.match(newGameSource, /solState\.stock = deal\.stock;/);
  assert.match(newGameSource, /solState\.tableau = deal\.tableau;/);
  assert.doesNotMatch(newGameSource, /solShuffle\(solBuildDeck\(\)\)/);
});

test("Solitaire rules state the deal guarantee and unlimited redeals", () => {
  assert.match(
    homeSource,
    /Every new deal has at least one winning path with draw-one stock and unlimited redeals\./
  );
  assert.match(homeSource, /You can redeal as often as needed\./);
});
