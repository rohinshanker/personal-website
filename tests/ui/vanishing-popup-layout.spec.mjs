import { expect, test } from "./deterministic.mjs";
import {
  breakpointPair,
  DETERMINISTIC_RANDOM_DRAW,
  REVIEW_VIEWPORTS,
} from "./helpers/rendered-site.mjs";

const BUTTON_IDS = Object.freeze([
  "vanishing-popup-minimize",
  "vanishing-popup-maximize",
  "vanishing-popup-close",
  "vanishing-popup-yes",
  "vanishing-popup-no",
]);

const cases = Object.freeze([
  {
    ...REVIEW_VIEWPORTS[0],
    entry: "/home.html",
    motion: "no-preference",
    order: [
      "vanishing-popup-no",
      "vanishing-popup-minimize",
      "vanishing-popup-maximize",
      "vanishing-popup-close",
      "vanishing-popup-yes",
    ],
  },
  {
    ...REVIEW_VIEWPORTS[1],
    entry: "/index.html",
    motion: "reduce",
    order: [
      "vanishing-popup-yes",
      "vanishing-popup-close",
      "vanishing-popup-maximize",
      "vanishing-popup-minimize",
      "vanishing-popup-no",
    ],
  },
  {
    ...REVIEW_VIEWPORTS[2],
    entry: "/home.html",
    motion: "no-preference",
    order: [
      "vanishing-popup-yes",
      "vanishing-popup-no",
      "vanishing-popup-minimize",
      "vanishing-popup-maximize",
      "vanishing-popup-close",
    ],
  },
  {
    ...REVIEW_VIEWPORTS[3],
    entry: "/home.html",
    motion: "reduce",
    order: [
      "vanishing-popup-minimize",
      "vanishing-popup-yes",
      "vanishing-popup-close",
      "vanishing-popup-no",
      "vanishing-popup-maximize",
    ],
  },
  {
    ...breakpointPair("340px popup cap", { below: 371, above: 373, height: 812 })[0],
    entry: "/home.html",
    motion: "no-preference",
    order: [
      "vanishing-popup-close",
      "vanishing-popup-no",
      "vanishing-popup-maximize",
      "vanishing-popup-yes",
      "vanishing-popup-minimize",
    ],
  },
  {
    ...breakpointPair("340px popup cap", { below: 371, above: 373, height: 812 })[1],
    entry: "/home.html",
    motion: "reduce",
    order: [
      "vanishing-popup-maximize",
      "vanishing-popup-minimize",
      "vanishing-popup-yes",
      "vanishing-popup-no",
      "vanishing-popup-close",
    ],
  },
]);

const readGeometry = (page) =>
  page.evaluate((buttonIds) => {
    const measure = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        height: rect.height,
        pointerEvents: style.pointerEvents,
        visibility: style.visibility,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      };
    };
    return {
      buttons: Object.fromEntries(
        buttonIds.map((id) => [id, measure(document.getElementById(id))])
      ),
      popup: measure(document.getElementById("vanishing-popup-window")),
    };
  }, BUTTON_IDS);

const layoutBox = ({ height, width, x, y }) => ({ height, width, x, y });

const finishAnimation = (element, animationName) =>
  element.dispatchEvent("animationend", { animationName });

const enterHome = async (page, entry) => {
  await page.goto(entry, { waitUntil: "domcontentloaded" });
  if (entry === "/index.html") {
    await page
      .locator('.loader-window .title-bar-controls button[aria-label="Minimize"]')
      .click();
    await page.waitForURL(/\/home\.html$/);
  }
  await page.waitForFunction(() => window.homeEventRuntime?.randomEventDefinitions?.length);
  await page.locator("#about-window").evaluate((element) => {
    element.classList.remove("is-opening", "is-closing");
    element.classList.add("is-hidden");
    element.setAttribute("aria-hidden", "true");
  });
};

const openVanishingPopup = async (page) => {
  const popup = page.locator("#vanishing-popup-window");
  await page.evaluate(() => {
    const definition = window.homeEventRuntime.randomEventDefinitions.find(
      ({ id }) => id === "vanishing-popup-alert"
    );
    definition.run();
  });
  await expect(popup).toBeVisible();
  await finishAnimation(popup, "retro-window-open");
  await expect(popup).not.toHaveClass(/is-opening/);
  return popup;
};

const dragPopup = async (page, popup, viewport) => {
  const before = await popup.boundingBox();
  const titleBar = await popup.locator(".title-bar").boundingBox();
  expect(before).not.toBeNull();
  expect(titleBar).not.toBeNull();
  const deltaX = viewport.width > 500 ? 60 : 0;
  const deltaY = before.y > 180 ? -80 : 80;
  const startX = titleBar.x + titleBar.width / 2;
  const startY = titleBar.y + titleBar.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
  await page.mouse.up();
  const after = await popup.boundingBox();
  expect(after).not.toBeNull();
  expect({ height: after.height, width: after.width }).toEqual({
    height: before.height,
    width: before.width,
  });
  expect({ x: after.x, y: after.y }).not.toEqual({ x: before.x, y: before.y });
};

for (const scenario of cases) {
  test(`vanishing popup keeps its geometry at ${scenario.name}`, async ({ page }) => {
    await page.addInitScript((randomDraw) => {
      localStorage.clear();
      sessionStorage.clear();
      Math.random = () => randomDraw;
    }, DETERMINISTIC_RANDOM_DRAW);
    await page.emulateMedia({ reducedMotion: scenario.motion });
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await enterHome(page, scenario.entry);

    const popup = await openVanishingPopup(page);
    const explosion = page.locator("#vanishing-popup-explosion");
    const naturalBox = await popup.boundingBox();
    expect(naturalBox.width).toBeLessThanOrEqual(340);
    expect(naturalBox.height).toBeLessThan(150);
    await dragPopup(page, popup, scenario);
    const baseline = await readGeometry(page);

    for (const [index, buttonId] of scenario.order.entries()) {
      const button = page.locator(`#${buttonId}`);
      const clickPoint = baseline.buttons[buttonId];
      if (index === scenario.order.length - 1) {
        const explosionStart = new Date("2026-10-09T12:00:00Z");
        await page.clock.install({ time: explosionStart });
        await page.clock.pauseAt(explosionStart);
      }
      await button.click();
      await expect(button).toBeHidden();
      expect(await button.evaluate((element) => {
        element.focus();
        return document.activeElement === element;
      })).toBe(false);

      const geometry = await readGeometry(page);
      expect(layoutBox(geometry.popup)).toEqual(layoutBox(baseline.popup));
      expect(geometry.buttons[buttonId].pointerEvents).toBe("none");
      expect(geometry.buttons[buttonId].visibility).toBe("hidden");
      BUTTON_IDS.forEach((id) => {
        expect(layoutBox(geometry.buttons[id]), `${id} stays in place`).toEqual(
          layoutBox(baseline.buttons[id])
        );
      });

      await page.mouse.click(
        clickPoint.x + clickPoint.width / 2,
        clickPoint.y + clickPoint.height / 2
      );
      expect(
        await page.locator("[data-vanishing-popup-button][hidden]").count()
      ).toBe(index + 1);
    }

    await expect(popup).toHaveClass(/is-exploding/);
    await expect(explosion).toBeVisible();
    await expect(popup).toHaveCSS("pointer-events", "none");
    await expect(explosion).toHaveCSS("pointer-events", "none");

    const overlay = await explosion.boundingBox();
    const explodingPopup = await popup.boundingBox();
    expect(overlay.height).toBeGreaterThan(explodingPopup.height);
    expect(Math.abs(overlay.x + overlay.width / 2 - (explodingPopup.x + explodingPopup.width / 2)))
      .toBeLessThan(1);
    expect(Math.abs(overlay.y + overlay.height / 2 - (explodingPopup.y + explodingPopup.height / 2)))
      .toBeLessThan(1);
    expect(
      await explosion.evaluate((element) => Number(getComputedStyle(element).zIndex))
    ).toBeGreaterThan(
      await popup.evaluate((element) => Number(getComputedStyle(element).zIndex))
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      scenario.width
    );

    await page.clock.fastForward(1799);
    await expect(popup).toHaveAttribute("aria-hidden", "false");
    await page.clock.fastForward(1);
    await expect(popup).toHaveAttribute("aria-hidden", "true");
    await finishAnimation(popup, "retro-window-close");
    await expect(popup).toBeHidden();
    await expect(explosion).toBeHidden();
    expect(await explosion.getAttribute("src")).toBeNull();

    await openVanishingPopup(page);
    await expect(popup.locator("[data-vanishing-popup-button]")).toHaveCount(5);
    for (const buttonId of BUTTON_IDS) {
      const button = page.locator(`#${buttonId}`);
      await expect(button).toBeVisible();
      expect(await button.evaluate((element) => element.hidden)).toBe(false);
    }
    await expect(popup).not.toHaveClass(/is-exploding/);
    expect(await explosion.getAttribute("style")).toBeNull();
  });
}
