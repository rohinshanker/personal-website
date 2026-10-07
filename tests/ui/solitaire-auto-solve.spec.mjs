import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import { FROZEN_INSTANT, REVIEW_VIEWPORTS, installGameStatsBackend, openApp, openHomeDesktop, settleFrames } from "./helpers/rendered-site.mjs";
import {
  createIssuedGameResponder,
  revealedSolitaireInitial,
} from "./helpers/verified-game-session.mjs";

const viewports = REVIEW_VIEWPORTS;
const suits = ["spades", "clubs", "diamonds", "hearts"];

/**
 * Serves the Solitaire feature with a test bridge and, optionally, a faster
 * cadence so a full 52-card run finishes in a few seconds instead of eleven.
 */
const installSolitaireBridge = async (page, { fast = true } = {}) => {
  await routeHomeScript(page, "solitaire", (originalSource) => {
    let source = originalSource;
    if (fast) {
      const timed = source
        .replace("firstIntervalMs: 1000,", "firstIntervalMs: 80,")
        .replace("minIntervalMs: 120,", "minIntervalMs: 24,");
      if (timed === source) throw new Error("Unable to speed up the auto-solve cadence.");
      source = timed;
    }
    const instrumented = source.replace(
      /\n\}\)\(\);\s*$/,
      `
window.__solitaireAutoSolveTest = Object.freeze({
  stageRevealedGame: ({ presentation = null } = {}) => {
    solCancelAutoSolve();
    solState.presentation = presentation;
    const tableau = solBuildPresentationTableau();
    const lifted = tableau[0].splice(10, 3);
    solState.stock = [];
    solState.waste = [lifted[0], lifted[2], lifted[1]];
    solState.tableau = tableau;
    solState.foundations = { spades: [], clubs: [], diamonds: [], hearts: [] };
    solState.selected = null;
    solState.moves = 40;
    solState.won = false;
    solAdoptStagedBoard();
    solRender();
  },
  stagePartialGame: () => {
    solCancelAutoSolve();
    solState.presentation = null;
    const tableau = solBuildPresentationTableau();
    const aces = tableau.slice(0, 4).map((column) => column.pop());
    solState.stock = [aces[3], aces[2], aces[1], aces[0]].map((card) => ({ ...card, faceUp: false }));
    solState.waste = [];
    solState.tableau = tableau;
    solState.foundations = { spades: [], clubs: [], diamonds: [], hearts: [] };
    solState.selected = null;
    solState.moves = 10;
    solState.won = false;
    solAdoptStagedBoard();
    solRender();
  },
  snapshot: () => ({
    autoSolving: Boolean(solAutoSolveRun),
    foundations: solSuitOrder.map((suit) => solState.foundations[suit].length),
    moves: solState.moves,
    presentation: solState.presentation,
    statsSession: solState.statsSession,
    won: solState.won,
  }),
});
})();
`
    );
    return instrumented;
  });
};

const snapshot = (page) => page.evaluate(() => window.__solitaireAutoSolveTest.snapshot());

const stagePresentation = async (page, options = {}) => {
  await page.evaluate(() => window.homeResources.loadAdminResources());
  const result = await page.evaluate(
    (presetOptions) => window.rohinAdminOrchestrator.runPreset("game-win", presetOptions),
    { intensity: "medium", visualEffects: true, ...options }
  );
  expect(result).toEqual({
    ok: true,
    message: "Staged a local Solitaire win. Press the check button to auto-solve.",
  });
  await expect(page.locator('[data-app-window="solitaire"]')).toBeVisible();
};

/**
 * Records every foundation flash together with the window's live animations,
 * the flash geometry against its pile, and every impact sound played.
 */
const watchImpacts = (page) =>
  page.evaluate(() => {
    const board = document.getElementById("sol-board");
    const win = board.closest(".app-window");
    window.__solitaireImpacts = [];
    window.__solitaireFlyers = [];
    window.__solitaireSounds = [];
    window.__solitaireAutoSolveClickedAt = null;
    document.getElementById("sol-auto-solve").addEventListener(
      "click",
      () => {
        window.__solitaireAutoSolveClickedAt = performance.now();
      },
      { capture: true, once: true }
    );
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function recordedPlay(...args) {
      window.__solitaireSounds.push({
        src: this.currentSrc || this.src,
        muted: this.muted,
        volume: this.volume,
      });
      return originalPlay.apply(this, args);
    };
    // Probes run inside the observer, on the page's own clock, so a slow
    // runner's round-trip latency cannot miss a short flight or skew a landing.
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.classList.contains("sol-flying-card")) {
            const [animation] = node.getAnimations();
            if (animation) {
              animation.pause();
              animation.currentTime = animation.effect.getTiming().duration * 0.4;
            }
            const style = getComputedStyle(node);
            window.__solitaireFlyers.push({
              animated: Boolean(animation),
              boxShadow: style.boxShadow,
              filter: style.filter,
            });
            animation?.play();
            return;
          }
          if (!node.classList.contains("sol-foundation-flash")) return;
          const suit = [...document.querySelectorAll("[data-sol-foundation]")].find((slot) => {
            const slotRect = slot.getBoundingClientRect();
            const flashRect = node.getBoundingClientRect();
            return (
              Math.abs(slotRect.left - flashRect.left) < 0.5 &&
              Math.abs(slotRect.top - flashRect.top) < 0.5 &&
              Math.abs(slotRect.width - flashRect.width) < 0.5 &&
              Math.abs(slotRect.height - flashRect.height) < 0.5
            );
          });
          window.__solitaireImpacts.push({
            at: performance.now(),
            flashAnimation: getComputedStyle(node).animationName,
            flashRadius: getComputedStyle(node).borderRadius,
            flashOnPile: Boolean(suit),
            windowAnimations: win.getAnimations().length,
          });
        });
      });
    });
    observer.observe(board, { childList: true });
  });

const expectStagedBoard = async (page) => {
  const columns = page.locator("#sol-tableau .sol-tableau-col");
  await expect(columns).toHaveCount(7);
  for (let index = 0; index < 4; index += 1) {
    await expect(columns.nth(index).locator(".sol-card")).toHaveCount(13);
    await expect(columns.nth(index).locator(".sol-card").first()).toHaveAttribute(
      "aria-label",
      /^King of /
    );
    await expect(columns.nth(index).locator(".sol-card").last()).toHaveAttribute(
      "aria-label",
      /^Ace of /
    );
  }
  for (let index = 4; index < 7; index += 1) {
    await expect(columns.nth(index).locator(".sol-card")).toHaveCount(0);
  }
  await expect(page.locator("#sol-tableau .sol-card.is-face-down")).toHaveCount(0);
  await expect(page.locator("#sol-stock")).toHaveAttribute("aria-label", "Empty stock");
  await expect(page.locator("#sol-auto-solve")).toBeVisible();
  await expect(page.locator("#sol-auto-solve")).toBeEnabled();
  await expect(page.locator("#sol-reset")).toBeHidden();
};

const expectCheckIconCentered = async (page) => {
  const geometry = await page.locator("#sol-auto-solve").evaluate((button) => {
    const icon = button.querySelector("img");
    const buttonRect = button.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const undoRect = document.getElementById("sol-undo").getBoundingClientRect();
    return {
      buttonWidth: buttonRect.width,
      buttonHeight: buttonRect.height,
      undoWidth: undoRect.width,
      undoHeight: undoRect.height,
      iconWidth: iconRect.width,
      iconHeight: iconRect.height,
      iconSrc: icon.currentSrc || icon.src,
      iconLoaded: icon.complete && icon.naturalWidth > 0,
      offsetX: iconRect.left - buttonRect.left,
      offsetY: iconRect.top - buttonRect.top,
      rightGap: buttonRect.right - iconRect.right,
      bottomGap: buttonRect.bottom - iconRect.bottom,
    };
  });
  expect(geometry.iconSrc).toMatch(/assets\/app-icons\/ico\/check\.ico$/);
  expect(geometry.iconLoaded).toBe(true);
  expect(geometry.buttonWidth).toBe(geometry.undoWidth);
  expect(geometry.buttonHeight).toBe(geometry.undoHeight);
  expect(geometry.buttonHeight).toBe(34);
  expect(geometry.iconWidth).toBe(22);
  expect(geometry.iconHeight).toBe(22);
  expect(Math.abs(geometry.offsetX - geometry.rightGap)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.offsetY - geometry.bottomGap)).toBeLessThanOrEqual(1);
};

const expectFinishedWin = async (page, { moves }) => {
  await expect(page.locator("#sol-victory-video-overlay")).toHaveAttribute(
    "aria-hidden",
    "false",
    { timeout: 25_000 }
  );
  for (const suit of suits) {
    await expect(page.locator(`[data-sol-foundation="${suit}"]`)).toHaveAttribute(
      "aria-label",
      new RegExp(`foundation, King of `)
    );
  }
  await expect(page.locator("#sol-tableau .sol-card")).toHaveCount(0);
  await expect(page.locator("#sol-board .sol-flying-card")).toHaveCount(0);
  await expect(page.locator("#sol-board")).not.toHaveClass(/is-auto-solving/);
  await expect(page.locator("#sol-reset")).toBeVisible();
  await expect(page.locator("#sol-auto-solve")).toBeHidden();
  await expect(page.locator("#sol-undo")).toBeDisabled();
  const state = await snapshot(page);
  expect(state.won).toBe(true);
  expect(state.autoSolving).toBe(false);
  expect(state.foundations).toEqual([13, 13, 13, 13]);
  expect(state.moves).toBe(moves);
  const digits = await page
    .locator("#sol-moves .ms-digit")
    .evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  expect(digits.map((src) => src.match(/digital_(\d)\.png$/)[1]).join("")).toBe(
    String(moves).padStart(3, "0")
  );
};

const glowState = (page) =>
  page.locator("#sol-auto-solve").evaluate((button) => ({
    completing: button.classList.contains("is-completing"),
    label: button.getAttribute("aria-label"),
    glow: getComputedStyle(button, "::after").boxShadow,
    animation: getComputedStyle(button, "::after").animationName,
  }));

test("the check appears only while a visible card fits a foundation and undoes as one step", async ({
  page,
}) => {
  await installSolitaireBridge(page);
  await openHomeDesktop(page, { width: 1280, height: 800 });
  await openApp(page, "solitaire");
  await page.evaluate(() => window.__solitaireAutoSolveTest.stagePartialGame());
  await expect(page.locator("#sol-reset")).toBeVisible();
  await expect(page.locator("#sol-auto-solve")).toBeHidden();
  const hiddenGeometry = await page.locator("#sol-auto-solve").evaluate((button) => ({
    display: getComputedStyle(button).display,
    width: button.getBoundingClientRect().width,
  }));
  expect(hiddenGeometry).toEqual({ display: "none", width: 0 });

  await page.locator("#sol-stock").click();
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste, Ace of Spades");
  await expect(page.locator("#sol-auto-solve")).toBeVisible();
  await expect(page.locator("#sol-reset")).toBeHidden();
  const partialGlow = await glowState(page);
  expect(partialGlow.completing).toBe(false);
  expect(partialGlow.label).toBe("Auto-solve visible cards");
  expect(partialGlow.glow).toBe("none");

  await page.locator("#sol-auto-solve").click();
  await expect(page.locator("#sol-reset")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#sol-auto-solve")).toBeHidden();
  await expect(page.locator('[data-sol-foundation="spades"]')).toHaveAttribute(
    "aria-label",
    "Spades foundation, Two of Spades"
  );
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste");
  let state = await snapshot(page);
  expect(state.moves).toBe(13);
  expect(state.won).toBe(false);
  expect(state.foundations).toEqual([2, 0, 0, 0]);
  await expect(page.locator("#sol-undo")).toBeEnabled();

  await page.locator("#sol-undo").click();
  state = await snapshot(page);
  expect(state.moves).toBe(11);
  expect(state.foundations).toEqual([0, 0, 0, 0]);
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste, Ace of Spades");
  await expect(page.locator("#sol-auto-solve")).toBeVisible();
});

test("the Admin game-win preset stages a solvable board and the check plays the win", async ({
  page,
}) => {
  await installSolitaireBridge(page);
  await openHomeDesktop(page, { width: 1280, height: 800 });
  await stagePresentation(page);
  await expectStagedBoard(page);
  await expectCheckIconCentered(page);
  await expect(page.locator("#sol-victory-video-overlay")).toHaveAttribute("aria-hidden", "true");
  expect((await snapshot(page)).presentation).toEqual({ visualEffects: true });

  await watchImpacts(page);
  await page.locator("#sol-auto-solve").click();
  await expect(page.locator("#sol-auto-solve")).toBeDisabled();
  await expect(page.locator("#sol-board")).toHaveClass(/is-auto-solving/);
  await expect(page.locator("#sol-undo")).toBeDisabled();
  await expect
    .poll(() => page.evaluate(() => window.__solitaireFlyers.length), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(1);
  const flyerStyle = await page.evaluate(() => window.__solitaireFlyers[0]);
  expect(flyerStyle.animated).toBe(true);
  expect(flyerStyle.boxShadow).toBe("none");
  expect(flyerStyle.filter).toMatch(/^drop-shadow\(rgba\(0, 0, 0, 0\.\d+\) 0px \d/);
  expect((await snapshot(page)).autoSolving).toBe(true);

  await expectFinishedWin(page, { moves: 52 });
  const impacts = await page.evaluate(() => window.__solitaireImpacts);
  expect(impacts).toHaveLength(52);
  impacts.forEach((impact) => {
    expect(impact.flashAnimation).toBe("sol-foundation-flash");
    expect(impact.flashOnPile).toBe(true);
    expect(impact.flashRadius).toBe("8px");
    expect(impact.windowAnimations).toBeGreaterThanOrEqual(1);
  });
  const sounds = await page.evaluate(() => window.__solitaireSounds);
  const impactSounds = sounds.filter((sound) => /hero-parry\.mp3$/.test(sound.src));
  expect(impactSounds).toHaveLength(52);
  impactSounds.forEach((sound) => {
    expect(sound.muted).toBe(false);
    expect(sound.volume).toBe(1);
  });
  const state = await snapshot(page);
  expect(state.statsSession).toBe("");
  expect(state.presentation).toEqual({ visualEffects: true });
  await expect(page.locator("#sol-fireworks")).toHaveClass(/is-showing/);
});

test("the preset honours the visual-effects switch without skipping the video", async ({ page }) => {
  await installSolitaireBridge(page);
  await openHomeDesktop(page, { width: 1280, height: 800 });
  await stagePresentation(page, { visualEffects: false });
  await page.locator("#sol-auto-solve").click();
  await expectFinishedWin(page, { moves: 52 });
  await expect(page.locator("#sol-fireworks")).not.toHaveClass(/is-showing/);
});

test("a regular deal records one win and stays terminal until Reset", async ({
  page,
}) => {
  await installSolitaireBridge(page);
  const apiBaseUrl = "https://solitaire-terminal.test";
  const events = [];
  // The deal the server issues is already a winnable board, so the run that
  // finishes it is played on issued state rather than on one staged locally: a
  // staged board carries no proof, and this test is about recording a win.
  const verified = createIssuedGameResponder({
    games: ["solitaire"],
    initials: { solitaire: revealedSolitaireInitial() },
    receipts: { solitaire: { type: "win", metricKind: "moves", metric: 52 } },
  });
  await installGameStatsBackend(page, { apiBaseUrl });
  await page.route(`${apiBaseUrl}/**`, async (route) => {
    if (await verified.handle(route)) return;
    const pathname = new URL(route.request().url()).pathname;
    let body = { generatedAt: new Date().toISOString(), totals: {}, leaderboards: {} };
    if (pathname === "/events") {
      events.push(JSON.parse(route.request().postData()));
      body = { ok: true, applied: true };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await openHomeDesktop(page, { width: 1280, height: 800 });
  await openApp(page, "solitaire");
  await expect.poll(() => page.evaluate(() => window.homeSolitaire.solState.stock.length)).toBe(0);
  await expect(page.locator("#sol-auto-solve")).toBeVisible();
  await expect(page.locator("#sol-reset")).toBeHidden();
  const glow = await glowState(page);
  expect(glow.completing).toBe(true);
  expect(glow.label).toBe("Auto-solve and win the game");
  expect(glow.glow).toContain("rgb(255, 213, 74)");
  expect(glow.animation).toBe("sol-auto-solve-glow");
  expect((await snapshot(page)).presentation).toBeNull();
  expect((await snapshot(page)).statsSession).not.toBe("");

  await page.locator("#sol-auto-solve").click();
  await expect(page.locator("#sol-auto-solve")).toHaveClass(/is-completing/);
  await expectFinishedWin(page, { moves: 52 });
  expect((await snapshot(page)).statsSession).toBe("");
  await expect(page.locator("#game-profile-prompt")).toBeVisible();
  const clickCompletedBoard = async () => {
    await page.evaluate(() => {
      const foundation = document.querySelector('[data-sol-foundation="spades"]');
      foundation.querySelector("button").click();
      document.querySelector('[data-sol-col="0"]').click();
      document.querySelector('[data-sol-col="0"] button')?.click();
      foundation.click();
      document.getElementById("sol-undo").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await settleFrames(page);
    expect((await snapshot(page)).foundations).toEqual([13, 13, 13, 13]);
    expect((await snapshot(page)).won).toBe(true);
    await expect(page.locator("#sol-tableau .sol-card")).toHaveCount(0);
    // A completed board asks for nothing more: no second issuance, and the
    // claimed finish it already submitted is not retargeted.
    expect(verified.issued).toHaveLength(1);
    expect(verified.finishes).toHaveLength(1);
  };
  await clickCompletedBoard();
  expect(events).toEqual([]);
  await page.locator("#game-profile-cancel").click();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("personalSiteGameStatsV1") || "null")?.totals.solitaire.wins
  )).toBe(1);
  await expect.poll(() => events.length).toBe(1);
  await clickCompletedBoard();
  expect(events).toHaveLength(1);
  await page.locator("#sol-reset").click();
  expect((await snapshot(page)).won).toBe(false);
  // Reset is a new board, so it asks for a board of its own; the finish the
  // previous deal already claimed is untouched by it.
  await expect.poll(() => verified.issued.length).toBe(2);
  expect(verified.finishes).toHaveLength(1);
  await page.locator("#sol-stock").click();
  expect(events).toHaveLength(1);
});

test("a staged board with buried waste cards auto-solves through the waste", async ({ page }) => {
  await installSolitaireBridge(page);
  await openHomeDesktop(page, { width: 1280, height: 800 });
  await openApp(page, "solitaire");
  await page.evaluate(() =>
    window.__solitaireAutoSolveTest.stageRevealedGame({
      presentation: { visualEffects: true },
    })
  );
  await expect(page.locator("#sol-auto-solve")).toBeVisible();
  await expect(page.locator("#sol-reset")).toBeHidden();
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste, Two of Hearts");

  await page.locator("#sol-auto-solve").click();
  await expectFinishedWin(page, { moves: 92 });
  expect((await snapshot(page)).statsSession).toBe("");
  await expect(page.locator("#sol-waste")).toHaveAttribute("aria-label", "Waste");
});

test("closing Solitaire cancels a run in progress and the check returns on reopen", async ({
  page,
}) => {
  await installSolitaireBridge(page, { fast: false });
  await openHomeDesktop(page, { width: 1280, height: 800 });
  await stagePresentation(page);
  await page.locator("#sol-auto-solve").click();
  await expect(page.locator("#sol-board .sol-flying-card")).toHaveCount(1);
  await page.locator('[data-close="solitaire"]').click();
  await expect(page.locator('[data-app-window="solitaire"]')).toBeHidden();
  const cancelled = await snapshot(page);
  expect(cancelled.autoSolving).toBe(false);
  expect(cancelled.won).toBe(false);
  expect(cancelled.foundations.reduce((total, count) => total + count, 0)).toBeLessThan(52);
  await expect(page.locator("#sol-board .sol-flying-card")).toHaveCount(0);
  await expect(page.locator("#sol-board .sol-foundation-flash")).toHaveCount(0);
  await expect(page.locator("#sol-board")).not.toHaveClass(/is-auto-solving/);
  await expect(page.locator("#sol-victory-video-overlay")).toHaveAttribute("aria-hidden", "true");

  await openApp(page, "solitaire");
  await expect(page.locator("#sol-auto-solve")).toBeVisible();
  await expect(page.locator("#sol-auto-solve")).toBeEnabled();
  await expect(page.locator("#sol-tableau .sol-card")).not.toHaveCount(0);
});

/**
 * `solAutoSolveTiming` in `scripts/home/features/solitaire.js`, resolved.
 *
 * Step 0 runs at its 1,000 ms interval and lands after `liftShare + snapShare`
 * of it; the next step starts when that interval is up, and its own interval is
 * `accelerationFactor` shorter. Asserting the exact instants costs nothing once
 * the page clock is paused, and the old tolerance window around them was the
 * suite's most reliable flake.
 */
const FIRST_LANDING_MS = 850;
const SECOND_LANDING_GAP_MS = 881;

const impactCount = (page) => page.evaluate(() => window.__solitaireImpacts.length);

test("the first card leaves after a beat and the cadence accelerates from one per second", async ({
  page,
}) => {
  await page.clock.install({ time: FROZEN_INSTANT });
  await installSolitaireBridge(page, { fast: false });
  await openHomeDesktop(page, { width: 1280, height: 800 });
  await stagePresentation(page);
  // From here the run advances only when this test says so, so each landing is
  // asserted at its exact instant rather than inside a tolerance window.
  const staged = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(staged + 1_000));
  await watchImpacts(page);

  await page.locator("#sol-auto-solve").click();
  expect(await impactCount(page), "the first card is still in flight").toBe(0);
  await page.clock.runFor(FIRST_LANDING_MS - 1);
  expect(await impactCount(page), "the first card lands on its beat, not before").toBe(0);
  await page.clock.runFor(1);
  expect(await impactCount(page)).toBe(1);

  await page.clock.runFor(SECOND_LANDING_GAP_MS - 1);
  expect(await impactCount(page), "the second card keeps the accelerated beat").toBe(1);
  await page.clock.runFor(1);
  expect(await impactCount(page)).toBe(2);

  await page.locator('[data-close="solitaire"]').click();
});

for (const viewport of viewports) {
  test(`the staged board and check control fit at ${viewport.name}`, async ({ page }) => {
    await installSolitaireBridge(page);
    await openHomeDesktop(page, viewport);
    await stagePresentation(page);
    await expectStagedBoard(page);
    await expectCheckIconCentered(page);
    const geometry = await page.locator(".sol-app").evaluate((app) => {
      const rect = app.getBoundingClientRect();
      const toolbar = app.querySelector(".sol-toolbar").getBoundingClientRect();
      const check = app.querySelector("#sol-auto-solve").getBoundingClientRect();
      const undo = app.querySelector("#sol-undo").getBoundingClientRect();
      return {
        appOverflow: app.scrollWidth - app.clientWidth,
        left: rect.left,
        right: rect.right,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
        checkInsideToolbar: check.left >= toolbar.left && check.right <= toolbar.right,
        checkTop: check.top - toolbar.top,
        undoTop: undo.top - toolbar.top,
        viewportWidth: window.innerWidth,
      };
    });
    expect(geometry.appOverflow).toBeLessThanOrEqual(1);
    expect(geometry.pageOverflow).toBeLessThanOrEqual(0);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.checkInsideToolbar).toBe(true);
    expect(Math.abs(geometry.checkTop - geometry.undoTop)).toBeLessThanOrEqual(1);

    await page.locator("#sol-auto-solve").click();
    await expectFinishedWin(page, { moves: 52 });
  });
}
