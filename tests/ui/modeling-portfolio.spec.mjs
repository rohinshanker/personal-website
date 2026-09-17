import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { expect, test } from "./deterministic.mjs";
import {
  REVIEW_VIEWPORTS,
  installStubbedModelingMedia,
  settleRender,
} from "./helpers/rendered-site.mjs";

test.setTimeout(120_000);

const MOBILE = REVIEW_VIEWPORTS.find((viewport) => viewport.name === "mobile");
const DESKTOP = REVIEW_VIEWPORTS.find((viewport) => viewport.name === "desktop");

const portfolioSource = await readFile(
  new URL("../../scripts/home/modeling-portfolio.js", import.meta.url),
  "utf8"
);
const portfolio = (() => {
  const context = { window: {} };
  vm.runInNewContext(portfolioSource, context);
  return JSON.parse(JSON.stringify(context.window.rohinModelingPortfolio));
})();
const anchorId = (id) => id.replace(/^modeling-/, "");
const shootById = (id) => portfolio.shoots.find((shoot) => shoot.id === id);

const STAND_STILL = shootById("modeling-stand-still-drop");
const CIRQUE = shootById("modeling-garb-cirque-du-moi-runway-show");
const MERCH = shootById("modeling-garb-merch-promo-shoot");
const LAST = portfolio.shoots[portfolio.shoots.length - 1];

/**
 * Opens the route with stubbed media. `prepare` runs after the stubs are
 * installed and before navigation, so a spec can layer a more specific route
 * on top of them.
 */
const openPortfolio = async (
  page,
  viewport,
  { path = "/modeling/", prepare, waitUntil = "load", settle = true } = {}
) => {
  await installStubbedModelingMedia(page);
  if (prepare) await prepare(page);
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(path, { waitUntil });
  await expect(page.locator("section.shoot")).toHaveCount(portfolio.shoots.length);
  if (settle) await settleRender(page);
};

const section = (page, shoot) => page.locator(`#${anchorId(shoot.id)}`);
const strip = (page, shoot) => section(page, shoot).locator(".carousel__strip");
const counter = (page, shoot) => section(page, shoot).locator(".carousel__counter");
const slide = (page, shoot, index) =>
  section(page, shoot).locator(`[data-carousel-slide="${index}"]`);
const slideMedia = (page, shoot, index) => slide(page, shoot, index).locator("[data-src]");
const lightbox = (page) => page.locator("[data-lightbox]");

const box = (locator) =>
  locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
  });

const documentOverflows = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

const expectStripAt = async (page, shoot, index) => {
  await expect
    .poll(() =>
      strip(page, shoot).evaluate(
        (element, target) => Math.abs(element.scrollLeft - target * element.clientWidth) < 2,
        index
      )
    )
    .toBe(true);
};

test("renders the header and every shoot in order without overflow at each review viewport", async ({
  page,
}, testInfo) => {
  for (const viewport of REVIEW_VIEWPORTS) {
    await test.step(viewport.name, async () => {
      await openPortfolio(page, viewport);

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Rohin Shanker Modeling Portfolio"
      );
      const instagram = page.locator("[data-portfolio-instagram]");
      await expect(instagram).toHaveAttribute("href", portfolio.instagram.href);
      await expect(instagram).toContainText(portfolio.instagram.handle);
      await expect(instagram).toHaveAttribute("target", "_blank");
      for (const label of ["Dropbox Highlights", "Dropbox Digitals"]) {
        const pending = page.getByRole("button", { name: label });
        await expect(pending).toBeDisabled();
        await expect(pending).toHaveAccessibleDescription("Link coming soon");
      }
      await expect(page.locator(".portfolio-link__note")).toHaveCount(2);

      const nav = page.getByRole("navigation", { name: "Shoots" });
      await expect(nav.locator("summary")).toHaveText(
        `Jump to a shoot (${portfolio.shoots.length})`
      );
      await expect(nav.locator("details")).not.toHaveAttribute("open", "");
      await nav.locator("summary").click();
      const navLinks = nav.getByRole("link");
      await expect(navLinks).toHaveCount(portfolio.shoots.length);
      await expect(navLinks).toHaveText(
        portfolio.shoots.map((shoot) => `${shoot.title}${shoot.date}`)
      );
      await nav.locator("summary").click();

      const sections = page.locator("section.shoot");
      await expect(sections).toHaveCount(portfolio.shoots.length);
      const headings = page.locator("section.shoot h2");
      await expect(headings).toHaveText(portfolio.shoots.map((shoot) => shoot.title));
      await expect(page.locator("section.shoot .shoot__date")).toHaveText(
        portfolio.shoots.map((shoot) => shoot.date)
      );
      for (const shoot of [STAND_STILL, CIRQUE, LAST]) {
        await expect(section(page, shoot)).toHaveAttribute("id", anchorId(shoot.id));
        await expect(section(page, shoot).locator("[data-carousel-slide]")).toHaveCount(
          shoot.files.length
        );
        await expect(counter(page, shoot)).toHaveText(`1 of ${shoot.files.length}`);
        await expect(section(page, shoot).locator(".shoot__link")).toHaveText(
          shoot.links.map((link) => link.label)
        );
      }

      expect(await documentOverflows(page)).toBe(false);
      const widths = await sections.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width)
      );
      expect(Math.max(...widths)).toBeLessThanOrEqual(viewport.width);

      const dateBox = await box(section(page, CIRQUE).locator(".shoot__date"));
      const carouselBox = await box(section(page, CIRQUE).locator(".carousel"));
      const linksBox = await box(section(page, CIRQUE).locator(".shoot__links"));
      const creditsBox = await box(section(page, CIRQUE).locator(".shoot__credits"));
      if (viewport.width >= 900) {
        expect(carouselBox.right).toBeLessThanOrEqual(dateBox.left);
        expect(dateBox.bottom).toBeLessThanOrEqual(linksBox.top);
        expect(linksBox.bottom).toBeLessThanOrEqual(creditsBox.top);
      } else {
        expect(dateBox.bottom).toBeLessThanOrEqual(carouselBox.top);
        expect(carouselBox.bottom).toBeLessThanOrEqual(linksBox.top);
        expect(linksBox.bottom).toBeLessThanOrEqual(creditsBox.top);
      }

      await page.screenshot({
        path: testInfo.outputPath(`modeling-${viewport.name}.png`),
        fullPage: false,
      });
    });
  }
});

test("loads only nearby slides and moves through Previous, Next, and the arrow keys", async ({
  page,
}) => {
  await openPortfolio(page, DESKTOP);

  await expect(slideMedia(page, STAND_STILL, 0)).toHaveAttribute("src", /1\.mp4$/);
  await expect(slideMedia(page, STAND_STILL, 1)).toHaveAttribute("src", /2\.jpg$/);
  for (const index of [2, 3, 4, 5]) {
    await expect(slideMedia(page, STAND_STILL, index)).not.toHaveAttribute("src", /./);
  }
  await expect(section(page, LAST).locator("[data-src][src]")).toHaveCount(0);

  await section(page, STAND_STILL).getByRole("button", { name: "Next photo" }).click();
  await expect(counter(page, STAND_STILL)).toHaveText("2 of 6");
  await expectStripAt(page, STAND_STILL, 1);
  await expect(slideMedia(page, STAND_STILL, 2)).toHaveAttribute("src", /3\.jpg$/);
  await expect(slideMedia(page, STAND_STILL, 4)).not.toHaveAttribute("src", /./);

  await slide(page, STAND_STILL, 1).locator("button").focus();
  await page.keyboard.press("ArrowRight");
  await expect(counter(page, STAND_STILL)).toHaveText("3 of 6");
  await expect(slide(page, STAND_STILL, 2).locator("button")).toBeFocused();
  await expectStripAt(page, STAND_STILL, 2);

  const previous = section(page, STAND_STILL).getByRole("button", { name: "Previous photo" });
  await previous.click();
  await previous.click();
  await expect(counter(page, STAND_STILL)).toHaveText("1 of 6");
  await previous.click();
  await expect(counter(page, STAND_STILL)).toHaveText("6 of 6");
  await expectStripAt(page, STAND_STILL, 5);

  await section(page, LAST).scrollIntoViewIfNeeded();
  await expect(slideMedia(page, LAST, 0)).toHaveAttribute("src", /\.jpg$/i);
  await expect(slideMedia(page, LAST, 1)).toHaveAttribute("src", /\.jpg$/i);
  await expect(slideMedia(page, LAST, 3)).not.toHaveAttribute("src", /./);
});

test("shows the Home hourglass over a photo until it finishes loading", async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  // The gated photo is requested during page load, so the load event and the
  // render settle would both wait on it; enter as soon as the DOM is ready.
  await openPortfolio(page, DESKTOP, {
    waitUntil: "domcontentloaded",
    settle: false,
    prepare: (target) =>
      target.route(/\/assets\/modeling\/garb-merch-lighter-promo-feb26\/2\.jpg$/, async (route) => {
        await gate;
        await route.fulfill({
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mNk+M/wHwAF/gL+q0g9QAAAAABJRU5ErkJggg==",
            "base64"
          ),
          contentType: "image/png",
        });
      }),
  });
  await section(page, MERCH).scrollIntoViewIfNeeded();

  const first = slide(page, MERCH, 0);
  const indicator = first.locator(".media-loading");
  await expect(indicator).toBeVisible();
  await expect(indicator.locator("img")).toHaveAttribute(
    "src",
    /windows98-hourglass(?:-padded)?-2x\.gif$/
  );
  await expect(first).toHaveAttribute("aria-busy", "true");

  release();
  await expect(indicator).toBeHidden();
  await expect(first).not.toHaveAttribute("aria-busy", /./);
  await settleRender(page);
});

test("keeps credits collapsed until opened and omits them for shoots without credits", async ({
  page,
}) => {
  await openPortfolio(page, DESKTOP);

  const credits = section(page, CIRQUE).locator("details.shoot__credits");
  await expect(credits).toHaveCount(1);
  await expect(credits).not.toHaveAttribute("open", "");
  await expect(credits.locator("summary")).toHaveText("Credits");
  await expect(credits.locator("li").first()).toBeHidden();
  await credits.locator("summary").click();
  await expect(credits).toHaveAttribute("open", "");
  await expect(credits.locator("li")).toHaveText(CIRQUE.credits);

  expect(MERCH.credits).toEqual([]);
  await expect(section(page, MERCH).locator("details.shoot__credits")).toHaveCount(0);
});

test("opens photos fullscreen, keeps the scroll position, traps focus, and restores it", async ({
  page,
}) => {
  await openPortfolio(page, DESKTOP);
  await section(page, CIRQUE).scrollIntoViewIfNeeded();
  const startY = await page.evaluate(() => window.scrollY);
  expect(startY).toBeGreaterThan(0);

  const opener = slide(page, CIRQUE, 0).locator("button");
  await opener.click();
  const viewer = lightbox(page);
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute("aria-modal", "true");
  await expect(viewer).toHaveAccessibleName(CIRQUE.title);
  await expect(viewer.locator("[data-lightbox-counter]")).toHaveText("1 of 5");
  await expect(viewer.locator(".lightbox__image")).toHaveAttribute("src", /\/1\.jpg$/);
  await expect(viewer.locator(".lightbox__image")).toHaveAttribute(
    "alt",
    `${CIRQUE.title}, photo 1 of 5`
  );
  const close = viewer.getByRole("button", { name: "Close fullscreen view" });
  await expect(close).toBeFocused();
  await expect(page.locator("html")).toHaveClass(/is-lightbox-open/);
  expect(await page.evaluate(() => getComputedStyle(document.body).position)).toBe("fixed");
  await expect(page.locator("header")).toHaveAttribute("inert", "");
  await expect(page.locator("main")).toHaveAttribute("inert", "");

  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator("[data-lightbox-counter]")).toHaveText("2 of 5");
  await expect(viewer.locator(".lightbox__image")).toHaveAttribute("src", /\/2\.jpg$/);
  await expect(counter(page, CIRQUE)).toHaveText("2 of 5");
  await viewer.getByRole("button", { name: "Next photo" }).click();
  await expect(viewer.locator("[data-lightbox-counter]")).toHaveText("3 of 5");
  await viewer.getByRole("button", { name: "Previous photo" }).click();
  await expect(viewer.locator("[data-lightbox-counter]")).toHaveText("2 of 5");

  await close.focus();
  await page.keyboard.press("Tab");
  await expect(viewer.getByRole("button", { name: "Previous photo" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(viewer.getByRole("link", { name: "Download photo 2 of 5" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(viewer.getByRole("button", { name: "Next photo" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(viewer.getByRole("button", { name: "Next photo" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(page.locator("html")).not.toHaveClass(/is-lightbox-open/);
  await expect(page.locator("main")).not.toHaveAttribute("inert", "");
  expect(await page.evaluate(() => window.scrollY)).toBe(startY);
  await expect(opener).toBeFocused();

  const maximize = section(page, CIRQUE).getByRole("button", {
    name: `Expand ${CIRQUE.title} fullscreen`,
  });
  await expect(maximize).toHaveText("Expand");
  await maximize.click();
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("[data-lightbox-counter]")).toHaveText("2 of 5");
  await close.click();
  await expect(viewer).toBeHidden();
  await expect(maximize).toBeFocused();

  await opener.click();
  await expect(viewer).toBeVisible();
  await viewer.locator(".lightbox__backdrop").click({ position: { x: 4, y: 4 } });
  await expect(viewer).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBe(startY);
});

test("swiping in the fullscreen viewer changes the photo", async ({ page }) => {
  await openPortfolio(page, MOBILE);
  await section(page, CIRQUE).scrollIntoViewIfNeeded();
  await slide(page, CIRQUE, 0).locator("button").click();
  const viewer = lightbox(page);
  await expect(viewer).toBeVisible();

  const stage = await box(viewer.locator("[data-lightbox-stage]"));
  const centerY = (stage.top + stage.bottom) / 2;
  await page.mouse.move(stage.right - 40, centerY);
  await page.mouse.down();
  await page.mouse.move(stage.left + 40, centerY, { steps: 6 });
  await page.mouse.up();
  await expect(viewer.locator("[data-lightbox-counter]")).toHaveText("2 of 5");

  await page.mouse.move(stage.left + 40, centerY);
  await page.mouse.down();
  await page.mouse.move(stage.right - 40, centerY, { steps: 6 });
  await page.mouse.up();
  await expect(viewer.locator("[data-lightbox-counter]")).toHaveText("1 of 5");

  await page.mouse.move(stage.left + 100, centerY);
  await page.mouse.down();
  await page.mouse.move(stage.left + 110, centerY + 5, { steps: 2 });
  await page.mouse.up();
  await expect(viewer.locator("[data-lightbox-counter]")).toHaveText("1 of 5");
});

test("video slides keep native controls and only enter the viewer through the title bar", async ({
  page,
}) => {
  await openPortfolio(page, DESKTOP);

  const video = slideMedia(page, STAND_STILL, 0);
  await expect(video).toHaveJSProperty("tagName", "VIDEO");
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).toHaveAttribute("playsinline", "");
  await expect(slide(page, STAND_STILL, 0).locator("button")).toHaveCount(0);
  await expect.poll(() => video.evaluate((element) => element.muted)).toBe(true);
  await video.click({ position: { x: 10, y: 10 } });
  await expect(lightbox(page)).toBeHidden();

  await section(page, STAND_STILL)
    .getByRole("button", { name: `Expand ${STAND_STILL.title} fullscreen` })
    .click();
  const viewer = lightbox(page);
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("[data-lightbox-counter]")).toHaveText("1 of 6");
  const viewerVideo = viewer.locator("video.lightbox__video");
  await expect(viewerVideo).toHaveAttribute("controls", "");
  await expect(viewerVideo).toHaveAttribute("src", /1\.mp4$/);
  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator("img.lightbox__image")).toHaveAttribute("src", /2\.jpg$/);
  await expect(viewer.locator("video")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
});

test("a configured Dropbox link replaces its disabled placeholder", async ({ page }) => {
  await page.route(/\/scripts\/home\/modeling-portfolio\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: portfolioSource.replace(
        'dropbox: Object.freeze({ highlights: "", digitals: "" })',
        'dropbox: Object.freeze({ highlights: "https://www.dropbox.com/scl/fo/test-highlights", digitals: "" })'
      ),
    })
  );
  await openPortfolio(page, DESKTOP);

  const highlights = page.getByRole("link", { name: "Dropbox Highlights" });
  await expect(highlights).toHaveAttribute(
    "href",
    "https://www.dropbox.com/scl/fo/test-highlights"
  );
  await expect(highlights).toHaveAttribute("target", "_blank");
  await expect(highlights).toHaveAttribute("rel", "noreferrer");
  await expect(page.locator("#portfolio-highlights-note")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dropbox Digitals" })).toBeDisabled();
  await expect(page.locator("#portfolio-digitals-note")).toBeVisible();
});

test("deep links and the jump list land on their shoot", async ({ page }) => {
  const vampire = shootById("modeling-vampire-shoot");
  await openPortfolio(page, MOBILE, { path: `/modeling/#${anchorId(vampire.id)}` });
  await expect
    .poll(async () => (await box(section(page, vampire))).top)
    .toBeLessThanOrEqual(24);

  await page.evaluate(() => window.scrollTo(0, 0));
  const nav = page.getByRole("navigation", { name: "Shoots" });
  await nav.locator("summary").click();
  await nav.getByRole("link", { name: `${LAST.title} ${LAST.date}` }).click();
  await expect.poll(async () => (await box(section(page, LAST))).top).toBeLessThanOrEqual(24);
  await expect(page).toHaveURL(new RegExp(`#${anchorId(LAST.id)}$`));

  const top = page.locator("[data-portfolio-top]");
  await expect(top).toBeVisible();
  await top.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(top).toBeHidden();
});

test("the mobile viewer fills the screen with reachable controls", async ({ page }) => {
  await openPortfolio(page, MOBILE);
  await section(page, CIRQUE).scrollIntoViewIfNeeded();
  await slide(page, CIRQUE, 0).locator("button").click();
  const viewer = lightbox(page);
  await expect(viewer).toBeVisible();

  const windowBox = await box(viewer.locator(".lightbox__window"));
  expect(windowBox).toEqual({ top: 0, left: 0, right: MOBILE.width, bottom: MOBILE.height });
  const close = await box(viewer.getByRole("button", { name: "Close fullscreen view" }));
  expect(close.bottom - close.top).toBeGreaterThanOrEqual(26);
  expect(close.right).toBeLessThanOrEqual(MOBILE.width);
  const next = await box(viewer.getByRole("button", { name: "Next photo" }));
  expect(next.bottom).toBeLessThanOrEqual(MOBILE.height);
  expect(next.bottom - next.top).toBeGreaterThanOrEqual(32);
  const image = await box(viewer.locator(".lightbox__image"));
  expect(image.right).toBeLessThanOrEqual(MOBILE.width);
  expect(image.bottom).toBeLessThanOrEqual(next.top);
  expect(await documentOverflows(page)).toBe(false);
});


test("the n of N control downloads the current photo from the carousel and the viewer", async ({
  page,
}) => {
  await openPortfolio(page, DESKTOP);
  const control = section(page, STAND_STILL).locator(".carousel__download");

  await expect(control).toHaveAttribute("href", /stand-still-mar26\/1\.mp4$/);
  await expect(control).toHaveAttribute("download", "stand-still-drop-1-of-6.mp4");
  await expect(control).toHaveAccessibleName("Download clip 1 of 6");
  await expect(control.locator("img")).toHaveAttribute("src", /download\.ico$/);

  await section(page, STAND_STILL).getByRole("button", { name: "Next photo" }).click();
  await expect(control).toHaveAttribute("href", /stand-still-mar26\/2\.jpg$/);
  await expect(control).toHaveAttribute("download", "stand-still-drop-2-of-6.jpg");
  await expect(control).toHaveAccessibleName("Download photo 2 of 6");
  await expect(control).toContainText("2 of 6");

  const carouselDownload = page.waitForEvent("download");
  await counter(page, STAND_STILL).click();
  expect((await carouselDownload).suggestedFilename()).toBe("stand-still-drop-2-of-6.jpg");

  await slide(page, STAND_STILL, 1).locator("button").click();
  const viewer = lightbox(page);
  await expect(viewer).toBeVisible();
  const viewerControl = viewer.locator(".lightbox__download");
  await expect(viewerControl).toHaveAttribute("download", "stand-still-drop-2-of-6.jpg");
  await page.keyboard.press("ArrowRight");
  await expect(viewerControl).toHaveAttribute("download", "stand-still-drop-3-of-6.jpg");
  await expect(viewerControl).toHaveAccessibleName("Download photo 3 of 6");
  const viewerDownload = page.waitForEvent("download");
  await viewerControl.click();
  expect((await viewerDownload).suggestedFilename()).toBe("stand-still-drop-3-of-6.jpg");
  await expect(viewer).toBeVisible();
});
