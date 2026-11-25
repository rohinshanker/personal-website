/**
 * Home's two ways to the standalone /modeling/ route.
 *
 * The Modeling window opens straight onto its newest shoot under a pinned
 * "Modeling Portfolio Site" row that is a plain new-tab link, never a view.
 * The `modeling-portfolio-alert` random event offers the same route through
 * a Sure! link beside a Close control. These cases render both at every review
 * viewport and follow each link into a real popup.
 */

import { expect, test } from "./deterministic.mjs";
import {
  installStubbedModelingMedia,
  openHomeDesktop,
  REVIEW_VIEWPORT,
  REVIEW_VIEWPORTS,
  settleRender,
} from "./helpers/rendered-site.mjs";

test.setTimeout(120_000);

const MODELING_ICON = "assets/app-icons/ico/accessibility_window_objs.ico";
const NEWEST_SHOOT = "modeling-digitals-miffy-sep2026";
const OTHER_SHOOT = "modeling-stand-still-drop";

const modelingWindow = (page) => page.locator('[data-app-window="modeling"]');
const pinnedRow = (page) => modelingWindow(page).locator(".selector-list > li").first();
const pinnedLink = (page) => pinnedRow(page).getByRole("link", { name: "Modeling Portfolio Site" });
const shootRow = (page, id) => modelingWindow(page).locator(`.selector-item[data-view="${id}"]`);
const shootPanel = (page, id) => modelingWindow(page).locator(`.viewer-content[data-view="${id}"]`);

/** The live alert: the Administrator preview clones the same ids. */
const alertWindow = (page) =>
  page.locator("#modeling-portfolio-alert-window:not([data-admin-event-preview-window])");

const openHome = async (page, viewport) => {
  await installStubbedModelingMedia(page.context());
  await openHomeDesktop(page, viewport);
};

const launchModeling = async (page) => {
  await page.locator('.taskbar-icon[data-app="modeling"]').click();
  await expect(modelingWindow(page)).toBeVisible();
  await expect(modelingWindow(page)).not.toHaveClass(/is-opening/);
  await settleRender(page);
};

/** Forces the event the way a developer does from the console. */
const forceModelingAlert = async (page) => {
  const result = await page.evaluate(async () => {
    await window.homeResources.loadAdminResources();
    return window.rohinAdminOrchestrator.runEvent("modeling-portfolio-alert", { source: "dev" });
  });
  expect(result.ok, result.message).toBe(true);
  const win = alertWindow(page);
  await expect(win).toBeVisible();
  await expect(win).toHaveAttribute("aria-hidden", "false");
  await expect(win).not.toHaveClass(/is-opening/);
  await settleRender(page);
  return win;
};

const expectDecoded = (image) =>
  expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

/** Follows a new-tab link and checks the popup is the portfolio, detached from Home. */
const expectPortfolioPopup = async (page, activate) => {
  const popupPromise = page.waitForEvent("popup");
  await activate();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  expect(new URL(popup.url()).pathname).toBe("/modeling/");
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await expect(popup.getByRole("heading", { level: 1 })).toHaveText(
    "Rohin Shanker Modeling Portfolio",
  );
  await popup.close();
};

test("Modeling opens on its newest shoot under the pinned portfolio row at every review viewport", async ({
  page,
}) => {
  for (const viewport of REVIEW_VIEWPORTS) {
    await test.step(viewport.name, async () => {
      await openHome(page, viewport);
      await launchModeling(page);

      await expect(page.locator(".launch-prompt-window:visible")).toHaveCount(0);
      await expect(page.locator("#modeling-launch-window")).toHaveCount(0);

      const link = pinnedLink(page);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/modeling/");
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      await expect(link).not.toHaveClass(/is-active/);
      await expect(link).not.toHaveAttribute("data-view");
      await expect(link.locator(".selector-desc")).toHaveCount(0);
      const icon = link.locator(".selector-thumb");
      await expect(icon).toHaveAttribute("src", MODELING_ICON);
      await expectDecoded(icon);

      await expect(shootRow(page, NEWEST_SHOOT)).toHaveClass(/is-active/);
      await expect(modelingWindow(page).locator(".selector-item.is-active")).toHaveCount(1);
      await expect(shootPanel(page, NEWEST_SHOOT)).toBeVisible();

      const geometry = await modelingWindow(page).evaluate((win, newest) => {
        const list = win.querySelector(".selector-list");
        const pinned = list.querySelector(".selector-item--link").getBoundingClientRect();
        const shoot = list
          .querySelector(`.selector-item[data-view="${newest}"]`)
          .getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        return {
          pinnedAboveShoot: pinned.bottom <= shoot.top + 0.5,
          pinnedInsideList:
            pinned.left >= listRect.left - 0.5 && pinned.right <= listRect.right + 0.5,
          sameWidth: Math.abs(pinned.width - shoot.width) < 1,
          listOverflowX: list.scrollWidth > list.clientWidth + 1,
        };
      }, NEWEST_SHOOT);
      expect(geometry).toEqual({
        pinnedAboveShoot: true,
        pinnedInsideList: true,
        sameWidth: true,
        listOverflowX: false,
      });

      await modelingWindow(page).locator('[data-close="modeling"]').click();
      await expect(modelingWindow(page)).toBeHidden();
    });
  }
});

test("the pinned row opens /modeling/ in a detached new tab by click or Enter and keeps the shoot", async ({
  page,
}) => {
  await openHome(page, REVIEW_VIEWPORT.desktop);
  await launchModeling(page);
  await shootRow(page, OTHER_SHOOT).click();
  await expect(shootPanel(page, OTHER_SHOOT)).toBeVisible();

  await expectPortfolioPopup(page, () => pinnedLink(page).click());
  await expect(modelingWindow(page)).toBeVisible();
  await expect(shootRow(page, OTHER_SHOOT)).toHaveClass(/is-active/);
  await expect(shootPanel(page, OTHER_SHOOT)).toBeVisible();

  await pinnedLink(page).focus();
  await expectPortfolioPopup(page, () => pinnedLink(page).press("Enter"));
  await expect(shootRow(page, OTHER_SHOOT)).toHaveClass(/is-active/);

  // Reopening resets to the newest shoot, never to the pinned link.
  await modelingWindow(page).locator('[data-close="modeling"]').click();
  await expect(modelingWindow(page)).toBeHidden();
  await launchModeling(page);
  await expect(shootRow(page, NEWEST_SHOOT)).toHaveClass(/is-active/);
  await expect(shootPanel(page, NEWEST_SHOOT)).toBeVisible();
  await expect(shootPanel(page, OTHER_SHOOT)).toBeHidden();
});

test("the Modeling portfolio alert renders its logo, message, Sure! and Close at every review viewport", async ({
  page,
}) => {
  for (const viewport of REVIEW_VIEWPORTS) {
    await test.step(viewport.name, async () => {
      await openHome(page, viewport);
      const win = await forceModelingAlert(page);

      await expect(win).toHaveAttribute("role", "dialog");
      await expect(win).toHaveAccessibleName("System Alert");
      await expect(win).toHaveAccessibleDescription("Check out my modeling portfolio!");
      const icon = win.locator(".random-alert-message img");
      await expect(icon).toHaveAttribute("src", MODELING_ICON);
      await expectDecoded(icon);

      const sure = win.getByRole("link", { name: "Sure!" });
      await expect(sure).toHaveAttribute("href", "/modeling/");
      await expect(sure).toHaveAttribute("target", "_blank");
      await expect(sure).toHaveAttribute("rel", "noopener noreferrer");
      const close = win.getByRole("button", { name: "Close" });
      await expect(close).toBeVisible();
      await expect(win.locator(".window-body").getByRole("button")).toHaveCount(0);

      const metrics = await win.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const sureRect = element
          .querySelector("#modeling-portfolio-alert-sure")
          .getBoundingClientRect();
        const taskbarTop = document.querySelector(".taskbar").getBoundingClientRect().top;
        return {
          inside:
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= window.innerWidth &&
            rect.bottom <= taskbarTop,
          sureInside: sureRect.right <= rect.right && sureRect.bottom <= rect.bottom,
          sureMinWidth: sureRect.width >= 74,
          sureHeight: Math.round(sureRect.height),
          pageOverflowX:
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      expect(metrics).toEqual({
        inside: true,
        sureInside: true,
        sureMinWidth: true,
        sureHeight: 23,
        pageOverflowX: false,
      });

      await close.click();
      await expect(win).toBeHidden();
      await expect(win).toHaveAttribute("aria-hidden", "true");
    });
  }
});

test("Sure! opens /modeling/ in a detached new tab and dismisses the alert", async ({ page }) => {
  await openHome(page, REVIEW_VIEWPORT.desktop);
  const win = await forceModelingAlert(page);

  await expectPortfolioPopup(page, () => win.getByRole("link", { name: "Sure!" }).click());
  await expect(win).toBeHidden();
  await expect(win).toHaveAttribute("aria-hidden", "true");
  await expect(modelingWindow(page)).toBeHidden();

  // The event can fire again once dismissed.
  await forceModelingAlert(page);
});
