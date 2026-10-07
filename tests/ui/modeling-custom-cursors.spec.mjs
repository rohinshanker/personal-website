import { expect, test } from "./deterministic.mjs";
import {
  DETERMINISTIC_RANDOM_DRAW,
  FROZEN_INSTANT,
  REVIEW_VIEWPORT,
  REVIEW_VIEWPORTS,
  TEST_SERVER_ORIGIN,
  installStubbedModelingMedia,
  openHomeDesktop,
  settleRender,
} from "./helpers/rendered-site.mjs";

/**
 * The modeling portfolio runs Home's cursor system rather than one of its own:
 * the same stylesheet, the same stored preference, and the same text-selection
 * watcher. These checks read the cursor the browser actually resolves, so a
 * token that stops reaching the route fails here even while the CSS still
 * parses.
 */

test.setTimeout(180_000);

const CURSOR_MODE_KEY = "rohin-os-cursor-mode";
const HOVER_CLASS = "is-custom-cursor-text-hover";
const LOADING_CLASS = "is-custom-cursor-loading";

/** The generated image a resolved cursor points at, which is what a visitor sees. */
const cursorToken = (locator) =>
  locator.evaluate(
    (element) =>
      getComputedStyle(element).cursor.match(/generated-png\/([a-z-]+)-(?:light|dark)\.png/)?.[1] ??
      getComputedStyle(element).cursor
  );

const cursorPack = (locator) =>
  locator.evaluate(
    (element) => getComputedStyle(element).cursor.match(/-(light|dark)\.png/)?.[1] ?? null
  );

const isModelingPhoto = (url) =>
  url.origin === TEST_SERVER_ORIGIN && /^\/assets\/modeling\/.+\.(?:jpe?g|png)$/i.test(url.pathname);

/**
 * Holds every modeling photo until the returned callback runs, so a loading
 * state can be observed instead of raced.
 *
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<() => void>} releases the held responses.
 */
const holdModelingPhotos = async (page) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(isModelingPhoto, async (route) => {
    await held;
    await route.fallback();
  });
  return release;
};

/**
 * Opens `/modeling/` with the stubbed media the route suite already uses.
 *
 * @param {import("@playwright/test").Page} page
 * @param {{width: number, height: number}} viewport
 * @param {{cursorMode?: string, settle?: boolean, prepare?: Function}} options
 *   `prepare` runs after the media stubs, so a route it registers answers first.
 */
const openModeling = async (page, viewport, { cursorMode, settle = true, prepare } = {}) => {
  await installStubbedModelingMedia(page);
  if (prepare) await prepare(page);
  await page.clock.setFixedTime(FROZEN_INSTANT);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(viewport);
  await page.addInitScript(
    ({ draw, key, mode }) => {
      localStorage.clear();
      sessionStorage.clear();
      if (mode) localStorage.setItem(key, mode);
      Math.random = () => draw;
    },
    { draw: DETERMINISTIC_RANDOM_DRAW, key: CURSOR_MODE_KEY, mode: cursorMode ?? null }
  );
  await page.goto("/modeling/", { waitUntil: settle ? "load" : "domcontentloaded" });
  await expect(page.locator("section.shoot").first()).toBeVisible();
  if (settle) await settleRender(page);
};

/** A point inside a real glyph of the locator's first visible text line. */
const textPoint = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  return locator.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode && !/\S/.test(textNode.textContent || "")) textNode = walker.nextNode();
    if (!textNode) throw new Error("The hover target has no visible text node.");
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rect = Array.from(range.getClientRects()).find(
      (candidate) => candidate.width >= 24 && candidate.height > 0
    );
    if (!rect) throw new Error("The hover target has no usable text line.");
    return { x: rect.left + 5, y: rect.top + rect.height / 2 };
  });
};

const hoverCount = (page) =>
  page.evaluate(
    (className) => document.querySelectorAll(`.${className}`).length,
    HOVER_CLASS
  );

const expectHorizontalFit = async (page) => {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  ).toBe(false);
};

test("the route resolves the shared cursor tokens at every review viewport", async ({
  page,
}) => {
  await openModeling(page, REVIEW_VIEWPORT.desktop);

  for (const viewport of REVIEW_VIEWPORTS) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await settleRender(page);

      // Ordinary page surface, links, buttons, and disclosure summaries.
      expect(await cursorToken(page.locator("body"))).toBe("normal");
      expect(await cursorToken(page.locator(".portfolio-home__link"))).toBe("select");
      expect(await cursorToken(page.locator("[data-portfolio-instagram]"))).toBe("select");
      expect(await cursorToken(page.locator(".unit-toggle__button").first())).toBe("select");
      expect(await cursorToken(page.locator(".carousel__photo").first())).toBe("select");
      expect(await cursorToken(page.locator(".carousel__control").first())).toBe("select");
      expect(await cursorToken(page.locator(".shoot__expand").first())).toBe("select");
      expect(await cursorToken(page.locator(".portfolio-nav__summary"))).toBe("select");

      // These windows are fixed page sections, so their title bars must not
      // advertise a drag the route cannot perform.
      expect(await cursorToken(page.locator(".portfolio-header > .title-bar"))).toBe("normal");
      expect(await cursorToken(page.locator("section.shoot > .title-bar").first())).toBe(
        "normal"
      );

      // Real selectable copy takes the I-beam, and only the hovered host.
      const summary = page.locator(".portfolio-summary");
      const point = await textPoint(summary);
      await page.mouse.move(point.x, point.y);
      await expect(summary).toHaveClass(new RegExp(`(?:^|\\s)${HOVER_CLASS}(?:\\s|$)`));
      await expect.poll(() => hoverCount(page)).toBe(1);
      expect(await cursorToken(summary)).toBe("text");

      // Moving onto a link hands the pointer back to the semantic token.
      await page.locator(".portfolio-home__link").hover();
      await expect.poll(() => hoverCount(page)).toBe(0);
      expect(await cursorToken(page.locator(".portfolio-home__link"))).toBe("select");

      await expectHorizontalFit(page);
    });
  }
});

test("the stored Cursor Settings preference picks the pack, including from an open Home tab", async ({
  context,
  page,
}) => {
  await openModeling(page, REVIEW_VIEWPORT.desktop, { cursorMode: "dark" });

  await expect(page.locator("html")).toHaveClass(/is-cursor-dark-mode/);
  await expect(page.locator("body")).toHaveClass(/is-cursor-dark-mode/);
  for (const locator of [
    page.locator("body"),
    page.locator(".portfolio-home__link"),
    page.locator(".carousel__control").first(),
    page.locator(".portfolio-header > .title-bar"),
  ]) {
    expect(await cursorPack(locator)).toBe("dark");
  }

  // Home owns the setting; an already-open modeling tab follows it.
  const home = await context.newPage();
  await openHomeDesktop(home, REVIEW_VIEWPORT.desktop);
  await home.locator('.desktop-icon[data-app="cursor"]').click();
  const cursorWindow = home.locator('[data-app-window="cursor"]');
  await expect(cursorWindow).toBeVisible();

  await cursorWindow.locator('[data-cursor-mode="dark"]').click();
  await expect(page.locator("body")).toHaveClass(/is-cursor-dark-mode/);
  expect(await cursorPack(page.locator("body"))).toBe("dark");

  await cursorWindow.locator('[data-cursor-mode="light"]').click();
  await expect(page.locator("body")).not.toHaveClass(/is-cursor-dark-mode/);
  expect(await cursorPack(page.locator("body"))).toBe("light");
  await home.close();

  await expectHorizontalFit(page);
});

test("the fullscreen viewer shows the working cursor only while its own media loads", async ({
  page,
}) => {
  let releasePhotos;
  await openModeling(page, REVIEW_VIEWPORT.desktop, {
    settle: false,
    prepare: async (target) => {
      releasePhotos = await holdModelingPhotos(target);
    },
  });

  // Lazy carousel slides keep their own hourglass: scrolling past them must
  // not turn the whole pointer over.
  await expect(page.locator(".carousel__slide[aria-busy='true']").first()).toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(new RegExp(LOADING_CLASS));
  expect(await cursorToken(page.locator("body"))).toBe("normal");

  const viewer = page.locator("[data-lightbox]");
  await page.locator(".carousel__photo").first().click();
  await expect(viewer).toBeVisible();

  const stage = page.locator("[data-lightbox-stage]");
  await expect(stage).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("body")).toHaveClass(new RegExp(LOADING_CLASS));
  // Reduced motion holds the animation on its first frame.
  expect(await cursorToken(page.locator("body"))).toContain(
    "working-in-background-light-1.png"
  );

  // The viewer chrome keeps its own semantics once the wait is over.
  releasePhotos();
  await expect(stage).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator("body")).not.toHaveClass(new RegExp(LOADING_CLASS));
  expect(await cursorToken(page.locator("body"))).toBe("normal");
  expect(await cursorToken(page.locator(".lightbox__window > .title-bar"))).toBe("normal");
  expect(await cursorToken(page.locator(".lightbox__close"))).toBe("select");
  expect(await cursorToken(page.locator(".lightbox__control").first())).toBe("select");
  expect(await cursorToken(page.locator(".lightbox__download"))).toBe("select");

  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(page.locator("body")).not.toHaveClass(new RegExp(LOADING_CLASS));
  expect(await cursorToken(page.locator("body"))).toBe("normal");
  await expectHorizontalFit(page);
});

test.describe("real touch input", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: REVIEW_VIEWPORT.mobile });

  test("tapping the route never leaves sticky text cursor state", async ({ page }) => {
    await openModeling(page, REVIEW_VIEWPORT.mobile);

    const summary = page.locator(".portfolio-summary");
    const point = await textPoint(summary);
    await page.touchscreen.tap(point.x, point.y);
    await expect.poll(() => hoverCount(page)).toBe(0);
    await expect(page.locator("html")).not.toHaveClass(/is-custom-cursor-text-selecting/);

    // A photo still opens and closes the viewer under touch.
    await page.locator(".carousel__photo").first().click();
    await expect(page.locator("[data-lightbox]")).toBeVisible();
    await page.locator(".lightbox__close").click();
    await expect(page.locator("[data-lightbox]")).toBeHidden();
    await expect.poll(() => hoverCount(page)).toBe(0);
    await expectHorizontalFit(page);
  });
});
