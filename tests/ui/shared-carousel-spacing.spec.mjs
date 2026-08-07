import { expect, test } from "./fixtures.mjs";

test.setTimeout(180_000);

const viewports = [
  { width: 375, height: 812, name: "mobile" },
  { width: 375, height: 500, name: "short-mobile" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 1280, height: 800, name: "desktop" },
  { width: 1440, height: 900, name: "wide" },
];

const disableRemoteGameStats = async (page) => {
  await page.route(/\/scripts\/home\/game-stats-backend\.js(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.rohinGameStatsBackend = Object.freeze({ apiBaseUrl: "", buildVersion: "test" });`,
    })
  );
};

const measureGallery = (gallery) =>
  gallery.evaluate((frame) => {
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
    const scroll = frame.querySelector(".gallery-scroll");
    const media = scroll.querySelector(":scope > img, :scope > video, :scope > iframe");
    const loader = scroll.querySelector(":scope > .gallery-loading-indicator");
    const frameStyle = getComputedStyle(frame);
    const scrollStyle = getComputedStyle(scroll);
    return {
      documentOverflow:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.documentElement.scrollHeight > window.innerHeight,
      frame: bounds(frame),
      framePadding: Number.parseFloat(frameStyle.padding),
      insetToken: scrollStyle.getPropertyValue("--gallery-content-inset").trim(),
      loader: loader && !loader.hidden ? bounds(loader) : null,
      media: bounds(media),
      mediaObjectFit: getComputedStyle(media).objectFit,
      scroll: bounds(scroll),
      scrollHorizontalOverflow: scroll.scrollWidth > scroll.clientWidth,
      scrollPaddingBottom: Number.parseFloat(scrollStyle.paddingBottom),
      scrollPaddingLeft: Number.parseFloat(scrollStyle.paddingLeft),
      scrollPaddingRight: Number.parseFloat(scrollStyle.paddingRight),
      scrollPaddingTop: Number.parseFloat(scrollStyle.paddingTop),
      scrollVerticalOverflow: scroll.scrollHeight > scroll.clientHeight,
    };
  });

const expectSharedInsetGeometry = (metrics, { loading = false } = {}) => {
  expect(metrics.insetToken).toBe("2px");
  expect(metrics.scrollPaddingTop).toBeCloseTo(2, 1);
  expect(metrics.scrollPaddingRight).toBeCloseTo(2, 1);
  expect(metrics.scrollPaddingBottom).toBeCloseTo(2, 1);
  expect(metrics.scrollPaddingLeft).toBeCloseTo(2, 1);
  expect(metrics.media.left).toBeCloseTo(
    metrics.scroll.left + metrics.scrollPaddingLeft,
    1
  );
  expect(metrics.media.right).toBeCloseTo(
    metrics.scroll.right - metrics.scrollPaddingRight,
    1
  );
  expect(metrics.media.top).toBeCloseTo(
    metrics.scroll.top + metrics.scrollPaddingTop,
    1
  );
  expect(metrics.media.bottom).toBeCloseTo(
    metrics.scroll.bottom - metrics.scrollPaddingBottom,
    1
  );
  expect(metrics.scroll.left - metrics.frame.left).toBeCloseTo(metrics.framePadding, 1);
  expect(metrics.frame.right - metrics.scroll.right).toBeCloseTo(metrics.framePadding, 1);
  expect(metrics.scroll.top - metrics.frame.top).toBeCloseTo(metrics.framePadding, 1);
  expect(metrics.scrollHorizontalOverflow).toBe(false);
  expect(metrics.scrollVerticalOverflow).toBe(false);
  expect(metrics.documentOverflow).toBe(false);
  expect(metrics.mediaObjectFit).toBe("contain");

  if (loading) {
    expect(metrics.loader).not.toBeNull();
    expect(metrics.loader.left).toBeCloseTo(metrics.media.left, 1);
    expect(metrics.loader.right).toBeCloseTo(metrics.media.right, 1);
    expect(metrics.loader.top).toBeCloseTo(metrics.media.top, 1);
    expect(metrics.loader.bottom).toBeCloseTo(metrics.media.bottom, 1);
  } else {
    expect(metrics.loader).toBeNull();
  }
};

test("shared carousel inset keeps Modeling media and loaders clear of the frame", async ({
  page,
}, testInfo) => {
  const consoleErrors = [];
  const runtimeErrors = [];
  let releaseFirstImage;
  let firstImageRequests = 0;
  const firstImageGate = new Promise((resolve) => {
    releaseFirstImage = resolve;
  });

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.route(
    /\/assets\/modeling\/fast-sonder-lb2-may2025\/1\.jpg(?:\?.*)?$/i,
    async (route) => {
      firstImageRequests += 1;
      await firstImageGate;
      await route.continue();
    }
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
    localStorage.clear();
  });
  await disableRemoteGameStats(page);
  await page.goto("/home.html", { waitUntil: "domcontentloaded" });
  await page.locator('.taskbar-icon[data-app="modeling"]').click();
  await page
    .locator('.selector-item[data-view="modeling-fast-sonder-lookbook-shoot-2"]')
    .click();

  const gallery = page.locator(
    '[data-modeling-gallery="modeling-fast-sonder-lookbook-shoot-2"] .gallery-frame'
  );
  const scroll = gallery.locator(".gallery-scroll");
  const image = scroll.locator(":scope > img");
  const counter = gallery.locator(".gallery-counter");
  const previous = gallery.getByRole("button", { name: "Previous item" });
  const next = gallery.getByRole("button", { name: "Next item" });

  await expect(gallery).toBeVisible();
  await expect.poll(() => firstImageRequests).toBe(1);
  await expect(scroll).toHaveAttribute("aria-busy", "true");
  await expect(scroll.locator(":scope > .gallery-loading-indicator")).toBeVisible();
  expectSharedInsetGeometry(await measureGallery(gallery), { loading: true });
  await gallery.screenshot({
    path: testInfo.outputPath("shared-carousel-modeling-loading.png"),
  });

  releaseFirstImage();
  await expect
    .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0))
    .toBe(true);
  await expect(scroll).not.toHaveAttribute("aria-busy", "true");
  await expect(scroll.locator(":scope > .gallery-loading-indicator")).toBeHidden();
  await expect(counter).toHaveText("1 of 12");

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await gallery.scrollIntoViewIfNeeded();
      await expect(gallery).toBeVisible();
      const first = await measureGallery(gallery);
      expectSharedInsetGeometry(first);

      await next.evaluate((button) => button.click());
      await expect(counter).toHaveText("2 of 12");
      await expect
        .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0))
        .toBe(true);
      const second = await measureGallery(gallery);
      expectSharedInsetGeometry(second);
      expect(second.frame.width).toBeCloseTo(first.frame.width, 1);
      expect(second.frame.height).toBeCloseTo(first.frame.height, 1);
      expect(second.scroll.width).toBeCloseTo(first.scroll.width, 1);
      expect(second.scroll.height).toBeCloseTo(first.scroll.height, 1);
      expect(second.media.width).toBeCloseTo(first.media.width, 1);
      expect(second.media.height).toBeCloseTo(first.media.height, 1);

      await gallery.screenshot({
        path: testInfo.outputPath(`shared-carousel-modeling-${viewport.name}.png`),
      });
      await previous.evaluate((button) => button.click());
      await expect(counter).toHaveText("1 of 12");
    });
  }

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
