import { expect, test } from "./deterministic.mjs";
import {
  installStubbedModelingMedia,
  openApp,
  openDeterministicRoute,
  openHomeDesktop,
  settleRender,
} from "./helpers/rendered-site.mjs";

/**
 * A small curated set of reference screenshots for the states a visitor always
 * sees: the entry loader, the Home desktop, the About window that greets every
 * visitor, and two application windows, at desktop and mobile widths.
 *
 * Baselines are byte-comparable only when the browser, fonts, and rasterizer
 * match, so they are generated and compared exclusively in the Playwright
 * container pinned by `package-lock.json`. `npm run test:visual` starts it.
 */

const MOBILE = Object.freeze({ width: 375, height: 812 });
const DESKTOP = Object.freeze({ width: 1280, height: 800 });

test.beforeAll(() => {
  if (process.platform !== "linux") {
    throw new Error(
      [
        `Visual baselines are generated on linux; this host is ${process.platform}.`,
        "Run `npm run test:visual` (or `npm run test:visual:update`) instead, which",
        "runs this project inside the pinned Playwright container.",
      ].join("\n")
    );
  }
});

test("the entry loader matches its reference render at desktop and mobile", async ({
  page,
}) => {
  for (const [name, viewport] of Object.entries({ desktop: DESKTOP, mobile: MOBILE })) {
    await openDeterministicRoute(page, "/", viewport);
    await expect(page.locator("#proceed-button")).toBeEnabled({ timeout: 20_000 });
    await expect(page.locator("#status-text")).toHaveText("Ready. Click Proceed to continue.");
    await settleRender(page);

    await expect(page).toHaveScreenshot(`entry-ready-${name}.png`, { fullPage: true });
  }
});

test("the entry alert dialog matches its reference render", async ({ page }) => {
  await openDeterministicRoute(page, "/", DESKTOP);
  await page.locator("#cancel-button").click();
  const dialog = page.locator("#alert-overlay .alert-window");
  await expect(dialog).toBeVisible();
  await settleRender(page);

  await expect(dialog).toHaveScreenshot("entry-alert-dialog.png");
});

test("the Home desktop matches its reference render at desktop and mobile", async ({
  page,
}) => {
  // The Neko launcher breathes by swapping sprites on a `setInterval`, and a
  // fixed Date alone does not pause that timer. Masking keeps its position and
  // size under comparison while leaving the alternating frame out.
  const breathingNeko = page.locator("[data-neko-sleeping-cat]");

  for (const [name, viewport] of Object.entries({ desktop: DESKTOP, mobile: MOBILE })) {
    await openHomeDesktop(page, viewport);
    await expect(page.locator(".desktop")).toBeVisible();
    await expect(page.locator('[role="toolbar"][aria-label="Taskbar"]')).toBeVisible();

    await expect(page).toHaveScreenshot(`home-desktop-${name}.png`, {
      fullPage: true,
      mask: [breathingNeko],
    });
  }
});

test("the About window matches its reference render", async ({ page }) => {
  await openDeterministicRoute(page, "/home.html", DESKTOP);
  const about = page.locator("#about-window");
  await expect(about).toBeVisible();
  await expect(about).not.toHaveClass(/is-opening/);
  await settleRender(page);

  await expect(about).toHaveScreenshot("home-about-window.png");
});

test("the Minesweeper window matches its reference render", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  const minesweeper = await openApp(page, "minesweeper");
  await expect(page.locator("#ms-grid .ms-cell")).toHaveCount(81);

  await expect(minesweeper).toHaveScreenshot("home-minesweeper-window.png");
});

test("the offline Game Progress window matches its reference render", async ({ page }) => {
  await openHomeDesktop(page, DESKTOP);
  const progress = await openApp(page, "game-progress");
  await expect(progress).toBeVisible();
  await settleRender(page);

  await expect(progress).toHaveScreenshot("home-game-progress-window.png");
});

test("the modeling portfolio route matches its reference render at desktop and mobile", async ({
  page,
}) => {
  // Photos and clips are stubbed, and the container's Chromium has no H.264
  // decoder, so the strips are masked: their position and size are still
  // compared while the baseline records the page chrome and controls.
  await installStubbedModelingMedia(page);
  for (const [name, viewport] of Object.entries({ desktop: DESKTOP, mobile: MOBILE })) {
    await openDeterministicRoute(page, "/modeling/", viewport);
    await expect(page.locator("section.shoot")).toHaveCount(20);
    await settleRender(page);

    await expect(page).toHaveScreenshot(`modeling-portfolio-${name}.png`, {
      mask: [page.locator(".carousel__strip")],
    });
  }
});
