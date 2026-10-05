import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStandardDeal,
  attemptCap,
  buildDeal,
  buildShuffledDeal,
  findWinningMoves,
  generationNodeBudget,
  nodeBudget,
  replaySolution,
  seededRandom,
  serializeDeal,
} from "../helpers/solitaire-deals.mjs";

// Keep the complete statistical corpus out of the fast suite. CI runs this
// separate tier before either deployment can proceed.
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

