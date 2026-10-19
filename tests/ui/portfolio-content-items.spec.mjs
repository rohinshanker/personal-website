// The newest Projects items and the pinned Substack Writing item render as the
// default views, their carousels step through every figure with real images,
// and nothing overflows at the four review viewports.

import { expect, test } from "./deterministic.mjs";
import { openApp } from "./helpers/rendered-site.mjs";

test.setTimeout(120_000);

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
];

const expectContained = async (win, view) => {
  const metrics = await win.evaluate((element, viewId) => {
    const panel = element.querySelector(`.viewer-content[data-view="${viewId}"]`);
    const viewer = panel.closest(".viewer-panel");
    const rect = element.getBoundingClientRect();
    return {
      viewerOverflow: viewer.scrollWidth > viewer.clientWidth + 1,
      windowLeft: rect.left,
      windowRight: rect.right,
      viewport: window.innerWidth,
    };
  }, view);
  expect(metrics.viewerOverflow).toBe(false);
  expect(metrics.windowLeft).toBeGreaterThanOrEqual(-1);
  expect(metrics.windowRight).toBeLessThanOrEqual(metrics.viewport + 1);
};

const stepCarousel = async (panel, captions) => {
  const image = panel.locator(".gallery-scroll > img[id$='-project-image']");
  const counter = panel.locator(".gallery-counter");
  const caption = panel.locator("[id$='-caption']");
  for (const [index, expected] of captions.entries()) {
    await expect(counter).toHaveText(`${index + 1} of ${captions.length}`);
    await expect(caption).toHaveText(expected);
    await expect
      .poll(() => image.evaluate((img) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    await panel.locator(".gallery-controls button").last().click();
  }
  await expect(counter).toHaveText(`1 of ${captions.length}`);
};

for (const viewport of viewports) {
  test(`new Projects and Writing items render and navigate at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      Math.random = () => 0.999999;
    });
    await page.goto("/home.html", { waitUntil: "domcontentloaded" });

    const projects = await openApp(page, "windows");
    const cyanoItem = projects.locator(
      '.selector-item[data-view="projects-cyano-gene-visualizer"]',
    );
    await expect(cyanoItem).toHaveClass(/is-active/);
    const cyano = projects.locator('.viewer-content[data-view="projects-cyano-gene-visualizer"]');
    await expect(cyano).toBeVisible();
    await expect(cyano.getByRole("link", { name: "Open the visualizer" })).toHaveAttribute(
      "href",
      "https://rohinshanker.github.io/isaacs-cyano-gene-selection/",
    );
    await stepCarousel(cyano, [
      "Native codon space",
      "Recoding scheme and gene search",
      "Chromosome and plasmid tracks",
    ]);
    await expectContained(projects, "projects-cyano-gene-visualizer");

    await projects.locator('.selector-item[data-view="projects-win98-site-kit"]').click();
    const kit = projects.locator('.viewer-content[data-view="projects-win98-site-kit"]');
    await expect(kit).toBeVisible();
    await expect(cyano).toBeHidden();
    await expect(kit.getByRole("link", { name: "Open showcase" })).toHaveAttribute(
      "href",
      "https://rohinshanker.github.io/win98-site-kit/",
    );
    await stepCarousel(kit, ["Showcase desktop", "Components demo"]);
    await expectContained(projects, "projects-win98-site-kit");
    await projects.getByRole("button", { name: "Close" }).click();

    const writing = await openApp(page, "taskmgr");
    await expect(writing.locator('.selector-item[data-view="writing-substack"]')).toHaveClass(
      /is-active/,
    );
    const substack = writing.locator('.viewer-content[data-view="writing-substack"]');
    await expect(substack.getByRole("heading", { name: "Substack" })).toBeVisible();
    await expect(substack).toContainText("Read my latest publications on Substack.");
    await expect(substack.getByRole("link", { name: "Open Substack" })).toHaveAttribute(
      "href",
      "https://rohins.substack.com/",
    );
    await expect(substack.getByRole("link", { name: "Subscribe" })).toHaveAttribute(
      "href",
      "https://rohins.substack.com/subscribe",
    );
    const logo = substack.locator(".writing-substack-logo");
    await expect
      .poll(() => logo.evaluate((img) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    const box = await logo.boundingBox();
    expect(Math.round(box.width)).toBe(64);
    await expectContained(writing, "writing-substack");
  });
}
