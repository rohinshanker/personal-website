import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [mainSource, homeSource, styleSource] = await Promise.all([
  readFile(new URL("scripts/home/main.js", root), "utf8"),
  readFile(new URL("home.html", root), "utf8"),
  readFile(new URL("styles/home/apps/solitaire.css", root), "utf8"),
]);

const sourceSection = (start, end) => {
  const startIndex = mainSource.indexOf(start);
  const endIndex = mainSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source boundary: ${end}`);
  return mainSource.slice(startIndex, endIndex);
};

const {
  solAutoSolveIntervalMs,
  solAutoSolvePhaseMs,
  solAutoSolveTiming,
  solBuildPresentationTableau,
  solCanAutoSolve,
  solNextAutoSolveMove,
  solPlanAutoSolve,
} = new Function(`
  ${sourceSection("const solSuitOrder =", "const solRankNames =")}
  ${sourceSection("const solCloneCards =", "const solSnapshot =")}
  ${sourceSection("const solAutoSolveTiming =", "const solShowAchievement =")}
  return {
    solAutoSolveIntervalMs,
    solAutoSolvePhaseMs,
    solAutoSolveTiming,
    solBuildPresentationTableau,
    solCanAutoSolve,
    solNextAutoSolveMove,
    solPlanAutoSolve,
  };
`)();

const suits = ["spades", "clubs", "diamonds", "hearts"];
const color = (card) =>
  card.suit === "diamonds" || card.suit === "hearts" ? "red" : "black";
const emptyFoundations = () => Object.fromEntries(suits.map((suit) => [suit, []]));
const buildState = (overrides = {}) => ({
  stock: [],
  waste: [],
  foundations: emptyFoundations(),
  tableau: solBuildPresentationTableau(),
  won: false,
  ...overrides,
});
const cloneState = (state) => ({
  stock: state.stock.map((card) => ({ ...card })),
  waste: state.waste.map((card) => ({ ...card })),
  foundations: Object.fromEntries(
    suits.map((suit) => [suit, state.foundations[suit].map((card) => ({ ...card }))])
  ),
  tableau: state.tableau.map((column) => column.map((card) => ({ ...card }))),
  won: state.won,
});

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

/**
 * Applies every planned move with an independent rules check: the card must be
 * the exposed tableau top or a waste card, and it must be the next rank of its
 * own foundation.
 */
const replayPlan = (initialState, plan) => {
  const state = cloneState(initialState);
  plan.forEach((move, step) => {
    const source = move.zone === "tableau" ? state.tableau[move.pile] : state.waste;
    if (move.zone === "tableau") {
      assert.equal(move.index, source.length - 1, `Move ${step} must take the exposed card.`);
    }
    const card = source[move.index];
    assert.ok(card, `Move ${step} references a missing card.`);
    assert.equal(card.faceUp, true, `Move ${step} must move a face-up card.`);
    assert.equal(card.suit, move.suit);
    assert.equal(card.rank, move.rank);
    assert.equal(
      state.foundations[card.suit].length + 1,
      card.rank,
      `Move ${step} must be the next foundation rank.`
    );
    source.splice(move.index, 1);
    state.foundations[card.suit].push(card);
  });
  return state;
};

/** Builds a random legal fully-revealed board with packed runs and loose waste. */
const buildRevealedState = (random) => {
  const cards = suits.flatMap((suit) =>
    Array.from({ length: 13 }, (_, index) => ({
      id: `${suit}-${index + 1}`,
      suit,
      rank: index + 1,
      faceUp: true,
    }))
  );
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  const tableau = Array.from({ length: 7 }, () => []);
  const waste = [];
  cards.forEach((card) => {
    const fits = tableau.filter((column) => {
      const top = column[column.length - 1];
      if (!top) return card.rank === 13;
      return color(top) !== color(card) && top.rank === card.rank + 1;
    });
    if (fits.length && random() < 0.8) {
      fits[Math.floor(random() * fits.length)].push(card);
    } else {
      waste.push(card);
    }
  });
  return buildState({ tableau, waste });
};

test("the auto-solve cadence starts at one card per second and accelerates to a floor", () => {
  assert.equal(solAutoSolveTiming.firstIntervalMs, 1000);
  assert.equal(solAutoSolveIntervalMs(0), 1000);
  let previous = solAutoSolveIntervalMs(0);
  let reachedFloor = false;
  for (let step = 1; step < 52; step += 1) {
    const interval = solAutoSolveIntervalMs(step);
    assert.ok(interval >= solAutoSolveTiming.minIntervalMs);
    assert.ok(interval <= previous, `Step ${step} must not slow down.`);
    if (interval === solAutoSolveTiming.minIntervalMs) reachedFloor = true;
    else assert.ok(interval < previous, `Step ${step} must accelerate.`);
    previous = interval;
  }
  assert.ok(reachedFloor, "A full deck must reach the fastest cadence.");

  const phases = solAutoSolvePhaseMs(1000);
  assert.deepEqual(phases, { liftMs: 550, snapMs: 300 });
  assert.ok(phases.liftMs > phases.snapMs, "The float is slower than the snap.");
  assert.ok(phases.liftMs + phases.snapMs < 1000, "Each card lands before the next starts.");
});

test("the presentation tableau is four packed King-to-Ace runs using every card once", () => {
  const tableau = solBuildPresentationTableau();
  assert.equal(tableau.length, 7);
  assert.deepEqual(tableau.slice(4), [[], [], []]);
  const ids = new Set(tableau.flat().map((card) => card.id));
  assert.equal(ids.size, 52);
  tableau.slice(0, 4).forEach((column) => {
    assert.equal(column.length, 13);
    assert.equal(column[0].rank, 13);
    assert.equal(column[12].rank, 1);
    column.forEach((card, index) => {
      assert.equal(card.faceUp, true);
      assert.equal(card.id, `${card.suit}-${card.rank}`);
      if (!index) return;
      const upper = column[index - 1];
      assert.equal(upper.rank, card.rank + 1);
      assert.notEqual(color(upper), color(card));
    });
  });
});

test("a staged presentation board is solvable in 52 non-decreasing moves", () => {
  const state = buildState();
  assert.equal(solCanAutoSolve(state), true);
  const plan = solPlanAutoSolve(state);
  assert.equal(plan.length, 52);
  plan.forEach((move, index) => {
    assert.equal(move.zone, "tableau");
    if (index) assert.ok(move.rank >= plan[index - 1].rank);
  });
  const finished = replayPlan(state, plan);
  suits.forEach((suit) => assert.equal(finished.foundations[suit].length, 13));
  assert.deepEqual(solNextAutoSolveMove(finished), null);
});

test("auto-solve is available only when every card is face-up with an empty stock", () => {
  const faceDown = buildState();
  faceDown.tableau[2][5].faceUp = false;
  assert.equal(solCanAutoSolve(faceDown), false);

  const stocked = buildState();
  stocked.stock.push(stocked.tableau[3].pop());
  assert.equal(solCanAutoSolve(stocked), false);

  const won = buildState({ won: true });
  assert.equal(solCanAutoSolve(won), false);

  const complete = buildState({
    tableau: Array.from({ length: 7 }, () => []),
    foundations: Object.fromEntries(
      suits.map((suit) => [
        suit,
        Array.from({ length: 13 }, (_, index) => ({
          id: `${suit}-${index + 1}`,
          suit,
          rank: index + 1,
          faceUp: true,
        })),
      ])
    ),
  });
  assert.equal(solCanAutoSolve(complete), false);

  const wasted = buildState();
  const lifted = wasted.tableau[0].splice(10, 3);
  wasted.waste = [lifted[0], lifted[2], lifted[1]];
  assert.equal(solCanAutoSolve(wasted), true);
  const plan = solPlanAutoSolve(wasted);
  assert.equal(plan.length, 52);
  const wasteMoves = plan.filter((move) => move.zone === "waste");
  assert.equal(wasteMoves.length, 3);
  assert.deepEqual(
    wasteMoves.map((move) => move.rank),
    [1, 2, 3],
    "Waste cards are taken by rank even when buried."
  );
  replayPlan(wasted, plan);
});

test("every random fully-revealed board with loose waste cards has a complete plan", () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const state = buildRevealedState(seededRandom(seed));
    assert.equal(solCanAutoSolve(state), true, `Seed ${seed} must be solvable.`);
    const plan = solPlanAutoSolve(state);
    assert.equal(plan.length, 52, `Seed ${seed} must land all 52 cards.`);
    const finished = replayPlan(state, plan);
    suits.forEach((suit) => assert.equal(finished.foundations[suit].length, 13));
    assert.equal(solNextAutoSolveMove(state).rank, 1, "The first move is always an Ace.");
  }
});

test("the toolbar swaps Reset for the check icon and the board hosts the flight layers", () => {
  assert.match(
    homeSource,
    /<button class="sol-reset" id="sol-reset" type="button" aria-label="Reset game" title="Reset game">[\s\S]*?<\/button>\s*<button class="sol-auto-solve" id="sol-auto-solve" type="button" aria-label="Auto-solve game" title="Auto-solve game" hidden>\s*<img src="assets\/app-icons\/ico\/check\.ico" alt="" \/>\s*<\/button>/
  );
  assert.match(homeSource, /solitaire\.css\?v=solitaire-auto-solve-20260917/);
  assert.match(styleSource, /\.sol-reset,\n\.sol-undo,\n\.sol-auto-solve \{/);
  assert.match(styleSource, /\.sol-reset\[hidden\],\n\.sol-auto-solve\[hidden\] \{\n  display: none;\n\}/);
  assert.match(
    styleSource,
    /\.sol-reset img,\n\.sol-undo img,\n\.sol-auto-solve img \{[\s\S]*?height: 22px;[\s\S]*?width: 22px;/,
    "The check icon shares the Reset and Undo icon sizing and inset."
  );
  assert.match(styleSource, /\.sol-board \{[\s\S]*?position: relative;/);
  assert.match(styleSource, /\.sol-board\.is-auto-solving \.sol-card,[\s\S]*?pointer-events: none;/);
  assert.match(
    styleSource,
    /\.sol-card\.sol-flying-card \{[\s\S]*?box-shadow: none;[\s\S]*?position: absolute;/
  );
  assert.match(
    styleSource,
    /\.sol-foundation-flash \{[\s\S]*?background: rgba\(255, 255, 255, 0\.96\);\s*border-radius: calc\(var\(--sol-card-w\) \/ 9\);/,
    "The flash is a solid card-shaped box with the card's rounded corners."
  );
  assert.match(
    styleSource,
    /\.sol-foundation-flash \{[\s\S]*?animation: sol-foundation-flash 210ms linear both;/
  );
  assert.match(
    styleSource,
    /@keyframes sol-foundation-flash \{\s*0% \{\s*opacity: 0;\s*\}\s*33\.333% \{\s*opacity: 1;\s*\}\s*100% \{\s*opacity: 0;\s*\}\s*\}/,
    "The flash peaks after one third and fades over the remaining two thirds."
  );
});

test("the runtime blocks input while solving, lands each card before the next, and wins last", () => {
  const gate = sourceSection("const solAutoSolveOffered = () =>", "const solRenderToolbar = () => {");
  assert.match(
    gate,
    /Boolean\(solState\.presentation\) && solCanAutoSolve\(solState\)/,
    "Only Admin-staged boards offer auto-solve during the preview period."
  );
  const toolbar = sourceSection("const solRenderToolbar = () => {", "const solCheckWin = () => {");
  assert.match(toolbar, /const showAutoSolve = solving \|\| solAutoSolveOffered\(\)/);
  assert.match(toolbar, /solReset\.hidden = showAutoSolve/);
  assert.match(toolbar, /solAutoSolve\.hidden = !showAutoSolve/);
  assert.match(toolbar, /solAutoSolve\.disabled = solving/);
  assert.match(toolbar, /solUndo\.disabled = solving \|\| solState\.won \|\| solHistory\.length === 0/);

  const start = sourceSection("const solStartAutoSolve = () => {", "const solFlipSourceTopCard = ");
  assert.match(start, /!solAutoSolveOffered\(\)\) return false/);

  const step = sourceSection("const solRunAutoSolveStep = (run) => {", "const solCancelAutoSolve = () => {");
  assert.match(step, /solAutoSolveIntervalMs\(run\.step\)/);
  assert.match(step, /solAnimateFlight\(run\.flyer/);
  assert.match(step, /\}, liftMs \+ snapMs\);/);
  assert.match(step, /Math\.max\(0, intervalMs - liftMs - snapMs\)/);

  const landing = sourceSection("const solLandAutoSolveCard = ", "const solFinishAutoSolve = ");
  assert.match(landing, /solApplyAutoSolveMove\(solState, move\)/);
  assert.match(landing, /solState\.moves \+= 1/);
  assert.match(landing, /solFlashFoundation\(move\.suit\)/);
  assert.match(landing, /solPlayImpactSound\(\)/);
  assert.match(landing, /solImpactWindow\(flight\.dx, flight\.dy\)/);

  const flight = sourceSection("const solAnimateFlight = ", "const solImpactSoundSource = ");
  assert.match(flight, /filter: lifted/, "The lift shadow follows the card's alpha.");
  assert.doesNotMatch(flight, /boxShadow/, "A box-shadow would show square corners.");

  const flash = sourceSection("const solFlashFoundation = ", "const solCancelWindowImpact = ");
  assert.match(flash, /flash\.style\.left = `\$\{rect\.left\}px`/);
  assert.match(flash, /flash\.style\.width = `\$\{rect\.width\}px`/);
  assert.doesNotMatch(flash, /spread/, "The flash box must sit on the card edge.");

  const sound = sourceSection("const solImpactSoundSource = ", "const solFlashFoundation = ");
  assert.match(sound, /"assets\/solitaire-cards\/hero-parry\.mp3"/);
  assert.match(sound, /new Audio\(solImpactSoundSource\)/);
  assert.match(sound, /audio\.play\(\)/);
  assert.match(mainSource, /solPrepareImpactSound\(\);\n  solAutoSolveRun = \{ step: 0/);

  const finish = sourceSection("const solFinishAutoSolve = ", "const solRunAutoSolveStep = ");
  assert.match(finish, /solCheckWin\(\);/);

  const impact = sourceSection("const solImpactWindow = ", "const solLandAutoSolveCard = ");
  assert.match(impact, /solPrefersReducedMotion\(\)/);
  assert.match(impact, /composite: "add"/);

  assert.match(mainSource, /solBoard\.addEventListener\("click", \(event\) => \{\n    if \(solAutoSolveRun\) return;/);
  assert.match(mainSource, /if \(appId === "solitaire"\) \{\n    solCancelAutoSolve\(\);/);
  assert.match(mainSource, /const solNewGame = \(\) => \{[\s\S]*?solCancelAutoSolve\(\);\n  solState\.presentation = null;/);
  assert.match(mainSource, /if \(solAutoSolve\) \{\n  solAutoSolve\.addEventListener\("click", \(\) => \{\n    solStartAutoSolve\(\);/);
});

test("the impact sound asset ships with the game", async () => {
  const { stat } = await import("node:fs/promises");
  const info = await stat(new URL("assets/solitaire-cards/hero-parry.mp3", root));
  assert.ok(info.size > 10_000 && info.size < 200_000, "Hero Parry should be a short clip.");
});
