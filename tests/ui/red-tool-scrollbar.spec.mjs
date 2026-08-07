import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { isolateProductionPerEventDebug } from "./helpers/random-event-debug.mjs";

test.setTimeout(180_000);

const viewports = Object.freeze([
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

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
  const isolatedSystemAlerts = mainSource.replace(
    "debug: alert.debug === true,",
    "debug: false,"
  );
  const isolatedSource = isolateProductionPerEventDebug(isolatedSystemAlerts);
  if (isolatedSystemAlerts === mainSource) {
    throw new Error("Unable to isolate debug random events for the Red Tool suite.");
  }
  await page.route(/\/scripts\/home\/main\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: isolatedSource,
    })
  );
};

const appendOverflowingConversation = (page) =>
  page.locator("#red-tool-chat-log").evaluate((log) => {
    log.querySelectorAll(".red-tool-message").forEach((message) => message.remove());
    for (let index = 1; index <= 16; index += 1) {
      const row = document.createElement("div");
      row.className = "red-tool-message";

      const avatar = document.createElement("img");
      avatar.className = "red-tool-avatar";
      avatar.src = "assets/random%20events/red-tool-icon.png";
      avatar.alt = "";

      const message = document.createElement("p");
      const speaker = document.createElement("strong");
      speaker.textContent = "Red Tool: ";
      message.append(
        speaker,
        document.createTextNode(
          `Conversation message ${index} with enough copy to exercise the chat scrollbar.`
        )
      );
      row.append(avatar, message);
      log.append(row);
    }
    log.scrollTop = 0;
  });

const measure = (page) =>
  page.evaluate(() => {
    const bounds = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
    };
    const win = document.querySelector("#red-tool-window");
    const chat = document.querySelector("#red-tool-chat-log");
    const taskbar = document.querySelector(".taskbar");
    const chatBounds = bounds(chat);
    const winBounds = bounds(win);
    return {
      chat: chatBounds,
      chatClientHeight: chat.clientHeight,
      chatClientWidth: chat.clientWidth,
      chatOverflowY: getComputedStyle(chat).overflowY,
      chatScrollHeight: chat.scrollHeight,
      chatScrollWidth: chat.scrollWidth,
      chatScrollbarWidth: chat.offsetWidth - chat.clientWidth,
      chatWithinWindow:
        chatBounds.left >= winBounds.left &&
        chatBounds.top >= winBounds.top &&
        chatBounds.right <= winBounds.right &&
        chatBounds.bottom <= winBounds.bottom,
      documentOverflow:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.documentElement.scrollHeight > window.innerHeight,
      taskbar: bounds(taskbar),
      win: winBounds,
    };
  });

test("Red Tool chat remains scrollable and contained across viewports", async ({
  page,
}, testInfo) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  const requestFailures = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("requestfailed", (request) => requestFailures.push(request.url()));

  await page.setViewportSize(viewports[0]);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => 0.999999;
  });
  await disableRemoteGameStats(page);
  await isolateDebugRandomEvents(page);
  await page.goto("/home.html", { waitUntil: "load" });
  await page.locator('#about-window [data-close="about"]').click();
  await expect(page.locator("#about-window")).toBeHidden();

  const win = page.locator("#red-tool-window");
  const chat = page.locator("#red-tool-chat-log");
  const close = page.locator("#red-tool-close");
  const input = page.locator("#red-tool-input");

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      const result = await page.evaluate(() =>
        window.rohinAdminOrchestrator.runEvent("red-tool", {
          source: "red-tool-scrollbar-test",
        })
      );
      expect(result).toEqual({ ok: true, message: "Triggered Red Tool." });
      await expect(win).toBeVisible();
      await expect(win).toHaveAttribute("aria-hidden", "false");
      await expect(win).not.toHaveClass(/is-opening/);
      await expect(input).toBeFocused();

      await appendOverflowingConversation(page);
      const metrics = await measure(page);
      expect(metrics.chatOverflowY).toBe("auto");
      expect(metrics.chatClientHeight).toBeGreaterThan(0);
      expect(metrics.chatScrollHeight).toBeGreaterThan(metrics.chatClientHeight);
      expect(metrics.chatScrollWidth).toBeLessThanOrEqual(metrics.chatClientWidth);
      expect(metrics.chatScrollbarWidth).toBeGreaterThanOrEqual(0);
      expect(metrics.chatScrollbarWidth).toBeLessThanOrEqual(17);
      expect(metrics.chatWithinWindow).toBe(true);
      expect(metrics.documentOverflow).toBe(false);
      expect(metrics.win.left).toBeGreaterThanOrEqual(0);
      expect(metrics.win.right).toBeLessThanOrEqual(viewport.width);
      expect(metrics.win.top).toBeGreaterThanOrEqual(0);
      expect(metrics.win.bottom).toBeLessThanOrEqual(metrics.taskbar.top);

      const maximumScrollTop = metrics.chatScrollHeight - metrics.chatClientHeight;
      const middleScrollTop = Math.floor(maximumScrollTop / 2);
      await chat.evaluate((element, scrollTop) => {
        element.scrollTop = scrollTop;
      }, middleScrollTop);
      await chat.hover();
      await page.mouse.wheel(0, -120);
      await expect
        .poll(() => chat.evaluate((element) => element.scrollTop))
        .toBeLessThan(middleScrollTop);

      await chat.evaluate((element, scrollTop) => {
        element.scrollTop = scrollTop;
      }, middleScrollTop);
      await page.mouse.wheel(0, 120);
      await expect
        .poll(() => chat.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(middleScrollTop);

      await chat.evaluate((element) => {
        element.scrollTop = 0;
      });
      await chat.screenshot({
        path: testInfo.outputPath(`red-tool-chat-${viewport.width}x${viewport.height}.png`),
      });
      if (viewport.name === "mobile" || viewport.name === "desktop") {
        await page.screenshot({
          path: testInfo.outputPath(`red-tool-window-${viewport.width}x${viewport.height}.png`),
          fullPage: true,
        });
      }

      await close.focus();
      await expect(close).toBeFocused();
      await close.press("Enter");
      await expect(win).toHaveAttribute("aria-hidden", "true");
      await expect(win).toBeHidden();
    });
  }

  expect(consoleErrors).toEqual([]);
  expect(runtimeErrors).toEqual([]);
  expect(requestFailures).toEqual([]);
});
