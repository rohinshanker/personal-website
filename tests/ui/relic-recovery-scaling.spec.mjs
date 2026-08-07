import { expect, test } from "@playwright/test";
import { readIsolatedMainSource } from "./helpers/random-event-debug.mjs";

test.setTimeout(240_000);

const viewports = [
  { width: 375, height: 812, name: "mobile" },
  { width: 559, height: 900, name: "below-former-breakpoint" },
  { width: 561, height: 900, name: "above-former-breakpoint" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1000, height: 420, name: "short" },
  { width: 1280, height: 800, name: "desktop" },
  { width: 1440, height: 900, name: "large-desktop" },
];
const fullStateViewports = [
  { width: 375, height: 812, name: "mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1000, height: 420, name: "short" },
  { width: 1280, height: 800, name: "desktop" },
  { width: 1440, height: 900, name: "large-desktop" },
];

const rectKeys = [
  "window",
  "titleBar",
  "titleText",
  "scene",
  "portrait",
  "dialogText",
  "hotbar",
  "slot",
];

const disableRemoteGameStats = async (page) => {
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
};

const installRelicRecoveryTestBridge = async (page) => {
  const mainSource = await readIsolatedMainSource();
  const instrumentedSource = mainSource.replace(
    /\n\}\)\(\);\s*$/,
    `
window.__relicRecoveryTest = Object.freeze({
  open() {
    showRelicRecoveryWindow();
    clearRelicRecoveryTyping();
    resetRelicRecoveryEvent({ typewrite: false });
    relicRecoveryWindow.classList.remove("is-opening");
  },
  reset() {
    clearRelicRecoveryTyping();
    resetRelicRecoveryEvent({ typewrite: false });
  },
  completeDetail() {
    completeRelicRecoveryDetailClose();
    if (relicRecoveryStage === RELIC_RECOVERY_STAGE_COMPLETE) {
      setRelicRecoveryDialog("Thanks for all the help. See you in Layer 2!", {
        complete: true,
        instant: true,
      });
      relicRecoveryContinue.focus({ preventScroll: true });
    }
  },
  seedCollected(ids) {
    clearRelicRecoveryDetailCloseTimer();
    clearRelicRecoveryFlyers();
    relicRecoveryPendingId = "";
    relicRecoveryStage = RELIC_RECOVERY_STAGE_ACTIVE;
    relicRecoveryCollectedIds = new Set(ids);
    relicRecoveryWindow.classList.remove("is-detail-open", "is-complete");
    setRelicRecoveryElementHidden(relicRecoveryDialog, true);
    setRelicRecoveryElementHidden(relicRecoveryDetail, true);
    renderRelicRecovery();
  },
  items() {
    return RELIC_RECOVERY_ITEMS.map(({ id, name, description }) => ({
      id,
      name,
      description,
    }));
  },
});
})();`
  );
  if (instrumentedSource === mainSource) {
    throw new Error("Unable to install the Relic Recovery test bridge.");
  }
  await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedSource,
    })
  );
};

const setupPage = async (page, viewport) => {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
    localStorage.clear();
  });
  await disableRemoteGameStats(page);
  await installRelicRecoveryTestBridge(page);
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__relicRecoveryTest));
  await page.addStyleTag({
    content: ".relic-recovery-flyer { animation: none !important; }",
  });
  await page.evaluate(() => window.__relicRecoveryTest.open());
  await expect(page.locator("#relic-recovery-window")).toBeVisible();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("#relic-recovery-window img[src]")).every(
      (image) => image.complete && image.naturalWidth > 0
    )
  );
};

const measurePrompt = (page) =>
  page.evaluate(() => {
    const rect = (selector) => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const win = document.querySelector("#relic-recovery-window");
    const slots = Array.from(document.querySelectorAll(".relic-recovery-slot"));
    const titleTextNode = document.querySelector(
      "#relic-recovery-window .title-bar-text"
    ).firstChild;
    const titleRange = document.createRange();
    titleRange.selectNodeContents(titleTextNode);
    const titleTextBounds = titleRange.getBoundingClientRect();
    const dialogTextNode = document.querySelector("#relic-recovery-dialog-text");
    const dialogRange = document.createRange();
    dialogRange.selectNodeContents(dialogTextNode);
    const dialogTextBounds = dialogRange.getBoundingClientRect();
    return {
      scale: Number.parseFloat(
        win.style.getPropertyValue("--relic-recovery-fit-scale")
      ),
      offsetWidth: win.offsetWidth,
      offsetHeight: win.offsetHeight,
      window: rect("#relic-recovery-window"),
      titleBar: rect("#relic-recovery-window .title-bar"),
      titleText: {
        width: titleTextBounds.width,
        height: titleTextBounds.height,
      },
      scene: rect("#relic-recovery-scene"),
      portrait: rect(".relic-recovery-nanachi"),
      dialogText: {
        width: dialogTextBounds.width,
        height: dialogTextBounds.height,
      },
      hotbar: rect("#relic-recovery-hotbar"),
      slot: rect(".relic-recovery-slot"),
      slotRows: new Set(slots.map((slot) => Math.round(slot.getBoundingClientRect().top)))
        .size,
      documentOverflow:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.documentElement.scrollHeight > window.innerHeight,
    };
  });

const expectClose = (actual, expected, tolerance = 0.015) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    Math.max(1, Math.abs(expected) * tolerance)
  );
};

const expectWindowContained = (metrics, viewport) => {
  expect(metrics.window.left).toBeGreaterThanOrEqual(11.5);
  expect(metrics.window.top).toBeGreaterThanOrEqual(11.5);
  expect(metrics.window.right).toBeLessThanOrEqual(viewport.width - 11.5);
  expect(metrics.window.bottom).toBeLessThanOrEqual(viewport.height - 63.5);
  expect(metrics.documentOverflow).toBe(false);
};

const dispatchAnimationEnd = async (locator, animationName) => {
  await locator.dispatchEvent("animationend", { animationName });
};

const finishDetailAndFreezeFlyer = async (page) => {
  const detail = page.locator("#relic-recovery-detail");
  await dispatchAnimationEnd(detail, "retro-window-open");
  await page.evaluate(() => window.__relicRecoveryTest.completeDetail());
  const flyer = page.locator(".relic-recovery-flyer");
  await expect(flyer).toBeVisible();
  const centers = await page.evaluate(() => {
    const flyerElement = document.querySelector(".relic-recovery-flyer");
    const target = document.querySelector(
      `[data-relic-recovery-slot="${flyerElement.getAttribute("src").split("/").at(-1).replace(".webp", "")}"]`
    );
    const endX = flyerElement.style.getPropertyValue("--fly-end-x");
    const endY = flyerElement.style.getPropertyValue("--fly-end-y");
    flyerElement.style.animation = "none";
    flyerElement.style.transform = `translate(${endX}, ${endY}) translate(-50%, -50%) scale(0.42)`;
    const flyerRect = flyerElement.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return {
      flyerX: flyerRect.left + flyerRect.width / 2,
      flyerY: flyerRect.top + flyerRect.height / 2,
      targetX: targetRect.left + targetRect.width / 2,
      targetY: targetRect.top + targetRect.height / 2,
    };
  });
  expect(Math.abs(centers.flyerX - centers.targetX)).toBeLessThan(2);
  expect(Math.abs(centers.flyerY - centers.targetY)).toBeLessThan(2);
  await dispatchAnimationEnd(flyer, "relic-recovery-fly-to-hotbar");
};

test("Relic Recovery remains proportional and functional across viewports", async ({
  page,
}, testInfo) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await setupPage(page, { width: 1440, height: 900 });
  const baseline = await measurePrompt(page);
  expect(baseline.scale).toBe(1);

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(420);
      const metrics = await measurePrompt(page);
      const expectedScale = Math.min(
        1,
        (viewport.width - 24) / baseline.offsetWidth,
        (viewport.height - 88) / baseline.offsetHeight
      );

      expectClose(metrics.scale, expectedScale, 0.002);
      expectWindowContained(metrics, viewport);
      expect(metrics.slotRows).toBe(1);
      for (const key of rectKeys) {
        expectClose(
          metrics[key].width / baseline[key].width,
          expectedScale,
          0.02
        );
        expectClose(
          metrics[key].height / baseline[key].height,
          expectedScale,
          0.025
        );
      }
    });
  }

  const items = await page.evaluate(() => window.__relicRecoveryTest.items());
  const finalRelicId = "spiraling-heat-stone";
  for (const viewport of fullStateViewports) {
    await test.step(`${viewport.name} interactions`, async () => {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(420);
      await page.evaluate(() => window.__relicRecoveryTest.reset());
      const start = page.locator("#relic-recovery-start");
      await start.focus();
      await start.press("Enter");
      await expect(page.locator(".relic-recovery-item")).toHaveCount(8);
      await expect(page.locator(".relic-recovery-slot")).toHaveCount(8);

      const longRelic = page.locator(
        '[data-relic-recovery-item="spiraling-heat-stone"]'
      );
      await longRelic.focus();
      await longRelic.press("Enter");
      const detail = page.locator("#relic-recovery-detail");
      await expect(detail).toBeFocused();
      await expect(detail).toContainText(
        "Squeezing it will cause the rock in the middle to emit heat."
      );
      const detailGeometry = await page.evaluate(() => {
        const scene = document
          .querySelector("#relic-recovery-scene")
          .getBoundingClientRect();
        const panel = document
          .querySelector(".relic-recovery-detail-panel")
          .getBoundingClientRect();
        const image = document
          .querySelector(".relic-recovery-detail-panel img")
          .getBoundingClientRect();
        return { scene, panel, image };
      });
      expect(detailGeometry.panel.left).toBeGreaterThanOrEqual(
        detailGeometry.scene.left
      );
      expect(detailGeometry.panel.right).toBeLessThanOrEqual(
        detailGeometry.scene.right
      );
      expect(detailGeometry.image.width).toBeGreaterThan(0);

      const collectedSlot = page.locator(
        '[data-relic-recovery-slot="spiraling-heat-stone"]'
      );
      await finishDetailAndFreezeFlyer(page);
      await expect(collectedSlot).toHaveClass(/is-collected/);
      await collectedSlot.focus();
      await expect(collectedSlot.locator(".relic-recovery-tooltip")).toHaveCSS(
        "opacity",
        "1"
      );

      await page.evaluate(
        ({ ids }) => window.__relicRecoveryTest.seedCollected(ids),
        {
          ids: items
            .map((item) => item.id)
            .filter((id) => id !== finalRelicId),
        }
      );
      const finalRelic = page.locator(
        `[data-relic-recovery-item="${finalRelicId}"]`
      );
      await finalRelic.focus();
      await finalRelic.press("Enter");
      await finishDetailAndFreezeFlyer(page);
      await expect(page.locator(".relic-recovery-slot.is-collected")).toHaveCount(
        8
      );
      await expect(page.locator("#relic-recovery-dialog")).toBeVisible();
      await expect(page.locator("#relic-recovery-dialog-text")).toContainText(
        "Layer 2"
      );
      await expect(page.locator("#relic-recovery-continue")).toBeFocused();

      const metrics = await measurePrompt(page);
      expectWindowContained(metrics, viewport);
      if (viewport.name === "mobile" || viewport.name === "short") {
        await page.screenshot({
          path: testInfo.outputPath(`relic-recovery-${viewport.name}.png`),
        });
      }
    });
  }

  const windowElement = page.locator("#relic-recovery-window");
  await page.locator("#relic-recovery-continue").press("Enter");
  await expect(windowElement).toHaveAttribute("aria-hidden", "true");
  await dispatchAnimationEnd(windowElement, "retro-window-close");
  await expect(windowElement).toBeHidden();
  expect(consoleErrors).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
