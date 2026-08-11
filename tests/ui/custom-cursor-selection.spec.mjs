import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { isolateAllProductionDebug } from "./helpers/random-event-debug.mjs";

test.setTimeout(240_000);

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);
const hoverClass = "is-custom-cursor-text-hover";
const selectingClass = "is-custom-cursor-text-selecting";
const allowedConsoleWarning = /^Unrecognized feature: 'web-share'\.$/;
const administratorProofStorageKey = "personalSiteAdministratorProofV1";
const profileStorageKey = "personalSitePlayerProfileV1";
const administratorProfile = Object.freeze({
  id: "player-rohin-neko",
  name: "rohin ^.^",
  icon: "assets/neko-assets/sprites/yawn1.png",
  rerollCount: 0,
});
const administratorProof = `${"a".repeat(32)}.${"b".repeat(32)}`;

const disableRemoteGameStats = (page) =>
  page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );

const isolateDebugRandomEvents = async (page) => {
  const mainSource = await readFile(
    new URL("../../scripts/home/main.js", import.meta.url),
    "utf8"
  );
  const isolatedSource = isolateAllProductionDebug(mainSource);
  await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: isolatedSource,
    })
  );
};

const preparePage = async (page, { administratorAccess = false } = {}) => {
  const consoleErrors = [];
  const consoleWarnings = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
    if (message.type() === "warning") consoleWarnings.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.addInitScript(
    ({ access, profile, profileKey, proof, proofKey }) => {
      localStorage.clear();
      sessionStorage.clear();
      if (access) {
        localStorage.setItem(profileKey, JSON.stringify(profile));
        sessionStorage.setItem(
          proofKey,
          JSON.stringify({
            proof,
            expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
          })
        );
      }
      Math.random = () => 0.999999;
    },
    {
      access: administratorAccess,
      profile: administratorProfile,
      profileKey: profileStorageKey,
      proof: administratorProof,
      proofKey: administratorProofStorageKey,
    }
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await disableRemoteGameStats(page);
  await isolateDebugRandomEvents(page);
  return { consoleErrors, consoleWarnings, runtimeErrors };
};

const assertDiagnostics = ({ consoleErrors, consoleWarnings, runtimeErrors }) => {
  expect(consoleErrors).toEqual([]);
  expect(
    consoleWarnings.filter((message) => !allowedConsoleWarning.test(message))
  ).toEqual([]);
  expect(runtimeErrors).toEqual([]);
};

const cursorOf = (locator) =>
  locator.evaluate((element) => getComputedStyle(element).cursor);

const clearSelection = (page) =>
  page.evaluate(() => window.getSelection()?.removeAllRanges());

const selectText = (locator, characterCount = 18) =>
  locator.evaluate((element, requestedCharacterCount) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode && !/\S/.test(textNode.textContent || "")) {
      textNode = walker.nextNode();
    }
    if (!textNode) throw new Error("The selection target has no visible text node.");

    const text = textNode.textContent || "";
    const start = text.search(/\S/);
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, Math.min(start + requestedCharacterCount, text.length));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection.toString();
  }, characterCount);

const textDragPoints = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  return locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode && !/\S/.test(textNode.textContent || "")) {
      textNode = walker.nextNode();
    }
    if (!textNode) throw new Error("The drag target has no visible text node.");

    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rect = Array.from(range.getClientRects()).find(
      (candidate) => candidate.width >= 24 && candidate.height > 0
    );
    if (!rect) throw new Error("The drag target has no usable text line.");
    const inset = Math.min(5, Math.max(2, rect.width / 10));
    return {
      start: { x: rect.left + inset, y: rect.top + rect.height / 2 },
      end: { x: rect.right - inset, y: rect.top + rect.height / 2 },
    };
  });
};

const expectRootSelectionState = async (page, active) => {
  await expect
    .poll(() =>
      page.evaluate(
        (className) => ({
          body: document.body.classList.contains(className),
          root: document.documentElement.classList.contains(className),
        }),
        selectingClass
      )
    )
    .toEqual({ body: active, root: active });
};

const expectHoverTarget = async (page, locator) => {
  await expect(locator).toHaveClass(new RegExp(`(?:^|\\s)${hoverClass}(?:\\s|$)`));
  await expect
    .poll(() =>
      page.evaluate((className) => document.querySelectorAll(`.${className}`).length, hoverClass)
    )
    .toBe(1);
};

const expectNoHoverTarget = async (page) => {
  await expect
    .poll(() =>
      page.evaluate((className) => document.querySelectorAll(`.${className}`).length, hoverClass)
    )
    .toBe(0);
};

const hoverSelectableText = async (page, locator) => {
  const points = await textDragPoints(locator);
  await page.mouse.move(points.start.x, points.start.y);
  await expectHoverTarget(page, locator);
  return points;
};

const dragSelectText = async (page, locator, { release = true } = {}) => {
  const points = await hoverSelectableText(page, locator);
  await page.mouse.down();
  await page.mouse.move(points.end.x, points.end.y, { steps: 8 });
  await expectRootSelectionState(page, true);
  expect(await cursorOf(locator)).toContain("generated-png/text-");
  if (release) {
    await page.mouse.up();
    await expectRootSelectionState(page, false);
    await expectHoverTarget(page, locator);
  }
  return points;
};

const moveToBlankViewportArea = async (page) => {
  await page.mouse.move(2, 2);
  await expectNoHoverTarget(page);
};

const expectNoPageOverflow = async (page) => {
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > window.innerWidth,
    vertical: document.documentElement.scrollHeight > window.innerHeight,
  }));
  expect(overflow).toEqual({ horizontal: false, vertical: false });
};

const expectIndexSemantics = async (page) => {
  await expect(page.locator("#loader")).toHaveAttribute("aria-live", "polite");
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Proceed" })).toBeVisible();
};

const expectHomeSemantics = async (page) => {
  await expect(page.getByRole("dialog", { name: "About Me" })).toBeVisible();
  await expect(page.locator("#about-window .about-body")).toHaveAttribute(
    "aria-label",
    "About Rohin Shanker"
  );
  await expect(page.getByRole("button", { name: "Next" }).first()).toBeVisible();
};

const expectRetainedSelectionPreservesHomeCursors = async (page, theme) => {
  const paragraph = page.locator("#about-window .about-website-section p");
  expect(await selectText(paragraph)).toBeTruthy();
  await moveToBlankViewportArea(page);
  await expectRootSelectionState(page, false);

  const cursorTargets = [
    { locator: page.locator("body"), token: `normal-${theme}.png` },
    { locator: page.locator("#about-carousel-next"), token: `select-${theme}.png` },
    { locator: page.locator("#snake-help"), token: `help-${theme}.png` },
    {
      locator: page.locator("#about-window > .title-bar > .title-bar-text"),
      token: `move-${theme}.png`,
    },
    { locator: page.locator("#study-open-window"), token: `unavailable-${theme}.png` },
    { locator: page.locator("#administrator-username"), token: `text-${theme}.png` },
    { locator: page.locator(".panel-divider").first(), token: `resize-ew-${theme}.png` },
  ];
  for (const { locator, token } of cursorTargets) {
    expect(await cursorOf(locator)).toContain(`generated-png/${token}`);
  }
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBeTruthy();
};

test("selectable text follows real cursor behavior on both routes and the viewport matrix", async ({
  page,
}, testInfo) => {
  const diagnostics = await preparePage(page);

  await page.goto("/index.html", { waitUntil: "load" });
  const loaderCopy = page.locator("#loader-copy");
  const cancelButton = page.locator("#cancel-button");
  const proceedButton = page.locator("#proceed-button");
  for (const viewport of viewports) {
    await test.step(`index light ${viewport.name}`, async () => {
      await page.setViewportSize(viewport);
      await page.evaluate(() => {
        document.querySelector("#proceed-button").disabled = true;
        document.querySelector("#cancel-button").disabled = false;
      });
      await clearSelection(page);
      await expectRootSelectionState(page, false);
      await expectIndexSemantics(page);
      await expect(proceedButton).toBeDisabled();

      await hoverSelectableText(page, loaderCopy);
      expect(await cursorOf(loaderCopy)).toContain("generated-png/text-light.png");
      await cancelButton.hover();
      await expectNoHoverTarget(page);
      expect(await cursorOf(cancelButton)).toContain("generated-png/select-light.png");

      expect(await selectText(loaderCopy)).toBeTruthy();
      await cancelButton.hover();
      await expectRootSelectionState(page, false);
      expect(await cursorOf(cancelButton)).toContain("generated-png/select-light.png");
      await page.evaluate(() => {
        document.querySelector("#proceed-button").disabled = true;
      });
      expect(await cursorOf(proceedButton)).toContain("generated-png/unavailable-light.png");

      await clearSelection(page);
      const points = await hoverSelectableText(page, loaderCopy);
      await page.mouse.down();
      await page.mouse.move(2, 2, { steps: 8 });
      await expectRootSelectionState(page, true);
      await page.mouse.up();
      await expectRootSelectionState(page, false);
      await expectNoHoverTarget(page);

      await expectNoPageOverflow(page);
      await expectIndexSemantics(page);
      await page.screenshot({
        path: testInfo.outputPath(`index-text-selection-light-${viewport.name}.png`),
      });

      await page.mouse.move(points.start.x, points.start.y);
      await expectHoverTarget(page, loaderCopy);
    });
  }

  await page.goto("/home.html", { waitUntil: "load" });
  const paragraph = page.locator("#about-window .about-website-section p");
  for (const viewport of viewports) {
    await test.step(`home light ${viewport.name}`, async () => {
      await page.setViewportSize(viewport);
      await clearSelection(page);
      await expect(page.locator("body")).not.toHaveClass(/is-cursor-dark-mode/);
      await dragSelectText(page, paragraph);
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBeTruthy();
      expect(await cursorOf(paragraph)).toContain("generated-png/text-light.png");
      await expectRetainedSelectionPreservesHomeCursors(page, "light");
      await expectNoPageOverflow(page);
      await expectHomeSemantics(page);
      await page.screenshot({
        path: testInfo.outputPath(`home-text-selection-light-${viewport.name}.png`),
      });
    });
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('.desktop-icon[data-app="cursor"]').click();
  const cursorWindow = page.locator('[data-app-window="cursor"]');
  await expect(cursorWindow).toBeVisible();
  await cursorWindow.locator('[data-cursor-mode="dark"]').click();
  await expect(page.locator("body")).toHaveClass(/is-cursor-dark-mode/);
  await cursorWindow.locator('[data-close="cursor"]').click();
  await expect(cursorWindow).toBeHidden();

  for (const viewport of viewports) {
    await test.step(`home dark ${viewport.name}`, async () => {
      await page.setViewportSize(viewport);
      await clearSelection(page);
      await dragSelectText(page, paragraph);
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBeTruthy();
      expect(await cursorOf(paragraph)).toContain("generated-png/text-dark.png");
      await expectRetainedSelectionPreservesHomeCursors(page, "dark");
      await expectNoPageOverflow(page);
      await expectHomeSemantics(page);
      await page.screenshot({
        path: testInfo.outputPath(`home-text-selection-dark-${viewport.name}.png`),
      });
    });
  }

  assertDiagnostics(diagnostics);
});

test("touch input and cancellation cannot leave sticky text cursor state", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  const diagnostics = await preparePage(page);
  await page.goto("/home.html", { waitUntil: "load" });

  const paragraph = page.locator("#about-window .about-website-section p");
  const { start } = await textDragPoints(paragraph);
  await page.touchscreen.tap(start.x, start.y);
  await expectRootSelectionState(page, false);
  await expectNoHoverTarget(page);

  await paragraph.dispatchEvent("pointerdown", {
    button: 0,
    isPrimary: true,
    pointerId: 73,
    pointerType: "touch",
  });
  await paragraph.dispatchEvent("selectstart");
  await paragraph.dispatchEvent("pointermove", {
    button: 0,
    isPrimary: true,
    pointerId: 73,
    pointerType: "touch",
  });
  await paragraph.dispatchEvent("pointercancel", {
    button: 0,
    isPrimary: true,
    pointerId: 73,
    pointerType: "touch",
  });
  await expectRootSelectionState(page, false);
  await expectNoHoverTarget(page);

  expect(await selectText(paragraph)).toBeTruthy();
  await page.touchscreen.tap(2, 2);
  await expectRootSelectionState(page, false);
  await expectNoHoverTarget(page);
  await expectNoPageOverflow(page);
  await expectHomeSemantics(page);
  assertDiagnostics(diagnostics);
  await context.close();
});

test("Admin Pick on Screen uses precision and restores the prior cursor", async ({ page }) => {
  const diagnostics = await preparePage(page, { administratorAccess: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/home.html", { waitUntil: "load" });

  const target = page.locator('.taskbar-icon[data-app="image-tools"]');
  const cursorBefore = await cursorOf(target);
  expect(cursorBefore).toContain("generated-png/select-light.png");

  await page.locator('.taskbar-icon[data-app="admin-controls"]').click();
  const adminWindow = page.locator("#admin-controls-window");
  await expect(adminWindow).toBeVisible();
  await page.locator('[data-admin-tab="bindings"]').click();
  await expect(page.locator('[data-admin-panel="bindings"]')).toBeVisible();
  await page.locator("#admin-pick-target").click();

  await expect(page.locator("body")).toHaveClass(/is-admin-picking-target/);
  await expect(target).toHaveAttribute("data-admin-pickable", "");
  expect(await cursorOf(target)).toContain("generated-png/precision-light.png");

  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/is-admin-picking-target/);
  await expect(target).not.toHaveAttribute("data-admin-pickable", "");
  expect(await cursorOf(target)).toBe(cursorBefore);
  await expect(adminWindow).toBeVisible();
  await expectNoPageOverflow(page);
  assertDiagnostics(diagnostics);
});
