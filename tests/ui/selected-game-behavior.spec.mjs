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
  drawVictoryFrame: () => solDrawVictoryFrame(),
});
})();`
    )
  );
};

for (const viewport of REVIEW_VIEWPORTS) {
  test(`victory media and mobile mark positions at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await installSolitaireVictoryBridge(page);
    await openHomeDesktop(page, viewport);

    const minesweeper = await openApp(page, "minesweeper");
    const topPanel = minesweeper.locator(".ms-top-panel");
    const controls = minesweeper.getByRole("combobox", { name: "Control mode" });
    const flag = minesweeper.locator("#ms-flag-mode");
    const question = minesweeper.locator("#ms-question-mode");
    await controls.selectOption("mobile");
    await expect(flag).toBeVisible();
    await expect(question).toBeVisible();
    const positions = await topPanel.evaluate((panel) =>
      ["#ms-mines", "#ms-flag-mode", "#ms-reset", "#ms-question-mode", "#ms-time"].map(
        (selector) => {
          const bounds = panel.querySelector(selector).getBoundingClientRect();
          return { left: bounds.left, right: bounds.right, width: bounds.width };
        }
      )
    );
    positions.forEach((position) => expect(position.width).toBeGreaterThan(0));
    positions.slice(1).forEach((position, index) =>
      expect(positions[index].right).toBeLessThanOrEqual(position.left)
    );
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
    // The static test server does not support range seeking. Wait for an
    // actually presented frame while playing, then pause that decoded frame.
    const presentedTime = await fallbackVideo.evaluate(async (video) => {
      video.currentTime = 0;
      const frame = new Promise((resolve) => {
        const observe = (_time, metadata) => {
          if (metadata.mediaTime >= 2) {
            video.pause();
            window.__selectedGameBehavior.drawVictoryFrame();
            resolve(metadata.mediaTime);
          } else {
            video.requestVideoFrameCallback(observe);
          }
        };
        video.requestVideoFrameCallback(observe);
      });
      await video.play();
      return frame;
    });
    expect(presentedTime).toBeGreaterThanOrEqual(2);
    expect(presentedTime).toBeLessThan(3);
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
