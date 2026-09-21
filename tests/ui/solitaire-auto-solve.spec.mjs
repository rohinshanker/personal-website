import { expect, test } from "./deterministic.mjs";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";
import { openApp, openHomeDesktop } from "./helpers/rendered-site.mjs";

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);
const suits = ["spades", "clubs", "diamonds", "hearts"];

/**
 * Serves main.js with a test bridge and, optionally, a faster cadence so a
 * full 52-card run finishes in a few seconds instead of eleven.
 */
const installMainBridge = async (page, { fast = true } = {}) => {
  let source = await readIsolatedMainSource();
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
    solHistory.length = 0;
    if (!presentation) ensureSolitaireStatsSession();
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
    solHistory.length = 0;
    ensureSolitaireStatsSession();
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
  if (instrumented === source) throw new Error("Unable to install the auto-solve bridge.");
  await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: instrumented })
  );
};

const snapshot = (page) => page.evaluate(() => window.__solitaireAutoSolveTest.snapshot());

const stagePresentation = async (page, options = {}) => {
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
    window.__solitaireSounds = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function recordedPlay(...args) {
      window.__solitaireSounds.push({
        src: this.currentSrc || this.src,
        muted: this.muted,
        volume: this.volume,
      });
      return originalPlay.apply(this, args);
    };
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement) || !node.classList.contains("sol-foundation-flash")) {
            return;
          }
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
  await installMainBridge(page);
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
  await installMainBridge(page);
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
  await expect(page.locator("#sol-board .sol-flying-card")).toHaveCount(1);
  const flyerStyle = await page.locator("#sol-board .sol-flying-card").evaluate((flyer) => {
    const [animation] = flyer.getAnimations();
    animation?.pause();
    if (animation) animation.currentTime = animation.effect.getTiming().duration * 0.4;
    const style = getComputedStyle(flyer);
    const result = { boxShadow: style.boxShadow, filter: style.filter };
    animation?.play();
    return result;
  });
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
  await installMainBridge(page);
  await openHomeDesktop(page, { width: 1280, height: 800 });
  await stagePresentation(page, { visualEffects: false });
  await page.locator("#sol-auto-solve").click();
  await expectFinishedWin(page, { moves: 52 });
  await expect(page.locator("#sol-fireworks")).not.toHaveClass(/is-showing/);
});

test("a regular deal that the run would finish shows the gold glow and records the win", async ({
  page,
}) => {
  await installMainBridge(page);
  await openHomeDesktop(page, { width: 1280, height: 800 });
  await openApp(page, "solitaire");
  await page.evaluate(() => window.__solitaireAutoSolveTest.stageRevealedGame());
  await expect(page.locator("#sol-auto-solve")).toBeVisible();
  await expect(page.locator("#sol-reset")).toBeHidden();
  const glow = await glowState(page);
  expect(glow.completing).toBe(true);
  expect(glow.label).toBe("Auto-solve and win the game");
  expect(glow.glow).toContain("rgb(255, 213, 74)");
  expect(glow.animation).toBe("sol-auto-solve-glow");
  expect((await snapshot(page)).presentation).toBeNull();

  await page.locator("#sol-auto-solve").click();
  await expect(page.locator("#sol-auto-solve")).toHaveClass(/is-completing/);
  await expectFinishedWin(page, { moves: 92 });
  expect((await snapshot(page)).statsSession).not.toBe("");
});

test("a staged board with buried waste cards auto-solves through the waste", async ({ page }) => {
  await installMainBridge(page);
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
  await installMainBridge(page, { fast: false });
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

test("the first card leaves after a beat and the cadence is one per second at the start", async ({
  page,
}) => {
  await installMainBridge(page, { fast: false });
  await openHomeDesktop(page, { width: 1280, height: 800 });
  await stagePresentation(page);
  await watchImpacts(page);
  const startedAt = Date.now();
  await page.locator("#sol-auto-solve").click();
  await expect
    .poll(() => page.evaluate(() => window.__solitaireImpacts.length), { timeout: 5_000 })
    .toBe(1);
  const firstLanding = Date.now() - startedAt;
  await expect
    .poll(() => page.evaluate(() => window.__solitaireImpacts.length), { timeout: 5_000 })
    .toBe(2);
  const secondLanding = Date.now() - startedAt;
  expect(firstLanding).toBeGreaterThanOrEqual(800);
  expect(firstLanding).toBeLessThan(1_500);
  expect(secondLanding - firstLanding).toBeGreaterThanOrEqual(700);
  expect(secondLanding - firstLanding).toBeLessThan(1_300);
  await page.locator('[data-close="solitaire"]').click();
});

for (const viewport of viewports) {
  test(`the staged board and check control fit at ${viewport.name}`, async ({ page }) => {
    await installMainBridge(page);
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
