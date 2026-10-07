import { expect, test } from "./deterministic.mjs";
import { routeHomeScript } from "./helpers/home-script-routes.mjs";

test.setTimeout(180_000);

const viewports = Object.freeze([
  { name: "small-mobile", width: 320, height: 568 },
  { name: "mobile", width: 375, height: 812 },
  { name: "short-landscape", width: 568, height: 320 },
  { name: "below-shell-cap", width: 461, height: 812 },
  { name: "above-shell-cap", width: 463, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
]);

const dispatchCloseAnimationEnd = (locator) =>
  locator.dispatchEvent("animationend", { animationName: "retro-window-close" });

const measureLainWindow = (page) =>
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
    const win = document.querySelector("#lain-alert-window");
    const title = document.querySelector("#lain-alert-title");
    const close = document.querySelector("#lain-alert-close");
    const image = document.querySelector(".lain-alert-image");
    const imageFrame = document.querySelector(".lain-alert-image-frame");
    const chat = document.querySelector("#lain-alert-chat-log");
    const message = document.querySelector(".lain-alert-message");
    const systemAlert = document.querySelector(".lain-alert-system-alert");
    const taskbar = document.querySelector(".taskbar");
    const winBounds = bounds(win);
    const isContained = (element) => {
      const rect = bounds(element);
      return (
        rect.left >= winBounds.left &&
        rect.right <= winBounds.right &&
        rect.top >= winBounds.top &&
        rect.bottom <= winBounds.bottom
      );
    };
    return {
      chatClientHeight: chat.clientHeight,
      chatScrollHeight: chat.scrollHeight,
      chatWithinWindow: isContained(chat),
      closeWithinWindow: isContained(close),
      documentOverflow:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.documentElement.scrollHeight > window.innerHeight,
      imageNaturalHeight: image.videoHeight,
      imageNaturalWidth: image.videoWidth,
      imageObjectFit: getComputedStyle(image).objectFit,
      imageFramePadding: Number.parseFloat(getComputedStyle(imageFrame).paddingTop),
      imageWithinFrame: (() => {
        const frameBounds = bounds(imageFrame);
        const imageBounds = bounds(image);
        return (
          imageBounds.left > frameBounds.left &&
          imageBounds.right < frameBounds.right &&
          imageBounds.top > frameBounds.top &&
          imageBounds.bottom < frameBounds.bottom
        );
      })(),
      imageWithinWindow: isContained(image),
      messageBeforeSystemAlert:
        bounds(message).top < bounds(systemAlert).top,
      messageWithinWindow: isContained(message),
      systemAlertWithinWindow: isContained(systemAlert),
      taskbar: bounds(taskbar),
      titleWithinWindow: isContained(title),
      win: winBounds,
    };
  });

test("The Wired message is read-only, focused, and contained across viewports", async ({
  page,
}) => {

  await page.setViewportSize(viewports[0]);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => 0.999999;
  });
  await page.goto("/home.html", { waitUntil: "load" });
  await page.evaluate(() => window.homeResources.loadAdminResources());
  await page.locator('#about-window [data-close="about"]').click();
  await expect(page.locator("#about-window")).toBeHidden();

  const win = page.locator("#lain-alert-window");
  const close = page.locator("#lain-alert-close");
  const image = page.locator(".lain-alert-image");
  const chat = page.getByRole("log", { name: "Message history" });

  for (const [index, viewport] of viewports.entries()) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await page.evaluate(() => {
        const previous = document.querySelector("#lain-test-focus-origin");
        previous?.remove();
        const origin = document.createElement("button");
        origin.id = "lain-test-focus-origin";
        origin.textContent = "Open Wired test message";
        origin.style.cssText =
          "position:fixed;left:1px;top:1px;width:1px;height:1px;opacity:0;overflow:hidden";
        document.body.append(origin);
        origin.focus({ preventScroll: true });
      });
      await expect(page.locator("#lain-test-focus-origin")).toBeFocused();

      const result = await page.evaluate(() =>
        window.rohinAdminOrchestrator.runEvent("lain-system-alert", {
          source: "lain-wired-chat-test",
        })
      );
      expect(result).toEqual({
        ok: true,
        message: "Triggered Lain System Alert.",
      });

      const dialog = page.getByRole("dialog", {
        name: "The Wired: New Message",
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleDescription(
        "Admin: No matter where you go, everyone is connected."
      );
      await expect(win).toHaveAttribute("aria-hidden", "false");
      await expect(win).not.toHaveClass(/is-opening/);
      await expect(close).toBeFocused();
      await expect(close).toHaveAccessibleName("Close");
      await expect
        .poll(() => image.evaluate((element) => element.currentSrc))
        .toMatch(/assets\/optimized\/random-events\/lain\.(?:webm|mp4)$/);
      await expect(
        chat.locator(".red-tool-message.lain-alert-message")
      ).toHaveCount(1);
      const systemAlert = chat.locator(".lain-alert-system-alert");
      const adminMessage = chat.locator(".lain-alert-message");
      const chatRows = chat.locator(
        ":scope > .lain-alert-message, :scope > .lain-alert-system-alert"
      );
      await expect(chatRows).toHaveCount(2);
      await expect(chatRows.nth(0)).toHaveClass(/lain-alert-message/);
      await expect(chatRows.nth(1)).toHaveClass(/lain-alert-system-alert/);
      await expect(systemAlert).toHaveCount(1);
      await expect(systemAlert.locator("img")).toHaveAttribute(
        "src",
        "assets/app-icons/ico/msg_information.ico"
      );
      await expect(systemAlert.locator("strong")).toHaveText("System Alert:");
      await expect(systemAlert.locator("p")).toHaveText(
        "System Alert: You cannot send any messages in this chat."
      );
      await expect(adminMessage.locator("strong")).toHaveText("Admin:");
      await expect(adminMessage.locator("p")).toHaveText(
        "Admin: No matter where you go, everyone is connected."
      );
      await expect(adminMessage.locator("img")).toHaveAttribute(
        "src",
        "assets/app-icons/ico/user_computer.ico"
      );
      const reply = dialog.getByRole("textbox", { name: "Reply unavailable" });
      const send = dialog.getByRole("button", { name: "Send" });
      await expect(dialog.locator("textarea, [contenteditable]")).toHaveCount(0);
      await expect(reply).toHaveCount(1);
      await expect(reply).toBeDisabled();
      await expect(reply).toHaveAttribute("placeholder", "Replies are disabled");
      await expect(send).toBeDisabled();
      await expect(dialog.getByRole("button")).toHaveCount(2);
      await expect(dialog.getByText(/^(?:Reply|OK)$/i)).toHaveCount(0);

      await expect
        .poll(() => image.evaluate((element) => element.videoWidth))
        .toBe(500);
      await expect
        .poll(() => image.evaluate((element) => element.paused))
        .toBe(false);
      const metrics = await measureLainWindow(page);
      expect(metrics.imageNaturalWidth).toBe(500);
      expect(metrics.imageNaturalHeight).toBe(352);
      expect(metrics.imageObjectFit).toBe("contain");
      expect(metrics.imageFramePadding).toBe(6);
      expect(metrics.imageWithinFrame).toBe(true);
      expect(metrics.chatScrollHeight).toBeLessThanOrEqual(
        metrics.chatClientHeight + 1
      );
      expect(metrics.chatWithinWindow).toBe(true);
      expect(metrics.closeWithinWindow).toBe(true);
      expect(metrics.imageWithinWindow).toBe(true);
      expect(metrics.messageBeforeSystemAlert).toBe(true);
      expect(metrics.messageWithinWindow).toBe(true);
      expect(metrics.systemAlertWithinWindow).toBe(true);
      expect(metrics.titleWithinWindow).toBe(true);
      expect(metrics.documentOverflow).toBe(false);
      expect(metrics.win.left).toBeGreaterThanOrEqual(0);
      expect(metrics.win.right).toBeLessThanOrEqual(viewport.width);
      expect(metrics.win.top).toBeGreaterThanOrEqual(0);
      expect(metrics.win.bottom).toBeLessThanOrEqual(metrics.taskbar.top);

      if (
        viewport.name === "small-mobile" ||
        viewport.name === "short-landscape" ||
        viewport.name === "desktop"
      ) {
      }

      if (index % 2 === 0) {
        await close.press("Escape");
      } else {
        await close.press("Enter");
      }
      await expect(win).toHaveAttribute("aria-hidden", "true");
      await dispatchCloseAnimationEnd(win);
      await expect(win).toBeHidden();
      await expect(page.locator("#lain-test-focus-origin")).toBeFocused();
      // The loop keeps its decoded sources for the next trigger but must not run
      // while the window is hidden.
      await expect.poll(() => image.evaluate((element) => element.paused)).toBe(true);
    });
  }

});

test("Lain and Red Tool stay normal through a live cooldown and remain explicitly triggerable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    Math.random = () => 0;
  });
  await routeHomeScript(page, "eventRuntime", (source) =>
    source.replace(
      /\n\}\)\(\);\s*$/,
      `
window.__wiredNormalTest = Object.freeze({
  lockCooldown() {
    randomEventTriggerCooldownUntil = Date.now() + 60_000;
    return randomEventTriggerCooldownUntil;
  },
  trigger() {
    return window.homeActivity.notifyActivity("pageReload");
  },
});
})();`
    )
  );
  await page.goto("/home.html", { waitUntil: "load" });
  await page.evaluate(() => window.homeResources.loadAdminResources());

  const cooldownUntil = await page.evaluate(() =>
    window.__wiredNormalTest.lockCooldown()
  );
  expect(cooldownUntil).toBeGreaterThan(Date.now());
  expect(await page.evaluate(() => window.__wiredNormalTest.trigger())).toBe(false);

  const lainWindow = page.locator("#lain-alert-window");
  await expect(lainWindow).toBeHidden();
  await expect(page.locator("#red-tool-window")).toBeHidden();
  expect(
    await page.evaluate(() =>
      window.rohinAdminOrchestrator.runEvent("lain-system-alert", {
        source: "lain-normal-mode-test",
      })
    )
  ).toEqual({ ok: true, message: "Triggered Lain System Alert." });
  await expect(lainWindow).toBeVisible();
  await expect(page.locator("#lain-alert-close")).toBeFocused();
  await page.locator("#lain-alert-close").press("Enter");
  await dispatchCloseAnimationEnd(lainWindow);
  await expect(lainWindow).toBeHidden();

  expect(await page.evaluate(() => window.__wiredNormalTest.trigger())).toBe(false);
  const redToolWindow = page.locator("#red-tool-window");
  const redToolInput = page.locator("#red-tool-input");
  await expect(redToolWindow).toBeHidden();
  expect(
    await page.evaluate(() =>
      window.rohinAdminOrchestrator.runEvent("red-tool", {
        source: "red-tool-normal-mode-test",
      })
    )
  ).toEqual({ ok: true, message: "Triggered Red Tool." });
  await expect(redToolWindow).toBeVisible();
  await expect(redToolInput).toBeFocused();
  await expect(redToolInput).toBeEnabled();
  await expect(page.locator("#red-tool-send")).toBeEnabled();
  await redToolInput.fill("Is anyone there?");
  await redToolInput.press("Enter");
  await expect(
    page.locator("#red-tool-chat-log .red-tool-message.is-local")
  ).toHaveCount(1);
  await expect(
    page.locator("#red-tool-chat-log .red-tool-message.is-local p")
  ).toHaveText("You: Is anyone there?");
  await expect(redToolInput).toBeDisabled();

  await page.locator("#red-tool-close").press("Enter");
  await dispatchCloseAnimationEnd(redToolWindow);
  await expect(redToolWindow).toBeHidden();
});
