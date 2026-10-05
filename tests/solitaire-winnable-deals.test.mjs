import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStandardDeal,
  attemptCap,
  buildDeal,
  generationNodeBudget,
  homeSource,
  nodeBudget,
  replaySolution,
  seededRandom,
  sourceSection,
} from "./helpers/solitaire-deals.mjs";

const smokeDeal = buildDeal(seededRandom(0));

test("Solitaire creates a complete standard random deal", () => {
  assertStandardDeal(smokeDeal);
  assert.equal(nodeBudget, 12_000);
  assert.equal(generationNodeBudget, 40_000);
  assert.equal(attemptCap, 12);
});

test("a verified Solitaire solution replays through independent rules", () => {
  assert.equal(smokeDeal.verified, true);
  replaySolution(smokeDeal, smokeDeal.solution);
});

test("Solitaire generation is deterministic", () => {
  assert.deepEqual(buildDeal(seededRandom(0)), smokeDeal);
});

test("exhausted Solitaire generation returns a bounded standard fallback", () => {
  const startedAt = performance.now();
  const deal = buildDeal(() => 0);
  const elapsed = performance.now() - startedAt;
  assertStandardDeal(deal);
  assert.equal(deal.verified, false);
  assert.equal(deal.solution, null);
  // Locally this takes about 330 ms; shared CI runners have measured over 500 ms,
  // so the bound only guards against the attempt cap failing to bound the search.
  assert.ok(elapsed < 2_000, `constant shuffle completed in ${elapsed.toFixed(2)} ms`);
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
