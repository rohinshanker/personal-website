import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { isolateAllProductionDebug } from "./helpers/random-event-debug.mjs";

test.setTimeout(180_000);

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);
const allowedConsoleWarning = /^Unrecognized feature: 'web-share'\.$/;

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

const clearSelection = (page) =>
  page.evaluate(() => window.getSelection()?.removeAllRanges());

const cursorOf = (locator) =>
  locator.evaluate((element) => getComputedStyle(element).cursor);

const expectSelectionState = (page, active) =>
  expect
    .poll(() =>
      page.evaluate(() =>
        document.body.classList.contains("is-custom-cursor-text-selection")
      )
    )
    .toBe(active);

const expectNoPageOverflow = async (page) => {
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > window.innerWidth,
    vertical: document.documentElement.scrollHeight > window.innerHeight,
  }));
  expect(overflow.horizontal).toBe(false);
  expect(overflow.vertical).toBe(false);
};

test("highlighted text uses the textbox cursor across both routes and responsive viewports", async ({
  page,
}, testInfo) => {
  const consoleErrors = [];
  const consoleWarnings = [];
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
    if (message.type() === "warning") consoleWarnings.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => 0.999999;
  });
  await disableRemoteGameStats(page);
  await isolateDebugRandomEvents(page);

  await page.goto("/index.html", { waitUntil: "load" });
  const loaderCopy = page.locator("#loader-copy");
  const cancelButton = page.locator("#cancel-button");
  const proceedButton = page.locator("#proceed-button");
  for (const viewport of viewports) {
    await test.step(`loader ${viewport.name}`, async () => {
      await page.setViewportSize(viewport);
      await clearSelection(page);
      await expectSelectionState(page, false);
      const copyCursorBefore = await cursorOf(loaderCopy);
      const buttonCursorBefore = await cursorOf(cancelButton);
      expect(copyCursorBefore).not.toContain("text-light.png");
      expect(buttonCursorBefore).not.toContain("text-light.png");

      expect(await selectText(loaderCopy)).toBeTruthy();
      await expectSelectionState(page, true);
      expect(await cursorOf(loaderCopy)).toContain("generated-png/text-light.png");
      expect(await cursorOf(cancelButton)).toContain("generated-png/text-light.png");
      expect(await cursorOf(proceedButton)).toContain("generated-png/unavailable-light.png");
      await expectNoPageOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`loader-text-selection-${viewport.name}.png`),
      });

      await clearSelection(page);
      await expectSelectionState(page, false);
      expect(await cursorOf(loaderCopy)).toBe(copyCursorBefore);
      expect(await cursorOf(cancelButton)).toBe(buttonCursorBefore);
    });
  }

  await page.goto("/home.html", { waitUntil: "load" });
  const paragraph = page.locator("#about-window .about-website-section p");
  const pointerButton = page.locator("#about-carousel-next");
  const helpButton = page.locator('#about-window .title-bar-controls [aria-label="Help"]');
  const titleBar = page.locator("#about-window > .title-bar");
  const textbox = page.locator("#administrator-username");

  for (const viewport of viewports) {
    await test.step(`desktop ${viewport.name}`, async () => {
      await page.setViewportSize(viewport);
      await paragraph.scrollIntoViewIfNeeded();
      await clearSelection(page);
      await expectSelectionState(page, false);
      const paragraphCursorBefore = await cursorOf(paragraph);
      const buttonCursorBefore = await cursorOf(pointerButton);
      const helpCursorBefore = await cursorOf(helpButton);
      const titleBarCursor = await cursorOf(titleBar);
      const textboxCursor = await cursorOf(textbox);
      expect(textboxCursor).toContain("generated-png/text-light.png");

      expect(await selectText(paragraph)).toBeTruthy();
      await expectSelectionState(page, true);
      expect(await cursorOf(paragraph)).toBe(textboxCursor);
      expect(await cursorOf(pointerButton)).toBe(textboxCursor);
      expect(await cursorOf(helpButton)).toBe(textboxCursor);
      expect(await cursorOf(titleBar)).toBe(titleBarCursor);

      await expectNoPageOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`home-text-selection-${viewport.name}.png`),
      });

      await clearSelection(page);
      await expectSelectionState(page, false);
      expect(await cursorOf(paragraph)).toBe(paragraphCursorBefore);
      expect(await cursorOf(pointerButton)).toBe(buttonCursorBefore);
      expect(await cursorOf(helpButton)).toBe(helpCursorBefore);
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

  const darkTextboxCursor = await cursorOf(textbox);
  expect(darkTextboxCursor).toContain("generated-png/text-dark.png");
  expect(await selectText(paragraph)).toBeTruthy();
  await expectSelectionState(page, true);
  expect(await cursorOf(paragraph)).toBe(darkTextboxCursor);
  expect(await cursorOf(pointerButton)).toBe(darkTextboxCursor);
  await page.screenshot({
    path: testInfo.outputPath("home-text-selection-dark.png"),
  });
  await clearSelection(page);
  await expectSelectionState(page, false);

  expect(consoleErrors).toEqual([]);
  expect(consoleWarnings.filter((message) => !allowedConsoleWarning.test(message))).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
