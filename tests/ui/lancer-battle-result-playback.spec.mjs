import { expect, test } from "@playwright/test";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";

test.setTimeout(120_000);

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
]);

const testHookMarker = "window.rohinAdminOrchestrator = Object.freeze({";

const createTestMainSource = async () => {
  const mainSource = await readIsolatedMainSource();
  const markerCount = mainSource.split(testHookMarker).length - 1;
  if (markerCount !== 1) {
    throw new Error(`Expected one Admin orchestrator marker; found ${markerCount}.`);
  }
  return mainSource.replace(
    testHookMarker,
    `window.__lancerBattleResultPlaybackTest = Object.freeze({
  getState: () => ({
    activeWindowId: activeWindow?.id || "",
    resultTimerActive: Boolean(lancerBattleResultTimer),
    state: lancerBattleState,
  }),
  showResult: (success) => {
    if (!isLancerBattleVisible()) showLancerBattleWindow();
    showLancerBattleResult(Boolean(success));
    lancerBattleResultVideo.loop = true;
    bringWindowToFront(lancerBattleWindow);
  },
});

${testHookMarker}`
  );
};

const disableRemoteGameStats = (page) =>
  page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });',
    })
  );

const preparePage = async (page) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const mainSource = await createTestMainSource();
  await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: mainSource })
  );
  await disableRemoteGameStats(page);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => 0.999999;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__lancerBattleResultPlaybackTest)))
    .toBe(true);
  await page.clock.install({ time: new Date("2026-08-08T12:00:00Z") });

  return { consoleErrors, runtimeErrors };
};

const readPlayback = (video, expectedState) =>
  video.evaluate((element, state) => {
    const hookState = window.__lancerBattleResultPlaybackTest.getState();
    return {
      currentTime: element.currentTime,
      paused: element.paused,
      pauseEvents: window.__lancerBattlePauseEvents || 0,
      resultTimerActive: hookState.resultTimerActive,
      src: element.currentSrc,
      state: hookState.state,
      stateMatches: hookState.state === state,
    };
  }, expectedState);

const expectPlaybackContinuesAfter = async (video, expectedState, click) => {
  const before = await readPlayback(video, expectedState);
  expect(before.paused).toBe(false);
  expect(before.stateMatches).toBe(true);
  expect(before.resultTimerActive).toBe(true);
  expect(before.src).not.toBe("");

  await click();

  await expect
    .poll(async () => {
      const after = await readPlayback(video, expectedState);
      return {
        advancing: after.currentTime > before.currentTime + 0.04,
        pauseEvents: after.pauseEvents,
        paused: after.paused,
        resultTimerActive: after.resultTimerActive,
        sameSource: after.src === before.src,
        stateMatches: after.stateMatches,
      };
    })
    .toEqual({
      advancing: true,
      pauseEvents: 0,
      paused: false,
      resultTimerActive: true,
      sameSource: true,
      stateMatches: true,
    });
};

for (const viewport of viewports) {
  for (const outcome of [
    { label: "winning", state: "win", success: true },
    { label: "losing", state: "loss", success: false },
  ]) {
    test(`Lancer Duel ${outcome.label} clip ignores clicks at ${viewport.name}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      const diagnostics = await preparePage(page);
      await page.evaluate((success) => {
        window.__lancerBattleResultPlaybackTest.showResult(success);
      }, outcome.success);

      const win = page.locator("#lancer-battle-window");
      const resultStage = page.locator("#lancer-battle-result-stage");
      const video = page.locator("#lancer-battle-result-video");
      await expect(win).toBeVisible();
      await expect(resultStage).toBeVisible();
      await expect(video).toBeVisible();
      await expect
        .poll(() =>
          video.evaluate(
            (element) =>
              element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
              !element.paused &&
              element.currentTime > 0.03
          )
        )
        .toBe(true);
      await video.evaluate((element) => {
        window.__lancerBattlePauseEvents = 0;
        element.addEventListener("pause", () => {
          window.__lancerBattlePauseEvents += 1;
        });
      });

      const geometry = await win.evaluate((windowElement) => {
        const frame = windowElement.querySelector(".lancer-battle-media-frame");
        const videoElement = windowElement.querySelector("#lancer-battle-result-video");
        const frameRect = frame.getBoundingClientRect();
        const videoRect = videoElement.getBoundingClientRect();
        const windowRect = windowElement.getBoundingClientRect();
        const hitTarget = document.elementFromPoint(
          videoRect.left + videoRect.width / 2,
          videoRect.top + videoRect.height / 2
        );
        return {
          documentOverflows: document.documentElement.scrollWidth > window.innerWidth,
          frameContainsVideo:
            videoRect.left >= frameRect.left &&
            videoRect.top >= frameRect.top &&
            videoRect.right <= frameRect.right &&
            videoRect.bottom <= frameRect.bottom,
          videoInterceptsPointer: hitTarget === videoElement,
          videoPointerEvents: getComputedStyle(videoElement).pointerEvents,
          windowBottom: windowRect.bottom,
          windowLeft: windowRect.left,
          windowRight: windowRect.right,
          windowTop: windowRect.top,
        };
      });
      expect(geometry.documentOverflows).toBe(false);
      expect(geometry.frameContainsVideo).toBe(true);
      expect(geometry.videoInterceptsPointer).toBe(false);
      expect(geometry.videoPointerEvents).toBe("none");
      expect(geometry.windowLeft).toBeGreaterThanOrEqual(0);
      expect(geometry.windowTop).toBeGreaterThanOrEqual(0);
      expect(geometry.windowRight).toBeLessThanOrEqual(viewport.width);
      expect(geometry.windowBottom).toBeLessThanOrEqual(viewport.height);

      const videoBounds = await video.boundingBox();
      expect(videoBounds).not.toBeNull();
      await expectPlaybackContinuesAfter(video, outcome.state, () =>
        page.mouse.click(
          videoBounds.x + videoBounds.width / 2,
          videoBounds.y + videoBounds.height / 2
        )
      );

      const titleBounds = await page.locator("#lancer-battle-title").boundingBox();
      expect(titleBounds).not.toBeNull();
      await expectPlaybackContinuesAfter(video, outcome.state, () =>
        page.mouse.click(
          titleBounds.x + titleBounds.width / 2,
          titleBounds.y + titleBounds.height / 2
        )
      );

      await expectPlaybackContinuesAfter(video, outcome.state, () =>
        page.mouse.click(4, Math.round(viewport.height / 2))
      );
      expect(
        await page.evaluate(
          () => window.__lancerBattleResultPlaybackTest.getState().activeWindowId
        )
      ).toBe("");

      await page.screenshot({
        path: testInfo.outputPath(
          `lancer-result-${outcome.state}-${viewport.width}x${viewport.height}.png`
        ),
        fullPage: true,
      });

      if (viewport.name === "desktop") {
        const clipDurationMs = outcome.success ? 7_000 : 3_500;
        await page.clock.runFor(clipDurationMs - 1);
        await expect(resultStage).toBeVisible();
        await page.clock.runFor(1);
        await expect(win).toHaveAttribute("aria-hidden", "true");
        await win.dispatchEvent("animationend", { animationName: "retro-window-close" });
        await expect(video).toHaveClass(/is-hidden/);
        if (outcome.success) {
          await page.clock.runFor(17);
          await expect(win).toBeVisible();
          await expect(page.locator("#lancer-battle-final-stage")).toBeVisible();
          await expect(page.locator("#lancer-battle-final-text")).toHaveText(
            "Good job, Gear."
          );
          await expect(page.locator("#lancer-battle-close")).toBeFocused();
          await page.locator("#lancer-battle-close").click();
          await win.dispatchEvent("animationend", {
            animationName: "retro-window-close",
          });
        }
      } else {
        await page.locator("#lancer-battle-title-close").click();
        await expect(win).toHaveAttribute("aria-hidden", "true");
        await expect(video).toHaveClass(/is-hidden/);
        expect(
          await video.evaluate((element) => ({
            hasSource: element.hasAttribute("src"),
            paused: element.paused,
          }))
        ).toEqual({ hasSource: false, paused: true });
        expect(
          await page.evaluate(
            () => window.__lancerBattleResultPlaybackTest.getState().resultTimerActive
          )
        ).toBe(false);
        await win.dispatchEvent("animationend", { animationName: "retro-window-close" });
      }
      await expect(win).toBeHidden();

      expect(diagnostics.consoleErrors).toEqual([]);
      expect(diagnostics.runtimeErrors).toEqual([]);
    });
  }
}
