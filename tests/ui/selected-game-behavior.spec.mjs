import { writeFile } from "node:fs/promises";

import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";
import {
  REVIEW_VIEWPORTS,
  openApp,
  openHomeDesktop,
  settleRender,
} from "./helpers/rendered-site.mjs";

const installSolitaireVictoryBridge = async (page) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function playMutedForTest() {
      this.muted = true;
      return play.call(this);
    };
  });
  await routeHomeScript(page, "solitaire", (source) =>
    source.replace(
      /\n\}\)\(\);\s*$/,
      `
window.__selectedGameBehavior = Object.freeze({
  presentSolitaireVictory: () => {
    solState.presentation = { visualEffects: false };
    solState.stock = [];
    solState.waste = [];
    solState.tableau = solState.tableau.map(() => []);
    solSuitOrder.forEach((suit) => {
      solState.foundations[suit] = Array.from({ length: 13 }, (_, index) => ({
        id: suit + "-" + (index + 1),
        suit,
        rank: index + 1,
        faceUp: true,
      }));
    });
    solRender();
    solCheckWin();
    return { won: solState.won };
  },
});
})();`
    )
  );
};

const containedGeometry = (element) => {
  const bounds = element.getBoundingClientRect();
  return {
    bottom: bounds.bottom,
    documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
    left: bounds.left,
    right: bounds.right,
    top: bounds.top,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  };
};

for (const viewport of REVIEW_VIEWPORTS) {
  test(`selected game behavior renders from production code at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await installSolitaireVictoryBridge(page);
    await openHomeDesktop(page, viewport);

    const minesweeper = await openApp(page, "minesweeper");
    const topPanel = minesweeper.locator(".ms-top-panel");
    const topPanelGeometry = await topPanel.evaluate((panel) => {
      const rectangle = (selector) => {
        const bounds = panel.querySelector(selector).getBoundingClientRect();
        return {
          center: bounds.left + bounds.width / 2,
          left: bounds.left,
          right: bounds.right,
        };
      };
      const bounds = panel.getBoundingClientRect();
      return {
        flag: rectangle("#ms-flag-mode"),
        mines: rectangle("#ms-mines"),
        panelCenter: bounds.left + bounds.width / 2,
        question: rectangle("#ms-question-mode"),
        reset: rectangle("#ms-reset"),
        time: rectangle("#ms-time"),
      };
    });
    expect(Math.abs(topPanelGeometry.reset.center - topPanelGeometry.panelCenter)).toBeLessThanOrEqual(1);
    expect(topPanelGeometry.mines.right).toBeLessThan(topPanelGeometry.reset.left);
    expect(topPanelGeometry.reset.right).toBeLessThan(topPanelGeometry.time.left);

    const reset = minesweeper.locator("#ms-reset");
    await expect(reset).toHaveAttribute("data-face", "smile");
    const smilePosition = await reset.evaluate(
      (button) => getComputedStyle(button, "::before").backgroundPosition
    );
    await reset.dispatchEvent("pointerdown");
    const pressedPosition = await reset.evaluate(
      (button) => getComputedStyle(button, "::before").backgroundPosition
    );
    expect(smilePosition).not.toBe(pressedPosition);
    await reset.dispatchEvent("pointerup");

    const controls = minesweeper.getByRole("combobox", { name: "Control mode" });
    const flag = minesweeper.locator("#ms-flag-mode");
    const question = minesweeper.locator("#ms-question-mode");
    await controls.selectOption("mobile");
    await expect(flag).toBeVisible();
    await expect(question).toBeVisible();
    await flag.click();
    await expect(flag).toHaveAttribute("aria-pressed", "true");
    await question.click();
    await expect(flag).toHaveAttribute("aria-pressed", "false");
    await expect(question).toHaveAttribute("aria-pressed", "true");
    const footerStacks = await minesweeper.locator(".ms-footer").evaluate((footer) => {
      const controlsBounds = footer.querySelector("#ms-controls-mode").getBoundingClientRect();
      const difficultyBounds = footer.querySelector("#ms-difficulty").getBoundingClientRect();
      return difficultyBounds.top >= controlsBounds.bottom;
    });
    expect(footerStacks).toBe(viewport.width <= 480);

    await minesweeper.locator('[data-game-stats-open="minesweeper"]').click();
    const stats = page.locator("#game-stats-window-minesweeper");
    await expect(stats).toBeVisible();
    await expect(stats).not.toHaveClass(/is-opening/);
    const statsGeometry = await stats.evaluate(containedGeometry);
    expect(statsGeometry.documentOverflows).toBe(false);
    expect(statsGeometry.left).toBeGreaterThanOrEqual(0);
    expect(statsGeometry.right).toBeLessThanOrEqual(statsGeometry.viewportWidth);
    expect(statsGeometry.top).toBeGreaterThanOrEqual(0);
    expect(statsGeometry.bottom).toBeLessThanOrEqual(statsGeometry.viewportHeight);
    const columns = stats.locator(".game-stats-minesweeper-columns > *");
    await expect(columns).toHaveCount(3);
    const columnLefts = await columns.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().left))
    );
    expect(new Set(columnLefts).size).toBe(3);

    await stats.getByRole("button", { name: "Close" }).click();
    await minesweeper.getByRole("button", { name: "Close" }).click();
    const solitaire = await openApp(page, "solitaire");
    expect(await page.evaluate(() => window.__selectedGameBehavior.presentSolitaireVictory())).toEqual({
      won: true,
    });
    const overlay = solitaire.locator("#sol-victory-video-overlay");
    const fallbackVideo = overlay.locator("#sol-victory-video");
    await expect(overlay).toHaveClass(/is-showing/);
    await expect(overlay).toHaveAttribute("aria-hidden", "false");
    await expect.poll(() => fallbackVideo.evaluate((video) => video.readyState)).toBeGreaterThanOrEqual(2);
    await fallbackVideo.evaluate(async (video) => {
      video.pause();
      await new Promise((resolve) => {
        video.addEventListener("seeked", resolve, { once: true });
        video.currentTime = 2;
      });
    });
    const canvas = overlay.locator("#sol-victory-canvas");
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.evaluate((element) => {
      if (!element.width || !element.height) return false;
      const pixels = element.getContext("2d").getImageData(0, 0, element.width, element.height).data;
      return pixels.some((value, index) => index % 4 === 3 && value > 0);
    })).toBe(true);
    // Exercise the explicit video fallback's geometry as well as the real
    // canvas frame; the decoded, paused clip provides a stable visible frame.
    await canvas.evaluate((element) => element.classList.add("is-hidden"));
    await fallbackVideo.evaluate((element) => element.classList.add("is-visible-fallback"));
    await expect(fallbackVideo).toBeVisible();
    await settleRender(page);
    const victoryGeometry = await solitaire.evaluate((windowElement) => {
      const app = windowElement.querySelector(".sol-app").getBoundingClientRect();
      const overlay = windowElement
        .querySelector("#sol-victory-video-overlay")
        .getBoundingClientRect();
      const media = windowElement.querySelector("#sol-victory-video").getBoundingClientRect();
      return {
        appTop: app.top,
        mediaCenter: media.left + media.width / 2,
        mediaHeight: media.height,
        mediaTop: media.top,
        mediaWidth: media.width,
        overlayCenter: overlay.left + overlay.width / 2,
        overlayTop: overlay.top,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });
    expect(victoryGeometry.overlayTop - victoryGeometry.appTop).toBeCloseTo(60, 0);
    expect(victoryGeometry.mediaTop - victoryGeometry.overlayTop).toBeCloseTo(16, 0);
    expect(victoryGeometry.mediaCenter).toBeCloseTo(victoryGeometry.overlayCenter, 0);
    expect(victoryGeometry.mediaWidth).toBeCloseTo(
      Math.min(234, victoryGeometry.viewportWidth * 0.288),
      0
    );
    expect(victoryGeometry.mediaHeight).toBeLessThanOrEqual(
      victoryGeometry.viewportHeight * 0.27 + 1
    );

    await canvas.evaluate((element) => element.classList.remove("is-hidden"));
    await fallbackVideo.evaluate((element) => element.classList.remove("is-visible-fallback"));
    await expect(canvas).toBeVisible();
    await settleRender(page);

    const screenshotPath = testInfo.outputPath(
      `selected-game-behavior-${viewport.width}x${viewport.height}.png`
    );
    await page.screenshot({ fullPage: true, path: screenshotPath });
    await testInfo.attach(`selected-game-behavior-${viewport.name}`, {
      contentType: "image/png",
      path: screenshotPath,
    });
    const semanticSnapshotPath = testInfo.outputPath(
      `selected-game-semantics-${viewport.width}x${viewport.height}.yml`
    );
    await writeFile(semanticSnapshotPath, await page.locator("body").ariaSnapshot());
    await testInfo.attach(`selected-game-semantics-${viewport.name}`, {
      contentType: "text/yaml",
      path: semanticSnapshotPath,
    });
  });
}
